import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSnapshotStore, normalizeSourceText } from "../src/storage/snapshot-store.ts";

test("normalizes XML without losing text content", () => {
  const normalized = normalizeSourceText("<bill><section>Energy &amp; grid</section></bill>", "application/xml");
  assert.equal(normalized, "Energy & grid");
});

test("stores immutable content-addressed snapshots and reuses existing metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "bill-snapshot-test-"));
  const store = createSnapshotStore(join(root, ".data"), root);
  const input = {
    sourceUrl: "https://example.test/bill.xml",
    body: "<bill><section>Example</section></bill>",
    mediaType: "application/xml",
    parserVersion: "test@1"
  };
  const first = await store.save(input);
  const second = await store.save(input);
  assert.equal(first.id, second.id);
  assert.equal(first.fetchedAt, second.fetchedAt);
  assert.equal(second.normalizedText, "Example");
  assert.match(first.rawStoragePath, /^\.data\/snapshots\//);
});
