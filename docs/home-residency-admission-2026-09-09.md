# Home residency admission — September 9, 2026

This source checkpoint follows `7f6b59ba3` in draft
[PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32). It covers
manager attach and legacy residency-claim approval/rejection. It does not
complete invitation, ownership, lease or challenge lifecycle work, and it does
not add ordinary role defaults or apply Home migrations to hosted databases.

## Result

The attach and residency-review routes now bind the authenticated actor and
exact target or claim to one service-only transaction. The transaction locks
the Home, role/preset references, occupancies, ownership facts, overrides and
claim before checking current authority. A claim's stored user is the only
possible recipient; a caller cannot replace it with another body field.

Current `members.manage`, verification, active state, both access windows,
explicit denies and child/teen ceilings apply to the actor. Revoked/disputed
ownership without a current verified proof cannot revive through an old owner
pointer. Frozen, merged and archived Homes reject admission. Self-admission is
denied, including approval of one's own claim.

New or explicitly pending ordinary membership can become verified only within
the actor's current role and complete permission ceiling. Activation considers
existing explicit grants because they would become effective with verification;
a role-change delta alone would miss this escalation. Existing restrictive
overrides and age bands remain, and existing start/end/access dates never reset.
Scheduled access can be verified but does not begin early. Unknown age retains
compatibility; no age enforcement feature flag or historical metadata changes.

Formerly verified, revoked, suspended, inactive, ended, unknown-state or
ownership-bearing targets require a separate lifecycle/ownership flow. Generic
residency approval cannot grant owner, admin or manager roles. Current verified
members retain their exact occupancy, including role, dates and permissions;
approval can resolve their pending claim without re-templating membership.

Claim status, membership activation, permission projections, vacancy and audit
are one commit. Approval/rejection serialize against each other. Exact retries
do not restore a previous role or replay notifications; approval retried after
move-out does not reactivate access. Direct client claim DML is revoked,
including PUBLIC grants. Database/transport/lock failures return a retryable
503; there is no fallback template or partial “claim approved” response.
Notification failure after a committed result does not misreport the admission
as failed. This does not introduce a notification outbox or guaranteed delivery.

## Verification

Full backend: **4,713 passing tests, 16 skipped, 294 passing suites**. Privacy
gates pass, including **15 E2E checks**. The full run started before a one-line
defensive known-error lookup change (`Object.hasOwn`); the complete **39-test
focused rerun** below passed against that final service file. No policy/source
change was omitted from the appropriate verification.

Focused route/service/legacy-authority adapter tests: **39 pass**. They bind the
authenticated actor and exact source, preserve typed denials, exercise transport
and malformed responses, and prove no legacy table writes or notifications on
failure. Existing high-role residency tests remain and now assert RPC binding;
their actual role-policy decisions are also exercised by the real SQL contract.

The source contract is
[`home-residency-admission.sql`](../scripts/db/contracts/home-residency-admission.sql),
with its generated pgTAP wrapper. It uses the shipped 24 role rows, checks
permission/age/date/state preservation, exact retries, current owner denies,
target renewal refusal, scheduled access and rollback after an injected final
audit failure. The full local **24 raw SQL contracts and 24 generated pgTAP
wrappers pass**, including the parallel access-secret checkpoint. SQL lint
reports **136 functions, 74 trigger bindings, zero errors and five existing
warnings**. All exact fixtures are cleaned; wrappers and whitespace checks pass.

**14 actual two-connection admission races pass** with demonstrated lock waits:
duplicate approval creates one occupancy/audit; competing approval/rejection has
one winner in either order; actor revocation, expiry and explicit deny are
rechecked; target removal, suspension, child-age restriction, new finance grant,
ownership, expiry and unknown role deny activation; a concurrent claim-role
promotion is also denied. Losing changes preserve the exact Home, occupancy,
claim and audit state. **13 refreshed access-secret races** pass separately.
Independent source review found no actionable P1/P2 within the admission slice.

The admission migration SHA256 is
`2a32aeb79f5eadc3add4c70e555aab2fae29bc1913e4718a03d6653ff8924a47`.
Operator logs and temporary concurrency harnesses remain outside Git. These
are source/local results; hosted household acceptance has not run.

## Remaining work

The next admission slice is invite creation, recipient-bound acceptance and
decline, plus household-access-request conversion. It must recheck the current
inviter, bind the exact recipient, snapshot bounded preset/date intent and avoid
renewing existing restrictions. Legacy token compatibility and dedicated
`claim_merge` ownership behavior need explicit handling. Direct invitation DML
and the old alternate template/attach paths remain release blockers.

Residency-claim submission/cold-start/resubmission, challenge suspension and
remaining ownership/lease/system gateways also need their own current-state
transactions. Then complete guest/scoped resource grants, task/calendar and
attachment routes, dashboard/notification filtering, storage retirement and
web/native permission controls. The whole Home journey must pass before adding
ordinary role grants or calling this a release.

## Integration state at verification

Payment [PR #31](https://github.com/WangPantopus/skinny-pantopus/pull/31) merged
after all final-head checks passed in run `34434288893`, producing master
`d7be416b872a31ceb53094d7d19c3f114185831f` at 04:15:08 UTC September 10.
The prior Home head `7f6b59ba3` also has all CI checks green. This new Home
checkpoint must be committed, then integrate current master and pass its own
current-head checks. No master merge ran while these sources were uncommitted.
Native sensitive authentication has its separate locally validated source
checkpoint in [PR #33](https://github.com/WangPantopus/skinny-pantopus/pull/33),
head `b85febb8c`, with CI pending at this observation. Completed physical-device
Beacon and native payment acceptance do not need repeating.
