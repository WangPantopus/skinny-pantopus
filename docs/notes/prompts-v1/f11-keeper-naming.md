# Give your place a keeper (naming)
id: f11-keeper-naming · platforms: web/ios/android · isNew: True · frames: 11

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Give your place a keeper (naming)
THIS IS: a NEW sheet. It expands from the inline invitation on the keeper strip, which is an extension of the existing designed "Today" screen — draw the sheet over Today, with Today's real content visible behind the scrim.
PLATFORMS / VIEWPORTS: web — modal 480px wide centred at 1440×900, and a full-height sheet at 390×844 mobile web; iOS 393×852 sheet at a medium detent with a grabber; Android 412×915 Material 3 bottom sheet.
WHERE IT LIVES: Today tab → keeper strip → "Give your place a keeper" (an inline invitation that expands on tap, never an auto-presented modal). Also opened from the keeper strip's overflow (Rename, Change species) and from the place file's Place section row.
THE ONE JOB: A one-time, low-stakes act of naming that turns a data screen into something the person owns — genuinely skippable and genuinely reversible.

CONTENT (exact strings)
Title "Give this place a keeper". Body line: "A small face on Today, so the address feels like somewhere."
Six species tiles, 3×2 grid, each drawn in its relaxed mood with the species name at caption beneath: Octopus, River otter, Great blue heron, Red fox, Raccoon, Douglas squirrel.
Name field beneath, 24-character maximum, live counter right-aligned in caption ("5 / 24"), pre-filled with a suggested default when a species is picked — Octopus → Ollie, River otter → Wren, Heron → Stilt, Red fox → Pepper, Raccoon → Bandit, Douglas squirrel → Doug.
Scope line under the field, exactly one of: "Everyone in this household sees this." (claimed home) or "Only you see this." (saved place).
Two buttons, side by side, equal width and equal height: "Name the keeper" (primary) and "Skip" (secondary with a real border).
Overflow afterwards on the strip: Rename · Change species · Remove. Remove confirm: "Remove Ollie? Today goes back to no keeper. You can add one again any time." — optimistic remove with Undo.

THE VISUALIZATION DECISION
Six tiles in a two-row grid with the name field directly beneath — one screen, no wizard step, no carousel, no "step 1 of 2". Tile selection is a 2px border.focus ring plus a primary.50 fill; do not put a checkmark badge on it, because a tick reads as a completed task and this is a choice, not a chore. The name field is the only text input on the sheet and takes focus automatically once a species is picked, with the suggested default selected so typing replaces it in one gesture. Skip is a REAL button of equal weight beside the primary — same height, same type weight, a visible border — not a grey text link, because the person very likely opened the app to find out whether recycling is tomorrow, and an interruption asking for a pet name has to be refusable in one tap without feeling like a mistake. That is also why nothing here auto-presents: the sheet fires at most once ever, from a tap on an inline invitation, and Skip persists so it never asks again while staying reachable from the overflow and the place file. Rename, Change species and Remove all exist, because otherwise a typo or a kid's joke name is permanent.

STATES TO DRAW (one frame each)
1. Default — no species picked, field empty with placeholder "Name", primary disabled, Skip enabled. 2. Species picked — Octopus selected, field pre-filled "Ollie", counter "5 / 24", primary enabled. 3. Name validation — pasted "Captain Wigglebottom the Third" truncated at 24, counter "24 / 24" in warning, helper "24 characters is the limit."; plus the cleared-field case "Give it a name, or Skip." 4. Saving — primary shows a spinner, tiles and field disabled, Skip disabled. 5. Save error — "We couldn't save that. Try again.", typed name preserved, Retry. 6. Skipped — the sheet gone, Today drawn with the quiet inline invitation still in the keeper slot. 7. Permission-denied — a household member opens it read-only: "Sam named this place's keeper Ollie.", the species tile shown selected and locked, no name field, a single Close. 8. T1 copy — "Only you see this.", the word "this place" throughout, never "household". 9. T3 copy — "Everyone in this household sees this." 10. Offline — save disabled, "You're offline. You can name it when you're back." 11. Overflow menu (Rename · Change species · Remove) with the Remove confirm.

DO NOT
Do not auto-present this on app open or on a second session. Do not split it into wizard steps. Do not style Skip as a grey text link or shrink it. Do not gate any feature, reward or unlock behind naming, and do not celebrate the save with confetti or a "Level 1 keeper" badge. Do not ship the sheet without Rename, Change species and Remove.
