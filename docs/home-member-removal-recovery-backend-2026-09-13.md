# Home member removal recovery — backend

Prepared on `codex/home-member-removal-recovery` from
`d3c3e0fac3b90e7e0d468ba421cffd5bb0e9475c`. This report covers the isolated backend,
SQL and shared transport candidate. Browser/native acceptance and integrated exact-head
CI are separate gates; R03 remains partial until its remaining journeys are accepted.

A confirmed removal now has one immutable actor/request-bound command. A lost reply
can be read or retried without repeating membership, credential or audit writes.
Unseen cancellation creates a durable tombstone. Every new removal checks current,
locked authority and the exact reviewed membership/identity; history is independent of
today's roster or access. Legacy ordinary removal now recognizes completed membership
and returns without sweeping later credentials or changing timestamps/audits.

## Contract and authority

Static `/api/homes/member-removals` routes mount before dynamic Home routes. Session,
context, command POST, command GET and cancel POST use the accepted live session-scope
boundary. The original contains only request ID, Home ID, target ID, occupancy ID,
`action:remove` and opaque decision token. The service validates exact types, identity,
receipt/error combinations and timestamps. Reviewed identity uses public username;
`target.name` is always null and no email/legal-name fallback is exposed.

Actor/request UUID and intent hash are immutable. Matching historical results are
returned before accessing current Home/member/owner/grant state; a conflicting original
fails without replacing the first result. Only current authoritative denials become
rejected receipts. Unavailability remains unresolved. Receipt/audit failure rolls back
all effects and the pending command. History has no Home/occupancy cascade foreign key
and contains no raw reviewed names, address, credentials or bearer session.

Current self-leave, primary-owner transfer, other-owner, unknown-role, age, window and
explicit permission-deny rules remain enforced. First successful self-leave may produce
generic notices after the commit, with each recipient's membership rechecked immediately
before admission. Read/replay/cancel do not notify. Notices are best effort: no outbox,
provider handoff, device arrival or delivery guarantee is established.

## Semantic generation and upgrade limits

`20260913010000_home_member_removal_recovery.sql` adds nullable
`HomeOccupancy.membership_version` without a default, backfill or old-row heap rewrite.
New rows receive a nonce; semantic changes rotate it even in same-transaction A→B→A.
Updated-at/density-only writes and direct nonce assignments cannot restore a predecessor.
The reviewed hash also binds authorized public identity, Home and target ownership.

Historical row preservation compares all original columns, excluding only the added
column; it does not claim identical expanded row JSON. Existing finite earlier end times
remain intact. A first legacy removal canonicalizes null/nonfinite end times to a finite
completion time so subsequent calls are true no-ops. Already ended grants and revoked
letters retain their original values.

The accepted reviewer snapshot hashes the whole occupancy. Adding the nullable field
therefore invalidates an existing **unsubmitted prepared reviewer token**, even without
changing any original row value. Populated acceptance proves its old original fails with
`RESIDENCY_REVIEW_CHANGED` without writing a claim, occupancy, receipt or audit; a fresh
review succeeds. Completed reviewer/residency/sender receipts remain historical. Sender
and recipient prepared token builders do not hash the occupancy row; their retained
prepared contexts remain unchanged in the upgrade rehearsal. Do not claim every pending
review original stays reusable across this schema addition.

Legacy callers still lack a request UUID/generation fence against a future legitimate
nonterminal membership. Current shipped re-invitation of an ended member is refused;
this change does not introduce renewal. Synthetic later scoped rows in SQL contracts
prove old terminal/replayed removal cannot sweep later access, but are not proof that
shipped targeted sharing admits an ended member.

## Verification

Final candidate gates:

- 74 focused service/route checks; full backend regression 5,314 passed across 320
  suites, 16 skipped tests / one skipped suite. Existing delayed test-process shutdown
  diagnostic is retained; process exited successfully.
- Populated upgrade `upgrade-r4`: complete original values and 366 retained tables,
  roles, ledger, functions and privileges preserved by outer rollback; no backfill,
  positive fresh nonces, same-transaction ABA protection, old reviewer re-review
  boundary, retained invitation/residency proof and zero PL/pgSQL lint issues.
- `contracts-r5`: all 51 raw and 51 generated SQL contracts pass. Four predecessor
  contracts were narrowly updated to assert the new nonce behavior or terminal no-op;
  unrelated exact preservation checks remain. New contracts cover service-only access,
  private projection, immutable binding, receipt/audit rollback, both nonfinite timestamp
  signs, later-row preservation, owner reconciliation and one-time notification candidates.
- `http-r3`: 15 actual HTTP/SDK/SQL groups, seven immutable removal commands. Normal
  synthetic login rotates the real fixture token/session; exact raw request hashes prove
  retry identity. Tests cover lost completion/cancellation replies, held-before tombstone,
  fresh account session, account/request conflicts, supported current-authority deny and
  restore, supported role ABA, separate unavailable reads, legacy no-op, refused renewal
  and generic first-self-leave notices with zero replay notices.
- `races-r4`: final observed-lock acceptance covers expiry after target-profile locks,
  concurrent exact duplicates, submit/cancel ordering both ways, historical results
  bypassing a locked current Home and changed public identity while a request waits.

Committed HTTP/SDK work uses a dedicated schema/reference-only synthetic candidate DB
and existing-image PostgREST on loopback 18085, with fixture HTTP on 18084. Supabase SDK
requests use the documented local `/rest/v1` gateway-path mapping. No owner accounts or
Homes are copied. Static non-user references come from the checked-in reference migration.
All auth, shell and notification delivery are controlled; provider/hosted readiness is
not established. The candidate DB/runtime are retained, not dropped. Retained replay has
no committed R03 schema adoption or catalog scars.

Fresh fixture cleanup compares all 374 candidate and 366 retained table values,
functions, roles, ledger, columns, constraints, triggers, defaults and access properties.
Only physical PostgreSQL maintenance statistics/freeze horizons are excluded from
logical schema comparison. A predecessor cleanup assertion included freeze counters;
its exact failed comparison and follow-up showing only those counters changed are retained.

Private final bindings and evidence live under the operator recovery index in
`member-removal-20260913/backend-recovery-r1`. The local preparation root is
`/private/tmp/pantopus-home-member-removal-r1/candidate-backend/`. Failed harness attempts
are retained separately: read-only output-buffer limit before setup; renewal refusal
asserted at prepare instead of actual command; deliberate conflict included in same-body
retry accounting; an overlong synthetic username; incomplete multiline static-reference
extraction; and the physical-counter cleanup assertion. None is relabeled as accepted
product proof. Final gates bind their actual source bytes.

The earlier baseline's frozen prose incorrectly said sender context returned the renewal
refusal. Its saved HTTP events show context 200 followed by an actual rejected sender
command 409 (`MEMBERSHIP_RENEWAL_REQUIRED`). The saved original and source confirm this;
original artifacts remain untouched. No readmission occurred and the held old DELETE was
discarded without SQL, so deletion of a renewed membership was never demonstrated.
