# Rotating seasonal aha card
id: f8-seasonal-aha · platforms: web/ios/android · isNew: False · artboards: 24

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Rotating seasonal aha card · f8-seasonal-aha

TYPE: EXTENSION of the existing designed screen "Aha card (What stands out)". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.
- Web: keep the web card's anatomy as it is: the overline "WHAT STANDS OUT" on the left of the header row, the chip slot on the right, the 42pt rounded icon tile, the headline, the detail, the source caption, and one sunken follow-up row with a chevron.
- iOS and Android: the native cards differ today (no overline, a 34pt tile, a tone-coloured grade chip that falls back to "What stands out", no source line, and a primary-colour text link that opens sign-up directly). Change them to the web anatomy above: add the overline, move the chip to the right of the header row, enlarge the tile to 42pt, replace the tone-coloured grade chip with the neutral chip described below, add the SourceCaption, and replace the primary text link with the sunken follow-up row. On native, the follow-up row now scrolls to the sticky wall instead of opening sign-up directly.

ATTACH: (1) The aha card on web /start at 390 and 1440 (exact). (2) The iOS and Android address preview, showing the aha card — layout changes as listed in TYPE. (3) The Foundations board frames for ProvenanceMark, SourceCaption, StatusChip, KindGlyph and TextActionRow. (4) The f8-native-share-compare iOS and Android idle frames, which show the share pair under the card.

PLATFORMS & VIEWPORTS: Web 390×844 and 1440×900, iOS 393×852, Android 412×915.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → address preview. On web this is /start. On iOS and Android it is the Place launch preview, where the card is the first card under the hero.

Entry points:
- Typing an address and tapping "See your place".
- A shared https://pantopus.com/start?address= link.
- A friend's compare link (https://pantopus.com/start?vs=…). The headline shown in the sender's column comes from that link and is at most 90 characters.
- The compare reveal, which shows the recipient's own aha.
The compare share card also carries this card's headline, but it is not an entry point to this card.

This surface receives the typed address, today's date and the address's state. It hands off in three ways:
- The follow-up row scrolls to the sticky wall ("Keep this address handy").
- The share pair, which sits 16pt below the card and outside it: on web "Compare with a friend" opens the compare sheet; on the apps the TextActionRow pair "Share this address" · "Compare with a friend" opens the system share sheet.
- The source caption opens ProvenanceSheet.

WHO AND WHEN: Someone new at PLACE B. It is Mon 19 Oct, 6:10 PM Pacific, and a signed-out visitor who recently moved from Oregon has just typed 1107 NE Birchfield Ct, Camas, WA 98607. They are an unnamed newcomer, not Jordan Lee. They have never registered to vote in Washington.

THE ONE JOB: Make the one headline on the anonymous preview the fact that is actually urgent this month at this address.

FIRST FIVE SECONDS: The eye lands first on the headline, then on the deadline chip, then on the source caption with its mark. The card's own action is the sunken follow-up row, which leads to the save. The bordered outbound row under it is visibly secondary.

CONTENT (deltas to the fixtures; the default frame is dated Mon 19 Oct)
When each card appears:
- The voter card only from Sept 20, and only within 30 days of the deadline.
- Tax and appeal cards Apr 1–30 and Oct 1–31, within 30 days of the date.
- The radon kit card Jan 1–31 in a Zone 1 county.
- The air or wildfire card Jun 15–Sep 30, and only when today's AQI is 101 or higher, or the wildfire hazard is High (4 of 5) or above. Otherwise the ranked card shows.
- Day counts are calendar days in the state's timezone. If both the voter card and the tax card match, the voter card wins (assumption; see Notes).

- Voter card (default, Mon 19 Oct):
  - Chip: "in 7 days · Mon 26 Oct".
  - Headline: "Online or mail voter registration for Nov 3 must arrive by Oct 26 in Washington."
  - Detail, line 1: "In person: until 8:00 PM Tue 3 Nov at your county elections office." Line 2: "Moved recently? Registration is per address."
  - Source: HOLLOW mark, the word "On record, not confirmed", then "Washington Secretary of State · statewide · as of Mon 19 Oct". The seed ships unchecked.
  - Follow-up row: "Keep this address to set a reminder before Mon 26 Oct".
  - Outbound row: "Check or update at VoteWA ↗".
- Voter card, other dates. In each, the as-of date matches the frame's date.
  - Thu 8 Oct: chip "in 18 days · Mon 26 Oct".
  - Sun 25 Oct: chip "Tomorrow".
  - Mon 26 Oct: chip "Today", with the follow-up row "Keep this address handy".
- In-person phase, from Tue 27 Oct until 8:00 PM Tue 3 Nov:
  - Fri 30 Oct: chip "in 4 days · Tue 3 Nov".
  - Headline: "You can still register in person for Nov 3 — until 8:00 PM on Election Day."
  - Detail: "At your county elections office. Moved recently? Registration is per address." The online-or-mail line is gone.
  - Source and mark as in the default, with "as of Fri 30 Oct".
  - Follow-up row: "Keep this address to set a reminder before Tue 3 Nov". Outbound row: VoteWA.
  - Tue 3 Nov: chip "Today", with the follow-up row "Keep this address handy".
- Radon in January (Mon 11 Jan 2027):
  - Reading chip: "Zone 1".
  - Headline: "Clark County is EPA Radon Zone 1 — highest potential (county)."
  - Detail: "County zone from EPA. It says nothing about your home's level; only a test does."
  - Source: FILLED mark, the word "Official", then "EPA · county-wide estimate — only a test tells you about this home".
  - Follow-up row: "Keep this address handy".
  - Outbound row: "Get a free test kit · Washington Dept of Health ↗".
- Radon in January with no program link (Mon 11 Jan 2027, specimen): the same radon card for a hypothetical Zone 1 county, Laramie County, Wyoming, treated as a state with no program link. Headline "Laramie County is EPA Radon Zone 1 — highest potential (county)." Filled EPA mark, follow-up row "Keep this address handy", no outbound row, no gap. The same rule applies to a state with no official voter lookup.
- Ranked card with no seasonal match (Wed 4 Nov): the Clark County radon card, with no outbound row.
- Summer air (Tue 8 Sep):
  - Reading chip: "AQI 118".
  - Headline: "Air is Unhealthy for Sensitive Groups here today · AQI 118".
  - Detail: "Air quality index (AQI) 118, observed 4:00 PM."
  - Source: FILLED mark, "Official", then "AirNow · nearest monitors · observed 4:00 PM".
  - Follow-up row: "Keep this address handy". No outbound row.
- Tax card (Mon 19 Oct, drawn as if no voter rule were seeded):
  - Chip: "in 14 days · Mon 2 Nov".
  - Headline: "Property tax, second half, is due Mon 2 Nov in Clark County."
  - Detail: "Moved from Sat 31 Oct because that date is a Saturday."
  - Source: HOLLOW mark (seeded county row), "On record, not confirmed", then "Clark County Treasurer · county-wide · as of Mon 19 Oct".
  - Follow-up row: "Keep this address to set a reminder before Mon 2 Nov". No outbound row.
- Calm fallback (Wed 4 Nov, 6:10 PM), at the invented address 4417 Densmore Ave N, Seattle, WA 98103:
  - No chip.
  - Headline: "No active alerts · Air Good today (AirNow) · Outside FEMA's mapped floodplain".
  - Detail: "Air quality index (AQI) 42 · Good, observed 7:00 AM."
  - Source: one FILLED mark and the word "Official", printed once, heading three stacked SourceCaptions, one per authority: "National Weather Service · alerts for this area · checked 6:10 PM", "AirNow · nearest monitors · observed 7:00 AM", "FEMA · area flood zone · map effective Aug 2020".
  - Follow-up row: "Keep this address handy".
- Worst case, a specimen for the 90-character limit: "Clark County property tax, second half, is due Mon 2 Nov — moved from Sat 31 Oct, which is a Saturday." (102 characters, invented) becomes "Clark County property tax, second half, is due Mon 2 Nov — moved from Sat 31 Oct, which…". The cut falls at a word. The hollow mark, "On record, not confirmed" and the short source "Clark County Treasurer" stay. The real voter headline (80 characters) fits without a cut.

LAYOUT & VISUALIZATION
- Icon tile (42pt, radius lg): the KindGlyph tile variant in text.strong on surface.sunken, with no tone tint. Deadline cards use the voter-registration or property-tax glyph. Radon, air and calm cards use the existing hazard glyph, also in text.strong on surface.sunken.
- Chip slot, on the right of the header row. Use exactly one chip per card; deadline cards drop the grade badge.
  - Deadline cards: StatusChip, deadline variant, exactly as on the Foundations board. It is a 24pt pill on surface.sunken. It has a 12pt calendar-outline glyph and a captionMedium label, both in text.strong, and no border. Light mode uses no hue. In dark mode, only the "Today" glyph uses warning. The printed count ("in 7 days", "Tomorrow", "Today") carries the urgency.
  - Hazard cards: a neutral reading chip. It uses StatusChip geometry (24pt pill, surface.sunken, text.strong), with no AQI or semantic fill and no glyph. It shows that one layer's reading in the authority's words: "Zone 1" for radon. Air is the one exception: its chip shows "AQI 118", because the band words are already in the headline.
  - Calm fallback: no chip.
- Source: a SourceCaption with ProvenanceMark (S) at its head. Print the mark's word once, next to the mark. The whole caption line (44pt) is the tap target for ProvenanceSheet. On the calm card, the three captions stack under the single mark and word, each its own 44pt line.
- Two follow-up actions that must never look alike:
  - First, the sunken internal row with a chevron-right.
  - Under it, the TextActionRow outbound variant, as on the Foundations board. It is a row of 48pt minimum (44px on web), radius md, with a 1px text.secondary edge. The label is in bodySmall text.primary, with one trailing 16pt "↗" glyph. Draw the glyph once; the string's "↗" is that glyph, not a second one.
- Below the card, outside it, 16pt down: the share pair (web: "Compare with a friend"; apps: the TextActionRow share-compare pair and its two-sentence caption, as in f8-native-share-compare).
- The save stays the primary action. The outbound row is the only outbound link before the wall, at the moment of highest intent.
- Graceful degradation:
  - No program link for the state: the outbound row is absent. Leave no empty slot.
  - A program link exists but the state offers no free kits: the row reads "See the state radon program · " followed by the department's name and ↗. Never say "free" unless the state offers free kits. This state is not drawn.
  - Suppress each voting method once its own deadline passes. After 8:00 PM Tue 3 Nov, draw the ranked card instead.
  - A failed preview is handled by the host's error screen. Never draw an empty card shell.
- Wildfire, when promoted in summer: show it as a standing fact ("Wildfire hazard potential: High · 4 of 5 · USFS") paired with today's AirNow reading, never as current fire danger. PLACE B is Moderate 3 of 5, so it is never promoted there. This state is not drawn.

INTERACTION, MOTION & HAPTICS
- The follow-up row scrolls to the sticky wall on all three platforms and moves accessibility focus to the wall's headline. On a deep-link landing, scroll once, move accessibility focus to the highlighted card, and fade the highlight within 300ms.
- The outbound row opens a new tab on web, an in-app Safari view on iOS, and a Custom Tab on Android, so the preview survives.
- The caption opens ProvenanceSheet: a web modal, an iOS medium detent, or an Android bottom sheet.
- The chip is not interactive.
- Nothing animates on the chip or its count. Under Reduce Motion the highlight is a cross-fade.
- No haptics.

FOUNDATIONS COMPONENTS USED: KindGlyph (tile variant), StatusChip (deadline variant, plus the deadline-today state), ProvenanceMark (S), SourceCaption, ProvenanceSheet, TextActionRow (outbound variant: outbound-votewa and outbound-test-kits; share-compare pair under the card on the apps), WarmingSkeleton (section skeleton), OfflineNotice.

ACCESSIBILITY
- Reading order: overline, headline, chip, detail, source with mark word, follow-up row, outbound row.
- The chip reads "Deadline Monday 26 October, in 7 days". "Tomorrow" reads "Deadline tomorrow, Monday 26 October". "Today" reads "Deadline today, Monday 26 October".
- Mark names are spoken as "on record, not confirmed" and "official".
- Outbound rows read "Check or update at VoteWA, opens in browser" and "Get a free test kit, Washington Dept of Health, opens in browser".
- The KindGlyph tile is decorative (the headline names the kind).
- The chip label is text.strong on sunken (9.37:1). The outbound edge is at least 3:1.
- Urgency is never shown by hue alone.
- AX5: the header row stacks, with the chip under the overline. The headline wraps fully, and the outbound row wraps with its glyph trailing and top-aligned.
- Every frame must read correctly in greyscale.

COPY: every string above, plus:
- "Check or update at VoteWA ↗"
- "Get a free test kit · Washington Dept of Health ↗"
- Offline top line: "You're offline · as of 6:08 PM"
- Offline reason: "You're offline. You can open this when you're back."
- Mark words: "On record, not confirmed" and "Official".

Never write any of these:
- "closes Oct 26"
- "Quiet on every layer"
- "rarer than you'd think"
- "0 days"
- "midnight"
- "Claim this address" on this card
- "to get a reminder" (the person sets the reminder)
- any claim about whether the person is registered
- an unsourced comparison

EDGE CASES
- The longest headline: the 90-character specimen.
- The in-person phase.
- A deadline that is tomorrow, and one that is today.
- The voter card and the tax card both match: the voter card wins over the tax card.
- The tax-appeal window is not drawn. Clark County's deadline is conditional ("July 1, or 60 days after your value notice was mailed") and has no single date. For such a county, no dated "Assessment appeal window closes …" headline may render. A county with one fixed date would use the tax card's layout and a hollow mark.
- Summer with AQI under 101 and wildfire hazard under High: the ranked card shows, not the air card.
- Radon is present but is not the card's headline: the kit link appears only on the radon section card, never as a follow-up here.
- No program link for the state (frame 10), or no free kits (not drawn).
- A seed that is not yet checked (hollow) vs one that has been checked (filled).
- Offline: "You're offline · as of 6:08 PM" at the top; the card stays readable; the outbound row is disabled (text.secondary name and glyph) with its reason.
- Loading: a skeleton card at the final height.
- A device outside Pacific time: add "Pacific" after 8:00 PM.
- Tier: anonymous preview only — signed out on web, and on the apps signed out or signed in with no saved place. Never on a signed-in Today or a saved place's file.

INSTEAD OF
- Instead of "Voter registration … closes October 26", write the online-or-mail line plus the in-person line — because in-person registration stays open until 8:00 PM on Election Day.
- Instead of hiding the card on Tue 27 Oct, switch to the in-person headline — because that is the last open path for a late mover.
- Instead of a tinted or hue-bordered chip, draw the neutral deadline StatusChip with the count printed — because warning on sunken is 2.89:1 and the words carry the urgency.
- Instead of a "Quiet" chip over all layers, name only what is calm, each with its own source caption — because radon can be high in any zone and each fact has a different authority.
- Instead of reusing the follow-up row for the kit link, draw a separate bordered outbound row — because one button that does two things depending on the month misleads.
- Instead of "Claim this address to know the morning that changes" or "…to get a reminder", write "Keep this address to set a reminder before …" — because the row leads to the save, and a reminder exists only once the person sets one.
- Instead of keeping the native cards' tone-coloured grade chip and primary sign-up link, draw the web anatomy on all platforms — because the chip, source and follow-up must mean the same thing everywhere.
- Instead of dropping the mark in the 90-character version, keep the mark and the short source — because the unchecked seed is the honesty failure the pilot counts.
- Instead of a countdown ring or bar, draw the dated chip — because urgency is shown as a date.

DONE WHEN
- In October, a Washington address shows the method-specific headline with the Washington Secretary of State as its source. In January, a Zone 1 county shows the kit link.
- The summer air card appears only at AQI 101 or higher (or wildfire High or above).
- Every seeded row (voter, tax) is visibly hollow and says so at every size, including the 90-character version. Official datasets (EPA, AirNow, NWS, FEMA) are filled, and every fact on the calm card has its own named source.
- No frame shows a past deadline for any method, and no follow-up promises a reminder the person has not set.
- The follow-up row and the outbound row cannot be confused, and the chip matches the Foundations deadline chip exactly.
- The web, iOS and Android cards share one anatomy.
- The card is fully readable while signed out.

ARTBOARDS
1. f8-seasonal-aha · web-390 · 01-voter-7-days-unconfirmed · light — dense default on Mon 19 Oct, with a hollow mark, the follow-up row and the VoteWA row.
2. f8-seasonal-aha · web-390 · 02-voter-official · light — the same card with a filled "Official" mark.
3. f8-seasonal-aha · web-390 · 03-voter-18-days · light — Thu 8 Oct, chip "in 18 days · Mon 26 Oct".
4. f8-seasonal-aha · web-390 · 04-voter-tomorrow · light — Sun 25 Oct, chip "Tomorrow".
5. f8-seasonal-aha · web-390 · 05-voter-today · light — Mon 26 Oct, chip "Today", follow-up "Keep this address handy".
6. f8-seasonal-aha · web-390 · 06-in-person-phase · light — Fri 30 Oct, the in-person headline and detail.
7. f8-seasonal-aha · web-390 · 07-in-person-today · light — Tue 3 Nov, chip "Today".
8. f8-seasonal-aha · web-390 · 08-radon-january-kit · light — Mon 11 Jan 2027 Clark County radon card with the filled mark and "Get a free test kit · Washington Dept of Health ↗".
9. f8-seasonal-aha · web-390 · 09-deadline-passed-ranked · light — Wed 4 Nov, Clark County radon card with no outbound row.
10. f8-seasonal-aha · web-390 · 10-no-program-link · light — Mon 11 Jan 2027 radon card for Laramie County, annotated "hypothetical Zone 1 county in a state with no program link": filled EPA mark, follow-up "Keep this address handy", no outbound row, no gap.
11. f8-seasonal-aha · web-390 · 11-summer-air · light — Tue 8 Sep, reading chip "AQI 118", filled AirNow mark.
12. f8-seasonal-aha · web-390 · 12-tax-due · light — tax card, "in 14 days · Mon 2 Nov", hollow mark.
13. f8-seasonal-aha · web-390 · 13-calm-fallback · light — 4417 Densmore Ave N, no chip, one filled mark with three stacked captions (NWS, AirNow, FEMA).
14. f8-seasonal-aha · web-390 · 14-loading · light — WarmingSkeleton section skeleton at the card's final height.
15. f8-seasonal-aha · web-390 · 15-offline · light — "You're offline · as of 6:08 PM" at the top; the card readable; outbound row disabled with "You're offline. You can open this when you're back."
16. f8-seasonal-aha · web-390 · 16-token-90-specimen · light — a stand-alone specimen, not a host screen: the cut headline, the hollow mark with "On record, not confirmed", and the short source "Clark County Treasurer".
17. f8-seasonal-aha · web-1440 · 17-voter-7-days · light — the default in the preview's single centred column (the existing width) on surface.app.
18. f8-seasonal-aha · ios · 18-voter-7-days · light — the default in the iOS preview in the converted anatomy, with the TextActionRow share-compare pair and its two-sentence caption 16pt below the card.
19. f8-seasonal-aha · android · 19-voter-7-days · light — the default in the Android preview in the converted anatomy, with the share-compare pair and its caption 16dp below the card.
20. f8-seasonal-aha · ios · 20-ax5 · light — stacked header row, wrapped headline, wrapped outbound row.
21. f8-seasonal-aha · web-390 · 21-greyscale · light — frame 1 in greyscale.
22. f8-seasonal-aha · web-390 · 22-voter-7-days · dark — dark twin of frame 1.
23. f8-seasonal-aha · ios · 23-in-person-today · dark — dark twin of the Tue 3 Nov in-person card in the converted native anatomy, showing the warning-hued "Today" glyph that appears only in dark.
24. f8-seasonal-aha · Notes — list every invented string and delta date (8 Sep, 8 Oct, 25 Oct, 26 Oct, 30 Oct, 3 Nov, 4 Nov, 11 Jan 2027). Include: the follow-up strings "Keep this address to set a reminder before Mon 26 Oct / Tue 3 Nov / Mon 2 Nov"; the in-person detail; the tax detail "Moved from Sat 31 Oct because that date is a Saturday."; the calm-fallback address 4417 Densmore Ave N, Seattle, WA 98103 (assumed outside FEMA's mapped floodplain and not radon Zone 1; check both) and its captions, including "checked 6:10 PM" and "map effective Aug 2020" (invented); the Laramie County, Wyoming specimen (hypothetical no-program-link state; verify its zone; the no-link condition is invented); the 102-character tax specimen; "See the state radon program · …"; the offline top line and reason. Record surface deltas: outbound-test-kits reads "Get a free test kit · …" (verb-led) instead of the Foundations "Free test kits · …" — update the board or revert; confirm that WA DOH currently offers free kits before shipping the word "free". The reading chip is a surface-specific neutral pill with StatusChip geometry, not a published component. Deadline cards drop the grade badge (one chip per row, StatusChip rule; no cross-layer grade). The deadline chip follows the Foundations deadline variant (neutral, count first), replacing the earlier plan to keep an info-to-warning tint change. Native cards converted to the web anatomy (overline, 42pt KindGlyph tile, neutral chip, SourceCaption, sunken follow-up that scrolls to the wall instead of opening sign-up). Assumptions: voter beats tax when both match — confirm the seasonal headline order; the visitor is an unnamed newcomer, not Jordan Lee. Omitted states: the tax-appeal headline (conditional deadline), the no-free-kit radon row, and the wildfire summer card. Flag these open items: "Claim vs Keep" is resolved as Keep; the follow-up says "set a reminder" because reminders exist only once the person sets one after saving — confirm a saved place can set reminders for seeded civic dates; if not, every follow-up reads "Keep this address handy". The host's old radon line "One in four homes tested in Clark County came back above the action level." needs a named source before it returns. The compare link needs confidence and short-source fields, or the 90-character version cannot keep its mark and source. The tax card has no outbound link in v1. Signed-in visitors have no in-app civic destination from this card.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: artboards 7-12, then wait for "continue". Turn 3: artboards 13-18, then wait for "continue". Turn 4: artboards 19-24.
