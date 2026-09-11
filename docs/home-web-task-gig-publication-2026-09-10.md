# Browser Home task-to-Gig publication — September 10, 2026

## Result and next action

A saved editable household task now opens an explicit public Gig review. The
browser retains an encrypted original before publication, recovers the same
request after a lost response or reload, and keeps the confirmed receipt until
explicit review. Actual Chrome exercises the production Gig HTTP route/service
against isolated local PostgreSQL. This completes the bounded browser conversion
checkpoint; iOS and Android conversion controls and installed journeys are next.

Continue native parity, then relationships/residency, ownership, lease/resource
cleanup and the remaining ordered Home/payment scope. Both feature PRs remain
unfinished drafts. No hosted migration, deployment, paid service or owner-device
change occurred. All paid dependencies remain one final launch-preparation bundle.

## Public review and recovery

- The normal saved task panel links to the ordinary `/app/gigs/new` route using
  Home/task IDs only. Unsaved task edits hide the publication link. Combined
  edit/beneficiary/prefill parameters and malformed source IDs fail closed.
- A separate private-source section shows the household task title. Public title
  and description start empty; copying the task title requires an explicit tap.
  Users review title, description, positive USD budget, category, an explicitly
  selected work address and cancellation policy. Editing any field invalidates
  the review checkbox. Publication neither assigns/completes the task nor charges
  a card. Public payloads exclude Home location IDs, private source descriptions,
  mail, files and household access data.
- This initial conversion form supports those core public fields and city
  visibility with exact-address reveal after assignment. It does not offer the
  ordinary composer's media, shopping list, deadline, urgency, business posting
  or advanced options. Those additions require their own reviewed-field/recovery
  scope; this milestone does not claim all ordinary composer options as parity.
- `HomeTaskClient` reads current server authority/session before mutation and
  checks the same protected original again immediately before POST. It validates
  actor/Home/task/UUID/Gig/receipt identities. Original recovery deliberately
  permits an already-linked task; otherwise a lost committed reply could never
  be resolved. Receipt confirmation does not imply that the Gig is still open.
- `PendingTaskGigStore` uses actual AES-GCM IndexedDB, a non-extractable key,
  origin/actor/Home/task associated data and transactional revision comparisons.
  It retains the original reviewed fields and receipt, never credentials or
  session proof. Unknown results, corrupt slots and competing tabs cannot become
  replacement requests. Storage write failure blocks POST and preserves the form.
- Current denial, changed accounts and background retirement hide source and
  recovery UI. Foreground reload rechecks authority; account replacement clears
  entered fields. Original storage remains scoped to the original account.
  Definitive stale/rejected publication can be cleared only through explicit
  review of current state. Cold confirmed recovery requires acknowledgement.

## Workflow findings repaired

1. The shared API client preferred a human-readable `error` string over the
   stable `code`. Actual stale-source HTTP 409 therefore rendered as unknown
   publication with Retry only. Machine codes now take precedence while legacy
   error-only envelopes retain their fallback. The composer also displays the
   plain-object API error message correctly. Chrome now reaches current-task
   review and resets the explicit review requirement.
2. Opening a recovered, subsequently cancelled Gig still showed **Close Gig**.
   `CompletionFlow` now restricts cancellation controls, direct opening and
   submission to current owner/worker open/assigned/in-progress states. Chrome
   verifies cancelled and completed destinations, including `?action=cancel`.
   Paid PR #34 also changes this component: retain this terminal-state guard when
   reconciling its recovery implementation; do not discard either branch's work.
3. Synchronous IndexedDB quota/security failures could escape a write callback.
   The store now aborts/rejects through the visible retained-command error path.
   A forced browser storage-write failure sends no HTTP request and leaves no
   partial original. The form remains usable after storage is restored.

The first narrow screenshot captured an unsettled sidebar resize animation.
The acceptance driver now waits for the actual full-width content and zero
header offset before visual review. This was a harness timing correction, not a
claim that an app layout defect was fixed. A corrupt-slot retry initially raced
its previous alert; deterministic cold reloads now verify both repeated denial
and exact-byte restoration. Both failed runs cleaned their exact SQL fixtures.

## Actual browser acceptance

Committed driver: `scripts/web/test-home-task-gig-publication.cjs`. Its shared
`scripts/db/home-task-gig-http-fixture.cjs` runs the actual Express/Joi Gig route
and publication service against local SQL. The existing direct HTTP rehearsal
was refactored to share that fixture and passed afterward.

The final Chrome run verifies:

1. Normal Home task list/panel navigation, initially blank public fields,
   explicit review, keyboard address selection and no automatic publication.
2. A committed publication with a deliberately lost response; AES-GCM retained
   original; cold reload and byte-equivalent request retry; exactly one receipt.
3. A later real SQL cancellation and price edit preserved by replay; navigation
   to the actual Gig detail screen shows current cancellation and $30 price,
   without private source title/description. Completed/cancelled screens cannot
   reopen cancellation through the button or direct action query.
4. Cold confirmed receipt, no automatic replay, explicit acknowledgement and
   the retained server-linked Gig without duplicate publication.
5. A task edited after review rejects publication; current-task acknowledgement
   loads the changed private title and requires review again with no new Gig.
6. Two composer tabs: the second cannot replace the first tab's protected original
   or POST a competing draft, and can reload/recover the original receipt.
7. Actual SQL membership revocation and changed browser account marker hide
   private/recovery UI and suppress publication; restored authority recovers it.
8. Corrupted encrypted bytes remain blocked across cold reloads. Restoring the
   exact original bytes recovers the original receipt, without republishing.
9. Forced browser storage-write failure blocks POST before any publication.
10. Held preflight responses with background/account transitions suppress POST,
    preserve the exact original, and allow later current-authority resolution.
11. Reviewed 1100px and 390px layouts, keyboard input, no page exceptions, exactly
    two persisted publications across six POST attempts, and exact SQL cleanup.

All screenshots and logs contain synthetic fixture content and remain private:

- `/private/tmp/pantopus-home-gig-web-ui-r8/` — final result, reviewed screenshots;
  adjacent `.log` includes exact fixture cleanup.
- `/private/tmp/pantopus-home-gig-web-ui-r5/` — earlier extended passing run.
- `/private/tmp/pantopus-home-gig-web-ui-r6.log` and `r7.log` — diagnosed harness
  alert/reload race, followed by exact cleanup; neither is a claimed full pass.
- `/private/tmp/pantopus-home-gig-web-full-final.log` — all 92 existing web suites,
  1,178 checks pass after the API/terminal-state/storage changes.
- `/private/tmp/pantopus-home-gig-web-types-final2.log` — final types pass.
- `/private/tmp/pantopus-home-gig-web-lint-final.log` — zero errors, 14 existing
  `no-explicit-any` warnings in the ordinary Gig composer and CompletionFlow;
  new conversion files are clean.
- `/private/tmp/pantopus-home-gig-http-shared-fixture.log` — refactored real HTTP
  fixture rehearsal pass. Source whitespace check also passes.

Reproduce with a dedicated local database containing the 33 Home migrations and
an owned Next dev server configured for same-origin loopback API, empty analytics
keys, then run:

```sh
node scripts/web/test-home-task-gig-publication.cjs \
  http://127.0.0.1:3109 supabase_db_pantopus-home-gig-replay postgres \
  /private/tmp/pantopus-home-gig-browser-evidence
```

The final driver waits for observable state rather than arbitrary UI sleeps.
The owner's priority is complete actual workflows and visible states; existing
regression gates support this evidence and are not a unit-coverage target.

## Limits and integration

Authentication/profile/session and address-provider responses are synthetic.
All non-loopback browser requests are blocked. Actual current Gig detail data
comes from persisted SQL with synthetic actor enrichment; the fixture does not
certify the production Gig detail serializer or live geo/map/media providers.
Background transitions are deterministically dispatched browser lifecycle events,
not OS process-suspension proof. Reload and competing tabs are real Chrome.
Installed native conversion, physical devices, production identity/provider
integration, helper bidding, payment, completion, durable Gig fanout and the
remaining full ordinary composer options are not completed by this checkpoint.
The [backend report](home-task-gig-publication-2026-09-10.md) records the separate
atomic SQL/race/migration and populated-upgrade evidence and its limits.

Origin was fetched again before this milestone. The preceding backend head
`b08e280d5` passed all backend/web/database checks and all three remote iOS 18.5
jobs, including both synchronization repairs. Android instrumentation passed;
Android lint/test/assemble was still running at this observation. Validate the
new browser commit's exact CI separately. PR #34 remains clean and green at
`e9ef2decb`, but its scope is unfinished. Neither draft can merge yet.

No new migration was added here. Home 33 + paid 21 still yields 42 collision-free
versions, with final combined dependency reconciliation and fresh/populated replay
outstanding. The owner checkout's modified handoff/two untracked designs and the
paid branch remain untouched. The owned local Gig replay database and web server
remain available for the immediate continuation; no owner runtime was stopped.
