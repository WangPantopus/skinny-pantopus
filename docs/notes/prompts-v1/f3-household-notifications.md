# Household activity notifications (rows, channel, routing)
id: f3-household-notifications · platforms: web/ios/android · isNew: False · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

THIS IS AN EXTENSION of the existing screens "Notifications" (the in-app list) and "Notification settings" - these already exist and are already designed in the Pantopus design system - open them, keep everything, and change only what is listed below.

PLATFORMS: web 1440x900 and 390x844, iOS 393x852, Android 412x915.

WHERE IT SITS: not a fifth tab. The in-app list is a stack pushed over whichever of the four tabs the reader is on, opened from the header bell (web: /app/notifications from the sidebar). The OS push tray is the other entry, and every row deep-links back into Place or Today. Settings reached from Notification settings -> "what you'll get".

THE ONE JOB: make "Sam marked the water bill paid" arrive, read clearly, and land on the exact thing it describes.

CONTENT - the reader belongs to two homes, "Maple St" (1428 NE Maple St, Camas WA 98607) and "Cedar Ave" (2207 SE Cedar Ave, Vancouver WA 98664), so the home label is present on every row. Today is Sep 16 2026. Draw all five types: bill_paid - "Sam marked the Clark PUD bill paid" / "$84 - due Sep 20 - Maple St" -> the bill. task_completed - "Priya finished Change HVAC filter" / "Today - Maple St" -> the task. home_event_created - "Dana added Chimney sweep to the calendar" / "Sat Nov 14, 9:00 AM - Maple St" -> the calendar. calendar_date reminder - "Garbage + recycling is tomorrow (not yet confirmed)" / "Wed Sep 17 - Camas city schedule - Maple St" -> Today with the rule highlighted. bill reminder - "Clark PUD is due Sunday" / "$84.00 - Maple St" -> the bill. Grouped row: "Sam paid 3 bills" / "Clark PUD, City of Camas, NW Natural - $263 - Maple St". Push-off banner: "Push is off. You'll still see these here." + "Turn on". Gone-target copy: "That bill was removed."

THE VISUALIZATION DECISION: two-line rows. Line 1 is a 28px initials avatar plus the sentence with the actor's name FIRST. Line 2 is a middot-separated caption: amount - date - home label, the home label appearing only when the reader belongs to more than one home. Unread is a single 6px dot in a fixed leading column - not a bold row, not a tinted row background - so fourteen unread items are still readable as a list. Reminder rows carry the same provenance mark as the calendar row they came from, at the end of line 2: FILLED = official/confirmed, HOLLOW = on record but unconfirmed, FILLED-WITH-TICK = you entered it - an unconfirmed deadline is unconfirmed in the tray too. A same-day group is ONE expandable row with the count in the sentence and the payees in the caption, never three rows. Also draw the OS push tray rendering of the reminder on iOS and Android with the caveat carried in the TITLE. And draw the settings list with "Household activity", "Security", "Reminders" and "Briefing" as separate channels, each with an example line, so muting co-resident chatter cannot mute security alerts.

WHY (do not optimise this away): a mark cannot travel in a notification tray, so for push only, the caveat rides the title - the body tail is where truncation eats it.

STATES TO DRAW, each its own frame:
1. Unread list (all five types, dense).
2. Read.
3. Push disabled at OS level - in-app twin present, one banner.
4. Same-day grouping, collapsed and expanded.
5. Landing target resolves.
6. Landing target gone - graceful fallback to the list, never a blank screen.
7. T1 saved-place routing vs T3 home routing - two rows side by side, one labelled "Saved place - Only you", one labelled "Maple St".
8. OS push tray, iOS and Android, reminder type.
9. Error.
10. Offline.

DO NOT: do not put the unconfirmed caveat at the end of the push body where truncation eats it; do not signal unread with a bold row or a coloured row fill; do not file household rows into the system or security channel; do not land a row on a generic list when the specific object exists, and never land on a blank screen when it does not.
