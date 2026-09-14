package app.pantopus.android.data.homes

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class HomeResidencyReviewScope(val origin: String, val actorId: String, val homeId: String) {
    fun isValid(): Boolean = HomeCreationScope(origin, actorId).isValid() && homeTaskUUID(homeId)
}

@JsonClass(generateAdapter = false)
enum class HomeResidencyDecision(val wire: String, val title: String) {
    Approve("approve", "Approve residency"),
    Reject("reject", "Reject residency"),
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

class HomeResidencyReviewFailure(val kind: HomeResidencyReviewFailureKind) : IllegalStateException(
    when (kind) {
        HomeResidencyReviewFailureKind.Storage ->
            "Your original residency decision could not be read or saved. Retry recovery before choosing another decision."
        HomeResidencyReviewFailureKind.Changed -> "The saved decision or session changed. Reopen residency review to recover the original."
        HomeResidencyReviewFailureKind.Busy -> "Your original decision is still being checked. Try again shortly."
        HomeResidencyReviewFailureKind.Unknown -> "The decision is not confirmed. Retry the saved original to check its result."
        HomeResidencyReviewFailureKind.Unavailable -> "Current residency access could not be verified. Reload to check again."
        HomeResidencyReviewFailureKind.SessionChanged ->
            "Your session changed. Reopen residency review to check access and recover the original."
        HomeResidencyReviewFailureKind.Refused ->
            "The saved decision could not be applied to the current claim and membership limits. Review the current claim again."
    },
)
