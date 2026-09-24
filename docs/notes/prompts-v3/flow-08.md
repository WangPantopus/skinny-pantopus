# Journey storyboard: Mail snap to paid (phase 2)
id: flow-08 · platforms: ios/android/web · artboards: 17

# Journey storyboard: Mail snap to paid · flow-08
id: flow-08 · platforms: ios/android/web · type: storyboard · artboards: 17

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

TYPE: NEW (storyboard). Every screen in this journey was already designed in its own project. Do not redesign any screen. Place each attached export as a frame at 50% scale, connect the frames, and add callouts. Redraw a frame only where the REDRAW list says so. A redraw copies the named source artboard exactly (same components, same layout, same type) and changes only the deltas listed. Frame numbers F01 to F23 are the happy path. B1 to B15 are the failure branches (B11 has two parts, B11a and B11b). Print the frame number, the platform, the surface id and state, and the date and time above every frame (for example "F07 · iOS · f10-mail-day-triage · 01-populated-dense · Mon 19 Oct, 6:10 PM"). A frame placed with its export's own date, rather than the story's date, prints "specimen · export dated <date>" in that header instead.
ARTBOARD NAMES: storyboard artboards put "storyboard" in the platform slot ("flow-08 · storyboard · 01-capture-lane · light"), and the last artboard is "flow-08 · Notes". This overrides the house-style pattern "<surface-id> · <platform> · <NN-state> · <theme>".

ATTACH (exported artboards, by exact name)
Happy path:
- f10-snap-capture-tray · ios · 01-queue-uploading · light (F03)
- f10-snap-capture-tray · ios · 02-page-selected · light (F04)
- f10-snap-capture-tray · ios · 02b-water-joined · light (F05)
- f10-mail-day-triage · ios · 01-populated-dense · light (F07; also the source for R1)
- f10-mail-day-triage · web-390 · 03-just-scanned · light (source for R2)
- f10-extraction-confirm · ios · 01-low-confidence · light (F08)
- f10-extraction-confirm · ios · 01b-date-corrected · light (F09)
- f10-extraction-confirm · ios · 04-added · light (F10)
- f10-extraction-confirm · ios · 06-reading · light (inset on the F10 to F11 arrow)
- f10-extraction-confirm · ios · 03-high-confidence · light (F11; also the source for the R12 fallback inset)
- f10-extraction-confirm · ios · 05-just-filed · light (F12)
- f10-mail-day-triage · web-390 · 02-decide-open · light (source for R3)
- f10-mail-day-triage · web-390 · 02b-just-decided · light (source for the R3 inset)
- f10-mail-day-triage · web-390 · 05-day-finished · light (source for R4)
- f5-today-calendar-strip · ios · 15-phase2-money-rows · light (source for R14 = F15, and for R11)
- f10-bill-provenance · ios · 03-corrected-date · light (F16; also the source for R6)
- f10-bill-trend · ios · 01-twelve-months · light (F17)
- f3-household-notifications · android · 10-tray-date-and-bill-reminders · light (source for R5 and R5b)
- f3-bill-detail-web · web-1440 · 02-marked-paid-undo · light (behaviour source for R7)
- f3-bills-list · ios · 07-marked-paid-undo · light (native wording source for R7)
- f3-household-notifications · ios · 07-tray-household-passive · light (row-styling source for R8)
- f3-household-notifications · ios · 01-unread-list-dense · light (source for R9)
- f3-household-notifications · ios · 11-landing-resolves · light (source for R10)
- f10-bill-provenance · ios · 08-paid-by-sam · light (source for R10, with the names reversed)
- f3-bill-detail-web · web-1440 · 04-paid-landing-member · light (web twin inset beside F23)
Failure branches:
- f10-mail-day-triage · ios · 11-no-claimed-home · light; f10-snap-capture-tray · ios · 11-no-claimed-home · light; x-date-sheet · ios · 30-bill-manual-saved-place · light; f10-extraction-confirm · ios · 11-no-claimed-home · light; x-date-sheet · ios · 28-bill-from-snap · light (B1)
- f10-snap-capture-tray · ios · 08-scanner-unavailable · light; f10-snap-capture-tray · android · 08-scanner-unavailable · light; f10-snap-capture-tray · ios · 09-camera-off · light; f10-snap-capture-tray · web-390 · 09-camera-off · light (B2)
- f10-snap-capture-tray · ios · 05-upload-failed · light; f10-snap-capture-tray · ios · 07-offline · light; f10-mail-day-triage · web-390 · 09-offline · light (B3)
- f10-mail-day-triage · web-390 · 10-reading-unavailable · light; f10-extraction-confirm · ios · 07-reading-unavailable · light (B4)
- f10-extraction-confirm · ios · 08-unreadable-photo · light (B5)
- f10-extraction-confirm · ios · 09-duplicate · light (B6)
- f10-snap-capture-tray · ios · 12-guest-check · light; f10-mail-day-triage · web-390 · 12-limited-access · light; f10-extraction-confirm · ios · 10-guest · light; f10-bill-provenance · ios · 10-guest · light; f10-bill-trend · ios · 05-guest · light (B7)
- f3-bill-detail-web · web-1440 · 14-mark-paid-race · light (B9)
- f3-bill-detail-web · web-1440 · 05-member-unpaid · light; f3-bills-list · ios · 01-upcoming-member-dense · light (B10; placed as specimens with their export date)
- f10-bill-provenance · ios · 05-delete-confirm · light; f10-bill-provenance · ios · 06-deleted-undo · light; f10-mail-piece-photo · ios · 12-bill-and-photo-deleted · light (B11a)
- f10-bill-provenance · ios · 14-bill-removed · light; f3-bill-detail-web · web-1440 · 17-removed-arrival · light (B11b)
- f3-bills-list · web-1440 · 02-upcoming-manage · light (source for the B12 bug specimen)
- f10-mail-piece-photo · ios · 07-filed-no-bill · light; f10-mail-piece-photo · ios · 09-delete-confirm-filed · light; f10-mail-piece-photo · ios · 10-filed-just-deleted · light; f10-mail-snap-privacy · ios · 02-photos-kept · light; f10-mail-snap-privacy · ios · 06-delete-all-confirm · light; f10-mail-snap-privacy · ios · 08-deleted · light (B13)
- f10-bill-trend · ios · 04-not-enough-homes · light (B14)
- f3-household-notifications · ios · 14-push-off-banner · light (B15)
Platform twins:
- f10-mail-day-triage · web-1440 · 01-populated-dense · light; f10-mail-day-triage · android · 01-populated-dense · light
- f10-snap-capture-tray · web-1440 · 01-drop-target-with-files · light; f10-snap-capture-tray · android · 01-queue-uploading · light
- f10-extraction-confirm · web-1440 · 01-low-confidence · light; f10-extraction-confirm · android · 01-low-confidence · light
- f10-bill-provenance · web-1440 · 16-snapped-confirmed · light; f10-bill-provenance · android · 15-snapped-confirmed · light
- f3-bill-detail-web · web-1440 · 01-upcoming-dense · light; f3-bill-detail-web · web-390 · 10-marked-paid-undo · light
- f10-bill-trend · web-1440 · 12-twelve-months · light
Accessibility references:
- f10-mail-day-triage · ios · 13-ax5 · light; f10-extraction-confirm · ios · 17-ax5 · light; f10-extraction-confirm · ios · 19-greyscale · light; f10-mail-day-triage · web-390 · 15-greyscale · light

REDRAW (no export exists for this exact moment; redraw faithfully from the source named)
- R1 = F01. Source: f10-mail-day-triage · ios · 01-populated-dense. Deltas: time Mon 19 Oct, 6:03 PM, before the scan. Caption "Last scan today, 12:40 PM". No status line. Needs a call holds only the five digital rows (Clark County Treasurer, State Farm, Clark County Elections, Capital One, Waste Connections), so it reads "Needs a call (5)". Reviewed today reads "Reviewed today · 6". The footer caption reads "5 still need a call. They'll be here tomorrow." The labelled toolbar action "Scan today's stack" (camera glyph plus label) is outlined, as in the source.
- R2 = F06. Source: f10-mail-day-triage · web-390 · 03-just-scanned, drawn in the iOS chrome of f10-mail-day-triage · ios · 01-populated-dense. Time 6:06 PM. Caption "Last scan today, 6:04 PM". "Needs a call (9)". Four new photographed rows, in F05's piece order (Clark Public Utilities, water, HOA, Chase), none of them named: row 1 "Photo of your mail · 2 pages" (uploaded, being read); row 2 "Photo of your mail · 2 pages" ("1 of 2 uploaded, 60%"; this is the water bill, whose first page is tray page 3, still uploading on F05); row 3 "Photo of your mail · 1 page" (uploaded, being read; the HOA letter, tray page 5); row 4 "Photo of your mail · 3 pages · 2 of 3 uploaded" with the InlineErrorRow "Page 3 didn't upload" and "Retry page 3 of 3" (the Chase statement; tray page 8 is page 3 of this piece). No status line yet. No sender, amount or $0.00 on any photographed row.
- R3 = F13. Source: f10-mail-day-triage · web-390 · 02-decide-open, drawn in the iOS chrome. Time 6:18 PM. Row 1 reads "Clark Public Utilities · Bill · $142.18 · due in 4 days · Fri 23 Oct" with the you-added tick and "Added to bills". Decide is expanded into the full-width 48pt buttons "Recycle paper, keep photo" · "Recycle paper, delete photo" · "Keep paper, keep photo" · "Keep paper, delete photo" · "See the piece". Inset beside it, from web-390 02b-just-decided: the collapsed row "Clark Public Utilities · Paper recycled · Photo kept · Undo", focus on the next row, and the polite status "Recycled paper, kept photo. Undo is on the row."
- R4 = F14. Source: f10-mail-day-triage · web-390 · 05-day-finished (variant b), drawn in the iOS chrome. Time 6:21 PM. The line reads "Day finished. 6 pieces still need a call. They'll be here tomorrow." and the status line reads "Day finished · Undo". Tonight's three decided rows stay where they collapsed, inside Needs a call, each still with its InlineUndo, because Maya has not left the screen: "Clark Public Utilities · Paper recycled · Photo kept · Undo", "City of Vancouver water · Paper recycled · Photo kept · Undo", "Chase · Filed · Paper kept · Photo kept · Undo". Under "Needs a call · for tomorrow" are the Larkspur Loop HOA photo row (ring mark, not confirmed) and the five digital rows. The heading reads "Reviewed today · 6" (the six earlier rows, collapsed). Caption beside the frame: "On Maya's next visit the three decided rows move under Reviewed today, which then reads 'Reviewed today · 9'."
- R5 = F18. Source: the PushCopy bill-reminder variant, as in f3-household-notifications · android · 10-tray-date-and-bill-reminders, drawn on the iOS lock screen. Thu 22 Oct, 6:00 PM. Title "Clark PUD due tomorrow", body "Larkspur Loop". No amount, no house number and no action button. Level annotation outside the frame: "iOS Active · Dates & bills". Inset: Sam's lock screen showing the same notification at the same time.
- R5b = variant specimen beside F18, labelled "If bill reminders merge into the 6:00 PM evening briefing". Same lock screen and time, one Briefings notification instead of the Dates & bills one: title "Tomorrow: Clark PUD due", body "Larkspur Loop" (invented; list on Notes). Level annotation "iOS Active · Briefings". Caption: "One briefing item, so the tap opens the bill (R6); with two or more items it would open Today." This is an open decision, not the drawn path.
- R6 = F19. Source: f10-bill-provenance · ios · 03-corrected-date. Deltas: Thu 22 Oct, 6:01 PM, arriving from the push. Headline line "Tomorrow · due Fri 23 Oct" (the export's own form, "in 3 days · due Fri 23 Oct", with the day moved), StatusChip "Upcoming", focus ring on the amount "$142.18" and no highlight wash (labelled "HOUSE-STYLE EXCEPTION pending founder decision"; see the arrival-highlight check). Host facts: account ending 4471 (confirmed at F09 to F10), "Added by you · Mon 19 Oct", ScopeChip "Your household" with the caption "Maya and Sam can see this bill", Reminders "Thu 22 Oct · Fri 23 Oct". Provenance block unchanged: "From a photo you took · Mon 19 Oct", "We read this from your photo. You confirmed the amount on Mon 19 Oct.", "We read Thu 8 Oct, the statement date. You changed it to Fri 23 Oct on Mon 19 Oct.", "You added this". Mark paid is the only filled control.
- R7 = F20. Source: R6, with the behaviour of f3-bill-detail-web · web-1440 · 02-marked-paid-undo and the native wording of f3-bills-list · ios · 07-marked-paid-undo. Thu 22 Oct, 6:20 PM. The action row becomes the InlineUndo line "Marked paid · Undo". StatusChip "Paid". Attribution "Marked paid by you · Thu 22 Oct". "Next due Mon 23 Nov". "No more reminders for October's bill, for anyone." Details "Reminders: Sun 22 Nov · Mon 23 Nov". Caption "We'll let Sam know when you leave this screen." The provenance block and the trend card below it do not change.
- R8 = F21. Row styling from f3-household-notifications · ios · 07-tray-household-passive; the source supplies only the row styling. Drawn on Sam's iPhone lock screen as an Active notification (a banner-weight lock-screen entry, not the Notification Center thread view) in the "Larkspur Loop" group. Thu 22 Oct, 6:22 PM. Content: "Maya marked Clark PUD paid" / "Due Fri 23 Oct · Larkspur Loop", with a circular MC initials avatar. Level annotation outside the frame: "iOS Active · the bill was due within 3 days for Sam". A struck ghost row labelled "6:00 PM 'Clark PUD due tomorrow' · replaced" sits beside the device, outside it.
- R9 = F22. Source: f3-household-notifications · ios · 01-unread-list-dense. Deltas: Thu 22 Oct, 6:30 PM, Sam's list opened from the bell (badge 1). TODAY holds only row 1, unread, MC avatar: "Maya marked Clark Public Utilities paid" / "$142.18 · due tomorrow · Fri 23 Oct · 6:22 PM · Larkspur Loop". The "Household activity settings" link sits under it, outside the row target. Sam's earlier 6:00 PM "Clark PUD due tomorrow" row is gone (replaced). The export's TODAY rows 2 to 4 move under EARLIER with dated times and keep their send-time relative counts: "Maya added Chimney sweep" / "in 19 days · Sat 7 Nov at 9:00 AM · Mon 19 Oct, 5:30 PM · Larkspur Loop"; "Property tax due in 14 days" / "Mon 2 Nov · Mon 19 Oct, 7:00 AM · Larkspur Loop · Clark County Treasurer · ● Official"; "City budget hearing in 21 days" / "Mon 9 Nov · Mon 19 Oct, 7:00 AM · Larkspur Loop · City of Vancouver · ○ On record, not confirmed". The export's original row 1 (the Mon 19 Oct Clark mark-paid) is dropped, because in this story the bill is marked paid on Thu 22 Oct. Every EARLIER row is drawn read (Sam read them before today), so the badge is 1. Other EARLIER rows keep their export content.
- R10 = F23. Source: f3-household-notifications · ios · 11-landing-resolves, with the provenance block from f10-bill-provenance · ios · 08-paid-by-sam, names reversed. Thu 22 Oct, 6:30 PM, Sam's view. Heading "$142.18", StatusChip "Paid", attribution "Marked paid by Maya · Thu 22 Oct", "Next due Mon 23 Nov". No Mark paid, Skip or Remove. No highlight: the notification lands at the top of the bill and focus sits on the heading. The source export draws a one-time highlight here (the house-style MOTION rule); this frame removes it and carries the label "HOUSE-STYLE EXCEPTION pending founder decision" (see the arrival-highlight check). Provenance block: "From a photo Maya took · Mon 19 Oct", "We read this from Maya's photo. Maya confirmed the amount on Mon 19 Oct.", "We read Thu 8 Oct, the statement date. Maya changed it to Fri 23 Oct on Mon 19 Oct.", mark word "Maya added this". The trend card has the caption "Your household's amounts. The line is the average of 14 homes nearby."
- R11 = B15's Today strip. Source: f5-today-calendar-strip · ios · 15-phase2-money-rows. Deltas: Thu 22 Oct, 6:00 PM, Maya's Today (before she marks the bill paid). The window runs Thu 22 Oct to Wed 4 Nov, so the week-two label above cell 8 reads "Thu 29". Every row in the window, in date order, with its relative count re-dated to Thu 22 Oct:
  - "Clark Public Utilities · $142.18" · "Tomorrow · Fri 23 Oct" · you-added tick;
  - the Mon 26 Oct statewide voter bar, "Register or update to vote: online or mail" · "in 4 days · must arrive by Mon 26 Oct";
  - "Garbage only" · "in 5 days · Tue 27 Oct" · you-added (one mark);
  - "City of Vancouver water · $84.00" · "in 6 days · Wed 28 Oct" · you-added tick;
  - "HOA dues · $285" · "in 10 days · Sun 1 Nov" · "Repeats monthly" · "Sam added this · 3 Oct";
  - "Comcast · $79.99" · "in 11 days · Mon 2 Nov" beside the narrowed county bar;
  - "Pay property tax, 2nd half" · "in 11 days · due Mon 2 Nov" (county bar, official);
  - "Recycling and garbage" · "in 12 days · Tue 3 Nov" · you-added (two marks; recycling every other week after Tue 20 Oct);
  - the Tue 3 Nov statewide bar (in-person voting until 8:00 PM) · "in 12 days".
  Summary "Next 14 days: 9 items". The Tue 20 pickup row is out of the window. No row has a tonight outline (nothing is collected Fri 23 Oct). The side state column is not drawn.
- R12 = fallback inset beside F11, labelled "only if the backend 7-day bill lead is not built". Source: f10-extraction-confirm · ios · 03-high-confidence. Deltas: Remind me with only 1 day selected, the 7-day lead absent, and the caption "We'll remind you the day before and on the day."
- R13 = B11b's removed-state copy. Source: f10-bill-provenance · ios · 14-bill-removed. Deltas: Thu 22 Oct, 6:06 PM; the host line reads "That bill was removed." and the button reads "Back to bills" (the export has "This bill was removed." and "Go to Bills").
- R14 = F15. Source: f5-today-calendar-strip · ios · 15-phase2-money-rows (exported for Tue 20 Oct at 6:10 PM). Deltas: status bar and frame time Tue 20 Oct, 7:30 AM. The Tue 20 pickup row "Recycling and garbage · Today" is drawn in its active Today style (text.primary, two marks in cell 1), not the export's done style: carts were out by 6:30 AM and the truck has not yet been marked done. Every other row, the relative counts (same day as the export) and the summary "Next 14 days: 8 items" are unchanged. The export's side state column is kept but greyed, labelled "export specimens, not this story".
- P1 = F02. The system document scanner. Draw a neutral placeholder phone frame in surface.sunken with the centred caption "System document scanner (VisionKit on iOS, ML Kit on Android) · not drawn by Pantopus · 8 pages". Draw no Pantopus UI inside it.
- B8 and B12 specimens are redraws too; they are described under FAILURE BRANCHES. Time and date re-reads on B9 (the export's 6:02 PM becomes 6:20 PM) and on the F23 web inset (Thu 22 Oct) are also deltas, and only those values change. The B10 frames are not re-dated: they are placed with their export date, Mon 19 Oct ("due in 4 days"), and captioned "specimen · export dated Mon 19 Oct; on Thu 22 Oct the due line reads 'Tomorrow · Fri 23 Oct'".

PERSONA & SITUATION
- Maya Chen, owner of HOME A (2418 NE Larkspur Loop, Vancouver, WA 98684, "Your household"; lock-screen label "Larkspur Loop"). She is the only person at HOME A who can mark bills paid. Her evening briefing (6:00 PM) is on, because it carries her confirmed Tuesday pickup. On Thu 22 Oct it has no pickup item, and the main lane draws the Clark reminder as its own Dates & bills notification; R5b shows the merged alternative. How bill reminders and the 6:00 PM briefing combine is an open decision (Notes).
- Sam Ortega, a member. He can see bills, amounts and photos, but he cannot mark bills paid (the f3-bill-detail-web and f3-bills-list rule; f10-bill-provenance says otherwise, logged as a MISMATCH). Sam switched Household activity on Mon 14 Sep (from f3-household-notifications) and has Dates & bills on. This storyboard assumes bill reminders reach every member who can see bills, even though Maya set the reminders at F09 and F10 (an assumption to confirm; see the handoff checks and Notes).
- Alex Kim, a guest with access until Sun 1 Nov, who cannot see bill photos, payees or amounts. Alex appears here only because the exported f10 artboards carry his audience line. He is not a house-style fixture; list him on Notes.
- Mon 19 Oct 2026, 6:03 PM (TODAY is 6:10 PM). Maya is on the sofa with tonight's paper stack: 4 letters, 8 pages. Tray pages 1–2 are Clark Public Utilities, 3–4 City of Vancouver water, 5 the Larkspur Loop HOA letter, and 6–8 Chase. Five digital pieces are already waiting in Mail Day, and six pieces were decided earlier (two from a 12:40 PM lunch scan). Before tonight, the bills list holds only Comcast.
- The bill this journey follows is the house-style fixture: Clark Public Utilities, $142.18, due Fri 23 Oct, account ending 4471. The read picks the statement date (Thu 8 Oct) instead of the payment due date, and it is unsure of the account number.
- Time moves forward twice: to Tue 20 Oct, 7:30 AM, and to Thu 22 Oct, 6:00 PM, when the day-before reminder arrives. Maya pays on the utility's website, marks the bill paid, and Sam finds out without paying it again.

GOAL: Turn paper into checked bills with reminders, mark one paid, and make sure Sam does not pay it too and is never reminded about a paid bill.

§5 METRIC THIS JOURNEY MOVES
- Week-four return, the monthly return with investment. Annotate each app open with the session_open event it writes: F01 session_open{trigger:'organic'}; F15 session_open{trigger:'organic'}; F19 session_open{trigger:'push', kind:'bill'}; F22 session_open{trigger:'organic'} (Sam opens from the home screen, not from the tray).
- Honesty. No read reaches bills, the calendar or a reminder until Maya confirms it (F08 to F10, including the flagged account number), and no reminder reaches anyone after the bill is marked paid (F20 to F22). Put a small "Honesty" tag on those callouts.

THE HAPPY PATH
Each step lists the platform, the surface and state, what Maya or Sam does, what the screen shows, what is carried to the next step, and the MOMENT OF TRUTH callout for the margin lane.

F01 · iOS · f10-mail-day-triage · before the scan (R1) · Mon 19 Oct, 6:03 PM
- Does: opens Mail from the tab bar and taps the labelled toolbar action "Scan today's stack".
- Shows: "Mail Day · Mon 19 Oct", "2418 NE Larkspur Loop", ScopeChip "Your household", the audience line "Only you and Sam can see these photos. Alex sees that mail arrived, not the photos or amounts.", the caption "Last scan today, 12:40 PM", and five digital rows.
- Carries forward: the home id and the result of two checks (claimed home: yes; bill access: yes).
- MOMENT OF TRUTH: The scan action is in the header on every populated state, not only in the empty hero. The claimed-home and bill-access checks run before any camera opens.

F02 · iOS · ext:system-document-scanner · batch session (P1) · 6:04 PM
- Does: shoots all 8 pages in one scanner session. Auto-capture finds the edges.
- Shows: the system UI only.
- Carries forward: 8 page images, in scan order, each as its own piece.
- MOMENT OF TRUTH: Pantopus draws nothing inside the scanner, and nothing asks for camera permission on Android.

F03 · iOS · f10-snap-capture-tray · 01-queue-uploading · 6:05 PM
- Does: checks the pages. Pages 1–2 and 6–8 are already joined.
- Shows: "Today's stack", "8 pages · 5 pieces of mail", "5 of 8 pages uploaded", a ring with a text value on every thumbnail (page 3 "Uploading, 60%"), the Chase stack "3 pages · Page 8 didn't upload" with "Retry page 8", the audience line, and "Scan more" beside "Done (5)".
- Carries forward: pages already uploading in the background.
- MOMENT OF TRUTH: The audience is named, including what the guest sees, and each page shows its own upload status in words.

F04 · iOS · f10-snap-capture-tray · 02-page-selected · 6:05 PM
- Does: taps page 4, the second page of the water bill.
- Shows: a 2px ink outline plus a check badge (distinct from the focus ring), and the visible action row "Retake · Delete · Same letter as previous".
- Carries forward: the selection.
- MOMENT OF TRUTH: Grouping is a visible 44pt button, not a hidden gesture.

F05 · iOS · f10-snap-capture-tray · 02b-water-joined · 6:06 PM
- Does: taps "Same letter as previous", then "Done (4)".
- Shows: the water bill (pages 3–4) as a "2 pages" stack, "8 pages · 4 pieces of mail", "Done (4)". Page 3 (the water bill's first page) is still uploading and page 8 (Chase) has still failed. Done stays enabled.
- Carries forward: 4 pieces, in order: Clark Public Utilities, water, HOA, Chase. This is the "Piece N of 4" count used on F08 to F12, and the row order on R2. Nothing has been read yet, so Done lands on Mail Day, not on Confirm.
- MOMENT OF TRUTH: Pages are grouped into pieces of mail, and Done works with a failed page still queued. Nothing is lost.

F06 · iOS · f10-mail-day-triage · just scanned (R2) · 6:06 PM
- Does: waits. The tray closed over Mail Day, and focus returned to "Scan today's stack".
- Shows: four "Photo of your mail" rows with page counts and upload rings. The water row shows "1 of 2 uploaded, 60%". The Chase row shows "Page 3 didn't upload" and "Retry page 3 of 3".
- Carries forward: four pieces reading in the background.
- MOMENT OF TRUTH: No row shows a blank, a spinner, a sender guess or $0.00 before it is read. Nothing opens on its own.
- Arrow to F07: "6:10 PM · 2 pieces read".

F07 · iOS · f10-mail-day-triage · 01-populated-dense · 6:10 PM
- Does: at 6:11 PM taps "Retry page 3 of 3" on the Chase row; at 6:12 PM taps the filled "Confirm what we read" on row 1.
- Shows: the polite status line "2 pieces ready to check · Check now", the legend "○ Read from your photo, not confirmed · ✓ You added this", and row 1 "Clark Public Utilities · Bill · $142.18 · due date needs a check" with the ring mark and the warning left border. Row 2 (water) still reads "1 of 2 uploaded, 60%". Row 3 (Chase) still reads "3 pages · 2 of 3 uploaded" with "Page 3 didn't upload". Row 4 is the now-read Larkspur Loop HOA bill. "Finish day" is outlined in the sticky footer.
- Carries forward: piece 1 with its photo, its read values, the source region and label for each value, the uncertain flags on the due date and the account number, and two labelled date alternatives. Carry note: "At 6:10 PM the Chase page is still failed, as the export shows; it is retried on the arrow out."
- Callout: "Once read, the HOA row sorts below the unread Chase row, as the export draws it."
- Arrow to F08: "6:11 PM · Retry page 3 of 3 → uploaded · 6:12 PM · tap Confirm what we read".
- MOMENT OF TRUTH: Rows read from a photo stay in Needs a call until Maya decides. "Not confirmed" is shown by the ring, the legend and the border, never by amber alone.

F08 · iOS · f10-extraction-confirm · 01-low-confidence · 6:12 PM
- Does: reads the photo beside the fields.
- Shows: "Close · Piece 1 of 4 · Skip for now"; "Looks like a bill · Electric · Change"; the pinned photo; the audience line "Only you and Sam can see this photo. Alex sees that mail arrived, not the photo or amount."; Amount "$142.18" with its crop and the caption "Read beside \"Amount due\""; Due date "Thu 8 Oct 2026", "11 days ago", "Read beside \"Statement date\"", the flag "We weren't sure — check this", and the unselected alternatives "Fri 23 Oct (Payment due date)" and "Tue 13 Oct (Service period end)"; the expanded secondary row "Account ending ····4471" with its own flag "We weren't sure — check this"; Remind me with every lead marked "already passed"; the sticky commit "Add $142.18 due Thu 8 Oct to bills" and "Just file it".
- Carries forward: the values the read proposed. Initial focus is on the flagged Due date.
- MOMENT OF TRUTH (Honesty): Every read field is hollow before commit. The misread date and the unsure account number are visible at once, together with where each was read.

F09 · iOS · f10-extraction-confirm · 01b-date-corrected · 6:12 PM
- Does: taps "Fri 23 Oct (Payment due date)" once. Then she checks "Account ending ····4471" against the paper and leaves it as read.
- Shows: the date flag clears; "You changed this"; "Read beside \"Payment due date\""; "in 4 days · Fri 23 Oct 2026"; Remind me with 1 day selected and 60, 30 and 7 marked "already passed"; the timeline Thu 22 Oct · Fri 23 Oct; the commit "Add $142.18 due Fri 23 Oct to bills". The account row still carries its flag, as the export draws it.
- Callout (Honesty): "The account flag is confirmed with the commit: 'Add $142.18 due Fri 23 Oct to bills' confirms every field shown, including Account ending ····4471, which Maya checked against the paper. The export has no separate check-this-row action for the account, so the flag clears only on commit. Logged for f10-extraction-confirm (Notes)."
- Carries forward: due date Fri 23 Oct, marked as changed by Maya (this feeds the history line on F16); account ending 4471, confirmed on commit; reminders on Thu 22 Oct and Fri 23 Oct.
- MOMENT OF TRUTH: Checking costs less than trusting. The correction takes one tap, in place, with no reason picker.

F10 · iOS · f10-extraction-confirm · 04-added · 6:13 PM
- Does: taps "Add $142.18 due Fri 23 Oct to bills", then "Next piece".
- Shows: "Added to bills and your calendar: $142.18, due Fri 23 Oct. We'll remind you 1 day before and on the day.", a text-button "Undo", a filled "Next piece", and the legend changed to "✓ You added this".
- Carries forward: a HomeBill (Clark Public Utilities, $142.18, due Fri 23 Oct, account ending 4471, added by Maya on Mon 19 Oct, source: photo), a calendar row, and reminders on Thu 22 Oct and Fri 23 Oct.
- Inset on the arrow to F11: f10-extraction-confirm · ios · 06-reading ("Reading your mail…"), labelled "6:13 PM · piece 2 still reading".
- MOMENT OF TRUTH (Honesty): The commit and the success line restate the amount, the due date and the real reminder dates. The word "Paid" appears nowhere.

F11 · iOS · f10-extraction-confirm · 03-high-confidence · 6:14 PM
- Does: checks "City of Vancouver · water · $84.00 · Wed 28 Oct 2026" and taps "Add $84.00 due Wed 28 Oct to bills", then "Next piece".
- Shows: hollow marks with no flags, 7 days selected (with the success line "7 days before (Wed 21 Oct)"), and the collapsed line "Clark Public Utilities added · Undo" under the top bar. The R12 fallback inset sits beside it.
- Carries forward: the second bill. Arrow to F12: "Piece 3 of 4 · Larkspur Loop HOA · tap Skip for now → stays not confirmed".
- MOMENT OF TRUTH: A confident read still looks unconfirmed until Maya commits it, and the undo for piece 1 stays reachable.

F12 · iOS · f10-extraction-confirm · 05-just-filed · 6:16 PM
- Does: files the Chase statement with "Just file it", then taps "Back to Mail Day".
- Shows: "Piece 4 of 4", "Looks like a statement · Change", "Account ending ····8830", and "Just file it" as the filled primary.
- Carries forward: Chase filed with no bill.
- MOMENT OF TRUTH: Filing without a bill is a first-class commit, and "Change" can still turn a misread statement into a bill.

F13 · iOS · f10-mail-day-triage · decide open (R3) · 6:18 PM
- Does: taps "Decide" on row 1, then "Recycle paper, keep photo". She decides the water row the same way and the Chase row with "Keep paper, keep photo".
- Shows: row 1 with its confirmed fact and tick; the verb-phrase buttons; the inset of the collapsed row with its static "Undo".
- Carries forward: three decided rows, each collapsed in place with an Undo that lasts until Maya leaves the screen.
- MOMENT OF TRUTH: A decided row collapses in place with its own Undo, and there is no countdown.

F14 · iOS · f10-mail-day-triage · day finished (R4) · 6:21 PM
- Does: taps "Finish day". One light haptic tick.
- Shows: "Day finished. 6 pieces still need a call. They'll be here tomorrow.", "Day finished · Undo", the three decided rows still collapsed in place with their Undo, and "Reviewed today · 6".
- Carries forward: the decisions become final when Maya leaves the screen; on her next visit the three rows are listed under Reviewed today (then "Reviewed today · 9").
- MOMENT OF TRUTH: The finished line never claims "all your mail" and counts only what is still open.

TIME GAP: "The next morning · Tue 20 Oct, 7:30 AM".

F15 · iOS · f5-today-calendar-strip · phase-2 money rows, morning (R14) · Tue 20 Oct, 7:30 AM
- Does: opens Today and taps the money row.
- Shows: "Clark Public Utilities · $142.18" · "in 3 days · Fri 23 Oct" with the you-added tick; "City of Vancouver water · $84.00" · "in 8 days · Wed 28 Oct"; "Recycling and garbage · Today" in its active style (not yet done at 7:30 AM). The greyed side state column is labelled "export specimens, not this story".
- Carries forward: the bill id.
- MOMENT OF TRUTH: The bill appears wherever the calendar renders, with the tick that says Maya added it.

F16 · iOS · f10-bill-provenance · 03-corrected-date · Tue 20 Oct, 7:30 AM
- Does: reads the headline, then scrolls.
- Shows (the export's strings; the export is already dated Tue 20 Oct, 7:30 AM): "$142.18", "in 3 days · due Fri 23 Oct", StatusChip "Upcoming"; beneath them, the quiet block "From a photo you took · Mon 19 Oct", "We read this from your photo. You confirmed the amount on Mon 19 Oct.", "We read Thu 8 Oct, the statement date. You changed it to Fri 23 Oct on Mon 19 Oct.", "View the photo", "Fix what we read", "Delete the bill and the photo".
- Carries forward: nothing new.
- MOMENT OF TRUTH: The provenance is evidence beneath the number, not a banner. The corrected date keeps the tick, and a plain history line tells the story.

F17 · iOS · f10-bill-trend · 01-twelve-months · Tue 20 Oct, 7:31 AM
- Does: reads the October column against the line.
- Shows (the export's strings): 12 zero-based columns (Nov 2025 to Oct 2026), October labelled "$142" with the tick, one reference line with the key "Nearby average $127", the summary "October $142. Your last 12 months ranged from $88 in June to $199 in January. The average of 14 homes nearby is $127.", and "Show amounts".
- Carries forward: nothing. This is the monthly payoff.
- MOMENT OF TRUTH: One reference line with its number of homes stated. No paired bars, and no household-against-household comparison.

TIME GAP: "Two days later · Thu 22 Oct, 6:00 PM".

F18 · iOS · ext:os-push-tray · bill reminder (R5, with the R5b variant beside it) · Thu 22 Oct, 6:00 PM
- Does: taps the notification.
- Shows: "Clark PUD due tomorrow" / "Larkspur Loop". Sam receives the same one (inset), under the every-member assumption in PERSONA.
- Carries forward: the bill id. session_open{trigger:'push', kind:'bill'}.
- MOMENT OF TRUTH: One notice for this bill, with no amount on the lock screen and no "Mark paid" in the tray. It opens the bill itself. Whether that notice is its own Dates & bills push (drawn) or an item in the 6:00 PM briefing (R5b) is an open decision.

F19 · iOS · f10-bill-provenance · due tomorrow (R6) · Thu 22 Oct, 6:01 PM
- Does: reads the amount, leaves the app and pays on the Clark Public Utilities website. Then she comes back and taps "Mark paid".
- Shows: "$142.18", "Tomorrow · due Fri 23 Oct", "Upcoming", and the unchanged provenance block.
- Carries forward: the bill id and Maya's identity as the payer.
- Labelled gap on the arrow: "6:15 PM · Maya pays on the utility's website (outside Pantopus)".
- Callout, tagged "HOUSE-STYLE EXCEPTION pending founder decision": "Drawn with no highlight on a push landing, following f10-bill-provenance: the bill is the whole screen, so focus goes to the amount instead. The house style says deep-link landings fade a highlight once; if the founder keeps that rule, this frame gains the 300ms highlight on the headline block."
- MOMENT OF TRUTH: A push lands at the top of the bill with focus on the amount, not on a list.

F20 · iOS · f10-bill-provenance (iOS bill detail host) · marked-paid-undo (R7) · Thu 22 Oct, 6:20 PM
- Does: reads the result, then leaves the screen at 6:22 PM without tapping Undo.
- Shows: "Marked paid · Undo", "Paid", "Marked paid by you · Thu 22 Oct", "Next due Mon 23 Nov", "No more reminders for October's bill, for anyone.", and "We'll let Sam know when you leave this screen."
- Carries forward: paid status (saved at once, so Sam's list and detail already read "Marked paid by Maya"). October's reminders are cancelled for Maya and Sam, including Fri 23 Oct. One bill_paid notification is queued until Maya leaves.
- Margin callout: "Fri 23 Oct day-of reminder: cancelled for everyone. Sam's delivered 6:00 PM reminder: replaced."
- Arrow to F21, drawn from Maya's lane down to Sam's lane: "Maya leaves the screen · 6:22 PM → exactly one notification to Sam".
- MOMENT OF TRUTH (Honesty): This is where "paid" is confirmed. A mis-tap notifies nobody, and no one can be reminded about a paid bill.

F21 · iOS · ext:os-push-tray · household bill_paid (R8) · Thu 22 Oct, 6:22 PM · Sam's phone
- Does: sees it and does not tap it.
- Shows: "Maya marked Clark PUD paid" / "Due Fri 23 Oct · Larkspur Loop", on the lock screen.
- Carries forward: an unread row in Sam's Notifications.
- MOMENT OF TRUTH: The name comes first. It reaches Sam only because he switched Household activity on (Mon 14 Sep), and it arrives Active only because the bill was due within 3 days for him. It replaces his earlier reminder instead of stacking on it.

F22 · iOS · f3-household-notifications · unread list (R9) · Thu 22 Oct, 6:30 PM · Sam
- Does: opens Pantopus, taps the bell (badge 1), then taps row 1.
- Shows: "Maya marked Clark Public Utilities paid" / "$142.18 · due tomorrow · Fri 23 Oct · 6:22 PM · Larkspur Loop" alone under TODAY; the older rows under EARLIER with dated times.
- Carries forward: the bill id. The row is marked read.
- MOMENT OF TRUTH: A quiet row that states an action, not blame, and lands on the exact bill.

F23 · iOS · f10-bill-provenance (iOS bill detail host) · paid-landing-member (R10) · Thu 22 Oct, 6:30 PM · Sam
- Does: reads it and does not pay.
- Shows: "$142.18", "Paid", "Marked paid by Maya · Thu 22 Oct", "Next due Mon 23 Nov", and "From a photo Maya took · Mon 19 Oct". Web twin inset: f3-bill-detail-web · web-1440 · 04-paid-landing-member, with its date read as Thu 22 Oct; its one-time highlight follows the current house style and is captioned "house-style highlight; see the arrival-highlight check".
- Carries forward: nothing. The journey ends here.
- MOMENT OF TRUTH: A calm, neutral Paid state that reads as reassurance. No error slab and no success slab.

LAYOUT
- Artboards are 2400 wide, on surface.app, and at least 1500 tall. Height grows in 520px rows to fit the content: never scale a storyboard frame below 50%, and never overlap frames, callouts or caption strips. Navigation thumbnails (branch start and rejoin thumbnails, and the focus-path strip on artboard 16) are 25% and carry the small label "thumbnail". Each artboard carries its visible name label above it.
- Artboards 01–06 (happy path) have no failure lane. Their bands, top to bottom:
  (1) the margin lane: moment-of-truth callouts, each tied by a thin text.secondary leader to its frame, headed "MOMENT OF TRUTH · F07";
  (2) the happy-path lane: phone frames at 50% (iOS 196x426, Android 206x458, web-390 195x422) and desktop frames at 50% (web-1440 720x450), left to right, with 48px between frames;
  (3) on artboard 06 only, a second happy-path lane labelled "Sam's phone", under Maya's lane.
- Under each happy-path frame where a branch starts, draw a small caption tag naming the branch and its artboard, so the founder can trace across artboards: F01 "Branches: B1, B2 → artboard 07 · B7 → artboard 08"; F03 "B3 → 07"; F07 "B4 → 08"; F08 "B5 → 08"; F10 "B6 → 08"; F14 "B13 → 11"; F16 "B11a → 10"; F17 "B14 → 11"; F18 "B10, B15 → 09 · B11b → 10"; F20 "B8, B9 → 09".
- Artboards 07–11 (branches) hold one row per branch. Each row starts with a 25% thumbnail of its start frame, labelled "thumbnail · from F16" (or wherever it starts), then a dashed arrow labelled by the condition ("no claimed home", "scanner not supported"), then its frames at 50%, then either a solid arrow labelled "rejoins at F06" (or wherever it rejoins) with a 25% thumbnail of the rejoin frame, or the caption "ends here". The branch's moment-of-truth callouts sit above its row.
- Arrows are 1.5px text.strong lines with a solid head. Each is labelled with its trigger in caption type: "tap Scan today's stack", "scanner returns 8 pages", "tap Same letter as previous", "tap Done (4)", "6:10 PM · 2 pieces read", "6:11 PM · Retry page 3 of 3 → uploaded · 6:12 PM · tap Confirm what we read", "tap Fri 23 Oct · check account", "tap Add $142.18 due Fri 23 Oct to bills", "tap Next piece", "tap Skip for now", "tap Just file it · Back to Mail Day", "tap Decide", "tap Finish day", "tap money row", "scroll", "push at 6:00 PM · tap", "tap Mark paid", "leaves the screen · 6:22 PM", "push to Sam · not tapped", "tap bell · tap row".
- Time jumps are a 96px gap with a vertical dashed rule and a label chip in surface.sunken: "The next morning · Tue 20 Oct, 7:30 AM" and "Two days later · Thu 22 Oct, 6:00 PM". Moves within the same evening use the arrow label only.
- Each frame carries a small caption strip under it: what is carried forward, in 12/16 text.secondary, starting "Carries:".
- Draw no new card style. Callouts are raised surface, radius lg, shadow sm, with text.primary body. The HONESTY tag and the HOUSE-STYLE EXCEPTION tag are neutral pills in surface.sunken, never a semantic colour.

FAILURE BRANCHES (each drawn, with its recovery and the surface it lands on)
- B1 · No claimed home (Jordan Lee at PLACE B, "Saved place · Only you"). Starts at F01. Before any camera, f10-mail-day-triage · ios · 11-no-claimed-home (or f10-snap-capture-tray · ios · 11-no-claimed-home from the tray entry) shows "Mail snap needs a claimed address" / "Bills live with a claimed home. You can still add a due date for yourself." with "Add a due date" and "Claim this address". "Add a due date" replaces the notice (never stacked) with x-date-sheet · ios · 30-bill-manual-saved-place: a blank, typed bill that saves as a date, with the saves-as-a-date line, the footer "Only you will see this." and no Mark paid. The branch ends on that saved x-date-sheet frame, captioned "Saves as a date on Jordan's Today strip (not drawn here)". "Claim this address" hands off to flow-06. Second specimen, labelled "only when the home was left after the photo was taken": f10-extraction-confirm · ios · 11-no-claimed-home next to x-date-sheet · ios · 28-bill-from-snap, pre-filled with the read values and their rings. Callout: "The blank Date sheet is the route from Mail Day. The pre-filled Date sheet is only for a photo that already exists. The route is not circular." Ends here.
- B2 · Scanner not supported (iOS isSupported false; Android with under 1.7 GB of RAM). Starts at F01. f10-snap-capture-tray · ios · 08-scanner-unavailable and android · 08-scanner-unavailable: "This phone can't run the page scanner. Take a photo of each page, or choose photos you already took." · "Take a photo" · "Choose from photos" (Android adds "You can choose up to 100 photos at a time."). Camera turned off, on iOS and web only: ios · 09-camera-off and web-390 · 09-camera-off, with "Open Settings" and "Choose from photos". Android has no camera-permission frame. Rejoins at F03.
- B3 · Upload failed or offline. Starts at F03. f10-snap-capture-tray · ios · 05-upload-failed ("Retry 3 pages", Done still enabled) and ios · 07-offline ("You're offline. Your pages are saved on this phone." and "Will upload when you're back online" on each page). Then f10-mail-day-triage · web-390 · 09-offline ("You're offline · as of 6:02 PM"). Pieces are held locally with retry on each item. Rejoins at F06 when the connection returns.
- B4 · Reading unavailable. Starts at F07. f10-mail-day-triage · web-390 · 10-reading-unavailable ("We can't read photos right now. Your photos are saved. Add the amount and due date yourself."), then f10-extraction-confirm · ios · 07-reading-unavailable: blank fields with the placeholders "Payee", "Amount" and "Due date", never $0.00 or today's date. "Needed to add a bill" appears only after Add is pressed. Rejoins at F10 with the values Maya typed.
- B5 · Unreadable photo. Starts at F08. f10-extraction-confirm · ios · 08-unreadable-photo: "We couldn't read this photo. It may be blurry or cut off." · "Retake" (reopens the scanner for that page) · "Enter it yourself". Rejoins at F08 after a retake, or at F10 after manual entry.
- B6 · Duplicate suspected. Starts from F10, later that evening, when a second photo of the same Clark bill is confirmed. f10-extraction-confirm · ios · 09-duplicate: "You already have Clark Public Utilities · $142.18 · due Fri 23 Oct on this list." · "Keep both" · "Replace", with neither preselected. Rejoins at F13.
- B7 · Someone without bill access (Alex Kim, guest; this replaces flow-spec's "member without finance.view"). Starts at F01 on Alex's phone. f10-snap-capture-tray · ios · 12-guest-check ("You can scan and file mail here" · "Scan and file"), then f10-mail-day-triage · web-390 · 12-limited-access (rails collapsed, "Bill · photographed today", "File" only, LockedActionRow "Only Maya and Sam can add bills here."), then f10-extraction-confirm · ios · 10-guest (collapsed photo pane "Only Maya and Sam can see bill photos.", "Just file it" filled, "Add to bills" disabled with its reason). If Alex opens the bill later: f10-bill-provenance · ios · 10-guest ("A household bill", no amount, "From a photo Maya took · Mon 19 Oct", and the export's LockedActionRow "Maya or Sam can fix or delete this bill.", tagged MISMATCH) and f10-bill-trend · ios · 05-guest. Ends here. Alex never receives the reminder or the bill_paid notification.
- B8 · Undo after Mark paid. Starts at F20. Redraw a variant of R7 in which Maya taps "Undo": the page returns exactly to R6 ("Upcoming", Mark paid, Reminders "Thu 22 Oct · Fri 23 Oct"). The polite status reads "Marked unpaid again." (invented; list on Notes). Nothing is sent to Sam, and the Fri 23 Oct day-of reminder is restored. Rejoins at F19.
- B9 · A second Mark paid on a paid bill (the race). Only Maya can mark paid at HOME A, so the race is Maya's laptop tab, left open since earlier. Starts at F20. f3-bill-detail-web · web-1440 · 14-mark-paid-race, with the time read as 6:20 PM: "Already marked paid by you on your phone · 6:20 PM" with the Paid chip. Nothing is sent twice. Callout: "flow-spec's 'Sam also taps Mark paid' cannot happen here: Sam has no Mark paid." Ends here.
- B10 · A member wants to record his own payment. Starts at F18 on Sam's phone, on Thu 22 Oct before Maya pays. The two frames are placed as specimens with their export date, Mon 19 Oct (header "specimen · export dated Mon 19 Oct"): f3-bills-list · ios · 01-upcoming-member-dense ("Not marked paid yet" and the header lock row) and f3-bill-detail-web · web-1440 · 05-member-unpaid (LockedActionRow "Maya can mark this paid.", "Due in 4 days · Fri 23 Oct"). Caption under both: "On Thu 22 Oct the due line reads 'Tomorrow · Fri 23 Oct'; nothing else changes." "I paid this" is not offered. Recovery: Sam tells Maya outside the app, and Maya marks it paid. Rejoins at F20. Callout: "Open product decision: 'I paid this' for members."
- B11a · Bill deleted on Tuesday morning. Starts at F16, Tue 20 Oct, 7:32 AM (the time f10-mail-piece-photo gives the delete). f10-bill-provenance · ios · 05-delete-confirm ("Delete this bill and its photo?" / "The $142.18 bill, its reminders and both photo pages go; the mail record stays in Mail." · "Delete bill and photo" · "Keep them"), then ios · 06-deleted-undo ("Bill and photo deleted · Undo"). When the undo closes, the bill's reminders are cancelled for Maya and Sam, so no Thu 22 Oct reminder is ever sent. The mail piece shows f10-mail-piece-photo · ios · 12-bill-and-photo-deleted ("Bill deleted Tue 20 Oct"). Ends on the Bills list.
- B11b · Bill deleted after the push (the stale arrival). Starts at F18: the 6:00 PM reminder is already delivered on Thu 22 Oct. At 6:05 PM (illustrative; list on Notes) Maya deletes the bill from its detail page. The delete withdraws the delivered notice from Maya's and Sam's trays where the OS allows it; the specimen shows a case where it could not (a notice still in the tray). The tray reminder is then tapped: R13, f10-bill-provenance · ios · 14-bill-removed with "That bill was removed." and "Back to bills", and on web f3-bill-detail-web · web-1440 · 17-removed-arrival. The provenance block is absent. Ends on the Bills list.
- B12 · The 'cancelled' vs 'canceled' filter bug. Starts at B11a, on web. Redraw from f3-bills-list · web-1440 · 02-upcoming-manage: the deleted Clark row still listed under Upcoming, with a diagonal "MUST NOT SHIP" band across the specimen and the caption "Web delete must write status 'canceled' (bills/page.tsx:91) so the deleted bill leaves Upcoming." Next to it, the correct result: f10-bill-provenance · ios · 06-deleted-undo, captioned "correct: the row collapses to Undo and never lingers under Upcoming".
- B13 · A bank statement photographed by mistake. Starts at any later visit to Mail (tagged under F14). f10-mail-piece-photo · ios · 07-filed-no-bill (Riverview Bank statement), then ios · 09-delete-confirm-filed, then ios · 10-filed-just-deleted ("Photo deleted. The mail record stays."). The bulk path: f10-mail-snap-privacy · ios · 02-photos-kept, then ios · 06-delete-all-confirm, then ios · 08-deleted ("17 photos deleted. The bills and their amounts stay."). Callout: "Deleting photos never deletes a bill. F16's block then shows the photo-deleted state." Ends here.
- B14 · Not enough homes nearby. Starts at F17. f10-bill-trend · ios · 04-not-enough-homes: columns with no reference line, "Not enough homes nearby to compare yet", and "Pantopus · not enough homes nearby yet". Ends here.
- B15 · Push is off (the no-notifications path). Starts at F18. Maya has notifications off, so there is no lock-screen reminder. On Thu 22 Oct her Today strip (R11) shows "Clark Public Utilities · $142.18" · "Tomorrow · Fri 23 Oct" among its nine re-dated rows, and the row opens R6. Sam, with push off, sees f3-household-notifications · ios · 14-push-off-banner ("Push is off. You'll still see these here.") with the same row as R9. Rejoins at F20 and at F23.

HANDOFF CHECKS (draw each as a pair of cropped thumbnails with a check line and a PASS or MISMATCH word label; these come from the flows-spec handoff gaps and the export review. [14] and [15] name the artboard each check sits on.)
- [14] F03, F07, F08 and the Mail snaps privacy page (B13) must name the same audience: you, Sam, and Alex limited to knowing that mail arrived. Each surface keeps its own grammatical form: the tray and Mail Day say "Only you and Sam can see these photos. Alex sees that mail arrived, not the photos or amounts."; Confirm says "Only you and Sam can see this photo. Alex sees that mail arrived, not the photo or amount."; the privacy page's grid row says "You and Sam. Alex sees that a piece arrived, not the photo or the amount." PASS on audience. MISMATCH on wording: "mail arrived" vs "a piece arrived" (align f10-mail-snap-privacy). No frame may say "never shown to neighbors" or "Everyone in this household can see them" while Alex has no bill access.
- [14] F05 and F08 must agree on the count of pieces: "Done (4)" and "Piece 1 of 4". The tray counts pieces of mail, not pages.
- [14] F05, R2 and F07 must agree on upload state: tray page 3 is the water bill's first page (60% on F05, "1 of 2 uploaded, 60%" on R2 and F07), and tray page 8 is Chase's page 3 ("Page 8 didn't upload" in the tray, "Page 3 didn't upload" on Mail Day). PASS, with a callout on the per-piece page numbering.
- [14] F08 and F07 must use the same read-from-your-photo mark label. The label is pending on the Foundations board; draw it the same on both frames.
- [14] F08 and F09 must show how an uncertain secondary field is cleared. MISMATCH (open): the account row "Account ending ····4471" carries "We weren't sure — check this", but f10-extraction-confirm offers no action that clears it before commit; the storyboard treats the commit as the confirmation. f10-extraction-confirm decides whether the flag clears on a tap of the row or only on commit.
- [14] B1 and the no-claimed-home copy must agree: Mail Day, the tray and Confirm use the same notice and the same two buttons. The Date sheet opened from Mail Day is blank, and only the Confirm path is pre-filled.
- [14] F13 and F14 must agree on where decided rows sit: collapsed in place inside Needs a call, each with Undo, until Maya leaves the screen, then under Reviewed today on her next visit (f10-mail-day-triage). PASS once R4 is drawn this way.
- [14] F14 and the Mail Day reminder must follow one rule, drawn as a rule check, not a delivered push: "If the Mail Day reminder is on, Finish day suppresses that evening's 6:30 PM 'Mail Day tonight' push." The placed F07 export still shows the NotificationAsk "Get a Mail Day reminder at 6:30 PM?", so in this story Maya has not turned it on; the pair shows the rule, labelled OPEN DECISION. Bill reminders are never stacked into the Mail Day push. List it on Notes.
- [15] F10, F11 (with R12) and F18 must agree on the reminders: F10 promises "1 day before and on the day", and F18 fires on Thu 22 Oct. Reminders come from the home reminders job. The 7-day lead on F11 (Wed 21 Oct) depends on the backend bill lead reminder; if that is not built, F11 is replaced by the R12 fallback (1 day selected, "We'll remind you the day before and on the day.").
- [15] F18 and the Briefings rule must agree: the brief sends the evening briefing at 6:00 PM with next-day items and merges items due within the same hour into it, so a Fri 23 Oct bill could arrive inside Maya's Thu 22 Oct briefing (R5b) instead of as its own Dates & bills push (R5). MISMATCH until decided; log it on Notes (f3-household-notifications draws the standalone bill reminder).
- [15] F18 (Sam's inset) and the Dates & bills rule must agree: the brief turns Dates & bills on "only for rows where the person set a reminder", yet Sam receives the reminder Maya set. The rule must be reconciled for household bills (f3-bill-detail-web cancels reminders "for every member"). MISMATCH; log on Notes.
- [15] F10, F15, F16, F19 and F23 must show one bill: Clark Public Utilities, $142.18, due Fri 23 Oct, account ending 4471, added Mon 19 Oct. MISMATCH: f3-bill-detail-web uses account 4417 and "Added by Maya · Sat 3 Oct". The storyboard uses 4471 and Mon 19 Oct; f3-bill-detail-web changes.
- [15] F15 and F16 must use one relative-count form. MISMATCH: the strip says "in 3 days · Fri 23 Oct" and the detail says "in 3 days · due Fri 23 Oct" (and f3-bill-detail-web has its own form). Align f5-today-calendar-strip, f10-bill-provenance and f3-bill-detail-web. On Thu 22 Oct both say tomorrow (R11, R6).
- [15] F15 and the f5 export must agree on the pickup row's time of day: at 7:30 AM (R14) the Tue 20 row is active "Today"; the export's done style belongs to its 6:10 PM viewing time. PASS, noting the re-time.
- [15] F17, F16 and f3-bill-detail-web frame 03 must use the same trend values. MISMATCH: f10-bill-trend says "October $142 … The average of 14 homes nearby is $127." with the key "Nearby average $127"; f3-bill-detail-web says "October: $142.18. Nearby average: $127, from 14 homes." over an underlying $127.40. Align f3-bill-detail-web with f10-bill-trend.
- [15] F16 and F23 must agree on who added the bill and who took the photo: "Added by you" / "From a photo you took" for Maya, and "Added by Maya" / "From a photo Maya took" for Sam. Never "From a photo you took" next to "Added by Sam".
- [15] F19 and F20 must agree on where "paid" is confirmed: on bill detail, with InlineUndo. f3-bills-list, f3-bill-detail-web and f10-bill-provenance must all use InlineUndo for Mark paid. No confirm dialog.
- [15] Role rule: who may mark bills paid. MISMATCH at the source: f10-bill-provenance's Notes give Sam (a member) "bill access: he can add, fix, mark paid and delete bills", and its frame 08 and notification row read "Sam marked Clark PUD paid"; f10-bill-trend and f10-mail-snap-privacy repeat that capability in their Notes. f3-bill-detail-web and f3-bills-list reserve Mark paid for the owner (Maya). The story rests on the owner-only rule. The founder confirms one rule; with owner-only, f10-bill-provenance drops mark paid from Sam's capabilities in its Notes and redraws frame 08, and f10-bill-trend and f10-mail-snap-privacy change their Notes. Whether members may add, fix or delete bills is a separate open question.
- [15] F20, F22 and F23 must agree on the attribution: bill detail says "Marked paid by Maya · Thu 22 Oct", and a BillRow says "Paid by Maya". MISMATCH entries: the f10-bill-provenance export's "Paid by Sam · Thu 22 Oct" (reversed here) and the f5-today-calendar-strip state column's "Paid by Sam · 15 Oct", both following from the role mismatch above. Also MISMATCH: f10-bill-provenance's guest LockedActionRow "Maya or Sam can fix or delete this bill." (confirm whether members may fix or delete bills).
- [15] F21 and F22 must agree with the notification model: household activity is Passive or LOW, except that bill_paid is Active or DEFAULT for a member who still saw the bill as unpaid and due within 3 days. Sam switched Household activity on (Mon 14 Sep), and Clark is due tomorrow, so F21 is Active. flow-spec's "quiet row" describes the in-app row only.
- [15] F19, F23 and the house-style MOTION rule must agree on arrival highlights. The house style (pasted into every project) says "Deep-link landings scroll once and fade a highlight." f3-bill-detail-web 04 and f3-household-notifications 11 follow it. f10-bill-provenance alone says a push or notification arrival lands at the top of the bill with focus on the amount and draws no highlight. The storyboard draws R6 and R10 with no highlight and labels both "HOUSE-STYLE EXCEPTION pending founder decision". MISMATCH against the house style, OPEN DECISION: (a) if the house style stands, f10-bill-provenance changes its push-arrival rule and R6 and R10 gain the one-time 300ms highlight; (b) if the exception is accepted, the house-style MOTION line is amended (proposed: "a landing at the top of a single-object screen moves focus only and draws no highlight") and only then do f3-bill-detail-web and f3-household-notifications change. Neither f3 project changes until the founder decides.
- [15] F22 and F23 must agree on the landing: a single bill_paid row opens bill detail in the Paid state, and only a grouped row opens the Bills list with highlights.
- [15] F16, B11b and the notification gone-target state must agree on the removed-bill copy. f10-bill-provenance says "This bill was removed." with "Go to Bills", while f3-bill-detail-web and f3-household-notifications say "That bill was removed." with "Back to bills". Draw "That bill was removed." with "Back to bills" (R13) and log the change for f10-bill-provenance.
- [15] The guest's name must be the same across projects: the f10 prompts use Alex Kim (until Sun 1 Nov), while f3-bill-detail-web and f3-bills-list use Jenna (until Tue 20 Oct). The storyboard uses Alex on every frame, so the visibility caption on R6 and R7 reads "Maya and Sam can see this bill" through Thu 22 Oct.

ACCESSIBILITY IN THE JOURNEY (draw as artboard 16: a focus-path strip of 25% thumbnails of each frame, labelled "thumbnail", with a numbered focus dot on each)
- F01 → F02: the scan button is announced "Scan today's stack, button". The scanner is the system's.
- F02 → F03: focus lands on the tray title "Today's stack". The status "5 of 8 pages uploaded" is a polite live region.
- F03 → F04: selecting a page announces "Page 4 of 8, water bill, selected", and focus stays on the page.
- F05 → F06: Done closes the tray, and focus returns to "Scan today's stack" in the header. Upload rings announce "1 of 2 uploaded, 60 percent". Close is labelled "Close, your pages keep uploading".
- F06 → F07: the status line "2 pieces ready to check · Check now" is announced politely and does not move focus.
- F07 → F08: focus lands on the flagged Due date, which reads "Piece 1 of 4, Clark Public Utilities bill. Due date, Thursday 8 October 2026, 11 days ago, read beside Statement date, read from your photo, not confirmed. We weren't sure, check this. 2 other dates found."
- F08 → F09: focus stays on the chosen alternative. Remind me announces "Reminders on Thursday 22 October and Friday 23 October." The account row reads "Account ending 4471, read from your photo, not confirmed. We weren't sure, check this."
- F09 → F10: "Adding…" and then "Added" are live regions. Focus moves to the success line, which contains Undo.
- F10 → F11: "Next piece" moves focus to the "Piece 2 of 4" title.
- F11 → F12: "Skip for now" announces "Skipped. Stays in Needs a call." and focus moves to the "Piece 4 of 4" title.
- F12 → F13: back on Mail Day, focus lands on row 1. After a Decide commit, focus moves to the next Needs a call row, and "Recycled paper, kept photo. Undo is on the row." is announced. After the last Decide, focus moves to "Finish day".
- F14: "Day finished · Undo" is announced politely, with one haptic tick.
- F15 → F16: focus lands on the amount heading. Drawn with no highlight, following f10-bill-provenance's in-app rule for a full-screen bill (tagged HOUSE-STYLE EXCEPTION pending, see the arrival-highlight check).
- F18 → F19: the push lands with focus on the amount "142 dollars 18 cents". Drawn with no highlight (HOUSE-STYLE EXCEPTION pending; under the current house style a 300ms highlight would fade once on the headline block).
- F19 → F20: Mark paid is replaced by the InlineUndo line, which is role=status. Focus moves to its Undo button, and "Marked paid. Undo." is announced.
- F22 → F23: the row read is "Unread. Maya marked Clark Public Utilities paid. 142 dollars 18 cents, due tomorrow, Friday October 23, 6:22 PM, Larkspur Loop." On landing, focus moves to the heading "142 dollars 18 cents". Drawn with no highlight (HOUSE-STYLE EXCEPTION pending; the source f3-household-notifications export fades one).
- The no-notifications path is B15: every fact a push carries is also on Today and in the in-app list.
- Greyscale: F07 and F08 still read as not confirmed (ring, legend, border and words), and F10 and F16 read as you-added (tick). Attach the greyscale references beside them.
- Large text: attach f10-mail-day-triage · ios · 13-ax5 and f10-extraction-confirm · ios · 17-ax5, with the caption "At AX5, the commit bar scrolls with the content and the trailing buttons drop below the text."
- Every sheet in the journey (the tray, the Date sheet and the ProvenanceSheet) has a visible Close and never stacks on another sheet.

INSTEAD OF
- Instead of drawing the journey with each project's own fixtures (Dana at Maple St with $184.62 due Oct 2), draw HOME A's Clark Public Utilities bill ($142.18, due Fri 23 Oct) on every frame, because the founder has to see one bill travel.
- Instead of "Sam marked Clark PUD paid", draw "Maya marked Clark PUD paid", because only Maya can mark bills paid at HOME A.
- Instead of a confirm dialog on Mark paid, draw InlineUndo and a notice held until Maya leaves, because a mis-tap must not notify the household.
- Instead of a "Mark paid" action in the tray, draw a tap that opens bill detail, because a tray action cannot offer an Undo.
- Instead of the trend at the end of the journey, draw it on Tue 20 Oct, the morning after Mail Day, because that is the date its export is drawn for and the moment Maya asks "is this normal?"
- Instead of redrawing any exported screen from memory, place the export and change only the listed deltas, because the storyboard exists to show what breaks between screens, not to redesign them.
- Instead of moving an export in time without a REDRAW entry, re-date it through the REDRAW list or print it as a specimen with its export date, because a frame whose header and content disagree reads as a false break.
- Instead of quoting another project's string in a frame, quote the placed export's own string and log the difference as a MISMATCH, because a handoff check that compares the wrong strings passes falsely.
- Instead of settling the arrival-highlight rule inside the storyboard, label it a house-style exception pending the founder, because the house style is pasted into every project and cannot be overridden by one storyboard.
- Instead of a progress bar across the journey, draw time chips and arrow triggers, because the journey is about moments and not about completion.
- Instead of success colours on the Paid landing, keep the neutral StatusChip, because Sam should feel reassured, not warned.

DONE WHEN
- One bill ($142.18, due Fri 23 Oct, account ending 4471) can be followed from the paper stack to Sam's Paid landing without a single value changing, except the ones Maya changed or confirmed.
- The timeline never runs backwards: F06 at 6:06 PM, F07 at 6:10 PM with the Chase page still failed, the retry at 6:11 PM on the arrow out of F07; every re-dated frame (R11, R14) shows relative counts that match its own date.
- Every read value, including the flagged account number, is hollow until F10, and "Paid" first appears on F20.
- Every frame shows its date and time (or its export date, marked specimen), and both time jumps are labelled gaps.
- F20 shows where "paid" is confirmed, what Undo restores, and that the household hears nothing until Maya leaves.
- Sam's lane shows one notification (it replaces his reminder), one list row and one calm landing, with Maya's name first each time, and his opt-in is stated.
- All 15 branches are drawn (B11 in two parts), each with its recovery and the frame it rejoins or ends on, and each happy-path frame where a branch starts carries its branch tag.
- Every handoff check is a drawn pair with its check line, and each mismatch and open decision is logged on Notes with the project that must change (or, for the arrival highlight, the decision the founder must make first).
- The focus path, the no-notifications path, greyscale and AX5 are drawn.
- Android and web appear on the platform-twins artboards for every surface that has a twin export.
- No storyboard frame is scaled below 50%, only labelled thumbnails are at 25%, and nothing overlaps.

ARTBOARDS
1. flow-08 · storyboard · 01-capture-lane · light — F01 (R1), F02 (P1), F03, F04, F05, with their callouts and branch tags.
2. flow-08 · storyboard · 02-triage-and-confirm-lane · light — F06 (R2), F07, F08, F09 (with the account-flag callout), F10, with the 06-reading inset on the arrow out of F10.
3. flow-08 · storyboard · 03-finish-the-stack-lane · light — F11 with the R12 fallback inset, F12, F13 (R3 with its inset), F14 (R4).
4. flow-08 · storyboard · 04-next-morning-lane · light — the "Tue 20 Oct, 7:30 AM" gap, then F15 (R14), F16, F17.
5. flow-08 · storyboard · 05-reminder-and-mark-paid-lane · light — the "Thu 22 Oct, 6:00 PM" gap, then F18 (R5, with the R5b variant beside it), F19 (R6), the utility-payment gap, and F20 (R7), with the cancelled-reminders callout.
6. flow-08 · storyboard · 06-sam-lane · light — a thumbnail of F20 in Maya's lane, the "leaves the screen · 6:22 PM" arrow down to Sam's lane, then F21 (R8), F22 (R9), F23 (R10) and the web twin inset.
7. flow-08 · storyboard · 07-branches-capture-lane · light — B1, B2, B3.
8. flow-08 · storyboard · 08-branches-reading-lane · light — B4, B5, B6, B7.
9. flow-08 · storyboard · 09-branches-paid-lane · light — B8 (redraw), B9, B10 (specimens), B15 (with R11).
10. flow-08 · storyboard · 10-branches-delete-lane · light — B11a, B11b (with R13), B12 (bug specimen).
11. flow-08 · storyboard · 11-branches-photos-and-trend-lane · light — B13, B14.
12. flow-08 · storyboard · 12-platform-twins-mail-lane · light — rows by surface (Mail Day, tray, Confirm), showing the iOS frame used in the lane, then its Android and web exports at 50%, captioned with the one platform difference each shows (for example "web opens the tray as a modal with a drop target; no scanner"). One row per surface.
13. flow-08 · storyboard · 13-platform-twins-bill-lane · light — rows by surface (bill detail, trend), laid out as on artboard 12.
14. flow-08 · storyboard · 14-handoff-checks-capture-lane · light — the checks marked [14], each as a pair of crops with its check line and a PASS, MISMATCH or OPEN DECISION word label (no colour-only status).
15. flow-08 · storyboard · 15-handoff-checks-bill-lane · light — the checks marked [15], drawn the same way.
16. flow-08 · storyboard · 16-accessibility-lane · light — the focus path, the announcements, the greyscale and AX5 references, and the no-notifications path.
17. flow-08 · Notes — The recast (flow-spec's Dana Whitfield at 1428 NE Maple St, Sam Okafor, $184.62 due Oct 2 and 6 envelopes were replaced by Maya, Sam, HOME A, $142.18 due Fri 23 Oct and 8 pages in 4 letters). Alex Kim as a guest until Sun 1 Nov, carried from the f10 exports. The tray page map (1–2 Clark, 3–4 water, 5 HOA, 6–8 Chase) and the R2 row order. The timing choice: the Chase retry moved to the arrow out of F07 (6:11 PM), so F07 keeps its export content at 6:10 PM and no REDRAW of F07 is needed. Every time delta: F01 at 6:03 PM; R2 at 6:06 PM; F11 at 6:14 PM (its export says "later that evening"); F13 at 6:18 PM; F14 at 6:21 PM; F15 (R14) re-timed from the export's Tue 20 Oct, 6:10 PM to 7:30 AM, with the pickup row moved from the done style to the active Today style; Maya's 6:15 PM utility payment; F20 at 6:20 PM and the 6:22 PM leave; Sam's 6:30 PM open; the web race time moved from 6:02 PM to 6:20 PM; B11a at Tue 20 Oct, 7:32 AM (from f10-mail-piece-photo); B11b's 6:05 PM delete and 6:06 PM arrival (illustrative); R9's re-dated EARLIER rows and the dropped Mon 19 Oct mark-paid row; F19 (R6), R10 and R11 re-dated from their exports (F16 is placed as-is: its export is already dated Tue 20 Oct, 7:30 AM); the B10 frames placed with their export date, Mon 19 Oct. R11's re-dated values, all invented: "Tomorrow · Fri 23 Oct"; "in 4 days · must arrive by Mon 26 Oct"; "in 5 days · Tue 27 Oct"; "in 6 days · Wed 28 Oct"; "in 10 days · Sun 1 Nov"; "in 11 days · Mon 2 Nov" (Comcast); "in 11 days · due Mon 2 Nov" (property tax); "in 12 days · Tue 3 Nov" (pickup, with recycling every other week after Tue 20 Oct); the Tue 3 Nov statewide bar "in 12 days"; the week-two label "Thu 29"; "Next 14 days: 9 items". R4's placement: tonight's three decided rows kept collapsed in place until Maya leaves, "Reviewed today · 6" on this frame and "Reviewed today · 9" on the next visit. The reorder of the trend to Tue 20 Oct. No native bill-detail project exists; the iOS host for F19, F20 and F23 is taken from f10-bill-provenance and f3-bill-detail-web. Invented strings: "Day finished. 6 pieces still need a call. They'll be here tomorrow."; "Reviewed today · 6" and "Reviewed today · 9"; "Chase · Filed · Paper kept · Photo kept · Undo" and the other collapsed-row strings on R4; "On Maya's next visit the three decided rows move under Reviewed today…"; "Tomorrow · due Fri 23 Oct"; "Tomorrow · Fri 23 Oct"; "Tomorrow: Clark PUD due" (R5b); "Due Fri 23 Oct · Larkspur Loop" (R8 body); "$142.18 · due tomorrow · Fri 23 Oct · 6:22 PM · Larkspur Loop"; "Marked paid by you · Thu 22 Oct"; "Marked paid by Maya · Thu 22 Oct"; "We read Thu 8 Oct, the statement date. Maya changed it to Fri 23 Oct on Mon 19 Oct."; "Maya added this"; "Marked unpaid again."; "Skipped. Stays in Needs a call."; the spoken announcements "Page 4 of 8, water bill, selected", "1 of 2 uploaded, 60 percent", "Close, your pages keep uploading", "Reminders on Thursday 22 October and Friday 23 October.", "Account ending 4471, read from your photo, not confirmed. We weren't sure, check this.", "Marked paid. Undo." and the F07 → F08 and F22 → F23 row readings; the B1 caption "Saves as a date on Jordan's Today strip (not drawn here)"; the B10 specimen caption; the placeholder caption on P1; the arrow and gap labels. Assumptions and open decisions: Sam's Household activity opt-in on Mon 14 Sep (from f3-household-notifications) and his Dates & bills setting; bill reminders reaching every member who can see bills, against the brief's "rows where the person set a reminder" rule; how bill reminders and the 6:00 PM evening briefing combine (Maya's briefing is on; R5 standalone vs R5b merged); the time of day bill reminders are sent (drawn at 6:00 PM from f3-household-notifications); "I paid this" for members; the rule that Finish day suppresses the 6:30 PM Mail Day push when that reminder is on (Maya has not turned it on in this story; the F07 export still shows the ask); the backend bill lead reminder (7 days and longer) and the R12 fallback; the read-from-your-photo mark label; how the flagged account row is cleared on Confirm (the storyboard treats the commit as confirmation); the removed-bill copy for f10-bill-provenance; who may mark bills paid (owner-only drawn); whether members may add, fix or delete bills; that a delete withdraws delivered notices only where the OS allows it; the omitted Today row for Jordan's manual bill date (B1). PROPOSED HOUSE-STYLE EXCEPTION, pending the founder's decision: a landing at the top of a single-object screen (a push or notification opening one bill) moves focus only and draws no highlight. It would amend the house-style MOTION line "Deep-link landings scroll once and fade a highlight." R6, R10 and the F15 → F16, F18 → F19 and F22 → F23 focus steps are drawn under the exception. If the founder rejects it, f10-bill-provenance changes and the storyboard's frames gain the highlight; if the founder accepts it, the house style is amended and then f3-bill-detail-web (04) and f3-household-notifications (11) change. Each MISMATCH from artboards 14 and 15, with the project that must change: f10-mail-snap-privacy wording; f10-extraction-confirm account-flag clearing (open); f5-today-calendar-strip relative form and "Paid by Sam"; f10-bill-provenance relative form, "Paid by Sam", frame 08, the member capability list in its Notes (drop mark paid from Sam), guest LockedActionRow and removed copy; f10-bill-trend and f10-mail-snap-privacy Notes (drop mark paid from Sam's capabilities); f3-bill-detail-web relative form, trend summary, account 4417 and added date Sat 3 Oct; f3-household-notifications standalone bill reminder (pending the briefing decision); f3-bills-list guest name; the arrival highlight, held as an open house-style decision rather than a directed change. Omitted states.

BATCH PLAN
Turn 1: artboards 1-6, then wait for "continue".
Turn 2: artboards 7-12, then wait for "continue".
Turn 3: artboards 13-17.
