@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Body for `POST /api/homes/:id/owners/invite`. Mirrors
 * `inviteOwnerSchema` (`backend/routes/homeOwnership.js:66`). All four
 * keys are nullable in the schema; `email` is effectively required
 * because the handler returns 400 when it can't resolve a user.
 */
@JsonClass(generateAdapter = true)
data class InviteOwnerRequest(
    val email: String? = null,
    val phone: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "fast_track") val fastTrack: Boolean = false,
)

/** 201 envelope for `POST /api/homes/:id/owners/invite`. */
@JsonClass(generateAdapter = true)
data class InviteOwnerResponse(
    val message: String,
    @Json(name = "claim_id") val claimId: String,
)
