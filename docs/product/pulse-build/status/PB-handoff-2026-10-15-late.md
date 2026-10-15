# PB handoff — October 15, 2026 (late)

Continue from here; this replaces the morning handoff ([PB-handoff-2026-10-15.md](PB-handoff-2026-10-15.md), kept as history). Everything below was true at about 08:00 UTC on October 15.

## Start here (five minutes, nothing to rebuild)

1. Your session gets its own worktree. `git fetch origin`, then check out the S16 branch under a local name: `git switch -c pb-s16 origin/claude/pulse-pb-s16-places` (it contains every open PB branch below, stacked).
2. `source ~/.config/pantopus/dev-env.sh` before node, pnpm, supabase or java. `pnpm install --frozen-lockfile --prefer-offline` once in your worktree (about 20 s), and copy `backend/.env` from `.claude/worktrees/pulse-pb-s8-continue-513ec0/backend/.env` (local only).
3. The runtime is live; reuse it (table below). Check: `lsof -nP -iTCP:55100 -iTCP:55101 -sTCP:LISTEN`, `docker ps | grep pulse-pb`, `xcrun simctl list devices | grep Pulse-PB`, `adb devices`.
4. The backend and web run from the previous worktree, `.claude/worktrees/pulse-pb-s8-continue-513ec0` (branch `claude/pulse-pb-s16-places`, the same code you check out). Keep them until you change backend code; then point the runtime at your worktree: `ln -sfn <your worktree>/supabase/migrations ~/.config/pantopus/pulse-pb-runtime/supabase/migrations` and `PB_WORKTREE=<your worktree> ~/.config/pantopus/pulse-pb-runtime/restart-backend.sh`.

## Only three lanes exist (founder, October 15)

The founder opened three lanes for this work: **PA** (Android), **PB** (backend, this lane) and **PI** (iOS). There is no PS (safety), PC (channels) or PV (verification) session, so their parts of the kit have no owner until the founder decides otherwise:

- **PS:** `backend/services/pulse/safety/*` (the composer checks, so S8's seam fails open and nothing is blocked or held), the S11 moderation actions, tables and appeals, `routes/pulseSafety.js` and `routes/adminReports.js`, the web moderator console, `interestInReply` (S14), Known drafting and curator seeding, Official verification and offer approval (S17), the emergency hold (S23).
- **PC:** the digest and noise budget (follow alerts stay in-app and Right now pushes nothing until it exists), `GET|PUT /api/pulse/preferences`, email and text channels, the public web pages and sitemap (S15).
- **PV:** release sweeps, `06-coverage.md`'s Verified column, `status/BOARD.md`, and S20's abuse run.
- **Hold points:** H2 (public exposure) needs PS's S11 baseline and the founder's moderation cover; H6 (sign-up by code) needs an abuse run from a session other than the one that built it.

**Founder's decision (October 15):** PB stays on its own slices and leaves PS, PC and PV work unowned for now. Don't build it or edit their files (`backend/services/pulse/safety/*`, `routes/pulseSafety.js`, `routes/adminReports.js`, `backend/jobs/pulseDigest*.js`, `backend/services/pulse/digest/*`). PB's seams stay fail-open (composer checks, `interestInReply`) or in-app only (follow alerts, Right now). S15's public endpoints stay a draft PR (H2) and S20's PR stays a draft (H6, nobody runs the abuse run yet); say so in `status/PB.md` under "Needs founder".

## First: merge S12 (green, waiting only for the queue)

The S12 chain is green on every check: [#2346](https://github.com/WangPantopus/skinny-pantopus/pull/2346) contract (`05c6d1b51`) → [#2347](https://github.com/WangPantopus/skinny-pantopus/pull/2347) Known (`55e6a8f33`) → [#2349](https://github.com/WangPantopus/skinny-pantopus/pull/2349) search and Upcoming (`ffcfb5418`) → [#2350](https://github.com/WangPantopus/skinny-pantopus/pull/2350) Right now (`c4bd5ed964730f2833df4d486f223d07fa3fda9a`). All real-app checks are recorded in the PRs and `status/PB.md`. It wasn't merged only because master's CI run for PI's last merge (`6c6de53d2`, run 38701561307) was still queued, and merging then would have cancelled it.

1. `gh run list --branch master --workflow CI --limit 3`: wait until the newest master run is `in_progress` or done (never merge while one is `pending`/`queued`: a new push cancels it). Read the last lines of `/Users/yingpengwang/skinny-pantopus/launch-streams/status/REQUESTS.md`; wait for any open HOLD's RELEASE.
2. Migrations must sort after master's newest: `git ls-tree --name-only origin/master supabase/migrations/ | tail -2` (it was `20261015053000_pulse_offer_claims.sql`; the chain adds `20261015070000_pulse_known`, `071000_pulse_post_search`, `072000_pulse_right_now`). If master gained a newer one, rename the chain's files (keep their order), push, wait for green, and fix the local ledger (`update supabase_migrations.schema_migrations set version=…`).
3. `gh pr edit 2350 --base master`, append `- [ ] <date -u> PB → all: HOLD for #2350 …` to REQUESTS.md, `gh pr merge 2350 --merge --match-head-commit <full head sha>`, mark the HOLD `[x]`, append the RELEASE line. GitHub marks #2346, #2347, #2349 merged with it.

## Then, in order

1. **S14** ([#2351](https://github.com/WangPantopus/skinny-pantopus/pull/2351) contract, base #2346's branch; [#2352](https://github.com/WangPantopus/skinny-pantopus/pull/2352) implementation, base #2350's branch). Built and checked on iOS, Android and the API (see the PR). After S12 merges: retarget #2351 to master, rebase #2352 onto master (it carries #2351's two commits `64b644cdc`, `24565df79`), wait for green, merge #2352 (one slot brings both). New migrations: `20261015073000_pulse_plan_source`, `20261015074000_pulse_plan_invites` (renumber if needed). Read #2352's CI first: it was pending at handoff.
2. **S16/S17 contract** [#2353](https://github.com/WangPantopus/skinny-pantopus/pull/2353) (base #2351's branch): retarget and merge with or before S16.
3. **S16, finish and verify** (branch `claude/pulse-pb-s16-places`, commit `23381028c`, **not yet verified**, no PR): migration `20261015075000_pulse_places.sql` (applied locally), `services/pulse/places.js` (`GET /api/pulse/places/:id`, `POST /places/:id/observations`), place areas in Pulse mode, town labels for unrestricted places (`areas.labelFor`), `areaDto` radius titles, `feed.scan({ ended })`, observation limits, Residents only (`?residents_only=1`), the street `plans_line`. To verify: add a synthetic open place (e.g. a park, `kind place`, `place_type park`, parent Camas, a small boundary or `radius_m`, `opened_at` now) and a restricted building over Carol's home; post about each in Pulse mode; observations as the Visitor (one a day) and Alice; the place page for each account (restricted: `can_read: false` for non-residents); Residents only on a Local government Ask; plans line on Carol's street with a plan inside it. Then the existing checks, PR, merge.
4. **S17** (contract 2.20): widen `User.account_type` with `official` (additive check widening; today the check allows only `individual`, `business`, `curator`, so Official accounts can't exist yet), business replies by service topic with the weekly cap (businesses are their own accounts, `account_type: business`; categories are free text, so `businessTopics.js` maps them, `BusinessProfile.attributes.pulse_topics` overrides), Local offers as `deal` posts with `distribution_targets: ['local_offer']`, held until `approveOffer` (no new table), `GET /api/pulse/local-offer`.
5. **S15** public endpoints: build, but keep the PR a draft. Hold point H2: PS's S11 baseline isn't merged (no PS session exists yet) and the founder hasn't confirmed moderation cover.
6. **S20** sign-up by code: design note in `status/PB.md` first; the PR stays a draft until PV runs the abuse run (H6). No PV session exists yet; say so in "Needs founder".
7. **S21–S24** as the stream brief lists.

## Runtime (all PB's own; never touch PA's `emulator-5574`, PI's `Pulse-PI` simulators or other stacks)

| What | Where and how |
|---|---|
| Private runtime | `~/.config/pantopus/pulse-pb-runtime` (mode 700): `accounts.json` (synthetic alice, bob, carol, visitor; the `official` entry has no account), `fixtures.json`, `street-area.txt`, logs, PID files. New this session: `pb.cjs` (API helper plus `mod(path)` to load your worktree's backend modules in process; `PB_WORKTREE` overrides the root), `restart-backend.sh` (refuses a listener that isn't PB's), `bin/pbsql` (psql to PB's database only), `web-signin-oneshot.cjs` (serves one synthetic account's sign-in once to the local web origin, then exits), `fixtures-1015/` (ids of this session's synthetic posts, entries, events and plans, with a README) |
| Supabase | `*_pantopus-pulse-pb`; API 55001, Postgres 55002, inbox 55004. Migrations link points at `.claude/worktrees/pulse-pb-s8-continue-513ec0/supabase/migrations`. Local ledger has `20261015070000` … `20261015075000` applied (the chain's files) |
| Backend | `http://127.0.0.1:55100`, detached `node app.js` from `.claude/worktrees/pulse-pb-s8-continue-513ec0/backend` (branch `claude/pulse-pb-s16-places`), PID in `backend.pid`, log `backend.log` |
| Web | detached `next dev -p 55101 -H 127.0.0.1` from the same worktree's `frontend/apps/web`, PID in `web.pid`, now with `NEXT_PUBLIC_API_URL=http://localhost:55100` and `NEXT_PUBLIC_APP_URL=http://localhost:55101`: the app's browser pane opens `127.0.0.1` as `localhost`, and the backend's `APP_URLS` allows both. Sign in at `localhost:55101/login` with `node ~/.config/pantopus/pulse-pb-runtime/web-signin-oneshot.cjs bob &` then fill the form from a `fetch('http://127.0.0.1:55199/')` in the page (never print the password). The pane keeps the session only within one page load: after signing in, move around with the app's own links (a full navigation signs you out) |
| iOS | simulator `Pulse-PB`, UDID `65EB814A-0BF5-4310-BACE-BFEF34EEEAF1`, booted, Carol signed in, PI's top draft build (now merged as PI's stack). The Plans tab shows (plans switch on for Carol). Toggles flip with a short horizontal swipe, not a tap. Bundle `app.pantopus.ios` |
| Android | AVD `pulse-pb` on `emulator-5572`, Alice signed in, PA #2303 build, `app.pantopus.android.debug`. Plans tab shows. Always `adb -s emulator-5572`; tap from `uiautomator dump` bounds |

## Fixture and local state worth knowing

- `FeatureFlag` `plans`: `beta_user_ids` = Bob, Alice, Carol (local only; was empty). Restore when you no longer need Plans checks.
- Synthetic content from this session (ids in `fixtures-1015/`): follow-alert Asks ("PB FA: …"), Known posts and two published entries (plumbers, trash), Upcoming events, Right now Heads-ups (all events ended), S14 plans (a coffee walk that "happened", a cancelled town walk, a street coffee, a yard-waste walk Alice is in, an invited walk with Bob re-invited). Carol's town-only knives Ask p3 and the narrowing probe p4 were narrowed to the town. Remove what you don't need; don't reseed.
- The Visitor was set to `curator` for the Right now official run and restored to `individual`.

## Learned this session (keep)

- A new foreign key to `Home` fails `supabase/tests/home-delete-transaction.test.sql` unless `home_delete_eligibility` names the table: store home ids without a foreign key in Pulse tables.
- A second foreign key between two tables (e.g. `Plan` → `Post`) makes every existing PostgREST embed between them ambiguous (all Plans reads answered 503): add the column without a foreign key.
- Function lint locally: `PATH=~/.config/pantopus/pulse-pb-runtime/bin:$PATH node scripts/db/check-function-lint.cjs --workdir ~/.config/pantopus/pulse-pb-runtime`.
- Full backend Jest: one or two unrelated suites fail under load; rerun them with `--runInBand` before calling it a failure.
- `feedService`'s mute and hide filters are cached per process for 60 seconds: in-process probes see a stale mute that the backend itself has already dropped.

## Open requests (also in `status/PB.md`)

- → PI, PA: render the conversation's `plan` card (existing Plans card plus `closing_line`), the reply `going` chip, an `invited` request state (Android labels the invitation sheet "Update request"), the follow-alert notice (`pulse_follow_reply`; Android's two-line title fits now), Known, Upcoming, Right now and search screens (contract 2.14–2.18).
- → PC: content helpers and follow-alert types are on master (`backend/services/pulse/content.js`; see `status/PB.md`).
- → PS: `evaluateComposerChecks`, `interestInReply`, the console for Known drafting, corrections, Official verification and offer approval.

Commit footer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. No new tests, hosted changes or deployment.
