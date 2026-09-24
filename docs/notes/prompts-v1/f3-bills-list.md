# Bills list (member read-only + payer attribution)
id: f3-bills-list · platforms: web/ios/android · isNew: False · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

THIS IS AN EXTENSION of the existing screen "Bills list" (and its dashboard Bills card) - this already exists and is already designed in the Pantopus design system - open it, keep everything, and change only what is listed below.

PLATFORMS: web 1440x900 and 390x844, iOS 393x852, Android 412x915.

WHERE IT SITS: Place tab -> your place file (Money section) -> this home -> Bills. Also reached from the home dashboard Bills card "View", the home header Bills tab, and a bill_paid notification which scrolls to and highlights one row.

THE ONE JOB: let a co-resident see the household's bills and see who paid what, so two people do not pay the same bill.

CONTENT - Maple St, 1428 NE Maple St, Camas WA 98607, today Sep 16 2026. Header "6 upcoming - $2,233.48". Segments: Upcoming / Paid / All. Upcoming rows: Clark PUD $84.00 due Sep 20; City of Camas Water/Sewer/Storm $137.40 due Sep 25; NW Natural $41.18 due Oct 2; Xfinity Internet $89.99 due Oct 5; Waste Connections $38.75 due Oct 10; Clark County property tax, 2nd half $1,842.16 due Oct 31. One overdue row: State Farm renters $22.50 due Sep 12. Paid rows carry attribution: Clark PUD $79.12 "Paid by Sam - Sep 15"; City of Camas Water/Sewer/Storm $131.06 "Paid by Dana - Aug 24"; NW Natural $38.40 "Paid by you - Aug 30".

THE VISUALIZATION DECISION: a fixed row grammar, identical on all three platforms. Line 1: provider on the left at bodyMedium, status chip after it, amount right-aligned in the same optical column on every row so the amounts read as a column. Line 2: due date on the left, payer attribution on the right - "Paid by Sam - Sep 15" - at bodySmall/secondary. The attribution is the load-bearing element: it is what gives the bill_paid push an in-app twin, so it must never truncate before the person's name; truncate the provider first if anything has to go. One status chip only, never two. Highlight-from-notification: the target row takes a temporary infoBg wash plus a border.focus outline that decays after a few seconds and is scrolled into view - it opens nothing by itself. Member read-only: no "Mark paid" on the row at all; the whole row is a link into bill detail. Manage variant: "Mark paid" lives in the row overflow menu, never as a bare tap target on the row face.

WHY (do not optimise this away): mark-paid semantics must be identical everywhere they exist, or the write is removed from glanceable surfaces entirely - a mis-tap on a card someone was skimming must not mark a household bill paid and notify everyone in the house.

STATES TO DRAW, each its own frame:
1. Loading.
2. Upcoming segment (all six rows plus the overdue row).
3. Paid segment (attribution on every row).
4. All segment.
5. Member read-only.
6. Manage (overflow open on one row).
7. Highlighted from a notification.
8. Permission-denied.
9. Error.
10. Offline.

DO NOT: do not put a one-tap "Mark paid" on the row face or on the dashboard Bills card; do not reduce the payer to an avatar with no name - the name is the whole point; do not show a member a greyed "Mark paid" with no reason attached; do not add a budget bar, a spend meter or a percentage-of-budget ring to this list.
