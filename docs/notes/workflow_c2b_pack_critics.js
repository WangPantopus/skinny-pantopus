export const meta = {
  name: 'pantopus-pack-critics',
  description: 'Five cross-pack critics (x2 halves) over all 77 prompts, then grouped fixes with a no-loss verifier',
  phases: [
    { title: 'Critique', detail: '5 dimensions x 2 halves of the pack' },
    { title: 'Fix', detail: 'Grouped by prompt id' },
    { title: 'Confirm', detail: 'Fixes applied, nothing lost' },
  ],
}

const ROOT = '/Users/yingpengwang/skinny-pantopus'
const N = `${ROOT}/docs/notes`
const ALL = args.ids            // every prompt id in pack order (00a..00d, 59 surfaces, 14 flows)
const half = Math.ceil(ALL.length / 2)
const HALVES = [ALL.slice(0, half), ALL.slice(half)]

const CTX = `PACK FILES: ${N}/prompts-v2/<id>.md (one per prompt). House style: ${N}/house-style-v2.txt. Component contract: ${N}/component-contract.md. Research brief: ${N}/ux-research-brief.md. Flows: ${N}/flows-spec.md. Inventory: ${N}/inventory-entries/<id>.json and ${N}/FINAL-screen-inventory.md. Design doc: ${ROOT}/docs/first-person-loop-design-2026-09-16.md. Mechanical check results: ${N}/check-report.json (weekday errors, non-fixture addresses, banned-word hits with context, missing sections, artboard-name problems; judge each hit, since many banned-word hits are legitimate inside INSTEAD OF lines). The fixtures: HOME A 2418 NE Larkspur Loop (Maya Chen owner, Sam Ortega member, Priya pending), PLACE B 1107 NE Birchfield Ct (Jordan Lee, T1), FRIEND C Dana. TODAY is Mon 19 Oct 2026. Property tax is due Mon 2 Nov.`

const ISSUES = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          promptId: { type: 'string' },
          severity: { type: 'string', description: 'blocker | major | minor' },
          issue: { type: 'string' },
          evidence: { type: 'string', description: 'Quote both sides when it is an inconsistency, with their prompt ids' },
          fix: { type: 'string', description: 'The exact replacement text or change' },
        },
        required: ['promptId', 'severity', 'issue', 'evidence', 'fix'],
      },
    },
    weakest: { type: 'array', items: { type: 'string' }, description: 'The prompts in your half most likely to produce a mediocre design, with the reason' },
  },
  required: ['issues', 'weakest'],
}

const DIMENSIONS = [
  { key: 'terminology-copy', brief: `TERMINOLOGY AND COPY. Check every user-facing string against the contract glossary (canonical terms, forbidden synonyms) and the brief's microcopy rules. Check that the two scope strings are exact everywhere. Check push strings against the canonical list in brief section 3: 30/40-character limits, caveat first, no amounts or house numbers. Check date formats (weekday, relative count beyond tomorrow, "must arrive by", no "midnight"). Check that voter copy is per-method and never implies registration status. Check attribution ("marked paid", "(no longer here)"), the "From Pantopus" chip, verification wording (method plus date, never a bare "Verified"), sentence case, verb-led buttons and grade 6-8 reading level. Flag any string that says the same thing differently in two prompts, and pick the canonical one.` },
  { key: 'component-usage', brief: `COMPONENT USAGE. Every shared element must be named exactly as in the contract and the Foundations prompts 00a-00d, and must never be locally redefined in a conflicting way (sizes, encodings, colours, variants). Check provenance semantics: filled = official or confirmed; hollow = on record, not confirmed (only for facts a household can confirm); tick = you added it; founding slots use solid/hatched. Check strip rules: one ink colour, not a per-cell target on native, AQI as the only coloured track. Check that undo does not expire, destructive confirms name what survives, and the landing banner precedence is respected. Flag ad-hoc elements that should be a contract component.` },
  { key: 'fixtures-facts', brief: `FIXTURES AND FACTS. Check that people, addresses, amounts, dates, weekdays, readings and deadlines match the house-style FIXTURES, and that deltas are plausible and consistent across prompts (the same invented string must be identical everywhere it appears). Judge every non-fixture address in check-report.json: allowed only where a surface genuinely needs another address (search results, a second saved place), and then it must be consistent across prompts. Check facts: FEMA/USFS/EPA/AirNow wording and scales per brief section 4, the RCW-based dates, the Washington voter deadlines, and the property tax moved to Mon 2 Nov. Flag anything that asserts knowledge Pantopus cannot have.` },
  { key: 'journeys-entry-points', brief: `JOURNEYS AND ENTRY POINTS. For every entry point, deep link, push or CTA named in a prompt, the destination prompt must handle it: a state for that arrival, a section= highlight, and the same URL. State names must agree between the surface prompts and the flow storyboards. Check the notification → landing mapping, and that no surface is homeless in the four-tab IA. Check that what one step hands over (held address, pickup confirmation, invite token, compare token, claim carry-over, widget src) is received by the next with the same copy and data. Check the no-notifications path for every push-driven moment.` },
  { key: 'coverage-craft', brief: `COVERAGE AND CRAFT. Every state and entry point in each surface's inventory entry, and each relevant acceptance criterion in the design doc, must be covered by some artboard. Every one of the 40 contract components must appear on a Foundations board or in its owner surface. Every surface prompt needs the full v2 structure (check-report missing_sections) and an ARTBOARDS manifest with exact names, an AX5/200% frame, a greyscale frame, explicitly named dark twins, a Notes artboard, and a BATCH PLAN of 6 or fewer per turn. Then judge as the world's best product designer: would these prompts produce the easiest-to-understand, easiest-to-onboard app, with the clearest visualization and no lost substance? Name the weakest prompts and exactly what would lift them.` },
]

phase('Critique')
const crit = (await parallel(DIMENSIONS.flatMap(d => HALVES.map((ids, h) => () => agent(
`You are a cross-pack critic for the Pantopus Claude Design prompt pack. Your dimension: ${d.key}.

${CTX}

${d.brief}

YOUR HALF of the pack (read EVERY one of these files completely): ${ids.join(', ')}
You may read files outside your half to check consistency, and you should, for anything shared.
Report only real issues, each with quoted evidence and an exact fix. Every issue must name the prompt id to change. If an inconsistency spans two prompts, decide the canonical version and file the fix against the prompt that deviates.`,
  { label: `critic:${d.key}:${h + 1}`, phase: 'Critique', schema: ISSUES, effort: 'high' }
))))).filter(Boolean)

const all = crit.flatMap(c => c.issues)
const weakest = crit.flatMap(c => c.weakest)
log(`Critics: ${all.length} issues (${all.filter(i => i.severity === 'blocker').length} blocker, ${all.filter(i => i.severity === 'major').length} major)`)

// group by prompt id
const byId = {}
for (const i of all) {
  if (!ALL.includes(i.promptId)) continue
  ;(byId[i.promptId] = byId[i.promptId] || []).push(i)
}
const touched = ALL.filter(id => byId[id])
const groups = []
for (let k = 0; k < touched.length; k += 3) groups.push(touched.slice(k, k + 3))
log(`Fix groups: ${groups.length} covering ${touched.length} prompts`)

const PROMPTS = {
  type: 'object',
  properties: {
    prompts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, promptText: { type: 'string' }, applied: { type: 'array', items: { type: 'string' } }, rejected: { type: 'array', items: { type: 'string' }, description: 'Issues deliberately not applied, and why' } },
        required: ['id', 'promptText', 'applied', 'rejected'],
      },
    },
  },
  required: ['prompts'],
}
const CONFIRM = {
  type: 'object',
  properties: { results: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } } }, required: ['id', 'pass', 'problems'] } } },
  required: ['results'],
}
const fmt = (ids) => ids.map(id => `--- ${id}\n${byId[id].map(i => `[${i.severity}] ${i.issue}\n  evidence: ${i.evidence}\n  fix: ${i.fix}`).join('\n')}`).join('\n')

const fixed = await pipeline(
  groups,
  (ids) => agent(
`Revise these Pantopus Claude Design prompts to resolve the cross-pack issues below. Read each current prompt from ${N}/prompts-v2/<id>.md. Apply every blocker and major issue, and the minor ones that don't conflict. If two issues conflict, follow the contract, glossary and house style, and record the rejected one with its reason. Keep ALL existing substance and the v2 structure. Return the complete revised text of each prompt.

${CTX}

ISSUES:
${fmt(ids)}`,
    { label: `fix:${ids[0]}`, phase: 'Fix', schema: PROMPTS, effort: 'high' }),
  async (fx, ids) => {
    if (!fx || !fx.prompts) return null
    const conf = await agent(
`Confirm that each revised prompt applied its issues and lost nothing. Compare each against the ORIGINAL at ${N}/prompts-v2/<id>.md. For every id, list any issue not applied without a stated reason, and any substance present in the original but missing from the revision (strings, states, artboards, reasoning). pass=true only if there are no such problems.

ISSUES:
${fmt(ids)}

REVISED:
${fx.prompts.map(p => `===== ${p.id}\n${p.promptText}`).join('\n\n')}`,
      { label: `confirm:${ids[0]}`, phase: 'Confirm', schema: CONFIRM, effort: 'high' })
    const failing = conf ? conf.results.filter(r => !r.pass) : []
    if (!failing.length) return { ids, prompts: fx.prompts, confirmed: true }
    const fx2 = await agent(
`Finish these revisions. Resolve each listed problem, restoring lost substance and applying the missed issues. Return the complete revised text of the listed prompts.

${CTX}

PROBLEMS:
${failing.map(r => `--- ${r.id}\n${r.problems.join('\n')}`).join('\n')}

ORIGINAL ISSUES:
${fmt(failing.map(r => r.id))}

CURRENT REVISIONS:
${fx.prompts.filter(p => failing.some(r => r.id === p.id)).map(p => `===== ${p.id}\n${p.promptText}`).join('\n\n')}`,
      { label: `fix2:${ids[0]}`, phase: 'Fix', schema: PROMPTS, effort: 'high' })
    const by = Object.fromEntries(((fx2 && fx2.prompts) || []).map(p => [p.id, p]))
    return { ids, prompts: fx.prompts.map(p => by[p.id] || p), confirmed: false, problems: failing }
  },
)
return { issues: all, weakest, fixed: fixed.filter(Boolean) }
