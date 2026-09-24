# Compare reveal (a third funnel step)
id: f8-compare-reveal · platforms: web · isNew: True · artboards: 20

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Compare reveal · f8-compare-reveal

TYPE: NEW. This is the third step of the /start funnel, which runs hero → compare reveal → preview. It has its own loading skeleton, its own error rules and its own place in the funnel. It is not a card on the hero. Below the compare block, the page reuses the existing designed /start preview as it is today, with one change: the WallBar button reads "Keep this address handy", with the line "Today and a night-before pickup reminder run on it." The WallBar's footer links stay.

ATTACH:
- The /start preview step at 390 and at 1440: PlaceHeader, the aha card, the money lead, the Band-A groups, the locked Band-B groups and the sticky WallBar.
- The legacy free-tiles preview.
- Frames 01 and 03 of the compare arrival header, from its own project.
- The Foundations frames ScaleStrip 01-anatomy and 03-compare, AqiBand, ProvenanceSheet and TextActionRow.

PLATFORMS & VIEWPORTS: Web only. The main frame is 390x844. Also draw 1440x900. The layout breakpoint is 768px.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Outside the four tabs, on the signed-out /start page that comes before Place · Today · Nearby · Mail. People reach it by:
- submitting an address from the compare arrival header, which passes Dana's server-verified token (first name, city, four frozen readings, headline, expiry) and the typed address;
- opening https://pantopus.com/start?vs=<token>&address=<address>, which submits on its own.
From here people go to:
- "Keep this address handy" in the WallBar: sign-up with the address carried over.
- "Send yours back": the Compare with a friend sheet in its reciprocal form. That card is made from the address Jordan just typed; his address still never appears on it.
- "Share this address": the system share sheet with a /start link that includes his address.
- Tapping a row: the ProvenanceSheet for that layer at Jordan's address.

WHO AND WHEN: Mon 19 Oct, 6:10 PM. Jordan Lee (new at PLACE B) typed 1107 NE Birchfield Ct, Camas into Dana's link on the bus. He is signed out in this browser, though he has an account from his laptop. Dana's card (FRIEND C) is as of Sat 12 Sep.

THE ONE JOB: Show Jordan's place and Dana's area on the same four scales, then hand him his own full preview.

FIRST FIVE SECONDS:
1. The summary line "Different band on flood and wildfire."
2. The Flood row, where the two pointers sit in different bands.
3. "Keep this address handy" in the WallBar, the single primary action.

CONTENT: Dana's rows use the FIXTURE readings, frozen. Specimen deltas for Jordan at PLACE B: Flood Zone AE · Wildfire Low · 2 of 5 · Air AQI 58 · Moderate, observed 5:00 PM today · Radon Zone 1.
From top to bottom:
- PlaceHeader: "1107 NE Birchfield Ct, Camas, WA 98607", with the text button "Change address" under it and "Sign in" at the right (signed out).
- Heading "Dana's card and your place".
- Legend: "▼ Dana · as of Sat 12 Sep" · "▲ You · today" · "● Official".
- Summary line: "Different band on flood and wildfire."
- "Flood zone", chip "Different band":
  - "Dana: Zone X — minimal flood hazard ●"
  - "You: Zone AE — 1% chance each year (about 1 in 4 over 30 years) ●"
  - Caption: "FEMA · area zone · effective Fri 24 Sep 2021"
- "Wildfire hazard potential", chip "Different band":
  - "Dana: Moderate · 3 of 5 ●"
  - "You: Low · 2 of 5 ●"
  - Caption: "USFS · quarter-mile area · 2023"
- "Air quality index (AQI)", no chip:
  - "Dana: AQI 42 · Good · on Sat 12 Sep ●"
  - "You: AQI 58 · Moderate · 5:00 PM today ●"
  - Note: "Different days. Air changes hour to hour."
  - Captions, one per line: "Dana: AirNow · on Sat 12 Sep" and "You: AirNow · nearest monitors · observed 5:00 PM today"
- "Radon zone", chip "Same band":
  - "Both: Zone 1 — highest potential (county) ●"
  - Caption: "EPA · county-wide estimate — only a test tells you about this home"
- Next step for the reading where Jordan's band is the more serious one: the outbound TextActionRow "What Zone AE means · FEMA ↗".
- A quiet divider.
- Jordan's aha. In October the doc's seasonal ranking picks the voter headline for a Washington address:
  - "Online or mail voter registration for Nov 3 must arrive by Mon 26 Oct in Washington."
  - "in 7 days · Mon 26 Oct"
  - Detail: "In person: until 8:00 PM Tue 3 Nov at your county elections office."
  - Hollow mark with the first-occurrence label: "○ On record, not confirmed · Washington Secretary of State"
  - Follow-up: "Moved recently? Registration is per address."
  - Outbound: "Check or update at VoteWA ↗"
- Two spread actions, each with its own caption:
  - "Send yours back" · "Your card shows readings and your city, never your address."
  - "Share this address" · "Shares a link to 1107 NE Birchfield Ct."
- Money lead:
  - "2026 assessed value $487,300 · Clark County Assessor"
  - "Property tax 2nd half · in 14 days · due Mon 2 Nov · Clark County Treasurer"
- Band-A groups, unchanged:
  - Garbage and recycling: "Pickup day: Thursday · City of Camas" with a hollow mark (the label was already spelled out on the aha); "How often: Not set".
  - Risk and readiness.
  - Civic and elections: "Online or mail voter registration for Nov 3 · in 7 days · must arrive by Mon 26 Oct" and "In person: until 8:00 PM Tue 3 Nov · Washington Secretary of State" (hollow mark).
- Locked Band-B groups, unchanged: Permits and history, Money and bills, Who's nearby.
- Sticky WallBar: "Keep this address handy", with "Today and a night-before pickup reminder run on it."

LAYOUT & VISUALIZATION:
- One comparison table, four rows, fixed order Flood · Wildfire · Air · Radon, the same order as the arrival header and share card. Never re-sort.
- Use ScaleStrip V5 compare with its Foundations row order. Each row, top to bottom:
  - The layer name, with the "Different band" or "Same band" chip right-aligned on that 24pt line. Different-band rows set the layer name in text.primary; same-band rows keep text.strong. The type size doesn't change.
  - The value lines, "Dana: …" then "You: …" (or one "Both: …"), each followed by its ProvenanceMark S.
  - The 60pt compare track zone: the "Dana" label, a downward pointer, the track, an upward pointer, the "You" label. Both pointers have the same form, size and ink. Filled vs hollow never tells Dana and You apart; it means provenance only.
  - The band names, 4pt below the track zone, per the Foundations rules (Flood and Radon print all; Wildfire prints the ends plus each occupied band; Air prints the six ranges). Both occupied names are set in captionMedium text.primary.
  - The SourceCaption.
- Same band: both pointers at one x position, one outline, the "Same band" chip, and one value line starting "Both:".
- Tracks use each authority's own bands: Flood 3; Wildfire 5; Air 6 AqiBand segments, the only coloured track, last segment labelled 301+; Radon 3, Zone 3 → Zone 1.
- The Air row never merges and never gets a chip, even when both readings fall in the same AQI band, because they come from different days. It always shows two dated pointers, two dated value lines and the "Different days" note.
- Nothing ranks one layer or place against another: no arrows, winners, versus badges or colour judgements.
- Dana's headline is not repeated here; the arrival header showed it.
- Below 768px, one column: table, next-step row, divider, aha, spread actions, then the preview.
- At 768px and wider:
  - The container is 1000px. The heading, legend and summary line span both columns above them.
  - Left column, 640px: the same table with wider tracks, pointers still overlaid on one track per row.
  - Right column, 328px, after a 32px gap with a quiet vertical rule: the next-step row, a quiet divider, Jordan's aha, the VoteWA link and the two spread actions.
  - The money lead and groups run full width below.
- The WallBar reserves scroll padding under the page content.

INTERACTION, MOTION & HAPTICS:
- Below 640px, the arrival header's collapsed line opens into the four tracks with Dana's pointers already placed; the "You" pointers fade in within 300ms. If the header was expanded, or at 640px and wider, Dana's pointers keep the positions the header showed. The page scrolls once to the table heading.
- Focus moves to the table heading, and a polite status message says "Your readings are ready."
- Reduce Motion: a single cross-fade.
- Each row is a 44px target that opens the ProvenanceSheet for that layer: a bottom sheet on mobile web, a 560px modal with a visible Close on desktop. For flood, the sheet reads "Only FEMA can change this" and includes the LOMA link. Outbound rows sit outside the table rows, so no link is nested inside a row target.
- "Change address" returns to the header with the typed address still filled in.
- No haptics (web).

FOUNDATIONS COMPONENTS USED:
- ScaleStrip: V5 compare with the "Different band" and "Same band" chips; V6 no data; V9 frozen.
- AqiBand: instrument row.
- ProvenanceMark: S beside each value line; the legend; the "○ On record, not confirmed" first-occurrence label on the aha.
- SourceCaption: frozen-token, live, dated-static and county-scope variants.
- WarmingSkeleton: instrument skeleton and section variant.
- InlineErrorRow · OfflineNotice · FreshnessLine · ProvenanceSheet.
- TextActionRow: "Send yours back", "Share this address", and the outbound rows (FEMA, VoteWA, Dept of Health).
- SlotMeter: wall-line replacement.
- AddressChip: duplicate variant, with the ScopeChip sentence "Only you will see this." 8pt below.
- LockedActionRow: unchanged in the Band-B groups.
- Overrides, to record as contract updates: the Air row never merges (the 03-compare specimen merges air); V9's per-caption as-of is replaced by the legend's "Dana · as of Sat 12 Sep"; the TextActionRow variant "Free test kits · Washington Dept of Health ↗" becomes "Get a free test kit · Washington Dept of Health ↗" (the 00b string).

ACCESSIBILITY:
- Reading order: PlaceHeader, heading, legend, summary line, the four rows, next-step row, divider, aha, actions, money lead, groups, WallBar.
- Legend glyphs are aria-hidden. The legend reads: "Dana's readings as of 12 September, above each track. Your readings today, below each track. Filled mark: official."
- Each row is one element. Example: "Flood zone, different band. Dana, as of 12 September: Zone X, minimal flood hazard, band 1 of 3, official. You, today: Zone AE, 1% chance each year, about 1 in 4 over 30 years, band 3 of 3, official. FEMA, effective 24 September 2021."
- A visually hidden table lists the same facts.
- Pointers are told apart by label and position (above or below), never by colour or fill.
- Targets are at least 44px. Text meets 4.5:1; pointers and separators meet 3:1.
- At 200% text, pointer labels and chips wrap onto their own lines; the value lines are already stacked; tracks stay full width.

COPY: All strings from CONTENT, plus:
- "Try again" · "Enter it line by line" · "See your place"
- "We couldn't find "1107 Birchfeld, Camas". Check the spelling, or enter it line by line."
- "We can't read records outside the US yet. Try a US address. Dana's card is still here."
- "Not on record here" · "Same band on flood, wildfire and radon."
- "You're offline · as of 6:10 PM" · "Saving needs a connection." · "Compare needs a connection."
- "3 Founding Neighbor slots are still open on this block." with "Closes Fri 6 Nov" and "A Founding Neighbor badge. You can still claim this address after it closes."
- "Claim this address and be one of the first here"
- "You already saved this as "1107 NE Birchfield Ct" · Use for Today" · "Only you will see this."
- "Save this address"
- "Get a free test kit · Washington Dept of Health ↗"

EDGE CASES:
- Loading (1 second or longer): Dana's pointers and value lines are drawn at once, because the token is already verified. The "You" pointers and value lines are skeletons. Below the divider, the WarmingSkeleton section variant fills the final slots of the aha, the money lead and the first group. At 768 and wider, the same skeleton fills both columns: the table on the left, the aha slot on the right. There is no WallBar until the reveal lands. Under 1 second, show nothing.
- Geocode failure (a submitted address that can't be placed; an autocomplete no-match is handled on the header): no PlaceHeader, no summary line, no divider and nothing below the table. Above the table, the InlineErrorRow sentence, then the address field pre-filled with "1107 Birchfeld, Camas" and focused, then "See your place" and the text button "Enter it line by line". Dana's pointers and value lines stay; the You lanes are empty and keep their height. No WallBar. The funnel does not reset.
- Unsupported region (Jordan typed "Vancouver, BC"): the same structure, with the unsupported-region sentence and the field pre-filled with "Vancouver, BC".
- A layer missing for Jordan (radon): the You value line reads "Not on record here", the lower pointer lane is greyed, there is no chip, and the row keeps its height.
- A Dana row her token marks unconfirmed: her value line carries a hollow mark and the page's first "○ On record, not confirmed" label. If her token has no confidence for a row, her lane is greyed with "Dana: Not on this card" and the row keeps its height.
- Same band on every static layer (both use the FIXTURE readings; Jordan's air is the specimen "AQI 42 · Good · 5:00 PM today"): the summary reads "Same band on flood, wildfire and radon." Air still shows two dated pointers.
- Largest numbers: Dana's AQI 312 (Hazardous, 301+) and wildfire "Very high · 5 of 5", against Jordan's AQI 58 and the specimen "Very low · 1 of 5". Labels don't collide, and there are still no arrows.
- Radon next step: when Jordan's radon zone is the more serious one (specimen: Dana Zone 2, You Zone 1), the next-step row reads "Get a free test kit · Washington Dept of Health ↗", in the right column at 768 and wider.
- Legacy fallback when the preview has no sections: the compare block stays intact, and the legacy free tiles replace everything below the divider.
- Offline after the reveal: the table stays readable under "You're offline · as of 6:10 PM". The WallBar button ("Saving needs a connection.") and "Send yours back" ("Compare needs a connection.") are disabled, stay focusable and read their reasons. "Share this address" stays enabled, because its link is built on the device.
- Signed in, not yet saved: "Save this address" replaces "Sign in" in PlaceHeader and there is no WallBar. It leads to the save confirmation (assumed; see Notes).
- Signed in, PLACE B already saved: the AddressChip duplicate row shows instead, with "Only you will see this." under it.
- Founding open: when Jordan's own block has Founding slots open (whoever sent the link), the SlotMeter wall line "3 Founding Neighbor slots are still open on this block." with "Closes Fri 6 Nov" and its caption replaces the WallBar line, and only then does the button read "Claim this address and be one of the first here". Whether Dana is nearby never affects what is shown. With zero slots, a closed window or a failed lookup, show no line and no "full" message. The count comes from the founding window, never from verified homes.

INSTEAD OF:
- Instead of sorting rows by the distance between pointers, keep Flood · Wildfire · Air · Radon and chip the rows that differ — because a distance sort ranks four incommensurable scales and moves rows the viewer just read.
- Instead of a filled sender mark and a ringed "You" mark, draw two labelled pointers of the same form — because filled vs hollow already means official vs unconfirmed.
- Instead of two facing scorecards, a versus badge or arrows, draw one track per layer — because two scorecards invite a winner and a judgement of someone's home.
- Instead of side-by-side value text, draw stacked value lines above the track, as V5 orders them — because side-by-side 30-character values wrap raggedly at 390.
- Instead of "100-year floodplain", write "1% chance each year (about 1 in 4 over 30 years)" — because FEMA's annual-chance phrasing is the one people read correctly.
- Instead of merging AQI 42 and AQI 58, date both and skip the chip — because the readings are from different days.
- Instead of an error row with no field, show the typed address in an editable field under the error, with Dana's card intact — because Jordan must be able to fix the typo in place.
- Instead of one privacy caption under both actions, give each action its own caption — because "Share this address" does share the address.

DONE WHEN:
- The rows match the header and share card in order and wording, and each row follows V5 order with band names printed.
- Flood and Wildfire are chipped "Different band"; Air shows both dates and never merges.
- Nothing ranks one place above the other.
- In October, Jordan's aha is the voter headline with its seeded deadline and source, below the divider, and does not compete with the table.
- The more serious flood reading has the FEMA next step, not an alarm tint.
- A geocode failure never removes Dana's card and always leaves an editable field.
- Each spread action's caption is true for that action.
- The only account ask is the WallBar button (or "Save this address" when signed in).
- Nothing on the page reveals where Dana lives.

ARTBOARDS:
1. f8-compare-reveal · web-390 · 01-both-revealed · light — the dense default: PlaceHeader, the table, the FEMA next step, the voter aha, the two actions and the WallBar.
2. f8-compare-reveal · web-390 · 02-same-band · light — merged pointers on flood, wildfire and radon; Air still two dated pointers.
3. f8-compare-reveal · web-1440 · 03-both-revealed-wide · light — the 1000px container: table left, next step, aha and actions right.
4. f8-compare-reveal · web-390 · 04-loading · light — Dana's pointers drawn, You skeletons, section skeletons below, no WallBar.
5. f8-compare-reveal · web-1440 · 04b-loading-wide · light — the two-column skeleton.
6. f8-compare-reveal · web-390 · 05-geocode-failed · light — error sentence, pre-filled focused field, "See your place", line-by-line link, Dana's card kept, no PlaceHeader or WallBar.
7. f8-compare-reveal · web-390 · 06-unsupported-region · light — the same structure with "Vancouver, BC".
8. f8-compare-reveal · web-390 · 07-layer-missing · light — radon "Not on record here".
9. f8-compare-reveal · web-390 · 08-legacy-tiles · light — the compare block above the legacy tiles.
10. f8-compare-reveal · web-390 · 09-offline · light — disabled WallBar and "Send yours back" with reasons; "Share this address" enabled.
11. f8-compare-reveal · web-1440 · 10-signed-in · light — "Save this address" in PlaceHeader, no WallBar.
12. f8-compare-reveal · web-390 · 11-signed-in-already-saved · light — the duplicate row with "Only you will see this."
13. f8-compare-reveal · web-390 · 12-founding-open · light — the SlotMeter wall line, its caption and the claim button.
14. f8-compare-reveal · web-390 · 13-worst-case · light — AQI 312 and 5 of 5 against 58 and "Very low · 1 of 5".
15. f8-compare-reveal · web-1440 · 13b-radon-next-step · light — Dana Zone 2 vs You Zone 1, with the test-kit link in the right column.
16. f8-compare-reveal · web-390 · 14-text-200 · light — 200% text, labels and chips on their own lines.
17. f8-compare-reveal · web-390 · 15-greyscale · light — frame 1 in greyscale.
18. f8-compare-reveal · web-390 · 01-both-revealed · dark — dark twin of frame 1.
19. f8-compare-reveal · web-390 · 05-geocode-failed · dark — dark twin of frame 6.
20. f8-compare-reveal · Notes — list every invented string: the heading, the legend, the summary lines, the air note, the error lines, the typed texts, the assessed value, "Closes Fri 6 Nov", the SlotMeter caption, "Your readings are ready.", both action captions, "Dana: Not on this card" and the WallBar wording. List as specimen values: Jordan's PLACE B readings (Zone AE, Low 2 of 5, AQI 58 observed 5:00 PM), his same-band AQI 42, "Very low · 1 of 5", and Dana's Zone 2. Also record:
    - Headline rule for the batch: Jordan's aha and every token headline use the doc's seasonal ranking, so in October a Washington address gets the voter headline, and his reciprocal card carries the same headline. The flows spec (step 9) still shows a flood aha; the flood reading keeps its FEMA next step above the divider instead.
    - Dana's headline is left off the reveal: the header showed it, and on the fixture it repeats the Radon row and would compete with Jordan's aha.
    - The "Share this address" caption is new; the "Send yours back" caption adapts the doc's "This card shows grades and your city, never your address."
    - Assumption: "Share this address" works offline because its link is built on the device.
    - Where "Save this address" leads is a product decision; the save confirmation is assumed.
    - Privacy: the doc's same-block Founding rule (sender and viewer share a block) is dropped, because showing it would reveal where Dana lives and the token has no location. Needs founder sign-off.
    - The first account ask is worded as a save here and as a claim only when Founding is open; confirm against the Founding meter rules.
    - Contract updates: Air never merges in compare; V9's per-caption as-of is replaced by the legend; the test-kit link wording.
    - The flows spec still describes a filled Dana mark and a ringed You mark; this design uses labelled pointers, per research.
    - Token schema: the token must carry, per layer, the band index, the printed value, the air observation date, the source dates and a confidence field; the doc's letter keys cannot produce these rows.
    - Seeded deadlines are hollow, per research.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: artboards 7-12, then wait for "continue". Turn 3: artboards 13-18, then wait for "continue". Turn 4: artboards 19-20.
