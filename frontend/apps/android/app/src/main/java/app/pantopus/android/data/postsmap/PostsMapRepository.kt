package app.pantopus.android.data.postsmap

import app.pantopus.android.data.api.models.postsmap.PostsMapResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PostsMapApi
import javax.inject.Inject
import javax.inject.Singleton

/** The layers `GET /api/posts/map` knows how to fan out. */
enum class PostsMapLayer(val key: String) {
    /** Neighborhood posts — `backend/routes/posts.js:1677`. */
    Posts("posts"),

    /** Open / assigned / in-progress gigs — `backend/routes/posts.js:1715`. */
    Tasks("tasks"),

    /** `gig_type = offer` rows — `backend/routes/posts.js:1749`. */
    Offers("offers"),

    /** Published business profiles — `backend/routes/posts.js:1783`. */
    Businesses("businesses"),

    /** Homes with a resolvable point — `backend/routes/posts.js:1810`. */
    Homes("homes"),
}

/** Wraps [PostsMapApi] in the [NetworkResult] taxonomy. */
@Singleton
class PostsMapRepository
    @Inject
    constructor(
        private val api: PostsMapApi,
    ) {
        /**
         * `GET /api/posts/map` for one viewport.
         *
         * @param layers which marker layers to fan out; empty falls back
         * to the server default (`posts`).
         */
        @Suppress("LongParameterList")
        suspend fun markers(
            south: Double,
            west: Double,
            north: Double,
            east: Double,
            layers: List<PostsMapLayer> = listOf(PostsMapLayer.Posts),
            postType: String? = null,
            surface: String? = null,
            limit: Int = 200,
        ): NetworkResult<PostsMapResponse> =
            safeApiCall {
                api.markers(
                    south = south,
                    west = west,
                    north = north,
                    east = east,
                    layers = layers.takeIf { it.isNotEmpty() }?.joinToString(",") { it.key },
                    postType = postType?.takeIf { it.isNotBlank() },
                    surface = surface?.takeIf { it.isNotBlank() },
                    limit = limit,
                )
            }
    }
