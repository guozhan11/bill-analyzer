export type BillType = "hr" | "s" | "hjres" | "sjres";
export type Assessment = "strength" | "risk" | "tradeoff" | "unknown";
export type Confidence = "high" | "medium" | "low" | "unknown";
export type ClaimType =
  | "textual_fact"
  | "legal_context"
  | "empirical_claim"
  | "causal_inference"
  | "risk_hypothesis"
  | "normative_judgment";

export interface BillIdentity {
  congress: number;
  billType: BillType;
  billNumber: number;
  canonicalId: string;
  canonicalUrl: string;
}

export interface Citation {
  sourceSnapshotId: string;
  nodeId: string;
  locator: string;
  quote: string;
  charStart: number;
  charEnd: number;
  sourceUrl: string;
  verified: boolean;
}

export interface Finding {
  id: string;
  dimension: string;
  assessment: Assessment;
  claim: string;
  claimType: ClaimType;
  billCitations: Citation[];
  externalCitations: Citation[];
  reasoning: string;
  counterargument: string;
  confidence: Confidence;
  evidenceGap: string;
}

export interface SourceSnapshot {
  id: string;
  sourceUrl: string;
  fetchedAt: string;
  mediaType: string;
  sha256: string;
  rawStoragePath: string;
  normalizedStoragePath: string;
  parserVersion: string;
  upstreamUpdatedAt?: string;
}

export interface LegalNode {
  nodeId: string;
  billId: string;
  versionCode: string;
  nodeType: string;
  label?: string;
  heading?: string;
  citation: string;
  text: string;
  parentId?: string;
  ordinal: number;
  sourceSnapshotId: string;
  charStart: number;
  charEnd: number;
  depth: number;
  classifications: Array<"definition" | "amendatory_instruction" | "quoted_statutory_text">;
}

export type ChecklistStatus = "Present" | "Partial" | "Absent" | "Not applicable" | "Unknown";

export interface BillMapEvidence {
  nodeId: string;
  citation: string;
  excerpt: string;
  charStart: number;
  charEnd: number;
}

export interface StructuralCheck {
  key: string;
  label: string;
  status: ChecklistStatus;
  rationale: string;
  evidence: BillMapEvidence[];
}

export interface AnalysisRun {
  schemaVersion: "0.1.0";
  analysisRunId: string;
  billId: string;
  versionCode: string;
  sourceSnapshotIds: string[];
  rubricVersion: string;
  promptVersion: string;
  modelId: string;
  generatedAt: string;
  selectedLenses: string[];
  findings: Finding[];
}

export type ApplicabilityStatus = "applicable" | "not_applicable" | "unknown";

export interface ApplicabilityDecision {
  dimension: string;
  status: ApplicabilityStatus;
  rationale: string;
  citations: Citation[];
}
