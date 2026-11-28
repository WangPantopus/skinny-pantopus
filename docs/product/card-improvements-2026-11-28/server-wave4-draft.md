# Wave 4, server fields: draft for the coordinating session (not built)

Server session, 2026-11-28. Everything below is only while `CARD_IMPROVEMENTS` is on; off, no field appears and the
photo-card design is refused. Nothing here needs a migration or a new table.

## 4.1 The welcome strip and the card-claim path

### What the Mailbox root read carries

`GET /api/mailbox/cards` is the read all three apps already make at the Mailbox root (it carries `improved` and
`stamps`). It gains one optional object:

```json
"welcome": {
  "card_id": "<mail id>",
  "from_first_name": "Maya",
  "can_write_back": true,
  "stamps": 7
}
```

- Present only when all of these hold; otherwise absent, and the apps draw no strip:
  - the account is under 14 days old (the rule `GET /cards/waiting` and the profile's `guidance.new_account` use);
  - their own Me mailbox holds at least one Christmas card they have opened, not deleted or archived;
  - they have sent nothing: no card stored from them that wasn't taken back, and no reply to a card;
  - sending is open where they live (the rule the "Send a Christmas card" row uses).
- `card_id`: the newest such opened card; "Write back to Maya" and the strip's title point at it.
- `from_first_name`: the first word of the sender's name as the Mailbox names them (as `GET /cards/waiting` does),
  never their private account name; `"Someone"` when it can't be read.
- `can_write_back`: whether a reply can be written to that card now (replies on, none written yet, the sender still
  reachable). False: the strip shows only "Send a Christmas card".
- `stamps`: the stamps they can send with now (`stamps.available`), or `null` when the balance can't be read; the
  strip then leaves the number out.
- It goes away by itself: once they send a card or write back, the object is absent on the next read.
- **Dismissing (×)**: kept on the device, per account. No server state. (The alternative is the server-kept list
  guidance cards use, `User.guidance_seen` with a new id `card_welcome`; it needs no migration, but its routes exist
  only while `GUIDANCE_CARDS` is on, which is off in production, so I don't recommend it.)

### How an app knows it is on the card-claim path

Two signals, so it also holds after a reload and on a phone:

1. **Web, same visit**: no server field. The web is on `/open/[mailId]`, whose `GET /claim/:mailId` said
   `improved: true` and `mail.card` (non-null only for a Christmas card). It sets its own session flag before it goes
   to `/app/mailbox/personal/:id`.
2. **Any app, any later load**: the piece read `GET /api/mailbox/:id` gains `card.joined_for: true` when the reader is
   the card's recipient, the card reached them from an email or a link (it was claimed), and their account is under
   14 days old. Absent otherwise. While a piece with `joined_for` is on screen, the app shows no "Your daily
   briefings" notice and no guidance card; they wait for the next visit outside the card.

## 4.2 A photo as the card's front

### The design

- Design id: **`christmas-2026-photo`**. It is **not** in `designs`, `collections` or `opening` of `GET /cards`, not in
  `GET /cards/designs`, and has no public page, share picture, share video or sitemap entry. So no app from before
  this shows it on Pick a card, and the catalog's order is untouched.
- `GET /api/mailbox/cards` gains, while a photo can be added at all (`media.photo.usable`):

```json
"photo_card": {
  "design": "christmas-2026-photo",
  "frames": ["heirloom", "midnight", "arch"],
  "default_frame": "heirloom",
  "caption_limit": 42,
  "shapes": [{ "id": "portrait", "w": 4, "h": 5 }, { "id": "square", "w": 1, "h": 1 }, { "id": "landscape", "w": 4, "h": 3 }]
}
```

  Absent: no "Make a photo card" pill. Frames: `heirloom` (Heirloom Cream, the default), `midnight` (Midnight Velvet),
  `arch` (Winter Arch).
- The web serves one stock picture at the design's address (`/holiday-cards/card/christmas-2026-photo.jpg`, and
  whichever other sizes the apps fetch for a design today). **That picture has to be made**; it is what an app from
  before this draws as the card's front.

### Sending

`POST /cards`, `/cards/preview`, `/cards/batch`, `/cards/batch/preview`:

```json
{ "design": "christmas-2026-photo", "photo": "<file id>", "photo_alt": "…", "front": { "frame": "heirloom", "caption": "Merry Christmas from the Riveras" }, "voice": "<file id, optional>", … }
```

- `photo` is required with this design: a file from the existing `POST /cards/media` (`kind: photo`), **cropped on the
  device** to one of the three shapes before upload. The server stores it as it stores a card's photo today (JPEG,
  long side at most 2400 px, 10 MiB, location and camera data removed) and checks only that its shape is within 2% of
  4:5, 1:1 or 4:3.
- `front.frame`: one of the three. `front.caption`: optional, whitespace folded and trimmed, one line, at most 42
  letters.
- Refusals, all 400 unless said: `CARD_FRONT_NEEDS_PHOTO` (the design without `photo`), `CARD_FRONT_FRAME_UNKNOWN`,
  `CARD_FRONT_CAPTION_TOO_LONG`, `CARD_FRONT_SHAPE`, `CARD_FRONT_NO_TRAVEL` (`travel: true`), `CARD_FRONT_NO_LIVE`
  (`photo_live`), `CARD_FRONT_NOT_PHOTO_CARD` (`front` with a stock design); and `CARD_DESIGN_UNKNOWN` for the design
  while the switch is off. The existing photo refusals apply as they do today (`CARD_MEDIA_EXPIRED`,
  `CARD_MEDIA_NEEDS_STAMP`, …).
- The request digest counts `front` only when present.

### Where it is stored

- The photo: the card's own `photo`, exactly as today: one private `File`, tied to the card (or to each card of a
  list), read through the same three routes with the same rules.
- Frame and caption: in the card's private stored copy beside the note and signature (`body.payload.front`). Nothing
  of them in the Mail row.
- Mail row: `mail_extracted.card.design = 'christmas-2026-photo'` and the stock caption (e.g. "A photo card"), with
  the stamp marks any photo card has.
- Stamps: a photo card like any other (a free place while one is left, else a bought stamp).

### What each existing read returns for such a card

| Read | Returns |
| :--- | :--- |
| `piece.card` where the stored copy is read (`GET /mailbox/:id`, `GET /sent/:id`, Look it over's `piece`, `POST /claim/:id/open`) | The design's stock fields (`design`, `number: null`, stock `caption`, `paper`, `height`, `table`, `mood`), `slug: null`, `photo` as today (`file_id`, `width`, `height`, `alt`, `covered`), and new **`front: { frame, caption }`**. `front` and `photo` are null while the card is sealed. A stock card has no `front`. |
| Lists (Mailbox list, the mantel, Sent list, send answers' `card`) | The Mail row only: `design: 'christmas-2026-photo'`. No frame, caption or photo. |
| `GET /claim/:mailId` | `mail.card.front: null`, as for a sealed card, so the page and its link preview show the sealed envelope. Nothing says it is a photo card. |
| The card's email and its reminder | The sealed-envelope picture and "a Christmas card". |
| `card.travel`, pass-on routes | Never present; a pass-on is refused as for any card that doesn't travel. |
| `GET /cards/share-video/:design`, `POST /cards/shared` | 404 / refused for this design. |
| A reply to it (`piece.card_reply`) | `design: 'christmas-2026-photo'` and its stock fields; never the photo. |
| Media routes | Unchanged: `/:id/card-media/:fileId`, `/sent/:id/card-media/:fileId`, `/claim/:id/card-media/:fileId` with the claim token. |

How the two kinds of build draw it:

- **Knows `front`**: draws `photo` inside the frame as the card's front, veiled first when `photo.covered` is true
  ("Tap to view Maya’s photo"), and does not show the photo a second time inside the envelope.
- **Doesn't know it**: draws the stock picture at the design's address and the photo inside the envelope, as a card's
  own photo is today.

### What I would change in the settled constraints, and why

1. **Store the front as the card's existing `photo`, not a new `photo_front` kind** (the plan's wording). It gives the
   fallback for old builds for nothing, and keeps one access rule, one stamp rule and one clean-up. The cost: a
   photo-front card cannot also carry a second photo inside the envelope. I recommend accepting that.
2. **No Live Photo on a photo-front card** this round (`photo_live` refused). Nothing in the design says what the
   moving part does on a front.
3. **Lists and the mantel show the stock picture, not the photo.** Frame, caption and photo are in the private copy,
   which list reads don't open. If the founder wants the real photo standing on the mantel, the app must load each
   such piece (one read per card) and the covered rule still applies. I would leave it for a later round.
4. **A sealed photo card can be told apart before it opens** by its design id in list reads (the stock picture is
   different from any catalog card). Today the server hides the mark that a sealed card holds a photo. I see no way
   round it that keeps old builds drawing something right, so I recommend accepting it and that the apps don't word
   it ("a photo card") while sealed.
5. **The stock picture must exist before any of this ships**, and its `height` at 960 px wide goes in the server's
   design entry. Who makes it is the founder's call (Wave 5 is held for pictures for the same reason).
6. **"Send this card again" from a photo card** opens the studio empty: a file is tied to the card it went on, so the
   old photo cannot be sent again without a new upload.
7. **Crop on the device, shape checked on the server** (within 2%), rather than the server cropping: the sender sees
   exactly what goes.
