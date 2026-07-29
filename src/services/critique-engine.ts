import { randomUUID } from "node:crypto";
import type {
  AnalysisRun,
  ApplicabilityDecision,
  Assessment,
  Citation,
  ClaimType,
  Confidence,
  Finding,
  LegalNode
} from "../domain/types.ts";
import type { BillMap } from "./bill-map.ts";
import { assertPublishableAnalysis, createBillCitation } from "./citation-verifier.ts";

export const DEFAULT_LENSES = [
  "responsiveness_and_evidence",
  "implementation_and_state_capacity",
  "economic_and_administrative_efficiency",
  "distribution_equity_and_rights",
  "abundance_and_supply_capacity"
] as const;

export interface CritiqueInput {
  billId: string;
  versionCode: string;
  title: string;
  policyArea?: string | null;
  subjects: string[];
  nodes: LegalNode[];
  billMap: BillMap;
  normalizedText: string;
  sourceSnapshotId: string;
  sourceUrl: string;
}

export interface ScopeOption {
  nodeId: string;
  citation: string;
  heading: string;
}

interface FindingDraft {
  dimension: string;
  assessment: Assessment;
  claim: string;
  claimType: ClaimType;
  nodes?: LegalNode[];
  reasoning: string;
  counterargument: string;
  confidence: Confidence;
  evidenceGap: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  policy_responsiveness: "P1 Policy responsiveness and evidence",
  likely_effectiveness: "P2 Likely effectiveness",
  implementation_feasibility: "P3 Implementation feasibility and state capacity",
  economic_efficiency: "P4 Economic and administrative efficiency",
  distribution_equity: "P5 Distribution and social equity",
  rights_due_process: "P6 Rights, due process and bias risk",
  abundance_supply_capacity: "P7 Abundance and supply capacity",
  coherence_durability: "P8 Coherence, externalities and durability"
};

function nodesForEvidence(input: CritiqueInput, key: keyof BillMap): LegalNode[] {
  const ids = new Set(input.billMap[key].map((item) => item.nodeId));
  return input.nodes.filter((node) => ids.has(node.nodeId));
}

function firstNodes(input: CritiqueInput, key: keyof BillMap, count = 2) {
  return nodesForEvidence(input, key).slice(0, count);
}

function citationsFor(input: CritiqueInput, nodes: LegalNode[] = []) {
  const context = {
    normalizedText: input.normalizedText,
    sourceSnapshotId: input.sourceSnapshotId,
    sourceUrl: input.sourceUrl
  };
  return nodes.map((node) => createBillCitation(node, context)).filter((citation): citation is Citation => Boolean(citation));
}

function assertFinding(finding: Finding) {
  const assessments = new Set(["strength", "risk", "tradeoff", "unknown"]);
  const claimTypes = new Set(["textual_fact", "legal_context", "empirical_claim", "causal_inference", "risk_hypothesis", "normative_judgment"]);
  const confidences = new Set(["high", "medium", "low", "unknown"]);
  if (!finding.id || !finding.dimension || !finding.claim || !finding.reasoning || !finding.counterargument) {
    throw new Error("Finding failed schema validation: required text field is missing.");
  }
  if (!assessments.has(finding.assessment) || !claimTypes.has(finding.claimType) || !confidences.has(finding.confidence)) {
    throw new Error("Finding failed schema validation: enum value is invalid.");
  }
  if (!Array.isArray(finding.billCitations) || !Array.isArray(finding.externalCitations)) {
    throw new Error("Finding failed schema validation: citations must be arrays.");
  }
  for (const citation of [...finding.billCitations, ...finding.externalCitations]) {
    if (!citation.sourceSnapshotId || !citation.nodeId || !citation.locator || !citation.quote || !citation.sourceUrl ||
      citation.charStart < 0 || citation.charEnd <= citation.charStart || typeof citation.verified !== "boolean") {
      throw new Error("Finding failed schema validation: citation is incomplete.");
    }
  }
  if (finding.claimType === "textual_fact" && finding.billCitations.length === 0) {
    throw new Error("Finding failed evidence gate: textual facts require a bill citation.");
  }
  if (finding.billCitations.some((citation) => !citation.verified)) {
    throw new Error("Finding failed evidence gate: unverified bill citation.");
  }
}

function makeFinding(input: CritiqueInput, draft: FindingDraft, sequence: number): Finding {
  const finding: Finding = {
    id: `${input.billId}:${input.versionCode}:${draft.dimension}:${String(sequence).padStart(2, "0")}`,
    dimension: draft.dimension,
    assessment: draft.assessment,
    claim: draft.claim,
    claimType: draft.claimType,
    billCitations: citationsFor(input, draft.nodes),
    externalCitations: [],
    reasoning: draft.reasoning,
    counterargument: draft.counterargument,
    confidence: draft.confidence,
    evidenceGap: draft.evidenceGap
  };
  assertFinding(finding);
  return finding;
}

function decision(input: CritiqueInput, dimension: string, status: ApplicabilityDecision["status"], rationale: string, nodes: LegalNode[] = []): ApplicabilityDecision {
  return { dimension, status, rationale, citations: citationsFor(input, nodes).slice(0, 2) };
}

function determineApplicability(input: CritiqueInput): ApplicabilityDecision[] {
  const purpose = firstNodes(input, "statedPurpose");
  const instruments = firstNodes(input, "policyInstruments");
  const implementers = firstNodes(input, "implementingAgencies");
  const distribution = firstNodes(input, "coveredEntities");
  const enforcement = firstNodes(input, "enforcement");
  const amendments = firstNodes(input, "amendmentsAndCrossReferences");
  const topic = `${input.title} ${input.policyArea ?? ""} ${input.subjects.join(" ")}`;
  const abundance = /\b(housing|energy|electric|transport|transmission|infrastructure|health|medical|labor|workforce|construction|broadband|water|supply|manufactur|innovation)\b/i.test(topic);
  return [
    decision(input, "policy_responsiveness", purpose.length || instruments.length ? "applicable" : "unknown", purpose.length ? "The text contains a stated problem or purpose." : "No clear problem statement was found; analysis is limited to operative text.", purpose),
    decision(input, "likely_effectiveness", instruments.length ? "applicable" : "unknown", instruments.length ? "An operative policy instrument was detected." : "No core policy instrument was confidently identified.", instruments),
    decision(input, "implementation_feasibility", implementers.length || instruments.length ? "applicable" : "unknown", implementers.length ? "The text assigns or references an implementing entity." : "Implementation responsibility is not explicit in the detected provisions.", implementers),
    decision(input, "economic_efficiency", instruments.length ? "applicable" : "unknown", instruments.length ? "The detected mechanism can create administrative or compliance effects, but no cost estimate is loaded." : "No mechanism was identified for a responsible cost analysis.", instruments),
    decision(input, "distribution_equity", distribution.length ? "applicable" : "unknown", distribution.length ? "The text identifies eligible, regulated, or benefiting entities." : "The distribution of benefits and burdens is not explicit in the detected text.", distribution),
    decision(input, "rights_due_process", enforcement.length ? "applicable" : "unknown", enforcement.length ? "Enforcement or compliance language makes procedural safeguards relevant." : "No explicit enforcement or adjudication signal establishes applicability.", enforcement),
    decision(input, "abundance_supply_capacity", abundance ? "applicable" : "not_applicable", abundance ? "The bill's topic concerns a sector where physical or service supply capacity is material." : "The bill does not clearly target a supply-constrained sector under the MVP rule.", instruments),
    decision(input, "coherence_durability", amendments.length ? "applicable" : "unknown", amendments.length ? "The bill amends or cross-references other law." : "Full legal context was not loaded, so coherence remains unknown.", amendments)
  ];
}

export function generateScopeRequiredCritique(input: CritiqueInput, scopeOptions: ScopeOption[]) {
  const applicability = Object.entries(DIMENSION_LABELS).map(([dimension, label]) => ({
    dimension,
    label,
    status: "unknown" as const,
    rationale: "Applicability was not assessed because this multi-division bill requires a narrower scope.",
    citations: []
  }));
  const analysisRun: AnalysisRun = {
    schemaVersion: "0.1.0",
    analysisRunId: `run:${randomUUID()}`,
    billId: input.billId,
    versionCode: input.versionCode,
    sourceSnapshotIds: [input.sourceSnapshotId],
    rubricVersion: "0.1.0",
    promptVersion: "day6-scope-gate@0.1.0",
    modelId: "deterministic-evidence-engine@0.1.0",
    generatedAt: new Date().toISOString(),
    selectedLenses: [...DEFAULT_LENSES],
    findings: []
  };
  const citationAudit = assertPublishableAnalysis(analysisRun, {
    normalizedText: input.normalizedText,
    sourceSnapshotId: input.sourceSnapshotId,
    sourceUrl: input.sourceUrl,
    nodes: input.nodes
  });
  return {
    gate: "scope_required",
    scopeOptions,
    applicability,
    lenses: DEFAULT_LENSES.map((id) => ({ id, status: "unknown", dimensions: [], findings: [] })),
    crossCuttingFindings: [],
    analysisRun,
    citationAudit,
    limitations: [
      `This bill contains ${scopeOptions.length} top-level divisions. Whole-bill critique is withheld to avoid false completeness.`,
      "Select one division before generating policy findings.",
      "The full bill structure and source snapshot remain available for scope selection."
    ]
  };
}

export function generateCritique(input: CritiqueInput) {
  const applicability = determineApplicability(input);
  const applicable = new Map(applicability.map((item) => [item.dimension, item.status]));
  const findings: Finding[] = [];
  const add = (draft: FindingDraft) => findings.push(makeFinding(input, draft, findings.filter((item) => item.dimension === draft.dimension).length + 1));
  const purpose = firstNodes(input, "statedPurpose");
  const instruments = firstNodes(input, "policyInstruments");
  const implementers = firstNodes(input, "implementingAgencies");
  const deadlines = firstNodes(input, "deadlines");
  const funding = firstNodes(input, "funding");
  const affected = firstNodes(input, "coveredEntities");
  const enforcement = firstNodes(input, "enforcement");
  const reporting = firstNodes(input, "reportingAndEvaluation");
  const amendments = firstNodes(input, "amendmentsAndCrossReferences");

  if (purpose.length) add({ dimension: "policy_responsiveness", assessment: "strength", claim: "The bill text states a problem, purpose, or findings that can anchor later evaluation.", claimType: "textual_fact", nodes: purpose, reasoning: "An explicit problem statement makes the measure's intended response more inspectable, although it does not prove the stated problem or the intervention's effectiveness.", counterargument: "Findings can be selective or advocacy-oriented; operative provisions remain the stronger evidence of what the proposal would do.", confidence: "high", evidenceGap: "No independent evidence validating the stated problem has been loaded." });
  if (instruments.length) add({ dimension: "likely_effectiveness", assessment: "tradeoff", claim: "The text contains an operative policy mechanism, but the loaded sources do not establish whether it will achieve the intended outcome.", claimType: "causal_inference", nodes: instruments, reasoning: "The preliminary theory of change is: legal mechanism → affected actor response → intermediate implementation change → intended policy outcome. Only the first link is directly established by bill text.", counterargument: "A well-specified legal mandate may still be effective even when the current source bundle lacks empirical studies.", confidence: "low", evidenceGap: "Authoritative implementation evidence, behavioral response evidence, and alternatives analysis are not loaded." });

  if (implementers.length) add({ dimension: "implementation_feasibility", assessment: "strength", claim: "The detected provisions identify an official, department, commission, or agency connected to implementation.", claimType: "textual_fact", nodes: implementers, reasoning: "Named responsibility is a prerequisite for accountability, though the cited text may not resolve every interagency role.", counterargument: "Naming an entity does not demonstrate that it has sufficient authority, staff, systems, or appropriations.", confidence: "high", evidenceGap: "Agency capacity, staffing, and current statutory authority have not been independently verified." });
  if (deadlines.length) add({ dimension: "implementation_feasibility", assessment: "tradeoff", claim: "The bill specifies one or more implementation dates or deadlines.", claimType: "textual_fact", nodes: deadlines, reasoning: "A deadline improves accountability but may create execution risk if task complexity and available capacity are mismatched.", counterargument: "A firm timetable can force prioritization and prevent indefinite administrative delay.", confidence: "high", evidenceGap: "No workload, staffing, procurement, or implementation benchmark is loaded to test whether the timetable is realistic." });
  if (instruments.length && !funding.length) add({ dimension: "implementation_feasibility", assessment: "unknown", claim: "The detected operative mechanism is not accompanied by an explicit funding signal in the parsed bill map.", claimType: "risk_hypothesis", nodes: instruments, reasoning: "Implementation may rely on existing resources or appropriations outside this bill; nondetection is not proof that resources are inadequate.", counterargument: "The responsible entity may already possess sufficient authority and resources, or funding may be supplied through another measure.", confidence: "low", evidenceGap: "Applicable appropriations law, agency budget data, and a CBO estimate are not loaded." });

  if (instruments.length) add({ dimension: "economic_efficiency", assessment: "unknown", claim: "The bill creates or changes an administrative or compliance mechanism, but the current evidence cannot establish net economic efficiency.", claimType: "risk_hypothesis", nodes: instruments, reasoning: "Rules, programs, reporting duties, transfers, and eligibility systems can create both benefits and administrative costs. Bill text alone cannot quantify their balance.", counterargument: "The mechanism may replace more costly processes or generate benefits well above compliance costs.", confidence: "unknown", evidenceGap: "No version-matched CBO estimate, implementation-cost data, or empirical benefit estimate is included." });
  if (funding.length) add({ dimension: "economic_efficiency", assessment: "tradeoff", claim: "The text includes a funding, authorization, or fiscal-year signal.", claimType: "textual_fact", nodes: funding, reasoning: "Resource language improves visibility into implementation inputs but is not equivalent to an enacted appropriation or a net-cost estimate.", counterargument: "The cited language may be a ceiling, authorization, or accounting provision rather than expected spending.", confidence: "high", evidenceGap: "Budget authority type, outlay timing, offsets, and CBO scoring require external fiscal sources." });

  if (affected.length) add({ dimension: "distribution_equity", assessment: "tradeoff", claim: "The text identifies entities or groups that may receive benefits, face eligibility rules, or bear obligations.", claimType: "textual_fact", nodes: affected, reasoning: "Explicit scope permits distributional review, but names alone do not establish disparate impact or the incidence of costs and benefits.", counterargument: "Indirect beneficiaries and cost bearers may differ substantially from the entities named in the text.", confidence: "medium", evidenceGap: "Population, take-up, compliance, geographic, income, and demographic evidence are not loaded." });
  else add({ dimension: "distribution_equity", assessment: "unknown", claim: "The parsed evidence does not clearly establish who ultimately receives benefits or bears costs.", claimType: "risk_hypothesis", nodes: instruments, reasoning: "Distributional effects often pass through prices, access rules, geography, or administrative burdens that cannot be inferred safely from a title or broad mechanism.", counterargument: "The affected population may be evident from legal context not yet loaded or from provisions the lexical map did not classify.", confidence: "unknown", evidenceGap: "A stakeholder map and external distributional evidence are required." });
  if (enforcement.length) add({ dimension: "rights_due_process", assessment: "risk", claim: "Enforcement or compliance provisions raise a review question about notice, appeal, discretion, and remedies.", claimType: "risk_hypothesis", nodes: enforcement, reasoning: "The presence of enforcement makes procedural design material; this finding flags an issue for review and does not assert a constitutional defect.", counterargument: "Existing administrative law or the statute being amended may already supply adequate procedural protections.", confidence: "low", evidenceGap: "The surrounding U.S. Code, regulations, and controlling legal authorities have not been loaded." });

  if (applicable.get("abundance_supply_capacity") === "applicable" && instruments.length) add({ dimension: "abundance_supply_capacity", assessment: "tradeoff", claim: "The detected mechanism could affect physical or service supply capacity, but the direction and magnitude cannot be inferred from bill text alone.", claimType: "causal_inference", nodes: instruments, reasoning: "The supply theory of change is: legal mechanism → investment, entry, deployment, or operating response → capacity change → availability and price effects.", counterargument: "Implementation burdens, safeguards, demand responses, or complementary constraints could offset the intended capacity effect.", confidence: "low", evidenceGap: "Sector baselines, binding-constraint evidence, implementation behavior, and external impact research are not loaded." });

  if (amendments.length) add({ dimension: "coherence_durability", assessment: "risk", claim: "The bill contains amendatory language or statutory cross-references whose legal coherence cannot be fully verified from the bill text alone.", claimType: "risk_hypothesis", nodes: amendments, reasoning: "Issue spotting is possible from the amendatory instruction, but conflict, duplication, and downstream effects require the referenced law as amended.", counterargument: "Legislative counsel may have designed the amendment to fit cleanly within existing law.", confidence: "low", evidenceGap: "The current U.S. Code provisions, implementing regulations, and other incorporated authorities are not loaded." });
  if (reporting.length) add({ dimension: "coherence_durability", assessment: "strength", claim: "The bill includes a reporting, study, audit, or evaluation signal that may support implementation learning.", claimType: "textual_fact", nodes: reporting, reasoning: "Feedback mechanisms can expose implementation problems, although reporting alone does not ensure useful metrics or corrective action.", counterargument: "Reporting can become a compliance exercise if measures, independence, recipients, and follow-up duties are weak.", confidence: "high", evidenceGap: "The quality of metrics and the authority to act on findings require provision-level human review." });

  const lensDimensions: Record<string, string[]> = {
    responsiveness_and_evidence: ["policy_responsiveness", "likely_effectiveness"],
    implementation_and_state_capacity: ["implementation_feasibility"],
    economic_and_administrative_efficiency: ["economic_efficiency"],
    distribution_equity_and_rights: ["distribution_equity", "rights_due_process"],
    abundance_and_supply_capacity: ["abundance_supply_capacity"]
  };
  const lenses = DEFAULT_LENSES.map((id) => {
    const dimensions = lensDimensions[id];
    const statuses = dimensions.map((dimension) => applicable.get(dimension));
    const status = statuses.includes("applicable") ? "applicable" : statuses.every((item) => item === "not_applicable") ? "not_applicable" : "unknown";
    return { id, status, dimensions, findings: findings.filter((finding) => dimensions.includes(finding.dimension)) };
  });
  const analysisRun: AnalysisRun = {
    schemaVersion: "0.1.0",
    analysisRunId: `run:${randomUUID()}`,
    billId: input.billId,
    versionCode: input.versionCode,
    sourceSnapshotIds: [input.sourceSnapshotId],
    rubricVersion: "0.1.0",
    promptVersion: "day4-deterministic-evidence@0.1.0",
    modelId: "deterministic-evidence-engine@0.1.0",
    generatedAt: new Date().toISOString(),
    selectedLenses: [...DEFAULT_LENSES],
    findings
  };
  const citationAudit = assertPublishableAnalysis(analysisRun, {
    normalizedText: input.normalizedText,
    sourceSnapshotId: input.sourceSnapshotId,
    sourceUrl: input.sourceUrl,
    nodes: input.nodes
  });
  return {
    gate: instruments.length ? "open" : "limited",
    applicability: applicability.map((item) => ({ ...item, label: DIMENSION_LABELS[item.dimension] })),
    lenses,
    crossCuttingFindings: findings.filter((finding) => finding.dimension === "coherence_durability"),
    analysisRun,
    citationAudit,
    limitations: [
      "This is an evidence-structured research aid, not legal advice or a prediction of real-world effects.",
      "No open-web research is used. Empirical effectiveness, fiscal impact, legal validity, and distributional incidence remain unknown without authoritative external sources.",
      "Findings are tied only to the selected bill text version; proposed language is not described as current law."
    ]
  };
}
