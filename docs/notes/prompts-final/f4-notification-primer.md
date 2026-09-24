# Notification permission primer
id: f4-notification-primer · platforms: ios/android · isNew: True · artboards: 18

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Notification permission primer · f4-notification-primer

TYPE: NEW. Nothing like it exists in the Pantopus design system yet. Build it only from existing tokens, sheet styles and Foundations components.

ATTACH: The existing Today tab frame (iOS and Android) and the existing Mail tab frame (iOS and Android), used only as the tab chrome behind the sheet. The hosts inside those tabs are not built yet: draw Today's PickupCard (confirmed variant), the briefing card's NotificationAsk card row, and Mail's NotificationRow push-off banner from the Foundations board, not from screenshots. Change the tab frames only where an artboard below says so.

PLATFORMS & VIEWPORTS: iOS 393x852 and Android 412x915. On both, draw NotificationAsk "primer iOS" / "primer Android" exactly as on the Foundations board: a content-sized detent (not the medium detent), Close row, title, PushCopy tray, body, silence contract, Continue, caption. iOS has no grabber; its sheet may scroll at large text with Continue and its caption pinned. Android is a Material 3 modal bottom sheet sized to content, with the board's drag-handle row above the Close row, and "Continue" and "Not now" both outlined. There is no web version, because the web briefing card asks for browser permission itself.

WHERE IT LIVES & HOW PEOPLE ARRIVE: The sheet belongs to no tab. It opens over the screen where the person acted. It has no deep link, and it never opens at launch, sign-up or save. The system dialog no longer fires at app launch; this sheet (or the card's Yes, or the PickupCard's inline "Turn on reminders") is now the only route to it, so the one-time iOS grant is no longer spent at cold launch.
Default form: opens only when this phone has never shown the system notification dialog. Two entries:
1. Over Today, after the person saves their first pickup day in the Date sheet (from "Change pickup day" or "Set your pickup day"), once the Date sheet has closed and the save succeeded. Never draw one sheet on top of another. The sheet receives the confirmed weekday and the place's street label. The first "That's my day" on the PickupCard never opens this sheet: it expands inline to "Remind you the night before? 6:00 PM", and its "Turn on reminders" fires the system dialog directly. If the pickup save failed, the sheet does not open: the PickupCard keeps its hollow mark and shows its error state with Retry. A pickup save queued while offline does not open the sheet either.
2. Over Mail, when the person taps "Turn on" in the push-off banner ("Push is off. You'll still see these here.") to get household updates on this phone.
Denial forms: open only from Mail's "Turn on" (and from a "Turn on" on the briefing card, if that card offers one after a denial). iOS denied → the 07 form. Android denied once → the 08 form, where Continue asks again. Android blocked → the 09 form. A Date-sheet save never opens the sheet after a denial.
No longer an entry: Yes on the briefing card opens the system dialog directly. The card already explains the request, so a second screen would be a second "Yes".
What happens next, Today entry: Continue opens the system dialog. After Allow, the person is back on Today with focus on the PickupCard. The briefing card's evening row reads "6:00 PM · Change", because evening is on by default after a grant; the morning row keeps asking. The briefing card is not scrolled to or highlighted. If the evening-briefing preference write fails after Allow, the briefing card row shows NotificationAsk's "Couldn't save · Retry" in its status slot.
What happens next, Mail entry: after Allow, Household activity turns on (quiet delivery), because the person asked for household updates. The push-off banner is removed, and a polite status line reads "Household updates are on · Change". "Change" opens Settings > Notifications at /app/settings/notifications?group=household. If the OS already allows notifications, "Turn on" switches the group on in place and shows the same line, with no sheet. After Don't Allow, the banner stays and nothing else changes.

WHO AND WHEN: Mon 19 Oct, 6:10 PM. Maya Chen stands at the curb at HOME A and sees the recycling carts. On Today she taps "Change pickup day", picks Tuesday in the Date sheet and taps Save. She has never been asked about notifications on this iPhone. Tonight's 6:00 PM send has already passed, so her next pickup reminder is Mon 26 Oct at 6:00 PM, a garbage-only week. Delta: Maya also keeps a saved place, "Mom's house" in Camas, so the street label shows on the tray. The Mail-entry frames are a separate moment in which Maya has still never been asked on this phone.

THE ONE JOB: Show the exact notification the person is about to allow, then hand them to the system dialog without asking "Yes" a second time.

FIRST FIVE SECONDS: First, the title naming what this is. Second, the tray preview (the visual hero, the largest element). Third, "Continue" with "Your phone will ask next." directly under it. Continue is the only primary action.

CONTENT (fixtures apply; these are the deltas)
Use the Foundations board strings verbatim.
Pickup entry. Title: "Pickup reminders on this phone". Tray (PushCopy, confirmed pickup): "Pantopus", time "now", title "Recycling + garbage tomorrow" (28 characters), body "Bins out tonight · Larkspur Loop". Caption under the tray: "This is the whole thing." Body: "Pickup the night before. Air alerts when it's unhealthy. Nothing else unless you turn it on." Silence contract: "Only when something needs you. No news means nothing's up." The tray is an example from a recycling week.
Mail entry. Title: "Household updates on this phone". Tray (PushCopy, bill paid): "Sam marked Clark PUD paid" / "Due Fri 23 Oct · Larkspur Loop". Body: "Pickup the night before. Air alerts when it's unhealthy. Household updates stay off until you turn them on, then arrive quietly." Same silence contract. No amount appears on either tray.
Granted state on Today: under "6:00 PM · Change", a text.secondary caption "Next pickup reminder in 7 days · Mon 26 Oct, 6:00 PM · garbage only".
Granted state on Mail: "Household updates are on · Change".
Worst case (specimen artboards only): a long street label is shortened at a word boundary so the body stays at 40 characters or fewer: "Bins out tonight · SE Fishers Landing" (37). Draw the full label "SE Fishers Landing Terrace" struck through in the margin as board chrome, never inside the tray. The title never truncates, because it stays within 30 characters.

LAYOUT & VISUALIZATION: Follow the board stack, top to bottom: Close row, title (h3), tray panel, "This is the whole thing.", body (body 16/24), silence contract (bodySmall text.secondary), actions, caption under Continue. The tray preview is the hero: a surface.raised inset card on a surface.sunken panel, with the 20pt Pantopus icon, "Pantopus" and "now", bold title and one body line. It is an in-app illustration with rounded corners and no system shadow; it must never look like a system alert or a live banner. The caveat-first rule protects honesty: an unconfirmed pickup's title is "Unconfirmed: pickup tomorrow", so truncation can never cut the caveat; the specimen artboards prove this. If the street label is missing (one place only), drop it and keep "Bins out tonight".
Denial forms, drawn as the board's ios-denied / android-denied-once / android-blocked sheets, household version:
- iOS denied and Android blocked keep the title and tray. The body and silence contract become "Notifications are off for Pantopus." Directly under it, this surface's only delta: the what-still-works line, "Household updates still show here in Mail." (pickup version: "Pickup still shows on Today."). iOS: filled "Open Settings" with "Opens the Notifications page for Pantopus in Settings." Android blocked: outlined "Open Settings" and "Not now" with "Opens the notification settings for Pantopus."
- Android denied once: the household Android primer unchanged (Continue asks again, Not now, "Your phone will ask next."), plus the what-still-works line under the silence contract.

INTERACTION, MOTION & HAPTICS
iOS: one filled button, "Continue" (primary.700), which opens the system dialog. The sheet has no "Not now" button. It has the visible "Close" in its Close row, and swipe-down also closes it. Closing does not fire the system dialog, and the sheet never reopens on its own.
Android: outlined "Continue" and "Not now" as peers of the same height and weight, plus the visible "Close" in the Close row. "Not now" and "Close" close the sheet and never fire the system dialog, so no denial is spent. After either, the sheet never reopens on its own; the next ask comes only from the person's own tap. System Back behaves like "Not now". No lasting decline is paired with "Not now" here, because the sheet only ever opens from the person's own tap.
Widget hint: one widget hint is offered at most once every 24 hours, after a confirm or a denial. On frame 4 (confirm plus grant), it is the PickupCard's "confirmed just now" hint as drawn on the Foundations board. On frame 5 (denial), the declined row "Put Today on your home screen" with the text button "Add the widget" (primary.700, 44pt) replaces it, so only one hint shows in that window.
The sheet presents with the platform's standard sheet motion (300ms or less). Under Reduce Motion it cross-fades. The tray preview does not animate. Continue, Close and Not now play no haptic, because the Date sheet's Save already played the confirm tick.

FOUNDATIONS COMPONENTS USED: NotificationAsk (primer iOS, primer Android and their household twins, iOS denied, Android denied once, Android blocked; card row states granted, declined and Couldn't save). PushCopy (confirmed pickup, unconfirmed pickup, bill paid, hidden-preview placeholder, Android public version). PickupCard (host; confirmed, confirmed just now and error states). DateSheet (pickup kind, the step before the sheet; closed before it opens). NotificationRow (Mail host; push-off banner state). OfflineNotice (queued writes variant). QuietDayReceipt is not used here.

ACCESSIBILITY: Reading order: Close, title, tray preview, caption, body (or denied lines), silence contract, button(s), caption under Continue. The tray is one element, spoken as "Example notification: Recycling plus garbage tomorrow. Bins out tonight, Larkspur Loop." The sheet title is unique, and focus stays inside the sheet. Focus returns to the PickupCard on Today or to the push-off banner's position on Mail (the new status line after a grant). The Mail status line is announced politely. Buttons are 44pt on iOS and 48dp on Android, with 8dp between them. Button labels carry the meaning, never colour. At AX5 the sheet scrolls behind the pinned Continue and the buttons go full width.

COPY
Buttons: "Continue" · "Not now" (Android only) · "Open Settings" · "Close" · "Add the widget" · "Change".
Caption under Continue: "Your phone will ask next."
Denied: "Notifications are off for Pantopus." + "Pickup still shows on Today." or "Household updates still show here in Mail."
Open Settings captions: "Opens the Notifications page for Pantopus in Settings." (iOS) · "Opens the notification settings for Pantopus." (Android)
Granted caption: "Next pickup reminder in 7 days · Mon 26 Oct, 6:00 PM · garbage only".
Mail granted: "Household updates are on · Change".
Save error (briefing card status slot): "Couldn't save · Retry".
Offline caption: "You're offline. Your reminder will save when you're back online."
Widget row: "Put Today on your home screen" · "Add the widget".

EDGE CASES: Already granted: the sheet never appears. A failed or queued pickup save: the sheet never appears. Offline: the connection drops after the pickup save succeeded; Continue still works, and only the reminder-preference write is queued. Android denied once: Continue fires the system dialog again; a second denial blocks, and after that only Open Settings is offered. Android before version 13 needs no runtime prompt, so the sheet never appears. Hidden previews on the lock screen: the tray shows "Pickup reminder"; the Android public version reads "Pantopus · Pickup reminder". Large text: the tray grows with its text and wraps its body to two lines. One place only: no street label.

INSTEAD OF
- Instead of a "Yes" or "Allow" button, draw "Continue" with "Your phone will ask next." under it, because the system dialog is the decision and a lookalike Allow is manipulative.
- Instead of a bell illustration, arrows or benefit bullets, draw the real tray preview, because people decide better when they see the actual notification.
- Instead of styling the preview as a system alert, draw it as an inset illustration on raised-over-sunken, because the primer must never be mistaken for the system dialog.
- Instead of a filled Continue beside a ghost "Not now" on Android, draw two outlined peers, because a decline is a survivable outcome.
- Instead of a long title with the caveat at the end, draw the 28-character canonical title, because tray truncation cuts the end of a title.
- Instead of a persistent amber nag after a decline, draw the host with the widget row offered once, because the widget is a return trigger that needs no permission.
- Instead of a full address or a truncated long street, draw the street label shortened to fit 40 characters, because lock screens are public and the body must read whole.
- Instead of opening this sheet after "That's my day", leave that to the PickupCard's inline ask, because the card already gives the context.

DONE WHEN: The primer never follows a card "Yes" or a "That's my day". Its only forward label is Continue. The sheet matches the Foundations primer exactly (detent, Close row, strings, silence contract, Android outlined buttons). The tray matches the canonical string and fits at 393pt and 412dp with the caveat intact. Android "Not now" spends no denial and never re-asks on its own. Every denial frame names what still works. The Today grant lands on "6:00 PM · Change" without Maya choosing a time, and its caption names the next pickup send only. The Mail grant switches Household activity on and says so.

ARTBOARDS
1. f4-notification-primer · ios · 01-default-pickup · light: Maya's sheet over dimmed Today after saving Tuesday in the Date sheet (Date sheet already closed); confirmed tray, Close, Continue only.
2. f4-notification-primer · android · 02-default-pickup · light: the same moment; drag handle, Close, outlined Continue and Not now as peers.
3. f4-notification-primer · ios · 03-mail-entry · light: the household sheet over Mail after the push-off banner's "Turn on", with the "Sam marked Clark PUD paid" tray and the household body.
4. f4-notification-primer · ios · 04-granted · light: Today after saving Tuesday in the Date sheet and Allow. PickupCard reads "You · Tuesday" with its confirmed-just-now widget hint; briefing card evening row "6:00 PM · Change" with the next-pickup caption; morning row still asks; no highlight.
5. f4-notification-primer · ios · 05-declined-at-os · light: Today after Don't Allow. Briefing card slot closed, one text.secondary line "Pickup still shows on Today.", and "Put Today on your home screen" · "Add the widget" offered once. No amber.
6. f4-notification-primer · android · 06-not-now · light: Today unchanged after Not now. No system dialog fired. The PickupCard still shows.
7. f4-notification-primer · ios · 07-denied-open-settings · light: over Mail from "Turn on" while iOS notifications are denied: "Notifications are off for Pantopus.", "Household updates still show here in Mail.", filled Open Settings, its caption, Close.
8. f4-notification-primer · android · 08-denied-once · light: over Mail after one Android denial: household primer unchanged plus the what-still-works line; Continue (asks again) and Not now.
9. f4-notification-primer · android · 09-blocked · light: over Mail after two Android denials: the off line, the what-still-works line, outlined Open Settings and Not now, its caption.
10. f4-notification-primer · ios · 10-mail-granted · light: Mail after Allow: banner gone, "Household updates are on · Change" shown, rows unchanged; margin notes "Already granted: primer skipped" and "Save failed or queued: primer skipped".
11. f4-notification-primer · ios · 11-offline-and-save-error · light: the pickup sheet with the offline caption (connection dropped after the pickup save succeeded), beside Today whose briefing card status slot reads "Couldn't save · Retry".
12. f4-notification-primer · ios · 12-tray-specimen · light: collapsed iOS trays at 393pt: "Recycling + garbage tomorrow" / "Bins out tonight · Larkspur Loop"; "Unconfirmed: pickup tomorrow" / "Recycling + garbage · city schedule"; "Recycling + garbage tomorrow" / "Bins out tonight · SE Fishers Landing" with the struck full label in the margin; hidden-preview "Pickup reminder".
13. f4-notification-primer · android · 13-tray-specimen · light: the same four trays at 412dp, plus the Android public version "Pantopus · Pickup reminder".
14. f4-notification-primer · ios · 14-ax5 · light: frame 1 at AX5; the sheet scrolls behind pinned Continue, the tray body wraps to two lines, Continue full width.
15. f4-notification-primer · android · 15-greyscale · light: frame 2 in greyscale.
16. f4-notification-primer · ios · 16-default-pickup · dark: dark twin of frame 1 (after saving Tuesday in the Date sheet).
17. f4-notification-primer · android · 17-denied-once · dark: dark twin of frame 8.
18. Notes: assumptions; every invented string (the what-still-works lines, "Household updates are on · Change", the next-pickup caption, the offline caption, "Mom's house", "SE Fishers Landing Terrace" and its shortened form); omitted states; and these points:
  - flow-01 step 12 (primer after "That's my day") is superseded by the PickupCard inline ask; this sheet's pickup entry is the first Date-sheet save only.
  - Decision: Mail's "Turn on" (and Allow from the Mail sheet) also turns on Household activity, with quiet delivery.
  - The board's household body says household updates "stay off until you turn them on"; from Mail the person is turning them on. Confirm, or use "Household updates arrive quietly, with no sound."
  - Open question: whether the body should also mention sign-in and invitation notices (Account & security, on by default) and date or bill reminders the person already set, or whether the canonical sentence is accepted as is.
  - The granted caption names the next pickup send only, because a bill due tomorrow (Clark Public Utilities, Fri 23 Oct) can make the evening briefing send on Thu 22 Oct.
  - The tray shows a recycling week as the example; tonight's 6:00 PM send has passed, so the next pickup send is Mon 26 Oct, garbage only.
  - This project's moment (first ask on Mon 19 Oct) differs from the settings project, which assumes Maya granted earlier.
  - "Unhealthy" in the body includes the default Unhealthy for Sensitive Groups threshold (AQI 101); confirm the wording.
  - Decision for the briefing card prompt: after a Date-sheet save that opens this sheet, and after the first "That's my day", the briefing card is not scrolled to or highlighted. Confirm so the briefing card prompt matches.
  - Widget hint: one per 24 hours; after a confirm plus grant it is the PickupCard's hint, after a denial it is the declined row.
  - No lasting decline is paired with "Not now" here, because the sheet only opens from the person's own tap and never re-asks.
  - Open question: the iOS visible Close conflicts with Apple's single-button pre-alert guidance (written for private-data permissions); the house style requires a visible Close on every sheet.
  - Open question: whether the briefing card offers its own "Turn on" after a denial (it would open frames 7-9 with the pickup lines).
  - iOS quiet (provisional) delivery is not used for pickup, because it never reaches the lock screen.

BATCH PLAN
Turn 1: artboards 1-6, then wait for "continue".
Turn 2: artboards 7-12, then wait for "continue".
Turn 3: artboards 13-18.
