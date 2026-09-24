# Web saver installs a native app: continuity of place, first-week state and permission
id: flow-14 · platforms: ios/android/web · artboards: 28

# Storyboard: Web saver installs a native app (flow-14)
id: flow-14 · platforms: ios/android (with web context frames) · type: journey storyboard · artboards: 9

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

TYPE: NEW (storyboard). This project draws no new screens. It lays out already-designed screens in the order one person meets them when he moves from the web to a native app. Draw each screen as a frame at 50% scale inside a lane, joined by labelled arrows. The founder uses this board to tell real exports from redraws, so every frame carries exactly one of these three caption forms:
- "export: <exact artboard name>" — the export is placed as is, with no changes.
- "export + deltas: <exact artboard name>" followed by numbered deltas — the export is placed and only date or count text, or a caption removal, changes, as listed.
- "REDRAWN from <exact artboard name>" — any change of person, place, marks, rows or layout. External frames read "REDRAWN from host: <screen>"; frames with no designed source read "REDRAWN (no designed source)".
No other caption form is allowed.

ARTBOARD NAMES. The house style names artboards "<surface-id> · <ios|android|web-390|web-1440> · <NN-state> · <light|dark>". A storyboard spans platforms, so this project uses "storyboard" in the platform slot ("flow-14 · storyboard · 03-install-and-first-open · light"). This is an intentional exception; record it on Notes. Frame labels inside the lanes use the real platform and the source artboard's v2 state name.

ATTACH (exported artboards, by exact name, grouped by turn; attach the ones that exist). Attach the Foundations boards 00a, 00b, 00c and 00d in every turn.
Turn 1 (artboards 02–04):
- f1-save-confirmation · web-390 · 03-saved · light (L1 source)
- f4-today-pickup-card · web-1440 · 01-unconfirmed · light (L2, L3 web card layout)
- f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now · light (L2 PLACE B confirmed card and its tray preview)
- x-date-sheet · web-1440 · 32-create-lease-dense · light (L4 web DateSheet layout)
- x-date-sheet · ios · 19-saved-lease-saved-place · light (L4 PLACE B lease values)
- f4-briefing-optin-card · web-390 · 03-one-on-one-off · light (L3 and N8 source)
- f9-founding-meter-preview · web-390 · 07-wall-no-open-slots · light (N1a and N1 source: the WallBar with its share and app-download footer; the link label is taken from this export)
- f1-today-tab · ios · 02-saved-place-quiet · light (N4 source)
- f5-today-calendar-strip · ios · 03-saved-place-unconfirmed · light (N4 strip source)
- x-place-file · ios · 05-sync-merge · light (N5 source)
- x-place-file · ios · 02-saved-place-first-week · light (N5 composition and the N5 ghost)
- f4-briefing-optin-card · ios · 18-this-phone-not-on · light (N6)
- f4-notification-settings · ios · 02-default · light (N9 source)
- f4-notification-settings · web-390 · 09-saved-place · light (N9 PLACE B variant)
- Host screenshots, redrawn exactly: the iOS App Store listing, the iOS native sign-in screen, and the iOS system notification dialog (draw every system part as a neutral grey placeholder, never the platform's own artwork).
Turn 2 (artboards 05–07):
- f4-today-pickup-card · ios · 21-tray · light (N10 inset style)
- f4-today-pickup-card · ios · 20-arrived-from-push · light (H24 comparison thumbnail beside N11)
- f1-today-tab · ios · 05-from-push · light (N11 source)
- f1-today-tab · ios · 15-foreground-push · light (N11 alternative source)
- f1-today-tab · ios · 08-no-place · light (A1 source)
- f1-today-tab · android · 01-dense-home · light (A2 composition)
- f7-widget-tap-landing · android · 13-saved-place · light (A2 reference: Jordan on a Pixel)
- f4-briefing-optin-card · android · 19-denied-once-reask · light (A4 source)
- f4-briefing-optin-card · android · 10-on-but-blocked · light (A5 card source)
- f4-notification-settings · ios · 05-os-denied · light (A5 settings source: the whole-app-blocked composition)
- f1-your-places · web-1440 · 13-account-switched · light (C1 source)
- f7-widget-gallery · ios · 01-gallery-medium · light (C2: the baked HOME A sample, by design)
- f7-today-widget · ios · 11-no-snapshot-no-place · light (C2)
- f7-widget-gallery · ios · 04-own-snapshot · light (C2: Jordan's own widget with the "Birchfield Ct" label)
- f7-today-widget · ios · 05-evening-confirmed · light (C2 reference only)
- f7-widget-tap-landing · ios · 09-saved-place · light (C2 source)
- f4-briefing-optin-card · ios · 17-declined-at-os-widget-offer · light (C4 source)
- f7-widget-howto-sheet · ios · 01-default · light (C4 source)
- f4-briefing-optin-card · web-390 · 11-declined-undo · light (C6 source)
- Host screenshots: the Android native sign-in screen, the Android 13+ system notification dialog and the iOS lock-screen notification style (grey placeholders).
Turn 3 (artboards 08, 01, Notes): no new exports; the handoff checks and the map reuse frames already drawn as thumbnails.
Frames with no export to place (drawn with a REDRAWN caption): L1–L4, N1a, N1, N2, N3, N4, N5 and its two ghosts, N7, N8, N9, N10, N11 and its alternative, every Android frame (A1–A6, including A4 and A5's card), and every branch frame whose caption below reads REDRAWN. Frames placed with "export + deltas": N6 (founder-verify; see N6). Frames placed as is: C2's three exports — f7-widget-gallery · ios · 01-gallery-medium, f7-today-widget · ios · 11-no-snapshot-no-place and f7-widget-gallery · ios · 04-own-snapshot.

PERSONA & SITUATION
Jordan Lee, 36, is at tier T1. His only place is PLACE B, 1107 NE Birchfield Ct, Camas, WA 98607, which he saved on Sat 10 Oct 2026, the day after moving from Portland, OR. His email is jordan.lee@example.com. The City of Camas lists Thursday for pickup; his recycling frequency is Not set.
This storyboard is the web-first branch of flow-01. It is the same Jordan and the same save on Sat 10 Oct, but here he never installs the app that week. He does everything on his laptop (web-1440):
- Sat 10 Oct: he registers from /start and confirms his email. The address is saved at registration.
- Wed 14 Oct, 6:10 PM: he taps "Yes, Thursday is right" on Today's PickupCard, then "Turn on reminders", and allows notifications in his browser. This assumes the web briefing push channel has shipped; see H2. Then he adds "Lease ends" Wed 31 Mar 2027 with 30 days' notice, which gives a Notice deadline of Mon 1 Mar 2027 and a reminder on Mon 15 Feb 2027.
- On TODAY, Mon 19 Oct, 6:10 PM, on his iPhone, he opens pantopus.com/start in Safari (signed out there), types his address, taps the app-download link in the WallBar footer and installs Pantopus.
- "Two days later · Wed 21 Oct, 6:00 PM", his first native push arrives.
The flows-spec persona (Maya Chen at 1402 NE 3rd Ave) is replaced by Jordan at PLACE B throughout.
Save date. The fixture save date is Sat 10 Oct, so his first week ended Sat 17 Oct and Mon 19 Oct is day 9. f1-today-tab and x-place-file were drawn assuming a Sat 17 Oct save (first week until Sat 24 Oct). Under that reading, Mon 19 Oct is still inside the first week. The happy path uses the fixture; the ghost frames beside N4 and N5 show the exports' reading (see H23).
Android: the Android lane replays the same Mon 19 Oct moment as if Jordan's phone were an Android phone. f7-widget-tap-landing already draws "Jordan on his Pixel".

GOAL
Open the app and find Today, his confirmed Thursday and his dates already there, with no re-onboarding and an in-context notification ask for this device only.
§5 METRIC: Week-four return attributed to native triggers (session_open written by the iOS and Android clients with trigger 'push' or 'widget'), and Activation through a native briefing or widget. Jordan activated on the web on Wed 14 Oct (day 4). This journey keeps that activation true on native and adds the native return triggers. N11 writes session_open {trigger: 'push', kind: 'pickup'} from iOS in week two. The week-four push is Wed 4 Nov, 6:00 PM (day 25); name it in the N11 callout. Branch C2 writes session_open {trigger: 'widget'}.

THE HAPPY PATH
Each frame lists: caption form · platform · surface id and state · what Jordan does · what the screen shows (key strings, verbatim) · what is CARRIED · MOMENT OF TRUTH (a callout in the margin lane).

Lane 02 — what the server already holds (context, drawn small)
Draw four web-1440 thumbnails at 25% scale on the left, and a CARRIED-STATE LEDGER card on the right. The ledger is a plain two-column table on surface.raised, and every later frame points back to its rows by number.
- L1 · Sat 10 Oct · REDRAWN from f1-save-confirmation · web-390 · 03-saved · light (at 1440): "Saved privately", "1107 NE Birchfield Ct, Camas, WA 98607", "Only you will see this."
- L2 · Wed 14 Oct, 6:10 PM · REDRAWN from f4-today-pickup-card · web-1440 · 01-unconfirmed · light (recast to PLACE B, confirmed, with values from ios 07-saved-place-confirmed-just-now): "Garbage tomorrow", "✓ You added this · Thursday", "Recycling: Not set", status line "Saved to your calendar. Only you."
- L3 · Wed 14 Oct · REDRAWN from f4-today-pickup-card · web-1440 · 01-unconfirmed · light and f4-briefing-optin-card · web-390 · 03-one-on-one-off · light: the same card's inline ask on web, then the browser's permission dialog (grey placeholder), then the briefing card with "The night before pickup · 6:00 PM · Change".
- L4 · Wed 14 Oct · REDRAWN from x-date-sheet · web-1440 · 32-create-lease-dense · light (values from ios 19-saved-lease-saved-place): the DateSheet as a right SlidePanel over Today: Lease ends Wed 31 Mar 2027, Notice deadline Mon 1 Mar 2027, Remind me 14 days, "Saved to your calendar. Only you."
Ledger rows:
- R1 · SavedPlace: 1107 NE Birchfield Ct, saved Sat 10 Oct, scope saved_place.
- R2 · Pickup rule: Thursday, source you, frequency Not set.
- R3 · Briefings: evening on at 6:00 PM (web push, one browser); morning never answered. The browser grant also turned on Air & weather alerts at 101 and Account & security (post-grant defaults; see H21).
- R4 · Dates: Lease ends Wed 31 Mar 2027; Notice deadline Mon 1 Mar 2027; reminder Mon 15 Feb 2027.
- R5 · First-week set: save, reminder and one date are done. The pickup step is done only if a weekday-only confirm completes it (x-place-file requires the frequency too, and R2's frequency is Not set). Print "complete on Wed 14 Oct — pending H23" in the row. No widget hint has been shown yet, because web has no widget.
- R6 · Device tokens: none native. Widget: none placed.
Time gap after lane 02: "Five days later · TODAY · Mon 19 Oct, 6:10 PM · on his iPhone".

Lane 03 — Mon 19 Oct, 6:10 PM, install and first open (iOS)
N1a · web-390 · f9-founding-meter-preview · 07-wall-no-open-slots (half-frame) · REDRAWN from f9-founding-meter-preview · web-390 · 07-wall-no-open-slots · light (half-frame, top of the page, in iPhone Safari).
- Does: types "1107 NE Birchfield Ct" in the /start field, picks the Camas suggestion and taps "See your place". (He is signed out in Safari, and the wall belongs to the preview that follows an address.)
- Shows: the address field and the top of the preview.
- Carries: the typed address, held only in the page. Caption: "nothing stored".
Arrow N1a→N1: "tap 'See your place', scroll to the wall".
N1 · web-390 · ext:start-wallbar · WallBar, no open slots · REDRAWN from f9-founding-meter-preview · web-390 · 07-wall-no-open-slots · light.
- Shows: the preview under the sticky wall "Keep this address handy." and its benefit line; the footer's app-download link, with its label taken exactly from the attached f9 07 export (no prompt quotes it; do not invent one), marked with a focus marker.
- Does: taps the app-download link.
- Carries: nothing. The link opens the App Store; no account data travels in the URL.
- MOMENT OF TRUTH: the link carries no address or email in its query string.
Arrow N1→N2: "tap app-download link".
N2 · iOS · ext:app-store · listing · REDRAWN from host: iOS App Store listing (grey system chrome).
- Does: installs and taps Open.
Arrow N2→N3: "install", then "first launch".
N3 · iOS · ext:native-sign-in · first launch, then host sign-in · REDRAWN from host: iOS native sign-in screen (two half-frames).
- Shows: left, first launch opening straight to sign-in, with a struck-through ghost of the iOS notification dialog in the margin labelled "Removed from launch"; right, the host sign-in screen with the email value "jordan.lee@example.com".
- Does: signs in with the same email.
- Carries: the account. R1–R5 come from the server.
- MOMENT OF TRUTH: nothing fires on first launch, because the AppDelegate permission request has been removed. There is no carousel and no location prompt.
Arrow N3→N4: "signed in".
N4 · iOS · f1-today-tab · 02-saved-place-quiet (PLACE B, confirmed Thursday) · REDRAWN from f1-today-tab · ios · 02-saved-place-quiet · light (dated Mon 19 Oct, full-length scroll with a dashed fold).
- Changes from the export, all listed on Notes with the same strings: (1) no FirstWeekRow, because the fixture save (Sat 10 Oct) puts day 9 past the 7-day window; (2) the strip's Thursday cells show TICK marks instead of hollow marks, and the rows are retitled for a confirmed day: "Garbage" · "Recycling: Not set" · "✓ You added this · Thursday" (these strings have no designed source; see H1); (3) the "Set your pickup day" button is removed from the strip; (4) Jordan's "Renters insurance renews" row is removed (he never added it), so the summary reads "Next 14 days: 3 items"; (5) the briefing card is N6's state, not never-asked.
- Shows: location row "1107 NE Birchfield Ct · Saved place · Only you" · "Updated just now"; no PickupCard, because tomorrow is Tuesday; QuietDayReceipt "Nothing needs your attention today" with each CheckItem carrying its source time, as exported: "weather 5:45 PM · air 7:00 AM · alerts 6:00 PM · your calendar 6:00 PM"; the property-tax signal below the receipt, as the export draws it (Mon 2 Nov is 14 days out, a heads-up below the push threshold, so it does not cancel the all-clear); the 14-day card "Next 14 days: 3 items": Thu 22 Oct and Thu 29 Oct with TICK marks in their cells and the rows "Garbage" · "Recycling: Not set" · "in 3 days · Thu 22 Oct" / "in 10 days · Thu 29 Oct" · "✓ You added this · Thursday", plus the Mon 26 Oct statewide voter bar; "+ Add a date" with "Only you will see this."; weather; air "AQI 42 · Good"; the gutters tile, as exported; the briefing card as N6 draws it.
- Beside N4, a thin ghost strip labelled "export reading (Sat 17 Oct save) · Open — founder call · H23": the FirstWeekRow "Next: set your pickup day →" with "Hide this" at slot 2b.
- Carries: R2 and R3 rendered on this device.
- MOMENT OF TRUTH: native Today uses the same composition as web and is not home-gated. The confirmed Thursday arrives as ticks, never as hollow city marks. Nothing asks him to save, confirm or hide anything again. (The confirmed PickupCard itself first appears on native at N11, the next pickup eve; Mon 19 Oct is not one.)
Arrow N4→N5: "tap the Place tab".
N5 · iOS · x-place-file · 05-sync-merge (PLACE B) · REDRAWN from x-place-file · ios · 05-sync-merge · light, using the x-place-file · ios · 02-saved-place-first-week · light composition for PLACE B, with no Set up block (fixture reading: the first week ended Sat 17 Oct).
- Shows: LandingBannerSlot, x-place-file's string with one delta: "Synced 3 items from your other device" · "Your pickup day and 2 dates came with you. · See what moved" (the export says "3 dates"; Jordan's three items are a pickup day and 2 dates); header "1107 NE Birchfield Ct" with "Saved place · Only you" and "4 on file"; the year band as 02 draws it, with his Thursdays ticked; the Next row "Put today on your home screen" · "See how to add it" with "Not now" and "Skip" (this depends on H23); Place: the pickup row, recast from x-place-file's saved-place row to the confirmed form, "Pickup day · Thursday · how often: Not set" with the you-added mark and the caption "You added this", and "Moved in · Not set · Add"; Dates: "Notice deadline · in 133 days · Mon 1 Mar 2027" and "Lease ends · Wed 31 Mar 2027", each with the you-added mark, the voter row, and "More you can add (3)" (Insurance renews, Warranty ends, HOA dues); the grey row "Money, people and proof · Not here — this is a saved place · Claim this address first"; footer "Only you will see this." and the text link "Claim this address".
- Beside N5, two small ghost frames:
  - "Second visit": the same page with no banner.
  - "x-place-file reading · Open — founder call · H23": the "Set up your place" block (caption "For your first week · until Sat 24 Oct", with Dismiss and no fraction) with "Save your address" ticked, the Next row "Set your pickup day" · "Set pickup day" with "Not now" and "Skip", then "Turn on a reminder or add the widget" and "Add one date that matters" ticked. Caption it: "Under the exports' Sat 17 Oct save, or if an undone pickup step outlives the first week, the Next row asks for the pickup frequency instead of the widget."
- Does: reads it once. "See what moved" scrolls to and highlights the three rows (assumption; see H6).
- Carries: nothing new. The banner is marked seen on the server.
- MOMENT OF TRUTH: the banner shows once and names what came across (R2 and R4). Dismissals and ticks are stored on the server, so nothing re-asks.
Arrow N5→N6: "tap the Today tab".

Lane 04 — Mon 19 Oct, the notification ask for this device
N6 · iOS · f4-briefing-optin-card · 18-this-phone-not-on · export + deltas: f4-briefing-optin-card · ios · 18-this-phone-not-on · light.
- Deltas: (1) remove the "For 2418 NE Larkspur Loop" caption, because Jordan has one place; (2) remove the timezone (Eastern Time) caption, because the phone is on Pacific time.
- Founder-verify note beside the caption: "the export is Maya's iPhone and its prompt never states row 2's state; if the export's morning row is not in the 'A morning heads-up?' asking state, recaption this frame REDRAWN from the same artboard with the row 2 strings below as a change". Otherwise keep the two caption-removal deltas.
- Shows: overline "Briefings"; "The night before pickup · On in your browser" with the button "Turn on for this iPhone"; row 2 "A morning heads-up?" with "Date reminders at 7:00 AM" and "Yes", "Not now", "No thanks"; the silence line "Only when something needs you. No news means nothing's up."; "Notification settings".
- Does: taps "Turn on for this iPhone".
- Carries: a request for this device only.
- MOMENT OF TRUTH: the card reads this iPhone's real OS state. The switch never shows "on" for a device with no permission, and the web state is stated in words.
Arrow N6→N7: "tap 'Turn on for this iPhone'".
N7 · iOS · ext:os-permission-dialog · one-time notification dialog · REDRAWN from host: iOS system dialog (grey placeholder over dimmed Today). Beside it, a struck-through thumbnail labelled "f4-notification-primer · not opened from the card".
- Does: taps Allow.
- Carries: the OS grant and this iPhone's device token.
- MOMENT OF TRUTH: the permission is asked once, in context, and the card's button goes straight to the system dialog with no second "Yes".
Arrow N7→N8: "Allow".
N8 · iOS · f4-briefing-optin-card · 03-one-on-one-off (after the grant) · REDRAWN from f4-briefing-optin-card · web-390 · 03-one-on-one-off · light (at iOS).
- Shows: "The night before pickup · 6:00 PM · Change"; the polite status "Saved · 6:00 PM"; row 2 still asking. One light haptic tick on the successful save. Focus stays on the row.
- Carries: R3 now reads "evening on · one browser and this iPhone".
- MOMENT OF TRUTH: the time he chose on the web (6:00 PM) comes across unchanged, and the grant turns on nothing he declined.
Arrow N8→N9: "tap 'Notification settings'".
N9 · iOS · f4-notification-settings · 02-default (PLACE B) · REDRAWN from f4-notification-settings · ios · 02-default · light, with the PLACE B edge cases from f4-notification-settings · web-390 · 09-saved-place · light.
- Shows: master "Push notifications from Pantopus" ON with the device line "Sends to this iPhone and one browser."; Briefings: "Evening briefing" ON, 6:00 PM, "Only when something needs you. No news means nothing's up.", "Pickup comes with the evening briefing.", and the status line "Skipped tonight — nothing needed you" with no "Last sent" line (nothing was due Tue, and no push has ever been sent to Jordan); the caption "Briefings follow your saved place, 1107 NE Birchfield Ct · Saved place · Only you"; the status row "Pickup day · Thursday" (the you-confirmed form; see H9); "Morning briefing" off; Air & weather alerts ON at "Unhealthy for Sensitive Groups · AQI 101 and up"; Dates & bills "Date reminders" ON; "Bill and task reminders" hidden; Household activity as the grey FactRow "Claim this address first"; Account & security ON; "Home screen widget · Add".
- Carries: nothing new.
- MOMENT OF TRUTH: settings show the per-device state honestly, and every switch matches what this iPhone will deliver.
Time gap after N9: "Two days later · Wed 21 Oct, 6:00 PM".

Lane 05 — Wed 21 Oct, first native push
N10 · iOS · ext:os-push-tray · lock screen · REDRAWN from host: iOS lock screen, in the f4-today-pickup-card · ios · 21-tray inset style. Beside it, a 25% thumbnail of the same notification in his laptop browser, labelled "the browser gets it too (one per device)".
- Shows: "Pantopus" · "now" · "Garbage tomorrow" · "Bins out tonight". Annotation: "iOS Active · never Time Sensitive". No street label, no house number, no action button.
- Does: taps it.
- Carries: the evening delivery. Caption the carried link with both designed forms, side by side: "pantopus://today?section=pickup + delivery id (f4-today-pickup-card)" and "pantopus://hub-today?deliveryId=…&kind=evening (f1-today-tab)" — see H24.
- MOMENT OF TRUTH: the first native push fires on his confirmed day and carries no address.
Arrow N10→N11: "push at 6:00 PM, tap".
N11 · iOS · f1-today-tab · 05-from-push (PLACE B) · REDRAWN from f1-today-tab · ios · 05-from-push · light (recast from HOME A to PLACE B).
- Shows: the pinned slot takes no space (f1-today-tab's rule: no pinned line repeats a card already in the first viewport); the PickupCard confirmed ("Garbage tomorrow", "Bins out tonight — curbside by 6:30 AM (City of Camas)", "✓ You added this · Thursday", "Recycling: Not set", "Change pickup day", "Only you will see this.") highlighted and focused; "Updated just now". Beside N11, a 25% thumbnail of f4-today-pickup-card · ios · 20-arrived-from-push, labelled "f4: card pinned under the location row · see H24".
- Carries: session_open {trigger: 'push', kind: 'pickup'} from the iOS client.
- MOMENT OF TRUTH: the native push lands on the exact card. Margin callout: "Native trigger counted. Week-four push: Wed 4 Nov, 6:00 PM."
- Under N11, draw the alternative arrival "Today already open", REDRAWN from f1-today-tab · ios · 15-foreground-push · light (recast to PLACE B): no banner, the card highlighted, bell +1.

LAYOUT
- Each lane artboard is a horizontal lane, read left to right. Draw each frame at 50% scale: iOS 196.5×426, Android 206×458, web-390 195×422. Lane 02 thumbnails are at 25%; N1a is a half-frame. Draw N4 as a 50% full-length scroll with a dashed fold line.
- Keep each artboard to about 10 full frames, and each turn to about 20, counting thumbnails, half-frames and ghosts as half (see BATCH PLAN).
- Above each frame, print "N<n> · <platform> · <surface-id> · <v2 state name>" in label 13/18 text.strong (for external steps, "ext:<id> · <host screen>"). Under it, in caption text.secondary, print the time and exactly one caption form: "export: <name>", "export + deltas: <name>" followed by the numbered deltas, or "REDRAWN from <name>". Founder-verify frames add their small verify note beside the caption.
- Join frames with 1.5px text.secondary arrows labelled by trigger: "tap 'See your place', scroll to the wall", "tap app-download link", "install", "first launch", "signed in", "tap the Place tab", "tap the Today tab", "tap 'Turn on for this iPhone'", "Allow", "tap 'Notification settings'", "push at 6:00 PM, tap". The one cross-device hop (lane 02 → N1a) is a dashed arrow with a device glyph, labelled "same account, new device".
- On each arrow that carries ledger state, put a chip that cites the ledger row ("carries R2 · Thursday").
- Draw time jumps as a labelled 96px gap with two vertical hairlines and a vertical label.
- Put the moment-of-truth callouts in a margin lane above the frames: surface.raised cards with a 1px text.secondary edge, the frame number, a one-line claim and a leader to the element.
- Draw ghost frames (beside N4 and N5) at 50% opacity of their content with a dashed text.secondary edge and a printed status label; never rely on the dashes alone.
- Put failure branches in a lower lane. Each branch leaves its source frame downward and rejoins with an upward arrow labelled "rejoins N<n>", or ends in a flat bar labelled "ends here" with the reason.
- Artboard 01 is the map, drawn in the last turn: lane 02's four web moments and the happy-path frames N1a–N11 as 12% thumbnails on one time axis (Sat 10 Oct → Wed 21 Oct), with the web and native segments named in text, the Android lane as a labelled stub under the iOS lane, the "Build blocker" bar on that stub, and the C branches as labelled stubs. Do not thumbnail every branch frame.
- Print lane titles as text; never use colour alone to separate lanes, platforms or status.

FAILURE BRANCHES
Lane 06 — Android (the same Mon 19 Oct moment on an Android 14 phone)
- A1 · the current build: Android has no saved-places client. After sign-in (REDRAWN from host: Android native sign-in screen), Today dead-ends in the no-place state, REDRAWN from f1-today-tab · ios · 08-no-place · light (at 412): "Today starts with a place" · "Save an address and Today will show its weather, air, alerts and dates." · "Add a place" · "Claim an address". Label it "Current build · Build blocker: SavedPlacesApi" and end it with "ends here until SavedPlacesApi ships". A saved-place user must never see this.
- A2 · the target: Android Today at PLACE B, REDRAWN from f1-today-tab · android · 01-dense-home · light (Material 3 composition with N4's content; reference f7-widget-tap-landing · android · 13-saved-place). Rejoins the N4 position.
- A3 · the briefing card on Android, REDRAWN from f4-briefing-optin-card · ios · 18-this-phone-not-on · light (at 412, with N6's deltas): "The night before pickup · On in your browser" with "Turn on for this phone" → the Android 13+ system dialog (REDRAWN from host, grey placeholder). On Android 12 and below, no dialog: the row switches on directly. Allow rejoins N8 (Android version).
- A4 · denied once → REDRAWN from f4-briefing-optin-card · android · 19-denied-once-reask · light (recast to Jordan: no place caption; row 1 "The night before pickup · On in your browser" with "Turn on for this phone"; row 2 "A morning heads-up?" asking; the export is a HOME A frame, and the prompt says only Maya's frames carry the place caption): "Turn on for this phone" re-asks once. (See H11 for the conflicting "collapse to one line" rule.)
- A5 · denied twice (blocked) → REDRAWN from f4-briefing-optin-card · android · 10-on-but-blocked · light (recast to Jordan: no place caption; row 1 "The night before pickup · On in your browser" with "Open settings" in place of "Turn on for this phone", because the phone is blocked): "Notifications are off for Pantopus" with "Open settings". The export is the whole-card amber state; this row is on for Jordan in his browser but blocked on this phone, so see H10 for whether the amber line applies. The settings page is REDRAWN from f4-notification-settings · ios · 05-os-denied · light (the whole-app-blocked composition, at Android size as an M3 preference list): the pinned full-width banner (warning glyph, text.primary on the warning tint) "Notifications are off for Pantopus. These rows still update inside the app." with its settings button as 05 draws it, and the widget offered once inside the banner; the Briefings widget row hidden; every switch below the banner drawn off and disabled; under Evening briefing, and under each other row he has on (Air & weather alerts, Date reminders, Account & security), the caption "Your choice: on. It comes back when notifications are allowed." Ends here until he changes Android settings, then rejoins N8.
- A6 · "Not now" on Android never fires the system dialog and spends no denial. Draw it as a half-frame REDRAWN from f4-briefing-optin-card · web-390 · 11-declined-undo · light (at 412).
Lane 07 — iOS branches
- C1 · a different account is signed in on the device (later, he signs in with his work address jordan.lee.work@example.com by mistake). Today's chip and places reset: Today shows that account's state, and Your places (REDRAWN from f1-your-places · web-1440 · 13-account-switched · light, at iOS) shows "You switched accounts. These are the places saved to this account." with Close. The widget must stop showing Birchfield Ct at once. Recovery: sign out, sign in with jordan.lee@example.com → rejoins N4.
- C2 · the widget is added before any Today load. Between N2 and N3, he adds the Pantopus widget from the gallery (export: f7-widget-gallery · ios · 01-gallery-medium · light — baked HOME A sample, by design; print "(baked HOME A sample, by design)" next to the frame label so it does not read as a persona error), then goes to the home screen before signing in. The placed widget shows the no-snapshot state (export: f7-today-widget · ios · 11-no-snapshot-no-place · light): "Open Pantopus to see today at your address", a glyph and no cells. A tap opens the app → sign-in (N3) → Today loads (N4) → the snapshot is written → the widget shows the "Birchfield Ct" label (export: f7-widget-gallery · ios · 04-own-snapshot · light) with the ticked Thursday (REDRAWN from f7-today-widget · ios · 05-evening-confirmed · light, recast). A later widget tap lands on the saved-place landing, REDRAWN from f7-widget-tap-landing · ios · 09-saved-place · light, with one change: the strip shows TICK marks on Thu 22 and Thu 29 Oct (matching N4), not the export's hollow Thursdays. It writes session_open {trigger: 'widget'}. Rejoins N4. The Next row on N5 ("Put today on your home screen") must disappear once the widget is placed (see H15).
- C3 · the web briefing is on but this iPhone's device token is not registered (he skipped N6, or registration failed after Allow). The settings frame (REDRAWN from f4-notification-settings · ios · 02-default · light, as N9) shows the device line "Sends to one browser. Not to this iPhone yet." and, under "Evening briefing", "On in your browser · Not on this iPhone" with "Turn on for this iPhone". On Wed 21 Oct at 6:00 PM, only the laptop browser gets the push. The iPhone shows the same PickupCard on Today (N11 content, with no highlight). "Turn on for this iPhone" rejoins N7.
- C4 · iOS Don't Allow at N7 → REDRAWN from f4-briefing-optin-card · ios · 17-declined-at-os-widget-offer · light (recast to Jordan): one text.secondary line "Pickup still shows here on Today · Or put it on your home screen" with "Show me how". The browser row stays on and is not described as off (see H12). No amber. "Show me how" → REDRAWN from f7-widget-howto-sheet · ios · 01-default · light (recast to Jordan's snapshot) → widget placed → rejoins as C2's placed widget.
- C5 · the current build still asks at launch (must be removed). At N3, the system dialog fires before sign-in (REDRAWN from host). If he taps Don't Allow there, N6 can only offer settings. Label it "Current build · must not ship" and end it with "ends here".
- C6 · "Not now" on the card's morning row → the InlineUndo "No reminder for now · Undo" (REDRAWN from f4-briefing-optin-card · web-390 · 11-declined-undo · light, at iOS). Stored on the server, so the laptop never asks either. The night-before row is unaffected.

HANDOFF CHECKS
Draw each check as a numbered row on artboard 08. Each row has the frame thumbnails it names, the rule, and a status mark: FILLED "Agrees in v2" or HOLLOW "Open — founder call". Print the status word next to the mark.
- H1 · Lane 02 (L2) and N4 must agree on the pickup fact: "✓ You added this · Thursday", "Recycling: Not set", and a tick in the strip cells. f4-today-pickup-card writes "✓ You added this · Thursday", x-date-sheet writes "You · Thursday", and f5's saved-place rows are drawn only unconfirmed ("Pickup day" · "Which bins go out isn't set yet"), so N4's confirmed strip rows ("Garbage" · "Recycling: Not set" · "✓ You added this · Thursday") have no designed source; N4's change list and Notes use exactly these strings. Status: open.
- H2 · L3 and N6 must agree that a web briefing exists: f4-briefing-optin-card and f4-today-pickup-card both say the web ask needs a web briefing push channel that has not shipped. Without it, R3 cannot be "on in your browser", and N6's "On in your browser" state never occurs. Status: open (build dependency).
- H3 · N3 and N6 must agree that the launch-time request is gone: if the AppDelegate still asks at launch, most iOS users arrive already asked, and N6/N7 never happen (f4-briefing-optin-card Notes). Status: open (build dependency).
- H4 · N4 and the web Today must agree on composition and order: location row, pinned slot, FirstWeekRow slot, PickupCard or QuietDayReceipt, 14-day card, weather, air, alerts, signals, tiles, briefing card. Status: agrees in v2 (f1-today-tab).
- H5 · N4 and R5 must agree that first-week state is stored on the server: whatever the step status is, the new device shows the same FirstWeekRow state and never re-asks "Hide this". The research brief says checklist state syncs across devices. Whether the set is complete, and so whether N5's Next row may be the widget, is H23; where the row lands is H25. Status: agrees in v2 (server-side storage only).
- H6 · N5 must agree with the banner contract. Two strings exist: 00d and f1-your-places write "Synced 3 items from your other device · Review", while x-place-file writes "Synced 3 items from your other device" · "Your pickup day and 3 dates came with you. · See what moved" (drawn here with "2 dates" for Jordan). Pick one action label and one destination. Also: "synced" is a word the glossary forbids as a freshness word (00d Notes 7), and on a fresh install nothing local was merged, so it is unclear whether the banner should show at all. The banner sits in the place file only, never in Today's pinned slot, which holds only the claim and join notices. Status: open.
- H7 · N5 and N4 must agree on the count: "4 on file" (address, pickup day, lease ends, notice deadline) follows x-place-file's count rule, while f1-today-tab's old "3 of 6 things on file →" row is gone. f11-keeper-strip's T1 frame shows the integer 4. Status: agrees, with 4 as an invented value.
- H8 · N6 and N7 must agree on the path: f4-briefing-optin-card says a row's "Yes" opens the system dialog with no primer, but it never states what "Turn on for this iPhone" opens. This storyboard assumes the same direct dialog. Status: open.
- H9 · N9's status row must agree with Jordan's rule: f4-notification-settings draws "Pickup day · Tuesday (confirmed by Sam)" for HOME A and "Pickup day · Not set · Set it" for PLACE B, but has no confirmed-by-you saved-place form. The frame uses "Pickup day · Thursday". Status: open.
- H10 · A5 and N6 must agree on "on but blocked": the amber line appears "only when a row is on and the system blocks delivery". Here the evening briefing is on for the account (browser) but blocked on this phone. The per-device state has no defined visual. f4-notification-settings says only "the row states the per-device state", with no string. Status: open.
- H11 · A4 and C4 must agree on what a fresh denial does: f4-briefing-optin-card collapses the card to one line after a denial in this visit's dialog, but its Android rule re-asks once after a first denial (frame 19). Status: open.
- H12 · C4 and R3 must agree: the declined line "Pickup still shows here on Today · Or put it on your home screen" must not suggest briefings are off in the browser. Status: open.
- H13 · N10 and the research rule "One push per trigger per day" must agree on devices: the storyboard assumes one per device (the browser and the iPhone both get it). Tapping one should not leave the other unread in the bell count. Status: open.
- H14 · C2 must agree across the widget prompts: the placed widget's no-snapshot text is "Open Pantopus to see today at your address" (f7-today-widget), the gallery shows the baked HOME A sample (f7-widget-gallery), and the how-to sheet captions it "Sample — yours will show your address". The house PUSH rule forbids "Open Pantopus to…" in pushes; confirm that it may appear on a widget. f7-today-widget's no-place copy "Save an address to see today here" ships only where the Add a place sheet exists (not Android yet). Status: open.
- H15 · C2 and N5 must agree on widget detection: x-place-file shows the widget Next row "because no widget is placed", and the app must learn a widget was placed (a placed-widget list or an add confirmation). f7-widget-howto-sheet ends at "Done" with no confirmation on iOS. The same gap decides whether activation can count a placed widget rather than a written snapshot (flow-01 H25). Status: open.
- H16 · C2 and N10 must agree on the PLACE B label: f7-widget-gallery 04 labels Jordan's widget "Birchfield Ct", while pushes drop the label for a one-place person, and the flows-spec gap notes the widget and its tap landing disagree on the label form ("Garfield St · Camas" vs the full address in the landing header). The fixtures define a label only for HOME A ("Larkspur Loop"). Status: open.
- H17 · A1 and A2 must agree with f7-widget-tap-landing 13 ("PLACE B renders … no briefing-screen error"): that frame draws the fixed build. Android Today at a saved place depends on SavedPlacesApi. Status: open (build blocker).
- H18 · C1 must agree across surfaces: the account-switch line exists only in f1-your-places ("You switched accounts. These are the places saved to this account."). f1-today-tab has no account-switched frame, and no widget prompt says the previous account's snapshot is cleared. Status: open.
- H19 · N4 and f1-your-places must agree on how many places Jordan has: this storyboard assumes one (no street label, no "For …" caption), while f1-your-places gives him five rows including "Mom's house". Status: open.
- H20 · N1a, N1 and the component contract must agree: the app-download link lives in the WallBar footer (f9 host), while the contract says "No actions inside the sticky WallBar"; and the wall appears only after a typed address (f9), so a signed-out /start visit without an address shows no wall — this board has Jordan type his address first (N1a). A signed-in web user has no other designed route to the app. No prompt quotes the link's label; N1 takes it from the f9 07 export. Status: open.
- H21 · N8 and N9 must agree on what the grant turned on: f4-notification-settings sets Air & weather alerts on at 101 and Account & security on after a new grant. A grant from the briefing card that silently turns on air alerts must say so on the card ("anything switched on as a side effect is visible on the card", f4-briefing-optin-card DONE WHEN). Status: open.
- H22 · The lease reminder (R4) must reach this iPhone on Mon 15 Feb 2027 at 7:00 AM, although the morning briefing is off, and it must land on the place file's Dates row (x-place-file 07), because Mon 1 Mar 2027 is outside Today's 14-day window. Status: open.
- H23 · R5, N4 and N5 (with both ghosts) must agree on first-week status. Save date: Sat 10 Oct (fixture; first week until Sat 17 Oct) vs Sat 17 Oct (f1-today-tab, x-place-file; first week until Sat 24 Oct). Step status: does a weekday-only confirm ("Yes, Thursday is right", frequency Not set) complete "Set your pickup day"? x-place-file says it is done "only when the person sets the frequency and confirms". If not, R5 is not complete, N4 shows the FirstWeekRow (under the Sat 17 reading), and N5's Next row is "Set your pickup day" · "Set pickup day" instead of the widget ask — and it is undefined whether an undone step keeps the Next row after the 7-day window. flow-01 H10 asks the same question. Status: open.
- H24 · N10 and N11 (with the thumbnail of f4-today-pickup-card · ios · 20-arrived-from-push) must agree on the native push landing. Link: "pantopus://today?section=pickup" plus the delivery id (f4-today-pickup-card) vs "pantopus://hub-today?deliveryId=…&kind=evening" (f1-today-tab; f7-widget-tap-landing says the formats must not collide). Pinning: f4 artboard 20 pins the card under the location row vs f1-today-tab's rule that no pinned line repeats a card in the first viewport (N11). Session attribution (trigger 'push') depends on which link and payload ship. Status: open.
- H25 · N4's ghost FirstWeekRow and N5's x-place-file ghost must agree on where the first-week row lands: x-place-file (entry 2) says Today's first-week row "lands on the 'Set up your place' block with that step highlighted" in the place file, while f1-today-tab says FirstWeekRow "scrolls to and highlights the control" on Today itself. On the new device this decides where "Next: set your pickup day →" goes (and affects H5 and H23). Status: open.

ACCESSIBILITY IN THE JOURNEY
Draw a focus marker (a 2px focus-ring glyph plus the word "Focus") on the focused element in every frame, and a speech-bubble glyph with the announced text beside every announcement.
- N1a: nothing autofocuses at 390; screen readers start at the H1. After "See your place", focus moves to the preview's first heading (a proposal; list it on Notes).
- N1: the app-download link is a 44px target, and its accessible name says where it goes. Keep the label exactly as the f9 07 export draws it.
- N3: after sign-in, VoiceOver starts at the large title "Today". No system dialog interrupts the first reading.
- N4: the location row is one element, "1107 NE Birchfield Ct, visible only to you, updated just now". Section titles are headings.
- N5: the banner is read once as a status on arrival ("Synced 3 items from your other device. Your pickup day and 2 dates came with you. See what moved, button"). Focus starts at the Place title, not the banner. "See what moved" scrolls once and moves focus to the first of the three rows.
- N6→N7: focus is on "Turn on for this iPhone" when the dialog opens. After Allow, focus returns to that row, and "Saved · 6:00 PM" is announced politely without moving focus. After Don't Allow (C4), focus lands on the collapsed line.
- N9: each switch reads its OS state and helper, for example "Evening briefing, on, 6:00 PM. Only when something needs you. Skipped tonight, nothing needed you."
- N10→N11: the app scrolls once to the PickupCard, focus moves there, and the highlight fades within 300ms (static under Reduce Motion).
- Android (A3–A5): 48dp targets with 8dp gaps; system Back from the dialog counts as dismiss and spends no denial. On A5's settings page, focus starts on the banner's heading, and each disabled switch reads its saved-choice caption.
- The no-notifications path: if Jordan never allows notifications on either device, N4 and N11's content still appear on Today, and the widget (C2) needs no permission. Nothing in this journey depends on a gesture, a push or colour.
- Every artboard reads in greyscale; lane titles, arrow labels, ledger rows, ghost labels and status words are text.

INSTEAD OF
- Instead of Maya at 1402 NE 3rd Ave, draw Jordan at 1107 NE Birchfield Ct — because the house-style fixtures are the single source of names and addresses.
- Instead of drawing the web week as full frames again, draw four 25% thumbnails and a carried-state ledger — because flow-01 owns those screens, and this board is about what crosses to the new device.
- Instead of a primer sheet after "Turn on for this iPhone", draw the system dialog directly — because the card already explains the request.
- Instead of a welcome carousel, a location prompt or a launch-time notification prompt on N3, draw sign-in straight to Today — because the saver already knows the product and the one-time grant must be spent in context.
- Instead of a switch that reads "on" because the web is on, state "On in your browser" and ask for this device — because the card must match what this phone will deliver.
- Instead of placing Maya's Android briefing-card exports as is for A4 and A5, redraw them recast to Jordan — because those exports carry her place caption and never-asked rows.
- Instead of asserting the first-week set is complete, draw the fixture reading and the export reading side by side with H23 — because the exports disagree and the founder must choose.
- Instead of quoting the banner from memory, draw x-place-file's string with its listed delta, and put the 00d/f1-your-places string in H6 — because the storyboard exists to show breaks between real designs.
- Instead of inventing the app-download link label, take it from the f9 07 export — because no prompt quotes it.
- Instead of hiding the Android dead-end, draw it and label it a build blocker — because this board must show where the loop breaks today.
- Instead of colour to separate web, iOS and Android, print the platform in every frame label — because the board must read in greyscale.

DONE WHEN
- Every flows-spec step for flow-14 appears as a frame, recast to Jordan and PLACE B, with its moment of truth: the typed address and wall, install with nothing firing, sign-in with no carousel or location prompt, native Today with the confirmed Thursday, the one-time sync banner, the per-device briefing ask, and the system dialog opened directly from the card.
- All four flows-spec failure branches appear (the Android saved-places blocker, a switched account, a widget before any Today load, and the web briefing on with no native token), plus the Android denial ladder (with A4 and A5 REDRAWN and recast to Jordan, and A5's whole-app-blocked settings page) and the iOS denial.
- The carried-state ledger rows R1–R6 are cited on every arrow that carries state, and R5 reads "pending H23".
- N1a is labelled with the v2 state name 07-wall-no-open-slots; N1's link label comes from the f9 07 export.
- N4 shows the property-tax signal, the gutters tile, per-check source times, "Next 14 days: 3 items" and the confirmed rows "Garbage" · "Recycling: Not set" · "✓ You added this · Thursday"; N5 shows the "2 dates" banner and both ghosts; N6 carries its founder-verify note; N9 shows "Skipped tonight — nothing needed you"; N10 carries both link forms.
- C2's gallery frame is marked "(baked HOME A sample, by design)".
- Every frame carries exactly one caption form, and the placed-as-is list names only C2's three exports.
- The gaps read "Five days later · TODAY · Mon 19 Oct, 6:10 PM" and "Two days later · Wed 21 Oct, 6:00 PM".
- All 25 handoff checks appear with their frames and statuses.
- Focus and announcements are marked on every transition, and every artboard reads in greyscale.

ARTBOARDS
1. flow-14 · storyboard · 01-map · light — drawn last: lane 02's four web moments and the happy path as 12% thumbnails on one time axis, web and native segments named, the Android stub with its build-blocker bar, and the C branches as labelled stubs.
2. flow-14 · storyboard · 02-web-before · light — L1–L4 at 25% and the carried-state ledger R1–R6, with the "Five days later" gap at the right edge.
3. flow-14 · storyboard · 03-install-and-first-open · light — N1a, N1–N5 (Mon 19 Oct, iPhone), with the ghost beside N4 and the two ghosts beside N5.
4. flow-14 · storyboard · 04-device-ask · light — N6–N9, with the struck primer thumbnail beside N7 and the "Two days later" gap at the right edge.
5. flow-14 · storyboard · 05-first-native-push · light — N10 with the browser thumbnail, N11 with the f4 20 thumbnail, and the foreground alternative under N11.
6. flow-14 · storyboard · 06-android-lane · light — A1–A6, with A1's "Build blocker" bar, A2 rejoining the N4 position, and A5's settings page.
7. flow-14 · storyboard · 07-branches · light — C1–C6 under thumbnails of N2–N9.
8. flow-14 · storyboard · 08-handoff-checks · light — H1–H25, each with its frame thumbnails, rule and status.
9. flow-14 · storyboard · 99-notes · light — list: the recast (Maya/1402 NE 3rd Ave → Jordan/1107 NE Birchfield Ct; web-first branch of flow-01; Android lane as a hypothetical Android phone for the same person); the artboard-name exception ("storyboard" in the platform slot, including this Notes artboard); the three caption forms (this board's "export + deltas" also allows a caption removal; flow-01 keeps it narrower); the frame lists: placed as is = C2's three exports (f7-widget-gallery · ios · 01-gallery-medium, the baked HOME A sample by design; f7-today-widget · ios · 11-no-snapshot-no-place; f7-widget-gallery · ios · 04-own-snapshot); export + deltas = N6 only; everything else REDRAWN, including every Android frame; A4 and A5 are REDRAWN because the f4-briefing-optin-card android 19 and 10 exports are HOME A frames ("Maya's frames show that caption; Jordan's do not"), 10 is the whole-card amber state, and Jordan's A3 state is "On in your browser" — recast strings: no place caption; A4 row 1 "The night before pickup · On in your browser" with "Turn on for this phone", row 2 asking; A5 row 1 "The night before pickup · On in your browser" with "Open settings"; the N6 founder-verify item (the export is Maya's iPhone; if its morning row is not in the asking state, N6 becomes REDRAWN); every invented string ("Next 14 days: 3 items", the confirmed strip rows "Garbage" · "Recycling: Not set" · "✓ You added this · Thursday" · "in 3 days · Thu 22 Oct" · "in 10 days · Thu 29 Oct", "4 on file", "More you can add (3)", "Turn on for this phone", "Pickup day · Thursday", "Sends to one browser. Not to this iPhone yet.", "On in your browser · Not on this iPhone", "jordan.lee.work@example.com", "nothing stored", "Removed from launch", "Current build · Build blocker: SavedPlacesApi", "Current build · must not ship", "the browser gets it too (one per device)", "same account, new device", "complete on Wed 14 Oct — pending H23", "(baked HOME A sample, by design)", the ghost labels and captions, the founder-verify note text, "f4: card pinned under the location row · see H24", and the ledger wording); every delta from an export: N4 drops the FirstWeekRow (fixture save date), turns hollow Thursdays into ticks, retitles the rows to "Garbage" · "Recycling: Not set" · "✓ You added this · Thursday", removes the "Set your pickup day" button, drops Jordan's renters-insurance row and reads "Next 14 days: 3 items", and keeps the property-tax signal, the gutters tile and the per-check source times as exported — the confirmed Thursday appears on Mon 19 Oct only as strip ticks, and the confirmed PickupCard (flows-spec step 3) first appears at N11; N5's banner body changes "3 dates" to "2 dates" and keeps x-place-file's "See what moved" (the "· Review" form comes from 00d and f1-your-places, H6); N5's pickup row is a recast of x-place-file's "Pickup day · Thursday · how often: Not set" to the you-added form with the caption "You added this"; N6 drops the "For …" and timezone captions; N9 adds "Skipped tonight — nothing needed you" with no "Last sent" line; A5's settings page uses the whole-app-blocked composition (05-os-denied) at Android size instead of the channel-blocked line; C2's tap landing shows ticks instead of hollow Thursdays; f1-today-tab and x-place-file assume a Sat 17 Oct save, while this board uses the fixture's Sat 10 Oct (H23); assumptions (the web briefing push channel shipped before Wed 14 Oct; "Turn on for this iPhone" opens the system dialog directly; "See what moved" scrolls to the three rows; the push goes to every registered device; the app-download link label is taken from the attached f9 07 export, because no prompt quotes it; Jordan types his address on /start in Safari before the wall appears (N1a); focus moves to the preview heading after "See your place", a proposal; the Android phone runs Android 14); the batch counting rule (thumbnails, half-frames and ghosts count as half); the open handoff checks H1–H3, H6, H8–H25; that flows-spec step 6 (primer) is replaced by the direct dialog, and step 4's "x-place-file 6 · sync merge" is v2 artboard 05-sync-merge; build dependencies (remove the AppDelegate launch request; ship SavedPlacesApi on Android; ship the web briefing channel; register a device token per device and report it to settings; detect a placed widget); the founder-verify items: whether a sync banner belongs on a fresh install, the banner's action label, whether a weekday-only confirm completes the pickup step, which save date the exports should use, where the first-week row lands (H25), the PLACE B widget label, and the City of Camas 2026 collection calendar (Thursday weekday rule; the illustrative Thanksgiving move Thu 26 Nov → Fri 27 Nov used in other storyboards, labelled there as the city's published holiday schedule).

BATCH PLAN
Turn 1: artboards 2–4 (about 19 frames, counting thumbnails, half-frames and ghosts as half), with the turn 1 ATTACH list, then wait for "continue".
Turn 2: artboards 5–7 (about 20 frames), with the turn 2 ATTACH list, then wait for "continue".
Turn 3: artboards 8, 1 and 9 (the handoff checks, the map, 99-notes).
