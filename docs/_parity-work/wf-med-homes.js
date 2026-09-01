export const meta = {
  name: 'parity-med-homes',
  description: 'Medium/low RN-to-native parity findings — homes (18 findings)',
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
    "id": "homes-a-1",
    "cluster": "homes-a",
    "designs": "\"A08 — per-screen batch 1/*.html\" (Members, Home calendar, Emergency info, Household tasks), \"A-12 Wizard (multi-step form)/A12.2 Add Home.html\" + \"A12.4 Claim Ownership Evidence.html\", \"A10 — Detail_ Content/A10.1 Home.html\"",
    "findings": "- **[medium·missing-endpoint·homes-a]** The Members screen's \"Audit Log\" tab (who did what to the household, actor → target, timestamped) has no native equivalent; the endpoint is never called.\n- **[medium·missing-endpoint·homes-a]** Native never fetches the caller's per-home access record, so home surfaces are not permission-gated. RN hides the Tasks / Bills / Deliveries / Maintenance / Documents / Access-&-Secrets cards when the\n- **[medium·missing-state·homes-a]** The home security-state banner is absent natively. RN surfaces claim_window (with the deadline date and an \"invite co-owner\" CTA), review_required, disputed and frozen states at the top of the dashboa\n- **[medium·missing-state·homes-a]** The Home Calendar natively shows only home events. RN's month grid additionally plots task due dates, bill due dates and package expected-delivery dates (colour-coded by type), so on native a user can\n- **[medium·missing-state·homes-a]** Claim submission drops the backend's routing_classification. RN warns \"Another claim is pending\" (parallel_claim) and \"Verified household exists\" (challenge_claim) before submitting, and when a strong",
    "count": 5
  },
  {
    "id": "homes-a-2",
    "cluster": "homes-a",
    "designs": "\"A08 — per-screen batch 1/*.html\" (Members, Home calendar, Emergency info, Household tasks), \"A-12 Wizard (multi-step form)/A12.2 Add Home.html\" + \"A12.4 Claim Ownership Evidence.html\", \"A10 — Detail_ Content/A10.1 Home.html\"",
    "findings": "- **[medium·missing-action·homes-a]** The evidence uploader's document-type picker is gone natively. RN lets the claimant declare which of five ownership documents they are uploading (deed / closing disclosure / property tax statement / t\n- **[medium·missing-action·homes-a]** The Add Home wizard's Details step is missing natively: nickname, home type, bedrooms, bathrooms, sqft, lot sqft, year built and description, pre-filled from an ATTOM public-records lookup. Native's f\n- **[medium·missing-action·homes-a]** The Add Home wizard's Setup step — add Wi-Fi / gate / alarm access secrets during home creation, including a camera QR scanner that parses a WIFI: barcode into SSID + password — has no native equivale\n- **[medium·missing-action·homes-a]** The Home dashboard FAB offers six one-tap creates in RN (Add Task, Track Bill, Track Package, Add Pet, Create Poll, Send Mail to this home). Natively the FAB has three entries and two of them — \"Log a\n- **[medium·missing-action·homes-a]** Emergency Info is read-only for phone numbers natively: RN has a persistent \"Emergency? Call 911\" banner that dials, and every stored contact's phone number is a tap-to-dial row. Neither native app op",
    "count": 5
  },
  {
    "id": "homes-b-1",
    "cluster": "homes-b",
    "designs": "\"A08 — per-screen batch 1/Polls.html\" + \"Household tasks.html\", \"A14 — Settings list/A14.1 Home settings.html\", \"A-12 Wizard (multi-step form)/A12.7 Postcard Verification.html\"",
    "findings": "- **[medium·missing-state·homes-b]** RN's Verification Center branches on `verification_status` from the home-access endpoint and renders six states (pending_postcard, provisional_bootstrap, pending_approval, pending_doc, provisional + c\n- **[medium·missing-action·homes-b]** No way to close a poll to further votes or delete it. RN shows Close and Delete actions on every active poll card. Both native apps declare the update-poll endpoint but no view model or screen ever ca\n- **[medium·missing-action·homes-b]** Household tasks cannot be deleted on either platform. RN has a trash affordance on every task row. Both apps declare the DELETE endpoint but nothing calls it — the only row action is the done toggle.\n- **[medium·missing-action·homes-b]** A completed task cannot be re-opened. RN's checkbox toggles both directions (done → open). Natively the Done tab renders a non-interactive status chip as the row trailing, and the Active tab filters o",
    "count": 4
  },
  {
    "id": "homes-b-2",
    "cluster": "homes-b",
    "designs": "\"A08 — per-screen batch 1/Polls.html\" + \"Household tasks.html\", \"A14 — Settings list/A14.1 Home settings.html\", \"A-12 Wizard (multi-step form)/A12.7 Postcard Verification.html\"",
    "findings": "- **[medium·missing-action·homes-b]** A home cannot be renamed on either platform. RN's settings screen has an inline nickname editor that PATCHes the home. Native home settings is navigation-only (`tapRow` just routes; `toggleRow`/`selec\n- **[medium·missing-state·homes-b]** Failure states of postcard verification are collapsed. RN surfaces `attempts_remaining` when it drops to ≤3, and on \"expired\"/\"Too many\" it routes the user back to the request step to get a fresh code\n- **[low·missing-action·homes-b]** The co-owner invite \"fast track\" toggle is missing natively. RN exposes it and defaults it ON; both native forms send only email/phone and let `fastTrack` fall back to its `false` default, so every na\n- **[low·missing-action·homes-b]** Vet contact information cannot be entered for a pet. RN's add-pet form has a \"Vet name / phone\" field and the expanded pet card shows it. Native Add/Edit Pet only collects species, name, breed, photo",
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