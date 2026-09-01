package app.pantopus.android.data.api.models.hub

import com.squareup.moshi.JsonClass

/**
 * Body for `POST /api/hub/dismiss-density-milestone`
 * (`backend/routes/hub.js:1026`). `milestone` must be numeric — the
 * handler 400s otherwise.
 */
@JsonClass(generateAdapter = true)
data class DismissDensityMilestoneRequest(
    val homeId: String,
    val milestone: Int,
)

/**
 * `{ ok: true }` ack from `POST /api/hub/dismiss-density-milestone`
 * (`backend/routes/hub.js:1045`).
 */
@JsonClass(generateAdapter = true)
data class DismissDensityMilestoneResponse(
    val ok: Boolean? = null,
)
