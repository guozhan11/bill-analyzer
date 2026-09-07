import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "PRODUCT_SPEC.md",
  "CRITIQUE_RUBRIC.md",
  "DATA_SOURCES.md",
  "EVALUATION_PLAN.md",
  "KNOWN_LIMITATIONS.md",
  "RELEASE_CHECKLIST.md",
  "schemas/finding.schema.json",
  "schemas/analysis-run.schema.json",
  "schemas/source-snapshot.schema.json",
  "schemas/legal-node.schema.json",
  "fixtures/analysis-run.example.json",
  "evaluation/cases.json",
  "evaluation/frozen-versions.json",
  "evaluation/day6-results.json",
  "docs/DEMO_GUIDE.md",
  "docs/DAY7_REPORT.md",
  "docs/DEPLOYMENT.md",
  "public/config.js",
  "src/worker.ts",
  "wrangler.jsonc",
  ".github/workflows/pages.yml"
];

for (const file of requiredFiles) {
  await stat(resolve(root, file));
}

const schemas = await Promise.all(
  [
    "schemas/finding.schema.json",
    "schemas/analysis-run.schema.json",
    "schemas/source-snapshot.schema.json",
    "schemas/legal-node.schema.json"
  ].map(async (file) =>
    JSON.parse(await readFile(resolve(root, file), "utf8"))
  )
);
for (const schema of schemas) {
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error(`${schema.title ?? schema.$id} is not a JSON Schema 2020-12 contract.`);
  }
}

const exampleRun = JSON.parse(await readFile(resolve(root, "fixtures/analysis-run.example.json"), "utf8"));
if (exampleRun.schemaVersion !== "0.1.0" || exampleRun.findings.length < 1) {
  throw new Error("Analysis run fixture must match the current contract version and include a finding.");
}
if (exampleRun.findings.some((finding: { billCitations: Array<{ verified: boolean }> }) =>
  finding.billCitations.some((citation) => citation.verified))) {
  throw new Error("Synthetic fixture citations must never be marked verified.");
}

const cases = JSON.parse(await readFile(resolve(root, "evaluation/cases.json"), "utf8"));
if (cases.schemaVersion !== "0.1.0" || cases.cases.length !== 10) {
  throw new Error("Evaluation registry must contain exactly ten versioned cases.");
}
const ids = new Set(cases.cases.map((item: { id: string }) => item.id));
if (ids.size !== 10) throw new Error("Evaluation case IDs must be unique.");

const partitions = cases.cases.reduce((counts: Record<string, number>, item: { partition: string }) => {
  counts[item.partition] = (counts[item.partition] ?? 0) + 1;
  return counts;
}, {});
if (partitions.development !== 3 || partitions.validation !== 5 || partitions.holdout !== 2) {
  throw new Error("Evaluation registry must contain a 3/5/2 development/validation/holdout split.");
}

const frozen = JSON.parse(await readFile(resolve(root, "evaluation/frozen-versions.json"), "utf8"));
if (frozen.rubricVersion !== "0.1.0" || !frozen.engineVersion || !frozen.promptVersion) {
  throw new Error("Evaluation versions must be explicitly frozen.");
}
const day6 = JSON.parse(await readFile(resolve(root, "evaluation/day6-results.json"), "utf8"));
if (day6.cases.length !== 10 || day6.metrics.M3_citationQuoteValidity.rate !== 1) {
  throw new Error("Day 6 evaluation results must cover ten cases and pass citation validity.");
}

console.log("Repository contract checks passed.");
