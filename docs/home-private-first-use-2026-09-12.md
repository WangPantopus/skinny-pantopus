# Private Home first use and selected-address recovery

This scope connects private setup to an ordinary residency request on browser,
iOS and Android. H07/H08 remain partial: invitation admission and the broader
onboarding exit criteria still need acceptance. The inventory remains **7 of 80
closed, 73 partial/open**; it does not measure whole-app completion or effort.

## Behavior

Native private Home rows now retain **My tasks** and offer **Check status**.
When current personal progress explicitly has no residency request, all three
clients explain that the user must confirm the selected address, apartment and
relationship first. The next action opens the existing joining wizard. Once a
request is saved, status can offer the separate mail-verification journey.
Neither opening status nor saving a request sends a postcard or grants household
access. Ownership keeps its separate next step.

Native status and postal resubmission routes now carry the selected Home into
the wizard. Its immutable target is checked after the current address lookup and
again before submission or ownership handoff. A different existing apartment or
an unknown address cannot create or join a different Home. The entered fields
remain available for correction. Existing protected originals retain their own
identity and recovery; opening generic Add Home still recovers and acknowledges
a previously saved request. Browser joining already had the target boundary.

Visual review also found the iOS confirmation's unit/Optional text crowding the
City label. The shorter Unit label and removal of the redundant Optional hint
when a unit is present keep those fields distinct.

## Actual acceptance and checks

Browser final r3 passes in Chrome at 390 × 844 through production routes and the
real local SDK/SQL: private list entry, failed status read and retry, no-request
next step, wrong existing and unknown apartments, correction, explicit renter
submission, lost committed reply, reload, acknowledgement and current mail next
step. There is one submission POST, one pending claim and one occupancy, with
zero duplicate-Home commands, verified occupants or postcard requests.

Final installed iOS r3 passes the same complete journey, including cold recovery
and the corrected unit label, in 137.285 seconds. The installed launcher and
production dylib match the final source-bound build. Full regression passes
4,379 checks with 168 existing skips and zero failures (4,547 total). The earlier
r2 journey also passed; its screenshots exposed the cramped label. The first UI
configuration inadvertently selected unit tests, was interrupted and is retained
as diagnostics rather than acceptance.

Installed Android r1 and its confirmation continuation pass the journey against
the final Debug APK. The driver initially looked for an unexported dialog test
identifier; the observed labels resolve it without editing the saved form or
records. Existing and unknown apartment refusals had already passed with zero
commands. The continuation confirms unit 606, recovers one original after a cold
restart, acknowledges it through the app and shows the separate mail action.
Actual encrypted preferences contain zero pending creation/joining entries
following acknowledgement. APK hash and production/fixture source hashes match
the build; the driver-only correction is separately bound.

Browser regression passes 93 suites / 1,193 checks. Final web types and changed
page lint, all privacy gates and final changed-source iOS style pass. Android Debug
and Release, Detekt and full Lint pass. Both Android variants pass 515 suites /
4,545 checks, with 80 existing skips and zero failures (4,625 total each). Both
APKs pass signing verification. Exact result inventories, source bindings and
accepted native products are retained privately.

## Evidence and preservation

Private evidence lives under `/private/tmp/pantopus-home-private-first-use-r1/`:
browser UI r3 and regression/types/lint; iOS build r3, UI/result bundles and
attachments; Android build r2, checks r3, UI r1 plus continuation, installed APK
binding and acknowledgement proof. Intermediate failed driver selections,
fixture setup and style attempts remain diagnostic history.

The fixture adds an isolated private creator with pending membership and no
claim to the existing owned creation/submission fixture. It snapshots the full
migration ledger rows and columns plus existing Home context, deletion and
residency review function definitions, OIDs, ownership, ACL and configuration
before applying temporary command functions. Cleanup removes only its exact
synthetic records and temporary schema and compares those preimages. All
six fixtures pass cleanup, including after the final iOS regression; no held
work remains. Both owned native runtimes are stopped with userdata preserved.
The original incomplete first fixture omitted the pending
occupancy required by the production private-setup predicate; it made no
commands and was cleaned before the corrected fixture ran.

No new migration, permanent database adoption, hosted release, physical-device
update or paid activation. Source migration inventory remains 43 Home / 21 paid /
52 combined, with 12 identical shared versions and no timestamp collisions.
Combined replay/adoption remains open. Predecessor `40773d491` has every check
passing in [CI 34706049139](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34706049139).
PR #32 remains a mergeable draft; #34 remains a conflicting draft with passing
checks at its own head. Owner work, databases, devices and private artifacts are
preserved. Paid services remain one final launch bundle.
