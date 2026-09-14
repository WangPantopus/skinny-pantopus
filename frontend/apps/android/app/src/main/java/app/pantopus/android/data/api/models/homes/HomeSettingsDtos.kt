@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Body for `PATCH /api/homes/:id` — route `backend/routes/home.js:3097`,
 * schema `updateHomeSchema` (same file, line 132). Every key is optional
 * and the object must carry at least one, so nulls are omitted from the
 * wire body. `name` is `Joi.string().max(120)`.
 *
 * RN sends `public_info: { nickname }`, but `public_info` is not in the
 * schema and never reaches `updates` — `name` is the column the handler
 * writes for a home's display name (route line 3120).
 */
@JsonClass(generateAdapter = true)
data class UpdateHomeRequest(
    val name: String? = null,
)

/**
 * `{ message, home }` envelope from `PATCH /api/homes/:id` (route
 * `backend/routes/home.js:3178`). `home` is the raw updated `Home` row.
 */
@JsonClass(generateAdapter = true)
data class UpdateHomeResponse(
    val message: String? = null,
    val home: HomeDto,
)

/** `POST /api/homes/:id/move-out` — route `backend/routes/home.js:3563`. */
@JsonClass(generateAdapter = true)
data class MoveOutResponse(
    val message: String,
    @Json(name = "homeId") val homeId: String? = null,
)

/** `DELETE /api/homes/:id/ownership-claims/:claimId`. */
@JsonClass(generateAdapter = true)
data class DeleteOwnershipClaimResponse(
    val ok: Boolean,
    val deleted: Boolean,
    val withdrawn: Boolean,
    val replayed: Boolean,
    val homeId: String,
    val claimId: String,
    val action: String,
    val state: String,
) {
    fun matches(
        homeId: String,
        claimId: String,
    ): Boolean =
        ok && !deleted && withdrawn &&
            this.homeId == homeId && this.claimId == claimId && action == "withdraw" && state == "revoked"
}

// No property-correction DTOs: the backend exposes no correction endpoint,
// and `PropertyCorrectionScreen` says so rather than faking a submit.
