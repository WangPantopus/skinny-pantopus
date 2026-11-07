# The Christmas card on the table: design

This is the exact design. `sample/index.html` and `sample/share.html` are the source of truth for anything not spelled out here. Build each app to match the sample, using each platform's own tools. Sizes are shares of the card's width (`u` = 1% of it), so everything scales.

## 1. The art

All of it is in `sample/a/`. Ship these files in each app (about 1.2 MB in all).

| File | What | Size |
|---|---|---|
| `env-front.webp` | Address side of the envelope | 1200×1392 |
| `env-pocket.webp` | Flap side, the folded panels with a V opening | 1200×1392 |
| `env-inside.webp` | Inside the envelope: lining, darker deeper in | 1200×1392 |
| `env-flap-out.webp` | Closed flap, outside | 1200×512 |
| `env-flap-in.webp` | Open flap, lining side, tip up | 1200×512 |
| `env-flap-gold.webp` | Mask of the gold in the flap's lining, for the glint | 600×256 |
| `env-pocket-shadow.webp`, `env-flap-shadow.webp` | Soft shadows, quarter size, stretched | 300×348 |
| `wax-gold.webp`, `wax-gold-cracked.webp` | The seal whole and broken, shadow baked in | 540×546 |
| `stamp-peak.webp`, `stamp-fir.webp`, `stamp-river.webp` | Perforated stamps | 242×300 |
| `postmark.webp` | Inked postmark, reads PANTOPUS POST / CHRISTMAS / NOV 6 2026 | 622×365 |
| `paper.webp` | Seamless paper grain, for multiply | 512 |
| `grain.png` | Seamless film grain | 256 |
| `light.webp` | Window light | 720×1280 |

Details:

- **Postmark date:** the art bakes in NOV 6 2026. The apps must print the real mailed day. Keep the ring and wavy lines as art and draw the day over them, or re-render with `postmark.html`.
- **iOS:** asset catalogs can't hold WebP. Bundle these as loose resources and load with `UIImage(contentsOfFile:)`, which reads WebP on iOS 17. Decode away from the main thread before the screen shows.
- **Android:** `res/drawable-nodpi` takes WebP.
- **Web:** serve from `public/holiday-cards/table/`.
- **Tables:** `sample/a/table-*.jpg` are baked for the sample. In the apps, tint one shared grey cloth image with the picture's colour from `designs-table.json`. Make the grey image with the `weave()` and pool-of-light code in `pictures.py`.

## 2. Layout

The card is 100u wide and 120u tall (5:6):

- Cream border 1.7u on the top and sides.
- Picture 96.6u × 103u at (1.7u, 1.7u).
- Caption in Nothing You Could Do at (4.2u, 107.4u), size `min(4.8, 70 / (letters × 0.53))` u, colour `#1d2b63`.
- "CHRISTMAS, 2026" in serif at (4.2u, 114.2u), size 2.2u, spacing .42em, colour `#2b2622`.
- Red postmark at (77.5u, 106.2u), 20u × 12u, turned −3°.
- Over the whole face: paper grain (multiply; 50% over the front), edges `inset 0 0 2.6u rgba(110,80,30,.2)`, corner radius .7u.

The back:

- Rules from 9u to 92.6u, pitch 7.6u, inset 8u, colour `rgba(74,84,118,.2)`.
- Note in La Belle Aurore, 6u on a 7.6u line, ink `#1b2a5c`, multiply. Each word gets a small seeded shift (±.17em) and turn (±.75°), so the writing isn't machine-straight. Seed from the card, so it looks the same every time.
- "FROM" in serif at 97u, size 2.3u, with the sender's first name beside it in the pen, 6.4u.
- "PANTOPUS POST · CHRISTMAS 2026" centred near the bottom, 1.9u.

Fit it to the screen (`layout()` in the sample):

- `cardWidth` = screen width − 18 pt (capped at 470 pt).
- Below the card, leave room for the controls. Above it, the flap peeks out by `peek`, between 13% and 47% of the card's width. If the screen is too short for 13%, the card shrinks.
- Envelope width = 1.012 × card, height = 1392/1200 of that, flap depth = 512/1200 of that.
- Laid down, the envelope's top sits at `cardTop − peek + flapDepth`, turned +1.5°, with the card turned −1.05°.
- Shut, the envelope sits a little above the middle of the free space, at least 88 pt below the safe area, turned −1.1°.
- When the flap opens on a short screen, the envelope slides down enough to keep the flap's tip on screen.

The sample's row of thumbnails and links exists only in the sample. The real app gets that room back.

## 3. The moment, step by step

Nothing from the app shows: no tab row, top bar or shelf. Only the table, the mail, and these controls: ✕ top left (back to the Mailbox), and top right Share and ⋯ (the ⋯ holds Who sent it and its trail, File in the Vault, Shred, Open it again, Report, Block). Tapping the table hides or shows the controls.

| Step | On the table | Words at the top | Button | Hint | Also |
|---|---|---|---|---|---|
| Address side | Envelope, address up, falling onto the table as it arrives | A Christmas card from {first name}. | Turn it over | or swipe it, the way you'd turn it in your hand | Swipe or tap turns it |
| Flap side | Envelope with wax seal | none | Open it | or pull the flap up with your finger | Pull up; swipe back |
| Flap open | Flap up, lining showing, top of the card in the V | none | Take the card out | or pull it out with your finger | Pull up; tap |
| Coming out | Card rising, envelope sinking | none | none | none | Finger-driven |
| On the table | Card in front, envelope behind, flap above | none | Turn it over / Turn it back | or swipe it, until they've turned it once | Swipe or tap turns it |

- **First time vs later:** only the first open plays this. Opened before, it starts "On the table". Keep today's rule for what counts as first open (`cardFirstOpen` on iOS, `card.firstOpen` on Android, `just_opened` on web).
- **After the first open:** "Open it again" in the ⋯ menu replays it, without touching anything on the server.

### Moves

One pull does it all: `pull` runs 0 to 1, finger travel / (screen height × .36).

- 0 to .3: the flap turns over 0–180° about its top edge, with perspective 2.4 × envelope width. Show the outside until 90°, then the lining side. Darken by `1 − .3 sin θ` outside and `1 − .45 sin θ` lining. The flap's shadow fades with `cos^1.4 θ`.
- At .03: the seal swaps to cracked, turns 2.5°, and you feel a tap.
- .3 to 1: the card rises from `envelopeTop + 2%` to the out position, scale .94 to 1.03. The envelope sinks to `min(screenHeight − .5 × envelopeHeight, .96 × cardWidth + 8)`. Layer order while inside, bottom to top: inside, flap lining, card, pocket shadow, pocket, flap outside.
- At 1: the card is clear of the pocket, so it moves on top without any visible jump, then is laid down: `lay` 0 to 1 to the final pose, with a tap as it lands.
- On release: aim = pull + flick (velocity × .22). Past .54 it goes all the way. Between .14 and .54 it rests with the flap open. Below .14 it closes. Horizontal drags on the flap side turn the envelope back.
- Tap on the flap side runs it for you: flap open, wait about .68 s, card out.

Turning, for the envelope and the card: the angle follows the finger (drag / (width × .8 or .86) × 180°). On release it goes to the nearest multiple of 180°, with a flick adding velocity × .22, in whichever direction the finger went. A dragged-left turn lifts the right edge toward you. The shadow narrows with `|cos θ|`, and a dark overlay of `.34 × |sin θ|` shades the face.

Springs (stiffness, damping): envelope turn 95, 15. Pull 70, 16. Lay 62, 12.5. Card turn 88, 13.5. Light 40, 11. Arrival 58, 11.5.

### Light

- **Window light:** `light.webp` over everything, soft-light at 88%, shifted ±22 pt with tilt. It's the main sign that the light is real, so it must cross the envelope and the card together.
- **Sheen:** a soft bright band on the card's face (soft-light) that slides with tilt and the turn.
- **Gold glint:** a band over the flap's gold, masked by `env-flap-gold.webp`, screen blend, slides with tilt.
- **Tilt:** the card turns ±3.2° and ±2.6°, moves 5 pt; the envelope moves 2.5 pt; the table moves −7 pt; the shadows move the other way.
- **Other touches:** a vignette, `radial-gradient(120% 88% at 46% 40%, transparent 44%, rgba(6,3,4,.46))`, and fine film grain at 36% (overlay).
- **Real tilt in the apps:** iOS uses CoreMotion device motion. Android uses the game rotation vector sensor. Map left-right tilt / 22° and front-back (from about 45° held) / 22° to −1.1…1.1, smooth with the light's spring, and run the sensor only while this screen is showing. No permission prompt is needed on either.
- **Without a sensor (web):** the mouse moves the light on a computer. On phone web, press and hold then move, and let it drift slowly by itself (`sin(t/2.9 s) × .62`, `sin(t/4.1 s + 1) × .5`). Android Chrome can use `deviceorientation`. Don't ask iOS Safari for motion permission.
- **Low Power Mode or Reduce Motion:** no sensor and no drift.

### Touch and sound

Taps you can feel at: envelope turned over, seal breaking (firmer), card landing, card turned, sealed flap refusing. iOS: impact feedback. Android: `HapticFeedbackConstants`. Web: `navigator.vibrate` where it exists. No sound in this build.

## 4. Sealed cards

- Address side: a stamped "DO NOT OPEN UNTIL CHRISTMAS" in gold ink, turned −7°, in place of the "CHRISTMAS CARD" label. Words: {first name} sealed this card.
- Flap side: words: It opens Christmas morning, in {n} days. Button: Try to open it. Hint: or pull the flap up.
- The flap lifts only a few degrees (pull × .12, at most .04) and springs back. Tap you can feel, and: Not yet. {n} days until Christmas morning.
- Share is available and shares the sealed picture.
- From 7 a.m. on Christmas morning where they live, it opens like any card. Never read the note while it's sealed, the same as today.

## 5. iPhone Duo

The card is a folded card. Read the pose from the fold (`reservedRegions(kind: .division, options: .includeInactive)`, see `BookletReaderLayout.swift`, `MailSideBySide.swift`, and the Duo notes in memory).

| Pose | Screen | What shows |
|---|---|---|
| Closed | 466×678, side strip from x 382 | As on an iPhone, in the 382 pt to the left of the strip |
| Open sideways, flat | 951×669, hinge at x 475.5 | Picture page and note page meeting at the hinge, each 391×469, top 100, from x 84.5 to 866.5; flap tip above the middle; shaded crease |
| Book (half closed) | Same | Same, with stronger crease shading |
| Upright, flat | 669×951, hinge across the middle | Picture on the top half, note on the bottom half, about 366 wide, each near the hinge |
| Tabletop (half closed, upright) | Same | Same: picture stands up, note lies flat |

- The card covers both columns even when Mail is side by side, then ✕ returns to that layout.
- On first open, the envelope and pulling work as on a phone, centred. When the card comes out, it opens across the hinge.
- Closing the phone goes to the closed layout with the picture side up. Opening it opens the card. Nothing may reset: keep the state above the layout switch, because folds rebuild views.
- Keep clear of the system strip's corner (x 867–951, y 0–124 open sideways; x 525–669, y 0–82 upright).
- Crease shading, left page: `linear-gradient(to left, rgba(0,0,0,.42), rgba(0,0,0,.08) 16%, transparent 46%)`; right page: mirrored, a little lighter. Opacity is .25 flat, up to 1 half closed.

Other big screens get no fold logic: tablets and wide windows cap the card (about 560 wide) on a big table.

## 6. Sharing

Share opens a sheet over the table: a picture preview, then the size, the switch, and the actions. See [reference/share-pictures.jpg](reference/share-pictures.jpg).

- **Title:** Share this card. Sealed: Share the sealed card.
- **Sizes:** Story, Post, Link preview.
- **Switch (not for Link preview or sealed):** Show the note. Off: {first name}'s words and name stay private. Your address never shows. On: This picture shows {first name}'s words and first name. Only share them if {first name} wouldn't mind.
- **On a card you sent:** the same sheet, with the words talking about your own note.

The pictures: lay out as in `share.html`, whose numbers are in a 540-wide space (2× gives 1080).

| Picture | Size | Layout |
|---|---|---|
| Story, card | 1080×1920 | Open envelope behind, card in front, turned −3°, paper slip under it |
| Story, note | 1080×1920 | Picture card top left, note card overlapping bottom right, envelope behind, slip bottom left |
| Story, sealed | 1080×1920 | Shut envelope, large seal, stamped "DO NOT OPEN UNTIL CHRISTMAS", slip |
| Post | 1080×1350 | The same three, tighter; note version side by side |
| Link preview | 1200×630 | Card and envelope left; caption by hand, PANTOPUS POST and one line right |

- **Paper slip:** "PANTOPUS POST" / "Send one at pantopus.com/cards". It's how people find us, so it's in every picture. Keep it inside Instagram's safe area: nothing important in the top 250 or bottom 340 pixels of a Story, except the slip as high as it fits.
- **Draw on the device,** as `SkyShareCard` does on iOS and Android: nothing private leaves the phone. iOS: `ImageRenderer` (it can't draw `UIViewRepresentable`, so the shared note must use SwiftUI `Text`, not `HolidayCardNoteText`). Android: `Canvas` into a bitmap, as `SkyShareCard.kt`. Web: `<canvas>`.
- **Link preview:** rendered once per picture, kept on the website, because Facebook reads it from the page.

Actions:

| Action | iPhone | Android | Web |
|---|---|---|---|
| Instagram | With a Meta app ID, Instagram installed and Story: straight to a new Story, copying the card's link. Otherwise the share sheet with the picture | The picture sent straight to Instagram when installed; otherwise the chooser | Phone: share sheet with the picture. Computer: Save, then says to post it from there |
| Facebook | Link preview: opens `facebook.com/sharer/sharer.php?u=<card page>`. Story or Post: share sheet | Same, or straight to Facebook | Link preview: same sharer link. Otherwise as Instagram |
| Email | Mail composer: picture attached, subject and link filled in (`SystemSheets.swift`) | Mail apps, with picture, subject and text | Phone: share sheet. Computer: `mailto:` with the link, plus Save |
| Copy link | Copies the card page link. Link copied | Same | Same |
| Save | Saves to Photos | Saves to the gallery | Downloads |
| More | Share sheet | Chooser | Phone: share sheet |

- **Email words:** subject "Look what came in the mail". Body "I got this Christmas card on Pantopus. You can send one too: {link}".
- **Card page link:** `{web}/cards/{slug}?ref={invite code}`.
- Hide any action the device can't do. If the picture can't be drawn, say so and offer Copy link.

## 7. Sending by link

Words, in the existing paper style:

- **Who it's for:** a third choice under name and email. "Send it by link." "Text it, or paste it anywhere. The first person to open it keeps the card."
- **Seal it for the day:** the same two choices as email (right away, or sealed until Christmas).
- **Look it over:** the page the link opens, and the card once they join.
- **The last button:** Seal it and get the link.
- **Afterwards:** "Your card is ready." The link, Copy link, and Share (the phone's share sheet, with "A Christmas card for you from {first name}: {link}").
- **Sent:** To whoever opens your link. Waiting for someone to open your link. Copy link again. Take it back. Then {name} opened your link and has your card, or Nobody opened your link in 90 days.

The page the link opens (`/open/{id}?token=…`, also used for cards by email, behind the key):

- The table in the default slate colour, the shut envelope with wax seal, no picture and no note.
- A Christmas card for you. From {name}.
- Open your card. You'll need a free Pantopus account to open it and keep it. Sign in, or Create a free account.
- By email, keep today's rule and words about using the address it was sent to. By link, any account works.
- Already taken: Someone already opened this card. A card goes to one person.
- Its preview on Facebook and in messages is a fixed sealed-envelope picture, with the title "A Christmas card for you". It never shows the card. Keep it un-indexed, with no referrer.

## 8. Other places

- **Mailbox row:** same size and layout as today. It gets the real red paper, the stamp and postmark art, and the wax seal when sealed. The opened row's picture peek stays.
- **Look it over:** everything stays. Under the card, "Open it again" becomes "Open it the way they will", which plays the real moment full screen as the other person would, with the real table. Closing returns to Look it over. Nothing is marked as read.
- **Sent, a card's page:** the card shows as today with the new face. Add "See it the way they did", the same full-screen moment. Share is available here.
- **Pick a card and Write on the back:** the card face uses the new layout and pen, so what you write is what arrives. Grid thumbnails stay.
- **The card email:** add the sealed-envelope picture at the top in place of the ✉️. It still never shows the card.
- **Public card pages** (new, web only):
  - `/cards`: all collections and pictures on the table colour.
  - `/cards/{slug}`: that card on its table, caption, "A Christmas card you can send on Pantopus", the button "Send this card to someone", "It arrives with their morning mail, and they open it like real mail.", and "See all the cards".
  - The button goes to the sending flow with that picture chosen, through sign-up if needed, carrying `ref` as `invite_code`.
  - Indexable, with the Link preview as its picture. Never a person's name or note.

## 9. Accessibility

- Every gesture has a button, and every button keeps working with VoiceOver, TalkBack and a keyboard. On web: Escape closes, arrow keys turn.
- The screen reader reads the card as one sentence: "Card from {name}: {caption}. On the back: {note}", as today. The envelope reads "Christmas card from {name}", with "sealed until Christmas morning" when sealed.
- Reduce Motion: no drop, drift, tilt or turning. Sides swap, and the card simply appears on the table. Buttons do all of it.
- Words and buttons around the card follow large text. The card itself keeps its fixed type, like today's drawn mail, because its text is read out as above. Check them at the largest sizes on all apps (memory notes `web-large-text-checks`, `compose-fixed-size-text-font-scale`).
- The note in any language: Latin letters in the pen; other scripts fall back to the system font and must still fit the rules.
- Colour contrast of the words on all four table colours, at the vignette's darkest.
- The table is always dark, in light mode and dark mode, like a photo viewer.

## 10. What not to do

- Don't stretch a picture to the screen, or draw art by hand: the art files are final.
- Don't show the picture or note on the link page or in any email.
- Don't tell a sender whether a card was opened, beyond the existing "has your card".
- Don't add sound, video, paid extras or photo and voice notes in this build.
