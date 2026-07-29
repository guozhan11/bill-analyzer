# Human Review Gate

Reviewers should not see sponsor party while scoring. For each non-degraded case, sample every textual fact and at least three inference/risk findings, then record:

- locator correct and quote supports the adjacent claim;
- required structural provisions found or missed;
- `Present`, `Unknown`, and `Not applicable` classifications justified;
- finding label: Useful, Obvious but correct, Misleading, Unsupported, or Duplicate;
- 1–4 scores for fidelity, evidence use, usefulness, balance, uncertainty, and lens discipline;
- severity for each defect using the S0–S3 taxonomy in `EVALUATION_PLAN.md`.

An unconditional Go requires M4 ≥ 95%, M6 ≥ 85%, M7 ≥ 90%, M8 ≤ 5%, useful findings ≥ 70%, misleading findings ≤ 5%, and no S0 blocker. Two reviewers should independently review the holdout cases and any failure case.
