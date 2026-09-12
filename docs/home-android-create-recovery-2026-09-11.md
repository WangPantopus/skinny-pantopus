# Android Home creation recovery — September 11, 2026

Android now retains the original Home creation command and optional access setup,
recovers its outcome after restart, and reloads current My Homes after confirmed
completion. Installed acceptance passes against production HTTP, Supabase SDK and
PostgreSQL on the owned recurrence emulator. This completes Android parity for
the bounded [iPhone creation repair](home-ios-create-recovery-2026-09-11.md) and
[Home unit labels](home-list-unit-identity-2026-09-11.md).

## Behavior

Before any creation POST, account/origin-scoped encrypted preferences durably
retain the original UUID, immutable JSON body and editable form. Optional network
and access records belong to the same atomic server command. They never enter
ordinary saved-state storage. The dedicated encrypted file is excluded from cloud
backup and device transfer; unavailable storage has no plaintext fallback.

Reopening checks status without repeating the POST. Unknown outcomes keep the
original retry/cancel choices. Actor/request identity, command dates, state, Home,
ownership claim, exact unique access-record count, role and verification result
must match. Confirmation is not current Home access. Only a retained, confirmed
terminal result permits acknowledgement; cancellation/rejection restores the
original form and optional values before a new validated command can be made.

Concurrent screens use compare-and-replace storage and shared operation exclusion.
A known terminal result survives a failed outcome write and is saved again without
reposting. Background/session retirement prevents late results from publishing
details or starting a POST after an interrupted protected write. Completion opens
a fresh My Homes list instead of navigating directly with the returned Home ID.

The unwired primary-Home toggle and review claim are removed. Optional access is
validated before Review, including incomplete values and the server's count/length
limits. Installed testing found missing accessible labels on optional editable
controls; those labels are repaired. Stable existing screen/row test tags are
exported for installed inspection. Authorized cards now show the Home's unit while
personal verification continues to hide it.

## Actual acceptance and verification

The final APK/source are unchanged between build r3 and acceptance r4/r6:

- Incomplete optional setup stops before Review and can be corrected through the
  real controls. Unit 402 then creates a pending command while its provider waits.
  After process restart, cancellation is confirmed. Releasing the delayed worker
  creates no Home. Editing restores unit 402; ordinary discard closes the form.
- Unit 401 commits one Home, occupancy, preference, pending owner and access record
  while its HTTP reply is withheld. The encrypted store contains no plaintext
  fixture address or secret. Restart/status recovery returns that original Home
  with exactly one creation POST. Current My Homes shows its private Tasks action
  and unit without verified residency/ownership or a populated legacy owner ID.
- A synthetic age-policy refusal for unit 403 rejects optional setup and leaves no
  partial Home. After restoring the synthetic policy input, editing retains the
  original optional setup; revalidation and a new UUID commit one Home/access
  record. Both unit 401 and 403 cards are visibly distinct and expose their exact
  Home-ID Tasks actions. This fixture verifies current list authority and action
  binding; deeper Tasks behavior retains its separately recorded acceptance.

Seven coordinator recovery checks and the 22 existing wizard checks pass. Final
Debug and Release regression each pass **4,531 checks, 80 skips, zero failures**
(512 suites each). Full lint, detekt, ktlint, Paparazzi verification and Debug
assembly pass. Final instrumented test sources compile. Privacy gates pass.

All retained commands were acknowledged through the UI; afterward the encrypted
store has no command entries. Graceful fixture cleanup removes exactly the
synthetic records, six temporary command functions and temporary command table.
The migration ledger is unchanged. No owner data, unrelated device, archived
product, hosted environment or paid service was changed.

Private evidence: `/private/tmp/pantopus-home-create-android-ui-r4/` and `-ui-r6/`
contain actual screens, hierarchy and HTTP/SQL snapshots; `-fixture-r1.json` and
`-fixture-r1.log` retain the final ledger/cleanup proof. Build r3, regression r2,
instrumented-compile r2 and privacy r1 logs use the same private prefix. The APK
and exact source/file digests are preserved in
`/private/tmp/pantopus-home-create-android-build-r3-evidence/`.

Initial driver runs r1/r2 used incorrect profile/sign-out navigation assumptions.
Run r3 exposed the repaired editable-field labels. Run r4 hit a transient missing
accessibility root after restart; r5 confirmed the separate dialog needs its
visible action label. Run r6 resumes the same original pending command and passes
all remaining cases. No app-data clear or replacement command bypassed recovery.
The first broad lint run exhausted the long-lived JVM's analysis heap. A fresh,
single-worker 8 GiB G1 process passes the complete remaining check set; unrelated
daemons, caches and artifacts were preserved.

## Remaining scope

H07/H08/R02/U01 remain partial: browser retained creation, existing-Home admission,
primary eligibility, complete private first use/invitations, native residency and
broader UI/accessibility/device/provider acceptance are still open. Installed
storage-failure and cross-account matrices, old/new client-server combinations,
hosted rollout and release readiness are not certified here. Source migrations
remain 40 Home / 21 payment / 49 combined; reconcile integration and adoption before
merging completed scopes. Paid services remain one final launch bundle.

Predecessor `1565c8190` passes every CI job in
[run 34669307089](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34669307089).
The Android milestone requires its own pushed-head checks. The owner's physical
iPhone remains on the separately verified [1.0.0 (2) refresh](physical-iphone-refresh-2026-09-11.md).
