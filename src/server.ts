import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, publicReadiness } from "./config.ts";
import { CongressApiError, createCongressClient } from "./adapters/congress-gov.ts";
import { parseBillInput } from "./domain/bill-id.ts";
import { ingestBill } from "./services/ingest-bill.ts";
import { createSnapshotStore } from "./storage/snapshot-store.ts";

const config = loadConfig();
const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(root, "public");
const schemaDir = join(root, "schemas");
const snapshots = createSnapshotStore(join(root, ".data"), root);

const staticRoutes: Record<string, string> = {
  "/": join(publicDir, "index.html"),
  "/app.js": join(publicDir, "app.js"),
  "/styles.css": join(publicDir, "styles.css")
};

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(response: import("node:http").ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, { "content-type": contentTypes[".json"] });
  response.end(JSON.stringify(body, null, 2));
}

async function sendFile(response: import("node:http").ServerResponse, path: string) {
  try {
    const body = await readFile(path);
    response.writeHead(200, { "content-type": contentTypes[extname(path)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    sendJson(response, 404, { error: "not_found" });
  }
}

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) throw new Error("request_too_large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("invalid_json");
  }
}

function errorResponse(error: unknown) {
  if (error instanceof CongressApiError) {
    return {
      statusCode: error.statusCode,
      body: { error: error.code, message: error.message, upstreamStatus: error.upstreamStatus ?? null }
    };
  }
  if (error instanceof Error && error.message === "invalid_json") {
    return { statusCode: 400, body: { error: "invalid_json", message: "Request body must be valid JSON." } };
  }
  if (error instanceof Error && error.message === "request_too_large") {
    return { statusCode: 413, body: { error: "request_too_large", message: "Request body is too large." } };
  }
  if (error instanceof Error && (
    error.message.includes("Bill input") ||
    error.message.includes("Congress number") ||
    error.message.includes("Bill number") ||
    error.message.includes("Congress.gov bill URL") ||
    error.message.includes("Unsupported bill type") ||
    error.message.includes("Invalid scope node")
  )) {
    return { statusCode: 400, body: { error: "invalid_bill_input", message: error.message } };
  }
  console.error(error);
  return { statusCode: 500, body: { error: "internal_error", message: "The request could not be completed." } };
}

const server = createServer(async (request, response) => {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { status: "ok", service: "bill-critique-mvp", version: "0.1.0" });
    return;
  }
  if (method === "GET" && url.pathname === "/api/readiness") {
    const readiness = publicReadiness(config);
    sendJson(response, readiness.status === "ready" ? 200 : 503, readiness);
    return;
  }
  if (method === "GET" && url.pathname === "/api/contracts") {
    sendJson(response, 200, {
      schemaVersion: "0.1.0",
      contracts: [
        "/schemas/source-snapshot.schema.json",
        "/schemas/legal-node.schema.json",
        "/schemas/finding.schema.json",
        "/schemas/analysis-run.schema.json"
      ]
    });
    return;
  }
  if (method === "POST" && url.pathname === "/api/bills/ingest") {
    if (!config.congressApiKey) {
      sendJson(response, 503, {
        error: "missing_api_key",
        message: "Set CONGRESS_API_KEY in the server environment before running ingestion."
      });
      return;
    }
    try {
      const body = await readJsonBody(request);
      const congress = body.congress === undefined || body.congress === ""
        ? undefined
        : Number(body.congress);
      const identity = parseBillInput(String(body.input ?? ""), congress);
      const result = await ingestBill({
        identity,
        requestedVersionCode: typeof body.versionCode === "string" && body.versionCode.trim()
          ? body.versionCode.trim().toLowerCase()
          : undefined,
        requestedScopeNodeId: typeof body.scopeNodeId === "string" && body.scopeNodeId.trim()
          ? body.scopeNodeId.trim()
          : undefined,
        client: createCongressClient({ apiKey: config.congressApiKey }),
        snapshots
      });
      sendJson(response, 200, result);
    } catch (error) {
      const mapped = errorResponse(error);
      sendJson(response, mapped.statusCode, mapped.body);
    }
    return;
  }

  const schemaMatch = method === "GET"
    ? url.pathname.match(/^\/schemas\/(source-snapshot|legal-node|finding|analysis-run)\.schema\.json$/)
    : null;
  if (schemaMatch) {
    await sendFile(response, join(schemaDir, `${schemaMatch[1]}.schema.json`));
    return;
  }
  const staticPath = method === "GET" ? staticRoutes[url.pathname] : undefined;
  if (staticPath) {
    await sendFile(response, staticPath);
    return;
  }
  if (method !== "GET" && method !== "POST") {
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }
  sendJson(response, 404, { error: "not_found" });
});

server.listen(config.port, config.host, () => {
  console.log(`Bill Critique MVP listening on http://${config.host}:${config.port}`);
});
