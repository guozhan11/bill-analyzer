# Day 4 — Applicability and Critique Pipeline

## Delivered

- Gate 0 uses the Day 3 bill map to limit deeper claims when no operative mechanism is identified.
- Gate 1 records an explicit `applicable`, `not_applicable`, or `unknown` decision for each P1–P8 rubric dimension.
- The eight internal dimensions are composed into the five default UI lenses: responsiveness, implementation, efficiency, equity/rights, and abundance. P8 findings appear as cross-cutting risks.
- Each finding conforms to the existing finding contract: assessment, claim type, bill citations, external citations, reasoning, counterargument, confidence, and evidence gap.
- Textual facts require at least one bill citation. Every displayed bill quote is checked as an exact contiguous match against the selected version's normalized source snapshot before publication.
- Risk and strength findings include a good-faith counterargument. Empirical effects, fiscal totals, legal validity, and disparate impact are not invented when external evidence is absent.
- Analysis-run metadata records bill/version identity, source snapshot, rubric/prompt/engine versions, selected lenses, and generation time.
- The browser UI provides lens tabs, applicability decisions, evidence types, confidence, counterarguments, evidence gaps, and expandable verified quotes.

## Engine choice

Day 4 uses `deterministic-evidence-engine@0.1.0`. This is deliberate: the project currently has a Congress.gov key but no configured model or approved external-research corpus. The engine creates auditable research questions from primary text without pretending to perform empirical RAG. Its output contract is the same contract a later LLM/RAG implementation must satisfy.

## Safety behavior

- Proposed language is never described as enacted law.
- A missing lexical signal does not become an `Absent` conclusion.
- No sponsor party is passed into the critique engine.
- Abundance is `not_applicable` unless the title, policy area, or subjects clearly concern a supply-constrained sector.
- U.S. Code coherence is an issue-spotting finding with low confidence until incorporated law is retrieved.

## Validation

Automated tests verify five-lens composition, applicability, maximum findings per internal dimension, required counterarguments, textual-fact citation coverage, and exact quote-to-snapshot matching.

The three development bills also completed end to end:

| Bill | Findings | Unverified quotes | Textual facts without citations | Notable abstention |
|---|---:|---:|---:|---|
| H.R. 5551 (IH) | 10 | 0 | 0 | distribution remains `unknown`; no net-cost claim |
| H.R. 5378 (IH) | 11 | 0 | 0 | no claim that funding language equals enacted spending |
| H.R. 1240 (IH) | 4 | 0 | 0 | abundance is `not_applicable`; no rights finding without a signal |
