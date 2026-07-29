# Day 1 Engineering Decisions

## Status

Accepted for the seven-day MVP. Revisit only if a decision blocks a P0 acceptance criterion.

## Stack

| Concern | Day 1 choice | Reason |
|---|---|---|
| Runtime | Node.js 22+ | Available locally; built-in TypeScript type stripping and test runner |
| Language | TypeScript | Stable domain contracts without adding a build tool |
| HTTP | `node:http` | Zero dependency and sufficient for one-page MVP |
| UI | Static HTML/CSS/JS | Fastest path to an inspectable bill report |
| Contracts | JSON Schema 2020-12 + TypeScript types | Machine-readable boundary independent of model/provider |
| Tests | `node:test` | No framework installation or configuration |
| Persistence | Files in Day 1; SQLite planned for Day 2/3 | Avoid selecting an ORM before ingestion shapes are observed |
| Retrieval | Structure and lexical filters first | A single bill does not require a vector database |
| Deployment | Deferred until core grounding passes | Local demo is sufficient for the first acceptance gate |

## Architecture boundaries

```text
HTTP/UI
  -> application service (Day 2+)
  -> Congress.gov adapter
  -> source snapshot store
  -> structured legal nodes
  -> rubric analyzers
  -> deterministic citation verifier
```

Rules:

1. Provider-specific API shapes stop at adapters.
2. Every analysis run binds to one `bill_id`, `version_code`, and source hash.
3. Model output must conform to JSON Schema before entering the report.
4. A deterministic verifier, not a model assertion, sets `citation.verified`.
5. A missing API key degrades readiness but does not crash the process.
6. The application may later move to a framework without changing domain contracts.

## Frozen Day 1 product constraints

- Federal bills only.
- One explicit text version per run.
- Five UI lenses mapped to eight internal rubric dimensions.
- No overall score.
- No legislative drafting or passage prediction.
- No open-web retrieval in the automatic pipeline.
- No full U.S. Code ingestion during the first week.
- Oversized omnibus measures are refusal tests, not normal success cases.

## Environment contract

| Variable | Required | Secret | Default |
|---|---|---|---|
| `CONGRESS_API_KEY` | Day 2 ingestion | yes | none |
| `PORT` | no | no | `3000` |
| `HOST` | no | no | `127.0.0.1` |
| `NODE_ENV` | no | no | `development` |

Future model credentials must follow the same server-only rule and must not be returned by `/api/readiness`.

## Day 2 entry criteria

- `npm run check` passes.
- `npm test` passes.
- Local UI and health endpoints respond.
- Ten evaluation cases have stable bill/version identifiers.
- A team member provides `CONGRESS_API_KEY` locally.
