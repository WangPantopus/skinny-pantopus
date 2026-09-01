@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.settings

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Envelope from `GET /api/privacy/settings` (`privacy.js:80`) and from
 * `PATCH /api/privacy/settings` (`privacy.js:142`, which also carries a
 * `message` we ignore). */
@JsonClass(generateAdapter = true)
data class PrivacySettingsResponse(
    val settings: PrivacySettingsDto,
)

/** One `UserPrivacySettings` row. Columns per
 * `supabase/migrations/20260301000001_identity_firewall_tables.sql:128`
 * plus `findable_by_name` (migration 143). All fields are nullable so
 * the backend can roll out new keys without breaking older clients. */
@JsonClass(generateAdapter = true)
data class PrivacySettingsDto(
    @Json(name = "user_id") val userId: String? = null,
    /** `everyone` · `mutuals` · `nobody`. */
    @Json(name = "search_visibility") val searchVisibility: String? = null,
    @Json(name = "findable_by_name") val findableByName: Boolean? = null,
    @Json(name = "findable_by_email") val findableByEmail: Boolean? = null,
    @Json(name = "findable_by_phone") val findableByPhone: Boolean? = null,
    /** `public` · `followers` · `private`. */
    @Json(name = "profile_default_visibility") val profileDefaultVisibility: String? = null,
    @Json(name = "show_gig_history") val showGigHistory: String? = null,
    @Json(name = "show_neighborhood") val showNeighborhood: String? = null,
    @Json(name = "show_home_affiliation") val showHomeAffiliation: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/**
 * Partial-update body for `PATCH /api/privacy/settings`.
 *
 * The field list is exactly `updateSettingsSchema` at
 * `backend/routes/privacy.js:28-37`. `middleware/validate.js:66` runs Joi
 * with `allowUnknown = false`, so any key outside that schema is a 400 —
 * do not add speculative fields. Nulls are omitted from the wire body by
 * Moshi, and the schema requires at least one key.
 */
@JsonClass(generateAdapter = true)
data class PrivacySettingsUpdate(
    @Json(name = "search_visibility") val searchVisibility: String? = null,
    @Json(name = "findable_by_name") val findableByName: Boolean? = null,
    @Json(name = "findable_by_email") val findableByEmail: Boolean? = null,
    @Json(name = "findable_by_phone") val findableByPhone: Boolean? = null,
    @Json(name = "profile_default_visibility") val profileDefaultVisibility: String? = null,
    @Json(name = "show_gig_history") val showGigHistory: String? = null,
    @Json(name = "show_neighborhood") val showNeighborhood: String? = null,
    @Json(name = "show_home_affiliation") val showHomeAffiliation: String? = null,
)

/** Envelope from `GET /api/privacy/blocks`. */
@JsonClass(generateAdapter = true)
data class PrivacyBlocksResponse(
    val blocks: List<PrivacyBlockDto>,
)

@JsonClass(generateAdapter = true)
data class PrivacyBlockDto(
    val id: String,
    @Json(name = "blocked_user_id") val blockedUserId: String? = null,
    @Json(name = "block_scope") val blockScope: String? = null,
    val reason: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val blocked: BlockedUserSummaryDto? = null,
)

/** Nested user summary returned by `privacy.js:154` join. */
@JsonClass(generateAdapter = true)
data class BlockedUserSummaryDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/** Body for `POST /api/notifications/push-token`. */
@JsonClass(generateAdapter = true)
data class PushTokenBody(
    val token: String,
    val platform: String = "android",
)

/** Body for `POST /api/users/password`. The Joi schema at
 *  `backend/routes/users.js:736` uses camelCase, so the field names
 *  go on the wire unchanged. `currentPassword` is optional (omit for
 *  OAuth-only accounts setting an initial password). */
@JsonClass(generateAdapter = true)
data class PasswordUpdateBody(
    val currentPassword: String?,
    val newPassword: String,
)

/** Body for `POST /api/users/resend-verification`
 *  (`backend/routes/users.js:3049`). */
@JsonClass(generateAdapter = true)
data class ResendVerificationBody(
    val email: String,
)

/** Envelope from `GET /api/users/auth-methods`. */
@JsonClass(generateAdapter = true)
data class AuthMethodsResponse(
    val methods: List<AuthMethodDto>? = null,
    @Json(name = "has_password") val hasPassword: Boolean? = null,
    val providers: List<String>? = null,
    @Json(name = "two_factor_enabled") val twoFactorEnabled: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class AuthMethodDto(
    val id: String,
    val provider: String? = null,
    val label: String? = null,
)
