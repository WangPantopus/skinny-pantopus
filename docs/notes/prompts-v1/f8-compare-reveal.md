# Compare reveal (a third funnel step)
id: f8-compare-reveal · platforms: web · isNew: True · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Compare reveal (a third funnel step)
THIS IS: a NEW screen — an explicit third state of the /start funnel state machine (hero | compare-reveal | preview) at /start?vs=<token> after submit. It has its own skeleton, its own error rules and its own place in the funnel; it is not a card on the hero.
PLATFORM / VIEWPORTS: web only. 390×844 mobile web (primary) and 1440×900; the layout breakpoint is 768.
WHERE IT LIVES: not inside the four-tab app; it is step 3 of the signed-out /start door that precedes Place · Today · Nearby · Mail. Reached one way: submitting an address from the compare arrival header.
THE ONE JOB: The payoff moment — their place next to the sender's, layer by layer — before dropping them into their own full preview.

CONTENT: sender "Dana · Camas, WA" (frozen token, as of Sep 12, 2026); recipient typed 6207 NE 42nd Ave, Vancouver WA 98661; today is Sep 16, 2026. Comparison block first, then a quiet divider, then the recipient's own aha "Zone AE — this address is in the 100-year floodplain" (FEMA, effective Sep 24, 2021), the money lead "2026 assessed value $487,300 · Clark County Assessor · taxes billed Apr 30 and Oct 31", Band-A groups unchanged (Garbage & recycling — "Recycling + garbage, Tuesdays"; Risk & readiness; Civic & elections — "Registration for Nov 3 closes Oct 26"), locked Band-B groups (Permits & history, Money & bills, Who's nearby), and the sticky WallBar unchanged with "Claim this address and be one of the first here". A secondary "Send yours back" opens the compare sheet.

THE VISUALIZATION DECISION: ONE comparison table, four rows, one row per layer. Each row is a SINGLE track — that authority's own named bands — carrying BOTH marks: the sender's mark FILLED, the recipient's mark RINGED and labelled "You". Layer name above the track; the two plain-language values beneath it, sender left, "You" right. Rows are ordered by the distance between the two marks, descending, so the one real difference is row one — never a fixed order and never "worse first". With this data: 1) Flood — Dana "Zone X — minimal" / You "Zone AE — 1% annual chance"; 2) Wildfire — Dana "Moderate — 3 of 5" / You "Low — 2 of 5"; 3) Air today — Dana "AQI 42 — Good" / You "AQI 58 — Moderate"; 4) Radon — both in Zone 1, marks merge into one mark labelled "Both highest predicted". Above 768px, draw true two-column cards as a presentation of the same four rows — the same tracks, wider — not as two facing scorecards.

STATES TO DRAW (one frame each, light and dark):
1. Loading — a two-column skeleton with the four track outlines already drawn.
2. Both revealed — the content above, 390 wide.
3. Both marks in the same band — merged mark plus "Both minimal"; draw the whole table in this outcome, since it is the most common one.
4. Recipient geocode failure — the sender's four marks STAY on screen, "You" side shows an inline retry with the address field; the funnel must not reset.
5. Unsupported region — same rule: sender column preserved, one explanatory line on the "You" side.
6. A layer missing for the recipient — that row's "You" value reads "Not on record here", track greyed on that side, row height unchanged.
7. Legacy free-tiles fallback when sections is empty — compare block intact, the sections below replaced by the legacy tiles.
8. Offline after reveal — comparison held from memory, locked groups and WallBar actions disabled with a quiet line.
9. Desktop ≥768px, both revealed — two-column presentation of the same rows.

WHY IT IS SHAPED THIS WAY, do not optimise away: two literal facing cards at 375px is eight markers and eight captions, and two scorecards invite a winner — the neighbour-judgement failure this product exists to avoid. A shared track reads as two readings on one instrument, works identically at 375 and 1200px, and solves the OG card with the same component.

DO NOT: do not draw two facing scorecards, a versus badge, a winner, a "better/worse" label, or any arrow between the two marks. No letter grades, no score, no total. Do not order rows worst-first or by severity. Do not let the geocode failure destroy the sender's column or bounce the user back to the hero. Never show the sender's street address, and never phrase any row as a claim about the sender's house.
