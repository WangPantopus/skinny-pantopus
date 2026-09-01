@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /connected-calendars` (personal). OAuth sync is deferred — the read
 * returns an empty list in v1; `POST /connected-calendars/connect` returns
 * `501 NOT_AVAILABLE` (surface "coming soon").
 */
@JsonClass(generateAdapter = true)
data class ConnectedCalendarDto(
    val id: String,
    val provider: String? = null,
    @Json(name = "external_account") val externalAccount: String? = null,
    @Json(name = "check_conflicts") val checkConflicts: Boolean? = null,
    @Json(name = "write_target") val writeTarget: Boolean? = null,
    val status: String? = null,
    @Json(name = "last_synced_at") val lastSyncedAt: String? = null,
)

/** `GET /connected-calendars` — `{ calendars: [...] }`. */
@JsonClass(generateAdapter = true)
data class GetConnectedCalendarsResponse(
    val calendars: List<ConnectedCalendarDto> = emptyList(),
)
