import type { BillIdentity, SourceSnapshot } from "../domain/types.ts";
import { parseUslmBill } from "../domain/uslm-parser.ts";
import { buildStructuralChecklist, extractBillMap } from "./bill-map.ts";
import { generateCritique, generateScopeRequiredCritique } from "./critique-engine.ts";
import { composeMarkdownReport } from "./report-composer.ts";
import {
  preferredTextFormat,
  selectTextVersion,
  type CongressBillBundle,
  type TextVersion
} from "../adapters/congress-gov.ts";

interface CongressClient {
  fetchBillBundle(identity: BillIdentity): Promise<CongressBillBundle>;
  downloadText(format: { type: string; url: string }): Promise<{ body: string; mediaType: string }>;
}

interface SnapshotStore {
  save(input: {
    sourceUrl: string;
    body: string;
    mediaType: string;
    parserVersion: string;
    upstreamUpdatedAt?: string;
  }): Promise<SourceSnapshot & { normalizedText: string }>;
}

export interface IngestBillOptions {
  identity: BillIdentity;
  requestedVersionCode?: string;
  client: CongressClient;
  snapshots: SnapshotStore;
  requestedScopeNodeId?: string;
}

function descendantsOf(nodes: import("../domain/types.ts").LegalNode[], rootId: string) {
  const included = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && included.has(node.parentId) && !included.has(node.nodeId)) {
        included.add(node.nodeId);
        changed = true;
      }
    }
  }
  return nodes.filter((node) => included.has(node.nodeId));
}

function plainSummaryText(summary: Record<string, unknown>): string {
  const raw = typeof summary.text === "string" ? summary.text : "";
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function publicSnapshot(snapshot: SourceSnapshot) {
  return {
    id: snapshot.id,
    sourceUrl: snapshot.sourceUrl,
    fetchedAt: snapshot.fetchedAt,
    mediaType: snapshot.mediaType,
    sha256: snapshot.sha256,
    parserVersion: snapshot.parserVersion,
    ...(snapshot.upstreamUpdatedAt ? { upstreamUpdatedAt: snapshot.upstreamUpdatedAt } : {})
  };
}

function publicVersion(version: TextVersion) {
  return {
    code: version.code,
    name: version.name,
    date: version.date,
    formats: version.formats.map((format) => ({ type: format.type, url: format.url }))
  };
}

function matchingSummary(summaries: Array<Record<string, unknown>>, selectedVersion: TextVersion) {
  const versionName = selectedVersion.name.toLowerCase();
  const candidates = summaries.filter((summary) => typeof summary.actionDesc === "string");
  const exact = candidates.find((summary) => String(summary.actionDesc).toLowerCase() === versionName);
  if (exact) return exact;
  const contextPatterns: Record<string, RegExp> = {
    ih: /introduced in house/i,
    is: /introduced in senate/i,
    rh: /reported (?:to|in) house/i,
    rs: /reported (?:to|in) senate/i,
    eh: /passed house/i,
    rfs: /passed house/i,
    es: /passed senate/i,
    rfh: /passed senate/i,
    enr: /passed congress|enrolled/i
  };
  const pattern = contextPatterns[selectedVersion.code];
  if (pattern) return candidates.find((summary) => pattern.test(String(summary.actionDesc)));
  return undefined;
}

export async function ingestBill(options: IngestBillOptions) {
  const bundle = await options.client.fetchBillBundle(options.identity);
  const selectedVersion = selectTextVersion(bundle.versions, options.requestedVersionCode);
  const selectedFormat = preferredTextFormat(selectedVersion);
  const downloaded = await options.client.downloadText(selectedFormat);

  const metadataBody = `${JSON.stringify(bundle.raw, null, 2)}\n`;
  const [metadataSnapshot, textSnapshot] = await Promise.all([
    options.snapshots.save({
      sourceUrl: options.identity.canonicalUrl,
      body: metadataBody,
      mediaType: "application/json",
      parserVersion: "congress-api-bundle@0.1.0",
      upstreamUpdatedAt: typeof bundle.bill.updateDate === "string" ? bundle.bill.updateDate : undefined
    }),
    options.snapshots.save({
      sourceUrl: selectedFormat.url,
      body: downloaded.body,
      mediaType: downloaded.mediaType,
      parserVersion: "plain-text-normalizer@0.1.0",
      upstreamUpdatedAt: selectedVersion.date || undefined
    })
  ]);

  const sponsors = Array.isArray(bundle.bill.sponsors) ? bundle.bill.sponsors : [];
  const versionSummary = matchingSummary(bundle.summaries, selectedVersion);
  const legislativeSubjects = bundle.subjects.legislativeSubjects
    .map((subject) => typeof subject.name === "string" ? subject.name : null)
    .filter((name): name is string => Boolean(name));
  const parsed = downloaded.mediaType.includes("xml")
    ? parseUslmBill({
        xml: downloaded.body,
        normalizedText: textSnapshot.normalizedText,
        identity: options.identity,
        versionCode: selectedVersion.code,
        sourceSnapshotId: textSnapshot.id
      })
    : { nodes: [], warnings: ["This text version was not XML, so hierarchical parsing was unavailable."] };
  const scopeRoots = parsed.nodes.filter((node) => node.nodeType === "division" && node.depth === 0);
  const requestedScope = options.requestedScopeNodeId
    ? scopeRoots.find((node) => node.nodeId === options.requestedScopeNodeId)
    : undefined;
  if (options.requestedScopeNodeId && !requestedScope) throw new Error("Invalid scope node for this bill version.");
  const analysisNodes = requestedScope ? descendantsOf(parsed.nodes, requestedScope.nodeId) : parsed.nodes;
  const scopeOptions = scopeRoots.map((node) => ({ nodeId: node.nodeId, citation: node.citation, heading: node.heading ?? node.citation }));
  const scopeRequired = scopeRoots.length > 1 && !requestedScope;
  const billMap = extractBillMap(scopeRequired ? parsed.nodes : analysisNodes);
  const structuralChecklist = buildStructuralChecklist(billMap);
  const nodeCounts = parsed.nodes.reduce((counts: Record<string, number>, node) => {
    counts[node.nodeType] = (counts[node.nodeType] ?? 0) + 1;
    return counts;
  }, {});
  const classificationCounts = parsed.nodes.flatMap((node) => node.classifications)
    .reduce((counts: Record<string, number>, classification) => {
      counts[classification] = (counts[classification] ?? 0) + 1;
      return counts;
    }, {});
  const critiqueInput = {
    billId: options.identity.canonicalId,
    versionCode: selectedVersion.code,
    title: String(bundle.bill.title ?? "Untitled bill"),
    policyArea: (bundle.bill.policyArea as any)?.name ?? (bundle.subjects.policyArea as any)?.name ?? null,
    subjects: legislativeSubjects,
    nodes: analysisNodes,
    billMap,
    normalizedText: textSnapshot.normalizedText,
    sourceSnapshotId: textSnapshot.id,
    sourceUrl: selectedFormat.url
  };
  const critique = scopeRequired
    ? generateScopeRequiredCritique(critiqueInput, scopeOptions)
    : generateCritique(critiqueInput);

  const bill = {
      id: options.identity.canonicalId,
      congress: options.identity.congress,
      billType: options.identity.billType,
      billNumber: options.identity.billNumber,
      title: String(bundle.bill.title ?? "Untitled bill"),
      canonicalUrl: options.identity.canonicalUrl,
      introducedDate: bundle.bill.introducedDate ?? null,
      originChamber: bundle.bill.originChamber ?? null,
      policyArea: (bundle.bill.policyArea as any)?.name ?? (bundle.subjects.policyArea as any)?.name ?? null,
      latestAction: bundle.bill.latestAction ?? null,
      updateDate: bundle.bill.updateDate ?? null,
      sponsors: sponsors.map((sponsor: any) => ({
        name: sponsor.fullName ?? [sponsor.firstName, sponsor.lastName].filter(Boolean).join(" "),
        bioguideId: sponsor.bioguideId ?? null
      }))
    };
  const selectedVersionPublic = {
      ...publicVersion(selectedVersion),
      selectedFormat,
      characterCount: textSnapshot.normalizedText.length,
      preview: textSnapshot.normalizedText.slice(0, 1_500)
    };
  const sources = {
      metadata: publicSnapshot(metadataSnapshot),
      billText: publicSnapshot(textSnapshot)
    };
  const ingestedAt = new Date().toISOString();
  const scope = {
    status: scopeRequired ? "required" : requestedScope ? "selected" : "whole_bill",
    options: scopeOptions,
    selectedNodeId: requestedScope?.nodeId ?? null,
    selectedLabel: requestedScope ? `${requestedScope.citation} — ${requestedScope.heading ?? requestedScope.citation}` : null
  };
  const summary = versionSummary ? {
    text: plainSummaryText(versionSummary),
    actionDate: versionSummary.actionDate ?? null,
    actionDesc: versionSummary.actionDesc ?? null,
    updateDate: versionSummary.updateDate ?? null,
    matchesSelectedVersion: true
  } : null;
  const report = composeMarkdownReport({
    bill,
    selectedVersion: selectedVersionPublic,
    summary,
    ingestedAt,
    scope,
    billMap,
    structuralChecklist,
    critique
  });

  return {
    bill,
    versions: bundle.versions.map(publicVersion),
    selectedVersion: selectedVersionPublic,
    summary,
    summaryAvailability: {
      count: bundle.summaries.length,
      contexts: bundle.summaries.map((summary) => ({
        actionDate: summary.actionDate ?? null,
        actionDesc: summary.actionDesc ?? null,
        updateDate: summary.updateDate ?? null
      }))
    },
    subjects: legislativeSubjects,
    structure: {
      parserVersion: "uslm-hierarchy@0.1.0",
      nodeCount: parsed.nodes.length,
      nodeCounts,
      classificationCounts,
      warnings: parsed.warnings,
      nodes: parsed.nodes
    },
    scope,
    billMap,
    structuralChecklist,
    critique,
    sources,
    report,
    ingestedAt
  };
}
