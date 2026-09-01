@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.support_trains

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/support-trains/me/support-trains` envelope. See
 * `backend/routes/supportTrains.js:475–565`.
 */
@JsonClass(generateAdapter = true)
data class SupportTrainsListResponse(
    @Json(name = "support_trains") val supportTrains: List<SupportTrainListItemDto> = emptyList(),
    val total: Int? = null,
    val limit: Int? = null,
    val offset: Int? = null,
)

/**
 * `GET /api/support-trains/nearby` envelope. See
 * `backend/routes/supportTrains.js:570+`.
 */
@JsonClass(generateAdapter = true)
data class SupportTrainsNearbyResponse(
    @Json(name = "support_trains") val supportTrains: List<SupportTrainListItemDto> = emptyList(),
)

/**
 * One Support Train row, as rendered in My-trains / Nearby.
 *
 * Backend wire shape (verified at `supportTrains.js:534–558`):
 * ```
 * { id, title, status, published_at, created_at, my_role }
 * ```
 *
 * All additional fields below are **populated by the Nearby RPC only**
 * — they stay `null` for My-trains rows until a backend prep PR adds
 * `slots_filled`, `slots_total`, `support_train_type`, `starts_on`,
 * `ends_on` and `recipient_name` to the My-trains projection. Both
 * feeds decode through this single shape and the VM degrades
 * gracefully (generic archetype tile, no slot bar) when fields are
 * absent.
 */
@JsonClass(generateAdapter = true)
data class SupportTrainListItemDto(
    val id: String,
    val title: String? = null,
    val status: String? = null,
    @Json(name = "published_at") val publishedAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    /** `organizer` / `co_organizer` / `helper` — My-trains feed only. */
    @Json(name = "my_role") val myRole: String? = null,
    // ── Nearby-RPC fields (follow-up backend-prep extends My-trains) ──
    @Json(name = "support_train_type") val supportTrainType: String? = null,
    @Json(name = "starts_on") val startsOn: String? = null,
    @Json(name = "ends_on") val endsOn: String? = null,
    @Json(name = "slots_filled") val slotsFilled: Int? = null,
    @Json(name = "slots_total") val slotsTotal: Int? = null,
    @Json(name = "distance_meters") val distanceMeters: Double? = null,
    @Json(name = "recipient_name") val recipientName: String? = null,
)

/**
 * `GET /api/support-trains/:id/reservations` envelope. See
 * `backend/routes/supportTrains.js:3306+`.
 */
@JsonClass(generateAdapter = true)
data class SupportTrainReservationsResponse(
    val reservations: List<SupportTrainReservationDto> = emptyList(),
)

/**
 * One helper reservation row, as rendered on Review-signups.
 *
 * Backend wire shape (verified at `supportTrains.js:3349–3357`):
 * ```
 * { id, slot_id, user_id, guest_name, guest_email, status,
 *   contribution_mode, dish_title, restaurant_name,
 *   estimated_arrival_at, note_to_recipient, private_note_to_organizer,
 *   created_at, updated_at, canceled_at,
 *   User: { id, username, name, profile_picture_url } }
 * ```
 *
 * Diet flag / conflict marker / explicit edited-at / helper
 * relationship — the four UI conveniences in the design — are **not**
 * projected by the current handler. A follow-up backend prep adds:
 *  - `User.is_verified` + `User.relationship_to_recipient`
 *  - `diet_flag` / `diet_ok` (joined from `SupportTrainRecipientProfile`)
 *  - `conflict_with` (denormalised from slot-availability service)
 *
 * Until then the row falls back gracefully: relationship chip hides,
 * diet flag is omitted, conflict strip never fires, "Edited" is
 * computed client-side via [wasEdited].
 */
@JsonClass(generateAdapter = true)
data class SupportTrainReservationDto(
    val id: String,
    @Json(name = "slot_id") val slotId: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "guest_name") val guestName: String? = null,
    val status: String? = null,
    @Json(name = "contribution_mode") val contributionMode: String? = null,
    @Json(name = "dish_title") val dishTitle: String? = null,
    @Json(name = "restaurant_name") val restaurantName: String? = null,
    @Json(name = "estimated_arrival_at") val estimatedArrivalAt: String? = null,
    @Json(name = "note_to_recipient") val noteToRecipient: String? = null,
    @Json(name = "private_note_to_organizer") val privateNoteToOrganizer: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    @Json(name = "canceled_at") val canceledAt: String? = null,
    /** Email-only (guest) signup address. */
    @Json(name = "guest_email") val guestEmail: String? = null,
    /**
     * True once the organizer shared the exact address with this helper
     * (`SupportTrainAddressGrant`) or emailed the guest
     * (`backend/routes/supportTrains.js:3415`).
     */
    @Json(name = "exact_address_shared") val exactAddressShared: Boolean? = null,
    /**
     * The handler responds with a lowercase `user` object
     * (`backend/routes/supportTrains.js:3418`); [legacyHelper] keeps the
     * capitalised Supabase alias decoding for older fixtures.
     */
    @Json(name = "user") val helper: SupportTrainHelperDto? = null,
    @Json(name = "User") val legacyHelper: SupportTrainHelperDto? = null,
) {
    /** Helper account behind this signup, whichever key it arrived under. */
    val helperUser: SupportTrainHelperDto?
        get() = helper ?: legacyHelper

    /** True when `updatedAt > createdAt` — projects the "Edited" chip. */
    val wasEdited: Boolean
        get() = !updatedAt.isNullOrBlank() && updatedAt != createdAt

    /** Best-effort display name: `helper.name` → `username` → `guestName` → "Helper". */
    val displayName: String
        get() = helperUser?.name ?: helperUser?.username ?: guestName ?: "Helper"

    /** Guest signups have no linked account — organizers email them. */
    val isGuestSignup: Boolean
        get() = userId == null && (guestName != null || guestEmail != null)
}

@JsonClass(generateAdapter = true)
data class SupportTrainHelperDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

// ─── Create / launch (P2.6 — Start-a-Support-Train wizard) ──────────────

/**
 * `POST /api/support-trains/` body. Backend validation lives at
 * `createSupportTrainSchema` (`supportTrains.js:306`). We only ride
 * the free-form `draft_payload.story` slot so the reason copy
 * survives the round-trip onto the published-train detail screen.
 */
@JsonClass(generateAdapter = true)
data class CreateSupportTrainBody(
    @Json(name = "draft_payload") val draftPayload: DraftPayload,
    val title: String,
    @Json(name = "recipient_user_id") val recipientUserId: String?,
    @Json(name = "sharing_mode") val sharingMode: String,
    @Json(name = "enable_home_cooked_meals") val enableHomeCookedMeals: Boolean = true,
    @Json(name = "enable_takeout") val enableTakeout: Boolean = true,
    @Json(name = "enable_groceries") val enableGroceries: Boolean = true,
    @Json(name = "enable_gift_funds") val enableGiftFunds: Boolean = false,
    val timezone: String = java.util.TimeZone.getDefault().id,
) {
    @JsonClass(generateAdapter = true)
    data class DraftPayload(
        val story: String?,
    )
}

/**
 * `POST /api/support-trains/` response. Only `id` matters for the
 * wizard launch flow — the host pushes the new train's review-signups
 * screen immediately after publish.
 */
@JsonClass(generateAdapter = true)
data class CreateSupportTrainResponse(
    val id: String,
)

/**
 * `POST /api/support-trains/:id/slots` body. Backend validation lives
 * at `customSlotSchema` (`supportTrains.js:404`).
 */
@JsonClass(generateAdapter = true)
data class AddSupportTrainSlotBody(
    @Json(name = "slot_date") val slotDate: String,
    @Json(name = "slot_label") val slotLabel: String,
    @Json(name = "support_mode") val supportMode: String,
    @Json(name = "start_time") val startTime: String?,
    @Json(name = "end_time") val endTime: String?,
    val capacity: Int = 1,
)
