import test from "node:test";
import assert from "node:assert/strict";
import {
  createCongressClient,
  normalizeTextVersions,
  preferredTextFormat,
  selectTextVersion
} from "../src/adapters/congress-gov.ts";
import { parseBillInput } from "../src/domain/bill-id.ts";

const identity = parseBillInput("https://www.congress.gov/bill/118th-congress/house-bill/5551");

test("normalizes version codes from official format URLs and prefers XML", () => {
  const versions = normalizeTextVersions(identity, {
    textVersions: [{
      date: "2023-09-18T04:00:00Z",
      type: "Introduced in House",
      formats: [
        { type: "Formatted Text", url: "https://example.test/BILLS-118hr5551ih.htm" },
        { type: "Formatted XML", url: "https://example.test/BILLS-118hr5551ih.xml" }
      ]
    }]
  });
  assert.equal(versions[0].code, "ih");
  assert.equal(selectTextVersion(versions).code, "ih");
  assert.equal(preferredTextFormat(versions[0]).type, "Formatted XML");
});

test("Congress client normalizes missing summaries and redacts API keys from raw data", async () => {
  const responses = new Map([
    ["/v3/bill/118/hr/5551", { bill: { title: "BIG WIRES Act" }, request: { url: "https://api.test/path?api_key=secret" } }],
    ["/v3/bill/118/hr/5551/text", { textVersions: [] }],
    ["/v3/bill/118/hr/5551/summaries", { summaries: [] }],
    ["/v3/bill/118/hr/5551/subjects", { subjects: { legislativeSubjects: [] } }]
  ]);
  const fetchImpl = async (input: string | URL | Request) => {
    const url = new URL(String(input));
    return new Response(JSON.stringify(responses.get(url.pathname)), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  const client = createCongressClient({ apiKey: "secret", fetchImpl: fetchImpl as typeof fetch });
  const bundle = await client.fetchBillBundle(identity);
  assert.deepEqual(bundle.summaries, []);
  assert.equal(JSON.stringify(bundle.raw).includes("secret"), false);
  assert.equal(JSON.stringify(bundle.raw).includes("[REDACTED]"), true);
});
