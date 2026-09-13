package app.pantopus.android.data.homes

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class HomeInvitationSenderIntent(
    val homeId: String,
    val action: String,
    val payload: Map<String, String?>? = null,
    val invitationId: String? = null,
) {
    fun isValid(): Boolean =
        homeTaskUUID(homeId) &&
            when (action) {
                "create" ->
                    invitationId == null && payload != null && payload.keys.all { it in PAYLOAD_FIELDS } &&
                        payload.values.all { it == null || it.length <= MAX_FIELD_LENGTH } &&
                        listOf("email", "user_id", "username").any { !payload[it].isNullOrBlank() }
                "resend", "withdraw" -> payload == null && homeTaskUUID(invitationId)
                else -> false
            }

    private companion object {
        const val MAX_FIELD_LENGTH = 8000
        val PAYLOAD_FIELDS = setOf("email", "user_id", "username", "relationship", "preset_key", "start_at", "end_at", "message")
    }
}

@JsonClass(generateAdapter = true)
data class HomeInvitationSenderRequest(
    val requestId: String,
    val token: String?,
    val intent: HomeInvitationSenderIntent,
    val decisionToken: String,
) {
    fun isValid(): Boolean =
        homeTaskUUID(requestId) && intent.isValid() && HomeResidencyReviewCodec.reviewHash(decisionToken) &&
            if (intent.action == "withdraw") token == null else HomeResidencyReviewCodec.reviewHash(token)
}

/** Exact submission bytes and the reviewed label stay encrypted until explicit acknowledgement. */
@JsonClass(generateAdapter = true)
data class PendingHomeInvitationSender(
    val scope: HomeCreationScope,
    val request: HomeInvitationSenderRequest,
    val requestJson: String,
    val summary: String,
    val receiptJson: String? = null,
) {
    fun sameIntent(other: PendingHomeInvitationSender): Boolean =
        scope == other.scope && request == other.request && requestJson == other.requestJson && summary == other.summary
}

data class HomeInvitationSenderContext(
    val intent: HomeInvitationSenderIntent,
    val decisionToken: String,
    val summary: String,
    val expiresAt: String? = null,
)

data class HomeInvitationSenderOutcome(
    val state: String,
    val code: String?,
    val invitationId: String?,
    val email: String,
    val inApp: String,
    val receiptJson: String,
) {
    val isTerminal: Boolean get() = state in setOf("completed", "rejected", "cancelled")
}

enum class HomeInvitationSenderRecovery { Check, Retry, Cancel }

enum class HomeInvitationSenderFailureKind { Storage, Changed, Unknown, Unavailable, SessionChanged, Busy }

class HomeInvitationSenderFailure(val kind: HomeInvitationSenderFailureKind) : IllegalStateException(
    when (kind) {
        HomeInvitationSenderFailureKind.Storage ->
            "The protected original could not be read or saved. Keep it and reopen recovery before starting another action."
        HomeInvitationSenderFailureKind.Changed -> "The invitation action changed. Reopen recovery to review the original."
        HomeInvitationSenderFailureKind.Unknown ->
            "The result is not confirmed. Check the original action, retry it, or cancel its unconfirmed attempt."
        HomeInvitationSenderFailureKind.Unavailable -> "Current invitation details could not be checked. Retry before submitting."
        HomeInvitationSenderFailureKind.SessionChanged -> "Your session changed. Reopen invitations in the original account to recover."
        HomeInvitationSenderFailureKind.Busy -> "Wait for the original invitation action to finish being checked."
    },
)

class HomeInvitationSenderRefusal(code: String?) : IllegalStateException(senderRefusalMessage(code))

fun senderRefusalMessage(code: String?): String =
    when (code) {
        "MEMBERS_MANAGE_REQUIRED" -> "You no longer have permission to manage this household’s invitations."
        "INVITE_SENDER_CHANGED" -> "The invitation or your authority changed. Acknowledge this result, then review current details."
        "INVITE_ALREADY_PENDING" -> "This person already has a pending invitation. Review it in Pending before explicitly resending."
        "MEMBER_ALREADY_EXISTS" -> "This person is already a household member. Their existing membership is preserved."
        "INVITE_ALREADY_USED", "INVITE_NOT_PENDING" -> "This invitation is already resolved. Existing membership is preserved."
        "INVITE_EXPIRED" -> "This invitation expired. Resending does not extend its expiry or access dates."
        "INVITE_NOT_FOUND", "HOME_NOT_FOUND" -> "The invitation or household is no longer available for this action."
        else -> "This action was not completed. Review the invitation and current authority before starting another action."
    }
