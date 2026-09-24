# Household calendar
id: f3-household-calendar · platforms: web/ios/android · isNew: False · artboards: 21

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Household calendar · f3-household-calendar

TYPE: EXTENSION of the existing designed screen "Household calendar" (the home agenda). This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. The screen already works, but nothing in the app links to it yet.

ATTACH: (1) Household calendar on iOS, Android and web-1440, including its create-event sheet, its read-only mode, its member filter chips and its "Who's free" link. (2) The home header tabs (web) and the Larkspur Loop screen's list on iOS and Android. (3) The Home dashboard Calendar card. (4) Your place file, Dates section. (5) The Date sheet (view-mine and view-seeded). (6) The Foundations rows for DateRow, ProvenanceMark, PushCopy and LockedActionRow.

PLATFORMS & VIEWPORTS: iOS 393x852 · Android 412x915 · web 390x844 and 1440x900.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → Larkspur Loop → Calendar. As part of this work, draw three new links:
- On web, a "Calendar" tab in the home header, directly after Dashboard. On iOS and Android, a "Calendar" row in the Larkspur Loop screen's list, directly below Dashboard.
- "Open calendar" on the dashboard Calendar card.
- The place file Dates link "See the household calendar ›".
Other ways in:
- The household push, title "Sam added Chimney sweep" (23 characters), body "Sat 14 Nov · Larkspur Loop"; and its in-app row "Sam added 'Chimney sweep' for Sat 14 Nov". Both open this screen scrolled to that event and highlighted.
- The deep link /app/homes/:id/calendar on web, and the same path on native.
- "Add as a separate calendar event" from the Date sheet's duplicate warning. The Date sheet closes first, this screen opens, and then the create-event sheet opens with the title filled in.
- A T3 reminder push may land here for a co-resident who cannot edit (not drawn; see Notes).
Flow 04, step 11: Sam arrives from the member dashboard and adds an event. The toast "Saved to your household calendar." is only true because this screen shows the event. Later, Maya gets one quiet row: "Sam added 'Chimney sweep' for Sat 14 Nov". This is now the only household calendar: the dashboard's separate 7-day household calendar is deleted, and the dashboard card previews this agenda.

WHO AND WHEN: Maya Chen, owner of HOME A, on Mon 19 Oct 2026 at 6:10 PM, checking the next few weeks before her parents visit. Frames 02–04 and 09 show Sam Ortega, a member who can edit; in frames 02–04 he adds the chimney sweep. Frame 05 shows Sam drawn as a legacy read-only member. Frame 06 shows Lena Park, a guest of Larkspur Loop who can see the calendar but not bills or tasks. HOME A's pickup day is on record, not confirmed, as in the TODAY fixture.

THE ONE JOB: Let everyone in the household read and add to one shared calendar, where a far-off lease date never looks like an overdue chore.

FIRST FIVE SECONDS: First, the "Today · Mon 19 Oct" marker and, right under it, the "Recycling and garbage — Tomorrow" row. Second, the month header with its count. The legend is a single caption line under the screen header, quieter than the Today marker. The primary action is "Add an event".

CONTENT: The header reads "Larkspur Loop" with ScopeChip "Your household". Under it, one legend caption line. Owner view: "● Official · ○ On record, not confirmed · ✓ You added this". Member and guest views: "● Official · ○ On record, not confirmed · ✓ Added by your household". Under the legend, a "Jump to month" button (44pt) opens a month list. Month counts count the rows the viewer sees. The pickup summary rows and the pickup rows after the first 14 days are not counted.

Row text rule for this screen: line 2 is the relative plus absolute date, then the source. Rows someone in the household entered carry a last line: in Maya's view "You added this · <recurrence>"; in Sam's and Lena's view "Added by Maya · <recurrence>" (or "Added by Sam" for Sam's rows). The recurrence is exactly "Every year", "Every month" or "Does not repeat".

Marks: pickup rows and the package row carry the hollow mark. Official deadlines carry the filled mark. Bills, home events, tasks and self-added dates carry the tick (a household member added them).

Today marker: a "Today · Mon 19 Oct" day header with a 1.5px text.primary rule and the QuietDayReceipt line "Checked — nothing today".

October 2026 · 8 items (month header with "Previous month" and "Next month" text buttons, 44pt, at its right)
- Tue 20 Oct: "Recycling and garbage" · "Tomorrow · Waste Connections · city schedule" · hollow.
- Thu 22 Oct: "Maya's parents visiting" (home event, runs to Sun 25 Oct) · "in 3 days · Thu 22 Oct – Sun 25 Oct" · tick. Also "Package expected · replacement recycling cart" · "in 3 days · Thu 22 Oct" · hollow.
- Fri 23 Oct: "Clark Public Utilities · $142.18" · "in 4 days · Fri 23 Oct" · StatusChip "Upcoming" · tick.
- Sat 24 Oct: task "Change furnace filter · Sam" · "in 5 days · Sat 24 Oct" · tick.
- Mon 26 Oct: "Online or mail voter registration must arrive by Mon 26 Oct" · "in 7 days · Mon 26 Oct · Washington Secretary of State · statewide · 2026" · filled · the "Statewide — WA" coverage chip in ScopeChip geometry. In Maya's view only, the row is in the DateRow done state: line 2 starts with "You marked this done ·", and a caption below reads "Only you will see this." in text.secondary. Keep the "Statewide — WA" chip; draw no "Only you" chip. Sam never sees Maya's done state.
- Tue 27 Oct: "Garbage only" · "in 8 days · Tue 27 Oct · Waste Connections · city schedule" · hollow.
- Wed 28 Oct: "City of Vancouver water · $84.00" · "in 9 days · Wed 28 Oct" · StatusChip "Upcoming" · tick.

November 2026 · 5 items (6 items in frames 04 and 15, once the chimney sweep exists; 9 items in frame 17)
- One pickup summary row: "Pickup every Tuesday · recycling Tue 3 and Tue 17 Nov" · hollow.
- Sun 1 Nov:
  - "HOA dues · $285.00" · "in 13 days · Sun 1 Nov" · last line "You added this · Every month" · tick · identity.home rule.
  - "Smoke alarm batteries" · "in 13 days · Sun 1 Nov" · last line "You added this · Every year" · tick · identity.home rule.
- Mon 2 Nov:
  - "Property tax, 2nd half" · "in 14 days · Mon 2 Nov · Clark County Treasurer · county-wide" · last line "Every year" · filled · identity.home rule. The Date sheet detail says "moved from Sat 31 Oct".
  - "Comcast · $79.99" · "in 14 days · Mon 2 Nov" · StatusChip "Upcoming" · tick.
- Tue 3 Nov: "Voter registration in person — until 8:00 PM Tue 3 Nov" · "in 15 days · Tue 3 Nov · Clark County Elections · county-wide · 2026" · filled · no rule.
- Frames 04 and 15 only: Sat 14 Nov "Chimney sweep · 9:00 AM" · "in 26 days · Sat 14 Nov" · last line "Added by Sam · Does not repeat" (in Sam's own view: "You added this · Does not repeat") · tick.

December 2026 · 2 items
- The pickup summary row: "Pickup every Tuesday · recycling Tue 1, Tue 15 and Tue 29 Dec" · hollow.
- Tue 1 Dec: "HOA dues · $285.00" · "in 43 days · Tue 1 Dec" · "You added this · Every month" · tick · identity.home rule.
- Sat 12 Dec: "Water-heater warranty ends" · "in 54 days · Sat 12 Dec" · "You added this · Does not repeat" · tick · identity.home rule.
- The closing QuietDayReceipt line "Checked — nothing else in December".

January 2027 (frames 08 and 09): Maya's header "January 2027 · 2 items"; Sam's header "January 2027 · 1 item".
- Pickup summary row "Pickup every Tuesday · recycling Tue 12 and Tue 26 Jan". It keeps the weekday's hollow mark and adds the caption "Projected · after the last published schedule (Dec 2026)" with the Foundations dashed projected keyline. Hollow still means only "on record, not confirmed".
- Fri 1 Jan: "HOA dues · $285.00" · "in 74 days · Fri 1 Jan 2027" · "You added this · Every month" (Sam: "Added by Maya · Every month") · tick · identity.home rule.
- A labelled specimen of the holiday-move state: "Garbage only — projected to move to Wed 20 Jan", with the caption "MLK Day week — projected to move to Wed 20 Jan · 2027 schedule not published yet", the hollow mark on Wed 20 Jan and the dashed projected keyline, and a struck ghost row on Tue 19 Jan labelled "usual day" with no mark. Put a visible annotation on the frame: "Specimen: the Vancouver holiday rule needs the founder's confirmation. Confirmed real example of this state: Foundations DateRow V2, Place B, Thanksgiving moved to Fri 27 Nov, City of Camas 2026 calendar."
- Maya's view only: "Renters insurance renews" on Fri 8 Jan 2027 · "in 81 days · Fri 8 Jan 2027" · "You added this · Every year" · tick · identity.home rule · caption "Only you will see this." This is a date carried over when Maya claimed the home. It stays private until she taps "Share with the household" in the Date sheet. Sam's view has no such row and no ghost row; his month ends with "Checked — nothing else in January".

February 2027 · 1 item (frame 09)
- Pickup summary row "Pickup every Tuesday · recycling Tue 9 and Tue 23 Feb" · hollow · projected caption and keyline.
- Mon 1 Feb: "HOA dues · $285.00" · "in 105 days · Mon 1 Feb 2027" · "Added by Maya · Every month" · tick · identity.home rule.

March 2027 · 3 items (frame 09)
- Pickup summary row "Pickup every Tuesday · recycling Tue 9 and Tue 23 Mar" · hollow · projected caption and keyline.
- Mon 1 Mar: "HOA dues · $285.00" · "in 133 days · Mon 1 Mar 2027" · "Added by Maya · Every month" · tick · identity.home rule.
- Mon 1 Mar: "Tell your landlord in writing by Mon 1 Mar 2027" · "in 133 days · Mon 1 Mar 2027 · Lease ends Wed 31 Mar 2027" · last line "Added by Maya · Does not repeat · Reminder Mon 15 Feb 2027" · tick · identity.home rule.
- Wed 31 Mar: "Lease ends" · "in 163 days · Wed 31 Mar 2027" · "Added by Maya · Does not repeat" · tick · identity.home rule.
- Neither lease row uses urgency or overdue colour.

Worst case (frame 17): Sun 1 Nov holds six rows: "HOA dues · $285.00" and "Smoke alarm batteries" (address dates), "Book club · 7:00 PM" (home event, tick), "Verizon · $65.00" (bill, StatusChip "Upcoming", tick), and the tasks "Test smoke alarms · Sam" and "Clean gutters · Maya" (tick). The November header reads "November 2026 · 9 items". Keep the existing member filter chip row. Every row wraps at AX5.

LAYOUT & VISUALIZATION: Keep the agenda: month headers with counts, then rows grouped by day. Do not use a month grid.
- Address dates join home events, tasks, bills and packages as a fifth row type.
- Every row is a DateRow with a leading KindGlyph, the title, a relative-plus-absolute date, a SourceCaption and a trailing ProvenanceMark S, drawn at the same size everywhere. The struck ghost row is the only row without a mark.
- Keep the member filter chips and the "Who's free" link from the screenshot unchanged.
- "Add an event" placement: on web, a filled primary.700 button at the right of the screen header. On iOS and Android, a text button at the top right of the navigation bar. There is no FAB on Android; if the screenshot has one, remove it.

Row groups. Apply exactly one of these to each row:
1. Annual or self-entered dates (lease, notice, warranty, smoke alarm, HOA, renters insurance, property tax): the 2px identity.home left rule and the recurrence on the last line. Never urgency or overdue colour. Property tax keeps its filled mark and county source.
2. One-off official deadlines (online or mail voter registration, in-person voter registration): the filled mark, scope stated in the caption or the "Statewide — WA" coverage chip, and no left rule. Never due-soon or overdue colour; the relative date carries the urgency.
3. Derived near-term rows (pickup, bills, tasks, package, home events): the kind glyph and relative day. Bills may carry the due-soon treatment, which means the StatusChip "Due today" or "Upcoming", with a hue only on its glyph.

Pickup:
- Rows are individual for the next 14 days, matching Today's strip.
- After that, each month shows one summary row. A week moved for a holiday breaks out as its own row, with the mark on the new day, a struck ghost row on the usual day, and the holiday source.
- HOME A's Tuesday route has no holiday move through Dec 2026, so frame 01 shows none. Frame 08 draws the state as a labelled specimen.

Scope and gaps:
- Statewide rows carry the "Statewide — WA" coverage chip, so they clearly make no claim about this house.
- A quiet month reads as finished: its count, its rows and its "Checked" line.
- When the viewer may not see bills or tasks, those rows are absent. There is no ghost row, and the day keeps its dates and events.
- Private dates show only to their owner, with no trace for anyone else.

INTERACTION, MOTION & HAPTICS:
- Tapping a date or pickup row opens the Date sheet: view-mine for household and private entries, view-seeded for official rows. Dates are edited only in the Date sheet, which is the one write path. "Share with the household" lives there.
- Tapping an event opens the existing event detail. Bills open the bill detail, and tasks open the task.
- The mark is never its own target. "Where this comes from" is a row action that opens the ProvenanceSheet.
- "Add an event" opens the existing create-event sheet. For Sam, fill it with Title "Chimney sweep", Date Sat 14 Nov and Time 9:00 AM, with the footer "Everyone in this household will see this.". The buttons are "Save event" and a visible Close.
- Saving gives one light haptic tick and the status message "Saved to your household calendar.". The new row highlights once with a fading wash.
- Deep-link and notification landings scroll once, highlight the row, and move focus to it. With Reduce Motion, the highlight is static and the scroll jumps instead of animating.
- Months change by scrolling, by "Jump to month", or by each month header's "Previous month" and "Next month" buttons.

FOUNDATIONS COMPONENTS USED: DateRow (pickup; holiday moved; deadline; money row; done; permission-hidden; highlighted) · KindGlyph · ProvenanceMark · SourceCaption · ScopeChip ("Your household" chip; "Statewide — WA" as a coverage chip in its geometry; the sentence forms "Everyone in this household will see this." and "Only you will see this.") · ProvenanceSheet · DateSheet · StatusChip · PushCopy (household variant, frame 15 inset) · LockedActionRow (names who can act) · QuietDayReceipt (the "Checked — nothing …" lines) · WarmingSkeleton · FreshnessLine · OfflineNotice · InlineErrorRow.

ACCESSIBILITY:
- Each row is one element with the custom actions Edit, Remind me, Where this comes from and Mark done.
- The spoken label includes the mark name. Both views: "Recycling and garbage, tomorrow, Tuesday October 20, Waste Connections, on record, not confirmed." Maya's view of her own rows ends "…, you added this"; Sam's view of Maya's rows ends "…, added by Maya".
- Month headers are headings, announced with a summary: "October: 8 items. Next: recycling and garbage tomorrow."
- The specimen holiday row reads "Garbage pickup projected to move from Tuesday January 19 to Wednesday January 20 for Martin Luther King Jr. Day, on record, not confirmed." The struck ghost is labelled "usual day".
- Private rows add "only you can see this".
- "Jump to month", "Previous month" and "Next month" are buttons with those names.
- Targets: 44pt, 48dp or 44px.
- At AX5, the date line wraps under the title, and chips and the legend wrap.
- Status messages are live regions.

COPY: The strings above, plus:
- Empty: "Checked — nothing from your household on the calendar", with one in-body button "Add a date". "Add an event" stays only in the navigation bar or header.
- Read-only reason: "Maya can add and edit events here".
- Error: "We couldn't load the household calendar just now · Retry".
- Offline: "You're offline · as of 6:04 PM" and "Adding events needs a connection."
- Loading shows no text.

EDGE CASES:
- A long title wraps to two lines and is never cut off.
- A multi-day event shows once, with its span.
- Two homes: the header reads "Larkspur Loop · Your household".
- Many items: 20 in November, with the count updating.
- The densest day: frame 17, where address dates and home events share a day.
- Empty (frame 10): the seeded official and pickup rows still show ("October 2026 · 3 items": Tue 20 pickup, the voter row, Tue 27 pickup; "November 2026 · 2 items": property tax and in-person voter registration), plus the empty line.
- Slow network: skeletons after 1s.
- Offline: the cached agenda stays, and adding is disabled with its reason.
- Permission variants:
  - an owner;
  - a member who can edit;
  - a legacy member who can only read: no add button, with the LockedActionRow instead (frame 05, Sam, same counts as frame 02);
  - a viewer without bill or task access: those rows are absent (frame 06, Lena Park: "October 2026 · 5 items");
  - a date private to its owner: absent for everyone else.

INSTEAD OF:
- Instead of a month grid, draw the day-grouped agenda, because rows carry source and scope.
- Instead of red overdue styling on a lease or tax date, draw both with the identity.home left rule and their recurrence line (the tax row keeps its filled official mark), and draw the one-off voter rows with no rule, because annual and official dates are not late chores.
- Instead of an even weekly pickup rhythm, draw one summary row per month plus a broken-out holiday row, because moved weeks are what people need.
- Instead of a special mark for projected pickup rows, keep the weekday's hollow mark and add the projected caption and dashed keyline, because hollow means only "on record, not confirmed", never "projected".
- Instead of an "Only you" chip, draw the sentence "Only you will see this.", because "Only you" is a sentence form, never a row chip.
- Instead of "✓ You added this" in a member's legend, draw "✓ Added by your household" and name the person on the row, because Sam did not add Maya's dates.
- Instead of a second calendar on the dashboard, draw a preview that links here, because two calendars drift apart.
- Instead of editing dates inline, hand off to the Date sheet, because there is one write path; and instead of making the mark tappable or drawing a ghost "hidden bill" row, make the whole row the target and draw nothing for hidden rows, because a 16pt mark is too small and the viewer cannot act on a hidden row.

DONE WHEN: All three links reach this screen on every platform. Sam adds the chimney sweep and sees it right away, and Maya gets one quiet row. A member can edit without the owner changing a role. The lease and notice rows in March 2027 never look overdue. December reads as finished. The holiday move is legible and clearly marked as projected. Statewide rows are scoped. Private dates never reach the household. Every legend word is true for its viewer, and pickup marks match Today (hollow). Every row states its source. Every frame reads in greyscale and at AX5.

ARTBOARDS:
1. f3-household-calendar · ios · 01-agenda-dense · light — Maya's view from Today (Mon 19 Oct) into early November, with the owner legend, hollow pickup rows and the voter row in its done state.
2. f3-household-calendar · ios · 02-member-can-edit · light — Sam's view: "Add an event" live, the member legend, the voter row not done, "Added by Maya" last lines.
3. f3-household-calendar · ios · 03-create-event-sheet · light — the chimney sweep filled in.
4. f3-household-calendar · ios · 04-saved-highlight · light — "Saved to your household calendar.", with the Sat 14 Nov row highlighted and "November 2026 · 6 items".
5. f3-household-calendar · ios · 05-legacy-read-only · light — Sam as a legacy read-only member: no add button, and the LockedActionRow "Maya can add and edit events here".
6. f3-household-calendar · ios · 06-derived-hidden · light — Lena Park's guest view of the same days, "October 2026 · 5 items", with no bill or task rows and no ghosts.
7. f3-household-calendar · ios · 07-quiet-december · light — "December 2026 · 2 items", the pickup summary row, the HOA and warranty rows and the "Checked" line.
8. f3-household-calendar · ios · 08-holiday-move-specimen · light — Maya's "January 2027 · 2 items": the projected summary row, the HOA row, the labelled specimen move to Wed 20 Jan with the struck Tue 19 Jan ghost and the annotation pointing to Foundations DateRow V2, and the private "Renters insurance renews" row.
9. f3-household-calendar · ios · 09-january-to-march-member · light — Sam's January to March 2027, drawn as a tall scrolling capture at 393 wide: "January 2027 · 1 item" with no private row and "Checked — nothing else in January"; "February 2027 · 1 item"; "March 2027 · 3 items" with the notice and lease rows carrying the identity.home rule, "Added by Maya", "Does not repeat" and "Reminder Mon 15 Feb 2027", and no urgency colour.
10. f3-household-calendar · ios · 10-empty · light — the seeded official and pickup rows plus "Checked — nothing from your household on the calendar" and "Add a date".
11. f3-household-calendar · ios · 11-loading · light — row skeletons.
12. f3-household-calendar · android · 12-error · light — the InlineErrorRow with Retry.
13. f3-household-calendar · android · 13-offline · light — the cached agenda and the disabled add button with its reason.
14. f3-household-calendar · web-1440 · 14-entry-points · light — the agenda with the Calendar header tab selected, plus three cropped insets at the right edge, each labelled: the dashboard Calendar card footer "Open calendar"; the place file Dates link "See the household calendar ›"; and the native Larkspur Loop screen list with the "Calendar" row directly below "Dashboard".
15. f3-household-calendar · android · 15-notification-landing · light — landed from the push, shown as a PushCopy inset (title "Sam added Chimney sweep", body "Sat 14 Nov · Larkspur Loop"), with the Sat 14 Nov row highlighted and "November 2026 · 6 items".
16. f3-household-calendar · web-390 · 16-agenda-dense · light — frame 01 on mobile web.
17. f3-household-calendar · ios · 17-ax5-worst-case · light — "November 2026 · 9 items", Sun 1 Nov with its six rows and the member filter chips, at AX5.
18. f3-household-calendar · ios · 18-greyscale · light — frame 01 in greyscale.
19. f3-household-calendar · ios · 01-agenda-dense · dark — the dark twin of frame 01.
20. f3-household-calendar · ios · 08-holiday-move-specimen · dark — the dark twin of frame 08.
21. Notes — list the following:
- Assumptions:
  - Pickup rows follow the TODAY fixture: hollow, "Waste Connections · city schedule", matching the Foundations DateRow V1a and V1b. No row says Maya confirmed the day.
  - The holiday move is a specimen. Research confirms only Camas's rule (a holiday moves that day's route to the next business day), and that rule never moves a Tuesday route in Oct–Dec 2026. The Vancouver/Waste Connections rule for 2027 needs the founder's confirmation. MLK week was chosen because, under a rule that slides the rest of the week, it is the first Tuesday move after Dec 2026. The research example (Veterans' Day, Wed 11 Nov → Thu 12 Nov) applies to a Camas Wednesday route, not HOME A; Foundations DateRow V2 (Thanksgiving, Place B) is the confirmed real example of the state.
  - HOA dues is a self-added monthly date (Foundations V6), so it appears on the 1st of every drawn month, and the month counts include it.
  - The notice reminder (Mon 15 Feb 2027) is shown to the whole household.
  - The filled civic rows assume the seeded state and county deadlines were checked by hand. Otherwise they ship as on record, not confirmed.
  - The property-tax move from Sat 31 Oct to Mon 2 Nov rests on RCW 1.12.070, per the house style.
  - The "Washington Secretary of State" and "Clark County Elections" source strings still need the founder to check them.
  - "Statewide — WA" is a coverage chip in ScopeChip geometry, not a visibility chip.
  - "See the household calendar ›" replaces the inventory's link label "Everyone here can see these", which stated scope outside the two canonical strings; the place-file prompt must use the same label.
  - How the Date sheet and place file show a private date at a claimed home is still open in those prompts.
- Contract question for the Foundations board: legend wording for a tick another household member added. Used here: "Added by your household".
- Every invented string: "Maya's parents visiting", "Package expected · replacement recycling cart", "Change furnace filter", "Smoke alarm batteries", "Renters insurance renews", "Book club · 7:00 PM", "Verizon · $65.00", "Test smoke alarms · Sam", "Clean gutters · Maya", "Lena Park", "Added by Maya", "Added by Sam", "Added by your household", "city schedule", "Checked — nothing today", "Checked — nothing from your household on the calendar", "Jump to month", "Previous month", "Next month", "See the household calendar ›", the push "Sam added Chimney sweep" / "Sat 14 Nov · Larkspur Loop", the projected and specimen captions, the summary-row strings, the relative day counts, the error and offline lines, and "as of 6:04 PM".
- Kept from the screenshot: the "Who's free" link and the member filter chips.
- Omitted: the T3 reminder push landing here for a co-resident who cannot edit (it belongs to the reminder-landing work); the Android calendar route (engineering).

BATCH PLAN: Turn 1: artboards 1–6, then wait for "continue". Turn 2: 7–12, then wait for "continue". Turn 3: 13–18, then wait for "continue". Turn 4: 19–21.
