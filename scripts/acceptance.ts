import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
function value(name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
const baseUrl = value("--base-url")?.replace(/\/$/, "");
const responsesDir = value("--responses") ? resolve(value("--responses")!) : undefined;
if (!baseUrl && !responsesDir) throw new Error("Provide --base-url http://127.0.0.1:3000 or --responses <directory>.");

async function stored(name: string) {
  const parsed = JSON.parse(await readFile(resolve(responsesDir!, `${name}.json`), "utf8"));
  return parsed.response ?? parsed;
}

async function ingest(input: string, versionCode: string, scopeNodeId?: string) {
  const response = await fetch(`${baseUrl}/api/bills/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, congress: 118, versionCode, ...(scopeNodeId ? { scopeNodeId } : {}) })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${input} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Acceptance failed: ${message}`);
}

function validatePublished(response: any, expectedId: string, versionCode: string) {
  assert(response.bill?.id === expectedId, `${expectedId} identity mismatch`);
  assert(response.selectedVersion?.code === versionCode, `${expectedId} version mismatch`);
  assert(response.critique?.analysisRun?.findings?.length > 0, `${expectedId} produced no findings`);
  assert(response.critique?.citationAudit?.status === "passed", `${expectedId} citation audit failed`);
  assert(response.critique.citationAudit.failedBillCitations === 0, `${expectedId} has invalid citations`);
  assert(response.report?.markdown?.includes("not legal advice"), `${expectedId} report lacks disclaimer`);
  assert(response.report?.markdown?.includes("## CRS summary"), `${expectedId} report lacks CRS section`);
  assert(!response.critique.analysisRun.findings.some((finding: any) => /\b(enacted law|current law requires)\b/i.test(finding.claim)), `${expectedId} misstates proposal status`);
}

const hr5551 = baseUrl ? await ingest("H.R. 5551", "ih") : await stored("hr5551-ih");
const hr5378 = baseUrl ? await ingest("H.R. 5378", "ih") : await stored("hr5378-ih");
const hr1 = baseUrl ? await ingest("H.R. 1", "ih") : await stored("hr1-ih");
validatePublished(hr5551, "bill:118:hr:5551", "ih");
validatePublished(hr5378, "bill:118:hr:5378", "ih");
assert(hr5551.summary === null, "H.R. 5551 should demonstrate missing-summary behavior");
assert(hr5378.summary?.text, "H.R. 5378 should demonstrate a version-matched CRS summary");
assert(hr5378.report.markdown.includes(hr5378.summary.text.slice(0, 80)), "H.R. 5378 Markdown omits its CRS summary");
assert(hr1.scope?.status === "required", "H.R. 1 whole-bill run should require scope");
assert(hr1.critique?.analysisRun?.findings?.length === 0, "H.R. 1 whole-bill run should publish no findings");
assert(hr1.scope.options.length >= 2, "H.R. 1 should expose multiple scope options");
const selectedScopeId = hr1.scope.options[0].nodeId;
const scopedHr1 = baseUrl ? await ingest("H.R. 1", "ih", selectedScopeId) : await stored("hr1-ih-scope");
validatePublished(scopedHr1, "bill:118:hr:1", "ih");
assert(scopedHr1.scope?.status === "selected", "H.R. 1 scoped run did not preserve scope status");
assert(scopedHr1.scope?.selectedNodeId === selectedScopeId, "H.R. 1 selected scope changed between requests");
assert(scopedHr1.report.markdown.includes(scopedHr1.scope.selectedLabel), "H.R. 1 Markdown does not disclose selected scope");

console.log("Day 7 controlled-demo acceptance passed.");
console.log(`H.R. 5551: ${hr5551.critique.analysisRun.findings.length} findings, ${hr5551.critique.citationAudit.verifiedBillCitations} verified citations, missing-summary behavior.`);
console.log(`H.R. 5378: ${hr5378.critique.analysisRun.findings.length} findings, ${hr5378.critique.citationAudit.verifiedBillCitations} verified citations, CRS summary present.`);
console.log(`H.R. 1: whole-bill scope gate plus ${scopedHr1.critique.analysisRun.findings.length} scoped findings and ${scopedHr1.critique.citationAudit.verifiedBillCitations} verified citations.`);
