# Combined applicant and reviewer residency baseline

September 13, 2026. Actual HTTP/SDK/SQL and Chrome acceptance binds the current
Home source at `1a475708468c1f7e46583c476301f3a106117d77`. This baseline adds no
product or migration change. It establishes the combined lifecycle before the
separate reviewer-history candidate is integrated.

The HTTP journey passes ten groups and 128 requests. An unadmitted applicant
selects an address through the actual address pipeline, submits a protected
household request, receives a rejection, resubmits, and receives approval from
a different reviewer. Resubmission reuses the current claim ID while preserving
the original submission and rejection receipts. Explicit replay of an earlier
decision does not decide the later submission. Approval grants ordinary-member
access; actual protected removal ends access while preserving the verified claim
and earlier decisions. A fresh address-reviewed submission refuses ended
membership with `MEMBERSHIP_RENEWAL_REQUIRED`; no renewal is forced or claimed.

Two independent reviewers with different command UUIDs queue behind observed
database locks. Approval-first and rejection-first each record one terminal
decision; the other command receives `CLAIM_NOT_PENDING` and cannot overwrite
it. A separate reviewer's existing finite access window expires during an
observed SQL wait. Both the delayed decision and later recovery of an older
receipt then require current authority and refuse without changing the claim
or receipts. This is elapsed-time proof, not a substituted permission revocation.

Chrome at 390 pixels independently passes normal controlled sign-in, address
entry, submission, rejection, acknowledgement, visible resubmission, independent
approval, acknowledgement, Home entry, protected removal and cold applicant
return. Both reviewer originals are cleared only through acknowledgement. The
same current claim and two immutable receipts remain. After removal, the saved
request still says “Review recorded,” while current access says “Household access
needs review” and offers no Home entry. No browser errors occurred.

Two open issues are now observed rather than inferred solely from source:

- After acknowledgement, the review recovery screen is empty and offers no
  supported history of the reviewer's earlier decisions. The isolated history
  candidate must supply separately authorized own-review list/detail reads.
- The current shared claims queue displays a raw account name. Its actual
  response also includes first/last names, city/state, broad claim fields such
  as coordinates, review notes and postcard references, and no explicit
  `Cache-Control`. The history candidate does not repair this existing queue.
  Browser request routing disables caching, so this does not prove the browser
  actually stored a cached response.

Both fresh fixtures restore all five preservation checks: complete rows and
logical schema, roles, ledger, and function properties across 374 candidate and
366 retained tables. Owned servers and Chrome are stopped; the candidate database
and browser profile remain retained. The first HTTP invocation ran before its
fixture existed, received no HTTP responses and made no domain changes; its
failed evidence is preserved separately from the successful second invocation.

Authentication, descriptive public-profile lookup, address providers and notice
delivery remain controlled boundaries. Actual Home routes, services, SDK and SQL
handle the lifecycle. This is not live provider delivery, ownership acquisition,
native combined-cycle acceptance, renewal, household needs-more-information,
hosted adoption or release-wide acceptance. The development browser includes its
development indicator; production-package UI remains a separate release check.

Private evidence is indexed under `pantopus-home-residency-cycle-r1`, including
the HTTP results and observed locks, browser images/responses, both exact cleanups
and independent root verification. The verified durable copy is under the private
handoff's `residency-cycle-20260913/baseline-r1/INDEX.md`: 428 files,
126,303,072 logical bytes, manifest SHA-256
`43a99429e50b1f6503c0179445ac0d85fa69f466bd380514d858d539fd2c4ae0`.
Raw originals and operator logs remain out of Git. R03 remains open; no additional
acceptance row is closed.
