# flow-10 · First air alert for a saved place → landing → change the alert level (journey storyboard)
id: flow-10 · platforms: ios/android/web-390 · artboards: 9

# flow-10 · First air alert for a saved place (journey storyboard)

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

TYPE: NEW (storyboard). Every screen in this journey already has its own designed project. Do not redesign any screen. Lay the screens out as one connected journey, redraw only the deltas listed for each frame, and draw the connections: trigger arrows, time gaps, moment-of-truth callouts, failure branches and where they rejoin.

ATTACH (exported artboards, by exact name):
- f1-today-tab · ios · 02-saved-place-quiet · light
- f1-today-tab · ios · 04-alert-pinned · light
- f1-today-air-band · ios · 02-alert-usg-household · light
- f1-today-air-band · ios · 03-alert-unhealthy-saved-place · light
- f1-today-air-band · ios · 04-still-unhealthy-no-new-push · light
- f1-today-air-band · ios · 05-alert-other-saved-place · light
- f1-today-air-band · ios · 06-stale · light
- f1-today-air-band · ios · 07-no-reading · light
- f1-today-air-band · ios · 09-offline · light
- f1-today-air-band · ios · 10-notifications-blocked-switch-on · light
- f1-today-air-band · ios · 11-no-place · light
- f1-today-air-band · ios · 14-tray · light
- f1-today-air-band · ios · 15-ax5 · light
- f1-today-air-band · android · 14-tray · light
- f1-today-air-band · android · 02-alert-usg-household · light
- f1-today-air-band · web-390 · 02-alert-usg-household · light
- f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now · light (source of the F00 inline ask)
- f4-briefing-optin-card · web-390 · 03-one-on-one-off · light (source of the collapsed night-before row)
- f5-today-calendar-strip · ios · 03-saved-place-unconfirmed · light
- x-provenance-sheet · ios · 07-no-link-air · light
- x-provenance-sheet · ios · 08-air-alert-report · light
- f4-notification-settings · ios · 08-landing-air · light
- f4-notification-settings · ios · 07-summary-and-time-sensitive · light
- f4-notification-settings · android · 03-default · light
- f4-notification-settings · android · 06-channel-blocked · light
- f4-notification-settings · web-390 · 09-saved-place · light
- f4-notification-settings · web-1440 · 14-save-error · light
- The Foundations boards (prompts 00a, 00b, 00c, 00d); the AqiBand and PushCopy specimens are on 00b and 00d.
Where a frame below says REDRAW, start from the named export and change only the listed deltas. Where it says NO EXPORT, draw it faithfully from the description, using Foundations components only.

PLACE B SETTINGS DELTAS (the "F05 deltas")
Several settings exports (ios 08, android 03, android 06) hold Maya's HOME A rows. Wherever a frame says "with the PLACE B deltas from F05", draw Jordan's rows instead: Briefings caption "Briefings follow your saved place, 1107 NE Birchfield Ct · Saved place · Only you"; "Morning briefing" OFF; "Evening briefing" ON at 6:00 PM with "Only when something needs you. No news means nothing's up.", "Pickup comes with the evening briefing." and "Nothing sent yet"; "Pickup day · Thursday (you set it)"; Household activity is the grey FactRow "Claim this address first"; "Bill and task reminders" hidden. No Tuesday, no Sam, no Larkspur Loop.

PERSONA & SITUATION
The person:
- Jordan Lee, 36, tier T1.
- His only place is PLACE B, 1107 NE Birchfield Ct, Camas, WA 98607 ("Saved place · Only you"). He moved from Portland on Fri 9 Oct and saved the place on Sat 10 Oct.
What he turned on (this storyboard follows flow-02's timeline):
- On Wed 21 Oct, after correcting his pickup day (City of Camas Thursday, now set by him to Thursday, recycling weekly), the pickup card's inline ask read "Remind you the night before? 6:00 PM" with "Pickup the night before. Air alerts when it's unhealthy. Nothing else unless you turn it on." He tapped "Turn on reminders", then Allow in the iOS dialog (flow-02 F09–F11).
- That grant applied the defaults: evening briefing on at 6:00 PM, morning off (still asking), Air & weather alerts on at "Unhealthy for Sensitive Groups · AQI 101 and up". The ask named air alerts, but he never saw the level.
The event:
- Fixture delta: the smoke event moves from the fixture's TODAY (Mon 19 Oct) to Mon 26 Oct 2026, so it follows his grant and does not collide with flow-02 F05 and flow-11 F01, which draw PLACE B quiet on Mon 19 Oct at 6:10 PM. The alert variant is unchanged: during a Gorge smoke event, AirNow reports AQI 118, Unhealthy for Sensitive Groups, at 4:00 PM.
- This is the first push Pantopus has ever sent him (his first pickup push is Wed 28 Oct), about an address he only saved. Because 118 is below 151, the push is Active on iOS and DEFAULT on Android, not Time Sensitive.
- The storyboard runs from Mon 26 Oct, 4:00 PM, to 6:10 PM the same day. Every frame says so ("Five days later · Mon 26 Oct").

GOAL: Understand which address the alert is about and why it came, and turn alerts down without losing the evening briefing that carries his pickup reminder.

§5 METRIC THIS JOURNEY MOVES
- Honesty (bar: 0): no push may misstate urgency or address.
- Returns by trigger (§5 week-one/four/eight buckets): session_open with meta { trigger: 'push' | 'organic', kind: 'alert' }. Beside each session_open caption, print the week: Jordan's day 0 is Sat 10 Oct, so Mon 26 Oct is week 3 (no §5 bucket). Alerts must not drive opt-outs.
- On Notes, propose (for founder approval, because §5 does not yet define it) an opt-out read: the Air group switched off, or its threshold raised, within 24 hours of a person's first alert. It reads the two invented settings events below.

EVENT CAPTIONS
Under every frame, print the event it writes, exactly as listed on that frame below. If a frame lists no event, print "no event". Never invent an event name. Names marked "(invented)" are proposals and go on Notes.

THE HAPPY PATH

F00 · context card (NO EXPORT; not a phone) · "Before this journey · Wed 21 Oct (flow-02 F09–F11)".
- A surface.base card holds a 25% thumbnail of flow-02 F09's inline ask (from f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now, with flow-02's deltas), with an arrow labelled "Turn on reminders → Allow".
- Under it, three result rows: "Evening briefing · on · 6:00 PM", "Morning briefing · off" and "Air & weather alerts · on · AQI 101 and up (default)".
- Event: evening_briefing_enabled (preference write; invented as an event name, drawn in flow-02 F11).
- MOMENT OF TRUTH: He turned on pickup reminders, and the ask named air alerts in one sentence. The first push he gets is about air, five days later, so the landing has to explain itself.

GAP: "Five days later · Mon 26 Oct, 4:00 PM"

F01 · iOS · ext:os-push-tray (lock screen) · Mon 26 Oct, 4:00 PM. REDRAW from the 118 inset of f1-today-air-band · ios · 14-tray, with the street label removed because Jordan has one place.
- Shows: title "Unhealthy for Sensitive Groups", body "AQI 118 · AirNow 4:00 PM", no actions.
- Annotation outside the inset: "iOS Active · Air & weather alerts · not Time Sensitive (below 151) · no action".
- Does: taps it at 4:02 PM.
- Carries: pantopus://today?section=air&src=alert, the PLACE B place id, threshold 101, crossing time 4:00 PM, and the episode id.
- Event: alert delivery · threshold 101 · episode opened (invented).
- MOMENT OF TRUTH: The urgency level matches the event. There is no house number, and the full EPA category name is used.

F02 · iOS · f1-today-tab, alert landing at the top · 4:02 PM. REDRAW from f1-today-tab · ios · 04-alert-pinned with these PLACE B deltas:
- Location row: "1107 NE Birchfield Ct" · "Saved place · Only you" · "Updated just now", on one line (not the two-line HOME A worst case).
- Pinned slot: AqiBand widget-micro with "Air quality index (AQI) 118 · Unhealthy for Sensitive Groups", "Crossed 101 at 4:00 PM · AirNow" and "See air quality ↓". It is highlighted once, has role=status and holds focus.
- Below it: no PickupCard (nothing tomorrow), no FirstWeekRow, and no QuietDayReceipt heading, because an alert is active.
- Then the 14-day card, redrawn from f5-today-calendar-strip · ios · 03-saved-place-unconfirmed with flow-02 F12's corrected pickup rows, advanced to the window Mon 26 Oct → Sun 8 Nov. Summary "Next 14 days: 4 items". The window holds exactly these four rows, in date order:
  1. Mon 26 Oct: "Register or update to vote: online or mail" · "Today · must arrive by Mon 26 Oct" (delta: the day itself reads "Today") · "In person: until 8:00 PM Tue 3 Nov" · region chip "Statewide — WA" · official. It is the only item that day, so the bar fills the whole Mon 26 cell, and the cell carries the today outline.
  2. Thu 29 Oct: "Recycling and garbage · in 3 days · Thu 29 Oct", two tick marks, 2px identity.home left rule, caption "You added this · Thursday · Repeats weekly".
  3. Fri 30 Oct: "Renters insurance renews" · "in 4 days · Fri 30 Oct" · "Repeats yearly", one tick mark.
  4. Thu 5 Nov: "Recycling and garbage · in 10 days · Thu 5 Nov", two tick marks, the same rule and caption.
  No "Set your pickup day" button, and no "You reported this · checking" line (in flow-02 the report resolves Tue 27 Oct; on Mon 26 Oct it is still checking, so the Thu 29 row carries "You reported this · checking").
- Briefing card (below the fold): collapsed to "The night before pickup · 6:00 PM · Change"; the morning row still asks.
In the frame:
- Does: taps "See air quality ↓".
- Event: session_open · trigger push · kind alert · week 3 (no §5 bucket).
- MOMENT OF TRUTH: The address, its scope, the number and the crossed level are all in the first viewport, and all four match the push.

F03 · iOS · f1-today-air-band, alert on his saved place · 4:02 PM. REDRAW from f1-today-air-band · ios · 03-alert-unhealthy-saved-place with these deltas:
- Value line "AQI 118 · Unhealthy for Sensitive Groups · PM2.5", with the two-tone marker in category 3 of 6.
- Dashed threshold rule at 101, captioned "Crossed 101 at 4:00 PM".
- EPA statement "Members of sensitive groups may experience health effects. The general public is less likely to be affected.", then the PM2.5 line "People with heart or lung disease, older adults, children, and people of lower socioeconomic status are the groups most at risk."
- PANTOPUS NOTE "Smoke from the Gorge. Keep windows shut tonight." and caption "● AirNow · nearest monitors · today · observed 4:00 PM".
- A 44pt overflow button in the section header, holding "Change or turn off alerts".
- The location row has scrolled off above. The section draws no address row of its own, because it is Today's own place.
- A small caption beside the frame: "scope shown above in F02 · location row off-screen".
In the frame:
- Does: taps the band. The value line, track and caption form one target.
- Event: no event.
- MOMENT OF TRUTH: The line drawn is the level that fired (101). It is not a fixed line and not a guessed default.

F04 · iOS · x-provenance-sheet, air alert payload. REDRAW from x-provenance-sheet · ios · 07-no-link-air, using the P4-alert content from 08-air-alert-report.
- PLACE B deltas: ScopeChip "Saved place · Only you", and the address "1107 NE Birchfield Ct, Camas, WA 98607".
- Shows: title "Where this fact comes from" and the label "Air quality index (AQI)". The AqiBand alert reads "AQI 118 · Unhealthy for Sensitive Groups · PM2.5", with its rule captioned "Crossed 101 at 4:00 PM". The legend line has "Official" emphasised. Source "AirNow · nearest monitors · observed 4:00 PM". Confidence "Preliminary reading from AirNow, observed 4:00 PM. It hasn't had EPA's full checks yet." Covers "The nearest AirNow monitors". The flat caption "No public page for this reading" replaces the source row. The foot has only "This isn't right".
- Inset: the report view with the single reason "This reading looks wrong" and "Send report". He does not send it.
- Does: taps Close. Focus returns to the band.
- Event: no event.
- MOMENT OF TRUTH: The reasons fit a reading. "The date is wrong" and schedule reasons are absent.

F05 · iOS · f4-notification-settings, landing at ?group=air (/app/settings/notifications?group=air), reached from the band overflow "Change or turn off alerts". REDRAW from f4-notification-settings · ios · 08-landing-air, with the PLACE B deltas from web-390 · 09-saved-place.
Briefings group:
- Caption "Briefings follow your saved place, 1107 NE Birchfield Ct · Saved place · Only you".
- "Morning briefing" is OFF.
- "Evening briefing" is ON at 6:00 PM, with "Only when something needs you. No news means nothing's up.", "Pickup comes with the evening briefing." and the status "Nothing sent yet".
- "Pickup day · Thursday (you set it)" (delta: replaces "Pickup day · Not set · Set it" and removes the caption "The city lists Thursday. Set your pickup day to get the night-before reminder.").
Other groups:
- Household activity is the grey FactRow "Claim this address first".
- "Bill and task reminders" is hidden.
Air & weather alerts group:
- It is highlighted, with focus on its header. The master is ON, with its helper.
- Draw two states side by side:
  - (a) Landing: "Unhealthy for Sensitive Groups · AQI 101 and up" is selected, and nothing has changed.
  - (b) After his tap: "Unhealthy · AQI 151 and up" is selected, with a trailing checkmark and bold label, and "Saved" under the row. No haptic (house style keeps the one light tick for confirm only).
In the frame:
- Carries: threshold 151 to the server. The episode id is unchanged.
- Event: (a) no event; (b) settings · air threshold 101→151 (invented).
- MOMENT OF TRUTH: Alerts have their own switch and level. Changing them does not touch the evening briefing or the pickup row, and the landing by itself changes nothing.

F06 · iOS · f1-today-air-band after Back · 4:06 PM. REDRAW from F03 with these deltas:
- The dashed threshold rule moves to 151, with its number above it. There is no "Crossed" caption, because 118 is below his level.
- A second PANTOPUS NOTE line reads "Your alert level is now 151.".
- Beside it, a thumbnail of Today's top shows the pinned slot empty, because the reading no longer crosses his level.
- The delivered 4:00 PM notification is unchanged.
- Event: no event.
- MOMENT OF TRUTH: The band always draws the level he chose, right after he chooses it.

GAP: "Two hours later · Mon 26 Oct, 6:00–6:10 PM"

F07 · iOS · lock screen · 6:00 PM (NO EXPORT for this state; start from the F01 inset).
- Tag on the frame, in text.primary: "OPEN DECISION · update in place below the new level?" The frame draws the proposed answer (update in place); the founder may instead leave the 4:00 PM notification untouched.
- The same notification, updated in place: title "Unhealthy for Sensitive Groups", body "AQI 124 · AirNow 6:00 PM".
- Annotation: "proposed: updated in place · no new banner, sound or vibration".
- No evening briefing push: nothing is due Tue 27 Oct, and the air item was already carried by the alert (one push per trigger per day).
- Event: alert updated in place · no new delivery (invented).
- MOMENT OF TRUTH: One notification per episode. If the tray updates, it tells the current truth without interrupting again.

F08 · iOS · Today, organic open · 6:10 PM. REDRAW from f1-today-air-band · ios · 04-still-unhealthy-no-new-push with these deltas:
- Location row "1107 NE Birchfield Ct · Saved place · Only you · Updated just now".
- Value line "AQI 124 · Unhealthy for Sensitive Groups · PM2.5", with the marker in category 3.
- Dashed rule at 151, not crossed.
- The EPA USG statement and the PM2.5 line.
- PANTOPUS NOTE "Smoke from the Gorge. Keep windows shut tonight." and "Your alert level is now 151.".
- Caption "● AirNow · nearest monitors · today · observed 6:00 PM".
- No QuietDayReceipt heading.
In the frame:
- Event: session_open · trigger organic · week 3 (no §5 bucket).
- MOMENT OF TRUTH: The band and settings say 151, and no new banner came.

LAYOUT
Artboards and lanes:
- Each lane artboard is 2400 wide, as tall as needed, on surface.app.
- It has four bands, top to bottom:
  1. A header strip with the visible artboard name and a one-line summary of the lane.
  2. The MARGIN LANE. Each moment-of-truth callout is a surface.base card with the overline "MOMENT OF TRUTH · " followed by the frame id as written, and one sentence, joined to its frame by a 1px text.secondary leader line.
  3. The HAPPY LANE: frames left to right at 50% scale (iOS 196.5x426, Android 206x457.5, web-390 195x422), 64px apart.
     - Above each frame: its label, made of the frame id as written (F00…F08, X01…X12), then the surface id, the state and the platform.
     - Under it: the device date and time, then the event caption, then any "REDRAWN FROM" caption naming the artboard and its deltas.
  4. The FAILURE LANE: branch frames at 50% scale, labelled with the branch id as written and what went wrong.
     - A dashed arrow runs up to the frame where the branch starts.
     - A second dashed arrow, labelled "rejoins" plus the frame id as written, runs into the frame where the branch rejoins.
     - A branch that ends without an alert or without recovery ends in a labelled stop bar.
Arrows, gaps and insets:
- Arrows are 1.5px text.secondary lines with solid heads.
- Each arrow is labelled by its trigger, on a surface.base pill in label 13/18 text.strong: "push at 4:00 PM", "tap", "See air quality ↓", "tap band", "Close", "Change or turn off alerts", "Back", "organic open".
- A time jump is a 96px gap with a dashed vertical rule and a label on surface.sunken in text.strong.
- Lock screens are greyed generic system chrome with no wallpaper, labelled "system UI, not Pantopus".
- Every push inset carries its level (iOS Active / Time Sensitive, Android DEFAULT / HIGH) as an annotation outside it.
Focus map and handoff checks:
- On artboard 05, the focus-map row holds F01–F08 and F05(b) at 50%, 64px apart, as copies of the lane frames; print each spoken string under its frame, never beside it.
- Row 2 of artboard 05 (the no-notifications path) is 25% copies (98x213) of existing frames, including the web-390 frames copied from artboard 4. Nothing on row 2 is redrawn.
- Handoff-check thumbnails on artboard 06 are copies of the lane frames at 25% (98x213), not redraws.
Colour and paired frames:
- The AqiBand keeps its EPA ColorVision Assist hues. Nothing else in the storyboard uses those hues or any red or amber.
- F00 sits at the far left of artboard 1, before the Mon 26 Oct gap and F01, as a narrower card.
- The side-by-side states in F05 share one bracket label.

FAILURE BRANCHES (lower lanes, by artboard)
Under F00–F03:
- X01 · No reading. Frame: f1-today-air-band · ios · 07-no-reading, with the PLACE B chip. The track is greyed, with no marker, and reads "No reading for this address right now". It must look different from Good. No alert is sent; end with a stop bar.
- X02 · Stale observation. Frame: f1-today-air-band · ios · 06-stale, with PLACE B values: "AirNow · nearest monitors · observed 7:00 AM today — 9 hours ago" (delta: the export says 11 hours, which does not fit 4:02 PM). The age is stated in words, and only the band greys. Rejoins F03 once a new reading lands.
- X03 · Offline at the landing. Frame: f1-today-air-band · ios · 09-offline, with the PLACE B location row ("1107 NE Birchfield Ct") and ScopeChip "Saved place · Only you", "You're offline · as of 4:01 PM" (delta, to fit the 4:02 PM landing) and the cached band. Rejoins F03.
- X04 · A reading at 151 or above (the Time Sensitive variant).
  - Frame: the 176 inset of f1-today-air-band · ios · 14-tray, "Unhealthy air: AQI 176" / "AirNow, 4:00 PM", annotated "iOS Time Sensitive · Android HIGH · can come through Focus".
  - It lands on F02's layout with 176 values: pinned "Air quality index (AQI) 176 · Unhealthy" and "Crossed 101 at 4:00 PM · AirNow".
  - "See air quality ↓" then goes to the band: f1-today-air-band · ios · 03-alert-unhealthy-saved-place with these deltas: the rule at 101 (the export draws 151), "Crossed 101 at 4:00 PM", and "observed 4:00 PM" (the export says 4:10 PM).
  - Inset: f4-notification-settings · ios · 07-summary-and-time-sensitive, with "Time Sensitive is off in iOS Settings. Alerts may wait until Focus ends. · Open Settings". Only the Air group's helper mentions Focus.
  - Event on landing: session_open · trigger push · kind alert · week 3 (no §5 bucket). Rejoins F04.
- X05 · No place or no location. Frame: f1-today-air-band · ios · 11-no-place. No alert is ever sent, and there is no air section. Stop bar.
Under F04–F06:
- X06 · Android channel blocked.
  - Frame: f4-notification-settings · android · 06-channel-blocked, with the PLACE B deltas from F05. The Air group is off and disabled, reads "Off in Android settings · Open", and keeps the saved threshold.
  - No push arrives. Jordan finds the crossing on an organic open: the Android landing on artboard 4 without the arrival highlight (session_open · trigger organic · week 3).
  - The in-app line from f1-today-air-band · ios · 10-notifications-blocked-switch-on, "Notifications are off, so air alerts show only here.", drawn in Android chrome, shows once.
  - Rejoins the F02 moment (Android landing, artboard 4).
- X07 · Threshold save fails. Pattern from f4-notification-settings · web-1440 · 14-save-error, drawn in iOS chrome. The selection returns to "AQI 101 and up", with the InlineErrorRow "Couldn't save Air & weather alerts. Check your connection and try again. · Retry". Event: no event. Rejoins F05(b).
- X08 · Air alerts switched off entirely. In F05 he turns the Air master off (event: settings · air alerts off (invented)). The evening briefing and the pickup row stay as they were. The band still renders on Today with no amber, and no "notifications are off" line shows, because he chose this. Rejoins F08, with no rule line drawn.
- X09 · Report sent from F04. The receipt reads "Reported Mon 26 Oct. We'll check it against AirNow by Mon 2 Nov and tell you here.", then the sheet closes. Event: report · reason this reading looks wrong (invented). Rejoins F05.
Under F07–F08:
- X10 · Air climbs past his new level: AQI 182 at 6:00 PM.
  - Frame: f1-today-air-band · ios · 04-still-unhealthy-no-new-push as exported, with the rule captioned "Crossed 151 at 6:00 PM" and "Still above your alert level. No new alert for this episode.". The tray silently updates to "Unhealthy air: AQI 182" / "AirNow, 6:00 PM".
  - Tag: "OPEN DECISION · Is crossing a newly raised level inside the same episode a new alert? The re-alert rule is undecided."
  - Stop bar.
- X11 · An alert for a saved place that Today does not use.
  - Frame: f1-today-air-band · ios · 05-alert-other-saved-place, where Maya's Today shows HOME A and the section's own row reads "1107 NE Birchfield Ct · Saved place · Only you". That export reuses PLACE B as Maya's newest saved place, an assumption carried over from the air-band project; label it so on the frame.
  - Tag: "OPEN · Which saved places alert? Today: claimed homes and each person's newest saved place."
- X12 · iOS Scheduled Summary holds an Active air alert (below 151).
  - No settings caption covers air today; f4-notification-settings 07 names only pickup.
  - Tag: "OPEN · Say 'Your iPhone may hold air alerts below 151 for your summary'?"
  - The pinned slot on Today is the in-app guarantee. Rejoins F02 as an organic open.

HANDOFF CHECKS (draw each on artboard 06 as a pair of 25% thumbnails and a one-line rule)
- HC01 · F00 and F01 must agree on what he turned on. The ask he answered (flow-02 F09, NotificationAsk contract) names air alerts: "Pickup the night before. Air alerts when it's unhealthy. Nothing else unless you turn it on." Settled on this path. Still open: f4-briefing-optin-card's row caption does not say so, and Yes on that card also grants air alerts at 101.
- HC02 · F01 and F02 must agree on place, number, time and level: "AQI 118", "4:00 PM", "101". The body carries no street label, because he has one place. The landing's location row carries "1107 NE Birchfield Ct · Saved place · Only you".
- HC03 · F01 must match the level rules: AQI 118 is Active on iOS and DEFAULT on Android. Time Sensitive and HIGH apply only at 151 or above, or for a NOAA warning. f1-today-air-band's Jordan fixture (threshold 151, AQI 176, Time Sensitive) is replaced in this journey. The research brief's canonical push list has only "Unhealthy air: AQI 176" / "AirNow, 4:00 PM · Larkspur Loop"; it must add the below-151 variant "Unhealthy for Sensitive Groups" / "AQI 118 · AirNow 4:00 PM" (with " · <street>" only when the person has more than one place).
- HC04 · F02 and F03 must agree on where the push lands. It lands at the top of Today (the location row plus the pinned slot), and "See air quality ↓" scrolls to the band. f1-today-air-band's entry text ("scrolls this section into view") must change, because a band scrolled away from the location row shows no address for Today's own place. X04 follows the same rule.
- HC05 · F02, F03, F04 and F05(a) must agree on the level: 101 = settings default = server. The 151 default in flows-spec and in older settings copy is superseded.
- HC06 · F03 and F05 must agree on the entry. f4-notification-settings must list "Change or turn off alerts" (the air band overflow, landing on ?group=air) among its entry points. flows-spec's "Turn these off" stays only on Mail's NotificationRow.
- HC07 · F05(b), F06 and F08 must agree that the level is now 151: the band rule, the pinned slot (now empty), settings, and the ProvenanceSheet's spoken alert summary. x-provenance-sheet hard-codes "above your 101 alert level" and must read the person's level.
- HC08 · F05 must leave the evening briefing at ON, 6:00 PM, and the pickup row at "Pickup day · Thursday (you set it)" (flow-02 HC16) when the threshold changes.
- HC09 · F04 and the x-provenance-sheet P4-alert payload must agree on scope: "Saved place · Only you" at PLACE B (08 draws "Your household"). The only reason offered is "This reading looks wrong".
- HC10 · F07 and F08 must agree on the latest reading: AQI 124, observed 6:00 PM, and neither shows a second banner. Whether the tray copy updates at all is the F07 open decision.
- HC11 · The short form "AQI 118 · Sensitive groups" is allowed only in the widget (f7-today-widget). The push, the pinned slot and the band use "Unhealthy for Sensitive Groups".
- HC12 · F00's permission history must agree across projects: Jordan allows on Wed 21 Oct from the pickup card's inline ask (flow-02 F09–F11). f1-today-tab · ios · 02-saved-place-quiet's never-asked briefing card is right for Mon 19 Oct; by Mon 26 Oct the card is collapsed (F02 delta). Resolved by re-anchoring. If the founder instead keeps the earlier Sat 10 Oct premise, label every frame "ALT TIMELINE".
(Resolved in v2 and not drawn: f3-household-notifications already lists all five groups, including Air & weather alerts.)

ACCESSIBILITY IN THE JOURNEY (artboard 05, row 1: a numbered focus ring on each frame and the spoken string under it)
Placeholders:
- F01's hidden-preview placeholder is "Air quality alert". The Android public version is "Pantopus · Air quality alert".
Focus after each transition:
- F01→F02: focus lands on the pinned card (role=status). Its label begins with the place: "1107 NE Birchfield Ct, saved place. Air quality index 118, Unhealthy for Sensitive Groups. Crossed your alert level 101 at 4 PM. AirNow."
- F02: the strip is one adjustable element ("Next 14 days: 4 items. Next: Register or update to vote, today.").
- F02→F03: "See air quality ↓" moves focus to the section heading "Air quality index (AQI)", then the band. The band is spoken "Air quality index 118, Unhealthy for Sensitive Groups, category 3 of 6. Your alert level 101, crossed at 4 PM. AirNow, observed 4 PM."
- F03→F04: focus lands on the sheet title "Where this fact comes from". Close returns focus to the band.
- F03→F05:
  - "Change or turn off alerts" is also a custom action on the band.
  - The landing moves focus to the Air group header, then its first control.
  - Threshold rows are spoken like "Unhealthy, AQI 151 and up, selected, 2 of 3".
  - "Saved" is a polite status and never moves focus.
- F05→F06: Back returns focus to the overflow button. The band now says "Your alert level 151".
- F08: the organic open lands at the top. The band reads "Air quality index 124, Unhealthy for Sensitive Groups, category 3 of 6. Your alert level 151. AirNow, observed 6 PM."
Motion, size, contrast and haptics:
- Reduce Motion: jump to the target, and use a static highlight that clears on the next interaction.
- AX5: use f1-today-air-band · ios · 15-ax5 as the reference. The six-range list is visible, and the settings threshold rows wrap with their meanings.
- Greyscale: the band reads by printed names and gaps.
- Haptics: none in this journey (no confirm or Save tick occurs; the threshold change is announced by the "Saved" status only).
The no-notifications path (artboard 05, row 2, 25% copies):
- If notifications are blocked (X06) or were never allowed, the crossing is still found on an organic open: F02 without the arrival highlight, with the same pinned slot and the same numbers.
- Web-390 (no browser alert channel exists yet): copy the two web-390 frames from artboard 4 at 25% (the organic landing and the settings page).

INSTEAD OF
- Instead of Time Sensitive for AQI 118, send it Active and DEFAULT, because urgency must match the category.
- Instead of landing scrolled to the band, where the address is off-screen, land at the top with the pinned slot, because a first push about a saved address reads as surveillance without the address.
- Instead of keeping the 101 line after he changes his level, draw 151 everywhere, because the landing must match the rule he chose.
- Instead of a mute action on the notification, send air alerts with no actions and change the level in settings, because the level needs its meaning beside it.
- Instead of a second push when the reading worsens, keep one interruption per episode (whether the delivered one updates is an open decision), because one episode gets one interruption.
- Instead of promising when the next alert will come, state only his level, because the re-alert rule is undecided.
- Instead of turning all notifications off from the band, open settings at the Air group, because the evening briefing must survive.
- Instead of a separate permission story for this storyboard, follow flow-02's grant on Wed 21 Oct, because one person has one permission history.
- Instead of Maya's settings rows on Jordan's Android and blocked frames, apply the F05 deltas, because one lane holds one person.

DONE WHEN
- The push, the landing, the band, the ProvenanceSheet and settings agree on address, scope, number, time and level at every step.
- The first alert is Active and DEFAULT, with no house number, on Mon 26 Oct, after the Wed 21 Oct grant.
- Changing the level leaves the evening briefing and pickup rows untouched, and every surface redraws at 151.
- Two hours later there is no new banner; the in-place tray update is drawn and tagged as an open decision.
- The F02 strip prints "Next 14 days: 4 items" and all four rows.
- No reading, stale, offline and blocked are visibly different pictures, each with its recovery.
- The open decisions (F07, X10, X11, X12) are tagged, not resolved silently.
- No Maya row (Tuesday, Sam, household) appears on a Jordan settings frame.
- Every frame carries a literal event caption or "no event", and no event name is invented beyond those marked "(invented)".
- All 12 handoff checks are drawn.
- Every date carries its weekday, and every frame reads correctly in greyscale.

ARTBOARDS
1. flow-10 · storyboard · 01-alert-to-landing · light — F00, the Mon 26 Oct gap, F01–F03 with the margin callouts, failure lane X01–X05.
2. flow-10 · storyboard · 02-source-and-alert-level · light — F04, F05 (a and b), F06, failure lane X06–X09.
3. flow-10 · storyboard · 03-two-hours-later · light — the gap, F07–F08, failure lane X10–X12.
4. flow-10 · storyboard · 04-android-and-web · light — the same moments on Android and web:
   - Android: the 118 inset of f1-today-air-band · android · 14-tray, without the street label (DEFAULT; public version "Pantopus · Air quality alert"); the landing from f1-today-air-band · android · 02-alert-usg-household with PLACE B values (also the X06 rejoin point); and the settings page from f4-notification-settings · android · 03-default with the PLACE B deltas from F05 and the Air group in M3 radio rows, 151 selected.
   - Web-390: an organic landing redrawn from f1-today-air-band · web-390 · 02-alert-usg-household with PLACE B values (session_open · trigger organic · week 3), then f4-notification-settings · web-390 · 09-saved-place with the threshold rows and the pickup row "Pickup day · Thursday (you set it)". No push.
5. flow-10 · storyboard · 05-focus-and-no-notifications · light — row 1: the focus map across F01–F08, spoken strings under the frames. Row 2: the no-notifications path (25% copies).
6. flow-10 · storyboard · 06-handoff-checks · light — HC01–HC12.
7. flow-10 · storyboard · 07-notes · light — this list:
- Recast from flows-spec: Luis Ortega, "Mom's house", "Lacamas Dr", AQI 176, Time Sensitive, the 151 default and "201+" become Jordan Lee, PLACE B (his only place, no street label), AQI 118 at 4:00 PM, Active/DEFAULT, the 101 default and a change to 151. "Turn these off" becomes "Change or turn off alerts" on this path. "Mom's house" does not survive: X11 uses Maya's export f1-today-air-band 05, which names Maya's saved place as 1107 NE Birchfield Ct (Jordan's PLACE B), an assumption carried over from the air-band project.
- Premise and fixture delta: this storyboard follows flow-02's timeline. Jordan allows notifications on Wed 21 Oct from the pickup card's inline ask. The smoke event is Mon 26 Oct at 4:00 PM (fixture TODAY: Mon 19 Oct; alert variant AQI 118, 4:00 PM, unchanged).
- PLACE B settings deltas: android 03 and 06 and ios 08 were drawn with Maya's rows; this storyboard applies Jordan's rows (the F05 deltas) wherever they appear.
- Cross-flow: flow-02 F05 and flow-11 F01 show PLACE B quiet on Mon 19 Oct at 6:10 PM; moving the smoke event to Mon 26 Oct keeps them true. The founder confirms which evening carries the smoke event. flow-11 (labelled ALT TIMELINE) keeps Jordan's notifications off, which still conflicts with flow-02 and this storyboard.
- Invented strings: "AQI 124"; "AQI 124 · AirNow 6:00 PM"; "Your alert level is now 151."; "Nothing sent yet"; the F00 card rows and header; the F02 strip deltas ("Today · must arrive by Mon 26 Oct", "in 3 days · Thu 29 Oct", "in 4 days · Fri 30 Oct", "in 10 days · Thu 5 Nov"); the spoken landing label that begins with the place; "Couldn't save Air & weather alerts. Check your connection and try again. · Retry"; "Crossed 151 at 6:00 PM"; the X02 "9 hours ago" and X03 "as of 4:01 PM" deltas; the X09 receipt dated Mon 26 Oct / Mon 2 Nov; "scope shown above in F02 · location row off-screen"; every annotation, tag and event caption.
- Invented event names: "alert delivery · threshold 101 · episode opened"; "alert updated in place · no new delivery"; "settings · air threshold 101→151"; "settings · air alerts off"; "report · reason this reading looks wrong"; "evening_briefing_enabled" printed as an event (in §5 it is a preference field). The two settings events feed the proposed opt-out read.
- Proposed §5 opt-out read (founder approval): the Air group switched off (settings · air alerts off) or its threshold raised (settings · air threshold …) within 24 hours of a person's first alert delivery.
- Proposed research-brief addition: the below-151 canonical push "Unhealthy for Sensitive Groups" / "AQI 118 · AirNow 4:00 PM" (HC03).
- House-style exception: none. The threshold change plays no haptic; "Saved" is its only feedback.
- Verify verbatim against EPA's AQI technical document: the USG and Unhealthy statements and the PM2.5 sensitive-groups line.
- Activation note: Jordan is not activated under §5 (nothing qualifying within 7 days of Sat 10 Oct), so his Mon 26 Oct opens fall outside the "among activated" returns block.
- Open decisions:
  - the re-alert rule after a level change (X10);
  - whether a worse reading that is still below the person's new level updates the delivered notification (F07, tagged);
  - the Scheduled Summary caption for air (X12);
  - which saved places alert (X11);
  - whether a browser alert channel exists;
  - whether the quiet heading may ever show on a day an alert fired;
  - whether f4-briefing-optin-card's row caption must name air alerts (HC01);
  - the proposed opt-out read for §5.
- Dependency: the alert checker must store and read each person's level (101, 151 or 201) before F05–F08 can be true.
- Omitted: dark twins, the NOAA landing, Very Unhealthy and Hazardous (all drawn in the air band project).

BATCH PLAN
Turn 1: artboards 1–2, then wait for "continue".
Turn 2: artboards 3–4, then wait for "continue".
Turn 3: artboards 5, 6 and 7.
