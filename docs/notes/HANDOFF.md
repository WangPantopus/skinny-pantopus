# Handoff — Pantopus screen design programme

Written 22 Sep 2026, at the end of a long session; §2, §3, §4, §5, §7, §8 and §10 updated the same evening, after
session 1 finished. Repo `/Users/yingpengwang/skinny-pantopus`, branch `master`. Nothing in this programme is
committed to git: `docs/notes/`, `docs/design/` and `tools/export-render/` are untracked working files.
Read this file first, then `RESUME.md` for the round-2 build history.

---

## 1. What this programme is

The founder (solo, three platforms) wrote `docs/first-person-loop-design-2026-09-16.md`: features F1–F12 that make
Pantopus useful with zero other users. Two deliverables came out of it:

1. **A screen inventory** — how many screens F1–F12 needs and what they are.
   → https://claude.ai/artifact/UBJqjLk21M3XCygvShZE41
   **59 surfaces / 5 genuinely new screens / 159 per-platform builds.**
2. **A Claude Design prompt pack** — one self-contained prompt per surface, so Claude Design can draw them.
   → https://claude.ai/artifact/FukRC9qWmAVRUomVC53F1B (Version 11, **115 prompts**)
   40 Foundations component prompts + 59 screen prompts + 14 journey storyboards, 1,748 artboards.

The founder is now **executing** the pack in Claude Design, with a bot doing the sending.

---

## 2. Where execution stands (22 Sep 2026)

**Foundations: DONE.** All four boards drawn, published into the design system, and handed back to the repo.
36 components live: 00a marks/captions/chips (9), 00b data instruments (7), 00c rows/lists (12), 00d states/asks (8).

**Screens: session 1 DRAWN, session 2 STARTED.** Per-screen results are in
[`docs/design/exports/VERIFICATION.md`](../design/exports/VERIFICATION.md).
- Session 1 ("Pantopus screens — core loop"): all seven prompts drawn. `x-provenance-sheet` is exported in full and
  verified. The other six (`x-date-sheet`, `f4-today-pickup-card`, `x-place-file`, `f1-today-tab`,
  `f5-today-calendar-strip`, `f1-today-air-band`) were exported only as Claude Design's check index, without the
  per-artboard files, so their substance is unchecked. Their names match the manifests, except two Notes boards
  (accepted), and all 132 session-1 artboards the journeys attach by exact name exist.
- Still due in the core-loop project: export the six in full, then redraw the provisional hosts (BOT-BRIEF.md,
  "Once, in the core-loop project"), then re-export those four pages.
- Session 2 ("onboarding & notifications"): `f1-your-places` exported in full and verified. Its substance holds, with
  six drawing defects and four founder questions in VERIFICATION.md. Its board titles are not the manifest names, so
  names are mapped by order.
- Session 2 progress (bot report): prompts 1–6 sent (`f1-your-places` through `f4-briefing-optin-card`); it stopped on
  `f4-notification-settings`, whose attached "before" (archetype A14.5) is an unbuilt concept, and was given a
  recommended reply (the brief's five groups plus Nearby and Mail groups for the notifications the app really sends).
  Still to send: `f1-claim-receipt`, `f6-home-basics-rows`, `f6-place-section-details`, then the session-2 addendum and
  fix pass in BOT-BRIEF.md.
- Session 2 exports: only `f1-your-places` is on disk. The file the bot saved for `f4-notification-settings` was a
  copy of the f1-your-places export (same checksum) and was moved out; the other finished session-2 screens were never
  exported. BOT-BRIEF step 5 now makes the bot run `verify_export.py` and check for repeated checksums.
- Notification settings was drawn to the recommended reply; ruling recorded and its prompt updated (pack Version 9).
- Prompt pack republished as **Version 8**: Version 7 corrected the house style's web radius and pillar lines; Version 8
  adds three house-style rules (dates on one line, dark menu edges, the attached logo) and the founder's 22 Sep
  decisions (home always drives Today, the place file is the Place tab's first screen, Jordan's dates) in
  f1-your-places, f1-add-place-sheet and flow-06. All in `docs/design/foundations/README.md`. Sessions 1 and 2 ran on
  earlier text.

**23 Sep:** sessions 1 and 2 are fully exported and reviewed (see VERIFICATION.md). Session-2 fix passes A–E landed. The
core-loop design-review fix pass and the household addendum are written in BOT-BRIEF.md. Session 3 (household) is
running. House style Version 11 adds shipped tab icons and underlined links. Decided 23 Sep: a saved place opens place-section details;
the Date-sheet pickup primer stays. Open: the 100-mile away-from-home design. Before the
journeys: fix flow-03 and flow-06 to the 30-day lease lead.

**Journeys: not started.** They go last, because each attaches exported artboards of finished screens.

---

## 3. The live artifacts

| What | URL |
| --- | --- |
| Prompt pack (Version 11, 115 prompts) | https://claude.ai/artifact/FukRC9qWmAVRUomVC53F1B |
| Screen inventory | https://claude.ai/artifact/UBJqjLk21M3XCygvShZE41 |
| Pantopus design system (built from the repo; now also holds the 36 Foundations cards) | https://claude.ai/artifact/MCub8DTnkdhoFnMbtF8QF5 |
| Foundations board 00d (canvas) | https://claude.ai/artifact/NM6uvaSME8c4WtQfDLDYRF |
| Founder's own design projects (403 to Claude Code — the founder must open these) | https://claude.ai/design/p/019e16cb-d2a9-77b0-b9e0-370dbe3856ba · https://claude.ai/design/p/c65a37ac-191a-4cdc-9f30-602926979fd6 |

To update the prompt pack from a new session: `Artifact` `action:"read"` with its `url` first, then publish
`docs/notes/design-prompt-pack.html` with that same `url`.

---

## 4. Files, by what you would want to do

### Send prompts / run the programme
| Path | What |
| --- | --- |
| `docs/design/send-kit/RUNBOOK.md` | The one-page runbook + progress table for all 73 screen/journey prompts, in 8 sessions |
| `docs/design/send-kit/BOT-BRIEF.md` | The operating brief for the founder's bot: setup, per-prompt loop, rules, the 12 answers it may give without asking, reporting format |
| `docs/design/send-kit/<NNN>-<prompt-id>/` | 76 per-prompt folders: the component PNGs that prompt uses, `existing-screen/` "before" images where available, and `MANIFEST.md` (job, what to attach, what to export by hand, steps) |
| `docs/notes/prompts-final/<id>.md` | The 115 prompts. **Skip the first two lines** (title + `id:`) when pasting; the pack page's Copy button already omits them |
| `docs/notes/house-style-v2.txt` | Pasted as the FIRST message of every Claude Design project, with the four board PDFs and the three logo PNGs attached. `house-style-v2.as-sent-sessions-1-2.txt` is the text sessions 1 and 2 received |
| `docs/design/exports/attach/` | 36 component PNGs + `00a–00d-foundations-reference.pdf` (11–14 MB each) + `pantopus-logo-*.png` (rendered from the design system's Logos group; `package.py` does not make them) |

### Understand the design decisions
| Path | What |
| --- | --- |
| `docs/notes/ux-research-brief.md` | 13-topic research distilled into 22 rules, the onboarding model, the notification model, the visualization grammar, accessibility and microcopy rules, per-surface changes, and research deliberately rejected |
| `docs/notes/research-findings.md` / `research-raw.json` | The full evidence, 224 principles, 441 sources |
| `docs/notes/component-contract.md` / `.json` | The 40 shared components: anatomy, variants, states, accessibility, glossary of canonical terms |
| `docs/notes/flows-spec.md` / `.json` | The 14 journeys, step by step, with handoff gaps |
| `docs/notes/FINAL-screen-inventory.md` | All 59 surfaces with purpose, contents, visualization, states, entry points, effort |
| `docs/notes/map-findings-structural.md` | What the code actually does, and the four corrections to the design doc |
| `docs/design/foundations/README.md` | Board status, the 14 settled decisions, the token and pillar corrections, the screen-verification rulings |
| `docs/design/exports/VERIFICATION.md` | Per-screen verification results: names, substance, drawing defects, founder questions |
| `docs/design/foundations/00a–00d/` | Each board's handoff: `HANDOVER.md`, `REPO-HANDOFF.md` (00a), and the published card files for 00a/00b |

### Rebuild or verify
| Command | Effect |
| --- | --- |
| `python3 docs/notes/check_prompts.py docs/notes/prompts-final` | Mechanical checks: weekday/date validity, non-fixture addresses, banned words, required sections, artboard names |
| `python3 docs/notes/build_manifest.py prompts-final && python3 docs/notes/gen_pack_v3.py` | Rebuild the pack page (run from `docs/notes/`; writes `docs/notes/design-prompt-pack.html`), then republish |
| `python3 tools/export-render/verify_export.py <prompt-id>` | Verify a screen export: its shape (bundle, package or check index only), names vs ARTBOARDS, order; decodes the pages to `docs/design/exports/<id>/pages/` with a `pages.json`; writes `verify.json` |
| `node tools/export-render/render-frames.mjs <pages.json> <out> [scale]` | Render those pages one PNG per artboard, clipped to the frame and named by manifest name |
| `node tools/export-render/render.mjs <pagesDir> <pages.json> <out>` | Render the Foundations board exports (1440-wide pages) to one PNG per artboard |
| `node tools/export-render/render-designs.mjs <index.json> <out>` | Render flat standalone design HTML to PNG |
| `python3 tools/export-render/package.py docs/design/exports` | Rebuild the attach set (component PNGs + board PDFs under 16 MB) |
| `python3 tools/export-render/make_attachments.py` | Rebuild the send kit. Non-destructive since 22 Sep: it keeps RUNBOOK.md, BOT-BRIEF.md and the 52 `existing-screen/` before images, which have no generator |

Derived and gitignored: `docs/design/send-kit/` (except the hand-written RUNBOOK.md, BOT-BRIEF.md and the
`existing-screen/` images, which exist nowhere else), `docs/design/exports/*/png/`, `docs/design/exports/*/pages/`,
`docs/design/exports/attach/`, `docs/design/existing-screens/`.

---

## 5. How to verify a screen the bot exports

This caught nothing on screen 1 and six drawing defects on f1-your-places:

1. The export lands at `docs/design/exports/<prompt-id>/<prompt-id>.html`. A full export is a **bundle**: a
   `<script type="__bundler/manifest">` JSON of gzip+base64 resources, one page per artboard, plus
   `__bundler/page_order`. Each page is itself a small bundle that unpacks in the browser. A few-KB file with a
   check table and an "Artboards" list is Claude Design's **check index**, not the export: ask for the full one.
2. `python3 tools/export-render/verify_export.py <id>` decodes it, compares each page's canvas title and visible
   label with the `ARTBOARDS` manifest in `docs/notes/prompts-final/<id>.md`, and reports missing, extra and order.
   When the counts agree, it names every page by manifest order, so descriptive canvas titles are no obstacle.
3. `node tools/export-render/render-frames.mjs docs/design/exports/<id>/pages/pages.json <out> 2` renders every
   frame. Look at all of them, not a sample: fixtures, provenance marks, scope chips, no percentages or completion
   fractions, honest empty and failure states, dates that do not break mid-date, dark-mode edges.
4. Audit the markup (the decoded pages and their `.txt` text): token colours only, the house type scale, the COPY
   strings, 44pt targets, accessibility labels. Record the result in `docs/design/exports/VERIFICATION.md`.

---

## 6. Decisions already settled (do not reopen)

Recorded in `docs/design/foundations/README.md`. The load-bearing ones:

- **Card radius `radius-2xl`** for every card, row card and sheet. Board specimen containers stay at `radius lg`.
- **Tokens were AA-corrected**: `text-secondary` `#4e5563`, `text-muted` `#5f6775`, error `#a81a1a`,
  warning `#9a4a08`, success `#047857`. **Three themes**: Light, Dark, Dark · iOS. Read the token, never a hex.
  Only white-on-`primary.600` still fails (4.10:1), so buttons and links use `primary.700` (5.93:1).
- **Warning `#fbbf24`** on dark surfaces only.
- **Reminder leads 60/30/7/1**; the lease fixture reminder is 30 days → Sat 30 Jan 2027.
- **Passed lead**: never-chosen = ordinary disabled with a written reason; chosen-then-passed keeps fill and border,
  drops the check, and writes "passed".
- **Notification ask**: inline after the first "That's my day", straight to the OS dialog; the primer sheet is only
  for indirect entries.
- **Destructive**: no red fill or red text; hue on glyph and border.
- **Push copy**: sentence case. **Skeletons**: nothing under 1s, 1–10s, static after four passes.
- **Overlaps with shipped components**: publish alongside and cross-reference; never rename or edit the shipped one.
  The Foundations version governs whatever the pack draws or changes.
- **The founder chose to skip** the whole-pack consistency pass (`docs/notes/workflow_c2b_consistency.js` is written
  but never run). So the last round of per-prompt fixes was never re-verified, and cross-prompt wording was never
  reconciled. On a conflict: house style first, then the Foundations boards.

---

## 7. Open items

1. **19 Extend prompts have no "before" image** — the post-wedge surfaces (`/start` funnel, Place dashboard sections,
   compare card, widgets, founding meter, keeper, bill provenance/trend). Options: capture from the live app (most
   accurate, needs runtime setup), export from the founder's newer design projects, or let Claude Design redraw from
   the prompt's description. Not blocking.
2. **`tools/design-system` has no passthrough** for hand-authored cards. A rebuild does NOT delete the 36 Foundations
   cards (the publish plan lists only its own 110 generated files and has no deletion logic), but it DOES overwrite
   `project/design-system.json`, which can drop the `foundations-00*.md` section links and the "Data instruments"
   group ordering. That tool is another session's uncommitted work — ask before touching it.
3. **00c and 00d handed back specs only**, not their published card files. 00a and 00b included them. Pull the 40
   files from the artifact with `Artifact` `read_file` if a complete repo mirror is wanted.
4. **00a's open questions**: decline wording ("Keep them private to me" vs "Just me"), whether a deadline chip leads
   with the count or the date, and `FreshnessLine` precedence when offline + stale + refreshing collide (that one
   belongs in code).
5. **Board contrast tables read low** — every figure printed on boards 00a–00d was measured against the pre-correction
   palette. The cards name tokens, so published components are fine; only the drawings disagree.
6. **The journeys are long** (6k–13k words each). Optional: split each into a setup message plus one message per turn,
   as was done for the Foundations.
7. **Core loop, still to do:** export the six index-only screens in full, redraw the provisional hosts, re-export those
   four pages (BOT-BRIEF.md, "Once, in the core-loop project"), then verify all six.
8. **Session 2 extras:** the house-style addendum (before `f1-claim-receipt`) and the fix pass on f1-your-places and
   f1-add-place-sheet (after the last session-2 prompt), both as exact text in BOT-BRIEF.md.
9. **Notification settings:** ruling recorded and prompt updated (Version 9); the export still has to be redone.
10. **Away-from-home Today** (founder's 100-mile idea): recorded as design pending in the foundations README; no prompt
    yet.
11. **Place count and saved places across the fixtures** (Jordan one place vs five; Maya's saved places): the skipped
    consistency pass; the journeys flag it. See the foundations README.

---

## 8. Gotchas learned the hard way

- **Claude Design exports**: PDF fails over 16 MB — export HTML and render it with `tools/export-render`.
- **Its HTML export is a bundle**, not a plain page (see §5).
- **Cards do not need a `bundle.js` entry**: self-contained previews with a `@dsCard` marker render fine.
- **Instruction density hurts**: keep a prompt under ~4.5k words and about 6 artboards per turn. That is why the
  Foundations boards were split into a setup prompt plus one per component.
- **Vague style words drift** the model to cream/serif defaults; the house style therefore names fonts, radii,
  spacing and elevation concretely.
- **`resumeFromRunId`** on a concurrent workflow pipeline re-runs most agents (the cache is prefix-only). Recover by
  reading `journal.jsonl` and re-running only what failed.
- **Workflow fix steps that rename or split prompts** can silently drop the new ids — merge by the union of ids and
  diff the id set. That bug lost two prompts (`00b-01b`, `00b-02b`) until they were recovered from the journal.
- **The check index is not the export.** Claude Design writes a few-KB index with a check table that links
  per-artboard files; saving only that index leaves nothing to verify. See §5.
- **Board titles can drift from the manifest** (f1-your-places used "Your places · iOS"). Map by order; never rename
  on the canvas.
- **The canvas holds tokens only**: no component API and no logo asset. Attach anything that must appear as-is.
- **Diff the 3 MB pack page with `diff`, not Python's difflib**, which is quadratic and never finishes.
- **Before republishing the pack**, `Artifact read` saves the live page to a file: `diff` it against the last local
  build to make sure nobody published in between.
- **zsh**: `echo =====` fails; use `echo '---'`.
- Session/usage limits were hit three times. Everything is written to disk for exactly that reason.

---

## 9. Memory

`~/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/` — the index is `MEMORY.md`.
This programme's entry: `screen-inventory-first-person-loop.md`. Related: `pantopus-design-system-artifact.md`,
`pantopus-product-context.md`, `pantopus-wedge-strategy.md`, `design-doc-review-2026-09-15-in-progress.md`.

---

## 10. What the next session should do

1. Read this file, then `docs/design/foundations/README.md` for decisions and rulings, then
   `docs/design/exports/VERIFICATION.md` for what has been verified.
2. As the bot exports each screen, verify it (§5), add it to VERIFICATION.md and report: artboards matched, anything
   missing, and whether the substance holds. When the six core-loop exports arrive in full, verify them too.
3. Answer questions the bot escalates, using §6 and the contract. Record any new decision in
   `docs/design/foundations/README.md` and in the session log.
4. If a prompt turns out to be wrong, fix `docs/notes/prompts-final/<id>.md`, rebuild the page and republish to the
   same URL, so the pack and the repo never diverge.

---

## Build plan (24 Sep 2026)

**[`docs/first-person-loop-build-plan-2026-09-24.md`](../first-person-loop-build-plan-2026-09-24.md)** maps every
design to its feature slice, the backend work it waits on, the exact files it changes on web/iOS/Android (all
resolved against `origin/master` `630bc49b5`), its design-verification status, and the escalations the coordinator
must decide (new tables, permission/security policy, retention). It is a map, not a tracker: progress stays in
`NEXT_STEPS.md` and the stream status files. Regenerate its Appendix A with `tools/export-render/gen_build_plan.py`.

Findings recorded there: F1–F12 backend is essentially unbuilt on master; the F9 hygiene items are still open in
source (the `effective_*` coordinate leak at `backend/services/feedService.js:199`, founding fail-open at
`backend/routes/public.js:557`, the ungated Earn row, the seeder engagement prompt); all 59 screens and 14 journeys
are exported, 17 verified.
