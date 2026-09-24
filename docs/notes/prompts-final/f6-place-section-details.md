# Place section details: risk instrument, free radon kits, registration deadline
id: f6-place-section-details · platforms: web/ios/android · isNew: False · artboards: 25

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Place section details: Risk & readiness and Civic · f6-place-section-details

TYPE: EXTENSION of the existing designed screens "Place > Risk & readiness" and "Place > Civic". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. On both pages, keep the screenshot's existing "Your household" ScopeChip in the page header. On Risk: replace the separate flood, wildfire and radon-zone chip rows with the four-row ScaleStrip instrument, and add one outbound kit action to the existing "Lead & radon" card. Keep the section header, the seismic entry, the card's build-year lead line and its grey screening disclaimer exactly as the screenshot shows. On Civic: add a "Your registration" block above the existing election banner. Keep the election banner, polling card and ballot preview as they are. In frame 12 only, the Risk section header and the Civic block also carry the named-home chip "Larkspur Loop · Your household".

ATTACH: (1) Risk & readiness and Civic for HOME A on iOS, Android, web 1440 and web 390; (2) the Foundations board (ScaleStrip, AqiBand, SourceCaption, ProvenanceMark, ProvenanceSheet, TextActionRow, DateRow, ScopeChip, FreshnessLine); (3) the detail-size artboard from the scale-strips prompt; (4) the ProvenanceSheet specimen.

PLATFORMS & VIEWPORTS: iOS 393x852 · Android 412x915 · web 1440x900 (left sidebar plus the Place section rail) and 390x844 (bottom tab bar).

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → HOME A → Risk & readiness (web /app/place/risk), and Place tab → HOME A → Civic (web /app/place/civic). Entry points:
- The two section rows in the Place tab.
- The place file's "Voter registration" row. It opens Civic, scrolls to the registration block and highlights it. Web: /app/place/civic?focus=registration. Native: pantopus://place/home-a/civic (HOME A's id).
- A tap on any layer of a compare view's scale strip, for a signed-in viewer with a claimed home. It opens Risk with that layer's row highlighted. This page is the in-app twin of the share card; those strips have no other destination.
- The mover's civic path: the seasonal headline, then the place file's moving row, then here. The previous step hands over the state and both method dates; the dates and methods must match, and the method names follow the DateSheet.
- After sign-up from the January radon headline. The signed-out outbound kit link is drawn in the seasonal-aha prompt. Here, the radon row is highlighted and the kit action sits below it.
This page shows the primary home only. Next, "Remind me" opens the DateSheet for voter registration, where the person picks a method and the reminder follows that method's deadline.

WHO AND WHEN: Maya Chen on Mon 19 Oct 2026, 6:10 PM. She moved to Washington this fall. She opens Civic from her place file to see which way to register is still open, then checks Risk after Dana's compare card made her curious about radon.

THE ONE JOB: Read each public hazard on its own authority's scale, take the one free step (a radon test), and see which voter registration path is still open, with the official place to check it.

FIRST FIVE SECONDS: Risk: (1) the four value lines, (2) the marker positions, (3) the kit action. Civic: (1) the DateRow "Online or by mail — must arrive by Mon 26 Oct" with "in 7 days · Mon 26 Oct", (2) the in-person DateRow, (3) "Check or update at VoteWA". Primary action on Risk: "Order a free radon kit from WA Dept of Health". Primary action on Civic: "Check or update at VoteWA".

CONTENT (HOME A readings as pasted; deltas only):
- Lead line build year: keep the screenshot's wording. If a year is needed, use 1998 (invented).
- Air pollutant: PM2.5 (invented for the Good reading).
- Air age: observed 7:00 AM, viewed 6:10 PM, so 11 hours old.
- In-person-only frame: TODAY becomes Tue 27 Oct 2026.
- Civic dense frame: the WA registration rule has been checked against the state site, so its mark is filled ("Official"). The unconfirmed frame uses the hollow mark.
- Frame 12: Maya also has a second home, 540 SE Harbor Way, Ilwaco, WA 98624 (invented). Both pages still resolve HOME A.
- Worst case: AX5 at 320pt with all four rows, the kit action, and the Civic stack of registration block, election banner, polling card and ballot preview.
List on the Notes artboard every string not found in the house style, the Foundations contract or the design doc.

LAYOUT & VISUALIZATION:
RISK. Above the instrument, one summary sentence. Then one ScaleStrip at detail size, full width, 48pt rows, in this fixed order:
- Flood zone: "Zone X — minimal flood hazard". Three bands: Minimal (X) · 0.2% a year (shaded X) · 1% a year or more (A/V zones). Marker in band 1, labelled "Zone X". Caption: "FEMA · area zone · effective Sep 2021".
- Wildfire hazard: "Moderate · 3 of 5". Bands: Very low · Low · Moderate · High · Very high. Caption: "USFS · relative hazard, 30 m model · 2023".
- Air quality index (AQI) today: "AQI 42 · Good · PM2.5". AqiBand instrument row: six equal ColorVision Assist segments, the last labelled "301+", 2px gaps, keyline, halo marker. Band name printed off the fill. Caption: "AirNow · nearest monitors · observed 7:00 AM — 11 hours ago". This is the stale air row: its mark is drawn at 50% opacity (ProvenanceMark stale variant); the value stays.
- Radon zone: "Zone 1 — highest potential of EPA's 3 zones". Bands run Zone 3 · Zone 2 · Zone 1, left to right; marker in Zone 1. Caption: "EPA · county-wide estimate, as of 1993 map — only a test tells you about this home".
Marks: every row with a reading carries a FILLED mark. Print "Official" once, beside the first mark. Rows reading "Not on record" carry no mark. "FEMA hasn't mapped flood hazard here" and "Non-burnable land cover (USFS)" keep the filled mark, because they are the authority's own statements.
Flood, wildfire and radon tracks are neutral, with band dividers and a keyline in ink at 3:1 or better; the occupied band is shown by the marker, its printed name and an outline. Only Air is coloured. The tracks never share an axis and never add up to a total. Draw no arrays or pictograms on the strips. Degraded states:
- No data: greyed track, no marker, "Not on record" at full row height, no mark.
- "FEMA hasn't mapped flood hazard here" and "Non-burnable land cover (USFS)" are their own states; neither may look like "very low".
- Captions: at 390 and wider, keep the four full captions (wrapping to two lines). Only at 320–360px, including the 320pt AX5 frame, merge them into "Sources: FEMA, USFS, AirNow, EPA", and Air keeps "observed 7:00 AM — 11 hours ago".
In the Lead & radon card, under the existing disclaimer, draw a 1px rule, leave 16pt, then a TextActionRow outbound row: "Order a free radon kit from WA Dept of Health ↗". Draw it as a bordered action row, not grey prose, because a second grey block hides the only free action on the page. If the state has a program but no free kits, the row reads "Radon program · Washington Dept of Health ↗". If there is no program, draw no row and no generic EPA link.

CIVIC. The "Your registration" block is a card above the election banner, because a dated action outranks information. Top to bottom:
- Title "Your registration for the Tue 3 Nov election".
- For people with more than one home only: the ScopeChip named-home variant "Larkspur Loop · Your household" (this page always uses the primary home).
- "Washington", then two DateRows by exact name, each with the voter-registration KindGlyph and a trailing ProvenanceMark S. They share the block's one SourceCaption, so draw no per-row caption.
  - Row 1 title "Online or by mail — must arrive by Mon 26 Oct", line 2 "in 7 days · Mon 26 Oct".
  - Row 2 title "In person, Clark County Elections — until 8:00 PM Tue 3 Nov", line 2 "in 15 days · Tue 3 Nov".
- "Moved recently? Registration is per address."
- A SourceCaption with its mark: "Washington Secretary of State · statewide · checked Oct 2026 ↗".
- Primary action: TextActionRow outbound row "Check or update at VoteWA ↗".
- Secondary action: text button "Remind me".
After the online/mail deadline, row 1 reads "Online or by mail — closed Mon 26 Oct" in text.secondary with no relative count, and the in-person row moves first. After 8:00 PM Tue 3 Nov the block is gone; once the election has passed, the existing "No upcoming election" state shows. If Maya reported registering, add one line under the DateRows: "You marked this done · Only you will see this."

INTERACTION, MOTION & HAPTICS: Each strip row is one target that opens the ProvenanceSheet. For flood, the sheet reads "Only FEMA can change this" with "How to request a Letter of Map Amendment ↗", and under it a secondary row from the wrong-place variant: "Wrong spot on the map? Tell Pantopus", which reports our own geocoding error to Pantopus. For radon, the sheet's kit action follows the same three program variants: "Get a free test kit" only where a free-kit program exists, otherwise the program link, otherwise nothing. Outbound links open an in-app browser on iOS and Android and a new tab on web, so the page survives the detour. "Remind me" opens the DateSheet in view-seeded voter mode. Arrivals scroll once, fade a highlight in 300ms or less and move focus. With Reduce Motion on, arrivals jump and cross-fade, and skeletons are static. No haptics on this page. No action depends on a gesture or hover.

FOUNDATIONS COMPONENTS USED: ScaleStrip (detail size; no-data, not-studied and non-burnable variants; stale air row; AX5) · AqiBand (instrument row) · SourceCaption (dated static, live, county scope, collapsed sources line at 320–360px only) · ProvenanceMark (official on strip rows with a reading and on the checked WA civic rule; stale at 50% on the air row; unconfirmed on an unchecked civic rule, frame 12) · ProvenanceSheet (hazard-owned-by-authority, wrong-place, radon) · TextActionRow (outbound) · ScopeChip (page-header "Your household"; named home; footer sentence "Only you will see this.") · DateRow (deadline) · WarmingSkeleton (instrument) · InlineErrorRow (provider unreachable) · FreshnessLine and OfflineNotice · DateSheet (view-seeded voter, as the destination only).

ACCESSIBILITY: Each strip row is one spoken element, for example "Wildfire hazard potential: Moderate, 3 of 5, scale Very low to Very high. USFS 2023. Official.", "Radon zone: Zone 1, highest potential of EPA's 3 zones, county-wide estimate. EPA. Official.", "Air quality index today: 42, Good, PM2.5. AirNow, observed 7:00 AM, 11 hours ago. Official." and "Flood zone: FEMA hasn't mapped flood hazard here. FEMA. Official." Above the instrument, the summary: "Four public readings for this address, each on its own scale." The rows are the text list. Links name their destination: "Order a free radon kit, opens Washington State Department of Health website" and "Check or update at VoteWA, opens the state voter site". Targets are 44pt / 48dp / 44px. Band position is always stated in words. Civic reading order: title → scope chip → state → first DateRow → second DateRow → done line → note → source → VoteWA → Remind me.

COPY: all strings quoted above, plus:
- "Not on record" · "FEMA hasn't mapped flood hazard here" · "Non-burnable land cover (USFS)"
- Legend word: "Official" / "On record, not confirmed"
- Unconfirmed caption: "Washington Secretary of State · not yet checked against the state site"
- Partial failure: "We couldn't reach AirNow just now" with "Retry"
- Offline: "You're offline · as of 6:10 PM", with "You're offline. You can open this when you're back." under each disabled link
- Flood sheet secondary row: "Wrong spot on the map? Tell Pantopus"
- Crop (c) array caption: "1 in 100 homes in this zone each year"
- Existing section-unavailable fallback: unchanged

EDGE CASES: A 1%-a-year zone reads "Zone AE — 1% chance of flooding each year (about 1 in 4 over 30 years)". The alert reading reads "AQI 118 · Unhealthy for Sensitive Groups · PM2.5" (observed 4:00 PM). An air reading older than 3 hours keeps its value and shows its age (stale air row); it is never blanked. One layer missing keeps all four rows. No seeded voter rule: the block is absent, not an empty card. A saved place (PLACE B) opens this page too (founder decision, 22 Sep 2026): "Saved place · Only you" scope, no household elements. Slow load: WarmingSkeleton after 1s. A member without edit rights sees everything; "Remind me" and the done line are personal.

INSTEAD OF:
- Instead of a letter grade, score, stars or radar, draw four separate strips — because four authorities share no scale and one shape reads as a report card on a home.
- Instead of "Zone 1 of 3", write "Zone 1 — highest potential of EPA's 3 zones" — because "N of M" flips meaning next to wildfire's "3 of 5".
- Instead of a hollow radon mark, draw it filled with the county-wide scope caption — because the zone is official and its limit is scope.
- Instead of "Air today" with no age, print "observed 7:00 AM — 11 hours ago" and dim the mark — because stale data keeps its value plus its age.
- Instead of "Check or update" opening an internal sheet, send it to VoteWA and keep "Remind me" separate — because the app cannot know whether anyone is registered.
- Instead of hiding the block after Mon 26 Oct, draw the in-person-only state — because in-person registration stays open until 8:00 PM Tue 3 Nov.
- Instead of the kit as another grey caption, draw an outbound action row under a rule — because it is the only free step.
- Instead of a "Sources:" line at 390, keep the full captions — because the merged line is only for 320–360px.

DONE WHEN: The risk page matches the share card's instrument row for row. No frame implies a verdict about a home. The air row shows its age. Radon offers the kit only where a program exists, on the card and in the sheet. The civic block states both method deadlines as DateRows with weekdays, relative-first counts and source, uses the DateSheet's method names, and never states registration status. Flow moment: Maya sees both paths, checks at VoteWA and sets a reminder separately.

ARTBOARDS:
1. f6-place-section-details · ios · 01-risk-dense · light — summary sentence, four strips (air row with its age and dimmed mark), legend word, Lead & radon card with the kit row.
2. f6-place-section-details · ios · 02-civic-dense · light — registration block (two DateRows, filled mark), then election banner, polling card and ballot preview.
3. f6-place-section-details · web-1440 · 01-risk-dense · light — sidebar and section rail; full captions.
4. f6-place-section-details · web-1440 · 02-civic-dense · light — the stack of 2 at desktop width.
5. f6-place-section-details · android · 01-risk-dense · light — M3 version of 1.
6. f6-place-section-details · android · 02-civic-dense · light — M3 version of 2.
7. f6-place-section-details · web-390 · 01-risk-dense · light — full four captions wrapping to two lines; no "Sources:" line.
8. f6-place-section-details · web-390 · 02-civic-dense · light — the Civic stack at 390 with the bottom tab bar; DateRows, banner and polling card wrapped.
9. f6-place-section-details · ios · 03-risk-partial · light — wildfire "Not on record", greyed track, no mark.
10. f6-place-section-details · ios · 04-risk-special-states · light — three labelled crops: (a) flood "FEMA hasn't mapped flood hazard here" with filled mark; (b) wildfire "Non-burnable land cover (USFS)" with filled mark; (c) flood "Zone AE — 1% chance of flooding each year (about 1 in 4 over 30 years)" with its marker in band 3, and under the row only, a 100-cell array with 1 cell filled, captioned "1 in 100 homes in this zone each year".
11. f6-place-section-details · ios · 05-flood-provenance-sheet · light — sheet over Risk: "Only FEMA can change this", the LOMA link, and under it "Wrong spot on the map? Tell Pantopus".
12. f6-place-section-details · ios · 06-radon-program-variants · light — three labelled crops (free kits · program without kits · no program, no row), each with its matching sheet action.
13. f6-place-section-details · ios · 07-civic-unverified-multi-home · light — hollow mark, "On record, not confirmed", unconfirmed caption, "Larkspur Loop · Your household" chip on the block, inset of the Risk section header with the same chip, and "You marked this done · Only you will see this."
14. f6-place-section-details · ios · 08-civic-in-person-only · light — TODAY Tue 27 Oct; "Online or by mail — closed Mon 26 Oct"; in-person DateRow first with "in 7 days · Tue 3 Nov".
15. f6-place-section-details · ios · 09-civic-absent-states · light — two crops: no seeded rule (block absent) and after Tue 3 Nov ("No upcoming election").
16. f6-place-section-details · ios · 10-loading · light — WarmingSkeleton track outlines.
17. f6-place-section-details · ios · 11-error · light — Air row's InlineErrorRow with other rows live, plus the section-unavailable fallback.
18. f6-place-section-details · android · 12-offline · light — cached readings, "You're offline · as of 6:10 PM", links disabled with "You're offline. You can open this when you're back."
19. f6-place-section-details · ios · 13-compare-arrival · light — wildfire row highlighted with focus.
20. f6-place-section-details · ios · 14-ax5-risk-civic · light — two columns at 320pt AX5: Risk (text above full-width tracks, collapsed "Sources: FEMA, USFS, AirNow, EPA" with Air's "observed 7:00 AM — 11 hours ago" kept) and Civic (full stack, wrapped).
21. f6-place-section-details · ios · 15-greyscale-risk · light — frame 1 in greyscale; Air still readable.
22. f6-place-section-details · ios · 01-risk-dense · dark — dark twin of 1.
23. f6-place-section-details · ios · 02-civic-dense · dark — dark twin of 2.
24. f6-place-section-details · ios · 08-civic-in-person-only · dark — dark twin of 14.
25. f6-place-section-details · Notes — assumptions, invented strings, omitted states, and open questions.

Notes must record:
- Invented strings, at least: 1998, PM2.5, the second home, the what-if crops, "You marked this done · Only you will see this.", "checked Oct 2026", "as of 1993 map" (replace when the real map date is confirmed), "Your registration for the Tue 3 Nov election", "Four public readings for this address, each on its own scale.", "Order a free radon kit, opens Washington State Department of Health website", "Wrong spot on the map? Tell Pantopus", "1 in 100 homes in this zone each year", plus any other string not in the house style, contract or design doc.
- Assumption: an AirNow reading older than 3 hours is stale; the fixture's 7:00 AM reading is therefore shown with its age.
- The dense civic frame assumes the WA registration rule was checked against the Secretary of State site; until then the block renders as frame 13.
- DateRow titles use the DateSheet method strings; line 2 uses the DateRow relative-first form. The two DateRows share one block SourceCaption instead of per-row captions: confirm.
- The second home is in-state; an out-of-state second home (a different state's deadline shown with no indication) is the real risk the named-home chip guards against.
- TextActionRow outbound is used as the primary action on Civic and Risk while the contract calls it tertiary: confirm, or add an "outbound primary" variant.
- Saved-place access (founder decision, 22 Sep 2026): a saved place opens this page too. Its readings and civic deadlines are public-record facts, not household data. At PLACE B the page carries the "Saved place · Only you" scope, shows no household elements, and "Remind me" and "I did this" stay Only you. flow-13, the place file's voter row at T1 and the Foundations 00c-08 crop all open this page. A saved-place viewer's compare-strip tap opens it too.
- Contract string differences, pick one each: the contract's example kit label vs this verb-led label; the contract's short radon string vs "of EPA's 3 zones"; this surface's Zone AE string ("of flooding") vs the contract's approved "Zone AE — 1% chance each year (about 1 in 4 over 30 years)".
- The self-report line uses the ScopeChip sentence "Only you will see this."; the older "only shown to you" is retired.
- The flows-spec wording ("received by", "8 p.m.") is superseded by the contract's "must arrive by" and "8:00 PM".

BATCH PLAN: Turn 1: 1-6, then wait for continue. Turn 2: 7-12, then wait for continue. Turn 3: 13-18, then wait for continue. Turn 4: 19-24, then wait for continue. Turn 5: 25.
