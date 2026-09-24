export const meta = {
  name: 'pantopus-foundations-split',
  description: 'Split each Foundations board into a setup prompt plus one prompt per component (research: bounded instructions per turn), resolve open issues, verify and fix',
  phases: [
    { title: 'Split', detail: 'One splitter per board' },
    { title: 'Verify', detail: 'Groups of 3 prompts, fidelity + quality' },
    { title: 'Fix', detail: 'Apply findings, re-verify once' },
  ],
}
const ROOT = '/Users/yingpengwang/skinny-pantopus'
const N = `${ROOT}/docs/notes`
const BOARDS = [
  { id: '00a', comps: ['ProvenanceMark', 'SourceCaption', 'ScopeChip', 'FreshnessLine', 'OfflineNotice', 'StatusChip', 'KindGlyph', 'AddressChip', 'ChoiceChip'] },
  { id: '00b', comps: ['ScaleStrip', 'AqiBand', 'FourteenDayStrip', 'YearBand', 'SlotMeter', 'PublicPointMap', 'FactCount'] },
  { id: '00c', comps: ['DateRow', 'FactRow', 'FirstWeekRow', 'BillRow', 'MemberRow', 'InviteRow', 'NotificationRow', 'TextActionRow', 'LockedActionRow', 'GrantLimitList', 'InlineErrorRow', 'ThumbnailRail'] },
  { id: '00d', comps: ['QuietDayReceipt', 'WarmingSkeleton', 'InlineUndo', 'DestructiveConfirm', 'LandingBannerSlot', 'NotificationAsk', 'PushCopy', 'ReminderLeadControl'] },
]
const SRC = (b) => `SOURCES:
- ${N}/prompts-v2/${b.id}.md: the current full board prompt. It is thorough but far too long for one send.
- ${N}/foundation-issues/${b.id}.md: open review issues that must be resolved.
- ${N}/component-contract.json and ${N}/component-contract.md: the source of truth.
- ${N}/house-style-v2.txt: pasted first in every project.
- ${N}/ux-research-brief.md, sections 4, 5 and 6.
- ${N}/research-findings.md: grep "claude-design-prompting" for the evidence on instruction density. Accuracy falls as instruction count rises, with a bias toward early instructions. Stitch drops components above 5,000 characters. Figma: "More context isn't always better."`

const SPLIT = {
  type: 'object',
  properties: {
    setup: { type: 'object', properties: { id: { type: 'string' }, promptText: { type: 'string' } }, required: ['id', 'promptText'] },
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'e.g. 00a-01' },
          component: { type: 'string' },
          artboards: { type: 'array', items: { type: 'string' } },
          promptText: { type: 'string' },
        },
        required: ['id', 'component', 'artboards', 'promptText'],
      },
    },
    resolved: { type: 'array', items: { type: 'string' }, description: 'How each open issue was resolved' },
  },
  required: ['setup', 'components', 'resolved'],
}
const VERD = {
  type: 'object',
  properties: { verdicts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, pass: { type: 'boolean' }, issues: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'issue', 'evidence', 'fix'] } } }, required: ['id', 'pass', 'issues'] } } },
  required: ['verdicts'],
}
const FIXED = {
  type: 'object',
  properties: { prompts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, promptText: { type: 'string' } }, required: ['id', 'promptText'] } } },
  required: ['prompts'],
}
const render = (ps) => ps.map(p => `===== ${p.id}${p.component ? ' (' + p.component + ')' : ' (board setup)'} =====\n${p.promptText}`).join('\n\n')

phase('Split')
const splits = await parallel(BOARDS.map(b => () => agent(
`Restructure Foundations board ${b.id} for Claude Design. The founder creates ONE Claude Design project for this board. They paste the house style, then send the SETUP prompt, then send ONE COMPONENT PROMPT per turn, in order, typing "continue" between artboard batches. Claude Design keeps the conversation inside the project, so later turns can refer to "the board rules from the setup message". Nothing may depend on any other project.

${SRC(b)}

Produce:
1. SETUP (id "${b.id}-00"). Explain what the board is for and the publish step (the founder adds each accepted component to the Pantopus design system under its exact name). Include only the board rules that apply to EVERY component: artboard format and naming, callout style, units, token mapping for dark mode, the contrast numbers table, cell-label grammar (B18-style keys), and the Notes artboard. Keep it tight, with no component specifics. Target 1,200-2,200 words. End with: "Reply 'ready' and wait for the first component."
2. One COMPONENT prompt per component, in this order: ${b.comps.join(', ')}. Ids are ${b.id}-01, ${b.id}-02, and so on. Each one carries that component's COMPLETE specification from the current board prompt and the contract: purpose, used-in, anatomy with sizes and tokens, the full variant × state grid, dark, AX5/200%, greyscale, accessibility, copy with fixture strings, platforms, in-context crops, INSTEAD OF lines, DONE WHEN, and its own ARTBOARDS list (exact names) plus a BATCH PLAN of at most 6 artboards per turn. Target 900-2,800 words each. Drop nothing that is specific to that component. Open with: "Component ${b.id}-NN: <Name>. Follow the board rules from the setup message."
3. RESOLVE every open issue in foundation-issues/${b.id}.md, applying it in the right prompt. List how you resolved each one.

Keep names exactly as in the contract. Never introduce a name the contract does not have.`,
  { label: `split:${b.id}`, phase: 'Split', schema: SPLIT, effort: 'high' }
)))

const units = []
splits.forEach((s, i) => {
  if (!s) return
  const b = BOARDS[i]
  const all = [{ ...s.setup, component: null }, ...s.components]
  for (let k = 0; k < all.length; k += 3) units.push({ board: b, prompts: all.slice(k, k + 3) })
})
log(`Split into ${splits.filter(Boolean).reduce((n, s) => n + 1 + s.components.length, 0)} prompts; ${units.length} verify groups`)

const verify = (u, r) => agent(
`You are an adversarial reviewer for Pantopus Foundations prompts sent to Claude Design. Check each prompt below on two lenses:
(A) FIDELITY. Against component-contract.json, check the exact name, anatomy, EVERY variant and state, accessibility, copy rules, platform notes, doNot and usedIn. Also check the house-style invariants and brief sections 4-6. For a setup prompt, check that the board rules are complete, consistent and free of component specifics.
(B) QUALITY. Check that it is literal and unambiguous, has no internal contradictions, has no contradictions with the house style or the setup rules, uses exact artboard names, has a batch plan of 6 or fewer, contains no placeholders, is drawable (geometry adds up), and is the right size for one send.
pass=true only if there are no blocker or major issues.

${SRC(u.board)}

PROMPTS (round ${r}):
${render(u.prompts)}`,
  { label: `verify:${u.prompts[0].id}${r > 1 ? ':r2' : ''}`, phase: 'Verify', schema: VERD, effort: 'high' })

const results = await pipeline(units, async (u) => {
  let ps = u.prompts
  for (let r = 1; r <= 2; r++) {
    const v = await verify({ ...u, prompts: ps }, r)
    const bad = v ? v.verdicts.filter(x => !x.pass || x.issues.some(i => i.severity === 'blocker' || i.severity === 'major')) : []
    if (!bad.length) return { prompts: ps, clean: true }
    const fx = await agent(
`Revise these Foundations prompts. Apply every blocker and major issue, plus the minor ones that don't conflict. Keep all substance. Return every prompt in the group.

${SRC(u.board)}

ISSUES:
${v.verdicts.map(x => `--- ${x.id}\n${x.issues.map(i => `[${i.severity}] ${i.issue}\n  evidence: ${i.evidence}\n  fix: ${i.fix}`).join('\n')}`).join('\n')}

PROMPTS:
${render(ps)}`,
      { label: `fix:${ps[0].id}${r > 1 ? ':r2' : ''}`, phase: 'Fix', schema: FIXED, effort: 'high' })
    if (fx && fx.prompts) {
      const by = Object.fromEntries(fx.prompts.map(x => [x.id, x.promptText]))
      ps = ps.map(p => by[p.id] ? { ...p, promptText: by[p.id] } : p)
    }
  }
  return { prompts: ps, clean: false }
})
const out = results.filter(Boolean)
log(`Foundations v3: ${out.flatMap(o => o.prompts).length} prompts · clean groups ${out.filter(o => o.clean).length}/${units.length}`)
return { splits, groups: out }
