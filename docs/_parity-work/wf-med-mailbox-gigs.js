export const meta = {
  name: 'parity-med-mailbox-gigs',
  description: 'Medium/low RN-to-native parity findings — mailbox-gigs (23 findings)',
  phases: [
    { title: 'Implement', detail: 'packages, each doing both platforms' },
    { title: 'Audit', detail: 'per-platform review of the wave diff' },
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

const PACKAGES = [
  {
    "id": "mailbox-1",
    "cluster": "mailbox",
    "designs": "\"A17 mobile Mailbox root archetype/*.html\" — especially A17.2 Booklet, A17.3 Certified mail, A17.8 Package, A17.9 Party mail, A17.11 Stamps, A17.13 Translation; \"A13 — Form (single screen)/My Mail Day.html\"",
    "findings": "- **[medium·missing-route·mailbox]** Entire Family Mail Party route missing natively: start/join a live co-opening session, discover active sessions, send live reactions, assign a mail item to a household member, and decline into solo op\n- **[medium·missing-action·mailbox]** RN's package dashboard can share the delivery ETA with the household, create a neighbor gig to catch the package, and report a package issue. Native's package detail overflow shows 'Report issue' (and\n- **[medium·missing-endpoint·mailbox]** RN Stamps has a second 'Themes' view where the user browses seasonal mailbox themes and applies an unlocked one; the stamp collection itself is loaded from the backend. Native's Stamps screen is a sam\n- **[medium·missing-route·mailbox]** RN's Mail Day has a Settings sub-view (gear from the summary header): daily-digest toggle, delivery-time, sound type picker, quiet-hours, and per-category notification switches, persisted via PATCH. N\n- **[medium·missing-route·mailbox]** Entire Mail Memory route missing natively: 'On This Day' resurfaced mail with per-memory dismiss, and 'Year in Mail' with a year stepper and a share-card generator.",
    "count": 5
  },
  {
    "id": "mailbox-2",
    "cluster": "mailbox",
    "designs": "\"A17 mobile Mailbox root archetype/*.html\" — especially A17.2 Booklet, A17.3 Certified mail, A17.8 Package, A17.9 Party mail, A17.11 Stamps, A17.13 Translation; \"A13 — Form (single screen)/My Mail Day.html\"",
    "findings": "- **[medium·missing-action·mailbox]** RN's Vault searches the whole archive server-side ('Search sender, amount, date…') and has drawer tabs to switch the vault between personal/home/business. Native filters only the rows already fetched \n- **[medium·missing-action·mailbox]** RN's booklet viewer can save the booklet to a vault folder and download the PDF (with size reported). Both native booklet layouts render 'Save to Vault', 'Share', 'PDF' and 'Archive' buttons that are \n- **[medium·missing-action·mailbox]** After acknowledging certified mail RN offers a '⬇ Proof' button that fetches and saves the legal delivery proof. Native's certified layout has no proof affordance — its four secondary tiles (Pay/Calen\n- **[medium·missing-endpoint·mailbox]** RN fetches a real machine translation and renders the returned translated text, detected language and translator notes, with a retry on failure. Both native translation screens render a hard-coded sam\n- **[medium·missing-route·mailbox]** RN has a package-help request form (pick help type, add notes/offer, submit) that posts a gig tied to the mail item and then deep-links into the created gig. Neither native app has this form or calls",
    "count": 5
  },
  {
    "id": "gigs-1",
    "cluster": "gigs",
    "designs": "\"A09 — Detail_ Transactional/A09.1 Task V2.html\" + \"A09.2 Gig V1.html\", \"Pantopus-design/Gigs.html\", \"A08 — per-screen batch 1/Offers.html\" + \"My bids.html\"",
    "findings": "- **[medium·missing-action·gigs]** The Offers & bids screen is read-only natively. RN's Received tab has Accept (with Stripe PaymentSheet authorization) and Reject per pending bid; the Sent tab has Withdraw. Both native Offers view-mod\n- **[medium·missing-action·gigs]** Gig Q&A loses three actions natively: upvote a question, pin/unpin an answer (poster), and delete a question. Native only supports ask + answer.\n- **[medium·missing-endpoint·gigs]** \"Rebook a favorite helper\" rail is absent natively — RN shows a horizontal card row of past completed tasks with their worker and a one-tap Rebook CTA that prefills the composer. Neither native app ca\n- **[medium·missing-action·gigs]** Three feed filters exist only in RN: distance (\"Under 1 mi / 3 mi / 5 mi\" → max_distance + includeRemote=false), deadline (\"Today\" / \"This Week\" → deadline), and task archetype (Quick Help / Delivery \n- **[medium·missing-action·gigs]** Poster cannot nudge a worker who hasn't started. RN has a \"Remind worker\" action with a server-driven cooldown (`next_allowed_at` / `sent_at` handling). Absent from both native gig-detail lifecycle se",
    "count": 5
  },
  {
    "id": "gigs-2",
    "cluster": "gigs",
    "designs": "\"A09 — Detail_ Transactional/A09.1 Task V2.html\" + \"A09.2 Gig V1.html\", \"Pantopus-design/Gigs.html\", \"A08 — per-screen batch 1/Offers.html\" + \"My bids.html\"",
    "findings": "- **[medium·missing-action·gigs]** Poster cannot withdraw a counter-offer they already sent. RN renders a \"Withdraw counter\" button on countered bids; native supports counter/accept-counter/decline-counter but never the poster-side wit\n- **[medium·missing-action·gigs]** Editing a posted task natively can only change 8 fields. RN's edit form (`/gig/new?editGigId=`) prefills and PATCHes cancellation_policy, is_urgent, tags, deadline, estimated_duration and items[] as w\n- **[medium·missing-action·gigs]** An owner cannot close/delete a still-open task natively. RN branches: open → DELETE /api/gigs/:id (\"Close Gig\", removes it), otherwise → POST /cancel. Native's overflow only ever offers \"Cancel task\" \n- **[medium·missing-endpoint·gigs]** The urgent/instant-accept live fulfillment stepper is missing natively: RN polls the task's fulfillment status and lets the helper advance it (on_the_way → arrived → working → done). Neither native ap",
    "count": 4
  },
  {
    "id": "gigs-3",
    "cluster": "gigs",
    "designs": "\"A09 — Detail_ Transactional/A09.1 Task V2.html\" + \"A09.2 Gig V1.html\", \"Pantopus-design/Gigs.html\", \"A08 — per-screen batch 1/Offers.html\" + \"My bids.html\"",
    "findings": "- **[medium·missing-endpoint·gigs]** \"Share live status\" is missing natively — RN mints a time-limited public status link for an in-progress task and copies it to the clipboard. Native's only share is the static universal link (ShareLink\n- **[low·one-platform-only·gigs]** The Tasks tab's feed-scope segmentation is absent on both natives: RN has All / Tasks / Support Trains chips that mix nearby Support Trains into the gig feed (GET /api/support-trains/nearby), plus \"My\n- **[low·missing-endpoint·gigs]** The v2 scored-offers endpoint is never called by either native app. RN uses it for owners of curated_offers/quotes gigs (ranked offer cards) and falls back to plain /bids on failure; native always use\n- **[low·missing-action·gigs]** \"Share this task to the feed\" is missing natively — RN's gig detail opens a PostTargetPicker + PostComposerModal that creates a feed post (with purpose, visibility, tags, media) referencing the task.",
    "count": 4
  }
]

phase('Implement')
const results = await parallel(PACKAGES.map((p) => () =>
  agent([
    `Read ${BRIEF} then ${ADDENDUM}. Follow both exactly.`, '',
    `# Work package ${p.id} — ${p.count} medium/low findings in the \`${p.cluster}\` cluster`, '',
    'Implement every finding below on BOTH iOS and Android. They are quoted verbatim from',
    'the "Medium (73) and low (13)" section of docs/rn-functional-parity.md — which means they',
    'are TRUNCATED and carry no file:line. Reconstruct each one from the RN source before you',
    'build anything, per section 1 of the addendum.', '',
    p.findings, '',
    `Design references for this cluster: ${p.designs}`, '',
    'Work through every finding. Return the JSON result object.',
  ].join('\n'), { label: p.id, phase: 'Implement', schema: RESULT_SCHEMA })))

const done = results.filter(Boolean)
log(`${done.length}/${PACKAGES.length} packages returned`)

phase('Audit')
const AUDIT_COMMON = [
  `Read ${BRIEF} and ${ADDENDUM}.`, '',
  'Sibling agents just landed the medium/low findings for this wave, in parallel, in the same',
  'tree. Hunt for: (a) two agents clobbering a shared file, (b) a claimed wiring that does not',
  'exist, (c) fixtures left where live data was required, (d) a route or DI registration never',
  'added, (e) CI-breaking convention violations, and especially (f) SCOPE CREEP — a screen',
  'changed beyond its finding, or an existing surface deleted that no finding asked to remove.',
  'That last one has bitten this project before.', '',
  'Their reports:', JSON.stringify(done, null, 2).slice(0, 18000), '',
  'Use `git diff --stat` / `git status` from /Users/yingpengwang/pantopus/native/pantopus, then',
  'read the real files. Trust the diff, not the reports.', '',
  'Do NOT run a build — a compile gate runs after you. Fix what you find with small anchored',
  'Edits, then report.',
].join('\n')

const audits = await parallel([
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **iOS only**. Verify new route cases exist in the route enum AND `destination(for:)`, new .swift files fall inside project.yml source globs, no `Features/**` hex literals or `Image(systemName:)`, new ViewModels are `@Observable @MainActor` with all four render states, and no test assertion was left stale by a behaviour change.'].join('\n'),
    { label: 'audit:ios', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **Android only**. Verify every new Retrofit interface has a `@Provides @Singleton` in di/NetworkModule.kt, every new route constant has a matching `composable(...)` in RootTabScreen.kt and a real navigation call site, nav args come through SavedStateHandle with a declared key, no `ui/screens/**` `Color(0xFF…)` or `Icons.Filled.*`, and no test assertion was left stale by a behaviour change.'].join('\n'),
    { label: 'audit:android', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
])

return { packages: done, audits: audits.filter(Boolean) }