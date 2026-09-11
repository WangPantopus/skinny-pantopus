# Current member Home overview defaults

Verified source continuation of H07 on `codex/home-permission-boundaries`. This is
ordinary invitation admission and the missing overview default. Real Home
creation, signup, join UI and broader first use remain open.

The additive `20260911030000` migration gives only `home.view` to the five roles
whose current reference policy omits it: administrator, manager, member,
restricted member and guest. The existing effective-access resolver still
requires current verified occupancy. The migration preserves existing role
decisions with `ON CONFLICT DO NOTHING`; individual denies remain authoritative.
It grants no task, calendar, finance, ownership or management permission.

Invitations retain their saved complete policy. A pending invitation under the
former member defaults returns `INVITE_POLICY_CHANGED`; it can be declined and
reissued by the authorized inviter. The migration never rewrites old invitations
or grants membership merely because someone has an address or invitation.

## Local verification

All 44 SQL contracts pass with the actual candidate migration executed inside
each contract's rollback transaction. The new contract accepts all five roles
through the production invitation RPC, preserves child/adult distinctions,
rejects pending/provisional/revoked/future/expired access and personal denies,
checks frozen/archived Home admission, and recovers an old-policy invitation.
The existing contracts' exact reference count is updated from 24 to 29; their
before/after policy-preservation comparisons remain. The dedicated populated
upgrade rehearsal preserves existing role grants and explicit role denies,
and proves repeated application is idempotent.

Actual HTTP/service/SDK/PostgREST acceptance r3 passes ordinary-member
invitation → accepted occupancy → current Home list and detail with no synthetic
permission override. Personal denial and provisional/future/expired/inactive
occupancy retire both reads; every case recovers. A deliberately lost committed
acceptance reply retries the same invitation without another occupancy or audit
mutation. All synthetic rows clean exactly and the original 24 role references
are restored. Authentication and email/notification delivery are controlled;
no real recipient or paid provider is contacted.

Private evidence:

- `/private/tmp/pantopus-home-member-defaults-contracts-r4.log`
- `/private/tmp/pantopus-home-member-defaults-upgrade-r1.log`
- `/private/tmp/pantopus-home-member-defaults-http-r3.log`
- `/private/tmp/pantopus-home-member-defaults-privacy-r1.log`
- `/private/tmp/pantopus-home-member-defaults-http-state-*/` holds exact
  before/introduced role snapshots for safe cleanup.

Earlier SQL attempts found contract mistakes: the freeze check initially used
the permission-set helper instead of the production Home-admission context,
a PL/pgSQL alias collided with a variable, and the temp snapshot lacked a
service-role read grant. Those were corrected; the failed logs remain private.
HTTP r1 passed behavior but its cleanup comparison omitted `created_at`.
The exact five rows from that run were restored using their recorded creation
timestamp; later runs retain full row snapshots and lock before exact cleanup.
HTTP r2 also passed; r3 verifies the stronger cleanup guard.

The migration is prepared, not permanently adopted in a database or merged.
It changes the full source inventory to 39 Home / 21 paid / 48 distinct combined
versions in this milestone. The owned replay database's ledger still trails some
already-rehearsed source migrations; do not rewrite that ledger to make counts
look current. Combined populated upgrades, ledger adoption and final-head CI
remain integration gates. No hosted mutation, deployment or paid activation.
