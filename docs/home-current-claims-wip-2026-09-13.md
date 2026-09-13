# Current residency-claims privacy acceptance — September 13

Privacy/recovery acceptance is complete at the source bound below. The presentation reconciliation described at the end changes six existing view files; its own checks and limitations are recorded separately. PR #36 targets the primary Home branch and remains a draft until final CI and integration finish. Accepted application source is `4d4183a79111ba06f1df8e713dbcbc4dd9502ad8`; final documentation follows separately. No production/provider activation or permanent adoption of the retained database is claimed. Primary still needs this repair integrated before its raw-claims exposure is resolved.

## Resulting behavior

The additive, service-only migration `20260913030000_home_current_residency_claims.sql` projects pending requests after fresh authority checks. It locks the Home and projected profiles before checking the current clock. Success and error responses use private no-store headers. Each consumer binds reads to the current Home, actor and session, and validates the complete result before displaying rows or confirmed emptiness.

The projection exposes public usernames and `name: null`, with explicit nullable requested roles and dates. It never returns raw claimed addresses or private hydrated names. Legitimate legacy unknowns remain unknown; no date, relationship or historical row is backfilled. Ordering is date descending, nulls last, then UUID descending. Duplicate claim or applicant IDs fail closed.

Both browser consumers—the Members & Security panel and owners/review-claim page—and dedicated iOS/Android consumers use this contract. Residency loading is independent of ownership/comparison loading. Failed reads, account changes, backgrounding, tabs, navigation and protected-review presentation retire old rows. Selecting a row rechecks the exact current claim before opening the established protected review workflow.

## Actual workflow acceptance

The populated upgrade passes in one outer rollback, preserving all 366 retained tables, functions, permissions and prepared originals, with zero SQL lint issues. A separate schema/reference candidate hosts the actual acceptance fixture; the retained populated database is not permanently upgraded.

Nine actual HTTP/source-loaded SDK cases pass. Six real protected submissions populate the queue. Both SDK entry points agree with safe SQL projection and complete ordering. Cases cover authorized emptiness, anonymous/unauthorized reads, unknown Home, session mismatch, unavailable service/retry, permission changes, ordinary same-account login rotation, expiry during observed Home/profile lock waits, and original serialized old 200 delivery after newer 403.

Both actual Chrome consumers pass populated privacy/order/legacy-null presentation, ownership-tab independence, service error versus empty, explicit retry, exact protected selection, and delivered old 200 responses after newer 403 without restored rows. Normal second-tab logout/applicant sign-in, lifecycle revalidation and cold reviewer return also pass. Browser lifecycle events are deliberate pagehide/pageshow signals, not OS window-background proof. Queue-only intervals preserve SQL state; authority setup uses the real owner permission endpoint.

Installed iOS passes the six-request journey, exact protected selection, service recovery, actual background/foreground, cold restart, ordinary account change and delivered old 200 after newer 403. All 679 installed signed app files remain unchanged. Three observed protected-original stores are empty at the corrected installed-run start and afterward.

Installed Android passes complete public username order, explicit unknowns, exact protected selection, service recovery, actual background/foreground, cold restart and ordinary account change. The held-read case records matching serialized-body hashes and actual server completion of old 200 after newer 403, while the current denial stays visible. The Debug APK remains unchanged; all 16 preference files survive installation unchanged, and seven observed protected-original stores remain empty. Protected dialog screenshots retain their secure-window limits; actual semantic hierarchy and selected HTTP route supply the review-selection proof.

After every populated reader passes, six real protected HTTP rejections drain the queue. Membership, ownership, submission and removal rows remain unchanged. Both browser consumers and both installed native apps then show confirmed empty queues. These are actual decision outcomes, not fabricated empty responses or a fixture reset. The earlier separately accepted native fresh applicant/reviewer cycles are preserved and are not repeated or claimed again here.

## Product and source checks

- Isolated browser dependencies resolve this worktree's API/types/utils. All 1,324 browser checks in 103 suites and zero-error web type checking pass; the later duplicate-applicant guard passes 14 focused checks. Standalone API checking retains the same 39 baseline diagnostics as primary, with no candidate-only diagnostics.
- Signed iOS r2 products pass 31 focused checks and full regression: 4,471 passed, 168 skipped, zero failed. All 1,263 preserved product files are bound to frozen source.
- Android Debug build/lint and 44 focused checks pass. Full Debug and Release suites each pass 4,661 checks with 80 skipped and zero failures. Signed Release assemble/lint, ktlint and Detekt pass. An offline probe of the actual optimized Release APK preserves twelve protected-record codec samples; it neither installs/launches Release nor accesses the fixture, and leaves the installed Debug APK and preference hashes unchanged.
- Combined backend checks pass 77 tests in four suites. Migration reconciliation is 50 Home / 21 paid / 59 combined versions, with 12 byte-identical shared versions and zero collisions. The only addition to primary's 49 Home versions is `20260913030000`; generated wrapper consistency and migration policy pass. Combined paid/Home populated replay and permanent adoption remain G03 work.

Earlier exact source `52fa96c65` passed all 16 checks in [CI 34774733863](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34774733863). Application candidate `4d4183a79` passes [CI 34779388555](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34779388555), with 15 successful checks and one unchanged Seeder skip. Verify the final pushed head independently before integration; local workflow acceptance does not substitute for CI.

## Preservation and evidence

Exact cleanup passes: all 374 candidate tables, all 366 retained tables, full role rows, migration ledger, function properties and retained catalog are preserved. The candidate database remains available. Both owned native devices, the API, Next server and owned current-claims REST container are stopped, with userdata and protected stores retained. The private operator index records the released leases.

Durable evidence is beneath `.pantopus-recovery/20260907/home-invitation-handoff-20260912/residency-cycle-20260913/` in the owner's checkout. The HTTP/browser archive contains 9,103 files with manifest `6d4dfbe0c3cc151900ed0adffe983a013285bfffbde96a7f1d0e8036cc88595e`. The iOS reader archive contains 15,915 files with manifest `f545f67c9e129fafcd389ef652d068daae425143a6198cd345efe8ab878e996e`. The final acceptance archive adds Android products/readers, all empty transitions, fixture/runtime bindings and cleanup: 5,191 files, manifest `8d1ac16c0c8f57f12ece2c98f252ae2cbf9515fe3ef7966785e7ddf56967ff5d`. Source and durable destination hashes agree; the private operator index records each archive.

Preparation failures remain distinct from product results. Fixture metadata/port guards rejected invalid startup; private browser drivers initially used a wrong heading and skipped the ordinary logout before a second sign-in; the private XCUI runner needed an awaited read outside an assertion autoclosure. Its initial test descriptor still named the history predecessor; an installed-binary comparison caught this, all dependency paths were corrected, and all 679 candidate app files were verified for the successful run. The first pre-run Keychain query used a wrong filename; later explicit observations are retained. Android's reduced in-process compiler heap failed before the repository memory settings succeeded, and a test encoder needed explicit JSON null serialization. No failure is silently relabeled as a pass. Credentials, raw tokens, database archives, operator logs and local dependency links remain outside Git.

## Existing-design restoration — September 13

The source diff against primary application head `4e966835f` showed that the
privacy repair also unified two different web card layouts and replaced the
native illustrated empty states with plain text and new explanatory headings.
Those decorative changes were unnecessary to the safe-reader contract.

The repair keeps the same existing components and restores the Members panel's
yellow border, gradient initial avatar, compact review links and flat wrapping
row. The separate review page retains its original neutral avatar, card spacing,
relative-date position and full-width Approve/Deny actions with icons. Both
native queues reuse the existing illustrated EmptyState and original card spacing;
public-username initials replace the generic question mark when available.
Unnecessary duplicate queue headings/counts are removed. Explicit reload remains.

Private names, photo URLs and claimed addresses are not restored. Safe usernames,
unknown date/relationship labels, private transport, current session/authority
validation, stale-response retirement and exact protected-review navigation remain.
No controller, model, API, service, SQL, receipt or command-store bytes change.
The only test edits adapt accessible action names to the restored visible labels.

Validation:

- The existing 14 browser queue checks pass, including stale sessions/responses,
  malformed results, duplicate applicants, tab changes and exact review selection.
- Final web TypeScript checking and focused ESLint pass with zero diagnostics.
- Actual Chrome renders of the real Next/React consumers pass eight bounded
  checks: populated views at 320/390/1024px on both surfaces, plus unavailable
  clearing and explicit retry to confirmed empty on both surfaces. Screenshots
  were inspected. Responses are intercepted synthetic fixtures; this is rendering
  proof, not another real HTTP/SQL or provider acceptance run.
- The first renderer setup lacked a synthetic signed-in session; it is preserved
  as a preparation failure. A later narrow-width check caught a row grouping
  overlap introduced during restoration; restoring the original flat row fixed
  it. The final eight checks pass. This evidence is not represented as a defect
  in the previously accepted privacy controller.
- Android ktlint and Debug Kotlin compilation pass after correcting four local
  formatting diagnostics. No emulator or device is started or updated. Swift
  parsing and formatting pass for the two changed iOS view files; final iOS
  compilation and regressions belong to the new CI head.
- Existing installed-native privacy/recovery evidence remains bound to its old
  signed products. New installed-native screenshots, dark mode and Dynamic Type
  acceptance are not claimed here; release-wide U02/U05 remain open.

Private rendering/check evidence is in `/private/tmp/pantopus-claims-presentation-r1`,
with a hash-verified durable copy under the owner checkout at
`.pantopus-recovery/audits/20260913-claims-presentation/`.
The temporary render-only route is removed and its source retained privately;
Next's automatic tsconfig edit is restored. The owned server on port 18186 is
stopped. An initial occupied-port startup was refused without touching its owner.
Existing database state, devices, signed products and private evidence are intact.
Final pushed-head CI must pass before integration; do not repeat accepted
backend/database journeys for unchanged application contracts.
