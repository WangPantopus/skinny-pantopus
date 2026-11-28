# Wave 5, server fields: thank-you cards

Server session, 2026-11-28, from `CONTRACT-wave5.md`. This is what the server will send and take; the app sessions can
build against it now. The server PR follows on branch `cards-next-server/wave5-thank-you`.

Everything here is only while `CARD_IMPROVEMENTS` is on (`improved: true` on the read). Off, none of it exists and a
thank-you design is refused as an unknown design. No migration and no table.

## 0. The two rules that shape every field

- **Fields a store build reads today do not change, at any date.** On `GET /api/mailbox/cards`: `open`, `holiday`,
  `year`, `closes_on`, `designs`, `collections`, `opening`, `arrivals`, `today`, `media`, `travel` say exactly what
  they say today. So `open` turns false when December 31 ends, and `designs` never holds a thank-you design.
  On a card: `holiday` stays `"christmas"` on every card, a thank-you card too (it is the field old builds read).
- **A thank-you card is told by new fields only.** A card without them is drawn exactly as today.

## 1. `GET /api/mailbox/cards` → `thank_you`

Present only while the reader can send a thank-you card now (by their own clock). Absent: nothing new.

```json
"thank_you": {
  "only": false,
  "entry": "Send a thank-you card",
  "name": "thank-you card",
  "plural": "thank-you cards",
  "strip": "THANK YOU, 2026",
  "envelope": "cream",
  "closes_on": "2027-01-15",
  "collections": [
    { "id": "thank-you-christmas", "name": "Thank You", "short": "Thank You", "slug": "thank-you-christmas",
      "line": "For the gift, the dinner, the welcome.",
      "designs": ["thank-you-01", "thank-you-02", "thank-you-03", "thank-you-04", "thank-you-05", "thank-you-06", "thank-you-07", "thank-you-08"],
      "pick": "thank-you-01", "opens_on": "2026-12-26", "closes_on": "2027-01-15" }
  ],
  "designs": [
    { "id": "thank-you-01", "number": null, "caption": "It was just what I wanted.", "paper": "#f7f0e2",
      "collection": "thank-you-christmas", "height": 960, "slug": "it-was-just-what-i-wanted", "table": "#704b51", "mood": "nostalgia" }
  ],
  "arrivals": { "person": ["next_morning", "now"], "email": ["next_morning", "now"], "link": ["now"] }
}
```

- `only`: true once Christmas cards are closed (top-level `open` is false). Then the entry reads `entry` and Pick a
  card shows these collections alone. While false, "Send a Christmas card" stays as it is and these collections are the
  last shelves on Pick a card, after every Christmas collection.
- `entry`: the words of the entry while `only` is true.
- `name`, `plural`: what to call one and several, lower case, for every place the flow says "Christmas card(s)" about
  a thank-you card ("a thank-you card", "Your thank-you card is on its way").
- `strip`: what a thank-you card sent now prints under its picture: "THANK YOU, " and the year where the sender lives
  now ("THANK YOU, 2027" from January 1).
- `envelope`: `"cream"`, the cream linen envelope. No field means the red one, as today.
- `closes_on`: the last day a thank-you card can be sent where they live, or `null` when a collection with no end is
  open (`CARD_EVERYDAY`).
- `collections`: the ones open now, in order, in the shape of today's `collections` plus `opens_on` and `closes_on`
  (`null`: no end). `designs`: their designs, in the shape of today's `designs` (`number` is `null`; pictures are
  square, `height` 960 at 960 wide; the picture is at the same address as any design's, by its id).
- `arrivals`: the choices for a thank-you card. Nothing sealed. For a chosen person use `GET /cards/arrivals`
  as today (`arrivals_all`), which after Christmas morning is `["next_morning","now"]` already.
- When nothing can be sent (`open` false and no `thank_you`): the closed screen, as today.

The designs (all `paper` `#f7f0e2`, `mood` `nostalgia`, `height` 960, `number` null):

| id | caption | slug | table | collection |
| :--- | :--- | :--- | :--- | :--- |
| `thank-you-01` | It was just what I wanted. | `it-was-just-what-i-wanted` | `#704b51` | `thank-you-christmas` |
| `thank-you-02` | Thank you for having us. | `thank-you-for-having-us` | `#6e4b30` | `thank-you-christmas` |
| `thank-you-03` | Thank you for the warmest welcome. | `thank-you-for-the-warmest-welcome` | `#2c4071` | `thank-you-christmas` |
| `thank-you-04` | Here’s to you. Thank you. | `heres-to-you-thank-you` | `#704b51` | `thank-you-christmas` |
| `thank-you-05` | Thinking of your kindness. | `thinking-of-your-kindness` | `#3b4c6e` | `thank-you-christmas` |
| `thank-you-06` | Thank you for a beautiful dinner. | `thank-you-for-a-beautiful-dinner` | `#6e4b30` | `thank-you-christmas` |
| `thank-you-07` | A little note to say thank you. | `a-little-note-to-say-thank-you` | `#6e4b30` | `thank-you-christmas` |
| `thank-you-08` | Thank you. It’s already a favorite. | `thank-you-its-already-a-favorite` | `#704b51` | `thank-you-christmas` |
| `thank-you-09` | Thank you for a lovely afternoon. | `thank-you-for-a-lovely-afternoon` | `#3b4c6e` | `thank-you` |
| `thank-you-10` | Thanks for the company. | `thanks-for-the-company` | `#6e4b30` | `thank-you` |
| `thank-you-11` | Thank you. It didn’t last the day. | `thank-you-it-didnt-last-the-day` | `#6e4b30` | `thank-you` |
| `thank-you-12` | Thank you for being next door. | `thank-you-for-being-next-door` | `#2c4071` | `thank-you` |

Collection `thank-you`: name "Thank You", short "Thank You", slug `thank-you`, line "For any kindness, any time of
year.", pick `thank-you-12`, `opens_on` `2027-01-01`, `closes_on` `null`.

### Public list, for the website's pages

`GET /api/mailbox/cards/designs` (no sign-in; today's fields unchanged) gains
`thank_you: { collections: [… each with opens_on, closes_on, open], designs: [...] }`: every thank-you collection
that exists (the year-round one only while `CARD_EVERYDAY` is on), with `open` told by Pacific time, since no one is
signed in. The web builds a collection's public pages while its `open` is true.

## 2. What a thank-you card's reads carry

Wherever a card is described, a thank-you card adds four fields, and a Christmas card has none of them:

```json
"kind": "thank_you", "name": "thank-you card", "strip": "THANK YOU, 2026", "envelope": "cream"
```

- `strip` carries the year the card was sent (kept on the card), not this year.
- The other fields are as for any card: `design`, `number: null`, `caption`, `paper`, `height`, `slug`, `table`,
  `mood`, `holiday: "christmas"` (unchanged, see section 0), `year` (the year it was sent), `arrival`, `sealed: false`,
  `signature`, `photo`, `voice`. Never `travel`.

| Read | What a thank-you card has there |
| :--- | :--- |
| `piece.card` everywhere (lists, the piece reads, Look it over, Sent detail, the guest table) | the four fields |
| the piece's `subject` / `display_title` | "A thank-you card" (a reply: "A reply to a thank-you card") |
| send answers' `card` and Sent rows | `kind` and `name` |
| `GET /claim/:mailId` | `mail.subject` "A thank-you card"; `mail.card` gains the four fields; `front` as for any card |
| `POST /claim/:mailId/open` | `card` with the four fields |
| `piece.card_reply` (a reply to one) | `kind` and `name` |

Rules the apps apply to `kind: "thank_you"`: no mantel, no share video, no travel switch. It can carry a photo and a
voice greeting, go to a list, and be written back to.

## 3. Sending: `POST /cards`, `/cards/preview`, `/cards/batch`, `/cards/batch/preview`

The body is today's, with `design` a thank-you id.

| Case | Answer |
| :--- | :--- |
| a thank-you design while its collection is open where the sender lives | taken |
| before its collection opens, or the year-round collection while `CARD_EVERYDAY` is off, or the switch off | 400 `CARD_DESIGN_UNKNOWN`, as any id that doesn't exist |
| after its collection closed | 410 `CARDS_CLOSED`, "Thank-you cards are done for this season." |
| a Christmas design (or the photo card) after December 31 | 410 `CARDS_CLOSED`, "Christmas cards are done for this year.", as today |
| `arrival` `sealed_christmas` or `christmas_morning` | 400 `CARD_ARRIVAL_CLOSED`, as today after Christmas morning |
| `travel: true` | 400 `CARD_THANK_YOU_NO_TRAVEL`, "A thank-you card doesn’t travel. Turn that off to send it." |

Everything else is as for any card: stamps, the free photo or voice cards, the day's limits, one card to a person a
morning, one right away a day, a name on a link, a list, the request ID rules.

## 4. "Send a thank-you card" on an opened Christmas card

On the piece reads (`GET /api/mailbox/:id`, `GET /api/mailbox/v2/item/:id`), a card gains

```json
"send_thank_you": { "label": "Send a thank-you card", "to": { "user_id": "<the sender>", "name": "Maya Rivera" } }
```

when all hold: the reader is who the card went to; it is a Christmas card (no `kind`); it has arrived and is not
sealed; its sender is a person still on Pantopus; and the reader can send a thank-you card now (so from December 26 by
their clock, and not after the thank-you cards close). Absent otherwise. The action opens the send flow at the
thank-you shelf with `to` chosen; the usual checks run when it is sent.

## 5. `CARD_EVERYDAY` (off unless `1`; counts only while `CARD_IMPROVEMENTS` is on)

| | off | on |
| :--- | :--- | :--- |
| `thank-you-christmas` (01–08) | open December 26 – January 15 | the same |
| `thank-you` (09–12) | does not exist: not in any read, its designs unknown to the send routes | open from January 1, no end |
| `thank_you` on `GET /cards` | present December 26 – January 15 | present from December 26 on; from January 16 the year-round collection alone, `closes_on: null` |
| `send_thank_you` | December 26 – January 15 | from December 26 on |
| a card already sent | read whole either way | read whole either way |

## 6. The server's own words for a thank-you card

"thank-you card" in place of "Christmas card" in: the piece's subject; the card's email (subject, heading, lines) and
its reminder; the code email and its return button; the claim page's subject and its closed-link answers; the notices
to the sender (their card arrived, its email could not be sent, nobody opened it); "Help me write it". The morning
mail notice and the right-away notice name no kind of card, so they need no change. The card's email shows the
design's own link picture (`/holiday-cards/share/<design>-link.jpg`), which the web session makes.

## 7. What I would change in the contract, and why

Nothing that blocks the apps. Three things to settle, and the default I am building:

1. **Stamp books stay on sale while a thank-you card can be sent** (founder, November 28: "Yes, keep selling").
   While the switch is on, sales are open when Christmas cards are on sale as today (through
   `MAIL_STAMPS_SALES_LAST_DAY`, December 26) **or** a thank-you card can be sent where the person lives. So: open
   through January 15, closed from January 16, and open again with `CARD_EVERYDAY`. With the switch off, sales end
   after December 26 as today. The apps need no change: they read `sales_open` on `GET /api/mailbox/stamp-books` and
   `media.bought_stamp.state` on `GET /api/mailbox/cards` (`buy` or `unavailable`), as today. This is the one place
   a store build reads something new: from December 27 it too sees books on sale.
2. **`holiday` stays `"christmas"` on a thank-you card.** Changing a field old builds read risks more than it gives;
   `kind` is the new field to read.
3. **A thank-you design before its window is "unknown", not "not yet".** On December 20 nothing about it exists in any
   answer, so nothing can ask for it; a separate "not yet" answer would be the only trace of it.

Smaller notes: the photo card closes with Christmas cards (its frames print "CHRISTMAS"); the assistant's own card
drafting stays Christmas-only this wave; Wave 4's `welcome` now follows "a card can be sent" rather than "Christmas
cards can be sent", so it still shows in the thank-you weeks (its second button then uses `thank_you.entry`).

## 8. Running a local backend on another date

A preload shifts the backend's clock: `~/.pantopus-review/handoffs/cards-next/shift-clock.cjs`. Checked: a backend
started with it answers signed-in requests as usual and reports the next morning as December 28.

```bash
cd backend && CARD_CLOCK=2026-12-27T18:00:00Z node -r ~/.pantopus-review/handoffs/cards-next/shift-clock.cjs app.js
```

- `CARD_CLOCK` is the moment the backend believes it is when it starts (UTC); time runs on from there. 18:00Z is
  10 a.m. Pacific, the zone a test account without a home gets.
- The four dates: `2026-12-20T18:00:00Z` (nothing new), `2026-12-27T18:00:00Z` (Christmas and thank-you),
  `2027-01-02T18:00:00Z` (thank-you only; add `CARD_EVERYDAY=1` for both thank-you collections),
  `2027-01-16T18:00:00Z` (closed; with `CARD_EVERYDAY=1`, the year-round collection alone).
- Restart the backend to change the date. Until the server PR is merged, run it from the server's branch.
- What does not shift: the database's own clock and Supabase Auth. So signing in works; rows are still stamped with
  today's real date; a card "with the morning mail" is delivered on the shifted next morning, which the shifted
  backend shows only after that moment (restart a day later, or move its `delivered_at` in the local database);
  an account made today looks over 14 days old on a shifted date, so Wave 4's `welcome` and `joined_for` are absent
  there.
- A photo or voice uploaded through a shifted backend can be sent from it: the server's Wave 5 branch stamps an upload
  with its own clock. (On older server code such an upload answers `CARD_MEDIA_EXPIRED` on a shifted date.)
- It refuses to run where `APP_ENV` is staging or production.
