# Three-stream coordination

Updated September 15, 2026. The user authorized three concurrent streams. This
folder coordinates their next bounded milestones; it does not replace the existing
backlog, acceptance evidence, or verification-first instructions.

## Where to start

| Document | Purpose | Writer |
| --- | --- | --- |
| [AGENTS.md](../../AGENTS.md) | Rules for preserving existing work and designs | Coordinator, when an agreed rule needs recording |
| [Project handoff](../PROJECT_HANDOFF.md) | Current integrated state and next decisions | Coordinator |
| [Remaining work](../REMAINING_WORK_2026-09-11.md) | Authoritative requirements and acceptance rows | Coordinator, using stream evidence |
| This guide | Ownership, dependencies, integration and shared resources | Coordinator |
| [1. Gigs/payments](01-gigs-payments.md) | Current gig/payment milestone and handoff | Stream 1 |
| [2. Home/household](02-home-household.md) | Current Home milestone and handoff | Stream 2 |
| [3. Accounts/social](03-accounts-social.md) | Current account/social/notification milestone and handoff | Stream 3 |
| [Verification report](../VERIFICATION_FIRST_2026-09-13.md) and linked reports | Source-bound results, failures and limitations | Coordinator integrates stream report contributions |

The coordinator is also Stream 1; there is no fourth implementation stream.
Each stream owns the affected backend, database contract and clients for its
milestone. Platform boundaries do not split ownership of one user journey.

Backlog ownership: Stream 1 handles P (gigs/payments); Stream 2 handles H/R/I/D/F/M
(Home, residency, intelligence, records, bills, mail/guests); Stream 3 handles N/A
(social, notifications, accounts/providers). A03 shared storage changes require
explicit ownership, and A05 routes each feature-specific finding to its domain
owner. U (UI/accessibility/lifetime) checks accompany each affected journey; G/O/L
(integration, operations and launch) stay coordinated centrally with stream input.
These categories assign responsibility, not permission to reopen accepted work.

## Shared publication, live location and Git branches

Shared instructions and coordination snapshots belong on `master`, published
through documentation-only PRs from `codex/workstream-coordination`. They do not
depend on approval or integration of the gigs application branch. Each application
stream receives those instructions by integrating current master into its branch.

The live coordination folder on this Mac is:
`/Users/yingpengwang/pantopus-coordination/docs/workstreams/`.
All three agents read that exact directory, even while editing application code
in another worktree. A copy in a different branch is a committed snapshot, not a
live message channel. This is a neutral documentation worktree of the same
repository, on `codex/workstream-coordination`; it is not a fourth application
stream. The owner's main checkout remains separate. The previous live folder in
the gigs worktree is retired after this transfer; do not update status there.

| Stream | Application worktree | Branch / starting state |
| --- | --- | --- |
| 1 | `/private/tmp/pantopus-paid-gig-integration` | `codex/paid-gig-integration`; current source/CI in Stream1 status |
| 2 | `/private/tmp/pantopus-workstream-home` | `codex/workstream-home`; candidate `70e079543` over master `711340225` |
| 3 | `/private/tmp/pantopus-workstream-accounts-social` | `codex/workstream-accounts-social`; candidate `fc99f8ee7` over master `711340225` |

Streams 2 and 3 compare relevant pending Stream 1 changes before editing shared
code. They start from master because their first scoped implementations are
unchanged in the paid candidate. This permits small independent PRs to master.
The coordinator then integrates merged master into the paid candidate and checks
the combined behavior. Do not merge the entire unfinished paid branch into a new
stream just to obtain its status documents.

Each agent writes only its own status file in the live folder. It commits code
only from its own application worktree. The coordinator commits/pushes shared
status snapshots from the neutral documentation worktree after the author finishes
an update and publishes them through a separate PR to master; no blanket `git add .`.
Before publishing, verify the diff contains only the intended instructions and
status changes. Do not copy a feature branch's complete handoff or backlog over
master: link branch-specific evidence and carry over only the relevant updates.
Remote workers must send their source-bound handoff to the coordinator instead
of treating a stale local copy as the live folder.

## Working agreement

The user's clarified priority is accuracy and efficient reuse. All three streams
must preserve mobile (iOS/Android) and web screen designs, layouts and appearance.
Verify existing journeys before application edits; repair demonstrated failures
and repeat the affected end-to-end checks until they pass within an explicit scope.
Use the new-file/database comparison rule in [AGENTS.md](../../AGENTS.md): missing
evidence or disliked code is not permission to rebuild. Document why existing work
cannot meet the requirement before adding or replacing implementation. Preserve
accepted evidence and clearly label any unverified runtime/provider boundaries.

1. Select one bounded milestone from an existing inventory row. Locate its screen,
   caller, endpoint, service and database contract. Read relevant accepted evidence
   and compare source/configuration before choosing verification to repeat.
2. Record the milestone, exact candidate files, reused evidence, unknowns, next
   verification and completion criterion in the stream file. Source suspicion is
   not a reproduced bug; an open row is not a missing implementation.
3. Before changing a shared file or acquiring a shared runtime, send the coordinator
   a request identifying the purpose and affected streams. The coordinator records
   one owner here and acknowledges it before work starts. An empty row is not a
   lock that multiple workers may independently claim.
4. Reproduce the failure or document a concrete unmet requirement. Repair the
   existing implementation, preserve layouts and reuse existing services/schema.
   New tables, migrations, services or screens require the comparison in AGENTS.md.
5. Verify affected behavior and meaningful regressions. Actual UI/HTTP/persistence
   evidence is required where the milestone calls for it. Label synthetic auth,
   provider responses and transport; do not equate saved state with delivery.
6. Commit/push a reviewable milestone and hand off its SHA, changed paths, baseline,
   final evidence, limits, cleanup and remaining decisions. The coordinator reviews,
   reconciles shared changes/migrations and runs required CI before merging.

Update status when starting, changing scope/ownership, reproducing a defect,
finishing verification, becoming blocked, or handing off. Do not append a diary of
every command. Keep the current snapshot short; link detailed evidence/history.
Notify an affected peer through the coordinator when a finding changes its contract
or priority. Merely writing a note in another branch does not notify anyone.

Use states: discovery, verification, repair, ready for review, CI, merged, blocked.
Record the blocker and independent work that can continue. Local acceptance of a
small milestone does not close a broad inventory row or establish launch readiness.
No fixed completion percentage follows from row counts or numbers of tests.

## Shared ownership and requests

The current stream status files name candidate ownership for their first milestones.
These cross-cutting files/contracts require coordinator assignment for each edit:

- Authentication/session helpers; notification services, workers and sockets;
  generic File/upload/storage; shared navigation and SDK exports; CI/build manifests.
- `backend/routes/gigs.js` and payment services are initially Stream 1's scope.
  Home-related callers must coordinate before changing them.
- Migration versions, replay/adoption, shared permission/RPC contracts and release
  configuration are coordinated centrally. Never rewrite applied migration history.

| Request / decision | Owner | Status / next action |
| --- | --- | --- |
| `backend/jest.config.js` chat-access regression inclusion | Stream 3 | Granted only for the existing excluded chat-access suite; run regressions, no broad CI rewrite |
| `backend/routes/chats.js` block-path repairs | Stream 3 | Sole writer; reproduce fail-open/multi-party cases and repair existing contracts |
| SDK guest-pass status type / block exports | Streams 2 / 3 respectively | Additive candidates reviewed for conflict; no Stream1 overlap; broader SDK/auth changes still require assignment |
| `backend/services/blockService.js` error/cache repair | Stream 3 | Sole writer granted after baseline reproduction; verify all callers before changing the error contract |
| `backend/socket/chatSocketio.js` direct-chat admission/send checks | Stream 3 | Overlap reviewed: paid branch only adds `emitPrivateGigUpdate` plus its export; preserve that helper, `connectedUsers`, revocation and gig tracking behavior |
| Cancellation/no-show fee payer and recipient | Product decision, recorded by Stream 1 | Still unspecified; independent Start Work verification can proceed |
| User's Place redesign, PR #46 | User's separate scope | Preserved outside these verification milestones |

## Runtime reservations

One heavy native build runs on this Mac at a time. Remote CI uses its own runners.
Acquire a reservation before a build, simulator install, shared cache write,
database fixture/migration or server bind. Record process/lease and evidence paths
privately; never put credentials, raw device tokens or operator logs in Git/chat.
Check actual processes and the existing private leases before reuse. A stale note
or elapsed time is not proof a resource is free.

| Resource | Current reservation | Rule |
| --- | --- | --- |
| Local heavy native build | Stream3 owns the next slot; announce exact runtime before starting | Stream1 released its slot; one heavy native build at a time |
| iOS/Android test devices | No new reservation | Preserve accepted device state; inspect existing leases |
| Databases / fixture ports | Stream3: PostgreSQL64522 / API64521, exact social fixtures only; HTTP18130/web18131 | No schema/reset/container mutation; inspect source compatibility and leases, preserve all other fixtures; 18089 is not granted |
| Existing SQL port 64522 and REST port 18089 | Retained prior rehearsal resources | Never assume available or change their schema from another stream |
| Physical iPhone | Owner's installed build 3 | No test install or device mutation without a concrete authorized task |

Dependencies and accepted products are reused after checking their contracts.
Do not run three package installations or cache cleans. Low disk space is a reason
to sequence builds and request precise cleanup, not erase another stream's evidence.
Streams release resources on handoff after verifying processes and exact cleanup.

## Integration and completion

Only the coordinator updates shared handoff/backlog disposition or merges these
streams' PRs. A handoff includes source SHA/base, current PR/CI, reused and new
evidence, remaining limits, shared impacts and runtime cleanup. Run current-head
required checks; additional end-to-end repeats need a changed contract or identified
integration risk. Batch documentation-only publication to avoid canceling useful CI.

At setup, PR #34 is still draft at `c9cb69825` with
[CI34998717315](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34998717315)
passing 15 applicable jobs/one Seeder skip. Integration `3e93cd167` only adds the
verified iPhone-install documentation. Green CI does not finish the paid scope.
PR #46 (`place-design`) is a separate open user PR. Refresh live state before action.
PR #47 (`codex/paid-gig-integration`) also contains unfinished gigs application
changes. Neither paid PR is the vehicle for publishing the shared instructions.

This setup creates no recurring background automation. Status files distinguish
completed discovery from running verification; agent work is dispatched in bounded
milestones. The first milestones are assigned in the three linked status files.
