export const meta = {
  name: 'pantopus-foundations-prompts',
  description: 'Write the four Foundations board prompts (00a-00d) for Claude Design from the component contract, verify each twice, fix',
  phases: [
    { title: 'Write', detail: 'One writer per component group' },
    { title: 'Verify', detail: 'Contract fidelity and prompt quality' },
    { title: 'Fix', detail: 'Apply findings' },
  ],
}

const ROOT = '/Users/yingpengwang/skinny-pantopus'
const N = `${ROOT}/docs/notes`

const GROUPS = [
  { id: '00a', title: 'Marks, captions and chips', comps: ['ProvenanceMark', 'SourceCaption', 'ScopeChip', 'FreshnessLine', 'OfflineNotice', 'StatusChip', 'KindGlyph', 'AddressChip', 'ChoiceChip'] },
  { id: '00b', title: 'Data instruments', comps: ['ScaleStrip', 'AqiBand', 'FourteenDayStrip', 'YearBand', 'SlotMeter', 'PublicPointMap', 'FactCount'] },
  { id: '00c', title: 'Rows and lists', comps: ['DateRow', 'FactRow', 'FirstWeekRow', 'BillRow', 'MemberRow', 'InviteRow', 'NotificationRow', 'TextActionRow', 'LockedActionRow', 'GrantLimitList', 'InlineErrorRow', 'ThumbnailRail'] },
  { id: '00d', title: 'States, feedback and asks', comps: ['QuietDayReceipt', 'WarmingSkeleton', 'InlineUndo', 'DestructiveConfirm', 'LandingBannerSlot', 'NotificationAsk', 'PushCopy', 'ReminderLeadControl'] },
]

const SOURCES = `SOURCES (read before writing):
- ${N}/house-style-v2.txt: pasted at the top of every project. Do not repeat it; follow it.
- ${N}/component-contract.md and ${N}/component-contract.json: THE source of truth for names, anatomy, variants, states, accessibility, copy rules, platform notes, usage and doNot.
- ${N}/ux-research-brief.md: especially section 4 (visualization grammar), section 5 (accessibility) and section 6 (microcopy).
- ${N}/design-tokens.md: the real tokens.
- ${N}/house-style-contradictions.md: how to prompt Claude Design well.
- ${N}/surface-index.txt: the 59 surfaces that will consume these components.`

const PROMPT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    componentsCovered: { type: 'array', items: { type: 'string' } },
    artboardCount: { type: 'number' },
    promptText: { type: 'string' },
  },
  required: ['id', 'name', 'componentsCovered', 'artboardCount', 'promptText'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string' },
          issue: { type: 'string' },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'issue', 'evidence', 'fix'],
      },
    },
  },
  required: ['pass', 'issues'],
}

const writeBrief = (g) => `You are the design-systems lead writing prompt ${g.id} of the Pantopus Claude Design prompt pack: "Foundations — ${g.title}". This is the first design work sent to Claude Design, before any screen. Every later screen prompt refers to these components by exact name, and each screen is designed in a separate project with no shared memory. These specimens are therefore the ONLY way the same component comes out identical on 59 surfaces. After the founder accepts the board, they publish the components into the Pantopus design system.

${SOURCES}

COMPONENTS IN THIS PROMPT (exact names, all of them): ${g.comps.join(', ')}

Write ONE self-contained Claude Design prompt that produces a specimen board for these components. For EACH component, the prompt must specify:
- its exact name as the artboard/section title
- its purpose in one line
- anatomy with sizes (pt/dp/px) and token names, with callouts drawn on the specimen
- every variant and every state from the contract, laid out as a grid (variant × state)
- light and dark versions
- how it behaves at AX5 (iOS) and 200% (Android)
- a greyscale check
- the accessibility spec: spoken label pattern, non-colour encoding, target rule
- copy rules with real example strings from the house style FIXTURES
- iOS vs Android vs web differences, where they exist
- two or three in-context mini crops showing where it is used (name the consuming surfaces)
- INSTEAD OF lines ("Instead of X, draw Y — because Z")

The prompt must also contain:
- the opening line "Use the Pantopus house style pasted above. This project is the Foundations board: ${g.title}."
- TYPE: NEW (a component specimen board)
- ATTACH: none, or screenshots of existing components if the contract says one already exists in the shipped app
- a DONE WHEN section
- an ARTBOARDS manifest, where each line has the exact name "${g.id} · <ComponentName> · <NN-what> · <light|dark>" and a one-line description, ending with a "${g.id} · Notes" artboard
- a BATCH PLAN of at most 6 artboards per turn
- a closing PUBLISH step: "When I accept a component, add it to the Pantopus design system under this exact name."

Be exhaustive about the contract (drop nothing), concrete (numbers, tokens, strings) and literal: Claude Design follows instructions exactly and does not generalise, so scope every instruction explicitly. Length follows the substance; several thousand words is fine for this board.`

const verifyContract = (p, g) => agent(
`You are an adversarial design-systems reviewer. Check that this Foundations prompt carries the component contract with complete fidelity.

${SOURCES}

Components that must be covered: ${g.comps.join(', ')}.
For each one, compare against component-contract.json and check: the exact name; the anatomy (sizes, tokens); EVERY variant; EVERY state; the accessibility spec; the copy rules; the platform notes; the doNot rules; and the usedIn surfaces (at least the main ones shown in context). Also check against brief sections 4, 5 and 6 and the house-style invariants: filled/hollow/tick means provenance only; the AQI colour exception; 12pt marks; 3:1 graphics contrast; no per-cell targets; no timed undo; and so on.
pass=true only if nothing blocker or major is missing or wrong. Quote evidence for each issue.

PROMPT ${p.id}:
${p.promptText}`,
  { label: `verify-contract:${g.id}`, phase: 'Verify', schema: VERDICT_SCHEMA, effort: 'high' })

const verifyQuality = (p, g) => agent(
`You are a senior prompt engineer for AI design tools, and a principal designer. Review this Claude Design prompt for a component specimen board.

${SOURCES}

Check that:
- it is literal and unambiguous for Claude Design
- the artboard manifest is complete, exactly named and prioritised, with batches of 6 or fewer
- dark, AX5/200% and greyscale specimens are explicitly scoped
- nothing contradicts the house style
- nothing depends on repo access
- the examples use the fixtures, with no placeholders
- the INSTEAD OF lines say what to draw
- the board will be usable as a reference by 59 later prompts, and each specimen is identifiable by exact name
- it is not bloated with repetition that could confuse the model

pass=true only if there are no blocker or major issues.

PROMPT ${p.id}:
${p.promptText}`,
  { label: `verify-quality:${g.id}`, phase: 'Verify', schema: VERDICT_SCHEMA, effort: 'high' })

const out = await pipeline(
  GROUPS,
  (g) => agent(writeBrief(g), { label: `write:${g.id}`, phase: 'Write', schema: PROMPT_SCHEMA, effort: 'high' }),
  async (p, g) => {
    if (!p) return null
    let cur = p
    const history = []
    for (let round = 1; round <= 2; round++) {
      const [a, b] = await Promise.all([verifyContract(cur, g), verifyQuality(cur, g)])
      const issues = [...(a ? a.issues : []), ...(b ? b.issues : [])]
      history.push({ round, contract: a, quality: b })
      const bad = issues.filter(i => i.severity === 'blocker' || i.severity === 'major')
      if (!bad.length) return { prompt: cur, history, clean: true }
      const fx = await agent(
`Revise this Foundations prompt. Apply every blocker and major issue, plus the minor ones that don't conflict. Keep all existing substance. Return the full revised prompt.

${SOURCES}

ISSUES:
${issues.map(i => `[${i.severity}] ${i.issue}\n  evidence: ${i.evidence}\n  fix: ${i.fix}`).join('\n')}

PROMPT ${cur.id}:
${cur.promptText}`,
        { label: `fix:${g.id}${round > 1 ? ':r2' : ''}`, phase: 'Fix', schema: PROMPT_SCHEMA, effort: 'high' })
      if (fx && fx.promptText) cur = fx
    }
    return { prompt: cur, history, clean: false }
  },
)
const done = out.filter(Boolean)
log(`Foundations prompts: ${done.length}/4 · clean: ${done.filter(d => d.clean).length}`)
return { foundations: done }
