# Handoff: replacing ATTOM, Smarty and Lob

Updated November 6, 2026 (UTC). Live status is on the coordinator's board, outside Git.

## State

- **ATTOM's free trial ended November 4.** Its key comes out of production and staging, every copy is purged and the
  founder signs the affidavit by about November 18 (WP0; [cost-and-rights.md](cost-and-rights.md#5-attom-free-trial)).
  Until a county goes live on the record, its screens show labeled partial results and household entries.
- **This package** is PR WangPantopus/skinny-pantopus#3418, squash-merged on the founder's OK. It holds everything from
  PR #3433, which is closed as superseded. No app code, no migration, no purchase, no hosted change.
- **Decisions:** the founder answered "all recommended" on November 6 ([decisions.md](decisions.md)).
- **Private storage (P1) exists:** bucket `pantopus-property-index` in us-west-2, public access blocked; GitHub Actions
  writes through the `master`-only environment `property-index`; the reader key can read only under `index/`.
- **WP1 is done:** #3439, #3445, #3446 and #3447 merged.
- **Running:** a build coordinator session holds the board; WP2, WP3 with WP4, WP5 and WP13 have builder sessions, at most
  three building at once. Each sends the founder a plain-words plan first.

## Verified, and not

- Verified by reading master `ffd28e60a1`: every vendor call site and consumer in [current-system.md](current-system.md).
- Verified at the source on November 5: Google's `validateAddress` field reference and its non-EEA service terms;
  ATTOM's published trial terms.
- Verified November 6: the bucket refuses anonymous reads, and the reader key can list but not write.
- Not verified: hosted contents beyond production's copy counts, live vendor answers, license terms for each free county
  source, physical phones, live mail.

## Waiting on the founder

1. ATTOM: take the key out of the servers, run the purge, confirm the end date, sign the affidavit.
2. The plans each builder sends, and D6-D12 and P2-P5 as packages reach them.
3. Google's CASS billing SKU and the production key; Lob's live key and return address.

## Next steps for whoever continues

1. Read the coordinator's board in the shared notes folder and check PR, CI and queue state.
2. Follow [build-plan.md](build-plan.md)'s rules and verification recipe. Wave 2 (WP5 first; then WP6-WP9) and wave 3 (WP10,
   WP11, WP12) follow; the retirements run with the founder after their gates pass.
3. Research still open (no founder action): license terms per free source before each connector; one-home lookups on
   county sites (terms and bot blocks by platform); a per-state inventory of statewide files.

## Note on personal data

Earlier commits on this package's branch contained two Chicago unit addresses, a Cook County parcel number, a Clark County
parcel number and listing-site links to those units; the merged files don't. The squash merge keeps them off master. The
branch is deleted; the PR's Commits tab still shows them unless GitHub support purges it, which is the founder's call.
