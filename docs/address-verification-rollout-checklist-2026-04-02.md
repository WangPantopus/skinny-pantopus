# Address Verification Rollout Checklist

Source of truth: [home-address-verification-design-2026-04-02.md](/Users/yingpengwang/pantopus/docs/home-address-verification-design-2026-04-02.md)

## Prerequisites

- Backend migrations applied through:
  - `070_address_verification_mail.sql`
  - `102_home_address_place_provider_shadow.sql`
  - `103_home_address_place_provider_types_shadow.sql`
  - `104_home_address_secondary_provider_shadow.sql`
  - `105_home_address_parcel_provider_shadow.sql`
  - `106_address_verification_event.sql`
- Supabase migrations applied through:
  - `20260227000008_address_verification_mail.sql`
  - `20260402000001_home_address_place_provider_shadow.sql`
  - `20260402000002_home_address_place_provider_types_shadow.sql`
  - `20260402000003_home_address_secondary_provider_shadow.sql`
  - `20260402000004_home_address_parcel_provider_shadow.sql`
  - `20260402000005_address_verification_event.sql`
- Both migration tracks are required where this repo still uses both deployment paths:
  - backend SQL migrations for the server-owned schema path
  - matching Supabase migrations for environments bootstrapped from the Supabase migration history
  - do not assume applying only one track is sufficient
- Web Add Home parity is already live: `validate -> check-address -> createHome`
- Backend/frontend mail-verification contract is already aligned
- Outage fallback tightening is already deployed and green
- Infra/runbooks are updated before any non-default flag enablement:
  - `GOOGLE_PLACES_API_KEY` is staged in each target environment, or the team has explicitly chosen to rely on `GOOGLE_ADDRESS_VALIDATION_API_KEY` as the fallback source
  - `ATTOM_API_KEY` is staged before any parcel-provider rollout using `ADDRESS_PARCEL_PROVIDER=attom`
  - the corresponding `ENABLE_*` flags remain `false` until those secrets are present and verified in staging

## Flags And Env

Observability:

- `ENABLE_ADDRESS_VERIFICATION_EVENTS=true`
- `ENABLE_ADDRESS_VERIFICATION_METRICS=true`

Provider fetch / shadow flags:

- `ENABLE_ADDRESS_PLACE_PROVIDER=false`
- `ENABLE_ADDRESS_SECONDARY_PROVIDER=false`
- `ENABLE_ADDRESS_PARCEL_PROVIDER=false`

Provider enforcement flags:

- `ENABLE_ADDRESS_PLACE_PROVIDER_BUSINESS_ENFORCEMENT=false`
- `ENABLE_ADDRESS_PARCEL_PROVIDER_CLASSIFICATION_ENFORCEMENT=false`
- `ENFORCE_MIXED_USE_STEP_UP=false`
- `ENFORCE_LOW_CONFIDENCE_STEP_UP=false`

Provider credentials:

- `GOOGLE_ADDRESS_VALIDATION_API_KEY`
- `GOOGLE_PLACES_API_KEY` or fallback to `GOOGLE_ADDRESS_VALIDATION_API_KEY`
  - not required for a normal deploy while `ENABLE_ADDRESS_PLACE_PROVIDER=false`
  - required in runtime env before enabling any place-provider shadow or enforcement flag in staging/prod
- `SMARTY_AUTH_ID`
- `SMARTY_AUTH_TOKEN`
- `ATTOM_API_KEY` when `ADDRESS_PARCEL_PROVIDER=attom`
  - not required for a normal deploy while `ENABLE_ADDRESS_PARCEL_PROVIDER=false`
  - required in runtime env before enabling parcel shadow or parcel enforcement
- `LOB_API_KEY`

Operational tuning:

- `ADDRESS_PLACE_PROVIDER_TIMEOUT_MS`
- `ADDRESS_SECONDARY_PROVIDER_TIMEOUT_MS`
- `ADDRESS_PARCEL_PROVIDER_TIMEOUT_MS`
- `ADDRESS_PARCEL_CACHE_DAYS`
- `ENABLE_SAFE_ADDRESS_OUTAGE_FALLBACK`
- `ADDRESS_OUTAGE_FALLBACK_MAX_AGE_DAYS`
- `ADDRESS_OUTAGE_FALLBACK_MIN_CONFIDENCE`
- `ADDRESS_STEP_UP_MAX_AGE_DAYS`

## Rollout Order

1. Deploy migrations with all new runtime flags still at their defaults.
2. Confirm `AddressVerificationEvent` writes are succeeding in staging.
3. Enable only observability:
   - `ENABLE_ADDRESS_VERIFICATION_EVENTS=true`
   - `ENABLE_ADDRESS_VERIFICATION_METRICS=true`
4. Verify healthy baseline with no shadow providers enabled.
5. Enable place shadow only:
   - `ENABLE_ADDRESS_PLACE_PROVIDER=true`
   - confirm `GOOGLE_PLACES_API_KEY` or the Google validation-key fallback is present in runtime env first
6. Review place disagreement and provider-health data before any place enforcement.
7. Enable secondary shadow only:
   - `ENABLE_ADDRESS_SECONDARY_PROVIDER=true`
8. Review missing-unit shadow fallout before any unit strengthening.
9. Enable parcel shadow only:
   - `ENABLE_ADDRESS_PARCEL_PROVIDER=true`
   - confirm `ADDRESS_PARCEL_PROVIDER` and `ATTOM_API_KEY` are present in runtime env first
10. Review parcel disagreement and cache hit data before parcel enforcement.
11. Enable provider-backed enforcement flags one at a time only after shadow data is stable:
   - place business/institution enforcement
   - parcel classification enforcement
   - mixed-use step-up
   - selected low-confidence step-up

## Shadow-Mode Checks

Inspect `AddressVerificationEvent` and structured logs for:

- `event_type = provider_call`
- `event_type = shadow_comparison`
- `event_type = validation_outcome`
- `event_type = create_home_outcome`

Expected healthy patterns:

- place / secondary / parcel providers show low `status=error`
- cached providers show non-zero `from_cache=true` events where expected
- shadow disagreements are explainable and clustered in expected categories
- `create_home_outcome` volume lines up with product traffic and does not spike unexpectedly after flag changes

## Dashboards / Logs To Inspect

Product funnel:

- `address_verification_verdicts_total`
- `address_verification_verdict_reasons_total`
- `address_verification_create_home_outcomes_total`

Provider health:

- `address_verification_provider_calls_total`
- `address_verification_provider_errors_total`
- `address_verification_provider_latency_ms`
- `address_verification_cache_total`

Shadow rollout quality:

- `address_verification_shadow_comparisons_total`
- `addressValidation.placeProviderShadowComparison`
- `addressValidation.parcelProviderShadowComparison`
- `addressValidation.pipelineVerdict`
- `addressValidation.createHomeOutcome`

## Abort / Rollback Triggers

Rollback the newest flag immediately if any of these happen after enablement:

- sudden spike in `BUSINESS`, `MISSING_UNIT`, `MIXED_USE`, or `LOW_CONFIDENCE`
- create-home success rate drops materially for previously healthy residential traffic
- provider error rate or latency jumps and creates fallout beyond safe cached fallback
- shadow disagreement rate is materially higher than staging expectations
- `AddressVerificationEvent` write failures spike after deploy

Rollback order:

1. turn off the newest enforcement flag
2. if still unstable, turn off the corresponding shadow provider flag
3. leave observability on if possible so postmortem data keeps flowing

## Known Deferred Gaps

- no false-positive appeal / override instrumentation yet
- no manual-review queue instrumentation yet
- hotel / lodging remains classification-only in the ground-truth corpus
- parcel disagreement analytics still depend on compact summaries, not full parcel records
- no user-facing dashboard exists yet; metrics are exposed through `/api/health/metrics` and structured logs only
