@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * H6 — DTOs for the **per-home owner** claim-review surface (distinct
 * from the platform-admin `/api/admin/claims*` queue backing
 * `ui/screens/review_claims/…`). Two different claim collections live
 * behind this screen and must not be conflated:
 *
 *  1. **Ownership claims** — table `HomeOwnershipClaim`, served by
 *     `backend/routes/homeOwnership.js` under
 *     `/api/homes/:id/ownership-claims`.
 *  2. **Residency claims** — table `HomeResidencyClaim`, served by
 *     `backend/routes/home.js` under `/api/homes/:id/claims`.
 *
 * Field-for-field parity with iOS `HomeClaimReviewDTOs.swift`.
 */

// region Ownership claims (HomeOwnershipClaim)

/**
 * One row of `GET /api/homes/:id/ownership-claims`
 * (`backend/routes/homeOwnership.js:490`). The handler masks the
 * claimant — `claimant.masked == true` and only `account_age_days` /
 * `method` / `risk_score` survive, so this list alone can never render
 * a claimant name.
 */
@JsonClass(generateAdapter = true)
data class HomeOwnershipClaimDto(
    val id: String,
    @Json(name = "home_id") val homeId: String? = null,
    @Json(name = "claim_type") val claimType: String? = null,
    val state: String,
    @Json(name = "claim_phase_v2") val claimPhaseV2: String? = null,
    @Json(name = "claim_strength") val claimStrength: String? = null,
    @Json(name = "routing_classification") val routingClassification: String? = null,
    @Json(name = "challenge_state") val challengeState: String? = null,
    @Json(name = "identity_status") val identityStatus: String? = null,
    val method: String? = null,
    @Json(name = "risk_score") val riskScore: Double? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    val claimant: HomeOwnershipClaimMaskedClaimantDto? = null,
    val evidence: List<HomeClaimEvidenceDto>? = null,
)

/** Masked claimant projection built at `homeOwnership.js:513-523`. */
@JsonClass(generateAdapter = true)
data class HomeOwnershipClaimMaskedClaimantDto(
    val masked: Boolean? = null,
    @Json(name = "account_age_days") val accountAgeDays: Int? = null,
    val method: String? = null,
    @Json(name = "risk_score") val riskScore: Double? = null,
)

/** Envelope for `GET /api/homes/:id/ownership-claims`. */
@JsonClass(generateAdapter = true)
data class HomeOwnershipClaimsResponse(
    val claims: List<HomeOwnershipClaimDto> = emptyList(),
)

/**
 * Evidence row joined onto a claim. Selected at
 * `homeOwnership.js:505` (list) and
 * `homeClaimComparisonService.js:69` (compare).
 */
@JsonClass(generateAdapter = true)
data class HomeClaimEvidenceDto(
    val id: String,
    @Json(name = "claim_id") val claimId: String? = null,
    @Json(name = "evidence_type") val evidenceType: String? = null,
    val provider: String? = null,
    val status: String? = null,
    @Json(name = "confidence_level") val confidenceLevel: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

// endregion

// region Comparison (side-by-side)

/**
 * `GET /api/homes/:id/ownership-claims/compare`
 * (`backend/routes/homeOwnership.js:536`) → payload assembled by
 * `backend/services/homeClaimComparisonService.js:113`.
 *
 * The route 404s when the `adminCompare` flag is off — callers treat a
 * failure as "no comparison available".
 */
@JsonClass(generateAdapter = true)
data class HomeClaimComparisonDto(
    @Json(name = "home_id") val homeId: String,
    val home: HomeClaimComparisonHomeDto? = null,
    @Json(name = "household_resolution_state") val householdResolutionState: String? = null,
    val incumbent: HomeClaimComparisonIncumbentDto? = null,
    val claims: List<HomeClaimComparisonClaimDto> = emptyList(),
)

/** Home block (`homeClaimComparisonService.js:115-125`). */
@JsonClass(generateAdapter = true)
data class HomeClaimComparisonHomeDto(
    val id: String,
    val name: String? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipcode: String? = null,
    @Json(name = "security_state") val securityState: String? = null,
    @Json(name = "household_resolution_state") val householdResolutionState: String? = null,
)

/**
 * Incumbent block (`homeClaimComparisonService.js:127-133`) — the
 * verified owners of record the challengers are compared against.
 */
@JsonClass(generateAdapter = true)
data class HomeClaimComparisonIncumbentDto(
    val owners: List<HomeClaimComparisonOwnerDto> = emptyList(),
    @Json(name = "has_verified_owner") val hasVerifiedOwner: Boolean = false,
    @Json(name = "challenge_state") val challengeState: String? = null,
)

/** One verified `HomeOwner` row plus its hydrated user. */
@JsonClass(generateAdapter = true)
data class HomeClaimComparisonOwnerDto(
    val id: String,
    @Json(name = "subject_id") val subjectId: String? = null,
    @Json(name = "owner_status") val ownerStatus: String? = null,
    @Json(name = "is_primary_owner") val isPrimaryOwner: Boolean? = null,
    @Json(name = "verification_tier") val verificationTier: String? = null,
    @Json(name = "added_via") val addedVia: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val user: HomeClaimUserDto? = null,
)

/**
 * One claim in the comparison payload
 * (`homeClaimComparisonService.js:91-111`). Unlike the masked list
 * endpoint this one carries the hydrated claimant.
 */
@JsonClass(generateAdapter = true)
data class HomeClaimComparisonClaimDto(
    val id: String,
    @Json(name = "home_id") val homeId: String? = null,
    @Json(name = "claimant_user_id") val claimantUserId: String? = null,
    val claimant: HomeClaimUserDto? = null,
    @Json(name = "claim_type") val claimType: String? = null,
    val state: String? = null,
    @Json(name = "claim_phase_v2") val claimPhaseV2: String? = null,
    @Json(name = "terminal_reason") val terminalReason: String? = null,
    @Json(name = "challenge_state") val challengeState: String? = null,
    @Json(name = "claim_strength") val claimStrength: String? = null,
    @Json(name = "routing_classification") val routingClassification: String? = null,
    @Json(name = "identity_status") val identityStatus: String? = null,
    @Json(name = "merged_into_claim_id") val mergedIntoClaimId: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    val method: String? = null,
    @Json(name = "risk_score") val riskScore: Double? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    val evidence: List<HomeClaimEvidenceDto>? = null,
)

/** Shared hydrated-user shape used by the comparison payload. */
@JsonClass(generateAdapter = true)
data class HomeClaimUserDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    val email: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

// endregion

// region Ownership-claim mutations

/**
 * Body for `POST /api/homes/:id/ownership-claims/:claimId/review`.
 * Validated by `reviewClaimSchema` (`homeOwnership.js:39`) — `action`
 * ∈ approve | reject | flag, optional `note` ≤ 1000 chars.
 */
@JsonClass(generateAdapter = true)
data class HomeOwnershipClaimReviewRequest(
    val action: String,
    val note: String? = null,
)

/**
 * Body for
 * `POST /api/homes/:id/ownership-claims/:claimId/resolve-relationship`.
 * Validated by `resolveRelationshipSchema` (`homeOwnership.js:54`) —
 * `action` ∈ invite_to_household | decline_relationship |
 * flag_unknown_person.
 */
@JsonClass(generateAdapter = true)
data class HomeOwnershipClaimResolveRelationshipRequest(
    val action: String,
    val note: String? = null,
)

/**
 * Response envelope shared by the review + resolve-relationship
 * handlers. Both return a human-readable `message`.
 */
@JsonClass(generateAdapter = true)
data class HomeOwnershipClaimActionResponse(
    val message: String? = null,
    val action: String? = null,
)

// endregion

// region Residency claims (HomeResidencyClaim)

/**
 * One row of `GET /api/homes/:id/claims`
 * (`backend/routes/home.js:6716`). Unlike ownership claims these are
 * **not** masked — the handler joins the claimant user directly.
 */
@JsonClass(generateAdapter = true)
data class HomeResidencyClaimDto(
    val id: String,
    @Json(name = "home_id") val homeId: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    val status: String,
    @Json(name = "claimed_role") val claimedRole: String? = null,
    @Json(name = "claimed_address") val claimedAddress: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val claimant: HomeResidencyClaimantDto? = null,
)

/** Claimant join selected at `backend/routes/home.js:6731`. */
@JsonClass(generateAdapter = true)
data class HomeResidencyClaimantDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "last_name") val lastName: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    val city: String? = null,
    val state: String? = null,
)

/** Envelope for `GET /api/homes/:id/claims`. */
@JsonClass(generateAdapter = true)
data class HomeResidencyClaimsResponse(
    val claims: List<HomeResidencyClaimDto> = emptyList(),
)

/**
 * Body for `POST /api/homes/:id/claim/:claimId/approve`
 * (`backend/routes/home.js:6756` reads `proposed_role`). Omitted, the
 * role falls back to the claimant's own `claimed_role`.
 */
@JsonClass(generateAdapter = true)
data class HomeResidencyClaimApproveRequest(
    @Json(name = "proposed_role") val proposedRole: String? = null,
)

/**
 * Body for `POST /api/homes/:id/claim/:claimId/reject`
 * (`backend/routes/home.js:6842` reads `reason`).
 */
@JsonClass(generateAdapter = true)
data class HomeResidencyClaimRejectRequest(
    val reason: String? = null,
)

/**
 * Response envelope for both residency-claim mutations —
 * `{ message, occupancy? }` (`home.js:6828` / `home.js:6893`).
 */
@JsonClass(generateAdapter = true)
data class HomeResidencyClaimActionResponse(
    val message: String? = null,
)

// endregion
