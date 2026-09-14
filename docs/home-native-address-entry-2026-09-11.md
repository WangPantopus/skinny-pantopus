# Native Home address entry — September 11

Locally verified native address-entry milestone after `4b2b9a0e2`. Installed
iPhone r8/r10 and Android r15/r16 pass actual production HTTP/SDK/SQL journeys.
H07/H08 and transactional create/join remain open. Verify the new pushed head's
own CI; predecessor `4b2b9a0e2` has every check green in
[CI run 34647390851](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34647390851).

## Resulting entry behavior

Both native wizards use actual geo search/resolve/reverse endpoints, editable
manual address fields and canonical validation. A lookup never supplies
coordinates or substitutes for validation. Canonical ID and coordinates feed
lookup and the existing creation request. Explicit ZIP correction, unit refusals,
unsupported/malformed replies and outages prevent continuation and provide
retry/edit recovery. A valid existing-Home result is required before its flow.
Address validation grants no household authority.

Draft restoration uses a hash of the opening account/session/origin and always
revalidates. Edits, leaving/backgrounding and Android's quick pause retire earlier
address replies. Account/session changes clear inputs, secrets and navigation;
current-session checks surround claim/create replies and each secret write.
Discarded drafts cannot be repersisted by view disposal, including City-only input.
Atomic creation and protected original mutation commands are still pending.

Installed findings drove the keyboard Done/focus repair, contained accessibility
children, current-state Android wizard chrome, system Back confirmation, prominent
errors/Retry/Edit, and scroll reset across steps/errors. Optional property fields
wait for validation. A ZIP correction no longer appears alongside an affirmative
setup verdict. The final confirmation distinguishes address checking from residency
and ownership.

## Current acceptance checkpoint

- iPhone r8 passes the actual manual → provider outage → Retry → ZIP Apply → Role
  journey, missing-unit/malformed/lookup refusals and recovery, and a produced reply
  held across backgrounding followed by fresh validation. Its 113-second result and
  reviewed screenshots are in `/private/tmp/pantopus-home-address-entry-ios-r8.xcresult`
  and `...-ios-r8-attachments/`. Final production build r18 passes. Installed r10
  passes search outage/retry/resolve, City-only Keep going and explicit discard,
  missing-unit refusal → Edit address → Unit 3B → canonical validation (74.7s).
  Its final unit/search/retained-draft screenshots were reviewed in
  `/private/tmp/pantopus-home-address-entry-ios-r10-attachments/`.
- Android r14 reaches Role and passes all three refusal/recovery cases. A quick
  Home/return can skip ON_STOP, so its held-reply lifecycle case fails. The final
  product retires on ON_PAUSE as well. R15 passes on build r10, including full
  sign-in, partial discard, actual search, validation and lifecycle recovery.
  Its final correction/background/revalidation screens were reviewed.
- All five Android installed screen checks pass on the final product in
  `/private/tmp/pantopus-home-address-entry-android-instrumented-r2.log`. They use
  mocked repositories; actual HTTP/SDK/SQL proof is the separate native journey.
- Final Android full regression r3 passes after the lifecycle/copy refinement:
  4,519 passed / 80 skipped in each of Debug and Release, with style, detekt,
  lint, all Paparazzi comparisons and assembly passing (13m11s). iPhone full regression r2 passes 4,357 with 168 skips;
  subsequent production edits are presentation-only and covered by installed r8/r10.
  Strict changed-Swift lint/format r7 plus final shared-alert/driver r10 and privacy gates r2 pass. Four scoped
  Paparazzi references were re-recorded after intentional layout/copy changes and
  visually reviewed. No unrelated reference changed.
- iPhone r6 proves reachable manual fields/error controls but stops at an unexported
  Apply identifier; its accessible label fixes the driver. R7 stops at a remote
  password sheet whose button reports non-hittable and duplicates Not Now. The
  established current-button-frame helper resolves this in passing r8. Build r16
  catches an async test helper inside an XCTest autoclosure; r17 rebuilds the
  corrected separate awaited read and passes. R9 search/discard finds an actual
  iOS popover with only Discard visible; its cancel action is omitted. The shared
  wizard now uses an alert to expose Keep going explicitly; build r18 and installed r10 pass.
  No failed attempt is counted as a pass.

Android unit-edit r16 also passes: missing-unit refusal → Edit address → Unit 3B
→ canonical validation → Role. The production provider boundary receives 3B and
the reviewed confirmation shows that unit. Evidence: `/private/tmp/pantopus-home-address-entry-android-r16/`.

Fixture r5 was stopped gracefully and all reserved ddc238 rows were removed
exactly. Port 18083 is free. Its complete private event history has 1,338 HTTP
requests, 218 SDK reads, 39 canonical/audit inserts, zero fixture errors and zero
Home creation requests. Three expected injected backend errors carry their fault
modes; there are no unexpected backend errors. Full evidence remains in
`/private/tmp/pantopus-home-address-entry-native-events-r5.json`; exact cleanup is
confirmed in `...-native-fixture-r5.log`. No Home/admission write was exposed. Device location permission/acquisition/recovery, atomic creation/join,
primary-home eligibility, truthful success/first-use navigation and R01/R02 remain
open. Owner work/devices, existing databases/products and private evidence remain
preserved. Source migrations remain 39 Home / 21 paid / 48 combined, with no new
migration or permanent ledger change.

## Local evidence and failed attempts

- Actual production geo/validation/lookup routes, decision engine, canonical
  persistence, auditing and SDK/PostgREST pass the HTTP matrix in
  `/private/tmp/pantopus-home-address-entry-http-r2.log`. It verifies canonical
  reuse/ZIP correction, provider outage, missing unit, failed lookup with recovery,
  and actual geo search/resolve/reverse response shapes. Google/Smarty/geo answers
  and sign-in/shell are controlled. Optional external providers are disabled at
  their boundaries. No Home creation or admission occurs in this bounded fixture.
- HTTP r1 omitted required legacy lookup fields in its request; the corrected
  r2 uses the same complete native-shaped payload. Preserve both private logs.
- Fixture r1 missed optional-provider boundary methods; r2 fixed them and passed
  HTTP acceptance. Fixture r3's synthetic Hub omitted required profile-check
  fields; r4 fixed them. Fixture r4 rejected the iOS driver's bodyless reset;
  r5 accepts it. Each stopped fixture reports exact reserved SQL cleanup. The
  active fixture is r5 on port 18083, with its own ddc238 namespace. It records
  actual canonical and audit rows; it exposes no Home/admission write adapter.
- Android entry build r4 passes; focused wizard r2 passes after adding session
  retirement/restoration and held-validation retirement checks. The first focused
  invocation passed 17 checks before those additions. Native journey r1 stopped
  at a notification-prompt navigation race; r2 exposed the synthetic Hub field
  omission; r3 hit Android's old-task removal timeout during debug-app reset.
  Startup evidence shows Android killed the newly launched process while removing
  the old task. The driver now retries that launch once. Installed r4 is running.
- iOS focused r1 failed on obsolete test helper names; r2 passes 25 checks, and
  final focused r3 passes 27, including delayed validation/session retirement.
  Address-entry signed builds r1/r2 pass. Strict changed-file lint passes after
  correcting test closure syntax. A first lint invocation used obsolete `--path`;
  the supported positional-path invocation is preserved separately.
- iOS installed r1 stopped on the fixture reset error; r2 stopped during initial
  prompt handling and was reported as a signal-kill interruption. Installed r3
  reached manual entry and failed because City could not be reached with the
  keyboard open. Its screenshot and hierarchy are preserved in
  `/private/tmp/pantopus-home-address-entry-ios-r3-attachments/`; the new keyboard
  and navigation repair is in signed build r3.

All detailed logs, result bundles, screenshots and provider/SQL evidence stay in
`/private/tmp/pantopus-home-address-entry-*` or the earlier
`/private/tmp/pantopus-home-onboarding-*` files. Prior accepted native products
and the generated iOS project were APFS-cloned under
`/private/tmp/pantopus-home-native-artifacts-before-onboarding/`. No migration,
ledger rewrite, hosted mutation, real message, paid activation or owner-data change.

## Continue

Installed search/manual/validation/unit-edit acceptance is complete for this
bounded milestone. Finish device location permission/acquisition/cancellation
and recovery, then atomic retained create/join commands, lost-reply/restart
recovery and truthful first-use destinations. Native residency and the full inventory
remain next; this candidate is not completion of H07/H08/R02 or launch.

## Recovery refinement in progress

Android builds r5/r6 pass, including the scoped system Back/discard changes;
focused r5 passes 21 checks. iOS build r5 caught a missing helper declaration in
an intermediate edit; the corrected r6 is building. Entry disposal cannot
repersist a discarded draft. Partial city/unit/ZIP entry also counts as dirty.
The iPhone keyboard Done action covers both manual fields and search.

Android installed r4 selected an unexported test tag; r5 then sent Back after a
search tap that had not focused the field. R6 checks focus explicitly and failed
at that first tap. A separate tap on the observed editable control in the same
installed build focused it successfully; the driver now retries a field tap on
fresh UI state, verifies the intended editable rectangle and entered text, and
hides the keyboard only when Android reports it shown. These failed attempts do
not establish completed address-entry acceptance. Installed r7 uses build r6 and
also exercises system Back, keeping a partial draft, and confirmed discard.

The iOS r3 hierarchy shows the unreachable City field below the keyboard and
sticky CTA; its failure is a concrete UI finding. The repaired layout and keyboard
controls still need a complete new installed journey. No scope is marked complete
from a build or unit result.

### Current continuation after r4 iPhone / r10 Android

Origin was fetched again: master `6a1013784`, Home `4b2b9a0e2`, paid
`e9ef2decb`. Both draft PR heads have passing checks; #34 still conflicts.
The owner checkout and paid checkout remain preserved. No merge or migration.

Android now passes current-state chrome explicitly to the wizard shell. Installed
r9 proves system Back protects a City-only draft and confirmed discard does not
restore it. Earlier r7/r8 exposed the missing/stale discard behavior. R9 then
stopped because the shared button driver climbed from a field label to the entire
clickable keyboard-dismiss panel. The corrected field driver targets the actual
EditText. R10 passes search outage/retry/resolve, but its replacement helper read
the separate label node's empty text and appended to Street. R11 targets and
checks the focused EditText value exactly; it is running on final Android build
r8. No failed driver run is counted as completed product acceptance.

Both apps now restore partially entered manual fields visibly. Discard cannot
repersist through disposal. Android focused r8 passes 22 checks and its installed
test bundle compiles after adapting the existing tests to canonical validation
and scoped identity. The dirty-close test now edits after composition and the
Continue test checks the actual rendered control. Four intentionally changed
Paparazzi references were recorded and visually reviewed; full regression is
running. No unrelated snapshot baseline was changed.

iOS focused r4 passes 24 view-model checks (without the four structural render
checks); the partial-restoration case was added afterward. Signed build r8 passes.
Installed iOS r4 proves the keyboard Done control is visually present, but it is
absent from the accessibility tree; the shell's identifier also replaces child
button identifiers. The next candidate places Done in the app footer and contains
the shell/search accessibility groups so controls retain their own identifiers.
Signed build r9 is running; installed acceptance remains incomplete.

Latest private evidence stays under `/private/tmp/pantopus-home-address-entry-*`,
including iOS r4 attachments and its live keyboard screenshot. Fixture r5 remains
active on 18083; stop it gracefully and confirm exact ddc238 cleanup after the
accepted journeys. The HTTP r2 proof does not imply actual location-permission
acceptance. Device location acquisition/denial, atomic original create/join,
restart/lost replies and useful first-use completion remain required.

### Recovery layout refinement after installed r13

Android r11/r12 stop at a clipped ZIP field: UIAutomator exports the label and
EditText separately with different clipped bounds. The driver now scrolls until
the actual editable control is reachable. R13 continues the already signed-in
form and proves complete manual input, safe provider outage, Retry and an explicit
ZIP correction with Continue disabled. Apply was still partly behind the sticky
header because scroll position survived the preceding step/retry; this run is not
a complete pass. Its screenshots also show optional property fields before the
validation error. Both clients now reset scroll on step/error transitions, show
errors and recovery controls first, and defer property details until address
confirmation. ZIP correction has a direct confirmation heading.

iOS r5 stops at overlapping Save Password / Face ID prompts with identically
named Not Now buttons. The driver selected the hidden lower button; it now picks
the reachable button and handles prompts after restored login too. The screenshot
and both alert hierarchies remain private. Build r11 passes; final recovery-layout
build r12 is running. Installed r6 is next. Android layout build/snapshots r9 is
running; its earlier r8 product remains the installed evidence so far.

The iOS regression on build r9 passes 4,357 checks with 168 skips. Android r1
regression found dead sample UI and style findings; those are repaired. R2 passes
the Debug checks (4,519 passed, 80 skipped) and style/lint, then was deliberately
stopped during Release compilation after the new recovery-layout change. It is
not a completed final regression. No scope is marked complete from these runs.

Creation review also confirms that the current primary-home switch is retained
in the draft but never sent by either create request. Its default-mail/notification
promise must be reconciled with actual primary-residency eligibility in H07/H08.
The existing success email/verification copy, retained create/join commands and
atomic server writes also remain open; no creation is exercised in this fixture.
