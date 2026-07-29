import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface EvaluationCase {
  id: string;
  partition: string;
  billId: string;
  congress: number;
  billType: string;
  billNumber: number;
  versionCode: string;
  sizeClass: string;
}

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
function argument(name: string, fallback: string) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? resolve(args[index + 1]) : resolve(fallback);
}
const responsesDir = argument("--responses", resolve(root, ".data/evaluation-responses"));
const outputDir = argument("--output", resolve(root, ".data/evaluation-results"));
const registry = JSON.parse(await readFile(resolve(root, "evaluation/cases.json"), "utf8"));

function responseFilename(item: EvaluationCase) {
  return `${item.billType}${item.billNumber}-${item.versionCode}.json`;
}

const baseUrlIndex = args.indexOf("--base-url");
const baseUrl = baseUrlIndex >= 0 && args[baseUrlIndex + 1] ? args[baseUrlIndex + 1].replace(/\/$/, "") : null;
if (baseUrl) {
  await mkdir(responsesDir, { recursive: true });
  const billLabels: Record<string, string> = { hr: "H.R.", s: "S.", hjres: "H.J.Res.", sjres: "S.J.Res." };
  for (const item of registry.cases as EvaluationCase[]) {
    const started = performance.now();
    const response = await fetch(`${baseUrl}/api/bills/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: `${billLabels[item.billType] ?? item.billType} ${item.billNumber}`,
        congress: item.congress,
        versionCode: item.versionCode
      })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`${item.id} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
    await writeFile(
      resolve(responsesDir, responseFilename(item)),
      `${JSON.stringify({ durationMs: performance.now() - started, response: body })}\n`,
      "utf8"
    );
  }
}

function ratio(numerator: number, denominator: number) {
  return { numerator, denominator, rate: denominator ? numerator / denominator : null };
}

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

function containsForbiddenPoliticalKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsForbiddenPoliticalKey);
  return Object.entries(value).some(([key, child]) => /sponsor|party/i.test(key) || containsForbiddenPoliticalKey(child));
}

const caseResults: any[] = [];
for (const item of registry.cases as EvaluationCase[]) {
  const path = resolve(responsesDir, responseFilename(item));
  try {
    const stored = JSON.parse(await readFile(path, "utf8"));
    const response = stored.response ?? stored;
    const durationMs = typeof stored.durationMs === "number" ? stored.durationMs : null;
    const findings = response.critique?.analysisRun?.findings ?? [];
    const audit = response.critique?.citationAudit;
    const identityCorrect = response.bill?.id === item.billId && response.selectedVersion?.code === item.versionCode;
    const textSource = response.sources?.billText;
    const sourceIntegrity = Boolean(
      textSource?.id?.startsWith("sha256:") &&
      textSource?.sha256 &&
      textSource.id === `sha256:${textSource.sha256}` &&
      response.selectedVersion?.selectedFormat?.url === textSource.sourceUrl
    );
    const textualFacts = findings.filter((finding: any) => finding.claimType === "textual_fact");
    const citedTextualFacts = textualFacts.filter((finding: any) => finding.billCitations?.length > 0);
    const empiricalWithoutExternal = findings.filter((finding: any) => finding.claimType === "empirical_claim" && !finding.externalCitations?.length);
    const expectedScopedOutcome = item.sizeClass === "oversized";
    const scopeGateCorrect = expectedScopedOutcome
      ? response.scope?.status === "required" && findings.length === 0
      : response.scope?.status !== "required";
    const completed = !expectedScopedOutcome && findings.length > 0 && audit?.status === "passed";
    const degraded = expectedScopedOutcome && scopeGateCorrect;
    const issues: string[] = [];
    if (!identityCorrect) issues.push("wrong bill or version identity");
    if (!sourceIntegrity) issues.push("source integrity check failed");
    if (audit?.status !== "passed") issues.push("citation audit failed");
    if (audit?.failedBillCitations) issues.push(`${audit.failedBillCitations} invalid bill citation(s)`);
    if (citedTextualFacts.length !== textualFacts.length) issues.push("textual fact without bill citation");
    if (empiricalWithoutExternal.length) issues.push("empirical claim without external evidence");
    if (containsForbiddenPoliticalKey(response.critique)) issues.push("sponsor or party metadata leaked into critique output");
    if (!scopeGateCorrect) issues.push(expectedScopedOutcome ? "oversized bill was not scope-gated" : "normal bill was incorrectly scope-gated");
    caseResults.push({
      caseId: item.id,
      partition: item.partition,
      outcome: completed ? "complete" : degraded ? "degraded_expected" : "failed",
      identityCorrect,
      sourceIntegrity,
      scopeStatus: response.scope?.status ?? null,
      nodeCount: response.structure?.nodeCount ?? 0,
      parserWarnings: response.structure?.warnings?.length ?? 0,
      findingCount: findings.length,
      citationAudit: audit ?? null,
      textualFacts: textualFacts.length,
      citedTextualFacts: citedTextualFacts.length,
      durationMs,
      issues
    });
  } catch (error) {
    caseResults.push({
      caseId: item.id,
      partition: item.partition,
      outcome: "failed",
      issues: [error instanceof Error ? error.message : "response could not be read"]
    });
  }
}

const successful = caseResults.filter((item) => item.outcome !== "failed");
const complete = caseResults.filter((item) => item.outcome === "complete");
const degraded = caseResults.filter((item) => item.outcome === "degraded_expected");
const durations = caseResults.map((item) => item.durationMs).filter((value): value is number => typeof value === "number");
const totalCitations = caseResults.reduce((sum, item) => sum + (item.citationAudit?.totalBillCitations ?? 0), 0);
const verifiedCitations = caseResults.reduce((sum, item) => sum + (item.citationAudit?.verifiedBillCitations ?? 0), 0);
const totalFacts = caseResults.reduce((sum, item) => sum + (item.textualFacts ?? 0), 0);
const citedFacts = caseResults.reduce((sum, item) => sum + (item.citedTextualFacts ?? 0), 0);
const automatedBlockers = caseResults.flatMap((item) => item.issues.map((issue: string) => `${item.caseId}: ${issue}`));
const results = {
  schemaVersion: "0.1.0",
  generatedAt: new Date().toISOString(),
  frozenVersions: {
    rubric: "0.1.0",
    parser: "uslm-hierarchy@0.1.0",
    prompt: "day4-deterministic-evidence@0.1.0",
    scopeGatePrompt: "day6-scope-gate@0.1.0",
    engine: "deterministic-evidence-engine@0.1.0"
  },
  metrics: {
    M1_inputResolution: ratio(caseResults.filter((item) => item.identityCorrect).length, caseResults.length),
    M2_sourceIntegrity: ratio(caseResults.filter((item) => item.sourceIntegrity).length, caseResults.length),
    M3_citationQuoteValidity: ratio(verifiedCitations, totalCitations),
    M4_locatorAccuracy: { status: "human_review_required", target: 0.95 },
    M5_textualFactCitationCoverage: ratio(citedFacts, totalFacts),
    M6_structuralRecall: { status: "gold_annotations_required", target: 0.85 },
    M7_structuralPrecision: { status: "human_review_required", target: 0.9 },
    M8_unsupportedMaterialClaimRate: { status: "human_review_required", targetMaximum: 0.05 },
    M9_endToEnd: { complete: complete.length, expectedDegraded: degraded.length, successful: successful.length, total: caseResults.length },
    M10_latencyMs: { samples: durations.length, p50: percentile(durations, 0.5), p95: percentile(durations, 0.95) }
  },
  automatedBlockers,
  decision: automatedBlockers.length ? "no_go" : "conditional_go_pending_human_review",
  cases: caseResults
};

const markdown = [
  "# Day 6 Automated Evaluation",
  "",
  `Generated: ${results.generatedAt}`,
  "",
  `Decision: **${results.decision.replaceAll("_", " ").toUpperCase()}**`,
  "",
  "## Automated metrics",
  "",
  "| Metric | Result |",
  "|---|---|",
  `| M1 input resolution | ${results.metrics.M1_inputResolution.numerator}/${results.metrics.M1_inputResolution.denominator} |`,
  `| M2 source integrity | ${results.metrics.M2_sourceIntegrity.numerator}/${results.metrics.M2_sourceIntegrity.denominator} |`,
  `| M3 citation validity | ${results.metrics.M3_citationQuoteValidity.numerator}/${results.metrics.M3_citationQuoteValidity.denominator} |`,
  `| M5 textual-fact citation coverage | ${results.metrics.M5_textualFactCitationCoverage.numerator}/${results.metrics.M5_textualFactCitationCoverage.denominator} |`,
  `| M9 end to end | ${complete.length} complete + ${degraded.length} expected degraded / ${caseResults.length} |`,
  `| M10 latency | P50 ${results.metrics.M10_latencyMs.p50 ?? "not recorded"} ms; P95 ${results.metrics.M10_latencyMs.p95 ?? "not recorded"} ms |`,
  "",
  "## Cases",
  "",
  "| Case | Partition | Outcome | Nodes | Findings | Citations | Warnings |",
  "|---|---|---|---:|---:|---:|---:|",
  ...caseResults.map((item) => `| ${item.caseId} | ${item.partition} | ${item.outcome} | ${item.nodeCount ?? 0} | ${item.findingCount ?? 0} | ${item.citationAudit ? `${item.citationAudit.verifiedBillCitations}/${item.citationAudit.totalBillCitations}` : "—"} | ${item.parserWarnings ?? 0} |`),
  "",
  "## Human-review gates",
  "",
  "M4 locator accuracy, M6 structural recall, M7 structural precision, M8 unsupported-claim review, and usefulness/balance scoring cannot be honestly automated. They remain required before an unconditional Go decision.",
  ""
].join("\n");

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDir, "day6-results.json"), `${JSON.stringify(results, null, 2)}\n`, "utf8"),
  writeFile(resolve(outputDir, "day6-report.md"), markdown, "utf8")
]);
console.log(`Evaluated ${caseResults.length} cases: ${complete.length} complete, ${degraded.length} expected degraded, ${automatedBlockers.length} automated blocker(s).`);
console.log(`Results written to ${outputDir}`);
