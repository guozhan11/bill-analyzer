import type { BillMapEvidence, LegalNode, StructuralCheck } from "../domain/types.ts";

export interface BillMap {
  statedPurpose: BillMapEvidence[];
  coveredEntities: BillMapEvidence[];
  implementingAgencies: BillMapEvidence[];
  policyInstruments: BillMapEvidence[];
  deadlines: BillMapEvidence[];
  funding: BillMapEvidence[];
  enforcement: BillMapEvidence[];
  reportingAndEvaluation: BillMapEvidence[];
  definitions: BillMapEvidence[];
  amendmentsAndCrossReferences: BillMapEvidence[];
}

const SIGNALS: Record<keyof BillMap, RegExp> = {
  statedPurpose: /\b(purpose|purposes|findings|sense of congress|congress finds|in order to)\b/i,
  coveredEntities: /\b(eligible|beneficiar(?:y|ies)|applicant|recipient|covered entit|each (?:state|agency|person|provider|region)|small business|household|consumer|worker|tribe|tribal)\b/i,
  implementingAgencies: /\b(secretary|administrator|commission|department of|agency|director|comptroller general)\b/i,
  policyInstruments: /\b(grant|loan|tax credit|credit against|shall promulgate|final rule|regulation|standard|requirement|prohibit|program|pilot program|permit|held in trust|transfer(?:red)? (?:to|of)|declared to be part)\b/i,
  deadlines: /\b(not later than|within \d+|effective (?:on|date)|date of enactment|deadline|years? after|days? after|months? after)\b/i,
  funding: /\b(authoriz(?:e|ed) to be appropriated|appropriation|\$[0-9]|funding|amounts? as may be necessary|fiscal year)\b/i,
  enforcement: /\b(penalt|violation|enforce|judicial review|civil action|liable|remed(?:y|ies)|compliance)\b/i,
  reportingAndEvaluation: /\b(report|study|evaluation|audit|assessment|performance measure|monitoring)\b/i,
  definitions: /\bdefinitions?\b|\bthe term\b[\s\S]{0,160}\bmeans\b/i,
  amendmentsAndCrossReferences: /\b(is|are) amended\b|\bU\.S\.C\.\b|\bsection \d+[a-z]?(?:\([a-z0-9]+\))? of\b|\bstrike\b[\s\S]{0,80}\binsert\b/i
};

function evidence(node: LegalNode): BillMapEvidence {
  return {
    nodeId: node.nodeId,
    citation: node.citation,
    excerpt: node.text.length > 320 ? `${node.text.slice(0, 317)}…` : node.text,
    charStart: node.charStart,
    charEnd: node.charEnd
  };
}

function select(nodes: LegalNode[], pattern: RegExp, limit = 6) {
  const selected: BillMapEvidence[] = [];
  const citations = new Set<string>();
  const ordered = [...nodes].sort((a, b) => b.depth - a.depth || a.ordinal - b.ordinal);
  for (const node of ordered) {
    const haystack = `${node.heading ?? ""} ${node.text}`;
    if (!pattern.test(haystack) || citations.has(node.citation)) continue;
    citations.add(node.citation);
    selected.push(evidence(node));
    if (selected.length >= limit) break;
  }
  return selected.sort((a, b) => a.charStart - b.charStart);
}

export function extractBillMap(nodes: LegalNode[]): BillMap {
  return Object.fromEntries(Object.entries(SIGNALS).map(([key, pattern]) => [key, select(nodes, pattern)])) as unknown as BillMap;
}

const CHECKS: Array<{ key: keyof BillMap; label: string; rationale: string }> = [
  { key: "statedPurpose", label: "Purpose and problem statement", rationale: "Purpose, findings, or an equivalent problem statement was detected." },
  { key: "definitions", label: "Definitions and scope", rationale: "Defined terms or a definitions provision was detected." },
  { key: "implementingAgencies", label: "Authority and responsibility", rationale: "An implementing official, commission, department, or agency was detected." },
  { key: "policyInstruments", label: "Operative policy mechanism", rationale: "A rule, program, requirement, prohibition, grant, or comparable instrument was detected." },
  { key: "funding", label: "Funding and resources", rationale: "An appropriation, authorization, fiscal-year amount, or funding provision was detected." },
  { key: "deadlines", label: "Timeline and transition", rationale: "An effective date, deadline, or implementation interval was detected." },
  { key: "enforcement", label: "Enforcement, review, or remedies", rationale: "An enforcement, compliance, penalty, review, or remedy provision was detected." },
  { key: "reportingAndEvaluation", label: "Reporting and evaluation", rationale: "A report, study, audit, assessment, or evaluation requirement was detected." },
  { key: "amendmentsAndCrossReferences", label: "Amendments and legal coherence", rationale: "An amendatory instruction or statutory cross-reference was detected." }
];

export function buildStructuralChecklist(map: BillMap): StructuralCheck[] {
  return CHECKS.map((check) => {
    const found = map[check.key];
    return {
      key: check.key,
      label: check.label,
      status: found.length ? "Present" : "Unknown",
      rationale: found.length
        ? check.rationale
        : "No explicit signal was detected. Applicability and true absence require human legal-policy review.",
      evidence: found.slice(0, 2)
    };
  });
}
