# Day 2 Ingestion Report

## Outcome

Day 2 implements the first real vertical slice:

```text
Congress.gov URL or bill number
  -> normalized bill identity
  -> Congress.gov API detail/text/summaries/subjects
  -> explicit text-version selection
  -> XML-first document download
  -> content normalization and SHA-256
  -> immutable local source snapshots
  -> browser result view
```

## Public API

`POST /api/bills/ingest`

```json
{
  "input": "https://www.congress.gov/bill/118th-congress/house-bill/5378",
  "versionCode": "ih"
}
```

For short input, include Congress:

```json
{
  "input": "H.R. 5378",
  "congress": 118,
  "versionCode": "ih"
}
```

The response includes normalized metadata, all available text versions, the selected version, a version-matched CRS summary when one exists, legislative subjects, text preview, and public snapshot provenance.

## Provenance behavior

- The API key is appended only to upstream Congress.gov API requests.
- The key is not returned by readiness, ingestion or error responses.
- Upstream response URLs are defensively redacted before storage.
- A post-ingestion scan confirmed no configured API key occurs in `.data`.
- Metadata and selected bill text receive separate SHA-256 snapshots.
- Re-ingesting identical content reuses its original snapshot metadata and fetch timestamp.
- Raw, normalized and metadata files are kept together in a content-addressed directory.

## Version safety

- The default is `ih` or `is` when available, otherwise the first official version.
- An explicitly requested unavailable version returns `version_not_found`.
- CRS summaries are only attached when their legislative context matches the selected text version.
- Known Congress.gov naming differences are mapped explicitly, such as `EH` to `Passed House`.
- Other available summary contexts are listed but not silently attached.

## Verified cases

### H.R. 5551 — BIG WIRES Act

- Bill metadata: retrieved.
- Available text: `ih`.
- Preferred format: Formatted XML.
- Normalized text: 17,820 characters at verification time.
- CRS summary: correctly represented as unavailable.
- Metadata and text snapshots: written with separate hashes.

### H.R. 5378 — Lower Costs, More Transparency Act

- Available texts: `eh`, `ih`.
- Default selected text: `ih`.
- Introduced CRS summary: correctly matched to `ih`.
- Normalized introduced text: 227,622 characters at verification time.
- Switching to `eh` was used to verify version-selection behavior and the `Passed House` summary mapping.

Counts are observations from the frozen snapshots, not permanent claims about active upstream records.

## Deferred to Day 3

- USLM/XML hierarchy parsing into legal nodes;
- section/subsection citations and character offsets;
- definitions and amendatory-instruction classification;
- structural completeness extraction;
- oversized bill thresholds and division selection.
