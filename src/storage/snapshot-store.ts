import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { SourceSnapshot } from "../domain/types.ts";
import { extensionFor, normalizeSourceText, type SaveSnapshotInput } from "./snapshot-utils.ts";

export { normalizeSourceText } from "./snapshot-utils.ts";

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
