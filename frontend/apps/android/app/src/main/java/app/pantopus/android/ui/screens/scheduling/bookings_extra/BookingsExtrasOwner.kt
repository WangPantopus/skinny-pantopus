@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar

/**
 * Owner-context resolution shared by the A9 surfaces. The A0 routes for this
 * stream are arg-less for owner, so arg-less hubs resolve the pillar via
 * [HomesRepository]/[AuthRepository] (mirroring the hub/event-type list), while
 * booking-scoped screens derive the action owner from the fetched booking's
 * `owner_type`/`owner_id`.
 */
internal object BookingsExtrasOwner {
    /** Derive the owner that actions on [booking] must be scoped to. */
    fun fromBooking(booking: BookingDto): SchedulingOwner =
        when {
            booking.ownerType == SchedulingOwner.OWNER_TYPE_BUSINESS && booking.ownerId != null ->
                SchedulingOwner.Business(booking.ownerId)
            booking.ownerType == SchedulingOwner.OWNER_TYPE_HOME && booking.ownerId != null ->
                SchedulingOwner.Home(booking.ownerId)
            else -> SchedulingOwner.Personal
        }

    /** Resolve an owner for a pillar tab; null when the pillar has no context yet. */
    suspend fun resolve(
        pillar: SchedulingPillar,
        homes: HomesRepository,
        auth: AuthRepository,
    ): SchedulingOwner? =
        when (pillar) {
            SchedulingPillar.Personal -> SchedulingOwner.Personal
            SchedulingPillar.Home ->
                when (val r = homes.myHomes()) {
                    is NetworkResult.Success -> r.data.homes.firstOrNull()?.id?.let { SchedulingOwner.Home(it) }
                    is NetworkResult.Failure -> null
                }
            SchedulingPillar.Business ->
                (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id?.let { SchedulingOwner.Business(it) }
        }
}
