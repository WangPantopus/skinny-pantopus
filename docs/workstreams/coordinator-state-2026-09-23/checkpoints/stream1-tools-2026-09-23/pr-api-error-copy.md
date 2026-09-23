UX inventory item S1-21.

**Problem.** These routes answered any failure with `err.message`:
- the listing-offer routes: create, counter, accept, decline, withdraw and complete;
- `POST /api/gigs/:gigId/confirm-completion` and its `/complete` alias.

So when a database write failed, the database's error text reached the apps. The offer service rethrows its insert error as is. Web shows server messages verbatim, and iOS shows 4xx text.

**Reproduced** with the real routers on the retained stack (master's route files), using the harness's write fault on the `ListingOffer` insert:
- A new offer returned `500 {"error":"fixture: database write unavailable"}`.
- That is the database-layer message, passed through as is.

**Change:**
- Errors the services raise on purpose carry a status:
  - every listing-offer refusal sets `err.status`;
  - every completion refusal sets `statusCode`.

  Those keep their message.
- Any other error gets the route's fixed copy: "Failed to create offer", "Failed to counter offer", …, "Failed to confirm completion". This matches what `mark-completed` already does.
- The full error is still logged.

**Verified** (same routers with this commit, patch-id equal):
- The same fault now returns `500 {"error":"Failed to create offer"}`.
- A business refusal keeps its text: `409 {"error":"You already have an active offer on this listing"}`.
- Neither run wrote an offer.

**Checks:**
- `tests/unit/paidGigLifecycleRoute.test.js` and `tests/fullPaymentLifecycle.test.js` pass (255 tests).
- `pnpm run test:privacy` passes.
- No test covered the offer routes' 500 copy, and none was added.

**Limit:** the confirm-completion change is covered by code and those suites, not a live fault run. A live run needs a completion review hash for a fixture task.

Evidence: `.pantopus-recovery/audits/20260923-stream1-api-error-copy-r1/`, MANIFEST `d9dc833179ccbda72e736e021983dac0be95458cc12350a5ed0a976426671a20`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
