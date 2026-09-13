package app.pantopus.android.data.homes

/** Read-only projections. No original command, reason, token or capability is retained. */
data class HomeResidencyHistorySession(val actorId: String, val sessionScope: String)

data class HomeResidencyHistoryReference(val homeId: String, val actorId: String, val receiptId: String)

data class HomeResidencyHistoryApplicant(val id: String, val username: String?)

data class HomeResidencyHistoryItem(
    val id: String,
    val homeId: String,
    val claimId: String,
    val actorId: String,
    val action: String,
    val createdAt: String,
    val legacyRequest: Boolean,
    val status: String,
    val reviewedAt: String,
    val occupancyId: String?,
    val roleBase: String?,
    val currentClaimStatus: String,
    val currentApplicant: HomeResidencyHistoryApplicant?,
) {
    val reference get() = HomeResidencyHistoryReference(homeId, actorId, id)
}

data class HomeResidencyHistoryCursor(val encoded: String, val createdAt: String, val id: String)

data class HomeResidencyHistoryPage(val items: List<HomeResidencyHistoryItem>, val nextCursor: HomeResidencyHistoryCursor?)

enum class HomeResidencyHistoryFailureKind {
    SessionChanged,
    Forbidden,
    MissingHome,
    MissingDecision,
    InvalidCursor,
    Unavailable,
}

class HomeResidencyHistoryFailure(val kind: HomeResidencyHistoryFailureKind) : IllegalStateException(
    when (kind) {
        HomeResidencyHistoryFailureKind.SessionChanged -> "Your session changed. Reopen your saved decisions."
        HomeResidencyHistoryFailureKind.Forbidden -> "Current household review permission is required to read your saved decisions."
        HomeResidencyHistoryFailureKind.MissingHome -> "This Home is no longer available."
        HomeResidencyHistoryFailureKind.MissingDecision -> "That saved decision was not found in your history for this Home."
        HomeResidencyHistoryFailureKind.InvalidCursor -> "This history page is no longer available. Reload your recent decisions."
        HomeResidencyHistoryFailureKind.Unavailable -> "Your saved decisions could not be loaded. Retry to check your history."
    },
)
