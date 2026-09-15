# Browser saved task-action entry — September 10, 2026

Both active browser gig pages now expose saved cancellation, reopening and
worker-release status independently of the normal gig detail projection. A
former worker can reopen the original request after assignment ends, and the
entry remains present when detail access returns 403 or 404 or the gig is
already cancelled. The shared entry resolves the current account under its
opening API origin, authentication token and session-change marker before
reading storage scoped to that exact origin, actor and gig.

Opening the entry reads the original request through the existing stop dialog.
It does not submit a new action. A missing receipt permits only an explicit retry
of the unchanged original command after the current preview allows recovery.
Missing, malformed or inaccessible storage cannot turn a recovery entry into a
new action. Account, session and gig changes retire old controls and ignore late
profile or status responses. Same-tab saves refresh the entry without requiring
a reload. Storage and discovery failures remain visible with an explicit retry.

A late status read cannot overwrite a different saved command. A verified
`STOP_ACTIVE` response can still adopt the exact competing request, but a pending
same-actor replacement is written atomically before the original is discarded.
If that write fails, the original remains recoverable. The dialog advances its
recovery selection only after this verified adoption so subsequent status reads
continue using the adopted request. Only an exact completed receipt clears
matching recovery data.

The owner’s Close Gig control selects the `close` action for a currently open
gig. It still fetches the authoritative server preview before an explicit
submission; assigned or other states continue through cancellation policy.

## Verification

- Final focused entry and existing dialog checks: **50 passing tests**. The 28
  new cases render both actual classic/v2 page components with synthetic HTTP
  results, including former-worker and terminal states, detail 403/404, owner
  close preview, status denial, status 404 and unchanged explicit retry, storage
  failures, scope isolation, session replacement, late profile/status responses,
  failed replacement persistence and subsequent reads after verified adoption.
- Final complete web regression: **1,186 passing tests across 87 suites**.
- Type-check gate: **zero errors** against the unchanged zero-error baseline.
- ESLint for the new entry and changed recovery helper/controller: **zero
  findings**. `git diff --check` passes. Existing page lint suppressions and
  unrelated CompletionFlow typing are unchanged.
- Independent review identified the clear-before-replacement storage failure;
  the final implementation and regression preserve the original request on that
  failure. The final repair reread passed with no remaining blocker.

Private operator logs are `/private/tmp/pantopus-gig-stop-entry-focused-r2.log`,
`/private/tmp/pantopus-gig-stop-entry-full-r2.log`,
`/private/tmp/pantopus-gig-stop-entry-typecheck-r2.log` and
`/private/tmp/pantopus-gig-stop-entry-eslint-r2.log`. They are not committed.

These checks exercise real page and dialog components against synthetic network
responses. They do not claim a new hosted/provider or physical-device acceptance
run. The earlier browser rehearsal remains documented in
[the browser recovery report](paid-gig-web-stop-recovery-2026-09-10.md).
Backend/native parity and remaining started-work, fee, dispute and full-provider
journeys remain tracked separately. No backend, migration, native application,
hosted configuration or paid subscription changed in this checkpoint.
