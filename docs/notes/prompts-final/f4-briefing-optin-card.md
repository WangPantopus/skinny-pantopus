# Briefing opt-in (morning + night-before, one card)
id: f4-briefing-optin-card · platforms: web/ios/android · isNew: False · artboards: 28

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Briefing opt-in card · f4-briefing-optin-card

TYPE: EXTENSION of the existing designed screen "Today". You are adding one card. This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. On web, this card replaces the old morning-only opt-in in the home-only Place > Today detail. That route is folded into Today, so draw nothing in that old location.

ATTACH:
- Populated Today on web 390, iOS 393, Android 412 and web 1440, at HOME A and at PLACE B, with the pickup card and the FirstWeekRow visible.
- The Today empty state "Today starts with a place".
- Exports of the Foundations boards 00a–00d.

PLATFORMS & VIEWPORTS: Web 390x844 (primary). iOS 393x852. Android 412x915. Web 1440x900.

WHERE IT LIVES & HOW PEOPLE ARRIVE
Today tab → Today. The card sits below the day's content and above the FirstWeekRow ("Next: …"). It shows for anyone with a place, whether a saved place or a claimed home. Owning or verifying a home is not required.
Entry points:
- Scrolling Today.
- Returning to Today after the pickup card's inline reminder ask.
  - While that ask is open, the night-before row is hidden.
  - If the person said yes there, the night-before row is already collapsed to "The night before pickup · 6:00 PM · Change". It shows the time they never chose, so they can change it.
  - If they tapped "Not now" or "No thanks" there, the night-before row counts as declined. It is absent here and reachable only in Notification settings, while the morning row still asks.
  - In every case, the card does not re-ask and does not scroll.
- Notification settings, the card's durable twin. The card's "Notification settings" link and each row's "Change" open it at Briefings.
Hand-offs:
- "Yes" on a row opens the system permission dialog directly (the browser's dialog on web). There is never a second primer.
- A grant saves the default at once and expands that row's time chips.
- Turning on either row moves the FirstWeekRow to its next step.

WHO AND WHEN
- Maya Chen at HOME A, Mon 19 Oct, 6:10 PM, scrolling past tomorrow's pickup card. Assume Maya also has a saved place, so she has more than one place.
- Jordan Lee at PLACE B, who has only saved his address.
- Maya again, on her iPhone, after turning briefings on in the web app.

THE ONE JOB: Let anyone with a place turn on the night-before and morning briefings right here, and say honestly what will and won't arrive.

FIRST FIVE SECONDS: The eye lands on three things, in this order: (1) the overline "Briefings" and the first row's question "The night before pickup?", (2) its caption "Pickup comes with the evening briefing (6:00 PM)", (3) the silence line. Each row has one decision, "Yes", with equal-weight declines beside it.

CONTENT (deltas to FIXTURES)
The card opens with the overline "Briefings", then (only for people with more than one place) the caption "For 2418 NE Larkspur Loop", then two list rows, then a footer. Maya's frames show that caption; Jordan's do not.
- Row 1: "The night before pickup?". Caption "Pickup comes with the evening briefing (6:00 PM)"; the time in brackets follows the selected chip. Buttons "Yes", "Not now", "No thanks". Chips after Yes: 5:00 PM · 6:00 PM (selected) · 7:00 PM · 8:00 PM.
- Row 2: "A morning heads-up?". Caption "Date reminders at 7:00 AM"; the time follows the selected chip. The same three buttons. Chips: 6:30 AM · 7:00 AM (selected) · 7:30 AM · 8:00 AM.
- Grant status: "Saved · 6:00 PM".
- Silence line, printed once for the card: "Only when something needs you. No news means nothing's up."
- Footer link: "Notification settings".
- Collapsed on-rows: "The night before pickup · 6:00 PM · Change" and "Morning briefing · 7:00 AM · Change".
- Morning grant that also turns on the evening briefing (frame 4): the night-before row collapses to "The night before pickup · 6:00 PM · Change" with the status "Also on: the night before pickup".
- Quiet-night receipt, dated Wed 21 Oct, 6:10 PM: "Checked 6:00 PM · nothing needs you tonight".
- Saved place, PLACE B, pickup day not set. Row 1 caption: "Pickup joins once you confirm your pickup day. Until then, it covers your dates due tomorrow."
- Declined in the card: "Not now" shows the InlineUndo "No reminder for now · Undo". "No thanks" shows "You can turn this on in Notification settings · Undo". These match the pickup card.
- On in the app but blocked by the system: an amber glyph with the text.primary line "Notifications are off for Pantopus" and the button "Open settings". On web: "Notifications are off for Pantopus in this browser" with "How to turn them on".
- OS permission already denied (declined anywhere, before this visit): the rows show normally. Only after the person taps a row's "Yes" does that row swap to the text.secondary line "Notifications are off for Pantopus" (no amber) with "Open settings" (iOS, Android blocked) or "How to turn them on" (web). If the denial happened in this visit's own dialog, use the declined-at-system collapse below instead.
- Declined at the system dialog:
  - Native: the card collapses to one text.secondary line, "Pickup still shows here on Today · Or put it on your home screen", with "Show me how", shown once. When the decline came from the morning row, or the place has no pickup day, the line reads "Your dates still show here on Today · Or put it on your home screen".
  - Web: the card collapses to "Pickup still shows here on Today" (or "Your dates still show here on Today" in the same two cases), with no widget offer and no settings link, shown once.
- On for web, not on this phone (iOS): "The night before pickup · On in your browser" with "Turn on for this iPhone".
- Timezone caption "Pacific Time", shown only when the device is outside Pacific time. One frame has the device set to Eastern Time.
List every string you invent on the Notes artboard.

LAYOUT & VISUALIZATION
Draw one card on surface.base. At the top is the overline "Briefings" (overline 11/16 caps), with the "For 2418 NE Larkspur Loop" caption (caption 12/16 text.secondary) under it on Maya's frames. Below it are two stacked list rows, each at least 56pt tall.
- Each row holds the question in body, the caption in bodySmall text.secondary, and a button row beneath.
- "Yes", "Not now" and "No thanks" are three equal outlined buttons, each at least 44pt, 48dp or 44px.
- On grant, the row expands in place into one ChoiceChip row directly beneath it. The card grows and Today reflows. Use no modal and no separate time picker.
- Chip hit areas are at least 44pt on iOS, 48dp on Android with 8dp gaps, and 44px on web.
- When both rows are on, each collapses to one value + Change line. The card shrinks to about a third of its expanded height, so Today gets quieter as the person commits.
- The amber line sits above both rows, full width. It appears only when a row is on and the system blocks delivery, so a row never reads on beneath an unread warning.
- The silence line and the receipt sit at the foot of the card, above the settings link. The receipt one-liner appears only when both rows are on and Today's full QuietDayReceipt is not visible on the same screen.
- Frame 5 composition: Today is scrolled so the card is in view and Today's full QuietDayReceipt has scrolled off above the top edge; that is why the one-liner shows.

INTERACTION, MOTION & HAPTICS
- "Yes" opens the system dialog.
  - On grant, the default saves at once ("Saved · 6:00 PM"), and the row expands its chips in under 300ms. Under Reduce Motion, use a cross-fade. Focus stays on the row.
  - The chips stay open until the person leaves Today. After that, the row shows its collapsed line.
  - A grant from the night-before row turns the evening briefing on.
  - A grant from the morning row turns the morning briefing on. It also turns on the evening briefing only when the night-before row has never been answered; the night-before row then collapses to "The night before pickup · 6:00 PM · Change" with the status "Also on: the night before pickup" (frame 4). If the night-before row was declined, here or on the pickup card, the grant turns on the morning briefing only. Nothing the person turned off is ever turned on.
  - Once permission is granted, the other row's Yes switches that row on directly, with no dialog.
  - Android: after a first denial, "Yes" re-asks once. After that the permission is blocked, and only "Open settings" is offered.
  - iOS: "Open settings" opens the Pantopus notification page.
- Tapping a chip saves at once, showing "Saving…" then "Saved" as polite live-region text on the row.
- Declines:
  - "Not now" hides the row and never asks again on its own; it can be offered again only when the person opens that briefing from the place file.
  - "No thanks" is permanent until changed in Notification settings.
  - Both are stored on the server, so another device does not ask again.
  - Both show their InlineUndo until the person leaves Today, then the slot closes.
- Native: play one light tick only when a save succeeds.

FOUNDATIONS COMPONENTS USED: NotificationAsk (card row form; time chips expansion; states: never asked, granted, declined, switch on but OS blocked, saving/Saved/Couldn't save), ChoiceChip (time), QuietDayReceipt (widget one-liner variant), InlineUndo (declined ask), InlineErrorRow (save failed), OfflineNotice, FirstWeekRow (neighbour; advances to its next step once a row is on).

ACCESSIBILITY
- Reading order: amber line (if present), overline, place caption, row 1 and its chips, row 2 and its chips, silence line, receipt, settings link.
- Chips show selection with a check and a fill, not colour alone. Focus looks different from selection.
- At AX5, chips become radio rows and the three buttons stack.
- Spoken labels:
  - Rows: "Night-before briefing, off. Pickup comes with the evening briefing at 6 PM." and "Night-before briefing, on, 6 PM. Change."
  - Yes buttons (visible text first): "Yes, turn on the night-before briefing" and "Yes, turn on the morning briefing".
  - "Not now" and "No thanks" keep their visible text as their names, with the row question as context.
- Status is announced without moving focus.

COPY: Use every string in CONTENT, plus these.
- Save error: "We couldn't save your briefing time" with "Retry". The row keeps its last saved value.
- Offline: "You're offline · as of 6:02 PM", with "Changing briefings needs a connection." under the disabled controls.
- No place: the card is absent, and Today shows "Today starts with a place" / "Save an address and Today will show its weather, air, alerts and dates." / "Preview an address".

EDGE CASES
- Both rows expanded at once at 390 wide: the chips wrap to two lines instead of scrolling.
- One row on and one off; both on; both declined (the card is absent).
- A saved place without a pickup day: the evening row still works for dates due tomorrow, and pickup is never promised. Bills are never mentioned for a saved place.
- Air alerts are a separate group and are never promised by this card.
- The device is outside Pacific time.
- Permission is granted on web but not on this phone.
- A slow save keeps the chip selected with "Saving…" and shows no spinner card.
- The receipt never shows while a check is pending or failed.

INSTEAD OF
- Instead of two separate opt-in cards or a modal, draw one titled card with two rows that expand in place, because competing asks create a ranking problem and a modal trains dismissal.
- Instead of a primer with its own "Yes" or "Allow", send "Yes" straight to the system dialog, because a second yes is redundant.
- Instead of a permanent amber banner, or a settings link shown before anyone tapped, for someone who declined, show the rows normally and explain only after they tap Yes (or collapse to one neutral line after a fresh decline), because repeated pressure after a denial goes against Android guidance.
- Instead of a row that reads on while the system blocks delivery, show the amber line above the rows, because the card must match what the device will deliver.
- Instead of asking about the night before after the pickup card already asked, hide or skip that row, because a "Not now" must never ask again.
- Instead of a morning grant silently switching on a night-before reminder the person declined, turn on only the morning briefing, because nothing they turned off may be turned on.
- Instead of gating either row behind claiming or verifying a home, show both to anyone with a saved place, because the night-before briefing is how a saved place counts toward activation.
- Instead of "6:00pm" and an always-on "Pacific Time.", write "6:00 PM" and show the timezone only outside Pacific time, because the house microcopy says so.

DONE WHEN
- A saved-place user can turn on either briefing from Today in two taps: "Yes", then the system prompt.
- Each row always matches this device's real permission.
- A declined ask, here or on the pickup card, never reappears on its own, is never switched on by the other row, and can be turned on again from settings.
- Anything switched on as a side effect is visible on the card.
- The saved-place caption promises only what the evening briefing delivers.
- The silence line and receipt make a quiet night read as finished work.
- Every frame reads correctly in greyscale and at AX5.

ARTBOARDS
1. f4-briefing-optin-card · web-390 · 01-never-asked · light — dense default under a populated Today at HOME A, "For 2418 NE Larkspur Loop", night-before row first
2. f4-briefing-optin-card · web-390 · 02-yes-time-chips · light — night-before row expanded, 6:00 PM selected, "Saved · 6:00 PM"
3. f4-briefing-optin-card · web-390 · 03-one-on-one-off · light — evening collapsed, morning still asking
4. f4-briefing-optin-card · web-390 · 04-morning-grant-evening-also-on · light — morning chips open, night-before row collapsed with "Also on: the night before pickup"
5. f4-briefing-optin-card · web-390 · 05-both-on-collapsed · light — Wed 21 Oct receipt one-liner, Today scrolled so its full QuietDayReceipt is off the top
6. f4-briefing-optin-card · web-390 · 06-saved-place · light — PLACE B, dates-due-tomorrow caption, no place caption
7. f4-briefing-optin-card · web-390 · 07-pickup-ask-declined · light — night-before row absent, morning row asking
8. f4-briefing-optin-card · web-390 · 08-saving · light
9. f4-briefing-optin-card · web-390 · 09-save-error · light
10. f4-briefing-optin-card · web-390 · 10-on-but-blocked · light — amber line above rows
11. f4-briefing-optin-card · web-390 · 11-declined-undo · light — "No reminder for now · Undo" on row 1, "You can turn this on in Notification settings · Undo" on row 2
12. f4-briefing-optin-card · web-390 · 12-declined-at-browser · light — one neutral line, no widget offer
13. f4-briefing-optin-card · web-390 · 13-yes-tapped-while-denied · light — row 1 swapped to the neutral line with "How to turn them on"; row 2 still asking normally
14. f4-briefing-optin-card · web-390 · 14-slot-closed · light — Today with the card absent
15. f4-briefing-optin-card · web-390 · 15-no-place · light — Today starts with a place
16. f4-briefing-optin-card · web-390 · 16-offline · light
17. f4-briefing-optin-card · ios · 01-never-asked · light
18. f4-briefing-optin-card · ios · 17-declined-at-os-widget-offer · light — "Pickup still shows here on Today · Or put it on your home screen" with "Show me how"
19. f4-briefing-optin-card · ios · 10-on-but-blocked · light — Open settings
20. f4-briefing-optin-card · ios · 18-this-phone-not-on · light — also shows the Eastern Time caption
21. f4-briefing-optin-card · android · 19-denied-once-reask · light — Yes re-asks once
22. f4-briefing-optin-card · android · 10-on-but-blocked · light
23. f4-briefing-optin-card · web-1440 · 01-never-asked · light
24. f4-briefing-optin-card · ios · 20-ax5 · light — chips as radio rows, stacked buttons
25. f4-briefing-optin-card · web-390 · 21-greyscale · light — frame 2 in greyscale
26. f4-briefing-optin-card · web-390 · 01-never-asked · dark
27. f4-briefing-optin-card · web-390 · 10-on-but-blocked · dark
28. f4-briefing-optin-card · Notes — this list:
- Invented strings and assumptions, including "For 2418 NE Larkspur Loop", "Also on: the night before pickup", "Your dates still show here on Today · Or put it on your home screen", and the rule that "Not now" can be re-offered from the place file. Maya is assumed to have a saved place too.
- Dependency: web "Yes" needs a new web briefing push channel; today the only browser opt-in is Mail Day.
- Dependency: the iOS app's launch-time notification permission request must be removed; otherwise most iOS users arrive already asked, and frame 18 never occurs.
- Removed location: the old Place > Today morning opt-in is removed because that route is folded into Today; no pointer is needed once the route is gone.
- Casing: "Open settings" is sentence case (the contract writes "Open Settings").
- "Yes" is kept as an answer to the row question (the NotificationAsk board's open question on a verb-led label still stands); its accessible name is verb-led.
- Widget offer: the flow-07 string with "Show me how" overrides the NotificationAsk board's declined-state row ("Put Today on your home screen" / "Add the widget"); the pickup card uses the same "Show me how".
- Rules: the receipt one-liner vs the full QuietDayReceipt; a decline on the pickup card counts for the night-before row; a morning grant turns on the evening briefing only if the night-before row was never answered.
- Omitted: iOS and Android both-on (same as web frame 5); pickup ask still open (drawn in the pickup card prompt).

BATCH PLAN
Turn 1: 1-6, then wait for continue.
Turn 2: 7-12, then wait for continue.
Turn 3: 13-18, then wait for continue.
Turn 4: 19-24, then wait for continue.
Turn 5: 25-28.
