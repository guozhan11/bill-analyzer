# Evaluation Set Registry Notes

The machine-readable registry is [evaluation/cases.json](../evaluation/cases.json). It was frozen on 2026-07-29 and uses only introduced versions from the 118th Congress.

## Why these ten

| Partition | Bill | Primary test |
|---|---|---|
| Development | H.R. 5551, BIG WIRES Act | Abundance, transmission planning, Federal Power Act amendment |
| Development | H.R. 5378, Lower Costs, More Transparency Act | Multi-agency duties, privacy, penalties, CBO provenance |
| Development | H.R. 1240, Winnebago Land Transfer Act | Narrow scope, N/A behavior, version identity, CBO provenance |
| Validation | H.R. 6655, A Stronger Workforce for America Act | Dense amendments, grants, metrics and evaluation |
| Validation | H.R. 3238, Affordable Housing Credit Improvement Act | Housing supply inference and tax-policy evidence gaps |
| Validation | S. 686, RESTRICT Act | Executive discretion, review, penalties and civil liberties |
| Validation | H.R. 7521, Foreign Adversary Controlled Applications | Named entities, divestiture, speech/due-process issue spotting |
| Validation | H.R. 15, Equality Act | Civil-rights mechanisms and normative transparency |
| Holdout | H.R. 3019, Federal Prison Oversight Act | Unseen normal case, oversight and appropriation dependency |
| Holdout | H.R. 1, Lower Energy Costs Act | Oversized input refusal or division-selection behavior |

## Balance audit

- Chambers: 9 House, 1 Senate. This reflects the one-week parser focus; Senate parsing still has a dedicated case.
- Sponsor party (audit only): 4 Democratic, 6 Republican. Several measures have bipartisan support, but party is never supplied to analysis prompts.
- Policy domains: energy, health, Indigenous affairs, workforce, housing/tax, technology/national security, civil rights, and corrections oversight.
- Mechanisms: standards, disclosure, penalties, grants, tax credits, land transfer, inspections, executive review and permitting reform.
- Expected CBO cases: H.R. 5378, H.R. 1240, H.R. 6655 and H.R. 1. The exact estimate-to-version match must be verified during ingestion.

## Source verification notes

- Congress.gov lists four text versions and one CBO estimate for [H.R. 6655](https://www.congress.gov/bill/118th-congress/house-bill/6655/all-info).
- Congress.gov lists two CBO estimates and seven text versions for [H.R. 1240](https://www.congress.gov/bill/118th-congress/house-bill/1240/all-info).
- Congress.gov lists two CBO estimates, two text versions, five committees and extensive amendments for [H.R. 1](https://www.congress.gov/bill/118th-congress/house-bill/1/summary/00).
- The introduced [BIG WIRES Act text](https://www.congress.gov/bill/118th-congress/house-bill/5551/text) contains findings and amends the Federal Power Act. Its summaries endpoint currently returns no CRS summary, making it the missing-summary development case.
- The introduced [RESTRICT Act](https://www.congress.gov/bill/118th-congress/senate-bill/686) has one text version and a CRS summary describing review authority and penalties.
- The [Federal Prison Oversight Act](https://www.congress.gov/bill/118th-congress/house-bill/3019/all-info) later became law, making it useful for detecting introduced/enacted version leakage.

`expectedSources` is an ingestion expectation, not a truth assertion about applicability to the introduced version. Day 2 must record the date and legislative version covered by each external document before using it.
