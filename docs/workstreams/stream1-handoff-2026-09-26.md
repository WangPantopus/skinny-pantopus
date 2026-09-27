# Stream 1 handoff: 2026-09-27 (successor handoff)

> **UPDATE 2026-09-27T11:16Z — Stream 1: the handoff IS IN EFFECT.** Every PR this session opened is merged (the last ones via batch 42 #624, 11:14:24Z → master `35c5434df`), the queue is empty, and the user turned off the required CI check. See §0 (rewritten at 2026-09-27T11:16Z).

> **Read §0 first.** It is the successor session's handoff state, with batch 40 in CI and batch 41 reviewed and ready. The newer handoff prompt is `NEXT-STREAM1-PROMPT-2026-09-27.md`.
>
> The "Final" and "Live" quote blocks between this note and §0 are earlier notes from the same day, kept as history. §0 replaces them, and so does "## 0-prior".


> **Final:** batches 32–36 merged; master **`89f3c6bac`** (2026-09-27T02:31:01Z). Every Stream 1 fix is on master, the queue is empty, and the runtime equals master.
>
> *(Historical: at 02:31:47Z the queue was empty and the runtime equalled master `89f3c6bac`; that state is now "## 0-prior". The current state is §0.)*

> **Live — successor session (queue owner since 2026-09-27T02:50Z), 03:44Z:** batch 37 [#572](https://github.com/WangPantopus/skinny-pantopus/pull/572) queued 03:44:00Z (#560 #563 #564 #565 #570 #566; tip `a3c1b106d`); batch 38 candidates #567 #568 #569 #571 (CI running). S1 [#571](https://github.com/WangPantopus/skinny-pantopus/pull/571) implements §3.2 (bundle `20260927-stream1-quickpost-address-search-r1`, `bba44d1b…`). New user decision (answer before 03:33:40Z): the V2 composer gets the same address search (Stream 1 next). The hub docs' 03:44Z UPDATE blocks hold the detail.
>
> **Live, 2026-09-27T07:39Z:** batch 37 merged 05:19:24Z → `563cddb47`; batch 38 [#585](https://github.com/WangPantopus/skinny-pantopus/pull/585) queued 07:25:44Z (14 PRs). New S1 PRs #586 (listing Home access, security), #588 (reschedule notice UTC); slot-lifecycle and edit-copy branches pending checks. The user's standing instruction (~07:22Z): never stop; take the recommended option and record it. See the 07:39Z UPDATE blocks.
> **Earlier live, 2026-09-27T05:00Z:** batch 37 #572 rebuilt on `c890f2588` (tip `8c6b21c43`, CI re-running). S1 [#580](https://github.com/WangPantopus/skinny-pantopus/pull/580) (V2 wizard real places; bundle `a4c865b1…`) and [#581](https://github.com/WangPantopus/skinny-pantopus/pull/581) (listing slot release) are open. Audits done (§3.3). A listing Home-membership security finding is escalated to the user. The hub docs' 05:00Z UPDATE blocks hold the detail.
> **§9 correction:** at the user's request the previous session removed its 8 merged PR worktrees (gig-qa-live, web-worker-panel, native-helper-dock, web-stop-copy, android-tab-nav, gig-write-replies, android-edit-location, saved-search-alerts) with `git worktree remove` by 02:51:59Z, and deleted 8 superseded APK copies (the runtime keeps `installed-5558-1e3ed71f8.apk` and now `installed-5558-b4b518313.apk`). New worktree: `/private/tmp/pantopus-stream1-quickpost-address` (#571).

This is the complete takeover note for the **Stream 1** session (Claude, peer of Streams 2 and 3). It replaces the 22:08Z version of this file.

**Read order:**
1. `AGENTS.md`
2. `docs/PROJECT_HANDOFF.md` → CURRENT RESUME POINT
3. `docs/workstreams/README.md` (coordination guide + resume point)
4. `docs/workstreams/01-gigs-payments.md` → CURRENT STREAM 1 STATE
5. this file
6. the living inventory (§7)

Every value here was checked live when written. Re-verify Git, PR, CI, slot and process state before acting on it.

---

## 0. HANDOFF STATE — FINAL, successor session, 2026-09-27 (written 2026-09-27T11:16Z; this section wins over everything below it)

The successor Stream 1 session (queue owner 2026-09-27T02:50Z → 2026-09-27T11:16Z) wrote this section. Every value was checked live (UTC from `date -u`, SHAs from git, PR state from `gh`). **Re-verify master, open PRs and CI before acting.** The next session's prompt is `NEXT-STREAM1-PROMPT-2026-09-27.md`.

> **UPDATE 2026-09-27T18:58:50Z — accepted-evidence reconciliation; bounded U02 repair in progress.**
> - Master remains4309276c792b75066f7ed99a0fe95d48fe35326e, batch59 merged/queue empty. Tip#52723-file9bb90479… and native Login#64842-file692d0100… seals revalidated, relevant reason mapping/Login sources unchanged; living inventory stale pending/routed cells corrected to REUSE. No duplicated accepted journey.
> - Original REMAINING_WORK catalog already records bounded P03/P04/P05/P08 September23 closures and P06 #204 record+freeze acceptance. Older01 table cells now cite those later dispositions;9closed/71partial was historical all-stream accounting, not a present S1 launch-scope percentage. Original Sep23 bundle files were not located in the current audits mirror, so this reconciliation preserves recorded acceptance without claiming a fresh seal validation or new money run. Current no-capture/S1-08/A17/hosted restrictions remain.
> - U02 actual Android at2×font found Post comment placeholder/typed text clipped by fixed44dp Material padding; default font also clips, dark theme text faint on the existing light field. Actual font change after deep-link entry clears typed draft by replaying launch intent. Candidate8745fb5eb in runtime branchcodex/android-post-comment-accessibility-20260927 changes2existingAndroidfiles: compact existing outlined decoration and a retained-state recreation guard. No acceptance/PR yet; app-only build and real afters pending S2heavy release. [Private in-progress evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-retained-ui-accessibility-r1/IN_PROGRESS.md). Retained AlicePost hash/views unchanged; no submission/fixtures. Device font/night restored before build wait.
> - S1 actual web keyboard Tab→emoji→attachment→Clear/Enter retained draft then clears/disables Send without a write. No zoom or whole-screen-reader/contrast acceptance. Full U02/U04 and release U05 remain partial; do not convert a bounded repair into all-app closure. S2 owns R04 copy afters and current native/heavy slots; S1 owns only5558slot2, no iOS lease. Next: build/verify the reproduced Post defects before moving to another workflow.

> **UPDATE 2026-09-27T18:44:27Z — batch59 merged; payout-status read recovery accepted within limits.**
> - Master `4309276c792b75066f7ed99a0fe95d48fe35326e`; batch59[#665](https://github.com/WangPantopus/skinny-pantopus/pull/665) includes S1[#664](https://github.com/WangPantopus/skinny-pantopus/pull/664) exact `1d2175f90714ebd7808784131a84a5ed57df2bae`. Exact three-file union/blob/ancestry proof passes; required CI checks absent, CI informational, queue empty. Unrelated #46/#429/#430/#625 untouched.
> - Personally reproduced Android/Chrome payout-account503 falsely offering setup. Existing Android rows and web action now distinguish unavailable from genuine404, with pull/Retry. Actual repeated503/retry, recovery404, cold reopen/reload; web held double-click sends one GET and shows Retrying… disabled. [Sealed24-file evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-native-payout-status-recovery-r1/RESULT.md), manifest `93c45f979ff54a6b902fc807e058c0d2a7a50789aba782025f1b9dea8dedc676`. All75 payment/wallet entries GET, zero fixtures or money writes; public counts equal except normal DPoP bookkeeping109→111. Faults/holds clear. No unit tests/lints.
> - iOS actual launch reached the recorded device-passcode boundary before payout read. No bypass/source change or iOS acceptance. Its nil-on-failure remains a source risk until that UI is reachable. Web shared banner placement/provider-connected200/external onboarding unverified; no public task/money fixture to manufacture access. Existing presentation preserved.
> - S2 R06 native-pass105-file eb4445a2… reviewed intact: issue/revoke503/retry, selected1-day persistence, public active→revoked, restart and iOS committed-lost replies; exact2claims/4views cleanup and complete retained hashes equal. R06 remains partial; Android navigation ANR/read/expiry/account/clipboard limits explicit. Peer owns next R04 auth-gate check.
> - Next S1: reconcile stale tip/Not-you status with unchanged sealed evidence and continue genuinely open retained catalog rows. Detailed inventory roughly95% backed by bounded real-app evidence; no whole-workstream or release-ready percentage implied. Runtime1d2175, Android91bb/APKa538934e, iOS2d348 shutdown/released, heavy free; S1 retains5558slot2. Protected main untouched.

> **UPDATE 2026-09-27T18:25:12Z — batch58 merged; web train list recovery accepted.**
> - Master `e480cd94e1c992fb0f80f98f4902025a620d7165`; batch58[#663](https://github.com/WangPantopus/skinny-pantopus/pull/663), S2[#661](https://github.com/WangPantopus/skinny-pantopus/pull/661) exact6744ecb6638049f346dbe4fa1c752ad0fcdb68f8, S1[#662](https://github.com/WangPantopus/skinny-pantopus/pull/662) exact900d7597855c74d40632c8b27bb5359c312b43ba all MERGED. Two-file exact union/blob/ancestry proof passes; required checks absent/CI informational; queue empty.
> - S1 actual Chrome reproduced older Helping response replacing loaded All with false empty. Existing page request sequence now ignores obsolete success/error/loading and Retry uses existing spinner. Real503/repeated retry, held loading/recovery, genuine Helping empty, organizer draft, old success+late503 and reload pass. [Sealed21-file bundle](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-web-trains-list-recovery-r1/README.md), manifest `a13106f6e0ddf53b3b6265ec26e366d8b00522f92d38860dc599050ab6ebc4f1`. No fixtures/writes; all public counts and11 train/Activity table complete-row hashes unchanged, faults/holds clear. Native accepted evidence unchanged/reused, not rerun. No sign-up/funds/provider/published/pagination or all-train claim.
> - S2 checklist metadata79-file9f70d348… reviewed intact: real web malformed stored row200/actionable before, existing503/Retry on web/iOS/Android after, exact preimage restored, owned B productDELETE/all dependent0 and retained deletion hashes equal. This closes I01 deferred B cleanup, not all I02. Peer owns ongoing R06 native pass check/6Fdriver; S1 no iOS/heavy need.
> - Next S1: reconcile genuinely remaining retained rows across the existing living inventory and broader P/G/O/L/U/screen catalogs. Skip cut share-pickers and future Swift-language notes; no accepted-journey repeats without source/contract risk. Broad external/provider/founder boundaries remain explicit. Runtime900d, Android619/APK48625 stopped, iOS unchanged2d348 shutdown, S1 retains5558slot2; protected main untouched.

> **UPDATE 2026-09-27T18:16:56Z — edit visibility repair accepted and merged, batch57.**
> - Master `559b869ec271f6a6801546f9ef61da64f3ca4b47`; batch57[#660](https://github.com/WangPantopus/skinny-pantopus/pull/660) and S1[#659](https://github.com/WangPantopus/skinny-pantopus/pull/659) exact6191db5b4a3d9ffd24ebd6813c6fd6d866dadf73 MERGED. One-file union/blob/ancestry proof passes; required checks absent, queue empty. No unit/lint gate.
> - Real Android baseline text-only Connections edit silently stored neighborhood; final one-file VM omits unchanged visibility, preserves explicit existing-selector choices, and labels saved/current scope. Actual final619/APK48625a02 Connections edit/restart keeps scope, Public selection/503/no-write/retry/reopen persists correct visibility; initial85a read503/retry and repeated Save single write reused where unchanged. [Sealed29-file evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-android-post-edit-audience-r1/README.md), manifest `9438f3c2b493169b575fd3a29a2895bdcf21bb621ecf4aa062d39bc46d16741b`. Two owned posts/all children0/storage0, all counts baseline except normal sessions/security+1. Full delivery/retargeting, other audiences/templates and web/iOS reruns not claimed. Initial overbroad omission corrected before integration; existing controls/layout preserved.
> - S2 I0190-file6fd4b5e2 reviewed intact: actual web generation/three-client committed completion then missing-reply reload/restart; owned A0/retained hashes equal, B intentionally retained then now peer reports cleanup pending I02seal. I01 closed within retained scope,02 published69d99f81d. S1 did not rerun peer evidence.
> - Next S1 existing web Support Trains list read/retry row; Chrome baseline shows retained Alice draft. Own Android app stopped,5558slot2 retained, heavy free after18:12 install; no iOS lease. Broader catalog reconciliation follows. Protected main/unrelated PRs untouched.

> **UPDATE 2026-09-27T18:02:59Z — Android composer recovery accepted and merged, batch56.**
> - Master `c2eb0dea83386856903120abb178e1fc0e1f9509`; batch56[#658](https://github.com/WangPantopus/skinny-pantopus/pull/658) merged18:02:59Z, S1#657 exact `f45b39f944903163433212e8ae18333bb7ca9dc3` also MERGED. Exact three-file union/blob/ancestry proof passes, required CI checks remain absent; queue empty, unrelated PRs untouched.
> - S1 personally drove Android5558: create201 previously remained in composer; edit200 then showed stale detail. Existing dismissal effect now acknowledges after its delay, success cannot resubmit, and existing detail VM listens to the existing post notifier. Actual create/edit503, offline edit, draft retention, repeated-tap single write, return-read503/Try again, discard and cold reopen pass. [Sealed42-file evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-android-post-compose-recovery-r1/README.md), manifest `fdc45d4f727cbbfb2da8abb57d65aaecc78e21e4223cbcac538595666e9d18d1`. Final installed APK61a106d5… on exactf45; web/iOS unchanged evidence reused, not rerun. No media/provider/committed-lost-reply/account-switch/full-taxonomy acceptance.
> - Exact two owned posts d7c90b65/2846641e and all11 dependent sets0 after checked transaction; storage0, all public counts equal baseline except normal retained Dpop108→109. Faults/holds empty, network restored, local draft cleared. Heavy released17:48:58Z; S1 own5558slot2 only. No protected-main/founder change.
> - Next bounded observed issue: edit header says “Posting to Connections” for a stored neighborhood post. Trace/reuse existing label before any repair, then actual web Support Trains list failure/recovery and remaining existing catalog criteria. Roughly90% of detailed retained inventory entries carry bounded evidence; this is not whole-workstream or launch readiness. S2 I01 new90-file recovery seal awaits coordinator review; broader I02 remains peer-owned.

> **UPDATE 2026-09-27T17:51:23Z — batch55 merged; composer afters continuing.**
> - Master `cda42fb8ac01ef4b91d403ca069adcce140300aa`; batch55[#656](https://github.com/WangPantopus/skinny-pantopus/pull/656) merged17:51:23Z. Reviewed exact S2#654 `8587a17872cca06cd1d5e62bf9209c517adaea36` (74files/seal85ee0497…) and S3#655 `8686fb535b35fa1db0d2ac2a3bfee3b8d45cb56a` (40files/seala8b25c032…). Three-file exact union/blob/ancestry proof passes; live required checks absent, admin/no-force/no-delete protections retained. Queue empty, unrelated PRs untouched, no CI gate.
> - S2 actual web issue clears/zero estimates now persist; failure503/real403/draft/retry/uncertain reply/reload/cleanup verified, all owned Home+3issues0 and scoped retained hashes equal. S3 actual Android wrong-password step-up401 stays inline without refresh/replay/logout; ordinary bearer401 still refreshes. Both native disposable account DELETE200/restart/owner restore pass,1196UUID references0; all386 non-auth table hashes unchanged, normal auth/challenges retained. These are reviewed peer evidence, not S1 reruns; wider rows/provider limits stay open.
> - S1 final installed Android `f45b39f94`, APK61a106d5…: edit now returns and shows current saved text. Injected return-read503 gives honest error, actual Retry recovers stored edit. Fresh create/cancel/reopen and exact cleanup remain before sealing/PR. Heavy released17:48:58Z; S1 own5558slot2 only. S2 owns current I01/I02 recovery and iOSdriver; S3 has released all devices. Existing in-scope inventory order remains authoritative.

> **UPDATE 2026-09-27T17:47:48Z — resumed exact checkpoint; Android composer repair in progress.**
> - Live remote master remains `0e0efd358f79e7605f94681b4820262f1dae27a0`; unrelated #46/#429/#430/#625 untouched. S2 #654 exact8587a17872cca06cd1d5e62bf9209c517adaea36 reviewed with74-file seal85ee0497…; next serial batch55 pending. Existing CI snapshot remains informational; no repeat test/lint campaign.
> - S1 resumed the held POST16661: released after interruption, actual401 and zero inserted rows. Real retry201 created exactly one owned postd7c90b65, but Android composer stayed open. Existing dismissal effect cleared its own key before delay;26c421802 reorders acknowledgement and prevents Success resubmission. Actual edit503/offline retained draft/no write; retry200 returned but detail kept old content. Final candidate `f45b39f944903163433212e8ae18333bb7ca9dc3` reuses existing injected posts-refresh notifier in detail VM. Three existing files, no presentation/schema/new harness changes. Afters/build/seal/cleanup still pending; one owned post retained. [In-progress bundle](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-android-post-compose-recovery-r1/source/reproduction.md).
> - S2 D10 sealed137-file43a95cbb… reviewed: three owned Homes/dependents0, recorded failure and retained deletion hashes unchanged; exact limitations preserved. M01 nine-filec300f084… reviewed: unchanged accepted postal code reused, proposed printed/welcome/digest implementation and physical delivery remain open. These are peer evidence reviews, not S1 reruns.
> - Progress estimate: roughly90% of the detailed in-scope living-inventory journey entries have bounded accepted evidence; this is not a whole-workstream/launch readiness percentage. The broader30 P/G/O/L/U acceptance criteria retain specific local and external gaps. Continue this reproduced composer journey, then existing web Support Trains read row, then reconcile remaining catalog criteria without repeating unchanged accepted work.
> - S1 holds own5558slot2 and heavy for final incremental Android build since17:46:42Z; prior heavy released17:43:45Z. Owned emulator safely restarted without wipe after uiautomator/settings stalled. No iOSdriver need; S3 released all native slots and S2 has requested own6F. Live slot scripts govern. Protected main unchanged; no subagents, money actions or hosted/founder access.

> **UPDATE 2026-09-27T15:38:20Z — app-entry repair accepted and merged, batch54.**
> - Master `0e0efd358f79e7605f94681b4820262f1dae27a0`; batch54[#653](https://github.com/WangPantopus/skinny-pantopus/pull/653) merged15:38:16Z, S1[#652](https://github.com/WangPantopus/skinny-pantopus/pull/652) exact `eba1aae5aeec048093a28eb72859446baa8cc466`. Final diff only existing next.config.js adds relative temporary /app→/app/place before React render; exact1-file union/blob/ancestry proof passes. No auth/middleware final change, CI/unit/lint gate or design change. Queue empty.
> - S1 personally reproduced hook-order error on actual /app entry; final Chrome both local hostnames, trailing slash, reload, actual logout200/login200 and correct Place pass with zero new browser errors. [Sealed17-file evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-web-app-redirect-r1/README.md), manifest `418dd49d0054f52e54fc8b61546a4ad70a6b5f38f0a7ef094d792ea982917e75`. Intermediate middleware approach rejected/reverted because it normalized loopback host. Existing signed-out middleware normalization remains recorded; expiry/production/provider/native boundaries unverified. No Home-delete repeat by S1; S2 owns its post-delete landing recheck.
> - No fixtures or data form writes; all public counts equal except retained normal sessions200→201/security223→225; Alice/Bob complete User hash unchanged. Own Chrome now Alice atlocalhost18139;127 tab at login after sign-out. Runtimeeba1, backendcacf unchanged, Android installed21e. Next S1 existing inventory: Android Pulse post-compose failure/retry, then web Support Trains list reads. S3 owns TokenAuthenticator narrow wrong-password-step-up repair; S2 shared-row concern was withdrawn as unproven. Live device/heavy leases govern.

> **UPDATE 2026-09-27T15:32:28Z — Android Payments read recovery accepted; app-entry repair in progress.**
> - S1 personally drove owned5558 Settings→Payments on installed21e692db1/APK3bc98a0d. Persistent methods503 and repeated Retry show error; history503 shows honest unavailable; separate earnings/spending failure shows dash, both failures hide figures; clearing faults and actual pull restores real0/empty. All59 scoped requests GET, no money action. [Sealed16-file evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-android-payments-reads-r1/README.md), manifest `6619c01ee6f8c5bc515236aeb2e280d357de561dfce57ea7496a99a3b61064e4`. Existing secure-screen capture returned zero bytes: these are labeled failed artifacts, acceptance uses real UI/accessibility observations plus API/SQL; no protection bypass. Connected-account outage/populated funds/provider/device-credential gate and other-client reruns remain open.
> - No fixtures, Payment0/storage0; all public counts unchanged except normal Dpop107→108, faults clear. No app change for Payments. Next existing rows remain Android post-compose failure and web Support Trains; first repair new /app landing defect personally reproduced on own Chrome (hook-order error15:26:34Z, eventual Place) after S2 reported deletion-return failure.
> - Candidate `eba1aae5aeec048093a28eb72859446baa8cc466` extends existing next.config.js redirects with same-origin /app→/app/place. Intermediate middleware approach changed loopback host and was rejected/reverted; final diff only config, no auth/UI redesign. Own initial after reaches same-host Place without new error; broader relevant afters/seal/PR pending. Master remains1c82a914d, queue empty. S2 iOS tap concern retracted as unproven, no shared-row edit. S3 now has iOS driver for scoped A02; live leases govern.

> **UPDATE 2026-09-27T15:24:27Z — batches52–53 merged; peer bounded evidence reviewed.**
> - Master `1c82a914d7fdb84f4abe3dd6409a9de43645290c`. Batch52[#650](https://github.com/WangPantopus/skinny-pantopus/pull/650) merged15:21:27Z, exact #647 `f0dfb5acdbcad583f7a1eb6a87728d80ac12089b` plus #648 `6b5d8b84cebd8520c54a39910d71d227a652aed8`; batch53[#651](https://github.com/WangPantopus/skinny-pantopus/pull/651) merged15:24:04Z, #649 `ffaf7026043a9289c8c9223b51bb1068d851450a`. Exact ancestry/file-union/blob proofs pass (4 then1 files), no shared Swift/lint execution or CI/unit gate. Queue empty; unrelated #46/#429/#430/#625 untouched.
> - S2 Lockdown summary67-file seal `e570e4146188f28bec6553660264a6eb8244aa83a0d38099f2a726ae1159931a`: expected guest-pass403 no longer hides successful cards/Manage; actual Chrome enable/reload/disable and independent errors recover. Copy-only12-file seal `5b87541864f48fe264a109bc0ffa260edfbb421d2f50e7c9800287c66ef9235e` removes the disproven forced-signin promise, reusing actual session200 evidence. Two passes revoked,3views/8audit retained for D10; no full cleanup or remaining effect promise accepted.
> - S3 native Login Not you42-file seal `692d01008cd13f89f74b74e79a7290883522e206b2c6c0535c4be819f8c597dc`: actual final installed iOS/Android confirmation/dismissal, correct specific hint removal, typed-field and foreground retention, cold restart pass. Existing ContinueAs presentation reused; debug devices only, secure-store/provider boundaries open. Hint sets restored via real UI; auth history retained. Peer evidence reviewed by S1, not independently rerun.
> - S1 actual Android5558 Payments reads underway on unchanged21e692db1: persistent methods503 gives error/Try again; history503 honest, failed earnings dash with real spending0. No money write. S2 has iOS driver for D10; S3 coordinates next A02 disposable-account deletion afterward; S1 no heavy/iOS need. Live slot scripts govern. Latest own web Hub/comment seals remain accepted; no cut work reopened.

> **UPDATE 2026-09-27T15:15:50Z — web comment failure/recovery accepted.**
> - Master `480119d5c`, no S1 application change. Actual Chrome existing composer kept its draft after503 and connection reset (zero rows), accepted repeated Meta+Enter during one held request as one201/one correct Alice comment, and preserved that row after reload. Clear discards the unsent draft. After exact fixture deletion, stale Send404 kept the draft; Clear/reopen truthfully showed Post not found and Back to Feed recovered. [Sealed20-file evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-web-comment-recovery-r1/README.md), manifest `f29ddeb18bf01eb71fe6bfff237a43d9ee33c9867ebadcfa97efb4074c778613`. No attachment, committed-lost-reply or native-failure acceptance.
> - Exact owned post/comment deleted in checked transaction, all public-table counts equal baseline, zero owned rows/files/objects; faults cleared. Existing native comment evidence reused, no new native run for this bounded web row. Next scope review found /app/nearby meter unlocks Marketplace/Open Gigs: that meter row is excluded under #3/#4; general Pulse navigation remains in scope. Next genuinely open row: Android Settings→Payments read failures on owned5558, then Android post-compose and web Support Trains reads. S2#647 ready for exact review; S3 Not you sealing. No heavy/iOS lease requested.

> **UPDATE 2026-09-27T15:10:59Z — web Hub account isolation and Home entry accepted.**
> - Master remains `480119d5ccf086ef520e14cb8fd41202e6e07183`; queue empty, open unrelated #46/#429/#430/#625 untouched. No application change or PR. Runtime `21e692db1`, backend `cacf377b6`; relevant source equals master.
> - S1 personally exercised Chrome on owned18139: Top Attach Home → Attach a Home → blank /app/homes/new Step1; two tabs clear on actual logout; Bob sees Bob/0 notifications/no activity; Alice login restores Alice/2 notifications/activity. Releasing an obsolete Bob request returned401 without disturbing Alice; full reload remains correct. This does not prove delayed successful old-account payload handling. [Sealed14-file evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-hub-account-navigation-r1/README.md), manifest `6720293faa0179591315642c5e27f4ea2a7263b586d518d99447d5b43bc3ff27`. No native rerun or broad auth acceptance.
> - No fixtures or Home/profile writes; all public counts equal except ordinary retained sessions198→200/security219→223. Alice/Bob User hash unchanged; all faults/holds cleared. S3 final Not you verification and S2 Lockdown summary repair remain peer-owned; heavy released15:05:12Z per S3, live leases govern. Next S1: existing source-only web post-comment draft failure/retry/duplicate-command row, then remaining in-scope inventory order. No cut workflow reopened.

> **UPDATE 2026-09-27T15:00:45Z — batch51 merged; Android post intent accepted.**
> - Master `480119d5ccf086ef520e14cb8fd41202e6e07183`, batch51[#646](https://github.com/WangPantopus/skinny-pantopus/pull/646) merged15:00:18Z, exact S1[#645](https://github.com/WangPantopus/skinny-pantopus/pull/645) `21e692db1980bb86efa3668d94bbb221e628941a` plus S2#644 `419c39e4da3a834e1a3fc725b2fbcc88b672a2e5`. Exact two-file union/blob proof, reviewed seals; no CI wait/unit/lint execution. Queue empty.
> - S1 actualAndroid5558 before: canonicallocal_update rendered ALERT, lost_found rendered ASK because broadpurposewon. One existing mapper now mirrors existingiOS canonicaltype precedence/aliases. InstalledAPK`3bc98a0d…` afters show SHARE/LOST & FOUND, realalertstaysALERT; read503/error/visibleRetry andprocessrestart pass. Existing chip/templates/layout unchanged. [Sealed23-file bundle](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-android-post-intent-r1/README.md), manifest `f125716092f385471a50b041da58e6505143f47943946669f18f9c6f4e46dad2`. iOS/webunchanged priorreportevidence reused, notrerun. TwoownedAPIposts cleaned2→0 with allchildrows0; retainedpostcomplete-row identical; baselinepubliccountsequal exceptnormalsession197→198/security218→219. No provider/fulltaxonomy claim.
> - S2#64436-file security-summary read-failure evidence `7eb50c7569c527286205a48a37b9a1c77a4c30caf463d245b6b32b9215b6c826` reviewed. Chrome eachread503/retry/realretired-owner403/late-response navigation passed; healthyemptystatesonly, populated/Lockdown effects remainopen. S2pickup147-file bounded no-code milestone `8158b065…` remainspeer-owned withfinalfullrowdigestcomparison explicitlyunavailable; no broadercalendarclosure.
> - HeavyhandoffS1→S3 at14:54:46Z; S3Notyoubuilds/iOSdriver, S1Android5558slot2, S2Android5556slot3. Currentruntime21e692db1, backendcacf377b6unchangedPostscontract, owned18132/18138/18139; liveleaseswin. NextS1 existinginventorysource-onlywebHubAttachHome route andquery-cacheaccountswitch, actualChrome ownAlice/Bob, noauthsourcechangeplanned. No cutflowreopened, nofounderdevice/DBorprotectedmainwrite.

> **UPDATE 2026-09-27T14:49:31Z — batches49–50 merged; Report post accepted.**
> - Master `d85fe66af458ff1a3aced48edaa758f61e6c61b5`. Batch49[#640](https://github.com/WangPantopus/skinny-pantopus/pull/640) merged14:40:49Z (#638 native Place/Home privacy return, #639 honest clean-profile status); batch50[#643](https://github.com/WangPantopus/skinny-pantopus/pull/643) merged14:49:25Z (#641 Home manual-vendor read errors, S1[#642](https://github.com/WangPantopus/skinny-pantopus/pull/642) report retries). Exact heads/seals reviewed, combined ancestry/file-union/blob or shared-hunk proofs pass; no shared Swift lint execution, CI informational. Queue empty; unrelated#46/#429/#430/#625 untouched. One takeover CI snapshot remains35c5434df run36316539221 success; no repeated CI campaign.
> - **S1 personally accepted Report post:** iOS first then Android and Chrome; before retries created1→2→3 duplicate reports. Existing posts.js only, exact `cacf377b65029914659c6870592e85247b78f742`, preserves old rows and atomically reuses reporter/post identity through existing PK. Real UI503/error/recovery, Cancel, reload/process-restart, legacy compatibility, two overlapping Android requests with replies lost, and actual stale-post404 all pass with one identical correct report before cleanup. [Sealed75-file evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-native-post-report-r1/README.md), manifest `14c342b07ccf4a08953bc1c139136156d8b755ede10c4917f7e418264762479a`. Native report paths unchanged at installed2d3486201; web Chrome actual candidate. No unit test/schema/new app file or design change.
> - Cleanup checked: exact owned Bob post/report/view/new LocalProfile and new iOS registration removed; zero owned rows/objects, Post100/PostReport0/LocalProfile1/storage0 equal baseline; Alice/Bob User fingerprints unchanged. Only ordinary authDpop103→107/session193→197/security214→218 retained. All faults/held requests cleared. F4 shutdown/exactslot1 released, driver handedS2pickup→S3Notyou; S1 keeps5558slot2. Backend18132candidate/proxy18138/web18139 remain owned, protected main untouched. IAB hydration observation unresolved; accepted web used Chrome. Provider/physical/moderation/full-app boundaries unverified.
> - Peer evidence reviewed, not rerun by S1: #638128files`af14517d…`, #63922files`b538fe98…`, #64165files`9a2d5cf9…`. S2 Home retained and membership ledger advances preserved; vendor fixtures fully cleaned. S3 no profile Save or mutation. Next S1 existing inventory: trace observed Android local_update→ALERT mismatch against canonical post_type/iOS prior mapping, then remaining genuinely open in-scope rows; no cut re-verification. S3 loginhint and S2 pickup/security remain peer-owned.

> **UPDATE 2026-09-27T14:25:50Z — batch48 merged; report retry defect reproduced.**
> - Master `d7a9f704bd16cb14521c83ecf884eb680a35fc0e`, batch48[#637](https://github.com/WangPantopus/skinny-pantopus/pull/637) merged14:23:14Z, S3#634 exact `8a7b9fd450100131ce10d08fad12e528a7050803`. Original39-file seal `e47477147538c3b841bd51148ce5ded67afa8d915dfed2097ac47dd3af84c9e9` plus33-file [addendum](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream3-native-profile-message-return-r1-addendum1/RESULT.md) seal `41f3e1eedda0fcc57cd74e1059bc55eb93f78b12ca42a670a65115f73d8aa6cc` reviewed/intact. Actual peer iOSHub/Inbox/You and Android preserve unsent DM on profile Message, repeated-tap Android regression repaired by current-entry guard. Immediate transition-time Android Back may be ignored; settled Back works. Two participant preimages restored, no Send/Save. Automatic keyless weather reads were untraced, so earlier blanket no-provider claim corrected; provider acceptance absent. Exact4-file batch proof passed, no CI/unit/lint gate.
> - S1 personally ran iOS Report post then Android parity on owned Bob post `455e0133-5ea9-4731-ae2a-e813980e5673`, created by private API+fresh GPS at Vancouver. Cancel and503 produce no report; recovery produces correct Alice report. iOS reopen+retry then Android retry created duplicate rows1→2→3. Existing shared endpoint was plain insert. Candidate `cacf377b65029914659c6870592e85247b78f742` changes only posts.js: preserve prior random-ID reports; new domain-separated stable IDs reuse existing PK/conflict-ignore. No migration/history rewriting/new file/UI change. Android legacy-report retry now leaves all3owned rows identical. Fresh/concurrent/lost-reply and all-client afters remain OPEN, not accepted. [In-progress evidence](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-native-post-report-r1/README.md). Owned post/reports/newBobLocalProfile retained until checked cleanup.
> - Backend safely SIGINT/restarted on candidate18132, proxy18138/web18139 remain owned. S1 F4 shutdown and iOSdriver handed S2→S3→S1 at14:20Z;5558slot2 retained. S2 privacy-return initial iOSafter failed and is under repair; S3 two-string clean-profilecopy candidate building. Live leases govern. Unrelated#46/#429/#430/#625 untouched; no ready merge item after48. IAB web-login hydration remains an unresolved runtime observation, not accepted/modified auth behavior.

> **UPDATE 2026-09-27T14:05:20Z — batch47 merged; native preview retry accepted.**
> - Master `f6c1b025e3bbc2381f07b2f58270448417d3d937`, batch47 [#636](https://github.com/WangPantopus/skinny-pantopus/pull/636) merged14:04:37Z, integrates S1 [#635](https://github.com/WangPantopus/skinny-pantopus/pull/635) exact `2d348620152e2e46c71a3e6c86c116f1146c668d`. Ten existing native files wire missing Start/pending-preview retry callbacks, reuse loading cards and guard overlapping/stale loads. No design change, new app file/schema or unit/lint campaign. Exact-head review, seal,10-file union/blob proof and native-tree equality passed; required checks remain off, CI not a gate.
> - **Personally rerun:** iOS F4DBD47E and Android5558 installed app-only builds; both signed-out Start and signed-in pending preview. Fresh request, repeated section error, HTTP503/recovery, double-tap single-flight, pending process restart, and Back/Not now during delayed replies pass. Sealed [bundle](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260927-stream1-native-start-preview-retry-r1/README.md),66files, manifest `0aaac67b30ad756a8b6727f09f262b53ec0dda3dfc005951814287bb38c262af`. External geocoder/providers use the existing local proxy stand-ins: availability unverified. Web#60720-file seal/source unchanged, evidence reused without rerun. No whole-onboarding claim.
> - Cleanup: zero fixture rows/objects created, zero place/Home writes, both local drafts cleared via real UI, fault rules cleared. Public counts unchanged except retained login/logout audit effects (Dpop90→103, sessions190→193, security206→214) and own-device PushToken1→0 from logout. No ledger rewriting. Runtime remains verified2d3486201; protected main untouched.
> - Next S1: owned synthetic Bob post via private API at real location; iOS Report post then Android parity, error/retry/dedup and exact cleanup. No post fixture created yet. S3#634 held for reproduced Android rapid Message/Back duplicate navigation; peer repair/afters underway. S2 native Home privacy-return candidate086e99c4b awaits iOS afters. iOS driver handed S1→S3→S2→S1; F4 shutdown/slot1 released14:02Z, S1 retains5558slot2. Heavy free at14:03:57Z; live leases win. Unrelated #46/#429/#430/#625 untouched.

> **UPDATE 2026-09-27T13:45:04Z — batch 46 merged; native candidate building.**
> - [#633](https://github.com/WangPantopus/skinny-pantopus/pull/633) merged13:43:47Z → remote master `9eda920209f96e0338de083b31e7e6cd8f5c75b5`, integrating S2 #632 exact `57346effc788aa8556339c0b03f6502c012d6eb3`. One existing web HomeSettingsTab sends only edited values through the current atomic PATCH. Exact-head review,31-file seal `bfd106e6130c3e5390398b18dd07e887bfe9b4044952508b118e86181b4c973b` in `20260927-stream2-settings-retained-edits-r1`, and ancestry/file-union/blob proof pass. Real Chrome/API/SQL covers separate-tab edits, clearing/no-op, failed write/draft retention/retry, disabled duplicate, committed delayed reply reload, read retry and preference preservation. S2's new Home remains active for D06/D10; no full cleanup or whole-D05 closure claimed. Native/backend/schema unchanged; no CI gate or unit/lint campaign.
> - S1 candidate `2d3486201`: Android app-only build passed13:41:22Z, APK `810d3d2bc7225bae4a77b817381b72f428d8dc1637a02fad1e817812b8c1c1da`, owned18138 endpoint verified. Install hit an unresponsive owned5558 guest (basic system commands timed out); own emulator safely shut via `adb -s emulator-5558 emu kill` and restarted without wiping data. iOS app-only incremental build began13:44:22Z under S1 heavy lease. **No candidate UI acceptance yet.**
> - Native before-case counts show only normal authentication bookkeeping changed; no saved-place/Home writes. Prior web #60720-file bundle verified intact, implementation files unchanged: reused, not rerun. Next remains native failure/recovery afters, then iOS Report post and Android parity. S3 holds iOS driver; all device/heavy ownership comes from live slot scripts.

> **UPDATE 2026-09-27T13:28:28Z — Stream 1 native retry reproduced; batches 44–45 merged.**
> - Master `312439ca40a78fac1e73c0155eeb6b2ea843fb86`: batch 44 [#630](https://github.com/WangPantopus/skinny-pantopus/pull/630), merged 13:12:36Z, integrates S3 #628 exact `704d15e80d3b96b6f18a359284c07d7a8589d878` (web profile Message auth/duplicate guard). Batch 45 [#631](https://github.com/WangPantopus/skinny-pantopus/pull/631), merged 13:19:56Z, integrates S2 #629 exact `aaeb4262669217b846cecf6778ac0cde865a98d9` (four defined Home color tokens, following S2's explicit user styling lead). Both exact-head bundle seals and ancestry/file-union/blob proofs passed; no shared Swift/lint work, no CI wait.
> - Evidence reviewed/reused from peers: `20260927-stream3-profile-message-return-r1`, seal `bf5ebac08780305e60e1f2636574d8871716b414a1f070c4cf3348e1cf9cbacf` (real Chrome/API/SQL, existing DM only, two participant preimages restored; retained access/login bookkeeping); `20260927-stream2-home-icon-color-r1`, seal `ff8e6d5bfe87b0e85758bced68b9d8e205529ab6a698ecfcc55563adb4ac912c` (Chrome populated checklist/hover/missing-property, no writes; empty branch source-checked only). Native trees unchanged by these batches.
> - S1 personally built/installed baseline `d5df4e81c` and reproduced dead section retry in **both Start and post-sign-in pending preview on iOS F4DBD47E and Android5558**. Two real button taps per screen sent zero new preview requests despite healthy stand-in installed. Existing #607 fault recipe used; external geocoder/providers remain unverified. Bundle `20260927-stream1-native-start-preview-retry-r1` is **in progress, not accepted/sealed**. No place/Home fixture saved.
> - Minimal ten-file native caller/viewmodel repair committed `2d3486201` on `codex/native-preview-retry-20260927`, based on current master in the existing runtime worktree; original runtime branch retained. Existing retry/loading cards reused, one request in flight, Android renderer default retrying=false extended for parity. Candidate builds and real failure/recovery reruns remain next, then iOS Report post/Android parity. No unit tests or redesign.
> - S1 iOS before-cases complete: own sim shut down/slot1 released, driver handed to S2 then S3. S1 keeps Android5558 slot2; S3 currently heavy building iOS and owns slot4. Live slot scripts win over this snapshot. Queue empty; unrelated #46/#429/#430/#625 untouched.

> **UPDATE 2026-09-27T13:05:33Z — Stream 1 successor / batch 43 merged.**
> - [#627](https://github.com/WangPantopus/skinny-pantopus/pull/627) merged at 2026-09-27T13:03:22Z → master `3125bb150a33fa217092c002d5ac1eee119da6ac`; includes Stream 2 [#626](https://github.com/WangPantopus/skinny-pantopus/pull/626), exact head `5e1a616d47ff4efaa5896e8cac448feed6f3b29a`. Exact-head review, 41-file sealed UI/API/SQL bundle, ancestry/file union/blob proof passed; no shared Swift files. CI was informational, not a gate. Bundle `20260927-stream2-home-edit-coordinates-r1`, seal `66ab3a82089463be33a2759f16a31cf4ff4e91ac54060d8c87ad6c7862e5612e`; provider autocomplete EMULATED, native unchanged, owned Home cleanup 0→1→0.
> - Queue empty. Unrelated #46/#429/#430/#625 untouched. One current-master CI snapshot was taken at takeover: `35c5434df` run 36316539221 passed; required checks absent, admin/no-force/no-delete protections remain.
> - Stream 1 first item remains native Start/address-preview retry, then iOS Report post and Android parity. Current baseline runtime tree `d5df4e81c` equals takeover master; real iOS baseline installed, Android app-only build running. Owned runtime 18132/18138/18139 was restored using guarded helpers after inherited processes exited. No application fix or new journey accepted yet. No database reset, no unit/lint campaign.
> - S1 holds heavy plus device slots 1 (F4DBD47E/iOS driver) and 2 (5558); S3 is next for heavy. S2 owns Home editor/F02 and its own status; S3 owns DM/profile work. Current launch cuts and safety limits unchanged.

### 0.0 ⚠️ LAUNCH SCOPE — 2026-09-27 (user direction; applies to everything below)
- **What's cut:** 8 features are hidden behind flags for the first launch. The code is kept, and the user handles the flagging.
- **Rule:** they are **not verified, end-to-end tested or fixed**. The shared table is at the top of PROJECT_HANDOFF/README (coordination `d2bf06e36`).
- **Stream 1's cuts:**
  - **#3 Marketplace:** listings, listing offers, trades, listing Q&A, buyer–seller chat, listing Home slots, My Listings, Snap & sell.
  - **#4 Open Gigs marketplace:**
    - public task posting (V1/V2/magic-post UI);
    - browse feed/map/search/categories/filters, saved searches and alerts, hidden categories, task bookmarks;
    - bids/gig offers/counters, My bids, bid expiry, stranger instant-accept, task Q&A, provider search.
  - **#6 General business directory:** Discover businesses, business search, the map business layer.
  - Hub/Discover entry points into these, and #1/#2 touch points.
- **Still in:**
  - payments, tips, AI drafting;
  - the task lifecycle after assignment (start/complete/confirm/review/stop/reschedule) as a known crew uses it;
  - My tasks and the rebook rail; Support Trains; Hub; Pulse; Posts; `/start`/Place preview; accounts.
- **Merged work in cut areas stays as future-ready work:** #580, #581, #586, #589, #592, #601, #606, #615, #616, #617 and others. Don't re-verify them. The inventory tags 101 rows `⛔ OUT OF LAUNCH SCOPE` / `◐ PARTLY OUT`.

### 0.1 Final state: every Stream 1 PR merged; queue empty
- **Master: `35c5434df`** (batch 42). The runtime worktree equals master (runtime commit `d5df4e81c`).
- **Merged today:**
  - **Batch 37 [#572]:** merged 05:19:24Z → `563cddb47`.
  - **Batch 38 [#585]:** merged 08:01:42Z → `f6c66d678`. S1 #580, #581.
  - **Batch 39 [#599]:** merged 08:59:13Z → `9f3ba7c35`. S1 #571, #586, #588, #589, #592; S2 #587, #590, #591.
  - **Batch 40 [#608]:** merged 10:26:20Z → `a93c76d7f`. S1 #601, #606; S2 #602; S3 #593–#596, #600. It was rebuilt once after the user's docs PR #614 moved master.
  - **Batch 41 [#622]:** merged 11:11:36Z → `73e0baade`. S1 #598, #603, #607, #617; S3 #597, #604, #605, #612; S2 #609, #610, #611, #613.
  - **Batch 42 [#624]:** merged **directly** at 11:14:24Z → `35c5434df`, after the user turned off required CI (0.2). S1 #615, #616; S3 #618, #623; S2 #619, #620, #621.
- **Every PR this session opened is merged:** #571 #580 #581 #586 #588 #589 #592 #598 #601 #603 #606 #607 #615 #616 #617 (checked with `gh pr view` at ~11:15Z).
- **Peers:**
  - Stream 2 reports every one of its PRs from this session is merged.
  - Stream 3 reports all 11 of its PRs from today are merged.
- **Queue:** `queue.txt` is empty. The runner is not running; its last log line is the coordinator's direct merge of #624.
- **Still open, all untouched:** #46, #429, #430. **Note on #430** (the user's older "read geo autocomplete center as [lng, lat] in three readers"):
  - After S1 #606 (merged; the `@pantopus/api` geo client now returns `center` as `{lat, lng}`), two of #430's three files (`PostLocationPicker.tsx`, `QuickModifiersV2.tsx`) would **break** if #430 were merged as is: they would look for an array.
  - Its third file, the web home edit page (`homes/[id]/edit/page.tsx:133-140`), does a raw `fetch` of `/api/geo/autocomplete` and still reads `center.lng` from an array, so it is **still broken on master**.
  - That lead was handed to Stream 2 (Home domain) at 11:17Z. Recommend the user close #430 and take the one-file fix.

### 0.2 Merge policy changed by the user (2026-09-27 ~11:13Z)
- **The user's words:** turn off "the requirement of mandatory all checks pass on CI before we could merge PRs … so we just merge them directly, as long as you did app launch end to end test on the feature, function, flows that they work well. We do not care about these unit tests or so many lints here in the CI."
- **Done at 11:13:55Z:** removed only the required status check `CI OK` (strict) from master's branch protection. `enforce_admins`, no force pushes and no deletions remain.
  - Saved config, restore command and log: `docs/workstreams/coordinator-state-2026-09-23/repo-settings/` (README + before/restore JSON).
- **How to merge now:**
  1. Review each PR.
  2. Verify its sealed bundle, and confirm its owner's end-to-end check in the real apps (iOS sim / Android emulator / web).
  3. Build the combined batch with `build-batch.sh`, and prove it with `verify-batch.py` (exact hunk proofs) and `lint-batch.sh`.
  4. Merge it with `gh pr merge <batch> --merge --match-head-commit <tip>`.
  - Don't use `run.sh`; it still waits for `CI OK`.
  - CI keeps running on PRs and master (informational). **If master's post-merge CI shows a real break, fix it forward promptly.** At handoff, CI for `35c5434df` had just started.

### 0.3 Runtime, devices, slots (at handoff)
- **Runtime:**
  - Backend 18132: pid **63774**, started 11:11:53Z on master code (log `logs/backend-111153.log`; `/api/hub` 200 at 11:18Z).
  - Fault proxy 18138: pid 86966, no rules. Next 18139: pid 48094 (`/start` 200).
  - DB: all of today's fixtures cleaned (checked transaction; snapshot diff = sign-in bookkeeping only).
- **Devices:** all shut down; Stream 1 holds **no** heavy or device slots.
  - Sim F4DBD47E has the verify build `4f954d721` installed, and emulator-5558 has APK `installed-5558-4f954d721.apk`. alice is signed in on both.
  - **Cleanup (2026-09-27, at the user's request):**
    - Deleted: the saved iOS app copies, the iOS DerivedData `/private/tmp/pantopus-stream1-ios-dd` (8.3 GB) and the runtime-dir APK copies.
    - For the next native check, rebuild from master with `build-ios-held.sh` / `build-android-static.sh`. The first iOS build is a cold build.
    - The runtime itself (backend, proxy, Next, Supabase containers), the evidence bundles, the simulator and the emulator were kept.
- **How backend PRs were served for an "after":** check out the branch's files into the runtime worktree, SIGINT-restart, test, check them back out, SIGINT-restart again. Leave the worktree clean.

### 0.4 Peers at handoff
- **Stream 2** ("Stream 2 handoff takeover"): all its PRs are merged. It was running one post-merge end-to-end check of #609 + #611 on master, then writing its handoff.
- **Stream 3** ("fix(native): live chat keeps working after a token refresh; Android reactions update in place"): all 11 PRs are merged, and it is writing its final handoff.
  - Its earlier handoff: `NEXT-STREAM3-PROMPT-2026-09-27.md` and the `03-accounts-social.md` CURRENT RESUME block.
  - Its "next item" (the web `resolvePolicyValue` companion) was delivered as #623 and is merged.

### 0.5 Decisions taken today under the user's standing instruction (each is also in its PR and the inventory)
The user's instruction (~07:22Z): "do not stop anymore, just go with what you recommended … make sure you record all these every time."
1. **Web Discover without a location:** keep the empty block and button, and change the copy (#592).
2. **Native $0 "Flat" edit:** keep the web rule (budget > 0); only the edit-mode copy changed (#598).
3. **Support Trains empty states:** honest "Location needed" / "Couldn't load … Try again" in the same frame (#603).
4. **Native edit of an unlisted category:** keep the stored value and show its name (#615).
5. **`/app/discover-hub`** (orphan page): WON'T FIX.
6. **Reschedule notice:** explicit "UTC" (#588).
7. **Listing slot:** held only while `active`; returning claims one, with 409 at the cap (#589).
8. **Taxonomy split:** canonicalize at the API boundary, with no migration and no client change (#617).
9. **"now ago":** "just now" (#616).
10. **Magic-post** is canonicalized too (in #617).
- The user decided these directly: listing Home access = "Require Home access" (#586); V1 = "Address search in the app" (#571); V2 = "Same address search" (#580).

### 0.6 Remaining Stream 1 work, in order (launch scope applied 2026-09-27)
1. **Native Start/launch preview "Try again" is dead** (in scope: the `/start` funnel and Place preview).
   - `PlaceSectionCard` calls `onRetry?()`, but `PlacePreviewBody.swift:253`, `PendingPlaceView.swift:53` (iOS) and `PlaceLaunchScreen.kt:737` (Android) pass no `onRetry`.
   - S2 #619 (merged) gave `PlaceSectionView` `onRetry`/`retrying`. The fix is one argument per call site: re-run that screen's preview load.
   - Before/after: reuse the web #607 fault-proxy stand-ins (bundle `20260927-stream1-web-start-funnel-retry-r1`, `stub/`).
2. **iOS Report post** (inventory: "not run"; in scope: Posts): seed a post by bob with a real location through `api.py`, run the report flow on iOS (and check Android parity), then clean up.
3. **Watch master's post-merge CI once** (0.2), and fix forward on a real break.
4. **Dropped by the launch scope** (don't do these):
   - the iOS listing-Offers empty-state CTA (#3);
   - native feed rows for a no-category task (#4);
   - the web edit form's raw legacy key (#4);
   - the legacy category-key relabel after #617 (#4).

### 0.7 Evidence bundles made this session
All are under `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`:

| Bundle | Seal |
|---|---|
| `20260927-stream1-quickpost-address-search-r1` | `bba44d1b…` |
| `20260927-stream1-v2-compose-address-r1` | `a4c865b1…` |
| `20260927-stream1-listing-home-access-r1` | `861841b4…` |
| `20260927-stream1-reschedule-notice-utc-r1` | `9e41f879…` |
| `20260927-stream1-web-discover-no-location-r1` | `9b11e251…` |
| `20260927-stream1-native-copy-parity-r1` | `c2d76d6c…` |
| `20260927-stream1-web-offers-load-failure-r1` | `bb648858…` |
| `20260927-stream1-native-trains-notice-r1` | `d811d404…` |
| `20260927-stream1-web-geo-center-r1` | `105070cb…` |
| `20260927-stream1-web-start-funnel-retry-r1` | `fea6e81d…` |
| `20260927-stream1-native-edit-category-r1` | `08caf144…` |
| `20260927-stream1-native-feed-just-now-r1` | `6951989a…` |
| `20260927-stream1-gig-category-canonical-r1` | `acc4bfb5…` |

The living inventory `20260925-stream1-domain-inventory-r1/INVENTORY.md` has a "Successor findings 2026-09-27" table, and its merge-state header was updated at 09:15Z.

### 0.8 Worktrees created this session: REMOVED (2026-09-27, at the user's request)
- **Removed:** all 19 of this session's worktrees under `/private/tmp/pantopus-stream1-*`, with `git worktree remove` and no prune or gc. That's the 17 PR checkouts plus the two local `verify/*` trees. `batch39-check` was also removed.
- **Checks before removal:** each was clean, and each HEAD was merged into master or superseded (edit-copy is on master via #598; the verify trees held merged or amended-away commits).
- **Local branches** were deleted. The remote PR branches stay on GitHub.
- **Kept:** older entries (`/private/tmp/pantopus-stream1-web-trade` with its uncommitted change, and the stale entries) and the runtime worktree `stream1-peer-takeover-d2cb25`.

### 0.9 Lessons from this session (in addition to §11)
- **Timestamps:** never hand-type a time in a peer message. A "09:14Z" was corrected to ~09:10Z.
- **Pushes:** `git push -q` failed silently twice at 09:52Z. Retry without `-q`, and confirm with `git ls-remote`.
- **API helper output:** `api.py` truncates JSON at 3000 chars. Set `LIM=500000` to parse lists.
- **Express 5:** `req.query` is a getter that re-parses, so mutating it in middleware does nothing. Canonicalize per handler.
- **SwiftLint in CI** runs `--strict`, so the file_length *warning* (500) fails.
- **detekt:** MaxLineLength is 140, and an extra branch can trip CyclomaticComplexity on big projection functions. Use a helper.
- **Combined verify tree:** to verify several PRs in one heavy window, merge their heads into a local `verify/*` branch, prove each PR's files are byte-identical in it, build once per platform, and keep one bundle per PR. The seal records a single head.
- **Before builds:** an older APK can serve as a master "before" when its relevant files are byte-identical to master. Record the blob-id proof in the bundle.
- **Merge policy (the user, ~11:13Z):** required CI is off. Merge directly after review, a sealed end-to-end bundle and batch proofs. The `run.sh` runner no longer applies.
- **Superseded PRs:** before merging an old PR, check whether a newer merge changed its assumptions. #430 now conflicts semantically with #606.
- **Coordination checkout:** it is shared with peers' uncommitted edits (at 09:57Z Stream 3 had `03-accounts-social.md` modified). Commit only your paths. If a rebase is refused because of their dirty file, don't stash; wait, or commit from a separate worktree of the coordination branch.

---

## 0-prior. Earlier final state (2026-09-27T02:31:47Z; historical, superseded by §0 above)

**The queue is empty, the runtime equals master, and every Stream 1 fix is merged.**

**Master:** **`89f3c6bac5df4f67d52888a300d6128be834101a`**. The last merges:
- **Batch 35 [#556](https://github.com/WangPantopus/skinny-pantopus/pull/556)**, 2026-09-27T02:23:56Z → `0bd3759f4`: S1 #548, #553, #550, #554, #555 and S3 #552.
- **Batch 36 [#561](https://github.com/WangPantopus/skinny-pantopus/pull/561)**, 2026-09-27T02:31:01Z → `89f3c6bac`: S3 #557, S2 #558 and S2 #559.

The runner log ends "02:31:08 PR561 MERGED … QUEUE EMPTY / QUEUE STOP", `queue.txt` is empty, and no `run.sh` is running.

**Runtime:**
- Tree = `89f3c6bac` (runtime worktree merged, clean).
- Backend pid **8667**, started 02:31:29Z (log `logs/backend-023129.log`); SIGINT-restarted for #557.
- `/api/hub` returned 200 at 02:31:39Z.
- DB ledger 92 = master's 92 migrations.
- Proxy 18138 (pid 86966) and Next 18139 (pid 48094) are up.

**Open PRs at 02:31:47Z:**
- **S2 [#560](https://github.com/WangPantopus/skinny-pantopus/pull/560)** (`a406d3055`): iOS test-only fix of the flaky `TokenAcceptViewModelTests` assertion. **Reviewed OK; "CI OK" passed at 02:31:47Z.**
  - Put it in your **first batch**, ideally with the iOS PRs below, so that batch's CI already has the fixed test.
- **S2 [#563](https://github.com/WangPantopus/skinny-pantopus/pull/563)**, health "View maintenance" → Issues (D04):
  - Head `08a1b6dc4af8db3935a26f2f727a835443948bba` on `73b98f6b6`. Six files: both apps' mapping, the iOS `view_issues` handler/gate, and **2 existing tests' expectations** (a behavior change, not new tests).
  - Bundle `20260927-stream2-health-view-issues-r1`, seal `08d77b43…` (27 files).
- **S2 [#564](https://github.com/WangPantopus/skinny-pantopus/pull/564)**, Members → Guests "Add a guest" → guest-pass manager (M02):
  - Head `cd91364ff09755513bf01b792f795d51fa5a1eae` on `73b98f6b6`. Three files: `RootTabScreen.kt`, `HubTabRoot.swift` and `YouTabRoot.swift`.
  - `RootTabScreen.kt` and `YouTabRoot.swift` also changed in batch 35 (#550/#552). Prove the tip's hunks as in §4 step 3.
  - Bundle `20260927-stream2-guests-tab-pass-manager-r1`, seal `801cb517…` (58 files).
- **Checks by Stream 1 for #563/#564** (after 02:33Z):
  - both bundles verify;
  - merge-tree is clean against master `89f3c6bac`, against each other and against #560.
- **Still to do:** **Their code has NOT been reviewed by Stream 1.** Read both diffs before batching. CI was starting when Stream 2 reported them.
- **Suggested first batch:** #560 + #563 + #564 (+ Stream 3's chat fix if ready).
- **#562** `claude/porchlight-product-design` ("docs(product): Porchlight product design proposal"). It isn't from the streams and isn't in the queue, so leave it unless the user asks.
- #430, #429 and #46 are unrelated; don't touch them.

**Coming from peers:**
- **S3 chat re-subscribe fix** for both apps (branch `claude/stream3-native-chat-resubscribe`, head `f009f6be7` at 02:23Z). Stream 3 was running its Android/iOS before/after at 02:31Z (heavy + slot 3).
- **S2 native §3A #3 + #4:** Guests tab → guest-pass manager; health "View maintenance" → Issues. #3 touches `RootTabScreen.kt`, so prove it against `89f3c6bac`.

**Stream 1's own open work:**
1. **Implement the user's decision on native "Post task" at 0,0** (§3.2, HIGH).
2. The low inventory items (§3.3).

**Stream 1 holds no slots.** The latest peer report, received after 02:37:57Z:
- Stream 3: heavy (since 02:23:21Z), slot 1 (iOS driver, taken 02:37:57Z after Stream 2 handed it over) and slot 3 (emulator-5554), all for its chat re-subscribe checks.
- Stream 2: slot 2 (emulator-5556).
- Slot 4 is free.

Check `device-slot.sh status` live.

**My devices** are shut down:
- iOS sim F4DBD47E has the #548 build;
- emulator-5558 has the #554 build (APK `8fedfceda`).

Rebuild both from master before native checks.

## 1. Role and standing rules (from the user; still in force)

**Role.**
- Stream 1 is a **peer** of Streams 2 and 3, not their manager.
- **Domain:**
  - gigs / tasks;
  - marketplace, offers and payments;
  - tips;
  - Support Trains (task side);
  - the Shared UX surfaces Hub, Discover, Pulse and Posts;
  - PR425.
- **Integration:** Stream 1 is the **sole serial integration / merge-queue operator** and keeps the shared hub status files in this checkout (`/Users/yingpengwang/pantopus-coordination`, branch `codex/workstream-coordination`).

**The work.**
- Inventory every reachable feature, journey and edge case on the real web app, the iOS simulator and the Android emulator, against Stream 1's isolated backend.
- Trace screen → caller → API → DB, make the smallest in-place repairs, and rerun.
- Integrate peer PRs through combined batches (§4).
- After milestones:
  - update the hub README, `PROJECT_HANDOFF.md` and `01-gigs-payments.md`, commit and push this branch;
  - update Claude memory;
  - message the user and the peers.

**Verbatim user constraints.**
- "You, yourself will be doing all the work … do not let any subagents do your work" (subagents only for web research).
- "Never modify `/Users/yingpengwang/skinny-pantopus` or contact founder 64521/64522/backend 8000 or simulator EB5AD759." Reading files there is fine: `build-android-static.sh` reads the Stripe publishable key from it.
- "No search-filter security audit."
- "Stripe TEST/manual only, no capture."
- "No secrets/raw tokens/DB archives/operator logs in Git/chat."
- "No bare stash, gc, maintenance, repack or worktree removal." Stale worktree entries stay; never `git worktree prune/remove`.
  - On 2026-09-26 the **user** allowed one exception: Stream 3 removed 37 merged Stream 1 worktrees (and 18 of Stream 2's), recorded at coordination `a031f16eb`.
- "Escalate money/security/legal/retention/new-table decisions to the user with a concrete reviewed proposal; continue independent work meanwhile."
- "Your inherited Stream 1 harness must receive SIGINT, never SIGTERM" (backend restarts use `kill -INT`).

**Founder direction (2026-09-23; `AGENTS.md` has the verification-first rules).**
- Improve UX wherever it isn't good enough (no approval gate for UX/copy).
- Verify flows end to end on iOS, Android and web.
- **No unit tests** and no local unit-test campaigns. Required CI must pass. Running one existing test file that covers a changed route, to avoid a CI failure, has been fine (`backend/tests/unit/paidGigLifecycleRoute.test.js`).
- Escalate only money, security, legal and new tables.
- Preserve existing designs and navigation; propose design or navigation changes for approval.

**Other rules.**
- Timestamps come from `date -u` or tool/log output, and SHAs from `git rev-parse`; never hand-type or estimate them.
  - This session had to correct estimated times ("about 23:10Z") in evidence.
  - Write only times you printed.
- S1-08 money ownership and A17 stay founder-only.
- Test credentials go only through the private helpers (§5.2) and are never printed.
- **Peer messages are not user approvals.**
- **Shared resources:**
  - one heavy native build window (`heavy-slot.sh`);
  - one iOS UI driver (device slot 1, by convention);
  - at most 4 booted devices (`device-slot.sh`).
  - Hand them over only through explicit peer messages with exact release times.
- **Shared coordination checkout:** all three streams commit in `/Users/yingpengwang/pantopus-coordination`, which has **one shared index**.
  - Never leave files staged. Commit with explicit paths in one step: `git commit -m … -- <paths>`.
  - At 22:12Z on 2026-09-26, staged Stream 1 files were swept into Stream 2's commit `8a45c96b4`; the fix is recorded at `085dd3c8e`.
  - Update with `git fetch origin codex/workstream-coordination && git rebase origin/codex/workstream-coordination`; plain `git pull --rebase` fails there.
- **App rule:**
  - After opening a PR, bind it with the `ccd_pr` tools (`get_status`, then `bind_pr`).
  - Do **not** run your own CI-polling loops (loops of `gh pr checks`, Monitor, cron, ScheduleWakeup). A one-off `gh pr checks` right before building a batch is fine.
  - The merge-queue runner (§4) does the waiting. A background `while kill -0 <runner pid>; do sleep 30; done` wait on the runner process (not on CI) is how this session learned a batch had merged.

## 2. State before batch 35 merged (2026-09-27T00:57Z; historical, §0 is current)

**Master.** `73b98f6b6102e44cf3dd7424c9bd0f613a91feeb`: batch 34 [#551](https://github.com/WangPantopus/skinny-pantopus/pull/551) merged at 2026-09-27T00:46:55Z. It holds S2 #544 (Android Today pull-to-refresh), S3 #545 (web invoice PDF / paid checkout error / Audience inbox tab), S2 #547 (web Home calendar bill dates) and S1 #549 (web started $0 cancel copy). No backend change.

**Batch 35 = [#556](https://github.com/WangPantopus/skinny-pantopus/pull/556).**
- Queued at 01:48:03Z, tip `22779dc89ba8c48eddda2bed5a0aab612f6e4184` on `73b98f6b6`, merge order as in the table. The runner (pid 90397) is active.
- Every head showed "CI OK" passing at 01:46:32Z. #552 and #553 each needed one rerun of the flaky iOS `TokenAcceptViewModelTests` job (§4.7).
- All §4 checks passed on the real tip, including the three special files below. All six bundles re-verified.

| PR | Stream | Head | Scope | Bundle seal (files) | Review |
|---|---|---|---|---|---|
| [#548](https://github.com/WangPantopus/skinny-pantopus/pull/548) | 1 | `e46391aa6927fba633c1da4ed1ba0652d3b18e0e` | iOS+Android: the helper starts from the dock; `/start` reply fix (**backend**); $0 delivery copy. Base `f885e0623`. Its iOS `GigDetailViewModel.swift` also got #537 on master: prove the tip's diff for that file equals master's delta. | `20260926-stream1-native-helper-dock-r1` `25ad4e68…` (48) | own |
| [#553](https://github.com/WangPantopus/skinny-pantopus/pull/553) | 1 | `bfd879dae6f97a6222c9b04ba37a8272589aecde` | **stacked on #548** (its head contains #548's 2 commits); `backend/routes/gigs.js` only. Edit/reschedule/mark-completed/confirm replies through `savedGigReply`, plus the reschedule notice's context type (**backend**). | `20260927-stream1-gig-write-replies-r1` `1d082ae3…` (93) | own |
| [#550](https://github.com/WangPantopus/skinny-pantopus/pull/550) | 1 | `a2a3f381f69e70815ed68113afa0a9bfc0ae1db7` | Android `RootTabScreen.kt`: tab re-tap + Gigs door (user decisions) | `20260926-stream1-android-tab-nav-r1` `9de2523c…` (23) | own |
| [#554](https://github.com/WangPantopus/skinny-pantopus/pull/554) | 1 | `1e3ed71f847cb3cd2299cf25d7cfcefa0881b586` | Android edit keeps the task's location (`PostGigV1ViewModel.kt`, `GigDtos.kt`) | `20260927-stream1-android-edit-location-r1` `d482bdbc…` (27) | own |
| [#555](https://github.com/WangPantopus/skinny-pantopus/pull/555) | 1 | `9e62e9aefd4e99f3f13ca882f369eeed4091e23e` | **backend**, 1 file: saved-search task alerts use a valid notification context (they were all dropped). Stream 3 found it. | `20260927-stream1-saved-search-alerts-r1` `2b29d13f…` (11) | own |
| [#552](https://github.com/WangPantopus/skinny-pantopus/pull/552) | 3 | `520ed06cfc319927d2ee5aaa77d5d3ad160c37d6` | native, 12 files: S3-64 / S3-37 / S3-35 (user decision) / S3-59 + iOS Booking notifications Back | `20260926-stream3-native-dead-controls-r1` `33d6a0c9…` (68) | **reviewed OK**: bundle verified; merge-tree clean against master and against #550 |

- **Shared file:** #552 and #550 both change `RootTabScreen.kt` in different regions (the Beacon setup CTA near line 5373, and the bottom bar / Gigs door). Neither tip blob will equal a head blob, so check that each PR's hunks appear unchanged in `git diff origin/master <tip> -- …/RootTabScreen.kt`.
- **Also proven:**
  - `backend/routes/gigs.js` in the tip equals #553's head, because #553 contains #548.
  - #548's iOS `GigDetailViewModel.swift` differs from #553's head only by master's #537 line.
- **After batch 35 merges:** restart the Stream 1 backend (#548, #553 and #555 change the backend; no migrations), then mark the inventory rows merged.

**Next batch candidate: S3 [#557](https://github.com/WangPantopus/skinny-pantopus/pull/557)** (new-post fan-out notices; `backend/services/postCreationHooksService.js` only, the same context-type fix as #553/#555).
- Head `097e3e0875b8e0ff8e525bb89373c9cabef07c50` on `73b98f6b6`; bundle `20260927-stream3-post-fanout-context-r1`, seal `e307f44a…` (25 files).
- **Reviewed OK by Stream 1:** bundle verified; merge-tree clean against master and against the batch 35 tip.
- "CI OK" passed at 01:57:52Z. It is backend, so restart the runtime after it merges.

**Also a next-batch candidate: S2 [#558](https://github.com/WangPantopus/skinny-pantopus/pull/558)**: web "Message household admin" tells the truth. That's user decision §3A-2, "truth-only". It is 1 file, `app/(app)/app/homes/[id]/messages/page.tsx`.
- Head `ddaaa480ea9cd3fe6ddf3406d44731ef8ea42672` on `73b98f6b6`; bundle `20260927-stream2-admin-chat-truth-r1`, seal `16757367…` (17 files).
- **Reviewed OK by Stream 1:** bundle verified; merge-tree clean against master, the batch 35 tip and #557. The viewer id comes from `getMyProfile()`, which unwraps `{user}`.
- CI was pending at 01:57:52Z.

**Also a next-batch candidate: S2 [#559](https://github.com/WangPantopus/skinny-pantopus/pull/559)**: user decision §3A-5.
- **Change:** the unlinked web stub `/app/homes/:id/members/add-guest` showed a fake "…has been added as a guest" toast and made no API call. It now redirects to Guest Passes (`/app/homes/:id/share`), like `/message` → `/messages`. One file.
- Head `71e860381e8ae03dadc758bebab099a890c4d0b8` on `73b98f6b6`; bundle `20260927-stream2-add-guest-stub-redirect-r1`, seal `20b07a0d…` (9 files).
- **Reviewed OK by Stream 1:** bundle verified; merge-tree clean against master, the batch 35 tip, #557 and #558; no in-app link to the stub.
- CI was starting at 02:00:55Z.
**Also a next-batch candidate: S2 [#560](https://github.com/WangPantopus/skinny-pantopus/pull/560)**: the TokenAccept test flake. The existing iOS assertion now counts only `/api/v1/tenant/` calls. One test file, 1 line + comment.
- Head `a406d30554cce728f43e0c02f4c86c31edd82341` on `73b98f6b6`; bundle `20260927-stream2-tokenaccept-test-flake-r1`, seal `7a5ce63d…` (6 files).
- **Reviewed OK by Stream 1:** bundle verified; merge-tree clean against master, batch 35, #557, #558 and #559.
- The leftover chat view models are Stream 3's to look at; Stream 2 told them.

- **Batch 36 plan:** #557, #558, #559 and #560, whichever are green. They are disjoint files.

**Other open PRs** (not in the stream queue; don't touch): #430, #429 (Ballot P0), #46.

**Runtime.**
- The runtime worktree `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream1-peer-takeover-d2cb25` (branch `stream1/runtime-integration-20260925`) has a **tree equal to master `73b98f6b6`** and is clean.
- Backend pid **83519** (started 00:52:25Z, log `logs/backend-005225.log`), proxy 18138 pid 86966, Next 18139 pid 48094.
- DB ledger: 92 migrations (= master).
- `/api/hub` returned 200 as alice at 00:52:34Z.

**Slots (00:46:58Z).**
- Stream 1 holds **nothing**.
- Slot 2 is Stream 2 (emulator-5556). Slots 1, 3 and 4 are free, and heavy is free.

**Devices.**
- **iOS sim F4DBD47E** ("Pantopus Coord Tip Refresh"):
  - Shut down; the keychain holds **alice**.
  - Installed app: **#548 build**, dylib `739c3184…` from `e46391aa6`. It lacks #537's qa-update line.
  - Rebuild from master before new iOS checks.
- **Android emulator-5558** (AVD `Pantopus_Stream1_Start_R2`):
  - Stopped at 00:46:58Z; **alice** is signed in.
  - Installed APK: **#554 build** `8fedfceda…` from `1e3ed71f8` (master `f7f51eae4` + #554).
  - Rebuild from master after batch 35 for new checks.

## 3. Next actions, in order

**3.1 Finish the queue.**
1. **Batch 34** merged at 00:46:55Z (`PR551 MERGED` in the runner log).
2. **Batch 35 = #556** (queued 01:48:03Z): #548, #553, #550, #554, #555, #552, in that order. Check the runner log for `PR556 MERGED`. If it logs `CI_fail`, look at the failed job (a `TokenAccept` flake gets one `gh run rerun <run> --failed`); otherwise follow §4.7.
   The steps below are how the batch was built (for the next batch).
   - One-off `gh pr checks` on each head (all must show "CI OK" pass).
   - Build on the **new** master and verify exactly as §4. Exceptions:
     - #553's files = `backend/routes/gigs.js` plus #548's files. Its tip blob for `gigs.js` must equal #553's head blob.
     - `RootTabScreen.kt` is shared by #550 and #552 (see §2).
     - #548's iOS `GigDetailViewModel.swift` also changed on master (#537): prove the tip's diff equals master's delta.
   - Push `claude/coord-merge-batch-35`, open it (template #551/#546), bind, queue, start `run.sh`, and message both peers.
   - Batch only green heads; don't hold a green batch for a slow one.
3. **After batch 35 merges:**
   - `git merge origin/master` in the runtime worktree.
   - `kill -INT <backend pid>`, then `nohup bash start-backend.sh > logs/backend-$(date -u +%H%M%S).log 2>&1 &`.
   - Check `/api/hub` returns 200 (re-login with `api.py login alice` if you get a 401).
   - Mark #548/#550/#553/#554/#555 merged in the inventory, update the hub docs and memory, and message the peers.

**3.2 IMPLEMENT the user's decision (HIGH): native "Post task" creates tasks at 0,0.**
- **The defect:**
  - The Hub's "Post task" on both apps opens the quick-post V1 form (Android `ChildRoutes.quickPostGig`, iOS `PostGigV1View` from `HubTabRoot`).
  - It has only a free-text location, and it sends `latitude/longitude 0`.
  - `POST /api/gigs` stores the coordinates as given, so such tasks are created at POINT(0 0) with no city: invisible in every neighbor's feed and map.
  - iOS's code comment cites a "V2 composer" (`GigComposeViewModel`) that no longer exists.
- **Reproduced on the real Android app:** "1200 Main St, Vancouver, WA 98660" → POINT(0 0), POST 201 at 2026-09-27T00:38:25.430Z. Bundle `20260927-stream1-android-edit-location-r1/android/create-candidate/`.
- **User decision 2026-09-27 (AskUserQuestion; answer received before 01:34:54Z): "Address search in the app".** Implement:
  1. **App:** the quick-post location field offers the same address suggestions the Add Home screen already uses:
     - iOS: `GeoEndpoints` `GET /api/geo/autocomplete?q=` → `POST /api/geo/resolve`, as in `AddHomeWizardViewModel` / `HomeTaskGigViewModel`;
     - Android: the equivalent existing calls.
     - A picked suggestion supplies real coordinates plus city/state/zip for create **and** edit (#554 already re-sends loaded coordinates on edit).
     - These calls are metered and billed, so debounce the typeahead as Add Home does.
  2. **Backend:** `POST /api/gigs` and `PATCH /api/gigs/:id` reject a (0, 0) location with a clear 400 ("Pick an address from the suggestions"), so no app version can place a task at 0,0 again. Check the web composer never sends (0, 0) first.
  3. **Design:** keep the form's layout (suggestion list under the existing field, like Add Home).
  4. **Verify:** before/after on both apps (the task lands at the picked address and shows in a neighbor's nearby feed), web unchanged, and the API refusal of (0, 0).

**3.3 Remaining Stream 1 inventory** (all low unless noted; each row in the inventory has details).
- **Web:**
  - `/app/offers` swallows a rejected request (OPEN, source; orphan page). **FIXED [#601](https://github.com/WangPantopus/skinny-pantopus/pull/601)** (bundle `bb648858…`).
  - `/app/discover-hub` orphan page links. **WON'T FIX** (2026-09-27 decision: orphan page, no entry points).
  - Discover with no location stacks two notices. **FIXED [#592](https://github.com/WangPantopus/skinny-pantopus/pull/592)** (bundle `9b11e251…`).
- **Native:**
  - iOS Support Trains scope reads "none nearby" without device location. **In progress** (both apps; branch `claude/stream1-native-trains-empty-honest`).
  - Android Tasks feed Support Trains read (best-effort).
  - iOS Report post: not run (needs a non-alice post fixture).
- **New this session** (source-verified or seen on device):
  - Native edits clear `exact_city/state/zip`. Proposal: the PATCH keeps them when the location object omits them.
  - Native edit forms know 8 categories only ("Other" → Handyman on Android / none on iOS): a taxonomy decision. **Decided 2026-09-27 (standing instruction):** preserve the stored category unless the owner picks one; implementation after #571 merges.
  - The Android edit form won't save a $0 "Flat" task, and says "We couldn't post your gig." in edit mode. **2026-09-27: the $0 rule is kept** (web also requires a budget above 0 on create and edit; decision recorded). The edit-mode copy is fixed on both apps (branch `claude/stream1-quickpost-edit-copy` `e81043a39`; device check pending).
  - The reschedule notice prints server-timezone time. **FIXED [#588](https://github.com/WangPantopus/skinny-pantopus/pull/588)** ("… UTC"; bundle `9e41f879…`).
  - The saved-search alert context type is fixed in #555. The same `'post'` bug in `services/postCreationHooksService.js:148` is Stream 3's; they have a local fix (`097e3e087`) awaiting their user's approval of an end-to-end write, likely for batch 36.
- **Recommended audit** (the pattern behind #548 and #553):
  - Any backend write that replies with a raw `select('*')` row can break native decoding. PostGIS `geography` columns become EWKB hex strings, and `to_jsonb(geography)` too.
  - Scan other Stream 1 routes (listings, posts, offers) for `res.json({ …: <raw row> })` whose reply native decodes with a full DTO. Check the DTO's location type, and verify on device before changing anything.
  - Also grep `createNotification({ … contextType:` for values other than `personal`/`business`.
  - **Done 2026-09-27 (successor, source audit of master `7bdef3e8c`; no code change):**
    - **contextType:** clean. No backend caller passes `contextType` anymore; `createNotification` and the bulk insert default to `personal`; the one direct insert (`adminVerification.js:242`) omits it. `Notification.type` is free text, so it cannot drop a notice.
    - **Raw rows, Stream 1:** clean.
      - Gig write replies all go through `savedGigReply` (#553): PATCH `/:id`, `/start`, `/reschedule`.
      - magic-post selects explicit columns.
      - Listings go through the allowlist `normalizeListing`.
      - Post create/patch/resolve/global-pin replies spread the raw row (so `location` is hex), but neither native Post model declares `location`.
    - **Raw rows, other streams:**
      - Stream 2: `PATCH /api/homes/:id` (`home.js:1853`) replies with the raw Home row (`location` is EWKB hex). **Refuted on device by Stream 2 (04:50–04:57Z):** renaming Home 9d885f71 saved with no error on Android and iOS. Neither app's `HomeDto`/`HomeDTO` declares `location`; my source read had quoted the my-homes wrapper's decoder. No change. The homeIam lockdown replies have the same shape and no native caller.
      - Stream 3: business locations parse `location`; `display_location` is not declared natively.
- **Preserved → FIXED [#598](https://github.com/WangPantopus/skinny-pantopus/pull/598):** native stop sheets on a started $0 task still show "Task amount $0.00 · Cancellation fee $0.00 · Review…". The user's "honest wording only" decision was applied to web (#549); native wording parity is a small follow-up.

**3.4 Keep integrating peer PRs.**
- Stream 2 ("Stream 2 handoff takeover") and Stream 3 ("fix(native): live chat keeps working after a token refresh; Android reactions update in place") send "PR #N ready" with head, bundle/seal, scope and verification.
- Reply with the review result, the bundle and merge-tree result, then the batch number, and later the merge time and new master.

## 4. Merge-queue / batch procedure (exact)

1. **Fetch** into the object store (in any Stream 1 worktree):
   ```
   git fetch -q origin master "+refs/pull/<n>/head:refs/remotes/pr/<n>" …
   ```
2. **Checks:**
   - CI is green on each exact head.
   - Each bundle verifies: `python3 /private/tmp/pantopus-stream1-runtime-20260925/tools/verify-bundle.py <bundleDir> <head> <sealPrefix>`. That checks the seal prefix, recorded head == PR head, and every file hash. Bundles live under the audits root (§7).
   - Read each diff against its merge-base and check the file scope matches the PR body.
3. **Build the chain** on current master (object store only, no checkout):
   ```
   bash /Users/yingpengwang/pantopus-coordination/docs/workstreams/coordinator-state-2026-09-23/scratchpad/build-batch.sh origin/master <outFile> <n1> <n2> …
   ```
   It prints `OK <pr> <head> <mergeCommit>` per PR and `TIP <sha>`. Then verify:
   - every head is an ancestor of the tip;
   - `git diff --name-only origin/master <tip>` equals the union of each PR's `git diff --name-only $(git merge-base origin/master pr/<n>) pr/<n>`;
   - each PR file's blob in the tip equals the PR head's blob. The exception is files master also changed since the PR's base, or files two PRs share: prove those hunks separately;
   - list pairwise shared files.
4. **Push:**
   ```
   git push origin "<TIP>:refs/heads/claude/coord-merge-batch-<N>"
   ```
   ⚠ In zsh, quote a literal SHA. `$TIP:refs…` breaks because `:r` is a history modifier.
5. **Open the PR:** `gh pr create --base master --head claude/coord-merge-batch-<N> --title "Combined merge batch <N>: …" --body-file …`. The body has:
   - a table of PR / head / scope in merge order;
   - the tip;
   - the seals with file counts;
   - the checks;
   - the Claude Code footer.

   #551 and #546 are templates. Bind it with `ccd_pr`.
6. **Queue it:**
   ```
   echo "<PR> <TIP>" >> /private/tmp/pantopus-tools/merge-queue/reviewed-heads.txt
   echo "<PR>" >> /private/tmp/pantopus-tools/merge-queue/queue.txt
   nohup bash /private/tmp/pantopus-tools/merge-queue/run.sh >/dev/null 2>&1 &
   ```
   Start the runner only if `pgrep -f merge-queue/run.sh` is empty.
7. **Runner behavior** (`run.sh`, runs from the coordination checkout):
   - It merges only when the PR head equals the reviewed head, the required check **"CI OK"** passes and mergeStateStatus is CLEAN/UNSTABLE/HAS_HOOKS. It uses `gh pr merge --merge --match-head-commit`.
   - **BEHIND:** it logs `MASTER_CHANGED` and waits. If master moves, rebuild the batch on the new master.
   - A changed head logs `REVIEW_REQUIRED`.
   - A failed or cancelled CI OK logs `CI_fail` once and waits: rerun the flake, or remove the PR from `queue.txt` by hand.
   - **Known flakes:**
     - registry rate limits;
     - iOS `TokenAcceptViewModelTests.testLeasePreviewDenialOrFailureNeverShowsAnOffer` ("27 tests, with 3 failures"). It failed on #552 and #553 on 2026-09-27.
       - The cause is **not** a 503 retry (`retryPolicy: .none`). Stream 2 found that leftover chat view models from earlier tests poll chat GETs into the shared URL stub after sign-in connects `SocketClient.shared`.
       - Fixed test-only in S2 #560.
     - Rerun only the failed job: `gh run rerun <runId> --failed` (get the run id from the job link in `gh pr checks <n> --json name,link`).
   - Each PR has a 4-hour timeout.
   - Batch CI takes about 35–60 min: batch 33 took 23:33:45 → 00:08:50; batch 32 took 22:35:20 → 23:12:01.
8. **After the merge:** `git diff --stat <old> <new> -- backend supabase` tells whether the runtime needs migrations and a restart.

## 5. Runtime (private, not in Git)

**5.1 Layout.** Folder `/private/tmp/pantopus-stream1-runtime-20260925/`.

| Piece | Where / what |
|---|---|
| Backend | real `backend/app.js` from the runtime worktree on **127.0.0.1:18132**. pid **83519**, started 2026-09-27T00:52:25Z; log `logs/backend-005225.log`. `start-backend.sh` applies an `env -i` allowlist, an egress guard (loopback, api.stripe.com and the NOAA/Open-Meteo weather APIs only) and a Stripe guard (TEST key; capture, non-manual intents, transfers, payouts and refunds refused). Jobs and cron are off, and email is in log mode. |
| Fault proxy | **127.0.0.1:18138** (`fault-proxy.cjs`, pid 86966). Helper `tools/fp.sh seq \| add <id> <METHOD> <path-regex> [count] [status] \| clear \| log <sinceSeq> [filter]`. Record `fp.sh seq` before an action, then `fp.sh log <seq> <filter>`. |
| Web | Next dev on **127.0.0.1:18139** (pid 48094), serving the runtime worktree with HMR. `/api` and `/socket.io` are rewritten to 18138. |
| DB | Supabase stack `pantopus-stream1-resume-20260923` (Kong 64561, Postgres 64562). Read-only SQL: `./q.sh "select …"` (in zsh, quote `"Gig"` inside double quotes). Fixture writes and cleanup: `docker exec -i supabase_db_pantopus-stream1-resume-20260923 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1 < file.sql`, with a DO block that checks ROW_COUNT. |
| Accounts | synthetic `sux_resume_alice` / `sux_resume_bob` / `sux_resume_dana` (ids `f9230c01-0000-4000-8000-00000000000{1,2,3}`), plus older Stream 1 fixtures `s1_sheet_r1_0/1/2`. No Homes exist. The only `StripeAccount` row belongs to `s1_sheet_r1_1`, so the paid path is a boundary. |

**5.2 Helpers.** Credentials come from a private fixture file and are never printed.
- `python3 api.py login <actor>` stores `.tokens-<actor>.json` (0600).
  - `python3 api.py <actor> <METHOD> <path> ['<json>']` makes a call. Set `LIM=200000` for the full body; the first line is the HTTP status.
  - A `401 Invalid or expired token` means you should log in again. Tokens expire in about an hour, and a backend restart doesn't invalidate them.
- **Task fixtures via API:**
  - `POST /api/gigs` with `{"title","description","price":0,"category","engagement_mode":"instant_accept","location":{"mode":"custom","latitude":45.628,"longitude":-122.6739,"address":"1200 Main St, Vancouver, WA 98660","city":"Vancouver","state":"WA","zip":"98660"}}`.
  - Then `POST /api/gigs/<id>/instant-accept '{}'` (bob), `POST /api/gigs/<id>/start '{}'` (bob), `POST /api/gigs/<id>/mark-completed '{"note":"…"}'` (bob).
  - Confirm with `POST /api/gigs/<id>/complete '{"expectedReview":"<GET detail completion_review>"}'` (alice).
  - Side effects to clean: `Notification` rows (task_accepted, gig_started, gig_completed, gig_confirmed, gig_rescheduled) and one `user_task_affinity` row per worker/category from mark-completed.
- `node webcap.mjs <actor> <steps.json> <outDir>` drives headless Chrome through the real login.
  - It reuses `.webstate-<actor>.json`. The login limiter is 10 per 15 min per IP.
  - Many `steps-*.json` examples sit in the folder.
- `python3 tools/android-login.py <actor>` fills the Android login form on emulator-5558 without printing the password.
- `bash tools/ios-pb.sh email <actor> | password | clear` puts a credential on sim F4DBD47E's pasteboard.
  - Tap the field twice → Paste, then **clear**.
- `WT=<worktree> EXPECTED=<sha> bash build-android-static.sh` runs ktlint, detekt and assembleDebug, and writes a receipt (about 5 min).
  - It needs Stream 1 to **already hold** heavy.
  - It creates `local.properties` if missing and refuses a worktree `.env`.
- `WT=<worktree> IOS_SOURCE=<sha> bash build-ios-held.sh` builds the arm64 simulator app.
  - It needs a heavy owner that starts with `stream1:`, and outputs to DD `/private/tmp/pantopus-stream1-ios-dd` (shared by all Stream 1 iOS builds; check the dylib hash before installing).
- `bash snapshot.sh <out.json>` records row counts for every public table, for baseline and cleanup diffs.
- `python3 seal.py <dir> <branch> <commit> "<boundary>"` writes the MANIFEST and prints its sha256.

**5.3 Bringing the runtime to a new master.**
1. In the runtime worktree, `git merge origin/master` (restore any served PR copies first with `git checkout -- <files>`).
2. Apply any new migrations: `comm` of `supabase_migrations.schema_migrations` against `supabase/migrations/`. Run each file with `psql -1 -v ON_ERROR_STOP=1`, with its ledger row.
3. If the backend changed:
   ```
   kill -INT <pid>
   nohup bash start-backend.sh > logs/backend-$(date -u +%H%M%S).log 2>&1 &
   ```
   Check `/api/hub` returns 200 as alice.

**5.4 Serving a PR's backend fix for verification.**
1. Copy the file into the runtime worktree.
2. Check `git hash-object` equals the PR head's blob.
3. SIGINT-restart the backend, and record the start time and log name in `SOURCE.txt`.
4. Afterwards, `git checkout -- <file>` and SIGINT-restart again.

Web fixes are served the same way with HMR (no restart).

## 6. Devices and simulator gotchas

**Slots.**
- `zsh /private/tmp/pantopus-tools/device-slot.sh acquire '<stream>: <device …>' | release '<label prefix>' | status`.
  - The lowest free slot is assigned.
  - ⚠ `release` removes **every** slot whose owner starts with the prefix. Use a precise prefix like `'stream1: iOS sim F4DBD47E'`.
- `zsh /private/tmp/pantopus-tools/heavy-slot.sh acquire "<stream>: <purpose>" | release | status`.
  - Heavy covers xcodebuild, gradle assemble/install, and installing a fresh build.

**Android emulator-5558** (AVD `Pantopus_Stream1_Start_R2`).
- **Boot:** acquire a device slot first, then:
  ```
  /Users/yingpengwang/Library/Android/sdk/emulator/emulator -avd Pantopus_Stream1_Start_R2 -port 5558 -no-snapshot-load -no-boot-anim -gpu host -no-metrics -no-audio &
  ```
  Wait for `getprop sys.boot_completed` = 1.
- **Stop:** `adb -s emulator-5558 emu kill` (never pkill).
- **UI:** `ANDROID_SERIAL=emulator-5558 python3 /private/tmp/pantopus-tools/aui.py dump` shows boxes in real pixels (1080×2340). Tap with `adb shell input tap x y` at a box center.
  - The bottom bar is at y≈2230 (Place x≈135, Today x≈405, Nearby x≈675, Mail x≈945).
  - `adb shell input text` needs `%s` for spaces and no parentheses.
- **Deep links:** `adb -s emulator-5558 shell am start -a android.intent.action.VIEW -d "pantopus://gigs/<id>"`.
- **Journeys:**
  - The Hub "Menu" (top-right ≡) opens the drawer: My Tasks, Settings → Log out.
  - Task edit is My Tasks → "Edit details" (not the task menu).
  - Reschedule is the task's ⋮ → Cancel task → "Reschedule instead" (no cancel happens until "Confirm cancel task").
  - Log in with `tools/android-login.py`.
- **Evidence:** `adb exec-out screencap -p > f.png` captures toasts. `adb logcat -c` before an action, then `adb logcat -d | grep JsonDataException` for decode errors.

**iOS sim F4DBD47E.**
- **Commands:** `xcrun simctl boot|shutdown F4DBD47E-ED21-4B85-941B-6B0C61DD5A31`; `xcrun simctl openurl … "pantopus://gigs/<id>"`.
- **MCP control tool:** screenshots and taps with `device` set. Taps are in points: displayed px × 402/920.
  - After a scroll, take a fresh screenshot before tapping; the content settles.
  - The MCP screenshot shows toasts; `simctl io screenshot` frames miss them.
- **Journeys:**
  - The task ⋯ menu has "Reschedule task" for the owner of an assigned task.
  - Owner confirm is in the Task progress panel ("Confirm completion" → alert Confirm).
  - Task edit is Gigs → "My Tasks" link → "Edit details" → Save.
- **Sign-out path:** avatar → scroll → Log out → Sign out. For sign-in, use "Not you?" and paste credentials via `ios-pb.sh`.
- **iOS 26.5:**
  - a deep link to the already-open task does nothing (go back first);
  - a hung `simctl boot` needs shutdown → boot;
  - sheet detents shift buttons, so confirm each tap through the proxy log.

## 7. Evidence and inventory

**Bundle root:** `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/` (private, never committed).
- Each fix has:
  - `RESULT.md` (before on master code / after);
  - `SOURCE.txt` (git-generated binding of builds and served files);
  - build receipts;
  - `cleanup.sql` + `cleanup-output.txt` + `cleanup-diff.txt` against a `snapshot.sh` baseline;
  - a sealed `MANIFEST.json`.
- The PR body cites the seal.

**Living inventory:** `20260925-stream1-domain-inventory-r1/INVENTORY.md`, unsealed by design.
- **Count:** 153 table rows at handoff (lines starting with `| ` minus 9 header/separator lines). About 61 are PASS and 70 FIXED; since batch 36 every FIXED row is merged.
  - The header's merge-state note says which FIXED rows are on master: #537 and #542 are merged, #549 is in batch 34, and #548/#550/#553/#554 go in batch 35.
- **Open rows:**
  - 2 OPEN: web `/app/offers`, and the native quick-post create at 0,0 (high);
  - 9 candidates;
  - 5 notes;
  - 1 WON'T FIX (the Tasks map remote pins; Android upload-error copy WON'T FIX sits inside a mixed row).
- **Also:** 1 POLICY KEPT, 2 routed, 2 BOUNDARY, 1 not run, 1 ABSENT (native listing Q&A), 1 REUSE.

**Boundaries** (not verifiable here):
- the Stripe paid path (Connect onboarding and capture);
- posting a task through the web UI (Mapbox geocoding);
- native delivery-proof photos (S3 upload → 503);
- real devices and push;
- scheduled jobs (off in the runtime).

**Unsealed bundle folders:**

| Folder | Status |
|---|---|
| `…-domain-inventory-r1` | living, unsealed by design |
| `…-web-map-remote-tasks-r1` | before-only notes for the 0,0 WON'T FIX |
| `…-native-offers-failed-counts-r1`, `…-native-pulse-radius-banner-r1` | early drafts, superseded by sealed bundles |

## 8. What was done (2026-09-26 → 2026-09-27, UTC)

**Batches merged:**

| Batch (queue PR) | Master | PRs, in merge order | Merged at |
|---|---|---|---|
| 25 ([#499](https://github.com/WangPantopus/skinny-pantopus/pull/499)) | `dbd75332b` → `207eeb510` | 490 492 495 496 494 491 493 497 | 09-26 09:58:07Z |
| 26 ([#513](https://github.com/WangPantopus/skinny-pantopus/pull/513)) | → `9ac4a7cdf` | 498 500 501 504 505 506 502 503 507 508 | 11:37:08Z |
| 27 ([#517](https://github.com/WangPantopus/skinny-pantopus/pull/517)) | → `2e053fe9c` | 509 510 511 514 512 516 | 12:16:08Z |
| 28 ([#525](https://github.com/WangPantopus/skinny-pantopus/pull/525)) | → `be33552e8` | 518 515 519 520 521 522 | 13:49:47Z |
| 29 ([#526](https://github.com/WangPantopus/skinny-pantopus/pull/526)) | → `49b47e910` | 523 524 | 18:00:53Z |
| 30 ([#531](https://github.com/WangPantopus/skinny-pantopus/pull/531)) | → `448ee8b4a` | 527 528 529 530 | 18:49:34Z |
| 31 ([#534](https://github.com/WangPantopus/skinny-pantopus/pull/534)) | → `f885e0623` | 532 533 | 20:09:33Z |
| 32 ([#540](https://github.com/WangPantopus/skinny-pantopus/pull/540)) | → `d358dbc83` | 538 535 536 537 | 23:12:01Z |
| 33 ([#546](https://github.com/WangPantopus/skinny-pantopus/pull/546)) | → `f7f51eae4` | 543 539 541 542 | 09-27 00:08:50Z |
| 34 ([#551](https://github.com/WangPantopus/skinny-pantopus/pull/551)) | → `73b98f6b6` | 544 545 547 549 | 00:46:55Z |
| 35 ([#556](https://github.com/WangPantopus/skinny-pantopus/pull/556)) | → `0bd3759f4` | 548 553 550 554 555 552 | 02:23:56Z |
| 36 ([#561](https://github.com/WangPantopus/skinny-pantopus/pull/561)) | → `89f3c6bac` | 557 558 559 | 02:31:01Z |

**User decisions** (AskUserQuestion, 2026-09-26):
- 1A–6A (09:48Z) and decision A (17:49Z) are merged (see the earlier history in `01-gigs-payments.md`).
- **Worktrees:** "Yes, clear all 37", done by Stream 3.
- **Android Gigs door:** "Always open the list" (#550).
- **Android tab re-tap:** "Go back to the tab's start" (#550).
- **Started-task cancel:**
  - First answer: "Keep rule, fix wording".
  - I then corrected my own statement that leaving or a no-show report were still options after a start. They close too: `gig_stop_*` answers `STARTED_POLICY_REVIEW` for every action after `started_at`, and `noShowEligibility` refuses once `started_at` is set.
  - The user then chose "Honest wording only", with **no policy change** (#549, web).

**Stream 1 PRs** (bundle seal in brackets):

| PR | What | Seal | Status |
|---|---|---|---|
| #537 | iOS task questions live (`gig:qa-update`) | `0cde42d1` | merged (batch 32) |
| #542 | web worker panel after instant accept; no change-order error for bystanders; no payouts banner on $0 | `aac4dc3c` | merged (batch 33) |
| #549 | web started $0 cancel dialog: honest wording | `9539de1b` | merged (batch 34) |
| #548 | native helper dock "Start task" + `/start` reply (backend) + $0 delivery copy | `25ad4e68` | merged (batch 35) |
| #550 | Android tab re-tap + Gigs door | `9de2523c` | merged (batch 35) |
| #553 | edit/reschedule/confirm replies + reschedule notice (backend; stacked on #548) | `1d082ae3` | merged (batch 35) |
| #554 | Android edit keeps location | `d482bdbc` | merged (batch 35) |
| #555 | saved-search task alerts delivered (backend) | `2b29d13f` | merged (batch 35) |

**Defects found and fixed this session**, all reproduced on master code first:
- Native **start** showed "Something went wrong" (#548).
- Native **edit**, **reschedule** and iOS **confirm** showed it too (#553). The cause: raw PostGIS strings in the reply.
- **Reschedule notices** were never delivered (#553; invalid `notification_context_type`).
- **Saved-search task alerts** were never delivered (#555; same cause, pointed out by Stream 3).
- **Android edit** moved tasks to 0,0 (#554).
- The helper's dock said "Bidding closed" (#548).
- Payment wording on $0 delivery (#548), the web worker panel (#542), and iOS Q&A live updates (#537).

**Runtime and coordination.**
- The runtime followed master through batches 32 and 33. Backend SIGINT restarts happened for #538 (batch 32), for #543 at 00:09:22Z, and for the #553 checks (00:28:48Z, 00:41:41Z, back to master at 00:42:41Z).
- **Slot hand-offs with Stream 3** this evening:
  - heavy to Stream 3 at 00:03:40Z, back 00:29:39Z;
  - Stream 1 heavy 00:31:11Z–00:39:07Z;
  - slot 1 to Stream 1 at 00:21:02Z, back at 00:30:58Z;
  - slot 4 Stream 1 00:17:45Z–00:46:58Z.

## 9. Worktrees (`git worktree list`, 2026-09-27T00:48Z)

- **Runtime:** `stream1-peer-takeover-d2cb25` (tree == master).
- **This session's PR branches:**

  | Worktree (`/private/tmp/pantopus-stream1-…`) | PR |
  |---|---|
  | `native-helper-dock` | #548 (merged) |
  | `gig-write-replies` | #553 (merged) |
  | `android-tab-nav` | #550 (merged) |
  | `android-edit-location` | #554 (merged) |
  | `saved-search-alerts` | #555 (merged) |

  All five are merged, so these worktrees can be ignored; removing them needs the user's OK.

- **Merged, may be ignored:** `gig-qa-live` (#537), `web-worker-panel` (#542), `web-stop-copy` (#549).
- **Dirty, preserve:** `/private/tmp/pantopus-stream1-web-trade` (branch `claude/stream1-web-trade-modal-failure` at `dbd75332b`).
  - It has an **uncommitted** `TradeModal.tsx` failure-state change.
  - It's moot while trades are hidden (no listing response carries `open_to_trades`).
  - Don't discard, stash or commit it.
- **Stale entries whose folders are gone** ("prunable"; leave them): acctdel, native, native-bids-camera, noshow, offers, package-contract, package-native, reveal-address, verify-resume, web-groups, web-offers, web-resume.
- **Removal:** worktree removal needs the user's explicit OK. Stream 3 did the one allowed removal.

## 10. Peers (SendMessage; list sessions with ListAgents)

- **Stream 2** (Mail, Home, Guests, Place): session **"Stream 2 handoff takeover"**, a successor that started about 00:20Z. Its written state is `docs/workstreams/02-home-household.md` → CURRENT RESUME.
  - Its user approved all five of its §3A items (message received before 01:38:56Z), and their PRs come one at a time.
  - **§3A-1 (phone-escrow refusal) needs no code**, per a correction received before 01:57:52Z. On master every escrow send already answers 400 "Please choose who this mail is for", because `normalizeSendMailPayload` always sets a user/home recipient or throws. Evidence: bundle `20260927-stream2-phone-escrow-unreachable-r1` (`589973bc…`).
  - **§3A-2** is #558 (above).
  - **Next:**
    - #5: web add-guest stub → redirect to /share. **Done as #559** (above).
    - Native #3 (Guests tab → guest-pass manager) and #4 (health "View maintenance" → Issues), in one build window after batch 35. **#3 touches `RootTabScreen.kt`**, which batch 35 also changes, so it needs rebasing or proof against the new master.
    - Then Stream 2 makes the flaky `TokenAcceptViewModelTests` test deterministic, changing only the existing test.
- **Stream 3** (chat, social, scheduling, Beacons, creator/business): session **"fix(native): live chat keeps working after a token refresh; Android reactions update in place"** (successor). Its state is `docs/workstreams/03-accounts-social.md` → CURRENT RESUME.
  - **Open:** #552 (batch 35); #557 (new-post notices; batch 36 candidate, reviewed OK, green).
  - **Coming** (message received before 02:12:44Z): a small iOS PR in `ChatConversationViewModel`. An open chat thread stops getting live messages after switching tabs away and back: the teardown runs on disappear, and `load()` early-returns on reappear. It was reproduced on master-equivalent iOS code.
  - **Slots:** Stream 3 used slot 1 until 02:12:30Z. Stream 2 holds heavy (from about 02:08Z, about 45 min of builds) and then takes slot 1.
  - **Blocked by user decisions:** S3-22/62/26.
- **Older idle sessions** also appear in ListAgents. Don't message them: "Stream 2 Mail journey completion", "fix(web): connect booking follow-up and rebooking actions", `stream1-peer-takeover-d2cb25-ab`, `stream2-mail-journey-18b50a-e0`, `stream3-peer-takeover-d8df28-9f`.
- **Message conventions:**
  - Peers send "PR #N ready for your queue" with head, bundle and seal, file scope and verification.
  - Reply with the review result, bundle verification and dry-run (merge-tree) result, then the batch number, and later the merge time and new master.
  - Slot hand-offs are explicit messages with exact release times.

## 11. Lessons from this session

- **Seed fixtures with a location.** Native decode bugs only appear on tasks that have a location, and earlier audits used location-less fixtures, which hid the start, edit, reschedule and confirm errors.
- **When a native action shows "Something went wrong" but the change is saved:**
  - Android: check logcat for `JsonDataException`.
  - iOS: compare the reply's JSON types with the DTO.
  - `.catch(() => {})` around notification inserts hides real failures; check the backend log for "Failed to create notification".
- **Before asking the user,** verify every option you describe against the code. A misdescribed option had to be re-asked (§8).
- **A backend reply fix verifies with installed apps** (no rebuild), which makes before/after cheap: master backend → fix served → master again.
- **An iOS unit-test failure in code your PR doesn't touch:** read the failing test in the job log (`gh run view <run> --job <job> --log | grep "Test Case .* failed"`) before assuming a regression, then rerun the failed job once.
