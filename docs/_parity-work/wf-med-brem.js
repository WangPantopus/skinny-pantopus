export const meta = {
  name: 'parity-med-wave-b-remainder',
  description: 'The 5 mailbox/gigs medium-low findings wave B never reached before its agents died',
  phases: [
    { title: 'Implement', detail: '2 packages, each doing both platforms' },
    { title: 'Audit', detail: 'per-platform review' },
  ],
}

const BRIEF = '/Users/yingpengwang/pantopus/native/pantopus/docs/_parity-work/BRIEF.md'
const ADDENDUM = '/Users/yingpengwang/pantopus/native/pantopus/docs/_parity-work/BRIEF-MEDIUM.md'

const RESULT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['package', 'status', 'ios', 'android', 'endpointsVerified', 'deferred'],
  properties: {
    package: { type: 'string' },
    status: { type: 'string', enum: ['complete', 'partial', 'blocked'] },
    ios: { type: 'object', additionalProperties: false, required: ['filesCreated', 'filesEdited', 'summary'],
      properties: { filesCreated: { type: 'array', items: { type: 'string' } }, filesEdited: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } } },
    android: { type: 'object', additionalProperties: false, required: ['filesCreated', 'filesEdited', 'summary'],
      properties: { filesCreated: { type: 'array', items: { type: 'string' } }, filesEdited: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } } },
    endpointsVerified: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['method', 'path', 'backendRef'],
      properties: { method: { type: 'string' }, path: { type: 'string' }, backendRef: { type: 'string' } } } },
    deferred: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['what', 'why', 'evidence'],
      properties: { what: { type: 'string' }, why: { type: 'string' }, evidence: { type: 'string' } } } },
  },
}

const AUDIT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['platform', 'issues'],
  properties: {
    platform: { type: 'string' },
    issues: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'severity', 'problem', 'fixApplied'],
      properties: { file: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, problem: { type: 'string' }, fixApplied: { type: 'string' } } } },
  },
}

const PREAMBLE = [
  `Read ${BRIEF} then ${ADDENDUM}. Follow both exactly.`,
  '',
  'CONTEXT: an earlier wave covering the mailbox + gigs medium/low findings lost every',
  'agent to a session limit mid-flight. Its partial output has already been repaired,',
  'compile-gated and committed. These are the findings it never reached — they are',
  'confirmed absent on BOTH platforms (probed by symbol, not by report).',
  '',
  'Two consequences for you:',
  '1. Sibling work already landed in these feature folders. Re-read any file before',
  '   editing it; do not assume the tree matches what the finding text implies.',
  '2. These findings are truncated one-liners with no file:line. Reconstruct each from',
  '   the RN source first, per section 1 of the addendum. Defer rather than guess.',
].join('\n')

const PACKAGES = [
  {
    id: 'brem-mailbox',
    title: 'Family Mail Party, machine translation, package help form',
    findings: [
      '- **[medium·missing-route·mailbox]** Entire Family Mail Party route missing natively: start/join a live co-opening session, discover active sessions, send live reactions, assign a mail item to a household member, and decline into solo opening.',
      '- **[medium·missing-endpoint·mailbox]** RN fetches a real machine translation and renders the returned translated text, detected language and translator notes, with a retry on failure. Both native translation screens render a hard-coded sample.',
      '- **[medium·missing-route·mailbox]** RN has a package-help request form (pick help type, add notes/offer, submit) that posts a gig tied to the mail item and then deep-links into the created gig.',
    ].join('\n'),
    designs: '"A17 mobile Mailbox root archetype/A17.9 Party mail.html", "A17.13 Translation.html", "A17.8 Package.html", "A17.6 Gig mail.html"',
    notes: [
      'The translation screen already exists on both platforms and renders a hard-coded sample —',
      'this is replacing the fixture with the real call, plus a retry, not building a new screen.',
      'MailboxV2Endpoints/MailboxV2Api already declare a translate route; check before adding one.',
      '',
      'The package-help form overlaps the package-gig work that already landed. Grep for',
      'PACKAGE_GIG / packageGig on both platforms FIRST — if the route already exists, this',
      'finding may be a form variant on top of it rather than a second route. Say which you found.',
    ].join('\n'),
  },
  {
    id: 'brem-gigs',
    title: 'Share live status link, v2 scored offers',
    findings: [
      '- **[medium·missing-endpoint·gigs]** "Share live status" is missing natively — RN mints a time-limited public status link for an in-progress task and copies it to the clipboard. Native\'s only share is the static universal link (ShareLink).',
      '- **[low·missing-endpoint·gigs]** The v2 scored-offers endpoint is never called by either native app. RN uses it for owners of curated_offers/quotes gigs (ranked offer cards) and falls back to plain /bids on failure.',
    ].join('\n'),
    designs: '"A09 — Detail_ Transactional/A09.1 Task V2.html", "A08 — per-screen batch 1/Offers.html"',
    notes: [
      'The v2 offers routes are mounted at `/api/v2` from backend/routes/offersV2.js (app.js:311) —',
      'NOT under /api/gigs. Verify the real paths there before wiring.',
      '',
      'Scored offers must fall back to the plain /bids path on failure exactly as RN does, so a',
      'v2 outage degrades to the current behaviour instead of an error screen.',
      '',
      'The live-status link is time-limited: surface its expiry to the user rather than implying',
      'it is permanent, and copy to the clipboard as RN does.',
    ].join('\n'),
  },
]

phase('Implement')
const results = await parallel(PACKAGES.map((p) => () =>
  agent([
    PREAMBLE, '',
    `# Work package ${p.id} — ${p.title}`, '',
    p.findings, '',
    `Design references: ${p.designs}`, '',
    p.notes, '',
    'Return the JSON result object.',
  ].join('\n'), { label: p.id, phase: 'Implement', schema: RESULT_SCHEMA })))

const done = results.filter(Boolean)
log(`${done.length}/${PACKAGES.length} packages returned`)

phase('Audit')
const AUDIT_COMMON = [
  `Read ${BRIEF} and ${ADDENDUM}.`, '',
  'Two sibling agents just landed the last mailbox/gigs medium-low findings. Hunt for:',
  'a claimed wiring that does not exist, fixtures left where live data was required, a route',
  'or DI registration never added, CI-breaking convention violations, and scope creep.',
  'Pay particular attention to whether a NEW route duplicates one that already exists —',
  'package-gig and translation surfaces already shipped in earlier waves.', '',
  'Their reports:', JSON.stringify(done, null, 2).slice(0, 16000), '',
  'Use `git diff --stat` / `git status` from /Users/yingpengwang/pantopus/native/pantopus, then',
  'read the real files. Trust the diff, not the reports.', '',
  'Do NOT run a build. Fix what you find with small anchored Edits, then report.',
].join('\n')

const audits = await parallel([
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **iOS only**. Verify new route cases exist in the route enum AND `destination(for:)`, new .swift files fall inside project.yml source globs, no `Features/**` hex literals or `Image(systemName:)`, and new ViewModels are `@Observable @MainActor` with all four render states.'].join('\n'),
    { label: 'audit:ios', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **Android only**. Verify every new Retrofit interface has a `@Provides @Singleton` in di/NetworkModule.kt, every new route constant has a matching `composable(...)` and a real navigation call site, nav args come through SavedStateHandle, and no `ui/screens/**` `Color(0xFF…)` or `Icons.Filled.*`.'].join('\n'),
    { label: 'audit:android', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
])

return { packages: done, audits: audits.filter(Boolean) }
