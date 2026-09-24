# Cells map detail (3-referral unlock, de-curated counts)
id: f9-nearby-cells-map · platforms: web/ios/android · isNew: False · frames: 8

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Cells map detail — 3-referral unlock, de-curated counts
PLATFORMS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
THIS IS: an EXTENSION of the existing designed screen "Nearby — cells map" (web NearbyCellsMap, iOS NearbyCellsMapCard, Android NearbyScreen). This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below: add the per-cell detail panel, its locked variant, and the split counts.
WHERE IT LIVES: Nearby tab → cells map → per-cell detail. Desktop: a right rail beside the map. Mobile web / iOS / Android: a bottom sheet at a medium detent with the map still visible above it.
HOW THE USER GETS HERE: Nearby tab, tap a cell; "Unlocked — see the map" on the Invite rewards card (tier 2); the cell link in the Block Founders panel.
THE ONE JOB: tap a cell and either read its real numbers or see exactly what would unlock them — without the map itself ever feeling withheld.

CONTENT (exact strings, densest realistic case):
Base: a muted street grid of east Clark County WA — SR-14, NE 192nd Ave, Lacamas Lake, the Camas paper mill. Overlay geohash-6 cells, which are RECTANGLES roughly 1.2 km east–west by 0.6 km north–south: draw a 6×4 grid of wide rectangles, never hexagons. The user's own cell (Prune Hill · c21hgu, from 2417 NW Lacamas Dr, Camas WA 98607) carries a 2px primary ring.
Unlocked panel, "Prune Hill · c21hgu": "Verified homes 7" · "Founding slots 2 of 5 open · closes Sep 22, 2026" · "Neighbor posts, last 30 days 14" · caption "3 Pantopus curator posts not counted" · "Last neighbor activity Tue, Sep 15".
Locked panel, same cell name and same shading: "Unlock with 3 neighbors who join", a "1 of 3" row reading "Dana R. joined Sep 9, 2026", and a share control "Copy your invite link · pantopus.com/join/ypw-4k2p".
Neighbouring cells carry real values in the unlocked frame: Grass Valley 4 homes / 9 posts · Fisher's Landing 11 / 31 · Dawson's Ridge 2 / 3 · Sifton 5 / 6 · Lacamas Shores 1 / 0 · Forest Home 0 / 0.

THE VISUALIZATION DECISION:
The base layer is free and never gates. Shade each cell on a 4-step ramp (primary.100 / 200 / 300 / 500) encoding posts-in-30-days buckets 0 / 1–5 / 6–15 / 16+, with a legend naming the buckets — that is the shape of activity and it stays visible at every tier. Only the per-cell NUMBERS gate. Inside the panel keep the two counts as two different marks: verified homes as a countable row of 7 filled dots (the real number is small, so let it be counted), posts as a numeral plus a 30-tick daily sparkline. Curator-origin posts appear on that sparkline as hollow ticks below the baseline, outside the total — the exclusion is drawn, not silent. One blended activity score would shrink overnight when curator rows stop counting and nobody could see why.
Degrade: a cell with no data shows its name, "No verified homes here yet", and nothing else — no zero dots, no empty five-segment meter.

STATES TO DRAW (one frame each): locked at 0 of 3 · locked at 1 of 3 · locked at 2 of 3 · unlocked · cell has no data · loading (map fully drawn, panel skeleton only) · error · offline showing cached counts with an "as of Sep 15" stamp.

DO NOT: do not blur, fog, pixelate or lock-icon the map itself. In a pilot block with a few dozen households a sparse map already looks empty; blurring it turns sparse into withheld, and the user spends 3 referrals to discover there was nothing behind the blur. Do not merge verified homes and posts into one number.
