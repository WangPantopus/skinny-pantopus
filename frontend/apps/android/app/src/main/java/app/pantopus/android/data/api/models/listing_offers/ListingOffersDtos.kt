@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.listing_offers

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/listings/:listingId/offers` envelope — route
 * `backend/routes/listingOffers.js:78`.
 *
 * The handler enriches each offer with `buyer` + `seller` user cards
 * (`first_name, last_name, username, profile_picture_url`).
 */
@JsonClass(generateAdapter = true)
data class ListingOffersResponse(
    val offers: List<ListingOfferDto> = emptyList(),
)

/**
 * Envelope returned by every listing-offer mutation
 * (accept / decline / counter / withdraw / complete). The route wraps
 * the updated row in `{ offer: {...} }`.
 */
@JsonClass(generateAdapter = true)
data class ListingOfferResponseEnvelope(
    val offer: ListingOfferDto,
)

/** One offer on a listing. */
@JsonClass(generateAdapter = true)
data class ListingOfferDto(
    val id: String,
    @Json(name = "listing_id") val listingId: String? = null,
    @Json(name = "buyer_id") val buyerId: String? = null,
    @Json(name = "seller_id") val sellerId: String? = null,
    val amount: Double? = null,
    val message: String? = null,
    val status: String? = null,
    @Json(name = "counter_amount") val counterAmount: Double? = null,
    @Json(name = "counter_message") val counterMessage: String? = null,
    @Json(name = "parent_offer_id") val parentOfferId: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "responded_at") val respondedAt: String? = null,
    @Json(name = "completed_at") val completedAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    val buyer: ListingOfferUserDto? = null,
    val seller: ListingOfferUserDto? = null,
)

/** Inlined buyer / seller user card on each offer. */
@JsonClass(generateAdapter = true)
data class ListingOfferUserDto(
    val id: String,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "last_name") val lastName: String? = null,
    val username: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/** Body for `POST /api/listings/:listingId/offers/:offerId/counter`. */
@JsonClass(generateAdapter = true)
data class CounterListingOfferBody(
    @Json(name = "counterAmount") val counterAmount: Double,
    @Json(name = "counterMessage") val counterMessage: String? = null,
)
