@file:Suppress("PackageNaming")

package app.pantopus.android.data.support_trains

import app.pantopus.android.data.api.models.support_trains.SupportTrainReservationDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * P3.7 — process-wide bridge between the Review-signups list and the
 * Edit-signup form. Mirrors iOS `SupportTrainReservationsStore`.
 *
 * Two responsibilities:
 *  1. Stage the seed reservation when the user taps Edit so the form
 *     can prefill without re-fetching (the backend has no single-
 *     reservation endpoint today, and `GET …/reservations` is
 *     heavy).
 *  2. Buffer optimistic save patches so the Review-signups list can
 *     replay them into its in-memory cache when the form pops.
 *
 * S1 STATUS: the reservation *write* routes that do exist are now
 * wired for real — reserve / cancel / reveal-address / deliver /
 * confirm all live in `SupportTrainActionsApi`. There is still **no**
 * edit route: `backend/routes/supportTrains.js` declares 39 routes and
 * none of them is a `PATCH /:id/reservations/:reservationId` (the only
 * reservation-scoped writes are the five above). So this optimistic
 * store stays the user-facing source of truth for the Edit-signup form
 * until that route ships — it is not standing in for something that
 * already exists server-side.
 */
@Singleton
class SupportTrainReservationsStore
    @Inject
    constructor() {
        private var staged: SupportTrainReservationDto? = null

        private val _revision = MutableStateFlow(0)

        /** Bumps every time a patch is applied — list VMs collect this. */
        val revision: StateFlow<Int> = _revision.asStateFlow()

        private val patches: MutableMap<String, SupportTrainReservationDto> = mutableMapOf()

        /** Stash the row the user just tapped Edit on. */
        fun stage(reservation: SupportTrainReservationDto) {
            staged = reservation
        }

        /** Take — and clear — the staged seed. Form VMs call this on init. */
        fun consumeStaged(): SupportTrainReservationDto? {
            val out = staged
            staged = null
            return out
        }

        /** Record an optimistic save patch. Bumps [revision] so observers re-render. */
        fun applyPatch(updated: SupportTrainReservationDto) {
            patches[updated.id] = updated
            _revision.value = _revision.value + 1
        }

        /**
         * Return — and remove — the patch for [reservationId], or null
         * when there is no pending edit. The Review-signups VM drains
         * patches into its in-memory cache after the form pops.
         */
        fun consumePatch(reservationId: String): SupportTrainReservationDto? = patches.remove(reservationId)

        /** Test affordance — empty the store between unit tests. */
        fun reset() {
            staged = null
            patches.clear()
            _revision.value = 0
        }
    }
