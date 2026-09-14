# Browser attachment recovery after reselection — September 10, 2026

The original attachment UUID and immutable metadata now survive panel close and
page reload. Before the first POST, an encrypted IndexedDB slot stores the exact
API origin, actor, Home/task, UUID, original filename, MIME, size and SHA-256.
It stores no file bytes, credentials or server session proof. The user explicitly
reselects the file; matching bytes recover the original UUID, filename and MIME,
even when the local file has been renamed. There is no automatic cold file replay.

One unresolved upload per exact task blocks a different file, including in a
competing tab. Selection of a different file can advance the slot only after the
previous upload is confirmed. Atomic revision checks prevent a stale confirmation
or acknowledgment from replacing a newer request. Confirmed metadata remains
available after UI completion so immediately reselecting the same bytes cannot
create another upload after a hidden completion.

**Check previous attachment** reads current authorized metadata for the exact
original UUID. Matching ready metadata confirms the lost response without another
POST. Matching retired metadata offers an explicit local acknowledgment; it
cannot clear another revision, POST a replacement or DELETE a different file.
An absent/incomplete record keeps the original request. Corrupt recovery blocks
replacement uploads and retains the unreadable envelope.

## Verification

Actual Chrome with a disposable profile and synthetic loopback HTTP passed:

- Committed upload/lost reply → full reload → reselect renamed identical bytes:
  identical original UUID, generated multipart filename, MIME and bytes; one
  logical upload despite three explicit retries.
- A competing tab selecting different bytes while the original is unconfirmed
  submits no new upload. An explicit later file after confirmation receives a
  different identity.
- Current metadata confirms an uncertain upload without POST. Current retirement
  can be explicitly acknowledged without replacement POST or another DELETE.
- Corrupted encrypted metadata blocks replacement; an actual account-change
  event hides the form and does not replay an upload.
- Real stored envelopes contain encrypted metadata, a nonextractable AES-GCM key
  and no file bytes/credentials. Recovery keys include actor and exact task.

The prior actual Chrome access and confirmed-create acceptance were rerun after
extracting the shared IndexedDB/key helpers; both pass, including close during
the upload helper's own preflight, sparse edits, denied reads, competing create
recovery and corrupt create storage. The database remains version 1; create
addresses/AAD are unchanged and upload entries occupy a separate namespace with
a separate encryption key.

The full web suite passes **1,160 checks / 91 suites**; types have zero errors,
and focused changed-source lint has zero warnings/errors. Rendered checks include
panel reopen/reselection with the retained ID. They use storage doubles; actual
Chrome evidence above verifies the real encrypted store.

Private evidence: `/private/tmp/pantopus-home-browser-upload-acceptance.cjs`,
`/private/tmp/pantopus-home-browser-upload-result.json`,
`/private/tmp/pantopus-home-browser-upload-full-tests.log`, adjacent type/lint logs,
and the final access/confirmed acceptance logs. These contain only synthetic
fixtures and are intentionally outside Git.

## Limits and next work

This closes browser finding 3. Together with the [access](home-web-task-access-recovery-2026-09-10.md)
and [confirmed-create](home-web-task-confirmed-recovery-2026-09-10.md) reports, all
four checkpoint browser findings are addressed. File bytes still require explicit
reselection; unsent selections are not durable. Browser storage deletion and
unavailable/corrupt storage cannot be treated as evidence of a server outcome.
These synthetic journeys do not certify hosted SQL/storage or release readiness.
Remaining Home recurrence/relationships/ownership/resource and payment scope stays
open. PRs #32/#34 remain drafts; no merge, hosted data or paid service changed.
