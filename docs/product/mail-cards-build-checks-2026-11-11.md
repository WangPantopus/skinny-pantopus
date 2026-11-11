# Mail and Christmas card design build: the wave checks

November 11, 2026. The written three-app check of each wave of the [design plan](mail-cards-design-plan-2026-11-09.md),
built as the [kickoff](mail-cards-build-kickoff-2026-11-09.md) describes. Every check ran against a local backend and
database with made-up people, from both people's side, with a relaunch or reload.

## Wave 1 three-app check (Mail and card design build)

November 10, 2026, by the coordinator (MCCOORD). Plan Parts 1, 3 and 2 of
`docs/product/mail-cards-design-plan-2026-11-09.md`, on web, iPhone (with the iPhone Duo) and Android.
Everything is app and web only: no server change, no migration, no new launch key. All of it rides `card_table`.

### What merged

| Part | Web | iPhone + Duo | Android |
|---|---|---|---|
| 1 Quick fixes (1.1-1.13) | #3828 `39d382b` (+1.8 in #3829) | #3831 `c9c20e9` | #3832 `c17fb61` |
| 3 Send one back | #3829 `c369597` | #3838 `a8912e8` | #3833 `bfae9b2` |
| 2 Seal it by hand | #3834 `7f7425a` | #3841 `feaa2a1` | #3842 `6f354c6` |

Each was reviewed by the coordinator before merging, merged through the shared queue, and master CI passed after
each merge (the last run, on `6f354c6`, was in progress when this was written).

### Checked in the real apps

All against the local CTBSRV stack and backend, with made-up test people, from both people's side.

- **Web** (browser, phone 390×844 and desktop 1280×900, 200% text): every Part 1 web row; the send flow without the
  bottom bar; the pinned Pick a card bar; share Story and Post with and without the note against Instagram's safe area;
  verses in serif italic. Send one back: hidden on the picture side, after a block and on a sealed card; opens Pick a
  card with the person chosen, survives a reload; today's card used goes to Today's card. Sealing: by buttons and by
  hand, letting go early does nothing, double press sends one card, a refusal at the seal sends nothing and shows the
  server's words, reload before the seal sends nothing, Reduce Motion, sealed until Christmas, by link. With stamp
  books switched on locally: a list of two sealed once ("2 cards on their way."), and running out of stamps opens the
  stamp books over the table. The receiver got and opened the card.
- **iPhone 17 and iPhone Duo** (closed, open flat, book, upright, tabletop): all Part 1 rows, after a relaunch, the
  largest text (a card-shrink bug found and fixed), accessibility labels, the verse in type on the receiver's side.
  Send one back on the iPhone and the open Duo (the Duo's pages now end above the new button). Sealing by hand and by
  buttons on every pose, with the same refusal, double-press, relaunch, Reduce Motion, sealed and by-link checks.
  With stamp books on: a list of two, out of stamps (found: the table closed before the stamp books showed; fixed so
  they open over the table), and send one back with today's card used.
- **Android** (emulator `pantopus_cardlook`): rows 1.1-1.3 and 1.6-1.13, 9- and 17-picture collections, font scale
  2.0, animations off, TalkBack labels; the welcome letter (porch) already has no tab bar. Send one back with the same
  block and sealed checks. Sealing by hand and by buttons with refusal, double press, relaunch, Take it back, Reduce
  Motion. Send one back with today's card used: stamps off goes to Today's card (fixed: Back needed two presses),
  stamps on keeps the person. With stamp books on: a list of two, and out of stamps opens the stamp books over the table.

Share pictures are drawn from the same coordinates on all three (Story card 800 px of 1080, Post 760).

### Not verified

- Real phones and real phone browsers: taps you feel (the seal's ticks), tilt, real speed.
- Screen readers speaking aloud (labels were read from the accessibility trees).
- Send one back with the season closed or the sender's account deleted (same server check as a block, which was tried).
- A share picture actually posted to Instagram.
- Hosted services: nothing here touched production; web goes out with the next web deploy, the apps with the next
  store builds.

### Known follow-up

- iPhone: after a list sent from "Send {name} a card", Done returns to that card's table instead of the Mailbox
  (harmless). Fixed in wave 2 (#3853).

### Ready for the store builds

Wave 1 is on master for all three apps. It is ready for the next iOS and Android store builds (the founder's step).

## Wave 2 three-app check (Mail and card design build)

November 10, 2026, by the coordinator (MCCOORD). Plan Parts 5, 6 and 4 of
`docs/product/mail-cards-design-plan-2026-11-09.md`, on web, iPhone (with the iPhone Duo) and Android.
One additive server change (the verse text); everything else is app and web only. No migration, no new key; all of it
rides `card_table`.

### What merged

| Part | Server / web | iPhone + Duo | Android |
|---|---|---|---|
| Verse text on the nine Christmas with Jesus Christ designs (server, public page) | #3845 `7c5e8db` | | |
| 5 Card rack | #3846 `0914f3c` | #3849 `889a833` | #3850 `908e482` |
| 6 Enlarge, Read the verse, wide cap, Duo upright/tabletop | #3847 `ddfd9bb` | #3854 `d0acfa4` | #3855 `aa2f867` |
| 4 Opened cards show their picture (Mailbox and Sent) | #3848 `b983c1a` + #3852 `1c9b254` | #3851 `4750c53` | #3856 `7ad9c77` |
| Wave 1 follow-up: Done after "Send {name} a card" goes to the Mailbox | | #3853 `32d6cb9` | |

Every PR was reviewed by the coordinator, merged through the shared queue, and master CI passed after each (last on
`7ad9c77`). #3845 and #3852 went out in production backend releases (additive: old apps ignore `verse`).

My review mistake: I first told web to drop the Sent rows from #3848; plan Part 4's last line includes them. #3852 put
them back and added the verse to Sent's card, so "Read the verse" works from Sent too.

### Checked in the real apps

All against the local CTBSRV stack, from both people's side.

- **Web** (phone 390×844, desktop 1280×900 and 1440×1100): the rack opens at the tapped card with collection name,
  "n of N" and the verse; next by button, swipe and arrow keys; cloth colour follows the card; ✕ ticks the last card
  seen. Read the verse bookmark (Escape closes only it); double-click to 2.4×, drag, double-click back; synthetic
  pinch to 2.5×; single tap still turns; 640 cap on a wide window. Mailbox opened rows taken out; Sent delivered rows
  "To {name} · Delivered", sealed/email/link unchanged; Sent → Read the verse.
- **iPhone 17 and Duo** (closed, sideways, book, upright, tabletop): the rack at full table size with the verse under
  verse cards, one swipe per card, ✕ and Write keep the last card seen, largest text, relaunch, accessibility labels.
  Read the verse bookmark, pinch to 3× and drag to the printed verse, double-tap in and out; upright flat shows one
  card turned by swiping; tabletop pages meet at a shaded crease. Mailbox and Sent rows, Duo closed and open. Done
  after a send-one-back goes to the Mailbox.
- **Android** (emulator): the rack along the 9-card and 17-card collections, cloth per card, ✕/Back tick the last
  card, font scale 2.0, animations off, process kill restores the rack. Read the verse (Back, tap outside, Close),
  double-tap 2.4×, a real two-finger pinch to about 2.6×, Back un-enlarges first, a tablet-sized window at about 640 dp.
  Mailbox opened and Sent delivered rows, sealed card stays shut, font scale 2.0.

### Not verified

- Real phones, a real trackpad pinch, real phone browsers.
- Screen readers speaking aloud (labels read from the accessibility trees).
- Pinch on the Duo, an iPad at the 640 cap, a claimed by-link card in Sent.

### Known follow-up

- iPhone Duo upright: the one large card is about 440 pt wide, not the plan's "about 600" (6.4); the envelope's
  height limits it. Fixed in wave 3 (#3879): about 522 pt, the most the upright screen allows.

### Store builds

Wave 2 is on master for all three apps. Like wave 1 it changes only the apps and web (plus the additive server verse,
already released), so it rides the next iOS and Android store builds.

## Wave 3 three-app check (Mail and card design build)

November 11, 2026 (UTC), by the coordinator (MCCOORD). Plan Parts 7, 8, 10 and 9 of
`docs/product/mail-cards-design-plan-2026-11-09.md` on web, iPhone (with the Duo) and Android, plus the founder-approved
art (star stamp, cream envelope set with the red seal, three paper sounds) and one additive server field (the signature).
No migration and no new key in this wave; all of it rides `card_table`.

### What merged

| Part | Server / web | iPhone + Duo | Android |
|---|---|---|---|
| Signature field (server, additive) | #3857 `b07e189` | | |
| 7 The mood follows the card (+ the wave 3 art files) | #3859 `47db018` | #3869 `847a39c` | #3861 `a187ad9` |
| 8.1 Feel the paper (ticks) | (web: none) | #3880 `b102854` | #3867 `334ba60` |
| 8.2 Sign it yourself | #3862 `bccca71` | #3888 `c281fb1` | #3878 `9a216e4` |
| 8.3 Quiet sounds + "Card sounds" switch | #3862 | #3880 | #3881 `3265007` |
| 10 Letters (welcome letter on the table, letter page) | #3863 `3989e76` | #3899 `70d6d21` | #3897 `0cf8fc9` |
| 9 From Write on the back onward, at the table | #3864 `c1b9357` | #3901 `3b4eecb` | #3898 `d9b435f` |
| Follow-ups: Duo upright card ~522 pt, Santa's bounce matched | | #3879 `6c12492` | (in #3861) |

Every PR was reviewed by the coordinator, merged through the shared queue, and master CI passed after each. #3857
went out in a production backend release (additive; old apps keep the typed name).

### Checked in the real apps

All against the local CTBSRV stack with made-up people, from both people's side, after a reload or relaunch.

- **Moods.** Christmas with Jesus Christ (59-67): star stamp on rows and table, candlelight breathing from the lower
  left, one gold glint across the lining, no snow. Nostalgia and Santa: soft snow only inside the window light, moving
  with it; Santa lands with a little more bounce (same spring on all three). Off with Reduce Motion (and Low Power Mode
  on the phones). Same picture-number mapping on all three.
- **Ticks.** A light tick every 8% of the card's pull, out of the envelope and into it (iPhone Core Haptics, Android
  haptic feedback; seen in logs and the vibrator service, not felt).
- **Signing.** The pad's Done only with ink; the signature sits after FROM in the pen's ink on Look it over, the
  sealing table, the reader's table, Sent and the share picture with the note on; "Use my typed name" puts the name
  back; the server keeps it with the note (null while sealed for the reader); never in logs.
- **Sounds.** Slide, seal and set-down play once each at the right moments, only with the ringer on (iPhone ambient
  session follows the silent switch; Android ringer mode normal), with a "Card sounds" switch (web and iPhone: Mail Day
  settings; Android: the Mailbox ⋯ menu, which has no settings screen), on by default, kept on the device.
- **Letters.** A new person's welcome letter arrives on the table in the cream envelope with the red seal on slate,
  "A letter for you" in red, no postmark or snow; it opens with the same moves into a folded sheet and then the letter
  page, where "Pantopus read this for you" shows two lines with More and the three actions sit at the end.
- **At the table.** Pick a card stays paper; Write on the back, Seal it for the day and Look it over sit on the chosen
  card's cloth under the window light; "When should it arrive?" is a cream slip; every word and step unchanged (checked
  line by line). Web's check of a list's Look it over found dark words on the cloth: fixed before merging.
- **Devices.** iPhone 17 and the Duo closed, open flat, upright, sideways and tabletop for the table pieces; Android
  emulator at font scale 2.0; web at phone and desktop sizes and 200% text.

### Not verified

- Ticks felt and sounds heard on real phones (the founder should listen; the samples were approved).
- Screen readers speaking aloud (labels read from the accessibility trees).
- The real iPhone silent switch and Android vibrate/silent modes.
- (Since done) iPhone: a list's Look it over on the cloth, checked after #3901 merged with stamp books previewed for
  its test sender (Hazel to Nora and Maya): passed, no fix needed; the preview is off again.

### Store builds

Wave 3 is on master for all three apps. Apart from the signature field (released), it changes only the apps and web,
so it rides the next iOS and Android store builds with waves 1 and 2.

## Wave 4 three-app check: the photo and the voice greeting (+ Part 11, bought stamps)

November 11, 2026, by the coordinator (MCCOORD). The photo and the voice greeting from the
[card memories plan](christmas-card-memories-plan-2026-11-02.md) (steps 3, 4 and 7) as drawn and approved on November 10,
Report this card and Block, Sent's "Couldn't be delivered" (founder's choice B), Part 11 sharing, and the founder's
November 11 rule that a photo or voice greeting goes only on a card sent with a bought stamp. Everything is behind the
launch key `holiday_card_memories`, off everywhere; replies and the Christmas collection are not in this build.

### What merged

| Piece | Server | Web | iPhone + Duo | Android |
|---|---|---|---|---|
| Photo (upload, print, covered for non-connections, Sent, Look it over) | #3872 | #3882, #3883 | #3910, #3913 | #3909 |
| Report this card (admins see that card only) + Block {name} | #3873 | #3885, admin page #3892 | #3915 | #3912 |
| Media cleanup (nightly, and at a block) | #3874 | | | |
| Voice greeting (record AAC, 60 s, cassette / gift tag) | #3875 | #3890 | #3917 | #3918 |
| Sent "Couldn't be delivered" (one additive migration) | #3876 | #3884 | #3914 | #3912 |
| Drafts keep the card across a reload / relaunch | | #3891 | #3925 | (in #3909) |
| Bought stamp only (one additive migration) | #3919 | #3921 | #3922 | #3924 |
| Web fetches the photo only after the card is turned over | | #3926 | | |
| Part 11: Share this card, Open card, Share all, invitation words, contacts | | #3866, #3868 | #3902, #3903 | #3900, #3904, #3906 |

The server PRs went to production in normal backend releases with the key off (the release of master `a83ebc9` carried
#3872-#3876 after a queue hold; #3919 released after it). Master's iOS lint went red once when two green PRs together
grew one file past 500 lines; #3905 fixed it.

### The final three-app check (November 11, local stack, key on, stamp books previewed)

A card sent from each app and opened first on another, each sender starting with 0 bought stamps:

- **Web → iPhone** (Juniper → Nora, a nostalgia card, photo + 5 s greeting). With no bought stamp the line showed and
  both buttons opened the stamp books with the reason; after a local book, the photo and greeting went on, one bought
  stamp was spent and the free count stayed. On the iPhone: nothing loaded at open; turned over, the print with the
  orange date and the "For Nora" cassette, one photo request; the greeting loaded only on the press and played. On the
  Duo closed, book, upright and tabletop, print and cassette sat clear of the words.
- **iPhone → Android** (Hazel → Owen, Christmas with Jesus Christ, photo + 7 s greeting; not connected). Owen saw
  "Photo from Hazel. Tap to show." and a cream gift tag; no request before the tap or the press, exactly one after each;
  a plain print (no date). Owen's Report this card reached the web admin page, where a made-up admin opened that card only.
- **Android → web** (Ivy → Maya, Christmas with Santa, sealed until Christmas, photo only). Delivered sealed: nothing
  of the photo anywhere, not even a request. After the seal was lifted with the test clock: the print, uncovered.
- **Block before delivery:** the sender's Sent said "Couldn't be delivered", never why, and the stamp came back.
- **Relaunch / reload:** every card stayed opened, Sent unchanged, nothing re-downloaded until turned over again (web
  now matches, #3926).

Each builder also checked its own pieces: refused and offline uploads keep the note and say why; a moving picture is
refused; the microphone is asked for only on the tap and refusing it still lets the card go; recording stops at 60 s;
Reduce Motion; screen-reader labels; a lost send answer retried gives one card; drafts survive a relaunch and clear at
sign-out.

### Storage and go-live (November 11)

Production uploads live in Supabase Storage, in the public bucket `pantopus-uploads` (the AWS uploads bucket is not what
production writes to; a CloudFront rule added there for `holiday-card-media/` and `ai-chat/` is harmless but moot). So
card photos and voice got their own private Supabase bucket, `pantopus-card-media` (#3931, `CARD_MEDIA_BUCKET`). With
that released, `holiday_card_memories` went on for the production backend and worker, on Vercel and in both app release
environments. Checked on production: the containers carry the key and the private bucket, the web bundle carries the
key, and the server answers photo and voice usable, a bought stamp required. `chat/` and `ownership-evidence/` in the
public bucket are still reachable by link (founder: not now).

### Not verified

- Real phones: a real App Store or Google Play stamp purchase, taps felt, sound heard, real microphones.
- Screen readers speaking aloud.
- Real use in production at scale (the key is on; no real cards with photos were sent during the build).

### Founder's steps

1. (Done November 11) the private bucket and switching the key on everywhere.
2. Someone with an admin account works the web Reports page promptly (Apple 1.2).
3. New iOS and Android store builds from master (they carry waves 1-4 and Part 11).
