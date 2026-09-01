package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Vacation Hold endpoints in `backend/routes/mailboxV2Phase3.js`.
 *
 * The wire row (`VacationHold`) is snake_case; request bodies are camelCase
 * because the backend Joi schemas (`startVacationSchema` /
 * `cancelVacationSchema`) validate camelCase keys, and Moshi serialises Kotlin
 * property names verbatim.
 */

/** One `VacationHold` row. Route `backend/routes/mailboxV2Phase3.js:1523`. */
@JsonClass(generateAdapter = true)
data class VacationHoldDto(
    val id: String,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "home_id") val homeId: String? = null,
    @Json(name = "start_date") val startDate: String? = null,
    @Json(name = "end_date") val endDate: String? = null,
    /** `hold_in_vault / forward_to_household / notify_urgent_only`. */
    @Json(name = "hold_action") val holdAction: String? = null,
    /** `hold_at_carrier / ask_neighbor / locker`. */
    @Json(name = "package_action") val packageAction: String? = null,
    @Json(name = "auto_neighbor_request") val autoNeighborRequest: Boolean? = null,
    /** `scheduled / active / cancelled`. */
    val status: String? = null,
    @Json(name = "items_held_count") val itemsHeldCount: Int? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/**
 * Envelope for `GET /api/mailbox/v2/p3/vacation/status` — `{ active, upcoming }`.
 * Both are null when the user has no scheduled or in-flight hold.
 */
@JsonClass(generateAdapter = true)
data class VacationStatusResponse(
    val active: VacationHoldDto? = null,
    val upcoming: VacationHoldDto? = null,
)

/**
 * Body for `POST /api/mailbox/v2/p3/vacation/start` — route
 * `backend/routes/mailboxV2Phase3.js:1546` (`startVacationSchema`). Dates are
 * ISO-8601 (`yyyy-MM-dd` is accepted by Joi `isoDate`).
 */
@JsonClass(generateAdapter = true)
data class StartVacationRequest(
    val homeId: String,
    val startDate: String,
    val endDate: String,
    val holdAction: String,
    val packageAction: String,
    val autoNeighborRequest: Boolean = false,
)

/** Envelope for `POST /api/mailbox/v2/p3/vacation/start` — `{ hold }`. */
@JsonClass(generateAdapter = true)
data class StartVacationResponse(
    val hold: VacationHoldDto,
)

/**
 * Body for `POST /api/mailbox/v2/p3/vacation/cancel` — route
 * `backend/routes/mailboxV2Phase3.js:1601` (`cancelVacationSchema`).
 */
@JsonClass(generateAdapter = true)
data class CancelVacationRequest(
    val holdId: String,
)

/** Envelope for `POST /api/mailbox/v2/p3/vacation/cancel` — `{ message }`. */
@JsonClass(generateAdapter = true)
data class CancelVacationResponse(
    val message: String? = null,
)
