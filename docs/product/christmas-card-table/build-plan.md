# The Christmas card on the table: build plan

Sequence, not dates: top priority, as fast as quality allows, and in the store builds due around December 1. Never idle waiting on another session. File and line pointers were read on master `c9eb4aba88`; check them against current master.

## What people get

With the key on, on web, iPhone (with the Duo) and Android:

1. **The card opens full screen,** on a table in its own light, with the real envelope, wax seal, lining and paper. By hand or with buttons. See [design.md](design.md).
2. **Sealed cards** refuse to open until Christmas morning.
3. **On the iPhone Duo,** it's a folded card that opens with the phone.
4. **Share:** Story, Post and link-preview pictures, Instagram, Facebook, Email, Copy link, Save.
5. **Send by link,** as a third way to send a card.
6. **Public card pages,** where people arriving from social media can see a card and send one.

With the key off, nothing changes.

## The switch

New launch key `card_table`, off by default, needing `mailbox` and `holiday_cards` too. Add it the way `holiday_cards` was added:

- Server: `backend/utils/featureFlags.js`.
- Web: `frontend/apps/web/src/lib/featureFlags.ts` (list ~62, `launchFeatures` ~89, route gates ~133).
- iOS: `Core/Environment/LaunchFeatures.swift` (~65, ~129).
- Android: `core/LaunchFeatures.kt` (~60, ~91).
- Docs: a new row in `docs/launch-scope-flags-2026-10-01.md`.

Old apps ignore every new server field. Keep the old card views in the code for key-off.

## Who builds what, in order

Each line is one small PR. Server and art go first, because the apps need them, but apps can start at once against the contract below.

### Coordinator

- **C1. Land this folder** (branch `claude/holiday-mail-design-share-4752f3`, docs-only).
- **C2. Review each PR** against the sample before it merges.
- **C3. The three-app check** below, on master.
- **C4. Docs:** NEXT_STEPS "Christmas cards" and the flags doc, then the founder report.

### Server (with web, one session)

- **S1. Key and picture data.** `card_table`. Add `slug` and `table` to `DESIGNS` in `backend/services/holidayCards.js` from [designs-table.json](designs-table.json), and to `cardView`, `sentPiece.card`, the card `designs` list and the preview. New public `GET /api/mailbox/cards/designs`. No behaviour change.
- **S2. Send by link.** The contract below.
- **S3. Counts and email.** `POST /api/mailbox/cards/shared`. The sealed-envelope picture at the top of `emailService.sendCardWaitingEmail`.

### Web

- **W1. Art.** All 49 trimmed pictures (`public/holiday-cards/card/<id>.jpg`, crop boxes in `designs-table.json`, about 250 KB each), link previews (`public/holiday-cards/share/<id>-link.jpg`, plus `sealed-link.jpg`), and table art (`public/holiday-cards/table/`). Today's files stay for old apps.
- **W2. The table.** Port the sample to React (`components/mailbox/cards/CardTable.tsx`). Host it from `app/mailbox/[drawer]/[item_id]/page.tsx` ~415 in place of `HolidayCardView`, as a portal above `AppShell` and the tab bar. Mailbox row paper (`MailPiece.tsx`). New face and pen (`CardFront.tsx`, `CardBack.tsx`, `next/font/google` for La Belle Aurore in `cardFont.ts`). Look it over and Sent buttons (`LookItOver.tsx`, `sent/SentPieceView.tsx`).
- **W3. Share.** Sheet and `<canvas>` pictures. Reuse the `navigator.share` handling in `components/feed/sharePostLink.ts`.
- **W4. The link page and sending by link.** `/open/[mailId]` and `OpenLetterView.tsx` for cards, with generated metadata and the fixed preview. "Send it by link" in `SendCardFlow.tsx`. Sent words in `sent/sentWords.ts` and `SentList.tsx`.
- **W5. Public card pages.** `app/(site)/cards/page.tsx` and `cards/[slug]/page.tsx`, fetched like `lib/publicShare.ts`, with metadata as other public pages. `/app/mailbox/cards?design=` preselects a picture. Sign-up credit through `invite_code`, as `StartFunnel.tsx` does it (`authPageHref`, `inviteExtras`).

### iPhone + Duo

- **I1. The table.** New folder `Features/Mailbox/HolidayCards/Table/`. Art as loose resources in `Resources/HolidayCardTable/` (`project.yml`), La Belle Aurore with its licence beside `NothingYouCouldDo.ttf` (`UIAppFonts`, `project.yml` ~110). Model above the view (see the fold notes). Host: in `MailDetailView`, once the letter is loaded and is a card, present a `.fullScreenCover` with no system animation, on a table-coloured page; closing it calls `onBack`. `GenericMailDetailLayout.letterPage` ~69 keeps the old view for key-off. Keep `hooks.cardFirstOpen`, `onEnvelope`, `onAction` (shred confirm and Vault in `MailDetailView` ~158, ~479) and move them to ⋯. Motion: CoreMotion. Haptics. Sealed. Reduce Motion. VoiceOver. New face and pen: `HolidayCardArt.swift`, `HolidayCardNote.swift` (size and pitch shares). Mailbox row: `HolidayCardEnvelope.swift`.
- **I2. The Duo.** Poses from [design.md](design.md) section 5, in the same model. Check the card covers the side-by-side Mail (`MailSideBySide.swift`, `HubTabRoot.swift` ~885).
- **I3. Share.** Sheet, `ImageRenderer` pictures as in `Features/Place/Detail/SkyShareCard.swift`, share and mail via `Core/Design/Components/SystemSheets.swift`, `InviteLinks`, `PersonalInviteLink`. Add `instagram-stories` and `facebook-stories` to `LSApplicationQueriesSchemes` and an empty `PANTOPUS_META_APP_ID` build setting, so one-tap Stories work when an ID exists and fall back to the share sheet until then.
- **I4. Send by link and the rest.** Step 1 and step 5 (`HolidayCardSteps.swift`, `HolidayCardLookStep.swift`, `HolidayCardFlowViewModel.swift`), Sent (`MailSentPieceView.swift`, `MailSentWords.swift`, `MailSentShelf.swift`, `MailSentDTOs.swift`), Look it over and Sent buttons, `pantopus://mailbox/cards?design=` (`DeepLinkRouter.swift` ~983).

### Android

- **A1. The table.** New folder `ui/screens/mailbox/cards/table/`. Art in `res/drawable-nodpi`, font in `res/font`. Host: a full-window dialog (or route without the tab bar, once #3582 lands) from `mail_detail/letter/LetterLayout.kt` ~92 in place of `HolidayCardPage`. `rememberSaveable` for the step so rotation and process death keep it. Motion: game rotation vector. Haptics. Sealed. Animations off. TalkBack. New face and pen: `cards/HolidayCardArt.kt`, `HolidayCardFaces.kt`. Mailbox row: `components/MailPiece.kt`, `cards/HolidayCardRow.kt`.
- **A2. Share.** Sheet, pictures drawn as `place/detail/SkyShareCard.kt`, a new `cache-path` in `res/xml/file_paths.xml`, `<queries>` for Instagram and Facebook in the manifest.
- **A3. Send by link and the rest.** `SendCardSteps.kt`, `SendCardLook.kt`, `SendCardViewModel.kt`, `HolidayCardDtos.kt`, `mail_sent/MailSentCardScreen.kt`, `mailbox_root/MailSent.kt`, `DeepLinkRouter.kt`.

### After the store release (not before)

Add `/cards/*` to `public/.well-known/apple-app-site-association` and the Android link filters only once apps that handle it are out. Older apps would otherwise open a page they don't know.

## Contract: send by link

No table, no migration. `Mail_check` allows a pending row with no recipient and `escrow_recipient_contact` is nullable. The block triggers already work: `admit_personal_mail_unblocked` fires when a claim sets `recipient_user_id` and raises `MAIL_RECIPIENT_UNAVAILABLE`, and a block won't withdraw a pending link because it has no contact, so the claim is where a block is enforced.

**`POST /api/mailbox/cards` and `/preview`:** `to` becomes `{ user_id } | { email } | { link: true }` (`sendCardSchema` ~1723). Refused with 400 `CARD_LINK_OFF` when the key is off.

In `checkCard` (~1874), a link branch next to the email one:

- Skip the email rate limits (`checkEscrowRateLimits`). One card a day still applies, and a withdrawn link frees the day, the same as email.
- `arrivalsFor({ byEmail: true })`.
- `card.by_link = true`, `card.to_name = null`.
- `senderDisplay` as for email. `delivered_at` now, `escrowExpiresAt` 90 days.

`requestDigest`: existing person and email sends must keep the same digest, so add the link only when it's set (for example `toEmail: 'link'`).

In `POST /cards` (~2011):

- The row id must be known before the insert: `rowId || crypto.randomUUID()`, as an explicit `id`.
- `escrow_status: 'pending'`, `escrow_recipient_contact: null`.
- Token: `base64url(HMAC-SHA256(SECRET, 'pantopus:card-link:v1:' + id))`, with `SECRET` as in `services/mailEnclosures.js` ~23 (no new secret). Store only `hashClaimToken(token)`, so a copy of the row never holds a working link.
- Answer `201 { card, link }`, and `200 { card, link }` on a repeat of the same request ID. No email goes out.
- `logMailEvent('holiday_card_sent', …, { byLink: true })`.

**`GET /api/mailbox/cards/:id/link`** (new, signed in, sender only): `{ link }` while pending. Otherwise 409 with what happened, in the same words as take-back. Check `claimTokenMatches` first: if the secret has rotated, answer 409 and say to take it back and send it again.

**Sent:** `holidayCards.sentSummary`, `sentPiece` and `sentTrail` add `by_link: true`. `by_email` stays true and `status` stays `email_waiting`, `claimed` or `expired`, so older apps still show something sensible (iOS falls back to `.delivered` on unknown statuses). New apps reword from `by_link`. `can_take_back` works unchanged (take-back ~2197).

**`GET /api/mailbox/claim/:id`** (~3202): `card` gains `by_link: true`; `sentTo` is `''`. Never the design, caption or note.

**`POST /api/mailbox/claim/:id`** (~3276):

- If `card.by_link`, skip the contact match. Everything else stays: own card refused (`MAIL_OWN_LETTER`), the sealed time set by their zone, the conditional update on `pending`.
- `closedEscrowReason`: for a link, `MAIL_CLAIMED` says "Someone already opened this card. A card goes to one person."
- `MAIL_RECIPIENT_UNAVAILABLE` answers `MAIL_UNAVAILABLE`, in card words.
- Notice to the sender: "{name} opened your link and has your card."

**`jobs/mailEscrowExpiry.js`:** with no contact, say "Nobody opened your link in 90 days. Your card stays in Sent."

**`POST /api/mailbox/cards/shared`** (signed in, rate limited): `{ design, kind, format, with_note }`, where kind is instagram, facebook, email, link, save or more. `logMailEvent` only, answers 204. Counts tell the founder whether sharing works.

**`GET /api/mailbox/cards/designs`** (public, no sign-in, cached one hour, 404 with the key off): `{ year, collections, designs: [{ id, number, slug, caption, collection, table }] }`. Declare it before `/cards/:id`.

## Checks

Follow AGENTS.md: real apps, real local backend and database, relaunches, and the other person's view. No new unit tests; if an intended change breaks a test, update it in the same PR. Run CI's own checks before pushing: iOS SwiftLint (500-line files, 300-line types), SwiftFormat and the hex-colour scripts (colours live in `MailPaper`); Android detekt and ktlint; web lint, typecheck and Jest.

Each app, on its own:

- **Opening:** first open by hand and by button, reopen, Open it again. Halfway pulls that fall back. Very fast flicks.
- **Sealed:** refused before Christmas. Lifted with the test clock (`mps-clock.cjs unseal`), then opens. The note is never read while sealed.
- **Words:** 300-letter notes, the longest caption ("Good friends. Questionable wrapping skills."), long names, emoji and non-Latin notes.
- **Sizes:** iPhone SE, iPhone 17 Pro, Pro Max, a small and a large Android, tablet, desktop and phone web.
- **Tilt:** real sensors where a simulator allows it, and check it stops when the screen closes. Low Power Mode.
- **Access:** VoiceOver, TalkBack, keyboard, Reduce Motion, largest text.
- **Actions from ⋯:** who sent it and its trail, Vault, Shred, Report, Block. Each works from the table and comes back correctly.
- **Share:** every picture in every size, note on and off. Look at each picture: no address ever, first name only with the note on, slip readable. Real share sheet, real mail composer, Copy link, Save. On web, the share flows need simulator Safari; the built-in browser refuses the clipboard.
- **Key off:** pixel-identical to today on Mailbox, reader, Look it over and Sent (`pixel-diff-before-after-screens`).

iPhone Duo, with `idb hinge` and `idb rotation`: closed, open sideways flat, book, upright, tabletop. Turn and fold at every step of the opening. Nothing resets. Covers side-by-side Mail, and ✕ returns to it. Clear of the system strip.

Across apps, on master: a card sent from each app and opened first on another (iPhone → web, web → Android, Android → iPhone), each of: by person, sealed, by email, by link. By link: the first person keeps it, the second is told. Own link refused. Blocked person refused. Take back before and after it's opened. Copy link again. 90-day expiry with the test tools. Sent shows every state. Public page to sign-up to sending, with invite credit recorded. Cold relaunch on both phones and a web reload.

Name what couldn't be checked: real phones, real Instagram and Facebook posting, real email delivery, hosted services.

## Founder steps

None of these block the build. They come at the end, in the founder report.

1. **Look over the pictures:** [the sheet of all 49](reference/all-49-pictures-with-table-colours.jpg) with table colours, and the seven most-trimmed pictures. Changing any is a small server and web update.
2. **Switch it on:** `card_table` on the production server and worker, Vercel, and the `PANTOPUS_LAUNCH_FEATURES` Actions variables on `ios-release` and `android-release`.
3. **Store builds and release,** with the key in them.
4. **Optional, any time:** a free Meta app ID (developers.facebook.com) makes Instagram Story one tap. Meta's rule. The ID is a public number, so it can go in the build setting.
5. **Worth a thought, not needed:** cards by email keep today's limits: 3 new non-Pantopus addresses a week, and the same address once in 30 days. Links have only the one-card-a-day limit.

## Traps known ahead of time

- **iOS cover:** `.hidesTabBar()` exists (`RootTabBar.swift` ~467), but a full-screen cover is the way to span side-by-side Mail. Sheets and the shred dialog must present from the cover, not the screen under it. Don't re-read the letter on fold rebuilds.
- **iOS 3D:** `rotation3DEffect`'s `perspective` isn't CSS's. Tune by eye against the sample. A view wider than offered inside a reading column can freeze the app (`swiftui-overflow-readable-column-duo-hinge`).
- **iOS pictures:** `ImageRenderer` can't draw `HolidayCardNoteText`.
- **iOS note:** the note view is TextKit-based and shared with the writing step, so line pitch and letter limits must still hold in the pen. The note must fit: 300 letters at 6u on 7.6u lines fits about 10 lines of 31 letters on 11 rules. Check against real 300-letter notes.
- **Android blending:** `BlendMode.Softlight` needs API 29 and minSdk is 26. Below that, use a plain low-alpha warm overlay.
- **Android 3D:** set `cameraDistance` on `graphicsLayer` or the turn looks wrong.
- **Web:** `mix-blend-mode` inside a 3D-transformed parent doesn't blend with what's behind it, so keep blends inside each face (the sample shows how). iOS Safari has no `navigator.vibrate`.
- **Images:** a failed image should retry rather than show broken (`retryImg` in the sample). Load the art and the card's picture before the envelope arrives.
- **Servers and Next:** `.claude/launch.json` is tracked; restore it after adding rig entries. The preview runner can't exec on `/Volumes`.
- **Merging:** follow the shared queue. Server merges reach production with the next Deploy Backend, which is safe because everything new is behind the key. App-only PRs have cut-over rules: see the merge notes in memory.

## Done means

All PRs merged with master CI green. The three-app check passed and written up with what couldn't be checked. Key-off identical to today. NEXT_STEPS and the flags doc updated. The founder has a plain report: what they'll see, what they need to do, and what's unverified.
