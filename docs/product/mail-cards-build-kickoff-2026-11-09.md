# Mail and Christmas cards design build: kickoff

November 9, 2026. For the coordinator session. The founder approved the [design plan](mail-cards-design-plan-2026-11-09.md) and all eight of its decisions, and wants the building done by Opus 5.5 sessions.

## Your job

You coordinate. You write no app code. You start the build sessions, review their pull requests, keep them out of each other's way, and report to the founder.

## Start the sessions in your first turn

The app refuses to start sessions in a turn the founder did not begin, so start all of them now, in this first turn:

| Session | Owns | Label |
|---|---|---|
| iPhone and iPhone Duo | `frontend/apps/ios` | MCIOS |
| Android | `frontend/apps/android` | MCAND |
| Server and web, plus new art | `backend`, `frontend/apps/web`, art files | MCSRV |

- Each is a fresh Opus 5.5 session in its own worktree and branch off master. No subagents for build work.
- Also start one waiting successor per builder, which does nothing until `handoff-<LABEL>.md` appears in your notes folder. A builder hands off at about 85% of its context: it pushes its work, writes that file, and stops.
- Before starting anything, check that no other session or open pull request already does this work (`list_sessions`, `gh pr list`).
- Write each builder a brief: its label and area, the files to read (below), the waves, and the rules below. Keep a status board in your notes folder that builders append to (REVIEW, BLOCKED, NEEDS-FOUNDER, HANDOFF, DONE lines).

## Read first

1. [AGENTS.md](../../AGENTS.md)
2. [mail-cards-design-plan-2026-11-09.md](mail-cards-design-plan-2026-11-09.md): what to build, part by part, with file names and "done when".
3. [christmas-card-table/design.md](christmas-card-table/design.md) and its `sample/`: the approved look. The plan changes it only where it says so.
4. For wave 4 only: [christmas-card-memories-plan-2026-11-02.md](christmas-card-memories-plan-2026-11-02.md) and its contract.

If pull request #3827 (these two documents) is not merged yet, land it first.

## Waves

Finish and merge a wave on all three apps before starting the next. Tell the founder when each wave is on master.

| Wave | Parts of the plan | Needs |
|---|---|---|
| 1 | Part 1 quick fixes, Part 3 send one back, Part 2 sealing by hand | Apps and web only. This is the wave to get into the next store builds. |
| 2 | Part 5 card rack, Part 6 enlarge / verse / Duo upright, Part 4 opened cards show their picture | Server and web add `verse` to nine designs first. |
| 3 | Part 7 moods, Part 8 ticks / finger signature / sounds, Part 10 letters, Part 9 send flow at the table | New art: star stamp, cream envelope set, three sounds. Show the founder one sample of each kind of new art before making the rest. The signature needs a small, additive server field in the card's existing data. |
| 4 | The photo, then the voice greeting | The November 2 plan. Ask the founder before starting: it has storage and moderation steps only the founder can switch on. |
| Any | Part 11 sharing and the invitation (added November 10) | Apps and web only. Small; fit it in beside the wave that is running, after that wave's open pull requests on the same files. 11.8 (D9) is not built until the founder answers. |

## Rules for every builder

- The plan is approved. Don't ask again before each part; build it as written. Ask only when the plan is unclear or wrong, when you would need a database change, or for anything that touches money, production or real people.
- Everything rides the existing `card_table` key. No new key, no new table. Any server change is additive and old app versions must keep working.
- No unit tests. If an intended change breaks an existing test, update or remove it in the same pull request.
- Verify in the real app against a local backend, with a relaunch or reload and from the other person's side. iPhone: a simulator, plus the Duo closed, sideways, book, upright and tabletop. Android: an emulator. Web: phone and desktop sizes. Check the largest text size, screen reader labels and Reduce Motion. Say what you could not verify (real phones, tilt, taps you feel, real sound).
- One shared rig, not three. The server and web session restarts the stopped one (launch kit `streams/CARDLOOK`, on the stack in `streams/CTBSRV/README.md`) and runs the backend and web; app sessions use it with their own test people.
- The Mac is shared with other sessions. Boot only the device you are testing with, shut it down after, and use the kit's build scripts so builds take turns.
- Small pull requests, one part at a time. Merge your own after green checks, the real-app check and the coordinator's review, through the shared merge queue (HOLD and RELEASE lines in `launch-streams/status/REQUESTS.md`).
- Stay in your area. Ask the owning session, through the coordinator, for anything outside it.
- Keep credentials, keys and real people's data out of Git, pull requests and screenshots.
- File names in the plan were read on master `1ee7c174ab`. Confirm each before editing.

## Only the founder

Store builds and submissions, production settings, hosted databases, spending money, and anything sent to real people. When wave 1 is on master, tell the founder it is ready for the next store builds.

## Done

Every part in a wave is merged, master's checks are green, a three-app check of the wave is written up, [NEXT_STEPS.md](../../NEXT_STEPS.md) has a short "Mail and card design" section, and the rig, devices and worktrees you started are stopped or removed.
