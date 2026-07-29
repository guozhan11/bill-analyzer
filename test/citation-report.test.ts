import test from "node:test";
import assert from "node:assert/strict";
import { parseBillInput } from "../src/domain/bill-id.ts";
import { parseUslmBill } from "../src/domain/uslm-parser.ts";
import { normalizeSourceText } from "../src/storage/snapshot-store.ts";
import { buildStructuralChecklist, extractBillMap } from "../src/services/bill-map.ts";
import { auditAnalysisRun, verifyBillCitation } from "../src/services/citation-verifier.ts";
import { generateCritique } from "../src/services/critique-engine.ts";
import { composeMarkdownReport } from "../src/services/report-composer.ts";

function fixture() {
  const xml = `<bill><legis-body><section><enum>1.</enum><header>Purpose</header><text>The purpose is to increase electric grid capacity.</text></section><section><enum>2.</enum><header>Rule</header><text>Not later than 1 year after enactment, the Commission shall issue a final rule.</text></section></legis-body></bill>`;
  const identity = parseBillInput("H.R. 99", 118);
  const normalizedText = normalizeSourceText(xml, "application/xml");
  const sourceSnapshotId = "sha256:test";
  const sourceUrl = "https://www.congress.gov/bill/118th-congress/house-bill/99/text/ih";
  const { nodes } = parseUslmBill({ xml, normalizedText, identity, versionCode: "ih", sourceSnapshotId });
  const billMap = extractBillMap(nodes);
  const critique = generateCritique({
    billId: identity.canonicalId,
    versionCode: "ih",
    title: "Grid Capacity Act",
    policyArea: "Energy",
    subjects: ["Electric power generation and transmission"],
    nodes,
    billMap,
    normalizedText,
    sourceSnapshotId,
    sourceUrl
  });
  return { identity, normalizedText, sourceSnapshotId, sourceUrl, nodes, billMap, critique };
}

test("citation audit rejects a tampered quote and accepts the generated run", () => {
  const data = fixture();
  const context = {
    normalizedText: data.normalizedText,
    sourceSnapshotId: data.sourceSnapshotId,
    sourceUrl: data.sourceUrl,
    nodes: data.nodes
  };
  const audit = auditAnalysisRun(data.critique.analysisRun, context);
  assert.equal(audit.status, "passed");
  assert.equal(audit.failedBillCitations, 0);
  const citation = structuredClone(data.critique.analysisRun.findings.flatMap((finding) => finding.billCitations)[0]);
  citation.quote = `${citation.quote} tampered`;
  assert.match(verifyBillCitation(citation, context).join(" "), /exact contiguous snapshot match/);
});

test("composes a reproducible Markdown report after the citation gate", () => {
  const data = fixture();
  const report = composeMarkdownReport({
    bill: {
      id: data.identity.canonicalId,
      title: "Grid Capacity Act",
      congress: 118,
      billType: "hr",
      billNumber: 99,
      canonicalUrl: data.identity.canonicalUrl,
      introducedDate: "2023-01-01",
      originChamber: "House",
      policyArea: "Energy",
      latestAction: { text: "Introduced" }
    },
    selectedVersion: { code: "ih", name: "Introduced in House", date: "2023-01-01" },
    summary: { text: "The bill directs the Commission to issue a grid rule.", actionDesc: "Introduced in House", actionDate: "2023-01-01" },
    ingestedAt: "2026-07-29T00:00:00Z",
    scope: { status: "whole_bill", selectedLabel: null },
    billMap: data.billMap,
    structuralChecklist: buildStructuralChecklist(data.billMap),
    critique: data.critique
  });
  assert.equal(report.filename, "hr99-118-ih-critique.md");
  assert.match(report.markdown, /# Grid Capacity Act/);
  assert.match(report.markdown, /Citation audit/);
  assert.match(report.markdown, /CRS summary/);
  assert.match(report.markdown, /directs the Commission/);
  assert.match(report.markdown, /PASSED/);
  assert.match(report.markdown, /Good-faith counterargument/);
  assert.match(report.markdown, /Reproducibility/);
  assert.doesNotMatch(report.markdown, /sponsor/i);
});
