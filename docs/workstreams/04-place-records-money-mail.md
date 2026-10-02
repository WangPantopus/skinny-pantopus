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
>   - resume prompt [`NEXT-STREAM4-PROMPT-2026-10-02.md`](NEXT-STREAM4-PROMPT-2026-10-02.md) (older prompts are history).

## ACTIVE SUCCESSOR — 2026-10-02T12:12:44Z

Session **“Stream 4: Place, records, money and mail”** (`01a0fbe6-c508-7ff3-88ad-16cf0165b451`) has resumed personally, with no implementation agents. Fresh GitHub confirms Settings #1474 merged unchanged at `aedb424b4ce08a8162052685126ff229fbdd8fcc`; fetched master is `4e55a2c02d681cd2edb99c276650f15d6c5b9981`. All 29/53/83 listed files in the three accepted Settings audits rehash and remain read-only; four complete application files and both literal Settings schema/route sections equal current master. [Source-reuse receipt](/private/tmp/pantopus-stream4-prep/successor-settings-source-reuse-r1.json) is a local, unsealed integrity/preparation receipt, not a new app journey. Existing real acceptance and the final **349-of-353 / four preserved Auth tables** qualification remain authoritative.

Source CI [36984703665](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36984703665) is now **completed SUCCESS** at exact `aedb424b4ce08a8162052685126ff229fbdd8fcc`, updated11:34:40Z: all applicable backend/web/schema/safeguard/iOS lint/build, all three iOS target tests and CI OK passed; Android/Seeder path-skipped (not passes). [Personal fresh CI receipt](/private/tmp/pantopus-stream4-prep/settings-successor-final-ci-read-r1.json). Earlier queued snapshots below are superseded. Read batch [36985518026](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36985518026)'s sole failed aggregate job: web/iOS cancellation makes its aggregate gate fail; no aggregate-pass claim or new source failure. CI is informational under the standing user direction.

**Current milestone merged unchanged:** [#1476](https://github.com/WangPantopus/skinny-pantopus/pull/1476), exact pushed `ed289da84909bba972672764e0ac4ca197cd661e`, merged in batch345/#1477 at11:08:49Z (source PR mergedAt), fresh fetched master `c244ded73d0372e7818b82d3b5e5d998f679d637`. Both whole repaired page blobs equal master ([local source-reuse receipt](/private/tmp/pantopus-stream4-prep/web-feedback-merged-source-reuse-r1.json)); accepted journeys preserved. Changes only existing Vault/Records error callbacks. Real desktop/phone4cases each503→visible error/retained draft/DB0→one manual retry200/201→single persisted row/API+SQL fields→navigation/reload pass. Existing layouts/success behavior preserved, no new unit declarations/files/schema/backend. Whole current-source web TSC0/changed-page lint0errors0warnings/diff0. Before26-file seal `31798381e8baf030d413076f7957e879440fe6575bc58f59e3d38117558d70ce`; after38-file [immutable audit](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20261002-stream4-web-mutation-feedback-after-r1/README.md), seal/MANIFEST `9facac43411da514795efbfc8f45c4e2bea1a929a3aea449cf3ee98af306861d`. All11PNGs personally reviewed; initial broad header masking hides3toast frames, qualified by3failure-only transient recaptures; before observer free-text3faults is qualified by authoritative2execution records/noThemesPOST. Both mirrors scanned/rehashed/read-only.

**Actual clean return10:48:15Z:** exact46 owned rows removed, all353 public-table fingerprints unchanged after pre-baseline owner login; existing preferences/auth history preserved. Original helpers restored/unchanged, d317clean4e55/backend92811healthy/fault0/22093absent, no S4 device/heavy. S1/S3 notified; S3 resumes remaining10 landlord cells. Exact-head source CI [36997724807](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36997724807) completed **SUCCESS** at10:56:19Z: all applicable web E2E/lint/typecheck/Jest/build, schema replay/contracts, safeguards and CI OK passed; backend/native jobs path-skipped. No failed source jobs. Batch [36999314374](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36999314374) is completed **cancelled** (updated11:10:18Z); S4 personally read sole failed aggregate CI OK110813758718: cancelled web E2E/web/database dependencies make the aggregate fail, with no application failure or aggregate-pass claim. [Local read receipt](/private/tmp/pantopus-stream4-prep/web-feedback-batch345-ci-read-receipt.json). CI remains informational. Sole merge owner is Stream1.

**New verified milestone, merged unchanged:** [Themes #1478](https://github.com/WangPantopus/skinny-pantopus/pull/1478), exact pushed `e6c38a1d4c1f4b8b473d391f43d60cf3e7ad25ec`, `claude/stream4-theme-mutation-feedback` on freshc244. Four inserted lines/one existing page: toast import/onError, unchanged modal/success/layout/server contract. Real existing catalog-backed before503/no error/retained enabled modal/Settings0; actual desktop/phone503→redtoast/retainedmodal/unchangedSQL+DOMtokens→one manual same-payload200→same single Settings ownerPK/realGET+preview→reload active preview. Immediate successful data-theme checked; success accent not separately read, **no cold global CSS/native/provider/production unlock claim**. All5PNGs personally reviewed. Immutable scanned/all-file-rehashed/read-only19before `7e7a67a1aa606d3afc3a05e34e74834cd9187e4266b3a073d10025146146e17a`,7[closure](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20261002-stream4-theme-mutation-feedback-before-closure-r2/README.md) `931f80144238adb9b2ef7d1d48bf0811adaa5886c0e08e3f64c6e953706e0773`,29[after](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20261002-stream4-theme-mutation-feedback-after-r1/README.md) `7d201172613811017cdacea196d67ba3b7df1e0266a09efb2b2ed9a251b0c51f`. Original before was prematurely sealed after obsolete proxy filename stopped readiness/README; separate closure qualifies that omission and supplies actual before-label release without editing sealed bytes/repeating acceptance. Initial wrong-tab-selector attempt made noApply; corrected actual before authoritative. Eight whole actualservingfiles/PIDcwd/two table declarations bound, whole current-sourceTSC0/lint0errors0warnings/diff0 (initial tooling resolution errors qualified). Exact3before/9after cleanup **353/353 unchanged after cleanup AND master restore**, existing prefs/Auth history preserved. **Actual full browser loan return11:55:46Z**, clean fresh masterc244/backend5177healthy/DBconnected/original startupc2f92/proxy9063/cleanup2fb/fault0/22093absent/noS4resources. S1/S3 actual return notified; PR attached, S1 independently reviewed all bytes/cases/5PNGs. **#1478 merged unchanged batch346/#1480 at12:08:20Z**, fresh master `c0a1d29e0eb6701a5dec2bdad1ed5d59672e0691`; all eight accepted serving files/two literal table declarations equal current master ([reuse receipt](/private/tmp/pantopus-stream4-prep/theme-feedback-merged-source-reuse-r1.json)). Source CI [37003947398](https://github.com/WangPantopus/skinny-pantopus/actions/runs/37003947398) **completed SUCCESS**, updated12:03:17Z, all applicable checks/CI OK pass, native/backend/Seeder path-skips not passes. Batch [37004863186](https://github.com/WangPantopus/skinny-pantopus/actions/runs/37004863186) completed cancelled; sole failed CI OK110831107161 personally read: cancelled safeguards/web E2E/web dependencies make aggregate exit1, no application failure/aggregate pass. [Read receipt](/private/tmp/pantopus-stream4-prep/theme-feedback-batch346-ci-read-receipt.json) qualifies corrected unsealed change-flag parser naming. CI remains informational; no accepted packet rerun/edited.

**Next/current preparation:** original Themes/e6 source preserved; after verified merge, a69f is clean on new `claude/stream4-mail-task-launch-entry` at fresh masterc0a, no application edit/push. S3 has the actual browser-loan return and its necessary combined E2/current-U02 cached iOS build precedes its remaining landlord acceptance under S1 coordination; no S4 resource owner/waiter/fixture. Native MailTask entry/status before follow the agreed complete actual landlord return. Private current shared-driver sign-in/focus recipe is ready; MailTask14iOS/14Android/4sections remain preparation only. [MailDay/Reviewed preparation](/private/tmp/pantopus-stream4-prep/mailday-feedback-reviewed-undo-source-preparation-r1.json) additionally rebinds all26native files/existing route/service/three canonical table declarations; real Accept/Finish/Reviewed AX before unexecuted, existing toast/actionError reused only after demonstrated failure. Broader native75/78equal, threeAndroidMaintenance files predate accepted notes repair; only separately compared extra-field draft/caller sections reusable. [Rate-watch preparation](/private/tmp/pantopus-stream4-prep/android-rate-watch-source-preparation-r1.json) binds eight whole Android caller/DTO/repository/routing files d6c↔c244/existing backend/table contracts, real DELETE failure/success/cold unexecuted. Generic notice/ack observer/exact cleanup private/unexecuted, r2 nonexistent field correction qualified. Root Android Debug different ports/unsuitable S34, no redundant build dispatched. No provider/physical/whole-U05 closure.

## CURRENT RESUME — Stream 4 (clean successor handoff 2026-10-02T09:04:23Z)

The user requested a seamless handoff at the best clean boundary. The current Settings repair is finished, sealed and **merged**; substantial retained U05 work remains. Start with the comprehensive [successor prompt](NEXT-STREAM4-PROMPT-2026-10-02.md), mirrored in the current kit. It supersedes old device/worktree/operator state below; preserve accepted history and designs.

- **Settings [#1474](https://github.com/WangPantopus/skinny-pantopus/pull/1474) merged unchanged**, exact pushed `aedb424b4ce08a8162052685126ff229fbdd8fcc`, GitHub08:43:19Z, batch344/#1475. Fresh fetched master `4e55a2c02d681cd2edb99c276650f15d6c5b9981`. Five existing app files, no new unit declarations/files. Real local timing/job/web/native cache/error/Retry/cold acceptance complete. Stream1 independently verified seals/source integration. Applicable completed backend/web/schema/safeguard CI passed; source iOS remains queued, cancelled batch is not an aggregate pass. No open Stream4 application PR; web-only task-entry guard66ae remains pushed **without PR/real after**.
- **Evidence:** final83-file `20261002-stream4-mailday-settings-cache-afters-r2`, seal/MANIFEST `afe71a3dd77620edc8cdb92299997721df5312fb1437ac2d42f4e3fffd2a55c2`; prior29before `6e4e2bd53c8d3992847587796036c770a4b65c3bd7187602dfedefeb715f4b1f` and53job/hiding after `9c9317b4d54c1c007f74b65099342d8288f1b926f09b2194335015937918dc45` unchanged. Both mirrors rehashed/read-only/all16 final PNGs reviewed. Native6452 four installed product hashes and whole View/VM equality; backend/web1c4 four whole files plus exact Settings route sections. No Android Settings UI/caller exists; no provider/physical/whole-U05 claim.
- **Actual clean runtime release08:27:43Z:** Settings1+owned events13 exactly cleaned;349 of353 public-table fingerprints unchanged, only four Auth tables changed: AuthDevice2→2 fingerprint/AuthDpopJti17→18/AuthSession21→27/AuthSecurityEvent21→27 preserved. Original startup restored, temporary fault control/preload absent, proxy rules0, d317 clean on then-current mastera7118/backend70332 healthy. Own64698 driver stopped/22093absent/S34 shutdown/slot1released; Androidd6c untouched; no S4 runtime/device/heavy owner/waiter. Later merged4e55 is not the serving snapshot; advance only under the next lease. S3 independently acknowledged the handback and also wrapped.
- **Next:** bind current source and coordinate with Stream3 successor, then retained MailTask Convert launch entry and Markdone/Reopen fault/success/cold, MailDay Accept/Finish feedback, Reviewed Undo AX, truthful received-mail/map/copy and web mutation feedback, remaining media/attachment reachability and U02/U05 dispositions. All exact paths, guards, operators and named external/deferred requirements are in the new prompt.
- **Completion:** rough75–80% weighted retained readiness/20–25% remaining, about15–20 local topic/check groups plus provider/release boundaries. This is planning judgment, not certification; formal core inventory remains4 closed/other rows partial/cut/deferred. No claim that all autonomous work is exhausted.

## PREVIOUS RESUME — Stream 4 (2026-10-01T17:54:23Z; historical state, recipes qualified by current prompt)

The resume prompt is [`NEXT-STREAM4-PROMPT-2026-10-01.md`](NEXT-STREAM4-PROMPT-2026-10-01.md). The 2026-09-30 resume below
this one is kept for its still-valid recipes and lessons; its state is superseded.

> **Queue checkpoint — 2026-10-02T07:21:32Z.** Memory#1467 and Year#1468 are **merged in batch342/#1471**, fresh fetched master `fa1072a5b8036f694534f3e1944b38d585ee6b33`; exact merged heads8e24/faa and their bounded real evidence/seals remain above. S1 independently verified whole actual98dd Page/API DTO/MemoryCard and exact Memory route sections. **Qualification:** original immutable after-source-binding.json Main Page subsection digestf2a87… does not reproduce by the literal marker-inclusive convention; treat that subsection digest as unverified. The independently reproducible whole actual Page/union identity provides the binding; no sealed bytes edited or new journey claimed. **Settings remains pending native final acceptance/PR**, pushed topic `90e6063914f1defec7d7854bc2400ded211f6213`. Standing no-new-unit-tests rule now also removes five added backend cases and two added VM methods from the outgoing Settings diff; five application files unchanged, prior31/2 executed diagnostics retained only as historical results. Private current-master Settings single-commit integration `1da06927ec5c8f8ad797ec83714535932b2370ae` is clean/prepared, not serving. Native6452 product built; guarded exact GET/settings fault/cache-only cleanup/installer prepared privately. S3 still owns the runtime/devices; no S4 mutations or acquisition. Next: actual empty Settings→19:45→web09→native reentry/error/Retry/cold, exact cleanup/seal/PR, then remaining retained U05 tasks, feedback, access and truthful data cases. Rough75–80% completion is judgment, not formal launch certification.

> **Successor update — 2026-10-02T06:53:29Z.** Session “Stream 4: Place, records, money and mail” remains active. Previous merged repairs including Maintenance guard/notes#1448/#1449, source stripe#1451 and due-date#1459 remain accepted. Fresh retained Memory two-topic afters are verified, sealed and sent to S1: **[#1467](https://github.com/WangPantopus/skinny-pantopus/pull/1467)** `8e24f70b49595a54c1a58b88f50aaac2d4de30d8`,39-file audit `20261002-stream4-memory-contract-afters-r1`, seal/MANIFEST `00531576971d0db2733d5ab160ac0f51dbe082ac602948dde9acee2c85917c9e`; **[#1468](https://github.com/WangPantopus/skinny-pantopus/pull/1468)** `faa98d2811c7783b4a9348c78b48a6a0a049c1b3`,23-file audit `20261002-stream4-memory-year-afters-r1`, `0b874e11bac4b364202c55e80433fb76ac1cf471c666253ba514c421c033a354`. Actual Mailbox→Memory GET503/Retry, rejected dismiss stays visible/DB0, retry200/single persisted row/cold phone, member and stale404/concurrent samePK; LA date corrected. Year5 actual browser contexts distinguish failure/cancellation/shared-handler/actual clipboard; unsupported aggregate Vault action absent. Memory exact33-row cleanup351 non-auth tables equal, two actual sign-in AuthSession/AuthSecurityEvent17→19 deliberately preserved; **no353 equality claim**. Year30-event cleanup353/353. All PNGs viewed, manifests copied/rehashed/read-only. **Settings is still pending real cache after/PR:** original53-file timing/hiding after9c9317b4… retained; fresh04098 build passed, corrected flat GET fixture on7b23 executed2/2 existing VM tests PASS. Actual empty My Mail Day Settings was disabled by isDirty=false; smallest existing shell enable now topic `d03908fae30d91d3c3909bbb9542d83e8397ec1c`, frozen6452 native build-for-testing PASSED06:49:35Z/automatic heavy release. Build is not native after acceptance. **Actual S4 runtime release06:46:34Z** on fetched master `4eb33c56f9d62cd3f2666bb638b3b4f0303981f2`/backendPID51313, healthy/connected, current proxy39132/SHA50cb3833 unchanged/faults0/all fixtures0; iOS7b23 shut down/owned47805driver stopped/22093absent/slot2free, Androidd6c untouched. Receipt `runtime/stream4-memory-year-window-handback-r1/`; S3 actual reacquisition06:48:06Z and r8install follows Settings build. Next: answer both Memory PR reviews; actual final Settings reread/retry→exact cleanup/seal/PR; all remaining retained U05 local cases and manifest dispositions, then peer help. No whole-U05/provider/media/hosted/physical closure. Weighted ~75% (70–80%) remains an estimate, not a formal acceptance count. **Review correction:** S1 identified founder no-new-unit-tests instruction in humanattachmentc63…line59, read directly. New test file removed in focused followup; four appblobs equal testedfe676. Five-file successor `20261002-stream4-memory-review-source-r2`, `09489e2b5469e8a918f13d1e84868a853e6cff2aff113a8158e9c37e75c8b379`; original39seal/15executed diagnostics immutable/historical, no outgoing newtests. Two selected existing retained mail-route regressions PASS, cuts excluded. PRbody/head receipt updated and sentS1.

### State at handoff

- **Master:** `5051c2b79` or newer. Merged today from this stream:

  | PR | What | Batch |
  |---|---|---|
  | #1282, #1300, #1301, #1317 | morning PRs | earlier batches |
  | #1354 | Android TalkBack in shared components | 300 |
  | #1372 | Mail Day routes to the addressee | 304 |
  | #1373 | Mail Day Undo, Undo all, Other… | 305 |
  | #1374 | Stamps wallet hidden with `mail_extras` | 305 |
  | #1375 | iOS Mail Day error state | 313 |
  | #1400 | Mail Day personal fallback | 313 |
  | #1401 | Stamps themes apply | 313 |
  | #1402 | Mail Day off switch stops the push | 313 |
  | #1403 | same-day letters join Mail Day | 313 |

- **Open with the queue owner** (Stream 1, "Stream 1 resume: Support Trains and merge queue"):

  | PR | Branch | What | Evidence |
  |---|---|---|---|
  | [#1406](https://github.com/WangPantopus/skinny-pantopus/pull/1406) | `claude/stream4-mailday-dead-controls`, head `68eba7522` (master merged for a preview conflict with #1375) | My Mail Day hides its dead scan, history and setup controls | `20261001-stream4-mailday-controls-r3` (`c685c3a8…`) |
  | [#1410](https://github.com/WangPantopus/skinny-pantopus/pull/1410) | `claude/stream4-mail-flag-gaps`, head `360f2fb02` | Earn, package tracking and the Stamps gift icons hidden with their launch features off (iOS, Android, web) | `20261001-stream4-flaggaps-themes-r2` (`35b44f01…`) and `20261001-stream4-flaggaps-placeholder-r4` (`ce96a419…`) |

- **Pushed, not yet a PR:** `claude/stream4-mail-task-stubs`, head `d378fee78`. Live tasks hide the dock's Snooze, Delegate
  and Calendar and the header's Share and More.
  - **Before evidence:** done, all in r3 (`c685c3a8…`). Calendar showed "Added to calendar" for nothing; Snooze only
    toasted; Delegate's button only closed its sheet; Share and More did nothing.
  - **After evidence:** r3 has the dock-only after from build `4c38e8fef`. The header change (`d378fee78`) needs its own
    build and after frames on iOS and Android.
  - **Remaining steps:** build, frames, seal, PR, then Stream 1.
- **Runtime:**
  - The lease and device slots are free.
  - The backend is on master `726510e65` (or whatever Stream 3's successor leaves).
  - No Stream 4 fixture exists; every window was cleaned exactly (349/353 tables equal, the rest Auth* history).
  - Fault rules are empty.
- **Devices:**
  - The iOS sim "Pantopus S34" is shut down with the owner signed in.
  - The emulator `pantopus_s34` is stopped with the master APK `215f6d747` installed and TalkBack off.
  - Always verify the installed APK hash after booting.
- **Builds kept** in `/private/tmp/pantopus-stream4-builds` (each has a `HEAD` file):

  | Build | Source |
  |---|---|
  | `ios-c1-merged` | master `215f6d747` + #1375 |
  | `ios-flaggaps` | G `f431deec2` |
  | `ios-dcmt` | `4c38e8fef` (dead controls + mail-task dock) |
  | `android-flaggaps-before` | master `215f6d747` |
  | `android-flaggaps` | `f431deec2` |
  | `android-flaggaps-all` | control |
  | `android-dcmt` | `4c38e8fef` |
  | `android-flaggaps2` | `360f2fb02` |

  Delete the ones you no longer need; iOS apps are about 920 MB each.
- **Worktrees:**
  - `…/stream-4-workstream-4a5d06`: `claude/stream4-mail-flag-gaps`;
  - `…/stream-4-workstream-a16d86`: `claude/stream4-mailday-dead-controls`;
  - `…/stream-4-workstream-c3e7`: `claude/stream4-mail-task-stubs`.

### Next, in order

1. **Follow #1406 and #1410** through Stream 1's queue, and answer reviews. They merge together once CI's iOS build and Android assemble pass for both (see the newest live entry). #1410's red emulator job is infrastructure: re-run it.
2. **Finish the mail-task stubs.**
   - Build it: `zsh tools/build-s4-native.sh <c3e7> claude/stream4-mail-task-stubs mailtask both ktlintCheck detekt :app:testDebugUnitTest --tests '*MailTask*' :app:verifyPaparazziDebug --tests '*MailTask*'`.
   - Capture after frames on both apps: open a task fixture via `pantopus://mailbox/tasks/<id>` and show only Mark done in
     the dock and no Share or More in the header.
   - Seal, open the PR (problem and before evidence from r3), and hand it to Stream 1.
3. **U05.** Verify the agent-gathered draft
   [`stream4-u05-inventory-draft-2026-10-01.md`](stream4-u05-inventory-draft-2026-10-01.md) item by item on master. Fix the
   real defects (smallest repair, with evidence), record each disposition, and fill this stream's U05 row for Stream 1's
   release manifest.
   - **First check:** whether the iOS maintenance form is reachable from the profile cover's Maintenance tile, as the draft
     says. If it is, the parked `claude/stream4-ios-maintenance-reminder-flag` (`7f492bb31`) and Android's calendar POST
     matter again.
4. **Mail Day settings honesty.** Nothing reads delivery time, timezone, include, interrupt, sound or haptics on any client.
   - Decide and record.
   - The recommendation: honor delivery time as "not before" in the push's timezone, and hide the inert rows on iOS, Android
     and web.
5. **iOS VoiceOver:** a reviewed Mail Day row is one button whose label omits Undo. Add an Undo hint or action, and verify it
   with VoiceOver or the Accessibility Inspector.
6. **Android:** the mail task's "Pulled from this mail" card renders solid orange, while iOS shows a white card with an orange
   stripe. Check the tokens first; this is a presentation change.

### Lessons (2026-10-01; more in the prompt's §7)

- **Bursts:**
  - iOS toasts (2.2 s) outlast neither the step driver's round trip (about 2.6 s) nor Android driver taps (up to 30 s while
    it searches and scrolls).
  - Use a `simctl io screenshot` burst on iOS, or a `screencap` burst plus `adb shell input tap` with bounds from the saved
    tree on Android.
- **Emulator state:**
  - An emulator boot may bring back an older APK, so verify the installed APK's sha256 before capturing.
  - Check the first frame's text tree for a sign-in screen before viewing it.
- **Next dev** redirects to host `localhost` and lands on sign-in. Record redirects without following them.
- **Earn creates a wallet.** Opening Earn (`GET /api/wallet`) creates a Wallet row; fault the read first.
- **Integration commits:** cherry-pick single commits; never merge branches cut from a newer master into an older
  integration commit.
- **Coordination pushes** can race other streams: fetch, rebase your one commit, push.

## PREVIOUS RESUME — Stream 4 (handoff 2026-09-30T22:19:24Z; state superseded, recipes and lessons still valid)

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
8. **Mail under the launch flags (2026-10-01, asked by Stream 1 after #1332):**
   - **My Mail Day and the Stamps earned gallery stay visible.**
     - Native Mail Day triages unresolved `MailRoutingQueue` rows with no type filter, so it covers bills, packages,
       postcards, magazines, flyers and envelopes. Its actions (route, finish) aren't specific to letters.
     - `stampAwarder` counts any received mail, packages and vault filing.
     - Both are back in launch scope for verification.
   - **The native postage wallet inside Stamps goes under `mail_extras`.** That is the book, sheet and rail, the usage
     ledger, "Buy more stamps", Auto-refill/Gift/Archive and "~2 sends a week". It is all sample data with no backend
     (StampsViewModel.swift:5-27) and only serves sending letters. The code stays, per the cut policy.
   - **Why:** the user's #8 names writing letters, e-signing, community mail and invitations; received mail isn't cut.
     "Postcards, welcome cards and the digest" are the printed outreach pieces (M01, after launch), not in-app mail
     types.
   - **Next on these screens:** reproduce, then repair.
     - iOS Mail Day shows sample mail when the day can't load (shelved `claude/stream4-mailday-no-sample-fallback`).
     - "Other…" and "Undo all" do nothing on either app.
     - The gallery lists 7 stamps no code awards.
9. **The iOS maintenance form stops posting its calendar reminder while `household_extras` is off (2026-10-01):**
   - **What the reminder does with the flag off:**
     - nothing shows it: the dashboard, AI context and activity skip calendar events, and no job reads them;
     - it still marks the whole household busy for 24 h in home scheduling availability;
     - a re-tap duplicates it (Stream 5's idempotency audit).
   - **What stays:** the next-due date still saves on the keyed maintenance row, as on Android, which never posted a
     reminder.
   - **Left for later:** keying `POST /homes/:id/events` goes to whoever brings the calendar back.
10. **`POST /homes/:id/documents` has no client caller:** no change. Web, iOS and Android only GET the list and upload
    through the keyed `/documents/upload`. A future caller must send a client key.
11. **Shared Android TalkBack repair (Stream 1's routing, 2026-10-01):**
    - **Scope:** the ListOfRows tab, extended FAB and labelled action, the WizardShell CTA, and the app-wide
      `PantopusButton`, whose EmptyState CTAs said "Use my location. Use my location. Button".
    - **Semantics kept:** each control keeps its text and test tag.
    - **Large text:** the wizard title takes its own row from font scale 1.3, ListOfRows' top-bar threshold. Stream 4's
      own content reflows keep 1.5 (item 3).

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
| F02 | **Partial/open.** 2026-09-30 (Stream 4), access retirement on web: `/app/place`, `/app/place/<section>` and `/app/place/pulse` with `?home=` for a Home the account can't read said "Check your connection and try again", with a Try Again that repeated the 403. They now say "This place isn't available · You don't have permission to view this place." with no retry, and other failures keep Try Again ([#896](https://github.com/WangPantopus/skinny-pantopus/pull/896), merged in batch 155, master `66d57bcfe`; bundles `20260930-stream4-place-access-denied-r1` `650fde8e…` and `…-pulse-r1` `8dd2415e…`). 2026-09-27 bounded cohort-member candidate passes on web/Android/iOS (bundle `20260927-stream2-f02-member-finance-r1`, seal `48d40790…`): neighborhood-only figures, personal trends denied, error/retry and retired-member403; exact occupancy cleaned and retained fingerprints equal. Existing privacy/error distinctions are reused where recorded. 2026-09-27: the Place "Try again" on a section that failed to load did nothing on web (it opened the cached detail page), iOS or Android. Fixed and merged: web [#602](https://github.com/WangPantopus/skinny-pantopus/pull/602) (batch 40) and native [#619](https://github.com/WangPantopus/skinny-pantopus/pull/619) (batch 42). The native Place previews (Stream 1's Start/launch area) are handed to Stream 1. 2026-09-29 (Claude Stream 2): iOS successful delivery after logout sealed `20260929-stream2-f02-ios-retry-late-delivery-r1` (edec37f4, no code): Money's Try-again read held across a real logout and delivered 4.1 s after it; no owner values after logout or for the next member (403). Web same-account permission **accepted by S1** `20260929-stream2-f02-same-account-permission-r1` (fe2bd74c, no code): a request-time 200 delivered 17.7 s after a real-UI revoke stays only until that page's next read; fresh reads and the Place dashboard enforce the revoke. | Remaining: ~~native permission-change re-run~~ done 2026-10-01 on both apps (`20261001-stream4-f02-native-permission-r1` (`4c375292…`)); ~~consumers beyond the Place dashboard (e.g. Hub)~~ checked 2026-10-01 on master `e5b43df97`. The Hub has no bill-benchmark consumer. Block Founders reads only aggregate household counts for its unlock meters. The Home bill card is checked against the current `finance.view` on every read (native E4 accepted in `f02-member-finance`; web in `0930 f02-home-dashboard-bills`); iOS late delivery after a new-account login is unreachable (20 s request timeout); hosted/provider boundaries. (Earlier text: Place financial failures, source absence, access retirement and joint Home/Place privacy. The bounded no-finance member journey is already accepted48d40790; web held-success/account case now acceptede9922741, no app change; Android held-success after logout now accepted `edee4120…`; iOS cancellation beforelogout/member403-retry/cold-return nowaccepted82-file699bb0f7. iOS successful delivery afterlogout or newaccountlogin, same-account permission and other-consumer boundaries remain.)|
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
| U03 | **Every cell of this stream's U03 table is now ✅, – or a named boundary (2026-10-01)**, after the native rounds and #1282, #1300 and #1301 (seals `30ae9e65`, `f663cec6`, `af744361`, `df72ad06`, `4c375292`). Itemized 2026-09-30 (below); recorded per row. Error, retry, lost-reply, malformed-reply and cold-restart cases are accepted inside D01, D04, D09, I04, I07 and F02 (their bundles are in the checklist above). | Loading, empty, partial, unavailable, offline, slow, cancel, back, double-tap and process-death cases on this stream's screens where no row covers them yet. |
| U04 | **Every cell of this stream's U04 table is now ✅ (2026-10-01)**: the native L1/L3/L4 cells are in `20261001-stream4-u04-native-r1` (`b2427619`), and web was 12 of 12. Itemized 2026-09-30 (below); recorded per row. F02's replies delivered across a logout are accepted on iOS (`edec37f4…`) and Android (`edee4120…`), and the web same-account permission change (`fe2bd74c…`); I07's mounted finite-authority expiry is accepted ([#773](https://github.com/WangPantopus/skinny-pantopus/pull/773), `5dadb5b8…`). | Long-lived sessions, background and foreground, and concurrent device or account changes on this stream's screens beyond those cases; the F02 native permission change (open work item 1). |
| U05 | **Partial —42 source dispositions; bounded repairs merged, whole release acceptance open.** Memory#1467/Year#1468 are merged. Settings#1474 is merged unchangedaedb424: original job/web/hiding53-file9c9317b4 plus final83-fileafe71a3d real empty Settings availability/same-VM reentry/read-error/Retry/cold/API/DB. No outgoing new unit declarations; prior diagnostics historical. Exact cleanup/resource release in latest checkpoint. | Remaining retained task entry/status and failure-feedback/honesty/accessibility cases itemized in NEXT-STREAM4-PROMPT-2026-10-02.md; finish all source dispositions and integrated release bindings. Provider/staging/media/physical limits remain named; no blanket U05 closure. |

## Stream 4 exit checklists (U02–U04), itemized 2026-09-30

Itemized from this stream's sealed evidence (bundle names are in the audit store; `MMDD name` = `2026MMDD-stream2-name-r1`, or `-stream4-` from 2026-09-30), using Stream 1's case names (`checklists/data.py`). This is a static list: Stream 1's generator isn't used, and the first read of the evidence was gathered read-only.
- **Legend:** ✅ done (sealed evidence) · ❓ confirm from existing evidence before any rerun · ⬜ to do · 🔷 user decision · ⛔ named boundary · – not offered on that client.
- **Row closure:** a row closes when every cell is ✅, –, ⛔ with its boundary, or 🔷 decided.
- **Native:** native cells can't run until the machine-wide native reinstall (the user's OK).

**U03 edge cases** — E1 server error; E2 lost reply; E3 double tap; E4 not allowed; E5 changed meanwhile; E6 bad input; R1 read failure; R2 empty.

| Workflow | iOS | Android | Web |
|---|---|---|---|
| Home health and seasonal checklist (complete, skip, carryover) | ✅ E2 (0927 checklist-uncertain-recovery)<br>✅ R1 (#661, #669)<br>✅ E1 data and retry: a 503 on a change leaves the item pending with Retry, and Retry then the change completes it. The card said "Couldn't load the seasonal checklist" though only the change failed; it now says "Your change may not have been saved" (E1, E2 and E5 afters; [#1282](https://github.com/WangPantopus/skinny-pantopus/pull/1282), merged in batch 279; `20261001-stream4-checklist-headline-r1` (`af744361…`))<br>✅ E3: a double tap during a held change sends one PATCH<br>✅ E4: for a member without permission the checklist control is disabled and nothing is sent; no sentence says why (the web's wording item) (`20261001-stream4-u03-native-r2` (`f663cec6…`))<br>✅ E5: a stale skip after another device's completion gets 409, the server's sentence shows under the new headline, and nothing is undone<br>✅ R2: a Home's first view creates the season's items, and the health score agrees (55/100 next to "0/2 done", not "No seasonal checklist created yet") (`20261001-stream4-checklist-headline-r1` (`af744361…`))<br>– E6 (no typed input) | ✅ E2 (0927 checklist-uncertain-recovery)<br>✅ R1 (#661, #669)<br>✅ E1 E2 data and retry, as on iOS. The load headline over "Couldn't confirm that task update…" now reads "Your change may not have been saved" ([#1282](https://github.com/WangPantopus/skinny-pantopus/pull/1282); `20261001-stream4-checklist-headline-r1` (`af744361…`))<br>✅ E3: one PATCH (`20261001-stream4-u03-native-r2` (`f663cec6…`))<br>✅ E4: every Mark and Skip control is disabled for a member without home.edit, and a tap sends nothing<br>✅ E5: a stale skip gets 409, and nothing is undone<br>✅ R2: first view, 55/100 next to "0/4 done" (`20261001-stream4-checklist-headline-r1` (`af744361…`))<br>– E6 | ✅ E2 (0927 checklist-uncertain-recovery)<br>✅ R1 (#661)<br>✅ R2 (#587)<br>✅ health follows on-page saves (#860)<br>✅ E1 E3 E5 (0930 health-e1e3e4e5: a 503 gives an honest alert with Retry; a double click sends one PATCH; a stale skip after another device's completion is refused with 409 and nothing is undone; the wording is generic)<br>✅ E4 safe (refused with 403, nothing written, the checklist turns read-only) — gap: no sentence says why (later wording item)<br>– E6 |
| Bill benchmark: Home opt-in and Place Money signals | ✅ E1 R1 (#619, 0927 f02-member-finance, 0929 f02-ios-retry-late-delivery)<br>✅ E4 (f02-member-finance)<br>✅ E5 permission change, on a recreated F01 cohort. The member sees neighborhood figures only; after the owner grants finance.view, "$150 / mo, 12% above"; after the revoke, neighborhood only again. The member's Place dashboard then shows no bill figures, while the owner's shows the nudge (`20261001-stream4-f02-native-permission-r1` (`4c375292…`))<br>✅ R2: Place Money "Bill benchmark · Not available for your area yet." (0929 f02-ios-retry-late-delivery, 0927 f02-ios-held-account) and the Home bill card's "No paid USD bills…" (0927 checklist-uncertain-recovery)<br>– opt-in: web only (`BillTrendChart.tsx:99`); the apps only decode `bill_benchmark_opt_in` | ✅ E1 R1 (#619)<br>✅ E4 (f02-member-finance)<br>✅ E5, as on iOS (`20261001-stream4-f02-native-permission-r1` (`4c375292…`))<br>✅ R2 Home bill card "No paid USD bills…" (0930 native-activity-r2); Place Money "Not available for your area yet." is captured in 0930 u02-native-r1 (seals after its cleanup)<br>– opt-in: web only | ✅ E1 R1 (#602)<br>✅ E4 (f02-member-finance, 0930 f02-home-dashboard-bills)<br>✅ E5 (0929 f02-same-account-permission, 0927 f04-withdrawal)<br>✅ R2 (0927 f01-bill-cohort, f04-withdrawal)<br>✅ E2 E3 on the opt-in save, no change (0930 optin-e2e3: a double click sends one PATCH; after a lost reply, the card says not confirmed and a reload shows the committed value) |
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

**U05** — **partial: source reconciliation and bounded real verification in progress.** The reconstructed runtime is available under the shared lease. The 42 qualified dispositions below identify retained acceptance, repaired rows and open real-app/API checks; they do not close this stream’s release-manifest row.

### U05 source reconciliation — 2026-10-01T20:45:58Z

Source: master `f88f74641f019e35bcdba24d71ccec38ce5b0d8e`, fetched on this host. This is **source inspection, not a new device/API/DB acceptance pass**. The kit, original S34 environment and audit files are unavailable here. The original inventory remains a draft; rows not listed below remain unverified. Preserve its links and the accepted evidence above. File names below refer to their existing iOS, Android or web feature directories at this exact master.

| Inventory candidate | Current source and disposition | Next bounded verification / decision |
|---|---|---|
| Native Maintenance reachability and calendar side effect | **Verified/merged#1448; due-day#1459 also verified/merged.** Both native same Profile/Home cover caller save due-bearing maintenance without calendar POST/rows when extras off; before45-file494d976e…/after82-file330da745…. iOS due day actual Nov1→Nov2 save/API/DB/cold detail/Edit,41-file1ab0e6ee…. | Preserve exact guard81d855… and date8fd192…; no cut-calendar interior claim. No calendar store/schema added. |
| Calendar effect on retained scheduling | Existing availability reader treats a calendar event without end as24hours/all members. Guard#1448 both-native and date#1459 native/API/DB show zero hidden calendar POST/rows; source-bound evidence330da745…/1ab0e6ee…. | Preserve zero side effects; no cut-calendar interior or new calendar implementation/schema. |
| Maintenance notes/photos/receipt/category/contact | **Notes loss repaired/real after verified on both apps, #1449 merged in batch333.** Existing notes POST/PUT/DTO/detail/edit now survive cold reload and explicit clear remainsNULL/absent after cold. After `330da745…`; no new store/schema/screen. | Merged exact notes03b73830de9c5b3eddf29fdf758679a9784feae5. Photos/receipt/category/contact acceptance remains separately unverified; inspect existing protected-document contract before repair. No claim from this note-only roundtrip. |
| Mail task dock/header stubs | **Merged#1444 unchanged, originald378fee78fba2ddb9f969e0dc41d5f5d2074cb74.** Real both-native before→after→processcold removes five unfinished actions while retaining Markdone/source content;42-file seal746708c00653a03a78546d91e67b790c9e3271f5ab81fa89f46bfc85fb7c7811. Exact5rowcleanup/business restored. | Preserve source-bound native builds/22Androidunits/9snapshots and bounded actual chrome/API/DB evidence. No Markdone activation, source-link navigation, iOSMailTask unit or spoken AX acceptance claimed. |
| Native mail-task Convert to neighbor gig | iOS `MailTaskListView` and Android `MailTaskListScreen` render Convert for unfinished, unconverted tasks without `openGigs`; unlike the separately hidden PackageGig action. | Reproduce visibility on a retained received-mail task with flags off; suppress this cut entry point in the existing row. Do not exercise the cut gig workflow. |
| Native task Mark done/Reopen | Both `MailTaskViewModel` implementations show success before the PATCH, then roll back/show failure. The stub branch does not change this. | Separate delayed/failing PATCH reproduction; move success to confirmed completion in the existing handler if observed. Verify persisted status and cold reread. |
| Mail-task subtasks, Add a step, snooze choices | Live projection does not populate these sample slots; the shown dock stubs are a separate reachable issue above. | Preserve preview design. Do not implement sample affordances merely because their methods exist. |
| Mail Day sample fallback / scan/history/setup / Stamps and Earn flag gaps | iOS live read failures already use the error state on master (#1375). #1406 and #1410 merged unchanged in batch323/#1432 with fresh source-binding addenda and both compile gates satisfied. Their retained E2E is historical accepted evidence, not newly rehashed on this host. | Preserve #1375. Preserve their merged source and bounded accepted evidence. Do not reopen covered source or exercise cut features. |
| Mail Day Accept suggestion and Finish day failures | Both native accept handlers restore previous state without an error message; finish failures leave the day open silently. The Other/Undo paths now have explicit error feedback and reread. | Reproduce only these remaining failure paths; use existing error presentation, preserve layout and accepted Undo behavior. |
| Mail Day settings | **Verified and merged #1474 unchanged, exact `aedb424b4ce08a8162052685126ff229fbdd8fcc`.** Original timing/hiding real after53-file9c9317b4… plus final83-fileafe71a3d… prove actual job/web Save/empty-native Settings/cache reread/error/Retry/cold, with exact local underlying403 and honest API500. Android has no Settings UI/caller. Four whole files/two literal Settings sections equal fresh master4e55; all29/53/83files rehashed/read-only by successor. | Preserve recorded acceptance and frozen6452 bindings. Exact14-row cleanup restores349of353 public-table fingerprints; four normal Auth histories preserved. Existing26notification checks/webTSC/page lint/Node/diff pass. Source iOSCI queued; cancelled batch not aggregate green. No new unit declarations, provider/physical/whole-U05 claim; do not rerun unchanged journeys. |
| iOS reviewed-row Undo accessibility | `ReviewedRow` combines children and supplies a label naming mail/action/time but not Undo. A trailing Undo button exists. | Retained prior observation plus source candidate; verify actual VoiceOver/AX behavior and add the smallest named action/hint. No new accessibility claim on this host. |
| Android source-mail card orange fill | **Reproduced and repaired; actual Android after verified, #1451 merged in batch333.** Existing white surface/orange4dp accent measurement constrained by wrapContentWidth(Start); all tokens/layout retained. Actual05d card white+narrowstripe/source-taskAPI/DB match, 3existing goldens visually reviewed/verify+assemble passed.21-file sealf158985e8daa29a0a71aa0a3af7d1d79b7cf2a7892e3c12cab06be948cdd5843. | Merged exact5106f39e498519a29c4e78f1c5355461c8999aa3; preserve iOS accepted white-card parity. Exact5rows cleaned353/353returned. No presentation redesign or broader task action/provider claim. |
| Received generic mail TL;DR timeline | Both `GenericMailDetailLayout` implementations always synthesize the TL;DR event for acknowledged mail; iOS live projection sets `aiSummary=nil`. | Reproduce on retained generic mail; display only supported history in the existing timeline. |
| Received generic mail Tap to undo | The acknowledged action still calls the acknowledge handler; both handlers write acknowledged=true. | Trace real retained-mail acknowledgement and server row; replace the false Undo promise with honest existing behavior, without inventing an unsupported undo API. |
| Received-mail attachment chips | Both generic builders create name-only attachment items without handlers; the shared iOS item defaults to an empty handler. | Determine which retained real payloads populate them, then prove download/open against the existing authorized content contract. Not closed as unreachable. |
| Native booklet/coupon/records variant no-ops | `mailbox.js:getMailObjectPayload` returns the MailObject row as metadata; detail assigns metadata to `mail.object`. Native decoders require payload fields absent from that row and fall back to generic. | Preserve the existing source-bound reachability limitation; do not implement hidden variant actions or reopen cut package behavior. Actual variant payload coverage remains unverified. |
| Promo Save Offer / cut Earn fake opening | Existing mapping sends `file` and says Offer saved; Earn-specific behavior is cut #8. | Exclude cut Earn verification/repair. If a retained generic promo exposes this label after flags, first isolate that entry and decide truthful filing copy. No blanket Earn work. |
| Web tasks New from mail | **Reproduced and repaired; #1424 merged unchanged.** Existing panel sent empty mailId and received400 without feedback. It now selects a valid recent received-mail source, requires it and reports save errors while keeping the draft. | Real browser source/read/retry/empty/phone plus503→retry200, cold GET and HomeTask/Mail backlink/audit proof pass. Head `6e014a3b222bbbfb1b87ad3efa50dfa311b4b67e`, seal `b58357d9789348adeb7adb23f97a4b3e19fb60e882bb29d814a04e215fcd9eaa`; exact14app rows removed,351non-auth publictables restored and2shared authentication setup deltas disclosed. Recent50perdrawer scope; no all-history search claim. |
| Web Memory Save to Vault | **Verified repair#1468 merged batch342 with S1.** Aggregate year-in-mail/mail-history POST400 and silent reset before44bd3f96…; no valid existing Mail artifact contract. Unsupported control hidden in existing card, zeroVaultPOST in all5 actual contexts; after23-file0b874e11…,exact30events cleanup353/353. | Preserve valid existing Vault flows; no new aggregate store or native/external-provider acceptance. Follow exactfaa98d… through review/merge. |
| Web Memory Share | **Verified repair#1468 merged batch342 with S1.** Before falselyShared after both browser operations rejected; now failed/cancelled/fulfilledshare-handler/actualChromiumclipboard/phone-failure outcomes pass with5viewedframes. After0b874e11… source-scoped Year section equal; lint/TSC0. | Actual browser clipboard acceptance and explicit share capability spy are separate; no real OS sheet/external share/provider claim. Follow exactfaa98d… review/merge. |
| Web Memory Dismiss — handoff correction | **Verified repair#1467 merged batch342 with S1.** Primary before500602da… render undefined.length/returnedotd400. Secondary beforeGET503 falselyempty/POST503 hidescard/LA calendar one-day shift reproduced. Existing schema/API/web repaired; realcaller/readRetry/dismiss503→200/DBonePK/coldphone/member404/stale404/concurrentretry pass. After39-file00531576…,lint/TSC0; original15 diagnostic preserved but newtestfile removed under founder rule. | Follow corrected exact8e24f70… plus5-file source-identical successor09489e2b… review/merge;2existing retained route regressions PASS. Preserve native mail_items; no migration/store/service/screen. Exact33cleanup351 business table fingerprints equal,2 sign-in AuthSession/SecurityEvent preserved; no whole353 equality/native/provider/physical acceptance. |
| Web theme apply / Vault Create folder / Records Add asset | **All three error callbacks have actual local after; Vault/Records #1476 merged batch345, Themes #1478 merged unchanged batch346 e6c38a1d4c1f4b8b473d391f43d60cf3e7ad25ec.** Existing toast only. Vault/Records4desktop-phone cases503/error/draft/DB0/manualsuccess/API+SQL/singlerow/reload preserved;26before31798381…/38after9facac43…,11PNGs/3masked-frame qualifications/exact46cleanup353 unchanged. Themes2desktop-phone cases503/error/retainedmodal/unchangedSettings+tokens/manual200/sameownerPK/activepreviewreload;19before7e7a…+7closure931f… (premature-seal omission explicitly qualified),29after7d201…;5PNGs/exact3before9aftercleanup353 unchanged/actual return11:55:46Z. | Vault/Records sourceCI36997724807 SUCCESS/both pages equalc244, native/backend skips qualified. Themes sourceCI37003947398 completedSUCCESS/all applicable pass; cancelled346batch sole failedaggregate personally read/cancellation qualified. All8acceptedwholefiles/2sections equal freshc0a; one existing page4insertions, no new units/files/schema/design. Immediate successful data-theme only; success accent not separately read/**no cold global CSS or native/provider/production unlock acceptance**. #1401 server/native evidence preserved; no whole-U05 closure. |
| Android rate-watch Remove | `PlaceDetailViewModel.removeRateWatch` ignores `NetworkResult` and sets None after the repository DELETE. Save already handles errors. | Fail DELETE under lease, compare UI/server, repair the existing handler using its established error state. |
| Civic election no-data vs failed read | iOS and Android fall back to No upcoming election when the envelope is not live; web uses the same statement when data is missing. | Inject an unavailable/error section in the real Place journey and compare with a legitimate no-election response. Reuse each client's existing fallback card; no new civic data source. |
| iOS document linked-to picker | Bills, maintenance and pets are fetched unconditionally; Android already guards bills/pets with householdExtras. | Reproduce flags-off visibility/requests from the retained upload form, then reuse Android's guard pattern. Do not test the cut bill/pet products. |
| iOS recent household activity | **Fresh c0a source qualification:** current `homeDashboardService` filters cut targets through `excludeHiddenHomeActivity` before the five-row query; the retained activity endpoint does likewise. iOS household projection maps returned rows; Android also filters five target types. Separate Hub RecentActivity VMs already filter type/route and are a different caller. [13-file/canonical table source receipt](/private/tmp/pantopus-stream4-prep/recent-household-vs-hub-source-preparation-r1.json), offline only. | Verify the actual retained dashboard/API with exact owned cut-target and retained HomeAuditLog rows, no cut tables/interiors. Preserve the existing server/client filters; add a repair only if a leak reproduces. Unknown home-path fallback coverage remains unverified; no broad missing-filter or new acceptance claim. |
| Document kebab/export | **Draft overstates NOOP:** iOS kebab invokes `onDocumentAction(...,.view)`, so it opens the existing detail. Export callbacks are stored but never invoked in both view models. | Preserve the working View action; no new export/menu implementation merely for unused callbacks. AX label and actually exposed controls remain a device check. |
| Issue row tap | iOS tap callback is empty and Android uses the default; status controls remain in the row footer. Prior stream evidence already recorded this parity. | Preserve existing action placement; no invented detail screen. Reopen only for a reproduced accessibility/interaction failure. |
| Property correction Send | Both native forms explicitly disable submission and explain that nothing is sent. | Honest placeholder; preserve. A no-op callback behind a disabled, disclosed action is not a missing implemented workflow. |
| Equity interest-rate input | Native calculators keep a rate input but calculate equity from value minus balance only. | Source-confirmed unused input, not a financial-calculation defect. Inspect the actual frame before the smallest honesty change. |
| JustMoved mail step | All three source definitions promise one-tap return, but native navigates to Mail Day and web to its settings. | Reproduce navigation; change the existing step copy to match the retained destination rather than building return-to-sender. |
| Mailbox map | iOS projects pin body into address, isOpen=true and hashed positions; Android source similarly projects home pins but filters cut kinds. | Retained map semantics need real-fixture verification. Do not claim geographic or open-hours accuracy from these projections. |
| Web bundle File all / booklet Download | Existing visible callback sites remain empty in drawer layout and detail. | Verify actual retained payload reachability before hiding or wiring to the existing vault/download contract. |
| Web Maintenance Suggested / Log Maintenance | Suggested is a static, season-selected checklist; Log Maintenance opens the existing Issue panel. Static suggestions are not fabricated completed work. | Verify wording and destination in the real dashboard; preserve useful local suggestions. No replacement maintenance subsystem. |
| Coming-soon rows, sample homes, orphan routes | Coming-soon labels and sample-only data should not be treated as live API promises. **No nav link does not prove a web route unreachable:** authenticated direct URLs still require checking. | Retain explicit placeholders. Native sample-ID and web direct-route reachability remain scoped checks; do not close them by filename or absence of links. |

### U05 additional source dispositions — 2026-10-01T21:07:59Z

Compared current master `cb02fef0827d8a6f895eba9bbaee42cee70a6aed` with the draft and the accepted pickup/benchmark records. These seven rows extend the 35-row source reconciliation; they do not add new runtime acceptance.

| Inventory candidate | Verified source / disposition | Next bounded action |
|---|---|---|
| iOS Emergency Share with no entries | `EmergencyInfoViewModel.topBarAction` always offers Share; `shareSummaryText()` returns nil for an empty array and `EmergencyInfoView` silently stops. | Real empty-list check, then hide/disable the unavailable share using the existing action contract or give the existing empty-state guidance. Never dial an emergency number during verification. |
| Recent permits on all three clients | Each existing Place Block card explicitly says unavailable for the area; web uses `state="unavailable"`. There is no enabled action or successful-query claim. | Honest placeholder: preserve. The draft's NOOP classification does not justify implementing a permit source. |
| iOS pickup post-save `vm.load()` | The parent load method skips an already-loaded page, **but `AddressCalendarCard.choose()` first assigns `confirmed = response.calendar`; rendering and the reopened editor read `confirmed ?? data`**. The saved server response therefore updates the card without another GET. | Preserve the accepted I04 / pickup E1–E6 evidence. No reproduced stale-card failure and no reason to change this caller merely because the callback skips a fetch. |
| Web Records AI suggestion | `aiSuggestion` starts nil and every setter in the page only assigns nil; the suggestion panel has no real input/caller. The manually added asset route is separate. | Source-unreachable decorative branch; do not create an AI pipeline or sample result. Preserve the real Add asset workflow. |
| Web Records Add asset on phones | **Reproduced and repaired; #1420 merged unchanged.** Phone Add asset opened an invisible hidden-md form. Two existing container visibility classes now expose it and return to the list on Cancel. | Real390×844 form/POST201/reloadGET200/DB fields and1280×1000 desktop/Cancel pass. Head `48f7eb725102aa0170a480e36f38ee9ea22a7a2f`, seal `3713ecfa381fa3279ab5c557877f58a806186759930751674e110a17c0124b6d`; exact18rows removed and353/353publictables restored. Existing design retained. |
| Web Mail Day Dismiss | **Reproduced and repaired; #1422 merged unchanged.** The page dismissed only until remount. It now shares the existing local-day marker through MailboxContext with the layout banner. | Actual click/reload/navigation/stale-day expiry and page↔banner behavior pass; owned notice remains unread/unarchived. Head `d82f7f76e2f0c97fd76bcc101599d59702ac86f4`, seal `512d105b8ed2557d86ac4566289e88232391328cb12872b1cf1c734a4be12bc5`; exact18rows removed and353/353publictables restored. Cross-tab immediate sync/mounted-midnight timer not claimed. |
| Home bill trend / benchmark card | Native cards remain visible, and web explicitly gates Add a bill while preserving benchmark opt-in. The existing F02/F04 and U02 records accept the retained money/benchmark surface independently of cut household bill management. | Preserve that accepted boundary. Do not open or test cut bill-management workflows, and do not remove retained benchmark data merely on the draft's broad leak label. |

**Release disposition:** U05 remains partial. The initial source audit above used no runtime resource; its restored-environment boundary is now superseded by the explicitly reconstructed successor kit. The three web rows amended above carry later bounded real acceptance and immutable seals. All other proposed live checks remain open unless their row cites accepted evidence; source inspection and builds alone do not close them.


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

### 2026-10-02T12:43:21Z — Retained native source/operator preparation; agreed queue preserved

S1 explicitly preserves S3 completed landlord12/cleanup/full native return → S4 MailTask entry/status → S3 broader U02. S3 is still executing landlord cases/repair; S4 has no runtime/device/heavy owner/waiter/fixture and a69f remains clean freshc0a `claude/stream4-mail-task-launch-entry`, no application edit. Private MailDay [fault/observer preparation](/private/tmp/pantopus-stream4-prep/mailday-feedback-operator-preparation-r1.json), [cleanup preparation](/private/tmp/pantopus-stream4-prep/mailday-feedback-cleanup-preparation-r1.json) and [two bursts](/private/tmp/pantopus-stream4-prep/mailday-feedback-burst-preparation-r1.json) syntax-check **only**, not installed/run: exact owner/home/item/currentUTCday/hashed real observation/lease on pre-forward Route or Finish503; exact seven-table cleanup includes only declared notice reassigned homeward by Undo with locked PK/full-row MD5/global counts and original helper restoration. Reaccepted phase prevents comparing Finish against pre-Undo rows. Wrong offline filename/cwd reads made no runtime operation or receipt/acceptance; canonical source paths were located before final candidates. Current Recent Activity server/filter qualification is in the existing U05 cell, with no duplicate filter added. MailTask [status observer r2](/private/tmp/pantopus-stream4-prep/mailtask-status-observer-preparation-r2.json) supersedes the unexecuted r1 status proof: exact stage/fault/lease, full task/mail/audit rows, explicit pending/completed phase and unchanged failure/cold preimages; actual API is list/select-by-ID, not an invented detail endpoint. [Rate-watch exact observer/cleanup](/private/tmp/pantopus-stream4-prep/rate-watch-remove-operator-preparation-r1.json) likewise syntax-only; three expected core tables do not establish all real read side effects, so all353 must be compared and unexpected scopes refuse. Civic source already distinguishes not-configured/error from known no-upcoming reason; rate-watch GET retains a watch with null evaluation after the existing egress guard rejects PMMS. These are source leads/preparation, **no provider or real caller acceptance**. Next actual MailTask before uses fresh relevant source/config/product binding after S3 return; Settings/Vault/Records/Themes accepted evidence remains unchanged.

- **2026-10-02T11:11:05Z — Vault/Records1476 merged unchanged in batch345/#1477.** Fresh GitHub sourcePRmergedAt11:08:49Z/exacted289da84909bba972672764e0ac4ca197cd661e; fetchedmasterc244ded73d0372e7818b82d3b5e5d998f679d637 and2whole repaired page blobs equal. S1 independently reviewed both seals/actual afters/qualified pixels/353 cleanup. SourceCI36997724807SUCCESS preserved; batch36999314374 cancellation requested/at fresh read still finishing, never aggregate-pass. Next solequeue346. S1 authorizes exact-owned Themes browser proposal only at S3 acknowledged natural case-clean boundary/actual fullruntime/devices/22093handback; direct request sentS3, noS4acquisition. Before/after catalog/cleanup/browser operators syntaxchecked, unexecuted; nativeMailTask remains afterall12landlord. No repeated appjourney or broad-U05 claim.
- **2026-10-02T11:03:08Z — PR1476 exact-head CI completed successfully.** SourceCI[36997724807](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36997724807), headed289da84909bba972672764e0ac4ca197cd661e, all applicable web E2E/lint/typecheck/Jest/build/schema/safeguards/CI OK PASS at10:56:19Z; backend/native path-skipped/no failed jobs. Fresh GitHubOPEN/MERGEABLE, no review decision. Sent exact result to sole merge ownerStream1; accepted real after/seals and10:48:15clean return remain unchanged. S3 retains runtime/devices, offline preparation continues. No new journey or whole-U05 claim.
- **2026-10-02T10:53:10Z — Vault/Records local after sealed, PR1476 ready for review.** Exacted289da84909bba972672764e0ac4ca197cd661e/twoexistingpages/existingtoast only. Actual4desktop/phone rejected-save→draft/error/DB0→one manualretry200/201→singlePK/API+SQLfieldmatch/reload PASS;3failure-only recaptures resolve broad header-mask pixels without extra persisted rows. All11PNGs viewed; after38-file9facac43411da514795efbfc8f45c4e2bea1a929a3aea449cf3ee98af306861d and before26-file31798381… scanned/copied/rehashed/read-only. Exact46ownedrows cleaned/all353 restored after pre-baselineownerlogin; startup/proxy unchanged/cleanuporiginal restored/master4e55backend92811healthy/fault0/driverabsent/noS4devicesheavy/exact runtime release10:48:15. PRopened/attached/head+seals sentS1; sourceCI fresh scheduling read pending, informational. S3 remaining10landlordcells first→S4MailTask. Themecatalog before/operator and native78filecomparison are unexecuted preparation; no broad launch completion.

- **2026-10-02T10:05:24Z — Vault/Records failure-before sealed; clean runtime returned.** Actual two existing browser forms rejected one declaredPOST503 each, retained draft but showed no error. Themes catalog0 prevented apply, unverified. Before26files/`31798381e8baf030d413076f7957e879440fe6575bc58f59e3d38117558d70ce` personally reviewed2maskedPNGs/scan passed/both mirrors rehashed/read-only. Exact20 owned rows cleanup/all353 fingerprints equal freshbaseline; helpers restored, faults0/d317clean4e55/backend84484healthy, no devices/heavy. Runtime exactrelease10:01:49Z and S1/S3 notified. Minimal two-page existingtoast repair preparing offline, actual after pending. S3 landlord12→S4 MailTask order preserved.

- **2026-10-02T09:23:04Z — Successor Settings merge/source reconciliation complete.** See ACTIVE SUCCESSOR above: accepted29/53/83auditfiles rehashed/read-only, four whole appfiles/two literal Settings sections equal freshmaster4e55a2c02d681cd2edb99c276650f15d6c5b9981. Source nativeCI still queued, cancelledbatch aggregate failure read. S3 landlord12 first, then S4 MailTask; no S4 shared-resource or fixture action. Existing Settings U05 row now reflects final merged acceptance rather than its historical pending snapshot.

- **2026-10-02T09:04:23Z — Settings1474 merged; final clean successor handoff.** Actual window07:39:30–08:27:43Z, own heavy install07:52:07–07:52:57Z/no overlap with root release07:51:46Z. Final native6452 installed four-product equality; real empty Settings enabled, actual desktop/phone saves, same-VM web/native09→19→09. Exact underlying local read403 before API200/native fabricated08 despiteDB09; existing GET maybeSingle/error repairaedb424 yields realAPI500/existing native error/no time, actualTry again09/coldPID68098/caller09. Genuine absent-row defaults20008/DB0 after cleanup. Two transient503 probe recoveries and wrong helper envelope/Auth-count assumptions qualified, not product failures. Five outgoing app files/no new test declarations;26 existing regressions/TSC/lint/Node/diff0; final build and source bindings recorded. Original startup restored; exact14 cleanup349-of353 fingerprints unchanged/four Auth histories preserved; fault0/driverstop/Shutdown/slotrelease/exact runtime release08:27:43. Final83-fileafe71a3d and original29/53 seals copied/rehashed/read-only; all16PNGs viewed. PR1474 opened/attached/head+seals sentS1, independently reviewed and merged unchanged in344/#1475, GitHub08:43:19Z/master4e55. Completed applicable sourceCI PASS; queued iOS/cancelled batch qualification preserved. No open S4 application PR or held resource. All app work committed/pushed; private operator/build diagnostics retained locally. Comprehensive owned NEXT-STREAM4-PROMPT-2026-10-02.md + kit mirror prepared with exact source/evidence/recipes, remaining15–20 local groups, provider/deferred/physical requirements and75–80% estimate. Stream1/3 receive publication; do not interpret handoff as whole-workstream completion.

- **2026-10-02T07:21:32Z — Memory/Year merged; Settings source correction and next exact window prepared.** Remote batch342/#1471 merged07:12:29Z at fetched `fa1072a5b8036f694534f3e1944b38d585ee6b33`, exact1467/8e24 and1468/faa; applicable sourceCI completedPASS. S1 verified union4files/3wholeblobs+sharedPage exacthunks, both after seals and corrected source-only receipt. Original Main Page subsection digest qualification recorded in latest checkpoint; immutable packet preserved, whole actual98dd Page identity remains independently reproducible. Settings current `90e6063914f1defec7d7854bc2400ded211f6213` removes outgoing new test declarations per direct humanattachmentline59, application bytes unchanged fromd039; original executed diagnostics remain historical. Fresh private single-commit joint `1da06927ec5c8f8ad797ec83714535932b2370ae` frommaster342 changes fiveappfiles only. Final6452 guarded short installer, additive exact S4 GET/settings-before503 mode and cache-only PK/preimage/global-count cleanup are prepared outside peer lease; no shared mutation/device use. S3 continues ordinary-invite acceptance before promised clean return; S1 integrated Android compile can proceed meanwhile. Real Settings final after and all other retained U05 local cases remain open; no new physical/provider/hosted closure.

- **2026-10-02T07:01:48Z — Memory1467 review correction, application evidence unchanged.** S1 HOLD correctly cited humanattachment `/Users/yingpengwang/.codex/attachments/c63d7eaf-4bc2-48a7-8ceb-3bfd3d0c5a86/Pasted text.txt` line59: “No new unit tests (updating existing ones is fine). E2E in the real apps is the bar.” Read directly; necessary-new-test rationale cannot override it. Focusedfollowup8e24f70b49595a54c1a58b88f50aaac2d4de30d8 deletesnewbackendtestfile only, no declarations moved. All4application Gitblobs exactlyequal testedfe676; original39-file00531576/15-run diagnostics immutable/historical. Fresh5-file source-only successor09489e2b5469e8a918f13d1e84868a853e6cff2aff113a8158e9c37e75c8b379 proves identity;2existing homeRecordRoutes retained mail-status/due/source-conversion regressions PASS, allcuttestsexcluded. Scan/copy/hash/readonlypass;PRbodyupdated/head+sealsentS1. No repeatedappjourney or runtimeoperationneeded onunchangedappfiles. S3owns runtime/devices; r8install actualcomplete, Settings6452afterwaits actualcleanhandback.


- **2026-10-02T06:53:29Z — Memory#1467/Year#1468 actual afters sealed and queued; Settings2tests pass/final shell build passes; clean runtime handed back to S3.** Memoryexactfe676ac…,39-file00531576…: existing caller GET503 error/Retry→real200/card; failed POST keepscard/error/DB0; retry200 existingDATE/mail_item_ids/singlePK, ownerfreshread/coldphone/membergenerated+UUID404/stale404/concurrentretry. Actual LAOct1→Oct2 caption correction. Primarybefore500602da… plus3newbefore frames;5acceptedafter frames allviewed.15focused API/Joiunits,TSC/2-filelint/diff0. Exact33 cleanup351non-auth fingerprints equal;2newactualsign-in AuthSession/AuthSecurityEvent preserved17→19, failed353assertion qualified rather than erased. Initialwronganchor selector refused; stale developmentCSRF after backendrestart fixed by realpostrestartsignin, no auth bypass/appchange; same notice reused. Yearfaa98d…,23-file0b874e11…:5browsercontexts failure/cancellation/fulfilledhandler/actualChromiumclipboard/phonefailure; honesterror/retry/no-copycancel/SharedorCopied, invalidaggregateVaultabsent/zeroPOST. ActualYearGET200/emptyMailMemory;exact30eventcleanup353equal;5framesviewed/TSC/lint0. Both freshaudits scanned/copied/rehashed/read-only/PRsattached/head+seals sentS1.
- **Settings followup:**04098compiled; real2tests initially failed from wrong nested fixture (actualGET flat), correctedexistingtestsab06,7b23nativebuild/install/hash→executed2/2PASS. ActualemptyMailDay Settings disabled dueisDirty=false; beforecaptured on7b23, one-lineexistingShellenable+commentd039 pushed. Frozen6452build-for-testingPASS06:49:35/toolautomaticheavyrelease; no source switch/editwhilequeued. DebugVMdylib7b23 equal04098; freshcache/emptySettings afterstillpending. Original53-file timing/hiding9c9317b4 retained unchanged.
- **Actual handback06:46:34Z:**freshmaster4eb33c56/PID51313 healthy, currentproxy39132/SHA50cb3833 unchanged/fault0/allfixtures0; iOS7b23shutdown/owned47805driverstopped/22093absent/slot2released,Androidd6cuntouched. `runtime/stream4-memory-year-window-handback-r1/` publicfingerprints/ready/device/release receipts. S3 actualreacquire06:48:06 and Androidslot1; S4hasNONE. HeavyC37released→S4Settings6452finished→S3r8shortinstall. PrepareSettings guards and next retainedU05source cases outside peerlease; no final launch/wholeU05 or provider/staging/physical claim.


- **2026-10-02T05:36:45Z — settings actual round cleaned/sealed, due-date#1459 merged, Memory/Year real before confirmed, runtime returned to S3.** S4 window04:40:49–05:28:15Z; current41d installation under distinct heavy04:42:08–04:43:04Z, code hashes rechecked. DueDate#1459 exact8fd192… merged in batch337/#1461/master3741653… after S1 independent41-file seal1ab0e6ee… review. Original settings53-file after9c9317b4… proves disabled/future/eligible/duplicate real-clock jobs, webdesktop/phone saves, native honored-row visibility; records stale native reread failure without claiming closure. ceac cache fix/two tests pushed; frozen04098 build queued behind actualS3r6 (05:02:15Z); no acquisition/result yet. Memory15-file500602da… and Year15-file44bd3f96… reproduce error boundary/Dismiss400, falseShared and unsupportedVault400; app repairs/afters pending. Exact per-round rows18/3/3/12 deleted with locks/PK/fullMD5; each353/353 and entirewindow353/353 restored. Native popup mis-tap, probe mutable selector/React-caught listener, zero-count cleanup argument and reconstructed lease wrapper refusals are qualified; no accepted image/status invented. Finalhandback76ed/PID27977 healthy, faults0, all businessfixtures0, iOS down/15097 stopped/22093 absent/slotreleased, Android untouched. Exact-label zsh heldfalse05:28:15 confirmed; premature interim peer handback claim corrected, S3 actual acquisition05:28:34. Continued own source repairs without shared runtime. Heavy order r6→04098→S1Wallet→S3shortunits/install; no whole-U05/provider/physical/hosted/unit acceptance.

- **2026-10-02T04:20:40Z — batch333 merged three verified topics; date build passed.** Remote #1448/#1449/#1451 are MERGED at04:18:37Z, exact heads81d855b9d52f814d856eee649902ac8e65161b54/03b73830de9c5b3eddf29fdf758679a9784feae5/5106f39e498519a29c4e78f1c5355461c8999aa3; fetched master27a2ee6d242533f18411eae40f2c824685d74097. S1 independently verified both seals and the17-file union, resolving overlapping Android test context by equality to the actually tested ad0 joint; native source CI was still pending, not an aggregate pass. Separate date-picker private3a4d76cad4a9f4ae120f7055e22ad38280afde60 iOS build-for-testing exited0, heavy04:06:45–04:09:29Z; product Pantopus executable SHA256c1143ed1c4abe6e83f5c54fd870b6acc088182f788471378464f7edfec2da742. Actual due-date after is pending. Corrected the successor summary’s handback SHA to sealed efa4cadab857d088d8c89857dedfc38eb6ec4034/PID99011 (later fetched886b was not that runtime’s handback). No sealed evidence edited. S3 owns runtime and corrected Ownersr4 heavy build; S4 notified actual own build completion/release and continues independent retained probes.

### 2026-10-02T04:09:01Z — Maintenance and source-card actual afters sealed; three separate PRs handed to S1

- [#1448](https://github.com/WangPantopus/skinny-pantopus/pull/1448) reminder guard `81d855b9d52f814d856eee649902ac8e65161b54` and [#1449](https://github.com/WangPantopus/skinny-pantopus/pull/1449) notes `03b73830de9c5b3eddf29fdf758679a9784feae5` opened/attached, with problem, separate repair scopes, complete evidence/limits/checks/footer. Both actual native Profile→Home cover→Maintenance→save with note/due→warm→real processcold samecaller/detail/Edit→explicitclear→secondcoldabsence pass. Request metadataPOST201×2/PUT200×2, API200/DB match, calendar requests/rows0. No observer maintenance writes, cut interiors or providers. Fresh immutable [after README](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20261002-stream4-maintenance-afters-r1/README.md),82files, MANIFEST `330da745bcdacbcfe472d81c875da68f962de86c77c9ac8f35a1120505f5bd83`; prior45-file before `494d976e…` preserved. All listed hashes verified/read-only.
- Private native05d both builds passed; installed products independently rehashed. Corrected unchanged Maintenance47units/8snapshots, Swift checks and31HTTP/mock-DB (62joint) source-bound; no iOSMaintenance unit/provider/media/staging claim. Exact4rowdry/apply cleanup restored350/353hashes, with normalAuthDevice/AuthSessiontimestamp changes andDpop10→11 preserved. Android SystemUI ANR guardedWait and cold-start unreadable UIAutomator XML refusal are qualified, not app failures; fresh current hierarchy recovered the same caller. Sixteen PNGs reviewed.
- [#1451](https://github.com/WangPantopus/skinny-pantopus/pull/1451) Android source-card stripe `5106f39e498519a29c4e78f1c5355461c8999aa3` opened/attached after actual rehashed05d retained task caller→whitecard/narroworangeleadingstripe and sourceAPI/DB/backlink/pending match. Three existing goldens refreshed/visually reviewed; exacttopicassemble/3focusedPaparazziverifications pass0errors/skips/failures. ExistingVM/testsources unchanged relative acceptedc96; fullframe fixture defaults vs actual launch-disabled chrome are qualified. Fresh immutable [after README](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20261002-stream4-source-card-afters-r1/README.md),21files, MANIFEST `f158985e8daa29a0a71aa0a3af7d1d79b7cf2a7892e3c12cab06be948cdd5843`; actual orange/iOSwhite before `746708c…`. Separate5rowcleanup restores353/353; noMarkdone/source-link/provider claim.
- Clean shared-window handback03:59:58: ownslots2/3released after bothS34Shutdown, Android91351/ADB5562 andiOSdriver22093/87588absent; runtimelease released, proxyfaults0, backend99011healthy at freshly fetchedmaster `886b61c72902d8ddea90073aeba0863250ca170b`. Receipt kit/runtime/s4-maintenance-stripe-clean-handback.json. Wrapper removes holder.json on release; initial receiptpackaging assumption corrected using actual successful release JSON/priorreadyproof, no reacquire. S3 owns nextwindow and acknowledges actual immutable05d/source bindings for its own existing invitation cases.
- Distinct reproduced iOS due-day mismatch: detail/API/DBNov1, EditpickerOct31. Existing performed-date picker already usesUTC; smallest newtopic applies the same environment only to nextdue picker. Pushed `8fd192e8d35089c534c45902b6c3fd8d81b68ba3`, focusedSwiftformat/strictlint0; private single-commit nativejoint3a4d76cad4a9f4ae120f7055e22ad38280afde60 is frozen. Date r1pendingbuilder97048/waiter97067 parked/143 beforeheavyacquisition; actual reconstructedheavy-slot is direct30s waiting, not historicalFIFO. After S3 corrected76a Ownersr3 explicitly acquired04:03:31, date r2waiter relaunched with peer coordination. No nativeafter/PR yet.
- Mail Day settings `ef29626296dd64d9fc614728db842206eae076c9` is already built/pushed with31backend/Swift/ESLint/TSC checks; after realclock synthetic push-timezone/job/web/native evidence remains pending, and PR will remain separate. All3newPRs/head/seals handed to S1; remoteCI running, no completedCI claim. Continue independent retained U05 checks; no blanket release closure. Founder reiterates autonomous completion and final named boundary/access requirements when all self-service work is exhausted.

### 2026-10-02T02:50:46Z — MailTask merged; four focused topics pushed, Maintenance checks passed

- [#1444](https://github.com/WangPantopus/skinny-pantopus/pull/1444) merged unchanged at original `d378fee78fba2ddb9f969e0dc41d5f5d2074cb74`, merge `a4fe8a2a407f2711d134774a45d3595818cedb89` (2026-10-02T02:25:27Z). CI now completed successfully; bounded real-app seal/evidence and its limitations remain below. No broad product acceptance inferred.
- User asked about separate PRs for the source card, Mail Day settings, Maintenance notes and reminder guard. Decision: four separate topic PRs after their real after evidence, cleanup and seals. Correct branch names are `claude/stream4-maintenance-notes` and `claude/stream4-maintenance-reminder-flag`; original pushed heads above remain frozen.
- Corrected Maintenance checks joint `ad0cd840b15521870988903a7c731bc2325290df`: Android assemble,ktlint,detekt,47 units and8 snapshots passed. Earlier cf3 ktlint failure was only three existing-test formatting issues; corrected original-topic heads `03b73830de9c5b3eddf29fdf758679a9784feae5` / `81d855b9d52f814d856eee649902ac8e65161b54`. Application blobs and APK identical across cf3→ad0; reuse completed cf3 iOS build-for-testing. No real after/cold-clear or iOS Maintenance test execution claim yet.
- Mail Day settings head `ef29626296dd64d9fc614728db842206eae076c9`: backend31/31 and Swift checks passed; changed web ESLint0 and completed whole-web TSC0 using explicit current-workspace exports/existing local dependency types. Earlier dependency-resolution failures are retained privately and not counted as passes. Existing 9–20 push window, quiet hours, cooldown and atomic claim preserved; strict changed-time validation caps new choices19:45. Android has no settings UI for this topic. Real native/web/job afters remain pending.
- Private joint `05d7fff706bcc916f12035cd97851860230d1066` has Maintenance+settings+source-stripe single-commit integration; both-native build queued through heavy wrapper, private cache, source frozen. Fresh-master backend joint `6dd4174e00eddf5d910b25ef08ee8bf2bd2427a2` (base `efa4cadab857d088d8c89857dedfc38eb6ec4034`) passed62/62 in existing Maintenance/MailDay suites. It is prepared only, not running on shared runtime.
- S3 continues its bounded runtime/device ownership before journeys; S4 requested next clean window for Maintenance afters, S1 agreed. No S4 fixtures or fault rules. Next real paths: both native retained callers→save with notes/due→process cold→clear notes→process cold→GET/DB and zero hidden calendar events; exact ownership cleanup. Source-card three existing affected goldens/device after and settings real-clock after follow.

### 2026-10-02T02:19:21Z — MailTask native before/after sealed, #1444 queued; Mail Day early-send reproduced

- [#1444](https://github.com/WangPantopus/skinny-pantopus/pull/1444) opened at exact originald378fee78fba2ddb9f969e0dc41d5f5d2074cb74, no source change since handoff. Fresh both-native actual deep-link before→c96after→processcold: all five unfinished controls hidden, Markdone/source content retained; source-task POST200/GET200/APIpending=DBopen/backlinkstable. Immutable `20261002-stream4-mailtask-controls-r1`,42files, MANIFEST `746708c00653a03a78546d91e67b790c9e3271f5ab81fa89f46bfc85fb7c7811`; six topic files equalc96. Reuse source-bound iOS build-for-testing,Androidassemble/ktlint/detekt22units+9snapshots; no iOSMailTaskunits/audio-screenreader claim. Exact5rowcleanup,350business hashes restored/3nativeauthentication-table changes preserved. Historicalr3missingbytesqualified; freshbeforeindependent. Handed head/seal toS1.
- Separate actual real-clock MailDay BEFORE: API saved19:45 at19:05LA, actualjob claimed/notified at19:06LA, effectivepushTZfallbackLA/noUserNotificationPreferences. Generic local Notification/session persisted early; providerdisabled/egressguarded, actualweb+iOSsettings frames show inertgroups. Immutable `20261002-stream4-mailday-settings-before-r2`,29files, MANIFEST `6e4e2bd53c8d3992847587796036c770a4b65c3bd7187602dfedefeb715f4b1f`. Eight runtime/masterbindings; installedc96Settings view/VMsections equal with inherited#1406whole-filedifferences disclosed. Preliminaryr1seal was preserved unedited after whole-fileequalityrefusal; complete scopedr2 is authoritative. Exact13rowcleanup353/353 restored. Repair branch `claude/stream4-mailday-settings-time` starts currentmaster5c86; implementation/after pending. Decision: not-before in existingpushTZ, preservequietwindow/cooldown/atomicclaim, hideinertgroups/timezone, keepnativeclockcardread-only with honestwebedit explanation. No generalnotificationhelper/newstore needed.
- Runtime/devices released02:11:27Z: backend healthy fetchedmaster5c86c4c563cf214d5e68c6a1ce58c4fb238fdd79 PID70409, nofixtures/faultchanges. Exact iOS696C shutdown and emulator5562/PID62634 exited; immutablec96 apps retained/sharedcheckout/cache unchanged. S3 independently acceptedhandback and acquiredits Android-first ownership window02:14:36Z. Nativeauthentication history remains preserved.
- Maintenance cf3 iOSbuild-for-testing+Androidassemble succeeded; requiredAndroidchecks stopped on3ktlint testblankline violations. Fixedonlyexistingtestformatting: finalguardhead81d855b9d52f814d856eee649902ac8e65161b54; finalnoteshead03b73830de9c5b3eddf29fdf758679a9784feae5. FocusedSwiftformat/lintpass,31backendtests sourcebound. Exactad0cd840b15521870988903a7c731bc2325290df Android-onlychecks queued/frozenbehindS1candidate34; no unit/snapshotpassyet. Appfiles cf3→ad0unchanged; no duplicateiOSbuild queued. Maintenance actualafter/PRs pending nextboundedS4window.
- Android source-mailcard solidorange independently reproduced in bothbefore/c96frames; iOSwhitecard+leadingstripe and existingAndroidcomment establish intended4dpaccent. Separateone-file `claude/stream4-source-mail-stripe` exacteea51044c14c49a5c59eb9bc6c552463eaec97a6 constrains existingoverlaymeasurement only; pushed/build/snapshots/deviceafter/PRpending. Noadjacentcardrestyle.
- Userreadiness estimate remains weighted~75% (70–80range), notformalrowclosure. U05 dispositions/settings/remainingnativeafters/provider-staginglimits stayopen. Next: answer#1444review; existingMailDayjob/settingsrepair and focusedchecks whileS3ownsdevices; correctedMaintenancechecks→realafter/clear-note→twoPRs; sourcecardgoldens/deviceafter; continueallretainedU05.

### 2026-10-02T01:25:44Z — Sol continuation; private Maintenance build and focused Swift gates

- User requested GPT-6.1 Sol at Extra High; current session metadata confirms `gpt-6.1-sol` / `xhigh`, same task/session and checkpoint. No new task or duplicate work.
- Latest pushed topic heads: reminder guard `81d855b9d52f814d856eee649902ac8e65161b54`; notes `a0b5d8cb7faaec71cedaa0e0097be5629618310e`. Advances from8dad/19917 affect only existing iOS regression-test formatting. All application implementations are unchanged. Focused SwiftFormat/strictSwiftLint pass on2guard and5notes files; receipts/test-only bindings prepared in unsealed `stream4-maintenance-afters-r1`. Existing backend31/31 remains source-bound.
- Reserved heavy acquired at2026-10-02T01:11:43Z for exact approved joint `cf3d349887d23a6e35a01352df3b6cc27004c06c`, built through the kit from the clean PRIVATE `stream4-native-mailtask` checkout/default private cache. iOS test-build is in progress, then Android assemble/ktlint/detekt/Maintenance unit/snapshot checks. No build pass claimed yet. Shared native checkout/cache remainsc96 unchanged; S3 retains runtime/devices while completing its recovered Android case, then S4 has the agreed next window. S1 candidate34 follows S4 heavy release.
- User-facing launch planning estimate: about75% ready (70–80range) for retained Stream4 scope, weighted judgment rather than formal row closure. Remaining U05 actions, native afters/PRs and named staging/provider/media boundaries remain open; no release acceptance inferred from this estimate.
- Next: MailTask d378 actual native afters/cleanup/seal/PR using immutablec96; repaired Maintenance caller/cold/clear-note afters with zero calendar events and exact cleanup; separate topic PRs; remaining U05/settings. Prepared observers/clear-note operators are unrun.

### 2026-10-02T00:45:40Z — Joint MailTask build passed; Maintenance repair heads pushed, afters pending

- S34 c96-r2 completed exit0: iOS build-for-testing, Android assemble,ktlint,detekt,22MailTask unit tests and9MailTask snapshots. Safe copied-product metadata is in the unrun `stream4-mailtask-native-successor-r1` stage. iOS code includes a debug dylib and every code-product hash is recorded; Android APK `eebb7dd56710976f5604152ac41ecbc0ccc670a9785921cd2ec287e55d8dda34`. S3 independently ran its existing3iOS recovery tests and verified installed products before returning the clean native checkout/cache. S3 still owns runtime/devices for its afters; S4 MailTask afters/PR remain pending.
- Pushed guard head `8dad481d47afbc47880d2243f9ce6287c164ede5`, branch `claude/stream4-maintenance-reminder-flag`, reusing parked7f492 through single commit1f0d68c03 plus Android/off-only-test correction8dad481d4. Pushed notes head `19917a5ac51a46e9d1e6c52322b16cb205169e34`, branch `claude/stream4-maintenance-notes`,13existing files, no schema/new store. Notes use the existing column and create/edit/read contracts; omitted edits preserve server text, blank clears, repeated keyed create cannot replace notes, and reopened values ignore stale local draft notes. Optional4000-character text validation follows existing Home notes convention.
- Notes backend existing actual-HTTP/mocked-database suite31/31passes with LAUNCH_FEATURES=none. An initial runner used the repository root and failed Express mock resolution before tests; backend-directory rerun passed. Native tests/device afters for both repairs remain unrun. No PR/acceptance claim yet.
- Private integration `cf3d349887d23a6e35a01352df3b6cc27004c06c` is exactly c96 plus three single cherry-picks;4combined guard files reviewed against original notes head,9other files byte-equal. Prepared `stream4-maintenance-afters-r1` contains decision/source binding/test summary only, no fixture/baseline. S1 has the exact heads/composition and next build will queue after its R3; shared source switch waits for runtime ownership to satisfy the lease rule.

### 2026-10-02T00:31:20Z — Maintenance native before sealed; exact clean handback to Stream 3

- Both real Home-profile Maintenance tiles are reachable. Each native next-due save made an unintended calendar POST/row with launch extras off; both notes appeared warm, were null in API/DB, and disappeared after cold restart. No cut-feature interior opened.
- Fresh immutable `20261002-stream4-maintenance-before-r1`,45files, MANIFEST `494d976e0d72fe4d0381037a24e5efb58a36b3ba60f59101df707ac26b946cee`. The installed baseline ecd8 products match retained hashes;24 relevant source files match backend6c7; shared-route mail-only differences are recorded. This is before evidence, not repair acceptance. iOS baseline has no debug dylib.
- Exact cleanup dry-run/apply:2maintenance+2calendar+2audit+1occupancy+1home=8rows;353/353 public-table fingerprints restored, no faults. Both S34 devices verified shut down before slots/lease release00:29:17Z. Backend healthy on master a39b5b53c; S3 acquired its bounded window after handback.
- Decision: revive parked iOS guard7f492 and Android equivalent on current-master `claude/stream4-maintenance-reminder-flag`; existing tests must verify launch-flags-off next-due persistence/no event, not enable cut features. Notes persistence is a separate topic using the existing column and contracts. Source edits started, native repair acceptance pending.
- Shared c96-r2 iOS build-for-testing and Android assemble succeeded; requested MailTask checks still running. Build products and cache remain frozen for S3’s own existing regressions, then S4’s mailtask afters. No mailtask fixture or new PR yet.

- **2026-10-01T23:46:22Z — #1406/#1410 merged; joint native test-product build in progress.** GitHub confirms both original heads merged unchanged at2026-10-01T23:42:38Z in Stream1 batch323/#1432. Merge commits `a1c1a2b7b07bfa2dc0d4d7543fd19dacfb08532c` / `96280202270d873fe3aece8598ae3c366065c7cf`; fetched master `6c7e0ed582fb3dca9f3479a286601a9ae39b6bff`. Stream1 independently verified both six-file source addenda and explicitly accepted the historical native scope/missing-byte disclosure; no new native run is claimed for these merges.
  - Stream3 returned native checkout/cache after its bounded checks exited0. S4 froze shared `s3-native-e5` at approved joint `c96b6fc60aa1a2e77ce2d6d6bc454caaa4c5e139` on `claude/stream4-s34-mailtask-build`; its three original S3 files and six mailtask files match their source heads. Build request uses S34 origins, iOS build-for-testing (retain test products for S3), Android assemble/ktlint/detekt/MailTask unit/Paparazzi. No installs yet.
  - First test-product build stopped before compilation, exit65: copied `toolchains/bin/xcodegen`2.46 could not locate SettingPresets and generated empty test product names. The complete local distribution already contains the presets. Reconstructed kit wrapper now invokes `toolchains/xcodegen-dist/xcodegen/bin/xcodegen`, refuses missing-settings warnings, and retries in fresh `stream4-build-mailtask-joint-c96-r2`. Operator configuration repair only; source unchanged. Both peers notified; previous baseline configuration limits must remain disclosed.
  - S3 still holds runtime/devices while finishing exact Android cleanup. S4 prepared source-only stage declarations and guarded operators, not new acceptance. Next: native Maintenance actual caller and calendar-write before; mailtask native afters/PR; remaining U05/settings.

- **2026-10-01T23:23:41Z — #1406/#1410 source-binding acceptance addenda delivered to Stream1.** Exact fetched heads remain `68eba752229507102bcdec1f98085e84dea0ae32` / `360f2fb02ee56aa7377f6a1f93b3667eb345c0df`, master `559525394f3d07b818b6415782e48c10a0674e0a`. Fresh immutable six-file bundles `20261001-stream4-mailday-source-binding-r1` (MANIFEST `a3333b2f2b805decec843e0217d75e2385880e5962f4c90c7bd054af3c32cb50`) and `20261001-stream4-flaggaps-source-binding-r1` (`1c82d719f2bb2034b57e6708d1c4879f9e6025245b203a9ebb936384f6c643f7`) pass secret scan and archived-file rehash. They bind accepted historical native behavior to current heads and compiled candidate32, explicitly disclosing unavailable original audit bytes and no new native/device/API/DB run. #1406 has five/six files identical to candidate32; #1410 seventeen/eighteen; the shared Android host differences are exactly the other PR. **Correction to the older shorthand:** historical #1406 b5→head includes inherited #1375 VM live-error handling as well as two preview arguments; callback behavior is unchanged. [1406 addendum](https://github.com/WangPantopus/skinny-pantopus/pull/1406#issuecomment-5942594498), [1410 addendum](https://github.com/WangPantopus/skinny-pantopus/pull/1410#issuecomment-5942594776). Stream1 reports both candidate32/33 compiles pass; remaining candidate33 checks are separate. Stream3 keeps runtime/devices and temporarily retakes its unchanged b2b7a2d59 native cache for bounded regressions. Next: native Maintenance before and mailtask afters when S3 hands back; U05/settings remain partial.

- **2026-10-01T23:07:02Z — U05 per-item dispositions reconciled with merged repairs.** Marked the three existing source rows for #1420/#1422/#1424 with their bounded real acceptance, exact heads/seals and cleanup limits. Added the nonempty Memory `mail_items`/`mail_ids` render prerequisite to its existing row (source-only, no new runtime claim). Task-card cut-entry repair is pushed without a PR at `66ae082450b64b2152204b1c074b0d3109e97878`, including current master `559525394f3d07b818b6415782e48c10a0674e0a`; PR diff is one line, lint/diff check pass, native entry and afters pending. S34 baseline native builds/ktlint/detekt passed at `ecd8a3d90d0ddcee32d72cc8cf25086ca9ece33a`, heavy released22:54:07Z; S1 candidate33 now owns heavy. S3 retains its Android case lease and will explicitly hand back runtime, shut-down devices and cache. S4 has not taken a new runtime/device window.

- **2026-10-01T22:38:44Z — #1424 merged unchanged; S34 mailtask build preparation and scheduling decision.**
  - Stream1 batch321 [#1427](https://github.com/WangPantopus/skinny-pantopus/pull/1427) merged [#1424](https://github.com/WangPantopus/skinny-pantopus/pull/1424), exact head `6e014a3b222bbbfb1b87ad3efa50dfa311b4b67e`, merge commit `38a776f5684c9f2a371cb007e991f5453d0702d5`. Master `a2c2ba6d76675681c11738a09f407f6a10fa4169`. S1 independently reviewed the35file seal `b58357d9789348adeb7adb23f97a4b3e19fb60e882bb29d814a04e215fcd9eaa`, exact source and bounded real-browser/API/DB evidence; both retained authentication setup deltas remain disclosed. #1420/#1422 were already merged in batch320.
  - Mailtask candidate33 `b66e1fb3742d2034e159f90582f66fc4b646c795` contains both original dock/header commits. All six changed files match original branch head `d378fee78fba2ddb9f969e0dc41d5f5d2074cb74` byte-for-byte. Isolated S4 native worktree is frozen at that candidate; reconstructed `tools/build-s4-native.sh` preserves S34 endpoints, empty cut flags, Keychain signing validation, >10GiB disk guard and the heavy slot. **Prepared only; not started or accepted.** S1 candidate33 is already queued after S3, so S4 will run afterward. No S1-origin app is installed against S34 credentials.
  - Web task-card gig entry has a one-line existing-flag guard prepared on `claude/stream4-mail-task-gig-entry` from `556c4e506`; existing-page ESLint and diff check pass. Real before is in the sealed task-source bundle; fresh after and native entry verification remain outstanding. No cut interior was opened.
  - Mail Day decision refined: honor `delivery_time` as a precise not-before threshold in the push's effective notification timezone, preserving09:00–20:00 window/quiet hours/enabled/cooldown. Newly saved times must be no later than19:45 (the final scheduled quarter-hour); existing later times get clear validation rather than silent changes. Keep08:00 default (09:00 floor still honors it), disclose the window, hide inert settings, add no Android settings screen. Real local job runner prepared with external-network guard and provider delivery disabled; reproduction/implementation remain pending.
  - S3 retains runtime/device/driver ownership. S4 has no running fixture, fault or device probe. **Next:** native baseline checks after handback; mailtask afters/seal/PR, then the remaining U05/settings work. No release-wide closure claimed.

- **2026-10-01T22:19:57Z — Merge milestone.** GitHub confirms #1420 and #1422 **merged unchanged** at2026-10-01T22:17:16Z in batch320/#1425. Fresh fetched master `556c4e506a789a3e9188a866d5da271c8462993b`; merge commits `b4253e055d222f75a7d02f64e94a7d53173a3aa1` / `4f287a23f09bf9810840ea6adae558434d1cbe47`. S1 independently rehashed26/30manifestfiles and reviewed source/CI/browser evidence. #1424 remainsqueued. #1406/#1410 combined nativebuilds passed, S1deviceviews pending safe login. S3owns runtime/device for firstbaseline nativewindow; S4holds no slots/fixtures. Preparing separate mailtaskgig-entry guard from currentmaster using newly sealed webbefore; nativebefore/after remainsrequired.

### 2026-10-01T22:17:45Z — U05 New from mail source repaired; #1424 queued

- [#1424](https://github.com/WangPantopus/skinny-pantopus/pull/1424), exact origin `6e014a3b222bbbfb1b87ad3efa50dfa311b4b67e`, base `42a91cbf972bd451408c5034a3a30560641c9e2a`: real existing New from mail form submitted emptyrequiredmailId→400 and no form error. Existing LinkedMail area now chooses recent received personal/home/business mail (up to50each, other-Home rows filtered), requires source, and uses existing toast on save failure. Preserves form/API/DB contract, no new file/service/schema. Real source200/forced503 visibleerror+draft/retryPOST200/reload200/DBcanonicaltask-source-backlink-audit; readR1Retry/R2empty/phone390×844/Cancel pass. Targeted lint/diffcheck pass.
- Fresh immutable bundle `20261001-stream4-tasks-create-r1`, README/MANIFEST **`b58357d9789348adeb7adb23f97a4b3e19fb60e882bb29d814a04e215fcd9eaa`**,35files clean scan/rehashed. Dry-run+exact14application rows removed; **351non-authpublictable fingerprints equal**. Browser owner session expired401 before afters; existing private UIlogin renewed200 without sign-in raster. AuthSession and AuthSecurityEvent each1→2 retained as shared setup, agreedwithS3; auth schema outside projection. Never claim353equality for thiswindow. d317clean42a91, no fixtures/faults/devices; lease released22:14:23Z toS3nativeE5.
- Additional actual U05finding: web active TaskCard exposes “Task”→gig entry with openGigs off (cropped known-cut-entry-before.png); **notinvoked**, separateentryguard topic together with native equivalent. Native #1406/#1410 candidate32bothcompiled (S1), fresh1410webseal independentlyreverified22files. S3masteriOSbaselinecompiling/Androidfollows; S1mailtasktwo-commitdelta follows. S4private API fixture setup prepared (unrun) for fresh native task before/after; generic S34 secret driversownedbyS3. Next: nativeMaintenance/mailtask after S3window, then settingshonesty and remainingU05.

### 2026-10-01T21:54:34Z — U05 web Mail Day Dismiss: verified repair #1422

- [#1422](https://github.com/WangPantopus/skinny-pantopus/pull/1422), exact origin `d82f7f76e2f0c97fd76bcc101599d59702ac86f4`, fixes real current-master Dismiss→reload restoring a summary after “Check back tomorrow.” Reuses the existing local-day storage rule inside existing MailboxContext state; layout banner and page share it. No new application file/design/API/schema. Actual Chrome before/after: reload/navigation persistence, stale-day return, page→banner and banner→page dismissal with an owned received notice; real APIs200 and independent notice unread/unarchived DB state. Targeted ESLint/diff check passed.
- Fresh immutable `20261001-stream4-mailday-dismiss-r1` README/MANIFEST under sibling audits, **`512d105b8ed2557d86ac4566289e88232391328cb12872b1cf1c734a4be12bc5`**,30files rehashed; exact18row cleanup/all353publictables equal. Auth schema outside projection; no native/provider/cross-tab live/mounted-midnight timer claim. d317cleanmaster `ecd8a3d90`, lease released21:52:20Z, no faults/devices/fixtures. SentStream1.
- S3 master native build acquired heavy21:51:49Z after S1candidate32; S34 generic focus-guarded login primitives prepared byS3, not yet device-tested. No duplicate native build queued byS4. Next still native mailtask+Maintenance after baseline availability; retained web U05 continues meanwhile.

### 2026-10-01T21:44:35Z — U05 Records phone form: verified repair #1420

- On current master `ecd8a3d90d0ddcee32d72cc8cf25086ca9ece33a`, actual Chrome390×844 Add asset manually mounted an invisible form. [#1420](https://github.com/WangPantopus/skinny-pantopus/pull/1420), exact origin head `48f7eb725102aa0170a480e36f38ee9ea22a7a2f`, changes two existing responsive visibility classes; preserves form/API/styling and desktop columns. Phone visible form/Cancel/actualPOST201/fullreloadGET200/independentDB fields pass; desktop1280×1000 columns/Cancel pass. Existing-page ESLint and diff check pass. Sent to Stream1 queue.
- Fresh immutable bundle `20261001-stream4-records-phone-r1` under the kit sibling audits directory: README and MANIFEST, **`3713ecfa381fa3279ab5c557877f58a806186759930751674e110a17c0124b6d`**,26manifestfiles, scanner clean and copied bytes rehashed. Actual masked browser frames; no native/provider claim. Narrow cleanup tool gained explicit --records owned-home mode; dry-run/count/owner/key/full-rowMD5 guarded18rows removed, all353publictables exactly baseline (auth schema outside projection). d317 clean master; lease released21:42:05Z to Stream3, no devices/faults.
- Remaining: #1406/#1410 with Stream1 nativecandidate32; mailtask dock+header native build/after seal/PR; native Maintenance first once S34 build/device available. Continue retained-web U05 cases between windows. 42source dispositions remain qualified; U05 not blanket closed.

- **2026-10-01T21:19:12Z — Fresh #1410 browser boundary PASS; exact cleanup, seal and queue handoff.**
  - Lease 21:12:46Z–21:17:40Z; no native/device slot. Runtime d317 advanced cleanly to master `ecd8a3d90d0ddcee32d72cc8cf25086ca9ece33a`; backend bytes unchanged. Exact three web files from PR head `360f2fb02ee56aa7377f6a1f93b3667eb345c0df` overlaid for afters, then restored to clean master.
  - Real Chrome/API: the API returns all four drawers in both runs. Master shows Earn and Earn Wallet and an Earn Vault-folder option; candidate hides them, preserving Vault/Tasks/Records/Mail Day/Stamps & Themes/Travel Mode. Both signed-in Earn paths give 307 to Place without following redirects. No cut feature UI exercised; external requests and Wallet creation guarded. Four cropped frames visually checked, no account labels or sign-in rasters.
  - GET side effects were exactly 2 owner `mailday_summary_viewed` MailEvents, 1 MailPreferences and 14 system VaultFolders. Narrow reconstructed `tools/s4-cleanup-home.py` used dry-run, exact owner/key/full-row MD5 guards, then transaction locks. **353/353 public table fingerprints equal baseline**; auth schema excluded. No Home fixtures, proxy rules or source edits remain.
  - New immutable bundle: `20261001-stream4-flaggaps-web-successor-r1`, [README](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20261001-stream4-flaggaps-web-successor-r1/README.md). MANIFEST SHA256 `e26229cf4e8f6ff1f24fe90179f7aa8f777c52c96d64a924192afe62f50c41ce` (22 files, scan clean, copied archive rehashed). Sent to Stream 1; [PR evidence comment](https://github.com/WangPantopus/skinny-pantopus/pull/1410#issuecomment-5940796150). This is fresh **web-only** proof; r2/r4 remain historical and native/provider acceptance is not inferred.
  - Runtime returned to Stream 3 for Home rename; `README-successor-20261001.md` documents the rebuilt contracts and private files. The new cleanup helper deliberately supports only empty-baseline browser effects, not general Home fixtures. **Next:** native mail-task afters/seal/PR once the build is ready, then first native U05 maintenance check; continue retained web U05 on the next shared window.

- **2026-10-01T21:07:59Z — Fresh runtime recovery progress and seven further U05 source dispositions.** Master is `cb02fef0827d8a6f895eba9bbaee42cee70a6aed`. Stream 3 reports the new isolated backend/proxy/web healthy at canonical `f88f74641f019e35bcdba24d71ccec38ce5b0d8e` after 128 migrations and a 353-table pre-fixture baseline, and retains its reconstruction lease for synthetic auth and Home cases. Stream 1 restored heavy/device tools and is building candidate 32 (`168d9ae251f87cc31e98523d75f32c60e50839f0`) with #1406/#1410; mail-task delta follows that build. Stream 4 installed locked web/backend dependencies for reuse and prepared the narrow real-browser #1410 boundary probe in private temporary tooling; no runtime/device/API/DB run or new seal yet. The additional source table corrects the pickup false positive (the card uses its confirmed server response), preserves disclosed permit placeholders and the accepted benchmark boundary, and identifies empty emergency Share, phone Records Add asset and day-dismissal cases for runtime verification. **Next:** take the Home lease after Stream 3's handback, capture master/#1410 browser evidence, clean and seal; then native mail-task afters. Original audit bytes remain missing; historical seals are not re-created from metadata.

- **2026-10-01T20:50:54Z — Successor takeover; current PR checks, missing-runtime boundary and U05 source reconciliation.**
  - Session title set exactly as requested; Stream 1 and Stream 3 successor chats contacted. Coordination fetched and fast-forward checked at `964191bc42b79b33394b5896aa8535f0107fe80c`. The assigned application worktree was clean on master; it now tracks the existing mail-task-stubs branch unchanged.
  - **Queue:** #1406 head `68eba752229507102bcdec1f98085e84dea0ae32` and #1410 head `360f2fb02ee56aa7377f6a1f93b3667eb345c0df` are OPEN/MERGEABLE. No submitted or inline reviews need answers. Both iOS build and Android lint/test/assemble jobs succeeded ([1406 run](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36901476901), [1410 run](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36902783102)); #1410's recorded emulator infrastructure failure and queued iOS jobs remain named. Stream 1 has the updated checks and owns integration.
  - **Source compatibility:** `git merge-tree --write-tree` succeeds for each of #1406, #1410 and mail-task-stubs against current master. The mail-task diff passes `git diff --check`. These are source checks only, not app builds.
  - **Historical evidence:** r3 MANIFEST `c685c3a80698991563453aca3896ab32bdbca1a943e7d150d71ef15167c0ceb9`; r2 `35b44f01f45babfbac80acf41a22b97f6bb7860a9394207e4365b81d8c126682`; r4 `ce96a419a33fb32cd6e7a9e26faf6261d2420bad265b8003fed7c6a886eddfb7`, as recorded in the existing PRs. Original audit files and kit README are absent with `estimate-rescue`; no fresh hash/seal claim.
  - **Runtime:** no lease, slots, device run, backend restart, fault or fixture was used. Stream 3 is the sole reconstruction owner for the original Home kit and ports 64553/64554/18142/18143/18144. Wait for its recovered exclusive lease before runtime actions. Stream 1 owns native prerequisites and shared slot tools; do not build or boot before they are published.
  - **U05:** 35 source dispositions added in the existing U05 section. Key corrections: profile-cover Maintenance is reachable in source; Android also posts calendar reminders; web Memory does call memory/dismiss; HomeMaintenanceLog already has notes/document_id; document kebab opens View and is not a dead action. No application edits, new tables, migrations, services, screens or tracking system.
  - **Decision:** Mail Day delivery time should be a not-before threshold in the push's effective timezone, retaining enabled/quiet-hours/cooldown and truthful send-window validation; hide inert settings in existing clients. Android currently exposes no settings UI, so none is added. Implementation and E2E remain outstanding.
  - **Next:** Stream 1 requested minimal fresh #1410 browser flag evidence after runtime recovery. Then finish mail-task header afters and seal/PR, reproduce Maintenance first for U05, and continue the bounded per-topic repairs. Existing accepted journeys and cut exclusions remain intact.

- **2026-10-01T17:59:59Z — Merge status of #1406 and #1410 after the handoff (for the next session).**
  - **Stream 1 reviewed both** and proved their seal moves:
    - #1406's r3 seal records `b5f2be447`, an ancestor of head `68eba7522`. The only differences are the two `#Preview`
      calls.
    - #1410's r4 seal verifies at the head; r2 covers `f431deec2`; since then only RootTabScreen.kt changed (+2, the
      placeholder titles).
  - **They merge together** once CI's iOS build and Android "Lint, test, assemble" pass for both. Nobody has compiled the
    merged preview edit or the combination yet.
  - **#1410's "android / Instrumented tests (emulator)" failure is infrastructure** (run 36902783102, job 110505841018).
    sdkmanager couldn't install `system-images;android-34;google_apis;x86_64` ("Error on ZipFile unknown archive"), so the
    emulator never booted and no test ran. Re-run that job once the run completes; Stream 1 has been told.
  - **Next:** if a build job fails, fix it on the PR branch and tell Stream 1.

- **2026-10-01T17:54:23Z — Handoff (user's request). Stream 4's state and the ordered next list are in the CURRENT RESUME at the top; the prompt is `NEXT-STREAM4-PROMPT-2026-10-01.md`.**
  - **Open with the queue owner:**
    - [#1406](https://github.com/WangPantopus/skinny-pantopus/pull/1406), Mail Day dead controls: head `68eba7522`; seal
      `20261001-stream4-mailday-controls-r3` (`c685c3a8…`).
    - [#1410](https://github.com/WangPantopus/skinny-pantopus/pull/1410), flag gaps: head `360f2fb02`; seals r2
      (`35b44f01…`) and `20261001-stream4-flaggaps-placeholder-r4` (`ce96a419…`). Android's cut-link placeholder now names
      "Earn" and "Package unboxing", not "Beacons".
  - **Pushed, not yet a PR:** `claude/stream4-mail-task-stubs` (`d378fee78`). It needs a build plus after frames for the
    header; the before evidence is in r3.
  - **New:** an agent-gathered U05 inventory,
    [`stream4-u05-inventory-draft-2026-10-01.md`](stream4-u05-inventory-draft-2026-10-01.md). **Unverified**: the next
    session checks each item on master before recording or fixing it.
  - **Runtime:**
    - The lease and slots are free. Windows r3 (17:24:54Z–17:41:24Z) and r4 (17:51:10Z–17:53Z) were cleaned exactly; r4
      changed no row.
    - The backend is on master `726510e65`, with no fault rules.
    - Both devices are shut down; the emulator has the master APK `215f6d747`.

- **2026-10-01T17:22:43Z — Window r2 sealed (`20261001-stream4-flaggaps-themes-r2`, MANIFEST `35b44f01…`, 369 files). #1375 rechecked; four new PRs with the queue owner.**
  - **Window:** 16:29:33Z–16:48:50Z and 17:07:44Z–17:19:24Z. Stream 3 held the runtime in between, for its TalkBack probe and
    Stream 1's race proofs (migration 20261001137000 stays applied, agreed).
    - Exact cleanup at 17:19:05Z: 349 of 353 tables equal the baseline; the other four are Auth* history.
    - The backend rests on master `726510e65`, fault rules are empty, and both devices are shut down.
  - **#1375 (iOS Mail Day error state), head `fe4d2a880`:**
    - 503×3 on today shows the error and Try again; Try again loads the real day.
    - A reviewed row's Undo reverts the letter and reopens the queue.
    - Commented on the PR.
  - **New PRs, all on this seal:**

    | PR | What | Evidence |
    |---|---|---|
    | [#1400](https://github.com/WangPantopus/skinny-pantopus/pull/1400) | Mail Day "personal" route with no match: on master the letter left every drawer list; it now stays with the household (Stream 1's follow-up a) | API |
    | [#1401](https://github.com/WangPantopus/skinny-pantopus/pull/1401) | Stamps themes Apply never worked: 400 "themeId must be a valid GUID", shown raw as an iOS toast. The `select('id')` behind it also gave a false success. Apply now works and persists | API, iOS, Android |
    | [#1402](https://github.com/WangPantopus/skinny-pantopus/pull/1402) | "Mail Day enabled" off now stops the Mail Day push. One-off job runs: master notified the owner with it off; the fix skips them; the on-control notifies | job |
    | [#1403](https://github.com/WangPantopus/skinny-pantopus/pull/1403) | A letter needing a call after the day's first read now joins today's Mail Day and the push, instead of waiting until tomorrow | API |

  - **Flag gaps (`claude/stream4-mail-flag-gaps`):** before/after passed on iOS, web and Android, with all-features controls.
    - The Android pass found that a cut Earn or unboxing link opened "Beacons isn't in the app yet". `launchCutLabel` fell
      through to its Beacon fallback.
    - Fixed in `360f2fb02`; the Android rebuild is queued. The PR opens with that frame.
  - **Built or building:** My Mail Day dead controls (`b5f2be447`) and the mail-task dock stubs (`9baca534a`); the combined
    build `s4-build-dc-mt` is in the heavy slot.
  - **Decided by Stream 4:**
    - The mail-task dock shows only "Mark done" on live tasks. Snooze, Delegate and Calendar have no backend; Calendar showed
      "Added to calendar" for nothing.
    - The sample design data keeps the chips, as the screen already does for its other slots with no backend.
  - **Found, not changed:**
    - **Mail Day settings beyond "enabled" do nothing on any client:** delivery time, timezone, include, interrupt, sound and
      haptics. Next: honor the delivery time and hide or define the rest.
    - **iOS reviewed rows:** each is one VoiceOver button whose label omits Undo.
    - **Unreachable with real data:** Android records mail's no-ops. Its layout needs payload keys the MailObject row never
      has.
    - **Issue rows on both apps:** no detail screen; their actions are in the row footer. Parity, no change.
    - **Web "Seed Inbox":** dev-only (`NODE_ENV`).
  - **U05:** a read-only inventory of every reachable action on this stream's screens (all three clients, release build) is
    being compiled for Stream 1's manifest.

- **2026-10-01T16:18:16Z — Three more branches, two decisions on Stream 1's Mail Day follow-ups, and new findings. Waiting on the runtime (Stream 3's lease since 15:23Z) and the build slot.**
  - **Flag gaps** (`claude/stream4-mail-flag-gaps`): master `215f6d747` is merged in, because the branch lacked #1374's
    collection-only Stamps; head `f431deec2`. The rebuild's iOS app is done (dylib `cb9d6af7…`); Android and an Android
    master "before" are building.
    - **Found while preparing evidence:** neither app ever shows the native package-tracking layout for real mail. Both
      decode tracking from `GET /api/mailbox/:id`'s `object`, which is the MailObject row, with no carrier or tracking
      keys. So the branch's package guard is parity with web, not a visible change. Package tracking is cut #7, so this is
      recorded for when #7 returns, not fixed.
  - **New branches (pushed; evidence in the next window):**
    - `claude/stream4-mailday-personal-fallback` (`322c55b2b`), Stream 1's follow-up (a): an explicit
      `drawer: personal` with no matched member keeps the letter with the household (it was private mail with no
      recipient).
    - `claude/stream4-themes-apply` (`217649ee7`): the Stamps Themes view's Apply never worked on either app.
      `themes/apply` validated `themeId` as a UUID, but theme ids are slugs (`autumn_2026`, migration 048), and it selected
      the nonexistent `MailDaySettings.id` with errors ignored ("Theme applied" with nothing saved). It now takes the
      slug, applies only an existing unlocked theme (404/403) and saves by `user_id`, as PATCH settings already does.
    - `claude/stream4-mailday-dead-controls` (`b5f2be447`, iOS + Android): My Mail Day's "Scan today's stack" (the
      empty day's main button), "Scan more mail", "See full history" and both setup nudges did nothing (hosts passed
      no-op "Out of scope" handlers), and the reminder nudge promised a 5:00 PM reminder that doesn't exist. Each control
      now shows only when its host gives it a destination (none does yet); the empty day says "No mail needs a call
      right now." Build queued.
  - **Decided by Stream 4:**
    - **Exact Undo (Stream 1's follow-up b): no migration.** Only Mail Day's route writes `routing_method` and
      `routing_confidence`, and nothing reads them except Undo's own guard. Undo already restores everything a user sees:
      the letter is household-shared, unassigned and back in the queue.
    - **`POST /memory/dismiss` stays as is.** It is broken (the UUID validator rejects the `otd-…` ids and it writes a
      `reference_id` column that doesn't exist), but no client calls it.
    - **My Mail Day hides controls that have no destination** rather than getting new scanner, history or setup screens.
  - **Found, not changed:**
    - **Mail Day settings are inert.** Nothing outside the settings routes reads `MailDaySettings`; the Mail Day push
      follows `UserNotificationPreferences` (timezone, quiet hours, the mail-summary type). Turning Mail Day off doesn't
      stop its push. Next: honor `enabled` in the job, or hide the rows that do nothing.
    - **Opening Earn creates a wallet.** `GET /api/wallet` runs `getOrCreateWallet`, so a fixture that opens Earn
      creates a Wallet row; my window fault-injects that read instead.
  - **Next, in the runtime window (run sheet ready):**
    - the #1375 recheck;
    - flag-gap before/after on both apps;
    - themes and personal-fallback API probes plus devices;
    - dead-controls before/after once built.

- **2026-10-01T15:39:03Z — Merges, #1375 work, and a re-triage of Phase-3 mail drift now that Mail Day, Stamps, themes and Mail Memory stay in launch scope.**
  - **Merged:** [#1372](https://github.com/WangPantopus/skinny-pantopus/pull/1372) (batch 304) and #1373 + #1374 (batch 305), so
    master is `215f6d747`.
  - **[#1375](https://github.com/WangPantopus/skinny-pantopus/pull/1375):**
    - master is merged in, giving head `fe4d2a880`, as Stream 1 asked;
    - strict lint passes;
    - the iOS build is running, then a device recheck (error state plus a reviewed row's Undo) and a re-seal.
  - **Earn/package/Stamps-header branch** (`claude/stream4-mail-flag-gaps`, `828f61761`):
    - the feature-flags session has no objection;
    - its guide (`docs/launch-scope-flags-2026-10-01.md`) gets the matching rows and calls 9 and 12 in the same PR.
  - **Re-triage of Stream 5's 11:10Z drift hits in `mailboxV2Phase3.js` against master** (my 11:10Z entry had dismissed them as
    cut #8):
    - **`Mail.sender_name` / `delivered_at`:** already fixed on master.
    - **`POST /themes/apply`:** selects `MailDaySettings.id`, a column that doesn't exist, and ignores the error. So once a
      settings row exists, applying a theme answers "Theme applied" and changes nothing. Candidate, to verify on the API.
    - **`POST /memory/dismiss`:** upserts `MailMemory.reference_id`, which doesn't exist, without the NOT NULL `headline` and
      `reference_date`. A dismissed memory never persists, and on-this-day reads `reference_id` too. Candidate, to verify.
    - **`MailPackage.recipient_user_id`:** package tracking, which is cut #7.
  - **Mail Day follow-ups from Stream 1's review (next Mail Day PR):**
    - an explicit `drawer: personal` with no match should fall back to home;
    - undo should restore the letter's exact prior state, which it would need to record at route time.

- **2026-10-01T15:26:02Z — Four PRs are with the queue owner. Seal `20261001-stream4-flags-mailday-r1` (`eb58ee9a…`), window 14:46:35Z–15:23:06Z, S34 pair and API/SQL, launch features off.**
  - **[#1372](https://github.com/WangPantopus/skinny-pantopus/pull/1372) (privacy, merge first):** Mail Day "Route to <name>"
    made a household letter the triager's private mail.
    - Before: member B (the addressee and the router's match) got 403 after the owner routed it, through the API and through
      an iOS tap.
    - Now it goes to the matched occupant, or with no match to the shared household drawer with a "Household" chip.
  - **[#1373](https://github.com/WangPantopus/skinny-pantopus/pull/1373) (stacked on #1372):** Mail Day Undo, Undo all and
    Other… now work on both apps.
    - Undo reverts the letter and reopens the queue row.
    - Other… offers "Keep for the household" or "Junk it".
  - **[#1374](https://github.com/WangPantopus/skinny-pantopus/pull/1374):** the Stamps sample postage wallet is hidden while
    `mail_extras` is off.
  - **[#1375](https://github.com/WangPantopus/skinny-pantopus/pull/1375):** iOS Mail Day shows its error state, not an
    invented day.
  - **Parked:** the iOS maintenance reminder flag (`7f492bb31`). The iOS Log maintenance form can't be reached in a release
    build, which is a U05 finding.
  - **Found, for follow-ups:**
    - Mail Day fills today's queue only on the first read of the day.
    - The iOS reviewed row hides Undo from VoiceOver.
    - The Stamps header's "Gift a stamp" and "More actions" are no-ops.
    - iOS My homes "More actions" opens "Delete home" directly.
  - **Next:**
    - F+G, approved by Stream 1: Earn and package tracking hidden with the flags off, plus the Stamps header icons;
    - then the U05 release walk.

- **2026-10-01T14:28:58Z — U05 groundwork: a read-only sweep (origin/master `3dc6b089e`, all launch features off) for reachable controls that do nothing and for sample data on production paths in this stream's screens.**
  - **Being fixed now** (branches pushed, devices next):
    - Mail Day "Route to <name>" files the letter as the triager's private mail (`claude/stream4-mailday-route-to-addressee`).
    - Mail Day "Other…", Undo and "Undo all" (`…-mailday-undo-other`). Undo now really reverts the letter.
    - iOS Mail Day shows sample mail on a failed load (`…-ios-mailday-no-sample`).
    - The Stamps postage wallet is sample data (`…-stamps-wallet-flag`).
    - The iOS maintenance reminder posts to the hidden calendar (`…-ios-maintenance-reminder-flag`).
  - **Still open; reachable in a release build. Next to reproduce, then decide:**
    - My Mail Day "Scan more", "Scan today's stack", "See full history" and the setup-nudge cards: the hosts pass no
      handlers (iOS HubTabRoot/YouTabRoot, Android RootTabScreen:6280).
    - Mailbox "Scan an item" opens unboxing with no mail id, so it always says "Nothing to unbox yet".
    - Mail tasks "Added to calendar" reports a success that never happened. The calendar is cut #7.
    - Package mail on native shows tracking, Share ETA, Report issue and virtual unboxing with `household_extras` off.
      Web hides package tracking under that switch.
    - Package copy-tracking is a no-op.
    - Android records mail: "Read full document" and "Change folder" are no-ops, and "See all 8" is hard-coded.
    - The iOS Issues row tap is a no-op.
  - **Honest placeholders, to list in the manifest:** Place "Coming soon" rows (Portable ID, Deed & lien alerts) on all
    three clients.

- **2026-10-01T13:43:43Z — My Mail Day, now back in launch scope: a candidate privacy defect found by reading code. It will be reproduced next and then fixed.**
  - **Why I think it's a defect:**
    - The apps' "Route to <name>" sends `POST /mailday/items/:id/route` with no body.
    - The server picks the personal drawer from the piece's tint, and `resolveLinkedMail` then sets `Mail.recipient_user_id`
      to the **acting** user and privacy to `private_to_person` (mailDay.js:265-275).
    - Every household member is shown the same queued piece with the envelope's name (mailDayService.js:107-146).
    - So if Alice routes a letter "to Maria", it becomes Alice's private mail and Maria can no longer see it.
    - The queue row already knows the matched member (`MailRoutingQueue.best_match_user_id`).
  - **Plan:**
    - Reproduce on the isolated runtime with the owner and member B, through the API and SQL, then on a device.
    - Then a backend repair: route to the matched member, or to the shared household drawer when no member matches, and
      never to whoever happened to triage it.
  - **Also on Mail Day, recorded:**
    - "Other…", the per-row Undo and "Undo all from today" do nothing on either app.
    - The backend's undo resets only the triage row, not the letter's drawer or the queue, so wiring the buttons as they
      are would mislead.
    - These are decided after the device check.
  - **In flight:** three branches (iOS maintenance reminder `7f492bb31`, Stamps wallet gate `9676bbc21`, iOS Mail Day
    error state `0445e0c0a`). Their before/after builds are queued on the heavy slot.

- **2026-10-01T13:34:08Z — [#1354](https://github.com/WangPantopus/skinny-pantopus/pull/1354) is with the queue owner: shared Android controls read once in TalkBack, and the wizard title clears its step count at large text.** Head `b170f1ccc` on `a0eba5315`, Android only, three shared files. Seal `20261001-stream4-android-shared-a11y-r1` (`d52978cb…`).
  - **What changed:** ListOfRows tabs, the extended FAB and the labelled top-bar action; the WizardShell CTA; and the
    app-wide `PantopusButton`, which covers every EmptyState CTA.
    - `clearAndSetSemantics` sits last in each chain, so click, role, state, test tag and text are kept.
    - From font scale 1.3, the wizard title takes its own row.
  - **Proof on `pantopus_s34`:**
    - every probed control reads once: "Use my location. Use my location. Button" became "Use my location. Button", and
      "Continue. Continue. Button" became "Continue. Button", on Start a train steps 1–3 and Add Home;
    - at font 2.0, "Start a support train1 of 5" now has the title on its own row;
    - 0 differing pixels in all 9 default-size pairs;
    - the instrumented suite passed on the device (OK, 50 tests);
    - the build ran ktlint, detekt, the unit tests and Paparazzi verify: 307 tests, 0 failures.
  - **Runtime:** two leases with exact cleanups (353 of 353 tables equal both times). I handed the runtime to Stream 3 in
    between and back afterwards.
  - **Routed:** Add Home's screen-specific "Use current location" still reads twice. Stream 3 took it.
  - **Next:** the iOS maintenance reminder under `household_extras`, the Stamps wallet under `mail_extras`, the My Mail
    Day verification, then U05.

- **2026-10-01T12:52Z — The shared Android TalkBack repair is mid-run, and three decisions are recorded ("Decided by Stream 4" items 8–11).**
  - **Before half done** on `pantopus_s34` (lease 1, 12:02:18Z–12:35:26Z, exact cleanup with 353 of 353 tables equal):
    - TalkBack repeats on the tabs ("My trains, 0. My trains. 0."), the FAB, "Mark all read", the wizard CTA ("Continue.
      Continue. Button") and every EmptyState button ("Use my location. Use my location. Button");
    - at font 2.0, "Start a support train1 of 5".
  - **Lease:** handed to Stream 3 while the after APK (`b170f1ccc`) builds. Device slot 1 stays with Stream 4.
  - **Next:** the after half in lease 2, then the PR. After that: the iOS maintenance reminder, the Stamps wallet flag and
    the Mail Day verification. U05 can start, since the flags are on master.

- **2026-10-01T11:38:29Z — F02 native permission done on iOS and Android, so this stream's U03 and U04 tables are complete. Seal `20261001-stream4-f02-native-permission-r1` (`4c375292…`), verification only. Window 11:20:41Z–11:37:36Z, with one slot swapped from the sim to the emulator.**
  - **Cohort:** the F01 cohort was recreated by SQL (the user-approved 09-27 pattern): 10 opted-in synthetic Homes in
    `c20fbj`, the viewer with $150 bills.
  - **Member B's Money:** neighborhood only before; "$150 / mo, 12% above" after the owner grants `finance.view`;
    neighborhood only after the revoke. This held on both apps.
  - **Member B's Place dashboard after the revoke:** no bill figures, while the owner's dashboard shows "Your electric
    bills average 12% above… Worth a look." That is the positive control, and the first device check of the iOS hero bill
    nudge.
  - **Login limiter:** the per-IP limiter (shared with other streams' sign-ins) refused one owner API login. The backend
    was restarted on the same source, and the refused attempt's frames are in `aborted/`.
  - **Cleanup:** exact, 349 of 353 tables plus auth history.
  - **Totals:** U02 46 of 46, U03 complete, U04 36 of 36. U05 waits for the launch flags.
  - **What remains needs the user** (providers, the hosted environment, the cut-feature flags, two product decisions) or is
    older-row sweeping.

- **2026-10-01T11:10Z — Drift triage of Stream 5's rescan (`20261001-stream5-drift-rescan-r1`), routed by Stream 1: 15 candidates, no change.**
  - **`public.js`, 8 hits:** real unknown columns in `GET /api/public/gigs|listings|posts/:id`, but the routes are dead.
    - The web share pages use `/api/gigs|listings|posts/:id` (`lib/publicShare.ts`), and nothing else references them.
    - Already recorded as dead in `docs/workstreams/README.md`.
  - **`mailboxV2Phase3.js`, 7 hits:** all launch-cut mail extras (cut #8), so left for the user's flags. They are the
    mailbox map pin, theme/stamp apply, and Mail Memory (on-this-day, year, dismiss).

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
