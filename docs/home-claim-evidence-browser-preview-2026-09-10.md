# Private claim evidence browser preview — September 10, 2026

## Outcome

Claim reviewers can display private PDF documents in Chrome and inspect supported
images or plain text before explicitly verifying an evidence item. A failed
access recheck removes the prior preview. An interrupted verification retains
its original decision receipt for a separate retry; opening the document again
cannot discard or replace that pending decision. Claim approval remains a
separate action.

An actual browser check reproduced the previous failure: the sandboxed iframe
could not load the synthetic PDF. Empty sandbox permissions, scripts only,
same-origin only, and their combination all produced a Chrome document error;
the control without that iframe sandbox rendered the same file.

The replacement checks the downloaded Blob's allowed MIME, nonempty size up to
25 MB, and matching file signature before creating a local object URL. PDFs use
the browser's explicitly typed PDF object, images use an image element, and
plain text is escaped text in a scrollable block. HTML and SVG are rejected.
Browsers without a suitable renderer offer an explicit download of the same
validated private Blob, with an instruction to inspect it before confirming.
No external viewer service or new renderer dependency is involved.

Current-session and exact claim/review identity checks remain required before
and after downloading. A session change during browser byte decoding discards
the result. Changing the claim, review token or review mode permanently retires
the old component, even if its original props later return. Reopening, failures,
session changes and unmounting clear or revoke local preview URLs. Downloading
explicitly creates a user-controlled copy; revocation of an in-memory URL cannot
remove a copy already saved by the reviewer.

## Verification

- Installed Chrome rendered the production preview component with a synthetic
  601-byte PDF. The page visibly displayed “Synthetic private evidence,” with no
  PDF load errors. An HTML script string in plain text stayed literal and did
  not execute. This is a real browser renderer check, not a DOM-only assertion.
- Final complete browser regression: 1,097 checks in 87 suites passed. The 27
  focused preview/review cases cover explicit confirmation, exact retry,
  denied reopens, session retirement, delayed decoding, MIME/signature rejection,
  escaped text, image fallback and private URL cleanup. The final full run also
  includes the independent review's pending-decision reopen correction.
- TypeScript completed with zero errors; both changed components passed ESLint
  with zero errors or warnings. Diff whitespace checks passed.
- Independent review approved the final four-file source/test change after
  finding and correcting the pending-decision reopen issue.

Operator-only logs and screenshots remain outside Git under
`/private/tmp/pantopus-claim-preview-*`. They contain synthetic documents only.
The initial reproduction matrix and repaired browser screenshot were visually
inspected. The full run is `pantopus-claim-preview-web-full-r3.log`; final type
and lint runs use the `r3` suffix.

## Limits and next action

This milestone verifies the renderer and client lifecycle, building on the
[private evidence service and Storage API evidence](home-claim-private-evidence-2026-09-10.md).
It does not claim a hosted reviewer session, Safari acceptance, or completed
native household journeys. No hosted migration, permission, subscription or
production setting changed. Complete native evidence controls, task attachments
and the remaining Home workflows, then the integrated household acceptance run.
Draft PR #32 remains unfinished and requires complete final-head CI before merge.
