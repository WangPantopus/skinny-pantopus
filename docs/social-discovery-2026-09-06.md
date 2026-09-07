# Social discovery without neighborhood density

Implemented September 6, 2026, following the entry-continuity and calendar increments. Addresses B05's normal-navigation gap and B06's follower-discovery gap in the [journey audit](v1-journey-audit-2026-09-06.md). This is a local implementation and verification record, not a deployed-release sign-off.

## User-visible result

- Nearby always offers **Pulse, Beacons, and Connections** on web, iOS, and Android, including loading, unavailable meter, no home, forming, growing, and unlocked states. Home setup remains an optional, separately described action.
- The neighborhood meter now describes **local Marketplace and Tasks**. Its threshold, withheld counts, privacy floors, and backend authorization are unchanged. Pulse retains its existing chosen-area controls and posting eligibility. No activity or neighbors are fabricated, and browsing scope is not automatically widened.
- Web has a follower-oriented `/app/beacons` directory: search public names/handles, open a public profile, return to followed Beacons and their latest posts, mute for seven days/unmute, and unfollow. Paid follows route to existing membership management. Search and following failures have independent retries. Pagination and account changes do not display another page/account's cached followers. Following still requires the existing explicit profile action.
- The web Beacon feed links to discovery and following; Nearby remains selected for Beacon and Connections routes. Creator setup remains a separate **My Beacon** destination.
- Native Beacon Updates has persistent **Find Beacons** and **Following** buttons. Discovery opens the existing universal search on its Beacons tab and requests public profiles. Android's Following empty action also opens that search. iOS's active Hub stack now hosts the existing Following screen and routes its discovery/profile actions.
- Native Beacon feeds no longer show the general Pulse compose button. Their verification badge comes from the public profile's server credential; the surface itself grants no badge. An empty feed no longer claims the user follows zero profiles.
- iOS Beacon Updates now contains its accessibility children and uses a single back bar. Actual device tests caught an inherited screen identifier masking the new controls.

Home metadata, ATTOM/property information, weather, air quality, sun position, election information, household tools, and verification flows were not removed or changed by this increment.

## Navigation and scope

The current four root tabs remain Place / Today / Nearby / Mail. The broader Home / Pulse / Beacons / Inbox proposal remains separate. On iOS, Nearby's Beacons and Connections actions use the canonical deep-link router, which selects the Place-owned Hub stack; Pulse opens the existing Nearby sheet. Android uses its existing child routes. Existing profile/post URLs remain supported.

Web search accepts only public-profile results with the server's canonical `/@handle` path. Following rows use the existing `/persona/handle` public page. The directory never renders a linked private/local identity from the search payload. It does not require a home, local profile, or creator profile.

This increment repairs the active Nearby/Hub follower journey. Legacy iOS `YouTabRoot` and the self-contained Settings substack still contain older social placeholders; they require a separate reachability cleanup before claiming that every secondary route is complete. Creator publishing, notifications and reply return journeys also need release evidence.

## Compatible release configuration

Do not infer production settings from development defaults. No flags were changed.

| Capability | Required existing configuration |
|---|---|
| Public Beacon search and Following APIs | Backend `IDENTITY_FIREWALL_ENABLED=true` and `PERSONA_ENABLED=true`; these mount `/api/identity` and `/api/personas`. |
| Beacon publishing/broadcast loop | Backend `PERSONA_BROADCAST_ENABLED=true`, with the identity/persona parents enabled. |
| Web persona/creator controls | Build-time `NEXT_PUBLIC_IDENTITY_FIREWALL_ENABLED=true`, `NEXT_PUBLIC_PERSONA_ENABLED=true`; broadcast controls also require `NEXT_PUBLIC_PERSONA_BROADCAST_ENABLED=true`. |
| Handshake versus legacy free follow | Existing dynamic `audience_profile` flag selects the web path. Verify the intended cohort consistently across profile, follow, membership and native API behavior. |
| Paid membership | Separate existing paid-feature flags/configuration; not required for a free follower's first-value loop. |

Confirm the installed identity/persona/membership migrations and matching server routes in the designated staging environment before enabling a release cohort. When APIs are unavailable, the directory exposes errors/retries rather than inventing empty activity. Enabling a client button is not evidence that a backend capability is deployed.

## Verification

- Web: **29 passing component tests** across social discovery, Beacon directory, existing explicit-follow arrival and mobile navigation. The six meter states are covered; directory tests cover public routing, account isolation, failures/retries, mute/unfollow, paid management and pagination.
- Web browser: **1 passing real Chrome journey** using isolated API fixtures. Opens Nearby without a home, reaches Beacon search/following, requests public scope, and changes mute only on a deliberate click. Desktop and 390px mobile screenshots inspected. The mobile capture waits for the existing sidebar resize transition to finish.
- Backend: **69 passing existing tests** across identity search, following routes, identity privacy, feed authors, neighborhood meter, post visibility, and home/place posting contracts. No backend production logic or database policy was changed.
- iOS: **27 passing unit tests** covering Neighborhood, universal search, Following projections and feed behavior, including credential-based Beacon badges. **2 passing actual app journeys** on iPhone 17 / iOS 26.5: address-free discovery into an explicit Follow decision, and access to Following during a meter outage. HTTP responses and credentials are isolated fixtures.
- Android: **19 passing unit tests**, **1 reviewed and verified Paparazzi snapshot**, and **1 passing emulator interaction test**. The latter exercises all three social actions in all six meter states on API 34. Both native app builds succeed.
- Native lint: changed Kotlin files pass ktlint; changed Swift files pass SwiftLint with one existing trailing-closure warning in HubTabRoot.
- Web ESLint: no errors in changed source files; three existing warnings in the feed page. The web type gate still reports the same **six pre-existing signatures** in Nearby map exports, dev Place fixtures, and a Place-group test. No baseline was relaxed.

No deployment, live account creation, public follow/post, third-party message, or production-data mutation occurred. Remaining release checks include actual cohort flags, restricted/blocked profile visibility, a creator's published update reaching a follower, notification delivery/preferences, authenticated native service integration, and the remaining audit gates. Local fixtures do not certify these live behaviors.
