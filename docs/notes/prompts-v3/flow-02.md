# flow-02 · Weekly pickup loop: push or no push, confirm, correct, holiday move (journey storyboard)
id: flow-02 · platforms: ios/android/web-390 · artboards: 17

# flow-02 · Weekly pickup loop (journey storyboard)

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

TYPE: NEW (storyboard). Every screen in this journey already has its own designed project. Do not redesign any screen. Lay the screens out as one connected journey, redraw only the deltas listed for each frame, and draw the connections: trigger arrows, time gaps, moment-of-truth callouts, failure branches and the points where they rejoin.

ATTACH (exported artboards, by exact name):
- f1-today-tab · ios · 02-saved-place-quiet · light
- f1-today-tab · ios · 05-from-push · light
- f1-today-tab · ios · 15-foreground-push · light
- f4-today-pickup-card · ios · 02-confirmed-by-sam · light
- f4-today-pickup-card · ios · 04-corrected-just-now · light
- f4-today-pickup-card · ios · 05-holiday-move · light
- f4-today-pickup-card · ios · 06-saved-place-unconfirmed · light
- f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now · light
- f4-today-pickup-card · ios · 14-offline · light
- f4-today-pickup-card · ios · 15-stale · light
- f4-today-pickup-card · ios · 16-notifications-denied-widget-offer · light
- f4-today-pickup-card · ios · 18-declined-undo · light
- f4-today-pickup-card · ios · 20-arrived-from-push · light
- f4-today-pickup-card · ios · 21-tray · light
- f4-today-pickup-card · android · 21-tray · light (the Android inset beside F01)
- f4-today-pickup-card · android · 22-reminder-ask-denied-once · light
- f4-today-pickup-card · android · 23-reminder-ask-blocked · light
- f4-today-pickup-card · web-390 · 01-unconfirmed · light
- f5-today-calendar-strip · ios · 01-ready-dense · light
- f5-today-calendar-strip · ios · 03-saved-place-unconfirmed · light
- f5-today-calendar-strip · ios · 04-holiday-move · light
- x-date-sheet · ios · 03-pickup-weekly-saved-place · light
- x-date-sheet · ios · 04-pickup-view-mine-household · light
- x-provenance-sheet · ios · 02-report-schedule · light
- x-provenance-sheet · ios · 15-reopened-self-fixed-checking · light
- x-provenance-sheet · ios · 17-report-failed · light
- x-provenance-sheet · ios · 26-ax5-place-b · light (source of the PLACE B payload strings only)
- f4-briefing-optin-card · ios · 01-never-asked · light
- f4-briefing-optin-card · web-390 · 03-one-on-one-off · light
- f4-briefing-optin-card · web-390 · 07-pickup-ask-declined · light
- f4-briefing-optin-card · ios · 10-on-but-blocked · light
- f4-briefing-optin-card · ios · 17-declined-at-os-widget-offer · light (source of the artboard 06 glance line)
- f4-notification-primer · ios · 01-default-pickup · light (HC10 thumbnail only)
- f7-today-widget · ios · 05-evening-confirmed · light
- f4-notification-settings · ios · 05-os-denied · light
- f4-notification-settings · ios · 07-summary-and-time-sensitive · light
- f4-notification-settings · web-390 · 09-saved-place · light
- f4-notification-settings · web-1440 · 12-quiet-night · light (row pattern only; draw it in iOS chrome)
- x-place-file · ios · 02-saved-place-first-week · light
- The Foundations boards (prompts 00a, 00b, 00c, 00d).
Where a frame below says REDRAW, start from the named export and change only the listed deltas. Where it says NO EXPORT, draw it faithfully from the description, using Foundations components only. Do not wait for missing exports.

PLACE B VALUES (the "PB swaps")
Several exports below were drawn for Maya at HOME A. Whenever a frame in Jordan's lane says "with PLACE B values", apply every one of these swaps, and never let a HOME A string into Jordan's story:
- Tuesday becomes Thursday; "Yes, Tuesday is right" becomes "Yes, Thursday is right".
- Waste Connections becomes City of Camas.
- "Your household" becomes the ScopeChip "Saved place · Only you"; "Everyone in this household will see this." becomes "Only you will see this.".
- No "Larkspur Loop" and no "2418 NE Larkspur Loop" anywhere; the location row reads "1107 NE Birchfield Ct".
- "You added this · Tuesday" becomes "You added this · Thursday"; no "Sam" or "Maya" appears.

PERSONA & SITUATION
Two people, two lanes, one weekly loop.
- Lane A: Maya Chen, the owner and viewer at HOME A, 2418 NE Larkspur Loop, Vancouver, WA 98684 ("Your household", label "Larkspur Loop").
  - HOME A timeline used here (a proposed fixture delta, see HC17 and Notes): claimed Sat 26 Sep 2026 at move-in; Sam Ortega (member) joined Thu 1 Oct; Sam confirmed Tuesday on Sat 3 Oct.
  - Her pickup day is confirmed, so the card shows the FILLED mark: "● Confirmed by Sam on Sat 3 Oct · Tuesday".
  - Garbage goes out every Tuesday. Recycling goes out every other Tuesday, next on Tue 20 Oct (so also Tue 6 Oct and Tue 22 Sep), which makes Tue 29 Sep and Tue 27 Oct garbage only. The hauler is Waste Connections, and carts must be out by 6:30 AM.
  - Her evening briefing is on at 6:00 PM on her iPhone. She also has a saved place, so her pushes carry the street label.
  - Maya is assumed activated under §5 (her pickup rule and briefing were in place within 7 days of Sat 26 Sep), so her returns count in the "among activated" block.
  - TODAY is Mon 19 Oct 2026. The push arrives at 6:00 PM, and she opens it at 6:10 PM.
- Lane B: Jordan Lee, 36, tier T1, at PLACE B, 1107 NE Birchfield Ct, Camas, WA 98607 ("Saved place · Only you").
  - He moved from Portland on Fri 9 Oct and saved the place on Sat 10 Oct, so his 7-day first week ended Sat 17 Oct and FirstWeekRow never shows in this journey.
  - His City of Camas pickup day is Thursday (HOLLOW, on record, not confirmed), and his recycling frequency is Not set.
  - He has never turned notifications on and has never answered the briefing card. Pantopus never pushes a saved place's pickup until the person sets the day, so no pickup push can reach him yet.
  - He opens Today most evenings out of habit. From the City of Camas move-in packet and the carts on his street, he knows recycling goes out with garbage every Thursday.
- Holiday: Thanksgiving is Thu 26 Nov 2026. The illustrative move is to Fri 27 Nov. Label it in every frame that shows it as the city's published holiday schedule, "City of Camas 2026 calendar", and list it on Notes as a fixture to verify against the real City of Camas calendar.

GOAL: With or without notifications, know every week whether tonight is a recycling-and-garbage night or garbage only. Fix a wrong or incomplete city schedule once, so it stays fixed. Get the reminder on the right night, including in a holiday week.

§5 METRIC THIS JOURNEY MOVES
- Honesty (bar: 0). No push may fire on a guessed schedule as if it were confirmed. The honesty counter reads DailyBriefingDelivery rows whose pickup signal carried confidence 'unverified', plus every user report tagged "not my schedule".
- Returns by trigger (§5 week-one/four/eight buckets): session_open with meta { trigger: 'push' | 'widget' | 'organic', kind: 'pickup' }. Beside each session_open caption, print the week since account creation and whether it falls in a §5 bucket. Jordan's day 0 is Sat 10 Oct: Mon 19 Oct and Wed 21 Oct are week 2, Wed 28 Oct is week 3, and Wed 25 Nov and Thu 26 Nov are week 7, so none falls in a §5 bucket. Maya's day 0 is assumed to be Sat 26 Sep, so Mon 19 Oct is week 4 (bucket: week-four; Maya assumed activated).
- Confidence values: §5 defines AddressCalendarRule confidence as 'official' or 'unverified' only. A household-confirmed or user-set rule is printed as "confidence official (household- or user-set)". A separate 'confirmed' value is a proposal on Notes, not drawn.

EVENT CAPTIONS
Under every frame, print the event it writes as a caption, exactly as listed on that frame below. If a frame lists no event, print "no event". Never invent an event name. Names marked "(invented)" are proposals and go on Notes.

THE HAPPY PATH

Lane A — Maya, confirmed household schedule, notifications on

F01 · iOS · ext:os-push-tray (lock screen) · Mon 19 Oct, 6:00 PM. REDRAW from the confirmed inset of f4-today-pickup-card · ios · 21-tray, placed on plain lock-screen chrome.
- Shows: title "Recycling + garbage tomorrow" and body "Bins out tonight · Larkspur Loop". Annotation outside the inset: "iOS Active · Briefings group · no action".
- Beside it, a smaller inset from f4-today-pickup-card · android · 21-tray with the same strings, annotated "Android DEFAULT · no action".
- Does: taps it at 6:10 PM.
- Carries: pantopus://today?section=pickup (web /app/today?section=pickup), deliveryId, kind=evening. Delivery row: pickup signal, confidence official (household-set).
- Event: DailyBriefingDelivery · sent · confidence official (household- or user-set).
- MOMENT OF TRUTH: One push a night. It names the bins, carries no house number and no caveat, because the day is confirmed.

F02 · iOS · f1-today-tab · 05-from-push. REDRAW with these deltas:
- The PickupCard uses the f4-today-pickup-card · ios · 02-confirmed-by-sam content.
- Remove the pinned line "From your 6:00 PM briefing · Also: Renters insurance renews tomorrow ↓". Every delivered item is in the first viewport, so the pinned slot takes no space (f1-today-tab rule b), and the PickupCard is highlighted in place.
- The 14-day card is f5's 4-item variant ("Next 14 days: 4 items", as in F03), not the 6-item variant.
The frame shows:
- Location row "2418 NE Larkspur Loop" · "Your household" · "Updated 4m ago".
- PickupCard in the first viewport, highlighted once: "Recycling and garbage tomorrow" · "Bins out tonight — curbside by 6:30 AM (Waste Connections)" · "● Confirmed by Sam on Sat 3 Oct · Tuesday" · one text button "Change pickup day".
In the frame:
- Does: reads it, then scrolls to the 14-day card.
- Carries: nothing new.
- Event: session_open · trigger push · kind pickup · week 4 (bucket: week-four).
- MOMENT OF TRUTH: The card is the push, inside the app. A delivered item already on screen is highlighted in place and never repeated in the pinned slot.

F03 · iOS · f5-today-calendar-strip · 01-ready-dense. REDRAW with one delta: the Tue 20 Oct row caption reads "Sam · Tuesday · confirmed Sat 3 Oct" with the FILLED mark, and the Tue 20 cell marks are filled. This replaces "You · Tuesday · Waste Connections" with a tick.
- Shows: "Next 14 days: 4 items". The Tue 20 cell has two marks and the tonight outline. The Tue 27 cell has one mark, with the row "Garbage only · in 8 days · Tue 27 Oct". The Mon 26 statewide bar and Sam's HOA row "Sam added this · Sat 3 Oct" (tick) are also there.
- Does: taps the row "Recycling and garbage · Tomorrow". The row is the target, not the cell.
- Event: no event.
- MOMENT OF TRUTH: A combined day shows two marks and a garbage-only day shows one. Cells are not targets; rows are. (Sam confirming the city's rule is FILLED. Sam adding a new date is a tick with "Sam added this". See HC18.)

F04 · iOS · x-date-sheet · 04-pickup-view-mine-household. REDRAW with one delta: the caption reads "● Confirmed by Sam on Sat 3 Oct · Tuesday", matching F02 (it replaces "Sam · Tuesday, confirmed 3 Oct 2026").
- Shows: Pickup day, Tuesday, "Every other week". Next recycling chips: "Tue 20 Oct" (selected, set by Sam), "Tue 27 Oct" and "Another date". Preview: "Recycling and garbage · Tue 20 Oct", "· Tue 3 Nov", "· Tue 17 Nov". Then "Clear household schedule", the footer "Everyone in this household will see this." and Close.
- Does: taps Close. Nothing changes, because Close never commits.
- Event: no event.
- MOMENT OF TRUTH: The recycling anchor is a date a person chose, and anyone can see and check it. It is never worked out from the garbage day.

Lane B — Jordan, unconfirmed city schedule, notifications never on

F05 · iOS · f1-today-tab · 02-saved-place-quiet · Mon 19 Oct, 6:10 PM. REDRAW with one delta: remove FirstWeekRow and "Hide this", because the save was Sat 10 Oct.
- Shows: "1107 NE Birchfield Ct" · "Saved place · Only you". QuietDayReceipt "Nothing needs your attention today" with "Checked 6:00 PM · weather · air · alerts · your calendar" and the source times. The strip shows hollow marks on Thu 22 and Thu 29 and the "Set your pickup day" button. The briefing card has never asked.
- Does: reads it and leaves. No push arrived.
- Event: session_open · trigger organic · week 2 (no §5 bucket).
- MOMENT OF TRUTH: Silence reads as finished work. The heading shows only because all four checks succeeded.

GAP: "Two days later · Wed 21 Oct, 6:10 PM · no push (saved place, pickup day not set)"

F06 · iOS · f4-today-pickup-card · 06-saved-place-unconfirmed, inside Today. REDRAW from it with one delta: the read date becomes "read Thu 15 Oct 2026", to match F07.
- Shows: "Garbage tomorrow" · "Bins out tonight — curbside by 6:30 AM (City of Camas)" · "○ City schedule, not yet confirmed · City of Camas · 2026 collection calendar, read Thu 15 Oct 2026" · "Recycling: Not set". Buttons "Yes, Thursday is right" and "Change pickup day". Footer "Only you will see this. No night-before reminder until you confirm your day."
- Does: taps "Change pickup day", because recycling also goes out tomorrow.
- Carries: fact id, the PLACE B payload, scope saved place.
- Event: session_open · trigger organic · week 2 (no §5 bucket).
- MOMENT OF TRUTH: Both buttons carry identical weight. The source is named (City of Camas), and the caveat sits under the headline, so a screenshot never reads as confirmed.

F07 · iOS · x-provenance-sheet · schedule report view with the PLACE B payload. REDRAW from x-provenance-sheet · ios · 02-report-schedule, using the PLACE B strings from 26-ax5-place-b at default text size. The pickup card's "Change pickup day" opens the sheet directly at this view.
- Shows: title "Where this fact comes from" and Close. Header: hollow L mark, "Garbage · Thursdays", "Recycling frequency: Not set". Source "City of Camas schedule", Updated "Thu 15 Oct 2026". Covers "The City of Camas route that includes this address". ScopeChip "Saved place · Only you".
- Report area: heading "What's wrong?". "Set my pickup day" sits on top as the primary action. Under it is the checkbox "Also tell us the city's schedule looks wrong", ticked. Radio rows: "Wrong pickup day", "Wrong recycling week" (selected; it also covers a missing recycling week) and "Not my service". "Send report" is enabled.
- Behaviour, printed beside the frame: "With the box ticked, Set my pickup day sends the report and then swaps; Send report alone sends without swapping."
- Does: taps "Set my pickup day". The report sends first (a success tick mark, no haptic; see HC07). Then the sheet's content swaps to the DateSheet, with Back.
- Carries: weekday Thursday prefilled with its hollow mark, frequency Not set, Next recycling empty, the report id, and the tag "not my schedule".
- Event: report · tag not my schedule · status checking (invented; the same name flow-11 uses).
- MOMENT OF TRUTH: Fixing it yourself is the first path. The report is optional and does not end the flow.

F08 · iOS · x-date-sheet · 03-pickup-weekly-saved-place. REDRAW with these deltas:
- The prefilled caption reads "City of Camas · 2026 collection calendar", with no "recycling weekly".
- The frequency starts at Not set, and Jordan taps Weekly.
- The reminder line "Pickup reminders come with your evening briefing at 6:00 PM." is replaced by "Notifications are off. These show on Today and in your place file."
- The header has Back, because the content was swapped in from the ProvenanceSheet.
The frame shows:
- Seven weekday ChoiceChips, with Thursday selected, the hollow mark and "○ On record, not confirmed" printed once.
- "How often does recycling come?", with Weekly selected.
- Under "Next recycling": "Recycling and garbage · Thu 22 Oct", "· Thu 29 Oct" and "· Thu 5 Nov".
- Under "Next holiday change": "Recycling and garbage · Fri 27 Nov", with "Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar" and a struck ghost.
- "Use the city schedule again", the footer "Only you will see this." and Save.
In the frame:
- Does: taps Save. There is a spinner inside the button, then one light tick.
- Carries: the saved_place rule (Thursday, weekly, recycling weekly), which must outrank the city rule. The widget snapshot is rewritten, and the correction is counted.
- Event: pickup rule saved · scope saved_place (invented).
- MOMENT OF TRUTH: The frequency is his answer, never inferred. The holiday move is visible weeks ahead and labelled as the city's published schedule.

F09 · iOS · f4-today-pickup-card · corrected just now, PLACE B. REDRAW by combining 04-corrected-just-now and 07-saved-place-confirmed-just-now, with PLACE B values and these deltas: remove "Recycling: Not set", and the tray preview reads "Recycling + garbage tomorrow" / "Bins out tonight" (07 draws "Garbage tomorrow" / "Bins out tonight").
- Shows: headline "Recycling and garbage tomorrow" and "Bins out tonight — curbside by 6:30 AM (City of Camas)". SourceCaption "✓ You added this · Thursday". Status line "Saved to your calendar. Only you.". ProvenanceMark reported line "You reported this · checking". Footer "Only you will see this.".
- Inline reminder ask below the card: "Remind you the night before? 6:00 PM", then the sentence "Pickup the night before. Air alerts when it's unhealthy. Nothing else unless you turn it on." (delta, from the NotificationAsk contract). Then a PushCopy tray preview captioned "This is the whole thing." with "Recycling + garbage tomorrow" / "Bins out tonight" (no street label, because he has one place). Three equal outlined buttons: "Turn on reminders", "Not now" and "No thanks".
- Below: the briefing card, with its night-before row hidden and "A morning heads-up?" still asking.
- No primer sheet opens after this save (see HC10).
- Does: taps "Turn on reminders".
- Event: no event.
- MOMENT OF TRUTH: His correction appears in the pixels at once and survives a reload. If "Garbage tomorrow" with the city caption still renders here, stop: that is the SCOPE_RANK blocker (X09).
- Inset F10 sits beside this frame, with an arrow labelled "tap source row (later)".

F10 (inset) · iOS · x-provenance-sheet, reopened after the self-fix. REDRAW from 15-reopened-self-fixed-checking with PLACE B values.
- Shows: tick header "Recycling and garbage · Thursdays", caption "Recycling weekly". Source "You", Updated "Set Wed 21 Oct 2026". Confidence "You added this. You can change it at any time.". Covers "This saved place". ScopeChip "Saved place · Only you".
- Status block: "You reported the city's schedule · checking", then the receipt "Reported Wed 21 Oct. We'll check it against City of Camas by Wed 28 Oct and tell you here." Primary action "Set my pickup day".
- Event: no event.
- MOMENT OF TRUTH: The receipt says when the answer will come and where it will appear.

F11 · iOS · the system permission dialog, then the result.
- NO EXPORT for the dialog. Draw the standard iOS notification permission alert in greyed system chrome, labelled "system UI, not Pantopus". The arrow out of it is labelled "Allow".
- Result half: REDRAW the F09 ask area, collapsed to the status "Saved · 6:00 PM". The briefing card below now shows the collapsed row "The night before pickup · 6:00 PM · Change" (as in f4-briefing-optin-card · web-390 · 03-one-on-one-off, in iOS chrome), while "A morning heads-up?" still asks.
- Carries: evening briefing on at 6:00 PM. Air & weather alerts on at 101, the default after a new grant (flow-10). Date reminders only where a reminder is set.
- Event: evening_briefing_enabled (preference write; invented as an event name, proposed on Notes).
- MOMENT OF TRUTH: There is one ask, and it goes straight to the OS dialog: no primer sheet, no second Yes.

F12 · iOS · f5-today-calendar-strip, PLACE B, window Wed 21 Oct → Tue 3 Nov. REDRAW from 03-saved-place-unconfirmed.
- Thu 22 and Thu 29 each show two tick marks, and the Thu 22 cell has the tonight outline. Summary "Next 14 days: 4 items".
- Rows: "Recycling and garbage · Tomorrow" and "Recycling and garbage · in 8 days · Thu 29 Oct", each with a 2px identity.home left rule and the caption "You added this · Thursday · Repeats weekly". The Thu 22 row also carries "You reported this · checking".
- The "Set your pickup day" button is gone. The Mon 26 Oct statewide bar and the Fri 30 Oct insurance tick stay.
- Inset, labelled "Only if a widget is placed (Jordan has none in this story)": REDRAW from f7-today-widget · ios · 05-evening-confirmed with the label "Birchfield Ct" and "Saved place · Only you". Before: "Garbage tomorrow", hollow, "Unconfirmed". After: "Recycling and garbage tomorrow", tick, "You · Thursday". The air row reads "AQI 42 · Good · observed 7:00 AM" in both before and after (a confirm rewrites only the pickup facts, so the Wed 21 Oct morning observation time stays). Caption under the inset: "Widget short form: an allowed exception to 'You added this · Thursday' because of the widget's width (HC08)."
- Event: no event.
- MOMENT OF TRUTH: A confirm or correction rewrites the strip and the widget snapshot at once, so the hollow guess never lingers.

GAP: "One week later · Wed 28 Oct, 6:00 PM"

F13 · iOS · lock screen · Wed 28 Oct, 6:00 PM. REDRAW from the confirmed inset of f4-today-pickup-card · ios · 21-tray, without the street label.
- Shows: "Recycling + garbage tomorrow" / "Bins out tonight". Annotation: "iOS Active · Briefings".
- Does: taps it.
- Carries: pantopus://today?section=pickup, deliveryId, kind=evening.
- Event: DailyBriefingDelivery · sent · confidence official (household- or user-set).
- MOMENT OF TRUTH: The first pickup push Jordan ever gets fires on the day he set. No push fired on the guessed schedule.

F14 · iOS · f4-today-pickup-card · 20-arrived-from-push. REDRAW with PLACE B values.
- Shows: the card pinned under the location row "1107 NE Birchfield Ct · Saved place · Only you", with the highlight fading and focus on the card. "Recycling and garbage tomorrow" · "✓ You added this · Thursday".
- The report line is now the resolved outcome row (44pt): "We checked your report · Fixed Tue 27 Oct · See what changed". flow-11 F10 draws the resolved sheet pattern; the dates here are Tue 27 Oct.
- Event: session_open · trigger push · kind pickup · week 3 (no §5 bucket).
- MOMENT OF TRUTH: The report came back on the row he already looks at, by the promised date.

GAP: "Four weeks later · Wed 25 Nov, 6:00 PM · no push". Margin note: "Wed 18 Nov briefing and card carried: Next week: pickup moves to Fri 27 Nov".

F15 · iOS · f1-today-tab, quiet night in Thanksgiving week · Wed 25 Nov, 6:10 PM. REDRAW from 02-saved-place-quiet, with no FirstWeekRow.
- Use the strip from f5-today-calendar-strip · ios · 04-holiday-move, with window Wed 25 Nov → Tue 8 Dec. Thu 26 Nov has a struck ghost ring at 50%. Fri 27 Nov has the moved marks. The row reads "Recycling and garbage · in 2 days · Fri 27 Nov" with "Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar". Remove the Thu 3 Dec "You reported this · checking" row state, because that report is resolved.
- QuietDayReceipt "Nothing needs your attention today" with "Checked 6:00 PM · weather · air · alerts · your calendar".
- Inset: the evening row "Skipped tonight — nothing needed you", using the row pattern of f4-notification-settings · web-1440 · 12-quiet-night, drawn in iOS chrome.
- Beside the frame: a lock screen with no Pantopus notification.
- Event: DailyBriefingDelivery · skipped · low_signal_day (6:00 PM), then session_open · trigger organic · week 7 (no §5 bucket).
- MOMENT OF TRUTH: A "Bins out tonight" push on the usual evening would be false, whatever mark it carried. The silence is the correct output.

F16 · iOS · lock screen · Thu 26 Nov, 6:00 PM. REDRAW from the holiday inset of f4-today-pickup-card · ios · 21-tray.
- Shows: "Holiday move: pickup tomorrow" / "Moved from Thu · bins out tonight". Annotation: "iOS Active".
- Does: taps it.
- Event: DailyBriefingDelivery · sent · confidence official (household- or user-set; the move itself is official).

F17 · iOS · f4-today-pickup-card · 05-holiday-move. REDRAW from it with one delta: the headline reads "Recycling and garbage tomorrow — moved for Thanksgiving", because Jordan set weekly recycling.
- Shows: "Bins out tonight — curbside by 6:30 AM (City of Camas)". A struck ghost "Thu 26 Nov" beside "Fri 27 Nov". Captions "● Official · Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar" and "✓ You added this · Thursday". Footer "Only you will see this.".
- Event: session_open · trigger push · kind pickup · week 7 (no §5 bucket).
- MOMENT OF TRUTH: The push follows the moved day, and the card names the source of the move.

LAYOUT
Artboards and lanes:
- Each lane artboard is 2400 wide, as tall as needed, on surface.app.
- It has four bands, top to bottom:
  1. A header strip with the visible artboard name and a one-line summary of the lane.
  2. The MARGIN LANE. Each moment-of-truth callout is a surface.base card with the overline "MOMENT OF TRUTH · " followed by the frame id as written, and one sentence, joined to its frame by a 1px text.secondary leader line.
  3. The HAPPY LANE: frames left to right at 50% scale (iOS 196.5x426, Android 206x457.5, web-390 195x422), 64px apart.
     - Above each frame: its label, made of the frame id as written (F01…F17, X01…X14), then the surface id, the state and the platform, for example "F12 · f5-today-calendar-strip · saved place corrected · iOS".
     - Under it: the device date and time, then the event caption, then any "REDRAWN FROM" caption naming the artboard and its deltas.
  4. The FAILURE LANE: branch frames at 50% scale, labelled with the branch id as written and what went wrong, for example "X09 · SCOPE_RANK blocker".
     - A dashed arrow runs up to the happy-lane frame where the branch starts.
     - A second dashed arrow, labelled "rejoins" plus the frame id as written, runs up into the frame where the branch rejoins.
     - A branch with no user recovery ends in a labelled stop bar.
     - An alternative (not a failure) has a dashed outline and the label "alternative", so it never reads as a next step.
Arrows, gaps and system UI:
- Arrows are 1.5px text.secondary lines with solid heads.
- Each arrow is labelled by its trigger, in label 13/18 text.strong on a surface.base pill: "tap", "push at 6:00 PM", "widget tap", "content swap", "Back", "Save", "Allow", "organic open".
- A time jump is a 96px gap with a dashed vertical rule and a label on surface.sunken in text.strong, for example "Two days later · Wed 21 Oct, 6:10 PM".
- System UI (lock screens and the permission dialog) is greyed generic chrome with no wallpaper, labelled "system UI, not Pantopus".
- Push insets carry their level as an annotation outside the inset.
Focus map, no-notifications path and handoff checks:
- Artboard 05 is 2400 wide. It holds the focus map in two rows (F01–F09, then F10–F17). Its frames are 50% copies of the lane frames, not redraws, 64px apart, with each spoken string printed under its frame, never beside it.
- Artboard 06 (no-notifications path): the sequence frames are 25% copies (98x213) of the lane frames. Two pieces are new 50% redraws, named under THE NO-NOTIFICATIONS PATH: the web-390 row and the F14 organic variant.
- Artboard 07 (handoff checks): thumbnails are 25% copies (98x213) of the lane frames, not redraws.
What never appears:
- No red or amber on arrows or lane backgrounds.
- No emotion curves, scores or percentages.
- Every frame keeps its ScopeChip or scope footer visible.
Paired frames: before/after pairs and insets share one bracket label.

FAILURE BRANCHES (lower lanes, by artboard)
Under F01–F04:
- X01 · Push arrives while Today is open. Frame: f1-today-tab · ios · 15-foreground-push. There is no banner; the PickupCard is highlighted and the bell badge shows +1. Rejoins F03.
- X02 · iOS Scheduled Summary holds the push. Frame: f4-notification-settings · ios · 07-summary-and-time-sensitive, with "Your iPhone may hold pickup reminders for your summary." The card on Today is the guarantee. Rejoins F02 as an organic open (session_open · trigger organic).
- X03 · alternative: Maya confirms from the tray before Sam does. This applies only to a claimed home still on the city schedule: HOME A between its claim and Sam's confirmation, drawn on Mon 28 Sep, 6:00 PM (under the proposed timeline). Tue 29 Sep is a garbage-only week (recycling weeks are Tue 22 Sep and Tue 6 Oct).
  - Frame: the expanded inset of f4-today-pickup-card · ios · 21-tray, with deltas: body "Garbage · city schedule" (the export reads "Recycling + garbage · city schedule") and the action "That's my day" (the export reads "That's My Day"; see HC01). Title "Unconfirmed: pickup tomorrow". Print the date "Mon 28 Sep · garbage-only week" under the inset. It confirms in the background without opening the app.
  - Event: DailyBriefingDelivery · sent · confidence unverified (counted; caveat present). Then, on the action: pickup rule confirmed · scope household · background (invented).
  - Then: f7-today-widget · ios · 05-evening-confirmed, with the delta headline "Garbage tomorrow", shows the tick and "You · Tuesday" (the widget short form, HC08 exception). In this alternative Maya, not Sam, confirmed.
  - Sub-branch: if the background confirm fails, the card stays hollow and the push is not rewritten. The next open shows the unconfirmed card. Rejoins F02 as a pattern (the main timeline keeps Sam's Sat 3 Oct confirmation).
- X04 · A household rule wins. If Jordan later claims PLACE B and a household member confirms a different day, the household rule replaces his and the caption names who set it, in the F02 form: "● Confirmed by Riley on Sat 14 Nov · Friday" (an invented example). Draw it as a callout with a thumbnail of F02.
Under F05–F08:
- X05 · Offline at F06. Frame: f4-today-pickup-card · ios · 14-offline, with PLACE B values: "You're offline · as of 6:02 PM", both buttons disabled, and "Confirming needs a connection.". The last content stays. Rejoins F06 when back online.
- X06 · Stale. Frame: f4-today-pickup-card · ios · 15-stale, with PLACE B values (F06's strings: "Garbage tomorrow", City of Camas, "Yes, Thursday is right", "Only you will see this."). Only the FreshnessLine ages ("Updated 2h ago"); the marks stay at full strength. Rejoins F06.
- X07 · The report fails at F07. Frame: x-provenance-sheet · ios · 17-report-failed, with PLACE B values (F07's header, source, Covers and ScopeChip in place of the cached HOME A payload): "We couldn't send your report. Your answer is saved · Retry". The chosen reason "Wrong recycling week" is kept, and "Set my pickup day" still works. Rejoins F08, and Retry can be used later.
- X08 · Box unticked. The self-fix sends no report. Rejoins F08. F09 then shows the quiet 44pt row "Also tell us the city's schedule looks wrong" in place of "You reported this · checking".
Under F09–F12:
- X09 · SCOPE_RANK blocker. After Save, the card still reads "Garbage tomorrow" with the hollow city caption.
  - Draw this wrong card with a tag in text.primary and a warning glyph: "BLOCKER · saved_place rule dropped by applyPrecedence. Do not push unverified pickups to saved places until fixed."
  - No user recovery; end in a stop bar. Rejoins F09 only once fixed.
- X10 · "Not now" or "No thanks" on the ask.
  - Frame: f4-today-pickup-card · ios · 18-declined-undo, with PLACE B values: "No reminder for now · Undo"; "No thanks" shows "You can turn this on in Notification settings · Undo". The card above reads "✓ You added this · Thursday".
  - The night-before row counts as answered, so the briefing card never asks about it again: f4-briefing-optin-card · web-390 · 07-pickup-ask-declined, drawn in iOS chrome.
  - Rejoins F12, then continues on the no-notifications path (artboard 06).
- X11 · "Don't Allow" at the system dialog.
  - Frame: f4-today-pickup-card · ios · 16-notifications-denied-widget-offer, with PLACE B values: "Pickup still shows here on Today", then "Put today on your home screen" with "Show me how". This is native only and offered at most once every 24 hours.
  - Rejoins F12. Wed 28 Oct becomes an organic open, showing F14 without the arrival highlight.
- X12 · Android asks. Frames: f4-today-pickup-card · android · 22-reminder-ask-denied-once ("Turn on reminders" re-asks once) and 23-reminder-ask-blocked ("Notifications are off for Pantopus", "Open settings", "Not now"), both with PLACE B values. Annotation: "Not now never opens the system dialog, so it never spends Android's one denial."
Under F13–F17:
- X13 · Notifications turned off later in iOS Settings.
  - Frame: f4-notification-settings · ios · 05-os-denied, with the banner "Notifications are off for Pantopus. These rows still update inside the app." and "Open Settings", which opens the Pantopus notification page, not the app's root settings.
  - Jordan's rows, not Maya's: Briefings caption names 1107 NE Birchfield Ct · Saved place · Only you; "Morning briefing" off (no saved-choice caption); "Evening briefing" off and disabled with its saved-choice caption (on, 6:00 PM); "Pickup day · Thursday (you set it)"; Household activity is the grey FactRow "Claim this address first"; "Bill and task reminders" hidden; Air & weather alerts off and disabled with its saved-choice caption (101 and up). No Tuesday and no Sam.
  - Also: f4-briefing-optin-card · ios · 10-on-but-blocked, with the amber glyph, "Notifications are off for Pantopus" and "Open settings". This shows because the in-app evening switch is still on. Today shows no other amber.
  - Rejoins F14 and F17 as organic opens.
- X14 · 2027 holiday calendar not yet published. Frame: the year band of x-place-file · ios · 02-saved-place-first-week (the Camas city lane with its Thursday service-week ticks), dashed with "projected" from Jan 2027. Marks after the last published calendar are drawn as projected and never look confirmed. (The f7-today-widget 08 detail is not used: it is Maya's Vancouver lane.) Ends in a callout; no rejoin.

HANDOFF CHECKS (draw each on artboard 07 as a pair of 25% thumbnails and a one-line rule)
- HC01 · F01, F09, F13 and F16 (and the X03 alternative) must agree with the canonical push strings:
  - Confirmed: "Recycling + garbage tomorrow" / "Bins out tonight · Larkspur Loop" (Maya), or "Bins out tonight" (Jordan, one place).
  - Unconfirmed: "Unconfirmed: pickup tomorrow" / "Recycling + garbage · city schedule" (or "Garbage · city schedule" in a garbage-only week), with the tray action "That's my day" (the research brief's casing). Change "That's My Day" to match in f7-today-widget and in f4-today-pickup-card (its entry-point list, INTERACTION, the unconfirmed push, the background-failure line and artboard 21).
  - Holiday: "Holiday move: pickup tomorrow" / "Moved from Thu · bins out tonight".
  - Retire every push that carries a house number.
  - Already fixed in v2 (no action): the old unconfirmed primer tray, f3-household-notifications' pickup line, f11-keeper-strip's pickup line and f7-widget-gallery's short pickup line.
- HC02 · F01, F02, F03 and F04 must agree on who confirmed Maya's day: "● Confirmed by Sam on Sat 3 Oct · Tuesday", FILLED. The F03 captions are "Sam · Tuesday · confirmed Sat 3 Oct" and "Sam added this · Sat 3 Oct". Every other surface changes to this one fact:
  - f1-today-tab 01/05: "You · Tuesday · Waste Connections"
  - f1-today-tab 14: PickupCard "Maya · Tuesday, confirmed 3 Oct 2026"
  - f5 01: tick
  - x-date-sheet 04: "Sam · Tuesday, confirmed 3 Oct 2026"
  - x-place-file 01: "you confirmed"
  - f4-notification-settings: "Tuesday (confirmed by Sam)"
  - f7-today-widget 01: hollow and unconfirmed
- HC03 · F02 and F03 must agree on the arrival rule: a delivered pickup already in the first viewport is highlighted in place and never repeated in the pinned slot, and when every delivered item is in the first viewport the slot takes no space. f1-today-tab 05 and f4-today-pickup-card 20 must draw the same thing. F02, F03 and the focus map all read "Next 14 days: 4 items".
- HC04 · F05 and F06 must agree on FirstWeekRow: it is absent, because Jordan saved on Sat 10 Oct. f1-today-tab 02 and x-place-file 02 moved the save to Sat 17 Oct, and they must follow the fixture.
- HC05 · F06, F07 and F08 must agree on Jordan's source and confidence: City of Camas, Thursday, hollow, recycling Not set, and one read date, Thu 15 Oct 2026. Today f4 06 says "read Thu 1 Oct 2026". Before anyone sets a recycling frequency, the prefilled x-date-sheet 03 caption ("recycling weekly") and the saved-place x-place-file row must not claim one.
- HC06 · F06 and F07 must agree on where "Change pickup day" goes: to the ProvenanceSheet report view, with "Set my pickup day" first. Its spoken hint is "Opens where this comes from". The PickupCard contract ("Change pickup day, opens date sheet"), x-provenance-sheet's open question and x-date-sheet's entry list must all change to match. flows-spec's "Not my schedule" label is retired.
- HC07 · F07 and F08 must agree on the transition: a content swap with Back, never a dismissal and never a stacked sheet. x-provenance-sheet still says "dismisses this sheet, then presents the DateSheet" and must change. x-provenance-sheet must also drop its report-success haptic ("One light haptic tick when a report sends successfully…") to match house style: one light tick on confirm and Save only.
- HC08 · F08 and F09 must agree on the saved words: "Saved to your calendar. Only you." and "✓ You added this · Thursday". x-date-sheet's "You · Thursday" and the contract's "You · Tuesday" change. Exempt: the widget keeps the short form "You · Thursday" / "You · Tuesday" as an allowed standalone exception (F12 inset, X03).
- HC09 · F09 and F11 must agree on what the ask turns on. After a new grant, Air & weather alerts come on at 101, so the ask says so ("Air alerts when it's unhealthy"). Already fixed in v2: f4-notification-primer's body now reads the same sentence.
- HC10 · F08, F09 and F11 must agree that a pickup-day save reached from "Change pickup day" opens no primer sheet, because f4-today-pickup-card shows the inline ask "after the first successful confirm or correction".
  - Live conflict: f4-notification-primer entry 1 opens the primer sheet "after the person saves their first pickup day in the Date sheet (from 'Change pickup day' or 'Set your pickup day')", which is exactly the F07→F08→F09 path. Remove that entry, or limit it to cases where the PickupCard inline ask cannot show.
  - The NotificationAsk contract's primer variant for the first confirmed pickup ("primer sheet form, used only for indirect entries (first confirmed pickup…)" with "Continue") is superseded by the inline three-button ask.
  - Briefing card: while the inline ask is open, the night-before row is hidden; on grant it collapses to "The night before pickup · 6:00 PM · Change"; on decline it is absent.
  - Thumbnails: F09 beside f4-notification-primer · ios · 01-default-pickup.
- HC11 · F08, F12 and the widget inset must agree: a confirm or correction turns the strip marks and the widget snapshot into ticks immediately.
- HC12 · F10 and F14 must agree on the promise: "by Wed 28 Oct", with the outcome shown on the row he looks at by then. The resolved row reads "We checked your report · Fixed Tue 27 Oct · See what changed", using flow-11 HC10's canonical wording. f4-today-pickup-card and f5-today-calendar-strip have only a "reported · checking" state and need this resolved state.
- HC13 · F01, F02, F13 and F14 must agree on the link: pantopus://today?section=pickup&deliveryId=…&kind=evening (web /app/today?section=pickup) lands on the pinned card. /app/place/today redirects with its query. f1-today-tab's briefing-push route (pantopus://hub-today?deliveryId=…&kind=morning|evening, line 16) must change to this form for a pickup delivery.
- HC14 · F08, F15, F16 and F17 must agree on the holiday move:
  - Every frame reads "Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar".
  - f4 05's headline follows Jordan's rule: "Recycling and garbage tomorrow — moved for Thanksgiving", not "Garbage only…".
  - f4's briefing line becomes "Next week: pickup moves to Fri 27 Nov".
  - f5 04's Thu 3 Dec "You reported this · checking" is gone in this journey.
- HC15 · F15 and F16 must agree on timing: no push on Wed 25 Nov, and the push on Thu 26 Nov. "Skipped tonight — nothing needed you" appears only on a night with no pickup the next day.
- HC16 · F08 and Notification settings must agree: after the save, Jordan's pickup row reads "Pickup day · Thursday (you set it)", replacing "Pickup day · Not set · Set it" from f4-notification-settings 09 (X13 shows it).
- HC17 · HOME A timeline: the claim date, move-in date and Sam's join date must come before Sam's confirmation on Sat 3 Oct. Conflicting dates today: x-place-file (claimed Sat 17 Oct, Sam joined Sun 18 Oct), 00c (Sam "joined Tue 13 Oct 2026"; Maya "joined Mon 12 Oct 2026" in V1), f6-home-basics-rows (claimed Sun 18 Oct; "She moved in on Tue 29 Sep 2026", which falls after the proposed Sat 26 Sep claim at move-in) and f1-your-places ("Claimed Mon 19 Oct"). Proposed: moved in, joined and claimed Sat 26 Sep; Sam joined Thu 1 Oct; Sam confirmed Sat 3 Oct.
- HC18 · F03 and F09 must agree on the viewer-relative mark for a confirmed seeded fact: FILLED when another member confirmed it (f4 02, F02–F04), tick when you did (f4 03, x-provenance-sheet 04, flow-11 F11, X03). Founder to confirm this rule against invariant 1 ("FILLED = official or confirmed; tick = you added it").
- HC19 · F02 and f1-today-tab 05 must agree on the strip beside the card: f1-today-tab 05 must stop pairing f5's 6-item strip (which adds a Tue 20 Oct bulk pickup) with a plain "Recycling and garbage tomorrow" card, because a bulk pickup on Tue 20 would change the PickupCard headline.

ACCESSIBILITY IN THE JOURNEY (artboard 05: the focus map, a numbered focus ring on each frame and the spoken string under it)
Focus after each transition:
- F01→F02: accessibility focus lands on the PickupCard, which reads "Recycling and garbage tomorrow. Bins out tonight, curbside by 6:30 AM. Tuesday, confirmed by Sam." The pinned slot is empty, so nothing is announced from it.
- F03→F04: focus lands on the DateSheet title "Pickup day". Close returns focus to the Tue 20 Oct row.
- F06→F07: focus lands on the sheet title "Where this fact comes from", then the "What's wrong?" heading. The checkbox and radio rows show selection differently from focus. A disabled "Send report" reads "Pick what's wrong to send this."
- F07→F08: the content swap moves focus to the DateSheet title "Pickup day". Back comes first in reading order. The weekday chip is spoken "Thursday, on record, not confirmed, selected".
- F08→F09: the sheet closes and focus returns to the card's source row, because the button pair it came from is gone. "Saved to your calendar. Only you." is a polite status. The ask is not auto-focused; it follows in reading order.
- F11: after the system dialog, focus lands on the ask's status line "Saved · 6:00 PM", because the button that opened the dialog is gone.
- F12: the strip is one adjustable element ("Next 14 days: 4 items. Next: Recycling and garbage, tomorrow."). The rows are the targets.
- F13→F14 and F16→F17: focus lands on the card, and the highlight fades within 300ms. Under Reduce Motion, jump there and use a static highlight. The struck day is spoken "moved from Thursday 26 November".
- F15: "Checked: weather, air, alerts, your calendar."
Size, contrast and haptics:
- At AX5, the F06 and F09 buttons stack full width, and the order stays headline, instruction, source row, buttons, status, footer.
- Every frame reads correctly in greyscale, because marks read by shape.
- Haptics: one light tick on Save and confirm only (the house-style confirm tick). A successful report shows a tick mark and plays no haptic.

THE NO-NOTIFICATIONS PATH (artboard 06)
- The same loop with notifications never allowed (X10/X11), and on web, where no web briefing push channel exists yet.
- Sequence (25% copies): F05 → F06 → F07 → F08 → F09 (with X11) → F12 → organic open Wed 28 Oct → F15 → organic open Thu 26 Nov at 6:10 PM showing F17 (session_open · trigger organic · week 7).
- New 50% redraw 1, the F14 organic variant: REDRAW from f4-today-pickup-card · ios · 20-arrived-from-push with F14's PLACE B values and these deltas: no arrival highlight, the card sits in its normal Today position (not pinned), date Wed 28 Oct, 6:10 PM. Event: session_open · trigger organic · week 3 (no §5 bucket).
- New 50% redraw 2, the web-390 row (two frames): REDRAW f4-today-pickup-card · web-390 · 01-unconfirmed with the PLACE B strings from F06 (deltas: "Garbage tomorrow", City of Camas, "read Thu 15 Oct 2026", "Recycling: Not set", "Yes, Thursday is right", "Only you will see this. No night-before reminder until you confirm your day."); then the same export with F09's corrected strings ("Recycling and garbage tomorrow", "✓ You added this · Thursday", "Saved to your calendar. Only you.", "You reported this · checking") and no reminder ask (the web ask is not shown until a web channel ships). Events: session_open · trigger organic · week 2 (no §5 bucket), then pickup rule saved · scope saved_place (invented).
- Add the permission-free glance as a 25% copy, from f4-briefing-optin-card · ios · 17-declined-at-os-widget-offer: "Pickup still shows here on Today · Or put it on your home screen".

INSTEAD OF
- Instead of a separate "Not my schedule" button, route the card's "Change pickup day" into the report view with "Set my pickup day" first, because one label must have one destination and every correction must be counted.
- Instead of a primer sheet after the correction, expand the ask inline and go straight to the OS dialog, because a second Yes trains dismissal.
- Instead of drawing the push as the only way the loop runs, draw an organic open beside every push, because Today is the guarantee.
- Instead of a push on the usual evening in Thanksgiving week, draw the silent Wednesday and the Thursday push, because a reminder on the wrong night is false.
- Instead of stacking the DateSheet on the ProvenanceSheet, swap the content with Back, because stacked sheets strand focus.
- Instead of a toast for the correction, rewrite the caption in place, because the change must survive a reload.
- Instead of a pinned "Also:" line pointing at a row the next frame does not draw, leave the pinned slot empty and highlight the card, because every link must land on something visible.
- Instead of an emotion curve, a score or a completion bar across the storyboard, draw the real frames with their event captions, because the product forbids grades and fractions.
- Instead of red failure lanes, use neutral ink and labels, and put the warning glyph only on the SCOPE_RANK blocker tag.
- Instead of reusing Maya's HOME A exports unchanged in Jordan's lane, apply the PB swaps, because one lane must hold one person and one place.

DONE WHEN
- The loop reads left to right for both lanes, with every trigger, time gap and date labelled, and every date carries its weekday.
- Every frame carries a literal event caption or "no event", and no event name is invented beyond those marked "(invented)".
- No HOME A string (Tuesday, Waste Connections, Larkspur Loop, Sam, "Your household") appears on a Jordan frame.
- A person with notifications off reaches every fact in the loop by organic opens alone (artboard 06).
- Jordan receives no pickup push before Wed 28 Oct, and the first one matches the day he set.
- After F08, the card, strip, widget inset and settings row all show the tick, and the caveat is gone.
- The report has a dated receipt (F10) and an outcome on the row he looks at (F14), in flow-11's wording.
- The holiday week shows no push Wed 25 Nov, one push Thu 26 Nov, and the move labelled as the City of Camas 2026 calendar.
- Every push inset names the right bins for its date (X03 is garbage only).
- Every failure branch shows its recovery surface and where it rejoins, or a stop bar.
- All 19 handoff checks are drawn.
- Every push inset fits 30/40 characters, has no house number, and is annotated Active/DEFAULT.
- Every frame reads correctly in greyscale.

ARTBOARDS
1. flow-02 · storyboard · 01-maya-push-night · light — F01 (with the Android inset) – F04 with the margin callouts, failure lane X01–X04.
2. flow-02 · storyboard · 02-jordan-quiet-to-correction · light — F05, the Wed 21 Oct gap, F06–F08, failure lane X05–X08.
3. flow-02 · storyboard · 03-jordan-corrected-reminder-on · light — F09 with inset F10, F11, F12 with the widget inset, failure lane X09–X12.
4. flow-02 · storyboard · 04-first-push-to-holiday-move · light — the Wed 28 Oct gap, F13–F14, the Wed 25 Nov gap, F15–F17, failure lane X13–X14.
5. flow-02 · storyboard · 05-focus-map · light — 2400 wide; the focus map across F01–F17 in two rows (F01–F09, F10–F17) as 50% copies, spoken string under each frame.
6. flow-02 · storyboard · 06-no-notifications · light — the no-notifications path: 25% copies, plus the two new 50% redraws (F14 organic variant, web-390 row) and the glance line.
7. flow-02 · storyboard · 07-handoff-checks · light — HC01–HC19, each as two 25% thumbnails and one rule.
8. flow-02 · storyboard · 08-notes · light — this list:
- Artboard numbering: the focus map and no-notifications path are artboards 05 and 06 (no 05a/05b), so handoff checks are 07 and Notes is 08.
- Recast from flows-spec:
  - Luis Ortega (6519 NE 51st St, the county solid-waste map, Tuesday, "Next recycling — Tue 27 Oct") becomes Maya (a household-confirmed Tuesday with the anchor Tue 20 Oct, set by Sam) and Jordan (City of Camas Thursday, recycling Not set, set to Weekly).
  - "Waste Connections 2026 holiday schedule" becomes "City of Camas 2026 calendar".
  - The "county map" checkbox becomes "Also tell us the city's schedule looks wrong".
  - "Reported Oct 19 … Clark County Public Works by Oct 26" becomes "Reported Wed 21 Oct. We'll check it against City of Camas by Wed 28 Oct and tell you here."
- PB swaps: every HOME A export reused in Jordan's lane (f4 14, 15, 16, 18, android 22/23; x-provenance-sheet 17; f4-notification-settings 05) takes the PLACE B values listed at the top. X14 uses only x-place-file 02's Camas lane; f7-today-widget 08 (Vancouver lane) was dropped from ATTACH.
- Superseded spec strings:
  - "Not my schedule" becomes "Change pickup day".
  - "You · Tuesday" becomes "✓ You added this · Thursday" (except the widget short form).
  - "That's My Day" becomes "That's my day" (f7-today-widget and f4-today-pickup-card).
  - The step 9 Yes on the briefing card becomes the pickup card's inline ask.
  - The push body "Bins out tonight · curbside by 6:30 AM" becomes "Bins out tonight" (the set-out time stays on the card).
  - "Garbage moves to Friday this week" becomes "Recycling and garbage tomorrow — moved for Thanksgiving".
- Fixtures to verify: the City of Camas Thanksgiving move from Thu 26 Nov to Fri 27 Nov 2026, and weekly recycling on Camas Thursday routes. Both must be checked against the real City of Camas calendar.
- Fixture delta: the HOME A timeline (moved in and claimed Sat 26 Sep, Sam joined Thu 1 Oct, Sam confirmed Sat 3 Oct), proposed to settle HC17. Maya's account is assumed to date from Sat 26 Sep for the week buckets, and Maya is assumed activated (her returns count among activated).
- Invented and delta strings: "We checked your report · Fixed Tue 27 Oct · See what changed" (flow-11's pattern); "Repeats weekly"; "You added this · Thursday · Repeats weekly"; "Next week: pickup moves to Fri 27 Nov"; "Recycling and garbage tomorrow — moved for Thanksgiving"; "Pickup day · Thursday (you set it)"; "Recycling weekly"; "Set Wed 21 Oct 2026"; Covers "This saved place"; the Wed 21 Oct receipt; "Notifications are off. These show on Today and in your place file." (F08, replacing x-date-sheet's "Pickup reminders come with your evening briefing at 6:00 PM."); the F04 caption delta "● Confirmed by Sam on Sat 3 Oct · Tuesday"; the F03 captions "Sam · Tuesday · confirmed Sat 3 Oct" and "Sam added this · Sat 3 Oct"; the F09 tray preview "Recycling + garbage tomorrow" / "Bins out tonight"; the X03 push body "Garbage · city schedule", the action casing "That's my day" and the widget headline "Garbage tomorrow"; "● Confirmed by Riley on Sat 14 Nov · Friday" (X04, with the invented name Riley); the widget exception caption; the widget air row "AQI 42 · Good · observed 7:00 AM" on Wed 21 Oct; "system UI, not Pantopus"; the BLOCKER tag text; the X13 saved-choice captions for Jordan; every week-bucket caption and callout sentence.
- Invented or proposed event names and values: "pickup rule saved · scope saved_place"; "report · tag not my schedule · status checking" (shared with flow-11; §5 names only the report tag); "evening_briefing_enabled" printed as an event (in §5 it is a preference field read by the activation query); "pickup rule confirmed · scope household · background" (X03); the confidence label "official (household- or user-set)"; and a proposed separate 'confirmed' confidence value, not drawn, for the founder to accept or reject.
- Assumptions:
  - Jordan never turned notifications on before Wed 21 Oct.
  - Jordan has no widget.
  - Maya has a second saved place, so her pushes carry "Larkspur Loop".
  - Sam confirmed on Sat 3 Oct, drawn FILLED for Maya (HC18). X03 is an alternative in which Maya confirms first.
  - Jordan's report closed on Tue 27 Oct with his answer matching the city.
  - The notice mark for the holiday is FILLED (official) while his rule is a tick.
- House-style exception: none. The report success plays no haptic; only Save and confirm tick (HC07 asks x-provenance-sheet to match).
- Activation note: under §5, Jordan is not activated (no briefing or widget, and no pickup rule or F5 date, within 7 days of Sat 10 Oct). His session_open rows are written, but they fall outside the "among activated" returns block and outside the week-one/four/eight buckets. Founder to decide whether late activators get their own read.
- Cross-flow conflicts, for the founder to settle on one timeline (this storyboard is the main timeline):
  - flow-10 (revised) now follows this storyboard: Jordan allows on Wed 21 Oct and the smoke alert (AQI 118) is on Mon 26 Oct. If the founder keeps flow-10's earlier premise, it has an AQI 118 alert at PLACE B on Mon 19 Oct; F05's quiet receipt assumes the fixture's Good reading.
  - flow-11 is labelled ALT TIMELINE: it resolves a recycling report on Thu 22 Oct, with notifications off and no self-fix until Wed 28 Oct. Here the report is filed Wed 21 Oct and resolves Tue 27 Oct after a self-fix. flow-11's Wed 21 Oct frame (X11, reported, notifications off) and this F06 (not reported) describe the same evening differently.
- Dependencies:
  - the saved-place rule must outrank the city rule (SCOPE_RANK);
  - the iOS launch-time permission request must be removed;
  - f4-notification-primer's pickup entry must be removed or narrowed (HC10);
  - a web briefing push channel does not exist, so web is organic only;
  - the 2027 holiday calendar is unpublished.
- Open question: whether a report outcome may appear on the pickup card or only in the sheet.
- Omitted: dark twins, AX5 frames and most Android frames. They exist in each screen's own project; this storyboard draws only the Android tray inset, the Android asks and the Android X12 frames.

BATCH PLAN
Turn 1: artboards 1–2, then wait for "continue".
Turn 2: artboard 3 (finish it completely), then wait for "continue".
Turn 3: artboard 4, then wait for "continue".
Turn 4: artboards 5 and 6, then wait for "continue".
Turn 5: artboards 7 and 8.
