@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One row from `GET /api/homes/:id/packages` —
 * `backend/routes/home.js:4673`.
 *
 * Backend table is `HomePackage` (`schema.sql:6552`). Status is enforced
 * by a CHECK constraint to one of six values — see
 * `PackageChipStatus.from()` for the mapping into the UI taxonomy.
 */
@JsonClass(generateAdapter = true)
data class PackageDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    val carrier: String? = null,
    @Json(name = "tracking_number") val trackingNumber: String? = null,
    @Json(name = "vendor_name") val vendorName: String? = null,
    val description: String? = null,
    @Json(name = "delivery_instructions") val deliveryInstructions: String? = null,
    val status: String = "expected",
    @Json(name = "expected_at") val expectedAt: String? = null,
    @Json(name = "delivered_at") val deliveredAt: String? = null,
    @Json(name = "picked_up_by") val pickedUpBy: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    val visibility: String? = null,
)

/** Envelope for `GET /api/homes/:id/packages`. */
@JsonClass(generateAdapter = true)
data class GetHomePackagesResponse(
    val packages: List<PackageDto> = emptyList(),
)

/** Envelope for `POST …/packages` and `PUT …/packages/:packageId`. */
@JsonClass(generateAdapter = true)
data class HomePackageResponse(
    val `package`: PackageDto,
)

/**
 * Body for `POST /api/homes/:id/packages` —
 * `backend/routes/home.js:4706`. All fields optional; the server
 * defaults `status` to `expected`.
 */
@JsonClass(generateAdapter = true)
data class CreatePackageRequest(
    val carrier: String? = null,
    @Json(name = "tracking_number") val trackingNumber: String? = null,
    @Json(name = "vendor_name") val vendorName: String? = null,
    val description: String? = null,
    @Json(name = "delivery_instructions") val deliveryInstructions: String? = null,
    @Json(name = "expected_at") val expectedAt: String? = null,
)

/**
 * Body for `PUT /api/homes/:id/packages/:packageId` —
 * `backend/routes/home.js:4746`. All fields optional. The server
 * auto-fills `delivered_at = now()` when `status` flips to
 * `delivered` and `picked_up_by = me` when `status` flips to
 * `picked_up`.
 */
@JsonClass(generateAdapter = true)
data class UpdatePackageRequest(
    val status: String? = null,
    @Json(name = "delivered_at") val deliveredAt: String? = null,
    @Json(name = "picked_up_by") val pickedUpBy: String? = null,
    val carrier: String? = null,
    @Json(name = "tracking_number") val trackingNumber: String? = null,
    val description: String? = null,
    @Json(name = "delivery_instructions") val deliveryInstructions: String? = null,
    @Json(name = "expected_at") val expectedAt: String? = null,
)
