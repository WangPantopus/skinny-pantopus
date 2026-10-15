# PB handoff — October 15, 2026

Continue from here; this replaces the October 14 handoff for the current state (that file stays as history). Everything below was true at about 06:20 UTC on October 15.

## Start here (two minutes)

1. Your session gets its own worktree (a hook keeps edits there). Fetch, then work on the open S8 branches there: `git switch -c pb-s8-create origin/claude/pulse-pb-s8-create` (it contains `claude/pulse-pb-s8-contract`).
2. `source ~/.config/pantopus/dev-env.sh` before node, pnpm, supabase or java.
3. The runtime is live and reused, nothing to rebuild: Supabase stack, backend, web, the iOS simulator and the Android emulator are all running (table below). Check with `lsof -nP -iTCP:55100 -iTCP:55101 -sTCP:LISTEN`, `docker ps | grep pulse-pb`, `xcrun simctl list devices | grep Pulse-PB`, `adb devices`.
4. The backend and web run from the previous session's worktree, `.claude/worktrees/pulse-pb-backend-continue-0c75f4` (branch `pb-s8-create`, same code as `claude/pulse-pb-s8-create`). Keep them until you change backend code; then run them from your worktree (below).

## State of the work

**Merged on October 15** (all two-account checked on PB's iOS, Android and web builds):
- #2322 (one merge, with #2311, #2312, #2313, #2317, #2319, #2320, #2321): distance text, the Pulse feed (S6), conversation reads, reply survival after account deletion, Helpful and private Thanks, private follows. Merge `e7eaa354f`; master CI green after a rerun of a runner port flake. Also two fixes found in the native checks: Following never shows the town meter (`quiet` is only `empty` there), and a withdrawn Helpful mark takes its notice out of the inbox (`20261015051000_pulse_withdrawn_helpful_notices.sql`).
- #2339 (with #2337, #2338): offer requests and the giver's choice (`OfferClaim`, `20261015053000_pulse_offer_claims.sql`), reply reports into the existing `PostReport` queue (`comment_id`), and narrowing who can read (`PUT /api/pulse/posts/:id/read-scope`). Merge `f21db7287`; its master CI run was in progress at handoff. Check it first; a `database` job failing with "address already in use" on port 54322 is a runner flake: rerun the failed job (`gh run rerun <id> --failed`).
- The chain's migrations were renumbered after master's newest before merging (CI refuses new files that sort before a merged one). Before every merge, compare your new migrations with master's newest (`MIGRATION_BASE_SHA=$(git rev-parse origin/master) node scripts/db/check-migrations.cjs`) and rename unmerged ones if needed, then fix PB's local ledger (`update supabase_migrations.schema_migrations set version=…`).

**Open, green CI, ready to merge after a last look:**
- [#2340](https://github.com/WangPantopus/skinny-pantopus/pull/2340) S8 contract (draft, base master) and [#2341](https://github.com/WangPantopus/skinny-pantopus/pull/2341) S8 implementation (draft, base `claude/pulse-pb-s8-contract`): Pulse-mode creation and edits. To merge: retarget #2341 to master, `gh pr ready 2340 2341`, append a HOLD line to `/Users/yingpengwang/skinny-pantopus/launch-streams/status/REQUESTS.md`, merge #2341 at its exact head (`gh pr merge 2341 --merge --match-head-commit <full sha>`), append RELEASE. PS's `evaluateComposerChecks` doesn't exist yet: the seam fails open (nothing blocks or holds) until PS ships `backend/services/pulse/safety/composerChecks.js`; say so in the RELEASE line.

## Next PB work, in order

1. Merge S8 (above) and record it in `status/PB.md`.
2. **S10 / PC seams** (PC asked; not built): a module (suggest `backend/services/pulse/content.js`) with `digestPosts(viewerId, { since, until, limit })` (street, neighborhood, town groups of `PulsePost`, newest first, total count; no distance, no media, never advances a marker), `unansweredForHelper(viewerId, { minAgeHours, limit })` (open Asks with no replies in topics the viewer follows or answered before), `followRecaps(viewerId, { since })` (followed conversations with `notify` recap or each that got replies, with the new `PulseReply` rows) and `getSeenMarker(viewerId, view)` (`seen.lastSeen`). Reuse `feed.js`'s `scan`, `groupsFor` and `contextFor` (export them) and `conversation.repliesFor`. Name the notification types in contract §6: `pulse_follow_reply` (a followed conversation got a reply, `notify = each`) and `pulse_right_now`. On reply creation (`routes/posts.js`, `router.post('/:id/comments'` around line 2950) create in-app `pulse_follow_reply` rows for `each` followers who can still read the post, skipping blocks and the author, with `sendPush: false` (PC's noise budget decides pushes). Tell PC the module names in `status/PB.md`.
3. **S12** Known, Right now, search, Upcoming: contract addendum first (§3 outlines the routes), then `KnownEntry`, `KnownConfirmation`, `RightNowEvent`, `RightNowReport` (approved tables).
4. **S14** conversation to Plan (`Plan.source_post_id`, `POST /api/pulse/posts/:id/plan`, the `plan` field in the conversation payload) through `backend/services/plans/*`.
5. **S15–S17** public endpoints with PC (H2), place pages and area opening, business offers and Official identity with PS.
6. **S20** sign-up by code: design note in `status/PB.md` first; PV's abuse run before merge (H6).
7. **S21–S24** recurring Plans and co-hosts, Support Train link, duplicate merge hooks, reading homes, pins and acquisition counts.

## Open requests and ownership notes

- PS's brief lists reply reports under S11. PB built a minimal `POST /api/pulse/posts/:postId/replies/:replyId/report` (existing `PostReport` queue, `comment_id`) because PI's S9 client calls it; tell PS it may move the route into `pulseSafety.js` and show reply reports in the console.
- PA and PI: S6.6 offline wording (a failed refresh keeps the copy but shows no "Couldn't refresh. Showing …" line; Android shows nothing, iOS a toast). Following's end card says "everything new around Camas"; a Following line would read better.
- Web owner: the legacy post page still shows Share on a narrowed post (the server refuses with `SHARE_NOT_ALLOWED`).

## Runtime (all PB's own; never touch PA's `emulator-5574`, PI's `Pulse-PI` simulators or other stacks)

| What | Where and how |
|---|---|
| Private runtime | `~/.config/pantopus/pulse-pb-runtime` (mode 700): `accounts.json` (synthetic alice, bob, carol, visitor; `@example.com`), `fixtures.json`, `pb-api.cjs` (API helper; its `root` points at the previous session's worktree; edit it if you remove that), `bin/psql` (refuses any host but PB's), `street-area.txt`, logs, PID files, `shots/` |
| Supabase | containers `*_pantopus-pulse-pb`; API 55001, Postgres 55002, inbox 55004; `supabase/migrations` in the runtime is a symlink to the previous session's worktree; repoint it to yours: `ln -sfn <your worktree>/supabase/migrations ~/.config/pantopus/pulse-pb-runtime/supabase/migrations`. Apply new migrations with `supabase migration up --workdir ~/.config/pantopus/pulse-pb-runtime --local`, then `NOTIFY pgrst, 'reload schema'` |
| Backend | `http://127.0.0.1:55100`, detached `node app.js` from `<worktree>/backend`, PID in `backend.pid`, log `backend.log`. Restart from your worktree: `pnpm install --frozen-lockfile --prefer-offline` (about 20 s), copy `backend/.env` from `.claude/worktrees/pulse-pb-backend-continue-0c75f4/backend/.env` (local only: `APP_ENV=local`, `PUSH_EXPO_ENABLED=false`, `CRON_ENABLED=false`), `kill $(cat ~/.config/pantopus/pulse-pb-runtime/backend.pid)`, then `cd <worktree>/backend && nohup node app.js >> ~/.config/pantopus/pulse-pb-runtime/backend.log 2>&1 & echo $! > ~/.config/pantopus/pulse-pb-runtime/backend.pid` |
| Web | `http://127.0.0.1:55101`, detached `next dev` from `<worktree>/frontend/apps/web` with `NEXT_PUBLIC_API_URL=http://127.0.0.1:55100 NEXT_PUBLIC_APP_URL=http://127.0.0.1:55101`, PID in `web.pid`. Bob is signed in in the app's browser pane; sign in at `127.0.0.1:55101/login` (not localhost); the feed needs a stubbed `navigator.geolocation` |
| iOS | simulator `Pulse-PB`, UDID `65EB814A-0BF5-4310-BACE-BFEF34EEEAF1`, booted, signed in as Carol. The installed app is PI's top draft #2325 (`1ac2b709a`, contains #2308, #2314, #2323, #2324) built in `ios-client/` with derived data `dd/` (rebuild command in the October 14 handoff). The iOS Simulator tool has access to this device. Sign in by `xcrun simctl pbcopy` of the password from `accounts.json`, paste, then clear the pasteboard; never print passwords |
| Android | AVD `pulse-pb` on `emulator-5572` (headless, detached, PID in `emulator.pid`), signed in as Alice; PA #2303 (`a0d1fc8cd`) built in `android-client/`. Always `adb -s emulator-5572` |

**Fixture state worth knowing:** an opened synthetic street "PB Test Street" (200 m around Carol's home; id in `street-area.txt`); Carol's "shared garden tools" Ask narrowed to that street, her lost-and-found and Share fixtures narrowed to `verified_town`; the tomato-cage Offer is claimed (Alice chosen, Bob gone); many "PB S8 …" probe posts; Bob's first probe Share backdated 8 days; the synthetic homes got map centers (the old Nearby meter reads "forming"); Alice keeps a "keep" follow on the street Ask she can no longer read. Remove fixtures you add; don't reseed.

Commit footer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. No new tests, hosted changes or deployment.
