# Day 7 — Acceptance and MVP Wrap-up

## Delivered

- A controlled-demo acceptance script covering a normal bill, a large amendatory bill with CRS context, and a multi-division scope-gate bill.
- Three one-click demo presets in the browser.
- CRS summary content in the Markdown report when it matches the selected version, plus explicit missing-summary behavior otherwise.
- Final demo guide, known-limitations register, release checklist, and stable v0.1 product wording.
- Final regression, repository-contract, evaluation, and browser checks.

## Acceptance result

The three-story controlled demo passed:

| Story | Result |
|---|---|
| H.R. 5551 IH | 10 findings, 20/20 verified citations, correct missing-summary behavior |
| H.R. 5378 IH | 11 findings, 22/22 verified citations, version-matched CRS summary included in report |
| H.R. 1 IH | whole-bill findings withheld; Division A produced 11 findings and 22/22 verified citations |

The full automated suite contains 23 passing tests. The frozen evaluation remains 9 complete plus 1 expected degraded, with 150/150 displayed citations valid and 40/40 textual facts cited.

## Release decision

**Conditional Go for a local or otherwise controlled demo.** Independent human quality gates remain incomplete, so this build is not approved for unsupervised public release or legal reliance.
