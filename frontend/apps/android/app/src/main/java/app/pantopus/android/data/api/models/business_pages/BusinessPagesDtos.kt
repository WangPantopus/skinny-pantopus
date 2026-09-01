@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.business_pages

import app.pantopus.android.data.api.models.common.JsonValue
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * C4 — DTOs for the business Pages CMS (custom pages, block bodies, revision
 * history) and the public page-by-slug read.
 *
 * Routes:
 *  - `backend/routes/businesses.js:2809` POST   /api/businesses/:id/pages
 *  - `backend/routes/businesses.js:2865` GET    /api/businesses/:id/pages
 *  - `backend/routes/businesses.js:2949` DELETE /api/businesses/:id/pages/:pageId
 *  - `backend/routes/businesses.js:3006` GET    …/pages/:pageId/blocks
 *  - `backend/routes/businesses.js:3066` PUT    …/pages/:pageId/blocks
 *  - `backend/routes/businesses.js:3153` POST   …/pages/:pageId/publish
 *  - `backend/routes/businesses.js:3241` GET    …/pages/:pageId/revisions
 *  - `backend/routes/businesses.js:3277` POST   …/revisions/:rev/restore
 *  - `backend/routes/businessPublicPage.js:62` GET /api/b/:username/:slug
 */

/** One row of `BusinessPage`. `GET /pages` selects every column. */
@JsonClass(generateAdapter = true)
data class BusinessPageDto(
    val id: String,
    val slug: String,
    val title: String,
    val description: String? = null,
    @Json(name = "is_default") val isDefault: Boolean? = null,
    @Json(name = "show_in_nav") val showInNav: Boolean? = null,
    @Json(name = "nav_order") val navOrder: Int? = null,
    @Json(name = "icon_key") val iconKey: String? = null,
    @Json(name = "draft_revision") val draftRevision: Int? = null,
    @Json(name = "published_revision") val publishedRevision: Int? = null,
    @Json(name = "published_at") val publishedAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** `GET /api/businesses/:id/pages`. */
@JsonClass(generateAdapter = true)
data class BusinessPagesResponse(
    val pages: List<BusinessPageDto> = emptyList(),
)

/** `POST /pages` (201) / `PATCH /pages/:pageId`. */
@JsonClass(generateAdapter = true)
data class BusinessPageEnvelope(
    val page: BusinessPageDto,
)

/** Body for `POST /api/businesses/:id/pages` (`createPageSchema`). */
@JsonClass(generateAdapter = true)
data class CreateBusinessPageRequest(
    val slug: String,
    val title: String,
    val description: String? = null,
    @Json(name = "show_in_nav") val showInNav: Boolean? = true,
)

/**
 * One row of `BusinessPageBlock`. `data` / `settings` stay untyped so
 * unrecognised keys survive the save round-trip.
 */
@JsonClass(generateAdapter = true)
data class BusinessPageBlockDto(
    val id: String? = null,
    @Json(name = "block_type") val blockType: String,
    @Json(name = "schema_version") val schemaVersion: Int? = null,
    @Json(name = "sort_order") val sortOrder: Int? = null,
    val data: JsonValue? = null,
    val settings: JsonValue? = null,
    @Json(name = "location_id") val locationId: String? = null,
    @Json(name = "show_from") val showFrom: String? = null,
    @Json(name = "show_until") val showUntil: String? = null,
    @Json(name = "is_visible") val isVisible: Boolean? = null,
)

/**
 * `GET …/blocks`. The `never_published` early return
 * (`backend/routes/businesses.js:3031`) omits both revision counters, so
 * they are nullable.
 */
@JsonClass(generateAdapter = true)
data class BusinessPageBlocksResponse(
    val blocks: List<BusinessPageBlockDto> = emptyList(),
    val revision: Int? = null,
    @Json(name = "draft_revision") val draftRevision: Int? = null,
    @Json(name = "published_revision") val publishedRevision: Int? = null,
)

/** One element of the `PUT …/blocks` body (`blockSchema`). */
@JsonClass(generateAdapter = true)
data class SaveBusinessPageBlockRequest(
    @Json(name = "block_type") val blockType: String,
    @Json(name = "schema_version") val schemaVersion: Int,
    @Json(name = "sort_order") val sortOrder: Int,
    val data: JsonValue,
    val settings: JsonValue,
    @Json(name = "location_id") val locationId: String? = null,
    @Json(name = "show_from") val showFrom: String? = null,
    @Json(name = "show_until") val showUntil: String? = null,
    @Json(name = "is_visible") val isVisible: Boolean = true,
)

/** Body for `PUT /api/businesses/:id/pages/:pageId/blocks`. */
@JsonClass(generateAdapter = true)
data class SaveBusinessPageBlocksRequest(
    val blocks: List<SaveBusinessPageBlockRequest>,
)

/** `PUT …/blocks`. */
@JsonClass(generateAdapter = true)
data class SaveBusinessPageBlocksResponse(
    val blocks: List<BusinessPageBlockDto> = emptyList(),
    @Json(name = "draft_revision") val draftRevision: Int? = null,
)

/** `POST …/publish`. */
@JsonClass(generateAdapter = true)
data class PublishBusinessPageResponse(
    val message: String? = null,
    @Json(name = "published_revision") val publishedRevision: Int? = null,
)

/** Publisher join on a revision row (`published_by → User`). */
@JsonClass(generateAdapter = true)
data class BusinessPageRevisionPublisherDto(
    val id: String? = null,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/** One row of `BusinessPageRevision`. */
@JsonClass(generateAdapter = true)
data class BusinessPageRevisionDto(
    val id: String,
    val revision: Int,
    @Json(name = "published_at") val publishedAt: String? = null,
    val notes: String? = null,
    val publisher: BusinessPageRevisionPublisherDto? = null,
)

/** `GET …/revisions`. */
@JsonClass(generateAdapter = true)
data class BusinessPageRevisionsResponse(
    val revisions: List<BusinessPageRevisionDto> = emptyList(),
)

/** `POST …/revisions/:rev/restore`. */
@JsonClass(generateAdapter = true)
data class RestoreBusinessPageRevisionResponse(
    val message: String? = null,
    @Json(name = "restored_revision") val restoredRevision: Int? = null,
    @Json(name = "draft_revision") val draftRevision: Int? = null,
)

/** The `currentPage` object on `GET /api/b/:username/:slug`. */
@JsonClass(generateAdapter = true)
data class PublicBusinessPageDto(
    val id: String? = null,
    val slug: String? = null,
    val title: String? = null,
    val description: String? = null,
    val blocks: List<BusinessPageBlockDto>? = null,
)

/**
 * `GET /api/b/:username/:slug`. Only the named-page fields are decoded — the
 * rest of the payload duplicates the profile read.
 */
@JsonClass(generateAdapter = true)
data class PublicBusinessPageResponse(
    val pages: List<BusinessPageDto>? = null,
    val currentPage: PublicBusinessPageDto? = null,
)
