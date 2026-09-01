package app.pantopus.android.data.api.models.sports

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One row of the active-event registry
 * (`backend/routes/sports.js:23-24`). Keys are snake_case on the wire.
 */
@JsonClass(generateAdapter = true)
data class ActiveSportsEventDto(
    @Json(name = "event_key") val eventKey: String,
    @Json(name = "display_name") val displayName: String? = null,
    @Json(name = "short_label") val shortLabel: String? = null,
    val league: String? = null,
    val country: String? = null,
    @Json(name = "starts_at") val startsAt: String? = null,
    @Json(name = "ends_at") val endsAt: String? = null,
    val priority: Int? = null,
) {
    /** Chip label — short label first, then the full display name. */
    val chipLabel: String?
        get() =
            shortLabel?.takeIf { it.isNotBlank() }
                ?: displayName?.takeIf { it.isNotBlank() }
}

/**
 * `GET /api/sports/active-events` envelope
 * (`backend/routes/sports.js:31`).
 */
@JsonClass(generateAdapter = true)
data class ActiveSportsEventsResponse(
    val primaryEvent: ActiveSportsEventDto? = null,
    val events: List<ActiveSportsEventDto> = emptyList(),
)
