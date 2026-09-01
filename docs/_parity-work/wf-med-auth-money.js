export const meta = {
  name: 'parity-med-auth-money',
  description: 'Medium/low RN-to-native parity findings — auth-money (26 findings)',
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
    "id": "auth-settings-1",
    "cluster": "auth-settings",
    "designs": "\"A13 — Form (single screen)/Edit Profile.html\" + \"Professional Profile.html\", \"A10 — Detail_ Content/A10.5 User.html\", \"A19 — Legal  static/*.html\", \"A21 — Public Beacon profile/A21.2 Local Profile.html\"",
    "findings": "- **[medium·missing-action·auth-settings]** On the signed-out auth surfaces the Terms of Service and Privacy Policy are not readable. RN renders them as individually tappable links (that deliberately do not toggle the checkbox) pushing /legal/t\n- **[medium·missing-endpoint·auth-settings]** The portfolio surface has no native equivalent: no Portfolio tab on the public profile, no add/delete portfolio item. RN lists items via GET /api/files/portfolio[/:userId], filters by media type, uplo\n- **[medium·missing-endpoint·auth-settings]** Skills cannot be edited natively. RN's Edit Profile has an add-skill input and tap-to-remove chips, saved with PUT /api/users/skills alongside the profile PATCH. Native Edit Profile has no skills fiel\n- **[medium·missing-action·auth-settings]** No Gigs tab on the native public profile. RN shows the user's gigs (GET /api/gigs?user_id=…&limit=20) as a tab with rows that deep-link into /gig/:id. Native profiles expose only Posts and About.\n- **[medium·missing-endpoint·auth-settings]** The gig-review surface on a profile is absent natively. RN has a Reviews tab with a count badge, an average/total header, a worker | poster | all filter driven by received_as, and a full-screen viewer",
    "count": 5
  },
  {
    "id": "auth-settings-2",
    "cluster": "auth-settings",
    "designs": "\"A13 — Form (single screen)/Edit Profile.html\" + \"Professional Profile.html\", \"A10 — Detail_ Content/A10.5 User.html\", \"A19 — Legal  static/*.html\", \"A21 — Public Beacon profile/A21.2 Local Profile.html\"",
    "findings": "- **[medium·missing-action·auth-settings]** Professional pricing, service area and categories cannot be edited natively. RN's professional editor writes categories[], pricing_meta.hourly_rate/currency and service_area.city/state/radius_km via P\n- **[medium·missing-endpoint·auth-settings]** Cannot start professional verification natively. RN has a \"Start verification\" CTA on the professional profile calling POST /api/professional/verification/start with a tier. Both native apps read GET \n- **[medium·missing-action·auth-settings]** An unverified user who tries to sign in is dead-ended natively. RN detects a \"verify\" login error and reveals a \"Resend verification email\" link on the login screen (POST /api/users/resend-verificatio\n- **[medium·missing-state·auth-settings]** \"Show Email on Profile\" and \"Show Phone on Profile\" have no native equivalent. RN persists them with the rest of the settings Save via PATCH /api/users/profile { showEmail, showPhone }. Neither native",
    "count": 4
  },
  {
    "id": "auth-settings-3",
    "cluster": "auth-settings",
    "designs": "\"A13 — Form (single screen)/Edit Profile.html\" + \"Professional Profile.html\", \"A10 — Detail_ Content/A10.5 User.html\", \"A19 — Legal  static/*.html\", \"A21 — Public Beacon profile/A21.2 Local Profile.html\"",
    "findings": "- **[medium·missing-endpoint·auth-settings]** The combined payments + payouts history tab is missing natively. RN's Payments & Payouts screen has four tabs (Wallet · Payment methods · Payouts · History); the History tab calls GET /api/payments/hi\n- **[medium·missing-state·auth-settings]** An invite code from a /join/:code link never reaches the native sign-up form. RN redirects a signed-out user to /(auth)/register?invite_code=CODE, pre-fills it and sends it as invite_code on register.\n- **[medium·missing-state·auth-settings]** Native profiles do not know the existing relationship, so the connection controls are one-way. RN reads GET /api/users/:id/relationship (none | pending_sent | pending_received | connected | blocked, p\n- **[low·missing-endpoint·auth-settings]** The \"Generate bio with AI\" button on Edit Profile has no native counterpart. RN builds a prompt from name/skills/tagline/city and calls POST /api/ai/draft/post, dropping the result into the bio field.",
    "count": 4
  },
  {
    "id": "money-1",
    "cluster": "money",
    "designs": "\"A10 — Detail_ Content/A10.10 Wallet.html\", \"A14 — Settings list/A14.6 Payments.html\"",
    "findings": "- **[medium·missing-action·money]** No partial withdrawal. RN gives the user an amount field (decimal-pad), validates against available balance, and posts that amount. Both native apps post the entire available balance with no amount in\n- **[medium·missing-endpoint·money]** The 'Earnings & Spending' summary (TOTAL EARNED / TOTAL SPENT, including funds still in review) is absent. RN fetches both figures; neither native app has an endpoint helper or call site for either ro\n- **[medium·missing-state·money]** Money surfaces lose their identity check. RN wraps both Wallet and Payments & Payouts in SensitiveScreenGuard (biometric/device-credential before content renders, with a 5-minute grace) and re-verifie\n- **[medium·missing-state·money]** The wallet `frozen` flag is decoded but ignored natively. RN computes canWithdraw = hasWallet && !wallet.frozen && balance > 0 and renders a disabled CTA. Both native apps gate only on payoutsEnabled \n- **[medium·missing-action·money]** Pull-to-refresh is gone from the Wallet and Payments screens on both platforms. RN has a RefreshControl on the wallet route and on all four payments tabs; the only way to re-read balance/methods nativ",
    "count": 5
  },
  {
    "id": "money-2",
    "cluster": "money",
    "designs": "\"A10 — Detail_ Content/A10.10 Wallet.html\", \"A14 — Settings list/A14.6 Payments.html\"",
    "findings": "- **[medium·missing-state·money]** Lifetime totals are dropped. RN shows 'Total Earned' (lifetime_received) and 'Withdrawn' (lifetime_withdrawals) next to the balance. Both native apps decode these fields and never read them — the hero\n- **[medium·one-platform-only·money]** Removing a saved card is unconfirmed on Android. RN shows a destructive confirmation Alert naming the last4 before detaching; iOS mirrors this with a confirmationDialog. Android fires the DELETE strai\n- **[low·missing-state·money]** Connect account status detail is collapsed to a binary. RN distinguishes three states — connected (with CARD PAYMENTS / PAYOUTS Enabled-Disabled tiles), 'Account verification in progress' with a Conti\n- **[low·missing-state·money]** The Payments screen's Payouts section is a static 'not connected' scaffold on both platforms — it always renders the 'Stripe Connect / Connect' chip, 'Payout method — Add after connecting Stripe' and ",
    "count": 4
  },
  {
    "id": "money-3",
    "cluster": "money",
    "designs": "\"A10 — Detail_ Content/A10.10 Wallet.html\", \"A14 — Settings list/A14.6 Payments.html\"",
    "findings": "- **[low·missing-state·money]** The pending-release breakdown is collapsed. RN renders separate 'In review' and 'Releasing soon' dollar lines from the same endpoint; both native apps use only total_pending_cents plus a combined coun\n- **[low·missing-state·money]** Context-level: RN has a persisted per-user app-lock setup-prompt state ('pending' / 'enabled' / 'declined') and a post-login layer that offers to turn on biometric protection once, then remembers the \n- **[low·missing-state·money]** Context-level: RN's PantopusProvider keeps a client-side mute/hide layer (mutedEntities for users and businesses, hiddenPostIds) that filters feed content instantly after a mute/hide action, before an\n- **[low·missing-state·money]** Context-level: RN hydrates and exposes `recentLocations` from GET /api/location (recently used viewing places, with radius and source id) so the place switcher can offer recents. Neither native app de",
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