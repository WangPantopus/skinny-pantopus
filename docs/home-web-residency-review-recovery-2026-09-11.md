# Browser residency review and recovery — September 11, 2026

The browser residency slice now uses the prepared backend review and durable
original receipts from `e0ea36284`. Both the owners claims page and household
members panel lead to the same explicit review form. This is browser acceptance,
not completed native residency, claim submission/cold-start, Home or release scope.

## Behavior

The form displays the current applicant reference/public identity when available,
claim status, requested role/address and current membership role, age, verification
and access windows. Public profile identity is descriptive; it never grants Home
authority. A missing public profile leaves the exact account reference available.
Approval offers the supported resident roles; rejection accepts an optional
reason. Changing action, role or reason resets explicit review confirmation.
Cancel leaves without a mutation or saved original. Existing verified membership,
ownership and expired/removed access are explained distinctly.

Before POST, an original containing origin/account/Home/exact claim/action/role or
reason/request UUID/review token is saved in IndexedDB using AES-GCM and a
non-extractable key. The key and draft are scoped separately from other recovery
features. Atomic revision comparisons prevent another tab replacing an original.
Missing/corrupt/unwritable storage fails closed without deleting a saved command.
No bearer token is part of the saved original or its key.

The opening account/token/session marker/API origin and lifecycle are checked
before exposing state and after asynchronous work. Each submission, retry and
acknowledgement rechecks ordinary current Home authority. Background/account
changes retire visible claim, membership, note and receipt state. Resume reloads
current review and the protected original; it never automatically resubmits.
Original confirmation stays separate from current membership and claim status.
Acknowledgement of another saved claim opens the claim requested by the current
URL; an acknowledgement from the recovery inbox returns to its empty state.

Definite stale/status/role-ceiling rejections permit an explicit new review after
current authority and original revision are checked. Uncertain failures and a
changed original identity remain recoverable. The household panel no longer uses
the prompt that rejected even when Cancel returned null. Both lists have permanent
recovery links, explicit loading/unavailable/empty states, and discard stale rows
on lifecycle/account/access refresh. The members entry returns to household
members; the owners entry returns to the residency tab.

## Actual Chrome → production HTTP/service → SQL

Final `scripts/web/test-home-residency-review.cjs` run **r4 passes**, with
**8 POSTs / 4 receipts / no page errors**, and exact SQL fixture cleanup.
Identity, public profiles, list/dashboard response shapes and unrelated shell
responses are synthetic. Reviewed GET/POST routes, validation, services and SQL
are actual local production code. Lifecycle events are deterministic browser
visibility/focus/session events, not an operating-system process suspension claim.
No real signup, paid provider, mail, notification delivery or production account
switch is claimed.

The continuous final sequence covers:

- Owners entry, Cancel with no POST/original, disabled unreviewed submission,
  role-change confirmation reset and first-use encryption-key failure.
- A lost committed approval reply, encrypted retained original, later move-out,
  recovery through the permanent list link, identical replay, inactive current
  membership, reload of confirmed state and explicit inbox acknowledgement.
- Household members entry, stale snapshot conflict and deliberate fresh review;
  competing tabs retaining one original; lost rejection reply, a resubmitted
  claim and original rejection/current pending separation without re-rejection.
- Current reviewer revocation/restoration, account marker/identity changes,
  private state retirement, ciphertext corruption and exact restoration, and
  recovery of an old claim before opening the requested next claim.
- Draft-write failure blocking POST; held real preflight across background and
  account changes retaining the original without POST; keyboard recovery.
- An actual child-role ceiling denial, explicit review reset and permitted guest
  approval; both empty-list recovery links; both denied-list error states,
  no false empty queue and restored current access.

The later terminal change used to empty the resubmitted claim queue is an explicit
fixture-controlled SQL transition and creates no receipt; it is not a second UI
residency acceptance claim. The backend report independently verifies the actual
fresh-decision path after resubmission.

Eight distinct screen states were visually reviewed across the runs: prepared
approval; historical approval/current move-out; historical rejection/current
resubmission; narrow retained confirmation; keyboard recovery; child/guest
confirmation; household denial; owners denial. The final run stores all eight
captures at desktop 1100×950 and narrow 390×844 sizes. The final recovery screen
has no horizontal document overflow. This is not complete dark mode, zoom,
screen-reader, physical-device or browser-engine acceptance.

## Gates and evidence

Final web types and focused lint pass; the owners page retains 11 pre-existing
`any` warnings, with no new lint error or warning. All **92 suites / 1,178**
existing web checks pass. No coverage percentage is a completion target.

The first three browser runs exposed driver synchronization limits: r1 checked
URL immediately after asynchronous navigation; r2 inspected stored state before
acknowledgement completed; r3 revoked authority before the household page's first
load completed, causing permission-gated controls to disappear rather than the
intended already-loaded-list refresh scenario. The driver now waits for the
actual URL, completed acknowledgement/form and loaded list. These initial runs
are not represented as passes. Final r4 passes the entire sequence.

Private operator evidence stays outside Git: `/private/tmp/pantopus-web-residency-journey-r4/`
contains screenshots, `result.json` and console diagnostics; its sibling `.log`
records the driver result. Type, lint and web-suite evidence uses the private
`pantopus-web-residency-types-final.log`, `pantopus-web-residency-lint-r2.log` and
`pantopus-web-residency-full-r1.log`. Credentials and evidence contents are not
committed.

## New wider finding and next work

September 11 follow-up: the surrounding dashboard finding below is resolved by
[dashboard current-access retirement](home-web-dashboard-access-retirement-2026-09-11.md),
which records current IAM/SQL/browser acceptance and the full residency rerun.
The original observation is retained here as historical evidence.

The narrow household denial capture shows that the surrounding dashboard can
retain its earlier Owner label, Invite and security controls after the residency
panel has independently denied current access. Source review confirms
`useHomeData` and `HomePermissionsProvider` do not yet retire/reload their own
state on focus/account changes. The new residency panel correctly removes its
private rows and reports unavailable access; this is not whole-dashboard
revocation acceptance. Fix dashboard current-access/lifecycle state next and
verify stale loads, current denial, restoration and visible controls before
continuing native residency parity.

Then finish installed iOS and Android prepared reviews/protected originals,
transactional claim submission/cold-start/resubmission, ownership transfer/challenge,
lease/resource cleanup and the complete handoff backlog. Residency passes and
letters remain a distinct feature in that inventory.

Backend `e0ea36284` passes remote backend/web/database/Swift-quality checks; native
build/device jobs were still running before this browser commit. Verify the new
exact head. PRs #32/#34 stay drafts; paid #34 `e9ef2decb` remains green but unfinished.
The combined 44 migration versions are collision-free but final reconciliation,
combined replay and production upgrade/release acceptance remain open. PRs #7
and #24 are merged. Keep paid services one final launch-preparation bundle.
Exact browser fixtures are cleaned; owned web/Gig database runtimes remain for
immediate dashboard work. Owner source, emulator and persistent data stay intact.
