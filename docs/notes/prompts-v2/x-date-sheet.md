# The Date sheet (one sheet, three modes, ten kinds)
id: x-date-sheet · platforms: web/ios/android · isNew: True · artboards: 38

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: The Date sheet · x-date-sheet

TYPE: NEW. One sheet replaces seven: add a date, pickup quick-set, the pickup editor, the voter step sheet, the date detail sheet, the remove-date confirm and the reminder picker. Draw ONE component, DateSheet. The mode (create / view-mine / view-seeded) and the kind change the body. Scope decides two things only: whether the visibility choice appears (homes only) and whether household words may appear.
- At a saved place, in every frame: no visibility choice; the footer is 'Only you will see this.'; the saved message is 'Saved to your calendar. Only you.'
- At a home, in every frame except pickup and voter: the 'Visible to' choice drives both lines. Only you → 'Only you will see this.' / 'Saved to your calendar. Only you.' Household → 'Everyone in this household will see this.' / 'Saved to your household calendar.' A new home date opens with Only you selected.
- Dates carried over after a claim open with the visibility chosen on the claim receipt: Only you if the person declined or left without choosing, Household if they tapped Share.
- Pickup day at a home is always household: no 'Visible to' choice, footer 'Everyone in this household will see this.'
- Voter registration is always Only you and shows no choice.

ATTACH: the place file (Dates section with a missing row and a done row), Today with the 14-day strip and the pickup card, the provenance sheet's report step, and the Foundations board from prompt 00. In every phone frame, draw the host dimmed behind the sheet exactly as the screenshot shows it.

PLATFORMS & VIEWPORTS
- iOS 393x852: a .sheet at the large detent with a leading 'Close' button in the header. For Lease ends, Notice deadline, Insurance renews and Warranty ends, tapping the date field opens the calendar with its month/year selector already open. Path to 31 Mar 2027, three taps: tap the date field, set Mar 2027 on the month/year wheels (one step), tap 31. Paste into the field is accepted.
- Android 412x915: a Material 3 ModalBottomSheet with a top-left close icon (48dp, spoken 'Close'). For the same four kinds, draw an inline M3 date input field inside the sheet with a trailing calendar-toggle icon (48dp). The toggle opens a docked calendar below the field, never a dialog. Use the docked calendar first only for dates within a few weeks. Path: tap the field, type or paste '03/31/2027'.
- Web 1440x900: a right-side SlidePanel, 480 wide, over the place file, with an X labelled 'Close'. Web 390x844: a bottom sheet. Both use a typeable date input.
- Web and Android text input accept '03/31/2027', '31 Mar 2027' and 'March 31 2027'. Paste works.

WHERE IT LIVES & HOW PEOPLE ARRIVE
The sheet opens over Place (the place file) or Today. It has no route of its own. The caller hands over the scope (home or saved place), any preselected kind and the date's id. Entry points:
- Place file: a missing row such as 'When does your lease end?' opens create mode with that kind picked. A known row opens view-mine. The mover row 'Update your voter registration' opens view-seeded voter registration. The row 'Property-tax appeal window closes' opens view-seeded with the sheet title 'Property-tax appeal'.
- Today: the '+ Add a date' row at the foot of the 14-day strip opens create mode with no kind picked. A strip list row opens view-mine or view-seeded (the same tax row title applies). Strip cells are not targets.
- Today pickup card: 'Change pickup day' and the no-rule line 'Set your pickup day' open the Pickup day kind with the city weekday filled in.
- Notification settings pickup status row: 'Set your pickup day' opens the Pickup day kind.
- Provenance sheet: 'Set my pickup day' replaces that sheet's content with this one, with a Back control. The two sheets never stack.
- Civic registration block: 'Check or update' opens view-seeded voter registration. Household calendar rows are read-only, so editing one opens this sheet.
- Mail: with no claimed home, the snap route opens the Bill kind as a manual date (phase 2).
- Reminder push at 7:00 AM, or its row in the in-app notification list. Link: /app/place/today?rule=cal_7f3a2 (native pantopus://place/today?rule=cal_7f3a2). The app lands on the date's row (the strip list if the date is within 14 days, otherwise the place file Dates row), highlights it, moves focus to it, then opens view-mine.
- Shared add-a-date link: /app/place/today?add=date&kind=lease_end (native pantopus://place/today?add=date&kind=lease_end) opens create mode, with the kind picked when the link names one.
After a commit, the sheet hands on:
- Save updates the calling row in place with the you-added mark. It adds the date, and the linked Notice deadline, as tick markers on the place-file year band 'You' lane, and advances Today's first-week row to its next ask. At PLACE B the pickup card then reads 'You · Thursday' with no caveat.
- 'I did this' ticks the place-file mover row 'Update your voter registration'.
- 'Mark done' shows the done line in the sheet. Close then returns to the calling DateRow in its done variant (text.secondary + tick) with 'Marked done · Undo'. Lease ends stays a plain fact.

WHO AND WHEN
Mon 19 Oct 2026, 6:10 PM. Maya Chen at HOME A has her lease PDF open. It says the lease ends Wed 31 Mar 2027 and needs 30 days' notice. She taps 'When does your lease end?' in the place file. Later she checks the household pickup rule Sam set.
Jordan Lee at PLACE B moved in ten days ago. The city says Thursday and he has seen the bins go out weekly, so he taps 'Change pickup day'. Later he opens voter registration from his mover row.

THE ONE JOB: Tell the app a date once, see exactly when you'll be reminded, and see who can see it.

FIRST FIVE SECONDS
1. The date, spelled out: 'Wed 31 Mar 2027'.
2. The date she must act by: 'Notice deadline', 'in 133 days · Mon 1 Mar 2027'.
3. The reminder timeline with real dates.
The one primary action is Save, with the footer sentence directly above it.

CONTENT (house style fixtures; deltas only)
- Sheet title: 'Add a date' in create mode, otherwise the kind name. Grid heading: 'What's this date for?'
- Kind tiles: Pickup day · Move-in date · Lease ends · Notice deadline · Insurance renews · Warranty ends · HOA dues · Property-tax appeal · Voter registration · Bill.
- Valid date ranges by kind. Future only: Lease ends, Notice deadline, Insurance renews, HOA dues. Past allowed: Move-in date and Warranty ends (a past warranty asks whether to keep it on file). Past dates get no reminders.
- Lease ends (HOME A): Wed 31 Mar 2027.
  - Question: 'How much notice does your lease require?' Choices: '20 days (WA minimum)' · '30 days' · '60 days' · 'Other'. Caption: 'Check your lease.' 'Other' opens a 'Days of notice' number field (1–180). Maya picks 30 days.
  - This creates a linked DateRow (deadline variant): title 'Tell your landlord in writing by Mon 1 Mar', caption 'in 133 days · Mon 1 Mar 2027'. The reminders attach to this row.
  - Remind me is 14 days. Ticks: 'Mon 15 Feb 2027 · 14 days before', 'Sun 28 Feb 2027 · Day before', 'Mon 1 Mar 2027 · Day of'.
  - 20 days gives Thu 11 Mar 2027. 60 days gives Sat 30 Jan 2027, with the suggestion 'That's a Saturday. Plan to send it by Fri 29 Jan.'
- Lease ends (PLACE B, Jordan): Wed 31 Mar 2027, 30 days' notice, Notice deadline Mon 1 Mar 2027, 14 days.
- Warranty ends (HOME A): 'Water heater warranty — Rheem 40-gal', Sat 12 Dec 2026, in 54 days. Remind me is 30 days. Ticks: 'Thu 12 Nov 2026 · 30 days before', 'Fri 11 Dec 2026 · Day before', 'Sat 12 Dec 2026 · Day of'. 60 days (Tue 13 Oct) has passed: disabled, with the line '60 days has passed for this date.'
- HOA dues (HOME A): $285, Sun 1 Nov 2026, in 13 days.
- Insurance renews with 'Not sure of the day': 'Renters insurance — PEMCO', 'about Jan 2027'. Remind me is replaced by 'We'll remind you on Fri 1 Jan 2027, the start of that month.'
- Move-in date (PLACE B): Fri 9 Oct 2026. It is in the past, which is valid.
- Pickup day (PLACE B, saved place):
  - Seven weekday ChoiceChips, Mon to Sun. Thursday is prefilled with the hollow mark and the caption 'City of Camas · recycling weekly · 2026 collection calendar'. Print the legend '○ On record, not confirmed' once, beside the mark.
  - 'How often does recycling come?' Not set · Weekly · Every other week. Jordan picks Weekly, so no Next recycling field appears.
  - Preview labelled 'Next recycling': three compact DateRows (pickup variant): 'Recycling and garbage · Thu 22 Oct', 'Recycling and garbage · Thu 29 Oct', 'Recycling and garbage · Thu 5 Nov'. Under them, labelled 'Next holiday change', one DateRow (holiday-moved variant): 'Recycling and garbage · Fri 27 Nov', detail 'Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar'.
  - Text action: 'Use the city schedule again'.
- Pickup day (HOME A, view-mine): Tuesday, Every other week. Caption: 'Sam · Tuesday, confirmed 3 Oct 2026'. The household day wins over the city rule. 'Next recycling': ChoiceChips 'Tue 20 Oct' (selected, set by Sam) and 'Tue 27 Oct', plus 'Another date', which opens the date field. Preview: 'Recycling and garbage · Tue 20 Oct', '· Tue 3 Nov', '· Tue 17 Nov' (no holiday moves). Text action: 'Clear household schedule'.
- Pickup day (HOME A, frequency just switched to Every other week): 'Next recycling' chips 'Tue 20 Oct' and 'Tue 27 Oct' with nothing selected. The preview shows only 'Pick the next recycling day to see recycling dates.' Recycling is never worked out from the garbage day.
- Voter registration (Jordan, PLACE B; seeded statewide):
  - Filled mark. Caption: 'Washington Secretary of State · statewide · checked Oct 2026'.
  - Headline: 'General election · Tue 3 Nov 2026'.
  - Method row 1: 'Online or by mail — must arrive by Mon 26 Oct 2026', caption 'in 7 days'.
  - Method row 2: 'In person, Clark County Elections — until 8:00 PM Tue 3 Nov 2026', caption 'in 15 days'.
  - Line: 'If you moved, update your registration to this address. We can't see whether you're registered.'
  - Plan: 'How will you register?' Online · Mail · In person. Online is picked. Remind me has 1 day selected; 60, 30 and 7 days are disabled with the line '60, 30 and 7 days have passed or fall today.' Ticks: 'Sun 25 Oct 2026 · Day before', 'Mon 26 Oct 2026 · Day of'.
  - 'I did this' is the single primary action; Close is the exit. Then the TextActionRow 'Check or update at VoteWA ↗', which opens an in-app browser on iOS and Android and a new tab on web. Footer: 'Only you will see this.'
  - Draw the filled mark only because this seed has been checked. An unchecked seed gets the hollow mark plus the line 'Not yet checked against the Washington Secretary of State'.
- Property-tax appeal (seeded, county; calling row 'Property-tax appeal window closes'):
  - Caption: 'Clark County Board of Equalization · county-wide · 2026 rules'.
  - Explanation: 'Your county lets you challenge the assessed value your tax is based on.'
  - Rule (DateRow conditional rule): 'Closes July 1, or 60 days after your value notice was mailed.' Then 'Late appeals can't be accepted.'
  - Input: 'When was your notice mailed?' with the option 'I haven't got one yet'.
  - Seeded unchecked: hollow mark, 'On record, not confirmed', and the line 'Not yet checked against Clark County Board of Equalization'. The filled mark appears only once the seed has been checked.
  - After Mon 14 Sep 2026 is entered: 'Closes Fri 13 Nov 2026', caption 'in 25 days', with the you-added mark. Remind me 7 days; line '60 and 30 days have passed for this date.'; ticks 'Fri 6 Nov 2026 · 7 days before', 'Thu 12 Nov 2026 · Day before', 'Fri 13 Nov 2026 · Day of'.
  - 'I haven't got one yet' shows 'Closes Thu 1 Jul 2027 or later' and sets no reminder.
- Property tax, 2nd half (seeded, official): 'Property tax, 2nd half — due Mon 2 Nov', caption 'in 14 days · Mon 2 Nov 2026', detail 'moved from Sat 31 Oct', source 'Clark County Treasurer · county-wide · 2026 tax statement'. Remind me is Off.
- Bill (phase 2): at HOME A from a snap: Clark Public Utilities, $142.18, due Fri 23 Oct, Remind me 1 day. At a saved place: typed by hand, with no photo.
- Worst case: a 68-character title, 'Water heater warranty — Rheem 40-gal, installed by Columbia Plumbing', wraps to two lines.

LAYOUT & VISUALIZATION
Create mode, top to bottom:
- Header: 'Close' and the title.
- Kind grid, 2 × 5. Each cell is at least 56pt tall, holds a 42pt KindGlyph tile and its label, and is one target (48dp on Android, 8dp gaps). There is no step before the grid. After a pick, the grid collapses in place to one row: '[glyph] Lease ends · Change'. 'Change' reopens the grid.
- Tile behaviour: tapping Voter registration or Property-tax appeal switches the sheet in place to that seeded row in view-seeded mode, and the title becomes the kind name. Where no seed exists for the state or county, that tile is absent. Tapping Bill switches the body to bill mode ('Amount', 'Due date', blank). When a lease end already has a linked Notice deadline, the Notice deadline tile shows the caption 'Already set for Mon 1 Mar · from your lease'.
- Date field, with the spelled-out weekday date under it, then the toggle 'Not sure of the day', which swaps the field for 'Month' and 'Year'. The Pickup day kind replaces the date field with the weekday chooser.
- Kind block: the notice question plus the linked Notice deadline DateRow; or the pickup block; or the voter method rows plus plan; or the tax rule plus input.
- 'Title (optional)'.
- 'Remind me' (ReminderLeadControl), 44pt tall:
  - Date-sheet variant: Off · 60 days · 30 days · 7 days · 1 day. Lease variant, anchored to the Notice deadline: Off · 60 · 30 · 14 · 7 · 1, with 14 selected. Draw both exactly as the Foundations board shows them. If labels don't fit one row, wrap to a 3 × 2 grid.
  - Passed leads follow the Foundations passed-lead rule: disabled, still focusable, with the written passed-lead line under the control.
  - Pickup day shows no Remind me; it shows 'Pickup reminders come with your evening briefing at 6:00 PM.'
  - Past-only dates hide Remind me and show 'No reminders for past dates.'
  - A tax appeal with no mailing date shows Remind me disabled with 'Add the mailing date to set reminders.'
- Mini timeline (Foundations anatomy), not to scale:
  - Event line above the line, right-aligned: the Notice deadline KindGlyph (16pt) and 'Notice deadline', with a leader line down to the Day-of tick. 'not to scale' at the left.
  - A horizontal line with three evenly spaced ticks and a two-slash break mark between the first and second.
  - Under each tick, the Foundations labels: the date with year ('Mon 15 Feb 2027'), then the role ('14 days before' / 'Day before' / 'Day of').
  - Below the role labels, right-aligned: 'Wed 31 Mar 2027' and 'Lease ends — reminders count back from the notice deadline'.
  - Do not draw a disc or any filled shape on the timeline.
  - When 1 day is selected, draw two ticks (Day before, Day of) with no break mark and the caption 'We'll also remind you on the day.' Otherwise the caption is 'We'll also remind you the day before and on the day.'
  - With Off selected, hide the timeline; the caption reads 'No reminders set. It still shows on Today and in your place file.'
- At a home only (not pickup, not voter): 'Visible to' with the ChoiceChips 'Only you' · 'Household'.
- ScopeChip sentence, then Save in a sticky footer. The body keeps scroll padding for the footer.
View modes:
- The date is large (h2) with its SourceCaption and mark. The legend word is printed once, at first use.
- With no edits, the footer shows no Save. The primary action is 'Mark done' in view-mine ('I gave notice' on a notice deadline) or 'I did this' for voter.
- Plan and Remind me changes save at once; the status message reads 'Reminders updated'.
- View-seeded shows locked fields as plain text with no outlines. Remind me and 'This isn't right' stay live.

INTERACTION, MOTION & HAPTICS
- Tile tap: the grid collapses in 200ms. Under Reduce Motion, it cross-fades.
- Save shows a spinner inside the button, then the status message, then the sheet closes. One light haptic tick on a successful Save, Mark done or I did this, and nowhere else.
- Close, Android Back and web Escape close the sheet and never commit. Unsaved edits are kept as a draft for this row; reopening shows 'Your unsaved changes are back · Discard'. On iOS, swipe-to-dismiss is blocked while there are edits; Close still works.
- 'Remove this date' closes the sheet and cancels the date's pending reminders. The calling row collapses to an InlineUndo that stays until the person leaves the screen; Undo restores the date and its reminders. Removing Lease ends also removes its linked Notice deadline, and the InlineUndo names both.
- 'Mark done' cancels the remaining reminders and shows the done line in the sheet with 'Marked done · Undo'; Undo restores them. A reminder already delivered is replaced in the tray, not left behind.
- At a home, anything that tells the household (Remove, Mark done, a visibility change) waits until Undo is gone.
- 'Replace it' swaps the existing date. 'Add as a separate calendar event' replaces this sheet's content with the household calendar create sheet (no stacking), carrying the title and date. 'Cancel' returns to the kind grid.
- 'This isn't right' replaces the sheet's content with the ProvenanceSheet report step, which has a Back control.
- No action is swipe-only.

FOUNDATIONS COMPONENTS USED
DateSheet (create, view-mine, view-seeded, conditional seeded, bill mode), KindGlyph (tile and row), ReminderLeadControl (date-sheet and lease-notice variants as drawn on the Foundations board, including Off and the lease 14 days), DateRow (deadline, conditional rule, done, money row, pickup, holiday moved), ProvenanceMark (S and M; read-from-your-photo in bill mode), SourceCaption, ScopeChip (footer sentence form), ChoiceChip (visibility, notice length, weekday, frequency, next recycling, voter plan), InlineUndo, InlineErrorRow (save failed, load failed, remove failed), OfflineNotice (form offline, queued writes), LockedActionRow (names who can act), TextActionRow (outbound), WarmingSkeleton (row skeleton), ProvenanceSheet (opened from another sheet), PushCopy (date reminder, Notes only).

ACCESSIBILITY
- Reading order in create mode: title, what the date is for, date, action date, reminders, visibility, footer sentence, Save.
- Reading order in view-seeded mode: title, date, source, method rows, plan, reminders, I did this, VoteWA link, footer.
- The sheet has a unique title and traps focus. After a tile pick, focus lands on the collapsed row, announced 'Lease ends, selected. Change what this date is for, button'. Focus never jumps to the date field on its own. When the sheet closes, focus returns to what opened it.
- The timeline speaks one sentence: 'Reminders on Mon 15 Feb, Sun 28 Feb and Mon 1 Mar.' (bill: 'Reminders on Thu 22 Oct and Fri 23 Oct.'). At AX sizes it becomes a list of rows with the same words.
- Marks are spoken 'official', 'on record, not confirmed' or 'you added this'.
- Weekday chips are spoken with full names: 'Thursday, on record, not confirmed, selected'.
- A selected tile uses the KindGlyph selected state (filled radio dot and bold label). A selected ChoiceChip uses its check and fill. Both differ from the focus ring.
- Errors sit next to their field and are announced politely. Saved, Reminders updated, Removed and Marked done are status messages. Disabled controls stay focusable and read out their reason.
- Targets: 44pt on iOS and web, 48dp on Android. At AX5, kinds become a one-column list, Remind me becomes selectable rows with a check (no circles), pairs stack and the sheet scrolls.

COPY
- Buttons: 'Save' · 'Close' · 'Change' (spoken 'Change what this date is for') · 'Remove this date' · 'Mark done' · 'I gave notice' · 'I did this' · 'Replace it' · 'Add as a separate calendar event' · 'Cancel' · 'Try again' · 'Retry' · 'Undo' · 'Discard' · 'Back' · 'This isn't right' · 'Use the city schedule again' · 'Clear household schedule' · 'Open it' · 'Use 7 days instead' · 'Use Wed 31 Mar 2027'.
- Labels: 'What's this date for?' · 'Date' · 'Not sure of the day' · 'Month' · 'Year' · 'Title (optional)' (placeholder 'e.g. Water heater warranty') · 'Days of notice' · 'Remind me' · 'Visible to' · 'Only you' · 'Household' · 'Pickup day' · 'How often does recycling come?' · 'Not set · Weekly · Every other week' · 'Next recycling' · 'Next holiday change' · 'Another date' · 'Amount' · 'Due date'.
- Saved: see TYPE. Bill at a home: 'Added to your calendar. We'll remind you the day before and on the day.' Reminder change: 'Reminders updated'.
- Done: 'You marked this done · Mon 19 Oct · Only you' and 'We won't remind you again about this.' Then 'Marked done · Undo'.
- Removed: 'Removed "Water heater warranty — Rheem 40-gal" · Undo'. Lease: 'Removed Lease ends and its notice deadline · Undo'.
- Past date: 'That date has passed. Did you mean Wed 31 Mar 2027?'
- Lead passed: 'That's already passed — remind 7 days before (Sun 25 Oct)?'
- Past warranty: 'This warranty already ended. Keep it on file?'
- Save failed: 'Couldn't save that date. Try again.' Load failed: 'Couldn't load that date.' with 'Retry'. Remove failed: 'Couldn't remove that date. Try again.'
- Offline, create: 'You're offline. Saving needs a connection — what you type stays here.'
- Offline, view: 'You're offline. You can read this date; saving needs a connection.' Remind me and 'This isn't right' are disabled with 'Needs a connection.'
- Voter self-report offline: 'You marked this done · Will save when you're back online.'
- Guest: 'Maya or Sam can change dates at this home.'
- Bill uncertain field: 'We weren't sure — check this'. Bill unreadable: 'We couldn't read this one automatically. Add the amount and due date yourself.'
- Bill at a saved place: 'This saves as a date, not to Bills. Claim this address to track bills.'
- Voter after Mon 26 Oct: 'Online and mail registration have closed. You can still register in person until 8:00 PM Tue 3 Nov.'
- Removed date opened from a reminder: 'That date was removed.'
- Notifications off: 'Notifications are off. These show on Today and in your place file.'

EDGE CASES
- Collision at a home: the Warranty ends tile shows 'Already set for Sat 12 Dec · one per kind for now' before anything is typed. Picking it shows 'Warranty ends is already on file: Water heater warranty — Rheem 40-gal · Sat 12 Dec 2026.' with the existing row inline and marked, then Replace it / Add as a separate calendar event / Cancel.
- Collision at a saved place: the same tile caption; picking it shows 'Already set: Lease ends · Wed 31 Mar 2027. You can have one lease end date per place for now. Open it to change it.' with 'Open it'. No Replace.
- Largest relative count: 'in 711 days · Fri 29 Sep 2028'. Long titles wrap and never truncate. The sheet never prints the street address.
- A slow open from a push shows a row skeleton inside the sheet; if loading fails, InlineErrorRow replaces it.
- A bill never shows $0.00 or today's date in place of a blank.
- Voter (Notes only): no seeded rule for the state means the entry points and tile are absent. If every deadline has passed, the sheet reads 'The deadline for November 3 has passed.' and the existing election banner shows.
- Tiers: a saved place shows no visibility chips and no household words; 'Claim this address to track bills.' is the only saved-place line that names claiming. A guest sees every field disabled, with the LockedActionRow.

INSTEAD OF
- Instead of a multi-step wizard, draw the kind as one tap that collapses in place — because the kind is a choice, not a stage.
- Instead of a calendar you page through for 31 Mar 2027, draw a typeable field (Android, web) or the iOS month/year jump, reached in three taps or fewer — because people copy document dates, they don't browse for them.
- Instead of one lead with one leader line, draw every tick that will fire with its real date — because two or three reminders fire.
- Instead of anchoring the lease reminder to the lease end, anchor it to the Notice deadline — because that is the day she must act.
- Instead of working out recycling from the garbage day, draw explicit Next recycling chips with nothing preselected — because Not set is a real value.
- Instead of a confirm dialog or a timed toast, draw a persistent InlineUndo for Remove and Mark done — because undo must not expire.
- Instead of a household tick on voter registration, draw 'You marked this done · Only you' — because registration belongs to one person.
- Instead of drawing every seed as official, draw an unchecked seed hollow, with its authority and 'This isn't right' — because unverified must look unverified.

DONE WHEN
- A saved-place user can set a pickup day and a lease date, and sees 'Saved to your calendar. Only you.' with no visibility chips.
- Every reminder that will fire is visible with its date, the lease reminder lands before Mon 1 Mar, and Off gives no reminder.
- 31 Mar 2027 is reached in three taps or fewer on each platform, never by paging month by month.
- Recycling is never inferred.
- Who can see the date is stated at the moment of input.
- A guest cannot write.
- Seeded, unchecked and you-added dates can be told apart in greyscale, and no filled shape appears except a provenance mark.
- Marking done stops the reminders, says so and can be undone.
- Close never commits.

ARTBOARDS
1. x-date-sheet · ios · 01-create-lease-dense · light — HOME A, Lease ends, 30 days' notice, linked Notice deadline row, 14 selected, three ticks with the event line, 'Visible to' with Only you selected, footer 'Only you will see this.' Small inset labelled 'three taps' showing the iOS date path.
2. x-date-sheet · ios · 02-create-empty · light — the full kind grid with nothing picked, over the Today strip.
3. x-date-sheet · ios · 03-pickup-weekly-saved-place · light — PLACE B, Thursday hollow with legend, Weekly, the three preview rows and the Thanksgiving row, 'Use the city schedule again', footer 'Only you will see this.'
4. x-date-sheet · ios · 04-pickup-view-mine-household · light — HOME A, 'Sam · Tuesday, confirmed 3 Oct 2026', Every other week, Tue 20 Oct selected, preview, 'Clear household schedule', footer 'Everyone in this household will see this.'
5. x-date-sheet · ios · 05-pickup-next-recycling-unset · light — HOME A, Every other week just picked, both chips unselected, the pick-a-day line, Save disabled with its reason.
6. x-date-sheet · ios · 06-view-mine-warranty · light — HOME A warranty, three ticks, 60 disabled with its passed-lead line, Visible to, Mark done, Remove this date, no Save.
7. x-date-sheet · ios · 07-view-seeded-voter · light — Jordan, method rows, plan Online, 1 day with the passed-lead line, two ticks, I did this, VoteWA link.
8. x-date-sheet · ios · 08-voter-after-deadline · light — dated Tue 27 Oct; online row closed in words, in-person line, plan limited to In person, ticks Mon 2 Nov 2026 · Day before and Tue 3 Nov 2026 · Day of.
9. x-date-sheet · ios · 09-voter-marked-done · light — 'You marked this done · Mon 19 Oct · Only you', 'We won't remind you again about this.', 'Marked done · Undo'.
10. x-date-sheet · ios · 10-tax-appeal-unchecked-empty · light — hollow mark, 'On record, not confirmed', not-yet-checked line, empty mailing date, Remind me disabled, 'This isn't right' live.
11. x-date-sheet · ios · 11-tax-appeal-computed · light — checked seed with filled mark, 'Closes Fri 13 Nov 2026' with the you-added mark, 7 days, passed-lead line, three ticks.
12. x-date-sheet · ios · 12-property-tax-reminder-off · light — official row, Off selected, timeline hidden, the no-reminders caption.
13. x-date-sheet · ios · 13-collision-warranty-home · light — tile caption, then the existing row inline with three choices.
14. x-date-sheet · ios · 14-collision-lease-saved-place · light — PLACE B, tile caption and 'Open it', no Replace.
15. x-date-sheet · ios · 15-lead-passed-hoa · light — HOA dues Sun 1 Nov 2026, date typed after 30 days was chosen: 30 days drawn chosen-then-passed, 60 days disabled, '60 days has passed for this date.', then the lead-passed question and 'Use 7 days instead'; Suggested ticks Sun 25 Oct 2026 · 7 days before, Sat 31 Oct 2026 · Day before, Sun 1 Nov 2026 · Day of.
16. x-date-sheet · ios · 16-past-date-lease · light — 31 Mar 2026 typed, with the suggestion and 'Use Wed 31 Mar 2027'.
17. x-date-sheet · ios · 17-lease-notice-weekend · light — 60 days' notice gives Sat 30 Jan; the Fri 29 Jan suggestion.
18. x-date-sheet · ios · 18-not-sure-of-day · light — PEMCO, 'about Jan 2027', the start-of-month reminder line in place of Remind me.
19. x-date-sheet · ios · 19-saved-lease-saved-place · light — PLACE B, Lease ends Wed 31 Mar 2027, 30 days' notice, no visibility chips, footer, status 'Saved to your calendar. Only you.', then the place file Dates row with the you-added mark and 'in 133 days · Mon 1 Mar 2027'. Inset: Save with its spinner (saving).
20. x-date-sheet · ios · 20-notice-marked-done · light — 'I gave notice' done in the sheet, reminders cancelled; beside it, the place file row in the done variant with 'Marked done · Undo'.
21. x-date-sheet · ios · 21-removed-undo · light — the place file warranty row collapsed to InlineUndo; inset of the lease InlineUndo naming both rows.
22. x-date-sheet · ios · 22-loading-from-reminder · light — dated Mon 15 Feb 2027; the highlighted row ('in 14 days · Mon 1 Mar 2027') and the sheet with a row skeleton.
23. x-date-sheet · ios · 23-load-failed · light — InlineErrorRow 'Couldn't load that date.' with Retry, in place of the skeleton.
24. x-date-sheet · ios · 24-save-failed · light — typed values kept, InlineErrorRow.
25. x-date-sheet · ios · 25-remove-failed · light — the row restored with 'Couldn't remove that date. Try again.'
26. x-date-sheet · ios · 26-offline-create · light — Save disabled with its reason, typed values kept.
27. x-date-sheet · ios · 27-permission-denied-guest · light — Alex Kim at HOME A, fields disabled, LockedActionRow 'Maya or Sam can change dates at this home.'
28. x-date-sheet · ios · 28-bill-from-snap · light — HOME A, fields pre-filled with read-from-your-photo rings, due date flagged 'We weren't sure — check this', 1 day selected with two ticks: 'Thu 22 Oct 2026 · Day before', 'Fri 23 Oct 2026 · Day of', caption 'We'll also remind you on the day.', footer 'You and Sam can see this bill.'
29. x-date-sheet · ios · 29-bill-unreadable · light — the same sheet with blank amount and due date and the unreadable line.
30. x-date-sheet · ios · 30-bill-manual-saved-place · light — PLACE B, typed bill, no photo copy, the saves-as-a-date line, no Mark paid.
31. x-date-sheet · android · 31-create-lease-dense · light — frame 1 content with the inline date input and calendar toggle, docked calendar closed.
32. x-date-sheet · web-1440 · 32-create-lease-dense · light — the right SlidePanel over the place file.
33. x-date-sheet · web-390 · 33-view-seeded-voter · light — the bottom sheet.
34. x-date-sheet · ios · 34-ax5-create-lease · light — one-column kinds, selectable Remind me rows, timeline as a list, sheet scrolled.
35. x-date-sheet · ios · 35-greyscale-tax-appeal-computed · light — frame 11 in greyscale (filled rule mark, you-added computed date, legend words), plus an inset of frame 10's hollow mark.
36. x-date-sheet · ios · 36-create-lease-dense · dark — the dark twin of frame 1.
37. x-date-sheet · ios · 37-view-seeded-voter · dark — the dark twin of frame 7.
38. x-date-sheet · Notes —
  - Reminder push, drawn as the Foundations PushCopy date-reminder tray preview: 'Lease notice due in 14 days' / 'Tell your landlord by Mon 1 Mar', action 'Done', 7:00 AM morning slot, Active level on iOS and DEFAULT importance on Android.
  - Links: /app/place/today?rule=cal_7f3a2 and pantopus://place/today?rule=cal_7f3a2; /app/place/today?add=date&kind=lease_end and pantopus://place/today?add=date&kind=lease_end. The route name follows the Today tab's rename.
  - Assumptions: PLACE B frames are drawn because the saved-place path must be shown, overriding the HOME A-only note; Only you preselected at a home; Sam's household day drawn with the tick; Camas recycling is weekly and every-other-week is shown at HOME A (Vancouver); Tue 20 Oct, 3 Nov and 17 Nov have no holiday moves; Camas moves Thanksgiving pickup to Fri 27 Nov; frame 22 dated on the push day and frame 8 on Tue 27 Oct; voter drawn filled because it was checked; bill footer names people because bill access differs; the server keeps a saved-place pickup day ahead of the city rule (frames 3 and 19) and accepts reminders up to 60 days before (frames 1, 17, 31 and 32); the title 'Add a date' replaces the design doc's 'Add a date that matters'.
  - Omitted states: no seeded voter rule; every voter deadline passed; unchecked voter seed; voter self-report queued offline; move-in with Remind me hidden; the 'I haven't got one yet' tax state; the 'Other' notice field; draft restored.
  - Sourced strings: the save, load and remove errors, both saved messages and the unreadable-bill line.
  - Invented strings: PEMCO; the Rheem title and Columbia Plumbing; Mon 14 Sep 2026; Alex Kim; PLACE B's lease; every as-of caption; 'Maya or Sam can change dates at this home.' (shown in place of the existing permission message); 'That date was removed.'; 'How will you register?'; 'Check your lease.'; 'Days of notice'; 'Add the mailing date to set reminders.'; 'Open it'; 'The deadline for November 3 has passed.'; 'We'll remind you on Fri 1 Jan 2027, the start of that month.'; 'Already set for Mon 1 Mar · from your lease'; 'Removed Lease ends and its notice deadline · Undo'; '60, 30 and 7 days have passed or fall today.'; 'Next holiday change'; 'Pick the next recycling day to see recycling dates.'; 'Claim this address to track bills.'; all suggestion, draft, offline, pickup-briefing and bill-footer copy.

BATCH PLAN
Turn 1: artboards 1-6, then wait for continue.
Turn 2: 7-12, then wait for continue.
Turn 3: 13-18, then wait for continue.
Turn 4: 19-24, then wait for continue.
Turn 5: 25-30, then wait for continue.
Turn 6: 31-36, then wait for continue.
Turn 7: 37-38.
