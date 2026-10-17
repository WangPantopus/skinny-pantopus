# Android emulator audit — October 17, 2026

This is a first-round Android audit and repair record, not a certification that every feature or device works. The founder requested the latest master, a real Android emulator walkthrough, immediate repairs where practical, and one PR. No iOS, web, backend, migration, hosted configuration, or launch-scope changes are included.

## Baseline and environment

- Fetched master and started from `5c64fe823f113bf89e7a855486c2e9f2aeef2b43`; checked the live PR list and master CI rather than relying on a handoff's recorded Git state.
- Pixel 6 emulator, Android 15 / API 35, Google APIs ARM64, running on the Mac. Installed the debug APK and used the actual UI, Android document picker, PDF viewer, share chooser, notification settings, and relaunches.
- Dedicated local Node backend and Supabase database, with all 185 canonical migrations applied. Private uploads used a local Supabase S3 bucket. Test accounts, homes, messages, files, and activity were synthetic.
- Used separate owner, household member, and newcomer accounts. Some address/verification/profile fixtures were seeded through the local API/database because credentialed address providers were unavailable. UI creation was used for tasks, maintenance, documents, emergency information, posts, comments, pickup rules, radon answers, and a Plan.
- Kept launch-cut features off. The local database's separate `plans` runtime flag was enabled for the Plans checks; `pulse_redesign` and playdates remained off. The four-tab launch navigation and the optional fifth Plans tab were both exercised.
- No real recipients, charges, hosted data, credentials, device tokens, raw logs, or screenshots are included in this report or PR.

## Repairs in this PR

| Finding reproduced in the emulator | Android repair | Verification |
| --- | --- | --- |
| App headers overlapped the Pixel 6 camera cutout because it was taller than the status bar. | Consume display-cutout insets at the app root and clip content to the resulting bounds, including the closed drawer in landscape. | Portrait and landscape clearance checked; landscape drawer opened/closed correctly and no longer appeared in the cutout margin. |
| Verification showed a confirmed email as unverified; an API outage also looked like an unverified email. | Decode the API's `privateAccount` key and show a retryable unavailable state when verification cannot be read. Do not offer resend from an unknown or already verified state. | Confirmed account showed verified; stopped API produced an error; restarting and retrying restored verified. |
| An impossible task date such as `2026-02-30` reached submission and was rejected by the API. | Apply the existing strict ISO-date validator to the due-date field and clarify its error message. | Impossible date rejected inline; corrected date saved, survived relaunch, and appeared for the assigned household member. |
| An invalid maintenance cost was silently discarded, `25.75` displayed as `$26`, and zero was presented as DIY. | Validate optional cost, reject negative/malformed/over-precision/out-of-range values, preserve cents, and display zero as `$0`. | `abc`, `-1`, `25.751`, and `10000000000` rejected; `$25.75` persisted and displayed correctly; zero saved and displayed as `$0`. |
| Failure to start card setup instructed the user to use a nonexistent “Retry saving card” action. | Distinguish failure before a SetupIntent exists from an unconfirmed card save. | Unconfigured local Stripe setup now says to tap the existing Add payment method button. No card was charged or saved. |
| Neighbor-note feedback, block, and report appeared successful even with the API unavailable; failed replies gave no explanation. | Update success flags only after success, show an explicit retryable error, and serialize overlapping actions. Only offer Change reply when the API allows replying. | Each action failed visibly during an API outage and succeeded after restoring it; the confirmed block also prevented a later direct message. The final APK retained the sent reply and omitted Change reply when replying was unavailable. |
| Recording a radon result without a test date claimed the test happened today. | Leave the optional due date unset and display “date not recorded” instead of substituting the task due date. | Negative result blocked; unknown-date result saved; after reinstall/relogin the existing result correctly displayed “date not recorded” and retained its value. |

The existing zero-cost display assertion was updated to match the corrected behavior. No new unit tests were added.

## Walkthrough coverage

| Area | What was actually exercised |
| --- | --- |
| Sign-in and entry | Required signup fields and terms, legal navigation, wrong-password recovery, successful login, remembered-account removal, logout confirmation, account switching, password-reset confirmation/resend. Email delivery and full UI signup completion were not verified. |
| Empty states and address setup | Newcomer Place/Today/Nearby/Messages, empty unread filter, address and Add Home required inputs, missing-provider error/retry with entered data retained, and discard confirmation. Saved-place Today and the subsequent home view were checked using local fixtures. |
| Today | Home/saved-place context, weather, sun times, alerts, unavailable air-quality retry, Android share chooser, a household-confirmed weekly pickup schedule and reminder setting surviving relaunch, and radon result/date validation. |
| Ballot | Today entry, the Place ballot card, government-layer animation and return navigation. No registration or ballot transaction was attempted, and civic-source accuracy was not independently audited. |
| Household tasks | Create, assign to another account, invalid-date correction, persisted details, weekly recurrence then pause, private text attachment upload and preview, assignee completion, and owner's Done view after switching accounts. |
| Household records | Maintenance creation/edit and persistence; PDF upload, preview and external share chooser; emergency record creation/detail; membership role change and audit activity. Read-only member preview and server rejection of forbidden document deletion were checked separately. |
| Direct messages | New conversation, unread counts clearing on open, send/reply/edit, PDF attachment/native preview, the other account's view after signing in again, and explicit failed-send handling after a confirmed block. |
| Neighbor notes | Anonymous receiver detail, templated reply, feedback, block and report, including API-outage failures and recovery. The two incoming notes were seeded through the real local API; sender composition was not an end-to-end UI check. |
| Pulse and connections | Existing Nearby hub and Pulse, Home Area Ask post, saved post, comment, intent filter, search/clear, post-detail heart reaction, public profile, connection request, acceptance by the other account, and persisted connection in the sender's list. The paused redesign was not enabled. |
| Plans | Flag off/on navigation, home-area choice, host form/required location, own-porch privacy preview, creation, join request with one extra guest, host acceptance/address-sharing confirmation, capacity counts, accepted guest's exact address, and group message received by the host after account switching. A separate household also requested entry, changed its party size, and withdrew; its pending view kept the exact address hidden. Map tiles required an unavailable Google Maps key. |
| Settings and system surfaces | Verification and its outage state; device/session listing; visibility changes; denied notification permission followed by granting it in Android settings; morning time persisted after relogin; readable notification settings at 130% font size; storage clear with account retained; wallet/activity empty states; unavailable payout/card setup; Help/Legal; contact picker empty state. |

## Remaining findings and dependencies

These are deliberately not marked fixed by this Android PR.

- **Read-only document controls:** a member with `docs.view` could preview a shared PDF but still saw upload/replace/delete controls. Delete was rejected by the server and the document remained intact. The effective document-permission response is part of the separate backend work in [PR 2425](https://github.com/WangPantopus/skinny-pantopus/pull/2425). Android still needs to consume those capabilities after that contract lands.
- **Fresh-database manager permissions:** changing the synthetic member to manager left the API's effective permissions at `home.view`, so household tools disappeared. Android followed the returned policy. Read-only document/maintenance checks used explicit local per-person grants. The canonical role defaults need review by the backend/home owner; no production role was broadened here.
- **Public verification badge scope:** the household-only synthetic member appeared as Verified neighbor on their public profile. The profile API returned `residency.verified: true`; `getPublicResidencySummary` checks verified occupancy without distinguishing household verification from address verification. The backend identity projection needs to preserve that distinction. This check did not demonstrate a bypass of the separate neighbor-message server gate.
- **Neighbor block after reload:** a confirmed block was enforced by the server, but the current received-note response does not include the persisted blocked state and the screen initializes it to false. PR 2425 contains related backend response changes; Android follow-through and another relaunch check are needed after that lands.
- **Potentially misleading backend content:** system-age estimates derived from home construction year and property-tax date wording need the separate provider/backend repairs in PR 2425. This PR does not certify those facts.
- **Group-chat attribution:** the host saw the guest's message and correct text, but the incoming avatar used the plan's initials. Review sender labeling for multi-person conversations before calling attribution complete.
- **Accessibility follow-up:** remembered-account/avatar descriptions include profile-completion percentages. Their accuracy was not established in this pass.
- **Ballot entry positioning:** Today’s Open your ballot action selects Place but leaves the ballot card below the fold, requiring a manual scroll. The government animation and return control worked once the card was reached; direct positioning at the card remains a usability repair.
- **Pulse search empty state:** filtering for a nonexistent phrase left an empty feed area without a no-results explanation. Clearing the query restored the post. Intent filtering and the post-detail heart reaction worked.

PR 2425 was open, not merged, when these dependencies were checked. It is a reference, not an additional PR created by this audit.

## Limits and next pass

Credentialed geocoding/address verification, live Google Maps tiles, AirNow, AI responses, OAuth, Stripe card/payment/payout completion, outbound email/SMS, FCM delivery, scheduled jobs, physical-phone biometrics, production services, and store distribution were not end-to-end verified. Missing-provider failure states were exercised where noted. No credentials were entered or hosted settings changed.

The remaining functional sweep includes full household invite/accept/revoke and ownership-transfer lifecycles, Support Trains and reservations, plan cancellation/time-change/reconfirmation/waitlist/expiry, broader Pulse moderation and connection flows, data export/account deletion, other Android versions/form factors, and a full large-font/screen-reader pass. Existing automated checks help cover these areas but do not replace those real-app checks.

## Final verification

Fetched master again before delivery; it was still `5c64fe823f113bf89e7a855486c2e9f2aeef2b43`. The Android repair commit is `bdbcbf30b`.

The final source passed:

```sh
cd frontend/apps/android
./gradlew ktlintCheck detekt :app:lintDebug test paparazziVerify :app:assembleDebug --no-daemon
```

The final run completed successfully in 11 minutes 41 seconds. Each debug/release unit-test report contained 549 suites and 5,054 cases: 4,978 passed, 76 skipped, zero failures/errors. These are the same test set run in two variants, not 10,108 distinct tests. `git diff --check` also passed.

Installed the resulting APK and relaunched it against the local backend. Confirmed the final reply-control behavior; the preceding installed build verified the radon-date display and portrait/landscape cutout repair. No Android source changed between those checks except the reply-control adjustment. Kept the emulator and isolated local backend available for review. CI results are recorded on the PR separately from these local checks.
