# Handoff: replacing ATTOM, Smarty and Lob

Updated November 11, 2026 (UTC). Live status is on the coordinator's board, outside Git.

## State

- **ATTOM's status and agreement** are kept in the founder's private notes, outside this public repository. A county moves onto its record only when
  its gates pass and the founder says so.
- **This package** is PR WangPantopus/skinny-pantopus#3418, squash-merged on the founder's OK. It holds everything from
  PR #3433, which is closed as superseded. No app code, no migration, no purchase, no hosted change.
- **Decisions:** the founder answered "all recommended" on November 6 ([decisions.md](decisions.md)).
- **November 7:** 18 built PRs landed together in #3585. New counties wait until Clark County is proven live. Value
  estimates show everywhere we can, with wider ranges where we're less sure (D9), switched off until the founder turns
  them on.
- **Private storage (P1) exists:** bucket `pantopus-property-index` in us-west-2, public access blocked; GitHub Actions
  writes through the `master`-only environment `property-index`; the reader key can read only under `index/`.
- **November 8:** the build paused. 69 counties are live (16.0M homes); 741 counties are in storage (50.2M homes).
- **November 11:** the founder raised the bar to every row of Property details for every address, research and plan
  first. [full-page-plan.md](full-page-plan.md) measures every row across storage and proposes WP17-WP25; decisions
  D13-D17 and P6 are open. Nothing in it has started.
- **WP1 is done:** #3439, #3445, #3446 and #3447 merged.
- **Running:** nothing since the pause. WP2-WP5, WP7-WP9 and WP11-WP13 are built; WP10 (county connectors) and WP6
  (address registry) have handoffs to resume from. Live status is on the board, outside Git.

## Verified, and not

- Verified by reading master `ffd28e60a1`: every vendor call site and consumer in [current-system.md](current-system.md).
- Verified at the source on November 5: Google's `validateAddress` field reference and its non-EEA service terms.
- Verified November 6: the bucket refuses anonymous reads, and the reader key can list but not write.
- Not verified: hosted contents, live vendor answers, license terms for each free county
  source, physical phones, live mail.

## Waiting on the founder

1. ATTOM: the steps are on the founder's private list, outside Git.
2. The plans each builder sends, and D6-D17 and P2-P6 as packages reach them.
3. The steps in [full-page-plan.md](full-page-plan.md#8-waiting-on-the-founder): the Texas publish, switches, letters,
   small purchases and hand checks.
4. Google's CASS billing SKU and the production key; Lob's live key and return address.

## Next steps for whoever continues

1. Read the coordinator's board in the shared notes folder and check PR, CI and queue state. Read
   [full-page-plan.md](full-page-plan.md) for what is proposed next; start none of it without the founder's yes.
2. Follow [build-plan.md](build-plan.md)'s rules and verification recipe. Wave 2 (WP5 first; then WP6-WP9) and wave 3 (WP10,
   WP11, WP12) follow; the retirements run with the founder after their gates pass.
3. Research done November 7: one-home lookups on county sites ([lookup-sites.md](lookup-sites.md), a recommendation for
   the founder's D2 yes or no), a per-state inventory of statewide files ([statewide-inventory.md](statewide-inventory.md))
   and every other route ([other-routes.md](other-routes.md)). Still open: license terms per free source before each
   connector.

## Note on personal data

Earlier commits on this package's branch contained two Chicago unit addresses, a Cook County parcel number, a Clark County
parcel number and listing-site links to those units; the merged files don't. The squash merge keeps them off master. The
branch is deleted; the PR's Commits tab still shows them unless GitHub support purges it, which is the founder's call.
