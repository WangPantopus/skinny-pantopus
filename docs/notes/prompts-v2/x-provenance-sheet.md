# Where this fact comes from (provenance sheet + "This isn't right")
id: x-provenance-sheet · platforms: web/ios/android · isNew: True · artboards: 37

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Where this fact comes from · x-provenance-sheet

TYPE: NEW. This is the ProvenanceSheet component from the Foundations board, drawn with real payloads and every state. Copy ProvenanceMark, SourceCaption, ScopeChip and AqiBand from the Foundations board unchanged. This prompt shows how the sheet uses them. It does not redefine them.

ATTACH: screenshots of the Foundations board (prompt 00); the Today tab with its pickup card, 14-day strip and air band; the Place tab risk details with its scale strips; the compare reveal (Dana's card) on web-390; the seasonal aha card; and the DateSheet. These are the backdrops the sheet opens over.

PLATFORMS & VIEWPORTS
- iOS 393x852: a sheet with a visible Close at top right. It opens at the medium detent when the header, legend, Source, Updated, confidence sentence and Covers line all fit above the fold. Otherwise it opens at the large detent. At AX sizes it always opens large and scrolls.
- Android 412x915: ModalBottomSheet with a drag handle and a visible Close.
- Web 390x844: a bottom sheet. Web 1440x900: a centred modal, 560 wide, over a dimmed host.
- On all platforms: Android system Back and web Escape return from the report view to the default view; from the default view they close the sheet.

WHERE IT LIVES & HOW PEOPLE ARRIVE
The sheet has no tab and no URL of its own. It opens over the screen the person was reading (Place, Today or Nearby) and closes back to that screen. Focus returns to the row that opened it. Entry points:
- A DateRow on Today, in the household calendar or in the place file. The whole 56pt row is the target. Its custom action "Where this fact comes from" is also an entry.
- The FourteenDayStrip. On native apps and mobile web, tapping the strip scrolls to its rows, and a row opens the sheet. On desktop web a day cell moves focus to that day's DateRows; a DateRow opens the sheet. No cell opens the sheet directly.
- The PickupCard's SourceCaption row (whole row, 44pt). This opens the default view. Flow 2 also sends the pickup card's "Not my schedule" here, opening straight at the report view (artboard 2). The PickupCard contract sends "Change pickup day" directly to the DateSheet; which pickup-card label routes here is an open question for Notes.
- The seasonal aha card's SourceCaption row (whole row, 44pt).
- The whole AqiBand row on Today, including the alert landing (hit area at least 44pt).
- A ScaleStrip row in Place risk details, or a frozen row in the compare reveal.
- The "Your reports" row in the place file ("Pickup day · Checking · reported Mon 19 Oct"). It opens the sheet at the report status.
- A seeded civic or tax row.
- Phase 2: the bill provenance block on bill detail.
- "Where this fact comes from" inside the DateSheet. The content swaps in with Back; no second sheet stacks.
What each host hands over: the value, its bands, the source, the as-of time, the confidence, the source link (if any), which fact it is, its scope and any report status. The sheet therefore draws at once, with no loading screen.

WHO AND WHEN
Mon 19 Oct, 6:10 PM. Maya Chen is on Today for HOME A. The pickup card says "Garbage tomorrow" next to a ring. She taps the source row to see who says so. The city record gives only the weekday. She knows recycling also goes out tomorrow and then every other Tuesday, so she opens "This isn't right", ticks the box, picks "Wrong recycling week" and sets her own pickup day. Jordan Lee at PLACE B, who has only saved the address, reopens a report he sent on Mon 12 Oct. Later, Maya opens Dana's compare card and taps its Flood row.

THE ONE JOB
Answer three questions about one fact: where it came from, how sure anyone is and what it covers, and how to fix or report it.

FIRST FIVE SECONDS
1. The header row: the large mark with the value beside it.
2. The legend line with the current word emphasised, then Source and Updated.
3. The confidence sentence and the Covers line.
There is one primary action, and it depends on the fact type: the paired schedule actions ("Yes, Tuesday is right" / "Set my pickup day", the same peer pair as PickupCard, counted as one decision), an authority link ("Get a free test kit", the FEMA link) or "Edit this date". If none applies, the only action is the quiet "This isn't right".

CONTENT
Use the house FIXTURES. Every payload has exactly one Covers line. Covers states only the area or the people the fact applies to. The confidence sentence states only how sure anyone is. Draw one payload per frame:
- P1, on record (HOME A pickup), hollow mark. Value "Garbage · Tuesdays". Caption "Recycling frequency: Not set". Source "City of Vancouver schedule · Waste Connections". Updated "Mon 12 Oct 2026". Covers "The Waste Connections route that includes this address". ScopeChip "Your household". Address "2418 NE Larkspur Loop, Vancouver, WA 98684". Source row "Waste Connections · Pickup schedule ↗". The city record deliberately gives only the weekday; the fixture's full schedule (recycling every other Tuesday, next Tue 20 Oct) is what Maya confirms.
- P1-mine, after Maya's self-fix, tick mark. Value "Garbage every Tuesday · recycling every other Tuesday". Caption "Next recycling Tue 20 Oct · tomorrow". Source "You". Updated "Set Mon 19 Oct 2026". Covers "Your household". ScopeChip "Your household".
- P2, official (flood), filled mark. Value "Zone X — minimal flood hazard". Source "FEMA · area zone · effective Sep 2021". Method "FEMA Flood Insurance Rate Map". Updated "Effective Sep 2021". Covers "The FEMA map area that includes this address". ScopeChip "Your household". Source row "FEMA flood map ↗".
- P3, you added (lease), tick mark. Value "Lease ends Wed 31 Mar 2027" with caption "in 163 days". Detail "Tell your landlord in writing by Mon 1 Mar 2027 · in 133 days" and "Reminder Mon 15 Feb 2027". Source "You". Updated "Added Mon 14 Sep 2026". Covers "Your household".
- P4, no link (air), filled mark. Label "Air quality index (AQI)" above an AqiBand detail reading "AQI 42 · Good · PM2.5". Source "AirNow · nearest monitors · observed 7:00 AM". EPA text, word for word: "Air quality is satisfactory, and air pollution poses little or no risk." Covers "The nearest AirNow monitors". ScopeChip "Your household". In place of a source row, draw the flat caption "No public page for this reading".
- P4-alert: the same layout at 4:00 PM. AqiBand alert variant reading "AQI 118 · Unhealthy for Sensitive Groups · PM2.5", a threshold rule captioned "Crossed 101 at 4:00 PM", ScopeChip "Your household", and EPA's statement word for word: "Members of sensitive groups may experience health effects. The general public is less likely to be affected."
- P5, official (radon), filled mark. Value "Radon Zone 1 — highest potential (county)". Source "EPA · county-wide · map published 1993". Updated "Map published 1993". Covers "All of Clark County". ScopeChip "Your household".
- P6, seeded deadline, hollow mark. Value "Property tax 2nd half due in 14 days · Mon 2 Nov". Detail "Moved from Sat 31 Oct". Source "Clark County Treasurer · county-wide". Updated "Mon 12 Oct 2026". Covers "All of Clark County".
- P7, phase 2 (Clark Public Utilities bill), tick mark, because the amount was confirmed. Value "$142.18 due in 4 days · Fri 23 Oct". Source "Clark Public Utilities bill · from a photo you took". Updated "Confirmed Sat 17 Oct". Covers "This Clark Public Utilities account at Larkspur Loop". No ScopeChip; the only visibility statement is "You and Sam can see this bill."
- P8, official (wildfire), filled mark. Value "Wildfire hazard potential: Moderate · 3 of 5". Source "USFS · relative hazard, modelled · 2023". Method "USFS Wildfire Hazard Potential, 270 m national model". Updated "2023 version, released Jun 2024". Covers "The 270 m model cell that includes this address". ScopeChip "Your household". Source row "USFS wildfire hazard data ↗".
- PB, PLACE B pickup, hollow mark. Value "Garbage · Thursdays". Caption "Recycling frequency: Not set". Source "City of Camas schedule". Updated "Thu 15 Oct 2026". Covers "The City of Camas route that includes this address". ScopeChip "Saved place · Only you". Address "1107 NE Birchfield Ct, Camas, WA 98607".
Worst cases: PB at AX5, and P1 at AX5 with the longer HOME A address.

LAYOUT & VISUALIZATION
Top to bottom, in every payload frame:
1. Title, with Close.
2. Header row. ProvenanceMark L (56pt) leads. To its right are the value in h3 and its caption. The L mark is visual only and is not a target.
3. Legend line directly under the header row: "● Official · ○ On record, not confirmed · ✓ You added this". Draw each legend glyph as ProvenanceMark M. The characters in this string only stand for the three marks; never set them as typed characters. Emphasise the current word with semibold weight and a 2px text.primary underline, never with colour.
4. Label/value pairs: "Source" and "Updated" in every payload, plus "Method" for flood and wildfire.
5. The confidence sentence in body text.
6. The Covers line (label "Covers" plus value).
7. The ScopeChip and the address line (P7: the visibility sentence instead).
8. The source row: 44pt, with an external-link glyph. If there is no link, draw a flat caption that is not a target.
9. The foot (see below).

Why it is shaped this way: the product used to write "unverified" four different ways (a row suffix, a push parenthetical, a widget glyph, and nothing on the share card). A word on every row becomes boilerplate, so the shape repeats and the word appears once per surface. Almost nobody opens this sheet (about 0.13% of mobile citation views get a click), so the host row must already carry any caveat that changes what someone does. This sheet is the audit trail. Push is the one place the caveat rides in the title. The report is how we learn a schedule is wrong, so every report must end in a dated receipt and a visible outcome.

Keep confidence and scope apart. FEMA, USFS and EPA data use the FILLED mark, and the Covers line says what they cover. HOLLOW is only for facts a household can confirm (pickup, seeded deadlines). Show no number, bar or meter for confidence.

The foot has two views.
(a) DEFAULT FOOT (artboard 1 shows this). First the fact type's primary action, if there is one. Then the quiet text button "This isn't right".
- Schedule: two peer outlined buttons of identical weight, "Yes, Tuesday is right" ("Yes, Thursday is right" for PB) and "Set my pickup day", then "This isn't right" below.
- Flood: body line "Only FEMA can change this." and the outbound TextActionRow "How to request a Letter of Map Amendment · FEMA ↗".
- Wildfire: no primary; only "This isn't right".
- Radon: the outbound TextActionRow "Get a free test kit · Washington Dept of Health ↗" as the primary. This is the only test-kit action in this sheet.
- Seeded deadline: the outbound row "Clark County Treasurer ↗".
- Air: no primary; only "This isn't right".
- You added (lease, P1-mine): primary "Edit this date" (P1-mine: "Set my pickup day"). No "This isn't right".
- Bill (P7): primary "Fix what we read", then "View the photo". No report to Pantopus and no "This isn't right".
(b) REPORT VIEW, reached from "This isn't right". The content swaps in place with Back, under the heading "What's wrong?". Reasons are platform radio rows.
- Schedule: "Set my pickup day" on top. Under it, the checkbox "Also tell us the city's schedule looks wrong". Ticking it reveals the radio rows "Wrong pickup day", "Wrong recycling week" and "Not my service" and an outlined "Send report". If the box is ticked with no reason chosen, Send report stays disabled with the caption "Pick what's wrong to send this."
- Flood: "Only FEMA can change this." with the LOMA row, then the separate reason "We matched the wrong spot" (Pantopus checks this one) and "Send report". Never promise to check the FEMA zone.
- Wildfire: the one reason "We matched the wrong spot" and "Send report".
- Radon: the test-kit row, then the reason "We matched the wrong county" and "Send report". Never promise to check the EPA zone.
- Air: one reason, "This reading looks wrong".
- Seeded deadline: "Wrong date" and "Doesn't apply to this address".

Schedule sequence (draw exactly this):
- "Send report" alone: the report sends, the sheet stays open, the receipt replaces the reasons, and "Set my pickup day" stays above it as the primary. The mark stays hollow (artboard 3).
- Box ticked and a reason chosen, then "Set my pickup day": the report sends first (success tick), then the sheet dismisses to the DateSheet. The receipt is waiting when the sheet is reopened (artboard 15).
- Box unticked, then "Set my pickup day": no report is sent; the sheet dismisses to the DateSheet.
- "Set my pickup day" hands off to the DateSheet pickup kind with weekday Tuesday (Thursday for PB) prefilled, frequency Not set, and the Next recycling field empty; recycling is never inferred.
- "Yes, Tuesday is right" confirms in place: the header mark becomes the tick, Source becomes "You", Updated becomes "Confirmed Mon 19 Oct 2026", and the caption stays "Recycling frequency: Not set" (artboard 4).

Receipt pattern: "Reported {date}. We'll check it against {authority, or our address match} by {date} and tell you here." Examples:
- P1: "Reported Mon 19 Oct. We'll check it against Waste Connections by Mon 26 Oct and tell you here."
- P6: "Reported Mon 19 Oct. We'll check it against Clark County Treasurer by Mon 26 Oct and tell you here."
- Flood, wildfire or radon wrong spot/county: "Reported Mon 19 Oct. We'll check our address match by Mon 26 Oct and tell you here."
- Air: "Reported Mon 19 Oct. We'll check it against AirNow by Mon 26 Oct and tell you here."
When a report-only sheet is reopened, the mark keeps its hollow shape and a status line reads "You reported this · checking" above the receipt. When Maya's self-fixed sheet is reopened (artboard 15), it shows her rule (P1-mine, tick mark, Source "You") with a status block beneath it: "You reported the city's schedule · checking" and the P1 receipt.

Resolved states (PB; Jordan reported "Wrong pickup day" on Mon 12 Oct; before the fix we showed Wednesday). Draw two alternative outcomes:
- Artboard 13, Fixed: header shows "Garbage · Thursdays", hollow mark (still not confirmed by Jordan), Updated "Thu 15 Oct 2026", and "Fixed Thu 15 Oct: we had this street on Wednesday. City of Camas lists it on Thursday routes, so your pickup day now shows Thursday."
- Artboard 14, No change: header shows "Garbage · Wednesdays", hollow mark, Updated "Sat 10 Oct 2026", and "No change · Thu 15 Oct: City of Camas still lists Wednesday for this street." with "See their page ↗".

Degraded states:
- No link: the flat caption.
- Not on record: no mark, the value "Not on record" (for flood: "FEMA hasn't mapped flood hazard here"), a source line naming who was checked, and the legend with no word emphasised.
- Stale: the mark at 50% opacity, plus the FreshnessLine age words. The words carry the meaning, not the dimming.

INTERACTION, MOTION & HAPTICS
- "This isn't right" swaps the content in place and adds Back. Never open a second sheet.
- "Set my pickup day" and "Edit this date" dismiss this sheet, then present the DateSheet. "Fix what we read" dismisses this sheet, then opens the extraction fix. "View the photo" dismisses this sheet, then opens the mail piece photo. Sheets never stack.
- The source row opens a new tab on web, SFSafariViewController on iOS and a Custom Tab on Android.
- Close is always visible. Back and Escape follow the rule in PLATFORMS. Drag-to-dismiss is never the only way out.
- Content swaps: by default, a 200ms cross-fade with a 16pt slide. With Reduce Motion, a 200ms cross-fade with no slide.
- One light haptic tick when a report sends successfully and when "Yes, Tuesday is right" confirms, and nowhere else.
- The report status loads in place. Show nothing for the first second, then the FreshnessLine "Updating…" on the status line only.

FOUNDATIONS COMPONENTS USED
ProvenanceSheet (all variants), ProvenanceMark (L in the header, M in the legend, S in captions, stale variant, reported variant), SourceCaption (including the no-URL variant), ScopeChip, AqiBand (detail and alert variants), FreshnessLine, OfflineNotice, InlineErrorRow, TextActionRow (outbound variant), LockedActionRow (names-who-can-act variant), DateSheet (view-seeded variant as host of artboard 22; pickup kind as the handoff target), DateRow (host row), FourteenDayStrip (marks board only), PickupCard (backdrop only; its peer button pair is mirrored in the schedule foot), ScaleStrip (compare frozen variant, as the host row).

ACCESSIBILITY
- Reading order matches visual order: title; header (value plus mark name, e.g. "Garbage, Tuesdays, on record, not confirmed"); legend; source; updated; method if present; confidence; Covers; scope ("Visible to your household"); address; source link; foot actions.
- Spoken mark names: "official", "on record, not confirmed", "you added this".
- The legend is read once: "Key: filled disc, official; ring, on record, not confirmed; disc with tick, you added this."
- AqiBand summary: "Air quality index 42, Good, category 1 of 6. AirNow, observed 7 AM." Alert summary: "Air quality index 118, Unhealthy for Sensitive Groups, category 3 of 6, above your 101 alert level since 4 PM. AirNow."
- Outbound rows are spoken "<destination>, opens outside Pantopus"; the ↗ is the external-link glyph, not a typed character.
- Retry is labelled "Retry sending report". The offline caption under the report control reads "Reporting needs a connection."
- The report status is a polite live region (role=status).
- Focus is trapped in the sheet, and the title is unique.
- Targets: 44pt on iOS, 48dp on Android with 8dp gaps, 44px on web.
- Disabled controls stay focusable and read their reason.
- Radio rows and the checkbox show selection differently from focus.

COPY
- Title: "Where this fact comes from"
- Labels: "Source" · "Updated" · "Method" · "Covers" · "What's wrong?"
- Controls: "This isn't right" · "Back" · "Close" · "Send report" · "Set my pickup day" · "Yes, Tuesday is right" · "Yes, Thursday is right" · "Edit this date" · "Fix what we read" · "View the photo"
- Confidence sentences:
  - P1: "On record, not confirmed. This is the schedule for your area. Nobody in your household has confirmed it for this address yet."
  - PB: "On record, not confirmed. This is the schedule for your area. You haven't confirmed it for this address yet."
  - P1-mine: "You added this. You can change it at any time."
  - P2: "Official. FEMA publishes and maintains this flood map."
  - P8: "Official. USFS publishes this as a modelled estimate, not a field check."
  - P3: "You added this. You can change it at any time."
  - P4: "Preliminary reading from AirNow, observed 7:00 AM. It hasn't had EPA's full checks yet." For the alert, use 4:00 PM.
  - P5: "County zone from EPA. It says nothing about your home's level; only a test does."
  - P6: "On record, not confirmed. We copied this from the county and haven't checked it by hand yet."
  - P7: "We read this from your photo. You confirmed the amount on Sat 17 Oct."
- Errors and offline:
  - Failed: "We couldn't send your report. Your answer is saved · Retry"
  - Offline: "You're offline · as of 7:04 AM", "Reporting needs a connection." and "The source page needs a connection."
  - Slipped check: "Still checking. It's taking longer than we said. New date: Mon 2 Nov."
  - Stale: "Observed 7:00 AM · AirNow — 11 hours ago"
  - Guest: "Maya or Sam can change the pickup day here"
  - No reason chosen: "Pick what's wrong to send this."

EDGE CASES
- AX5: header row stacks (mark above the value), every label/value pair stacks, text wraps and never truncates, and the sheet scrolls at the large detent. Check both PB and P1 with its longer address.
- A Guest in HOME A sees "Yes, Tuesday is right" and "Set my pickup day" disabled, with a LockedActionRow under them reading "Maya or Sam can change the pickup day here". They can still send a report.
- A household member without finance permission never reaches P7, and the host row hides the amount.
- A frozen compare row shows "Dana · Camas, WA — what's on record for this area" and "as of Sat 12 Sep 2026" in place of the ScopeChip. It has the method, the effective date and "Only FEMA can change this." with the LOMA row, and no report control, because it is not the viewer's address.
- Slow network: only the status line waits.
- Offline: cached content stays, with the report control and source row disabled and their reasons shown.

INSTEAD OF
- Instead of an "Unverified" suffix or an amber chip, draw the 56pt ring and the emphasised legend word, because shape plus one word is the product-wide code, and amber reads as an error.
- Instead of the same two reasons on every fact, draw reasons for that fact type with the self-fix first, because owners fix their own copy and authorities own their data.
- Instead of "Thanks — we'll check it", draw the dated receipt and the checking and resolved states, because a report needs a receipt, a date and a visible outcome.
- Instead of a hollow mark on FEMA, USFS or EPA data, draw it filled with a Covers line, because their limit is scope, not doubt.
- Instead of putting doubt in the Covers line, keep Covers to area or people only, because scope and confidence are different facts.
- Instead of a percentage, meter or stars, draw the confidence sentence, because a number fakes a precision nobody has.
- Instead of a red or confirm-gated "This isn't right", draw a quiet text button, because reporting is routine.
- Instead of a second sheet on top, swap the content and add Back, because stacked sheets strand screen-reader focus.

DONE WHEN
- On iOS at default text size, someone can say who published the fact, how sure anyone is and what it covers without scrolling.
- Every payload frame shows exactly one Covers line.
- The schedule report view leads with "Set my pickup day", and the self-fix works without sending a report.
- A hollow schedule fact can be confirmed with one tap in the sheet.
- The flood, wildfire and radon views never promise to check the FEMA, USFS or EPA designation; only "We matched the wrong spot" or "We matched the wrong county" reaches Pantopus.
- Every report ends in a dated receipt that is still there when the sheet is reopened.
- The resolved frames show what was corrected, its source and a one-line reason even when nothing changed.
- The marks board still separates the three marks in greyscale, in accented rendering and at AX5.
- No frame has a dead link or a target smaller than 44pt.

ARTBOARDS
1. x-provenance-sheet · ios · 01-unconfirmed-schedule · light — P1 over Today, default foot with the peer pair and "This isn't right", medium detent.
2. x-provenance-sheet · ios · 02-report-schedule · light — report view: self-fix on top, checkbox ticked, "Wrong recycling week" selected, Send report enabled.
3. x-provenance-sheet · ios · 03-reported-checking · light — report-only path: hollow mark, dated receipt as a status block, Set my pickup day still above it.
4. x-provenance-sheet · ios · 04-confirmed-in-place · light — after "Yes, Tuesday is right": tick mark, Source "You", frequency still Not set.
5. x-provenance-sheet · ios · 05-official-flood · light — P2 with Method, Covers and the LOMA foot.
6. x-provenance-sheet · ios · 06-report-authority-flood · light — report view: "Only FEMA can change this." plus "We matched the wrong spot".
7. x-provenance-sheet · ios · 07-no-link-air · light — P4 with the AqiBand, AQI label and flat caption.
8. x-provenance-sheet · ios · 08-air-alert-report · light — P4-alert in report view, "This reading looks wrong" selected, Send report.
9. x-provenance-sheet · ios · 09-official-radon · light — P5 with the test-kit primary; inset: report view with "We matched the wrong county".
10. x-provenance-sheet · ios · 10-official-wildfire · light — P8 with Method, Covers and only "This isn't right".
11. x-provenance-sheet · ios · 11-seeded-deadline-report · light — P6 report view with its date reasons.
12. x-provenance-sheet · ios · 12-you-added-lease · light — P3 with "Edit this date" and no report.
13. x-provenance-sheet · ios · 13-resolved-fixed · light — PB, "Saved place · Only you", Fixed (Wednesday corrected to Thursday).
14. x-provenance-sheet · ios · 14-resolved-no-change · light — PB, No change (still Wednesday), with the city link.
15. x-provenance-sheet · ios · 15-reopened-self-fixed-checking · light — P1-mine reopened: tick mark, Source "You", status block "You reported the city's schedule · checking" with the receipt.
16. x-provenance-sheet · ios · 16-check-slipped · light — the same view on Tue 27 Oct: new date Mon 2 Nov.
17. x-provenance-sheet · ios · 17-report-failed · light — InlineErrorRow, reason kept, self-fix live.
18. x-provenance-sheet · ios · 18-offline · light — cached P1, report and source row disabled with reasons.
19. x-provenance-sheet · ios · 19-status-loading · light — cached content, "Updating…" on the status line only.
20. x-provenance-sheet · ios · 20-stale-air · light — P4 at 6:10 PM: dimmed mark, "Observed 7:00 AM · AirNow — 11 hours ago".
21. x-provenance-sheet · ios · 21-not-on-record · light — flood with no data: no mark, "FEMA hasn't mapped flood hazard here", legend with no word emphasised.
22. x-provenance-sheet · ios · 22-opened-from-date-sheet · light — content swap with Back inside the DateSheet (view-seeded).
23. x-provenance-sheet · ios · 23-guest-locked · light — HOME A Guest: peer pair disabled with LockedActionRow.
24. x-provenance-sheet · ios · 24-bill-from-photo · light — P7, tick mark, visibility sentence, "Fix what we read" and "View the photo".
25. x-provenance-sheet · web-390 · 25-frozen-compare-flood · light — Dana's frozen Flood row, no report control.
26. x-provenance-sheet · android · 01-unconfirmed-schedule · light — ModalBottomSheet.
27. x-provenance-sheet · android · 02-report-schedule · light — M3 radio rows and checkbox, "Wrong recycling week" selected.
28. x-provenance-sheet · web-1440 · 01-unconfirmed-schedule · light — 560 modal over Today.
29. x-provenance-sheet · web-390 · 07-no-link-air · light — bottom sheet.
30. x-provenance-sheet · ios · 26-ax5-place-b · light — PB report view at AX5, "Wrong recycling week" selected, stacked pairs, large detent.
31. x-provenance-sheet · ios · 27-ax5-home-a · light — P1 at AX5, full HOME A address wrapping.
32. x-provenance-sheet · ios · 28-greyscale · light — artboard 1 in greyscale.
33. x-provenance-sheet · ios · 29-marks-in-place · light — marks copied unchanged from Foundations and shown in place: XS 12pt in a strip cell, S 16pt in a DateRow, M 24pt legend, L 56pt header, widget glyph, 28px on an OG card. Add hit-area overlays showing the row or strip as the target, captioned "Marks are visual only". Add a row scaled to AX5, a row in tinted accented widget rendering (tick still knocked out), and a greyscale row.
34. x-provenance-sheet · ios · 29-marks-in-place · dark — dark twin of 33.
35. x-provenance-sheet · ios · 01-unconfirmed-schedule · dark — dark twin of 1.
36. x-provenance-sheet · ios · 07-no-link-air · dark — dark twin of 7, AQI keyline check.
37. x-provenance-sheet · ios · 99-notes · light — Notes (see below).

Notes artboard must list:
- Invented strings: every payload Source, Method, Updated, Covers, caption, source-row and outbound string above, every receipt, status, outcome and error string, and every reason label is invented except the fixture facts (addresses, people, readings, dates, the civic tax date and the EPA text). Name these explicitly: "City of Vancouver schedule · Waste Connections"; "Waste Connections · Pickup schedule ↗"; "The Waste Connections route that includes this address"; "The FEMA map area that includes this address"; "The nearest AirNow monitors"; "The City of Camas route that includes this address"; "The 270 m model cell that includes this address"; "This Clark Public Utilities account at Larkspur Loop"; "USFS wildfire hazard data ↗"; "2023 version, released Jun 2024"; Method "FEMA Flood Insurance Rate Map"; the Updated dates Mon 12 Oct 2026, Sat 10 Oct 2026 and Thu 15 Oct 2026; "map published 1993"; the 101 threshold (it must match the person's own alert setting); the Guest; "What's wrong?"; the reason labels; all four receipts; "You reported this · checking"; "You reported the city's schedule · checking"; both resolved outcomes and the Wednesday premise (Jordan reported "Wrong pickup day" on Mon 12 Oct; artboard 14 is an alternative in which the city still lists Wednesday, which departs from the fixture's Thursday); "Still checking. It's taking longer than we said. New date: Mon 2 Nov."; "You and Sam can see this bill."; "Confirmed Sat 17 Oct"; "Reporting needs a connection."; "The source page needs a connection."; "Pick what's wrong to send this."; "Pickup day · Checking · reported Mon 19 Oct"; "How to request a Letter of Map Amendment · FEMA ↗"; "Get a free test kit · Washington Dept of Health ↗"; "Clark County Treasurer ↗"; "See their page ↗".
- HOME A's city record deliberately gives only the weekday; the fixture's full schedule is what Maya confirms.
- Verify both EPA statements against the current EPA AQI technical document.
- Radon outbound uses the verb-led "Get a free test kit" per the ProvenanceSheet variant; the TextActionRow example string ("Free test kits · Washington Dept of Health ↗") should be updated to match.
- The stale mark at 50% opacity drops below 3:1; the FreshnessLine words carry the meaning.
- The report service does not exist yet; its states are drawn anyway.
- The 7-day check-by window is a placeholder. The founder must confirm a window she can actually meet.
- All three schedule reasons ("Wrong pickup day", "Wrong recycling week", "Not my service") map to the honesty-counter tag "not my schedule" (open question for the report service). "Wrong recycling week" also covers a missing recycling week. Flow 11's "Not my day" wording is folded into "Wrong pickup day". A self-fix with the checkbox unticked sends no report (product call).
- Pickup-card routing: per the PickupCard contract, "Change pickup day" opens the DateSheet directly. Flow 2's "Not my schedule" route into this sheet's report view is an open question.
- Flow 2's checkbox says "county map" for a county source. This sheet uses "Also tell us the city's schedule looks wrong" because HOME A and PLACE B both have city sources. A county-sourced fact swaps "city's schedule" for "county map".
- The DateRow contract's custom action should be renamed from "Where this comes from" to "Where this fact comes from".
- "Only FEMA can change this." replaces the earlier "Only FEMA can change a flood zone." to match the contract.
- The slipped-check frame is drawn as a later date (Tue 27 Oct) than TODAY.

BATCH PLAN
Turn 1: artboards 1-6, then wait for "continue".
Turn 2: 7-12, then wait.
Turn 3: 13-18, then wait.
Turn 4: 19-24, then wait.
Turn 5: 25-30, then wait.
Turn 6: 31-36, then wait.
Turn 7: 37.
