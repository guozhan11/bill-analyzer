# Known Limitations

This v0.1 build is a controlled research demo, not a production legal-research system.

## Evidence and analysis

- The critique engine is deterministic and lexical. It is not yet an LLM or RAG model and can miss provisions or select merely relevant-looking text.
- Congress.gov bill text, metadata, subjects, and version-matched CRS summaries are loaded. U.S. Code, CFR, CBO estimates, GAO reports, committee reports, and empirical research are not automatically retrieved.
- Real-world effectiveness, net fiscal impact, legal validity, distributional incidence, and constitutional questions therefore remain `Unknown` or low-confidence issue spotting.
- A verified quote proves that the quoted words occur at the stated normalized-text location. It does not by itself prove that the adjacent interpretation is legally or empirically correct.
- Structural `Present` results are lexical evidence candidates. `Unknown` does not mean absent, and the engine does not automatically issue `Absent` findings.

## Coverage

- Only U.S. federal H.R., S., H.J.Res., and S.J.Res. measures are accepted.
- The structure parser is optimized for Congress.gov formatted XML. Non-XML versions are snapshotted but do not receive hierarchical parsing.
- Bills with multiple top-level divisions require division selection. Title-level or arbitrary section-range scoping is not yet supported.
- Version comparison, enacted-law consolidation, current-law retrieval, and section-level diff are not implemented.

## Product and operations

- There are no accounts, permissions, saved report library, collaboration features, or durable analysis-run database.
- The local server has no authentication, rate limiting, TLS termination, or production hardening. Do not expose it directly to the public internet.
- The Congress.gov API key remains server-side and `.env` is ignored, but operators remain responsible for secret handling and access control.
- Automated gates passed, but independent human review for locator accuracy, structural recall/precision, unsupported claims, usefulness, and balance is still pending. Release status remains Conditional Go.
