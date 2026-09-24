# flow-11 · 'This isn't right' from report to visible resolution (journey storyboard)
id: flow-11 · platforms: ios/android/web-390/web-1440 · artboards: 13

# flow-11 · "This isn't right" from report to visible resolution (journey storyboard)

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

TYPE: NEW (storyboard). Every screen in this journey already has its own designed project. Do not redesign any screen. Lay the screens out as one connected journey, redraw only the deltas listed for each frame, and draw the connections: trigger arrows, time gaps, moment-of-truth callouts, failure branches and where they rejoin. This storyboard also draws the part no screen prompt has drawn yet: what happens after the receipt, and where the answer shows up.

ALT TIMELINE. flow-02 is the main timeline for Jordan (he self-fixes and reports on Wed 21 Oct; the report resolves Tue 27 Oct). This storyboard is an alternative: Jordan reports on Mon 19 Oct without self-fixing. Put "ALT TIMELINE · Jordan reports on Mon 19 Oct without self-fixing (flow-02 is the main timeline)" in every artboard header, and tag every frame dated after Mon 19 Oct "ALT TIMELINE (founder to pick vs flow-02)". The pattern (receipt, checking, resolved outcome on the card, strip and Your reports) is the deliverable; the dates are alternative.

ATTACH (exported artboards, by exact name):
- f1-today-tab · ios · 02-saved-place-quiet · light
- f5-today-calendar-strip · ios · 03-saved-place-unconfirmed · light
- f5-today-calendar-strip · ios · 11-offline · light
- f5-today-calendar-strip · ios · 14-saved-outside-window · light
- x-date-sheet · ios · 02-create-empty · light
- x-date-sheet · ios · 03-pickup-weekly-saved-place · light
- x-date-sheet · ios · 10-tax-appeal-unchecked-empty · light
- x-date-sheet · ios · 11-tax-appeal-computed · light
- x-date-sheet · ios · 24-save-failed · light
- x-date-sheet · ios · 26-offline-create · light
- x-provenance-sheet · ios · 02-report-schedule · light
- x-provenance-sheet · ios · 03-reported-checking · light
- x-provenance-sheet · ios · 04-confirmed-in-place · light
- x-provenance-sheet · ios · 05-official-flood · light
- x-provenance-sheet · ios · 06-report-authority-flood · light
- x-provenance-sheet · ios · 09-official-radon · light
- x-provenance-sheet · ios · 11-seeded-deadline-report · light
- x-provenance-sheet · ios · 13-resolved-fixed · light
- x-provenance-sheet · ios · 14-resolved-no-change · light
- x-provenance-sheet · ios · 16-check-slipped · light (source of the slipped status line only)
- x-provenance-sheet · ios · 17-report-failed · light
- x-provenance-sheet · ios · 18-offline · light
- x-provenance-sheet · ios · 22-opened-from-date-sheet · light
- x-provenance-sheet · ios · 26-ax5-place-b · light (source of the PLACE B payload, the "PB payload")
- x-provenance-sheet · android · 02-report-schedule · light
- x-place-file · ios · 02-saved-place-first-week · light
- x-place-file · web-390 · 10-your-reports · light
- x-place-file · web-1440 · 16-dense-home · light (for the web 320 column only)
- f4-today-pickup-card · ios · 06-saved-place-unconfirmed · light
- f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now · light
- The Foundations boards (prompts 00a, 00b, 00c, 00d).
Where a frame below says REDRAW, start from the named export and change only the listed deltas. Where it says NO EXPORT, draw it faithfully from the description, using Foundations components only.

PB PAYLOAD
Several x-provenance-sheet exports (15, 16, 17, 18) hold Maya's cached HOME A payload (Waste Connections, Tuesday, "Your household", Source "You"). Wherever a frame says "with PLACE B values (PB payload)", draw instead: hollow L header "Garbage · Thursdays", caption "Recycling frequency: Not set", Source "City of Camas schedule", Updated "Thu 15 Oct 2026", Covers "The City of Camas route that includes this address", ScopeChip "Saved place · Only you". No tick, no Source "You", no Waste Connections, no "Your household".

PERSONA & SITUATION
- Jordan Lee, 36, tier T1, at PLACE B, 1107 NE Birchfield Ct, Camas, WA 98607 ("Saved place · Only you").
- He moved from Portland on Fri 9 Oct and saved the place on Sat 10 Oct, so FirstWeekRow and the "Set up your place" block are gone.
- His City of Camas pickup day is Thursday (HOLLOW, on record, not confirmed), and his recycling frequency is Not set. Pantopus seeds only the weekday; the frequency stays Not set until a person sets it (research principle P17). He has not turned notifications on (in this alternative timeline).
- Assumption: Jordan bought PLACE B. The county's value notice for it was mailed Mon 14 Sep 2026 to the seller, who passed it on.
- TODAY is Mon 19 Oct 2026, 6:10 PM. He believes two things are wrong:
  (1) the property-tax appeal deadline he heard, 1 July, does not fit his notice;
  (2) the pickup row says which bins go out isn't set, while every cart on his street goes out for recycling each Thursday.
- He wants the city's answer before he sets anything himself.

GOAL: Report a fact once, fix what he can himself, and later see what happened, on the same row where he found the problem.

§5 METRIC THIS JOURNEY MOVES
- Honesty (bar: 0): bar 0 applies to pickup pushes without the caveat; reports are counted and must resolve visibly within their window. The honesty counter reads every user report tagged "not my schedule", and all three schedule reasons map to that tag. This journey shows one such report resolved and visible within its window.
- Returns by trigger (§5 week-one/four/eight buckets): beside each session_open caption, print the week. Jordan's day 0 is Sat 10 Oct: Mon 19 Oct and Wed 21 Oct are week 2, Wed 28 Oct is week 3 (no §5 bucket), and Wed 4 Nov (day 25) is week 4 (week-four bucket, but Jordan is not activated, so it falls outside "among activated").
- Secondary: the tax-appeal date is an F5 date, a household fact. Jordan's 7-day activation window closed Sat 17 Oct, so it does not count toward activation. Say so on Notes.

EVENT CAPTIONS
Under every frame, print the event it writes, exactly as listed on that frame below. If a frame lists no event, print "no event". Never invent an event name. Names marked "(invented)" are proposals and go on Notes.

THE HAPPY PATH

Part 1 — a conditional deadline he can fix himself

F01 · iOS · f5-today-calendar-strip · 03-saved-place-unconfirmed, inside f1-today-tab · ios · 02-saved-place-quiet, with FirstWeekRow removed · Mon 19 Oct, 6:10 PM.
- Shows: "Next 14 days: 4 items". Hollow marks on Thu 22 and Thu 29. The row "Pickup day · Which bins go out isn't set yet · in 3 days · Thu 22 Oct · City of Camas · weekday only · 2026 calendar" with its "Set your pickup day" button. The Mon 26 Oct statewide bar. The Fri 30 Oct insurance tick. "+ Add a date" and "Only you will see this."
- Does: taps the whole 44pt "+ Add a date" row.
- Event: session_open · trigger organic · week 2 (no §5 bucket).
- MOMENT OF TRUTH: The row is the target, never a strip cell or a dot.

F02 · iOS · x-date-sheet · 02-create-empty. Attach it as-is.
- Shows: "Add a date", "What's this date for?" and the 2 × 5 kind grid.
- Does: taps the "Property-tax appeal" tile. The sheet switches in place to view-seeded mode, with the title "Property-tax appeal".
- Event: no event.

F03 · iOS · x-date-sheet · 10-tax-appeal-unchecked-empty. REDRAW at PLACE B with these deltas: no "Visible to" chips, footer "Only you will see this.", and the rule reads "Closes July 1, or 60 days after your value notice was mailed, whichever is later."
- Shows:
  - Caption "Clark County Board of Equalization · county-wide · 2026 rules", with the hollow mark and "On record, not confirmed", and the line "Not yet checked against Clark County Board of Equalization".
  - "Your county lets you challenge the assessed value your tax is based on."
  - DateRow conditional rule (as above), then "Late appeals can't be accepted.".
  - Input "When was your notice mailed?", with "I haven't got one yet".
  - Remind me disabled, with "Add the mailing date to set reminders.". "This isn't right" is live.
- Does: enters Mon 14 Sep 2026.
- Event: no event.
- MOMENT OF TRUTH: A conditional deadline is never shown as a single seeded date.

F04 · iOS · x-date-sheet · 11-tax-appeal-computed, then the Today status line (two frames in one bracket).
Left (the sheet): REDRAW at PLACE B with these deltas:
- No "Visible to" chips; footer "Only you will see this.".
- The rule reads "Closes July 1, or 60 days after your value notice was mailed, whichever is later.", keeps the HOLLOW mark and "Not yet checked against Clark County Board of Equalization". This is the same seed as in F03; the export draws it filled.
- Under Remind me, add "Notifications are off. These show on Today and in your place file.".
The sheet shows:
- "Closes Fri 13 Nov 2026" with the tick, and "in 25 days".
- Remind me set to 7 days, with "60 and 30 days have passed for this date.".
- Ticks: "Fri 6 Nov 2026 · 7 days before", "Thu 12 Nov 2026 · Day before" and "Fri 13 Nov 2026 · Day of".
- "We'll also remind you the day before and on the day.", then Save.
In the sheet:
- Does: taps Save. "Saved to your calendar. Only you." shows, and one light tick plays.
Right (Today): REDRAW from f5-today-calendar-strip · ios · 14-saved-outside-window.
- The status line under the summary reads "Saved · Property-tax appeal closes Fri 13 Nov 2026 is in your place file · See it". No row is added, because Fri 13 Nov is outside the Mon 19 Oct → Sun 1 Nov window.
- Event: date saved · kind property_tax_appeal (invented).
- MOMENT OF TRUTH: His fix is the computed date with the tick, and a saved date never vanishes from view.

Part 2 — a schedule he reports and does not fix yet

F05 · iOS · strip row → DateSheet, Pickup day, view-seeded. REDRAW from x-date-sheet · ios · 03-pickup-weekly-saved-place with these deltas:
- Title "Pickup day". Thursday is selected with the hollow mark and "○ On record, not confirmed", printed once.
- The caption reads "City of Camas · 2026 collection calendar", with no "recycling weekly".
- "How often does recycling come?" has Not set selected. In place of the preview, show the caption "Recycling: Not set".
- The weekday and frequency chips are editable: they are the self-fix (as in flow-02 F08), and Save appears only after a change. Label this on the frame: "pickup kind: chips editable; conflicts with x-date-sheet's view-seeded locked-field rule (HC04)".
- Rows "Where this fact comes from" and "This isn't right" are live.
- Footer "Only you will see this.".
In the frame:
- Arrow in: "tap row 'Pickup day · Thu 22 Oct'" from F01.
- Does: taps "This isn't right".
- Event: no event.
- MOMENT OF TRUTH: The kind of fact decides which reasons are offered.

F06 · iOS · x-provenance-sheet · report view, swapped into the DateSheet with Back. REDRAW from 02-report-schedule, using the PLACE B strings from 26-ax5-place-b at default size and the Back from 22-opened-from-date-sheet.
- Shows: hollow L header "Garbage · Thursdays" and "Recycling frequency: Not set". Source "City of Camas schedule", Updated "Thu 15 Oct 2026". ScopeChip "Saved place · Only you".
- Report area: heading "What's wrong?", with "Set my pickup day" on top. The checkbox "Also tell us the city's schedule looks wrong" is ticked. Radio rows: "Wrong pickup day", "Wrong recycling week" (selected; it also covers a missing recycling week) and "Not my service". "Send report" is enabled.
- Behaviour, printed beside the frame: "With the box ticked, Set my pickup day sends the report and then swaps; Send report alone sends without swapping."
- Does: taps "Send report" and not the self-fix.
- Event: no event (the report event is written on F07).
- MOMENT OF TRUTH: The self-fix is offered first, and reporting on its own is allowed.

F07 · iOS · x-provenance-sheet · 03-reported-checking. REDRAW with PLACE B values (PB payload). F07 stays inside the DateSheet, with Back.
- Shows: the mark stays hollow. The status block reads "You reported this · checking", above the receipt "Reported Mon 19 Oct. We'll check it against City of Camas by Mon 26 Oct and tell you here." "Set my pickup day" stays the primary action. No haptic plays (the house-style tick is for confirm and Save only; see HC16).
- Event: report · tag not my schedule · status checking (invented; the same name flow-02 uses).
- MOMENT OF TRUTH: The receipt gives a check-by date and names where the answer will appear.

F08 · iOS · x-place-file, saved place, with Your reports. REDRAW from x-place-file · ios · 02-saved-place-first-week with these deltas:
- No "Set up your place" block. The Next row "Set your pickup day" / "Set pickup day" stays.
- The PLACE section gains the FactRow "Your reports · 1 checking", shown expanded as in x-place-file · web-390 · 10-your-reports, in iOS chrome: "Pickup day · Checking · reported Mon 19 Oct · we'll check by Mon 26 Oct".
- Dates gains "Property-tax appeal · closes Fri 13 Nov 2026 · in 25 days" with the tick.
- Inset: the Thu 22 Oct strip row in the DateRow reported state, "You reported this · checking".
In the frame:
- Arrow in: "Place tab".
- Event: no event.
- MOMENT OF TRUTH: There is a private list of his reports and their status, marked Only you.

GAP: "Three days later · Thu 22 Oct, 11:00 AM · no notification" (ALT TIMELINE)

F09a · resolution card (NO EXPORT; not a phone; ALT TIMELINE). A surface.base card with the overline "BEHIND THE SCENES" and this text:
- "Pantopus checks the City of Camas 2026 collection calendar: Thursday routes include weekly recycling."
- "PLACE B's city rule stays weekday only: Thursday, on record, not confirmed. Recycling stays Not set until Jordan sets it (P17)."
- "Report closed as Fixed. The city's weekly listing is offered to Jordan as a suggestion."
- "Honesty counter: 1 'not my schedule' report, resolved in 3 days, visible."
- Event: report · tag not my schedule · status fixed (invented).

GAP: "Six days later · Wed 28 Oct, 6:10 PM · organic open" (ALT TIMELINE)

F09 · iOS · Today, pickup card, unconfirmed, with the outcome (ALT TIMELINE). REDRAW from f4-today-pickup-card · ios · 06-saved-place-unconfirmed with these deltas:
- Headline "Garbage tomorrow" (unchanged, because recycling is still Not set).
- SourceCaption "○ City schedule, not yet confirmed · City of Camas · 2026 collection calendar, read Thu 22 Oct 2026". "Recycling: Not set" stays.
- A 44pt outcome row (the resolved form of the ProvenanceMark reported variant): "We checked your report · Fixed Thu 22 Oct · See what changed".
- Buttons "Yes, Thursday is right" and "Change pickup day".
- Footer "Only you will see this. No night-before reminder until you confirm your day."
In the frame:
- Does: taps "See what changed".
- Event: session_open · trigger organic · week 3 (no §5 bucket).
- MOMENT OF TRUTH: The answer appears where he already looks, without a push.

F10 · iOS · x-provenance-sheet · resolved (two frames in one bracket, "Fixed" and "Alternative outcome"; ALT TIMELINE).
Left: REDRAW from 13-resolved-fixed.
- Header "Garbage · Thursdays", hollow, with the caption "Recycling frequency: Not set".
- Source "City of Camas schedule", Updated "Thu 22 Oct 2026".
- Outcome "Fixed Thu 22 Oct: City of Camas lists weekly recycling on Thursday routes. Set it if that matches your street."
- Peer pair in the x-provenance-sheet contract order: "Yes, Thursday is right" (first; confirms the weekday only) / "Set my pickup day" (second; opens the DateSheet with Weekly prefilled as a suggestion). Equal weight.
Right: REDRAW from 14-resolved-no-change.
- Header "Garbage · Thursdays", hollow, "Recycling frequency: Not set", Updated "Thu 15 Oct 2026".
- Outcome "No change · Thu 22 Oct: City of Camas doesn't list a recycling week for this street. If you know it, set it yourself."
- "See their page ↗", with "Set my pickup day" as the primary action.
In the frame:
- Does (left): taps "Set my pickup day". The content swaps to the DateSheet, with Back.
- Event: no event.
- MOMENT OF TRUTH: Each outcome says what changed, its source and a one-line reason, even when the seed itself did not change.

F11 · iOS · DateSheet with the suggestion, then the card (ALT TIMELINE). REDRAW from x-date-sheet · ios · 03-pickup-weekly-saved-place with these deltas:
- Header has Back. Thursday is selected with the hollow mark and "○ On record, not confirmed". Caption "City of Camas · 2026 collection calendar".
- "How often does recycling come?": Weekly is prefilled as a suggestion, with the caption "Suggested · City of Camas lists weekly recycling on Thursday routes · checked Thu 22 Oct". Nothing is written until he taps Save.
- Preview under "Next recycling": "Recycling and garbage · Thu 29 Oct", "· Thu 5 Nov", "· Thu 12 Nov".
- Keep the export's "Next holiday change" row, as flow-02 F08 draws it: "Recycling and garbage · Fri 27 Nov", with "Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar" and a struck ghost (it reflects the suggested weekly frequency and is written only on Save).
- Reminder line "Notifications are off. These show on Today and in your place file."; footer "Only you will see this."; Save.
- Does: taps Save. One light tick plays.
- Save leads to a thumbnail of the card from f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now, with these deltas: remove "Recycling: Not set", and the inline ask's tray preview reads "Recycling + garbage tomorrow" / "Bins out tonight" (the export draws "Garbage tomorrow" / "Bins out tonight"). The card reads "Recycling and garbage tomorrow", "✓ You added this · Thursday", "Saved to your calendar. Only you." and shows the inline reminder ask, with no reported line. Label it "continues as the flow-02 F09 pattern · Wed 28 Oct · no reported line".
- Dashed alternative inset, labelled "If he taps 'Yes, Thursday is right' instead": REDRAW from x-provenance-sheet · ios · 04-confirmed-in-place with PLACE B values: tick header "Garbage · Thursdays", Source "You", Updated "Confirmed Wed 28 Oct 2026", "Recycling frequency: Not set", ScopeChip "Saved place · Only you". The confirm writes the weekday only. Event: pickup rule confirmed · scope saved_place (invented).
- Event: pickup rule saved · scope saved_place (invented).
- MOMENT OF TRUTH: A checked city listing becomes his only when he saves it, and his own save draws the tick (HC15).

F12 · iOS · x-place-file, reports resolved (ALT TIMELINE). REDRAW from F08.
- "Your reports · 1 fixed", expanded: "Pickup day · Fixed Thu 22 Oct · City of Camas lists weekly recycling · City of Camas".
- The Place row reads "Pickup day · Thursday · recycling weekly" with the tick (true only after his F11 save).
- The Next row moves from "Set your pickup day" to the next missing fact in x-place-file's order (widget first on iOS): "Put today on your home screen" · button "See how to add it", with "Not now · Skip".
- Event: no event.
- MOMENT OF TRUTH: The outcome stays findable here after the card's outcome row is gone. That row shows until he opens it or sets his day.

LAYOUT
Artboards and lanes:
- Each lane artboard is 2400 wide, as tall as needed, on surface.app.
- It has four bands, top to bottom:
  1. A header strip with the visible artboard name, the ALT TIMELINE line and a one-line summary of the lane.
  2. The MARGIN LANE. Each moment-of-truth callout is a surface.base card with the overline "MOMENT OF TRUTH · " followed by the frame id as written, and one sentence, joined to its frame by a 1px text.secondary leader line.
  3. The HAPPY LANE: frames left to right at 50% scale (iOS 196.5x426, Android 206x457.5, web-390 195x422, web-1440 720x450), 64px apart.
     - Above each frame: its label, made of the frame id as written (F01…F12, F09a, X01…X12), then the surface id, the state and the platform, plus the ALT TIMELINE tag for frames dated after Mon 19 Oct.
     - Under it: the device date and time, then the event caption, then any "REDRAWN FROM" caption naming the artboard and its deltas.
  4. The FAILURE LANE: branch frames at 50% scale, labelled with the branch id as written and what went wrong.
     - A dashed arrow runs up to the frame where the branch starts.
     - A second dashed arrow, labelled "rejoins" plus the frame id as written, runs into the frame where it rejoins.
     - A branch that ends at an outside authority ends in a labelled stop bar reading "leaves Pantopus".
Arrows, gaps and non-phone cards:
- Arrows are 1.5px text.secondary lines with solid heads.
- Each arrow is labelled by its trigger, on a surface.base pill in label 13/18 text.strong: "tap", "tap tile", "switch in place", "Save", "tap row", "This isn't right", "content swap", "Send report", "Place tab", "organic open", "See what changed", "Set my pickup day", "Back", "Close".
- A time jump is a 96px gap with a dashed vertical rule and a label on surface.sunken in text.strong.
- Server-side events (F09a) are cards, not phones, with the overline "BEHIND THE SCENES".
Focus map and handoff checks:
- Focus-map frames (artboard 05) and handoff-check thumbnails (artboard 06) are copies of the lane frames at 25% (98x213), not redraws. The focus map runs in two rows (F01–F06, F07–F12), with each spoken string under its frame.
Paired frames:
- Paired frames (F04, F10, F11) share one bracket label.
- The alternative outcome in F10 and the alternative confirm in F11 have a dashed outline and their own label, so they never read as a next step.
What never appears: no red or amber, no scores, no percentages. Every frame keeps its ScopeChip or scope footer visible.

FAILURE BRANCHES (lower lanes, by artboard)
Under F01–F04:
- X01 · "I haven't got one yet". The sheet reads "Closes Thu 1 Jul 2027 or later" and sets no reminder. Save leads to the same kind of status line, naming Thu 1 Jul 2027. Event: date saved · kind property_tax_appeal (invented). Rejoins F04 (right).
- X02 · He thinks the seed itself is wrong.
  - "This isn't right" in F03 swaps to the seeded-deadline report view. REDRAW from x-provenance-sheet · ios · 11-seeded-deadline-report with the authority "Clark County Board of Equalization", ScopeChip "Saved place · Only you", and the reasons "Wrong date" and "Doesn't apply to this address".
  - Receipt: "Reported Mon 19 Oct. We'll check it against Clark County Board of Equalization by Mon 26 Oct and tell you here."
  - Event: report · kind property_tax_appeal · status checking (invented). Rejoins F03 with Back.
- X03 · Offline while creating. Frame: x-date-sheet · ios · 26-offline-create, with "You're offline. Saving needs a connection — what you type stays here." and Save disabled. Rejoins F04 when back online.
- X04 · Save fails. Frame: x-date-sheet · ios · 24-save-failed, with "Couldn't save that date. Try again." The typed date is kept. Rejoins F04.
Under F05–F08:
- X05 · The report fails. Frame: x-provenance-sheet · ios · 17-report-failed, with PLACE B values (PB payload), and "We couldn't send your report. Your answer is saved · Retry". "Wrong recycling week" stays selected, and "Set my pickup day" stays live. Rejoins F07 after Retry (spoken "Retry sending report").
- X06 · Offline.
  - Frame: x-provenance-sheet · ios · 18-offline, with PLACE B values (PB payload), and "You're offline · as of 6:02 PM" (delta: the export's cached sheet says 7:04 AM). The report control and source row are disabled, with "Reporting needs a connection." and "The source page needs a connection.".
  - In F05, "This isn't right" is disabled with "Needs a connection.". The strip is as in f5-today-calendar-strip · ios · 11-offline, with one delta: it reads "You're offline · as of 6:02 PM" (the export says 4:10 PM).
  - Rejoins F06.
- X07 · Flood zone disputed, from Place → Public records for this address → Flood.
  - Frames: x-provenance-sheet · ios · 05-official-flood and 06-report-authority-flood, with the ScopeChip "Saved place · Only you". They show "Only FEMA can change this." and "How to request a Letter of Map Amendment · FEMA ↗". The one Pantopus reason is "We matched the wrong spot".
  - Receipt: "Reported Mon 19 Oct. We'll check our address match by Mon 26 Oct and tell you here."
  - The sheet never promises to check the FEMA zone. The LOMA path ends in a "leaves Pantopus" stop bar.
- X08 · Radon disputed.
  - Frame: x-provenance-sheet · ios · 09-official-radon, with the ScopeChip "Saved place · Only you" (replacing the export's "Your household"), "County zone from EPA. It says nothing about your home's level; only a test does.", the primary "Get a free test kit · Washington Dept of Health ↗", and the inset reason "We matched the wrong county".
  - The sheet never promises to check the EPA zone.
- X09 · "We matched the wrong spot" versus "the map is wrong". A callout on X07: a Pantopus geocoding error is its own reason and the only one Pantopus checks. The sheet offers no "the map is wrong" reason for FEMA, USFS or EPA data.
Under F09–F12:
- X10 · The check slips (ALT TIMELINE).
  - Frame: REDRAW from x-provenance-sheet · ios · 03-reported-checking with PLACE B values (PB payload: hollow "Garbage · Thursdays", "Recycling frequency: Not set", Source "City of Camas schedule", ScopeChip "Saved place · Only you"), dated Tue 27 Oct (the day after the Mon 26 Oct check-by date). Replace the status block with the slipped status line taken from 16-check-slipped: "Still checking. It's taking longer than we said. New date: Mon 2 Nov." "Set my pickup day" stays the primary action. No tick and no Source "You" (he has not self-fixed).
  - The place-file row reads "Pickup day · Checking · new date Mon 2 Nov".
  - Tag: "FOUNDER · Commit only to a window you can meet. 7 days is a placeholder."
  - The check resolves Fri 30 Oct. Rejoins as a later organic open, because the card shows only on the evening before pickup: Wed 4 Nov, 6:10 PM, drawn in F09's layout with the deltas "read Fri 30 Oct 2026" and the outcome row "We checked your report · Fixed Fri 30 Oct · See what changed". Event: session_open · trigger organic · week 4 (week-four bucket, but outside "among activated": Jordan is not activated).
- X11 · He opens before the fix, on Wed 21 Oct (ALT TIMELINE).
  - Frame: the card from f4-today-pickup-card · ios · 06-saved-place-unconfirmed, with "Garbage tomorrow", "Recycling: Not set", "read Thu 15 Oct 2026" and the reported line "You reported this · checking".
  - No push. Event: session_open · trigger organic · week 2 (no §5 bucket). Rejoins F09.
- X12 · He never opens the outcome.
  - The outcome row stays on the card whenever the card shows, stays on the Thu strip rows, and stays in Your reports.
  - No notification is sent.
  - Tag: "OPEN · Should a report outcome ever notify, and in which of the five groups?"

HANDOFF CHECKS (draw each on artboard 06 as a pair of 25% thumbnails and a one-line rule)
- HC01 · F01 and F02 must agree on the entry to the tax appeal.
  - flows-spec's entry, a strip row "Property-tax appeal window closes", cannot exist in October, because the strip never shows the appeal as a single seeded date.
  - This journey enters through "+ Add a date" and the tile.
  - x-date-sheet also names the place-file row, but x-place-file's saved-place variant says "County dates aren't available for a saved place". Either add the appeal row to saved-place Dates or drop the tile at saved places. Founder call.
- HC02 · F03 and F04 must agree on the seed's confidence: hollow, with "Not yet checked against Clark County Board of Equalization". x-date-sheet 11 draws the same seed filled. The opposing decision, from x-place-file's notes: "official seeds drawn filled even when not yet checked, because hollow is only for facts a household can confirm". Draw both rules side by side; the founder picks one.
- HC03 · F04 and F08 must agree on the destination: the status line's "See it" must land on a place-file row that exists at a saved place (see HC01).
- HC04 · F01 and F05 must agree on what a strip row tap opens, and what the pickup sheet lets him edit.
  - f5 says the DateSheet; x-provenance-sheet says a DateRow opens the ProvenanceSheet. Use one rule: the row opens the DateSheet, and "Where this fact comes from" or "This isn't right" swaps the content in place with Back.
  - The DateRow custom action is named "Where this fact comes from" everywhere; f5 still says "Where this comes from".
  - Locked fields: x-date-sheet says "View-seeded shows locked fields as plain text with no outlines", and f5 says a seeded pickup row opens a view-seeded sheet. F05 draws the pickup kind's weekday and frequency chips as editable (the self-fix). Either x-date-sheet adds a pickup-kind exception (chips stay editable, Save appears after a change), or the seeded pickup row opens the create/edit form instead. Founder call; draw both side by side.
- HC05 · F05, F06, F07, F09 and F10 must agree on the PLACE B payload: City of Camas, Thursday, hollow, and recycling Not set in the seed both before and after the fix (P17). Weekly appears only as a suggestion (F11) and in his own rule after he saves it. Updated is Thu 15 Oct 2026 before the fix and Thu 22 Oct 2026 after; f4 06 says "read Thu 1 Oct 2026".
- HC06 · F06 and the honesty counter must agree on reasons. The reason labels are "Wrong pickup day", "Wrong recycling week" and "Not my service", and all three carry the tag "not my schedule". flows-spec's "Not my day" is folded into "Wrong pickup day". Both flows write one event name: "report · tag not my schedule · status checking" (invented).
- HC07 · F07 and F08 must agree on the words and dates: the receipt "Reported Mon 19 Oct … by Mon 26 Oct" matches the place-file row "Pickup day · Checking · reported Mon 19 Oct · we'll check by Mon 26 Oct". x-place-file 10's reports are Maya's and do not cover Jordan.
- HC08 · F08 needs x-place-file's saved-place variant to include "Your reports". Today it is drawn for HOME A only.
- HC09 · F07 and F10 must tell one story, and x-provenance-sheet 13 and 14 need one redraw instruction. Today they tell a third story (reported Mon 12 Oct, "Wrong pickup day", Wednesday corrected to Thursday, fixed Thu 15 Oct), which is retired. Canonical fixture: flow-02's main timeline (reported Wed 21 Oct, "Wrong recycling week", check by Wed 28 Oct, resolved Tue 27 Oct: 13 reads "Fixed Tue 27 Oct…", 14 reads "No change · Tue 27 Oct…"). This storyboard's Mon 19 Oct / Thu 22 Oct dates are ALT TIMELINE only and are not the redraw target; the outcome wording, the hollow seed and "Recycling frequency: Not set" carry over unchanged.
- HC10 · F09 and F10 must agree on the resolved state. The pickup card needs it (f4 has only "You reported this · checking"), and so does the strip DateRow (f5 has only "reported · checking"). Both use the same words: "We checked your report · Fixed <date> · See what changed" (here Thu 22 Oct). This is the canonical pattern; flow-02 F14 uses it with Tue 27 Oct.
- HC11 · F10 and F11 must agree on what each action writes. "Yes, Thursday is right" writes the weekday only (f4's PLACE B rule stands). A recycling frequency is written only when he saves it in the DateSheet (F11). A suggestion from a resolved report is never written on its own (P17). The resolved sheet keeps the contract order: "Yes, Thursday is right" first, "Set my pickup day" second.
- HC12 · x-date-sheet 03's prefilled caption "City of Camas · recycling weekly · 2026 collection calendar" is never true for the seed (P17). It reads "City of Camas · 2026 collection calendar" (F05, F11); after F09a, weekly appears only as the suggestion caption (F11). This matches flow-02 HC05.
- HC13 · F11 and flow-02 F09 must agree on the next step: the first save or confirm opens the inline reminder ask, never a primer sheet. f4-notification-primer's pickup entry (a DateSheet save from "Change pickup day" or "Set your pickup day") conflicts; see flow-02 HC10.
- HC14 · The receipt's "tell you here" must be kept in three places: the sheet (F10), the card and strip row (F09), and the place file (F12). All three show the same status and date.
- HC15 · Marking a seeded fact someone acted on: the viewer's own confirm or set draws the tick (x-provenance-sheet 04, f4 03, F11); another member's confirm draws FILLED (f4 02, flow-02 F02–F04). Founder to ratify against invariant 1 ("FILLED = official or confirmed; tick = you added it"). F11's moment of truth relies on this.
- HC16 · F07 and x-provenance-sheet must agree on haptics: x-provenance-sheet's INTERACTION ("One light haptic tick when a report sends successfully…") drops the report-success haptic to match house style: one light tick on confirm and Save only. A sent report shows a tick mark and plays no haptic. Matches flow-02 HC07.

ACCESSIBILITY IN THE JOURNEY (artboard 05, rows 1–2: a numbered focus ring on each 25% frame and the spoken string under it)
Focus after each transition:
- F01→F02: focus lands on the sheet title "Add a date". Tiles are 56pt single targets. After the tap, the sheet switches in place and focus lands on the new title, announced "Property-tax appeal".
- F03: the input is spoken "When was your notice mailed?, date field". After entry, a polite status reads "Closes Friday 13 November 2026, in 25 days". Remind me's passed leads stay focusable and read their reason.
- F04: Save closes the sheet, and focus returns to "+ Add a date". The status line (role=status) is announced. "See it" is its own 44pt target.
- F05: the row tap moves focus to the DateSheet title "Pickup day". "This isn't right" swaps the content, and focus lands on the "What's wrong?" heading, with Back first in reading order.
- F06: the checkbox and radio rows show selection differently from focus. A disabled "Send report" reads "Pick what's wrong to send this."
- F07: "Send report" is replaced by the receipt, so focus moves to the status block "You reported this · checking", which is also a polite live region.
- F08: "Your reports, 1 checking". Each expanded row is one element: "Pickup day, checking, reported Monday 19 October, we'll check by Monday 26 October".
- F09: the outcome row is spoken "We checked your report. Fixed Thursday 22 October. See what changed, button".
- F10: focus lands on the sheet title. The outcome is read after the header, then "Yes, Thursday is right", then "Set my pickup day". "See their page" is spoken "See their page, opens outside Pantopus".
- F11: the content swap moves focus to the DateSheet title "Pickup day"; the Weekly chip is spoken "Weekly, suggested by City of Camas, selected". Save plays one light haptic with a polite status, closes the sheet and returns focus to the card's source row.
Size, contrast and haptics:
- AX5: use x-provenance-sheet · ios · 26-ax5-place-b as the reference. Pairs stack, the sheet opens at the large detent, and text wraps without truncating.
- Greyscale: hollow, filled and tick read by shape alone.
- Haptics: one light tick on Save (F04, F11) and confirm (F11 alternative) only; none on a sent report.
The no-notifications path (artboard 05, row 3): the whole journey needs no notification. Draw the three places the answer comes back without one, side by side: the card (F09), the strip row, and Your reports (F12). Also draw the offline states (X03, X06), each with its reason.

INSTEAD OF
- Instead of "Thanks — we'll check it", draw the dated receipt, the checking state and the resolved state, because a report needs a receipt, a date and a visible outcome.
- Instead of a push when a report resolves, show the outcome on the card, the strip row and Your reports, because no notification group carries it and the person already looks there.
- Instead of a single seeded appeal date, draw the conditional rule and the computed date, because the deadline depends on his notice.
- Instead of the same two reasons on every fact, offer reasons for that kind of fact, with the self-fix first, because owners fix their own copy and authorities own their data.
- Instead of promising to check a FEMA, USFS or EPA designation, check only Pantopus's own address match, because only the authority can change its data.
- Instead of writing the city's recycling listing into the seed, offer it as a suggestion he saves himself, because the seed carries only the weekday until a person confirms the rest (P17).
- Instead of an outcome that disappears once read, keep it in Your reports, because a resolved report must be findable again.
- Instead of a fixed check-by date the founder cannot meet, draw the slipped-check state with its new date, because the promise must stay true.
- Instead of redrawing Maya's cached HOME A sheets in Jordan's story, apply the PB payload, because one story holds one person and one place.

DONE WHEN
- The tax appeal goes from an unchecked conditional rule to a computed date with the tick, and stays visible after Save.
- The pickup report ends in a dated receipt, shows as "Checking" in Your reports, and comes back as an outcome on the card, the strip row and Your reports.
- The seed never carries a recycling frequency; weekly appears only as a suggestion and in his own saved rule.
- Both resolved outcomes (Fixed and No change) state what changed, the source and a one-line reason.
- The flood and radon branches never promise to check the authority's designation.
- Report failed, offline and slipped-check each show their recovery, and the slipped branch rejoins on a date after it resolves (Wed 4 Nov).
- No HOME A string (Tuesday, Waste Connections, "Your household", a tick with Source "You" before he acts) appears on a Jordan frame.
- Every artboard carries the ALT TIMELINE header, and every frame after Mon 19 Oct its tag.
- Every frame carries a literal event caption or "no event", and no event name is invented beyond those marked "(invented)".
- All 16 handoff checks are drawn.
- Every date carries its weekday, and every frame reads correctly in greyscale.

ARTBOARDS
1. flow-11 · storyboard · 01-tax-appeal-self-fix · light — F01–F04 with the margin callouts, failure lane X01–X04.
2. flow-11 · storyboard · 02-pickup-report-and-receipt · light — F05–F08, failure lane X05–X09.
3. flow-11 · storyboard · 03-resolution-where-he-looks · light — the Thu 22 Oct gap, F09a, the Wed 28 Oct gap, F09–F12, failure lane X10–X12 (X10 ends at its Wed 4 Nov rejoin frame).
4. flow-11 · storyboard · 04-android-and-web · light — three pieces:
   - F06 on Android, redrawn from x-provenance-sheet · android · 02-report-schedule with PLACE B values and Back.
   - F08 and F12 on web-390, redrawn from x-place-file · web-390 · 10-your-reports with Jordan's rows.
   - Your reports in the 320 column on web-1440, taking the column layout from x-place-file · web-1440 · 16-dense-home with PLACE B deltas.
5. flow-11 · storyboard · 05-focus-and-no-notifications · light — rows 1–2: the focus map across F01–F12 (25% copies, spoken strings under). Row 3: the three places the answer returns, and the offline states.
6. flow-11 · storyboard · 06-handoff-checks · light — HC01–HC16.
7. flow-11 · storyboard · 07-notes · light — this list:
- ALT TIMELINE: flow-02 is the main timeline (self-fix and report Wed 21 Oct, resolved Tue 27 Oct, notifications on from Wed 21 Oct; flow-10 follows it). This storyboard is an alternative in which Jordan reports on Mon 19 Oct without self-fixing and keeps notifications off. Its Wed 21 Oct frame (X11: reported, notifications off) contradicts flow-02 F06 on the same evening (not reported, then a grant). The founder picks one; x-provenance-sheet 13/14 are redrawn to flow-02's story either way (HC09).
- Recast from flows-spec:
  - 6207 NE 42nd Ave, Vancouver becomes PLACE B.
  - "Reported Sep 16 … by Sep 23" becomes "Reported Mon 19 Oct … by Mon 26 Oct".
  - "Not my day" becomes "Wrong recycling week" (a missing recycling week).
  - "Fixed Sep 20: the county moved your route to Wednesday" becomes "Fixed Thu 22 Oct: City of Camas lists weekly recycling on Thursday routes. Set it if that matches your street."
  - The strip-row entry to the tax appeal becomes "+ Add a date" with the tile.
  - "County zone, not a reading of your home" becomes x-provenance-sheet's "County zone from EPA. It says nothing about your home's level; only a test does."
- This storyboard retires the PLACE B resolved story in x-provenance-sheet 13 and 14 (Mon 12 Oct, Wednesday to Thursday, Thu 15 Oct); see HC09 for the canonical replacement.
- PB payload: x-provenance-sheet 03, 16, 17 and 18 and radon 09 carry HOME A values in their exports; this storyboard redraws them with PLACE B values. X10 takes only the slipped status line from 16.
- P17: the seed stays weekday-only, and the Fixed outcome is a suggestion he saves himself. This reconciles with flow-02 HC05. Open question: is "Fixed" the right outcome word when the seed does not change and the fix is a suggestion?
- Fixtures to verify: City of Camas weekly recycling on Thursday routes (also an assumption in x-date-sheet); the City of Camas Thanksgiving move to Fri 27 Nov 2026 (F11 holiday row); Clark County's appeal rule "July 1, or 60 days after your value notice was mailed, whichever is later" (the "whichever is later" clause is added here and must be checked).
- Assumptions:
  - Jordan bought PLACE B, and the notice was mailed Mon 14 Sep 2026 to the seller, who passed it on.
  - Jordan's notifications are off (in this alternative timeline).
  - The fix lands Thu 22 Oct at 11:00 AM.
  - He next opens Wed 28 Oct at 6:10 PM.
  - In X10, the slipped check resolves Fri 30 Oct and he next sees the card Wed 4 Nov at 6:10 PM.
  - The outcome row stays on the card until he opens it or sets his day.
  - In the pickup kind, the DateSheet's weekday and frequency chips are editable (founder to confirm against x-date-sheet's view-seeded locked-field rule; HC04).
  - No widget was promoted in the last 24 hours, so F12's Next row is the widget ask.
- Invented and delta strings: "Saved · Property-tax appeal closes Fri 13 Nov 2026 is in your place file · See it"; "Property-tax appeal · closes Fri 13 Nov 2026 · in 25 days"; "Closes July 1, or 60 days after your value notice was mailed, whichever is later."; "Notifications are off. These show on Today and in your place file." (F04, F11); "We'll also remind you the day before and on the day." (not in x-date-sheet's tax-appeal copy); "Pickup day · Checking · reported Mon 19 Oct · we'll check by Mon 26 Oct"; "We checked your report · Fixed Thu 22 Oct · See what changed"; "We checked your report · Fixed Fri 30 Oct · See what changed" and "read Fri 30 Oct 2026" (X10); both outcome sentences; "Suggested · City of Camas lists weekly recycling on Thursday routes · checked Thu 22 Oct"; "Your reports · 1 fixed"; "Pickup day · Fixed Thu 22 Oct · City of Camas lists weekly recycling · City of Camas"; "Pickup day · Checking · new date Mon 2 Nov"; "Confirmed Wed 28 Oct 2026"; "read Thu 22 Oct 2026"; F12's Next row "Put today on your home screen" · "See how to add it" (x-place-file's HOME A iOS string, applied to PLACE B after his pickup day is set); the F11 tray preview "Recycling + garbage tomorrow" / "Bins out tonight"; the F11 hand-off label; the X06 deltas "You're offline · as of 6:02 PM" (sheet and strip); the Board of Equalization receipt; the spoken computed-date status and suggested-chip label; the F09a card text; the ALT TIMELINE header and tags; every tag, callout and event caption.
- Invented event names: "date saved · kind property_tax_appeal"; "report · tag not my schedule · status checking" (shared with flow-02); "report · tag not my schedule · status fixed"; "report · kind property_tax_appeal · status checking"; "pickup rule saved · scope saved_place"; "pickup rule confirmed · scope saved_place". §5 names only the report tag "not my schedule", not an event.
- Activation note: the tax-appeal date is an F5 date, but Jordan's 7-day window closed Sat 17 Oct, so it does not activate him, and his session_open rows (including the Wed 4 Nov week-4 open) fall outside §5's "among activated" returns block.
- House style: the report success plays no haptic; only Save and confirm tick (HC16 asks x-provenance-sheet to match).
- Contract order: the resolved sheet keeps "Yes, Thursday is right" first and "Set my pickup day" second, as x-provenance-sheet specifies.
- Founder commitment: the 7-day check-by window is a placeholder. Commit only to a window you can meet, and keep the slipped-check state.
- Dependency: the report service and its statuses (checking, fixed, no change, slipped) do not exist yet.
- Open questions: whether a report outcome ever notifies; how long the outcome row stays on the card; whether saved places get county dates; whether the pickup kind is exempt from the view-seeded locked-field rule.
- Omitted: dark twins, the wildfire report branch (same pattern as flood) and the air report branch (drawn in flow-10).

BATCH PLAN
Turn 1: artboards 1–2, then wait for "continue".
Turn 2: artboards 3–4, then wait for "continue".
Turn 3: artboards 5, 6 and 7.
