# Compare with a friend (mint + consent)
id: f8-compare-sheet · platforms: web · isNew: True · artboards: 18

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Compare with a friend · f8-compare-sheet

TYPE: NEW sheet. It opens over the existing, already-designed /start preview step. Keep that host screen exactly as it is, with one addition: a TextActionRow under the aha card that holds only "Compare with a friend", with the caption "Cards show readings and your city, never your address." The WallBar footer keeps its existing "Share this address" and app-download links unchanged. Compare is never added to the footer.

ATTACH: the /start preview step at web 390 and 1440 (light); the compare reveal at web 390 (light); the compare share card (OG image), light frame.

PLATFORMS & VIEWPORTS: Web only. Mobile web 390x844 is the primary case: a bottom sheet at full height. Desktop 1440x900: a centred modal, 480 wide. The native apps have no sheet of their own. Their compare card is anonymous and is designed separately.

WHERE IT LIVES & HOW PEOPLE ARRIVE: /start is the signed-out door, before Place · Today · Nearby · Mail. The sheet is the same for signed-in viewers. It can be reached only from the preview step, never from the hero, because a card needs a finished preview.
Ways in:
(1) "Compare with a friend" under the aha card, with or without a ?vs= link.
(2) "Send yours back" on the compare reveal at /start?vs=<token>. The sheet receives the address the person just typed, whether or not it is saved, and makes the card from it.
The sheet has no URL of its own. It hands off to the system share sheet or the clipboard. From there the link unfurls in a messenger as the compare share card, followed by the title line and the description line.

WHO AND WHEN: Jordan Lee at PLACE B, on his iPhone on TODAY at 6:10 PM. He opened Dana's compare link (Camas, WA, card as of Sat 12 Sep 2026), typed his address and saw both readings. Now he wants to send his own card without giving away his street. Frames 1–4 and 6–15 show Jordan using "Compare with a friend" under his own aha card, sending to a different friend. Frame 5 is the flow's reciprocal step, reached from "Send yours back", with the name toggle off.

THE ONE JOB: Mint and send a compare link in one tap, and show exactly what the card will and will not reveal before anything is sent.

FIRST FIVE SECONDS: The eye lands first on the card preview at true share proportions, then on the privacy line directly under it, then on the name toggle. The single primary action comes last: "Share" on mobile, "Copy link" on desktop.

CONTENT (FIXTURES; deltas below). Draw these top to bottom:
1. Title "Compare with a friend", with a visible Close.
2. A line only the sender sees, outside the card: "Made from 1107 NE Birchfield Ct. The address stays off the card."
3. The card preview, drawn as the unfurl:
- Image: keep the layout, type and "Yours?" column of the attached light frame exactly, and replace its strings with the ones below. Scale it from 1200x630 to the full sheet width at 1.91:1.
  - Left column: ScaleStrip in its Foundations 05-og-column recipe (40px lines, 112px rows), with the text column up to 720px wide and the filled "Yours?" column narrowed to match. The sender line reads "A place in Camas, WA". The four rows print these share-card short forms, one line each: "Flood zone X · minimal hazard" · "Wildfire · Moderate · 3 of 5" · "Air on Mon 19 Oct · AQI 42 · Good" on the AqiBand hues · "Radon zone 1 · highest (county)". Below them sits one dated 28px sources line: "● Official · FEMA Sep 2021 · USFS 2023 · AirNow Mon 19 Oct · EPA county-wide".
  - Right column: the filled "Yours?" prompt card with "pantopus.com".
  - No headline and no other text inside the image.
- Title line under the image. Anonymous: "A place in Camas, WA · Yours?"
- Description line, clamped to two lines with an ellipsis as most messengers show it: "Online or mail voter registration for Nov 3 must arrive by Oct 26 in Washington. Voter deadline: WA Secretary of State. Readings: FEMA, USFS, AirNow, EPA. Nextdoor is what your neighbors say. Pantopus is what's on record about your address."
- Then "pantopus.com".
4. Privacy line: "This card shows readings and your city, never your address. Anyone with the link can see this card until Sat 19 Dec."
5. Toggle, off by default: "Show my first name on the card". Draw it as a web switch (role=switch), at least 44px tall, with the word On or Off printed beside it. When it is on, a "First name" field appears, empty and focused (24 characters at most). While the field is empty, the card stays anonymous ("A place in Camas, WA") and no re-mint runs. Frame 2 shows "Jordan" typed: the image's sender line then reads "Jordan · Camas, WA", and the title line reads "What's on record at Jordan's place. Yours?" These sender and title strings must match the compare share card and the arrival page character for character. The arrival page adds " — what's on record for this area" after the sender line.
6. URL row: "pantopus.com/start?vs=eyJ2IjoxLCJjIjoiQ2FtYXM…" with the caption "Works for 61 more days". On mobile, the row also has a "Copy link" text button.
7. Buttons, side by side, the same height and width: the primary "Share" (mobile) or "Copy link" (desktop), and "Cancel" as a bordered button in text.primary, which closes the sheet.
Headline rule: if the headline comes from a seeded row that is still unverified, it is left off the token. The description line then starts at "Readings:".
Reciprocal variant: the title reads "Send yours back". The made-from line reads "Made from 1107 NE Birchfield Ct, the address you just typed. The address stays off the card." The primary reads "Send my card". The privacy line, the toggle and everything else stay the same.
Worst case: the 24-character first name "Marie-Marguerite-Solange"; the longest headline (up to 90 characters), "Property tax 2nd half is due Mon 2 Nov for homes in Clark County, Washington.", followed by "Tax date: Clark County Treasurer." (the "moved from Sat 31 Oct" wording belongs only in detail views, never in this headline); an inline mint error; and a street-matched flood layer.

LAYOUT & VISUALIZATION: The preview is the top of the sheet, at the size and proportions it will unfurl. Never shrink it to a thumbnail. It shows exactly what the token contains and nothing else: no street, map, pin, coordinates or house image, even blurred. State the precision in words ("your city"), because a map centred on the home would give the home away. The privacy line sits directly under the preview, and the toggle sits between the privacy line and the buttons, because the toggle is the only control that changes what the card reveals. The buttons come last. At 390x844 (bottom sheet at full height), everything from the title to the buttons fits without scrolling.
Inside the image:
- A sender line longer than the column (for example "Marie-Marguerite-Solange · Camas, WA") wraps to two 40px lines. The rows move down, and the sources line stays inside 630px, because the name field is capped at 24 characters. Frame 13 shows that height budget in its gutter.
- A layer matched only to the street, not the parcel, shows the hollow ProvenanceMark in its image row, with the words "On record, not confirmed" at 28px beside a shortened track. It is never drawn filled. When any row is hollow, the sources line reads "● Official: USFS 2023 · AirNow Mon 19 Oct · EPA county-wide · ○ On record, not confirmed: FEMA flood, street match", wrapped to two 28px lines if needed, within the height budget.
- A layer with no data shows "Not on record" in its row.

INTERACTION, MOTION & HAPTICS
- The link is minted when the sheet opens, and minted again (debounced) when the toggle or a non-empty name changes. The preview updates at once, with a cross-fade of 150ms or less.
- Share stays disabled until the link exists. If minting takes 1 second or more, a small spinner appears on the URL row and the caption "Making your link…" appears under Share. Under 1 second, nothing is shown.
- Once the link exists, a Share tap opens the system share sheet at once, with no network wait.
- Desktop "Copy link": the label changes to "Link copied" for 18 seconds, with no countdown shown. The URL row keeps a tick and the word "Copied" until the link changes.
- Mobile URL-row "Copy link": the URL row shows the same tick and "Copied" until the link changes, and the polite status "Link copied" is announced.
- In a mobile browser without system sharing, "Copy link" is the primary button and Share is not drawn.
- A cancelled share sheet, or one with no targets, returns to ready with the neutral status "Link ready. Share it again or copy it." and "Copy link" visible. No error glyph.
- Rate limited: Share and Copy link stay disabled, and the caption under Share repeats "Try again in a minute." After 60 seconds a "Try again" text button (44px) appears. There is no countdown.
- Escape, browser Back, Close and Cancel all close the sheet.
- The sheet slides in within 300ms. With Reduce Motion, it fades instead. No haptics on web.

FOUNDATIONS COMPONENTS USED: TextActionRow (the host entry, with the minting, copied, cancelled and offline states) · ScaleStrip (05-og-column inside the preview) · AqiBand · ProvenanceMark (28px, word printed) · SourceCaption (the dated sources line) · InlineErrorRow · OfflineNotice.

ACCESSIBILITY: Reading order: Close, title, made-from line, preview image, title line, description line, privacy line, toggle, name field, URL row, Share, Cancel.
The image's text alternative uses the full approved strings: "Card preview: a place in Camas, WA. Flood zone X, minimal flood hazard, official. Wildfire hazard potential moderate, 3 of 5, official. Air on Monday 19 October, AQI 42, Good, official. Radon zone 1, highest potential, county-wide, official. Yours?" With the name on, it starts "Jordan, Camas, WA". A street-matched flood row reads "on record, not confirmed".
The sheet has a unique title and traps focus. On close, focus returns to the control that opened it ("Compare with a friend" or "Send yours back"). "Link copied", "Making your link…", the errors, the rate-limit caption and the cancelled status are polite status messages. Targets are 44px with 8px gaps. The toggle shows its state by position and the words On and Off, never by colour alone. At 200% text the sheet scrolls, text wraps, and the preview stays full width. Selection looks different from focus.

COPY: The strings in CONTENT, plus:
- Mint error: "We couldn't make your link. Check your connection, then try again." with a "Try again" button. After a mint error, the caption under the disabled Share reads "Share needs a link first."
- Rate limit: "Lots of requests from this network in the last minute. Try again in a minute." with the caption "Try again in a minute." and, after 60 seconds, "Try again".
- Offline: "You're offline. Compare needs a connection."
- Minting caption: "Making your link…"
- Status: "Link copied"; URL-row state "Copied".

EDGE CASES:
- A sender line longer than the column wraps to two 40px lines inside the image, as described in LAYOUT. The longest headline wraps in the description line and never breaks mid-word.
- With the worst case, the sheet may scroll on mobile, but the privacy line stays above the buttons.
- Name toggle on, field empty: the card stays anonymous and the link is not re-minted.
- Signed-in and signed-out viewers see the same sheet.
- Slow network: the spinner stays on the URL row and the preview is never blanked.
- Rate limited: a neutral clock glyph, with no error styling; actions disabled as in INTERACTION.
- Offline: the preview still renders from the loaded preview, and Share and Copy link are disabled with the reason shown.
- Unverified seeded headline: the description line starts at "Readings:".

INSTEAD OF
- Instead of putting the privacy line after the button, place it directly under the preview — because consent read after the link exists is retroactive.
- Instead of minting on the Share tap, pre-mint when the sheet opens — because the browser only allows sharing straight from a tap.
- Instead of a red "Share failed" after a cancel, return to ready with Copy link visible — because a cancel and "no targets" look the same to the browser.
- Instead of turning the name toggle on by default, leave it off — because the card is anonymous unless the person chooses otherwise.
- Instead of a headline and captions inside the image, put the headline and its source in the description line — because text-heavy share images are unreadable at bubble size.
- Instead of "Air today" on the card, write "Air on Mon 19 Oct" — because the friend opens it days later.
- Instead of a second share link under the aha, keep "Share this address" in the footer and only compare in the row — because stacked share links compete with the save action.
- Instead of a generic error for rate limiting, give it its own wording with a time — because the person did nothing wrong.

DONE WHEN: The person reads what the card shows before anything is sent. The preview matches the real unfurl string for string, with no address and every fact sourced and dated. No image line overflows its column. A hollow row is never covered by an "Official" sources line. Share opens with no wait. A cancel reads as neutral. The reciprocal variant makes clear which address the card is made from, and that address never appears on the card. Every frame reads in greyscale.

ARTBOARDS
1. f8-compare-sheet · web-390 · 01-idle · light — pre-minted anonymous card with short-form rows, toggle off, Share and Cancel. In the gutter, a crop of the host row "Compare with a friend" with its caption.
2. f8-compare-sheet · web-390 · 02-name-shown · light — toggle On, "Jordan" typed, sender line "Jordan · Camas, WA", title line updated.
3. f8-compare-sheet · web-390 · 03-minting · light — spinner on the URL row, Share disabled, "Making your link…".
4. f8-compare-sheet · web-390 · 04-share-sheet-open · light — the system share sheet over the dimmed sheet.
5. f8-compare-sheet · web-390 · 05-reciprocal-send-yours-back · light — "Send yours back", the typed-address made-from line, toggle off, "Send my card".
6. f8-compare-sheet · web-1440 · 06-desktop-idle · light — the centred 480 modal over /start, with "Copy link" and "Cancel".
7. f8-compare-sheet · web-1440 · 07-copied · light — "Link copied" and the URL row showing "Copied"; in the gutter, the mobile URL-row Copied state.
8. f8-compare-sheet · web-390 · 08-share-cancelled · light — the neutral ready status with Copy link visible.
9. f8-compare-sheet · web-390 · 09-no-system-share · light — "Copy link" as the primary and no Share.
10. f8-compare-sheet · web-390 · 10-mint-error · light — the inline error with Try again, the preview kept, and "Share needs a link first."
11. f8-compare-sheet · web-390 · 11-rate-limited · light — the clock glyph, its own copy, Share and Copy link disabled with "Try again in a minute."; in the gutter, the after-60-seconds "Try again" button.
12. f8-compare-sheet · web-390 · 12-offline · light — the preview shown, actions disabled with the reason.
13. f8-compare-sheet · web-390 · 13-worst-case · light — the 24-character name wrapping to two lines in the image, the tax headline with its source in the description, an inline error, and a hollow street-matched flood row with "On record, not confirmed" and the split sources line; the image height budget in the gutter.
14. f8-compare-sheet · web-390 · 14-200pct · light — frame 1 at 200% text, scrolling.
15. f8-compare-sheet · web-390 · 15-greyscale · light — frame 2 in greyscale.
16. f8-compare-sheet · web-390 · 16-idle · dark — the dark twin of 1. The image inside stays in the light palette, because the share card is light only.
17. f8-compare-sheet · web-390 · 17-mint-error · dark — the dark twin of 10.
18. f8-compare-sheet · Notes — list:
- Assumption: Jordan is the sender because Dana is the fixture sender whose card he received. Frames 1–4 and 6–15 show him sending his own card to a different friend; frame 5 is the reciprocal step. flow-05 uses Maya as the first sender.
- Assumption: Sat 19 Dec is an example expiry, because the token lifetime is a product decision.
- Assumption: the WA voter-deadline row and the Clark County tax row are verified; otherwise the description starts at "Readings:".
- The preview uses the 05-og-column recipe, not V5 compare, because the preview is the unfurled image; the Foundations 00b in-context line ("f8-compare-sheet → V5 compare at 390") should be corrected.
- The share-card short forms and the 720px column widening need sign-off in the contract (they match f8-scale-strips); "Air on Mon 19 Oct" keeps "on" to match the frozen row-name pattern.
- Deviation: "On record, not confirmed" and the sources line are set at 28px, below the recipe's 40px minimum for value text.
- The secondary button is "Cancel", not "Not now", because this sheet is opened by the person and is not an ask.
- The web footer keeps Share. Compare lives only under the aha.
- A map of the city-only precision was rejected, because a region centred on the home gives the home away. Words carry the precision instead.
- The anonymous and named sender and title pairs, which the share card and the arrival page must reuse.
- Engineering handoff: each Share or Copy link tap fires t0_share_clicked with meta.method 'compare', once per tap, whatever the share sheet's outcome.
- The rate limit is the per-network budget shared with address lookups, so the copy says "requests", not "links".
- The token needs a confidence field, or unverified layers must be dropped. Street-matched layers show hollow.
- Unverified seeded headlines are left off the token.
- Every invented string: made-from lines, host caption, description line, worst-case tax headline and source lines, "Works for 61 more days", status, rate-limit and error copy, worst-case name, the split hollow sources line.
- Any omitted states.

BATCH PLAN: Turn 1: 1-6, then wait for "continue". Turn 2: 7-12, then wait for "continue". Turn 3: 13-18.
