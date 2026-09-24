# Lease date: entry → 14-day notice reminder → done (Maya, HOME A)
id: flow-03 · platforms: ios/android/web-390/web-1440 · artboards: 14

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

JOURNEY: flow-03 · Lease date from entry to the notice reminder to done

TYPE: NEW (storyboard). Every screen here already has its own design project. This project does not redesign any of them. It lays the journey out as one connected sequence so the founder can see what is carried from screen to screen, what the person sees at each moment of truth, and where the failure branches go. When an attached export and this prompt disagree, draw the export and add the delta this prompt lists, and mark every delta with a small 'Δ' tag beside the frame.

NAMING EXCEPTION: Storyboard projects use "storyboard" in place of the platform value in artboard names (an exception to the house-style ARTBOARDS rule '<surface-id> · <ios|android|web-390|web-1440> · <NN-state> · <light|dark>'). Every other part of the convention applies.

ATTACH (exact exported artboards, by name):
- x-place-file · ios · 01-dense-home · light
- x-place-file · web-390 · 03-member-view · light
- x-place-file · ios · 04-hide-skip-undo · light
- x-place-file · ios · 07-reminder-landing · light
- x-place-file · ios · 08-notice-done · light
- x-place-file · web-1440 · 16-dense-home · light
- x-date-sheet · ios · 01-create-lease-dense · light
- x-date-sheet · ios · 07-view-seeded-voter · light (Remind me control only, as the specimen of the lead-day-today rule in F11)
- x-date-sheet · ios · 13-collision-warranty-home · light
- x-date-sheet · ios · 14-collision-lease-saved-place · light
- x-date-sheet · ios · 15-lead-passed-hoa · light
- x-date-sheet · ios · 17-lease-notice-weekend · light
- x-date-sheet · ios · 18-not-sure-of-day · light
- x-date-sheet · ios · 19-saved-lease-saved-place · light
- x-date-sheet · ios · 20-notice-marked-done · light
- x-date-sheet · ios · 22-loading-from-reminder · light
- x-date-sheet · ios · 23-load-failed · light
- x-date-sheet · ios · 24-save-failed · light
- x-date-sheet · ios · 26-offline-create · light
- x-date-sheet · ios · 27-permission-denied-guest · light
- x-date-sheet · android · 31-create-lease-dense · light
- x-date-sheet · web-1440 · 32-create-lease-dense · light
- x-date-sheet · ios · 34-ax5-create-lease · light
- f1-today-tab · ios · 01-dense-home · light
- f3-household-notifications · ios · 09-tray-date-reminder · light (use the Mon 15 Feb 2027 lease tray only; ignore its budget-hearing inset)
- f3-household-notifications · android · 10-tray-date-and-bill-reminders · light (lease reminder only)
- f3-household-notifications · web-390 · 12-landing-target-gone · light (removed-date inset only)
- f3-household-notifications · ios · 14-push-off-banner · light
- f4-notification-settings · ios · 05-os-denied · light
- f4-notification-settings · web-1440 · 16-browser-blocked · light
- f5-today-calendar-strip · ios · 12-edit-off-member · light
- f5-today-calendar-strip · ios · 14-saved-outside-window · light
- The Foundations board (prompt 00), including PushCopy V7 and V8, ReminderLeadControl V3 and DateRow V3b.
No export exists yet for: the place file before the lease is entered (F01), the lease view-mine sheet (F11, F12), the silent reminder days (F14), a lease collision at a home (B02), the tray 'Done' result (B12), the proposed Today 'coming up' line (B09), Sam's quiet household-activity entries (F07, F13), and the web browser notification (artboard 10). Redraw those frames faithfully from the descriptions below, using the attached neighbours as the visual base, and label each 'Redrawn from description'.

PERSONA & SITUATION (recast; flows-spec's Priya at The Blairmont is replaced)
- Maya Chen, owner of HOME A: 2418 NE Larkspur Loop, Vancouver, WA 98684 ('Your household', lock-screen label 'Larkspur Loop'). She lives there with Sam Ortega (member). Her account dates from Mon 14 Sep 2026. She moved in Sat 26 Sep 2026 and claimed the address on Sat 17 Oct 2026. She is past her first week (counted from account creation), so no FirstWeekRow or Set up block shows for her.
- She rents. Her lease PDF is open in another app. It says the lease ends Wed 31 Mar 2027 and needs 30 days' written notice, so the notice deadline is Mon 1 Mar 2027. She wants one reminder 14 days before that deadline: Mon 15 Feb 2027. The lease was not carried at claim: she enters it for the first time on Mon 19 Oct (see check 17).
- Start time: TODAY, Mon 19 Oct 2026, 6:10 PM Pacific. Later steps move time forward and each says so on its frame.
- Sam Ortega sees the household's dates on his own phone (web-390) the same evening. He switched household activity on on Mon 14 Sep (f3-household-notifications fixture).

GOAL: Type the lease end once, be told early enough to act, and mark it handled so the reminders stop.

§5 METRIC THIS JOURNEY MOVES
- Return with attribution: the Mon 15 Feb 2027 open writes session_open with meta { trigger: 'push', kind: 'date' }. This is the loop's annual-return promise (§1 step 6). Draw this tag on the arrow from F08 to F09.
- Activation: an F5 date is one of the three household facts in the activation query, but it counts only inside the 7-day window from t1_account_created. Write the tag on F04 as 'Counts toward activation only inside the 7-day window; Maya's window closed Mon 21 Sep, so this date does not change her activation.' List Maya's activation status as an assumption on Notes.
- The Tue 16 Feb open is session_open { trigger: 'organic' }. Draw that tag on the F11→F12 gap.

THE HAPPY PATH (frames F01–F14; iOS 393x852 unless stated)

F01 · Mon 19 Oct, 6:10 PM · iOS · x-place-file · HOME A, Dates with a missing lease row · Redrawn from description, based on 'x-place-file · ios · 01-dense-home · light'.
- Deltas from the export: the Dates list has no 'Tell your landlord in writing by Mon 1 Mar 2027' row and no 'Lease ends' row. In their place is one quiet missing FactRow: 'When does your lease end?' with the text action 'Add'. The year band's You lane shows only Nov (HOA dues) and Dec (warranty); the Mar cell is empty and the caption 'Reminder Mon 15 Feb' is absent. FactCount reads '9 on file'. The band summary reads 'Next 12 months: 7 dates, plus pickup every Tuesday. Next: online or mail voter registration must arrive by Mon 26 Oct.' The row 'What moved when you claimed' reads 'Pickup day, 1 date and Ollie · Sat 17 Oct' (the export reads 'Pickup day, 3 dates and Ollie', because its fixture carried the lease at claim). The Next row stays 'Put today on your home screen' · 'See how to add it'.
- Maya does: taps the 'When does your lease end?' row.
- Carried to F02: scope = home (HOME A), kind = Lease ends preselected, the calling row's id (focus returns there).
- MOMENT OF TRUTH (callout): 'The missing fact reads as an invitation, not a failure. The count has no denominator: 9 on file, not 9 of 11.'

F02 · 6:10 PM · iOS · x-date-sheet · create, Lease ends picked, date entry · from 'x-date-sheet · ios · 01-create-lease-dense · light' (crop the top half: header, collapsed kind row, date field).
- Shows: title 'Add a date'; collapsed kind row '[glyph] Lease ends · Change'; the date field, and under it 'Wed 31 Mar 2027'; the 'three taps' inset (tap the date field → set Mar 2027 on the month/year wheels → tap 31).
- Maya does: the three taps.
- Carried to F03: date = Wed 31 Mar 2027.
- MOMENT OF TRUTH: 'A date five months away takes three taps, not paging month by month. Wed 31 Mar 2027 is three taps away.'

F03 · 6:11 PM · iOS · x-date-sheet · create, notice question and Remind me · same export, middle section.
- Shows: 'How much notice does your lease require?' with ChoiceChip options '20 days (WA minimum)' · '30 days' (selected) · '60 days' · 'Other', caption 'Check your lease.' Then the linked DateRow (deadline variant): 'Tell your landlord in writing by Mon 1 Mar', caption 'in 133 days · Mon 1 Mar 2027'. Then 'Remind me', the ReminderLeadControl lease variant: Off · 60 · 30 · 14 · 7 · 1, with 14 selected (the Foundations V3 specimen does not yet draw this; see check 14). Then the mini timeline: event line 'Notice deadline'; ticks 'Mon 15 Feb 2027 · 14 days before', 'Sun 28 Feb 2027 · Day before', 'Mon 1 Mar 2027 · Day of'; right-aligned 'Wed 31 Mar 2027' and 'Lease ends — reminders count back from the notice deadline'; caption 'We'll also remind you the day before and on the day.'
- Maya does: taps '30 days', leaves 14 days selected.
- Carried to F04: notice length = 30 days; linked row = notice deadline Mon 1 Mar 2027; reminder series = Mon 15 Feb, Sun 28 Feb, Mon 1 Mar, each at 7:00 AM.
- MOMENT OF TRUTH: 'The deadline she has to act on becomes its own row with its weekday. Every reminder that will fire is shown with its real date, and the first one lands 14 days before the deadline, while she can still act.'

F04 · 6:11 PM · iOS · x-date-sheet · create, visibility and Save · same export, bottom section, with Δ.
- Δ: Maya taps 'Household' in 'Visible to' (the export shows 'Only you' selected, which x-date-sheet makes the default for a new home date). The footer sentence changes to 'Everyone in this household will see this.' She taps Save. Draw two states side by side: Save with its spinner, then the status message 'Saved to your household calendar.' The sheet then closes.
- Carried to F05: both rows, per-date ScopeChip = 'Household', reminder series, and the 'you added this' tick mark.
- MOMENT OF TRUTH (Check, see check 16): 'Who can see the date is stated at the moment of input, and sharing needs an explicit tap. The default was Only you — but the f5 add row at a home states the household sentence as the default.'

F05 · 6:11 PM · iOS · x-place-file · HOME A, dates known · 'x-place-file · ios · 01-dense-home · light' with the deltas below.
- Shows: the Dates rows 'Tell your landlord in writing by Mon 1 Mar 2027' · 'in 4 months · Mon 1 Mar 2027' · 'One time' · 'Reminders Mon 15 Feb, Sun 28 Feb and Mon 1 Mar' · 'From your lease: 30 days' notice' · Household; and 'Lease ends' · 'in 5 months · Wed 31 Mar 2027' · 'One time' · 'Notice deadline: Mon 1 Mar 2027' · Household, with no reminder on it. The You lane Mar cell has one mark with the caption numeral '2'; the band caption row reads 'Reminder Mon 15 Feb'; FactCount '11 on file'.
- Δ: the 'Lease ends' row carries the focus ring (focus returned to the calling row). A status line 'Saved to your household calendar.' sits above Dates for this frame only.
- Δ: 'What moved when you claimed' keeps F01's 'Pickup day, 1 date and Ollie · Sat 17 Oct' (the export's '3 dates' counts the lease as carried at claim; here it was entered after the claim, so it never counts as moved). Also retire the export's claim-time line that the lease end and notice deadline were carried and shared at claim (see check 17).
- Maya does: taps the Today tab.
- MOMENT OF TRUTH: 'A date five months away is visible and editable here. This is the only screen that shows it until two weeks before the deadline.'

F06 · 6:12 PM · iOS · f1-today-tab · HOME A dense · 'f1-today-tab · ios · 01-dense-home · light' exactly.
- Shows: the 14-day card for Mon 19 Oct–Sun 1 Nov with no lease item. There is no FirstWeekRow.
- MOMENT OF TRUTH: 'Today does not pretend. Mar 1 is outside its 14 days, so Today shows nothing about the lease, and the place file band footer ('See the next 14 days on Today') is the only bridge between the two.' Add a margin note: if Maya had saved from Today's '+ Add a date' instead, Today would show the status line drawn in 'f5-today-calendar-strip · ios · 14-saved-outside-window · light', worded for HOME A: 'Saved · Lease ends Wed 31 Mar 2027 is in your place file · See it'. The '+ Add a date' row at a home states 'Everyone in this household will see this.' as the sheet's default, which disagrees with the sheet (check 16).

F07 · Same evening, 8:40 PM · web-390 · x-place-file · Sam's member view · 'x-place-file · web-390 · 03-member-view · light' exactly.
- Shows: '10 on file' (Maya's private warranty is hidden and not counted), and both lease rows with the 'Household' chip.
- Sam does: reads only. Sam turned household activity on (Mon 14 Sep), so he gets one quiet Notification Center entry, not the reminder series.
- Margin ghost (Redrawn from description, PROPOSED): Sam's iOS Notification Center, Passive level (no banner, no sound), thread 'Larkspur Loop', one entry 'Maya added Lease ends' (21 characters, within the 30-character title limit) / 'Wed 31 Mar 2027 · Larkspur Loop', delivered 6:11 PM. Put a 'Check' callout on it: 'Should adding a shared date notify the household? f3-household-notifications shows "Maya added Chimney sweep" for a calendar event; no prompt says whether a lease date sends one.'
- MOMENT OF TRUTH: 'Household means Sam sees the same two rows with the same dates. It does not mean Sam gets Maya's reminders.'

TIME GAP (a labelled gap on the lane, with a broken-axis mark): 'Four months later · Mon 15 Feb 2027 · 7:00 AM'. Along the gap, draw small ghost ticks for Tue 20 Oct … Sun 14 Feb with the caption 'Nothing about the lease fires in between.'

F08 · Mon 15 Feb 2027, 7:00 AM · iOS lock screen · ext:os-push-tray · 'f3-household-notifications · ios · 09-tray-date-reminder · light' (lease tray only).
- Shows: PushCopy date reminder, expanded, Active level, morning slot. Title 'Lease notice due in 14 days'. Body: draw 'Tell your landlord by Mon 1 Mar' (31 characters, within the 40-character limit, matching Foundations PushCopy V7, the research brief and x-date-sheet) and put the export's 'Tell landlord by Mon 1 Mar' in a Δ callout as the string to retire. One action: 'Done'. No house number and no place label (Maya has one place).
- Maya does: taps the notification body (not 'Done').
- Carried to F09: the rule id of the notice deadline, trigger = push, kind = date.
- MOMENT OF TRUTH: 'The copy names the action and the deadline. It is not Time Sensitive and shows no address.'
- Arrow label F08→F09: 'push tap · /app/today?place=larkspur-loop&rule=cal_7f3a2 · Mon 1 Mar is 14 or more days out, so the app resolves the link to the place file Dates row, not Today'. Tag: session_open { trigger: 'push', kind: 'date' }.

F09 · Mon 15 Feb 2027, 7:01 AM · iOS · x-place-file · reminder landing · 'x-place-file · ios · 07-reminder-landing · light' exactly.
- Shows: the band from Feb 2027 to Jan 2028; the notice row highlighted once, with focus on it; line 2 'in 14 days · Mon 1 Mar 2027'.
- Frame note: if the export shows the 'What moved when you claimed' row, it reads 'Pickup day, 1 date and Ollie · Sat 17 Oct' here (as F05).
- Carried to F10: the rule id; the sheet opens in view-mine mode.
- MOMENT OF TRUTH: 'The landing is the exact row, although the date is outside Today's 14-day strip (Mon 15 Feb–Sun 28 Feb). Today cannot host it.'

F10 · 7:01 AM · iOS · x-date-sheet · loading from reminder · 'x-date-sheet · ios · 22-loading-from-reminder · light' exactly: the highlighted row and the sheet with a row skeleton.

F11 · 7:01 AM · iOS · x-date-sheet · view-mine, notice deadline · Redrawn from description, based on 'x-date-sheet · ios · 01-create-lease-dense · light' in view mode.
- Shows: title 'Notice deadline'; the date large (h2) 'Mon 1 Mar 2027' with the you-added tick and the legend word '✓ You added this' at first use; 'Tell your landlord in writing by Mon 1 Mar'; 'in 14 days · Mon 1 Mar 2027'; 'From your lease: 30 days' notice'; linked 'Lease ends · Wed 31 Mar 2027'; Remind me; the timeline with its three ticks (Mon 15 Feb drawn as today's tick); 'Visible to' with Household selected; footer 'Everyone in this household will see this.'; no Save (no edits); primary action 'I gave notice'; secondary 'Remove this date'; 'Close'.
- Δ PROPOSED (check 18): Remind me draws 14 selected and enabled, because its reminder was sent at 7:00 AM today; 60 and 30 are disabled with the line '60 and 30 days have passed for this date.' Beside it, draw a small inset of the same control under the rule as exported: x-date-sheet treats a lead that falls today as passed and disables it (its frame 7 line reads '60, 30 and 7 days have passed or fall today.'), so under that rule 14 would be disabled here. Put a 'Check' callout on the inset quoting the x-date-sheet line.
- Maya does: reads it and taps Close. She has not written to her landlord yet.
- MOMENT OF TRUTH: 'The sheet shows the rule she set, what fires next, and the one action that ends it.'

TIME GAP: 'Next day · Tue 16 Feb 2027 · 8:15 PM · Maya emails her landlord from her own mail app (not drawn)'. Tag: session_open { trigger: 'organic' }. Arrow label: 'tab tap: Place → notice row'.

F12 · Tue 16 Feb 2027, 8:16 PM · iOS · x-date-sheet · view-mine, mark done · from 'x-date-sheet · ios · 20-notice-marked-done · light' (the sheet half).
- Δ: the relative count reads 'in 13 days · Mon 1 Mar 2027'. After 'I gave notice': the done line 'You marked this done · Tue 16 Feb · Household', then 'We won't remind you again about this.', then the InlineUndo 'Marked done · Undo'. The timeline is replaced by the line 'Reminders off'. One light haptic tick.
- Carried to F13: done state, the Sun 28 Feb and Mon 1 Mar reminders cancelled, the household told only after Undo is gone (when Maya leaves the screen).
- MOMENT OF TRUTH: 'Marking done cancels the remaining reminders and says so, in words, with an Undo that does not expire.'

F13 · 8:16 PM · iOS · x-place-file · notice row done · 'x-place-file · ios · 08-notice-done · light' exactly.
- Shows: 'Done · You marked this done Tue 16 Feb · Reminders off', in the quiet done variant (text.secondary plus tick). 'Lease ends · Wed 31 Mar 2027' stays a plain fact.
- Frame note: if the export shows the 'What moved when you claimed' row, it reads 'Pickup day, 1 date and Ollie · Sat 17 Oct' here (as F05).
- Margin ghost (Redrawn from description, PROPOSED): after Maya leaves the screen and Undo is gone, Sam gets one quiet (Passive) Notification Center entry in the 'Larkspur Loop' thread, 'Maya marked lease notice done' (29 characters) / 'Mon 1 Mar 2027 · Larkspur Loop', and his in-app Notifications list gains the row 'Maya marked Tell your landlord in writing done'. No sound, no banner, and no reminder.
- MOMENT OF TRUTH: 'Done rows recede. Nothing is celebrated.'

F14 · Silent days · Redrawn from description: three small grey lock-screen ghosts labelled 'Sun 28 Feb 2027 · 7:00 AM · no reminder (cancelled Tue 16 Feb)', 'Mon 1 Mar 2027 · 7:00 AM · no reminder (cancelled Tue 16 Feb)' and 'Wed 31 Mar 2027 · Lease ends · no reminder on this row'. Caption: 'Silence is the designed result.'

LAYOUT
- One horizontal lane per storyboard artboard, frames at 50% scale, left to right, each with a label above it: 'F05 · Mon 19 Oct, 6:11 PM · iOS · x-place-file · 01-dense-home'. Mark redrawn frames 'Redrawn from description', deltas 'Δ' and proposed strings 'PROPOSED'.
- Arrows between frames are labelled with the trigger: 'tap row', 'tap 30 days', 'tap Save', 'tab tap: Today', 'Sam opens Place on his phone', 'push at 7:00 AM', 'push tap', 'sheet opens', 'tap Close', 'tab tap: Place', 'tap I gave notice', 'sheet closes'.
- Time jumps are a labelled gap with a broken-axis mark, never a plain arrow.
- Moment-of-truth callouts sit in a margin lane above the frames, one per frame, joined to it by a thin leader line. Use surface.raised cards with an 'MOT' overline. Callouts that expose a broken or inconsistent handoff get a warning glyph and the word 'Check' (glyph colour only; the text stays text.primary).
- Failure branches sit in a lower lane. Each branch leaves from the frame where it starts, with a downward arrow labelled by its condition, and rejoins with an upward arrow labelled 'rejoins F0N'. A branch that ends elsewhere ends with a labelled terminal chip naming the surface it lands on.
- A branch placed on the artboard of its origin frame starts from that frame. Any origin or rejoin on another artboard (including every branch on the branches-only artboards 02 and 05) gets a ghost thumbnail (20%, greyed) labelled 'from F0N (artboard N)' or 'rejoins F0N (artboard N)'.
- Branch crops are drawn at 35% so the lower lane holds them without overlap.
- Quoted strings on the handoff artboards (08a and 08b) are set at 12pt minimum; if a crop would shrink its quoted string below that, quote the string beside the crop instead.
- §5 metric tags are small neutral pills on the arrows they belong to.

FAILURE BRANCHES (lower lane; draw each one)
- B01 · Lead longer than the time left · from F03 · 'x-date-sheet · ios · 15-lead-passed-hoa · light' as the specimen (HOA dues, Sun 1 Nov). Shows 30 days drawn chosen-then-passed, '60 days has passed for this date.', and the question 'That's already passed — remind 7 days before (Sun 25 Oct)?' with 'Use 7 days instead'. The sheet suggests; it never blocks. Rejoins F04.
- B02 · Collision: a lease end is already on file · from a ghost of Today's '+ Add a date' row (the F06 host, artboard 3), condition 'a lease end was already saved earlier' (it cannot start from F01, whose missing row skips the kind grid) · Redrawn from 'x-date-sheet · ios · 13-collision-warranty-home · light' with lease content: in the kind grid ('+ Add a date' opens create mode with no kind picked), the Lease ends tile caption 'Already set for Wed 31 Mar · one per kind for now' before anything is typed; picking it shows 'Lease ends is already on file: Lease ends · Wed 31 Mar 2027.' with the existing row inline and marked, then 'Replace it' / 'Add as a separate calendar event' / 'Cancel'. Beside it, as the saved-place contrast, a crop of 'x-date-sheet · ios · 14-collision-lease-saved-place · light' (limit stated, 'Open it', no Replace). 'Replace it' rejoins F05 (ghost, artboard 3); 'Cancel' returns to the kind grid.
- B03 · The notice deadline falls on a weekend · from F03 · 'x-date-sheet · ios · 17-lease-notice-weekend · light': 60 days' notice gives Sat 30 Jan, with 'That's a Saturday. Plan to send it by Fri 29 Jan.' Rejoins F04.
- B04 · She doesn't know the exact day · from F02 · 'x-date-sheet · ios · 18-not-sure-of-day · light' as the specimen (PEMCO, 'about Jan 2027'). Add a lease note beside it: 'Lease ends · about Mar 2027' with 30 days' notice puts the notice deadline 'between Sat 30 Jan and Mon 1 Mar 2027'; the reminder fires at the start of the month holding the earliest possible notice day (Sat 30 Jan), using the x-date-sheet string 'We'll remind you on Fri 1 Jan 2027, the start of that month.' Put a 'Check' mark on the notice row's label 'about Feb 2027': it disagrees with both the range and the Fri 1 Jan reminder (part of the B04 open decision on Notes). The place file row reads 'about Mar 2027' with 'Add the exact day'. Rejoins F05.
- B05 · The backend still caps lead_days at 0–30 · from F03, when Maya picks 60 (Thu 31 Dec 2026) · 'x-date-sheet · ios · 24-save-failed · light': 'Couldn't save that date. Try again.', every typed value kept. Recovery: pick 30 or 14 and Save. Rejoins F04. Label the branch 'Only if the lead_days migration to 0–60 has not shipped'.
- B06 · Offline · from F04 · 'x-date-sheet · ios · 26-offline-create · light': Save disabled with 'You're offline. Saving needs a connection — what you type stays here.' Rejoins F04 when back online.
- B07 · Maya makes the date private again later · from F05 · crop of 'x-place-file · ios · 04-hide-skip-undo · light' showing the per-date ScopeChip as a 44pt control with its focus ring. Δ: the same control sits on the 'Tell your landlord in writing by Mon 1 Mar 2027' row and reads 'Household' before the change (label the crop 'specimen from the warranty row', where it reads 'Only you'). Then the DateSheet 'Visible to' with 'Only you' selected and the footer 'Only you will see this.' Result: Sam's view drops both lease rows and reads '8 on file'. Lands on x-place-file (Sam's view, redrawn count).
- B08 · A household member who cannot edit dates · from F07 · condition 'after Maya turns off Sam's calendar editing' (by default a member such as Sam can add dates) · three crops: Sam's place file with the Dates rows read-only and the LockedActionRow 'Maya can add and change dates here.'; 'f5-today-calendar-strip · ios · 12-edit-off-member · light' (rows only, 'Maya can add dates here.'); and 'x-date-sheet · ios · 27-permission-denied-guest · light', labelled 'guest specimen (Alex Kim), not Sam' (fields visible but disabled, LockedActionRow 'Maya or Sam can change dates at this home.'). Ends on the read-only row.
- B09 · Notifications are off · from F04 and F08 · three crops: the sheet line 'Notifications are off. These show on Today and in your place file.' under Remind me; 'f4-notification-settings · ios · 05-os-denied · light'; 'f3-household-notifications · ios · 14-push-off-banner · light' with the lease reminder row in the in-app list. Then a PROPOSED Today pinned line on Mon 15 Feb 2027 (Redrawn from description, based on 'f1-today-tab · ios · 01-dense-home · light'): 'Coming up · Tell your landlord in writing by Mon 1 Mar · in 14 days · See it', where 'See it' opens the F09 landing. Label it 'No prompt draws this yet: the reminder has no in-app twin on Today until Tue 16 Feb, when Mon 1 Mar enters the 14-day strip.' Rejoins F09 (trigger: organic).
- B10 · She taps the reminder after the date was removed · from F08 · label the condition 'removed after the 7:00 AM push was delivered (e.g. on another device)', because removing a date cancels its pending reminders. Crops: the margin note of 'x-place-file · ios · 07-reminder-landing · light' (the top of Dates with the status line 'That date was removed') and the removed-date inset of 'f3-household-notifications · web-390 · 12-landing-target-gone · light', with a Δ: the landing is the place file Dates top, not Today, because Mon 1 Mar is outside the strip (f3's own rule: 'or the place file when the date was outside the strip'). No sheet opens and no blank screen. Ends on x-place-file.
- B11 · The date fails to load after the push · from F10 · 'x-date-sheet · ios · 23-load-failed · light': 'Couldn't load that date.' with 'Retry'. Retry rejoins F11.
- B12 · She taps 'Done' in the tray instead of opening · from F08 · Redrawn from description: the tray item is replaced (not left behind), the Sun 28 Feb and Mon 1 Mar reminders are cancelled, and on her next open the notice row shows the done variant with a PROPOSED InlineUndo 'Marked done from a notification · Undo'. Rejoins F13. Callout: 'The household is told only once this Undo is gone. Confirm this rule.'
- B13 · Undo · from F12 · 'Marked done · Undo' tapped: the row returns to its known state, the reminder series is restored, and the status reads 'Reminders updated' (PROPOSED here; x-date-sheet uses this string only for a reminder change). Rejoins F12's pre-done state: draw a ghost labelled 'F11 state, redated Tue 16 Feb · in 13 days · reminders Sun 28 Feb and Mon 1 Mar restored' (not F11 itself, which is dated Mon 15 Feb).
- B14 · The same journey at a saved place (reference, Jordan Lee at PLACE B) · 'x-date-sheet · ios · 19-saved-lease-saved-place · light' (no visibility chips, 'Saved to your calendar. Only you.') and 'f5-today-calendar-strip · ios · 14-saved-outside-window · light'. Note beside it: if Jordan claims PLACE B before Mon 15 Feb (flow-06), the rule moves to home scope and stays 'Only you' unless he taps 'Share with the household' on the claim receipt (f1-claim-receipt); leaving without choosing keeps it private.

HANDOFF CHECKS (draw on the handoff artboards as a checklist; each item joins the two frames it names and quotes the strings side by side. Do not pick a winner; list each unresolved choice as an open decision on Notes.)
1. F01 and F02 must agree on the kind: the missing row 'When does your lease end?' opens create mode with Lease ends already picked and no kind grid.
2. F03 and F05 must agree on the notice row's title and count. The sheet says 'Tell your landlord in writing by Mon 1 Mar' with 'in 133 days · Mon 1 Mar 2027'; the place file says 'Tell your landlord in writing by Mon 1 Mar 2027' with 'in 4 months · Mon 1 Mar 2027'. Quote both strings side by side and list the choice (title with or without the year; one relative-count rule, days or months beyond some threshold) as an open decision on Notes.
3. F03, F05, F08 and F09 must agree on the reminder series: Mon 15 Feb, Sun 28 Feb and Mon 1 Mar 2027 at 7:00 AM. The band caption 'Reminder Mon 15 Feb' and the row line 'Reminders Mon 15 Feb, Sun 28 Feb and Mon 1 Mar' are the same data. flows-spec's v1 gap (x-place-file once put the reminder on the deadline day, and x-date-sheet once had an unlinked 'Notice to vacate — 31 Jan 2027') is closed in the screen prompts; confirm neither survives. It is not closed on the Foundations board (check 14).
4. F04 and F05 must agree on scope: footer 'Everyone in this household will see this.' ↔ per-date chip 'Household' on both lease rows ↔ Sam sees both rows in F07.
5. F04 must show the saved message the design doc specifies: 'Saved to your household calendar.' (flows-spec gap: the Date sheet's saved copy was once unspecified).
6. F08 and the push body: f3-household-notifications reads 'Tell landlord by Mon 1 Mar' (retire it); Foundations PushCopy V7 (00d), the research brief and x-date-sheet read 'Tell your landlord by Mon 1 Mar' (keep it). The storyboard draws the kept string. The component contract's PushCopy example still reads 'Tell your landlord by Sun 31 Jan' (retire it; the Foundations board already replaced it).
7. F08 and F09 must agree on the link. The forms in circulation are /app/place/today?rule=cal_7f3a2 (x-date-sheet), /app/place?rule=lease-notice (x-place-file, the only form that addresses the place file), /app/today?rule=cal_7f3a2 (f1-today-tab, f5) and /app/today?place={place}&rule={rule} (f3-household-notifications, which gives no URL for the outside-the-strip landing). Draw the arrow with the f3 form (/app/today?place=larkspur-loop&rule=cal_7f3a2) and state on it that the app resolves /app/today?place=&rule= to the place-file row when the date is 14 or more days out. List as an open decision on Notes: one link form with client routing, or two forms (Today and place file). Do not retire the place-file form yet; list /app/place/today?rule= and /app/today?rule= (no place) as forms to retire.
8. F08 and F09 must agree on the window boundary: on Mon 15 Feb the strip runs Mon 15 Feb–Sun 28 Feb, so Mon 1 Mar (14 days away) is outside it and lands on the place file. x-place-file says '14 or more days away'; state the same rule on the arrow.
9. F12 and F13 must agree on the done wording and date: the sheet's 'You marked this done · Tue 16 Feb · Household' + 'We won't remind you again about this.' ↔ the row's 'Done · You marked this done Tue 16 Feb · Reminders off'. (flows-spec gap: only the voter kind once had a done action; confirm 'I gave notice' exists on the notice-deadline kind.)
10. B10 and every other removed-date landing must agree on punctuation: x-place-file prints 'That date was removed' with no full stop, while x-date-sheet, f1-today-tab, f5 and f3-household-notifications print 'That date was removed.'
11. B08, F07 and the f5 member frame must agree on the locked-reason string: 'Maya can add and change dates here.' (x-place-file), 'Maya can add dates here.' (f5-today-calendar-strip 12) and 'Maya or Sam can change dates at this home.' (x-date-sheet guest). List one sentence per role (member vs guest) as an open decision.
12. F06 and F05 must agree that a date outside 14 days appears only in the place file. f1-today-tab's FirstWeekRow and x-place-file's Set up block must read the same step status (flows-spec gap on '3 of 6 things on file'); Maya has neither, so draw neither.
13. F01 and F03 must agree with the Notice deadline tile: once the lease end has a linked notice, that tile reads 'Already set for Mon 1 Mar · from your lease'.
14. F03 and the Foundations board must agree on the lease reminder control and row. Foundations ReminderLeadControl V3 selects 30 days, has no 14-day option, and ticks 'Sat 30 Jan 2027 · 30 days before' (spoken 'Reminders on Sat 30 Jan, Sun 28 Feb and Mon 1 Mar.'); F03 and x-date-sheet use Off · 60 · 30 · 14 · 7 · 1 with 14 selected and 'Mon 15 Feb 2027 · 14 days before', and x-date-sheet tells designers to draw it 'exactly as the Foundations board shows them', which the board cannot satisfy. Foundations DateRow V3b reads 'Does not repeat · Reminder Mon 15 Feb 2027'; F05 (x-place-file) reads 'One time' · 'Reminders Mon 15 Feb, Sun 28 Feb and Mon 1 Mar'. Join F03 and F05 to crops of Foundations ReminderLeadControl V3 and DateRow V3b.
15. F05 and the component contract must agree on the notice row title: component-contract DateRow copyRules reads 'Tell your landlord in writing by Sun 31 Jan'; F05 reads 'Tell your landlord in writing by Mon 1 Mar 2027'. The contract string is one to retire.
16. F04 and F06 must agree on the default visibility of a new home date: x-date-sheet says 'A new home date opens with Only you selected.' (footer 'Only you will see this.'); the f5 '+ Add a date' row at a home states the DateSheet default as 'Everyone in this household will see this.' F04's callout and F06's margin note both depend on which is right.
17. F01, F05 and the x-place-file fixture must agree on when the lease arrived. x-place-file's PLACE section reads 'Pickup day, 3 dates and Ollie · Sat 17 Oct' and says the lease end and notice deadline were carried at claim and shared as 'Household'; F01 and F05 read 'Pickup day, 1 date and Ollie · Sat 17 Oct', because Maya enters the lease on Mon 19 Oct, after the claim. Quote '3 dates' against '1 date'. Also join the x-provenance-sheet line 'Added Mon 14 Sep 2026' for the lease.
18. F11 and the x-date-sheet frame 7 rule must agree on a lead that falls today. x-date-sheet: '60, 30 and 7 days have passed or fall today.' (the lead whose day is today is disabled); Foundations PASSED-LEAD RULE: 'A lead whose date is before TODAY has passed.' F11 draws 14 selected and enabled on Mon 15 Feb (PROPOSED). The same open decision appears in flow-13 (its check 7).

ACCESSIBILITY IN THE JOURNEY (draw on the accessibility artboard as a second lane under thumbnails of F01–F13)
- F01→F02: the sheet opens with focus on its title 'Add a date', then the collapsed row announced 'Lease ends, selected. Change what this date is for, button'. Focus never jumps into the date field on its own.
- F03: the timeline is spoken as one sentence, 'Reminders on Mon 15 Feb, Sun 28 Feb and Mon 1 Mar.' At AX5 it becomes a list ('x-date-sheet · ios · 34-ax5-create-lease · light').
- F04: 'Household, selected' reads differently from focus. After Save, 'Saved to your household calendar.' is a polite status message, the sheet closes, and focus returns to the calling row, now 'Lease ends, Wed 31 Mar 2027, you added this, visible to your household'.
- F06: the 14-day card's spoken summary does not mention the lease. Its absence is correct.
- F07: Sam's Passive entry makes no sound and takes no focus; VoiceOver reads it only when he opens Notification Center.
- F08: VoiceOver reads the title, then the body, then 'Done, button'. With previews hidden, the lock screen shows the placeholder 'Date reminder' (Foundations PushCopy V8; the research brief's placeholder list lacks it).
- F09: the landing scrolls once, fades the highlight in 300ms or less, and moves accessibility focus to the notice row before the sheet opens. Under Reduce Motion it jumps and cross-fades.
- F10→F11: while loading, the skeleton is announced once as 'Loading date'; then focus moves to the sheet title 'Notice deadline'.
- F12: 'I gave notice' gives one light haptic tick; 'Marked done' and 'We won't remind you again about this.' are status messages; Undo is focusable, with no countdown.
- F12→F13: on close, focus returns to the notice row, now spoken 'Tell your landlord in writing by Mon 1 Mar 2027, done, reminders off'.
- No-notifications path (B09): the same facts reach Maya through the band caption 'Reminder Mon 15 Feb', the row line 'Reminders Mon 15 Feb, Sun 28 Feb and Mon 1 Mar', the in-app Notifications row and the proposed Today line. Draw this path as a thin parallel lane from F04 to F09 labelled 'No push: what carries the reminder'.
- Greyscale: every lane still reads. The done row is told apart by the tick and its words, not by colour.

INSTEAD OF
- Instead of one frame per screen with no time, draw every frame with its date and time, and every time jump as a labelled gap, because this journey spans four months and its promise is timing.
- Instead of anchoring the reminder to the lease end, keep every reminder on the notice-deadline row, because a reminder anchored to 31 Mar fires after the last day to act.
- Instead of a 60-day lead as the happy path, draw 14 days before the notice deadline (Mon 15 Feb), because that is the fixture, it still leaves two weeks to act, and it saves under the current 0–30 cap.
- Instead of landing the push on Today, land it on the place file Dates row, because Mon 1 Mar is outside Today's 14 days on Mon 15 Feb.
- Instead of a toast that says 'Done!', draw the quiet done row with 'Reminders off' and a lasting Undo, because nothing is celebrated and undo must not expire.
- Instead of sending Sam the reminder series, draw his view as rows plus at most one quiet, PROPOSED household-activity entry per event, because a reminder belongs to the person who set it and Sam chose to hear household activity quietly.
- Instead of saying web has no push, draw the web reminder as a browser notification when the browser allows it, because f4-notification-settings sends to 'this iPhone and one browser'.
- Instead of picking winners in the handoff checks, quote both strings and list the choice on Notes, because this project does not redesign screens.
- Instead of redrawing any attached export, place it as-is and mark only the listed deltas, because each screen is owned by its own project.

DONE WHEN
- The lane reads left to right from Mon 19 Oct 2026 to Wed 31 Mar 2027, with every frame dated and every gap labelled.
- Every reminder that will fire is visible at entry (F03), in the place file (F05), in the tray (F08) and at the landing (F09), with the same three dates.
- The push lands on the notice row outside Today's strip, with focus there, and the sheet opens on it.
- 'I gave notice' visibly cancels the remaining reminders, says so, can be undone, and the silent days are drawn.
- Scope reads 'Household' at input, on both rows and in Sam's view, Sam's quiet household-activity entries are drawn as PROPOSED, and B07 shows how to make it private again.
- 'What moved when you claimed' reads '1 date' on every frame that shows it.
- All 14 branches are drawn with their recovery and where they land or rejoin.
- All 18 handoff checks are drawn with their frames joined and quoted strings legible (12pt minimum), and each unresolved string is listed on Notes.
- Every invented string is on Notes.

ARTBOARDS (each label is shown above its artboard)
1. flow-03 · storyboard · 01-entry-lane · light — F01–F04 at 50% (F04 in its two states) and their callouts.
2. flow-03 · storyboard · 02-entry-branches · light — branches B01–B06 at 35%, each leaving a ghost of its origin frame (F02, F03 or F04 'artboard 1'; B02 from the F06 '+ Add a date' host, 'artboard 3'), with rejoin ghosts (F04 and F05).
3. flow-03 · storyboard · 03-saved-lane · light — F05–F07 (with Sam's PROPOSED household-activity ghost), callouts, and branches B07, B08 and B14.
4. flow-03 · storyboard · 04-reminder-lane · light — the four-month gap, F08–F11 (with F11's PROPOSED Δ and its export inset), callouts and the metric tag.
5. flow-03 · storyboard · 05-reminder-branches · light — branches B09–B12 at 35%, each leaving a ghost of F04 (artboard 1), F08 or F10 (artboard 4), with rejoin ghosts of F09, F11 (artboard 4) and F13 (artboard 6).
6. flow-03 · storyboard · 06-done-lane · light — the next-day gap, F12–F14 (with Sam's PROPOSED done entry on F13), callouts, and branch B13 with its 'F11 state, redated Tue 16 Feb' ghost.
7. flow-03 · storyboard · 07-journey-overview · light — the whole journey on one time axis (Mon 19 Oct 2026 → Mon 15 Feb → Tue 16 Feb → Sun 28 Feb → Mon 1 Mar → Wed 31 Mar 2027) with F01–F14 as 20% thumbnails, the three reminder ticks (the last two struck with 'cancelled Tue 16 Feb'), and the §5 tags.
8a. flow-03 · storyboard · 08a-handoff-checks · light — handoff checks 1–9, each drawn as small frame crops joined by a line, with the disagreeing strings quoted side by side at 12pt minimum.
8b. flow-03 · storyboard · 08b-handoff-checks · light — handoff checks 10–18, drawn the same way.
9. flow-03 · storyboard · 09-accessibility-lane · light — focus landings, announcements, the no-notifications lane and the AX5 crop.
10. flow-03 · storyboard · 10-platform-lane · light — the same moments on the other platforms: 'x-date-sheet · android · 31-create-lease-dense · light' (typed '03/31/2027'); 'x-date-sheet · web-1440 · 32-create-lease-dense · light' over 'x-place-file · web-1440 · 16-dense-home · light' (the leader line to 'Reminder Mon 15 Feb'); the lease reminder from 'f3-household-notifications · android · 10-tray-date-and-bill-reminders · light' (DEFAULT importance, 'Done'), labelled 'Channel: Dates & bills (research brief §3: the Dates & bills group maps 1:1 to an Android channel)'; a Redrawn-from-description web browser notification for Mon 15 Feb 2027, 7:00 AM ('Lease notice due in 14 days' / 'Tell your landlord by Mon 1 Mar', site name in the browser's own chrome); and 'f4-notification-settings · web-1440 · 16-browser-blocked · light' as the blocked case. Label: 'On web the reminder arrives as a browser notification when this browser allows it; otherwise through the Notifications list and the B09 path.' Add a note under the Android reminder quoting the flows-spec channel gap: f3-household-notifications draws channels 'Household activity / Security / Reminders / Briefing'; f4-notification-settings draws 'Briefings / Household activity / Dates and bills / Air and weather alerts'; the brief names 'Dates & bills'.
11. flow-03 · Notes — 
  - Recast: Priya at The Blairmont → Maya at HOME A; the 60-day reminder on Sat 30 Jan → 14 days before the notice deadline, Mon 15 Feb 2027. Maya's account dates from Mon 14 Sep 2026, so she is past her first week. Conflicts: x-provenance-sheet shows the lease as 'Added Mon 14 Sep 2026', and x-place-file's fixture has the lease end and notice deadline carried at claim and shared as 'Household' ('Pickup day, 3 dates and Ollie'), while this storyboard enters the lease on Mon 19 Oct 2026, after the claim (check 17).
  - Assumptions: Maya's activation status is set by her first week (Mon 14–Mon 21 Sep), before she moved in or had a pickup rule; this storyboard does not say whether she activated, and the lease date does not change it. Sam's household activity is on (f3 fixture, Mon 14 Sep).
  - The choice of Household visibility in F04 (x-date-sheet's default is Only you; x-place-file's fixture shows Household).
  - Derived counts and pre-lease deltas: '9 on file' and '7 dates' (F01), 'Pickup day, 1 date and Ollie' (F01, F05, F09, F13), '8 on file' (B07, Sam's view), 'in 13 days' (F12), 'between Sat 30 Jan and Mon 1 Mar 2027' (B04), '60 and 30 days have passed for this date.' (F11) and the export-rule inset of F11.
  - Invented strings: 'When does your lease end?' with the text action 'Add' at a home (F01); Sam's 8:40 PM view; 'Maya added Lease ends' / 'Wed 31 Mar 2027 · Larkspur Loop' (F07, PROPOSED); 'Maya marked lease notice done' / 'Mon 1 Mar 2027 · Larkspur Loop' (F13, PROPOSED); Maya's Tue 16 Feb 8:15 PM email; 'You marked this done · Tue 16 Feb · Household'; 'Reminders off' in the sheet; 'Reminders updated' after Undo of mark done (B13); 'Lease ends is already on file: Lease ends · Wed 31 Mar 2027.'; 'Already set for Wed 31 Mar · one per kind for now'; the lease use of 'We'll remind you on Fri 1 Jan 2027, the start of that month.' (x-date-sheet string); 'about Mar 2027', 'about Feb 2027' and 'Add the exact day' (B04); 'Coming up · Tell your landlord in writing by Mon 1 Mar · in 14 days · See it'; 'Marked done from a notification · Undo'; 'Maya marked Tell your landlord in writing done'; 'Saved · Lease ends Wed 31 Mar 2027 is in your place file · See it' (HOME A wording); 'Loading date'; the place slug 'larkspur-loop' in /app/today?place=larkspur-loop&rule=cal_7f3a2 (the rule id cal_7f3a2 is from x-date-sheet); the web browser notification layout; every frame label and callout. ('Date reminder' is not invented: it is Foundations PushCopy V8. The research brief's placeholder list lacks it; add it there.)
  - Strings to retire: component-contract DateRow copyRules 'Tell your landlord in writing by Sun 31 Jan'; component-contract PushCopy 'Tell your landlord by Sun 31 Jan'; f3-household-notifications 'Tell landlord by Mon 1 Mar'; link forms /app/place/today?rule= and /app/today?rule= without a place.
  - Open decisions: the notice-row title and relative-count rule (check 2); the Foundations update for ReminderLeadControl V3 (add the 14-day option, select 14, tick 'Mon 15 Feb 2027 · 14 days before') and DateRow V3b ('One time' vs 'Does not repeat'; one reminder vs the three-date series) (check 14); one link form with client routing vs two forms (check 7); one locked-reason sentence per role (check 11); the default visibility of a new home date (check 16); the removed-date punctuation (check 10); the x-place-file fixture's claim-time lease vs this storyboard's post-claim entry (check 17); the PROPOSED 'lead day is today' rule — a lead whose day is today stays selected and enabled once its reminder has been sent, and the passed-lead line names only leads before today (check 18, shared with flow-13 check 7); which household-activity events a shared date sends (added, marked done, removed), and when; whether tray 'Done' needs an Undo on next open; whether the Today 'coming up' line should exist (B09); whether the reminder series goes only to the person who set it; the not-sure-of-day lease reminder rule, including whether the notice label reads 'about Feb 2027' or the range, given the Fri 1 Jan reminder (B04); the lead_days 0–60 migration (B05); one Android channel list for date reminders (Dates & bills vs f3's Reminders).
  - Omitted: 'Other' notice length, a draft restored after Close, remove-failed, and the dark twins (none are needed for a storyboard).

BATCH PLAN (at most 6 artboards per turn)
- Turn 1: artboards 1–4, then wait for 'continue'.
- Turn 2: artboards 5, 6, 7 and 8a, then wait for 'continue'.
- Turn 3: artboards 8b, 9, 10 and 11.
