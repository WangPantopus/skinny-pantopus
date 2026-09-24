> **Start with `docs/notes/HANDOFF.md`.** It covers the whole programme and the current execution state.
> This file is the round-2 build history behind it.

# RESUME HERE — Pantopus Claude Design prompt pack

Last updated: Thu 17 Sep 2026, ~00:10 PT. **Round 2 is COMPLETE and published.** The full history is in
`SESSION-screen-inventory-2026-09-16.md`.

## Live artifacts (the links changed to the claude.ai/artifact/… format; same artifacts)
- Prompt pack v3 (Version 3): https://claude.ai/artifact/FukRC9qWmAVRUomVC53F1B
  113 prompts (40 Foundations, 59 screens, 14 journeys), 1,731 artboards, ~435k words, 22 research rules, 441 sources.
- Screen inventory: https://claude.ai/artifact/UBJqjLk21M3XCygvShZE41 (59 surfaces, 5 genuinely new screens)
- Repo-built design system (another session's work): https://claude.ai/artifact/MCub8DTnkdhoFnMbtF8QF5

## Update 2026-09-22
The founder is running the pack in Claude Design. The Foundations are done except 00b-01/00b-02 part 2. Those were missing from the pack because of a merge bug in C1b that dropped new split ids. Now restored as `prompts-final/00b-01b.md` and `00b-02b.md`, published as Version 4, 115 prompts; screens start at #043. See the session log for the root cause.

## Foundations exports (2026-09-22)
`docs/design/exports/` holds the HTML bundles, one PNG per artboard, and `attach/` (36 key PNGs + 4 PDFs under 16 MB). Tools: `tools/export-render/`. The only gap: 00a AddressChip batch 2 plus 2 ProvenanceMark dark versions.

## Final files
- Final prompts: `prompts-final/<id>.md` (00a-00…00d-08, the 59 surface ids, flow-01…flow-14)
- Page: `pack-manifest.json` (build_manifest.py) → `gen_pack_v3.py` (+ .css, .js) → scratchpad + `design-prompt-pack.html`
- Check: `python3 check_prompts.py prompts-final`. Final result: 0 missing sections, 0 weekday errors. The remaining hits are
  reviewed and legitimate: "Instead of X" lines, labelled invented addresses, recast notes, and journey frame labels that
  trip the artboard-name pattern.
- Sources: house-style-v2.txt, ux-research-brief.md, component-contract.md, flows-spec.md, research-findings.md

## To change the pack later
Edit `prompts-final/<id>.md` → `python3 build_manifest.py prompts-final && python3 gen_pack_v3.py` → republish.
From a new session: Artifact action=read url=https://claude.ai/artifact/FukRC9qWmAVRUomVC53F1B first, then publish
`docs/notes/design-prompt-pack.html` with that url.

## Known limits (stated on the page)
- The founder skipped the whole-pack consistency pass. The last round of per-prompt fixes was not re-verified. On
  conflicts, the house style wins, then the Foundations boards. The skipped pass is ready in `workflow_c2b_consistency.js`.
- The journey storyboards are long (6k–13k words). Optional follow-up: split each into a setup message plus one message per turn
  (as was done for the Foundations), about 14 writers plus verification.

## Decisions for the founder (listed on the page)
F8 letter grades replaced by each authority's own scale · 7-day first week · keeper opens only on tap · members recording "I paid" ·
photo retention period and alert hysteresis · Founding name confusion test · keeper art budget · Android dark twins
(Android ships light only) · fix contrast in the shipped components (4.10:1, 2.77:1, 1.73:1) · verify the Camas holiday move
· confirm the invented Dana/Ana addresses are not real parcels.
