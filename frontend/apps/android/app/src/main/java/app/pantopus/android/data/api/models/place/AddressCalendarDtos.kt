package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** `GET|PUT|DELETE /api/homes/:id/calendar[...]` — the calendar as the section data. */
@JsonClass(generateAdapter = true)
data class AddressCalendarResponse(
    val calendar: PlaceAddressCalendarData,
)

/** `PUT /api/homes/:id/calendar/pickup-day` body — `weekday` is MO TU WE TH FR SA SU. */
@JsonClass(generateAdapter = true)
data class SetPickupDayRequest(
    val weekday: String,
    @Json(name = "recycling_frequency") val recyclingFrequency: String = "not_set",
    @Json(name = "recycling_next_date") val recyclingNextDate: String? = null,
    /** The calendar's `pickup_version` when the editor opened; a change made meanwhile gives 409. */
    @Json(name = "expected_version") val expectedVersion: String? = null,
)
