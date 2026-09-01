@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One `HomeGuestPass` row from `backend/routes/homeIam.js`. The list
 * endpoint adds the computed [status] + [lastViewedAt]; both are null on
 * the create/revoke payloads. Unmodelled columns (token hash, raw
 * permissions jsonb) are omitted — Moshi ignores keys it doesn't
 * declare. Field-for-field parity with iOS `GuestPassDTO`.
 */
@JsonClass(generateAdapter = true)
data class GuestPassDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    val label: String,
    val kind: String,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
    @Json(name = "revoked_at") val revokedAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "included_sections") val includedSections: List<String>? = null,
    @Json(name = "custom_title") val customTitle: String? = null,
    @Json(name = "max_views") val maxViews: Int? = null,
    @Json(name = "view_count") val viewCount: Int? = null,
    /** Computed `"active" | "revoked" | "expired"` — list endpoint only. */
    val status: String? = null,
    @Json(name = "last_viewed_at") val lastViewedAt: String? = null,
)

/**
 * Body for `POST /api/homes/:id/guest-passes`. The handler resolves the
 * window with precedence `end_at` > `duration_hours` > template default,
 * so callers send either [durationHours] (relative) or the
 * [startAt]/[endAt] pair (absolute), never both. Null fields are omitted
 * by Moshi. Field-for-field parity with iOS `CreateGuestPassRequest`.
 */
@JsonClass(generateAdapter = true)
data class CreateGuestPassRequest(
    val label: String,
    val kind: String = "guest",
    @Json(name = "duration_hours") val durationHours: Int? = null,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
)

/**
 * 201 envelope for `POST /api/homes/:id/guest-passes`. [token] is the raw
 * share secret, returned exactly once on creation.
 */
@JsonClass(generateAdapter = true)
data class CreateGuestPassResponse(
    val pass: GuestPassDto,
    val token: String,
)

/** Envelope for `GET /api/homes/:id/guest-passes`. */
@JsonClass(generateAdapter = true)
data class GuestPassesResponse(
    val passes: List<GuestPassDto>,
)

/** 200 envelope for `DELETE /api/homes/:id/guest-passes/:passId`. */
@JsonClass(generateAdapter = true)
data class RevokeGuestPassResponse(
    val message: String,
    val pass: GuestPassDto,
)
