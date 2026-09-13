# Home onboarding and recovery

Active H07/H08 work after the ordinary-member default and native identity
milestones. This report records reproduced gaps; onboarding is not accepted.

## Actual contract reproduction

The owned, read-only HTTP/SDK baseline executes production `/homes/check-address`
and the create route's Joi validation. A new address returns `HOME_NOT_FOUND`
without `normalized_address` or coordinates. Both native Add Home models clear
their geocoded state and then expect that missing object from this lookup.
Their resulting create payload is rejected with HTTP 400 for missing latitude
and longitude. No database write or provider operation occurs in this proof;
the baseline adapter exposes only reads. Private evidence:
`/private/tmp/pantopus-home-native-onboarding-baseline-r1.log`.

The web wizard already uses `/api/v1/address/validate` before Home lookup and
carries its canonical `address_id`. Native creation currently omits that ID.
The native repair must handle canonical corrections, unit requirements,
unsupported/unavailable verdicts, exact existing-Home selection, address edits
and current-session retirement before offering creation or claim submission.

## Further source findings to reproduce and repair

Creation currently commits the Home before occupancy, ownership claim and
preferences, and treats failures of several required related writes as
non-fatal. The native wizard does not retain an original create command or
recover a lost committed response, and its primary-Home toggle is not bound to
an admission result. Existing-home residency submission also remains R02.
These require actual transaction, duplicate/lost-reply and installed first-use
acceptance. Neither address validation nor a submitted claim verifies residency
or ownership. Preserve private creator Tasks and require current admission for
shared household destinations.

The address lookup itself still treats failed queries as empty results and
does not explicitly constrain every Home query to active Homes. The read-failure gap is reproduced through actual SDK reads in baseline r2.
The local candidate now returns safe retryable HTTP 503 and a subsequent
lookup recovers (`/private/tmp/pantopus-home-native-onboarding-baseline-r3.log`).
Active/archived records and the complete validation/create/join flow still need
acceptance.

The baseline performs no provider activation, hosted mutation, real message or
migration adoption. Paid services remain the final launch bundle.

## Verified lookup milestone

The production lookup now validates each query's result, returns safe typed
retryable HTTP 503 on failed/interrupted/missing/malformed data, limits Home
queries to active rows and sends private/no-store responses. It still grants
no membership and returns no household identities or counts.

Actual HTTP/SDK/SQL acceptance passes 101 real queries: canonical address ID,
hash and legacy normalized-field lookup; claimed/unclaimed Homes; archived
duplicate exclusion and reactivation; twelve read-fault cases with positive
recovery; and exact fixture cleanup. Evidence:
`/private/tmp/pantopus-home-address-lookup-http-r1.log`. The fixture uses its
own ddc237 namespace and never contacts a provider.

All 22 focused existing address checks pass after their mock Homes were updated
to valid UUIDs and active records. Full backend regression passes 317 suites /
5,169 checks, with 16 skips, in 70.874 seconds. Privacy gates pass. Evidence:
`/private/tmp/pantopus-home-onboarding-lookup-focused-r2.log`,
`/private/tmp/pantopus-home-onboarding-lookup-backend-r1.log`, and
`/private/tmp/pantopus-home-onboarding-lookup-privacy-r1.log`. Focused r1 was
launched from the repository root, where its express mock could not resolve
the backend dependency; the corrected backend-directory run passed.

The native search itself is also unfinished: production Add Home models use
`AddHomeSampleData`, current-location/manual actions merely reset state, and
manual fields only enable Continue when matching a sample candidate. Replace
that path with real search, manual entry and location recovery. The complete
creation/admission and native onboarding exit criteria remain open.

## Native entry milestone

The sample-entry/missing-coordinate defects above are repaired in the
[native address-entry milestone](home-native-address-entry-2026-09-11.md). Both
installed clients pass real search/manual/validation, explicit ZIP correction,
missing-unit editing, refusal/retry and background recovery through SDK/SQL.
Device location acquisition, atomic retained creation/admission, primary
eligibility and first-use destinations remain open.
