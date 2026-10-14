package app.pantopus.android.ui.screens.place

import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.ui.screens.homes.PendingVerification
import app.pantopus.android.ui.screens.homes.pendingVerificationFor

/**
 * Where a "Verify your address" that isn't about one Home goes (Nearby Plans' prompt): a Home that already waits on
 * verification continues there, as My Homes does (a filed claim's Waiting Room, residency status, or ownership
 * evidence); with none, Add Home. The names are the removed Hub's, which used it first.
 */
internal fun hubVerificationTargetFor(home: MyHome): HubVerificationTarget? =
    when {
        home.pendingClaimId != null -> HubVerificationTarget.WaitingRoom(home.id)
        home.accessKind == "private_setup" -> HubVerificationTarget.Residency(home.id)
        pendingVerificationFor(home) == PendingVerification.Owner -> HubVerificationTarget.ClaimOwnership(home.id)
        pendingVerificationFor(home) == PendingVerification.Residency -> HubVerificationTarget.Residency(home.id)
        else -> null
    }

/** The screen "Verify your address" opens. */
sealed interface HubVerificationTarget {
    data object AddHome : HubVerificationTarget

    data class WaitingRoom(
        val homeId: String,
    ) : HubVerificationTarget

    data class Residency(
        val homeId: String,
    ) : HubVerificationTarget

    data class ClaimOwnership(
        val homeId: String,
    ) : HubVerificationTarget
}
