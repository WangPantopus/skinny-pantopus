package app.pantopus.android.data.homes

data class HomeResidencyQueueSession(val actorId: String, val sessionScope: String)

data class HomeResidencyQueueClaim(
    val id: String,
    val userId: String,
    val username: String?,
    val claimedRole: String?,
    val createdAt: String?,
) {
    val applicantLabel: String get() = username?.takeIf { it.isNotEmpty() }?.let { "@$it" } ?: "Applicant identity unavailable"
    val roleLabel: String get() =
        when (claimedRole) {
            "household" -> "Requesting: Household"
            "renter" -> "Requesting: Renter"
            else -> "Requested relationship unspecified"
        }
    val dateLabel: String get() = createdAt?.let { "Requested ${it.take(DATE_LENGTH)} (UTC)" } ?: "Date unavailable"

    private companion object {
        const val DATE_LENGTH = 10
    }
}

data class HomeResidencyQueuePage(val claims: List<HomeResidencyQueueClaim>)

enum class HomeResidencyQueueFailureKind(val message: String) {
    Unavailable("Current residency claims could not be loaded. Reload to check access."),
    SessionChanged("Your session changed. Reopen this Home to check current residency claims."),
    Forbidden("Your current household permissions do not allow reviewing residency claims."),
    MissingHome("Current residency claims are not available for your account in this Home."),
}

class HomeResidencyQueueFailure(val kind: HomeResidencyQueueFailureKind) : Exception(kind.message)
