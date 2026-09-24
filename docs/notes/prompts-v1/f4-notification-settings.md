# Notifications settings (four groups)
id: f4-notification-settings · platforms: web/ios/android · isNew: False · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Notifications settings
THIS IS: an EXTENSION. The host is the existing "Notification settings" page - this already exists and is already designed in the Pantopus design system - open it, keep everything, and change only what is listed below. It absorbs the per-home notification toggles from the home settings page, which are DELETED, not rewired.
PLATFORMS: web 1440x900 desktop (left sidebar nav) and 390x844 mobile web; iOS 393x852 grouped inset list; Android 412x915 M3 preference list.
WHERE IT LIVES IN THE FOUR-TAB IA: reached from Settings (off the Mail tab's account area on mobile, the sidebar on desktop).
HOW THE USER GETS HERE: Settings > Notifications; "More options" on the Today briefing opt-in card; the overflow on any in-app push row ("Turn these off").
THE ONE JOB: give every push this product sends exactly one honest switch, in one place, including the air and weather alerts that have no switch anywhere today.

CONTENT (verbatim, at full density, for 2418 NE Ingle Rd, Camas WA 98607):
  Pinned at the very top, the master gate lifted out of the Mail area: "Push notifications from Pantopus" - ON.
  GROUP 1 BRIEFINGS: "Morning briefing" ON, time row "7:00 AM"; "Evening briefing" ON, time row "6:00 PM", caption on that row: "Only when something needs you. No news means nothing's up."; group caption "Times are Pacific Time (Camas, WA)."; status row "Pickup day - Tuesday (confirmed by Sam)" with its alternate "Pickup day - Not set - Set it".
  GROUP 2 HOUSEHOLD ACTIVITY: "Bills paid" ON, "Tasks completed" OFF, "Events added" ON.
  GROUP 3 DATES AND BILLS (renamed from "Home Reminders"): "Date reminders" ON, helper "Lease ends, insurance renews, tax-appeal deadlines"; "Bill reminders" ON, helper "Clark Public Utilities and any bill you add" — two separate switches, so muting dates cannot mute bills.
  GROUP 4 AIR AND WEATHER ALERTS: master ON, plus a severity threshold segmented control: "Sensitive groups (101+)" - "Unhealthy (151+)" - "Very unhealthy (201+)", second selected.
  Denied banner: "Notifications are off for Pantopus. These rows still update inside the app." + "Open Settings".

THE VISUALIZATION DECISION:
  Four labelled groups, each with a master switch on the first row and helper text set directly under that master in text.secondary — helper under the master, never floating at the group footer, because the reader is checking one switch at a time. The permission banner pins at the top of the scroll, above the master gate, full width, warningBg, and it explicitly says in-app rows keep working so the page does not read as dead. The evening briefing's silence contract lives in its own row caption, not the group header: the people who open this page are people who stopped receiving pushes and are trying to work out whether they are still switched on.

STATES TO DRAW (each its own frame; 7 on web desktop, then the default populated state once on iOS and once on Android = 9 frames):
  default populated (all four groups, as above) - loading - saved - save error - OS permission denied (banner pinned) - no location (briefing captions read "Briefings need an address. Save one to turn these on." and the toggles are off and disabled) - timezone mismatch (caption "Your phone is on Mountain Time. These fire at 7:00 AM Pacific, the address's time.")

DO NOT: do not reintroduce per-home notification toggles or invent a fifth settings surface, and do not keep the label "Home Reminders" — it misdescribes the switch for a user who has no home. Do not draw a switch for anything that does not actually persist; a control that pretends to save is worse than no control. Per-kind muting belongs on the date row itself, not as new rows here.
