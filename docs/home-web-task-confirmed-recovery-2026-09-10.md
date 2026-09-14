# Browser confirmed task recovery — September 10, 2026

A confirmed task creation remains encrypted in the original recovery slot until
the user explicitly chooses **Start another task**. Closing, backgrounding or
navigation after the confirmation write cannot silently lose the original
request. Reopening offers **Open saved task**, which replays the same idempotent
command and checks the exact current task. A removed original keeps the existing
server-confirmed retirement acknowledgment flow.

The explicit new-task action rechecks current creation permission and consumes
the observed revision atomically. A competing tab with an older revision cannot
submit that consumed request or replace it. No new POST is issued by consumption.

## Verification

Actual Chrome, using a disposable profile and intercepted loopback-only synthetic
HTTP, passed lost committed reply → page reload → original recovery; close while
exact detail is held after the encrypted confirmed write → reopen saved task;
explicit new-task action; competing stale tab; and corrupt-envelope denial.
The two creation POSTs had the same original UUID and payload. The corrupt slot
was kept, with no replacement POST. The actual IndexedDB AES-GCM envelope was
inspected inside the browser: ciphertext, a nonextractable key and no stored
credentials/session proof. No private operator state was involved.

The full web suite passed **1,159 checks / 91 suites**. The typecheck has zero
errors; focused changed-source lint has zero warnings/errors. The rendered
regression closes immediately after protected confirmation while detail is
still delayed and verifies explicit consumption without another POST.

Private reproducibility/evidence: `/private/tmp/pantopus-home-browser-confirmed-acceptance.cjs`,
`/private/tmp/pantopus-home-browser-confirmed-result.json`, and
`/private/tmp/pantopus-home-browser-confirmed-{full-tests,types,lint}.log`.

## Remaining limits

This closes finding 4 from the session checkpoint. Findings 1 and 2 are covered
by the [access report](home-web-task-access-recovery-2026-09-10.md). Finding 3,
attachment identity across close/reselection, remains open. The fixture does not
certify hosted storage, database concurrency or every Home journey. PR #32 stays
an unfinished draft; no merge, hosted data or paid service changed.
