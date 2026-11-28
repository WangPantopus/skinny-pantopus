package app.pantopus.android.data.api.models.moments

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * "Pulse, reinvented" (CONTRACT 10b): a photo Moment's motion clip, for a reader whose switch is on. [url] is null while
 * the photo's own link is held back; the whole of it is null to anyone but the author until the clip's check passed.
 */
@JsonClass(generateAdapter = true)
data class MomentMotionDto(
    val url: String? = null,
    @Json(name = "duration_ms") val durationMs: Long? = null,
)
