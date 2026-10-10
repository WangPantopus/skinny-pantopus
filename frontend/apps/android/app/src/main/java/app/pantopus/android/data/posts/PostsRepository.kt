@file:Suppress("LongParameterList")

package app.pantopus.android.data.posts

import app.pantopus.android.data.api.models.feed.FeedPost
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
import app.pantopus.android.data.api.models.posts.PostCreatorDto
import app.pantopus.android.data.api.models.posts.PostDetailDto
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
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PostsApi
import app.pantopus.android.data.store.ScreenSeeds
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import javax.inject.Inject
import javax.inject.Singleton

/**
 * One feed query, the first page's store key and its request (Instant Screens). Coordinates arrive rounded with
 * [StoreKeys.roundCoordinate], so a few meters of GPS drift reuse the copy.
 */
data class FeedQuery(
    val surface: String,
    val latitude: Double?,
    val longitude: Double?,
    val radiusMiles: Double?,
    val postType: String?,
    val topic: String?,
    val sportsMode: String?,
    val eventKey: String?,
) {
    companion object {
        /** Posts per page, the first and every later one. */
        const val PAGE_SIZE = 20
    }
}

/** Wraps [PostsApi] in the [NetworkResult] taxonomy. */
@Singleton
@Suppress("TooManyFunctions") // One wrapper per existing post endpoint; keep the shared store and mutations together.
class PostsRepository
    @Inject
    constructor(
        private val api: PostsApi,
        private val store: ScreenStore,
        private val seeds: ScreenSeeds,
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

        /**
         * A feed query's first page through the screens' store (contract §4 "Nearby": fresh 2 minutes; [force] reads
         * now). Later pages go through [feed] with their cursor and are never stored.
         */
        suspend fun feedFirstPageStored(
            query: FeedQuery,
            force: Boolean = false,
        ): Stored<FeedResponse> =
            store.read(StoreKeys.feedFirstPage(query), force) { etag ->
                conditionalApiCall {
                    api.feedConditional(
                        surface = query.surface,
                        latitude = query.latitude,
                        longitude = query.longitude,
                        radiusMiles = query.radiusMiles,
                        postType = query.postType,
                        limit = FeedQuery.PAGE_SIZE,
                        topic = query.topic,
                        sportsMode = query.sportsMode,
                        eventKey = query.eventKey,
                        etag = etag,
                    )
                }
            }

        /** The stored first page of [query] as it is now (a first frame), without a request. */
        fun feedFirstPageCopy(query: FeedQuery): FeedResponse? = store.peek(StoreKeys.feedFirstPage(query)).data

        /** True while [query]'s first page is fresh and unmarked: coming back reads nothing. */
        fun feedFirstPageIsCurrent(query: FeedQuery): Boolean = store.isCurrent(StoreKeys.feedFirstPage(query))

        /** `POST /api/posts` — create a new post. */
        suspend fun createPost(body: PostCreateRequest): NetworkResult<PostCreateResponse> =
            safeApiCall { api.createPost(body) }.also(::markPostsChanged)

        /** `PATCH /api/posts/:id` — author-only edit. */
        suspend fun updatePost(
            id: String,
            body: PostUpdateRequest,
        ): NetworkResult<PostUpdateResponse> = safeApiCall { api.updatePost(id, body) }.also(::markPostsChanged)

        /** `GET /api/posts/:id`. */
        suspend fun detail(id: String): NetworkResult<PostDetailResponse> = safeApiCall { api.detail(id) }

        /** A post and its comments through the screens' store (contract §4 "A post": fresh 1 minute; [force] reads now). */
        suspend fun detailStored(
            id: String,
            force: Boolean = false,
        ): Stored<PostDetailResponse> =
            store.read(StoreKeys.post(id), force) { etag -> conditionalApiCall { api.detailConditional(id, etag) } }

        /**
         * The post's stored copy or, without one, its feed card standing in for it (`fetchedAt` 0: never fresh, and no
         * comments yet), without a request.
         */
        fun detailCopy(id: String): Stored<PostDetailResponse> {
            val stored = store.peek(StoreKeys.post(id))
            if (stored.data != null) return stored
            return seeds.get(StoreKeys.post(id))?.let { Stored(it) } ?: stored
        }

        /** The feed's cards stand in for their posts until each post's own read answers (a post opens at once). */
        fun seedDetails(posts: List<FeedPost>) {
            posts.forEach { post -> post.detailSeed()?.let { seeds.put(StoreKeys.post(post.id), it) } }
        }

        /** `POST /api/posts/:id/like`: sets the like to [liked], the state the person chose (a re-send can't flip it back). */
        suspend fun toggleLike(
            id: String,
            liked: Boolean,
        ): NetworkResult<PostLikeResponse> =
            safeApiCall { api.toggleLike(id, PostLikeStateRequest(liked)) }.also { markPostChanged(id, it) }

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
        ): NetworkResult<PostCommentCreateResponse> = safeApiCall { api.createComment(id, body) }.also { markPostChanged(id, it) }

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
        suspend fun deletePost(id: String): NetworkResult<Unit> = safeApiCall { api.deletePost(id) }.also(::markPostsChanged)

        /** `POST /api/posts/:id/archive`. */
        suspend fun archivePost(id: String): NetworkResult<PostArchiveResponse> =
            safeApiCall { api.archivePost(id) }.also(::markPostsChanged)

        /** `POST /api/posts/:id/unarchive`. */
        suspend fun unarchivePost(id: String): NetworkResult<PostArchiveResponse> =
            safeApiCall { api.unarchivePost(id) }.also(::markPostsChanged)

        /** `POST /api/posts/:postId/comments/:commentId/like`. */
        suspend fun toggleCommentLike(
            postId: String,
            commentId: String,
            liked: Boolean,
        ): NetworkResult<CommentLikeResponse> =
            safeApiCall { api.toggleCommentLike(postId, commentId, PostLikeStateRequest(liked)) }.also { markPostChanged(postId, it) }

        /** `DELETE /api/posts/:postId/comments/:commentId`. */
        suspend fun deleteComment(
            postId: String,
            commentId: String,
        ): NetworkResult<PostActionAckResponse> =
            safeApiCall { api.deleteComment(postId, commentId) }.also { markPostChanged(postId, it) }

        /** `POST /api/posts/:id/share`. */
        suspend fun share(
            id: String,
            shareType: String = "external",
            reposted: Boolean? = null,
        ): NetworkResult<PostShareResponse> =
            safeApiCall { api.share(id, PostShareRequest(shareType = shareType, reposted = reposted)) }.also { markPostChanged(id, it) }

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
        ): NetworkResult<PostSaveResponse> =
            safeApiCall { api.toggleSave(id, PostSaveStateRequest(saved)) }.also { markPostChanged(id, it) }

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

        /** An own post created, edited, deleted or archived: every feed's stored first page goes out of date. */
        private fun markPostsChanged(result: NetworkResult<*>) {
            if (result is NetworkResult.Success) store.markStale(StoreTopics.POSTS)
        }

        /** An own action on a post (a like, a comment, a save, a repost): its stored copy goes out of date. */
        private fun markPostChanged(
            postId: String,
            result: NetworkResult<*>,
        ) {
            if (result is NetworkResult.Success) store.markStale("post:$postId")
        }
    }

/** A feed card as the post's stand-in: what the card shows, no comments yet. Cards without an author aren't posts. */
private fun FeedPost.detailSeed(): PostDetailResponse? {
    val author = userId ?: return null
    if (isSeeded) return null
    return PostDetailResponse(
        PostDetailDto(
            id = id,
            userId = author,
            title = title,
            content = content.orEmpty(),
            postType = postType,
            postFormat = null,
            purpose = null,
            mediaUrls = mediaUrls,
            mediaTypes = mediaTypes,
            mediaThumbnails = mediaThumbnails,
            mediaLiveUrls = mediaLiveUrls,
            locationName = locationName,
            createdAt = createdAt,
            likeCount = likeCount,
            commentCount = commentCount,
            shareCount = shareCount,
            creator =
                creator?.let {
                    PostCreatorDto(
                        id = it.id ?: author,
                        username = it.username,
                        name = it.name,
                        firstName = it.firstName,
                        lastName = it.lastName,
                        profilePictureUrl = it.profilePictureUrl,
                        city = it.city,
                        state = it.state,
                        accountType = it.accountType,
                        projectedDisplayName = it.authorDisplayName,
                        handle = it.handle,
                        avatarUrl = it.avatarUrl,
                    )
                },
            userHasLiked = userHasLiked,
            userHasSaved = userHasSaved,
            userHasReposted = userHasReposted,
            eventDate = eventDate,
            eventVenue = eventVenue,
            lostFoundType = lostFoundType,
        ),
    )
}
