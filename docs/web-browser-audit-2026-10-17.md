# Web browser audit — October 17, 2026

## Scope and environment

This is the first web-only audit requested by the founder. The branch started from freshly fetched `origin/master` at `5c64fe823f113bf89e7a855486c2e9f2aeef2b43`; master CI and its backend deployment were successful. A second fetch before delivery still resolved master to that commit. Open PRs were checked for overlapping work.

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

- Provider-backed address autocomplete/validation, ownership/residency document review, postcard delivery, property enrichment, uploads, OAuth, payments/payouts and device notifications were not verified end to end. Address suggestions and air-quality data were unavailable with this local configuration. AI drafting failed safely with a working manual fallback. No provider credentials were added to make these paths appear verified.
- Device-GPS personal posting was not exercised; the verified-home posting path was. Other browsers, assistive technologies and physical-device web behavior still need their own checks.
- The full home sidebar is still displayed on private-setup and refused-home pages, so some links lead to clear permission-denied states. The underlying records were protected in the tested cases; permission-aware navigation remains a separate UX improvement.
- Administrative/landlord review, ownership transfers/disputes, account deletion, all upload formats, all recurring-task permutations, all payment states and every public/business detail record were not exhaustively exercised. Launch-cut features were checked for being inaccessible, not activated or audited internally.

Raw local fixtures, credentials, mail contents, screenshots and operator logs are excluded from this report and Git. This pass is evidence for the named journeys and repairs, not a claim that every button, feature or external integration has been certified.
