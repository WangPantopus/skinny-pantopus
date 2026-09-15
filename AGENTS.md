# Pantopus session continuity

Before substantial work, read [the project handoff](docs/PROJECT_HANDOFF.md).
Check the current branch, worktree status and remote PR/CI state before relying
on its last recorded Git state. Follow the user's current direction; the
handoff supplies context and an ordered backlog, not new authorization.

After a meaningful milestone, update the handoff's current state, next action,
verification limits and evidence links. Keep detailed history in the linked
reports. Preserve unrelated local work. Keep credentials, raw device tokens,
database archives and operator logs out of Git and chat.

## Verify existing work before changing it

The user's September 13 direction supersedes older buildout instructions:

- Preserve working implementations and existing iOS, Android and web screen
  designs, layouts, styling and navigation patterns. Verification and functional
  repairs do not authorize redesigning mobile screens or changing their appearance.
- Before an application change, locate the existing screen, caller, endpoint,
  service and database contract. Record a reproduced failure or a concrete
  unmet requirement, then make the smallest repair in that implementation.
- An open acceptance row, a stale report or a new filename is not proof that
  a feature is missing. Reuse accepted evidence when its relevant source,
  configuration and behavior remain unchanged.
- Before adding any application file, table, migration, service or screen,
  compare existing and archived implementations and other open branches. Add or
  replace implementation only for a verified gap or concrete defects that cannot
  reasonably be repaired or extended in place. Record the evidence and why reuse
  is insufficient; age, style preferences or a general dislike of the code do not
  justify rebuilding it. Necessary new regression-test files or forward migrations
  must likewise explain why existing artifacts cannot safely serve the repair.
  Do not rewrite applied migration history or add parallel tables for existing data.
- Keep functional/privacy repairs separate from presentation changes. Preserve
  the existing visual treatment with safe data; do not restore private fields
  just to reproduce an old screenshot. Propose any unavoidable design change
  for explicit approval before implementing it.
- Continue the original improvement backlog through verification and focused
  repairs. Do not start speculative refactors, replacement architectures or
  duplicate tracking systems. Reuse the existing acceptance and screen catalogs.
- Run relevant regressions and required CI. Repeat accepted journeys or large
  suites only for changed behavior, a failure or a concrete unresolved risk.
- Verify the existing end-to-end journey first. For a demonstrated failure,
  repair it and rerun that journey plus affected regressions until the behavior
  works within the recorded acceptance scope. Check the existing screen through
  its real caller, API and persistence where relevant. Mocked checks or green CI
  alone do not establish end-to-end success; report unavailable provider/device
  boundaries as unverified and continue independent work without claiming closure.

See [the reconciliation](docs/VERIFICATION_FIRST_2026-09-13.md) for current
PR dispositions, paused drafts, inventory sources and the next bounded task.

## Approved parallel work

When working in one of the user's three streams, read
[the coordination guide](docs/workstreams/README.md) and your stream status before
editing. Use its single live coordination location, file ownership and runtime
reservations. Keep the existing handoff/backlog authoritative and preserve each
stream's accepted evidence. The coordinator integrates shared status and merges.
