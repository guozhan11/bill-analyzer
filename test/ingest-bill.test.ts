import test from "node:test";
import assert from "node:assert/strict";
import { ingestBill } from "../src/services/ingest-bill.ts";
import { parseBillInput } from "../src/domain/bill-id.ts";

test("ingests one explicit version and only attaches a matching CRS summary", async () => {
  const identity = parseBillInput("https://www.congress.gov/bill/118th-congress/house-bill/10");
  const versions = [{
    code: "ih",
    name: "Introduced in House",
    date: "2023-01-01T00:00:00Z",
    formats: [{ type: "Formatted XML", url: "https://example.test/BILLS-118hr10ih.xml" }]
  }];
  const client = {
    async fetchBillBundle() {
      return {
        bill: {
          title: "Example Act",
          introducedDate: "2023-01-01",
          originChamber: "House",
          policyArea: { name: "Government Operations and Politics" },
          latestAction: { actionDate: "2023-01-02", text: "Referred to committee." },
          sponsors: []
        },
        versions,
        summaries: [
          { actionDesc: "Passed House", actionDate: "2023-02-01", text: "Later summary" },
          { actionDesc: "Introduced in House", actionDate: "2023-01-01", text: "<p>Introduced summary</p>" }
        ],
        subjects: { policyArea: { name: "Government Operations and Politics" }, legislativeSubjects: [] },
        raw: { detail: {}, text: {}, summaries: {}, subjects: {} }
      };
    },
    async downloadText() {
      return { body: "<bill>Example bill text</bill>", mediaType: "application/xml" };
    }
  };
  let counter = 0;
  const snapshots = {
    async save(input: { sourceUrl: string; body: string; mediaType: string; parserVersion: string }) {
      counter += 1;
      return {
        id: `sha256:${String(counter).padStart(64, "0")}`,
        sourceUrl: input.sourceUrl,
        fetchedAt: "2026-07-29T00:00:00Z",
        mediaType: input.mediaType,
        sha256: String(counter).padStart(64, "0"),
        rawStoragePath: "raw",
        normalizedStoragePath: "normalized",
        parserVersion: input.parserVersion,
        normalizedText: input.body.replace(/<[^>]+>/g, "")
      };
    }
  };

  const result = await ingestBill({ identity, client, snapshots });
  assert.equal(result.selectedVersion.code, "ih");
  assert.equal(result.selectedVersion.selectedFormat.type, "Formatted XML");
  assert.equal(result.summary?.text, "Introduced summary");
  assert.equal(result.summaryAvailability.count, 2);
  assert.equal(result.sources.metadata.id === result.sources.billText.id, false);
  assert.equal(result.critique.lenses.length, 5);
  assert.equal(result.critique.analysisRun.billId, identity.canonicalId);
  assert.equal(result.critique.analysisRun.versionCode, "ih");
});

test("maps an engrossed House text to a Passed House CRS summary", async () => {
  const identity = parseBillInput("https://www.congress.gov/bill/118th-congress/house-bill/10");
  const client = {
    async fetchBillBundle() {
      return {
        bill: { title: "Example Act", sponsors: [] },
        versions: [{
          code: "eh",
          name: "Engrossed in House",
          date: "2023-02-01T00:00:00Z",
          formats: [{ type: "Formatted XML", url: "https://example.test/BILLS-118hr10eh.xml" }]
        }],
        summaries: [{ actionDesc: "Passed House", actionDate: "2023-02-01", text: "Passed summary" }],
        subjects: { legislativeSubjects: [] },
        raw: { detail: {}, text: {}, summaries: {}, subjects: {} }
      };
    },
    async downloadText() {
      return { body: "<bill>Passed text</bill>", mediaType: "application/xml" };
    }
  };
  const snapshots = {
    async save(input: { sourceUrl: string; body: string; mediaType: string; parserVersion: string }) {
      return {
        id: `sha256:${"1".repeat(64)}`,
        sourceUrl: input.sourceUrl,
        fetchedAt: "2026-07-29T00:00:00Z",
        mediaType: input.mediaType,
        sha256: "1".repeat(64),
        rawStoragePath: "raw",
        normalizedStoragePath: "normalized",
        parserVersion: input.parserVersion,
        normalizedText: "Passed text"
      };
    }
  };
  const result = await ingestBill({ identity, requestedVersionCode: "eh", client, snapshots });
  assert.equal(result.summary?.actionDesc, "Passed House");
  assert.equal(result.summary?.text, "Passed summary");
  assert.equal(result.critique.analysisRun.versionCode, "eh");
});
