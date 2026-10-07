package app.pantopus.android.data.homes

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class HomeMemberRemovalIntent(val homeId: String, val targetUserId: String) {
    fun isValid(): Boolean = homeTaskUUID(homeId) && homeTaskUUID(targetUserId)
}

@JsonClass(generateAdapter = true)
data class HomeMemberRemovalRequest(
    val requestId: String,
    val intent: HomeMemberRemovalIntent,
    val occupancyId: String,
    val decisionToken: String,
) {
    fun isValid(): Boolean =
        homeTaskUUID(requestId) && intent.isValid() && homeTaskUUID(occupancyId) &&
            HomeResidencyReviewCodec.reviewHash(decisionToken)
}

/** Exact original bytes and current reviewed labels remain encrypted until explicit acknowledgement. */
@JsonClass(generateAdapter = true)
data class PendingHomeMemberRemoval(
    val scope: HomeCreationScope,
    val request: HomeMemberRemovalRequest,
    val requestJson: String,
    val summary: String,
    val receiptJson: String? = null,
) {
    fun sameIntent(other: PendingHomeMemberRemoval): Boolean =
        scope == other.scope && request == other.request && requestJson == other.requestJson && summary == other.summary
}

data class HomeMemberRemovalContext(
    val intent: HomeMemberRemovalIntent,
    val occupancyId: String,
    val decisionToken: String,
    val summary: String,
)

data class HomeMemberRemovalOutcome(
    val state: String,
    val code: String?,
    val status: Int?,
    val completedAt: String?,
    val receiptJson: String,
) {
    val isTerminal: Boolean get() = state in setOf("completed", "rejected", "cancelled")
}

enum class HomeMemberRemovalRecovery { Check, Retry, Cancel }

enum class HomeMemberRemovalCurrent { Unchecked, Listed, NotListed }

enum class HomeMemberRemovalFailureKind { Storage, Changed, Unknown, Unavailable, SessionChanged, Busy }

class HomeMemberRemovalFailure(val kind: HomeMemberRemovalFailureKind) : IllegalStateException(
    when (kind) {
        HomeMemberRemovalFailureKind.Storage ->
            "This removal couldn't be read or saved on this device. Reload before starting another."
        HomeMemberRemovalFailureKind.Changed -> "The member or Home changed. Reload to see the latest."
        HomeMemberRemovalFailureKind.Unknown ->
            "We couldn't confirm the result. Check again, try again, or discard this attempt."
        HomeMemberRemovalFailureKind.Unavailable -> "Couldn't load the member list. Reload to try again."
        HomeMemberRemovalFailureKind.SessionChanged -> "Your sign-in changed. Reload in the account that started this."
        HomeMemberRemovalFailureKind.Busy -> "This removal is already being checked. Try again when it finishes."
    },
)

class HomeMemberRemovalRefusal(
    val code: String?,
) : IllegalStateException(memberRemovalRefusalMessage(code))

fun memberRemovalRefusalMessage(code: String?): String =
    when (code) {
        "MEMBERS_MANAGE_REQUIRED", "TARGET_RANK_FORBIDDEN" -> "You don't have permission to remove this member."
        "MEMBER_REMOVAL_CHANGED" -> "The member or Home changed, so nobody was removed. Check the details again."
        "MEMBER_ALREADY_REMOVED" -> "This person is no longer a member."
        "TRANSFER_REQUIRED" -> "Transfer this Home's ownership before leaving."
        "OWNERSHIP_FLOW_REQUIRED" -> "Owners can't be removed here. Ownership changes go through Owners."
        "MEMBER_ROLE_UNKNOWN" -> "Couldn't check this member's role. Reload to try again."
        "MEMBER_NOT_FOUND", "HOME_NOT_FOUND" -> "This member or Home is no longer available."
        else -> "This couldn't be completed. Check the details and try again."
    }
