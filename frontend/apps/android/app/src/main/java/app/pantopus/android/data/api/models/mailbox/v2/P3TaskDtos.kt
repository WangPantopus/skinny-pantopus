package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the mail-linked task endpoints in
 * `backend/routes/mailboxV2Phase3.js`. The list endpoint returns the flat
 * `HomeTask` shape split into active / completed buckets; there is no
 * detail-by-id route, so the Mail-task detail screen fetches the list and
 * selects by id. Only the fields the native screen maps are modelled —
 * the rich AI / checklist / next-up slots have no backend source today.
 */

/** A mail-linked task row. Route: `backend/routes/mailboxV2Phase3.js:831`. */
@JsonClass(generateAdapter = true)
data class P3TaskDto(
    val id: String,
    @Json(name = "home_id") val homeId: String? = null,
    @Json(name = "mail_id") val mailId: String? = null,
    val title: String,
    val description: String? = null,
    @Json(name = "due_at") val dueAt: String? = null,
    /** `low / medium / high`. */
    val priority: String? = null,
    /** `pending / in_progress / completed`. */
    val status: String? = null,
    @Json(name = "assigned_to") val assignedTo: String? = null,
    @Json(name = "converted_to_gig_id") val convertedToGigId: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "mail_preview") val mailPreview: String? = null,
    @Json(name = "mail_sender") val mailSender: String? = null,
)

/** Envelope for `GET /api/mailbox/v2/p3/tasks` — `{ active, completed }`. */
@JsonClass(generateAdapter = true)
data class P3TasksResponse(
    val active: List<P3TaskDto> = emptyList(),
    val completed: List<P3TaskDto> = emptyList(),
)

/**
 * Wire body for `PATCH /api/mailbox/v2/p3/tasks/:id` — route
 * `backend/routes/mailboxV2Phase3.js:935`. All fields optional; `status`
 * is one of `pending / in_progress / completed`. Moshi omits null fields,
 * so a status-only update sends just `{ "status": … }`.
 */
@JsonClass(generateAdapter = true)
data class P3TaskUpdateRequest(
    val status: String? = null,
    val title: String? = null,
    val priority: String? = null,
    val dueAt: String? = null,
)

/** Envelope for `PATCH /api/mailbox/v2/p3/tasks/:id` — `{ task }`. */
@JsonClass(generateAdapter = true)
data class P3TaskResponse(
    val task: P3TaskDto,
)
