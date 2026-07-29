# Controlled Demo Guide

## Start

```bash
npm test
npm run check
npm start
```

Open `http://127.0.0.1:3000`. Keep the service local; this build is not hardened for public hosting.

## Demo 1 — Normal bill

Choose **H.R. 5551 · normal**.

Show the selected IH version, 102 parsed nodes, five lenses, expandable verified quotes, a 20/20 citation audit, and the explicit message that no matching CRS summary is available. Download the Markdown report.

## Demo 2 — Large amendatory bill

Choose **H.R. 5378 · large**.

Show 1,086 parsed nodes, definitions and amendatory text, the version-matched CRS summary, implementation/equity findings, and a 22/22 citation audit. Explain that a CRS summary is context, not a substitute for the selected bill text.

## Demo 3 — Safe scope gate

Choose **H.R. 1 · scoped**.

The whole-bill run should publish zero findings and require one of three divisions. Select Division A and click **Analyze division**. Confirm that the scope appears in the status message and Markdown report, then show the 22/22 scoped citation audit.

## Acceptance command

With the local service running:

```bash
npm run acceptance -- --base-url http://127.0.0.1:3000
```

The command verifies all three stories, report disclaimers, proposal-status language, CRS behavior, citation gates, scope withholding, and scoped-report identity.
