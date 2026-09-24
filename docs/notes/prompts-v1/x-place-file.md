# Your place file
id: x-place-file · platforms: web/ios/android · isNew: True · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Your place file
THIS IS A NEW SCREEN. Nothing like it exists yet in the Pantopus design system — design it from scratch, but built entirely out of existing tokens, card styles and row patterns.
PLATFORMS: web 1440x900 desktop and 390x844 mobile web; iOS 393x852; Android 412x915. Draw light and dark.
WHERE IT LIVES: it IS the Place tab's index — the first of the four tabs (Place / Today / Nearby / Mail). Web /app/place, iOS place tab root, Android home root.
HOW THE USER GETS HERE: tapping Place in the tab bar / sidebar; a single progress row on Today during the first 14 days reading "3 of 6 things on file →"; the claim-success receipt's "See what we know"; a reminder push that carries no specific rule id; the keeper strip's fact count (phase 2).
THE ONE JOB: see every fact Pantopus holds about this address in one list, and fill in the ones it doesn't have yet.

WHY IT IS SHAPED THIS WAY (do not optimise this away): the same facts are today drawn as four different lists — a first-week checklist, a Just Moved card, a Your-dates card and a keeper ledger — with four storage models and four dismissals. This is the merge. It also fixes the Place tab having no reason to exist for someone with no claimed home, and it is the only surface where a date more than 14 days out is visible at all: a lease ending eight months from now is currently saved, toasted, then invisible until two weeks before it fires.

THE VISUALIZATION DECISION — THE YEAR BAND (top of screen):
A 12-month horizontal timeline, Sep 2026 through Aug 2027, months as 12 equal columns with three-letter labels. Four horizontal LANES, labelled at the left: You · Your city · Your county · Your state. One marker per rule, positioned at its date inside its source's lane. Today (Sep 16) is a full-height vertical rule; the next 14 days (Sep 16–30) are a shaded vertical band, so the year band and Today's 14-day strip are visibly the same data at two zooms.
Markers carry the system-wide provenance encoding, no exceptions: FILLED = official/confirmed · HOLLOW = on record but unconfirmed · FILLED-WITH-TICK = you entered it. A statewide rule draws as a full-height bar spanning its column, not a dot, so it never reads as a claim about this specific house. Recurring pickup draws as an evenly repeating rhythm of small hollow marks across the Your city lane, not one marker.
Draw these real markers: You lane (tick) — Furnace warranty ends Nov 14 2026; HOA dues $385 Jan 15 2027; Insurance renews Mar 3 2027; Notice deadline Apr 1 2027; Lease ends May 31 2027. Your city lane (hollow) — Camas garbage Thursdays, recycling every other Thursday, next Sep 24. Your county lane (filled) — Clark County property tax 2nd half Oct 31 2026; 1st half Apr 30 2027; Assessor appeal deadline Jul 1 2027. Your state lane (filled, full-height bars) — WA voter registration online/mail deadline Oct 26 2026; in-person deadline Nov 3 2026.
Band degradation: with no rules at all, still draw 12 month columns and all four labelled empty lanes with the caption "Checked — nothing on file for the next year", visually distinct from a failure. On error, draw no band at all rather than an empty one.

THE VISUALIZATION DECISION — THE COUNT:
A five-segment ring, one segment per category, a segment filled if anything is known in that category, with the integer "14" and the label "things on file" inside. It is deliberately NOT a progress bar and NOT a percentage.

CONTENT — fact rows below the band, five categories, densest realistic case (claimed home, 2418 NW Sierra St, Camas, WA 98607, moved in Aug 28 2026, today is Sep 16 2026). Every row is either KNOWN (value as the primary line + edit affordance) or MISSING (a one-line ask + CTA, never a red X):
PLACE — Address · 2418 NW Sierra St, Camas, WA 98607 · "Everyone in this household" · tick. Garbage & recycling day · Thursday, recycling every other week, next Sep 24 · hollow · caption "City of Camas schedule" · CTA "Not my schedule". Moved in · August 28, 2026 · tick.
DATES — Lease ends · May 31, 2027 · "Reminder set 60 days before". Notice deadline · April 1, 2027. Furnace warranty ends · November 14, 2026. HOA dues · January 15, 2027 · $385. Property-tax appeal · July 1, 2027 · "Clark County Assessor" · filled. Voter registration · October 26, 2026 · "Statewide — WA" · filled. MISSING: "When does your home insurance renew?" → Add date.
MONEY — Electricity · MISSING · "Add your Clark Public Utilities bill". Gas · MISSING · NW Natural. Water & sewer · MISSING · City of Camas.
PEOPLE — Co-residents · Dana Whitfield (you, owner) and Marcus Whitfield, joined Sep 2. Invite pending · jules.okafor@gmail.com, sent Sep 11, expires Sep 25 · Resend.
PROOF — Address verification · "Confirmed by mailed code, September 4, 2026" · filled. Ownership · MISSING · "Not confirmed" → Verify.
MOVER ROWS (present only because move-in was 19 days ago, inside the 60-day window; each individually dismissible): Forward your mail · USPS. Move your utilities · Clark Public Utilities, NW Natural, City of Camas. Update your voter registration · by October 26.
WIDGET ROW (shown because no widget is placed): "Put today on your home screen".

STATES TO DRAW, each its own frame:
1. Loading — band skeleton reserves its full height, no pop-in.
2. T3 claimed home, mover window active — the dense frame described above.
3. T1 saved place (1402 NE 3rd Ave, Camas) — Place and Dates rows present; Money, People and Proof each render the row "Not here — this is a saved place", never as failures; footer line "Only you can see this."
4. Mover rows dismissed — an Undo affordance, plus a quiet "Show again in home settings" line.
5. All known — "Everything we can hold about this place is on file". No confetti, no percentage, no celebration.
6. Sync merge — a one-time line "Synced 3 items from your other device" above the rows.
7. Permission-denied per row — a household member without finance.view or members.manage still sees the fact COUNTED and the category segment filled; the row's CTA is disabled with the reason inline ("Only an owner can add bills").
8. Offline — cached band and rows, every CTA disabled, an "as of" caption.
9. Error — rows fail to load; no band drawn.
10. Empty year, claimed home — band with four empty labelled lanes, "Checked — nothing on file for the next year".

DO NOT: do not draw a percentage, a progress bar, a completion meter or a checklist with a score — nothing on this screen may read as "you are 60% complete". Do not render a missing fact as an error, a warning colour or a red X; missing is an invitation. Do not collapse the four source lanes into one row of dots — the lane IS the honesty claim. Do not let a statewide deadline render as a dot in the same shape as a fact about this house.
