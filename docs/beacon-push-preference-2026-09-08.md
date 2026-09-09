# Beacon push preference — September 8, 2026

Beacon device alerts now have a separate default-enabled preference in source.
Turning it off keeps the in-app audience row, live event, badge update and exact
post destination. Restore affects future publications only. Global push off still
wins; per-Beacon mute/off continues to suppress fanout before creating a row.

## Implementation

Migration `20260909000622_beacon_push_preference.sql` adds non-null boolean
`UserNotificationPreferences.beacon_push_enabled` with default true. Existing
rows gain that default while retaining previous global/category settings. The
authenticated Hub API supplies the default, accepts partial updates and derives
ownership from the session.

Only persona_broadcast transport consults this field, in single and bulk
delivery, after the in-app row exists. A failed preference read suppresses Beacon
device transport because it cannot establish that a saved opt-out is absent.
Missing rows remain enabled; other types retain their existing behavior.

Web/iOS/Android settings expose “Beacon Push Notifications” and explain that
updates remain in the app. Web now merges every key in the debounce window.
All clients serialize saves and ignore older responses when a newer edit is
pending. Rapid changes cannot discard an opt-out or restore an older value.
A failed final save reloads server truth.

## Verification

| Check | Result |
| --- | --- |
| Backend | 53 targeted preference/registration/firewall tests pass; all privacy gates pass |
| Web | Four tests pass: saved off/restore, merged quick changes, overlapping saves and failed-save rollback; TypeScript passes; ESLint has zero errors and one existing explicit-any warning |
| iOS | 16 settings tests pass on iPhone 17 simulator, including defaults, exact partial payload, merged edits and a delayed in-flight save; changed files pass strict SwiftLint and SwiftFormat |
| Android | 24 settings/serialization tests pass, including false/restore and serialized saves; ktlint and Detekt pass |
| SQL upgrade | A pre-migration synthetic row gains Beacon=true while global/Gig opt-outs remain false; fixture removed |
| Complete schema | Eight pgTAP contracts and six real SDK/PostgREST/Following tests pass, including preference defaults/false/restore, null rejection and preservation of unrelated settings |
| Migration tooling | 19 tests pass; the history guard now compares exact Git blob identities, avoiding Node's stdout buffer limit for baselines larger than 1 MiB while still rejecting modified applied SQL |

Canonical predecessor f9362cbca55a25ea51f9a1ebbcb60b72fb7fad22 has a passing
database job in [CI run 34293457260](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34293457260).
The preference changes require their own CI. Private logs/credentials remain
outside Git. No new preference-test publication has been sent to a device yet.

## Staging plan and remaining acceptance

Read-only staging inspection confirms the new column and restrictive Post policy
are absent, the three reviewed maintenance RPCs exist, and Post RLS is enabled.
The audience flag is globally/internal disabled with zero beta accounts; both
staging release switches remain false. No hosted schema or ledger changed.

Prepare an atomic staging rehearsal for the new column, restrictive
post_persona_service_only policy and service-only grants for
auto_archive_expired_posts, get_seeder_tapering_metrics and record_post_unique_view.
Run actual-role contracts, then apply those compatible changes before the new
API/worker image. Retain previous containers/image for app rollback; the additive
schema works with the old runtime.

This forward preparation does not adopt a hosted canonical ledger or enable
automation. Never run fresh baseline DDL on a populated project. Complete separate
per-environment ledger adoption before enabling automatic migrations; production
remains unchanged.

Next verify hosted raw-role denial, API off/restore, retained audience rows,
exact permitted return and no replay. Use fresh synthetic Beacon fixtures and
verify the audience before device publications. Reconfirm iPhone availability
and restore test preferences afterward. Physical Android remains unavailable.
Previously confirmed background/foreground/closed-app, block, mute and global
push cases remain in the [full journey report](beacon-full-journey-2026-09-08.md).
