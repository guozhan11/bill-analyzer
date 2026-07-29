import type { AnalysisRun, Citation, LegalNode } from "../domain/types.ts";

export interface CitationContext {
  normalizedText: string;
  sourceSnapshotId: string;
  sourceUrl: string;
  nodes: LegalNode[];
}

export interface CitationAudit {
  status: "passed" | "failed";
  totalBillCitations: number;
  verifiedBillCitations: number;
  failedBillCitations: number;
  textualFacts: number;
  textualFactsWithCitations: number;
  issues: string[];
}

export function createBillCitation(node: LegalNode, context: Omit<CitationContext, "nodes">, maxQuoteLength = 420): Citation | undefined {
  const quote = node.text.slice(0, maxQuoteLength);
  const charEnd = node.charStart + quote.length;
  if (!quote || context.normalizedText.slice(node.charStart, charEnd) !== quote) return undefined;
  return {
    sourceSnapshotId: context.sourceSnapshotId,
    nodeId: node.nodeId,
    locator: node.citation,
    quote,
    charStart: node.charStart,
    charEnd,
    sourceUrl: context.sourceUrl,
    verified: true
  };
}

export function verifyBillCitation(citation: Citation, context: CitationContext): string[] {
  const issues: string[] = [];
  const node = context.nodes.find((candidate) => candidate.nodeId === citation.nodeId);
  if (citation.sourceSnapshotId !== context.sourceSnapshotId) issues.push("citation snapshot does not match the selected bill-text snapshot");
  if (citation.sourceUrl !== context.sourceUrl) issues.push("citation URL does not match the selected text version");
  if (!node) issues.push("citation node does not exist in the parsed bill hierarchy");
  if (node && node.sourceSnapshotId !== citation.sourceSnapshotId) issues.push("citation node belongs to a different snapshot");
  if (node && node.citation !== citation.locator) issues.push("citation locator does not match its legal node");
  if (citation.charStart < 0 || citation.charEnd <= citation.charStart || citation.charEnd > context.normalizedText.length) {
    issues.push("citation character range is invalid");
  } else if (context.normalizedText.slice(citation.charStart, citation.charEnd) !== citation.quote) {
    issues.push("citation quote is not an exact contiguous snapshot match");
  }
  if (node && (citation.charStart < node.charStart || citation.charEnd > node.charEnd)) {
    issues.push("citation range falls outside its legal node");
  }
  if (!citation.verified) issues.push("citation was not marked verified by the producer");
  return issues;
}

export function auditAnalysisRun(run: AnalysisRun, context: CitationContext): CitationAudit {
  const issues: string[] = [];
  let totalBillCitations = 0;
  let verifiedBillCitations = 0;
  let textualFacts = 0;
  let textualFactsWithCitations = 0;
  for (const finding of run.findings) {
    if (finding.claimType === "textual_fact") {
      textualFacts += 1;
      if (finding.billCitations.length) textualFactsWithCitations += 1;
      else issues.push(`${finding.id}: textual fact has no bill citation`);
    }
    for (const citation of finding.billCitations) {
      totalBillCitations += 1;
      const citationIssues = verifyBillCitation(citation, context);
      if (citationIssues.length === 0) verifiedBillCitations += 1;
      else issues.push(...citationIssues.map((issue) => `${finding.id}: ${issue}`));
    }
  }
  return {
    status: issues.length ? "failed" : "passed",
    totalBillCitations,
    verifiedBillCitations,
    failedBillCitations: totalBillCitations - verifiedBillCitations,
    textualFacts,
    textualFactsWithCitations,
    issues
  };
}

export function assertPublishableAnalysis(run: AnalysisRun, context: CitationContext): CitationAudit {
  const audit = auditAnalysisRun(run, context);
  if (audit.status === "failed") {
    throw new Error(`Analysis failed citation publish gate: ${audit.issues.join("; ")}`);
  }
  return audit;
}
