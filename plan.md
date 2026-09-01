# Home Address Validation — Fix All Gaps

## Files to modify
- `backend/services/addressValidation/addressDecisionEngine.js` — core logic changes
- `backend/services/addressValidation/types.js` — new verdict statuses
- `backend/routes/addressValidation.js` — PO Box rejection in Joi schema, claim route updates
- `backend/tests/unit/addressDecisionEngine.test.js` — tests for all new rules

## Fix 1: Fake/non-existent street numbers (user's main complaint)
**Problem:** Enter "4016 Elm St" when only 4014/4020 exist — Google interpolates, Smarty may fuzzy-match, address passes as OK.
**Solution:** In the decision engine, after Google returns, check if the `street_number` component is NOT confirmed (`confirmed: false` in `google.components`). If the street number is unconfirmed AND `hasUnconfirmedComponents` is true, classify as a new status `UNVERIFIED_STREET_NUMBER` with low confidence and `manual_review` action. This catches the exact scenario where Google "guesses" the number.
- New status: `UNVERIFIED_STREET_NUMBER`
- Insert as Rule 3.5 (after MISSING_STREET_NUMBER, before MISSING_UNIT)
- Confidence: 0.2
- Next action: `manual_review`

## Fix 2: PO Box rejection
**Problem:** "PO Box 1234, Portland, OR 97201" passes through with no detection.
**Solution:** Two layers:
1. **Joi schema** — Add regex pattern rejection on `line1` for PO Box variants (PO Box, P.O. Box, Post Office Box, POB, P O Box)
2. **Decision engine** — New status `PO_BOX` as Rule 3.6 (after unverified street number). Check if Google's USPS carrier_route_type starts with 'P' (PO Box route) OR if the normalized line1 matches PO Box patterns.
- New status: `PO_BOX`
- Confidence: 0.0
- Next action: `reject` (hard block, not reviewable)

## Fix 3: Hotels/motels pass as residential
**Problem:** `'lodging'` is in `RESIDENTIAL_PLACE_TYPES`, so hotels pass the residential check.
**Solution:**
- Remove `'lodging'` from `RESIDENTIAL_PLACE_TYPES`
- Add a new `LODGING_PLACE_TYPES` set: `['lodging']`
- In `_isBusiness()`, treat lodging the same as commercial (lodging = not a home)
- A lodging address with no residential corroboration → BUSINESS

## Fix 4: `hasInferredComponents` confidence penalty
**Problem:** Google infers components (guesses city from ZIP) but confidence is never penalized.
**Solution:** In `_computeConfidence()`, add: `if (google?.verdict?.hasInferredComponents) score -= 0.1`

## Fix 5: Vacant addresses too lenient
**Problem:** Vacant lot with no building gets OK status, just lower confidence. But a vacant lot isn't a home.
**Solution:** Upgrade vacant handling: if `smarty.vacant_flag === true` AND `smarty.dpv_match_code !== 'Y'` (no confirmed delivery point), classify as `UNDELIVERABLE` with reason `VACANT_NO_DELIVERY`. If DPV is Y (mail still delivered despite vacant flag), keep as OK with the existing confidence penalty.

## Fix 6: Claim route — handle new statuses
**Problem:** New verdict statuses need to be handled in the claim route's status mapping.
**Solution:** Add `UNVERIFIED_STREET_NUMBER` and `PO_BOX` to the rejection block in the claim route, with appropriate error messages.

## Implementation order
1. Add new statuses to `types.js`
2. Add PO Box regex to Joi schema in routes
3. Implement all new rules in decision engine
4. Update claim route for new statuses
5. Add comprehensive tests for every new rule
6. Run existing + new tests
