package app.pantopus.android.data.api.models.connections

import app.pantopus.android.data.api.models.relationships.RelationshipUserDto
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One row in `GET /api/relationships/requests/sent`. Mirrors the pending
 * shape but carries `addressee` (the person you asked) instead of
 * `requester` — `backend/routes/relationships.js:702-710`.
 */
@JsonClass(generateAdapter = true)
data class SentRequestDto(
    val id: String,
    val status: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val addressee: RelationshipUserDto? = null,
)

/** Envelope for `GET /api/relationships/requests/sent`. */
@JsonClass(generateAdapter = true)
data class SentRequestsResponse(
    val requests: List<SentRequestDto> = emptyList(),
)

/**
 * One row in `GET /api/relationships/blocked`. `blockedUser` is
 * server-derived (the counterpart relative to the viewer) —
 * `backend/routes/relationships.js:747-750`.
 */
@JsonClass(generateAdapter = true)
data class BlockedRelationshipDto(
    val id: String,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "responded_at") val respondedAt: String? = null,
    @Json(name = "block_reason") val blockReason: String? = null,
    @Json(name = "blocked_user") val blockedUser: RelationshipUserDto? = null,
)

/** Envelope for `GET /api/relationships/blocked`. */
@JsonClass(generateAdapter = true)
data class BlockedRelationshipsResponse(
    val blocked: List<BlockedRelationshipDto> = emptyList(),
)
