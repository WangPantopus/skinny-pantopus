# Home postcard code verification and household review recovery

September 12, 2026. Backend milestone on `codex/home-permission-boundaries`,
following postal request milestone `f035c47ef`. Browser and native postal clients
remain unfinished. This report certifies the bounded local checks below.

## Result

Code entry now binds one retained attempt to one actor, Home and postcard. A lost
wrong-code reply can be recovered without spending another guess; a lost success
can be recovered without extending verification or restoring access. Cancellation
before arrival prevents that attempt from consuming a code. A corrected code uses
a new attempt only after the original result is resolved.

Current Home, selected apartment, occupancy schedules, household decisions,
ownership, age restrictions and permission ceilings are checked under database
locks. Removed, rejected, archived or changed-address access cannot be restored
by postal verification. A postcard whose mailing has not started cannot verify.
Code, occupancy, claim, audit and retained outcome commit together.

Where household review is required, postal proof leaves a restricted provisional
occupancy and a pending claim. Personal status leads to household review and does
not promise shared Home access. Prepared household approval now accepts a coherent
postal review with matching verified address proof, retaining existing delegation,
role, explicit deny and date protections. Recorded success remains history; current
access requires its own fresh check.

The review-window worker rechecks each exact occupancy and verified postal proof.
It preserves original review dates, refuses changed or challenged access, tightens
current child restrictions and never renews verification on retry. Pagination lets
eligible residents progress past earlier blocked rows. The household challenge
endpoint shares review locks, cannot suspend a completed promotion, and recovers
a recorded challenge without another suspension or duplicate notification attempt.
Notifications use generic text; delivery itself is not certified here.

## Acceptance and evidence

Private evidence uses `/private/tmp/pantopus-home-postcard-verification-` below.
These directories contain operator records and are intentionally outside Git.

- `http-r8/` and adjacent log: production routes, actual Supabase SDK/SQL, controlled
  authentication and local notification/mail transport. Exact-card/actor binding,
  lost wrong/correct replies, cancellation, malformed-read recovery, changed Home
  and schedules, removal, late audit failure and original retry all pass. Actual
  prepared approval preserves child restrictions and explicit denies. The actual
  worker passes 201 earlier blocked candidates and recovers an injected RPC error.
- `concurrency-r3.log`: 16 observed SQL lock waits cover duplicate attempts,
  cancellation, fifth-guess contention, apartment change, archival, access expiry,
  rejection, removal, independent admission and challenge/promotion in both orders.
- `policy-r7.log`: postal verification, ordinary admission, prepared-review receipts
  and postal-request SQL contracts pass with current source prerequisites inside
  rollback transactions. The first broader regression (`policy-r6.log`) correctly
  refused the local database's older 24-role-row matrix; temporarily including the
  already accepted member-default migration supplies the shipped 29 rows. No local
  grant rows were permanently changed.
- `upgrade-r5.log`: complete row-value digests remain identical in all 365 existing
  public/auth/storage tables. All postal and replaced review functions have zero
  lint issues. The rehearsal rolls back its schema and lint extension changes.
- `backend-r2.log`: 317 suites, 5,170 checks passed, 16 skips. Browser SDK types
  (`types-r1.log`) and all privacy gates (`privacy-r2.log`) pass. The preceding
  postal request's actual HTTP recovery regression also passes (`request-regression-r1.log`).
- All 48 generated pgTAP wrappers and immutable migration policy checks pass.
  Source inventory is 43 Home / 21 paid / 52 combined migrations, with 12 identical
  shared files and no timestamp collisions (`migration-inventory-r1.json`).

Product assertions in `http-r7/` passed, but its cleanup exposed a missing SQL
statement separator when restoring an existing review function. Synthetic rows
had already been removed. Controlled repair in `cleanup-r7/` restored the accepted
original implementation from immutable migration `20260910024500`, preserved the
function OID, owner, ACL and settings, and removed only the empty temporary postal
schema. The original pre-r7 definition was held in memory and was not persisted,
so exact pre-r7 definition equality cannot be independently proven. This is a
verification limitation, not a claim of byte-for-byte restoration for that run.

Both acceptance scripts now persist private executable pre-mutation function
backups, use the explicit separator and assert exact captured definition and
identity/grant/settings restoration. Fresh HTTP r8 and concurrency r3 pass those
cleanup assertions. No synthetic fixtures or temporary postal schema remain;
the local ledger is still `20260910220000`.

## Next and release limits

Wire and accept the browser postcard screen: initial/current status, explicit
selected mailing address, original request/code recovery, unknown delivery and
truthful current access after verification. Then finish native submission/status/
postal/prepared review, invitations/private first use and the consolidated backlog.
H07/H08/R02 remain partial; 74 of 80 inventory rows remain partial/open. This count
is not whole-app implementation or remaining effort.

The predecessor has every CI job passing in
[run 34680612277](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34680612277).
Verify this milestone's own pushed-head checks separately. #32 and #34 remain
unfinished drafts; #34 conflicts. Combined migration replay/adoption is still
required before merge/release. Legacy postal/claim mutation compatibility and
native notification destinations remain acceptance work. Notification failures
are best-effort and do not undo recorded decisions; no durable notification retry
is established by this milestone.

No merge, permanent migration adoption, hosted rollout, actual mail/message send,
paid activation or device change occurred. Keep dedicated postal code keys and
paid providers in the single final launch bundle. The physical iPhone remains on
the verified in-place Pantopus 1.0.0 (2) build from native source `139868c1d`.
Owner work, databases, devices, build artifacts and private evidence are preserved.
