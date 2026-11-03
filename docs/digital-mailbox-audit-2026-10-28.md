# Digital mailbox audit — October 28, 2026

This audit found and repaired defects in letter reading, private enclosures,
household authorization, sending, claims, delivery notices, search and vacation
holds. Changes are committed in the review stack below. This is local
verification evidence, not approval to enable the mailbox.

## Review stack

Review in order; each PR after the first targets the preceding audit branch.

| PR | Repair |
| --- | --- |
| [2942](https://github.com/WangPantopus/skinny-pantopus/pull/2942) | Read the complete private letter, preserve enclosures after actions, and render formatted content safely. |
| [2943](https://github.com/WangPantopus/skinny-pantopus/pull/2943) | Apply current Home state to mail access, check the reader rule before a read session, and require confirmed Auth contacts for claims. |
| [2944](https://github.com/WangPantopus/skinny-pantopus/pull/2944) | Repair connected-home sending, sender eligibility, notice retries, withdrawal conflicts and native first-open timestamps. |
| [2945](https://github.com/WangPantopus/skinny-pantopus/pull/2945) | Keep holds until local 07:00, process complete large bundles, converge concurrent hold syncs, and preserve filing counts. |
| [2946](https://github.com/WangPantopus/skinny-pantopus/pull/2946) | Search full letter content and supply a dry-run repair command for older truncated rows. |
| [2947](https://github.com/WangPantopus/skinny-pantopus/pull/2947) | Use decoded text in the current iOS paper-letter layout. |
| [2948](https://github.com/WangPantopus/skinny-pantopus/pull/2948) | Keep mail and its bundle held through all connected hold windows, including the displayed final return date. |
| [2949](https://github.com/WangPantopus/skinny-pantopus/pull/2949) | Confirm the actual recipient, remove inactive compose options and unsupported timing promises, and keep native send success visible until Done. |

One additive migration (`20261028090200_mail_vacation_local_morning.sql`, a new
service-only function) must precede the backend changes. Existing migration
history and tables are preserved. The search backfill is dry-run by default;
the founder must separately review and run any hosted apply operation.

## Review changes

The review kept every repair and changed four things on top of them:

- Filing, Counter and shred no longer read the stored letter first, so a storage
  failure can't block them; the answer leaves the body out when it can't be read.
  A letter stored without a separate copy is treated as HTML when it carries tags.
- Read sessions use the existing service-only `open_mail_read_session` behind the
  new reader check, instead of a second copy of that function. No current app
  starts read sessions.
- The phones' opened time is written by `PATCH /api/mailbox/:id/view` in the API,
  instead of a replacement for `mark_mail_viewed_by_reader`.
- A vacation hold that can't be read no longer fails delivery, which silently
  dropped business bills and Pantopus letters. The piece goes out on its normal
  round and the hourly hold job re-holds it, as before.

## Local verification

All accounts, homes, letters and email recipients were synthetic. The backend,
Supabase database, private object storage and SMTP capture were isolated locally.
Web Chrome, an iOS simulator and an Android emulator used that backend.

| Area | Observed result |
| --- | --- |
| Complete letter | A 1,334-character letter previously stopped at its 280-character preview. Both detail APIs and the web reader now return the final sentence. |
| Formatting and design | Web renders safe paragraphs and entities. iOS and Android show the full formatted letter as readable text, including its final sentence, without literal HTML. Existing paper layouts remain. |
| Enclosures | Recipient can fetch/download the private fixture. Unauthorized accounts cannot. Counter, done and unfile responses retain enclosure descriptors. |
| Storage failure | Missing/corrupt object fails visibly without marking unread mail read; restoring the object permits a successful retry. |
| Household access | Owner/member access works in a normal Home. Five blocked Home states deny access; guests, providers and outsiders are rejected. Undelivered mail is not readable. |
| Reading analytics | Superseded by the review: read sessions go through the reader check and the existing service-only function. Direct client execution of the service-only RPC is forbidden. |
| Compose and delivery | Browser-composed household letter reaches the other account's iOS reader. Ordinary delivery remained hidden before its scheduled time; the local fixture clock was advanced for the recipient UI check. |
| Native compose | iOS and Android display the selected recipient at confirmation and the supported next-delivery choice. Both send through the local backend, stay on success, and return to Mail on Done. Recipient reads the persisted letter after local delivery; sender cannot read the recipient's copy. |
| Connected recipients | Accepted connections can send; removed connections, blocked people/households and frozen destinations cannot. Compose context omits private address details and the member roster. |
| Claims and notices | Unverified profile contact cannot claim. Confirmed Auth contact claims immediately readable mail. SMTP notice was captured locally with a local claim link and no letter body. Wrong sender cannot withdraw; withdrawn claim returns gone. |
| First-open and saved state | Native mark-viewed stores opened time. Counter placement survives iOS and Android relaunches. Web Counter/Vault state survives reload. |
| Search | Tail phrase is found in the browser after restoring full content. Local backfill repaired three old rows with zero failures; repeat apply changed zero. Newly sent HTML is searchable by its tail. |
| Shred and restore | Shared removed state and authorized restore work. Unauthorized restore is denied and recovery after the retention deadline is rejected. Deleted detail remains accessible for the intentional restore UI. |
| Vacation dates | Return-today hold remains active/editable until local 07:00. Ordinary mail holds; urgent delivery bypasses the hold. Cancellation reconciles waiting mail. |
| Vacation volume | All 1,001 fixture pieces are held, listed, opened and filed. Retry preserves exact folder count; a folder from the wrong mailbox is rejected. Concurrent sync produces one pending wrapper per hold. |
| Overlapping holds | Overlapping/consecutive holds extend both piece and wrapper to the final morning; a genuine gap remains deliverable. Cancelling the last connected hold shortens the release. |
| Launch cut | A separate local backend with flags off rejects external-contact mail. Existing shared read APIs remain available by launch-scope design. No hosted flag was changed. |

Relevant existing backend suites passed (eight suites / 219 tests for the main
access, delivery and vacation work; two suites / 60 tests for search; two suites /
39 tests for the overlap follow-up). Privacy gates, migration policy, web
TypeScript/targeted lint, native lint and local native builds passed. CI for the
first reading PR also exercised iOS build/tests and Android lint, tests,
assembly and instrumentation. Full fresh-schema replay passed for the additive
migrations. Consult each PR for the current head's CI result.

No new unit tests were added. Existing test fixtures were adjusted to represent
current Home state and the shared access/storage behavior.

The native compose replay exposed controls that did not match backend behavior:
selecting tomorrow evening still scheduled today's normal morning delivery;
voice recording and return-address controls had no working integration; personal
recipient confirmation showed no recipient; and send success immediately emitted
an event to open the recipient's private letter. The final native repair keeps
the existing four steps and design while removing those unsupported options,
correcting privacy/delivery copy, and preserving the success screen until Done.
The existing compose view-model suites passed on both platforms (15 tests each),
along with both native builds, Swift formatting/lint, Android ktlint and detekt.
The final installed builds completed the four-step send and Done replay against
the local backend; the web recipient opened letters created by both platforms.

## Before enabling

- Merging the stack doesn't enable the mailbox; turning it on stays a separate
  founder decision.
- The stack was merged with master on October 28, including the separate iOS
  welcome-letter and Home Vault fixes, before its final review.
- Validate hosted private storage, provider email/SMS and push delivery, signed
  physical-device builds, and relevant deep links. Local SMTP capture is not
  proof of real-world delivery.
- Live AI, certified/e-signature flows, paid/reward flows, physical postal/carrier
  handling and production background-job operation were not exercised here.
- Review the search backfill dry run against the intended environment before
  applying it. No hosted database, credentials, configuration or app-store state
  was changed during this audit.

The replay establishes the results above; it cannot establish that every mailbox
path is bug-free. Sensitive fixtures, tokens, screenshots and operator logs remain
outside this public repository.

## October 31 replay on current master

A fresh audit started from `cc4b29af67` and used a separate local Supabase
project with a full migration replay, a local API, Chrome, an iPhone 17 Pro
simulator (iOS 27), and a Pixel 7 emulator (Android API 34). All users, homes
and letters were synthetic. `mailbox`, `mail_extras` and `holiday_cards` were
enabled only in this local environment. This section records this replay;
the broader October 28 results above are historical evidence.

### Repairs from this replay

- Incoming previously copied fetched pages into an append-only list. Opening
  or filing a letter on page two left a stale row even after its query was
  invalidated. Incoming now uses the existing infinite drawer query, so all
  loaded pages refresh after actions. Failed later pages keep the loaded rows
  and expose a retry without an automatic request loop.
- The web composer could extend beyond a short or narrow viewport, leaving
  Send and Close unreachable and the app header above its backdrop. It now
  uses the existing modal shell with a scrollable body, visible footer and
  focus management. Validation scrolls into view; Escape in recipient results
  closes those results without discarding the composer.
- Editing an address retained its old Home ID, so the visible address could
  disagree with the actual destination. Both compose modes clear that ID when
  the text changes and require a new selection.
- Personal compose exposed bills, notices, ads and payout fields that the API
  rejects. It now offers letters; business-only fields remain available when
  an authorized business is selected. Returning to personal sending resets
  those fields.

### Observed coverage

| Area | October 31 result |
| --- | --- |
| Web Incoming | Loaded more than one page; opening and filing a page-two letter updated the row immediately after the repair. Drawer navigation and back navigation worked. |
| Web actions | Counter, Done, filing, unfile, shred cancellation, shred and restore worked. Folder blank-name validation, creation and reload persistence worked. Plain acknowledgement persisted and appeared in the envelope trail after reload. |
| Web search | A phrase at the end of fixture letter bodies was returned by search. Search pagination was not exhaustively replayed. |
| Web compose | Edited-address validation prevented stale routing. A long household letter was sent through the browser and received by the other account. Personal structured compose showed only Letter and omitted payout/return-address fields. Recipient-result Escape preserved the dialog. |
| Web responsive layout | Checked desktop and 390 × 844 layouts. In the narrow compose check, Send and Cancel remained inside the viewport; an initially off-screen validation error scrolled above the footer after the repair. |
| iOS sending | Completed recipient selection, confirmation, writing, review and send. An account with household access but no address proof received the verification-required error. After giving the synthetic fixture address proof, retry succeeded; success stayed visible until Done. The web recipient opened the saved letter. |
| Android sending | Completed all four steps, changed stationery/ink/seal, sent a letter and returned through Done. The web recipient opened its exact saved text. |
| Cross-platform reading | The household letter composed on web was read through its final sentence on iOS and Android. Android's Counter action appeared in the same Home's iOS Counter. Recipient access succeeded; an unrelated account could not read the letter. |
| Christmas cards | Web picture selection, writing, flip/preview, recipient selection, arrival choices and send worked. Take-back cancellation preserved the card; confirmed take-back removed it and allowed a replacement. The replacement was received, opened and flipped on both native apps. The delivered web Sent view showed the delivery trail and no take-back action. |
| Sealed Christmas card | Completed all five iOS card-composer steps and sent with `sealed_christmas`. It was inaccessible to the recipient before delivery. Advancing only local delivery exposed the sealed envelope in the web recipient's Inbox, with no opening control or note in the detail response. iOS Sent showed the saved card and the future Christmas opening date. Actual Christmas release was not simulated. |
| Persistence | A card filed into Taxes on iOS remained there after app relaunch and appeared in Android's Vault after its relaunch. Web folder, Vault and hold state survived reloads. |
| Holds | Web required dates, saved an active hold, preserved it after reload and cancellation of the end-early confirmation, and ended it after confirmation. Held bundle generation and release jobs were not replayed in this pass. |
| Connection failure | With only the isolated API stopped, web, iOS and Android showed mailbox errors with retry controls. Restoring the API and using those controls loaded the inboxes. Web detail also showed a recoverable error. |

Scheduled mail was checked as inaccessible before delivery in the household
letter/card cases. To inspect recipient screens immediately, only the local
fixtures' delivery timestamps were advanced. This does not verify production
7 a.m. scheduling or background jobs. Opening item-detail APIs can mark a piece
read, so those API checks are not evidence of first-open animation timing.

The development API generates a temporary CSRF secret when none is configured.
Restarting it invalidated the browser's old CSRF cookie: a subsequent write was
rejected without changing the letter. Signing out/in restored browser writes,
and acknowledgement then passed. Production requires a configured shared secret;
this local setup artifact was not treated as a mailbox authorization defect.

### Checks and remaining limits

- Web TypeScript gate: zero errors. Targeted ESLint: zero errors, ten existing
  `no-explicit-any` warnings in the mailbox query module.
- Existing backend suites: `homeRecordRoutes`, `homeEffectivePermissions`,
  `mailDay`, `mailDayNotification`, and `mailboxCheck`: 188 tests passed.
- Existing web `mailboxCheckCard` and `mailDeliveryRecovery` suites: 10 tests
  passed. These cover related mailbox/verification UI, not the entire digital
  Mail flow.
- Signed local iOS simulator build and Android debug assembly passed; both
  installed apps were used above. No native source changes were needed for
  the reproduced defects. No new unit tests were added.
- Scrolling, transitions, keyboards and back/close controls were exercised in
  the listed flows; no frame-time, accessibility-device or performance profile
  was collected. This is not a claim that every button or device size passed.
- This pass did not reverify external email/SMS claims, push delivery, hosted
  storage, physical phones, background jobs, every Christmas arrival variant,
  Android Christmas-card composing, enclosures/storage corruption, all business
  permissions, paid/reward flows, certified signing, AI, physical Mail Day,
  carrier integrations, or the remaining `mail_extras` subpages. Provider-backed
  address suggestions were unavailable in the isolated setup.

The repair is for review only: no merge, deployment, hosted database/configuration
change, real-person delivery, payment or app-store submission was performed.

## October 31 follow-up — remaining flows on PR #3081

The follow-up continued against the isolated local backend, database, private
storage and SMTP capture, using synthetic accounts in Chrome, the iOS simulator
and Android emulator. It adds two repairs to the earlier PR changes:

- Web now refreshes opened rows and unopened counts after every successful
  detail read, including direct links and Retry after a storage failure. The
  same refresh includes letters inside an expanded bundle. Failed reads leave
  unopened state unchanged.
- iOS and Android keep a successfully joined Mail Party usable when the member
  cannot read the optional household directory. The assignment section explains
  that restriction; joining and reactions still work. Other roster failures
  retain their error/retry state. No directory permission was broadened.

### Additional observed coverage

| Flow | Result |
| --- | --- |
| Private enclosure | Sent a real multipart upload with a household letter. Chrome opened its signed attachment; iOS Quick Look and Android's document viewer read its final sentence. Unauthorized and pre-delivery detail access were denied. |
| Corrupt storage and Retry | Replaced only the synthetic letter object with invalid bytes. All three clients showed recoverable errors, and the database remained unopened. Restoring the object and retrying recovered the full letter and enclosure. On web, the repaired list and unopened counts refreshed without a reload. |
| Mail Party | Rebuilt iOS and Android apps created/joined sessions, displayed the restricted assignment state, sent reactions with visible echo, and left/rejoined successfully. The member's directory endpoint continued to deny access. |
| Android Christmas compose | Completed picture selection/preview, writing, recipient, arrival and send. Daily-cap rejection was visible. A synthetic previous-day fixture allowed the next send; success and Sent showed the saved note and Christmas-morning arrival. Future Christmas delivery was not advanced. |
| Email card claim | Web sent to a synthetic external email. Local SMTP captured a local claim link without the private note. The sender could not claim it; the intended authenticated recipient claimed, opened and flipped the card. The note survived reload. |
| Held bundle | The existing local reconciliation job grouped two letters into one bundle and scheduled all three records for 07:00 on the return date, correctly crossing the daylight-saving offset change. All clients showed the held count. Android's end-early confirmation preserved the hold on Cancel and ended it on confirmation, rescheduling delivery to the next local morning. |
| Delivered bundle | Before delivery the bundle endpoint denied access. After advancing only the three local delivery timestamps, web, iOS and Android opened the bundle and read a child's final sentence. Web also exercised the second child and its opened-row refresh. This is not a wall-clock production scheduler check. |
| Tasks and home records | Web created a task from the letter and retained its High priority after reload. iOS read the task and correctly rejected completion by a member without task-edit permission. A web-created asset and linked letter appeared on iOS; opening the linked letter and returning to the asset worked. |
| Community and Mail Day settings | Web and iOS rendered the empty local Community view; the iOS category control worked. Web saved a new Mail Day time and retained it after reload. |

### Validation and limits for this follow-up

- Web TypeScript, targeted ESLint and the existing two mailbox-related suites
  passed (10 tests). Lint retained existing `no-explicit-any` warnings.
- iOS simulator build, changed-file SwiftFormat/SwiftLint and the existing
  Mail Party view-model suite passed (13 tests).
- Android debug assembly, ktlint and detekt passed. Both rebuilt native apps
  were installed and used for the flows above.
- No new unit tests, schema changes or hosted changes were made. PR #3081 is
  for review; it must remain unmerged for this request.
- Heavy shared-host load slowed cold starts and navigation. Android displayed
  a startup ANR after installation, then recovered after relaunch; its exact
  cause was not isolated. Subsequent flows worked, but this is not a clean
  performance or smoothness certification.
- Physical devices, hosted storage, provider email/SMS, native claim deep links,
  push/background delivery, all business roles, payments/rewards, certified
  signing, AI, carrier integrations and actual Christmas release remain
  unverified in this pass. Local SMTP capture verifies the local email flow,
  not delivery through an external provider. This record does not claim every
  button, device size or optional subpage has passed.
