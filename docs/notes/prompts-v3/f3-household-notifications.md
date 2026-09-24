# Household activity notifications (rows, channel, routing)
id: f3-household-notifications · platforms: web/ios/android · isNew: False · artboards: 26

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Household activity notifications · f3-household-notifications

TYPE: EXTENSION of the existing designed screens "Notifications" (the in-app list) and "Notification settings". These screens already exist in the Pantopus design system. The attached screenshots are exact. Keep everything and change only what is listed.

ATTACH: the Notifications list on web 1440, web 390, iOS and Android; the header bell with its badge; Notification settings on iOS and Android; the native bill detail; the household calendar; the Today tab; the place file Dates section.

PLATFORMS & VIEWPORTS: web 1440x900 and 390x844; iOS 393x852; Android 412x915. Tray frames use the iOS lock screen and Notification Center, and the Android notification shade.

WHERE IT LIVES & HOW PEOPLE ARRIVE: This is not a fifth tab. The list is a stack pushed over whichever of the four tabs is open, reached from the header bell (web: the bell in the top bar at 1440 and 390, URL /app/notifications; the sidebar keeps its four tabs and none is selected). The OS tray is the other way in. Household activity settings are reached from Notification settings › Household activity, from the "Household activity settings" text link in the list header, from the same link directly under the first "Marked paid" row, and from the household block's switch (an explicit opt-in, so it goes straight to the OS prompt). The full settings page is drawn in the f4-notification-settings project; this project draws only the Household activity group. Each row hands off to its exact object:
- Marked paid → bill detail in the Paid state (/app/homes/{home}/bills/{bill});
- Marked paid, grouped → see INTERACTION: the push opens the Bills list Paid segment with the rows highlighted (/app/homes/{home}/bills?segment=paid&highlight={bill1},{bill2},{bill3});
- Task finished → the task;
- Date added → the household calendar, with the event highlighted;
- Date reminder, date inside the 14-day strip → the one Today tab with the rule's row highlighted: /app/today?place={place}&rule={rule} (native pantopus://today?place={place}&rule={rule}). The branch is which place Today shows, never a home id assumed: the Cedar Ave landing shows ScopeChip "Saved place · Only you"; the Larkspur Loop landing shows "Your household";
- Date reminder, date outside the 14-day strip (today the strip runs Mon 19 Oct to Sun 1 Nov) → the Dates row in that place's place file, highlighted;
- Bill reminder → bill detail;
- Joined or left → the members roster.
Pickup is not sent from here: it arrives only through the evening briefing.

WHO AND WHEN: Sam Ortega, a member at HOME A, on Mon 19 Oct at 6:10 PM. He also has a saved place, Cedar Ave (2207 SE Cedar Ave, Vancouver, WA 98664, "Saved place · Only you"), so every row carries a place label. Household activity is off by default; Sam switched it on on Mon 14 Sep. Maya marked Clark Public Utilities paid on her phone at 6:02 PM and left the screen at 6:04 PM, so Sam won't pay it too.

THE ONE JOB: Make "Maya marked Clark PUD paid" arrive quietly, read clearly, and open the exact bill.

FIRST FIVE SECONDS: first the unread dots and the actor's name at the start of each row; second the caption with the amount, date and place; third the grouped row's count. The primary action is tapping a row.

CONTENT (fixture deltas). The actor is Maya because only she can mark bills paid; the canonical "Sam marked Clark PUD paid" is the same string with the names swapped. The list has two overlines, "TODAY" and "EARLIER"; rows under TODAY show a bare time. Rows, newest first:
TODAY
1. Unread · MC · "Maya marked Clark Public Utilities paid" / "$142.18 · due in 4 days · Fri 23 Oct · 6:04 PM · Larkspur Loop"
   Under it, outside the row target: text link "Household activity settings".
2. Unread · MC · "Maya added Chimney sweep" / "in 19 days · Sat 7 Nov at 9:00 AM · 5:30 PM · Larkspur Loop"
3. Unread · system · "Property tax due in 14 days" / "Mon 2 Nov · 7:00 AM · Larkspur Loop · Clark County Treasurer · ● Official"
4. Unread · system · "City budget hearing in 21 days" / "Mon 9 Nov · 7:00 AM · Larkspur Loop · City of Vancouver · ○ On record, not confirmed"
EARLIER
5. Unread · MC · "Maya finished HVAC filter" / "Your task · Sun 18 Oct, 4:15 PM · Larkspur Loop" (Sam created the task, so he is the only one told)
6. Read · TO · "Theo left Larkspur Loop" / "Sun 18 Oct, 11:20 AM"
7. Read · system · "NW Natural due tomorrow" / "$41.18 · due Tue 13 Oct · Mon 12 Oct, 6:00 PM · Larkspur Loop · ✓ You added this"
8. Read · MC · "Maya marked 3 bills paid" / "Clark Public Utilities, Comcast, Waste Connections · $228.34 · Thu 17 Sep, 6:40 PM · Larkspur Loop" · chevron
Routing frame only:
9. "Insurance renews in 7 days" / "Mon 26 Oct · 7:00 AM · Cedar Ave · ✓ You added this"
10. "HOA dues due in 13 days" / "Sun 1 Nov · 7:00 AM · Larkspur Loop · ✓ You added this"
Later frame (Wed 21 Oct), all read:
11. PR · "Priya joined Larkspur Loop" / "Can see the calendar and bills · Wed 21 Oct, 4:20 PM"
12. system · "Jenna's guest access ended" / "Tue 20 Oct · Larkspur Loop"
Joined and left titles already name the home, so their captions omit the place label.

Push strings (title 30 characters or fewer, body 40 or fewer, no amounts, no house number; the place label is the street name, or the person's own nickname for the home when they set one):
- "Maya marked Clark PUD paid" / "Due Fri 23 Oct · Larkspur Loop"
- Grouped, updated in place, as it looked on Thu 17 Sep, 6:40 PM: "Maya marked 3 bills paid" / "Thu 17 Sep · Larkspur Loop"
- "Maya added Chimney sweep" / "Sat 7 Nov, 9:00 AM · Larkspur Loop"
- Unconfirmed date reminder, Mon 19 Oct, 7:00 AM: "Unconfirmed: budget hearing" / "Mon 9 Nov · Larkspur Loop"
- Date reminder, Mon 15 Feb 2027, 7:00 AM: "Lease notice due in 14 days" / "Tell landlord by Mon 1 Mar", with the action "Done"
- Bill reminder, Tue 27 Oct, 6:00 PM: "Vancouver water due tomorrow" / "Larkspur Loop", no amount, no action
- Hidden-preview placeholder: "Household update"

LAYOUT & VISUALIZATION
- List: NotificationRow exactly as published on the Foundations board, two lines, no row menu button on any platform.
  - A fixed 12pt leading column holds a 6pt unread dot. Do not bold or tint unread rows.
  - A 28pt initials avatar sits before the sentence for every row with a person as actor, including joined and left rows (PR, TO). System rows (reminders and "Jenna's guest access ended") have no avatar; their text keeps the same alignment.
  - Line 1 starts with the actor.
  - Line 2 is a middot caption in this order: amount (in-app only) · due or event date · time received · place label (only for readers with more than one place). Date reminders carry their relative count in line 1, so their caption starts with the date, and the authority comes after the place label. Reminder rows then end with the ProvenanceMark S of the calendar row they came from, with its word the first time each mark appears: filled = official, hollow = on record, not confirmed, tick = you added this. Bill reminders carry the tick, because the household added the bill.
- A grouped burst is ONE row that expands in place to its three child rows. It is never three separate top-level rows. Expanded, the child rows have no avatar and are indented to the text column, followed by the line "See all 3 in Bills".
- Delivery:
  - Household activity is quiet. On iOS it is Passive: Notification Center only, no banner, no sound, one thread per home ("Larkspur Loop"). On Android it posts to the Household activity channel (LOW): shade only, no heads-up, one group per home with a summary; each child notification still makes sense alone.
  - A "Marked paid" notification is loud only for a member who still sees the bill as unpaid and due within 3 days. On Android that one posts to the Dates & bills channel (DEFAULT); on iOS it is Active in the Larkspur Loop thread. Clark is due in 4 days, so this one arrives quietly.
  - Mixed bursts: if any bill in a burst is due within 3 days for this reader, that one posts on its own as Active / DEFAULT in Dates & bills, and the rest stay grouped and quiet. The Thu 17 Sep burst had every bill more than 3 days out, so it is fully quiet.
  - "Task finished" goes only to the task's creator or assignee, never to the whole household.
  - Push avatars are circular initials.
  - Date and bill reminders are Active / DEFAULT in Dates & bills. An unconfirmed date keeps its caveat in the tray by putting "Unconfirmed:" first in the title, because a mark cannot travel in the tray.
  - Pickup notices go out only as the evening briefing.
- Settings group (Android frames): a Household activity group card. Master switch, then the level in words: "Quiet — no sound or pop-up. Shows in your notification shade and in Notifications." Then three example lines: "Maya marked Clark PUD paid", "Maya added Chimney sweep", "Priya joined Larkspur Loop". Then the captions "If someone marks a bill paid that's due in the next 3 days, you'll hear it, so you don't pay it twice. That sound follows your Dates & bills setting." and "You'll still see these in Notifications when your phone's notifications are off." States: saving, "Saved", "Couldn't save. Check your connection and try again.", and switch on but blocked by the phone: amber glyph, "Off in Android settings" + "Open settings". The other four groups appear collapsed by name: Briefings · Air & weather alerts · Dates & bills · Account & security. Muting household activity never mutes Account & security.

INTERACTION, MOTION & HAPTICS
- Tapping a row marks it read and opens its object. The destination scrolls once and fades a highlight (300ms). Reduce Motion shows the highlight without the fade. There are no swipe-only actions and no row menu.
- Grouped row, in-app: tapping it expands it in place (the chevron is part of the row target; there is no separate expand button). Each child row opens its bill detail. The line "See all 3 in Bills" opens the Bills list Paid segment with the three rows highlighted. Grouped push in the tray: tapping it opens the Bills list directly with the rows highlighted.
- Target gone: every platform opens the object's own screen, which shows the removed state (NotificationRow gone-target). A removed bill shows the bill screen with "That bill was removed." and "Back to bills"; Back returns to Notifications. A removed date lands on the Today tab for that place (or the place file when the date was outside the strip) with the line "That date was removed." at the top, and no error dialog. Only when the target cannot be resolved at all does the list stay open with "That bill was removed." under the row.
- Resolving an item withdraws its notices. When Maya marks Clark paid, Sam's scheduled reminders for that month are cancelled, and any delivered reminder is replaced by the "Marked paid" notification in the same thread or group. Marking a date Done stops its later reminders.
- If the app is open when a notice arrives, show no banner: the bell badge counts up (unread only), and the matching card or row highlights if it is on screen.
- No tray action on household activity. The date reminder has one action, "Done". There is no "Mark paid" in the tray, because it would notify the household with no chance to undo.
- No haptics on arrival.

FOUNDATIONS COMPONENTS USED: NotificationRow (bill-paid, task-completed, event-created, date reminder, bill reminder, joined/left, grouped, gone target; unread, read, push-off, offline); PushCopy (household, bill reminder and date reminder variants, household roll-up, hidden-preview placeholder, collapsed and expanded tray); ProvenanceMark; ScopeChip ("Saved place · Only you", "Your household"); NotificationAsk (household switch → OS prompt; iOS denied → Open Settings; switch on but OS blocked; saving / Saved / Couldn't save); WarmingSkeleton; InlineErrorRow; OfflineNotice; FreshnessLine.

ACCESSIBILITY: Each row is one element, read "Unread. Maya marked Clark Public Utilities paid. 142 dollars 18 cents, due in 4 days, Friday October 23, 6:04 PM, Larkspur Loop." Reminder rows end with the mark's spoken name ("…, official", "…, on record, not confirmed", "…, you added this"). The dot's label is "Unread". The avatar is decorative. The grouped row reads "Maya marked 3 bills paid, collapsed, button" and its expanded state. The "Household activity settings" link is its own 44pt target, separate from the row. Targets are 44pt iOS, 48dp Android and 44px web. At AX5 and 200%, captions wrap at middots and nothing truncates the actor. Unread uses position plus a dot, so it reads in greyscale. Landing highlights also move focus. Settings save states are announced without moving focus.

COPY: all strings above, plus: "Notifications" · "TODAY" · "EARLIER" · "Household activity settings" · "See all 3 in Bills" · "Push is off. You'll still see these here." + "Turn on" (iOS denied → "Open Settings") · "That bill was removed." + "Back to bills" · "That date was removed." · "Nothing new. Household updates and reminders show here." · "We couldn't load notifications just now" + "Retry" · "You're offline · as of 5:40 PM" · "You're offline. This opens when you're back." · "Household activity" · "Quiet — no sound or pop-up. Shows in your notification shade and in Notifications." · "Saved" · "Couldn't save. Check your connection and try again." · "Off in Android settings" + "Open settings" · "Saved place · Only you" · "Your household" · "● Official" · "○ On record, not confirmed" · "✓ You added this".

EDGE CASES:
- Fourteen or more unread rows stay readable because unread is only a dot.
- A reader with a single place sees no place labels.
- Long task title: "Maya finished Replace the upstairs bathroom fan" wraps and never cuts "Maya".
- A 12-bill burst is one row, "Maya marked 12 bills paid".
- A target that no longer exists lands on its designed removed state, never a blank screen.
- A saved-place rule opens Today on Cedar Ave, never on a home.
- A member or guest who can't see bills never receives "Marked paid" notifications or bill reminders. Only-you bills never notify.
- "Task finished" never reaches someone who neither created nor was assigned the task.
- Exactly one "Marked paid" notification goes to each other member, even after a retry.
- Hidden previews show "Household update".
- iOS Scheduled Summary may hold Active notices; the in-app row is the guarantee.
- Offline keeps cached rows. A slow network refreshes in place.

INSTEAD OF
- Instead of the long title "Maya marked the Clark Public Utilities bill paid", write "Maya marked Clark PUD paid" (26), because the tray cuts titles past 30 characters.
- Instead of putting the caveat at the end of a reminder title, put it first ("Unconfirmed: budget hearing"), because the tray cuts the end and the mark cannot travel there.
- Instead of a pickup reminder here, rely on the evening briefing, because two notices for one pickup make people switch everything off.
- Instead of amounts or street numbers in the tray, show them only in-app, because lock screens are visible to others.
- Instead of a bold or tinted unread row, use the 6pt dot in its fixed column, because a long unread list must stay readable.
- Instead of stacking three "Marked paid" notices, update one grouped notice in place, because bursts overwhelm.
- Instead of a row menu with "Turn off household activity", draw the "Household activity settings" link in the header and under the first Marked paid row, because the published NotificationRow has no row menu.
- Instead of nudges like "Sam still hasn't paid" or a keeper voice, state only what someone did, because household rows report actions, not blame.

DONE WHEN: Sam's phone stays quiet, yet his list shows Maya's action with her name first and opens the paid bill. No reminder for a paid bill ever reaches him. An unconfirmed date looks unconfirmed in the list and in the tray. Every title fits in 30 characters and every body in 40 on both platforms. Every row lands on its object (inside the strip on Today, outside it on the place file) or on a designed removed state, and the grouped row has exactly one behaviour per tap target.

ARTBOARDS
1. f3-household-notifications · ios · 01-unread-list-dense · light — TODAY and EARLIER overlines, rows 1-8, place labels, the three mark words on first occurrence, the "Household activity settings" link under row 1.
2. f3-household-notifications · android · 02-unread-list · light — same content in Material 3.
3. f3-household-notifications · web-1440 · 03-unread-list · light — list pane with the bell selected in the top bar, sidebar with four tabs and none selected.
4. f3-household-notifications · web-390 · 04-unread-list · light — one-column list with rows 1-8, bell in the top bar.
5. f3-household-notifications · ios · 05-read-later · light — Wed 21 Oct, all read, plus the Priya joined row (PR avatar) and the Jenna access-ended system row.
6. f3-household-notifications · ios · 06-grouped-expanded · light — the grouped row collapsed, then expanded to its three bills with "See all 3 in Bills".
7. f3-household-notifications · ios · 07-tray-household-passive · light — Notification Center thread on Mon 19 Oct with "Maya marked Clark PUD paid", an inset labelled "Thu 17 Sep, 6:40 PM" showing the updated grouped notice, and the hidden-preview version.
8. f3-household-notifications · android · 08-tray-household-low · light — silent grouped shade entry in Household activity, public version.
9. f3-household-notifications · ios · 09-tray-date-reminder · light — lease notice on Mon 15 Feb 2027, expanded with Done; plus an inset labelled "Mon 19 Oct, 7:00 AM" with "Unconfirmed: budget hearing" / "Mon 9 Nov · Larkspur Loop".
10. f3-household-notifications · android · 10-tray-date-and-bill-reminders · light — lease reminder with Done, plus the Tue 27 Oct "Vancouver water due tomorrow" reminder with no amount and no action.
11. f3-household-notifications · ios · 11-landing-resolves · light — row 1 tapped, then bill detail Paid with the highlight.
12. f3-household-notifications · web-390 · 12-landing-target-gone · light — a stale Marked paid row opening the bill screen with "That bill was removed." and "Back to bills"; inset: a removed date landing on Today for Larkspur Loop with "That date was removed." at the top.
13. f3-household-notifications · ios · 13-routing-scopes-and-window · light — three insets: row 9 opening Today on Cedar Ave with the insurance row highlighted and ScopeChip "Saved place · Only you"; row 10 opening Today on Larkspur Loop with the HOA dues row highlighted and "Your household"; row 3 opening the Larkspur Loop place file with the property-tax Dates row highlighted (outside the strip).
14. f3-household-notifications · ios · 14-push-off-banner · light — banner with in-app rows.
15. f3-household-notifications · android · 15-household-settings-group · light — group card with switch, level line, examples, both captions, and the other four groups collapsed.
16. f3-household-notifications · android · 16-household-settings-states · light — the group card in three stacked insets: saving, Saved, and Couldn't save; plus switch on with "Off in Android settings" + "Open settings".
17. f3-household-notifications · web-1440 · 17-empty · light — nothing new.
18. f3-household-notifications · ios · 18-loading · light — row skeleton.
19. f3-household-notifications · android · 19-error · light — InlineErrorRow.
20. f3-household-notifications · ios · 20-offline · light — cached rows, "You're offline. This opens when you're back." under an uncached row.
21. f3-household-notifications · ios · 21-ax5 · light — AX5 wrapping.
22. f3-household-notifications · android · 22-200-percent · light — 200% font.
23. f3-household-notifications · ios · 23-greyscale · light — frame 1 in greyscale.
24. f3-household-notifications · ios · 01-unread-list-dense · dark — dark twin of 1.
25. f3-household-notifications · ios · 07-tray-household-passive · dark — dark twin of 7.
26. f3-household-notifications · Notes — the name swap from the canonical string; every invented string (Theo and his avatar, Jenna, Priya's join date, Cedar Ave, Chimney sweep times, NW Natural, HVAC filter, Waste Connections $38.75, the Thu 17 Sep burst and its $228.34 total, Maya's 6:02 PM mark and 6:04 PM send, the City budget hearing and its hollow mark, the HOA dues 13-day reminder, the receipt times, Sam's Mon 14 Sep opt-in, the Vancouver water reminder, "See all 3 in Bills", "Household activity settings"); route decisions: date reminders for both scopes open the one Today with a place parameter when the date is inside the strip, and the place file Dates row when it is outside, never the retired Place › Today route; "Marked paid" now links to /app/homes/{home}/bills/{bill} and its push body drops the amount (the design doc's list link and amount body are superseded by the research no-amounts rule); removed targets land on the object's own removed state, matching f3-bill-detail-web; the row menu from the settings proposal is replaced by the header and under-row settings links, per the published NotificationRow; the amount moved from line 1 (Foundations specimen) to line 2 here; bill reminder rows carry the tick because the household added the bill; the bill-reminder tray uses the water bill because Clark's reminders are cancelled once it is paid; the lease push body "Tell landlord by Mon 1 Mar" keeps the action and drops the place label to fit 40 characters (product trade-off to confirm); Household activity is one switch for all homes (per-home granularity is an open product decision; the fake per-home toggles and the line explaining the double gate of push preference plus home reminders are handled in f4-notification-settings); the burst window length as a product decision; and the optional iOS provisional test for this group only.

BATCH PLAN: Turn 1: 1-6, then wait for continue. Turn 2: 7-12, then wait for continue. Turn 3: 13-18, then wait for continue. Turn 4: 19-24, then wait for continue. Turn 5: 25-26.
