# Compare share card (OG image)
id: f8-og-compare-card · platforms: web · isNew: False · artboards: 12

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Compare share card (Open Graph image and unfurl) · f8-og-compare-card

TYPE: EXTENSION of the existing designed screen "Place OG share card (single address)". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. The change is a two-column compare variant for links that carry a compare token, plus the text metadata that unfurls with it.

ATTACH: (1) The existing single-address OG card at 1200x630. (2) The generic card shown when a link has no address. (3) The Foundations frames ScaleStrip 05-og-column, AqiBand and ProvenanceMark. (4) One real iMessage unfurl screenshot, light and dark, for the bubble geometry.

PLATFORMS & VIEWPORTS:
- Web only. The image is a server-rendered PNG at 1200x630 (1.91:1), in the LIGHT palette only, because the image has no theme.
- The PNG uses one embedded sans, Roboto (the web stack's fallback), not system-ui. Draw and measure every line in Roboto.
- Artboard platform labels: "web-1440" means the 1200x630 canvas; "web-390" means a 400x210 crop or a 360px-wide Slack message; "ios" means an iMessage thread on 393x852.
- Dark mode is checked only by placing the light image inside a dark messaging thread.

WHERE IT LIVES & HOW PEOPLE ARRIVE:
- Outside the four tabs. It is the unfurl for https://pantopus.com/start?vs=<token>.
- The previous step is the Compare with a friend sheet: Dana saw this exact card as a live preview, tapped Share, and the system share sheet sent the link. The card may appear in iMessage, WhatsApp, Slack, X, Facebook or a group chat, or be fetched directly from its image URL.
- The card is built only from the token: optional first name, city, four readings frozen on the day it was made, a headline of 90 characters or fewer picked on that day, and an expiry date. It never uses a live lookup, because a slow lookup would make the unfurl show no image at all.
- Tapping the card opens the compare arrival header, where the rows appear in the same order and wording.

WHO AND WHEN: Mon 19 Oct, 6:10 PM. Jordan Lee (new at PLACE B), on the bus, sees Dana's link (FRIEND C, card made Sat 12 Sep) arrive in iMessage. He saved PLACE B on his laptop last week but has never seen a compare card; the bubble is all he reads before tapping. Later that evening, Dana receives Jordan's reciprocal card, which has no name.

THE ONE JOB: Make a stranger's first sight of Pantopus a readable, honest preview of a friend's area that makes "Yours?" the obvious next question.

FIRST FIVE SECONDS: In the bubble, the eye lands on:
1. The sender line "Dana · Camas, WA".
2. The "Yours?" card.
3. The title line under the image, "What's on record at Dana's place. Yours?".
The single action is tapping the card.

CONTENT: Use the FIXTURE readings. Inside the image, show only:
- Header row: "Dana · Camas, WA".
- Four rows, always in this order, each one text line (layer word · value) above its track. The values match the Foundations V9 values used on the header and reveal; only the layer word is shortened.
  - "Flood · Zone X — minimal flood hazard" (measured 688px)
  - "Wildfire · Moderate · 3 of 5" (473px)
  - "Air · AQI 42 · Good · on Sat 12 Sep" (602px)
  - "Radon · Zone 1 — highest potential (county)" (778px, wraps to two lines)
- One sources line: "● Official · FEMA Sep 2021 · USFS 2023 · AirNow Sat 12 Sep · EPA county-wide" (967px at 28px).
- The "Yours?" card: the existing lockup, a large "Yours?", an address-field-shaped slot reading "Your address", and "pantopus.com" at the foot.

Metadata (draw it as text beside the canvas):
- og:title: "What's on record at Dana's place. Yours?"
- og:description: "Clark County is in EPA radon Zone 1 — highest potential. Only a home test can tell. (EPA · county-wide estimate) Readings: FEMA area zone (effective Fri 24 Sep 2021), USFS quarter-mile area (2023), AirNow on Sat 12 Sep, EPA county-wide estimate. Nextdoor is what your neighbors say. Pantopus is what's on record about your address." The headline is the one the default ranking picked on Sat 12 Sep; a Sat 12 Sep card cannot carry the voter headline.
- og:image:alt: "Dana · Camas, WA, as of Sat 12 Sep 2026. Official readings: flood Zone X, minimal flood hazard, FEMA; wildfire hazard Moderate, 3 of 5, USFS; air quality index 42, Good, on Sat 12 Sep, AirNow; radon Zone 1, highest potential, county-wide, EPA. Next to it: Yours?"
- og:site_name "Pantopus" · og:image:width 1200 · og:image:height 630 · a versioned image URL.

Reciprocal card from Jordan (no name, made Mon 19 Oct):
- Header row: "A place in Camas, WA".
- Rows: "Flood · Zone AE — 1% chance each year" (703px) · "Wildfire · Low · 2 of 5" · "Air · AQI 58 · Moderate · on Mon 19 Oct" (693px) · Radon unchanged (wraps).
- Sources line: "● Official · FEMA Sep 2021 · USFS 2023 · AirNow Mon 19 Oct · EPA county-wide".
- og:title: "What's on record at a place in Camas, WA. Yours?"
- og:description: "Online or mail voter registration for Nov 3 must arrive by Mon 26 Oct in Washington (Washington Secretary of State · on record, not confirmed). Readings: FEMA area zone (effective Fri 24 Sep 2021), USFS quarter-mile area (2023), AirNow on Mon 19 Oct, EPA county-wide estimate. Nextdoor is what your neighbors say. Pantopus is what's on record about your address." This matches the aha the reveal shows Jordan: in October the seasonal ranking picks the voter headline (7 days out).
- og:image:alt: "Readings for a place in Camas, WA, as of Mon 19 Oct 2026. Official readings: flood Zone AE, 1% chance each year, FEMA; wildfire hazard Low, 2 of 5, USFS; air quality index 58, Moderate, on Mon 19 Oct, AirNow; radon Zone 1, highest potential, county-wide, EPA. Next to it: Yours?"

Worst realistic case:
- Header row: "Maximiliana-Josephine-Jo · Clarkston Heights-Vineland, WA" (a 24-character name; 1069px, one line).
- Air: "Air · AQI 312 · Hazardous · on Sat 12 Sep" (723px), in the 301+ segment.
- Radon: "Radon · Not on record".
- Headline (90 characters, metadata only): "Air on Sat 12 Sep: Hazardous, AQI 312. Air changes hour to hour; check AirNow for today."

LAYOUT & VISUALIZATION: Follow the ScaleStrip 05-og-column recipe: 16px padding on every side, 40px type on 48px lines, rows of 8px top · one 48px text line · 8px gap · a 40px track zone holding a 30px track · 8px bottom (112px), the OG capsule marker, and one 28px sources line carrying the ProvenanceMark and the word "Official". Print no per-track "● Official", no band names under tracks and no per-row captions.
Recorded deviations:
(a) The header row spans the full 1168px width, so a 24-character name and a long city stay on one line.
(b) Below it, the instrument column is 760px wide on the left. A 32px gutter separates it from the "Yours?" card, 376px wide (filled primary.50, ink keyline, "Yours?" at 72px), on the right. The card runs from under the header row to the bottom of the last row.
(c) The recipe's 24px gap before the sources line is removed; with it, the fixture card would be 644px.
(d) One row may take two text lines, making it 160px tall.
Measure and print: in the gutter of frames 1, 3 and 4, print each value line's measured Roboto width and the height budget.
- Frame 1 (only radon wraps): 16 + 48 header + 8 + 3 × 112 + 160 + 36 sources + 16 = 620 ≤ 630.
- Frame 3 (only radon wraps at the measured 703px flood line): 620 ≤ 630. If your measurement puts a second row over 760px, apply the overflow rule.
- Frame 4 (no row wraps): 16 + 48 + 8 + 4 × 112 + 36 + 16 = 572 ≤ 630.
Overflow rule: if a second row needs two lines, move the sources line into the foot of the "Yours?" card, where it takes up to 3 lines, and tighten the header gap to 4px: 16 + 48 + 4 + 2 × 112 + 2 × 160 + 16 = 628 ≤ 630. If a third row would wrap, shorten that row's value to its compact form ("Zone AE — 1% each year", 564px) rather than exceed 630. If a header row ever passes 1168px, it wraps and counts as one of the two wrapped rows.
Other rules:
- Type is a 40px font size, as the Foundations board records. "Yours?" is 72px, the largest type on the card. "Your address" and "pantopus.com" are 28px.
- Only the Air track uses AqiBand hues; the other three stay neutral.
- A no-data row is a greyed track with no marker and the text "Not on record", at full row height.
- The "Yours?" card is filled with the same visual weight as the instrument. The address slot is 64px tall with an ink keyline.
- Crops: every element sits at least 15px inside the top and bottom edges, so a 2:1 crop (1200x600) cuts nothing. The 400x210 thumbnail is the whole image scaled. A centred square crop (630x630, x 285–915) keeps the middle of the tracks and value lines but cuts the start of the sender line and most of "Yours?"; the og:title still carries the question.
- The image holds no headline, no contrast line and no per-row source captions. Those live in the metadata.
- Body text in the image meets 4.5:1 against its background.

INTERACTION, MOTION & HAPTICS: The image is static: no animation, no hover state, no haptics. The whole unfurl is one tap target, controlled by the messaging app. The image URL is served from cache for up to an hour, because the token never changes. A redesigned card gets a new versioned URL.

FOUNDATIONS COMPONENTS USED:
- ScaleStrip: the 05-og-column recipe with the deviations above; V6 no data; V9 frozen values with dates.
- AqiBand: instrument row, including the 301+ segment.
- ProvenanceMark: filled, 28px, with "Official" printed beside it in the sources line; hollow, 28px, with "On record, not confirmed" printed beside it on an unconfirmed row.
- SourceCaption: the merged sources line at OG size, per authority with its own date or scope; full captions go in og:description.
- AddressChip: sender label variant.

ACCESSIBILITY:
- og:image:alt describes what the image shows, carries every reading in words, and never an address.
- The title line carries the question, so the image never has to.
- Band names are printed, so greyscale and colour-blind viewing lose nothing.
- At iOS AX5, the bubble's title line wraps without cutting "Yours?".
- Markers and separators meet 3:1.

COPY: All strings in CONTENT, in sentence case. "Nextdoor" appears only as plain text in og:description, never with its logo, colours or wordmark.

EDGE CASES:
- No token (no vs): the existing card, byte-identical to today (the single-address card when an address is present, the generic card otherwise).
- Expired or tampered token: fall back to the existing card — the single-address card if the link has an address, otherwise the generic card with og:title "See what's true about your address." Never an error image, a broken-image glyph or a bare logo.
- No first name: "A place in Camas, WA".
- A headline over 90 characters (older token): the image is unchanged; og:description is cut at the end of a sentence, never with an ellipsis in the middle of a deadline.
- Narrow Slack (about 360px wide) and the 400px thumbnail: the header row, the four band words and "Yours?" stay legible.
- Largest numbers: AQI 312 sits in the 301+ segment and reads "Hazardous" on one line within the 760px column.
- Long first name: the header row holds a 24-character first name (the assumed compare-sheet limit) plus a long city on one line. Never ellipsize a first name.
- An unconfirmed layer in the token: that row prints "○ On record, not confirmed" after its value (the 28px hollow mark plus the words), counts as a wrapped row in the budget, and the sources line keeps "● Official" for the rest. If the token has no confidence for a layer, leave that layer off the card; the image draws three rows.
- Civic headline: a seeded, unchecked headline appears only in og:description, followed by "(Washington Secretary of State · on record, not confirmed)"; a checked one drops "on record, not confirmed". The voter headline is only on cards made Sun 20 Sep or later within 30 days of the deadline. If the online or mail deadline (Mon 26 Oct) has passed when the card is fetched, og:description replaces it with "In person: until 8:00 PM Tue 3 Nov (Washington Secretary of State · on record, not confirmed)." when the server holds the state row, and leaves it out otherwise.

INSTEAD OF:
- Instead of four authority captions, a long headline and a contrast footer baked into the PNG, draw only layer words, values, the track, one sources line, the header row and "Yours?" at large sizes — because text in preview images becomes unreadable at bubble size.
- Instead of "Air today" / "AirNow, today", draw "Air · AQI 42 · Good · on Sat 12 Sep" — because the reading was frozen when the card was made.
- Instead of "Zone 1 — highest" with a hollow mark, draw "Zone 1 — highest potential (county)" under the filled Official mark — because EPA's zone is official, and "highest" next to a name reads as a verdict on a home.
- Instead of letter grades, a shared ranking or a radar chart, draw four separate tracks — because four authorities don't add up to a score.
- Instead of an outlined, empty "Yours?" box, draw a filled prompt card — because an outline looks like a failed render in a chat.
- Instead of an error image for a bad token, draw the existing fallback card — because a stranger's group chat is where the product can least afford to look broken.
- Instead of one "as of" after all four sources, give each authority its own date or scope — because FEMA 2021 and USFS 2023 were not published on Sat 12 Sep.
- Instead of any address, map, pin or house photo, show the city and readings only — because the card promises never to reveal an address.

DONE WHEN:
- In an iMessage bubble, Jordan can read whose card it is, the four band words, and "Yours?".
- The title line asks the question.
- The rows match the sheet preview, the arrival header and the reveal in order and value wording.
- Frames 1, 3 and 4 each print their measured Roboto widths and a height budget of at most 630, with no text below 40px except the recorded 28px lines.
- Each headline in og:description is one its card could carry on the day it was made.
- A bad token still unfurls cleanly.
- Every reading has a source and a date or scope.

ARTBOARDS:
1. f8-og-compare-card · web-1440 · 01-valid-named · light — the dense default: the 1200x630 canvas with widths and the 620 budget in the gutter, and its metadata beside it.
2. f8-og-compare-card · ios · 02-imessage-bubble · light — frame 1 in a light iMessage thread, with the title line.
3. f8-og-compare-card · web-1440 · 03-valid-anonymous · light — Jordan's reciprocal card, with widths, budget and metadata.
4. f8-og-compare-card · web-1440 · 04-worst-case · light — the long name, AQI 312, radon "Not on record", the 572 budget, and the 90-character headline in the metadata.
5. f8-og-compare-card · web-1440 · 05-fallbacks · light — the generic card (with its og:title) and the existing single-address card, side by side, both unchanged.
6. f8-og-compare-card · web-390 · 06-crop-400 · light — frame 1 at 400x210, plus its 1200x600 crop outline and the 630x630 centre-crop outline (x 285–915), captioned with what survives.
7. f8-og-compare-card · web-390 · 07-slack-360 · light — a narrow Slack unfurl.
8. f8-og-compare-card · ios · 08-imessage-ax5 · light — the bubble at AX5 text size.
9. f8-og-compare-card · web-1440 · 09-greyscale · light — frame 1 in greyscale.
10. f8-og-compare-card · ios · 10-thread-valid · dark — frame 1 in a dark thread; the image itself stays light.
11. f8-og-compare-card · ios · 11-thread-fallback · dark — the generic card from frame 5 in a dark thread.
12. f8-og-compare-card · Notes — list every invented string: all og:descriptions, all og:image:alt texts, the radon headline wording, the fallback og:title, the after-deadline in-person description, "Your address", and the worst-case name, city and headline. Also record:
    - Type size: the research asks for a 40px cap height (about 56px type). At that size the four rows cannot fit 630px, so this card uses the Foundations board's 40px font size. Contract question.
    - Font: the PNG is measured in Roboto. The 760px column is needed so that, in Roboto, only the radon line wraps on the fixture and reciprocal cards; a 640px column would wrap two or three rows and break 630.
    - Deviation: the recipe's 24px gap before the sources line is removed.
    - The OG rows use the layer word "Air" instead of the label "Air quality index (AQI)" as a deliberate compression; the value matches V9.
    - WhatsApp's square thumbnail may cut the sender line and "Yours?"; the og:title carries the question.
    - First-name limit 24 characters (assumed), for the compare sheet to confirm.
    - Headline rule for the batch: every token headline is picked on the day the card is made, by the doc's seasonal ranking. Dana's Sat 12 Sep card gets the default radon headline; Jordan's Mon 19 Oct card gets the voter headline, which matches his reveal aha.
    - Unconfirmed layers print the hollow mark with words, and layers without confidence are left off.
    - The reciprocal flood line "Zone AE — 1% chance each year" is the short OG form of the approved string; the full string ("about 1 in 4 over 30 years") lives on the reveal.
    - Token schema: the token must carry, for each layer, the band index, the printed value, the air observation date, the source dates and a confidence field. The doc's letter keys cannot render "AQI 42", "Zone X" or the air date.
    - After Mon 26 Oct, og:description switches to the in-person line when the server holds the state row. Token-schema question.
    - Seeded deadlines are hollow, per research.
    - The design doc's og:title ("What's true about Maya's place. Yours?") is replaced by "What's on record at Dana's place. Yours?".
    - X and WhatsApp image size limits are unverified.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: artboards 7-12.
