# Public Deployment

The public application uses two independently deployable surfaces:

```text
GitHub Pages (static interface)
  -> Cloudflare Worker (API, CORS, rate limiting)
     -> Congress.gov API
     -> Cloudflare R2 (immutable source snapshots)
```

## Live endpoints

- Frontend: `https://guozhan11.github.io/bill-analyzer/`
- API: `https://bill-analyzer-api.psc-docket-helper.workers.dev`
- Health: `https://bill-analyzer-api.psc-docket-helper.workers.dev/api/health`

## Cloudflare setup

Install dependencies, create the R2 bucket once, and store the Congress.gov key as a Worker secret:

```bash
npm install
npx wrangler r2 bucket create bill-analyzer-snapshots
npx wrangler secret put CONGRESS_API_KEY
```

Never put the Congress.gov key in `wrangler.jsonc`, `public/config.js`, a GitHub Actions variable, or committed source.

Validate and deploy the API:

```bash
npm run typecheck
npm test
npm run worker:check
npm run worker:deploy
```

The Worker configuration includes:

- an R2 binding named `SNAPSHOTS`;
- a rate limiter named `INGEST_RATE_LIMITER`;
- an allowlist containing the GitHub Pages origin and local development origins;
- structured Workers logs.

If the GitHub owner, Pages domain, or custom domain changes, update `ALLOWED_ORIGINS` in `wrangler.jsonc` and redeploy. Origins never include a path such as `/bill-analyzer`.

## GitHub Pages setup

The frontend API endpoint is selected in `public/config.js`. Localhost continues to use the local Node service; other hosts use the deployed Worker.

The workflow at `.github/workflows/pages.yml` publishes `public/` whenever relevant files change on `main`. In the repository settings, set Pages source to **GitHub Actions**. The workflow needs only the standard `pages: write` and `id-token: write` permissions; it receives no Congress.gov secret.

## Verification

After deployment:

1. Open the health endpoint and confirm `status: ok`.
2. Open the GitHub Pages URL and confirm the badge says `Congress.gov ready`.
3. Run H.R. 5551 and confirm 10 findings and 20 verified citations.
4. Run H.R. 1 and confirm the whole-bill scope gate appears before division analysis.

The site remains a research demo. Public availability does not change the human-review gates or make the output legal advice.
