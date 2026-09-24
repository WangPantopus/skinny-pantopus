# Compare card: Dana mints → Jordan opens on his phone → reveal → Jordan sends his own to Ana
id: flow-05 · platforms: web/ios/android · artboards: 15

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

JOURNEY: flow-05 · Compare card: the sender makes a card → a friend opens it on a phone → reveal → the friend sends their own card on.

TYPE: NEW (storyboard). Every screen in this journey already has its own project. Do not redesign any screen. Place the attached exports as frames. Change only the strings and data this prompt lists for each frame. Then draw the connections, time gaps, callouts and failure branches between the frames.
- REDRAW means no export with this data exists yet. Redraw that frame faithfully from the named base artboard and the description given, keep its layout, components and type exactly, and list every change from the base as a numbered delta in the frame's gutter.
- SPECIMEN means the export is placed unchanged even though its data belongs to another person or day. Print the given specimen label above the frame.
- A frame with neither tag is placed exactly as exported.
- Rule for string forms: every surface keeps its OWN string forms. f8-compare-sheet frames use the sheet's short row forms, its 720px text column, its own title line and its own description form. f8-og-compare-card frames use the OG layer-word forms. Do not copy one surface's forms into another's frame. The handoff checks exist to show where those forms disagree, so the paired crops must show each export's own string.

ATTACH (exact exported artboards, by name):
- f8-seasonal-aha · web-390 · 09-deadline-passed-ranked · light (base for frame 1: REDRAW, see its deltas; the radon card strings stay as exported)
- f8-seasonal-aha · ios · 18-voter-7-days · light (branch B7 only; SPECIMEN)
- f8-compare-sheet · web-390 · 01-idle · light (frame 2: REDRAW with Dana's data)
- f8-compare-sheet · web-390 · 02-name-shown · light (frame 3: REDRAW with "Dana")
- f8-compare-sheet · web-390 · 03-minting · light (frame 3 inset: REDRAW with Dana's data)
- f8-compare-sheet · web-390 · 04-share-sheet-open · light (frame 4: REDRAW with Dana's data; also the base for "11-inset share sheet": REDRAW over the reciprocal sheet)
- f8-compare-sheet · web-390 · 05-reciprocal-send-yours-back · light (frame 11: REDRAW with Jordan's readings, see step 11)
- f8-compare-sheet · web-1440 · 07-copied · light (B2: REDRAW with Dana's data)
- f8-compare-sheet · web-390 · 08-share-cancelled · light (B1: REDRAW with Dana's data; also the base for B19: REDRAW as the reciprocal sheet)
- f8-compare-sheet · web-390 · 09-no-system-share · light (B2: REDRAW with Dana's data)
- f8-compare-sheet · web-390 · 10-mint-error · light (B4: REDRAW with Dana's data)
- f8-compare-sheet · web-390 · 11-rate-limited · light (B5: REDRAW with Dana's data)
- f8-compare-sheet · web-390 · 12-offline · light (B6: REDRAW with Dana's data)
- f8-og-compare-card · web-1440 · 01-valid-named · light
- f8-og-compare-card · ios · 02-imessage-bubble · light (frame 5)
- f8-og-compare-card · web-1440 · 03-valid-anonymous · light (frame 12 image)
- f8-og-compare-card · web-1440 · 05-fallbacks · light
- f8-compare-arrival-header · web-390 · 01-collapsed-named · light (frame 6)
- f8-compare-arrival-header · web-390 · 02-expanded · light (inset on frame 6)
- f8-compare-arrival-header · web-390 · 04-typing-suggestions · light (frame 7)
- f8-compare-arrival-header · web-390 · 05-anonymous · light (base for "12-arrival": REDRAW with Jordan's collapsed line)
- f8-compare-arrival-header · web-390 · 06-verifying · light
- f8-compare-arrival-header · web-390 · 07-expired · light
- f8-compare-arrival-header · web-390 · 08-offline · light
- f8-compare-arrival-header · web-390 · 09-couldnt-open · light
- f8-compare-arrival-header · web-390 · 11-no-match · light
- f8-compare-reveal · web-390 · 04-loading · light
- f8-compare-reveal · web-390 · 01-both-revealed · light (frames 8 and 9)
- f8-compare-reveal · web-390 · 02-same-band · light
- f8-compare-reveal · web-390 · 05-geocode-failed · light
- f8-compare-reveal · web-390 · 06-unsupported-region · light
- f8-compare-reveal · web-390 · 07-layer-missing · light
- f8-compare-reveal · web-390 · 08-legacy-tiles · light
- f8-compare-reveal · web-390 · 09-offline · light
- f8-compare-reveal · web-1440 · 10-signed-in · light
- f8-compare-reveal · web-390 · 11-signed-in-already-saved · light (base for "13-landing": REDRAW, one delta, see step 13)
- f8-compare-reveal · web-390 · 12-founding-open · light
- x-provenance-sheet · ios · 05-official-flood · light (base for frame 10: REDRAW at web-390 as a bottom sheet with Jordan's Zone AE payload)
- x-provenance-sheet · web-390 · 25-frozen-compare-flood · light (branch B25)
- f8-native-share-compare · ios · 01-idle · light (branch B7; SPECIMEN)
- f8-native-share-compare · ios · 03-compare-share-sheet · light (branch B7; SPECIMEN)
- f8-native-share-compare · android · 10-sharesheet · light (branch B7; SPECIMEN)
- f9-founding-meter-preview · web-390 · 06-wall-open-slots · light (branch B21)
- f1-save-confirmation · web-1440 · 06-account-switched · light (branch B23; SPECIMEN)
- f1-save-confirmation · web-390 · 03-saved · light (base for the dashed alternative "13-alt": REDRAW as the duplicate variant; no export of that variant exists)
- f1-email-verify-handoff · web-390 · 01-sent-saved · light (branch B22: REDRAW for Ana)
- f1-today-tab · ios · 02-saved-place-quiet · light (base for frame 14: REDRAW at web-390)
No export exists for these: the existing /start register page, the existing sign-in page, the ordinary /start preview (branch B8), the Safari share sheet and the iMessage thread chrome. Draw each as a plain frame on surface.sunken with a 1px text.secondary keyline, labelled "existing screen, not redesigned" or "system UI". Each holds only the strings this prompt gives it.

PERSONA & SITUATION (recast from flows-spec onto the house FIXTURES; flows-spec's Maya, 6207 NE 42nd Ave and "Vancouver, WA" are replaced everywhere):
- Sender: Dana (FRIEND C), Camas, WA. On Sat 12 Sep 2026 at 9:40 AM, she looks up her own address in Safari on her iPhone, signed out. Her card is frozen "as of Sat 12 Sep 2026" with the FIXTURE readings:
  - Flood Zone X (minimal flood hazard, FEMA, effective Sep 2021)
  - Wildfire hazard Moderate, 3 of 5 (USFS 2023)
  - Air AQI 42, Good (AirNow, observed 7:00 AM)
  - Radon Zone 1, highest potential (EPA, county-wide)
  Her address appears only on her own screens (frames 1–4, the frame 3 inset and branches B1–B6), as the invented "918 NE Alder Crest Way, Camas, WA 98607". It never appears on anything anyone else sees.
- Recipient: Jordan Lee, 36, at PLACE B (1107 NE Birchfield Ct, Camas, WA 98607). He moved from Portland, OR on Fri 9 Oct. He saved PLACE B on his work laptop on Sat 10 Oct, so he already has an account, but he is signed out in Safari on his iPhone. He is tier T1. City of Camas pickup day: Thursday (hollow). Frequency: Not set. Dana sent him her card on Sat 12 Sep, when he told her he was moving to Camas. He did not open it then.
- TODAY for steps 5–14 is Mon 19 Oct 2026, starting at 6:08 PM Pacific. Jordan is on the bus home. At 6:08 PM, Dana texts him again under the old card: "Settled in? Try yours."
- Jordan's readings at PLACE B (the specimen values from f8-compare-reveal and frame 03 of f8-og-compare-card; use these wherever Jordan's readings appear, in the form of the surface that shows them):
  - Flood Zone AE — 1% chance each year (about 1 in 4 over 30 years), FEMA
  - Wildfire Low · 2 of 5, USFS
  - Air AQI 58 · Moderate, AirNow, observed 5:00 PM today
  - Radon Zone 1 — highest potential (county), EPA
- Next hop: Jordan sends his own card to his sister Ana (an invented name). She has no account. She opens it at 7:02 PM on her iPhone in iMessage.

GOAL: Dana shares her readings and never her address. Jordan sees her readings, types his own address and sees both places on one instrument, with nothing ranked. He passes his own card on to Ana. Then he keeps PLACE B without retyping it and without creating a second saved place.

§5 METRIC: Spread, k = compare rate × hop × reveal ≥ 0.3, where:
- compare rate = t0_share_clicked(method=compare) ÷ t0_aha_viewed
- hop = t0_compare_viewed ÷ compares
- reveal = t0_aha_viewed with vs ÷ t0_compare_viewed
Also Honesty: zero cards read as a claim about a neighbour's home. This journey produces one full k cycle (Dana → Jordan) and starts the next (Jordan → Ana). It sits at loop entry 1 of design doc §1 ("Sign-up from a fact … the compare card carries it to the next stranger").

SHARED DELTA SET "D" (for every f8-compare-sheet frame redrawn onto Dana's lane: frames 2, 3, the frame 3 inset, 4 and B1, B2, B4, B5, B6). The base exports show Jordan sending his own card on Mon 19 Oct. Print these deltas in each frame's gutter, plus that frame's own deltas:
  D1. Made-from line: "Made from 918 NE Alder Crest Way. The address stays off the card.", replacing "Made from 1107 NE Birchfield Ct. The address stays off the card."
  D2. Preview air row, in the sheet's own short form: "Air on Sat 12 Sep · AQI 42 · Good", replacing "Air on Mon 19 Oct · AQI 42 · Good". The flood, wildfire and radon short-form rows stay as exported ("Flood zone X · minimal hazard" · "Wildfire · Moderate · 3 of 5" · "Radon zone 1 · highest (county)"), because the fixture readings are Dana's. The 720px text column stays.
  D3. Sources line: "● Official · FEMA Sep 2021 · USFS 2023 · AirNow Sat 12 Sep · EPA county-wide", replacing "AirNow Mon 19 Oct".
  D4. Privacy line expiry: "until Thu 12 Nov", replacing "until Sat 19 Dec".
  D5. Description line, in the sheet's own form with Dana's radon headline: "Clark County is in EPA radon Zone 1 — highest potential. Only a home test can tell. Radon zone: EPA. Readings: FEMA, USFS, AirNow, EPA. Nextdoor is what your neighbors say. Pantopus is what's on record about your address." (clamped to two lines), replacing the export's voter form. "Radon zone: EPA." follows the sheet's "<topic>: <authority>." pattern and is invented.
  D6. Frame label and any time shown: Sat 12 Sep, replacing Mon 19 Oct.
  Where a base frame does not show one of these elements, skip that delta and say so ("D3 not visible").

THE HAPPY PATH (14 steps; the frame number equals the step number)

1. Web-390 (Dana's iPhone, Safari) · f8-seasonal-aha · the ranked card on the T0 preview (REDRAW from 09-deadline-passed-ranked). Frame label: "Sat 12 Sep, 9:40 AM · Dana".
- Shows: the host PlaceHeader (existing, not a Foundations component) with "918 NE Alder Crest Way, Camas, WA 98607" and "Sign in". The aha card is the base's Clark County radon card, with its strings unchanged:
  - overline "WHAT STANDS OUT"
  - the neutral reading chip "Zone 1"
  - headline "Clark County is EPA Radon Zone 1 — highest potential (county)."
  - detail "County zone from EPA. It says nothing about your home's level; only a test does."
  - source: a filled ProvenanceMark (S), the word "Official", then "EPA · county-wide estimate — only a test tells you about this home"
  - the sunken follow-up row "Keep this address handy"
  - no outbound row (a ranked card with no seasonal match, as in the base)
  The source caption carries no "as of" date (the base's own choice; the arrival header's caption does carry one, see check 20). There is no voter card, because the voter card only runs from Sep 20. There is no air card, because AQI 42 is under 101. 16px below the card sits the TextActionRow "Compare with a friend" with the caption "Cards show readings and your city, never your address." The sticky WallBar reads "Keep this address handy" · "Today and a night-before pickup reminder run on it.", with its footer links "Share this address" and the app download (see check 22).
- REDRAW deltas, printed in the gutter:
  1. Date and time: Sat 12 Sep, 9:40 AM, replacing the base's Wed 4 Nov. The card content does not change, because a ranked card with no seasonal match is the same on both days.
  2. The PlaceHeader address becomes Dana's invented address.
  3. The web share pair "Compare with a friend" and its caption appear 16px below the card (add them only if the base export lacks them).
  4. The WallBar button reads "Keep this address handy" with the benefit line "Today and a night-before pickup reminder run on it." (f8-compare-reveal's wording for the /start preview), replacing the host's existing sentence "Keep this address handy." + "Continue". Point this delta to check 10.
  Nothing else changes.
- Does: taps "Compare with a friend".
- Carried to step 2: Dana's address (server side only, used to make the card), the city "Camas, WA", the four frozen readings with their source dates, and the headline (radon, 90 characters or fewer, picked today by the seasonal ranking). The token's headline string, as the downstream surfaces draw it, is "Clark County is in EPA radon Zone 1 — highest potential. Only a home test can tell." This is not the wording on this frame. Highlight the mismatch with an ink keyline and point it to handoff check 20. Event: t0_aha_viewed, anon_id A.
- MOMENT OF TRUTH callout: "The spread action is there but low-key. The save action in the WallBar outranks it (with delta 4, its only filled button reads Keep this address handy; today's export reads Continue, see check 10)."

2. Web-390 · f8-compare-sheet · 01-idle, with the link made in advance when the sheet opens (REDRAW with Dana's data). Label: "Sat 12 Sep, 9:40 AM · Dana".
- Shows, in order, in the sheet's own forms:
  - Title "Compare with a friend" and Close.
  - Made-from line: "Made from 918 NE Alder Crest Way. The address stays off the card."
  - The preview image, as the sheet draws it: the ScaleStrip 05-og-column recipe with the 720px text column, anonymous. Sender line "A place in Camas, WA". Rows "Flood zone X · minimal hazard" · "Wildfire · Moderate · 3 of 5" · "Air on Sat 12 Sep · AQI 42 · Good" · "Radon zone 1 · highest (county)". Sources line "● Official · FEMA Sep 2021 · USFS 2023 · AirNow Sat 12 Sep · EPA county-wide". Then the filled "Yours?" card with "pantopus.com".
  - Title line, as exported: "A place in Camas, WA · Yours?"
  - Description line, clamped to two lines: "Clark County is in EPA radon Zone 1 — highest potential. Only a home test can tell. Radon zone: EPA. Readings: FEMA, USFS, AirNow, EPA. …". Highlight its headline for check 20.
  - "pantopus.com"
  - Privacy line: "This card shows readings and your city, never your address. Anyone with the link can see this card until Thu 12 Nov."
  - Toggle "Show my first name on the card", shown Off.
  - URL row "pantopus.com/start?vs=eyJ2IjoxLCJjIjoiQ2FtYXM…" with "Works for 61 more days" and "Copy link".
  - Equal-width buttons "Share" and "Cancel".
- REDRAW deltas: D1–D6. Nothing else changes: the rows keep the sheet's short forms and the title line keeps the sheet's anonymous form, so checks 2 and 5 can show the break against frames 5 and 12.
- Does: reads the privacy line, then turns the toggle on.
- Carried: token v1 (no name), expiring Thu 12 Nov.
- MOMENT OF TRUTH: "She reads the consent line, with its expiry, before anything is sent. The link already exists, so Share will not wait on the network."

3. Web-390 · f8-compare-sheet · 02-name-shown (REDRAW with "Dana"). Label: "Sat 12 Sep, 9:40 AM · Dana".
- Shows: the toggle On, the First name field with "Dana" typed, the image sender line "Dana · Camas, WA" and the title line "What's on record at Dana's place. Yours?". The rows, sources line and description are as in frame 2. The URL row holds a new token but still shows the same truncated prefix, "pantopus.com/start?vs=eyJ2IjoxLCJjIjoiQ2FtYXM…", because the token changes after the cut. Nothing else moves.
- REDRAW deltas: D1–D6, plus:
  7. First name field "Dana", replacing "Jordan".
  8. Image sender line "Dana · Camas, WA", replacing "Jordan · Camas, WA".
  9. Title line "What's on record at Dana's place. Yours?", replacing "What's on record at Jordan's place. Yours?".
- Does: types Dana. The link is made again in the background, after a short typing pause. If this takes 1 second or more, show the 03-minting inset (REDRAW with D1–D6 and deltas 7–8): a spinner on the URL row, Share disabled, and "Making your link…".
- Carried: the token with n = "Dana". This sender line and title line must reach steps 5 and 6 character for character.
- MOMENT OF TRUTH: "The preview is exactly what the token holds: a first name, a city and four dated readings. No street, map or pin."

4. Web-390 · f8-compare-sheet · 04-share-sheet-open (REDRAW with Dana's data), with the iOS share sheet drawn as "system UI". Label: "Sat 12 Sep, 9:41 AM · Dana".
- REDRAW deltas: D1–D6 on the dimmed sheet behind, plus 7. the sheet behind shows the named state from frame 3 ("Dana", "Dana · Camas, WA", "What's on record at Dana's place. Yours?").
- Does: taps Share, picks Messages, then Jordan Lee. Her message reads "Once you're in Camas, try yours." The link unfurls.
- Carried: the URL "pantopus.com/start?vs=eyJ2IjoxLCJjIjoiQ2FtYXM…". Event: t0_share_clicked {method: 'compare'}, anon_id A. It fires once per tap, whatever the share sheet's outcome (see the metric question on repeat sends).
- MOMENT OF TRUTH: "navigator.share runs straight from the tap with no network wait, so the browser keeps the user gesture."

TIME GAP 1 (a labelled break in the lane): "Five weeks later · Mon 19 Oct, 6:08 PM · Jordan has lived at 1107 NE Birchfield Ct for 10 days. Dana texts: Settled in? Try yours." Under it, in caption type: "The card is still frozen as of Sat 12 Sep. The link works until Thu 12 Nov." The "Messages · Sat 12 Sep" arrow from frame 4 ends at the gap's dashed rule; a matching arrow stub restarts on the other side of the gap and runs into frame 5.

5. iOS (Jordan's iPhone) · f8-og-compare-card · 02-imessage-bubble. Label: "Mon 19 Oct, 6:09 PM · Jordan".
- Shows the thread:
  - First, Dana's Sat 12 Sep message and its unfurl: the 01-valid-named image ("Dana · Camas, WA", four rows in the OG layer-word forms, the sources line, "Yours?"), the title line "What's on record at Dana's place. Yours?" and "pantopus.com".
  - Then the Mon 19 Oct 6:08 PM text.
  - Beside the frame, print the og:image:alt: "Dana · Camas, WA, as of Sat 12 Sep 2026. Official readings: flood Zone X, minimal flood hazard, FEMA; wildfire hazard Moderate, 3 of 5, USFS; air quality index 42, Good, on Sat 12 Sep, AirNow; radon Zone 1, highest potential, county-wide, EPA. Next to it: Yours?"
  - Also beside the frame, print the og:description headline "Clark County is in EPA radon Zone 1 — highest potential. Only a home test can tell.", highlighted for check 20.
- Does: taps the card. Safari opens "https://pantopus.com/start?vs=eyJ2IjoxLCJjIjoiQ2FtYXM…". The app does not open it, even if it is installed.
- Carried: the token only.
- MOMENT OF TRUTH: "The title line asks the question, so the image never has to. The image is readable at bubble size. A bad token would still unfurl as the fallback card, never a broken image."

6. Web-390 · f8-compare-arrival-header · 06-verifying (an inset, shown only if the check takes 1 second or more) → 01-collapsed-named. Label: "Mon 19 Oct, 6:09 PM · Jordan".
- Shows, in order:
  - The H1 "See what's true about your address." and the lede.
  - The collapsed line, drawn as a button: "Dana · Camas, WA · Flood X · Wildfire Moderate · Air 42 on Sat 12 Sep · Radon Zone 1 ›".
  - "Your place"; the field with the placeholder "Enter your address", focused, with a caret; "See your place".
  - The privacy line "We don't post this anywhere. Nobody sees what you look up."
  - A small inset of 02-expanded shows what the chevron reveals: "What's on record for this area" · "Dana's card · as of Sat 12 Sep" · "● Official", the four rows with their captions, and the radon headline block "Clark County is in EPA radon Zone 1 — highest potential. Only a home test can tell." with its caption printed exactly as exported: "● EPA · county-wide estimate · as of Sat 12 Sep". Highlight the headline and the caption for check 20.
- Carried: the verified token payload (name, city, four frozen readings, headline, expiry). Events: t0_compare_viewed, anon_id B (Jordan's phone), and session_open {trigger: 'compare'}.
- MOMENT OF TRUTH: "The field is in the first screenful and already focused. Typing is never blocked while the token is checked. No reading is drawn from an unchecked token."

7. Web-390 · f8-compare-arrival-header · 04-typing-suggestions. Label: "Mon 19 Oct, 6:10 PM · Jordan".
- Does: types "1107 NE Bir". Five suggestions open, with "1107 NE Birchfield Ct, Camas, WA 98607" first. He picks it and taps "See your place". Draw the keyboard and mark the 400px area left visible above it.
- Shows: the collapsed line, still above the field. Below the field, in the export's order: the privacy line "We don't post this anywhere. Nobody sees what you look up.", then the contrast line "Nextdoor is what your neighbors say. Pantopus is what's on record about your address."
- Carried: the typed address (not saved on this device) and the token. The page cross-fades to the reveal in 300ms or less, and Dana's rows keep their order.
- MOMENT OF TRUTH: "The privacy promise sits right next to the field he is typing in, and nothing but the field competes for the tap."

8. Web-390 · f8-compare-reveal · 04-loading (an inset, shown only if loading takes 1 second or more) → 01-both-revealed, top of the page. Label: "Mon 19 Oct, 6:10 PM · Jordan".
- Shows:
  - The host PlaceHeader (existing, not a Foundations component): "1107 NE Birchfield Ct, Camas, WA 98607" · "Change address" · "Sign in".
  - Heading "Dana's card and your place".
  - Legend "▼ Dana · as of Sat 12 Sep" · "▲ You · today" · "● Official".
  - Summary "Different band on flood and wildfire."
  - One table, in the fixed order Flood · Wildfire · Air · Radon:
    - Flood, chip "Different band": "Dana: Zone X — minimal flood hazard ●" / "You: Zone AE — 1% chance each year (about 1 in 4 over 30 years) ●".
    - Wildfire, chip "Different band": "Dana: Moderate · 3 of 5 ●" / "You: Low · 2 of 5 ●".
    - Air, no chip: "Dana: AQI 42 · Good · on Sat 12 Sep ●" / "You: AQI 58 · Moderate · 5:00 PM today ●", with the note "Different days. Air changes hour to hour."
    - Radon, chip "Same band": "Both: Zone 1 — highest potential (county) ●".
  Each row has one track with two labelled pointers of the same shape (Dana above, You below), the band names printed, and its SourceCaption.
  - The sticky WallBar "Keep this address handy" · "Today and a night-before pickup reminder run on it." (check 10).
- Carried: Jordan's live readings and his aha. Event: t0_aha_viewed with vs, anon_id B. This event completes the reveal term.
- MOMENT OF TRUTH: "Nothing ranks one place above the other: no arrows, no winner, no re-sorting. Air never merges and shows both dates. The pointers are told apart by label and position, never by filled vs hollow."

9. Web-390 · f8-compare-reveal · 01-both-revealed, scrolled below the table. Label: "Mon 19 Oct, 6:10 PM · Jordan".
- Shows, in order:
  - The outbound TextActionRow "What Zone AE means · FEMA ↗", above a quiet divider.
  - Below the divider, Jordan's aha, the October seasonal pick for a Washington address: "Online or mail voter registration for Nov 3 must arrive by Mon 26 Oct in Washington." · "in 7 days · Mon 26 Oct" · "In person: until 8:00 PM Tue 3 Nov at your county elections office." · "○ On record, not confirmed · Washington Secretary of State" · "Moved recently? Registration is per address." · "Check or update at VoteWA ↗". Keyline the source caption for check 6: f8-seasonal-aha prints it as "Washington Secretary of State · statewide · as of Mon 19 Oct".
  - The two spread actions: "Send yours back" with "Your card shows readings and your city, never your address.", and "Share this address" with "Shares a link to 1107 NE Birchfield Ct."
- Recast note, printed in the margin: "flows-spec step 9 showed a flood aha. The reveal uses the voter headline instead, because Jordan moved from Oregon (see flow-13). The more serious flood reading gets its authority's next step above the divider."
- MOMENT OF TRUTH: "The more serious reading comes with FEMA's next step, not an alarm tint. The seeded deadline looks unconfirmed."

10. Web-390 · x-provenance-sheet · official flood (REDRAW from ios 05-official-flood as a mobile-web bottom sheet over frame 8). Label: "Mon 19 Oct, 6:11 PM · Jordan".
- Does: taps anywhere on the Flood row. The whole 44px row is the target.
- Shows:
  - Title "Where this fact comes from", with a visible Close.
  - A size-L filled ProvenanceMark, and the legend with "Official" emphasised.
  - Value "Zone AE — 1% chance each year (about 1 in 4 over 30 years)".
  - Source "FEMA · area zone · effective Sep 2021".
  - Method "FEMA Flood Insurance Rate Map".
  - Updated "Effective Sep 2021".
  - Covers "The FEMA map area that includes this address".
  - "Official. FEMA publishes and maintains this flood map."
  - Source row "FEMA flood map ↗".
  - The address line "1107 NE Birchfield Ct, Camas, WA 98607", in its item-7 position, without the ScopeChip beside it.
  - Foot: "Only FEMA can change this." and "How to request a Letter of Map Amendment · FEMA ↗".
  - No ScopeChip, because nothing is saved on this device yet.
- REDRAW deltas: (1) web-390 bottom sheet, not the iOS sheet; (2) Jordan's Zone AE payload; (3) the base's ScopeChip "Your household" is removed; (4) the base's "This isn't right" report control is left out (see Notes); (5) the address line is kept and reads "1107 NE Birchfield Ct, Camas, WA 98607", the address Jordan typed, shown only on his own screen; (6) date Mon 19 Oct, 6:11 PM.
- Does: taps Close. Focus returns to the Flood row.
- MOMENT OF TRUTH: "Disputes go to the authority. Pantopus never promises to check a FEMA zone."

11. Web-390 · f8-compare-sheet · 05-reciprocal-send-yours-back (REDRAW) → "11-inset share sheet" (REDRAW from 04-share-sheet-open). Label: "Mon 19 Oct, 6:12 PM · Jordan".
- Does: taps "Send yours back", leaves the toggle Off, and taps "Send my card". In the share sheet he picks Messages, then Ana, and writes "Moved in! This is our new area."
- Shows, in order, in the sheet's own forms:
  - Title "Send yours back".
  - Made-from line: "Made from 1107 NE Birchfield Ct, the address you just typed. The address stays off the card."
  - The preview image, as the sheet draws it (720px text column). Sender line "A place in Camas, WA". Rows in the sheet's short forms: "Flood zone AE · 1% chance each year" · "Wildfire · Low · 2 of 5" · "Air on Mon 19 Oct · AQI 58 · Moderate" · "Radon zone 1 · highest (county)". Sources line "● Official · FEMA Sep 2021 · USFS 2023 · AirNow Mon 19 Oct · EPA county-wide".
  - Title line, as exported: "A place in Camas, WA · Yours?"
  - Description line, as exported, clamped to two lines: "Online or mail voter registration for Nov 3 must arrive by Oct 26 in Washington. Voter deadline: WA Secretary of State. Readings: FEMA, USFS, AirNow, EPA. …". A callout on this line reads: "Drawn as exported. The sheet's own headline rule would leave this unverified seeded headline off, so the line would start at 'Readings: …'. The OG card carries it in another form (frame 12). See check 6."
  - "pantopus.com".
  - Privacy line: "This card shows readings and your city, never your address. Anyone with the link can see this card until Sat 19 Dec."
  - Toggle Off; the URL row "pantopus.com/start?vs=eyJ2IjoxLCJjIjoiQ2FtYXM…"; "Works for 61 more days"; then "Send my card" and "Cancel".
- REDRAW deltas: (1) flood row "Flood zone AE · 1% chance each year", replacing "Flood zone X · minimal hazard" (the AE short form is invented, following the sheet's pattern); (2) wildfire row "Wildfire · Low · 2 of 5", replacing "Wildfire · Moderate · 3 of 5"; (3) air row "Air on Mon 19 Oct · AQI 58 · Moderate", replacing "Air on Mon 19 Oct · AQI 42 · Good", on the matching AqiBand hue; (4) time 6:12 PM. The title, made-from line, title line, description, privacy line and expiry stay as exported.
- "11-inset share sheet" REDRAW deltas: (1) the dimmed sheet behind is this frame's reciprocal sheet (title "Send yours back", the reciprocal made-from line, "Send my card"), replacing "Compare with a friend"; (2) its rows carry deltas 1–3 above; (3) the share sheet shows Messages → Ana.
- Carried: a new token made from the typed, unsaved PLACE B address (no name, expiring Sat 19 Dec; whether the voter headline travels is check 6). Event: t0_share_clicked {method: 'compare'}, anon_id B. This is the compare term of the next cycle. When the sheet closes, focus returns to "Send yours back".
- MOMENT OF TRUTH: "It is clear which address the card is made from, and that address still never appears on it. The privacy line and the name toggle are restated for the new sender."

12. (Ana lane) iOS (Ana's iPhone) · f8-og-compare-card in an iMessage thread (REDRAW: the 02-imessage-bubble geometry with the 03-valid-anonymous image) → "12-arrival": web-390 · f8-compare-arrival-header · 05-anonymous (REDRAW, thumbnail size). Label: "Mon 19 Oct, 7:02 PM · Ana".
- Shows: Jordan's message "Moved in! This is our new area.", then the unfurl with the 03-valid-anonymous image (OG layer-word forms, Jordan's readings) and the og:title "What's on record at a place in Camas, WA. Yours?". Beside the frame, print its og:image:alt exactly: "Readings for a place in Camas, WA, as of Mon 19 Oct 2026. Official readings: flood Zone AE, 1% chance each year, FEMA; wildfire hazard Low, 2 of 5, USFS; air quality index 58, Moderate, on Mon 19 Oct, AirNow; radon Zone 1, highest potential, county-wide, EPA. Next to it: Yours?" Also beside it, print the og:description form for check 6: "Online or mail voter registration for Nov 3 must arrive by Mon 26 Oct in Washington (Washington Secretary of State · on record, not confirmed). Readings: …".
- Frame 12 REDRAW deltas: (1) the thread holds one message, Jordan's "Moved in! This is our new area.", replacing Dana's two messages; (2) the unfurl uses the 03-valid-anonymous image, replacing 01-valid-named; (3) the title line "What's on record at a place in Camas, WA. Yours?", replacing "What's on record at Dana's place. Yours?"; (4) sender name Jordan Lee in the thread header; (5) time Mon 19 Oct, 7:02 PM.
- In "12-arrival", the collapsed line above Ana's focused field reads "A place in Camas, WA · Flood AE · Wildfire Low · Air 58 on Mon 19 Oct · Radon Zone 1 ›". "12-arrival" REDRAW deltas: (1) the collapsed line readings, replacing the export's; (2) any freshness line or "as of" date reads Mon 19 Oct; (3) the field description "Compare with a card from Camas, WA"; (4) Ana's phone, 7:02 PM.
- Carried: only Jordan's token. Event: t0_compare_viewed, anon_id C. This is the hop for Jordan's card.
- MOMENT OF TRUTH: "The next stranger sees a place and its readings, never a person's house. Nothing on Ana's screen tells her Jordan's street."

TIME GAP 3, before step 13: "Back to Jordan · 6:14 PM (before Ana opens her card at 7:02 PM)".

13. Web-390 · ext:start-wallbar on f8-compare-reveal → the existing register page → the existing sign-in page → "13-landing": f8-compare-reveal · 11-signed-in-already-saved (REDRAW). Dashed alternative landing: "13-alt". Label: "Mon 19 Oct, 6:14 PM · Jordan".
- Does (back on Jordan's phone): taps "Keep this address handy" in the WallBar. The existing register page opens with the address carried. He taps its existing "Sign in" link and signs in with the account he created on Sat 10 Oct. Draw both pages as "existing screen, not redesigned", each with the carried line "1107 NE Birchfield Ct, Camas, WA 98607".
- Shows ("13-landing"): the same reveal, with the token and the typed address still in place, and no WallBar. The AddressChip duplicate row reads "You already saved this as “1107 NE Birchfield Ct”", with the action "See Today" (PLACE B is already Today's place). "Only you will see this." sits 8pt below it. REDRAW delta, one only: the export prints "· Use for Today" and this frame prints "· See Today". Highlight the changed action with an ink keyline and point it to check 11.
- Shows ("13-alt", a dashed alternative landing tagged "Founder decision"): f1-save-confirmation's duplicate variant (REDRAW from web-390 03-saved). In order: the tick and the title "Saved privately"; the AddressChip duplicate variant, message only ("You already saved this as “1107 NE Birchfield Ct”", inline action hidden); the primary "See Today"; the secondary "Claim this address" with "A separate step, only if you live here."; the tertiary "See your places"; and the caption "Only you will see this." "13-alt" REDRAW deltas: (1) title "Saved privately" kept (assumption: the place is saved, so the title stays true); (2) the address line replaced by the AddressChip duplicate message; (3) the body "Today now uses this address, and so will any reminders you turn on." removed, because Today already used it (assumption); (4) no "Email confirmed." status line, because he arrived from sign-in; (5) "Claim this address" and "See your places" kept unchanged; (6) date Mon 19 Oct, 6:14 PM, replacing Sat 10 Oct. Draw a dashed arrow from sign-in to "13-alt", labelled "f1-save-confirmation says sign-in runs the save on arrival and lands here (see check 11)".
- Carried: the account session. anon_id B is linked to Jordan's user at sign-in, and no second SavedPlace is created.
- MOMENT OF TRUTH: "The account ask names the benefit and nothing more. There is no claim or Founding promise, because founding_open is false in this lane (a disputed fixture, see check 10). Signing in never costs him the reveal or makes him retype the address."

14. Web-390 · f1-today-tab · saved place (REDRAW from ios 02-saved-place-quiet into the web-390 shell with the bottom tabs Place · Today · Nearby · Mail). Label: "Mon 19 Oct, 6:15 PM · Jordan".
- Does: taps "See Today".
- Shows: the location row "1107 NE Birchfield Ct" · ScopeChip "Saved place · Only you". The AqiBand at "AQI 58 · Moderate". Hollow Thursday pickup marks, frequency Not set, and the "Set your pickup day" button in the strip. The QuietDayReceipt "weather 5:45 PM · air 5:00 PM · alerts 6:00 PM · your calendar 6:00 PM".
- REDRAW deltas: (1) the web-390 shell; (2) no FirstWeekRow. His 7-day window from the fixture save date, Sat 10 Oct, ended Sat 17 Oct. The base export uses Sat 17 Oct as his save date and shows FirstWeekRow "Next: set your pickup day →". Point this delta to check 21. (3) AqiBand "AQI 58 · Moderate", replacing the fixture AQI 42 · Good, so it matches frame 8; (4) receipt "air 5:00 PM", replacing "air 7:00 AM".
- MOMENT OF TRUTH: "Today runs on the place he already saved. The compare visit added nothing he has to clean up."

LAYOUT
- Artboard names: storyboard artboards use "storyboard" in the platform slot of the house ARTBOARDS convention. Each frame keeps its source artboard name, with its own platform, as a visible label above it, plus its REDRAW or SPECIMEN tag. Frame insets use the names "11-inset share sheet", "12-arrival", "13-landing" and "13-alt", so they never read as board names.
- Use one wide board per lane, read left to right. Frames are at 50% scale: web-390 frames at 195×422, iOS frames at 197×426, and OG canvases at 600×315 when shown bare. Below each frame, place a step badge ("1", "2" … "14") and its time stamp.
- Time runs left to right on every lane and never goes backwards.
  - The main lane is Dana, then Jordan: steps 1–11, then 13–14.
  - Ana's step 12 and "12-arrival" sit on a separate Ana lane directly below the main lane. It branches down from step 11 with the arrow "Messages to Ana".
- Arrows between frames are 2px text.secondary, and each is labelled with its trigger: "tap Compare with a friend" · "toggle On + type Dana" · "tap Share" · "Messages · Sat 12 Sep" (ends at time gap 1's dashed rule; a matching stub restarts after it) · "tap the card (opens Safari, not the app)" · "tap field + pick suggestion" · "tap See your place" · "scroll" · "tap Flood row" / "Close" · "tap Send yours back" · "tap Send my card → Messages to Ana" · "Ana taps the card · 7:02 PM" · "tap Keep this address handy" · "Sign in" · "tap See Today".
- A time jump is a labelled gap: a 48px break in the lane with a dashed vertical rule and the gap label. No arrow crosses a gap; an arrow ends at the rule and a stub restarts after it. There are three gaps:
  - "Five weeks later · Mon 19 Oct, 6:08 PM", between steps 4 and 5 on the main lane.
  - "Same evening · 7:02 PM · Ana's phone", at the start of the Ana lane, before step 12.
  - "Back to Jordan · 6:14 PM (before Ana opens her card at 7:02 PM)", between steps 11 and 13 on the main lane.
- A person strip runs above the lanes (Dana → Jordan → Ana, and Jordan again). Each frame gets a device tag: "Dana's iPhone · Safari", "Jordan's iPhone · Messages / Safari" or "Ana's iPhone · Messages".
- Margin lane (top): one moment-of-truth callout per step, drawn as a raised card (radius lg). Each has a heading in h3 (20/28/600) with no KindGlyph, "Moment of truth · step N", and is tied to its frame by a 1px leader line. Put the step's metric event in the same card on a caption-type line (12/16/400), for example "t0_share_clicked · method compare · anon A".
- REDRAW deltas sit in the frame's gutter as a numbered list in caption type (12/16/400); each delta that feeds a handoff check ends with "→ check N".
- Failure lane (bottom): branch frames at 50%. Each branches down from the step where it starts, with a labelled arrow ("cancel", "token expired", "typo"), and rejoins the happy path with an upward arrow labelled "rejoins at step N". A branch that ends the journey ends in a flat terminal bar labelled with where the person is left.
- Use only house tokens. Callouts sit on surface.raised, and lanes on surface.app. No colour carries meaning on its own: every arrow and callout has words.

FAILURE BRANCHES (draw each one, with its recovery and the surface it lands on)
Sender side, Dana, Sat 12 Sep. B1, B2, B4, B5 and B6 are REDRAW frames with delta set D1–D6 (plus the named state from frame 3 when the toggle is On); print the deltas in each gutter.
- B1 · Share cancelled, or no share targets (AbortError). Lands on f8-compare-sheet 08-share-cancelled (REDRAW, D1–D6): "Link ready. Share it again or copy it.", with Copy link visible and no error glyph. Recovery: Share again (rejoins at 4), or Copy link and paste it into Messages (rejoins at 5). Mark on the frame: "Each Share again or Copy link tap fires another t0_share_clicked(method=compare) for the same card (see metric question)."
- B2 · No system share (an in-app browser or a desktop browser). Lands on 09-no-system-share (REDRAW, D1–D6), with Copy link as the primary, then the 07-copied state (web-1440, REDRAW, D1–D6, tagged "desktop variant: if Dana were on a laptop") "Link copied" / "Copied". Rejoins at 5.
- B3 · Slow link creation. Lands on 03-minting (the frame 3 inset, REDRAW): Share disabled, "Making your link…". Rejoins at 3 once the link exists.
- B4 · Link creation error. Lands on 10-mint-error (REDRAW, D1–D6): "We couldn't make your link. Check your connection, then try again." · Try again, with "Share needs a link first." The preview stays. Rejoins at 2.
- B5 · Rate limited. Lands on 11-rate-limited (REDRAW, D1–D6): "Lots of requests from this network in the last minute. Try again in a minute.", with a clock glyph and no countdown. "Try again" appears after 60 seconds. Rejoins at 2.
- B6 · Offline. Lands on 12-offline (REDRAW, D1–D6): "You're offline. Compare needs a connection." The preview stays. The journey pauses here and resumes at 2 when she is back online.
- B7 · Dana uses the iOS app instead. f8-native-share-compare ios 01-idle, with the f8-seasonal-aha ios 18-voter-7-days card above it, then 03-compare-share-sheet with the header "A place in Camas, WA · Yours?". The native card is always anonymous, and its caption reads "The compare card shows your city and your readings — never your address, and no name." Android equivalent: 10-sharesheet, "Compare your place with mine". SPECIMEN: label every B7 frame "native specimen, Mon 19 Oct, not Dana's date". A Sat 12 Sep native send would carry the ranked radon card in the native layout, not the voter card, and its expiry would not be the specimen's "until Mon 2 Nov". Rejoins at 5 with the anonymous title. Margin note: "Native sends are not counted in spread yet (no native emitter). This undercounts rather than inflates."
Link side, Jordan:
- B8 · Expired or tampered token (example: Jordan opens it on Fri 13 Nov). The bubble shows the generic card from f8-og-compare-card 05-fallbacks, with og:title "See what's true about your address." The link lands on f8-compare-arrival-header 07-expired: "That comparison link has expired. Type an address to see your own place." · Close, above the ordinary hero. Recovery: he types his address and lands on the ordinary /start preview, drawn as "existing screen, not redesigned" with its WallBar "Keep this address handy" and no compare block. Label the join "rejoins at step 13 (WallBar on the ordinary preview; no compare table)". Margin: "No t0_compare_viewed is counted for an expired token." This needs confirming (see Notes).
- B9 · The token can't be checked (server error). Lands on 09-couldnt-open: "We couldn't open this card just now." · Retry. No readings are shown, and the field stays live. Retry rejoins at 6. If he types an address instead, the journey continues as in B8.
- B10 · Offline on arrival. Lands on 08-offline: the collapsed line stays, with "You're offline. We can't look up an address right now." The field and the button are disabled but still focusable. Rejoins at 6 when he is back online. No spinner ever hangs.
- B11 · Jordan has the iOS app installed. The link still opens Safari, because no universal link is defined. Rejoins at 6. Margin: "The native funnel is bypassed. The web compare pages must carry the app download link."
- B12 · Autocomplete finds nothing for the typed text. Lands on 11-no-match: "We couldn't find that address. Check the spelling, or enter it line by line." · "Enter it line by line". Dana's line stays. Rejoins at 7.
Reveal side:
- B13 · A submitted address can't be located ("1107 Birchfeld, Camas"). Lands on f8-compare-reveal 05-geocode-failed: "We couldn't find "1107 Birchfeld, Camas". Check the spelling, or enter it line by line." The field is pre-filled and focused. Dana's pointers stay, the You lanes are empty but keep full height, and there is no WallBar. The funnel does not reset. Fixing the typo rejoins at 8.
- B14 · Unsupported region ("Vancouver, BC"). Lands on 06-unsupported-region: "We can't read records outside the US yet. Try a US address. Dana's card is still here." Rejoins at 8.
- B15 · The same band on every fixed-data row, the most common case (Jordan's readings equal the fixture readings; specimen air "AQI 42 · Good · 5:00 PM today"). Lands on 02-same-band: merged pointers and "Same band" on flood, wildfire and radon, with the summary "Same band on flood, wildfire and radon." Air still shows two dated pointers. There is no FEMA next-step row. Rejoins at 9.
- B16 · A layer is missing for Jordan. Lands on 07-layer-missing: "Not on record here" on radon, with a greyed lane, no chip and the same row height. Rejoins at 9.
- B17 · Offline after the reveal. Lands on 09-offline: "You're offline · as of 6:10 PM". The WallBar shows "Saving needs a connection.", and "Send yours back" shows "Compare needs a connection."; both are disabled but focusable. "Share this address" stays enabled. Rejoins at 11 when he is back online.
- B18 · The preview has no sections. Lands on 08-legacy-tiles: the compare block stays, with the legacy tiles below it. Rejoins at 11.
- B19 · Jordan cancels the reciprocal share sheet. Lands on the 08-share-cancelled state as the reciprocal sheet (REDRAW). Gutter deltas: (1) title "Send yours back", replacing "Compare with a friend"; (2) made-from line "Made from 1107 NE Birchfield Ct, the address you just typed. The address stays off the card.", replacing "Made from 1107 NE Birchfield Ct. The address stays off the card."; (3) the rows carry frame 11's deltas 1–3 (Jordan's readings in the sheet's short forms); (4) the primary reads "Send my card" where the base shows Share; (5) time 6:12 PM. "Link ready. Share it again or copy it." and Copy link stay. Rejoins at 11.
- B24 · Jordan taps "Share this address" instead. The system share sheet opens with a link that includes his address, as the action's caption says. This is not a compare send, so no t0_share_clicked(method=compare) fires. The branch ends at the system share sheet.
- B25 · Which sheet does a row tap open? x-provenance-sheet web-390 25-frozen-compare-flood draws Dana's frozen Flood row ("Dana · Camas, WA — what's on record for this area" · "as of Sat 12 Sep 2026", no report control). The reveal says a row tap opens the sheet for Jordan's address. Draw both side by side under step 10, tagged "Founder decision".
Account side:
- B20 · Signed in and not yet saved (a variant in which Jordan never saved). Lands on f8-compare-reveal 10-signed-in: "Save this address" in the host PlaceHeader, and no WallBar. The destination is undefined, so draw the arrow to a dashed box labelled "f1-save-confirmation 03-saved? (open)".
- B21 · Founding is open on the typed address's block. Lands on f8-compare-reveal 12-founding-open, with f9-founding-meter-preview 06-wall-open-slots beside it. The wall line is "3 Founding Neighbor slots are still open on this block." Never "You two are on the same block", and nothing depends on where Dana lives. Continues into flow-06 (claim). Tag this branch with the CTA, date and fixture conflict from check 10: in f9's specimen, PLACE B's block is open on Mon 19 Oct, so by f9's rule frames 8 and 13 would show this line.
- B22 · The recipient is new (Ana taps her own WallBar after typing her address in "12-arrival"). Goes from the existing register page, with the address carried, to f1-email-verify-handoff 01-sent-saved (REDRAW for Ana), then continues as flow-01 from step 5. Gutter deltas: (1) the saved address reads Ana's invented "3315 NE Cedar Hollow Dr, Vancouver, WA 98682", replacing "1107 NE Birchfield Ct"; (2) the email address reads "ana@example.com", replacing Jordan's; (3) date Mon 19 Oct, 7:05 PM, replacing Sat 10 Oct; (4) the device is Ana's iPhone (web-390). Nothing on this frame shows Jordan's street. Label the join "→ flow-01 step 5".
- B23 · Jordan signs in to a different account on the phone. Lands on f1-save-confirmation 06-account-switched, which visibly refuses to save and offers "Switch account". SPECIMEN: label it "specimen: Sat 10 Oct, web-1440 export, not Mon 19 Oct on Jordan's phone; shown for the refusal only".

HANDOFF CHECKS (drawn on two boards: 11-handoff-checks-a holds checks 1–10 and 12-handoff-checks-b holds checks 11–22. Each check is one row with the frame crops side by side. Each crop shows the export's own string next to any redrawn string, so every mismatch stays visible. Highlight the disputed string with an ink keyline, never by colour alone.)
1. Frames 3, 5 and 6 must agree on the sender strings "Dana · Camas, WA" and "What's on record at Dana's place. Yours?". The flows-spec and design-doc strings "Maya" and "What's true about Maya's place. Yours?" are retired.
2. Frames 2, 5, 6 and 8 must agree on the row values, because the sheet preview and the OG card are the same PNG. Show side by side: frame 2's sheet short forms ("Flood zone X · minimal hazard", "Air on Sat 12 Sep · AQI 42 · Good", "Radon zone 1 · highest (county)") and its 720px text column; frame 5's OG layer-word forms ("Flood · Zone X — minimal flood hazard", "Air · AQI 42 · Good · on Sat 12 Sep", "Radon · Zone 1 — highest potential (county)") and its 760px column; and frame 8's "Zone X — minimal flood hazard" and "Zone 1 — highest potential (county)". Never "Zone X — minimal" or "Zone 1 — highest". The same break repeats on frame 11 (sheet) vs frame 12 (OG) for Jordan's rows, including the invented short form "Flood zone AE · 1% chance each year".
3. Frames 2, 5, 6 and 8 must agree on freshness. Dana's air is dated Sat 12 Sep everywhere: "Air on Sat 12 Sep · AQI 42 · Good" (sheet), "Air · AQI 42 · Good · on Sat 12 Sep" (OG image), "Air 42 on Sat 12 Sep" (collapsed line), "Dana's card · as of Sat 12 Sep" (header) and "▼ Dana · as of Sat 12 Sep" (reveal legend). Never "Air today" or "AirNow, today". Frame 8 draws the frozen and live AQI on one track only, with both dates and the "Different days" note.
4. Frames 8, 11, 12 and 14 must agree on Jordan's readings (Zone AE; Low · 2 of 5; AQI 58 on Mon 19 Oct). Show the unchanged export crops beside the redrawn ones: f8-compare-sheet 05-reciprocal shows the fixture values (Zone X, AQI 42), and f1-today-tab 02-saved-place-quiet shows AQI 42 with "air 7:00 AM".
5. Frame 11 and frame 12 must agree on the anonymous title line. Frame 11 (f8-compare-sheet, as exported) and f8-native-share-compare use "A place in Camas, WA · Yours?", while frame 12 (f8-og-compare-card's og:title) uses "What's on record at a place in Camas, WA. Yours?". Frame 2 shows the same sheet form for Dana. The founder picks one, and all three surfaces follow it.
6. Frames 9, 11 and 12 must agree on whether an unconfirmed voter headline travels, and in what form. Show four crops side by side:
  - Frame 11, the f8-compare-sheet export: "Online or mail voter registration for Nov 3 must arrive by Oct 26 in Washington. Voter deadline: WA Secretary of State. Readings: FEMA, USFS, AirNow, EPA. …".
  - f8-compare-sheet's own headline rule: an unverified seeded headline is left off the token, so the line starts at "Readings: …". The export contradicts its own rule.
  - Frame 12, the og:description: "… by Mon 26 Oct in Washington (Washington Secretary of State · on record, not confirmed). Readings: …".
  - Frame 9's source caption "○ On record, not confirmed · Washington Secretary of State" vs f8-seasonal-aha's "Washington Secretary of State · statewide · as of Mon 19 Oct" (house invariant 5: authority · scope · as-of).
  The date form also differs: "by Oct 26" in the sheet and the aha, "by Mon 26 Oct" in the reveal and the OG card.
7. Frame 11 and "12-arrival" must agree that the card is made from the typed, unsaved address (1107 NE Birchfield Ct). The made-from line, the privacy line and the toggle must be restated for Jordan.
8. Frames 2 and 11 and branch B7 must agree on expiry. The web sheet uses 61 days ("until Thu 12 Nov" for Dana, "until Sat 19 Dec" for Jordan), while f8-native-share-compare says "until Mon 2 Nov". The token lifetime is a single product value.
9. Frame 3 and frame 12 (web) must agree with branch B7 (native) on the name. Web can add a first name; native is always anonymous, and its caption says so.
10. Frames 1, 8 and 13 and branch B21 must agree on the first account ask.
  - Frame 1 (delta 4), frame 8 and frame 13: the WallBar reads "Keep this address handy" · "Today and a night-before pickup reminder run on it." unless founding_open is true. Show beside frame 1 the host's existing wall, "Keep this address handy." + "Continue" (as f9-founding-meter-preview's attachment gives it), whose filled button is "Continue".
  - When founding_open is true, f8-compare-reveal uses "Claim this address and be one of the first here" with "Closes Fri 6 Nov". f9-founding-meter-preview parks that CTA, keeps "Continue", and dates PLACE B's block window "closes Sun 25 Oct", with 3 of 5 slots open.
  - f8-native-share-compare's wall says "Keep this address handy." · "Continue". f8-seasonal-aha's follow-up says "Keep this address to set a reminder before Mon 26 Oct".
  - Fixture conflict: the PLACE B block is open in f9 (day 15 of 21, 2 slots taken, 3 open, closes Sun 25 Oct), but closed in flow-05. By f9's rule, the slot line would replace "Keep this address handy" in frames 8 and 13. Show f9's 06-wall-open-slots crop beside frame 13's WallBar.
  One wording, one date, one fixture state.
11. "13-landing", the dashed "13-alt" and frame 14 must agree on where sign-in lands and on the duplicate action.
  - Landing: when /start → Keep this address handy → sign in reaches an address that is already saved, where does it land? On f8-compare-reveal 11 (back on the reveal with the AddressChip duplicate row), or on the f1-save-confirmation duplicate variant (primary See Today)? f1-save-confirmation says sign-in runs the save on arrival and lands on its own screen, and flows-spec routes step 13 into flow-01 step 5, which ends on the save confirmation.
  - Action: the f8-compare-reveal 11 export prints "· Use for Today". f1-save-confirmation says the primary is "See Today" when the place is already Today's. "13-landing" is redrawn with "See Today". Show the export crop beside it.
  - "13-alt" has no export; its title and removed body are assumptions.
  - The destination of the signed-in "Save this address" (B20) is undefined.
12. Frame 8 and frame 10 must agree on FEMA's date. The header, reveal and og:description say "effective Fri 24 Sep 2021", while the fixture, the sheet sources line and the provenance sheet say "Effective Sep 2021". Frame 10 must also drop the ScopeChip "Your household" that its iOS base carries, because nothing is saved on /start.
13. Frame 8 and frame 10 must agree on what a row tap opens (see B25).
14. Frame 6 and the recipient field on Foundations board 00a-08 must agree on the privacy line under the field: "We don't post this anywhere. Nobody sees what you look up." vs "Only you will see this." A related wording gap: "13-landing"'s scope caption "Only you will see this." vs flows-spec's "Only you can see this."
15. Frame 5 and branch B8 must agree that a bad token unfurls as the existing fallback card, never an error image, and that the header shows the quiet V5 banner, not an error page.
16. Branches B5 and B7 must agree on the rate-limit copy: "Lots of requests from this network in the last minute. Try again in a minute." (web) vs "Too many links just now. Try again in a few minutes." (native).
17. Branch B22 and flow-01 step 5 must agree that the typed address is held on the server at registration (not only on the device), and that the email link lands on f1-save-confirmation 03-saved with "Email confirmed.", never on the pre-save Save button. If Ana's address were outside Clark County, f1-add-place-sheet must not refuse an address that /start accepted ("We only cover Clark County, Washington right now.").
18. Frames 6 and "12-arrival" must agree on the collapsed-line form from flows-spec. "Air on Sep 12 · 42" is retired in favour of "Air 42 on Sat 12 Sep" and "Air 58 on Mon 19 Oct".
19. Frame 8 and flows-spec step 8 must agree on marks. "Maya's filled mark and his ringed You mark" is retired: sender and You are labelled pointers of the same shape, and filled vs hollow means provenance only.
20. Frame 1 and frames 2, 5 and 6 must agree on the radon headline, because the token carries the headline Dana saw. Show the strings side by side:
  - Frame 1's aha: "Clark County is EPA Radon Zone 1 — highest potential (county).", with the detail "County zone from EPA. It says nothing about your home's level; only a test does." and the source "Official · EPA · county-wide estimate — only a test tells you about this home", with no "as of" date.
  - The token headline in frame 2's description, frame 5's og:description and frame 6's header: "Clark County is in EPA radon Zone 1 — highest potential. Only a home test can tell."
  - Three caption forms that disagree: frame 1's "Official · EPA · county-wide estimate — only a test tells you about this home" (no date); frame 2's sheet form "Radon zone: EPA." (invented); and frame 6's arrival-header caption, exactly "● EPA · county-wide estimate · as of Sat 12 Sep".
  Flag the header's "as of Sat 12 Sep" as part of the same founder decision: frame 1 omits a date because the EPA county map dates from its 1993 publication (x-provenance-sheet P5), while the header dates the card's freeze.
21. Frame 14 and f1-today-tab 02-saved-place-quiet must agree on Jordan's save date: Sat 10 Oct (fixture) vs Sat 17 Oct (the f1-today-tab delta). The date decides whether FirstWeekRow shows on Mon 19 Oct. Put both crops side by side: frame 14 without FirstWeekRow, and the export with "Next: set your pickup day →". Also show the save-path split: f1-save-confirmation and f1-email-verify-handoff draw him saving through registration (this storyboard assumes registration on his laptop), while f1-add-place-sheet draws him saving from Your places at 6:10 PM Sat 10 Oct. The founder picks one date and one path for all of Jordan's journeys (flow-01, 05, 06, 09 and 14).
22. Frame 1 and the component contract must agree on the WallBar footer. f8-compare-sheet keeps "Share this address" and the app-download link in the web WallBar footer unchanged; the TextActionRow contract says "No actions inside the sticky WallBar."; f8-native-share-compare moved Android's "Share this address" out of the wall. Show frame 1's footer beside the Android before/after. The founder decides whether the web WallBar footer may keep "Share this address".

ACCESSIBILITY IN THE JOURNEY (the 14-access-path board: the 14 happy-path frames at 25%, each with a focus ring drawn where focus lands and a speech-bubble caption for what is announced)
- After 1 → 2: focus moves into the sheet's title "Compare with a friend" and is trapped in the sheet. The image's text alternative begins "Card preview: a place in Camas, WA. Flood zone X, minimal flood hazard, official …".
- Step 3: switching the toggle On moves focus to the empty First name field. After the link is made again, the image's text alternative begins "Dana, Camas, WA". Announce "Making your link…" politely, only if making the link takes 1 second or more.
- Step 4: the system share sheet takes focus. On return, focus is on Share. A cancel politely announces "Link ready. Share it again or copy it."
- Step 5: VoiceOver reads the title line "What's on record at Dana's place. Yours?". og:image:alt carries every reading in words and no address. At AX5, the title line wraps without cutting off "Yours?" (f8-og-compare-card 08-imessage-ax5).
- Step 6: focus lands in the autofocused field, whose description reads "Compare with Dana's card from Camas, WA". The collapsed line is a button with aria-expanded, named "Dana, Camas, WA: Flood X, Wildfire Moderate, Air 42 on Sat 12 Sep, Radon Zone 1. Dana's card as of Saturday 12 September. Show readings."
- Step 7: the suggestions are a listbox, and Enter submits. Reading order below the field: privacy line, then contrast line.
- Step 8: focus moves to the table heading "Dana's card and your place", with the polite status "Your readings are ready." Each row is one element, for example: "Flood zone, different band. Dana, as of 12 September: Zone X, minimal flood hazard, band 1 of 3, official. You, today: Zone AE, 1% chance each year, about 1 in 4 over 30 years, band 3 of 3, official. FEMA, effective 24 September 2021." A visually hidden table repeats the facts.
- Step 9: scrolling does not move focus; it stays on the table heading until the person moves it. In reading order after the table come "What Zone AE means · FEMA ↗" (announced as opening FEMA's site), the voter aha with its unconfirmed source, "Check or update at VoteWA ↗", then "Send yours back" and "Share this address" with their captions. Scroll padding keeps the WallBar from hiding focus.
- Step 10: focus moves into "Where this fact comes from". Escape or Close returns focus to the Flood row. The outbound rows sit outside the row targets.
- Step 11: focus moves to the title "Send yours back", and returns to the "Send yours back" action when the sheet closes.
- Step 12: VoiceOver on Ana's phone reads the title line "What's on record at a place in Camas, WA. Yours?". In "12-arrival", focus lands in her field, whose description reads "Compare with a card from Camas, WA".
- Step 13: after the WallBar tap, focus moves to the first field of the existing register page, and the carried address line is read before it. After he taps that page's "Sign in" link, focus moves to the first field of the existing sign-in page. After sign-in, focus returns to the duplicate row, and "Only you will see this." is read after it. In the "13-alt" alternative, focus starts on the page title "Saved privately".
- Step 14: focus moves to the Today location row, which is read as "1107 NE Birchfield Ct, visible to only you".
- Without notifications: no step in this journey depends on a push. Every hop is carried by a person through a messaging app, so the whole flow completes with notifications off on every device. The sender is never told that a card was opened. There is no "Jordan viewed your card" push, because it is not one of the five notification groups and it would leak activity. One push may fire as a side effect: Jordan's step 13 sign-in on a new browser counts as a new sign-in, so under brief §3 (Account & security: "Sign-in, invitations to you", Time Sensitive, HIGH, on by default; f4-notification-settings "Sign-ins and invitations to you") any other device where he has the app with notifications on gets a new-sign-in notification. It is not drawn, not a return trigger, and the flow completes the same with it off. Jordan's later return triggers (the night-before pickup push, the widget) belong to flow-01 and flow-07 and are not asked for here.
- Reduce Motion: the sheet fades instead of sliding, the reveal is one cross-fade, and chevrons do not rotate.
- On the same board, show frames 6 and 8 at 200% text (f8-compare-arrival-header 13-text-200, f8-compare-reveal 14-text-200), and frames 2 and 8 in greyscale. Every difference must still read in words.

INSTEAD OF
- Instead of Maya as the sender and 6207 NE 42nd Ave as the recipient's address, use Dana (FRIEND C) and PLACE B — because every screen project was drawn on the fixtures, and the founder must be able to attach its exports unchanged.
- Instead of rewriting the aha card in frame 1 with the token's wording, keep the seasonal-aha strings and flag the mismatch at check 20 — because a silent rewrite hides a real break between what Dana saw and what her card says.
- Instead of drawing the sheet preview in the OG card's forms, keep each surface's own row, title and description forms — because a silent swap would make the check 2, 5 and 6 crops look identical and hide the break.
- Instead of placing another person's export on a lane unchanged, redraw it with that lane's data and numbered deltas, or label it a specimen — because Jordan's street on Dana's lane, or on Ana's, reads as a leak.
- Instead of a continuous lane from Dana's tap to Jordan's open, draw the five-week gap — because a frozen card opened weeks later is the real freshness test.
- Instead of putting Ana's 7:02 PM open in the middle of Jordan's 6:14 PM steps, give her a separate lane — because time must never run backwards along a lane.
- Instead of a filled sender mark and a ringed You mark, draw labelled pointers — because filled vs hollow already means official vs unconfirmed.
- Instead of sending Jordan's card straight back to Dana, send it to Ana — because a hop only counts when it reaches a new person.
- Instead of routing the WallBar tap into registration for Jordan, route it through sign-in to the duplicate row, with f1-save-confirmation's landing drawn as a dashed alternative — because he already saved PLACE B on Sat 10 Oct, and the two surfaces disagree on where he lands.
- Instead of drawing a FirstWeekRow on Jordan's Today, leave it off and flag the date at check 21 — because his 7-day window from the fixture date ended Sat 17 Oct.
- Instead of a same-block Founding line, draw the typed block's slot line only when founding_open is true — because the token has no location, and the line would reveal where Dana lives.
- Instead of an error image or an error page for a bad token, draw the fallback card and the quiet banner — because a stranger's chat is where the product can least afford to look broken.
- Instead of colour-coding lanes or branches, label them in words — because the board must read in greyscale.
- Instead of redesigning any screen, place the exports and change only the listed strings — because this project checks the joins, not the screens.

DONE WHEN
- All 14 happy-path frames are placed in order, each with a time stamp and trigger-labelled arrows. Time runs left to right on every lane. The three labelled time gaps are drawn, no arrow crosses a gap, and every step has a moment-of-truth callout.
- Dana's address appears only on her own screens (frames 1–4, the frame 3 inset and B1–B6). Jordan's address never appears in frame 12, "12-arrival" or B22. No frame says anything about a person's house.
- No frame on a lane carries another person's data or date unless it is labelled SPECIMEN (B7, B23).
- Frame 1 keeps the f8-seasonal-aha radon strings (the "Zone 1" chip, headline, detail line, and the "Official" source caption with no "as of" date), shows the WallBar change as delta 4, and its mismatch with the token headline is shown at check 20.
- Frames 2, 3 and 11 keep f8-compare-sheet's own row, title and description forms; frames 5 and 12 keep the OG forms; every mismatch between them is shown on the handoff boards.
- The sender strings and freshness labels in frames 2, 3, 5, 6 and 8 match character for character, or each mismatch is shown on the handoff boards.
- Jordan's readings are the same in frames 8, 11, 12 and 14.
- No frame prints a placeholder token. Every drawn URL uses "pantopus.com/start?vs=eyJ2IjoxLCJjIjoiQ2FtYXM…".
- Every REDRAW frame (1, 2, 3 and its inset, 4, 10, 11 and "11-inset share sheet", 12, "12-arrival", "13-landing", "13-alt", 14, B1, B2, B4, B5, B6, B19, B22) lists its deltas in the gutter, and the same list is on the Notes artboard.
- Every failure branch (B1–B25) is drawn, with its landing artboard named and a "rejoins at step N" or terminal label. The B7 and B23 frames are labelled as specimens.
- All 22 handoff checks are drawn across 11-handoff-checks-a and 12-handoff-checks-b.
- The metric trace shows t0_aha_viewed (A) → t0_share_clicked compare (A) → t0_compare_viewed (B) → t0_aha_viewed with vs (B) → t0_share_clicked compare (B) → t0_compare_viewed (C), with k's three terms marked, and the repeat-send events from B1 and B2 marked.
- The accessibility board shows where focus lands after every transition (steps 1–14, including step 9 and both existing pages in step 13), and states that the journey works without notifications, including the sign-in side effect.
- Every invented string is on the Notes artboard.

ARTBOARDS
1. flow-05 · storyboard · 01-overview · light — the whole journey at 25%: the person strip, the main lane, the Ana lane, the failure lane, all three time gaps, and the step numbers. In the failure lane, the branch numbers B1–B25 appear as numbered placeholders at their start steps only (the branch frames are drawn in turn 2).
2. flow-05 · storyboard · 02-sender-mints · light — steps 1–4 (Dana, Sat 12 Sep) with their callouts and gutter deltas, the frame 3 inset, and the check-20 highlight on frame 1.
3. flow-05 · storyboard · 03-unfurl-and-arrival · light — time gap 1, then steps 5–7.
4. flow-05 · storyboard · 04-reveal-and-source · light — steps 8–10, with the 04-loading inset and the B25 pair beneath step 10.
5. flow-05 · storyboard · 05-send-yours-and-hop · light — step 11 and "11-inset share sheet" on the main lane (6:12 PM), and the Ana lane below it with time gap 2 (7:02 PM), step 12 and "12-arrival".
6. flow-05 · storyboard · 06-keep-and-today · light — time gap 3 (6:14 PM), step 13 (WallBar → register → sign-in → "13-landing", with the dashed "13-alt" tagged "Founder decision"), and step 14.
7. flow-05 · storyboard · 07-fail-sender · light — B1–B7, rejoining steps 2–5.
8. flow-05 · storyboard · 08-fail-link · light — B8–B12, rejoining steps 6, 7 and 13 (B8 on the ordinary /start preview).
9. flow-05 · storyboard · 09-fail-reveal · light — B13–B19 and B24, rejoining steps 8, 9 and 11.
10. flow-05 · storyboard · 10-fail-account · light — B20–B23, with the exits to flow-06 and to flow-01 step 5.
11. flow-05 · storyboard · 11-handoff-checks-a · light — checks 1–10, as paired crops.
12. flow-05 · storyboard · 12-handoff-checks-b · light — checks 11–22, as paired crops.
13. flow-05 · storyboard · 13-metric-trace · light — events by step and anon_id (A is Dana, B is Jordan's phone, C is Ana). The k formula has each term's numerator and denominator pointing at the frames that fire them. Mark: session_open {trigger: 'compare'} at step 6; native sends (B7) not counted; expired tokens (B8) not counted; B24 is not a compare; the extra t0_share_clicked(method=compare) events from B1 (Share again, Copy link) and B2 (Copy link) for the same token, drawn as a stack on that token's single send with the note "inflates compares, lowers hop, unless de-duplicated per token".
14. flow-05 · storyboard · 14-access-path · light — focus and announcements for all 14 steps, the statement that the journey works without notifications (with the new-sign-in side effect), and the 200% and greyscale crops.
15. flow-05 · Notes — list:
- Artboard naming: storyboard artboards use "storyboard" in the platform slot of the house convention "<surface-id> · <ios|android|web-390|web-1440> · <NN-state> · <light|dark>". Each frame keeps its source platform label. The frame insets are named "11-inset share sheet", "12-arrival", "13-landing" and "13-alt".
- Invented strings:
  - "918 NE Alder Crest Way, Camas, WA 98607" (Dana's address; confirm it is not a real Camas parcel, or replace it) and "Made from 918 NE Alder Crest Way. The address stays off the card."
  - "3315 NE Cedar Hollow Dr, Vancouver, WA 98682" (Ana's address, B22; confirm it is not a real parcel, or replace it) and "ana@example.com".
  - The frame times: Sat 12 Sep 9:40 AM (steps 1–3) and 9:41 AM (step 4); Mon 19 Oct 6:08 PM (Dana's text), 6:09 PM (steps 5–6), 6:10 PM (steps 7–9), 6:11 PM (step 10), 6:12 PM (step 11), 6:14 PM (step 13), 6:15 PM (step 14), 7:02 PM (Ana, step 12) and 7:05 PM (Ana, B22).
  - The messages "Once you're in Camas, try yours.", "Settled in? Try yours." and "Moved in! This is our new area."
  - The name Ana.
  - The expiries "until Thu 12 Nov" and "until Sat 19 Dec" (61 days, from f8-compare-sheet), and the expired-open date Fri 13 Nov.
  - Dana's sheet description line, including the topic source "Radon zone: EPA."
  - The sheet short form "Flood zone AE · 1% chance each year" and "Air on Mon 19 Oct · AQI 58 · Moderate" / "Air on Sat 12 Sep · AQI 42 · Good".
  - The collapsed lines for Jordan's card.
  - The three gap labels, "existing screen, not redesigned", the specimen labels and "desktop variant: if Dana were on a laptop".
  - The truncated URL "pantopus.com/start?vs=eyJ2IjoxLCJjIjoiQ2FtYXM…", reused for both tokens because they differ only after the cut.
  - The field description "Compare with a card from Camas, WA" ("12-arrival").
  - "13-alt": the kept title "Saved privately" on a duplicate, and the removed body.
- REDRAW deltas (each also printed in its frame's gutter):
  - Shared set D (frames 2, 3, frame 3 inset, 4, B1, B2, B4, B5, B6): D1 made-from line → Dana's; D2 air row → "Air on Sat 12 Sep · AQI 42 · Good"; D3 sources line → "AirNow Sat 12 Sep"; D4 expiry → "until Thu 12 Nov"; D5 description → Dana's radon headline in the sheet form; D6 date → Sat 12 Sep.
  - Frame 1: (1) date Sat 12 Sep; (2) Dana's address in PlaceHeader; (3) the compare row if missing; (4) the WallBar button "Keep this address handy" with the benefit line, replacing "Keep this address handy." + "Continue". The radon card is unchanged.
  - Frame 2: D1–D6 only.
  - Frame 3 and its 03-minting inset: D1–D6, plus "Dana" in the field, sender line "Dana · Camas, WA", title line "What's on record at Dana's place. Yours?" (the inset skips the title line).
  - Frame 4: D1–D6, plus the named state behind the share sheet.
  - Frame 10: web-390 bottom sheet; Jordan's Zone AE payload; ScopeChip removed; report control removed; address line kept; date.
  - Frame 11: flood, wildfire and air rows → Jordan's readings in the sheet's short forms; time. Description kept as exported (check 6).
  - "11-inset share sheet": the reciprocal sheet behind, with Jordan's rows; Messages → Ana.
  - Frame 12: one message from Jordan; 03-valid-anonymous image; the anonymous og:title; sender Jordan Lee; 7:02 PM.
  - "12-arrival": Jordan's collapsed line; Mon 19 Oct freshness; field description; Ana's phone, 7:02 PM.
  - "13-landing": "Use for Today" → "See Today".
  - "13-alt" (no export): title kept; address line → duplicate message; body removed; no "Email confirmed."; Claim and See your places kept; date Mon 19 Oct.
  - Frame 14: web shell; FirstWeekRow removed (Sat 10 Oct save date); AqiBand AQI 58 · Moderate; receipt "air 5:00 PM".
  - B19: title "Send yours back"; reciprocal made-from line; Jordan's rows; "Send my card"; time.
  - B22: Ana's address; ana@example.com; Mon 19 Oct 7:05 PM; Ana's iPhone.
- Specimens (placed unchanged, labelled): B7 (native, Mon 19 Oct, not Dana's date); B23 (Sat 10 Oct web-1440, not Mon 19 Oct on Jordan's phone).
- Recast:
  - flows-spec's Maya (sender), 6207 NE 42nd Ave, Vancouver and "A place in Vancouver, WA · Yours?" are replaced by Dana, PLACE B, and the two existing anonymous title lines "A place in Camas, WA · Yours?" (sheet, native) and "What's on record at a place in Camas, WA. Yours?" (OG), pending check 5.
  - The reciprocal card goes to Ana, a new person, not back to Dana.
  - The flows-spec flood aha (step 9) is replaced by the voter aha, with the FEMA next step above the divider.
  - Ana's open sits on its own lane so that time never runs backwards.
- Assumptions:
  - Dana's Sat 12 Sep aha is the ranked radon card (the voter card starts Sep 20, and AQI 42 is under the 101 air-card threshold), drawn with the f8-seasonal-aha strings.
  - founding_open is false on the happy path. This is a disputed fixture, not a settled fact; see check 10.
  - Jordan's readings are the f8-compare-reveal specimen values, not the house fixture readings.
  - The provenance sheet on /start shows no ScopeChip but keeps the typed address line.
  - Reporting from /start while signed out is not drawn ("This isn't right" is left out of frame 10). Confirm whether a signed-out viewer may report "We matched the wrong spot".
  - The B7 native frames are Mon 19 Oct specimens, not Dana's Sat 12 Sep send.
  - A new-browser sign-in sends an Account & security new-sign-in notification to Jordan's other app devices, if any; the flow does not depend on it. Confirm the channel.
- Metric questions:
  - The hop attribution window must be at least the token lifetime (61 days), or Jordan's open, 37 days after the send, is lost.
  - Repeat sends: each Share again or Copy link tap (B1, B2) fires another t0_share_clicked(method=compare) for the same card, which inflates the compare term and lowers hop. Decide whether compares are de-duplicated per token (count one send per token, or count distinct tokens).
  - Confirm that anon_id B is linked to Jordan's user at sign-in, so his reveal is not double-counted as a new visitor.
  - Confirm that expired-token visits do not fire t0_compare_viewed.
  - Native sends are not counted until a native emitter exists.
- Token schema: each layer needs the band index, the printed value, the air observation date, the source dates and a confidence field. The design doc's letter grades cannot draw these rows. The headline string the token carries must be decided (check 20), and whether unverified seeded headlines travel (check 6).
- Founder decisions, from the handoff checks:
  - one row form for the sheet preview and the OG card, and one column width (check 2)
  - the anonymous title line (check 5)
  - whether unconfirmed headlines travel, their description form, the voter date form and the voter source caption (check 6)
  - the token lifetime (check 8)
  - the wording of the first account ask (including frame 1's WallBar change), the Founding date, and whether PLACE B's block is open on Mon 19 Oct (check 10)
  - where sign-in lands for an already-saved address (f8-compare-reveal 11 or the f1-save-confirmation duplicate variant), the duplicate action, the "13-alt" title and body, and the destination of the signed-in "Save this address" (check 11, B20)
  - the FEMA date form (check 12)
  - the row-tap payload (check 13, B25)
  - the recipient field privacy line and the scope-caption wording (check 14)
  - the rate-limit copy (check 16)
  - one radon headline for the aha and the token, and whether its caption carries an "as of" date (check 20)
  - Jordan's save date (Sat 10 Oct or Sat 17 Oct) and his canonical save path (registration on the laptop, or Your places), for flow-01, 05, 06, 09 and 14 (check 21)
  - whether the web WallBar footer may keep "Share this address" (check 22)
- Fixtures to verify: the FEMA effective date for Zone X/AE ("Sep 2021" vs "Fri 24 Sep 2021"); the EPA radon map date (published 1993).
- Omitted:
  - Dark twins (every surface project already carries its own).
  - Android recipient frames (the compare link always opens the web).
  - Desktop 1440 lanes (the 03-both-revealed-wide and 06-desktop-idle exports cover them).

BATCH PLAN: Turn 1: artboards 1–6 (01-overview shows branch numbers as placeholders only), then wait for "continue". Turn 2: artboards 7–10 (the four failure boards), then wait for "continue". Turn 3: artboards 11–13 (11-handoff-checks-a, 12-handoff-checks-b, 13-metric-trace), then wait for "continue". Turn 4: artboards 14–15 (14-access-path and Notes).
