package app.pantopus.android.ui.screens.place.detail

import kotlinx.coroutines.flow.StateFlow

/**
 * What the address calendar card needs from whoever hosts it — the
 * Place detail page or the Today tab (Wedge v2 D6). `weekday` is
 * MO TU WE TH FR SA SU.
 */
interface AddressCalendarActions {
    val calendarBusy: StateFlow<Boolean>
    val calendarError: StateFlow<String?>

    fun setPickupDay(weekday: String)

    fun clearPickupDay()
}
