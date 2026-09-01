@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the postcard ownership-verification flow in
 * `backend/routes/homeOwnership.js`:
 *   - POST /api/homes/:id/request-postcard (line 2452)
 *   - POST /api/homes/:id/verify-postcard  (line 2548)
 *
 * Note: the backend has no postcard *delivery-tracking* surface, so the
 * A12.7 timeline is driven by `PostcardVerificationSampleData`.
 * Field-for-field parity with iOS `PostcardDTOs.swift`.
 */

/** Postcard metadata returned by `POST /api/homes/:id/request-postcard`. */
@JsonClass(generateAdapter = true)
data class PostcardInfoDto(
    val id: String,
    @Json(name = "requested_at") val requestedAt: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
)

/** 201 envelope for `POST /api/homes/:id/request-postcard`. */
@JsonClass(generateAdapter = true)
data class RequestPostcardResponse(
    val message: String,
    val postcard: PostcardInfoDto,
)

/**
 * Body for `POST /api/homes/:id/verify-postcard`. Mirrors
 * `verifyPostcardSchema` — a 6–8 char alphanumeric code.
 */
@JsonClass(generateAdapter = true)
data class VerifyPostcardRequest(
    val code: String,
)

/**
 * 200 envelope for `POST /api/homes/:id/verify-postcard`. The
 * `occupancy` row the handler also returns isn't modelled — the screen
 * only needs to know the call succeeded.
 */
@JsonClass(generateAdapter = true)
data class VerifyPostcardResponse(
    val message: String,
    @Json(name = "verification_status") val verificationStatus: String? = null,
    @Json(name = "challenge_window_ends_at") val challengeWindowEndsAt: String? = null,
)
