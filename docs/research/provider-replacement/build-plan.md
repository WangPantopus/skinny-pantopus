# Build plan

November 5, 2026; updated November 7 (see [decisions.md](decisions.md)). Wave 1 is running. Each work package (WP) can be picked up by one
builder, human or agent session, from this page and the documents it links. Founder direction governs the order:
**build everything behind flags, prove it, replace nothing until it is proven, then switch one vendor at a time.**

## Rules for every work package

1. **A plain-words plan to the founder first.** Before building, send what people will see on web, iOS and Android,
   what stays the same, and which decisions it needs; start only after the founder's OK.
2. **Change what exists.** Use the files named here; read them on current master first (lines below are as of
   `ffd28e60a1`). Keep screens' layouts, styling and navigation. No new tables, hosted storage or hosted configuration
   without the founder's yes (proposals P1-P5 in [decisions.md](decisions.md#proposals-that-need-a-yes)).
3. **Off by default.** Every switch defaults to today's behavior. Shadow first (log counts, change nothing), then live
   per scope after the founder's OK.
4. **One owner per PR, small PRs, a branch from master,** CI green, merged by the owner after a real-app check.
5. **Never** seed Pantopus's record from ATTOM, Smarty or Google output; never send made-up addresses to Google; keep
   real addresses, owner names, keys and vendor payloads out of Git, logs and chat.
6. **No new unit tests** (founder direction). Evaluation tools are scripts that print reports. If an intended change
   breaks an existing test, update or remove that test in the same PR.

## How every package is verified

- **A real local stack:** the backend against a local database (`supabase start`), never the founder's own running
  backend or simulator. Vendors are local stand-ins that return recorded answer shapes (Google, ATTOM, Lob), or Lob's
  test mode with a test key the founder provides.
- **Web** in a browser against the local backend; **iOS** in a simulator (a Release build must be launched with
  `PANTOPUS_API_ENV=local`, or it talks to production); **Android** in an emulator pointed at the local backend.
- **Persistence and the other view:** reload the web page and relaunch the apps; check a second account's view
  (owner and household member, owner and renter) wherever the change shows to more than one person.
- **Old builds:** install the build that is in the stores (or the previous release build) and use it against the new
  server.
- **Existing checks before pushing:** backend Jest and privacy gates, web lint, typecheck and Jest, iOS swiftlint and
  swiftformat, Android lint.
- **Name what wasn't verified:** hosted services, physical phones, live mail, live billing.

## Order and dependencies

```
WP0 rights register
WP1 non-blocking ATTOM (done)
WP2 app readiness ──────────────────────────────────────────────┐
WP4 truth sets ──► WP3 postal adapter ──► WP14 retire Smarty      │
P1 storage ──► WP5 index + first slice ──► WP6 address registry ──┼──► WP8 router + switching ──► WP15 retire ATTOM
                                       └─► WP7 statewide baseline ┤        ▲
                                           WP9 household facts ───┘        │
                                           WP10 county connectors ─────────┤
                                           WP11 unit floor plans ──────────┤
                                           WP12 values ────────────────────┘
WP13 mail fulfillment ──► WP16 Lob: keep per piece or retire
```

WP2, WP3 (with WP4) and WP13 touch different files and can run at the same time. WP5 waits on the storage account
(P1). Retirement packages (WP14-WP16) run only after their gates pass.

| WP | Name | Replaces | Size |
|---|---|---|---|
| WP0 | Rights register | — | S |
| WP1 | Non-blocking ATTOM lookups (done) | — | — |
| WP2 | App readiness: real source labels, new vocabulary | — | M |
| WP3 | Postal adapter: Smarty no longer needed | Smarty | M |
| WP4 | Truth sets and evaluation tools | — | M-L |
| WP5 | Property index foundation and the first vertical slice | ATTOM (first counties) | L-XL |
| WP6 | Address registry and identity, nationwide | Smarty unit lookup; Google coordinates | XL |
| WP7 | Statewide baseline and the labeled national floor | ATTOM | XL |
| WP8 | Source router, coverage report, county switching | ATTOM | M |
| WP9 | Household facts and corrections | — | L |
| WP10 | County connectors by measured demand | ATTOM | per connector |
| WP11 | Unit floor plans | — | L |
| WP12 | Values | ATTOM AVM and ZIP trend | M (L with an estimate) |
| WP13 | Mail fulfillment | Lob as a single point of failure | L |
| WP14 | Retire Smarty | Smarty | S |
| WP15 | Retire ATTOM | ATTOM | M |
| WP16 | Lob: keep per piece or retire | Lob (founder's choice) | S |

Sizes for one builder: S up to 3 days, M 1-2 weeks, L 3-5 weeks, XL 6 weeks or more. They are sizes, not dates.

---

## WP0. Rights register

- **Goal:** know what Pantopus may keep and show from every source.
- **What people see:** nothing.
- **Files:** [cost-and-rights.md](cost-and-rights.md) (the register); `backend/scripts/prefill-provider-cache.js` (not
  run again).
- **Switches:** none new.
- **Depends on:** the founder, for anything contractual.
- **Done when:** every source in use is in the register, with what it allows.
- **Size:** S.

## WP1. Non-blocking ATTOM lookups (done)

- **Done:** server #3439, web #3445, iOS #3446 and Android #3447 merged, November 5-6.
- **What it gives this plan:** the request pattern every later package reuses: answer at once from stored data;
  look up in the background; fill in through `sync:changed`; `?lookup=background` and `?lookup=check` on property
  suggestions; `status: stale` with `as_of`; "no record" remembered; old store builds unchanged.
- **Note:** with no ATTOM key its lookups don't start, so screens answer from what Pantopus holds.

## WP2. App readiness: real source labels and a new vocabulary

- **Goal:** apps in the stores can show any source correctly before any server switch.
- **What people see:** nothing while the server still answers from ATTOM; once it sends `provenance`, new builds show
  the publisher and date ("From Clark County Assessor's records, updated Oct 31, 2026") instead of "ATTOM".
- **Files:**
  - iOS: `Features/Homes/HomeIntelligenceValidation.swift` (8, 48: accept new source values when `provenance` is
    present); `Features/Homes/AddHome/AddHomeDetailsSection.swift` (231-246: header and line from the server);
    `AddHomeWizardViewModel.swift` (972-981: lookup messages from the server); `Core/Networking/Models/Homes/HomeDTOs.swift`
    (`hasAttomRecord` becomes "has a public record"); the Property details footer (already server-sent); the networking
    layer (a client header: platform and version).
  - Android: `ui/screens/homes/HomeIntelligenceValidation.kt` (18, 91); `add_home/AddHomeDetailsSection.kt` (260-290);
    `AddHomeWizardViewModel.kt` (1554-1557); `data/api/models/homes/HomeDtos.kt`; the OkHttp client (the same header).
  - Web: `app/(site)/(app)/app/homes/[id]/property-details/page.tsx` (317: drop the "via ATTOM" fallback);
    `app/(site)/(app)/app/homes/new/page.tsx`; `components/home/PropertyValueCard.tsx`;
    `components/place/detail/YourHomeDetail.tsx`; `@pantopus/api` (the header).
  - Server: `routes/home.js` property-suggestions (581), property-value (5509), property-details (1972) and the Place
    sections accept a vocabulary flag (as #3439's `?lookup=`) and add `provenance`; legacy fields unchanged.
- **Switches:** the vocabulary flag, sent only by new builds; old servers ignore it.
- **Data:** none.
- **Depends on:** nothing; can start now.
- **Done when:** new builds render provenance from a test server; the store builds render every card unchanged against
  the new server with and without the flag; no hard-coded "ATTOM" remains in new builds' copy.
- **Verify:** on all three apps: Add Home details (record found, not found, building only), Property details (owner and
  member), Place Your home (owner and renter), the value card; reload and relaunch; the store build against the same
  server.
- **Roll out:** with the next store releases; the server side is inert until a new build asks.
- **Roll back:** the server ignores the flag.
- **Risks:** store review time; old builds linger (the header measures them; D11).
- **Size:** M.

## WP3. Postal adapter: Smarty no longer needed (Phase 1)

- **Goal:** Add Home works with only a Google key, and postal decisions are right.
- **What people see:** one check instead of two (up to 2.5 s less); accurate unit messages; the outage path of D1a;
  the same refusals for undeliverable, PO box, mail-drop store, business and mixed use
  ([experience.md](experience.md#add-home-the-address-step)).
- **Files:**
  - `backend/services/addressValidation/googleProvider.js`: `_parseResponse` (121-157) reads `metadata.residential`,
    `business`, `poBox`; `_extractUspsData` (231-243) keeps `dpvFootnote`, tri-state `dpvVacant`/`dpvCmra`, `dpvNoStat`,
    `addressRecordType`, `carrierRoute`'s prefix, `postOfficeCity`/`postOfficeState`, `cassProcessed`, and stops reading
    the non-existent `carrierRouteType` and `postOfficeCityStateInfo`.
  - A mapping from Google's answer to the engine's postal input (the shape `smartyProvider.js` returns, 147-171, plus
    `unconfirmed_secondary`, `record_type`, `no_stat`), per [architecture.md](architecture.md#12-the-postal-adapter).
  - `pipelineService.js` (397-437): the postal source chosen by configuration; a shadow mode that logs Google's own
    counts per category (never scored against Smarty; see [decisions.md](decisions.md)).
  - `addressDecisionEngine.js`: rule 1 (205-220, 478-481) depends on the chosen postal source; `_isUndeliverable`
    (490-508) stops treating `D` as a confirmed default; `_evaluateMissingUnit` (580-) uses `D`, `N1`, `C1` for "unit
    required" and `S`/`CC` for "unit not confirmed" (D1c); `_computeConfidence` (1025-1048) gives no credit for `D` and
    never lets `S` or a blank DPV reach OK; PO boxes from `record_type` `P`, the PO-box flag or route `B` (518-523).
  - `routes/home.js` (855-1000): the D1a outage path.
  - `routes/addressValidation.js` (258, 319): the 0.8 auto-verify threshold stays; it can no longer be reached by `D`,
    `S` or blank.
  - `mailboxCheckService.js`: show when USPS was checked; re-check after 30 days.
  - `config/addressVerification.js`: the new switches; drop Smarty from the production-required keys (179-180) only in
    WP14.
  - A worker job that clears Google's USPS fields older than 30 days (D12).
- **Switches:** `ADDRESS_POSTAL_PROVIDER` (`smarty` default, `google`); `ADDRESS_POSTAL_SHADOW` (`google` logs
  counts only); `ADDRESS_OUTAGE_FINISH_UNVERIFIED` (D1a, off).
- **Data:** existing `HomeAddress` columns and `last_validated_at`; if a flag column can't hold "unknown", an additive
  migration through normal review.
- **Depends on:** D1, D1a, D1b, D1c; WP4's postal truth set and fixtures; a Google key in the local environment (the
  founder's).
- **Done when:** T1 and gate G5 pass ([parity-and-acceptance.md](parity-and-acceptance.md#t1-postal-truth-for-the-smarty-exit-gate-g5));
  G4's latency holds; the claim, create, unit re-check and Mailbox Check paths agree; all three apps behave as in
  [experience.md](experience.md).
- **Verify:** on all three apps against a local backend with a Google stand-in replaying recorded shapes: a house; an
  apartment with its unit, without it (`D`/`N1`) and with a wrong one (`S`); a blank DPV; a PO box; a mail-drop store; a
  business; mixed use; Google timing out and failing; then Add Home through to the postcard request; reload and
  relaunch mid-flow; Mailbox Check on the created Home; the address claim. Live Google calls only with real addresses.
- **Roll out:** shadow in staging (the founder's keys) → counts to the founder → `google` in staging → production when
  the founder adds the Google key.
- **Roll back:** `ADDRESS_POSTAL_PROVIDER=smarty` where a Smarty key exists; otherwise the previous release.
- **Risks:** Google leaves home-or-business unset often (D1b carries more weight); the CASS SKU's cost; more people see
  "check your unit" (measured in shadow).
- **Size:** M.

## WP4. Truth sets and evaluation tools

- **Goal:** the truth sets T1-T3 exist, and running them prints the reports the gates read (T4 and T5 later).
- **What people see:** nothing; no switches, nothing to roll out or back.
- **Files:** new scripts under `backend/scripts/eval/` (postal replay, identity check, field check) that print tables;
  the offline postal fixtures; the case lists themselves stay out of Git.
- **Data:** real addresses in private storage (P1) or on the evaluator's machine; only counts are published.
- **Depends on:** P1 for a shared copy; consenting people for T1's home addresses; redeemed and returned postcards.
- **Done when:** T1 has its category floors adjudicated (two reviewers on disagreements); the fixtures cover every
  code path in [parity-and-acceptance.md](parity-and-acceptance.md#t1-postal-truth-for-the-smarty-exit-gate-g5); T2's
  state floors exist for the first slice's states; reports are reproducible from the scripts.
- **Risks:** adjudication is manual; Google's no-made-up-addresses rule limits live testing to real addresses.
- **Size:** M-L, mostly part-time adjudication.

## WP5. Property index foundation and the first vertical slice

- **Goal:** the release format, the builder, private storage, the reader and the router skeleton, proven end to end on
  a first slice: the counties where Pantopus homes already are (Clark County WA first: its free weekly assessor file
  has bedrooms and baths), plus Dallas (condo interiors) and Florida's statewide roll (scale).
- **What people see** (where live): Add Home prefilled from the county at once; Property details and Place from the
  record with its publisher and date; condos with "Your unit" and "Building" groups.
- **Files:**
  - Builder: `scripts/property-index/` (like `scripts/places/build-index.cjs`); a workflow `property-index.yml` (like
    `places-index.yml`) that publishes to private storage with credentials the founder adds; job logs never print
    addresses.
  - Reader and lookup: `backend/services/propertyRecords/` (manifest, block reads, identity contract,
    [architecture.md](architecture.md#5-identity-contract)); `backend/config/propertyRecords.js`.
  - Wiring: `services/ai/propertyIntelligenceService.js` (a record-based profile beside the ATTOM one; the router picks
    per jurisdiction), `services/ai/propertySuggestionsService.js` (a record tier with per-field sources),
    `services/homeDetailService.js` (196-215) and `serializers/countyRecordSerializer.js` (a projector from the record
    with an allowlist of fields, each with its subject and purpose), `services/placeIntelligenceService.js` (969-1016),
    `routes/home.js` (1122, 1167: store `niche_data.property_record` at create).
- **Switches:** `PROPERTY_RECORDS_MANIFEST_URL`; `PROPERTY_RECORDS_SHADOW_JURISDICTIONS`;
  `PROPERTY_RECORDS_LIVE_JURISDICTIONS` (empty by default). A live jurisdiction never calls ATTOM.
- **Data:** P1; `Home.niche_data.property_record` (no migration).
- **Depends on:** P1; WP2 for new builds to show provenance; WP4's T3 sample for each slice county; each source's rights
  check.
- **Done when:** for each slice county: G1, G2 and G3 pass on its homes; T3's 50-home check passes; logs show zero ATTOM
  calls for live jurisdictions (including background and operator paths); G4's latency holds; the store builds still
  render.
- **Verify:** on all three apps: Add Home for a house, a condo with its unit, a rental tower (building only), an address
  with no record; Property details as owner and as member; Place as owner and as renter; the value card; reload and
  relaunch; the store build against the same server.
- **Roll out:** shadow (counts) → founder's OK per county → live → two weeks watched. With ATTOM gone, a county going
  live replaces partial results, not a working vendor.
- **Roll back:** remove the county from the live list; stored Home copies keep serving.
- **Risks:** release size and read latency; per-source terms; a public repository's job logs.
- **Size:** L-XL.

## WP6. Address registry and identity, nationwide

- **Goal:** every US address and unit with Pantopus IDs, lineage and Pantopus's own coordinates; the identity contract
  answering everywhere.
- **What people see:** Add Home and Place find the right unit or ask which one; map pins come from Pantopus's points.
- **Files:** `scripts/property-index/sources/address/` (NAD, OpenAddresses, Overture without OpenStreetMap-derived
  data, state and county points); a normalization library shared with the backend; `services/propertyRecords/identity`;
  a worker job replacing Google coordinates older than 30 days with registry coordinates (D12).
- **Switches:** `ADDRESS_REGISTRY_COORDINATES` (off).
- **Data:** releases in P1; `HomeAddress`'s existing coordinate columns.
- **Depends on:** WP5's format; each source's license check.
- **Done when:** T2 passes per state floor (G3); the coverage report is published per county; no Google coordinate is
  older than 30 days where the registry has a point.
- **Verify:** Add Home in each format cohort (unit designators, Puerto Rico urbanizaciones, rural routes, military) on
  all three apps; adjacent units resolve to different homes; an out-of-range unit asks again; the map pin and Place
  location after coordinates are replaced; reload and relaunch.
- **Roll out:** shadow per state (identity results logged as counts) → founder's OK → live per state.
- **Roll back:** per state, to the previous release or to off.
- **Risks:** ambiguity in dense cities (the contract asks rather than guesses); territories and tribal lands with thin
  sources; per-source licenses.
- **Size:** XL.

## WP7. Statewide baseline and the labeled national floor

- **Goal:** statewide connectors first (Florida, Massachusetts with Boston, New York, Connecticut, Maryland, New Jersey,
  Utah, Texas with the large appraisal districts' exports, Minnesota, North Carolina's parcel-derived share, West
  Virginia, Maine, Montana, Indiana by request), then national estimates (NSI, ACS) in their own labeled slot and FEMA
  footprints for the house outline.
- **What people see:** record facts in whole states; elsewhere an "Estimate" slot and one-tap questions instead of
  blanks.
- **Files:** `scripts/property-index/sources/` (one connector per state program), the field mappings, the projector's
  estimate slot.
- **Switches:** jurisdictions join the shadow and live lists of WP5.
- **Data:** releases in P1.
- **Depends on:** WP5; rights per state; D2 for how the national floor is shown.
- **Done when:** T3 passes per state connector; the coverage report shows fill by field, county and type; no estimate
  appears in a record field (checked in the projector and on screens).
- **Verify:** on all three apps, Property details and Place in a basics-only county (one-tap questions show), a county
  with bedrooms and baths, and a county with nothing (estimates labeled); Add Home in each.
- **Roll out:** state by state, shadow → founder's OK → live.
- **Roll back:** per state.
- **Risks:** statewide files lag their counties; mixed modeled and observed values (North Carolina); file sizes.
- **Size:** XL.

## WP8. Source router, coverage report and county switching

- **Goal:** the router serves every jurisdiction and field from configuration; switching a county is one change; the
  coverage report and the "ATTOM calls by county" measure run continuously.
- **What people see:** nothing directly; it decides which source each screen gets.
- **Files:** `backend/config/propertyRecords.js`; `services/propertyRecords/router`; release reports; existing metrics.
- **Switches:** the shadow and live jurisdiction lists, per field where needed.
- **Data:** release reports in P1; no tables.
- **Depends on:** WP5.
- **Done when:** a county moves between off, shadow and live without a deploy; ATTOM calls per county are reported
  daily; the report lists unanswered lookups by county (WP10's queue).
- **Verify:** switch a county live and back on a local stack and watch Add Home, Place and Property details follow on
  all three apps, with stored Home copies untouched.
- **Roll out / back:** configuration only.
- **Risks:** configuration drift between servers (read in one place, logged at start).
- **Size:** M.

## WP9. Household facts and corrections

- **Goal:** residents confirm or correct facts; one-tap questions fill what the record lacks; corrections sit beside the
  record by the precedence rules ([architecture.md](architecture.md#7-fact-precedence-field-by-field)).
- **What people see:** "Is this right?" per group in Property details; one-tap questions in Add Home; "From your
  household" with the county value underneath.
- **Files:** server: `niche_data.household_facts` (who and when per field), the Home update route (`PATCH /api/homes/:id`,
  `routes/home.js` 1993), the projector's precedence; web, iOS and Android: Add Home details and Property details.
- **Switches:** the new controls appear only when the server sends the fields they need (server-driven).
- **Data:** no migration to start (P2 only if review needs history).
- **Depends on:** WP5 (a record to correct); WP2 (new builds).
- **Done when:** G2 passes in basics-only counties; a correction survives reload, relaunch and a forced record refresh;
  the other member sees it; "Report a problem" reaches review without changing the display.
- **Verify:** on all three apps: confirm, correct and undo a fact as owner; see it as another member; force a release
  refresh and check nothing changed; renter and guest views unchanged.
- **Roll out:** with WP5's live counties first.
- **Roll back:** the server stops sending the new fields; stored entries stay.
- **Risks:** conflicting entries between members (last verified writer wins, with history in `household_facts`).
- **Size:** L.

## WP10. County connectors by measured demand

- **Goal:** add counties in the order Pantopus users need them.
- **Process:** weekly, rank counties by unanswered lookups (WP8's report); check terms; draft the field mapping (an
  agent may draft; a script checks codes and units against the source's dictionary); run T3; the founder approves the
  release; shadow; live.
- **Switches:** the jurisdiction lists.
- **Done when (each):** T3 passes; G1 and G2 pass for that county's homes; verified on all three apps as in WP5.
- **Roll back:** remove the county from the live list.
- **Risks:** codebooks without documentation; terms that forbid display (then the county waits for D2's route).
- **Size:** about 3 engineer-days per mapping plus a few hours a quarter to keep it (#3433's model).

## WP11. Unit floor plans

- **Goal:** building managers' sheets map units to plans; residents confirm; buildings without a mapping stay
  building-level ([unit-facts.md](unit-facts.md#floor-plan-sheets-the-design)).
- **What people see:** an apartment's bedrooms, baths and size prefilled when its building shared a sheet; "Is this your
  layout?"
- **Files:** an intake route and storage for sheets; the sheet-to-release step in `scripts/property-index/`; the
  confirm step in Add Home and Property details on all three apps.
- **Switches:** `FLOOR_PLAN_SHEETS_ENABLED` (off).
- **Data:** P4 for originals; sheets as releases in P1.
- **Depends on:** WP6 (unit IDs), WP9 (the confirm step), P4.
- **Done when:** a mapped unit shows its plan only on an exact match; an unmapped building shows plan ranges as the
  building's; a resident's "no" sends the mapping to review.
- **Verify:** on all three apps: a mapped unit, an unmapped building, a "no" answer, and a building-only match; the
  other resident's view.
- **Roll out:** building by building, starting with large rental towers where Pantopus users live.
- **Roll back:** withdraw the sheet's release.
- **Risks:** permissions (facts versus images); renumbered buildings.
- **Size:** L.

## WP12. Values

- **Goal:** the value card is never empty where the county has a value, and every number says what it is
  ([architecture.md](architecture.md#8-the-value-card-is-never-empty-and-an-estimate-shows-everywhere-we-can)).
- **What people see:** county values with the tax year, the last sale (or why it isn't public), the area trend
  labeled as an index; an estimated value and range everywhere we can, with wider ranges where we're less sure (D9).
- **Files:** the profile builder (`propertyIntelligenceService.js` 425-499: no assessed total as an estimate or a ZIP
  median, no default "flat", one confidence path); `routes/home.js` property-value (5509-5547: legacy fields and allowed
  values kept); web `PropertyValueCard.tsx`, `YourHomeDetail.tsx`; iOS and Android dashboard and Place value blocks;
  the FHFA index import (WP7's pipeline).
- **Switches:** levels 1 and 2 of the estimate need `VALUE_ESTIMATES=on`, and then follow each county's live switch; `VALUE_NEIGHBORHOOD_FIGURES=1` turns on level 3; `VALUE_AREA_TREND=1` turns on the area's price change. All off until the founder turns them on.
- **Data:** releases (sales, index); no tables.
- **Depends on:** WP5 or WP7 for values and sales; D9 is decided.
- **Done when:** G7 passes; a missing trend is sent as missing, not "flat"; the store builds' validators still accept
  the card; each market's range holds 75-85% of held-out sales where sale prices are public.
- **Verify:** on all three apps as owner (value shows) and renter (it doesn't); a non-disclosure state; a county with
  no value; the store build's value card.
- **Roll out:** with each live county; estimates market by market after T4.
- **Roll back:** unset `VALUE_ESTIMATES`; the router.
- **Risks:** assessment practice differs by state (fractional assessments must never read as market value).
- **Size:** M; L with an estimate.

## WP13. Mail fulfillment

- **Goal:** no single printer can stop verification, nothing is mailed twice, and returned cards reach the person
  ([architecture.md](architecture.md#13-mail-fulfillment)).
- **What people see:** "Sending…" until the printer confirms; a returned card's next step; cards still go out when one
  printer is down.
- **Files:** `addressValidation/mailVendorService.js` (27-48: a provider registry instead of Lob-or-mock);
  `lobMailProvider.js` (258-292: `sendCustomPostcard` gets an idempotency key); `blockFoundersService.js` (597-606: keep
  the reservation on an uncertain outcome; reconcile); `homePostcardService.js` (79-92: returned, re-routed and failed
  end the attempt); `routes/lobWebhook.js` (normalized events); `mailVerificationService.js`; a second provider adapter
  once chosen; the postcard screens on all three apps (the returned state).
- **Switches:** `MAIL_PROVIDER`, a per-flow override, and a switch that stops Block Founders mail alone.
- **Data:** `mail_provider` on the existing mail rows (P3, additive); P5 only if the existing dedupe can't hold events.
- **Depends on:** D5; Lob test mode; the founder for any real mail.
- **Done when:** T5's test-mode run passes on each printer; duplicates are zero under injected timeouts; a returned card
  shows its next step on all three apps; the founder's real-mail pilot passes for any printer that will carry live mail.
- **Verify:** request, resend, cancel and redeem on all three apps with Lob test mode; injected timeouts and late
  events; the other member's view after a redeem; Block Founders with an opted-out recipient.
- **Roll out:** the interface and fixes with Lob alone first; a second printer for new pieces only after its pilot.
- **Roll back:** `MAIL_PROVIDER=lob`; in-flight pieces always finish with the provider that accepted them.
- **Risks:** webhook changes while pieces are in flight (keep the old verifier until they drain); real-mail delivery
  that only the pilot can show.
- **Can't verify without the founder:** live mail, delivery times, the second printer's real behavior.
- **Size:** L.

## WP14. Retire Smarty

- **Goal:** no Smarty dependency left.
- **When:** WP3 live and stable for 30 days with G5 holding.
- **Steps:** drop Smarty from required production keys (`config/addressVerification.js` 179-180); stop reading Smarty's
  cached candidates; delete them if an agreement requires it (founder); keep the adapter code until the founder says to
  remove it.
- **Size:** S.

## WP15. Retire ATTOM

- **Goal:** zero ATTOM calls and no ATTOM content anywhere, once the record has proven better, county by county.
- **What is left here:** remove the ATTOM code paths once WP5, WP7 and WP2 have replaced what reads them; the "ATTOM ID"
  row and ATTOM copy gone (WP2); the old vocabulary served to old builds no longer needed (D11).
- **Size:** M.

## WP16. Lob: keep per piece or retire

- **Goal:** the founder's choice (D5) carried out.
- **Keep:** Lob stays the main printer per piece (no monthly fee), the second printer covers outages.
- **Retire:** only after the second route passes the real-mail pilot and every in-flight Lob piece has finished and been
  reconciled; then remove Lob's key and webhook.
- **Size:** S.

## What this plan can't verify on its own

Hosted services and their data (key presence, stored copies), live vendor answers and billing, physical
phones, real mail delivery, and the share of old store builds until WP2's header ships. Each package names its own
limits.
