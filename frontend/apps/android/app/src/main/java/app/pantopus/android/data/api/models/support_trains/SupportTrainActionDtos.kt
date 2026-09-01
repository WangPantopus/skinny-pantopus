@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.support_trains

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * S1 — request bodies + response shapes for the Support Train write
 * routes wired in `SupportTrainActionsApi`. Every shape was read out of
 * the Joi schema / `res.json(...)` of the matching handler in
 * `backend/routes/supportTrains.js`.
 */

/**
 * `POST /:id/slots/:slotId/reserve` body — `reserveSchema`
 * (`backend/routes/supportTrains.js:2237`). Only `contribution_mode` is
 * required; the rest is optional helper detail.
 */
@JsonClass(generateAdapter = true)
data class ReserveSlotBody(
    /** `cook` / `takeout` / `groceries`. */
    @Json(name = "contribution_mode") val contributionMode: String,
    @Json(name = "dish_title") val dishTitle: String? = null,
    @Json(name = "restaurant_name") val restaurantName: String? = null,
    /** ISO-8601 timestamp (`Joi.string().isoDate()`). */
    @Json(name = "estimated_arrival_at") val estimatedArrivalAt: String? = null,
    @Json(name = "note_to_recipient") val noteToRecipient: String? = null,
    @Json(name = "private_note_to_organizer") val privateNoteToOrganizer: String? = null,
)

/**
 * The three contribution lanes a helper can pick, gated by the train's
 * `support_modes`. `wire` matches `reserveSchema`'s enum exactly.
 */
enum class SupportTrainContributionMode(
    val wire: String,
    val label: String,
) {
    COOK("cook", "Home-cooked meal"),
    TAKEOUT("takeout", "Takeout / delivery"),
    GROCERIES("groceries", "Groceries"),
}

/**
 * `POST /:id/reservations/:reservationId/cancel` body —
 * `cancelReservationSchema` (`backend/routes/supportTrains.js:2246`).
 * Send `helper_reason` when the helper leaves their own slot and
 * `organizer_reason` when an organizer reopens it.
 */
@JsonClass(generateAdapter = true)
data class CancelReservationBody(
    @Json(name = "helper_reason") val helperReason: String? = null,
    @Json(name = "organizer_reason") val organizerReason: String? = null,
)

/**
 * `POST /:id/organizers` body — `addOrganizerSchema`
 * (`backend/routes/supportTrains.js:1044`). `role` is `co_organizer` or
 * `recipient_delegate`.
 */
@JsonClass(generateAdapter = true)
data class AddSupportTrainOrganizerBody(
    @Json(name = "user_id") val userId: String,
    val role: String = "co_organizer",
)

/**
 * `GET /:id/organizers` envelope
 * (`backend/routes/supportTrains.js:1169`). The nested user arrives as
 * lowercase `user` — the handler re-shapes Supabase's `User:user_id`
 * alias at l.1159.
 */
@JsonClass(generateAdapter = true)
data class SupportTrainOrganizersResponse(
    val organizers: List<SupportTrainOrganizerRowDto> = emptyList(),
)

/** One row of `GET /:id/organizers`. */
@JsonClass(generateAdapter = true)
data class SupportTrainOrganizerRowDto(
    val id: String,
    @Json(name = "user_id") val userId: String? = null,
    val role: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val user: SupportTrainHelperDto? = null,
) {
    val displayName: String
        get() = user?.name ?: user?.username ?: "Organizer"

    /** Primary organizers can't be removed (`supportTrains.js:1102`). */
    val isPrimary: Boolean
        get() = role == "primary"
}

/**
 * `PATCH /:id/slots/:slotId` body — `updateSlotSchema`
 * (`backend/routes/supportTrains.js:1425`). Every field is optional and
 * the object must carry at least one; omitted fields are untouched.
 */
@JsonClass(generateAdapter = true)
data class UpdateSupportTrainSlotBody(
    @Json(name = "slot_label") val slotLabel: String? = null,
    @Json(name = "support_mode") val supportMode: String? = null,
    @Json(name = "slot_date") val slotDate: String? = null,
    @Json(name = "start_time") val startTime: String? = null,
    @Json(name = "end_time") val endTime: String? = null,
    val capacity: Int? = null,
    /** `open` / `canceled` — `canceled` removes the date. */
    val status: String? = null,
)

/**
 * `POST /:id/nudges/draft` response
 * (`backend/routes/supportTrains.js:2191`).
 */
@JsonClass(generateAdapter = true)
data class SupportTrainNudgeDraftResponse(
    val message: String? = null,
)

/**
 * `POST /:id/nudges/send` body — `nudgeSendSchema`
 * (`backend/routes/supportTrains.js:2134`), 1–1000 chars.
 */
@JsonClass(generateAdapter = true)
data class SupportTrainNudgeBody(
    val message: String,
)

/**
 * `GET /:id/fund` response (`backend/routes/supportTrains.js:1971`).
 * Amounts are in **cents**.
 */
@JsonClass(generateAdapter = true)
data class SupportTrainFundDto(
    val enabled: Boolean? = null,
    val currency: String? = null,
    @Json(name = "goal_amount") val goalAmount: Int? = null,
    @Json(name = "total_amount") val totalAmount: Int? = null,
    @Json(name = "contribution_count") val contributionCount: Int? = null,
)

/**
 * `POST /:id/fund/enable` body — `enableFundSchema`
 * (`backend/routes/supportTrains.js:1686`). `goal_amount` is in cents
 * (1…100000) and omitted when null.
 */
@JsonClass(generateAdapter = true)
data class EnableSupportTrainFundBody(
    @Json(name = "goal_amount") val goalAmount: Int? = null,
)

/**
 * Exact delivery address (`backend/routes/supportTrains.js:3727`) —
 * present on `GET /:id` **only when the server decides the viewer may
 * see it**. Never derived or cached client-side.
 */
@JsonClass(generateAdapter = true)
data class SupportTrainAddressDto(
    val address: String? = null,
    @Json(name = "unit_number") val unitNumber: String? = null,
    val city: String? = null,
    val state: String? = null,
    @Json(name = "zip_code") val zipCode: String? = null,
) {
    /** Mirrors RN's `exactAddressLabel` (`support-trains/[id].tsx:413`). */
    val singleLineLabel: String
        get() {
            val first = listOfNotNull(address, unitNumber).filter { it.isNotBlank() }.joinToString(" ")
            val second = listOfNotNull(city, state, zipCode).filter { it.isNotBlank() }.joinToString(", ")
            return listOf(first, second).filter { it.isNotBlank() }.joinToString(", ")
        }
}
