# flow-06 · Saved place → claim → claim receipt with what carried over (journey storyboard)
id: flow-06 · platforms: ios · artboards: 9

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

JOURNEY: flow-06 · Saved place → claim → claim receipt with what carried over

TYPE: NEW (storyboard). Every screen in this journey was already designed in its own project. Do not redesign any screen here. Lay the screens out as one connected sequence, so the founder can check three things: what is carried from each step to the next, what the person sees at each moment of truth, and where each failure branch leads. Where an attached export disagrees with this prompt, follow this prompt (the recast below) and list the disagreement on the Notes artboard.

ARTBOARD NAMING: Storyboards use "storyboard" in the platform slot of the house-style name, so every artboard here reads "flow-06 · storyboard · <NN-name> · light". Frames inside an artboard keep their own source names in their labels.

ATTACH (exported artboards, by exact name):
- f1-your-places · ios · 01-multi-place · light
- f1-your-places · ios · 02-single-place-menu · light (source for the iOS pull-down menu form)
- f1-your-places · ios · 04-home-outranks · light (layout of the "Your home" and "Saved places" groups)
- f1-your-places · android · 05-just-claimed · light ("Claimed …" row, with no duplicate saved row)
- f1-your-places · web-390 · 20-claim-notice-arrival · light (branch C3)
- f3b-verify-address-sheet · ios · 10-postcard-confirm · light (redraw reference for step 2b)
- f3b-verify-address-sheet · ios · 11-postcard-pending · light (redraw reference for steps 2c and 4, and branch C12)
- f3b-verify-address-sheet · ios · 12-wrong-code · light (branch C11)
- x-place-file · android · 09-postcard-pending · light (redraw at iOS width for step 3)
- x-place-file · ios · 02-saved-place-first-week · light (saved-place grammar, year band with the county-lane caption, Thanksgiving move)
- x-place-file · ios · 06-claim-receipt-banner · light
- x-place-file · ios · 11-all-known · light (the confirmed Proof row "Address confirmed by postcard · …", and the home year band)
- f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now · light (gap inset, with its reminder ask)
- f4-briefing-optin-card · web-390 · 07-pickup-ask-declined · light (step 9 briefing card: night-before row absent, morning row asking; draw at iOS width)
- f5-today-calendar-strip · ios · 03-saved-place-unconfirmed · light (Jordan's renters-insurance row)
- f1-claim-receipt · ios · 03-only-you-so-far-pending · light
- f1-claim-receipt · web-1440 · 01-only-you-so-far-pending · light (margin reference: the web receipt carries the same rows)
- f1-claim-receipt · web-1440 · 05-revisited-sam-pending · light
- f1-claim-receipt · web-1440 · 06-revisited-choice-results · light
- f1-claim-receipt · web-1440 · 07-choice-results-at-claim · light
- f1-claim-receipt · web-390 · 08-carry-failed · light
- f1-claim-receipt · web-390 · 09-nothing-to-carry · light
- f1-claim-receipt · web-390 · 13-different-address · light
- f1-claim-receipt · web-390 · 14-existing-keeper · light
- f1-claim-receipt · web-1440 · 15-place-file-banner-and-row · light
- f1-claim-receipt · web-390 · 16-loading · light
- f1-claim-receipt · web-390 · 17-offline · light
- f1-claim-receipt · ios · 18-ax5 · light (lane 08 sample)
- f1-today-tab · ios · 13-after-claim · light
- f1-today-tab · ios · 02-saved-place-quiet · light (section order reference)
- f1-today-tab · ios · 14-after-join · light (C3 frame 2: the two-line notice with "See your places" and the "Dismiss" glyph)
- f11-keeper-strip · ios · 13-saved-place · light
- f11-keeper-strip · ios · 11-removed-undo · light (handoff check 17: the household form of Remove, recast to Pepper)
- f11-keeper-naming · ios · 09-saved-place · light
- f11-keeper-naming · ios · 11-rename · light
- x-date-sheet · ios · 06-view-mine-warranty · light (the view-mine layout with "Visible to")
- x-date-sheet · ios · 19-saved-lease-saved-place · light (Jordan's lease values)
- f7-today-widget · ios · 05-evening-confirmed · light
- f6-home-basics-rows · ios · 04-not-set · light
No export exists for these frames. Redraw each one from the description given here, using only Foundations components and the attached host screens:
- ext:claim-verify-flow · method choice (step 2a). This is the existing claim-and-verify flow in the Pantopus design system. If you have its host screenshot, keep it exactly and add only the one line given in step 2a.
- x-place-file · iOS · postcard pending (step 3): the Android export 09 redrawn at 393x852.
- The already-claimed branch (C4) and the expired-code error line (C12).
The postcard confirm, the postcard-pending state and code entry are not undescribed host screens: redraw them from the attached f3b-verify-address-sheet frames 10, 11 and 12, recast to Jordan. This storyboard reads f3b's postcard states as reused inside the claim flow, and the place file's "Enter your code" opens f3b's postcard-pending state (11), as f3b's own "Enter code" caller does. List on Notes that f3b says a saved-place-only person never reaches that sheet (handoff check 30).
RECAST RULE FOR EXPORTS: the claim-receipt exports, the f3b postcard exports, the home-group exports of Your places, the place-file banner export and the keeper Remove export were drawn for Maya Chen or Sam Ortega at HOME A. In this storyboard, redraw each of those frames for Jordan Lee at PLACE B using the deltas below. Keep each export's layout, components and row grammar exactly. Change only names, the address, dates, counts and the keeper.
BRANCH FRAMES: each lower-lane branch frame is its main-lane parent (or its named export) with only the listed delta changed. Do not recompose anything else.

MAIN LANE PLATFORM: iOS 393x852 for every happy-path frame; Jordan does this whole journey on his iPhone. Every web-390 export named for a frame here is recast at iOS width (393x852). Add one margin note beside step 5: "The same rows appear on web 1440 (f1-claim-receipt · web-1440 · 01-only-you-so-far-pending) and on Android (f1-claim-receipt · android · 04-only-you-so-far-pending)."

PLACE TAB ROOT (one reading, used in every frame): Jordan has no claimed home until step 4, so his Place tab opens on Your places (f1-your-places: "this list is the tab's first screen" for anyone with no claimed home). He reaches the place file by tapping Open on a row. After the claim, the Place tab opens on his home's place file, and Your places is a pushed screen with the back chevron "Place" (step 10). x-place-file calls itself the Place tab index for everyone; list this merge conflict on Notes.

PERSONA & SITUATION
Jordan Lee, 36, lives at PLACE B: 1107 NE Birchfield Ct, Camas, WA 98607. He moved from Portland, OR on Fri 9 Oct and saved Birchfield on Sat 10 Oct. His 7-day first week therefore ended on Sat 17 Oct, so no frame dated Mon 19 Oct or later shows the "Set up your place" block or a FirstWeekRow.
What he holds at the saved place, which is what the claim must carry:
- Pickup day: Thursday, per the City of Camas. On TODAY (Mon 19 Oct) it is hollow, with "how often: Not set". On Wed 21 Oct at 6:12 PM he taps "Yes, Thursday is right" on Today (flow-02). From then on the pickup day carries the tick "You added this · Thursday". Recycling stays "Recycling: Not set", because confirming sets the weekday only. The reminder ask then opens inside the pickup card, and he taps "Not now" (InlineUndo "No reminder for now · Undo"). That answer closes the briefing card's night-before row for good; the morning row still asks.
- Holiday move at PLACE B, from the city's published holiday schedule: Thanksgiving is Thu 26 Nov 2026, so pickup moves to Fri 27 Nov ("Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar"). This is an illustrative fixture to verify against the real City of Camas calendar (Notes).
- Two dates he entered:
  - "Renters insurance renews" · Fri 30 Oct 2026 · "Repeats yearly".
  - "Lease ends" · Wed 31 Mar 2027, with 30 days' notice. Its linked Notice deadline is Mon 1 Mar 2027, with a reminder on Sat 30 Jan 2027 (14 days before). The Notice deadline moves with its lease row.
- Keeper (phase 2): Pepper, a Red fox, named at PLACE B before Wed 21 Oct.
- Move-in date: Not set. The place file shows "Moved in · Not set · Add". (A saved place can hold a move-in date; Jordan has not set one.)
- Four other saved places, all saved on Sun 18 Oct, after his first week: Mom's house (Camas, WA 98607); The Blairmont rental (Vancouver, WA 98683); Sister's apartment (Portland, OR 97214); Grandma and Grandpa's lake house on Lacamas Shores Drive (Camas, WA 98607). Birchfield, saved at sign-up on Sat 10 Oct, is his first place.
- Count, by the x-place-file count rule (facts the place holds plus the pickup record; county and state rules are shown but not counted; the keeper and the widget are not counted; a confirmed Proof fact is not counted either, which this storyboard states on Notes): "5 on file", with pips Place · Dates. Place holds the address and the pickup day (Moved in is Not set, so it is not counted). Dates holds renters insurance, the notice deadline and lease ends. The count is the same before and after the claim.
- ONE DATE-COUNTING RULE (used everywhere): the notice deadline is counted as its own fact in FactCount (so "5 on file"), but it is excluded from the "N dates" wording in claim copy, because it moves with its lease row. So every claim string says "2 dates" (renters insurance and lease ends).
- A medium widget on his iPhone, labelled "Birchfield Ct".
- Notifications: the system has never asked him. He declined the reminder ask on Wed 21 Oct, so nothing in this journey arrives by push. The postcard comes by paper mail.
Why he claims: he wants to add a housemate later and use Mail Day, and both need a claimed home.
RELATIVE DATES: every date more than 30 days out is written in days ("in 133 days"), never months, in every frame (decision recorded on Notes).
TIMELINE. Every frame prints its own date and time in a time chip.
- Sun 18 Oct, 8:40 PM, the evening before TODAY: he starts the claim.
- TODAY, Mon 19 Oct, 6:10 PM: he checks the pending state.
- Wed 21 Oct, 6:12 PM: he confirms Thursday and declines the reminder ask.
- Wed 28 Oct, 6:08 PM: the postcard arrived today, and he enters the code.
- Thu 29 Oct, 7:30 PM: he revisits what moved and shares one date.

GOAL: Upgrade the bookmark to a home without losing anything he typed, and let him decide for himself whether his dates become visible to the household.

METRIC (first-person-loop §5 and §1):
- Week-four return. The facts he invested at T1 survive the claim, so his reasons to come back survive too.
- The Honesty bar from §1: no silent scope change.
- Secondary (indirect): Activation. Jordan's own 7-day activation window closed on Sat 17 Oct, and he is alone in the household after the claim, so this claim does not move his Activation. It makes the household fact "a second active occupant" possible later, which matters for future movers who claim within 7 days of creating an account.
Measurement gap, for Notes: §5 has no event for a scope change. Propose two events, claim_carry {carried, failed} and date_visibility_changed {from, to, source: receipt | date_sheet}, so Honesty can be counted for this journey.

THE HAPPY PATH (14 steps; the moment-of-truth callouts MT1 to MT14 go in the margin lane above their frames)

Step 1 · iOS · Sun 18 Oct, 8:40 PM · f1-your-places · 01-multi-place, with the row menu open (menu form from 02-single-place-menu)
- Does: taps the Place tab, which opens on Your places (the tab's first screen for him), opens "More for 1107 NE Birchfield Ct" on the Birchfield row and taps "Claim this address".
- Shows:
  - Title "Your places", with the ScopeChip "Saved place · Only you" under it. No back chevron: this is the tab root.
  - The Birchfield row first, with the StatusChip "Used for Today" and, under it, "Today uses the address you saved most recently."
  - The other four rows, newest first, then "+ Add a place".
  - The iOS pull-down menu on Birchfield: Open · Claim this address · Remove. The badged row never offers Use for Today.
- Carries → step 2: the saved place and its address, "1107 NE Birchfield Ct, Camas, WA 98607".
- MT1: Claiming is a deliberate, separate action in a row menu. It is never the default path of a button labelled "Preview" or "Save".

Step 2 · iOS · Sun 18 Oct, 8:41–8:42 PM · three frames side by side (2a, 2b, 2c)
- 2a · 8:41 PM · ext:claim-verify-flow · method choice (no export; redraw). The host method screen with the address. Add one line under the postcard option, in bodySmall text.secondary with an info glyph: "When your address is confirmed, your pickup day, dates and keeper move to your home. Nothing is shared until you choose." The method screen never checks or says whether anyone already has a household at this address (see C4).
- 2b · 8:41 PM · f3b-verify-address-sheet · 10-postcard-confirm (recast). He taps Postcard; the inline confirm reads "We'll mail a code to 1107 NE Birchfield Ct" · "Send postcard". He taps "Send postcard". One light haptic tick plays.
- 2c · 8:42 PM · f3b-verify-address-sheet · 11-postcard-pending (recast, as of Sun 18 Oct). Heading "Your postcard is on its way."; dates "Mailed Sun 18 Oct (today) · expected by Fri 30 Oct (in 12 days) · code works until Tue 17 Nov (in 30 days)"; field "Code from your postcard" with "Check code"; the late path "Didn't arrive by Fri 30 Oct? Send a new code", disabled, with "Available after Fri 30 Oct. Your first code will stop working."; then "Or verify another way". He closes the sheet.
- Carries → step 3: the pending claim (method: postcard; requested Sun 18 Oct; expected Fri 23–Fri 30 Oct; code expires Tue 17 Nov). Nothing moves yet, and the scope stays "Saved place · Only you".
- MT2: Before he commits, the flow says what will happen to his saved-place data, and the pending state shows up on both the sheet and the place file's Proof row. The window's wording differs between the two (handoff checks 27–29).

TIME GAP: "Next evening · TODAY Mon 19 Oct, 6:10 PM"

Step 3 · iOS · Mon 19 Oct, 6:10 PM · x-place-file · 09-postcard-pending (the Android export redrawn at iOS width)
- Does: taps the Place tab (Your places), then Open on the Birchfield row, to check on the postcard.
- Shows, in the x-place-file phone order:
  - Back chevron "Your places". Header: "Your place file" · "1107 NE Birchfield Ct" · "Camas, WA 98607" · ScopeChip "Saved place · Only you" · FreshnessLine "Updated just now" · FactCount "5 on file" (pips Place · Dates) · the legend.
  - No LandingBannerSlot.
  - Year band card "The year ahead", Oct 2026 to Sep 2027, in the 02-saved-place-first-week grammar:
    - You (tick): Oct (renters insurance, Fri 30 Oct) · Mar with count "2" (notice deadline Mon 1 Mar, lease ends Wed 31 Mar); the caption row holds "Reminder Mon 15 Feb" under the Mar cell.
    - Your city: Thursday service weeks as the saved-place export draws them (not yet confirmed); the Nov cell shows the moved mark over a struck ghost, and the band caption reads "Thanksgiving week: pickup moved to Fri 27 Nov".
    - Your county: the caption "County dates aren't available for a saved place" and no marks.
    - Your state: full-lane-height bars in Oct (Mon 26 Oct) and Nov (Tue 3 Nov).
    - Today rule, and the "Next 14 days" shade Mon 19 Oct–Sun 1 Nov.
  - Next for this place (standalone, directly under the band, because the Set up block ended with the first week): "Set your pickup day" · filled button "Set pickup day" (primary.700). It is the first undone first-week step.
  - No Set up block.
  - Place:
    - "Pickup day · Thursday · how often: Not set" with the hollow mark and "City of Camas · pickup Thursdays · not yet confirmed", then "Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar" (the city's published holiday schedule).
    - "Moved in · Not set · Add".
  - Dates:
    - the voter row, "Online or by mail · in 7 days · must arrive by Mon 26 Oct";
    - "Renters insurance renews · in 11 days · Fri 30 Oct" with a tick;
    - "Tell your landlord in writing by Mon 1 Mar 2027 · in 133 days · Mon 1 Mar 2027";
    - "Lease ends · in 163 days · Wed 31 Mar 2027".
    - No per-date chips, because this is a saved place. No county rows.
  - Proof:
    - a LockedActionRow (pending, no link): "Postcard requested Sun 18 Oct · expected Fri 23–Fri 30 Oct · code expires Tue 17 Nov";
    - under it, the outlined button "Enter your code", which opens f3b's postcard-pending state (step 4);
    - the disabled "Send a new code", with "You can ask for a new code after Fri 30 Oct."
  - Money and People: "Claim this address first".
  - Footer: "Only you will see this."
- Draw this frame full-length (scroll frame).
- Carries → step 4: the same pending claim. "Enter your code" is the way back in.
- MT3: The delivery window has a real upper bound (Fri 30 Oct). "Send a new code" stays disabled, with its reason shown, until that date has passed.

TIME GAP: "Two days later · Wed 21 Oct, 6:12 PM". Inside the gap, draw a small inset of f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now, captioned "flow-02: Jordan confirms Thursday, then declines the reminder ask. From here on, his pickup day carries the tick." The inset shows two states stacked:
- The confirmed card as the export draws it: "Garbage tomorrow", "✓ You added this · Thursday", "Recycling: Not set", "Saved to your calendar. Only you.", footer "Only you will see this.", then the reminder ask "Remind you the night before? 6:00 PM" with the PushCopy tray preview "Garbage tomorrow" / "Bins out tonight · Birchfield Ct" (street label shown because Jordan has more than one place; a recast of export 07, which draws no label) and the three equal buttons "Turn on reminders", "Not now", "No thanks". A tap marker sits on "Not now".
- After the tap: the ask collapsed to the InlineUndo "No reminder for now · Undo". No system dialog fired.
Under the inset, a Carries card: "Pickup day confirmed (weekday only; frequency still Not set). 'Not now' is stored and closes the briefing card's night-before row. The morning row still asks."
TIME GAP: "One week later · Wed 28 Oct, 6:05 PM · the postcard arrived today"

Step 4 · iOS · Wed 28 Oct, 6:08 PM · f3b-verify-address-sheet · 11-postcard-pending (recast, as of Wed 28 Oct), then code check
- Does: taps the Place tab (Your places), opens Birchfield, taps "Enter your code" on the place file, types the code into "Code from your postcard" and taps "Check code".
- Shows: heading "Your postcard is on its way."; dates "Mailed Sun 18 Oct (10 days ago) · expected by Fri 30 Oct (in 2 days) · code works until Tue 17 Nov (in 20 days)"; the field with the typed code; "Check code", which briefly reads "We're checking your code…"; the disabled late path "Didn't arrive by Fri 30 Oct? Send a new code" with "Available after Fri 30 Oct. Your first code will stop working."; "Or verify another way". The success screen that follows is step 5.
- Carries → step 5: the server does all of the following in the same transaction.
  - Confirms the address (method: postcard; date: Wed 28 Oct).
  - Creates the home, and only now checks whether the address already has a household (C4, C5).
  - Copies the pickup day, the 2 dates and Pepper to home scope.
  - Sets both dates to "Only you" until he chooses.
  - Retires the Birchfield SavedPlace row.
  - Rewrites the widget snapshot.
  It then hands the receipt the carried items, any failed item, and the household, which is Jordan alone.
- MT4: The carry succeeds or fails as one unit. Either everything moved, or the receipt names what did not (branch C1). A half-claimed state is never shown.

Step 5 · iOS · Wed 28 Oct, 6:09 PM · f1-claim-receipt · 03-only-you-so-far-pending (recast; drawn full-length as a scroll frame)
- Shows, top to bottom:
  - The host seal, headline and subline, unchanged.
  - Caption: "Address confirmed by postcard · Wed 28 Oct".
  - Summary: "Your pickup day, 2 dates and Pepper came with you."
  - Section label "Came with you", with the header "Was" + ScopeChip "Saved place · Only you" (struck) → "Now" + "Your household".
  - Four manifest rows:
    1. "Pickup day" · "Thursday · recycling: Not set · next pickup tomorrow" · ProvenanceMark "You added this" · caption "Everyone in this household will see this." · scope pair person → house · scope caption "Only you → Your household".
    2. "Renters insurance renews" · "in 2 days · Fri 30 Oct" · caption "Repeats yearly" · tick · scope pair person → dashed house · scope caption "Only you → Your household · waiting for your choice".
    3. "Lease ends" · "in 154 days · Wed 31 Mar 2027" · caption "Notice due Mon 1 Mar 2027 · reminder Sat 30 Jan 2027" · tick · the same pending pair and scope caption as row 2.
    4. "Pepper (your keeper)" · "Red fox" · the 24pt keeper avatar · caption "Everyone in this household will see this." · scope caption "Only you → Your household".
  - The legend "✓ You added this", printed once.
  - Consent block:
    - Question: "Share the 2 dates you entered with people who join this household?"
    - Caption: "It's just you here for now. Until you choose, only you will see them. You can change this for each date later."
    - Two peer buttons: "Share with the household" and "Keep them private to me".
  - FactCount "5 on file" (Place · Dates), with the link "See your place file".
  - Closing line: "Today now uses this home."
  - The host "Now available" list.
  - "Go to your place", outlined.
- Carries → step 6: a pending choice for 2 dates.
- MT5: The summary names 4 items (pickup day, 2 dates, Pepper), and exactly 4 rows are drawn. The question also says "2 dates". Nothing is shared yet: both date rows show the dashed house.

Step 6 · iOS · Wed 28 Oct, 6:09 PM · f1-claim-receipt · consent block (the step 5 frame as a 393x852 viewport, scrolled so the consent block is in view)
- Does: taps "Keep them private to me". One light haptic tick plays.
- Carries → step 7: both dates are set to Only you.
- MT6: Both buttons have equal weight. Leaving without choosing would also keep the dates private (branch C6), and the choice can be undone here and later for each date.

Step 7 · iOS · Wed 28 Oct, 6:09 PM · f1-claim-receipt · 07-choice-results-at-claim (the "Keep private" half, recast and drawn at iOS width)
- Shows:
  - Both date pairs now read person → person, with the scope caption "Only you · kept private".
  - Result line: "Only you will see these 2 dates. You can change this in each date. · Undo".
  - "Go to your place" is now filled in primary.700.
- Does: taps "Go to your place".
- Carries → step 8: the one-time claim banner is queued for the place file, and the persistent row "What moved when you claimed" now exists.
- MT7: The receipt states the result of his choice as a fact, and Undo stays on screen until he leaves.

Step 8 · iOS · Wed 28 Oct, 6:10 PM · x-place-file · 06-claim-receipt-banner (recast; full-length)
- Shows, in the x-place-file phone order:
  - Header: "Your place file" · "1107 NE Birchfield Ct" · "Camas, WA 98607" · ScopeChip "Your household" · "Updated just now" · FactCount "5 on file" (Place · Dates). This is now the Place tab root, so there is no back chevron.
  - LandingBannerSlot: "Your pickup day, 2 dates and Pepper came with you. · See what moved".
  - Year band card "The year ahead", in the 11-all-known home grammar:
    - You (tick): Oct (renters insurance) · Mar with count "2"; "Reminder Mon 15 Feb" under Mar.
    - Your city: Thursday service weeks drawn as confirmed (tick) where published and dashed "projected" after the last published calendar; the Nov cell keeps the Thanksgiving moved mark over its struck ghost and the caption "Thanksgiving week: pickup moved to Fri 27 Nov".
    - Your county (filled): Nov (property tax 2nd half, due Mon 2 Nov) · Apr (1st half) · Jul (appeal). The saved-place county caption is gone.
    - Your state: Oct and Nov bars.
    - Today rule, and the "Next 14 days" shade Wed 28 Oct–Tue 10 Nov.
  - Next for this place: "Set your pickup day" · caption "Thursday is set. How often does each bin go out?" · filled button "Set pickup day". It stays the Next row because the first-week step "Set your pickup day" is done only when the frequency is set and confirmed, and Jordan's frequency is still Not set. (The widget is already placed, the insurance date is on file and the address is now confirmed, so none of those would be chosen next anyway.)
  - No Just moved block (move-in Not set).
  - Place (the home-only rows Keeper, What moved and What neighbors see now appear):
    - "Pickup day · You · Thursday" with a tick, and "City of Camas · Recycling: Not set · you confirmed", then "Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar";
    - "Moved in · Not set · Add", with the helper "Add it to see a moving list for 60 days";
    - "Keeper · Pepper";
    - "What moved when you claimed · Pickup day, 2 dates and Pepper · Wed 28 Oct";
    - "What neighbors see · One public spot, the same every time", as the HOME A export draws it (confirm on Notes that it is absent at saved-place scope).
  - Dates, as of Wed 28 Oct:
    - "Register or update your voter registration" · "in 6 days · in person until 8:00 PM Tue 3 Nov" · "In person, Clark County Elections" · "Statewide — WA" · filled. The online-or-mail line is gone because Mon 26 Oct has passed.
    - "Renters insurance renews · in 2 days · Fri 30 Oct" · tick · per-date ScopeChip "Only you".
    - "Property tax, 2nd half · in 5 days · Mon 2 Nov" · filled · Clark County (new at home scope; no per-date chip; not counted).
    - "Tell your landlord in writing by Mon 1 Mar 2027 · in 124 days · Mon 1 Mar 2027" · tick · per-date ScopeChip "Only you".
    - "Lease ends · in 154 days · Wed 31 Mar 2027" · tick · per-date ScopeChip "Only you".
    - "Property tax, 1st half · in 184 days · Fri 30 Apr 2027" · filled · Clark County.
    - "Property-tax appeal date · in 246 days · Thu 1 Jul 2027" · filled · Clark County Board of Equalization.
  - Money (phase 2): "Add a bill from your mail · Open Mail Day".
  - People: the household block, "Who lives here with you?", with Invite by email / Share a link / Just me.
  - Proof: "Address confirmed by postcard · Wed 28 Oct 2026" (not counted in FactCount).
  - The grey "Not here — this is a saved place" row is gone.
- Carries → step 9: Today's location now resolves to the home.
- MT8: Money, People and Proof now show real asks or facts instead of "Claim this address first", the county lane and county rows fill in, and the receipt can be found again from its persistent row.

Step 9 · iOS · Wed 28 Oct, 6:11 PM · f1-today-tab · 13-after-claim, with f11-keeper-strip in slot 4b (full-length)
- Does: taps the Today tab.
- Shows, in the section order of f1-today-tab · ios · 02-saved-place-quiet:
  - Location row: "1107 NE Birchfield Ct" · ScopeChip "Your household" · "Updated just now".
  - Pinned slot: the LandingBannerSlot notice "Birchfield Ct is now your home · See what moved".
  - No FirstWeekRow.
  - PickupCard (confirmed variant): "Garbage tomorrow" · "Bins out tonight — curbside by 6:30 AM (City of Camas)" · "✓ You added this · Thursday" · "Recycling: Not set" · the single text button "Change pickup day" · footer "Everyone in this household will see this." No reminder ask (it was answered on Wed 21 Oct).
  - 14-day card, "Next 14 days: 5 items":
    - Thu 29 Oct: pickup (tick);
    - Fri 30 Oct: "Renters insurance renews" (tick; its SourceCaption ends with the person glyph and "Only you");
    - Mon 2 Nov: property tax 2nd half (filled; new at home scope);
    - Tue 3 Nov: the statewide bar;
    - Thu 5 Nov: pickup (tick).
  - Slot 4b (phase 2): KeeperStrip with Pepper in the Busy pose (holding a small stack of papers), "Busy · 3 things due in the next 7 days." and FactCount "5 on file". The three are pickup Thu 29 Oct (counted the day before), renters insurance Fri 30 Oct and property tax 2nd half Mon 2 Nov; voter rows are excluded by f11's mood rules.
  - Then weather, air (refreshed: "AirNow · observed 6:00 PM"), alerts, signals and tiles. Signals hold no property-tax heads-up: the 14-day card already holds Mon 2 Nov, and signals never repeat a section's fact.
  - Briefing card in its declined-at-pickup state (f4-briefing-optin-card 07-pickup-ask-declined, at iOS width): overline "Briefings", caption "For 1107 NE Birchfield Ct" (he has more than one place), no night-before row, the morning row "A morning heads-up?" · "Date reminders at 7:00 AM" · Yes / Not now / No thanks, the silence line and "Notification settings".
- Carries → step 10: tapping the location-row chip opens Your places (this storyboard applies f1-today-tab's chip route to a claimed home; see Notes). "See what moved" would reopen the receipt. The refresh has written a fresh widget snapshot.
- MT9: The change reads as "the chip changed and the household sections appeared". Nothing re-lays out and nothing is lost; the declined night-before row stays absent. The chip reads "Your household", because the contract replaces the flow's "no chip".

Step 10 · iOS · Wed 28 Oct, 6:12 PM · f1-your-places · the 04-home-outranks layout with the 05-just-claimed content (recast)
- Does: taps the location-row chip.
- Shows:
  - A pushed screen with the back chevron "Place".
  - Group "Your home": "1107 NE Birchfield Ct · Camas, WA 98607 · Claimed Wed 28 Oct", with the home glyph, ScopeChip "Your household" and the caption "Today uses your home".
  - Group "Saved places", with the header chip "Saved place · Only you": Mom's house, The Blairmont rental, Sister's apartment and the lake house, each with its saved date.
  - No saved Birchfield row.
- Carries: back to Place (the place file, now the tab root).
- MT10: The retired SavedPlace row never appears as a second copy of the same address.

Step 11 · iOS home screen · Wed 28 Oct, 6:15 PM · f7-today-widget · the 05-evening-confirmed layout (medium, 338x158, recast)
- Shows a before/after pair.
  - Left, captioned "Before the claim (snapshot written 6:08 PM, when he opened the app)": label "Birchfield Ct · Saved place · Only you".
    - KindGlyph (garbage) with the evening hero "Bins out tonight"; caption "Garbage · curbside by 6:30 AM tomorrow", then a tick and "You · Thursday · City of Camas".
    - Strip, Wed 28 Oct → Tue 10 Nov: Thu 29 tick · Fri 30 tick · Tue 3 Nov bar · Thu 5 Nov tick. No Mon 2 Nov mark: this storyboard follows x-place-file (a saved place has no county dates; see Notes for the f1-today-tab conflict).
    - A dimmed air row, "Observed 7:00 AM · AirNow — 11 hours ago".
  - Right, captioned "After the claim and the 6:11 PM Today refresh rewrote the snapshot": label "Birchfield Ct · Your household".
    - The same hero, caption and tick.
    - Strip: Thu 29 tick · Fri 30 tick · Mon 2 Nov filled (property tax) · Tue 3 Nov bar · Thu 5 Nov tick, the same 5 items as step 9's card.
    - The air row at full strength: "AQI 42 · Good · AirNow 6:00 PM".
  - Add an inset of the small widget before and after, where the scope glyph changes from person to house.
- MT11: The claim rewrites the snapshot at once. The street label stays "Birchfield Ct". The scope words (on the small widget, the glyph) change, and the county date appears because county dates exist only at a home.

TIME GAP: "Next evening · Thu 29 Oct, 7:30 PM"

Step 12 · iOS · Thu 29 Oct, 7:30 PM · x-place-file row → f1-claim-receipt · 06-revisited-choice-results (the "Keep private" half, recast)
- Does: taps the Place tab (the place file) and then "What moved when you claimed".
- Shows:
  - Page title "What moved when you claimed".
  - Caption "Address confirmed by postcard · Wed 28 Oct", then the summary.
  - Rows, with relative dates as of Thu 29 Oct:
    - pickup: "Thursday · recycling: Not set · next pickup in 7 days · Thu 5 Nov";
    - "Renters insurance renews · Tomorrow · Fri 30 Oct", "Only you · kept private";
    - "Lease ends · in 153 days · Wed 31 Mar 2027", "Only you · kept private";
    - Pepper.
  - In place of the question, the result line "Only you will see these 2 dates. You can change this in each date."
  - FactCount "5 on file".
  - No seal, no "Now available" list and no primary action. He leaves with the back control.
- Carries → step 13: back on the place file, the renters-insurance row with its per-date ScopeChip "Only you".
- MT12: The receipt can be found again, and it matches what the rows say today.

Step 13 · iOS · Thu 29 Oct, 7:31 PM · x-date-sheet · the 06-view-mine-warranty layout (recast to renters insurance)
- Does: on the place file, taps the per-date ScopeChip "Only you" on "Renters insurance renews". The DateSheet opens as the iOS large sheet, at its "Visible to" control. He taps "Household", then Save.
- Shows:
  - "Renters insurance renews" · "Tomorrow · Fri 30 Oct" · "Repeats yearly".
  - Reminder control for a date due tomorrow: the 60-day, 30-day, 7-day and 1-day leads are all disabled (the 1-day lead falls today, Thu 29 Oct, and 7:00 AM has passed), with one line under the control, "60, 30, 7 and 1 day have passed or fall today." Only the Day-of lead (Fri 30 Oct) is live, and it is selected.
  - "Visible to" ChoiceChips: "Only you" (selected when the sheet opens) · "Household".
  - Footer "Only you will see this.", which becomes "Everyone in this household will see this." after the switch.
  - After Save: the status line "Saved to your household calendar.", and the place-file row's chip now reads "Household".
  - The lease row stays "Only you".
- Carries → Today's strip: the renters-insurance row drops the person glyph and "Only you".
- MT13: He reverses the step 6 decline one date at a time, as easily as he gave it, and the other date is untouched.

Step 14 · iOS · Thu 29 Oct, 7:33 PM · f11-keeper-strip menu → f11-keeper-naming · 11-rename (recast)
- Does: on Today, opens "Pepper, keeper options" and taps Rename.
- Shows:
  - Behind the scrim, Today as of Thu 29 Oct: the KeeperStrip in the Busy pose with two items, "Busy · Renters insurance renews tomorrow. Property tax 2nd half is due in 4 days · Mon 2 Nov." (pickup Thu 5 Nov does not count yet; it counts only on Wed 4 Nov).
  - The naming sheet in Rename mode: title "Rename Pepper"; Red fox; the field, pre-filled "Pepper"; the scope line "Everyone in this household will see this."; the line "What it says is based on what each person can see."; primary "Save name"; Close.
- The two scope lines are a delta against the 11-rename export, which draws only the field (f11-keeper-naming requires the sheet to state the household scope after a claim); list it on Notes.
- MT14: The keeper survives the claim unchanged (still Pepper), and the change in who can see it is stated in words.

LAYOUT
- Each lane artboard is 2560px wide and as tall as its content, on surface.app.
- Main lane: phone frames drawn left to right at 50% scale (iOS 393x852 becomes 197x426; full-length frames keep their scroll length at 50%), with 320px between frame origins. Step 2's three frames sit side by side under one step label.
- Above each frame, print:
  - "Step N · <surface-id> · <state>" in label 13/18 text.strong;
  - a time chip, for example "Wed 28 Oct, 6:09 PM";
  - the export it comes from, in caption text.secondary, for example "from f1-claim-receipt · ios · 03-only-you-so-far-pending · recast". Redrawn frames say "redrawn, no export".
- Arrows between frames are 1.5px text.secondary lines, each labelled with its trigger: "tap Claim this address", "tap Postcard", "tap Send postcard", "close sheet", "paper mail arrives", "tap Enter your code", "type code → tap Check code", "code accepted", "tap Keep them private to me", "tap Go to your place", "tap Today tab", "tap location chip", "snapshot rewrite (no tap)", "tap What moved when you claimed", "tap per-date chip", "tap Pepper, keeper options → Rename". The arrows into steps 3 and 4 read "tap Place tab → Open on Birchfield".
- Under each arrow, draw a small "Carries:" card (surface.base, radius md 8, caption 12/16) listing exactly what that step's "Carries" line says.
- Time jumps are labelled gaps: a 64px column on surface.sunken with a dashed text.secondary edge and a vertical label ("Next evening · TODAY Mon 19 Oct, 6:10 PM"). The Wed 21 Oct gap widens to hold its two-state inset and its Carries card.
- Margin lane (above the main lane): one callout per moment of truth, on surface.base with a 2px info border and a numbered square badge (MT1 to MT14), joined to its frame by a leader line. Text is text.primary.
- Lower lane (below the main lane), headed "If this goes wrong": failure-branch frames at 50%, joined to the step they leave from by dashed arrows labelled with the condition. A dashed arrow runs back up to the step each branch rejoins, labelled "rejoins step N". A branch that ends somewhere else ends in a labelled terminal chip naming the surface it lands on.
- No product colour is used for annotations. Frames keep their own tokens.

FAILURE BRANCHES (draw each one in the lower lane of the lane artboard named in brackets; each frame changes only the listed delta from its parent)
C1 · A carry fails [lane 03]. Leaves step 4.
- Frame: f1-claim-receipt · web-390 · 08-carry-failed, recast at iOS width (393x852).
- The renters-insurance row fails and shows as an InlineErrorRow below the manifest: "We couldn't move your renters insurance date · Retry".
- Summary "Your pickup day, 1 date and Pepper came with you."; question "Share the date you entered with people who join this household?"; manifest of 3 rows.
- Recovery: Retry succeeds, the row joins the manifest and every count updates. Rejoins step 5. Never draw a quiet success with a row missing.
C2 · Nothing to carry [lane 03]. A frame-only what-if, in which Jordan had entered nothing.
- Frame: f1-claim-receipt · web-390 · 09-nothing-to-carry at iOS width (393x852): the plain host success screen plus "Today now uses this home."
- No empty list, no "0 items" and no consent block. Lands on step 8, without the banner.
C3 · A different address is claimed [lane 04]. Frame-only delta: in this branch Jordan never saved Birchfield, and his only saved place is Mom's house, which Today uses.
- Street form (one form in all three frames, recorded on Notes): the full street address and the saved-place name "Mom's house", as f1-claim-receipt and f1-your-places write it. f1-today-tab's Notes give the label form ("Today now uses Larkspur Loop. Mom's place is still saved."); list that as a conflict.
- Frame 1: f1-claim-receipt · web-390 · 13-different-address, recast at iOS width (393x852). The plain success reads "Today now uses 1107 NE Birchfield Ct. Mom's house is still saved." (it wraps).
- Frame 2: Today's one-time notice in the f1-today-tab · ios · 14-after-join form: the two-line "Today now uses 1107 NE Birchfield Ct. Mom's house is still saved." with the trailing 44pt action "See your places" and a 44pt close glyph labelled "Dismiss".
- Frame 3: tapping "See your places" (or the notice) lands on f1-your-places · web-390 · 20-claim-notice-arrival, recast at iOS width (393x852): the arrival line with its trailing "Close" above the "Your home" and "Saved places" groups (Saved places: Mom's house only), with focus on the arrival line.
- Dashed arrow labelled "rejoins step 10's layout (Saved places: Mom's house only)".
C4 · The address already has a household [lane 06]. No export exists, so redraw it; every string here is invented and goes on Notes.
- One dashed entry arrow, from step 4 only, labelled "address already has a household, detected after the code is accepted". The method choice (step 2a) never checks this, so an unverified person cannot learn whether a household lives at an address.
- Frame: in ext:claim-verify-flow, after the code is accepted:
  - title "This address already has a household in Pantopus";
  - body "Ask someone who lives there to invite you. Your saved place stays as it is, and only you can see it.";
  - primary "Keep it as a saved place"; secondary text button "How invitations work".
- No second home is created, and nothing is carried.
- Terminal chip: "lands on x-place-file · saved place (unchanged); an invitation later continues in flow-04 at f3b-invitation-decision".
- Open questions for Notes: is there a request-to-join path, or is it invitation-only (and so, is C5 reachable at all)? Probing risk: even after proof, anyone holding a valid code learns that a household exists at the address; confirm this is acceptable and that no earlier screen reveals it.
C5 · The claim merges into a household that already has a keeper [lane 06]. Frame-only what-if, reachable only if the C4 open question resolves to "merge": Jordan had already joined Chris Alvarez's household at Birchfield by invitation (flow-04 at f3b-invitation-decision) and was not yet address-verified, then verified by postcard, so his saved-place facts merge into that household. The household has a member, Chris Alvarez, and a keeper, Pip (fox). Without that condition, C4 applies instead.
- Dashed entry arrow from step 4, labelled "only if Jordan already joined Chris's household by invitation (depends on the C4 open question)".
- Frame: f1-claim-receipt · web-390 · 14-existing-keeper at iOS width (393x852), recast:
  - summary "Your pickup day and 2 dates came with you." (3 rows);
  - question "Share the 2 dates you entered with Chris?";
  - caption "Until you choose, only you will see them. You can change this for each date later.";
  - below the manifest: "Your household already has Pip (fox). Pip stays. Pepper is kept in your place file."
- Rejoins step 7.
C6 · The receipt is left without a choice [lane 03]. Leaves step 5 (back gesture, or "Go to your place" while pending).
- Frame: f1-claim-receipt · web-1440 · 05-revisited-sam-pending, recast at iOS width (393x852) for Thu 29 Oct: the revisited page still asks "Share the 2 dates you entered with people who join this household?" and both pairs stay pending.
- The dates stay "Only you" everywhere: per-date chips, Today's person glyph, DateSheet "Only you" selected. Past-tense "are now visible" copy never appears.
- Dashed arrow labelled "rejoins step 12's layout (pending variant: the question in place of the result line)".
C7 · The postcard does not arrive [lane 02]. Leaves step 3.
- Frame: x-place-file postcard pending as of Sat 31 Oct (step 3's frame with only the Proof row changed). "Send a new code" is now enabled, with the caption "Your old code will stop working."
- Tapping it requests a new postcard, and the Proof row shows a new requested date and window.
- Rejoins step 4 when the new postcard arrives.
C8 · The move-in date was never carried [lane 04]. Leaves step 8.
- Frame 1: f6-home-basics-rows · ios · 04-not-set, recast to Birchfield: "Moved in · Not set", with its own Add and the helper; no status line.
- Frame 2: after he adds Fri 9 Oct, the place file shows the Just moved block with the caption "Shown until Tue 8 Dec, 60 days after you moved in".
- Margin note: a saved place can hold a move-in date (x-place-file's "Moved in · Not set · Add" at saved-place scope), but the claim manifest does not carry it. A mover who set it before claiming would lose the Just moved rows at the home until setting it again. Propose a 5th manifest row when a saved-place move-in exists, or one quiet ask on the receipt when it does not.
- Rejoins step 8.
C9 · Offline at the receipt [lane 03]. Leaves step 5.
- Frame: f1-claim-receipt · web-390 · 17-offline at iOS width (393x852). Both consent buttons are disabled, with "You're offline. Only you will see your dates until you can choose." The default stays private.
- Rejoins step 6 when he is back online.
C10 · Slow manifest [lane 03]. Leaves step 4.
- Frame: f1-claim-receipt · web-390 · 16-loading at iOS width (393x852): skeleton rows under the headline, shown only after 1 second.
- Rejoins step 5.
C11 · Wrong code [lane 03]. Leaves step 4.
- Frame: f3b-verify-address-sheet · ios · 12-wrong-code, recast to step 4's content: under "Code from your postcard", "That code doesn't match. Check the postcard and try again." The typed code stays in the field; nothing is carried.
- Rejoins step 4 (he retypes and taps "Check code").
C12 · Expired code [lane 03]. Frame-only what-if: Jordan enters the code on Wed 18 Nov, 6:30 PM, after the Tue 17 Nov expiry.
- Frame: step 4's frame as of Wed 18 Nov, with only these deltas: the dates line reads "… code works until Tue 17 Nov" with no relative count; an error under the field, "This code stopped working on Tue 17 Nov. Send a new code to get another." (invented); the late path "Send a new code" is enabled with "Your first code will stop working."
- Dashed arrow "tap Send a new code" to C7's new-postcard Proof row, then "rejoins step 4 when the new postcard arrives".

HANDOFF CHECKS (print each check as a row on lane 07, with thumbnails of both frames and an empty "Agrees? yes / no" box)
1. Frame 1 and frame 3 must agree on the address string "1107 NE Birchfield Ct" and the scope "Saved place · Only you", and on the Place tab root (Your places, then Open).
2. Frame 2c (f3b pending) and frame 3 (Proof row) must agree on the same claim: requested/mailed Sun 18 Oct, upper bound Fri 30 Oct, expiry Tue 17 Nov. Frame 3 reads "Postcard requested Sun 18 Oct · expected Fri 23–Fri 30 Oct · code expires Tue 17 Nov" and "You can ask for a new code after Fri 30 Oct."
3. Frame 3 and frame 4 must agree that the Proof row's "Enter your code" opens f3b's postcard-pending state for this same claim.
4. Frame 3, frame 5, frame 8, frame 9 (KeeperStrip) and frame 12 must agree on "5 on file" (address, pickup, renters insurance, notice deadline, lease ends; county rules, the keeper and the confirmed Proof fact not counted). f11-keeper-strip says "7 on file" for Jordan, and x-place-file's saved-place frame says "2 on file". Apply one count rule everywhere.
5. Frame 5 and frames 6–7 must agree on the count: the summary rows (4), the question ("2 dates") and the result line ("these 2 dates").
6. Frame 5 and frame 8 must agree on how dates are counted. The notice deadline is counted as a fact in FactCount (5 on file) but excluded from the "N dates" wording, so claim copy says "2 dates". x-place-file's banner and row copy say "3 dates" for HOME A, counting the notice deadline in the wording. The banner must read "2 dates".
7. Frame 5 and frame 8 must agree on the link label. The receipt offers "See your place file". The inventory's "See what we know" is retired.
8. Frame 7 and frame 8 must agree on the banner ("Your pickup day, 2 dates and Pepper came with you. · See what moved") and on the persistent row ("What moved when you claimed · Pickup day, 2 dates and Pepper · Wed 28 Oct"). The claim receipt banner sits after invite and reissue in the LandingBannerSlot precedence.
9. Frame 8 and frame 9 must agree on the scope "Your household". f1-today-tab 13 shows the chip, which replaces "no chip" in flows-spec step 8.
10. Frame 9 and frame 5 must agree on where Today's notice goes. "Birchfield Ct is now your home · See what moved" opens the claim receipt. Only the different-address notice (C3) opens Your places.
11. Frame 5, frame 9 (PickupCard), frame 11 (widget) and frame 12 must agree on pickup: Thursday, the tick "You added this", "Recycling: Not set", and garbage-only wording: "Garbage tomorrow" on the card, or the widget's evening hero "Bins out tonight" with "Garbage · curbside by 6:30 AM tomorrow"; never "Recycling and garbage". The claim must never upgrade a hollow seed to a tick. The tick exists only because of the Wed 21 Oct confirm.
12. Frame 9 and frame 10 must agree that Birchfield appears once, as a home ("Claimed Wed 28 Oct"), with no duplicate saved row.
13. Frame 7, frame 8 (per-date chips), frame 9 (the renters-insurance row's person glyph and "Only you") and frame 13 (DateSheet "Only you" selected on open) must agree on the visibility he chose on the receipt. x-date-sheet opens carried dates at the receipt's choice, so a private-at-home date is represented.
14. Frame 13 and frame 9 must agree after the switch: the strip row drops "Only you", the chip reads "Household", and the status reads "Saved to your household calendar."
15. Frame 11 before and after must agree on the label "Birchfield Ct". Only the scope words (the glyph on the small widget), the county dates (Mon 2 Nov appears only after) and the air age (fresh after the 6:11 PM refresh) change.
16. Frame 5 (Pepper row) and frame 14 must agree on the keeper's scope line, "Everyone in this household will see this." f11-keeper-naming requires the receipt to state this before the change. The receipt states it on the row but asks consent only for dates. Record this as an open question.
17. f11-keeper-strip · ios · 11-removed-undo (recast to Pepper) and frame 14 must agree on the household form of keeper copy: after the claim, Remove reads "Pepper removed for everyone in this household · Undo" (no longer "Keeper removed · Undo"), matching frame 14's household scope line.
18. Frame 3 and frame 9 must agree on the save date Sat 10 Oct. x-place-file and f1-today-tab exports were drawn with Sat 17 Oct and show first-week elements; remove those in this storyboard.
19. Frame 5 and frame 8 must agree on the proof wording: "Address confirmed by postcard · Wed 28 Oct" on the receipt and "Address confirmed by postcard · Wed 28 Oct 2026" on the Proof row.
20. Every footer in this journey uses "Only you will see this." or "Everyone in this household will see this.", never "Only you can see this." or "Only you see this."
21. Frame 8 and C8 must agree that a home claimed from a saved place arrives with Moved in "Not set" (f6-home-basics-rows), so the mover rows are absent until it is set.
22. Frame 3, frame 5, frame 8, frame 12 and x-date-sheet · ios · 19-saved-lease-saved-place must agree on relative-date units for dates more than 30 days out: days ("in 133 days · Mon 1 Mar 2027", "in 163 days", "in 124 days", "in 154 days", "in 153 days", "in 184 days", "in 246 days"), never months.
23. C3 frame 1 (receipt) and C3 frame 2 (Today notice) must agree on the street form (full address) and on the saved-place name ("Mom's house"). f1-today-tab's Notes use the label form and "Mom's place"; that string is replaced. Frame 2 uses Today's notice actions ("See your places" · "Dismiss"); frame 3 uses Your places' arrival action ("Close").
24. The Wed 21 Oct inset ("Not now" → "No reminder for now · Undo") and frame 9's briefing card must agree: the night-before row is absent, the morning row still asks, and no system dialog has fired. Both name the street ("Bins out tonight · Birchfield Ct"; "For 1107 NE Birchfield Ct") because Jordan has more than one place.
25. Frame 11 (the "after" widget strip) and frame 9 (the 14-day card) must agree on the same 5 items: Thu 29 tick, Fri 30 tick, Mon 2 Nov filled, Tue 3 Nov bar, Thu 5 Nov tick. The "before" widget has 4, with no county date.
26. Frame 3 and frame 8 must agree on the Next row ("Set your pickup day" · "Set pickup day") and on the year band's presence, and on the Thanksgiving line "Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar" in the pickup row and band caption.
27. Frame 2c, frame 3 and frame 4 must agree on the postcard window. f3b's method row says "5–10 days"; this claim's window is Sun 18 → Fri 23–Fri 30 Oct (5–12 days). Choose one.
28. Frame 3 / C7 and frame 4 / C12 must agree on the late-path wording: x-place-file "You can ask for a new code after Fri 30 Oct." / "Your old code will stop working." against f3b "Available after Fri 30 Oct. Your first code will stop working." Choose one.
29. Frame 3 and frame 2c / frame 4 must agree on the date grammar: "Postcard requested … · expected Fri 23–Fri 30 Oct · code expires …" (x-place-file) against "Mailed … · expected by … · code works until …" (f3b). Choose one.
30. Frames 2b–2c and frame 4 against f3b's rule that "a person who only has a saved place never reaches this sheet": this storyboard reuses f3b's postcard states inside the claim flow for a saved-place person. Confirm the exception or name the separate claim host.
31. Frame 3 and frame 4 must agree on the entry label: x-place-file "Enter your code" against f3b's caller label "Enter code".
32. Frame 9 (signals) and f1-today-tab · ios · 02-saved-place-quiet must agree on the property-tax signal: 02 draws it on PLACE B's Today, while x-place-file says a saved place has no county dates. After the claim, frame 9 shows no property-tax signal because the 14-day card holds Mon 2 Nov.

ACCESSIBILITY IN THE JOURNEY (lane 08: a focus map drawn over thumbnails of every frame, plus the notes below)
Focus landing after each transition:
- Step 1: the menu opens with focus on its first item, Open. After Claim, focus goes to the claim flow's title.
- Step 2: after tapping Postcard, focus moves to the inline confirm line; after "Send postcard", "Postcard on its way" is announced politely and focus goes to the heading "Your postcard is on its way." The disabled late path stays focusable and reads its reason.
- Step 3: arriving on the place file, focus goes to the title "Your place file". The year band is one adjustable element. The disabled "Send a new code" stays focusable and reads its reason.
- Wed 21 Oct inset: after "Not now", "No reminder for now" is announced politely, focus stays on the card, and Undo is focusable.
- Step 4: "Enter your code" opens the sheet with focus on its heading (never jumping into the field). "We're checking your code…" is announced politely. After success, focus goes to the receipt headline.
- Step 5: the summary is announced once as a status message. The manifest is announced as a list with its real count, "4 items". Example row: "Lease ends, in 154 days, Wednesday 31 March 2027, you added this. Was visible to only you, household waiting for your choice."
- Steps 6–7: the result line is announced politely, and Undo is focusable. Focus stays on the chosen button.
- Step 8: the banner is a status region. Focus goes to the title.
- Step 9: the pinned notice has role=status on appearance. Focus goes to the location row, read as "1107 NE Birchfield Ct, visible to your household, updated just now". The strip reads "Pepper, busy: 3 things due in the next 7 days."
- Step 10: the chip entry moves focus to the home row: "1107 NE Birchfield Ct, Camas, Washington 98607. Claimed Wednesday 28 October. Today uses your home."
- Step 11: the widget's spoken label changes from "Birchfield Ct, saved place, only you" to "Birchfield Ct, your household".
- Step 12: focus goes to the page title "What moved when you claimed".
- Step 13: focus goes into the sheet at "Visible to". The chips read "Visible to only you, selected" and "Visible to your household". The disabled reminder leads read the one passed-lead line. On Save or Close, focus returns to the renters-insurance row.
- Step 14: focus goes to the sheet title "Rename Pepper". The scope line is read after the name field. On "Save name" or Close, focus returns to the strip's name.
- C1: after Retry succeeds, focus stays on the row that joined the manifest, and the updated summary is announced once.
- C2: focus goes to the success headline; "Today now uses this home." is read after it; on leaving, focus goes to the place file title.
- C3: frame 2's notice has role=status; "See your places" and "Dismiss" are separate 44pt targets; on arrival, focus goes to the arrival line on Your places.
- C4: focus goes to the title "This address already has a household in Pantopus".
- C5: focus goes to the receipt headline; the Pip line is read after the manifest, before the question.
- C6: on the revisited page, focus goes to the page title; the pending question is read as a heading, and both buttons are focusable.
- C7: after "Send a new code", the updated Proof row is announced once, and focus stays on that row.
- C8: after the move-in date is saved, focus returns to the "Moved in" row, and the Just moved block's heading is announced once.
- C9: while offline, the disabled buttons stay focusable and read the offline reason. When the connection returns, the buttons enable and "You're back online" is announced politely; focus stays where it was.
- C10: the skeleton is hidden from assistive tech; the headline is read, and the summary is announced once when the rows arrive.
- C11: the wrong-code error is announced once and tied to the field; focus returns to the field.
- C12: the expired-code error is announced once and tied to the field; the now-enabled "Send a new code" is the next focus stop.
Scope is carried everywhere by the glyph shape plus visible words, never by colour or strikethrough alone. Draw one AX5 sample of frame 5 (f1-claim-receipt · ios · 18-ax5, recast): rows stacked, pair and caption on their own lines, buttons full width.
The no-notifications path: this whole journey needs no push. Draw a margin note on lane 08: "The system has never asked Jordan for notifications; he declined the reminder ask on Wed 21 Oct. The only places he learns the claim's state are the postcard sheet and Proof row (frames 2c, 3, 4), the postcard itself, and the receipt, banner and Today notice (frames 5, 8, 9). No surface promises a 'we'll notify you' message." Under Reduce Motion: the seal is static, and the scope-pair changes are instant cross-fades.

INSTEAD OF
- Instead of redesigning any screen, redraw each export exactly with Jordan's deltas, because this project checks the joins, not the screens.
- Instead of inventing the postcard and code screens, redraw f3b's 10, 11 and 12 recast to Jordan, because the founder must check the real join between the Proof row, code entry and the receipt.
- Instead of checking for an existing household at method choice, check only after the code is accepted, because an unverified person must never learn who lives where.
- Instead of showing "Recycling and garbage" or a hollow mark after the claim, draw "Garbage tomorrow" with the tick and "Recycling: Not set", because the claim must carry exactly what he confirmed and nothing more.
- Instead of a confirm with no reminder ask, draw the ask and his "Not now", because every first confirm is followed by the ask and his answer shapes the briefing card.
- Instead of a property-tax mark on the saved-place widget, show county dates only after the claim, because a saved place has none.
- Instead of a calm "On it" keeper after the claim, draw Busy with 3 things, because the county date now counts.
- Instead of "are now visible to everyone", draw the conditional question with pending pairs, because silence is not consent.
- Instead of a quiet success with a row missing, draw the failed row with Retry and adjusted counts, because loss must be visible.
- Instead of a second Birchfield row under Saved places, draw one home row, because a duplicate reads as two places.
- Instead of dropping the chip on the claimed home, draw "Your household", because scope is always stated.
- Instead of a push for postcard status, show the Proof row's bounded window, because Jordan has no notifications.
- Instead of a dotted connector with no label, label every arrow with its trigger and every gap with its dates, because the founder must see when and why each step happens.
- Instead of confetti or a progress bar at the claim, draw the plain receipt, because this is a receipt to check.

DONE WHEN
- All 14 happy-path steps (step 2 as three frames) sit in order across lanes 02–05, each with its step label, time chip, source export and Carries card, and every arrow is labelled with its trigger.
- Steps 2 and 4 are drawn from f3b 10 and 11 recast to Jordan, with "Send postcard" and "Check code" named.
- The Wed 21 Oct inset shows the reminder ask with "Bins out tonight · Birchfield Ct" and his "Not now", and step 9's briefing card has no night-before row.
- Steps 3 and 8 show the year band and the "Set your pickup day" Next row, and the Thanksgiving line; step 8 lists every Dates row with its relative date in days.
- Step 9's KeeperStrip is Busy with "3 things due in the next 7 days.", and its PickupCard has "Change pickup day".
- Every moment of truth MT1–MT14 has a margin callout joined to its frame.
- All twelve failure branches (C1–C12) are drawn in lower lanes, each with its recovery and either a "rejoins step N" arrow or a terminal chip naming its landing surface; C4 has a single entry arrow from step 4, and C5's entry arrow names its condition.
- The counts agree in every frame (4 manifest rows, 2 dates, 5 on file), and relative dates beyond 30 days are in days.
- The pickup day shows the tick and "Recycling: Not set" in every post-claim frame.
- Only the "after" widget shows the Mon 2 Nov county mark.
- Nothing reads as shared before the tap in step 6, and step 13 reverses exactly one date, with only the Day-of reminder live.
- The handoff-check lane lists all 32 checks, with both thumbnails for each.
- The focus map covers every transition, including C1–C12, and the no-notifications note is present.
- Every invented string and every conflict with an export is on Notes.

ARTBOARDS
1. flow-06 · storyboard · 01-journey-map · light — one row of 14 step chips (surface id, state, time; step 2 notes its three frames), the four time gaps, a legend for arrows, gaps, MT callouts and branch arrows, and a key showing which lane artboard holds each step and branch.
2. flow-06 · storyboard · 02-lane-before-claim · light — steps 1–3 (step 2 as frames 2a–2c), the TODAY gap and the Wed 21 Oct gap with its two-state inset; MT1–MT3; lower lane: C7.
3. flow-06 · storyboard · 03-lane-code-and-receipt · light — the Wed 28 Oct gap and steps 4–7, plus the web and Android margin note; MT4–MT7; lower lane: C1, C2, C6, C9, C10, C11, C12.
4. flow-06 · storyboard · 04-lane-after-claim · light — steps 8–11 (step 11 as the before/after pair with the small-widget inset); MT8–MT11; lower lane: C3 (three frames) and C8 (two frames).
5. flow-06 · storyboard · 05-lane-next-day · light — the Thu 29 Oct gap and steps 12–14; MT12–MT14.
6. flow-06 · storyboard · 06-lane-household-branches · light — C4 (already has a household, one entry arrow from step 4, ending in its terminal chip) and C5 (existing keeper, with its conditional entry arrow, rejoining step 7), with the open questions printed beside them, including the C4/C5 contradiction and the probing risk.
7. flow-06 · storyboard · 07-lane-handoff-checks · light — the 32 checks as rows: check text, the two frame thumbnails at 25%, the source prompts, and an empty "Agrees? yes / no" box. Reuse the frames already drawn in lanes 02–06 (and the attached exports) as scaled instances or copies; do not redraw them.
8. flow-06 · storyboard · 08-lane-accessibility · light — the focus map over all frames, the announcements, the AX5 sample of frame 5, the Reduce Motion note and the no-notifications note. Reuse the frames already drawn in lanes 02–06 as scaled instances or copies; do not redraw them.
9. flow-06 · storyboard · 09-notes · light — include:
   - the recast (Maya/Sam/HOME A exports redrawn for Jordan/PLACE B), and the artboard-naming extension ("storyboard" in the platform slot);
   - the Place tab root reading (Your places for anyone with no claimed home; the place file after the claim) and the merge conflict with x-place-file's "index of the Place tab";
   - the claim-flow reading: method choice is the ext host; the postcard confirm, pending state and code entry are f3b-verify-address-sheet's states reused inside the claim; "Enter your code" opens f3b 11. Conflicts: f3b's "never reaches this sheet" rule for saved-place people; "5–10 days" against Fri 23–Fri 30 Oct; the late-path wording ("You can ask for a new code after …" / "Your old code will stop working." against "Available after … Your first code will stop working."); the date grammar ("requested … expected … code expires" against "Mailed … expected by … code works until"); "Enter your code" against "Enter code";
   - timeline assumptions: the claim is started Sun 18 Oct, the evening before TODAY, to match x-place-file's postcard dates; the confirm and the "Not now" are Wed 21 Oct at 6:12 PM; the code is entered Wed 28 Oct at 6:08 PM; the revisit is Thu 29 Oct at 7:30 PM; C12's Wed 18 Nov entry;
   - the save date: Sat 10 Oct (fixture), against Sat 17 Oct in the x-place-file and f1-today-tab exports;
   - Jordan's pickup state: hollow on Mon 19 Oct and a tick from Wed 21 Oct. This reconciles "frequency Not set" with flow-06's "confirmed pickup day", because confirming sets the weekday only. x-date-sheet frame 03 draws Jordan picking Weekly and f4-today-pickup-card frame 05 says he set weekly garbage; neither applies here;
   - the reminder-ask choice: Jordan taps "Not now" on Wed 21 Oct, which closes the night-before row; the morning row still asks. Recast of f4-today-pickup-card 07: its PLACE B tray preview says he has "one place" and draws no street label; this storyboard draws "Bins out tonight · Birchfield Ct" because he has five. f4-briefing-optin-card says Jordan's card has no "For …" caption; this storyboard draws the caption for the same reason;
   - the Next row decision: first-week steps keep feeding the Next row after day 7, so "Set your pickup day" stays Next until the frequency is set. Open question for x-place-file: should first-week steps stop feeding the Next row after day 7? The caption "Thursday is set. How often does each bin go out?" is invented;
   - the PLACE B year band as drawn here (You lane Oct and Mar; county lane caption before the claim, county dates after) is derived, not exported;
   - the county-dates conflict: x-place-file says "County dates aren't available for a saved place", while f1-today-tab · 02-saved-place-quiet draws the property-tax signal on PLACE B's Today. This storyboard follows x-place-file before the claim, and after the claim shows no property-tax signal because the 14-day card holds the date (signals never repeat a section's fact);
   - the step 8 Dates rows as of Wed 28 Oct (voter in-person row "in 6 days · in person until 8:00 PM Tue 3 Nov"; county rows Mon 2 Nov, Fri 30 Apr 2027 and Thu 1 Jul 2027 in days) are derived; "What neighbors see" is assumed home-only;
   - the Thanksgiving move to Fri 27 Nov ("Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar"), labelled as the city's published holiday schedule: an illustrative fixture to verify against the real City of Camas calendar;
   - the relative-date decision: days, not months, for dates more than 30 days out (x-place-file's months form is replaced);
   - the reminder control for a date due tomorrow in step 13: 60, 30, 7 and 1 day all disabled with one line, "60, 30, 7 and 1 day have passed or fall today." (invented), and only Day-of (Fri 30 Oct) live and selected;
   - the Rename delta: step 14 adds the household scope lines to f11-keeper-naming's Rename mode (title "Rename Pepper", field, "Save name", Close), because f11 requires the sheet to state the household scope after a claim; a delta against the 11-rename export;
   - the keeper mood: step 9 is Busy ("3 things due in the next 7 days.": pickup Thu 29, renters insurance Fri 30, property tax Mon 2 Nov), by f11's mood rules; step 14's two-item Busy line is derived;
   - the location chip route: step 9's chip opens Your places for a claimed home, following f1-today-tab; f1-your-places lists only the saved-place chip as an entry;
   - the C3 notice form: full street address and "Mom's house", with Today's notice actions "See your places" and "Dismiss", against f1-today-tab's "Today now uses Larkspur Loop. Mom's place is still saved.";
   - the C4/C5 contradiction: both describe an address that already has a household; C5 is drawn only as the "merge" answer, reachable if Jordan had already joined by invitation; C4 is the invitation-only answer;
   - the two dates, taken from f5 (renters insurance Fri 30 Oct) and x-date-sheet (lease ends Wed 31 Mar 2027, 14-day reminder); Pepper from f11-keeper-naming; Jordan's iPhone widget as an assumption;
   - the widget snapshot assumptions: a snapshot written at 6:08 PM when he opened the app (air last fetched 7:00 AM), and the 6:11 PM Today refresh writing the fresh air reading "AQI 42 · Good · AirNow 6:00 PM" (invented); the saved-place widget carries no county dates;
   - the count rule behind "5 on file" (the notice deadline counts as a fact but not in the "N dates" wording; county and state rules, the keeper and the confirmed Proof fact are not counted), and the conflicting 7 and 2;
   - every invented or recast string: the step 2a carry line; the f3b strings recast to Jordan ("We'll mail a code to 1107 NE Birchfield Ct", both dates lines with their relative counts); "Thursday · recycling: Not set · next pickup tomorrow" (step 5); "Thursday · recycling: Not set · next pickup in 7 days · Thu 5 Nov" (step 12); the step 8 Next caption; the step 8 voter and county rows; the C4 title, body and buttons; "This code stopped working on Tue 17 Nov. Send a new code to get another."; "We couldn't move your renters insurance date · Retry"; "Chris Alvarez" and the Pip line; "Busy · Renters insurance renews tomorrow. Property tax 2nd half is due in 4 days · Mon 2 Nov."; "Garbage · curbside by 6:30 AM tomorrow"; "Bins out tonight · Birchfield Ct"; "Pepper removed for everyone in this household · Undo"; "Shown until Tue 8 Dec, 60 days after you moved in"; the C3 notice string with Birchfield; "You're back online"; the "How invitations work" button; "AirNow · observed 6:00 PM"; "60, 30, 7 and 1 day have passed or fall today."; all time chips and gap labels;
   - the proposed events claim_carry and date_visibility_changed; and the Activation note (this claim does not move Jordan's Activation; it enables the second-occupant fact for future movers);
   - open questions: whether keeper visibility changes without consent; whether pickup changes scope without consent (the reasoning is that the address shares it); whether to carry or ask for the move-in date at claim (a saved place can hold one); whether a request-to-join path exists (C4), and the probing risk of revealing an existing household even after proof; what happens in C5 if the existing household has its own pickup day; whether the widget label and first-week state move silently;
   - omitted: the web and Android lanes (only a margin note), the dark twins, and the member's view after an invite (covered by flow-04).

BATCH PLAN
Turn 1: artboards 1–2, then wait for "continue".
Turn 2: artboard 3, then wait for "continue".
Turn 3: artboards 4–5, then wait for "continue".
Turn 4: artboards 6–7, then wait for "continue".
Turn 5: artboards 8–9.
