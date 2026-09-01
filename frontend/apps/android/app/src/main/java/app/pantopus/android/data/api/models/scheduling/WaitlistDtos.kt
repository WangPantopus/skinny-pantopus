@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Event-type waitlist. `GET /event-types/:id/waitlist`,
 * `POST /waitlist/:id/promote`. Public join is `PublicWaitlistJoinRequest`
 * (see PublicBookingDtos).
 */
@JsonClass(generateAdapter = true)
data class WaitlistEntryDto(
    val id: String,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
    @Json(name = "invitee_name") val inviteeName: String? = null,
    @Json(name = "invitee_email") val inviteeEmail: String? = null,
    @Json(name = "invitee_user_id") val inviteeUserId: String? = null,
    val status: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** `GET /event-types/:id/waitlist` — `{ waitlist: [...] }`. */
@JsonClass(generateAdapter = true)
data class GetWaitlistResponse(
    val waitlist: List<WaitlistEntryDto> = emptyList(),
)
