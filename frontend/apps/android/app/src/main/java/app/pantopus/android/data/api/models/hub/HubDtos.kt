package app.pantopus.android.data.api.models.hub

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/hub/discovery` — route `backend/routes/hub.js:757`.
 *
 * T5.4.1 — extended additively for the Discover hub screen: next to the
 * original fields (`meta`, `category`, `avatarUrl`, `route`), the optional
 * fields (`subtitle`, `price`, `rating`, `verified`, `isFree`, `isWanted`,
 * `createdAt`) carry the structured payload the typed Discover hub rows render.
 */
@JsonClass(generateAdapter = true)
data class HubDiscoveryResponse(
    val items: List<DiscoveryItem>,
)

@JsonClass(generateAdapter = true)
data class DiscoveryItem(
    val id: String,
    val type: String,
    val title: String,
    val meta: String,
    val category: String?,
    val avatarUrl: String?,
    val route: String,
    // ─── T5.4.1 additive fields ──────────────────────────────────
    val subtitle: String? = null,
    val price: String? = null,
    val rating: Double? = null,
    val verified: Boolean? = null,
    val isFree: Boolean? = null,
    val isWanted: Boolean? = null,
    val createdAt: String? = null,
)

// Hub Today (typed payload — P1-F): `GET /api/hub/today`, backing the Today briefing.
//
// IMPORTANT: the route serializes this object at the TOP LEVEL on success
// (`res.json(result)` in routes/hub.js, where `result` is the orchestrator
// payload). There is no `today` wrapper key. The only wrapped shape is the
// failure path `{ today: null, error: "CONTEXT_UNAVAILABLE" }`, and the
// no-location path sets `display_mode: "hidden"` — both are surfaced here.

@JsonClass(generateAdapter = true)
data class HubTodayPayload(
    val location: TodayLocationDto? = null,
    val summary: String? = null,
    @Json(name = "display_mode") val displayMode: String? = null,
    val weather: TodayWeatherDto? = null,
    val aqi: TodayAqiDto? = null,
    val alerts: List<TodayAlertDto>? = null,
    val signals: List<TodaySignalDto>? = null,
    val error: String? = null,
) {
    /** True when the payload carries a renderable briefing (not the error or
     *  hidden-location path). */
    val isRenderable: Boolean get() = error == null && displayMode != "hidden"
}

@JsonClass(generateAdapter = true)
data class TodayLocationDto(
    val label: String? = null,
    val timezone: String? = null,
    val source: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

@JsonClass(generateAdapter = true)
data class TodayWeatherDto(
    @Json(name = "current_temp_f") val currentTempF: Double? = null,
    @Json(name = "condition_code") val conditionCode: String? = null,
    @Json(name = "condition_label") val conditionLabel: String? = null,
    @Json(name = "high_f") val highF: Double? = null,
    @Json(name = "low_f") val lowF: Double? = null,
    @Json(name = "precipitation_next_6h") val precipitationNext6h: Boolean? = null,
    @Json(name = "sunrise_utc") val sunriseUtc: String? = null,
    @Json(name = "sunset_utc") val sunsetUtc: String? = null,
)

@JsonClass(generateAdapter = true)
data class TodayAqiDto(
    val index: Int? = null,
    val category: String? = null,
    @Json(name = "is_noteworthy") val isNoteworthy: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class TodayAlertDto(
    val id: String? = null,
    val severity: String? = null,
    val title: String? = null,
)

/**
 * The wire's `action` (a `{label, route}` object on bill, task, calendar, pickup, mail, gig and local-update
 * signals) and `data` aren't used, so they aren't decoded. Declared as a String, `action` failed the whole
 * Today payload ("Couldn't load today") whenever a signal carried one.
 */
@JsonClass(generateAdapter = true)
data class TodaySignalDto(
    val kind: String? = null,
    val label: String? = null,
    val detail: String? = null,
    val urgency: String? = null,
)

// region Briefing delivery (GET /api/hub/briefings/:id — backend/routes/hub.js:612)

/** `GET /api/hub/briefings/:id` envelope — `{ briefing: … }`. */
@JsonClass(generateAdapter = true)
data class BriefingDeliveryResponse(
    val briefing: BriefingDeliveryDto,
)

/**
 * One stored Morning/Evening Briefing delivery. Selected columns are listed
 * verbatim at `backend/routes/hub.js:622`; `signals_snapshot` is a jsonb array
 * whose element shape matches [TodaySignalDto].
 */
@JsonClass(generateAdapter = true)
data class BriefingDeliveryDto(
    val id: String,
    @Json(name = "briefing_date_local") val briefingDateLocal: String? = null,
    /** `morning` | `evening`. */
    @Json(name = "briefing_kind") val briefingKind: String? = null,
    @Json(name = "summary_text") val summaryText: String? = null,
    @Json(name = "signals_snapshot") val signalsSnapshot: List<TodaySignalDto>? = null,
    @Json(name = "location_geohash") val locationGeohash: String? = null,
    @Json(name = "composition_mode") val compositionMode: String? = null,
    val status: String? = null,
    @Json(name = "delivered_at") val deliveredAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

// endregion
