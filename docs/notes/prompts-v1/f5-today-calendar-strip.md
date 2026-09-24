# Next 14 days at this address (strip + rows)
id: f5-today-calendar-strip · platforms: web/ios/android · isNew: True · frames: 12

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

CARD: Next 14 days at this address — strip + rows. A NEW card inside the existing, already-designed Today screen: keep Today exactly as it is and design this block, which sits directly below the pickup lead card and above weather.
PLATFORMS/VIEWPORTS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.

WHERE IT LIVES: Today tab → Today → this block (four-tab IA: Place · Today · Nearby · Mail). Reached by: scrolling Today (always visible); the Place file's 12-month year band → "this fortnight"; a reminder push carrying a rule id, which deep-links here and highlights that row on arrival.

THE ONE JOB: see the next two weeks at this address as a shape — pickup cadence, your own dates, seeded civic rows — with every item's provenance visible without tapping.

CONTENT (today = Monday 19 October 2026; 2418 NW Lacamas Dr, Camas, WA 98607; window Mon 19 Oct → Sun 1 Nov). Tue 20 Oct: "Recycling and garbage" — City of Camas Public Works, Route B, unconfirmed. Wed 21 Oct: "Clark PUD autopay — $148.62". Fri 23 Oct: "Lacamas Shores HOA dues — $265". Mon 26 Oct: "Voter registration deadline — online and by mail", scope label "Statewide — WA". Tue 27 Oct: "Garbage" (weekly; recycling is biweekly). Thu 29 Oct: "Renters insurance renews — State Farm, $19/mo". Fri 30 Oct, four items: "Lease notice deadline — tell landlord by Oct 30", "Property-tax appeal window closes" labelled "Clark County", "Home warranty ends", "Comcast — $89.99". Sat 31 Oct: "Bulk pickup — curbside by 6am". Foot of the list: a persistent "+ Add a date" row.

THE VISUALIZATION DECISION: 14 equal cells in one horizontal strip, today leftmost, weekday initial beneath each cell (M T W T F S S), weekend cells tinted so the Tuesday pickup cadence reads as a rhythm. One dot per event inside its day cell, coloured by class — pickup / civic / money / yours — capped at three dots then "+1". Dots carry the provenance encoding used everywhere in Pantopus: FILLED = official, HOLLOW = on record but unconfirmed, FILLED-WITH-TICK = you entered it. A statewide or county-scoped row renders NOT as a dot but as a full-height bar spanning its cell, because a bar visibly is not a claim about this house; Mon 26 Oct is that bar. Tonight's pickup emphasises cell 2 — an emphasis, never an alert banner. Below the strip, list rows: kind glyph, title, relative day ("Tomorrow", "in 4 days"), provenance mark. Every one of the six new kinds needs its own drawn glyph; do not reuse one generic calendar icon.

STATES — 10 frames on iOS 393×852: loading; ready (the dense case above); empty — 14 drawn-but-empty cells reading "Checked — nothing in the next two weeks"; stale/partial section fallback; unverified city rule (hollow); user-entered rule (tick); seeded statewide rule (bar); permission-denied — rows visible, no "+ Add a date"; T1 saved place; error — no strip drawn at all rather than an empty one. Then 2 platform frames of ready: web 1440×900 and Android 412×915.

DO NOT render these fourteen days as a text list alone — a paragraph cannot answer the question the window exists for. Do not let the empty state look like a failure or a spinner: drawn-but-empty cells are the point. Do not move "+ Add a date" into the card header as a mode toggle; a list gets a list row. Do not draw the statewide deadline as a dot inside a day cell.
