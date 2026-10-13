package app.pantopus.android.ui.screens.plans

import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.place.HubVerificationTarget
import app.pantopus.android.ui.screens.place.hubVerificationTargetFor

/**
 * "Verify your address" from Plans (J9, H1's playdate card): the home that is waiting on verification, else Add Home.
 * The same target the Place hub opens.
 */
suspend fun plansVerificationTarget(homes: HomesRepository): HubVerificationTarget {
    val list = (homes.myHomes() as? NetworkResult.Success)?.data?.homes.orEmpty()
    return list.firstNotNullOfOrNull(::hubVerificationTargetFor) ?: HubVerificationTarget.AddHome
}
