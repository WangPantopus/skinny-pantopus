# Wave 4, settled (contract section 5)

Coordinating session, 2026-11-28. The server's field spec is `server-wave4-draft.md` beside this file. **It is adopted
as written**, including its seven proposed changes, with the additions below. Everything is only while `improved` is
true; off, none of it exists (sections 0 and 1 of `CONTRACT.md` still govern: areas, no self-merge, real-app walks with
the switch on and off).

## Decisions on the draft

1. The front is the card's existing `photo` (one photo per card; no second photo inside the envelope). Adopted.
2. No Live Photo on a photo card (`CARD_FRONT_NO_LIVE`). Adopted.
3. Lists, the mantel and Sent rows draw the design's stock picture, not the photo, this round. Adopted; the photo
   shows wherever the piece itself is read (the table, Look it over, Sent detail, the guest table).
4. A sealed photo card can be told by its design id in lists. Accepted; no app words it ("a photo card") while sealed.
5. The stock picture: **the web session makes it** from the paper textures already in `frontend/apps/web/public`
   (cream cotton paper with an empty, softly shadowed mat where the photo goes; no clipart, no words), at every
   address and size the apps fetch for a design today, and sends the coordinating session a screenshot. The founder
   sees it before anything goes to production. The server's design entry takes its height from the finished file.
6. "Send this card again" from a photo card opens the studio empty. Adopted.
7. Cropped on the device, shape checked on the server. Adopted.
8. **The stock caption is "Merry Christmas"** (not "A photo card"): it is what a list row, the mantel and an older
   build print under the stock picture.

## 4.1 on the apps

- **No "Your daily briefings" notice and no guidance card over a card** while the web is on the path from
  `/open/[mailId]` (its own session flag, set only from a read that said `improved`), and on every app while a piece
  with `card.joined_for` is on screen. They wait for the next visit outside the card. Off: as today.
- **The welcome strip**, on the Mailbox root under the mantel, web, iPhone and Android, drawn only from `welcome` on
  `GET /api/mailbox/cards`:
  - title "{from_first_name}’s card is on your mantel";
  - body "Your cards stay here all season. You have {stamps} free stamps ready whenever you want to send one back."
    (without the number: "Your cards stay here all season. Send one back whenever you like." when `stamps` is null;
    say "stamp" for 1, and drop "free" when they hold bought ones too);
  - buttons "Write back to {from_first_name}" (wax red; only when `can_write_back`; opens that card's reply) and
    "Send a Christmas card" (cream border; opens the send flow at Pick a card);
  - a × that dismisses it on this device for this account; it also goes when `welcome` is absent on the next read;
  - cream paper `#fbf6ec`, border `#e3d8c3`, the app's existing large corner radius; the plan's 4.1 drawing.

## 4.2 on the apps

- **Entry**: one quiet cream-paper pill, "Make a photo card", with a small frame icon under the "Pick a card"
  heading, only when `photo_card` is in the read. The catalog and its order are untouched.
- **The studio** (one focused screen on the dark cloth, the plan's 4.2 drawing): the card front with the photo in its
  frame, pinch/drag to crop within the chosen shape, the shape taken from the photo's orientation with a one-tap
  change, "Change photo", STYLE with the three frames (`heirloom` default, `midnight`, `arch`), FRONT CAPTION
  (optional, counter to `caption_limit`), and "Use this photo card" (wax red), which goes on to the next step of the
  flow with the design, photo, frame and caption set. The crop is applied on the device before the upload through the
  existing photo upload.
- **The three frames**, drawn in code as the existing paper front is (no picture files):
  - Heirloom Cream: the `PaperFront` cotton paper `#f7f0e2`, the photo with a crisp border inset 1.67%, the caption by
    hand in ink `#1d2b63`, spaced serif "CHRISTMAS, 2026", the red postmark;
  - Midnight Velvet: stock `#1c2233`, a thin gold hairline frame `#d8b76f`, cream serif caption and year, a gold-ink
    postmark;
  - Winter Arch: alabaster mat `#f7f3ea`, the photo under a gently rounded top arch, a quiet serif caption below.
- **Reading one**: where the piece carries `front`, draw the photo in its frame as the card's front, veiled first when
  `photo.covered` ("Tap to view {first name}’s photo"), and don't show the photo again inside the envelope. Where a
  read has no `front` (lists, the mantel, Sent rows), the stock picture.
- A photo card offers no travel switch, no Share, no share video and no public page; "Send this card again" opens the
  studio empty. It can go to a list and can carry a voice greeting. It counts as a photo card for stamps and shows
  the same free and bought-stamp lines.

## Order of PRs for Wave 4

| Area | PR |
| :--- | :--- |
| server | `welcome`, `card.joined_for`, `photo_card` and the photo-card send and reads, one PR |
| web | 4.1 (notices held, the strip) and the stock picture files in one PR; 4.2 (pill, studio, frames, reading) in the next |
| iPhone | 4.1 in one PR; 4.2 in the next |
| Android | 4.1 in one PR; 4.2 in the next |

Each app's Wave 4 branch sits on its Wave 3 branch until that merges. Clients build against the draft's fields and
run the backend from the server's Wave 4 branch once the coordinating session sends its name.
