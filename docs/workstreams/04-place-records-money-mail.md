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

## CURRENT RESUME — Stream 4 (start here; handoff written 2026-09-30T22:19:24Z)

**Scope.** What a home knows and keeps:
- Place and home intelligence: the health score and seasonal checklist, the address calendar, property data, weather/air/alerts/civic, and timeline freshness (I01–I07);
- home records: issues and emergency info, issue media, maintenance history, and the document/issue/access/share readers (D01, D02, D04, D09);
- money signals and the bill benchmark (F01, F02, F04, F05);
- mail, kept only for postcards, welcome cards and the digest (M01);
- this stream's cells of U02–U05 (U01 is Stream 3's).
- D03, F03, M03 and M04 are fully cut for launch.

**Launch-scope owner:** Stream 4 checks cut #7 (Household extras) and cut #8 (Mail extras) for the former Stream 2's area. Never verify, test or fix them.

**State at handoff (2026-09-30T22:19Z).**
- **Master:** `a211e1f48`. **All ten, #1102–#1111, merged in batch 223** ([#1112](https://github.com/WangPantopus/skinny-pantopus/pull/1112);
  GitHub mergedAt 22:20:48–49Z). Stream 4 has **no open PRs**.
  - The coordinator checked every head against its seal and ran verify-batch on top of batches 220–222: 46 files, 33
    blob-equal and 13 hunk-proved.
  - The queue now belongs to the next Stream 1 session (prompt `NEXT-STREAM1-PROMPT-2026-09-30-evening.md`; batches continue at
    224). Send new sealed heads there.

  | PR | Head | What | Evidence |
  |---|---|---|---|
  | [#1102](https://github.com/WangPantopus/skinny-pantopus/pull/1102) | `09ece6779` | Your home: no invented value trend (web, iOS, Android) | fixes §1 |
  | [#1103](https://github.com/WangPantopus/skinny-pantopus/pull/1103) | `c7073adfd` | Place detail locked "Verify address" and the density CTA open the verify sheet; iOS Pulse nudge closure labelled | verify-r2 |
  | [#1104](https://github.com/WangPantopus/skinny-pantopus/pull/1104) | `7d0268a2f` | Documents name the uploader instead of a raw user id (backend `uploaded_by_name`) | fixes §3 |
  | [#1105](https://github.com/WangPantopus/skinny-pantopus/pull/1105) | `f61d20a4c` | Maintenance: no false "No maintenance logged yet" on an empty Scheduled tab | fixes §4 |
  | [#1106](https://github.com/WangPantopus/skinny-pantopus/pull/1106) | `19d997ec8` | Fridge composer remove-row: a name and a usable target | fixes §5 |
  | [#1107](https://github.com/WangPantopus/skinny-pantopus/pull/1107) | `372fecdc8` | Android Place avatar: the monogram, not "RC" | fixes §6 |
  | [#1108](https://github.com/WangPantopus/skinny-pantopus/pull/1108) | `2aeef6b55` | Android large text: five breaks and clips fixed; nothing changes below font scale 1.5 | fixes §7 |
  | [#1109](https://github.com/WangPantopus/skinny-pantopus/pull/1109) | `710a02c03` | Warranties chip text meets AA (4.42 → 6.15), plus the results golden | fixes §8 |
  | [#1110](https://github.com/WangPantopus/skinny-pantopus/pull/1110) | `589f46637` | Civic empty state: only the date is promised (web, iOS, Android) | fixes §9 |
  | [#1111](https://github.com/WangPantopus/skinny-pantopus/pull/1111) | `3c2b76535` | Weather safety: unchecked alerts never read "No active alerts" (backend `74f494001` + native) | fixes §10, verify-r2 |

  Seals:
  - fixes = `20260930-stream4-fixes-r1`, MANIFEST `5de362b237e9d784fa9af21fc71e9a73195119b43e81c12e69673e6ec029b68e`;
  - verify-r2 = `20260930-stream4-verify-actions-r2`, `d8e02bba37f45f4e72bdc6cdbfd893ad3640fa7ff7197b8ff3f1c0661de876d1`;
  - U02 sweep = `20260930-stream4-u02-native-r1`, `9e375256e8e3011184c731bc28ab8b0e44a53fcf45dbc48f521ab003494ea307`;
  - r1 attempt = `…-verify-actions-r1`, `94781d84…`.
- **Pushed without PRs** (don't open them unless the user turns the feature back on):
  - the shelved launch-cut #8 fixes, with findings in the 19:02:48Z entry:
    - `claude/stream4-mailday-no-sample-fallback` `4cd7f9e7d` (iOS My Mail Day shows its error frame instead of a sample day);
    - `claude/stream4-stamps-no-invented-wallet` `608849fa2` (Stamps shows the collection only, not an invented wallet);
  - `claude/stream4-fixes-all-build` `a93b3e462`, the 10-branch build merge named in the fixes bundle.
- **Runtime:** free; the lease was released at 22:11:38Z.
  - The backend is at rest on `00bf2d6ff` (pid 45803, 22:10:51Z), with no patches and no ATTOM key.
  - The proxy has no rules. The shared web worktree shows only its kept `.claude/launch.json`.
  - **No Stream 4 fixture exists.** Every one was cleaned exactly.
- **Devices** (take them only through `/private/tmp/pantopus-tools/device-slot.sh` with a `stream4:` label):
  - the S34 pair: iOS "Pantopus S34" `DA8C2A5F-39BC-421D-9F18-EB4B481E506F` and Android AVD `pantopus_s34` (emulator-5562);
  - both are shut down, with the 10-branch build `a93b3e462` installed;
  - boot Android with `emulator -avd pantopus_s34 -port 5562 -no-window -no-snapshot-save -no-audio -no-boot-anim` and iOS
    with `xcrun simctl boot DA8C2A5F-…`. The snapshot restores on boot, so reinstall the APK you need;
  - Android sign-in: `tools/android-s34-document.py <stage with fixture.json> login OWNER`, focus-checked secret typing with no
    raster. iOS stays signed in as the owner across reinstalls.
- **Builds: none kept.** At the resource cleanup (2026-09-30T22:45:11Z) these were deleted:
  - `/private/tmp/pantopus-stream4-builds` (3.0 GB) and the iOS DerivedData `/private/tmp/pantopus-stream4-dd-ios` (12 GB);
  - the extra worktrees `stream-4-activity-labels` and `stream-4-place-honesty` (clean; their branches merged);
  - the Android build output, Gradle project cache and node_modules in the session worktree;
  - sealed stage folders byte-identical to their audit copies. The evidence is in the audit store under the same names.
- **Building next time:** build fresh from current master in your own worktree, through the heavy slot. The first build is cold.
  The template `builds/build-fixes-10.sh` in the fixes bundle still names the removed worktree and DerivedData path; point
  `WT` and `-derivedDataPath` at yours.

**Next, in order.**
1. **Done: #1102–#1111 merged in batch 223.** Fix any regression forward on a new branch from master, with the same steps:
   reproduce, smallest repair, device before/after, seal, PR, then hand it to the Stream 1 queue owner.
2. **Done: Document detail C and D, reproduced on master and fixed: [#1131](https://github.com/WangPantopus/skinny-pantopus/pull/1131) (`e8f27d9cb`, `20260930-stream4-docdetail-a3-r1` (`638a41c3…`)), with the coordinator.** The original notes:
   - **C, Android image decode failure:** "Open externally" is a no-op, because the `ImagePreview` error slot passes `{}`.
     - Reproduce: `tools/s4-doc-fixture.py <stage> <label> badjpeg` uploads non-image bytes as image/jpeg through the real route.
       Delete it through the product route, which also removes the stored object.
     - Fix: pass `onOpenExternally`.
   - **D, a document with no file** (legacy metadata-only; no current client creates these).
     - Android's footer Open/Share and both apps' preview pill are silent no-ops. iOS already disables its footer Open/Share.
     - Reproduce with a metadata-only document (the U02 seed's `POST /documents`), then make the smallest repair: Android
       parity, and hide the pill.
3. **Done: iOS dark tint re-measured on master `a211e1f48`; clean (same bundle).** The original notes:
   - iOS dark sweep of place-risk, place-today, pickup-editor, maintenance, issues, document-detail and home-dashboard, then
     `tools/s4-u02-contrast.py`.
   - Send anything under 4.5:1 to Stream 1 with file:line. That includes the fridge "Revoke" (system `.bordered`, 4.49 light /
     3.13 dark).
4. **Done: web A3 live on master `763969f07`, 0 findings over 14 screens (same bundle).** The original notes:
   - Under the lease, apply current master's `tailwind.config.js`, `globals.css`, `HealthScoreRing.tsx`, `HomeHeader.tsx` and
     `maintenance/page.tsx` to the shared web worktree.
   - Measure the Home dashboard (light and dark) and Issues, then revert.
5. **Done: the Place hero and Today's Pulse tell the truth about alerts: [#1172](https://github.com/WangPantopus/skinny-pantopus/pull/1172) (`87ccd59cc`), with the queue owner; bundle `20261001-stream4-pulse-honesty-r1` (`db20a0d8…`).**
   - In the same window, with the same bundle:
     - web Documents shows the size and a working Download: [#1173](https://github.com/WangPantopus/skinny-pantopus/pull/1173) (`60961a7e9`);
     - Document detail's "Uploaded" row no longer repeats the uploader on iOS and Android: [#1174](https://github.com/WangPantopus/skinny-pantopus/pull/1174) (`c2108a129`).
   - **Candidate seen there, not yet fixed:** iOS Document detail shows a 193-byte file as "0 KB" in the header and Size row,
     while Android shows "193 B". Reproduce and repair next, before item 6.
6. **U03 native ⬜ cells** (U03 table):
   - Home health E1/E3/R2;
   - Android pickup E2/E4;
   - Home issues E3/E6. For E5 on screen, the native status taps are same-field last-write-wins;
   - fridge E3 (plus Android E6) and E2 revoke;
   - Android maintenance E3;
   - iOS Emergency add E1/E3/E4 and every delete case;
   - native Documents delete.
   Faults: `tools/s3-proxy.py <stage> set '<rule>'` (actions `status`, `delay` or `delayResponse`; `<H>` comes from
   `fixture.json['H']`, so write both `home` and `H`). A document with a real file: `tools/s4-doc-fixture.py … pdf`.
7. **U04 native cells** (L1/L3/L4 on Home records, Place and the address calendar). Drivers are drafted but have not run:
   - `tools/s4-u04-android.sh` and `tools/s4-u04-ios.sh`, on Stream 3's step tools;
   - fixture: `S3_STAGE=<stage> S3_HOME_NAME="S4 Lifetimes Home" S3_ADD_MEMBER=1 python3 tools/s3-u04-fixture.py fixture`;
   - check the labels on a device first. Android `homes/` deep links cover only dashboard, members, owners and verification.
8. **Older open work** (unchanged since 04:16Z; read each row's last column before starting):
   - the F02 native permission re-run (iOS and Android on a recreated F01 cohort);
   - I04 DST and holiday edges;
   - I05 property local parts;
   - D04, one truthful maintenance lifecycle;
   - D09, the remaining readers;
   - D01, issue E5 on screen.
9. **Hosted and provider boundaries stay named** (below). U05 waits for the launch flags on master.

**Lessons from 2026-09-30 (read before driving devices).**
- **uiautomator:** an ElementTree node with no children is **falsy**, so test with `is not None`. `if t:` hid Android
  Maintenance detail for a whole pass.
- **iOS Place cards:** each locked or density card is **one** combined accessibility Button (`place.locked.<title>`,
  `place.density`). Tap its bottom CTA row, not its centre.
- **Android Identity:** the locked cards sit about 15 long swipes down, below the data-broker list.
- **Place tier:** an *unverified* occupancy is refused (403), not T3. T3 is an owner by `Home.owner_id` with **no occupancy
  row**: `tools/s4-owner-home-fixture.py <stage> "<name>" nooccupancy`.
- **Coordinates:** set `map_center_lat/lng` for the hub path (weather/air/alerts) and the block-density card.
- **Lazy rows appear on first views:** PropertyIntelligenceCache, HomeSeasonalChecklistItem, and a `UserReferral`
  (`post_transaction`) row for the owner.
  - Let `s4-cleanup-home.py`'s count assertion show them, then pass them as counts or extra scopes.
  - AddressCalendarRule pickup rows are keyed by `scope_key`, so they need an extra scope.
- **Per-platform decisions:** iOS keeps its fixed type ramp (user 09-29), so iOS A1 means clipping only. Android is light-only
  (#1013), so Android A2 means it stays light and readable.
- **Heavy-slot builds:** resolve heads after acquiring the slot, and never edit a queued script. To withdraw a queued job, kill
  the parent script, then its `acquire`.
- **Paparazzi:** verify has a tolerance. Re-record only goldens the change draws, since a re-record also rewrites caret pixels.

**Decided by Stream 4 later on 2026-09-30 (standing instruction; each is recorded in its PR):**
1. **Honesty over decoration:**
   - Your home shows no invented trend or "Block median" (#1102);
   - Civic promises only the date (#1110);
   - the Place preview's matching claims went to Stream 2, who fixed them in #1091.
2. **An unchecked alerts section is never an all-clear:** backend and native (#1111).
3. **Android large text:** from font scale 1.5, reflow or stack, with nothing changing below 1.5 (#1108).
4. **The Warranties chip** goes one palette step darker, per the user's decision 3 (#1109).
5. **Document detail candidates C and D:** reproduce before fixing (low reach).
6. **Alerts not checked (2026-10-01):** the hero shows a neutral "Alerts unavailable" chip, a cloud-off icon and a sentence
   naming what is unknown, in the existing frame. The AI Pulse reports `noaa` as a partial failure and says it couldn't check.
   Native Pulse tiers follow the web's `ranking.ts` ([#1172](https://github.com/WangPantopus/skinny-pantopus/pull/1172)).
7. **A failed change says it may not have been saved (2026-10-01):** after a change that fails or isn't confirmed, the
   checklist card reads "Your change may not have been saved", not "Couldn't load the seasonal checklist" ([#1282](https://github.com/WangPantopus/skinny-pantopus/pull/1282)).
   Documents replace gets the same treatment next.
   - Rejected: a definite "Couldn't update…", which E2 proved false on both apps after a change that committed.

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
5. **Typed text in Home dashboard panels when the tab is hidden (U04 L1): option (b), built, verified and merged in [#918](https://github.com/WangPantopus/skinny-pantopus/pull/918) (batch 162)** (bundle `20260930-stream4-issue-draft-restore-r1`, `56ca55c7…`).
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
| I06 | **Partial/open.** 2026-10-01 (Stream 4): the Place hero and Today's Pulse no longer read as an all-clear when weather alerts weren't checked (web, iOS, Android, plus the backend AI Pulse, which now reports `noaa` as a partial failure). Native Pulse tiers follow the web's rule, so a severe alert files under Urgent ([#1172](https://github.com/WangPantopus/skinny-pantopus/pull/1172), with the queue owner; bundle `20261001-stream4-pulse-honesty-r1` (`db20a0d8…`); NWS stood in by cache rows; the "air is good" sentence needs AirNow, so it wasn't reproduced). 2026-09-30 (Stream 4): the web Place election banner showed a date-only election day as the day before in US time zones. Fixed in [#875](https://github.com/WangPantopus/skinny-pantopus/pull/875) (merged, batch 148; bundle `20260930-stream4-civic-election-date-r1`, `63787428…`; emulated section). Still named: the backend's UTC-based `days_until` and Election Day cut-off (provider), and iOS date-only parsing (native). 2026-09-26: daylight, EPA facilities, heat/cold, seismic, wildfire and civic districts no longer compute at 0,0 for coordinate-less Homes ([#543](https://github.com/WangPantopus/skinny-pantopus/pull/543)). Stale Sun wording was repaired on all three apps in accepted bundle20260927-stream2-sun-day-label-r1 (3b5bae8b2); do not reopen that candidate. | Weather, air quality, alerts, daylight and civic sections across geography/provider states. |
| I07 | **Partial/open.** 2026-09-30 (Stream 4): web Home health and Home activity now follow saves made on the dashboard ([#860](https://github.com/WangPantopus/skinny-pantopus/pull/860), merged; bundle `20260930-stream4-dashboard-summary-refresh-r1`, `badd163e…`). Before, after Report Issue health stayed "55 /100" (the server said 45), and after Add Task activity stayed empty until a reload; the Today counts were already fresh, a hypothesis rejected by the reproduction. A malformed activity row no longer takes down the dashboard ([#863](https://github.com/WangPantopus/skinny-pantopus/pull/863), merged; `20260930-stream4-timeline-reader-shape-r1`, `5048251f…`; emulated replies). Web Home activity labels repaired in [#854](https://github.com/WangPantopus/skinny-pantopus/pull/854) (merged in batch 139, master `67e3a458a`; bundle `20260930-stream4-home-activity-labels-r1`, `1c2c0d0c…`). The route returned raw audit rows, so the card showed codes and no actor; it now returns the declared contract (description + actor name). Real-Chrome before/after. Concurrent-insert pagination was verified on web with no code change (22 rows, a save between pages, 0 omissions; the new event shows after reload). #773 mounted finite-authority expiry repaired and actual web/Android/iOS before/after accepted within160-file5dadb5b8 limits; finalb3b245a3f reviewed/merged batch106/#775. Earlierofbothfields, deniedRetry/cold and actualweb late200 covered; shared globalcontext remains separate. WebHomeTimeline actual64-row pagination/reload/503/Retry verified30-fileab71dcee, no appchange/all353unchanged; finalextraDOM timing and stickyheadercapturesqualified. Distinctfrom Membersaudit/nativeUpcoming. #755 emergency-only Overview repaired after actual UI/API/SQL reproduction,47-filed8966910 seal/full353 cleanup; merged batch98/#756. #638 repairs native Home-tools-return projection, actual both-platform failure/retry/restart evidence af14517d; broader mounted/account races remain. Individual stale-reader repairs are recorded, including D09 response-integrity controls. 2026-09-26: the Android Today tab never refetched while mounted; it now has pull-to-refresh like iOS ([#544](https://github.com/WangPantopus/skinny-pantopus/pull/544), bundle `20260926-stream2-today-refresh-r1`). | Web labels: done (#854, merged). Still open:<br>• mounted-view/cache invalidation without navigation (on-page saves: done in #860; changes made on other devices still show only on focus or reload, because web has no live updates; decided: option (a) for launch, see "Decided by Stream 4" item 4);<br>• ~~native recent-activity labels~~ done 2026-09-30: both apps show sentences over "Home activity" instead of audit codes and table names ([#1062](https://github.com/WangPantopus/skinny-pantopus/pull/1062), merged in batch 223; 0930 native-activity-r1 and -r2);<br>• ~~`created_at` tie order at a page boundary~~ reproduced and fixed 2026-10-01. `/timeline` and `/activity` ordered only by `created_at` with LIMIT/OFFSET, so tied rows repeated across pages and went missing. They now break ties by `id` ([#1317](https://github.com/WangPantopus/skinny-pantopus/pull/1317), merged in batch 288; `20261001-stream4-timeline-ties-r1` (`8d9397ac…`));<br>• concurrent authority and timezone boundaries beyond the accepted static 64-row/retry and concurrent-insert cases. |
| D01 | **Partial/open.** 2026-09-30 (Stream 4): web Emergency Info for an account without access (a direct link, or access retired while away) said "could not be loaded" with a Retry that repeated the 403, an Add the server refuses and a toast. It now says "You don’t have permission to view this household’s emergency info." with none of them ([#904](https://github.com/WangPantopus/skinny-pantopus/pull/904), merged in batch 158, master `88149d747`; bundle `20260930-stream4-emergency-access-denied-r1`, `76bb6524…`). The same run confirmed web E1 (a server error keeps the draft) and E3 (a double tap saves 1 entry) with no change. Web emergency info no longer duplicates after a lost create reply ([#871](https://github.com/WangPantopus/skinny-pantopus/pull/871); bundle `20260930-stream4-emergency-create-receipt-r1`, `8e1804d4…`). Merged in batch 147. It uses the #740 `clientRequestId` pattern and passes the API controls. Native emergency create sends no id yet. #769 one-SDKfile receiptguard191-file3afd7334: fourwebfalse-successbefores/21malformedafters/realsavesandreloads; unchangednative structuralparitywith2faultoverlapcellsqualified/exclusivelycompleted. Exactly3ownissues0/349outside4Authrestored; broadidentity/account/concurrent/durableboundariesopen. #740 same-draft issue creation131-fileb8cb3456: bothweb+Android+iOS actual lost201/manualretry preserves1 original full row; reload/restarts/API concurrency controls pass, exact13cleanup/16retained unchanged. In-memory draft scope only; no broad lifecycle closure. #654 web explicit clears/zero estimate actual UI/API/SQL verified (85ee0497), exact fixture cleanup; merged batch55/#656.  Package permission/status controls, Emergency PUT/DELETE and guest-pass repairs are real end-to-end; PR192 is the current preservation milestone. 2026-09-26: issue status contract ([#467](https://github.com/WangPantopus/skinny-pantopus/pull/467)) and issue permissions with native Issues entries ([#482](https://github.com/WangPantopus/skinny-pantopus/pull/482)). | **Launch scope: packages OUT (cut 7); issues, emergency and guest passes stay.** Remaining Home-entity mutations, receipts and complete create/edit/delete coverage. 2026-10-01 native U03 coverage, no defect: issues E3/E6/E5 on both apps and Emergency add E1/E3/E4 and delete E1/E2/E3 on iOS (`20261001-stream4-u03-native-r1` (`30ae9e65…`), `20261001-stream4-u03-native-r2` (`f663cec6…`)); per-cell state is in the U03 table. |
| D02 | **Partial/open.** #769 webissuefailed-receiptdraftretention and realretry/reload191/3afd7334 accepted within recordedfourcaller scope; no newmedia contract. #654 cleared-draft503/403/retry/cancel/uncertain-save evidence85ee0497; existing media contract still unapproved.  Existing panel error/draft retention is reused where verified. | **Launch scope: bill and package media OUT (cut 7); issue media stays.** Issue media contract remains a design-stage requirement; do not introduce attachments without an approved existing contract. Remaining in-scope write/lifecycle cases only; cut bill/package media are excluded. |
| D03 | **Partial/open.** Standalone bill-unit/date behavior and package `in_transit` contract are repaired and evidenced. | **Launch scope: OUT (bills and packages, cut 7). Don't verify.** Final cross-client/server contract and remaining native/provider boundaries. |
| D04 | **Partial/open.** Native manual Delete112-file27164512 now verifies actual cancel/strict503/full-row preservation and committedlost204/manualretry/cold on both platforms, qualified iOS original helper sequence plus fresh unfinishedcontrols. Exactly3ownlogs productgone/all349outside4Auth restored, no code/build. #743 mounted manual-create timeout/retry101-file57d87133: both installednative before2→after1 identicalrow/cold, APIguards/concurrentfirstinsertpass; exact7productdeletes/all349outside4Auth restored. In-memorydraft scope; broaderaccount/concurrent/Gig/otherlifecycle open. #687 native original-read gate covers failed/missing/pending loads and recovered saves/create eligibility;155-file999ae0a6, ownlog deleted204/fivefullhashes restored.  2026-09-27 optionalcost/vendorclears, zerodistinction, concurrentomission and bothnativecoldreread verified in#683 (163files6bb4a244), ownlog204deleted/fivefullhashesequal. 2026-09-27 concurrent native title/cost/vendor edits and current-vendor display repaired in #677;149-file d819c144 evidence, one ownlog product-deleted204 and five full baseline hashes restored. Explicit null clearing now covered by#683; wider lifecycle remains unverified. 2026-09-27 manual completiondate/UTCday/YTD repair verified on installed Android/iOS;173-file5ab0d849 evidence, all4ownlogs productdeleted/fullbaseline restored. Eight existingfiles, no schema/design change. 2026-09-26 candidate: the health card's maintenance action counts HomeIssue rows, but on iOS/Android it opens the HomeMaintenanceLog list ("No maintenance logged yet"). Fixed and accepted in merged #563 (`20260927-stream2-health-view-issues-r1`, seal `08d77b43…`); no new rerun was needed for unchanged source. | One truthful lifecycle across HomeMaintenanceLog/HomeIssue and competing readers/writers. |
| D09 | **Partial/open.** 2026-10-01 (Stream 4): the web Documents reader shows each file's size and a Download through the authorized content route ([#1173](https://github.com/WangPantopus/skinny-pantopus/pull/1173)). It read the retired `file_url`/`file_size`, so no file was reachable on web. Document detail's "Uploaded" row no longer repeats the uploader (iOS, Android; [#1174](https://github.com/WangPantopus/skinny-pantopus/pull/1174)). Both are with the queue owner, bundle `20261001-stream4-pulse-honesty-r1` (`db20a0d8…`). 2026-09-30 (Stream 4): the web health and checklist readers reject unrenderable replies ([#882](https://github.com/WangPantopus/skinny-pantopus/pull/882), merged; `20260930-stream4-intelligence-reader-shape-r1`, `c44de224…`). The web Home activity reader rejects rows it cannot render ([#863](https://github.com/WangPantopus/skinny-pantopus/pull/863), merged; bundle `20260930-stream4-timeline-reader-shape-r1`, `5048251f…`). Before, with emulated replies, a null row, or a row without action/time, made the whole app show "We hit a page error". After, the card's own unavailable state and Retry take over. #758 separateShareCenter missing/object/null-memberguard actualthreebefore/afters/retries/reload34-file5154af44/all353unchanged; acceptedstandalone/nativecollectionsreused, merged batch99/#760. #717 same-draft uncertain issue73-file9b341a41: actual web/Android/iOS lost committed201/manualretry preserves one original row; scoped API guards,6owned cleaned/six hashes restored. In-memory scope only; restart/account/first-insert race open. #715 web malformed issue201 guard46-file33e5e1b:3before/afters+realvalidAPI/SQL,unchangedAndroid3parity,1exactcleanup/sixhashes; iOS missing/null/empty actualUI nowverified34-fileb7ccaf52,8unchangedbindings/119priorfiles reused/all353unchanged/zero writes; same-mounted-draft uncertainissue is covered by#717. #711 same-Home revoke receipt repair47-file9c7cd14f: actual web lost-reply baseline, original mounted three-client recovery, permission/missing/concurrent API cases; one fixture cleaned/six hashes restored. Fridge issue/revoke/public lifecycle117-file8327964d: three apps/three owned cards,48receipts/16bindings, exact cleanup and six whole hashes restored; capture and uncertain/account limits explicit. #707 persisted fridge-card reader:85-file541079bd,18 web/native assertions/14bindings/41GETs/six unchanged hashes; web query+existing error/Retry and Android response guard. #705 optional fridge Emergency prefill:59-filec0ea704c,15 web/native assertions/14bindings/22GETs/six unchanged hashes; one existing web effect guard. #703 dashboard Emergency/Access optional members:52-filea4670cb7,15 Chrome assertions/eight bindings/44GETs/six unchanged full hashes; only two retained hook readers changed. #701 four Android native collection null-member guards:129-file6c21cb56,24 installed Android/unchanged iOS null-object-retry assertions,31 GETs and eight unchanged full hashes. #680 missing-list/web cases reused via source bindings; nested/identity/other-consumer limits remain. #698 Emergency web collection/Android null-member guards:96-file1dfd1368,22assertions, installed Android/unchanged iOS parity, real recovery/cold and five unchanged full table hashes. Other nested member-shape boundaries remain open. #694 web settings envelope/name/type guard has five actual malformed/retry cases,42-file8722e5a7 and four unchanged complete table hashes.  #680 repairs four standalone web list-shape guards and Android missing Access/Issues arrays;148-file659bf82b evidence, real web12cases/retry and native4reader missing/recovery, eightwholefingerprints unchanged. Nested semantics/write receipts/other consumers remain open. Pets/polls false-empty routes and page retry behavior are repaired; PR192 readback guards malformed success. 2026-09-26: web Documents delete really deletes, and Documents/Issues/Access/Share show unavailable instead of empty ([#529](https://github.com/WangPantopus/skinny-pantopus/pull/529), bundle `20260926-stream2-home-docs-r1`). The empty Documents and Access & Codes pages no longer point to web actions that don't exist ([#541](https://github.com/WangPantopus/skinny-pantopus/pull/541)).| **Launch scope: pets and polls OUT (cut 7); documents, issues, access and share readers stay.** Remaining malformed-success readers and complete cross-client verification.  Native Fridge failure lifetime#713 sealed76/91bddc2d: visible after6s/retry clears,2owned cleaned/six hashes restored; placement/account/uncertain-issue limits explicit. |
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
| Home health and seasonal checklist (complete, skip, carryover) | ✅ E2 (0927 checklist-uncertain-recovery)<br>✅ R1 (#661, #669)<br>✅ E1 data and retry: a 503 on a change leaves the item pending with Retry, and Retry then the change completes it. The card said "Couldn't load the seasonal checklist" though only the change failed; it now says "Your change may not have been saved" (E1, E2 and E5 afters; [#1282](https://github.com/WangPantopus/skinny-pantopus/pull/1282), merged in batch 279; `20261001-stream4-checklist-headline-r1` (`af744361…`))<br>✅ E3: a double tap during a held change sends one PATCH<br>✅ E4: for a member without permission the checklist control is disabled and nothing is sent; no sentence says why (the web's wording item) (`20261001-stream4-u03-native-r2` (`f663cec6…`))<br>✅ E5: a stale skip after another device's completion gets 409, the server's sentence shows under the new headline, and nothing is undone<br>✅ R2: a Home's first view creates the season's items, and the health score agrees (55/100 next to "0/2 done", not "No seasonal checklist created yet") (`20261001-stream4-checklist-headline-r1` (`af744361…`))<br>– E6 (no typed input) | ✅ E2 (0927 checklist-uncertain-recovery)<br>✅ R1 (#661, #669)<br>✅ E1 E2 data and retry, as on iOS. The load headline over "Couldn't confirm that task update…" now reads "Your change may not have been saved" ([#1282](https://github.com/WangPantopus/skinny-pantopus/pull/1282); `20261001-stream4-checklist-headline-r1` (`af744361…`))<br>✅ E3: one PATCH (`20261001-stream4-u03-native-r2` (`f663cec6…`))<br>✅ E4: every Mark and Skip control is disabled for a member without home.edit, and a tap sends nothing<br>✅ E5: a stale skip gets 409, and nothing is undone<br>✅ R2: first view, 55/100 next to "0/4 done" (`20261001-stream4-checklist-headline-r1` (`af744361…`))<br>– E6 | ✅ E2 (0927 checklist-uncertain-recovery)<br>✅ R1 (#661)<br>✅ R2 (#587)<br>✅ health follows on-page saves (#860)<br>✅ E1 E3 E5 (0930 health-e1e3e4e5: a 503 gives an honest alert with Retry; a double click sends one PATCH; a stale skip after another device's completion is refused with 409 and nothing is undone; the wording is generic)<br>✅ E4 safe (refused with 403, nothing written, the checklist turns read-only) — gap: no sentence says why (later wording item)<br>– E6 |
| Bill benchmark: Home opt-in and Place Money signals | ✅ E1 R1 (#619, 0927 f02-member-finance, 0929 f02-ios-retry-late-delivery)<br>✅ E4 (f02-member-finance)<br>⬜ E5 permission change (open work item 1)<br>✅ R2: Place Money "Bill benchmark · Not available for your area yet." (0929 f02-ios-retry-late-delivery, 0927 f02-ios-held-account) and the Home bill card's "No paid USD bills…" (0927 checklist-uncertain-recovery)<br>– opt-in: web only (`BillTrendChart.tsx:99`); the apps only decode `bill_benchmark_opt_in` | ✅ E1 R1 (#619)<br>✅ E4 (f02-member-finance)<br>⬜ E5 (item 1; the 09-30 capture is unsealed)<br>✅ R2 Home bill card "No paid USD bills…" (0930 native-activity-r2); Place Money "Not available for your area yet." is captured in 0930 u02-native-r1 (seals after its cleanup)<br>– opt-in: web only | ✅ E1 R1 (#602)<br>✅ E4 (f02-member-finance, 0930 f02-home-dashboard-bills)<br>✅ E5 (0929 f02-same-account-permission, 0927 f04-withdrawal)<br>✅ R2 (0927 f01-bill-cohort, f04-withdrawal)<br>✅ E2 E3 on the opt-in save, no change (0930 optin-e2e3: a double click sends one PATCH; after a lost reply, the card says not confirmed and a reload shows the committed value) |
| Place dashboard and section details (weather, air, alerts, civic, property; read-only) | ✅ R1 (#619, #638)<br>✅ R2 stale sun label (0927 sun-day-label)<br>✅ E4 (f02-member-finance)<br>✅ R1 alerts: an unchecked alerts section no longer reads "No active alerts", on the Today card and in the backend ([#1111](https://github.com/WangPantopus/skinny-pantopus/pull/1111), merged in batch 223; 0930 fixes §10, 0930 verify-actions-r2)<br>✅ election date: a date-only Election Day shows its day, NOV 3 in Pacific time (#922, merged 09:40:00Z; 0930 ios-civic-date)<br>✅ E4 no access (an account with no row in the Home): this said "Something went wrong" with a Try again that only repeated the 403 (`20261001-stream4-u04-native-r1` (`b2427619…`)). It now says "This place isn't available" / "You don't have permission to view this place." with no retry on the dashboard, Today and Money; other failures keep Try again ([#1301](https://github.com/WangPantopus/skinny-pantopus/pull/1301), merged in batch 282; `20261001-stream4-replace-place-r1` (`df72ad06…`))<br>– write cases | ✅ R1 (#619, #638)<br>✅ R2 (#543, sun-day-label)<br>✅ E4<br>✅ R1 alerts, not a false all-clear (#1111)<br>✅ E4 no access (an account with no row in the Home): this said "Something went wrong" with a Try again that only repeated the 403 (`20261001-stream4-u04-native-r1` (`b2427619…`)). It now says "This place isn't available" / "You don't have permission to view this place." with no retry on the dashboard, Today and Money; other failures keep Try again ([#1301](https://github.com/WangPantopus/skinny-pantopus/pull/1301), merged in batch 282; `20261001-stream4-replace-place-r1` (`df72ad06…`))<br>– write cases | ✅ R1 (#602)<br>✅ R2 (#543, sun-day-label)<br>✅ E4, with the refusal worded as a permission and no retry on the dashboard, sections and Pulse (#896)<br>✅ election day shown as that day (#875)<br>– write cases |
| Address calendar: pickup day (set, change, clear) | ✅ E1 E2 E3 E6 (0927 place-pickup)<br>✅ E4, generic wording (place-pickup)<br>✅ R1 (#737)<br>✅ R2 empty state (0927 place-pickup first use and after Clear; that code is unchanged since)<br>✅ E5: a stale save gets 409; the editor shows the current schedule with "The pickup schedule changed since you opened it…" and a retry keeps both changes (0930 native-pickup-e5-r1 and -r3; [#1040](https://github.com/WangPantopus/skinny-pantopus/pull/1040), merged in batch 209)<br>✅ E4: a refused save now says "You don't have permission to change this household's pickup schedule." (master said "…Check the next collection date and try again."); nothing written (0930 native-pickup-e4-ios-r1; #1040 merged) | ✅ E1 E3 E6 (place-pickup)<br>✅ R1 (#737)<br>✅ R2 empty state (0927 place-pickup first use and after Clear; that code is unchanged since)<br>✅ E2: after a lost reply the editor keeps the choice and says "Can't reach Pantopus"; the retry's 409 sentence reloads the saved schedule; one rule (`20261001-stream4-u03-native-r1` (`30ae9e65…`))<br>✅ E4: a member with a calendar.edit deny gets "You don't have permission to change this household's pickup schedule." (403), and nothing is written (`20261001-stream4-u03-native-r1` (`30ae9e65…`))<br>✅ E5: a stale save gets 409; the card reloads with the sentence and the reopened editor saves both changes (0930 native-pickup-e5-r2 and -r3; [#1040](https://github.com/WangPantopus/skinny-pantopus/pull/1040), merged in batch 209) | ✅ E1 E2 E3 E6 (place-pickup)<br>✅ R1 (#737)<br>✅ R2 empty state (0927 place-pickup first use and after Clear; that code is unchanged since)<br>✅ E4: a refusal now says "You don't have permission to change this household's pickup schedule." and nothing is written ([#1003](https://github.com/WangPantopus/skinny-pantopus/pull/1003), merged in batch 190)<br>✅ E5: a stale save no longer undoes another device's change; the card shows the current schedule with the message ([#997](https://github.com/WangPantopus/skinny-pantopus/pull/997), merged in batch 188) |
| Home issues (report, edit, status, dismiss) | ✅ E1 malformed replies (#769)<br>✅ E2 (#740)<br>✅ E4 (#482)<br>✅ R1 (#680, #701)<br>✅ E6: Report Issue is disabled for a blank title, and a tap sends nothing<br>✅ E3: a double tap during a held create sends one POST and makes one issue<br>✅ E5 on screen: after another device changes the title, this device's stale Schedule sends one PUT with only the status, and the database keeps both changes (#906's rule) (`20261001-stream4-u03-native-r2` (`f663cec6…`))<br>– cost edit | ✅ E1 (#769)<br>✅ E2 (#740)<br>✅ E4 (#482)<br>✅ R1 (#680, #701)<br>✅ E6 E3 E5, as on iOS: Report Issue disabled when blank; one POST, one issue; the stale Schedule keeps the other device's title (`20261001-stream4-u03-native-r2` (`f663cec6…`))<br>– cost edit | ✅ E1 (#654, #769)<br>✅ E2 (#740, #654)<br>✅ E3 E6 (#654)<br>✅ E4 (#482, #654, #835)<br>✅ R1 (#680, 0929 web-false-empty-sweep-r2)<br>✅ R2 (#529)<br>✅ E5: a stale edit no longer undoes another device's change (#906, merged in batch 159) |
| Emergency info (add, delete) | ✅ R1 (#698)<br>✅ add E2: the retry after a lost reply returns the same entry, one row; master's retry duplicated it (0930 emergency-server-writes; #939, merged in batch 168)<br>✅ add E6 blank title: Save disabled with "Title is required." (same bundle, `cap/02`)<br>✅ add E1: a 503 keeps the form and draft (2 s error toast), and Save again makes one entry<br>✅ add E3: one POST, one entry<br>✅ delete E1: 503 on all 3 client attempts → "Something went wrong…", entry kept<br>✅ delete E2: lost reply → client retry gets 404 → empty list<br>✅ delete E3: one DELETE (`20261001-stream4-u03-native-r1` (`30ae9e65…`))<br>✅ add E4: a member without `can_manage_home` sees no Emergency info entry on the Home dashboard, and iOS has no deep link to it, so Add isn't offered (`20261001-stream4-u03-native-r2` (`f663cec6…`)) | ✅ E1 E3 E4 (PR189, PR191, PR192)<br>✅ R1 (#698)<br>✅ E2: the retry returns the same entry, one row (0930 emergency-server-writes; #939) | ✅ R1 (#698, #703)<br>✅ R2 (#755)<br>✅ E2 (#871)<br>✅ E1 E3, no change (0930 emergency-access-denied)<br>✅ E4: a permission sentence, no Retry or Add (#904) |
| Fridge card (issue, revoke; public page on web) | ✅ E1 (0928 fridge-lifecycle, #713)<br>✅ E2 issue (#717)<br>✅ E5 (#711)<br>✅ E6<br>✅ R1 by reopening (#707)<br>✅ E3: a double tap during a held issue sends one POST and makes one card (the second tap meets the disabled "Issuing…")<br>✅ E2 revoke: the revoke commits, the reply is lost, and the card shows Revoked (true), with a stale network line under the list (`20261001-stream4-u03-native-r1` (`30ae9e65…`)) | ✅ E1 (#713, #715)<br>✅ E2 issue (#717)<br>✅ E5 (#711)<br>✅ R1 by reopening (#707)<br>✅ E3: one POST, one card (a first attempt's transient emulator connection failure did not reproduce)<br>✅ E6: an untouched composer has Issue disabled<br>✅ E2 revoke, as on iOS (`20261001-stream4-u03-native-r1` (`30ae9e65…`)) | ✅ E1 (#715)<br>✅ E2 issue and revoke (#717, #711)<br>✅ E5 public page after revoke<br>✅ E6<br>✅ R1 with Retry (#707)<br>✅ E3, no change (0930 fridge-e3: a sub-frame double click sends two requests, but issue dedupes by client id and revoke answers its receipt: one card, one revocation, no error) |
| Maintenance history (manual logs: create, edit, delete) | ✅ E1 (#673, #677, #683, 0928 maintenance-delete)<br>✅ E2 (#673, #743, maintenance-delete)<br>✅ E3 (#673)<br>✅ E5 (#677)<br>✅ R1 by reopening (#687)<br>✅ R2: an empty Completed list agrees with SQL 0 (0927 maintenance-edit-read; again in 0928 maintenance-delete)<br>✅ false empty fixed: an empty Scheduled tab now says "Nothing scheduled. Your logged maintenance is under Completed." ([#1105](https://github.com/WangPantopus/skinny-pantopus/pull/1105), merged in batch 223; 0930 fixes §4)<br>⛔ E4 E6 API only | ✅ E1 E2 E5 R1 (same PRs)<br>✅ R2: a cold read shows the empty list, SQL 0 (0928 maintenance-delete)<br>✅ E3: a double tap during a held create sends one POST and makes one log (`20261001-stream4-u03-native-r2` (`f663cec6…`))<br>✅ false empty fixed (#1105; 0930 fixes §4)<br>⛔ E4 E6 API only | – no manual-log screen on web |
| Documents reader (list, delete, replace) | ✅ R1 (#680, #701)<br>✅ R2: after Retry, the real API's empty list shows "No documents yet" (0927 malformed-home-lists; again in 0927 home-list-null-members)<br>✅ detail open/share: a document with no file says so, with no dead control ([#1131](https://github.com/WangPantopus/skinny-pantopus/pull/1131), merged 00:23Z)<br>✅ delete ok and E3 (a second tap can't reopen the dialog; one DELETE). E1: the client retries the idempotent DELETE by itself, so one 503 becomes success; a persistent 503 shows the error (E2 the same: retry, then success, back on the list) (`20261001-stream4-block-invite-r1` (`3dee87cc…`))<br>✅ E1 wording: a failed delete now says "Couldn't delete this document", and E2 with every reply lost finishes on the list ([#1223](https://github.com/WangPantopus/skinny-pantopus/pull/1223), merged in batch 261; `20261001-stream4-greet-form-del-r1` (`5bf17e3e…`))<br>✅ replace: a failed or unconfirmed replace said "Couldn't load this document" (befores `20261001-stream4-doc-replace-r1` (`2a4244d1…`)). It now says "Your file may not have been replaced", including on Android after a lost reply that committed ([#1300](https://github.com/WangPantopus/skinny-pantopus/pull/1300), merged in batch 282; `20261001-stream4-replace-place-r1` (`df72ad06…`)) | ✅ R1 (#680, #701)<br>✅ R2 (same bundles: "All 0", "No documents yet")<br>✅ detail open/share: the image fallback's "Open externally" opens; a document with no file says so, Open/Share disabled ([#1131](https://github.com/WangPantopus/skinny-pantopus/pull/1131))<br>✅ delete ok and E3, one DELETE (`20261001-stream4-block-invite-r1` (`3dee87cc…`))<br>✅ E1: "Couldn't delete this document"; E2: after a lost reply, Try again returns to the list ([#1223](https://github.com/WangPantopus/skinny-pantopus/pull/1223), merged in batch 261; `20261001-stream4-greet-form-del-r1` (`5bf17e3e…`))<br>✅ replace: a failed or unconfirmed replace said "Couldn't load this document" (befores `20261001-stream4-doc-replace-r1` (`2a4244d1…`)). It now says "Your file may not have been replaced", including on Android after a lost reply that committed ([#1300](https://github.com/WangPantopus/skinny-pantopus/pull/1300), merged in batch 282; `20261001-stream4-replace-place-r1` (`df72ad06…`)) | ✅ R1 (#680, sweep r2)<br>✅ R2 (#541, #529)<br>✅ E4 (#529, #835)<br>✅ delete E1 E2 E3, no change (0930 docs-delete: E1 honest error + retry; E2 idempotent retry, 2 requests; E3 one request) |
| Home activity | – no timeline screen. The dashboard's Recent activity card showed audit codes ("HOME INVITE CREATED") over raw table names ("HomeInvite"): ✅ sentences over "Home activity" on both apps (0930 native-activity-r1 and -r2; [#1062](https://github.com/WangPantopus/skinny-pantopus/pull/1062), merged in batch 223) | – (same) | ✅ R1 (0928 home-timeline-pagination)<br>✅ labels and actor (#854)<br>✅ malformed rows (#863)<br>✅ concurrent insert (#854 bundle)<br>✅ follows on-page saves (#860)<br>✅ live updates from other devices: decided, re-read on focus/visibility/reload for launch ("Decided by Stream 4" item 4) |
| Mail: printed postcards, welcome cards, street digest (M01) | 🔷 not built (decision 2) | 🔷 | 🔷 (compose routes are live: security repairs #867/#872 through the API; the compose UI is cut, #8) |

**U04 lifetimes** — L1 background and return; L2 cold restart; L3 switch account; L4 session refresh.

| Area | iOS | Android | Web |
|---|---|---|---|
| Home dashboard and records (health, checklist, issues, emergency, fridge, maintenance, documents) | ✅ L2 (checklist-uncertain-recovery, #740, #743, #683, fridge)<br>✅ L1: a typed Report-issue draft survives 20 s in the background (same process, no POST)<br>✅ L3: member B, with no row, sees a refusal; 0 frames with the Home's or owner's data<br>✅ L4: a one-time 401 on the issue POST refreshes and saves once (`20261001-stream4-u04-native-r1` (`b2427619…`)) | ✅ L2 (same)<br>✅ L1 L3 L4, as on iOS (`20261001-stream4-u04-native-r1` (`b2427619…`)) | ✅ L2 reload<br>✅ mounted access expiry (#773)<br>✅ L3 (0930 home-account-switch: form sign-out/in, 0 private markers in 7 captures)<br>✅ L4 (0930 home-l1-l4: 401 → refresh → the same save once)<br>✅ L1 Emergency Info form kept (0930 home-l1-l4, emulated hide)<br>✅ L1 dashboard Report Issue draft kept across the re-check (#918, merged in batch 162; "Decided by Stream 4" item 5) |
| Place (dashboard, sections, Money) | ✅ L2 (#638, f02-member-finance)<br>✅ L3 (0927 f02-ios-held-account, 0929 f02-ios-retry-late-delivery)<br>✅ L1: the same screen after 20 s in the background, with no re-read<br>✅ L4: a one-time 401 on the Place read refreshes, and the page renders (`20261001-stream4-u04-native-r1` (`b2427619…`)) | ✅ L2 (#638)<br>✅ L3 (0927 f02-android-held-account)<br>✅ L1: the same screen after 20 s in the background, with no re-read<br>✅ L4: a one-time 401 on the Place read refreshes, and the page renders (`20261001-stream4-u04-native-r1` (`b2427619…`)) | ✅ L2 reload<br>✅ L3 (0927 f02-web-held-account, 0930 home-account-switch; honest refusal #896)<br>✅ L1 (0930 home-l1-l4, emulated hide: same screen, no re-read)<br>✅ L4 (0930 pickup-l1l3l4: the pickup save, a Place action, survives a session refresh with exactly one write) |
| Address calendar | ✅ L2 restart (place-pickup)<br>✅ L1: an unsaved garbage day survives 20 s in the background (no PUT)<br>✅ L3: member B gets a refusal, with no owner data or card<br>✅ L4: a one-time 401 on the pickup save refreshes and writes one rule (`20261001-stream4-u04-native-r1` (`b2427619…`)) | ✅ L2 cold (0928 pickup-weekly)<br>✅ L1: an unsaved garbage day survives 20 s in the background (no PUT)<br>✅ L3: member B gets a refusal, with no owner data or card<br>✅ L4: a one-time 401 on the pickup save refreshes and writes one rule (`20261001-stream4-u04-native-r1` (`b2427619…`)) | ✅ L2 reload (pickup-weekly)<br>✅ L1 (emulated hide: the unsaved draft is kept, no re-read) L3 (member B sees the honest refusal, no owner data or card) L4 (401 → refresh → the same save completes once) — 0930 pickup-l1l3l4, master's pickup code |

**U02 accessibility** — A1 largest text; A2 dark mode; A3 contrast; A4 screen reader; A5 keyboard (web).

| Screen | iOS | Android | Web |
|---|---|---|---|
| Home dashboard: health, checklist, property, bill trends, Home activity, Today and record cards | ✅ A1: fixed type ramp (the user's 09-29 decision), nothing clips (0930 u02-native)<br>✅ A2<br>✅ A3 light<br>✅ A3 dark: re-measured on master `a211e1f48` (#1061, #1097): the blue tint (4.2:1) is gone; what's left is decorative "·" separators and a disabled button (`20260930-stream4-docdetail-a3-r1` (`638a41c3…`))<br>✅ A4 | ✅ A1: quick actions, stat labels and the property map placeholder no longer break ([#1108](https://github.com/WangPantopus/skinny-pantopus/pull/1108), merged in batch 223; before/after in 0930 fixes)<br>✅ A2: light-only by design (#1013), light and readable in night mode<br>✅ A3<br>✅ A4 | ✅ A1 A4 A5 (0930 web-a11y; first screen)<br>✅ A5 expanded Maintenance card: issue rows now keyboard-reachable (#907, merged in batch 159; before, mouse-only)<br>✅ A2 health ring "/100" (#809)<br>✅ A3 live on master `763969f07`: 0 axe findings, light and dark (`20260930-stream4-docdetail-a3-r1` (`638a41c3…`)). Earlier, with Stream 1 (0930 a3-remeasure): the health chip's inline amber (1.87:1) and the dark-mode "Owner" chip (1.34:1). Master `20e7b4768`'s source now passes: the chip uses the warning, success and error tokens (6.03, 5.24 and 6.79:1 light; 9.74, 7.91 and 6.23:1 dark), and the Owner chip's emerald tint and text flip together (6.78:1 light, 8.8:1 dark) |
| Place dashboard and section details (incl. Money, civic, address-calendar editor) | ✅ A1 (0930 u02-native)<br>✅ A2<br>✅ A3 light<br>✅ A3 dark: tint gone on master; the fridge "Revoke" (`.bordered`) passes in dark (was 3.13:1) and is borderline-passing in light, 4.54:1 computed (4.48 pixel estimate); sent to Stream 1 as an FYI (`20260930-stream4-docdetail-a3-r1` (`638a41c3…`))<br>✅ A4 | ✅ A1: inline readings no longer break mid-word (#1108)<br>✅ A2 (light-only)<br>✅ A3<br>✅ A4: the avatar reads the place monogram ([#1107](https://github.com/WangPantopus/skinny-pantopus/pull/1107)) | ✅ A1 A4 A5 (0930 web-a11y)<br>✅ A2 Place text action and calendar Cancel (#809)<br>✅ A3 on master's tokens (0930 a3-remeasure: the overview and all six sections are clean; "Turn it on" failed only on the runtime's pre-#979 `bg-primary-500`, and master's is `bg-primary-600`) |
| Records pages: Issues (Maintenance), Emergency Info, Documents | ✅ A1 (0930 u02-native)<br>✅ A2<br>✅ A3: the Warranties chip was 4.42:1; now 6.15:1 ([#1109](https://github.com/WangPantopus/skinny-pantopus/pull/1109)); the rest clean; dark re-measured clean after #1061 (`20260930-stream4-docdetail-a3-r1` (`638a41c3…`))<br>✅ A4 | ✅ A1: Document detail's "Open externally" is no longer cut (#1108)<br>✅ A2 (light-only)<br>✅ A3: Warranties chip (#1109)<br>✅ A4 | ✅ A1 A4 A5 (0930 web-a11y)<br>✅ A4 Documents delete button named ([#984](https://github.com/WangPantopus/skinny-pantopus/pull/984); the sweep's seed had no document)<br>✅ A2 partial (#809)<br>✅ A3 on master's tokens for Emergency, Documents and Property Details<br>✅ A3 Issues live on master `763969f07`: 0 axe findings (`20260930-stream4-docdetail-a3-r1` (`638a41c3…`)). The earlier inline-hex badge (2.01:1) is gone: on master `20e7b4768` the status badges use semantic tokens (4.83 to 7.09:1 light, 5.98 to 9.74:1 dark; source) |
| Fridge card and its public page | ✅ A1 A2 A3 (0930 u02-native; "Revoke" borderline as above)<br>✅ A4: the remove-row control is named with a 28 pt target ([#1106](https://github.com/WangPantopus/skinny-pantopus/pull/1106)) | ✅ A1 A2 A3<br>✅ A4: "Remove <item>" in a 32 dp button, replacing "✕" (#1106) | ✅ A1 A2 A4 A5 (0930 fridge-a11y: leaf with a card, and the public page active and revoked)<br>✅ A3 on master's tokens (0930 a3-remeasure: 0 contrast findings on the leaf and the public page) |
| Maintenance history (app only) | ✅ A1 A2 A3 A4 (0930 u02-native) | ✅ A1 A2 A3 A4 (0930 u02-native; Maintenance detail captured after the driver fix) | – |
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

- **2026-10-01T11:00Z — [#1317](https://github.com/WangPantopus/skinny-pantopus/pull/1317) merged in batch 288 ([#1319](https://github.com/WangPantopus/skinny-pantopus/pull/1319), 10:58:17Z; master `cf62c83c4`). No Stream 4 PRs are open.**
  - **The created_at-only offset-paging finding, as Stream 1 routed it:**
    - `supportTrains.js` goes to Stream 1;
    - the notifications list goes to Stream 2;
    - user reviews go to Stream 5;
    - the admin verification queue goes to Stream 3;
    - the business reviews and community feed are launch-cut (#6, #8) and left alone.
  - **Next:** F02 native permission, waiting for the S34 pair.

- **2026-10-01T10:55:57Z — [#1317](https://github.com/WangPantopus/skinny-pantopus/pull/1317) is with the queue owner: Home activity pages break `created_at` ties by `id` (backend, one file; head `7c3dcf28b`). Seal `20261001-stream4-timeline-ties-r1` (`8d9397ac…`). API- and SQL-only window, 10:48:59Z–10:54:51Z.**
  - **Before, on master:** I07's "tie order at a page boundary" item reproduced on the real `/timeline`.
    - A row was returned on 3 pages and 2 rows were never returned.
    - On fresh Homes, 6 of 6 runs failed.
    - It depends on the plan: once the planner used an index scan, the same route returned ties consistently.
  - **SQL on the same data, deterministic:** `created_at` alone returns 44 or 43 distinct of 45; with `id` added, 45.
  - **After:** 26 `/timeline` and 12 `/activity` runs, all clean. Backend tests 42 pass.
  - **Cleanup:** exact, 351 of 353 tables plus auth history. Seven fixture Homes, cleaned through one combined cleanup.
  - **Next:** F02 native permission when the S34 pair is free (Stream 3 has it from 10:55Z).

- **2026-10-01T09:53:21Z — [#1300](https://github.com/WangPantopus/skinny-pantopus/pull/1300) and [#1301](https://github.com/WangPantopus/skinny-pantopus/pull/1301) merged in batch 282 ([#1303](https://github.com/WangPantopus/skinny-pantopus/pull/1303), 09:52:50Z; master `bbd6b72d0`).**
  - The queue owner verified seal `df72ad06…` against build `4312e6f71`, with every file blob-equal at both heads.
  - Native CI was still queued at merge; the queue owner will report any failure.
  - **No Stream 4 PRs are open.**
  - **Queued for the next lease** (Stream 3 holds it from 09:33Z):
    - F02 native permission on a recreated F01 cohort;
    - I07 created_at ties at a page boundary. `GET /timeline` and `/activity` order only by `created_at` with
      LIMIT/OFFSET; reproduce with `tools/s4-timeline-ties.py` first, and add an `id` tiebreaker only if it reproduces.

- **2026-10-01T09:34:30Z — [#1300](https://github.com/WangPantopus/skinny-pantopus/pull/1300) (Documents replace headline) and [#1301](https://github.com/WangPantopus/skinny-pantopus/pull/1301) (native Place refusal) are with the queue owner. One seal covers both: `20261001-stream4-replace-place-r1` (`df72ad06…`). Window 08:55:40Z–09:32:53Z (slots 3/4).**
  - **#1300** (head `2f27e1a19`): a replace that fails or isn't confirmed now reads "Your file may not have been replaced".
    - A 503 shows it on both apps, and Try again reloads the intact file.
    - On Android, a lost reply after a replacement that committed shows the same hedged headline, and Try again shows the
      new file.
    - Not applicable on iOS: its upload outlasts a 35 s hold.
  - **#1301** (head `4c72d4638`): an account that can't read a Place sees "This place isn't available" / "You don't have
    permission to view this place." with no retry. Checked as member B on the dashboard, Today and Money, on both apps.
    - Control: three 503s still give "Something went wrong" with Try again, which loads the page.
    - A single 503 is absorbed by the clients' GET retry on both apps.
  - **Checks:** Android lint passes, and 180 Documents and Place unit tests pass with 0 failures; iOS build succeeded.
  - **Window notes:**
    - The 5-minute load average reached about 95. The emulator's system_server stopped responding, so the emulator was
      rebooted.
    - Stream 3 deleted member B's stray MailPreferences row 7 s after my baseline. The baseline amendment is documented in
      the bundle; Stream 3 offered a re-insert, which I declined.
  - **Next:** F02 native permission on a recreated F01 cohort, when the lease is free. Stream 3 holds it from 09:33Z for
    about 75 min.

- **2026-10-01T08:51:41Z — [#1282](https://github.com/WangPantopus/skinny-pantopus/pull/1282) merged in batch 279 ([#1286](https://github.com/WangPantopus/skinny-pantopus/pull/1286), 08:27:55Z; master `5e5bf32d3`). The two next fixes are built and pushed; their afters wait for the lease.**
  - **`claude/stream4-document-replace-headline` `2f27e1a19`:** a failed or unconfirmed replace reads "Your file may not
    have been replaced" (iOS, Android).
  - **`claude/stream4-place-denied-native` `4c72d4638`:** a 403 on the Place dashboard and group pages reads "This place
    isn't available" / "You don't have permission to view this place." with no retry (iOS, Android; web #896).
  - **Build:** `rp`, from local branch `s4-build-replace-place` `4312e6f71` = master `337c3cb9a` + both. iOS dylib
    `f1492d0c…`; APK `c74a6ad3…`. Android lint passes, and 180 Documents and Place unit tests pass with 0 failures.
  - **Answered for Stream 5:**
    - the T3 fixture path to the Place verify sheet;
    - `BottomSheet`'s unnamed header X: Place doesn't render it, because `VerifyPromptSheet` has its own "Close". Only
      scheduling callers pass a title, so it was routed to scheduling's owner.
  - **Next:** the afters window. Then F02 native permission on a recreated cohort; the tools are written:
    `tools/s4-f01-cohort-fixture.py` and `tools/s4-member-permission-api.py`.

- **2026-10-01T08:03:03Z — [#1282](https://github.com/WangPantopus/skinny-pantopus/pull/1282) is with the queue owner (head `ed04125e6`). The native U04 cells are all closed, the last U03 checklist cells are closed, and two new native findings were reproduced. Window 06:55:00Z–07:58:47Z (slots 1/3); three bundles, all on the `cch` builds.**
  - **#1282, checklist failed-change headline:**
    - Both apps now read "Your change may not have been saved" after E1 (503), E2 (lost reply; the change had committed)
      and E5 (stale skip, 409; nothing undone).
    - Seal `20261001-stream4-checklist-headline-r1` (`af744361…`). Checks: iOS build; Android lint and 1130 homes unit
      tests with 0 failures.
    - The same bundle closes U03 health R2 (first view, 55/100) on both apps and Android E4 (controls disabled, 0 PATCH).
  - **U04 native, all 16 cells** (`20261001-stream4-u04-native-r1`, `b2427619…`):
    - L1: drafts and Place survive 20 s in the background, with no writes.
    - L4: one-time 401s on the issue POST, Place GET and pickup PUT each refresh and replay once.
    - L3: member B gives 0 frames with owner data.
  - **Findings reproduced, to fix next on their own branches:**
    - A failed Documents replace is titled "Couldn't load this document" on both apps. On Android a replace that committed
      behind a lost reply shows it too (`20261001-stream4-doc-replace-r1`, `2a4244d1…`; befores through the real system
      pickers).
    - Native Place for an account with no access reads "Something went wrong" with a Try again that repeats the 403. Web
      fixed this in #896.
  - **Sent to Stream 3:** the Home access refusal reads "Current access to this Home could not be confirmed" with a reload,
    though the server refused.
  - **Observations, not changed:**
    - The checklist season rolled over at 07:00:00Z on the server's clock (Pacific, no `TZ`), not the Home's time zone (I04).
    - Replace leaves the old file version to the `homeDocumentRecovery` cron, which is off locally. The stage removed its own
      tombstone objects through the Storage API (`tools/s4-storage-tombstones-remove.py`).
  - **Decision recorded** ("Decided by Stream 4" item 7): failed-change headlines are hedged when the change may have
    committed.
  - **Cleanup:** one exact cleanup for the window's 4 Homes: 349 of 353 tables match the baseline, plus auth history.
    Devices are off with the owner signed in; the backend is back on `00bf2d6ff`.

- **2026-10-01T05:51:55Z — U03 native round 2: 13 cells closed on master `2abd0edd4` with no code change, plus one finding to fix. Window 05:19:47Z–05:46:34Z (slots 3/4); bundle `20261001-stream4-u03-native-r2` (`f663cec6…`), verification only.**
  - **Home issues, both apps:**
    - E6: Report Issue is disabled for a blank title.
    - E3: a double tap during a held create sends one POST and makes one issue.
    - E5: a stale Schedule after another device's title change keeps both changes (#906's rule).
  - **Android maintenance E3:** one POST, one log.
  - **iOS Emergency add E4:** a member without `can_manage_home` gets no Emergency info entry, so Add isn't offered.
  - **Health and checklist:**
    - iOS E4: the control is disabled for the member. No sentence says why, which is the web's existing wording item.
    - E1, both apps: the data is right. The item stays pending, and Retry then the change completes it.
    - E3, both apps: one PATCH.
  - **Finding, fixed next on its own branch:** both apps title a failed checklist change "Couldn't load the seasonal
    checklist", though the checklist loaded and only the change failed. This is the same class as #1223.
  - **Test setup:** the iOS runs completed the fixture's two checklist rows, so SQL set them back to pending before the
    Android runs. Android has no way to un-complete an item.
  - **Redaction:** two Android profile frames showed the account's name and handle. Their screenshots were deleted and the
    labels redacted before the seal.
  - **Runtime:** this master took 12 s to listen. My restart log line was written before the pid existed and was fixed in
    place; I now wait for the port before writing it.
  - **Cleanup:** 349 of 353 tables match the baseline, plus auth history. Both devices are shut down with the owner signed in.
  - **U03 still open:** health E5 and R2 on both apps, Android health E4, and the F02 native permission change (bill
    benchmark E5).

- **2026-10-01T04:53:33Z — Finding for the user's launch-cut flags, recorded and not fixed (cut #8, household letters and My Mail Day).**
  - **What:** `frontend/apps/web/src/app/(app)/app/mailbox/layout.tsx:87` calls `useMailDaySummary()` on every
    `/app/mailbox` load to drive the My Mail Day banner. The route `GET /api/mailbox/v2/p3/mailday/summary` writes a
    `mailday_summary_viewed` MailEvent each time: a GET with a write.
    - Found by Stream 5's #1228 run, which deleted its 13 rows by id. Routed by Stream 1.
  - **Decision (launch-scope rule):** the 2026-09-27 map puts household letters and My Mail Day triage under cut #8. Streams
    don't fix or flag cut features; the user flags them.
    - When #8 is flagged off, the banner and this fetch should go with it.
    - If mail returns to scope: gate the call on the flag, and record "viewed" from the client when the summary is shown,
      not on GET.
  - Also noted from Stream 5: `components/home/QuickAccess.tsx` and `components/MediaGallery.tsx` are never rendered. That is
    dead code with no user effect, so it's left alone.

- **2026-10-01T04:52:27Z — [#1219](https://github.com/WangPantopus/skinny-pantopus/pull/1219), [#1220](https://github.com/WangPantopus/skinny-pantopus/pull/1220), [#1222](https://github.com/WangPantopus/skinny-pantopus/pull/1222) and [#1223](https://github.com/WangPantopus/skinny-pantopus/pull/1223) merged in batch 261 ([#1224](https://github.com/WangPantopus/skinny-pantopus/pull/1224), 03:43Z). U03 native window 04:20:50Z–04:50:46Z (slots 3/4) closed nine cells with no defect needing a repair; bundle `20261001-stream4-u03-native-r1` (`30ae9e65…`), verification only.**
  - **Fridge card:**
    - E3 on both apps: one POST, one card.
    - Android E6: Issue is disabled on an untouched composer.
    - Revoke E2 on both apps: the card shows Revoked (true), with a stale network line under the list. That is an
      observation, not a defect.
  - **Android pickup:**
    - E2: one rule after a lost reply. The retry's 409 sentence reloads the saved schedule.
    - E4: the member is refused with 403 and the permission sentence.
  - **iOS Emergency:**
    - add E1: the draft is kept, a 2 s error toast shows, and the retry makes one entry. add E3: one entry.
    - delete E1: an honest error after the client's 3 attempts, entry kept. delete E2: the retry gets 404, ending on the
      empty list. delete E3: one DELETE.
  - **Noted:**
    - The emulator's snapshot boot reinstates an old APK and signs the app out, so reinstall and sign in after each boot.
    - The member's lazy `MailPreferences` row was cleaned.
  - **Routed by Stream 1, then recorded rather than fixed** (decision at the entry above): `/app/mailbox` calls the cut My Mail
    Day summary GET, which writes a `mailday_summary_viewed` MailEvent on every load.
  - **Next:**
    - the mailbox GET-write;
    - remaining U03: iOS emergency add E4; issues E3/E6/E5 on both apps; Android maintenance E3; health/checklist
      E1/E3/R2/E4/E5.

- **2026-10-01T03:42:27Z — Four afters done and handed to the queue owner: [#1219](https://github.com/WangPantopus/skinny-pantopus/pull/1219) Pulse device greeting, [#1220](https://github.com/WangPantopus/skinny-pantopus/pull/1220) Android invite form clears, [#1222](https://github.com/WangPantopus/skinny-pantopus/pull/1222) iOS "1 of 3 invitations", [#1223](https://github.com/WangPantopus/skinny-pantopus/pull/1223) Documents delete honesty. Window 03:24:30Z–03:39:28Z (slots 3/4); bundle `20261001-stream4-greet-form-del-r1` (`5bf17e3e…`).**
  - **Pulse greeting:**
    - Backend under `TZ=UTC`, like a hosted server.
    - Before: "Good morning" at 20:26 Pacific on iOS and Android.
    - After: "Good evening" on both.
  - **Android form:** after a send, the budget goes 2 → 1 and all four fields are empty. Before, in seal `3dee87cc`, the
    address stayed.
  - **iOS noun:** "1 of 3 invitations left this week."
  - **Documents delete:**
    - iOS 503×6: "Couldn't delete this document", and Try again brings the document back.
    - iOS, every attempt committed with its reply lost: Try again finds the document gone and returns to the list.
    - Android 503: same as iOS 503×6.
    - Android, reply lost: returns to the list, where before it was stuck.
  - **Builds:** tree `1aa45c877` (master `19aed325a` + the four branches); each PR's files merge into master `2015eecf1`
    blob-equal to it. The build log names `cadd5e352`: I merged the noun fix one second after slot acquisition, before
    compilation (`builds/gfd-head-note.md`).
    - Lesson: never merge into a branch whose build is queued.
  - **Correction:** my hand-off message first gave #1220's head as a typed SHA. It was corrected to
    `8e6c0a15d5b4c4abc7501f46c980d9c161a070e6` (rev-parse).
  - **Runtime:**
    - The egress guard blocks NWS (`api.weather.gov`), so no provider traffic leaves the machine.
    - The emulator boots a snapshot with an old APK, so reinstall after boot.
    - Stream 3 has had the lease since 03:39:50Z.
  - **Next:** U03 native cells with the `gfd` builds:
    - Android pickup E2 (`tools/s4-pickup-android-e2.sh`) and E4 (member sign-in via `tools/android-s4-signout.py` and
      `android-s3-login.py`);
    - iOS Emergency add/delete (step driver);
    - fridge E3 and revoke E2;
    - issues E3/E6/E5;
    - Android maintenance E3;
    - health and checklist.

- **2026-10-01T03:09:41Z — [#1203](https://github.com/WangPantopus/skinny-pantopus/pull/1203) (Block Founders invitations sent) and [#1204](https://github.com/WangPantopus/skinny-pantopus/pull/1204) (iOS small-file size) merged in batch 256 ([#1205](https://github.com/WangPantopus/skinny-pantopus/pull/1205), 03:08Z, master `19aed325a`). Window 02:32:04Z–03:04:02Z (slots 3/4); bundle `20261001-stream4-block-invite-r1` (`3dee87cc…`). Native Documents delete U03 found two defects; the fix is built next.**
  - **Block Founders, before (master `e318f26e9`):** every surface failed on the CHECK, with 5 log lines: API 502 `SEND_FAILED`;
    web "Something went wrong…"; iOS "The postcard couldn't be sent just now…"; Android "Something went wrong…".
  - **After (`3455c9cbf`):**
    - Android, iOS, web and the signed-out `/no-mail/<code>` page all succeed.
    - Every safeguard holds on the real DB: dedup, including a formatting variant; opt-out, which is idempotent and then
      refuses; the double-tap abort, with no row; the weekly 429.
    - No real mail: no `LOB_API_KEY`, and 6 MockMailProvider "dev mode" postcards.
  - **Android keeps the typed address after a successful send.** Reproduced: budget 3 → 2 with all four fields still
    filled. Fix `8e6c0a15d`; its after is pending.
  - **iOS size:** after "193 bytes" / "Size 193 bytes" (before "0 KB").
  - **U03 native Documents delete** (master's delete code):
    - **ok and E3:** pass on both apps, with one DELETE each.
    - **iOS E1 and E2:** the client retries the idempotent DELETE, which ends in success, back on the list. A persistent
      503 shows the error screen.
    - **Defects:**
      1. Both apps title a failed delete "Couldn't load this document".
      2. On Android after a lost reply (the delete committed), "Try again" says "This document is no longer available."
         and loops.
    - **Decision (standing instruction): `claude/stream4-document-delete-honest` `b5ec6bdaa`.**
      - A failed delete is titled "Couldn't delete this document"; the screen is unchanged.
      - After a failed delete, a reload that no longer finds the document finishes as deleted and returns to the list.
      - Replace failures share the generic headline; not reproduced, so recorded as a candidate.
  - **Recorded candidates:**
    - iOS "1 of 3 invitation left this week." (singular);
    - the web 502 toast is generic;
    - an API double tap says "invited recently" though nothing was sent (clients disable the button);
    - iOS invite-message identifiers are overridden by the form container's.
  - **Runtime:**
    - Login limiter: 10 logins per 15 min per IP, shared by every client on 127.0.0.1. My fixture uploads hit it; the
      closing backend restart cleared it.
    - Lease to Stream 3 at 03:04Z (web only).
  - **Build queued:** `s4-build-greet-form-del` `cadd5e352` (master `19aed325a` + greeting + form clearing + delete fix).
  - **Next window:**
    - greeting before (`sizefix` build) and after, with the backend under `TZ=UTC`;
    - Android form after;
    - Documents delete after (E1 both apps, E2 Android);
    - then more U03.

- **2026-10-01T02:25:58Z — [#1172](https://github.com/WangPantopus/skinny-pantopus/pull/1172), [#1173](https://github.com/WangPantopus/skinny-pantopus/pull/1173) and [#1174](https://github.com/WangPantopus/skinny-pantopus/pull/1174) merged in batch 245 ([#1175](https://github.com/WangPantopus/skinny-pantopus/pull/1175), 01:58Z, master `c171a0056`). Two leads routed by Stream 1 are taken, both decided. Four fix branches are pushed, with device windows next.**
  - **Block Founders invitations always failed** (Stream 2's value-drift scan; launch scope, because postcards stay).
    - The service reserves each invitation as a `BlockInvite` row with status `'reserved'`, but `BlockInvite_status_check`
      allows only `'created'` and `'failed'`. So every send ends at "The invitation could not be sent. Try again shortly."
      before any postcard is attempted. This has been the case since PR 353 (09-01).
    - **Decision (standing instruction): a code-only repair.** The reservation uses the allowed `'created'`. Branch
      `claude/stream4-block-invite-reserve` `3455c9cbf`, base `c171a0056`; no migration, and Stream 1 released `20261001020000`.
      - Nothing reads the status: the dedup, the weekly cap, the panel's budget and opt-out redemption count every row.
      - An unconfirmed reservation is the row whose `lob_id` is null; a `'reserved'` status would add nothing.
      - A code fix ships with the backend, while a migration would wait on a hosted run.
    - **Before/after window next:** API (dedup, opt-out, double tap, cap), web (form plus the signed-out `/no-mail/<code>`
      page), iOS and Android. The runtime backend has no `LOB_API_KEY`, so the product's MockMailProvider handles every send
      and nothing is mailed.
  - **Today's Pulse greeting (iOS, Android)** (Stream 2's lead).
    - The subtitle shows the payload's greeting, built with the server process's `getHours()`. A UTC server says "Good
      morning" on a US evening.
    - **Decision:** greet by the device clock, as the native Hubs and Stream 2's web #1181 do. Android's private Hub
      greeting becomes one file-level `internal deviceGreeting()`. Branch `claude/stream4-pulse-device-greeting` `5fd56d0ca`.
    - Reproduce with the backend under `TZ=UTC`, which matches a hosted server.
  - **Android invite form keeps the address after a successful send** (found in code; confirm on device).
    - The draft is `remember`ed while the panel reloads into the same loaded state; web and iOS clear their forms.
    - Fix: key the draft on the remaining budget. Branch `claude/stream4-block-invite-form-clears` `8e6c0a15d`.
  - **iOS small-file size:** a 193-byte file read "0 KB". All five Documents size formatters (KB/MB/GB only) now also allow
    bytes, and 1,000 bytes and up format as before. Branch `claude/stream4-ios-small-file-size` `132c24e9c`.
    - Before: sealed `20261001-stream4-pulse-honesty-r1`.
  - **Builds:**
    - `ios/android-sizefix` (`132c24e9c`; iOS dylib `45fbc6ae…`, APK `b64763b6…`) is ready.
    - `greetform` (master `e318f26e9` + greeting + form clearing + size fix) is queued in the heavy slot.
  - **Runtime:** Stream 3 holds the lease and the S34 pair (from 02:05:40Z); Stream 4 takes it next.
  - **Next:** the Block Founders window (with the iOS size after and the Android form "before"); then greeting and form
    afters; then the U03 native cells.
    - Most old U03 drivers target the retired devices, so new S34 drivers come first. The first U03 cell is native
      Documents delete (success, E1, E2, E3).

- **2026-10-01T01:57:40Z — Item 5 done: [#1172](https://github.com/WangPantopus/skinny-pantopus/pull/1172) (Pulse honesty), [#1173](https://github.com/WangPantopus/skinny-pantopus/pull/1173) (web Documents Download/size) and [#1174](https://github.com/WangPantopus/skinny-pantopus/pull/1174) (Document detail "Uploaded" row), all with the queue owner. One window, one bundle, exact cleanup. [#1163](https://github.com/WangPantopus/skinny-pantopus/pull/1163) (SwiftFormat whitespace) merged in batch 243 (01:31:47Z).**
  - **Bundle `20261001-stream4-pulse-honesty-r1` (`db20a0d8…`):** 123 files, MANIFEST `db20a0d8f467e73b5ab88548d101f7a188ac464257ca82b07e2c53eb2a99fe6b`, sealed
    01:55:06Z after a clean secret scan (0 hits).
    - Lease `stream4:` 01:22:13Z → about 01:47:50Z, with slot 4.
    - Devices ran one at a time, because 3 other devices were booted.
    - The backend switched master → fix → master → fix → web-docs fix → rest `00bf2d6ff` (PID 91141). Every restart is
      logged.
  - **[#1172](https://github.com/WangPantopus/skinny-pantopus/pull/1172)** `87ccd59cc` (base `e32f321b6`; 9 files: backend, web, iOS, Android). The fixture has three owner Homes:
    A with no coordinates, B checked and clear, C with one synthetic severe heat warning.
    - **A before (master), all three apps:** "All clear · All clear on your block today.". On iOS and Android this sits
      right above three "Not available for your area yet." cards. The AI Pulse said "Your home area is quiet.".
    - **A after:** "Alerts unavailable · Air quality and weather alerts aren't available for your block right now.", with a
      neutral chip and a cloud-off icon in the same frame.
      - The AI Pulse says "We couldn't check for weather alerts on your block right now.", with `noaa` in the partial
        failures and no NWS source.
      - The web Pulse card says "Weather alerts unavailable" instead of "All clear today · No active alerts".
    - **C on native:** the severe warning moves from "WHEN YOU HAVE A MINUTE" to "URGENT". The seasonal suggestion moves to
      "WORTH A LOOK" on all three Homes, as on the web.
    - **B** keeps its all-clear everywhere.
    - **Decision** (standing instruction; recorded in the PR and in the decisions list above): a neutral state instead of a
      new visual variant. Only the chip tone, the icon and the sentence change.
    - **Boundary:** the "Air is good … Weather alerts aren't available" sentence needs AirNow, which has no key here. No
      NWS or AirNow traffic was used.
  - **[#1173](https://github.com/WangPantopus/skinny-pantopus/pull/1173)** `60961a7e9` (base `9b3af1fad`; 1 web file):
    - Before: the PDF row was "S4 Web furnace manual · 9/30/2026", with no size and no link.
    - After: "193B · Download", which downloads `S4-web-furnace-manual.pdf` (193 bytes). The details-only row shows
      neither.
    - The PDF was then deleted through the product route; its storage objects went from 1 to 0.
  - **[#1174](https://github.com/WangPantopus/skinny-pantopus/pull/1174)** `c2108a129` (base `4123bd455`; iOS + Android):
    - The detail's "Uploaded" row goes from "Oct 1 · by <owner>" to "Oct 1".
    - The list row keeps its byline.
  - **Checks:**
    - backend Jest: 50 of 50;
    - web `tsc` and all Jest (2343 tests) on both web branches;
    - iOS builds, plus swiftlint and swiftformat;
    - Android `assembleDebug`, ktlint and detekt;
    - Place tests: 116, and Documents tests: 64 (5 existing skips).
    - All three branches are `merge-tree`-clean on master `75d28eee2`.
  - **Cleanup** at 01:47:09Z: 349 of 353 tables match; the other 4 are auth history. It deleted:
    - `ExternalFeedCache` 4: the 2 fixture rows, plus 2 `SEEDED_BIZ_COUNTS` rows the product created;
    - `Home` 3, `HomeOccupancy` 3 and `PropertyIntelligenceCache` 3;
    - `HomeSeasonalChecklistItem` 2;
    - `HomeDocument`, `File` and `FileQuota`, 1 each.
  - **Devices:** the S34 pair is reset and shut down, with the [#1174](https://github.com/WangPantopus/skinny-pantopus/pull/1174) builds installed. Stream 3 has had the lease since
    01:48Z.
  - **Next:**
    - the iOS "0 KB" size candidate;
    - then item 6, the U03 native cells.

- **2026-10-01T01:09:54Z — [#1140](https://github.com/WangPantopus/skinny-pantopus/pull/1140) merged in batch 232 (00:40:39Z), on its own as a security batch. Schema-drift candidates routed by the coordinator (Stream 2's scan) are triaged; none needs a launch fix.**
  - **Each candidate was checked against the runtime schema. Recorded, not changed:**
    - `jobs/earnRiskReview.js` ×5 is real: `EarnSuspension` has no `status` and `EarnRiskSession` has no `risk_flags`, so
      the 15-minute job's auto-lift and new suspensions both fail.
      - **Decision (standing instruction):** Earn, the mailbox ad/offer earnings, is outside the launch-kept mail scope
        (postcards, welcome cards and the digest only), and it has no cash-out path (founder note in the hub). It's
        treated as cut #8.
      - If Earn returns, fix it with suspension semantics agreed with the coordinator first.
    - `routes/mailbox.js` ×2 is the escrow-mail claim (letters to someone not yet on Pantopus; cut #8).
      - `POST /claim` selects the nonexistent `User.phone`, so the claimer row is null and every claim gets 404. It fails
        closed, with no leak.
      - `GET /claim` reads the nonexistent `UserProfile`, so the sender always shows as unverified.
    - `routes/mailCompose.js:474`: `MailObject.payload` in the compose claim view (stationery; cut #8).
    - `routes/mailboxV2Phase3.js` ×7: My Mail Day, mail memories and `MailPackage` (cuts #8 and #7).
    - `routes/mailboxV2.js:115`: the nonexistent `Business` table in `routeMail`'s business-match step.
      - It fails soft: no mail is routed to a business drawer, and nothing leaks.
      - Fixing it would start routing mail into business drawers, so it's left alone before launch.
    - `routes/files.js:689`: a nonexistent `Home.profile_picture_url` update in `POST /api/files/home`. No client calls the
      route, and the failure is ignored, so it's dead.
    - `services/addressValidation/canonicalAddressService.js:240`: a nonexistent `HomeAddress.merged_into`.
      `mergeAliases` has no production caller (tests only), so it's dead.
  - **Next:** the item-5 window (Pulse honesty, plus the web Documents download fix) once Stream 3 releases the lease.
    - Builds are ready: iOS and Android `87ccd59cc`, with Place unit tests 116/0.
    - The web Documents branch is `claude/stream4-web-docs-download` `60961a7e9`.

- **2026-10-01T00:38:41Z — Security (routed by the coordinator, found by Stream 5): the public Home file listing sent whole File rows to any signed-in account. Fixed: [#1140](https://github.com/WangPantopus/skinny-pantopus/pull/1140), with the queue owner for its own batch. Also [#1131](https://github.com/WangPantopus/skinny-pantopus/pull/1131) merged in batch 229 (00:23:16Z) and #1116 in batch 231 (00:34:21Z).**
  - **The problem:** `GET /api/files/home/:homeId?visibility=public` (public is the default) returned all 27 File columns to an
    account with no relation to the Home, including:
    - `user_id`;
    - `filename` and `original_filename`;
    - `file_path`;
    - `file_context` (e.g. `wifi_info`);
    - processing fields.
    It was reproduced through the real API on master `9b3af1fad`.
  - **The fix:** `e9ead5bbd`, `backend/routes/files.js` only, the same pattern as Stream 5's #1135.
    - The public path sends `id, file_url, file_type, mime_type, created_at`, with metadata trimmed to
      title/description/width/height/thumbnails.
    - The household's private listing is unchanged; the non-member still gets 403 there.
    - No web, iOS or Android code calls the endpoint.
    - Tests: homeFileAccess + paidGigLifecycleRoute, 273 passed.
  - **Seal:** `20261001-stream4-home-files-public-r1`, 20 files, MANIFEST `ce4d9b73c0fb074d6e57054663a49fffb380136b0dee9da2b5ba77f7f37ef375`.
    - API-only lease window 00:34:46Z–00:36:14Z, handed over by Stream 3 between its cases.
    - The backend ran on master, then the fix, then was restored to `00bf2d6ff`.
    - Exact cleanup: 351/353, the other 2 auth.
  - **Correction (process):** my first seal of this bundle (`a96e0f18…`) was withdrawn before use, into
    `runtime/withdrawn-seals/`.
    - The scan flagged the local Supabase URL inside the synthetic `file_url` values, but my chain used `;` and sealed anyway.
    - Redacted and resealed after a passing scan. From now on, scan and seal are chained with `&&` only.
    - It's the second time this stream has made this slip (see the 2026-09-30 web-a11y correction).
  - **New item, recorded and not started:** a public `file_url` embeds the generated stored name
    (`<uploader id>_<ms>_<hex>`), so it carries the uploader's user id. Removing it means renaming stored objects, a data
    change to plan with the coordinator first.
  - **Also in flight:** item 5 (Pulse honesty, `claude/stream4-pulse-alerts-honesty` `87ccd59cc`) is in the heavy slot. The
    web Documents download/size fix (D09) is drafted.

- **2026-10-01T00:22:34Z — Window done (lease 23:39:44Z–00:19:11Z, slots 3/4): Document detail C/D fixed ([#1131](https://github.com/WangPantopus/skinny-pantopus/pull/1131), with the queue owner); iOS dark and web A3 re-measures are clean. Stream 3 has the lease now.**
  - **[#1131](https://github.com/WangPantopus/skinny-pantopus/pull/1131)** `e8f27d9cb` (base `a211e1f48`), bundle
    `20260930-stream4-docdetail-a3-r1`: 240 files, MANIFEST `638a41c39eb3ab5c09a083de85130b53c5a58fdcdf12b29e652a813aa5f467ee`.
    The secret scan passed (240 files, 0 hits).
    - **Before, master builds:**
      - Android C: the image fallback's "Open externally" kept focus and sent 0 requests.
      - D on both apps: the no-file pill only re-read the list (304); on Android, Open and Share did the same.
      - Android drew the disabled Replace like an enabled button.
    - **After:**
      - Android's pill opens the file (`GET …/content` 200 → Photos).
      - A no-file document says "No file attached · This document has details only, so there's nothing to open." with no
        pill, and Android's Open/Share/Replace are disabled and dimmed (0.5 alpha, as `Buttons.kt`).
      - iOS gets no opacity change: the U02 frame shows it already dims disabled plain buttons.
    - **Checks:** iOS build, SwiftLint `--strict`, SwiftFormat; Android assembleDebug, ktlint, detekt and documents unit
      tests (64, 0 failures).
  - **Item 3, iOS dark on master `a211e1f48`:** 13 flags, down from 53 on the same 10 screens. The blue tint (34) and the
    dark "Revoke" are gone; what's left is decorative "·" separators and a disabled "Start watching". The fridge "Revoke" in
    light is 4.54:1 computed (4.48 estimate): borderline-passing, sent to Stream 1 as an FYI with
    `PlaceFridgeCardSection.swift:354–357`.
  - **Item 4, web A3 on master `763969f07`:** 0 axe findings on 14 screens, light and dark. This closes the dashboard and
    Issues ⬜ cells.
  - **Window:**
    - The shared worktree and backend ran master `763969f07` (restart 23:40:31Z) and were restored to `00bf2d6ff` (restart
      00:18:47Z, PID 20230); HEAD, status and launch.json are equal.
    - Fixture Home `265d037b`: uploads deleted through the product route (objects 2 → 0), then the exact cleanup at
      00:18:14Z, 349/353 plus 4 auth. That included a lazy `UserReferral`, 2 pickup rules and the owner's `FileQuota`.
    - The S34 pair is reset and shut down, with the #1131 builds installed.
    - DerivedData and the Android `app/build` were deleted after the builds (Stream 1's disk rule).
  - **Decisions (standing instruction):**
    1. An action that can't run must look unavailable; Android uses the design system's disabled alpha.
    2. A document with no file says so plainly rather than promising another app.
    3. The detail's repeated uploader ("Uploaded Sep 30 · by …", from #1104's shared formatter) is cosmetic and kept out of
       #1131; it's recorded as a candidate.
  - **New candidates:**
    - Web Documents never shows "View" or the size: it reads `file_url`/`file_size`, which the API doesn't send; the API
      sends `content_url` (an authorized `attachment` download) and `size_bytes`. That's a D09 web reader.
    - The repeated uploader above.
  - **Next:** item 5 (Pulse honesty), drafted in my scratchpad; befores on the kept master builds.

- **2026-09-30T23:45:29Z — New Stream 4 session (resumed 23:12Z). #1116 is with the queue owner; Document detail C/D is being reproduced; the lease is held from 23:39:44Z.**
  - **#1116, lint only** ([#1116](https://github.com/WangPantopus/skinny-pantopus/pull/1116), head `9b3347813`, on master `763969f07`).
    - #1103 (batch 223) left a `trailing_closure` error in `HubTabRoot.swift:3343` that fails master's `swiftlint --strict`.
      Stream 2 found it; the coordinator asked Stream 4 to own the fix.
    - The fix is one hunk: the closure becomes a trailing closure, with no behaviour change. SwiftLint `--strict` gives 0
      violations and SwiftFormat 0/1.
    - It was built with git plumbing (a temporary index plus `commit-tree`), so the session worktree, which two queued
      builds were using, was never touched.
    - The coordinator reviewed it and is batching it after its candidate build compiles.
  - **Item 2, Document detail C/D.** Branch `claude/stream4-document-no-file-actions` `e8f27d9cb`, from `a211e1f48`.
    - Android C: the image-decode fallback's "Open externally" gets its action.
    - D, a document with no file: the preview says "No file attached · This document has details only, so there's
      nothing to open." with no pill (iOS and Android), and Android disables Open and Share, as iOS already does.
    - Android's disabled footer actions draw at the design system's disabled alpha (0.5, `Buttons.kt`).
    - The existing U02 frame (`20260930-stream4-u02-native-r1`, `document-detail-0`) shows iOS already dims disabled
      plain buttons, so iOS gets no opacity change (it would double-dim).
    - Before/after captures are in progress: stage `stream4-docdetail-a3-r1`, fixture Home `265d037b`, S34 pair in slots 3
      and 4.
  - **Window:** the shared worktree and backend run on master `763969f07` (restart 23:40:31Z, PID 81606) and will be
    restored to `00bf2d6ff`.
    - Items 3 (iOS dark re-measure) and 4 (web A3 live re-measure) run in the same window. #1061 merged at 21:10:19Z.
  - **Found, next:**
    - The Place hero and the Today's Pulse page can read as an all-clear when weather alerts weren't checked.
      - The AI Pulse composer treats an NWS `error` or a Home with no coordinates as "Your home area is quiet".
      - Both native Pulse pages tier signals by 80/50/25 on the backend's 0–10 scale, so a critical alert files under
        "When you have a minute".
      - This is item 5, drafted, for the next window.
    - Web Documents never shows "View" or the size. It reads `file_url` and `file_size`, which the API doesn't send; the
      API sends `content_url` and `size_bytes`. That's a D09 candidate.
    - Sent to Stream 2: the Pulse signals' `/gig-v2/new` actions are an Open Gigs (cut #4) entry point, so no change.

- **2026-09-30T22:21:17Z — #1102–#1111 merged in batch 223** ([#1112](https://github.com/WangPantopus/skinny-pantopus/pull/1112),
  master `a211e1f48`). The coordinator checked every head and each bundle's integrity (verify-batch: 46 files).
  - Review notes: #1104 lets only the display name leave the server. The #1111 `alertsChecked` rule was accepted. The
    Pulse hero with nothing known is an open design question (next-list item 5).
  - Stream 4 has no open PRs. The next queue owner is the next Stream 1 session.

- **2026-09-30T22:19:24Z — HANDOFF. The fixes window is done: 10 PRs (#1102–#1111) are with the coordinator, 4 bundles are sealed, and every fixture is cleaned. Lease and slot 4 were released at 22:11:38Z.**
  - **Window** (lease 21:11:01Z–22:11:38Z, slot 4, S34 pair):
    - U02: Android Maintenance detail captured in base/xl/dark after the driver fix.
    - Your home: seeded, with a dummy ATTOM key behind the egress guard (restart 21:21:39Z).
    - Before-sweeps on master `1e1b6bacc`, iOS and Android (plus Android at font 2.0).
    - Web before: Your home and Civic.
    - T3 fixture for the verify controls. The first attempt, r1 (unverified occupancy), was refused with 403 and cleaned exactly.
    - Alerts backend path reproduced: a Home with coordinates read alerts `ready` with 0 active while hub `partial_failures`
      included alerts.
    - Patches applied and the backend restarted (21:45:18Z). After-sweeps on the 10-branch build `a93b3e462`. Web after.
    - Reverted with `git apply -R`; resting restart at 22:10:51Z.
    - Exact cleanups:
      - r1 21:38:42Z (353/353);
      - r2 22:00:34Z (351/353 plus 2 auth);
      - U02 fixture 81cb4308 22:11:17Z (349/353 plus 4 auth). This included a `UserReferral` side-effect row and 2
        AddressCalendarRule scope rows.
    - Devices reset and shut down.
  - **New in the window:** the native Today Alerts card ignored its section status (an unavailable section read "No active
    alerts"). Fixed in the alerts PR (`3c2b76535`, iOS and Android), alongside the backend half.
  - **Seals:**
    - `20260930-stream4-u02-native-r1`: 706 files, `9e375256…`;
    - `…-verify-actions-r1`: 12 files, `94781d84…`;
    - `…-verify-actions-r2`: 65 files, `d8e02bba…`;
    - `…-fixes-r1`: 401 files, `5de362b2…`.
    - Secret scans passed before each seal.
  - **Correction:** r1's README says its scan covered "13 files". The scan and the bundle both have **12**. The sealed bundle
    isn't edited.
  - **U02 cells:** this stream's native cells are updated in the table. A3 dark (the iOS tint) waits for #1061. Web A3 has a
    source-level pass, and its live re-measure is next-list item 4.
  - **Handoff:** the CURRENT RESUME at the top is rewritten (state, next list, lessons, decisions), and the resume prompt
    `NEXT-STREAM4-PROMPT-2026-09-30.md` is updated to match.

- **2026-09-30T20:41:10Z — Two more honesty fixes in my Place rows, found by reading code against my U02 frames; both committed on branches for device before/after in my next window.**
  - **Place Today Alerts: a failed alerts check read as an all-clear** (safety). Branch `claude/stream4-alerts-no-false-all-clear`, `74f494001`, backend only.
    - When the alerts fetch fails, `providerOrchestrator.getHubToday` returns `alerts: []` with `'alerts'` in `meta.partial_failures`. Its empty result (no location, or an unexpected error) returns `alerts: []` without asking any provider.
    - `placeIntelligenceService.composeToday` passed both on as a real empty list, so the section read "No active alerts — Nothing to watch for on your block right now" ("National Weather Service · live" on web).
    - My U02 frames show this on both apps, on a runtime where no provider can be reached.
    - Fix: alerts count only when they were checked; otherwise the section is `unavailable`, as weather and air already are. Backend Jest suites that touch Place intelligence pass.
    - **Recorded, not changed:** with nothing known, the native Pulse hero still says "All clear on your block today." There's no neutral hero variant, so that needs a design decision later.
  - **Place Civic: "No upcoming election" promised a polling place and a plain-language ballot** (web, iOS, Android). Branch `claude/stream4-civic-no-ballot-promise`, `589f46637`, copy only.
    - The `civic_election` section always sends `polling_place: null` and `ballot: []` ("lands with the ballot wave").
    - The sentence now promises only the date. Web Jest 2,343/2,343, `tsc` and ESLint pass.
  - **Decision (standing instruction):** truth over promise, as with the Your home trend.
  - Stream 2 is taking the Place preview's three matching claims (radon; civic "deadlines…" and "ballot deadline…") in one PR.
  - **Builds:** the 8-branch build is next in the heavy queue. A 9-branch build (adds Civic) follows Stream 1's next build, and its outputs are the ones I'll use for after-captures. The alerts fix needs no client build: the runtime backend gets the patch in my next window (`git apply --check` passes).

- **2026-09-30T20:31:32Z — Sent to Stream 2 (owner of the Start and Place preview rows): the preview's radon card promises a reminder that doesn't exist.**
  - `placePreviewService.js` `lead_radon` `follow_up`, :311 and :320 on master `20e7b4768`: "Claim it and we'll remind you when a test kit is due."
  - The founder's 09-26 launch-boundary amendment A3 removes it. Its interim line is "The EPA recommends testing every home, whatever the zone."
  - Also since the last entry:
    - The 7-branch fixes build is green: iOS build; Android assemble, ktlint, detekt and unit tests; Paparazzi verify of `place.*` and `homes.*` (95 snapshot tests, no golden changes).
    - The 8-branch build (with the warranty chip and its re-recorded golden) is first in the heavy queue.
    - U04 native drivers for my rows are drafted and not yet run on devices: `tools/s4-u04-android.sh` and `tools/s4-u04-ios.sh`, on Stream 3's step tools and fixture tool.

- **2026-09-30T20:12:21Z — Three stale checklist cells corrected from code and PR history; no runtime was used, since Stream 3 holds the lease.**
  - **iOS Place election date → ✅.** My own #922 (merged 09:40:00Z; bundle `20260930-stream4-ios-civic-date-r1`, MANIFEST `750ef739…`) already shows a date-only Election Day. The ⬜ was never updated.
  - **Web A3 🔷 → ⬜ live re-measure only:** master `20e7b4768`'s source passes after Stream 1's #1044 and #1052.
    - The health chip uses the warning, success and error tokens (at least 5.24:1 light and 6.23:1 dark).
    - The Owner chip's emerald tint and text flip together (6.78:1 light, 8.8:1 dark).
    - The Issues status badges use semantic tokens (4.83:1 to 9.74:1).
    - Ratios are computed from `globals.css` and `tailwind.config.js` on master. The live re-measure (`web-a3-master.patch`) runs in my next lease window.
  - **Android Document detail candidate, not yet reproduced:** an image that fails to decode shows "Preview not supported" with an "Open externally" pill wired to `{}`, a dead control. iOS says "Image unavailable" with no button.
    - It's reachable because uploads check only the declared mimetype.
    - Reproduce first, on the local runtime in my next window.

- **2026-09-30T20:07:15Z — The lease and device slot 4 went to Stream 3 at 20:03:33Z, with both S34 devices reset and shut down. The native U02 sweep is paused until my next window (one capture left, then cleanup and seal). New A3 finding: the Warranties chip.**
  - **Handover:**
    - iOS S34 was reset to the default text size and light mode at 19:29:22Z, then shut down at 20:03Z.
    - pantopus_s34 was reset to font 1.0 with night mode off (20:02:29Z); the app was force-stopped, then `emu kill`.
    - The backend is on `00bf2d6ff` with no patches (since 18:32:38Z). I set no fault rules.
    - Fixture Home 81cb4308 stays during Stream 3's session, as agreed.
  - **U02, since the 19:39:31Z entry** (the bundle isn't sealed yet):
    - **Android A2:** the app is light-only by design (`Theme.kt`; #1013). In system night mode it stays light and readable, with no dark Material surfaces, as Stream 2 recorded for its screens. The dark pass was stopped after 20 frames; reruns added the Place dashboard.
    - **A3, a new finding on both apps:** the Documents "Warranties & manuals" chip is 4.42:1 (yellow-700 text on its FEF3C7 tint), under 4.5:1.
      - Fix: `claude/stream4-document-warranty-chip-aa` `371f4e0c3`, one palette step darker (yellow-800, 6.15:1), per the user's decision 3.
      - The other seven categories measure 4.52:1 to 8.4:1.
    - **Correction to the 19:39:31Z entry's iOS A3 line ("light mode is clean apart from disabled controls"):**
      - It missed that chip.
      - It also missed the fridge card's "Revoke", a system `.bordered` button: 4.49:1 in light mode (borderline) and 3.13:1 in dark. I'll re-measure it after Stream 1's #1061 and send any gap there.
    - **Android maintenance detail was never captured, because of a bug in my driver.** It tested found nodes with `if t:`, and an ElementTree node with no children is falsy, so the Completed tab was never tapped.
      - The app works: a manual tap at 19:46:55Z and a replay of the driver's steps at 19:56:31Z both listed the log.
      - The driver is fixed (`is not None`); the capture moves to my next window.
      - The same flaw skipped the pickup editor's Cancel. Nothing was saved: the sweep never taps Save, and every screen starts with a force-stop. Cleanup checks the pickup row against the baseline.
      - My other Android tools use dict nodes, and Stream 3's Android sweep uses `is None`, so neither is affected.
  - **Builds:**
    - The all-fixes build (7 branches, heads resolved when it starts) is third in the heavy queue.
    - The warranty-chip checks follow it: ktlint, detekt, a Paparazzi verify over `homes.*`, a record of `DocumentSearchSnapshotTest`, and an iOS build.
  - **Next window, after Stream 3:**
    - capture Android maintenance detail in all three modes;
    - then `fixes-window plan` (before/after on the fixes builds);
    - clean up 81cb4308 exactly, then seal U02;
    - open the PRs.

- **2026-09-30T19:39:31Z — U03's ❓ cells are checked against sealed evidence; the native U02 sweep has finished iOS (base, xl, dark) and Android base and xl; two more Android large-text fixes.**
  - **U03:** a read-only search of the audit store; I opened every cited file before changing a cell.
    - **✅ from existing seals:**
      - Maintenance R2 on iOS (0927 maintenance-edit-read) and Android (0928 maintenance-delete).
      - Documents R2 on both apps (0927 malformed-home-lists, 0927 home-list-null-members).
      - Emergency E2 on Android and for iOS add (0930 emergency-server-writes; #939). Also iOS add E6 for a blank title.
      - Bill benchmark R2: iOS (Place Money and the Home bill card) and Android (the Home bill card).
    - **⬜, because no native capture exists:**
      - Home health E1, E3 and R2.
      - Android pickup E2 and E4.
      - Home issues E3 and E6.
      - Fridge E3, plus E6 on Android.
      - Android maintenance E3.
      - iOS Emergency add E1, E3 and E4, and every delete case.
    - **Not offered (–):** the bill-benchmark opt-in is web-only.
  - **U02 native sweep** (`20260930-stream4-u02-native-r1`, not sealed yet). The fixture Home 81cb4308 stays until my next window.
    - **iOS:** base 57, xl 52 and dark 49 frames. After reruns with the fixed driver, every mode covers all 17 screens.
      - A1: iOS keeps its fixed type ramp (the user's 09-29 decision; Stream 3's decision 6), so nothing clips.
      - A2: clean.
      - A3: light mode is clean apart from disabled controls. The dark-mode tint items are with Stream 1 (#1056 merged; #1061).
      - A4: one gap, the Fridge composer's remove-row control (fix branch `claude/stream4-fridge-remove-row-name`).
    - **Android:** base 67 and xl 73 frames; dark is running. These screens need reruns because the driver missed them:
      - maintenance detail: the Completed-tab tap raced the screen under build load;
      - the pickup editor at xl: Save starts below the fold, and the editor was open;
      - emergency at base.
  - **New Android large-text fixes** on `claude/stream4-android-large-text`, after `da4edae41` (3 commits, head `2aeef6b55`).
    - **`66b96d68e` Document detail:** at font scale 2.0, the "Preview not supported" fallback outgrew its fixed 260 dp frame and cut the "Open externally" label in half. The fallback now uses 260 dp as a minimum and grows to fit.
    - **`2aeef6b55` Place inline readings:** "Recycling day · In 2 days" broke into "Rec / ycli / ng / … / day / s". From font scale 1.5 the reading sits under its title, the threshold `da4edae41` uses for the quick actions.
    - **Decision (standing instruction):** both change layout only from font scale 1.5, where the text was unreadable. Default-size layout and styling are unchanged.
  - **Correction:** the 19:01:28Z entry's verify-actions head `7028b9ef5` was amended to `c7073adfd`. `git diff` shows only a KDoc moved to satisfy ktlint.
  - **Builds:**
    - The combined build `fda207ff8` (honesty, verify, uploader and maintenance on master `5fded9767`) finished for iOS and Android (APK sha256 `81192c84…`).
    - At 19:33:31Z I stopped its report-only Paparazzi step and my queued all-fixes build, which freed the heavy slot; Stream 3 took it.
    - I'll re-queue the all-fixes build with these commits after the Android dark review.
  - **Next:** the Android dark review and reruns, then a device reset. The lease and slot 4 go to Stream 3 around 20:00–20:10Z.

- **2026-09-30T19:02:48Z — correction to the 19:01:28Z entry: fixes 3 (My Mail Day) and 4 (Stamps) are launch-cut #8 work, so they're recorded, not pursued.** The former Stream 2's cut map (`former-stream2-home-household.md`, "Mail extras (8)") lists household letters (routing, read state…), certified mail and e-signing among the cut surfaces, and I missed it when I committed them.
  - **My Mail Day** triages and routes household letters. **Stamps** (the postage wallet and the collection earned by letter actions) serves only mail extras. Both branches stay local and unpushed as future-ready work: `claude/stream4-mailday-no-sample-fallback` `4cd7f9e7d` and `claude/stream4-stamps-no-invented-wallet` `608849fa2`. Their queued build was cancelled.
  - **Recorded under cut #8, not fixed:**
    - iOS My Mail Day shows the sample day on any read failure (`MailDayViewModel.fetch` → `MailDaySampleData`), and accepting a suggestion posts a fixture id;
    - Stamps' wallet is sample data with a local-only "Buy";
    - postal certified mail always claims "USPS Certified Mail" and "Postmark verified" (`CertifiedDetailLayout.defaultCarrier`, both apps);
    - the mailbox map's "You are here" sits at a fixed sample point.
  - **For the user's flags:** all four show invented data if they aren't behind the mail-extras flag. The fix shapes are on the two branches (error state; collection-only Stamps) and in this line (certified: no postmark claim without data; map: hide the dot without a location).
  - **Still pursued:** fixes 1, 2 and 5 (the Your home trend, Place verify actions, document uploader names), which are Place and Home records, in scope.

- **2026-09-30T19:01:28Z — #1040 merged; [#1062](https://github.com/WangPantopus/skinny-pantopus/pull/1062) (native activity labels) with the coordinator; five more fixes on branches, found on devices and by read-only sweeps; the native U02 sweep is running.**
  - **#1040 merged** (batch 209, 18:37:55Z, master `2693fcbcf`). The coordinator found a gap in review: Android's `openedVersion` was keyed on content only. Fixed in `ced76d805` with a version key.
    - **`20260930-stream4-native-pickup-e5-r3`** (MANIFEST `5889ef2148f1d8eceb6797f50044cf70691725c0a7cff76304ebfa45d4108b7d`): the identical-content case. Both Android builds recover with one 409, a reopen and 200, because refresh() unmounts the editor. iOS takes the new version from the 409 reply. So the key is recorded as a guard, not a fix for a reproduced loop.
    - **`20260930-stream4-native-pickup-e4-ios-r1`** (MANIFEST `5a09bdb49f61dafae5694ceec09bd7a899819d17cdfb5e9ad2f574210dc994dd`): the iOS 403 now reads #1003's permission sentence. Accounts were switched with no raster (new `tools/ios-s34-switch.py`).
  - **#1062** (head `349372dad`): the Recent activity card reads the web's sentences over "Home activity".
    - Seals: `20260930-stream4-native-activity-r1` (MANIFEST `6162da25d1b7a91a6babfed3d0eb3e65c64493fe5d4cac0aa0dcc791cc4c73c7`) and `-r2` (`383cbde52cf77baa7275e4d3dbca7f06fcb62cfe4300cf5f5b1019c75e6da510`).
  - **New fixes, committed on local branches; device before/after next:**
    1. **Place "Your home" draws an invented value trend** (web/iOS/Android; `claude/stream4-place-value-no-invented-trend` `09ece6779`).
       - A fixed, always-rising line sat next to the real estimate. The detail labelled it "Your home" against "Block median". No data backs either, and the web source called it "decorative, not data-bound".
       - The card and detail now show the value and range only. Web Jest 1,951/1,951, tsc and ESLint pass.
       - **Decision (standing instruction): honesty over decoration.**
    2. **Place detail "Verify address" buttons did nothing** (Stream 2's dead-control sweep; `claude/stream4-place-verify-actions` `7028b9ef5`).
       - The seven locked CTAs now open the dashboard's verify sheet and its real flows.
       - The iOS hero's Pulse nudge had no action: an unlabelled trailing closure bound to `onTap` in Swift 5.
       - PendingPlace's dropped `onVerify` is latent (nothing reaches it) and unchanged.
    3. **iOS My Mail Day showed an invented day on any read failure** ("Con Edison bill" for "Maria Kovács"); accepting a suggestion then posted a fixture id. It now shows its existing error frame with Try again, as Android does (`claude/stream4-mailday-no-sample-fallback` `4cd7f9e7d`).
    4. **Stamps rendered a postage wallet with no backend** (both apps; `claude/stream4-stamps-no-invented-wallet` `608849fa2`).
       - The wallet was a sample book "purchased Apr 2, 2026", a usage ledger, an issuer, and "Buy more stamps", which only changed local state.
       - The screen now shows the live collection and the themes, with a retryable error.
       - **Decision:** keep the real collection and drop the invented wallet, rather than hiding the whole screen.
    5. **Document detail showed "Uploaded by bb1d5fae-…"** (both apps; found in the U02 sweep; `claude/stream4-document-uploader-name` `7d0268a2f`). The documents list now returns `uploaded_by_name` (the timeline's display-name rule), and the apps show the name. Backend document suites: 265/265.
    - **Also found:** Hub Today's sample Sun & sky and share card (Stream 2's; already fixed in their #1038).
    - **Not changed:**
      - certified mail's always-on "Postmark verified" pill and the mailbox map's fixed "You are here" (next, to verify);
      - the Android mailbox's "stale sample" drafts, which were dormant.
  - **Native U02 sweep** (stage `20260930-stream4-u02-native-r1`, master `1e1b6bacc` builds, fixture Home `81cb4308…`).
    - Tools: `tools/ios-s4-u02-sweep.py`, `tools/android-s4-u02-sweep.py` and `tools/s4-u02-contrast.py`.
    - **iOS base:** no unnamed controls and no overflow beyond the Home header's scrolling tab strip.
    - **iOS A3 light:** clean on Stream 4's screens. The only flags are disabled controls ("Start watching" before input, and a metadata-only document's file actions), which WCAG exempts, plus chrome-zone false positives that are now excluded.
    - xl, dark and Android are running. A 15-minute lease window went to Stream 3 at a pass boundary.
  - **Lesson:** when handing the lease to a peer mid-window, don't queue a re-acquire until they've taken it. FIFO granted it straight back to me at 18:51:59Z; I released it at 18:52:22Z and told them.

- **2026-09-30T17:20:04Z — [#1040](https://github.com/WangPantopus/skinny-pantopus/pull/1040) with the coordinator: native address calendar E5 ✅ on iOS and Android (sealed); activity-labels fix device-verified for titles; lease handed to Stream 3.** Lease 16:59:02Z–17:14:57Z.
  - **#1040** (head `c1015442f`, rebased on master `1e1b6bacc`, one commit, apps only). Both editors send the `pickup_version` they opened as `expected_version`.
    - **iOS:** a 409 loads the current schedule into the open editor with "The pickup schedule changed since you opened it. Review the current schedule and try again." A 403 shows #1003's sentence.
    - **Android:** a 409 keeps the sentence and reloads the card.
    - **Seals:** `20260930-stream4-native-pickup-e5-r1` (63 files, MANIFEST `320730f65805207b758eb95a8bd3c9165a6ac6bea77c3dc7031edb111fb00f91`: iOS before ×2, iOS after, Android before) and `20260930-stream4-native-pickup-e5-r2` (26 files, MANIFEST `ae013ff61fa8474afa5f592c47d6f9e28e2ac4791925423ba9e41875ce21bd51`: Android after, 409 at 17:05:14Z, retry 200 at 17:05:48Z, both changes kept).
    - **Not run yet:** the iOS 403 wording on a device; it's in my next window.
  - **Native activity labels** (stage `20260930-stream4-native-activity-r1`, not sealed yet). Before, on both apps: "s2resumeowner: HOME INVITE CREATED" and "…: Home checklist updated" (a completed item), each over its raw table name ("HomeInvite", "HomeSeasonalChecklistItem").
    - The fix builds against the old server show the same fallback titles, with no crash.
    - With the server's `description`: "Invitation sent" and "Checklist item completed" on both apps.
    - **Found on the devices:** the detail line still showed the table names. Commit `e1b800f9d` makes it "Home activity", the existing fallback. It's rebuilding in the heavy slot, and its after-run comes in the next window, before sealing and the PR.
    - **Decision (standing instruction):** keep the two-line row and use the fallback words. A readable per-area label would need a new mapping on two clients. `target_type` is always an internal table name (HomeInvite, HomeOccupancy, HomeOwnershipClaim…), and the title's sentence already says what happened.
  - **Cleanup:** exact both times: pickup r2 Home at 17:06:27Z (349/353) and activity Home at 17:14:31Z (351/353); only auth history differs.
    - Both backend patches were reverted, and the backend is on `00bf2d6ff` (17:14:45Z).
    - The devices were shut down, and the lease and slot 4 went to Stream 3 at 17:14:57Z.
  - **Kit fixes:**
    - `s4-activity-setup.py` invites with `relationship` (`role_base` gets 400 INVITE_INVALID, as Stream 3 found) and has an `invite` step.
    - Both activity drivers match the upper-case "RECENT ACTIVITY" title.
  - **Next:**
    - the native U02 sweep (master `1e1b6bacc` builds are ready: iOS 17:09:55Z, Android 17:13:05Z) with the activity after-run and the iOS E4 check, in the next lease window;
    - verifying a read-only agent's source-level finding of design-sample data on native production paths (my Place value sparkline; mail stamps and My Mail Day; Hub Today goes to Stream 2).

- **2026-09-30T16:51:21Z — native mailbox package detail shows design-sample tracking: recorded under launch cut #7, not fixed.** Found by Stream 2 at source level.
  - Android `MailboxItemDetailViewModel.timeline()`/`packageBodyContent()` and iOS `MailboxItemDetailViewModel.swift:1032/1042/1066` + `CategoryBodies.swift:61` fall back to `MailItemSampleData`/`PackageMailItemSampleData` (Sacramento route, fixed May dates, possibly a sample tracking number, URL, photo or contents) whenever the server omits a field.
  - Package mail items belong to package tracking (the package routing in `mailbox.js` ~1287 creates package records), which is household extras, launch-cut #7.
  - **Fix shape for when packages return:** show server data only; drop a section or say "not available" when a field is missing; never ship sample fallbacks.

- **2026-09-30T15:37:32Z — native pickup E5 in progress; web A3 re-measured on master's tokens; a screenshot-masking correction.** Lease 15:14:33Z–15:35:16Z.
  - **Native pickup E5** (branch `claude/stream4-native-pickup-changed-meanwhile`, head `c7ecaaa55`; stage `20260930-stream4-native-pickup-e5-r1`, not sealed yet):
    - **iOS before (old build):** a stale editor save silently deleted another device's weekly recycling. The runtime backend and master's pickup backend both give 200.
    - **iOS after:** 409. The editor stays open showing the current schedule (Tuesday, Every week, Thu Oct 1), with "The pickup schedule changed since you opened it…" in the card's existing error line. Choosing Wednesday again saves both changes.
    - **Android before:** same silent loss.
    - **Android after:** waits for my APK rebuild in the heavy slot; detekt wanted `HTTP_CONFLICT` instead of 409.
  - **Web A3** (`20260930-stream4-a3-remeasure-r1`, MANIFEST `7999c8ffc22b70f2b5395779dc8495f8a72c96d6a726336dc4615dfaeedd9efd`): with master's two token files patched into the runtime (proven live), the fridge leaf and public page, Place and three records pages are clean.
    - Stream 1 has the three residuals: the health chip's inline amber, the issues badge's inline amber, and the dark-mode "Owner" chip (#979 side effect).
  - **Correction:** `tools/a11ycap-s4*.mjs` did not mask the signed-in account label. The app-shell captures in the sealed `20260930-stream4-fridge-a11y-r1` (the fridge-leaf light/dark PNGs) show the fixture owner's truncated e-mail in the sidebar. Sealed bundles aren't edited, so this entry is the correction.
    - Both tools now mask both kit accounts at capture.
    - The A3 bundle was sealed without its 39 app-shell captures.

- **2026-09-30T14:25:05Z — iOS Mail tasks "Post as Task": recorded under the launch cut, not fixed.** Stream 1's alert scan found the dismissal-clears pattern here.
  - `MailTaskListView`'s confirmationDialog clears `convertTarget` on dismiss before `Task { await confirmConvert() }` reads it, so no request is sent (same shape as #980).
  - The action is open public task posting ("posted as a neighbor task"), launch-cut #4. On master, `POST /api/mailbox/v2/p3/tasks/:id/to-gig` always answers 409 HOME_TASK_GIG_FLOW_REQUIRED, so it can't complete even with the dialog fixed.
  - **Fix shape, for if open posting returns:** `presenting: viewModel.convertTarget` and `confirmConvert(row)`, verified by the proxy seeing the request.
  - Also: Stream 5 removed the unused `config/supabase` import from `backend/routes/mailbox.js` in #1015, agreed with Stream 4.

- **2026-09-30T14:12:21Z (committed) — correction to the 14:10:47Z fridge a11y entry.** The sweep ran on the shared runtime at `00bf2d6ff`, which predates Stream 1's #979 (AA tokens, batch 184).
  - My "fridge code identical to master" check covered the fridge files but **not the shared design tokens** (`tailwind.config.js`, `globals.css`).
  - The two failing pairs (4.09:1 and 3.82:1) are the old `primary-600`. Master maps `bg-`/`text-primary-600` to `#0369A1`: 5.93:1 white-on-fill and 5.53:1 on `#f6f7f9`, computed, not yet measured.
  - A3 is back to ⬜ until a re-measure on master's tokens: the next lease window, with the two token files patched into the shared web.
  - The sealed bundle stays as is; this entry is the correction.
  - **Lesson:** for any visual or a11y check on the shared runtime, diff the design-token files too, not only the feature files.

- **2026-09-30T14:10:47Z (committed) — three web verifications sealed, no code change.** Lease 14:01:01Z–14:08:47Z.
  - **Home health E1/E3/E4/E5** (`20260930-stream4-health-e1e3e4e5-r1`, MANIFEST `6363e3964f78dd53ad935c5aa0141b9d4e0e98e52560cb3d11873990a33d1f77`):
    - E1: an honest alert with Retry. E3: one PATCH.
    - E5: a stale skip gets 409 and the other device's completion stands.
    - E4: refused and nothing written, but the checklist turns read-only without a sentence saying why. Later wording item: show the refusal's reason on a 403. The bill opt-in has the same pattern.
  - **Fridge card web a11y** (`20260930-stream4-fridge-a11y-r1`, MANIFEST `881920e966886a85c9e974b6593731951bd999084066b641ffe367ef2876a888`): A1 A2 A4 A5 pass. A3 is only the brand primary token pairs (4.09:1 and 3.82:1), sent to Stream 1 for the AA token change.
    - The only ring-less stop is the Next.js development overlay portal.
  - **Pickup L1/L3/L4 and Place L4** (`20260930-stream4-pickup-l1l3l4-r1`, MANIFEST `dfd844f9141648bc8bce7fa5c2c45b1484a133d5820d033aa3114f6a10211498`, on master `4d78c00e4`'s pickup code patched into the runtime):
    - L1: the draft is kept across the hide and return.
    - L4: 401, then refresh, then one save.
    - L3: member B gets the honest refusal and sees no owner data.
  - **Harness lessons:**
    - The login limiter (10 per 15 min per IP) was hit once; restarts reset it.
    - The member's lazy MailPreferences row, and the pickup rules (no FK to Home), need exact extra scopes in cleanup.
    - Node fetch after a long idle can fail at the network level; sign in fresh with `connection: close`.

- **2026-09-30T13:57:10Z (committed) — #1003 merged (batch 190, master `4d78c00e4`): web address calendar E4 ✅.**
  - **Native queue:** the iOS pickup editor shows fixed copy for any failure ("…Check the next collection date and try again."), including a 403. It should use the refusal's `message` (`catch APIError.forbidden(let message)`), with the permission sentence as the fallback.
  - Android already prefers `message` for a readable 403. Verify both on devices in the next native batch.

- **2026-09-30T13:52:49Z (committed) — #997 merged (batch 188, 13:50:33Z, master `63e409b89`): web address calendar E5 ✅.** #1003 (E4, stacked) goes in the next batch.
  - **Address calendar R2 (empty) is confirmed from existing evidence on all three platforms, with no rerun.** The 0927 place-pickup captures (`web-first-use.txt`, `ios/first-use.json`, `ios/cleared.json`, `android/first-use.txt`, `android/cleared.txt`) show "Nothing on the calendar for the next two weeks." at first use and after Clear.
  - `git diff 44d4c71ec origin/master` touches no empty-state or `upcoming` line on any platform. The iOS and Android files are unchanged, and the web card's 24 changed lines are #997's form and save handling.

- **2026-09-30T13:51:29Z (committed) — [#1003](https://github.com/WangPantopus/skinny-pantopus/pull/1003) is with the coordinator, stacked on #997: a refused pickup change now says it's a permission (U03 web address calendar E4).** Head `7a767236cc5ed911088cc288eb05952cebaae4bb`. Bundle `20260930-stream4-pickup-e4-r1`, 30 files, MANIFEST `63deccdf2c227f7b925a870361ebcc307135e4d1e6a6f5163719d4abd1f56620`. Lease 13:41:03Z–13:49:02Z.
  - **Before (master, 13:41:47Z):** a member with an owner `calendar.edit` deny (or a child member) saved and cleared on web. They got 403 with the alerts "Could not save your pickup day" / "Could not reset your pickup day", with Save still enabled. Nothing was written.
  - **After (13:48:42Z):** both get 403 `HOME_ACCESS_DENIED`, and the card's existing error line reads "You don't have permission to change this household's pickup schedule." The member still reads the calendar.
  - **Not covered:** iOS keeps its fixed copy for any failure: "Could not save your pickup schedule. Check the next collection date and try again." Recorded as a native item. Android's readable-403 rule prefers the new `message`, but it wasn't run on a device.
  - **Restart-log correction:** the 13:48:09Z backend restart entry claimed a patch that didn't apply (a relative path under `git -C`); a correction line follows it at 13:48:19Z. The run used the real patched restart at 13:48:30Z.
- **2026-09-30T13:51:29Z (committed) — two web cells verified with no change (sealed, no PR).**
  - **Bill opt-in E2/E3** (`20260930-stream4-optin-e2e3-r1`, MANIFEST `29d0d255df7caa69fe13ff638e59f0ee283a3299f620dc41bbc64698682d3c0b`): a double click sends 1 PATCH. After a lost reply (the reply held 35 s against the 30 s client timeout), the card says "The sharing preference was not confirmed. Reload current bill trends…". The reload shows the committed value, and a re-save is one more request. 3 in total by proxy id.
  - **Fridge card E3** (`20260930-stream4-fridge-e3-r1`, MANIFEST `b768ba2ab76032f057338d5f1b58c823cc1c8177b457627c11cc33b5b45bf446`): a sub-frame double click sends 2 requests each for issue and revoke. Issue dedupes by its client id and revoke answers its existing receipt: one card, revoked once, no error toast. Duplicate success toasts weren't measured.
  - **Login limiter:** 10 sign-ins per 15 minutes per IP. The owner hit it once, at 13:45Z. Plan runs that sign in several accounts accordingly; a backend restart resets it.

- **2026-09-30T13:35:23Z (committed) — [#997](https://github.com/WangPantopus/skinny-pantopus/pull/997) is with the coordinator: a stale pickup form no longer undoes a schedule saved meanwhile (U03 web address calendar E5).** Head `b48eb357c851ea03c2ad840f2030fd8e0b657109` on master `8ed5085bf`. Migration `20260930177000_pickup_schedule_changed_meanwhile.sql`; Stream 1 moved the number from 174000 to 175000 to 177000, with no content change (blob `be618e1e…`). Bundle `20260930-stream4-pickup-e5-r1`, 85 files, MANIFEST `4bd225555739bf69bac9f51a253dd59766dadfd65914f2ff0d77c0bf1289a66b`. Leases: 13:05:06Z (before-run) and 13:27:46Z–13:30:01Z (after-run).
  - **Before (master, 13:05:42Z):** device A's stale save sent `recycling_frequency: not_set` and got 200 with no message. Device B's weekly recycling was deleted.
  - **Fix:**
    - Calendars carry `pickup_version` (md5 of the household pickup rule ids, or `none`).
    - PUT and DELETE pickup-day accept `expected_version`, checked in the new service-only `mutate_home_pickup_calendar_if_unchanged` under the existing locks. A changed schedule gives 409 `PICKUP_SCHEDULE_CHANGED` with the current calendar.
    - The web card shows the current schedule in its form, with the message in its existing error line.
    - Older clients that send no version keep the unchanged three-argument last-write-wins save.
  - **After, the same two-device web steps:**
    - A's save got 409 and B's recycling was kept.
    - A picked Wednesday again and the save got 200; both changes stand.
    - The old no-version save is still last-write-wins.
    - A stale reset got 409 and changed nothing; malformed versions got 400.
  - **Fresh-database replay** on my own throwaway DB-only stack (64551; stopped, 0 containers and 0 volumes): all 114 migrations, exit 0. Rolled-back behavior checks pass, backend and SQL versions are equal, and a two-session race gives the second save `changed`. Lint shows 0 findings on the new functions.
  - **Shared DB:** ledger 103 → 104 (`20260930177000`, service-only functions). Worktree and backend are back on `00bf2d6ff` (PID 45107). Exact cleanup: 351/353 tables equal, the difference is auth history only.
  - **Still open:** native E5 (iOS/Android send no version; the cells stay ⬜). The pinned function lint (CLI 2.116.0) and the pgTAP contracts are CI-only here.
- **2026-09-30T13:35:23Z (committed) — merged and cross-stream notes.**
  - #984 (Documents delete button name) merged in batch 184 (`a6793fda4`). The decision-9 trio #968/#976 merged in batch 182.
  - **#992 (clients lose table writes):** it doesn't affect Stream 4. There are 0 direct Supabase `.from()` reads or writes of the 28 listed tables in web, the shared packages, iOS or Android.
  - **Agreed with Stream 5:** REVOKE ALL on the view `MailAnalyticsSummary` from PUBLIC, anon and authenticated (service_role keeps it). It runs with owner rights and exposed every user's letter-reading analytics to the anon key. Nothing reads it.

- **2026-09-30T12:59Z — [#984](https://github.com/WangPantopus/skinny-pantopus/pull/984) is with the coordinator: the web Documents delete button now has a screen-reader name, and web Documents delete E1–E3 are verified with no change.** Head `b443db73f422b0636fb703eb435fc58fa50cb9a5`. Bundle `20260930-stream4-docs-delete-r1`, 29 files, MANIFEST `bdef747f4889083425738795a89cd5f4438983e5ea0acb418dda43c9f0ca83bb`. Lease 12:52:23Z–12:58:32Z.
  - **U02 A4:** the icon-only trash button had no accessible name (axe button-name ×3 with three documents; the 09-30 sweep's seed had none). It now reads "Delete <title>", like Tasks and Emergency. Axe after: 0 violations; the fix was patched into the shared worktree and reverted exactly.
  - **U03 web Documents delete:**
    - E1: an honest error, and the retry deletes.
    - E2: after a lost reply the row stays until the retry, and the retry is idempotent (200); two requests, no duplicate.
    - E3: a double tap on the trash cancels the confirm (backdrop), and a double click on Delete sends exactly 1 request.
  - Exact cleanup: 351/353 tables equal (auth history only).
- **2026-09-30T12:59Z — decision-9 trio:**
  - #968 was renumbered to `20260930172000` (content unchanged; head `33a43a5693efe04cac78f2a11200b9ca3de8738e`, seal r3 `35917c31efe045ba6e18e2723909e8f12303a6e2f22da33bdbd6b976a8ae573e`).
  - Stream 5's final-heads rerun passed and verified the renumbered head is identical. The trio (#968 + #974 at 28f92e4e0 + #976) waits only on the coordinator's batch.

- **2026-09-30T12:27Z — [#968](https://github.com/WangPantopus/skinny-pantopus/pull/968) revised after Stream 5's combined E2E review; the new head and seal are with the coordinator for the decision-9 trio** (#968 + Stream 3's #974 + Stream 5's #976). Head `ab0a5b09745682febc14ee27de5efb3fcd4ee18e` on master `81cf2e959`. Bundle `20260930-stream4-household-data-r2`, 20 files, MANIFEST `e1498d364dc70894f02d1879e7ca75312b57a86b2e4a3d483da4899aabf5d948`; it supersedes r1 `b759067e…`.
  - **Stream 5's real-route E2E on `b410aae70` passed** (their bundle `20260930-stream5-retire-homes-r1`):
    - task-photo member: 409 → 200 `kept`, and the household keeps and downloads the photo;
    - last member: `purged`, the chat closed and detached, and a later member sees nothing;
    - a revoked purge grant gives 503 with nothing changed.
  - **Fixed from their review:**
    - the purge also refuses for a legacy `Home.owner_id` owner who still has access (otherwise data loss); Stream 3 aligns `othersKeepHome` as 'kept';
    - replies stop sending a deleted uploader's id.
    Rolled-back run at 12:25:58Z in Stream 3's window.
  - **Follow-up after the trio** (Stream 3): when a shell is purged, end the other non-verified occupancies and close pending claims, with notices. Proposed to live in Stream 3's `retireHomeForDeletedAccount`, since those are their lifecycle transitions.

- **2026-09-30T12:07Z — #968 is queued for the decision-9 joint batch** (with Stream 3's retireHomeForDeletedAccount PR and Stream 5's route PR, after Stream 5's combined E2E is sealed).
  - **Known limit (coordinator: not a blocker).** The purge and account deletion tombstone the legacy Home media Files that came through the old generic files route: the Home gallery (`HomeMedia`) and the Home row's Wi-Fi QR and house-rules files. No recovery job covers them, so their bytes stay in S3. Nobody can reach them through the app, since their rows are soft-deleted and the Home no longer links them.
  - The private document and task-media buckets are collected by the existing recovery jobs (every 5 minutes).
  - **Possible follow-up:** an S3 cleanup job for tombstoned legacy home files.

- **2026-09-30T12:07Z — [#968](https://github.com/WangPantopus/skinny-pantopus/pull/968) sealed and with the coordinator for the joint batch.** Head `b410aae70a49870fef3770a4fd3c06cc6d78d143`. Bundle `20260930-stream4-household-data-r1`, 17 files, MANIFEST `b759067e2b4b6dcbf7de685a5cdb98ca9397070a4e7998f255c954c892ded99c`.
  - **Adopted Stream 5 decision 10:** the purge closes and detaches the household chat instead of deleting it.
  - **Personal data trigger widened** (now `delete_personal_home_data`): the departing person's attention-only letters at a Home go too, since otherwise nobody could ever read them.
  - **Rolled-back proof re-run on this head** (12:05:51Z, in Stream 3's window) passed. The real-route proof is Stream 5's combined E2E on their stack with exactly this head.

- **2026-09-30T12:03Z — account deletion, part 2: [#968](https://github.com/WangPantopus/skinny-pantopus/pull/968) open.** Head `ae0d7ca46ab78fdcdb6d6dfb915e6d1c0c773dbd`, migration `20260930162000` (reserved). #952 merged in batch 174 (master `536ec33a1`); #954 merged in batch 173.
  - **New blocker, reproduced** (rolled back, 11:53:51Z, in Stream 3's window): a member who ever attached a file to a Home task can't delete their account.
    - The dry run gives 23514, from protect_home_task_media_file ("File tombstones must be retained"), cascaded from File.user_id.
    - HomeTaskMedia.uploaded_by also cascaded: attachments vanished from household tasks, and their blobs were never collected.
    - **Fix:** the files are released to the household at User delete, as documents are since #952. The guards accept an owner cleared on update, while inserts stay strict. uploaded_by is SET NULL.
  - **Coordinator's privacy follow-up** (private records orphaned by deletion) **and decision 9** (the last member's Home goes, or is purged if delete-my-Home refuses).
    - **Split agreed:**
      - Stream 3: `homeAuthorityService.retireHomeForDeletedAccount` (5d4a6cce6);
      - Stream 5: the route call site, after the dry run and before the null-out;
      - Stream 4: `purgeHouseholdRecords`, plus a personal-pin trigger.
    - **Not a User trigger:** the route nulls authors before the User delete, and triggers can't remove blobs.
    - Porchlight's "notes can pass to the next owner" is an unbuilt design, so it doesn't block decision 9.
  - **Rolled-back proof** (12:01:27Z):
    - dry run 23514 → ok;
    - purge refuses while someone else keeps the Home;
    - every household type is removed, and other people's letters and pins are kept;
    - a later member finds 0;
    - after the member's deletion, the other household keeps the photo;
    - inserts stay strict.
    Bundle `20260930-stream4-household-data-r1` (staged; sealed with the real-route E2E). Stream 5 runs the combined route E2E for the one batch.
  - **Waiting for a lease window:** web Documents delete E1–E3 plus a name for the icon-only delete button (axe button-name). Branch `claude/stream4-docs-delete-name` `487412267`, harness `tools/web-s4-docs-delete.cjs`.

- **2026-09-30T11:34Z — [#952](https://github.com/WangPantopus/skinny-pantopus/pull/952) (account deletion, Home records) is with the coordinator.** Head `a22ad205485a7a08e90b9748303620a8175833b6` on master `00bf2d6ff`, migration `20260930153000`. Bundle `20260930-stream4-account-delete-home-records-r1`, 51 files, MANIFEST `b2949875b0b3816259228144a1e18096ef507ce334a5355259cc23eaf3d4a600`.
  - **Native** (lease 11:21:15Z–11:32:06Z). pantopus_s34 and "Pantopus S34", owner signed in. Master-code builds show "Uploaded by —" for the former member's document; the branch shows **"Uploaded by Former member"**. On S34 I reset its keychain first (it had kit member B signed in; Stream 3 agreed), so the app never ran as B.
  - **Owner deletes the orphaned document:** 200, storage object removed.
  - **Exact cleanup** (11:31:38Z): 349/353 tables equal the 10:51:19Z baseline (auth history only). No storage objects remain, and the disposable member has no rows. Cleanup ran before Stream 3's, as agreed. Stream 3 removed their own stray member-B MailPreferences row first (11:22:50Z).
  - **Runtime ledger:** `20260930143000` renamed to `20260930153000` (ledger 103, newest 153000); the stack file is renamed with the same bytes.
  - **Observation, no change:** a Home activity row whose actor left shows the action without a name (Android's generic "PA" avatar). This is existing behaviour for anyone no longer in the household.
  - **Tooling:**
    - `s4-secret-scan.py` takes extra private env files; pass the disposable member's credentials only, since ids are evidence.
    - New `ios-s34-document.py` and `android-s34-document.py`. Android labels the dashboard tile "Docs".

- **2026-09-30T11:10Z — [#954](https://github.com/WangPantopus/skinny-pantopus/pull/954) (iOS lint unblock) sent to the coordinator.** Head `7aadd787c297fb64f58e606b0fed76efba20aa88`, a one-character change.
  - "ios / Lint (SwiftLint + SwiftFormat)" failed on master `af4e76f0c` and every PR. The cause is my own #922: a `//` note on `PlaceCivicDetailContent.monthAbbrev` that SwiftFormat 0.61.1's docComments rule rejects. Now `///`.
  - Check: the file went from `1/1` to `0/1`, and the whole iOS tree is `0/2249`. Found by Stream 2 on #953 and confirmed by the coordinator.
  - #952's native builds passed (iOS 11:06:33Z, Android 11:07:56Z, compiled at `a64f32e39`); its native reads wait for Stream 3's lease.

- **2026-09-30T10:59Z — account deletion (launch-critical): [#952](https://github.com/WangPantopus/skinny-pantopus/pull/952) open, head `a64f32e39000b347b0bd74c3d0969710f87b6aa5` (rebased on master `af4e76f0c`), migration `20260930153000`.** Not yet in the queue: native reads, cleanup and seal come first.
  - **Scope:** the 15 attribution columns become nullable with ON DELETE SET NULL (the 12 Home columns plus HomeMapPin, CommunityMailItem and MailAssetLink). Also:
    - task/event guards allow clearing the author, never rewriting it;
    - `get_home_records` capabilities stay booleans, and `mutate_home_record…` keeps the write check closed;
    - an external share keeps a former member's document downloadable;
    - the File CHECK allows a household-owned document file;
    - a User BEFORE DELETE trigger keeps the member's Home document files with the household.
  - **Clients:** "Former member" shows on the iOS/Android document detail, the only screen that names a record's author. Web shows no author, and every DTO already decodes these fields as optional.
  - **Numbering:** reserved `132000` → `143000` (after master's `141000`) → `153000` at the coordinator's request (Stream 2 PR B `152000`, Stream 1 `154000`). The content is unchanged (blob `5d26dffde`).
  - **Proof, bundle `20260930-stream4-account-delete-home-records-r1`:**
    1. **Rolled-back DB proof** (10:46:59Z, inside Stream 3's window, as postgres without SET ROLE). Before, all 15 columns refuse clearing and the route's dry run returns `ok:false`. After, the dry run returns `ok:true`, the member is deleted, and 15 of 15 records are kept. **Counterfactuals:** master's function bodies return null capabilities, let an editor's write through, and drop the shared document's download.
    2. **Real route** (lease 10:50:21Z–10:56:19Z). A disposable household admin (GoTrue admin create, password never printed) made 5 records through the API plus 10 fixture rows.
       - `DELETE /api/users/account` on master's schema: **409 ACCOUNT_RECORDS_RETAINED**.
       - Migration applied to the runtime at 10:53:18Z (ledger 100, recorded as `143000`).
       - Then **200**: the token gets 401, and the User, auth user and occupancy are gone. The records stay with no author.
       - The owner lists 5 record types and downloads the document (SHA-256 matches).
    3. **Web** (read-only): dashboard, docs, tasks and emergency render the records with no errors.
  - **Runtime left in place for the native reads** (Stream 3 knows; I clean up before them):
    - Home `a3550399-d91e-4935-bf27-8f3bbc633b52` and its records;
    - migration `20260930143000` in the runtime ledger; I'll rename it to `153000` at cleanup.
  - **Decisions:** household records and documents stay with the household; only managers edit or delete authorless tasks and events. Stream 5 shipped the delete-screen disclosure in #950 at my suggestion.

- **2026-09-30T10:14Z — [#939](https://github.com/WangPantopus/skinny-pantopus/pull/939) merged** (batch 168, [#940](https://github.com/WangPantopus/skinny-pantopus/pull/940), master `185676c04`). Bundle `20260930-stream4-emergency-server-writes-r1`, MANIFEST `6bb6841c504fcf5a4e6b41d775a67355a0e257c6a32a27542eda975ee673079d`.
  - iOS edit PUT 200, keeping the other client's detail keys; iOS delete DELETE 200.
  - A lost-reply create retry makes 1 row instead of 2 on both iOS and Android; iOS Last updated shows the stored time.
  - Emulator note: a windowed boot of pantopus_s34 hung on a host crash-consent dialog left by another AVD's crash report. `-no-window` avoided it.
  - **Next (launch-critical, assigned):** account deletion is blocked by NOT NULL creator columns. The triggers `protect_home_task_identity`, `protect_home_event_identity` and `protect_home_document_record` would also refuse the SET NULL; the documents' File rows cascade on user delete. Design in progress.

- **2026-09-30T09:40Z — #922 merged** in batch 163 ([#926](https://github.com/WangPantopus/skinny-pantopus/pull/926), tip `9f7eefadf`), master `c1634c693`. The coordinator verified the seal (`750ef739…`) and agreed with the noon-UTC calendar-day reading. The emergency repair builds are running under the heavy slot (since 09:38:34Z).

- **2026-09-30T09:30Z — native work: #922 (iOS election date) is with the coordinator; iOS Emergency Info edit and delete were never saved (reproduced); the repair is building.**
  - **#918 merged** in batch 162 (master `fd7de8790`). Coordinator review note, not blocking: the panel's unmount cleanup also runs when `onDraftUnmount` changes identity. That cleanup runs with the old closure, so the kept draft carries the old user id and the restore drops it. Revisit if the file is touched again.
  - **#922.** Head `4da4de22da9cac8e9ec1883829ed6defabca2e62`. Bundle `20260930-stream4-ios-civic-date-r1`, MANIFEST `750ef739dce313bcef95e290472f85da537dd68da04b1c0e16f502a4367fa604`.
    - Setup: real app on "Pantopus S34", owner signed in through the form, the election reply EMULATED via proxy rule s4-civic.
    - Master's date tile was empty; the branch shows "NOV 3".
  - **iOS Emergency Info, reproduced in the same bundle.** Edit showed "Saved." and delete promised "Anyone with access will no longer see it", but neither sent a request. The DB was unchanged, the list reverted on its next read, and "Last updated" showed the current time.
    - The backend's PUT/DELETE (home.js:3896/:3943) exist, and Android and web use them.
    - Repair: branch `claude/stream4-emergency-server-writes` `8f5d49117`. Adds the iOS PUT (keeping the stored type, location and other clients' detail keys) and DELETE (already gone counts as deleted), the microsecond date parse, and `clientRequestId` on create for iOS and Android. The two iOS unit tests that pinned local-only behaviour were updated.
    - The builds are queued behind Stream 3 on the heavy slot. Runtime proof follows on S34 and pantopus_s34.
  - **Lease:** 09:12:42Z–09:24:32Z. I restarted the backend at 09:13:32Z (PID 24029, logged) because the login limiter was at 429 again.

- **2026-09-30T09:07Z — [#918](https://github.com/WangPantopus/skinny-pantopus/pull/918) (decision 5) is with the coordinator.** Head `3ce02567e057b691014a47a27d13d5806a4ef425`. Bundle `20260930-stream4-issue-draft-restore-r1`, MANIFEST `56ca55c746cb90d7e1b1b2afb833fda6e63375e2203bd43df2dfd4ce75a5277a`. Lease 09:02:45Z–09:06:31Z.
  - Master lost the typed Report Issue text on hide/return. The branch restores it for the same member and Home.
  - A closed panel stays closed. A session switched to member B while hidden never shows the owner's text, including when B can report issues.
  - **Native, in progress:** the iOS builds (master vs the civic-date fix) are running under the heavy slot. Stream 3 hands the lease back for the "Pantopus S34" run once the builds finish. There I'll reproduce that iOS Emergency Info edit says "Saved." but never calls PUT (the backend has had the route since PR192; Android uses it).

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
