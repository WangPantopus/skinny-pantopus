# Compare arrival header on /start
id: f8-compare-arrival-header · platforms: web · isNew: False · artboards: 19

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Compare arrival header on /start · f8-compare-arrival-header

TYPE: EXTENSION of the existing designed screen "/start funnel — hero step". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.
Keep: the top bar (lockup and region pill), the H1 "See what's true about your address.", the lede, the address field and button, the privacy proof line, and the two secondary links under the hero. This step has no WallBar, so draw none.
Change:
- Add a compare block for visitors who arrive from a friend's link.
- On a compare arrival, Dana's card replaces the "Example" readings card that sits in the hero at desktop widths. Never show both.
- The field and button move inside the compare block's "Your place" column.
- The contrast line moves below the address field.

ATTACH: (1) The /start hero step, signed out, at 390 and at 1440 (the 1440 frame shows the Example readings card). (2) The same hero showing the "From the card in your mailbox" pill. (3) The /start top bar. (4) The Foundations frames ScaleStrip 03-compare and LandingBannerSlot V5 Expired compare link.

PLATFORMS & VIEWPORTS: Web only. The main case is 390x844, because nearly every compare link is opened on a phone from a chat app. Also draw 1440x900. The compare block changes layout at 640px wide: below 640, Dana's card collapses to one line; at 640 and wider, it shows two equal columns.

WHERE IT LIVES & HOW PEOPLE ARRIVE: This page sits outside the four tabs. /start is the signed-out entry page that comes before Place · Today · Nearby · Mail. People arrive by:
(a) tapping the unfurled compare card in iMessage, WhatsApp, Slack or SMS;
(b) a link in an email or DM;
(c) a pasted or typed link.
All three open https://pantopus.com/start?vs=<token>.
(d) https://pantopus.com/start?vs=<token>&address=<address> submits on its own, skips this header and lands on the compare reveal.
The previous step, the compare share card, hands over only what the token holds: an optional first name, a city, four readings frozen on the day the card was made, a headline of 90 characters or fewer (picked on that day), and an expiry date. The token holds no address and no coordinates. The next step is the compare reveal. It receives the typed address and keeps Dana's rows in the same order and wording. If the Pantopus app is installed, the link still opens this web page.

WHO AND WHEN: Jordan Lee, 36, moved from Portland to PLACE B (1107 NE Birchfield Ct, Camas) on Fri 9 Oct. It is Mon 19 Oct, 6:10 PM, and he is on the bus home. Dana (FRIEND C) texts him her compare card, made Sat 12 Sep. He saved PLACE B on his laptop but is not signed in on his phone's browser.

THE ONE JOB: Show a stranger what is on record where their friend lives, and leave their own address field as the only obvious next move.

FIRST FIVE SECONDS:
1. The H1, then Dana's line just below the lede.
2. The focused, empty field under "Your place".
3. "See your place", the single primary action.

CONTENT: Use the FIXTURES for Dana's card. Deltas for this surface:
- Sender line: "Dana · Camas, WA". Subline: "What's on record for this area". Freshness line: "Dana's card · as of Sat 12 Sep". Legend: "● Official".
- Expanded rows, always in this order (label · value · caption):
  - "Flood zone" · "Zone X — minimal flood hazard" · "FEMA · area zone · effective Fri 24 Sep 2021"
  - "Wildfire hazard potential" · "Moderate · 3 of 5" · "USFS · quarter-mile area · 2023"
  - "Air quality index (AQI)" · "AQI 42 · Good · on Sat 12 Sep" · "AirNow · on Sat 12 Sep"
  - "Radon zone" · "Zone 1 — highest potential (county)" · "EPA · county-wide estimate — only a test tells you about this home"
  - All four rows are official, so each gets a filled mark.
- Headline block: Dana's token carries the headline the default ranking picked on Sat 12 Sep, the radon one: "Clark County is in EPA radon Zone 1 — highest potential. Only a home test can tell." Caption: "● EPA · county-wide estimate · as of Sat 12 Sep" (filled, because the EPA zone is official). The voter headline cannot appear on this card: the seasonal voter headline is picked only for cards made on or after Sun 20 Sep and within 30 days of the deadline.
- Voter-headline specimen (a card made Mon 5 Oct, drawn only on artboard 14): "Online or mail voter registration for Nov 3 must arrive by Mon 26 Oct in Washington." with the caption line "in 7 days · Mon 26 Oct", counted on the viewing day, and "○ On record, not confirmed · Washington Secretary of State". The mark is hollow because the deadline is a seeded row nobody has checked yet. From Tue 27 Oct it becomes "In person: until 8:00 PM Tue 3 Nov · Washington Secretary of State", with a hollow mark and "in 7 days · Tue 3 Nov".
- Collapsed line (below 640): "Dana · Camas, WA · Flood X · Wildfire Moderate · Air 42 on Sat 12 Sep · Radon Zone 1 ›". Short form: "Dana · Camas, WA · 4 readings ›".
- "Your place" column: heading "Your place", placeholder "Enter your address", button "See your place", privacy line "We don't post this anywhere. Nobody sees what you look up."
- Contrast line, below the field: "Nextdoor is what your neighbors say. Pantopus is what's on record about your address."
- Worst realistic case (57 characters of name and city): the sender is "Maximiliana-Josephine-Jo · Clarkston Heights-Vineland, WA". Wildfire "Very high · 5 of 5". Air "AQI 312 · Hazardous · on Sat 12 Sep" in the 301+ segment. Flood is the not-studied row: "FEMA hasn't mapped flood hazard here". Radon is the no-data row: "Not on record". The 90-character headline (the Jun 15 – Sep 30 air rule picks it): "Air on Sat 12 Sep: Hazardous, AQI 312. Air changes hour to hour; check AirNow for today.", with a filled mark and "AirNow · on Sat 12 Sep".

LAYOUT & VISUALIZATION:
- Use one order at every width: top bar, H1, lede (one line at 1440), the compare block, then the contrast line, then the two secondary links. The visual order and the reading order match.
- Collapsed, below 640px: the collapsed line, then the "Your place" heading, field, button and privacy line.
  - The collapsed line is one full-width row at least 44px tall. The whole row is the target, and it may wrap to two lines.
  - In this collapsed state at 390x844, the field, button and privacy line sit in the first viewport.
  - The collapsed line is plain text with no mark glyphs. Four dots in a row would read as a rating, and a mark only means something on its own track. The headline never appears in the collapsed line.
- Expanded, below 640px, in this order: the collapsed line (chevron turned), subline "What's on record for this area", freshness line "Dana's card · as of Sat 12 Sep", legend "● Official", the four ScaleStrip rows at compare size, each with its own SourceCaption, then the headline block with its mark and caption, then a repeated 44px text button "Hide readings", then the "Your place" heading, field, button and privacy line. The expanded rows push the field below the fold; the page scrolls. At 390, keep every row's caption, including the radon county-wide caveat and FEMA's "area zone". Use the merged line "Sources: FEMA, USFS, AirNow, EPA" only at 360 wide or narrower, or at 200% text.
- At 640px and wider: two equal columns of the same height.
  - Left column: Dana's card. Draw the sender line, subline, freshness line and legend, then the four ScaleStrip rows at compare size, each with its SourceCaption, then the headline block.
  - Right column: a framed "Your place" column on surface.base with a strong ink keyline. It holds only the heading, field, button and privacy line. Leave the rest of the column empty; the empty space is the invitation.
- In every ScaleStrip row on this surface:
  - Each track shows only that authority's own bands, with one marker in Dana's band.
  - The band name and number are printed as text.
  - Only the Air row uses AqiBand hues. The other three tracks are neutral.
  - A no-data row (worst-case radon) is a greyed track, no marker, "Not on record". A not-studied flood row (worst case) is a greyed track, no marker, "FEMA hasn't mapped flood hazard here". Both keep full row height.
- Arrival slot: this compare block follows the LandingBannerSlot precedence (invite > reissue > compare arrival > mailbox arrival), so the mailbox pill is hidden. The compare block sits under the lede, not in the pill position, and does not use pill geometry. Only the expired and couldn't-open banners use pill geometry, in the pill position above the H1.

INTERACTION, MOTION & HAPTICS:
- The field is focused on load. Draw the caret and focus ring. Typing is never blocked while the link is checked, and focus never moves when Dana's card arrives.
- When the field is tapped and the keyboard opens at 390, the page scrolls so the field and the first two suggestions stay visible above the keyboard (about 400px of visible page).
- Suggestions open under the field. Enter or "See your place" submits. On submit, the page cross-fades to the compare reveal in 300ms or less, and Dana's rows keep their order.
- The collapsed line and "Hide readings" open and close with a tap, Enter or Space. The chevron turns in 150ms. With Reduce Motion, the rows appear with no rotation or slide.
- On this surface, ScaleStrip rows and captions are flat text, not tap targets (see Overrides).
- In a banner, Close hides it and the layout below does not shift.
- No haptics (web).

FOUNDATIONS COMPONENTS USED:
- LandingBannerSlot: precedence only for the compare arrival; V5 Expired compare link, with pill geometry and the trailing "Close"; a couldn't-open banner in the same geometry with "Retry" (a contract addition).
- AddressChip: sender label variant, with no scope sentence (Foundations rule for someone else's place).
- ScaleStrip: compare size, V6 no data, V7 not studied, V9 frozen, V10 collapsed text line.
- AqiBand: instrument row.
- SourceCaption: dated static, frozen-token and county-scope variants; the collapsed sources line at 360 or narrower.
- ProvenanceMark: filled on the four rows and the radon headline; hollow on the voter specimen with its first-occurrence label; the legend.
- WarmingSkeleton: row skeleton (below 640) and instrument skeleton · scale strip (640 and wider).
- FreshnessLine.
- OfflineNotice: form variant.
- InlineErrorRow: no suggestions for the typed text.
- Overrides, to be recorded as contract updates:
  - V10 gains the air date ("Air 42 on Sat 12 Sep"), because a frozen reading must carry its date.
  - V9's per-caption "as of Sat 12 Sep 2026" is replaced by the single freshness line "Dana's card · as of Sat 12 Sep".
  - ScaleStrip rows on this header are not targets, because the readings are Dana's frozen card and there is no address to open a ProvenanceSheet for. Rows on the reveal stay targets.

ACCESSIBILITY:
- Reading order: top bar, H1, lede, the "Dana's card" region, "Your place", field, button, privacy line, contrast line, secondary links.
- The field's description reads "Compare with Dana's card from Camas, WA", so a screen reader landing on the autofocused field still hears the context.
- The collapsed row is a button with aria-expanded. Its name starts with the visible words: "Dana, Camas, WA: Flood X, Wildfire Moderate, Air 42 on Sat 12 Sep, Radon Zone 1. Dana's card as of Saturday 12 September. Show readings."
- Each expanded row is one element, spoken in this order: layer, value, position, scale ends, authority, date, provenance. Example: "Air quality index 42, Good, on 12 September, category 1 of 6. AirNow. Official."
- The headline block is spoken after the rows: headline, then authority and provenance.
- Targets are at least 44px, and the field is 48px tall.
- Text meets 4.5:1. The field keyline and separators meet 3:1.
- Every band is named in text, so greyscale loses nothing.
- At 200% text: use the short collapsed form. Rows stack their text above a full-width track, captions merge into the sources line, and nothing is truncated.
- Banners are role=status.

COPY (sentence case):
- "Your place" · "Enter your address" · "See your place"
- "We don't post this anywhere. Nobody sees what you look up."
- "Show readings" / "Hide readings"
- "What's on record for this area" · "Dana's card · as of Sat 12 Sep" · "● Official"
- "A place in Camas, WA" (when the card has no name)
- "That comparison link has expired. Type an address to see your own place." · "Close"
- "We couldn't open this card just now." · "Retry"
- "We couldn't find that address. Check the spelling, or enter it line by line." · "Enter it line by line"
- "You're offline. We can't look up an address right now."
- Signed in: "Open Today"

EDGE CASES:
- Worst case (above): the longest name and city, the largest AQI, a not-studied flood row, a no-data radon row and a 90-character headline. The collapsed line switches to its short form, "Maximiliana-Josephine-Jo · Clarkston Heights-Vineland, WA · 4 readings ›", wrapping to two lines.
- Typing: 5 suggestions open, with "1107 NE Birchfield Ct, Camas, WA 98607" first. The collapsed line stays visible above the field.
- No match: this header shows the InlineErrorRow only when autocomplete returns no suggestions for the typed text. It sits under the field with the line-by-line fallback, and Dana's card stays. A submitted address that then fails to geocode is handled on the compare reveal.
- Expired or tampered link: the V5 banner with Close sits in the pill position above the ordinary hero, and the compare block is gone. At 1440 the Example card returns. This is not an error page and not a modal.
- Couldn't check the link: the ordinary hero (with the Example card at desktop) and, in the pill position, a LandingBannerSlot-shaped banner "We couldn't open this card just now." · "Retry". No readings are shown at any width, and the field stays live. Dana's column is not drawn at 1440 in this state.
- Slow check (1 second or more): below 640, the collapsed line is one 44px surface.sunken bar (WarmingSkeleton row skeleton). At 640 and wider, Dana's column shows the WarmingSkeleton instrument skeleton · scale strip. The field is already live. Under 1 second, show nothing.
- Offline: the collapsed line stays. The OfflineNotice form variant (its sunken strip) sits above the field. The field and "See your place" are disabled and stay focusable, and each reads that strip's sentence as its reason. The sentence is printed once.
- A token row marked unconfirmed: that row shows a hollow mark, and the first one on the page carries the label "○ On record, not confirmed"; the legend adds it. If the token carries no confidence for a row, leave that row out rather than drawing it filled, and the collapsed line counts only the rows shown ("3 readings ›").
- No first name: "A place in Camas, WA".
- A card with the voter headline (made on or after Sun 20 Sep, within 30 days of the deadline): the caption line gives the relative count on the viewing day. From Tue 27 Oct, when the server holds the Washington row (the state is taken from "Camas, WA"), the in-person line replaces it. Hide the headline only when no such row exists, or after 8:00 PM Tue 3 Nov.
- A compare link and the mailbox pill both apply: show only the compare block.
- Signed in (Jordan on his laptop): add a text button "Open Today" at the right of the top bar, in place of the region pill. Nothing else changes.

INSTEAD OF:
- Instead of stacking Dana's full card above the H1 on a phone, draw the one-line text summary under the lede, above a focused field — because a stacked card pushes the field below the fold and kills the spread loop.
- Instead of four tiny markers in the collapsed line, draw words and numbers — because a row of dots reads as a rating and fails the non-colour rule.
- Instead of "Air today" on Dana's row, draw "AQI 42 · Good · on Sat 12 Sep" — because her reading is frozen, not today's.
- Instead of a hollow radon mark, draw it filled with a county-wide caption — because the EPA zone is official and its limit is its scope.
- Instead of merging captions into "Sources:" at 390, keep each row's caption — because the radon caveat must travel with the reading on the phone where the link is opened.
- Instead of a spinner while the link is checked, draw a live field beside a skeleton — because nothing should block typing.
- Instead of an error page for an expired or unreadable link, draw the quiet banner over the normal hero — because the visitor can still do the job.
- Instead of keeping the Example readings card beside Dana's card, replace it; instead of a map, street, photo or letter grade, draw the city and readings only — because two reading cards make the real one look like a sample, and the card promises never to reveal an address.

DONE WHEN:
- In the collapsed state at 390x844, the field, button and privacy line are in the first viewport. When the field is tapped and the keyboard opens, the page scrolls so the field and the first two suggestions stay visible above the keyboard.
- The visual order matches the reading order at 390 and 1440.
- The rows match the reveal and the share card in order and wording ("Air quality index (AQI)" · "AQI 42 · Good · on Sat 12 Sep"), and Dana's air row carries its date.
- Dana's headline is one her card could really carry on Sat 12 Sep.
- A stranger can tell in five seconds whose card it is, where it is, and what to type.
- The expired, offline, couldn't-open and signed-in states each keep the page usable, and no reading is shown from an unchecked link.
- Nothing states or implies anything about Dana's house.

ARTBOARDS:
1. f8-compare-arrival-header · web-390 · 01-collapsed-named · light — the dense default: H1, lede, the collapsed line above the focused, empty field.
2. f8-compare-arrival-header · web-390 · 02-expanded · light — a tall scrolling frame with the 844px fold marked: subline, freshness line, legend, four rows with captions, the radon headline block, "Hide readings", then the field.
3. f8-compare-arrival-header · web-1440 · 03-two-columns-named · light — H1 and lede, then Dana's column (with headline) next to the empty "Your place" column; no Example card.
4. f8-compare-arrival-header · web-390 · 04-typing-suggestions · light — the keyboard drawn, a 400px visible area marked, the field and first two of 5 suggestions above it.
5. f8-compare-arrival-header · web-390 · 05-anonymous · light — "A place in Camas, WA".
6. f8-compare-arrival-header · web-390 · 06-verifying · light — the 44px row skeleton, with the field live.
7. f8-compare-arrival-header · web-390 · 07-expired · light — the V5 banner with Close above the ordinary hero.
8. f8-compare-arrival-header · web-1440 · 07b-expired · light — the V5 banner above the ordinary hero with the Example card.
9. f8-compare-arrival-header · web-390 · 08-offline · light — collapsed line kept, the OfflineNotice strip above the disabled field and button.
10. f8-compare-arrival-header · web-390 · 09-couldnt-open · light — the ordinary hero with "We couldn't open this card just now." · Retry, no readings, field live.
11. f8-compare-arrival-header · web-1440 · 10-signed-in · light — "Open Today" at the right of the top bar in place of the region pill.
12. f8-compare-arrival-header · web-390 · 11-no-match · light — the InlineErrorRow and the line-by-line fallback.
13. f8-compare-arrival-header · web-390 · 12-worst-case · light — the worst case, expanded, tall frame, with the not-studied and no-data rows and the 90-character air headline.
14. f8-compare-arrival-header · web-390 · 12b-voter-headline · light — specimen card made Mon 5 Oct: the headline block alone, viewed Mon 19 Oct and Tue 27 Oct, side by side.
15. f8-compare-arrival-header · web-390 · 13-text-200 · light — 200% text, short collapsed form, expanded rows with the merged sources line.
16. f8-compare-arrival-header · web-390 · 14-greyscale · light — frame 2 in greyscale.
17. f8-compare-arrival-header · web-390 · 01-collapsed-named · dark — dark twin of frame 1.
18. f8-compare-arrival-header · web-1440 · 03-two-columns-named · dark — dark twin of frame 3.
19. f8-compare-arrival-header · Notes — list every invented string: the worst-case name, city and headline, the radon headline wording, the voter specimen card date (Mon 5 Oct), the four other suggestions, the couldn't-open and no-match lines, "Open Today", "Hide readings", and the field description. Also record:
    - Headline rule: the token headline is picked on the day the card is made. The voter headline appears only on cards made Sun 20 Sep or later within 30 days of the deadline; Dana's Sat 12 Sep card carries the default ranking's radon headline (assumed to outrank her other layers).
    - The voter headline rewords the doc's "Voter registration for November 3 closes {date} in {state}." to "must arrive by" (house style and the Secretary of State's rule). The doc's follow-up "Moved recently? Registration is per address." is dropped here because the token holds only 90 characters.
    - After Mon 26 Oct the headline switches to the in-person line from the server's state row instead of hiding. Token-schema question: confirm the server can look up the state row from the token's city.
    - The worst-case name is 24 characters, the assumed first-name limit for the compare sheet; the city is a real Washington place name, giving 57 characters.
    - The inventory's "Save this address" in the hero header was deliberately replaced by "Open Today": on the hero there is nothing to save yet. "Save this address" appears on the compare reveal. Where it leads for a signed-in visitor is an open product question.
    - Foundations 00a-08 puts "Only you will see this." under the recipient's field; here the existing privacy proof line fills that role. Confirm.
    - Deviation: the compare block uses LandingBannerSlot precedence but sits under the lede, not in the pill position.
    - Contract updates: V10 gains the air date; V9's per-caption as-of is replaced by one freshness line; rows on this header are not targets; a couldn't-open banner joins LandingBannerSlot.
    - Engineering note: the token is verified during the server render, and readings are never drawn from an unverified token.
    - Token schema: the token must carry, for each layer, the band index, the printed value, the air observation date, the source dates and a confidence field. The doc's letter keys (flood A, wildfire C, air B, radon D) cannot produce these rows. Rows without confidence are left out.
    - Seeded deadlines are hollow, per research (trust topic).
    - A native app never intercepts this link.
    - The flows spec still shows Maya; this project uses the Dana fixture.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: artboards 7-12, then wait for "continue". Turn 3: artboards 13-18, then wait for "continue". Turn 4: artboard 19.
