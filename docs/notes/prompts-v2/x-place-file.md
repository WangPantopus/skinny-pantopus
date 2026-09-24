# Your place file
id: x-place-file · platforms: web/ios/android · isNew: True · artboards: 22

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Your place file · x-place-file

TYPE: NEW. Nothing like it exists yet. Build it only from the Foundations components and the existing row and card styles.

ATTACH: the current Place tab root on web 1440 (with the app sidebar and the Place nav rail: Overview, Risk & readiness, Civic and the rest), web 390, iOS and Android; the current Today tab on iOS (so the band's 14-day window matches the FourteenDayStrip geometry); the Foundations board from prompt 00.

PLATFORMS & VIEWPORTS: web 1440x900 (sidebar) and web 390x844 (bottom tab bar); iOS 393x852; Android 412x915. In this prompt, "phones" always means iOS, Android and web 390 together.

WHERE IT LIVES & HOW PEOPLE ARRIVE
This screen is the index of the Place tab (Place · Today · Nearby · Mail) on every platform: web /app/place, and the Place tab root on iOS and Android. On web 1440, keep the host's left nav rail exactly as attached and draw the place file as its "Overview" content. The screen needs a place. A person with no saved place sees the Your places empty state instead. The existing Place sections (Risk & readiness, Civic and the host's other sections) stay reachable through the "Public records for this address" group described below. Arrivals:
1. Tapping Place in the tab bar or sidebar.
2. Today's first-week row ("Next: set your pickup day →", shown for 7 days). It lands on the "Set up your place" block with that step highlighted. Today's row and this block read the same step status.
3. The claim receipt's "See your place file" button. The claim hands over what moved (pickup day, 3 dates, keeper), and this screen shows it once as a banner and permanently as a row.
4. The keeper strip's count (phase 2). The number there equals the number here.
5. A reminder push with no specific date lands at the top of this screen. A reminder for a date 14 or more days away (outside Today's strip) lands on that date's row: the row is highlighted, focus moves to it, then the DateSheet opens. Web /app/place?rule=lease-notice, native pantopus://place?rule=lease-notice. If that date was deleted, see EDGE CASES.
6. The large widget's year strip lands on the year band.
Exits: rows open the DateSheet, the ProvenanceSheet, Your places (and from there the add-a-place sheet), the members roster, the invite composer, the bills list, Mail Day, documents (from "A home document, like your lease"), home settings (the Moved in control), the verify sheet, the privacy mirror, the keeper naming sheet, the Civic registration block, Risk & readiness, the widget how-to sheet (iOS) or the system add-to-home-screen dialog (Android), pickup notification settings, outbound USPS, utility and VoteWA pages, and the claim receipt. The text link under the band opens Today's 14-day strip.

WHO AND WHEN
Dense frame: Maya Chen, owner of HOME A, on Mon 19 Oct at 6:10 PM. She moved in 23 days ago, claimed the address on Sat 17 Oct, and Sam Ortega joined on Sun 18 Oct. She wants to check that nothing in the year ahead is missing, lease notice included. HOME A's first-week steps are all done (address saved, pickup confirmed, reminders on, dates added), so no Set up block shows for Maya.
"Saved place" frames: the person who saved PLACE B (not claimed), in their first week. Show no name for them on this surface.

THE ONE JOB
See every fact Pantopus holds for this address in one list, including dates months away, and add the few that are missing. This one list replaces the first-week checklist, the Just Moved card, the Your dates card and the keeper ledger, so draw every section with the same FactRow and DateRow grammar and one dismissal pattern (InlineUndo), never as four card styles. It is the only place a date 14 or more days away can be seen, edited and deleted (otherwise a lease end months away is saved, confirmed once, then invisible until two weeks before it fires), and it gives a saved-place user a reason to open the Place tab.

FIRST FIVE SECONDS
1. The address with its ScopeChip, and the count "11 on file".
2. The year band: which months hold something, and which source each mark comes from.
3. The one next step. Directly under the year band card, draw a single "Next for this place" FactRow holding the only filled primary button on the screen (primary.700). Choose it like this: first the first undone first-week step; once all are done, the first missing fact in this order: widget (iOS and Android only), insurance date, verify this address. HOME A on iOS: "Put today on your home screen" · button "See how to add it". HOME A on Android: the same row · button "Add the widget". HOME A on web: "When does your insurance renew?" · button "Add a date". PLACE B: "Set your pickup day" · button "Set pickup day". When the widget was already promoted elsewhere in Pantopus in the last 24 hours, the Next row shows the insurance ask instead and the widget stays a quiet FactRow in PLACE. The Next row must end above the tab bar on the 393x852 dense frame (see the height budget).

CONTENT (fixtures as in the house style; only the deltas are listed here)
Deltas: HOME A moved in Sat 26 Sep 2026, so mover rows show until Wed 25 Nov. Claimed Sat 17 Oct, carrying pickup day (Maya confirmed Tuesday, so it carries the tick), lease ends, notice deadline and the warranty. Maya kept the warranty "Only you"; the other dates are "Household". Sam joined Sun 18 Oct. The Priya invite was sent Mon 19 Oct. Bills came from mail snaps (tick). The address is not verified yet. PLACE B: saved Sat 17 Oct (not Sat 10 Oct), so its first week runs until Sat 24 Oct; Jordan Lee's name is not shown here. Longest address for edge frames: "12517 NE Old Evergreen Highway, Unit 204, Vancouver, WA 98684".
Count rule: "on file" counts the facts this household holds plus address-specific records (pickup), including an unconfirmed pickup seed, because it is on file (hollow). County and state rules are shown but not counted. The keeper and the widget are not counted. HOME A = 11: Place 3 (address, pickup day, moved in) · Dates 4 (HOA dues, warranty, notice deadline, lease ends) · Money 3 bills · People 1 (Sam). A first-week step has its own status, separate from the count: "Set your pickup day" is done only when the person sets the frequency and confirms.
Ask rule: at most 3 promoted asks per screen. Ask 1 is the Next row (filled button). Asks 2 and 3 are outlined secondary buttons inside their own section. Every other missing fact is a quiet FactRow with a text "Add". Every promoted ask carries two equal-weight text buttons, "Not now" and "Skip". "Not now" demotes the ask to a quiet FactRow in its section, and it is never promoted again automatically. "Skip" collapses the row to an InlineUndo ("Skipped 'Put today on your home screen' · Undo"), is stored on the server, and moves the fact under "More you can add" (FactRow declined variant), where it can be reopened. HOME A on iOS/Android: ask 2 is "When does your insurance renew?" · "Add a date" in Dates. When the widget row is the Next row, it is not repeated inside PLACE.

Top of screen, in order: title "Your place file"; "2418 NE Larkspur Loop" and "Vancouver, WA 98684"; one line with ScopeChip "Your household" and FreshnessLine "Updated 4m ago"; one line with FactCount "11 on file" (pips Place · Dates · Money · People) and the legend "● Official · ○ On record, not confirmed · ✓ You added this", printed once.

Year band "The year ahead", Oct 2026 to Sep 2027:
- You (tick): Nov (HOA dues, Sun 1 Nov) · Dec (warranty, Sat 12 Dec) · Mar with count "2" (notice deadline Mon 1 Mar, lease ends Wed 31 Mar).
- Your city: Tuesday service weeks, solid for Oct–Dec (confirmed, tick), dashed with the word "projected" from Jan (after the last published hauler calendar, Dec 2026). No Tuesday holiday move is published for Oct–Dec.
- Your county (filled): Nov (property tax 2nd half, due Mon 2 Nov) · Apr (1st half, due Fri 30 Apr) · Jul (appeal, Thu 1 Jul, caption "may be later").
- Your state (filled, full-lane-height bars): Oct (Mon 26 Oct) · Nov (Tue 3 Nov).
- Summary line: "Next 12 months: 9 dates, plus pickup every Tuesday. Next: online or mail voter registration must arrive by Mon 26 Oct." Footer row: "Every date is listed below · See the next 14 days on Today" (the second half is the link).

JUST MOVED, caption "Shown until Wed 25 Nov, 60 days after you moved in". Each mover row has three parts: a leading 44pt (48dp) tick control with the visible label "Mark done" (spoken "Mark Move your utilities done"), a row body that opens its destination, and a trailing "Hide" text button.
- "Forward your mail" · USPS — done, quiet: "You marked this done Sun 18 Oct". Body opens the outbound TextActionRow "Change your address at USPS ↗".
- "Move your utilities" · Clark Public Utilities, NW Natural, City of Vancouver. Body opens a list of three outbound TextActionRows: "Clark Public Utilities ↗", "NW Natural ↗", "City of Vancouver ↗".
- "Update your voter registration" · "Registration is per address. Online or mail must arrive by Mon 26 Oct · in person until 8:00 PM Tue 3 Nov" · SourceCaption "Washington Secretary of State · statewide". Body opens the Civic registration block. Once ticked it reads "You marked this done Sat 17 Oct · We can't check registration status" with a static per-date ScopeChip "Only you". Never state or imply whether Maya is registered.
The other moving steps (pickup, money, civic dates, block) are not repeated here: Place, Money (or, without phase 2, the Public records "Money signals" row) and Dates already hold them.

PLACE:
- Address · the full address · chevron to Your places · tick.
- Pickup day · "You · Tuesday" · "Recycling and garbage tomorrow · carts out by 6:30 AM" · SourceCaption "Waste Connections · recycling every other Tuesday · you confirmed".
- Moved in · "Sat 26 Sep 2026" · tick · helper "Shows your moving list for 60 days" · opens the Moved in control in home settings.
- What neighbors see · "One public spot, the same every time" · opens the privacy mirror.
- Keeper · "Ollie" (phase 2).
- Put today on your home screen · "Pickup, air and your next date. No notifications needed." (iOS and Android only; drawn here only when it is not the Next row).
- What moved when you claimed · "Pickup day, 3 dates and Ollie · Sat 17 Oct" (without phase 2: "Pickup day and 3 dates · Sat 17 Oct").
- Your reports · "1 checking".

PUBLIC RECORDS FOR THIS ADDRESS (after PLACE): one FactRow per host section, as links, not counted facts:
- Risk & readiness, two value lines: "Flood: Zone X — minimal flood hazard · Wildfire hazard: Moderate · 3 of 5" / "Air quality index (AQI): Good · 42, observed 7:00 AM · Radon: Zone 1 — highest potential (county-wide)", then the caption "Sources: FEMA, USFS, AirNow, EPA" (wraps at phone width) → Risk & readiness.
- "Civic · Voter registration and elections" → Civic.
- Then the host's remaining section rows (Your block, Money signals) unchanged.

DATES: DateRows in date order. Line 2 is always relative first, then absolute. Dates this household entered carry the per-date ScopeChip ("Only you" or "Household"); county and state rows carry only their scope label.
- "Register or update your voter registration" · "Online or by mail · in 7 days · must arrive by Mon 26 Oct" · "In person, Clark County Elections — until 8:00 PM Tue 3 Nov" · "Statewide — WA" · filled · Washington Secretary of State. The row body opens the DateSheet voter kind. Under it: the outbound TextActionRow "Check or update at VoteWA ↗" with the text button "Remind me" beside it.
- HOA dues · "$285 · in 13 days · Sun 1 Nov" · "Every year" · tick · Household.
- Property tax, 2nd half · "in 14 days · due Mon 2 Nov" · "Every year" · "Clark County" · filled · Clark County Treasurer. Detail one tap away: "moved from Sat 31 Oct".
- Water-heater warranty ends · "in 54 days · Sat 12 Dec" · "One time" · "Reminders Thu 12 Nov, Fri 11 Dec and Sat 12 Dec" · Only you.
- "Tell your landlord in writing by Mon 1 Mar 2027" · "in 4 months · Mon 1 Mar 2027" · "One time" · "Reminders Mon 15 Feb, Sun 28 Feb and Mon 1 Mar" · "From your lease: 30 days' notice" · Household.
- Lease ends · "in 5 months · Wed 31 Mar 2027" · "One time" · link line "Notice deadline: Mon 1 Mar 2027" · Household. No reminder on this row.
- Property tax, 1st half · "in 6 months · due Fri 30 Apr 2027" · "Every year" · "Clark County" · filled.
- Property-tax appeal · "in 8 months · closes Thu 1 Jul 2027, or 60 days after your value notice was mailed" · "Every year" · "Clark County" · Clark County Board of Equalization · filled · text action "Add the mailing date".
- Ask 2 (iOS/Android): "When does your insurance renew?" · outlined "Add a date" · "Not now" · "Skip".
- "Open household calendar".

MONEY (phase 2): Bills · "3 upcoming · $306.17 through Mon 2 Nov" · "Next: Clark Public Utilities $142.18 · in 4 days · Fri 23 Oct" · "You and Sam can see these." Then a quiet row "Add a bill from your mail · Open Mail Day".

PEOPLE: this section hosts the household block, which has its own design. When only the owner lives here it shows "Who lives here with you?" with Invite by email / Share a link / Just me; "Just me" is a FactRow declined state with Undo. With 2 or more people it collapses to the MemberRow line drawn here: "Maya and Sam live here · View". Managers also see the Pending group: InviteRow "priya@example.com · Member · sent Mon 19 Oct · in 7 days · expires Mon 26 Oct · Resend".

PROOF: at HOME A, one quiet FactRow "Verify this address · Add" (opens the verify sheet).

MORE YOU CAN ADD: collapsed as "More you can add (2)": "Your gas bill · NW Natural" and "A home document, like your lease" (opens documents), plus any skipped ask.

Worst case: 9 dates, 3 mover rows, 3 bills and a pending invite on one phone scroll, with Nov marks in three lanes, at the longest address.

LAYOUT & VISUALIZATION
- Phones: one column, 16pt gutter. Order: header → LandingBannerSlot (only when it has a banner) → year band card → Next for this place (or, on a saved place, the Set up your place block holding it) → Just moved → Place → Public records for this address → Dates → Money → People → Proof → More you can add → footer.
- Height budget, iOS 393x852 above the fold: header block 140pt or less (address, one line with ScopeChip + FreshnessLine, one line with FactCount + legend); band card 280pt or less (title 24, month-label row 20 with a small "2027" above Jan, four lanes of 28pt each, one 16pt caption row, summary capped at 2 lines, one 44pt footer row, 12pt padding); then the Next row (label, filled button, then "Not now · Skip" on one line), which must end above the tab bar at y=769. If it still does not fit, place the Next row directly under the header, above the band, and note that on the Notes artboard.
- Year band on phones: inside the card, a 64pt lane-label column plus 12 month columns of 22pt on iOS and web 390 (328pt), 24pt on Android 412. Lanes sit on surface.raised with ink dividers. In each lane, marks are grouped by month: one XS ProvenanceMark per cell. In a month cell, marks stack vertically, at most 2 rows. A count sits below its single mark as a caption numeral ("2"), never beside it. A holiday move is the moved mark on top and the struck 12pt ghost below it; the band caption names the move. The city lane's rhythm is a 2pt tick per service week along the lane's bottom edge: solid for confirmed weeks, dashed for projected ones, with the word "projected" over Jan. Never place a mark on its exact day on a phone. Statewide rules are full-lane-height bars, so they never read as a fact about this house. Today rule 1.5px text.primary, labelled "Today". Shade Mon 19 Oct–Sun 1 Nov in primary.50 with an ink edge, labelled "Next 14 days"; it is the same data as Today's strip at a longer zoom. The caption row holds "Reminder Mon 15 Feb" aligned under the Mar cell of the You lane. Bills are not drawn on the band.
- Web 1440: the band spans the full content width, with marks on their exact days and day-accurate holiday ghosts. A leader line runs from the notice-deadline mark back to a reminder tick labelled "Reminder Mon 15 Feb". The Next row sits under the band. Below it, two columns: a 720 column (Just moved, Place, Public records for this address, Dates, Money, People, Proof) and a 320 column (More you can add, open by default; Your reports; What moved when you claimed). No widget row on web.
- Rows: FactRow is 56pt, label above value. Annual and self-entered DateRows get the 2px identity.home left rule plus the recurrence caption ("Every year" or "One time").
- Degrades: with no rules, draw all 12 columns and 4 empty labelled lanes, plus the QuietDayReceipt line "Checked — nothing on file for the next year". On error, draw no band at all. On a saved place, the county lane reads "County dates aren't available for a saved place".
- Saved place (PLACE B): header ScopeChip "Saved place · Only you"; FactCount "2 on file" (address and the hollow Thursday seed) with only the Place pip, since pips appear only for categories this tier can hold. "Set up your place" (caption "For your first week · until Sat 24 Oct", with a Dismiss, no fraction) sits directly under the band and lists "Save your address" (ticked), "Set your pickup day" (the current step, drawn as the Next row with the filled "Set pickup day", "Not now" and "Skip"), "Turn on a reminder or add the widget" (on web: "Turn on a reminder") and "Add one date that matters". Below them, a grey row "Add the people you live with · Claim this address first" has no button and is not counted. Facts in this block show only a quiet "Not set" in the categories below.
- Saved place, Place: "Pickup day · Thursday · how often: Not set" · hollow mark · "City of Camas · pickup Thursdays · not yet confirmed"; no trailing action; the row opens the DateSheet pickup kind with Thursday preselected and frequency Not set. It adds "Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar"; the band caption reads "Thanksgiving week: pickup moved to Fri 27 Nov" and the Nov city cell shows the moved mark over a struck ghost. "Moved in · Not set · Add" carries the helper "Add it to see a moving list for 60 days" and opens the DateSheet move-in kind at saved-place scope; once set, the Just moved rows appear on the saved place too. Public records for this address shows as for HOME A.
- Saved place, Dates: the voter row, plus "More you can add (4)" (Lease ends, Insurance renews, Warranty ends, HOA dues).
- Saved place, other categories: one grey row, "Money, people and proof · Not here — this is a saved place · Claim this address first". Footer: "Only you will see this." and a text link "Claim this address".
- Postcard pending (PLACE B after "Claim this address" with the postcard method): the grey row splits. Proof shows a LockedActionRow (pending, no link) "Postcard requested Sun 18 Oct · expected Fri 23–Fri 30 Oct · code expires Tue 17 Nov"; below it a separate outlined button "Enter your code" and the disabled "Send a new code" with "You can ask for a new code after Fri 30 Oct." Money and People stay "Claim this address first". The ScopeChip stays "Saved place · Only you".

INTERACTION, MOTION & HAPTICS
- Every row is one target: 44pt on iOS, 48dp on Android, 44px on web. Inline text buttons (Hide, Not now, Skip, Remind me) are separate targets of the same sizes. Hide sits trailing on the row at default sizes and wraps to its own line at AX5. Custom actions on rows: Edit, Remind me, Change who can see this (household-entered dates), Where this fact comes from, Mark done (mover rows), Hide. Each custom action also has a visible control.
- Per-date ScopeChip: a 44pt (48dp) target that opens the DateSheet at its "Visible to: Only you · Household" control, so a date shared at claim can be made private again, one date at a time. On the voter self-report it is a static label.
- Year band: tapping the band scrolls to Dates. On native it is one adjustable element (swipe up or down moves by month). On web 1440 each month column is a focusable button labelled, for example, "November 2026, 3 dates, show in list"; clicking it highlights that month's rows, with a visible focus ring distinct from the highlight. The shaded window is not a target; only the footer link opens Today.
- Mover rows: tapping "Mark done" ticks the row in place. Hide collapses it to an InlineUndo, which stays until she leaves the screen. When all three are hidden, a quiet line reads "You can show these again in home settings."
- Widget ask: on Android "Add the widget" opens the system add-to-home-screen dialog directly; on iOS "See how to add it" opens the widget how-to sheet with the person's own preview. The widget is promoted at most once per 24 hours across Pantopus. The row hides once the app detects a placed widget (from the system's list of placed widgets or the add-to-home-screen confirmation), and whenever there is no place.
- "More you can add" expands in place.
- Mark done offline: the tick applies at once and the row adds "Saved on this device. It'll sync."
- Deep-link landing: scroll once, then fade the highlight.
- The count updates silently, with no count-up.
- Motion lasts 300ms or less. Under Reduce Motion, use cross-fades and a static skeleton.
- Haptics: one light tick (iOS light impact; Android confirm haptic) on "Mark done" only.
- DateSheet: iOS large sheet; Android ModalBottomSheet; right SlidePanel on web 1440; bottom SlidePanel on web 390. ProvenanceSheet: iOS medium detent; Android ModalBottomSheet; centred 560 modal on web 1440; bottom sheet on web 390. Sheets never stack.

FOUNDATIONS COMPONENTS USED
YearBand (place file variant), FourteenDayStrip (year-band shaded window), ProvenanceMark (XS in the band, S in rows), SourceCaption, ScopeChip (header chip; saved-place footer sentence; per-date compact variant, defined here and pending addition to prompt 00: the same 24pt pill, surface.sunken fill, 12pt person or house glyph, label 13/18 text.strong, labels exactly "Only you" / "Household", spoken "Visible to only you" / "Visible to your household", hit area 44pt because it opens the visibility control, shown only on household-entered dates: HOA dues, warranty, notice deadline, lease ends), FactCount (place file header; saved-place variant), FactRow (known, missing, promoted Next, not at this tier, done ask, declined, permission-disabled, "What moved when you claimed", "Your reports", Public records link rows), FirstWeekRow step set (drawn as rows, no fraction), DateRow (deadline, money, pickup, holiday moved), KindGlyph, LockedActionRow (names who can act; pending, no link; not at this tier), InlineUndo (hidden row, declined ask), LandingBannerSlot (sync merge; one-time claim receipt), FreshnessLine, OfflineNotice, InlineErrorRow, QuietDayReceipt (year band empty), WarmingSkeleton (instrument + row), MemberRow (collapsed), InviteRow, TextActionRow (outbound: USPS, utilities, VoteWA), DateSheet, ProvenanceSheet.

ACCESSIBILITY
- Reading order: title → address → scope → freshness → count → legend → banner → band summary → band → "See the next 14 days on Today" → Next for this place → sections in visual order (Just moved, Place, Public records for this address with Risk & readiness first, Dates, Money, People, Proof, More you can add).
- FactCount is read as "11 things on file: place, dates, money, people."
- The band's spoken summary is its summary line plus "The Dates list below has every date." Each month is read as, for example: "November: You, HOA dues Sunday 1 November, you added this. Your county, property tax second half due Monday 2 November, official. Your state, in-person voter registration until 8 PM Tuesday 3 November, official." On web 390 the band is hidden from screen readers except its summary, because the Dates list is its table.
- Marks are never targets on their own. Provenance is shape plus the legend word; "projected" is a word plus a dash; statewide is the bar's shape; a holiday move is a strike plus the caption. None rely on colour.
- Mover tick controls are spoken "Mark <row title> done"; when done, "<row title>, done".
- Disabled Resend, Add and Send a new code stay focusable and read out their reason. Banners and InlineUndo are status regions.
- At AX5: the band keeps its lanes but scrolls sideways at a readable scale, with lane labels pinned and visible "Earlier" and "Later" buttons. FactRows stack label and value, inline text buttons wrap to their own lines, and text wraps instead of truncating.

COPY (sentence case)
Everything quoted above, plus:
- Banners: "Synced 3 items from your other device" · "Your pickup day, 3 dates and Ollie came with you. · See what moved" (without phase 2: "Your pickup day and 3 dates came with you. · See what moved")
- Undo lines: "Hid 'Move your utilities' · Undo" · "Skipped 'Insurance renews' · Undo" · "Skipped 'Put today on your home screen' · Undo"
- Keeper re-entry (phase 2): "Give your place a keeper · Add"
- All known: "Everything we can hold about this place is on file"
- Reports: "Voter registration deadline · Checking · reported Sun 18 Oct · we'll check by Sun 25 Oct" · "Pickup day · Fixed Fri 16 Oct · recycling is every other Tuesday · Waste Connections" · "Property-tax appeal date · No change Wed 14 Oct · Clark County Board of Equalization lists Thu 1 Jul 2027, or 60 days after your notice"
- Member view: "Maya can add bills here." · "Maya can invite people here." · "Maya can rename Ollie." · "Maya can see and add bills here." · "Maya can add and change dates here."
- Access changed: "Your access to this home changed. Ask Maya to add you again."
- Deleted date: "That date was removed"
- Late postcard: "Send a new code" · "Your old code will stop working."
- Offline: "You're offline · as of 6:04 PM" · "Adding a date needs a connection." · "Resending needs a connection." · "Saved on this device. It'll sync."
- Error: "We couldn't load your place file just now · Retry"
- Done row: "Done · You marked this done Tue 16 Feb · Reminders off"

EDGE CASES
- Longest address "12517 NE Old Evergreen Highway, Unit 204, Vancouver, WA 98684" wraps to two lines and is never cut off.
- 3 or more marks in one lane-month on a phone show one mark with "3" below it.
- With no dates, the You lane is empty and the Next row is "Add one date that matters".
- A reminder link to a deleted date (?rule= points to a removed rule) lands at the top of Dates with the status line "That date was removed", opens no sheet, and never shows a blank screen.
- On a slow network, show the skeleton only after 1 second; cached content never blanks.
- An approximate date reads "about Dec 2026", counts as known, and offers "Add the exact day".
- An official seed not yet checked against its authority stays filled; its SourceCaption reads "not yet checked against the state site".
- Notifications off: the reminder caption still shows on the band and the reminder line still shows on the notice row, so the band carries the date.
- Widget already placed: the widget row is gone and the Next row moves to the insurance ask (Android frame).
- Postcard late (after Fri 30 Oct): "Send a new code" becomes enabled, with the caption "Your old code will stop working."
- Member view (Sam): the warranty (Only you) is hidden and not counted, so the count is "10 on file". The InviteRow is absent; People shows "You and Maya live here · View" plus the LockedActionRow "Maya can invite people here." Resend and the claim-receipt row are absent. Maya's voter self-report is never shown; Sam's own voter row is independent and unticked. Sam's mover caption reads "Shown until Thu 17 Dec, 60 days after you moved in". Sam is in his first week (joined Sun 18 Oct, block until Sun 25 Oct): "Join Maya's household" ticked; "Set your pickup day" ticked ("Tuesday, from your household"); "Add one date that matters" ticked ("Your household already has 3 dates"); the Next step "Turn on a reminder" (web) with the button "Turn on the pickup reminder", which opens pickup notification settings.
- Member without permission to edit dates: date rows are read-only, the Add actions are disabled, and a LockedActionRow reads "Maya can add and change dates here."
- A Guest sees "Bills · 3 on file" with "Maya can see and add bills here."
- Access revoked mid-session: rows go read-only and a LockedActionRow reads "Your access to this home changed. Ask Maya to add you again."
- On web, there is no widget row.
- Without phase 2 (no bills, no keeper), HOME A reads "8 on file" with pips Place · Dates · People, uses the no-phase-2 strings above, and the layout holds.
- Keeper re-entry: "Give your place a keeper · Add" is a quiet FactRow (text action, opens the keeper naming sheet), shown when no keeper is named or after Skip; never promoted; absent until phase 2 ships.

INSTEAD OF
- Instead of a five-segment ring or "3 of 6", draw "11 on file" with pips only for known categories — because any denominator reads as an unfinished task.
- Instead of a button on every missing fact, draw one filled Next row, at most two outlined asks, and the rest as quiet "Add" rows or behind "More you can add (2)" — because about ten competing asks lowers completion.
- Instead of four card styles for checklist, mover list, dates and ledger, draw one FactRow/DateRow list with one InlineUndo pattern — because this screen merges those four.
- Instead of day-accurate dots, side-by-side marks and an even pickup rhythm on phones, draw stacked month marks with counts below, tick-line service weeks, holiday moves and "projected" after Dec 2026 — because a 22pt cell cannot hold marks side by side, and the hauler publishes a year at a time.
- Instead of a dot for a statewide deadline, draw a full-lane-height bar in "Your state" — because it is not a fact about this house.
- Instead of the lease reminder on the lease-ends row, put the reminder series on the notice row — because a reminder anchored to the lease end fires after the last day to act.
- Instead of a static "Only you" label on each date, draw the per-date ScopeChip as a tappable control — because sharing a date must be as easy to undo as to do.
- Instead of red X's or failure rows on a saved place, or an empty band on error, draw neutral invitations with one grey "Not here — this is a saved place" row, and no band plus an InlineErrorRow — because missing is not broken, and an empty band means "checked, nothing found".

DONE WHEN
- The next step ends above the tab bar on the 393x852 dense frame, and it is the only filled button.
- A lease end 5 months away is visible on the band and editable in Dates.
- Nothing reads as percent complete, and a saved place looks smaller, not failing.
- This count equals the keeper's count, and Today's first-week row agrees about which steps are done.
- Every statewide or county date shows its source and scope label and cannot be read as a claim about this house; the voter mover row shows the deadline and its source.
- Scope is stated in the header, on each household date (and changeable there) and in the saved-place footer; a voter self-report is Only you and never a registration claim.
- Every mover row can be marked done with a visible control.
- Every promoted ask has Not now and Skip, and a skipped ask can be found again.
- A reminder for a date outside the 14-day strip lands on that row, and a deleted one lands on "That date was removed".
- The claim receipt, report outcomes and the hazard readings (with sources and observed time) can be found again from this screen.
- The widget row disappears once a widget is placed.
- The greyscale and AX5 frames still read correctly.

ARTBOARDS
1. x-place-file · ios · 01-dense-home · light — HOME A as of Mon 19 Oct, 6:10 PM: height budget met, Next row "See how to add it" above the tab bar, mover rows with Mark done ticks, everything above.
2. x-place-file · ios · 02-saved-place-first-week · light — PLACE B: Set up your place with the Next step, hollow Thursday pickup with no trailing action, stacked Thanksgiving move in the Nov city cell, grey saved-place row, footer.
3. x-place-file · web-390 · 03-member-view · light — Sam's view: 10 on file, "You and Maya live here", no InviteRow, LockedActionRow reasons, no Maya self-report, Sam's first-week block with "Turn on the pickup reminder".
4. x-place-file · ios · 04-hide-skip-undo · light — "Move your utilities" hidden with InlineUndo; voter mover row ticked with "We can't check registration status" and the static "Only you" chip; insurance ask skipped with InlineUndo and listed under More you can add (declined); the warranty row's "Only you" chip drawn as a 44pt control with its focus ring.
5. x-place-file · ios · 05-sync-merge · light — the sync banner shown once.
6. x-place-file · ios · 06-claim-receipt-banner · light — the one-time claim banner plus the persistent "What moved when you claimed" row.
7. x-place-file · ios · 07-reminder-landing · light — as of Mon 15 Feb 2027, 7:00 AM: band Feb 2027–Jan 2028, notice row highlighted with focus; a margin note shows the deleted-date landing with "That date was removed" at the top of Dates.
8. x-place-file · ios · 08-notice-done · light — Tue 16 Feb 2027: notice row quiet with a tick; lease ends stays.
9. x-place-file · android · 09-postcard-pending · light — PLACE B as of Mon 19 Oct after choosing postcard: grey row split, Proof pending LockedActionRow (requested Sun 18 Oct, expected Fri 23–Fri 30 Oct, expires Tue 17 Nov) with no link, separate outlined "Enter your code", disabled new-code with reason; a margin note shows the enabled "Send a new code" after Fri 30 Oct with "Your old code will stop working."
10. x-place-file · web-390 · 10-your-reports · light — the three reports expanded.
11. x-place-file · ios · 11-all-known · light — as of Mon 2 Nov 2026: "Insurance renews · renters insurance · in 4 months · Sat 13 Mar 2027"; NW Natural $38.40 "in 7 days · Mon 9 Nov"; Money "2 upcoming · $118.39 through Mon 9 Nov"; property tax "Today · due Mon 2 Nov"; voter "Tomorrow · in person until 8:00 PM Tue 3 Nov"; Proof "Address confirmed by postcard · Thu 29 Oct 2026"; lease document; widget placed; band Nov 2026–Oct 2027; "15 on file"; no Next row, the all-known line, no celebration.
12. x-place-file · ios · 12-empty-year · light — four empty lanes, "Checked — nothing on file for the next year".
13. x-place-file · ios · 13-loading · light — header plus instrument and row skeletons at full height.
14. x-place-file · web-390 · 14-error · light — no band, InlineErrorRow, the rest as usual.
15. x-place-file · android · 15-offline · light — cached content, disabled actions with reasons, one mover row ticked with "Saved on this device. It'll sync."
16. x-place-file · web-1440 · 16-dense-home · light — host nav rail kept, Overview content: exact days, leader line, focusable month columns (one shown focused), Next row "Add a date" (insurance), two columns, DateSheet as right SlidePanel ghosted at the edge.
17. x-place-file · android · 17-dense-home-widget-placed · light — no widget row, Next row moves to insurance; a margin note explains detection (placed-widget list or add-to-home-screen confirmation) and the once-per-24h rule.
18. x-place-file · ios · 18-ax5 · light — the band scrolls sideways with Earlier/Later; rows stacked; Hide on its own line; longest address wrapped.
19. x-place-file · ios · 19-greyscale · light — frame 1 in greyscale.
20. x-place-file · ios · 01-dense-home · dark — dark twin of frame 1.
21. x-place-file · ios · 02-saved-place-first-week · dark — dark twin of frame 2.
22. x-place-file · notes · 22-notes · light — assumptions and decisions: a zoomed inset of the Nov city cell at 22pt (moved mark over struck ghost, tick line below); the height-budget arithmetic; the Vancouver holiday calendar; official seeds drawn filled even when not yet checked, because hollow is only for facts a household can confirm (the saved-place and civic-details designs must follow this); the count rule replaces the design doc's list of counted facts by adding the address and move-in date (the keeper strip must use the same rule), an unconfirmed seed counts, and step status is separate; the empty-year premise; frames 7–8 dated 2027 and frame 11 dated Mon 2 Nov 2026; PLACE B saved Sat 17 Oct and unnamed; postcard dates for PLACE B and HOME A; Maya's mail tick on Sun 18 Oct; HOA dues treated as annual; the voter mover row copy changed from the design doc's "Moved in? Registration is per address. Deadline for November 3…" to name both methods, with VoteWA moved to the Dates row; the other moving steps covered by Place, Money and Dates, and without phase 2 the money step covered by the Money signals row; Proof kept as a quiet row at HOME A so the claimed state shows a real Proof ask; the household block lives in People and is designed separately, which is why frame 1 shows only the MemberRow line; the per-date ScopeChip is a new compact variant pending in prompt 00, drawn as a tappable control (an earlier review asked for a static label; the research on reversible sharing wins); "Enter your code" sits outside the pending LockedActionRow because that variant has no link; move-in on a saved place uses a DateSheet move-in kind, which the DateSheet design must add, and makes mover rows appear on a saved place; Sam's "3 dates" excludes Maya's private warranty; a drawn specimen of "Give your place a keeper · Add" (phase 2); every invented string (the longest address, recurrence captions "Every year" and "One time", Sam's first-week steps, the access-changed line, "Maya can add and change dates here.", "That date was removed", the late-postcard caption, the USPS and utility link labels, the Mail Day row, "Public records for this address"); omitted states.

BATCH PLAN
Turn 1: artboards 1–6, then wait for "continue". Turn 2: 7–12, then wait for "continue". Turn 3: 13–18, then wait for "continue". Turn 4: 19–22.
