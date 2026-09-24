# Bill detail (new web route)
id: f3-bill-detail-web · platforms: web · isNew: True · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

THIS IS A NEW SCREEN, web only. There is no bill-shaped destination on web today, so every money push currently lands on a list.

VIEWPORTS: 1440x900 desktop and 390x844 mobile web. Left sidebar on desktop, four-tab bottom bar on mobile web.

WHERE IT SITS: Place tab -> this home -> Bills -> a bill. Route /app/homes/:homeId/bills/:billId. Reached from: a bill_paid in-app notification or push; a bill reminder push; a Bills list row; the Today 14-day strip money row (phase 2); "Added to bills" on a Mail piece (phase 2).

THE ONE JOB: give every bill push, notification and calendar row an exact surface to land on.

CONTENT - Maple St, 1428 NE Maple St, Camas WA 98607, today Sep 16 2026. Clark PUD, electric, $84.00, "Due Sunday, Sep 20", account ending 4417, status Upcoming. Paid frame: "Paid by Sam - Tue" (Sam Okafor, Sep 15 2026). Actions: "Mark paid" / "Already paid" gated on finance.manage, "Edit", "Remove". Phase-2 evidence, drawn in the dense frame: provenance block "From a photo you took - Oct 3" with a thumbnail, the line "We read this from your photo. You confirmed the amount on Oct 3.", plus "View the photo" and "Fix what we read". Removed-bill copy: "This bill was removed" + "Back to bills".

THE VISUALIZATION DECISION: the amount and due date are the headline - $84.00 at h1, "Due Sunday, Sep 20" directly beneath at h3 in text.secondary, and a SINGLE status chip beside them (Upcoming / Due today / Overdue / Paid). Everything else is subordinate: one column on mobile, a 2/3 + 1/3 split on desktop. The provenance block and the trend sit BENEATH the number as evidence, never as a banner above the thing the reader came for. The trend is a zero-based column chart of this household's own 12 monthly amounts (Oct 2025 through Sep 2026: 71, 68, 94, 112, 108, 86, 74, 69, 72, 79, 91, 84 dollars), current month highlighted, with the k-anonymous peer average as ONE horizontal reference line at $81 and the caption "average of 14 homes nearby". X axis is months, Y axis is dollars from zero. It is not a paired second series: paired bars invite a household-versus-household reading, while a baseline reads as "here is the going rate", which is what a k-anonymous average actually is. Degradation: when insufficientData is true, draw the bars and OMIT the line entirely, caption "Not enough homes nearby to compare yet" - the line's absence is the honest signal and it must never fall back to a zero baseline. A bill created from a snap marks its own column so the provenance block and the trend agree.

STATES TO DRAW, each its own frame:
1. Loading.
2. Unpaid.
3. Due today.
4. Overdue.
5. Paid - arriving here from a reminder must read as reassurance ("Paid by Sam - Tue"), not as an error colour.
6. Member read-only - "Mark paid" absent, one line saying why.
7. Deleted since the push - "This bill was removed", with a route back, never a blank screen or a 404.
8. Permission-denied.
9. Error.
10. Offline.

DO NOT: do not place the provenance block or the trend above the amount; do not draw a paired bar chart or a second peer series; do not draw a confidence percentage on the extraction - the reader already confirmed that value and a percentage only invites distrust; do not render a removed bill as an error page.
