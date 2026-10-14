# PS — Safety, composer checks and moderation

You build what keeps Pulse calm: the composer checks that catch call-outs and private details before posting, the private note, and the moderation workflow (held, removed, appeals, slow mode, bans, crisis handling) with its console. Read [README](../README.md), [build spec](../01-build-spec.md) (sections 5, 6, 9, 12, 13), [contract](../02-contract.md), [delivery plan](../03-delivery-plan.md) and [verification](../04-verification.md) first.

## Owns and does not own

- **Owns:** `backend/services/pulse/safety/*`, `backend/routes/pulseSafety.js`, `backend/routes/adminReports.js`, the web admin pages under `frontend/apps/web/src/app/(app)/app/admin/` (`reports`, and a new moderation view), your two tables (`ModerationAction`, `ModerationAppeal`), and your notification copy.
- **PB owns** `posts.js`, `feedService.js` and the contract. You expose **functions** PB's create handler calls (`evaluateComposerChecks`) and **state** PB's read paths honor (`moderation_state` on `Post` and `PostComment`); you never edit PB's files. Ask PB under "Requests" in your status file.
- **The web is mobile-only for new builds**, except the moderator console and public pages (a founder exception recorded in the README): keep the console small and plain, reusing the existing admin pages and components.

## Code map (verified on master)

| What | Where |
|---|---|
| Today's composer advice: regex tone, call-out, politics, intent checks, fail-open `POST /api/posts/precheck` | `backend/routes/posts.js` ~806–905; cooldown table `UserPostingCooldown` is read there and never written |
| AI (Claude Sonnet 5.5) | `backend/config/anthropic.js`; `POST /api/ai/draft/post` in `backend/routes/ai.js` |
| Reports | `POST /api/posts/:id/report` (`reportPostSchema`: spam, harassment, inappropriate, misinformation, safety, other), `PostReport`, `backend/services/postReportService.js` |
| Moderator queue | `backend/routes/adminReports.js` (`GET /`, `POST /:kind/:reportId/resolve`, `POST /post/:reportId/remove`), web `/app/admin/reports`; `User.role = 'admin'`; email alert on new reports |
| Removal today | `archive_reason = 'moderation'` plus a generic notice; no held state, reasons, appeals, slow mode or bans |
| EXIF | `backend/routes/upload.js` (~120): images and comment images; not video or GIF; fails open |
| Account type | `User.account_type`; you add `official` verification to the console |

## Deliverables

- [ ] **S8 `evaluateComposerChecks(text, media, context)`** and `POST /api/pulse/composer/check` (contract 2.6). Detect: a post that names a specific home or accuses a person (**blocks** posting as written, with the three options), a visible house number, plate or phone number in the text or described in a photo (**blocks**, offer blur or edit), a heated draft (**suggests, never blocks**), national politics (suggests), a sale (Offers are free or loans: **hold** in the server path), a similar existing post or Known entry (**existing answers first**). Use Claude where it helps, with a deterministic fallback when there is no key or the call fails (`degraded: true`, never an error to the person). **Every check fails open except the two that block**, and even those never block on a failed lookup. Ship a **small written eval**: 30+ synthetic examples (call-outs vs. fine "recommend a plumber" or "thanks, Maya"), the results, and the false-positive rate, in your status file. Recommending a business and thanking a neighbor by name must never be flagged.
- [ ] **Private notes** `POST /api/pulse/notes`: short templates ("Your car's lights are on"), one note per issue per home, signed with the sender's first name and street, recipient can reply or block, repeat senders reviewed; a home not on Pantopus gets the city form only.
- [ ] **EXIF** for video and GIF uploads, or refuse them (coordinate with PB; `upload.js` is PB's).
- [ ] **S11 Moderation baseline** (needs the table approval for `ModerationAction` and `ModerationAppeal`): held (a likely rule break, a new account's link, several reports, a sale post) with "Awaiting review, usually within 2 hours" on the author's own item; removed (the rule, the reason, an appeal button); slow mode (one post and three replies a day for 30 days); ban (applies to the person); appeals (`POST /api/pulse/appeals`, a human decision); notices (`GET /api/pulse/notices`); **reports on replies** (`POST /api/pulse/posts/:postId/replies/:replyId/report`); the console: the held queue, the report queue, the actions with the rule and reason fields, appeal decisions, and Official account verification. **Heated-pair slowdown** (one reply an hour between the two people in that conversation). **Crisis flow:** a post suggesting self-harm is held, the writer sees crisis resources, staff are alerted. **Mandatory-report hooks** for the content classes the design names are built as a queue and an alert only: the actual provider or NCMEC registration is the founder's (README). **Rules screen content:** `GET /api/pulse/rules` serves the seven rules, the review hours, the appeals text and the law-enforcement policy text; the words are the founder's and counsel's, you build the endpoint and the console field that edits them.
- [ ] **S12 Known drafting and curator seeding:** draft Known entries from resolved Asks and official sources with their sources attached, label them clearly, and seed the first set for the three towns from official pages (trash and recycling are already in `AddressCalendarRule`).
- [ ] **S14:** `interestInReply(text)` for the "Not counted as going" caption (deterministic phrases, a short written eval, quiet when unsure).
- [ ] **S16–S17:** rules per place; Official verification flow; business reply cap checks; the approval queue for business offers (the "Local offers" spot) in the console; the Official's pin control (S24). **S19:** the report and hold numbers, and time to decision per moderation action.
- [ ] **S20:** rules for new code accounts (Visitor limits, held links) so sign-up by code does not become a spam door.
- [ ] **S23:** the merge tool in the console (merge, undo within 7 days) and the emergency-hold rule (a post that states a cause for an active Right now event, or blames a person or group, is held with a plain reason) with a written eval: 30+ synthetic examples and the false-positive rate in your status file.

## Rules specific to this stream

- **Visible moderation.** Every action tells the person it affects what happened, which rule and why. No silent holds or removals.
- **Paid staff, not volunteers.** There are no community moderators or admins; the console is for founder-approved staff only (`role = 'admin'` today).
- **Do not guess at people.** Never infer or store anything about an identifiable person beyond what a rule needs; never keep the text of a blocked draft.
- **Privacy:** console views never show more than a moderator needs; do not export user data; fixtures are synthetic.
- **Founder-only:** moderator hiring, hours, the NCMEC or any law-enforcement setup, the Anthropic key, any real send.
- **Hold point H2:** the public-exposure PRs (PC's S15) wait for your S11 baseline.

## Web guard (S2, small web fixes only)

No stream owns the existing web Pulse feed (`frontend/apps/web/src/components/feed/*`, `/app/feed`, `/app/feed/post/[id]`), and it must keep working while the backend adds types (`share`, `offer`), labels, statuses and fields. You own the small fixes: make the web feed and post page render unknown and new values without errors (scenario S2.2) before PB lets people create the new types. Anything bigger goes to the founder.

## Verification you own

Run the scenarios in [`05-scenarios.md`](../05-scenarios.md) for S8 (checks), S9 (slowed exchanges), S11 and S12 (drafting) through the apps and the web console. No unit tests.

With your own runtime and accounts: a call-out draft is blocked with the three options on both apps and via the API (`422`); fine drafts pass; the ladder end to end with an author, a reporter and a moderator (held → approved; removed → appeal → reversed); the author sees notices; a held item never reaches anyone but the author and staff on **any** read path (run the privacy matrix rows with PB); the console works at phone and desktop widths; the existing report flow still works.

## First three days

Build `evaluateComposerChecks` with the eval set and write its accuracy note. Draft the two moderation tables and the console wireframe-in-words for approval. Read `adminReports.js` and the web admin report page and list what changes. Write your first status entry.
