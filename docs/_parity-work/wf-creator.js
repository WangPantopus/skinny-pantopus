export const meta = {
  name: 'parity-high-creator-biz',
  description: 'Fix all 11 high-severity creator-biz RN→native parity findings on iOS + Android',
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
  pkg('C1', 'Beacon (persona) create + edit + media, and broadcast media upload',
    `- **[missing-endpoint]** Beacon (persona) create + edit is completely non-functional natively. RN creates/updates the persona and uploads avatar/banner; both native Edit-Persona screens render a hard-coded sample fixture and never persist. \`POST /api/personas\`, \`PATCH /api/personas/:id\` and \`POST /api/upload/persona-media/:id\` are called by zero native code on either platform. The iOS "Create your Beacon" empty-state CTA pushes \`.editPersona(personaId: EditPersonaSampleData.personaId)\` — i.e. straight into the fixture. A user cannot create a Beacon, change handle/display name/bio/category/audience label/audience mode/public links, or set an avatar or banner.
  RN \`src/app/identity/persona.tsx:451-484\` · endpoint \`POST /api/personas, PATCH /api/personas/:id, POST /api/upload/persona-media/:id\`
  iOS: Features/AudienceProfile/EditPersona/EditPersonaViewModel.swift:38-50 (load() returns EditPersonaSampleData, no API); entry point Features/Root/HubTabRoot.swift:1677-1679
  Android: ui/screens/audience_profile/edit_persona/EditPersonaViewModel.kt:57-78 (falls back to EditPersonaSampleData; no save path — EditPersonaScreen.kt:1446 "Save" button is inert)
- **[missing-action]** Media attached to a Beacon update is silently dropped at publish on both platforms. Both native compose screens let the user pick a photo/video (\`attachMedia\`) and render a preview, but the publish body is \`{body, visibility, target_tier_rank}\` only — there is no upload leg and no \`media\` field. RN uploads Live Photos before the post and regular media after it, supports up to 9 items, and offers camera capture (native offers library pick only, single item).
  RN \`src/app/identity/broadcast.tsx:107-145\` · endpoint \`POST /api/broadcast/channels/:channelId/messages (media[] param), POST /api/upload/post-media\`
  iOS: Features/AudienceProfile/ComposeBroadcast/ComposeBroadcastViewModel.swift:131-146 (publish sends PublishUpdateBody without media) vs :214-221 attachMedia
  Android: ui/screens/audience_profile/compose_broadcast/ComposeBroadcastViewModel.kt:133-147 (realPublish) + data/api/models/audience/AudienceProfileDtos.kt:183-187 (PublishUpdateBody has no media field)`,
    `Design references: "A13 — Form (single screen)/Edit Persona.html", "A22 — Creator Audience hub/A22.2 Compose Broadcast.html",
"A21 — Public Beacon profile/A21.1 Persona Profile.html".

Notes:
- Personas are behind a feature gate in backend/app.js (\`if (isPersonaEnabled())\`, ~line 359).
  Read backend/routes/personas.js for the real create/patch bodies and
  backend/routes/upload.js for the persona-media multipart contract.
- Edit Persona must load the REAL persona (or an empty create form when the user has none) and
  actually save. Delete the EditPersonaSampleData path and fix the iOS empty-state CTA that
  currently pushes the fixture id.
- Broadcast media: add the upload leg and the \`media\` field to the publish body on both
  platforms. Multi-select up to 9 to match RN. If a platform's picker cannot do multi-select
  without a larger refactor, do the refactor — "single item only" is the finding.
- Both apps already have multipart upload machinery (iOS \`MultipartUploader\`, Android
  \`UploadApi\`) — extend it, don't fork it.`),

  pkg('C2', 'Business catalog CRUD + post-as-this-business',
    `- **[missing-action]** Business catalog is read-only natively. RN can create/rename/delete catalog categories, create/edit/delete catalog items, and drag-reorder items. Both native apps only call \`GET /api/businesses/:id/catalog/items\`; no POST/PATCH/DELETE catalog endpoint exists in either endpoint layer. An owner cannot add or price a single service/product from the native apps.
  RN \`src/app/businesses/[id]/index.tsx:313 (CatalogTab) → src/components/business/tabs/CatalogTab.tsx:40-179\` · endpoint \`POST/DELETE /api/businesses/:id/catalog/categories[/:catId], POST/PATCH/DELETE /api/businesses/:id/catalog/items[/:itemId], POST /api/businesses/:id/catalog/items/reorder\`
  iOS: Core/Networking/Endpoints/BusinessesEndpoints.swift:56 (catalogItems GET only); Features/Businesses/OwnerDashboard/BusinessOwnerView.swift:433 "Add a service" has no create call behind it
  Android: data/api/services/BusinessesApi.kt:80 (\`@GET api/businesses/{businessId}/catalog/items\` only)
- **[missing-action]** "Post as this business" is missing natively. RN's owner dashboard has a floating composer that publishes a business-authored post into the neighborhood feed (permission-gated to owner/admin/editor via \`access.role_base\`). Neither native owner dashboard has a compose affordance or the endpoint.
  RN \`src/app/businesses/[id]/index.tsx:74-82, 373-410\` · endpoint \`POST /api/businesses/:businessId/posts\`
  iOS: not found (Features/Businesses/OwnerDashboard/BusinessOwnerView.swift has edit/preview/services/gallery/team only)
  Android: not found (ui/screens/businesses/owner_dashboard/BusinessOwnerScreen.kt)`,
    `Design reference: "A10 — Detail_ Content/A10.7 Business (owner view).html".

Notes:
- Read backend/routes/businesses.js for the catalog handlers (categories + items + reorder) and
  the business-posts handler. Confirm the reorder body shape — it is usually an ordered id array.
- Catalog CRUD needs: category create/rename/delete, item create/edit/delete, and reorder.
  Reorder should be a drag gesture where the platform supports it cheaply; if a full drag-and-drop
  list is disproportionate, move-up/move-down actions that hit the same reorder endpoint are
  acceptable — say which you shipped.
- Deleting a category or item needs a confirm naming it.
- "Post as this business" must be gated on \`access.role_base\` ∈ owner/admin/editor exactly as RN
  gates it, and should reuse the existing post composer rather than a bespoke one.`),

  pkg('C3', 'Business Stripe Connect, invoicing, verification + private record',
    `- **[missing-endpoint]** Stripe Connect for a business is entirely absent natively. RN can read the connected account, start onboarding, refresh an expired account link, and open the Stripe express dashboard. Grepping both native apps for \`stripe\` in the networking layer returns zero endpoints. An owner cannot get paid through the native apps.
  RN \`src/app/businesses/[id]/index.tsx:352 (PaymentsTab) → src/components/business/tabs/PaymentsTab.tsx:23-54\` · endpoint \`POST /api/businesses/:id/stripe/connect, GET /api/businesses/:id/stripe/account, POST /api/businesses/:id/stripe/refresh-link, POST /api/businesses/:id/stripe/dashboard-link\`
  iOS: not found
  Android: not found
- **[missing-endpoint]** Business invoicing has no native surface. RN lists invoices (paged), creates an invoice, and voids one. No \`invoice\` endpoint exists in either native networking layer.
  RN \`src/app/businesses/[id]/index.tsx:350 (InvoicesTab) → src/components/business/tabs/InvoicesTab.tsx:49-105\` · endpoint \`GET /api/businesses/:id/invoices, POST /api/businesses/:id/invoices, PATCH /api/businesses/:id/invoices/:invoiceId {status:'void'}\`
  iOS: not found
  Android: not found
- **[missing-endpoint]** Business verification and private/legal data are unreachable natively. RN reads verification status, uploads verification evidence, and reads/updates the business private record (legal name, EIN, registered address). Native renders a verification badge on the dashboard but has no endpoint to advance verification or edit the private record.
  RN \`src/app/businesses/[id]/index.tsx:362 (LegalTab) → src/components/business/tabs/LegalTab.tsx:44-98\` · endpoint \`GET /api/businesses/:id/verify/status, POST /api/businesses/:id/verify/upload-evidence, POST /api/businesses/:id/verify/self-attest, GET/PATCH /api/businesses/:id/private\`
  iOS: not found (Core/Networking/Endpoints/BusinessesEndpoints.swift has no /verify or /private path)
  Android: not found (data/api/services/BusinessesApi.kt has no /verify or /private path)`,
    `Design reference: "A10 — Detail_ Content/A10.7 Business (owner view).html" (owner tabs).

Notes:
- Verification routes are in backend/routes/businessVerification.js (mounted at /api/businesses,
  app.js:347); the rest are in backend/routes/businesses.js. Read both.
- Stripe Connect onboarding and the dashboard link both return URLs that must be opened in a
  browser/ASWebAuthenticationSession-style surface. Reuse whatever the apps already do for the
  personal Stripe Connect flow (Wallet/Payments) instead of inventing a second pattern — find it
  first.
- **This package handles legal/PII (legal name, EIN, registered address).** Do not log these
  values, do not put them in query strings, and do not cache them beyond the screen's lifetime.
- Invoices: paged list + create + void, with a confirm on void.
- These are three new owner tabs/sections on the business owner dashboard. Follow the design's
  owner-view tab structure; do not bolt them onto the customer-facing business profile.`),

  pkg('C4', 'Business page-block editor + custom Pages CMS + b/:username/:slug deep link',
    `- **[missing-route]** The whole block-based business Page editor has no native equivalent. RN loads page blocks, adds blocks from a picker, reorders (move up/down), deletes, toggles a preview mode, saves a draft revision and publishes it. Native's \`PageEditor\` feature is a business-profile field editor (name/description/hours/gallery), not a page-block builder — \`/api/businesses/:id/pages/:pageId/blocks\`, \`.../draft\`, \`.../publish\` and \`.../revisions\` appear nowhere in either native app.
  RN \`src/app/businesses/[id]/page-editor.tsx:62-193\` · endpoint \`GET/PUT /api/businesses/:id/pages/:pageId/blocks, POST /api/businesses/:id/pages/:pageId/publish, GET/POST .../revisions[/:rev/restore]\`
  iOS: not found (Features/Businesses/PageEditor/EditBusinessPageViewModel.swift only calls BusinessesEndpoints.business/updateBusiness/publishBusiness/locationHours/catalogItems)
  Android: not found (ui/screens/businesses/page_editor/EditBusinessPageViewModel.kt — same profile-field scope)
- **[missing-endpoint]** Custom business Pages (the multi-page CMS) do not exist natively: no create page, no delete page, no revision history, no restore-revision. Consequently the \`b/:username/:slug\` universal link also degrades — RN redirects it to \`/business/:username?pageSlug=slug\`, while iOS DeepLinkRouter.swift:344-347 drops the slug segment and lands on the plain business profile.
  RN \`src/app/businesses/[id]/index.tsx:322 (PagesTab) → src/components/business/tabs/PagesTab.tsx:37-96\` · endpoint \`POST /api/businesses/:id/pages, DELETE /api/businesses/:id/pages/:pageId, GET /api/businesses/:id/pages/:pageId/revisions, POST .../revisions/:revision/restore\`
  iOS: not found; deep-link truncation at Core/Routing/DeepLinkRouter.swift:344-347
  Android: not found; deep-link case at core/routing/DeepLinkRouter.kt:469`,
    `Design references: "A13 — Form (single screen)/Edit Business Page.html" and
"A10 — Detail_ Content/A10.6 Business profile.html" + "A10.7 Business (owner view).html".

Notes:
- Read backend/routes/businessPublicPage.js (mounted at /api/b, app.js:350) and
  backend/routes/businesses.js for the pages/blocks/revisions routes — the doc mixes the two
  mounts and you must resolve which prefix each route really lives under.
- The block editor is the substantial piece: load blocks, add from a block-type picker, reorder
  (move up/down is fine), delete, preview toggle, save draft, publish. Model the block list as a
  typed sealed enum/sum type per platform so unknown block types degrade gracefully instead of
  crashing.
- The existing native "PageEditor" is a real profile-field editor. Keep it. The block builder is
  a separate surface — name the new files distinctly.
- Deep link: stop dropping the slug. Carry it through the router to the business profile so the
  named page opens, matching RN's redirect. Both platforms.`),

  pkg('C5', 'Persona DM threads (open/read/reply) + membership tier change & refund',
    `- **[missing-endpoint]** Persona DM threads can be listed but never opened, read, or replied to natively. RN reads a thread and sends into it, and a fan can open a brand-new thread (which burns one message-thread quota and surfaces the 402 quota-exhausted / 403 blocked / no_membership states). Both native apps call only \`GET /api/personas/:id/dms/threads\`; \`GET .../threads/:threadId\`, \`POST .../threads\` and \`POST .../threads/:threadId/messages\` are called by neither. Tapping a creator-inbox row instead pushes the generic chat conversation using \`counterpartyUserId ?? row.id\`, and the persona DM serializer deliberately carries no user_id — so the fallback pushes a membership id as a user id.
  RN \`src/app/audience/inbox/[membershipId].tsx:1-116 and src/app/audience/membership/[personaId]/inbox.tsx:70-95 (via src/components/audience/PersonaDmThreadView.tsx:47-77)\` · endpoint \`GET /api/personas/:id/dms/threads/:threadId, POST /api/personas/:id/dms/threads, POST /api/personas/:id/dms/threads/:threadId/messages\`
  iOS: Features/CreatorInbox/CreatorInboxViewModel.swift:80-90 (conversationDestination falls back to the row/membership id); Core/Networking/Endpoints/AudienceProfileEndpoints.swift:65-69 (threads list only)
  Android: ui/screens/creator_inbox/CreatorInboxViewModel.kt:60-70 (\`row.counterpartyUserId ?: row.id\`); data/api/services/AudienceProfileApi.kt:63-67 (threads list only)
- **[missing-action]** On the fan membership screen, "Change tier" and "Request a refund" are dead buttons natively — both platforms route them to a placeholder destination. RN opens a tier picker that upgrades (immediate) or downgrades (scheduled at period end), and files an SLA-missed refund request. Only cancel is wired natively. RN's "Open inbox" CTA (with the remaining message-thread quota footnote) also has no native counterpart.
  RN \`src/app/audience/membership/[personaId]/index.tsx:106-176\` · endpoint \`POST /api/personas/:id/membership/upgrade, POST /api/personas/:id/membership/downgrade, POST /api/personas/:id/membership/refund-request\`
  iOS: Features/Root/YouTabRoot.swift:1011-1020 (onChangeTier / onRequestRefund → .placeholder); Features/Membership/MembershipDetailViewModel.swift:14-17 explicitly defers them
  Android: ui/screens/root/RootTabScreen.kt:4303 wiring into ui/screens/membership/MembershipDetailScreen.kt:58-61 (onChangeTier / onUpdatePayment / onRequestRefund default to no-op lambdas)`,
    `Design references: "A15 — Chat conversation/A15.4 - Creator thread.html" + "A15.5 - Fan thread.html",
"A10 — Detail_ Content/A10.8 Membership.html", "A08 — per-screen batch 1/Creator inbox.html".

Notes:
- Persona DM routes are mounted at \`/api/personas/:id/dms\` from backend/routes/personaDms.js
  (backend/app.js:370, behind the persona feature gate). Membership lifecycle is
  backend/routes/personaMembership.js (app.js:372). Read both.
- The DM thread is a **distinct surface from generic chat** — the finding is that native
  currently pushes generic chat with a membership id masquerading as a user id. Build the persona
  DM thread view and route creator-inbox rows into it by thread id. Fix the bad fallback.
- The 402 quota-exhausted, 403 blocked and no_membership responses are first-class states with
  their own copy, not generic errors. Read RN's handling of each.
- Membership: a real tier picker (upgrade immediate, downgrade scheduled at period end — surface
  which is which), a refund request form, and the "Open inbox" CTA with the remaining
  message-thread quota footnote. Remove the \`.placeholder\` routes.`),
]

phase('Implement')
const results = await parallel(PACKAGES.map((p) => () =>
  agent(p.prompt, { label: `${p.id}:${p.title.slice(0, 34)}`, phase: 'Implement', schema: RESULT_SCHEMA })))
const done = results.filter(Boolean)
log(`${done.length}/${PACKAGES.length} packages returned`)

phase('Audit')
const AUDIT_COMMON = [
  `Read ${BRIEF} for repo paths and conventions.`, '',
  'Five sibling agents just landed changes for the 11 high-severity creator-biz findings in',
  'docs/rn-functional-parity.md. They worked in parallel in the same tree, so hunt for:',
  '(a) two agents clobbering the same shared file (the business owner-dashboard files are',
  'contended in this wave), (b) a claimed wiring that does not exist, (c) sample/fixture data',
  'left where the finding said it must be live (EditPersonaSampleData especially), (d) a route/DI',
  'registration that was never added, (e) CI-breaking convention violations.',
  'Extra scrutiny: the business private record carries legal name / EIN / registered address —',
  'flag any logging, query-string placement, or long-lived caching of those values as a blocker.', '',
  'Here is what they reported:', JSON.stringify(done, null, 2).slice(0, 20000), '',
  'Use `git diff --stat` / `git status` from /Users/yingpengwang/pantopus/native/pantopus, then',
  'read the actual files. Trust the diff, not the reports.', '',
  'Do NOT run a build — a compile gate runs after you.',
  'FIX what you find, directly, with small anchored Edits. Then report.',
].join('\n')

const audits = await parallel([
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **iOS only** (frontend/apps/ios). Verify new route cases exist in the route enum AND `destination(for:)`, that any `.placeholder` destinations the findings named are actually gone, new .swift files fall inside project.yml source globs, no `Features/**` hex literals or `Image(systemName:)`, and new ViewModels are `@Observable @MainActor` with all four render states.'].join('\n'),
    { label: 'audit:ios', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **Android only** (frontend/apps/android). Verify every new Retrofit interface has a `@Provides @Singleton` in di/NetworkModule.kt, every new route constant has a matching `composable(...)` in RootTabScreen.kt and is navigated to, that no-op default lambdas the findings named are actually replaced, nav args come through SavedStateHandle with a declared key, and no `ui/screens/**` `Color(0xFF…)` or `Icons.Filled.*`.'].join('\n'),
    { label: 'audit:android', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
])

return { packages: done, audits: audits.filter(Boolean) }
