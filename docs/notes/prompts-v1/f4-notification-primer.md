# Notification permission primer
id: f4-notification-primer · platforms: ios/android · isNew: True · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Notification permission primer
THIS IS: a NEW sheet. Nothing like it exists in the Pantopus design system yet — design it from scratch inside the existing system.
PLATFORMS: iOS 393x852 (.sheet, medium detent, grabber) and Android 412x915 (Material 3 ModalBottomSheet). No web build.
WHERE IT LIVES IN THE FOUR-TAB IA: it owns no tab. It presents modally over the Today tab, immediately before the OS permission dialog.
HOW THE USER GETS HERE: tapping Yes on the briefing opt-in card on Today; tapping "That's my day" on the Today pickup card for the first time; accepting household-activity notifications from Mail. It replaces the request iOS currently fires at cold launch.
THE ONE JOB: show the user the exact notification they are agreeing to receive, then let them grant or defer, before iOS spends its one-and-only prompt.

CONTENT (use verbatim; realistic density):
  Title: "Can we tell you about pickup night?"
  Body, one sentence, verbatim: "We'll tell you the night before pickup, and nothing else unless something needs you tonight."
  Actions, equal visual weight, side by side: "Yes" / "Not now".
  The example notification is for 2418 NE Ingle Rd, Camas WA 98607, Monday 6:00 PM: title "Recycling and garbage tomorrow - City of Camas schedule, not yet confirmed", body "Bins out tonight.", app name Pantopus, timestamp "now".

THE VISUALIZATION DECISION:
  The hero of the sheet is a faithful platform tray card carrying that real notification — on iOS a lock-screen banner with the rounded app icon, "Pantopus", "now", bold title, one-line body; on Android an M3 notification with small monochrome icon, app name, bullet, "now". Draw it at true tray proportions on the sheet's own surface (raised over sunken), slightly inset, with a tiny caption beneath: "This is the whole thing." The user is reading the artefact, not a description of it. Note that the unconfirmed caveat rides the TITLE, not the body tail, because a truncated tray line must not eat the honesty. No bell icon, no benefit bullets, no three-up illustration.

STATES TO DRAW (each its own frame, on both iOS and Android = 10 frames):
  1. default (sheet, tray card, Yes / Not now)
  2. granted — sheet dismissing onto Today with the opt-in row flipped to "6:00pm - Change"
  3. declined — sheet gone, the briefing card in its denied state, and the "Put today on your home screen" widget row promoted above it as the return trigger
  4. already denied at OS level — same sheet, but the action reads "Open Settings" and there is no Yes
  5. already granted — the sheet is never presented: draw Today unchanged with an annotation saying so

DO NOT: do not draw a persuasion screen that lists benefits of notifications, and do not draw a fake system dialog as if it were ours — the primer's entire value is that it precedes the OS prompt honestly. Do not make "Not now" a ghost next to a filled "Yes"; a declined grant is a survivable outcome and the widget path exists for it.
