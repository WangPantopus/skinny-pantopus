# Notifications settings (one switch per kind)
id: f4-notification-settings · platforms: web/ios/android · isNew: False · artboards: 21

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Notifications settings · f4-notification-settings

TYPE: EXTENSION of the existing designed screen "Notification settings". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.

ATTACH: The existing Notification settings page on web 1440, iOS and Android. The existing home settings page that still shows the per-home notification switches, which this change removes. The two entry hosts are not built yet: draw the briefing card's "More options" from the Foundations NotificationAsk card row, and the Mail row's "Turn these off" from the Foundations NotificationRow with its overflow menu open. Do not wait for screenshots of those. The settings image in the send kit (archetype A14.5: Push/Email/SMS chips on every row, Pause all, Quiet hours, Tasks, Pulse and Marketplace groups) is an early concept that never shipped: use it for chrome only. The shipped page on web, iOS and Android has Briefings, Alert preferences (weather, air quality, home reminders, gig updates, Beacon push, mail summary), Quiet hours and Briefing location.

PLATFORMS & VIEWPORTS: Web 1440x900 uses the settings layout inside the left sidebar. Web 390x844. iOS 393x852 uses a grouped inset list. Android 412x915 uses a Material 3 preference list with group headers.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Settings > Notifications. On mobile, Settings opens from the account area in the Mail tab. On desktop, it opens from the sidebar. There is one page, and it has no tab of its own. Entry points:
- Settings > Notifications.
- "More options" on the Today briefing card (and "Change" on its time rows).
- "Turn these off" in the overflow menu of any in-app notification row. The page scrolls once to that row's group and fades a highlight on it.
- The "Manage these" link on the first "Sam marked Clark PUD paid"-type row in Mail.
- "Change" on Mail's "Household updates are on · Change" line (lands on ?group=household).
- The "Manage reminders" link beside the Date sheet's "Remind me" control.
- The iOS Settings link "Pantopus Notification Settings".
- Android's in-app settings link from the system notification page.
- The row "Notifications · Open" on each home's settings page.
- The deep link /app/settings/notifications, with ?group=briefings, ?group=air, ?group=dates, ?group=household, ?group=nearby, ?group=mail or ?group=account for the group landing. A landing only highlights; it never changes a value.
What this page receives: from a notification row, the group to highlight. What it hands on: "Set it" opens the Date sheet on the pickup-day kind, "Open Settings" opens the system notification page for Pantopus, and "Open" opens that Android group's system page.

WHO AND WHEN: Sat 17 Oct, an "Unhealthy air: AQI 176" alert reached Maya Chen's iPhone. On Mon 19 Oct, 6:10 PM, she taps "Turn these off" on that alert's row in Mail to raise her threshold without losing the pickup reminder.

THE ONE JOB: Give every notification Pantopus sends exactly one honest switch, on one page, and show when the phone is holding or blocking it.

FIRST FIVE SECONDS: First, the master switch "Push notifications from Pantopus" (or the pinned banner when the OS blocks delivery). Second, the seven group headers. Third, the delivery line directly under each group header. There is no page-level primary action, because each switch saves on its own.

CONTENT (fixtures apply; the deltas are below)
These values are Maya's own choices. Defaults after a new grant: evening on, morning off, air on at 101, dates & bills on only where a reminder is set, household activity off, account on.
The page reads top to bottom:
- Pinned master: "Push notifications from Pantopus", ON. Helper: "Turning this off stops every notification. Everything still shows inside the app." Device line: "Sends to this iPhone and one browser."
- One-time migration line: "We moved your home reminder settings here. Nothing you turned off was turned on." Button: "Dismiss".
- BRIEFINGS (no group master; the two switches lead). Delivery line under the header: "Normal notification, with sound."
  - "Morning briefing", ON (Maya chose it), 7:00 AM. Caption: "Date reminders arrive at this time too. Turn them off in Dates & bills. Items sent in the last day don't repeat."
  - "Evening briefing", ON, 6:00 PM. Caption: "Only when something needs you. No news means nothing's up." Second line: "Pickup comes with the evening briefing." Status line: "Last sent Mon 19 Oct, 6:00 PM · pickup".
  - Status row: "Pickup day · Tuesday (confirmed by Sam)".
  - Row: "Pause briefings until…". Once paused, it reads "Paused until Mon 26 Oct · Resume".
  - Native only: "Home screen widget · Add", hidden once a widget has been placed, and hidden while the OS-blocked banner offers the widget.
- AIR & WEATHER ALERTS
  - Master ON. Helper: "Normal notification, with sound. Can come through Focus when the air quality index (AQI) is 151 and up, or when there's a weather warning."
  - Caption: "One alert when air crosses your level. It updates if air gets worse. National Weather Service warnings always come while this is on."
  - Threshold as three single-choice rows. The first is selected, matching what the server sends today:
    1. "Unhealthy for Sensitive Groups · AQI 101 and up". Meaning: "Members of sensitive groups may experience health effects. The general public is less likely to be affected."
    2. "Unhealthy · AQI 151 and up". Meaning: "Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects."
    3. "Very Unhealthy · AQI 201 and up". Meaning: "Health alert: The risk of health effects is increased for everyone."
- DATES & BILLS (renamed from "Home Reminders"; no group master). Delivery line under the header: "Normal notification. Reminders come only where you set one. To stop one, open that date and set Remind me to never."
  - "Date reminders", ON. Helper: "Lease ends, insurance renews, tax-appeal deadlines."
  - "Bill and task reminders", ON. Helper: "Clark Public Utilities, any bill you add, and tasks given to you."
  - Two switches, so muting dates never mutes bills or tasks.
- HOUSEHOLD ACTIVITY (default for a new grant is OFF; Maya turned it on earlier)
  - Master ON. Helper: "Quiet — shows in your list, no sound. Always in your Mail notifications, even with this off."
  - "Bills marked paid", ON. Caption: "Louder only if a bill you still see as unpaid is due within 3 days."
  - "Tasks completed", OFF. Caption: "Only tasks you created."
  - "Calendar events added", ON.
  - "People joining or leaving", ON. Caption: "When someone joins or leaves your household."
- NEARBY (founder ruling, 22 Sep 2026: the app sends these today). One switch each, all on by default, matching today:
  - "Messages" (messages from neighbors, and replies).
  - "Posts and follows" (comments, replies, likes, reposts, new followers, connection requests).
  - "Marketplace" (offers, trades and questions on your listings; saved-search matches).
  - "Gigs and payments" (bids, gig updates, payments, payouts, disputes).
  - "Beacons you follow" (broadcasts from beacons you follow).
- MAIL: "Mail", ON (new, urgent and delivered mail, and the daily summary).
- ACCOUNT & SECURITY. Delivery line: "Normal notification."
  - "Sign-ins and invitations to you", ON. Helper: "New sign-ins to your account and household invitations sent to you."
- Help link in the same slot as on the other settings pages.
Worst case to fit: the pinned banner, the migration line and a paused-briefings caption all at once, at 390 wide, while offline.

LAYOUT & VISUALIZATION: Seven labelled groups in this fixed order: Briefings, Air & weather alerts, Dates & bills, Household activity, Nearby, Mail, Account & security (Account & security stays last). The order never changes, because each group is one permanent Android channel and one iOS category; in Nearby, each switch is its own channel and category, and reads its own OS state like every other row. Air & weather alerts and Household activity open with a master switch, with the helper (stating the delivery level) directly under that master in text.secondary. Briefings and Dates & bills have no master: their delivery line sits directly under the group header, and their first switch leads. Account & security has one switch with its delivery line under the header. Never put helper text in a group footer: people check one switch at a time. Only the Air group mentions Focus. The evening briefing's silence promise sits in its own row caption, because the people who open this page stopped getting notifications and want to know whether they are still on.
Every row reads its own OS state. When the OS blocks a row or group, draw the switch off and disabled, with a leading warning glyph and a text.primary line under it: Android "Off in Android settings · Open"; iOS "Off in iOS Settings · Open Settings". The saved choice is kept and comes back when the OS allows it. A switch never reads ON when nothing can be delivered.
When the whole app is blocked, pin a full-width banner above the master: warning glyph, text.primary on the warning tint, "Notifications are off for Pantopus. These rows still update inside the app.", then "Open Settings". The widget is offered once, inside that banner, and the Briefings widget row is hidden. Every switch below the banner is drawn off and disabled. Under each one that the person had on, a caption in text.secondary reads "Your choice: on. It comes back when notifications are allowed." Use amber only on the glyph, and only when a switch the person turned on cannot be delivered.
Time rows show the time as a trailing value. Selected threshold row: iOS uses a trailing checkmark plus bold label; Android uses an M3 radio button plus bold label; web uses a native radio plus bold label. Focus is a separate ring on every platform.

INTERACTION, MOTION & HAPTICS: Tapping a switch or threshold row saves it right away. The row shows "Saving…", then "Saved", as a polite status message under the row, never a toast. If a save fails, the control returns to its last saved value and an InlineErrorRow appears in the row's slot. A time row opens the platform time picker on iOS and Android, and a native time input on web. "Pause briefings until…" opens the platform date picker (web: native date input), defaulting to 7 days from today; saving shows "Paused until Mon 26 Oct · Resume", and "Resume" ends the pause at once. Threshold rows are single choice; selection looks different from focus. A deep-link landing scrolls once and fades the highlight within 300ms; under Reduce Motion the highlight is a static outline. A landing moves accessibility focus to the highlighted group's header, and then to its first control, so "Turn these off" ends one tap away from the switch. A successful save plays one light haptic tick on native. Nothing on this page is gesture-only.

FOUNDATIONS COMPONENTS USED: NotificationAsk "OS blocked" settings row, with one override of the Foundations specimen: the switch is drawn off and disabled (not on), with the warning glyph and the text.primary line under it; the saved choice is kept. NotificationAsk status states (saving / Saved / Couldn't save). QuietDayReceipt (briefing settings row variant "Skipped tonight — nothing needed you"). FactRow (pickup-day status row, known and missing variants; not-at-this-tier variant "Claim this address first" for Household activity at PLACE B). InlineErrorRow (save failed variant). OfflineNotice (read-only cached screen variant). NotificationRow (the entry point, overflow "Turn these off"). ScopeChip (saved-place caption). WarmingSkeleton (row skeleton). ChoiceChip is not used on this page.

ACCESSIBILITY: Reading order: banner, master, migration line, then each group header, its delivery line, and its rows. Each control's spoken label includes its helper and its OS state. Normal: "Evening briefing, on, 6:00 PM. Only when something needs you." Blocked (Android): "Evening briefing, switch, off, disabled. Turned off in Android settings. Your choice, on at 6:00 PM, comes back when Android allows it. Open Android settings." On iOS, VoiceOver says "dimmed" in place of "disabled". A blocked row is always announced as off, with its saved choice as a hint. Threshold rows: "Very Unhealthy, AQI 201 and up, selected, 3 of 3." Status messages use a polite live region and never move focus; only a deep-link landing moves focus. Targets are 44pt on iOS, 48dp with 8dp gaps on Android, and 44px on web. Focus never sits under the pinned banner, which reserves scroll padding. At AX5 and 200%, labels wrap and switches drop below the label.

COPY
- Actions: "Set it" · "Open Settings" · "Open" · "Resume" · "Retry" · "Dismiss" · "Add a place" · "Show me how" · "Add".
- Status: "Saving…" · "Saved".
- Blocked row: "Off in Android settings · Open" · "Off in iOS Settings · Open Settings".
- Saved choice while blocked: "Your choice: on. It comes back when notifications are allowed."
- Scheduled Summary (iOS): "Your iPhone may hold pickup reminders for your summary."
- Time Sensitive off (iOS, Air group): "Time Sensitive is off in iOS Settings. Alerts may wait until Focus ends. · Open Settings".
- Paused: "Paused until Mon 26 Oct · Resume". Evening status while paused: "Paused — nothing sent".
- Quiet night: "Skipped tonight — nothing needed you".
- Save error: "Couldn't save Evening briefing. Check your connection and try again. · Retry".
- No location: "Briefings need an address. Save one to turn these on."
- Timezone (only when the phone is outside Pacific time): "Your phone is on Mountain Time. These send at 7:00 AM and 6:00 PM Pacific, the address's time."
- Web blocked: "Notifications are blocked in this browser. These rows still update inside the app. · Show me how".
- Offline: "You're offline. Your current settings still apply. Changes need a connection." Per-control reason: "Saving needs a connection."
- Home settings row: "Notifications · Open".

EDGE CASES
- Saved place only (Jordan Lee at PLACE B, 1107 NE Birchfield Ct):
  - A briefings caption: "Briefings follow your saved place, 1107 NE Birchfield Ct · Saved place · Only you".
  - The pickup row reads "Pickup day · Not set · Set it", with the caption "The city lists Thursday. Set your pickup day to get the night-before reminder."
  - Household activity is one grey FactRow, "Claim this address first", with no action.
  - "Bill and task reminders" is hidden.
- No location: the briefing switches are off and disabled, with "Add a place"; no caption promises a briefing that will skip.
- While paused, never show the Skipped receipt; the evening status reads "Paused — nothing sent".
- The Skipped receipt appears only on a night when every check succeeded and nothing needed the person; never on a night with a pickup the next day.
- Loading: nothing for the first second; after 1 second, row skeletons in the final slots. No spinner.
- Many devices: the device line wraps.
- Two blocked groups: each blocked group gets its own line.
- The web briefing is on but this phone has no permission: the row states the per-device state.
- The per-home switches are gone from the home settings page. In their place is one row, "Notifications · Open", that opens this page.

INSTEAD OF
- Instead of per-home notification switches, draw this one page linked from the home settings, because those switches never saved anything.
- Instead of "Home Reminders", draw "Dates & bills" with two switches, because people with no home get these too, and muting dates must not mute bills or tasks.
- Instead of a segmented AQI control, draw three single-choice rows with meanings, because segments truncate at large text.
- Instead of a 151 default, select 101, because the server alerts at 101.
- Instead of a switch that shows ON while the OS blocks it (as the Foundations specimen draws it), draw it off and disabled with the blocked line and the saved-choice caption, because a switch that pretends is worse than no switch.
- Instead of Push/Email/SMS chips on every row, draw one switch per kind, because Pantopus notifies by push only (email is only for sign-in, invitations and bookings, and there is no SMS), and a chip that controls nothing is a switch that pretends.
- Instead of Pause all or Quiet hours, rely on iOS Focus, Android Do Not Disturb and "Pause briefings until…", because an app-wide pause would hold back the air alerts that are meant to come through Focus.
- Instead of leaving the notifications the five loop groups don't cover without a switch, give each one a switch under Nearby or Mail, because someone who cannot mute one kind turns off everything, pickup reminder included.
- Instead of a keeper group or a "Tips and news" switch, draw no such rows, because Pantopus never sends marketing or keeper notifications.
- Instead of helper text in the group footer, put it directly under the master or header, because people read one switch at a time.
- Instead of a toast after a save, draw "Saved" under the row, because status must be announced where the change happened.

DONE WHEN: Every notification type maps to exactly one switch (the Notes mapping has no gaps). The air threshold matches what the server sends. No switch reads or is announced as ON while the OS blocks it. The evening row states the silence promise and when it last sent, never shows a skip while paused, and never shows a skip before a pickup day. Flow check: from an air alert's "Turn these off" on iPhone, Maya lands on the Air group with focus there, picks "Very Unhealthy · AQI 201 and up", sees "Saved", and the pickup reminder is untouched.

ARTBOARDS
1. f4-notification-settings · web-1440 · 01-default · light: the full dense page with all seven groups and the migration line; "Tasks completed" shows "Saving…" under it.
2. f4-notification-settings · ios · 02-default · light: the same content as a grouped inset list, threshold selected with a trailing checkmark; "Calendar events added" shows "Saved" under it.
3. f4-notification-settings · android · 03-default · light: the same content as an M3 preference list with radio buttons.
4. f4-notification-settings · web-1440 · 04-home-settings-link · light: the existing home settings page with the per-home switches removed and one row "Notifications · Open" in their place.
5. f4-notification-settings · ios · 05-os-denied · light: the pinned banner; every switch off and disabled, with the saved-choice caption under each one Maya had on; the widget offered once inside the banner; the Briefings widget row hidden.
6. f4-notification-settings · android · 06-channel-blocked · light: the Air group off and disabled, reading "Off in Android settings · Open", its saved threshold kept; other groups normal.
7. f4-notification-settings · ios · 07-summary-and-time-sensitive · light: the Scheduled Summary caption on Evening briefing, and the Time Sensitive line on the Air group.
8. f4-notification-settings · ios · 08-landing-air · light: arrived from "Turn these off" on the air alert row in Mail; the Air group is highlighted with focus on its header, and "Very Unhealthy · AQI 201 and up" is selected with "Saved" under it (Maya's tap after landing; the landing itself changes nothing).
9. f4-notification-settings · web-390 · 09-saved-place · light: the PLACE B variant.
10. f4-notification-settings · web-1440 · 10-no-location · light: briefing switches off and disabled, with "Add a place".
11. f4-notification-settings · web-1440 · 11-timezone-and-paused · light: the Mountain Time caption under the Briefings header, "Paused until Mon 26 Oct · Resume", and the evening status "Paused — nothing sent".
12. f4-notification-settings · web-1440 · 12-quiet-night · light: Wed 21 Oct, 6:10 PM (delta), not paused, every check succeeded. The evening row reads "Skipped tonight — nothing needed you" above "Last sent Mon 19 Oct, 6:00 PM · pickup".
13. f4-notification-settings · web-1440 · 13-loading · light: row skeletons in the final group slots (shown after 1 second).
14. f4-notification-settings · web-1440 · 14-save-error · light: Evening briefing reverted to its last saved value, with the InlineErrorRow.
15. f4-notification-settings · web-390 · 15-worst-case-and-offline · light: the web blocked banner, the migration line, the paused caption and the OfflineNotice together; switches off and disabled with saved-choice captions and "Saving needs a connection."
16. f4-notification-settings · web-1440 · 16-browser-blocked · light: the web banner with "Show me how".
17. f4-notification-settings · ios · 17-ax5 · light: the Air group at AX5, with threshold rows and meanings wrapping and switches below labels.
18. f4-notification-settings · android · 18-greyscale · light: frame 3 in greyscale.
19. f4-notification-settings · ios · 19-default · dark: the dark twin of frame 2.
20. f4-notification-settings · ios · 20-os-denied · dark: the dark twin of frame 5.
21. Notes. List:
  - assumptions, including that Maya granted on this iPhone before Sat 17 Oct (the primer project shows a different first-ask moment), that the Sat 17 Oct AQI 176 alert is a delta, and that frame 12 is set on Wed 21 Oct (delta);
  - defaults after a new grant: evening on, morning off, air on at 101, dates & bills on only where a reminder is set, household activity off, account on;
  - the switch map: evening and morning briefings (incl. pickup) → their Briefings switches; AQI and NOAA → Air master and threshold; date reminders → Date reminders; bill reminders, task reminders and task_assigned ("tasks given to you") → Bill and task reminders; bill_paid → Bills marked paid; task_completed → Tasks completed; home_event_created → Calendar events added; joins and leaves → People joining or leaving; sign-ins and invitations to you → Sign-ins and invitations to you; neighbor messages and replies → Messages; post comments, likes, reposts, comment replies, new followers and connection requests → Posts and follows; listing offers, trades, questions and saved-search matches → Marketplace; bids, gig lifecycle, payments, payouts, disputes and change orders → Gigs and payments; mail (new, urgent, delivered, summary) → Mail; beacon broadcasts → Beacons you follow; confirm that tasks belong under Dates & bills;
  - date reminders are controlled only by Dates & bills; the morning briefing only shares their send time;
  - the morning no-repeat rule exempts the weather lead-in, which can repeat;
  - Foundations 00d-06 settings-row specimen draws the switch on; correct it to off/disabled to match research ("a switch never reads ON when nothing can be delivered");
  - "Turn these off" opens the group rather than switching it off; confirm the label;
  - "Tasks completed" notifies only for tasks you created, when someone else completes them;
  - every invented string (master helper, device line, the delivery lines, captions, "Bill and task reminders" and its helper, "People joining or leaving", both blocked-row lines, the saved-choice caption, Time Sensitive line, web banner, offline line, "Notifications · Open", "Manage these", "Saving needs a connection.", "Paused — nothing sent", "Pause briefings until…", ?group= values);
  - the EPA meaning lines are EPA's own health statements; confirm them against current AirNow text;
  - omitted states;
  - every removal from the A14.5 concept; that Quiet hours and Briefing location are shipped settings this page drops (briefing times, Pause briefings and the Your places list replace them), for the founder to confirm, with the migration keeping "Nothing you turned off was turned on"; and that Messages, Posts and follows, and Marketplace have no server switch today, so they need one;
  - open calls:
    - the threshold control depends on the backend storing a per-user threshold;
    - whether the master switch stays once each group has its own switch;
    - whether Account & security can be switched off;
    - Account & security is Time Sensitive in the notification model, so it can also come through Focus, but only the Air group says so here;
    - whether Household activity may be tried with iOS quiet delivery ("Quiet delivery — Notification Center only");
    - the brief adds a timezone only outside Pacific time, so the default frames carry no timezone caption.

BATCH PLAN
Turn 1: artboards 1-6, then wait for "continue".
Turn 2: artboards 7-12, then wait for "continue".
Turn 3: artboards 13-18, then wait for "continue".
Turn 4: artboards 19-21.
