package app.pantopus.android.ui.screens.place.detail

import app.pantopus.android.data.api.models.place.PlaceAddressCalendarData
import app.pantopus.android.data.api.models.place.SetPickupDayRequest
import kotlinx.coroutines.flow.StateFlow

/**
 * What the address calendar card needs from whoever hosts it — the
 * Place detail page or the Today tab (Wedge v2 D6). `weekday` is
 * MO TU WE TH FR SA SU.
 */
interface AddressCalendarActions {
    val calendarHomeId: String? get() = null

    /** Only the unavailable section uses the existing authorized calendar route. */
    suspend fun loadAddressCalendar(): PlaceAddressCalendarData? = null

    val calendarBusy: StateFlow<Boolean>
    val calendarError: StateFlow<String?>

    fun setPickupDay(request: SetPickupDayRequest)

    /** [expectedVersion] is the calendar's `pickupVersion` when the editor opened. */
    fun clearPickupDay(expectedVersion: String?)
}
