# Home document replacement — September 9, 2026

Work is isolated in `/private/tmp/pantopus-home-document-replacement`, branch
`codex/home-document-replacement`, based on the completed recovery branch at
`134b25751`. [PR #22](https://github.com/WangPantopus/skinny-pantopus/pull/22) is
merged as `6fbdcce1203780b475bd209ed4f6fc5e03bfb487` after
[full CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34374779134)
passed at `134b25751`.

## Current gap and intended behavior

Both native Replace actions navigate to a new upload and create another document.
Replacement must keep the original document ID/link, title, category, visibility
and other user metadata. The chosen file becomes current only after its complete
bytes are stored and an atomic version check succeeds. Failed or competing
replacements leave the previous file available. Current manage/visibility access
is required and checked again after the provider upload.

The intended storage contract reserves a new upload UUID and quota before bytes,
then swaps the current File metadata under a lock. A unique storage-key UUID per
version prevents an old cleanup task from removing identical bytes reused by a
later version. The reservation becomes the old version's cleanup tombstone;
quota releases the old size once. Retries identify the original request and
version. Rejected candidates release their reservations and retain cleanup
state. Existing initial-upload IDs and document URLs remain compatible.

The backend implementation now passes 4,453 tests, including 76 focused Home
storage/replacement cases. All 12 SQL contracts and pinned Supabase 2.116.0 full
function lint pass: 118 application functions, 73 bindings, zero application
errors and the six reviewed stock PostGIS diagnostics. The replacement contract
checks stable identity, preserved metadata, transfer between uploaders' quotas,
lost-response retry, rejected candidates and old/current version cleanup.
Only the owned local `home_document_replace_contract` database has received the
new `20260909163000_home_document_replace.sql` migration. No hosted replacement
code or migration is deployed. Private evidence is under the recovery root's
`home-document-replacement` directory, including `replacement-contract.log`,
`replacement-lint.log`, `replacement-backend.log` and `backend-full.log`.

Native detail screens will use their normal file pickers and explicit replace
confirmation. They will verify the returned document/version and reload exact
bytes. Native wiring/tests and scoped staging acceptance remain required before
claiming this milestone complete.

Explicit backend privacy gates pass. Three independent-connection races pass:
competing replacements, expiry winning before replacement, and deletion winning
before replacement. Losing candidates cannot overwrite/resurrect the document;
quota and cleanup remain consistent. Both native pickers and confirmation
controls are now wired with regression tests; native build/test validation is
in progress. No hosted replacement deployment has occurred.
