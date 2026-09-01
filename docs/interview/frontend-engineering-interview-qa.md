# Frontend Engineering Interview Q&A

Verified against the repository on 2026-05-14.

This document turns the frontend architecture discussion into interview-ready answers. It is intentionally candid: it explains what is strong in the codebase, what is temporary technical debt, what is server-authoritative, and what I would change next.

## Short Executive Answer

The web frontend is a Next.js App Router application inside a pnpm monorepo. It shares its API client, domain types, UI constants, and design tokens with the Expo mobile app through `@pantopus/*` packages. The browser talks to the Express backend through Next rewrites, which keeps `/api` and `/socket.io` same-origin so httpOnly auth cookies work without exposing tokens to JavaScript.

The main weak spot is web TypeScript enforcement. `next build` currently ignores type errors and CI runs web type-check non-blocking because the web app still has a non-trivial TypeScript backlog. I verified the current `pnpm --filter=@pantopus/web type-check` output: it fails with 184 errors. The dominant class is mechanical Next navigation nullability, not runtime architecture failure, but it still should be made blocking. The plan is to burn down those errors, remove local suppressions, make CI type-check blocking, and finally remove `ignoreBuildErrors`.

Authorization is not trusted to the UI. Frontend gates improve UX by hiding tabs or disabling actions, but backend middleware and route handlers enforce auth, CSRF, feature flags, home IAM, business seats, and ownership rules. React Query stale times are chosen per domain based on backend freshness expectations and volatility: 30 seconds for high-churn feeds and marketplace surfaces, 2 minutes for hub aggregates, 5 minutes for slow-changing sports/events/reference data, and 60 seconds for feature flags to match the backend cache horizon.

## 1. Why Does Next Config Ignore TypeScript Build Errors?

### Interview Answer

It ignores TypeScript build errors because this repository currently separates "can produce a deployable Next artifact" from "is the entire web TypeScript graph clean." In `frontend/apps/web/next.config.js`, `typescript.ignoreBuildErrors` is explicitly set to `true`. The inline comment says this was done because pre-existing type errors are unrelated to the build/deployment setup and should be inspected with `pnpm type-check`.

That is a pragmatic transition state, not a quality standard. If I were defending this in an interview, I would be clear that I do not want `next build` to permanently bypass type errors. The reason it exists is to avoid freezing all shipping while known, pre-existing type debt is cleaned up in parallel.

### Repo Evidence

- `frontend/apps/web/next.config.js`:
  - `typescript.ignoreBuildErrors: true`
  - comment: "Pre-existing type errors unrelated to Docker setup."
  - `pnpm type-check` is the intended diagnostic path.

- `frontend/apps/web/package.json`:
  - `type-check` is `tsc --noEmit`.

- I ran:

```bash
pnpm --filter=@pantopus/web type-check
```

The command currently fails with 184 TypeScript errors. The rough distribution from the sampled run was:

| Code | Count | Meaning in this repo |
|---|---:|---|
| `TS18047` | 122 | Mostly nullable `usePathname`, `useSearchParams`, and `useParams` handling |
| `TS2339` | 34 | Property access on too-broad or nullable route/object types |
| `TS2322` | 17 | Assignment mismatch between shared/domain types and local UI expectations |
| `TS2769` | 6 | Overload mismatch, often from unknown/record-style data |
| `TS18046` | 4 | `unknown` values not narrowed before rendering |
| `TS2345` | 1 | Nullable value passed to a non-null string parameter |

### Why This Tradeoff Was Made

This monorepo contains several fast-moving domains: homes, identity firewall, audience profiles, marketplace, mailbox, chat, maps, gigs, and support trains. The web app also uses Next 15 / React 19 patterns, and many current errors are from strict nullability around navigation hooks and route params rather than obviously broken runtime flows.

During active migration work, blocking production artifacts on all historical type debt can create a bad incentive: engineers may hide errors with broad `any`, `@ts-ignore`, or worse, revert strictness. The better transition is to keep strict mode on, keep type-check visible, categorize the errors, and then make the gate mandatory after the count reaches zero.

### What I Would Not Do

I would not lower `strict`, disable `skipLibCheck` further, or use a large global type shim that lies about Next navigation hooks. That makes the repository look cleaner while reducing real safety.

I would also avoid "fixing" by casting route params and API responses everywhere. The durable fix is to introduce a small set of typed route-param helpers, tighten shared API response types, and remove local escape hatches.

## 2. Why Is Web Type-Check Non-Blocking In CI?

### Interview Answer

The web type-check is non-blocking because CI is currently configured to report type errors without failing the pull request. In `.github/workflows/ci.yml`, the `Type-check web` step runs `pnpm --filter=@pantopus/web type-check` with `continue-on-error: true`.

This is consistent with the Next config decision: web type errors are known, tracked debt. CI still gives signal, but it does not prevent merge yet. The important nuance is that this is different from mobile: the mobile release checks run `tsc --noEmit` as a blocking step. So the repo is already willing to enforce TypeScript; web is the exception because it has not crossed the cleanup threshold.

### Repo Evidence

The `web-checks` job does the following:

1. Installs dependencies.
2. Runs web ESLint.
3. Runs Identity Firewall web Jest tests.
4. Installs Playwright Chromium.
5. Runs Identity Firewall Playwright tests.
6. Runs web type-check non-blocking.

So CI is not unguarded. It blocks on lint and critical privacy/identity tests. The specific gap is TypeScript.

### The Risk

The risk is that a new pull request can add more type debt without being stopped. Even worse, when type-check is already red, engineers become numb to the signal and stop reading the output.

In an interview I would say: this is acceptable only if it has a short-lived owner, a measured burn-down, and a hard switch-over date or threshold. Otherwise it becomes normalized technical debt.

## 3. What Is The Plan To Make Type-Check Mandatory?

### Interview Answer

I would make it mandatory in phases so we do not trade one kind of risk for another.

### Phase 1: Categorize And Fix The High-Volume Mechanical Errors

Most current failures are `TS18047` around nullable route/navigation hooks. The fix is to standardize local helpers for:

- `useRequiredPathname()`
- `useRequiredSearchParams()`
- `useRequiredParams<T>()`
- optional route fallback handling where a route can genuinely be missing data

This avoids sprinkling `!` assertions through the app. Where the route cannot work without the param, the helper should throw or redirect early. Where the route can render a safe empty state, the component should narrow explicitly.

### Phase 2: Repair Shared API And Type Contracts

The next class is real contract mismatch:

- API response shapes are wider or narrower than UI assumptions.
- Some public profile components receive `unknown`/`Record<string, unknown>` and render values without narrowing.
- Some shared `@pantopus/api` exports and `@pantopus/types` definitions lag backend route payloads.

The right fix is not local casting in pages. It is to update the shared package types or endpoint normalizers so both web and mobile consume the same stable contract.

### Phase 3: Remove Local Suppressions

There are still `@ts-nocheck` files on heavy surfaces such as the legacy gigs/map path. Those should be converted file by file:

- Introduce local interface boundaries.
- Type map pin/listing/gig records.
- Remove duplicate/conflicting local `Bounds` definitions.
- Type event callbacks and query parameters.

### Phase 4: Add A Ratchet Gate Before Going Fully Blocking

If the team needs an intermediate step, use a ratchet:

- Store a baseline count of TypeScript errors.
- Fail CI if the count increases.
- Require each PR touching a typed area to reduce the count.
- When count reaches zero, remove the ratchet and run `tsc --noEmit` normally.

This is less ideal than immediate blocking, but it prevents regression while cleanup proceeds.

### Phase 5: Make CI Blocking

Change:

```yaml
- name: Type-check web
  run: pnpm --filter=@pantopus/web type-check
  continue-on-error: true
```

to:

```yaml
- name: Type-check web
  run: pnpm --filter=@pantopus/web type-check
```

### Phase 6: Make Next Build Blocking Too

Remove this from `next.config.js`:

```js
typescript: {
  ignoreBuildErrors: true,
}
```

After that, the web app has two protections:

- `tsc --noEmit` in CI for explicit type validation.
- `next build` as the framework-integrated build gate.

### Acceptance Criteria

I would consider the migration complete only when:

- `pnpm --filter=@pantopus/web type-check` exits 0 locally and in CI.
- `next build` fails on type errors.
- No production page has `@ts-nocheck`.
- Any temporary `@ts-expect-error` includes an issue link or expiration condition.
- Shared API response contracts are typed in `@pantopus/api` or `@pantopus/types`, not ad hoc in pages.

## 4. How Do App Routes Map To Backend API Domains?

### Interview Answer

Next app routes do not own backend domain behavior. They are UI routes that call `@pantopus/api`, and Next rewrites proxy `/api` and `/socket.io` to the Express backend. That keeps browser requests same-origin, which is essential for httpOnly cookies, CSRF, and Socket.IO cookie fallback.

The mapping is intentionally domain-oriented:

- Web route groups define user workflows.
- `@pantopus/api` defines frontend domain clients.
- Express `app.js` mounts backend routers under `/api`.

### Transport Layer

In `frontend/apps/web/next.config.js`:

- `/api/:path*` rewrites to the backend API URL.
- `/socket.io/:path*` rewrites to the backend Socket.IO server.

The shared API client uses relative URLs on web, so browser calls go through the rewrite. On mobile, the same API client uses an absolute backend URL and Bearer tokens.

### Backend Mount Layer

The backend mounts domain routers in `backend/app.js`, including:

| Backend mount | Domain |
|---|---|
| `/api/users` | auth, profile, user settings, blocks |
| `/api/gigs` | task marketplace, bids, gig detail, browse |
| `/api/posts` | feed, posts, post map, post preferences |
| `/api/sports` | active sports event lane |
| `/api/chat` | conversations, messages, reactions, read state |
| `/api/homes` | homes, home IAM, ownership, guest/share flows |
| `/api/mailbox` | mailbox v1 and compose |
| `/api/mailbox/v2` | mailbox v2 core |
| `/api/mailbox/v2/p2` | mailbox phase 2 features |
| `/api/mailbox/v2/p3` | mailbox phase 3 features |
| `/api/listings` | marketplace listings |
| `/api/marketplace` | marketplace analytics/saved searches |
| `/api/businesses` | business profiles, seats, verification, pages |
| `/api/b` | public business pages |
| `/api/payments` | payment intents, payment methods, Stripe Connect |
| `/api/wallet` | wallet, withdrawals, transactions |
| `/api/notifications` | notification feeds, unread counts, push tokens |
| `/api/privacy` | privacy settings and blocks |
| `/api/identity-center` | private identity center and view-as preview |
| `/api/identity` | profile-safe identity search |
| `/api/personas` | audience profile / Beacon surfaces |
| `/api/broadcast` | persona broadcast |
| `/api/v1/address` | address validation |
| `/api/activities/support-trains` | support train workflows |

### Frontend Route To API Domain Map

| Web route | Primary API domains | Notes |
|---|---|---|
| `/app/hub` | `/api/hub`, `/api/notifications`, `/api/gigs/rebookable` | Aggregated dashboard; React Query stale time is longer than feed |
| `/app/feed` | `/api/posts`, `/api/sports`, `/api/chat` for inquiries | Feed is high-churn and cursor paginated |
| `/app/chat` | `/api/chat`, `/socket.io` | Initial data via REST, live updates via Socket.IO |
| `/app/gigs`, `/app/gigs-v2` | `/api/gigs`, `/api/v2`, `/api/payments` | Browse, bid, accept, completion, payment paths |
| `/app/marketplace` | `/api/listings`, `/api/marketplace`, `/api/transaction-reviews` | Browse, discover, offers, reviews, saved searches |
| `/app/homes/*` | `/api/homes`, `/api/homes/:id/me`, home ownership/IAM routes | UI gates by home access booleans; backend enforces |
| `/app/businesses/*` | `/api/businesses`, business seats/IAM/verification routes | Seat permissions and business role checks are server-side |
| `/app/mailbox/*` | `/api/mailbox`, `/api/mailbox/v2`, `/api/mailbox/v2/p2`, `/api/mailbox/v2/p3` | Rich mailbox domain with separate query wrappers |
| `/app/identity` | `/api/identity-center`, `/api/privacy`, `/api/local-profiles`, `/api/personas` | Identity Firewall and view-as preview |
| `/app/audience`, `/app/persona/*` | `/api/personas`, persona tiers, payments, DMs, membership, blocks | Feature-flagged by `audience_profile` |
| `/app/map`, `/app/discover` | `/api/geo`, `/api/location`, `/api/businesses/search`, `/api/listings/in-bounds`, `/api/posts/map` | Map/discovery surfaces combine several domains |

### Why This Mapping Works

It keeps frontend routes user-centered and backend APIs domain-centered. For example, `/app/hub` is not a backend domain by itself; it is a UI composition of homes, businesses, discovery, notifications, and today cards. The backend exposes a purpose-built `/api/hub` aggregate so the frontend does not need to duplicate business logic.

## 5. How Do You Prevent Product Drift Between Web And Mobile?

### Interview Answer

The main strategy is shared contracts. Web and mobile should diverge in interaction model and platform capabilities, not in product rules, enums, labels, endpoint behavior, or security semantics.

This repo already has the right foundation:

- `@pantopus/api` is shared by web and mobile.
- `@pantopus/types` holds domain types.
- `@pantopus/ui-utils` holds shared UI constants and mapping helpers.
- `@pantopus/theme` holds design tokens.
- `@pantopus/utils` holds cross-platform utility functions.

### Concrete Examples

Marketplace categories and conditions live in `frontend/packages/ui-utils/src/marketplace-contract.ts`. Both web and mobile derive their UI constants from that contract, then map to platform-specific icons locally.

Feed post type configuration is shared through `@pantopus/ui-utils`, while each platform renders the chips/cards in its own native or web component style.

Auth behavior is centralized in `@pantopus/api`, but configured per platform:

- Web: cookie transport, CSRF header, same-origin rewrites.
- Mobile: Bearer token transport, SecureStore, foreground/boot refresh.

### Drift Prevention Rules

1. Backend owns decisions.
   Clients can help the user, but backend decides auth, permissions, privacy, address validity, payment state, and visibility.

2. Shared packages own contracts.
   If both clients need it, it belongs in `@pantopus/api`, `@pantopus/types`, `@pantopus/ui-utils`, or `@pantopus/theme`.

3. Platform apps own presentation.
   Web can use hover, sidebars, browser focus management, and route-level splitting. Mobile can use native navigation, haptics, push, biometric locks, and device permissions.

4. Feature flags are server visible.
   Web and mobile can hide disabled surfaces, but backend feature-flag middleware must also protect gated endpoints.

5. Cross-platform smoke tests should cover the same acceptance criteria.
   If a new persona membership rule exists, the web and mobile tests should assert the same states even if the screens differ.

### Remaining Drift Risks

There are still areas I would improve:

- Some route mapping logic is platform-local.
- Some identity copy is web-local and should graduate into a shared copy contract.
- Some older web pages still use broad `Record<string, unknown>` contracts.
- Web type-check debt weakens contract drift detection.

The highest-value fix is making web TypeScript mandatory. Once both web and mobile block on type-check, shared contract drift becomes much harder to miss.

## 6. How Does Web Auth Recover From Expired Cookies?

### Interview Answer

Web auth is cookie-based. The browser never reads the access token because the backend sets it as `httpOnly`. The frontend uses a JS-readable `pantopus_session` flag only to know that a session probably exists; it is not treated as authority.

On API calls, the shared Axios client sends:

- `x-token-transport: cookie`
- `x-csrf-token` for mutating requests, read from the non-httpOnly CSRF cookie

If a non-auth API request receives a 401, the response interceptor tries to refresh the session using `/api/users/refresh`. A mutex ensures that multiple simultaneous 401s do not stampede the refresh endpoint. If refresh succeeds, the original request is retried. If refresh is invalid, the session is cleared and the user is sent to login. If refresh fails transiently, the client does not destroy the session immediately.

### Cookie Model

The backend sets:

| Cookie | Visibility | Purpose |
|---|---|---|
| `pantopus_access` | httpOnly | access JWT, sent automatically to same-origin API |
| `pantopus_refresh` | httpOnly, path-scoped to `/api/users/refresh` | refresh token |
| `pantopus_csrf` | readable by JS | double-submit CSRF header |
| `pantopus_session` | readable by JS | session presence flag only |

The important security boundary is that `pantopus_session` is never authorization. It only prevents the app from instantly thinking the user is logged out after a page refresh while httpOnly cookies still exist.

### Expired Access Token Flow

1. User calls a protected API through `/api/...`.
2. Backend `verifyToken` finds `pantopus_access`, verifies it, and returns 401 if expired.
3. Axios sees 401 for a non-auth endpoint.
4. Axios calls `/api/users/refresh` through same-origin rewrite.
5. Backend reads `pantopus_refresh`, calls Supabase refresh, rotates session, and resets cookies.
6. Axios retries the original request.
7. UI continues without forcing a login.

### Missing Access Cookie Flow

There is a separate middleware-level case. If `pantopus_session=1` exists but `pantopus_access` is missing, Next middleware treats the session as stale. For `/app/*`, it clears auth cookies and redirects to `/login?redirectTo=...`.

That is conservative. It avoids a confusing state where protected pages render without a usable access cookie. The future improvement is a middleware refresh handoff: redirect to a lightweight refresh route or endpoint first, then continue to the requested page if refresh succeeds.

### Why Same-Origin Rewrites Matter

Without the Next rewrite, cookies would need CORS and explicit cross-site handling. With same-origin `/api`, browser cookies are naturally sent to the backend, and Socket.IO can also use cookie fallback for web sessions.

## 7. How Do React Query Stale Times Match Backend Freshness Requirements?

### Interview Answer

The stale times are chosen by volatility and correctness risk, not arbitrarily. The default web stale time is 30 seconds. Then specific domains override it:

- Fast-changing social and marketplace feeds stay at 30 seconds.
- Hub aggregates use 120 seconds because they summarize slower-changing state.
- Feature flags use 60 seconds to match backend cache propagation expectations.
- Sports active events use 5 minutes because event sets change at human schedules.
- Mailbox uses 30 seconds, 1 minute, or 5 minutes depending on the operation.
- Authorization and mutation correctness do not depend on stale frontend cache; backend still enforces.

### Repo Examples

| Area | Stale time | Reason |
|---|---:|---|
| Global default | 30 seconds | Good default for interactive app server state |
| Feed | 30 seconds | Posts/reactions/comments can change quickly |
| Chat conversation list | 30 seconds | Socket handles live changes, query handles baseline |
| Marketplace browse/discover | 30 seconds | Listings are active inventory and location-filtered |
| Notifications | 30 seconds plus socket invalidation | Badge/feed should feel current |
| Hub web | 120 seconds | Aggregate dashboard; avoids refetch churn |
| Hub mobile today | 5 minutes | Today card is less volatile and expensive to rebuild |
| Home access mobile | 5 minutes | Permissions rarely change minute to minute, backend still enforces |
| Feature flags | 60 seconds | Explicitly matches backend cache horizon |
| Sports active events | 5 minutes | Slow-changing event list |
| Mailbox drawer/meta | 30 seconds | User-visible counts and drawers |
| Mailbox item detail/assets | 1 minute | Detail pages do not require second-by-second freshness |
| Mailbox language/themes/memories | 5 minutes | Reference-like data |

### Freshness Principles

1. Mutation results invalidate related keys.
   For example, mailbox mutations invalidate drawers, counters, item detail, folders, or task keys as appropriate.

2. Socket events update or invalidate caches.
   Chat, notifications, and marketplace can receive live events and then update React Query data or refetch.

3. Stale data must never authorize.
   A cached permission can hide/show a tab, but the server checks the request again.

4. Slow-changing data gets longer cache windows.
   Feature flags, sports events, and reference metadata should not refetch on every navigation.

5. Prefetch uses very short stale windows.
   AppShell route hover prefetch uses 5 seconds, enough to make immediate navigation faster without keeping speculative data fresh for long.

### What I Would Improve

I would formalize a "freshness matrix" in the shared API package:

```ts
export const freshness = {
  realtime: 5_000,
  interactive: 30_000,
  aggregate: 120_000,
  reference: 300_000,
};
```

Then query hooks can cite named freshness tiers rather than literal numbers. That makes code review easier: the reviewer can ask whether a query is truly `aggregate` or should be `interactive`.

## 8. Where Is Frontend Authorization Enforced Versus Merely Hidden In UI?

### Interview Answer

Frontend authorization is mostly UX, not enforcement. The browser can hide a button, prevent a click, or redirect a user away from a page, but it cannot be trusted because users can call APIs directly.

Real enforcement happens in the backend:

- `verifyToken` authenticates Bearer tokens or httpOnly cookies.
- CSRF middleware protects cookie-authenticated mutating requests.
- `requireAdmin` protects platform admin actions.
- `requireFeatureFlag` returns 404 for gated features the user cannot access.
- home IAM checks enforce home-level permissions.
- business seat checks enforce business-level permissions.
- route handlers enforce ownership, creator, member, participant, and visibility constraints.

### Frontend Enforcement

The frontend does enforce coarse routing:

- Next middleware redirects unauthenticated users away from `/app/*`.
- It keeps authenticated users out of login/register pages.
- It handles stale cookie states.
- It rewrites public aliases for unauthenticated views.

But that only protects navigation. It does not protect data.

### UI Hiding / UX Gates

Examples:

- Home dashboard tabs use server-returned booleans such as `can_manage_tasks`, `can_manage_finance`, `can_manage_access`, `can_manage_home`, and `can_view_sensitive`.
- Audience navigation is shown only when `audience_profile` is enabled for the user.
- Buttons can be hidden or disabled based on ownership or status.
- Identity preview tabs focus and guide the user through privacy surfaces.

These gates reduce dead ends and communicate available actions, but they are not security boundaries.

### Backend Enforcement Examples

Home permissions are resolved server-side using occupancy, role base, verified ownership, and permission overrides. Owners get all permissions; non-owners are checked against role permissions and overrides.

Business permissions are resolved via `BusinessSeat`, `SeatBinding`, base role permissions, and seat/user overrides. The critical identity invariant is that seat binding is used only to resolve the authenticated user's own seat, not to expose who is behind another seat.

Feature flags are enforced server-side with `requireFeatureFlag`. Disabled features intentionally return 404 so users without access do not learn about hidden features from endpoint behavior.

### Interview Framing

The phrase I would use is:

"The frontend is allowed to predict authorization for ergonomics; the backend must decide authorization for correctness."

## 9. What Are The Heaviest Pages, And How Are They Profiled?

### Interview Answer

The heaviest pages are the surfaces that combine large lists, maps, sockets, media, and modal workflows:

1. Marketplace map/browse.
2. Feed.
3. Chat.
4. Notifications.
5. Mailbox.
6. AppShell.
7. Identity/persona management.
8. Gig browse/detail and gig creation.
9. Home dashboards and large settings/member flows.

The repo already documents a performance audit in `docs/09-web-performance-optimization-plan.md`. Some of that plan has already been acted on: feed, chat, and notifications now use React Virtual; heavy AppShell composers are dynamically imported; maps are dynamically imported with `ssr: false`.

### Heavy Surface Breakdown

#### AppShell

AppShell is loaded across authenticated pages. It owns:

- Sidebar/header.
- notification bells.
- chat badge counts.
- socket provider wrapping.
- floating chat widget.
- floating promo modal.
- feed composer.
- magic task composer.
- route and query prefetching.

The repo already dynamically imports `PostComposer` and `MagicTaskComposerV2`, which keeps those heavy chunks out of the initial AppShell bundle until needed.

#### Feed

Feed is heavy because it has:

- infinite scroll.
- post cards with media.
- composer.
- topic/sports logic.
- map view.
- inquiry chat drawer.
- filters and preferences.

The feed map is dynamically imported, and the feed list uses `@tanstack/react-virtual`.

#### Marketplace

Marketplace is heavy because it combines:

- Leaflet.
- React Leaflet.
- Supercluster.
- listing cards.
- grid/map modes.
- geolocation and radius suggestions.
- browse and discover query modes.
- cluster drawers/cards.

The map is a client-only dynamic import. Listing fetches use React Query with filter-based keys.

#### Chat

Chat is heavy because it combines:

- REST baseline data.
- Socket.IO live updates.
- virtualized conversation lists.
- message list rendering.
- emoji picker.
- file attachments.
- gig/listing rich cards.

Conversation list virtualization helps. Message bubbles and action menus still need more accessibility and memoization work.

#### Notifications

Notifications can grow without bound for active users. The page uses `useInfiniteQuery` and virtualizes a flattened list of date headers plus rows.

#### Mailbox

Mailbox is a large domain. It has drawers, item detail, vault, community, tasks, maps, stamps, themes, translations, vacation hold, earn flows, records, and package flows. It has the most mature React Query wrapper layer.

### Current Profiling And Optimization Tools

The repo uses several practical approaches:

- Source-size audit using `wc -l` and code structure.
- Runtime list virtualization for large lists.
- Dynamic imports for maps and heavy modal surfaces.
- React Query caching and route prefetching.
- Performance planning in `docs/09-web-performance-optimization-plan.md`.
- Dev warnings for slow identity center load over a budget.

### What I Would Add

1. Add `@next/bundle-analyzer`.
   Track per-route JavaScript, shared chunks, and accidental dependency growth.

2. Add Lighthouse CI for key routes.
   Gate or at least report LCP, TBT, CLS, and accessibility for login, hub, feed, marketplace, chat, and identity.

3. Add React Profiler sessions for critical workflows.
   Profile feed scroll, marketplace map pan/zoom, chat send/receive, and AppShell route transition.

4. Add bundle budgets.
   Example: AppShell shared chunk should not grow beyond a threshold without explicit review.

5. Add user-timing marks.
   For complex flows like identity center, marketplace first results, hub load, and chat first message.

6. Add production telemetry.
   Use a client analytics/error sink for route load times, tile failures, and API slow paths.

### Performance Philosophy

The best performance fixes here are architectural:

- keep heavy tools off the first route load,
- virtualize unbounded lists,
- keep maps client-only and bounded,
- use React Query keys instead of hand-rolled fetch state,
- prefetch predictable destinations,
- never load every domain just because AppShell exists.

## 10. How Do You Handle Accessibility For Chat, Marketplace, Maps, And Identity Flows?

### Interview Answer

Accessibility is handled as a product requirement, not only as ARIA decoration. The repo has several good patterns already: semantic regions, dialog roles, tab semantics, focusable sections, focus rings, keyboard-accessible controls, `aria-pressed` for toggles, `aria-busy` for loading flows, and a mailbox accessibility audit.

But there are still gaps. The biggest remaining issues are chat live announcements, menu semantics, map keyboard alternatives, and stronger focus management in custom popovers.

### Chat

What exists:

- Message list is a focusable region with `role="region"` and `aria-label="Chat messages"`.
- Input supports Enter to send.
- File and message actions are keyboard reachable because they are buttons.
- Escape closes the message action menu.

What I would improve:

- Add `aria-live="polite"` or a dedicated live region for new inbound messages.
- Give emoji and send buttons explicit `aria-label`s.
- Label file remove buttons with the file name.
- Give errors `role="alert"`.
- Use dialog/menu semantics for popovers where appropriate.
- Avoid auto-scroll stealing context when a screen reader user is reading older messages.

### Marketplace

What exists:

- View mode toggle uses `role="group"` and `aria-pressed`.
- Marketplace grid uses `role="feed"` with an accessible label.
- Filter pill bars use toolbar/button semantics.
- Category modal uses `role="dialog"` and `aria-modal`.
- Listing cards and save buttons have labels and pressed states.

What I would improve:

- Sort dropdown should use menu/listbox semantics, or be a native/select-like control.
- Category modal should trap focus and restore focus to the trigger on close.
- Close buttons need explicit labels in every modal.
- Listing cluster cards in map overlays should be buttons/links, not clickable divs.
- Infinite list loading and result count changes should be announced.

### Maps

Maps are the hardest because visual maps are not naturally accessible. The correct approach is not to make every tile accessible; it is to provide equivalent controls and list alternatives.

What exists:

- Map controls have labels, such as "Go to my location."
- Discover map/list views expose tab-like controls.
- Marketplace and feed map components have list/grid alternatives.
- Zoom gates and nearest-activity prompts communicate map state visually.

What I would improve:

- Every marker/cluster interaction needs keyboard equivalents.
- Cluster card overlays need focus management and semantic buttons/links.
- Map pins need accessible names such as listing title, price, distance, and category.
- Provide a synchronized list view for all map results.
- Do not rely on color-only cluster or pin meaning.
- Announce when map bounds change and new results are loaded, but avoid noisy live updates during pan/zoom.

### Identity Flows

Identity and privacy flows are stronger because they already treat focus and preview state as part of the workflow.

What exists:

- Sections are focusable with `tabIndex={-1}` for programmatic focus.
- Navigation uses an ARIA label.
- Dialogs have `role="dialog"`, `aria-modal`, `aria-labelledby`, and `aria-describedby`.
- Toggle buttons expose `aria-pressed`.
- Preview pages expose `aria-busy` and alerts.
- The page has explicit focus behavior for profile links and privacy preview sections.

What I would improve:

- Ensure all status transitions use `role="status"` or `aria-live` where a screen reader user needs confirmation.
- Confirm every custom tab behaves like a keyboard tablist if using `role="tab"`.
- Avoid hidden-but-focusable inactive content.
- Add Playwright accessibility tests for setup, preview, linking profiles, and block list flows.

### Accessibility Testing Plan

1. Manual keyboard pass for each target flow.
2. Screen reader smoke pass with VoiceOver on macOS/iOS.
3. Automated axe checks in Playwright for stable pages.
4. Component tests for focus trap and focus restoration in custom dialogs.
5. Visual regression screenshots to catch focus outline clipping and layout overlap.
6. Reduced motion audit for spinners, pulsing skeletons, modal animations, and auto-scroll.

## How I Would Present This In An Interview

I would avoid pretending the codebase is perfect. A strong senior answer acknowledges the real state:

- "The repo currently ships with known web TypeScript debt, and I would not normalize that."
- "The security model does not rely on the frontend."
- "Web and mobile share contracts, but still need stricter type gates to prevent drift."
- "React Query stale times reflect domain volatility, and mutations/sockets handle the cases where users need immediate updates."
- "Maps require equivalent non-map experiences; accessibility is not solved by ARIA labels alone."

The strongest theme is that the architecture has the right boundaries:

- Backend owns authority.
- Shared packages own contracts.
- Web and mobile own platform-specific UX.
- CI should enforce the contracts once the known debt is retired.

## Reference Checklist

Use this checklist for future work on these interview topics:

- [ ] Remove `typescript.ignoreBuildErrors` from web Next config.
- [ ] Remove `continue-on-error: true` from web type-check CI.
- [ ] Drive web type-check from 184 errors to zero.
- [ ] Remove `@ts-nocheck` from production web routes.
- [ ] Add bundle analyzer and route budgets.
- [ ] Add Lighthouse CI for web.
- [ ] Centralize freshness tiers for React Query.
- [ ] Continue migrating manual fetch flows to React Query.
- [ ] Add API contract tests for shared web/mobile endpoint types.
- [ ] Add accessibility tests for chat, marketplace dialogs, map alternatives, and identity flows.
- [ ] Add keyboard-accessible marker/cluster alternatives for map pages.
- [ ] Add live-region behavior for chat and long-running identity flows.

