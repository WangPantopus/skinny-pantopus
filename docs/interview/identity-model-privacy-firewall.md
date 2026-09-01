# Identity Model, Audience Identity, Privacy Firewall, and Feature Flags

This document is written as an interview-ready explanation of the identity
model in this repository. It assumes I am explaining the system as the engineer
who designed and built it, with emphasis on why the model exists, what privacy
threats it addresses, and which guarantees are enforced in code.

The short version is:

- `User` is the private account anchor.
- `LocalProfile` is the public/local neighborhood identity.
- `PublicPersona`, also called a Beacon, is the creator identity.
- `AudienceIdentity` is the fan identity used when someone joins or follows a
  Beacon.
- `PersonaMembership` is the relationship edge between a fan and a Beacon.
- The identity firewall exists to prevent raw account, local, home, business,
  billing, or contact data from leaking across those contexts.

Relevant implementation anchors:

- `backend/database/migrations/128_identity_firewall_personas.sql`
- `backend/database/migrations/132_collapse_persona_follow_into_membership.sql`
- `backend/database/migrations/135_feature_flag.sql`
- `backend/database/migrations/144_unified_audience_identity.sql`
- `backend/serializers/identitySerializers.js`
- `backend/utils/identityProfiles.js`
- `backend/routes/personas.js`
- `backend/utils/visibilityPolicy.js`
- `backend/services/featureFlagService.js`
- `backend/utils/featureFlags.js`

## 1. The Identity Model

The core design choice is that there is no single "public user profile" for
every context. The same authenticated account can appear differently in local,
creator, audience, and business contexts.

That separation is not just product polish. It is a privacy boundary.

### User

`User` is the private root account. It is the authentication, ownership, trust,
billing, and contact anchor.

The `User` row can contain fields such as:

- `id`
- `username`
- `name`, `first_name`, `last_name`, `legal_name`
- `email`
- `phone`
- address and locality fields
- role/account metadata
- verification and trust metadata

The important architectural rule is that `User` should not be treated as a
renderable public identity. A route can use `User` internally to authenticate,
authorize, join, audit, charge, or enforce abuse controls, but public responses
should not emit raw `User` identity fields unless the surface is explicitly a
private account surface.

Interview framing:

> I treat `User` as the private principal, not as the product-facing profile.
> Every public surface should render a context-specific projection instead of
> returning the account row.

### LocalProfile

`LocalProfile` is the user's local/neighborhood identity.

It has its own:

- handle
- normalized handle
- display name
- avatar
- bio/tagline
- public city/state/neighborhood fields
- resident/home/neighborhood display controls
- profile/search visibility

It is one per user. It answers: "Who am I in the local community?"

This is different from both the private account and the creator identity.
Local identity can contain locality, neighborhood, residence, home affiliation,
or gig/listing context. Those signals are sensitive because they can correlate
an online account to a physical place or real-world community.

Therefore, a local profile can be rendered on local surfaces, but it should not
bleed into Beacon audience surfaces unless the user explicitly opts into a
bridge.

### PublicPersona / Beacon

`PublicPersona` is the creator identity. In product language, this is the
Beacon.

It has its own:

- handle
- normalized handle
- display name
- avatar/banner
- bio
- public links
- category
- audience label/mode
- credential/org status
- follower/member counts
- broadcast status
- searchability

It answers: "Who am I as a creator, organization, or public-facing Beacon?"

The schema enforces a single active public persona per user. That keeps the
active creator identity canonical while still allowing the model to evolve
toward historical or inactive personas.

The major privacy point is that a Beacon is not automatically linked to the
owner's `LocalProfile` or private `User` fields. The owner may choose to bridge
local and persona identity through `IdentityBridgeSetting`, but that bridge is
opt-in.

### IdentityBridgeSetting

`IdentityBridgeSetting` is the opt-in link between local and persona identity.

It includes controls like:

- show the persona on the local profile
- show the local profile on the persona

This table exists because cross-context identity linking is sensitive. A user
may want a Beacon to be public while keeping their local profile private, or may
want a local profile while not advertising their creator identity to neighbors.

The bridge is therefore not inferred from shared ownership. Shared ownership is
an internal fact; public linking is an explicit preference.

### AudienceIdentity

`AudienceIdentity` is the fan-side identity.

It has:

- one row per user
- globally unique handle
- normalized handle
- display name
- avatar
- optional `public_persona_id`
- source/status fields

It answers: "Who do I appear as when I join or follow someone else's Beacon?"

The optional `public_persona_id` is important. If the user owns an active
Beacon and wants their audience identity to be the same as that Beacon, the
audience identity can be persona-bound. Otherwise, the user gets a generated or
user-selected audience handle.

This lets the system support both:

- a normal fan who has no Beacon
- a creator who intentionally appears to other creators as their Beacon

### PersonaMembership

`PersonaMembership` is the relationship edge between a fan and a Beacon.

It connects:

- `persona_id`
- `user_id`
- optional `audience_identity_id`
- tier
- status
- billing/subscription lifecycle fields
- quotas
- notification preferences
- fan handle/display/avatar snapshot fields

The snapshot fields are intentional. The canonical identity is
`AudienceIdentity`, but existing API contracts and historical membership rows
need a stable fan-facing shape. Snapshotting also protects creator views from
needing to join directly into `User` or `LocalProfile`.

The membership row is internal. The creator-facing serializer exposes only the
privacy-safe subset.

### BusinessSeat and SeatBinding

Business identity is handled separately through `BusinessSeat` and
`SeatBinding`.

`BusinessSeat` is the public/operational business role. `SeatBinding` maps a
real `User` account to a seat. That binding is effectively a vault. It lets the
backend verify that the authenticated user may act through a seat, but public
business surfaces should render the seat, not the private account behind it.

That mirrors the same design principle:

> Public context gets a context identity. The platform keeps the private account
> link internal.

## 2. Why AudienceIdentity Exists Instead of Extending User or PublicPersona

`AudienceIdentity` exists because audience identity is a separate concept from
both account identity and creator identity.

### Why not extend User?

Putting fan identity fields directly on `User` would make the private account
row do too much.

The risks would be:

- raw account fields and fan-visible fields would sit on the same object
- route authors might accidentally return `User` as a public profile
- privacy review would become harder because the account row would contain both
  safe and unsafe fields
- fan identity would become implicitly tied to account username/name
- a private account update could accidentally change public fan presentation

The repository deliberately treats `User` as the thing we authenticate and
authorize, not the thing we render on creator/audience surfaces.

### Why not extend PublicPersona?

`PublicPersona` is also the wrong place because many fans do not have Beacons.

If audience identity lived inside `PublicPersona`, then every fan would either:

- need a fake persona just to follow someone, or
- be forced to expose no audience identity until they become a creator

That would conflate "I publish as this Beacon" with "I join your Beacon as this
fan."

Those are different product concepts and different privacy contexts.

### What AudienceIdentity gives us

`AudienceIdentity` gives us a purpose-built layer with these properties:

- one canonical fan identity per user
- globally unique handle namespace
- optional binding to an active Beacon
- owner-controlled display name/avatar
- generated defaults that are not derived from PII
- locking/editability rules once the identity is used
- safe snapshots into `PersonaMembership`
- cross-table collision checks with `PublicPersona`

It also makes privacy review cleaner. If a creator-facing endpoint needs fan
identity, it should use membership fan snapshots or `AudienceIdentity`, not
`User`.

Interview framing:

> I split audience identity out because it is a public projection of the user,
> but not the account and not the creator persona. That gives the system a clean
> privacy boundary and lets us enforce fan-facing invariants in one place.

## 3. fan_ Handles: Collision Avoidance and Privacy

The `fan_...` handles serve two goals:

1. Give every fan a usable audience handle.
2. Avoid deriving that handle from private or local identity fields.

The system does not rely on one mechanism alone. It uses generated handles,
normalization, application-level availability checks, database uniqueness, and
migration-time validation.

### Runtime generation

At runtime, generated fan handles are random:

```text
fan_<8 hex chars>
```

The code path checks whether the normalized handle is available in both:

- `AudienceIdentity`
- `PublicPersona`

It retries random candidates and then falls back to longer UUID/suffix-based
forms if necessary.

The important detail is that randomness alone is not the correctness guarantee.
The correctness guarantee is:

```text
candidate generation + availability check + database unique constraints
```

If two requests race, the database uniqueness constraint is the final arbiter.

### Legacy migration handles

For legacy `PersonaFollow` rows, the migration used deterministic `fan_...`
handles derived from opaque follow-row IDs.

That made the migration repeatable and avoided deriving fan handles from:

- `User.username`
- `User.name`
- `LocalProfile.handle`
- email
- phone
- address

The deterministic handles are not assumed to be mathematically collision-free
when shortened. The collision defense is the unique index. If a collision
occurs, the migration or write path must resolve it rather than silently
creating ambiguous fan identity.

### AudienceIdentity backfill

The unified `AudienceIdentity` migration backfills existing users.

For users with active Beacons, the audience identity can inherit the Beacon
handle because that is already a public creator handle owned by the same user.

For other users, the migration uses opaque deterministic values rather than
PII-derived names. This is useful for idempotent migration/backfill behavior.

That distinction matters:

- It avoids leaking personal data.
- It does not claim to provide cryptographic anonymity if someone already has
  privileged access to internal IDs.
- The firewall's job is to prevent those internal IDs and raw account fields
  from being exposed in the first place.

### Username opt-in

The system allows a fan to choose a handle that matches their Pantopus username,
but only with explicit acknowledgement.

That is a deliberate consent checkpoint. A username can be identifying,
especially if it is reused across contexts. The server therefore requires the
fan to acknowledge that choice instead of silently defaulting to it.

### What privacy the handles do and do not provide

The `fan_...` scheme protects against accidental PII leakage. It prevents the
default audience handle from encoding a user's legal name, email, local handle,
phone number, address, or neighborhood.

It is not a promise of perfect unlinkability across all Beacon memberships.
`AudienceIdentity` is intentionally global per user, so the same audience handle
can be a stable fan identity across Beacons. The privacy guarantee is that a
creator sees the fan identity, not the private `User` or local/home/business
identity behind it.

If the product ever requires per-Beacon unlinkability, the model would need a
separate per-membership alias layer rather than one global audience identity.

## 4. What the Identity Firewall Protects

The identity firewall protects against cross-context leakage and correlation.

It is not just about hiding email addresses. It is about preventing one context
from revealing facts that belong to another context.

### Protected private account data

The firewall protects raw `User` fields such as:

- email
- phone
- legal name
- first/middle/last name
- address
- city/state/zip when sourced from private account data
- private account role/trust fields unless explicitly public

These fields can be used to identify, contact, locate, or correlate a person.

### Protected local data

The firewall protects local and home/community context such as:

- `LocalProfile`
- home affiliation
- neighborhood
- local verification
- resident/home badges unless explicitly public
- gig and listing context
- private location metadata

This matters because local identity can reveal physical-world proximity.

### Protected Beacon owner data

A fan viewing a Beacon should see the Beacon, not the owner's private account.

The firewall prevents leakage of:

- owner `User.name`
- owner email/phone
- owner address/locality
- owner `LocalProfile`
- owner home/business/private affiliations

The Beacon can optionally bridge to local identity, but shared ownership alone
does not create a public link.

### Protected fan data

A Beacon creator viewing their audience should not get the fan's private
account or local identity.

The creator sees fan handle/display/avatar and membership business facts. They
do not see:

- `user_id`
- username
- email
- phone
- legal or real name
- address
- city/state/zip
- home or local profile
- business identity
- Stripe customer/subscription IDs
- exact join timestamp
- personal relationship or neighbor signals

### Protected business identity

Business seats hide the private user behind an operational seat.

The public shape is:

- business
- seat
- role
- display name/avatar for the seat

The private binding from seat to user remains internal.

### Protected metadata and timing

The firewall also reduces metadata leaks.

For example, creator audience views expose `joinedMonth` rather than exact
`joined_at`. Exact timestamps can correlate a fan's membership action with
personal-side activity.

The same principle applies to block reasons, Stripe identifiers, notification
templates, and nested route metadata. Seemingly harmless fields can become
correlation handles.

## 5. Feature Flags: Env Flags and DB Rows

The repository uses two layers of feature flags because they solve different
operational problems.

### Environment feature flags

Environment flags are coarse-grained kill switches.

Examples:

- `IDENTITY_FIREWALL_ENABLED`
- `PERSONA_ENABLED`
- `PERSONA_BROADCAST_ENABLED`

They control whether entire route families are mounted or allowed. They are
evaluated at the process/application level and are useful for deploy safety.

If an env flag disables a parent feature, the DB cannot override it because the
route may not exist or the middleware will return 404.

### DB-backed FeatureFlag rows

DB-backed flags are rollout controls.

The `FeatureFlag` table supports:

- `enabled_globally`
- `enabled_for_internal_team`
- `beta_user_ids`
- description/audit metadata

The feature flag service treats these as OR conditions:

```text
enabled_globally
OR internal team access
OR explicit beta user id
```

Unknown DB flags are off.

This lets the team roll out a feature to staff, beta users, or everyone without
redeploying the backend.

### Which flag wins?

The effective policy is:

```text
most restrictive gate wins
```

More concretely:

| Env parent flag | DB flag | Result |
| --- | --- | --- |
| off | on | off |
| off | off | off |
| on | off | off for DB-gated routes |
| on | beta/internal | on only for allowed users |
| on | globally on | on |

There is no single "env beats DB" or "DB beats env" rule for all cases because
they gate different layers. Env flags decide whether a feature family exists.
DB flags decide whether a mounted beta surface is available to a user.

So the correct access equation is:

```text
feature family is enabled by env
AND route is mounted
AND route-specific DB flag allows the user when required
```

Some persona routes are only env-gated because they are established public
surfaces. Newer audience-profile, membership, payment, DM, tier, and block
surfaces are DB-gated with `audience_profile`.

The route response is usually 404 rather than 403. That is intentional: a user
without the flag should not learn much about feature existence or rollout state.

## 6. What a Beacon Creator Can See About a Fan

The creator's view of a fan is intentionally narrow.

The privacy-correct serializer is `serializeFanForCreator` in
`backend/serializers/identitySerializers.js`.

### Before membership

Before a membership exists, the creator should see nothing about the fan.

Examples:

- A fan opening a Beacon page does not create creator-visible identity.
- A fan requesting a handle suggestion does not expose that suggestion to the
  creator.
- A paid checkout attempt does not create a creator-visible membership until
  the payment/subscription flow succeeds.
- If the fan is blocked, the fan receives vague copy and the creator does not
  get extra identifying data.

The platform may have internal audit/payment/security records, but those are
not creator-facing audience data.

### During visible membership states

The owner audience route includes memberships in visible states such as:

- `pending`
- `active`
- `muted`
- `past_due`
- `paused`
- `canceled_pending`

For those rows, the creator can see:

- membership ID
- fan handle
- fan display name
- fan avatar URL
- tier rank/name
- status
- joined month
- tenure in months
- cancel-at-period-end flag
- current period end
- quota remaining
- verified-local boolean only when the persona opted into verified-local
  discovery

The creator cannot see:

- fan `user_id`
- fan username
- email
- phone
- legal name
- first/last name
- address
- city/state/zip
- neighborhood
- home ID
- local profile
- business identity
- personal relationship/neighbor/household signals
- Stripe customer ID
- Stripe subscription ID
- exact join timestamp

### After cancellation, expiration, or block

Terminal or revoked states should not become a backdoor to more data.

If a membership is removed, expired, blocked, or chargeback-blocked, the system
may retain enough internal state for audit, refunds, abuse handling, or vague
fan-facing status. The creator-facing block list can show the fan handle/display
associated with the block so the creator can manage the block, but it still does
not expose the underlying `blocked_user_id`, private user fields, block source,
or sensitive reason.

## 7. Scoped Blocks Across Identity Contexts

There are three related concepts:

- `UserProfileBlock`
- legacy/general `UserBlock`
- `PersonaBlock`

They operate at different layers.

### UserProfileBlock

`UserProfileBlock` is the scoped identity-firewall block.

It supports scopes:

- `full`
- `search_only`
- `business_context`

The visibility helper checks blocks in both directions. A `full` block applies
broadly. A `search_only` block prevents discovery/search/profile lookup without
necessarily representing a full social block. `business_context` is represented
in the model and helper so business-context restrictions can be enforced by
business surfaces.

Local profile search and profile resolution use scoped block checks. Persona
discovery also checks scoped blocks against the persona owner.

### UserBlock

`UserBlock` is the older broad personal block.

In the firewall model, a personal-side block of user B by user A cascades
one-way into `PersonaBlock` entries for A's personas. That means if I block
someone personally, I also do not want them engaging with my Beacons.

The reverse is deliberately not true. Blocking a fan from one Beacon should not
necessarily create a full personal block or reveal to the creator who that fan
is personally.

Unblocking personally also does not automatically unblock persona-level blocks.
That avoids accidentally reopening creator/audience contexts after an abuse
decision.

### PersonaBlock

`PersonaBlock` is Beacon-scoped.

It blocks a user from a specific persona/Beacon. The creator operates on
membership IDs and fan handles, not raw `user_id`.

This supports creator moderation without breaking the identity firewall.

### AudienceIdentity and blocks

`AudienceIdentity` itself is not the block target exposed to creators.

Internally, the platform can resolve a membership to the underlying user to
enforce blocks. Externally, the creator sees only the fan-facing membership
shape.

That is a key part of the firewall:

```text
creator action -> membership/fan handle
platform enforcement -> internal user/persona relationship
creator response -> fan-safe shape
```

### Business context

Business identity uses `BusinessSeat` and `SeatBinding` as the primary privacy
boundary. The `business_context` block scope exists in the scoped-block model
and helper. Where a business surface calls the helper, it can enforce that
scope. The broader invariant for business privacy is that routes render seats
and businesses, not the private user binding behind a seat.

## 8. Preventing Raw User Leaks Through Legacy Routes

The repository has a layered defense because legacy route shapes are risky.

### Canonical serializers

The canonical serialization layer is
`backend/serializers/identitySerializers.js`.

It provides context-specific serializers such as:

- local profile for viewer
- audience/persona profile for viewer
- fan for creator
- membership for fan
- business seat for viewer
- post author for viewer

The creator-facing fan serializer has an explicit forbidden-field contract. If
a key is not returned by that serializer, the creator does not get that data
about a fan.

### Safe selects

The code avoids broad nested `User` selects on public routes.

Where legacy compatibility needs user-like data, the repository uses safe
selects that exclude private fields and then passes the result through a
serializer.

This prevents accidental route responses like:

```json
{
  "creator": {
    "id": "...",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "address": "..."
  }
}
```

### Route-level scrubbing

Some legacy routes still deal with older shapes. Those routes strip:

- raw identity fields
- private location fields
- home fields
- sensitive nested metadata
- unsafe creator/author aliases

This is especially important for posts, comments, gigs, listings, chats,
reactions, local profile activity, and persona posts.

### CI privacy gates

The repository includes scripts that fail CI when dangerous patterns are
introduced.

Examples include gates for:

- raw personal selects from `User`
- reintroducing unsafe creator selects
- legacy identity aliases
- new nested `User` selects in sensitive files
- audience-side joins to `LocalProfile`

These scripts do not replace code review, but they catch the most common ways a
route author can accidentally bypass the firewall.

### RLS and service-role reality

The database has row-level-security policies for several identity tables, but
the backend often uses a service-role client. That means RLS is not the only
defense.

The effective privacy system is:

```text
schema constraints
+ RLS where applicable
+ route authorization
+ canonical serializers
+ CI gates
+ tests with hostile fixtures
```

## 9. Privacy Invariants Enforced by Tests

The tests enforce a large part of the privacy contract.

### Serializer forbidden-key tests

The serializer tests use fixtures that deliberately contain hostile private
values: names, emails, phone numbers, addresses, Stripe IDs, local profile data,
home IDs, and nested raw user records.

They assert that public serializers do not emit those keys or values.

Covered surfaces include:

- audience profile
- local profile
- business seat
- user-as-local fallback
- post author
- creator viewing fan
- fan viewing membership

### Creator audience route tests

The owner audience route is tested to ensure it returns fan handles and
membership-safe fields, not raw usernames, user IDs, emails, or local profile
data.

This is one of the most important privacy tests because the route internally
needs `user_id` to perform joins and quota lookups. The test ensures that
internal necessity does not become external leakage.

### Handshake tests

The audience handshake tests enforce:

- fan handle uniqueness
- cross-namespace collision handling
- random suggestion behavior
- existing identity edit/lock behavior
- explicit acknowledgement when using `User.username`
- vague error behavior when blocked
- DB feature flag gating

### Legacy route response tests

The raw user identity response tests exercise older routes and ensure they emit
typed public identity shapes rather than raw `User` fields.

This is important because legacy code is usually where privacy regressions
reappear. The tests are designed to catch "it worked before, so I joined User
again" mistakes.

### Persona/privacy firewall tests

The identity firewall privacy tests cover:

- persona feed/post responses do not include local/home/private data
- tier-gated posts are hidden when appropriate
- pending followers cannot preview private media
- broadcasts do not leak owner identity
- notifications do not leak email/name
- persona blocks deny engagement

### Block propagation tests

The integration tests cover the one-way block cascade:

```text
personal block -> persona block
persona block -/-> personal block
personal unblock -/-> automatic persona unblock
```

They also verify notification suppression and vague fan-facing copy.

### Notification context tests

Notification template tests prevent cross-context placeholders.

For example:

- a personal notification should not reference persona-only fields
- an audience notification should not reference local-profile fields
- platform notifications should not accidentally render actor identity fields

This matters because notification templates are a common source of privacy
leaks: they often join many objects and are easy to treat as "just text."

### Feature flag tests

Feature flag tests verify:

- env defaults
- disabled env values
- parent flag dependency behavior
- unknown DB flags are off
- global/internal/beta DB access
- middleware returns 404 when disabled
- admin responses do not leak beta user IDs unnecessarily

## 10. Privacy Invariants Still Enforced by Convention

Not every invariant can be fully enforced by schema or tests.

The main convention-based requirements are:

- New public routes must use the canonical serializers.
- New data fetches must avoid broad `User` joins.
- If a route needs internal `user_id`, it must not return that ID unless the
  surface explicitly allows it.
- Service-role code must preserve route-level privacy checks because it can
  bypass RLS.
- New notification templates must stay inside their context.
- New business surfaces must render seats, not seat bindings.
- New Beacon creator tools must operate on membership/fan handles, not raw
  users.
- Audience identity snapshot writes should go through the helper/sync paths.

There are also some legacy allowlists. The CI gates intentionally lock those
down so new files cannot copy unsafe patterns, but the allowlisted routes still
need local serialization and continued cleanup.

For `business_context` scoped blocks specifically, the model and helper support
the scope, but broad enforcement depends on business surfaces calling the
helper. The stronger existing business privacy guarantee comes from the
BusinessSeat/SeatBinding split.

Interview framing:

> The privacy model is not one magic abstraction. It is schema design,
> serializer discipline, route gates, database constraints, test fixtures that
> try to leak hostile data, and CI checks that prevent common regressions.

## 11. Design Tradeoffs

### Why not one profile table with a type column?

A single polymorphic profile table would look simpler at first, but it would
hide important differences:

- local profiles have locality and residence concerns
- personas have audience, broadcast, and creator concerns
- audience identities have fan alias and membership concerns
- business seats have operational role concerns

Those contexts have different privacy rules. Separate tables make the rules
visible and enforceable.

### Why snapshot fan fields into PersonaMembership?

Snapshotting creates duplication, but it makes creator-facing reads safer and
more stable.

The membership row can render the fan-facing identity without joining into
private account or local profile tables. It also preserves what the creator saw
at the time of membership events, which is useful for audit and moderation.

The cost is consistency: writers must sync snapshots when audience identity
changes. That is why the helper layer exists.

### Why return 404 for disabled flags?

Feature-gated routes generally return 404 because feature rollout state should
not be an information leak. A user without access should not get a clear signal
that a beta route exists, nor should blocked/disabled states reveal more than
needed.

### Why month-level join dates?

Exact timestamps can be used for correlation. If a creator sees that
`fan_abc` joined at exactly 10:03:22 and also sees a local-side action at the
same time, that can become an identity leak.

Month-level tenure gives creators useful audience information without exposing
precise timing.

### Why one-way block propagation?

Personal blocks are stronger than persona blocks. If I block someone personally,
it is reasonable to prevent that person from engaging with my Beacons too.

But if I block someone from a Beacon, I may not want to reveal or create a
full personal relationship. Persona-level moderation should stay scoped to the
Beacon.

That is why the cascade is one-way.

## 12. Concise Interview Answer

If I had to answer this in a few minutes:

> The identity model is intentionally split by context. `User` is the private
> account and trust anchor. `LocalProfile` is the neighborhood identity.
> `PublicPersona` or Beacon is the creator identity. `AudienceIdentity` is the
> fan identity used when joining someone else's Beacon. `PersonaMembership` is
> the edge between a fan and a Beacon and stores tier/status plus a safe snapshot
> of the fan identity.
>
> I introduced `AudienceIdentity` because fan identity is neither the private
> account nor the creator persona. Putting it on `User` would make raw account
> leaks more likely. Putting it on `PublicPersona` would force every fan to be
> modeled as a creator. A separate audience identity gives us a clean namespace,
> clear edit/lock behavior, and privacy-safe membership snapshots.
>
> Generated `fan_...` handles are not derived from names, emails, phone numbers,
> local handles, or addresses. Runtime generation checks availability and relies
> on database uniqueness. Migration handles are deterministic for idempotence
> but based on opaque IDs, with constraints catching collisions. The goal is to
> avoid PII leakage, not to claim perfect anonymity against privileged internal
> data.
>
> The identity firewall protects against cross-context correlation. A Beacon
> creator sees fan handle, display, avatar, tier, status, month-level tenure,
> and quota information. They do not see user ID, username, email, phone, real
> name, address, local profile, home, business identity, Stripe IDs, exact join
> time, or block reasons.
>
> Env feature flags are process-level kill switches. DB feature flags are
> per-user rollout controls. Effective access is the intersection: the env
> feature family must be enabled, the route must be mounted, and the DB flag
> must allow the user for DB-gated surfaces.
>
> Scoped blocks are enforced by context. `UserProfileBlock` handles full,
> search-only, and business-context restrictions. Personal `UserBlock` cascades
> one way into persona blocks. `PersonaBlock` lets a creator moderate a fan from
> a Beacon without exposing the underlying user identity.
>
> The strongest guarantees are enforced by serializers, database constraints,
> route gates, CI privacy checks, and tests with hostile fixtures. The remaining
> risk is new code bypassing those paths, so the engineering rule is simple:
> never render raw `User` on public surfaces; always render the context identity.
