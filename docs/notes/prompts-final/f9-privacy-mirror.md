# What neighbors see (user-scoped, with 'Where your posts appear')
id: f9-privacy-mirror · platforms: web/ios/android · isNew: False · artboards: 19

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: What neighbors see · f9-privacy-mirror

TYPE: EXTENSION of the existing designed screen "What neighbors see". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.
1. Add a place selector to the header, so the screen opens for anyone with a saved place, not only for someone with a claimed home.
2. Add a new row, "Where your posts appear", drawn with PublicPointMap.
3. Add a new row, "Hidden from neighbors".
4. Show a one-line version of the same promise inline in the Nearby post composer's location picker.
Keep the existing Address and Profile rows, their controls and their order.

ATTACH: "What neighbors see" as it looks today on web 1440, web 390, iOS and Android · the Place file showing its "What neighbors see" row · the privacy row on the existing Place-tab home overview screen (its internal name is "Place dashboard"; that name is internal only and never appears in the UI) · the Nearby post composer with its location picker open (iOS, web 390 and web 1440) · one Nearby feed card, because its header is quoted on this screen.

PLATFORMS & VIEWPORTS: Web 1440x900 (left sidebar, content column as in the screenshot; the composer is a centred panel) and 390x844 (bottom tab bar; the composer is a bottom sheet). iOS 393x852: a pushed screen; the composer is a sheet at the medium detent. Android 412x915: Material 3 top app bar; the composer is a bottom sheet.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → Place file → row "What neighbors see". People also arrive from:
- the privacy row on the Place-tab home overview screen;
- Nearby tab → new post → location picker. The picker shows only the one-liner; its link expands a small map inside the picker.
- deep links: /app/homes/:id/privacy (web) and pantopus://homes/:id/privacy (iOS, to be confirmed; see Notes) open with that home selected; Android gains this route (see Notes).
The previous screen hands over one place (a home or a saved place), and the selector opens on it. The screen hands off in one direction: "Manage where your posts appear" opens the Nearby composer with its location picker open (see INTERACTION). No journey in the flow spec passes through this screen, so it must make sense on its own. Back returns to wherever the person came from.

WHO AND WHEN: Mon 19 Oct 2026, 6:10 PM. Jordan Lee saved PLACE B on Sat 10 Oct and has not claimed it. He has no home on Pantopus. Before this change, the screen never opened for him. He has 7 public posts in Nearby, and before his next one he wants to check that neighbors can't tell which house is his. The second person is Maya Chen at HOME A. She checks the same promise for her household.

THE ONE JOB: Let anyone who posts, including someone with only a saved place, see exactly what a neighbor learns about their location, drawn to true scale so they can check it.

FIRST FIVE SECONDS: First the map's single pin labelled "What neighbors see", then the caption giving the distance, then the quoted card header a neighbor gets. The screen is proof, so it has no primary button. Each row keeps its one control on the same row. The most prominent control is "Manage where your posts appear".

CONTENT (fixture deltas only)
- Deltas: Jordan has 7 public posts and one place (PLACE B). In every Maya frame (2, 4, 16, 19), Maya has two places: HOME A and a saved PLACE B, so her header shows a chevron and her menu lists both. Neither person has set their own label for a place.
- Title: "What neighbors see".
- Header selector, collapsed: the person's own label for the place if they set one, otherwise the city, then the ScopeChip. Jordan: "Camas, WA" with ScopeChip "Saved place · Only you". Maya on HOME A: "Vancouver, WA" with ScopeChip "Your household". The collapsed header never shows a street name.
- "Show for" menu (open only): each option shows the place's label or city on line 1, its street label on line 2, and its ScopeChip. Maya's options: "Vancouver, WA" / "Larkspur Loop" / "Your household", and "Camas, WA" / "Birchfield Ct" / "Saved place · Only you". Street labels appear only here.
- Address row: "A neighbor sees on your posts: Camas, WA". HOME A: "A neighbor sees on your posts: Vancouver, WA", with the control "Change" (opens the existing home address screen). A saved place has no "Change" control, because the only address screen belongs to a claimed home; for Jordan the row ends with its value.
- Profile row: "A neighbor sees: Jordan L. · Joined Oct 2026", with "Edit profile". HOME A: "Maya C. · Joined Aug 2026".
- Where your posts appear, in this order:
  1. Change note: "Since Mon 12 Oct, neighbors get only this spot, never your exact location."
  2. PublicPointMap.
  3. Caption: "Neighbors see your posts at this spot, the same spot every time, about 0.3 mi from your address." HOME A: "about 0.4 mi".
  4. "Your post's header, as a neighbor sees it:" then the Nearby card header in the card's own type: "Jordan L. · Camas, WA · 2h". HOME A: "Maya C. · Vancouver, WA · 2h". If the attached Nearby card uses a different header format, copy that format exactly and record the difference on Notes.
  5. "Your public posts (all places): 7" and the link "Manage where your posts appear".
- Hidden from neighbors: saved place: "Your street address · This place on the map". HOME A: "Your street address · Your home on the map".
- Collapsed disclosure "How this spot is chosen", with three lines:
  - "We move your post's location by a fixed amount before anyone else sees it."
  - "Every post uses the same spot, so posting more doesn't narrow down where you live."
  - "It's the same spot on the Nearby feed, the map, saved posts and each post's page."
- Composer picker: the chosen-place row reads "Nearby · Camas, WA" (if the attached picker uses another format, copy it and record the difference on Notes). Under it: "Neighbors see this post at one spot about 0.3 mi from your address, never the address itself." then the link "See the spot".
- No posts yet: "Your public posts (all places): 0", with the caption "When you post, neighbors will see it at this spot, the same spot every time, about 0.3 mi from your address."
- Worst case: Jordan's own label "Mom's place near the lake" in the header (street label only in the menu), 6 places in the selector, "Your public posts (all places): 1,248", and "about 0.4 mi" (the largest offset the server allows).

LAYOUT & VISUALIZATION: Draw one column of the existing cards. Row order: Address, Profile, Where your posts appear, Hidden from neighbors. On 390 and iOS, keep the Address and Profile rows compact so the map sits above the fold. Each row has its label, then the "A neighbor sees" wording and the value in body type, then its control (if any) right-aligned on the same row. No house number appears anywhere on this screen, and no street name appears in the collapsed header, the rows or any message; street labels appear only inside the open "Show for" menu and as tile labels on the map.

The posts row uses PublicPointMap (privacy mirror variant):
- 16:9 map at full card width.
- Street labels come from the tile. PLACE B: NE 3rd Ave, NE Everett St, NE Lake Rd. HOME A: NE 28th St, NE 164th Ave, NE 23rd St. No street gets special styling.
- Exactly one pin, primary.700, labelled "What neighbors see" on a surface.base plate, near the map centre.
- The address is unmarked: no home icon, ring, box, halo or dot.
- Control row directly under the map: the scale bar on the left, then "−", "+" and four pan arrows on the right. The scale bar reads "0 · 0.1 · 0.2 · 0.3 mi" when the offset is 0.3 mi or less, and extends to "0 · 0.1 · 0.2 · 0.3 · 0.4 mi" when it is more (HOME A and the worst case), so the stated distance is always measurable on it. Each button is 44pt with 8pt gaps. At 390, iOS and Android, the scale bar takes its own line and the six buttons sit right-aligned on the line below. Only on web 1440 may the buttons overlay the map's bottom-right corner.
The pin is the spot a neighbor's Nearby map shows. The picture is the audience's view, not a diagram of the mechanism. The quoted header sits directly under the caption.
Fallbacks: if the tile fails, keep the pin, label, scale bar and controls, and draw the streets as plain labelled vector lines. Never replace the map with a paragraph.
Composer: use PublicPointMap (composer one-liner variant). "See the spot" expands the picker row in place into a static mini-map with the pin, its label and the scale bar. It has no drag, no zoom and no buttons. Do not open a second sheet.

INTERACTION, MOTION & HAPTICS
- The selector opens a menu: a pull-down on iOS, a dropdown on Android, a listbox popover on web. The title is "Show for". Each place shows its street label and ScopeChip.
- With one place (Jordan), the selector is a plain header with no chevron.
- The header ScopeChip is informational and not tappable here.
- Picking a place redraws the rows in place with a 200ms cross-fade. Show no skeleton if the data is cached.
- The map pans and zooms with the buttons. Drag and pinch are extras, never the only way.
- The disclosure expands in place and its chevron rotates over 150ms.
- "Manage where your posts appear" opens the Nearby composer over this screen with an empty draft and the location picker already open on the selected place: iOS sheet at the medium detent, Android bottom sheet, web 390 bottom sheet, web 1440 centred panel. Close discards nothing (the draft is empty) and returns here.
- "Change" (HOME A only) and "Edit profile" open their existing screens.
- Under Reduce Motion, every change is a cross-fade.
- No haptics beyond the system menu tick on iOS.

FOUNDATIONS COMPONENTS USED: PublicPointMap (privacy mirror variant; composer one-liner variant, static) · ScopeChip ("Saved place · Only you" / "Your household"; informational on this screen) · WarmingSkeleton (map box and row bars) · OfflineNotice with FreshnessLine (offline variant) · InlineErrorRow (provider unreachable variant).

ACCESSIBILITY
- Reading order: title → selector (place, then scope) → Address → Profile → change note → map → map controls → caption → quoted header → count → link → Hidden → disclosure.
- The map is one element. Spoken label for a saved place: "Map. Neighbors see your posts at one spot about 0.3 miles from your address, near NE 3rd Ave and NE Everett St. This place is not shown. Scale in tenths of a mile." For HOME A: "... about 0.4 miles from your address, near NE 28th St and NE 164th Ave. Your home is not shown. Scale in tenths of a mile."
- Map buttons: "Zoom in", "Zoom out", "Move map north", "Move map south", "Move map east", "Move map west".
- The quoted header is read as "A neighbor sees: Jordan L., Camas, Washington, 2 hours ago."
- The pin is identified by its shape and printed label, not by colour.
- Targets: 44pt on iOS, 48dp on Android, 44px on web.
- The caption and the Hidden row together are the text alternative to the map.
- At AX5, controls stack under their values and the selector label wraps.

COPY: every string above, plus:
- Offline: "You're offline · as of 5:52 PM". Under each disabled control: "Changing this needs a connection."
- Map failed: "We couldn't load where your posts appear · Retry".
- Screen failed: "We couldn't load what neighbors see · Retry".
- Stale deep link: "That home isn't on your account anymore. Showing your saved place in Camas, WA."

EDGE CASES
- Long labels wrap to two lines and never truncate. With 6 places, the menu scrolls. 1,248 shows with a comma.
- Loads under 1s show nothing. Cold loads show WarmingSkeleton at the final heights.
- Offline: "Change" (HOME A only), "Edit profile" and "Manage where your posts appear" are disabled, each with "Changing this needs a connection." The cached pin stays. Zoom and pan stay enabled within cached tiles; past the cache, the vector fallback is drawn.
- Smallest offset: the public spot is about 0.1 mi (1–2 blocks) from the address. The caption still states the true distance ("about 0.1 mi from your address"), never rounds up, and the map stays centred on the pin.
- A claimed home shows "Your household". A household member sees their own Profile row.
- A stale home link falls back to the most recently used place, with the stale-link line.
- Screen failure: the whole-screen InlineErrorRow replaces all rows; the header stays.
- Every frame is safe to screenshot: none shows a house number, none shows a street name in the header or rows, and none marks the address position.

INSTEAD OF
- Instead of a ring or box centred on the address, draw one pin at the public spot labelled "What neighbors see" — because any shape centred on the home gives it away in a screenshot.
- Instead of "re-rolled every time you post", write "the same spot every time" — because the server keeps one stable offset, and fresh offsets could be averaged to find the home.
- Instead of a 150 m ring with a "500 ft" bar, draw a scale bar in tenths of a mile that reaches the stated distance — because the real offset reaches about 0.4 mi.
- Instead of explaining the protection in prose, show the neighbor's literal header and pin with each control on its row — because audience views raised correct answers from 66% to 94% (Lipford 2008).
- Instead of a shield, score or "You're protected" graphic, draw the "Hidden from neighbors" row — because a checkable fact beats reassurance.
- Instead of any street name in the header, draw the place's own label or its city — because a street plus a pin and a distance narrows the home to a few houses in a shared screenshot.
- Instead of gating the screen on a claimed home, draw the selector — because saved-place users post from a bookmarked address.
- Instead of map controls floating over a 200pt map, draw a control row under it — because six buttons would cover the pin and the street names.

DONE WHEN
- Jordan, with only a saved place, can open the screen.
- He can point to where neighbors see his posts and measure the distance on the scale bar, at 0.1, 0.3 and 0.4 mi.
- No frame shows or implies where the home is, no frame shows a house number, and no collapsed header shows a street.
- The quoted header matches the Nearby card exactly.
- The header states "Saved place · Only you" or "Your household", and saved-place frames never say home, household or claim.
- "Manage where your posts appear" visibly lands in the composer with the picker open.
- Every map action has a button.
- "re-rolled" appears nowhere.

ARTBOARDS
1. f9-privacy-mirror · web-1440 · 01-saved-place-dense · light — Jordan, PLACE B, header "Camas, WA" with no chevron, all rows, Address row without "Change", 7 posts, disclosure collapsed.
2. f9-privacy-mirror · ios · 02-home-household · light — Maya, HOME A selected, header "Vancouver, WA" with chevron, "Your household", 0.4 mi with the scale bar to 0.4, Address row with "Change".
3. f9-privacy-mirror · web-390 · 03-saved-place-only · light — Jordan at 390, header "Camas, WA", no chevron, map above the fold, control row in two lines.
4. f9-privacy-mirror · android · 04-selector-open · light — Maya's "Show for" menu: two options, each with city, street label and ScopeChip.
5. f9-privacy-mirror · ios · 05-how-spot-chosen-open · light — Jordan, disclosure expanded.
6. f9-privacy-mirror · ios · 06-composer-picker · light — Jordan's composer sheet at the medium detent, opened from "Manage where your posts appear": empty draft, picker open on "Nearby · Camas, WA", the one-liner, the static mini-map expanded via "See the spot", Close visible.
7. f9-privacy-mirror · web-1440 · 07-composer-panel · light — the same composer as a centred panel over the mirror.
8. f9-privacy-mirror · ios · 08-no-public-posts · light — Jordan before his first post: count 0, future-tense caption, pin still drawn.
9. f9-privacy-mirror · ios · 09-small-offset · light — PLACE B with the public spot about 0.1 mi away, map centred on the pin.
10. f9-privacy-mirror · web-390 · 10-loading · light — WarmingSkeleton holding the 16:9 map box and the row bars.
11. f9-privacy-mirror · web-390 · 11-map-error · light — the map slot shows InlineErrorRow; Address and Profile rows stay. Inset: the whole-screen failure, header kept, one InlineErrorRow in place of all rows.
12. f9-privacy-mirror · android · 12-offline-cached · light — Jordan: cached pin, FreshnessLine, "Edit profile" and "Manage where your posts appear" disabled with reasons, zoom and pan enabled.
13. f9-privacy-mirror · web-390 · 13-tile-failed-vector · light — vector streets, same pin, scale bar and controls.
14. f9-privacy-mirror · web-390 · 14-stale-link · light — Jordan opens an old link to a home id that isn't on his account; stale-link line; header "Camas, WA", no chevron.
15. f9-privacy-mirror · web-1440 · 15-worst-case · light — header "Mom's place near the lake", 6 places (menu open, street labels only in the menu), 1,248 posts, 0.4 mi.
16. f9-privacy-mirror · ios · 16-ax5 · light — frame 2 at AX5: controls stacked, selector wrapped.
17. f9-privacy-mirror · web-1440 · 17-greyscale · light — frame 1 in greyscale.
18. f9-privacy-mirror · web-1440 · 18-saved-place-dense · dark — dark twin of frame 1.
19. f9-privacy-mirror · ios · 19-home-household · dark — dark twin of frame 2.
20. f9-privacy-mirror · Notes — record:
- Invented strings: Jordan's 7 posts; Maya's saved PLACE B (all Maya frames); "Joined Oct 2026"; "Joined Aug 2026"; Mon 12 Oct; the street names; 0.1/0.3/0.4 mi; 5:52 PM; "Mom's place near the lake"; the 6-place account; "Show for"; "See the spot"; "Nearby · Camas, WA"; "(all places)"; "A neighbor sees on your posts"; the stale-link line.
- Header rule: the collapsed header shows only the person's own label or the city; the open menu, not the header, carries street labels.
- Saved-place wording: "This place on the map" and "This place is not shown" replace "home" on saved-place frames; "Your home" is used for HOME A only.
- The saved-place Address row has no "Change" control. Open question: what should the Address row's "Change" open for a saved place?
- Omitted states, if any beyond those drawn.
- Why the ScopeChip is static here: scope changes only through "Claim this address" on the Place file, and the chip sits inside the selector's own target. This departs from the research rule that every scope chip opens its control.
- The layered-label grid from research (what is stored, who sees it, how to change it) was considered and replaced by the audience-view rows.
- Phase 2 (F10): a "What we store" row linking to Mail snaps privacy will join this screen; not drawn now.
- Any difference from the attached card header or picker format.
- Engineering: the mirror is built from the server's own output for a pretend neighbor and never uses a neighbor-scoped sign-in. Distance and geometry come from the server's stable offset (up to about ±0.005° each way, a box of about 1.1 × 0.8 km). Confirm the offset is keyed to the place's coordinate, not to each post; if it is per post, "the same spot every time" and "Every post uses the same spot" are false and must not ship. A contract test fails if the mirror's offset constant or geometry differs from the server's location-privacy module. Android needs a route for pantopus://homes/:id/privacy. Confirm that iOS routes pantopus://homes/:id/privacy.
- Open questions: Is the post count per place or per account? (Labelled "(all places)" until decided; relabel if per place.) Is there a standing location setting, or only a per-post picker? If only per-post, rename the link "Choose where your next post appears". Does the composer ever use device location? What route or deep link opens the mirror for a saved place (e.g. /app/places/:savedPlaceId/privacy)? Should the server enforce a minimum distance for the public spot? Until that is decided, the caption shows the real distance and never rounds up; what should it say under 0.05 mi?

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: artboards 7-12, then wait for "continue". Turn 3: artboards 13-18, then wait for "continue". Turn 4: artboards 19-20.
