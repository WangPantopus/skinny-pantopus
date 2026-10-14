# PA status: Android

Owner: the PA session. Keep this file current in your own PRs (or a small docs PR): what is done with PR links, what is next, requests to other streams, and anything that needs the founder. Read the other streams' files on `master` before starting a slice that depends on them.

## Done

- **Runtime (Oct 13).** Stream `pa`: its own Supabase stack (Postgres 57002, API 57001), backend on 57100, AVD `pulse-pa` on console port 5574, local accounts `alice`, `bob`, `carol`. A first Android compile of `master` took 28 minutes and a Release (R8) build 36 while the iOS stream's Swift build ran (load average 80 to 150); later debug builds are incremental.
- **S2 Tolerant decoding:** [PR 2265](https://github.com/WangPantopus/skinny-pantopus/pull/2265), merged. The feed, one post, its comments, My posts, Saved and the notification list read around a null or missing field and skip an item that can't be read; verified in the real app on a debug and an R8 Release build (odd and "poison" payloads through a local proxy, relaunch, offline, backend stopped, a brand-new account). With PI's PR 2263 on `master`, hold point H1 is clear for Android.
- **S1 (client):** [PR 2271](https://github.com/WangPantopus/skinny-pantopus/pull/2271), merged October 14. The Heads-up picker offers Road hazard, Power outage, Weather damage, Missing pet, Hazard and Other and starts on Hazard; no "Post as this business" on the owner dashboard; no "Business Area" in the composer's first step (it posted as the business to Place, which the server refuses with `403 BUSINESS_CANNOT_POST`). Verified as bob, who owns a business with a location, on a debug and an R8 Release build; a Road hazard posted from the Release build is stored as `alert` / `road_hazard`.
- **S3 Five tabs:** [PR 2293](https://github.com/WangPantopus/skinny-pantopus/pull/2293), merged October 14. Place · Today · Pulse · Plans · Messages; Plans only while the person's `plans` switch is on, following it while the app runs (standing on Plans when it turns off lands on Pulse); Nearby links and the `/app/nearby` pushes open Pulse; plan links open on the Plans tab; Connections in Pulse's "More" menu; the meter and "Set up a home" as one quiet-state card at the top of the Pulse posts, re-read by a pull. Each tab is one TalkBack node with the Tab role ("selected. Messages, 1 unread. Tab. 4 of 4"). Verified on a debug and an R8 Release build with bob and carol: the switch at runtime, every link and push cold and warm, process death, 2× text on a 320 dp phone, TalkBack, offline, sign-out and a second account, web `/app/nearby`.

- **Restore after background process death:** [PR 2296](https://github.com/WangPantopus/skinny-pantopus/pull/2296), merged October 14. `MainActivity` no longer replays the original launch link when restoring the person's later screen. The prior session checked link-start, a link arriving during restore, and configuration changes.
- **S4 topics:** [PR 2300](https://github.com/WangPantopus/skinny-pantopus/pull/2300), merged October 14 at `9bcbe0c89`. All required CI passed, including Android lint/test/assemble and instrumented tests; the PR records the two-account local checks and R8 Release check. Topic chips, empty-topic text, card topics, topic mutes and preferences undo are on `master`.

## Resumed — October 14, 2026

- Resumed in the primary PA checkout on `claude/pulse-pa-s7-status`; fetched origin and merged master `b4234543c` into S7 (`b583dc54f`). The unrelated `.claude/launch.json` modification is preserved unchanged.
- All five PA PRs remain drafts. At resume, S7 and the radius/comment PR still had Android CI running; S6, draft persistence and external sharing had failed CI to investigate. No draft is verified complete or ready to merge.
- Recreated only PA: database/API 57002/57001, backend 57110, pass-through proxy 57100 with Pulse fixtures explicitly off, web 57101 and `pulse-pa` emulator 5574. Fresh Alice/Bob/Carol accounts replace the deleted fixtures; two have synthetic verified homes. Jobs and external pushes remain disabled.
- Fresh real-database fixture check: the actual lifecycle job archived seven backdated cases with the expected separate resolutions; the reminder job created one of each day-6 notice and a second run did not duplicate them. This is setup evidence only; the new Android build and two-account UI checks are still pending.
- Full S7 local checks are running with the isolated in-process Kotlin compiler. R8 and final native/web scenarios remain required before a push/merge claim. No hosted changes, real sends or deployments.
- H4 audit: snapshot contract #2310 is on master; distance #2311, real feed #2312 and S9 #2313/#2317 are still open. S8 also still requires PS's composer checks. S25 remains reserved.

## Handoff — October 14, 2026

The founder requested a handoff, all work committed/pushed with PRs, and removal of this session's local resources. Development and final checks stopped at that request. **The Android lane is not complete.** All five branches below are pushed; all five PRs remain drafts. Earlier green checks do not validate their final heads.

| Work | Branch / PR | State at handoff |
|---|---|---|
| S7 lifecycle | `claude/pulse-pa-s7-status`, [2302](https://github.com/WangPantopus/skinny-pantopus/pull/2302), `178902d6f` | Final R8 build canceled during Kotlin compilation; full final checks and device pass pending. |
| S5/S6 page | `claude/pulse-pa-s6-pulse-page`, [2303](https://github.com/WangPantopus/skinny-pantopus/pull/2303), `a5f8d9ee3` | Final static fixes committed; no completed Kotlin/device/R8 run. Multi-page earlier handling still needs repair. H4 applies. |
| S8 draft foundation | `claude/pulse-pa-compose-drafts`, [2315](https://github.com/WangPantopus/skinny-pantopus/pull/2315), `0ac4e4041` | Encrypted account/origin text/photo drafts, retry identity, restore/discard/deletion handling; no completed compile or native run. Full S8/S20 is not built. |
| External-share privacy | `claude/pulse-pa-share-privacy`, [2316](https://github.com/WangPantopus/skinny-pantopus/pull/2316), `dea1fd151` | Permission-aware menu and server authorization before chooser; final checks/device/R8 pending. Unknown moderation values must also fail closed. |
| Radius/comment follow-up | `claude/pulse-pa-feed-limits`, [2318](https://github.com/WangPantopus/skinny-pantopus/pull/2318) | 100-mile UI cap and safe server refusal wording; checks/device/R8 pending. Stacked on S7; retarget to master after S7 merges. |

### What is actually verified

- S7 recovery code passed ktlintCheck, detekt, lintDebug, test and paparazziVerify; Debug and Release unit suites each reported 5,054 tests, zero failures/errors, 76 skips. This predates the final scroll, own-mute and master changes.
- Debug `ee30db711` was built and installed. Alice/Bob checks covered lifecycle status, Keep open once/refusal after relaunch, Close cancellation/offline/retry/concurrent ending, My posts/Saved, real lifecycle job for seven synthetic endings, day-6 notifications and cold/warm routes, time zones, editing with unchanged creation/expiry and preserved reply, and confirmed deletion.
- The long owner menu scrolled to Cancel at 2× text on a 320×480 dp phone. Final own-post type/topic/author mute guards are committed but were not installed.
- TalkBack focused Answered as one accessible node; no captured spoken utterance is claimed. Night mode still showed the existing light app root; actual dark-palette behavior is unfinished.
- Web Alice saw the same server-created Ask and reply after hard reload. That does not claim new lifecycle UI on web.
- No final S7 R8 success, S6 native success, draft-persistence native success or privacy-follow-up native success is claimed. Each PR body records its exact limits.

### Resume in this order

1. Fetch master, inspect open PRs and compare exact remote heads again. Preserve the primary checkout's unrelated `.claude/launch.json` modification. Recreate only the PA runtime/emulator and synthetic accounts; the old PA database and device were deleted at the founder's request, so old IDs/sessions are no longer valid.
2. S7: integrate current master carefully, run all required checks and an R8 Release with a temporary local cleartext overlay (never commit it), then repeat affected two-account/device scenarios. Use the shared merge queue and merge only after exact-head CI and real-app checks pass.
3. Radius/comments and external sharing: keep the small repairs separate. Make the share policy allow only absent/live moderation values, not unknown future states. Verify restricted/disabled/stale/offline sharing before merging.
4. S6: PB's area/privacy routes are on master. At handoff feed [2312](https://github.com/WangPantopus/skinny-pantopus/pull/2312), contract [2310](https://github.com/WangPantopus/skinny-pantopus/pull/2310) and distance [2311](https://github.com/WangPantopus/skinny-pantopus/pull/2311) were pending; recheck H4. **Current Show earlier handles only one batch.** Append/deduplicate successive batches with the opaque cursor, retain the original server `read_at`, update caught-up from the final response and acknowledge only when the true end is visible. Keep loaded earlier rows during failures/actions. Empty pages must omit caught-up. New-count passes area_id; seen remains unfiltered/default-area only. Complete fixture then real-backend checks, dark palette, accessibility, offline/relaunch and R8.
5. Draft foundation: final ktlint/detekt/debug run was canceled. Fix any actual findings; verify text/photos/account isolation, process death, save/discard failure, retry identity and confirmed deletion. Sign-out copy now explains draft retention. Restore rechecks eligibility; corrupt drafts have confirmed discard. Finish full S8 one-box/audience/adult/checks and S9 conversation next. PB [2313](https://github.com/WangPantopus/skinny-pantopus/pull/2313) publishes additive reply/claim envelopes; do not invent a second service.
6. Continue S10–S24 against published contracts and hold points. S25 stays reserved. No new unit/UI tests or coverage work; update existing tests broken by intended changes. Update this status with actual verification and merge results.

### Existing-work audit

Audited 145 unmerged refs, 134 distinct heads and 46 relevant Android heads, including branches with no PR. Eighteen relevant patches were exact equivalents already on master. Earlier PA S1/S2/S3/S4/restore work is merged; no hidden S8–S24 implementation was found. [2158](https://github.com/WangPantopus/skinny-pantopus/pull/2158) is verification-only and must not merge. Reuse ScreenStore, PostsRepository, reply/request IDs, uploads, Plans and Support Train flows. The new PB backend drafts do not overlap Android ownership. Recheck the repository before acting on this dated audit.

## Local cleanup and private continuation

The PA backend, proxy, web server and local Gradle runs were stopped. The PA Supabase containers/data volumes and AVD `pulse-pa` were deleted. The four managed worktrees were archived for recovery, and regenerable PA build/dependency caches were removed. Other sessions' stacks, emulators and shared tools/daemons remain untouched. The primary source checkout and unrelated local launcher change remain.

The detailed local continuation, commands and scratch helpers are in `~/.config/pantopus/pulse-pa-handoff/CONTINUE-20261014-PA.md`. This private material is not committed. Old fixture identifiers in earlier notes are historical, not live records.

## Requests

- → PS/PB: full S8 still depends on the published composer checks/Pulse-mode creation; S9 and later work waits for the corresponding routes on master (H4).
- → PV: actual dark-palette and TalkBack spoken-output verification remain open; focused TalkBack semantics are not a speech recording.
- Stop only a stream's exact PID/port; never use broad process patterns or stop shared Gradle/Kotlin daemons.
- H5: backend routes must deploy before clients consume them. The founder alone deploys, changes hosted systems, sends to real people or submits to stores.

## Needs founder

No new decision requested in this handoff. Existing product hold points still apply.
