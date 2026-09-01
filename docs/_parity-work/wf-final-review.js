export const meta = {
  name: 'parity-final-review',
  description: 'Adversarial verification of all 64 closed high-severity parity findings across both platforms',
  phases: [
    { title: 'Verify', detail: 'per-cluster: does the finding actually close?' },
    { title: 'Sweep', detail: 'cross-cutting CI, parity and dead-wiring checks' },
  ],
}

const BRIEF = '/Users/yingpengwang/pantopus/native/pantopus/docs/_parity-work/BRIEF.md'
const DOC = '/Users/yingpengwang/pantopus/native/pantopus/docs/rn-functional-parity.md'

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['cluster', 'findings'],
  properties: {
    cluster: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['finding', 'verdict', 'evidence', 'fixApplied'],
        properties: {
          finding: { type: 'string', description: 'short label of the finding being judged' },
          verdict: {
            type: 'string',
            enum: ['closed', 'partially-closed', 'not-closed', 'closed-but-unreachable'],
          },
          evidence: {
            type: 'string',
            description: 'file:line proving the verdict — the call site, the route registration, the gating condition',
          },
          fixApplied: { type: 'string', description: 'what you changed, or "none needed"' },
        },
      },
    },
  },
}

const SWEEP_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['scope', 'issues'],
  properties: {
    scope: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['file', 'severity', 'problem', 'fixApplied'],
        properties: {
          file: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          problem: { type: 'string' },
          fixApplied: { type: 'string' },
        },
      },
    },
  },
}

const VERIFY_PREAMBLE = [
  `Read ${BRIEF} for repo paths and conventions.`,
  '',
  'Six waves of agents have closed all 64 high-severity findings in',
  `${DOC}. Your job is to **disprove** that they are closed.`,
  '',
  'The default assumption you must argue against is "the agent wrote plausible code',
  'that does not actually change what a user can do". The failure modes that survive a',
  'compile gate are:',
  '',
  '- **closed-but-unreachable** — the screen/action exists and compiles, but nothing',
  '  navigates to it, the route case was never added to `destination(for:)` / never got a',
  '  `composable(...)`, or the entry point sits behind a debug flag. This is the single',
  '  most common failure in this codebase; the original audit found whole wizards shipped',
  '  and reachable only from `#if DEBUG`.',
  '- **still fixture-backed** — a sample-data path is still what renders, or the live call',
  '  exists but its result is discarded.',
  '- **wrong endpoint** — the path does not match what the backend actually mounts. Check',
  '  `backend/app.js` for the mount prefix and the router file for the relative path.',
  '- **one-platform-only** — landed on iOS but not Android or vice versa.',
  '- **dead affordance** — the button renders but its handler is empty, a no-op default',
  '  lambda, or a TODO.',
  '',
  'Method: for each finding, start from the RN behaviour, then trace the native path',
  'end to end — entry point → route registration → view → view-model → repository/endpoint',
  '→ real backend route. Cite file:line. Do not take a previous agent report as evidence.',
  '',
  'Where you find a real defect, **fix it** with small anchored Edits, then record it.',
  'Do NOT run a build — a compile gate runs after you.',
].join('\n')

const CLUSTERS = [
  ['homes-a', 'the 10 homes-a findings (dashboard, home intelligence, delete home, member roles, household-access requests, find-a-home, ask-a-verified-owner, residency evidence, HOME_FOUND_CLAIMED, home issues)'],
  ['homes-b', 'the 6 homes-b findings (postcard unlock, owner claim review, per-home security policy, tenant/landlord approval, guest passes, ownership transfer)'],
  ['mailbox', 'the 10 mailbox findings (compose FAB, routing banner, community mail, home records, earn offer wall, mail tasks, unboxing, stationery redirect, iOS map/vacation, category actions)'],
  ['gigs+money', 'the 10 gigs and money findings (feed pagination, viewer bid, pro-service module, delivery module, worker-release, reopen-bidding, package gig, invoice pay, payment history, Stripe dashboard). NOTE: this wave never received an audit pass — its two audit agents died on a session limit. Treat it as the least-verified cluster and go deeper here than elsewhere.'],
  ['tabs-social', 'the 10 tabs-social findings (support train reservations, organizer management, universal search, connections surface, post-card actions, feed preferences, feed map, hub discover filters, notifications zones/delete, connections tabs)'],
  ['auth-settings', 'the 7 auth-settings findings (delete account, notification preferences, search privacy, profile photo, professional mode, username resolution, follow a neighbor)'],
  ['creator-biz', 'the 11 creator-biz findings (persona create/edit, broadcast media, catalog CRUD, post-as-business, Stripe Connect, invoicing, verification/private, page blocks, pages CMS, persona DMs, membership tiers)'],
]

phase('Verify')

const verdicts = await parallel(
  CLUSTERS.map(([key, desc]) => () =>
    agent(
      [
        VERIFY_PREAMBLE,
        '',
        `# YOUR CLUSTER: ${key}`,
        '',
        `Verify ${desc}.`,
        '',
        `Read the cluster's section of ${DOC} for the verbatim findings, then judge each one.`,
        'Return one entry per finding.',
      ].join('\n'),
      { label: `verify:${key}`, phase: 'Verify', schema: VERDICT_SCHEMA, effort: 'high' }
    )
  )
)

const done = verdicts.filter(Boolean)
const all = done.flatMap((v) => v.findings || [])
const bad = all.filter((f) => f.verdict !== 'closed')
log(`${all.length} findings judged; ${bad.length} not fully closed`)

phase('Sweep')

const SWEEP_COMMON = [
  `Read ${BRIEF} for repo paths and conventions.`,
  '',
  'Seven verifier agents just re-checked all 64 closed findings and fixed what they found.',
  'You are the cross-cutting sweep: the defects that belong to no single finding.',
  '',
  'Their verdicts:',
  JSON.stringify(all, null, 2).slice(0, 18000),
  '',
  'Do NOT run a build — a compile gate runs after you.',
  'Fix what you find with small anchored Edits, then report.',
].join('\n')

const sweeps = await parallel([
  () =>
    agent(
      [
        SWEEP_COMMON,
        '',
        'YOUR SCOPE: **CI guards**. Run the repo greps the CI jobs run and fix every hit',
        'introduced by this branch (compare against `git diff master...HEAD`):',
        '- iOS: hex colour literals anywhere under `Pantopus/Features/**`; any',
        '  `Image(systemName:)`; SwiftLint violations in new files.',
        '- Android: `Color(0xFF…)` or `Icons.Filled.*` or `painterResource(R.drawable.ic_lucide_*)`',
        '  under `ui/screens/**`; on-scale raw `.dp` literals where a `Spacing`/`Radii` token exists.',
        'Report each hit you fixed. If a hit predates this branch, leave it and say so.',
      ].join('\n'),
      { label: 'sweep:ci-guards', phase: 'Sweep', schema: SWEEP_SCHEMA, effort: 'high' }
    ),
  () =>
    agent(
      [
        SWEEP_COMMON,
        '',
        'YOUR SCOPE: **iOS ↔ Android parity of the new work**. For every surface this branch',
        'added or changed, confirm both platforms expose the same render states, the same',
        'accessibilityIdentifier(…) / Modifier.testTag(…) strings, and hit the same backend',
        'route with the same query params and body field names. Diff the two implementations',
        'against each other, not against the reports. Fix drift on whichever side is wrong.',
      ].join('\n'),
      { label: 'sweep:cross-platform', phase: 'Sweep', schema: SWEEP_SCHEMA, effort: 'high' }
    ),
  () =>
    agent(
      [
        SWEEP_COMMON,
        '',
        'YOUR SCOPE: **reachability and dead wiring across the whole branch**. Independently of',
        'any single finding: enumerate every route case added on this branch (iOS route enums,',
        'Android `ChildRoutes`) and prove each one is (a) registered in `destination(for:)` /',
        'a `composable(...)` block and (b) navigated to from at least one production, non-debug',
        'call site. Also flag any endpoint helper or repository method added on this branch that',
        'has zero call sites — that was the exact shape of several original findings',
        '(`listGuestPasses`, `revokeGuestPass`, `earnBalance`, `pending` all existed and were',
        'never called). Fix by wiring the entry point, or report it if the right entry point is',
        'genuinely ambiguous.',
      ].join('\n'),
      { label: 'sweep:reachability', phase: 'Sweep', schema: SWEEP_SCHEMA, effort: 'high' }
    ),
])

return { verdicts: done, notFullyClosed: bad, sweeps: sweeps.filter(Boolean) }
