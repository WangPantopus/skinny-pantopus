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
- Lease history distinguishes canceled requests from ended leases, including separate filters. A denied request with future proposed dates is no longer described as an ended tenancy.
- Property cards no longer turn unavailable counts into zeros. A pending-authority fixture shows unknown counts and explains the verification requirement; the verified building shows three units and its actual lease/request counts.

Additional rental checks used an explicitly synthetic building, three units, local authority rows, and a seeded pending request. These fixtures bypass initial address/authority onboarding only; they are not evidence that those onboarding services work. Empty/reversed unit ranges were rejected. A valid range was refused because the fictional building lacked a validated address, with the original batch retained after reload. Verified and unverified units showed appropriate Active/Vacant/Unavailable states; an unrelated account could not read property details. Tenant invitations rejected malformed email and reversed dates, returned a link with honest email-delivery wording, and were accepted by the intended synthetic recipient. Resident access persisted after reload. Request approval rejected reversed dates and a building-level request without a unit. A seeded unit-level request then approved successfully, cleared the queue and restored the synthetic resident’s access. This covers approval against a verified local authority fixture, not initial request/authority onboarding. Denial, lease filters, cancellation of lease termination, confirmed termination, ended-history retention and loss of the former resident's dashboard access were exercised. The denied-access page returned to Place successfully.

The local database still has `plans` and `plans_playdates` disabled. No launch flag was enabled to manufacture coverage. Provider-backed unit creation, fresh landlord-authority verification and initial tenant-request onboarding, ownership-verification completion, live payments/OAuth, delivery workers and other browser engines remain outside the evidence above. All people, documents and rental records used here were synthetic; no real tenancy, payment, production database or real-person notification was involved.

Final checks for this continued batch: the production build and zero-error type gate passed; ESLint had zero errors and 1,032 existing warnings; all 123 existing web suites / 2,383 tests and five relevant Hub/landlord backend suites / 200 tests passed. Backend syntax and diff checks passed. On the final standalone production server, the request card and denial dialog named the correct unit, Escape canceled and returned focus to Deny, submitting cleared the queue after reload, and the same recipient retained their separately approved unit's resident dashboard. The earlier unit-level approval persisted as “You’re part of this household.” Only the in-app browser was available through the browser inventory. The local production server and isolated backend remain running for inspection.


## Pulse media, recovery and backend integration — October 18

After the founder's web-only clarification, this pass used real browser journeys and production builds. No further local unit-test runs were performed and no unit tests were added. Subsequent changes in this pass are confined to the web app. Backend findings were handed to the backend owner with the founder's explicit authorization.

Additional reproduced defects and web repairs:

- The global post composer closed and lost selected attachments after media upload failed, while claiming the post was complete and offering a nonexistent re-upload action. It now retains the draft, files and creation idempotency key, explains the partial save, and permits retry. Blocking the local upload request produced the warning; restoring the connection and retrying attached the PNG to the same post, without increasing the post count. A single-flight guard prevents overlapping creation. My Posts now refreshes immediately after global creation and invalidates retained list data.
- The picker accepted ten files while the upload API permits nine. It now rejects excess selections without dropping existing files, and rejects empty, unsupported and oversized media with actionable feedback. Nine distinct PNGs uploaded successfully; a tenth was refused with all nine retained. A zero-byte PNG and a file over the 10 MB image limit were refused. Preview URLs are released when selection changes or the composer closes, instead of accumulating on each render.
- Video previews tried to decode the MP4 as an image when no thumbnail existed. Composer previews now use video; cards/panels use the existing play placeholder in that case. A synthetic one-second MP4 uploaded, opened and played with ready state 4 and no media error. The nine-image gallery survived reload, wrapped from 9 to 1, supported left-arrow navigation and closed independently of the reply panel.
- Event creation and editing accepted end-before-start ranges. The web form now rejects end-without-start and end-at-or-before-start while retaining the draft. A corrected November 25 14:00–16:00 range and venue survived reload. Optional undated events remain supported. The server invariant is separately owned by PR #2434.
- Cards omitted saved titles, and reply panels omitted event/deal/lost-and-found/service details. These now share the existing metadata presentation across cards, panels and full pages, including category values saved on questions and recommendations. A lost-and-found title/contact choice, a deal title/business/expiry, and a recommendation category were checked in the browser. A long uninterrupted event title overflowed the reply panel; title and metadata wrapping now retain the content on narrow screens.
- Mark Solved changed the server but left My Posts showing the action until reload. The action now updates retained lists immediately, prevents repeat clicks and reports failures. A new question changed to Solved immediately and remained solved after reload. More than three tags are refused before submission with the draft retained.
- The global intent picker offered Service and Announce even though its own identity validation rejects them. It now uses the same existing allowed-type list as submission. Existing saved posts remain editable. The global identity picker also labels business identities unavailable, matching the backend's existing refusal of business-authored Pulse posts; it retains personal and Home posting. The Sports starter replaces the internal `scope: rec` label with Recreational sports.
- Composer place search now shows Searching during its debounce/request rather than briefly claiming no results or showing stale suggestions. The local provider failure displayed retry guidance. Shared post-link handling preserves native cancellation and falls back to clipboard on other native-share failures; native OS sharing and the fallback success path remain unverified in this browser.
- The viewing-location dialog displayed an empty-account prompt after a failed read and required closing/reopening to retry. It now offers an in-place retry, retains real save failures, and prevents overlapping pin/save requests. A real local database read refusal showed the error without the false empty prompt; restoring the database grant and pressing Try again recovered the existing pinned Home. A refused recent-history write preserved the old selection/pin; retry after recovery succeeded. A business location with no usable coordinates was selectable and produced a raw latitude validation error; unavailable choices are now labeled and disabled.

Additional browser evidence: a recommendation's Save action appeared in Saved and survived reload; a reply sent at a 390-pixel viewport persisted after reload; the reply Send control and media lightbox fit that viewport; hiding alerts persisted and removed the existing synthetic alert, and restoring the preference returned it. The map marker opened the right preview and post, an Events filter settled at zero visible posts, and returning to All/List recovered the alert. A Sports pickup starter populated its draft and retained it with clear missing-location guidance; publishing through device GPS remains unverified. Temporary database refusals, role changes, browser network blocking and viewport overrides were restored after each check.

### Backend PR combinations tested locally

The founder identified PRs #2430, #2431 and #2432. Their code was applied to an untracked backend snapshot outside the repository, along with their additive migrations in this audit's isolated local database. The later household/event fix in #2434 was added to that snapshot. These changes are not duplicated in the web branch, merged or deployed. Exact tested heads:

- #2430 `4abcd27fcf0536c77fac0ccbc686afeaa9c155f1`: a synthetic manager created and completed a task through the browser. The completed task survived reload and was readable by another household account. An owner-created task's Delete control remained disabled, and direct household document access was refused. The original member role was restored. Plans remain disabled, so canceled-plan native/browser flows were not activated here.
- #2431 `6a900580b4c5263138ff902ffddc398e442fa273`: selected a saved Home, pinned it, reloaded, exercised actual read/save refusals and recovered through the web dialog as described above.
- #2432 `c3c715171764a7b7e3d6dd376be26d4b82b31591`: included in the local backend during those browser journeys; its metrics aggregation/privacy behavior is covered by its owning backend PR, not claimed as a separate web UI feature test.
- #2434 `db806c7dc50b57a43a709b7755b732dd42450b81`: another eligible household member read an event and replied. The reply survived reload in both reader and author accounts. Temporarily deactivating that reader's occupancy made the same URL unavailable on reload; the original occupancy was restored. An unrelated synthetic resident was also refused. A signed-out reader saw only the private-post notice; Sign In To View returned an eligible account to the event and saved reply. This supplies the browser reload/revocation follow-through requested in that backend draft; native checks remain with their owning sessions.

The same provider, device and credential-dependent limitations recorded above still apply. Local timings are not production latency guarantees. No launch flags were enabled, hosted configuration changed or messages sent to real people.

Final checks for this batch: the production build completed with TypeScript validation enabled and no build errors; lint completed with existing warnings. The final standalone build showed the restricted global choices and disabled business identity explanation, readable Sports labels, persisted post metadata and the unavailable-coordinate location state. The narrow event title measured 349 pixels wide with a 349-pixel scroll width in the reply panel, after previously overflowing to 1,134 pixels. `git diff --check` passed. No additional local unit tests were run.

### Final comment attachment check

The final browser pass reproduced two further comment issues: a zero-byte image was accepted, and selecting five images silently discarded the fifth. The comment picker now rejects empty, oversized, unsupported and excess selections with a visible error, retaining the text and existing attachments. In the rebuilt production app, a zero-byte PNG, a PNG over 10 MB and an MP4 were refused; adding four images to an existing one left that original image and text intact. Selecting three additional images then reached the supported four-image limit.

Blocking the comment-media request saved the text and displayed the partial-upload warning while retaining all four images. Restoring the connection and pressing Send attached the four distinct images without creating another comment. The total stayed at three comments after reload, and the second household account saw the same text and four attachments. A separate threaded reply with an emoji and PNG also persisted; opening that attachment displayed the expected image.

An unavailable comment avatar now falls back to the author's initial. The observed failure came from intentionally blocked loopback image optimization in the local production harness; the production optimizer's host restrictions remain unchanged. This confirms graceful failure, not hosted avatar-delivery availability. The production build and ESLint passed after these changes (zero lint errors, 1,032 existing warnings); no local unit tests were run. Browser network blocking was removed, and the synthetic services remain running for inspection.


## Startup, navigation and route follow-through — November 4

This pass focused on opening/refreshing the web app and navigating between pages, using Chrome with a real local backend, database and synthetic accounts. It produced five separate code PRs. This session did not merge or change production infrastructure. Other review sessions merged some earlier performance PRs during the audit; the measurements below identify their own baseline and do not claim production results.

### Measured repairs

| Repair | Before | After | PR |
| --- | --- | --- | --- |
| Dependencies before session recovery | 258,389 bytes of JavaScript transferred before the refresh request; median request start 2,221 ms | 211,294 bytes (18% less); median request start 1,964 ms | [#3261](https://github.com/WangPantopus/skinny-pantopus/pull/3261) |
| Today navigation warm-up | Initial load plus two hovers six seconds apart made three briefing reads while the page still considered its data fresh | One briefing read; manual Refresh still makes another immediate read | [#3262](https://github.com/WangPantopus/skinny-pantopus/pull/3262) |
| Explicit business chat identity | A business request could fall back to the caller's personal room/history, then fail on subsequent sync/read calls | Missing business authority/membership gives a consistent refusal; personal and authorized business conversations still work | [#3263](https://github.com/WangPantopus/skinny-pantopus/pull/3263) |
| Business profile settings on narrow screens | A 390 px viewport had a 402 px document and a clipped Dashboard action | Header actions fit at 320, 390, 768 and 1,440 px, with document width equal to viewport width | [#3267](https://github.com/WangPantopus/skinny-pantopus/pull/3267) |
| Invalid session recovery | Two refresh/logout pairs normally; seven pairs with sign-in navigation delayed by one second | One refresh and one logout, including when the logout request fails | [#3269](https://github.com/WangPantopus/skinny-pantopus/pull/3269) |

The import comparison used production builds from `ec29d0419` and `29b09cfbb`, three alternating runs per build, Chrome at 100 ms latency / 1.5 Mbps download / 4× CPU throttling, and a cold HTTP cache. Each run had its own real login, the same browser origin for login and reload, and only its access cookie removed. Median inbox visibility was 5,432 ms before and 5,228 ms after. This demonstrates an incremental startup gain; it does **not** demonstrate that the reported production 5–10 second delay is resolved. No elapsed-time claim from the earlier cross-origin session benchmark is reused here.

The Today change shares the screen's existing two-minute freshness policy with the sidebar. It does not add a longer cache window. The session-failure check delayed only the final sign-in document, and used the real backend's refusal of a synthetic invalid session. A separate injected temporary 503 preserved the session; removing the fault and pressing Try again recovered Messages without logging out. Blocking logout still cleared the browser's session flag and reached sign-in.

### Coverage and verified flows

- Inventoried all **321** page files at the audit baseline: **177** production routes outside the launch cut, **137** launch-cut routes, and **7** development routes.
- Ran **319 browser entry probes** at desktop width. Session recovery was exercised separately; the OAuth callback requires its provider handoff. The probe set included redirects, missing-resource cases, refusals, empty states and ordinary content. There were no JavaScript page errors or document-level horizontal overflow in that pass. A successful probe is not a completed flow.
- Repeated **94** core app route probes at 390 px. Then used a real synthetic business owner for **18** additional business routes at 390 px. That second pass found the profile settings overflow repaired in #3267. Large map tiles/SVGs clipped inside their map viewport did not produce document overflow.
- Confirmed HTTP redirects for all **137** launch-cut route patterns with a signed-in browser context: 136 reached Place and the Mailbox entry reached Messages. Representative Mailbox, Marketplace, Scheduling, Audience and Professional entries were also opened in the browser. Flags stayed off. Development routes returned production 404s. `/app/plans` has no page in this inventory and correctly showed the not-found screen.
- Verified chat send, recipient view, reload persistence, opening the floating inbox/conversation, sign-out and switching accounts after the dependency change. For the business repair, a customer opened an inquiry from a published synthetic business profile, the owner replied as the business, and both views survived reload. The customer could still open their own conversation but could not assume the business identity. A named business could no longer open the owner's unrelated personal room.
- Completed the business onboarding wizard, optional location/hours/media skips, publish, and dashboard reload. Created a catalog item, edited it, and checked its saved name after reload. Saved a business tagline and reloaded; unpublish/publish and Dashboard navigation worked after the layout repair.
- Created a household task, reloaded, completed it, reloaded the Done list, and reopened it. These actions used existing authorized Home data and the real backend.

The initial generic sweep had **49 dynamic route patterns without a matching positive fixture**. The subsequent owner pass supplied valid fixtures for 18 of those business routes. The matrix below preserves which remaining entries were only missing-resource/refusal probes. A route with a valid fixture can still have untested roles, buttons and edge cases. Older October results above remain historical context, not fresh verification of every flow.

The external link-preview failure seen on a synthetic feed link returned a handled fallback with the link still usable. It was not counted as a successful provider fetch. The suspected idle map-prefetch/sign-out race did not reproduce through the real app's sign-out navigation, so no speculative code change was made for it.

### Checks and remaining work

The startup and Today changes each passed a production build, the zero-error typecheck gate and all 123 existing web suites / 2,383 tests. The business membership change passed 342 existing backend suites / 6,632 tests (the existing one suite / 16 tests remained skipped) and all privacy gates. The invalid-session repair passed its production build, typecheck gate and two relevant existing suites / 23 tests. The CSS-only repair used the local development app for browser verification and passed targeted ESLint and typecheck. No unit-test files were added; existing assertions were adjusted for changed behavior.

Remaining release verification includes authorized admin workflows; the other household/landlord/guest/invitation/ownership roles and valid tokenized links; business location and page-editor fixtures; support-train participation and lifecycle combinations; native apps; Safari/Firefox; assistive technology; long histories and large-media stress; and provider-backed address, identity, OAuth, payment and delivery behavior. This pass does not certify those flows. Production cold/warm traces, API/DB timing distributions, saturation and regional latency are still needed to decide which infrastructure change addresses the reported delay.

The comprehensive infrastructure proposal is in [#3253](https://github.com/WangPantopus/skinny-pantopus/pull/3253). Infrastructure diagnosis can proceed alongside the remaining code checks. The route inventory and the newly reproduced defects do not support calling the web/backend work finished or assuming an infrastructure migration alone will solve startup latency.

<details>
<summary>Route-by-route entry coverage (not full-flow certification)</summary>

| Route pattern | Entry check | Narrow viewport |
| --- | --- | --- |
| `/` | Entry/redirect/state probe | — |
| `/[username]` | Entry/redirect/state probe | — |
| `/about` | Entry/redirect/state probe | — |
| `/app` | Entry/redirect/state probe | 390 px |
| `/app/address-verify` | Entry/redirect/state probe | 390 px |
| `/app/admin/reports` | Entry/redirect/state probe | 390 px |
| `/app/admin/review-claims` | Entry/redirect/state probe | 390 px |
| `/app/admin/verification` | Entry/redirect/state probe | 390 px |
| `/app/audience` | Launch-cut redirect | — |
| `/app/audience/inbox` | Launch-cut redirect | — |
| `/app/audience/inbox/[membershipId]` | Launch-cut redirect | — |
| `/app/audience/manage/blocks` | Launch-cut redirect | — |
| `/app/audience/manage/tiers` | Launch-cut redirect | — |
| `/app/audience/membership/[personaId]` | Launch-cut redirect | — |
| `/app/audience/membership/[personaId]/inbox` | Launch-cut redirect | — |
| `/app/audience/setup` | Launch-cut redirect | — |
| `/app/beacons` | Launch-cut redirect | — |
| `/app/business/[id]/activity` | Valid business-owner entry | 390 px |
| `/app/business/[id]/catalog` | Valid business-owner entry | 390 px |
| `/app/business/[id]/catalog/[itemId]/edit` | Valid business-owner entry | 390 px |
| `/app/business/[id]/catalog/new` | Valid business-owner entry | 390 px |
| `/app/business/[id]/dashboard` | Valid business-owner entry | 390 px |
| `/app/business/[id]/inbox` | Valid business-owner entry | 390 px |
| `/app/business/[id]/inbox/[roomId]` | Valid business-owner entry | 390 px |
| `/app/business/[id]/insights` | Valid business-owner entry | 390 px |
| `/app/business/[id]/locations` | Valid business-owner entry | 390 px |
| `/app/business/[id]/locations/[locId]/hours` | Missing-resource/refusal probe only | — |
| `/app/business/[id]/pages` | Valid business-owner entry | 390 px |
| `/app/business/[id]/reviews` | Valid business-owner entry | 390 px |
| `/app/business/[id]/settings/legal` | Valid business-owner entry | 390 px |
| `/app/business/[id]/settings/profile` | Valid business-owner entry | 320–1,440 px; repaired #3267 |
| `/app/business/[id]/team` | Valid business-owner entry | 390 px |
| `/app/business/[id]/team/invite` | Valid business-owner entry | 390 px |
| `/app/business/new` | Entry/redirect/state probe | 390 px |
| `/app/businesses` | Entry/redirect/state probe | 390 px |
| `/app/businesses/[id]/chat` | Valid business-owner entry | 390 px |
| `/app/businesses/[id]/chat/[roomId]` | Valid business-owner entry | 390 px |
| `/app/businesses/[id]/dashboard` | Valid business-owner entry | 390 px |
| `/app/businesses/[id]/pages/[pageId]/edit` | Missing-resource/refusal probe only | — |
| `/app/businesses/new` | Entry/redirect/state probe | 390 px |
| `/app/chat` | Entry/redirect/state probe | 390 px |
| `/app/chat/[roomId]` | Entry/redirect/state probe | 390 px |
| `/app/chat/ai-assistant` | Entry/redirect/state probe | 390 px |
| `/app/chat/conversation/[otherUserId]` | Entry/redirect/state probe | 390 px |
| `/app/chat/new` | Entry/redirect/state probe | 390 px |
| `/app/connections` | Entry/redirect/state probe | 390 px |
| `/app/control-center` | Entry/redirect/state probe | 390 px |
| `/app/discover` | Entry/redirect/state probe | 390 px |
| `/app/discover-hub` | Launch-cut redirect | — |
| `/app/feed` | Entry/redirect/state probe | 390 px |
| `/app/feed/post/[id]` | Entry/redirect/state probe | 390 px |
| `/app/gigs` | Launch-cut redirect | — |
| `/app/gigs-v2` | Launch-cut redirect | — |
| `/app/gigs-v2/[id]` | Missing-resource/refusal probe only | — |
| `/app/gigs-v2/new` | Launch-cut redirect | — |
| `/app/gigs/[id]` | Missing-resource/refusal probe only | — |
| `/app/gigs/[id]/edit` | Launch-cut redirect | — |
| `/app/gigs/[id]/review` | Missing-resource/refusal probe only | — |
| `/app/gigs/new` | Launch-cut redirect | — |
| `/app/gigs/saved` | Launch-cut redirect | — |
| `/app/homes` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/access` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/bills` | Launch-cut redirect | — |
| `/app/homes/[id]/calendar` | Launch-cut redirect | — |
| `/app/homes/[id]/claim-owner/evidence` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/claim-owner/submitted` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/dashboard` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/dispute` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/docs` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/edit` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/emergency` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/invitations` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/maintenance` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/members` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/members/add-guest` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/message` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/messages` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/owners` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/owners/invite` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/owners/review-claim` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/owners/review-claim/history` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/owners/review-claim/relationship` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/owners/review-claim/residency` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/owners/transfer` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/packages` | Launch-cut redirect | — |
| `/app/homes/[id]/pets` | Launch-cut redirect | — |
| `/app/homes/[id]/polls` | Launch-cut redirect | — |
| `/app/homes/[id]/privacy` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/property-details` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/residency` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/scheduling` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/availability` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/events/[eventId]` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/events/new` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/find-a-time` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/resources` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/resources/[rid]` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/resources/[rid]/book` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/resources/[rid]/edit` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/resources/new` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/visits/[visitId]` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/visits/new` | Launch-cut redirect | — |
| `/app/homes/[id]/scheduling/whos-free` | Launch-cut redirect | — |
| `/app/homes/[id]/settings` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/settings/security` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/share` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/tasks` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/tasks/[taskId]` | Missing-resource/refusal probe only | 390 px |
| `/app/homes/[id]/verify-landlord` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/verify-landlord/details` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/verify-landlord/submitted` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/verify-postcard` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/verify-residency` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/verify-residency/submitted` | Entry/redirect/state probe | 390 px |
| `/app/homes/[id]/waiting-room` | Entry/redirect/state probe | 390 px |
| `/app/homes/find` | Entry/redirect/state probe | 390 px |
| `/app/homes/invite` | Entry/redirect/state probe | 390 px |
| `/app/homes/member-removals` | Entry/redirect/state probe | 390 px |
| `/app/homes/new` | Entry/redirect/state probe | 390 px |
| `/app/hub` | Entry/redirect/state probe | 390 px |
| `/app/hub/today` | Entry/redirect/state probe | 390 px |
| `/app/identity` | Launch-cut redirect | — |
| `/app/identity/preview` | Launch-cut redirect | — |
| `/app/invoice/[id]` | Missing-resource/refusal probe only | — |
| `/app/invoices` | Entry/redirect/state probe | 390 px |
| `/app/landlord/properties` | Entry/redirect/state probe | 390 px |
| `/app/landlord/properties/[homeId]` | Entry/redirect/state probe | — |
| `/app/listing-offers` | Launch-cut redirect | — |
| `/app/mailbox` | Launch-cut redirect | — |
| `/app/mailbox/_legacy_detail` | Launch-cut redirect | — |
| `/app/mailbox/[drawer]` | Launch-cut redirect | — |
| `/app/mailbox/[drawer]/[item_id]` | Launch-cut redirect | — |
| `/app/mailbox/booklet` | Launch-cut redirect | — |
| `/app/mailbox/cards` | Launch-cut redirect | — |
| `/app/mailbox/certified` | Launch-cut redirect | — |
| `/app/mailbox/community` | Launch-cut redirect | — |
| `/app/mailbox/counter` | Launch-cut redirect | — |
| `/app/mailbox/coupon` | Launch-cut redirect | — |
| `/app/mailbox/deleted` | Launch-cut redirect | — |
| `/app/mailbox/disambiguate` | Launch-cut redirect | — |
| `/app/mailbox/earn/wallet` | Launch-cut redirect | — |
| `/app/mailbox/gig` | Launch-cut redirect | — |
| `/app/mailbox/map` | Launch-cut redirect | — |
| `/app/mailbox/memory` | Launch-cut redirect | — |
| `/app/mailbox/package` | Launch-cut redirect | — |
| `/app/mailbox/party` | Launch-cut redirect | — |
| `/app/mailbox/records` | Launch-cut redirect | — |
| `/app/mailbox/records/[asset_id]` | Launch-cut redirect | — |
| `/app/mailbox/search` | Launch-cut redirect | — |
| `/app/mailbox/settings/mail-day` | Launch-cut redirect | — |
| `/app/mailbox/settings/themes` | Launch-cut redirect | — |
| `/app/mailbox/stamps` | Launch-cut redirect | — |
| `/app/mailbox/tasks` | Launch-cut redirect | — |
| `/app/mailbox/translation` | Launch-cut redirect | — |
| `/app/mailbox/travel` | Launch-cut redirect | — |
| `/app/mailbox/unboxing` | Launch-cut redirect | — |
| `/app/mailbox/vacation` | Launch-cut redirect | — |
| `/app/mailbox/vault` | Launch-cut redirect | — |
| `/app/mailbox/vault/[folder_id]` | Launch-cut redirect | — |
| `/app/mailbox/vault/archived` | Launch-cut redirect | — |
| `/app/map` | Entry/redirect/state probe | 390 px |
| `/app/marketplace` | Launch-cut redirect | — |
| `/app/marketplace/[id]` | Launch-cut redirect | — |
| `/app/marketplace/[id]/edit` | Launch-cut redirect | — |
| `/app/marketplace/[id]/messages` | Launch-cut redirect | — |
| `/app/my-bids` | Launch-cut redirect | — |
| `/app/my-gigs` | Entry/redirect/state probe | 390 px |
| `/app/my-gigs-v2` | Entry/redirect/state probe | 390 px |
| `/app/my-listings` | Launch-cut redirect | — |
| `/app/my-pulse` | Entry/redirect/state probe | 390 px |
| `/app/nearby` | Entry/redirect/state probe | 390 px |
| `/app/neighborhood` | Entry/redirect/state probe | 390 px |
| `/app/network` | Entry/redirect/state probe | 390 px |
| `/app/notifications` | Entry/redirect/state probe | 390 px |
| `/app/offers` | Launch-cut redirect | — |
| `/app/persona` | Launch-cut redirect | — |
| `/app/persona/[handle]/follow` | Launch-cut redirect | — |
| `/app/persona/broadcast` | Launch-cut redirect | — |
| `/app/place` | Entry/redirect/state probe | 390 px |
| `/app/place/[section]` | Entry/redirect/state probe | — |
| `/app/place/neighbor-message` | Entry/redirect/state probe | 390 px |
| `/app/place/neighbor-message/[id]` | Missing-resource/refusal probe only | — |
| `/app/place/pulse` | Entry/redirect/state probe | 390 px |
| `/app/place/scout` | Entry/redirect/state probe | 390 px |
| `/app/professional` | Launch-cut redirect | — |
| `/app/profile` | Entry/redirect/state probe | 390 px |
| `/app/profile/edit` | Entry/redirect/state probe | 390 px |
| `/app/profile/settings` | Entry/redirect/state probe | 390 px |
| `/app/profile/settings/blocked` | Entry/redirect/state probe | 390 px |
| `/app/profile/settings/password` | Entry/redirect/state probe | 390 px |
| `/app/profile/settings/privacy` | Entry/redirect/state probe | 390 px |
| `/app/saved-listings` | Launch-cut redirect | — |
| `/app/scheduling` | Launch-cut redirect | — |
| `/app/scheduling/availability` | Launch-cut redirect | — |
| `/app/scheduling/availability/[id]` | Launch-cut redirect | — |
| `/app/scheduling/availability/blocks` | Launch-cut redirect | — |
| `/app/scheduling/booking-page` | Launch-cut redirect | — |
| `/app/scheduling/booking-page/embed` | Launch-cut redirect | — |
| `/app/scheduling/booking-page/one-off` | Launch-cut redirect | — |
| `/app/scheduling/booking-page/preview` | Launch-cut redirect | — |
| `/app/scheduling/bookings` | Launch-cut redirect | — |
| `/app/scheduling/bookings/[id]` | Launch-cut redirect | — |
| `/app/scheduling/bookings/[id]/roster` | Launch-cut redirect | — |
| `/app/scheduling/bookings/manual` | Launch-cut redirect | — |
| `/app/scheduling/bookings/search` | Launch-cut redirect | — |
| `/app/scheduling/business` | Launch-cut redirect | — |
| `/app/scheduling/business/members/[memberId]/hours` | Launch-cut redirect | — |
| `/app/scheduling/business/team-availability` | Launch-cut redirect | — |
| `/app/scheduling/connected-calendars` | Launch-cut redirect | — |
| `/app/scheduling/event-types` | Launch-cut redirect | — |
| `/app/scheduling/event-types/[id]` | Launch-cut redirect | — |
| `/app/scheduling/event-types/[id]/questions` | Launch-cut redirect | — |
| `/app/scheduling/insights` | Launch-cut redirect | — |
| `/app/scheduling/insights/event-types` | Launch-cut redirect | — |
| `/app/scheduling/insights/no-shows` | Launch-cut redirect | — |
| `/app/scheduling/insights/team` | Launch-cut redirect | — |
| `/app/scheduling/invoices` | Entry/redirect/state probe | 390 px |
| `/app/scheduling/invoices/[id]` | Missing-resource/refusal probe only | — |
| `/app/scheduling/my-bookings` | Launch-cut redirect | — |
| `/app/scheduling/my-bookings/recurring` | Launch-cut redirect | — |
| `/app/scheduling/my-packages` | Entry/redirect/state probe | 390 px |
| `/app/scheduling/packages` | Entry/redirect/state probe | 390 px |
| `/app/scheduling/packages/[id]/edit` | Missing-resource/refusal probe only | — |
| `/app/scheduling/payments` | Entry/redirect/state probe | 390 px |
| `/app/scheduling/payments/policy` | Launch-cut redirect | — |
| `/app/scheduling/reminders` | Launch-cut redirect | — |
| `/app/scheduling/settings` | Launch-cut redirect | — |
| `/app/scheduling/settings/channels` | Launch-cut redirect | — |
| `/app/scheduling/settings/notifications` | Launch-cut redirect | — |
| `/app/scheduling/setup` | Launch-cut redirect | — |
| `/app/scheduling/setup/onboarding` | Launch-cut redirect | — |
| `/app/scheduling/templates` | Launch-cut redirect | — |
| `/app/scheduling/templates/[id]` | Launch-cut redirect | — |
| `/app/scheduling/waitlist` | Launch-cut redirect | — |
| `/app/scheduling/workflows` | Launch-cut redirect | — |
| `/app/scheduling/workflows/[id]` | Launch-cut redirect | — |
| `/app/settings/notifications` | Entry/redirect/state probe | 390 px |
| `/app/settings/payments` | Entry/redirect/state probe | 390 px |
| `/app/settings/security` | Entry/redirect/state probe | 390 px |
| `/app/support-trains` | Entry/redirect/state probe | 390 px |
| `/app/support-trains/[id]` | Missing-resource/refusal probe only | — |
| `/app/support-trains/[id]/calendar` | Missing-resource/refusal probe only | — |
| `/app/support-trains/[id]/manage` | Missing-resource/refusal probe only | — |
| `/app/support-trains/new` | Entry/redirect/state probe | 390 px |
| `/app/today` | Entry/redirect/state probe | 390 px |
| `/app/wallet` | Entry/redirect/state probe | 390 px |
| `/auth/callback` | Provider handoff not exercised | — |
| `/b/[username]` | Entry/redirect/state probe | — |
| `/b/[username]/[slug]` | Missing-resource/refusal probe only | — |
| `/book/[slug]` | Launch-cut redirect | — |
| `/book/[slug]/[eventType]` | Launch-cut redirect | — |
| `/book/[slug]/[eventType]/confirm` | Launch-cut redirect | — |
| `/book/[slug]/embed` | Launch-cut redirect | — |
| `/book/[slug]/packages/[packageId]` | Missing-resource/refusal probe only | — |
| `/book/o/[token]` | Launch-cut redirect | — |
| `/booking/[token]` | Launch-cut redirect | — |
| `/booking/[token]/cancel` | Launch-cut redirect | — |
| `/booking/[token]/confirmed` | Launch-cut redirect | — |
| `/booking/[token]/reschedule` | Launch-cut redirect | — |
| `/booking/[token]/states` | Launch-cut redirect | — |
| `/chat-offline` | Entry/redirect/state probe | — |
| `/child-safety` | Entry/redirect/state probe | — |
| `/contact` | Entry/redirect/state probe | — |
| `/dashboard` | Entry/redirect/state probe | — |
| `/delete-account` | Entry/redirect/state probe | — |
| `/dev/ballot` | Production 404 | — |
| `/dev/place` | Production 404 | — |
| `/dev/place-dashboard` | Production 404 | — |
| `/dev/place-detail` | Production 404 | — |
| `/dev/place-neighbor-message` | Production 404 | — |
| `/dev/place-pulse` | Production 404 | — |
| `/dev/start-preview` | Production 404 | — |
| `/forgot-password` | Entry/redirect/state probe | — |
| `/fridge-card/[code]` | Missing-resource/refusal probe only | — |
| `/gig/[id]` | Missing-resource/refusal probe only | — |
| `/gigs` | Launch-cut redirect | — |
| `/gigs/[id]` | Missing-resource/refusal probe only | — |
| `/gigs/[id]/edit` | Missing-resource/refusal probe only | — |
| `/gigs/[id]/review` | Missing-resource/refusal probe only | — |
| `/gigs/new` | Launch-cut redirect | — |
| `/guest/[token]` | Missing-resource/refusal probe only | — |
| `/homes` | Entry/redirect/state probe | — |
| `/homes/[id]/edit` | Missing-resource/refusal probe only | — |
| `/homes/new` | Entry/redirect/state probe | — |
| `/identity-check/done` | Entry/redirect/state probe | — |
| `/invite/[token]` | Missing-resource/refusal probe only | — |
| `/invite/seat` | Entry/redirect/state probe | — |
| `/join/[code]` | Missing-resource/refusal probe only | — |
| `/listing/[id]` | Launch-cut redirect | — |
| `/listings/[id]` | Launch-cut redirect | — |
| `/login` | Entry/redirect/state probe | — |
| `/marketplace/[id]` | Launch-cut redirect | — |
| `/no-mail/[code]` | Missing-resource/refusal probe only | — |
| `/open/[mailId]` | Launch-cut redirect | — |
| `/persona/[personaHandle]` | Launch-cut redirect | — |
| `/plans/[id]` | Missing-resource/refusal probe only | — |
| `/plans/unsubscribe` | Entry/redirect/state probe | — |
| `/poll/[id]` | Launch-cut redirect | — |
| `/post/[id]` | Entry/redirect/state probe | — |
| `/posts/[id]` | Entry/redirect/state probe | — |
| `/privacy` | Entry/redirect/state probe | — |
| `/profile` | Entry/redirect/state probe | — |
| `/profile/edit` | Entry/redirect/state probe | — |
| `/profile/settings` | Entry/redirect/state probe | — |
| `/register` | Entry/redirect/state probe | — |
| `/reset-password` | Entry/redirect/state probe | — |
| `/session/refresh` | Success, transient, invalid and failed-logout journeys | — |
| `/shared/[token]` | Missing-resource/refusal probe only | — |
| `/start` | Entry/redirect/state probe | — |
| `/status/[token]` | Missing-resource/refusal probe only | — |
| `/support-trains/[id]` | Missing-resource/refusal probe only | — |
| `/terms` | Entry/redirect/state probe | — |
| `/u/[username]` | Entry/redirect/state probe | — |
| `/unlisted` | Entry/redirect/state probe | — |
| `/verify-claim` | Entry/redirect/state probe | — |
| `/verify-claim/[code]` | Missing-resource/refusal probe only | — |
| `/verify-email` | Entry/redirect/state probe | — |
| `/verify-email-sent` | Entry/redirect/state probe | — |
| `/verify-residency` | Entry/redirect/state probe | — |
| `/verify-residency/[code]` | Missing-resource/refusal probe only | — |

</details>
