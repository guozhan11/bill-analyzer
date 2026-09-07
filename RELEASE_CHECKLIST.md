# v0.1 Release Checklist

## Technical gates

- [x] Bill identity and explicit text version are preserved.
- [x] Source snapshots are content-addressed and keep provenance.
- [x] Section-aware XML parsing passes the frozen ten-case set with zero alignment warnings.
- [x] Textual facts require citations.
- [x] Displayed quotes pass the publication-time snapshot audit.
- [x] Five lenses distinguish fact, inference, risk, confidence, counterargument, and evidence gap.
- [x] Markdown export includes scope, sources, versions, limitations, and reproducibility metadata.
- [x] Multi-division measures require a narrower scope.
- [x] Automated tests, repository checks, ten-case evaluation, and three-story demo acceptance pass.
- [x] `.env` and cached source data are excluded from version control.

## Release boundary

- [x] Local controlled demo is ready.
- [ ] Independent locator review meets M4 ≥ 95%.
- [ ] Reviewed gold annotations establish M6 ≥ 85% structural recall.
- [ ] Human review establishes M7 ≥ 90% structural precision.
- [ ] Human review establishes M8 ≤ 5% unsupported material claims.
- [ ] At least 70% of material findings are rated useful and no S0 blocker exists.
- [x] Public deployment configuration, basic rate limiting, TLS and Worker logs are enabled.
- [ ] Authentication, user-level abuse controls and operational alerting are added before promoting the demo as a production service.

Current decision: **Conditional Go for a controlled demo; not approved for unsupervised public release.**
