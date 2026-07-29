import test from "node:test";
import assert from "node:assert/strict";
import { parseUslmBill } from "../src/domain/uslm-parser.ts";
import { normalizeSourceText } from "../src/storage/snapshot-store.ts";
import { buildStructuralChecklist, extractBillMap } from "../src/services/bill-map.ts";
import { parseBillInput } from "../src/domain/bill-id.ts";

const xml = `<?xml version="1.0"?>
<bill><form><official-title>To create a demonstration program.</official-title></form><legis-body>
<section><enum>1.</enum><header>Short title</header><text>This Act may be cited as the Example Act.</text></section>
<section><enum>2.</enum><header>Purpose</header><text>The purpose of this Act is to improve access for eligible households.</text></section>
<section><enum>3.</enum><header>Demonstration program</header>
  <subsection><enum>(a)</enum><header>Definitions</header><paragraph><enum>(1)</enum><header>Secretary</header><text>The term Secretary means the Secretary of Energy.</text></paragraph></subsection>
  <subsection><enum>(b)</enum><header>Rule</header><text>Not later than 180 days after enactment, the Secretary shall promulgate a final rule.</text></subsection>
  <subsection><enum>(c)</enum><header>Amendment</header><text>Section 10 of the Example Act is amended by adding at the end the following:</text><quoted-block><section><enum>11.</enum><header>Report</header><text>The Secretary shall submit an annual report.</text></section></quoted-block></subsection>
</section></legis-body></bill>`;

test("parses USLM hierarchy, citations, offsets, and quoted amendatory text", () => {
  const normalizedText = normalizeSourceText(xml, "application/xml");
  const result = parseUslmBill({
    xml,
    normalizedText,
    identity: parseBillInput("H.R. 10", 118),
    versionCode: "ih",
    sourceSnapshotId: "sha256:test"
  });
  assert.equal(result.nodes.length, 8);
  assert.equal(result.warnings.length, 0);
  const definition = result.nodes.find((node) => node.nodeType === "paragraph" && node.classifications.includes("definition"));
  assert.equal(definition?.citation, "Sec. 3 (a) (1)");
  assert.equal(normalizedText.slice(definition!.charStart, definition!.charEnd), definition!.text);
  const amendment = result.nodes.find((node) => node.classifications.includes("amendatory_instruction"));
  assert.equal(amendment?.citation, "Sec. 3 (c)");
  const quoted = result.nodes.find((node) => node.classifications.includes("quoted_statutory_text"));
  assert.equal(quoted?.citation, "Sec. 3 (c) Sec. 11");
});

test("creates a conservative evidence-backed bill map and checklist", () => {
  const normalizedText = normalizeSourceText(xml, "application/xml");
  const { nodes } = parseUslmBill({
    xml,
    normalizedText,
    identity: parseBillInput("H.R. 10", 118),
    versionCode: "ih",
    sourceSnapshotId: "sha256:test"
  });
  const map = extractBillMap(nodes);
  assert.ok(map.statedPurpose.length > 0);
  assert.ok(map.implementingAgencies.length > 0);
  assert.ok(map.deadlines.length > 0);
  assert.ok(map.definitions.length > 0);
  assert.ok(map.amendmentsAndCrossReferences.length > 0);
  const checklist = buildStructuralChecklist(map);
  assert.equal(checklist.find((item) => item.key === "definitions")?.status, "Present");
  assert.equal(checklist.find((item) => item.key === "funding")?.status, "Unknown");
  assert.match(checklist.find((item) => item.key === "funding")!.rationale, /human legal-policy review/);
});
