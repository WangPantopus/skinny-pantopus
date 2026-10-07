package app.pantopus.android.data.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.time.Instant

private const val MAX_INVITATION_TOKEN_LENGTH = 512

@JsonClass(generateAdapter = true)
data class HomeInvitationDecisionRequest(
    @Json(name = "request_id") val requestId: String,
    val token: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "invitation_id") val invitationId: String,
    val action: String,
    @Json(name = "decision_token") val decisionToken: String,
) {
    fun isValid(): Boolean =
        listOf(requestId, homeId, invitationId).all(::homeTaskUUID) &&
            token.isNotBlank() && token.length <= MAX_INVITATION_TOKEN_LENGTH && action in setOf("accept", "decline") &&
            HomeResidencyReviewCodec.reviewHash(decisionToken)
}

/** Only the frozen original and allowlisted historical proof enter protected storage. */
@JsonClass(generateAdapter = true)
data class PendingHomeInvitationDecision(
    val scope: HomeCreationScope,
    val homeLabel: String,
    val request: HomeInvitationDecisionRequest,
    val receiptJson: String? = null,
) {
    fun sameIntent(other: PendingHomeInvitationDecision): Boolean =
        scope == other.scope && homeLabel == other.homeLabel && request == other.request
}

data class HomeInvitationDecisionContext(
    val homeId: String,
    val invitationId: String,
    val decisionToken: String,
    val homeLabel: String,
    val city: String,
    val inviter: String,
    val role: String,
    val accessStart: String?,
    val accessEnd: String?,
    val expiresAt: String?,
) {
    fun isFresh(): Boolean = expiresAt == null || runCatching { Instant.parse(expiresAt).isAfter(Instant.now()) }.getOrDefault(false)
}

data class HomeInvitationDecisionOutcome(val state: String, val code: String?, val receiptJson: String) {
    val isTerminal: Boolean get() = state in setOf("completed", "rejected", "cancelled")
}

enum class HomeInvitationRecoveryAction { Check, Retry, Cancel }

enum class HomeInvitationFailureKind { Storage, Changed, Unknown, Unavailable, SessionChanged, Busy }

class HomeInvitationFailure(val kind: HomeInvitationFailureKind) : IllegalStateException(
    when (kind) {
        HomeInvitationFailureKind.Storage ->
            "Your answer couldn't be read or saved on this device. Reload before answering again."
        HomeInvitationFailureKind.Changed -> "This invitation changed. Reload to see the latest."
        HomeInvitationFailureKind.Unknown ->
            "We couldn't confirm your answer. Check again, try again, or discard this attempt."
        HomeInvitationFailureKind.Unavailable -> "Couldn't check the invitation right now. Reload to try again."
        HomeInvitationFailureKind.SessionChanged -> "Your sign-in changed. Reload the invitation to check your answer."
        HomeInvitationFailureKind.Busy -> "Wait for your last answer to finish checking."
    },
)

class HomeInvitationRefusal(code: String?) : IllegalStateException(invitationRefusalMessage(code))

fun invitationRefusalMessage(code: String?): String =
    when (code) {
        "INVITE_EMAIL_MISMATCH" -> "This invitation belongs to a different account. Sign in to the account the sender invited."
        "INVITE_DECISION_CHANGED" ->
            "The invitation details changed. Review it again before answering."
        "INVITE_EXPIRED" -> "This invitation expired. Ask the household for a new invitation."
        "INVITE_ALREADY_USED" -> "This invitation was already accepted, declined or withdrawn. My Homes shows your current access."
        "INVITE_NOT_FOUND", "INVITE_INVALID" -> "This invitation is unavailable. Check the complete link with the sender."
        "INVITER_ACCESS_CHANGED" -> "The sender can no longer grant this access. Ask the household for a new invitation."
        "OWNERSHIP_FLOW_REQUIRED" -> "Use the separate ownership flow for this invitation."
        "INVITE_POLICY_CHANGED" -> "The household permissions changed. Ask for a new invitation."
        "MEMBERSHIP_RENEWAL_REQUIRED" ->
            "This invitation can't restore your earlier household access. " +
                "Ask someone in the household to send an invitation to you."
        else -> "The decision could not continue. Review the invitation and current account before starting again."
    }
