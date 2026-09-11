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
