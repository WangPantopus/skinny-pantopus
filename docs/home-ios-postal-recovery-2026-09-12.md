# iOS postal recovery — September 12, 2026

Accepted locally after `077195b4f72081dfd1a2c3c85f11f24dd9f195c6`. Final signed
build r13 passes the complete installed postal journey, all three existing
creation recovery journeys and full native regression. Android postal and native
prepared household review remain open; this is a bounded iOS milestone.

## Resulting behavior

Both production mail-verification destinations now use current postal and personal
residency reads. The complete street/apartment/city/state/postal-code/country is
confirmed before mailing. One exact mailing or code UUID/body is synchronously
retained in an account/origin/Home-scoped, device-only Keychain slot before HTTP.
Atomic submit, status and cancellation APIs preserve the original through lost
replies, restart and unknown outcomes. Failed reads or proof persistence retain
recovery controls; confirmed terminal proof requires acknowledgement before editing.

Missing keys before admission leave no postcard and preserve the local original.
An admitted original resumes only with its server-confirmed UUID/address. Unknown
delivery never offers another mailing. A code result remains separate from current
household access; both current reads must validate before navigation appears.
Session and lifecycle changes hide addresses/codes/dialogs/actions and retire old
responses. No code is shown in the recovery receipt. The landlord fallback opens
address review without the legacy mail POST or a claim that mail has been sent.

The form uses persistent labels, required markers, standard primary actions and
the keyboard's native Done action. Completed postcards no longer show remaining
code guesses. The normal API 404/auth/step-up behavior is preserved; only explicit
atomic-recovery callers receive raw 404 receipts, which must match the original.

## Actual installed acceptance

The final full journey (`ui-r5`) passes in **297.369 seconds** on the owned iPhone
simulator through production local HTTP, SDK and SQL. Sign-in, provider delivery
and notifications are controlled. No real mail or hosted service is used.

- Sustained status outage hides the address/actions; explicit retry restores them.
- A Home apartment change after confirmation refuses mailing to the old selection.
- Restart and cancellation before admission fence the delayed original worker:
  no postcard, dispatch or access is created.
- Missing initial keys retain the original; restored keys and a lost admitted
  reply recover the same UUID with one postcard and no premature dispatch.
- Restart and missing keys after admission preserve the server-confirmed original.
  Restoring keys dispatches once; unknown delivery does not offer another mailing.
- Cancelling a held code submission spends no guess and grants no access.
- Lost wrong-code and successful responses recover after restart. The wrong code
  spends one attempt; successful address proof remains provisional household review.
- A current approval enables Home navigation. Removal plus background/return
  hides it; releasing the old approved reply cannot restore it. Completed postcards
  show neither code entry nor an attempts-remaining count.

Final SQL: one postcard, one synthetic provider call, three verification commands
(cancelled/rejected/completed), removed occupancy and no held work. Final address,
unknown-delivery, proof and removed-access captures were reviewed. Both distinct
creation units also render correctly after the existing-flow regression.

All three original creation journeys pass on the same r13 products:
`cancelled` 126.019s, `lost reply/restart` 98.972s, and `atomic optional-setup
refusal/corrected request` 89.593s. Units 301 and 303 each retain one secret and
zero verified occupancies. Creation does not invent household membership.

## Regression, corrections and evidence

Final full native regression (`regression-r2`): **4,368 passed / 168 existing
skips / zero failures**, 4,536 total in 42.136 seconds. This includes focused
lost-code/proof-write and wrong-identity/current-access checks, normal API 404/auth
behavior and landlord review handoff. Old direct-postcard fallback expectations
were replaced when that mutation was removed. The controlled local backend stays
active during the suite because the owned simulator retains its synthetic session.
No auth behavior or assertion was weakened. Full SwiftLint/SwiftFormat, icon and
overline checks, final changed-source lint/format, privacy r3 and strict deep
signing pass. R13 products are preserved in an APFS clone.

Earlier attempts remain separate evidence. UI r1 injected only one 503; the normal
idempotent GET retry recovered automatically, so its expected error did not occur.
UI r2 exposed a visible custom keyboard Done accessory absent from the accessibility
tree; the native keyboard action fixes this. Neither sent a command. UI r3 passed
status/address/cancellation but wrongly expected admission without initial keys.
The app correctly retained the original. UI r4 recovered that exact original and
passed the remaining journey in 98.306s without reset/discard. R3/r4 share one
production binary. Visual review then removed the obsolete attempts count; final
r5 reran the complete journey on the final r13 source/binary and fresh exact fixture.
Compiler/harness style corrections in intermediate builds are not passing evidence.

Private prefix: `/private/tmp/pantopus-home-ios-postal-`. Evidence includes
`build-r13`, `source-build-r13.json`, `ui-r5` and exported attachments,
`regression-r2`, `create-regression-r1` and attachments, full/changed style logs,
`privacy-r3`, and `source-evidence-r1.json`. Earlier r1–r4 evidence remains private.
The preserved products are
`/private/tmp/pantopus-home-native-artifacts-after-ios-postal/Products`.

All three postal fixtures restore the exact preimage review definition, OID,
owner, ACL and config; their synthetic rows and temporary schema are removed.
The creation fixture also cleans its exact rows and temporary command functions.
Ledger `20260910220000` remains unchanged. No held request or active acceptance
server remains. Source migrations remain 43 Home / 21 paid / 52 combined, with
12 identical shared versions and no timestamp collision; combined replay/adoption
is still required before merging.

## Remaining and preservation

Continue the separate Android postal candidate: models, encrypted storage and API
compile; its new coordinator/transport, screen and navigation still need completion
and installed acceptance. Then finish both native prepared-review flows, invitations,
private first use and legacy compatibility. H08 still needs an explicit private-Home
verification entry and ordinary selected-address submission before mail when no
claim exists. Ownership remains a separate route. H07/H08/R01/R02 remain open.

PR #32 and #34 remain drafts; #34 conflicts. Predecessor 077195b4f has its corrected
instrumented job passing; the Android lint/test/assembly job is still running in
[CI 34692652031](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34692652031).
The new milestone must pass its own current-head CI. No merge, hosted migration,
release, real provider delivery or paid activation. Owner work, databases, devices,
prior artifacts and private evidence are preserved. The physical iPhone remains
verified Pantopus 1.0.0 (2). Paid services and dedicated postal keys remain one final
launch bundle. Broader device/provider/accessibility/version combinations stay
explicit acceptance limits, not app-wide certification.
