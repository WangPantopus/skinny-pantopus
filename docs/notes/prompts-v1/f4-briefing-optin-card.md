# Briefing opt-in card (morning + night-before)
id: f4-briefing-optin-card · platforms: web/ios/android · isNew: False · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Briefing opt-in card on Today
THIS IS: an EXTENSION. The host screen is "Today" — this already exists and is already designed in the Pantopus design system - open it, keep everything, and change only what is listed below. You are adding ONE new card, and deleting the home-gated briefing opt-in currently buried inside web's Today detail.
PLATFORMS: mobile web 390x844 (primary), iOS 393x852, Android 412x915.
WHERE IT LIVES IN THE FOUR-TAB IA: Today tab, below the day's content, above the first-14-days progress row. Its durable twin is Settings > Notifications.
HOW THE USER GETS HERE: scrolling Today; also reachable after a first pickup confirmation, which scrolls to and highlights this card.
THE ONE JOB: let a user who has only SAVED an address — no claimed home, no verification — switch on the morning and night-before briefings in place.

CONTENT (verbatim strings, drawn in situ under a populated Today for 2418 NE Ingle Rd, Camas WA: 61F partly cloudy, AQI 138 band, pickup lead card "Recycling and garbage tomorrow"):
  Card: two ask rows.
  Row 1: "A morning heads-up?" - Yes / Not now. Expanded chips: 6:30am - 7:00am - 7:30am - 8:00am.
  Row 2: "The night before pickup?" - Yes / Not now. Expanded chips: 5:00pm - 6:00pm (default, selected) - 7:00pm - 8:00pm.
  The silence contract, stated ONCE for the whole card: "Only when something needs you. No news means nothing's up."
  Collapsed on-state row: "6:00pm - Change". Timezone caption: "Pacific Time."
  Permission line: "Notifications are off for Pantopus" + "Open settings".

THE VISUALIZATION DECISION:
  ONE card, two switch rows stacked inside it, each expanding IN PLACE into a horizontal chip row directly beneath its own switch — never two competing cards, never a modal, never a separate time picker screen. The expansion pushes the card taller; the rest of Today reflows below it. The amber permission line, when present, sits ABOVE both rows as a single full-width line inside the card, so a switch physically cannot render "on" above an unread warning. Once both are on, both rows collapse to a single value+Change line each and the card shrinks to roughly a third of its expanded height — an on state should take less room than an ask, so Today gets quieter as the user commits.

STATES TO DRAW (each its own frame; 8 on mobile web, then repeat "both on, collapsed" and "OS denied" once each on iOS and Android = 10 frames):
  never asked - one on / one off - both on (collapsed) - saving - save error - OS notifications denied (amber line, "Open settings", and the "Put today on your home screen" widget row promoted ABOVE this card) - asked and declined (card absent: draw Today with the slot closed) - no location (card absent: Today shows "Today starts with a place")

DO NOT: do not let a toggle read "on" while the OS is denying delivery, and do not split this into two cards or promote it to a modal — the merge is the point. No confetti or success illustration on opt-in. Do not gate either row behind owning or verifying a home.
