package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Canonical validation is separate from checking whether a Home exists. */
@JsonClass(generateAdapter = true)
data class HomeAddressValidationRequest(
    val line1: String,
    val line2: String? = null,
    val city: String,
    val state: String,
    val zip: String,
)

@JsonClass(generateAdapter = true)
data class HomeAddressValidationResponse(
    @Json(name = "address_id") val addressId: String?,
    val verdict: HomeAddressVerdict,
)

@JsonClass(generateAdapter = true)
data class HomeAddressVerdict(
    val status: String,
    val normalized: ValidatedHomeAddress? = null,
)

@JsonClass(generateAdapter = true)
data class ValidatedHomeAddress(
    val line1: String,
    val line2: String? = null,
    val city: String,
    val state: String,
    val zip: String,
    val lat: Double,
    val lng: Double,
) {
    val isValid: Boolean
        get() =
            listOf(line1, city, state, zip).all { it.isNotBlank() } &&
                lat.isFinite() && lng.isFinite() && lat in -90.0..90.0 && lng in -180.0..180.0
}
