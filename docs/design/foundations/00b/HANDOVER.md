# 00b · Data instruments → Pantopus design system

These are the exact files published to the **Pantopus** design system as version 7
(`lastChange.via = "Cowork · Pantopus Foundations 00b · Data instruments"`).
They are hand-written from the 00b specimen board, **not** generated from the repo, so
`tools/design-system/build.mjs` will drop them on its next run unless they are added
to the build's source. Same situation as the eight Foundations 00a components another
session published minutes earlier.

## What was published

| file | what it is |
| --- | --- |
| `project/components/ScaleStrip/README.md` + `preview.html` | the 0–10 authority band strip |
| `project/components/AqiBand/README.md` + `preview.html` | the six-segment EPA AQI band |
| `project/components/FourteenDayStrip/README.md` + `preview.html` | the 14-day day-column strip |
| `project/components/YearBand/README.md` + `preview.html` | the 12-month band with lanes |
| `project/components/SlotMeter/README.md` + `preview.html` | the discrete slot meter |
| `project/components/PublicPointMap/README.md` + `preview.html` | the public-point mini map |
| `project/components/FactCount/README.md` + `preview.html` | the counted-facts readout |
| `project/data-instruments.md` | the board section: the seven instruments, the G1–G8 grammar, borrowed 00a parts, and sections A–G of `00b · Notes` (23 open questions included) |
| `project/design-system.json.published-reference` | **not repo source.** The index as published, for reference only. The index is live artifact state — re-read it before any further publish, never resend this copy. |

Every component `README.md` ends with a board-token → system-token mapping table, so the
specimen board's semantic names line up with `tokens.json`.

## To keep them through the next build

1. Add the seven `components/<Comp>/` folders and `data-instruments.md` to whatever
   `tools/design-system/build.mjs` treats as hand-authored passthrough (the 00a
   components need the same treatment — worth doing once for both boards).
2. If the build has no passthrough concept yet, the alternative is to give each
   instrument a real implementation under `frontend/apps/web/src/components` so the
   build picks it up from code and regenerates the card. That would also put them in
   `bundle.js` / `index.d.ts`, which these hand-written previews deliberately avoid —
   each preview is self-contained and does not call into `window.Pantopus`.
3. Do **not** commit `design-system.json.published-reference` as the index. The page
   also generates `project/tokens.css`, `project/api/**`, `project/manifest.json` and
   the README's tail; none of those are here and none should be written by hand.

## Previews: what they assume

Each `preview.html` starts with `<!-- @dsCard group="Data instruments" height=NN -->`
and is a small self-contained document — no fetch, no bundle calls, no external URLs.
Colours are written as `var(--app-surface, #FFFFFF)`-style references so the cards
follow the page's `data-theme` in both light and dark; the EPA AQI hues are literal,
as they are on the board (the one sanctioned colour exception in the house style).

## Still open

The 23 questions in section E of `data-instruments.md` are unanswered founder
decisions, carried over verbatim from `00b · Notes`. The load-bearing ones for anyone
building from these cards: card radius 12 vs 20 (Q1 — the board now draws 20 per the
design system), the YearBand desktop "4" cluster that does not reconcile with the
fixtures (Q14), the EPA Hazardous statement placeholder (Q7), and the PM2.5 sentence
against EPA TAD Table 4 (Q22).
