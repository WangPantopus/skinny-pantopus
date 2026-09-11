package app.pantopus.android.data.api.models.homes

import app.pantopus.android.data.homes.PendingHomeRelationship
import app.pantopus.android.data.homes.homeTaskUUID
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.time.Instant

internal fun relationshipToken(value: String): Boolean = value.matches(Regex("^[a-f0-9]{64}$"))

enum class HomeRelationshipAction(val title: String, val explanation: String) {
    @Json(name = "decline_relationship")
    Decline(
        "Continue independent review",
        "This records your household response. It does not approve, reject or remove the claim.",
    ),

    @Json(name = "flag_unknown_person")
    Flag(
        "Flag unknown claimant",
        "This requests review of an unknown claimant. Only eligible evidence can establish a qualifying dispute.",
    ),
}

@JsonClass(generateAdapter = true)
data class HomeRelationshipCommand(
    val action: HomeRelationshipAction,
    val note: String,
    @Json(name = "request_id") val requestId: String,
    @Json(name = "review_token") val reviewToken: String,
) {
    fun valid(): Boolean =
        homeTaskUUID(requestId) && requestId == requestId.lowercase() && relationshipToken(reviewToken) &&
            note == note.trim() && note.length <= 1000
}

@JsonClass(generateAdapter = true)
data class HomeRelationshipSession(
    @Json(name = "actor_id") val actorId: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "session_scope") val sessionScope: String,
)

@JsonClass(generateAdapter = true)
data class HomeRelationshipEvidence(
    val id: String,
    @Json(name = "evidence_type") val evidenceType: String,
    @Json(name = "eligible_for_review") val eligibleForReview: Boolean,
)

@JsonClass(generateAdapter = true)
data class HomeRelationshipClaim(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "claimant_user_id") val claimantUserId: String,
    @Json(name = "claim_type") val claimType: String,
    val state: String,
    @Json(name = "terminal_reason") val terminalReason: String,
    @Json(name = "review_token") val reviewToken: String,
    val evidence: List<HomeRelationshipEvidence>,
    @Json(name = "claim_phase_v2") val claimPhase: String? = null,
    @Json(name = "challenge_state") val challengeState: String? = null,
    @Json(name = "merged_into_claim_id") val mergedInto: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
) {
    fun canDecide(actor: String): Boolean {
        if (claimantUserId == actor || mergedInto != null || terminalReason != "none") return false
        if (state in setOf("approved", "rejected", "revoked", "disputed") || challengeState == "challenged") return false
        if (expiresAt != null && (recurrenceDate(expiresAt) ?: Instant.MIN) <= Instant.now()) return false
        return if (claimPhase != null) {
            claimPhase in setOf("initiated", "evidence_submitted", "under_review")
        } else {
            state in setOf("draft", "submitted", "pending_review", "pending_challenge_window", "needs_more_info")
        }
    }
}

@JsonClass(generateAdapter = true)
data class HomeRelationshipReview(
    val claim: HomeRelationshipClaim,
    @Json(name = "relationship_session") val session: HomeRelationshipSession,
) {
    fun matches(
        home: String,
        claimId: String,
        actor: String,
    ): Boolean =
        session.homeId == home && session.actorId == actor && relationshipToken(session.sessionScope) &&
            claim.id == claimId && claim.homeId == home && homeTaskUUID(claim.claimantUserId) &&
            claim.claimType.isNotBlank() && claim.state.isNotBlank() && relationshipToken(claim.reviewToken) &&
            claim.evidence.all { homeTaskUUID(it.id) && it.evidenceType.isNotBlank() } &&
            claim.evidence.map { it.id }.distinct().size == claim.evidence.size
}

@JsonClass(generateAdapter = true)
data class HomeRelationshipOutcome(
    val state: String,
    @Json(name = "qualifies_for_dispute") val qualifiesForDispute: Boolean,
    @Json(name = "claim_phase_v2") val claimPhase: String? = null,
    @Json(name = "routing_classification") val routing: String? = null,
    @Json(name = "challenge_state") val challengeState: String? = null,
    @Json(name = "claim_strength") val claimStrength: String? = null,
)

@JsonClass(generateAdapter = true)
data class HomeRelationshipReceipt(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "claim_id") val claimId: String,
    @Json(name = "actor_id") val actorId: String,
    @Json(name = "request_id") val requestId: String,
    val action: HomeRelationshipAction,
    @Json(name = "legacy_request") val legacyRequest: Boolean,
    @Json(name = "request_hash") val requestHash: String,
    @Json(name = "review_token") val reviewToken: String,
    @Json(name = "created_at") val createdAt: String,
    val result: HomeRelationshipOutcome,
) {
    fun matches(original: PendingHomeRelationship): Boolean =
        homeTaskUUID(id) && homeId == original.scope.homeId && claimId == original.claimId && actorId == original.scope.actorId &&
            requestId == original.command.requestId && action == original.command.action && !legacyRequest &&
            reviewToken == original.command.reviewToken && relationshipToken(requestHash) &&
            recurrenceDate(createdAt) != null && result.state.isNotBlank()
}

@JsonClass(generateAdapter = true)
data class HomeRelationshipCurrentClaim(val id: String, val state: String)

@JsonClass(generateAdapter = true)
data class HomeRelationshipResponse(
    val ok: Boolean,
    val homeId: String,
    val claimId: String,
    val claimantId: String,
    val action: HomeRelationshipAction,
    val replayed: Boolean,
    val receipt: HomeRelationshipReceipt,
    val claim: HomeRelationshipCurrentClaim,
) {
    fun matches(
        original: PendingHomeRelationship,
        claimant: String,
    ): Boolean =
        ok && homeId == original.scope.homeId && claimId == original.claimId && claimantId == claimant &&
            action == original.command.action && claim.id == original.claimId && claim.state.isNotBlank() && receipt.matches(original)
}
