@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import app.pantopus.android.data.api.models.common.JsonValue
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One row from `GET /api/homes/my-ownership-claims` —
 * `backend/routes/homeOwnership.js:217`. Backend masks the internal
 * state to a generic `status` string for the opaque-handshake contract.
 */
@JsonClass(generateAdapter = true)
data class OwnershipClaimDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "claim_type") val claimType: String,
    val method: String,
    val status: String,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "updated_at") val updatedAt: String,
)

/** Envelope for `GET /api/homes/my-ownership-claims`. */
@JsonClass(generateAdapter = true)
data class MyOwnershipClaimsResponse(
    val claims: List<OwnershipClaimDto>,
)

/**
 * Body for `POST /api/homes/:id/ownership-claims` —
 * `backend/routes/homeOwnership.js:251`. Mirrors `submitClaimSchema`
 * (`backend/routes/homeOwnership.js:33`). Backend rejects extra fields,
 * so the wizard's optional reviewer note is piped through evidence
 * metadata instead.
 */
@JsonClass(generateAdapter = true)
data class SubmitClaimRequest(
    @Json(name = "claim_type") val claimType: String = "owner",
    val method: String,
)

/** Inner claim envelope returned by the submit endpoint. */
@JsonClass(generateAdapter = true)
data class SubmitClaimEnvelope(
    val id: String? = null,
    val status: String,
    /**
     * `routing_classification` decided by `policy.canSubmitOwnerClaim`
     * and echoed at `backend/routes/homeOwnership.js:472`. One of
     * `first_claim` / `parallel_claim` / `challenge_claim` (null on the
     * opaque duplicate path, which returns only `{ id, status }`).
     * Drives the pre-upload warnings and the challenge activation.
     */
    @Json(name = "routing_classification") val routingClassification: String? = null,
    /** `claim_phase_v2` — `initiated` / `challenged` / … */
    @Json(name = "claim_phase_v2") val claimPhaseV2: String? = null,
)

/**
 * `routing_classification` values the backend emits
 * (`backend/services/homeClaimRoutingService.js` via
 * `policy.canSubmitOwnerClaim`).
 */
object ClaimRoutingClassification {
    /** Another person already has a pending claim on this address. */
    const val PARALLEL_CLAIM = "parallel_claim"

    /**
     * The address already has a verified household; a strong document
     * can open a formal challenge.
     */
    const val CHALLENGE_CLAIM = "challenge_claim"
}

/**
 * Body for `POST /api/homes/:id/ownership-claims/:claimId/challenge` —
 * `challengeClaimSchema` (`backend/routes/homeOwnership.js:63`) accepts
 * only an optional `note`.
 */
@JsonClass(generateAdapter = true)
data class ChallengeClaimRequest(
    val note: String? = null,
)

/**
 * Response for the challenge route. The handler answers with a message
 * plus the updated claim block; we only need to know it succeeded, so
 * the payload stays loosely typed.
 */
@JsonClass(generateAdapter = true)
data class ChallengeClaimResponse(
    val message: String? = null,
)

/** Outer envelope for `POST /api/homes/:id/ownership-claims`. */
@JsonClass(generateAdapter = true)
data class SubmitClaimResponse(
    val message: String,
    val claim: SubmitClaimEnvelope,
    @Json(name = "next_step") val nextStep: String? = null,
)

/**
 * Body for `POST /api/homes/:id/ownership-claims/:claimId/evidence`
 * — `backend/routes/homeOwnership.js:886`. Mirrors
 * `uploadEvidenceSchema` (`backend/routes/homeOwnership.js:43`).
 * `storageRef` carries the URL produced by `/api/files/upload`.
 *
 * Note: deliberately NOT annotated with `@JsonClass(generateAdapter)` —
 * the wire format omits `storage_ref` and `metadata` when they are
 * null instead of emitting JSON `null`. See
 * [UploadEvidenceRequestJsonAdapter] for the custom serializer that
 * enforces that.
 */
data class UploadEvidenceRequest(
    val evidenceType: String,
    val provider: String = "manual",
    val storageRef: String? = null,
    val metadata: Map<String, String>? = null,
)

/** Response for the evidence endpoint. Both fields are loosely shaped. */
@JsonClass(generateAdapter = true)
data class UploadEvidenceResponse(
    val evidence: JsonValue,
    @Json(name = "verification_tier") val verificationTier: JsonValue? = null,
)

/** Response for `POST /api/files/upload` — `backend/routes/files.js:781`. */
@JsonClass(generateAdapter = true)
data class FileUploadResponse(
    val message: String,
    val file: FileRef,
) {
    @JsonClass(generateAdapter = true)
    data class FileRef(
        val id: String,
        val url: String,
    )
}
