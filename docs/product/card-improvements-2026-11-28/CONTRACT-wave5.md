# Wave 5: thank-you cards (contract section 6, settled)

Coordinating session, 2026-11-28. The founder sent twelve pictures (`thank-you-pictures/thank-you-01.jpg` … `-12.jpg`
beside this file; 1024 × 1024, square). Everything here is only while `improved` is true; off, cards close when
December 31 ends, as before, and none of this exists. `CONTRACT.md` sections 0 and 1 still govern (areas, no
self-merge, real-app walks with the switch on and off).

The plan's Birthday, Thinking of You and New Home collections have no pictures yet and are **not** in this wave. A
year-round photo card is not in this wave either (its frames print "CHRISTMAS").

## What people get

1. **Christmas thank-you cards**, December 26 through January 15 where the sender lives: the eight winter pictures.
   Christmas cards still close when December 31 ends.
2. **"Send a thank-you card"** on a Christmas card someone received and opened, from December 26: one quiet action
   that opens the send flow at the thank-you shelf with that card's sender chosen.
3. **Year-round thank-you cards**, from January 1: the four all-season pictures, behind a second server switch
   `CARD_EVERYDAY` (**off unless set to `1`**; it protects the app builds already in the stores, which print
   "CHRISTMAS, 2026" on every card). It counts only while `CARD_IMPROVEMENTS` is on.

## The pictures and their captions (captions are proposals; the founder may change them)

| Design id | Picture | Caption | Collection |
| :--- | :--- | :--- | :--- |
| `thank-you-01` | an opened gift box, ribbon, a mug, the tree | It was just what I wanted. | Christmas thank-you |
| `thank-you-02` | a slice of cake and tea | Thank you for having us. | Christmas thank-you |
| `thank-you-03` | a lit house in the snow at dusk | Thank you for the warmest welcome. | Christmas thank-you |
| `thank-you-04` | two mugs meeting over candles | Here’s to you. Thank you. | Christmas thank-you |
| `thank-you-05` | a window, a mug, glasses, greens | Thinking of your kindness. | Christmas thank-you |
| `thank-you-06` | the table after dinner | Thank you for a beautiful dinner. | Christmas thank-you |
| `thank-you-07` | an envelope, a pen, a candle | A little note to say thank you. | Christmas thank-you |
| `thank-you-08` | a cat on a new scarf | Thank you. It’s already a favorite. | Christmas thank-you |
| `thank-you-09` | daisies and iced tea on a porch | Thank you for a lovely afternoon. | Thank you (year-round) |
| `thank-you-10` | two mugs and a croissant in the garden | Thanks for the company. | Thank you (year-round) |
| `thank-you-11` | a fresh loaf and a jar of jam | Thank you. It didn’t last the day. | Thank you (year-round) |
| `thank-you-12` | two porch chairs at golden hour | Thank you for being next door. | Thank you (year-round) |

Collections: `thank-you-christmas` ("Thank You", line "For the gift, the dinner, the welcome."; open December 26 –
January 15) and `thank-you` ("Thank You", line "For any kindness, any time of year."; open from January 1 while
`CARD_EVERYDAY` is on). Each has a `pick` of its own (01 and 12). They come **after** every Christmas collection; the
Christmas catalog and its order are untouched.

## Rules that shape the fields (the server session writes the exact fields in `server-wave5-fields.md`)

- **Builds already in the stores see nothing new as senders.** Every field they read today (`open`, `closes_on`,
  `designs`, `collections`, `opening`, `arrivals`) stays Christmas alone and says exactly what it says today, so for
  them cards still end on December 31. The thank-you collections, their designs and whether they are open travel in
  new fields only.
- **As recipients they must still get something right**: a thank-you card is a card like any other on the wire (same
  tag, same routes, stamps, limits, photo, voice, signature, list, email, link, guest opening, Write back), with its
  picture at the same kind of address, so an older build draws it (with "CHRISTMAS" under it, which is accepted for
  the Christmas thank-you weeks and is why year-round has its own switch).
- **Every word and date comes from the server.** A thank-you card's read carries what to call it ("thank-you card"),
  what to print under its picture ("THANK YOU, 2026", the year it was sent) and which envelope it lies on (the cream
  linen one, which all three apps already carry). The apps use those in place of "Christmas card" and "CHRISTMAS,
  2026" wherever a card that has them is shown; a card without them is drawn exactly as today. No app decides from
  its own clock whether something is open: the read says so.
- **The server's own words follow too**: the piece's subject, the card's email and its reminder, the code email, the
  claim page, notices, the morning notice and "Help me write it" say "thank-you card" for one.
- **Arrivals**: with the morning mail, right away, and by email as today. Nothing sealed.
- **A thank-you card does not travel**, has no share video, and stands on no mantel (the mantel is Christmas cards
  alone, through January 6, as decided on November 17). It can carry a photo and a voice greeting, go to a list, and
  be written back to.
- **The stock envelope and words in lists**: Sent rows and Mailbox rows say "thank-you card" where they say
  "Christmas card" today.
- **Search**: the thank-you collections get the public pages the other collections have, following
  `docs/seo/README.md`'s checklist, while each is open (web).
- **Entry points**: while Christmas cards are open, "Send a Christmas card" stays as it is and the thank-you shelf is
  the last shelf on Pick a card. Once only thank-you cards are open, the entry reads "Send a thank-you card" and Pick a
  card shows the thank-you shelf alone. When nothing is open, the closed screen as today.
- **Stamps** are unchanged: a thank-you card takes a stamp like any card.

## Checking dates that haven't come

Nobody waits for December 26. The server session runs its local backend on a shifted clock (as it did for the
reminder timing) and tells the app sessions how; the apps are walked against that backend at: December 20 (nothing
new), December 27 (both), January 2 (thank-you only; and with `CARD_EVERYDAY=1`), January 16 (closed, or year-round
only with the switch).

## Order of PRs

| Area | PR |
| :--- | :--- |
| server | the collections, designs, open windows, new fields, words and `CARD_EVERYDAY`, one PR; `server-wave5-fields.md` first |
| web | the picture files at every address and size the apps fetch (960 wide, from the 1024 originals), the share and link pictures the card emails need, and the public pages; then the flow and reading |
| iPhone | the flow and reading |
| Android | the flow and reading |

Each app's Wave 5 branch sits on its Wave 4 work.
