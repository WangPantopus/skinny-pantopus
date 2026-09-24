export const meta = {
  name: 'pantopus-flow-storyboard-prompts',
  description: 'Write 14 journey storyboard prompts for Claude Design (recast onto the house-style fixtures), verify twice, fix',
  phases: [
    { title: 'Write', detail: 'Storyboard prompts per flow batch' },
    { title: 'Verify', detail: 'Flow fidelity and prompt quality' },
    { title: 'Fix', detail: 'Apply findings' },
  ],
}

const ROOT = '/Users/yingpengwang/skinny-pantopus'
const N = `${ROOT}/docs/notes`

const BATCHES = [
  ['flow-01', 'flow-14'],
  ['flow-02', 'flow-10', 'flow-11'],
  ['flow-03', 'flow-13'],
  ['flow-04', 'flow-12'],
  ['flow-05'],
  ['flow-06', 'flow-07'],
  ['flow-08', 'flow-09'],
]

const RECAST = `RECAST TABLE. flows-spec.md was written with its own personas and addresses, and they conflict with the house-style FIXTURES. Every storyboard must use the fixtures instead:
- The new person at tier T1: Jordan Lee, 36, at PLACE B (1107 NE Birchfield Ct, Camas, WA 98607). He moved from Portland on Fri 9 Oct and saved the place on Sat 10 Oct. His City of Camas pickup day is Thursday and his frequency is Not set. Jordan is the persona for flow-01 (stranger to activated), flow-06 (claims PLACE B), flow-09 (keeper), flow-10 (air alert for his saved place; alert variant AQI 118, 4:00 PM), flow-11 (reports his pickup schedule as not right), flow-13 (voter registration after moving from Oregon), flow-14 (web saver installs the app), and the recipient in flow-05.
- The household: Maya Chen (owner/viewer) and Sam Ortega (member) at HOME A (2418 NE Larkspur Loop, Vancouver, WA 98684). Maya is the persona for flow-03 (lease: ends Wed 31 Mar 2027, notice deadline Mon 1 Mar 2027, reminder Mon 15 Feb 2027), flow-04 (invites Priya Raman, priya@example.com, whose invite expires Mon 26 Oct; Priya accepts, is household-verified, taps a locked action, and Maya confirms she lives there), flow-07 (widget), flow-08 (snaps the Clark Public Utilities bill, $142.18, due Fri 23 Oct; marks it paid; Sam sees it), and flow-12 (Priya's invite dies after the permission change and Maya reissues it). flow-02 (the weekly pickup loop) follows Maya's confirmed Tuesday pickup (recycling every other week, next Tue 20 Oct, carts out by 6:30 AM) AND Jordan's unconfirmed Thursday.
- For the holiday move in flow-02, use Jordan's Thursday: Thanksgiving is Thu 26 Nov 2026, so the illustrative move is to Fri 27 Nov. Label this in the frame as the city's published holiday schedule, and list it on the Notes artboard as a fixture to verify against the real City of Camas calendar.
- Dana (FRIEND C, Camas, card as of Sat 12 Sep 2026) is the compare sender in flow-05. Jordan receives the card, then sends his own to his sister Ana (an invented name, listed on the Notes artboard).
- TODAY is Mon 19 Oct 2026, 6:10 PM Pacific, unless a step moves time forward. Say so on the frame ("Two days later · Wed 21 Oct").`

const SOURCES = (ids) => `SOURCES (read before writing):
- ${N}/flows-spec.md and ${N}/flows-spec.json: the flows ${ids.join(', ')} (steps, states, moments of truth, failure branches, success metric). Also the "Handoff gaps" section at the end.
- ${N}/house-style-v2.txt: pasted at the top of every project. Use its FIXTURES and ARTBOARDS convention.
- ${N}/prompts-v2/<surface-id>.md: the designed screen prompts for every surface a flow touches. Use their exact artboard names and state names, so the founder can attach the right exports.
- ${N}/component-contract.md: component names.
- ${N}/ux-research-brief.md: sections 2 (onboarding model) and 3 (notification model) govern most flows.
- ${ROOT}/docs/first-person-loop-design-2026-09-16.md: section 1 (the loop) and section 5 (measurement).`

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
          surfacesTouched: { type: 'array', items: { type: 'string' } },
          frameCount: { type: 'number' },
          promptText: { type: 'string' },
        },
        required: ['id', 'name', 'platforms', 'surfacesTouched', 'frameCount', 'promptText'],
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
              properties: { severity: { type: 'string' }, issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } },
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

const render = (ps) => ps.map(p => `===== ${p.id} (${p.name}) =====\n${p.promptText}`).join('\n\n')

const WRITE = (ids) => `You are a principal service designer writing JOURNEY STORYBOARD prompts for Claude Design. Every screen in these journeys has already been designed in its own project, from its own prompt. A storyboard project lays out the journey as a connected sequence, so the founder can see and fix what breaks between screens: what gets carried across, what the person sees at each moment of truth, and where the failure branches go.

${SOURCES(ids)}

${RECAST}

Write one prompt per flow: ${ids.join(', ')}. Each prompt must contain these sections:
- Opening line: "Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard."
- TYPE: NEW (storyboard). ATTACH: the exact exported artboards to attach, by their artboard names from prompts-v2. Where no export exists yet, tell Claude Design to redraw that frame faithfully from the description given.
- PERSONA & SITUATION, from the recast table.
- GOAL, and the §5 METRIC this journey moves.
- THE HAPPY PATH: numbered steps. For each step give the platform, the surface id and state, what the person does, what the screen shows (key strings), what is carried to the next step (data, copy, state), and the moment of truth as a callout.
- LAYOUT: a left-to-right lane of phone or desktop frames at 50% scale, with arrows labelled by the trigger (tap, push at 6:00 PM, widget tap, email link on another device). Time jumps are shown as a labelled gap. Moment-of-truth callouts go in a margin lane. Failure branches go in a lower lane that rejoins the happy path where it does.
- FAILURE BRANCHES: each one drawn, with its recovery and the surface it lands on.
- HANDOFF CHECKS: the handoff gaps from flows-spec that touch this flow, written as "Frame N and frame N+1 must agree on X".
- ACCESSIBILITY IN THE JOURNEY: focus landing after each transition, announcements, and the no-notifications path.
- INSTEAD OF lines.
- DONE WHEN.
- ARTBOARDS manifest, with names "<flow-id> · storyboard · <NN-lane> · light", ending in "<flow-id> · Notes".
- BATCH PLAN: at most 6 artboards per turn.

Keep all the substance of each flow from flows-spec, recast onto the fixtures. Use real strings consistent with prompts-v2. Be literal and explicit.`

const verifyFlow = (ps, ids, r) => agent(
`You are an adversarial service-design reviewer. For each storyboard prompt below, check it against flows-spec (every step, state, moment of truth and failure branch present, plus the handoff gaps for this flow), the RECAST TABLE (the fixtures used correctly, with no leftover flows-spec personas or addresses), and prompts-v2 (surface ids, state names, artboard names and key strings match what the screen prompts say). Also check against the onboarding and notification models in the brief. pass=true only if there are no blocker or major issues.

${SOURCES(ids)}

${RECAST}

PROMPTS (round ${r}):
${render(ps)}`,
  { label: `verify-flow:${ids[0]}${r > 1 ? ':r2' : ''}`, phase: 'Verify', schema: VERDICT_SCHEMA, effort: 'high' })

const verifyQ = (ps, ids, r) => agent(
`You are a senior prompt engineer for Claude Design and a principal UX designer. Review these storyboard prompts for: literal clarity, a complete and exactly named artboard manifest, a batch plan of 6 or fewer per turn, realistic frame counts, no placeholders, no contradictions with the house style, accessibility in transitions, and whether a founder could use the output to find and fix breaks between screens. pass=true only if there are no blocker or major issues.

${SOURCES(ids)}

PROMPTS (round ${r}):
${render(ps)}`,
  { label: `verify-quality:${ids[0]}${r > 1 ? ':r2' : ''}`, phase: 'Verify', schema: VERDICT_SCHEMA, effort: 'high' })

const out = await pipeline(
  BATCHES,
  (ids) => agent(WRITE(ids), { label: `write:${ids[0]}`, phase: 'Write', schema: PROMPT_SCHEMA, effort: 'high' }),
  async (w, ids) => {
    if (!w || !w.prompts) return null
    let ps = w.prompts
    for (let r = 1; r <= 2; r++) {
      const [a, b] = await Promise.all([verifyFlow(ps, ids, r), verifyQ(ps, ids, r)])
      const vs = [...(a ? a.verdicts : []), ...(b ? b.verdicts : [])]
      const bad = vs.filter(v => !v.pass || v.issues.some(i => i.severity === 'blocker' || i.severity === 'major'))
      if (!bad.length) return { ids, prompts: ps, clean: true }
      const fx = await agent(
`Revise these storyboard prompts. Apply every blocker and major issue, plus the minor ones that don't conflict. Keep all substance. Return all prompts in the batch.

${SOURCES(ids)}

${RECAST}

ISSUES:
${vs.map(v => `--- ${v.id}\n${v.issues.map(i => `[${i.severity}] ${i.issue}\n  evidence: ${i.evidence}\n  fix: ${i.fix}`).join('\n')}`).join('\n')}

PROMPTS:
${render(ps)}`,
        { label: `fix:${ids[0]}${r > 1 ? ':r2' : ''}`, phase: 'Fix', schema: PROMPT_SCHEMA, effort: 'high' })
      if (fx && fx.prompts && fx.prompts.length) {
        const by = Object.fromEntries(fx.prompts.map(x => [x.id, x]))
        ps = ps.map(x => by[x.id] || x)
      }
    }
    return { ids, prompts: ps, clean: false }
  },
)
const done = out.filter(Boolean)
log(`Flow prompts: ${done.flatMap(d => d.prompts).length}/14 · clean batches ${done.filter(d => d.clean).length}/${BATCHES.length}`)
return { flows: done }
