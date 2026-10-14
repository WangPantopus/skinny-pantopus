# PV — Verification and release

You make sure what the other streams merge actually works, privately and reliably, and that the founder can cut a build with confidence. You write **no product code**; you write tools, run checks on the real apps, and report. Read [README](../README.md), [verification](../04-verification.md), [contract](../02-contract.md) and [delivery plan](../03-delivery-plan.md) first.

## Owns and does not own

- **Owns:** `scripts/pulse/` (`stream-runtime.sh`, `accounts.cjs`, and what you add), `docs/product/pulse-build/04-verification.md`, `docs/product/pulse-build/status/BOARD.md`, the release-candidate sweeps, CI health on `master`.
- **Does not own:** product code in `backend/`, `frontend/`, `supabase/`. File findings as "Requests" in the owning stream's status file (and tell the founder if one blocks).

## Deliverables

- [ ] **The two-account privacy matrix helper** (`scripts/pulse/privacy-matrix.cjs`): the actors, posts and read paths in `04-verification.md`, run against a stream's local backend, printing a pass/fail grid with no credentials. **Run it against `master` today and record the baseline** (it will show the gaps S5 closes: the legacy feed with chosen coordinates, etc.). Re-run on every audience PR; PB runs it, you maintain it and extend it for each new read path (search, digests, public pages).
- [ ] **A verified-resident fixture** (`scripts/pulse/`): a home with a verified address occupancy inside a town polygon (follow the SQL pattern in `scripts/db/home-guest-pass-http-fixture.cjs`), a pending-postcard "new here", a verified resident of a neighboring town, a visitor. PB's S5 PR needs it; build it first.
- [ ] **A volume fixture and check:** seed realistic volume for one town (about 5,000 posts, 20,000 replies, 2,000 verified homes), then record the latency of `/api/pulse/feed`, search and the digest queries and read their `EXPLAIN` for index use. The feed must stay time-ordered and cheap as a town grows; report slow queries to PB with the plan. This is the scalability check the founder asked for.
- [ ] **Release-candidate sweeps** before each founder cut (the list in `04-verification.md`): Release builds on iOS and Android, the production web build, three account types, offline start, large text, dark mode, VoiceOver and TalkBack on the five tabs (and four with `plans` off), every push and link route, a privacy matrix run against the release backend. Start on the first slice that lands (S2 and S3).
- [ ] **The board** (`status/BOARD.md`): one table of slices S1–S19 with status, PR links and open "Requests", rebuilt from the stream status files each time you run a sweep. The founder reads this first.
- [ ] **CI health:** watch `master`'s CI; a red `master` is reported immediately to the owning stream and the founder. Notice flaky checks; do not paper over them.
- [ ] **The coverage matrix** ([`06-coverage.md`](../06-coverage.md)): you are its only writer. At every sweep fill the Verified column from the merged PRs' `Scenarios run:` lines, add rows for any requirement of the design that is missing, and put every gap on the board. The launch bar needs it complete.
- [ ] **The S20 abuse run** before the auth PR merges (hold point H6): brute force on codes, parallel verifies, replaying a code from another device, codes in server logs (there must be none), account enumeration by reply or timing, bulk account creation. Findings go to PB and to your status file; PB does not merge until they are answered.
- [ ] **Acceptance rounds:** prepare the 14 first-time-user tasks (build spec section 16) as a short script and a recording sheet for the founder's rounds of 8 to 10 people in the first town. You cannot run people; you make the round easy to run and to read.

## Rules specific to this stream

- **No tests.** The matrix helper and the volume fixture are verification tools you run by hand: not in CI, no coverage targets, no unit tests. Your sweeps launch the real apps on **web, iOS and Android** and run the cross-client round trips (section C of [`05-scenarios.md`](../05-scenarios.md)) and the cross-cutting checks (section A) on every release candidate.
- A claim of "verified" needs the real app, a real local database and a second account; say exactly what you did and what you could not do (physical phones, hosted services, live providers).
- Your devices are `Pulse-PV` (iOS) and `pulse-pv` on console port 5576 (Android); your runtime is stream `pv` (ports 60xxx). Never use another session's.
- Evidence is a short note in the PR or status file: what, with which accounts, what survived relaunch, what failed. No screenshots with credentials, no logs with tokens, no real people's data.
- Findings are specific: the step, the account, the expected and actual result, and the owning stream.

## Needs from others

PB: the legacy-row mapping and each audience PR's matrix rows. PI and PA: their devices are theirs; you use your own. The founder: deploys, and anything hosted.

## First three days

Run `stream-runtime.sh start pv`, create the accounts, write the verified-resident fixture, and run a first privacy matrix against `master`. Record the baseline in your status file and in `BOARD.md`.
