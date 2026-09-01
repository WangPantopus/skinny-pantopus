@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * The fulfillment states the backend's `urgentStatusSchema` accepts
 * (`backend/routes/gigs.js:8675`). `picked_up` / `dropped_off` are the
 * delivery-flavoured aliases of `arrived` / `in_progress` and share their
 * rung on the stepper.
 */
enum class GigFulfillmentStatus(
    val wire: String,
    /** Rung on the four-step stepper — RN `STATUS_ORDER` (`ActiveTaskPanel.tsx:37`). */
    val stepIndex: Int,
    /** Badge copy — RN `getStatusBadge` (`ActiveTaskPanel.tsx:46`). */
    val badgeLabel: String,
) {
    OnTheWay("on_the_way", 0, "On the way"),
    Arrived("arrived", 1, "Arrived"),
    PickedUp("picked_up", 1, "Picked up"),
    DroppedOff("dropped_off", 2, "Dropped off"),
    InProgress("in_progress", 2, "In progress"),
    ;

    companion object {
        fun fromWire(value: String?): GigFulfillmentStatus? = entries.firstOrNull { it.wire == value }
    }
}

/** One rung of the live stepper — RN `STATUS_STEPS` (`ActiveTaskPanel.tsx:30`). */
enum class GigFulfillmentStep(
    val index: Int,
    val label: String,
) {
    OnTheWay(0, "On the way"),
    Arrived(1, "Arrived"),
    InProgress(2, "In progress"),
    Completed(3, "Completed"),
}

/** Body for `POST /api/gigs/:gigId/status`. */
@JsonClass(generateAdapter = true)
data class GigFulfillmentStatusBody(
    val status: String,
    @Json(name = "helper_eta_minutes") val helperEtaMinutes: Int? = null,
)

/**
 * Helper coordinates riding `active-status` when the poster enabled
 * location sharing (`urgent_details.shareLocationDuringTask`).
 */
@JsonClass(generateAdapter = true)
data class GigHelperLocationDto(
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** Response from `GET /api/gigs/:gigId/active-status` (`backend/routes/gigs.js:8834`). */
@JsonClass(generateAdapter = true)
data class GigActiveStatusResponse(
    val gigId: String? = null,
    @Json(name = "gig_status") val gigStatus: String? = null,
    @Json(name = "fulfillment_status") val fulfillmentStatus: String? = null,
    @Json(name = "fulfillment_status_updated_at") val fulfillmentStatusUpdatedAt: String? = null,
    @Json(name = "helper_eta_minutes") val helperEtaMinutes: Int? = null,
    @Json(name = "helper_location") val helperLocation: GigHelperLocationDto? = null,
) {
    val status: GigFulfillmentStatus? get() = GigFulfillmentStatus.fromWire(fulfillmentStatus)
}

/** Response from `POST /api/gigs/:gigId/status` (`backend/routes/gigs.js:8789`). */
@JsonClass(generateAdapter = true)
data class GigFulfillmentStatusResponse(
    @Json(name = "fulfillment_status") val fulfillmentStatus: String? = null,
)

/** Response from `DELETE /api/gigs/:id` (`backend/routes/gigs.js:3766`). */
@JsonClass(generateAdapter = true)
data class GigDeleteResponse(
    val message: String? = null,
)

/**
 * One shopping / errand line item on a gig (`Gig.items` jsonb, migration
 * `030_context_convert_system.sql:38`). Shared by the composer's edit
 * prefill and the create / update bodies.
 */
@JsonClass(generateAdapter = true)
data class GigItemDto(
    val name: String? = null,
    val notes: String? = null,
    /**
     * The create schema accepts a number *or* a string here
     * (`Joi.alternatives()`, `backend/routes/gigs.js:490`), so older rows
     * carry a raw number. Typed loosely to keep one legacy row from
     * failing the whole gig decode; read [budgetCapText] instead.
     */
    val budgetCap: Any? = null,
    val preferredStore: String? = null,
) {
    val budgetCapText: String?
        get() =
            when (val raw = budgetCap) {
                null -> null
                is String -> raw.takeIf { it.isNotBlank() }
                is Double -> if (raw % 1.0 == 0.0) raw.toLong().toString() else raw.toString()
                else -> raw.toString()
            }
}
