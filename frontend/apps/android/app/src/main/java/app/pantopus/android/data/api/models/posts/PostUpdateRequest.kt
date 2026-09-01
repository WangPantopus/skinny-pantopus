package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `PATCH /api/posts/:id` request body. Mirrors `updatePostSchema` at
 * `backend/routes/posts.js:298-328` — a strict subset of the create
 * schema (no `postAs`, `audience`, `businessName`, `purpose`; the
 * identity + audience tag are fixed at create time). Joi's `.min(1)`
 * requires at least one key.
 */
@JsonClass(generateAdapter = true)
data class PostUpdateRequest(
    val content: String? = null,
    val title: String? = null,
    val visibility: String? = null,
    @Json(name = "eventDate") val eventDate: String? = null,
    @Json(name = "eventVenue") val eventVenue: String? = null,
    @Json(name = "lostFoundType") val lostFoundType: String? = null,
    @Json(name = "serviceCategory") val serviceCategory: String? = null,
    @Json(name = "dealBusinessName") val dealBusinessName: String? = null,
)

/**
 * `PATCH /api/posts/:id` response envelope — the backend echoes a thin
 * ack plus the updated row. We only surface the id so the caller can
 * navigate back to it.
 */
@JsonClass(generateAdapter = true)
data class PostUpdateResponse(
    val message: String? = null,
    val post: PostUpdateResponsePost? = null,
) {
    /** Nested post payload — we only need the id. */
    val postId: String?
        get() = post?.id
}

/** Just enough of the wire `post` to surface the id for navigation. */
@JsonClass(generateAdapter = true)
data class PostUpdateResponsePost(
    val id: String,
)
