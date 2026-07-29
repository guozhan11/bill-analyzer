# Day 6 Automated Evaluation

Decision: **Conditional Go pending human review**

## Automated metrics

| Metric | Result |
|---|---:|
| M1 input resolution | 10/10 |
| M2 source integrity | 10/10 |
| M3 citation validity | 150/150 |
| M5 textual-fact citation coverage | 40/40 |
| M9 end to end | 9 complete + 1 expected degraded / 10 |
| M10 latency | P50 426 ms; P95 815 ms |

All ten cases used their frozen introduced-version code. The nine normal cases produced reports, all 150 displayed bill quotes passed the publication audit, every one of 40 textual facts had a bill citation, and all parsers reported zero alignment warnings. H.R. 1 correctly withheld whole-bill findings because it contains three top-level divisions; selecting Division A subsequently produced 11 findings with 22/22 verified citations.

## Case summary

| Case | Set | Outcome | Nodes | Findings | Citations | Warnings |
|---|---|---|---:|---:|---:|---:|
| H.R. 5551 IH | development | complete | 102 | 10 | 20/20 | 0 |
| H.R. 5378 IH | development | complete | 1,086 | 11 | 22/22 | 0 |
| H.R. 1240 IH | development | complete | 9 | 4 | 8/8 | 0 |
| H.R. 6655 IH | validation | complete | 2,049 | 11 | 22/22 | 0 |
| H.R. 3238 IH | validation | complete | 242 | 11 | 20/20 | 0 |
| S. 686 IS | validation | complete | 312 | 10 | 19/19 | 0 |
| H.R. 7521 IH | validation | complete | 65 | 5 | 6/6 | 0 |
| H.R. 15 IH | validation | complete | 155 | 10 | 19/19 | 0 |
| H.R. 3019 IH | holdout | complete | 159 | 8 | 14/14 | 0 |
| H.R. 1 IH | holdout | expected degraded | 1,055 | 0 | 0/0 | 0 |

## Why this is not an unconditional Go

M4 locator accuracy, M6 structural recall, M7 structural precision, M8 unsupported-material-claim rate, and usefulness/balance scoring require human judgment or reviewed gold annotations. Automated success cannot substitute for those gates. The current build is suitable for a controlled research demo, not an unsupervised public policy product.
