@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.listings

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Privacy-safe coarse location surfaced on listings map responses. */
@JsonClass(generateAdapter = true)
data class ListingApproxLocation(
    val latitude: Double? = null,
    val longitude: Double? = null,
    val label: String? = null,
)

/**
 * One row from the marketplace endpoints. Mirrors `normalizeListingRow`
 * in `backend/services/marketplace/marketplaceService.js:82`.
 *
 * T6.3f / P14 — added `viewCount`, `activeOfferCount`, `soldAt`,
 * `archivedAt` so the My listings chip-meta line can render views /
 * offers / status without an extra request. The fields default to
 * `null` for backwards compat with browse / nearby / detail call sites
 * that don't need them.
 */
@JsonClass(generateAdapter = true)
data class ListingDto(
    val id: String,
    @Json(name = "user_id") val userId: String? = null,
    val title: String? = null,
    val description: String? = null,
    val price: Double? = null,
    @Json(name = "is_free") val isFree: Boolean? = null,
    val category: String? = null,
    val condition: String? = null,
    val status: String? = null,
    @Json(name = "media_urls") val mediaUrls: List<String>? = null,
    @Json(name = "first_image") val firstImage: String? = null,
    val layer: String? = null,
    @Json(name = "listing_type") val listingType: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "location_name") val locationName: String? = null,
    @Json(name = "distance_meters") val distanceMeters: Double? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "userHasSaved") val userHasSaved: Boolean? = null,
    @Json(name = "approx_location") val approxLocation: ListingApproxLocation? = null,
    @Json(name = "view_count") val viewCount: Int? = null,
    @Json(name = "active_offer_count") val activeOfferCount: Int? = null,
    @Json(name = "sold_at") val soldAt: String? = null,
    @Json(name = "archived_at") val archivedAt: String? = null,
)

/**
 * Envelope from `GET /api/listings/me` — the current user's own
 * listings, optionally filtered by `status`. Route:
 * `backend/routes/listings.js:1058`.
 */
@JsonClass(generateAdapter = true)
data class MyListingsResponse(
    val listings: List<ListingDto>,
    val pagination: ListingsPagination? = null,
)

/** Pagination cursor returned by `/browse` and `/nearby`. */
@JsonClass(generateAdapter = true)
data class ListingsPagination(
    val limit: Int? = null,
    val offset: Int? = null,
    val hasMore: Boolean? = null,
    @Json(name = "next_cursor") val nextCursor: String? = null,
)

/** Envelope from `/api/listings/browse`. */
@JsonClass(generateAdapter = true)
data class ListingsBrowseResponse(
    val listings: List<ListingDto>,
    val pagination: ListingsPagination? = null,
    @Json(name = "nearest_activity_center") val nearestActivityCenter: NearestActivityCenter? = null,
)

/** Envelope from `/api/listings/nearby`. */
@JsonClass(generateAdapter = true)
data class ListingsNearbyResponse(
    val listings: List<ListingDto>,
    val pagination: ListingsPagination? = null,
)

/** Envelope from `/api/listings/in-bounds`. */
@JsonClass(generateAdapter = true)
data class ListingsInBoundsResponse(
    val listings: List<ListingDto>,
    @Json(name = "nearest_activity_center") val nearestActivityCenter: NearestActivityCenter? = null,
)

/** Backend recenter hint for empty viewports. */
@JsonClass(generateAdapter = true)
data class NearestActivityCenter(
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/** Envelope from `/api/listings/categories`. */
@JsonClass(generateAdapter = true)
data class ListingsCategoriesResponse(
    val categories: List<String>,
    val conditions: List<String>,
)

/** Save / unsave envelope from `POST /api/listings/:id/save`. */
@JsonClass(generateAdapter = true)
data class ListingSaveResponse(
    val message: String? = null,
    val saved: Boolean? = null,
)

/** Envelope from `GET /api/listings/:id`. */
@JsonClass(generateAdapter = true)
data class ListingDetailResponse(
    val listing: ListingDto,
)

/**
 * Body for `POST /api/listings`. Mirrors the destructure at
 * `backend/routes/listings.js:430`. The wizard sends the commonly-used
 * subset; backend defaults take care of the rest (visibility scope,
 * radius, expirations, geocode provenance, …).
 */
@JsonClass(generateAdapter = true)
data class CreateListingRequest(
    val title: String,
    val description: String? = null,
    val price: Double? = null,
    val isFree: Boolean,
    val category: String,
    val condition: String? = null,
    val mediaUrls: List<String> = emptyList(),
    val layer: String,
    val listingType: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val locationName: String? = null,
    val locationAddress: String? = null,
    val meetupPreference: String? = null,
    val deliveryAvailable: Boolean = false,
    val isWanted: Boolean = false,
)

/** Envelope from `POST /api/listings` (status 201). */
@JsonClass(generateAdapter = true)
data class CreateListingResponse(
    val message: String? = null,
    val listing: ListingDto,
)

/**
 * Body for `PATCH /api/listings/:id`. Owner-only update. Mirrors the
 * fields the Snap & Sell wizard collects so the same form can drive
 * create + edit. All fields are nullable — Moshi omits `null` from the
 * encoded JSON, matching the backend Joi schema's `min(1)` requirement
 * that at least one updatable field be present.
 */
@JsonClass(generateAdapter = true)
data class UpdateListingRequest(
    val title: String? = null,
    val description: String? = null,
    val price: Double? = null,
    val isFree: Boolean? = null,
    val category: String? = null,
    val condition: String? = null,
    val mediaUrls: List<String>? = null,
    val layer: String? = null,
    val listingType: String? = null,
    val locationName: String? = null,
    val meetupPreference: String? = null,
    val deliveryAvailable: Boolean? = null,
    val isWanted: Boolean? = null,
)

/** Envelope from `PATCH /api/listings/:id`. */
@JsonClass(generateAdapter = true)
data class UpdateListingResponse(
    val message: String? = null,
    val listing: ListingDto,
)

/**
 * Envelope from `POST /api/upload/listing-media/:listingId` — hosted
 * URLs for the photos just attached. Route `backend/routes/upload.js:1049`.
 */
@JsonClass(generateAdapter = true)
data class ListingMediaUploadResponse(
    val message: String? = null,
    @Json(name = "media_urls") val mediaUrls: List<String> = emptyList(),
    @Json(name = "media_types") val mediaTypes: List<String>? = null,
)

/** `POST /api/listings/:id/message` body. */
@JsonClass(generateAdapter = true)
data class MessageListingBody(
    val message: String? = null,
    val offerAmount: Double? = null,
)

/** `POST /api/listings/:id/message` envelope. */
@JsonClass(generateAdapter = true)
data class MessageListingResponse(
    val message: String? = null,
    @Json(name = "listing_message") val listingMessage: ListingMessageDto? = null,
)

/** One listing-message row. */
@JsonClass(generateAdapter = true)
data class ListingMessageDto(
    val id: String,
    @Json(name = "listing_id") val listingId: String? = null,
    @Json(name = "buyer_id") val buyerId: String? = null,
    @Json(name = "seller_id") val sellerId: String? = null,
    @Json(name = "offer_amount") val offerAmount: Double? = null,
    @Json(name = "message") val messageText: String? = null,
    val status: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)
