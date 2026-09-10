@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One row from `GET /api/homes/:id/tasks` —
 * `backend/routes/home.js:4170`.
 *
 * This is the per-home HOUSEHOLD chore — internal "who's vacuuming,
 * taking out the trash, walking the dog" — NOT to be confused with
 * [app.pantopus.android.data.api.models.gigs.GigDto] (the
 * posted-to-neighbours gig list reached via `me.gigs`).
 *
 * Per the schema (`backend/database/schema.sql:6833`):
 *  - `status` is one of `open / in_progress / done / canceled`
 *  - `task_type` is one of `chore / shopping / project / reminder / repair`
 *  - `recurrence_rule` is a free-form RRULE string (NULL = one-off)
 */
@JsonClass(generateAdapter = true)
data class HomeTaskDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "task_type") val taskType: String,
    val title: String,
    val description: String? = null,
    @Json(name = "assigned_to") val assignedTo: String? = null,
    @Json(name = "due_at") val dueAt: String? = null,
    @Json(name = "recurrence_rule") val recurrenceRule: String? = null,
    val status: String = "open",
    val priority: String? = null,
    @Json(name = "completed_at") val completedAt: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    val visibility: String? = null,
    val capabilities: HomeTaskCapabilitiesDto? = null,
)

/** Missing capabilities never enable an action. */
@JsonClass(generateAdapter = true)
data class HomeTaskCapabilitiesDto(
    @Json(name = "can_edit") val canEdit: Boolean = false,
    @Json(name = "can_complete") val canComplete: Boolean = false,
    @Json(name = "can_delete") val canDelete: Boolean = false,
    @Json(name = "can_upload") val canUpload: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class HomeTaskCollectionCapabilitiesDto(
    @Json(name = "can_create") val canCreate: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class HomeTaskSessionDto(
    @Json(name = "actor_id") val actorId: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "session_scope") val sessionScope: String,
)

/** Envelope for `GET /api/homes/:id/tasks`. */
@JsonClass(generateAdapter = true)
data class GetHomeTasksResponse(
    val tasks: List<HomeTaskDto> = emptyList(),
    @Json(name = "collection_capabilities") val collectionCapabilities: HomeTaskCollectionCapabilitiesDto? = null,
    @Json(name = "task_session") val taskSession: HomeTaskSessionDto? = null,
)

/** Envelope for `POST /api/homes/:id/tasks` and `PUT …/:taskId`. */
@JsonClass(generateAdapter = true)
data class HomeTaskResponse(
    val task: HomeTaskDto,
    @Json(name = "task_session") val taskSession: HomeTaskSessionDto? = null,
)

@JsonClass(generateAdapter = true)
data class HomeTaskDeleteResponse(val message: String)

/**
 * Body for `POST /api/homes/:id/tasks`. `task_type` and `title` are
 * required; everything else is optional (see backend validation at
 * `home.js:4252`).
 */
@JsonClass(generateAdapter = true)
data class CreateHomeTaskRequest(
    @Json(name = "task_type") val taskType: String,
    val title: String,
    val description: String? = null,
    @Json(name = "assigned_to") val assignedTo: String? = null,
    @Json(name = "due_at") val dueAt: String? = null,
    @Json(name = "recurrence_rule") val recurrenceRule: String? = null,
    val priority: String? = null,
    @Json(name = "request_id") val requestId: String? = null,
)

/**
 * Body for `PUT /api/homes/:id/tasks/:taskId`. All fields optional.
 *
 * Used for status-only completion. The form uses HomeTaskEditPatch
 * so omitted fields and explicit nullable clears remain distinct.
 */
@JsonClass(generateAdapter = true)
data class UpdateHomeTaskRequest(
    val status: String? = null,
    val title: String? = null,
    val description: String? = null,
    @Json(name = "assigned_to") val assignedTo: String? = null,
    @Json(name = "due_at") val dueAt: String? = null,
    @Json(name = "recurrence_rule") val recurrenceRule: String? = null,
    val priority: String? = null,
    @Json(name = "completed_at") val completedAt: String? = null,
)
