# Browser dashboard current access — September 11, 2026

This resolves the surrounding stale Owner/Invite/security state found during
[browser residency acceptance](home-web-residency-review-recovery-2026-09-11.md).
It is a dashboard/current-verification milestone, not completion of Home, native
residency, production identity or release acceptance.

## Behavior

The dashboard data loader and navigation permission provider retire their current
read on account/token/session-marker, focus, visibility and Home changes. Loading
and denial clear private entities, permissions and task-session state. Responses
from retired reads cannot restore data. Optimistic entity updates capture their
opening read; a retired callback cannot alter the new dashboard.

A current IAM read is required before fetching private dashboard data. A second
read after aggregate or individual fallback loading must agree with the original
membership and effective permissions. The separately loaded navigation authority
must also agree. Effective roles and permission intersections govern the result;
owner pointers cannot restore denied actions. The header no longer duplicates
its Owner badge, and the members audit control uses its effective permission.

Private dashboard content, open edit/invite panels and deferred intelligence
state unmount while current access is unavailable. Successful reauthorization
mounts a fresh dashboard; an old panel or timeline cannot reappear. The access
error offers keyboard-operable reload of both authority/data layers and a return
to the app. An isolated residency-list failure stays an explicit panel error with
its own retry; it is not displayed as an empty queue.

The IAM response now uses `Cache-Control: private, no-store`. Its denied response
includes a strictly current `verification_required` decision from the existing
membership helper and ownership/residency context. Only a current pending member
can enter verification through this response; revoked and future-start pending
members remain denied. This grants no Home permission and loads no private
dashboard. A pending resident sees household-review wording, with no invented
review deadline and no ownership-proof/mailed-code actions. Check for updates
refreshes both authority and dashboard data after later approval. Ownership,
landlord, mailed-code and help/message/move-out actions retain separate workflow
acceptance requirements; this report does not claim those actions were exercised.

## Actual workflow evidence

Final `scripts/web/test-home-dashboard-access.cjs` **r5 passes continuously**:
actual Chrome, production IAM HTTP route and membership helper, real PostgreSQL
records/permission function, no mutations and no page errors. Identity transport,
private dashboard/member/timeline entities and unrelated shell endpoints are
synthetic. Ancillary endpoints are deliberately unavailable in this fixture.
Visibility/focus/session-marker events are deterministic; physical operating
system suspension, real login/provider account switching, cross-engine and all
Home-route navigation are not claimed.

The sequence verifies:

- Loaded owner/member controls and an open invitation disappear on revocation;
  explicit restoration reloads current data with the old invitation closed.
- Held successful aggregate and IAM responses cannot undo later revocation or an
  account-marker change. A permission change during aggregate loading requires
  fresh review, and the explicit `members.manage` deny removes Invite.
- Background retirement, current authority outage, current restoration, isolated
  claim-list outage/error recovery and working individual endpoint fallback.
- A held individual task response cannot revive a denied dashboard.
- Pending residency uses verification without a private dashboard request;
  revoked and future-start pending occupancy cannot enter verification. After
  actual fixture approval, Check for updates opens the limited member dashboard
  without Owner or Invite controls.
- Overview navigation, a held old timeline and current timeline refresh retain
  the current result. Narrow denial/restoration and keyboard reload work.

Nine distinct screen states were visually reviewed across r3/r5. Final r5 stores
all nine captures at desktop 1100×950 and narrow 390×844. Narrow denial has no
horizontal document overflow; the header tabs intentionally scroll within their
container. Dark mode, zoom, screen readers and physical browsers remain distinct.

The full residency decision journey was rerun after these changes with the same
production review HTTP/service/SQL path. Its household-denial assertion now
expects the whole dashboard to retire, while owners-list denial remains explicit.
**Final residency rerun r1 passes 8 POSTs / 4 receipts / no page errors**, with
exact fixture cleanup. No earlier run is silently promoted to a pass.

## Gates, limits and continuation

Web types and focused lint pass, with 129 existing `any` warnings and no lint
errors. All 92 web suites / 1,178 cases pass. The initial full backend run failed
three handler-adapter cases because their response doubles lacked the new
`setHeader` method. The doubles were corrected; production cache behavior remains
intact. **Final complete backend r2 passes 317 suites / 5,169 cases**, with one existing
skipped suite / 16 skipped cases. All privacy gates pass. Node 22.23.2 matches the
CI major line. These checks are regression gates, not a coverage completion claim.

Initial dashboard r1 exposed the real pending-membership distinction gap. R2
verified the first browser repair with a SQL-derived synthetic IAM adapter. R3
replaced that adapter with the production IAM route/helper and added revoked and
future-start pending cases. R4 added delayed overview acceptance. Final r5 also
verifies residency-specific wording and the approved-member Check for updates
transition. Only r5 is final current dashboard acceptance.

A separate finding remains: ancillary intelligence failures are currently folded
into null/empty data. In the deliberate outage fixture, health/checklist cards can
show setup/readiness prompts rather than unavailable state; property/bill cards
have separate loading/null behavior. Repair and verify these loading/error/retry
states next, then continue iOS/Android residency review/recovery and transactional
submission/cold-start/resubmission. Ownership transfer/challenge, lease/resources
and the entire ordered handoff backlog remain. Server-side changes without a
lifecycle/refresh event are not pushed live to this browser; continuous revocation
streaming is not claimed.

No migration is added. Home remains 35 versions / 44 combined with paid; combined
dependency reconciliation/replay and production upgrade are still required.
PRs #32/#34 remain drafts. Paid #34 `e9ef2decb` is green but unfinished. Preceding
Home `d93a7f6ac` has all reported checks green except iPhone 16 and Android
lint/test/assemble still running at the latest observation; refresh this milestone's
exact head. PRs #7/#24 are merged. All paid services stay one final launch bundle.

Private evidence stays outside Git: `/private/tmp/pantopus-web-dashboard-access-r5/`
and its sibling log; `/private/tmp/pantopus-web-residency-dashboard-r1/` and sibling
log; `pantopus-dashboard-access-types-r5.log`, `web-r2.log`, `lint-r3.log`,
`backend-full-r2.log` and `privacy-r1.log` under `/private/tmp/`. No credential,
device token or raw operator evidence is committed. Exact fixtures are cleaned
by each final driver. Owned web/Gig database runtimes remain for immediate
continuation. Owner source, emulator, databases and unrelated work remain intact.
