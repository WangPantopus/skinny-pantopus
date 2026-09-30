# Stream 4 — Place, home records, money and mail (split from the former Stream 2 on 2026-09-30)

> **Split (user direction, 2026-09-30).** The former **Stream 2** (Home and household) is split into **Stream 3 — Home access, residency and security** ([`03-home-access-residency.md`](03-home-access-residency.md)) and **Stream 4 — Place, records, money and mail** ([`04-place-records-money-mail.md`](04-place-records-money-mail.md)).
> - Together their checklists are exactly the former Stream 2's, and nothing is shared or dropped:
>   - the 40-row inventory, 20 rows each;
>   - the 24 S2-xx UX items;
>   - the open work and leads;
>   - the 10 decisions waiting on the user;
>   - and, added 2026-09-30T04:36:26Z, the cross-cutting rows the hub's records give the former Stream 2: U01 is Stream 3's alone, and each stream owns its own screens' cells of U02–U05 (see "Cross-cutting rows" below).
> - The former Stream 2 file is now frozen history at [`former-stream2-home-household.md`](former-stream2-home-household.md) (moved from `02-home-household.md`, which frees `02-` for Stream 1's split). In it, "Stream 2" / "S2" means the stream before the split.
> - The former **Stream 3** (Accounts and Social) is now **Stream 5** ([`05-accounts-social.md`](05-accounts-social.md)). In records dated before 2026-09-30, "Stream 3" / "S3" means Stream 5, not the new Stream 3.
> - Names that contain `stream2` or `S2-` keep them so nothing breaks: the runtime kit, stage folders, audit bundles, existing branches and UX IDs.
> - **This stream from now on:**
>   - branches `claude/stream4-<topic>`;
>   - audit bundles `YYYYMMDD-stream4-<topic>-rN`;
>   - device and heavy lease label `stream4:`, which is also its runtime-lease label;
>   - session name "Stream 4: Place, records, money and mail";
>   - resume prompt [`NEXT-STREAM4-PROMPT-2026-09-30.md`](NEXT-STREAM4-PROMPT-2026-09-30.md).

## CURRENT RESUME — Stream 4 (start here; written 2026-09-30T04:16:32Z)

**Scope.** What a home knows and keeps:
- Place and home intelligence: the health score and seasonal checklist, the address calendar, property data, weather/air/alerts/civic, and timeline freshness (I01–I07);
- home records: issues and emergency info, issue media, maintenance history, and the document/issue/access/share readers (D01, D02, D04, D09);
- money signals and the bill benchmark (F01, F02, F04, F05);
- mail, kept only for postcards, welcome cards and the digest (M01);
- this stream's cells of U02–U05 (U01 is Stream 3's).
- D03, F03, M03 and M04 are fully cut for launch.

**Launch-scope owner:** Stream 4 checks cut #7 (Household extras) and cut #8 (Mail extras) for the former Stream 2's area. Never verify, test or fix them.

**State at the split.**
- Master `8e44382ce`. Every former Stream 2 PR is merged; none is open. **Refreshed 2026-09-30T04:25:38Z:** the split's docs PRs #843 and #844 merged at 04:24:12Z (master `15711c8dc`), so Stream 4 has **no open PRs**.
- **Strict progress for this stream:** 4 of 16 retained rows closed (I01–I03, F01), 12 partial, 4 rows fully cut (D03, F03, M03, M04). This stream's U02–U05 cells have their own section and are not in these counts.
- **The open F02 fixture was deleted with the database by the Docker reset (2026-09-30T05:51:48Z), not by an exact cleanup.** It was member B's occupancy `7a6417c0` on cohort Home 9d885f71, the `finance.view` override (then `allowed=false`) and 2 `member_override` audit rows. Nothing is left to clean, and no after-run fingerprint comparison is possible.

  The F02 native re-run's Android journey (stage `runtime/f02-native-permission-r1`, captured 03:07–03:10Z on 2026-09-30) is on disk but unsealed:
  - Money showed neighborhood-only figures, then "Your electric bills average 12% above" with finance, then neighborhood-only again after the revoke;
  - the Home dashboard showed its Bills stat and tab only while finance was granted.

  If you seal it, say how the fixture ended. The emulator's app was signed back in as the owner before the reset; that account no longer exists.

**Open work, in order.** Each row's exact remaining boundary is its last column in the checklist below.
**Runtime:** rebuilt by Stream 3 at 2026-09-30T06:12:19Z from master `ed5ea9ec5`, with no Homes or fixtures (see the live block). **Open Stream 4 PRs:** none (the typed-draft fix, branch `claude/stream4-dashboard-issue-draft` at `3ce02567e`, waits for its runtime proof). Merged today: #854, #860, #863, #867, #871, #872, #875, #882, #885, #896, #904, #906, #907 (batch 159, master `add968868`).
1. **F02 native re-run, iOS part.**
   - Take the runtime lease. If the shared runtime hasn't been rebuilt yet, do that first (resume prompt §2).
   - Recreate the F01 cohort: the owner's Home and its 9 neighbors with 27 paid bills in cell c20fbj. The neighbors and bills came from `fixture.sql` in bundle `20260927-stream2-f01-bill-cohort-r1` (user-approved 2026-09-27). Then add member B's occupancy.
   - Recommended: rerun the Android part on the recreated cohort as well, so both platforms are sealed together with an exact cleanup. Keep the 03:07Z capture as supporting evidence.
   - Sign member B in on sim 6F914A30 through the real login screen. Type from the private file only after a focus check, and take no raster on the login screen.
   - The owner toggles View finance on the web with `tools/web-f02-home-dashboard.cjs` and `OUT_DIR`. B opens Money and the Home dashboard before, with finance, and after the revoke.
   - Sign the iOS app back in as the owner.
   - Then run the exact cleanup: adapt `tools/cleanup-f02-home-dashboard.py`; its PropertyIntelligenceCache read-side refresh rule applies. Seal Android + iOS and hand the result to the coordinator.
   - If iOS can't run in the first lease, clean the fixture exactly first and recreate it later (one SQL row plus two UI toggles).
   - Remaining after this: the hosted and provider boundaries. Web Home-dashboard consumer evidence is sealed as `20260930-stream2-f02-home-dashboard-bills-r1` (`12a3a6bd…`).
2. **I07, freshness:** done on web 2026-09-30: #854 labels, #860 saves on the page, #863 malformed rows, and a concurrent-insert check. Remaining: native labels (queue), live updates from other devices (none on web), `created_at` ties (not reproduced) and time zones.
3. **D09, readers:** 2026-09-30, #863 (the Home activity reader). Remaining: other malformed-success readers and a complete cross-client pass (native is blocked). The share and access reader files are Stream 3's area; coordinate any change to them.
4. **D01, records:** 2026-09-30, #871 (the web emergency-info create receipt). Remaining: native emergency create (queue), web emergency E1/E3/E4 confirmation (❓ in the checklist) and issue E5 on screen. Its guest-pass record part touches Stream 3's D08/M02; coordinate.
5. **D04, maintenance history:** one truthful lifecycle across `HomeMaintenanceLog` and `HomeIssue` with competing readers and writers.
6. **I04, the address calendar:** daylight-saving and holiday edge cases for pickup days. Provider holiday data stays named.
7. **I05, property data, local parts:** stale cache, absent or wrong property, and verification wording.
8. **U02–U05, this stream's cells.** Native large text, screen readers and dark mode on the Place, records, money and mail screens, then the U03 and U04 cases no row covers yet. Itemize the cells in this file the way Stream 1 itemized its own (the user approved Stream 1's lists on 2026-09-29), using the case names in `checklists/data.py` (A1–A5; E1–E6 and R1–R2; L1–L4). Don't write to Stream 1's generator. U05 starts when the launch flags are on master.
9. **Native queue (blocked until the machine-wide native reinstall; the user's OK).** From today's web work:
   - F02 native permission re-run (item 1);
   - I07: the native Home recent-activity card still humanizes raw audit codes and target types (#854 fixed web only);
   - D01: iOS and Android emergency-info create send no request id, so a lost-reply retry duplicates (#871 fixed web);
   - I06: iOS parses dates with `ISO8601DateFormatter(.withInternetDateTime)`, which rejects the date-only election day (#875 fixed web; Android is correct);
   - D04: maintenance history is app-only;
   - U02: native A1–A4 cells.
10. **Latent and cut notes:**
   - web Mail due dates use `new Date(<SQL date>)`, but no product route writes `Mail.due_date`, and bill blocks in letters are cut;
   - the native Dismiss confirm wording is cut (#8).

**Decided by Stream 4 (2026-09-30T08:50Z), under the user's direction of ~08:36Z.** The direction: "go with what you think is the best decision for user experience, best safety, security practice, best to retain users … record your decision … just keep working." The earlier options and the closure plan are here: https://claude.ai/artifact/AZyYcWk2YpdwT4pc3nGGkp
1. **Issue photos and files at launch (D02): launch without issue media.**
   - D02 is scoped to issues without attachments. No web, iOS or Android issue screen offers a photo or file today (only an iOS API doc comment mentions `photos`), and #380 already removed the attachments that were never uploaded.
   - **Why:** photos of a home's interior are sensitive. A safe upload needs a private bucket, member-only signed URLs, EXIF/GPS stripping, type and size limits, scanning, and deletion with the issue. None of that exists, and building it before launch adds risk for a modest gain, since issues work well as text.
   - **After launch:** revisit with exactly that contract.
2. **Printed postcards, welcome cards and the street digest (M01): after launch.**
   - Nothing is built. Physical mail needs a print/delivery provider, address verification, consent and anti-abuse controls, and a cost model.
   - The compose routes keep their security repairs (#867/#872/#885), and the compose UI stays cut (#8).
3. **Bill benchmark eligibility and retention (F04): adopt the implemented, privacy-first policy as the rule.** Source: `read_bill_peer_months`, `20260911020000_current_home_bill_comparisons.sql`.
   - Only households that opted in ("Share bill data anonymously"; off by default) contribute.
   - Peers are the same geohash cell and currency, over a rolling 24-month window of period starts.
   - A bill type and month is listed only when ≥3 households contribute; averages and medians appear only from ≥10.
   - Figures are computed on each read by a service-role-only function, and no neighbor's individual amount is ever returned.
   - Withdrawing or deleting a bill or Home takes effect on the next read (verified: `20260927-stream2-f04-withdrawal-r1`).
   - **Why:** opt-in plus k≥10 gives useful comparisons without exposing a household, and neighbors' trust is what keeps them opted in.
   - **Still open:** hosted scale (a named boundary).
4. **Live updates from other devices (I07): option (a) for launch.** Keep the re-read on focus, visibility and reload.
   - (b) would add a read of three summaries per open dashboard every minute. That risks cards flickering while someone reads, for little gain before multi-member households exist in real use.
   - (c) is revisited after launch, with a membership-checked room.
   - Details:
     - **Today:** the web Home dashboard re-reads when its tab regains focus or visibility, or on reload (`useHomeData`).
     - **(b):** 60 s re-reads of the summary cards through `reloadSummary`.
     - **(c):** a `home:<id>` socket room carrying payload-free "changed" events. The existing gig rooms join without a membership check, so they are not a model for private Home data.
     - All options keep the accepted 2026-09-11 access retirement (d681da444).
5. **Typed text in Home dashboard panels when the tab is hidden (U04 L1): option (b), being built.**
   - Keep only the member's own typed new-issue draft, which is not private Home data, across the hide-time re-check. Put it back into a reopened Report Issue panel only when the re-check confirms the same account and the same Home; otherwise drop it.
   - Private content still unmounts, and no old panel reappears on its own.
   - **Why:** losing typed text on every tab switch is a real annoyance that costs reports, and this keeps the security design intact.
   - Found in bundle `20260930-stream4-home-l1-l4-r1`. (a), dropping drafts, and (c), not resetting on hide, were rejected.

Shared with Stream 3. **Decided by the Stream 1 coordinator** (2026-09-30T08:54Z): WCAG-AA brand-colour values, implemented app-wide by Stream 1, and a staging pass before launch for hosted and provider behavior. The earlier views, for the record:
1. Brand colors that fail contrast (all streams): Stream 1 carries one design-token recommendation. Stream 4's view: adopt WCAG-AA values; the lowest measured on this stream's screens is the health chip's amber at 1.87:1.
2. When to verify hosted and provider behavior (both streams). Stream 4's view: a staging pass before launch (safer than a launch-day checklist).

**Hosted and provider boundaries.** These rows can't close locally; name them and never turn them into passes:
- I04: provider holiday data.
- I05: property providers.
- I06: weather, air, alert and civic providers across regions.
- F04: hosted scale.
- F05: hosted workers and released app versions.
- M01: print and delivery provider.
- D02: the media contract.

## Checklist — the inventory rows owned by Stream 4 (20 of the former Stream 2's 40)

State at the split, copied verbatim from the former file's "September 22 exact … 40-row inventory". From now on, update each row only here. D03, F03, M03 and M04 are fully cut: never verify them.

| Row | Current disposition and bounded evidence | Remaining boundary before row closure |
|---|---|---|
| I01 | **Closed — verified/preserve within retained scope.** Three-app uncertain generation/completion recovery6fd4b5e2 plus accepted first-load/race evidence complete this row; no new code. **Repaired and merged:** [#587](https://github.com/WangPantopus/skinny-pantopus/pull/587) (batch 39) and [#611](https://github.com/WangPantopus/skinny-pantopus/pull/611) (batch 41: a closed task's item is released before scoring). Post-merge check `20260927-stream2-post-merge-check-r1`. 2026-09-27, reproduced on web with a new synthetic Home. The first dashboard showed "50/100 · No seasonal checklist created yet" next to the checklist it had just created, because health was computed 25 ms before the checklist read created the rows. The fix creates the season's rows inside the health read (idempotent). After the fix, the first load shows 55, "2 of 2 incomplete", and 4 concurrent creators leave 2 rows. Every client forces the score, so the 5-minute cache has no visible lag. Bundle `…-i01-first-health-r1`. | None within retained I01 scope. Nested metadata/I02, generic account lifetime/I07 and external release/provider boundaries remain separate. |
| I02 | **Closed — verified/preserve within reachable retained scope.** #661 persisted title/key/order guard: actual3-app error/Retry recovery, own fixture cleanup and79-file9f70d348 evidence reviewed and merged batch58/#663.  2026-09-27: retained checklist icon/hover color repair [#629](https://github.com/WangPantopus/skinny-pantopus/pull/629), bundle `20260927-stream2-home-icon-color-r1`; presentation-only, no row closure. 2026-09-27:<br>• Carryover renders, expands and acts on web, Android and iOS (bundles `…-rpc-catch-saves-r1`, `…-native-f01-carryover-r1`).<br>• Generation race verified: 5 concurrent first reads return one set of 2 rows, with the 23505 path logged ×4 (`…-i01-first-health-r1`).<br>• Malformed-card/read evidence is reused.<br>• Noticed: after a Skip, iOS keeps "1 remaining" until reload. 2026-09-27: native carryover "remaining" count fixed ([#620](https://github.com/WangPantopus/skinny-pantopus/pull/620), batch 42; bundle `…-native-carryover-count-r1`). | Blank title/key/order covered by #661; optional completiondate #669 actual3-app afters e3fdac04 ready. SQL/caller mapping in SCOPE.md: currentseason/year/progress derived; historySDK has no appcaller; checklist has no pagination UI (timeline separate). Reviewed19:47Z: no remaining reachable I02 criterion. History endpoint is unexposed, timeline pagination belongsI07; no history acceptance/new UI. |
| I03 | **Closed within retained scope — checklist accounted in I01/I02; Hire remains cut.** Web + API repaired and verified 2026-09-27 in #574 (bundle `20260927-stream2-checklist-hire-link-r1`) and #575 (invisible Hire button, `…-checklist-button-color-r1`). Hire now carries the item's title and category, and the posted task is linked (item hired). Closing the task puts the item back to pending. A failed link keeps the task and shows a note. The API refuses other people's, closed and unknown tasks and callers without home.edit. | **Launch scope: the Hire path OUT (cut 4, Open Gigs); the checklist itself stays.** Merged 2026-09-27: #574 #575 (batch 38), native [#609](https://github.com/WangPantopus/skinny-pantopus/pull/609) and [#611](https://github.com/WangPantopus/skinny-pantopus/pull/611) (batch 41); post-merge E2E on master passed. No remaining Hire action is queued while cut. Retained checklist verification is accounted in I01/I02; no duplicate journey under I03. |
| I04 | **Partial/open.** 2026-09-30 (Stream 4): DST verified without code change, using the real calendar service with an injected clock, 8/8 across fall-back and spring-forward plus the web labels by time zone (bundle `20260930-stream4-address-calendar-dst-r1`, `f6cf00d3…`). Weekly recycling verified in all3 actual clients and independently accepted by the coordinator:100-file35958b24,11 source bindings/216 reused files; seven date choices, real saved weekly recurrence and reload/cold. No application change; exact4-row cleanup/351of353 hashes restored.  Web DETAIL read-retry [#737](https://github.com/WangPantopus/skinny-pantopus/pull/737) exact78c484771/69fileda2b423d: actual0→1GET each, both unchangednativecalendarretries/recovery pass;349nonauthhashes unchanged/no writes. Realreadyempty Portlandcontrol, provider/account breadth stillopen. Retained pickup three-app bounded acceptance8158b065: saved/failed/retry/clear, iOS restart/real403; no app change. Six pickup source bindings reconfirmed unchanged in84-fileca30aed5; existing provider holiday disclaimer preserved. Holiday-provider/DST/read/account breadth remains. D03 bill date/amount bounded repairs are accepted; they do not close calendar policy. 2026-09-26: the dashboard Calendar card parsed bill `due_date` (SQL date) as UTC, showing every bill a day early ("TODAY … 5:00 PM", a false "1 day overdue" from 5 PM the evening before, Week view on the previous day) and in "$". Fixed with the existing bill helpers ([#547](https://github.com/WangPantopus/skinny-pantopus/pull/547), bundle `20260926-stream2-calendar-dates-r1`). Web Mail due dates have the same root cause (CURRENT RESUME §3B item 6). | **Launch scope: the general Home calendar and bill dates OUT (cut 7); the address calendar (pickup day, holiday moves, DST) stays.** Local date rules, dashboard boundaries, recurrence and DST transitions. |
| I05 | **Partial/open.** 2026-09-30 (Stream 4), local parts verified on web with no code change (bundle `20260930-stream4-property-local-r1`, `c4a8a189…`): a stale ATTOM cache shows the value with "Updated May 2026", absent data shows "No estimate available", and the Property Details wording implies no failed verification. Provider acceptance and wrong parcel stay named. Source/provider boundary4fileea61cecc: current web/native readers already exist; ATTOMconfiguration/real-provider/stale/wrong-parcel acceptance remains unverified, no duplicate implementation. Accepted543geometryblock unchanged. Existing property/detail readers are preserved. 2026-09-26: a Home without coordinates got Null Island (0,0) section data ([#543](https://github.com/WangPantopus/skinny-pantopus/pull/543), bundle `20260926-stream2-place-null-coords-r1`). | Provider/data acceptance, stale cache, absent/wrong-property and verification wording. |
| I06 | **Partial/open.** 2026-09-30 (Stream 4): the web Place election banner showed a date-only election day as the day before in US time zones. Fixed in [#875](https://github.com/WangPantopus/skinny-pantopus/pull/875) (merged, batch 148; bundle `20260930-stream4-civic-election-date-r1`, `63787428…`; emulated section). Still named: the backend's UTC-based `days_until` and Election Day cut-off (provider), and iOS date-only parsing (native). 2026-09-26: daylight, EPA facilities, heat/cold, seismic, wildfire and civic districts no longer compute at 0,0 for coordinate-less Homes ([#543](https://github.com/WangPantopus/skinny-pantopus/pull/543)). Stale Sun wording was repaired on all three apps in accepted bundle20260927-stream2-sun-day-label-r1 (3b5bae8b2); do not reopen that candidate. | Weather, air quality, alerts, daylight and civic sections across geography/provider states. |
| I07 | **Partial/open.** 2026-09-30 (Stream 4): web Home health and Home activity now follow saves made on the dashboard ([#860](https://github.com/WangPantopus/skinny-pantopus/pull/860), merged; bundle `20260930-stream4-dashboard-summary-refresh-r1`, `badd163e…`). Before, after Report Issue health stayed "55 /100" (the server said 45), and after Add Task activity stayed empty until a reload; the Today counts were already fresh, a hypothesis rejected by the reproduction. A malformed activity row no longer takes down the dashboard ([#863](https://github.com/WangPantopus/skinny-pantopus/pull/863), merged; `20260930-stream4-timeline-reader-shape-r1`, `5048251f…`; emulated replies). Web Home activity labels repaired in [#854](https://github.com/WangPantopus/skinny-pantopus/pull/854) (merged in batch 139, master `67e3a458a`; bundle `20260930-stream4-home-activity-labels-r1`, `1c2c0d0c…`). The route returned raw audit rows, so the card showed codes and no actor; it now returns the declared contract (description + actor name). Real-Chrome before/after. Concurrent-insert pagination was verified on web with no code change (22 rows, a save between pages, 0 omissions; the new event shows after reload). #773 mounted finite-authority expiry repaired and actual web/Android/iOS before/after accepted within160-file5dadb5b8 limits; finalb3b245a3f reviewed/merged batch106/#775. Earlierofbothfields, deniedRetry/cold and actualweb late200 covered; shared globalcontext remains separate. WebHomeTimeline actual64-row pagination/reload/503/Retry verified30-fileab71dcee, no appchange/all353unchanged; finalextraDOM timing and stickyheadercapturesqualified. Distinctfrom Membersaudit/nativeUpcoming. #755 emergency-only Overview repaired after actual UI/API/SQL reproduction,47-filed8966910 seal/full353 cleanup; merged batch98/#756. #638 repairs native Home-tools-return projection, actual both-platform failure/retry/restart evidence af14517d; broader mounted/account races remain. Individual stale-reader repairs are recorded, including D09 response-integrity controls. 2026-09-26: the Android Today tab never refetched while mounted; it now has pull-to-refresh like iOS ([#544](https://github.com/WangPantopus/skinny-pantopus/pull/544), bundle `20260926-stream2-today-refresh-r1`). | Web labels: done (#854, merged). Still open:<br>• mounted-view/cache invalidation without navigation (on-page saves: done in #860; changes made on other devices still show only on focus or reload, because web has no live updates; decided: option (a) for launch, see "Decided by Stream 4" item 4);<br>• native recent-activity labels (native tooling is missing);<br>• `created_at` tie order at a page boundary (not reproduced);<br>• concurrent authority and timezone boundaries beyond the accepted static 64-row/retry and concurrent-insert cases. |
| D01 | **Partial/open.** 2026-09-30 (Stream 4): web Emergency Info for an account without access (a direct link, or access retired while away) said "could not be loaded" with a Retry that repeated the 403, an Add the server refuses and a toast. It now says "You don’t have permission to view this household’s emergency info." with none of them ([#904](https://github.com/WangPantopus/skinny-pantopus/pull/904), merged in batch 158, master `88149d747`; bundle `20260930-stream4-emergency-access-denied-r1`, `76bb6524…`). The same run confirmed web E1 (a server error keeps the draft) and E3 (a double tap saves 1 entry) with no change. Web emergency info no longer duplicates after a lost create reply ([#871](https://github.com/WangPantopus/skinny-pantopus/pull/871); bundle `20260930-stream4-emergency-create-receipt-r1`, `8e1804d4…`). Merged in batch 147. It uses the #740 `clientRequestId` pattern and passes the API controls. Native emergency create sends no id yet. #769 one-SDKfile receiptguard191-file3afd7334: fourwebfalse-successbefores/21malformedafters/realsavesandreloads; unchangednative structuralparitywith2faultoverlapcellsqualified/exclusivelycompleted. Exactly3ownissues0/349outside4Authrestored; broadidentity/account/concurrent/durableboundariesopen. #740 same-draft issue creation131-fileb8cb3456: bothweb+Android+iOS actual lost201/manualretry preserves1 original full row; reload/restarts/API concurrency controls pass, exact13cleanup/16retained unchanged. In-memory draft scope only; no broad lifecycle closure. #654 web explicit clears/zero estimate actual UI/API/SQL verified (85ee0497), exact fixture cleanup; merged batch55/#656.  Package permission/status controls, Emergency PUT/DELETE and guest-pass repairs are real end-to-end; PR192 is the current preservation milestone. 2026-09-26: issue status contract ([#467](https://github.com/WangPantopus/skinny-pantopus/pull/467)) and issue permissions with native Issues entries ([#482](https://github.com/WangPantopus/skinny-pantopus/pull/482)). | **Launch scope: packages OUT (cut 7); issues, emergency and guest passes stay.** Remaining Home-entity mutations, receipts and complete create/edit/delete coverage. |
| D02 | **Partial/open.** #769 webissuefailed-receiptdraftretention and realretry/reload191/3afd7334 accepted within recordedfourcaller scope; no newmedia contract. #654 cleared-draft503/403/retry/cancel/uncertain-save evidence85ee0497; existing media contract still unapproved.  Existing panel error/draft retention is reused where verified. | **Launch scope: bill and package media OUT (cut 7); issue media stays.** Issue media contract remains a design-stage requirement; do not introduce attachments without an approved existing contract. Remaining in-scope write/lifecycle cases only; cut bill/package media are excluded. |
| D03 | **Partial/open.** Standalone bill-unit/date behavior and package `in_transit` contract are repaired and evidenced. | **Launch scope: OUT (bills and packages, cut 7). Don't verify.** Final cross-client/server contract and remaining native/provider boundaries. |
| D04 | **Partial/open.** Native manual Delete112-file27164512 now verifies actual cancel/strict503/full-row preservation and committedlost204/manualretry/cold on both platforms, qualified iOS original helper sequence plus fresh unfinishedcontrols. Exactly3ownlogs productgone/all349outside4Auth restored, no code/build. #743 mounted manual-create timeout/retry101-file57d87133: both installednative before2→after1 identicalrow/cold, APIguards/concurrentfirstinsertpass; exact7productdeletes/all349outside4Auth restored. In-memorydraft scope; broaderaccount/concurrent/Gig/otherlifecycle open. #687 native original-read gate covers failed/missing/pending loads and recovered saves/create eligibility;155-file999ae0a6, ownlog deleted204/fivefullhashes restored.  2026-09-27 optionalcost/vendorclears, zerodistinction, concurrentomission and bothnativecoldreread verified in#683 (163files6bb4a244), ownlog204deleted/fivefullhashesequal. 2026-09-27 concurrent native title/cost/vendor edits and current-vendor display repaired in #677;149-file d819c144 evidence, one ownlog product-deleted204 and five full baseline hashes restored. Explicit null clearing now covered by#683; wider lifecycle remains unverified. 2026-09-27 manual completiondate/UTCday/YTD repair verified on installed Android/iOS;173-file5ab0d849 evidence, all4ownlogs productdeleted/fullbaseline restored. Eight existingfiles, no schema/design change. 2026-09-26 candidate: the health card's maintenance action counts HomeIssue rows, but on iOS/Android it opens the HomeMaintenanceLog list ("No maintenance logged yet"). Fixed and accepted in merged #563 (`20260927-stream2-health-view-issues-r1`, seal `08d77b43…`); no new rerun was needed for unchanged source. | One truthful lifecycle across HomeMaintenanceLog/HomeIssue and competing readers/writers. |
| D09 | **Partial/open.** 2026-09-30 (Stream 4): the web health and checklist readers reject unrenderable replies ([#882](https://github.com/WangPantopus/skinny-pantopus/pull/882), merged; `20260930-stream4-intelligence-reader-shape-r1`, `c44de224…`). The web Home activity reader rejects rows it cannot render ([#863](https://github.com/WangPantopus/skinny-pantopus/pull/863), merged; bundle `20260930-stream4-timeline-reader-shape-r1`, `5048251f…`). Before, with emulated replies, a null row, or a row without action/time, made the whole app show "We hit a page error". After, the card's own unavailable state and Retry take over. #758 separateShareCenter missing/object/null-memberguard actualthreebefore/afters/retries/reload34-file5154af44/all353unchanged; acceptedstandalone/nativecollectionsreused, merged batch99/#760. #717 same-draft uncertain issue73-file9b341a41: actual web/Android/iOS lost committed201/manualretry preserves one original row; scoped API guards,6owned cleaned/six hashes restored. In-memory scope only; restart/account/first-insert race open. #715 web malformed issue201 guard46-file33e5e1b:3before/afters+realvalidAPI/SQL,unchangedAndroid3parity,1exactcleanup/sixhashes; iOS missing/null/empty actualUI nowverified34-fileb7ccaf52,8unchangedbindings/119priorfiles reused/all353unchanged/zero writes; same-mounted-draft uncertainissue is covered by#717. #711 same-Home revoke receipt repair47-file9c7cd14f: actual web lost-reply baseline, original mounted three-client recovery, permission/missing/concurrent API cases; one fixture cleaned/six hashes restored. Fridge issue/revoke/public lifecycle117-file8327964d: three apps/three owned cards,48receipts/16bindings, exact cleanup and six whole hashes restored; capture and uncertain/account limits explicit. #707 persisted fridge-card reader:85-file541079bd,18 web/native assertions/14bindings/41GETs/six unchanged hashes; web query+existing error/Retry and Android response guard. #705 optional fridge Emergency prefill:59-filec0ea704c,15 web/native assertions/14bindings/22GETs/six unchanged hashes; one existing web effect guard. #703 dashboard Emergency/Access optional members:52-filea4670cb7,15 Chrome assertions/eight bindings/44GETs/six unchanged full hashes; only two retained hook readers changed. #701 four Android native collection null-member guards:129-file6c21cb56,24 installed Android/unchanged iOS null-object-retry assertions,31 GETs and eight unchanged full hashes. #680 missing-list/web cases reused via source bindings; nested/identity/other-consumer limits remain. #698 Emergency web collection/Android null-member guards:96-file1dfd1368,22assertions, installed Android/unchanged iOS parity, real recovery/cold and five unchanged full table hashes. Other nested member-shape boundaries remain open. #694 web settings envelope/name/type guard has five actual malformed/retry cases,42-file8722e5a7 and four unchanged complete table hashes.  #680 repairs four standalone web list-shape guards and Android missing Access/Issues arrays;148-file659bf82b evidence, real web12cases/retry and native4reader missing/recovery, eightwholefingerprints unchanged. Nested semantics/write receipts/other consumers remain open. Pets/polls false-empty routes and page retry behavior are repaired; PR192 readback guards malformed success. 2026-09-26: web Documents delete really deletes, and Documents/Issues/Access/Share show unavailable instead of empty ([#529](https://github.com/WangPantopus/skinny-pantopus/pull/529), bundle `20260926-stream2-home-docs-r1`). The empty Documents and Access & Codes pages no longer point to web actions that don't exist ([#541](https://github.com/WangPantopus/skinny-pantopus/pull/541)).| **Launch scope: pets and polls OUT (cut 7); documents, issues, access and share readers stay.** Remaining malformed-success readers and complete cross-client verification.  Native Fridge failure lifetime#713 sealed76/91bddc2d: visible after6s/retry clears,2owned cleaned/six hashes restored; placement/account/uncertain-issue limits explicit. |
| F01 | **Closed — verified/preserve within retained Place arithmetic scope.** 2026-09-27, user-approved SQL cohort in cell c20fbj (9 synthetic neighbor Homes + 9d885f71). Web Home bill card: "1 more neighbor needed" → "$150 vs $133.35, 12% above"; the opt-in toggle needs #578. Place Money signals card and detail show "12% above / $150 per month" on web, Android and iOS. Bundles `…-f01-bill-cohort-r1` and `…-native-f01-carryover-r1`. The Money detail now names the real period ([#613](https://github.com/WangPantopus/skinny-pantopus/pull/613), batch 41). | Fractional/mixed-currency/unequal-period arithmetic verified in64-file7b4dbb42; final exactfixturecleanup complete. Coordinator accepted retained F01 closure19:47Z; current Place explicitlyUSD-only and rounded. Earlier Android actualANR remains a separate unresolved reliability boundary. |
| F02 | **Partial/open.** 2026-09-30 (Stream 4), access retirement on web: `/app/place`, `/app/place/<section>` and `/app/place/pulse` with `?home=` for a Home the account can't read said "Check your connection and try again", with a Try Again that repeated the 403. They now say "This place isn't available · You don't have permission to view this place." with no retry, and other failures keep Try Again ([#896](https://github.com/WangPantopus/skinny-pantopus/pull/896), merged in batch 155, master `66d57bcfe`; bundles `20260930-stream4-place-access-denied-r1` `650fde8e…` and `…-pulse-r1` `8dd2415e…`). 2026-09-27 bounded cohort-member candidate passes on web/Android/iOS (bundle `20260927-stream2-f02-member-finance-r1`, seal `48d40790…`): neighborhood-only figures, personal trends denied, error/retry and retired-member403; exact occupancy cleaned and retained fingerprints equal. Existing privacy/error distinctions are reused where recorded. 2026-09-27: the Place "Try again" on a section that failed to load did nothing on web (it opened the cached detail page), iOS or Android. Fixed and merged: web [#602](https://github.com/WangPantopus/skinny-pantopus/pull/602) (batch 40) and native [#619](https://github.com/WangPantopus/skinny-pantopus/pull/619) (batch 42). The native Place previews (Stream 1's Start/launch area) are handed to Stream 1. 2026-09-29 (Claude Stream 2): iOS successful delivery after logout sealed `20260929-stream2-f02-ios-retry-late-delivery-r1` (edec37f4, no code): Money's Try-again read held across a real logout and delivered 4.1 s after it; no owner values after logout or for the next member (403). Web same-account permission **accepted by S1** `20260929-stream2-f02-same-account-permission-r1` (fe2bd74c, no code): a request-time 200 delivered 17.7 s after a real-UI revoke stays only until that page's next read; fresh reads and the Place dashboard enforce the revoke. | Remaining: native permission-change re-run and consumers beyond the Place dashboard (e.g. Hub); iOS late delivery after a new-account login is unreachable (20 s request timeout); hosted/provider boundaries. (Earlier text: Place financial failures, source absence, access retirement and joint Home/Place privacy. The bounded no-finance member journey is already accepted48d40790; web held-success/account case now acceptede9922741, no app change; Android held-success after logout now accepted `edee4120…`; iOS cancellation beforelogout/member403-retry/cold-return nowaccepted82-file699bb0f7. iOS successful delivery afterlogout or newaccountlogin, same-account permission and other-consumer boundaries remain.)|
| F03 | **Partial/open.** Home bill create/edit/delete boundaries are recorded. 2026-09-27: the native Add Bill review no longer promises bill splits, which nothing can create ([#621](https://github.com/WangPantopus/skinny-pantopus/pull/621), batch 42). | **Launch scope: OUT (full bill management, cut 7). Don't verify.** Place bill splits, malformed input, currency changes and permission-limited actions. |
| F04 | **Partial/open.** 2026-09-27, withdrawal on web (cohort Home 9d885f71): turning off "Share bill data anonymously" takes effect on the next read. The Home card falls back to "1 more neighbor needed", Place Money signals folds the bill benchmark into "Coverage is expanding here", and no cached comparison is served. Turning it back on restores "12% above" on both. Bundle `20260927-stream2-f04-withdrawal-r1` (`a32a429e…`). | Read-only binding59036ee0 reuses existing local thresholds, deletion/restoration, paid-status/location corrections, snapshot freshness and indexed-query evidence. Product eligibility/retention policy and hosted scale remain unverified; no new blanket closure. |
| F05 | **Partial/open.** Read-only binding `20260927-stream2-bill-release-binding-r1` (seal `59036ee0…`) accounts for accepted local current/legacy HTTP format behavior, current format2 callers and retired compatibility worker; current job registration has no old-worker reference. Four accepted bundles/133 files verified, no repeated journey. | **Launch scope: recurring full-bill schedules OUT (cut 7); benchmark release compatibility stays.** Hosted migration-before-reader deployment, retirement of old deployed worker schedules and released client/API version bindings remain unverified. Source/local SQL equality is not hosted release proof. |
| M01 | **Partial/open.** 2026-09-30 (Stream 4) security repairs on the live compose routes:<br>• [#867](https://github.com/WangPantopus/skinny-pantopus/pull/867) (merged): the recipient search household block needs household membership, general matches carry no Home, and home-context refuses pending claims. Bundle `20260930-stream4-compose-recipients-privacy-r1`, `12b432cc…`.<br>• [#872](https://github.com/WangPantopus/skinny-pantopus/pull/872) (merged, batch 147): connections see City/State only. Bundle `…-compose-connections-privacy-r1`, `2d537bae…`.<br>• [#885](https://github.com/WangPantopus/skinny-pantopus/pull/885) (merged, batch 151): a pending claim is not a household member. Bundle `…-compose-pending-claimant-r1`, `ae63d979…`.<br>• All are real-API proofs; the cut compose UI was not exercised. Retained boundary/source-reuse bundlec300f084: acceptedR02postal clients unchanged; printedcrew/welcomecard/streetdigest are design-stage requirements, no new system authorized. Providerdelivery unverified. Existing mailbox route and preferences route contracts are preserved; PR178 repairs route ordering only. 2026-09-26: party-assign privacy fix ([#457](https://github.com/WangPantopus/skinny-pantopus/pull/457)); native read state ([#464](https://github.com/WangPantopus/skinny-pantopus/pull/464)); recoverable household-letter delete/dismiss with notices ([#512](https://github.com/WangPantopus/skinny-pantopus/pull/512), batch 27, bundle `20260926-stream2-mail-recoverable-delete-r1`). **Known gap, deferred by the user on 2026-09-26:** web Family Mail Party is dormant (banner never appears; `/app/mailbox/party` unlinked); Android works. Maybe a future build; no piecemeal fixes (CURRENT RESUME §2c). | **Launch scope: household letters OUT (cut 8); only postcards, welcome cards and the digest stay.** Printed crew postcards/welcome cards/street digest remain design-stage requirements; physical delivery/hosted providers are unverified. Accepted postal verification is reused under R02. No cut-letter acceptance task remains. |
| M03 | **Partial/open.** Existing pagination/read receipts are reused where recorded. | **Launch scope: mail history OUT (cut 8), and deferred by the user.** Large-household/history ordering, performance and cross-resource scale checks. |
| M04 | **Partial/open.** 2026-09-26: certified Received/Read/Signed and recipient-only signing on all three platforms ([#503](https://github.com/WangPantopus/skinny-pantopus/pull/503), bundle `20260926-stream2-certified-statuses-r1`). | **Launch scope: OUT (e-signing, certified and ceremonial letters, cut 8). Don't verify.** Reachable conversions, translations, physical-mail and neighbor-request behavior; no production path sends certified mail yet. |

## Former S2-xx UX items owned by Stream 4 (18 of 24; all resolved, owned for any regression)

| ID | Item (UX inventory 2026-09-23) | Disposition |
|---|---|---|
| S2-02 | Records "Add photo" fails silently (its backend route never existed) | fixed by #323 and #347 |
| S2-03 | Earn dashboard: help, refer, offer a service and "See all" open placeholders | fixed by #461 |
| S2-04 | Mail translation: "Reply" opens a placeholder; chips toast success for nothing | moot (no Translate entry; #369, #388); translation is cut (#8) |
| S2-07 | Mail action buttons announce success for actions that only log a click | fixed by #320 |
| S2-08 | Mail detail overflow menus are full of items that do nothing | fixed by #445 (and #388) |
| S2-09 | Home dashboard tabs never show their content | fixed by #321 |
| S2-11 | Dismissed mail stays in the Mailbox list | fixed by #445; household-letter Dismiss is now cut (#8) |
| S2-12 | A failed mailbox load says "Mailbox is empty", with no retry | fixed by #369 |
| S2-13 | Mail star, archive and delete failures are silent | web fixed by #369; the native household-letter parts are cut (#8) |
| S2-14 | Today tab tells residents to "Claim your address" when the homes call fails | closed after its merge (coordinator accounting, 2026-09-23/24) |
| S2-15 | Home dashboard "Property details" does nothing when opened from You | fixed by #422 |
| S2-16 | Unboxing and ceremonial-letter icons that do nothing | fixed by #451; ceremonial letters are cut (#8) |
| S2-18 | Opening a letter posts an invalid action, so lists and unread counts stay stale | web fixed by #369; native letter read state is cut (#8) |
| S2-19 | "File to Vault" and Translate fail silently | web fixed by #369/#388; the rest is household letters, cut (#8) |
| S2-20 | Home Issue, Bill and Package panels accept attachments that are never uploaded | fixed by #380 (the honest D02 constraint) |
| S2-21 | Place dashboard has no pull-to-refresh and stays stale after verification flows | fixed by #422 |
| S2-22 | Mail list: a failed "load more" replaces the whole list | fixed by #445 |
| S2-24 | "Property insights coming soon" when there is simply no valuation | fixed by #380 (already on master at the 2026-09-26 check) |

## Cross-cutting rows (`REMAINING_WORK` §10): Stream 4's cells of U02–U05

Added 2026-09-30T04:36:26Z. These rows sat in the former Stream 1's inventory, not in the former Stream 2's file, so the split's first proof (40 rows and 24 S2-xx items) didn't cover them.
- Stream 1's U02–U04 checklists (`checklists/`) cover only Streams 1 and 2's screens. For U05, each stream inventories its own screens.
- U01 (Home and unit identity) is Stream 3's.
- `check-stream2-split.py` now also proves that both files carry U02–U05.

| Row | Current disposition and bounded evidence | Remaining boundary before row closure |
|---|---|---|
| U02 | **Partial/open — itemized 2026-09-30 (section "Stream 4 exit checklists" below); web evidence.** The former Stream 2 ran real-Chrome sweeps of its 37 retained web routes, including this stream's web screens: dark-mode contrast ([#809](https://github.com/WangPantopus/skinny-pantopus/pull/809), `20260929-stream2-web-dark-link-contrast-r1`, `db25f76e…`: 12 targeted texts now pass, low-contrast styles 112 → 95), accessible names ([#819](https://github.com/WangPantopus/skinny-pantopus/pull/819), `20260929-stream2-web-a11y-names-r1`, `549cdcdb…`: 19 unnamed controls → 0) and a 390×844 layout sweep for owner and member (same seal: no horizontal overflow). #809 fixed the Place text action, the address-calendar Cancel and the health ring's "/100". | Native large text (Dynamic Type, font 2.0), VoiceOver and TalkBack, native dark mode and keyboard focus on this stream's screens. The remaining low-contrast styles are the brand-colour decision Stream 1 carries. |
| U03 | **Partial/open — itemized 2026-09-30 (below); recorded per row.** Error, retry, lost-reply, malformed-reply and cold-restart cases are accepted inside D01, D04, D09, I04, I07 and F02 (their bundles are in the checklist above). | Loading, empty, partial, unavailable, offline, slow, cancel, back, double-tap and process-death cases on this stream's screens where no row covers them yet. |
| U04 | **Partial/open — itemized 2026-09-30 (below); recorded per row.** F02's replies delivered across a logout are accepted on iOS (`edec37f4…`) and Android (`edee4120…`), and the web same-account permission change (`fe2bd74c…`); I07's mounted finite-authority expiry is accepted ([#773](https://github.com/WangPantopus/skinny-pantopus/pull/773), `5dadb5b8…`). | Long-lived sessions, background and foreground, and concurrent device or account changes on this stream's screens beyond those cases; the F02 native permission change (open work item 1). |
| U05 | **Not started — waits for the launch flags on master.** | This stream's screen and action inventory in the final release build on web, iOS and Android, for the release manifest Stream 1 assembles. |

## Stream 4 exit checklists (U02–U04), itemized 2026-09-30

Itemized from this stream's sealed evidence (bundle names are in the audit store; `MMDD name` = `2026MMDD-stream2-name-r1`, or `-stream4-` from 2026-09-30), using Stream 1's case names (`checklists/data.py`). This is a static list: Stream 1's generator isn't used, and the first read of the evidence was gathered read-only.
- **Legend:** ✅ done (sealed evidence) · ❓ confirm from existing evidence before any rerun · ⬜ to do · 🔷 user decision · ⛔ named boundary · – not offered on that client.
- **Row closure:** a row closes when every cell is ✅, –, ⛔ with its boundary, or 🔷 decided.
- **Native:** native cells can't run until the machine-wide native reinstall (the user's OK).

**U03 edge cases** — E1 server error; E2 lost reply; E3 double tap; E4 not allowed; E5 changed meanwhile; E6 bad input; R1 read failure; R2 empty.

| Workflow | iOS | Android | Web |
|---|---|---|---|
| Home health and seasonal checklist (complete, skip, carryover) | ✅ E2 (0927 checklist-uncertain-recovery)<br>✅ R1 (#661, #669)<br>❓ E1 E3 R2<br>⬜ E4 E5<br>– E6 (no typed input) | ✅ E2 (0927 checklist-uncertain-recovery)<br>✅ R1 (#661, #669)<br>❓ E1 E3 R2<br>⬜ E4 E5<br>– E6 | ✅ E2 (0927 checklist-uncertain-recovery)<br>✅ R1 (#661)<br>✅ R2 (#587)<br>✅ health follows on-page saves (#860)<br>❓ E1 (#578) E3 (API race only, #587)<br>⬜ E4 E5<br>– E6 |
| Bill benchmark: Home opt-in and Place Money signals | ✅ E1 R1 (#619, 0927 f02-member-finance, 0929 f02-ios-retry-late-delivery)<br>✅ E4 (f02-member-finance)<br>⬜ E5 permission change (open work item 1)<br>❓ R2, and whether native offers the opt-in | ✅ E1 R1 (#619)<br>✅ E4 (f02-member-finance)<br>⬜ E5 (item 1; the 09-30 capture is unsealed)<br>❓ R2 | ✅ E1 R1 (#602)<br>✅ E4 (f02-member-finance, 0930 f02-home-dashboard-bills)<br>✅ E5 (0929 f02-same-account-permission, 0927 f04-withdrawal)<br>✅ R2 (0927 f01-bill-cohort, f04-withdrawal)<br>❓ E2 E3 on the opt-in save |
| Place dashboard and section details (weather, air, alerts, civic, property; read-only) | ✅ R1 (#619, #638)<br>✅ R2 stale sun label (0927 sun-day-label)<br>✅ E4 (f02-member-finance)<br>⬜ election date parsing (iOS rejects date-only; #875 limits)<br>– write cases | ✅ R1 (#619, #638)<br>✅ R2 (#543, sun-day-label)<br>✅ E4<br>– write cases | ✅ R1 (#602)<br>✅ R2 (#543, sun-day-label)<br>✅ E4, with the refusal worded as a permission and no retry on the dashboard, sections and Pulse (#896)<br>✅ election day shown as that day (#875)<br>– write cases |
| Address calendar: pickup day (set, change, clear) | ✅ E1 E2 E3 E6 (0927 place-pickup)<br>✅ E4, generic wording (place-pickup)<br>✅ R1 (#737)<br>❓ R2<br>⬜ E5 | ✅ E1 E3 E6 (place-pickup)<br>✅ R1 (#737)<br>❓ E2 E4 R2<br>⬜ E5 | ✅ E1 E2 E3 E6 (place-pickup)<br>✅ R1 (#737)<br>❓ E4 R2<br>⬜ E5 |
| Home issues (report, edit, status, dismiss) | ✅ E1 malformed replies (#769)<br>✅ E2 (#740)<br>✅ E4 (#482)<br>✅ R1 (#680, #701)<br>❓ E3 E6<br>⬜ E5 on screen (API 409 only)<br>– cost edit | ✅ E1 (#769)<br>✅ E2 (#740)<br>✅ E4 (#482)<br>✅ R1 (#680, #701)<br>❓ E3 E6<br>⬜ E5 on screen<br>– cost edit | ✅ E1 (#654, #769)<br>✅ E2 (#740, #654)<br>✅ E3 E6 (#654)<br>✅ E4 (#482, #654, #835)<br>✅ R1 (#680, 0929 web-false-empty-sweep-r2)<br>✅ R2 (#529)<br>✅ E5: a stale edit no longer undoes another device's change (#906, merged in batch 159) |
| Emergency info (add, delete) | ✅ R1 (#698)<br>❓ add and delete E cases | ✅ E1 E3 E4 (PR189, PR191, PR192)<br>✅ R1 (#698)<br>❓ E2 | ✅ R1 (#698, #703)<br>✅ R2 (#755)<br>✅ E2 (#871)<br>✅ E1 E3, no change (0930 emergency-access-denied)<br>✅ E4: a permission sentence, no Retry or Add (#904) |
| Fridge card (issue, revoke; public page on web) | ✅ E1 (0928 fridge-lifecycle, #713)<br>✅ E2 issue (#717)<br>✅ E5 (#711)<br>✅ E6<br>✅ R1 by reopening (#707)<br>❓ E3<br>⬜ E2 revoke | ✅ E1 (#713, #715)<br>✅ E2 issue (#717)<br>✅ E5 (#711)<br>✅ R1 by reopening (#707)<br>❓ E3 E6<br>⬜ E2 revoke | ✅ E1 (#715)<br>✅ E2 issue and revoke (#717, #711)<br>✅ E5 public page after revoke<br>✅ E6<br>✅ R1 with Retry (#707)<br>❓ E3 |
| Maintenance history (manual logs: create, edit, delete) | ✅ E1 (#673, #677, #683, 0928 maintenance-delete)<br>✅ E2 (#673, #743, maintenance-delete)<br>✅ E3 (#673)<br>✅ E5 (#677)<br>✅ R1 by reopening (#687)<br>❓ R2<br>⛔ E4 E6 API only | ✅ E1 E2 E5 R1 (same PRs)<br>❓ E3 R2<br>⛔ E4 E6 API only | – no manual-log screen on web |
| Documents reader (list, delete) | ✅ R1 (#680, #701)<br>❓ R2<br>⬜ delete | ✅ R1 (#680, #701)<br>❓ R2<br>⬜ delete | ✅ R1 (#680, sweep r2)<br>✅ R2 (#541, #529)<br>✅ E4 (#529, #835)<br>⬜ delete E1 E2 E3 |
| Home activity | – no timeline screen (the native recent-activity card still shows raw codes: ⬜ native item) | – (same) | ✅ R1 (0928 home-timeline-pagination)<br>✅ labels and actor (#854)<br>✅ malformed rows (#863)<br>✅ concurrent insert (#854 bundle)<br>✅ follows on-page saves (#860)<br>✅ live updates from other devices: decided, re-read on focus/visibility/reload for launch ("Decided by Stream 4" item 4) |
| Mail: printed postcards, welcome cards, street digest (M01) | 🔷 not built (decision 2) | 🔷 | 🔷 (compose routes are live: security repairs #867/#872 through the API; the compose UI is cut, #8) |

**U04 lifetimes** — L1 background and return; L2 cold restart; L3 switch account; L4 session refresh.

| Area | iOS | Android | Web |
|---|---|---|---|
| Home dashboard and records (health, checklist, issues, emergency, fridge, maintenance, documents) | ✅ L2 (checklist-uncertain-recovery, #740, #743, #683, fridge)<br>⬜ L1 typed text survives<br>⬜ L3<br>⬜ L4 | ✅ L2 (same)<br>⬜ L1<br>⬜ L3<br>⬜ L4 | ✅ L2 reload<br>✅ mounted access expiry (#773)<br>✅ L3 (0930 home-account-switch: form sign-out/in, 0 private markers in 7 captures)<br>✅ L4 (0930 home-l1-l4: 401 → refresh → the same save once)<br>✅ L1 Emergency Info form kept (0930 home-l1-l4, emulated hide)<br>⬜ L1 dashboard panels: the accepted hide-time reset (d681da444) drops typed text; decided option (b), being built ("Decided by Stream 4" item 5) |
| Place (dashboard, sections, Money) | ✅ L2 (#638, f02-member-finance)<br>✅ L3 (0927 f02-ios-held-account, 0929 f02-ios-retry-late-delivery)<br>⬜ L1<br>⬜ L4 | ✅ L2 (#638)<br>✅ L3 (0927 f02-android-held-account)<br>⬜ L1<br>⬜ L4 | ✅ L2 reload<br>✅ L3 (0927 f02-web-held-account, 0930 home-account-switch; honest refusal #896)<br>✅ L1 (0930 home-l1-l4, emulated hide: same screen, no re-read)<br>⬜ L4 (Place's own actions not run; the shared refresh path passed on the dashboard) |
| Address calendar | ✅ L2 restart (place-pickup)<br>⬜ L1 L3 L4 | ✅ L2 cold (0928 pickup-weekly)<br>⬜ L1 L3 L4 | ✅ L2 reload (pickup-weekly)<br>⬜ L1 L3 L4 |

**U02 accessibility** — A1 largest text; A2 dark mode; A3 contrast; A4 screen reader; A5 keyboard (web).

| Screen | iOS | Android | Web |
|---|---|---|---|
| Home dashboard: health, checklist, property, bill trends, Home activity, Today and record cards | ⬜ A1 A2 A3 A4 | ⬜ A1 A2 A3 A4 | ✅ A1 A4 A5 (0930 web-a11y; first screen)<br>✅ A5 expanded Maintenance card: issue rows now keyboard-reachable (#907, merged in batch 159; before, mouse-only)<br>✅ A2 health ring "/100" (#809)<br>🔷 A3 brand-colour token (health chip amber 1.87:1; routed to the coordinator) |
| Place dashboard and section details (incl. Money, civic, address-calendar editor) | ⬜ A1 A2 A3 A4 | ⬜ A1 A2 A3 A4 | ✅ A1 A4 A5 (0930 web-a11y)<br>✅ A2 Place text action and calendar Cancel (#809)<br>🔷 A3 |
| Records pages: Issues (Maintenance), Emergency Info, Documents | ⬜ A1 A2 A3 A4 | ⬜ A1 A2 A3 A4 | ✅ A1 A4 A5 (0930 web-a11y)<br>✅ A2 partial (#809)<br>🔷 A3 |
| Fridge card and its public page | ⬜ A1 A2 A3 A4 | ⬜ A1 A2 A3 A4 | ⬜ A1 A2 A3 A4 A5 (not swept) |
| Maintenance history (app only) | ⬜ A1 A2 A3 A4 | ⬜ A1 A2 A3 A4 | – |
| Mail postcards, welcome cards, digest | – not built (🔷) | – | – |

**U05** — not started; it waits for the launch flags on master (this stream's screen and action inventory for Stream 1's release manifest).

## Runtime, devices and kit (shared with Stream 3; lease label `stream4:`)

- **Kit:** `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit/` ([README](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit/README.md)). Tools are in `tools/`, stages in `runtime/`. The audit store is `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`. Names containing `stream2` keep them.
- **Isolated runtime** (never production; restart recipe in the kit README and the history file's 2026-09-27 CURRENT RESUME §3):
  - DB 64554 (`supabase_db_pantopus-stream2-native-resume-r2`, Kong 64553);
  - fault proxy 18142 (rules via `POST /__s2fault/set|clear`);
  - backend 18143 (log restarts in `runtime/backend-restarts.log`);
  - web 18144, which hot-reloads the checked-out branch of `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream2-mail-journey-18b50a`.
- **Exclusive runtime lease** (new 2026-09-30; the two streams share one runtime):
  - Take it with `zsh tools/runtime-lease.sh acquire '<label>: <purpose>'` before creating or cleaning fixtures, setting fault rules, restarting the backend, switching that worktree's branch, taking a whole-DB baseline or driving the devices below.
  - Release it with `zsh tools/runtime-lease.sh release '<label>'`, and check the holder with `status`.
  - A baseline is valid only inside the lease it was taken in.
- **Code and the shared worktree:** write code in your own session worktree, on a branch from current master. Check your pushed branch out in the shared worktree above, or edit it, only while holding the runtime lease, and keep its uncommitted `.claude/launch.json`.
- **Labels:** `stream2:` and `claude/stream2-…` now belong to the new Stream 2 (Posts, Hub and payments). The kit's `stream2` path names are history only.
- **Devices,** only while holding the runtime lease:
  - **Missing since the 2026-09-30 cleanup (checked 2026-09-30T05:58:25Z):** the Android SDK, every AVD (including the one below) and `~/.gradle`, and every iOS simulator runtime; sim 6F914A30 is still listed but can't boot. Reinstalling them needs the user's OK;
  - emulator-5556 (AVD `Pantopus_Home_Recurrence_Acceptance`) and iOS sim 6F914A30, both through `/private/tmp/pantopus-tools/device-slot.sh`;
  - heavy builds through `/private/tmp/pantopus-tools/heavy-slot.sh`;
  - the shared iOS driver by announcing the take and the release to the other streams.
  - On 2026-09-30 the per-cell build copies and the iOS DerivedData were deleted to free disk, so the next native builds are full rebuilds.
- **Retained fixtures — deleted with the database by the Docker reset (2026-09-30T05:51:48Z).** Recreate only what a journey needs, from the bundle that first made it. They were:
  - Home105 "S2 First Load Home 2";
  - Home70 "Stream2 Resume Home" (owner + member B as a verified member);
  - cohort Home 9d885f71 with 9 neighbor homes (the F01 benchmark);
  - SQL Homes abe5a8c9 and d4eaed7e.
  - The fixture accounts' credentials are still in `runtime/accounts.env`, but the accounts must be recreated in the new database. Never print the file; type values with the kit's secret tools only.
- **State at the split:** Docker Desktop has been down since ~03:30Z on 2026-09-30 (disk full), so the runtime is unreachable until the user restarts it. No runtime lease, device slot, heavy slot or iOS driver is held.
- **Since 2026-09-30T05:51:48Z:** Docker Desktop is back but reset (empty), so the shared runtime must be rebuilt before any runtime work. The steps are in the resume prompt §2. Until then, proxy 18142, backend 18143 and web 18144 still run from before the reset, pointing at the deleted database.

## Rules carried over from the former Stream 2

- Read `AGENTS.md`, `docs/PROJECT_HANDOFF.md` and the hub [README](README.md) (the renumbering notice and the 2026-09-27 LAUNCH SCOPE block at the top).
- **Launch scope (2026-09-27):** never verify, test or fix the eight cut features. If a finding lands in a cut area, note it as cut and move on.
- **Verify before changing:** reproduce first, then make the smallest repair in the existing implementation. No new screens, schemas, migrations, services or replacement architectures, and no duplicate trackers. Preserve designs; propose any unavoidable design change.
- **Evidence protocol:**
  1. Write `DECISION.md` first, with its time from `date -u` (from the lease log).
  2. Take a whole-DB baseline with `tools/fp.py snap`.
  3. Capture befores and afters in the real apps.
  4. Run the exact cleanup: preimage digests, and every non-auth table equal to the baseline before COMMIT.
  5. Seal with `tools/seal-bundle.py`.
  6. Open a PR whose body ends with the Claude Code line.
  7. Hand the head and seal to the coordinator, then add an entry at the top of this file's live block.
- **Merge policy:** required CI is off. A PR merges once it's verified end to end in the real apps with sealed evidence and reviewed. The Stream 1 queue owner (the coordinator) batches and merges; send it head + seal.
- **Never:** the physical iPhone; the founder's environment (docker stack `pantopus-home-gig-replay` on 64521/64522, backend :8000, simulator EB5AD759); production providers; real user or payment data; credentials, tokens, raw logs or DB archives in Git or chat (never print `runtime/accounts.env`); destructive git (reset, stash, clean, gc, worktree removal).
- **Times and SHAs:** record every time from `date -u` and every SHA from `git rev-parse`. Never estimate them.

## Live continuation — Stream 4 (newest first)

- **2026-09-30T08:55Z — #906 and #907 merged; native toolchains are ready.**
  - #906 and #907 merged in batch 159 ([#909](https://github.com/WangPantopus/skinny-pantopus/pull/909), tip `0f302700c`, 08:51:58Z, master `add968868`).
  - The coordinator decided the two shared items: WCAG-AA brand colours (Stream 1 implements them) and a staging pass before launch.
  - **Toolchains ready** (hub `177c17d44`). Streams 3 and 4 share AVD `pantopus_s34` (port 5562) and simulator "Pantopus S34" (iPhone 17, `DA8C2A5F-39BC-421D-9F18-EB4B481E506F`) under the runtime lease. Boot only after `device-slot.sh acquire`; builds go through `heavy-slot.sh`. The native queue (open work item 9) is unblocked.
  - The typed-draft fix (decision 5) is at `3ce02567e` and waits for the runtime lease (Stream 3 holds it).

- **2026-09-30T08:50Z — [#906](https://github.com/WangPantopus/skinny-pantopus/pull/906) and [#907](https://github.com/WangPantopus/skinny-pantopus/pull/907) are with the coordinator; Stream 4's pending decisions are decided.** The user's direction (~08:36Z) was to decide for the best UX, safety, security and retention, record the decision, and keep working. Lease 08:34:48Z–08:47:30Z.
  - **#906 (issues E5).** Head `e995dbd266326b417185279c2b658c09972789e6`. Bundle `20260930-stream4-issue-changed-meanwhile-r1`, MANIFEST `0acf0d98b3e0f33c6983f34394306178d9c50a122c56604c170607994ac6daed`.
    - Before, with two real sessions: B dismissed the issue, then A's stale panel saved a title edit that resent status 'open'. The DB showed the issue open again.
    - After: A sends {title} only, and the DB keeps 'canceled'.
  - **#907 (U02 A5).** Head `2930c4d7fe04d422fed8ef29dfacdd4399f32983`. Bundle `20260930-stream4-maintenance-rows-keyboard-r1`, MANIFEST `e0fddb66b30764283be0bac17b814d1256c89c60c7f34076a43119eeeeca79d7`.
    - The expanded Maintenance card's issue rows were mouse-only. They are now keyboard-reachable with a focus ring.
    - The same run confirmed that a default member may save the household pickup day (200), so address-calendar E4 needs no change.
  - **Backend restart.** I restarted the backend under the lease at 08:41:57Z (PID 97799, logged) to reset the in-memory login limiter (10 per 15 min per IP), which this run's sign-ins had used up. It runs master `88149d747`'s backend code, with no migration change.
  - **Decisions.** See "Decided by Stream 4": D02 launches without issue media; M01 is after launch; F04 adopts the implemented opt-in, k≥10, 24-month policy; I07 keeps option (a) for launch; the dashboard's L1 drafts get option (b), being built. The two shared items went to the coordinator.

- **2026-09-30T08:32Z — #904 merged** in batch 158 ([#905](https://github.com/WangPantopus/skinny-pantopus/pull/905)), master `88149d747`. The coordinator recorded the redaction correction and the L1 proposal in the hub. **Native toolchains:** the coordinator reports that the user approved the reinstall. Stream 1 is doing it for all streams under the heavy slot; no xcodebuild, gradle or simulator/emulator work until Stream 1 announces "toolchains ready".

- **2026-09-30T08:29Z — [#904](https://github.com/WangPantopus/skinny-pantopus/pull/904) (web Emergency Info 403 wording) is with the coordinator; U04 L1/L4 checked on web; a redaction claim corrected.** The runtime lease ran 08:15:54Z–08:23:48Z and 08:23:50Z–08:26:20Z, then went to Stream 3 at their request. The runtime is on master `66d57bcfe` (backend PID 82416, untouched by me).
  - **#904.** Head `5fda6b6fd465f1da120ed0a3db22013fb4d601ae`. Bundle `20260930-stream4-emergency-access-denied-r1`, MANIFEST `76bb652470dd0c56b0ff72afded0144b75e97a3d3579d733e39143c909a5d4b4`.
    - Before: a non-member saw "could not be loaded", a Retry that repeated the 403, Add and a toast.
    - After: a permission sentence only. The owner's emulated 503 keeps Retry.
    - Web E1 and E3 pass with no change. Cleanup 351/353.
  - **U04 web (verification).** Bundle `20260930-stream4-home-l1-l4-r1`, MANIFEST `3d14dae834c93cbc29e1b0e4c36d1f72024656c352c67f7d8ddfb2fedbfcf7bc`.
    - L4 passes: 401 → refresh → the same save once, with 1 row in the DB.
    - L1, with an emulated hide (headless Chrome never hides a tab, so the plain tab-switch pass isn't counted): the Emergency form and Place keep their state. The Home dashboard's accepted hide-time reset drops panel text; proposal in "Waiting on the user" item 5.
  - **Correction.** The sealed reports of `20260930-stream4-home-account-switch-r1`, `…-place-access-denied-r1` and `…-place-access-denied-pulse-r1` say account emails are redacted in the evidence.
    - Their text and JSON are redacted, but their screenshots show the app sidebar's signed-in label: a truncated prefix of the synthetic fixture account's email. No full address, password, token or key.
    - The bundles stay sealed as they are. Other screenshot bundles from today show the same label but make no claim.
    - From now on, screenshots mask that label at capture. The new Emergency bundle's earlier captures were covered after capture, as its `screenshot-masking.json` records.

- **2026-09-30T08:02Z — #896 merged.** Batch 155 ([#897](https://github.com/WangPantopus/skinny-pantopus/pull/897), tip `8a1bb0d30`) merged at 08:02:08Z, and #896 shows MERGED at head `2ed7aba70` at 08:02:10Z. Master is `66d57bcfe`. The coordinator verified all three seals (hub record `df8eadda1`). No Stream 4 PR is open.

- **2026-09-30T08:01Z — U04 web L3 verified on the Home dashboard; its one finding is repaired in [#896](https://github.com/WangPantopus/skinny-pantopus/pull/896) (with the coordinator).** The lease was released at 08:00:25Z. The runtime is on master `919305835`, and the DB is back at its baseline.
  - **L3, switch account (no code change).** Bundle `20260930-stream4-home-account-switch-r1`, MANIFEST `35e72f307850072cb7c5405196e8e50577c9ae1826e87c6d77a62f5ac653fd73`. One real Chrome profile, with real form sign-in and Settings → Log Out.
    - The owner saw their own Home.
    - Member B then opened the same dashboard and the Place page with `?home=` for that Home: 0 private markers in 7 captures (0.3 s, 1.2 s and 4 s), and the reads answered 403.
    - Exact cleanup: 351 of 353 tables equal; the other 2 hold only auth history.
  - **Finding, repaired in #896.** Head `2ed7aba70f1358e22dd6e2414279df5064719658` (2 commits on master `57173fa22`).
    - Before: for that refusal, the Place dashboard, section details and Pulse said "Something went wrong · … Check your connection and try again", with a Try Again that only repeated the 403.
    - After: "This place isn't available · You don't have permission to view this place.", with no retry. Other failures keep Try Again.
    - 3 web files, no layout change; the wording follows #835.
    - Bundles: `20260930-stream4-place-access-denied-r1` (MANIFEST `650fde8e2db32f536e86b113c7ccc41cdc59fe3edf75b65315adfc19f9b31093`; dashboard and Money detail; emulated 503 and lost-reply regressions; 351/353) and `20260930-stream4-place-access-denied-pulse-r1` (MANIFEST `8dd2415e366ff9fcf756ec3a22386aec8e2788f35ed4a1779ed30a8d9166a463`; 353/353).
    - Checks: ESLint, the type-check gate and web Jest 122/1893.
  - **Kit.** `tools/s4-secret-scan.py` is the strict pre-seal scan: it exits 1 on any hit, and a positive control with a planted email failed it as designed. The backend runs behind `runtime/egress-guard.cjs`, which allows loopback only.
  - **Cleanup pattern.** Member B's first visit in a run lazily creates a `MailPreferences` default row. Remove it as an extra scope, by user and time.

- **2026-09-30T07:45Z — #882 and #885 merged; this stream's U02 web cells verified (no code change).**
  - **Merged:** #882 (D09 health/checklist readers) and #885 (compose pending claimants) in batch 151 ([#887](https://github.com/WangPantopus/skinny-pantopus/pull/887), master `81bfda802`).
  - **U02 web.** Bundle `20260930-stream4-web-a11y-r1`, MANIFEST `368aa2c7467bb935aba8b5f59f5bdb5eafba4170bb97775b57d2de977232659f` (64 files). It used Stream 1's accepted tool, adapted to this runtime, on 12 screens: the Home dashboard, Issues, Emergency, Documents, Property Details, and the Place dashboard plus six details.
    - A1: nothing scrolls sideways at 200% zoom.
    - A5: every control is reached by keyboard with a focus ring (only the dev overlay has none).
    - A4: no name or label violations.
    - Contrast: every finding is the shared accent token (primary-500/600, emerald-600, amber-500), so that stays the user's design-token decision. The lowest is the health ring's amber "Add contact" chip at 1.87:1.
  - **Correction:** my first seal of this bundle (`04e3faf4…`) was withdrawn before use. Its JSON held the synthetic owner account's email as the page shows it; the scan flagged it, but my command sealed anyway. It was resealed with the email redacted, the scan now fails hard, and the tool redacts. No password, token or key was involved.

- **2026-09-30T07:34Z — [#882](https://github.com/WangPantopus/skinny-pantopus/pull/882) (D09) and [#885](https://github.com/WangPantopus/skinny-pantopus/pull/885) (compose) are with the coordinator, and I05's local parts are verified.** The lease was released at 07:33:31Z; the runtime is on master `3bf2cde34`.
  - **#882, the web health and checklist readers.** Head `58502ba61`, bundle `20260930-stream4-intelligence-reader-shape-r1` (`c44de224…`, 28 files).
    - Before, with emulated malformed 200s: `topIssue` as an object, `topAction.label` as an object, a null checklist row, or a checklist title as an object each made the whole app show "We hit a page error".
    - After: only that card shows its unavailable state and Retry, and a real Retry recovers.
  - **#885, a pending claim is not a household member in compose** (the lead from #867/#872). Head `5f9206776`, bundle `20260930-stream4-compose-pending-claimant-r1` (`ae63d979…`, 16 files).
    - Before, through the real API: the owner's household search listed a pending claimant with the Home's street address, and home-context counted them (2, private delivery on).
    - After: they are no longer listed (count 1). The trusted statuses come from `homeMailAccess`'s one definition.
  - **I05, verification only.** Bundle `20260930-stream4-property-local-r1` (`c4a8a189…`).
    - With an expired ATTOM cache, the card shows "$612,000 … Updated May 2026" (`cache_stale`), so the figure carries its age.
    - Absent data shows "No estimate available".
    - Property Details reads "No Property Data Available · Property records are not configured in this environment yet", which implies no failed verification.
    - Observation, not a defect: the card and the details page read different sources.

- **2026-09-30T07:26Z — #875 (I06 election date) merged** in batch 148 ([#878](https://github.com/WangPantopus/skinny-pantopus/pull/878), master `444059705`). Stream 1 also checked that date-only and timestamp inputs both give "Tuesday, November 3, 2026". No Stream 4 PR is open. Next, queued behind Stream 3's lease: I05 local verification and a D09 health-reader guard.

- **2026-09-30T07:24Z — I04: pickup days hold across the DST changes (verification only, no code).** Bundle `20260930-stream4-address-calendar-dst-r1` (MANIFEST `f6cf00d3fced2ed1ade7aba8b4f0ba80ca1d6508a32d6c3fa565f0027bfa1972`, 7 files).
  - The real `addressCalendarService` at master `b16eca646` ran with an injected clock and the rules the product writes (the database module was stubbed to refuse any access).
  - 8 of 8 cases pass around fall-back (2026-11-01, including both passes of the repeated hour and a late Sunday that is already Monday in UTC) and spring-forward (2027-03-14). Dates stay on Mondays, `days_until` counts the Home's local days, and biweekly recycling lands on the right weeks.
  - The web card's own label logic gives the same weekdays in Pacific, Eastern and Hawaii time.
  - A first run's wrong spring expectation (recycling on Mar 15) is kept, labelled as a harness error.
  - Limits: service-level with an injected clock, not an end-to-end run at a real DST instant; Homes have no time zone yet (Pacific default); holiday moves stay a named provider boundary.

- **2026-09-30T07:20Z — #871 and #872 merged; U02–U04 itemized.**
  - #871 (D01 emergency receipt) and #872 (security: compose connections, City/State only) merged in batch 147 ([#876](https://github.com/WangPantopus/skinny-pantopus/pull/876), master `b16eca646`). Stream 1 verified both seals and ran the backend suites (171/171).
  - Open work item 8: this stream's U02–U04 cells are itemized in "Stream 4 exit checklists" (commit `9acc98088`), from sealed evidence only. The unclear cells are marked ❓ for confirmation from existing evidence before any rerun.
  - Still open: [#875](https://github.com/WangPantopus/skinny-pantopus/pull/875) (I06), in review.

- **2026-09-30T07:18Z — I06: [#875](https://github.com/WangPantopus/skinny-pantopus/pull/875) is with the coordinator (the web Place election banner showed the day before).** Head `139ba1d83`, bundle `20260930-stream4-civic-election-date-r1` (`63787428…`, 24 files).
  - **Before, on master in real Chrome:** the `civic_election` envelope was EMULATED to the Civic API's date-only `"2026-11-03"`. Pacific, Eastern and Hawaii showed "NOV 2 · Monday, November 2, 2026".
  - **After:** the day is read at noon UTC, so every zone shows "NOV 3 · Tuesday, November 3, 2026".
  - **Named, not changed:**
    - the backend's `days_until` and "upcoming" filter are UTC-based (the election drops out at 5 PM Pacific on Election Day), which needs the provider to verify;
    - iOS's ISO parser rejects date-only strings (native is blocked).
  - Exact cleanup; the lease was released at 07:17:39Z.

- **2026-09-30T07:14Z — #867 merged; D01 [#871](https://github.com/WangPantopus/skinny-pantopus/pull/871) and SECURITY follow-up [#872](https://github.com/WangPantopus/skinny-pantopus/pull/872) are with the coordinator.**
  - **#867 merged** in batch 145 ([#868](https://github.com/WangPantopus/skinny-pantopus/pull/868), master `759a67943`). The coordinator passed the two extra fixes to the user.
  - **#871 (D01), emergency info created twice after a lost reply.** Head `a363a61af`, bundle `20260930-stream4-emergency-create-receipt-r1` (`8e1804d4…`, 32 files).
    - Before, in real Chrome on master: the first Add committed, but its reply was lost (emulated), so the page said "Failed to add emergency info". The retry made a second identical row.
    - Fix: the #740 `clientRequestId` pattern. After: 1 row.
    - API controls pass: unchanged retry, 409 for a changed payload, a concurrent pair, no id, and an invalid id.
    - Web only; native create sends no id yet.
  - **#872 (security, location-privacy-matrix: non-household gets City/State only), compose connections.** Head `53e9a37f3`, bundle `20260930-stream4-compose-connections-privacy-r1` (`2d537bae…`, 16 files).
    - Before: connection search results and home-context through the connection path returned the full street address and the Home photo; home-context also returned the member list.
    - After: "City, State", no photo, no member list. The homeId is kept to address mail. The household view is byte-identical.
  - **Lead, not fixed:** a Home's pending claimants appear to its real members in the compose household block and in home-context's member list. Nothing reaches outsiders.
  - The lease was released at 07:13:48Z; the runtime is on master `f82d24a18`.

- **2026-09-30T07:02Z — SECURITY: [#867](https://github.com/WangPantopus/skinny-pantopus/pull/867) is with the coordinator (compose recipient search and home context).** Head `73869f1a0` (2 commits, one file `backend/routes/mailCompose.js`). Bundle `20260930-stream4-compose-recipients-privacy-r1` (`12b432cc…`, 16 files).
  - **Real-API before, on master, with my own 3 synthetic Homes:**
    - a non-member searching `homeId=Z` got Z's occupant and street address;
    - a `pending_approval` claimant got P's address;
    - the general search attached the matched users' Home, address and photo;
    - `home-context` gave a pending claimant P's member list and address.
  - **After:**
    - the household block requires the household-mail rule (`getAccessibleHomeIds`);
    - general matches carry no Home;
    - `home-context` uses the same rule, so a pending claim gets 403;
    - member replies are byte-identical; connections are unchanged.
  - **Scope:** beyond the coordinator's brief, this also fixes the general-search addresses and the `home-context` pending claim. Both are recorded for the user.
  - **Checks:** backend Jest 341/6286 and the privacy gates pass. Exact cleanup (351/353, auth only); the lease was released at 07:01:28Z.

- **2026-09-30T06:57Z — #860 and #863 merged; the compose-recipients privacy fix is waiting for the runtime lease.**
  - **[#860](https://github.com/WangPantopus/skinny-pantopus/pull/860) (I07), merged in batch 142 ([#861](https://github.com/WangPantopus/skinny-pantopus/pull/861), master `68f2daa24`):** web Home health and Home activity now follow saves made on the dashboard. Head `18db71759`, bundle `20260930-stream4-dashboard-summary-refresh-r1` (`badd163e…`, 39 files).
    - Before, on master in real Chrome: after Report Issue, health stayed "55 /100" (the server said 45); after Add Task, activity still said "No activity recorded yet". Both corrected only on reload.
    - My hypothesis that the Today counts were also stale was wrong: the useHomeData reducer already recomputes them, so no count change was made.
    - Fix: re-read health after an issue save, and the timeline after a task save or delete (the existing reloadSummary).
  - **[#863](https://github.com/WangPantopus/skinny-pantopus/pull/863) (D09/I07), merged in batch 143 ([#864](https://github.com/WangPantopus/skinny-pantopus/pull/864), master `eff3f69f5`):** a malformed Home activity row no longer takes down the web dashboard. Head `881b4dcb1`, bundle `20260930-stream4-timeline-reader-shape-r1` (`5048251f…`, 26 files).
    - Before, with EMULATED malformed 200s: a null row, or a row without action/time, made the whole app show "We hit a page error"; an unreadable time rendered "INVALID DATE".
    - After: the card's own "could not be loaded" state and Retry take over.
  - **Security, routed by the coordinator:** `GET /api/mailbox/compose/recipients` returned any Home's occupants with its street address for a two-letter query, with no membership check.
    - I also found that its general search attached every matched user's Home, street address and photo.
    - Fix on `claude/stream4-compose-recipients-privacy` (head `b027d95a9`, one file): the household block uses the household mail rule (`getAccessibleHomeIds`), and general matches carry no Home or address. Connections are unchanged.
    - Backend Jest (341 suites) and the privacy gates pass. The real-API before/after waits for the runtime lease, which Stream 3 holds for the D06 map exposure.

- **2026-09-30T06:26:57Z — #854 merged** (batch 139, [#855](https://github.com/WangPantopus/skinny-pantopus/pull/855), exact tip `710d80d4f`; master `67e3a458a`). Stream 1 verified the seal (38 files, integrity OK) and the batch (1 file, blob-equal).

- **2026-09-30T06:25:19Z — I07 web Home activity labels: [#854](https://github.com/WangPantopus/skinny-pantopus/pull/854) is with the coordinator.** Head `b290d6c90dc940edc7bfabfdc401465a43f0f0c5` (base `ed5ea9ec5`; `git merge-tree` is clean against master `1d5e76d85`). Sealed bundle `20260930-stream4-home-activity-labels-r1`, 38 files, MANIFEST `1c2c0d0cc37656c06a180e49d38e07877d7df60c31e09557414d257e10676562`.
  - **Before, on master and in real Chrome as the owner:** `GET /api/homes/:id/timeline` returned raw `HomeAuditLog` rows. The dashboard card therefore showed codes ("HOME ACCESS SECRET DELETE", "member override", "home checklist updated" for both a completion and a skip) and never an actor. That was true even for member B's task.
  - **Fix, in one backend file:** the route now returns the declared `HomeTimelineItem` contract. `description` comes from a label table beside the route: checklist completed/skipped, a member leaving, and a readable sentence for any other code. `actor_name` comes from `displayNameFromUser`.
  - **Unchanged:** the gate (members.manage; B still gets 403), ordering, pagination and the card itself.
  - **After:** "Access code added", "Checklist item completed", "Member permission changed" and so on, each with "· By …". API pagination is 5/5/2.
  - **Also verified, no code change:** concurrent-insert pagination. With 22 real rows, a save while page 1 was mounted made Load more re-serve page 1's last row; the card de-duplicated it (22 shown, 0 omissions). The new event appears after a reload.
  - **Checks:** 15 Jest suites (334 tests) and the privacy gates pass.
  - **Cleanup:** exact, over the 103-FK graph: 32 fixture rows deleted, 351/353 tables equal the 06:16:49Z baseline (auth history only).
  - **Runtime:** the lease is released, and the shared worktree and backend 18143 are back on master (PID 19670).
  - **Limits:**
    - web only;
    - native's own recent-activity card still humanizes raw codes (native tooling is missing);
    - there are no live timeline updates;
    - `created_at` ties aren't reproduced;
    - the Members & Security audit list (Stream 3's D07) has the same wording, and I told Stream 3.

- **2026-09-30T06:12:19Z — the shared runtime is rebuilt (by Stream 3), and Stream 4 is on web and API work.** Stream 3 rebuilt it from master `ed5ea9ec5`: stack `pantopus-stream2-native-resume-r2` on 64553/64554/64558, new keys in `runtime/supabase.env`, and the owner and member B recreated with their original ids. There are no Homes or fixtures; recreate only what a journey needs. Native tooling is still missing, so F02's iOS part stays queued, and I started open work item 2 (I07) on web.

- **2026-09-30T05:58:25Z — native tooling is gone too.** Stream 1's cleanup record (hub, 05:57Z), confirmed read-only: the Android SDK, every AVD and `~/.gradle` are missing, and Xcode has no iOS simulator runtime (sim 6F914A30 is listed but can't boot). The kit, the 528 audit bundles and the fixture password file survived. Reinstalling needs the user's OK. Until then this stream runs the runtime rebuild and web or API work only; the resume prompt says so.

- **2026-09-30T05:56:47Z — Docker was reset; the shared runtime is gone.** Docker Desktop came back with a disk image re-created at 05:51:48Z: 0 containers, 0 volumes. DB 64554 and every retained fixture and fixture account went with it; so did the founder's stack, which is the user's. The open F02 fixture went with it, so it was never exactly cleaned; its unsealed Android capture is still on disk, and open work item 1 now starts by recreating the cohort. The resume prompt now puts the runtime rebuild first and names the coordination checkout's full path, because a pasted prompt lost its location. Nothing is held.

- **2026-09-30T04:40:59Z — #848 merged; no Stream 4 PR is open.** Batch 137 ([#849](https://github.com/WangPantopus/skinny-pantopus/pull/849)) merged at 04:40:14Z, so master is `ed5ea9ec5`. Master's copies of the five Stream 3/4 files equal coordination `20019853b`, not this branch's tip: `8b7f26d85` later added only the #848 line to each live block. My handoff note said "blob-equal to coordination" without naming the commit, and Stream 1 corrected it. The resume prompt's state line is refreshed.

- **2026-09-30T04:36:26Z — this stream's U02–U05 cells added (split completeness).** These cross-cutting rows sat in the former Stream 1's inventory, so the first split proof missed them. Each of Streams 3 and 4 now carries its own U02–U05 cells, citing the recorded web sweeps and row evidence, and U01 is Stream 3's. `check-stream2-split.py` proves it. Master is `d1ba0b28d`: #846 split the former Stream 1 into Streams 1 and 2, with no change to this stream's rows. Docker still isn't answering, and nothing is held. Docs PR [#848](https://github.com/WangPantopus/skinny-pantopus/pull/848) (head `3dd2e5e35`, docs only) copies this and the 04:25Z prompt refresh to master; it's with the coordinator.

- **2026-09-30T04:25:38Z — the split's docs PRs are merged; prompts refreshed.** #843 and #844 merged at 04:24:12Z, so master `15711c8dc` carries the split. No Stream 4 PR is open. The resume prompt now names the new Stream 2's `stream2:` label and the shared-worktree rule. The runtime-lease lock moved to `/private/tmp/pantopus-stream3-stream4-runtime-lease`.

- **2026-09-30T04:16:32Z — Stream 4 created by splitting the former Stream 2** (user direction).
  - Rows: I01, I02, I03, I04, I05, I06, I07, D01, D02, D03, D04, D09, F01, F02, F03, F04, F05, M01, M03, M04.
  - UX items: S2-02, S2-03, S2-04, S2-07, S2-08, S2-09, S2-11, S2-12, S2-13, S2-14, S2-15, S2-16, S2-18, S2-19, S2-20, S2-21, S2-22, S2-24.
  - Decisions: 3 own + 2 shared.
  - The open F02 fixture (above) is this stream's first item.
  - History up to the split: the "Live continuation — 2026-09-27, Codex Stream 2" block in [`former-stream2-home-household.md`](former-stream2-home-household.md). Docker is down; nothing is held.
