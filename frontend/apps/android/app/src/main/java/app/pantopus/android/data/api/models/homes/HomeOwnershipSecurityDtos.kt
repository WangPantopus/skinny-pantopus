package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the per-home ownership security POLICY
 * (`GET/PATCH /api/homes/:id/security`, route
 * `backend/routes/homeOwnership.js:1701` + `:1751`).
 *
 * Distinct from [HomePrivacyDto], which drives the 9 client-side privacy
 * toggles on `/api/homes/:id/privacy`.
 *
 * Values are kept as raw strings on the wire and mapped to Kotlin enums
 * in the UI layer, so an unknown server enum degrades instead of
 * throwing during decode.
 */

/** Envelope — `{ security }`. */
@JsonClass(generateAdapter = true)
data class HomeOwnershipSecurityResponse(
    val security: HomeOwnershipSecurityDto,
)

/**
 * The policy block. `claim_window_active` / `owner_count` are only sent
 * by the GET handler — the PATCH echo re-selects the raw columns only,
 * so both stay nullable.
 */
@JsonClass(generateAdapter = true)
data class HomeOwnershipSecurityDto(
    @Json(name = "security_state") val securityState: String? = null,
    @Json(name = "claim_window_ends_at") val claimWindowEndsAt: String? = null,
    @Json(name = "owner_claim_policy") val ownerClaimPolicy: String? = null,
    @Json(name = "member_attach_policy") val memberAttachPolicy: String? = null,
    @Json(name = "privacy_mask_level") val privacyMaskLevel: String? = null,
    @Json(name = "tenure_mode") val tenureMode: String? = null,
    @Json(name = "claim_window_active") val claimWindowActive: Boolean? = null,
    @Json(name = "owner_count") val ownerCount: Int? = null,
)

/**
 * Body for `PATCH /api/homes/:id/security`. All fields optional — Moshi
 * omits nulls, so only the changed policy is sent.
 * Validated by `updateSecuritySchema` (`homeOwnership.js:81`).
 */
@JsonClass(generateAdapter = true)
data class UpdateHomeOwnershipSecurityRequest(
    @Json(name = "owner_claim_policy") val ownerClaimPolicy: String? = null,
    @Json(name = "member_attach_policy") val memberAttachPolicy: String? = null,
    @Json(name = "privacy_mask_level") val privacyMaskLevel: String? = null,
)

/**
 * PATCH response. Three shapes share one decoder:
 *  - applied — `{ message, security }`
 *  - quorum  — `{ message, quorum_action_id, pending: true }` (`:1806`)
 *  - no-op   — `{ message: "No changes", security }`
 */
@JsonClass(generateAdapter = true)
data class UpdateHomeOwnershipSecurityResponse(
    val message: String? = null,
    val security: HomeOwnershipSecurityDto? = null,
    @Json(name = "quorum_action_id") val quorumActionId: String? = null,
    val pending: Boolean? = null,
) {
    /** True when the backend queued the change for owner approval. */
    val requiresOwnerApproval: Boolean get() = pending == true
}
