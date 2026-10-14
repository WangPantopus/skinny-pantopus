package app.pantopus.android.ui.screens.place.detail

import android.net.Uri
import app.pantopus.android.data.ai.PickupFlyerReading
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

    val pickupPrimerHomeId: StateFlow<String?>? get() = null

    fun dismissPickupPrimer() = Unit

    /** Null means an acknowledged opt-in; other values are safe user-facing failures. */
    suspend fun enablePickupReminders(
        homeId: String,
        timezone: String,
    ): String? = "Couldn't enable pickup reminders. Try again."

    fun setPickupDay(
        request: SetPickupDayRequest,
        offerPrimer: Boolean = false,
    )

    /** [expectedVersion] is the calendar's `pickupVersion` when the editor opened. */
    fun clearPickupDay(expectedVersion: String?)

    /** The editor offers "Read a flyer" only where [readPickupFlyer] works. */
    val readsPickupFlyers: Boolean get() = false

    /**
     * The pickup days on a photo of the household's hauler's flyer, for the editor to fill in.
     * Saves nothing. Null when the answer no longer belongs on screen (the home or session changed).
     */
    suspend fun readPickupFlyer(photo: Uri): PickupFlyerReading? = null
}
