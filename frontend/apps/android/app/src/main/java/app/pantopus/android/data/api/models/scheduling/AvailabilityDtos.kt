@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Availability schedules/rules/overrides/blocks. **Always personal**
 * (`req.user`) — no owner context, even on the home alias mount.
 * `GET /availability`, `POST /availability`, `PUT/DELETE /availability/:id`,
 * `PUT /availability/:id/{rules,overrides}`, `POST/DELETE /availability/blocks`.
 */
@JsonClass(generateAdapter = true)
data class AvailabilityScheduleDto(
    val id: String,
    @Json(name = "user_id") val userId: String? = null,
    val name: String? = null,
    val timezone: String? = null,
    @Json(name = "is_default") val isDefault: Boolean = false,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** A weekly availability rule. `weekday` is ISO `0=Sunday … 6=Saturday`; times are `HH:MM`/`HH:MM:SS`. */
@JsonClass(generateAdapter = true)
data class AvailabilityRuleDto(
    val id: String? = null,
    @Json(name = "schedule_id") val scheduleId: String? = null,
    val weekday: Int,
    @Json(name = "start_time") val startTime: String,
    @Json(name = "end_time") val endTime: String,
)

/** A date-level override. `is_unavailable=true` blocks the whole day; else partial-day window. */
@JsonClass(generateAdapter = true)
data class AvailabilityOverrideDto(
    val id: String? = null,
    @Json(name = "schedule_id") val scheduleId: String? = null,
    val date: String,
    @Json(name = "is_unavailable") val isUnavailable: Boolean = false,
    @Json(name = "start_time") val startTime: String? = null,
    @Json(name = "end_time") val endTime: String? = null,
)

/** An ad-hoc time block (vacation, lunch). Optional RRULE for recurrence. */
@JsonClass(generateAdapter = true)
data class AvailabilityBlockDto(
    val id: String,
    @Json(name = "user_id") val userId: String? = null,
    val title: String? = null,
    @Json(name = "start_at") val startAt: String,
    @Json(name = "end_at") val endAt: String,
    @Json(name = "recurrence_rule") val recurrenceRule: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** `GET /availability` — schedules + rules + overrides in one payload. */
@JsonClass(generateAdapter = true)
data class GetAvailabilityResponse(
    val schedules: List<AvailabilityScheduleDto> = emptyList(),
    val rules: List<AvailabilityRuleDto> = emptyList(),
    val overrides: List<AvailabilityOverrideDto> = emptyList(),
)

/** `POST/PUT /availability` — `{ schedule: … }`. */
@JsonClass(generateAdapter = true)
data class ScheduleResponse(
    val schedule: AvailabilityScheduleDto,
)

/** Body for `POST /availability`. */
@JsonClass(generateAdapter = true)
data class CreateScheduleRequest(
    val name: String? = null,
    val timezone: String,
    @Json(name = "is_default") val isDefault: Boolean? = null,
)

/** Body for `PUT /availability/:id` (at least one field). */
@JsonClass(generateAdapter = true)
data class UpdateScheduleRequest(
    val name: String? = null,
    val timezone: String? = null,
    @Json(name = "is_default") val isDefault: Boolean? = null,
)

/** One weekly rule write entry. */
@JsonClass(generateAdapter = true)
data class RuleInput(
    val weekday: Int,
    @Json(name = "start_time") val startTime: String,
    @Json(name = "end_time") val endTime: String,
)

/** Body for `PUT /availability/:id/rules` (replace-all). */
@JsonClass(generateAdapter = true)
data class RulesRequest(
    val rules: List<RuleInput>,
)

/** `PUT /availability/:id/rules` response. */
@JsonClass(generateAdapter = true)
data class RulesResponse(
    val rules: List<AvailabilityRuleDto> = emptyList(),
)

/** One override write entry. */
@JsonClass(generateAdapter = true)
data class OverrideInput(
    val date: String,
    @Json(name = "is_unavailable") val isUnavailable: Boolean? = null,
    @Json(name = "start_time") val startTime: String? = null,
    @Json(name = "end_time") val endTime: String? = null,
)

/** Body for `PUT /availability/:id/overrides` (replace-all). */
@JsonClass(generateAdapter = true)
data class OverridesRequest(
    val overrides: List<OverrideInput>,
)

/** `PUT /availability/:id/overrides` response. */
@JsonClass(generateAdapter = true)
data class OverridesResponse(
    val overrides: List<AvailabilityOverrideDto> = emptyList(),
)

/** Body for `POST /availability/blocks`. */
@JsonClass(generateAdapter = true)
data class CreateBlockRequest(
    val title: String? = null,
    @Json(name = "start_at") val startAt: String,
    @Json(name = "end_at") val endAt: String,
    @Json(name = "recurrence_rule") val recurrenceRule: String? = null,
)

/** `POST /availability/blocks` — `{ block: … }`. */
@JsonClass(generateAdapter = true)
data class BlockResponse(
    val block: AvailabilityBlockDto,
)
