# Android private claim evidence — September 10, 2026

This checkpoint connects Android claim documents to the private evidence lifecycle
introduced by the 090000 backend milestone. Document verification remains
separate from claim approval and never invokes a membership or ownership grant.

## Implemented flow

The ownership/residency wizard uploads bytes with the exact Home, claim,
evidence type, original upload UUID and current server session fingerprint.
Interrupted responses retain the claim and upload IDs for retry. Local removal
first retires a possible server reservation; failed cleanup keeps the original
reservation available for retry. The retired generic File URL and `storage_ref`
registration path is no longer used by the wizard.
Multipart filenames include the UTF-8 extended filename parameter, preserving
non-ASCII names through the backend's pinned parser and exact upload receipt.

Manual choices are deed, closing disclosure, tax bill, utility bill and lease.
Identity-provider, title-match and escrow-attestation uploads are removed from
the active choices. The wizard no longer infers address verification from a
filename or attempts automatic dispute activation. Saved documents are described
as pending review, without promises of Home access.

My Claims opens the exact claim's current private documents, including retained
withdrawn claims. Claimants can read available documents and retire pending
uploads. Home and platform reviewers use their existing screen session scope,
read the current exact claim snapshot, open private bytes and explicitly confirm
one rendered document. Successful verification refreshes the document snapshot;
claim approval remains a separate existing action.
Retired records offer cleanup retry only while the current server projection
reports cleanup pending.

PDF, image and text previews stay inside the app. The API supplies bytes rather
than public URLs. Images are decoded at bounded dimensions; PDF pages render
through a temporary private app-cache file that is deleted after rendering.
Preview buffers are wiped on close, session invalidation and failed authority
rechecks. The dialog prevents screen capture. Pending verification survives an
unknown result using only the original receipt; it hides prior bytes and metadata,
then reauthorizes before retrying the same decision. Final permission/session
denials discard the receipt as well.

Both the existing live TokenStorage guard and the server fingerprint bind
operations to the opening account/session/Home/claim. Late picker results,
downloads and mutation responses cannot rebind an old screen. Synchronous guards
prevent duplicate submissions, downloads, verification and cleanup actions.
The initial claim submission also carries the fingerprint read from the opening
account's authenticated claims response; the later evidence list must match it.
Timeouts and rate limits retain the original unknown receipt for private document
verification, Home claim review and platform claim review. Each retry preserves
the exact original action, note and snapshot.

## Verification

The final R9 host run passed **111 unique tests with zero failures, errors or
skips**, `detekt`, `lintDebug` and `assembleDebug`. The app and tests compiled;
the debug APK was built. Final formatting also passed. The combined verification
and assembly run finished in 6 minutes 7 seconds.

| Focused suite | Tests |
| --- | ---: |
| Ownership/residency wizard | 24 |
| Exact evidence access and session checks | 18 |
| Evidence controller and recovery | 23 |
| Actual Retrofit/HTTP contracts | 10 |
| Home/platform claim decisions | 18 |
| Existing Home claim review | 12 |
| My Claims, including withdrawn cleanup | 6 |

The cases cover first-claim server binding, multipart fields/headers, Unicode
filenames and bounded downloads; exact Home/claim/record/receipt checks; late
session replacement and revoked access; duplicate actions; unknown replies;
408/429 retries without changing the original decision; concurrent document
retirement; cleanup retry; and reopening a withdrawn My Claims row.

Detekt reports **zero findings**. Android lint reports **zero errors and 212
warnings**, all in files outside this checkpoint. It also reports 17 informational
items, including a nonblocking boxed integer state suggestion for the new preview
page index. The existing project warnings were not suppressed or changed.
Displayed bitmaps use managed lifetime; only unpublished failed renders are
explicitly recycled.

Independent review covered exact post-download record comparisons, current
opening identity, receipt-only recovery, final denial cleanup and the actual
claimant/reviewer entrypoints. Its findings have focused regressions. A local
rehearsal through the pinned Busboy 1.6 parser preserved the exact Unicode
filename `住所-証明-é.txt`; the real Retrofit multipart test covers the same
extended filename header.

Backend/database/storage behavior remains the separately verified
[private evidence milestone](home-claim-private-evidence-2026-09-10.md).

## Limits and next work

Local JVM/HTTP tests and APK assembly do not prove hosted provider configuration
or real device preview behavior. No hosted write, new paid service,
role-default change, iOS edit or task-attachment screen is part of this slice.
Native task detail/capability controls, then attachments and the remaining complete
household journeys, follow. No APK was installed on a user's phone by this check.
