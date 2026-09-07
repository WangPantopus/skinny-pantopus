# Pantopus v1 journey audit and blocker list

Date: September 6, 2026 (America/Los_Angeles). Baseline: `6a936e4b6`.

Scope: read-only production entry inspection, targeted source review of web/backend/native routing, and selected existing local tests. Application code, deployment, flags, account state, and production records were not changed. Two audit documents are the only intended repository additions.

This is a completed first-pass audit, not a full authenticated release certification. No production account was created, no third-party message was sent, and no payment was exercised. Native apps were inspected in source, not built or run during this step. Public profile/post behavior was traced in code; a known real profile/post fixture was not exercised live. An untested scenario is an evidence gap, not automatically a product defect.

Evidence legend: **Live** = directly observed in deployed browser UI; **Source** = present in the inspected code; **Test** = observed execution of a selected local test; **Unverified** = requires staging, device, or production configuration evidence.

Priority: **P0 gate** = resolve before exposing affected data/releasing; the label does not assert an exploit. **P1** = required to fulfill a core v1 journey. **P2/conditional** = required if the affected adjacent feature remains reachable. Suggested owners are roles, not assigned people.

## 1. Deployed entry observations

| Check | Observed result | Interpretation |
|---|---|---|
| `https://pantopus.com/` | Identity-infrastructure headline; verification-led CTA; Get started goes to `/register`. | Live promise is not the proposed balanced Home/Pulse/Beacon promise. |
| `https://pantopus.com/register` | First name, last name, username, email, password, confirmation, terms; optional middle name; OAuth choices. | Deployed form differs from the slimmer form in the checkout. This is observed drift, not proof of its deployment cause. |
| `https://pantopus.com/start` | Anonymous address field and a “Just here to follow someone or browse?” button. | Address-free intent is recognized in the UI. Address result itself was not queried with a residential address during this step. |
| Click that browsing button | `/register?redirectTo=%2Fapp%2Fplace` | Social entry explicitly targets Place after signup. |
| Open `/app/feed` signed out | `/login?redirectTo=%2Fapp%2Ffeed` | Initial login handoff preserves the feed destination. |
| Click Sign up on that login screen | `/register` without redirect target | Login-to-registration transition loses the intended destination. Account creation was not completed. |

No installed mobile version or production feature-flag value was inferred from repository defaults. App Store descriptions reviewed earlier in the conversation are additional context, not a fresh binary verification in this pass.

## 2. Existing assets worth preserving

- Anonymous address preview and pending context: `frontend/apps/web/src/components/place/StartFunnel.tsx`, `pendingPlace.ts`, `PendingPlaceSaver.tsx`.
- Household-scoped calendar and saved pickup override: `backend/routes/addressCalendar.js`, `backend/services/addressCalendarService.js`, `frontend/apps/web/src/components/place/detail/AddressCalendarCard.tsx`.
- Actual social feed surfaces already include `place`, `personas`, and `connections`: `frontend/apps/web/src/app/(app)/app/feed/page.tsx:33`, `backend/services/feedService.js:34`.
- Public Beacon pages and free-follow path: `frontend/apps/web/src/app/persona/[personaHandle]/page.tsx`, `AudienceProfileClient.tsx:247`.
- Creator management and publishing: `frontend/apps/web/src/app/(app)/app/persona/page.tsx`; audience dashboard and broadcaster components also exist.
- Following-list backend: selected `personasMeFollowing.routes` tests passed, including management behavior; this does not prove discoverability of the follower UI.
- Privacy mirror and distinct feed/notification identity handling: selected tests passed; these are valuable foundations, not blanket assurances about all endpoints.
- Public post aliases and session recovery are already implemented in `frontend/apps/web/src/middleware.ts:18`. Preserve them.

## 3. Prioritized blockers

### B01 — Privacy claims and access entitlement need adjudication

**P0 gate · Source + Test · Owner: backend/security with product**

Evidence: `backend/serializers/homeProfileSerializer.js:64` returns raw account id, username, and avatar even with `reveal=false`. First-name redaction is not removal of every identity-linking field. `backend/routes/home.js:2646` grants insider status when a residency/ownership claim row exists, without a claim-status filter in those queries. `backend/services/homePrivacyService.js:4` describes some downstream setting consumers as arriving later. These are source concerns; exploitability and full reachability were not demonstrated.

The four existing home-mirror tests pass. They check name/address redaction and equality with the serializer, but do not establish that raw account identifiers are absent or that all claim states have correct access.

Smallest next action: define legitimate viewer entitlements, reproduce the concerning cases with isolated accounts, and inspect responses as well as visible UI. Repair or narrowly document the entitlement where warranted; inventory each exposed privacy setting against its consumers.

Done when: outsider, no-address follower, unrelated household, pending/rejected/withdrawn/expired claimant, legitimate member, and owner receive only their documented fields; sparse density data remains protected; Beacon/local bridges stay separate by default; every visible privacy setting has observable enforcement evidence. Metadata and notifications must also respect boundaries. Resolve before changing how saved addresses become private home contexts.

### B02 — Home preview can be lost or become an empty dashboard

**P1 · Source; authenticated reproduction pending · Owner: web + API, then native**

Evidence: `PendingPlaceSaver.tsx:31` writes `SavedPlace`; `PlaceDashboard.tsx:72` loads a primary `Home`, and `:133` shows “You haven't added a place yet” when absent. `backend/routes/savedPlaces.js` only writes SavedPlace. `pendingPlace.ts:36` consumes storage before the asynchronous save; `PendingPlaceSaver.tsx:43` silently catches save failure. The identity distinction may be intentional, but the user journey is not complete merely because one record was saved.

Smallest change: preserve the preview and pending operation until a successful explicit save; render a useful saved context; make attachment to any shared household a separate, authorized operation. Do not conflate SavedPlace, Home, ownership, and membership.

Done when: a fresh user starts from a preview, finishes signup, sees the same address/context, and can take the first private action. A temporary save failure preserves retryable intent; retry/reload creates no duplicate. Existing homes and accounts remain intact. Native pending stores require equivalent checks; this web inference is not automatically a native defect.

### B03 — Authentication transitions lose social intent

**P1 · Live + Source · Owner: web/auth + native deep links**

Evidence: live `/app/feed` → login preserves `redirectTo`, but Sign up goes to plain `/register`. Source: `frontend/apps/web/src/app/(auth)/login/page.tsx:288` and `register/page.tsx:365` have bare cross-links. `StartFunnel.tsx:694` routes browsing through `REGISTER_HREF`, defined at `:60` as Place. Email-verification transitions also require tracing; they were not exercised end to end.

Smallest change: carry a validated return destination and explicit pending intent through all auth transitions. Give the browsing entrance a social destination. This is the first recommended implementation package because it serves Home, Pulse, and Beacon together.

Done when: signup/login switching, email verification, OAuth, valid session refresh, and expired-session recovery return to the authorized original post/Beacon/home. A generic social visitor reaches social discovery without an address. Malicious/external redirect targets fail safely. Following/posting still requires an explicit user action rather than silently executing on return.

### B04 — Home setup asks for too much before the first result

**P1 · Source · Owner: product + clients**

Evidence: `frontend/apps/web/src/app/(app)/app/homes/new/page.tsx:102` defines Location/Details/Setup/Review. Details and setup expose property attributes, ownership/renter relationship, Wi-Fi, and entry information (`:919`, `:1102`). Native AddHome step/access components also exist; field-for-field parity was not exercised.

Smallest change: begin with explicit private save, required unit disambiguation, and the first chosen action. Ask about household joining separately; defer optional property inventory and credentials to relevant features. Use “Save/Add my home” for private setup and reserve ownership language for that actual claim.

Done when: an eligible renter or owner can reach the useful action without entering Wi-Fi, gate information, room counts, or ownership evidence. Duplicate addresses/units do not reveal occupants or grant household access. Skipping optional fields is obvious and does not block unrelated social participation.

### B05 — Normal Pulse access depends on neighborhood population

**P1 · Source · Owner: product + web/iOS/Android**

Evidence: `frontend/apps/web/src/app/(app)/app/nearby/page.tsx:4` describes the density door; `:135` renders locked surfaces. AppShell routes the social entry to Nearby (`AppShell.tsx:700`). The existing feed behind it includes Beacons and Connections as well as Place. Default threshold is 24 (`backend/services/place/densityReader.js:54`); actual production configuration was not read.

Important qualification: this is not proof that every social route is server-blocked. Web feed routes remain registered. iOS `Features/Root/NeighborhoodTabRoot.swift:58` presents a pending deep-linked surface without checking the meter. The problem is ordinary navigation and inconsistent discoverability, not a demonstrated universal access ban.

Smallest change: give Pulse and Beacon direct, consistently available entry points; handle sparse local content inside the local surface. Retain local posting eligibility and aggregation privacy floors. Explicitly label the chosen area and any broader discovery scope.

Done when: no-address users can follow/read Beacons; a sparse-area user can browse permitted social content and existing connections; eligible users can participate without recruiting 24 people. Normal navigation and authorized shared links yield consistent outcomes. No fake neighbors, fabricated activity, or broadened access to private local content.

### B06 — Beacon discovery, following, and release flags are fragmented

**P1 · Source + Test; production cohort unverified · Owner: clients + API/release**

Evidence: web navigation has separately gated Audience and My Beacon entries (`AppShell.tsx:703`); `src/lib/featureFlags.ts:24` layers identity/persona/broadcast flags, defaulting off in production when unset, while `audience_profile` is also checked dynamically. Mobile web's four entries do not include Beacon (`MobileTabBar.tsx:13`). Native root labels similarly omit it. Absence of a root tab alone does not prove that every secondary entry is absent.

`app/(app)/app/audience/page.tsx:141` presents creator setup when no persona exists; it does not first load the user's following list. The existing feed's persona surface can be reused for followers. `AudienceProfileClient.tsx:132` swallows follow errors, and `:250` selects handshake versus legacy direct follow by flag. Legacy unauthorized behavior depends on the shared API client's session handler, so exact production recovery remains unverified.

Smallest change: choose a canonical follower destination and creator-management entry, document compatible frontend/backend flags for the release cohort, and expose readable follow/error/pending states across both supported paths. Keep advanced paid tiers outside the required loop.

Done when: a new follower with no address or own Beacon reads a public profile, follows explicitly, finds it later, views a subsequent update, mutes/unfollows, and sees retries for failures. A creator can publish under the chosen public identity. Repeat on all released clients with the same documented flags. Do not treat successful nav tests as proof that production flags are enabled.

### B07 — Calendar first-value path has a failing test contract and schedule ambiguity

**P1 · Test + Source; live save/delivery unverified · Owner: backend + home clients**

Observed: 3 of 12 selected address-calendar tests failed. Two report “No RPC mock configured”; one expects HTTP 200 but receives 500 for the same save path. `addressCalendarService.js:207` now calls `set_home_pickup_rules`, while the in-memory Supabase mock returns that error without a configured RPC implementation (`backend/tests/__mocks__/supabaseAdmin.js:731`). The corresponding migration exists in both migration trees: `199_address_calendar_pickup_swap.sql` / `20260902000002_address_calendar_pickup_swap.sql`. Its deployed state was not inspected.

Classification: confirmed test-harness mismatch, not a demonstrated production outage. The production database function and permissions still need staging validation.

Additional source issue: `AddressCalendarCard.tsx:109` sends only weekday, while the service defaults recycling to biweekly and anchors it to the next occurrence. The UI says this can be changed, but the inspected picker offers weekday choices rather than a recycling-cycle control. A user's weekday alone cannot establish whether the next week is a recycling week. Saved success also promises reminders beginning the night before (`:110`) without this audit establishing device delivery.

Smallest change: align the existing tests with the atomic database operation, verify the real migration in staging, and collect or omit unsupported recycling assumptions. Retain the previous schedule if a write fails. Scope notification copy to proven behavior.

Done when: save/reload/change/reset succeed for two isolated households; tests exercise atomic replacement and failure retention; weekly/biweekly and next-occurrence inputs are explicit and accurate; household schedules are identified as user-provided; timezone boundaries work; any promised reminder arrives once, opens the correct home, and honors opt-out. A notification-generation unit test is not delivery evidence.

### B08 — Reachable adjacent actions must tell the truth

**P2/conditional release gate · Source · Owner: feature owners + QA**

Evidence examples: `app/(app)/app/mailbox/tasks/page.tsx:15` uses `home_1`; `backend/routes/mailboxV2Phase3.js:983` describes simplified gig creation; `:1663` describes mock translation; `backend/routes/mailboxV2.js:777` returns a placeholder neighbor request. Earlier source review also identified mail actions that record a decision rather than perform the advertised external action.

Smallest change: inventory reachable routes under the release flags; finish or accurately remove unfinished promises. Do not expand v1 into building every mailbox feature. Keep existing obligations and paid entitlements intact.

Done when: every reachable button has a real, correctly labeled outcome or an explicit unavailable state; no hardcoded home is used for real users; payment, signing, physical mail, and task fulfillment are not claimed from a recorded click. Document what remains reachable through old links.

### B09 — Deployed product and checkout need an explicit release manifest

**P1 · Live + Source · Owner: release + product**

Evidence: production registration and homepage differ from current code's slimmer signup and wedge homepage. The live `/start` exists, so it would be inaccurate to say the entire new funnel is undeployed. Exact deployed commits, native versions, and flags are unknown.

Smallest change: identify deployed revisions/builds and configuration without dumping secret values; map them to the candidate backend and migration set. Align consumer copy to the selected three-pillar release. Remove absolute identity claims that exceed the verification mechanism.

Done when: a recorded manifest identifies each released client/build, backend revision, required migrations, nonsecret feature-flag states, supported geography, and rollback plan; website/store/app promises match what that cohort can actually do.

### B10 — End-to-end return, social safety, and platform evidence remain open

**P1 evidence gate · Unverified, not a blanket defect · Owner: QA + feature owners**

Selected tests establish component/service behavior. They do not establish actual push delivery, reply loops, real database permissions, physical-device routing, moderation handling, accessibility, or survival of a long-lived session.

Smallest next action: execute the matrix below in an isolated staging environment with designated test accounts, public/private post fixtures, and a creator/follower pair. Do not use production users as fixtures.

Done when: all mandatory scenarios have build-specific evidence and all failures are resolved or explicitly excluded from release without leaving unsafe reachable behavior. Report handling includes a usable moderation workflow; merely displaying a Report button is insufficient.

## 4. Scenario matrix for implementation and release verification

All three client columns remain open until actually run on release-candidate web, iOS, and Android. Current source or local-test evidence is not a substitute.

| ID | Scenario and observable acceptance | Current evidence |
|---|---|---|
| H1 | Preview → signup → same context; no manual address re-entry, duplicated save, or unauthorized household attachment. | B02 source concern |
| H2 | Failed save → visible retry → single durable save; cancel/logout/account change do not attach another user's pending context. | Recovery not verified |
| H3 | Unverified private-home user sets a confirmed schedule, reloads, changes and removes it; stranger cannot read or alter it. | Calendar read/permission tests pass; save tests blocked by RPC mock |
| H4 | Weekly/biweekly anchor and timezone boundaries correct; unsupported municipality never presented as official coverage. | Source review; live dates unverified |
| H5 | Enabled reminder delivered once and opens correct context; disabled permission/preferences handled honestly. | Signal generation only tested |
| P1 | Normal navigation reaches eligible local/social content at zero/sparse density; area and author context visible. | Density-door concern |
| P2 | Shared authorized post → login/signup/verification → same post; restricted/deleted post remains unavailable. | Initial login redirect observed; signup loses target |
| P3 | Eligible author publishes; another participant comments; author receives update and returns to reply. | Not executed end to end |
| P4 | Explicit identity/audience before publishing; no hidden local/public bridge; editing/deletion updates authorized views. | Feed author tests pass; whole journey unverified |
| P5 | Block/report/mute apply to relevant feeds, direct access and notifications; report reaches moderation handling. | Not executed end to end |
| B1 | No-address visitor reads public Beacon, follows after auth, returns to it without creating a Beacon. | Follow backend tests pass; UI/flags unverified |
| B2 | Creator publishes as Beacon; follower finds update, controls notifications and unfollows. | Components exist; whole loop unverified |
| B3 | Failed/pending/approved follow states clear; retry idempotent; unfollow actually changes access/update behavior. | Partial mocked service coverage |
| B4 | Creator, follower, and unrelated local account cannot infer hidden identity links from responses, media, search, or notifications. | Partial identity tests; B01 remains open |
| X1 | Fresh/expired/refreshed session, email verification and OAuth preserve authorized intent; external redirects rejected. | Middleware/source reviewed; full matrix open |
| X2 | Slow/offline/retry/empty states accessible at narrow width and via keyboard/screen reader; user input survives. | Not executed across journeys |
| X3 | Every included platform uses intended flags/migrations; old links work; all reachable commerce/mail actions are truthful. | Manifest/reachability audit open |

## 5. Executed verification

Web command, from `frontend/apps/web`:

```sh
pnpm exec jest --runInBand --runTestsByPath tests/startFunnel.test.tsx tests/audienceNav.test.tsx tests/personaHandshakePage.test.tsx tests/notificationRoutes.test.ts
```

Result: **4 suites passed; 41 tests passed.** API dependencies are mocked. These do not traverse an actual signup or prove production flags.

Backend command, from `backend`:

```sh
pnpm exec jest --runInBand --runTestsByPath tests/unit/homeMirror.test.js tests/unit/addressCalendar.test.js tests/unit/feedIdentityAuthors.test.js tests/unit/personasMeFollowing.routes.test.js tests/unit/notificationContextFirewall.test.js
```

Result: **4 suites passed, 1 failed; 59 tests passed, 3 failed (62 total).** Failures are the calendar RPC mock mismatch described in B07. The initial sandbox attempt could not open Supertest's temporary listener; the same mocked suite was rerun with local listener permission. Supabase and notification integrations remained mocked; no production database was targeted.

Total selected assertions/tests: **100 passed, 3 failed** across 9 suites. This is a focused sample, not the full repository test suite. No tests were changed to obtain these results.

## 6. Implementation order and audit limits

1. Resolve B01 entitlement questions before touching household attachment or expanding sensitive access.
2. Implement B03 + B02 as the first bounded package: intent-preserving authentication and safe Home continuity. Reproduce each case first; preserve existing redirect protections and sessions.
3. Complete B04 + B07: minimal setup and one accurate, persistent private utility.
4. Complete B05 + B06: accessible social navigation, follower destination, publishing/following return loop, and consistent release flags. This is core work, not optional post-launch social expansion.
5. Adjudicate B08 reachability, establish B09 manifest, and run B10 staging/device matrix. Pilot real usage before broader rollout.

Do not convert these ten items into ten independent full redesigns. Several share auth/navigation work; estimate implementation after reproductions and the manifest identify the actual deployed gaps. The earlier 8–12 week range remains provisional.

Outstanding evidence: authenticated production/staging journeys, deployed migrations and flags, native installed-build behavior, real push delivery, payment/fulfillment behavior if included, and user retention. These were deliberately not claimed complete. The [release brief](v1-release-brief-2026-09-06.md) defines the recommended finish line and excludes new speculative features from this implementation cycle.
