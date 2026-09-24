# What neighbors see (privacy mirror, user-scoped)
id: f9-privacy-mirror · platforms: web/ios/android · isNew: False · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: What neighbors see (the privacy mirror)
PLATFORMS / VIEWPORTS: web 1440×900 and 390×844 · iOS 393×852 · Android 412×915
THIS IS: an EXTENSION of the existing designed Pantopus screen "What neighbors see" (web /app/homes/[id]/privacy, iOS PlacePrivacyMirrorView, Android PlacePrivacyMirrorScreen). This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below.

WHERE IT LIVES: Place tab → Place file → row "What neighbors see". Also reached from the Place dashboard privacy row, and as a one-line inline version inside the post composer's location picker in Nearby. Deep link /app/homes/:id/privacy keeps working; the screen is now USER-scoped, so it must also open for someone who has only saved an address and claimed no home.

THE ONE JOB: let any user — including one who has only bookmarked an address — see at scale exactly how much of their location a neighbor gets when they post, and check it instead of taking our word for it.

WHAT CHANGES: (1) a place selector in the header so the screen is no longer home-gated; (2) a THIRD row beside Address and Profile; (3) the same one-liner inline in the composer.

CONTENT (exact strings, this density):
- Header selector: "2914 NW Lacamas Dr, Camas, WA 98607 · Saved place · Only you", switchable to "1207 Daniels St, Vancouver, WA 98660 · Saved place · Only you" and "4408 NE 78th St, Vancouver, WA 98665 · Home · Your household"
- Row 1 Address — a neighbor sees: "Camas, WA" · control "Change"
- Row 2 Profile — a neighbor sees: "Dana W. · Joined Aug 2026" · control "Edit profile"
- Row 3 (new) Where your posts appear — map thumb, caption "Your post lands somewhere inside this circle. It is re-rolled every time you post.", scale bar "500 ft"
- Quoted verbatim beneath the map, drawn as a neighbor's feed-card header: “Nearby · Camas, WA · 2h”
- "Your public posts: 7" → link "Manage where your posts appear"
- Composer location picker inline line: "Neighbors see “Nearby · Camas, WA”, never your address."

THE VISUALIZATION DECISION: draw the jitter radius as a real ring over a real street grid, at scale — a described radius is an unfalsifiable claim, a drawn one is checkable. Map thumb full card width, 16:9, streets labelled (NW Lacamas Dr, NW 18th Ave, NW Sierra St), ring ≈150 m radius, filled at low opacity with a 1.5px stroke, and a printed scale bar directly under it so a reader can measure the ring against it. There is NO pin, NO house marker and NO dot at the centre — the centre is the thing being hidden. The neighbor's literal string sits immediately below the map, quoted, in the feed card's own type, not paraphrased. Degrade: if the map tile fails, keep the ring and the scale bar and render streets as plain vector lines from cached geometry; never fall back to prose describing a radius.

STATES TO DRAW (one frame each, 9 total):
1. Web desktop — T1 saved place, loaded, dense (this re-scope is the whole point)
2. Web mobile 390×844 — T1 saved place
3. iOS — T3 claimed home (header reads "Your household", not "Only you")
4. Android — T3 claimed home
5. Loading (web mobile) — map area reserves its final height, rows skeletoned
6. No public posts yet (iOS) — map and ring still drawn; count row reads "Your public posts: 0"
7. Offline / cached (Android) — cached ring, "Manage where your posts appear" disabled
8. Error (web mobile)
9. Post composer location picker with the inline one-liner (iOS sheet)

DO NOT: do not state the radius only in words; do not draw a pin, house icon or centre dot inside the ring; do not gate any of this behind a claimed home; do not invent a privacy score, shield badge, percentage or "you are protected" reassurance graphic — the ring plus the quoted string is the whole proof.
