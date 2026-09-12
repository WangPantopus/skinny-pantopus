# Android existing-Home joining and personal status — September 12, 2026

Accepted locally after `a528c54a1060d7d1ef3023d0423d912c9b366af1`. All five
installed joining/status journeys and all three existing creation regressions
pass on the preserved candidate APK. Both exact database fixtures are cleaned.
Pushed-head CI must be checked independently before any merge.

## Resulting behavior

The wizard retains the original existing Home, complete selected street/apartment,
ordinary role and request UUID in the same account/origin-scoped encrypted slot
used by creation. Original bytes survive process death. Unreadable storage,
unknown transport and failed result persistence retain recovery controls. Server
cancellation must be confirmed before editing. Joining uses the atomic residency
submission API; the legacy discovery-mutation dependency is removed from this
wizard. The existing-Home dialog no longer asserts verified membership.

My Homes reads personal request history separately from current Home entries.
Submitted addresses remain distinct from private current Home identity. Removed
and unlinked historical requests remain visible. A recorded review never labels
current access. The list offers explicit pagination/retry controls and preserves
usable rows when the other read fails. Session and lifecycle changes retire old
responses and navigation. List and residency deep links reach a current-status
screen with separate household review, address verification, resubmission,
ownership and access-review destinations.

## Actual installed acceptance

All accepted captures use the same production Kotlin sources and APK. HTTP routes,
Joi, services, SDK and SQL are real on the isolated loopback stack; sign-in,
address providers and notification transport are controlled.

| Journey | Accepted private run | Result |
| --- | --- | --- |
| Cancel original joining before delayed admission | `ui-r4`, resumed original from r3 | No claim or occupancy; original unit remains editable |
| Selected apartment changes before submission | `ui-r4` | Refusal retains original apartment and grants no access |
| Lost joining reply, restart, status/read recovery, approval then removal | `ui-r6` | One POST; failed/malformed reads hide old actions; late approval cannot restore removed access |
| Resubmit rejected residency | `ui-r7` | Existing records reused, household role retained, pending review without Home access |
| History beyond 50 and failed-read retry | `ui-r10` | Final row 50 appears after explicit Load more; fresh failure and retry work |
| Existing creation cancellation | `create-regression-r1` | Delayed worker cannot create the cancelled Home |
| Existing creation lost reply/restart | `create-regression-r3` | One POST and one original Home |
| Optional setup refusal and corrected creation | `create-regression-r3` | Entire initial creation rolls back; new confirmed attempt retains setup and distinct apartments, without verified occupancy |

The run prefixes above expand under `/private/tmp/pantopus-home-android-residency-`.
Each retains screenshots, UI hierarchy and private HTTP/SQL state. Successful
subsets in interrupted runs remain distinct from their later failures. Final
cancellation, changed-address, resubmission, removal, pagination and corrected
creation captures were reviewed individually.

Initial driver attempts exposed badge/modal selector differences, menu scrolling,
and a Load more control reported by the inspector below the visible content area.
R10 checks visible bounds before tapping; request evidence confirms actual page
loading. A combined image preview appeared clipped, but the original image and
bounds were correct. No product defect was established by that preview.

UI inspection also suffered a killed inspector and later shell/screen timeouts.
A targeted ADB reconnect and guest reboot did not fully stabilize it. Cold-starting
only the owned AVD without loading or saving snapshots restored fresh inspection
in 2.16 seconds; the remaining creation journeys then passed. The idle owned iOS
simulator was temporarily shut down to reduce resource use. No app data, auth
storage or snapshots were cleared. The finished Android AVD is now stopped with
userdata retained. Runtime diagnostics and original launch arguments stay private.

## Regression, quality and source binding

Debug and Release each pass 513 suites: **4,535 passed, 80 skipped, zero failures**.
The combined regression/assembly run took 4 minutes 14 seconds. Targeted regression
passes 158 checks across seven suites with no skips. Ktlint, Detekt, changed-file
formatting and privacy pass. Android Lint passes in 3 minutes 7 seconds with one
worker and a command-only 10 GiB heap. Its earlier 6 GiB run exhausted the disposable
Gradle heap after Ktlint/Detekt finished; no project rule or baseline was disabled.

Private evidence includes `compile-r{1,2}`, `quality-r{1,2}`, `regression-r1`,
`regression-r1-summary.json`, `style-r1`, `lint-r2`, `privacy-r1`, `install-r1`,
`runtime-recovery-r1.json`, and all named installed runs. The previous APK outputs
remain under `/private/tmp/pantopus-home-native-artifacts-before-android-residency/`.
`app-r1.apk` is the retained installed binary. `source-build-r1.json` binds its
production sources; those hashes and the APK hash still match exactly.
`source-evidence-r2.json` binds final Android sources/driver and accepted evidence.

Both `fixture-r1` and `fixture-r2` clean their exact synthetic records and temporary
command schema/functions, preserving ledger `20260910220000`. No source migration
was added: 43 Home / 21 paid / 52 combined, 12 identical shared migrations and no
timestamp collision. Combined replay/adoption remains separate unfinished work.

## Remaining scope and preservation

Native postal and prepared household review, legacy compatibility, invitations,
private first use and the wider backlog remain open. New private Homes still need
an explicit verification entry and an ordinary selected-address request before
mail when no claim exists; ownership is separate. H07/H08/R01/R02 are not closed.
Postal navigation on Android still reaches its older native client.

The separately built iOS postal candidate remains uncommitted and is excluded from
this milestone. Continue its actual installed acceptance next. Owner checkout,
other worktrees, databases, devices, earlier artifacts and private evidence are
preserved. Physical iPhone stays verified Pantopus 1.0.0 (2). Both PRs remain drafts;
no merge, hosted deployment or paid activation. Paid services and dedicated postal
keys remain one final launch bundle.
