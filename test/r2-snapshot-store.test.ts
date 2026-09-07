import test from "node:test";
import assert from "node:assert/strict";
import { createR2SnapshotStore } from "../src/storage/r2-snapshot-store.ts";

class MemoryObject {
  private readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  async text() {
    return this.value;
  }

  async json<T>() {
    return JSON.parse(this.value) as T;
  }
}

test("stores and reuses content-addressed snapshots in an R2-compatible bucket", async () => {
  const objects = new Map<string, string>();
  let writes = 0;
  const bucket = {
    async get(key: string) {
      const value = objects.get(key);
      return value === undefined ? null : new MemoryObject(value);
    },
    async put(key: string, value: string) {
      writes += 1;
      objects.set(key, value);
      return {};
    }
  };
  const store = createR2SnapshotStore(bucket);
  const input = {
    sourceUrl: "https://example.test/bill.xml",
    body: "<bill><section>Energy &amp; grid</section></bill>",
    mediaType: "application/xml",
    parserVersion: "test@1"
  };

  const first = await store.save(input);
  const second = await store.save(input);

  assert.equal(first.id, second.id);
  assert.equal(first.fetchedAt, second.fetchedAt);
  assert.equal(second.normalizedText, "Energy & grid");
  assert.equal(writes, 3);
  assert.match(first.rawStoragePath, /^snapshots\/[a-f0-9]{2}\/[a-f0-9]{64}\/source\.xml$/);
});
