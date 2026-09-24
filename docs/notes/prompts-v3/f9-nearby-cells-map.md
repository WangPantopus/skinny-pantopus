# Cells map detail (3-join unlock, split counts)
id: f9-nearby-cells-map · platforms: web/ios/android · isNew: False · artboards: 18

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Cells map detail · f9-nearby-cells-map

TYPE: EXTENSION of the existing designed screen "Nearby — cells map". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed:
(1) Print the activity level inside every area.
(2) Add a detail panel per area, with a locked and an unlocked version.
(3) Show homes and posts as two separate rows.
(4) Add zoom, pan and "Show as a list" controls.
(5) Draw areas with no post data as a distinct state.
(6) The area fill changes from verified-home density to neighbor posts in the last 30 days. The legend changes from today's home labels ("No verified homes yet" · "Forming (under 10)" · "A few (10–24)" · "Growing (25+)") to the post levels. Those home labels are not removed: they move into the panel's homes row and the list view, where they stay free for everyone.
(7) The grid stays as it is today: 5 columns by 5 rows, 25 areas. Do not change its shape.

ATTACH: the current Nearby cells map on web 1440, web 390, iOS and Android, and the Foundations board. Attach nothing else. The two cards above the map on the Nearby tab, Invite rewards and Block Founders, are new and are drawn in their own projects. If those projects are finished, attach their frame 01 exports and reuse them as-is. If not, draw each as a collapsed grey outline labelled with its name. Never invent their contents here.

PLATFORMS & VIEWPORTS:
- Web 1440x900 with the left sidebar. Nearby uses the content width in the attached Nearby screenshot. Invite rewards and Block Founders sit in a 720-wide column. The cells map block alone spans the full content width: the map is at least 640 wide, with a 360 rail on its right for the panel. If the content width is under 1000, the panel sits under the map instead.
- Web 390x844 with the bottom tab bar: the panel is a non-modal bottom sheet.
- iOS 393x852: a non-modal sheet at the medium detent, with the map visible above.
- Android 412x915: a standard (non-modal) Material 3 bottom sheet, with the map visible above.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Nearby tab, the third block, below Invite rewards and Block Founders. The map centres on the address in the Nearby location row, which carries its ScopeChip ("Your household" for HOME A). Entry points:
(a) Nearby tab: tap an area or a list row.
(b) Row B on Invite rewards, whose action reads "See the map". It scrolls to the map, opens the panel for the viewer's own area, fades a highlight once and moves accessibility focus to the panel title.
(c) "See Fircrest on the map" in Block Founders: the same landing.
(d) Deep link /app/nearby?section=map on web, and the same path in the apps: the same landing.
Nothing is handed over except which area to open. No push and no widget ever lead here. No journey in the flows spec passes through this screen.

WHO AND WHEN: Maya Chen, owner at HOME A, address verified, Mon 19 Oct 2026 at 6:10 PM. Three neighbors have joined with her link, so the numbers are unlocked. She taps her own area, Fircrest, to see whether anyone around her posts. The locked frames show the same Maya on earlier days: Fri 9 Oct (no one joined), Sat 10 Oct (Dana joined) and Mon 12 Oct (Dana and Luis M. joined). Frame 13 shows Jordan Lee at PLACE B.

THE ONE JOB: Tap an area and either read its real numbers or see exactly what would unlock them, without the map ever feeling held back.

FIRST FIVE SECONDS: First, the grid of areas, each with its activity level printed inside and her own area outlined. Second, the panel title "Fircrest · Your area". Third, the two separate rows: homes, then posts. When the panel is unlocked, reading is the job and there is no primary button. In the locked panel the one primary action is "Copy link".

CONTENT: Use the house style FIXTURES. The deltas for this screen follow; list every one of them on the Notes artboard.
- Base map: draw only the ground the 5x5 grid covers, about 2.7 mi east–west by 1.9 mi north–south, centred on HOME A. Draw only streets inside that box: SR-14 along the south edge, and NE 164th Ave and NE 192nd Ave running north–south. Leave out I-205, Lacamas Lake and the paper mill. Add a scale bar in tenths of a mile that matches the areas: one area is about 0.53 mi wide and 0.38 mi tall. Draw no home marker.
- Areas: 25 rectangles, each about 0.86 km east–west by 0.61 km north–south (roughly 1.4:1, wider than tall). Never call them cells or geohashes in the UI; the UI word is "area". Area names are mock-up labels placed on this grid, not real neighbourhood boundaries. The viewer's area is Fircrest, which contains HOME A, in the centre.
- Homes are shown by the server's floor. An exact count appears only when an area has 10 or more homes with a verified address, or for the viewer's own area when the viewer's address is verified. Below that, print the floored words: "Forming (under 10)", or "No homes with a verified address here yet" for zero.
- Named areas (posts in the last 30 days · homes as shown to Maya):
  - Fircrest: 14 posts, plus 3 posts from Pantopus that are not counted · 3 (her own area, she is verified).
  - Fisher's Landing: 31 · 11.
  - Grass Valley: 9 · Forming (under 10).
  - Cedar Knoll: 6 · Forming (under 10).
  - Dawson's Ridge: 3 · Forming (under 10).
  - Hearthwood: 0 · Forming (under 10). This is the floored state for a small area.
  - Forest Home: No data (the posts lookup returned nothing for this area, which is different from 0 posts) · No homes with a verified address here yet.
- The other 18 areas: name each by its nearest street, for example "Near NE 172nd Ave". Give each a level, mostly "0" or "1–5", and 0–2 homes, shown as the floored words. List every name and value on Notes.
- Founding windows: Fircrest is open with 2 of 5 open and closes Sun 25 Oct; it opened Sun 4 Oct, so 15 of 21 days have passed. These values must match Block Founders exactly. Grass Valley is open with 1 of 5 open and closes Thu 29 Oct. Hearthwood is open with 4 of 5 open and closes Sat 7 Nov. Fisher's Landing and Dawson's Ridge are closed. Cedar Knoll is full (no open slots). Forest Home has no window. A closed or full window gets no SlotMeter row.
- Last neighbor post in Fircrest: Thu 15 Oct.
- Joins: "Dana · joined Sat 10 Oct", "Luis M. · joined Mon 12 Oct" and "Hannah K. · joined Tue 13 Oct". Hannah's join unlocked the numbers.
- Link: pantopus.com/join/maya-4k2p. Jordan's link: pantopus.com/join/jordan-9m2c.
- Worst case: Fisher's Landing, the busiest area, has 11 homes and 31 posts. Show the numeral only and draw no house glyphs above 10.

LAYOUT & VISUALIZATION:
- Area levels, light mode. Fill each area on the ramp primary.100 / 200 / 300 / 500 for neighbor posts in the last 30 days: 0 / 1–5 / 6–15 / 16+. Print the level ("0", "1–5", "6–15", "16+") inside every area in text.primary, label 13/18. The printed label carries the meaning and the fill only supports it. Draw area edges as 1.5px lines in text.secondary ink. Mark the viewer's area with a 2px primary.700 outline plus the printed tag "Your area".
- Area levels, dark mode. 0 = dark surface.raised, 1–5 = primary.900, 6–15 = primary.800, 16+ = primary.700. Print labels in dark text.primary. Area edges use dark text.secondary. The Fircrest outline uses the dark focus/link token. Check every label at 4.5:1 or better.
- No-data area (Forest Home). Draw it on surface.base with no fill and a dashed text.secondary edge, and print "No data" in place of a level. It must never look like "0".
- Legend under the map: "Neighbor posts in the last 30 days: No data · 0 · 1–5 · 6–15 · 16+" and "Posts from Pantopus aren't counted."
- The free layer is the grid, the post levels and the floored home words. It shows at every tier. Only the exact numbers in the panel are locked.
- Phone zoom (iOS, Android, web 390). The map opens zoomed on Fircrest with about 3.5 columns visible, so every area is at least 96x68pt. Zoom out stops at the level where areas are still 44pt tall; below that, "Show as a list" is the way in. The map is about 200pt tall.
- Map controls on phones (frames 02, 04, 05, 11, 12, 13 and 14). Put them in two rows under the map, never over it. Row 1: "Zoom out" · "Zoom in" · "Center on your area". Row 2: the four pan arrows "Move left" · "Move up" · "Move down" · "Move right". Every button is 44pt (48dp on Android), with 8pt gaps.
- Map controls on web 1440: "Zoom out", "Zoom in", the four pan arrows and "Center on your area" stay bottom right over the map, all 44px.
- Above the map on every platform: a "Show as a list" / "Show map" toggle.
- List view. Rows read name · level · homes · lock state. Homes read "3 with a verified address" for an exact count, or the floored words. Locked rows print "Numbers locked". The Forest Home row reads "Forest Home · No data · No homes with a verified address here yet".
- Unlocked panel, top to bottom:
  1. The title "Fircrest · Your area" and the level "6–15".
  2. "Homes with a verified address": the numeral 3 plus a row of 3 small house glyphs, so a small number can be counted. Under it, the caption "Counts cover the whole area, never a single home." In an area below the floor, this row prints the floored words only, with no glyphs and no caption.
  3. The SlotMeter in its Block Founders panel variant.
  4. "Neighbor posts, last 30 days": the numeral 14 plus a 30-day sparkline of daily counts, drawn as bars above a baseline in primary.600. Draw posts from Pantopus as short dashes below the baseline, outside the total, captioned "3 posts from Pantopus not counted". Add a "Show days as a list" disclosure.
  5. "Last neighbor post · 4 days ago · Thu 15 Oct".
  6. A FreshnessLine: "Updated 2m ago".
- Locked panel, top to bottom: the same title and level; the homes row with the floored words only ("Forming (under 10)"); the unlock sentence for that frame (see COPY); "Activity levels stay visible for everyone." directly under it; a row for each neighbor who has joined; the remaining count; the link row with "Copy link" (primary) and "Share link"; and the caption "People who use your link see that it helps you."
- No-data panel (Forest Home): its name, "We don't have post data for this area yet." and "No homes with a verified address here yet". Nothing else.
- On slow or missing tiles, draw the vector fallback. The map extent never widens by itself.

INTERACTION, MOTION & HAPTICS:
- Tapping an area or a list row opens its panel. The whole area is the target, never its label.
- On phones, tapping an area first scrolls Nearby so the map sits under the top bar, then opens the panel as a non-modal sheet: undimmed at the medium detent on iOS, a standard bottom sheet on Android. Areas above it stay tappable. Opening another area replaces the panel content; sheets never stack.
- VoiceOver and TalkBack focus moves to the panel title. "Done" returns focus to the tapped area. The sheet also closes with Back or Escape.
- Pinch and drag also work, but the buttons do everything they do.
- The sheet opens in 250ms. On web the rail content cross-fades. Zoom animates in 200ms. Under Reduce Motion, use cross-fades and instant zoom steps, with no shimmer.
- "Copy link" shows "Link copied" as a status message and gives no haptic. "Share link" opens the system share sheet.
- A deep-link landing scrolls once, fades a highlight on the panel title and moves accessibility focus there.

FOUNDATIONS COMPONENTS USED:
- PublicPointMap, cells map variant: rectangles, a printed level in each, zoom buttons and the list alternative. This surface labels the list toggle "Show as a list" instead of "List cells"; record that label change on Notes.
- ScopeChip, in the Nearby location row: "Your household" for Maya, "Saved place · Only you" for Jordan.
- SlotMeter, Block Founders panel variant. Omit it entirely when the window is closed or full, or when the lookup failed.
- WarmingSkeleton, panel variant, never on the Founding slots row.
- FreshnessLine, OfflineNotice and InlineErrorRow.
- TextActionRow for "Share link", including its copied state.

ACCESSIBILITY:
- Reading order: location row with ScopeChip, map summary, list toggle, areas, map controls, panel title, homes, Founding slots, posts, last post, freshness.
- Map summary: "Map of 25 areas around your address. Your area, Fircrest, has 6 to 15 neighbor posts in 30 days. Busiest: Fisher's Landing, 16 or more."
- Each area: "Fircrest, your area, 6 to 15 posts in 30 days, numbers unlocked, button." A no-data area: "Forest Home, no post data, button."
- Homes row: "3 homes with a verified address in Fircrest." A floored row: "Grass Valley: fewer than 10 homes with a verified address."
- Sparkline: "14 neighbor posts in 30 days. 3 posts from Pantopus not counted." Its list of days is the text alternative. On iOS, build it with Swift Charts or an audio-graph chart descriptor.
- SlotMeter: "Founding Neighbor slots: 2 of 5 open, closes Sunday October 25."
- Map controls stay visible while VoiceOver or TalkBack is on.
- Labels inside map areas cap at 17pt. At AX5, the list view and the panel carry the full-size text.
- Targets are 44pt on iOS, 48dp on Android with 8dp gaps, and 44px on web.
- Meaning never depends on colour: printed levels, a dashed edge plus "No data", a labelled outline, bars versus dashes.

COPY: "Your area" · "Your saved place" · "Show as a list" · "Show map" · "Center on your area" · "Zoom in" · "Zoom out" · "Move left" · "Move up" · "Move down" · "Move right" · "No data" · "We don't have post data for this area yet." · "Homes with a verified address" · "3 with a verified address" · "Forming (under 10)" · "No homes with a verified address here yet" · "Counts cover the whole area, never a single home." · "Neighbor posts, last 30 days" · "3 posts from Pantopus not counted" · "Posts from Pantopus aren't counted." · "Show days as a list" · "Last neighbor post · 4 days ago · Thu 15 Oct" · "Numbers locked" · "Activity levels stay visible for everyone." · "Dana · joined Sat 10 Oct" · "Luis M. · joined Mon 12 Oct" · "2 more neighbors who join" · "1 more neighbor who joins" · "Copy link" · "Link copied" · "Share link" · "People who use your link see that it helps you." · "We couldn't load the numbers for Fircrest. Retry" · "You're offline · as of 7:04 AM" · "Sharing needs a connection." · "Updated 2m ago" · "Done".
- Frames 03 and 13 (no joins) show only: "No one has joined with your link yet. 3 neighbors who join unlock these numbers."
- Frames 04 and 05 (one or two joins) show only: "Numbers unlock when 3 neighbors join with your link."

EDGE CASES:
- Areas over 10 homes show the numeral only, with no glyphs.
- Areas under 10 homes, other than the viewer's own verified area, never show a number, even when unlocked.
- A two-line area name, for example "Near NE 172nd Ave" at AX5, wraps in the list and the panel.
- Zero joins, one join and two joins each get their own frame.
- An area whose window is closed or full has no SlotMeter row and no message.
- Slow network: the map draws first. The panel skeleton covers the title, homes, posts and last-post rows only. Draw no skeleton for the Founding slots row; it appears only after a successful lookup.
- Offline: cached counts show with "You're offline · as of 7:04 AM". "Copy link" stays enabled. "Share link" is disabled, with "Sharing needs a connection." under it.
- Error: the map stays; the panel shows the InlineErrorRow.
- A viewer with no address gets no "Your area" outline.
- Jordan at PLACE B (saved place only, no joins): the map centres on the saved place. Her area is "Near NE Birchfield Ct", level "1–5", and its tag reads "Your saved place". The location row ScopeChip reads "Saved place · Only you". Numbers unlock the same way, because joins belong to the account. Her address is not verified, so her own area's homes row always shows the floored words.
- Sam Ortega (household member, address not verified) sees what Maya sees at his own join count, except that Fircrest's homes row shows the floored words.

INSTEAD OF:
- Instead of a blurred, fogged or padlocked map for locked viewers, draw the full map with printed levels and lock only the panel's numbers — because a sparse pilot map already looks empty, and a blur turns sparse into withheld, so someone would spend 3 joins to find nothing behind it.
- Instead of an exact home count in every area, print "Forming (under 10)" below 10 unless it is the verified viewer's own area — because a small count can single out a neighbour's home.
- Instead of one blended activity score, draw homes (glyphs plus numeral) and posts (numeral plus sparkline) as two rows — because a blended number would shrink overnight, with no visible reason, once Pantopus posts stop counting.
- Instead of dropping Pantopus posts silently, draw them as dashes below the baseline with their count — because the exclusion must be visible.
- Instead of a lightness-only ramp, print the level in every area — because adjacent ramp steps are only 1.16 to 1.66:1.
- Instead of "0" or a pale fill for an area with no post data, draw a dashed, unfilled area printing "No data" — because "not on record" must stay distinct from the lowest value.
- Instead of hexagons, 2:1 strips or a new grid shape, draw 25 rectangles at about 1.4:1 in the existing 5x5 grid — because that is what the server sends at this latitude.
- Instead of "1 of 3", a progress bar, pinch-only zoom or controls floating over a small phone map, draw who joined plus "2 more neighbors who join", and a two-row control block under the map plus a list view — because completion fractions are banned, nothing may depend on a gesture, and every area must stay a 44pt target.

DONE WHEN:
- Within five seconds, a locked viewer sees where the activity is and knows that 3 joins unlock the numbers and that "Copy link" is how.
- Homes and posts are never merged, and the Pantopus exclusion is visible.
- No area other than the verified viewer's own shows a home count under 10.
- "No data" never looks like "0".
- The SlotMeter matches Block Founders (2 of 5 open, closes Sun 25 Oct) and is absent when the window is closed or full, or the lookup failed.
- "See the map" on Invite rewards lands on an open Fircrest panel with focus on its title. The reward has a real destination.
- The scale bar agrees with the areas and the streets drawn.
- Every phone area is at least 44pt tall and no control covers the map.
- Every frame reads correctly in greyscale and in dark mode, and works with buttons alone.

ARTBOARDS:
1. f9-nearby-cells-map · web-1440 · 01-unlocked-your-area · light — the dense default: full-width 5x5 map with printed levels, Forest Home dashed "No data", Fircrest outlined, unlocked rail on the right, controls bottom right.
2. f9-nearby-cells-map · ios · 02-unlocked-sheet · light — zoomed on Fircrest, two control rows under the map, non-modal medium-detent sheet; arrived from "See the map": a one-time highlight on the panel title and a visible focus ring.
3. f9-nearby-cells-map · web-1440 · 03-locked-none-joined · light — Fri 9 Oct: full map, locked rail, floored homes row, only the no-joins sentence.
4. f9-nearby-cells-map · ios · 04-locked-one-joined · light — Sat 10 Oct: Dana's row, "2 more neighbors who join", link row.
5. f9-nearby-cells-map · android · 05-locked-two-joined · light — Mon 12 Oct: two rows, "1 more neighbor who joins".
6. f9-nearby-cells-map · ios · 06-list-view · light — "Show as a list": name, level, homes (exact or floored), "Forest Home · No data".
7. f9-nearby-cells-map · web-390 · 07-no-data-area · light — the Forest Home panel.
8. f9-nearby-cells-map · web-390 · 08-loading · light — map drawn; panel skeleton on title, homes, posts and last post; no Founding slots row.
9. f9-nearby-cells-map · android · 09-error · light — map kept, InlineErrorRow in the panel.
10. f9-nearby-cells-map · ios · 10-offline-cached · light — cached counts "as of 7:04 AM", Copy link enabled, Share link disabled with its reason.
11. f9-nearby-cells-map · android · 11-unlocked-sheet · light — Grass Valley open in a standard bottom sheet: floored homes row, SlotMeter 1 of 5 open, two control rows under the map.
12. f9-nearby-cells-map · web-390 · 12-unlocked-sheet · light — the mobile web sheet on Fircrest, two control rows under the map.
13. f9-nearby-cells-map · web-390 · 13-saved-place-viewer · light — Jordan: map centred on PLACE B, "Your saved place" tag, ScopeChip "Saved place · Only you", locked panel with floored homes row.
14. f9-nearby-cells-map · ios · 14-ax5-unlocked · light — map labels capped at 17pt, list toggle visible, a scrolling sheet with rows stacked and glyphs wrapping.
15. f9-nearby-cells-map · web-1440 · 15-greyscale · light — frame 01 in greyscale.
16. f9-nearby-cells-map · web-1440 · 01-unlocked-your-area · dark — the dark twin of 01, on the dark ramp.
17. f9-nearby-cells-map · ios · 04-locked-one-joined · dark — the dark twin of 04.
18. Notes — list:
- Every invented string: area names (mock-up labels, not real boundaries) and all 25 values, the windows, both links, the join names and dates, the route /app/nearby?section=map, the base-map streets and extent.
- The "Show as a list" label change for the PublicPointMap cells variant.
- Server dependencies: a new per-area posts level from the server's cells data; the change of fill from home density to posts; home words moved to the panel and list.
- "3 posts from Pantopus not counted" and "Posts from Pantopus aren't counted." ship only once Pantopus-authored posts are actually excluded from every neighbor count.
- "No data" means the posts lookup returned nothing, distinct from 0 posts. The home row wording "No homes with a verified address here yet" differs from today's server label "No verified homes yet"; pick one.
- "Area" here and "block" in Block Founders ("Your block · Fircrest") name the same unit; which word to use is open.
- Assumptions: the unlock needs 3 neighbors joining, per the spec; Jordan and Sam variants as drawn; Jordan's panel uses the word "homes" about the area, not her place.
- Open questions: (a) The server floors home counts under 10. Should the referral unlock lower that floor? Decide before build. (b) A SlotMeter on another area reveals up to 5 taken slots, a count under 10; confirm that is acceptable. (c) Are post counts per area safe to show exactly?
- Omitted states.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: artboards 7-12, then wait for "continue". Turn 3: artboards 13-18.
