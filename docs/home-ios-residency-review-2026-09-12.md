# iOS prepared residency review — September 12, 2026

Accepted local milestone after `e44981d5cbe879481176aaf0286f8ee4b753381a`.
Final signed build r8 passes the complete installed HTTP/SDK/SQL journey and
full iOS regression. Verify this milestone's own pushed-head CI independently.
Android prepared review is a separate candidate awaiting installed acceptance.

## Resulting behavior

The owner claim queue and authorized household member list now open a prepared
residency decision. Reviewers see the current applicant, claim/address, requested
role, membership status, age and access/verification dates before confirming.
Changing the action, ordinary role or optional rejection reason requires renewed
confirmation. The Close and Reload controls stay fixed while the review scrolls;
the keyboard has a Done action. Storage failure keeps the pending form accurately
labeled and disabled. Users cannot review their own membership.

One exact decision is saved in account/origin/Home-scoped, device-only Keychain
storage before HTTP. Dispatch checks current authority and session proof first.
Historical receipt validation binds actor, Home, claim, UUID, action and review
token. Current claim and membership are read separately: a historical approval
cannot restore removed access, and rejection replay cannot reject a resubmission.
Known proof can repair a failed local write without another POST. An original
survives restart and requires native acknowledgement after confirmed proof or a
specific definite refusal. Background/account changes retire replies and hide
private review content. An unexpectedly missing original blocks replacement.

## Actual installed acceptance

The complete final journey `ui-r12` passes in **500.670 seconds** on the owned
iPhone simulator. It uses normal sign-in, real Keychain and production review,
list, IAM and decision routes through the local Supabase SDK and SQL. Only
identity/authentication and unrelated shell responses are synthetic.

- Cancelling an unsubmitted rejection sends no decision. Failed and malformed
  current reads hide private claim fields and actions until explicit reload.
- Save requires confirmation; changing the selected role clears it.
- A lost approval reply and cold exact replay produce one receipt. Later move-out
  stays inactive beside the historical approval. A second cold read sends no POST.
- The member-list entry reaches prepared review. A changed claim refuses a stale
  decision without a receipt; acknowledgement reopens unconfirmed current review.
- Lost rejection and restart replay preserve the original reason and a later
  pending resubmission. Revoked reviewer access hides private claim and proof,
  retry and acknowledgement. Restored access permits explicit acknowledgement.
- Backgrounding a held preflight retains the original and sends no decision.
  Explicit retry confirms it once. A retired authorized read cannot restore
  review after access is revoked; restored access requires a fresh read.

Final evidence contains **six POST attempts / three receipts**, matching bodies
and paths for both lost-reply replays, no held work and restored reviewer authority.
All originals are acknowledged through native controls; recovery shows empty.
Prepared review, historical rejection and empty recovery captures were visually
checked on the final build. Earlier recovery captures remain private.

## Regression and evidence binding

Final full regression `regression-r2`: **4,379 passed / 168 skips / zero failures**,
4,547 total. The owned simulator retains its synthetic session, so the controlled
local backend remains active for this suite. No authentication behavior or
assertion was weakened. The earlier focused run passes 52 checks, including
initial write refusal with zero POSTs, failed proof-write repair without another
POST, retired preflight, missing-original fencing and mismatched actor proof.
Final changed-source SwiftFormat/SwiftLint, privacy gates, strict signing and
simulator Keychain-host verification pass.

`source-build-r12.json` binds all 15 candidate source/fixture files and all 27
Mach-O images in the app and test products, including the production debug dylib
and both test bundles. `installed-binding-r12.json` verifies the installed app's
launcher and production dylib against those products. Final products are preserved
in `accepted-products-r8`; `source-evidence-r1.json` binds acceptance artifacts and
source hashes to the commit after staging. No private evidence is checked in.

Private evidence directory: `/private/tmp/pantopus-home-ios-residency-review-r1/`.
It contains build r8, final style/privacy/signing logs, focused/regression bundles,
full UI r12 and exported attachments, fixture r6 before/after/cleanup evidence,
and preserved products. The owned simulator is
`F9BBAB33-BAA0-4A00-9ECE-E3B1343627A8`.

Earlier unsuccessful attempts are retained separately and are not accepted runs.
They exposed synthetic Hub decoding/lazy permission substitutions, virtualized
controls, a label tap that did not toggle confirmation, and a moving Reload
button after foreground refresh. The corrected harness retains the real SDK/SQL
path. Fixed production Reload placement resolves the last interruption issue;
continuation r11 and fresh complete r12 pass on the same r8 binaries. Direct
SQLite service-name probes did not identify Keychain records and are explicitly
not evidence of storage absence; cold UI recovery and acknowledgement provide
that evidence.

## Preservation and remaining scope

All six exact fixture instances are cleaned. Final fixtures r4–r6 verify full
migration-ledger row/column SHA256 and exact review-function OIDs, definitions,
owners, ACLs and configuration before/after cleanup. Earlier fixtures verify the
complete version inventory. No schema/function migration is introduced here.
Source inventory remains 43 Home / 21 paid / 52 combined migrations with 12
identical shared versions and no timestamp collision. Combined replay/adoption
and ledger reconciliation remain unfinished.

Android installed prepared review, invitations/private first use, ordinary
no-claim address verification entry, legacy compatibility, broader lifecycle/
accessibility/provider combinations and the wider backlog remain open. Six of
80 inventory rows are closed; that is not whole-app completion or remaining
engineering effort. The physical iPhone remains Pantopus 1.0.0 (2), unchanged
by this simulator milestone. Owner work, databases, devices and private artifacts
are preserved. Paid services remain one final launch bundle.
