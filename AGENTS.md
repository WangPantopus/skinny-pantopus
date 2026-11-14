# Pantopus agent guide

Start with [NEXT_STEPS.md](NEXT_STEPS.md), the founder's checklist, and the
[mobile pilot build brief](docs/mobile-pilot-build-brief-2026-10-03.md), which
says what to build. [The project handoff](docs/PROJECT_HANDOFF.md) and older
dated reports are background, not the current backlog. Check the current
branch, worktree status and remote PR/CI state before relying on any recorded
Git state. Follow the founder's current direction; documents supply context,
not new authorization.

The repository is public. Keep credentials, keys, env files, raw device tokens,
database archives, operator logs and real people's personal data out of Git,
PRs, screenshots and chat. Preserve unrelated local work.

## Change what exists

- Reuse before rebuilding. Before adding a file, screen, service, table or
  migration, find the existing screen, caller, route, service and table, and
  check other open branches. Make the smallest sound repair in place. An open
  checklist row, a stale report or a new filename is not proof that something
  is missing.
- Keep working screens' layouts, styling and navigation. Improve the experience
  inside the existing design language; don't redesign a working screen
  wholesale or change the tabs without the founder's approval. The founder
  approved the five-tab bar (Place · Today · Pulse · Plans · Messages) on
  October 13 for the Pulse build, then paused that build on October 15: the
  redesign, five tabs included, is behind the launch-cut key `pulse_redesign`,
  and the apps keep the October 13 bar (Place · Today · Nearby · Messages) and
  the October 13 Pulse; see
  [docs/product/pulse-build](docs/product/pulse-build/README.md). On October 17
  the founder approved adding Plans to that bar while the `plans` flag is on
  (Place · Today · Nearby · Plans · Messages), with Nearby no longer opening on
  the Plans map. On October 20 the founder removed the Nearby door page and
  moved Connections to the side menu. On November 7 the founder renamed the
  Nearby tab Pulse (Place · Today · Pulse · Plans · Messages, with Mail before
  Messages while the Mailbox is on) and removed its Pulse | Neighborhood
  switch: the tab is the October 13 feed under a big List | Map switch beside
  the side menu, and the density map, the meter and "Invite your neighbors"
  are "Verified homes nearby", opened from Place's Verified neighbors rows.
  On November 13 the founder moved Mail to third while the Mailbox is on:
  Place · Today · Mail · Pulse · Moments · Plans on iOS and Android (Moments
  and Plans while their switches are on) and Place · Today · Mail · Pulse on
  phone-width web; the desktop web sidebar keeps its order, and the apps still
  open on Place.
  The founder doesn't want "Neighborhood" as a name in the app. The side menu
  (☰) is on the top screen of every tab on iOS and Android; web keeps its
  sidebar and menu. New tabs and redesigned tab screens keep the menu button,
  and nothing brings the door page back. Rebase onto `dev` before changing
  those screens.
- Keep privacy and functional repairs separate from presentation changes. Never
  restore private fields to reproduce an old screenshot.
- Migrations are additive and backward compatible. Never edit an applied
  migration or rewrite migration history, and don't add parallel tables for
  existing data. New tables need the founder's approval.
- Launch-cut features stay off behind their flags
  ([launch-scope flags](docs/launch-scope-flags-2026-10-01.md)).

## Verify in the real apps

- Verify a change by using the apps it touches: the web app in a browser, the
  iOS app in a simulator and the Android app in an emulator, against a real
  local backend and database. Check that changes persist after a relaunch or
  reload, and check the other person's view where there is one.
- An API response, a mock or green CI alone doesn't show that a flow works.
  Name what you couldn't verify (hosted services, physical phones, live
  payments) instead of claiming it.
- Don't write new unit tests or chase coverage. If an intended behavior change
  breaks an existing test, update or remove that test in the same PR.
- Run the relevant existing checks before pushing, and keep CI on `dev` and
  master green.

## Staging first

Since November 12, 2026, all new code merges to `dev` (staging) first; master
is production and stays GitHub's default branch. Branch from `origin/dev` and
open every PR with `--base dev` (`gh pr create` would otherwise pick master).
A merge to `dev` releases the backend to staging-api after CI passes. Only the
founder promotes staging to production, after checking staging, with one
`dev` → `master` PR merged as a merge commit (not squash) so the branches keep
one history. Never merge or push to master yourself. If the founder approves a
fix straight to master, merge master back into `dev` right after.

## Parallel sessions

Several agent sessions may work at once. The September workstream system (the
coordination branch, hub, leases, merge queue, sealed evidence bundles and
acceptance-tier bookkeeping) is retired; its records under `docs/workstreams/`
are history. Parallel sessions follow the launch-stream rules the founder gives
them: each works in its own worktree and branch, owns a named area, keeps PRs
small, merges its own PRs after green CI and a real-app check, and asks the
owning session for changes in another area instead of editing it.

Only the founder spends money, enters credentials in consoles, writes secrets
into hosted services, changes hosted databases or production configuration,
sends anything to real people, or submits to the app stores.
