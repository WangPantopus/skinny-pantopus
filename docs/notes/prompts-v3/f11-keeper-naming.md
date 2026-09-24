# Give your place a keeper (naming)
id: f11-keeper-naming · platforms: web/ios/android · isNew: True · artboards: 22

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Give your place a keeper · f11-keeper-naming

TYPE: NEW. One sheet, drawn over the existing "Today" screen with Today's real content visible behind the scrim. Rename and Change species modes also open over Today. The read-only mode and the re-entry mode open over the place file (or Settings).

ATTACH: Today on iOS 393x852 for HOME A with the keeper invitation row (from f11-keeper-strip); Today for PLACE B; Today on Android 412x915, web 1440x900 and web 390x844; the place file's Place section; Settings index.

PLATFORMS & VIEWPORTS
- iOS 393x852 (primary): a sheet with a grabber at the large detent (or a custom detent sized to the content). The button row is pinned as a sticky footer, and scroll padding is reserved so the field is never hidden behind the keyboard or the footer.
- Android 412x915: an M3 modal bottom sheet, expanded, with the same pinned button row.
- Web 1440x900: a centred 480-wide modal.
- Web 390x844: a bottom sheet at content height with the same pinned button row, growing to full height with the keyboard.

WHERE IT LIVES & HOW PEOPLE ARRIVE: This sheet opens only from a tap. It never opens on its own: not at launch, not on a second open, not in the first session.
Entry points:
(1) The keeper invitation row on Today, which appears only after a first value moment (a confirmed pickup day or a saved date) and after the FirstWeekRow has gone, for at most 14 days.
(2) Rename or Change species in the keeper menu on the strip.
(3) The place file's Place section row "Give your place a keeper" (PLACE B: "Give this place a keeper"), the way back after Skip or after the invitation window ends. Once a keeper exists, the same section shows the "Keeper" row reading "Ollie · River otter".
(4) The "Keeper" row in Settings.
What the sheet hands on:
- From the Today invitation, Save returns to Today. The strip's pose settles, and the caption "Ollie is on Today now." sits under the strip, FreshnessLine style, until the person leaves Today.
- From re-entry, Save closes the sheet back to the invoking row, which now reads "Ollie · River otter" and announces "Ollie is on Today now." as role=status. Today shows the strip the next time it opens.
- Skip returns to Today with the keeper slot closed and the InlineUndo line.
- Close leaves everything as it was and returns focus to the invoking row.
At a later claim of PLACE B, the claim receipt carries the keeper over and must tell Jordan that everyone in the household will then see it, before that happens; this sheet then shows the household scope sentence.

WHO AND WHEN: Maya Chen at HOME A, Mon 12 Oct, 6:10 PM, on her iPhone. She had just confirmed that garbage goes out on Tuesday (her first value moment), then tapped the invitation. A week later (TODAY, Mon 19 Oct) she opens Rename from the strip. Jordan Lee at PLACE B does the same for a saved place. Sam Ortega, a member, opens the Keeper row in the place file and can only view it.

THE ONE JOB: Let someone name a keeper with two taps (an animal, then save), or skip it for good with one.

FIRST FIVE SECONDS: First the title. Second the six species tiles. Third the two equal buttons in the pinned footer, visible without scrolling. The primary action is "Name the keeper", enabled once a species is picked.

CONTENT (fixture deltas only; list every invented string on Notes)
- Title: "Give your place a keeper" (HOME A), "Give this place a keeper" (PLACE B).
- Body: "A small animal on Today that sums up what's due here."
- Second line: "You can rename or remove it any time."
- Six tiles in this order, each with the calm pose, the species name and its suggested name:
  - Octopus: Otto
  - River otter: Ollie
  - Great blue heron: Stilt
  - Red fox: Pepper
  - Raccoon: Bandit
  - Douglas squirrel: Doug
- Name field: visible label "Keeper's name", 24-character limit, live counter ("5 / 24").
- Scope sentence, exactly:
  - HOME A: "Everyone in this household will see this." plus "What it says is based on what each person can see."
  - PLACE B: "Only you will see this."
- Buttons: "Name the keeper" and "Skip". While no species is picked, the caption "Pick an animal first" sits under the button row.
- PLACE B delta: Jordan picks Red fox; the field fills with "Pepper".
- Read-only (Sam): title "Ollie, this place's keeper", body "Maya named this place's keeper Ollie."
- Landing delta (Mon 12 Oct): the strip reads "On it · Garbage tomorrow." with FactCount V2 "14 on file".
- Worst case: pasting "Captain Wigglebottom the Third" keeps "Captain Wigglebottom the" (24 characters).

LAYOUT & VISUALIZATION
- One screen, no steps.
- Order: header (title and a visible Close), body lines, a 3x2 tile grid, the name field directly below, the scope sentence, then the pinned button row. Both buttons have identical height, width and type weight: filled primary.700 "Name the keeper" and outlined "Skip" with a text.secondary-strength border. The "Pick an animal first" caption is text.secondary, under the row inside the footer, and disappears once a tile is selected.
- Each tile is a 44pt+ target (48dp on Android) with a 56pt pose and a two-line label (species, then suggested name).
- Selected tile: the KindGlyph selected-tile treatment, a filled radio dot and a bold label, with a 2px text.primary outline. Focus ring: a 2px border.focus ring offset 2px outside the tile, so focus and selection look different. No tick or check badge.
- No pronouns, traits, colours, quiz or preview carousel.
- At AX5 or 200% text, tiles become a single-column list, the sheet scrolls, and the buttons stack full width with "Name the keeper" first, still pinned.

INTERACTION, MOTION & HAPTICS
- Picking a tile fills the field with that species' suggested name. Focus stays on the tile. Tapping the field selects the whole name, so typing replaces it. Picking another species replaces the name only if it was not edited.
- Save: the sheet closes, the pose settles, the status caption is announced. That is the only feedback. One light haptic tick on iOS and Android, on a successful save only.
- Skip persists on the server. The sheet closes, the Today slot closes, and InlineUndo reads "Skipped. You can add a keeper from your place file. · Undo".
- Close, Escape, Back and swipe-down (swipe-down only when nothing was typed) leave the invitation as it was.
- Re-entry mode (opened from the place file or Settings): only "Name the keeper" plus the header Close, no Skip; Close returns to the row; Save returns to the row as described above.
- Rename mode: title "Rename Ollie"; only the field, pre-filled; primary "Save name"; Close.
- Change species mode: title "Choose a different animal"; tiles with the current species selected; the field keeping "Ollie"; primary "Save"; Close.
- Read-only mode: the Ollie tile shown selected and locked, no field, LockedActionRow "Only Maya can rename this keeper.", a single Close.
- Hide and Remove live on the strip's menu (drawn in f11-keeper-strip): Remove happens at once with Undo, no dialog.
- Motion: the native sheet transition; pose settling 300ms or less; Reduce Motion gives a cross-fade and a static pose.

FOUNDATIONS COMPONENTS USED: ScopeChip (footer sentence form, both tiers) · KindGlyph (selected-tile state only, reused on a proposed species-tile variant, not ChoiceChip) · InlineErrorRow (save failed, value kept) · InlineUndo (Skip) · OfflineNotice (form offline) · LockedActionRow (read-only mode) · KeeperStrip (landing) · FactCount (V2, landing) · FactRow (place file Keeper and re-entry rows).

ACCESSIBILITY
- Reading order: title, Close, body lines, tiles, name field, counter, scope sentence, Name the keeper, Skip, then the "Pick an animal first" caption.
- Unique sheet title; focus is trapped; focus returns to the invoking row on close.
- Tiles are a radio group, each read as "River otter, suggested name Ollie", with the selected trait.
- Focus never jumps to the field on its own.
- The counter is a polite live region only at 20 characters and above. Errors sit under the field and say what to do.
- The save status is role=status, both on Today and on the re-entry row.
- Disabled "Name the keeper" stays focusable, with the hint "Pick an animal first", matching the visible caption.
- Selection reads in greyscale from the dot, bold label and outline.

COPY: "Give your place a keeper" · "Give this place a keeper" · "A small animal on Today that sums up what's due here." · "You can rename or remove it any time." · "Otto" · "Ollie" · "Stilt" · "Pepper" · "Bandit" · "Doug" · "Keeper's name" · "5 / 24" · "24 / 24" · "Everyone in this household will see this." · "What it says is based on what each person can see." · "Only you will see this." · "Name the keeper" · "Skip" · "Close" · "Pick an animal first" · "24 characters is the limit." · "Give it a name, or tap Skip." · "Give it a name." · "Saving…" · "We couldn't save that. Your name is still here." · "Retry saving" · "You're offline. You can name it when you're back." · "Will save when you're back online" · "Ollie, this place's keeper" · "Maya named this place's keeper Ollie." · "Only Maya can rename this keeper." · "Keeper" · "Ollie · River otter" · "Ollie is on Today now." · "Garbage tomorrow." · "Skipped. You can add a keeper from your place file. · Undo" · "Rename Ollie" · "Save name" · "Choose a different animal" · "Save".

EDGE CASES
- Too long: after a paste, the counter reads "24 / 24" in text.primary with a warning glyph, and the helper reads "24 characters is the limit."
- Empty or spaces only: "Give it a name, or tap Skip." and the primary is disabled. In Rename and re-entry modes, which have no Skip, the helper reads "Give it a name."
- Emoji count as one character each.
- Slow network: after 1s, the primary shows "Saving…"; tiles, field and Skip are all disabled until the save finishes.
- Save error: InlineErrorRow "We couldn't save that. Your name is still here." with "Retry saving"; the typed name is kept.
- Offline: "Name the keeper" is disabled, with "You're offline. You can name it when you're back." in place of the caption. Skip still works and is queued ("Will save when you're back online").
- The claim merges into a home that already has a keeper: the claim receipt, not this sheet, says which keeper is kept.
- A household where finance permissions differ: the second HOME A scope line, "What it says is based on what each person can see.", is what keeps "Everyone in this household will see this." honest.

INSTEAD OF
- Instead of auto-presenting this on a second open, open it only from a tap after a value moment — because someone checking recycling should not be interrupted by a naming ask.
- Instead of a half-height sheet with the buttons below the fold, draw a large sheet with the button row pinned — because the equal Skip must be visible in the first five seconds.
- Instead of a grey "Skip" link, draw Skip as an outlined button matching "Name the keeper" in size and weight — because a decline must be one easy, neutral tap.
- Instead of a focus-coloured ring as the selection, draw a filled radio dot, a bold label and a text.primary outline — because selection must look different from focus.
- Instead of moving focus into the field after a pick, keep focus on the tile — because a jump disorients screen-reader users.
- Instead of a silent dead primary button, show "Pick an animal first" under it — because sighted users need the reason too.
- Instead of confetti, a badge, "Level 1 keeper" or "Ollie will miss you", let the pose settle, show one factual line and use plain verbs — because celebration turns a choice into a game and the keeper never uses guilt.
- Instead of leaving the invitation after Skip, close the slot and keep the way back in the place file and Settings — because a skipped ask should not return.

DONE WHEN: Naming takes two taps (a species, then save). Skip works in one tap, persists, can be undone and can be reversed later from the place file. Both buttons are visible without scrolling at default size. Nothing is gated behind naming. The scope sentence matches the tier exactly, and no scope change happens without being stated. Rename, Change species and Remove all exist, and every mode lands somewhere that confirms the save. The AX5, greyscale and focus-plus-selection frames read correctly.

ARTBOARDS
1. f11-keeper-naming · ios · 01-otter-picked · light — HOME A, large sheet, River otter selected, "Ollie", "5 / 24", both buttons enabled and visible in the pinned footer without scrolling.
2. f11-keeper-naming · ios · 02-default · light — HOME A, nothing picked, primary disabled with the "Pick an animal first" caption.
3. f11-keeper-naming · ios · 03-name-too-long · light — pasted name cut to 24, helper shown.
4. f11-keeper-naming · ios · 04-name-empty · light — "Give it a name, or tap Skip."
5. f11-keeper-naming · ios · 05-saving · light — "Saving…", tiles, field and Skip disabled.
6. f11-keeper-naming · ios · 06-save-error · light — InlineErrorRow with "Retry saving", name kept.
7. f11-keeper-naming · ios · 07-named-landing · light — Today on Mon 12 Oct with Ollie settled, "On it · Garbage tomorrow.", "14 on file" and "Ollie is on Today now." under the strip.
8. f11-keeper-naming · ios · 08-skipped-landing · light — Today with the slot closed and the InlineUndo line.
9. f11-keeper-naming · ios · 09-saved-place · light — PLACE B, "Give this place a keeper", Red fox, "Pepper", "Only you will see this."
10. f11-keeper-naming · ios · 10-member-read-only · light — Sam over the place file: "Ollie, this place's keeper", body, locked tile, LockedActionRow, Close.
11. f11-keeper-naming · ios · 11-rename · light — Rename mode with the keyboard up; inset of the empty field showing "Give it a name."
12. f11-keeper-naming · ios · 12-change-species · light — Change species mode.
13. f11-keeper-naming · ios · 13-offline · light — save disabled with the offline reason, Skip queued.
14. f11-keeper-naming · ios · 14-reentry · light — place file row "Give your place a keeper", Settings "Keeper" row, the re-entry sheet with no Skip, and the row after save reading "Ollie · River otter" with the "Ollie is on Today now." status.
15. f11-keeper-naming · android · 15-otter-picked · light — M3 bottom sheet, 48dp, pinned buttons.
16. f11-keeper-naming · web-1440 · 16-otter-picked · light — 480 modal over Today; River otter selected, keyboard focus ring on Red fox.
17. f11-keeper-naming · web-390 · 17-otter-picked · light — bottom sheet at content height, pinned buttons.
18. f11-keeper-naming · ios · 18-ax5 · light — one-column tiles, stacked pinned buttons, scrolling.
19. f11-keeper-naming · ios · 19-greyscale · light — selection readable without hue.
20. f11-keeper-naming · ios · 20-otter-picked · dark — dark twin of 01.
21. f11-keeper-naming · ios · 21-save-error · dark — dark twin of 06.
22. f11-keeper-naming · Notes — assumptions; omitted states; invented strings; normalisations; decisions; deviations; open items, as follows.
- Assumptions: the naming happened Mon 12 Oct, a week before TODAY, so the fixture keeper Ollie exists on Mon 19; Maya's first value moment was confirming Tuesday pickup; the Mon 12 landing strip reads "On it · Garbage tomorrow." (recycling is on Tue 20, not Tue 13) with "14 on file".
- Invented strings: Otto, Stilt, Pepper, Bandit, Doug; both body lines; the second scope line; "Keeper's name"; "Pick an animal first"; "24 characters is the limit."; "Give it a name, or tap Skip."; "Give it a name."; the mode titles including "Ollie, this place's keeper"; "Maya named this place's keeper Ollie."; "Ollie · River otter"; "Saving…"; "We couldn't save that. Your name is still here."; "Retry saving"; "You're offline. You can name it when you're back."; "Will save when you're back online"; "Save name"; "Save"; "Garbage tomorrow."; the landing and Skip lines.
- Normalisations: the queued-write string is "Will save when you're back online" instead of the contract's "Will upload when you're back online" (nothing is uploaded here); scope sentences use "will see" instead of the inventory's and flow-09's "sees" / "Only you see this.".
- Decisions: the sheet writes one place-scoped keeper slot, so the claim carry-over does not reset the keeper; Skip is disabled while saving; the sheet opens at the large detent with a pinned footer.
- Deviations: KindGlyph species-tile variant proposed (56pt pose, two-line label) sharing KindGlyph's selected-tile state — the contract defines KindGlyph only for dated kinds and needs this variant. The second HOME A scope line is the mitigation for ScopeChip's rule against saying "Everyone in this household" where finance permissions differ.
- Open items: the claim receipt must ask (or clearly state) before the keeper becomes household-visible, since flows-spec shows it asking only about dates; flow-09 step 4 must change to River otter → Ollie (v1 had Octopus → Ollie); doc §F11 auto-present on the second Today open is replaced by tap-only entry after a value moment and after the FirstWeekRow, for at most 14 days; the inventory and flow-09 say "Sam named" / "Only Sam can rename", here Maya is the owner; contract DestructiveConfirm still lists f11-keeper-naming, now unused; the doc lists otter, owl, fox, heron, cat and dog; the species art may be cut to three.

BATCH PLAN
Turn 1: 1-6, then wait for "continue".
Turn 2: 7-12, then wait for "continue".
Turn 3: 13-18, then wait for "continue".
Turn 4: 19-22.
