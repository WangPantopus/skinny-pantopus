# Android ordinary-member onboarding and private first use

September 12, 2026. The installed Android ordinary-member journey passes from
the shipped sender form through real recipient acceptance, fresh My Homes and
the matching Home to household-private Task creation, cold lost-reply recovery,
editing, completion and current-access denial/removal/restoration. This closes
this existing-account subjourney, not all H07/H08 acceptance.

## Installed baseline

The retained Android sender r11 Debug product, with its installed APK digest
verified against the preserved candidate, passed one uninterrupted native run.
The baseline used the shipped invitation form's selected **Member** default,
normal account sign-in, one actual sender creation and one actual recipient
acceptance. The new capability was matched by actor identity and sender request
UUID, rather than assuming fixture actor and capability indexes match. Both
protected originals were acknowledged.

A cold return fetched My Homes for the accepted member and opened the matching
Home through its real row. The list showed the Member role and **“Residency
verified”**, although the actual admission created only verified household
occupancy: no residency claim, ownership claim or ownership change occurred.
The dashboard matched the actual Home address and exposed only Overview. Its
current ordinary-member permissions contained `home.view`, without Task view or
edit. No Task or Task creation receipt existed.

This confirms two distinct issues: ordinary household admission must not claim
independent residency verification, and the baseline ordinary-member policy does
not provide Task first use. The deliberately proposed permission repair is owned
by the [member Task policy report](home-member-task-first-use-2026-09-12.md);
the Android driver does not install positive permission overrides.

## Retained-app Task form capture

A fresh fixture applied the deliberate member Task policy. The retained r11 app
again created and accepted one ordinary-member invitation through normal UI,
acknowledged both originals and fetched the member's Home. Its actual Task form
visibly selected **“Unassigned (any member)”** and stated **“No members found in
this home.”** The real member-roster request returned HTTP 403: the member had
Task view/edit but no `members.view`. Thus the empty picker was a denied roster
read, not proof that the Home had no members.

The initial driver reached and captured this form, then stopped on its
full-prefix response-path assertion. Express exposes the mounted path in this
fixture's response callback. A separately bound continuation checked the actual
403, closed the same form and discarded its blank edits. It repeated no
invitation commands. Both protected originals remained acknowledged; there were
zero Task commands, Task rows and creation receipts. The fixture's five exact
cleanup flags passed for all 366 populated tables, and the owned emulator was
stopped with data retained.

## Implemented wording and verified products

Android My Homes now uses **“Household access”** for verified household occupancy
in the installed app. Its independent ownership-proof badge remains separate. A focused
semantic regression covers an admitted ordinary member without ownership proof.
The Task picker now says **“Unassigned”**. A failed roster read says **“Member
list unavailable. You can leave this task unassigned.”** A successful empty
roster has separate guidance. Focused regressions cover authorized unassigned
creation during roster denial, failure/empty-result distinction and retirement,
and preserving an existing assignment on a title-only edit.

Candidate r1 passes 35 focused checks and both complete unit variants: **4,581
passed / 80 skipped across 518 suites each**, with no failures or errors. Ktlint
and Detekt pass. The full offline build, Debug and optimized Release assembly,
and both Lints pass in **18m 32s**. Lint has zero errors and no findings in the
changed production files; the existing Debug/Release totals remain 214/189
warnings and 17 information items each. Both APK signatures verify. All 3,026
tracked Android file hashes are bound to the retained products and mapping.

The actual optimized Release APK passes a standalone eight-record codec probe:
four preserved sender records plus Task scope, request, protected original and
recovered receipt metadata. It uses the current optimized Moshi constructor,
verified from that APK's bytecode. The probe does not install or launch the app,
access the fixture or make network calls. No app process ran before or after
the probe; the installed r11 package and its userdata remained retained. The
owned emulator was then stopped with userdata retained.
## Installed candidate acceptance

Candidate r1 was installed over retained sender r11 with app data preserved. The
installed APK digest matches the verified Debug product. All 3,026 bound Android
source files remained unchanged throughout acceptance; only the separately bound
UI driver changed.

The fresh `member-onboarding member-tasks` fixture began without a non-owner
membership or invitation. The actual shipped **Member** default produced one
sender creation and one recipient acceptance through normal sign-in. Both
originals were acknowledged. A cold My Homes fetch visibly showed **Member** and
**Household access**, without a residency or ownership claim. Its real Home row
opened the matching address and available Tasks. No residency/ownership claim or
ownership change occurred.

The actual roster HTTP 403 showed **Unassigned** and **“Member list unavailable.
You can leave this task unassigned.”** Creation remained available under the
member Task policy, without granting `members.view`. Intended Title and Notes
were re-read from both visible current editors before Save and matched the real
SQL fields. A deliberate lost reply followed the committed creation. After a
cold restart and fresh My Homes/Home entry, the actual **Retry original request**
submitted the same request UUID and raw body SHA. SQL retained exactly one Task
and one canonical creation receipt. The app resolved the encrypted original.
Raw wire hashes and canonical SQL receipt hashes remain separate evidence.

The stored `visibility=members` is the documented household-private audience;
the detail currently labels it **“Visibility: members.”** The Task was reopened
through its actual detail, both Title and Notes were edited with exact current
field and SQL checks, and **Complete → Reopen → Complete** produced the expected
`done/open/done` states and completion timestamps.

Current reads also passed the following independently checked boundaries:

- A real Task-read HTTP 503 retired private content and mutation controls;
  **Reload task** recovered the same Task.
- An explicit `tasks.edit` denial kept the Task readable without edit/completion
  or Gig-publication controls. An explicit `tasks.view` denial returned HTTP 403
  and retired its content.
- A `home.view` denial removed the Home from freshly fetched My Homes. The same
  Task remained readable through its independent Task permission; this is not
  counted as denied Task access.
- Fixture-driven membership retirement removed the fresh Home row and returned
  Task HTTP 403. Exact membership restoration restored the Member/Household
  access identity and the same completed Task.

These controls introduce only negative overrides/removal and restore their
prior values. They do not synthesize a positive member grant or claim to exercise
the manager's separate **Remove member** command UI.

The accepted evidence has distinct segments. `first-use-ui-r1` establishes real
admission and identity; r1/r2 then stop before any Task command on driver field
lookup/scroll assumptions. The filled Title exposes a sibling label, and the
corrected driver requires a visible editor and exact value while scrolling both
directions. `first-use-ui-r3` establishes exact-text creation and the lost reply,
then stops on a mistaken driver expectation of literal `household` visibility.
The documented canonical `members` expectation was corrected. `first-use-ui-r4`
continues that same protected original through recovery, editing and all access
checks, and exits successfully. No admission or Task creation was repeated to
bypass either interruption. Final counts remain one sender command, one recipient
command, one Task and one creation receipt; every protected original is resolved.

## Evidence and limits

Private evidence is indexed under
`/private/tmp/pantopus-home-android-member-onboarding-r1/`. Its baseline bindings
record retained r11 production and installed APK hashes, the actual driver and
fixture source, UI evidence and safe HTTP/SQL state. The real visible My Homes
and matching Home captures are in `baseline-ui-r1/`; protected invitation
surfaces retain their normal capture protections.

The accepted baseline, capture, final build/signing and optimized probe are also
preserved with APFS clones under the private operator index's
`home-invitation-handoff-20260912/member-onboarding-20260912/android-member-tasks/`.
The adjacent `android-member-tasks-manifest-pre-first-use.json` verifies matching
hashes for all 1,192 copied files. This durable snapshot explicitly leaves
installed candidate first use pending.

`form-capture-ui-r1/` preserves the actual retained-app form and the limited
initial attempt. `form-capture-close-r1/` records the successful no-command
continuation. Its launched and corrected driver bindings remain distinct;
`form-capture-boundary.json` records the exact restored fixture and stopped
device.

`candidate-r1-final-products.json` binds the final source, APKs, mapping, focused
and full regressions, lint and signing. `release-codec-r1/result.json` and
`offline-codec-boundary.json` bind the optimized runtime proof and stopped
device. The original prepared binding remains a predecessor. Final admission, creation
and continuation bindings, exact field captures, SQL/HTTP state and successful
result are preserved under `first-use-ui-r1/` through `first-use-ui-r4/`. The final
source and installed-product checks are bound separately from each launched
driver revision.

`fixture-baseline-r1/cleanup.json` confirms fixture removal, exact role/function
restoration and preservation of the complete ledger and every row/schema in all
366 populated tables. The fixture exited successfully and port 18084 was
released. The owned recurrence emulator was stopped with app and device data
retained. The final
`fixture-first-use-r1/cleanup.json` independently passes all five exact cleanup
flags and preserves the same 366-table boundary. Both the final fixture and
owned emulator exited successfully; ports 18084, 5556 and 5557 are closed. The
installed candidate package and userdata remain retained, as recorded in
`first-use-final-boundary.json`.

Final installed evidence is appended under the durable `android-member-tasks/`
folder's `final-installed-first-use/` subtree. Its adjacent final manifest hashes
each copied file; it does not overwrite the earlier pre-first-use snapshot.

This acceptance uses the installed Debug app and real local HTTP/SDK/SQL.
Optimized Release has build, signing and codec runtime proof, not this complete
native UI matrix. No physical device, hosted deployment, provider delivery,
new-account registration, personally private Task audience, manager removal
command recovery or unrelated Home workflow is covered. H07/H08 remain partial;
these results are not an app-completion percentage.
