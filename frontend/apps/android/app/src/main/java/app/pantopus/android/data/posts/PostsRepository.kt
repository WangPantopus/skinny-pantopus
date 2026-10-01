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
import app.pantopus.android.data.api.models.posts.PostLikeStateRequest
import app.pantopus.android.data.api.models.posts.PostReportRequest
import app.pantopus.android.data.api.models.posts.PostSaveResponse
import app.pantopus.android.data.api.models.posts.PostSaveStateRequest
import app.pantopus.android.data.api.models.posts.PostShareRequest
import app.pantopus.android.data.api.models.posts.PostShareResponse
import app.pantopus.android.data.api.models.posts.PostUpdateRequest
import app.pantopus.android.data.api.models.posts.PostUpdateResponse
import app.pantopus.android.data.api.models.posts.SavedPostsResponse
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
            radiusMiles: Double? = null,
        ): NetworkResult<FeedResponse> =
            safeApiCall {
                api.feed(
                    surface = surface,
                    latitude = latitude,
                    longitude = longitude,
                    radiusMiles = radiusMiles,
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

        /** `POST /api/posts/:id/like`: sets the like to [liked], the state the person chose (a re-send can't flip it back). */
        suspend fun toggleLike(
            id: String,
            liked: Boolean,
        ): NetworkResult<PostLikeResponse> = safeApiCall { api.toggleLike(id, PostLikeStateRequest(liked)) }

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
         * user. T5.3.3 My posts uses the signed-in user's id with
         * [includeArchived], so its Archived tab survives a reload; the
         * backend ignores the flag for anyone else's list.
         */
        suspend fun userPosts(
            userId: String,
            limit: Int = 50,
            cursorCreatedAt: String? = null,
            cursorId: String? = null,
            includeArchived: Boolean = false,
        ): NetworkResult<MyPostsResponse> =
            safeApiCall { api.userPosts(userId, limit, cursorCreatedAt, cursorId, includeArchived.takeIf { it }) }

        /** `GET /api/posts/saved` — My posts' Saved tab. */
        suspend fun savedPosts(
            limit: Int = 50,
            offset: Int = 0,
        ): NetworkResult<SavedPostsResponse> = safeApiCall { api.savedPosts(limit, offset) }

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
            liked: Boolean,
        ): NetworkResult<CommentLikeResponse> = safeApiCall { api.toggleCommentLike(postId, commentId, PostLikeStateRequest(liked)) }

        /** `DELETE /api/posts/:postId/comments/:commentId`. */
        suspend fun deleteComment(
            postId: String,
            commentId: String,
        ): NetworkResult<PostActionAckResponse> = safeApiCall { api.deleteComment(postId, commentId) }

        /** `POST /api/posts/:id/share`. */
        suspend fun share(
            id: String,
            shareType: String = "external",
            reposted: Boolean? = null,
        ): NetworkResult<PostShareResponse> = safeApiCall { api.share(id, PostShareRequest(shareType = shareType, reposted = reposted)) }

        /** `POST /api/posts/:id/report`. */
        suspend fun report(
            id: String,
            reason: String,
            details: String? = null,
        ): NetworkResult<PostActionAckResponse> = safeApiCall { api.report(id, PostReportRequest(reason = reason, details = details)) }

        /** `POST /api/posts/:id/save`. */
        suspend fun toggleSave(
            id: String,
            saved: Boolean,
        ): NetworkResult<PostSaveResponse> = safeApiCall { api.toggleSave(id, PostSaveStateRequest(saved)) }

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
