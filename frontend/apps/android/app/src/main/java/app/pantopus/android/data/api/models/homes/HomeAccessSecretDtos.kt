@file:Suppress("LongParameterList")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Access secret returned by `GET /api/homes/:id/access`. Drives the
 * T6.4a Access codes screen — per-home roster of Wi-Fi / Alarm / Gate /
 * Lockbox / Garage / Smart-lock codes with masked values, visibility
 * scopes, and rotation metadata.
 *
 * Schema: `backend/routes/home.js:5487`.
 */
@JsonClass(generateAdapter = true)
data class HomeAccessSecretDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    /** Wire enum: wifi / alarm / gate / lockbox / garage / smart_lock. */
    @Json(name = "access_type") val accessType: String,
    val label: String,
    @Json(name = "secret_value") val secretValue: String,
    val notes: String? = null,
    /** Wire enum: members / managers / sensitive. */
    val visibility: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** Envelope for `GET /api/homes/:id/access`. */
@JsonClass(generateAdapter = true)
data class HomeAccessSecretsResponse(
    val secrets: List<HomeAccessSecretDto> = emptyList(),
)

/** Envelope for `POST` and `PUT` access-secret routes. */
@JsonClass(generateAdapter = true)
data class HomeAccessSecretResponse(
    val secret: HomeAccessSecretDto,
)

/**
 * Body for `POST /api/homes/:id/access`. Mirrors the destructure at
 * `backend/routes/home.js:5535`. `accessType`, `label`, and
 * `secretValue` are required; `notes` and `visibility` are optional.
 */
@JsonClass(generateAdapter = true)
data class CreateAccessSecretRequest(
    @Json(name = "access_type") val accessType: String,
    val label: String,
    @Json(name = "secret_value") val secretValue: String,
    val notes: String? = null,
    val visibility: String? = null,
)

/**
 * Body for `PUT /api/homes/:id/access/:secretId`. All fields optional
 * (server applies only present keys per the allow-list at
 * `backend/routes/home.js:5594`).
 */
@JsonClass(generateAdapter = true)
data class UpdateAccessSecretRequest(
    @Json(name = "access_type") val accessType: String? = null,
    val label: String? = null,
    @Json(name = "secret_value") val secretValue: String? = null,
    val notes: String? = null,
    val visibility: String? = null,
)
