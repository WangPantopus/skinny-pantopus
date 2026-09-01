export const meta = {
  name: 'parity-high-gigs-money',
  description: 'Fix all 10 high-severity gigs + money RN→native parity findings on iOS + Android',
  phases: [
    { title: 'Implement', detail: '5 packages, each doing both platforms' },
    { title: 'Audit', detail: 'per-platform adversarial review of the wave diff' },
  ],
}

const BRIEF = '/Users/yingpengwang/pantopus/native/pantopus/docs/_parity-work/BRIEF.md'

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

function pkg(id, title, findings, extra) {
  return { id, title, prompt: [
    `Read ${BRIEF} first and follow it exactly.`, '',
    `# Work package ${id} — ${title}`, '',
    'Implement the following high-severity parity findings on BOTH iOS and Android.',
    'Each bullet is quoted verbatim from docs/rn-functional-parity.md and already contains the',
    'RN source file:line, the backend endpoint, and the current native file:line on each platform.',
    'Verify each pointer still matches the tree before you rely on it.', '',
    findings, '', extra || '', '',
    'Work through every finding in this package. Return the JSON result object.',
  ].join('\n') }
}

const PACKAGES = [
  pkg('G1', 'Tasks feed pagination + viewer-bid state on gig detail',
    `- **[missing-state]** The Tasks feed has no pagination on either native app — RN infinite-scrolls (\`onEndReached\` → \`fetchGigsPage(page+1)\`, PAGE_SIZE 15, \`hasMore\`), native issues one \`GET /api/gigs?limit=20&offset=0\` and never requests another page, so tasks 21+ are unreachable in flat-list mode.
  RN \`src/app/(tabs)/gigs.tsx:273-278\` · endpoint \`GET /api/gigs (page/offset)\`
  iOS: Features/Gigs/GigsFeedViewModel.swift:343-370 \`fetchFlat()\` hard-codes \`limit: 20\`, never passes \`offset\`; no loadMore/hasMore anywhere in the file
  Android: ui/screens/gigs/GigsFeedViewModel.kt:572 \`fetchFlat()\` — same, no loadMore/offset
- **[missing-state]** Gig detail has no "your existing bid" state natively. RN loads the viewer's own bid and shows Update bid / Withdraw bid / Accept counter / Decline counter inline; native never calls \`/api/gigs/:gigId/my-bid\`, has no viewer-bid field on GigDTO, and its only bidder action is placeBid — so a user who already bid sees the same "Place bid" CTA and must leave for My Bids to change or pull it.
  RN \`src/components/gig-detail/BidPanel.tsx:106,224,251,268,292 (rendered by src/app/gig/[id].tsx:1304)\` · endpoint \`GET /api/gigs/:gigId/my-bid; PUT /api/gigs/:gigId/bids/:bidId; DELETE /api/gigs/:gigId/bids/:bidId; POST .../counter/accept|decline\`
  iOS: Features/ContentDetail/GigDetailViewModel.swift:518 has only \`placeBid\`; no \`my-bid\`, \`viewerBid\`, \`updateBid\` or \`withdrawBid\` reference in Features/ContentDetail/
  Android: ui/screens/contentdetail/GigDetailViewModel.kt — same; no my-bid endpoint in GigsApi.kt`,
    `Design references: "Pantopus-design/Gigs.html" (feed) and "A09 — Detail_ Transactional/A09.1 Task V2.html"
+ "A09.2 Gig V1.html" (detail + bid panel).

Notes:
- Pagination must include the loading-more footer state and a real \`hasMore\` derived from the
  server response, not from "did we get a full page" alone if the backend returns a total.
  Read the \`GET /api/gigs\` handler in backend/routes/gigs.js for the paging contract it actually
  supports (limit/offset vs page) and use that.
- Viewer bid: add the viewer-bid load to the gig-detail fetch, add the field to the gig detail
  projection on both platforms, and render Update / Withdraw / Accept-counter / Decline-counter
  in place of "Place bid" when a bid exists. Withdraw and decline need confirms.
- The counter accept/decline routes may already exist natively for the poster side — reuse
  rather than duplicating, and keep the poster-side flows working.`),

  pkg('G2', 'Pro-service and Delivery composer modules',
    `- **[missing-action]** Pro-service composer module absent from both native composers — a user cannot set requires_license, license_type, requires_insurance, scope_description, deposit_required or deposit_amount when posting a pro/quote task, so the gig detail's "Professional Requirements" section (which native renders) can never be populated from a native post.
  RN \`src/app/gig-v2/new.tsx:336-343\` · endpoint \`POST /api/gigs/magic-post (draft.requires_license, license_type, requires_insurance, scope_description, deposit_required, deposit_amount)\`
  iOS: Features/Compose/GigCompose/GigDraftQueue.swift:213 — \`case "pro_service_quote", "general": return nil\` (no module); no requires_license/scope_description string anywhere in Pantopus/
  Android: ui/screens/compose/gig/GigComposeModules.kt:68-75 \`GigComposeModuleFields\` when-block has no \`pro_service_quote\` branch
- **[missing-action]** Delivery composer module is reduced to a shopping-items list natively — pickup_address, pickup_notes, dropoff_address, dropoff_notes and delivery_proof_required cannot be entered, so a delivery/errand task posted from native has no pickup or drop-off location even though both native gig-detail screens render a "Delivery Route" module from those fields.
  RN \`src/app/gig-v2/new.tsx:320-333 (components/.../DeliveryModule.tsx)\` · endpoint \`POST /api/gigs/magic-post (draft.pickup_address, dropoff_address, pickup_notes, dropoff_notes, delivery_proof_required)\`
  iOS: Features/Compose/GigCompose/GigDraftQueue.swift:212,220 map delivery → \`.items\` only; \`pickupAddress\` appears only as a read field (GigDetailViewModel.swift:1338)
  Android: ui/screens/compose/gig/GigComposeModules.kt:73 \`"delivery_errand" -> ItemsModuleFields(...)\`; ItemsModuleFields (line 313) renders only a SHOPPING LIST`,
    `Design references: "A-12 Wizard (multi-step form)/A12.8 Post a Task.html" (check for a sibling
\`post-task-frames.jsx\` in that folder — prefer the jsx, 1px = 1dp/1pt) and
"A13 — Form (single screen)/Post Gig V1.html".

Notes:
- Read backend/routes/magicTask.js for the exact draft field names the magic-post endpoint
  accepts. Both native apps already READ these fields on gig detail — reuse those names so the
  round-trip matches.
- Delivery: the module becomes pickup + dropoff addresses with notes and a proof-required
  toggle. RN keeps the shopping-items list for the archetypes that need it — check RN's
  archetype→module mapping and mirror it rather than replacing items wholesale.
- Pro-service: licence toggle + licence type, insurance toggle, scope description,
  deposit-required toggle + amount. Validation must match RN (e.g. amount required when the
  deposit toggle is on).`),

  pkg('G3', 'Worker "Can\'t Make It" release and poster "Replace Worker" reopen',
    `- **[missing-action]** Assigned worker has no "Can't Make It" affordance natively — RN lets the worker unassign themselves, release the payment hold and reopen the task for bids. Natively an assigned worker who can no longer do the job has no exit path at all (only the poster can cancel).
  RN \`src/components/gig-detail/useCompletionFlow.ts:279-297 (rendered by src/app/gig/[id].tsx:1279 CompletionFlow)\` · endpoint \`POST /api/gigs/:gigId/worker-release\`
  iOS: not found (grep 'worker-release' over Pantopus/ = 0 hits)
  Android: not found (grep 'worker-release' over app/src/main = 0 hits)
- **[missing-action]** Poster has no "Replace Worker" affordance natively — RN unassigns the current worker, releases the payment hold and reopens bidding before work starts. Natively the poster's only option is a full cancel (with cancellation fees), which is a different outcome.
  RN \`src/components/gig-detail/useCompletionFlow.ts:219-236\` · endpoint \`POST /api/gigs/:gigId/reopen-bidding\`
  iOS: not found (grep 'reopen-bidding' over Pantopus/ = 0 hits); GigDetailView.swift:276-299 overflow offers only "Report task" + "Cancel task"
  Android: not found (grep 'reopen-bidding' over app/src/main = 0 hits)`,
    `Design reference: "A09 — Detail_ Transactional/A09.1 Task V2.html" (lifecycle CTAs + overflow menu).

Notes:
- Both routes live in backend/routes/gigs.js — read both handlers for their preconditions
  (which gig statuses allow them, who may call them) and gate the affordances on exactly those
  conditions, so the buttons never appear when the server would reject them.
- Both are destructive-ish: each needs a confirm dialog whose copy explains the payment-hold
  release and the reopen-for-bids consequence, matching RN's wording.
- After success, refresh the gig detail so the lifecycle section re-renders in its new state.
- "Replace Worker" belongs in the poster overflow next to Cancel task; "Can't Make It" belongs
  in the assigned-worker lifecycle section. Mirror placement across platforms.`),

  pkg('G4', 'Ask-a-neighbor package help gig (new route from mailbox)',
    `- **[missing-route]** Whole route missing: "Ask a neighbor for help with this package" (Hold Package / Put Inside / Sign for Me / Help Assemble / Custom) creates a gig pre-filled from a mailbox package. Reachable from mailbox/package.tsx:204 and mailbox/tasks.tsx:236. Neither native app calls any \`/api/mailbox/v2/p2/package/*\` route.
  RN \`src/app/mailbox/gig.tsx:49-56\` · endpoint \`POST /api/mailbox/v2/p2/package/:mailId/gig\`
  iOS: not found (grep 'v2/p2/package' over Pantopus/ = 0 hits)
  Android: not found (grep 'v2/p2/package' over app/src/main = 0 hits)`,
    `Design references: "A17 mobile Mailbox root archetype/A17.8 Package.html" (entry point) and
"A17 mobile Mailbox root archetype/A17.6 Gig mail.html".

Notes:
- \`/api/mailbox/v2/p2\` is backend/routes/mailboxV2Phase2.js (mounted at backend/app.js:316).
  Read the package-gig handler for the real body (help type, notes, offer) and its response —
  RN deep-links into the created gig afterwards, so the response must carry the new gig id.
- NEW route on both platforms, carrying the mail id. Entry points: the package detail overflow
  and the mail-task list, matching RN.
- A sibling agent in a different wave may also be touching the mailbox package screens. Use
  small anchored Edits and re-read + retry if an Edit fails.
- Help types: Hold Package / Put Inside / Sign for Me / Help Assemble / Custom — take the exact
  keys from RN's mailbox/gig.tsx, not from this summary.`),

  pkg('MONEY1', 'Invoice detail + pay, transaction history, Stripe Express dashboard',
    `- **[missing-endpoint]** Received-invoice detail + pay is fixture-only on both platforms. RN reads the real invoice (GET /api/businesses/invoices/{id}) and pays it (POST .../pay then POST .../confirm). Neither native app calls any /api/businesses/invoices/* endpoint — both render a hardcoded invoice ('Holiday lighting · install + takedown', $642.85, 'Brightside Outdoor') and the Pay CTA is permanently disabled with 'This invoice can't be paid yet.'
  RN \`src/app/invoice/[id].tsx:41,54,56\` · endpoint \`GET /api/businesses/invoices/{id}, POST /api/businesses/invoices/{id}/pay, POST /api/businesses/invoices/{id}/confirm\`
  iOS: Features/ContentDetail/InvoiceDetailViewModel.swift:55-57 (load() → Self.fixture), :63-68 (payNow guards on checkoutRequest); the only caller, Features/Root/HubTabRoot.swift:1865, constructs InvoiceDetailViewModel(invoiceId:) with no checkoutRequest, so payNow always returns .declined
  Android: ui/screens/contentdetail/InvoiceDetailViewModel.kt:86-91 (load() → Projection.fixture), :103-110 (checkoutRequest null unless gigId or listingId+offerId nav args are supplied; the invoices/{invoiceId} route in RootTabScreen.kt:1210 supplies neither)
- **[missing-endpoint]** The Transaction History tab is gone. RN lists every payment/payout with type, status, counterparty and tip/payout iconography from GET /api/payments/history. Neither native app calls that endpoint anywhere; both hardcode an 'No transactions yet' empty block into the Payments screen's Activity section, so it can never populate.
  RN \`src/components/payments/HistoryTab.tsx:26 (reached via src/app/settings/payments.tsx:64)\` · endpoint \`GET /api/payments/history\`
  iOS: Features/Settings/Payments/PaymentsViewModel.swift:184-187 — liveFrame() sets activity: .empty(...) unconditionally; no PaymentsEndpoints helper for /api/payments/history exists
  Android: ui/screens/settings/payments/PaymentsMapper.kt:15-27 — liveFrame() sets activity = PaymentsActivity.Empty(...) unconditionally; data/api/services/PaymentsApi.kt has no history method
- **[missing-action]** An onboarded seller cannot open their Stripe Express dashboard. RN shows an 'Open Stripe Dashboard' button whenever the Connect account is onboarded. Both native apps implement openDashboard(), but it is only wired to the PayoutMethodCard's 'Manage' control, and the live mapper always sets payoutMethod = null, so that card never renders outside previews — the action is unreachable in the shipped app.
  RN \`src/components/payments/PayoutsTab.tsx:106-123, 192-195\` · endpoint \`POST /api/payments/connect/dashboard\`
  iOS: Features/Wallet/WalletViewModel.swift:223-234 (openDashboard) but makeContent sets payoutMethod: nil at :266; WalletView.swift:87-96 renders the Payout-method section only \`if let payoutMethod = content.payoutMethod\`
  Android: ui/screens/wallet/WalletViewModel.kt:142-152 (openDashboard) but WalletMapper.kt:43 sets payoutMethod = null; WalletScreen.kt:454-460 renders it only under \`content.payoutMethod?.let\``,
    `Design references: "A09 — Detail_ Transactional/A09.4 Invoice.html", "A14 — Settings list/A14.6 Payments.html",
"A10 — Detail_ Content/A10.10 Wallet.html".

Notes:
- Money surfaces: correctness matters more than speed here. Read the real handlers in
  backend/routes/businesses.js (invoices) and backend/routes/pays.js (payments) for exact
  amounts/currency/status field names. Never round or re-derive money client-side beyond
  formatting; render the server's amounts.
- Invoice: replace the fixture with a real fetch keyed on the invoice id the route already
  carries, and make Pay run the real pay → confirm sequence (including the Stripe payment-sheet
  step the native apps already use elsewhere for gigs/listings — reuse that machinery).
- History: add the endpoint + DTO + mapping and populate the Activity section with type, status,
  counterparty and tip/payout iconography. Keep a genuine empty state for users with no history.
- Payout method: derive it from the real Connect account status so the card renders when the
  account is onboarded, which is what makes "Open Stripe Dashboard" reachable. If the Connect
  status response has no payout-method detail, render the dashboard action from the onboarded
  flag directly rather than leaving it unreachable, and say what you did.`),
]

phase('Implement')
const results = await parallel(PACKAGES.map((p) => () =>
  agent(p.prompt, { label: `${p.id}:${p.title.slice(0, 34)}`, phase: 'Implement', schema: RESULT_SCHEMA })))
const done = results.filter(Boolean)
log(`${done.length}/${PACKAGES.length} packages returned`)

phase('Audit')
const AUDIT_COMMON = [
  `Read ${BRIEF} for repo paths and conventions.`, '',
  'Five sibling agents just landed changes for the 10 high-severity gigs + money findings in',
  'docs/rn-functional-parity.md. They worked in parallel in the same tree, so hunt for:',
  '(a) two agents clobbering the same shared file, (b) a claimed wiring that does not exist,',
  '(c) fixture data left where the finding said it must be live, (d) a route/DI registration',
  'that was never added, (e) CI-breaking convention violations.',
  'Money code gets extra scrutiny: wrong currency units (cents vs dollars), a pay path that can',
  'double-charge, or a CTA enabled when the server would reject it are all blockers.', '',
  'Here is what they reported:', JSON.stringify(done, null, 2).slice(0, 20000), '',
  'Use `git diff --stat` / `git status` from /Users/yingpengwang/pantopus/native/pantopus, then',
  'read the actual files. Trust the diff, not the reports.', '',
  'Do NOT run a build — a compile gate runs after you.',
  'FIX what you find, directly, with small anchored Edits. Then report.',
].join('\n')

const audits = await parallel([
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **iOS only** (frontend/apps/ios). Verify new route cases exist in the route enum AND `destination(for:)`, new .swift files fall inside project.yml source globs, no `Features/**` hex literals or `Image(systemName:)`, and new ViewModels are `@Observable @MainActor` with all four render states.'].join('\n'),
    { label: 'audit:ios', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **Android only** (frontend/apps/android). Verify every new Retrofit interface has a `@Provides @Singleton` in di/NetworkModule.kt, every new route constant has a matching `composable(...)` in RootTabScreen.kt and is navigated to, nav args come through SavedStateHandle with a declared key, and no `ui/screens/**` `Color(0xFF…)` or `Icons.Filled.*`.'].join('\n'),
    { label: 'audit:android', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
])

return { packages: done, audits: audits.filter(Boolean) }
