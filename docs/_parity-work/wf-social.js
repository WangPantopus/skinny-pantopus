export const meta = {
  name: 'parity-high-social',
  description: 'Fix all 10 high-severity tabs-social RN→native parity findings on iOS + Android',
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
  pkg('S1', 'Support Train helper reservations + organizer management',
    `- **[missing-action]** A helper cannot sign up for (reserve) a Support Train slot, cancel a reservation, reveal the delivery address, mark delivered, or confirm delivery on native — the detail screen is read-only on both platforms.
  RN \`src/app/support-trains/[id].tsx:342,402 (+ components/support-trains/ReserveSheet.tsx)\` · endpoint \`POST /api/activities/support-trains/:id/slots/:slotId/reserve, .../reservations/:rid/cancel, .../reveal-address, .../deliver, .../confirm\`
  iOS: Features/SupportTrains/Detail/SupportTrainDetailViewModel.swift:87-110 — only SupportTrainsEndpoints.detail; no reserve path exists in Core/Networking/Endpoints/SupportTrainsEndpoints.swift (8 routes total). SupportTrainReservationsStore.swift:1-13 explicitly says the reservation PATCH "lands separately".
  Android: data/api/services/SupportTrainsApi.kt — same 8 routes; no reserve/cancel/reveal/deliver/confirm.
- **[missing-action]** Organizer management actions absent natively: pause / resume / unpublish / archive / delete the train, add or remove co-organizers, add or edit or cancel individual slots, send an open-slots nudge, and gift-fund enable/contribute. Native Manage supports only "send update" and "complete".
  RN \`src/app/support-trains/[id]/manage.tsx:147,164,182,211,227,240,269,302,701-777\` · endpoint \`POST .../:id/pause|resume|unpublish|archive, DELETE .../:id, POST/DELETE .../:id/organizers, PATCH .../:id/slots/:slotId, POST .../:id/nudge, POST .../:id/fund/*\`
  iOS: Features/SupportTrains/Manage/ManageTrainViewModel.swift:306-390 — only postUpdate + complete.
  Android: ui/screens/support_trains/manage/ManageTrainViewModel.kt — same two actions.`,
    `Design references: "A10 — Detail_ Content/A10.9 Support train.html", "A13 — Form (single screen)/Manage Train.html",
"A08 — per-screen batch 1/Support trains.html", and "A-12 Wizard (multi-step form)/A12.11 Start a Support Train.html".

Notes:
- Support trains are mounted at \`/api/activities/support-trains\` (backend/app.js:404) from
  backend/routes/supportTrains.js. Read that file end to end and build the endpoint list from
  what actually exists — the doc's list is a summary and some of these may differ in path or
  method.
- The reveal-address action is privacy-sensitive: only reveal after the server returns the
  address, never derive or cache it into a screenshot-able state longer than RN does.
- Organizer actions are permission-gated. Gate each affordance on the viewer's organizer role
  as the backend defines it, so no user sees a button the server will reject.
- Destructive organizer actions (delete train, cancel slot, remove co-organizer) need confirms.
- SupportTrainReservationsStore.swift on iOS is the placeholder that said the PATCH "lands
  separately" — this is that landing. Replace it rather than layering on top.`),

  pkg('S2', 'Universal search screen (new route, five search endpoints)',
    `- **[missing-route]** The universal search screen (tabs All / Tasks / People / Beacons / Businesses / Homes, fanning out to five search endpoints) has no native equivalent; the drawer's "Search" row lands on gig-only search instead.
  RN \`src/app/discover.tsx:35-40,109-114\` · endpoint \`GET /api/identity-search (searchProfiles), GET /api/homes/discover, GET /api/businesses/discover, GET /api/users/search, GET /api/gigs/search\`
  iOS: not found — Features/Root/HubTabRoot.swift:599 maps NavigationDrawerDestination.search -> HubRoute.gigSearch. No endpoint file references identity-search or homes/discover.
  Android: not found — ui/screens/root/RootTabScreen.kt:4547 maps NavigationDrawerDestination.Search -> ChildRoutes.GIG_SEARCH.`,
    `Design reference: "A11 — Map + list hybrid …/Discover.html" and "A08 — per-screen batch 1/Discover hub.html".

Notes:
- **Endpoint drift is already confirmed here.** The doc says \`GET /api/identity-search\`; the real
  route is \`GET /api/identity/search\` (backend/app.js:357 mounts routes/identitySearch.js, which
  declares \`router.get('/search', …)\` at line 370). Verify the other four the same way before use:
  homes/discover, businesses/discover, users/search, gigs/search.
- Note that \`/api/identity\` is behind a feature gate in app.js — read the surrounding \`if (…)\`
  and handle the route being absent gracefully (a failed tab must not blank the screen).
- Six tabs: All / Tasks / People / Beacons / Businesses / Homes. "All" fans out concurrently and
  renders grouped sections; each tab failing independently.
- Repoint the drawer's Search destination on both platforms from gig-only search to this screen,
  keeping gig search reachable from the Tasks tab / gigs surface.
- Debounce the query the way RN does and cancel in-flight requests on a new keystroke.`),

  pkg('S3', 'Pulse surface toggle, post-card action set, feed preferences + mute',
    `- **[missing-state]** The Pulse tab's Nearby / Connections surface toggle is missing natively — the \`surface=connections\` feed (posts from people you are connected to) is unreachable on both platforms.
  RN \`src/constants/feed.ts:6-14; src/components/feed/FeedSurfaceTabs.tsx:19-33\` · endpoint \`GET /api/posts/feed?surface=connections\`
  iOS: Features/Feed/FeedSurface.swift:16-20 — enum has only \`pulse\` (place) and \`beacons\` (personas); FeedView.swift has no surface switcher.
  Android: ui/screens/feed/FeedSurface.kt — same two-case enum.
- **[missing-action]** Feed post cards natively expose only tap + one reaction. Save/bookmark, repost, share, report, author-delete, "not helpful", "mark solved", and "dismiss seeded fact" are all unavailable from the feed row (some exist only after opening the post detail; not-helpful/solve/seeded exist nowhere).
  RN \`src/components/feed/FeedScreen.tsx:196-215; src/hooks/useFeedData.ts:126,140,173,187,194,202,209\` · endpoint \`POST /api/posts/:id/save, /share, /report, DELETE /api/posts/:id, POST /api/posts/:id/not-helpful, PATCH /api/posts/:id/solve, POST /api/posts/seeded/:factId/dismiss\`
  iOS: Features/Feed/FeedView.swift:302-313 — PulsePostCard wired with onTap/onPrimaryReaction/onRSVP only.
  Android: ui/screens/feed/pulse/PulsePostCard.kt + PulseFeedViewModel.kt — same reduced action set; PostsApi.kt has no not-helpful/solve/seeded routes.
- **[missing-endpoint]** Feed preferences (hide deals / hide alerts / politics visibility per surface) and mute-user / mute-business / mute-topic are unreachable natively — the preferences gear on the Pulse header has no counterpart.
  RN \`src/components/feed/FeedScreen.tsx:324-328; src/components/feed/FeedPreferencesSheet.tsx:33,41\` · endpoint \`GET+PUT /api/posts/feed-preferences; POST+DELETE /api/posts/mute; POST /api/posts/mute/topic; POST /api/posts/hide/:id\`
  iOS: not found — no reference to feed-preferences, posts/mute, or posts/hide anywhere under Pantopus/.
  Android: not found — same; PostsApi.kt has none of these routes.`,
    `Design references: "A03 — Tab_ Pulse feed/Feed.html", "Feed (alt).html", "Beacons.html",
and "Pantopus-design/Pulse.html".

Notes:
- All routes are in backend/routes/posts.js (mounted at /api/posts). Read the handlers for the
  real bodies — especially mute (which takes an entity type + id) and the seeded-fact dismiss.
- Surface toggle: extend the FeedSurface enum on both platforms to three cases and pass
  \`surface=connections\` through to the feed request. Keep the existing two working.
- Post-card actions belong in an overflow menu on the card, matching the design frame. Author-only
  actions (delete) and poster-only actions (mark solved) must be gated on the viewer's
  relationship to the post as RN gates them. Delete and report need confirms.
- Apply save/hide/mute optimistically with a rollback on failure, mirroring RN, and remove
  hidden/muted content from the visible list immediately.
- The preferences sheet is a new bottom sheet from the Pulse header gear on both platforms.`),

  pkg('S4', 'Pulse feed map mode + Hub Discover filter tabs',
    `- **[missing-endpoint]** The Pulse feed's List/Map toggle (viewport map of post pins with clustering, "search this area", recenter) does not exist natively, and the multi-layer marker endpoint it uses is never called — the native Explore map only draws gigs and listings, so post / business / home pins are absent everywhere.
  RN \`src/components/feed/FeedHeader.tsx:35-52; src/hooks/feed/useFeedMap.ts:52\` · endpoint \`GET /api/posts/map?layers=posts,tasks,offers,businesses,homes\`
  iOS: Features/Feed/FeedView.swift — no map mode; Features/Explore/ExploreMapViewModel.swift:202,205 uses only GigsEndpoints.inBounds + ListingsEndpoints.inBounds.
  Android: ui/screens/feed/FeedScreen.kt — no map mode; explore VM mirrors iOS.
- **[missing-action]** The Hub "Discover" section's filter tabs (Tasks / People / Businesses / Posts) are missing natively — the discovery request is hardcoded to filter=gigs, so a user can never see nearby people, businesses, or posts from the Hub. The "Explore Map" and "Find Businesses" header links are also gone (only "See all" remains).
  RN \`src/app/(tabs)/index.tsx:138,332,499-510; src/components/hub/HubDiscovery.tsx:9-14\` · endpoint \`GET /api/hub/discovery?filter=people|businesses|posts\`
  iOS: Features/Hub/HubViewModel.swift:77 — \`HubEndpoints.discovery(filter: "gigs", limit: 10)\` hardcoded; HubView.swift:66-72 has only onSeeAll.
  Android: ui/screens/hub/HubViewModel.kt:78 calls repo.discovery() with the default filter; HubScreen.kt:134-142 has only onSeeAll.`,
    `Design references: "A11 — Map + list hybrid …/Explore.html" + "Tasks Map.html" + "Map List Hybrid.html"
(map archetype), "Pantopus-design/Hub.html" and "A08 — per-screen batch 1/Discover hub.html".

Notes:
- The map endpoint is in backend/routes/posts.js — read the \`layers\` contract and the marker
  payload shape (they differ per layer) before designing the pin model.
- Reuse the existing native map machinery (Explore's map view / clustering) rather than building
  a second map stack. Extending Explore to render the multi-layer marker set and giving Pulse a
  map mode that uses the same components is the intended shape.
- "Search this area" re-requests for the current viewport; recenter returns to the user's
  viewing location. Debounce viewport-driven refetches.
- Hub Discover: make the filter a real tab row driving the \`filter\` query param, and restore the
  "Explore Map" / "Find Businesses" header links alongside "See all".`),

  pkg('S5', 'Notifications zones/filters/delete + Connections sent/blocked tabs',
    `- **[missing-action]** Notifications natively has only All/Unread tabs: the "Read" filter is gone, long-press to delete a notification is gone (endpoint never called), and the Personal/Audience (Beacon) zone split plus its ?context= entry point from the Hub megaphone is absent, so audience-context notifications cannot be isolated.
  RN \`src/app/notifications.tsx:56,231-238,259,296-314\` · endpoint \`DELETE /api/notifications/:id; GET /api/notifications?context=personal|platform|audience; POST /api/notifications/read-all with {contexts:[…]}\`
  iOS: Features/Notifications/NotificationsViewModel.swift:176-177 (two tabs), no delete method; Core/Networking/Endpoints/NotificationsEndpoints.swift has no DELETE and no context query.
  Android: ui/screens/notifications/NotificationsViewModel.kt:184-185 (two tabs); data/api/services/NotificationsApi.kt has no delete and no context param.
- **[missing-action]** Connections natively drops the "Sent" and "Blocked" tabs and the per-row "Remove" (disconnect) and "Unblock" actions. A user cannot see or manage outbound connection requests at all, and cannot disconnect an existing connection.
  RN \`src/app/connections.tsx:16-21,70-82,126-148\` · endpoint \`GET /api/relationships/requests/sent; GET /api/relationships/blocked; DELETE /api/relationships/:id; POST /api/relationships/:id/unblock\`
  iOS: Features/Connections/ConnectionsViewModel.swift:112-121 (All/Neighbors/Pending only); RelationshipsEndpoints.swift defines only list/pending/sendRequest/accept/reject.
  Android: ui/screens/connections/ConnectionsViewModel.kt:298-303 (same three tabs); RelationshipsApi.kt has the same five routes.`,
    `Design references: "A08 — per-screen batch 1/Notifications.html" and "A08 — per-screen batch 1/Connections.html".

Notes:
- Notifications routes live in backend/routes/notifications.js; relationships in
  backend/routes/relationships.js (mounted at /api/relationships, app.js:352). Verify the
  route-relative paths — e.g. the doc's \`/api/relationships/blocked\` and \`/requests/sent\` must be
  confirmed against the router declarations.
- Notifications: add the Read filter, long-press (iOS: swipe or context menu; Android: long-press)
  delete with a confirm, and the Personal/Audience zone split. The Hub megaphone must pass the
  \`context\` through so the audience zone opens directly — that means a route parameter change on
  both platforms.
- read-all must send the \`contexts\` array so "mark all read" respects the active zone rather than
  clearing everything.
- Connections: add Sent and Blocked tabs, Remove (disconnect, with confirm naming the person)
  and Unblock. Keep the existing three tabs and their accept/reject behaviour intact.`),
]

phase('Implement')
const results = await parallel(PACKAGES.map((p) => () =>
  agent(p.prompt, { label: `${p.id}:${p.title.slice(0, 34)}`, phase: 'Implement', schema: RESULT_SCHEMA })))
const done = results.filter(Boolean)
log(`${done.length}/${PACKAGES.length} packages returned`)

phase('Audit')
const AUDIT_COMMON = [
  `Read ${BRIEF} for repo paths and conventions.`, '',
  'Five sibling agents just landed changes for the 10 high-severity tabs-social findings in',
  'docs/rn-functional-parity.md. They worked in parallel in the same tree, so hunt for:',
  '(a) two agents clobbering the same shared file (the Feed and Hub files are contended in this',
  'wave), (b) a claimed wiring that does not exist, (c) sample data left where the finding said',
  'it must be live, (d) a route/DI registration that was never added, (e) CI-breaking convention',
  'violations.', '',
  'Here is what they reported:', JSON.stringify(done, null, 2).slice(0, 20000), '',
  'Use `git diff --stat` / `git status` from /Users/yingpengwang/pantopus/native/pantopus, then',
  'read the actual files. Trust the diff, not the reports.', '',
  'Do NOT run a build — a compile gate runs after you.',
  'FIX what you find, directly, with small anchored Edits. Then report.',
].join('\n')

const audits = await parallel([
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **iOS only** (frontend/apps/ios). Verify new route cases exist in the route enum AND `destination(for:)`, new .swift files fall inside project.yml source globs, no `Features/**` hex literals or `Image(systemName:)`, and new ViewModels are `@Observable @MainActor` with all four render states. Pay extra attention to the FeedSurface enum being extended consistently everywhere it is switched over.'].join('\n'),
    { label: 'audit:ios', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **Android only** (frontend/apps/android). Verify every new Retrofit interface has a `@Provides @Singleton` in di/NetworkModule.kt, every new route constant has a matching `composable(...)` in RootTabScreen.kt and is navigated to, nav args come through SavedStateHandle with a declared key, and no `ui/screens/**` `Color(0xFF…)` or `Icons.Filled.*`. Pay extra attention to `when` expressions over FeedSurface becoming non-exhaustive.'].join('\n'),
    { label: 'audit:android', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
])

return { packages: done, audits: audits.filter(Boolean) }
