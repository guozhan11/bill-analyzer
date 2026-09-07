import type { SourceSnapshot } from "../domain/types.ts";
import { extensionFor, normalizeSourceText, type SaveSnapshotInput } from "./snapshot-utils.ts";

interface SnapshotObject {
  text(): Promise<string>;
  json<T>(): Promise<T>;
}

interface SnapshotBucket {
  get(key: string): Promise<SnapshotObject | null>;
  put(key: string, value: string, options?: R2PutOptions): Promise<unknown>;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export function createR2SnapshotStore(bucket: SnapshotBucket) {
  async function save(input: SaveSnapshotInput): Promise<SourceSnapshot & { normalizedText: string }> {
    const digest = await sha256(input.body);
    const prefix = `snapshots/${digest.slice(0, 2)}/${digest}`;
    const rawStoragePath = `${prefix}/source${extensionFor(input.mediaType, input.sourceUrl)}`;
    const normalizedStoragePath = `${prefix}/normalized.txt`;
    const metadataPath = `${prefix}/metadata.json`;

    const existingMetadata = await bucket.get(metadataPath);
    if (existingMetadata) {
      const [snapshot, normalized] = await Promise.all([
        existingMetadata.json<SourceSnapshot>(),
        bucket.get(normalizedStoragePath)
      ]);
      if (normalized) return { ...snapshot, normalizedText: await normalized.text() };
    }

    const normalizedText = normalizeSourceText(input.body, input.mediaType);
    const snapshot: SourceSnapshot = {
      id: `sha256:${digest}`,
      sourceUrl: input.sourceUrl,
      fetchedAt: new Date().toISOString(),
      mediaType: input.mediaType,
      sha256: digest,
      rawStoragePath,
      normalizedStoragePath,
      parserVersion: input.parserVersion,
      ...(input.upstreamUpdatedAt ? { upstreamUpdatedAt: input.upstreamUpdatedAt } : {})
    };

    await Promise.all([
      bucket.put(rawStoragePath, input.body, { httpMetadata: { contentType: input.mediaType } }),
      bucket.put(normalizedStoragePath, normalizedText, { httpMetadata: { contentType: "text/plain; charset=utf-8" } }),
      bucket.put(metadataPath, JSON.stringify(snapshot), { httpMetadata: { contentType: "application/json" } })
    ]);
    return { ...snapshot, normalizedText };
  }

  async function readNormalized(snapshot: SourceSnapshot): Promise<string> {
    const object = await bucket.get(snapshot.normalizedStoragePath);
    if (!object) throw new Error(`Snapshot ${snapshot.id} has no normalized text in R2.`);
    return object.text();
  }

  return { save, readNormalized };
}
