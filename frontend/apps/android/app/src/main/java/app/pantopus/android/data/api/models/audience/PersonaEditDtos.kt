@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.audience

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Write-side shapes for Beacon (persona) create / edit and the avatar +
 * banner multipart upload. Read-side decoders live in
 * `AudienceProfileDtos.kt`.
 *
 * Requests follow `createPersonaSchema` / `updatePersonaSchema`
 * (`backend/routes/personas.js:56-85`) and are snake_case; responses come
 * from `serializeAudienceProfileForViewer`
 * (`backend/serializers/identitySerializers.js:219`) and are camelCase.
 */

/** One `{ label, url }` pair in `public_links`. Max 8 per Beacon. */
@JsonClass(generateAdapter = true)
data class PersonaPublicLinkDto(
    val label: String,
    val url: String,
)

/**
 * Body shared by `POST /api/personas` and `PATCH /api/personas/:id`.
 * `handle` + `display_name` are required on create; update accepts any
 * subset, but the editor always sends the whole form so both paths behave
 * identically.
 */
@JsonClass(generateAdapter = true)
data class PersonaWriteBody(
    val handle: String,
    @Json(name = "display_name") val displayName: String,
    val bio: String? = null,
    val category: String,
    @Json(name = "audience_label") val audienceLabel: String,
    @Json(name = "audience_mode") val audienceMode: String,
    @Json(name = "public_links") val publicLinks: List<PersonaPublicLinkDto> = emptyList(),
)

/** Create returns `{ persona, channel }`; update returns `{ persona }`. */
@JsonClass(generateAdapter = true)
data class PersonaWriteResponse(
    val persona: PersonaSummaryDto? = null,
    val channel: BroadcastChannelDto? = null,
)

// GET /api/personas/compliance/categories

@JsonClass(generateAdapter = true)
data class PersonaCategoryPoliciesResponse(
    val categories: List<PersonaCategoryPolicyDto> = emptyList(),
    val sensitiveCategoriesEnabled: Boolean? = null,
)

/**
 * One selectable (or gated) Beacon category. `enabled == false` means the
 * category is modeled but blocked behind credential verification — the
 * picker renders it disabled rather than hiding it.
 */
@JsonClass(generateAdapter = true)
data class PersonaCategoryPolicyDto(
    val category: String,
    val label: String? = null,
    val sensitive: Boolean? = null,
    val enabled: Boolean? = null,
    val requirements: List<String>? = null,
    val defaultAudienceMode: String? = null,
)

// POST /api/upload/persona-media/:personaId?type=avatar|banner

/**
 * Response from the Beacon avatar / banner upload. The route writes
 * `avatar_url` / `banner_url` on the persona row itself and echoes the new
 * CDN URL. Route `backend/routes/upload.js:312`.
 */
@JsonClass(generateAdapter = true)
data class PersonaMediaUploadResponse(
    val message: String? = null,
    val url: String,
    val key: String? = null,
    val persona: PersonaMediaPersonaDto? = null,
)

@JsonClass(generateAdapter = true)
data class PersonaMediaPersonaDto(
    val id: String,
    val handle: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    @Json(name = "banner_url") val bannerUrl: String? = null,
)
