# Mail tab: design direction

October 27, 2026 · Status: approved by the founder on October 27. Nothing is drawn or built yet. Drawings wait for the founder's go, and a per-platform build plan follows them.

Related:

- [Launch-scope flags](../launch-scope-flags-2026-10-01.md): `mailbox` turns on receiving; `mail_extras` covers sending, stamps, certified mail, translations and Earn.
- Repo designs this builds on: the [A17 Mailbox](../designs/A17/Mailbox%20Mobile.html) ([`mailbox.jsx`](../designs/A17/mailbox.jsx)), the [A17.1 letter page](../designs/A17/mail-detail.jsx), the other A17 letter kinds and [A14.8 Vacation hold](../designs/A14/vacation-frames.jsx).
- The earlier React Native app (older Pantopus repository, `frontend/apps/mobile`): its Mailbox (`src/app/mailbox/`) and its write-and-send flow (`src/app/mailbox/compose.tsx`, `src/components/mailbox/compose/`).

## Decisions (founder, October 26–27)

1. Mail is its own tab next to Messages, never a segment inside it. That makes six tabs: Place · Today · Nearby · Plans · Mail · Messages, on phone web too.
2. Mail feels like real physical mail, not email. We keep A17's structure (drawers, Incoming / Counter / Vault, the parts of the letter page) but not its email-style cards.
3. No photographing paper mail: no scanning, OCR intake or scan buttons. The digital Mailbox exists to replace the paper one, so mail comes from digital senders.
4. Ordinary mail arrives once a day. Time-sensitive pieces arrive right away.
5. First senders, in this order: Pantopus itself, then bills from businesses that invoice through Pantopus, then paid local offers, then government and utilities.
6. Sending is designed now, together with receiving, and stays switched off when the Mail tab launches. Receiving ships first.
7. The earlier React Native app is the reference for sending, and partly for the Mailbox. Sending should feel like sending real paper mail or a package.

## 1. Tab bar

- Six tabs on iPhone, Android and phone web: Place · Today · Nearby · Plans · Mail · Messages. Plans still shows only while its switch is on. iPhone gets a custom tab bar, because SwiftUI's standard one shows five tabs and moves the rest under "More".
- Mail's badge counts unread mail, and Messages keeps counting chats. Mail's top screen keeps the ☰ side menu on iOS and Android.
- Today's three different "Mail inside Messages" setups go away: the iOS Mailbox | Messages segments, the Android Messages row that opens a "Chat" screen, and the web's old list page. The web gets one Mailbox instead of two, reachable on phones.

## 2. The look: paper, not email

- Every piece is drawn as the thing it is: a window envelope for a bill, a plain envelope for a letter, a picture postcard, a booklet, or a kraft-paper parcel with a shipping label.
- Every piece has a stamp, a postmark with the town and date, and a return address. Verified government, utility and business mail carries an official printed mark. Mail from an unknown sender looks plain and says "Unverified sender" in red.
- Letters use a handwriting-like serif on cream paper. Postmarks and tracking numbers use a typewriter face. Buttons stay in the app's normal type.
- No email habits: no bold unread rows, coloured stripes or rows of chips.

## 3. The Mailbox and the daily delivery

- The top shows your mailbox with your verified address. Before the delivery it says "Your mail comes this morning"; after it, "Today's mail came at 7:42 · 4 pieces". You get one "Your mail is here" notification (the existing morning summary).
- The first time you open Mail after a delivery, the mailbox door opens and today's stack slides out. It takes under 2 seconds, and Reduce Motion skips it.
- Unopened mail is still sealed; opened mail shows a torn flap. Old mail slowly fades. Urgent pieces (certified, due today) arrive right away, marked Special delivery.
- A17's drawers (Me · Home · Biz) and tabs (Incoming · Counter · Vault) stay. Biz shows only if you own a business. Earn comes back with paid offers.
- Search covers all your mail. The scan buttons, the fake "Find a mailbox" map and the old app's emoji shortcut row go.

## 4. Opening a piece

- You read the letter itself, on paper: the sender's letterhead, the date, the text, and enclosed pages that actually open.
- "Pantopus read this for you" is a note clipped to the top: a few plain sentences and the key facts (amount, due date, place, time).
- Tap the envelope to see who sent it, how Pantopus checked them, and its trail: postmarked, delivered, opened, filed.
- Actions use mail words: Pay, Sign, Acknowledge, Put on the counter, File in the Vault, Shred. Nothing just vanishes.
- A17's special layouts (certified, booklet, coupon, package tracking, records) keep their content, redrawn as paper.

## 5. Counter and Vault

- Counter is the kitchen counter: bills to pay and things to sign or answer, sorted by due date, each with a due tag. When you're done, the piece moves to the Vault.
- Vault is a filing cabinet with folders (Taxes, Home, Medical, Car, Receipts).
- Vacation hold really holds mail: deliveries pause, and everything arrives as one bundle when you're back.

## 6. First day and empty states

- Day one: a sealed welcome letter from Pantopus is waiting, opened with the porch moment. It says what will come here and when.
- No verified home yet: your own mail still comes, and the Home drawer shows a closed box with one button to verify your home.
- No mail today: an empty box with the door open and "Next delivery tomorrow morning." An empty Counter says "Nothing waiting on you."

## 7. Who sends first

1. Pantopus itself: a welcome letter, home-claim and residency letters, a ballot guide before elections, and Support Train and Plans notices.
2. Bills from businesses that invoice through Pantopus, as a window envelope with a Pay button.
3. Paid local offers: opt-in and labelled, with the household's share in Earn, once advertiser billing exists.
4. Government and utilities, which need partners.

## 8. Sending (designed now, switched off at launch)

- The earlier app's four steps on iOS, Android and web, replacing today's plain wizard form: Porch Call, Address It, Write It, Seal & Send.
  - **Porch Call:** a blurred photo of your own house, tinted for the time of day, with a sealed envelope you tap to begin. It plays in full for your first personal letter of the day, briefly after that, and not at all for other kinds.
  - **Address It:** find the person by name or address, pick what you're sending, and choose who at that address can see it.
  - **Write It:** a ruled sheet with your letterhead and verified address, "Dear …," filled in, a handwriting-like serif, a closing and your signature. It offers five inks, seasonal stationery, a voice postscript, up to two photos, an AI-suggested opening, and a live envelope preview.
  - **Seal & Send:** the letter folds, a wax seal stamps down with a tap you can feel, and the envelope leaves. Personal letters get the full moment, everyday mail a quicker stamp, and certified mail a dark, deliberate seal.
- Each letter carries a stamp you pick from your stamp book, and the stamp shows on the envelope.
- A letter rides the recipient's next morning delivery. Until then it waits in your outgoing slot with the mailbox flag up, and you can take it back.
- You can follow it like real mail: postmarked, then delivered. Personal letters never show "opened", so reading stays private. Certified mail shows when it was signed for.
- People send letters and household notices; a notice to your own household travels as a letter, since the server has let people send only letters since #2879. Bills and offers come only from businesses.
- Packages: a box for more than a letter, such as several documents, photos or a gift. You pack it, tape it and label it, and it arrives on their porch as a parcel they unbox. Details settle in the drawings.

## Left out

Scanning paper mail, sorting scanned mail (A13 My Mail Day as drawn), the fake map, mail parties and community mail.

## What this builds on

Reuse before rebuilding: the redesign reskins what exists.

- iOS `Features/Mailbox/` (root, item detail and its variants, Stamps, Vault, Records) and Android `ui/screens/mailbox/`.
- Physical pieces already in the apps: `CeremonialMailOpen` (porch, envelope, wax seal, under 2 s, Reduce Motion skip), `PerforatedStamp`, `StampBookHero` / `StampSheet`, and `MailThumb` (envelopes, postcards, magazines, parcels).
- The sending wizard already in the apps (iOS `Features/CeremonialMail/`, Android `ui/screens/ceremonial_mail/`): the same four steps, today a plain form, offered from the Mailbox only while `mail_extras` is on. It gets the earlier app's paper treatment.
- The `Mail` table already describes mail physically: `mail_object_type` (envelope, postcard, package, booklet, bundle), `lifecycle` (delivered, opened, filed, shredded, forwarded, claimed, archived), `sender_trust` (verified government, utility or business, Pantopus member, unknown), stamps, certified flags, due dates and key facts. The look needs no new tables.
- `POST /api/ai/summarize/mail` for "Pantopus read this for you".

## Fixes the redesign absorbs

These come from the October 26 code audit; the build plan re-checks each one on master.

- Categories read `mail_type`, but the database stores letter, packet, bill, book, notice, promotion and other. Rows show a generic grey "Mail", and the booklet, coupon and records layouts never render.
- Archiving makes letters vanish; there is no archived view.
- Search covers only the 100 newest personal letters.
- The "Find a mailbox" map is fake.
- Attachments don't open.
- The sender card shows a government icon and a green "Unverified".
- There is no "Pantopus read this for you".
- Vacation hold only saves dates.
- The web has two different mailboxes, and phones can't reach most mailbox pages.

## Server work this needs

The build plan hands these to the server session:

- Daily delivery timing: which pieces belong to today's delivery, with time-sensitive pieces skipping the wait.
- A vacation hold that pauses deliveries and releases one bundle.
- The first senders: Pantopus letters, and bills created from business invoices.
- For sending, later: outgoing mail that waits for the next delivery and can be taken back, and the remaining send gap (a letter to a connection's verified home is refused) fixed before sending is switched on.

## Next

1. Drawings, on the founder's go.
2. A per-platform build plan for iOS, Android and web, with the server pieces.
