# Air quality band (and the alert landing)
id: f1-today-air-band · platforms: web/ios/android · isNew: False · frames: 13

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SECTION: Air quality band, and the alert landing.
PLATFORMS/VIEWPORTS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
THIS IS an EXTENSION of the existing designed screen "Today" — specifically its air section, which already exists and is already designed in the Pantopus design system. Open it, keep everything, and change only what is listed below.

WHERE IT LIVES: Today tab → Today → air section, between weather and alerts (four-tab IA: Place · Today · Nearby · Mail). Reached by: scrolling Today, always; tapping an AQI ≥ 101 or NOAA alert push, which deep-links to this section scrolled into view; the Nearby compare scale strip's "Air today" row.

THE ONE JOB: make the one genuinely canonical scale in the product legible at a glance, and make an alert push land on a screen that shows the crossing that caused it.

CONTENT (today = Monday 19 October 2026; 2418 NW Lacamas Dr, Camas, WA 98607). Default: "42", band name "Good", "PM2.5", health message "Air quality is satisfactory for everyone.", "Observed 3:00 PM · AirNow". Moderate alert: "118", "Unhealthy for Sensitive Groups", PM2.5, "Smoke from the Gorge. Sensitive groups should limit time outdoors.", "Observed 4:00 PM · AirNow". Critical alert: "176", "Unhealthy", "Everyone should limit time outdoors. Keep windows shut tonight." Alert variants also carry the address label "2418 NW Lacamas Dr" with its "Saved place · Only you" chip, so the notification and the screen agree about which address this is about. No-reading copy: "No reading for this address right now". Stale copy: "Observed 6:00 AM · AirNow — 9 hours ago". Push tray card: "Air is unhealthy for sensitive groups at 2418 NW Lacamas Dr".

THE VISUALIZATION DECISION: a six-band horizontal scale bar in the EPA colours users already recognise — Good 0–50, Moderate 51–100, Unhealthy for Sensitive Groups 101–150, Unhealthy 151–200, Very Unhealthy 201–300, Hazardous 301+ — segment widths proportional to their ranges, with a marker sitting at the index and the band name printed beside it, not underneath it. These six EPA hues are the single sanctioned exception to the token rule because the scale is the fact; every other pixel here (card, labels, marker stalk, caption, chip) uses Pantopus tokens. On alert variants, mark the 101 threshold on that same bar with a thin rule so the push's cause is visible in one glance. Render the band ALWAYS, on healthy days included — today a good day and a failed fetch both render as nothing, which is the failure this section exists to fix, so "No reading" must look obviously unlike "Good": same bar drawn greyed with no marker, not a hidden section.

STATES — 10 frames on iOS 393×852: reading present (42, Good); no reading; alert moderate (118); alert critical (176); saved place with chip; claimed home without chip; stale observation with the age stated; OS notification permission denied — band renders in-app, one quiet line saying alerts are off; location source none — band renders, never alerts; offline. Plus 1 frame of the push-tray card, and 2 platform frames of the moderate alert: web 390×844 and Android 412×915.

DO NOT hide the band on a clean-air day, and do not show the number without the bar — 42 alone says nothing about where it sits or how far 101 is. Do not restyle the EPA ramp into the sky-blue brand ramp or into a generic green-to-red gradient with invented stops. Do not let "No reading" read as Good. For a saved-place user this is often the first push Pantopus ever sends about an address they merely bookmarked, so never drop the "Saved place · Only you" chip from an alert landing — without it the push reads as surveillance.
