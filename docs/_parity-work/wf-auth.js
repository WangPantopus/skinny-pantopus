export const meta = {
  name: 'parity-high-auth-settings',
  description: 'Fix all 7 high-severity auth-settings RN→native parity findings on iOS + Android',
  phases: [
    { title: 'Implement', detail: '4 packages, each doing both platforms' },
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
  pkg('T1', 'Delete Account (with re-auth) + search-privacy persistence',
    `- **[missing-action]** "Delete Account" is a dead row on both native platforms — the row renders with a chevron and a "Permanent. 30-day grace period." subtext but tapping it does nothing, so a user can never delete their account in-app. RN opens AccountDeleteSheet, requires a biometric re-auth (useSensitiveActionGuard), then calls DELETE /api/users/account and logs out.
  RN \`src/app/settings.tsx:330 (also src/app/settings/privacy.tsx:688)\` · endpoint \`DELETE /api/users/account\`
  iOS: Features/Settings/Privacy/PrivacyViewModel.swift:274 declares the row; tapRow() at :84-92 explicitly no-ops. The endpoint constant exists but is never used: Core/Networking/Endpoints/SettingsEndpoints.swift:72. HelpCenterView.swift:142 tells users to email support instead.
  Android: ui/screens/settings/SettingsViewModels.kt:875 declares the row; onTapRow() at :677-683 no-ops with the same comment. No DELETE /api/users/account anywhere in app/src/main.
- **[missing-endpoint]** Search-privacy controls are unreachable natively. RN exposes "Find me in search" (everyone | mutuals | nobody) and a "Find me by real name" switch, each optimistically PATCHing /api/privacy/settings with rollback on failure. Native ships the DTOs and repository methods but no screen ever calls them, and its Privacy screen's radios/toggles are pure local state.
  RN \`src/app/settings/privacy.tsx:151-191\` · endpoint \`GET /api/privacy/settings, PATCH /api/privacy/settings (defined natively, never invoked)\`
  iOS: Endpoints exist at Core/Networking/Endpoints/SettingsEndpoints.swift:17,22 — zero call sites. Features/Settings/Privacy/PrivacyViewModel.swift:12-16 says persistence is out of scope; selectRadio()/toggleRow() at :114-122 only mutate local vars.
  Android: data/privacy/PrivacyRepository.kt:21 defines updateSettings(); no caller in app/src/main. SettingsViewModels.kt PrivacySettingsViewModel only calls privacy.blocks().`,
    `Design references: "A14 — Settings list/A14.3 Settings.html" and "A14 — Settings list/A14.7 Privacy.html".

Notes:
- Account deletion is irreversible from the user's point of view. Match RN exactly: a dedicated
  confirm sheet spelling out the 30-day grace period, a **biometric / device-credential re-auth
  gate before the request is sent**, then DELETE and a full sign-out + return to the auth root.
  Both apps already have a sensitive-action / app-lock mechanism — find it and reuse it rather
  than writing a second one.
- Read backend/routes/users.js for the real delete handler (path, method, whether it takes a
  body/confirmation) before wiring.
- Privacy: the endpoints and repository methods already exist on both platforms and are unused —
  wire the existing ones. Load real values on appear, PATCH optimistically, roll back and surface
  an error on failure, exactly as RN does. Remove the "persistence is out of scope" comments you
  are making false.`),

  pkg('T2', 'Notification & briefing preferences persistence',
    `- **[missing-endpoint]** The native Notifications settings screen persists nothing — every toggle/chip flips local state only and is lost on navigation. RN loads GET /api/hub/preferences and debounce-saves PUT /api/hub/preferences, covering morning/evening briefing enable + send time, weather/AQI/home-reminder/gig-update/mail-summary alerts, quiet hours (start/end), and briefing location mode (primary_home | viewing_location | device_location). None of those preferences exist natively in any form.
  RN \`src/app/settings/notification-preferences.tsx:43-75\` · endpoint \`GET /api/hub/preferences, PUT /api/hub/preferences (never called by either native app)\`
  iOS: Features/Settings/Notifications/NotificationSettingsViewModel.swift:13-16 — "Backend persistence is out of scope for P7.5 … every chip / toggle flips local state only"; toggleRow/toggleChannel at :83-99 mutate in-memory dicts only.
  Android: ui/screens/settings/SettingsViewModels.kt:324-336 — NotificationSettingsViewModel takes no repository at all (@Inject constructor() : ViewModel()) and seeds from NotificationCatalog.seed().`,
    `Design reference: "A14 — Settings list/A14.5 Notifications.html".

Notes:
- Read backend/routes/hub.js for the real GET/PUT /api/hub/preferences shape — the full field set
  matters here (briefing enable + send time, the five alert switches, quiet-hours start/end, and
  the briefing location mode enum). Decode and send exactly those names.
- The native screen's current catalog seed is a local fixture. Replace it: load real preferences
  on appear, render the four states, and debounce-save on change (RN debounces — match it) with
  an error surface and rollback if the PUT fails.
- Android's NotificationSettingsViewModel currently takes no constructor dependency — it needs a
  repository injected, which means adding the repository and a Hilt-visible API method.
- Time pickers must produce whatever format the backend stores (read the handler); do not send a
  locale-formatted string.`),

  pkg('T3', 'Profile photo upload, username link resolution, follow a neighbor',
    `- **[missing-action]** No native way to set or change your profile photo. RN has a "Change photo" button that requests photo-library permission, opens the picker with cropping, and multipart-uploads to /api/upload/profile-picture, then refreshes the session user. Neither native Edit Profile screen has any avatar affordance and neither app ever hits the endpoint.
  RN \`src/app/profile/edit.tsx:75-106, 219\` · endpoint \`POST /api/upload/profile-picture (never called by either native app)\`
  iOS: Features/Profile/EditProfileView.swift + EditProfileView+Fields.swift contain no photo picker; EditProfileViewModel.swift:23-51 enumerates all 17 editable fields and avatar is not among them. MultipartUploader.swift only implements post-media, listing-media, chat-media, ai-media, files/upload.
  Android: ui/screens/profile/EditProfileScreen.kt has no image picker; EditProfileViewModel.kt:37-62 field enum has no avatar. UploadApi.kt has no profile-picture route.
- **[missing-endpoint]** Username-based profile links resolve to the wrong endpoint natively. RN's profile screen branches on isUuid(): UUIDs go to /api/users/id/:id, handles go to /api/users/username/:username. Both native deep-link routers accept \`u/:handle\` and \`user/:handle\` and map them to Destination.user(id:), but the profile loader only ever calls /api/users/id/<value>, so a shared pantopus://u/mariak (or https://pantopus.com/u/mariak) link lands on an error state.
  RN \`src/app/u/[username].tsx:1-7 → src/app/user/[id].tsx:56-57\` · endpoint \`GET /api/users/username/:username (never called by either native app)\`
  iOS: Router accepts the alias at Core/Routing/DeepLinkRouter.swift:339-341 (case "user", "users", "u"); the only fetch is PublicProfileEndpoints.profile(id:) = GET /api/users/id/:id at Core/Networking/Endpoints/PostsEndpoints.swift:170-175, used by PublicProfileViewModel.swift:361-363.
  Android: Router accepts it at core/routing/DeepLinkRouter.kt:465-468; PublicProfileViewModel.kt:134 documents "Loads GET /api/users/id/:id" as the only path.
- **[missing-action]** You cannot follow (or unfollow) an ordinary neighbor from a native profile. RN's Follow/Following button calls POST/DELETE /api/users/:id/follow. Native routes every Follow tap into the persona privacy-handshake wizard, and when the profile has no Beacon handle it shows the toast "Following isn't available from this profile yet." — which is the case for all Local (non-persona) profiles.
  RN \`src/app/user/[id].tsx:184-199, 532, 569\` · endpoint \`POST /api/users/:id/follow, DELETE /api/users/:id/follow (never called by either native app)\`
  iOS: Features/Profile/PublicProfileViewModel.swift:291-299 (follow() guards on canOpenHandshake) and :314 (handshakeUnavailableMessage). FollowingEndpoints.swift only covers /api/personas/*.
  Android: ui/screens/profile/PublicProfileViewModel.kt:677 (HANDSHAKE_UNAVAILABLE_MESSAGE) — same behaviour.`,
    `Design references: "A13 — Form (single screen)/Edit Profile.html", "A10 — Detail_ Content/A10.5 User.html",
"A21 — Public Beacon profile/A21.2 Local Profile.html".

Notes:
- Photo upload: iOS already has \`MultipartUploader\` — add a profile-picture leg there rather than
  a parallel uploader; use PhotosUI \`PhotosPicker\`. Android needs a profile-picture route on
  UploadApi plus the Photo Picker intent. Both must refresh the session user afterwards so the
  new avatar appears everywhere immediately. Handle permission denial with a real state, not a
  silent no-op.
- Username resolution: branch on "does this look like a UUID" exactly as RN does, and add the
  \`GET /api/users/username/:username\` endpoint on both platforms. Verify the real route in
  backend/routes/users.js first.
- Follow: the persona handshake is correct **for persona profiles**. Add the plain
  follow/unfollow path for ordinary (non-persona) profiles instead of the dead-end toast, and
  keep the handshake for profiles that have a Beacon handle. Read RN's branch to see which
  condition selects which path, and mirror it.`),

  pkg('T4', 'Professional mode enable / disable / re-enable',
    `- **[missing-endpoint]** A user who has not already got a professional profile can never turn professional mode on natively, and a user who has one can never turn it off. RN's screen has three modes (create/view/edit) with "Enable professional mode" (POST /api/professional/profile), "Disable" behind a destructive confirm (DELETE /api/professional/profile/me), and re-enable via PATCH is_active:true. Native only ever reads and PATCHes an existing profile.
  RN \`src/app/professional.tsx:139-195\` · endpoint \`POST /api/professional/profile and DELETE /api/professional/profile/me (never called by either native app)\`
  iOS: Core/Networking/Endpoints/ProfessionalEndpoints.swift:13-37 declares only GET profile/me, PATCH profile/me, GET verification/status, GET /:username. No create/delete.
  Android: data/api/services/ProfessionalApi.kt:11-24 — exactly three methods: profileMe, updateProfileMe, verificationStatus.`,
    `Design reference: "A13 — Form (single screen)/Professional Profile.html".

Notes:
- Read backend/routes/professional.js (mounted at /api/professional, app.js:385) for the create
  and delete handlers — including what a 404 from GET profile/me means (no profile yet) versus a
  real error, because that distinction is what selects the create mode.
- Three modes on one screen, as RN has them: **create** (no profile → "Enable professional mode"),
  **view** (has profile), **edit**. Disable is destructive and needs a confirm naming the
  consequence; re-enable is PATCH \`is_active: true\`.
- Do not blank the screen on the no-profile 404 — that path is the create state, and the current
  native error handling probably treats it as an error. Fix that.`),
]

phase('Implement')
const results = await parallel(PACKAGES.map((p) => () =>
  agent(p.prompt, { label: `${p.id}:${p.title.slice(0, 34)}`, phase: 'Implement', schema: RESULT_SCHEMA })))
const done = results.filter(Boolean)
log(`${done.length}/${PACKAGES.length} packages returned`)

phase('Audit')
const AUDIT_COMMON = [
  `Read ${BRIEF} for repo paths and conventions.`, '',
  'Four sibling agents just landed changes for the 7 high-severity auth-settings findings in',
  'docs/rn-functional-parity.md. They worked in parallel in the same tree, so hunt for:',
  '(a) two agents clobbering the same shared file (the settings view-model files are contended',
  'in this wave), (b) a claimed wiring that does not exist, (c) local-only state left where the',
  'finding required persistence, (d) a route/DI registration that was never added, (e) CI-breaking',
  'convention violations.',
  'Extra scrutiny on account deletion: it must be gated behind a real re-auth and a real confirm,',
  'and must sign the user out afterwards. A delete path that can fire without confirmation is a',
  'blocker.', '',
  'Here is what they reported:', JSON.stringify(done, null, 2).slice(0, 20000), '',
  'Use `git diff --stat` / `git status` from /Users/yingpengwang/pantopus/native/pantopus, then',
  'read the actual files. Trust the diff, not the reports.', '',
  'Do NOT run a build — a compile gate runs after you.',
  'FIX what you find, directly, with small anchored Edits. Then report.',
].join('\n')

const audits = await parallel([
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **iOS only** (frontend/apps/ios). Verify new route cases exist in the route enum AND `destination(for:)`, new .swift files fall inside project.yml source globs, no `Features/**` hex literals or `Image(systemName:)`, new ViewModels are `@Observable @MainActor` with all four render states, and any new Info.plist usage description (photo library) is actually declared in project.yml.'].join('\n'),
    { label: 'audit:ios', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
  () => agent([AUDIT_COMMON, '', 'YOUR SCOPE: **Android only** (frontend/apps/android). Verify every new Retrofit interface has a `@Provides @Singleton` in di/NetworkModule.kt, every new route constant has a matching `composable(...)` in RootTabScreen.kt and is navigated to, nav args come through SavedStateHandle with a declared key, any new manifest permission is declared, and no `ui/screens/**` `Color(0xFF…)` or `Icons.Filled.*`.'].join('\n'),
    { label: 'audit:android', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
])

return { packages: done, audits: audits.filter(Boolean) }
