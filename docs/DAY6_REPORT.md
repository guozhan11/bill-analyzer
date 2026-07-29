# Day 6 — Evaluation, Scope Gate, and Version Freeze

## Delivered

- A reusable `npm run evaluate -- --responses <dir> --output <dir>` harness computes the automatable MVP metrics, case outcomes, latency, leakage checks, and automated blockers.
- Rubric, parser, prompt, scope-gate prompt, engine, and schema versions are frozen in `evaluation/frozen-versions.json`.
- All ten frozen evaluation cases were run, including the two previously untouched holdouts.
- Multi-division bills now require an explicit division scope. The API and browser expose scope options and support rerunning the critique for the selected division.
- The browser was validated end to end on H.R. 1: whole-bill findings were withheld, Division A was selected, and the scoped run produced 11 findings with 22/22 verified citations.
- A human-review protocol records the gates that cannot be automated honestly.

## Result

Automated gates passed with no blocker: M1 10/10, M2 10/10, M3 150/150, M5 40/40, M9 9 complete plus 1 expected degraded, and zero parser-alignment warnings. Measured local latency was P50 426 ms and P95 815 ms after snapshot reuse.

The release decision is **Conditional Go pending human review**. See `evaluation/day6-report.md` for the complete rationale.
