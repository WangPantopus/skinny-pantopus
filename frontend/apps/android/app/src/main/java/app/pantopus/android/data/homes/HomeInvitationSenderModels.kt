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
            "This invitation couldn't be read or saved on this device. Reload before starting another."
        HomeInvitationSenderFailureKind.Changed -> "This invitation changed. Reload to see the latest."
        HomeInvitationSenderFailureKind.Unknown ->
            "We couldn't confirm the result. Check again, try again, or discard this attempt."
        HomeInvitationSenderFailureKind.Unavailable -> "Couldn't load the invitation details. Reload to try again."
        HomeInvitationSenderFailureKind.SessionChanged -> "Your sign-in changed. Reload in the account that started this invitation."
        HomeInvitationSenderFailureKind.Busy -> "Wait for your last invitation to finish checking."
    },
)

class HomeInvitationSenderRefusal(code: String?) : IllegalStateException(senderRefusalMessage(code))

fun senderRefusalMessage(code: String?): String =
    when (code) {
        "MEMBERS_MANAGE_REQUIRED" -> "You don't have permission to manage this household's invitations."
        "INVITE_SENDER_CHANGED" -> "The invitation or your permissions changed. Tap Done, then check the details again."
        "INVITE_ALREADY_PENDING" -> "This person already has a pending invitation. You can resend it from Pending in Members."
        "MEMBER_ALREADY_EXISTS" -> "This person is already in the household."
        "MEMBERSHIP_RENEWAL_REQUIRED" -> "This person’s household access is under review, so an invitation can't change it right now."
        "INVITE_ALREADY_USED", "INVITE_NOT_PENDING" -> "This invitation was already answered. Nobody's membership changed."
        "INVITE_EXPIRED" -> "This invitation has expired. Send a new invitation instead."
        "INVITE_NOT_FOUND", "HOME_NOT_FOUND" -> "This invitation is no longer available."
        else -> "This couldn't be completed. Check the invitation and try again."
    }
