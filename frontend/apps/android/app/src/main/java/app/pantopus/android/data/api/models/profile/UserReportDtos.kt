package app.pantopus.android.data.api.models.profile

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `POST /api/users/:userId/report` body — route
 * `backend/routes/users.js:4153`. The backend Joi schema (`users.js:4137`)
 * accepts `reason` in {`spam`, `harassment`, `inappropriate`,
 * `misinformation`, `safety`, `other`} and an optional `details` capped
 * server-side at 1 000 chars.
 */
@JsonClass(generateAdapter = true)
data class UserReportRequest(
    val reason: String,
    val details: String?,
)

/** `POST /api/users/:userId/report` response. */
@JsonClass(generateAdapter = true)
data class UserReportResponse(
    val message: String?,
    @Json(name = "already_reported") val alreadyReported: Boolean?,
)
