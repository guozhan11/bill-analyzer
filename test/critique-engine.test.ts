import test from "node:test";
import assert from "node:assert/strict";
import { parseBillInput } from "../src/domain/bill-id.ts";
import { parseUslmBill } from "../src/domain/uslm-parser.ts";
import { normalizeSourceText } from "../src/storage/snapshot-store.ts";
import { extractBillMap } from "../src/services/bill-map.ts";
import { DEFAULT_LENSES, generateCritique } from "../src/services/critique-engine.ts";

const xml = `<bill><legis-body>
<section><enum>1.</enum><header>Findings</header><text>Congress finds that electric transmission capacity is insufficient.</text></section>
<section><enum>2.</enum><header>Commission rule</header><subsection><enum>(a)</enum><text>Not later than 180 days after enactment, the Federal Energy Regulatory Commission shall promulgate a final rule requiring each transmission region to increase transfer capacity.</text></subsection><subsection><enum>(b)</enum><text>A region that violates the rule is subject to enforcement by the Commission.</text></subsection></section>
</legis-body></bill>`;

function makeInput(title = "Grid Capacity Act", policyArea = "Energy") {
  const identity = parseBillInput("H.R. 20", 118);
  const normalizedText = normalizeSourceText(xml, "application/xml");
  const { nodes } = parseUslmBill({ xml, normalizedText, identity, versionCode: "ih", sourceSnapshotId: "sha256:test" });
  return {
    billId: identity.canonicalId,
    versionCode: "ih",
    title,
    policyArea,
    subjects: ["Electric power generation and transmission"],
    nodes,
    billMap: extractBillMap(nodes),
    normalizedText,
    sourceSnapshotId: "sha256:test",
    sourceUrl: "https://www.congress.gov/bill/118th-congress/house-bill/20/text/ih"
  };
}

test("generates five-lens, evidence-gated findings with exact verified quotes", () => {
  const input = makeInput();
  const critique = generateCritique(input);
  assert.deepEqual(critique.analysisRun.selectedLenses, [...DEFAULT_LENSES]);
  assert.equal(critique.lenses.length, 5);
  assert.ok(critique.analysisRun.findings.length >= 6);
  assert.equal(critique.applicability.find((item) => item.dimension === "abundance_supply_capacity")?.status, "applicable");
  for (const finding of critique.analysisRun.findings) {
    assert.ok(finding.counterargument.length > 0);
    assert.ok(finding.reasoning.length > 0);
    assert.ok(["strength", "risk", "tradeoff", "unknown"].includes(finding.assessment));
    if (finding.claimType === "textual_fact") assert.ok(finding.billCitations.length > 0);
    for (const citation of finding.billCitations) {
      assert.equal(citation.verified, true);
      assert.equal(input.normalizedText.slice(citation.charStart, citation.charEnd), citation.quote);
    }
  }
  const byDimension = Object.groupBy(critique.analysisRun.findings, (finding) => finding.dimension);
  assert.ok(Object.values(byDimension).every((items) => (items?.length ?? 0) <= 3));
});

test("marks abundance not applicable when the bill does not target a supply sector", () => {
  const input = makeInput("Ceremonial Naming Act", "Government Operations");
  input.subjects = ["Commemorations"];
  const critique = generateCritique(input);
  const abundance = critique.lenses.find((lens) => lens.id === "abundance_and_supply_capacity");
  assert.equal(abundance?.status, "not_applicable");
  assert.equal(abundance?.findings.length, 0);
});
