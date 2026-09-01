package app.pantopus.android.data.api.models.relationships

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `POST /api/relationships/requests` body. Matches the Joi validator at
 * `backend/routes/relationships.js:40-43` (snake_case keys).
 */
@JsonClass(generateAdapter = true)
data class ConnectionRequestBody(
    @Json(name = "addressee_id") val addresseeId: String,
    val message: String? = null,
)

/**
 * `POST /api/relationships/requests` response envelope. Backend returns
 * `{message, relationship}`; only `message` is consumed by the UI.
 */
@JsonClass(generateAdapter = true)
data class ConnectionRequestResponse(
    val message: String? = null,
)

/**
 * Trimmed `User` projection embedded in relationships / pending payloads.
 * Mirrors `USER_SELECT` at `backend/routes/relationships.js:47`.
 */
@JsonClass(generateAdapter = true)
data class RelationshipUserDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "last_name") val lastName: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    val city: String? = null,
    val state: String? = null,
)

/**
 * One row in `GET /api/relationships`. Backend enriches each row with
 * `other_user` (the counterpart relative to the viewer) and `direction`
 * (`"sent" | "received"`). See `backend/routes/relationships.js:649-657`.
 */
@JsonClass(generateAdapter = true)
data class RelationshipDto(
    val id: String,
    val status: String,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "responded_at") val respondedAt: String? = null,
    @Json(name = "accepted_at") val acceptedAt: String? = null,
    @Json(name = "blocked_by") val blockedBy: String? = null,
    val direction: String? = null,
    @Json(name = "other_user") val otherUser: RelationshipUserDto? = null,
)

/** Envelope for `GET /api/relationships`. */
@JsonClass(generateAdapter = true)
data class RelationshipsListResponse(
    val relationships: List<RelationshipDto> = emptyList(),
)

/** One row in `GET /api/relationships/requests/pending`. */
@JsonClass(generateAdapter = true)
data class PendingRequestDto(
    val id: String,
    val status: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val requester: RelationshipUserDto? = null,
)

/** Envelope for `GET /api/relationships/requests/pending`. */
@JsonClass(generateAdapter = true)
data class PendingRequestsResponse(
    val requests: List<PendingRequestDto> = emptyList(),
)

/**
 * Generic ack envelope returned by accept / reject. Only `message` is
 * consumed by the UI for telemetry.
 */
@JsonClass(generateAdapter = true)
data class RelationshipActionEcho(
    val message: String? = null,
)
