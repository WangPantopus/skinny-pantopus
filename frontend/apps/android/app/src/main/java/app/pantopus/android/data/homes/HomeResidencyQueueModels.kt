package app.pantopus.android.data.homes

import app.pantopus.android.core.identity.MadeUpUsername

data class HomeResidencyQueueSession(val actorId: String, val sessionScope: String)

/** A person's name worth showing: not blank and never a made-up username. */
internal fun householdPersonName(value: String?): String? = value?.trim()?.takeIf { it.isNotEmpty() && !MadeUpUsername.isMadeUp(it) }

data class HomeResidencyQueueClaim(
    val id: String,
    val userId: String,
    val username: String?,
    val claimedRole: String?,
    val createdAt: String?,
    /** The name the applicant shows neighbors, when the server sent it. */
    val displayName: String? = null,
) {
    // The name first; a made-up username (user_…) says nothing about the applicant, so it reads as "Applicant".
    val applicantLabel: String get() =
        householdPersonName(displayName)
            ?: MadeUpUsername.handle(username)
            ?: if (username.isNullOrEmpty()) "Applicant identity unavailable" else "Applicant"
    val initials: String get() =
        (householdPersonName(displayName) ?: MadeUpUsername.chosen(username))?.firstOrNull()?.uppercase() ?: "?"
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
