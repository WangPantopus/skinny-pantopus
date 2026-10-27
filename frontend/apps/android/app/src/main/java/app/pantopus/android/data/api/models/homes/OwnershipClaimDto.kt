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
    // Nullable in `HomeOwnershipClaim`: real submissions always set it, but
    // older rows may not, and one such row must not fail the whole list.
    val method: String? = null,
    val status: String,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "updated_at") val updatedAt: String,
    /** The address the person claimed (their own entry), when the server sends it. */
    val home: ClaimedHome? = null,
    /** Whether any documents are attached; null when the server didn't say. */
    @Json(name = "has_evidence") val hasEvidence: Boolean? = null,
    /** What a claim in review still needs before it can be approved; null otherwise. */
    val approval: ClaimApprovalProgressDto? = null,
) {
    /** Still in review: the server shows every open claim as `under_review`. */
    val isInReview: Boolean
        get() = status == "under_review"

    /** The claimed Home's address lines. */
    @JsonClass(generateAdapter = true)
    data class ClaimedHome(
        val address: String? = null,
        val address2: String? = null,
        val city: String? = null,
        val state: String? = null,
    ) {
        /** "901 C Street Unit 4, Vancouver", or null without a street. */
        val label: String?
            get() {
                val street = street ?: return null
                val town = city?.trim().orEmpty()
                return if (town.isEmpty()) street else "$street, $town"
            }

        /** "901 C Street Unit 4", or null without a street. */
        val street: String?
            get() = listOfNotNull(address, address2).map { it.trim() }.filter { it.isNotEmpty() }.joinToString(" ").ifEmpty { null }

        /** "Vancouver, WA", or null when neither is known. */
        val locality: String?
            get() = listOfNotNull(city, state).map { it.trim() }.filter { it.isNotEmpty() }.joinToString(", ").ifEmpty { null }
    }
}

/**
 * The claimant's approval checklist: approval needs a confirmed identity (a Stripe
 * Identity check) and a document a reviewer checked. Mirrors iOS
 * `ClaimApprovalProgressDTO` and the web `ClaimApprovalProgress`.
 */
@JsonClass(generateAdapter = true)
data class ClaimApprovalProgressDto(
    /** `not_started` · `started` · `processing` · `requires_input` · `verified`. */
    val identity: String,
    /** False while identity checks aren't set up; the claimant can't start one yet. */
    @Json(name = "identity_check_available") val identityCheckAvailable: Boolean,
    /** `missing` · `pending` (waiting for a reviewer) · `verified`. */
    val proof: String,
)

/** Body for `POST …/identity-check`: the platform picks where Stripe sends them back. */
@JsonClass(generateAdapter = true)
data class ClaimIdentityCheckRequest(val platform: String = "android")

/** Reply to `POST …/identity-check`: Stripe's single-use page, or none when the check is already with Stripe. */
@JsonClass(generateAdapter = true)
data class ClaimIdentityCheckStartResponse(
    @Json(name = "verification_url") val verificationUrl: String? = null,
)

/** Reply to `GET …/identity-check`. */
@JsonClass(generateAdapter = true)
data class ClaimIdentityCheckResponse(val approval: ClaimApprovalProgressDto? = null)

/** Envelope for `GET /api/homes/my-ownership-claims`. */
@JsonClass(generateAdapter = true)
data class MyOwnershipClaimsResponse(
    val claims: List<OwnershipClaimDto>,
    @Json(name = "upload_session") val uploadSession: HomeClaimUploadSessionDto? = null,
)

@JsonClass(generateAdapter = true)
data class HomeClaimUploadSessionDto(
    @Json(name = "actor_id") val actorId: String,
    @Json(name = "session_scope") val sessionScope: String,
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
