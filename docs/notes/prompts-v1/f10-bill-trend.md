# Bill trend vs the going rate
id: f10-bill-trend · platforms: web/ios/android · isNew: False · frames: 7

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Bill trend vs the going rate
THIS IS: an EXTENSION. The host is the existing screen "Bill detail" (web /app/homes/[id]/bills/[billId], iOS BillDetailView, Android BillDetailScreen). This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below. Add one card directly beneath the provenance block.
PLATFORMS / VIEWPORTS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
WHERE IT LIVES: Place tab → Money → Bills → Bill detail, drawn per bill type. Also reachable from Place tab → your place file → Money section.
THE ONE JOB: Answer "is this bill normal for around here?" in one glance, so the monthly return to the app has a payoff.

CONTENT (exact values, densest realistic case)
Card title "Clark PUD — last 12 months". Twelve monthly amounts, Nov 2025 → Oct 2026, left to right:
118.22, 167.05, 198.73, 186.41, 151.60, 112.88, 94.15, 88.02, 103.77, 121.34, 109.60, 142.18.
Oct 2026 ($142.18) is the current month and is the bill open on this screen; it came from a photo the user confirmed on Oct 3.
Peer reference: $127.40, k = 14. Caption verbatim: "Your amounts. The line is the average of 14 homes nearby."

THE VISUALIZATION DECISION
A zero-based COLUMN chart of your own amounts, with the peer average as a single horizontal REFERENCE LINE — not a paired second series. Paired bars invite a household-versus-household reading; a baseline reads as "here is the going rate", which is what a k-anonymous average actually is.
Draw it exactly this way: 12 equal columns with 4px gaps, month initial under each (N D J F M A M J J A S O), a hairline plus a "2026" caption under January where the year turns. Y axis zero-based with only two labels, $0 at the baseline and $200 at the top; no interior gridlines. Columns fill primary.200; the current month fills primary.600 and carries its value "$142" labelled above it. One 1px reference line in text.secondary spans the full plot at $127.40, right-anchored label "Nearby average $127". The current column carries the system's filled-with-tick provenance mark centred under its month initial, so the provenance block above and this chart agree that October's number came from a photograph the user confirmed.
Degradation, and this is the point of the card: when the peer set is too small, draw the columns and draw NO LINE AT ALL, and change the caption to "Not enough homes nearby to compare yet." The line's ABSENCE is the honest signal. Never drop the line to zero, never dash a line along the baseline, never substitute a county or state figure to keep the shape intact.
Partial history: keep all 12 month slots and their labels; months with no bill hold no column, so five months of data cannot masquerade as a year. Caption gains "You've had this bill since June."

STATES TO DRAW (one frame each)
1. Twelve months present, line drawn. 2. Partial history — Jun–Oct 2026 only (88.02, 103.77, 121.34, 109.60, 142.18), seven empty labelled slots, line still drawn. 3. Insufficient data — columns, no line, "Not enough homes nearby to compare yet." 4. Permission-denied — a member without finance.view sees the card title and the caption, the plot area replaced by one line giving the reason; no shapes, no blurred numbers. 5. Loading — 12 skeleton columns at varied heights, no line, no caption claim. 6. Error — "We couldn't load the last 12 months" with Retry, the bill above untouched. 7. Offline — last cached chart, greyed, "As of Oct 3".

DO NOT
Do not draw a second series of peer columns or paired bars. Do not add a percentage-difference badge, an up/down arrow, or "12% above average". Do not truncate the y-axis. Do not turn this into a line or area chart of your own amounts — columns are the shape. Do not colour months with success/error tokens as if a high bill were a failure. Do not ever label the line "your neighbours" or "neighbouring households" — it is an average of homes nearby, never a claim about any particular home.
