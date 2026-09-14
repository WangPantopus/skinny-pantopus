# Home claim review, withdrawal and legacy evidence boundary

Source checkpoint in `codex/home-permission-boundaries`; migration
`20260910080000_home_claim_review_transactions.sql`. This report covers the
ordinary claim decision and withdrawal transaction. It is not complete Home
acceptance or a hosted deployment.

## Changed behavior

Ordinary Home review and the platform-admin review endpoint now use one guarded
transaction. It locks current Home authority, target membership, claims and
evidence, and requires the review token from the displayed claim/evidence
snapshot. An added/changed document, changed claim type or method, revoked
reviewer, changed target restriction or expired access window cannot be approved
using an earlier read. Transport, locking and unexpected database failures
remain private, retryable failures without compatibility writes or compensation. A lost response can recover the
same actor/action/token/note decision from a service-only receipt, without
regranting authority or repeating audit/notification. Replay requires matching
post-decision claim/evidence, occupancy, effective permissions and ownership
proof plus current reviewer authority. The receipt also proves private withdrawal;
legacy client-writable audit metadata alone cannot establish that provenance.

Approval requires current identity confirmation and eligible verified proof.
Pending evidence is never blanket-verified. Explicit failed identity overrides
older successful IDV evidence. Resident and admin claims create their distinct
membership roles and never create ownership records. Co-owner approval preserves
the incumbent primary; a first owner may fill an empty primary pointer. Existing
age, activity, verification history, access dates and restrictive overrides stay
in place. Explicit minor role ceilings remain enforced; unknown roles and
revoked/disputed ownership cannot be promoted through this path. Home authority cannot delegate permissions it does not hold.
The explicit platform-admin endpoint rechecks the current database User role and
retains explicit Home age/status/role/deny/revocation ceilings; a JWT role cache
alone does not confer decision authority.

Withdrawal is an exact claimant transaction. It retains the claim, evidence,
ownership and audit history, marks the claim withdrawn and revokes only pending
claim invitations bound to that claim/claimant. An accepted or approved claim
cannot be withdrawn by a stale request. Repeating the completed withdrawal is
idempotent. A protected withdrawal receipt keeps exact own private setup usable after withdrawal;
this does not grant household membership and does not bypass storage/deletion
history guards. A second foreign or review receipt is an explicit private-setup
and private-deletion boundary, even when an own withdrawal receipt also exists.
The web action now accurately says Withdraw.

The property-record provider callback also uses a current-claim transaction.
A late response cannot append evidence or overwrite compatibility fields after
withdrawal, acceptance, approval or rejection. Active flag/more-info decisions
still accept new provider evidence; that invalidates an earlier review snapshot. That gateway records trusted provider facts;
it does not activate or resolve disputed ownership.

## Evidence safety and immediate follow-up

Legacy evidence refs were accepted from caller metadata. Their format therefore
cannot prove object ownership. The old admin detail route signed arbitrary
storage refs, and purge treated every non-HTTP string as an owned object key.
Both behaviors are closed. Existing refs/metadata remain intact; no object is
fetched, signed, deleted or stamped as retired. The retention job reports
quarantined candidates and does not claim successful deletion. Direct client
claim/evidence SELECT is revoked because canonical pending-owner policies could
otherwise return those raw URLs and bypass current review permissions. Backend
claimant summaries and the exact sanitized review API remain available.

Metadata-only evidence submission and the legacy public upload route return a
current-claim, recoverable `CLAIM_EVIDENCE_PRIVATE_REUPLOAD_REQUIRED` response
without receiving/storing bytes or inserting evidence. Existing untrusted manual
records require a private re-upload; this milestone does not mint provenance for
historical refs. Current verified provider evidence must have the expected
provider/type, no storage URL/ref and a qualifying current provider result.

**Immediate next source milestone: `20260910090000` trusted private evidence
upload intent, exact authorized read and durable retirement.** It must reserve a
trusted record before writing bytes, retain retry/cleanup history, require
current exact evidence selection for a manual decision, and never retire a
caller-selected legacy object. Native Admin/Home claim review endpoints, models
and view models must also send the displayed snapshot and preserve stale-state
recovery before final acceptance. The web reviewer already sends that snapshot
and explains when a private re-upload is required.

The ordinary platform endpoint returns a dedicated-challenge `409` without
changing the Home, incumbents, claim, evidence or membership. The dedicated
challenge workflow must still be completed; this does not silently fall back to
the former approval/rejection behavior.

Challenge resolution, remaining claim submission/admission, ownership transfer,
lease lifecycle, task attachments, other Home records/derived data and complete
household acceptance remain separate outstanding milestones. Ordinary role
defaults and the verification-age feature flag are unchanged. No hosted Home
policy, provider object or production runtime was modified.

## Verification

- Focused backend service, route-adapter, purge and retention suites: **45 pass**.
  These assert exact actor/claim/snapshot binding, no raw table fallback, no
  signing/public upload/deletion of arbitrary refs and private retryable errors.
- Parent-run HTTP ownership compatibility and admin queue suites: **41 pass**.
  The final adapted platform challenge suite has **3 passing HTTP checks**,
  covering exact actor/action/snapshot RPC binding and dedicated-flow denial
  without changing claim, incumbent, evidence or membership records.
- Web type gate: **zero errors** after snapshot and withdrawal UX changes.
- A clean replay of all **24 migrations** passes. All **30 raw SQL contracts**
  and **30 generated pgTAP wrappers** pass; wrapper results explicitly reject
  TAP `not ok`, rather than relying on the psql exit status.
- **32 observed lock-wait races** pass, including exact operation replay, actor
  and target changes, evidence changes, competing review/withdrawal/acceptance,
  late provider completion and NULL platform role. **6 SDK/PostgREST checks** pass.
- Application function lint: **179 functions, 77 trigger bindings, zero errors**
  and **five unchanged warnings**. The full pinned lint gate passes with its six
  reviewed extension errors and 40 CLI warnings; these are not application errors.
- Final source migration SHA-256:
  `4b1a453ea5e60c2cfdc8b1df1d70cc5f20f10eb325515a73ea98bfe1d3bf7c9c`.
  All **11 source/runtime function bodies match byte for byte**; aggregate body
  SHA-256 `d997850c6d7ecf4f7508d1e99ce9d1cf486e188b6c7062281b7c0e0b63549876`.
  The isolated database has 322 tables, 499 policies and 24 migration ledger rows.
  Exact User/auth/Home/claim/evidence/receipt/task/event/media fixtures are all zero.
- Independent review caught a nullable platform-role result that could skip a
  negative boolean check. A real observed wait reproduced pre-fix approval after
  the role changed to NULL; explicit false/deny handling and final races close it.
  The existing deletion catalog contract also caught the new receipt dependency;
  explicit private history predicates and foreign/review receipt regressions now
  pass. A raw-contract psql echo was replaced with SQL before final pgTAP results.
- Final full backend run: **4,946 pass, 16 skipped**, with **one chatRoutes
  socket hangup**. The unchanged chat suite passes all **26 checks**, including
  the final-source focused recheck. The preceding full run
  passed 4,945 with only the two now-corrected challenge fixture failures. Those
  fixtures needed the header-based admin identity used by the existing Jest
  middleware mapper; no runtime authorization was relaxed.
- All privacy gates pass, including **15 E2E checks**, against the unchanged
  backend runtime. The full-suite local socket failure remains a verification
  limit, with no established Node-version cause. Final-head remote CI is required
  before merge; isolated passes are not described as a fully passing final local
  suite.

Detailed operator logs stay outside Git. Final local evidence is retained under
`/private/tmp/pantopus-home-claim-review-final-{reset,checks,races,function-lint,postgrest}.log`
and `/private/tmp/pantopus-home-claim-review-final-source-body-evidence.json`.
The final full backend log is
`/private/tmp/pantopus-home-claim-review-full-node22-r3.log`; the parent retains
its focused HTTP and privacy logs outside Git as well.
The concurrency harness, raw contract and generated wrapper have respective
SHA-256 prefixes `9fb28bf8`, `2fa216c2` and `823a9aa4`.
