# Christmas card memories implementation plan

November 2, 2026 · revision 3

Extend the existing Christmas card so someone can enclose a personal photograph and, if the recording test passes, a short voice message. The recipient can answer with a reply that stays joined to that card, and both people can find the card and its reply together in Mail.

The founder approved these three areas and asked for this plan. Revision 2 folded in the founder's review, and revision 3 folds in the second review; both were on November 2. The limits and interaction rules below are proposed implementation defaults. This document does not enable features, authorize a production migration, or schedule a release. Scope is the backend, web, iOS, and Android.

**Decided on November 2, at step 1:**
- card photos and voices are stored in S3, the chat-files approach;
- "Report this card" shares that one card with admins;
- a photo from someone who isn't a connection stays covered until tapped.

The [contract](christmas-card-memories-contract-2026-11-02.md) records these decisions, with the names, answers and rules for steps 3–8.

## What changed

Since revision 2:
- **A withdrawn send stays withdrawn.** A retry of a send that was taken back gets "taken back" and never sends. Sending again on purpose starts a new draft.
- **Duplicate prevention is a database guarantee,** not a cleanup or a test result. It uses derived row ids, with no migration, or else a small unique-index migration.
- **Replies keep working after Christmas sending is switched off.** The reply controls come with the joined card, and replies have their own take-back. All of it needs only `mailbox` and `holiday_card_memories`.
- **A working moderation path before photos switch on.** “Report this card” shares that one card with Pantopus admins, if the founder approves, and someone works the queue.
- **Blocks stop scheduled mail.** A block withdraws every pending card and reply between the two people, today's text cards included, with reads as a backstop.
- **The voice test runs alongside** the contract and the drawings, and holds up only voice.
- **The store is chosen before building.** The Supabase private bucket was recommended; the founder chose S3, the chat-files approach.

Since the first version:
- **Order.** Photo first, then replies, then voice, then the Christmas collection. Anything not merged and checked on all three apps when the ~December 1 store builds are cut stays out of them.
- **The note stays required** on cards and replies. Photo and voice are additions.
- **No new columns.** The reply's link to its card and the request ID live in server-written card data.
- **The joined card ships with replies.** From the first day, the original and its reply open together from every door.
- **The collection is a separate, later piece.** The web can add it any time; the phones need their own build.
- **Report and Block** on every received card and reply.
- **Photos reach the server as JPEG,** and the server refuses what it can't clean. It can't read HEIC today.
- **Smaller stored media.**
- **Cut:** the sender-chosen reply prompt, and keeping raw recordings on the device across relaunches.
- **Drawings** of the new pieces go to the founder for approval before any app work.

## 1. The experience to build

A sender chooses an existing Christmas picture, writes “I found this and thought of you,” adds a photo from a shared trip, and records a short greeting. The recipient opens the existing envelope, turns the card over, reads the note, sees the photo, and taps to hear the sender. “Add your memory” lets them answer with a note and, optionally, a photo or voice. When the reply arrives, it becomes the next page of the same card. Both people find the two pages together wherever they open either one.

Keep the 49 existing pictures and six artwork collections, the existing navigation, envelope, stamps, typography, opening animation, arrival choices, Look it over, and Sent. The personal photo is enclosed inside the card; it does not replace the artwork.

| Part | First version |
| --- | --- |
| Personal content | The existing note of up to 300 letters stays required. Add up to one photo and, if voice ships, one voice recording, on an original card or a reply. A text-only card is unchanged. |
| Photo | Choose through the existing system picker, preview, replace, or remove. Show the whole image, upright. A photographed drawing works as a photo. |
| Voice | Ships only if the recording test passes (section 4). Up to 60 seconds. Record, stop, listen, record again, or remove. Playback starts only when tapped. |
| Reply | Every delivered, unsealed card offers “Add your memory.” One reply per card, with the same controls. It is optional: no deadline, no reminders, and no further back-and-forth in this version. |
| Audience | The original sender and its one confirmed recipient. No household membership, address verification, family circle, or public link is added. |
| Safety | “Report this card” and Block on every received card and reply. A block also withdraws pending cards and replies between the two people. |
| Original sending | Keep one original Christmas card per sender per day and the season ending December 31, 2026. |
| Reply sending | Does not use the day's card. Replies stay possible after December 31, and after `holiday_cards` is switched off, while the reply feature is on. |
| Reply delivery | The other person's next 7 a.m. mail round, with take-back until pickup. Replies skip vacation holds as cards do. No instant-message expectation. |
| Keeping | The card and its reply stay joined in Mailbox, Vault, and Sent. Existing Vault filing and shredding keep working. A Christmas 2026 collection follows as its own piece (section 2). |

A reply is edited freely before sending and can be taken back before pickup. Once delivered, it is correspondence: no silent rewriting and no “delete for everyone.” A future version can support further contributions if actual use warrants them.

Not included:
- a sender-chosen reply prompt;
- interactive rooms, multi-household contributions, games, or live co-opening;
- video;
- a new Plans integration;
- AI-generated memories, transcription, or translation;
- Thanksgiving or additional holidays;
- new top-level tabs.

## 2. Changes inside the existing screens

### Sending a card

Keep the current five steps:

1. **Who it is for:** unchanged, including the email invitation path.
2. **Pick a card:** unchanged artwork collections and large preview.
3. **Write on the back:** the note stays first and required. Below it, add “Add a photo” and, when voice is on, “Record a greeting.” Once added, show the photo preview and voice player with Replace and Remove.
4. **Seal it for the day:** unchanged arrival choices and recipient-local dates.
5. **Look it over:** the exact card, note, photo, and voice player the recipient will get. The sender can play their recording here before sending.

Each photo or recording uploads as soon as it is added, with its own progress. Look it over and Send work only once every attached item is uploaded and validated. A failed upload keeps the note and the selected item and offers Retry or Remove. The card never silently goes without it, though the sender can remove the failed item on purpose and send the rest.

**Drafts.** The draft keeps three things: the note, the uploaded references, and the draft's request ID (section 4).
- **What survives.** They survive a page reload and the system closing the app. Android's saved form state already does this for the form; extend it with the new fields. iOS and the web keep no card draft today; add the same.
- **What doesn't.** The draft doesn't need to survive the person quitting the app on purpose. Raw local media are not kept: if the app closes mid-upload, the person adds the photo or records again.
- **Clearing the request ID.** The app clears it once it has seen the card sent or taken back. If a stale retry is answered “taken back,” the app says “You took this card back” and clears the draft. Sending again starts a new draft with a new request ID.
- **Devices and sign-out.** Drafts are not synchronized between devices. Clear drafts and playback caches on sign-out.

**Microphone.**
- Ask for microphone permission only when Record is tapped.
- If permission is denied, offer a clear path to continue with the note and a photo.
- Stop recording on interruption or backgrounding, keep a valid captured clip, and never resume recording automatically.
- No background recording and no autoplay.

### Opening and replying

Keep the current envelope opening and card flip. On the back, show the note, the photo, and the voice control in reading order. On a delivered, unsealed card, “Add your memory” follows them, when the joined-card read says replies are available. Text-only cards keep their current proportions.

The reply opens a small sheet from the card, not a new composer journey. Its destination is fixed to the original sender. The sheet has:
- “Only you and [display name] can see this”;
- the same controls, with the note required;
- Look it over;
- “Send with the morning mail.”

After sending, the replier sees their pending reply and its delivery time, with Take back while eligible. The original sender sees the reply only after delivery. None of this depends on `holiday_cards` being on.

**The joined card, from the first day replies ship.** Once delivered, the original and the reply show as two attributed, dated pages of one card, wherever either is opened:
- The reply piece in the original sender's Incoming opens the joined card.
- The original, opened from Incoming, a Vault folder, or Sent, shows the reply as its second page.
- The replier's Sent shows their reply joined to the card it answers.

Shredding follows the ownership rules in section 4: a person who shreds their piece no longer sees it there, and the other person's copy stays. Do not show an empty reply slot, an “awaiting reply” badge, or a read receipt.

A reply arrives as one new Mail piece; its look in the Mailbox list is part of the drawings. Existing delivery counts count it once. Opening it marks that piece read without telling its author.

### Report and Block

Every received card and reply page gets a menu with “Report this card” and “Block [name].”

**Report this card.** It files a report of the person through the existing `POST /api/users/:userId/report`, with a reason. It also shares that one card, and only that card, with Pantopus admins for review (the founder's choice, November 2).
- The report sheet says so plainly, for example: “Pantopus will be able to see this card to review it.”
- Admins open the card from the existing Reports queue (web admin, `adminReports.js`), and each opening is logged.
- Nothing else of either person's mail becomes visible.
- `UserReport` has no column for a card, so the link between the report and the card is kept in the card's server-written data. An admin can open a card only if it carries that report.
- Today a direct message is reported as the person only. Cards would be the first private content an admin can open, which is why this needs the founder's yes.

**Block [name].** It reuses `POST /api/users/:userId/block`, and the block withdraws pending cards and replies between the two people (section 4).

**The moderation path must work before photos switch on.** [Apple's guideline 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content) asks for filtering, reporting with timely responses, and blocking. That means:
- card reports appear in the queue;
- an admin can open the reported card and resolve the report;
- someone works the queue promptly.

**Filtering (the founder's choice, November 2).** A photo from someone who isn't your connection stays covered until you tap to show it.

### Christmas collection (a separate piece, after replies)

Mailbox, Vault, and Sent already give both people somewhere to return, and the joined card keeps each exchange together. The collection adds a seasonal view on top, and it can come later:
- The web can add it whenever the server route lands.
- The phones need their own screens. They get them only if those screens make the store builds; otherwise, the next build after.

Add a **Christmas 2026** entry within the existing personal Mail and Vault navigation on every platform. Reuse the current Mail shell and card artwork components. This is a filtered view of existing mail, not a second album store or a new main tab.

- Default to Received; offer Sent as the second filter. One tile per original card, showing the existing artwork and the sender's or recipient's display name.
- Received includes delivered original cards, whether in Incoming or filed in any Vault folder. Sealed cards show their existing envelope and seal and expose no personal media.
- Sent uses existing Sent visibility and includes pending original cards with their existing status. Replies stay reachable through Sent and their card; they never make a second tile.
- A delivered, unread reply may give its card a “New reply” marker. No popularity counts, empty mantel slots, or social comparisons.
- Filing does not remove a card from this view. Shredding removes the received item under the existing reader's deletion rules; Recently shredded remains the recovery path.
- Include original Christmas cards in the existing On this day memories, whose positive-category filter leaves them out today. Exclude replies. Do not build a competing Memory screen.
- The collection stays readable after sending closes, as long as Mail is available.

If a favorites filter is added, use the existing starring the recipient owns. Never use the shared `Mail.starred` field for a sender's favorite of their sent card; that would change the recipient's preference. Manual arrangement, sender favorites, and decorative shelves are deferred.

## 3. Reuse map and actual gaps

| Existing code | Reuse and extension |
| --- | --- |
| `backend/services/holidayCards.js` | Season, artwork, seals, delivery presentation, and Sent. Add personal-content descriptors and tell original cards and replies apart explicitly. |
| `backend/routes/mailbox.js` | Extend card send and preview, Sent, and enclosure access. Add narrowly scoped reply and collection routes here. Reuse card eligibility, email claim, block, take-back, and delivery rules, but gate reply routes by the reply feature, not by `holiday_cards`. |
| `backend/services/s3Service.js`, `backend/services/chatMediaUpload.js`, `GET /api/chat/files/:fileId` (`routes/chats.js`), `backend/services/photoMetadata.js` | The chat-files approach the founder chose for card media: private `File` rows and S3 objects, bytes streamed by an API route that checks the reader, byte ranges, no-store. Photos are cleaned by `photoMetadata` (#3166). Card media add their own route, purpose, photo derivative, and audio check (contract sections 2–4). Letter enclosures stay in `mailEnclosures.js`. |
| `backend/services/mailObjectStorage.js` | Keep the note and the media arrangement in the existing private MailObject. Put no private media links or voice in public artwork. |
| `backend/services/mailPiece.js` | Optional presentation fields. Protect new server-owned metadata from generic compose payloads. |
| `backend/services/mailDelivery.js`, `mailMorningNotice.js`, `mailVacation.js` | Recipient-local delivery and the morning notice; replies use ordinary morning delivery. Cards skip vacation holds by their card data (`mailVacation.js` ~95), and replies must match that rule. |
| `backend/services/mailVault.js`, `backend/routes/mailboxV2Phase3.js` | Filing, category and year filtering, On this day. |
| `backend/jobs/mailDeletedPurge.js` | Keeps a sender's card after the recipient shreds theirs. Extend the same exception to replies. |
| `backend/routes/users.js`, `backend/routes/blocks.js`, `backend/routes/adminReports.js` | Report a person, block, and the admin Reports queue, reused for cards. The block also withdraws pending cards and replies. |
| `backend/services/s3Service.js` (~266) | Precedent for a row id derived from its request (gig-completion retries), reused for request IDs. |
| Web `components/mailbox/cards/`, `LetterActions.tsx`, Mail and Vault pages | Extend the sender, Look it over, and reader. Add the media controls, reply sheet, joined card, and menu. |
| iOS `Features/Mailbox/HolidayCards/`, MailboxRoot, Vault, MailSent endpoints | Extend the views, view model, DTOs, and private enclosure opening. Add recorder and player helpers here; keep native permission and accessibility behavior. |
| Android `ui/screens/mailbox/cards/`, mailbox root and Vault, HolidayCardsRepository, MailEnclosureFiles | Extend the same feature, its saved state, network result handling, and account-cleared file cache. |

Facts checked on master `c6f23e87d9`:

- **Card creation.** It writes empty attachments and requires a note (`CARD_MESSAGE_EMPTY`). It must accept and bind the sender's valid private upload references.
- **Audio.** The upload allowlist takes images, videos, and documents, but no audio. No app has a voice recorder.
- **Enclosure links.** The enclosure link route checks ordinary recipient access and ignores the Christmas seal (`mailbox.js:2302`).
  - Every media descriptor, link route, and generic detail route must honor the seal.
  - The author needs a narrowly scoped Sent route. Senders never get general access to recipient mail.
- **Card route gates.** `GET /api/mailbox/cards` and card take-back answer 404 unless `holiday_cards` is on (`mailbox.js:1862`, `:2060`). Anything replies need after Christmas can't live there.
- **One card a day.** It is enforced by cleanup after a race (`mailbox.js:1975`): insert, recount, and delete the later card. That is not atomic, and nothing identifies a repeated send. It also has two bugs:
  - a failed recount counts as success;
  - the delete isn't checked, so the sender can be told “You've sent today's card” while both cards stay.
- **Repeated sends happen today.** Android's network layer resends a request on its own after some connection failures (`DPoPReplayGuard.kt`).
  - So today's text cards can already answer a successful send with “You've sent today's card,” or send twice when a retry crosses midnight.
  - iOS retries only reads; the web doesn't retry.
- **Delivery and blocks.**
  - Delivery has no job: a piece becomes readable as soon as its delivery time passes (`mailDelivery.js` header).
  - Blocking doesn't touch pending mail (`blocks.js`), so a pending card still arrives after a block today.
  - `UserBlock` records when each block was made.
- **Reports.** An admin Reports queue exists for people, posts, tasks, and neighbor messages. A direct message is reported as the person only. `UserReport` has a reason and free-text details, with no link to a piece of mail.
- **HEIC.** The server's image library can't decode HEIC (sharp 0.35.5 prebuilt). When the shared upload step couldn't clean a file, it kept the original, metadata included (`upload.js` ~143).
  - Fixed since this plan was first written: [#3166](https://github.com/WangPantopus/skinny-pantopus/pull/3166) (`services/photoMetadata.js`) cleans every stored photo and converts HEIC to JPEG on the server.
  - Card photos must never fall back to an original.
- **Storage.** Mail enclosures live in the Supabase private bucket. Production is on Supabase's free plan, which the whole app shares: 1 GB of file storage, plus 5 GB of uncached and 5 GB of cached egress a month.
- **On this day.** Its positive-category filter leaves out `holiday_card`.
- **Sent.** It keeps the sender's original after the recipient shreds it. Replies need the same author-copy retention.

## 4. Backend and storage contract

### Personal media

Card media upload through their own route, `POST /api/mailbox/cards/media` (contract section 4); other mail keeps today's `POST /api/upload/mail-attachments`. Card uploads return owner-bound references plus server-verified kind, size, and dimensions or duration, never a persistent public URL.

**Photos.** One still image, with a 10 MiB input limit, checked again at send.
- The apps hand over JPEG:
  - iOS and Android convert HEIC on the device;
  - the web converts where the browser can read HEIC, and otherwise asks for a JPEG.
- The server decodes the image, applies its orientation, strips all metadata, and stores one JPEG at most 1600 pixels on the long side (about 300–400 KB).
- Add a thumbnail only if the approved drawings need one.
- Anything the server can't decode is refused with a clear message. The server never stores the original.
- Reject video and animated images.

**Voice.** One clip, with a 5 MiB input limit and 60 seconds of decoded audio, checked again at send. The stored form is AAC-LC in M4A, mono, at speech quality (about 48 kbps, roughly 360 KB a minute). iOS and Android record this natively.

**The recording test runs alongside steps 1 and 2 and holds up only voice.** It takes real recordings from Chrome, Safari, the iPhone app, and the Android app, and plays each on all four.

**Result (November 3):** the [voice test](christmas-card-voice-test-2026-11-02.md) found the following:
- every recorder makes AAC-LC in MP4;
- every reader plays every recording to its end;
- the browsers write fragmented MP4, and Android misreports one kind's length;
- the iPhone can't play WebM.

No converter is needed. The founder picks the option.

The result decides:
- **Every recorder can make AAC/M4A:** the server only checks format and duration, and no converter is needed.
- **Some browsers can't:** the founder chooses between two options. One is a converter in the backend image, at a pinned version, with size, duration, time, and concurrency limits. The other is that the web plays voices but records only where the browser makes AAC.
- **The test isn't clean by the time photo and replies are done:** voice stays off this season. The capability field hides Record without new builds.

Web must test recording support and handle recorder failure even after a positive capability result; see [MediaRecorder capability checks](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static). Android documents AAC-LC in MPEG-4/M4A; see [supported formats](https://developer.android.com/media/platform/supported-formats). This does not replace device verification.

**Storage: S3, the chat-files approach (the founder's choice, November 2).** The choice of store shapes references, access, cleanup, and verification.
- Each photo or voice is a private `File` row and a private S3 object under a key that names no one. Its bytes come only through API routes that check the reader on every request, with no-store responses; the chat-files route works the same way.
- This replaces the recommendation of the Supabase private bucket that Mail's letter enclosures use. Letters keep their enclosures where they are.
- Locally, S3 is the stack's own S3 endpoint, and the kit's launcher refuses any other. Hosted S3 costs and limits are the founder's to check before switch-on.
- Originals are kept only while processing needs them.
- The [contract](christmas-card-memories-contract-2026-11-02.md) has the names and routes.

**Cleanup.**
- New purpose-bound references expire after a 72-hour draft window.
- Mail cleanup removes abandoned uploads after a seven-day grace period, only after checking that no retained Mail or MailObject references them.
- A sent reference stays readable through mail authorization after its upload token expires.
- Roll back uncommitted objects when a send fails. Never delete retained author copies or shared media by age alone.

Cleanup is server-only, so it can land after the store builds if needed.

**Access.**
- The owner may preview an upload through an owner-only reference check.
- After sending, links come through one of three routes:
  - a card-media route on the piece, for a permitted recipient, with the seal check (`GET /api/mailbox/:id/card-media/:fileId`);
  - an explicit Sent route, for that piece's author;
  - an admin route, for a reported card only (see Report this card).
- Serve the bytes through the API with private no-store responses, never a link to storage, and keep downloads in account-scoped caches.
- A supplied enclosure ID or storage path never establishes permission.

### Represent a reply as existing Mail

A reply is one new `Mail` row and one private `MailObject`. Reverse the sender and recipient of the original. Keep `type: letter`, `drawer: personal`, and the existing delivery and read-state fields. Use `category: holiday_card_reply`, the reply's own tag, and the original's season tag. Never give a reply the original-card tag: that would use up the day's card and inflate collections.

**No new columns.** The reply's server-written card data carries the original's id and its design, so it draws with the same picture. It is stored so that existing card code can't mistake a reply for an original card.

**Who can reply.** Validate that:
- the original is an original Christmas card, not a reply;
- it is delivered and unsealed;
- the caller is its confirmed recipient;
- the destination is its original sender;
- the two can still exchange mail.

A deleted or missing sender can't receive a reply. If the original's row is later removed (account deletion), the reply opens on its own, without rebuilding the original.

**One reply per card** is enforced by the database (next section). Taking back an undelivered reply frees the slot.

**Server control.**
- Keep the link and the media descriptors server-controlled.
- Protect them against generic send and update payloads and against direct authenticated writes.
- Do not broaden general Mail SELECT access for senders.
- Notification work runs only after a successful commit.

Existing text-only cards need no rewrite, and new optional fields default to absent.

### Request IDs and duplicate prevention

These are guarantees, not test results:
- **Exactly one piece per send.** However a send is repeated, it makes at most one card or reply. That covers a double tap, a lost response retried later, and Android's automatic resend. The database enforces this, not a cleanup afterwards.
- **One reply per card,** also enforced by the database.
- **A withdrawn send stays withdrawn.** A retry of a send that was taken back, or withdrawn by a block, gets that outcome back and never sends. Sending again on purpose uses a new draft and a new request ID.
- **The answer matches what's stored.** Never answer “You've sent today's card” while the extra card stays, and never answer success when nothing was kept.

**How it works.**
- **The ID.** The app creates the request ID once per draft, keeps it with the draft, and sends it on every retry. Older clients without an ID behave as today.
- **What the server keeps.** It stores the ID and a digest of the content in the piece's server-written card data. For a card, the digest covers the design, note, arrival, recipient, and media; for a reply, the card it answers, the note, and the media.
- **A repeat.** The same ID with the same digest gets the existing piece back. The same ID with a different digest is refused as a conflict.
- **The preferred mechanism needs no new columns.** It derives each row's id from its request, so a repeat collides on the existing primary key. The code already does this for gig-completion retries (`s3Service.js` ~266).
  - **An original card's id** comes from the sender and the request ID. That covers the retry after midnight too. Taking a card back keeps its row, emptied of note, media, and recipient, in the shape a withdrawn email card already has. A stale retry then finds it and gets “taken back.”
  - **A reply's id** comes from the card it answers, which makes one reply per card a key fact. Taking a reply back removes its row, which frees the slot, and notes the withdrawn request ID in the original card's server-written data. A stale retry of that ID gets “taken back.”
- **The fallback** is an additive, index-only migration on the existing data: unique per sender and request ID, and one reply per card. It adds no columns but is a production database change, so it goes to the founder first. Step 1 picks one of the two, and the guarantee holds either way.
- **One card a day stays a cleanup rule.** It now only arbitrates two different drafts on the same day, so its failure mode is two different cards, not a duplicate. Fix its two bugs (`mailbox.js` ~1976): a failed recount must not count as success, and a failed delete must not answer “already sent today.”

This also fixes today's text-only cards.

**Cases to prove** on a real local backend and database, with a fault proxy to drop responses and failures injected into the save:
1. Two sends with the same ID at once: one card, and both answers show it.
2. A lost response, retried the same day and again after midnight in the sender's zone: one card, shown as sent.
3. An Android connection-level resend: one card, and no error shown.
4. The same ID with changed content: refused.
5. A take-back, then a retry with the same ID: no resend, and the answer says it was taken back, for a card to a person and a card by email alike. A new draft then sends normally, under the usual limits.
6. Replies:
   - the same ID twice gives one reply;
   - a second reply with a new ID is refused;
   - a take-back frees the slot;
   - a retry of the withdrawn reply's ID doesn't resend.
7. A failure between saving and answering, and during the same-day recount or delete: still exactly one piece, and the answer matches what's stored.

### Blocks and pending mail

Delivery has no job, so a check at delivery time can't stop a piece; a pending piece becomes readable the moment its delivery time passes. For original cards and replies alike:
- **At the block.** When either person blocks the other, withdraw every undelivered card and reply between them, in both directions. Today's text cards are included. It works the way a take-back does, and keeps the withdrawn record with its reason. That way Sent can tell a take-back, which it hides, from a card that couldn't be delivered.
- **The backstop.** A block can come moments before 7 a.m. So the reads that show a card or reply skip a piece whose delivery time came after a block between the two people. Those reads are lists, details, the joined card, enclosure links, counts, and the morning notice.
- **What each person sees.** The sender's Sent shows the piece as “Couldn't be delivered,” without saying why. The recipient never sees it.
- **Already delivered.** Pieces delivered before the block keep today's behavior.

### API additions

| Route | Contract |
| --- | --- |
| Existing `GET /api/mailbox/cards` | Adds which photo and voice controls are usable for an original card now. Needs `holiday_cards`, like all original sending. |
| Existing `POST /api/mailbox/cards` and `/cards/preview` | Add optional `photo_ref`, `voice_ref`, and `request_id`. Both validate the same media and audience, and the note stays required. |
| `GET /api/mailbox/cards/:id/exchange` | Authorizes the original and each visible piece separately. Returns the original plus this reader's permitted reply and pending state, and whether this reader can reply now, with which controls. Never returns the other person's read activity. Needs only `mailbox`. |
| `POST /api/mailbox/cards/:id/reply/preview` | Fixed recipient. Runs the same content, limit, seal, block, and one-reply checks as sending. |
| `POST /api/mailbox/cards/:id/reply` | Creates the single reply and requires a request ID. |
| `POST /api/mailbox/cards/:id/reply/take-back` | Takes back this reader's pending reply before pickup, with the reply's own rules. |
| `GET /api/mailbox/card-collections/:season` | Collection piece: cursor-paginated original-card tiles with a Received/Sent filter, delivery and seal rules, and only authorized reply summaries. Reuses the Mail and Sent projections. |
| Existing Sent detail and scoped enclosure routes | Return the author's own original or reply media and open the same joined card. Sender preview rights never extend to someone else's pending reply. |
| Admin route for a reported card | Opens only a card that carries the report, logs each opening, and is part of the existing admin Reports queue. |

The three reply routes need `mailbox` and `holiday_card_memories`, never `holiday_cards`. Keep reply content out of the other person's view until its delivery time.

### Ownership and deletion

- **Participants.** Only the two account identities take part. Moving home or changing household membership does not transfer these cards.
- **Before delivery,** taking back removes the pending piece's content and media, keeping only the withdrawn record. Do not delete an upload still referenced elsewhere.
- **After delivery,** Shred removes the received piece for that reader, with the existing 30-day recovery window. Filing is also reader-specific.
- **Author copies.** The author keeps their sent copy. Extend the existing purge exception to valid replies, without marking them as original cards.
- **The recipient shreds the card.** The joined card and the collection can't use their reply to bring the shredded card back to them. Their reply stays reachable through Sent.
- **The sender shreds the reply they received.** Their original remains, and their joined view leaves the reply out. The replier's Sent copy stays.
- **Account deletion** follows the existing contract, and a reply whose original is gone opens on its own. Test this explicitly; do not promise an archive that survives every account-deletion case.
- **Blocking** withdraws pending cards and replies, as above. Existing delivered correspondence follows the existing retention rules.

## 5. Flags, older apps, and failure behavior

Add one launch key, `holiday_card_memories`, default off across backend, web, iOS, and Android.

| Action | Required keys |
| --- | --- |
| Send an original card with personal media | `mailbox`, `holiday_cards`, `holiday_card_memories`, and the open season |
| Reply to an existing card: the reply controls, preview, send, and take-back | `mailbox` and `holiday_card_memories`. Works with `holiday_cards` off, and is independent of the sending season and the day's card. |
| Read card media, replies, the joined card, Sent, or the collection | `mailbox`; turning creation off never hides delivered content |
| Ordinary letter composer and Mail Party | Unchanged, behind their existing keys |

Updated apps learn which controls are usable from `GET /cards` for original cards and from the joined-card read for replies. If a key or capability changes mid-draft, keep the draft and explain the refusal. Never silently drop media and send a basic card.

**Older apps.** No store build carries `holiday_cards` yet. If memories ship in the same store builds that first carry cards, no installed app knows cards but not memories.
- Builds without cards show a card as a plain letter with its note (NEXT_STEPS), and a reply should show the same way.
- Because the note is required, there is always text.
- Check once how such a build lists the photo and voice, and that a sealed card's media stay hidden there.
- Backend additions keep every existing response field.

**Privacy.**
- Keep personal media and reply content out of invite emails, public claim pages, push previews, summaries, analytics, and operational logs.
- A sealed card must not leak a thumbnail, duration, file name, or signed link through any route.

## 6. Build sequence

Start from current master and recheck open work before editing shared files.
- On November 2, master is `c6f23e87d9`.
- [PR 3081](https://github.com/WangPantopus/skinny-pantopus/pull/3081) is still an unmerged draft. Its Mail refresh, compose, and restricted-member Mail Party fixes belong to that work: coordinate with its owner and don't duplicate them.
- The session fixing HEIC upload metadata owns that change in `upload.js`.

Anything not merged and checked on all three apps when the ~December 1 store builds are cut stays out of them. The phones get it with a later build, and the web any time. The steps run in this order, except the voice test, which runs alongside. Each gate is an event, not a date.

| Step | Deliverable | Done when |
| --- | --- | --- |
| 1. Contract and atomic sends | DTOs and names, authorization matrix, media sizes, and the block rule. The founder's choices of store and moderation path. Request IDs with database-enforced duplicate prevention on today's card send, the withdrawn-send rule, and the same-day cleanup fixes. | The founder has chosen the store and the moderation path. Request-ID cases 1–5 and 7 pass on today's card send, or the index migration has gone to the founder. |
| Voice test (alongside steps 1–2; gates only step 7) | Real recordings from Chrome, Safari, the iPhone app, and the Android app, each played on all four. | The result is written down, and the founder has picked the voice option. |
| 2. Drawings | Write on the back with the new controls, the card back with a photo and voice, the reply sheet, the joined two-page card, a reply in Mailbox and Sent, the Report sheet's wording, the Block menu, and a covered photo if chosen. | The founder approves them. |
| 3. Photo, server | Card-media purpose, photo derivative, refusal of unreadable photos, the seal on every media route, and the author's Sent media. Block withdrawal with the read backstop, the admin route for a reported card, and abandoned-upload cleanup. | Against a local backend, the existing web card flow sends and reads a private photo card. Outsider, sealed, and blocked routes refuse media; a block at 6:59 keeps a 7:00 card unreadable; an admin opens only the reported card. |
| 4. Photo, apps | Web, iPhone, and Android: photo controls, upload on attach, Look it over, reader, Sent, request ID in drafts, “Report this card,” and Block. | Cross-app sends, reload and relaunch, upload retry, Report and Block pass. A resend from the Android app shows the card as sent. |
| 5. Replies, server | Reply relation, fixed audience, one reply per card enforced by the database, request IDs, morning delivery, and vacation-hold skip. Reply take-back, reply controls on the joined-card read, Sent, and the purge exception. All of it needs `mailbox` and `holiday_card_memories`, not `holiday_cards`. | Two test people exchange a reply. Recipient, author, outsider, seal, block, and deletion cases behave as specified. With `holiday_cards` off and memories on, the reply controls, preview, send, and take-back all work. Request-ID case 6 passes. |
| 6. Replies, apps | The “Add your memory” sheet, the joined card from every door, the reply in Incoming and Sent, and counts. | The card and its reply stay joined across apps and relaunch, and only the permitted person can reply. Replies keep working with `holiday_cards` off. |
| 7. Voice, only if the test passed | Audio acceptance, plus the converter if chosen. Recorder and player in the three apps. | Recordings from every recorder offered play on all four readers. Permission denial, interruption, the 60-second cutoff, and no autoplay pass. |
| 8. Christmas collection | Collection route and the On this day fix, then web. Native screens only if they make the store builds. | One tile per original; filed, sealed, pending, shredded, restored, replied, and January cases reconcile. |
| 9. Release check | Integrated three-app replay, existing checks, NEXT_STEPS and flags documentation, and the founder's switch-on steps. | Debug and Release behavior is verified locally, and hosted and device gaps are listed specifically. |

**How it runs.** Like Look it over + Sent:
- One coordinating session, plus a server, web, iPhone, and Android session, on Opus 5.5 at max effort with no subagents.
- Server steps lead, and each app step is a small PR against the settled contract.
- Keep privacy and storage changes separate from visual changes.
- No new unit tests. Update affected existing tests when behavior changes, and run the relevant existing checks.
- Merge implementation only after current-head CI and a real-app check.

## 7. Acceptance checklist

Set-up for every check:
- synthetic accounts;
- an isolated local backend, database, and private storage;
- a web browser, an iOS simulator, and an Android emulator.

Check the other person's view, and repeat after a reload or cold relaunch. For scheduled delivery, move only controlled local fixture time, and keep that apart from a real hosted job.

**Sending and joining**
- Send a note only, note + photo, note + voice, and note + photo + voice. A card or reply without a note is refused. All keep the existing artwork and opening.
- Send from web and first open on iOS; iOS to Android; Android to web. Reply in the opposite app. Both people see the same joined card from Incoming, the Vault, and Sent.
- Drafts survive a reload and the system closing the app, with the same request ID.
- Interrupting an upload keeps the draft, and so does interrupting the final send. Retry then finishes with exactly one piece.

**Media**
- Photos:
  - an iPhone HEIC photo arrives as an upright JPEG with no location;
  - JPEG and PNG orientation;
  - a photographed drawing;
  - too-large input is refused;
  - a corrupt or mislabeled file is refused with a clear message;
  - the stored photo is at most 1600 pixels with no metadata.
- Voice, if shipped:
  - every recorder offered, and native microphone permission;
  - interruption, the 60-second cutoff, record again and remove;
  - pause and seek, and no autoplay;
  - a corrupt or mislabeled clip is refused;
  - the stored size is about 360 KB a minute.

**Request IDs and replies**
- The seven request-ID cases in section 4, plus double taps from two tabs and two devices.
- A taken-back card or reply is never sent by a later retry.
- A second reply is refused, and taking back the pending reply frees its slot. A reply doesn't use the day's card.

**Privacy and safety**
- A stranger, a household co-member, someone opening a forwarded email link, and the unconfirmed email account can't see private content or reply. Claiming with the confirmed intended email binds the right recipient.
- Before delivery and before the seal lifts, media stay hidden on every generic detail, object, and enclosure route, every collection tile, Sent, and Look it over. Only the author can inspect their own pending content.
- **Blocks.** A block at 6:59, before a 7:00 delivery, in either direction:
  - the card or reply is never readable in lists, details, the joined card, enclosure links, counts, or the morning notice;
  - the sender's Sent says “Couldn't be delivered”;
  - no message reveals who blocked whom;
  - pieces delivered before the block are unchanged.
- **Reports.** “Report this card” from a card and from a reply:
  - the reporter sees the disclosure;
  - the report appears in the admin queue;
  - an admin opens only that card, and the opening is logged.
- **Covered photos,** if chosen: a photo from a non-connection stays covered until tapped.

**Counts and keeping**
- Incoming counts rise once for a delivered reply, and the collection still counts one original. Opening the reply clears only the reader's unread state.
- File and unfile, shred and restore, the 30-day purge, take-back, and account deletion keep the ownership rules. A reply can't bring back a shredded original.
- Private link expiry and refresh, offline cached playback, sign-out and account switching, abandoned-upload cleanup, and retained author-copy media.

**Accessibility**
- Large text, keyboard navigation, screen-reader speech, focus on errors, reduced motion, and narrow screens.
- Offer an optional photo description, and never label the note as a transcript.

**Season**
- December 25 release in different recipient time zones, December 31 closure, January reading and replies.
- With `holiday_cards` off and memories on: the reply controls, preview, send, and take-back all work.
- Key-off rollback, legacy text-only cards, and a build without cards.

**Separate release checks.** Local synthetic replay does not establish these:
- real phone microphone capture and playback;
- hosted storage, email, and push;
- the real 7 a.m. job;
- store builds.

## 8. Measuring the first use

Use the existing event infrastructure for these aggregate steps:
- composition started;
- media attached;
- Look it over reached;
- send committed;
- claim completed;
- reply committed;
- joined card reopened;
- collection opened.

Exclude content, photo and voice bytes, email addresses, storage paths, and signed URLs.

Compare sender completion, time to send, recipient claim completion, voluntary reply rate, and repeat visits after the first day. Keep sign-up abandonment separate from card engagement. Never show senders individual read activity, and never use a missing reply to prompt anyone.

## 9. Decisions for the founder

In the order they're needed:

1. **The store, before step 3.** Decided November 2: S3, the chat-files approach.
2. **The moderation path, before photos switch on (step 1).** Decided November 2: “Report this card” shares that one card with admins, with the disclosure and logged access, and a photo from someone who isn't a connection stays covered until tapped.
3. **Voice, after the recording test.** The test passed. The options are in the [voice test](christmas-card-voice-test-2026-11-02.md):
   - no converter, with the web recording in one piece and Record only where the browser makes AAC (recommended);
   - a remux on the server;
   - a converter on the server.
4. **The index migration:** not needed. Step 1 uses derived row ids, which give the guarantee with no migration (contract section 6).
5. **The drawings,** including how a reply looks in the Mailbox.
6. **Hosting costs at switch-on,** from actual use: S3 for card media, and Supabase Free or Pro for the rest.
7. **The native collection screens:** whether they go into the ~December 1 store builds.

The release is ready when five things hold:
- a real personal photo, and voice if it ships, travels through every supported app;
- the recipient can answer without leaving the card;
- both people find the card and its reply together;
- a reported card reaches a moderator;
- a block stops what hasn't arrived yet.
