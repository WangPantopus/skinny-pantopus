# Bill trend vs the going rate
id: f10-bill-trend · platforms: web/ios/android · isNew: False · artboards: 19

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Bill trend vs the going rate (internal name; no user-facing string says "going rate") · f10-bill-trend

TYPE: EXTENSION of "Bill detail".
- iOS and Android: this screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.
- Web: the host is the new Bill detail web route (f3-bill-detail-web), drawn earlier in this pack. Attach its artboards and treat them as exact. Its trend card used a placeholder fixture (an $81 line, Oct 2025 to Sep 2026). This prompt's fixture ($127.40, Nov 2025 to Oct 2026) replaces it; list that on Notes.
On every platform you are adding one card, directly beneath the bill provenance block. On a hand-entered bill, which has no block, it goes directly beneath the bill facts.

ATTACH: Bill detail on iOS and Android (screenshots); the f3-bill-detail-web artboards; the f10-bill-provenance artboards (the same screen with the bill provenance block); the place file Money section; the Foundations board (SourceCaption, FreshnessLine, WarmingSkeleton, InlineErrorRow, OfflineNotice, ProvenanceMark, LockedActionRow).

PLATFORMS & VIEWPORTS: web 1440x900 (left sidebar) and 390x844; iOS 393x852; Android 412x915.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → place file → Money → Bills → Bill detail. There is one card per bill type. People arrive by:
- Any arrival at Bill detail: a Bills list row, the home dashboard Bills card, the Today strip money row, the bill reminder push, the household notification row, or "Open the bill" on a mail piece. They scroll to the card.
- The place file Money section, whose bill row opens Bill detail and scrolls once to this card. A highlight fades in 300ms and focus moves to the card title.
In the mail-snap journey this card is the last step: after Mark paid, the person scrolls down to see this month's column against the nearby average.

WHO AND WHEN: Maya Chen, owner of HOME A, on Tue 20 Oct 2026 at 7:30 AM (fixture delta: the morning after Mail Day). She has had the Clark Public Utilities account for a year. Last night she confirmed October's $142.18 bill from a photo, and now she wonders whether that is normal for around here.

THE ONE JOB: Answer "is this bill normal for around here?" at a glance, so the monthly visit has a payoff.

FIRST FIVE SECONDS: (1) the summary sentence; (2) October's column with "$142" printed above it; (3) the nearby average line and its key above the plot. There is no primary action; "Show amounts" is the only control.

CONTENT (fixture deltas only; list each on Notes):
- Alex Kim is a Guest in HOME A without bill access. Sam Ortega has bill access.
- Card title: "Clark Public Utilities · last 12 months".
- Amounts, Nov 2025 → Oct 2026: 118.22, 167.05, 198.73, 186.41, 151.60, 112.88, 94.15, 88.02, 103.77, 121.34, 109.60, 142.18. October is the bill open on this screen; it came from a photo Maya confirmed on Mon 19 Oct.
- Nearby average: $127.40 across 14 homes, from Pantopus. It updated Thu 1 Oct.
- Partial history: Jun–Oct 2026 only (88.02, 103.77, 121.34, 109.60, 142.18).
- Worst case: "NW Natural · last 12 months", Nov 2025 → Oct 2026: 168.40, 296.75, 412.90, 351.22, 244.10, 132.66, 71.35, 48.90, 44.12, 46.80, 52.37, 61.08. Nearby average $139.60 across 12 homes. January $412.90 moves the axis top to $450.
- Offline: cached as of Mon 19 Oct, 9:40 PM.

LAYOUT & VISUALIZATION:
- Chart form: a zero-based column chart of your own amounts, with the nearby average as one horizontal reference line. It is never a second series of paired bars, because paired bars read as one household against another, while a baseline reads as the typical amount. Months are separate bills, so draw columns, never a line or area chart of your amounts.
- Card surface: surface.raised in both themes.
- Summary sentence (body): "October $142. Your last 12 months ranged from $88 in June to $199 in January. The average of 14 homes nearby is $127."
- Key, above the plot and right-aligned: a 16pt line swatch plus "Nearby average $127" in caption, text.strong (dark: dark text primary). No label is drawn inside the plot at any size.
- Plot, 160pt tall:
  - 12 equal columns with 4px gaps.
  - A month initial under each (N D J F M A M J J A S O). A hairline and a "2026" caption sit under January, where the year turns.
  - The y-axis starts at $0. The y-axis gutter has three labels: $0 at the baseline, the top value, and a small "$127" tick label at the line's height. The top rounds up to the next $50 above the largest amount ($200 here). There are no interior gridlines.
- Columns:
  - Past months, light: filled primary.600. Past months, dark: primary.500 (#0ea5e9, 5.28:1 on dark raised).
  - Highlighted month: always the month of the bill that is open (October here; opening the September bill highlights September). Light: primary.800 with a 2px text.primary outline. Dark: primary.300 (#7dd3fc, 8.77:1 on dark raised) with a 2px outline in dark text primary. Its value is printed above it ("$142"), and a ProvenanceMark XS you-added is centred under its initial. The provenance block above and this chart agree.
- Reference line: 1.5px spanning the plot at $127.40. Light: text.strong with a 2px surface.raised halo where it crosses columns. Dark: dark text primary (#E5E7EB) with a 2px dark raised (#1E293B) halo.
- Below the plot, in order:
  - Caption: "Your amounts. The line is the average of 14 homes nearby."
  - Legend: "✓ You added this — the October amount came from a photo you confirmed." If Sam confirmed the open bill: "✓ Sam added this — the October amount came from a photo Sam confirmed." On a hand-entered bill: "✓ You added this — you entered the October amount."
  - SourceCaption, two lines:
    - household line, with a leading ProvenanceMark S you-added: "Your household · confirmed bills · through Mon 19 Oct";
    - Pantopus line, with no leading mark (a proposed variant for computed averages, which are neither official nor added by you): "Pantopus · average of 14 homes nearby · updated Thu 1 Oct".
  - "Only amounts people confirmed are counted."
  - The "Show amounts" disclosure. It opens 12 rows with full month names, newest first: "October 2026 · $142.18 · from a photo you confirmed" … "November 2025 · $118.22". A month with no bill reads "no bill".
- Degradation:
  - Not enough homes: draw the columns and no line at all, no key and no $127 tick. The caption becomes "Not enough homes nearby to compare yet", and the summary drops its last sentence. The SourceCaption keeps the household line unchanged; the Pantopus line becomes "Pantopus · not enough homes nearby yet". The missing line is the honest signal. Never draw a line at zero, a dashed baseline, or a county or state figure in its place.
  - Average stale (a cached average exists and the refresh failed): draw the line and key as usual, keep both SourceCaption lines, and put FreshnessLine "Nearby average from Pantopus, Thu 1 Oct · Couldn't refresh · Retry" under the SourceCaption.
  - Average never loaded: columns drawn, no line, no key, no $127 tick. InlineErrorRow "We couldn't get the nearby average from Pantopus · Retry" sits in the caption slot and replaces "Not enough homes nearby to compare yet", so the two cases never look alike. Drop the Pantopus SourceCaption line; only the household line remains, because the error row names Pantopus.
  - Partial history: keep all 12 month slots and their initials. Months with no bill hold no column. The caption adds "You've had this bill since June." The summary reads "October $142. Since June your bill ranged from $88 in June to $142 in October. The average of 14 homes nearby is $127." The line is still drawn.
  - Guest without bill access (Alex): the title becomes "Household bill · last 12 months" (no payee). The plot, key, caption, legend, sources and list are replaced by one reason line and a LockedActionRow, with no shapes and no blurred numbers.

INTERACTION, MOTION & HAPTICS:
- Columns are not individual tap targets on phones. Values are read through "Show amounts".
- On web 1440, each column is keyboard-focusable, and focus shows its value in a label. The same value is in the list, so nothing depends on hover.
- Place-file arrival: the card highlight fades in 300ms and focus lands on the card title; Tab then moves into the columns.
- "Show amounts" expands in place in 200ms and becomes "Hide amounts".
- Columns do not animate in. The loading skeleton shimmers; under Reduce Motion it is static and expand is a cross-fade. No haptics.
- Retry on the stale or failed average re-requests only the average; the columns stay.

FOUNDATIONS COMPONENTS USED: ProvenanceMark (you-added, XS under the highlighted column; S on the household SourceCaption line) · SourceCaption (household line with mark; Pantopus line in the proposed no-mark variant) · FreshnessLine (offline and stale average) · WarmingSkeleton (instrument variant, 12 varied columns; shimmer, static under Reduce Motion) · InlineErrorRow (card failed; average never loaded) · OfflineNotice · LockedActionRow (names who can act).

ACCESSIBILITY:
- iOS: the chart is one accessibility element with the summary sentence as its label, plus a note that it offers an "Audio graph" in the rotor. Its label also says "October, you added this".
- Android and web: the chart is an image whose label is the summary sentence plus "October, you added this", and the "Show amounts" list is the equivalent table.
- Month initials are never spoken alone.
- Reading order: title, summary, key, chart, caption, legend, sources, Show amounts.
- Columns and the reference line reach at least 3:1 against surface.raised in both themes, using the steps named above. The highlighted month differs by its printed value, outline and mark, not by hue alone.
- The disclosure has a 44pt/48dp/44px target and announces expanded or collapsed.
- At AX5: the summary wraps, the key wraps above the plot, the plot keeps its height and goes full width, and list rows stack month over amount.
- The frame must read correctly in greyscale.

COPY (sentence case):
- "Clark Public Utilities · last 12 months"
- "October $142. Your last 12 months ranged from $88 in June to $199 in January. The average of 14 homes nearby is $127."
- "Nearby average $127" · "Your amounts. The line is the average of 14 homes nearby." · "Only amounts people confirmed are counted."
- "✓ You added this — the October amount came from a photo you confirmed." · "✓ Sam added this — the October amount came from a photo Sam confirmed." · "✓ You added this — you entered the October amount."
- "Your household · confirmed bills · through Mon 19 Oct" · "Pantopus · average of 14 homes nearby · updated Thu 1 Oct" · "Pantopus · not enough homes nearby yet"
- "Show amounts" / "Hide amounts" · "October 2026 · $142.18 · from a photo you confirmed" · hand-entered: "October 2026 · $142.18 · you entered this" · partial history: "May 2026 · no bill"
- "Not enough homes nearby to compare yet" · "You've had this bill since June."
- Worst case: "NW Natural · last 12 months" · "October $61. Your last 12 months ranged from $44 in July to $413 in January. The average of 12 homes nearby is $140." · "Nearby average $140" · "Pantopus · average of 12 homes nearby · updated Thu 1 Oct"
- Guest (Alex): "Household bill · last 12 months" · "Only Maya and Sam can see bill amounts." with LockedActionRow "Ask Maya to change who can see bills."
- Error: "We couldn't load the last 12 months." · "Retry"
- Offline: "You're offline · as of Mon 19 Oct, 9:40 PM"
- Stale average: "Nearby average from Pantopus, Thu 1 Oct · Couldn't refresh · Retry"
- Average never loaded: "We couldn't get the nearby average from Pantopus · Retry"

EDGE CASES:
- Largest amount $412.90 (NW Natural): the axis top becomes $450; the key stays above the plot and the $140 tick sits in the gutter.
- One month of history: one column and eleven empty slots, with "You've had this bill since October."
- Zero confirmed amounts: the card is absent.
- An unconfirmed read is never a column and never counts toward any average.
- Slow network: the bill renders first, and the card shows the 12-column instrument skeleton with no line and no caption claim.
- Average stale vs never loaded vs not enough homes: drawn as three different states; stale and never loaded both name Pantopus as the source.
- Older bill open: the highlighted column moves to that bill's month.
- Offline: the cached chart keeps full contrast with the "as of" line; it is never greyed.
- A saved place has no bills, so there is no card.

INSTEAD OF:
- Instead of paired bars for you and the neighbourhood, draw one reference line — because the average is a typical amount, not another household.
- Instead of the existing Sparkline primitive, draw these data-bound columns — because that primitive draws a fixed, invented rising line.
- Instead of a label on the line inside the plot, draw a key above the plot and a tick label in the gutter — because the highlighted column always sits on the right, where a label would cover it.
- Instead of "12% above average" or an up arrow, draw the plain summary sentence — because a verdict judges the household and the house rules ban percentages.
- Instead of pale primary.200 columns with one label, draw primary.600 columns (primary.500 in dark) plus a list of amounts — because column height is the information and needs 3:1.
- Instead of a zero line or a county figure when homes are too few, draw no line and say why in the caption and the Pantopus source line — because the missing line is the honest signal.
- Instead of success or error colours on high months, keep one ink — because a high winter bill is not a failure.
- Instead of greying the offline chart, keep full contrast and add the "as of" line — because stale values stay readable with their age.

DONE WHEN: Maya reads "is this normal?" from the sentence alone. A screen-reader user gets all 12 amounts, including "no bill" months. With too few homes, the line is simply absent and both the caption and the Pantopus source line say so; a failed average looks different, names Pantopus, and no source line claims an average that is not there. No label covers a column. Dark columns and the line pass 3:1 on dark raised. Nothing on the card compares households or grades the bill. Alex is pointed at the person who can actually change bill access.

ARTBOARDS:
1. f10-bill-trend · ios · 01-twelve-months · light — full year, key above the plot, line, "$142" and tick on October, legend, two SourceCaption lines, beneath the provenance block.
2. f10-bill-trend · ios · 02-show-amounts-open · light — 12-row list expanded.
3. f10-bill-trend · ios · 03-partial-history · light — Jun–Oct columns, seven empty labelled slots, line drawn.
4. f10-bill-trend · ios · 04-not-enough-homes · light — columns, no line, no key, new caption, Pantopus line "Pantopus · not enough homes nearby yet".
5. f10-bill-trend · ios · 05-guest · light — Alex: "Household bill" title, reason line, LockedActionRow "Ask Maya to change who can see bills.", no shapes.
6. f10-bill-trend · ios · 06-loading · light — instrument skeleton columns.
7. f10-bill-trend · ios · 07-error · light — InlineErrorRow for the whole card, bill above intact.
8. f10-bill-trend · ios · 08-average-stale · light — line and key drawn, both source lines, FreshnessLine naming Pantopus with Retry.
9. f10-bill-trend · ios · 09-average-never-loaded · light — columns, no line, InlineErrorRow naming Pantopus in the caption slot, household source line only.
10. f10-bill-trend · ios · 10-offline · light — cached chart at full contrast, "You're offline · as of Mon 19 Oct, 9:40 PM".
11. f10-bill-trend · android · 11-twelve-months · light — Material version of 01-twelve-months.
12. f10-bill-trend · web-1440 · 12-twelve-months · light — f3-bill-detail-web route, arrival from the place file: highlight on the card, focus ring on the card title; inset captioned "after Tab": the October column focused with its value label.
13. f10-bill-trend · web-390 · 13-twelve-months · light — variant where the October bill was typed by hand: card directly under the facts, no provenance block, hand-entered legend.
14. f10-bill-trend · ios · 14-worst-case · light — NW Natural, $412.90 January, axis $450, key above the plot.
15. f10-bill-trend · ios · 15-ax5 · light — AX5 layout.
16. f10-bill-trend · ios · 16-greyscale · light — 01-twelve-months in greyscale.
17. f10-bill-trend · ios · 01-twelve-months · dark — dark twin of 01-twelve-months: primary.500 columns, primary.300 October with dark text primary outline, dark text primary line with dark raised halo.
18. f10-bill-trend · ios · 04-not-enough-homes · dark — dark twin of 04-not-enough-homes, same source-line change.
19. Notes — the Tue 20 Oct scene date; the dark steps (card surface.raised; past columns primary.500 #0ea5e9, 5.28:1 on dark raised; highlighted primary.300 #7dd3fc, 8.77:1, outline in dark text primary; line in dark text primary #E5E7EB with a 2px dark raised halo, because text.strong has no dark value in the house tokens); Alex Kim as Guest and Sam Ortega with bill access; the guest LockedActionRow names Maya, the owner, because only owners change who can see bills; every invented string (all 12 Clark Public Utilities amounts, $127.40, 14 homes, Thu 1 Oct, all 12 NW Natural amounts, $139.60, 12 homes); that this fixture replaces the f3-bill-detail-web placeholder trend; proposed SourceCaption variant for computed averages: no mark, because the average is neither official nor added by you; the "Pantopus · not enough homes nearby yet" source line; that frame 13 is a variant in which the October Clark Public Utilities bill was typed by hand, so it has no provenance block; handoff line "Built with Swift Charts"; assumptions and omitted states.

BATCH PLAN:
Turn 1: 1-6, then wait for "continue".
Turn 2: 7-12, then wait for "continue".
Turn 3: 13-18, then wait for "continue".
Turn 4: 19.
