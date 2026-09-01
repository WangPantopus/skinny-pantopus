@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Analytics. `GET /insights/no-shows?days` and `GET /insights/team?days`
 * (business-only). Shapes match the live `bookingMetricsService` returns
 * (`getNoShowReport` / `getTeamPerformance`), which the companion doc drifted
 * from. `no_show_rate` is an integer percentage (Math.round), not a float.
 */
@JsonClass(generateAdapter = true)
data class NoShowRecent(
    val id: String? = null,
    @Json(name = "start_at") val startAt: String? = null,
    val status: String? = null,
    @Json(name = "invitee_name") val inviteeName: String? = null,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
)

/** `GET /insights/no-shows`. */
@JsonClass(generateAdapter = true)
data class NoShowReportResponse(
    @Json(name = "window_days") val windowDays: Int = 0,
    val completed: Int = 0,
    @Json(name = "no_show") val noShow: Int = 0,
    val cancelled: Int = 0,
    @Json(name = "no_show_rate") val noShowRate: Int = 0,
    @Json(name = "recent_no_shows") val recentNoShows: List<NoShowRecent> = emptyList(),
)

/** Per-host booking tallies for the team performance report. */
@JsonClass(generateAdapter = true)
data class HostPerformance(
    @Json(name = "host_user_id") val hostUserId: String? = null,
    val total: Int = 0,
    val confirmed: Int = 0,
    val completed: Int = 0,
    @Json(name = "no_show") val noShow: Int = 0,
    val cancelled: Int = 0,
)

/** `GET /insights/team` (business-only). */
@JsonClass(generateAdapter = true)
data class TeamPerformanceResponse(
    @Json(name = "window_days") val windowDays: Int = 0,
    val hosts: List<HostPerformance> = emptyList(),
)
