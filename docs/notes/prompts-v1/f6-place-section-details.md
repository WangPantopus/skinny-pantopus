# Place section details: risk instrument, free radon kits, registration deadline
id: f6-place-section-details · platforms: web/ios/android · isNew: False · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Place section details — "Risk & readiness" and "Civic"
THIS IS: an EXTENSION of two existing designed screens, "Place > Risk & readiness" and "Place > Civic". They already exist and are already designed in the Pantopus design system — open them, keep everything (section headers, the existing grey screening disclaimer, the existing election banner), and change only what is listed below. The four-layer scale strip is the already-designed shared component from the compare share card: reuse it at detail size, do not redraw it.
PLATFORMS: web 1440×900 and 390×844; iOS 393×852; Android 412×915.
WHERE IT LIVES: Place tab → section list → Risk & readiness; Place tab → section list → Civic.
HOW THE USER GETS HERE: those two section rows; the place file's "Voter registration" row; a tap on any layer of the compare share card's scale strip (this page is that card's in-app twin, and those chips have no destination today); the free-radon follow-up after the signed-out address preview.
THE ONE JOB: make the in-app risk page the same reading instrument the share card uses, give the radon card its one genuinely free action, and give voter registration a home that outlives the 60-day mover window.

CONTENT — 4312 NW Sierra Dr, Camas, WA 98607; today Wed 16 Sep 2026.
RISK: replace the four independent inline chip rows with four stacked scale strips —
· Flood — "Zone X · minimal hazard" · bands X / shaded X / AE / VE · "FEMA flood map, effective 2021" · filled mark
· Wildfire — "2 of 5 · Low" · bands 1–5 · "USFS wildfire hazard potential, quarter-mile" · filled mark
· Air today — "38 · Good" · the six EPA bands Good / Moderate / Unhealthy for Sensitive Groups / Unhealthy / Very Unhealthy / Hazardous · "AirNow, today 9:00 AM" · filled mark
· Radon — "Zone 1 of 3 · highest potential" · bands 3 / 2 / 1 · "Clark County radon zone (EPA)" · hollow mark
Keep the grey disclaimer "A county zone is a screening estimate. Only a test tells you about this house." Under it add ONE action pill with a trailing arrow: "Free test kits · Washington Dept of Health".
CIVIC: add a "Your registration" block ABOVE the existing "General election · Tue Nov 3, 2026" banner — "Washington · Register by Mon Oct 26, 2026 · 40 days left"; two per-method rows, "Online or by mail — Mon Oct 26" and "In person at Clark County Elections — until 8:00 PM Tue Nov 3"; a hollow provenance mark with "On record, not yet confirmed"; source link "Washington Secretary of State"; primary "Check or update" opening the Date sheet in seeded mode.

THE VISUALIZATION DECISION: four horizontal tracks of equal row height, each segmented into ITS OWN authority's named bands, with the marker inside its band and the band's plain name printed beside the track. Tracks never align or span across layers, because nothing here may sum or average into a verdict about a house. Degradation: a layer with no data draws a greyed track, no marker, and the words "Not on record" at full row height, so four never becomes three. Unverified confidence degrades to a hollow marker plus its source caption, never to a hidden row. At 390px the four authority captions collapse to a single "Sources: FEMA, USFS, AirNow, EPA" line rather than dropping provenance. The free-kit pill is separated from the disclaimer by a rule and 16pt: stacking a second grey block under an existing grey buries the only free thing on the card.

FRAMES (one each): risk ready, all four strips · risk partial coverage (wildfire greyed, "Not on record") · no radon program for this state (pill absent entirely) · civic with the registration block above the election banner · no seeded rule for this state (block absent, not an empty shell) · deadline passed (collapses to the existing "No upcoming election") · unverified confidence (hollow mark + source) · section unavailable / error · multi-home user (address printed in the block header).

DO NOT: do not give the four layers a shared letter grade, a combined score, a star rating or a radar/spider chart — four incommensurable authorities have no shared ordinal scale, and a shape that encodes area reads as a report card on somebody's home. Do not render the free-kit action as another grey caption. Do not put the election banner above the registration block: a dated action outranks an informational fact.
