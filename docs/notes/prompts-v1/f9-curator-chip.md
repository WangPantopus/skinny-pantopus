# Pantopus curator chip + "Why am I seeing this?"
id: f9-curator-chip · platforms: web/ios/android · isNew: False · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Feed post card and post detail — curator variant
PLATFORMS / VIEWPORTS: web 1440×900 and 390×844 · iOS 393×852 · Android 412×915
THIS IS: an EXTENSION of the existing designed Pantopus feed post card and post detail, plus the Pulse card and map card variants that share the same data but not the component. These already exist and are already designed in the Pantopus design system — open them, keep everything, and change only what is listed below.

WHERE IT LIVES: Nearby tab → feed (card) and → post detail. Also the Pulse card and the map card. Entry: scrolling the Nearby feed; tapping a Pulse card; post detail overflow menu.

THE ONE JOB: let a reader tell at a glance that a post came from Pantopus rather than from a neighbor, and understand exactly what they would be muting.

CONTENT (exact strings, this density — draw a real feed, not one card in isolation):
- Curator post body: "Clark Public Utilities is reporting 412 homes out along NW Parker St after last night's wind. Current restoration estimate is 4:30 PM today." · posted Nov 12, 2026 · 2h
- Chip: "Pantopus curator" · under the body: "Source: Clark Public Utilities"
- Overflow: Report · Mute Pantopus posts · Why am I seeing this?
- "Why am I seeing this?" expands IN PLACE to four short lines: "Pantopus posted this, not a neighbor." / "It came from Clark Public Utilities' outage feed." / "Nobody on your block wrote it or picked it for you." / "It doesn't count as neighborhood activity in Nearby." — plus a toggle row "Show Pantopus posts in Nearby" (on)
- Neighbor post above it for contrast: "Marcus R. · NE 78th St · 4h — Anyone else lose power around Parker? Ours came back at 11." with avatar and 6 replies
- System post below: "Recycling moves to Friday this week for the Nov 26 holiday."

THE VISUALIZATION DECISION: the curator row does not present an avatar-plus-name shape AT ALL. The chip REPLACES the whole identity block — no avatar circle, no initials disc, no reserved 40px slot, no empty space where a face would be. Chip = pill radius, primary.50 fill, primary.700 label, small mark glyph, sitting at the byline baseline but reading as a label, not a person. "Source: {publisher}" is a caption line under the body, distinct from the chip so provenance and identity are two different facts. The explainer expands inline under the chip — four lines pushing the body down with a disclosure chevron — because four lines do not deserve a modal, and a sheet would hide the post the explanation is about. Draw the three card kinds stacked in one scroll so the curator card can be compared against a real neighbor byline in the same frame.

STATES TO DRAW (one frame each, 10 total):
1. Web desktop Nearby feed — neighbor + curator + system cards stacked
2. Web mobile feed — same three
3. iOS — curator card collapsed
4. iOS — "Why am I seeing this?" expanded inline with the mute toggle
5. Android — muted confirmation, feed re-filtering behind it
6. Web post detail with the overflow menu open
7. origin missing on a cached row — NO chip, no byline, no placeholder identity of any kind
8. Mute write failure
9. Reported
10. Pulse card and map card curator variants, side by side in one frame

UX REASONING TO KEEP: "curator" is internal vocabulary, so "keep report and mute available" assumes a reader who already knows what they are muting — the explainer is what makes mute meaningful. Decode safety matters more than the chip: adding origin to three client types means cached posts arrive without it, so the DEFAULT when origin is missing is no chip.

DO NOT: do not give the curator an avatar, initials circle, logo disc or anything that reads as a face; do not write "Pantopus" in the byline slot where a neighbor's name goes; do not open a sheet or modal for the four explainer lines; do not render a chip when origin is missing; do not add media loading skeletons that reserve avatar space.
