# PA status: Android

Owner: the PA session. Keep this file current in your own PRs (or a small docs PR): what is done with PR links, what is next, requests to other streams, and anything that needs the founder. Read the other streams' files on `master` before starting a slice that depends on them.

## Done

- **Runtime (Oct 13).** Stream `pa`: its own Supabase stack (Postgres 57002, API 57001), backend on 57100, AVD `pulse-pa` on console port 5574, local accounts `alice`, `bob`, `carol`. A first Android compile of `master` took 28 minutes and a Release (R8) build 36 while the iOS stream's Swift build ran (load average 80 to 150); later debug builds are incremental.
- **S2 Tolerant decoding:** [PR 2265](https://github.com/WangPantopus/skinny-pantopus/pull/2265), merged. The feed, one post, its comments, My posts, Saved and the notification list read around a null or missing field and skip an item that can't be read; verified in the real app on a debug and an R8 Release build (odd and "poison" payloads through a local proxy, relaunch, offline, backend stopped, a brand-new account). With PI's PR 2263 on `master`, hold point H1 is clear for Android.

## Next

- **S1 (client)** in review, [PR 2271](https://github.com/WangPantopus/skinny-pantopus/pull/2271): the Heads-up picker offers Road hazard, Power outage, Weather damage, Missing pet, Hazard and Other and starts on Hazard (checked on an R8 Release build, October 14); the business owner dashboard loses "Post as this business"; and the composer's "Business Area" destination is gone (it posted as the business to Place, which the server now refuses with `403 BUSINESS_CANNOT_POST`; it showed only for a business with a location, so the first check missed it).
- **S3** the five-tab bar (Place, Today, Pulse, Plans, Messages): branch `claude/pulse-pa-s3-five-tabs`, built and partly verified on the emulator, PR next. Then the Pulse page and the conversation against contract-shaped fixtures while PB's S5 and S6 land. A client PR that needs a new route waits for the backend PR on `master` (H4).

## Requests (to other streams)

- → PB: legacy replies. The contract (4.1) makes `PostComment.user_id` nullable and soft-deletes the text. Android now reads a reply with no `user_id`, no text or no `is_deleted` as an anonymous reply instead of failing the whole post. If the legacy `GET /api/posts/:id/comments` should hide or label such rows instead, say so; the Pulse endpoint's `removed: true` is what S9 renders as "Reply removed".
- → PV: for S2.1 I replay odd payloads (unknown `post_type`, unknown enum values, extra fields, nulls, missing fields, items that cannot be decoded) through a small local proxy in front of my backend (feed, post, comments, notifications, My posts, Saved). I can add it to `scripts/pulse/` for iOS and web if you want it; say so. The sign-in problem with `@example.invalid` emails is in PB's note above; I moved my accounts to `@example.com` by hand.
- Deploy order, for the founder and PV (H5): PB's S1 server refuses the Android composer's old default Heads-up kind (Theft). Until an app build with the S1 client change is out, Heads-ups from the current Android app fail with "Heads-ups can't be about crime or suspicious people." Cut the app build with S1 in it before, or together with, the backend deploy.

- → every stream: please stop your local backend by its PID or port, not with a pattern such as `pkill -f "node app.js"`. On October 13 at 23:58 Pacific my backend (port 57110) was stopped at the moment PB's and PI's backends restarted.

## Needs founder

None yet.
