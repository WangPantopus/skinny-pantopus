# flow-07 · Widget discovery → add → glance → tap (journey storyboard)
id: flow-07 · platforms: android/ios · artboards: 9

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

JOURNEY: flow-07 · Widget discovery → add → glance → tap

TYPE: NEW (storyboard). Every screen in this journey was already designed in its own project. Do not redesign any screen here. Lay the screens out as one connected sequence, so the founder can check three things: what is carried from each step to the next, what the person sees at each moment of truth, and where each failure branch leads. Where an attached export disagrees with this prompt, follow this prompt (the recast below) and list the disagreement on the Notes artboard.

ARTBOARD NAMING: Storyboards use "storyboard" in the platform slot of the house-style name, so every artboard here reads "flow-07 · storyboard · <NN-name> · light". Frames inside an artboard keep their own source names in their labels.

ATTACH (exported artboards, by exact name):
- f4-briefing-optin-card · ios · 17-declined-at-os-widget-offer · light (redraw on Android for step 1)
- f4-briefing-optin-card · android · 19-denied-once-reask · light (Android card chrome; handoff check 21)
- f4-briefing-optin-card · web-390 · 07-pickup-ask-declined · light (night-before row absent, morning row asking; step 1 card state)
- f4-today-pickup-card · ios · 16-notifications-denied-widget-offer · light (handoff check 1)
- f4-today-pickup-card · ios · 03-confirmed-just-now-reminder-ask · light (handoff check 22: the first-confirm reminder ask)
- f4-notification-primer · ios · 05-declined-at-os · light (handoff checks 1 and 20)
- f4-notification-settings · android · 03-default · light (handoff check 13: only its air threshold row)
- f1-today-tab · android · 01-dense-home · light
- f1-today-tab · ios · 01-dense-home · light (source of the settled confirmed PickupCard string)
- f1-today-tab · ios · 07-from-widget · light (handoff check 8)
- x-place-file · ios · 01-dense-home · light (redraw on Android for step 2)
- x-place-file · android · 17-dense-home-widget-placed · light
- f7-widget-howto-sheet · android · 02-pin-button · light
- f7-widget-howto-sheet · android · 03-pin-dialog · light
- f7-widget-howto-sheet · android · 04-pin-added · light
- f7-widget-howto-sheet · android · 05-steps-fallback · light
- f7-widget-howto-sheet · android · 07-no-snapshot · light
- f7-widget-howto-sheet · android · 09-no-place-no-sheet · light
- f7-widget-howto-sheet · android · 11-200-percent · light
- f7-widget-howto-sheet · ios · 01-default · light
- f7-widget-howto-sheet · ios · 06-no-snapshot · light
- f7-widget-howto-sheet · ios · 08-no-place · light
- f7-today-widget · android · 14-dense-set · light
- f7-today-widget · android · 15-minimum-size · light
- f7-today-widget · android · 18-200-percent · light
- f7-today-widget · ios · 04-air-hero · light (redraw at Android 4x2 for step 10)
- f7-today-widget · ios · 05-evening-confirmed · light
- f7-today-widget · ios · 06-partial · light
- f7-today-widget · ios · 09-stale-air · light
- f7-today-widget · ios · 10-past-horizon · light
- f7-today-widget · ios · 11-no-snapshot-no-place · light
- f7-today-widget · ios · 12-tinted-clear · dark
- f7-today-widget · ios · 13-standby · dark
- f7-widget-gallery · ios · 01-gallery-medium · light
- f7-widget-gallery · ios · 04-own-snapshot · light (layout for Maya's own-data preview)
- f7-widget-tap-landing · ios · 01-arrived-pickup · light (the iOS landing where the iOS lane rejoins)
- f7-widget-tap-landing · android · 11-arrived-pickup · light
- f7-widget-tap-landing · android · 12-arrived-air · light
- f7-widget-tap-landing · android · 13-saved-place · light
- f7-widget-tap-landing · android · 14-refresh-failed · light
- f7-widget-tap-landing · ios · 02-refreshing · light (redraw on Android for step 7)
- f7-widget-tap-landing · ios · 06-cold-start · light
- f7-widget-tap-landing · ios · 07-offline · light
- f7-widget-tap-landing · ios · 08-no-place · light
- f1-today-air-band · android · 02-alert-usg-household · light
- f1-add-place-sheet · ios · 02-idle-first-place · light
No export exists for these frames. Redraw each one from the description given here:
- ext:os-pin-dialog, which is the neutral Material 3 system dialog. Use f7-widget-howto-sheet · android · 03-pin-dialog.
- The Android system notification-permission dialog in step 1: neutral Material 3 system chrome, with the system's own "Allow" and "Don't allow" buttons and no Pantopus tokens.
- The Android versions of the iOS-only exports named above.
- The "must not ship" hub-briefing error frame in branch B6.
RECAST RULE FOR EXPORTS: the f7 exports draw Maya's pickup as hollow, with "Unconfirmed" and the two-button PickupCard. In this storyboard Maya has confirmed Tuesday. Redraw every widget frame with the tick and "You · Tuesday", as f7-today-widget · ios · 05-evening-confirmed draws it. Redraw every Today frame with the settled confirmed PickupCard exactly as f1-today-tab · ios · 01-dense-home draws it: "Recycling and garbage tomorrow" · "Bins out tonight — curbside by 6:30 AM" · "You · Tuesday · Waste Connections" with the you-added mark (tick), and only the text button "Change pickup day". (The "✓ You added this · Tuesday" form belongs to the confirmed-just-now state, which no frame here shows; recorded on Notes.) Keep every other part of each export's layout and grammar exactly.
BRANCH FRAMES: each lower-lane branch frame is its main-lane parent (or its named export) with only the listed delta changed. Do not recompose anything else.

MAIN LANE PLATFORM: Android. Maya uses a Pixel 8 running Android 15, with the Pixel Launcher in its 5-column grid, and pinning is supported. The widget is the 4x2 at 276x220dp. The phone frame is 412x915. The iOS path is its own lane (branch B3, artboard 05). It ends in a terminal chip that rejoins step 7 (artboard 03), with the iOS landing f7-widget-tap-landing · ios · 01-arrived-pickup matching android 11.

PERSONA & SITUATION
Maya Chen owns HOME A, 2418 NE Larkspur Loop, Vancouver, WA 98684, and lives there with Sam Ortega (member). The widget label is "Larkspur Loop" and the scope is "Your household". She also has two saved places, Mom's house and Sam's old apartment (as f1-your-places draws them), so she has more than one place and her briefing card carries the caption "For 2418 NE Larkspur Loop".
- Pickup, confirmed by Maya: garbage every Tuesday and recycling every other Tuesday, next on Tue 20 Oct, carts out by 6:30 AM, Waste Connections.
- Dates in the 14-day window from Mon 19 Oct:
  - Tue 20 Oct: recycling and garbage (tick);
  - Fri 23 Oct: Clark Public Utilities bill (tick; the widget never shows amounts);
  - Mon 26 Oct: the statewide voter bar;
  - Tue 27 Oct: garbage only (tick);
  - Wed 28 Oct: City of Vancouver water bill (tick);
  - Sun 1 Nov: HOA dues (tick).
- Air: AQI 42 · Good · AirNow, observed 7:00 AM. AirNow publishes no newer reading for her area between 7:00 AM and her 6:10 PM open, so Today's air band and the 6:10 PM snapshot both carry the 7:00 AM reading (Today shows it in its stale form). The next reading, observed 9:00 PM, is what the 9:40 PM refresh gets. Her air alert threshold is 101, the default.
- Keeper: Ollie (phase 2). No keeper ever appears on the widget.
NOTIFICATION PREMISE (storyboard delta; list it on Notes):
- Mon 28 Sep, 6:05 PM, the evening before a Tuesday pickup (Tue 29 Sep, a garbage-only week): the pickup card was showing because tomorrow had a pickup. Maya tapped "Yes, Tuesday is right" on this Pixel. The card's inline reminder ask opened (as f4-today-pickup-card 03 draws it), and she tapped "Not now". "Not now" never opens the system dialog, and it counts as the briefing card's night-before answer, so the night-before row is absent from then on.
- So on Mon 19 Oct the system has never asked her. Her briefing card shows only the morning row, "A morning heads-up?".
- In step 1 she taps Yes on that row and answers the system dialog with "Don't allow": her first Android denial.
- Android reading (one reading, used everywhere): because the denial happened in this visit's own dialog, the card uses the declined-at-system collapse (the widget line), not the re-ask row. On any later visit the morning row shows normally, and its Yes re-asks once, as f4-briefing-optin-card · android · 19-denied-once-reask draws it; Notification settings also reaches it. No frame in this journey taps it.
- Conflict for Notes: f4-today-pickup-card 02 ("Confirmed by Sam on Sat 3 Oct"), f4-notification-settings ("Tuesday (confirmed by Sam)") and x-date-sheet 04 ("Sam · Tuesday, confirmed 3 Oct 2026") credit Sam on Sat 3 Oct; f1-today-tab 14 credits Maya on 3 Oct. This storyboard recasts the confirmer to Maya on Mon 28 Sep.
- f1-today-tab draws her briefings as on, which belongs to another storyboard. This journey is her no-permission return path.
TIMELINE. Every frame prints its own date and time.
- Mon 28 Sep, 6:05 PM (off-lane, Notes only): the confirm and the "Not now".
- TODAY, Mon 19 Oct, 6:10–6:16 PM: the offer and the add.
- Mon 19 Oct, 9:40 PM: the first tap.
- Tue 20 Oct, 12:00 AM to 6:30 AM: the overnight changes.
- Thu 22 Oct, 4:10 PM: the smoke-day tap (conditional on the B13 decision).
- Mon 26 Oct, 7:40 AM: her last app open before a two-day trip.
- Wed 28 Oct, 7:50 AM: the glance after the trip.

GOAL: Get pickup day, air and her next date onto the home screen with no notifications. A tap opens the exact thing the widget showed.

METRIC (first-person-loop §5):
- Activation: "a widget snapshot written, reported by the client as an event" counts in place of a briefing. Proposed event name: widget_snapshot_written.
- Week-four return, attributed to the widget trigger: session_open with meta.trigger 'widget', sent from the ?src=widget deep link, once per app open.
- Placement: proposed event widget_pinned {source: pin_callback | placed_ids | ios_configs}.
Annotate steps 4, 7, 8, 11 and 12 (and branches B2 and B3) with the events they log, as grey event chips. §5 names neither proposed event; list both on Notes.

THE HAPPY PATH (12 steps; the moment-of-truth callouts MT1 to MT12 go in the margin lane)

Step 1 · Android · Mon 19 Oct, 6:10 PM · f4-briefing-optin-card · declined at the system dialog, morning-row variant (the iOS 17-declined-at-os-widget-offer, redrawn in the android 19-denied-once-reask chrome, over f1-today-tab · android · 01-dense-home)
- Before the tap, the card shows: overline "Briefings", caption "For 2418 NE Larkspur Loop", no night-before row (declined on the pickup card Mon 28 Sep, as f4-briefing-optin-card 07-pickup-ask-declined draws it), the row "A morning heads-up?" with "Date reminders at 7:00 AM" and "Yes" · "Not now" · "No thanks", the silence line and "Notification settings".
- Does: on Today, below the confirmed PickupCard ("Recycling and garbage tomorrow" · "Bins out tonight — curbside by 6:30 AM" · tick "You · Tuesday · Waste Connections" · "Change pickup day"), she taps "Yes" on "A morning heads-up?". The Android system dialog opens (draw it as an inset). She taps "Don't allow". Today's air band behind shows its stale form, "Observed 7:00 AM".
- Shows: the card collapses to one text.secondary line, "Your dates still show here on Today · Or put it on your home screen" (the morning-row variant), with the 48dp text button "Show me how". It shows once, with no amber, no settings link and no modal. She does not tap it now; she goes out to wheel the carts.
- Carries → step 2: the widget was promoted at 6:10 PM, so the 24-hour promotion clock starts. The morning-row denial (first Android denial; one re-ask left) is stored on the server, alongside the Mon 28 Sep night-before decline.
- MT1: The widget is offered once, at a teachable moment, never as a blocking modal and never more than once in 24 hours. After a denial, the widget ranks above the briefing ask.

Step 2 · Android · Mon 19 Oct, 6:14 PM · x-place-file · dense home (the iOS 01-dense-home redrawn on Android)
- Does: back inside, opens the Place tab and taps the quiet row "Put today on your home screen".
- Shows:
  - Header: "Your place file" · "2418 NE Larkspur Loop" · "Vancouver, WA 98684" · ScopeChip "Your household" · "Updated 4m ago" · "11 on file".
  - The Next row is the insurance ask, "When does your insurance renew?", with the filled "Add a date" and "Not now" · "Skip". The widget is not the Next row, because it was promoted in Pantopus in the last 24 hours.
  - In PLACE: the quiet FactRow "Put today on your home screen · Pickup, air and your next date. No notifications needed."
- Carries → step 3: her latest snapshot (written 6:10 PM, air still the 7:00 AM reading).
- MT2: The lasting way in exists after the one-time hint has gone, and it never competes with the Next row within 24 hours.

Step 3 · Android · Mon 19 Oct, 6:14 PM · f7-widget-howto-sheet · 02-pin-button (recast)
- Shows:
  - A Material 3 ModalBottomSheet with the title "Put today on your home screen" and the line "Pickup, air and your next date, right on your home screen. No notifications needed."
  - The preview, at 276x220dp on a surface.sunken ground patch:
    - "Larkspur Loop · Your household";
    - KindGlyph (garbage+recycling) with "Bins out tonight";
    - "Recycling and garbage · curbside by 6:30 AM tomorrow", then a tick and "You · Tuesday · Waste Connections";
    - the 14-day strip with 6 items, with ticks on Tue 20 and Tue 27;
    - a dimmed air row, "Observed 7:00 AM · AirNow — 11 hours ago".
  - Caption "Your widget".
  - The primary "Add to home screen" directly under the preview, and the secondary "Done".
- Does: taps "Add to home screen".
- Carries → step 4: a pin request for the Pantopus widget provider.
- MT3: She sees her own reward before any instructions, and the preview is clearly an illustration that cannot be tapped.

Step 4 · Android · Mon 19 Oct, 6:15 PM · ext:os-pin-dialog (f7-widget-howto-sheet · android · 03-pin-dialog), then 04-pin-added
- Does: taps the system's "Add".
- Shows: first the neutral system dialog with its own widget preview; then the sheet reads "Added to your home screen." with "Done". One light haptic tick plays on success.
- Event chip: widget_pinned {source: pin_callback} (proposed).
- Carries → step 5: the pin-success callback, so the app now knows a widget is placed.
- MT4: The system places the widget, so no gesture is needed. Cancelling returns her to the sheet unchanged (branch B1).

Step 5 · Android · Mon 19 Oct, 6:15 PM · x-place-file · 17-dense-home-widget-placed
- Does: taps "Done", and the sheet closes.
- Shows: the place file with no "Put today on your home screen" row. The Next row is still the insurance ask.
- Carries → step 6: nothing more. The widget reads the 6:10 PM snapshot.
- MT5: The app knows the widget is placed (from the pin callback here; from the placed-widget list on the next open for any other route) and stops asking.

Step 6 · Android home screen · Mon 19 Oct, 6:16 PM · f7-today-widget · 14-dense-set (4x2 only, recast)
- Shows: the 4x2 in dynamic colour, with exactly the content of the step 3 preview. The air band and marker are at 50%, while the air text stays at full contrast with its age.
- MT6: The placed widget matches the preview. All text is 11sp or larger, and its meaning survives dynamic colour and greyscale. Show a greyscale inset.

Step 7 · Android · Mon 19 Oct, 9:40 PM · f7-widget-tap-landing · 11-arrived-pickup, in the refreshing state (02-refreshing redrawn on Android)
- Does: before bed, she glances at the widget (hero still "Bins out tonight"; air now "Observed 7:00 AM · AirNow — 14 hours ago") and taps the hero region. The link is pantopus://today?src=widget&section=pickup, and the system launch transition runs from the widget.
- Shows:
  - Today, root composition.
  - Header: "2418 NE Larkspur Loop" · ScopeChip "Your household" · "Updating…", with the 2pt hairline, because this refresh takes longer than 1 second.
  - The PickupCard is scrolled into view just below the header, with the infoBg wash and a 2px inset text.secondary outline, and focus is on it: "Recycling and garbage tomorrow" · "Bins out tonight — curbside by 6:30 AM" · tick "You · Tuesday · Waste Connections" · "Change pickup day".
  - Nothing is dimmed or blanked.
- Event chip: session_open {trigger: widget}, logged once.
- Carries → step 8: a forced refresh, which is a real reload.
- MT7: The tap opens the exact fact, and content never blanks. The hairline shows only because the refresh took more than 1 second.

Step 8 · Android · Mon 19 Oct, 9:40 PM · f7-widget-tap-landing · 11-arrived-pickup, loaded
- Shows:
  - The header now reads "Updated just now", and the highlight stays until her first scroll or tap.
  - The air band reads "AQI 42 · Good" · "AirNow · nearest monitors · observed 9:00 PM" (the first reading since 7:00 AM).
  - An inset shows the home-screen widget re-rendered from the new snapshot: "AQI 42 · Good · AirNow 9:00 PM" at full strength.
- Event chip: widget_snapshot_written (proposed; the client event that counts toward Activation).
- MT8: A forced refresh writes the snapshot, so the widget's stale air row clears without her doing anything else.

TIME GAP: "Overnight, app closed · Tue 20 Oct"

Step 9 · Android home screen · Tue 20 Oct · f7-today-widget · timeline entries (three mini 4x2 frames in a row)
- 12:00 AM entry: the hero reads "Recycling and garbage today", with the caption "Curbside by 6:30 AM" and the tick "You · Tuesday". The strip's "Today" cell is now Tue 20.
- 6:05 AM, the glance: the same hero. The air row is dimmed, reading "Observed Mon 9:00 PM · AirNow — 9 hours ago" (earlier-day form, weekday first).
- 6:30 AM entry: the pickup leaves the hero. The hero reads "Clark Public Utilities bill due · in 3 days · Fri 23 Oct", with a tick and "You added this".
- Label each mini frame with its timeline entry. Write "12:00 AM", never the other word for it.
- MT9: The day words are worked out when the widget renders, from ISO dates, at timeline entries on day boundaries, 5:00 PM and 6:30 AM, without the app being opened.

TIME GAP: "Two days later · Thu 22 Oct, 4:10 PM · smoke from the Gorge". Inside the gap, print "Conditional: a background snapshot refresh after 4:00 PM (B13 decision)".

Step 10 · Android home screen · Thu 22 Oct, 4:10 PM · f7-today-widget · air hero (the iOS 04-air-hero medium, redrawn at the 4x2) · assumes the B13 decision: background snapshot refresh
- Shows:
  - "Larkspur Loop · Your household".
  - The hero "AQI 118 · Unhealthy for Sensitive Groups" (2 lines), then "AirNow · observed 4:00 PM", a filled mark and "Official".
  - The micro band, with its marker in segment 3 and "Sensitive groups" beside the bar.
  - The strip, Thu 22 Oct → Wed 4 Nov: Fri 23 bill (tick) · Mon 26 bar · Tue 27 garbage only (tick) · Wed 28 water bill (tick) · Sun 1 Nov HOA dues (tick) · Mon 2 Nov property tax (filled) and Comcast (tick) · Tue 3 Nov recycling and garbage (tick) plus the general election bar.
  - An annotation: "No push. Notifications are off. The widget is her only signal."
  - A DEPENDENCY callout: "This frame is true only if a snapshot was written after 4:00 PM. The widget never fetches, the app was closed, and there is no push. Under today's design doc, branch B13 is what she sees instead."
- The arrow into this frame is dashed and labelled "conditional: background snapshot refresh (B13)".
- Does: taps the hero region (section=air).
- MT10: The urgency ladder picks the hero, and the widget and Today agree about it.

Step 11 · Android · Thu 22 Oct, 4:10 PM · f7-widget-tap-landing · 12-arrived-air, with f1-today-air-band · android · 02-alert-usg-household below the fold
- Shows:
  - No scroll. The pinned slot is highlighted and focused: "AQI 118 · Unhealthy for Sensitive Groups · PM2.5" · "Crossed 101 at 4:00 PM" · the AqiBand alert variant · "Members of sensitive groups may experience health effects. The general public is less likely to be affected." · "AirNow · nearest monitors · observed 4:00 PM".
  - No PickupCard: tomorrow (Fri 23 Oct) has no pickup, so under f4-today-pickup-card's rule (frame 09, "nothing-tomorrow — card absent, strip moved up") the card is absent and the 14-day card moves up. Its first rows: Fri 23 Oct Clark Public Utilities bill (tick), Mon 26 Oct voter bar, Tue 27 Oct garbage only (tick). f7-widget-tap-landing 12 draws a "Garbage only · in 5 days · Tue 27 Oct" card here; this storyboard follows f4 (handoff check 23).
  - The keeper slot is hidden under the alert.
  - Header: "Updated just now".
  - Continuation strip (drawn under the frame, labelled "below the fold"): the sixth-section air band in its alert state, with the same reading and the 101 rule, not highlighted.
- Event chips: session_open {trigger: widget}; widget_snapshot_written (proposed; the refresh succeeded).
- MT11: She does not scroll to find the tapped fact, and the crossing sits in the pinned slot for any arrival.

TIME GAP: "Last app open Mon 26 Oct, 7:40 AM · away Mon–Tue · Wed 28 Oct, 7:50 AM"

Step 12 · Android home screen → Today · Wed 28 Oct, 7:50 AM · f7-today-widget · stale per fact (09-stale-air grammar at the 4x2)
- Shows:
  - The hero picked by the ladder from the Mon 26 Oct snapshot: "City of Vancouver water bill due · Today", with a tick and "You added this".
  - The strip rendered from Wed 28 as "Today", with marks at full strength: Wed 28 water bill (tick) in the Today cell, Sun 1 Nov HOA dues, Mon 2 Nov property tax and Comcast, Tue 3 Nov recycling and garbage with the election bar. The cells after Sun 8 Nov, beyond the snapshot's 14-day horizon, are empty and dimmed (a proposal; see Notes).
  - Only the air row is greyed, with the band at 50% and "Observed Mon 7:00 AM · AirNow — 2 days ago" at full contrast.
  - An annotation: "With the app closed, Mon 26 from 5:00 PM showed 'Bins out tonight' (Garbage only), and Tue 27 until 6:30 AM showed 'Garbage only today'."
- Does: taps the strip region (section=strip).
- Inset: Today with the 14-day card highlighted and "Updated just now", and the widget re-rendered with a fresh air row.
- Event chips: session_open {trigger: widget}; widget_snapshot_written (proposed).
- MT12: Staleness is judged fact by fact. Rule-based facts and dates are never greyed, and only the air reading shows its age.

LAYOUT
- Each lane artboard is 2560px wide and as tall as its content, on surface.app.
- Main lane: frames left to right at 50% scale (Android 412x915 becomes 206x458; home-screen frames are drawn as the full 412x915 home screen at 50%, with the widget in place), with 320px between frame origins.
- Above each frame, print:
  - "Step N · <surface-id> · <state>" (step 10 adds "· assumes the B13 decision: background snapshot refresh");
  - a time chip;
  - the source export in caption text.secondary ("from f7-widget-tap-landing · android · 11-arrived-pickup · recast", or "redrawn, no export").
- Arrows are 1.5px text.secondary lines, each labelled with its trigger: "tap Yes on A morning heads-up? → system dialog → Don't allow", "tap Place tab → tap row", "tap Add to home screen", "tap Add (system)", "tap Done", "widget renders from snapshot", "widget tap · section=pickup", "refresh completes", "timeline entry (no app)", "conditional: background snapshot refresh (B13)" (dashed), "widget tap · section=air", "widget tap · section=strip".
- Under each arrow, draw a "Carries:" card with exactly that step's Carries line.
- Time jumps are labelled gaps: a 64px surface.sunken column with a dashed text.secondary edge and a vertical label.
- Margin lane above: MT1–MT12 callouts on surface.base with a 2px info border and numbered square badges, joined to their frames by leader lines. Text is text.primary.
- Lower lane, headed "If this goes wrong": branch frames at 50%, with dashed arrows labelled with the condition, and dashed "rejoins step N" arrows or terminal chips naming the landing surface.
- Event chips: caption 12/16 in text.strong on surface.sunken, radius xs 4, system sans (no monospace). Proposed event names carry "(proposed)".
- The iOS lane (artboard 05) is drawn left to right on its own artboard and ends in a terminal chip, "rejoins step 7 (artboard 03) · iOS landing f7-widget-tap-landing · ios · 01-arrived-pickup matches android 11".

FAILURE BRANCHES
B1 · The pin dialog is cancelled [lane 02]. Leaves step 4. Frame: the sheet unchanged, with no error and no event. Rejoins step 3.
B2 · The launcher can't pin [lane 02]. Leaves step 2.
- Frame 1: f7-widget-howto-sheet · android · 05-steps-fallback: "Touch and hold the Pantopus app icon." · "Tap Widgets." · "Touch and hold the widget, then drag it into place." · "Done".
- Frame 2: the home screen with the dragged 4x2.
- The place-file row hides on the next app open, once the placed widget IDs are read. Event chip on that open: widget_pinned {source: placed_ids} (proposed).
- Rejoins step 6.
B3 · iOS [lane 05; drawn as its own lane]. Maya's iPhone, with the same data.
- Frame 1: f7-widget-howto-sheet · ios · 01-default, recast. Her own medium preview (338x158) with the tick, then the three steps "Touch and hold an empty spot on your home screen." · "Tap Edit, then Add Widget, and search for Pantopus." · "Pick a size and add it.", and "Done". There is no add button.
- Frame 2: the OS widget gallery, f7-widget-gallery · ios · 01-gallery-medium, with the preview in the 04-own-snapshot layout showing Maya's own data.
- Frame 3: f7-today-widget · ios · 05-evening-confirmed (medium, "Bins out tonight", tick "You · Tuesday").
- The place-file row hides on the next open, when the app reads the system's current widget configurations. Event chip on that open: widget_pinned {source: ios_configs} (proposed).
- Terminal chip: "rejoins step 7 (artboard 03) · iOS landing f7-widget-tap-landing · ios · 01-arrived-pickup matches android 11".
B4 · No snapshot yet [lane 06]. Persona: Jordan Lee at PLACE B, as the exports draw.
- Frames: f7-widget-howto-sheet · ios · 06-no-snapshot and android · 07-no-snapshot, each showing the sample captioned "Sample — yours will show your address".
- Recovery: after his first Today load, the preview switches to his own data ("Birchfield Ct · Saved place · Only you").
- Rejoins step 3 (his version).
B5 · No place [lane 06].
- Frame 1: f7-today-widget · ios · 11-no-snapshot-no-place, with "Save an address to see today here".
- Frame 2: tapping it opens pantopus://today?src=widget, which lands on f7-widget-tap-landing · ios · 08-no-place: the Add a place sheet (f1-add-place-sheet · ios · 02-idle-first-place) over "Today starts with a place". Terminal chip for frames 1–2: "lands on f1-add-place-sheet (iOS)".
- Frame 3, Android today: until the signed-in Add a place sheet exists, the widget shows "Open Pantopus to see today at your address", the landing is "Today starts with a place" with no sheet, and the how-to sheet shows 09-no-place-no-sheet with a single "Done". Its own terminal chip: "lands on f1-today-tab · no-place (Android, no sheet)".
- Draw one label-unification callout: "Add a place" (Today), "Save an address first" (how-to sheet, ios 08-no-place) and "Save an address to see today here" (widget) all lead to the same Add a place sheet where it exists.
B6 · Android routes the tap to the hub briefing screen [lane 06]. Persona: Jordan Lee at PLACE B (T1 saved place).
- Frame 1: redraw a crossed-out frame, labelled "MUST NOT SHIP": pantopus://hub-today opened from a widget tap on Jordan's widget, showing a hard error for his saved place with the invented line "We couldn't load your briefing." (listed on Notes as a what-not-to-ship string).
- Frame 2: the correct landing, f7-widget-tap-landing · android · 13-saved-place (Jordan, "1107 NE Birchfield Ct" · "Saved place · Only you", strip highlighted, no error).
- Callout: "Widget links are pantopus://today?src=widget&section=…; push links are pantopus://hub-today?deliveryId=…. They must not collide. Otherwise the widget is decoration."
- Terminal chip: "correct landing: f7-widget-tap-landing · android · 13-saved-place".
B7 · Refresh fails [lane 03]. Leaves step 7.
- Frame: f7-widget-tap-landing · android · 14-refresh-failed, recast to 9:40 PM: "Couldn't refresh · Retry" above "Updated 3h ago"; the air caption reads "Observed 7:00 AM · AirNow — 14 hours ago"; all content is intact; Retry is 48dp.
- The widget keeps its stale air row, and no snapshot is written.
- Retry succeeds and rejoins step 8.
B8 · Cold start [lane 03]. Leaves step 7.
- Frame: f7-widget-tap-landing · ios · 06-cold-start, redrawn on Android: the full WarmingSkeleton with the address already resolved. It appears only when there is no prior content.
- Rejoins step 8.
B9 · The whole snapshot is past its horizon [lane 04]. A frame-only what-if, labelled on the frame: "What-if: Maya never opened the app after Mon 26 Oct (step 12 did not happen)."
- Frame: f7-today-widget · ios · 10-past-horizon, recast on the Android 4x2 as seen on Tue 10 Nov: marks and cells dimmed, geometry kept, text at full contrast, and "As of Mon 26 Oct, 7:40 AM · Open to refresh".
- A tap lands on Today, and the refresh rewrites the snapshot, clearing the line.
- Rejoins step 8.
B10 · The air reading is missing [lane 04].
- Frame: f7-today-widget · ios · 06-partial (the air-missing medium), redrawn at the 4x2. The air row drops and the layout rebalances; the widget is never marked failed.
- Rejoins step 9.
B11 · iOS StandBy and tinted modes [lane 05]. Frames: f7-today-widget · ios · 13-standby (dark) and 12-tinted-clear (dark). The small widget has no background, shows provenance by shape only, and its tick stays knocked out when tinted.
- Terminal chip: "display mode only; tap rejoins step 7".
B12 · Offline landing [lane 03]. Leaves step 7.
- Frame: f7-widget-tap-landing · ios · 07-offline, redrawn on Android and recast: "You're offline · as of 6:10 PM" (the time of her last successful update, matching B7's "Updated 3h ago"); cached content; "Change pickup day" disabled with "Changing your pickup day needs a connection."
- The widget keeps its stale air row.
- Rejoins step 8 when she is back online.
B13 · Air lag: no snapshot written since the crossing [lane 04]. Leaves the Thu 22 Oct gap. This is what step 10 looks like under the design doc as written today.
- Frame: the 4x2 at 4:10 PM, still showing the last snapshot, written at 12:30 PM when she opened the app: "AQI 42 · Good · AirNow 12:00 PM", not dimmed, because it is under 6 hours old.
- Callout: "During a smoke event the widget looks calm. Decide on one of these: a background snapshot refresh (Android WorkManager, iOS background app refresh), a shorter air staleness window (the air band uses 2 hours), or accept the lag. The design doc currently rules out background refresh."
- Terminal chip: "open product decision".

HANDOFF CHECKS (print each as a row on lane 07, with both thumbnails and an empty "Agrees? yes / no" box. For checks 8, 10 and 16, whose second source is a rule or a doc string, print the quoted source text beside or in place of the second thumbnail.)
1. Frame 1 and frame 3 must agree on the offer: the morning-row line "Your dates still show here on Today · Or put it on your home screen", whose "Show me how" opens this same how-to sheet. Two other surfaces offer the widget after a denial, with other wording: f4-today-pickup-card · ios · 16 ("Pickup still shows here on Today" plus "Put today on your home screen" / "Show me how") and f4-notification-primer · ios · 05-declined-at-os ("Pickup still shows on Today." plus "Put Today on your home screen" · "Add the widget"). Show all three as thumbnails. Only one surface shows the offer, once, within the 24-hour rule. The wording conflict goes on Notes (f4-today-pickup-card's own Notes say its wording overrides the primer's).
2. Frame 2 and frame 3 must agree on what the place-file widget control does on Android. x-place-file says its Android button "Add the widget" opens the system dialog directly. flows-spec and f7-widget-howto-sheet put the preview sheet first. This storyboard draws the sheet first. Record the decision on Notes.
3. Frame 2 and frame 1 must agree on the 24-hour rule. The Next row does not promote the widget within 24 hours of the Today offer, and the widget stays a quiet FactRow.
4. Frame 3 (preview) and frame 6 (placed widget) must agree on the label "Larkspur Loop · Your household", the hero, the tick "You · Tuesday · Waste Connections" and the size 276x220dp. The how-to export shows a hollow mark with "Unconfirmed".
5. Frame 4 and frame 5 must agree that the pin-success callback hides the place-file row at once, and that "Added to your home screen." is the only confirmation.
6. Frame 6 and frame 7 must agree on the street and scope: the widget label "Larkspur Loop · Your household" and the landing header "2418 NE Larkspur Loop" with ScopeChip "Your household". The landing export draws the chip on the claimed home, which replaces the older no-chip rule.
7. Frame 6 and frame 7 must agree on the fact: the hero "Bins out tonight" and the PickupCard "Recycling and garbage tomorrow" / "Bins out tonight — curbside by 6:30 AM", with the same tick and "You · Tuesday · Waste Connections".
8. Frame 7 and f1-today-tab · ios · 07-from-widget must agree on how a widget arrival is highlighted. f1-today-tab's rule reads "fades in under 300ms, then decays"; f7-widget-tap-landing says it stays until the first interaction. Use the latter.
9. Frame 8 and frame 6 must agree that a successful refresh writes the snapshot, so the widget's air row is fresh afterwards. After a failed or offline landing (B7, B12), it stays stale.
10. Frame 9 and f7-today-widget must agree on the timeline entries (12:00 AM on each day, 5:00 PM the evening before pickup, 6:30 AM on pickup day) and on writing "12:00 AM" on frames. The house style forbids the other word.
11. Frame 10 and frame 11 must agree on the air strings. The widget reads "AQI 118 · Unhealthy for Sensitive Groups" / "AirNow · observed 4:00 PM". f7-widget-tap-landing's pinned slot reads "AQI 118 · Unhealthy for Sensitive Groups · PM2.5" / "Crossed 101 at 4:00 PM". f1-today-tab's pinned slot reads "Air quality index (AQI) 118 · Unhealthy for Sensitive Groups" / "Crossed 101 at 4:00 PM · AirNow". Choose one pinned-slot string set.
12. Frame 10 and frame 11 must agree on where an air tap lands on a crossing day. f7-widget-tap-landing lands on the pinned slot without scrolling. f1-today-air-band and f1-today-tab say a widget air arrival scrolls to the air section. Use the pinned slot.
13. Frame 11 ("Crossed 101 at 4:00 PM"), its below-the-fold air band (the 101 rule) and the air threshold row of f4-notification-settings · android · 03-default ("Unhealthy for Sensitive Groups · AQI 101 and up") must all agree on 101. Compare only that row: the frame's other switch states are Maya's own choices with notifications on and do not apply to this denied Pixel (Notes).
14. Frame 10 and f1-today-air-band must agree on the date of the smoke event. f7 uses Thu 22 Oct, 4:10 PM; f1-today-air-band uses Mon 19 Oct, 4:00 PM. This storyboard uses Thu 22 Oct.
15. Frame 12 and frame 11 must agree on when air counts as stale. The widget greys the air after 6 hours; f1-today-air-band marks it stale after 2 hours. Either state both rules on the frames or choose one.
16. Frame B3-2 (gallery) and frame B3-3 (widget) must agree on the mark and the words. The design doc's sample strings (print them: "Recycling + garbage Tue" with a filled mark) are replaced by "Recycling and garbage tomorrow" or "Bins out tonight" with the viewer's real mark.
17. Frame B3-1 and frame B3-3 must agree on the iOS medium size, 338x158pt (not 364x170), and on Apple's current step wording, "Tap Edit, then Add Widget".
18. Frames B5-1, B5-2 and the how-to sheet's no-place state must lead to the same Add a place sheet, and must hide any entry whose destination does not exist on that platform (B5-3 on Android).
19. Frame 7 and B6 must agree that Android lands on the root Today composition, never on the hub briefing screen.
20. Frame 5 and the iOS lane must agree on placement detection: the pin callback or the placed widget IDs on Android, and the current widget configurations on iOS. f4-notification-primer · ios · 05-declined-at-os, which promotes a widget row on Today, is not an entry the how-to sheet lists.
21. Frame 1 and f4-briefing-optin-card · android · 19-denied-once-reask must agree on the Android reading: a first denial in this visit's own dialog collapses the card to the widget line; the re-ask-once row appears only on a later visit (and Notification settings reaches it).
22. Frame 1 and f4-today-pickup-card · ios · 03-confirmed-just-now-reminder-ask must agree on the premise: the card and its inline ask exist only on an evening before a pickup, so Maya's confirm and "Not now" happened Mon 28 Sep (before Tue 29 Sep); that "Not now" removed the night-before row, fired no system dialog, and left only the morning row, captioned "For 2418 NE Larkspur Loop".
23. Frame 11 and f7-widget-tap-landing · android · 12-arrived-air must agree on whether the PickupCard shows on a day with no pickup tomorrow. f4-today-pickup-card ("Nothing tomorrow: the card is absent") and f1-today-tab (slot 3 is the PickupCard or the QuietDayReceipt) say absent; the f7 export draws "Garbage only · in 5 days · Tue 27 Oct". This storyboard draws it absent.

ACCESSIBILITY IN THE JOURNEY (lane 08: a focus map drawn over thumbnails of every frame, plus the notes below)
Focus landing after each transition:
- Step 1: after the system dialog, focus returns to the card. The collapsed line is announced once as a status message, and "Show me how" is a 48dp target.
- Step 2: focus lands on the title "Your place file". The quiet row is one 48dp target.
- Step 3: the sheet's title is read first, then the preview as one image: "Your widget preview: Larkspur Loop, your household. Bins out tonight, recycling and garbage, curbside by 6:30 AM tomorrow, Waste Connections, you added this; next 14 days, 6 items; air quality index 42, Good, category 1 of 6, AirNow, observed 7 AM, 11 hours ago." Then "Add to home screen".
- Step 4: the system dialog owns focus. On return, "Added to your home screen." is a polite status message, and focus stays on "Done".
- Step 5: the sheet closes and its row is gone. Focus moves to the PLACE section heading, never to a removed element.
- Step 6: the widget's region labels are read top to bottom, in the f7-today-widget form, with "you added this" in place of "on record, not confirmed".
- Step 7: focus moves to the highlighted PickupCard, whose label is read first, then the header. The FreshnessLine is a polite live region and announces "Updating…" and then "Updated just now" once each.
- Step 8: "Updated just now" is announced once, and focus stays on the PickupCard.
- Step 9: each timeline entry changes the widget's spoken label: "Recycling and garbage today, curbside by 6:30 AM, you added this" at 12:00 AM; the air row adds "observed Monday 9 PM, 9 hours ago" at 6:05 AM; "Clark Public Utilities bill due in 3 days, Friday 23 October, you added this" at 6:30 AM.
- Step 10: the air hero is read first: "Air quality index 118, Unhealthy for Sensitive Groups, category 3 of 6, AirNow, observed 4 PM, official", then the place label and strip.
- Step 11: focus moves to the pinned slot, which has role=status. The EPA statement is part of its label.
- Step 12: the stale air label adds "observed 2 days ago". On landing, focus moves to the highlighted 14-day card.
- B1: when the system dialog is cancelled, focus returns to "Add to home screen"; nothing is announced.
- B2: after the fallback steps, focus goes to the sheet title, and the steps are read as a numbered list.
- B3: on iOS, focus lands on the sheet title, then the preview image, then the steps; the iOS landing follows step 7's rule.
- B4: the sample preview is one image with the spoken label "Sample widget preview, not your address"; after his first load it becomes his own preview label.
- B5: the Add a place sheet takes focus at its title; on Android (frame 3), focus lands on "Today starts with a place".
- B6: the correct landing moves focus to the highlighted 14-day card, read after "1107 NE Birchfield Ct, saved place, only you".
- B7: focus goes to Retry, and "Couldn't refresh" is announced once.
- B8: the skeleton is hidden from assistive tech; the resolved address is read, and content is announced once when it arrives.
- B9: the widget's spoken label starts with "As of Monday 26 October, 7:40 AM, open to refresh"; the tap follows step 7's landing rule.
- B10: the widget's spoken label drops the air region entirely; no "failed" or "unavailable" word is read.
- B11: StandBy and tinted modes keep the same spoken label as step 6, with "you added this" carried by words, not by the knocked-out tick.
- B12: the offline notice is announced once; the disabled "Change pickup day" stays focusable and reads its reason.
- B13: the widget's spoken label reads the 12:00 PM reading without an age, matching what she sees; the callout is annotation only.
Large text and motion:
- At 200% (Android) and AX5 (iOS), the widget becomes text only. The medium keeps the hero and the place label as wrapping text, and the small shows "Pickup tomorrow" with its drawn mark. Draw one 200% sample of step 6 (f7-today-widget · android · 18-200-percent, recast) and one sample of step 3 (f7-widget-howto-sheet · android · 11-200-percent).
- Under Reduce Motion, landings jump without animation, the highlight cross-fades, and the hairline is a static 2pt line.
The no-notifications path is the whole journey. Draw a margin note: "Maya allowed no notifications. Every fact she needs reaches her through the widget and Today. Nothing in this lane depends on a push. After step 1 no frame fires a permission dialog; the Android re-ask-once stays available on the briefing card's morning row and in Notification settings, and no frame taps it."

INSTEAD OF
- Instead of a hollow "Unconfirmed" mark on Maya's widget, draw the tick with "You · Tuesday", because she confirmed Tuesday and the widget must match Today.
- Instead of a night-before row on her briefing card, draw only the morning row, because her Mon 28 Sep "Not now" on the pickup card answered the night-before question.
- Instead of a confirm on a day with no pickup tomorrow, place it on Mon 28 Sep, because the pickup card and its ask exist only the evening before a pickup.
- Instead of a PickupCard on Thu 22 Oct, let the card be absent and the 14-day card move up, because tomorrow has no pickup.
- Instead of a modal or a repeated hint, draw the one-time Today line and the quiet place-file row, because a "Not now" must never ask again.
- Instead of landing at the top of Today, scroll to the tapped section (or land on the pinned crossing), because the tapped fact can sit below the fold.
- Instead of greying the whole widget after a trip, dim only the air band with its age, because pickup rules and dates stay true.
- Instead of a smoke-day hero that appears by magic, label step 10 as conditional on the B13 decision and draw branch B13, because the widget never fetches.
- Instead of an "Add it for me" button on iOS, draw the three pictured steps, because iOS has no way for an app to place a widget.
- Instead of "midnight" on a timeline label, write "12:00 AM", because the house style forbids the word.
- Instead of unlabelled arrows, label each one with its trigger and each gap with its dates, because the founder must see when and why each step happens.

DONE WHEN
- All 12 happy-path frames sit in order across lanes 02–04, each with its step label, time chip, source export and Carries card, and every arrow is labelled with its trigger.
- Step 1 shows the card with only the morning row and the "For 2418 NE Larkspur Loop" caption, then the morning-row collapse line.
- Step 10 is labelled conditional on the B13 decision, with a dashed incoming arrow.
- Step 11 has no PickupCard, and its 14-day card moves up.
- MT1–MT12 have margin callouts joined to their frames.
- The event chips appear on steps 4, 7, 8, 11 and 12 and on B2 and B3, with proposed names marked.
- All 13 failure branches (B1–B13) are drawn, each with its recovery and either a rejoin arrow or a terminal chip (B5 has one chip per platform; B6 and B11 have their own chips). The iOS lane ends in a terminal chip that rejoins step 7 (the landing).
- Every widget and Today frame shows Maya's pickup with the tick.
- The preview and the placed widget are identical.
- Only the air row greys in step 12.
- The handoff-check lane lists all 23 checks with both thumbnails (or the quoted source text for checks 8, 10 and 16).
- The focus map covers every transition, including steps 8–10 and branches B1–B13, and the 200% samples and the no-notifications note are present.
- Every invented string and every conflict with an export is on Notes.

ARTBOARDS
1. flow-07 · storyboard · 01-journey-map · light — one row of 12 step chips with times, the three time gaps, the arrow and gap legend (including the dashed conditional arrow), the event chips, and a key showing which lane holds each branch.
2. flow-07 · storyboard · 02-lane-offer-and-add · light — steps 1–5 (step 1 with the system-dialog inset, step 4 as dialog plus added state); MT1–MT5; lower lane: B1 and B2.
3. flow-07 · storyboard · 03-lane-glance-and-tap · light — steps 6–9 (step 8 with its widget inset, step 9 as three mini frames), the overnight gap and the event chips; MT6–MT9; lower lane: B7, B8 and B12.
4. flow-07 · storyboard · 04-lane-air-day-and-stale · light — the Thu 22 Oct gap and steps 10–11 (step 10 labelled conditional; step 11 with its below-the-fold strip), the trip gap and step 12 with its inset; MT10–MT12; lower lane: B9 (labelled what-if), B10 and B13.
5. flow-07 · storyboard · 05-lane-ios · light — B3 as its own lane (how-to sheet → gallery → iOS widget → terminal chip "rejoins step 7 (artboard 03)"), plus B11 with its terminal chip.
6. flow-07 · storyboard · 06-lane-no-snapshot-no-place-routing · light — B4, B5 (with the label-unification callout and its two terminal chips) and B6 (with the crossed-out MUST NOT SHIP frame, the link-format callout and its terminal chip).
7. flow-07 · storyboard · 07-lane-handoff-checks · light — the 23 checks as rows, with thumbnails at 25%, the source prompts and an empty "Agrees? yes / no" box. Reuse the frames already drawn in lanes 02–06 (and the attached exports) as scaled instances or copies; do not redraw them.
8. flow-07 · storyboard · 08-lane-accessibility · light — the focus map, announcements, the two 200% samples, the Reduce Motion note and the no-notifications note. Reuse the frames already drawn in lanes 02–06 as scaled instances or copies; do not redraw them.
9. flow-07 · storyboard · 09-notes · light — include:
   - the recast: flows-spec's Hannah Ruiz and 1420 NE Garfield St are replaced by Maya Chen at HOME A (label "Larkspur Loop"); her pickup is confirmed, where the f7 exports draw it unconfirmed; the settled Today PickupCard uses f1-today-tab · ios · 01's "You · Tuesday · Waste Connections" with the you-added mark, not the confirmed-just-now "✓ You added this · Tuesday";
   - the artboard-naming extension ("storyboard" in the platform slot);
   - the notification premise: Maya confirmed Tuesday on this Pixel on Mon 28 Sep, 6:05 PM (the evening before a Tuesday pickup, when the card exists) and tapped "Not now" on the reminder ask, so the night-before row is absent and the system never asked her until step 1, where she taps Yes on the morning row and then "Don't allow"; this contrasts with f1-today-tab's briefings-on frames;
   - the confirmer conflict: f4-today-pickup-card 02, f4-notification-settings ("Tuesday (confirmed by Sam)") and x-date-sheet 04 ("Sam · Tuesday, confirmed 3 Oct 2026") credit Sam on Sat 3 Oct; f1-today-tab 14 credits Maya on 3 Oct; this storyboard uses Maya on Mon 28 Sep;
   - the saved-place count: Maya has two saved places, Mom's house and Sam's old apartment (f1-your-places), which is why the card carries "For 2418 NE Larkspur Loop"; the string "Mom's place" is retired (flow-06);
   - the Android reading: a first denial in this visit's dialog collapses the card to the widget line (morning-row variant); the re-ask-once row (android 19) appears only on a later visit and is reachable from Notification settings; no frame here taps it;
   - the widget-offer wording conflict across three surfaces: "Your dates still show here on Today · Or put it on your home screen" with "Show me how" (f4-briefing-optin-card), "Pickup still shows here on Today" plus "Put today on your home screen" / "Show me how" (f4-today-pickup-card 16), against "Pickup still shows on Today." with "Put Today on your home screen" · "Add the widget" (f4-notification-primer 05);
   - the Pixel 8 / Android 15 / Pixel Launcher assumption and the 4x2 at 276x220dp;
   - the timeline (Mon 28 Sep confirm and decline; Mon 19 Oct 6:10–6:16 PM; 9:40 PM; Tue 20 Oct entries; Thu 22 Oct 4:10 PM; the 12:30 PM app open in B13; Mon 26 Oct 7:40 AM; Wed 28 Oct 7:50 AM; Tue 10 Nov in B9);
   - the air assumption: AirNow published no reading for her area between 7:00 AM and the 6:10 PM load, so Today was also stale at 6:10 PM and the 6:10 PM snapshot carries the 7:00 AM reading; the next reading (observed 9:00 PM) arrived before the 9:40 PM refresh. This is what lets MT8's forced refresh clear the stale air;
   - the PickupCard-on-a-non-eve-day decision: step 11 follows f4-today-pickup-card and f1-today-tab (card absent), against f7-widget-tap-landing 12, which draws the card;
   - step 10 is conditional on the B13 decision (background snapshot refresh); without it, B13 is what Maya sees;
   - B9 is a frame-only what-if in which Maya never opened the app after Mon 26 Oct;
   - B6 uses Jordan at PLACE B; its error line "We couldn't load your briefing." is invented and exists only to show what must not ship;
   - check 13 compares only the 101 threshold row of f4-notification-settings · android · 03-default; that frame's other switch states are Maya's choices with notifications on and do not apply to this denied Pixel;
   - proposed events: widget_snapshot_written (steps 8, 11, 12) and widget_pinned {source: pin_callback | placed_ids | ios_configs} (step 4, B2, B3); §5 names neither;
   - invented readings and strings: "observed 9:00 PM" (AQI 42 unchanged); "AQI 42 · Good · AirNow 12:00 PM" in B13; "Recycling and garbage · curbside by 6:30 AM tomorrow" carried from the f7 5:00 PM entry; "City of Vancouver water bill due · Today"; "Garbage only today"; "Updated 3h ago"; "You're offline · as of 6:10 PM"; "— 14 hours ago"; "— 9 hours ago"; "As of Mon 26 Oct, 7:40 AM · Open to refresh"; "Sample widget preview, not your address" (spoken); "We couldn't load your briefing." (B6); "Changing your pickup day needs a connection." reused from f1-today-tab; the step 9 and step 10 spoken labels and the branch spoken labels; the MUST NOT SHIP frame; every time chip and gap label;
   - the proposal to draw strip cells beyond the snapshot horizon as empty and dimmed;
   - the decision on the Android place-file control (sheet first or dialog first);
   - the air-lag decision (B13);
   - the staleness conflict (6 hours against 2 hours);
   - the pinned-slot string conflict;
   - the highlight conflict (f1-today-tab decays; f7-widget-tap-landing holds until first interaction);
   - that the pin flow assumes Android's pin-widget request works for the classic, non-Glance widget;
   - omitted: dark twins beyond B11, the 2x2 and 4x4 sizes in the main lane (see f7-today-widget · android · 15-minimum-size for the worst case), and the Android minimum-size air hero.

BATCH PLAN
Turn 1: artboards 1–2, then wait for "continue".
Turn 2: artboard 3, then wait for "continue".
Turn 3: artboards 4–5, then wait for "continue".
Turn 4: artboards 6–7, then wait for "continue".
Turn 5: artboards 8–9.
