import test from "node:test";
import assert from "node:assert/strict";
import { parseBillInput } from "../src/domain/bill-id.ts";
import { parseUslmBill } from "../src/domain/uslm-parser.ts";
import { normalizeSourceText } from "../src/storage/snapshot-store.ts";
import { extractBillMap } from "../src/services/bill-map.ts";
import { generateCritique, generateScopeRequiredCritique } from "../src/services/critique-engine.ts";

const xml = `<bill><legis-body>
<division><enum>A</enum><header>Energy</header><section><enum>101.</enum><header>Purpose</header><text>The purpose is to increase energy supply.</text></section><section><enum>102.</enum><text>The Commission shall issue a final rule.</text></section></division>
<division><enum>B</enum><header>Water</header><section><enum>201.</enum><text>The Secretary shall establish a water program.</text></section></division>
</legis-body></bill>`;

function parsedInput() {
  const identity = parseBillInput("H.R. 1", 118);
  const normalizedText = normalizeSourceText(xml, "application/xml");
  const sourceSnapshotId = "sha256:scope";
  const sourceUrl = "https://www.congress.gov/bill/118th-congress/house-bill/1/text/ih";
  const { nodes } = parseUslmBill({ xml, normalizedText, identity, versionCode: "ih", sourceSnapshotId });
  return { identity, normalizedText, sourceSnapshotId, sourceUrl, nodes };
}

test("withholds whole-bill critique for multiple top-level divisions", () => {
  const data = parsedInput();
  const divisions = data.nodes.filter((node) => node.nodeType === "division" && node.depth === 0);
  const input = {
    billId: data.identity.canonicalId,
    versionCode: "ih",
    title: "Omnibus Act",
    policyArea: "Energy",
    subjects: [],
    nodes: data.nodes,
    billMap: extractBillMap(data.nodes),
    normalizedText: data.normalizedText,
    sourceSnapshotId: data.sourceSnapshotId,
    sourceUrl: data.sourceUrl
  };
  const critique = generateScopeRequiredCritique(input, divisions.map((node) => ({ nodeId: node.nodeId, citation: node.citation, heading: node.heading! })));
  assert.equal(critique.gate, "scope_required");
  assert.equal(critique.analysisRun.findings.length, 0);
  assert.equal(critique.scopeOptions.length, 2);
  assert.equal(critique.citationAudit.status, "passed");
});

test("a selected division can be critiqued independently", () => {
  const data = parsedInput();
  const firstDivision = data.nodes.find((node) => node.nodeType === "division")!;
  const allowed = new Set([firstDivision.nodeId]);
  for (const node of data.nodes) if (node.parentId && allowed.has(node.parentId)) allowed.add(node.nodeId);
  const nodes = data.nodes.filter((node) => allowed.has(node.nodeId));
  const critique = generateCritique({
    billId: data.identity.canonicalId,
    versionCode: "ih",
    title: "Energy division",
    policyArea: "Energy",
    subjects: [],
    nodes,
    billMap: extractBillMap(nodes),
    normalizedText: data.normalizedText,
    sourceSnapshotId: data.sourceSnapshotId,
    sourceUrl: data.sourceUrl
  });
  assert.equal(critique.gate, "open");
  assert.ok(critique.analysisRun.findings.length > 0);
  assert.equal(critique.citationAudit.failedBillCitations, 0);
});
