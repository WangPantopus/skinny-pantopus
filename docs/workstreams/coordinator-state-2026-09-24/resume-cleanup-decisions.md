# Scoped synthetic cleanup decisions — 2026-09-24T07:47:52Z

These decisions apply only to retained isolated verification fixtures, not production retention or money policy. No deletion has been executed by the coordinator.

## Stream3

Reviewed read-only exact inventory `notification-cleanup-dryrun-preliminary-safe.json` (SHA256 `294ccb8bbc73c10a681b1b2eafcbed671cd6c4c05a88fdd6dc200345ce8b45e8`) and `cleanup-closure-proposal-safe.json`:74 incoming foreign keys,17 notices to owned actors, no incoming IDs outside proposed scope. Bookings78d45969-23b9-404b-ad95-c460fe1b068c,39cc84f6-39bc-4d5b-90e0-1537984ba508 and1a9da746-ce69-4730-9dfb-c751dffbc683 remain confirmed with null payment IDs, and both exact EventTypes have price_cents0. Scheduled times remain unchanged.

After remaining iOS acceptance, approve exact listed synthetic root/child SQL deletion in one asserted transaction, including the three zero-cost confirmed bookings; no cancellation/provider calls or retiming. Preserve all six IdentityAuditLog IDs and every column except persona_id, which may becomeNULL only through the existing ON DELETE SET NULL foreign key when the exact synthetic persona is removed. Preserve base actors/Auth/Home/Business/memberships/Viewer override and unrelated rows. Recompute final FK/non-FK closure, ownership/payment0 and retained fingerprints. Newly discovered IDs require separate review. The executable cleanup must receive root review before commit; final receipts must establish scoped-zero and retained equality. The inventory's generic protected=false must not authorize audit deletion.

## Stream2

Reviewed final-audit-inventory-before.json: exactly two home_calendar_created audit IDs8e4f0e61-6085-461c-9ec2-1fd1de1ba624 and889d758b-3858-4016-aed5-97311e1af129, both owned actorbb1d5fae-72f7-49b3-86ad-ee977a165e9f, targeting retained Android/iOS Visit fixtures.103 incoming Home FKs show only those audits, two Visits, one owned occupancy and one HomeOwner. Home deletion would cascade the audits.

Retain synthetic125 Home9d885f71-3201-4b59-9cb4-e7b91d4190b4, its HomeOwner/occupancy and all HomeAuditLogs, including new final Visit audit rows. After actuals delete only exact authorized Visit event IDs after child/FK checks. Restore temporary original123 dates/coordinates/privacy/member state. Verify audit IDs/contents and unrelated rows remain equal; explicitly report retained synthetic Home rather than claim zero fixtures. No schema/constraint/retention policy change.

## Executable scope and later Visit approval — 08:03Z

Stream3 amended cleanup SQL SHA256 `3acff4e8cf9fd5e12d58a9144359a23fc2c9f61ec195de2d635e108f4d70d5aa` independently matched all32 exact DELETE ID sets to approved inventory and guards all74 incoming FK edges (including zero-row Payment.booking_id) under locks with row/audit assertions. Conditional execution approved only after iOS acceptance/restoration and own writers stop; new closure deltas return for review.

Stream2 may create one replacement `S2-Place-Final-Android-Past-Visit` through the actual composer on retained125Home, temporarily set only its dates past to verify an actual fresh GET/render, restore original dates/orientation and exact-clean authorized Visit IDs. Previous swipe produced no GET and navigation discarded create-only VisitDetail; neither establishes Past acceptance. No new fixture retiming authority for Stream3.

## Final Stream3 cleanup and root temporary verification — 08:34Z

After actual iOS acceptance, root reviewed the one new owned ListingView767b4812-e492-4b7f-b73d-6a75eb44e3b6 from the listing tap (exact owner/listing/timestamp guards). Schema preflight corrected nonexistent Business to existing BusinessProfile/Team/PermissionOverride; failed attempts rolled back before commit. A forced-rollback diagnostic proved only two existing UserFollow AFTER DELETE follower counters changed1→0, with every other User column including updated_at equal. Root authorized this exact trigger consequence for Member079e12e1-0571-4f2f-91d7-f14ae639b654 and Owner81990c03-c41b-4026-ad07-ad82c1ef896d, scoped to reciprocal Follow928c164b-ea5a-48fd-b91b-e1ea780d3a10/9d63afdd-a121-42e1-b16b-c09027769984, no manual data repair.

Final SQL SHA256 `3ee0b2ba84f1bee556e30c80d1166ad9675c56683ff046ff22503b3fc6fdc72d` committed08:23:10Z; independent08:23:56 read confirms all33 scoped tables zero,17 notices gone,6 audits retained with only persona_id SET NULL, all other retained bases equal. Safe receipts are in sealed `20260924-stream3-native-notifications-completed-r1/cleanup/`. Retain rollback diagnostics as tooling evidence, not application failures. Old fixture creation/replay is no longer authorized.

Root today-calendar Slot600de831-0c71-454d-b847-bbd65d1c9654 was created through201 for retained draft Train128169e9-a399-4dbb-8b7d-1d05f0658dfd, rendered on both native apps, then exact locked deletion08:18:45 guarded date/filled0/capacity1/open/zero reservations; parent train full hash equal and slots0. Exact synthetic C18 Postdb0d1436-627c-4861-9bae-72cb1386f10a was created201, deleted through actual iOS confirmation, disappeared from Pulse and returned API404/SQL0. No provider writes. Root private safe receipts remain under `after-29bf-20260924`; final curated seals pending.
