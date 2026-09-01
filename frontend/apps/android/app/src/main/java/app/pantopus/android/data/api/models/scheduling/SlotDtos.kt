@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * A bookable time slot. The universal currency of every slot/calendar read.
 *
 * `start`/`end` are UTC ISO 8601; `startLocal` is the same instant rendered in
 * the `tz` (IANA) the caller passed — **render `startLocal`, store/compare
 * `start` (UTC)** per the global wiring contract. `eligibleHosts` lists the
 * user IDs that can take the slot (host reschedule/reassign, round-robin,
 * find-a-time); it is omitted on public invitee reads.
 */
@JsonClass(generateAdapter = true)
data class SlotDto(
    val start: String,
    val end: String? = null,
    @Json(name = "startLocal") val startLocal: String? = null,
    @Json(name = "eligibleHosts") val eligibleHosts: List<String>? = null,
)

/**
 * `GET /bookings/:id/available-slots` and `GET /booking/:token/available-slots`
 * (public). Slots for host reschedule/reassign or invitee reschedule.
 */
@JsonClass(generateAdapter = true)
data class AvailableSlotsResponse(
    val slots: List<SlotDto> = emptyList(),
)

/**
 * Body for `POST /find-a-time` (home-only). The live backend route is a POST
 * that reads these from the request body (findATimeSchema), not a GET with
 * query params. `member_ids` is required; owner is implied by the home alias
 * path so owner fields stay null.
 */
@JsonClass(generateAdapter = true)
data class FindATimeRequest(
    @Json(name = "member_ids") val memberIds: List<String>,
    val from: String,
    val to: String,
    val mode: String? = null,
    @Json(name = "duration_min") val durationMin: Int? = null,
    @Json(name = "slot_interval_min") val slotIntervalMin: Int? = null,
    val timezone: String? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/**
 * `POST /find-a-time` (home-only) — common free slots across the selected home
 * members. `eligibleHosts` carries the member IDs free for that slot.
 */
@JsonClass(generateAdapter = true)
data class FindATimeResponse(
    val slots: List<SlotDto> = emptyList(),
)

/**
 * `GET /whos-free` (home-only) and `GET /team-availability` (business-only).
 * Per-member free grids — `freeByMember[userId] -> slots`.
 */
@JsonClass(generateAdapter = true)
data class FreeByMemberResponse(
    val members: List<String> = emptyList(),
    @Json(name = "freeByMember") val freeByMember: Map<String, List<SlotDto>> = emptyMap(),
)
