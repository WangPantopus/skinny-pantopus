# Web browser audit — October 17, 2026

## Scope and environment

This is the web-only audit requested by the founder, including the continued pass on October 17–18. The branch started from freshly fetched `origin/master` at `5c64fe823f113bf89e7a855486c2e9f2aeef2b43`; master CI and its backend deployment were successful. A second fetch before delivery still resolved master to that commit. Open PRs were checked for overlapping work.

The actual production web build ran in the Mac's browser against a local Node backend and a new, isolated Supabase database with all repository migrations applied. Four synthetic accounts and three synthetic homes supplied owner, household member, unrelated resident, and unverified private-setup cases. Homes were seeded; this does **not** establish that address onboarding or ownership verification works end to end. The member joined through the real invitation UI. Mail was captured locally, background delivery jobs were disabled, and no hosted database or production configuration was changed.

## Repairs made and checked in the browser

| Finding | Repair | Verification |
| --- | --- | --- |
| Add Home and other collection routes were interpreted as a home ID, exposing invalid home-tool links. | AppShell recognizes home context only for UUID path segments. | Add Home retains personal navigation; a real home retains its existing tools. |
| Support Train “My Home” said coordinates were missing even when the Homes API returned a valid decoded point. | Accept `{ latitude, longitude }`, retain GeoJSON compatibility, and reject missing/nonfinite/out-of-range coordinates. | Published a train using My Home; a helper signed up, the organizer saw it after reload, and cancellation reopened the slot. |
| The alert composer offered theft, vandalism, suspicious-person and scam categories that the server refuses. | Offer the current resident alert kinds, explain the restriction, and expose selection state accessibly. | Posted a road-hazard heads-up through the verified-home composer; edited it; a second account liked, saved and commented on it. The edited content survived reload. |
| Alert cards printed internal codes such as `road_hazard`. | Render spaces in the existing alert banner. | The published card reads “Road hazard.” |
| Ownership/residency receipt pages asserted a pending review even when opened without a submission. They also made unverified review/access promises. | Use neutral return-page copy and link to My Homes for saved submission status. | Direct entry without a submission no longer claims a review exists; both status links open My Homes. |
| Task status controls had no accessible name; post-detail reaction/share buttons were named only by their counts. | Add descriptive action labels without changing layout or behavior. | The completed task exposes “Reopen task: …”; the post panel exposes Like/Unlike post and Share post. |
| A private profile's 403 response was described as a connection failure. | Show an unavailable-profile state for 403 and clear a previously rendered profile after 403/404. | One account made its profile private; another saw the correct unavailable state. A nonexistent profile still showed a not-found page. |

## Executed journeys

- Authentication: registration validation (password length/mismatch and required terms), local email confirmation, invalid-password feedback, successful sign-in, sign-out redirect, and switching between independent browser sessions.
- Household invitations: required-email validation, review/send, locally captured invitation, acceptance in a second account, and the owner's joined notification.
- Tasks: create, choose a due date using the calendar, assign/reassign, complete as the member, and confirm the owner's completed state after reload. The completion notification opened the saved task detail. A private-setup creator separately created, reloaded and completed a private task.
- Access boundaries: unrelated users were refused household task, edit, member, document and invitation access. Another account could not read the private-setup task. Public feed readers saw the alert's city without the author's exact home address.
- Messages: blank-message prevention, a real direct message, recipient inbox/unread state, reply, real-time arrival, and reload persistence. A brief disconnection displayed the offline banner and reconnected; prolonged offline retry and exactly-once delivery were not established.
- Support Trains: AI failure retained a manual-edit path; manual creation, home location, link-only sharing, publication, helper signup, organizer visibility, cancellation confirmation and persisted cancellation.
- Pulse: missing-location validation retained the draft; verified-home posting succeeded without device GPS; reaction, save, comment and edit paths worked across accounts.
- Profile/preferences: invalid username blocked save; a valid username and bio persisted. Morning briefing and quiet-hours changes persisted. Profile privacy changes persisted and were enforced for another account.
- Place/household: a weekly collection schedule persisted with household-entered provenance. A maintenance issue progressed through open, scheduled and completed history after reload. The unverified private setup opened Place with its verification prompt.
- Notifications: household, task, post and support-train events appeared; task deep-link navigation worked; mark-all-read, unread-empty state and read-state persistence worked.

## Breadth checks

- Inspected the 313-page route inventory. Visited 88 enabled application/home routes and nine Place section routes, including administrative refusals and empty/error states. Initial loaders were revisited. These are route checks, not proof of every control or role permutation on each page.
- All 133 registered launch-cut routes redirected away from their disabled features. No launch flags were enabled.
- Checked 13 core pages at a 390-pixel viewport: Place, Today, Nearby, Pulse, messages, profile editing, notification preferences, privacy, Homes, home dashboard/tasks, invitations and Support Trains. None had document-level horizontal overflow; the four-tab mobile-web navigation remained intact.
- No application-crash screen was encountered in the enabled-route sweep. Browser and production-build checks were performed on the repaired code as well as the initial baseline.

## Existing checks

- Production build: passed.
- Type-check gate: passed, zero errors.
- ESLint: passed, zero errors and 1,034 existing warnings.
- Jest: 123 suites / 2,383 tests passed. The local command excluded `.next*` build output from the module map because the baseline and repaired standalone builds otherwise create duplicate workspace-package names. No tests were added or changed.
- Icon inventory check and `git diff --check`: passed.

## Remaining coverage and observed limitations

- Provider-backed address autocomplete/validation, ownership/residency document review, postcard delivery, property enrichment, OAuth, payments/payouts and device notifications were not verified end to end. Address suggestions and air-quality data were unavailable with this local configuration. AI drafting failed safely with a working manual fallback. No provider credentials were added to make these paths appear verified.
- Device-GPS personal posting was not exercised; the verified-home posting path was. Other browsers, assistive technologies and physical-device web behavior still need their own checks.
- Home navigation now follows current access; the continued pass below verifies private setup and refused-home cases. Business viewer controls now follow the existing permission endpoint in the main dashboard; write refusals remain enforced by the backend.
- Administrative/landlord review, ownership transfers/disputes, account deletion, all upload formats, all recurring-task permutations, all payment states and every public/business detail record were not exhaustively exercised. Launch-cut features were checked for being inaccessible, not activated or audited internally.

Raw local fixtures, credentials, mail contents, screenshots and operator logs are excluded from this report and Git. This pass is evidence for the named journeys and repairs, not a claim that every button, feature or external integration has been certified.


## Continued pass — October 17–18

The same PR is being extended at the founder's request. Production services remain untouched. The isolated Supabase instance now supplies a private Home document bucket and a separate S3-compatible bucket for synthetic public media. These local checks do not establish hosted storage policy or lifecycle behavior.

Additional repairs verified in the running browser:

- Home sidebar navigation reuses current Home permissions. Private setup shows Overview and Tasks, and Tasks opens its working private collection instead of verification. An unrelated account sees no household tool links; its direct document request remains refused. The verified owner's existing navigation remains available.
- The main Home Documents panel now offers the same authorized download used by the separate document list. A synthetic file was uploaded through the real backend as a fixture, downloaded with matching bytes in the browser, shared with another account, and denied after link revocation. The web Home Documents UI itself does not offer upload.
- Business onboarding updates its existing draft when returning to Basic Info. Previously a repeated create could silently discard edited descriptions, or reject changed identifying details. Username/account email become fixed once the draft exists; profile fields remain editable. Blank names and invalid usernames receive direct feedback. A skipped location no longer shows editable hours that cannot save or claims that hours are configured. Revised description and uploaded logo persisted in the business dashboard and public profile after reload.
- Team invitations correctly require the recipient email. Unsupported title inputs were removed from both invite and edit forms; the server has no corresponding seat field and silently discarded them. Seat display-name edits persisted.
- Signed-out business invite recipients now sign in and return to the invitation instead of seeing an invalid-token error. The invitation reads the actual nested business name. Acceptance leads to that business's dashboard, and the receipt no longer asserts a fresh seven-day lifetime for an older link. Verified with a second synthetic recipient from signed-out entry through sign-in, named preview, acceptance, and dashboard navigation.

Additional executed journeys:

- Business setup: required fields, malformed email/website feedback, Back/Next editing, skip location/hours, PNG logo upload through local S3 storage, publication, dashboard reload, public profile in a second account.
- Catalog: rejected negative price, saved positive price, edited name and zero price, and verified public Services listing. An invited viewer's attempted create was rejected; no unauthorized item was created. The repaired dashboard removes unauthorized create/edit/archive actions and retains readable content.
- Business relationship/messages: follow, customer inquiry, business inbox unread state, business reply, and recipient-side business identity.
- Business pages: create page, text and FAQ blocks, draft save, publish, public FAQ expansion, second draft hidden from public readers, second publication, and revision-history display. The history drawer is read-only.
- Team: viewer invitation, acceptance, owner-visible joined seat, rename, and refusal before membership. A second invitation verified the repaired signed-out entry and correct destination.

Existing checks after the initial continued repairs: type gate passed with zero errors; all 123 Jest suites / 2,383 tests passed. No new tests were added. The follow-up production build, type gate and lint passed (zero errors; 1,032 lint warnings). All 123 web suites / 2,383 tests passed again, along with 103 tests in six relevant existing backend suites. Production-browser smoke checks confirmed viewer/owner controls and exhausted guest access.


Further repairs and verification in this continued pass:

- Business dashboard controls use the current `/me` permission list for profile/logo/publication, catalog, pages, locations/hours, invoices and settings. The sidebar also reads those permissions. Viewers retained readable data without unsupported write actions; owners retained their actions. Both existing business route prefixes now retain business navigation, including the hours editor.
- Guest-pass creation now explains invalid durations and view limits before submission and labels the controls. Created a one-view pass, opened it from another account, confirmed exhaustion, created a second pass and confirmed immediate revocation after reload. Expired/exhausted pages no longer offer an empty email link as “Request New Access.”
- Special hours now explain a missing date or missing open/close times. Weekly saves show a receipt; each closed-day control has a unique label. A fictional location fixture was necessary after the address validator rejected the fictional address. Saved weekly hours and a dated closure persisted after reload. This is not evidence of successful provider-backed location creation.
- Sign-out could revoke the server session yet leave the browser on a settings error when a concurrent session change interrupted the logout response. It now completes full-page navigation when the server has cleared the session flag, while preserving a newer signed-in session. The applicant reached sign-in and signed back in successfully.
- A document claim disappeared from My Homes when its private task workspace was already listed. Private-setup claims now remain under Verification in Progress. A claim without evidence is labeled Document needed rather than Under review; unreadable evidence presence stays unknown. The applicant saw the submitted residency claim after reload.
- Shared claim-review notifications incorrectly called residency verification “ownership,” including an approval message that could imply ownership rights. They now describe home verification and direct follow-up/rejection to My Homes. A local reviewer requested more information, inspected the synthetic image, and rejected it with a reason; the applicant received the corrected rejection and followed its link. Approval was correctly refused for the seeded pending-owner history. This does not establish a successful residency-approval journey.

The continued pass used a synthetic local platform reviewer only. Unsupported evidence was refused with an actionable message; a supported PNG upload reached the receipt and reviewer queue. Private evidence preview worked. No real identity documents, provider keys, payments, production changes or notifications to real people were used.


## Continued functional checks — October 18

Further verified repairs:

- The Emergency form offered Shutoffs but permanently disabled Save without explaining why. It now requires an explicit water, gas, electrical or breaker-map choice using the existing storage types. A synthetic water shutoff saved under Shutoffs and survived reload. The existing medical-entry test was updated for the new selection; no test was added.
- Invoice quantity `0` was silently sent as `1`; numeric prefixes were parsed as valid values and incomplete lines were silently omitted. The form now validates whole quantities from 1 to 10,000, positive amounts with at most two decimal places, and complete line items. It preserves invalid drafts and labels each input. Zero, negative, fractional, blank, excessive and text-suffixed quantities, malformed/nonfinite/overprecise amounts, and an incomplete second line were refused. A valid two-line invoice total matched the recipient view after reload. Voiding removed payment controls and the owner’s Void filter showed the saved record. A void or paid invoice now says Invoice Amount instead of Amount Due.
- Business Legal & Finance accepted malformed email and reported that clearing an optional field succeeded while retaining its old value. The web form now validates email and four-digit tax suffixes, trims input, and sends intentional empty values. A synthetic support email saved, cleared, and remained empty after Refresh. An invited viewer was refused legal details.
- Restricted-member copy no longer promises chore access that its default permissions do not grant.
- Starting residency verification during the rejection cooldown previously asked the applicant to keep retrying. The generic refusal now directs them to existing requests or Support without exposing internal claim-policy details.

Additional journeys exercised:

- Account security: wrong-password feedback for step-up, sign out other sessions with the current browser retained, sign out every session, sign-in return navigation, and recorded security activity.
- Tasks: owner upload of a text file and PNG, saved attachment display, byte-matching protected text downloads by both owner and assigned member, repeat interval validation, valid interval update and pause, and the member’s persisted read-only repeat schedule. Restricted membership denied tasks; restoring the original membership restored access. Automatic background repeat execution remains unverified because delivery workers are disabled.
- Privacy/account: discoverability saved as Nobody and survived reload; profile block removed interaction actions, the blocked list retained it, and unblock removed it. Browser-data clearing returned its receipt. Account deletion rejected the wrong confirmation word and Cancel preserved the account. Final account deletion and new password entry require user confirmation/handoff and were not performed.
- Home security: Lockdown confirmed the affected scope, revoked the remaining guest pass, and blocked guest-pass creation. Existing member permissions remained available. The synthetic home was left in Lockdown; disabling or expanding real access was not necessary for this check.
- Business: empty review filters and analytics loaded, including the existing synthetic follower and public-page views. Invoice notification opened the recipient’s invoice. No payment was made or payment credential entered.
- Residency: a synthetic pending tenant fixture reached the review queue after the isolated rejection timestamp was advanced beyond its cooldown. Approval was refused with Current identity confirmation is required before approval. The claim was closed with an explicit synthetic-test rejection, and the reviewer’s temporary local admin role was removed. This verifies the guard, not successful identity verification or approval.

Checks after these form repairs: type gate passed with zero errors, ESLint passed with zero errors and 1,032 warnings, and all 123 existing web suites / 2,383 tests passed. Further production-build verification follows before delivery. The previous checkpoint’s complete CI passed.


Additional recovery and retained-tool checks:

- A password-reset request rejected a malformed email, returned an enumeration-safe receipt and resend cooldown, and delivered to the local mail catcher. The existing password still signed in; resetting it was not performed.
- A document-only chat message and its reaction persisted across accounts and reload. The recipient opened the protected document and saw the expected synthetic contents. The file opened in a browser tab rather than triggering a download event. A synthetic report submitted successfully. During a longer disconnected interval, a text message stayed queued; after reconnect it appeared once in each account after reload. This is one observed queued-send case, not a guarantee across every retry/crash sequence.
- A connection request produced the recipient notification and pending state; acceptance showed Connected in both accounts, removal persisted, and unfollow returned to Follow.
- The retained package/invoice navigation exposed disabled scheduling links. It now uses the existing launch-cut route filter and retains Payments, Packages, Invoices and My packages. No launch feature was enabled.
- In the development server, where the existing paid-scheduling flag defaults on, package creation refused missing fields and negative price. A supported inactive package saved; restore, duplicate, archive, rename and session-count edit worked. Editing exposed unsupported Description and Expiry inputs that silently discarded changes. Those inputs are removed; existing persisted fields remain. The final production build keeps paid scheduling off and shows its unavailable state. No flag was enabled. Purchase, Stripe price creation, refunds and credit redemption are unverified without payment setup.
- The scheduling invoice view reflected the same saved and voided business invoices. Its Share action previously shared the owner-only URL; it now uses the existing recipient invoice URL and reports non-cancel failures, with clipboard fallback. Native OS sharing itself remains unverified.

- Household business linking refused even the owner because the routes tested a nonexistent `hasPermission` result after the permission-scoped `hasAccess` check. Create, update and remove now use the shared helper's actual contract. The web controls follow `vendors.manage`; manual-vendor behavior is unchanged. The owner linked the synthetic business, opened its public profile, removed the link, and both accounts reflected removal after reload. A member could read the link but saw no link-management controls.
- Home editing refused an out-of-range latitude and negative bedroom count. A nickname and synthetic parking instructions saved and persisted; the member saw the renamed home. The original nickname was restored and parking instructions cleared.
- Profile image upload, a skill, duplicate-skill handling, invalid website feedback and a valid website save worked. The image, single skill and website persisted in the editor; the other account saw the image and skill after reload.

The final remote-state check still found master at the starting commit. PR #2430 separately owns manager task defaults and canceled-plan write admission; this PR does not duplicate those changes. No hosted service, native app, launch flag or database schema was changed in this continued pass.

## Final local checkpoint

The final production build, type gate (zero errors), ESLint (zero errors, 1,032 existing warnings), all 123 web suites / 2,383 tests, and four relevant Home backend suites / 127 tests passed. The earlier notification/auth/business checks are recorded above. No new unit tests were written; one existing Emergency test was updated for the intended selector behavior. Backend syntax and `git diff --check` passed.

The standalone production server was opened in the browser against the same isolated backend/database. It retained the saved shutoff and exposed the utility selector, completed sign-out/sign-in, refused an unrelated account's invoice read, showed the recipient's void invoice with the correct total and no payment action, kept paid scheduling unavailable, and successfully created a household business link. The synthetic local services remain available for inspection.

This completes the recorded local audit pass. The limitations above remain explicit release-verification work: provider-backed address/identity/OAuth/payment flows, successful ownership/residency approvals and transfers/disputes, delivery-worker behavior, physical devices/other browser engines and assistive technologies. New password entry requires user handoff; permanent account deletion requires confirmation. Those boundaries were not bypassed, and this report does not certify every possible input, race or role combination.

## Further web follow-through — October 18

The founder requested continued work after the previous checkpoint. This pass extended the same PR into ownership-transfer initiation and the existing landlord tools.

Repairs verified in the browser:

- Hub profile completion counted a professional-profile row instead of saved `UserSkill` rows. A saved skill now completes the skills step and removes the incorrect incomplete-profile prompt. An unreadable skill count produces a retryable failure rather than claiming the user has no skills.
- The landlord Add Property button navigated to a nonexistent creation route and produced a server error. It now opens the existing Add Home flow and says Add Home; legacy `/app/landlord/properties/new` links redirect there too. Empty-state copy distinguishes Home setup from verified landlord authority. This does not add or certify a landlord-authority onboarding flow.
- Transfer Ownership now applies email validation before confirmation and explains that initiating the transfer removes the seller's ownership access immediately, retaining member access while the buyer verifies ownership. A local transfer produced exactly that state: seller dashboard became Member; the buyer received a Document needed claim with no household access. The buyer could open the evidence flow and could not initiate another transfer. Completion of buyer verification and multi-owner quorum approval remain unverified.
- A pending claim now promises continued private tasks only when that account actually has the matching private setup. The transfer recipient no longer sees a claim about a workspace they do not have.
- Deny on a tenant request threw `prompt() is not supported` in the Mac browser. It now uses the existing modal component, preserves an optional reason, prevents concurrent submissions, reports failures in the dialog and ignores a retired view's response. Cancel preserved the request; submitting the synthetic denial removed it from the pending queue. Two existing dialog tests were updated; no tests were added.
- Property occupant totals now include verified managed units, matching the lease-summary scope. The count was one after a synthetic recipient accepted an invitation, then zero after the lease ended. Unmanaged units stay excluded. Failed occupancy and property-list reads now fail visibly instead of returning false empty results.
- Request and lease rows, approval dialogs and lease-end confirmations now name the existing Home or unit, so a landlord can distinguish requests from the same person for different units.
- Property cards no longer turn unavailable counts into zeros. A pending-authority fixture shows unknown counts and explains the verification requirement; the verified building shows three units and its actual lease/request counts.

Additional rental checks used an explicitly synthetic building, three units, local authority rows, and a seeded pending request. These fixtures bypass initial address/authority onboarding only; they are not evidence that those onboarding services work. Empty/reversed unit ranges were rejected. A valid range was refused because the fictional building lacked a validated address, with the original batch retained after reload. Verified and unverified units showed appropriate Active/Vacant/Unavailable states; an unrelated account could not read property details. Tenant invitations rejected malformed email and reversed dates, returned a link with honest email-delivery wording, and were accepted by the intended synthetic recipient. Resident access persisted after reload. Request approval rejected reversed dates and a building-level request without a unit. A seeded unit-level request then approved successfully, cleared the queue and restored the synthetic resident’s access. This covers approval against a verified local authority fixture, not initial request/authority onboarding. Denial, lease filters, cancellation of lease termination, confirmed termination, ended-history retention and loss of the former resident's dashboard access were exercised. The denied-access page returned to Place successfully.

The local database still has `plans` and `plans_playdates` disabled. No launch flag was enabled to manufacture coverage. Provider-backed unit creation, fresh landlord-authority verification and initial tenant-request onboarding, ownership-verification completion, live payments/OAuth, delivery workers and other browser engines remain outside the evidence above. All people, documents and rental records used here were synthetic; no real tenancy, payment, production database or real-person notification was involved.

Final checks for this continued batch: the production build and zero-error type gate passed; ESLint had zero errors and 1,032 existing warnings; all 123 existing web suites / 2,383 tests and five relevant Hub/landlord backend suites / 200 tests passed. Backend syntax and diff checks passed. On the final standalone production server, the request card and denial dialog named the correct unit, Escape canceled and returned focus to Deny, submitting cleared the queue after reload, and the same recipient retained their separately approved unit's resident dashboard. The earlier unit-level approval persisted as “You’re part of this household.” Only the in-app browser was available through the browser inventory. The local production server and isolated backend remain running for inspection.
