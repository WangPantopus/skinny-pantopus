@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Scheduling automations. `GET/POST /workflows`, `PUT/DELETE /workflows/:id`.
 * `trigger` ∈ `booking_created|cancelled|rescheduled|before_start|after_end`;
 * `action` ∈ `email|push|in_app|sms`. `offset_minutes` applies to the
 * `before_start`/`after_end` triggers.
 */
@JsonClass(generateAdapter = true)
data class WorkflowDto(
    val id: String,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
    val name: String,
    val trigger: String? = null,
    @Json(name = "offset_minutes") val offsetMinutes: Int? = null,
    val action: String? = null,
    @Json(name = "message_template") val messageTemplate: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** `GET /workflows` — `{ workflows: [...] }`. */
@JsonClass(generateAdapter = true)
data class GetWorkflowsResponse(
    val workflows: List<WorkflowDto> = emptyList(),
)

/** `POST/PUT /workflows` — `{ workflow: … }`. */
@JsonClass(generateAdapter = true)
data class WorkflowResponse(
    val workflow: WorkflowDto,
)

/** Body for `POST /workflows`. */
@JsonClass(generateAdapter = true)
data class CreateWorkflowRequest(
    val name: String,
    val trigger: String,
    val action: String,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
    @Json(name = "offset_minutes") val offsetMinutes: Int? = null,
    @Json(name = "message_template") val messageTemplate: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/** Body for `PUT /workflows/:id` (partial). */
@JsonClass(generateAdapter = true)
data class UpdateWorkflowRequest(
    val name: String? = null,
    val trigger: String? = null,
    val action: String? = null,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
    @Json(name = "offset_minutes") val offsetMinutes: Int? = null,
    @Json(name = "message_template") val messageTemplate: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
)
