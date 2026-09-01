@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * A bookable event type / service. `GET/POST /event-types`,
 * `GET/PUT/DELETE /event-types/:id`.
 *
 * `default_duration` must be a member of `durations`. `visibility` is
 * `'public'|'secret'`; `assignment_mode` is
 * `'one_on_one'|'collective'|'round_robin'|'group'`; `location_mode` is
 * `'video'|'phone'|'in_person'|'custom'|'ask'`. Paid fields (`price_cents`,
 * `deposit_cents`, `no_show_fee_cents`) sit behind the paid feature flag.
 */
@JsonClass(generateAdapter = true)
data class EventTypeDto(
    val id: String,
    @Json(name = "page_id") val pageId: String? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
    val name: String,
    val slug: String,
    val description: String? = null,
    val color: String? = null,
    val durations: List<Int> = emptyList(),
    @Json(name = "default_duration") val defaultDuration: Int? = null,
    @Json(name = "location_mode") val locationMode: String? = null,
    @Json(name = "location_detail") val locationDetail: String? = null,
    @Json(name = "assignment_mode") val assignmentMode: String? = null,
    @Json(name = "requires_approval") val requiresApproval: Boolean = false,
    val visibility: String? = null,
    @Json(name = "buffer_before_min") val bufferBeforeMin: Int? = null,
    @Json(name = "buffer_after_min") val bufferAfterMin: Int? = null,
    @Json(name = "min_notice_min") val minNoticeMin: Int? = null,
    @Json(name = "max_horizon_days") val maxHorizonDays: Int? = null,
    @Json(name = "slot_interval_min") val slotIntervalMin: Int? = null,
    @Json(name = "daily_cap") val dailyCap: Int? = null,
    @Json(name = "per_booker_cap") val perBookerCap: Int? = null,
    @Json(name = "seat_cap") val seatCap: Int? = null,
    @Json(name = "price_cents") val priceCents: Int? = null,
    val currency: String? = null,
    @Json(name = "deposit_cents") val depositCents: Int? = null,
    @Json(name = "deposit_refundable") val depositRefundable: Boolean? = null,
    @Json(name = "cancellation_window_min") val cancellationWindowMin: Int? = null,
    @Json(name = "reschedule_cutoff_min") val rescheduleCutoffMin: Int? = null,
    @Json(name = "no_show_fee_cents") val noShowFeeCents: Int? = null,
    @Json(name = "refund_policy") val refundPolicy: String? = null,
    @Json(name = "allow_invitee_cancel") val allowInviteeCancel: Boolean? = null,
    @Json(name = "allow_invitee_reschedule") val allowInviteeReschedule: Boolean? = null,
    @Json(name = "schedule_id") val scheduleId: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    @Json(name = "sort_order") val sortOrder: Int? = null,
    /** Active assignee count, aggregated by `GET /event-types` for the list's "N hosts" pill. */
    @Json(name = "assignee_count") val assigneeCount: Int? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** One assignee on an event type (round-robin / collective / group host). */
@JsonClass(generateAdapter = true)
data class EventTypeAssigneeDto(
    val id: String? = null,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
    @Json(name = "subject_id") val subjectId: String,
    @Json(name = "subject_type") val subjectType: String? = null,
    val weight: Int? = null,
    val priority: Int? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
)

/** One intake question on an event type. */
@JsonClass(generateAdapter = true)
data class EventTypeQuestionDto(
    val id: String? = null,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
    val label: String,
    @Json(name = "field_type") val fieldType: String? = null,
    val options: List<String> = emptyList(),
    val required: Boolean = false,
    @Json(name = "sort_order") val sortOrder: Int? = null,
)

/** `GET /event-types` — `{ eventTypes: [...] }`. */
@JsonClass(generateAdapter = true)
data class GetEventTypesResponse(
    val eventTypes: List<EventTypeDto> = emptyList(),
)

/** `POST /event-types`, `PUT /event-types/:id` — `{ eventType: … }`. */
@JsonClass(generateAdapter = true)
data class EventTypeResponse(
    val eventType: EventTypeDto,
)

/** `GET /event-types/:id` — event type plus its assignees and questions. */
@JsonClass(generateAdapter = true)
data class EventTypeDetailResponse(
    val eventType: EventTypeDto,
    val assignees: List<EventTypeAssigneeDto> = emptyList(),
    val questions: List<EventTypeQuestionDto> = emptyList(),
)

/**
 * Body for `POST /event-types`. `name`, `slug`, `durations` required; the rest
 * default server-side. Also used as the full create surface; partial edits go
 * through [UpdateEventTypeRequest].
 */
@JsonClass(generateAdapter = true)
data class CreateEventTypeRequest(
    val name: String,
    val slug: String,
    val durations: List<Int>,
    val description: String? = null,
    val color: String? = null,
    @Json(name = "default_duration") val defaultDuration: Int? = null,
    @Json(name = "location_mode") val locationMode: String? = null,
    @Json(name = "location_detail") val locationDetail: String? = null,
    @Json(name = "assignment_mode") val assignmentMode: String? = null,
    @Json(name = "requires_approval") val requiresApproval: Boolean? = null,
    val visibility: String? = null,
    @Json(name = "buffer_before_min") val bufferBeforeMin: Int? = null,
    @Json(name = "buffer_after_min") val bufferAfterMin: Int? = null,
    @Json(name = "min_notice_min") val minNoticeMin: Int? = null,
    @Json(name = "max_horizon_days") val maxHorizonDays: Int? = null,
    @Json(name = "slot_interval_min") val slotIntervalMin: Int? = null,
    @Json(name = "daily_cap") val dailyCap: Int? = null,
    @Json(name = "per_booker_cap") val perBookerCap: Int? = null,
    @Json(name = "seat_cap") val seatCap: Int? = null,
    @Json(name = "price_cents") val priceCents: Int? = null,
    val currency: String? = null,
    @Json(name = "deposit_cents") val depositCents: Int? = null,
    @Json(name = "deposit_refundable") val depositRefundable: Boolean? = null,
    @Json(name = "cancellation_window_min") val cancellationWindowMin: Int? = null,
    @Json(name = "reschedule_cutoff_min") val rescheduleCutoffMin: Int? = null,
    @Json(name = "no_show_fee_cents") val noShowFeeCents: Int? = null,
    @Json(name = "refund_policy") val refundPolicy: String? = null,
    @Json(name = "allow_invitee_cancel") val allowInviteeCancel: Boolean? = null,
    @Json(name = "allow_invitee_reschedule") val allowInviteeReschedule: Boolean? = null,
    @Json(name = "schedule_id") val scheduleId: String? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/**
 * Body for `PUT /event-types/:id` — every field optional (partial update).
 * Also the write surface for A3's booking-limits and A14's policy edits
 * (they PUT only the relevant fields without entering A2's folder).
 */
@JsonClass(generateAdapter = true)
data class UpdateEventTypeRequest(
    val name: String? = null,
    val slug: String? = null,
    val durations: List<Int>? = null,
    val description: String? = null,
    val color: String? = null,
    @Json(name = "default_duration") val defaultDuration: Int? = null,
    @Json(name = "location_mode") val locationMode: String? = null,
    @Json(name = "location_detail") val locationDetail: String? = null,
    @Json(name = "assignment_mode") val assignmentMode: String? = null,
    @Json(name = "requires_approval") val requiresApproval: Boolean? = null,
    val visibility: String? = null,
    @Json(name = "buffer_before_min") val bufferBeforeMin: Int? = null,
    @Json(name = "buffer_after_min") val bufferAfterMin: Int? = null,
    @Json(name = "min_notice_min") val minNoticeMin: Int? = null,
    @Json(name = "max_horizon_days") val maxHorizonDays: Int? = null,
    @Json(name = "slot_interval_min") val slotIntervalMin: Int? = null,
    @Json(name = "daily_cap") val dailyCap: Int? = null,
    @Json(name = "per_booker_cap") val perBookerCap: Int? = null,
    @Json(name = "seat_cap") val seatCap: Int? = null,
    @Json(name = "price_cents") val priceCents: Int? = null,
    val currency: String? = null,
    @Json(name = "deposit_cents") val depositCents: Int? = null,
    @Json(name = "deposit_refundable") val depositRefundable: Boolean? = null,
    @Json(name = "cancellation_window_min") val cancellationWindowMin: Int? = null,
    @Json(name = "reschedule_cutoff_min") val rescheduleCutoffMin: Int? = null,
    @Json(name = "no_show_fee_cents") val noShowFeeCents: Int? = null,
    @Json(name = "refund_policy") val refundPolicy: String? = null,
    @Json(name = "allow_invitee_cancel") val allowInviteeCancel: Boolean? = null,
    @Json(name = "allow_invitee_reschedule") val allowInviteeReschedule: Boolean? = null,
    @Json(name = "schedule_id") val scheduleId: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    // B1 FRAME 6 reorder mode — the list endpoint orders by sort_order
    // (backend/routes/scheduling.js:247; PUT patch schema :372).
    @Json(name = "sort_order") val sortOrder: Int? = null,
)

/** One assignee write entry for `PUT /event-types/:id/assignees`. */
@JsonClass(generateAdapter = true)
data class AssigneeInput(
    @Json(name = "subject_id") val subjectId: String,
    @Json(name = "subject_type") val subjectType: String? = null,
    val weight: Int? = null,
    val priority: Int? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
)

/** Body for `PUT /event-types/:id/assignees` (replace-all). */
@JsonClass(generateAdapter = true)
data class AssigneesRequest(
    val assignees: List<AssigneeInput>,
)

/** `PUT /event-types/:id/assignees` response. */
@JsonClass(generateAdapter = true)
data class AssigneesResponse(
    val assignees: List<EventTypeAssigneeDto> = emptyList(),
)

/** One question write entry for `PUT /event-types/:id/questions`. */
@JsonClass(generateAdapter = true)
data class QuestionInput(
    val label: String,
    @Json(name = "field_type") val fieldType: String? = null,
    val options: List<String>? = null,
    val required: Boolean? = null,
    @Json(name = "sort_order") val sortOrder: Int? = null,
)

/** Body for `PUT /event-types/:id/questions` (replace-all). */
@JsonClass(generateAdapter = true)
data class QuestionsRequest(
    val questions: List<QuestionInput>,
)

/** `PUT /event-types/:id/questions` response. */
@JsonClass(generateAdapter = true)
data class QuestionsResponse(
    val questions: List<EventTypeQuestionDto> = emptyList(),
)
