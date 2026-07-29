import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import type { SourceSnapshot } from "../domain/types.ts";

export interface SaveSnapshotInput {
  sourceUrl: string;
  body: string;
  mediaType: string;
  parserVersion: string;
  upstreamUpdatedAt?: string;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " "
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? match;
  });
}

export function normalizeSourceText(body: string, mediaType: string): string {
  if (mediaType.includes("xml") || mediaType.includes("html")) {
    return decodeEntities(
      body
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    ).replace(/\s+/g, " ").trim();
  }
  return body.replace(/\r\n/g, "\n").trim();
}

function extensionFor(mediaType: string, sourceUrl: string): string {
  const urlExtension = extname(new URL(sourceUrl).pathname);
  if (urlExtension && urlExtension.length <= 6) return urlExtension;
  if (mediaType.includes("json")) return ".json";
  if (mediaType.includes("xml")) return ".xml";
  if (mediaType.includes("html")) return ".html";
  if (mediaType.includes("pdf")) return ".pdf";
  return ".txt";
}

export function createSnapshotStore(dataRoot: string, workspaceRoot = process.cwd()) {
  const snapshotsRoot = join(dataRoot, "snapshots");

  async function save(input: SaveSnapshotInput): Promise<SourceSnapshot & { normalizedText: string }> {
    const sha256 = createHash("sha256").update(input.body).digest("hex");
    const id = `sha256:${sha256}`;
    const directory = join(snapshotsRoot, sha256.slice(0, 2), sha256);
    const rawPath = join(directory, `source${extensionFor(input.mediaType, input.sourceUrl)}`);
    const normalizedPath = join(directory, "normalized.txt");
    const metadataPath = join(directory, "metadata.json");
    const normalizedText = normalizeSourceText(input.body, input.mediaType);
    await mkdir(directory, { recursive: true });

    try {
      const [existingMetadata, existingNormalizedText] = await Promise.all([
        readFile(metadataPath, "utf8"),
        readFile(normalizedPath, "utf8")
      ]);
      return { ...JSON.parse(existingMetadata), normalizedText: existingNormalizedText };
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    }

    const snapshot: SourceSnapshot = {
      id,
      sourceUrl: input.sourceUrl,
      fetchedAt: new Date().toISOString(),
      mediaType: input.mediaType,
      sha256,
      rawStoragePath: relative(workspaceRoot, rawPath),
      normalizedStoragePath: relative(workspaceRoot, normalizedPath),
      parserVersion: input.parserVersion,
      ...(input.upstreamUpdatedAt ? { upstreamUpdatedAt: input.upstreamUpdatedAt } : {})
    };

    await Promise.all([
      writeFile(rawPath, input.body, "utf8"),
      writeFile(normalizedPath, normalizedText, "utf8"),
      writeFile(metadataPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8")
    ]);
    return { ...snapshot, normalizedText };
  }

  async function readNormalized(snapshot: SourceSnapshot): Promise<string> {
    return readFile(join(workspaceRoot, snapshot.normalizedStoragePath), "utf8");
  }

  return { save, readNormalized };
}
