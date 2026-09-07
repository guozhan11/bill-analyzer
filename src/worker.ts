import { CongressApiError, createCongressClient } from "./adapters/congress-gov.ts";
import { parseBillInput } from "./domain/bill-id.ts";
import { ingestBill } from "./services/ingest-bill.ts";
import { createR2SnapshotStore } from "./storage/r2-snapshot-store.ts";

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff"
};
const MAX_REQUEST_BYTES = 16_384;

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const allowed = new Set(env.ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean));
  return allowed.has(origin) ? origin : null;
}

function corsHeaders(origin: string | null): HeadersInit {
  if (!origin) return { vary: "Origin" };
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return Response.json(body, {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin) }
  });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) throw new Error("request_too_large");
  if (!request.body) return {};

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new Error("request_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_json");
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("invalid_json");
  }
}

function mapError(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof CongressApiError) {
    return {
      status: error.statusCode,
      body: { error: error.code, message: error.message, upstreamStatus: error.upstreamStatus ?? null }
    };
  }
  if (error instanceof Error && error.message === "invalid_json") {
    return { status: 400, body: { error: "invalid_json", message: "Request body must be a JSON object." } };
  }
  if (error instanceof Error && error.message === "request_too_large") {
    return { status: 413, body: { error: "request_too_large", message: "Request body is too large." } };
  }
  if (error instanceof Error && (
    error.message.includes("Bill input") ||
    error.message.includes("Congress number") ||
    error.message.includes("Bill number") ||
    error.message.includes("Congress.gov bill URL") ||
    error.message.includes("Unsupported bill type") ||
    error.message.includes("Invalid scope node")
  )) {
    return { status: 400, body: { error: "invalid_bill_input", message: error.message } };
  }
  return { status: 500, body: { error: "internal_error", message: "The request could not be completed." } };
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const originHeader = request.headers.get("origin");
  const origin = allowedOrigin(request, env);

  if (originHeader && !origin) {
    return json({ error: "origin_not_allowed", message: "This website is not allowed to use the API." }, 403, null);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ status: "ok", service: "bill-analyzer-api", version: "0.1.0" }, 200, origin);
  }
  if (request.method === "GET" && url.pathname === "/api/readiness") {
    const ready = Boolean(env.CONGRESS_API_KEY);
    return json({
      status: ready ? "ready" : "not_ready",
      service: "bill-analyzer-api",
      congressApi: ready ? "configured" : "missing"
    }, ready ? 200 : 503, origin);
  }
  if (request.method === "POST" && url.pathname === "/api/bills/ingest") {
    if (!env.CONGRESS_API_KEY) {
      return json({ error: "missing_api_key", message: "The Congress.gov integration is not configured." }, 503, origin);
    }
    const actor = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.INGEST_RATE_LIMITER.limit({ key: `ingest:${actor}` });
    if (!success) {
      return json({ error: "rate_limited", message: "Too many analyses. Please try again in a minute." }, 429, origin);
    }

    const body = await readJsonBody(request);
    const congress = body.congress === undefined || body.congress === "" ? undefined : Number(body.congress);
    const identity = parseBillInput(String(body.input ?? ""), congress);
    const result = await ingestBill({
      identity,
      requestedVersionCode: typeof body.versionCode === "string" && body.versionCode.trim()
        ? body.versionCode.trim().toLowerCase()
        : undefined,
      requestedScopeNodeId: typeof body.scopeNodeId === "string" && body.scopeNodeId.trim()
        ? body.scopeNodeId.trim()
        : undefined,
      client: createCongressClient({ apiKey: env.CONGRESS_API_KEY }),
      snapshots: createR2SnapshotStore(env.SNAPSHOTS)
    });
    return json(result, 200, origin);
  }
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, origin);
  }
  return json({ error: "not_found" }, 404, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handle(request, env);
    } catch (error) {
      const mapped = mapError(error);
      console.error(JSON.stringify({
        message: "request_failed",
        path: new URL(request.url).pathname,
        status: mapped.status,
        error: error instanceof Error ? error.message : String(error)
      }));
      return json(mapped.body, mapped.status, allowedOrigin(request, env));
    }
  }
} satisfies ExportedHandler<Env>;
