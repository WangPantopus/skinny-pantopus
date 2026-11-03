# Christmas card memories contract

November 2, 2026 · step 1 of the [implementation plan](christmas-card-memories-plan-2026-11-02.md)

This is the agreed shape for steps 3 to 8: names, answers, who may do what, media sizes, the block rule and the launch keys each route needs. Only section 6, request IDs on today's card send, is built in step 1. Everything else is built in its own step and stays off behind `holiday_card_memories`. Field names here are binding for the server and the three apps; a change goes through this document first.

## 1. Founder decisions (November 2)

| Decision | Choice |
| --- | --- |
| Where card photos and voices are stored | **S3, the chat-files approach.** One `File` row per item, a private S3 object, and bytes served only through an API route that checks the reader on every request. Not the Supabase private bucket Mail's letter enclosures use. |
| Report this card | **Yes, that card only.** A report can share the reported card or reply with Pantopus admins. The report sheet says so, and each admin opening is logged. Nothing else of either person's mail becomes visible. |
| Covered photos | **Yes.** A photo from someone who isn't the reader's connection stays covered until tapped. |
| Duplicate prevention | **Derived row ids, no migration** (section 6). The index-only migration isn't needed. |
| Voice (November 3, after the [voice test](christmas-card-voice-test-2026-11-02.md)) | **No converter.** Each upload is checked as AAC-LC in MP4 and stored as it came. The web records in one piece, the apps show the server's length, and Record shows only where the browser can make AAC in MP4 (section 3). |

Still open, in the plan's order: the drawings, Supabase Free or Pro (now only for the rest of the app; card media no longer use Supabase storage), and the native collection screens.

## 2. Names

**Launch key.** `holiday_card_memories`, default off on the backend, web, iOS and Android.

**Mail rows.** No new columns and no new table.

| Piece | `category` | `tags` | Server-written data in `mail_extracted` |
| --- | --- | --- | --- |
| Original card | `holiday_card` | `holiday_card`, `christmas_2026` | `card` as today, plus `card.request`, `card.media`, `card.reply`, `reports` |
| Reply | `holiday_card_reply` | `holiday_card_reply`, `christmas_2026` | `card_reply`, plus `reports`. Never `card`, so `holidayCards.isCard()` is false for a reply, and a reply never uses the day's card or counts as an original anywhere. |

Clients never write these fields. `mailPiece` strips them from generic compose payloads, and only the card routes set them.

```text
card.request   { id, digest, settled_at }                        request ID of the send (section 6)
card.media     { photo: MediaRef | null, voice: MediaRef | null }
card.reply     { withdrawn_requests: [request_id] }               reply request IDs taken back (section 6)
card_reply     { card_id, design, request: { id, digest }, media: { photo, voice } }
reports        [{ report_id, at }]                                user reports that share this piece (section 9)
card.withdrawn { reason: 'taken_back' | 'blocked', at }           only on a withdrawn record (section 6)

MediaRef       { file_id, kind: 'photo' | 'voice', mime_type, size,
                 width, height, alt }                 photo
                 duration_ms                          voice
```

**Files.** One `File` row per photo or voice:
- `file_type: 'mailbox_attachment'`, `visibility: 'private'`, `file_context: 'holiday_card_media'`;
- `metadata.storage_contract: 'holiday_card_media_v1'`, `metadata.kind`, `metadata.sha256`, `metadata.width` and `metadata.height` or `metadata.duration_ms`, and `metadata.mail_id` once it is sent;
- owned by the uploader (`user_id`).

The S3 key is opaque, `holiday-card-media/<time>_<random>.<ext>`, and names no one, as letter files already do (`generateOpaqueS3Key`). Locally, S3 is the stack's own S3 endpoint; the kit's launcher refuses any other.

**Replies.** A reply's row id is derived from the card it answers (section 6), which makes one reply per card a primary-key fact.

## 3. Media sizes

Checked when uploaded and again when sent.

| | Photo | Voice (only if voice ships) |
| --- | --- | --- |
| Per piece | One | One |
| Input | 10 MiB at most. The apps send JPEG: iOS and Android convert HEIC on the device, and the web converts where the browser can. Since #3166 the server can also convert HEIC, but sending JPEG keeps uploads small and saves server memory. | 5 MiB and 60 seconds of decoded audio at most |
| Stored | One JPEG, at most 1600 px on the long side, upright, with every piece of metadata removed (about 300 to 400 KB). The original is never stored. | AAC-LC in MP4, mono, about 48 kbps (about 360 KB a minute), stored exactly as uploaded: the server doesn't convert (founder, November 3). It accepts an ordinary or fragmented MP4 holding one AAC-LC track and refuses anything else, WebM and Ogg included. It counts the length from the file's own boxes, adding the fragments' sample durations, and returns it as `duration_ms`, which the apps show instead of the player's guess. The web records with `MediaRecorder.start()` and no timeslice, and offers Record only where `MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')` is true. |
| Refused | Unreadable: 415 `CARD_PHOTO_UNREADABLE`. Video or animated: 415 `CARD_PHOTO_NOT_STILL`. Too large: 413 `CARD_PHOTO_TOO_LARGE`. | Wrong format: 415 `CARD_VOICE_UNREADABLE`. Too long: 413 `CARD_VOICE_TOO_LONG`. Too large: 413 `CARD_VOICE_TOO_LARGE`. |
| Description | Optional `alt`, 200 letters at most, read by screen readers | None. The note is never labeled as a transcript. |

## 4. Routes and launch keys

`mailbox` is needed by everything below. "Season" means sending is open (December 31 where the sender lives).

| Route | Keys and gates | Contract |
| --- | --- | --- |
| `GET /api/mailbox/cards` | `holiday_cards` | As today, plus `media: { photo: { usable, max_bytes, long_side }, voice: { usable, max_seconds, max_bytes } }`. `usable` is false while `holiday_card_memories` is off or voice isn't shipped. |
| `POST /api/mailbox/cards/media` | `holiday_card_memories` | Multipart: one `file` and `kind` (`photo` or `voice`). Answers 201 `{ media: MediaRef, expires_at }`. The reference can be sent for 72 hours, and only by its uploader. |
| `GET /api/mailbox/cards/media/:fileId` | `holiday_card_memories` | The uploader's own preview of an upload that hasn't been sent. Bytes, private, no-store. |
| `POST /api/mailbox/cards` and `/cards/preview` | `holiday_cards`, season; media need `holiday_card_memories` too | As today, plus `request_id` (step 1) and, from step 3, `photo` (a file id), `photo_alt` and `voice` (a file id). The note stays required. Preview runs the same media checks and stores nothing. |
| `POST /api/mailbox/cards/:id/take-back` | `holiday_cards` | As today, plus the withdrawn record (section 6). |
| `GET /api/mailbox/:id/card-media/:fileId` | `mailbox` | Bytes of a photo or voice on piece `:id`, for a permitted reader (section 7), with a byte range for voice. Never before delivery, while sealed, or after a block that came before delivery. `Cache-Control: private, no-store`. Apps keep what they download in their account-scoped cache and clear it on sign-out. |
| `GET /api/mailbox/sent/:id/card-media/:fileId` | `mailbox` | The author's own piece's media, in Sent and Look it over. |
| `GET /api/mailbox/cards/:id/exchange` | `mailbox`; reply controls need `holiday_card_memories` | The joined card (section 5). `:id` may be the original or the reply. |
| `POST /api/mailbox/cards/:id/reply/preview` | `holiday_card_memories` | The same body as the reply. Runs every check the reply runs and stores nothing. |
| `POST /api/mailbox/cards/:id/reply` | `holiday_card_memories` | `{ message, photo?, photo_alt?, voice?, request_id }`. `request_id` is required. Answers 201 `{ reply }`, a repeat 200 `{ reply }`. |
| `POST /api/mailbox/cards/:id/reply/take-back` | `holiday_card_memories` | The caller's pending reply to card `:id`, until its pickup. |
| `GET /api/mailbox/card-collections/:season` | `mailbox` | The collection (step 8): `?filter=received\|sent&before=<cursor>` returns `{ items, next }`, with one tile per original. |
| `POST /api/users/:userId/report` | as today | Adds optional `mail_id` (section 9). |
| `POST /api/users/:userId/block` | as today | Also withdraws pending cards and replies (section 8). |
| `GET /api/admin/reports/user/:reportId/card` and `/card/media/:fileId` | admin | The one piece the report shares, logged per opening (section 9). |

The three reply routes need `mailbox` and `holiday_card_memories`, never `holiday_cards`, and they work after December 31. Turning a key off never hides delivered content: every read route needs only `mailbox`.

## 5. Shapes

**A card on a piece.** `piece.card` (`holidayCards.cardView`) keeps every field it has today and adds:

```text
card.photo   { file_id, width, height, alt, covered } | null
card.voice   { file_id, duration_ms } | null
```

Both are null while the card is sealed or not yet delivered, and nothing about them appears then (no size, length, name or link). `covered` is set for the reader (section 10).

**A reply on a piece.** `piece.card` stays null. A build that knows cards but not replies then shows a reply as a plain letter with its note, which is also how builds without cards show cards.

```text
piece.card_reply { card_id, design, number, caption, paper, height, year, photo, voice }
```

**The joined card.** `GET /api/mailbox/cards/:id/exchange`:

```text
{
  original:      Page | null,        null once this reader shredded it, or the row is gone
  reply:         Page | null,        a delivered reply this reader may see
  pending_reply: { id, arrives_on, take_back_until, can_take_back } | null,   only the replier's own
  can_reply:     boolean,
  reply_controls: { photo: boolean, voice: boolean },
  reply_refusal: { code, error } | null                why not, in the server's words
}
Page = { id, from_name, to_name, sent_on, delivered_on, card | card_reply, note, photo, voice }
```

It never says whether, or when, the other person opened, kept or shredded anything.

**New answer codes.**

| Code | Status | When |
| --- | --- | --- |
| `CARD_TAKEN_BACK` | 409 | A retry of a send or reply that was taken back or withdrawn by a block. "You took this card back." for the sender, and "This card wasn't sent." after a block, which never says why. |
| `CARD_REQUEST_SENT` | 409 | A request ID already sent with different content, or a preview of a draft that is already sent. The answer includes `card`, what was sent. |
| `CARD_REPLY_EXISTS` | 409 | A second reply to the same card. |
| `CARD_REPLY_CLOSED` | 403 | Not delivered yet, still sealed, a blocked pair, a deleted sender, or the caller isn't its recipient. |
| `CARD_MEDIA_EXPIRED` | 410 | An upload reference older than 72 hours. |
| `CARD_MEDIA_NOT_YOURS` | 403 | Someone else's upload. |

## 6. Request IDs (built in step 1)

**The app.** It creates a request ID (a UUID) once for each card draft, keeps it while the draft is open, and sends it with every Look it over and Seal and send. It clears the ID once it has seen the card sent or taken back; the next card is a new draft with a new ID. Keeping the ID through a relaunch is part of step 4's drafts. A server without this change drops the unknown field, so newer apps keep working against older servers.

**The server.**
- **Row id.** The card's `Mail.id` is derived from the sender and the request ID: `sha256(["holiday_card_v1", sender_id, request_id])`, formatted as a UUID with version 5 and variant 8, as the gig-completion `File` ids are (`s3Service.js` ~266).
- **What is kept.** `card.request = { id, digest }`. The digest covers the design, the note as stored, the arrival and the recipient (the user id, or the normalized email), and later the photo and voice ids.
- **First send.** It runs every check as today. On its insert, the database refuses a second row with the same id. That refusal, not a check before it, is what makes one card per send a guarantee.
- **The same-day check.** After the insert, the request that saved the card recounts the sender's live cards of that day. The first (by time, then id) stays. A later one is deleted and answered 429 `CARD_DAILY_LIMIT`, as today. If the card stays, `settled_at` is written and the card is answered as sent.
- **Repeats.** A request whose card exists is answered from that card:

| The stored card | Answer |
| --- | --- |
| Withdrawn (taken back, or withdrawn by a block) | 409 `CARD_TAKEN_BACK`. It never sends again. |
| Different digest | 409 `CARD_REQUEST_SENT`, with the stored card |
| Settled | 200 `{ card }`, the same summary the first answer gave |
| Not settled yet (its first request is still running, or failed partway) | The repeat runs the same-day check itself, then answers as above. Every write in that check is conditional (the delete only removes an unsettled card, and the mark skips a withdrawn one), and each answer is read from what the writes left. Two requests deciding at once therefore always agree. |

- **Look it over with a request ID whose card exists** answers 409 `CARD_REQUEST_SENT` (with the card) or `CARD_TAKEN_BACK`, never the day's limit.
- **Failures.** A failed recount, `settled_at` write or delete answers 503 `CARD_UNAVAILABLE`, which means "not known; retry with the same request ID". It is never answered as sent, and never "You've sent today's card" while the card stays. The card is left for the retry to settle. A card sent without a request ID can't be found by a retry, so a failed recount removes it first.
- **Lost answers inside the server.** An insert that reached the database while its answer to the backend was lost is found again by its row id, and the send carries on.
- **Notes left behind.** A card's stored note is removed only after its `MailObject` row is really deleted. Today a failed delete still removes the note's file, so the card that stays has no note.

**Take-back keeps a withdrawn record.** For a card to a person sent with a request ID, take-back no longer deletes the row. It becomes the shape a taken-back email card already has:
- `escrow_status: 'withdrawn'`;
- no recipient: `recipient_user_id`, `delivery_target_*` and `recipient_type`/`recipient_id` are cleared;
- no note: `object_id` is cleared and the `MailObject` removed;
- `mail_extracted` reduced to `{ card: { request, withdrawn } }`, with no design. The record is no longer a card to any reader, so no list, count, notice, Sent or search can show it.

A taken-back card by email already stays as a withdrawn record, as before. It keeps its address and note, so its link can say the card was taken back, and email limits still count it. Cards to a person sent without a request ID are deleted on take-back, as today. The day's card is free again either way, because withdrawn rows never count.

**Built and proven in step 1.**

| Part | PR | State |
| --- | --- | --- |
| Server | [#3187](https://github.com/WangPantopus/skinny-pantopus/pull/3187) | Merged (16bbfd69b2), live in production since November 3 |
| Web | [#3189](https://github.com/WangPantopus/skinny-pantopus/pull/3189) | Merged (a85faf3719) |
| iPhone | [#3190](https://github.com/WangPantopus/skinny-pantopus/pull/3190) | Merged (832fee785c) |
| Android | [#3191](https://github.com/WangPantopus/skinny-pantopus/pull/3191) | Merged (ec7cb16449) |

Cases 1–5 and 7 of the plan's section 4 were checked against a real local backend and database, with fault proxies; each PR lists its evidence.

**Replies (step 5).**
- **Row id.** `sha256(["holiday_card_reply_v1", card_id])`, so a card has at most one reply row.
- **The same request ID again.** The stored reply is answered: 200 `{ reply }` for the same digest, and `CARD_REQUEST_SENT` for different content.
- **A new request ID while a reply exists.** 409 `CARD_REPLY_EXISTS`.
- **Taking a reply back** deletes the reply row, which frees the slot. It first appends the reply's request ID to the original's `card.reply.withdrawn_requests`. A retry of that ID then finds the ID listed and answers `CARD_TAKEN_BACK`.

## 7. Who may do what

"Delivered" means its delivery time has passed and no block came before it. "Open" means delivered and no longer sealed.

| Action | Author | Recipient | Household co-member | Anyone else (including someone holding a forwarded email link) | Admin |
| --- | --- | --- | --- | --- | --- |
| Upload media, preview own upload | Own uploads only | Own uploads only | Own uploads only | Own uploads only | No |
| Send an original with media | Yes, with the keys, the season and the day's card | — | — | — | No |
| See a pending piece's note and media | Own piece, in Look it over and Sent | No | No | No | No |
| See a sealed card's media | Own piece, in Sent | Envelope and seal only | No | No | No |
| See an open piece's note and media | Own piece, in Sent | Yes | No | No | Only a piece a report shares |
| Reply | — | Once, to an open original | No | No | No |
| See a reply | The replier, in Sent, always | The original's sender, once delivered | No | No | Only a reply a report shares |
| Take back | Before pickup: the original's sender (`holiday_cards`) or the replier (`holiday_card_memories`) | — | — | — | No |
| Report and share the piece | — | A delivered piece they received | No | No | — |
| Block | Either person, any time. Withdraws pending pieces both ways. | | | | |
| File, shred, restore | Each reader, their own copy | | | | |

A file id, enclosure id or storage path in a request never grants anything. Each route checks the piece and the reader.

## 8. Blocks

**At the block.** When either person blocks the other, `POST /api/users/:userId/block` withdraws every undelivered card and reply between them, in both directions, today's text cards included. Each becomes the withdrawn record of section 6, with `withdrawn.reason: 'blocked'`, and its note and media are removed. A card by email that nobody has claimed is unaffected, since it has no account at the other end.

**The backstop.** Delivery has no job, so the block can come moments before 7 a.m. The reads skip a card or reply whose delivery time came after a block between the two people (`UserBlock.created_at`). These reads are lists, details, the joined card, the media routes, counts and the morning notice.

**What each person sees.**
- The sender's Sent shows `status: 'not_delivered'`, "Couldn't be delivered," without saying why.
- The recipient never sees the piece.
- A retry of the withdrawn send gets `CARD_TAKEN_BACK` with "This card wasn't sent."

Pieces delivered before the block are unchanged.

## 9. Report this card

**The report.** `POST /api/users/:userId/report` takes an optional `mail_id`, the card or reply being reported.
- **Checks.** The piece must be one the reporter received, delivered and open, and its author must be `:userId`.
- **What is written.** The report is the existing `UserReport` row (reason and details). The server adds `{ report_id, at }` to the piece's `reports`.
- **The sheet says** "Pantopus will be able to see this card to review it."

**The admin queue.** The Reports queue (`GET /api/admin/reports`) shows such a user report with `shared_card: { kind: 'card' | 'reply' }`.
- **Opening it.** `GET /api/admin/reports/user/:reportId/card` opens only that piece: the picture, note, photo, voice and both names. Its media come through `/card/media/:fileId`.
- **The log.** Each opening is written to `MailEvent` (`admin_opened_reported_card`, with the admin's id and the report id).
- **Nothing else opens.** An admin can't open any other piece, including the other page of the same exchange, unless a report shares it.

Resolve and dismiss work as today. Someone has to work the queue promptly; Apple's guideline 1.2 expects a timely response.

## 10. Covered photos

`card.photo.covered` (and `card_reply.photo.covered`) is true when the reader isn't the author's connection at the time of reading (`getConnectionUserIds`).
- The apps show a cover, "Photo from {name}. Tap to show.", and load the photo only after the tap. Nothing is prefetched.
- The author's own views, Look it over and Sent, are never covered.

## 11. Keeping and cleanup

- **Before delivery.** Taking back or a block removes the piece's note and media and keeps the withdrawn record (section 6).
- **After delivery.** Shred is per reader, with the existing 30-day recovery. The author keeps their copy. The nightly purge's sent-card exception extends to replies.
- **Uploads.** A reference not sent within 72 hours can't be sent. Cleanup removes files no `Mail` or `MailObject` refers to after seven days. It never removes an author's retained copy, or media by age alone. Cleanup is server-only and can land after the store builds.
- **Account deletion.** A person's `File` rows go with their account (`File.user_id` cascades), so their cards lose photo and voice for the other person. The note follows the card's existing rules, and a reply whose original is gone opens on its own.

## 12. Privacy

- Personal media and reply content stay out of invite emails, public claim pages, push previews, summaries, analytics and operational logs. Logs carry ids, never file names or signed links.
- A sealed or pending piece never leaks a thumbnail, duration, file name or link through any route, Look it over and Sent excepted for its author.
