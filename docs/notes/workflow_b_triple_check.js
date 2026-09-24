export const meta = {
  name: 'pantopus-prompt-triple-check',
  description: 'Rewrite all 59 Claude Design prompts against research, component contract and flows, then verify each twice (substance, UX quality) and fix until clean',
  phases: [
    { title: 'Rewrite', detail: 'Audit + rewrite each batch against every source' },
    { title: 'Verify', detail: 'Two independent verifiers per batch: substance preservation, UX quality' },
    { title: 'Fix', detail: 'Apply verifier findings; re-verify once' },
  ],
}

const ROOT = '/Users/yingpengwang/skinny-pantopus'
const N = `${ROOT}/docs/notes`

const BATCHES = [
  ['f9-privacy-mirror', 'f9-curator-chip', 'f9-earn-removal'],
  ['f9-verification-promise-copy', 'f9-founding-meter-preview', 'f8-positioning-copy'],
  ['x-provenance-sheet'],
  ['x-date-sheet'],
  ['x-place-file'],
  ['f1-your-places', 'f1-add-place-sheet', 'f1-save-confirmation', 'f1-email-verify-handoff'],
  ['f1-today-tab', 'f5-today-calendar-strip'],
  ['f4-today-pickup-card', 'f1-today-air-band', 'f4-briefing-optin-card'],
  ['f4-notification-primer', 'f4-notification-settings', 'f1-claim-receipt'],
  ['f6-home-basics-rows', 'f6-place-section-details'],
  ['f3-members-roster', 'f3-invite-composer', 'f3-invite-banner'],
  ['f3b-invitation-decision', 'f3b-verify-address-sheet', 'f3b-owner-attestation', 'f3b-locked-action-row'],
  ['f3-household-block', 'f3-member-home-dashboard', 'f3-household-calendar'],
  ['f3-bill-detail-web', 'f3-bills-list', 'f3-household-notifications'],
  ['f8-scale-strips', 'f8-compare-sheet'],
  ['f8-compare-arrival-header', 'f8-compare-reveal', 'f8-og-compare-card'],
  ['f8-native-share-compare', 'f8-seasonal-aha'],
  ['f7-today-widget', 'f7-widget-tap-landing', 'f7-widget-gallery', 'f7-widget-howto-sheet'],
  ['f9-nearby-cells-map', 'f9-block-founders-panel', 'f9-invite-rewards-card'],
  ['f10-mail-day-triage', 'f10-snap-capture-tray', 'f10-extraction-confirm'],
  ['f10-mail-piece-photo', 'f10-bill-provenance', 'f10-bill-trend', 'f10-mail-snap-privacy'],
  ['f11-keeper-strip', 'f11-keeper-naming'],
]

const SOURCES = (ids) => `SOURCES — read all of these before writing (they are on disk):
1. ${N}/house-style-v2.txt — the shared block pasted once at the top of every Claude Design session. Do not repeat it inside prompts.
2. ${N}/ux-research-brief.md — the research brief. Apply every principle that governs these surfaces.
3. ${N}/per-surface-changes/<id>.md for each id — research-backed changes this surface must adopt.
4. ${N}/component-contract.md — the shared components, designed first on a Foundations board (prompt 00). Refer to them by EXACT name; describe only how this surface uses them; never redefine their anatomy differently.
5. ${N}/flows-spec.md — the journeys. Make sure what this surface receives from the previous step and hands to the next matches the flow.
6. ${N}/prompts-v1/<id>.md — the current prompt.
7. ${N}/inventory-entries/<id>.json — the canonical inventory entry (purpose, contents, visualization, states, entry points, uxNote).
8. ${N}/derive-proposals.md — the 90 pre-merge proposals. Search it for the feature(s) and for every proposal this surface absorbed (see the MERGES section of ${N}/FINAL-screen-inventory.md). Detail there may have been dropped in v1.
9. ${N}/critique-findings.md — search for these ids and for the themes they touch.
10. ${ROOT}/docs/first-person-loop-design-2026-09-16.md — the design doc section for this feature (exact copy strings, acceptance criteria, honesty rules, notification rules).
11. ${N}/design-tokens.md and ${N}/map-findings-structural.md as needed.
12. ${N}/research-findings.md — the full evidence behind the brief (large; grep it for these surface ids and for the topics they touch rather than reading it whole).
13. ${N}/house-style-contradictions.md — research findings about the prompting method itself.
Surface ids in this batch: ${ids.join(', ')}`

const V2_TEMPLATE = `V2 PROMPT STRUCTURE. Use these headed sections in this order, as plain text:
SCREEN: name · id
TYPE: NEW, or EXTENSION of the existing designed screen "<name>". For an extension, write: "This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed."
ATTACH: the screenshots the founder must attach to this project (host screens, neighbouring states), or "none".
PLATFORMS & VIEWPORTS
WHERE IT LIVES & HOW PEOPLE ARRIVE: the tab, the parent screen, and every entry point (nav, CTA, push, widget, deep link URL). Include what the previous step hands over, per flows-spec.
WHO AND WHEN: a real person and moment built from the house style fixtures (Maya Chen at HOME A, someone new at PLACE B, Dana as FRIEND C)
THE ONE JOB: one sentence
FIRST FIVE SECONDS: what the eye hits first, second and third, and the single primary action
CONTENT: exact copy strings from the doc and inventory. Use the house style FIXTURES and list only the deltas this surface needs. Include the worst realistic case.
LAYOUT & VISUALIZATION: the specific layout, the chart/strip/mark encodings and what each part means, and what it degrades to when data is missing
INTERACTION, MOTION & HAPTICS: taps, gestures and their non-gesture alternatives, transitions, Reduce Motion behaviour, and native haptics
FOUNDATIONS COMPONENTS USED: exact contract names, and any variant specific to this surface
ACCESSIBILITY: reading order, spoken labels for non-text elements, target sizes, non-colour encodings, and the text alternative for any chart
COPY: every user-facing string on the surface, in sentence case, with verb-led buttons, and errors that say what happened and what to do
EDGE CASES: the longest address, the largest numbers, many items, zero items, a slow network, and the tier/permission variants
INSTEAD OF: 3-8 lines, each "Instead of <the likely wrong design>, draw <the right one> — because <reason>."
DONE WHEN: how to tell the design is right, from the doc's acceptance criteria and the flow's moment of truth
ARTBOARDS: a numbered manifest in priority order. Each line has the exact artboard name "<surface-id> · <ios|android|web-390|web-1440> · <NN-state> · <light|dark>" and one line saying what that frame shows. It must include: the dense default first; the layout-changing states; empty/loading/error/offline; the platform variants; one AX5 (iOS) or 200% (Android) frame; one greyscale frame; the dark twins, named explicitly (by default the dense frame plus one state frame); and a final "Notes" artboard.
BATCH PLAN: the manifest split into turns of at most 6 artboards ("Turn 1: 1-6 ... then wait for continue").`

const RULES = `NON-NEGOTIABLE RULES
- Substance is sacred. Every fact, copy string, state, entry point, visualization decision, honesty rule and piece of reasoning in v1, the inventory entry, the absorbed derive proposals, the critique findings for this id and the doc section must survive — unless the synthesis explicitly merged it into another surface (then say where it went in one line). When in doubt, keep it and use progressive disclosure (summary first, detail one tap away) rather than deleting it.
- Easiest to understand beats clever. Plain language, grade 6-8 reading level, one primary action per view, no jargon the user did not bring (no "T1", "geohash", "provenance" as UI words unless the contract's glossary allows it).
- Consistency beats local optimisation: use the component contract's exact names and the glossary's canonical terms.
- Honesty rules are product rules: unverified looks unverified; Only you vs your household is always stated; never a claim about a neighbour's home; silence is a designed state; sources shown.
- Locked decisions: four tabs Place · Today · Nearby · Mail (no fifth tab, no FAB); density gates status not access; cash Earn hidden; address-verified vs household-verified split.
- No placeholders, no lorem, no "[name]". Use the house style FIXTURES exactly: TODAY Mon 19 Oct 2026, HOME A 2418 NE Larkspur Loop (Maya Chen, Sam Ortega), PLACE B 1107 NE Birchfield Ct, FRIEND C Dana, and the listed readings, bills, dates and civic deadlines. Do not invent a different address, person or reading when a fixture exists. Add only surface-specific deltas, and tell Claude Design to list every invented string on the Notes artboard.
- Follow the research on prompting Claude Design: it follows instructions literally and does not carry an instruction from one frame to the next. Scope every instruction explicitly. Say what to draw instead of only what not to draw. Never leave a blanket instruction for Claude Design to generalise.
- Claude Design has no repo access: never cite file paths or code identifiers inside the prompt text unless they are user-visible (URLs of deep links are fine).
- Length follows substance: typically 600-1300 words. Dense, imperative, second person. No preamble sentences.
- Open every prompt with: "Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name." Each surface is its own Claude Design project: the house style is pasted first, then this prompt.`

const PROMPT_SCHEMA = {
  type: 'object',
  properties: {
    prompts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          platforms: { type: 'array', items: { type: 'string' } },
          isNew: { type: 'boolean' },
          frameCount: { type: 'number' },
          promptText: { type: 'string' },
          changeLog: { type: 'array', items: { type: 'string' }, description: 'What changed from v1 and why (source)' },
        },
        required: ['id', 'name', 'platforms', 'isNew', 'frameCount', 'promptText', 'changeLog'],
      },
    },
  },
  required: ['prompts'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          pass: { type: 'boolean' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                severity: { type: 'string', description: 'blocker | major | minor' },
                issue: { type: 'string' },
                evidence: { type: 'string', description: 'Quote the source that proves it (file + text)' },
                fix: { type: 'string', description: 'Exact change to make' },
              },
              required: ['severity', 'issue', 'evidence', 'fix'],
            },
          },
        },
        required: ['id', 'pass', 'issues'],
      },
    },
  },
  required: ['verdicts'],
}

const render = (ps) => ps.map(p => `===== PROMPT ${p.id} (${p.name}) =====\nplatforms: ${p.platforms.join('/')} · isNew: ${p.isNew} · frames: ${p.frameCount}\n\n${p.promptText}`).join('\n\n')

const verifySubstance = (ps, ids, round) => agent(
`You are an adversarial editor whose only job is to catch LOST or DISTORTED substance. You assume the rewrite dropped something until you prove otherwise.

${SOURCES(ids)}

For each prompt below, list every fact, exact copy string, state, entry point, platform, visualization decision, honesty rule, notification rule, acceptance criterion or piece of design reasoning that appears in the sources for that surface but is missing, weakened or changed in the prompt. Check exact copy strings against the design doc character by character where the doc gives them. Check that anything the synthesis merged elsewhere is acknowledged. Check that nothing factually wrong about the product was introduced (e.g. a fifth tab, a claim to know voter registration status, cash Earn shown to someone who never earned, household data shown to non-members).

pass=true only if there are no blocker or major issues. minor = cosmetic. Quote evidence for every issue.

PROMPTS (round ${round}):
${render(ps)}`,
  { label: `verify-substance:${ids[0]}${round > 1 ? ':r2' : ''}`, phase: 'Verify', schema: VERDICT_SCHEMA, effort: 'high' })

const verifyUX = (ps, ids, round) => agent(
`You are a principal product designer and a senior prompt engineer for AI design tools, reviewing Claude Design prompts. Your bar: the resulting screens must be the easiest to understand, onboard and use of any app in their category — and the prompt must reliably produce that from Claude Design in a fresh session.

${SOURCES(ids)}

Check each prompt for:
1. Clarity for a first-time user: a five-second read tells them where they are and what to do; one primary action; plain language; no internal jargon; progressive disclosure instead of walls of text.
2. Research compliance: every applicable principle in the brief and every per-surface change is applied (name any that are not).
3. Component contract compliance: exact names; no conflicting redefinition; the glossary's canonical terms; nothing drawn ad hoc that the contract already defines.
4. Flow compliance: the handoff in and out matches flows-spec.md.
5. Accessibility: reading order, labels for non-text elements, 44pt/48dp targets, non-colour encodings, large-text frame, reduced motion, chart text alternatives.
6. Platform correctness: iOS HIG and Material 3 patterns where native; web responsive at 390 and 1440.
7. Visualization quality: the encoding is specific, honest, legible at size, degrades gracefully, and the unverified treatment is the contract's.
8. Prompt effectiveness: follows the v2 structure; frames numbered with artboard names and hero first; no placeholders; no contradictions inside the prompt or with the house style; not bloated with repetition; nothing Claude Design cannot act on (file paths, code names).
9. Antipatterns: dark patterns, guilt, fake urgency, percentage-complete, confetti, destructive confirm dialogs where Undo fits, spinners where skeletons fit.

pass=true only if there are no blocker or major issues. Quote evidence for every issue and give an exact fix.

${V2_TEMPLATE}

PROMPTS (round ${round}):
${render(ps)}`,
  { label: `verify-ux:${ids[0]}${round > 1 ? ':r2' : ''}`, phase: 'Verify', schema: VERDICT_SCHEMA, effort: 'high' })

const fix = (ps, verdicts, ids, round) => agent(
`You are the lead designer revising Claude Design prompts after review. Apply EVERY blocker and major issue below, and every minor issue that does not conflict with another. Keep all existing substance. Return the complete revised prompts (all of them in this batch, including ones that passed — unchanged if they had no issues).

${SOURCES(ids)}

${V2_TEMPLATE}

${RULES}

REVIEW FINDINGS:
${verdicts.map(v => `--- ${v.id} (pass=${v.pass})\n${v.issues.map(i => `[${i.severity}] ${i.issue}\n  evidence: ${i.evidence}\n  fix: ${i.fix}`).join('\n')}`).join('\n')}

PROMPTS TO REVISE (round ${round}):
${render(ps)}`,
  { label: `fix:${ids[0]}${round > 1 ? ':r2' : ''}`, phase: 'Fix', schema: PROMPT_SCHEMA, effort: 'high' })

const failing = (vs) => vs.filter(v => !v.pass || v.issues.some(i => i.severity === 'blocker' || i.severity === 'major'))

const results = await pipeline(
  BATCHES,
  (ids) => agent(
`You are the world's best product designer, rewriting Claude Design prompts for Pantopus. First AUDIT each v1 prompt against every source below (list for yourself what is missing, wrong, unclear, inconsistent or not research-backed), then write the v2 prompt.

${SOURCES(ids)}

${V2_TEMPLATE}

${RULES}

Return one v2 prompt per id: ${ids.join(', ')}. In changeLog, list each substantive change and the source that drove it.`,
    { label: `rewrite:${ids[0]}`, phase: 'Rewrite', schema: PROMPT_SCHEMA, effort: 'high' }),

  async (rw, ids) => {
    if (!rw || !rw.prompts || !rw.prompts.length) return null
    let ps = rw.prompts
    const history = []
    for (let round = 1; round <= 2; round++) {
      const [a, b] = await Promise.all([verifySubstance(ps, ids, round), verifyUX(ps, ids, round)])
      const vs = [...(a ? a.verdicts : []), ...(b ? b.verdicts : [])].map(v => ({ ...v, lens: undefined }))
      history.push({ round, substance: a ? a.verdicts : null, ux: b ? b.verdicts : null })
      const bad = failing(vs)
      if (!bad.length) return { ids, prompts: ps, history, clean: true }
      const merged = ids.map(id => ({
        id,
        pass: !bad.some(v => v.id === id),
        issues: vs.filter(v => v.id === id).flatMap(v => v.issues),
      }))
      const fx = await fix(ps, merged, ids, round)
      if (fx && fx.prompts && fx.prompts.length) {
        const byId = Object.fromEntries(fx.prompts.map(x => [x.id, x]))
        ps = ps.map(x => byId[x.id] || x)
      }
    }
    return { ids, prompts: ps, history, clean: false }
  },
)

const done = results.filter(Boolean)
const prompts = done.flatMap(r => r.prompts)
const unclean = done.filter(r => !r.clean).map(r => r.ids.join(','))
log(`v2 prompts: ${prompts.length}/59 · batches clean after verify: ${done.filter(r => r.clean).length}/${BATCHES.length}${unclean.length ? ' · fixed but not re-verified clean: ' + unclean.join(' | ') : ''}`)
return { prompts, batches: done }
