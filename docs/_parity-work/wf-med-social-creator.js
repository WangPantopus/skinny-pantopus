export const meta = {
  name: 'parity-med-social-creator',
  description: 'Medium/low RN-to-native parity findings — social-creator (19 findings)',
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
    "id": "tabs-social-1",
    "cluster": "tabs-social",
    "designs": "\"A03 — Tab_ Pulse feed/*.html\", \"Pantopus-design/Hub.html\", \"A08 — per-screen batch 1/Notifications.html\"",
    "findings": "- **[medium·missing-action·tabs-social]** On the \"Beacons you follow\" list, the per-row notification-level bell (All / Highlights / Off) and long-press multi-select with bulk unfollow are missing natively; only mark-seen, mute, and single unf\n- **[medium·missing-endpoint·tabs-social]** The Monthly Receipt card on the profile tab (earnings, neighbors helped, share sheet, auto-expand from the monthly_receipt notification) has no native counterpart and its endpoint is never called.\n- **[medium·missing-endpoint·tabs-social]** Invite / referral progress (referral count, unlocked features, next unlock) and the shareable invite code are not surfaced anywhere natively.\n- **[medium·missing-endpoint·tabs-social]** Post detail's \"Nearby Providers\" card (organically matched local businesses with rating/NEW badge, help tooltip, tap-through to the business profile) is missing natively.\n- **[medium·missing-endpoint·tabs-social]** Morning/Evening Briefing deep links (push notification carries a briefing delivery id and kind) resolve to a specific stored briefing in RN; natively the Today screen always refetches the generic /api",
    "count": 5
  },
  {
    "id": "tabs-social-2",
    "cluster": "tabs-social",
    "designs": "\"A03 — Tab_ Pulse feed/*.html\", \"Pantopus-design/Hub.html\", \"A08 — per-screen batch 1/Notifications.html\"",
    "findings": "- **[medium·missing-endpoint·tabs-social]** Three Hub behaviours are dropped: rebookable-gig cards injected into \"Jump back in\" (never fetched), the neighbor-density milestone banner and its dismiss, and the server-driven statusItems action str\n- **[medium·missing-action·tabs-social]** The Pulse type-filter chip row loses four filters: Alerts, Deals, Wins, and Guide. Native collapses alert/neighborhood_win into a single \"Announce\" chip and has no deal or visitor_guide filter, so tho\n- **[medium·missing-endpoint·tabs-social]** The Sports topic lane on the Nearby feed — topic chip row, For You / Local / Event / Watch mode chips, the active-event module with \"start a thread\", and the sports starter prompts that pre-fill the c\n- **[medium·missing-state·tabs-social]** Pre-post safety precheck is dropped: RN calls precheck before opening/submitting the composer and renders cooldown (rate-limited / restricted), visitor, and suggestion nudges. Native compose submits b\n- **[medium·missing-action·tabs-social]** The Nearby feed's viewing-location switcher (ContextBar — switch between home, saved places, recent locations) and the radius-suggestion banner (apply / dismiss when nothing is nearby) are missing nat",
    "count": 5
  },
  {
    "id": "creator-biz-1",
    "cluster": "creator-biz",
    "designs": "\"A22 — Creator Audience hub/A22.1 Audience.html\", \"A10 — Detail_ Content/A10.7 Business (owner view).html\", \"A-12 Wizard (multi-step form)/A12.10 Create Business.html\"",
    "findings": "- **[medium·missing-action·creator-biz]** Mute / unmute an audience member is not exposed natively. RN's per-member sheet offers Mute (\"they stay subscribed but stop getting notified\") and Unmute, mapping to the same PATCH the native apps alr\n- **[medium·missing-state·creator-biz]** The audience list is not paginated natively, so an audience larger than one server page is silently truncated. RN pages with limit=50 / offset and an onEndReached loader (src/hooks/usePersonaAudienceL\n- **[medium·missing-action·creator-biz]** The audience sort control is missing natively. RN's header button cycles four sorts (recent / tenure / tier / alpha) and passes `sort` to the list endpoint. iOS's endpoint builder even declares a `sor\n- **[medium·missing-action·creator-biz]** Blocking a follower from the Beacon followers list has no native equivalent. RN's followers tab exposes Approve / Remove / Block per row with a confirm alert. Native's audience management supports app\n- **[medium·missing-action·creator-biz]** Three capabilities of the create-business wizard are absent natively: (1) the Logo step — RN uploads a logo right after create; neither native app has any business-media upload (grep for `uploadBusine",
    "count": 5
  },
  {
    "id": "creator-biz-2",
    "cluster": "creator-biz",
    "designs": "\"A22 — Creator Audience hub/A22.1 Audience.html\", \"A10 — Detail_ Content/A10.7 Business (owner view).html\", \"A-12 Wizard (multi-step form)/A12.10 Create Business.html\"",
    "findings": "- **[medium·missing-endpoint·creator-biz]** The business-side inbox is missing natively. RN lists the rooms addressed to the business identity and the neighborhood posts matched to the business's categories. Native only has the customer-facing \n- **[medium·missing-action·creator-biz]** The founding-business offer banner and its claim CTA exist only in RN. RN fetches the founding-offer status on dashboard load and lets an eligible owner claim a numbered founding slot (with a dismiss \n- **[medium·missing-state·creator-biz]** Destructive audience actions lose the undo window natively. RN removes the row optimistically, shows a 5-second \"Tap to undo\" toast, and only fires the PATCH after the window closes (reverting the row\n- **[low·missing-endpoint·creator-biz]** Broadcast read receipts are never sent natively. RN marks a broadcast message read when it scrolls into view on the public Beacon profile, which is what feeds the creator's read-count analytics on the",
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