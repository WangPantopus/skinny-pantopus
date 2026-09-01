export const meta = {
  name: 'parity-high-homes',
  description: 'Fix all 16 high-severity homes-a/homes-b RN→native parity findings on iOS + Android',
  phases: [
    { title: 'Implement', detail: '8 packages, each doing both platforms' },
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
      type: 'object',
      additionalProperties: false,
      required: ['filesCreated', 'filesEdited', 'summary'],
      properties: {
        filesCreated: { type: 'array', items: { type: 'string' } },
        filesEdited: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' },
      },
    },
    android: {
      type: 'object',
      additionalProperties: false,
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
        type: 'object',
        additionalProperties: false,
        required: ['method', 'path', 'backendRef'],
        properties: {
          method: { type: 'string' },
          path: { type: 'string' },
          backendRef: { type: 'string' },
        },
      },
    },
    deferred: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['what', 'why', 'evidence'],
        properties: {
          what: { type: 'string' },
          why: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
  },
}

const AUDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['platform', 'issues'],
  properties: {
    platform: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
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
    id,
    title,
    prompt: [
      `Read ${BRIEF} first and follow it exactly.`,
      '',
      `# Work package ${id} — ${title}`,
      '',
      'Implement the following high-severity parity findings on BOTH iOS and Android.',
      'Each bullet is quoted verbatim from docs/rn-functional-parity.md and already',
      'contains the RN source file:line, the backend endpoint, and the current native',
      'file:line on each platform. Verify each of those pointers still matches the tree',
      'before you rely on it.',
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
    'H1',
    'Home dashboard real data + Home Intelligence stack',
    `- **[missing-endpoint]** The native Home dashboard never calls GET /api/homes/:id/dashboard — its hero stats and overview (upcoming/activity/emergency) are hardcoded sample constants, so a user sees fake counts ("4 Packages / 2 Access codes / 7 Tasks") instead of their household's real data.
  RN \`src/app/homes/[id]/index.tsx:66-90\` · endpoint \`GET /api/homes/:id/dashboard (backend/routes/home.js:6224)\`
  iOS: Pantopus/Features/Homes/HomeDashboardViewModel.swift:167-181 + :200-213 — stats literal "4"/"2"/"7"; content() at :201-213 uses HomeDashboardSampleData.populatedQuickActions / .populatedOverview. Only HomesEndpoints.detail + publicProfile are fetched (:145-162).
  Android: ui/screens/homes/HomeDashboardViewModel.kt:226-232 and :244-249 — same literal HomeHeroStat("packages","4"…); :275-277 uses HomeDashboardSampleData.populatedQuickActions/.populatedOverview.
- **[missing-endpoint]** The whole Home Intelligence stack — health-score ring, seasonal checklist with Complete/Skip/Generate/Hire-help actions, and the property-value card — is absent natively. Neither app calls any of the four endpoints.
  RN \`src/app/homes/[id]/index.tsx:251-283 (via src/hooks/useHomeIntelligence.ts)\` · endpoint \`GET /api/homes/:id/health-score (home.js:7482); GET /api/homes/:id/seasonal-checklist (:7504) + PATCH /:id/seasonal-checklist/:itemId (:7577); GET /api/homes/:id/property-value; GET /api/homes/:id/bill-trends (:7596)\``,
    `Design references: "A10 — Detail_ Content/A10.1 Home.html" and "A10.2 Home (alt).html" are the
Home dashboard frames — use them for the hero stat row, the health-score ring, the seasonal
checklist card and the property-value card layout.

Notes:
- The dashboard response is the source for hero stats AND the overview sections
  (upcoming / activity / emergency). Delete the HomeDashboardSampleData usage for those
  sections on both platforms; keep the sample file only if other screens still reference it.
- Home Intelligence is four separate reads plus one PATCH. Load them concurrently with the
  dashboard, and let each card fail independently (a failed health-score must not blank the
  whole screen) — render a per-card error/absent state instead.
- The seasonal-checklist item actions (Complete / Skip / Generate / Hire help) must actually
  PATCH and reflect the server's returned item state.`
  ),
  pkg(
    'H2',
    'Delete home, change member role, household access requests tab',
    `- **[missing-action]** "Delete Home" (trash icon on rows where can_delete_home is true, with a confirm alert warning it removes the home for all members) has no native counterpart — DELETE /api/homes/:id is called by neither app, so an owner can never delete a home from the phone.
  RN \`src/app/homes/index.tsx:110-126, :249-252\` · endpoint \`DELETE /api/homes/:id\`
  iOS: HomesEndpoints.swift has no \`.delete\` on "/api/homes/{id}"; MyHomesListViewModel.swift:137-153 builds rows with only \`.chevron\` trailing and no kebab menu.
  Android: HomesApi.kt has no @DELETE("api/homes/{id}"); MyHomesListViewModel.kt:143-158 same chevron-only row.
- **[missing-action]** Change a member's role (swap-horizontal icon per row → action sheet of assignable roles) is absent natively; the endpoint is never called, so an owner/admin cannot promote or demote a household member.
  RN \`src/app/homes/[id]/members/index.tsx:93-116\` · endpoint \`POST /api/homes/:id/members/:userId/role (packages/api/src/endpoints/homeIam.ts:147-153)\`
  iOS: MembersListViewModel.swift kebab menu only offers Remove (:29, :191, :218); HomesEndpoints.swift has no role endpoint.
  Android: MembersListViewModel.kt mirrors it; HomeMembersApi.kt:43 only has @DELETE("api/homes/{id}/members/{userId}").
- **[missing-endpoint]** The Members screen's "Requests" tab — pending household-access requests from people who used the claim flow's "ask verified owner" path, with Invite / Decline buttons — does not exist natively. Requests silently pile up server-side with no way to act on them.
  RN \`src/app/homes/[id]/members/index.tsx:62, :145-195, :321-379\` · endpoint \`GET /api/homes/:id/household-access-requests; POST …/:requestId/approve; POST …/:requestId/reject\`
  iOS: MembersListViewModel.swift:74-79 exposes only Members / Guests / Pending(invites) tabs.
  Android: MembersListViewModel.kt:267-269 same three tabs.`,
    `Design references: "A08 — per-screen batch 1/My homes.html" (row kebab / trailing affordances)
and "A08 — per-screen batch 1/Members.html" (tab row + per-row actions + request rows).

Notes:
- Gate the delete affordance on the row's \`can_delete_home\` flag exactly as RN does; if the
  native My Homes DTO does not decode that flag yet, add it.
- The confirm alert must carry RN's warning that the home is removed for all members.
- The assignable-role list must come from what the backend actually accepts — read the
  handler in backend/routes/homeIam.js before hardcoding a role list.
- "Requests" becomes a 4th tab on the Members screen on both platforms, with Invite/Decline
  per row, an empty state, and a refresh after each action.`
  ),
  pkg(
    'H3',
    'Find-or-Add-Home discovery, ask-a-verified-owner, address-already-claimed',
    `- **[missing-route]** The "Find or Add Home" discovery screen (search public-preview homes by address, tap a result to start an ownership claim, empty-state "add missing home" CTA, and a manual invite-code entry box) has no native equivalent. GET /api/homes/discover is called by neither app, and the 409-blocked claim path in evidence.tsx routes users here with no destination natively.
  RN \`src/app/homes/find.tsx (whole route, reachable from claim-owner/evidence.tsx:210)\` · endpoint \`GET /api/homes/discover; GET /api/homes/invitations/token/:token\`
  iOS: not found. Invite tokens are accepted only via deep link (RootTabView.swift:121 TokenAcceptView).
  Android: not found; TokenAcceptScreen at RootTabScreen.kt:3724 is deep-link-only, no manual code field.
- **[missing-action]** The "Ask a verified owner to add me" option on the claim-start screen (shown when the home already has a verified owner and you are not a member) is missing natively, so a non-member has no way to request household access from the owners.
  RN \`src/app/homes/[id]/claim-owner/index.tsx:30-35, :76-91\` · endpoint \`POST /api/homes/:id/request-household-from-owner\`
  iOS: ClaimOwnership/Steps/ClaimStartStep.swift renders only a requirements card + "why we ask"; no method picker.
  Android: ui/screens/homes/claim_ownership/ClaimOwnershipWizardScreen.kt mirrors iOS.
- **[missing-state]** Add Home never handles the "address already claimed" outcome natively. RN reads checkAddress status HOME_FOUND_CLAIMED → shows AddressClaimedModal → confirm → submits a residency claim against the existing home instead of creating a duplicate. Native ignores the status and always POSTs /api/homes, creating a duplicate home row.
  RN \`src/app/homes/new.tsx:275-287 (src/components/homes/useHomeForm.ts:592-620, :465)\` · endpoint \`POST /api/homes/check-address → HOME_FOUND_CLAIMED; POST /api/homes/:id/residency-claims\`
  iOS: AddHome/AddHomeWizardViewModel.swift:326-347 stores addressCheck but :350-377 submit() unconditionally calls HomesEndpoints.create.
  Android: ui/screens/homes/add_home/AddHomeWizardViewModel.kt:383 same unconditional CreateHomeRequest.`,
    `Design references: "A-12 Wizard (multi-step form)/A12.1 Find Your Home.html" is the discovery
screen; "A12.2 Add Home.html" and "A12.3 Claim Ownership Start.html" cover the other two.
Check for a matching \`*-frames.jsx\` in that folder — where present it is the higher-fidelity
source (1px = 1dp/1pt).

Notes:
- Find-or-Add-Home is a NEW route on both platforms. Add the route case to the iOS route enum
  + \`destination(for:)\` and to Android's \`ChildRoutes\` + a \`composable(...)\` block, using
  small anchored Edits per the brief. Entry points: the claim evidence 409 path and the
  My Homes empty/secondary CTA, matching RN.
- The manual invite-code box resolves \`GET /api/homes/invitations/token/:token\` and then
  hands off to the existing TokenAccept surface — reuse it, do not duplicate it.
- The claim-start method picker only renders the "ask a verified owner" option under the same
  condition RN uses (home has a verified owner AND viewer is not a member). Read the RN
  condition rather than guessing.
- HOME_FOUND_CLAIMED: read the real \`check-address\` handler for the exact status string and
  the id field it returns, then branch submit() into the residency-claim POST behind a
  confirm modal mirroring RN's AddressClaimedModal copy.`
  ),
  pkg(
    'H4',
    'Residency-verification evidence variant + Home Issues tracker',
    `- **[missing-state]** The residency-verification variant of the evidence flow (verificationType=residency → claim_type 'resident', lease/utility-bill/tax-bill document options) is absent natively. The "Upload documents to verify residency" strip on the homes list (index.tsx:262-283) therefore has no native destination and pending residents cannot complete verification.
  RN \`src/app/homes/[id]/claim-owner/evidence.tsx:33-37, :92-95, :162-165\` · endpoint \`POST /api/homes/:id/ownership-claims with claim_type='resident'\`
  iOS: ClaimOwnershipSteps.swift:23-45 hardcodes two slots (idv + deed); ClaimOwnershipWizardViewModel.swift:229 always sends SubmitClaimRequest(method:"doc_upload") with no claim_type.
  Android: ClaimOwnershipWizardViewModel.kt:217 same SubmitClaimRequest(method = "doc_upload"); no residency path.
- **[missing-endpoint]** RN's Maintenance screen is the HomeIssue tracker — list, "Report Issue" create, status transitions, dismiss. Native's Maintenance screen is a different backend collection (maintenance tasks). Neither native app ever calls /api/homes/:id/issues, so a resident cannot report or view home issues.
  RN \`src/app/homes/[id]/maintenance.tsx:36, :53, :65, :75\` · endpoint \`GET/POST /api/homes/:id/issues, PUT /api/homes/:id/issues/:issueId (backend/routes/home.js:4386, :4420, :4462) — distinct table (HomeIssue) from /:id/maintenance (:4695)\`
  iOS: Maintenance/MaintenanceListViewModel.swift uses HomesEndpoints.maintenance only.
  Android: ui/screens/homes/maintenance/MaintenanceListViewModel.kt:159 repo.getHomeMaintenance.`,
    `Design references: "A-12 Wizard (multi-step form)/A12.4 Claim Ownership Evidence.html" for the
evidence step; "A08 — per-screen batch 1/Maintenance.html" for the issue list.

Notes:
- The evidence wizard becomes variant-driven: the caller passes a verification type
  (owner | residency), which selects both the document-slot set and the \`claim_type\` sent on
  submit. Read the RN slot lists for each variant instead of inventing them.
- HomeIssue is a DIFFERENT collection from maintenance tasks. Do NOT replace the existing
  maintenance surface — add the issues surface alongside it (RN's Maintenance screen is the
  issue tracker; decide the least-surprising presentation and say what you chose in your
  result). Wire list + create ("Report Issue") + status transition + dismiss.`
  ),
  pkg(
    'H5',
    'Postcard code unlock + ownership transfer completion',
    `- **[missing-state]** Postcard code entry is permanently locked on both native apps: the delivery stage is derived from a sample helper that returns \`.inTransit\` for every real home id (only ids literally containing the substring "delivered" unlock), and the code field + Verify CTA are gated on \`stage == .delivered\`. A user who has the postcard in hand can never submit the 6-digit code, so \`POST /api/homes/:id/verify-postcard\` is unreachable in production. RN lets the user type the code at any time and also offers an explicit "I already have a code" escape hatch (verify-postcard.tsx:146-152).
  RN \`src/app/homes/[id]/verify-postcard.tsx:64-91,145-152\` · endpoint \`POST /api/homes/:id/verify-postcard\`
  iOS: Features/Homes/VerifyLandlord/Postcard/PostcardVerificationViewModel.swift:84-89 (\`stage(for:)\`), :148-150 (\`isCodeInputUnlocked\`), :161-163 (\`primaryCTAEnabled\`)
  Android: ui/screens/homes/verify_landlord/postcard/PostcardVerificationViewModel.kt:67-71 (\`stage(homeId)\`), :93 (\`isCodeInputUnlocked\`), :97-98 (\`primaryCtaEnabled\`)
- **[missing-action]** Ownership transfer cannot be completed natively. Both apps hard-gate the commit behind \`recipientIsBackendBacked\`, which defaults to false and is never set true by any production path — the CTA reads "Transfer ownership unavailable" and the recipient shown is hardcoded sample data (Maya Fortune). There is also no in-app entry point: TransferOwnership is only pushed from the deep-link handler, while RN exposes a sticky "Transfer Ownership" button on the Owners list. RN identifies the recipient by \`buyer_email\` (works for non-users); native only supports \`buyer_user_id\`.
  RN \`src/app/homes/[id]/owners/transfer.tsx:24-63 and owners/index.tsx:116-123\` · endpoint \`POST /api/homes/:id/owners/transfer\`
  iOS: Features/Homes/Owners/Transfer/TransferOwnershipViewModel.swift:81 (recipient = sample), :103 (canCommit requires recipientIsBackendBacked), :120 ("Transfer ownership unavailable"), :290 (TransferOwnerRequest(buyerUserId:)). Entry point only at Features/Root/HubTabRoot.swift:671-676 (deep link); OwnersListViewModel.swift has no transfer action.
  Android: ui/screens/homes/owners/transfer/TransferOwnershipViewModel.kt:49 (recipientIsBackendBacked = false), :67, :82, :310 (TransferOwnerRequest(buyerUserId)). Entry point only at ui/screens/root/RootTabScreen.kt:1709-1714 (deep link); OwnersListViewModel.kt has no transfer action.`,
    `Design references: "A-12 Wizard (multi-step form)/A12.7 Postcard Verification.html" (and the
sibling \`verify-postcard-frames.jsx\` in that folder — prefer the jsx, 1px = 1dp/1pt) and
"A13 — Form (single screen)/Transfer Ownership.html" + "A08 — per-screen batch 1/Owners.html".

Notes:
- Postcard: keep the stage timeline as informational chrome, but the code field and Verify CTA
  must be enterable whenever the user has a code — mirror RN including the "I already have a
  code" escape hatch. Also read the real verify-postcard handler for its failure shapes.
- Transfer: read \`backend/routes/homeOwnership.js\` for the real transfer body. If the backend
  accepts \`buyer_email\`, support email entry as RN does and drop the \`recipientIsBackendBacked\`
  gate. If it only accepts \`buyer_user_id\`, say so in \`deferred\` with the handler line and
  implement the user-id path properly instead of leaving a dead CTA. Replace the Maya Fortune
  sample recipient with the real resolved recipient either way.
- Add the sticky "Transfer Ownership" entry point on the Owners list on both platforms.`
  ),
  pkg(
    'H6',
    'Per-home owner claim-review surface (new route, both platforms)',
    `- **[missing-route]** Entire home-owner claim review surface is absent from both native apps. A home owner cannot see incoming ownership claims or residency claims on their home, cannot approve/reject/flag them, and cannot use the relationship-resolution actions (invite as owner / continue review / flag unknown person). Native has a ReviewClaims feature but it is admin-scoped (AdminEndpoints \`/api/admin/claims*\`), not the per-home owner surface.
  RN \`src/app/homes/[id]/owners/review-claim.tsx:1-508\` · endpoint \`GET /api/homes/:id/ownership-claims, GET /api/homes/:id/ownership-claims/compare, POST /api/homes/:id/ownership-claims/:claimId/review, POST /api/homes/:id/ownership-claims/:claimId/resolve-relationship, GET /api/homes/:id/claims, POST /api/homes/:id/claim/:claimId/approve, POST /api/homes/:id/claim/:claimId/reject\`
  iOS: not found — HomesEndpoints.swift only declares POST ownership-claims (:94), POST evidence (:104), GET my-ownership-claims (:118), DELETE claim (:124). Features/ReviewClaims/* uses AdminEndpoints.
  Android: not found — HomesApi.kt:160-202 declares the same four claim endpoints only; ui/screens/review_claims/* is admin-scoped.`,
    `Design references: "A13 — Form (single screen)/Review Claim.html" and
"A08 — per-screen batch 1/Review claims.html".

Notes:
- This is a NEW per-home owner surface. Do NOT modify or repurpose the existing admin-scoped
  ReviewClaims feature — build alongside it, and give the new files clearly distinct names
  (e.g. HomeClaimReview…) so the two never get confused.
- Seven endpoints. Verify every one of them against backend/routes/homeOwnership.js and
  backend/routes/home.js before use; the doc's list mixes two different claim collections
  (ownership-claims vs claims) and you must keep them straight.
- Include the side-by-side "compare" view and the relationship-resolution actions
  (invite as owner / continue review / flag unknown person) that RN exposes.
- Entry point: the Owners list / home dashboard should surface pending claims for owners.
  Add the route on both platforms using small anchored Edits on the shared route files.`
  ),
  pkg(
    'H7',
    'Per-home security policy + tenant↔landlord approval flow',
    `- **[missing-endpoint]** The per-home security-policy screen (privacy mask level, owner claim policy, member attach policy) has no native equivalent and neither app ever calls \`/api/homes/:id/security\`. The native screen labelled "Security" is a different feature entirely — 9 client-side privacy toggles against \`/api/homes/:id/privacy\`. Users cannot set discoverability/stealth mode, open-vs-review owner claims, or the member attach policy, and the "change requires owner approval" (quorum \`pending\`) response state is dropped.
  RN \`src/app/homes/[id]/settings/security.tsx:27-134\` · endpoint \`GET /api/homes/:id/security, PATCH /api/homes/:id/security\`
  iOS: Features/Homes/Settings/Security/HomeSecurityViewModel.swift:84-87,104-110 — uses HomePrivacyEndpoints get/update.
  Android: ui/screens/homes/settings/security/* — same privacy-toggle screen.
- **[missing-endpoint]** The tenant↔landlord approval flow never made it across. RN reads landlord/lease status and renders five distinct states (approved / denied+reason / pending+cancel / landlord-on-file → Request Approval / no-landlord → alternative paths), and submits a request with move-in date + message. The native "Verify landlord" wizard collects landlord/PM details client-side, discards them, and only fires \`POST /api/homes/:id/request-postcard\`. No native code calls any \`/api/v1/tenant/*\` route, so a tenant cannot request landlord approval, see the landlord's verification tier, check pending status, or cancel a pending request.
  RN \`src/app/homes/[id]/verify-landlord/index.tsx:34-53,196-310 and verify-landlord/details.tsx:24-40\` · endpoint \`GET /api/v1/tenant/home/:homeId/status, POST /api/v1/tenant/request-approval, POST /api/v1/tenant/request/:leaseId/cancel\`
  iOS: Features/Homes/VerifyLandlord/VerifyLandlordWizardViewModel.swift:8-16,203,229.
  Android: ui/screens/homes/verify_landlord/VerifyLandlordWizardViewModel.kt:62-65,200.`,
    `Design references: "A14 — Settings list/A14.2 Security.html" and "A14.1 Home settings.html";
"A-12 Wizard (multi-step form)/A12.5 Verify Landlord Start.html" + "A12.6 Verify Landlord Details.html".

Notes:
- The existing privacy-toggle screen is a real feature — keep it. The security-POLICY screen is
  additional. Read backend/routes/homeOwnership.js (\`/security\`) for the real field names and
  the quorum/pending response, and surface the "change requires owner approval" state rather
  than silently swallowing it.
- Landlord/tenant: \`/api/v1\` is mounted from backend/routes/landlordTenant.js (app.js:397).
  Read that file for the five states and the real request bodies, then replace the
  discard-the-details behaviour with real submits. Keep the postcard path working.`
  ),
  pkg(
    'H8',
    'Guest-pass list, revoke and share',
    `- **[missing-route]** Guest-pass management is missing. RN lists Active and Past passes with time-remaining, revokes a pass, and fires the OS share sheet with the pass link right after creation. Natively only the create form exists (AddGuestForm); the list and revoke calls are declared in the networking layer but never invoked from any screen, and there is no share-the-link affordance. A user can issue a guest pass but can never see it again or revoke it from the app.
  RN \`src/app/homes/[id]/share.tsx:37-90,152-190\` · endpoint \`GET /api/homes/:id/guest-passes, DELETE /api/homes/:id/guest-passes/:passId\`
  iOS: Create only: Features/Homes/Guests/AddGuestFormViewModel.swift (reachable via HubTabRoot.swift:2271-2276). \`HomesEndpoints.listGuestPasses\` (Core/Networking/Endpoints/HomesEndpoints.swift:567) and \`revokeGuestPass\` (:582) have zero call sites outside the endpoint file.
  Android: Create only: ui/screens/homes/guests/AddGuestFormViewModel.kt:207. \`HomeGuestPassesRepository.list\` (data/homes/HomeGuestPassesRepository.kt:31) and \`.revoke\` (:37) have zero UI call sites.`,
    `Design references: "A13 — Form (single screen)/Share Home.html" and
"A13 — Form (single screen)/Add Guest.html".

Notes:
- The networking layer already exists on both platforms — you are adding the surface that uses
  it. Active / Past sections with time-remaining, revoke with a confirm, and an OS share sheet
  (iOS \`ShareLink\`/UIActivityViewController, Android \`Intent.ACTION_SEND\`) carrying the pass
  link immediately after creation, exactly as RN does.
- Read the guest-pass DTO for the field that carries the shareable link/token; if there is no
  such field on the create response, say so in \`deferred\` rather than fabricating a URL.
- This is a NEW list route on both platforms; the existing Add Guest form should push/return
  into it.`
  ),
]

phase('Implement')

const results = await parallel(
  PACKAGES.map((p) => () =>
    agent(p.prompt, {
      label: `${p.id}:${p.title.slice(0, 34)}`,
      phase: 'Implement',
      schema: RESULT_SCHEMA,
    })
  )
)

const done = results.filter(Boolean)
log(`${done.length}/${PACKAGES.length} packages returned`)

phase('Audit')

const AUDIT_COMMON = [
  `Read ${BRIEF} for repo paths and conventions.`,
  '',
  'Eight sibling agents just landed changes for the 16 high-severity homes findings in',
  'docs/rn-functional-parity.md. They worked in parallel in the same tree, so the risks',
  'you are hunting are: (a) two agents clobbering the same shared file, (b) a claimed',
  'wiring that does not actually exist, (c) sample/fixture data left in a path the finding',
  'said must be live, (d) a route/DI registration that was never added so the new screen is',
  'unreachable, (e) convention violations that will fail CI (hardcoded hex, Image(systemName:),',
  'Icons.Filled.*, raw Color(0xFF…)).',
  '',
  'Here is what they reported:',
  JSON.stringify(done, null, 2).slice(0, 20000),
  '',
  'Use `git diff --stat` and `git status` from /Users/yingpengwang/pantopus/native/pantopus',
  'to see the real change set, then read the actual files. Trust the diff, not the reports.',
  '',
  'Do NOT run a build — a compile gate runs after you.',
  'FIX what you find, directly, with small anchored Edits. Then report.',
].join('\n')

const audits = await parallel([
  () =>
    agent(
      [
        AUDIT_COMMON,
        '',
        'YOUR SCOPE: **iOS only** (frontend/apps/ios). Check in particular that every new',
        'route case is present in its route enum AND in `destination(for:)`, that every new',
        '.swift file will actually be picked up by the XcodeGen project (project.yml globs),',
        'that no `Features/**` file contains a hex colour literal or `Image(systemName:)`,',
        'and that every new ViewModel is `@Observable @MainActor` with the four render states.',
      ].join('\n'),
      { label: 'audit:ios', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }
    ),
  () =>
    agent(
      [
        AUDIT_COMMON,
        '',
        'YOUR SCOPE: **Android only** (frontend/apps/android). Check in particular that every',
        'new Retrofit interface has a `@Provides @Singleton` in di/NetworkModule.kt, that every',
        'new route constant has a matching `composable(...)` block in RootTabScreen.kt and is',
        'actually navigated to from somewhere, that nav args are read via SavedStateHandle with',
        'a declared key, and that no `ui/screens/**` file contains `Color(0xFF…)` or `Icons.Filled.*`.',
      ].join('\n'),
      { label: 'audit:android', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }
    ),
])

return { packages: done, audits: audits.filter(Boolean) }
