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
            "The protected removal could not be read or saved. Keep it and reopen recovery before starting another removal."
        HomeMemberRemovalFailureKind.Changed -> "The removal changed. Reopen recovery to review the saved original."
        HomeMemberRemovalFailureKind.Unknown ->
            "The removal result is not confirmed. Check the original, retry it, or cancel its unconfirmed attempt."
        HomeMemberRemovalFailureKind.Unavailable -> "Current membership could not be checked. Retry before reviewing a new removal."
        HomeMemberRemovalFailureKind.SessionChanged -> "Your session changed. Reopen removal recovery in the original account."
        HomeMemberRemovalFailureKind.Busy -> "Wait for the saved removal to finish being checked."
    },
)

class HomeMemberRemovalRefusal(code: String?) : IllegalStateException(memberRemovalRefusalMessage(code))

fun memberRemovalRefusalMessage(code: String?): String =
    when (code) {
        "MEMBERS_MANAGE_REQUIRED", "TARGET_RANK_FORBIDDEN" -> "Your current household authority does not allow this removal."
        "MEMBER_REMOVAL_CHANGED" -> "The reviewed member or household changed. Keep this result, then review current details."
        "MEMBER_ALREADY_REMOVED" -> "There is no current household removal to perform for this member."
        "TRANSFER_REQUIRED" -> "Transfer primary ownership before leaving this household."
        "OWNERSHIP_FLOW_REQUIRED" -> "This person’s ownership must be resolved through the ownership process."
        "MEMBER_ROLE_UNKNOWN" -> "This member’s current role could not be confirmed."
        "MEMBER_NOT_FOUND", "HOME_NOT_FOUND" -> "The member or household is no longer available for this removal."
        else -> "This removal was not completed. Review current membership and authority before starting another removal."
    }
