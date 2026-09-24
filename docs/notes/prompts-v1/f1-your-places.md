# Your places (and which one Today uses)
id: f1-your-places · platforms: web/ios/android · isNew: False · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Your places (and which one Today uses)
THIS IS AN EXTENSION of the existing designed screen "Saved places" — this already exists and is already designed in the Pantopus design system: open it, keep everything, and change only what is listed below.
PLATFORMS: web 1440x900 desktop and 390x844 mobile web; iOS 393x852; Android 412x915.
WHERE IT LIVES: Place tab -> Your places. On web, re-host it inside the normal Place shell: today it renders as a bare 760px frameless page with no nav entry anywhere, so a web user who saves a place can never find it again. It must carry the desktop left sidebar and the mobile four-tab bar (Place / Today / Nearby / Mail) like any other tab destination.
HOW THE USER GETS HERE: the Place tab itself when there is no claimed home; the Today header chip "Saved place - Only you"; Place file -> Address row; the post-save confirmation's tertiary "View saved places".
THE ONE JOB: see everything you saved, see which one Today is running on and why, and switch it, claim it or remove it.

CONTENT (exact copy, this density):
Header line: "Only you can see these."
Rows are label - city/state - saved date:
- 1402 NE 3rd Ave - Camas, WA 98607 - Saved 12 Sep 2026 (carries the "Used for Today" badge)
- Mom's house - Camas, WA 98607 - Saved 4 Sep 2026
- The Blairmont rental - Vancouver, WA 98683 - Saved 28 Aug 2026
- 704 NE Garfield St - Camas, WA 98607 - Saved 19 Jul 2026
Precedence sentence, sitting directly under the badged row: "Today uses the address you saved most recently." In the claimed-home frame it reads "A home you've claimed always wins."
Row overflow menu, four items in this order: Open / Use for Today / Claim this address / Remove.
Claimed row content: "Our house - 2817 NW Sierra St, Camas, WA 98607 - Claimed 2 Sep 2026".
Empty state: "Nothing saved yet." plus "+ Add a place" into the add-a-place sheet.

THE VISUALIZATION DECISION: a plain vertical list where exactly ONE row carries a filled "Used for Today" badge and every other row carries nothing at all. One badge slot per row, one overflow per row, no competing chips, no per-row status pills, no radio column. The precedence sentence is placed under the badged row, not in a page header, so the explanation is physically adjacent to the thing it explains. A claimed row renders with the home glyph in the home identity token (#16A34A) and a greyed caption "Today always uses your home" instead of a disabled-looking control, so it reads as a fact rather than a broken switch. This list IS the "where Today gets this" explanation: there is no second sheet.

STATES TO DRAW (one frame each):
1. Loading - row skeletons, badge slot reserved so nothing jumps.
2. Empty - the add-a-place CTA, header privacy line still present.
3. Single place - badge plus precedence sentence, no chooser affordance.
4. Multi-place chooser - all four rows above, one badge.
5. A home outranks the saved place - claimed row on top, "Use for Today" greyed on saved rows with the reason shown, not just dimmed.
6. Row already claimed - that row renders as a home, not as a saved place.
7. Removing with Undo - the removed row collapses to "Removed 'The Blairmont rental'  Undo", and in the SAME frame the "Used for Today" badge has already moved to the next place. Removal must look instant everywhere; a removed address still showing on Today reads as a privacy failure on an "Only you" surface.
8. Account-switch reset - list re-populated for the new account with "You switched accounts. These are the places saved to this account."
9. Offline - cached list, overflow actions disabled with the reason.
10. Error.

DO NOT: do not give every row a chip or badge; do not turn this into a radio group, segmented control or settings picker; do not render the claimed row as a disabled saved place; do not design a separate "where Today gets this address" sheet; do not use the word "home" or "household" for a saved place.

