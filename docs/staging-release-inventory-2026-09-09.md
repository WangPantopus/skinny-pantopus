# Staging release inventory — September 9, 2026

This is a read-only checkpoint for hosted adoption planning, not an adoption or
production release. The primary feature work remains the isolated PaymentSheet
milestone. Private inventories and all reference-row details stay outside Git.

## Evidence boundary

At 01:32 UTC September 10 (September 9 Pacific), the existing Free staging
project `ptudkfqdhqpkbkzqlabu` was queried using the committed catalog, reference
and managed-surface inventory scripts. TLS verification remained enabled. No
production query, schema write, ledger update or configuration change ran.

The scripts came from source `8f7a6121a0d608f994854676bcafcec8ae181e1a`, whose
runtime schema is the PR #29 stream. The local comparison target was the existing
disposable `mail_confirmation_contract` replay, including both checked modern
mail migrations. This is an initial comparison, not a fresh replay of a final
release candidate that also includes the pending payment work.

Private artifact fingerprints:

- Application catalog: `a461c66ef7d127ccaadfd3449f32b4a164897ee735382baade72d36855091961`.
- Static reference inventory: `fc392fceeafce3bb0b60b2bbef3c876bf328e1ef0041e6f590c889f62e83d84a`.
- Managed-surface inventory: `f4e429368d8ab017796a3a15cd78447590a99aca960adf32626322f633c91a52`.

## Observed differences

| Surface | Local replay | Hosted staging | Interpretation still required |
| --- | ---: | ---: | --- |
| Application tables | 318 | 317 | `ListingAddressGrant` is absent from staging. |
| Indexes | 1,244 | 1,240 | Includes missing grant-table indexes and an equivalent-looking naming difference; definitions still need review. |
| Routines | 152 | 152 | Equal counts conceal three definition differences and permission differences. |
| Application triggers | 73 | 73 | Share-count trigger names differ; verify equivalent binding/behavior. |
| Policies | 511 | 505 | Includes missing grant policies and Home policy differences. |
| Types / views / sequences | 81 / 12 / 2 | 81 / 12 / 2 | Counts alone do not prove equivalence. |

The exact comparison reports 385 changed paths. These are not 385 separate
application defects: 122 concern physical column order; 165 concern effective
table access; 21 table ACLs, eight RLS settings, five constraints and six column
properties also differ. Three routine definitions differ (`browse_listings_by_distance`,
`get_or_create_direct_chat`, `list_support_trains_nearby`), as do routine grants,
type grants and managed extension presence. Each substantive difference needs a
reviewed equivalence or a tested forward reconciliation; none is silently waived.
Do not rebuild populated tables merely to match physical column order.

Static reference counts match: 3,223 HUD FMR rows, 3,128 radon zones, 18 post TTLs,
24 Home role permissions and 74 address calendar rules. The first four tables'
full fingerprints match. Calendar-rule fingerprints differ only in generated
IDs and timestamps; comparing the complete remaining row values as a multiset
matches exactly. Preserve the existing hosted IDs and any references to them.

The 24 role-permission rows are the existing baseline inventory; they contain
owner, admin, lease-resident and service-provider entries but no ordinary member,
manager or guest policy. Applying the reference baseline alone will therefore
not complete their Home task/calendar/document journeys. Current document
acceptance used explicit fixture grants and does not certify a global member
permission policy. A minimal policy proposal with minor/deny/revocation tests is
still needed before changing those defaults.

Managed inventory contains four Auth/storage triggers, zero storage/Auth policies,
21 routines and one bucket. These counts neither prove an exposure nor certify
Auth configuration: private Home document delivery uses the checked backend path.
Hosted redirect allowlists, real SMTP, OAuth, object-service behavior and external
file bytes remain separate verification work.

## Follow-up definition and data precondition review

The initial catalog was reviewed further without hosted writes. Eight tables have
RLS disabled on staging while canonical replay enables it: AnalyticsEvent,
CountyRadonZone, GigShare, HudFmr, ListingShare, NeighborMessage,
NeighborhoodPreview and PlaceSectionCache. This requires policy/consumer review,
not a blanket grant replacement.

NeighborhoodPreview lacks created_at, updated_at and last_milestone_notified;
its verified_users_count is nullable. UserFeedPreference lacks
show_politics_following, and UserFollow lacks source. UserFollow's missing named
unique constraint has an identical valid unique index; no current application
`ON CONFLICT ON CONSTRAINT` dependency was found. NeighborhoodPreview's geohash
uniqueness and both share-count trigger bindings match despite naming differences.
These naming observations are bounded definition equivalence, not full replay
identity.

The hosted Mail recipient check omits the canonical non-null escrow guard, and
Payment.home_id lacks canonical ON DELETE SET NULL. Hosted Home deletion permits
owner or home.edit, broader than the canonical owner rule. Hosted Home SELECT
adds creator visibility, requiring a narrow first-use/revocation analysis.
Hosted Post public visibility lacks the canonical followers branch.

A read-only aggregate preflight on Free staging found zero invalid recipient/
escrow rows, null neighborhood verified counts, duplicate follow pairs, duplicate
Stripe customer bindings or multiple default saved cards. TLS verification stayed
on. These observations support forward-reconciliation planning; they do not
replace lock-time preconditions or the final candidate inventory. The subsequent
payment migration and pending Home changes must be included in that fresh replay.

The [Home role policy audit](home-role-policy-audit-2026-09-09.md) now records the
proposed default matrix and the authorization prerequisites. The first effective
permission checkpoint is pushed as `2fabe0c94` in draft PR #32, with 4,620 backend
tests, privacy gates, 29 web hook tests and 19 SQL contracts passing. Broader
record/delegation/RLS repairs remain active before any new default grants.

## Next adoption package

1. Replay the final committed release stream into a fresh disposable database.
   Compare every migration version with actual hosted definitions/reference
   effects, recording applied-equivalent, pending and divergent states. Include
   all later migrations, not only the two baseline versions.
2. Review the missing table, permission/RLS and routine differences. Prepare
   additive reconciliation that preserves existing records, IDs, explicit
   overrides and operational flags. Rehearse it on a clone, including partial
   failure and retry, before any hosted application.
3. Propose the minimal ordinary Home role policy and verify explicit denies,
   minors, revoked membership, sensitive files and escalation boundaries.
4. Verify current hosted Auth/storage configuration and implement a scoped
   external-object export/restore rehearsal; database archives do not contain
   the file bytes.
5. Make the exact version/effect manifest and interrupted-ledger recovery
   reviewable. Record only versions whose effect is proved. Never execute the
   baseline DDL against a populated hosted database as an adoption shortcut.

Production adoption and cutover still require the concrete reviewed release and
recovery plan. Source merges and compatible Free staging additions do not grant
production rollout evidence. Smarty activation/retest, OAuth/SMTP availability,
distribution credentials and the final integrated release/pilot remain in the
project handoff.
