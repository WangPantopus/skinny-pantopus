# Home Wi-Fi and access-secret transactions — September 9, 2026

This source checkpoint is part of draft
[PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32), after the
authority/deletion checkpoint `7f6b59ba3`. No hosted Home migration or role grant
has run. Native controls and guest-pass sharing remain separate work.

## Result

The canonical `BEFORE INSERT` trigger attempted to insert a secret value before
its metadata parent existed. The immediate foreign key rejected ordinary
nonempty Wi-Fi creation. Home bootstrap logged this as nonfatal, and the normal
access endpoint used two independent writes that could leave empty metadata.

Creation now inserts blank metadata and its separate secret value inside one
service-only transaction. Updates and deletion are atomic too. The immediate
foreign key remains, metadata never stores plaintext, and audit rows contain no
secret values. Omitted update values remain unchanged; explicit rotations must
contain a valid value. Normal APIs retain their response shape and report
retryable transaction failures without partial success.

Reads require `access.view_wifi` or `access.view_codes` for the specific type,
plus record visibility. Sensitive rows require `sensitive.view`; managers-only
rows require the current effective rank. Writes require exact `access.manage`,
not the old alias that also accepted `members.manage`. A write permission does
not automatically reveal a value the actor cannot read. Direct client access
to legacy/access metadata/value tables is closed, including overlapping write
policies that previously also permitted reads.

The Home, current authority, history and exact records are locked and checked
before reads and writes. Current age, status, dates, ownership revocation and
explicit denies apply. An exact adult/unknown-age creator may still manage only
their own members-visible secret during private setup, with a narrow history
allowlist. This never grants generic provisional membership or access to a
previous household's secrets.

Uploading the creator's own still-pending ownership evidence does not remove
access to their own Wi-Fi. Foreign proof/file provenance or established history
denies private setup. The proof allowance confers no file-byte/document access,
and file/evidence history still blocks Home deletion until storage retirement.
Safe own-secret setup audits remain compatible with private Home cleanup.

## Verification

Final validation with the parallel residency-admission slice passes **4,713
backend tests (16 skipped), 294 suites and all privacy gates including 15 E2E
checks**. The access-secret focused suite passes **107 tests**. All **24 raw
SQL contracts and 24 generated pgTAP wrappers** pass. SQL lint reports **136
functions, 74 trigger bindings, zero errors and five existing warnings**.
Fixtures were cleaned and wrappers/whitespace checks passed.

**13 real two-connection secret races pass** after the final repair: current
read/write revocation and expiry, sensitive visibility changes, a new writer
deny, foreign occupancy/ownership/proof/history/file, concurrent rotations that
preserve omitted metadata, and deletion before a waiting read. These include
demonstrated lock waits and exact cleanup. The 14 admission races are recorded
in the separate residency report.

Independent review then reproduced a type-change read-deny bypass: a blind code
manager could relabel an unread code as Wi-Fi and expose the preserved value.
The repair requires old-row read authority to preserve bytes across a type
change; a blind manager must supply an explicit replacement value. Both
directions, no-write denials and positive replacement/readable-value controls
now pass the real SQL contract and generated wrapper. No unrelated policy was
relaxed. The final migration SHA256 is
`0d64723869088c790d3e24e8d45837854118cc7afc9fa168032c338333077bef`.

Source evidence is in
[`home-access-secret-transactions.sql`](../scripts/db/contracts/home-access-secret-transactions.sql),
the generated wrapper and focused service/route/bootstrap tests. Temporary
concurrency harnesses and operator logs remain outside Git.

## Remaining work

The guest-pass read path in `backend/routes/homeGuest.js` still joins all Wi-Fi
values without visibility filtering. It must join the next exact-resource/
recipient/current-authority sharing milestone; this checkpoint does not make
guest sharing release-ready. Native/web permission controls and creation retry
UX also remain part of full Home acceptance. Home creation still treats its
optional Wi-Fi bootstrap as a separate nonfatal setup step.
