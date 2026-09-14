# Android Home task-to-Gig publication — September 10, 2026

## Result and next action

Android now has explicit public review and protected original/confirmation
recovery for saved Home tasks. It uses the already committed ordinary Gig
publication transaction. Final installed app → production HTTP/service → local
SQL acceptance passes, including original-command recovery, current Gig states
and access revocation. Core conversion is now implemented and exercised on web,
iOS and Android within the limits below. PRs #32/#34 remain unfinished drafts;
exact-head remote CI is still required. Paid services remain one final
launch-preparation bundle.

After this checkpoint, continue claimant relationship decisions and residency
receipts, then ownership transfer/challenge and lease/resource cleanup. The
current `homeOwnership.js` relationship route sends invitations through the
existing merge transaction, but decline/flag still separately check authority,
write claim/resolution state and audit without a command receipt. Preserve the
completed invitation and claim-evidence work when addressing those remaining
paths. Final combined migration reconciliation/replay and release acceptance
remain open.

## User-visible behavior

- A saved editable task opens **Review Gig publication**. Public title,
  description, budget and address start blank. Copying the household title is an
  explicit action. Private files, mail and Home coordinates are not copied.
- The form supports a positive USD budget with at most two decimal places,
  category, explicit searched/resolved work location and cancellation policy.
  Changing a public field or selected location clears the review checkbox.
  Publishing requires a fresh review and valid fields.
- A dedicated Android Keystore / EncryptedSharedPreferences store saves the
  exact original before POST. The saved slot binds API origin, actor, Home and
  task. It has no plaintext fallback and is excluded from cloud backup and
  device transfer. Compare-and-replace and per-scope serialization prevent a
  second screen from overwriting an unresolved original.
- Current session/authority and protected storage are checked again before
  dispatch. Backgrounding hides private content and cancels pending work;
  account invalidation clears visible input. An unknown response preserves the
  original. A definite stale-source rejection requires review of the current
  task before another command. Confirmations survive process death until the
  user acknowledges them.
- **Open Gig** rechecks current task access and its exact Gig link, then uses
  the real native destination. Recovery never rewinds a later cancellation or
  price change. Publication does not assign a helper, complete the private task,
  activate recurrence or charge a card.

The private dialog retains `FLAG_SECURE`. Keyboard fields use separate labels
to avoid the previously diagnosed theme interpolation crash. The fields and
review checkbox expose meaningful accessibility labels.

## Gig detail repairs

Both Android V1/V2 layouts now use the current server lifecycle. A poster cannot
bid on their own open task; closed tasks cannot show an actionable bid control.
Applicable worker delivery and owner tip controls retain their existing gates.
Bid submission, editing and sheet presentation also check current eligibility.

The detail preserves the actual category label, removes unsupported verified
address/local-job/payment/hiring/ranking/viewer claims and renders “Just posted”
without a nonsensical age suffix. This mirrors the defects found and repaired in
the preceding iOS milestone, without claiming payment-flow acceptance.

Installed Android inspection additionally found that the shared custom dock
removed its click handler when disabled but exposed neither a disabled state nor
a button role to assistive technology. It now uses an explicitly enabled/disabled
button action; the secondary control also respects its own availability and
callback. Final installed verification asserts the actual parent control,
not the always-enabled child text label.

## Installed acceptance and evidence

The reproducible driver is
[`scripts/android/home-task-gig-journey.py`](../scripts/android/home-task-gig-journey.py).
It verifies the dedicated `Pantopus_Home_Recurrence_Acceptance` AVD on API 34,
clears only its debug app, signs in through normal UI and opens exact OS task/Gig
links. The native fixture uses the shared production Express/Joi/service route
against the isolated 33-migration PostgreSQL database. No owner emulator or
hosted data is changed.

**Final r5 passes** keyboard public entry, category changes, explicit location
selection, policy/review invalidation and stale-source rejection with zero Gig
created. A later successful POST loses its reply; its encrypted original survives
process death and retries with exactly the same full JSON. A cancellation and
price change made after publication remain intact. A second process death
recovers the confirmation without a new POST.

The driver corrupts only the owned publication ciphertext, preserving the
Keystore metadata, then restarts the app. A visible storage error replaces the
private source and all publish/retry/open controls. Restoring the exact original
bytes recovers the confirmation without a new command. Both the encrypted bytes
and installed recovery behavior are checked; no plaintext fallback is used.

The real destination shows the exact current Gig. All ten installed screens
(open/assigned/in_progress/completed/cancelled × V1/V2) pass current status,
$30 price and disabled-action checks. All ten screenshots were visually reviewed,
as was the initial recovered cancelled destination. The actual dock parent now
reports `enabled=false`. The map has no provider tiles because the owned local
APK deliberately has no Maps key; provider acceptance is not claimed.

Finally, the user acknowledges the confirmation. Revoking actual SQL occupancy
and backgrounding/returning produces real 403s and an installed dialog containing
only its title, Close, permission error and Reload. Restoring access and Reload
opens the same current Gig. Final result: **one receipt, one Gig, three POSTs;
the last two full commands are equal; final Gig is cancelled at $30**. The owned
emulator crash buffer is empty.

Evidence:

- `/private/tmp/pantopus-home-android-gig-ui-r5/` contains the result, final fixture
  snapshot, private-dialog hierarchies and eleven public-detail screenshots.
- `/private/tmp/pantopus-home-android-gig-ui-r5.log` records the completed journey.
- `/private/tmp/pantopus-home-android-gig-fixture-final.json` and adjacent fixture
  log record the independent final SQL snapshot and exact fixture cleanup.
- `/private/tmp/pantopus-home-android-gig-crash-buffer.log` is empty.

Intermediate runs are not final passes:

- r1 used a malformed driver link missing `/tasks/`. The app correctly opened
  the Home dashboard. The initial navigation-race hypothesis was disproved; no
  production navigation change was made for it.
- r2 read the Publish button's enabled text child. The actual parent was
  disabled and review was cleared. The driver now resolves interactive parents.
- r3 encountered API 34's missing accessibility root for the initial OS
  notification prompt. The prompt was visually verified. The driver has a
  narrowly scoped normal-Back fallback only for that focused permission dialog;
  it never seeds authentication or permission state.
- r4 passed real stale/lost/cold recovery and corrupted-storage restoration,
  reaching the exact cancelled $30 Gig with one receipt, one Gig and three POSTs.
  It stopped at the shared dock accessibility defect above. It is not claimed
  as a completed journey.

Raw hierarchies, protected-store bytes, fixture state and operator logs stay
outside Git under `/private/tmp/pantopus-home-android-gig-*`. Private dialogs
are reviewed through their installed hierarchy without disabling screen-capture
protection. Public Gig screenshots are separate artifacts.

## Build and verification limits

The final r3 Debug APK, formatting, Detekt, Android lint and instrumentation
APK assembly pass. Lint reports zero errors, 212 warnings and 17 informational
findings. All 30 existing detail/tip checks pass after the final dock change.
These support the installed journey; no unit-coverage percentage is an acceptance
target. Evidence: `/private/tmp/pantopus-home-android-gig-final-gates-r3.log`.
The separate final `ktlintCheck` passes in
`/private/tmp/pantopus-home-android-gig-final-format-check.log`.

The APK is explicitly built with API/socket pointing to the owned local 18083
fixture, blank PostHog/Sentry keys and a nonfunctional test Stripe placeholder.
Its actual DEX BuildConfig is inspected; private verification evidence records
its SHA256: `fd77e8b4dd21414f88ca44bf9714b924651ac53542813de626c3c5c7b6ce534e`.
Evidence: `/private/tmp/pantopus-home-android-gig-final-apk-verification.txt`.
No paid provider is activated.

Identity/profile/session bootstrap, location search/resolve and ancillary app
shell responses are synthetic. Gig publication and task/receipt/status/price
rows use real SQL and the production publication route/service. Detail GET uses
the SQL row, decoded geometry and a synthetic creator; this does not certify the
complete production detail serializer. The V1/V2 layout flag is synthetic
fixture memory, while lifecycle and price are actual SQL. Direct status changes
verify rendering, not assignment, work, settlement or cancellation workflows.

This checkpoint covers core conversion fields. Advanced ordinary-composer media,
deadline, urgency, business, shopping and other optional modes are not parity
claims. Physical Android, actual geo/provider delivery, payment operations,
installed write-failure/account-during-preflight/multiple-scene injection and the
complete release-candidate matrix remain separate limits. Earlier browser/SQL
race and storage proofs must not be relabeled as installed Android acceptance.

## Integration and cleanup

Predecessor iOS head `f0230fe29` passes all required remote jobs and CI OK in
[run 34554518236](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34554518236),
including all three iOS simulator jobs. The next exact head remains separately
required. Origin was fetched again; this branch contains current master
`390091cdb` with zero upstream commits missing. Paid #34 remains `e9ef2decb`, green and draft, with unfinished scope.
Preserve both branches' GigDetail/CompletionFlow changes during reconciliation.
The 42 distinct combined migration versions have no name collision; final
dependency reconciliation/replay is still required before integration.

Exact fixture SQL cleanup passes, the owned 18083 listener is stopped and the
dedicated emulator on 5556 is shut down. The owned Gig replay database is stopped
with its local backup retained; the pinned CLI reports `backup: true`.
The owner's emulator on 5554, original iOS simulator and master checkout are
preserved, including the unrelated modified handoff and two untracked Place
design files. No hosted migration, deployment, provider or paid-service change ran.
