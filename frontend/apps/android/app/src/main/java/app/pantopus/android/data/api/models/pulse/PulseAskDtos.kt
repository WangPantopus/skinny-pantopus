package app.pantopus.android.data.api.models.pulse

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Where an Ask stands after the asker kept it open or closed it (contract section 2.12). */
@JsonClass(generateAdapter = true)
data class PulsePostStatusDto(
    /** `open` or `resolved`. */
    val state: String? = null,
    /** `closed` or `closed_unanswered` once closed; null while open. */
    val resolution: String? = null,
    /** When the Ask now ends. */
    @Json(name = "ends_at") val endsAt: String? = null,
)

/** `POST /api/pulse/posts/:postId/keep-open` and `…/close` reply. */
@JsonClass(generateAdapter = true)
data class PulsePostStatusResponse(
    @Json(name = "post_status") val postStatus: PulsePostStatusDto? = null,
)
