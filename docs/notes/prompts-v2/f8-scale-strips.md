# The four-layer reading instrument (scale strips)
id: f8-scale-strips · platforms: web/ios/android · isNew: False · artboards: 21

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: The four-layer reading instrument (scale strips) · f8-scale-strips

TYPE: EXTENSION of the existing designed screen "Place > Risk & readiness". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.
The page today runs, top to bottom, on all three platforms: Heat & cold · Flood & hazards (flood, seismic, wildfire; on web the flood card, then "Other hazards" with Earthquake and Wildfire) · Health & environment (Lead & radon, Drinking water, EPA-regulated nearby) · Emergency plan · Fridge card.
The change, section by section:
- Heat & cold stays first, unchanged, above the instrument.
- Directly under Heat & cold, one ScaleStrip instrument takes the slots of the flood zone chip and the wildfire card, and takes the radon chip out of the "Lead & radon" card.
- The Air row is new to this page. The page has never shown air before.
- Keep the NFIP premium benchmark ("What flood policies near you cost") directly under the instrument, unchanged.
- Then keep, unchanged and in this order: Seismic (on web, "Other hazards" now holding only Earthquake) · Health & environment with Lead paint (the old "Lead & radon" card minus its radon chip), Drinking water and EPA-regulated nearby · Emergency plan · Fridge card, in the same locked state the screenshot shows for viewers who have not unlocked it. None of these join the instrument.
- Remove the section source notes that the instrument's SourceCaptions replace (the flood note, including web's "as of 2024", and the wildfire note). Keep the source notes on every section that stays.
- New on this page, owned by the separate surface f6-place-section-details and drawn here so the page is complete: under the screening disclaimer, the TextActionRow "Get a free test kit · Washington Dept of Health ↗", as on Foundations 00b 08-in-context. It is absent for a state with no program, never replaced by a generic EPA link. The instrument on this page is shared with f6-place-section-details.
The same ScaleStrip is also used at the compare size (390) and at the share-card size, so on this project you draw it once at all three sizes and in every state.

ATTACH: Place > Risk & readiness on iOS, Android and web 1440 (light); the /start preview step on web 390 (light), showing the hazard sections below the aha card.

PLATFORMS & VIEWPORTS: iOS 393x852 · Android 412x915 · web 390x844 and 1440x900 (left sidebar). Instrument sizes: detail (full content width, rows at least 48pt), compare (390 wide) and share-card column (inside 1200x630, 520 wide by default, up to 720).

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab > Risk & readiness (web /app/place/risk).
Entries into this screen:
(1) The "Risk & readiness" section row on the Place tab.
(2) The radon follow-up under the radon aha card on the /start preview, which appears only in January. The scroll-and-highlight lands on the Radon row of the instrument on that same /start preview, or on the Radon row in Risk & readiness when the person is signed in. The free-kit link itself leaves through the TextActionRow described in TYPE.
(3) The /start preview itself, signed out. The detail size sits in the hazard sections below the aha card. In the flow, the person has just read the seasonal aha and scrolls down, and next they reach the "Keep this address handy" wall.
Other places the same instrument is reused (these do not lead to this screen):
(4) The compare arrival header and the compare reveal, at the compare size. A tap on a compare row opens ProvenanceSheet, as on this page. No compare row links to Risk & readiness in this pack, including for signed-in viewers.
(5) The share card and the compare sheet's card preview, at the share-card size. They are images, with no taps.
No push notification or widget opens this screen. Tapping a row opens ProvenanceSheet ("Where this fact comes from").

WHO AND WHEN: Maya Chen, owner at HOME A, on TODAY at 6:10 PM. Her friend Dana's compare card arrived earlier, and now Maya wants to know what the four readings mean for her own address. Signed-out /start frame: Jordan Lee at PLACE B, with the fixture readings, on a January specimen date. Compare frame: Dana's card (Camas, WA, as of Sat 12 Sep 2026) next to "You", a new Camas resident at a specimen address that is not PLACE B.

THE ONE JOB: Make four readings from four different authorities comparable without inventing a grade or judging a home.

FIRST FIVE SECONDS: First, the four row names in a fixed order: Flood zone · Wildfire hazard · Air today · Radon zone. Second, each value line with a word and a number, and a marker sitting in its named band. Third, the source caption under each row. The one action is tapping a row, which opens ProvenanceSheet. The instrument has no other button.

CONTENT (FIXTURES; deltas below)
Heading "What's on record here", then the summary sentence "Flood Zone X, minimal flood hazard. Wildfire Moderate, 3 of 5. Air today AQI 42, Good. Radon Zone 1, highest potential, county-wide.", then the legend, drawn with ProvenanceMark shapes and showing only the marks present in that frame: "● Official" by default; add "○ On record, not confirmed" only in frames that show the street-matched row. No "You added this" mark, because no row here can be added by the person.
Rows always come in this order. Each row is: row name → value line → track → band names → SourceCaption.
- Flood zone · "Zone X — minimal flood hazard" · bands "Minimal (X)" · "0.2% a year (shaded X)" · "1% a year or more (A/V zones)" · caption "FEMA · area zone · effective Sep 2021" · Official.
- Wildfire hazard · "Moderate · 3 of 5" · bands Very low · Low · Moderate · High · Very high · caption "USFS · hazard potential, modelled quarter-mile · 2023" · Official.
- Air today · "AQI 42 · Good" · AqiBand, six segments, the last labelled "301+" · caption "AirNow · nearest monitors · observed 6:00 PM today" · Official. At detail size, the band-name line under the Air track starts with the words "Air quality index (AQI) ranges" at the left, then the six range labels under their segments. This is the one place the term is spelled out.
- Radon zone · "Zone 1 — highest potential (county)" · bands "Zone 3 · low potential" · "Zone 2 · moderate potential" · "Zone 1 · highest potential" · caption "EPA · county-wide estimate — only a test tells you about this home" · Official (filled).
Deltas:
- Alert air, drawn at specimen time 4:10 PM: "AQI 118 · Unhealthy for Sensitive Groups", observed 4:00 PM. At detail size, signed in, the Air row draws the AqiBand instrument-row alert as on Foundations: the 1.5px dashed threshold rule at 101 (the household's alert level) with "101" above it. No other track ever gets a threshold rule, and the signed-out /start instrument draws none. Under the instrument the host prints two lines: EPA's statement, "Members of sensitive groups may experience health effects. The general public is less likely to be affected.", then "People with heart or lung disease, older adults, children, and people of lower socioeconomic status are the groups most at risk." The instrument row itself leaves out the pollutant and the statement. ProvenanceSheet names the pollutant (PM2.5) and quotes the EPA statement.
- Stale air, at TODAY 6:10 PM: caption "AirNow · nearest monitors · observed 7:00 AM — 11 hours ago". The value and marker stay. The ProvenanceMark stays at full ink; the age words carry the staleness.
- Flood 1% zone (specimen value): "Zone AE — 1% chance each year (about 1 in 4 over 30 years)".
- Shaded X: "Zone X (shaded) — 0.2% chance each year (about 1 in 17 over 30 years)".
- A V zone adds the words "plus coastal wave hazard" and never gets a fourth band.
- Frozen sender rows: the row name is "Air on Sat 12 Sep" and the caption is "AirNow · on Sat 12 Sep 2026". Every other caption ends "as of Sat 12 Sep 2026".
- Sender line: "Dana · Camas, WA — what's on record for this area".
- Street-matched flood: caption "FEMA · matched to your street, not your parcel · effective Sep 2021".
- Worst case: "AQI 512 · Hazardous", with the marker in the "301+" segment.
- January specimen for frame 8: date Mon 11 Jan 2027; the radon aha above with its follow-up "Washington offers free test kits".

LAYOUT & VISUALIZATION
- Each row has its own horizontal track, running from least hazard on the left to most on the right, using only that authority's bands. Every track uses the same width and left edge, but each has its own bands. No band boundary implies a shared axis or scale.
- Flood, wildfire and radon tracks: neutral surface.raised bands with 1.5px dividers and a keyline in text.secondary ink (at least 3:1). Show the occupied band three ways: the marker, a 2px text.primary outline, and the band name in captionMedium under the marker. Never use a raised fill for it. Band names follow the Foundations rules: every name on 3-band rows, and only the end names plus the occupied name on wildfire.
- Air row: the only coloured track. Use AqiBand in its instrument-row variant, exactly as on the Foundations board: ColorVision Assist hues, equal-width segments with the marker placed by value inside its segment, 2px surface gaps, a keyline, and the range labels "0–50" to "301+". The category name sits in text.primary on the value line, never on the fill.
- Marker: the ScaleStrip capsule marker exactly as on the Foundations board (never a disc).
- Wildfire keeps "3 of 5", because a higher number means more hazard there. Radon is described in words only and never uses "N of M".
- Detail size: 12pt track. The whole row is at least 48pt tall. Below 560pt, text sits above the track. At 560pt and wider, use two columns (40/60).
- Compare size (390): all four rows stay.
- Share-card column: follow the Foundations ScaleStrip 05-og-column recipe (40px text, 30px tracks, 112px rows, no per-row captions). At this size, print these share-card short forms, one 40px line each: "Flood zone X · minimal hazard" · "Wildfire · Moderate · 3 of 5" · "Air on Sat 12 Sep · AQI 42 · Good" · "Radon zone 1 · highest (county)". Let the text column widen up to 720px and narrow the filled "Yours?" column to match; it stays filled. When an air category name does not fit (for example "Unhealthy for Sensitive Groups"), the category moves to a second 40px line inside the same 112px row; never shrink or truncate. Flood 1% zones print "Flood zone AE · 1% a year". The column ends with one 28px sources line: "● Official · FEMA Sep 2021 · USFS 2023 · AirNow Sat 12 Sep · EPA county-wide". The full approved strings go in the image's text alternative and in the detail and compare sizes.
- Compare variant: the ScaleStrip compare variant as on the Foundations board.
  - A "Dana" triangle pointer sits above the track and a "You" pointer below it.
  - When both readings fall in the same band, the pointers share one position and the row gets the neutral chip "Same band". Otherwise it gets "Different band".
  - Rows that differ print "Dana: …" and "You: …". Rows in the same band print "Both: …".
  - On the Air row, each pointer keeps its own date: "Dana · Sat 12 Sep" above and "You · today 6:00 PM" below. The row prints two captions, "Dana: AirNow · on Sat 12 Sep 2026" and "You: AirNow · observed 6:00 PM". The two air pointers never merge without both dates printed.
  - The ProvenanceMark sits beside the caption text, never on a pointer.
- Collapsed text line (arrival header under 640px): "Dana · Camas, WA · Flood X · Wildfire Moderate · Air on Sat 12 Sep · 42 · Radon Zone 1 ›". It has no marker glyphs.
- Missing data: the row stays and is never blank, because both compare columns must stay the same length. Draw a greyed track with no marker and "Not on record". Draw these as three distinct states: "FEMA hasn't mapped flood hazard here", "Non-burnable land cover (USFS)" and, for air, "No reading for this address right now". None of them may look like "Very low".
- Street-matched flood row: HOLLOW mark with "On record, not confirmed" printed beside it, plus the street-match caption. The doubt is our address match, which the household can confirm, not FEMA's map.
- Narrow widths (320–360): merge the captions into "Sources: FEMA, USFS, AirNow, EPA". A live air row keeps "today · 6:00 PM" on its own line. A frozen instrument keeps one line "as of Sat 12 Sep 2026" under the merged sources, and its frozen air row keeps "on Sat 12 Sep".
- Below the instrument, in this order: the NFIP benchmark, the screening disclaimer, the free-kit TextActionRow, then the kept sections listed in TYPE.

INTERACTION, MOTION & HAPTICS: The whole row is the target. The marker, mark and track are never targets on their own. A tap opens ProvenanceSheet: a medium detent on iOS, a ModalBottomSheet on Android, a bottom sheet on mobile web and a centred 560 modal on desktop. The report control depends on the layer:
- flood: "Only FEMA can change this", with the LOMA link
- wildfire: "Only USFS can change this", with a link to the USFS Wildfire Hazard Potential source (the hazard-owned-by-an-authority variant)
- radon: "Get a free test kit"
- air: "This reading looks wrong"
- a wrong parcel or street match: report to Pantopus.
Arriving from the radon follow-up scrolls once and fades a highlight on the Radon row. Accessibility focus moves to that row. On a cold load, WarmingSkeleton track outlines hold the final height and cross-fade to values in 300ms or less, with no indicator under 1 second. With Reduce Motion, draw static outlines and no shimmer. No haptics, because nothing on this surface is a confirm.

FOUNDATIONS COMPONENTS USED: ScaleStrip (detail, compare, 05-og-column, and the no data, not studied, non-burnable, frozen and collapsed variants) · AqiBand (instrument row, no reading, alert with threshold rule) · ProvenanceMark (S, and 28px on the share card) · SourceCaption (dated, live, frozen, county scope, collapsed sources) · ProvenanceSheet · FreshnessLine (per-fact stale) · WarmingSkeleton · InlineErrorRow · OfflineNotice · TextActionRow (free-kit line) · ScopeChip (host header only).

ACCESSIBILITY: Reading order: the heading "What's on record here", the summary sentence, the legend, then Flood, Wildfire, Air, Radon.
Each row is one element with a spoken label:
- Flood: "Flood zone: Zone X, minimal flood hazard, scale Minimal to 1% a year or more. FEMA, effective September 2021. Official."
- Wildfire: "Wildfire hazard potential: Moderate, 3 of 5, scale Very low to Very high. USFS, modelled quarter-mile, 2023. Official."
- Air: "Air quality index 42, Good, category 1 of 6. AirNow, observed 6 PM today. Official." In the alert frame it adds "Your alert level 101, crossed at 4 PM."
- Radon: "Radon zone: Zone 1, highest potential, scale Zone 3 to Zone 1. EPA, county-wide estimate. Official."
Each row has the custom action "Where this fact comes from". The summary sentence is the text alternative for the whole instrument, and the rows themselves are the text list. Targets are 44pt on iOS, 48dp on Android and 44px on web, and on web a focused row shows a 2px focus ring. Meaning comes from position, the printed name and the outline, so every frame reads in greyscale. At AX5, text sits above a full-width track and values wrap instead of truncating.

COPY: The strings in CONTENT, plus "Retry air quality", "We couldn't reach AirNow just now", "You're offline · as of 6:10 PM" and "Get a free test kit · Washington Dept of Health ↗". Say "hazard" or "potential" as the authority does. Always write "Zone X — minimal flood hazard" at detail and compare sizes. Never write "minimal risk", "100-year", "better" or "worse".

EDGE CASES:
- The longest host header is "2418 NE Larkspur Loop, Vancouver, WA 98684" plus the ScopeChip "Your household", and it wraps.
- Saved place (PLACE B): the instrument is identical. Only the host chip changes, to "Saved place · Only you". No threshold rule.
- Signed out on /start: identical, with no chip and no threshold rule.
- Multi-home viewer: the block header names the address.
- AQI 512: the marker sits in "301+".
- The longest value is the AE string, which wraps to two lines.
- One provider fails: only that row shows InlineErrorRow, and the other rows stay live.
- A state with no radon program: the free-kit line is absent.
- Offline: rows stay cached, with their age in words.
- Slow network: the outlines hold the final height.

INSTEAD OF
- Instead of letter grades, a score or stars, draw four separate authority tracks — because four unlike labels on one invented scale turn a public record into a report card on someone's home.
- Instead of a radar chart, draw stacked rows — because a radar flattens unlike axes onto one scale, and a bigger area reads as "worse home".
- Instead of a green-to-red ramp on every track, colour only the air row with the EPA hues — because a shared ramp is a grade by another name.
- Instead of four flood bands (X · shaded X · AE · VE), draw three by annual chance — because AE and VE share the same 1% chance.
- Instead of a hollow radon mark, draw it filled with a county-scope caption — because the zone is official and its limit is scope, not doubt.
- Instead of a raised fill for the occupied band, draw an outline plus the printed name — because raised on base is 1.05:1.
- Instead of "Air today" on a frozen card, write "Air on Sat 12 Sep" — because a frozen reading is not today's.
- Instead of sorting rows by difference, keep the fixed order — because people compare rows by position.

DONE WHEN: No grade, score or verdict appears anywhere. Radon reads as a county-wide estimate, not a claim about the home. All four rows appear in the same order at all three sizes, each with a word, a number and an authority, scope and date. Fresh and stale air are dated in words, and frozen air is never called today. A missing layer keeps its row. Every kept Risk & readiness section is present, in the real order, with Heat & cold first. No share-card line overflows its column. Every greyscale frame still reads.

ARTBOARDS
1. f8-scale-strips · ios · 01-detail-all-four · light — Risk & readiness at HOME A: Heat & cold, then heading, summary, legend "● Official", four rows (air observed 6:00 PM), NFIP benchmark, disclaimer, free-kit TextActionRow, Seismic, Health & environment (Lead paint, Drinking water, EPA-regulated nearby), Emergency plan, locked Fridge card.
2. f8-scale-strips · web-1440 · 02-three-sizes · light — a specimen of the detail, compare (390) and share-card sizes for Dana (short forms, column width labelled), plus the collapsed text line.
3. f8-scale-strips · ios · 03-no-data-states · light — "FEMA hasn't mapped flood hazard here", "Non-burnable land cover (USFS)", "No reading for this address right now" and radon "Not on record".
4. f8-scale-strips · ios · 04-air-alert-and-stale · light — three stacked Air-row specimens, each with a gutter label giving its specimen time: AQI 118 with the 101 threshold rule plus the EPA and sensitive-groups lines ("specimen 4:10 PM"); the stale 7:00 AM row "— 11 hours ago" at full ink ("TODAY 6:10 PM"); AQI 512 in "301+" ("specimen value").
5. f8-scale-strips · web-390 · 05-compare-frozen-vs-live · light — Dana vs You; flood "Different band" (You in Zone AE); the others "Same band"; air pointers with both dates. Label the "You" readings "specimen value" in the gutter.
6. f8-scale-strips · ios · 06-flood-AE-and-street-matched · light — the AE value wrapping, the shaded X value, and the hollow street-matched flood row with its caption; the legend adds "○ On record, not confirmed".
7. f8-scale-strips · ios · 07-row-tap-provenance-sheet · light — Radon row tapped: ProvenanceSheet at medium detent with "Get a free test kit".
8. f8-scale-strips · web-390 · 08-start-preview-signed-out · light — /start at PLACE B, no chip, gutter label "specimen date Mon 11 Jan 2027": the radon aha with "Washington offers free test kits" above, and the Radon row highlighted after arriving from that follow-up.
9. f8-scale-strips · web-390 · 09-loading-and-partial-error · light — skeleton outlines, then the Air row with "We couldn't reach AirNow just now" and Retry.
10. f8-scale-strips · web-390 · 10-offline · light — cached rows under "You're offline · as of 6:10 PM".
11. f8-scale-strips · web-390 · 11-narrow-320 · light — drawn 320 wide: a live instrument with "Sources: FEMA, USFS, AirNow, EPA" and air "today · 6:00 PM"; below it, Dana's frozen instrument with "as of Sat 12 Sep 2026" and air "on Sat 12 Sep".
12. f8-scale-strips · android · 12-detail-all-four · light — the Material 3 host with 48dp rows and every kept section in order, as in frame 1.
13. f8-scale-strips · web-1440 · 13-risk-detail-desktop · light — /app/place/risk with the sidebar: Heat & cold, the two-column instrument, NFIP benchmark, disclaimer, free-kit line, Other hazards (Earthquake), Health & environment, Emergency plan, Fridge card.
14. f8-scale-strips · ios · 14-ax5 · light — text above full-width tracks, everything wrapping.
15. f8-scale-strips · ios · 15-greyscale · light — frame 1 in greyscale, with a caption naming the cue that carries each meaning.
16. f8-scale-strips · ios · 16-detail-all-four · dark — the dark twin of 1, with the keyline visible on the dark base.
17. f8-scale-strips · web-1440 · 17-three-sizes · dark — only the detail and compare sizes in dark. The share-card column stays light and is labelled "light only (OG image)".
18. f8-scale-strips · ios · 18-no-data-states · dark — the dark twin of 3.
19. f8-scale-strips · ios · 19-air-alert-and-stale · dark — the dark twin of 4; maroon and purple keep 3:1 through the keyline.
20. f8-scale-strips · web-390 · 20-compare-frozen-vs-live · dark — the dark twin of 5.
21. f8-scale-strips · Notes — list:
- assumptions, including the January specimen date for frame 8 (the radon follow-up only runs in January; in October a Washington address gets the voter-registration aha)
- every invented string: heading, band sub-labels, the street-match caption, the shaded X, Zone AE and AQI 512 deltas, the wildfire caption wording, the AQI ranges label, the dated collapsed air item, the specimen "You" readings and the January follow-up line
- fixture change: the air observation time moved from 7:00 AM to 6:00 PM so the default frame is fresh at TODAY 6:10 PM; the stale frame keeps 7:00 AM
- row names follow the research change and differ from the Foundations fixture labels
- the share-card short forms (including "Air on Sat 12 Sep" with "on", about 660px, and "Flood zone AE · 1% a year") and the 720px column widening need sign-off in the component contract
- the summary sentence follows the Foundations wording with "today" and "highest potential" added
- flag: the sensitive-groups line must be checked against EPA TAD Table 4
- the instrument row leaves out the pollutant and the health statement on purpose; the threshold rule appears only on the signed-in Air row
- the street-matched hollow row is a proposed state, an open question against the hollow-only-for-household-facts rule
- the free-kit TextActionRow is owned by f6-place-section-details; the instrument is shared with it
- removed section source notes (flood, wildfire) and where the instrument now sits relative to the "Flood & hazards" label: open question
- open question: the inventory lists a compare-strip tap as an entry to Risk & readiness; in this pack compare rows open ProvenanceSheet only (flow-05 step 10)
- f8-compare-arrival-header must use the same collapsed string
- omitted state: Zone D ("possible but undetermined flood hazard"), which is different from not mapped
- this instrument replaces the design doc's letter grades and its how-we-know strings; the token must carry band IDs plus a confidence field.

BATCH PLAN: Turn 1: 1-6, then wait for "continue". Turn 2: 7-12, then wait for "continue". Turn 3: 13-18, then wait for "continue". Turn 4: 19-21.
