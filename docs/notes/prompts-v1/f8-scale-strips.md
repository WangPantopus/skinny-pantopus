# The four-layer reading instrument (scale strips)
id: f8-scale-strips · platforms: web/ios/android · isNew: False · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: The four-layer reading instrument (scale strips)
THIS IS: a NEW shared component, not a new screen. Its in-app home is the existing screen "Place > Risk & readiness" — that screen already exists and is already designed in the Pantopus design system: open it, keep everything, and replace only its four independent inline chip rows with this instrument. The identical component is then dropped unchanged into the compare arrival header, the compare reveal, the compare sheet's card preview and the OG share card, so the most-shared artifact in the product is visibly a preview of the app.
PLATFORMS / VIEWPORTS: web 1440×900 and 390×844; iOS 393×852; Android 412×915.
WHERE IT LIVES: Place tab → Risk & readiness → this card. Reached by: the "Risk & readiness" section row in the Place tab; a tap on any scale strip on a shared card; the T0 preview's radon aha follow-up.
THE ONE JOB: Make four readings from four different authorities comparable without inventing a grade or judging a home.

CONTENT — 1402 NE 3rd Ave, Camas WA 98607, Wednesday Sep 16 2026. Four rows, this order, each as layer name / plain value FIRST / authority caption / provenance mark / tap into the provenance sheet:
- Flood — "Zone X — minimal risk" — "FEMA flood zone · effective Sep 24, 2021" — filled mark
- Wildfire — "Moderate — 3 of 5" — "USFS wildfire hazard potential, quarter-mile · 2023" — filled mark
- Air today — "AQI 42 — Good" — "AirNow · updated 3:10 PM today" — filled mark
- Radon — "Zone 1 — highest predicted" — "County radon zone (EPA) · Clark County, WA" — hollow mark, caption "On record, not yet confirmed"

THE VISUALIZATION DECISION: every row is a horizontal track segmented into THAT authority's own named bands, with a marker sitting in the occupied band and that band's plain name printed beside the marker. Flood: 4 segments — X · X shaded · AE · VE. Wildfire: 5 equal segments — Very low · Low · Moderate · High · Very high. Air today: 6 segments sized to the real AQI ranges (0–50, 51–100, 101–150, 151–200, 201–300, 301–500), the only track carrying numbers. Radon: 3 segments — Zone 3 · Zone 2 · Zone 1. Tracks must not align across rows and must not share a colour ramp: draw segments as neutral surface tokens divided by hairline borders, give only the occupied band a raised fill and a strong border, and let the marker be the one saturated element. Marks carry the product-wide encoding: FILLED = official/confirmed, HOLLOW = on record but unconfirmed, FILLED-WITH-TICK = you entered it. Draw the instrument at three sizes: OG card column (520 wide inside 1200×630), compare row (390 wide), risk detail (full width, 48pt tappable rows).

STATES TO DRAW (one frame each, light and dark):
1. All four layers present (the content above).
2. A layer with no data — greyed track, no marker, value reads "Not on record". Never a blank row: the two columns of a comparison must stay the same length.
3. Unverified reading — radon and wildfire both hollow, captions intact.
4. Air is time-scoped — the row always says "today" and carries the observation time; show it next to the three undated layers so the difference is visible.
5. Frozen vs live — the same four rows rendered from a sender's compare token, each captioned "As of Sep 12, 2026" while the viewer's own air row says "today", so freshness is stated rather than implied.
6. Narrow width (320–360) — the four authority captions collapse into one line, "Sources: FEMA, USFS, AirNow, EPA", instead of dropping provenance.
7–9. The three sizes above, each drawn once with the full four-layer content.

WHY IT IS SHAPED THIS WAY, do not optimise away: this component exists to kill letter grades. The current share token declares flood A, wildfire C, air B, radon D — four incommensurable readings forced onto one invented ordinal scale with no legend, which turns "what's on record about an address" into a report card on somebody's home.

DO NOT: do not draw letter grades, a score, a star rating or any summary number. Do not draw a radar/spider chart — it normalises unlike axes and encodes area, so a bigger blob reads as a worse home. Do not run a green→amber→red ramp across or within the tracks; a shared colour scale is a letter grade by another name. Do not let the four markers line up on a shared axis, and never let a row imply a judgement about the household.
