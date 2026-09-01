@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.support_trains

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/support-trains/:id` envelope (A10.9 Detail / A13.13 Manage).
 * Verified against `backend/routes/supportTrains.js:3444` (response built
 * at l.3650–3782). Privacy-gated: `slots` / `my_reservations` /
 * `updates` / `organizers` come back scoped to `viewer_level`.
 *
 * PROJECTION GAPS (degrade gracefully): the handler returns each slot's
 * filled/capacity counts but not the helper or dish that covered it (that
 * lives on the organizer-only `/:id/reservations` feed), and carries no
 * recipient identity tag / verified flag / contributor roster. So covered
 * rows render without a dish author, the contributor strip is built from
 * `organizers`, and the recipient identity defaults to Home.
 */
@JsonClass(generateAdapter = true)
data class SupportTrainDetailDto(
    val id: String,
    @Json(name = "activity_id") val activityId: String? = null,
    val title: String? = null,
    val story: String? = null,
    val status: String? = null,
    @Json(name = "published_at") val publishedAt: String? = null,
    @Json(name = "sharing_mode") val sharingMode: String? = null,
    @Json(name = "support_modes") val supportModes: SupportTrainModesDto? = null,
    @Json(name = "recipient_summary") val recipientSummary: String? = null,
    @Json(name = "household_size") val householdSize: Int? = null,
    @Json(name = "dietary_restrictions") val dietaryRestrictions: List<String>? = null,
    @Json(name = "dietary_preferences") val dietaryPreferences: List<String>? = null,
    @Json(name = "contactless_preferred") val contactlessPreferred: Boolean? = null,
    @Json(name = "preferred_dropoff_window") val preferredDropoffWindow: SupportTrainDropoffWindowDto? = null,
    @Json(name = "summary_chips") val summaryChips: List<String>? = null,
    val slots: List<SupportTrainSlotDto>? = null,
    @Json(name = "my_reservations") val myReservations: List<SupportTrainMyReservationDto>? = null,
    val updates: List<SupportTrainUpdateDto>? = null,
    val organizers: List<SupportTrainOrganizerDto>? = null,
    @Json(name = "viewer_level") val viewerLevel: String? = null,
    @Json(name = "viewer_support_train_role") val viewerSupportTrainRole: String? = null,
    @Json(name = "exact_address_shared") val exactAddressShared: Boolean? = null,
    @Json(name = "coarse_location") val coarseLocation: SupportTrainCoarseLocationDto? = null,
    /**
     * Exact street address — only present when the server decides the
     * viewer may see it (organizer / recipient / a helper the organizer
     * granted, `backend/routes/supportTrains.js:3704`). Never derived or
     * cached: after a reveal the screen re-fetches `GET /:id` so the
     * privacy gate re-runs server-side.
     */
    val address: SupportTrainAddressDto? = null,
    @Json(name = "delivery_instructions") val deliveryInstructions: String? = null,
    @Json(name = "special_instructions") val specialInstructions: String? = null,
    /** Organizer-only echo of the parent Activity's visibility. */
    @Json(name = "activity_visibility") val activityVisibility: String? = null,
) {
    /** True for primary / co-organizer / recipient-delegate viewers. */
    val viewerIsOrganizer: Boolean
        get() = viewerLevel == "organizer"

    /** Only the primary may unpublish / archive / delete / edit organizers. */
    val viewerIsPrimaryOrganizer: Boolean
        get() = viewerSupportTrainRole == "primary"
}

/** `support_modes` block — which contribution lanes the train accepts. */
@JsonClass(generateAdapter = true)
data class SupportTrainModesDto(
    @Json(name = "home_cooked_meals") val homeCookedMeals: Boolean? = null,
    val takeout: Boolean? = null,
    val groceries: Boolean? = null,
    @Json(name = "gift_funds") val giftFunds: Boolean? = null,
)

/** `preferred_dropoff_window` — `HH:MM` strings or null. */
@JsonClass(generateAdapter = true)
data class SupportTrainDropoffWindowDto(
    @Json(name = "start_time") val startTime: String? = null,
    @Json(name = "end_time") val endTime: String? = null,
)

/** One slot in the detail / manage payload. */
@JsonClass(generateAdapter = true)
data class SupportTrainSlotDto(
    val id: String,
    @Json(name = "slot_date") val slotDate: String? = null,
    @Json(name = "slot_label") val slotLabel: String? = null,
    @Json(name = "support_mode") val supportMode: String? = null,
    @Json(name = "start_time") val startTime: String? = null,
    @Json(name = "end_time") val endTime: String? = null,
    val status: String? = null,
    @Json(name = "filled_count") val filledCount: Int? = null,
    val capacity: Int? = null,
) {
    /** Covered once filled count meets capacity (or status is `full`). */
    val isCovered: Boolean
        get() = status == "full" || (capacity != null && capacity > 0 && (filledCount ?: 0) >= capacity)
}

/** The viewer's own reservations (drives "Your commitment" + `.mine` cell). */
@JsonClass(generateAdapter = true)
data class SupportTrainMyReservationDto(
    val id: String,
    @Json(name = "slot_id") val slotId: String? = null,
    val status: String? = null,
    @Json(name = "contribution_mode") val contributionMode: String? = null,
    @Json(name = "dish_title") val dishTitle: String? = null,
    @Json(name = "restaurant_name") val restaurantName: String? = null,
    @Json(name = "estimated_arrival_at") val estimatedArrivalAt: String? = null,
    @Json(name = "note_to_recipient") val noteToRecipient: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** One broadcast update (also the `POST /:id/updates` response shape). */
@JsonClass(generateAdapter = true)
data class SupportTrainUpdateDto(
    val id: String,
    @Json(name = "author_user_id") val authorUserId: String? = null,
    val body: String? = null,
    @Json(name = "media_urls") val mediaUrls: List<String>? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/**
 * One organizer row (primary / co_organizer / recipient_delegate).
 *
 * The detail handler re-shapes Supabase's `User:user_id` alias into a
 * lowercase `user` object before responding
 * (`backend/routes/supportTrains.js:3611`) — the capitalised key never
 * reaches the client, so `user` is the wire name. [legacyUser] keeps
 * older fixtures decoding.
 */
@JsonClass(generateAdapter = true)
data class SupportTrainOrganizerDto(
    val id: String,
    val role: String? = null,
    @Json(name = "user") val user: SupportTrainHelperDto? = null,
    @Json(name = "User") val legacyUser: SupportTrainHelperDto? = null,
) {
    /** Organizer account, whichever key it arrived under. */
    val organizerUser: SupportTrainHelperDto?
        get() = user ?: legacyUser

    val isPrimary: Boolean
        get() = role == "primary"

    val displayName: String
        get() = organizerUser?.name ?: organizerUser?.username ?: "Organizer"
}

/** Coarse (city/state) location surfaced to all viewers. */
@JsonClass(generateAdapter = true)
data class SupportTrainCoarseLocationDto(
    val city: String? = null,
    val state: String? = null,
    @Json(name = "zip_code") val zipCode: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/**
 * `POST /api/support-trains/:id/updates` body. `media_urls` is omitted
 * when null. Backend caps `body` at 5000 chars (`createUpdateSchema`).
 */
@JsonClass(generateAdapter = true)
data class SupportTrainUpdateBody(
    val body: String,
    @Json(name = "media_urls") val mediaUrls: List<String>? = null,
)
