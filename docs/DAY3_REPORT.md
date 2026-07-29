# Day 3 — Structure Parsing and Bill Map

## Delivered

- A dependency-free XML tokenizer and hierarchy parser for Congress.gov formatted bill XML.
- Legal nodes for division, title, subtitle, section, subsection, paragraph, subparagraph, clause, subclause and list structures.
- Stable node IDs, parent relationships, depth, source snapshot binding, normalized-text offsets and human-readable citations.
- Recognition of definitions, amendatory instructions and provisions nested inside quoted statutory text.
- A deterministic bill map covering purpose, affected entities, implementers, instruments, deadlines, funding, enforcement, reporting, definitions and amendments/cross-references.
- A nine-item structural checklist with cited evidence. A nondetection is reported as `Unknown`; this stage does not infer that a provision is legally required or truly absent.
- Day 3 API output and UI panels for checklist, bill map, and section-aware outline.

## Validation

Unit fixtures cover nested sections, definitions, deadlines, amendatory instructions, quoted statutory text, exact offset alignment and conservative `Unknown` behavior. The three frozen development bills were also checked against real Congress.gov introduced-version XML:

| Bill | Shape | Parsed nodes | Alignment warnings | Notable signals |
|---|---:|---:|---:|---|
| H.R. 5551 | medium | 102 | 0 | nested Federal Power Act amendment, 7 definition nodes, deadlines |
| H.R. 5378 | large | 1,086 | 0 | four titles, 55 amendatory nodes, funding, penalties and reporting |
| H.R. 1240 | small | 9 | 0 | land-in-trust mechanism and covered Tribe; most other components correctly remain `Unknown` |

## Known limits

- The parser targets Congress.gov bill XML conventions, not every possible USLM or legacy XML variant.
- Signal extraction is high-recall lexical classification, not a legal conclusion. Evidence cards are candidates for human review and the Day 4 critique pipeline.
- `Absent`, `Partial`, and `Not applicable` require contextual analysis and are intentionally not assigned by this deterministic stage.
- Non-XML text versions can still be snapshotted, but do not receive a hierarchical parse.
