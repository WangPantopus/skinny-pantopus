export const meta = {
  name: 'parity-high-mailbox',
  description: 'Fix all 10 high-severity mailbox RN→native parity findings on iOS + Android',
  phases: [
    { title: 'Implement', detail: '5 packages, each doing both platforms' },
    { title: 'Audit', detail: 'per-platform adversarial review of the wave diff' },
  ],
}

const BRIEF = '/Users/yingpengwang/pantopus/native/pantopus/docs/_parity-work/BRIEF.md'

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['package', 'status', 'ios', 'android', 'endpointsVerified', 'deferred'],
  properties: {
    package: { type: 'string' },
    status: { type: 'string', enum: ['complete', 'partial', 'blocked'] },
    ios: {
      type: 'object', additionalProperties: false,
      required: ['filesCreated', 'filesEdited', 'summary'],
      properties: {
        filesCreated: { type: 'array', items: { type: 'string' } },
        filesEdited: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' },
      },
    },
    android: {
      type: 'object', additionalProperties: false,
      required: ['filesCreated', 'filesEdited', 'summary'],
      properties: {
        filesCreated: { type: 'array', items: { type: 'string' } },
        filesEdited: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' },
      },
    },
    endpointsVerified: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['method', 'path', 'backendRef'],
        properties: { method: { type: 'string' }, path: { type: 'string' }, backendRef: { type: 'string' } },
      },
    },
    deferred: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['what', 'why', 'evidence'],
        properties: { what: { type: 'string' }, why: { type: 'string' }, evidence: { type: 'string' } },
      },
    },
  },
}

const AUDIT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['platform', 'issues'],
  properties: {
    platform: { type: 'string' },
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

function pkg(id, title, findings, extra) {
  return {
    id, title,
    prompt: [
      `Read ${BRIEF} first and follow it exactly.`,
      '',
      `# Work package ${id} — ${title}`,
      '',
      'Implement the following high-severity parity findings on BOTH iOS and Android.',
      'Each bullet is quoted verbatim from docs/rn-functional-parity.md and already contains',
      'the RN source file:line, the backend endpoint, and the current native file:line on each',
      'platform. Verify each pointer still matches the tree before you rely on it.',
      '',
      findings,
      '',
      extra || '',
      '',
      'Work through every finding in this package. Return the JSON result object.',
    ].join('\n'),
  }
}

const PACKAGES = [
  pkg(
    'M1',
    'Mailbox entry points: compose FAB, routing banner, stationery auto-open',
    `- **[missing-action]** RN's Mailbox has a Compose FAB that opens the 4-step compose flow (Porch Call → Address It → Write It → Seal & Send). Both native apps ship the equivalent CeremonialMail wizard but it is reachable ONLY from a debug-gated menu row, so in a release build no user can compose mail from the Mailbox at all.
  RN \`src/app/mailbox/compose.tsx:1-253 (entry: src/app/mailbox/index.tsx:300-307)\` · endpoint \`POST /api/mailbox/send (compose recipients: GET /api/mailbox/compose/recipients, GET /api/mailbox/compose/home-context/:homeId)\`
  iOS: Features/Mailbox/MailboxRoot/MailboxRootViewModel.swift:117-126 — the only FAB on the Mailbox root is \`.scanLine\` → map. CeremonialMailWizardView is pushed only from Features/Root/YouTabRoot.swift:749 (\`case "me.debug.openCeremonialMail"\`), whose row is inside \`#if DEBUG\` (Features/Me/MeViewModel.swift:116-121).
  Android: ui/screens/mailbox/mailbox_root/MailboxRootScreen.kt:83-88 — FAB → onOpenMap. CEREMONIAL_MAIL is navigated only from ui/screens/you/YouScreen.kt:239 \`"me.debug.openCeremonialMail" -> if (BuildConfig.DEBUG) onOpenCeremonialMail()\`.
- **[missing-action]** RN polls pending mail-routing on the Mailbox root and shows an 'N items need routing' banner that opens the disambiguation queue. Neither native app ever calls GET /api/mailbox/v2/pending, and the ported Disambiguate form is only reachable from a DEBUG dialog that requires typing a mail id — so a user can never resolve mis-routed mail.
  RN \`src/app/mailbox/index.tsx:65-70,176-188 + src/app/mailbox/disambiguate.tsx:26,38\` · endpoint \`GET /api/mailbox/v2/pending → POST /api/mailbox/v2/resolve\`
  iOS: No \`/api/mailbox/v2/pending\` endpoint exists (Core/Networking/Endpoints/MailboxV2Endpoints.swift has drawers/drawer/item/action/package/resolve/community-rsvp/translate/p3Tasks only). DisambiguateMailFormView is presented only at Features/Root/YouTabRoot.swift:506-512 behind \`me.debug.disambiguate\`.
  Android: data/mailbox/MailboxRepository.kt:133-134 defines \`pending()\` but no ViewModel calls it. DisambiguateMailFormScreen route (ui/screens/root/RootTabScreen.kt:2965-2969) is navigated only from YouScreen.kt:236 \`if (BuildConfig.DEBUG)\`.
- **[missing-action]** RN auto-redirects any mail carrying a stationery theme from the generic detail into the ceremonial open experience (envelope tap-to-open, voice postscript playback, ceremonial action buttons). Native ports the CeremonialMailOpen screen but nothing routes to it in production — mail detail never checks for stationery, so received personal letters always land on the plain detail screen.
  RN \`src/app/mailbox/detail.tsx:43-49 + src/app/mailbox/open.tsx:1-812\` · endpoint \`GET /api/mailbox/v2/item/:id (object_payload.payload.stationeryTheme)\`
  iOS: MailDetailViewModel.swift/MailDetailProjection.swift never inspect \`stationeryTheme\`; CeremonialMailOpenView is presented only from the debug sheet at Features/Root/YouTabRoot.swift (\`me.debug.openCeremonialMailOpen\`, MeViewModel.swift:122-127).
  Android: ui/screens/mailbox/mail_detail/MailDetailViewModel.kt has no stationery branch; CEREMONIAL_MAIL_OPEN is navigated only from the BuildConfig.DEBUG dialog in ui/screens/you/YouScreen.kt:240,454.`,
    `Design references: "A17 mobile Mailbox root archetype/Mailbox Mobile.html" (root: FAB + banner),
"Pantopus-design/Ceremonial Mail Compose.html", "Pantopus-design/Ceremonial Mail Open.html",
"A13 — Form (single screen)/Disambiguate.html".

Notes:
- All three findings are about REACHABILITY of screens that already exist. Keep the debug rows
  if you like, but the production entry points are what matter.
- The Mailbox root needs both a compose affordance AND the existing map affordance — read the
  design frame to decide the arrangement (FAB + top-bar action, or a small FAB menu) rather
  than silently dropping the map entry.
- The pending-routing banner is a poll-on-appear read of \`GET /api/mailbox/v2/pending\`;
  it renders only when the count is > 0 and taps into the disambiguation queue. The native
  Disambiguate form currently demands a typed mail id — give it a real queue to work from.
- Stationery: read the real \`GET /api/mailbox/v2/item/:id\` payload shape in
  backend/routes/mailboxV2.js to find where the stationery theme actually lives before you
  branch on it. Then branch in the mail-detail load, exactly like RN's detail.tsx:43-49.`
  ),
  pkg(
    'M2',
    'Community mail feed + Home Records asset hub (two new routes)',
    `- **[missing-route]** Entire Community mail route missing natively: neighborhood/civic feed with type filter chips, pull-to-refresh, four reaction types, RSVP-to-event, and flag-for-review. Native only has an RSVP button inside the community mail-detail variant.
  RN \`src/app/mailbox/community.tsx:1-228 (entry: src/app/mailbox/index.tsx:240)\` · endpoint \`GET /api/mailbox/v2/p3/community/feed, POST /p3/community/react, POST /p3/community/rsvp, POST /p3/community/flag\`
  iOS: not found. Only MailboxV2Endpoints.swift:81 \`POST /api/mailbox/v2/community/rsvp\` exists (used by MailDetailViewModel.setRsvp).
  Android: not found. MailboxV2Api.kt exposes only \`api/mailbox/v2/community/rsvp\`.
- **[missing-route]** Entire Home Records route missing natively: linked home assets with room filter chips, per-asset mail drill-down, and the 'Auto-detect assets' scan that mines recent mail for appliance/warranty mentions. Native's RecordsDetailLayout is only a mail-detail body variant, not this asset hub.
  RN \`src/app/mailbox/records.tsx:1-342 (entry: src/app/mailbox/index.tsx:238)\` · endpoint \`GET /api/mailbox/v2/p3/records/assets, GET /p3/records/asset/:id/mail, POST /p3/records/auto-detect, GET /p3/records/suggestions, POST /p3/records/link, DELETE /p3/records/unlink/:id\`
  iOS: not found — no reference to \`p3/records\` anywhere. Features/Mailbox/MailDetail/Variants/RecordsDetailLayout.swift is a per-mail body, not the asset index.
  Android: not found — no reference to \`p3/records\`. ui/screens/mailbox/mail_detail/variants/RecordsDetailLayout.kt is the mail-body variant only.`,
    `Design references: "A17 mobile Mailbox root archetype/A17.4 Community mail.html" and
"A17 mobile Mailbox root archetype/A17.10 Records.html".

Notes:
- The \`/api/mailbox/v2/p3\` prefix is mounted at backend/app.js:317 from
  backend/routes/mailboxV2Phase3.js — read that file for the real route-relative paths,
  request bodies and response shapes. Both feeds have several routes; verify each one.
- Two NEW routes on each platform, entered from the Mailbox root (RN enters both from
  mailbox/index.tsx). Add route cases + destinations with small anchored Edits per the brief.
- Community: type filter chips, pull-to-refresh, four reaction types, RSVP, flag-for-review.
  The existing community mail-detail RSVP must keep working — do not regress it.
- Records: room filter chips, per-asset mail drill-down, and the auto-detect scan with its
  suggestions → link / unlink actions.`
  ),
  pkg(
    'M3',
    'Earn: paid-offer wall (offers, balance, open/close/save/reveal)',
    `- **[missing-endpoint]** RN's Earn drawer is a paid-offer wall: list offers, open an offer (dwell-timed, with a daily-cap rate-limit message), close it to bank the reward, save an offer, and reveal its promo code. Native's Earn screen is a completely different surface (earnings summary/history), so none of the offer-engagement actions or the earn balance exist.
  RN \`src/app/mailbox/earn.tsx:29-93 (entry: src/app/mailbox/index.tsx:86-88)\` · endpoint \`GET /api/mailbox/v2/earn/offers, GET /earn/balance, POST /earn/open, POST /earn/close/:offerId, POST /earn/save/:offerId, POST /earn/reveal/:offerId\`
  iOS: Features/Mailbox/Earn/EarnViewModel.swift:88-107 calls only MailboxEndpoints.earningsSummary()/earningsHistory() (\`/api/mailbox/earnings/*\`). No \`v2/earn/offers|balance|open|close|save|reveal\`.
  Android: ui/screens/mailbox/earn/EarnViewModel.kt uses the same earnings endpoints; data/mailbox/MailboxRepository.kt:165-166 defines \`earnBalance()\` but nothing calls it, and no offers endpoints exist at all.`,
    `Design reference: "A10 — Detail_ Content/A10.11 Earn.html".

Notes:
- \`/api/mailbox/v2\` is mounted at backend/app.js:315 from backend/routes/mailboxV2.js. Read the
  earn handlers there for the real paths, the dwell-time contract on open/close, the daily-cap
  rate-limit response, and the reveal payload.
- The existing earnings summary/history surface is a different, real feature. Decide from the
  design frame whether Earn becomes two sections/tabs (Offers + Earnings) or the offer wall
  replaces the summary as the primary view, and state your choice in the result. Do not delete
  the earnings history.
- Handle the daily-cap rate-limit as a first-class state with RN's message, not a generic error.
- The dwell timer must be real: open records a start, close banks the reward only after the
  server accepts it. Reflect the server's returned balance rather than incrementing locally.`
  ),
  pkg(
    'M4',
    'Mail-task list + create + convert-to-gig, and Unboxing persistence',
    `- **[missing-action]** RN has a mail-task LIST with a create-task form (title/description/priority), a show-completed toggle, complete/reopen tap, and 'Convert to neighbor gig'. Native only ports the single-task DETAIL screen — there is no task list, no way to create a task from a mail item, and no convert-to-gig.
  RN \`src/app/mailbox/tasks.tsx:47,59-90,99,115-123 (entry: src/app/mailbox/detail.tsx:221-227)\` · endpoint \`POST /api/mailbox/v2/p3/tasks/from-mail, POST /p3/tasks/:taskId/to-gig\`
  iOS: Features/Mailbox/MailTask/MailTaskViewModel.swift:72 fetches \`p3Tasks()\` then selects one task by id; MailboxV2Endpoints.swift has no \`tasks/from-mail\` or \`:id/to-gig\`. MailDetailView exposes only \`onOpenExtractedTask\` (HubTabRoot.swift:1533-1537) for tasks that already exist.
  Android: ui/screens/mailbox/mail_task/MailTaskViewModel.kt mirrors iOS; MailboxV2Api.kt has only \`api/mailbox/v2/p3/tasks\` (GET) and \`p3/tasks/{id}\` (PATCH). No from-mail / to-gig.
- **[missing-endpoint]** RN's Unboxing flow persists: record a condition photo, save the warranty/manual doc to the vault, and post an assembly/help gig. Both native Unboxing screens are pure sample-fixture state machines — capture/confirm/undo only mutate in-memory fixtures and no unboxing data ever reaches the backend.
  RN \`src/app/mailbox/unboxing.tsx:28,36,47 (entry: src/app/mailbox/package.tsx:183)\` · endpoint \`POST /api/mailbox/v2/p2/package/:mailId/unboxing, POST /p2/package/:mailId/save-warranty, POST /p2/package/:mailId/gig\`
  iOS: Features/Mailbox/Unboxing/UnboxingViewModel.swift:45,71-120 — every action projects \`UnboxingSampleData\`; the VM holds no APIClient. Route also carries no mail id (YouTabRoot.swift:2196).
  Android: ui/screens/mailbox/unboxing/UnboxingViewModel.kt:30,51,76 — same sample-only fixture; RootTabScreen.kt:4220-4225 comments that OCR/classification/vault upload are out of scope.`,
    `Design references: "A17 mobile Mailbox root archetype/A17.12 Mail task.html" and
"A17 mobile Mailbox root archetype/A17.14 Unboxing.html".

Notes:
- \`/api/mailbox/v2/p2\` is backend/routes/mailboxV2Phase2.js (app.js:316); \`/p3\` is
  mailboxV2Phase3.js (app.js:317). Read both for the real paths/bodies.
- Mail tasks: add the LIST surface (with show-completed toggle and complete/reopen), the
  create-from-mail form, and convert-to-gig. Keep the existing single-task detail working and
  reachable from the list.
- Unboxing: the route must carry the mail id on both platforms — that is a route-signature
  change, so update the route enum/ChildRoutes and every caller. Then replace the fixture
  state machine with real posts. Photo capture needs a real image source and a real upload leg;
  if there is no upload route that accepts an unboxing photo, wire what exists and record the
  gap in \`deferred\` with evidence instead of faking a URL.`
  ),
  pkg(
    'M5',
    'iOS Mailbox Map + Vacation Hold networking, and per-category mail actions',
    `- **[one-platform-only]** iOS Mailbox Map and Vacation Hold are sample-fixture screens with no network at all; Android wires both to the real backend. Android is right. On iOS a user cannot see real map pins or actually schedule/cancel a mail hold — the 'Start hold' UI changes local state only.
  RN \`src/app/mailbox/maps.tsx:115,136-146,155 and src/app/mailbox/vacation.tsx:57,78,99\` · endpoint \`GET /api/mailbox/v2/p3/vacation/status, POST /p3/vacation/start, POST /p3/vacation/cancel, GET /p3/map/pins\`
  iOS: Features/Mailbox/MailboxMap/MailboxMapViewModel.swift:33 seeds \`MailboxMapSampleData.spots\` (no APIClient); Features/Mailbox/Vacation/VacationHoldViewModel.swift:46,48,99,112 only swaps \`VacationHoldSampleData\` modes.
  Android: CORRECT — data/mailbox/MailboxRepository.kt:168-182 wires vacationStatus/startVacation/cancelVacation and mapPins; ui/screens/mailbox/vacation/VacationHoldViewModel.kt:28-32 documents iOS as the lagging platform.
- **[missing-action]** RN's mail detail renders a per-category action row (bill → Pay/Remind/File/Forward/Dispute; legal → File Now/Forward/Remind; notice → Acknowledge/Share with Household/Create Task/File; promo → Save Offer/Dismiss) and posts each to the mail-action endpoint, with pay/sign suppressed for unknown senders. Native's detail exposes only Acknowledge + Move-to-vault; the action endpoint is defined but has no production caller.
  RN \`src/app/mailbox/detail.tsx:56-72,188-208 (CATEGORY_ACTIONS in src/components/mailbox/constants.ts:25-33)\` · endpoint \`POST /api/mailbox/v2/item/:id/action\`
  iOS: Features/Mailbox/MailDetail/Variants/GenericMailDetailLayout.swift:499,535,545-547 — only \`onAck\` and \`onMove\` are wired; the other secondary tiles are \`Button(action: {})\`. MailboxV2Endpoints.swift:38-41 defines the action endpoint but nothing calls it.
  Android: data/mailbox/MailboxRepository.kt:106-109 \`itemAction\` is called only from ui/screens/mailbox/item_detail/MailboxItemDetailViewModel.kt:339,418, and that screen is not routed — RootTabScreen.kt:2856-2874 renders MailDetailScreen for MAILBOX_ITEM_DETAIL, so MailboxItemDetailScreen is dead code.`,
    `Design references: "A11 — Map + list hybrid …/Mailbox Map.html", "A14 — Settings list/A14.8 Vacation hold.html",
"A17 mobile Mailbox root archetype/A17.1 Mail item (generic).html".

Notes:
- For the iOS map/vacation work, **Android is the reference implementation** — mirror its
  repository calls, states and error handling rather than inventing a new contract. Read
  data/mailbox/MailboxRepository.kt:168-182 and the Android VMs first.
- Category actions: port CATEGORY_ACTIONS from
  pantopus/frontend/apps/mobile/src/components/mailbox/constants.ts:25-33 verbatim (do not
  paraphrase the action sets), wire each tile to POST /api/mailbox/v2/item/:id/action with the
  action key the backend expects, and reproduce RN's suppression of pay/sign for unknown senders.
- Android has dead code: MailboxItemDetailScreen is unrouted while MailDetailScreen is what
  renders. Do not "fix" this by routing the dead screen — put the actions on the screen that is
  actually rendered, and note in your result what you did with the dead file (leave it or
  delete it, but say which and why).`
  ),
]

phase('Implement')

const results = await parallel(
  PACKAGES.map((p) => () =>
    agent(p.prompt, { label: `${p.id}:${p.title.slice(0, 34)}`, phase: 'Implement', schema: RESULT_SCHEMA })
  )
)

const done = results.filter(Boolean)
log(`${done.length}/${PACKAGES.length} packages returned`)

phase('Audit')

const AUDIT_COMMON = [
  `Read ${BRIEF} for repo paths and conventions.`,
  '',
  'Five sibling agents just landed changes for the 10 high-severity mailbox findings in',
  'docs/rn-functional-parity.md. They worked in parallel in the same tree, so hunt for:',
  '(a) two agents clobbering the same shared file, (b) a claimed wiring that does not exist,',
  '(c) sample/fixture data left where the finding said it must be live, (d) a route/DI',
  'registration that was never added so a new screen is unreachable, (e) convention violations',
  'that fail CI (hex literals, Image(systemName:), Icons.Filled.*, raw Color(0xFF…)).',
  '',
  'Here is what they reported:',
  JSON.stringify(done, null, 2).slice(0, 20000),
  '',
  'Use `git diff --stat` / `git status` from /Users/yingpengwang/pantopus/native/pantopus to see',
  'the real change set, then read the actual files. Trust the diff, not the reports.',
  '',
  'Do NOT run a build — a compile gate runs after you.',
  'FIX what you find, directly, with small anchored Edits. Then report.',
].join('\n')

const audits = await parallel([
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **iOS only** (frontend/apps/ios). Verify every new route case exists in its route enum AND `destination(for:)`, that new .swift files fall inside the XcodeGen source globs in project.yml, that no `Features/**` file has a hex literal or `Image(systemName:)`, and that new ViewModels are `@Observable @MainActor` with all four render states.'].join('\n'),
    { label: 'audit:ios', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **Android only** (frontend/apps/android). Verify every new Retrofit interface has a `@Provides @Singleton` in di/NetworkModule.kt, every new route constant has a matching `composable(...)` in RootTabScreen.kt and is actually navigated to, nav args are read via SavedStateHandle with a declared key, and no `ui/screens/**` file has `Color(0xFF…)` or `Icons.Filled.*`.'].join('\n'),
    { label: 'audit:android', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
])

return { packages: done, audits: audits.filter(Boolean) }
