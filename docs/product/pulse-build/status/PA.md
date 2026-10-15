# PA status: Android

Owner: the PA session. Keep this file current in your own PRs (or a small docs PR): what is done with PR links, what is next, requests to other streams, and anything that needs the founder. Read the other streams' files on `master` before starting a slice that depends on them.

## Done

- **Runtime (Oct 13).** Stream `pa`: its own Supabase stack (Postgres 57002, API 57001), backend on 57100, AVD `pulse-pa` on console port 5574, local accounts `alice`, `bob`, `carol`. A first Android compile of `master` took 28 minutes and a Release (R8) build 36 while the iOS stream's Swift build ran (load average 80 to 150); later debug builds are incremental.
- **S2 Tolerant decoding:** [PR 2265](https://github.com/WangPantopus/skinny-pantopus/pull/2265), merged. The feed, one post, its comments, My posts, Saved and the notification list read around a null or missing field and skip an item that can't be read; verified in the real app on a debug and an R8 Release build (odd and "poison" payloads through a local proxy, relaunch, offline, backend stopped, a brand-new account). With PI's PR 2263 on `master`, hold point H1 is clear for Android.
- **S1 (client):** [PR 2271](https://github.com/WangPantopus/skinny-pantopus/pull/2271), merged October 14. The Heads-up picker offers Road hazard, Power outage, Weather damage, Missing pet, Hazard and Other and starts on Hazard; no "Post as this business" on the owner dashboard; no "Business Area" in the composer's first step (it posted as the business to Place, which the server refuses with `403 BUSINESS_CANNOT_POST`). Verified as bob, who owns a business with a location, on a debug and an R8 Release build; a Road hazard posted from the Release build is stored as `alert` / `road_hazard`.
- **S3 Five tabs:** [PR 2293](https://github.com/WangPantopus/skinny-pantopus/pull/2293), merged October 14. Place · Today · Pulse · Plans · Messages; Plans only while the person's `plans` switch is on, following it while the app runs (standing on Plans when it turns off lands on Pulse); Nearby links and the `/app/nearby` pushes open Pulse; plan links open on the Plans tab; Connections in Pulse's "More" menu; the meter and "Set up a home" as one quiet-state card at the top of the Pulse posts, re-read by a pull. Each tab is one TalkBack node with the Tab role ("selected. Messages, 1 unread. Tab. 4 of 4"). Verified on a debug and an R8 Release build with bob and carol: the switch at runtime, every link and push cold and warm, process death, 2× text on a 320 dp phone, TalkBack, offline, sign-out and a second account, web `/app/nearby`.

## Next

- **Reopening after the app was stopped in the background** (found while verifying S3, older than S3): `MainActivity` routed its launch link again after process death, so an app opened by a post or plan link came back on that link instead of where the person was. Fixed and checked on the emulator (branch `claude/pulse-pa-no-link-replay-on-restore`); PR next.
- **S4 (client)** topic chips on today's Nearby feed, "Mute this topic" and "Muted topics" in Pulse preferences: built and checked on the emulator (branch `claude/pulse-pa-s4-topics`), PR next. Then **S7 (client)** status words and the asker's Keep open / Close. Both servers are on `master`. The details were agreed with PI for parity on October 14 (ids, copy, the everywhere mute until S5's area ids, the Close confirmation, the status chip on My posts and Saved); PI records them in `status/PI.md`.
- **S6** the Pulse page against contract-shaped fixtures (draft branch `claude/pulse-pa-s6-pulse-page`; waits for PB's S6 on `master`, H4). Its header must scroll with the list: at 2× text on a 320 dp phone today's feed header fills most of the screen above the posts. Then **S8** composer and **S9** conversation, each PR waiting for PB per the hold points.

## Requests (to other streams)

- → PV: for S2.1 I replay odd payloads (unknown `post_type`, unknown enum values, extra fields, nulls, missing fields, items that cannot be decoded) through a small local proxy in front of my backend (feed, post, comments, notifications, My posts, Saved). I can add it to `scripts/pulse/` for iOS and web if you want it; say so. The sign-in problem with `@example.invalid` emails is in PB's note above; I moved my accounts to `@example.com` by hand.
- → PV, for the TalkBack part of the release sweep: on an emulator, `adb shell input tap` bypasses TalkBack's touch exploration (a tap activates instead of focusing). `adb -s <emulator> emu event mouse <x> <y> 0 1` then `… 0 0` goes through it like a finger, and TalkBack's Developer settings → "Display speech output" puts what it says on screen for a screenshot.
- Deploy order, for the founder and PV (H5): PB's S1 server refuses the Android composer's old default Heads-up kind (Theft). Until an app build with the S1 client change is out, Heads-ups from the current Android app fail with "Heads-ups can't be about crime or suspicious people." Cut the app build with S1 in it before, or together with, the backend deploy.
- → every stream: please stop your local backend by its PID or port, not with a pattern such as `pkill -f "node app.js"`. On October 13 at 23:58 Pacific my backend (port 57110) was stopped at the moment PB's and PI's backends restarted.

## Needs founder

None yet.
