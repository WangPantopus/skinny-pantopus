export const meta = {
  name: 'pantopus-pack-consistency',
  description: 'Extract recurring claims from every prompt, resolve cross-pack conflicts, apply open review issues, tighten, and confirm no substance was lost',
  phases: [
    { title: 'Extract', detail: 'Claims table + open-issue check per group' },
    { title: 'Resolve', detail: 'Cross-pack conflicts by claim kind' },
    { title: 'Fix', detail: 'Apply fixes and tighten per group' },
    { title: 'Confirm', detail: 'No-loss and applied check' },
  ],
}
const ROOT = '/Users/yingpengwang/skinny-pantopus'
const N = `${ROOT}/docs/notes`
const GROUPS = args.groups   // arrays of prompt ids; files at ${N}/prompts-v3/<id>.md
const CANON = `CANON (precedence when prompts disagree): 1) ${N}/house-style-v2.txt (fixtures, invariants, accessibility, microcopy, push rules); 2) ${N}/component-contract.md and its glossary; 3) the Foundations prompts ${N}/prompts-v3/00?-*.md (component specs, drawn first); 4) ${N}/ux-research-brief.md; 5) ${ROOT}/docs/first-person-loop-design-2026-09-16.md; 6) ${N}/flows-spec.md. When a lower source is right and a higher one is wrong or silent, say so explicitly in the resolution.`

const CLAIMS = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          promptId: { type: 'string' },
          kind: { type: 'string', description: 'copy | push | route | component | fixture' },
          key: { type: 'string', description: 'Short normalized subject, e.g. "scope caption for saved place", "pickup push title unconfirmed", "deep link to Today calendar section", "FourteenDayStrip cell height iOS", "HOME A HOA dues amount"' },
          value: { type: 'string' },
          quote: { type: 'string', description: 'Verbatim excerpt from the prompt' },
        },
        required: ['promptId', 'kind', 'key', 'value', 'quote'],
      },
    },
    openIssues: {
      type: 'array',
      items: {
        type: 'object',
        properties: { promptId: { type: 'string' }, severity: { type: 'string' }, issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } },
        required: ['promptId', 'severity', 'issue', 'evidence', 'fix'],
      },
      description: 'Real remaining problems: unfixed prior review findings, internal contradictions, undrawable geometry, missing states, broken handoffs',
    },
  },
  required: ['claims', 'openIssues'],
}
const RES = {
  type: 'object',
  properties: {
    resolutions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          canonical: { type: 'string' },
          why: { type: 'string' },
          fixes: { type: 'array', items: { type: 'object', properties: { promptId: { type: 'string' }, change: { type: 'string' } }, required: ['promptId', 'change'] } },
        },
        required: ['key', 'canonical', 'why', 'fixes'],
      },
    },
  },
  required: ['resolutions'],
}
const OUT = {
  type: 'object',
  properties: { prompts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, promptText: { type: 'string' }, applied: { type: 'array', items: { type: 'string' } }, rejected: { type: 'array', items: { type: 'string' } } }, required: ['id', 'promptText', 'applied', 'rejected'] } } },
  required: ['prompts'],
}
const CONF = {
  type: 'object',
  properties: { results: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, pass: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } } }, required: ['id', 'pass', 'problems'] } } },
  required: ['results'],
}

phase('Extract')
const ex = (await parallel(GROUPS.map((ids, g) => () => agent(
`You are auditing prompts in the Pantopus Claude Design prompt pack. Read each file completely: ${ids.map(i => `${N}/prompts-v3/${i}.md`).join(', ')}.

TASK 1. Extract CLAIMS: every fact in these prompts that ANOTHER prompt could also state and so could contradict. This covers:
- user-facing strings that recur across screens (scope captions, provenance words, button labels for shared actions, empty/quiet/offline lines, reminder and date phrasing)
- push notification titles and bodies
- routes (deep links, entry points, what is handed over between screens, which state a landing opens in)
- component usage (names, variants, sizes, encodings, colours, behaviours)
- fixture values (people, addresses, amounts, dates, readings, deadlines, counts)
Use short, plain, normalized keys so the same subject gets the same key in other prompts. Quote verbatim. Aim for completeness over brevity: typically 20-60 claims per prompt.

TASK 2. Report OPEN ISSUES that still need fixing in these prompts. First read the prior review findings in ${N}/prompt-issues/<id>.md for each id (a fix was attempted but never re-checked) and verify whether each finding is actually resolved in the current text. Then look for internal contradictions, undrawable geometry, missing states, broken handoffs, and conflicts with the canon. Report only real, unresolved problems, with evidence and an exact fix.

${CANON}`,
  { label: `extract:${ids[0]}`, phase: 'Extract', schema: CLAIMS, effort: 'high' }
)))).filter(Boolean)

const claims = ex.flatMap(e => e.claims)
const open = ex.flatMap(e => e.openIssues)
log(`Extracted ${claims.length} claims and ${open.length} open issues`)

phase('Resolve')
const kinds = ['copy', 'push', 'route', 'component', 'fixture']
const shards = []
for (const k of kinds) {
  const rows = claims.filter(c => (c.kind || '').toLowerCase().startsWith(k)).sort((a, b) => a.key.localeCompare(b.key))
  const size = 450
  for (let s = 0; s < rows.length; s += size) shards.push({ kind: k, rows: rows.slice(s, s + size), n: shards.filter(x => x.kind === k).length + 1 })
}
const other = claims.filter(c => !kinds.some(k => (c.kind || '').toLowerCase().startsWith(k)))
if (other.length) shards.push({ kind: 'other', rows: other, n: 1 })
const res = (await parallel(shards.map(sh => () => agent(
`You are the canon editor for the Pantopus Claude Design prompt pack. Below is a table of "${sh.kind}" claims extracted from many prompts (shard ${sh.n}). Separately generated screens only match if the prompts agree. Find every subject where two or more prompts say DIFFERENT things. Group semantically, not just by exact key. Also flag a single claim that contradicts the canon. For each conflict, decide the canonical value using the canon order and your judgement about what is clearest for users, and list the exact change to make in each deviating prompt. Ignore differences that are legitimately different states or contexts. Read canon files as needed.

${CANON}

CLAIMS (promptId | key | value | quote):
${sh.rows.map(c => `${c.promptId} | ${c.key} | ${c.value} | ${String(c.quote).slice(0, 220)}`).join('\n')}`,
  { label: `resolve:${sh.kind}:${sh.n}`, phase: 'Resolve', schema: RES, effort: 'high' }
)))).filter(Boolean)
const resolutions = res.flatMap(r => r.resolutions)
log(`Resolved ${resolutions.length} cross-pack conflicts`)

const fixesFor = (id) => {
  const a = open.filter(o => o.promptId === id).map(o => `[${o.severity}] ${o.issue}\n  evidence: ${o.evidence}\n  fix: ${o.fix}`)
  const b = resolutions.flatMap(r => r.fixes.filter(f => f.promptId === id).map(f => `[consistency] ${r.key} → canonical: ${r.canonical} (${r.why})\n  change: ${f.change}`))
  return [...a, ...b]
}

phase('Fix')
const done = await pipeline(
  GROUPS,
  (ids) => agent(
`Revise these Pantopus Claude Design prompts. Read each current file: ${ids.map(i => `${N}/prompts-v3/${i}.md`).join(', ')}.

1. Apply every listed issue and consistency change. If one conflicts with the canon, follow the canon and record it under rejected with the reason.
2. TIGHTEN. The research on instruction density says accuracy falls as the instruction count rises, with a bias toward earlier instructions. Remove repetition and restatements of the house style or Foundations rules (refer to them by name instead). Merge duplicate lines. Keep every distinct fact, string, state, artboard and reason. Order each prompt as reference first and the request last: the ARTBOARDS manifest and BATCH PLAN close the prompt. Target at most 4,500 words for a screen or flow prompt and at most 2,800 for a Foundations component prompt. Never drop substance to hit a number.
3. Keep the section structure and exact artboard names.
Return the complete text of every prompt in this group, even if unchanged.

${CANON}

CHANGES BY PROMPT:
${ids.map(id => `===== ${id}\n${fixesFor(id).join('\n') || '(no listed changes; tighten only)'}`).join('\n\n')}`,
    { label: `fix:${ids[0]}`, phase: 'Fix', schema: OUT, effort: 'high' }),
  async (fx, ids) => {
    if (!fx || !fx.prompts) return null
    const conf = await agent(
`Confirm this revision. For each id, compare the REVISED text below with the ORIGINAL at ${N}/prompts-v3/<id>.md. Report:
(a) any listed change that was not applied and has no stated rejection reason;
(b) any substance in the original that is missing from the revision: facts, exact strings, states, artboards, entry points, reasons, accessibility specifics;
(c) any new contradiction the revision introduced.
Shortening is expected and fine. Only loss of distinct substance counts.
pass=true only if (a), (b) and (c) are all empty.

CHANGES:
${ids.map(id => `===== ${id}\n${fixesFor(id).join('\n') || '(tighten only)'}`).join('\n\n')}

REVISED:
${fx.prompts.map(p => `===== ${p.id}\n${p.promptText}`).join('\n\n')}`,
      { label: `confirm:${ids[0]}`, phase: 'Confirm', schema: CONF, effort: 'high' })
    const bad = conf ? conf.results.filter(r => !r.pass) : []
    if (!bad.length) return { ids, prompts: fx.prompts, confirmed: true }
    const fx2 = await agent(
`Finish these revisions. Resolve every problem listed: restore lost substance, apply missed changes, remove new contradictions. The originals are at ${N}/prompts-v3/<id>.md. Return the complete text of the listed prompts only.

${CANON}

PROBLEMS:
${bad.map(r => `--- ${r.id}\n${r.problems.join('\n')}`).join('\n')}

CURRENT REVISIONS:
${fx.prompts.filter(p => bad.some(r => r.id === p.id)).map(p => `===== ${p.id}\n${p.promptText}`).join('\n\n')}`,
      { label: `fix2:${ids[0]}`, phase: 'Fix', schema: OUT, effort: 'high' })
    const by = Object.fromEntries(((fx2 && fx2.prompts) || []).map(p => [p.id, p]))
    return { ids, prompts: fx.prompts.map(p => by[p.id] || p), confirmed: false, problems: bad }
  },
)
return { claimsCount: claims.length, open, resolutions, groups: done.filter(Boolean) }
