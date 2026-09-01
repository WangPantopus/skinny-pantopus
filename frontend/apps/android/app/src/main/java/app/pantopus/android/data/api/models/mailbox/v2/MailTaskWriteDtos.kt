package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.JsonClass

/**
 * Write-side DTOs for the mail-linked task endpoints in
 * `backend/routes/mailboxV2Phase3.js`. Read-side shapes live in
 * `P3TaskDtos.kt`; these cover the two routes the Mail-tasks list surface
 * adds — create-from-mail and convert-to-neighbor-gig. Both Joi
 * validators take camelCase keys (`createTaskSchema` at :65,
 * `taskToGigSchema` at :81), so no `@Json(name = …)` mapping is needed.
 */

/**
 * Wire body for `POST /api/mailbox/v2/p3/tasks/from-mail` — route
 * `backend/routes/mailboxV2Phase3.js:886`. `mailId` and `homeId` must be
 * UUIDs; `priority` is `low / medium / high`. Moshi omits null fields,
 * which the schema accepts.
 */
@JsonClass(generateAdapter = true)
data class P3CreateTaskFromMailRequest(
    val mailId: String,
    val homeId: String,
    val title: String,
    val description: String? = null,
    val dueAt: String? = null,
    val priority: String = "medium",
)

/**
 * Wire body for `POST /api/mailbox/v2/p3/tasks/:id/to-gig` — route
 * `backend/routes/mailboxV2Phase3.js:977`. Everything optional; the
 * backend falls back to the task's own title / description.
 */
@JsonClass(generateAdapter = true)
data class P3TaskToGigRequest(
    val title: String? = null,
    val description: String? = null,
    val compensation: Double? = null,
)

/**
 * Envelope for `POST /api/mailbox/v2/p3/tasks/:id/to-gig` —
 * `{ gigId, title }` (camelCase on the wire, see the handler's
 * `res.json` at `backend/routes/mailboxV2Phase3.js:1017`).
 */
@JsonClass(generateAdapter = true)
data class P3TaskToGigResponse(
    val gigId: String,
    val title: String? = null,
)
