# Today (one composition, both payloads)
id: f1-today-tab · platforms: web/ios/android · isNew: False · frames: 15

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Today — one composition, both payloads.
PLATFORMS/VIEWPORTS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
THIS IS an EXTENSION of the existing designed screen "Today". This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below. You are collapsing three screens all currently called Today (the Today tab, Place › Today, and the push-only briefing screen) into ONE composition per platform. Reuse the existing cards as drawn; change order, gating and states only.

WHERE IT LIVES: the Today tab's index, in the fixed four-tab IA (Place · Today · Nearby · Mail). Reached from: the Today tab in the bottom bar (mobile web, iOS, Android) or left sidebar (desktop web); a morning or evening briefing push; a home-screen widget tap; an AQI/NOAA alert push; "See Today" on the save-a-place confirmation.

THE ONE JOB: read, in one scroll, everything happening at this address today — and see that the quiet days were actually checked.

CONTENT (today = Monday 19 October 2026; address 2418 NW Lacamas Dr, Camas, WA 98607). Location row: "2418 NW Lacamas Dr", chip "Saved place · Only you", "Updated 4m ago". Pinned briefing card (push arrivals only): "Recycling and garbage tomorrow — city schedule, not yet confirmed". Pickup lead card: "Recycling and garbage tomorrow" / "Bins out tonight." / hollow mark + "City schedule, not yet confirmed" / equal-weight buttons "That's my day" and "Not my schedule". 14-day strip, Mon 19 Oct → Sun 1 Nov: pickup every Tuesday, Clark PUD autopay $148.62 Wed 21 Oct, Lacamas Shores HOA dues $265 Fri 23 Oct, statewide voter-registration deadline Mon 26 Oct, four items Fri 30 Oct. Weather: 58°F, rain likely after 4pm · NWS Portland. Air band: AQI 42, Good, PM2.5, observed 3:00 PM · AirNow. Alerts: none. Tiles: "Good day to sweep the gutters — dry until Thursday". Briefing opt-in card. Progress row: "3 of 6 things on file →".

THE VISUALIZATION DECISION: one vertical order, identical at every tier — location row → pinned briefing (if any) → pickup lead card → 14-day strip → weather → air band → alerts → ranked signals. Sections appear or vanish with data; surviving sections never move. Claiming an address must read as "more sections appeared", never as a re-layout that loses the calendar — that IA fix is the whole point of this screen. The quiet day is a FINISHED screen, not an empty state: "Nothing needs your attention today" above a receipt line of four small ticked checks — weather · air · alerts · your calendar — because a receipt naming what was checked is the only thing that makes silence legible rather than broken. Warming draws the same skeleton shapes in their final slots as each provider lands.

STATES — 12 frames, iOS 393×852: (1) no place at all, "Today starts with a place"; (2) has a location but display_mode hidden — sections suppressed, empty copy absent; (3) warming, sections arriving, no all-clear yet; (4) saved place with chip; (5) claimed home, no chip; (6) quiet day with receipt line; (7) partial — "We couldn't reach AirNow just now" + Retry, everything else still rendered; (8) alert variant; (9) stale/offline, "Updated 2h ago"; (10) error + Retry; (11) arrived from a push, briefing pinned on top; (12) arrived from the widget, "Updated just now". Then 3 platform frames of the dense default: web 1440×900, web 390×844, Android 412×915.

DO NOT draw a full-page spinner for warming. Do not draw the quiet day as an empty state with an illustration or a "nothing here yet" tone. Do not show "Today starts with a place" to anyone who has a location. Do not reorder sections between tiers, and do not add a fifth tab or a floating action button.
