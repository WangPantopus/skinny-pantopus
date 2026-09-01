package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** `POST /:postId/comments/:commentId/like` response — `backend/routes/posts.js:2554`. */
@JsonClass(generateAdapter = true)
data class CommentLikeResponse(
    val liked: Boolean,
    @Json(name = "likeCount") val likeCount: Int = 0,
)

/** `POST /:id/share` request body. `shareType` is `external` or `repost`. */
@JsonClass(generateAdapter = true)
data class PostShareRequest(
    @Json(name = "shareType") val shareType: String,
)

/** `POST /:id/share` response — repost toggles return `reposted`. */
@JsonClass(generateAdapter = true)
data class PostShareResponse(
    val shared: Boolean? = null,
    val reposted: Boolean? = null,
    @Json(name = "shareCount") val shareCount: Int? = null,
)

/** `POST /:id/report` request body. */
@JsonClass(generateAdapter = true)
data class PostReportRequest(
    val reason: String,
    val details: String? = null,
)

/** `POST /:id/save` response — `backend/routes/posts.js:3294`. */
@JsonClass(generateAdapter = true)
data class PostSaveResponse(
    val message: String? = null,
    val saved: Boolean,
)

/** Message-only acknowledgement (report / delete-comment routes). */
@JsonClass(generateAdapter = true)
data class PostActionAckResponse(
    val message: String? = null,
)

/** `GET /api/posts/place-eligibility` response — `backend/routes/posts.js:1941`. */
@JsonClass(generateAdapter = true)
data class PlaceEligibilityResponse(
    val eligible: Boolean,
    val readOnly: Boolean? = null,
    val reason: String? = null,
    val trustLevel: String? = null,
)
