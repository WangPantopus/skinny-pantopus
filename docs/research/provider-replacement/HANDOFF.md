# Handoff: replacing ATTOM, Smarty and Lob

Updated November 5, 2026 (late evening, Pacific).

## State

- Branch `claude/replace-attom-lob-smarty-73fcb9`, draft PR WangPantopus/skinny-pantopus#3418 (based on master
  `1c5ddb658c`; code references re-checked on master `ffd28e60a1`). Documentation and research scripts only: no app
  code, no migration, no purchase, no hosted change.
- **Ready:** one merged package in `docs/research/provider-replacement/` ([README.md](README.md)): decisions,
  current system, sourcing (with the county survey, the 46-field test and the unit-facts note), architecture,
  experience and gates, parity and acceptance, the build plan (WP0-WP16), cost and rights. Everything good from PR #3433
  (its documents, evidence CSVs, `verify.py` and studies) is in it, merged with #3418's work; its 2-line link in
  `docs/provider-data-persistence-2026-11-01.md` is applied. All seven accepted corrections are applied, and superseded
  statements are removed or listed in [decisions.md](decisions.md#superseded-statements).
- **Reproducible:** `python3 -I docs/research/provider-replacement/evidence/verify.py` passes; the survey's
  `county-survey/tools/estimate.py` gives 55.7% (51.5-60.5%) and 23.2% (21.1-26.7%) after the Dallas correction.

## Verified, and not

- Verified by reading master `ffd28e60a1`: every vendor call site and consumer in [current-system.md](current-system.md),
  including the app-side `source` allowlists, the `D`/`N1` and blank-DPV path to OK, the Google adapter's dropped and
  misnamed fields, ignored returned postcards and the Block Founders retry gap.
- Verified at the source on November 5: Google's `validateAddress` field reference and its non-EEA service terms
  (modified October 28, 2026: 30-day caching, coordinates deleted after 30 days, no made-up addresses); ATTOM's
  published trial terms (internal evaluation, no database, 24 hours, 90 days, purge and affidavit).
- Not verified: hosted contents (how many vendor copies production keeps), which keys exist where, the ATTOM trial's
  start date, any Smarty agreement, live vendor answers, license terms for each free county source, physical phones,
  live mail.

## Waiting on the founder

In the order the build needs them ([decisions.md](decisions.md#open-decisions)):
1. **D3 and the trial dates:** stop the operator prefill; ask ATTOM in writing whether today's use is allowed (or
   shorten copies to 24 hours); the trial's end date, which starts the purge-and-affidavit clock.
2. **D1 with D1a, D1b, D1c:** the postal adapter (Smarty out) and its three rule choices.
3. **P1:** a private storage account for index releases and truth sets.
4. **D2:** how to fill counties without free data (recommended: households and labeled estimates; price records
   requests for the 20 largest uncovered counties, research only).
5. **D5:** Lob kept per piece with a second printer, or retired after a real-mail pilot.
6. Founder-only facts: Smarty account or agreement; Google's CASS billing SKU and the production key; Lob's live key and
   return address.

## Running elsewhere

- Session `make-attom-lookups-non-b` (started by the founder): draft PR #3439, ATTOM lookups that never hold a screen,
  then the Add Home PRs on web, iOS and Android. It is WP1 in the build plan; its patterns carry into the replacement.
- PR #3433 (Codex) is still open. Everything in it is in this package; closing it is the founder's call.

## Next steps for whoever continues

1. Check #3418's state and CI, `git fetch`, and the founder's answers to the decisions above.
2. Before any build: send the founder a plain-words plan for the chosen work package (what people see on web, iOS and
   Android; what stays the same; the decisions it needs) and wait for the OK.
3. Start where nothing blocks: WP0 (with the founder), WP2 (app readiness, no decision needed) and WP4 (truth sets);
   WP3 once D1 is decided; WP5 once P1 exists. Follow [build-plan.md](build-plan.md)'s rules and verification recipe.
4. Research still open (no founder action): license terms per free source before each connector; Cobb GA's FTP file;
   Medina OH's file; a per-state inventory of statewide files; pricing public-records requests if D2 says so.

## Note on personal data

Earlier commits on this branch contain two Chicago unit addresses, a Cook County parcel number, a Clark County parcel
number and listing-site links to those units; the current files don't. A squash merge keeps them off master; the
branch's own history on GitHub still shows them. Rewriting that history is the founder's call.
