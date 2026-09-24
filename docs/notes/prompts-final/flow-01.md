# Stranger to activated: /start fact → save → account → confirm on another device → Today → pickup confirm and reminder → first pickup night
id: flow-01 · platforms: web/ios/android · artboards: 44

# Storyboard: Stranger to activated (flow-01)
id: flow-01 · platforms: web/ios/android · type: journey storyboard · artboards: 12

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

TYPE: NEW (storyboard). This project draws no new screens. It lays out screens that are already designed, in the order one person meets them. Draw each screen as a frame at 50% scale inside a lane, joined by labelled arrows. The founder uses this board to tell real exports from redraws, so every frame carries exactly one of these three caption forms:
- "export: <exact artboard name>" — the export is placed as is, with no changes.
- "export + deltas: <exact artboard name>" followed by numbered deltas — the export is placed and only date, relative-count or item-count text changes, as listed. Nothing else may change: no row is removed or added, no button moves, no mark changes, and nothing is cropped.
- "REDRAWN from <exact artboard name>" — any change of person, place, marks, rows or layout (including a removed row, a moved button, a flipped mark or a crop). A REDRAWN frame keeps its numbered change list under the caption. External and email frames read "REDRAWN from host: <screen>" or "REDRAWN (no designed source)".
No other caption form is allowed. This board keeps the narrow "export + deltas" definition (flow-14 also allows a caption removal); record this on Notes.

FOUNDER-VERIFY RULE for place-less exports. Several f4 artboards used below never say which place they draw, and f4 draws PLACE B only in frames 05, 06, 07 and the holiday frame; its dense default and inline-ask frames are HOME A. Wherever this prompt says "founder-verify (PLACE B)", the frame is captioned REDRAWN with the listed recast strings, and a small note beside the caption reads: "place unchanged only if the export shows Birchfield Ct / Thursday / 'Only you will see this.'; if so, recaption as export:". List every such frame on Notes.
The recast from HOME A to PLACE B always means: Thursday for Tuesday; "Garbage tomorrow" for "Recycling and garbage tomorrow"; City of Camas for City of Vancouver / Waste Connections; no "For 2418 NE Larkspur Loop" place caption; no household footer; footer "Only you will see this."; spoken label "Yes, Thursday is right".

ARTBOARD NAMES. The house style names artboards "<surface-id> · <ios|android|web-390|web-1440> · <NN-state> · <light|dark>". A storyboard spans platforms, so this project uses "storyboard" in the platform slot ("flow-01 · storyboard · 02-laptop-lunch · light"), including the Notes artboard ("flow-01 · storyboard · 99-notes · light"). This is an intentional exception; record it on Notes. Frame labels inside the lanes use the real platform and the source artboard's v2 state name.

ATTACH (exported artboards, by exact name, grouped by the turn that needs them; attach the ones that exist). Attach the Foundations boards 00a, 00b, 00c and 00d in every turn.
Turn 1 (artboards 02–04):
- f8-positioning-copy · web-1440 · 01-start-hero · light (F1)
- f8-seasonal-aha · web-1440 · 17-voter-7-days · light (F2)
- f8-scale-strips · web-1440 · 13-risk-detail-desktop · light (F3 source; two-column instrument only)
- f9-founding-meter-preview · web-390 · 07-wall-no-open-slots · light (F4 reference for the WallBar and its share and app-download footer)
- f1-email-verify-handoff · web-1440 · 01-sent-saved · light (F6)
- f1-email-verify-handoff · web-390 · 03-confirmed-other-device · light (F8)
- f1-email-verify-handoff · web-390 · 04-confirmed-same-device · light (F8 pixel-identical bracket)
- f1-save-confirmation · web-390 · 03-saved · light (F8 content reference)
- f1-today-tab · ios · 03-warming · light (F9 source)
- f1-today-tab · ios · 02-saved-place-quiet · light (F10 and F13 source)
- f4-briefing-optin-card · web-390 · 06-saved-place · light (F10, F13 briefing card, never asked)
- f4-briefing-optin-card · web-390 · 03-one-on-one-off · light (F17 source)
- f4-today-pickup-card · ios · 06-saved-place-unconfirmed · light (F14 primary source)
- f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now · light (F15, F17 source)
- f5-today-calendar-strip · ios · 03-saved-place-unconfirmed · light (F14 second source: the strip)
- f5-today-calendar-strip · ios · 14-saved-outside-window · light (F19 source)
- x-date-sheet · ios · 02-create-empty · light (F18a)
- x-date-sheet · ios · 19-saved-lease-saved-place · light (F18b source)
- Host screenshots, redrawn exactly: the existing web /start sticky WallBar at 1440 (F4), the existing /start register form at 1440 (F5), the existing iOS native sign-in screen (F12), and the iOS system dialog and lock-screen notification style (F16; draw every system part as a neutral grey placeholder, never Apple's own artwork).
Turn 2 (artboards 05, 06a, 06b):
- f4-today-pickup-card · ios · 21-tray · light (F20 inset style)
- f4-today-pickup-card · ios · 20-arrived-from-push · light (H23 comparison thumbnail beside F21)
- f1-today-tab · ios · 05-from-push · light (F21 source)
- f1-today-tab · ios · 15-foreground-push · light (F22 source)
- f1-email-verify-handoff · web-1440 · 02-sent-held · light (B1)
- f1-email-verify-handoff · web-1440 · 09-link-expired · light (B2 source)
- f1-email-verify-handoff · web-390 · 08-hold-ended-before-confirm · light (B3)
- f1-save-confirmation · ios · 04a-recovery-held · light (B3 source)
- f1-save-confirmation · android · 04b-recovery-nothing-held · light (B3 source)
- f1-save-confirmation · web-1440 · 06-account-switched · light (B5 source)
- f1-email-verify-handoff · web-1440 · 05-wrong-code · light (B6)
- f1-email-verify-handoff · web-1440 · 04-confirmed-same-device · light (B6, laptop landing)
- f1-email-verify-handoff · web-390 · 10-send-error · light (B8 source)
- f1-add-place-sheet · android · 05-outside-clark-county · light (B7)
- f9-founding-meter-preview · web-390 · 06-wall-open-slots · light (B9 source)
- Host screenshot: the iOS lock-screen notification style (F20), system parts as grey placeholders.
Turn 3 (artboards 07, 08):
- f1-today-tab · ios · 06-partial-airnow · light (B10 source)
- f4-briefing-optin-card · web-390 · 06-saved-place · light (B10 briefing card, never asked)
- f4-today-pickup-card · ios · 08-no-pickup-day · light (B11 source, founder-verify)
- x-date-sheet · ios · 03-pickup-weekly-saved-place · light (B11 source)
- f4-notification-primer · ios · 01-default-pickup · light (B11 source)
- f4-notification-primer · ios · 04-granted · light (B11 source)
- f4-today-pickup-card · ios · 13-save-error · light (B12 source, founder-verify)
- f4-today-pickup-card · ios · 14-offline · light (B13 source, founder-verify)
- x-provenance-sheet · ios · 02-report-schedule · light (B14 source)
- f4-today-pickup-card · ios · 16-notifications-denied-widget-offer · light (B15 source, founder-verify)
- f4-briefing-optin-card · ios · 17-declined-at-os-widget-offer · light (B15 source)
- f7-widget-howto-sheet · ios · 01-default · light (B15 source)
- f7-today-widget · ios · 05-evening-confirmed · light (B15 reference only)
- f4-today-pickup-card · ios · 18-declined-undo · light (B16 source, founder-verify)
- f4-briefing-optin-card · web-390 · 07-pickup-ask-declined · light (B16 source)
- f4-today-pickup-card · android · 22-reminder-ask-denied-once · light (B17 source, founder-verify)
- f4-today-pickup-card · android · 23-reminder-ask-blocked · light (B17 source, founder-verify)
Turn 4 (artboards 09, 10, 01, 99-notes):
- f4-today-pickup-card · web-390 · 01-unconfirmed · light (W1 source)
- f4-briefing-optin-card · web-390 · 12-declined-at-browser · light (W2 source, founder-verify)
- The handoff checks and the map reuse the frames already drawn in turns 1–3 as thumbnails; no new exports are needed for them.
Frames with no export to place (drawn with a REDRAWN caption): F3, F4, F5, F7, F9, F10, F11, F12, F13, F14, F16, F17, F18b, F19, F20, F21, F22, and every branch frame whose caption below reads REDRAWN (including B9, B11's card, B12, B13, B14, B15's two cards, B16, B17 and W2's declined card). Frames placed with "export + deltas": F2. Frames placed as is: F1, F6, F8 (with its two thumbnails), F15, F18a, B1, B3's email page, B6's two frames and B7's add-place frame.

PERSONA & SITUATION
Jordan Lee, 36, is at tier T1 (saved place, not claimed). He moved from Portland, OR to PLACE B, 1107 NE Birchfield Ct, Camas, WA 98607, on Fri 9 Oct 2026. His only place in Pantopus is PLACE B. The City of Camas lists Thursday as his pickup weekday, and his recycling frequency is Not set. His email is jordan.lee@example.com. He looks the address up on his work laptop (web-1440) at lunch on Sat 10 Oct and reads personal email on his iPhone (web-390 in Safari, then the iOS app).
This storyboard replaces the flows-spec persona (Maya Chen at 1402 NE 3rd Ave) with Jordan at PLACE B. So: "Tuesday" becomes "Thursday"; "Recycling and garbage tomorrow" becomes "Garbage tomorrow", because his recycling is Not set, not known; the street label "3rd Ave" disappears from pushes, because he has one place; the lease date is Jordan's (Wed 31 Mar 2027, as x-date-sheet frame 19 draws it for PLACE B).
Save date. The fixture save date is Sat 10 Oct, so his first week runs until Sat 17 Oct. f1-today-tab and x-place-file were drawn assuming a Sat 17 Oct save (first week until Sat 24 Oct). This storyboard re-dates those exports to Sat 10 Oct; list this under date deltas on Notes and see H10.
Timeline. Every frame prints its moment in its caption.
- Sat 10 Oct, 12:20 PM, work laptop: F1–F6. This is the fixture save day.
- Sat 10 Oct, 6:10–6:25 PM, iPhone: F7–F13.
- Gap: "Four days later · Wed 14 Oct, 6:10 PM" (pickup is tomorrow, Thu 15 Oct): F14–F19 in the iOS app.
- Gap: "TODAY · Mon 19 Oct, 6:10 PM · the 6:00 PM briefing was skipped · no push" (nothing is due Tue at Birchfield Ct).
- Gap: "Two days later · Wed 21 Oct, 6:00 PM": F20–F22. This is his first pickup night with a reminder.
TODAY stays Mon 19 Oct, 6:10 PM Pacific for everything outside those dated frames.

GOAL
See one true fact about the new address, keep it without retyping anything, and have Pantopus tell him the night before his first bin day.
§5 METRIC: Activation, which the query computes as: within 7 days of t1_account_created (Sat 10 Oct, so by Sat 17 Oct), a SavedPlace, plus evening_briefing_enabled (or daily_briefing_enabled, or a widget snapshot written and reported by the client as an event — §5's wording; see H25), plus one household fact (§5: "one of: a pickup rule, an F5 date, or a second active occupant"). Jordan activates on Wed 14 Oct (day 4) at frame F17. Secondary: Week-four return attributed to trigger=push. F21 writes session_open {trigger: 'push', kind: 'pickup'} in week two. The first week-four push is Wed 4 Nov, 6:00 PM (day 25, for Thu 5 Nov); name it in the F21 callout.
Honesty. Two separate rules, with their real sources:
- No push fires on the unconfirmed Thursday. Source: f4-today-pickup-card (a saved place gets no night-before reminder until the person confirms the day). §5's honesty counter only targets "zero pushes without the caveat", and the research brief (§3) still describes an unconfirmed push with its caveat; see H26.
- PROPOSAL, not in §5: the activation query should not count a city-seeded pickup rule as the household fact, while the place-file count (x-place-file: "an unconfirmed pickup seed counts") does include it. If the query counts the seed, Jordan would activate in B15 as soon as he places a widget, without confirming a day. See H24.

THE HAPPY PATH
Each frame lists: caption form · platform · surface id and state · what Jordan does · what the screen shows (key strings, verbatim) · what is CARRIED to the next frame · MOMENT OF TRUTH (a callout in the margin lane).

Lane 02 — Sat 10 Oct, 12:20 PM, work laptop (web-1440)
F1 · web-1440 · f8-positioning-copy · 01-start-hero · export: f8-positioning-copy · web-1440 · 01-start-hero · light.
- Does: arrives at /start from a search result. Types "1107 NE Birchfield Ct" in the focused field, picks the Camas suggestion and clicks "See your place".
- Shows: H1 "See what's true about your address."; the web lede; the contrast line "Nextdoor is what your neighbors say. Pantopus is what's on record about your address."; the address field; "See your place"; the privacy line.
- Carries: the typed address, held only in the page (GET /api/public/place persists nothing).
- MOMENT OF TRUTH: nothing before the preview asks for an account, a location or notifications. The address field is the first interactive element.
Arrow F1→F2: "click 'See your place'".
F2 · web-1440 · f8-seasonal-aha · 17-voter-7-days · export + deltas: f8-seasonal-aha · web-1440 · 17-voter-7-days · light.
- Deltas for Sat 10 Oct: (1) chip "in 16 days · Mon 26 Oct"; (2) source "Washington Secretary of State · statewide · as of Sat 10 Oct". Everything else as exported.
- Shows: overline "WHAT STANDS OUT"; headline "Online or mail voter registration for Nov 3 must arrive by Oct 26 in Washington."; detail "In person: until 8:00 PM Tue 3 Nov at your county elections office." and "Moved recently? Registration is per address."; HOLLOW mark with "On record, not confirmed"; follow-up row "Keep this address to set a reminder before Mon 26 Oct"; outbound row "Check or update at VoteWA ↗".
- Does: reads the source and scrolls on.
- Carries: nothing is stored. The Mon 26 Oct deadline is the same fact the 14-day strip will show later (F14).
- MOMENT OF TRUTH: the fact is specific to this month and this state, names its source, and is fully readable signed out.
Arrow F2→F3: "scroll".
F3 · web-1440 · f8-scale-strips · 13-risk-detail-desktop (signed-out /start preview) · REDRAWN from f8-scale-strips · web-1440 · 13-risk-detail-desktop · light (two-column instrument only, placed in the signed-out preview; fixture time changed: AirNow "observed 7:00 AM" → "observed 12:00 PM today").
- Shows: heading "What's on record here"; the summary sentence; legend "● Official"; four rows in the fixed order Flood zone · Wildfire hazard · Air today · Radon zone: "Zone X — minimal flood hazard" with "FEMA · area zone · effective Sep 2021"; "Moderate · 3 of 5" with "USFS · hazard potential, modelled quarter-mile · 2023"; "AQI 42 · Good" with "AirNow · nearest monitors · observed 12:00 PM today"; "Zone 1 — highest potential (county)" with "EPA · county-wide estimate — only a test tells you about this home". No ScopeChip and no threshold rule, because he is signed out.
- Does: scrolls through all four rows.
- Carries: nothing.
- MOMENT OF TRUTH: no grade or verdict anywhere. Radon reads as a county-wide estimate, not a claim about his home.
Arrow F3→F4: "scroll to the wall".
F4 · web-1440 · ext:start-wallbar · host WallBar, no open slots (the 07-wall-no-open-slots case) · REDRAWN from host: /start sticky WallBar (reference f9-founding-meter-preview · web-390 · 07-wall-no-open-slots).
- Shows: "Keep this address handy." · the benefit line "Today and a night-before pickup reminder run on it." · "Continue" · the existing share and app-download footer. No Founding slots are open on his block, so this is the ordinary wall.
- Does: clicks "Continue".
- Carries: the address, into the register form.
- MOMENT OF TRUTH: the account ask comes only when he wants to keep something, and it names the benefit in one line.
Arrow F4→F5: "click 'Continue'".
F5 · web-1440 · ext:register · host register form, carrying the preview · REDRAWN from host: /start register form.
- Shows: the host form unchanged, with the AddressChip default state "1107 NE Birchfield Ct" / "Camas, WA 98607" above the fields and "Only you will see this." under it. The email value is "jordan.lee@example.com"; draw any password field masked, with no characters shown.
- Does: submits.
- Carries: the server stores 1107 NE Birchfield Ct against the new, unconfirmed account at register time. This is saved-at-registration mode, the default wherever the auth provider allows it.
- MOMENT OF TRUTH (margin callout, with a small server glyph): "SavedPlace written now. Nothing depends on this laptop's localStorage."
Arrow F5→F6: "submit".
F6 · web-1440 · f1-email-verify-handoff · 01-sent-saved · export: f1-email-verify-handoff · web-1440 · 01-sent-saved · light.
- Shows: "Check your email" · "Saved privately. Confirm your email to keep your account." · the AddressChip "1107 NE Birchfield Ct / Camas, WA 98607" · "Only you will see this." · "We sent a link and a 6-digit code to jordan.lee@example.com." · "Or enter the code from the email" · one paste-enabled input · "Confirm email" · "Resend the link" with "Can't find it? Check your spam or junk folder."
- Does: closes the laptop without confirming.
- Carries: the saved place on the server; the unconfirmed account; the link and the code, which expire at the same time.
- MOMENT OF TRUTH: he could finish here by pasting the code, and the copy says the address is already saved, so the next step does not read as a wall before anything is kept.
Time gap after F6: "Six hours later · Sat 10 Oct, 6:10 PM · on his iPhone".

Lane 03 — Sat 10 Oct, 6:10–6:25 PM, iPhone
F7 · iOS · ext:email-client · iPhone Mail, message open · REDRAWN (no designed source; no prompt designs this email).
- Shows: sender "Pantopus"; subject "Confirm your email"; body "Your code is 482913. Or use the button. It works on any device."; button "Confirm email". No address appears in the email.
- Does: ignores the code and taps "Confirm email".
- Carries: the confirm token, opened in Safari with no Pantopus session.
- MOMENT OF TRUTH: the link works on any device and never sends him to a sign-in page first.
Arrow F7→F8: "email link on another device".
F8 · web-390 · f1-email-verify-handoff · 03-confirmed-other-device · export: f1-email-verify-handoff · web-390 · 03-confirmed-other-device · light. Beside it, two 25% thumbnails: f1-email-verify-handoff · web-390 · 04-confirmed-same-device (joined to F8 by a bracket labelled "pixel-identical") and f1-save-confirmation · web-390 · 03-saved (labelled "the content inside both").
- Shows: status line "Email confirmed."; title "Saved privately" with its still tick; address line "1107 NE Birchfield Ct, Camas, WA 98607"; body "Today now uses this address, and so will any reminders you turn on."; filled "See Today"; outlined "Claim this address" with "A separate step, only if you live here."; text "See your places"; caption "Only you will see this." Announced: "Saved privately. Today now uses 1107 NE Birchfield Ct."
- Does: taps "See Today".
- Carries: the saved place, now Today's location.
- MOMENT OF TRUTH: one sentence names what changed, the scope says only he can see it, and there is no celebration and no permission ask. The phone landing from another device is pixel-identical to the same-device landing at the same width (web-390 04); nothing here looks like recovery. The laptop version of the same-device landing (web-1440 04) is B6.
Arrow F8→F9: "tap 'See Today'".
F9 · web-390 · f1-today-tab · 03-warming · REDRAWN from f1-today-tab · ios · 03-warming · light (redrawn at web-390, with the bottom tab bar).
- Shows: location row "1107 NE Birchfield Ct · Saved place · Only you"; FreshnessLine "Setting up Today for Birchfield Ct"; FirstWeekRow "Next: set your pickup day →"; weather landed; WarmingSkeleton section shapes at final height in the other slots; no quiet heading.
- Carries: the providers still returning.
- MOMENT OF TRUTH: "Nothing needs your attention today" never appears before every provider has returned. No welcome carousel, no coach marks, no permission prompt.
Arrow F9→F10: "providers return (under 10 s)".
F10 · web-390 · f1-today-tab · 02-saved-place-quiet · REDRAWN from f1-today-tab · ios · 02-saved-place-quiet · light (redrawn at web-390, dated Sat 10 Oct).
- Shows: location row as F9, FreshnessLine "Updated just now"; FirstWeekRow "Next: set your pickup day →" with "Hide this"; no PickupCard, because tomorrow is Sunday; QuietDayReceipt "Nothing needs your attention today" with "Checked 6:10 PM" and each CheckItem carrying its own source time, re-dated for Sat 10 Oct: "weather 5:45 PM · air 6:00 PM · alerts 6:00 PM · your calendar 6:00 PM" (the export's air time 7:00 AM moves to 6:00 PM so it is later than F3's 12:00 PM reading); the 14-day card (window Sat 10 → Fri 23 Oct) "Next 14 days: 2 items" with hollow marks on Thu 15 Oct and Thu 22 Oct, the rows "Pickup day" · "Which bins go out isn't set yet" · "in 5 days · Thu 15 Oct" and "in 12 days · Thu 22 Oct" · "City of Camas · weekday only · 2026 calendar", and the "Set your pickup day" button on the Thu 15 row; no Mon 26 Oct voter bar (outside this window); no renters-insurance row (Jordan never adds it in this flow); "+ Add a date" with "Only you will see this."; weather; air "AQI 42 · Good"; the gutters tile as the export draws it; the briefing card in its never-asked state, as f4-briefing-optin-card 06-saved-place draws it, with the row 1 caption "Pickup joins once you confirm your pickup day. Until then, it covers your dates due tomorrow." The property-tax signal is absent (Mon 2 Nov is 23 days out); note this on Notes.
- Does: reads it and leaves it.
- Carries: FirstWeekRow state (step 2 pending) and the briefing card's never-asked state, both stored on the server.
- MOMENT OF TRUTH: the one next step sits above the fold with no fraction, and the quiet heading comes with its receipt.
Arrow F10→F11: "tap the app-download link (see H22: the only designed link is in the signed-out WallBar footer)".
F11 · iOS · ext:app-store, then first launch · REDRAWN (no designed source); two half-frames side by side.
- Shows: left, the App Store listing with "Get"/"Open" drawn as neutral grey system chrome; right, the app's first launch opening straight to sign-in.
- Carries: nothing yet.
- MOMENT OF TRUTH: nothing fires on first launch. The AppDelegate notification request is gone. A struck-through ghost of the iOS system dialog sits in the margin, labelled "Removed from launch".
Arrow F11→F12: "first launch".
F12 · iOS · ext:native-sign-in · host sign-in · REDRAWN from host: iOS native sign-in screen.
- Shows: the host screen unchanged, with the email value "jordan.lee@example.com".
- Does: signs in with the same email.
- Carries: the account. The saved place, FirstWeekRow state and briefing-card state all come from the server.
- MOMENT OF TRUTH: no carousel, no location prompt and no notification prompt.
Arrow F12→F13: "signed in".
F13 · iOS · f1-today-tab · 02-saved-place-quiet · REDRAWN from f1-today-tab · ios · 02-saved-place-quiet · light (rows removed, so not an export + deltas).
- Changes for Sat 10 Oct, 6:25 PM: (1) the CheckItem times as F10; (2) the 14-day card as F10: "Next 14 days: 2 items", rows "in 5 days · Thu 15 Oct" and "in 12 days · Thu 22 Oct", the "Set your pickup day" button on the Thu 15 row; (3) drop the Mon 26 Oct bar and the renters-insurance row (outside the window, never added); (4) drop the property-tax signal (23 days out); (5) the export's Sat 17 Oct save is read as Sat 10 Oct (first week until Sat 17 Oct). The FirstWeekRow, the gutters tile and the never-asked briefing card stay as exported.
- Shows: the same composition and order as F10 on native: location row, FirstWeekRow "Next: set your pickup day →", receipt, the same 14-day card, the briefing card never asked.
- Carries: the same place and the same next step.
- MOMENT OF TRUTH: native Today uses the same composition as web and is not home-gated. The next step is the same one he saw in Safari.
Time gap after F13: "Four days later · Wed 14 Oct, 6:10 PM · iOS app, organic open · pickup is tomorrow, Thu 15 Oct".

Lane 04 — Wed 14 Oct, 6:10 PM, iOS app
F14 · iOS · f4-today-pickup-card · 06-saved-place-unconfirmed (inside Today) · REDRAWN from f4-today-pickup-card · ios · 06-saved-place-unconfirmed · light (primary source); second source: the strip from f5-today-calendar-strip · ios · 03-saved-place-unconfirmed · light; Today chrome around both.
- The card is drawn for Wed 21 Oct; nothing inside the card changes, because "Garbage tomorrow" is true on Wed 14 Oct too. Print "card drawn for Wed 21 Oct, placed at Wed 14 Oct" in the caption.
- Strip changes (window Wed 14 → Tue 27 Oct): (1) Thu 15 row "Tomorrow", carrying the "Set your pickup day" button (moved from the export's Thu 22 row); (2) Thu 22 row "in 8 days · Thu 22 Oct"; (3) the export's Thu 29 row is dropped (outside the window); (4) Mon 26 Oct statewide voter bar added with "in 12 days · must arrive by Mon 26 Oct"; (5) drop Jordan's "Renters insurance renews" row (he never adds it in this flow, and Fri 30 Oct is outside the window); (6) summary "Next 14 days: 3 items".
- Shows: location row; FirstWeekRow "Next: set your pickup day →"; PickupCard with KindGlyph tile, headline "Garbage tomorrow", instruction "Bins out tonight — curbside by 6:30 AM (City of Camas)", source row "○ City schedule, not yet confirmed · City of Camas · 2026 collection calendar, read Thu 1 Oct 2026", second caption "Recycling: Not set", peer outlined buttons "Yes, Thursday is right" and "Change pickup day", footer "Only you will see this. No night-before reminder until you confirm your day."; below it the 14-day card with the changes above; the briefing card never asked.
- Does: he saw the bins go out on the street; taps "Yes, Thursday is right".
- Carries: a saved_place pickup rule, weekday Thursday, source "you", frequency Not set.
- MOMENT OF TRUTH: the hollow mark and its caveat sit directly under the headline, and the two buttons have equal weight. No push has fired on the guessed Thursday.
Arrow F14→F15: "tap 'Yes, Thursday is right'".
F15 · iOS · f4-today-pickup-card · 07-saved-place-confirmed-just-now · export: f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now · light.
- Shows: the ring becomes the tick: "✓ You added this · Thursday"; "Recycling: Not set"; status line "Saved to your calendar. Only you."; footer "Only you will see this."; the inline ask "Remind you the night before? 6:00 PM", the PushCopy tray preview "Garbage tomorrow" / "Bins out tonight" captioned "This is the whole thing.", and the equal outlined buttons "Turn on reminders", "Not now", "No thanks". The briefing card's night-before row is hidden while the ask is open; its morning row still asks. One light haptic tick on save.
- Does: taps "Turn on reminders".
- Carries: the confirmed weekday, and the request for the evening briefing.
- MOMENT OF TRUTH: the confirmation holds at T1. The caveat is rewritten in place and survives a reload; a toast that fades while "City schedule, not yet confirmed" stays would be a failure. This depends on the SCOPE_RANK saved_place fix: the saved place's own rule must outrank the city rule. The primer sheet does NOT open here (v2 decision; the flows-spec primer step is superseded by this inline ask).
Arrow F15→F16: "tap 'Turn on reminders'".
F16 · iOS · ext:os-permission-dialog · one-time notification dialog · REDRAWN from host: iOS system dialog (a neutral grey placeholder over dimmed Today, labelled "iOS system dialog").
- Does: taps Allow.
- Carries: the OS grant; the device token registered for this iPhone; evening_briefing_enabled = true. The other post-grant defaults turn on here as well: Air & weather alerts at 101 and Account & security. Print them in the margin (see H12).
- MOMENT OF TRUTH: the one-time grant is spent here, in context, and not at cold launch.
Arrow F16→F17: "Allow".
F17 · iOS · Today after the grant · REDRAWN from f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now and f4-briefing-optin-card · web-390 · 03-one-on-one-off (redrawn at iOS).
- Shows: the PickupCard confirmed, with the ask gone and the one widget hint "Put today on your home screen" · "Show me how" (at most once per 24 h); FirstWeekRow now "Next: add one date that matters →" (see H10); the 14-day card ("Next 14 days: 3 items") with tick marks in the Thu 15 and Thu 22 cells; the property-tax signal is absent (Mon 2 Nov is 19 days out, outside the signal window this board uses; list on Notes); the briefing card with "The night before pickup · 6:00 PM · Change" and "A morning heads-up?" still asking with "Yes", "Not now", "No thanks". Focus is on the PickupCard.
- Carries: activation. SavedPlace + evening_briefing_enabled + a pickup rule written by Jordan.
- MOMENT OF TRUTH (margin callout, bold): "Activated · day 4 · Wed 14 Oct". The on state matches what the OS allows, and the 6:00 PM time he never chose is shown so he can change it. The widget and the strip both show the tick.
Arrow F17→F18: "tap 'Next: add one date that matters →' (scrolls to and highlights '+ Add a date'), then tap it".
F18 · iOS · x-date-sheet, two half-frames:
- 18a · 02-create-empty · export: x-date-sheet · ios · 02-create-empty · light.
- 18b · 19-saved-lease-saved-place · REDRAWN from x-date-sheet · ios · 19-saved-lease-saved-place · light (cropped, so not an export + deltas). Changes: (1) use only its sheet half and drop its place-file half; (2) the linked Notice deadline caption reads "in 138 days · Mon 1 Mar 2027" (counted from Wed 14 Oct); (3) the reminder list shows all three ticks: "Sat 30 Jan 2027 · 30 days before", "Sun 28 Feb 2027 · Day before", "Mon 1 Mar 2027 · Day of".
- 18a shows: the sheet title "Add a date", "What's this date for?", the 2 × 5 kind grid, over the Today strip.
- Does: picks Lease ends, sets Wed 31 Mar 2027 in three taps, picks "30 days" for "How much notice does your lease require?", keeps Remind me at 14 days.
- 18b shows: the Lease ends KindGlyph, then "Lease ends · Change"; the date Wed 31 Mar 2027; the linked Notice deadline Mon 1 Mar 2027; Remind me 14 days with the three ticks above; no visibility chips; footer "Only you will see this."; status message "Saved to your calendar. Only you." (announced).
- Carries: Lease ends and Notice deadline, scope saved_place, with the you-added mark.
- MOMENT OF TRUTH: a saved-place user can add a date with no household words, and every reminder that will fire is visible with its date.
Arrow F18→F19: "Save, sheet closes".
F19 · iOS · f5-today-calendar-strip · 14-saved-outside-window · REDRAWN from f5-today-calendar-strip · ios · 14-saved-outside-window · light (marks flipped and a row removed, so not an export + deltas).
- Changes for Wed 14 Oct: (1) window Wed 14 → Tue 27 Oct, rows as F14 (Thu 15 "Tomorrow", Thu 22 "in 8 days · Thu 22 Oct", Mon 26 bar "in 12 days · must arrive by Mon 26 Oct"); (2) tick marks in the Thu 15 and Thu 22 cells instead of the export's hollow Thursday marks (confirmed at F15); (3) drop the renters-insurance row; (4) summary "Next 14 days: 3 items".
- Shows: under the summary, "Saved · Lease ends Wed 31 Mar 2027 is in your place file · See it"; no new row; FirstWeekRow gone, because the reachable set (save, pickup day, reminder, one date) is done. Focus returns to "+ Add a date".
- Carries: the lease, visible in the place file ("See it" opens its Dates row).
- MOMENT OF TRUTH: a date saved outside the window never vanishes silently. The Today first-week row and the activation query both count Jordan as done here (see H10 for where the place file may differ).
Time gap after F19: "TODAY · Mon 19 Oct, 6:10 PM · the 6:00 PM briefing was skipped · no push", then "Two days later · Wed 21 Oct, 6:00 PM".

Lane 05 — Wed 21 Oct, 6:00 PM, first pickup night with a reminder
F20 · iOS · ext:os-push-tray · lock screen · REDRAWN from host: iOS lock screen, with the collapsed notification in the f4-today-pickup-card · ios · 21-tray inset style (system parts as grey placeholders).
- Shows: "Pantopus" · "now" · title "Garbage tomorrow" · body "Bins out tonight". Annotation outside the inset: "iOS Active · never Time Sensitive". A second small inset shows the hidden-preview form "Pickup reminder". No house number, no street label (one place), no amount, and no action button, because this is a confirmed pickup.
- Does: taps it.
- Carries: the evening delivery (kind=evening). Caption the carried link with both designed forms, side by side: "pantopus://today?section=pickup + delivery id (f4-today-pickup-card)" and "pantopus://hub-today?deliveryId=…&kind=evening (f1-today-tab; f7-widget-tap-landing says the formats must not collide)" — see H23.
- MOMENT OF TRUTH: the push fires on the day he confirmed, once, and the lock screen shows no house number.
Arrow F20→F21: "push at 6:00 PM, tap".
F21 · iOS · f1-today-tab · 05-from-push (PLACE B) · REDRAWN from f1-today-tab · ios · 05-from-push · light (recast from HOME A to Jordan at PLACE B).
- Shows: location row "1107 NE Birchfield Ct · Saved place · Only you" · "Updated just now"; the pinned slot takes no space, following f1-today-tab's rule that no pinned line repeats a card already in the first viewport (the only delivered item, pickup, is there); the PickupCard confirmed ("Garbage tomorrow", "Bins out tonight — curbside by 6:30 AM (City of Camas)", "✓ You added this · Thursday", "Recycling: Not set", text button "Change pickup day", footer "Only you will see this.") highlighted with the DateRow highlighted wash and focused. Beside F21, a 25% thumbnail of f4-today-pickup-card · ios · 20-arrived-from-push, labelled "f4: card pinned under the location row · see H23".
- Carries: session_open {trigger: 'push', kind: 'pickup'}, written once.
- MOMENT OF TRUTH: the push lands on the exact card, and no pinned line repeats it. Margin callout: "Counts toward return. The week-four push is Wed 4 Nov, 6:00 PM."
F22 · iOS · f1-today-tab · 15-foreground-push (PLACE B) · REDRAWN from f1-today-tab · ios · 15-foreground-push · light (recast from HOME A to PLACE B), drawn under F21 as the alternative arrival: "Today already open at 6:00 PM".
- Shows: no banner; the PickupCard highlighted; the notification bell badge +1; nothing else changes.
- MOMENT OF TRUTH: a push that arrives while Today is open changes nothing but the highlight.

LAYOUT
- Each lane artboard is a horizontal lane, read left to right. Draw each frame at 50% scale: web-1440 frames 720×450, web-390 frames 195×422, iOS frames 196.5×426. Draw the full-length Today frames (F10, F13, F17) as 50% scrolls with a dashed fold line.
- Keep each artboard to about 10 full frames, and each turn to about 20, counting thumbnails, half-frames and ghosts as half (see BATCH PLAN).
- Above each frame, print its label in label 13/18 text.strong: "F<n> · <platform> · <surface-id> · <v2 state name>" (for external steps, "ext:<id> · <host screen>"). Under it, in caption text.secondary, print the time ("Sat 10 Oct · 12:20 PM") and exactly one caption form: "export: <name>", "export + deltas: <name>" followed by the numbered deltas, or "REDRAWN from <name>" followed by its numbered changes when it has any. Founder-verify frames add the small verify note beside the caption.
- Join frames with 1.5px text.secondary arrows. Label each arrow with its trigger in label text: "click 'See your place'", "scroll", "submit", "email link on another device", "tap 'See Today'", "providers return", "first launch", "tap 'Yes, Thursday is right'", "Allow", "push at 6:00 PM, tap". A trigger that crosses devices uses a dashed arrow with a device glyph.
- Draw time jumps as a labelled gap 96px wide, with two vertical hairlines and the gap label set vertically ("Four days later · Wed 14 Oct, 6:10 PM").
- Put a margin lane above the frames for the moment-of-truth callouts. Each callout is a card on surface.raised with a 1px text.secondary edge, the frame number, a one-line claim and a leader to the exact element. Carried-data chips ("carries: SavedPlace · Birchfield Ct") sit on the arrows in caption size on surface.sunken.
- Put a lower lane for failure branches under the frames they leave. A branch arrow leaves its source frame downward, runs through its branch frames and rejoins the happy path with an upward arrow at the frame where it rejoins, labelled "rejoins F<n>". A branch that ends without rejoining ends in a flat bar labelled "ends here" with the reason.
- The lane backgrounds are surface.app. Never use colour alone for lanes: each lane has a printed title at its left edge.
- Artboard 01 is the map, drawn in the last turn: the happy-path frames F1–F22 as 12% thumbnails on one time axis (Sat 10 Oct → Wed 21 Oct), with the lanes named, the activation point marked with a printed label "Activated · Wed 14 Oct", and the device for each segment named in text. Branches appear only as labelled stubs ("B1–B9 · saving and confirming · artboards 06a–06b", and so on) leaving the frame they start from; do not thumbnail every branch frame.

FAILURE BRANCHES
Lane 06a — saving and confirming: account and hold (B1–B5, under thumbnails of F5–F8)
- B1 · held mode (the auth provider cannot save at registration). F5 → export: f1-email-verify-handoff · web-1440 · 02-sent-held · light: "We're holding 1107 NE Birchfield Ct for you. Confirm your email to save it.", the held AddressChip, "Only you will see this.", "We're holding it for 7 days, until Sat 17 Oct." Confirming rejoins F8 (the same 03-saved page).
- B2 · link expired. F7 → REDRAWN from f1-email-verify-handoff · web-1440 · 09-link-expired · light (redrawn at web-390 for the phone): "This link has expired.", "Send a new link", the chip with "1107 NE Birchfield Ct is still saved to your account." (saved mode). A new email rejoins F7.
- B3 · hold ended before confirming (held mode only, after Sat 17 Oct). → export: f1-email-verify-handoff · web-390 · 08-hold-ended-before-confirm · light: "We stopped holding that address. Confirm your email, then save it again." The chip is in expired fill with no action. Confirm → REDRAWN from f1-save-confirmation · ios · 04a-recovery-held · light (redrawn at web-390) if the server or this device still has the address: "Save the address you looked up?" and the selectable row "1107 NE Birchfield Ct, Camas — Save it", with "Different address". Otherwise → REDRAWN from f1-save-confirmation · android · 04b-recovery-nothing-held · light (redrawn at web-390): "We stopped holding that address. Type it again to save it." with a blank focused "Street address" field and "Save it". Either one rejoins F8. The blank field appears only when nothing is held anywhere.
- B4 · a mail app's in-app browser with no cookies (for example, if Jordan used a third-party mail app). F7 → F8 unchanged, never /login. "See Today" there goes through sign-in and keeps the address, then rejoins F9. Draw it as a thin variant frame, REDRAWN from f1-email-verify-handoff · web-390 · 03-confirmed-other-device · light, with the in-app browser chrome in grey.
- B5 · a different account is signed in on the phone. F7 → REDRAWN from f1-save-confirmation · web-1440 · 06-account-switched · light (redrawn at web-390), saved-at-registration version: "1107 NE Birchfield Ct is saved to the account that registered. We didn't save anything to this account." with the primary "Switch account". Beside it, the held-mode version: "This preview was started on a different account, so we didn't save it." with "Preview it on this account" and "Switch account". Switching rejoins F8.
Lane 06b — saving and confirming: device, address and wall (B6–B9, under thumbnails of F1, F4 and F6)
- B6 · he finishes on the laptop instead. F6 → export: f1-email-verify-handoff · web-1440 · 05-wrong-code · light: "That code doesn't match. Check the newest email from Pantopus, or resend the link." → pastes again → export: f1-email-verify-handoff · web-1440 · 04-confirmed-same-device · light (the same 03-saved page at 1440) → rejoins F9 on the laptop.
- B7 · address outside Clark County. At F1 the specimen address is "1402 NE 33rd Ave, Portland, OR 97232" (the Portland address f1-add-place-sheet uses). The preview works. The saved page (REDRAWN from f1-email-verify-handoff · web-390 · 03-confirmed-other-device · light) adds under the address: "Flood, wildfire, air and radon readings work here. Pickup days and local deadlines are on file only in Clark County, WA for now." Today has no PickupCard and no pickup rows, and FirstWeekRow skips the pickup step. Show export: f1-add-place-sheet · android · 05-outside-clark-county · light beside it to prove the signed-in path also saves and never refuses. Route to activation, drawn as labelled arrows: FirstWeekRow "Next: get a reminder the night before →" → scrolls to the briefing card and highlights its night-before row (dates due tomorrow) → "Yes" → system dialog → Allow → FirstWeekRow "Next: add one date that matters →" → rejoins F18. Activation lands at the date save (F18), not at F17, because there is no pickup rule; print "Activated at the date save" on the rejoin arrow.
- B8 · the email didn't send, or he is offline. F6 → REDRAWN from f1-email-verify-handoff · web-390 · 10-send-error · light (saved-mode copy: "We couldn't send the email just now. Your address is still saved. Try again.") → "Try again" rejoins F6. Focus stays on "Try again"; the error is announced once.
- B9 · Founding slots are open on his block. F4 → REDRAWN from f9-founding-meter-preview · web-390 · 06-wall-open-slots · light (at web-1440, no compare header; the export is Dana's compare arrival at 390, while Jordan arrived from a search result on his laptop): "3 Founding Neighbor slots are still open on this block." replaces "Keep this address handy.". The benefit line and "Continue" stay. Rejoins F5. The CTA never says "Claim".
Lane 07 — Today and the pickup card (B10–B14, under thumbnails of F9–F17)
- B10 · a cold geohash returns partial results. F9 → REDRAWN from f1-today-tab · ios · 06-partial-airnow · light (redrawn at web-390): "We couldn't reach AirNow just now" · "Retry"; a failed CheckItem; no quiet heading. Change from the export: the briefing card is in its never-asked state (as f4-briefing-optin-card · web-390 · 06-saved-place draws it), not the export's declined line, because on Sat 10 Oct Jordan has never been asked about notifications. Retry rejoins F10.
- B11 · no city pickup rule for the address. F14 → REDRAWN from f4-today-pickup-card · ios · 08-no-pickup-day · light (founder-verify (PLACE B)): one FactRow "Set your pickup day" · "Add", footer "Only you will see this." → REDRAWN from x-date-sheet · ios · 03-pickup-weekly-saved-place · light, with these changes: no hollow city seed and no legend for it; no "Use the city schedule again"; no city holiday (Thanksgiving) row; no weekday prefilled — Jordan picks Thursday himself and picks a frequency; footer "Only you will see this." → Save → REDRAWN from f4-notification-primer · ios · 01-default-pickup · light: title "Pickup reminders on this phone", tray "Garbage tomorrow" / "Bins out tonight" (or "Recycling + garbage tomorrow" if he picked a recycling frequency; never a street label), "This is the whole thing.", "Continue", "Your phone will ask next." → system dialog → REDRAWN from f4-notification-primer · ios · 04-granted · light (recast to PLACE B) → rejoins F17. This is the only pickup entry to the primer. Pickup is never pushed without a day he set.
- B12 · the "Yes, Thursday is right" save fails. F14 → REDRAWN from f4-today-pickup-card · ios · 13-save-error · light (founder-verify (PLACE B); recast strings: "Garbage tomorrow", "○ City schedule, not yet confirmed · City of Camas", "Yes, Thursday is right", "Only you will see this.", no household footer): the hollow mark stays, with "We couldn't save your pickup day" and "Retry". The inline ask does NOT open for a failed confirmation. Focus stays on "Retry", and the error line is announced once (assertive). Retry rejoins F15.
- B13 · offline at the confirm. F14 → REDRAWN from f4-today-pickup-card · ios · 14-offline · light (founder-verify (PLACE B); recast strings as B12): "You're offline · as of 6:02 PM", buttons disabled with "Confirming needs a connection." Focus stays where it was; the offline line is announced once (polite), and each disabled button reads its reason. Ends here until he is back online, then rejoins F14.
- B14 · the city's Thursday is wrong for him, or he wants recycling set. F14 "Change pickup day" → REDRAWN from x-provenance-sheet · ios · 02-report-schedule · light (recast to PB: "Garbage · Thursdays", "City of Camas schedule", "Yes, Thursday is right"; the export is P1 at HOME A). Changes: (1) PB values: hollow mark, "Garbage · Thursdays", caption "Recycling frequency: Not set", source "City of Camas schedule", Updated "Thu 1 Oct 2026" (re-dated from the prompt's "Thu 15 Oct 2026", which is after this Wed 14 Oct frame, and matching the card's "read Thu 1 Oct 2026"), ScopeChip "Saved place · Only you"; (2) "Set my pickup day" first, with the optional checkbox "Also tell us the city's schedule looks wrong" shown unticked and no reason selected. → the sheet swaps in place to the DateSheet pickup mode, with Thursday pre-filled and a Back control → Save → the card in its corrected-just-now state. The correction is counted as "not my schedule". Which ask follows is unresolved (see H8): draw the inline ask, and label the frame "ask per f4-today-pickup-card; the primer prompt says the primer opens here". Rejoins F17.
Lane 08 — permission (B15–B18, under thumbnails of F11 and F15–F18)
- B15 · iOS Don't Allow at F16. → REDRAWN from f4-today-pickup-card · ios · 16-notifications-denied-widget-offer · light (founder-verify (PLACE B); recast strings: "Garbage tomorrow", "✓ You added this · Thursday", "Only you will see this.", no household footer): "Pickup still shows here on Today", then "Put today on your home screen" · "Show me how". No amber anywhere on Today. The briefing card: REDRAWN from f4-briefing-optin-card · ios · 17-declined-at-os-widget-offer · light (recast to Jordan: no "For 2418 NE Larkspur Loop" caption; the prompt says only Maya's frames show it): "Pickup still shows here on Today · Or put it on your home screen", "Show me how", shown once; draw only one widget offer in the first viewport (see H9). After Don't Allow, focus returns to the PickupCard's "Pickup still shows here on Today" line, which is announced once (polite). "Show me how" → REDRAWN from f7-widget-howto-sheet · ios · 01-default · light (recast to Jordan; his Today has loaded, so the preview can show his own address) → widget placed → the widget's pickup hero with the tick (reference f7-today-widget · ios · 05-evening-confirmed, recast to Birchfield). This rejoins the activation point at F17 by the widget path only if activation counts a placed widget: label the rejoin arrow "rejoins F17 · pending H25", then continue to F18.
- B16 · "Not now" on the inline ask. F15 → REDRAWN from f4-today-pickup-card · ios · 18-declined-undo · light (founder-verify (PLACE B); recast strings as B15): "No reminder for now · Undo". The night-before row counts as declined (REDRAWN from f4-briefing-optin-card · web-390 · 07-pickup-ask-declined · light, at iOS: the night-before row absent, the morning row asking). He is not activated yet. FirstWeekRow reads "Next: get a reminder the night before →" and lands on a card whose night-before row is gone (see H11). The morning row's "Yes" → system dialog → morning briefing on → activated through daily_briefing_enabled. Rejoins F18.
- B17 · Android. The same moment on Android 13+: "Turn on reminders" opens the system dialog directly. Denied once → REDRAWN from f4-today-pickup-card · android · 22-reminder-ask-denied-once · light (founder-verify (PLACE B); recast strings: "Garbage tomorrow" / "Bins out tonight" tray preview, "✓ You added this · Thursday", City of Camas, "Only you will see this."): the ask shows again, and "Turn on reminders" re-asks once. Denied twice (blocked) → REDRAWN from f4-today-pickup-card · android · 23-reminder-ask-blocked · light (founder-verify (PLACE B); same recast strings): "Notifications are off for Pantopus" with only "Open settings" and "Not now". "Not now" never fires the system dialog. Android 12 and below: no runtime dialog; the row switches on directly. The flows-spec had the primer's "Continue" doing this; in v2 the inline ask does it.
- B18 · the current build still asks at launch (must be removed). F11 → REDRAWN from host: the iOS system dialog at cold launch. If he taps Don't Allow there, "Turn on reminders" at F15 can only offer settings, and the in-context grant never happens. Draw this frame with a printed label "Current build · must not ship" and end the branch with "ends here".
Lane 09 — the no-notifications path (Jordan never installs the app)
- W1 · web-390, Wed 14 Oct, 6:10 PM: F14's card on web, REDRAWN from f4-today-pickup-card · web-390 · 01-unconfirmed · light (recast from HOME A to PLACE B). He confirms.
- W2 · if the web briefing push channel has shipped: the same inline ask; "Turn on reminders" opens the browser's permission dialog; Allow → activated (rejoins F17 on web). If he declines at the browser: REDRAWN from f4-briefing-optin-card · web-390 · 12-declined-at-browser · light (founder-verify (PLACE B): no "For 2418 NE Larkspur Loop" caption), "Pickup still shows here on Today", with no widget offer and no settings link.
- W3 · if the web briefing push channel has NOT shipped: the web card ends at the confirmed state with no ask, and the briefing card's "Yes" has nowhere to go. Web has no widget. Jordan cannot reach activation on the web alone. Draw this frame (REDRAWN from f4-today-pickup-card · web-390 · 01-unconfirmed · light, confirmed) with the printed label "Activation unreachable on web until the web briefing channel ships" and end it with "ends here".
- W4 · Wed 21 Oct, 6:10 PM, organic or email open on web (REDRAWN from f4-today-pickup-card · web-390 · 01-unconfirmed · light, confirmed): Today still shows the same PickupCard a push would carry. session_open {trigger: 'organic'} or {trigger: 'email'}. Email is a return trigger, not an activation condition (see H13).

HANDOFF CHECKS
Draw each check as a numbered row on artboard 10. Each row has the frame thumbnails it names, the rule, and a status mark: FILLED "Agrees in v2" or HOLLOW "Open — founder call". Print the status word next to the mark.
- H1 · F5 and F6 must agree that the address is saved on the server at registration: F6 says "Saved privately" and never "holding" in saved mode. B1 says "holding", uses the held chip and states "We're holding it for 7 days, until Sat 17 Oct." (the design doc asks for at least 7 days; the prompt allows no hold under 20 hours). Status: agrees in v2.
- H2 · F7 and F8 must agree on the landing: the confirm opens f1-save-confirmation 03-saved directly, never its pre-save "Save" button (01) and never sign-in, and F8 (web-390 03-confirmed-other-device) is pixel-identical to f1-email-verify-handoff · web-390 · 04-confirmed-same-device. The laptop's web-1440 04 (B6) is the same landing with the sidebar. The flows-spec line "Saved 1402 NE 3rd Ave to your account." is dropped and folded into "Saved privately" plus the address line. Status: agrees in v2.
- H3 · B3's two frames must agree on recovery copy and destination: the email page (08) says "We stopped holding that address. Confirm your email, then save it again." and routes to the save confirmation's 04a or 04b, and 04b says "We stopped holding that address. Type it again to save it." A held address is always a one-tap row. Status: agrees in v2.
- H4 · F6, F8, F10, F15 and F18 must agree on the scope sentence "Only you will see this." and the chip "Saved place · Only you". f1-your-places still writes "Only you can see these." and f11-keeper-naming "Only you see this.". Status: open.
- H5 · F8 and F17 must agree on the return trigger: the saved body now says "Today now uses this address, and so will any reminders you turn on." It no longer promises the morning briefing, and the night-before reminder arrives at F17. Status: agrees in v2.
- H6 · F4, F8 and B9 must agree that the first account ask is "keep", not "claim": the WallBar says "Keep this address handy." (with a full stop in f9; without one in f8-compare-reveal and f1-save-confirmation; pick one), and "Claim this address" appears only as F8's secondary action. Status: open (punctuation).
- H7 · F14 and F10/F13 must agree on the Camas pickup source line: the card says "City of Camas · 2026 collection calendar, read Thu 1 Oct 2026", while the strip says "City of Camas · weekday only · 2026 calendar", and x-provenance-sheet's PB says "City of Camas schedule" (re-dated here to Updated Thu 1 Oct 2026). x-place-file draws PLACE B's pickup hollow with no action. Status: open.
- H8 · F15 and B14 must agree on what follows the first pickup save. f4-today-pickup-card opens the inline ask after the first confirm OR correction, while f4-notification-primer opens the primer after the first pickup save in the Date sheet "from 'Change pickup day' or 'Set your pickup day'". One tap must lead to one ask. Status: open.
- H9 · F15, F17 and B15 must agree on one ask and one widget offer at a time: while the inline ask is open, the briefing card hides its night-before row, and after a denial only one "Show me how" shows in the first viewport. The pickup card's 16 and the briefing card's 17 both draw one. Status: open.
- H10 · F17, F19 and the place file must agree on when Jordan is done. §5 counts the confirmed pickup rule, so he activates at F17; FirstWeekRow still asks for one date until F19. x-place-file says "'Set your pickup day' is done only when the person sets the frequency and confirms", but Jordan's frequency is Not set, and F17 still advances FirstWeekRow. Also, f1-today-tab and x-place-file assume a Sat 17 Oct save (first week until Sat 24 Oct), while the fixture and this board use Sat 10 Oct (first week until Sat 17 Oct); the date the window ends changes which asks show after Sat 17 Oct. Status: open (the founder decides whether a weekday-only confirm completes the step, and which save date the exports should use).
- H11 · B16 must agree with FirstWeekRow: "Next: get a reminder the night before →" scrolls to a briefing card whose night-before row was declined at F15. Also, f1-today-tab puts FirstWeekRow at slot 2b under the pinned slot, while f4-briefing-optin-card says the briefing card sits "above the FirstWeekRow". Status: open.
- H12 · F15's tray caption "This is the whole thing." must agree with what F16 turns on: after a new grant, f4-notification-settings turns on Air & weather alerts at 101 and Account & security. Jordan will get an air alert for his saved place (flow-10). The primer body says "Nothing else unless you turn it on." Status: open.
- H13 · W4 and §5 must agree: an email or organic open is a return, not an activation condition, so a web-only saver without the web briefing channel never activates. Status: open.
- H14 · F15, F17 and F20 must agree on the pickup strings for Jordan: the tray preview "Garbage tomorrow" / "Bins out tonight", the push itself, the widget hero and the strip row. f7-widget-gallery uses "Recycling + garbage Tue", and the canonical brief strings are HOME A's. The f5 strip row keeps the title "Pickup day" and "Which bins go out isn't set yet" after confirm, while the card says "Garbage tomorrow". Status: open.
- H15 · F15 and F17 must agree on the you-added caption: f4-today-pickup-card writes "✓ You added this · Thursday", x-date-sheet writes "You · Thursday", and f1-today-tab writes "You · Tuesday · Waste Connections". Status: open (contract question).
- H16 · F17 must show the widget snapshot and the strip cells changing from hollow to tick on confirm, and "That's My Day" from a tray must rewrite the widget snapshot. Status: agrees in v2 (f4 DONE WHEN), but no f5 or f7 frame draws the flip.
- H17 · F18, F19 and the later reminder must agree on the lease reminder: it fires Sat 30 Jan 2027 at 7:00 AM while Jordan's morning briefing is off (does a Dates & bills reminder need the morning briefing?), and its landing (Mon 1 Mar 2027 is 14 days out, outside the window) must be the place file's Dates row (x-place-file 07), not the Today strip (x-date-sheet 22 draws a highlighted strip row). The deep link /app/place/today?rule=… must redirect to /app/today. Status: open.
- H18 · F18 and F19 must agree on one announcement: the sheet announces "Saved to your calendar. Only you." and the strip then shows "Saved · Lease ends Wed 31 Mar 2027 is in your place file · See it". Decide whether both are announced. Status: open.
- H19 · F2 and F14 must agree on the voter date: the aha says "must arrive by Oct 26" and the strip bar is "Mon 26 Oct". The design doc keys mover rows on Home.move_in_date, so Jordan at T1 never sees the mover voter row (flow-13 owns this). Status: open.
- H20 · F10 and the no-place state must agree on labels: Today's empty-state button is "Add a place" (f1-today-tab, f1-add-place-sheet), but f4-briefing-optin-card's no-place copy still says "Preview an address". Status: open.
- H21 · F13, B7 and f1-your-places must agree on how many places Jordan has: this storyboard, f4-today-pickup-card and the push rule assume one (no street label), while f1-your-places gives him five rows including "Mom's house", and f1-add-place-sheet says "He already has older saved places, including Mom's house" yet draws a signed-in first-place case (its frame 5, ios 02-idle-first-place, over Today's no-place card). Check whether B7's add-place export assumes a first place or several. Status: open.
- H22 · F10 and F11 must agree on how a signed-in web user reaches the app: the only designed app-download link is in the signed-out WallBar footer, and the component contract says "No actions inside the sticky WallBar". Status: open.
- H23 · F20 and F21 (with the thumbnail of f4-today-pickup-card · ios · 20-arrived-from-push) must agree on the night-before push landing. Link: "pantopus://today?section=pickup" plus the delivery id (f4-today-pickup-card) vs "pantopus://hub-today?deliveryId=…&kind=evening" (f1-today-tab; f7-widget-tap-landing says the link formats must not collide). Pinning: f4-today-pickup-card pins the card under the location row (its artboard 20) vs f1-today-tab's rule that no pinned line repeats a card already in the first viewport (F21). Session attribution (trigger 'push', kind 'pickup') depends on which link and payload ship. Status: open.
- H24 · F14, F17 and B15 must agree with the activation query on the city seed: does the activation query count a city-seeded (unconfirmed) pickup rule as the household fact? This board proposes it must not, while the place-file "on file" count includes the seed (x-place-file). §5 does not say either way. Status: open.
- H25 · B15 and §5 must agree on what widget event counts: §5 counts "a widget snapshot written, reported by the client as an event". If the app writes a snapshot on every Today load, every user who opens Today would count. Activation should count a placed widget (a detected placement or an add-to-home-screen confirmation), which depends on the widget-detection gap (x-place-file 17 margin note; f7-widget-howto-sheet ends at "Done" with no confirmation on iOS). Status: open.
- H26 · F14, F15 and F20 must agree with the research brief on the saved-place push rule and the card label. The brief (§3) gives a canonical unconfirmed push "Unconfirmed: pickup tomorrow" / "Recycling + garbage · city schedule" with the action "That's my day"; brief §2.5 and §2.8 name the card ask "That's my day"; and §5's honesty counter assumes unconfirmed pushes are sent with their caveat. f4-today-pickup-card draws "Yes, Thursday is right" and "No night-before reminder until you confirm your day.", and this board sends no push on the unconfirmed Thursday. Status: open.

ACCESSIBILITY IN THE JOURNEY
Draw a focus marker (a 2px focus-ring glyph plus the word "Focus") on the element that receives focus in every frame, and put a speech-bubble glyph with the announced text beside every announcement.
- F1: at 1440 the field autofocuses. At 390 nothing autofocuses and screen readers start at the H1.
- F1→F2: the preview renders; focus moves to the preview's first heading (the PlaceHeader). This is a proposal; list it on Notes.
- F2 follow-up row → the WallBar: focus moves to the wall's headline.
- F4→F5: focus lands on the register form's first field.
- F5→F6: focus starts on the headline "Check your email". "Sent. You can send another link in 1 minute." is announced once after a resend.
- F7→F8: focus starts on the title "Saved privately". "Email confirmed." and "Saved privately. Today now uses 1107 NE Birchfield Ct." are status messages that do not move focus.
- F8→F9: focus goes to the location row, read as one element: "1107 NE Birchfield Ct, visible only to you, setting up Today". Sections fill in silently; F10 announces nothing on its own.
- F12→F13: VoiceOver starts at the large title "Today".
- F14→F15: "Saving…" then "Saved to your calendar. Only you." are polite. The tapped button is replaced, so focus moves to the ask's question "Remind you the night before? 6:00 PM" (a proposal; list it on Notes).
- F16→F17: after Allow, focus returns to the PickupCard. The briefing card is not scrolled to or highlighted.
- F17 FirstWeekRow → "+ Add a date": scroll once and move focus to "+ Add a date". Under Reduce Motion, jump without animation and show a static highlight.
- F18: the sheet has a unique title and traps focus. After the tile pick, "Lease ends, selected. Change what this date is for, button" is announced. Saved is a status message. On close, focus returns to "+ Add a date" (what opened it), and the strip's status line is polite.
- F20→F21: scroll once, focus lands on the PickupCard, and the highlight fades within 300ms (static under Reduce Motion).
- B8 and B12: focus stays on the retry control, and the error line is announced once.
- B13: focus does not move; the offline line is announced once, and each disabled button reads its reason.
- B15: after Don't Allow, focus returns to the PickupCard's "Pickup still shows here on Today" line, announced once; "Show me how" is the next focusable element.
- The no-notifications path: every fact a push would carry is on Today (F14, W4). Nothing in the journey needs a push, a widget or a gesture. B15 and W2 name what still works in text.
- Every frame in the storyboard still reads in greyscale. Lane titles, arrow labels and status words are text, never colour.

INSTEAD OF
- Instead of drawing the flows-spec persona Maya at 1402 NE 3rd Ave, draw Jordan at 1107 NE Birchfield Ct — because the house-style fixtures are the single source of names and addresses.
- Instead of a primer sheet after "Yes, Thursday is right", draw the PickupCard's inline ask going straight to the system dialog — because v2 replaced that step, and a third ask trains dismissal.
- Instead of "Recycling and garbage tomorrow" for Jordan, draw "Garbage tomorrow" — because his recycling is Not set, not known.
- Instead of a separate "Saved … to your account." frame after confirming, draw the single 03-saved page with "Email confirmed." above it — because both projects now draw the same landing.
- Instead of redrawing an exported screen from memory, place the export and list only the dated deltas, and caption any person, place, row, mark or layout change (including a crop or a moved button) as REDRAWN — because the storyboard exists to show breaks between real designs.
- Instead of placing a HOME A export as is for Jordan, caption it REDRAWN with the recast strings and a founder-verify note — because an export that never names its place probably shows Maya's Tuesday.
- Instead of colour-coding lanes or branch severity, print lane titles and status words — because the board must read in greyscale.
- Instead of marking Jordan activated at the date step, mark him activated at the grant (F17) — because §5 counts the confirmed pickup rule as the household fact.
- Instead of presenting the city-seed exclusion as a §5 rule, label it a proposal with its own check (H24) — because §5 does not say it.
- Instead of hiding a conflict between two exports, draw both frames side by side with the handoff check number — because the founder uses this board to decide.

DONE WHEN
- Every flows-spec step for flow-01 appears as a frame, recast to Jordan and PLACE B, with its moment of truth as a callout.
- Every flows-spec failure branch appears in a lower lane with its recovery and its landing frame; B7 names its route to activation.
- Each frame is labelled with its platform, its v2 state name, its moment in time, and exactly one caption form ("export:", "export + deltas:" with numbered deltas, or "REDRAWN from"); only F2 uses "export + deltas", and F13, F14, F18b and F19 read REDRAWN with their numbered changes.
- B9, B12, B13, B14, B15, B16 and B17 read REDRAWN with their recast strings, and the founder-verify frames carry their verify note.
- B14 is drawn from x-provenance-sheet 02-report-schedule with PB's values and "Updated Thu 1 Oct 2026".
- The time gaps read "Six hours later · Sat 10 Oct, 6:10 PM", "Four days later · Wed 14 Oct, 6:10 PM", "TODAY · Mon 19 Oct, 6:10 PM · the 6:00 PM briefing was skipped · no push" and "Two days later · Wed 21 Oct, 6:00 PM".
- F14 and F19 read "Next 14 days: 3 items" with no renters-insurance row; F17 shows no property-tax signal; F18b shows all three reminder ticks.
- The activation point is marked at F17, on day 4, with the three facts that make it true.
- No frame shows a push on the unconfirmed Thursday, a house number on a lock screen, a primer after a card "Yes", or a permission ask at launch (except B18, labelled as the current build).
- F20 is captioned with both push link forms, and F21 sits beside the f4 20 thumbnail.
- All 26 handoff checks appear with their frames and statuses.
- Focus and announcements are marked on every transition, and every artboard reads in greyscale.

ARTBOARDS
1. flow-01 · storyboard · 01-map · light — drawn last: the happy path F1–F22 as 12% thumbnails on one time axis, with lane names, device per segment, the activation point, and labelled branch stubs.
2. flow-01 · storyboard · 02-laptop-lunch · light — F1–F6 (Sat 10 Oct, 12:20 PM, web-1440) with callouts, carried-data chips, and the six-hour gap at the right edge.
3. flow-01 · storyboard · 03-phone-evening · light — F7–F13 (Sat 10 Oct, 6:10–6:25 PM, iPhone web-390 then iOS), with F8's pixel-identical bracket, and the four-day gap at the right edge.
4. flow-01 · storyboard · 04-first-pickup-eve · light — F14–F19 (Wed 14 Oct, 6:10 PM, iOS), with the "Activated · day 4" callout at F17 and the TODAY gap at the right edge.
5. flow-01 · storyboard · 05-first-pickup-night · light — the "Two days later · Wed 21 Oct" gap, then F20, F21 with the f4 20 thumbnail, and F22 as the alternative arrival under F21.
6. flow-01 · storyboard · 06a-branches-save-account · light — B1–B5 under thumbnails of F5–F8, each rejoining its frame.
7. flow-01 · storyboard · 06b-branches-save-device · light — B6–B9 under thumbnails of F1, F4 and F6, each rejoining its frame.
8. flow-01 · storyboard · 07-branches-today · light — B10–B14 under thumbnails of F9–F17.
9. flow-01 · storyboard · 08-branches-permission · light — B15–B18 under thumbnails of F11 and F15–F18.
10. flow-01 · storyboard · 09-no-notifications-path · light — W1–W4, ending with the "Activation unreachable on web" bar.
11. flow-01 · storyboard · 10-handoff-checks · light — H1–H26, each with its frame thumbnails, rule and status.
12. flow-01 · storyboard · 99-notes · light — list: the recast (Maya/1402 NE 3rd Ave → Jordan/1107 NE Birchfield Ct; Tuesday → Thursday; "Recycling and garbage" → "Garbage"; no street label; the HOME A → PLACE B recast strings used on REDRAWN branch frames); the artboard-name exception ("storyboard" in the platform slot, including this Notes artboard); the three caption forms and the choice to keep "export + deltas" narrow (date, relative-count and item-count text only), so F13, F14, F18b and F19 are recaptioned REDRAWN because they remove rows, move a button, crop the layout or flip marks (flow-14's definition also allows a caption removal); F14's primary source (the f4 card) and second source (the f5 strip); the founder-verify frames (B11's card, B12, B13, B15's pickup card, B16, B17's two frames, W2's declined card): each is REDRAWN unless its export shows Birchfield Ct / Thursday / "Only you will see this.", in which case it becomes "export:"; B15's briefing card is REDRAWN because only Maya's briefing frames carry the place caption; B9 is REDRAWN because the 06-wall-open-slots export is Dana's compare arrival at 390 and Jordan's arrival is a search on his 1440 laptop; B14 is REDRAWN from x-provenance-sheet 02-report-schedule (the prompt's 01 is P1 at HOME A, and B14 describes the report view), with PB's Updated line re-dated from Thu 15 Oct 2026 to Thu 1 Oct 2026 and the checkbox unticked; every invented string (the email subject "Confirm your email", its body "Your code is 482913. Or use the button. It works on any device.", the code 482913, "observed 12:00 PM today", "in 16 days · Mon 26 Oct", "as of Sat 10 Oct", "Checked 6:10 PM" with "weather 5:45 PM · air 6:00 PM · alerts 6:00 PM · your calendar 6:00 PM", "Next 14 days: 2 items", "Next 14 days: 3 items", "in 5 days · Thu 15 Oct", "in 12 days · Thu 22 Oct", "in 8 days · Thu 22 Oct", "in 12 days · must arrive by Mon 26 Oct", "in 138 days · Mon 1 Mar 2027", "Removed from launch", "Activated · day 4 · Wed 14 Oct", "Activated at the date save", "rejoins F17 · pending H25", "Current build · must not ship", "Activation unreachable on web until the web briefing channel ships", "card drawn for Wed 21 Oct, placed at Wed 14 Oct", "f4: card pinned under the location row · see H23", the founder-verify note text, the B7 specimen address "1402 NE 33rd Ave, Portland, OR 97232" (borrowed from f1-add-place-sheet), the arrow labels and gap labels); every date delta and change: exports dated Mon 19 Oct or Wed 21 Oct placed at Sat 10 Oct or Wed 14 Oct; F3's AirNow time changed from the fixture's 7:00 AM to 12:00 PM; F10/F13 receipt times re-dated for Sat 10 Oct, with air moved from 7:00 AM to 6:00 PM; F14 and F19 drop Jordan's renters-insurance row (never added in this flow; Fri 30 Oct is outside the Wed 14 window) and read "Next 14 days: 3 items"; F14 drops the Thu 29 row, adds the Mon 26 bar and moves the "Set your pickup day" button from Thu 22 to Thu 15; F18b drops the export's place-file half, re-counts the notice deadline from Wed 14 Oct and shows all three reminder ticks; F19 turns the hollow Thursday marks into ticks; B10 draws the briefing card never asked instead of the export's declined line; B11 redraws the DateSheet with no city seed, no "Use the city schedule again", no holiday row and no prefilled weekday; f1-today-tab and x-place-file assume a Sat 17 Oct save (first week until Sat 24 Oct), and this board re-dates them to the fixture's Sat 10 Oct (first week until Sat 17 Oct) — see H10; assumptions (saved-at-registration is the default; the property-tax signal is absent at F10/F13 (23 days out) and at F17 (19 days out); the gutters tile is kept as exported on Sat 10 Oct; the web briefing channel exists only in W2; he has one place; B7's add-place export may show f1-add-place-sheet's first-place case rather than a person with several places (H21); focus moves to the preview heading after F1 and to the ask's question after F14, both proposals; the city-seed exclusion from activation is a proposal, H24; the TODAY gap's 6:00 PM send moment was skipped because nothing is due Tue); the unresolved open questions H4, H6–H15, H17–H26; that flows-spec steps 8 and 9 merged into F8, step 12 (primer) was replaced by the inline ask, and steps 12–13 moved to F15–F16; that the email template is designed in no prompt; that the App Store and sign-in frames are external; the batch counting rule (thumbnails, half-frames and ghosts count as half); the founder-verify items: the City of Camas 2026 collection calendar and its Thursday weekday rule, whether the week-four push date (Wed 4 Nov, for Thu 5 Nov) falls on a normal Camas week, and the Camas Thanksgiving move (Thu 26 Nov 2026 → Fri 27 Nov, the illustrative date other storyboards use, labelled there as the city's published holiday schedule) against the real City of Camas calendar.

BATCH PLAN
Turn 1: artboards 2–4 (about 20 frames, counting F8's thumbnails, F11's and F18's half-frames and the ghost dialog as half), with the turn 1 ATTACH list, then wait for "continue".
Turn 2: artboards 5, 6 and 7 (06a, 06b; about 19 frames), with the turn 2 ATTACH list, then wait for "continue".
Turn 3: artboards 8 and 9 (07, 08; about 19 frames), with the turn 3 ATTACH list, then wait for "continue".
Turn 4: artboards 10, 11, 1 and 12 (09, the handoff checks, the map, 99-notes), with the turn 4 ATTACH list.
