# Pantopus shared component contract (the Foundations board)

Every prompt refers to these by exact name. Designed first, in prompt 00.

## Glossary — canonical terms and forbidden synonyms

- Saved place — a private bookmark (T1). Not: bookmark, preview, draft, pending place, home.
- Home — a claimed address shared with the household (T3). Not: house, property, your place (for T1), dwelling. 'Our house' is allowed only as a user-given nickname.
- Claim this address — the T1→T3 action. Not: set up a Home, add home, own it.
- Your household — the people who share a claimed home. Not: family, members (in user copy), co-owners, residents' group.
- Only you — the saved-place visibility. Not: private to you, just you, nobody else.
- Verify this address / Address verification — the proof of residence (T4). Not: validate, confirm your home, get verified, verified badge, Household access (for members).
- Confirm this person lives here — owner attestation. Not: vouch, approve member, grant access.
- Place file — the Place-tab list of every fact. Not: dashboard, profile, what we know, checklist, ledger.
- On file — facts held for the address. Not: knows, collected, tracked, your data score.
- Official — filled mark. Not: verified, confirmed (for public data), trusted.
- On record, not confirmed — hollow mark. Not: unverified, estimated, guessed, pending, probable.
- You added this — tick mark. Not: user-entered, self-reported, manual.
- Source — the authority named on a fact. Not: provider, feed, partner.
- Where this fact comes from — the provenance sheet title. Not: details, info, learn more, about this data.
- This isn't right — the report control. Not: dispute, flag, report error, wrong?
- Pickup day — the collection weekday. Not: trash day, garbage day, collection schedule, bin day (in titles).
- Recycling and garbage / Garbage only — pickup contents. Not: trash + recycling, waste, refuse; use 'Recycling + garbage' only in 30-character push titles.
- Holiday move — a shifted pickup ('moved to Fri 27 Nov'). Not: delay, cancellation, skip.
- Date — any dated fact the user tells the app. Not: event, reminder, deadline item, calendar entry (except household events).
- Reminder — the notification before a date. Not: alert, nudge, ping.
- Alert — reserved for air and NOAA threshold crossings. Not for pickup, dates or bills.
- Briefing — the morning or evening summary push. Not: digest, daily update, heads-up (except 'A morning heads-up?' as the ask).
- Notifications — the OS channel. Not: push alerts, pings. 'Push' only in technical settings copy.
- Widget — the home-screen tile 'Today at your address'. Not: shortcut, glance, card.
- Today — the tab and its composition. Not: Hub, Home feed, briefing screen, dashboard.
- Nearby / Mail / Place — the other three tabs. Never add or rename a tab.
- Flood zone — FEMA designation. Not: flood risk, 100-year floodplain, flood score.
- Wildfire hazard — USFS WHP. Not: wildfire risk, fire danger, fire score.
- Air quality (AQI) — EPA index; spell out 'air quality index (AQI)' once per surface. Not: air score, pollution level.
- Radon zone — EPA county zone. Not: radon risk, radon level (that is a test result).
- Reading — a value on one layer. Not: grade, score, rating, verdict.
- Different band / Same band — compare differences. Not: better, worse, wins, higher risk, both highest.
- Compare with a friend — the share-to-compare action. Not: challenge, vs, battle, rate your place.
- Nearby average — the k-anonymous peer line. Not: your neighbors, neighboring households, the going rate (in UI copy).
- Invite — a household invitation. Not: add member, add guest form, request.
- Member / Guest / Admin / Owner — household roles. Not: resident, co-owner, user.
- Just me — the household decline. Not: skip, no thanks (on that block), live alone.
- Not now — a deferral that never re-asks on its own. Always paired with a permanent decline (Just me / Skip / No thanks).
- Mark paid — records a bill claim. Not: pay, paid (as a verb in notifications: use 'marked … paid').
- Mail snap / Photo of your mail — a captured image. Not: scan (for the stored object), upload, document, receipt. 'Scan today's stack' is the capture action only.
- Confirm what we read — extraction review. Not: verify, approve AI, check OCR; never 'AI' or 'OCR' in user copy.
- Keeper — the named creature. Not: pet, mascot, buddy, avatar, assistant; it never 'knows', 'misses' or 'wants'.
- Block Founder — the permanent rank. Not: Founding Neighbor, founder badge, early adopter.
- Founding Neighbor — the scarce first-5 tier with a closing date. Not: Block Founder, founding member, VIP.
- Block Builder — the 25-join tier. Not: super-inviter, ambassador.
- From Pantopus — the curated-post chip. Not: Pantopus curator, bot, official post, staff.
- Postcard invite — a mailed neighbor invite. Not: invite card, mailer, letter.
- Updated / As of — freshness. Not: synced, refreshed at, last seen.
- You're offline — the offline state opener. Not: no internet, connection lost, network error.
- Checked — nothing … — a finished empty state. Not: no results, empty, nothing here yet, all caught up.

## Components

### ProvenanceMark
- **Purpose:** The only way the product says how sure it is about a fact. Three shapes, one meaning each, used everywhere. Design it first on the Foundations board, before any other prompt.
- **Anatomy:** Three silhouettes: OFFICIAL = solid disc; UNCONFIRMED = ring; YOU ADDED = solid disc with the tick knocked out (a cut-out, not a second colour, so it survives one-colour tinting). Ink is text.secondary (#6B7280, 4.83:1) or darker in light mode and dark text.secondary (#94A3B8) in dark mode. Never border.* or text.muted. Ring stroke is at least 1.5px. Sizes: XS 12pt/dp, the smallest size at which the three shapes must still be told apart (strip cells, widget, tray previews); S 16pt (list rows, captions); M 24pt (sheet legend); L 56pt (provenance sheet header). Below 12pt no mark is drawn and the row prints the provenance words instead. On an OG card, draw at least 28px at 1200 wide. Spacing: 8pt (spacing.2) between the mark and its text.
- **Variants:** official (filled) · unconfirmed (hollow) · you-added (filled + knocked-out tick) · read-from-your-photo: pre-commit machine read. Draw it with the unconfirmed ring plus the text flag 'We weren't sure — check this' where uncertain. It becomes you-added on commit · stale: same shape, 50% opacity, paired with the words from FreshnessLine · reported: shape unchanged, plus a StatusLine 'You reported this · checking'
- **States:** default · stale (dimmed + age words) · inside tap target (the enclosing row or cell is the target, never the mark) · tinted/accented widget rendering (silhouette only) · greyscale
- **Accessibility:** Every mark has a fixed spoken name: 'official', 'on record, not confirmed', 'you added this'. The name is appended to the row label, e.g. 'Trash day Tuesday, City of Camas, on record, not confirmed'. The shape is the non-colour encoding, and colour is never used. The mark is never a tap target on its own: the enclosing row or cell is, at 44pt iOS / 48dp Android / 44 CSS px web. Contrast is at least 3:1 in both themes. The mark scales with Dynamic Type or sp up to AX5, and each surface shows a legend or a first-occurrence word once.
- **copyRules:** Legend strings (exact): '● Official' · '○ On record, not confirmed' · '✓ You added this'. Print the word next to the glyph once per surface; on standalone surfaces (widget, OG card, push landing) print it next to every glyph. Never print a bare 'Unverified' suffix on every row. In a push, the caveat goes at the front of the title (see PushCopy).
- **platformNotes:** iOS widgets: the mark is widgetAccentable and the tick must stay knocked out under accented rendering. Android widgets: fixed ink, not a Material dynamic role. Web: inline SVG with role=img and an aria-label.
- **doNot:** Never use filled-vs-hollow for any other meaning: not sender vs you (compare), not taken vs open slot (founding meter), not density. Never add a confidence percentage, bar or star. Never mark an official public dataset (EPA radon zone, USFS WHP) hollow: it is filled, and its limit goes in the ScopeWord of the SourceCaption. Never draw the tick in a second colour on top of the disc. Never make an 8px dot the target.
- **Used in:** x-provenance-sheet, x-date-sheet, x-place-file, f5-today-calendar-strip, f4-today-pickup-card, f7-today-widget, f7-widget-gallery, f7-widget-howto-sheet, f7-widget-tap-landing, f1-today-tab, f3-household-calendar, f3-household-notifications, f8-scale-strips, f8-compare-arrival-header, f8-compare-reveal, f8-compare-sheet, f8-og-compare-card, f8-seasonal-aha, f6-place-section-details, f10-extraction-confirm, f10-bill-provenance, f10-bill-trend, f10-mail-day-triage, f11-keeper-strip, f1-claim-receipt

### SourceCaption
- **Purpose:** Puts the minimum provenance on the value itself: who says it, what it covers, and when. Almost nobody opens the provenance sheet, so the caption has to carry the caveat.
- **Anatomy:** One line of caption (12/16/400) in text.secondary on base, raised or app surfaces, and in text.strong on sunken. Pattern: [ProvenanceMark S] Authority · scope word · as-of. Wraps to two lines and never ellipsises the authority. An optional trailing external-link glyph appears only when a source URL exists.
- **Variants:** dated static: 'FEMA · area zone · effective Sep 24, 2021' · live: 'AirNow · nearest monitors · observed 3:10 PM today' · frozen token: 'AirNow · on Sep 12, 2026' · county scope: 'EPA · county-wide estimate — only a test tells you about this home' · collapsed sources line at 320–360px: 'Sources: FEMA, USFS, AirNow, EPA'. Time-varying rows keep their own time · no URL: flat caption, not tappable
- **States:** default · stale (the as-of age appended: '— 9 hours ago') · offline ('as of Sep 15')
- **Accessibility:** Contrast at least 4.5:1. It is read after the value in the row's merged label. Links use primary.700 in light mode and #38BDF8 in dark mode. There is no hover-only content.
- **copyRules:** Always authority · scope · as-of. Use the authority's own word: 'hazard' or 'potential', never 'risk' unless the source says risk. Received-by deadlines say 'must arrive by'. Never 'Sources:' at widths above 360.
- **platformNotes:** Same everywhere. On the OG image the caption is at least 28px and may be merged into one sources line; full captions go in og:description.
- **doNot:** Do not hide the source behind a tooltip or 'learn more'. Do not label a frozen reading 'today'. Do not make a caption with no URL tappable.
- **Used in:** f8-scale-strips, f6-place-section-details, f1-today-air-band, f8-seasonal-aha, f8-compare-arrival-header, f8-compare-reveal, f8-og-compare-card, f8-compare-sheet, x-provenance-sheet, x-place-file, f4-today-pickup-card, f5-today-calendar-strip, f3-household-calendar, f10-bill-trend

### ScopeChip
- **Purpose:** States who can see this address data: only you, or your household. It appears on every surface that shows address data.
- **Anatomy:** Pill, radius pill, height 24pt (hit area 44pt when it opens the control that changes scope). A 12pt glyph (person = Only you; house = household) plus a label in label 13/18. Fill is surface.sunken; text is text.strong (9.37:1). No success-green and no identity colour fill; the house glyph may use identity.home only as an icon, at 3:1 or better.
- **Variants:** saved place: 'Saved place · Only you' · claimed home: 'Your household' · named home in multi-home contexts: 'Maple St · Your household' · scope-change pair (claim receipt): person glyph → house glyph, with a pending state that is dashed until consent · footer sentence form (sheets): 'Only you will see this.' / 'Everyone in this household will see this.'
- **States:** default · pending share (dashed house glyph) · declined share (person → person) · struck (old scope on claim receipt)
- **Accessibility:** Spoken as 'Visible to only you' or 'Visible to your household'. It is never colour-only: glyph plus words. It wraps at AX sizes.
- **copyRules:** Exactly these strings: chip 'Saved place · Only you' / 'Your household'. Sentence 'Only you will see this.' / 'Everyone in this household will see this.' No other wording ('Only you see this', 'Only you can see these', 'private to your home' are retired). A saved place never uses the words home, household or claim.
- **platformNotes:** Identical on all platforms. On push landings it sits next to the address in the location row.
- **doNot:** Never drop it from an alert landing. Never use a green 'verified-looking' chip to mean membership. Never say 'Everyone in this household' where finance permissions differ: name the people instead ('You and Sam can see these photos').
- **Used in:** f1-today-tab, f1-today-air-band, f1-your-places, f1-add-place-sheet, f1-save-confirmation, f1-email-verify-handoff, f1-claim-receipt, x-date-sheet, x-place-file, f4-today-pickup-card, f7-widget-tap-landing, f9-privacy-mirror, f11-keeper-naming, f11-keeper-strip, f3-household-notifications, f10-mail-day-triage, f10-snap-capture-tray, f10-mail-snap-privacy, f10-mail-piece-photo

### ProvenanceSheet
- **Purpose:** The single place where provenance is prose: where the fact came from, how sure we are, what it covers, and how to report it.
- **Anatomy:** Header: ProvenanceMark L plus the legend line (the current shape emphasised). Authority (label), observed or updated time (caption), a confidence sentence (body 16/24), a 'Covers' line (All of Clark County / This parcel / Your household), a source row (a 44pt row with an external-link glyph, or a flat caption), then the fact-type-specific report control at the foot. Web: centred modal 560 wide. Mobile web: bottom sheet. iOS: medium detent. Android: ModalBottomSheet. Visible Close.
- **Variants:** schedule fact: self-fix first ('Set my pickup day'), then 'Also tell us the city's schedule looks wrong' · hazard owned by an authority: 'Only FEMA can change this' with a LOMA link. Radon: 'Get a free test kit' · wrong-place (our geocoding): report to Pantopus · air reading: 'This reading looks wrong' · opened from another sheet: replaces the content with a Back control and does not stack
- **States:** official · unconfirmed · you added · no URL · reason picker open · reported · checking (receipt with a check-by date) · resolved (Fixed <date> / No change + reason + source) · report failed + Retry · offline (report disabled, reason stated)
- **Accessibility:** Unique title 'Where this fact comes from'. Focus goes into the sheet and returns to the invoking row on close. Report status is a polite live region.
- **copyRules:** The confirmation names a date: 'Reported Sep 16. We'll check it against City of Camas Public Works by Sep 23 and tell you here.' Confidence sentences are specific: 'Preliminary reading from AirNow, observed 8:00 AM.' / 'County zone from EPA. It says nothing about your home's level; only a test does.' Never promise to 'check' a FEMA or EPA designation.
- **platformNotes:** Android Back and web Escape close it.
- **doNot:** No percentage or meter. No red destructive 'This isn't right'. No 'The date is wrong' option on undated facts. No stacked second sheet.
- **Used in:** x-provenance-sheet, f5-today-calendar-strip, f4-today-pickup-card, f1-today-air-band, f8-scale-strips, f10-bill-provenance, f3-household-calendar, f8-seasonal-aha, f6-place-section-details, x-place-file

### FreshnessLine
- **Purpose:** One persistent line that states how old the content is: refresh, stale and offline all go here instead of a toast.
- **Anatomy:** Caption 12/16 in text.secondary, placed directly under the location row or card header. Optional leading 16pt glyph (offline cloud or retry). An optional 2pt indeterminate hairline under the header runs only if the refresh takes 1s or longer.
- **Variants:** 'Updating…' · 'Updated just now' / 'Updated 12m ago' / 'Updated 2h ago' (system relative date) · 'Couldn't refresh · Retry' · 'You're offline · as of 7:04 AM' · per-fact stale: 'Observed 6:00 AM · AirNow — 9 hours ago' · widget past horizon: 'As of Mon 7:40 AM · Open to refresh'
- **States:** fresh · refreshing · stale · failed · offline
- **Accessibility:** A polite live region for changes and never assertive. It is not colour-only: stale is stated in words. Retry has a 44pt target. Ageing text is announced once, not every minute.
- **copyRules:** Relative time for recency; 'as of' plus absolute time for offline or frozen data. Never 'Last synced'. Never a disappearing toast as the only proof.
- **platformNotes:** Widgets use system Text(date, style: .relative) on iOS. Android uses its equivalent in the widget.
- **doNot:** Do not dim, skeleton or reflow a warm screen while refreshing. Do not grey a whole widget when only AQI is old.
- **Used in:** f1-today-tab, f7-widget-tap-landing, f7-today-widget, f1-today-air-band, x-place-file, f9-invite-rewards-card, f9-nearby-cells-map, f11-keeper-strip, f10-bill-trend, f3-bills-list, f3-members-roster, f1-your-places

### OfflineNotice
- **Purpose:** One pattern for 'no connection': cached content stays readable, actions are disabled with a stated reason.
- **Anatomy:** FreshnessLine in its offline variant at the top, plus a per-control reason caption under each disabled control ('Compare needs a connection.'). No banner colour: surface.sunken with text.strong, or plain.
- **Variants:** read-only cached screen · queued writes ('Will upload when you're back online') · form offline ('You're offline. We can't look up an address right now.')
- **States:** offline · reconnecting · back online (the line reverts to FreshnessLine)
- **Accessibility:** Disabled controls stay focusable with the reason read out. Status is announced politely.
- **copyRules:** Start with "You're offline." and then say what still works.
- **platformNotes:** Same everywhere.
- **doNot:** No full-page offline illustration. No silent dead buttons.
- **Used in:** all surfaces with an offline state (43 of 59 prompts)

### QuietDayReceipt
- **Purpose:** Makes silence readable: a finished 'nothing needs you' state with the checks that were run.
- **Anatomy:** Heading h3 'Nothing needs your attention today', then one row of four CheckItems: weather · air · alerts · your calendar. Each CheckItem is a 16pt tick glyph in text.secondary plus a caption label, and optionally the source time. All in one card on surface.base. No illustration.
- **Variants:** Today full · widget one-liner ('Checked 6:00 PM · nothing needs you tonight') · briefing settings row ('Skipped tonight — nothing needed you') · strip empty ('Checked — nothing in the next two weeks') · year band empty ('Checked — nothing on file for the next year')
- **States:** all ticked (only state that shows the heading) · one pending (CheckItem shows a spinner-free pending dot; heading absent) · one failed (CheckItem reads 'Couldn't reach AirNow · Retry'; heading absent)
- **Accessibility:** Read as a list: 'Checked: weather, air, alerts, your calendar.' Ticks are paired with words. Retry is 44pt.
- **copyRules:** The heading is shown only when every check succeeded. Never 'All caught up', 'Inbox zero' or 'You're all set'.
- **platformNotes:** Same everywhere.
- **doNot:** Do not flash the heading before every provider has returned. No cheerful illustration.
- **Used in:** f1-today-tab, f5-today-calendar-strip, x-place-file, f7-today-widget, f4-briefing-optin-card, f4-notification-settings, f11-keeper-strip

### WarmingSkeleton
- **Purpose:** Content-shaped placeholders in their final slots for cold loads of 1–10s, so nothing jumps when data arrives.
- **Anatomy:** surface.sunken shapes that match the final geometry (strip cells, track outlines, row bars, avatar circle, ring outline), radius matching the component. Reserves the exact final height.
- **Variants:** section skeleton (Today) · row skeleton (lists) · instrument skeleton (strip, year band, scale strip, bill trend with 12 varied columns) · panel skeleton (cells map)
- **States:** shimmer (default) · static (Reduce Motion) · replaced progressively as each provider lands
- **Accessibility:** The container has aria-busy / an accessibility label 'Loading' once and is not read shape by shape. Under Reduce Motion there is no shimmer.
- **copyRules:** No text inside skeletons, and no 'checking…' claims.
- **platformNotes:** Skip skeletons for loads under ~1s and on warm screens (the widget path).
- **doNot:** No full-page spinner. No frame-only skeletons. No skeleton for anything that fails closed (the founding meter, the Earn row).
- **Used in:** f1-today-tab, x-place-file, f5-today-calendar-strip, f1-your-places, f3-members-roster, f3-household-block, f3-member-home-dashboard, f8-compare-reveal, f8-compare-arrival-header, f9-privacy-mirror, f9-nearby-cells-map, f10-bill-trend, f11-keeper-strip, f7-widget-tap-landing

### ScaleStrip
- **Purpose:** The four-layer reading instrument: one authority's own ordered bands per row. It must never add up to a grade.
- **Anatomy:** Row: layer name (label) → value line 'Word · number' (bodyMedium) → track → SourceCaption. Track height 12pt at detail size, 30px or more on the OG card. Bands are neutral surface.raised, divided by 1.5px separators in ink of 3:1 or better, with a keyline around the whole track. Occupied band: an outline of 3:1 or better plus the band name printed next to the marker. Marker: 12pt two-tone (text.primary core, 2px surface.base halo). Row height is 48pt minimum at detail size (the whole row is the target). Sizes: detail (full width), compare (390), OG column (520 of 1200). Fixed order: Flood · Wildfire · Air · Radon. Air uses AqiBand inside the instrument.
- **Variants:** Flood (3 bands by annual chance: Minimal (X) · 0.2% a year (shaded X) · 1% a year or more (A/V zones); the actual zone code is printed in the label) · Wildfire (5: Very low … Very high; 'Moderate · 3 of 5') · Radon (3 ordered Zone 3 → Zone 2 → Zone 1; 'Zone 1 — highest potential (county)', no 'N of M') · Air (AqiBand) · compare: two markers on one track — sender pointer labelled with first name above, 'You' pointer below, same marker form; merged 'Same band' label · no data: greyed track, no marker, 'Not on record' · not studied: 'FEMA hasn't mapped flood hazard here' · non-burnable: 'Non-burnable land cover (USFS)' · frozen: captions 'as of Sep 12, 2026' · collapsed text line (<640px arrival): 'Dana · Camas, WA · Flood X · Wildfire Moderate · Air 42 · Radon Zone 1 ›'
- **States:** loading (track outlines) · ready · partial · differs tag ('Different band', neutral chip) · stale air row · AX5 (text above a full-width track)
- **Accessibility:** Each row is one element: 'Wildfire hazard potential: Moderate, 3 of 5, scale Very low to Very high. USFS 2023. Official.' Position plus a printed name (never colour). Row target 44pt / 48dp. A table equivalent is implicit because the rows are text.
- **copyRules:** Approved strings: 'Zone X — minimal flood hazard'; 'Zone AE — 1% chance each year (about 1 in 4 over 30 years)'; 'Wildfire hazard potential: Moderate · 3 of 5'; 'Radon Zone 1 — highest potential (county)'. Never '100-year floodplain', 'minimal risk' or 'wildfire risk'. Sender rows describe places: 'Dana · Camas, WA — what's on record for this area'.
- **platformNotes:** Web SVG; SwiftUI / Compose native. The OG render uses the same geometry scaled; text is at least 40px cap.
- **doNot:** No letter grade, score, star, radar chart or cross-layer colour ramp. No shared axis. No re-sorting by distance. No arrows, winners or better/worse. No filled-vs-ringed for sender vs you.
- **Used in:** f8-scale-strips, f6-place-section-details, f8-compare-arrival-header, f8-compare-reveal, f8-compare-sheet, f8-og-compare-card

### AqiBand
- **Purpose:** The one officially coloured scale: EPA AQI with category name, used identically everywhere air appears.
- **Anatomy:** Six segments in EPA ColorVision Assist hues (the single sanctioned token exception): Good 158,255,145 · Moderate 255,201,5 · USG 255,130,5 · Unhealthy 240,34,0 · Very Unhealthy 137,9,151 · Hazardous 100,0,21. Equal-width category segments (the marker is positioned within its segment), the last labelled '301+'. 2px surface gaps between segments plus a keyline in ink of 3:1 or better in both themes. Two-tone halo marker. Band name and number printed in text.primary on the card, never on the fill. Value line 'AQI 118 · Unhealthy for Sensitive Groups · PM2.5'. EPA health statement verbatim (body), with Pantopus context as a separate line labelled as ours. Optional threshold rule at the user's chosen threshold (101/151/201) with 'Crossed 151 at 4:00 PM'.
- **Variants:** detail (Today) · instrument row · widget micro (medium: no numbers under segments; name plus number beside it) · no reading (greyed bar, no marker, 'No reading for this address right now') · alert (threshold rule + ScopeChip) · still above threshold, no new push
- **States:** ready · stale · no reading · alert · offline
- **Accessibility:** 'Air quality index 118, Unhealthy for Sensitive Groups, category 3 of 6. AirNow, observed 4 PM.' Separators make it readable in greyscale; the name carries meaning in tinted widgets.
- **copyRules:** EPA category names verbatim. The Good statement: 'Air quality is satisfactory, and air pollution poses little or no risk.' Short form 'Sensitive groups' is allowed only in the widget.
- **platformNotes:** Android widget keeps the EPA hues fixed, not dynamic colour.
- **doNot:** No proportional 0–500 track. No brand-blue or invented ramp. No text on fills. No 'satisfactory for everyone' paraphrase. Never hide the band on a good day.
- **Used in:** f1-today-air-band, f8-scale-strips, f6-place-section-details, f7-today-widget, f7-widget-gallery, f7-widget-howto-sheet, f7-widget-tap-landing, x-provenance-sheet, f8-og-compare-card, f8-compare-reveal

### FourteenDayStrip
- **Purpose:** The next two weeks at this address as a shape, above list rows that are the real tap targets.
- **Anatomy:** 14 equal cells across the card's content width (about 23–26pt on phones), today leftmost. Weekday labels: 'Today' at the left plus the date at week starts (full initials only where the pitch is 20pt or more). Weekend cells are drawn with a lower-opacity fill, not a hue. Each cell holds up to 3 XS ProvenanceMarks in one ink, then '+1'. A civic/state/county rule is a full-height bar spanning the cell. A holiday move puts the mark on the moved day and a struck ghost on the usual day. Below: DateRows. The foot is a persistent '+ Add a date' row.
- **Variants:** Today card · widget medium (full 306pt content width, anchors-only labels) · year-band shaded window (x-place-file) · empty (drawn cells + QuietDayReceipt line + '+ Add a date')
- **States:** loading · ready · empty · stale · permission-denied (no add row) · T1 · error (no strip drawn) · highlighted row on push arrival (focus also moves to the row)
- **Accessibility:** On native the strip is one adjustable element: swipe up/down moves a day and reads 'Tuesday 20 October: Recycling and garbage, city schedule, on record, not confirmed'. Cells are not individual targets; tapping the strip scrolls to the list. On web, a list of full-date labels, or hidden when the rows duplicate it. Initials are never spoken.
- **copyRules:** Summary label 'Next 14 days: 9 items'.
- **platformNotes:** Per-cell tap is allowed only on desktop web.
- **doNot:** No class hue as the only cue. No 6pt dots with ticks. No 14 tiny tap targets. No statewide dot. No even rhythm through a holiday week.
- **Used in:** f5-today-calendar-strip, f7-today-widget, f7-widget-gallery, f7-widget-howto-sheet, f7-widget-tap-landing, f1-today-tab, x-place-file

### YearBand
- **Purpose:** Twelve months of dated rules in four source lanes; the same data as the strip at a longer zoom.
- **Anatomy:** 12 month columns with three-letter labels. Four labelled lanes: You · Your city · Your county · Your state. On phones, markers are grouped per month per lane (a cluster, with a count numeral when there are 2 or more); exact-day placement only at 768px and above. Statewide rules are full-lane-height bars. A today rule (1.5px text.primary) and a shaded 14-day window. The pickup lane shows service weeks as a light rhythm with holiday moves and 'projected' styling after the last published city calendar. Reserves its height while loading.
- **Variants:** place file · widget large (338×354pt, drops to text at AX sizes) · gallery sample · empty checked
- **States:** loading · ready · empty checked · error (not drawn) · offline (as of)
- **Accessibility:** Summary: 'Next 12 months: 9 dates. Next: Furnace warranty ends Nov 14.' The fact rows below are the table, and the band says so. Month cells are adjustable on native.
- **copyRules:** Lane labels exactly: You · Your city · Your county · Your state. On the widget use place names (You · Camas · Clark County · Washington).
- **platformNotes:** —
- **doNot:** No heatmap. No collapsing the lanes. No day-accurate dots on phones.
- **Used in:** x-place-file, f7-today-widget, f7-widget-gallery

### DateRow
- **Purpose:** One dated fact in a list: the row grammar shared by the strip list, calendar agenda, place file Dates and reminder rows.
- **Anatomy:** Height 56pt minimum. Leading KindGlyph 24pt · title (body) · line 2 caption: relative + absolute date ('in 11 days · Fri 30 Oct'; 'Tonight', 'Today' and 'Tomorrow' stand alone) · SourceCaption short form · trailing ProvenanceMark S. Optional ScopeChip ('Statewide — WA'). Annual or self-entered rows get a 2px identity.home left rule plus a recurrence caption. Approximate dates read 'about Dec 2026'.
- **Variants:** pickup (names the bins: 'Garbage only' vs 'Recycling and garbage') · holiday moved ('Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar') · deadline (weekday always shown; 'must arrive by') · conditional rule ('Closes July 1, or 60 days after your value notice was mailed') · reminder notification row · money row (amount)
- **States:** default · highlighted (infoBg wash + outline, decays; focus moves) · done (text.secondary + tick) · permission-hidden (no ghost row)
- **Accessibility:** One element with custom actions (Edit, Remind me, Where this comes from, Mark done). Spoken in visual order.
- **copyRules:** The title names the action for deadlines ('Tell your landlord in writing by Sun 31 Jan'). Dates are spelled out, never 10/11/2026.
- **platformNotes:** —
- **doNot:** Annual dates never inherit overdue red. No generic calendar icon for all kinds.
- **Used in:** f5-today-calendar-strip, f3-household-calendar, x-place-file, x-date-sheet, f3-household-notifications, f7-today-widget

### KindGlyph
- **Purpose:** One drawn glyph per dated kind, used in tiles, rows, pickup card and widget.
- **Anatomy:** 24pt line icons on a 2pt stroke, in text.strong, with a 42pt rounded tile variant (radius lg). Set: garbage, recycling, garbage+recycling, bulk, move-in, lease ends, notice deadline, insurance renews, warranty ends, HOA dues, property-tax (appeal / due), voter registration, bill, home event, task, package.
- **Variants:** row 24pt · tile 42pt · widget 16pt · tray (monochrome)
- **States:** default · selected tile (filled radio dot + bold label, distinct from focus) · disabled
- **Accessibility:** Decorative when a text label is adjacent; otherwise labelled with the kind name. Always paired with visible text.
- **copyRules:** Tile labels: Pickup day · Move-in date · Lease ends · Notice deadline · Insurance renews · Warranty ends · HOA dues · Property-tax appeal · Voter registration · Bill.
- **platformNotes:** —
- **doNot:** No hue-coded glyphs as the only class cue.
- **Used in:** x-date-sheet, f5-today-calendar-strip, f4-today-pickup-card, f7-today-widget, f10-extraction-confirm, f3-household-calendar, x-place-file

### DateSheet
- **Purpose:** The one write path for every dated fact: create, view, edit, remind, delete.
- **Anatomy:** Title per mode ('Add a date' / the kind name). Kind grid (2 columns of KindGlyph tiles; 1-column list at AX sizes, scrollable). Date field: typeable and a calendar (iOS compact with month/year jump; Android docked or text-input mode for far dates; web typeable input) plus a 'Not sure of the day' toggle. Optional title. ReminderLeadControl. Footer ScopeChip sentence. Primary Save. Visible Close. Seeded mode: fields locked, mark plus authority, Remind me and report still live. Pickup kind: weekday chooser, frequency (Not set / Weekly / Every other week), 'Next recycling' anchor field plus a read-only preview of the next 3 dates. Lease kind: 'How much notice does your lease require?' (20 / 30 / 60 / other) creates a linked Notice deadline row. Voter kind: person-scoped, method picker (Online / Mail / In person), 'I did this' self-report ('You marked this done'), and an outbound 'Check or update at VoteWA'.
- **Variants:** create · view-mine · view-seeded · bill mode (pre-filled from a snap) · conditional seeded (tax appeal asks the mailing date)
- **States:** saving · saved (status message) · collision (inline row with Replace / Add separately / Cancel) · per-kind validation with a suggested fix · permission-denied (fields shown disabled, reason) · deleted → InlineUndo · offline · OCR unreadable (blank fields, never $0.00 or today)
- **Accessibility:** Unique title; focus is trapped. Errors appear next to fields and say what to do. Paste allowed. No auto-focus jump after tile pick when a screen reader is on.
- **copyRules:** 'Online or by mail — must arrive by Mon 26 Oct 2026'; 'In person, Clark County Elections — until 8:00 PM Tue 3 Nov 2026'. Validation: 'That's already passed — remind 7 days before (Thu 24 Sep)?'
- **platformNotes:** Web: SlidePanel (right on desktop, bottom on mobile). iOS .sheet large. Android ModalBottomSheet.
- **doNot:** No wizard steps. No inferring the recycling date. No destructive confirm dialog. No per-kind separate sheets. No calendar-only entry for far dates.
- **Used in:** x-date-sheet, x-place-file, f5-today-calendar-strip, f4-today-pickup-card, f6-place-section-details, f3-household-calendar, f10-extraction-confirm, f10-mail-day-triage, f6-home-basics-rows

### ReminderLeadControl
- **Purpose:** Shows every reminder that will actually fire, on a small timeline back from the date the person must act.
- **Anatomy:** Segmented control 60 / 30 / 7 / 1 days (becomes radio rows or a 2×2 at AX sizes), 44pt tall. Below it, a mini timeline: three ticks (the chosen lead, the day before, the day of) each labelled with its real date ('Thu 12 Nov 2026'), with a leader line to the event.
- **Variants:** date sheet · extraction confirm (7 default) · lease: anchored to the Notice deadline
- **States:** default · lead already passed (suggested alternative) · disabled
- **Accessibility:** Selected state has a text label and a fill change, not colour alone. Summary spoken: 'Reminders on Thu 12 Nov, Fri 11 Dec and Sat 12 Dec.'
- **copyRules:** Caption: 'We'll also remind you the day before and on the day.'
- **platformNotes:** —
- **doNot:** Never show one lead when three fire. Never anchor a lease reminder to the lease end date.
- **Used in:** x-date-sheet, f10-extraction-confirm

### PickupCard
- **Purpose:** Tomorrow's pickup: what, when to set out, how sure we are, and a one-tap confirm or correct.
- **Anatomy:** Emphasis card on surface.base with an lg radius. KindGlyph 42pt · headline h3 naming the bins · instruction from the source ('Bins out tonight — curbside by 6:30 AM') · SourceCaption with the mark and the words 'City schedule, not yet confirmed' exactly once · two peer buttons of identical weight (outlined): 'Yes, Tuesday is right' / 'Change pickup day'.
- **Variants:** unconfirmed · confirmed ('You · Tuesday' / 'Sam · Tuesday, confirmed 3 Oct 2026') · holiday moved · no rule (single line 'Set your pickup day') · bulk · T1 (footer 'Only you will see this.') · widget small hero · tray preview (see PushCopy)
- **States:** saving · confirmed just now (inline hint to reminders / widget) · error · offline (actions disabled) · highlighted on arrival
- **Accessibility:** Buttons labelled 'Confirm Tuesday pickup' / 'Change pickup day, opens date sheet'. 44pt / 48dp.
- **copyRules:** The caveat appears once. Never 'Bulk pickup — curbside by 6am' on a Saturday in Camas.
- **platformNotes:** Always rendered, whether or not push is enabled.
- **doNot:** No filled primary vs text link. No amber alert styling. No variant that exists only behind a push.
- **Used in:** f4-today-pickup-card, f1-today-tab, f7-widget-tap-landing, f7-today-widget, f7-widget-howto-sheet, f11-keeper-strip, x-place-file

### PushCopy
- **Purpose:** The canonical push strings and tray-preview artwork, so every surface draws the same notification.
- **Anatomy:** Tray preview drawn as an in-app illustration inset on surface.raised over sunken, captioned 'This is the whole thing.'. It never mimics a system alert dialog. Title 30 characters or fewer with the caveat first. Body 40 characters or fewer on its first line, carrying the source. Place label is the street name only, and only when the person has more than one place.
- **Variants:** unconfirmed pickup: title 'Unconfirmed: pickup tomorrow' / body 'Recycling + garbage · City of Camas schedule. Bins out tonight.' / action 'That's My Day' · confirmed pickup: 'Recycling + garbage tomorrow' / 'Bins out tonight · Lacamas Dr' · air: 'Unhealthy air: AQI 176' / 'AirNow, 4:00 PM · Lacamas Dr' (Time Sensitive only at 151 or above) · bill paid: 'Sam marked Clark PUD paid' / 'Due Sep 20 · Maple St' (no amount) · household roll-up: 'Sam paid 3 bills' · date reminder: 'Lease notice due in 14 days' / 'Tell your landlord by Sun 31 Jan' · hidden-preview placeholders: 'Pickup reminder' · 'Air quality alert' · 'Household update'
- **States:** collapsed tray at true truncation (iOS 393 / Android 412) · expanded with action · lock screen public version
- **Accessibility:** No address numbers. Actions in title case.
- **copyRules:** Never 'Open Pantopus to…'. No keeper name or voice. No marketing.
- **platformNotes:** Levels: pickup, briefings, dates, bills = Active / DEFAULT; household = Passive / LOW, one thread per home; air ≥151 and NOAA = Time Sensitive / HIGH.
- **doNot:** No caveat at the end of the title. No full address. No duplicate pickup reminder alongside the briefing.
- **Used in:** f4-notification-primer, f4-today-pickup-card, f1-today-air-band, f3-household-notifications, f4-notification-settings

### NotificationAsk
- **Purpose:** The in-context permission ask and its denial states. It is never a second 'Yes'.
- **Anatomy:** A card row form (on the briefing card: 'The night before pickup?' Yes / Not now) plus the primer sheet form, used only for indirect entries (first confirmed pickup, household activity from Mail): PushCopy tray preview, one sentence, a single forward button 'Continue' with the caption 'Your phone will ask next.', and on Android also 'Not now'.
- **Variants:** card row (Yes fires the OS prompt directly) · primer iOS (Continue only) · primer Android (Continue + Not now) · iOS denied → 'Open Settings' (notification page) · Android denied once → Continue re-asks · Android blocked → 'Open Settings' · time chips expansion (5–8 pm, 44pt, selected = fill + check)
- **States:** never asked · granted (row collapses to '6:00 PM · Change') · declined (card slot closes; widget offered once) · switch ON but OS blocked (amber glyph + text.primary line + Open settings) · saving / Saved / Couldn't save (live region)
- **Accessibility:** The primer title is unique. Chips are 44pt. Status is announced without moving focus.
- **copyRules:** Body lists the real defaults: 'Pickup the night before. Air alerts when it's unhealthy. Nothing else unless you turn it on.' Silence contract: 'Only when something needs you. No news means nothing's up.'
- **platformNotes:** Never at cold launch, sign-up or save.
- **doNot:** No 'Yes' / 'Allow' on the primer. No imitation of a system dialog. No permanent amber banner for someone who declined.
- **Used in:** f4-notification-primer, f4-briefing-optin-card, f4-today-pickup-card, f4-notification-settings, f3-household-notifications

### LockedActionRow
- **Purpose:** Replaces or accompanies an unavailable control with the reason and the path.
- **Anatomy:** One row, 44pt minimum: 16pt lock glyph (text.secondary) · reason in bodySmall text.strong on surface.sunken (or text.secondary on base) · trailing link 'Verify address' in primary.700. Border.subtle hairline. Wraps to 2 lines before truncating. Tapping the disabled control above opens the same reason.
- **Variants:** under a disabled CTA · as a list row · in a card header · pending (no link: 'We're checking your postcard code — expected Sep 19–26') · server disagrees · names who can act ('Dana or Marcus can add bills here') · not at this tier ('Claim this address first', no CTA, grey)
- **States:** locked · pending · offline (link disabled + reason)
- **Accessibility:** Reason at 4.5:1 or better. The link names its destination. The disabled control is exposed with its reason as a hint.
- **copyRules:** 'Address verification needed to <specific action>'. Never a generic 'Verification required'.
- **platformNotes:** —
- **doNot:** No red or amber. No text.muted. No present-and-inert controls. Don't show it to a T1 user for home-only features: show 'Claim this address' instead.
- **Used in:** f3b-locked-action-row, f3-members-roster, f3-member-home-dashboard, f3b-invitation-decision, f3-bills-list, f3-bill-detail-web, f3-household-calendar, f10-bill-provenance, f10-extraction-confirm, x-place-file, x-date-sheet, f6-home-basics-rows, f9-block-founders-panel, f11-keeper-strip

### GrantLimitList
- **Purpose:** Two scannable lists: what you get now (ticked) and what needs verification (locked), shared by invite, attestation and verify.
- **Anatomy:** Rows 44pt: a 16pt glyph (success tick, or lock in text.secondary) plus a verb phrase in body text.primary. Both columns use the same type and row height. The grant list comes first. Generated from one shared string set.
- **Variants:** invitation decision (two columns) · invite composer 'Role offered' expansion · attestation grants (3 rows) · verify sheet unlock list (2 + 'and 3 more') · role caption under chips
- **States:** default · accepted (caption 'Verify your address to unlock these')
- **Accessibility:** Each list has a heading. The tick glyph is decorative; the heading carries the meaning.
- **copyRules:** Grants: 'Sees and edits the calendar' · 'Sees bills and who paid' · 'Sees who lives here'. Locks: 'Message your neighbors' · 'Get a residency letter' · 'Show your Residency Pass' · 'Share what you pay in rent (Real Rent)' · 'Earn a Block Founder rank'.
- **platformNotes:** Stacked on mobile.
- **doNot:** No warning box. No product names without verbs. No text.muted on sunken.
- **Used in:** f3b-invitation-decision, f3-invite-composer, f3b-owner-attestation, f3b-verify-address-sheet, f9-verification-promise-copy, f3-members-roster

### FactRow
- **Purpose:** One row per fact in the place file and settings: known, missing, or not available at this tier.
- **Anatomy:** 56pt row. Label (bodySmall text.secondary) above the value (body text.primary) · ProvenanceMark · trailing chevron or text action. Missing: an ask sentence plus a text 'Add'. At most 3 promoted CTAs per screen; the rest sit under 'More you can add (5)'.
- **Variants:** known · missing (invitation, never red) · not at this tier ('Claim this address first', grey, no CTA) · done ask (quiet, tick, text.secondary) · declined ('Just me' / 'Skip' with Undo, re-openable) · permission-disabled (reason inline) · 'What moved when you claimed' receipt link · 'Your reports' row (Checking / Fixed / No change)
- **States:** default · loading · offline
- **Accessibility:** The whole row is the target. Merged label. Verb-first asks.
- **copyRules:** 'Set your pickup day' · 'Add one date that matters' · 'Add the people you live with'. 'Not set' in text.secondary.
- **platformNotes:** —
- **doNot:** No red X. No score. No more than ~3 simultaneous CTAs.
- **Used in:** x-place-file, f6-home-basics-rows, f1-today-tab, f3-household-block, f9-verification-promise-copy, f4-notification-settings

### FactCount
- **Purpose:** States how much is on file without implying incompleteness.
- **Anatomy:** Integer (label weight) plus 'on file' (caption), with category pips beside it: one small labelled pip per category that has anything known (Place, Dates, Money, People, Proof). Unknown categories draw nothing. Tap area 44pt minimum. The same geometry is used in the place file header and the keeper strip.
- **Variants:** place file header ('14 on file') · keeper strip ('11 on file') · T1 (only Place and Dates can appear)
- **States:** default · loading · offline
- **Accessibility:** '11 things on file: place, dates, money, people.'
- **copyRules:** Never 'X of Y', never 'knows', never a percentage.
- **platformNotes:** —
- **doNot:** No closed ring with outlined empty segments. No progress bar, level or XP. No count-up animation.
- **Used in:** x-place-file, f11-keeper-strip, f1-claim-receipt

### FirstWeekRow
- **Purpose:** The single Today pointer to the next first-week ask, from a bounded set that is already started.
- **Anatomy:** One 48pt row: '1 of 4 done — next: set your pickup day →' or 'Next: set your pickup day →'. Set: Save (already done) · Pickup day · Reminder or widget · One date or person. Only steps reachable at the current tier are counted. Dismissible.
- **Variants:** fraction · no-fraction · hidden when complete or dismissed
- **States:** default · dismissed (server-side, Undo)
- **Accessibility:** Whole-row link.
- **copyRules:** The window matches the activation window (7 days).
- **platformNotes:** —
- **doNot:** No '3 of 6'. Never count verify, profile or photo.
- **Used in:** f1-today-tab, x-place-file, f4-briefing-optin-card

### InlineUndo
- **Purpose:** Reversible removal and decline without timers or dialogs.
- **Anatomy:** The row collapses in place to 'Removed "The Blairmont rental" · Undo' (44pt Undo) and persists until the user leaves the screen. Optionally echoed by a snackbar that stays while a screen reader runs. Household-notifying writes (Mark paid) hold their fan-out until undo closes.
- **Variants:** removed row · declined ask ('Just you, then. · Undo') · triage decision ('Comcast · Recycled · Undo', kept until Finish day) · 'Undo all 6' · bill + photo deleted
- **States:** pending undo · undone · committed
- **Accessibility:** role=status announcement; Undo is focusable.
- **copyRules:** No '(4s)' countdowns.
- **platformNotes:** —
- **doNot:** No confirm dialog for cheap deletes. No toast as the only record.
- **Used in:** x-date-sheet, f1-your-places, f3-household-block, f10-mail-day-triage, f10-bill-provenance, f11-keeper-naming, f6-home-basics-rows, x-place-file, f3-bills-list, f10-snap-capture-tray

### DestructiveConfirm
- **Purpose:** The confirm for real losses. It names what goes and what stays.
- **Anatomy:** Dialog or sheet: question title naming the object, one body sentence naming the survivors, buttons describing outcomes. The destructive button is text.error on base with a border. No default focus on the destructive button.
- **Variants:** 'Delete this photo? The bill and its amount stay; only the photo is removed.' · Delete photo / Keep it · 'Delete all 17 photos? …' · Delete 17 photos / Keep them · 'Remove Ollie? Today goes back to no keeper. You can add one again any time.' · Leave home sheet (what goes / what stays)
- **States:** open · deleting (progress count) · done
- **Accessibility:** Unique title; Escape / Back cancels.
- **copyRules:** Never just 'Are you sure?' or 'This can't be undone'.
- **platformNotes:** —
- **doNot:** No filled red slab above content.
- **Used in:** f10-mail-piece-photo, f10-mail-snap-privacy, f10-bill-provenance, f11-keeper-naming, f3-members-roster

### InlineErrorRow
- **Purpose:** Per-component partial failure: names what failed and keeps everything else live.
- **Anatomy:** A row in the component's own slot: 16pt glyph (error hue on the glyph only) · 'We couldn't reach AirNow just now' in text.primary · Retry text button (44pt). On errorBg only when a write failed.
- **Variants:** provider unreachable · carry failed ('We couldn't move your furnace warranty · Retry') · upload failed ('Upload failed · Retry') · save failed (value preserved) · fail-closed components render nothing instead (founding meter, invite banner, Earn row)
- **States:** failed · retrying
- **Accessibility:** Polite announcement; Retry names its target ('Retry air quality').
- **copyRules:** Specific and blameless. Keep the typed input.
- **platformNotes:** —
- **doNot:** No generic 'Oops, something went wrong'. No hiding a failed row among successes.
- **Used in:** f1-today-tab, f1-claim-receipt, f10-mail-day-triage, f10-snap-capture-tray, f10-bill-trend, f4-briefing-optin-card, f4-notification-settings, f6-home-basics-rows, f11-keeper-naming, f11-keeper-strip

### LandingBannerSlot
- **Purpose:** The single arrival slot at the top of Place and /start. Exactly one banner at a time.
- **Anatomy:** Pill geometry of the existing mailbox-arrival pill: one line, leading 16pt glyph, sentence with the actor name first, one trailing 44pt action. Precedence: invite > reissue > compare arrival > mailbox arrival > setup > verify. Fetch failure renders nothing and the layout does not shift.
- **Variants:** one invite ('Sam Ortega invited you to the Payne St house · Review') · count ('You have 3 invitations · Review' → Invitations list) · expiring (caption 'Expires tomorrow' in text.primary, warning glyph) · sender reissue ('2 invitations need to be sent again · Fix') · expired compare link ('That comparison link has expired. Type an address to see your own place.') · sync merge ('Synced 3 items from your other device') · one-time claim receipt banner (links to the persistent receipt)
- **States:** hidden · shown · offline (action disabled + reason)
- **Accessibility:** role=status on appearance. Expiry in words.
- **copyRules:** Degrade to 'Someone invited you…' or '…a home in Camas'.
- **platformNotes:** —
- **doNot:** Never two banners. No error banner on a fetch failure.
- **Used in:** f3-invite-banner, f8-compare-arrival-header, f9-founding-meter-preview, x-place-file, f1-claim-receipt

### AddressChip
- **Purpose:** Shows a held or selected address as a label: never a map, never coordinates.
- **Anatomy:** Pill on surface.raised, border.default, 16pt pin glyph, street in bodySmallMedium plus city in caption text.secondary. Wraps at 390. Optional 'Save it' action when used as a selectable suggestion row (44pt).
- **Variants:** held ('We're holding it for 7 days') · selectable recovery row ('1402 NE 3rd Ave, Camas — Save it') · duplicate ('You already saved this as "Mom's house" · Use for Today') · sender label ('Dana · Camas, WA')
- **States:** default · selected · expired (neutral)
- **Accessibility:** Reads the full address.
- **copyRules:** Always paired with the ScopeChip sentence.
- **platformNotes:** —
- **doNot:** No blank retype field when the server holds the value.
- **Used in:** f1-email-verify-handoff, f1-save-confirmation, f1-add-place-sheet, f8-compare-arrival-header

### ChoiceChip
- **Purpose:** Small single-choice chips: channel, role, time, filter. They are never status badges.
- **Anatomy:** Height 32pt visual / 44pt hit, radius pill, label 13/18. Selected = primary.50 fill + primary.700 text + a leading check glyph. Unselected = border.strong outline and text.strong. Wraps to radio rows at AX sizes.
- **Variants:** channel (Email · Username · 'Share instead') · role (Member · Guest, with a capability caption) · time (6:30 AM …) · filter ('Photographed') · segment (Upcoming / Paid / All)
- **States:** default · selected · disabled · focus (focus ring distinct from selection)
- **Accessibility:** Selection shown by check + fill, not colour alone.
- **copyRules:** Sentence case.
- **platformNotes:** iOS segmented control where native; M3 filter chips on Android.
- **doNot:** No status chips on people.
- **Used in:** f3-invite-composer, f4-briefing-optin-card, f10-mail-piece-photo, f3-bills-list, f4-notification-settings

### StatusChip
- **Purpose:** One status per object (bills and invites), stated in words.
- **Anatomy:** Pill 24pt, caption medium. Neutral fill (surface.sunken) with text.strong; the semantic hue appears only on a leading glyph or border.
- **Variants:** Upcoming · Due today · Overdue (error glyph) · Paid · Expires Sep 23 · Declined · Sep 15 · Waiting for your OK · Deadline chip ('Oct 26 · 18 days' / 'Today')
- **States:** default
- **Accessibility:** Text carries the state.
- **copyRules:** Exactly one chip per row.
- **platformNotes:** —
- **doNot:** No warning-hue text on warningBg. No two chips on one row.
- **Used in:** f3-bills-list, f3-bill-detail-web, f3-members-roster, f8-seasonal-aha, f10-bill-provenance, f9-block-founders-panel

### BillRow
- **Purpose:** A household bill with payer attribution, so two people don't pay the same bill.
- **Anatomy:** Line 1: provider (bodyMedium, truncates first) · StatusChip · amount right-aligned (tabular). Line 2: due date (bodySmall text.secondary) · attribution right ('Paid by Sam · Sep 15', never truncated). Overflow menu holds Mark paid / I paid this / Paid a different amount / Skip this month. Whole row opens bill detail. The list header states scope and total: '6 upcoming · $2,233.48 through Oct 31 · Everyone at Maple St can see these'.
- **Variants:** manage · member ('I paid this' in overflow, or 'Dana or Marcus can mark this paid') · only-me bill · former member ('Sam (no longer here)')
- **States:** default · highlighted from notification (focus moved) · marked paid → InlineUndo, then 'Next due Nov 20' · permission-denied · offline
- **Accessibility:** Merged label: 'Clark PUD, 84 dollars, due Sunday September 20, upcoming.' Actions are custom actions.
- **copyRules:** 'marked paid', not 'paid', in notifications.
- **platformNotes:** —
- **doNot:** No one-tap Mark paid on the row face or dashboard. No avatar without a name. No budget meter.
- **Used in:** f3-bills-list, f3-member-home-dashboard, f3-bill-detail-web, f10-mail-piece-photo

### MemberRow
- **Purpose:** A person in the household, with no trust or status badge.
- **Anatomy:** 56pt: 40pt initials avatar · name (body) · caption 'joined Sep 9, 2026' or 'access until Oct 1, 2026' · overflow (Change role / Confirm lives here / Remove; own row: Leave Maple St). Grouped under overline role labels, each with a 'What can members do?' disclosure. Collapsed form: 'Dana, Sam and Priya live here · View'. Before acceptance: count only ('Sam Ortega and 2 others live here').
- **Variants:** owner · admin · member · guest · you · collapsed roster line · empty ('Just you at Maple St · Invite someone')
- **States:** default · loading · offline
- **Accessibility:** Avatar is decorative; the name is read.
- **copyRules:** Verification is shown on actions via LockedActionRow, never on names. Where shown, it names method and date: 'Address confirmed by postcard · Sep 8, 2026'.
- **platformNotes:** —
- **doNot:** No 'Verified' / 'Household member' chips. No check-badge shapes.
- **Used in:** f3-members-roster, f3-member-home-dashboard, f3-household-block, f3b-owner-attestation, x-place-file, f3b-invitation-decision

### InviteRow
- **Purpose:** A pending invitation or link, with its expiry and a one-tap fix.
- **Anatomy:** Row in the Pending group (managers only), quieter than people: 16pt mail glyph · recipient (@example.com or @username) · caption 'Member · sent Sep 9 · Expires Sep 23' · inline Resend (44pt) · overflow (Cancel, Extend). Reissue row: warning glyph plus text.primary 'Needs reissue — your household's invite rules changed · Reissue'. Link row: 'Invite link · Works once · Turn off link'. Joined-by-link row: 'Waiting for your OK · Approve / Remove'.
- **Variants:** pending · expiring · needs reissue · declined (Remove only) · link active · awaiting approval
- **States:** sending / reissuing · offline
- **Accessibility:** Resend is announced; expiry is in words.
- **copyRules:** The manifest always shows the expiry. The link warning appears at the point of choice.
- **platformNotes:** —
- **doNot:** No reminder-to-nag action for declined invites. No real-domain emails in fixtures.
- **Used in:** f3-members-roster, x-place-file, f3-invite-composer, f3-invite-banner

### NotificationRow
- **Purpose:** The in-app twin of every push; lands on the exact object.
- **Anatomy:** Two lines. A fixed 12pt leading column with a 6pt unread dot (label 'Unread'). 28pt initials avatar (none for system rows). Line 1: sentence with the actor first. Line 2: middot caption: date · home label (only for multi-home readers) · trailing ProvenanceMark for reminders. Grouped row: 'Sam paid 3 bills', expandable.
- **Variants:** bill_paid · task_completed · home_event_created · date reminder · bill reminder · joined / left ('Tova joined Maple St — can see the calendar and bills') · gone target ('That bill was removed.')
- **States:** unread · read · push-off banner ('Push is off. You'll still see these here. · Turn on') · offline
- **Accessibility:** Merged label with 'Unread' first.
- **copyRules:** Amounts appear in-app only.
- **platformNotes:** —
- **doNot:** No bold or tinted unread rows. No landing on a generic list when the object exists.
- **Used in:** f3-household-notifications, f4-notification-settings

### ThumbnailRail
- **Purpose:** The optional leading photo slot on mail rows and the capture queue.
- **Anatomy:** 56pt (triage) / 40×52 (drawer) / 32pt (privacy list) thumbnail, radius md. When there is no photo the rail collapses (no empty square). Upload shows a determinate ring inside the rail with a text value. Failed shows a retry glyph. Deleted shows a quiet document glyph plus the words 'photo deleted Sep 12'. Selecting a thumbnail reveals a visible action row: Retake · Delete · 'Same letter as previous' (44pt each).
- **Variants:** triage row · drawer row · privacy list · capture queue (joined pieces as a stacked thumb + '2 pages')
- **States:** uploading ('2 of 3 uploaded, 40%') · failed · deleted · offline (not cached)
- **Accessibility:** Actions are also custom actions; no long-press-only or hover-only actions.
- **copyRules:** —
- **platformNotes:** Web converts HEIC to JPEG before rendering.
- **doNot:** No broken-image icon. No progress ring under the delete target.
- **Used in:** f10-mail-day-triage, f10-snap-capture-tray, f10-mail-piece-photo, f10-mail-snap-privacy, f10-bill-provenance

### KeeperStrip
- **Purpose:** A calm face on Today summarising real obligations only.
- **Anatomy:** One row plus padding. 44pt species avatar (pose carries mood; motion of 5s or less, static under Reduce Motion) · name bodyMedium plus mood word caption · mood line bodySmall (a tap target to the item) · FactCount on the right (44pt target).
- **Variants:** calm · on it (recycling tomorrow) · busy (holding a stack) · needs you (holding up the envelope) · unavailable (neutral pose, reduced contrast, 'Couldn't check what's due.' + Retry, no mood word) · offline ('Attentive · as of 7:04 AM')
- **States:** loading · hidden after Skip (slot closes) · suppressed under an active alert · permission-limited (mood only from what the viewer may see)
- **Accessibility:** The label is the fact line: 'Ollie: A bill is overdue.' Mood is never shown by colour.
- **copyRules:** The subject is the thing, never the person. No keeper feelings. No streaks. Never 'knows'.
- **platformNotes:** No push, no badge.
- **doNot:** No distress poses. No text.muted silhouette. No persistent invitation after Skip.
- **Used in:** f11-keeper-strip, f11-keeper-naming, f1-claim-receipt, x-place-file, f7-today-widget

### SlotMeter
- **Purpose:** An honest, dated Founding Neighbor window. Fails closed.
- **Anatomy:** Five bounded capsule segments; taken = solid primary.600, open = diagonal hatch in text.secondary ink, with the numeral label '3 of 5 open'. A 2px elapsed bar in neutral tokens and a date caption 'Closes Tue, Sep 22' (neutral pill). The RankBadge is a separate squared shape (radius md, surface.sunken, numeral, 'BLOCK FOUNDER' overline).
- **Variants:** preview card · Block Founders panel · wall line replacement ('3 Founding Neighbor slots are still open on this block.')
- **States:** open · closed (absent) · lookup failed (entire card absent)
- **Accessibility:** 'Founding Neighbor slots: 3 of 5 open, closes Tuesday September 22.'
- **copyRules:** Never 'permanent' unless the data model guarantees it. Rank and tier never share a sentence.
- **platformNotes:** —
- **doNot:** No hollow segments. No warning tint. No hh:mm countdown. No empty meter.
- **Used in:** f9-founding-meter-preview, f9-block-founders-panel, f9-nearby-cells-map, f9-verification-promise-copy, f9-invite-rewards-card

### PublicPointMap
- **Purpose:** Shows exactly where neighbours see a post, drawn from the server's stable public point at true scale.
- **Anatomy:** 16:9 map thumb, labelled streets, a single public pin labelled 'What neighbors see', a scale bar in tenths of a mile, and no home marker. If a range is shown, it is the real ±0.005° box (about 1.1 × 0.8 km), never centred on the home in a shareable frame. Caption: 'Neighbors see your posts at this spot, the same spot every time, about 0.3 mi from your address.' Also cell-map rings: the user's cell gets a 2px primary ring. Zoom +/- buttons and a 'List cells' alternative.
- **Variants:** privacy mirror · composer one-liner · cells map (rectangles, bucket label printed in each cell)
- **States:** loading · vector fallback · offline
- **Accessibility:** A text equivalent for the map content. Pan and zoom by buttons.
- **copyRules:** Never 're-rolled every time you post'.
- **platformNotes:** —
- **doNot:** No 150 m ring. No blurred or locked map. No lightness-only ramp.
- **Used in:** f9-privacy-mirror, f9-nearby-cells-map

### TextActionRow
- **Purpose:** Tertiary spread actions (share, compare, outbound) that never outrank the primary.
- **Anatomy:** Two text buttons side by side (44pt, 8dp apart) with no fill or border, plus a caption. The outbound variant is a bordered row with an external-link glyph and a destination name.
- **Variants:** 'Share this address' · 'Compare with a friend' · outbound ('Free test kits · Washington Dept of Health ↗', 'Check or update at VoteWA ↗')
- **States:** idle · minting (spinner on the URL row) · copied ('Link copied', role=status) · cancelled (neutral) · offline
- **Accessibility:** Links name their destination.
- **copyRules:** The caption states what the card reveals.
- **platformNotes:** System share sheet only (LPLinkMetadata on iOS, EXTRA_TITLE on Android).
- **doNot:** No actions inside the sticky WallBar. No app-drawn Android chooser.
- **Used in:** f8-native-share-compare, f8-compare-sheet, f8-seasonal-aha, f6-place-section-details, f8-compare-reveal

## Inconsistencies found across v1 prompts

- Scope caption, five wordings: x-date-sheet 'Only you will see this.'; f11-keeper-naming 'Only you see this.'; x-place-file 'Only you can see this.'; f1-your-places 'Only you can see these.'; f1-add-place-sheet 'A private bookmark for your account. Nobody else can see it.'. Household side: x-date-sheet 'Everyone in this household will see this.' vs f11-keeper-naming 'Everyone in this household sees this.' vs f10-mail-snap-privacy 'Photos stay private to this home.' vs f10-snap-capture-tray 'stored privately to your home and never shown to neighbors.' vs f10-mail-piece-photo 'Only your household can see this photo. Nobody nearby can.'
- Scope chip punctuation: f1-today-tab / f1-today-air-band / f7-widget-tap-landing 'Saved place · Only you'; f3-household-notifications 'Saved place - Only you'; f1-add-place-sheet header chip '1402 NE 3rd Ave - Only you'; f9-privacy-mirror 'Home · Your household' vs f1-your-places 'Our house' and f10-mail-day-triage '· Your household'.
- Provenance mark reach: x-provenance-sheet defines filled/hollow/tick 'used everywhere… no exceptions', but f9-founding-meter-preview uses 'filled = taken, hollow = open' and f9-block-founders-panel draws '3 hollow with a border.strong outline'. f8-compare-reveal uses 'the sender's mark FILLED, the recipient's mark RINGED'.
- Hollow mark on official data: f8-scale-strips radon 'hollow mark, caption "On record, not yet confirmed"'; f6-place-section-details radon 'hollow mark'; f8-og-compare-card 'carrying the hollow unconfirmed mark'. Yet x-place-file draws Clark County / state rules 'filled', and f6 draws the civic seeded block 'hollow' while x-place-file draws voter registration 'filled'.
- Extraction marks: f10-extraction-confirm 'a filled mark on the confident fields' before the user confirms, vs f10-bill-provenance 'FILLED-WITH-TICK = you confirmed it', and its low-confidence state 'the mark stays hollow' on a committed bill.
- Mark tap target: x-provenance-sheet 'by tapping a data mark — a dot in Today's 14-day strip' and specimen 'an 8px dot'; f3-household-calendar 'Tapping a mark opens the provenance sheet'; f8-seasonal-aha 'the caption is the tap target'; f4-today-pickup-card 'the 14-day strip's tonight cell'. Four different targets for one action.
- Strip geometry: f5-today-calendar-strip 14 cells across the card with 'weekday initial beneath each cell' vs f7-today-widget '~6pt each, ~120pt wide, weekday initial under each cell'. Dots 'coloured by class — pickup / civic / money / yours' (f5) vs 'no second colour' implied nowhere; f7-widget-gallery 'one pickup pair, one civic, two yours'.
- Statewide encoding: f5-today-calendar-strip 'full-height bar spanning its cell'; x-place-file 'full-height bar spanning its column'; f3-household-calendar uses a 'Statewide - WA' scope chip instead; f7-widget-tap-landing draws the city-wide 'Camas leaf pickup week' as a bar although it is city, not state.
- Year band lanes: x-place-file 'You · Your city · Your county · Your state' vs f7-today-widget / f7-widget-gallery 'You / Camas / Clark County / Washington'.
- Count ring: x-place-file 'five-segment ring… the integer "14" and the label "things on file"' vs f11-keeper-strip '36pt… "11"… "on file"' and outlined empty segments; f1-claim-receipt 'knows 11 things about this address'; f1-today-tab and x-place-file 'Progress row: "3 of 6 things on file →"'.
- AQI track: f1-today-air-band 'EPA colours… segment widths proportional… Hazardous 301+' vs f8-scale-strips 'neutral surface tokens… 6 segments sized to the real AQI ranges (0–50 … 301–500)' vs f6-place-section-details 'six EPA bands' with no colour rule. Threshold: f1-today-air-band 'mark the 101 threshold' vs f4-notification-settings default 'Unhealthy (151+)' selected.
- Air health copy: f1-today-air-band 'Air quality is satisfactory for everyone.' paraphrases EPA.
- Flood value: f8-scale-strips / f8-compare-arrival-header / f8-compare-sheet 'Zone X — minimal risk'; f8-og-compare-card 'Zone X — minimal'; f6-place-section-details 'Zone X · minimal hazard'; f8-compare-reveal 'Zone AE — this address is in the 100-year floodplain' and 'Zone AE — 1% annual chance'; f8-seasonal-aha 'Minimal flood risk'. Flood bands: f8-scale-strips 'X · X shaded · AE · VE' (4) also in f6.
- Radon value: f8-scale-strips 'Zone 1 — highest predicted'; f6 'Zone 1 of 3 · highest potential'; f8-og-compare-card 'Zone 1 — highest'; f8-native-share-compare 'the highest'; f8-compare-reveal 'Both highest predicted'. Wildfire: f8-scale-strips 'Moderate — 3 of 5' vs f6 '2 of 5 · Low' vs f8-og-compare-card 'Moderate' (no number).
- Radon source caption: f8-scale-strips 'County radon zone (EPA) · Clark County, WA'; f6 'Clark County radon zone (EPA)'; f8-seasonal-aha 'County radon zone (EPA)'. Wildfire: 'USFS wildfire hazard potential, quarter-mile · 2023' vs 'USFS wildfire hazard, quarter-mile' (OG) vs 'USFS Wildfire Hazard Potential' (aha).
- Compare row order: f8-compare-reveal 'ordered by the distance between the two marks… never a fixed order' vs f8-scale-strips 'Four rows, this order' and f8-og-compare-card fixed layer order. Collapsed sender: f8-compare-arrival-header 'four tiny markers in layer order'.
- Frozen air: f8-compare-arrival-header 'Air today "AQI 42 — Good"' under 'Dana's card, as of Sep 12, 2026'; f8-og-compare-card 'AirNow, today'; f8-scale-strips state 5 requires 'As of Sep 12, 2026'.
- Voter deadline, four forms: f8-seasonal-aha 'Voter registration for November 3 closes October 26 in Washington.'; f6-place-section-details 'Register by Mon Oct 26, 2026 · 40 days left'; x-date-sheet 'Online or by mail — by Mon 26 Oct 2026' + in-person row; f5-today-calendar-strip 'Voter registration deadline — online and by mail'; x-place-file 'online/mail deadline Oct 26 2026; in-person deadline Nov 3 2026'. f6 deadline-passed 'collapses to "No upcoming election"' vs f8-seasonal-aha 'suppressed entirely'.
- Tax dates: f7-today-widget 'property tax 2nd half 30 Oct' and 'Washington — tax appeal window opens 1 Jul' vs x-place-file 'Oct 31 2026' and 'Assessor appeal deadline Jul 1 2027' (county lane) vs x-date-sheet 'Clark County Board of Equalization' vs x-place-file 'Clark County Assessor' vs f5 'Property-tax appeal window closes' on Fri 30 Oct.
- Pickup facts in Camas 98607: f4-notification-settings / f3b-invitation-decision 'Tuesday (Waste Connections)'; x-place-file 'Camas garbage Thursdays, recycling every other Thursday'; x-provenance-sheet 'Recycling — every other Tuesday' by City of Camas Public Works; f3-household-calendar 'Garbage + recycling every Wednesday'; f5 'Tue 27 Oct: Garbage (weekly; recycling is biweekly)' but Tue 20 Oct is 'Recycling and garbage'. Source label: 'City of Camas Public Works · Route B' (f4) vs 'Camas city schedule' (f3) vs 'City of Camas schedule' (x-place-file).
- Pickup card caveat: f1-today-tab 'City schedule, not yet confirmed'; f4-today-pickup-card 'City schedule, not yet confirmed' plus source row; confirm buttons 'That's my day' / 'Not my schedule' everywhere but x-provenance-sheet options 'The date is wrong' / 'That's not my schedule'.
- Push titles: f4-notification-primer 'Recycling and garbage tomorrow - City of Camas schedule, not yet confirmed'; f4-today-pickup-card 'Recycling and garbage tomorrow — not yet confirmed' body 'Bins out tonight. 2418 NW Lacamas Dr.'; f1-today-tab pinned 'Recycling and garbage tomorrow — city schedule, not yet confirmed'; f3-household-notifications 'Garbage + recycling is tomorrow (not yet confirmed)'; f1-today-air-band 'Air is unhealthy for sensitive groups at 2418 NW Lacamas Dr'.
- Notification groups: f4-notification-settings 'BRIEFINGS / HOUSEHOLD ACTIVITY / DATES AND BILLS / AIR AND WEATHER ALERTS' (no Security) vs f3-household-notifications 'Household activity, Security, Reminders and Briefing'. Evening briefing default: f4-briefing-optin-card '6:00pm (default)' vs f4-notification-settings '6:00 PM' casing; time formats '6:00pm' vs '6:00 PM' vs '7:40 am' (f7).
- Primer: f4-notification-primer 'Actions, equal visual weight… "Yes" / "Not now"' after the card's own Yes (f4-briefing-optin-card 'Yes / Not now').
- Denied permission: f4-briefing-optin-card amber 'Notifications are off for Pantopus' + 'Open settings'; f4-notification-settings 'Notifications are off for Pantopus. These rows still update inside the app.' + 'Open Settings'; f3-household-notifications 'Push is off. You'll still see these here.' + 'Turn on'; f1-today-air-band 'one quiet line saying alerts are off'. Three wordings, two capitalisations of Settings.
- Widget promotion row: x-place-file / f4-briefing-optin-card / f4-notification-primer 'Put today on your home screen' vs f7-widget-howto-sheet title 'Add the widget'; no-place copy f7-today-widget 'Save an address to see today here' vs f1-add-place-sheet entry 'Preview an address' vs f1-your-places '+ Add a place' vs f1-today-tab 'Today starts with a place'.
- Stale/freshness: f1-today-tab 'Updated 2h ago' / 'Updated 4m ago'; f7-today-widget 'Open to refresh'; f7-widget-tap-landing 'Couldn't refresh'; x-place-file 'an "as of" caption'; f11-keeper-strip 'as of 7:04 am'; f9-nearby-cells-map 'as of Sep 15'; f9-invite-rewards-card 'Counts refresh every 5 minutes · last updated 10:37 AM'; f10-bill-trend 'As of Oct 3'.
- Quiet/empty checked: f1-today-tab 'Nothing needs your attention today' + four checks; f5 'Checked — nothing in the next two weeks'; x-place-file 'Checked — nothing on file for the next year'; f4 'Only when something needs you. No news means nothing's up.'; f11-keeper-strip 'Nothing due this week.'
- Offline copy: f1-add-place-sheet "You're offline. We can't look up an address right now."; x-date-sheet "You're offline"; f8-native-share-compare 'Compare needs a connection.'; f10-mail-piece-photo "You're offline. This photo isn't saved on this device."; f11-keeper-naming "You're offline. You can name it when you're back."
- Undo: x-date-sheet 'Undo toast'; f1-your-places inline 'Removed ... Undo'; f10-mail-day-triage 'Undo (4s)' live countdown; f3-household-block toast 'Just you, then.' + 'Undo'; f10-bill-provenance snackbar 'Bill and photo deleted · Undo'.
- Save error: f6-home-basics-rows "We couldn't save that. Try again." on errorBg; f11-keeper-naming "We couldn't save that. Try again." + Retry; f1-save-confirmation "We couldn't save that. Your browser blocked the storage…" + 'Try again'.
- Locked row colour: f3b-locked-action-row 'muted text on the sunken surface'; f3b-invitation-decision 'lock glyph rows in the muted text token on the sunken surface'; f3-member-home-dashboard 'lock glyph + "Address verification needed to send neighbor messages"'. Pending: f3b-locked-action-row 'expected by Sep 19' vs f3b-verify-address-sheet 'mailed Sep 12, expected by Sep 19' with chip '5–7 days'.
- Unlock list wording: f3b-verify-address-sheet 'Send neighbor messages… Show a Residency Pass, Set Real Rent, Claim Block Founder rank'; f3b-invitation-decision 'a residency letter; your Residency Pass; neighbor messages; Real Rent; Block Founder rank'; f9-verification-promise-copy 'Block Founder #3 — your permanent rank…', '6 postcard invites a week instead of 3'.
- Allowance maths: f9-invite-rewards-card '4 postcard invites this week — 3 base + 1 earned' with '3 joined'; f9-block-founders-panel '4 of 6 invites left this week · +1 earned from a referral' with 3 converted; f9-verification-promise-copy '6 postcard invites this week — 3 base + 3 earned'.
- Founding window: f9-block-founders-panel 'warning-tinted countdown pill… "closes in 6 days"' (closes Sep 22) vs f9-founding-meter-preview 'a date, not a live countdown number' ('closes Nov 27, 2026'); f9-verification-promise-copy 'closes Nov 27, 2026' with f9-nearby-cells-map 'closes Sep 22, 2026' for the same block family. Rank shape: f9-verification-promise-copy 'tier is a countdown pill naming its closing date'.
- Curator label: f9-curator-chip 'Pantopus curator' / 'Mute Pantopus posts' vs f9-nearby-cells-map '3 Pantopus curator posts not counted' while f9-curator-chip says 'curator' is internal vocabulary.
- Home identity: f1-your-places 'home identity token (#16A34A)'; f3-member-home-dashboard 'home identity accent (#16A34A)'; f3-household-calendar 'hairline left rule in the home green' — raw hex in prompts that forbid hex.
- Type off-scale: f8-positioning-copy 'H1 at 31/37/700 … 42/48/700 … Lede at 15.5/23/400 … text.muted'.
- Widget sizes: f7-today-widget '170×170pt… 364×170pt… 364×382pt' on a 393×852 screen; f7-widget-howto-sheet 'TRUE pixel size — 364×170pt… 330×150dp'.
- Widget how-to: iOS step 'Tap the plus in the corner' (f7-widget-howto-sheet); 'no public API can place a widget' applied to Android too.
- Stale widget: f7-today-widget '>6h — medium, marks greyed… "Open to refresh"' for the whole widget.
- Mark paid: f3-bills-list 'no "Mark paid" on the row at all' for members; f3-bill-detail-web 'Mark paid… gated on finance.manage'; f3-member-home-dashboard owner cluster includes 'Mark paid'. f10-bill-provenance 'Paid by Sam · Oct 9' vs f3-bill-detail-web 'Paid by Sam - Tue'.
- Bill trend: f3-bill-detail-web caption 'average of 14 homes nearby', line $81, Oct 2025–Sep 2026 vs f10-bill-trend 'Your amounts. The line is the average of 14 homes nearby.', $127.40, Nov 2025–Oct 2026; insufficient caption 'Not enough homes nearby to compare yet' (no period) vs with period.
- Photo audience: f10-mail-snap-privacy 'Everyone in this household can see them: you and Sam Reyes.' vs f10-mail-piece-photo permission-denied 'the image itself does not open' for members without finance.view.
- Household 'who lives here': f3-household-block 'You and 2 others live here' / 'Dana, Sam and Priya live here' vs f3-member-home-dashboard '3 people live here'. Owner surname drift: Sam Okafor (f3-member-home-dashboard, f3-bill-detail-web), Sam Okonkwo (f3-members-roster), Sam Ortega (f3-invite-banner, f1-claim-receipt), Sam Reyes (f10-mail-snap-privacy).
- Fixture drift: addresses 2418 NW Lacamas Dr / 2418 NW Sierra St / 2817 NW Sierra St / 4312 NW Sierra Dr / 3218 NW Sierra St / 1428 NE Maple St / 716 SE Maple St / 2418 NW Payne St / 2416 vs 2418 NE Ingle Rd / 1420 NE Garfield St / 2914 NW Lacamas Dr / 2417 NW Astor St; 'today' Sep 16, Sep 21 and Oct 19 2026; HOA $265 / $285 / $385; Clark PUD $84.00 / $148.62 / $142.18 / $184.62; real-domain emails jules.okafor@gmail.com, priya.raman@gmail.com, rjmoore@proton.me, d.reyes@fastmail.com.
- Dark mode: house-style-v1 'DRAW BOTH LIGHT AND DARK' vs f8-og-compare-card 'LIGHT palette only' and f10-mail-piece-photo 'this surface stays dark in the light theme too'; most prompts omit dark from frame counts.
- Add-place entry: f1-add-place-sheet reached from 'Today's empty state CTA "Preview an address"' though the sheet has 'no map… no grade'.
- Claim receipt: 'The 2 dates you entered are now visible to everyone in this household.' placed above the choice; one-time banner is the only revisit.
- Recovery: f1-save-confirmation blank field 'the value the user retypes' vs f1-email-verify-handoff 'The server now holds the pending place'.
- Keeper after Skip: f11-keeper-naming 'Skip persists so it never asks again' vs its state 6 'the quiet inline invitation still in the keeper slot'.

## Pending additions (from prompt revisions)
- ScopeChip, per-date compact variant (raised by x-place-file round 2; x-date-sheet and f3-household-calendar must use the same one): the same 24pt pill, surface.sunken fill, 12pt glyph (person / house), label 13/18 text.strong. Labels exactly 'Only you' / 'Household'. Spoken 'Visible to only you' / 'Visible to your household'. Shown only on dates a household entered; county and state rows carry only 'Clark County' / 'Statewide — WA'. Hit area 44pt (48dp Android) because it opens the DateSheet 'Visible to: Only you · Household' control; on a person-scoped voter self-report it is a static label (not a target).
