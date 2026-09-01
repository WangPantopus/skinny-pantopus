@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.businesses

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Wire models for owner-side catalog management — categories + items +
 * reorder. The read-only [BusinessCatalogItemDto] in `BusinessDtos.kt` is
 * the *public* projection (name / price / featured) used by the Services
 * tab; the owner catalog manager also needs the editable columns
 * (`status`, `sort_order`, `category_id`, `duration_minutes`), so it
 * decodes the same rows through [BusinessCatalogManagedItemDto].
 *
 * Routes (all under `backend/routes/businesses.js`):
 *  - categories  GET 2247 · POST 2215 · PATCH 2277 · DELETE 2308
 *  - items       GET 2386 · POST 2339 · PATCH 2425 · DELETE 2469
 *  - reorder     POST 2504
 *
 * iOS twin: `Core/Networking/Models/Businesses/BusinessCatalogDTOs.swift`.
 */

/** One `BusinessCatalogCategory` row. */
@JsonClass(generateAdapter = true)
data class BusinessCatalogCategoryDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val slug: String? = null,
    @Json(name = "sort_order") val sortOrder: Int? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
)

/** `GET …/catalog/categories` envelope. Route `backend/routes/businesses.js:2247`. */
@JsonClass(generateAdapter = true)
data class BusinessCatalogCategoriesResponse(
    val categories: List<BusinessCatalogCategoryDto> = emptyList(),
)

/** `POST` / `PATCH` category envelope. Routes `…:2215` + `…:2277`. */
@JsonClass(generateAdapter = true)
data class BusinessCatalogCategoryResponse(
    val category: BusinessCatalogCategoryDto? = null,
)

/**
 * Body for category create / rename. `createCategorySchema`
 * (`backend/routes/businesses.js:226`) takes snake_case `name` /
 * `description` / `slug` / `sort_order`.
 *
 * The PATCH route has no Joi schema — it spreads `req.body` straight into
 * the update — so nulls MUST be omitted here (Moshi's default), otherwise
 * a rename would wipe the description.
 */
@JsonClass(generateAdapter = true)
data class BusinessCatalogCategoryRequest(
    val name: String? = null,
    val description: String? = null,
    @Json(name = "sort_order") val sortOrder: Int? = null,
)

/** Nested `category:category_id (id, name, slug)` join on the item list. */
@JsonClass(generateAdapter = true)
data class BusinessCatalogItemCategoryRefDto(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
)

/** The owner-editable projection of a `BusinessCatalogItem` row. */
@JsonClass(generateAdapter = true)
data class BusinessCatalogManagedItemDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val kind: String? = null,
    val status: String? = null,
    val currency: String? = null,
    @Json(name = "price_cents") val priceCents: Int? = null,
    @Json(name = "price_max_cents") val priceMaxCents: Int? = null,
    @Json(name = "price_unit") val priceUnit: String? = null,
    @Json(name = "duration_minutes") val durationMinutes: Int? = null,
    @Json(name = "is_featured") val isFeatured: Boolean? = null,
    @Json(name = "tax_deductible") val taxDeductible: Boolean? = null,
    @Json(name = "suggested_amounts") val suggestedAmounts: List<Int>? = null,
    @Json(name = "sort_order") val sortOrder: Int? = null,
    @Json(name = "category_id") val categoryId: String? = null,
    val category: BusinessCatalogItemCategoryRefDto? = null,
)

/** `GET …/catalog/items` decoded with the owner-editable row shape. */
@JsonClass(generateAdapter = true)
data class BusinessCatalogManagedItemsResponse(
    val items: List<BusinessCatalogManagedItemDto> = emptyList(),
)

/** `POST` / `PATCH` item envelope. Routes `…:2339` + `…:2425`. */
@JsonClass(generateAdapter = true)
data class BusinessCatalogItemEnvelope(
    val item: BusinessCatalogManagedItemDto? = null,
)

/**
 * Body for item create / update — mirrors `createCatalogItemSchema`
 * (`backend/routes/businesses.js:233`).
 *
 * The catalog editor is a *full-form* editor: every key it owns is always
 * sent, and a cleared field is sent as an explicit JSON `null` (which the
 * schema allows) so clearing a price / duration / category actually
 * sticks. Moshi drops nulls by default, so
 * [BusinessCatalogItemRequestJsonAdapter] serialises this type with
 * `serializeNulls` on. iOS encodes the identical shape.
 */
data class BusinessCatalogItemRequest(
    val name: String,
    val description: String?,
    val kind: String,
    val status: String,
    val priceCents: Int?,
    val priceMaxCents: Int?,
    val priceUnit: String?,
    val durationMinutes: Int?,
    val isFeatured: Boolean,
    val categoryId: String?,
)

/** One `{ id, sort_order }` pair in the reorder body. */
@JsonClass(generateAdapter = true)
data class BusinessCatalogReorderEntry(
    val id: String,
    @Json(name = "sort_order") val sortOrder: Int,
)

/**
 * `POST …/catalog/items/reorder` body — `{ items: [{ id, sort_order }] }`.
 * Route `backend/routes/businesses.js:2504`.
 */
@JsonClass(generateAdapter = true)
data class BusinessCatalogReorderRequest(
    val items: List<BusinessCatalogReorderEntry>,
)

/** `{ message }` ack returned by the catalog delete / reorder routes. */
@JsonClass(generateAdapter = true)
data class BusinessCatalogMessageResponse(
    val message: String? = null,
    val count: Int? = null,
)
