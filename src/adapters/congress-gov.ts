import type { BillIdentity } from "../domain/types.ts";

const API_ROOT = "https://api.congress.gov/v3";
const DEFAULT_TIMEOUT_MS = 15_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class CongressApiError extends Error {
  statusCode: number;
  upstreamStatus?: number;
  code: string;

  constructor(message: string, options: { statusCode: number; code: string; upstreamStatus?: number }) {
    super(message);
    this.name = "CongressApiError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.upstreamStatus = options.upstreamStatus;
  }
}

export interface CongressClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
}

export interface TextFormat {
  type: string;
  url: string;
}

export interface TextVersion {
  code: string;
  name: string;
  date: string;
  formats: TextFormat[];
}

export interface CongressBillBundle {
  bill: Record<string, unknown>;
  versions: TextVersion[];
  summaries: Array<Record<string, unknown>>;
  subjects: {
    policyArea?: Record<string, unknown>;
    legislativeSubjects: Array<Record<string, unknown>>;
  };
  raw: {
    detail: unknown;
    text: unknown;
    summaries: unknown;
    subjects: unknown;
  };
}

function redactApiKeys(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/([?&]api_key=)[^&]+/gi, "$1[REDACTED]");
  }
  if (Array.isArray(value)) return value.map(redactApiKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redactApiKeys(child)]));
  }
  return value;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function versionCodeFromFormats(identity: BillIdentity, formats: TextFormat[]): string {
  const stem = `${identity.congress}${identity.billType}${identity.billNumber}`;
  const expression = new RegExp(`BILLS-${stem}([a-z0-9]+)\\.`, "i");
  for (const format of formats) {
    const match = format.url.match(expression);
    if (match) return match[1].toLowerCase();
  }
  return "unknown";
}

export function normalizeTextVersions(identity: BillIdentity, payload: any): TextVersion[] {
  const versions = Array.isArray(payload?.textVersions) ? payload.textVersions : [];
  return versions.map((version: any) => {
    const formats = Array.isArray(version?.formats)
      ? version.formats
          .filter((format: any) => typeof format?.url === "string")
          .map((format: any) => ({ type: String(format.type ?? "Unknown"), url: format.url }))
      : [];
    return {
      code: versionCodeFromFormats(identity, formats),
      name: String(version?.type ?? "Unknown version"),
      date: String(version?.date ?? ""),
      formats
    };
  });
}

export function selectTextVersion(versions: TextVersion[], requestedCode?: string): TextVersion {
  if (versions.length === 0) {
    throw new CongressApiError("Congress.gov has no text version for this bill.", {
      statusCode: 422,
      code: "no_text_version"
    });
  }
  if (requestedCode) {
    const selected = versions.find((version) => version.code === requestedCode.toLowerCase());
    if (!selected) {
      throw new CongressApiError(`Text version '${requestedCode}' is not available for this bill.`, {
        statusCode: 422,
        code: "version_not_found"
      });
    }
    return selected;
  }
  return versions.find((version) => version.code === "ih" || version.code === "is") ?? versions[0];
}

export function preferredTextFormat(version: TextVersion): TextFormat {
  const preferences = ["Formatted XML", "XML", "Formatted Text", "Text", "PDF"];
  for (const type of preferences) {
    const format = version.formats.find((candidate) => candidate.type.toLowerCase() === type.toLowerCase());
    if (format) return format;
  }
  if (version.formats[0]) return version.formats[0];
  throw new CongressApiError(`Text version '${version.code}' has no downloadable formats.`, {
    statusCode: 422,
    code: "no_text_format"
  });
}

export function createCongressClient(options: CongressClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? 2;

  async function requestJson(path: string): Promise<any> {
    const url = new URL(`${API_ROOT}${path}`);
    url.searchParams.set("format", "json");
    url.searchParams.set("api_key", options.apiKey);

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { accept: "application/json", "user-agent": "bill-critique-mvp/0.1.0" },
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch (error) {
        if (attempt < retries) {
          await sleep(250 * (2 ** attempt));
          continue;
        }
        throw new CongressApiError("Congress.gov could not be reached.", {
          statusCode: 502,
          code: error instanceof DOMException && error.name === "TimeoutError" ? "upstream_timeout" : "upstream_unavailable"
        });
      }

      if (response.ok) return response.json();
      if (RETRYABLE_STATUS.has(response.status) && attempt < retries) {
        const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
        await sleep(Number.isFinite(retryAfter) ? retryAfter * 1_000 : 250 * (2 ** attempt));
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        throw new CongressApiError("Congress.gov rejected the API key.", {
          statusCode: 503,
          code: "invalid_api_key",
          upstreamStatus: response.status
        });
      }
      if (response.status === 404) {
        throw new CongressApiError("The requested bill was not found on Congress.gov.", {
          statusCode: 404,
          code: "bill_not_found",
          upstreamStatus: response.status
        });
      }
      throw new CongressApiError(`Congress.gov returned HTTP ${response.status}.`, {
        statusCode: 502,
        code: "upstream_error",
        upstreamStatus: response.status
      });
    }
    throw new CongressApiError("Congress.gov request failed after retries.", {
      statusCode: 502,
      code: "upstream_unavailable"
    });
  }

  async function fetchBillBundle(identity: BillIdentity): Promise<CongressBillBundle> {
    const base = `/bill/${identity.congress}/${identity.billType}/${identity.billNumber}`;
    const [detail, text, summaries, subjects] = await Promise.all([
      requestJson(base),
      requestJson(`${base}/text`),
      requestJson(`${base}/summaries`),
      requestJson(`${base}/subjects`)
    ]);
    return {
      bill: detail?.bill ?? {},
      versions: normalizeTextVersions(identity, text),
      summaries: Array.isArray(summaries?.summaries) ? summaries.summaries : [],
      subjects: {
        policyArea: subjects?.subjects?.policyArea,
        legislativeSubjects: Array.isArray(subjects?.subjects?.legislativeSubjects)
          ? subjects.subjects.legislativeSubjects
          : []
      },
      raw: redactApiKeys({ detail, text, summaries, subjects }) as CongressBillBundle["raw"]
    };
  }

  async function downloadText(format: TextFormat): Promise<{ body: string; mediaType: string }> {
    let response: Response;
    try {
      response = await fetchImpl(format.url, {
        headers: { accept: "application/xml,text/xml,text/html,text/plain,application/pdf" },
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch {
      throw new CongressApiError("The selected bill text could not be downloaded.", {
        statusCode: 502,
        code: "text_download_failed"
      });
    }
    if (!response.ok) {
      throw new CongressApiError(`Bill text download returned HTTP ${response.status}.`, {
        statusCode: 502,
        code: "text_download_failed",
        upstreamStatus: response.status
      });
    }
    return {
      body: await response.text(),
      mediaType: response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream"
    };
  }

  return { fetchBillBundle, downloadText };
}
