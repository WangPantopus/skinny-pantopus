# Android emulator audit — October 17, 2026

This records two rounds of Android walkthroughs and repairs, not a certification that every feature or device works. The founder requested the latest master, a real Android emulator walkthrough, immediate repairs where practical, and one PR. No iOS, web, backend, migration, hosted configuration, or launch-scope changes are included.

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
| Neighbor-note feedback, block, and report appeared successful even with the API unavailable; failed replies gave no explanation. | Update success flags only after success, show an explicit retryable error, and serialize overlapping actions. Only offer Change reply when the API allows replying. | Each action failed visibly during an API outage and succeeded after restoring it; the confirmed block also prevented a later direct message. The first-round final APK retained the sent reply and omitted Change reply when replying was unavailable. |
| Recording a radon result without a test date claimed the test happened today. | Leave the optional due date unset and display “date not recorded” instead of substituting the task due date. | Negative result blocked; unknown-date result saved; after reinstall/relogin the existing result correctly displayed “date not recorded” and retained its value. |

The follow-up round added these repairs:

| Finding reproduced in the emulator | Android repair | Verification |
| --- | --- | --- |
| A member with document read access saw upload, replace, and delete controls that the server would reject. | Consume the existing effective-access endpoint; show upload only with `docs.upload`, and replacement/deletion only with `docs.manage`. Keep file reading and sharing available. | The member previewed the shared PDF without mutation controls. The owner replaced the PDF, uploaded a temporary PDF, canceled deletion once, then deleted it; the original remained. Existing replacement-retry tests also passed. |
| An all-members document disappeared from the Shared filter because the API did not provide a recipient count. | Recognize household visibility as shared without inventing a recipient count; make empty-filter instructions appropriate for read-only users. | The final APK showed Shared 1 and the original PDF after relaunch; the deleted temporary file stayed absent. |
| Group messages used the plan's initials, lacked the sender's name under the current public API projection, and could lose attribution beside system notices. | Read public `displayName`/`handle` with legacy fallbacks, label incoming group messages with their sender, and keep system notices outside message groups. | The final APK showed Morgan’s name/initials/time beside a message between admission and time-change notices; switching accounts showed Jamie’s name/initials/time on the guest reply. |
| Returning from a canceled plan to an already-open chat left the composer active. | Refresh plan-chat status when the screen resumes and when a system notice arrives; retain a known closed state while refreshing. | On the final APK, the host opened a plan from an active chat, canceled it, and used Back to return to that same chat. The cancellation notice appeared and the composer was replaced with “This plan was cancelled. The chat is closed.” |
| Decorative avatar rings announced unsubstantiated profile-completion percentages. | Announce the person's name or “Profile image”; retain the existing ring appearance. | The final remembered-account screen exposed “Morgan Test” for the avatar, with no percentage claim. |
| Pulse's no-results message was excluded from the accessibility tree. | Put the empty state inside the scrolling feed and state that search covers loaded posts. | The final APK exposed “No loaded posts match your search” in the accessibility tree at 100% and 130% font sizes; clearing the query restored the posts. The larger-font layout was also visually checked. Correction to the first-round note: a screenshot showed the old message was visually present; the confirmed defect was its accessibility placement. |
| A one-person plan preview said “1 spots.” | Use singular spot/family labels at capacity one. | The final host preview showed “1 spot.” The draft was discarded without posting another plan. |

The existing zero-cost assertion was updated for the intended behavior, and three existing document-test fixtures now supply effective permissions. No new unit tests were added.

## Walkthrough coverage

| Area | What was actually exercised |
| --- | --- |
| Sign-in and entry | Required signup fields and terms, legal navigation, wrong-password recovery, successful login, remembered-account removal, logout confirmation, account switching, password-reset confirmation/resend. Email delivery and full UI signup completion were not verified. |
| Empty states and address setup | Newcomer Place/Today/Nearby/Messages, empty unread filter, address and Add Home required inputs, missing-provider error/retry with entered data retained, and discard confirmation. Saved-place Today and the subsequent home view were checked using local fixtures. |
| Today | Home/saved-place context, weather, sun times, alerts, unavailable air-quality retry, Android share chooser, a household-confirmed weekly pickup schedule and reminder setting surviving relaunch, and radon result/date validation. |
| Ballot | Today entry, the Place ballot card, government-layer animation and return navigation. No registration or ballot transaction was attempted, and civic-source accuracy was not independently audited. |
| Household tasks | Create, assign to another account, invalid-date correction, persisted details, weekly recurrence then pause, private text attachment upload and preview, assignee completion, and owner's Done view after switching accounts. |
| Household records | Maintenance creation/edit and persistence; PDF upload, preview and external share chooser; emergency record creation/detail; membership role change and audit activity. Read-only member preview and server rejection of forbidden document deletion were checked separately. The second round covered owner replacement and deletion, deletion cancellation, Shared filtering, and removal of forbidden controls. |
| Household invitations | Invalid email blocked; invite review and send confirmation; honest local email-delivery status; recipient notification, invitation review and acceptance; owner member-list confirmation; removal review/confirmation; removed member relogin and denied home access, including Reload access. The member’s unrelated home permissions remained intact. |
| Direct messages | New conversation, unread counts clearing on open, send/reply/edit, PDF attachment/native preview, the other account's view after signing in again, and explicit failed-send handling after a confirmed block. |
| Neighbor notes | Anonymous receiver detail, templated reply, feedback, block and report, including API-outage failures and recovery. The two incoming notes were seeded through the real local API; sender composition was not an end-to-end UI check. |
| Pulse and connections | Existing Nearby hub and Pulse, Home Area Ask post, saved post, comment, intent filter, search/clear, post-detail heart reaction, public profile, connection request, acceptance by the other account, and persisted connection in the sender's list. The paused redesign was not enabled. |
| Plans | Flag off/on navigation, home-area choice, host form/required location, own-porch privacy preview, creation, join request with one extra guest, host acceptance/address-sharing confirmation, capacity counts, accepted guest's exact address, and group message received by the host after account switching. A separate household also requested entry, changed its party size, and withdrew; its pending view kept the exact address hidden. The second round covered minimum capacity and disabled oversized-party choices, a full plan, time-change validation, failed-save recovery with edits retained during an API outage, guest reconfirmation, host/guest chat, cancellation dismissal and confirmed cancellation. A supplemental plan created through the real local API supported the final chat-cancellation replay. Map tiles required an unavailable Google Maps key. |
| Settings and system surfaces | Verification and its outage state; device/session listing; visibility changes; denied notification permission followed by granting it in Android settings; morning time persisted after relogin; readable notification settings at 130% font size; storage clear with account retained; wallet/activity empty states; unavailable payout/card setup; Help/Legal; contact picker empty state. Data export accurately described an email request and opened Gmail onboarding; no email was composed or sent, and fulfillment was not verified. |

## Remaining findings and dependencies

These are deliberately not marked fixed by this Android PR.

- **Fresh-database manager permissions:** changing the synthetic member to manager left the API's effective permissions at `home.view`, so household tools disappeared. Android followed the returned policy. Read-only document/maintenance checks used explicit local per-person grants. The canonical role defaults need review by the backend/home owner; no production role was broadened here.
- **Public verification badge scope:** the household-only synthetic member appeared as Verified neighbor on their public profile. The profile API returned `residency.verified: true`; `getPublicResidencySummary` checks verified occupancy without distinguishing household verification from address verification. The backend identity projection needs to preserve that distinction. This check did not demonstrate a bypass of the separate neighbor-message server gate.
- **Neighbor block after reload:** a confirmed block was enforced by the server, but the current received-note response does not include the persisted blocked state and the screen initializes it to false. PR 2425 contains related backend response changes; Android follow-through and another relaunch check are needed after that lands.
- **Canceled-plan server enforcement:** Android now refreshes the closed-chat state, but master’s backend still needs the separate cancellation/write enforcement in PR 2425. A client-only control is not server authorization.
- **Potentially misleading backend content:** system-age estimates derived from home construction year and property-tax date wording need the separate provider/backend repairs in PR 2425. This PR does not certify those facts.
- **Ballot entry positioning:** Today’s Open your ballot action selects Place but leaves the ballot card below the fold, requiring a manual scroll. The government animation and return control worked once the card was reached; direct positioning at the card remains a usability repair.

PR 2425 was open, not merged, when these dependencies were checked. It is a reference, not an additional PR created by this audit.

## Limits and next pass

Credentialed geocoding/address verification, live Google Maps tiles, AirNow, AI responses, OAuth, Stripe card/payment/payout completion, outbound email/SMS, FCM delivery, scheduled jobs, physical-phone biometrics, production services, and store distribution were not end-to-end verified. Missing-provider failure states were exercised where noted. No credentials were entered or hosted settings changed.

The remaining functional sweep includes invitation withdrawal/decline/resend/expiry, ownership transfer, Support Trains and reservations, plan waitlists/expiry, broader Pulse moderation and connection flows, completed data-export requests/account deletion, other Android versions/form factors, and a full large-font/screen-reader pass. Existing automated checks help cover these areas but do not replace those real-app checks.

## Final verification

Fetched master again before delivery; it was still `5c64fe823f113bf89e7a855486c2e9f2aeef2b43`.

The final source passed:

```sh
cd frontend/apps/android
./gradlew ktlintCheck detekt :app:lintDebug test paparazziVerify :app:assembleDebug --no-daemon
```

The second-round final run completed successfully in 10 minutes 32 seconds (the first-round run also passed, in 11 minutes 41 seconds). Each debug/release unit-test report contained 549 suites and 5,054 cases: 4,978 passed, 76 skipped, zero failures/errors. These are the same test set run in two variants, not 10,108 distinct tests. `git diff --check` also passed.

Installed the second-round APK and checked document permissions and Shared filtering after relaunch, both senders’ group-chat attribution, return-to-chat after cancellation, the one-spot preview, remembered-account accessibility, and Pulse search/clear at normal and larger font sizes. The same Android source was used for these emulator checks and the final automated run. Font size was restored to normal. Kept the emulator and isolated local backend available for review. CI results are recorded on the PR separately from these local checks.
