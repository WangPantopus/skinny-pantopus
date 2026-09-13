# Android protected member removal — installed recovery and reader follow-up

September 13, 2026. **Candidate `r1` passes the installed five-original recovery
matrix. Final source `r8` / candidate `r2` passes both full variants, optimized
codec runtime and the separate installed zero-command reader/count follow-up.**
This report does not close R03 or establish deployment readiness. The accepted
[four-platform removal baseline](home-member-removal-baseline-2026-09-13.md)
and [Android ordinary-member Task journey](home-android-member-onboarding-2026-09-12.md)
remain separate evidence.

## Reproduced predecessor

The retained H07 Android Debug APK passed actual normal login, named member
selection and confirmation cancellation with zero DELETE requests. One confirmed
removal then committed one real SDK/SQL operation and one removal audit, but its
complete HTTP 503 reply made the app silently restore the stale member row and
count. A failed fresh roster read retired that content; explicit read retry
showed the actual removal. The removed member's fresh My Homes list contained
zero current Homes and separate recorded residency history.

Baseline `ui-r1` stopped before DELETE on a driver label assumption. Its corrected
`ui-r2` continuation preserved that failure and completed the actual boundary.
All five preservation checks and all 366 populated tables passed exact cleanup;
the owned emulator was stopped with its installed APK and userdata retained.
This baseline did not prove re-admission or deletion of renewed membership.

## Candidate behavior

Members Remove and the existing self-leave entry now use the dedicated prepared
member-removal protocol. The review binds the current Home, authorized household
username, occupancy identity, effective role, membership dates and opaque review
token. All eight canonical roles are accepted. A null historical role is allowed
only for the actual current actor's self-leave; a non-null private account name
is rejected rather than used as a household identity label.

The exact original request JSON is retained before dispatch in one encrypted
slot per account and API origin. Check, exact Retry and cancellation recover
that original. Typed terminal proof is bound to the actor, request UUID, Home,
target, occupancy and reviewed token. Nonreceipt failures and malformed data
leave the original unresolved. Cancellation does not undo a completed removal.

The new recovery entry remains available in Members and My Homes independently
of loaded rows. Account and lifecycle changes retire review, confirmation and
current roster state while retaining the encrypted original. Storage checks the
current lifetime inside its mutex immediately before commit, including queued
original, receipt and acknowledgement writes. Backup and device-transfer rules
exclude the new encrypted preference file.

Historical results do not establish current access. A separate current roster
read requires a valid matching Home on every returned row and rechecks the live
server session before publication. Failure leaves current membership unconfirmed.
Acknowledgement clears only the original; navigation and fresh readers determine
which Home and member rows are currently available. Existing invitation sharing,
invitation recovery and private Task protocols are unchanged.

## Verification completed so far

Focused run `r7` passed Debug production/test compilation, ktlint formatting and
checks, detekt, and **85 tests with zero failures or skips**:

- 19 coordinator tests, including lost reply, exact replay, retained proof,
  acknowledgement and delayed original/receipt/clear lifetime transitions.
- Seven strict codec tests, including canonical roles, username-only identity,
  malformed context/receipt and missing or foreign roster Home identity.
- Five HTTP transport tests and five view-model lifetime tests.
- Five persistent-store tests using the actual store mutex and commit path with
  controlled preferences; these do not substitute for installed encrypted storage.
- 44 existing/updated Members-list tests, including review without optimistic
  removal or a legacy DELETE.

The source binding covers 3,040 Android files. The initial diagnostic formatting,
static-analysis and compiler failures remain in the private evidence; they are
not acceptance results. `r7` is a focused source boundary, not a signed APK or
exact-head CI result.

Both full Debug and Release candidate `r1` variants pass **4,622 tests / 80 skips
in 523 suites each**, with zero failures or errors, Android lint and APK assembly.
Release R8 and resource optimization pass. Both APK signatures verify; the
optimized Release uses the local acceptance certificate and is not production
signing proof. The preserved products, mapping and XML results are bound to the
unchanged focused source at parent
`1a475708468c1f7e46583c476301f3a106117d77`; this is local Android proof, not
installed acceptance or exact-head native CI.

The installed candidate `r1` uses that unchanged source and signed Debug APK.
Two deliberate phases (`ui-r1` and `ui-r2`) finish **five originals: two completed,
one cancelled and two rejected**, through six command POSTs, with all originals
acknowledged and zero legacy DELETE requests:

- Review confirmation cancellation and Close issue zero commands. One member
  removal commits and loses its reply. Close before acknowledgement performs
  a fresh roster read; controlled 503 retires rows and management controls across
  Pending/Member tab changes, and explicit read retry reaches actual 200 while
  the original remains retained. Cold explicit Retry sends the identical UUID
  and exact request-body hash, returning one command and one removal audit.
- A separate unsubmitted original survives normal account changes. The other
  account cannot see it; the owner returns and cancels it without removing the
  member. Real member→guest→member role changes invalidate another prepared
  removal. A real management-permission denial rejects another original;
  restoring authority does not rewrite that rejection on cold recovery.
- The primary owner is refused before creating an original. An ordinary member
  uses the existing Settings self-leave entry, loses the committed reply, and
  recovers the historical result from My Homes after access ends. Current roster
  403 remains unknown beside the historical receipt. Acknowledgement leaves zero
  current Homes and separate recorded applicant history.

Actual SQL proof verifies manager removal becomes inactive and self-leave becomes
moved_out, both with ended access and cleared management flags. Current overrides,
active grants and issued letters are ended/revoked as appropriate; prior ended
or revoked records and independent member rows remain unchanged. Claims, original
review receipts and ownership rows are exactly preserved. The deliberate role
and authority scenarios have their own expected audit/legacy-flag changes. A
read-only verifier initially expected inactive for self-leave; its assertion was
corrected to the established moved_out result without changing product or data.

The separate zero-command `ui-reader-r1` holds the actual serialized successful
roster response after query, observes tabs before delivery, then releases the
identical body hash and bytes. It reproduces a remaining reader defect: Loading
keeps old counts and management authority, and a Pending→Members roundtrip
re-publishes cached rows and menus before that response arrives. The earlier
503 capture also shows false known-zero Member/Guest counts. These are reproduced
failures, not passing freshness claims. The bounded source follow-up now retires
rows/counts/authority on new reads and removal-recovery entry, preserving real
confirmed-empty zero and the protected original independently. Source `r8`
passes 48 focused Members tests, ktlint and detekt. Its full Debug candidate `r2`
passes 4,626 tests / 80 skips in 523 suites, Android lint, APK assembly and signature
verification. Release passes the same 4,626 tests / 80 skips in 523 suites, lint,
R8/resource optimization, assembly and signature verification. The three-file delta
changes only Members list publication, recovery entry retirement and corresponding
tests. Both final products remain bound to parent `1a475708468c1f7e46583c476301f3a106117d77`
and the 3,040-file source manifest; no command protocol file changed after the
accepted five-original matrix.

The final installed follow-up preserves the earlier command matrix. `ui-reader-r2`
passes normal owner login but stops before a held read or command because the
private driver expected count text inside the semantic label node. The actual
hierarchy exposes sibling text within the same clickable tab; the visible counts
were already correct. The corrected driver-only `ui-reader-r3` continues that
same logged-in six-member fixture and passes:

- Two real successful roster responses held after query/serialization, with the
  same body hash and byte count released. Loading and Pending→Members tab changes
  show no cached rows, member controls, management authority or known counts.
- Independent removal recovery followed by Close starts a new read; its held
  response leaves the previous roster retired across tab changes. Released 200
  restores the confirmed six-member roster and genuine zero Guest/Pending counts.
- Actual roster 503 keeps counts unknown and rows/authority retired across tabs.
  Recovery remains accessible, Close with a continuing failure stays unknown, and
  explicit Try again reaches 200 and restores confirmed counts. A confirmed empty
  Guests list visibly keeps zero and its appropriate empty state.
- Zero new removal, sender or recipient commands, zero legacy DELETE requests,
  all protected slots empty, and unchanged owned membership, audit, claim, receipt,
  letter, grant, override and ownership state.

The ordinary list/error/count captures have readable raster proof. The empty
recovery dialog remains protected; its entry and Close have hierarchy/action and
HTTP proof, without disabling secure capture. This bounded follow-up does not
repeat or retroactively broaden the earlier five-original command journey.

The fixture is exactly cleaned: all five preservation checks pass across 374
candidate and 366 retained tables, catalog identity is preserved, and the
candidate database is retained. Fixture and owned emulator exit zero, port 18084
is closed, and installed app/userdata remain retained. No new admission or
future renewed-membership scenario was invented. Independent root review also
verifies unchanged domain snapshots and complete candidate/retained logical
snapshots. Its first raw comparison stops on six PostgreSQL `pg_class` row/page
estimate differences; the final comparison excludes only the previously
documented physical maintenance fields (`relpages`, `reltuples`, `relallvisible`,
`relallfrozen`, `relfrozenxid`, `relminmxid`). No logical row or domain fields are
excluded. This is logical/catalog-identity preservation, not byte-identical
physical PostgreSQL maintenance metadata.

The candidate `r1` optimized Release APK passes an offline `app_process` codec probe for
twelve records: eight accepted sender/Task records plus removal intent, request,
unresolved original and historical proof. The probe binds the actual final R8
Moshi initializer bytecode, retains exact request/receipt strings and round-trips
all fields. It installs no Release APK, launches no app and contacts no fixture.
The retained H07 Debug APK and every preference-file hash remain unchanged;
there is no running app process before or after. The owned emulator exits cleanly
with userdata retained. This codec proof does not replace installed UI or real
device keystore acceptance.

## Verification limits and evidence

Final reader/count source, both variant/signature bindings and zero-command
installed before/after proof pass. The final candidate `r2` optimized Release also
passes the same twelve-record `app_process` probe, freshly bound to its actual R8
bytecode. The installed predecessor removal Debug APK and every preference hash
remain unchanged during that offline probe; no app is launched and no fixture is
contacted. Candidate `r2` is subsequently installed with `-r`, retaining userdata.
Both final signatures use the local acceptance certificate, not production release
signing. Command acceptance remains bound to candidate `r1`; the later build
does not retroactively broaden it. Exact-head native CI is an integration gate
owned by the parent task and is not established by these local results.
Capture protection is retained. Secure review/dialog raster capture returns
zero-byte artifacts; reviewed identities and actions there have actual hierarchy
and HTTP/SQL proof, without complete raster identity proof. Unprotected roster,
error and Settings captures are readable and retain root visual review.

One existing Settings defect is also open: `HomeSettingsViewModel.apply`
uses an Owner footer and Verified address chip for every nonpending Home. That
is not effective-role or independent residency proof for an ordinary member.
The candidate's self-leave review uses fresh actual membership context; any
Settings capture records the existing captions as a limitation, not as
current-identity acceptance. The ordinary-member self-leave screenshot visibly
shows the false Owner footer. Its Verified address chip was outside that capture
and remains a source finding; it is not accepted proof of independent residency.

Private working evidence is under
`/private/tmp/pantopus-home-android-member-removal-r1/`, including
`focused-r7/binding.json`, `prepared-tools-binding.json`, the diagnostic logs,
driver and probe. The completed baseline is durably retained under the private
operator index's `member-removal-20260913/android-baseline-r1/` directory.
Candidate `r1` source/products/gates and installed evidence are durably retained
under `member-removal-20260913/android-recovery-r1/product-gates-r1/` and
`installed-candidate-r1/`. Final reader source/products/full gates/optimized probe,
failed parser predecessor, installed continuation and exact cleanup are retained
separately under `reader-candidate-r2/`. The final report and root-review binding
are preserved in the small `reader-reviewed-report-r3/` supplement. Every copied
file is SHA-256 checked.
Credentials, raw tokens, database archives and operator logs are excluded from Git.
