package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.JsonClass

/**
 * `POST /api/posts/:id/comments` body. `parentCommentId` is omitted for
 * top-level comments. Route: `backend/routes/posts.js:2431`.
 */
@JsonClass(generateAdapter = true)
data class PostCommentRequest(
    val comment: String,
    val parentCommentId: String? = null,
)

/** `POST /api/posts/:id/comments` envelope — returns the new row. */
@JsonClass(generateAdapter = true)
data class PostCommentCreateResponse(
    val message: String? = null,
    val comment: PostCommentDto,
)

/** `GET /api/posts/:id/comments` envelope. Route: `backend/routes/posts.js:2520`. */
@JsonClass(generateAdapter = true)
data class PostCommentsResponse(
    val comments: List<PostCommentDto> = emptyList(),
)
