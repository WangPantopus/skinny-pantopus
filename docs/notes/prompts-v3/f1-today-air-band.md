# Air quality band (and the alert landing)
id: f1-today-air-band · platforms: web/ios/android · isNew: False · artboards: 23

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Air quality band and alert landing · f1-today-air-band

TYPE: EXTENSION of the existing designed screen "Today" (its air section). This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.

ATTACH: The current Today air section and the sections above and below it (weather, alerts) on iOS 393, Android 412, web 390 and web 1440. Also attach Today's location row in both the "Your household" and "Saved place · Only you" versions, and exports of the Foundations boards 00a–00d.

PLATFORMS & VIEWPORTS: iOS 393x852 (primary). Android 412x915. Web 390x844 and 1440x900. Draw the notification insets at true truncation widths for iOS 393 and Android 412.

WHERE IT LIVES & HOW PEOPLE ARRIVE
Today tab → Today → the air section, between weather and alerts. It is always drawn, including on clean-air days.
Entry points:
- Scrolling Today.
- An air alert push. It opens pantopus://today?section=air (web: /app/today?section=air), scrolls this section into view and highlights it once. The push fires when AQI crosses the person's chosen threshold (101, 151 or 201; default 101), for claimed homes and for the person's newest saved place.
- NOAA warning pushes, which land on the alerts section directly below. The same scope rule applies there.
- A tap on the widget's air hero. It opens pantopus://today?src=widget&section=air (web: /app/today?src=widget&section=air) and lands the same way, with no push involved.
- The "Air today" row of the Nearby compare scale strip.
While a crossing is active, Today's pinned slot links here for every arrival.
Hand-offs:
- The band's target opens the ProvenanceSheet air variant: "Preliminary reading from AirNow, observed 4:00 PM", "Covers: nearest monitors", and the report control "This reading looks wrong".
- The section header's overflow item, "Change or turn off alerts", opens Notification settings at Air & weather alerts. Changing or switching off alerts there never touches the pickup reminder or the briefings.

WHO AND WHEN
- Maya Chen at HOME A, Mon 19 Oct. She sees Good at 7:40 AM, then gets a Gorge-smoke alert at 4:00 PM.
- Jordan Lee at PLACE B, the same afternoon. He set his threshold to 151, and this is the first push Pantopus has ever sent him, about an address he only saved.

THE ONE JOB: Show where today's air sits on EPA's scale at a glance, and make an alert land on the crossing that caused it.

FIRST FIVE SECONDS: The eye lands on three things, in this order: (1) the value line "AQI 118 · Unhealthy for Sensitive Groups · PM2.5", (2) the band with its marker and the threshold rule "Crossed 101 at 4:00 PM", (3) EPA's health statement. On alert frames, the location row above carries the address and the ScopeChip. The only action is tapping the band for the source.

CONTENT (deltas to FIXTURES)
Section title: "Air quality index (AQI)". Category names are always EPA's full names.
PM2.5 sensitive-groups line, word for word (used wherever this prompt says "the PM2.5 line"): "People with heart or lung disease, older adults, children, and people of lower socioeconomic status are the groups most at risk."
- Good, HOME A, dated 7:40 AM.
  - Value line "AQI 42 · Good · PM2.5".
  - Health statement "Air quality is satisfactory, and air pollution poses little or no risk."
  - SourceCaption "● AirNow · nearest monitors · today · observed 7:00 AM".
- Unhealthy for Sensitive Groups alert, HOME A, dated 4:10 PM.
  - Location row "2418 NE Larkspur Loop" with the ScopeChip "Your household".
  - Value line "AQI 118 · Unhealthy for Sensitive Groups · PM2.5". Threshold rule at 101: "Crossed 101 at 4:00 PM".
  - EPA statement "Members of sensitive groups may experience health effects. The general public is less likely to be affected." Then the PM2.5 line.
  - PANTOPUS NOTE: "Smoke from the Gorge. Keep windows shut tonight."
  - Caption "● AirNow · nearest monitors · today · observed 4:00 PM".
- Unhealthy alert, PLACE B (Jordan, threshold 151), dated 4:10 PM.
  - Location row "1107 NE Birchfield Ct" with "Saved place · Only you".
  - Value line "AQI 176 · Unhealthy · PM2.5". Rule "Crossed 151 at 4:00 PM".
  - EPA statement "Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects." Then the PM2.5 line and the same PANTOPUS NOTE.
  - Caption "● AirNow · nearest monitors · today · observed 4:00 PM".
- Still unhealthy, PLACE B, dated 6:10 PM. Keep the PLACE B location row and the "Saved place · Only you" chip.
  - Value line "AQI 182 · Unhealthy · PM2.5". Rule still reads "Crossed 151 at 4:00 PM".
  - PANTOPUS NOTE second line: "Still above your alert level. No new alert for this episode."
  - Caption "● AirNow · nearest monitors · today · observed 6:00 PM".
  - The notification already delivered at 4:00 PM silently updates to "Unhealthy air: AQI 182"; no new banner or sound.
- Alert about a different saved place (frame 5): Maya's Today shows HOME A in the location row. Assume Maya's newest saved place is 1107 NE Birchfield Ct. The air section shows its own row "1107 NE Birchfield Ct · Saved place · Only you" above the value line, then the frame 3 content at threshold 101 ("Crossed 101 at 4:00 PM").
- Stale, HOME A, dated 6:10 PM, in a scenario where the afternoon reading never arrived: "AirNow · nearest monitors · observed 7:00 AM today — 11 hours ago".
- Very Unhealthy (for reference, not drawn): "Health alert: The risk of health effects is increased for everyone."
- Hazardous, worst case, HOME A, dated 4:10 PM, threshold 101: location row with "Your household"; value line "AQI 612 · Hazardous · PM2.5"; rule "Crossed 101 at 2:00 PM"; caption "● AirNow · nearest monitors · today · observed 4:00 PM".
  - The marker is clamped at the right end of the 301+ segment, and the number is printed.
  - EPA statement "Health warning of emergency conditions: everyone is more likely to be affected."
  - Then the PM2.5 line. No PANTOPUS NOTE.
- Pushes (PushCopy). Air alerts carry no notification actions.
  - PLACE B, at 151 or above: "Unhealthy air: AQI 176" / "AirNow, 4:00 PM". iOS Time Sensitive, Android HIGH. No street label, because Jordan has one place. It pairs with frame 3.
  - HOME A, below 151: this surface uses PushCopy V4 with a corrected title: "Unhealthy for Sensitive Groups" (30) / "AQI 118 · AirNow 4:00 PM · Larkspur Loop" (40). iOS Active, Android DEFAULT. It pairs with frame 2. This overrides the board's "Sensitive groups: AQI 118", which breaks the AqiBand rule that the short form is allowed only in the widget. Maya has a saved place, so her street label shows.
  - NOAA warnings are Time Sensitive and HIGH.
  - A worsening reading updates the existing alert instead of stacking a new one.
  - Placeholder "Air quality alert". Android public version "Pantopus · Air quality alert".
On Notes, mark all four EPA statements and the PM2.5 line "verify verbatim against EPA's AQI technical document before build". List every string you invent there too.

LAYOUT & VISUALIZATION
Draw one AqiBand (detail) exactly as on the Foundations board: six equal-width segments in ColorVision Assist hues ending in 301+, the board's range labels, 2px surface gaps and keyline, the dashed threshold rule with its number above it, and the two-tone halo marker placed within its segment, with the band name and number printed beside it in text.primary. Order within the section: value line, track, EPA statement, PANTOPUS NOTE, SourceCaption.
This surface overrides the board in two places only:
(1) The PANTOPUS NOTE holds the incident context "Smoke from the Gorge. Keep windows shut tonight." in place of the board's alert-level line; the alert level is already on the threshold rule, and changing it lives in the overflow.
(2) The still-above second line reads "Still above your alert level. No new alert for this episode.", because the re-alert rule is undecided.
- Address and ScopeChip:
  - When the alerted place is the place Today is showing, the location row carries the address and ScopeChip, and the section has no address row of its own.
  - Only when the alert is about a different saved place (frame 5) does the section show its own address row with ScopeChip above the value line.
- Web 1440: the section sits in Today's main column at 640 wide.
- Degraded states:
  - No reading: the same track greyed, no marker, and "No reading for this address right now".
  - Provider failed: the greyed track plus InlineErrorRow.
  - Stale: values stay, only this section greys, and its age is stated in words.
  - Loading: a WarmingSkeleton track outline at the final height.

INTERACTION, MOTION & HAPTICS
- The value line, track and SourceCaption form one target of at least 44pt (48dp, 44px) that opens the ProvenanceSheet.
- The EPA statement, the PANTOPUS NOTE, links and Retry sit outside that target.
- The 44pt (48dp, 44px) overflow button sits in the section header and holds "Change or turn off alerts". This is also a custom accessibility action.
- An alert or widget arrival scrolls once, moves accessibility focus to the band, and fades a highlight within 300ms. Under Reduce Motion, jump there, then fade.
- The marker does not animate on refresh.
- No haptics.

FOUNDATIONS COMPONENTS USED: AqiBand (variants: detail, no reading, alert, still above threshold with no new push; states: ready, stale, offline), ScopeChip, SourceCaption (live variant), FreshnessLine (per-fact stale), InlineErrorRow (provider unreachable), OfflineNotice, WarmingSkeleton (section), ProvenanceSheet (air reading), PushCopy (air).

ACCESSIBILITY
- Reading order: section title, address and scope, value line, band, statements, source.
- Spoken band label: "Air quality index 118, Unhealthy for Sensitive Groups, category 3 of 6. Your alert level 101, crossed at 4 PM. AirNow, observed 4 PM."
- Chart summary for assistive tech only: "Air is in category 3 of 6 on EPA's scale." It is followed by a list of the six categories and their ranges. That list is visible in the AX5 frame.
- The gaps and printed names carry the meaning in greyscale.
- Every target is at least 44pt (iOS), 48dp (Android) or 44px (web).

COPY: Use every string in CONTENT, plus these.
- Provider failed: "We couldn't reach AirNow just now" with "Retry air quality".
- Offline: "You're offline · as of 6:02 PM".
- OS blocks delivery while the in-app Air & weather alerts switch is on: one text.secondary line, no glyph, shown once, then gone. It reads "Notifications are off, so air alerts show only here." with the link "Notification settings". Someone who declined at the OS prompt sees no line.
- No place: "Today starts with a place" / "Save an address and Today will show its weather, air, alerts and dates." / "Preview an address".

EDGE CASES
- AX5: the value line wraps above a full-width track, and the category names move into the list below.
- Values over 500 are clamped, with the number printed.
- A claimed home always shows "Your household". A saved place always shows "Saved place · Only you".
- An alert about one saved place while Today shows another: the section's own address row names the alerted place (frame 5).
- No place: the section is not drawn, and no alert is ever sent.
- Notifications denied: the band renders fully in-app, with no amber.
- Slow network: keep the last reading and its age. Show a skeleton only on a cold load.

INSTEAD OF
- Instead of a proportional 0–500 track, draw six equal segments ending in 301+, because proportional widths squeeze the everyday 0–100 range to about a fifth of the bar.
- Instead of the standard EPA hues or a brand-blue ramp, draw ColorVision Assist hues with gaps and a keyline, because neighbouring standard hues fall below 3:1.
- Instead of writing the band name on the fill, print it in text.primary beside the marker, because text on yellow or maroon fails contrast.
- Instead of a paraphrase such as "satisfactory for everyone", print EPA's statement and put Pantopus context in the labelled PANTOPUS NOTE, because EPA lists inaccurate cautionary statements as a reporting error.
- Instead of a fixed 101 line, mark the threshold the person chose, because the landing must match the rule that fired.
- Instead of hiding the band on a clean day or a failed fetch, draw Good with its marker and No reading as a greyed track, because silence and failure must look different.
- Instead of an alert landing with no address, show the address and ScopeChip, because a first push about a saved address reads as surveillance without them.
- Instead of a line promising when the next alert will come, say only that there is no new alert for this episode, because the re-alert rule is still an open product decision.

DONE WHEN
- Each notification inset matches its landing on address, threshold and time (176 with frame 3, 118 with frame 2).
- Good, No reading, Stale and Offline are four visibly different pictures.
- Every frame reads correctly in greyscale, and the marker reaches 3:1 on every segment in light and dark, including maroon on the dark base.
- The still-unhealthy frame shows that no second push was sent.
- The different-saved-place frame names the alerted place without changing Today's location row.

ARTBOARDS
1. f1-today-air-band · ios · 01-good · light — dense default at 7:40 AM in Today
2. f1-today-air-band · ios · 02-alert-usg-household · light — arrived from push, highlight, rule at 101, address in the location row
3. f1-today-air-band · ios · 03-alert-unhealthy-saved-place · light — PLACE B, rule at 151, 4:10 PM
4. f1-today-air-band · ios · 04-still-unhealthy-no-new-push · light — PLACE B, AQI 182, observed 6:00 PM
5. f1-today-air-band · ios · 05-alert-other-saved-place · light — Today shows HOME A; the section's own row reads "1107 NE Birchfield Ct · Saved place · Only you" above the value line
6. f1-today-air-band · ios · 06-stale · light
7. f1-today-air-band · ios · 07-no-reading · light
8. f1-today-air-band · ios · 08-provider-failed · light
9. f1-today-air-band · ios · 09-offline · light
10. f1-today-air-band · ios · 10-notifications-blocked-switch-on · light — one neutral line
11. f1-today-air-band · ios · 11-no-place · light — Today starts with a place, no air section
12. f1-today-air-band · ios · 12-hazardous-over-500 · light — HOME A, 4:10 PM, crossed 101 at 2:00 PM
13. f1-today-air-band · ios · 13-loading · light
14. f1-today-air-band · ios · 14-tray · light — PushCopy insets: 176 (PLACE B, no label), 118 (Larkspur Loop), hidden-preview placeholder; no actions; levels "iOS Time Sensitive" and "iOS Active" printed as annotations outside the insets
15. f1-today-air-band · android · 14-tray · light — PushCopy insets: 176 and 118, collapsed, expanded, public version; levels "Android HIGH" and "Android DEFAULT" as annotations outside the insets
16. f1-today-air-band · android · 02-alert-usg-household · light
17. f1-today-air-band · web-390 · 02-alert-usg-household · light
18. f1-today-air-band · web-1440 · 03-alert-unhealthy-saved-place · light — main column, 640 wide
19. f1-today-air-band · ios · 15-ax5 · light — alert at AX5 with the six-range list
20. f1-today-air-band · ios · 16-greyscale · light — frame 2 in greyscale
21. f1-today-air-band · ios · 01-good · dark
22. f1-today-air-band · ios · 12-hazardous-over-500 · dark — maroon on the dark base
23. f1-today-air-band · Notes — this list:
- Assumptions: stale after 2 hours; Maya has a saved place, and it is 1107 NE Birchfield Ct (frame 5); frame 6 is its own scenario; the hazardous frame is HOME A at 4:10 PM, crossed 101 at 2:00 PM.
- EPA text to verify, and every invented string.
- Overrides of the AqiBand board: the PANTOPUS NOTE holds incident context instead of the alert-level line; the still-above line reads "Still above your alert level. No new alert for this episode." Questions for the contract owner: accept both.
- PushCopy V4 title "Sensitive groups: AQI 118" is replaced here by "Unhealthy for Sensitive Groups" with body "AQI 118 · AirNow 4:00 PM · Larkspur Loop"; the V4 board needs the same change. Question for the contract owner.
- The canonical "AirNow, 4:00 PM · Larkspur Loop" body would only apply if Maya's own alert crossed 151 and updated in place.
- Frame 4: the 4:00 PM notification silently updates to "Unhealthy air: AQI 182"; no new banner or sound.
- The re-alert rule is an open product decision.
- "Change or turn off alerts" supersedes the flow's "Turn these off".
- Audience: alerts go to claimed homes and each person's newest saved place (design doc). Open question: whether to widen alerts beyond the newest saved place, and how the different-place row behaves.
- Widening alerts to saved places must never widen pickup pushes.
- Dependency: the alert checker must read each person's threshold (101, 151 or 201) before the 151 frames can be true; today it fires at a fixed 101.
- Omitted: the widget arrival (same as frame 2, no push); the NOAA landing (alerts section); Very Unhealthy.

BATCH PLAN
Turn 1: 1-6, then wait for continue.
Turn 2: 7-12, then wait for continue.
Turn 3: 13-18, then wait for continue.
Turn 4: 19-23.
