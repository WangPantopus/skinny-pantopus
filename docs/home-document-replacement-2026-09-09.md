# Home document replacement — September 9, 2026

Work is isolated in `/private/tmp/pantopus-home-document-replacement`, branch
`codex/home-document-replacement`. It includes merged master through
[PR #22](https://github.com/WangPantopus/skinny-pantopus/pull/22), merge
`6fbdcce1203780b475bd209ed4f6fc5e03bfb487`, whose
[full CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34374779134)
passed at `134b25751`.
[PR #23](https://github.com/WangPantopus/skinny-pantopus/pull/23) is ready; its
current-head CI must pass before integration.

## Result

Before this change, both native Replace actions opened a new-document upload.
iOS and Android now use their normal file pickers and explicit confirmation to
replace bytes at the original document link. The document ID, title, category,
visibility and user details remain. The current file records its actual uploader.
The clients validate the returned ID/version and reload through the authenticated
content endpoint; failed or unconfirmed replacements cannot claim success.
Older servers without a file version leave Replace disabled.

The API reserves a new upload UUID and quota before storing bytes, rechecks
manage/visibility access after upload, and commits against the expected version
under database locks. Retries reconcile the original request. A unique key per
byte version prevents cleanup from erasing identical bytes reused later. The
reservation becomes the old version's cleanup tombstone; the old uploader's
quota is released exactly once. Rejected candidates release their reservations
and retain cleanup state. Temporary quota headroom for old and new bytes is
required while preparing a replacement.

## Verification

- All 4,453 backend tests pass, including 76 focused Home storage cases, plus
  the explicit privacy gates.
- All 12 database contracts and pinned Supabase 2.116.0 full function lint pass:
  118 application functions, 73 bindings, zero application errors and the six
  reviewed stock PostGIS diagnostics. Three real connection races pass:
  competing replacements, expiry winning first, and deletion winning first.
- iOS: 41 focused tests, strict lint/format and signed simulator builds pass.
  The live Files picker → confirmation → same document → Share journey passes.
- Android: 41 focused tests, formatting/Detekt, Android lint and the APK build pass. The live
  system picker → confirmation → same document → Share journey passes.
- Both native share copies match all 1,292 replacement bytes, SHA-256
  `3c1cc8099dfbae0911a9c1cb2cbc83ea528dc88c2753f726aab529435e108819`.
  Both apps remove their share copies on native relaunch. Neither share sheet
  selected a recipient. The two owned picker-source copies were also removed.
- Two live API cycles verify stable links/metadata, exact current bytes,
  idempotent retry, permission/stale denial, one concurrent winner and quota
  transfer between uploaders. Current bytes survive cleanup of earlier versions,
  including reintroduced identical bytes.

Provider object listings become empty before every download cache stops serving
old bytes. Immediate download-absence assertions failed, including beyond a
four-second retry window; later normal and fresh reads deny all ten API fixture
tombstones. This proves eventual provider cleanup, not instant physical removal
from every cache. The authenticated document endpoint returns the correct current
file and denies deleted links.

## Deployment and cleanup

Backend commit `bcea333ac` is integrated with master at `db661b695`. The compatible
`20260909163000_home_document_replace.sql` migration is applied only to Free
staging, preserving all existing File/HomeDocument/FileQuota rows and its absent
hosted migration ledger. A private API candidate runs `db661b695`; its image is
`sha256:428d140a04e8609155e2f38a1c2d6a646122129e486e681e3986c04c6856ee2c`.
Public staging API/worker and production are unchanged. Matching API/worker
versions are required before enabling replacements; old APIs fail closed on the
new versioned paths.

All API fixtures and both native documents are deleted, their storage listings
are empty and their old content URLs deny access. The temporary native manage
grant is removed. The original five Home documents, owner quota of 174 bytes /
three files and member quota of 1,218 bytes / two files remain. Daily upload
counters reflect the performed tests and were not reset. Do not rerun completed
publication scripts or recreate their identifiers.

Private evidence is indexed in the operator recovery root's
`home-document-replacement` directory: backend/privacy/contract/lint logs,
connection-race results, live API and cleanup evidence, iOS native XCTest
`ios-native-20260909T165609.log`, fresh Android UI captures, and both native export
hash/restart records. No physical iPhone update or new APNs acceptance is claimed.
