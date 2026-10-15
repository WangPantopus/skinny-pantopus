# PA status: Android

> **Paused — October 15, 2026 (founder decision).** The Pulse build is paused. The redesign sits behind the launch cut `pulse_redesign` (cut 11 in [the launch-scope flags](../../../launch-scope-flags-2026-10-01.md)), and launch builds ship the October 13 Pulse. Android's switch is [PR 2365](https://github.com/WangPantopus/skinny-pantopus/pull/2365). With the key off, the app has four tabs (Place · Today · Nearby · Messages) and Pulse opens from Nearby as the October 13 feed. With the key listed, the app is the redesign as merged through S7. PA holds nothing in the merge queue. Its open PRs stay drafts:
> - [2303](https://github.com/WangPantopus/skinny-pantopus/pull/2303), the S5/S6 page
> - [2315](https://github.com/WangPantopus/skinny-pantopus/pull/2315), composer drafts
> - [2316](https://github.com/WangPantopus/skinny-pantopus/pull/2316), share privacy (it may still merge with the key off once its checks are done)
> - [2318](https://github.com/WangPantopus/skinny-pantopus/pull/2318), radius and comments
>
> The PA emulator (`pulse-pa`, port 5574) is shut down without being wiped, and the PA database is kept.
>
> **To resume:**
> 1. List `pulse_redesign` in `PANTOPUS_LAUNCH_FEATURES` in the ignored `frontend/apps/android/.env` and rebuild. Once PB's server gate is on `master`, also set `LAUNCH_FEATURES=pulse_redesign` in the local `backend/.env`. Start the AVD with `emulator -avd pulse-pa -port 5574 -no-window -gpu host -no-audio -no-boot-anim -no-snapshot`.
> 2. Rebase each draft on `master`; none of them adds a migration. New redesign UI goes behind `LaunchFeatures.pulseRedesign`, and the October 13 screens stay as they are with the key off.
> 3. Continue from the private PA handoff (`CONTINUE-20261015-PA.md`, sections 2 and 8): #2318, then #2316, #2315 and #2303, then S9, S10, full S8 and S11–S24.

Owner: the PA session. Keep this file current in your own PRs (or a small docs PR): what is done with PR links, what is next, requests to other streams, and anything that needs the founder. Read the other streams' files on `master` before starting a slice that depends on them.

## Done

- **Runtime (Oct 13).** Stream `pa`: its own Supabase stack (Postgres 57002, API 57001), backend on 57100, AVD `pulse-pa` on console port 5574, local accounts `alice`, `bob`, `carol`. A first Android compile of `master` took 28 minutes and a Release (R8) build 36 while the iOS stream's Swift build ran (load average 80 to 150); later debug builds are incremental.
- **S2 Tolerant decoding:** [PR 2265](https://github.com/WangPantopus/skinny-pantopus/pull/2265), merged. The feed, one post, its comments, My posts, Saved and the notification list read around a null or missing field and skip an item that can't be read; verified in the real app on a debug and an R8 Release build (odd and "poison" payloads through a local proxy, relaunch, offline, backend stopped, a brand-new account). With PI's PR 2263 on `master`, hold point H1 is clear for Android.
- **S1 (client):** [PR 2271](https://github.com/WangPantopus/skinny-pantopus/pull/2271), merged October 14. The Heads-up picker offers Road hazard, Power outage, Weather damage, Missing pet, Hazard and Other and starts on Hazard; no "Post as this business" on the owner dashboard; no "Business Area" in the composer's first step (it posted as the business to Place, which the server refuses with `403 BUSINESS_CANNOT_POST`). Verified as bob, who owns a business with a location, on a debug and an R8 Release build; a Road hazard posted from the Release build is stored as `alert` / `road_hazard`.
- **S3 Five tabs:** [PR 2293](https://github.com/WangPantopus/skinny-pantopus/pull/2293), merged October 14. Place · Today · Pulse · Plans · Messages; Plans only while the person's `plans` switch is on, following it while the app runs (standing on Plans when it turns off lands on Pulse); Nearby links and the `/app/nearby` pushes open Pulse; plan links open on the Plans tab; Connections in Pulse's "More" menu; the meter and "Set up a home" as one quiet-state card at the top of the Pulse posts, re-read by a pull. Each tab is one TalkBack node with the Tab role ("selected. Messages, 1 unread. Tab. 4 of 4"). Verified on a debug and an R8 Release build with bob and carol: the switch at runtime, every link and push cold and warm, process death, 2× text on a 320 dp phone, TalkBack, offline, sign-out and a second account, web `/app/nearby`.

- **Restore after background process death:** [PR 2296](https://github.com/WangPantopus/skinny-pantopus/pull/2296), merged October 14. `MainActivity` no longer replays the original launch link when restoring the person's later screen. The prior session checked link-start, a link arriving during restore, and configuration changes.
- **S4 topics:** [PR 2300](https://github.com/WangPantopus/skinny-pantopus/pull/2300), merged October 14 at `9bcbe0c89`. All required CI passed, including Android lint/test/assemble and instrumented tests; the PR records the two-account local checks and R8 Release check. Topic chips, empty-topic text, card topics, topic mutes and preferences undo are on `master`.

- **S7 lifecycle (client):** [PR 2302](https://github.com/WangPantopus/skinny-pantopus/pull/2302), merged October 15 at `87a431dba`. Status words on the feed card, the post page, My posts and Saved ("Answered", "Gone", "Reunited", "Happened · N went", "Ends Thu 11:30pm" in the viewer's zone; nothing for closed or expired); the asker's "Keep open 7 more days" (once) and "Close" with "Close this question?" on the card and page menus; the day-6 reminders open the Ask from the list and from a tapped push, cold and warm; unknown types read as Post. An Ask closed, a post deleted or archived, or a post found gone on another screen leaves a Pulse feed that is still open, and comes back there when restored from My posts. Verified October 15 on a debug and an R8 Release build with Alice and Bob against the PA database: every status above (feed, page, My posts Active and Archived, Bob's Saved), manual archives (no actions, no future end), the seven real lifecycle-job endings as they appear in My posts, Keep open once and still gone after a cold relaunch, a stale "already kept open" and a concurrent close showing the server's sentence, Close cancelled, offline and retried, a double-tapped Close and a slow or failing (500) Keep open each sending one request, close and restore in the same open feed, edit keeping the creation time, end time and Bob's reply, delete then Bob's Saved, cached page and link refusing it (and the web page "not found"), Los Angeles and Tokyo times including a heads-up past midnight and one after the daylight-saving change, 2× text on a 320 × 480 dp screen (menus scroll to Cancel), TalkBack speech for the card and the page pill, and system dark mode (the app keeps its light theme, as `Theme.kt` intends). Helpful marks are S9.
- **Redesign switch (launch cut 11, `pulse_redesign`):** [PR 2365](https://github.com/WangPantopus/skinny-pantopus/pull/2365). With the key off (the default) the app is the October 13 app; listing it gives today's redesign. Verified October 15 on emulator-5574 against the PA database, as Alice and Bob, cold and after relaunches. The off state was checked on a debug build and on an R8 Release build. The on state was checked on a debug build with the key listed. Details are in the PR.

## Current state — October 15, 2026 (paused)

| Work | State | What remains |
|---|---|---|
| S7 [2302](https://github.com/WangPantopus/skinny-pantopus/pull/2302) | Merged October 15 | — |
| Redesign switch [2365](https://github.com/WangPantopus/skinny-pantopus/pull/2365) | Merged October 15 | PB merges its server gate ([2357](https://github.com/WangPantopus/skinny-pantopus/pull/2357)) after Android and iOS |
| Sharing [2316](https://github.com/WangPantopus/skinny-pantopus/pull/2316) | Draft, paused (a privacy fix that may still merge with the key off): menus offer Share only for public, live posts; the server authorizes before the chooser opens; unknown moderation values are refused | Integrate `master`, full checks, two-account, restricted/disabled/stale/offline/repeat-tap and R8 checks |
| Radius and comments [2318](https://github.com/WangPantopus/skinny-pantopus/pull/2318) | Draft, paused: 100-mile ladder and labels, the server's sentence on a refused comment. The October 13 feed still offers "Expand to 1000 mi" while the server reads at most 100, so this fix also suits the key-off app | Re-apply on `master`, old saved radius, offline copy and refused-comment checks, R8 |
| S5/S6 page [2303](https://github.com/WangPantopus/skinny-pantopus/pull/2303) | Draft, paused: grouped page, area pill, views, topics, menus, earlier pages, seen marker | Integrate S7 and `master`; verify against PB's feed branch; the page's header must scroll with the posts at 2× text on small phones (today's Pulse feed keeps a fixed header that leaves only a strip for posts); merges after PB's [2311](https://github.com/WangPantopus/skinny-pantopus/pull/2311)/[2312](https://github.com/WangPantopus/skinny-pantopus/pull/2312) are on `master` (H4) |
| Draft foundation [2315](https://github.com/WangPantopus/skinny-pantopus/pull/2315) | Draft, paused: encrypted per-account drafts and photos that survive process death and sign-out (S8.10) | Integrate `master`, full checks, every persistence, account, photo, failure and deletion case, R8 |

After those, once the build resumes: S9 and S10 (their PB routes are on `master`), full S8 (Pulse-mode creation is on `master`; PS's composer check route is not), then S11–S24 as their owners publish shapes. S25 stays reserved. With PB's gate on `master`, the server answers `/api/pulse` only when `LAUNCH_FEATURES` lists `pulse_redesign`.

## Requests

- → Web owner: S7's current web post page renders an answered Ask as `Solved` and a claimed Offer as a generic `Post`, without `Gone`. Fresh PA two-account browser verification confirms the content loads, but the shared lifecycle wording is still absent.
- → PS/PB: full S8 still depends on the published composer checks/Pulse-mode creation; S9 and later work waits for the corresponding routes on master (H4).
- → PV: TalkBack speech for S7's card and page status was checked with TalkBack's speech output on the emulator. The app is light-only by design (`Theme.kt`), so a dark palette for Pulse screens is still open.
- Stop only a stream's exact PID/port; never use broad process patterns or stop shared Gradle/Kotlin daemons.
- H5: backend routes must deploy before clients consume them. The founder alone deploys, changes hosted systems, sends to real people or submits to stores.

## Needs founder

No new decision requested in this handoff. Existing product hold points still apply.
