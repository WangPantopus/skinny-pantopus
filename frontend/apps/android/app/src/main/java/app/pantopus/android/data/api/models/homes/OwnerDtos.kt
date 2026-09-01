@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One row in the `GET /api/homes/:id/owners` envelope. Mirrors the
 * enriched shape returned by `backend/routes/homeOwnership.js:1418`.
 *
 * Field-for-field parity with iOS `OwnerDTO`.
 */
@JsonClass(generateAdapter = true)
data class OwnerDto(
    val id: String,
    @Json(name = "subject_type") val subjectType: String,
    @Json(name = "subject_id") val subjectId: String,
    @Json(name = "owner_status") val ownerStatus: String,
    @Json(name = "is_primary_owner") val isPrimaryOwner: Boolean,
    @Json(name = "added_via") val addedVia: String? = null,
    @Json(name = "verification_tier") val verificationTier: String,
    @Json(name = "created_at") val createdAt: String,
    val user: OwnerUser? = null,
)

/**
 * Enriched user payload returned by the handler when
 * `subject_type == "user"`. Mirrors the columns selected at
 * `backend/routes/homeOwnership.js:1411-1413`.
 */
@JsonClass(generateAdapter = true)
data class OwnerUser(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/** Envelope for `GET /api/homes/:id/owners`. */
@JsonClass(generateAdapter = true)
data class OwnersResponse(
    val owners: List<OwnerDto>,
)

/**
 * 200 envelope for `DELETE /api/homes/:id/owners/:ownerId`. The
 * backend may return a `quorum_action_id` when removal requires
 * co-owner approval; the screen treats that as "removal pending" and
 * still drops the row optimistically (the optimistic-delete rollback
 * fires when the handler 4xxes / 5xxes, not when quorum is required).
 */
@JsonClass(generateAdapter = true)
data class RemoveOwnerResponse(
    val message: String,
    @Json(name = "quorum_action_id") val quorumActionId: String? = null,
)
