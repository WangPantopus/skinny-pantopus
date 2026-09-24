# Household calendar (give the built screen an entry point)
id: f3-household-calendar · platforms: web/ios/android · isNew: False · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

THIS IS AN EXTENSION of the existing screen "Household calendar" (the home agenda) - this already exists and is already designed in the Pantopus design system - open it, keep everything, and change only what is listed below. It is fully built and currently linked from nowhere in the app.

PLATFORMS: web 1440x900 and 390x844, iOS 393x852, Android 412x915.

WHERE IT SITS: Place tab -> this home -> Calendar. Reached by three links that must be drawn as part of this work: the home header Calendar tab, the dashboard Calendar card's "Open calendar", and the place file's Dates section row "Everyone here can see these". Plus the home_event_created push, deep link /homes/:id/calendar.

THE ONE JOB: let a co-resident read and edit the household calendar, and make the save toast "Saved to your household calendar" actually true.

CONTENT - Maple St, 1428 NE Maple St, Camas WA 98607; today Wed Sep 16 2026; show September through December 2026 at real density with all five item types mixed. Address rules (the new fifth type): "Garbage + recycling" every Wednesday (Sep 16, 23, 30, Oct 7), HOLLOW mark, source Camas city schedule; "Furnace filter" Oct 1, TICK mark, entered by Dana; "Clark County property tax, 2nd half" Oct 31, FILLED mark, Clark County Assessor; "WA voter registration deadline" Oct 26, FILLED, scope chip "Statewide - WA"; "Smoke alarm batteries" Nov 1, TICK, annual. Home events: "Priya's parents visiting" Oct 9-12 (Priya Raman); "Chimney sweep - 9:00 AM" Sat Nov 14 (Dana Whitfield). Derived task: "Change HVAC filter" due Oct 1. Derived bills: "Clark PUD $84.00" Sep 20, "City of Camas Water/Sewer/Storm $137.40" Sep 25, "NW Natural $41.18" Oct 2. Derived package: "Package expected - Waste Connections toter" Sep 22. December 2026 holds exactly one item: "Backflow assembly test" Dec 3.

THE VISUALIZATION DECISION: keep the agenda (month header, day-grouped rows) - do not replace it with a month grid. Address rules join as a fifth type with an explicit visual rule separating ANNUAL, SELF-ENTERED from THIS-WEEK, DERIVED, so a tax deadline or a lease end never reads like an overdue task: annual/self-entered rows take a hairline left rule in the home green and a recurrence caption ("Every year - you entered this"); derived near-term rows take the kind glyph and a relative day ("Wed - today") and may inherit the urgency treatment. Every row carries the same provenance mark used on Today's 14-day strip, right-aligned, same size everywhere: FILLED = official/confirmed, HOLLOW = on record but unconfirmed, FILLED-WITH-TICK = you entered it. Tapping a mark opens the provenance sheet. Statewide rows carry the "Statewide - WA" scope chip so they visibly are not a claim about this house. The dashboard's separate 7-day household aggregate is DELETED - this is the one calendar. Degradation: when derived bills or tasks are hidden by the viewer's own permissions, the day keeps its address rules and events and no ghost row is drawn.

STATES TO DRAW, each its own frame:
1. Loading.
2. Agenda with events - the dense Sep/Oct case above.
3. Empty.
4. Member with calendar.edit - compose affordance present.
5. Legacy member read-only - edit absent, explained in one caption.
6. Derived items hidden per the viewer's permissions.
7. Create-event sheet.
8. A month with one annual date and nothing else - December 2026 with only the backflow test, reading as finished, not broken.
9. Error.
10. Offline.

DO NOT: do not replace the agenda with a month grid; do not let an annual date inherit the overdue red treatment; do not draw two calendars on two surfaces; do not put date editing inside this screen - a row edit hands off to the Date sheet, one write path.
