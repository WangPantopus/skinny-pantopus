package app.pantopus.android.data.api.models.hub

import app.pantopus.android.data.api.models.common.JsonValue
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** `GET /api/hub` — route `backend/routes/hub.js:24`. */
@JsonClass(generateAdapter = true)
data class HubResponse(
    val user: HubUser,
    val context: HubContext,
    val availability: HubAvailability,
    val homes: List<HubHomeSummary>,
    val businesses: List<HubBusinessSummary>,
    val setup: HubSetup,
    val statusItems: List<HubStatusItem>,
    val cards: HubCards,
    val jumpBackIn: List<HubJumpBackItem>,
    val activity: List<HubActivityItem>,
    val neighborDensity: HubNeighborDensity?,
)

@JsonClass(generateAdapter = true)
data class HubUser(
    val id: String,
    val name: String,
    val firstName: String?,
    val username: String,
    val avatarUrl: String?,
    val email: String,
)

@JsonClass(generateAdapter = true)
data class HubContext(
    val activeHomeId: String?,
    val activePersona: ActivePersona,
) {
    @JsonClass(generateAdapter = true)
    data class ActivePersona(
        val type: String,
    )
}

@JsonClass(generateAdapter = true)
data class HubAvailability(
    val hasHome: Boolean,
    val hasBusiness: Boolean,
    val hasPayoutMethod: Boolean,
)

@JsonClass(generateAdapter = true)
data class HubHomeSummary(
    val id: String,
    val name: String,
    val addressShort: String,
    val city: String?,
    val state: String?,
    val latitude: Double?,
    val longitude: Double?,
    val isPrimary: Boolean,
    val roleBase: String,
)

@JsonClass(generateAdapter = true)
data class HubBusinessSummary(
    val id: String,
    val name: String,
    val username: String,
    val roleBase: String,
)

@JsonClass(generateAdapter = true)
data class HubSetup(
    val steps: List<Step>,
    val allDone: Boolean,
    val profileCompleteness: ProfileCompleteness,
) {
    @JsonClass(generateAdapter = true)
    data class Step(
        val key: String,
        val done: Boolean,
    )

    @JsonClass(generateAdapter = true)
    data class ProfileCompleteness(
        val score: Double,
        val checks: Checks,
        val missingFields: List<String>,
    ) {
        @JsonClass(generateAdapter = true)
        data class Checks(
            val firstName: Boolean,
            val lastName: Boolean,
            val photo: Boolean,
            val bio: Boolean,
            val skills: Boolean,
        )
    }
}

@JsonClass(generateAdapter = true)
data class HubStatusItem(
    val id: String,
    val type: String,
    val pillar: String,
    val title: String,
    val subtitle: String?,
    val severity: String,
    val count: Int?,
    val dueAt: String?,
    val route: String,
    val entityRef: EntityRef?,
) {
    @JsonClass(generateAdapter = true)
    data class EntityRef(
        val kind: String,
        val id: String,
    )
}

@JsonClass(generateAdapter = true)
data class HubCards(
    val personal: HubPersonalCard,
    val home: HubHomeCard?,
    val business: HubBusinessCard?,
)

@JsonClass(generateAdapter = true)
data class HubPersonalCard(
    val unreadChats: Int,
    val earnings: Double,
    val gigsNearby: Int,
    val rating: Double,
    val reviewCount: Int,
)

@JsonClass(generateAdapter = true)
data class HubHomeCard(
    val newMail: Int,
    val billsDue: List<HubBill>,
    val tasksDue: List<HubTask>,
    val memberCount: Int,
) {
    @JsonClass(generateAdapter = true)
    data class HubBill(
        val id: String,
        val name: String,
        val amount: Double,
        val dueAt: String,
    )

    @JsonClass(generateAdapter = true)
    data class HubTask(
        val id: String,
        val title: String,
        val dueAt: String,
    )
}

@JsonClass(generateAdapter = true)
data class HubBusinessCard(
    val newOrders: Int,
    val unreadThreads: Int,
    val pendingPayout: Double,
)

@JsonClass(generateAdapter = true)
data class HubJumpBackItem(
    val title: String,
    val route: String,
    val icon: String,
)

@JsonClass(generateAdapter = true)
data class HubActivityItem(
    val id: String,
    val pillar: String,
    val title: String,
    val at: String,
    val read: Boolean,
    val route: String,
)

@JsonClass(generateAdapter = true)
data class HubNeighborDensity(
    val count: Int,
    val radiusMiles: Double,
    val milestone: String?,
)

/**
 * `GET /api/hub/today` — provider-orchestrated, shape varies. Exposed as
 * untyped JSON until the provider bundle stabilises. Route:
 * `backend/routes/hub.js:596`.
 */
@JsonClass(generateAdapter = true)
data class HubTodayResponse(
    val today: JsonValue?,
    val error: String?,
)

/**
 * `GET /api/hub/discovery` — route `backend/routes/hub.js:757`.
 *
 * T5.4.1 — extended additively for the Discover hub screen. Legacy
 * fields (`meta`, `category`, `avatarUrl`, `route`) are preserved so
 * the existing Hub Discovery rail keeps rendering unchanged. New
 * optional fields (`subtitle`, `price`, `rating`, `verified`,
 * `isFree`, `isWanted`, `createdAt`) carry the structured payload the
 * typed Discover hub rows render.
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

// Hub Today (typed payload — P1-F).
// The legacy [HubTodayResponse] keeps the untyped JsonValue shape used by the
// Hub overview rail; this typed variant backs the full-screen Today briefing.
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
)

@JsonClass(generateAdapter = true)
data class TodayWeatherDto(
    @Json(name = "current_temp_f") val currentTempF: Double? = null,
    @Json(name = "condition_code") val conditionCode: String? = null,
    @Json(name = "condition_label") val conditionLabel: String? = null,
    @Json(name = "high_f") val highF: Double? = null,
    @Json(name = "low_f") val lowF: Double? = null,
    @Json(name = "precipitation_next_6h") val precipitationNext6h: Boolean? = null,
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

@JsonClass(generateAdapter = true)
data class TodaySignalDto(
    val kind: String? = null,
    val label: String? = null,
    val detail: String? = null,
    val urgency: String? = null,
    val action: String? = null,
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
