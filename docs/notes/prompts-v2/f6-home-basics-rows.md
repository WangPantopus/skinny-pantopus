# Home basics: move-in date + restore the moving checklist
id: f6-home-basics-rows · platforms: web/ios/android · isNew: False · artboards: 21

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Home settings, Home Info section · f6-home-basics-rows

TYPE: EXTENSION of the existing designed screen "Home settings" (per-home settings). This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. Add two rows to the Home Info group, under the existing Address and Home name rows. If the iOS screenshot has no Home Info group with Address and Home name rows, add those two rows as the group's first rows and record this on Notes. Add no new section header, card, illustration or setup banner. Keep the screenshot's existing "Your household" ScopeChip exactly where it is.

ATTACH: (1) the current Home settings screen for HOME A on iOS, Android, web 1440 and web 390; (2) the Foundations board from prompt 00 (FactRow, DateSheet, InlineUndo, InlineErrorRow, LockedActionRow, ProvenanceMark, ScopeChip, OfflineNotice, FreshnessLine); (3) the place file's Moved in row and its hidden-checklist line, for the arrival frame.

PLATFORMS & VIEWPORTS: iOS 393x852 (native grouped list). Android 412x915 (Material 3 list). Web 1440x900 (left sidebar, settings in the content column) and 390x844 (bottom tab bar).

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place → HOME A → Home tools → Settings → Home Info. Web: the home's settings URL, for example /app/homes/home-a/settings (HOME A's id). People arrive three ways. (1) Home tools → Settings. (2) The place file's "Moved in" row when it reads "Not set". (3) The place file's hidden-checklist line "Show again in home settings". What arrives: the home id and which row to focus. Nothing is typed in advance.
Arrival case A, from "Not set": the screen lands, scrolls to the Moved in row, then opens the DateSheet with focus inside it. On Save or Close, focus returns to the Moved in row and its highlight fades then.
Arrival case B, from "Show again in home settings": the screen lands, scrolls, highlights and focuses the Moving checklist row. No sheet opens.
How homes arrive: a home claimed from a saved place arrives "Not set". A home added with the "just moved" checkbox arrives stamped with the add date (this is how Maya got Sun 18 Oct). On iOS and Android this row is the only way to correct the date. Web also has the Edit home page, which should link to this row or be replaced by it (note it on Notes).

WHO AND WHEN: Maya Chen, owner of HOME A, on Mon 19 Oct 2026 at 6:10 PM. She moved in on Tue 29 Sep 2026 but claimed the address on Sun 18 Oct, 19 days later, so the app stamped Sun 18 Oct 2026 as her move-in date. She has also hidden the moving checklist. She wants the real date and the checklist back. Sam Ortega (member) opens the same screen on his Pixel; he has hidden his own checklist too.

THE ONE JOB: Correct the move-in date that turns the 60-day moving checklist on, and bring back a hidden checklist.

FIRST FIVE SECONDS: (1) The Moved in value. (2) The helper line under it, which says what the date controls. (3) The Moving checklist row with "Show again". Primary action: tap the Moved in row to change the date.

CONTENT (fixture deltas; everything else is HOME A as pasted):
- Stamped (wrong) value: Sun 18 Oct 2026; window until Thu 17 Dec 2026 (in 59 days).
- Corrected value: Tue 29 Sep 2026, set by Maya; window until Sat 28 Nov 2026 (in 40 days).
- Future-date example: Sun 1 Nov 2026 (in 13 days; window runs until Thu 31 Dec 2026).
- Older than 60 days: Fri 14 Aug 2026 (window ended Tue 13 Oct 2026).
- Likely typo: Wed 29 Sep 2027 (about 11 months ahead).
- Home name row: keep the screenshot's value. If there is none, use "Larkspur Loop".
- Worst case: a 320pt column at AX5, Maya's view with both rows, helper, status line and an error row.
List every invented string on the Notes artboard.

LAYOUT & VISUALIZATION: Draw two FactRows (56pt minimum) in the existing list pattern: label above value, then a trailing chevron or text action. There is no chart. The helper line is the key decision: without it, "Moved in" reads as trivia, not as the switch for the moving checklist. Draw the helper in bodySmall text.secondary directly under the value, in every state, wrapping rather than truncating at 320pt.
Row 1, "Moved in": value in body text.primary with a trailing ProvenanceMark S (you-added). Print the legend word "You added this" once. Under the helper, draw one status line in caption text.secondary with an info glyph. Its text follows the checklist state for this viewer, and it must never claim something false. Use exactly one of these five:
(1) Showing: "Showing in your place file · in 40 days · until Sat 28 Nov".
(2) Hidden: "Hidden from your place file · in 40 days · window ends Sat 28 Nov".
(3) Not started yet: "Your moving checklist starts in 13 days · Sun 1 Nov · runs until Thu 31 Dec"; when hidden, append " · hidden from your place file". Never use the word "Showing" here.
(4) Ended (older than 60 days): "Your moving checklist ran until Tue 13 Oct, so it won't show now"; when hidden, append " · hidden".
(5) Not set: no status line; the helper alone.
States 3 and 4 are the future-date and older-than-60-days notes; they persist as the status line, not as separate notes. Right after a save, prefix the line with "Saved. " once, announced as a polite live region.
Give the known row a chevron and a whole-row target so it looks editable. With no date, the value reads "Not set" in text.secondary (text.strong on a sunken row) with a text action "Add"; the helper still shows.
Row 2, "Moving checklist": value "Hidden" and a trailing text action "Show again" in primary.700. Draw this row only while the checklist is hidden for this viewer. Hiding is saved on the server per person, so the row appears on every device. If the checklist was never hidden, draw no row (not a greyed one).

INTERACTION, MOTION & HAPTICS: Tapping Moved in opens the DateSheet with the Move-in date kind chosen; skip the kind grid. Title "Move-in date". The field accepts typing and offers a calendar: iOS compact picker with month/year jump and the keypad; Android docked picker with the keyboard-input toggle visible; web a native typeable date input. In this sheet, hide the "Not sure of the day" toggle (the window needs an exact day) and hide the ReminderLeadControl (a move-in date needs no reminder). In the sheet footer, draw the ScopeChip sentence "Everyone in this household will see this." Then Save and a visible Close. Validation suggests a fix and never blocks: dates inside the last 60 days save with no note; older dates and dates up to 6 months ahead save and show status line 4 or 3; a date more than 6 months ahead shows the suggested fix in the sheet. On Save the sheet closes, the value updates in place, and iOS and Android give one light haptic tick. Tapping "Show again" restores the checklist at once; the row collapses into InlineUndo, which stays until Maya leaves the screen, with no timer. Arrivals scroll once and fade a highlight in 300ms or less (case A after the sheet closes, case B on landing). With Reduce Motion on, jump to the row and cross-fade the highlight. No action depends on a gesture.

FOUNDATIONS COMPONENTS USED: FactRow (known, missing, permission-disabled) · DateSheet (view-mine, Move-in date kind, "Not sure of the day" and ReminderLeadControl hidden, footer ScopeChip sentence, per-kind validation with a suggested fix, saving, offline) · ProvenanceMark (you-added, S) · ScopeChip (footer sentence form, inside the sheet) · InlineUndo (restored row) · InlineErrorRow (save failed, value preserved) · LockedActionRow (names who can act, no link) · OfflineNotice with FreshnessLine offline variant (read-only cached screen).

ACCESSIBILITY: Reading order: label → value → mark → helper → status. Maya's row 1: "Moved in, Tuesday 29 September 2026, you added this. Shows your moving checklist for 60 days. Button, change date." Sam's row 1: "Moved in, Tuesday 29 September 2026, added by Maya Chen. Shows the moving checklist for 60 days. Only Maya Chen can change this." Targets: Moved in (known, with a chevron) is one whole-row target. On "Not set", "Add" is its own 44pt / 48dp / 44px button and the row is not a target. On Moving checklist, "Show again" is its own button, spoken "Show moving checklist again", and the row is not a target. Rows keep the FactRow's 56pt minimum, with 8dp gaps. The mark is never a target alone. "Saving…", "Saved", "Retrying…" and "Moving checklist is back" are polite live regions. Errors sit next to the field. Selection looks different from focus. At AX5 the value stacks under the label and every line wraps.

COPY:
- Row labels: "Moved in" · "Moving checklist"
- Helper (Maya): "Shows your moving checklist for 60 days." Helper (member view): "Shows the moving checklist for 60 days."
- Status 1: "Showing in your place file · in 40 days · until Sat 28 Nov"
- Status 2: "Hidden from your place file · in 40 days · window ends Sat 28 Nov" (stamped state: "Hidden from your place file · in 59 days · window ends Thu 17 Dec")
- Status 3: "Your moving checklist starts in 13 days · Sun 1 Nov · runs until Thu 31 Dec" (+ " · hidden from your place file")
- Status 4: "Your moving checklist ran until Tue 13 Oct, so it won't show now" (+ " · hidden")
- Save prefix: "Saved. "
- Progress and live words: "Saving…" · "Saved" · "Retrying…"
- Legend: "You added this" (Sam's view: "Added by Maya Chen")
- Empty value: "Not set". Action: "Add"
- Restore row: value "Hidden", action "Show again". Undo line: "Moving checklist is back in your place file · Undo"
- Restore after the window ended: "Moving checklist is back · it ran until Tue 13 Oct, so it won't show now · Undo"
- Suggested fix: "That's almost a year away. Did you mean Tue 29 Sep 2026?" with equal-weight buttons "Use Tue 29 Sep 2026" and "Keep Wed 29 Sep 2027"
- Save error: "We couldn't save Tue 29 Sep 2026. Sun 18 Oct 2026 is still set." Button "Retry"
- Offline: top line "You're offline · as of 6:10 PM"; under the disabled date row "You can change the move-in date when you're back."; under the disabled Show again "You're offline. You can show the checklist again when you're back."
- Member view: "Only Maya Chen can change this."
- Sheet: title "Move-in date", footer "Everyone in this household will see this.", buttons "Save" and "Close"

EDGE CASES: A long address in the existing Address row wraps to 2 lines. A date more than 6 months ahead gets the suggested fix (Wed 29 Sep 2027 is 11 months ahead). A date up to 6 months ahead saves and shows status 3. A date years in the past saves and shows status 4. An empty value always shows the words "Not set", never a blank. When the window has ended, the restore row still shows if hidden, and restoring shows the ended-window undo line. Slow save (1s or longer): a 12pt progress glyph plus the word "Saving…" in the value slot, row not tappable; with Reduce Motion on, the word only; under 1s, nothing. Save failure: the sheet has already closed; InlineErrorRow on an errorBg slot under the row, the old value (Sun 18 Oct 2026) visible. Retry resends Tue 29 Sep 2026. Tapping the row reopens the DateSheet with Tue 29 Sep 2026 still in the field. Offline: cached value readable, FreshnessLine offline line at the top, both actions disabled with their stated reasons. Permissions: owners and admins can edit; everyone else sees Moved in as plain text with no chevron, plus a LockedActionRow that names every person who can edit (on HOME A, only Maya Chen). Hiding is per person, so Sam gets his own "Show again". Web has two settings surfaces; draw the rows once, in the attached page.

INSTEAD OF:
- Instead of a "Finish setting up your home" card with a progress bar, draw two plain rows in the existing list — because this is a setting to correct, not an onboarding step.
- Instead of "Not set" in faint grey, draw it in text.secondary with Add — because it switches the whole moving checklist on and must be readable (text.muted is 2.54:1).
- Instead of red or warning styling on status lines 3 and 4, draw an info glyph with text.secondary — because the date is valid; the line only explains when the checklist shows.
- Instead of blocking unusual dates, draw a suggested fix with two equal buttons — because a real move-in date is usually in the past.
- Instead of a greyed-out date control for Sam, draw plain text plus "Only Maya Chen can change this." — because a dead-looking control reads as a broken app.
- Instead of a timed "Show again" toast, draw InlineUndo that stays until the person leaves — because undo must not expire.
- Instead of dropping the helper line to save space, let it wrap — because without it the row reads as trivia.
- Instead of a hidden/showing line in every frame, draw the one of the five status lines that is true — because the line must never claim something false.

DONE WHEN: A mover who claimed late turns Sun 18 Oct 2026 into Tue 29 Sep 2026 on iOS, Android and web in two taps plus typing. The helper says what the date does in every state. The status line is true in every frame: showing, hidden, not started, ended, or absent when not set. A hidden checklist can be brought back from any device. Nothing looks like an error unless a save failed. Every frame reads correctly in greyscale and at AX5.

ARTBOARDS:
1. f6-home-basics-rows · ios · 01-set-dense · light — Maya after correcting: Moved in Tue 29 Sep 2026, mark and "You added this", helper, status 2 "Hidden from your place file · in 40 days · window ends Sat 28 Nov", Moving checklist Hidden with Show again, the screenshot's Your household chip.
2. f6-home-basics-rows · ios · 02-stamped-before · light — the state Maya corrects: Moved in Sun 18 Oct 2026, helper, "Hidden from your place file · in 59 days · window ends Thu 17 Dec", restore row.
3. f6-home-basics-rows · ios · 03-date-sheet-open · light — DateSheet, Move-in date kind, compact picker plus typed field, no "Not sure of the day", no reminder control, footer scope sentence, Save and Close.
4. f6-home-basics-rows · android · 01-set-dense · light — frame 1 in the M3 list; inset of the docked picker with its keyboard toggle.
5. f6-home-basics-rows · web-1440 · 01-set-dense · light — sidebar layout; inset of the typeable date input.
6. f6-home-basics-rows · web-390 · 01-set-dense · light — mobile web with the bottom tab bar.
7. f6-home-basics-rows · ios · 04-not-set · light — "Not set" with its own Add button and the helper; status 5 (no status line); restore row absent (never hidden).
8. f6-home-basics-rows · ios · 05-future-date · light — Sun 1 Nov 2026 saved; status 3 "Saved. Your moving checklist starts in 13 days · Sun 1 Nov · runs until Thu 31 Dec"; no "Showing" wording; restore row absent.
9. f6-home-basics-rows · ios · 06-past-60-days · light — Fri 14 Aug 2026; status 4 "Your moving checklist ran until Tue 13 Oct, so it won't show now · hidden"; restore row present; inset of the ended-window undo line.
10. f6-home-basics-rows · ios · 07-suggested-fix · light — sheet showing Wed 29 Sep 2027 and the two equal buttons.
11. f6-home-basics-rows · ios · 08-saving · light — progress glyph plus "Saving…" in the value slot; row not tappable.
12. f6-home-basics-rows · ios · 09-save-error · light — InlineErrorRow with Retry; Sun 18 Oct 2026 still visible; inset of the reopened sheet holding Tue 29 Sep 2026.
13. f6-home-basics-rows · android · 10-offline · light — "You're offline · as of 6:10 PM" at the top; date row disabled with "You can change the move-in date when you're back." under it; Show again disabled with its offline reason.
14. f6-home-basics-rows · android · 11-member-read-only · light — Sam: plain date, "Added by Maya Chen", member helper, LockedActionRow "Only Maya Chen can change this.", his own Show again button.
15. f6-home-basics-rows · ios · 12-restored-undo · light — InlineUndo line; status now "Showing in your place file · in 40 days · until Sat 28 Nov".
16. f6-home-basics-rows · ios · 13-deep-link-arrival · light — arrival case B: Moving checklist row highlighted with focus, no sheet; inset of case A: sheet open over the Moved in row with focus inside the sheet.
17. f6-home-basics-rows · ios · 14-ax5 · light — 320pt content at AX5; everything stacked and wrapped, with an error row.
18. f6-home-basics-rows · ios · 15-greyscale · light — frame 1 in greyscale.
19. f6-home-basics-rows · ios · 01-set-dense · dark — dark twin of 1.
20. f6-home-basics-rows · ios · 09-save-error · dark — dark twin of 12.
21. f6-home-basics-rows · Notes — assumptions, every invented string, omitted states, contract deviations, open questions.

Notes must record: every invented string, including all five status lines, "Saved. ", "Saving…", "Retrying…", the member helper, both offline reasons and the suggested-fix copy. Contract deviations: the Move-in date kind hides "Not sure of the day" and ReminderLeadControl; propose adding this as a DateSheet per-kind rule. Omitted state: cold load (the host settings screen is already warm; the FactRow loading skeleton applies). Open questions: whether the checklist should follow each person's own move-in date (Sam may have moved in later); that the claim flow should ask for or carry the move-in date (proposed: if the claim receipt adds a "Set your move-in date" link, it lands here; not in the flow today); whether web's Edit home page links to this row or is replaced by it; whether the iOS Home Info group had to be added. Decisions: the old undo-toast entry is replaced by InlineUndo in the place file plus its "Show again in home settings" line, so undo no longer navigates here; the inline "Just moved in? Tell us when" ask is now the place file's Moved in "Not set" row, which lands here, so there is one write path; a future move-in date opens the 60-day window on that day; the 6-month suggested-fix threshold; the helper says "moving checklist", not "first-week steps", to avoid Today's 7-day first-week row; the you-added mark shown to Sam means "a person added this" (a contract gap); web has two settings surfaces.

BATCH PLAN: Turn 1: artboards 1-6, then wait for continue. Turn 2: 7-12, then wait for continue. Turn 3: 13-18, then wait for continue. Turn 4: 19-21.
