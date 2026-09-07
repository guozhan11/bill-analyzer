const readiness = document.querySelector("#readiness");
const form = document.querySelector("#bill-form");
const billInput = document.querySelector("#bill-input");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const result = document.querySelector("#result");
const versionSelect = document.querySelector("#version-select");
const loadVersionButton = document.querySelector("#load-version");
const copyReportButton = document.querySelector("#copy-report");
const downloadReportButton = document.querySelector("#download-report");
const scopeBar = document.querySelector("#scope-bar");
const scopeSelect = document.querySelector("#scope-select");
const analyzeScopeButton = document.querySelector("#analyze-scope");
let lastInput = null;
let lastReport = null;

const configuredApiBase = String(globalThis.BILL_ANALYZER_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");

function apiUrl(path) {
  return `${configuredApiBase}${path}`;
}

async function loadReadiness() {
  try {
    const response = await fetch(apiUrl("/api/readiness"));
    const data = await response.json();
    const ready = data.status === "ready";
    readiness.textContent = ready ? "Congress.gov ready" : "Congress.gov API key needed";
    readiness.classList.toggle("ready", ready);
  } catch {
    readiness.textContent = "Service unavailable";
  }
}

function setLoading(loading, label = "Fetching official sources…") {
  submitButton.disabled = loading;
  loadVersionButton.disabled = loading;
  if (loading) message.textContent = label;
}

function addFact(container, label, value) {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const detail = document.createElement("dd");
  term.textContent = label;
  detail.textContent = value || "Not available";
  wrapper.append(term, detail);
  container.append(wrapper);
}

function renderSource(container, label, source) {
  const item = document.createElement("div");
  const title = document.createElement("strong");
  const hash = document.createElement("code");
  const time = document.createElement("span");
  title.textContent = label;
  hash.textContent = source.id.replace("sha256:", "").slice(0, 16);
  time.textContent = `Fetched ${new Date(source.fetchedAt).toLocaleString()}`;
  item.append(title, hash, time);
  container.append(item);
}

const mapLabels = {
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

const lensLabels = {
  responsiveness_and_evidence: "Responsiveness",
  implementation_and_state_capacity: "Implementation",
  economic_and_administrative_efficiency: "Efficiency",
  distribution_equity_and_rights: "Equity & rights",
  abundance_and_supply_capacity: "Abundance"
};

const claimTypeLabels = {
  textual_fact: "Textual fact",
  legal_context: "Legal context",
  empirical_claim: "Empirical claim",
  causal_inference: "Causal inference",
  risk_hypothesis: "Risk hypothesis",
  normative_judgment: "Normative judgment"
};

function renderEvidenceList(container, evidence) {
  if (!evidence.length) {
    const empty = document.createElement("p");
    empty.className = "empty-signal";
    empty.textContent = "No explicit signal detected — Unknown, not automatically absent.";
    container.append(empty);
    return;
  }
  for (const item of evidence.slice(0, 3)) {
    const detail = document.createElement("details");
    const summary = document.createElement("summary");
    const quote = document.createElement("p");
    summary.textContent = item.citation;
    quote.textContent = item.excerpt;
    detail.append(summary, quote);
    container.append(detail);
  }
}

function renderDay3(data) {
  document.querySelector("#structure-count").textContent = `${data.structure.nodeCount.toLocaleString()} legal nodes`;
  const checklist = document.querySelector("#checklist");
  checklist.replaceChildren();
  for (const check of data.structuralChecklist) {
    const row = document.createElement("div");
    const title = document.createElement("strong");
    const status = document.createElement("span");
    const rationale = document.createElement("p");
    title.textContent = check.label;
    status.className = `status status-${check.status.toLowerCase().replaceAll(" ", "-")}`;
    status.textContent = check.status;
    rationale.textContent = check.rationale;
    row.append(title, status, rationale);
    renderEvidenceList(row, check.evidence);
    checklist.append(row);
  }

  const billMap = document.querySelector("#bill-map");
  billMap.replaceChildren();
  for (const [key, evidence] of Object.entries(data.billMap)) {
    const card = document.createElement("section");
    const heading = document.createElement("h4");
    heading.textContent = mapLabels[key] || key;
    card.append(heading);
    renderEvidenceList(card, evidence);
    billMap.append(card);
  }

  const outline = document.querySelector("#bill-outline");
  outline.replaceChildren();
  const outlineNodes = data.structure.nodes.filter((node) => ["division", "title", "subtitle", "section", "subsection"].includes(node.nodeType));
  for (const node of outlineNodes.slice(0, 80)) {
    const line = document.createElement("div");
    line.style.setProperty("--depth", Math.min(node.depth, 5));
    const cite = document.createElement("strong");
    const heading = document.createElement("span");
    cite.textContent = node.citation;
    heading.textContent = node.heading || node.text.slice(0, 100);
    line.append(cite, heading);
    outline.append(line);
  }
  document.querySelector("#parser-note").textContent = data.structure.warnings.length
    ? `${data.structure.warnings.length} alignment warning(s)`
    : "All displayed nodes aligned to the source snapshot";
}

function renderFinding(container, finding) {
  const article = document.createElement("article");
  article.className = "finding";
  const header = document.createElement("div");
  header.className = "finding-header";
  const assessment = document.createElement("span");
  assessment.className = `assessment assessment-${finding.assessment}`;
  assessment.textContent = finding.assessment;
  const type = document.createElement("span");
  type.className = "claim-type";
  type.textContent = claimTypeLabels[finding.claimType] || finding.claimType;
  const confidence = document.createElement("span");
  confidence.className = "confidence";
  confidence.textContent = `${finding.confidence} confidence`;
  header.append(assessment, type, confidence);
  const claim = document.createElement("h4");
  claim.textContent = finding.claim;
  const reasoning = document.createElement("p");
  reasoning.textContent = finding.reasoning;
  const counter = document.createElement("div");
  counter.className = "counterargument";
  const counterLabel = document.createElement("strong");
  counterLabel.textContent = "Good-faith counterargument";
  const counterText = document.createElement("p");
  counterText.textContent = finding.counterargument;
  counter.append(counterLabel, counterText);
  const gap = document.createElement("div");
  gap.className = "evidence-gap";
  const gapLabel = document.createElement("strong");
  gapLabel.textContent = "Evidence gap";
  const gapText = document.createElement("p");
  gapText.textContent = finding.evidenceGap || "No additional gap recorded.";
  gap.append(gapLabel, gapText);
  article.append(header, claim, reasoning, counter, gap);
  if (finding.billCitations.length) {
    const citations = document.createElement("div");
    citations.className = "finding-citations";
    for (const citation of finding.billCitations) {
      const detail = document.createElement("details");
      const summary = document.createElement("summary");
      const quote = document.createElement("blockquote");
      const metadata = document.createElement("div");
      const source = document.createElement("a");
      summary.textContent = `${citation.locator} · verified source quote`;
      quote.textContent = citation.quote;
      metadata.className = "citation-metadata";
      metadata.textContent = `${citation.sourceSnapshotId.replace("sha256:", "").slice(0, 16)} · chars ${citation.charStart}–${citation.charEnd}`;
      source.href = citation.sourceUrl;
      source.target = "_blank";
      source.rel = "noreferrer";
      source.textContent = "Open selected official text ↗";
      metadata.append(" · ", source);
      detail.append(summary, quote, metadata);
      citations.append(detail);
    }
    article.append(citations);
  }
  container.append(article);
}

function renderCritique(data) {
  const critique = data.critique;
  document.querySelector("#critique-meta").textContent = `${critique.analysisRun.findings.length} findings · ${critique.analysisRun.modelId}`;
  const audit = document.querySelector("#citation-audit");
  audit.className = `audit-banner audit-${critique.citationAudit.status}`;
  audit.textContent = critique.gate === "scope_required"
    ? "No findings published: choose a division before critique and citation audit."
    : critique.citationAudit.status === "passed"
    ? `Citation audit passed: ${critique.citationAudit.verifiedBillCitations}/${critique.citationAudit.totalBillCitations} quotes verified; ${critique.citationAudit.textualFactsWithCitations}/${critique.citationAudit.textualFacts} textual facts cited.`
    : `Citation audit failed: ${critique.citationAudit.failedBillCitations} citation(s) require review.`;
  const tabs = document.querySelector("#lens-tabs");
  const results = document.querySelector("#lens-results");
  tabs.replaceChildren();
  results.replaceChildren();
  const showLens = (lensId) => {
    for (const button of tabs.querySelectorAll("button")) button.classList.toggle("active", button.dataset.lens === lensId);
    results.replaceChildren();
    const lens = critique.lenses.find((item) => item.id === lensId);
    if (!lens || lens.findings.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-signal";
      empty.textContent = lens?.status === "not_applicable"
        ? "This lens is not applicable under the current MVP rule."
        : "The available evidence is insufficient for a responsible finding under this lens.";
      results.append(empty);
      return;
    }
    for (const finding of lens.findings) renderFinding(results, finding);
  };
  for (const lens of critique.lenses) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.lens = lens.id;
    button.className = `lens-tab lens-${lens.status}`;
    button.textContent = lensLabels[lens.id] || lens.id;
    button.addEventListener("click", () => showLens(lens.id));
    tabs.append(button);
  }
  showLens(critique.lenses.find((lens) => lens.findings.length)?.id || critique.lenses[0].id);

  const applicability = document.querySelector("#applicability");
  applicability.replaceChildren();
  for (const item of critique.applicability) {
    const row = document.createElement("div");
    const label = document.createElement("strong");
    const status = document.createElement("span");
    const rationale = document.createElement("p");
    label.textContent = item.label;
    status.className = `status applicability-${item.status}`;
    status.textContent = item.status.replace("_", " ");
    rationale.textContent = item.rationale;
    row.append(label, status, rationale);
    applicability.append(row);
  }

  const crossCutting = document.querySelector("#cross-cutting");
  crossCutting.replaceChildren();
  if (!critique.crossCuttingFindings.length) {
    const empty = document.createElement("p");
    empty.className = "empty-signal";
    empty.textContent = "No publishable cross-cutting finding was generated from the loaded evidence.";
    crossCutting.append(empty);
  } else {
    for (const finding of critique.crossCuttingFindings) renderFinding(crossCutting, finding);
  }
}

function renderBill(data) {
  document.querySelector("#bill-kicker").textContent = `${data.bill.billType.toUpperCase()} ${data.bill.billNumber} · ${data.bill.congress}th Congress`;
  document.querySelector("#bill-title").textContent = data.bill.title;
  const officialLink = document.querySelector("#official-link");
  officialLink.href = data.bill.canonicalUrl;

  const facts = document.querySelector("#bill-facts");
  facts.replaceChildren();
  addFact(facts, "Policy area", data.bill.policyArea);
  addFact(facts, "Introduced", data.bill.introducedDate);
  addFact(facts, "Origin chamber", data.bill.originChamber);
  addFact(facts, "Latest action", data.bill.latestAction?.text);
  addFact(facts, "Selected version", `${data.selectedVersion.code.toUpperCase()} — ${data.selectedVersion.name}`);
  addFact(facts, "Text format", data.selectedVersion.selectedFormat.type);

  versionSelect.replaceChildren();
  for (const version of data.versions) {
    const option = document.createElement("option");
    option.value = version.code;
    option.textContent = `${version.code.toUpperCase()} — ${version.name} (${version.date.slice(0, 10) || "unknown date"})`;
    option.selected = version.code === data.selectedVersion.code;
    versionSelect.append(option);
  }

  scopeSelect.replaceChildren();
  scopeBar.hidden = data.scope.options.length <= 1;
  if (!scopeBar.hidden) {
    for (const scope of data.scope.options) {
      const option = document.createElement("option");
      option.value = scope.nodeId;
      option.textContent = `${scope.citation} — ${scope.heading}`;
      option.selected = scope.nodeId === data.scope.selectedNodeId;
      scopeSelect.append(option);
    }
    scopeBar.querySelector("strong").textContent = data.scope.status === "selected" ? "Selected scope" : "Scope required";
  }

  document.querySelector("#summary-text").textContent = data.summary?.text || "Congress.gov does not currently provide a CRS summary for this bill version.";
  const subjects = document.querySelector("#subject-list");
  subjects.replaceChildren();
  if (data.subjects.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No legislative subjects returned.";
    subjects.append(empty);
  } else {
    for (const subject of data.subjects) {
      const item = document.createElement("li");
      item.textContent = subject;
      subjects.append(item);
    }
  }

  const sourceList = document.querySelector("#source-list");
  sourceList.replaceChildren();
  renderSource(sourceList, "Metadata bundle", data.sources.metadata);
  renderSource(sourceList, "Bill text", data.sources.billText);
  document.querySelector("#text-count").textContent = `${data.selectedVersion.characterCount.toLocaleString()} normalized characters`;
  document.querySelector("#text-preview").textContent = data.selectedVersion.preview || "No text preview available.";
  renderDay3(data);
  renderCritique(data);
  lastReport = data.report;
  copyReportButton.disabled = false;
  downloadReportButton.disabled = false;
  result.hidden = false;
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function ingest(versionCode, scopeNodeId) {
  if (!lastInput) return;
  setLoading(true, versionCode ? `Loading text version ${versionCode.toUpperCase()}…` : undefined);
  result.hidden = true;
  try {
    const response = await fetch(apiUrl("/api/bills/ingest"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...lastInput, ...(versionCode ? { versionCode } : {}), ...(scopeNodeId ? { scopeNodeId } : {}) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `Request failed with HTTP ${response.status}`);
    renderBill(data);
    message.textContent = data.scope.status === "required"
      ? `Parsed ${data.bill.id} ${data.selectedVersion.code.toUpperCase()}, but critique is withheld until you select one of ${data.scope.options.length} divisions.`
      : `Analyzed ${data.bill.id} ${data.selectedVersion.code.toUpperCase()}${data.scope.selectedLabel ? ` · ${data.scope.selectedLabel}` : ""}: ${data.structure.nodeCount.toLocaleString()} legal nodes and ${data.critique.analysisRun.findings.length} evidence-gated findings.`;
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : "The bill could not be retrieved.";
    message.classList.add("error");
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.classList.remove("error");
  const formData = new FormData(form);
  lastInput = {
    input: String(formData.get("bill") || "").trim(),
    congress: String(formData.get("congress") || "").trim()
  };
  await ingest();
});

for (const demoButton of document.querySelectorAll(".demo-button")) {
  demoButton.addEventListener("click", async () => {
    billInput.value = demoButton.dataset.bill;
    lastInput = { input: demoButton.dataset.bill, congress: "" };
    message.classList.remove("error");
    await ingest();
  });
}

loadVersionButton.addEventListener("click", () => ingest(versionSelect.value));
analyzeScopeButton.addEventListener("click", () => ingest(versionSelect.value, scopeSelect.value));

copyReportButton.addEventListener("click", async () => {
  if (!lastReport) return;
  try {
    await navigator.clipboard.writeText(lastReport.markdown);
    const original = copyReportButton.textContent;
    copyReportButton.textContent = "Copied";
    window.setTimeout(() => { copyReportButton.textContent = original; }, 1_500);
  } catch {
    message.textContent = "Clipboard access was unavailable. Use Download .md instead.";
    message.classList.add("error");
  }
});

downloadReportButton.addEventListener("click", () => {
  if (!lastReport) return;
  const blob = new Blob([lastReport.markdown], { type: lastReport.mediaType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = lastReport.filename;
  link.click();
  URL.revokeObjectURL(url);
});

loadReadiness();
