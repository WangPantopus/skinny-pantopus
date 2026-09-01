package app.pantopus.android.data.api.models.feed

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Request / response shapes for the Pulse card overflow actions and the
 * Pulse preferences sheet — `backend/routes/posts.js` hide / mute /
 * not-helpful / solve / seeded-dismiss / feed-preferences.
 */

/** Entity kinds accepted by `POST /api/posts/mute` (`posts.js:2126`). */
enum class FeedMuteEntityType(
    val wireValue: String,
) {
    User("user"),
    Business("business"),
}

/** Body for `POST` + `DELETE /api/posts/mute`. */
@JsonClass(generateAdapter = true)
data class FeedMuteRequest(
    val entityType: String,
    val entityId: String,
)

/** Body for `POST /api/posts/mute/topic`. */
@JsonClass(generateAdapter = true)
data class FeedMuteTopicRequest(
    val postType: String,
    val surface: String? = null,
)

/** Body for `POST /api/posts/:id/not-helpful`. */
@JsonClass(generateAdapter = true)
data class FeedNotHelpfulRequest(
    val surface: String,
)

/** `POST /api/posts/:id/not-helpful` response. */
@JsonClass(generateAdapter = true)
data class FeedNotHelpfulResponse(
    val flagged: Boolean = false,
)

/** The trimmed post returned by `PATCH /api/posts/:id/solve`. */
@JsonClass(generateAdapter = true)
data class FeedSolvedPost(
    val id: String,
    val state: String? = null,
    @Json(name = "solved_at") val solvedAt: String? = null,
)

/** `PATCH /api/posts/:id/solve` response. */
@JsonClass(generateAdapter = true)
data class FeedSolveResponse(
    val message: String? = null,
    val post: FeedSolvedPost? = null,
)

/** `POST /api/posts/seeded/:factId/dismiss` response. */
@JsonClass(generateAdapter = true)
data class FeedSeededDismissResponse(
    val dismissed: Boolean = false,
    val factId: String? = null,
)

/** Message-only acknowledgement (hide / mute routes). */
@JsonClass(generateAdapter = true)
data class FeedActionAckResponse(
    val message: String? = null,
)

/** One row of `UserFeedPreference` — `backend/routes/posts.js:2257`. */
@JsonClass(generateAdapter = true)
data class FeedPreferencesDto(
    @Json(name = "hide_deals_place") val hideDealsPlace: Boolean = false,
    @Json(name = "hide_alerts_place") val hideAlertsPlace: Boolean = false,
    @Json(name = "show_politics_connections") val showPoliticsConnections: Boolean = false,
    @Json(name = "show_politics_place") val showPoliticsPlace: Boolean = false,
)

/** `GET` + `PUT /api/posts/feed-preferences` response envelope. */
@JsonClass(generateAdapter = true)
data class FeedPreferencesResponse(
    val preferences: FeedPreferencesDto,
)

/**
 * Body for `PUT /api/posts/feed-preferences`. Every field is optional —
 * the handler only writes the keys that are present.
 */
@JsonClass(generateAdapter = true)
data class FeedPreferencesUpdateRequest(
    val hideDealsPlace: Boolean? = null,
    val hideAlertsPlace: Boolean? = null,
    val showPoliticsConnections: Boolean? = null,
    val showPoliticsPlace: Boolean? = null,
)
