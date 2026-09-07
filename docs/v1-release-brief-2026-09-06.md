# Pantopus v1 release brief

Date: September 6, 2026 (America/Los_Angeles). Repository baseline: `6a936e4b6`.

Status: recommended working release definition, prepared before implementation. No application code or production configuration changed during this audit. This brief scopes a release; it does not certify current production readiness.

## 1. The product we are finishing

**Pantopus helps people manage their home, participate in life nearby, and build public relationships while keeping their private and public identities under their control.**

Home, Pulse, and Beacon are all v1 pillars. Private usefulness must work at zero neighborhood density. Social participation must remain accessible without requiring users to complete unrelated household setup. Beacon following must not require a home address.

V1 is finished when a new user can complete each applicable journey below without founder assistance, understand who can see their information, and return to an accurate, durable state. Product-market fit and a nationwide liquid marketplace are separate milestones.

## 2. Three release journeys

| Journey | Entry and first result | Return experience | Boundaries |
|---|---|---|---|
| H — Home | Preview an address; create an account without losing it; explicitly save a private home context; set a household-confirmed pickup schedule and see the correct next occurrence. | Reopen the same home, inspect the source and schedule, edit or remove it, and receive any reminder actually promised and enabled. | No neighbor recruitment, public profile, ownership claim, or verification document required just to organize private information. Saving an address never grants access to somebody else's household. |
| P — Pulse | Open an authorized shared post or browse a chosen area; understand scope and author identity; sign in and return; make an eligible post or comment. | Receive a reply/update, reopen the exact conversation, and retain the selected scope. | Local posting eligibility still applies. A small population must not block the whole social product. Restricted content remains restricted. |
| B — Beacon | Open a public Beacon; read public content; sign in and return; follow for free. A creator can separately create a public profile and publish an update. | Find followed Beacons, see a real update, manage notifications, unfollow, and retrieve creator content. | Following does not require residency, a local profile, or creating a Beacon. Private/local identity links require explicit consent. |

The pickup schedule is a deliberately small existing utility selected for validation, not a claim that it alone proves lasting demand. Do not assume every home uses curbside collection. Let users skip it; pilot this journey with households for which it is relevant. If that cohort does not value it, reassess the first utility before expanding acquisition.

Calendar release requirements include confirming recycling frequency and its next actual occurrence; weekday alone is insufficient to establish a biweekly schedule. Show household input as household input, not an official municipal schedule. If notification delivery has not been verified, promise a saved calendar entry rather than a delivered reminder.

## 3. Navigation and entry contract

Recommended v1 destinations: **Home · Pulse · Beacons · Inbox**.

- **Home:** absorb the useful Today view and preserve address intelligence and household tools. Public data remains sourced, scoped, and honest about missing coverage.
- **Pulse:** nearby and connection-based conversation, discovery, existing post/comment flows, and entry to relevant local activities. Reuse the existing feed implementation.
- **Beacons:** following/discovery first for followers; My Beacon and publishing tools for creators. Reuse the current persona feed and profile services instead of inventing another social backend.
- **Inbox:** clear separation between personal conversations, audience correspondence, and digital mail; preserve existing destinations and audience permissions.

This is a proposed navigation change, not a description of today's deployed app. Current code uses Place/Today/Nearby/Mail, and web adds some flag-dependent creator entries. Keep old URLs/deep links working while mapping them to their intended content. Use “Beacon” consistently in consumer labels; internal persona identifiers need not be renamed.

| Arrival | Destination after signup/login |
|---|---|
| Address preview | That same saved home context and the action the user started |
| Shared Pulse post | That exact post, subject to authorization |
| Shared Beacon or follow invitation | That Beacon and the explicit follow decision |
| “Follow someone or browse” | Beacon discovery or social browsing, not an empty Home |
| Returning user without a pending destination | Their last valid primary destination, with a clear default |

Preserve intent through login-to-signup switching, email verification, OAuth, session refresh, app installation handoff where supported, and retry. Validate redirect targets; do not introduce open redirects. Preserve a pending follow/post action without silently performing it after authentication.

## 4. Included and deferred work

### Required for v1

- The three complete journeys, including a readable empty state, visible failure state, safe retry, and returning-user behavior.
- Minimal account creation and progressive home setup. Detailed property fields and sensitive access information appear only in the relevant feature.
- Free Beacon profile/follow/publish/read behavior and a follower-oriented destination.
- Pulse author/audience clarity, posting eligibility, comments, sharing of authorized content, blocking/reporting, and content deletion behavior.
- Explicit address use, actual permission enforcement, and a privacy preview consistent with every relevant response and notification surface.
- Real device checks for core notifications and deep links on every released platform.
- A release manifest tying frontend builds, backend revision, migrations, and feature flags together; a rollback path.

### Existing adjacent features

Tasks, marketplace, payments, mailbox, household sharing, and other shipped capabilities need an inventory of what remains reachable. A reachable action must work accurately and safely even if it is not a featured v1 journey. Preserve existing user records, paid entitlements, balances, and access during any navigation or feature-flag changes.

For unfinished adjacent surfaces, finish the smallest necessary operation or explicitly remove the misleading entry point from the release candidate. Hiding a menu alone is not sufficient if deep links or APIs still create unsafe behavior. Do not remove customer commitments as an incidental “scope reduction.”

### Not required to finish this v1

- General photo/voice-to-action AI, autonomous repair handling, external-helper portals, and a comprehensive home inventory.
- New paid Beacon tiers, advanced creator monetization, or a universal residency credential.
- New national municipal integrations, nationwide marketplace liquidity, shared purchasing, or home-handover expansion.
- A full visual redesign of every existing screen or renaming backend entities.

These remain candidates for later work. Reintroduce one only when evidence shows an essential journey cannot meet its promise without it.

## 5. Trust contract

1. A saved place, a household membership, a residency attestation, and property ownership are different facts. Never convert one to another implicitly to fix onboarding.
2. Adding private home information does not automatically publish a resident profile or link a Beacon.
3. Show the acting identity and audience before a post or share. Preserve the boundary in metadata, media, search results, notifications, and direct URLs.
4. Verification describes the evidence checked. Avoid “unforgeable” and claims that verification guarantees character or competence.
5. Every privacy control must affect the promised behavior. A stored setting or visual mirror alone is insufficient proof.
6. A pending, rejected, expired, or withdrawn claim must not gain insider access merely because its row exists. Any deliberate exception needs a documented, narrowly scoped entitlement.
7. Show save/pending/sent/completed states accurately. A recorded click must not be presented as a payment, physical mail action, reminder delivery, or completed task.

## 6. Release acceptance and pilot

Release candidate requirements:

- No unresolved confirmed critical/high privacy, authorization, data-loss, or financial-integrity defects in reachable release functionality. The identified access concerns must be adjudicated before release.
- All H/P/B acceptance scenarios in the companion audit pass on web, iOS, and Android versions actually included in the release. A platform not exercised is “unverified,” never assumed to pass from shared API tests.
- Cross-account data isolation passes for a private-home user, an unrelated household, a creator, and a follower with no address.
- Pending work survives recoverable network failure and authentication transitions without duplication or unauthorized auto-action.
- Users can decline optional permissions and still complete the appropriate journey; permission-dependent behavior explains its limitation.
- Initial loading and failures are visible, primary actions are keyboard/screen-reader accessible, and narrow-screen content remains usable.
- Record exact build/revision, flag cohort, migration state, scenario, result, and evidence for release sign-off.

Run a small pilot of roughly 30 participants with at least five exercising each journey and real creator/follower pairs. Include renters, address-free followers, sparse areas, and returning sessions. Observe people using their own tasks and relationships with consent. Test fixtures must never become apparent production neighbors.

Measure distinct outcomes:

| Pillar | Activation | Return signal |
|---|---|---|
| Home | Private home saved and correct schedule saved | Revisit/edit/act on it; track notification delivery separately |
| Pulse | Eligible contribution or meaningful participation | A real response and return to that conversation |
| Beacon | Explicit follow; separately, creator's first published update | Follower views a later update or returns to a followed Beacon |

Treat prior percentage targets as experiment hypotheses, not release evidence or industry benchmarks. A small pilot can reveal severe usability problems; it cannot establish broad retention or product-market fit. Event analytics should avoid address strings, document contents, message text, and unnecessary identity linkage.

## 7. First implementation package

**Preserve the user's reason for arriving through authentication.**

This covers all three pillars: preserve preview context, preserve a post/Beacon destination when switching between login and signup, route social browsing to social content, and expose a retry rather than consuming saved intent before success. Begin with web reproductions and the smallest safe shared contract; then check corresponding native behavior.

Before changing saved-place or household membership behavior, resolve the privacy/access entitlement questions in B01. The implementation must not “fix” an empty home screen by attaching someone to an existing household merely because they typed its address.

Sequence after the first package: minimal home setup and a verified calendar outcome; socially accessible navigation and consistent Beacon release flags; adjacent-action truthfulness; staging/device journey execution; pilot and release manifest. Use the [audit and blocker list](v1-journey-audit-2026-09-06.md) for concrete acceptance criteria.
