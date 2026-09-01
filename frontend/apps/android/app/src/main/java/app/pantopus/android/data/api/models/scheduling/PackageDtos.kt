@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Session packages (owner + customer). `GET/POST /packages`,
 * `PUT/DELETE /packages/:id`, `POST /packages/:id/buy`, `GET /my-packages`,
 * `POST /bookings/:id/apply-credit`. Paid surfaces sit behind the paid flag +
 * Stripe test mode.
 */
@JsonClass(generateAdapter = true)
data class PackageDto(
    val id: String,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
    val name: String,
    @Json(name = "sessions_count") val sessionsCount: Int = 0,
    @Json(name = "price_cents") val priceCents: Int = 0,
    val currency: String? = null,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    /** Derived on `GET /packages` — granted credits ("· N sold"). iOS parity. */
    @Json(name = "sold_count") val soldCount: Int? = null,
)

/** `GET /packages` — `{ packages: [...] }`. */
@JsonClass(generateAdapter = true)
data class GetPackagesResponse(
    val packages: List<PackageDto> = emptyList(),
)

/** `POST/PUT /packages` — `{ package: … }`. */
@JsonClass(generateAdapter = true)
data class PackageResponse(
    @Json(name = "package") val pkg: PackageDto,
)

/** Body for `POST /packages`. */
@JsonClass(generateAdapter = true)
data class CreatePackageRequest(
    val name: String,
    @Json(name = "sessions_count") val sessionsCount: Int,
    @Json(name = "price_cents") val priceCents: Int? = null,
    val currency: String? = null,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/** Body for `PUT /packages/:id` (partial). */
@JsonClass(generateAdapter = true)
data class UpdatePackageRequest(
    val name: String? = null,
    @Json(name = "sessions_count") val sessionsCount: Int? = null,
    @Json(name = "price_cents") val priceCents: Int? = null,
    val currency: String? = null,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
)

/** Nested package metadata on a credit (`GET /my-packages`). */
@JsonClass(generateAdapter = true)
data class CreditPackageMeta(
    val name: String? = null,
    @Json(name = "sessions_count") val sessionsCount: Int? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
)

/** A purchased package credit. */
@JsonClass(generateAdapter = true)
data class PackageCreditDto(
    val id: String,
    @Json(name = "package_id") val packageId: String? = null,
    @Json(name = "buyer_user_id") val buyerUserId: String? = null,
    @Json(name = "remaining") val remaining: Int? = null,
    @Json(name = "total") val total: Int? = null,
    @Json(name = "purchased_at") val purchasedAt: String? = null,
    @Json(name = "BookingPackage") val bookingPackage: CreditPackageMeta? = null,
)

/**
 * `POST /packages/:id/buy` — `{ credit, clientSecret }`. `clientSecret` is the
 * Stripe payment-intent secret for priced packages (null when free).
 */
@JsonClass(generateAdapter = true)
data class BuyPackageResponse(
    val credit: PackageCreditDto,
    val clientSecret: String? = null,
)

/** `GET /my-packages` — `{ credits: [...] }`. */
@JsonClass(generateAdapter = true)
data class MyPackagesResponse(
    val credits: List<PackageCreditDto> = emptyList(),
)
