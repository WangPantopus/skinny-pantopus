@file:Suppress("LongParameterList")

package app.pantopus.android.data.posts

import app.pantopus.android.data.api.models.feed.FeedResponse
import app.pantopus.android.data.api.models.posts.CommentLikeResponse
import app.pantopus.android.data.api.models.posts.MyPostsResponse
import app.pantopus.android.data.api.models.posts.PlaceEligibilityResponse
import app.pantopus.android.data.api.models.posts.PostActionAckResponse
import app.pantopus.android.data.api.models.posts.PostArchiveResponse
import app.pantopus.android.data.api.models.posts.PostCommentCreateResponse
import app.pantopus.android.data.api.models.posts.PostCommentRequest
import app.pantopus.android.data.api.models.posts.PostCommentsResponse
import app.pantopus.android.data.api.models.posts.PostCreateRequest
import app.pantopus.android.data.api.models.posts.PostCreateResponse
import app.pantopus.android.data.api.models.posts.PostDetailResponse
import app.pantopus.android.data.api.models.posts.PostLikeResponse
import app.pantopus.android.data.api.models.posts.PostReportRequest
import app.pantopus.android.data.api.models.posts.PostSaveResponse
import app.pantopus.android.data.api.models.posts.PostShareRequest
import app.pantopus.android.data.api.models.posts.PostShareResponse
import app.pantopus.android.data.api.models.posts.PostUpdateRequest
import app.pantopus.android.data.api.models.posts.PostUpdateResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PostsApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [PostsApi] in the [NetworkResult] taxonomy. */
@Singleton
class PostsRepository
    @Inject
    constructor(
        private val api: PostsApi,
    ) {
        /** `GET /api/posts/feed`. */
        suspend fun feed(
            surface: String = "place",
            latitude: Double? = null,
            longitude: Double? = null,
            postType: String? = null,
            limit: Int = 20,
            cursorCreatedAt: String? = null,
            cursorId: String? = null,
            topic: String? = null,
            sportsMode: String? = null,
            eventKey: String? = null,
        ): NetworkResult<FeedResponse> =
            safeApiCall {
                api.feed(
                    surface = surface,
                    latitude = latitude,
                    longitude = longitude,
                    postType = postType,
                    limit = limit,
                    cursorCreatedAt = cursorCreatedAt,
                    cursorId = cursorId,
                    topic = topic,
                    sportsMode = sportsMode,
                    eventKey = eventKey,
                )
            }

        /** `POST /api/posts` — create a new post. */
        suspend fun createPost(body: PostCreateRequest): NetworkResult<PostCreateResponse> = safeApiCall { api.createPost(body) }

        /** `PATCH /api/posts/:id` — author-only edit. */
        suspend fun updatePost(
            id: String,
            body: PostUpdateRequest,
        ): NetworkResult<PostUpdateResponse> = safeApiCall { api.updatePost(id, body) }

        /** `GET /api/posts/:id`. */
        suspend fun detail(id: String): NetworkResult<PostDetailResponse> = safeApiCall { api.detail(id) }

        /** `POST /api/posts/:id/like`. */
        suspend fun toggleLike(id: String): NetworkResult<PostLikeResponse> = safeApiCall { api.toggleLike(id) }

        /** `GET /api/posts/:id/comments`. */
        suspend fun comments(
            id: String,
            limit: Int = 50,
            offset: Int = 0,
        ): NetworkResult<PostCommentsResponse> = safeApiCall { api.comments(id, limit, offset) }

        /** `POST /api/posts/:id/comments`. */
        suspend fun createComment(
            id: String,
            body: PostCommentRequest,
        ): NetworkResult<PostCommentCreateResponse> = safeApiCall { api.createComment(id, body) }

        /**
         * `GET /api/posts/user/:userId` — paged list of posts authored by a
         * user. T5.3.3 My posts uses the signed-in user's id. Backend filters
         * archived posts out today; the Archived tab is fed by local
         * optimistic state until a `?status=archived` filter ships.
         */
        suspend fun userPosts(
            userId: String,
            limit: Int = 50,
        ): NetworkResult<MyPostsResponse> = safeApiCall { api.userPosts(userId, limit) }

        /** `DELETE /api/posts/:id`. */
        suspend fun deletePost(id: String): NetworkResult<Unit> = safeApiCall { api.deletePost(id) }

        /** `POST /api/posts/:id/archive`. */
        suspend fun archivePost(id: String): NetworkResult<PostArchiveResponse> = safeApiCall { api.archivePost(id) }

        /** `POST /api/posts/:id/unarchive`. */
        suspend fun unarchivePost(id: String): NetworkResult<PostArchiveResponse> = safeApiCall { api.unarchivePost(id) }

        /** `POST /api/posts/:postId/comments/:commentId/like`. */
        suspend fun toggleCommentLike(
            postId: String,
            commentId: String,
        ): NetworkResult<CommentLikeResponse> = safeApiCall { api.toggleCommentLike(postId, commentId) }

        /** `DELETE /api/posts/:postId/comments/:commentId`. */
        suspend fun deleteComment(
            postId: String,
            commentId: String,
        ): NetworkResult<PostActionAckResponse> = safeApiCall { api.deleteComment(postId, commentId) }

        /** `POST /api/posts/:id/share`. */
        suspend fun share(
            id: String,
            shareType: String = "external",
        ): NetworkResult<PostShareResponse> = safeApiCall { api.share(id, PostShareRequest(shareType = shareType)) }

        /** `POST /api/posts/:id/report`. */
        suspend fun report(
            id: String,
            reason: String,
            details: String? = null,
        ): NetworkResult<PostActionAckResponse> = safeApiCall { api.report(id, PostReportRequest(reason = reason, details = details)) }

        /** `POST /api/posts/:id/save`. */
        suspend fun toggleSave(id: String): NetworkResult<PostSaveResponse> = safeApiCall { api.toggleSave(id) }

        /** `GET /api/posts/place-eligibility`. */
        suspend fun placeEligibility(
            latitude: Double,
            longitude: Double,
            gpsTimestamp: String? = null,
            gpsLatitude: Double? = null,
            gpsLongitude: Double? = null,
        ): NetworkResult<PlaceEligibilityResponse> =
            safeApiCall {
                api.placeEligibility(
                    latitude = latitude,
                    longitude = longitude,
                    gpsTimestamp = gpsTimestamp,
                    gpsLatitude = gpsLatitude,
                    gpsLongitude = gpsLongitude,
                )
            }
    }
