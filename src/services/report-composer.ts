import type { AnalysisRun, ApplicabilityDecision, Finding, StructuralCheck } from "../domain/types.ts";
import type { BillMap } from "./bill-map.ts";
import type { CitationAudit } from "./citation-verifier.ts";

interface ReportInput {
  bill: {
    id: string;
    title: string;
    congress: number;
    billType: string;
    billNumber: number;
    canonicalUrl: string;
    introducedDate?: unknown;
    originChamber?: unknown;
    policyArea?: unknown;
    latestAction?: any;
  };
  selectedVersion: { code: string; name: string; date: string };
  summary: { text: string; actionDate?: unknown; actionDesc?: unknown } | null;
  ingestedAt: string;
  scope: { status: string; selectedLabel?: string | null };
  billMap: BillMap;
  structuralChecklist: StructuralCheck[];
  critique: {
    gate: string;
    applicability: Array<ApplicabilityDecision & { label?: string }>;
    lenses: Array<{ id: string; status: string; findings: Finding[] }>;
    crossCuttingFindings: Finding[];
    analysisRun: AnalysisRun;
    citationAudit: CitationAudit;
    limitations: string[];
  };
}

const LENS_LABELS: Record<string, string> = {
  responsiveness_and_evidence: "Responsiveness and evidence",
  implementation_and_state_capacity: "Implementation and state capacity",
  economic_and_administrative_efficiency: "Economic and administrative efficiency",
  distribution_equity_and_rights: "Distribution, equity and rights",
  abundance_and_supply_capacity: "Abundance and supply capacity"
};

const MAP_LABELS: Record<keyof BillMap, string> = {
  statedPurpose: "Purpose / findings",
  coveredEntities: "Covered entities / beneficiaries",
  implementingAgencies: "Implementing agencies",
  policyInstruments: "Policy instruments",
  deadlines: "Deadlines",
  funding: "Funding / appropriations",
  enforcement: "Enforcement / remedies",
  reportingAndEvaluation: "Reporting / evaluation",
  definitions: "Definitions",
  amendmentsAndCrossReferences: "Amendments / cross-references"
};

function table(value: unknown) {
  const text = value === null || value === undefined || value === "" ? "Not available" : String(value);
  return text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function findingMarkdown(finding: Finding) {
  const lines = [
    `### ${finding.claim}`,
    "",
    `- **Assessment:** ${finding.assessment}`,
    `- **Claim type:** ${finding.claimType}`,
    `- **Confidence:** ${finding.confidence}`,
    `- **Reasoning:** ${finding.reasoning}`,
    `- **Good-faith counterargument:** ${finding.counterargument}`,
    `- **Evidence gap:** ${finding.evidenceGap || "None recorded."}`
  ];
  if (finding.billCitations.length) {
    lines.push("", "**Verified bill evidence:**", "");
    for (const citation of finding.billCitations) {
      lines.push(`- [${citation.locator}](${citation.sourceUrl}) — snapshot \`${citation.sourceSnapshotId}\`, characters ${citation.charStart}–${citation.charEnd}`);
      lines.push(`  > ${citation.quote.replace(/\n/g, " ")}`);
    }
  }
  return lines.join("\n");
}

export function composeMarkdownReport(input: ReportInput) {
  const { bill, selectedVersion, critique } = input;
  const lines = [
    `# ${bill.title}`,
    "",
    `> Policy research aid for ${bill.id}, text version ${selectedVersion.code.toUpperCase()}${input.scope.selectedLabel ? `, scoped to ${input.scope.selectedLabel}` : ""}. This is not legal advice. The measure is analyzed as proposed text, not current law.`,
    "",
    "## Report identity",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Bill | [${bill.billType.toUpperCase()} ${bill.billNumber}](${bill.canonicalUrl}) |`,
    `| Congress | ${bill.congress} |`,
    `| Text version | ${table(selectedVersion.code.toUpperCase())} — ${table(selectedVersion.name)} |`,
    `| Analysis scope | ${table(input.scope.selectedLabel ?? (input.scope.status === "required" ? "Scope required before critique" : "Whole bill"))} |`,
    `| Version date | ${table(selectedVersion.date?.slice(0, 10))} |`,
    `| Introduced | ${table(bill.introducedDate)} |`,
    `| Origin chamber | ${table(bill.originChamber)} |`,
    `| Policy area | ${table(bill.policyArea)} |`,
    `| Latest action | ${table(bill.latestAction?.text)} |`,
    `| Analysis run | \`${critique.analysisRun.analysisRunId}\` |`,
    `| Generated | ${critique.analysisRun.generatedAt} |`,
    "",
    "## Citation audit",
    "",
    `**${critique.citationAudit.status.toUpperCase()}** — ${critique.citationAudit.verifiedBillCitations}/${critique.citationAudit.totalBillCitations} bill citations verified; ${critique.citationAudit.textualFactsWithCitations}/${critique.citationAudit.textualFacts} textual facts have citations.`,
    "",
    "## Bill map",
    ""
  ];
  for (const [key, label] of Object.entries(MAP_LABELS) as Array<[keyof BillMap, string]>) {
    const evidence = input.billMap[key];
    lines.push(`### ${label}`, "");
    if (!evidence.length) lines.push("Unknown — no explicit signal detected in the parsed bill map.", "");
    else for (const item of evidence.slice(0, 4)) lines.push(`- **${item.citation}:** ${item.excerpt}`);
    if (evidence.length) lines.push("");
  }
  lines.push("## CRS summary", "");
  if (input.summary?.text) {
    lines.push(input.summary.text, "", `Summary context: ${table(input.summary.actionDesc)}; action date: ${table(input.summary.actionDate)}.`, "");
  } else {
    lines.push("Congress.gov did not provide a CRS summary matching the selected text version.", "");
  }
  lines.push("## Structural checklist", "", "| Component | Status | Rationale |", "|---|---|---|");
  for (const item of input.structuralChecklist) lines.push(`| ${table(item.label)} | ${table(item.status)} | ${table(item.rationale)} |`);
  lines.push("", "## Applicability", "", "| Dimension | Status | Rationale |", "|---|---|---|");
  for (const item of critique.applicability) lines.push(`| ${table(item.label ?? item.dimension)} | ${table(item.status)} | ${table(item.rationale)} |`);
  lines.push("");
  for (const lens of critique.lenses) {
    lines.push(`## ${LENS_LABELS[lens.id] ?? lens.id}`, "", `Applicability: **${lens.status}**`, "");
    if (!lens.findings.length) lines.push("No publishable finding was generated for this lens.", "");
    else for (const finding of lens.findings) lines.push(findingMarkdown(finding), "");
  }
  lines.push("## Cross-cutting risks", "");
  if (!critique.crossCuttingFindings.length) lines.push("No publishable cross-cutting finding was generated.", "");
  else for (const finding of critique.crossCuttingFindings) lines.push(findingMarkdown(finding), "");
  lines.push("## Sources and limitations", "", `- Selected bill-text snapshot: \`${critique.analysisRun.sourceSnapshotIds[0]}\``);
  for (const limitation of critique.limitations) lines.push(`- ${limitation}`);
  lines.push("", "## Reproducibility", "", `- Rubric version: \`${critique.analysisRun.rubricVersion}\``, `- Prompt version: \`${critique.analysisRun.promptVersion}\``, `- Engine: \`${critique.analysisRun.modelId}\``, `- Ingested: ${input.ingestedAt}`, "");
  const filename = `${bill.billType}${bill.billNumber}-${bill.congress}-${selectedVersion.code}-critique.md`;
  return { filename, mediaType: "text/markdown; charset=utf-8", markdown: `${lines.join("\n").trim()}\n` };
}
