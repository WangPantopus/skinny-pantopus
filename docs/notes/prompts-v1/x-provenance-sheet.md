# Where this comes from (provenance + "This isn't right")
id: x-provenance-sheet · platforms: web/ios/android · isNew: True · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: "Where this comes from" — the provenance + "This isn't right" sheet.
THIS IS A NEW SHEET. Design it FIRST: every other screen in this pack renders the marks defined here, so this sheet defines the encoding the whole product reuses.
PLATFORMS / VIEWPORTS: Web 1440×900 desktop (centred modal, 560px wide) and 390×844 mobile web (bottom half-sheet); iOS 393×852 (.sheet, medium detent); Android 412×915 (ModalBottomSheet).
WHERE IT LIVES IN THE IA: no tab of its own. It opens on top of whatever the user was reading in Place, Today or Nearby, and dismisses back to it.
HOW THE USER REACHES IT: by tapping a data mark — a dot in Today's 14-day strip, a calendar row, the marker on the air-quality band, a row of a Nearby compare scale strip, the provenance block on a bill (phase 2), or "Not my schedule" on the pickup card.
THE ONE JOB: answer "where did this fact come from, how sure are we, and how do I tell you it's wrong" — so provenance is a mark everywhere and prose in exactly one place.

CONTENT — draw these four real payloads:
1. FILLED (official/confirmed): "Recycling — every other Tuesday · next Tue 22 Sep 2026". Authority "City of Camas Public Works". "Read 3 Sep 2026". Confidence: "Official — published by the city." Source row: "cityofcamas.us · Garbage & recycling" with an external-link glyph.
2. HOLLOW (on record, unconfirmed): "Trash day — Tuesday" at 6519 NE 51st St, Vancouver WA 98661. Authority "Clark County solid-waste service map". "Read 12 Aug 2026". Confidence: "On record, not yet confirmed."
3. FILLED-WITH-TICK (you entered it): "Lease ends — 31 Mar 2027". Authority "You". "Added 14 Sep 2026".
4. No source_url: "Air quality 42 — Good · PM2.5" with its six EPA bands. Authority "AirNow, observed 8:00am, 16 Sep 2026". The source line renders as a flat caption, "No public page for this reading" — never a dead tap target.
Foot of every frame: a quiet text button "This isn't right" → two options, "The date is wrong" and "That's not my schedule" → "Thanks — we'll check it."

THE VISUALIZATION DECISION: the top of the sheet IS the mark, drawn large (56px), in the three shapes used everywhere in Pantopus — FILLED = official or confirmed, HOLLOW = on record but unconfirmed, FILLED-WITH-TICK = you entered it. Beneath it a one-line legend showing all three with the current one emphasised; then authority as a caption, observed/updated time, the confidence sentence in body text, and the source as a single row. Include one specimen frame proving the three shapes survive every size they must live at: an 8px dot inside a 14-day strip cell, 16px beside a calendar row, a monochrome widget glyph, and on the OG share card.

WHY IT IS SHAPED THIS WAY (do not optimise this away): "unverified" is currently expressed four different ways across the product — a row suffix string, a push parenthetical, a widget glyph, and nothing at all on the share card. A word repeated on every row becomes boilerplate exactly where the pilot scores honesty; a shape repeated per mark does not. Push copy is the only exception — there the caveat rides the notification title, never the body tail where truncation eats it.

STATES TO DRAW, each its own frame: (1) official/confirmed, (2) on record / unconfirmed, (3) you entered it, (4) no source_url, (5) reason picker open, (6) report submitted, (7) report failed with retry, (8) offline — read-only from cache, report control disabled with the reason stated, (9) the mark specimen sheet.

DO NOT: do not print the word "Unverified" as a text suffix anywhere on this sheet; do not draw a confidence percentage, star rating, bar or meter — the shape carries confidence, not a number; do not style "This isn't right" as a red destructive button or put it behind a confirm dialog; do not make the source row tappable when there is no URL.
