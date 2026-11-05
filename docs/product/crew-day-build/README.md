# Crew Day build: start here

Crew Day is the first money feature (NEXT_STEPS section 0, October 22): a local crew services several homes on one
street on a set date, and each household books, approves and pays its own price. Until now it ran by hand (sheets,
texts, and Pantopus business invoices). This kit builds it into the server, the web, iOS and Android, behind the new
launch-cut key `crew_day`, on the feature branch `crew-day`. The founder tests from `crew-day` before deciding to
release.

**Read in this order:** [`AGENTS.md`](../../../AGENTS.md) → this file → your brief in [`prompts.md`](prompts.md) →
the [Street Organizer design](../street-organizer-design-2026-09-27.md) (why) → [`01-spec.md`](01-spec.md) (what each
person sees and the rules) → [`02-contract.md`](02-contract.md) (data, API, notifications, jobs) →
[`03-slices.md`](03-slices.md) (who builds what, in what order) → [`04-scenarios.md`](04-scenarios.md) (how it is
verified) → [`05-status.md`](05-status.md). Where the design document and this kit differ, this kit wins.

**Designs:** the private Design canvas [Crew Day designs](https://claude.ai/artifact/WbwmCoReKrDHGN2mGNg9oP). Every
screen in `01-spec.md` names its board. Boards are added through the build; build a screen from its board when the
board exists, and from `01-spec.md` until then.

## The branch

- Every PR's base is `crew-day` (`gh pr create --base crew-day`). Sessions merge their own PRs into `crew-day`.
- Never merge into `master`, never push to `master`, never open a PR from `crew-day` to `master`, and never fold
  `master` into `crew-day`. Releasing is the founder's call.
- `.github/workflows/ci.yml` runs on every pull request whatever its base, with path filters, so PRs into
  `crew-day` get the full CI for the areas they touch. Pushes to `crew-day` run no CI and deploy nothing: check
  each PR's own CI before merging.
- Later, merging `crew-day` into `master` WILL release the backend and its migrations to production and the web to
  pantopus.com. Before that, this branch's migrations must be renumbered to sort after master's newest.

## Founder decisions, November 5, 2026

The founder answered "All recommended" to the coordinator's questions 3–9, approved the design plan ("Draw the
sample", "Draw the rest"), and then said: *"you do not need to ask me permission or questions for next steps, please
keep working until finish everything here, feel free to start sessions to implement them faster. And have all
sessions including yourself have the power to keep going and finishing everything without pausing to ask me for any
permissions such as drawing designs, start simulator or anything, just keep working do not pause."*

- [x] **Scope: the whole Crew Day, now.** A crew sets up a street day; households get their own price from a link
  and book; the crew works the route on its phone; Pantopus charges the card and pays the crew; problems go to the
  operator. **Out:** the Street Organizer's other plans (events, small asks, house-watch, civic), the weekly street
  digest, texts (`backend/services/smsService.js` is a placeholder; texting costs money and needs carrier
  registration), and printed postcards with per-home codes (the crew prints a flyer with a QR code instead).
- [x] **Payment:** the card is saved when the household books; nothing is charged until the crew marks the home done;
  Pantopus charges it 24 hours later unless the household taps "Something needs attention", and "Everything looks
  good" charges at once. Each charge is a business invoice underneath, so the fee (10% for founding businesses, 15%
  for home services, by `stripeService.getEffectiveFeeRate`), the 48-hour payout review, refunds and the
  received-invoices list work as they do today.
- [x] **Who uses which screens:** households on web (no app needed until booking, which needs a Pantopus account),
  iOS and Android; crews (a business page's owner or team seats) on web, iOS and Android, with the day's route on
  the phones; the organizer is a household with a share kit and a count, plus "Ask for a Crew Day on my street";
  the operator (the founder) on one web admin area, approving each street day before its invitation works.
- [x] **Launch-cut key `crew_day`,** off unless listed, on the server, web, iOS and Android, like `pulse_redesign`.
- [x] **Three new tables, approved:** `CrewDay`, `CrewDayBooking`, `CrewDayEvent` ([contract](02-contract.md#2-tables)).
  No other new tables. Changes to existing tables only if listed in the contract (additive).
- [x] **Four build sessions** (server, web, iOS, Android) sharing one local Crew Day database, plus a design session
  for the remaining boards, a waiting successor for each, and a waiting successor for the coordinator.
- [x] **Stripe test keys:** sessions may copy the Stripe *test-mode* values from the founder's gitignored
  `~/skinny-pantopus/backend/.env` into their own gitignored env files. Never print them, never commit them, and
  refuse live keys (`sk_live_…`, `pk_live_…`).
- [x] **No stopping:** no session asks the founder anything or waits for permission (designs, simulators, merges into
  `crew-day`, anything). Decide with this kit's defaults, record the decision in your status file, keep going.

**Coordinator defaults under that instruction** (the founder can change any; they are in `01-spec.md`):
cancellation is free until 48 hours before, and after that the household asks the crew, who can release the home at
no charge (no late-cancellation fee in this version); the crew sees an address early only for a home waiting on a
price check, and every home's address from 6 PM the evening before; the operator approves every street day; crews
need a published business page and payouts switched on.

**Still open with the founder** (build the default meanwhile): what the by-hand street days taught (question 1), and
sharing the private Crew Day Kit artifact `BfXLe9ThWTrFk92kR76Knz`, which no session can read (question 2). The
software follows the design document's rules until then.

## Sessions

| Name | Owns | Branch prefix |
|---|---|---|
| **CDSRV** server | `backend/**`, `supabase/migrations/**`, the shared Crew Day database, `02-contract.md` | `claude/cd-srv-` |
| **CDWEB** web | `frontend/apps/web/**`, `frontend/packages/**` | `claude/cd-web-` |
| **CDIOS** iOS | `frontend/apps/ios/**` | `claude/cd-ios-` |
| **CDAND** Android | `frontend/apps/android/**` | `claude/cd-and-` |
| **CDDESIGN** designs | the Design canvas only (no repository code) | none |
| **CDCOORD** coordinator | `docs/product/crew-day-build/**` (except `02-contract.md`), the final end-to-end pass, the founder's summary | `claude/cd-coord-` |

Each has a successor started at the same time (`CDSRV-2`, …, `CDCOORD-2`) that waits for its predecessor's hand-off
file and touches nothing until it appears. A session that needs a change in another session's area writes it in
`QUESTIONS.md` (below) and carries on; the owner picks it up.

## Rules for every session

1. **Opus 5.5 at max effort, no subagents.** Do every part yourself: no Agent tool (Explore, Plan, general-purpose,
   forks), no Workflow scripts, no other sessions, for reading, coding, reviewing, building, testing or verifying.
2. **Never pause for the founder.** Don't ask questions or wait for permission. Decide with this kit, record the
   decision in your status file, keep going. Only founder-only acts (money, consoles, hosted services, store
   submission, anything sent to real people, merging to `master`) go in `FOUNDER.md`; carry on with everything else.
3. **Don't message the coordinator.** Write status and questions to the notes folder (below); the coordinator reads
   it every time a session ends a turn. Messages from sessions stop the coordinator from starting successors.
4. **PRs:** base `crew-day`, small (one screen, route or service each), title starting "Crew Day:". Commits end with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with
   `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Merge your own PR (`gh pr merge --merge`) after
   its CI is green, the real-app check is done, and its branch contains the latest `origin/crew-day` (merge it in,
   re-check if it touched your area). `gh pr merge` in a worktree merges and then fails locally: delete the remote
   branch yourself. Keep at most two of your PRs in CI at once; macOS runners are shared.
5. **Verify in the real apps** (AGENTS.md "Verify in the real apps"): the web in a browser, iOS in a simulator,
   Android in an emulator, against a real local backend and the shared database. Check that changes survive a
   relaunch or reload, and check the other person's view (household, crew, organizer, operator). An API response or
   green CI alone is not a check. Write what you checked, and what you couldn't, in the PR.
6. **No new unit tests.** If an intended change breaks an existing test, update or delete it in the same PR. Run your
   platform's existing checks before every push: backend Jest for the files you touched and lint; web lint,
   typecheck and Jest; iOS SwiftLint, SwiftFormat and the CI script checks (the hex-colour grep included); Android
   ktlint, detekt and lint as CI runs them.
7. **The repository is public.** No credentials, env files, tokens, logs, database dumps or real people's data in
   Git, PRs, screenshots or chat. Synthetic accounts and the example data in `01-spec.md` only. Stripe test mode
   only (rule above); refuse live keys.
8. **Never touch the founder's live environment:** the backend on `:8000`, simulator `EB5AD759`, or any stack you
   didn't start. Stop only your own listeners (`lsof -ti tcp:PORT -sTCP:LISTEN`).
9. **Shared machine:** one shared Crew Day database (see `RIG.md`); start no other Supabase stack. Worktrees stay on
   `/Volumes/Studio-Extended`. Never run pgTAP or destructive SQL on the shared database.
10. **Simulators and emulators:** consent-free tools only (`xcrun simctl`, `idb`, `adb`). Create your own simulator or
    AVD. Don't use the simulator panel's `attach`/`detach` or computer use.
11. **Hand-off at about 85% context** with real work left (check with `get_usage` "self" at the end of each turn):
    commit and push everything, open PRs (draft if unverified), write `handoff/<NAME>.md` atomically (write a `.tmp`
    file, then `mv`) with the state, the rig, what is verified and the exact next steps, update your status file,
    and stop. Your successor is already running and waiting for that file. A successor whose own successor doesn't
    exist keeps going past 85% (the context condenses automatically) rather than stopping.
12. **Keep `status/<NAME>.md` current:** merged, in review, next, blockers, one dated line per change, Pacific times.
13. **The contract:** CDSRV owns `02-contract.md` and changes it in the PR that changes the API, with a line in
    `CHANGES.md`. App sessions read `CHANGES.md` before each slice and build to what is merged.
14. **Behind `crew_day`:** with the key off, every app and the web behave exactly as before, and the server answers
    every Crew Day route with 403 `CREW_DAY_UNAVAILABLE`. Don't change working screens' layouts, the tab bar or the
    side menu beyond the entry points in `01-spec.md`.
15. **Migrations are additive.** Never edit a migration once merged into `crew-day`; add another.

## The notes folder

Shared, outside the repository:
`/Users/yingpengwang/Library/Application Support/Claude/side-session-notes/local_a7fd3221-2d44-4cf6-a613-11c7438a9c85/crewday/`
(quote it: the path has spaces).

| File | Who writes | What |
|---|---|---|
| `RIG.md` | CDSRV | the shared database: ports, how to point a backend at it, seeded accounts (no secrets) |
| `CHANGES.md` | CDSRV | each contract change, newest first |
| `QUESTIONS.md` | anyone | a question or request for another owner; the owner answers in place |
| `FOUNDER.md` | anyone | founder-only steps, for the coordinator's summary |
| `status/<NAME>.md` | each session | its status (rule 12) |
| `handoff/<NAME>.md` | each session | its hand-off (rule 11) |
| `briefs/<NAME>.md` | the coordinator | each session's brief, for successors |

## Ports

Check a port is free before using it. Crew Day uses 23100–23199: CDSRV backend `23110`, the shared database's ports
in `RIG.md` (CDSRV picks them in 23120–23129), CDWEB backend `23130` and web `23131`, CDIOS backend `23140`, CDAND
backend `23150`, CDCOORD backend `23160` and web `23161`.

## Before release (for the founder, in the coordinator's final summary)

- Merging `crew-day` into `master` deploys the backend, the worker and the migrations to production, and the web to
  pantopus.com. With `crew_day` unlisted, nobody sees Crew Day; the three tables are created empty.
- Rename this branch's migrations so they sort after master's newest before that merge.
- Turning it on: list `crew_day` on the hosted backend first, then in web and app builds.
- Anything else the server needs in production (a storage bucket, schedules, email templates) is listed in
  `FOUNDER.md` and the final summary.
