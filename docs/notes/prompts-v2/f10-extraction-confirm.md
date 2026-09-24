# Confirm what we read (extraction review)
id: f10-extraction-confirm · platforms: web/ios/android · isNew: True · artboards: 28

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Confirm what we read · f10-extraction-confirm

TYPE: NEW full screen on all platforms (not a sheet). It is one step in a scan → confirm → next piece loop over Mail Day.

ATTACH: Mail Day populated (iOS, Android, web 1440); the Date sheet (its kind grid, its Remind me control and its bill mode are reused here); the Foundations board.

PLATFORMS & VIEWPORTS: iOS 393x852, plus one landscape frame at 852x393; Android 412x915; web 1440x900 and 390x844.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Mail tab → Mail Day → Confirm what we read.

Entry points:
- From the capture tray's "Done (4)". This screen opens at once only if a piece has already been read at that moment ("Piece 1 of 4"). Otherwise Maya lands on Mail Day, where a status line reads "1 piece ready to check · Check now". This screen never opens on its own after she has acted on Mail Day.
- "Check now" in that status line.
- "Confirm what we read" on any not-confirmed Mail Day row.
- "Fix what we read" on a bill's "From a photo you took" block. The screen opens with the saved values and tick marks, and the commit reads "Save changes to this bill".
- A guest (Alex Kim) reaches this only from the tray's "Done" when one of his pieces was already read. Mail Day offers Alex no "Confirm what we read".

It receives the photo, the piece number, the kind, and the values that were read. Where available, each value comes with the region of the photo it was read from, the printed label beside it, an uncertain flag, and up to 3 labelled alternatives.

It hands off:
- "Add … to bills" creates the bill, puts it on the household calendar and sets reminders. The screen then offers "Next piece", or "Back to Mail Day" on the last piece.
- "Just file it" files the piece with no bill.
- After the last piece, Mail Day, where the rows now read "Added to bills" or "Filed" and wait for a paper decision.
- "Close" returns to Mail Day. Every piece not yet committed stays not confirmed, and any values Maya typed are kept on the row until the piece is committed or skipped.
- No claimed home → the Date sheet in bill mode, pre-filled with the read payee, amount and due date (still marked read-from-your-photo until Save), Bill kind, footer "Only you will see this."

WHO AND WHEN: Maya Chen at HOME A, Mon 19 Oct 2026, 6:12 PM. HOME A has Maya and Sam Ortega, who can see bills, and Alex Kim, a guest until Sun 1 Nov, who cannot see bill photos or amounts. Maya is on the sofa with the paper stack beside her. She has tapped "Confirm what we read" on the Clark Public Utilities row. The read picked the statement date instead of the payment due date.

THE ONE JOB: Turn what we read from the photo into facts Maya has checked, before anything reaches bills, the calendar or a reminder.

FIRST FIVE SECONDS:
1) The photo, pinned, with the due-date region outlined.
2) Amount "$142.18" with its source crop, then the Due date flagged "We weren't sure — check this" with the alternative "Fri 23 Oct (Payment due date)" beside it.
3) The button "Add $142.18 due Thu 8 Oct to bills" in the sticky bottom bar.
Initial focus is on the flagged Due date. The commit is the only filled control; it stays available but does not take focus.

CONTENT (house style fixtures, plus the changes listed here)
Bills before tonight: the bills list holds only Comcast. This session creates the Clark Public Utilities and City of Vancouver water bills that the fixtures list. Frame 12 (duplicate) happens later, when a second photo of the same Clark bill is confirmed after it was added.

Top bar: "Close" · "Piece 1 of 4" · "Skip for now".
Kind line: KindGlyph bill + "Looks like a bill · Electric · Change".
Legend, once: "○ Read from your photo, not confirmed".

Main fields, top to bottom. Each carries the hollow mark.
- Payee: "Clark Public Utilities".
- Amount: a source crop showing the printed "$142.18", the caption "Read beside "Amount due"", and an editable "$142.18" at h3 size.
- Due date: a source crop, the caption "Read beside "Statement date"", an editable "Thu 8 Oct 2026" with the relative line "11 days ago" under it, and the flag "We weren't sure — check this". Alternatives, unselected: "Fri 23 Oct (Payment due date)" · "Tue 13 Oct (Service period end)".

Secondary row: "Account ending ····4471 · Kind: Electric" with "Edit". It is normally collapsed. In this frame it is expanded, because Account ending carries the flag "We weren't sure — check this".

Remind me (ReminderLeadControl, extraction variant, default 7 days):
- For Thu 8 Oct, every lead has passed. All four segments are disabled but focusable, and each reads "already passed".
- Caption: "Thu 8 Oct has already passed, so no reminders would go out. Check the due date."

Audience line, under the photo, in Maya's frames (HOME A has a guest): "Only you and Sam can see this photo. Alex sees that mail arrived, not the photo or amount." · link "Where does this photo go?". With no guest in the household: "Only your household can see this photo: you and Sam." Frames 1–7 and 21 use the guest version, matching the tray.

Commits, equal size: filled "Add $142.18 due Thu 8 Oct to bills" and outlined "Just file it".

After one tap on "Fri 23 Oct (Payment due date)" (frame 2):
- The flag clears, and the field reads "You changed this".
- The caption becomes "Read beside "Payment due date"", and the relative line reads "in 4 days · Fri 23 Oct 2026".
- Remind me: 60, 30 and 7 are disabled and read "already passed". 1 day is selected. Caption: "7 days before has passed, so we'll remind you 1 day before." Timeline: Thu 22 Oct · Fri 23 Oct.
- The commit reads "Add $142.18 due Fri 23 Oct to bills".

Success: "Added to bills and your calendar: $142.18, due Fri 23 Oct. We'll remind you 1 day before and on the day." · text button "Undo" · filled "Next piece". The legend becomes "✓ You added this".

High-confidence frame (Piece 2 of 4, later that evening once the upload finished):
- City of Vancouver · water · "$84.00" · "Wed 28 Oct 2026" (in 9 days), with no flags. The fields are still hollow.
- 7 days is selected. Timeline: Wed 21 Oct · Tue 27 Oct · Wed 28 Oct.
- Success: "… We'll remind you 7 days before (Wed 21 Oct), the day before and on the day."
- A collapsed line under the top bar: "Clark Public Utilities added · Undo".

Just-file frame (Piece 4 of 4):
- Chase · "Looks like a statement · Change" · "Account ending ····8830".
- "Just file it" is the filled primary.
- "Change" opens the KindGlyph grid. Choosing Bill reveals Amount, Due date and Remind me, plus an outlined "Add … to bills".

On the last piece, "Next piece" becomes "Back to Mail Day".

Payee suggestions come only from bills already added: "Comcast · last added Mon 19 Oct" (and, later in the evening, "Clark Public Utilities · last added Mon 19 Oct").

Duplicate (frame 12): "You already have Clark Public Utilities · $142.18 · due Fri 23 Oct on this list." · "Keep both" · "Replace".

Worst case: "Washington State Department of Labor & Industries" as payee; "$12,480.00"; one due date on Mon 2 Nov 2026 and another 2 years out; three date alternatives.

LAYOUT & VISUALIZATION
Always put the photo beside the fields, never below them.

Phone:
- The photo is a pinned pane in the top 42%, with the fields scrolling beneath. It never scrolls away.
- It shrinks to 25%, showing the zoomed region, when the keyboard is up or text is at AX sizes.
- In landscape it moves to the left half.
- The commits sit in a sticky bottom bar on surface.base with a top hairline, stacked full width (filled on top, outlined below), each wrapping to two lines if needed. The field list has scroll padding equal to the bar height, so a focused field is never under it. At AX5 the bar scrolls with the content.

Desktop (web 1440): the screen replaces the app shell (no sidebar, no mailbox nav), with a top bar "Close · Piece 1 of 4 · Skip for now". The photo pane takes 55% of the full 1440 width on the left and the fields 45% on the right. Each scrolls on its own. The commits sit side by side at the foot of the right pane.

The pane has "Zoom in", "Zoom out" and "Fit" buttons, plus "See the piece".

Focusing a field zooms the pane to that field's region and outlines it in two tones: 2px dark ink inside 1px white. If a field has no region, the pane stays at fit width with no outline, and the field shows "We can't point to where we read this."

Certainty is shown per field, only in words and shape:
- Before commit, every read field carries the hollow read-from-your-photo mark, whether the read was confident or not.
- An uncertain field adds the text flag and its alternatives as ChoiceChips (at most 3, shown only when returned; if an alternative has no label, show the date alone).
- Editing a field clears its flag and shows "You changed this".
- After "Add … to bills", every field turns to the you-added tick, and the legend changes to match.
- Amount and Due date get the crop and the label caption whenever a region exists, whatever the certainty. With no region, the crop is replaced by the line "We can't point to where we read this." With no printed label, the caption is omitted.

The commit button restates the values, so the last thing Maya reads is the value that will be saved.

Tapping the legend opens the ProvenanceSheet. Opened from here, it shows the read-from-your-photo and you-added meanings only, with no "This isn't right" report control. Corrections happen in the fields.

"Where does this photo go?" opens Mail snaps: privacy and storage.

When data is missing:
- No read: blank fields with the placeholders "Payee", "Amount" and "Due date". Never show $0.00 or today's date.
- No region: the caption line instead of an outline or crop.

Guest frames:
- Replace the photo pane with a collapsed pane: a document glyph plus "Only Maya and Sam can see bill photos."
- Show no values.

INTERACTION, MOTION & HAPTICS
Tapping a field opens the right control in place, with the value selected:
- Payee: a text field, with payee suggestions.
- Amount: a decimal pad with a "$" prefix.
- Due date: the native date control, which accepts dates 2 years out. iOS uses the compact style with month and year jump; Android uses text-input mode; web uses a typed input.
- Account ending: a 4-digit number pad.
- Kind: the KindGlyph tile grid plus bill-type ChoiceChips.

There is no "What's wrong?" step. Tapping an alternative sets it in one tap and recalculates Remind me.

"Just file it" needs no fields.

If Amount or Due date is blank when Maya taps "Add … to bills", "Needed to add a bill" appears under those fields, and only then.

Undo after a commit: the success line keeps "Undo" while the piece is on screen. Moving to the next piece counts as staying on this screen: the previous result stays as a collapsed line directly under the top bar, "Clark Public Utilities added · Undo", until Maya returns to Mail Day. After that, "Fix what we read" on the bill is the path back.

"Skip for now" moves to the next piece and leaves this row not confirmed.

In the low-confidence state, initial focus goes to the first flagged field, not to the commit.

In the no-claimed-home notice, "Add a due date" replaces the notice with the Date sheet in bill mode. Never stack the two sheets.

Motion: the pane zoom animates over 250ms; under Reduce Motion it cuts with a fade.
Haptics: one light tick on a successful commit.

FOUNDATIONS COMPONENTS USED: ProvenanceMark (read-from-your-photo, you-added, legend line) · ProvenanceSheet (opened from the legend, no report control) · KindGlyph (row and tile) · ReminderLeadControl (extraction confirm variant, lead-already-passed state) · ChoiceChip (alternatives, bill type) · ScopeChip (named-audience sentence in the audience line; chip "Saved place · Only you" on the no-claimed-home frame) · InlineUndo (success line and the collapsed previous-piece line) · InlineErrorRow (save failed, values kept) · OfflineNotice (queued writes) · LockedActionRow (names who can act) · WarmingSkeleton (field rows while reading) · DateSheet (bill mode, pre-filled, Bill kind).

ACCESSIBILITY
Reading order: piece count, kind, photo summary, legend, fields top to bottom (Payee, Amount, Due date, secondary row), Remind me, audience, commits.

Each field is one element. Because initial focus lands on the Due date, its label starts with context. In frame 1 it reads: "Piece 1 of 4, Clark Public Utilities bill. Due date, Thursday 8 October 2026, 11 days ago, read beside Statement date, read from your photo, not confirmed. We weren't sure, check this. 2 other dates found."

The photo has a label: "Photo of a Clark Public Utilities bill, page 1 of 2." In the guest frames, the collapsed pane reads its sentence.

Remind me speaks a summary:
- After the correction: "Reminders on Thursday 22 October and Friday 23 October."
- Each passed segment: "60 days before, already passed."

The pane controls are buttons, so zoom never depends on a pinch.

Targets are 44pt / 48dp / 44px. The focused field is never hidden behind the keyboard, the pane or the sticky bar.

The outline and the marks keep at least 3:1 contrast on any photo. Flags are words, not colour.

Status messages ("Adding…", "Added", "Couldn't add") are live regions.

The disabled "Add to bills" stays focusable and reads its reason.

At AX5 and 200%, the pane is 25%, fields stack label over value, and the commit bar scrolls with the content.

COPY
Top bar: "Close" · "Piece 1 of 4" · "Skip for now".
Kind: "Looks like a bill · Electric · Change" · "Looks like a statement · Change".
Legend: "○ Read from your photo, not confirmed" → "✓ You added this".
Flags and field notes: "We weren't sure — check this" · "You changed this" · "We can't point to where we read this." · "Needed to add a bill".
Pane: "Zoom in" · "Zoom out" · "Fit" · "See the piece".
Audience: "Only you and Sam can see this photo. Alex sees that mail arrived, not the photo or amount." · "Only your household can see this photo: you and Sam." · "Where does this photo go?".
After commit: "Next piece" · "Back to Mail Day" · "Undo" · "Clark Public Utilities added · Undo".
Reading: "Reading your mail…".
Unreadable: "We couldn't read this photo. It may be blurry or cut off." · "Retake" · "Enter it yourself".
Reading unavailable: "We couldn't read this one automatically. Add the amount and due date yourself."
Saving: "Adding…".
Error: "We couldn't add this bill. Your changes are kept. Try again." · "Try again".
Offline: "You're offline. Your changes are kept, and this piece stays not confirmed until you're back online." The commit becomes "Add when back online".
Guest: "Only Maya and Sam can see bill photos." and, under the disabled "Add to bills", "Only Maya and Sam can add bills here."
No claimed home: "Mail snap needs a claimed address" / "Bills live with a claimed home. You can still add a due date for yourself." · "Add a due date" · "Claim this address". Date sheet footer: "Only you will see this."
Never use the word "Paid" anywhere on this screen, and never "AI" or "OCR".

EDGE CASES
- Long payee: it wraps to two lines, and the commit button also wraps to two lines rather than cutting off the values.
- "$12,480.00" fits at h3.
- A date 2 years out can be typed.
- Three alternatives at most.
- A 12-page piece shows "Page 1 of 12" on the pane, with page buttons.
- Slow reading: skeleton rows stay, and "Just file it" stays live.
- Duplicate: the banner sits above the commit bar, and neither choice is preselected.
- A statement that is really a bill: "Change" to Bill brings back the fields and "Add … to bills".
- Guest (Alex Kim, arriving from his tray's Done):
  - the collapsed photo pane, with no values read or shown;
  - "Just file it" as the filled primary;
  - "Add to bills" disabled, with the LockedActionRow.
- No claimed home (Jordan Lee at PLACE B): reached only if the home was left or unclaimed after the photo was taken, for example through "Confirm what we read" on an old row. It routes to the Date sheet in bill mode, pre-filled with the read values, so Jordan never retypes them.
- Close, offline, error and save failure all keep every typed value.

INSTEAD OF
- Instead of editable chips ("Due Oct 12 · $142 · Clark PUD · Confirm"), draw one field per value with its own control, because money, dates and names need different keyboards, and chips hide which value was uncertain.
- Instead of filled marks on the confident fields, draw every read field hollow until commit, then all ticked, because a confident read can still be wrong, and filled means official or confirmed.
- Instead of a percentage, a meter or an "87% sure" badge, draw the words "We weren't sure — check this" and the alternatives, because people can act on words and choices.
- Instead of removing "Add to bills" for a statement, let Maya change the kind, because the kind is also a guess.
- Instead of a guest seeing the bill photo, draw a collapsed pane with a document glyph, because the printed page shows the payee and the amount.
- Instead of a photo you tap to expand, draw a pinned pane that shrinks with the keyboard or large text, with the commits in a sticky bottom bar, because Maya is proofreading against the source and must still reach the commit.
- Instead of a one-colour focus-blue outline, draw a two-tone outline, because it must show on any photo.
- Instead of "$0.00" or today's date when reading fails, or an empty Date sheet on the no-home path, draw placeholders or the pre-filled values we hold, because a plausible default gets approved and retyping wastes effort.

DONE WHEN:
- A misread due date (Thu 8 Oct) is corrected to Fri 23 Oct in one tap on an alternative, and the commit and reminders update.
- Nothing is marked as confirmed before "Add … to bills".
- The commit is visible without scrolling on a phone, and the commit and success lines state the amount, the due date and the real reminder dates.
- A committed piece can be undone until Maya returns to Mail Day.
- The manual path works when reading is unavailable, and the no-home path keeps the read values.
- A guest can file but not add, and sees no photo, payee or amount; Maya's view names what the guest sees.
- A misclassified statement can still become a bill.
- The word "Paid" never appears.

ARTBOARDS
1. f10-extraction-confirm · ios · 01-low-confidence · light — the dense Clark Public Utilities case, Piece 1 of 4: the misread Thu 8 Oct is flagged, the alternatives are unselected, focus is on the date, and the sticky commit bar is visible.
2. f10-extraction-confirm · ios · 01b-date-corrected · light — after one tap on Fri 23 Oct: the flag is cleared, "You changed this" shows, the commit reads "Add $142.18 due Fri 23 Oct to bills", and Remind me is recalculated to 1 day with 60/30/7 marked "already passed".
3. f10-extraction-confirm · ios · 02-amount-editing · light — keyboard up, pane at 25%, two-tone outline on the amount, focused field above the commit bar.
4. f10-extraction-confirm · ios · 03-high-confidence · light — Piece 2 of 4, City of Vancouver, hollow marks, 7-day reminders, and the collapsed "Clark Public Utilities added · Undo" line.
5. f10-extraction-confirm · web-1440 · 01-low-confidence · light — no app shell; the 55/45 panes across the full width; commits at the foot of the right pane.
6. f10-extraction-confirm · android · 01-low-confidence · light — Material 3 controls.
7. f10-extraction-confirm · ios · 04-added · light — the success line, ticks, the "✓ You added this" legend, text-button Undo and filled Next piece.
8. f10-extraction-confirm · ios · 05-just-filed · light — Piece 4 of 4: the Chase statement filed, with "Looks like a statement · Change" and "Back to Mail Day".
9. f10-extraction-confirm · ios · 06-reading · light — skeleton fields and "Reading your mail…".
10. f10-extraction-confirm · ios · 07-reading-unavailable · light — blank fields after pressing Add, with "Needed to add a bill".
11. f10-extraction-confirm · ios · 08-unreadable-photo · light — Retake or Enter it yourself.
12. f10-extraction-confirm · ios · 09-duplicate · light — later that evening, a second photo of the Clark bill: the duplicate banner with Keep both and Replace.
13. f10-extraction-confirm · ios · 10-guest · light — Alex Kim: collapsed photo pane, file only.
14. f10-extraction-confirm · web-1440 · 10-guest · light — the desktop guest, with the collapsed pane in the left column.
15. f10-extraction-confirm · android · 10-guest · light — the Android guest.
16. f10-extraction-confirm · ios · 11-no-claimed-home · light — Jordan Lee: the notice, and beside it the Date sheet in bill mode pre-filled with the read payee, amount and due date (hollow marks), chip "Saved place · Only you", footer "Only you will see this."
17. f10-extraction-confirm · ios · 12-saving · light — "Adding…".
18. f10-extraction-confirm · ios · 13-save-error · light — values kept, Try again.
19. f10-extraction-confirm · ios · 14-offline · light — "Add when back online".
20. f10-extraction-confirm · ios · 15-landscape · light — photo on the left, fields and commits on the right.
21. f10-extraction-confirm · web-390 · 01-low-confidence · light — mobile web with the sticky commit bar.
22. f10-extraction-confirm · ios · 16-fix-what-we-read · light — opened from a saved bill, with ticks and "Save changes to this bill".
23. f10-extraction-confirm · ios · 17-ax5 · light — pane at 25%, stacked fields, commit bar scrolling with content.
24. f10-extraction-confirm · android · 18-font-200 · light — 200% text.
25. f10-extraction-confirm · ios · 19-greyscale · light — frame 1 in greyscale.
26. f10-extraction-confirm · ios · 01-low-confidence · dark — the dark twin of frame 1.
27. f10-extraction-confirm · ios · 09-duplicate · dark — the dark twin of frame 12.
28. f10-extraction-confirm · web-1440 · 99-notes · light — Notes, with these items:
- Invented strings: the label captions, the Thu 8 Oct statement date, the Tue 13 Oct service-period date, account endings 4471 and 8830, the bill types, Alex Kim as a guest until Sun 1 Nov, the two audience lines, "Skip for now", the payee-suggestion lines, "Change", "Back to Mail Day", "Clark Public Utilities added · Undo".
- The storyboard: bills before tonight hold only Comcast. Maya opened this screen from row 1 on Mail Day at 6:12 PM, because nothing had been read when she tapped Done. Frames 4 and 8 happen later that evening; frame 12 happens after the Clark bill was added.
- The success line deliberately rewords the doc's "Added to your calendar. We'll remind you {lead} before."
- Open backend dependency: bill reminders today come only from the home reminders job (the day before and the day of). The 7-day and longer leads (for example Wed 21 Oct) need a bill lead reminder added there. Draw a small inset of the fallback control: the 60/30/7 segments hidden, caption "We'll remind you the day before and on the day.", for use if that is not built.
- Open backend dependency: the extraction result needs, per field, the printed source label, an optional region, an uncertain flag and up to 3 labelled alternatives. Alternatives are shown only when returned; with no label, the caption is omitted.
- Proposed Foundations addition: the named-audience sentence form (shared with the tray and Mail Day).
- Open decision: may a guest see a photo they took in this session? This matches the tray prompt.
- Open decision: the exact label of the read-from-your-photo mark variant (shared with Mail Day).
- Omitted states.

BATCH PLAN: Turn 1: 1-6, then wait for "continue". Turn 2: 7-12, then wait. Turn 3: 13-18, then wait. Turn 4: 19-24, then wait. Turn 5: 25-28.
