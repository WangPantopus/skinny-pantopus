package app.pantopus.android.data.homes

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class HomeResidencyReviewScope(val origin: String, val actorId: String, val homeId: String) {
    fun isValid(): Boolean = HomeCreationScope(origin, actorId).isValid() && homeTaskUUID(homeId)
}

@JsonClass(generateAdapter = false)
enum class HomeResidencyDecision(val wire: String, val title: String) {
    Approve("approve", "Approve"),
    Reject("reject", "Reject"),
}

enum class HomeResidencyReviewRole(val wire: String, val title: String) {
    Member("member", "Member"),
    LeaseResident("lease_resident", "Lease resident"),
    RestrictedMember("restricted_member", "Restricted member"),
    Guest("guest", "Guest"),
    ServiceProvider("service_provider", "Service provider"),
}

/** Only the exact original and projected historical proof enter encrypted storage. */
@JsonClass(generateAdapter = true)
data class PendingHomeResidencyReview(
    val scope: HomeResidencyReviewScope,
    val claimId: String,
    val requestId: String,
    val action: HomeResidencyDecision,
    val requestJson: String,
    val receiptJson: String? = null,
) {
    fun sameIntent(other: PendingHomeResidencyReview): Boolean =
        scope == other.scope && claimId == other.claimId && requestId == other.requestId &&
            action == other.action && requestJson == other.requestJson
}

/** Ephemeral, fully validated current data. It is never serialized into the saved original. */
data class HomeResidencyCurrentReview(
    val homeId: String,
    val actorId: String,
    val sessionScope: String,
    val claim: Map<String, Any?>,
    val occupancy: Map<String, Any?>?,
) {
    val claimId: String get() = claim["id"] as String
    val applicantId: String get() = claim["user_id"] as String
    val reviewToken: String get() = claim["review_token"] as String
    val status: String get() = claim["status"] as String

    fun canDecide(actor: String): Boolean = status == "pending" && applicantId != actor
}

enum class HomeResidencyReviewFailureKind { Storage, Changed, Busy, Unknown, Unavailable, SessionChanged, Refused }

class HomeResidencyReviewFailure(val kind: HomeResidencyReviewFailureKind, code: String? = null) : IllegalStateException(
    when (kind) {
        HomeResidencyReviewFailureKind.Storage ->
            "Your last decision couldn’t be read or saved on this device. Try again before choosing another."
        HomeResidencyReviewFailureKind.Changed -> "Your saved decision or account changed. Open the review again to finish it."
        HomeResidencyReviewFailureKind.Busy -> "Your last decision is still being checked. Try again in a moment."
        HomeResidencyReviewFailureKind.Unknown -> "We couldn’t confirm your decision. Try again; it won’t be applied twice."
        HomeResidencyReviewFailureKind.Unavailable -> "Couldn’t load this request. Reload to try again."
        HomeResidencyReviewFailureKind.SessionChanged ->
            "Your account changed. Close this and open it again to continue."
        HomeResidencyReviewFailureKind.Refused ->
            if (code == "MEMBERSHIP_RENEWAL_REQUIRED") {
                "This person’s household membership has ended, so this claim can’t be approved. " +
                    "Reject it, then invite them again from Members."
            } else {
                "Your decision couldn’t be applied because the request or their access changed. Review it again."
            }
    },
)
