# Bill Critique MVP

An evidence-grounded critique tool for a specific version of a United States federal bill.

The seven-day MVP focuses on structure-aware bill parsing, transparent policy lenses, verifiable citations, and calibrated uncertainty. It does not draft legislation, predict passage, or assign an overall score.

## Current status: v0.1 MVP complete — Conditional Go

- Product boundary and acceptance criteria are frozen in [PRODUCT_SPEC.md](./PRODUCT_SPEC.md).
- The analysis method is defined in [CRITIQUE_RUBRIC.md](./CRITIQUE_RUBRIC.md).
- Sources and provenance are defined in [DATA_SOURCES.md](./DATA_SOURCES.md).
- The ten-case evaluation set is registered in [evaluation/cases.json](./evaluation/cases.json).
- JSON Schemas define source snapshots, legal nodes, findings and analysis runs in [schemas](./schemas), with a synthetic example in [fixtures](./fixtures).
- A dependency-free Node.js service and static interface are runnable locally.
- Congress.gov bill detail, text versions, CRS summaries and subjects are retrieved through a server-only adapter.
- A selected text version is downloaded with XML preferred, normalized, hashed and saved as an immutable snapshot under `.data/`.
- The browser can fetch a bill, switch versions, inspect source hashes and preview normalized text.
- Formatted XML is parsed into a citation-aware section/subsection/paragraph hierarchy, including quoted statutory text.
- Deterministic signals identify definitions, amendatory instructions, agencies, policy instruments, deadlines, funding, enforcement, reporting and cross-references.
- The API and browser show a bill map and a conservative structural checklist; a missing signal remains `Unknown` rather than being mislabeled `Absent`.
- An applicability gate maps the eight internal rubric dimensions into five default user-facing lenses.
- A deterministic evidence engine emits schema-checked findings with assessment, claim type, verified bill citations, reasoning, a good-faith counterargument, confidence and an explicit evidence gap.
- Real-world effectiveness, net cost, legal validity and distributional incidence remain `Unknown` until authoritative external sources are loaded; no model-generated number or unsupported empirical claim is permitted.
- A publication-time citation audit validates snapshot identity, node identity, locator, source URL, character bounds and exact quote matching.
- The single-page UI exposes verified quotes and provenance, and supports copying or downloading a complete reproducible Markdown report.
- A ten-case evaluation harness records automated metrics and keeps human-only quality gates explicit.
- Multi-division bills are withheld from whole-bill critique until the user selects a division; H.R. 1 is the frozen degraded-mode case.
- Rubric, parser, prompt and engine versions are frozen for the evaluated MVP build.
- Three fixed demo stories and a repeatable acceptance command cover normal, large amendatory, and scoped omnibus behavior.
- The build is ready for a controlled local demo; independent human quality gates remain required before public release.

## Requirements

- Node.js 22 or later
- A Congress.gov API key for ingestion work beginning on Day 2

No package installation is required for the Day 1 skeleton.

## Run locally

```bash
cp .env.example .env
npm run check
npm test
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The service starts without an API key, but `/api/readiness` reports that Congress.gov ingestion is not ready until `CONGRESS_API_KEY` is supplied.

Node does not load `.env` automatically in this zero-dependency skeleton. For Day 1, either export the variables in the shell or run with Node's env-file flag:

```bash
node --env-file=.env --experimental-strip-types src/server.ts
```

Run the frozen evaluation set against a running local service:

```bash
npm run evaluate -- --base-url http://127.0.0.1:3000
```

The command saves responses and generated metrics under `.data/`; reviewed Day 6 results are frozen under `evaluation/`.

Run final controlled-demo acceptance:

```bash
npm run acceptance -- --base-url http://127.0.0.1:3000
```

## API skeleton

- `GET /api/health` — process health
- `GET /api/readiness` — non-secret configuration readiness
- `GET /api/contracts` — available JSON Schema URLs
- `GET /schemas/:name` — raw JSON Schema
- `POST /api/bills/ingest` — resolve, retrieve and snapshot a bill version

Example request:

```bash
curl -X POST \
  -H 'content-type: application/json' \
  --data '{"input":"https://www.congress.gov/bill/118th-congress/house-bill/5551"}' \
  http://127.0.0.1:3000/api/bills/ingest
```

An optional `versionCode` such as `ih`, `is` or `eh` selects a specific available text. When omitted, the adapter prefers the introduced version.

For a multi-division bill, the first response returns `scope.status: "required"` and scope options. Submit one option's node ID as `scopeNodeId` to generate a division-bound critique.

## Repository map

```text
public/                 static MVP interface
src/config.ts           environment configuration
src/domain/             bill identity, domain contracts and USLM parser
src/adapters/           Congress.gov API boundary
src/services/           ingestion, bill-map extraction and critique pipeline
src/storage/            immutable source snapshots
src/server.ts           zero-dependency HTTP service
schemas/                versioned JSON Schema contracts
evaluation/cases.json   ten fixed evaluation cases
scripts/check.ts        deterministic repository checks
scripts/evaluate.ts     frozen-set evaluation metrics
scripts/acceptance.ts   three-story controlled-demo acceptance
test/                   Node test runner tests
docs/                   implementation decisions
```

## Security

Never commit `.env` or an API key. The UI and readiness endpoint expose only whether a key is configured, never its value.

See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) and [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) before any deployment or user study.
