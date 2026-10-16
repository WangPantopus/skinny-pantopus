# Pulse build: start here

> **Paused on October 15, 2026 (founder decision).**
> - **The switch:** the redesign is behind the launch-cut key `pulse_redesign`, cut 11 in [`docs/launch-scope-flags-2026-10-01.md`](../../launch-scope-flags-2026-10-01.md). It is off unless listed.
> - **What launches:** the October 13 Pulse, with four tabs (Place · Today · Nearby · Messages) and the feed that opens from Nearby, with its composer and post page. Nothing was removed.
> - **What stays on regardless:** crime and suspicion Heads-ups stay refused, businesses don't start feed posts, and the privacy fixes made during the build stay on.
> - **What is paused with the build:** the October 13 "no feature flag" decision and the October 14 "all of it in the launch build" decision below.
>
> **To resume:**
> 1. Read the dated "Paused" note at the top of your stream's [status file](status/) and the handoff it names.
> 2. List `pulse_redesign` in your local settings: the backend's `LAUNCH_FEATURES`, the web's `NEXT_PUBLIC_LAUNCH_FEATURES`, and `PANTOPUS_LAUNCH_FEATURES` for iOS and Android. Without it, every `/api/pulse` route and Pulse-mode posting answer 403 `PULSE_REDESIGN_UNAVAILABLE`, and the apps show the October 13 Pulse.
> 3. Rebase the open drafts onto master. PB renames its unmerged migrations to sort after master's newest.
> 4. Continue from the handoff. Keep both states working until the redesign ships: new screens stay behind the key, and the October 13 Pulse keeps working with it off.
> 5. Put new redesign-only notification types and jobs behind the key as you add them:
>    - notification types go in the map in `backend/utils/featureFlags.js`;
>    - jobs call `skipForLaunchCut('pulse_redesign', …)`;
>    - routes under `/api/pulse` are already gated.
> 6. To switch it on for people, the founder lists `pulse_redesign` on the hosted backend first, then ships web and app builds with it listed.

Pulse is the calm, place-based conversation space designed in [PR 625](https://github.com/WangPantopus/skinny-pantopus/pull/625) (merged: the design is [`docs/product/pulse-product-design-2026-09-27.md`](../pulse-product-design-2026-09-27.md) and the five wireframes are in [`docs/product/pulse-screens/`](../pulse-screens/)). On October 13, 2026 the founder decided to build all of it, now, without a feature flag; on October 14 the founder confirmed **everything in the design, all of it in the launch build**. This folder is the build kit: what to build, the API and data contract, the delivery order, how to verify, the coverage check, and one brief per stream.

**Read in this order:** [`AGENTS.md`](../../../AGENTS.md) → this file → your stream brief in [`streams/`](streams/) → the design ([`pulse-product-design-2026-09-27.md`](../pulse-product-design-2026-09-27.md), and look at the five wireframes) → [`01-build-spec.md`](01-build-spec.md) → [`02-contract.md`](02-contract.md) → [`03-delivery-plan.md`](03-delivery-plan.md) → [`04-verification.md`](04-verification.md) → [`05-scenarios.md`](05-scenarios.md) → [`06-coverage.md`](06-coverage.md). The design explains why; the build spec says exactly what; where they differ, the build spec wins. The coverage file lists every requirement of the design and the slice that builds it: when you finish a slice, read its rows and check nothing was left out.

## Founder decisions, October 13, 2026

These are authorization for the Pulse build only. They do not widen anything else in `AGENTS.md`.

- [x] **Five tabs:** Place · Today · Pulse · Plans · Messages. The Plans tab shows only when the existing `plans` switch is on; until then the bar has four tabs. Nearby disappears as a tab; its Pulse, Connections and neighborhood meter move into the Pulse tab.
- [x] **Build now, no new feature flag, and do not wait for the Crew Day launch.** Safety comes from ordering (see "Hold points" below) and from the founder deciding when to deploy and cut app builds.
- [x] **Share posts are allowed** (a place attached, at most 2 a week per person). The General/Moment ban is lifted for this one type only.
- [x] **Crime, suspicious, theft, vandalism and scam alert kinds are removed from creation.** Official and curator accounts may post sourced public-safety notices.
- [x] **Businesses reply; they never post.** Today's business posts to the Place feed stop.
- [x] **The PR 625 review's recommendations are the defaults** (its eight fixes, fourteen improvements and the decisions table). They are written into the build spec.
- [x] **Fix the Share leak now.** Built and verified in [PR 2252](https://github.com/WangPantopus/skinny-pantopus/pull/2252); merge it before starting the streams.
- [x] **Adult-only posting, the labels and permissions table, and Visitors who may start Asks (one a day)** as in the design.
- [x] **No unit tests, no coverage.** Quality comes from launching the real apps (web, iOS, Android) and doing every feature, flow, scenario and edge case end to end: [`05-scenarios.md`](05-scenarios.md).
- [x] **Install the tools the build needs.** Done on this Mac; see "Tools" in [`04-verification.md`](04-verification.md).
- [x] **New tables.** On October 14, 2026, the founder approved all eleven tables in [`02-contract.md`](02-contract.md#42-new-tables-awaiting-founder-approval) and the public Census boundary download for Camas, Washougal and Vancouver, replying to PB: "Approve all eleven tables and Census download". H3 is clear for those tables; migrations still require the normal review, CI and local verification. This does not authorize hosted database changes or deployment.
- [ ] **Moderation cover.** Paid moderation for the first town is approved in principle (a part-time contractor beside the founder; the two-hour target only within stated hours; holds limited to call-outs and private information). The founder confirms real cover before the public-exposure PRs in R4 merge (hold point H2).

## Founder decisions, October 14, 2026

- [x] **Finish everything in the design, and have all of it in the app at launch.** Nothing in the PR 625 design or its wireframes is optional or "later" except what needs another product or the founder's own accounts and people. The requirements the first kit missed are slices S20 to S24; [`06-coverage.md`](06-coverage.md) checks every row; the [launch bar](03-delivery-plan.md#the-launch-bar) says what must be true before the build is cut.
- [ ] **Two parts of the design need other products** (S25, reserved): the Crew Day price option in "Suggest a plan" and Crew Day provider pages (need the Crew Day software), and street welcomes (need the Street Organizer's welcome cards). Pulse's side is specified as hooks and stays hidden until those exist. The founder decides before launch: build those products too, or ship Pulse without them.
- [ ] **When the pilot builds ship, relative to this launch.** Open (L4 proposed pinning a pre-Pulse commit for the pilot). Until the founder answers, streams keep merging in the order of the plan and the founder alone decides what is deployed.

## The six streams

| Stream | Owns | Branch prefix | Runtime ports | Starts |
|---|---|---|---|---|
| **PB** Backend and data | `backend/` (all of it except the files PS and PC own), `supabase/migrations/`, `pantopus-seeder/` | `claude/pulse-pb-` | 55000 | now |
| **PI** iOS | `frontend/apps/ios/` | `claude/pulse-pi-` | 56000 | now |
| **PA** Android | `frontend/apps/android/` | `claude/pulse-pa-` | 57000 | now |
| **PS** Safety and composer checks | new `backend/services/pulse/safety/*`, `backend/routes/pulseSafety.js`, `backend/routes/adminReports.js`, web `frontend/apps/web/src/app/(app)/app/admin/` | `claude/pulse-ps-` | 58000 | now |
| **PC** Channels and public web | digest and notification jobs, email and text channels, public web pages | `claude/pulse-pc-` | 59000 | after R2 starts (about week 3) |
| **PV** Verification and release | `scripts/pulse/`, `docs/product/pulse-build/04-verification.md` and `06-coverage.md`, the status board, release sweeps, CI health; no product code | `claude/pulse-pv-` | 60000 | now |

Each stream works in its own worktree and branch, runs its own local database and device (see [`04-verification.md`](04-verification.md)), keeps PRs small, and merges its own PRs after green CI and a real-app check. Details per stream are in its brief. A seventh role, **the coordinator** (the session that wrote this kit), answers contract questions and keeps this folder current when the founder asks.

## Rules for every stream

1. **Reuse before rebuilding.** Find the existing screen, route, service and table first and change it in place. New tables only from the approved list. Keep working screens' layouts, styling and navigation, except the tab bar change the founder approved. New work uses existing components and tokens; the wireframes show behavior, not visual design.
2. **Additive and backward compatible.** API changes only add fields and routes. Migrations follow `scripts/db/check-migrations.cjs` (`Backwards compatible: yes.` with a reason, `SET LOCAL lock_timeout='5s';`, RLS on every new table, `REVOKE EXECUTE` on SECURITY DEFINER functions). Never edit an applied migration. Older app builds must keep working.
3. **No flag, so no half-features.** Every merged PR leaves the apps shippable. Code that is not ready is simply not linked from anywhere reachable. Respect the hold points below.
4. **Ownership.** Edit only your paths. Need something in another stream's area? Put it under "Requests" in your status file and tell the founder. Shared files (routes, navigation, contracts, notification plumbing) have one writer per patch.
5. **Verify end to end in the real apps: all scenarios, all edge cases, all three clients.** Launch the apps (the web app, the iOS simulator, the Android emulator) against your own local backend and database and do every flow of your slice from [`05-scenarios.md`](05-scenarios.md): with two accounts, after relaunch, offline, with odd data and old data, then again on the other clients. API output or green CI alone is not proof. Every PR body ends with `Scenarios run: …` and what you could not verify (hosted services, physical phones, live providers).
6. **No tests, no coverage.** Do not write unit tests, UI-test code, snapshot baselines for new screens or coverage tooling, and do not chase coverage numbers. If an intended behavior change breaks an existing test, update or remove it in the same PR, and run the existing checks before pushing (list in [`04-verification.md`](04-verification.md#checks-before-you-push)). Your effort goes into rule 5.
7. **Public repository.** No credentials, keys, env files, device tokens, database archives, logs or real people's data in Git, PRs, screenshots or chat. All fixtures are synthetic and removed afterwards.
8. **Founder-only.** Only the founder spends money, enters credentials in consoles, writes secrets into hosted services, changes hosted databases or production configuration, sends anything to real people (emails, texts, pushes beyond test accounts), deploys, or submits to the app stores. Build the code; stop there.
9. **Identity.** Commits use the repository's configured identity (Yingpeng Wang, wang@pantopus.com) and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
10. **Other sessions' resources are not yours.** Do not stop, reset or use the Supabase stacks named `*stream1-rebuilt*`, `*s34-home*` or any other you did not start, the Android emulators `Pantopus2174Review`, `PantopusPRReview`, `pantopus-pr-review`, or the iOS simulator `PantopusPRReview`. Create your own (see [`04-verification.md`](04-verification.md#devices)).
11. **Stay in the contract.** Field names, enums and error codes in [`02-contract.md`](02-contract.md) are shared by three codebases. Change them only through a small PR to that file, reviewed by PB (it owns the contract) and announced in your status file.
12. **Merge through the shared master queue.** Other sessions (Instant Screens, Plans, the release stream L4 and others) merge to master too, and a newer push cancels a pending master CI run. Before merging, read the latest entries of `/Users/yingpengwang/skinny-pantopus/launch-streams/status/REQUESTS.md`. If another session's HOLD is active, wait for its RELEASE. Otherwise append `- [ ] <date -u> <your stream> → all: HOLD for #<n>`, merge only once the previous master CI run is in progress, then append `- [x] <date -u> <your stream> → all: RELEASE, #<n> merged <sha>`. Answer hold requests within minutes and keep slots short.

## Hold points (what replaces a feature flag)

| | A PR of this kind… | …waits until |
|---|---|---|
| **H1** | PB lets people create `share` or `offer` posts, or returns `author_label` and new fields in any response older clients decode | PI and PA have merged tolerant decoding (slice S2) |
| **H2** | PC publishes public town pages, search-engine indexing or signed-out browsing (R4) | PS's moderation baseline (S11) is merged and the founder has confirmed moderation cover |
| **H3** | Any migration that creates a table | The founder ticks "New tables" above |
| **H4** | A client PR that needs a new field or route | The backend PR that adds it is on `master` |
| **H5** | The founder deploys | Backend first, then web, then app builds. Every PR that needs this order says so |
| **H6** | PB merges the sign-up-by-code endpoints (S20) | PB's design note is in its status file and PV has run the abuse run (S20.8) and recorded the findings |

## Status and communication

Each stream owns one file in [`status/`](status/): what is done (PR links), what is next, "Requests" to other streams, and "Needs founder". Update it in your own PRs or in a small docs PR. Before starting a slice, fetch `master` and read the status files of the streams you depend on. The founder reads these files and answers "Needs founder" items in chat.

## Open questions (defaults apply until the founder answers)

| Question | Default |
|---|---|
| Sign-up at the moment of posting without a password (email or text code) | **Built (S20, since October 14):** email code now, text code when the founder's SMS provider exists. Password and Apple or Google sign-in stay. |
| Residents edit Known directly | No. They confirm, correct or flag outdated; two matching confirmations publish a refresh; staff handle disputes. |
| Search-engine indexing of public town posts from day one | Yes, once H2 holds. Authors can remove a post from the web view. |
| Neighborhood boundaries | City-recognized neighborhoods where they exist, otherwise a labeled radius. Street and neighborhood areas open per area (data-gated), not in the first release. |
| Where the neighborhood meter and the "Set up a home" prompt go | Into the Pulse tab as a quiet-state card. |
| Text channel (SMS) and reply-by-email | R4. Needs the founder's provider accounts first. |
| Crew Day option, Crew Day provider pages, street welcomes (S25) | Reserved as hooks; not built until Crew Day and the welcome cards exist. The founder decides at the launch bar (see above). |
| Pilot builds before this launch | Open (see the October 14 decisions). |
