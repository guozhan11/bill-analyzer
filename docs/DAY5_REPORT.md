# Day 5 — Citation Verification, UI, and Markdown Export

## Delivered

- A standalone citation verifier checks source snapshot ID, selected-version URL, legal node ID, locator, node bounds, character offsets, exact contiguous quote matching, and the producer's verified flag.
- An analysis-run publish gate blocks output when any bill citation fails or when a textual fact has no bill citation.
- Citation audit totals are returned with the API response and displayed prominently in the browser.
- Every finding exposes assessment, claim type, confidence, reasoning, good-faith counterargument, evidence gap, locator, quote, snapshot hash prefix, character range, and the official selected-text link.
- The single-page result supports switching among five lenses without another network request.
- A complete Markdown report can be copied to the clipboard or downloaded as `{bill}-{congress}-{version}-critique.md`.
- The report includes identity, version, audit totals, bill map, structural checklist, applicability, all lens findings, cross-cutting findings, limitations, and reproducibility metadata.

## Trust boundary

The Markdown report is composed only after the analysis run passes citation verification. It does not silently repair or omit a bad quote: a failed audit stops publication so the underlying parser or finding must be fixed.

## Validation

Automated tests cover a successful full-run audit, deliberate quote tampering, exact snapshot matching, textual-fact citation coverage, report filename, required report sections, and sponsor-data exclusion. Browser validation covers ingestion, lens switching, audit display, citation provenance, and Markdown controls.

Real introduced-version runs all passed the publish gate:

| Bill | Verified bill quotes | Cited textual facts | Markdown size |
|---|---:|---:|---:|
| H.R. 5551 | 20/20 | 3/3 | 27,508 characters |
| H.R. 5378 | 22/22 | 6/6 | 33,747 characters |
| H.R. 1240 | 8/8 | 1/1 | 11,751 characters |
