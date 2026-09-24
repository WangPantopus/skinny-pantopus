# Compare share card (OG image)
id: f8-og-compare-card · platforms: web · isNew: False · frames: 6

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Compare share card — the Open Graph image served by /api/og/place.
PLATFORM: web only. Canvas 1200×630, plus one 400×210 crop. This is a server-rendered PNG, not a themed page: draw it in the LIGHT palette only, then show it once sitting in a dark chat thread so you can check its edges do not dissolve.
THIS IS: an EXTENSION of the existing designed screen "Place OG share card (single address)" — this already exists and is already designed in the Pantopus design system. Open it, keep everything, and change only what is listed below: add the two-column ?vs= compare variant.
WHERE IT LIVES: outside the four tabs. It is the unfurl artifact for /start?vs=<token>; the tap lands on /start?vs=, the signed-out door to the Place tab.
HOW THE USER GETS HERE: a friend pastes a /start?vs= link into iMessage, WhatsApp, Slack or a group chat and the client fetches this image. The reader has never heard of Pantopus.
THE ONE JOB: be the first thing a stranger sees inside someone else's chat thread, and make "Yours?" the obvious next question.

CONTENT (exact strings, densest realistic case):
Left column, the sender: "Maya · Camas, WA". Four scale-strip rows — Flood: value "Zone X — minimal", caption "FEMA flood zone". Wildfire: "Moderate", "USFS wildfire hazard, quarter-mile". Air today: "AQI 42 · Good", "AirNow, today". Radon: "Zone 1 — highest", "County radon zone (EPA)" carrying the hollow unconfirmed mark. Headline beneath: "Voter registration for November 3 closes October 26 in Washington."
Right column: a FILLED prompt card, equal visual weight — "Yours?" as the large line, an address-field-shaped slot under it, "pantopus.com" as the foot.
Full-width footer: "Nextdoor is what your neighbors say. Pantopus is what's on record about your address."

THE VISUALIZATION DECISION: the left column is the same four-layer scale-strip instrument the app renders, at OG size — one horizontal track per layer, segmented into THAT authority's own named bands (FEMA zones; USFS 1–5; the six AirNow bands; radon zones 3-2-1), a marker sitting in its band, the plain band name printed beside it, the authority as a caption under it. Tracks never span layers and nothing sums, averages or ranks across them, so the card cannot read as a scorecard on a home. The share artifact must be visibly a preview of the product, so reuse the app's row, do not invent a chart. A layer with no data degrades to a greyed track with no marker and the words "Not on record" — never a blank row, because the two columns must stay the same height. The "Yours?" column is filled, not an outlined ghost: an empty outline reads as a broken render in a chat thread, and it is the entire conversion mechanic. All type must survive the 400px thumbnail crop some clients use.

STATES TO DRAW (each its own frame):
1. vs valid, first name shown (the content above).
2. vs valid, no first name — the sender reads "A place in Camas, WA".
3. Headline at the ~140-character slice limit, ellipsised at a word boundary, with the radon layer degraded to "Not on record".
4. vs expired or tampered, and the no-vs case: the unchanged generic single-address card. Same artwork for both.
5. Frame 1 cropped to 400×210.
6. Frame 1 pasted into a dark messenger thread.

DO NOT: do not print letter grades A/B/C/D or any shared ordinal across the four layers — they are four incommensurable authorities. Do not draw a radar or spider chart. Do not render an error, a broken-image glyph or a bare logo for the expired token — a stranger's group chat is the one place this product cannot look broken. Do not put the address anywhere on the card.
