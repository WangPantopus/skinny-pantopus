# Mail and Christmas cards: design improvement plan

November 9, 2026. Written after a review of the real apps (iPhone 17, iPhone Duo in every pose, Android Pixel 8) built from master `1ee7c174ab` with `mailbox`, `mail_extras`, `holiday_cards` and `card_table` on. This is a plan and a design. No app code has been changed. The founder approves each part before it is built.

The approved look in [christmas-card-table/design.md](christmas-card-table/design.md) stays the base. Everything here builds on it and reuses its art, layout units (`u` = 1% of the card's width), springs and light.

## The goal, in the founder's words

- The best app there is. People should feel they are holding a real card.
- The nostalgia of old-day Christmas, or the birth of Jesus Christ, depending on the card they chose.
- Use what today's phones can do: the screen, tilt, touch, the fold.
- The card should be as large as the screen allows, and everything on it must read clearly.

## Five rules every change follows

1. **Paper first.** Anything a person touches in Mail is an object (envelope, card, stamp, seal) on a surface with real light. Plain form screens only where typing is needed.
2. **Both sides get a moment.** Sending is as physical as receiving.
3. **The card is the hero.** As big as the screen allows, and it can be enlarged.
4. **The mood follows the card.** Nostalgia, reverence and Santa do not feel the same.
5. **The next kind act is one tap away.** Send one back, or share.

## What the review found

Strong: the card on its table on iPhone and Android, sealed cards, the share sheet, and the open Duo's two-page folded card.

Weak, most important first:

1. Sending has no moment. "Seal and send" jumps to a plain "On its way" page.
2. There is no "send one back" after reading a card.
3. Opened cards in the Mailbox fade to pink on iPhone and never show their picture. Unopened cards are a wall of identical red envelopes.
4. In "Pick a card" the main button is at the end of the scrolling grid, under the tab bar or cut off. Pictures are three across and small.
5. The tab bar stays on screen through the send flow and the welcome letter moment on iPhone.
6. The card's back looks grey-beige outside the table.
7. The welcome letter's envelope is a flat drawing; Android's is plainer still. The letter page shows about five lines of the letter.
8. Small things: buttons touching paper on the Duo, upright Duo pages not meeting at the hinge, the sealed label on Android only, "John 3 16" in the pen, dark postmark on dark red.

---

## Part 1. Fixes that need no new design

These are small, safe, and worth shipping first. All three apps unless noted.

| # | Change | Where |
|---|---|---|
| 1.1 | **Pick a card: pin the main button.** "Write on this card" sits in a bar fixed above the bottom edge, with the chosen picture's thumbnail and caption beside it. It is greyed until a picture is chosen. "See it larger" moves into the same bar. | iOS `HolidayCardSteps.swift` (grid at ~315–367). Android `SendCardSteps.kt`. Web `SendCardFlow.tsx`. |
| 1.2 | **Pictures two across,** not three (about 177 pt wide on an iPhone 17 instead of 115). Captions get two full lines, so none is cut with "…". | Same files. |
| 1.3 | **No tab bar in the send flow** (all five steps, the confirmation) **or in the welcome letter moment.** The founder agreed to this on November 9. Use the mechanism other full-screen flows already use. | iOS: the way `ComposeBroadcastView` and `LeaveHomeView` hide it. Android: the same in `SendCardScreen.kt` and the porch. Phone web: the bottom bar. |
| 1.4 | **Opened cards are not faded.** iPhone matches Android: full red. (Part 4 then changes what an opened card shows.) | iOS `HolidayCardEnvelope.swift` (`mailPaper(... torn: model.isOpened)`), and the opened style in `MailPiece`. |
| 1.5 | **Sealed row says "DO NOT OPEN UNTIL CHRISTMAS"** on iPhone too, as Android does. | iOS `HolidayCardEnvelope.swift`. |
| 1.6 | **Postmark on Mailbox rows in cream ink at 60%,** so it reads on the dark red. The table keeps its black ink. | iOS `HolidayCardEnvelope.swift`, Android `HolidayCardRow.kt` / `CardRowPaper.kt`, web `CardPaper.tsx`. |
| 1.7 | **Buttons never touch paper.** The controls start at least 12 pt below the lowest paper edge; if the screen is too short, the card shrinks. Seen on the closed Duo, the open Duo and Android's Pick a card. | iOS `CardTableLayout.swift` (`cardWidth`, `peek`). Android `CardTableScene.kt`. |
| 1.8 | **Hints read clearly.** The grey hint lines under the buttons go to white at 70%. | Table controls on each app. |
| 1.9 | **The card's back is bright cream everywhere.** Outside the table the paper grain is too heavy: halve it (multiply 50% → 25%) in Write on the back, Look it over and Sent. | iOS `CardTablePaper.swift` / `HolidayCardView.swift`. Android `CardFacePainter.kt`. Web `CardPaper.tsx`. |
| 1.10 | **The card is full width in Look it over and Sent** (screen width − 32 pt) instead of capped at 300 pt. | iOS `HolidayCardLookStep.swift`, Sent page. Android `SendCardLook.kt`. Web. |
| 1.11 | **Share pictures show a bigger card.** Story: card 800 px wide of 1080 (today about 600). Post: 760 px. Everything stays inside Instagram's safe area (nothing in the top 250 or bottom 340 px but the slip). | iOS `CardTableShareScene.swift`. Android `CardSharePictures.kt`. Web `sharePicture.ts`. |
| 1.12 | **Verse references are set in type, not the pen.** For the Christmas with Jesus Christ collection the caption ("John 3:16 (KJV)") prints in the card's serif, italic, same position and size rule. The colon then reads. Stored captions do not change. | Card face on each app. |
| 1.13 | **Android letter page:** the paperclip on "Pantopus read this for you" draws as a rounded box. Draw the clip as iPhone does. | Android letter detail. |

Done when: each row is seen in the real apps on an iPhone, the closed and open Duo, and Android, with a 9-picture and a 17-picture collection, and after a relaunch.

---

## Part 2. Seal it by hand: the sending moment

**What the sender sees today:** "Seal and send", then a status page.

**What they will see:** after Look it over, the screen becomes the table, on the cloth of the card they chose. Their card lies there with the open envelope behind it, exactly as the other person will find it.

| Step | On the table | Words at the top | Button | By hand |
|---|---|---|---|---|
| 1. Ready | Card note-side up, open envelope behind, flap up | For {first name}. | Put it in the envelope | Push the card up into the envelope |
| 2. In | Card inside, top edge showing in the V | none | Close the flap | Pull the flap down |
| 3. Seal | Flap shut. A soft ring glows where the seal goes | Press and hold to seal it. | Seal it (does the hold for them) | Press and hold for 0.6 s |
| 4. Addressed | The envelope turns over by itself. {Name} is written across it in the pen, the stamp lands, the postmark thumps over it | none | none | none |
| 5. Gone | The envelope slides up and off the table | On its way to {first name}. | Done · Take it back · Share this card | none |

Details:

- **Reuse, don't rebuild.** This is the receiving moment run backwards. `pull` runs 1 → 0.3 (card in), then 0.3 → 0 (flap shut). Same art, layers, springs and light. New: a `sending` mode on the table's model.
- **The seal is the send.** While the finger holds, a round shadow (the stamp head) grows over the spot and the phone gives soft ticks that get closer together. At 0.6 s the shadow lifts, the gold seal is there, and there is one firm tap. The send request goes at that instant, with the draft's existing request ID. Letting go early does nothing.
- **If the server refuses,** the seal "doesn't take": it lifts off, the flap stays shut, and the existing message shows (no stamps → the stamp books sheet, one card a day, blocked, and so on). Check what can be checked before the moment starts (the Look it over preview call already answers most of it), so a refusal at the seal is rare.
- **Step 4 writes the name.** The name is revealed left to right in 0.7 s, as if written. The stamp drops with a tap you can feel, then the postmark with a second, firmer one. Sealed until Christmas: the gold "DO NOT OPEN UNTIL CHRISTMAS" stamp lands last.
- **Step 5 keeps today's words and rules.** "{Name} gets it with their 7 a.m. mail on {day}." Take it back until the carrier's pickup. By link: "Your card is ready", the link, Copy link, Share. By email: "We emailed them."
- **To several people** (stamp books on): the moment plays once. In step 4 the top envelope shows the first name and a stack of envelope edges shows behind it. Step 5 says "{n} cards on their way."
- **Length.** About six seconds if every button is tapped straight away. Nothing plays by itself except step 4.
- **Reduce Motion:** the steps swap with fades and one button, "Seal and send", does all of it. VoiceOver and TalkBack: each step is a button with the words above.
- **The Mailbox's "Your flag is up"** stays as it is; it is the right ending when they go back.

Files. iOS: `Table/CardTableModel.swift`, `CardTableStage.swift`, `CardTableScreen.swift`, `CardTableMotion.swift`, `HolidayCardLookStep.swift`, `HolidayCardSealViews.swift` (today's "On its way"), `HolidayCardFlowViewModel.swift`. Android: `table/CardTable.kt`, `CardTableScene.kt`, `SendCardLook.kt`, `SendCardSteps.kt`, `SendCardViewModel.kt`. Web: `CardTable.tsx`, `cardTableEngine.ts`, `SendCardFlow.tsx`. No server change.

Done when: a card is sealed by hand and by buttons on each app; a refusal at the seal sends nothing; a double press sends one card; the other person receives it; the Duo plays it closed and open; a relaunch mid-moment before the seal sends nothing.

---

## Part 3. Send one back

- On the table, once the reader has turned the card over, a second, quiet button appears under "Turn it back": **Send {first name} a card**. It is also in the ⋯ menu.
- It opens the send flow at Pick a card with that person already chosen.
- It counts as today's card, or uses a stamp, like any card. It is hidden when sending is closed for the season, when either person has blocked the other, and when the sender's account is gone. Not shown on a sealed card until it opens.
- This is a new card to them. The **reply that arrives joined to the original card**, approved on November 2 in the [card memories plan](christmas-card-memories-plan-2026-11-02.md), is a different piece and stays in that plan.

Files: table controls and ⋯ menu on each app (`CardTableControls.swift`, `CardTableModel+Actions.swift`; `CardTableControls.kt`; `CardTable.tsx`), and each send flow's entry point (it already accepts a chosen design from the public page; add a chosen person). No server change.

---

## Part 4. The Mailbox list

- **An opened card shows its picture.** The row keeps its height and its red paper. On the left, the whole card (5:6, about 150 pt tall, turned −3°, soft shadow) leans out over the top edge of the envelope by 14 pt. To the right, in cream: "From {first name}" in the pen, the caption in serif italic, then "{day} · Opened". The torn top edge goes; the card has simply been taken out.
- **Unopened cards stay shut red envelopes.** The anticipation is right. With Part 1's cream postmark and the three stamps they already differ a little; no more is needed.
- **Sealed cards** keep the wax seal and label.
- **Sent** uses the same opened-row drawing for cards the other person has, so a sender sees their picture in the list too.

Files: iOS `HolidayCardEnvelope.swift`, `HolidayCardListViews.swift`. Android `HolidayCardRow.kt`, `CardRowPaper.kt`. Web `SendCardRow.tsx` and the Mailbox row for cards.

---

## Part 5. Choosing a card feels like standing at the card rack

- **Tapping a picture opens it large,** on its own cloth, with the table's light: the card at full table size, caption in the pen, collection name above. Swipe left or right to the next card in the collection; the cloth colour changes with each card.
- The bar from 1.1 is on this screen too: **Write on this card**. ✕ returns to the grid with the last card seen ticked.
- So every card gets seen at full size before it is chosen, which is the best argument for sending one.
- Verse cards show the whole verse below the card in readable type (see 6.2).

Files: iOS `HolidayCardSteps.swift` and a small reuse of `CardTableFaces.swift` + cloth from `CardTableArt.swift`. Android `SendCardSteps.kt`, `HolidayCardFaces.kt`, `table/CardTableArt.kt`. Web `SendCardFlow.tsx`, `HolidayCardView.tsx`.

---

## Part 6. Bigger, and readable

- **6.1 Enlarge the card.** On the table, pinch or double-tap the card to enlarge it up to 3×, and drag to move around it. Double-tap again returns it. The light keeps moving. This is how small details and the printed verse get read.
- **6.2 Read the verse.** For Christmas with Jesus Christ cards, the hint under the button becomes a link, **Read the verse**. It slides up a cream bookmark with a red ribbon: the whole verse in the serif at 19 pt, the reference under it. Screen readers read the verse. The server adds the verse's words to each of those nine designs (`verse` on the design; the text is in the NATIVITY kit's `nativity.json`), so nothing is typed twice. Server and web first; apps read it when present.
- **6.3 Tablets and wide windows:** the card's cap goes from 560 to 640 pt where the height allows.
- **6.4 iPhone Duo, upright and flat:** one large card, about 600 pt wide, turned over by swiping, as on a phone but bigger. Today's two stacked pages use only 55% of the width.
- **6.5 iPhone Duo, tabletop** (half closed, upright): keeps two pages, the picture standing and the note lying flat. The pages meet at the hinge with no gap and the crease is shaded, so it reads as one folded card.
- **6.6 iPhone Duo, sideways and book:** unchanged. It is the best screen in the feature.

Files: iOS `CardTableLayout.swift`, `CardTablePose.swift`, `CardTableDrag.swift`, `CardTableStage.swift`. Android `CardTableScene.kt`, `CardTableWindow.kt`. Web `cardTableEngine.ts`. Server: the `DESIGNS` list in the holiday cards module, plus the public page.

---

## Part 7. The mood follows the card

Each collection gets one of three moods. The apps map collection to mood themselves (default: nostalgia), so no server change is needed; the server may send `mood` later for new collections.

| Mood | Collections | What changes on the table |
|---|---|---|
| **Nostalgia** | As a Kid, With Friends, Love Stories, In Your Twenties, Memories, Grandma's House | Snow is falling outside the window: soft specks of shadow drift down through the patch of window light only (12–18 at a time, 6–9 s each, 10% dark). Nothing else moves. |
| **Reverence** | Christmas with Jesus Christ | No snow. Candlelight: a warm glow from the lower left that breathes very slowly (3–4 s, 85–100%). One slow glint crosses the gold lining when the flap opens. A star stamp in place of the fir, peak or river. The caption in type (1.12). |
| **Santa** | Christmas with Santa | The same snow. The envelope lands with a little more bounce. |

- Off with Reduce Motion or Low Power Mode, like the tilt light.
- New art needed: one star stamp (`stamp-star.webp`, 242×300), made with the same script as the other three stamps. Old app versions keep showing the fir.
- The effects are drawn in code (particles and a gradient), not new pictures.

Files: iOS `CardTableStageParts.swift`, `CardTableTicker.swift`, `CardTableSmallArt.swift`. Android `CardTableScene.kt`, `CardTableArt.kt`. Web `CardTable.tsx`, `cardArt.ts`.

---

## Part 8. Use the phone

- **8.1 Feel the paper.** While a card is pulled out or pushed in, a light tick every 8% of the pull. iOS: Core Haptics. Android: `HapticFeedbackConstants` ticks.
- **8.2 Sign it yourself.** On Write on the back, beside FROM, the sender can sign their name with a finger. It is stored as a few pen strokes with the card (at most about 2 KB, in the card's existing data, no new table) and drawn in the same ink. If they don't, their first name is set in the pen as today. Old app versions show the typed name. It is the cheapest way to make a card unmistakably theirs.
- **8.3 Quiet sounds.** Three paper sounds: the card sliding, the seal breaking or pressing, the card set down. Low, only when the phone's ringer is on, with a switch in Mail's settings. The approved design said no sound in the first build; this adds it.
- **8.4 Later ideas, not planned yet:** a Home Screen or Lock Screen card saying a card is waiting; the Christmas-morning notice opening straight onto the table.

---

## Part 9. From Write on the back onward, you are at the table

Today the send flow is beige form pages. With Parts 2 and 5 in place, the middle of the flow is the last flat part.

- **Who it's for** and **Pick a card** stay as paper pages.
- **Write on the back, Seal it for the day** and **Look it over** move onto the chosen card's cloth, with the table's light: the card's back bright under the lamp, the keyboard below. "When should it arrive?" is a cream slip with the same three choices.
- The steps, their order and their words do not change.

This is the largest restyle in the plan and comes last.

---

## Part 10. Letters

- **The welcome letter arrives on the table too.** The flat drawn envelope is replaced by a cream envelope made the same way as the red one, with a red wax seal, on a slate cloth. It opens with the same hands-on moves; the letter comes out as a folded sheet and becomes today's letter page. Android gets the same moment, which fixes its plainer version.
- New art needed: the envelope set in cream (front, pocket, inside, flap out, flap in) and a red seal, from the existing art scripts in the kit's `streams/CARDTABLE`. About 1 MB.
- **The letter page gives the letter the screen.** "Pantopus read this for you" shows two lines with "More". The three actions (Put on the counter, File in the Vault, Shred) move to the end of the letter instead of being pinned over it; they stay in the ⋯ menu as well.

---

## Should people attach their own pictures, voice, links, documents and video?

**You already decided part of this on November 2:** one personal photo and one voice greeting of up to 60 seconds inside a Christmas card, and one reply per card. The storage (private S3, like chat files), "Report this card", and covering a photo from someone you aren't connected to until you tap it were also decided. The first step (safe re-sends) is live. The drawings were the next step and have not been made.

My view of each kind:

| Kind | For | Against | Recommendation |
|---|---|---|---|
| **One photo** | The family photo card is the most-sent kind of Christmas card in America. It is the strongest reason to send through Pantopus instead of a text. It fits paper: a printed snapshot tucked in the envelope. | Needs the report path and the cover for strangers' photos (both already decided). Storage is small: about 300 KB each. | **Yes, as approved.** Build it right after Parts 1–6. |
| **Voice greeting** | A grandparent's voice is the most personal thing a card can carry. Recorded in the app, so no copyrighted music gets uploaded. About 240 KB a minute. | Real phones were never tested; a recorder is new on all three apps. | **Yes, after the photo.** |
| **Links** | Easy to build. | A card can go to a stranger by link or email, so a tappable link is a ready-made scam and spam tool. It also breaks the paper feeling. | **No.** A web address typed in a note stays plain text. |
| **Documents** | Useful for real letters (a form, a receipt). | Nobody encloses a PDF in a Christmas card. Files can carry malware. | **Not in cards.** Consider later for letters between people who are connected. |
| **Video** | High emotion. | The heaviest to store, send and check: roughly 5–10 MB for 15 seconds, upload waits, conversion on the server, and the hardest content to moderate. The app is on small hosting plans. | **Not this season.** Revisit next year as one short clip. |
| **Music or audio files** | — | Copyright. | **No.** Voice recorded in the app only. |

How the two approved kinds should look, so they add to the paper feeling instead of turning the card into a chat message:

- **The photo is a print.** White border, slightly glossy, a small date in the corner in orange digits like a 1990s camera for the nostalgia collections, plain for the others. After the card comes out, the envelope shows there is something else inside; the reader pulls it out and it lies beside the card. On the open Duo it lies across the bottom of both pages.
- **The voice greeting is a small cassette tape** with a hand-written label ("For Nora") for the nostalgia collections, and a plain cream gift tag for Christmas with Jesus Christ. Press it to play; the reels turn.
- Sealed cards hide both until Christmas morning. Neither ever appears on a public page, in an email, or in a share picture.

---

## Order of work

Each line is one small set of pull requests (iPhone with the Duo, Android, server and web), checked in the real apps before merging. Nothing needs a database change.

1. **Part 1**, the quick fixes.
2. **Part 3**, send one back (small, and it is the growth loop).
3. **Part 2**, the sending moment.
4. **Part 5** and **Part 6**, the card rack, enlarging, the verse, the Duo upright.
5. **Part 4**, opened cards show their picture.
6. **Part 7**, the moods (needs the star stamp).
7. The **photo**, then the **voice greeting**, from the November 2 plan, drawn as above.
8. **Part 8** (ticks, signature, sounds), **Part 10** (letters), **Part 9** (the flow at the table).

Steps 1–5 change only the apps and the web, so they need one new store build of each app after they merge. The season runs from about Thanksgiving to December 20 and store review takes days, so steps 1–3 are the ones to get into the next build.

## Decisions for the founder

**All eight are approved.** On November 9 the founder said: "for D2-D8, I agree with all the default approaches, let's go with these." D1 was agreed earlier the same day. The defaults below are therefore the decisions.

| # | Decision | Decided |
|---|---|---|
| D1 | Hide the tab bar in the send flow and the welcome moment | Yes |
| D2 | Upright open Duo shows one large card instead of two stacked pages | Yes |
| D3 | Letter page: actions move to the end of the letter | Yes |
| D4 | New art: a star stamp and a cream envelope set, made by the existing scripts, one sample shown first | Yes |
| D5 | Sign your name with a finger | Yes, in step 8 |
| D6 | Quiet paper sounds | Yes, in step 8, on when the ringer is on |
| D7 | Send flow at the table from Write on the back onward | Yes, last |
| D8 | Attachments: photo, then voice, as approved; no links, documents, video or music this season | As written |

## For the builder

- How the build is run (coordinator, sessions, waves, rules) is in [mail-cards-build-kickoff-2026-11-09.md](mail-cards-build-kickoff-2026-11-09.md).
- Read [AGENTS.md](../../AGENTS.md), then [christmas-card-table/design.md](christmas-card-table/design.md) and its `sample/`. This plan changes that design only where it says so.
- Everything rides the existing `card_table` key. Do not add a key or a table.
- No unit tests. Verify each part in the real apps: web in a browser, iPhone in a simulator, the Duo closed, sideways, book, upright and tabletop, Android in an emulator, against a local backend, with a relaunch, and from the other person's side.
- Check the words and buttons at the largest text sizes, with VoiceOver and TalkBack, and with Reduce Motion.
- File names above were read on master `1ee7c174ab`. Confirm each before editing; line numbers move.
- A local rig with master builds, test people and cards exists in the launch kit at `streams/CARDLOOK` (apps, tools `ios.py`, `and.py`, `sheet.py`) on the stack described in `streams/CTBSRV/README.md`. It is stopped; restart it rather than making a new one.
- Screenshots from the review are in `streams/CARDLOOK/shots/` (`i*` iPhone, `d*` Duo, `a*` Android).

Not checked in the review, so check them while building: real phones (tilt light, taps you feel), largest text sizes, screen readers speaking aloud, the web app beyond the public card page.
