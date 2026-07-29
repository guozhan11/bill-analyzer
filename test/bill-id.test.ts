import test from "node:test";
import assert from "node:assert/strict";
import { parseBillInput } from "../src/domain/bill-id.ts";

test("parses a Congress.gov House bill URL", () => {
  assert.deepEqual(
    parseBillInput("https://www.congress.gov/bill/118th-congress/house-bill/5551/text/ih"),
    {
      congress: 118,
      billType: "hr",
      billNumber: 5551,
      canonicalId: "bill:118:hr:5551",
      canonicalUrl: "https://www.congress.gov/bill/118th-congress/house-bill/5551"
    }
  );
});

test("parses a textual bill number with an explicit Congress", () => {
  const bill = parseBillInput("S. 686", 118);
  assert.equal(bill.canonicalId, "bill:118:s:686");
});

test("requires Congress for a textual bill number", () => {
  assert.throws(() => parseBillInput("H.R. 5551"), /Congress number is required/);
});

test("rejects unsupported input", () => {
  assert.throws(() => parseBillInput("some bill"), /Congress.gov bill URL/);
});

test("parses joint resolutions", () => {
  assert.equal(parseBillInput("H.J.Res. 12", 118).canonicalId, "bill:118:hjres:12");
  assert.equal(parseBillInput("S.J.Res. 9", 118).canonicalId, "bill:118:sjres:9");
});

test("rejects invalid Congress and bill numbers", () => {
  assert.throws(() => parseBillInput("H.R. 1", 118.5), /positive integer/);
  assert.throws(() => parseBillInput("H.R. 0", 118), /positive integer/);
});
