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
)

/** Envelope for `GET /api/homes/:id/tasks`. */
@JsonClass(generateAdapter = true)
data class GetHomeTasksResponse(
    val tasks: List<HomeTaskDto> = emptyList(),
)

/** Envelope for `POST /api/homes/:id/tasks` and `PUT …/:taskId`. */
@JsonClass(generateAdapter = true)
data class HomeTaskResponse(
    val task: HomeTaskDto,
)

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
)

/**
 * Body for `PUT /api/homes/:id/tasks/:taskId`. All fields optional.
 *
 * Backend `allowed` list at `home.js:4316` accepts `title /
 * description / status / assigned_to / priority / due_at / budget /
 * details / completed_at / visibility / viewer_user_ids` —
 * `recurrence_rule` is **not** in that allowlist today. We carry
 * `recurrenceRule` on the client side so the Add/Edit Task form has
 * a single source of truth; when the backend extends its allowlist,
 * no client change is needed. Until then the field is silently
 * dropped by the server.
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
