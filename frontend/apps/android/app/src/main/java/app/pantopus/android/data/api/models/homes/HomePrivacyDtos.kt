package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * P3F / A14.2 — DTOs for the per-home privacy toggle set.
 * Route: `backend/routes/homePrivacy.js`.
 */

/** Envelope for `GET/PATCH /api/homes/:id/privacy` — `{ privacy }`. */
@JsonClass(generateAdapter = true)
data class HomePrivacyResponse(
    val privacy: HomePrivacyDto,
)

/** The 9 per-home privacy toggles + home id (snake_case on the wire). */
@JsonClass(generateAdapter = true)
data class HomePrivacyDto(
    @Json(name = "home_id") val homeId: String,
    @Json(name = "guest_approval") val guestApproval: Boolean,
    @Json(name = "member_name_visibility") val memberNameVisibility: Boolean,
    @Json(name = "address_precision") val addressPrecision: Boolean,
    @Json(name = "activity_visibility") val activityVisibility: Boolean,
    @Json(name = "map_opt_out") val mapOptOut: Boolean,
    @Json(name = "notification_previews") val notificationPreviews: Boolean,
    @Json(name = "doc_lock") val docLock: Boolean,
    @Json(name = "photo_blur") val photoBlur: Boolean,
    @Json(name = "vault_auto_lock") val vaultAutoLock: Boolean,
)

/**
 * Body for `PATCH /api/homes/:id/privacy`. All fields optional — Moshi omits
 * nulls by default, so only the flipped toggle is sent.
 */
@JsonClass(generateAdapter = true)
data class UpdateHomePrivacyRequest(
    @Json(name = "guest_approval") val guestApproval: Boolean? = null,
    @Json(name = "member_name_visibility") val memberNameVisibility: Boolean? = null,
    @Json(name = "address_precision") val addressPrecision: Boolean? = null,
    @Json(name = "activity_visibility") val activityVisibility: Boolean? = null,
    @Json(name = "map_opt_out") val mapOptOut: Boolean? = null,
    @Json(name = "notification_previews") val notificationPreviews: Boolean? = null,
    @Json(name = "doc_lock") val docLock: Boolean? = null,
    @Json(name = "photo_blur") val photoBlur: Boolean? = null,
    @Json(name = "vault_auto_lock") val vaultAutoLock: Boolean? = null,
)
