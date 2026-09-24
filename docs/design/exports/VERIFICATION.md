# Screen export verification

One entry per exported screen prompt, per [HANDOFF §5](../../notes/HANDOFF.md). How to repeat a check:

```
python3 tools/export-render/verify_export.py <prompt-id>        # shape, names vs ARTBOARDS, pages.json
node tools/export-render/render-frames.mjs docs/design/exports/<prompt-id>/pages/pages.json <outDir> 2
```

Then look at every rendered frame (for a batch, one reviewer per screen works; check their claims: one reviewer wrongly said save-confirmation had no role=status). The verifier also prints any placeholder copy. `verify.json` beside each export holds the machine result. The renderer also
audits each frame's layout (dates split across lines, text cut off by a too-small container, text escaping its
button) and prints what it finds; findings in board annotations or host sketches can be ignored.

## Status

| # | Prompt | Export on disk | Names vs manifest | Substance | Open |
| --- | --- | --- | --- | --- | --- |
| 048 | x-provenance-sheet | bundle, 37 pages (after host redraw) | 37/37 exact | Holds; the host redraw mostly failed to show | Core-loop fix pass: hosts hidden under the sheet, DateSheet/bill/place hosts still sketches, marks board not the real strip, frame 24 date |
| 049 | x-date-sheet | bundle, 38 pages (after redraw) | 37/38 (Notes name) | Strong; dates and counts check out | Core-loop fix pass: 25 and 34 miss their point, leader lines through labels, marks don't say who added, 14-day lease lead (settled 30), fold labels over UI |
| 057 | f4-today-pickup-card | bundle, 33 pages (after redraw) | 32/33 (Notes name) | Accept after small fixes; host redraw worked | Core-loop fix pass: web width, 320 frame, one ask at a time |
| 050 | x-place-file | bundle, 22 pages (after redraw) | 22/22 | Main jobs work; hosts are the design board's, not the shipped app | Core-loop fix pass: Sam's view provenance wrong, year-band collisions, hollow unconfirmed pickup |
| 055 | f1-today-tab | bundle, 23 pages | 23/23 | Content right | Core-loop fix pass: tab bar escapes the phone on 8 frames, wrong spoken label on Change pickup day, join notice |
| 056 | f5-today-calendar-strip | bundle, 23 pages | 23/23 | Close to done | Core-loop fix pass: tonight outline hidden, doubled highlight, Jordan's wording |
| 058 | f1-today-air-band | bundle, 23 pages | 23/23 | AQI track exact (hues sampled) | Core-loop fix pass: range labels wrap, greyscale frame hand-drawn, links |
| 052 | f1-add-place-sheet | bundle, 23 pages | named by order (descriptive titles) | Holds on states and honesty; drawn from the pre-22-Sep story | Fix pass B: re-story plus a loading bar off its card (08), iOS keyboard on Android, only 4 of 5 suggestions on iOS, sheet height changes; hosts stubbed ("capture not supplied" on 02-idle, 03b, 14) |
| 053 | f1-save-confirmation | bundle, 18 pages | named by order | Holds | Fix pass C: iOS keyboard on Android 04b; "J" avatar in the different-account frame |
| 054 | f1-email-verify-handoff | bundle, 19 pages | named by order; has its 200% frame | Holds | Fix pass C: 200% frame stops before the code field and buttons; spam hint dropped on cooldown; held link-expired loses the hold length |
| 059 | f4-notification-primer | bundle, 18 pages | named by order | Holds; the pickup primer follows its own brief (Date-sheet entry), not the "That's my day" path | Fix pass C: visible "[PLACEHOLDER]" box (04, 06, 11); tray icon is an empty square; AX5 drawn mid-scroll; dark tray panel invisible |
| 060 | f4-briefing-optin-card | bundle, 28 pages | named by order | Holds on the notification model | Fix pass C: AX5 link cut off; links by colour alone (greyscale); iOS double title; wrapped Undo |
| 061 | f4-notification-settings | bundle, 21 pages (the first file saved was a copy of f1-your-places) | named by order | Holds; the 22 Sep ruling drawn as sent | Fix pass C: browser-blocked frame turns everything off though the iPhone still delivers; Android says "Focus"; landing and AX5 frames miss their point; paused line cut; dark banner hex |
| 062 | f1-claim-receipt | bundle, 22 pages | named by order | Logic holds (item-by-item moves, private by default, receipt revisitable); host success page is placeholder boxes (no capture) | Part D landed (verified): dates whole, AX5 shows the question and buttons, one-date plurals. Keeper avatar still an "O" stand-in |
| 063 | f6-home-basics-rows | bundle, 21 pages | named by order | Holds; host settings rows are placeholder boxes (screenshot body empty) | Part D landed (verified): selection distinct from focus |
| 064 | f6-place-section-details | bundle, 25 pages (after part E) | named by order | Holds: every scale in its authority's words, AQI the only coloured track; host sections are placeholder boxes | Part E landed: all answers and 4 of 5 fixes, the 5th partly; D2 open (founder) |
| 051 | f1-your-places | bundle, 26 pages | 1/26: board titles are descriptive and frames carry no name label; all 26 mapped by manifest order | Holds; 6 drawing defects below, all fixed by part B (verified 22 Sep night) | Founder questions answered |

Session 1 is ready for the journeys by name: all 132 session-1 artboards the journeys attach by exact name exist
(113 on the six index pages, 19 in x-provenance-sheet). The bot's "no 200% frame" failure on every session-1 screen is
not a failure: none of those manifests names one (see the foundations README rulings).

## 051 · f1-your-places — verified 22 Sep 2026

All 26 frames rendered at 2x and looked at. Audits from the markup: the product frames use only published token
colours and the house type scale (the only off-scale sizes are the Notes page and the web wordmark); no button is
drawn below 44; all 43 COPY strings are drawn or listed on Notes as omitted states; spoken row labels, "More for …"
button names, role=status lines, aria-expanded and aria-disabled are present.

**Holds.** Exactly one "Used for Today" StatusChip (sun-outline, sunken fill) with its reason sentence under the row;
the badged row never offers Use for Today; Maya's frames split into "Your home" (ScopeChip "Your household", caption
"Today uses your home", menu with Open only) and "Saved places" (chip in the group header); the disabled Use for Today
states its reason; Remove collapses to a lasting InlineUndo whose line names the consequence; a failed remove restores
the row and badge with an InlineErrorRow; the empty, loading (badge slot reserved), offline (Open works, the rest
disabled with one reason), load-failed, account-switched and synced states are honest; destructive styling puts red on
the trash glyph only; four labelled tabs, no FAB; greyscale reads by shape (house vs pin glyph).

**Corrections (drawing defects; fix in the build, or in one Claude Design pass at the end of session 2):**
1. Names: board titles are descriptive ("Your places · Android · scope explained") and no frame shows its artboard name.
   Handled at render time; the house style asks for both.
2. Dates break inside themselves on 16 of the 26 frames: "Saved Fri 28 / Aug", "Claimed Mon 19 / Oct" (01, 03, 04,
   07–14, 18, 21, 23–25). A date should stay whole and the line should break at the " · " before it.
3. web-390 frame 04: the bottom sheet's Close button shrinks beside the long title and its label runs out of the
   button to the sheet edge. Close must not shrink.
4. The list card is squeezed and clips its own rows instead of running past the screen edge: iOS frame 13 (remove
   failed) hides the "+ Add a place" foot row, and the AX5 frame 22 closes the card after Birchfield, hiding Mom's
   house and the rest, so the list reads as a single place.
5. Dark frame 25: the home row's pull-down menu uses the card's own fill (#0f172a on #0f172a) and a 10% black shadow,
   so it has no visible edge. Dark menus need surface.raised plus a visible edge, as the house style's dark rule asks.
6. Web frames (02, 04, 10, 14, 19, 20) draw a dashed placeholder tile for the Pantopus mark. The design system's
   Logos group has it (`tools/design-system/out/project/assets/Logos/pantopus-lockup.svg`); the canvas only had tokens.

**Optional improvements.**
- The "Used for Today" chip sits under a long label (frame 01) but beside a short one (12, 14, web). One fixed
  position makes the badge land in the same place every time.
- Host captures never arrived (Notes A1): the web Place shell and the tab glyphs are the model's reconstruction from
  the design system README. Check them against the real shell before building.
- iOS dark twins use the web Dark palette; the house style allows this ("Dark · iOS follows the same structure").

**Founder decisions raised on its Notes: all answered 22 Sep** (foundations README). E1: a claimed home always drives
Today, so the caption stays. E2: Jordan's other places are now saved Sun 18 Oct and Birchfield is "chosen" on the
multi-place frames. E3: the place file is the Place tab's first screen, so Jordan's frames get the "Place" back
control. E5/A15: offline "+ Add a place" stays disabled. A2/E4 and A3 were answered by the Version 7 house-style fix.
The redraw for E2, E3 and corrections 2–6 is the session-2 fix pass in BOT-BRIEF.md.
