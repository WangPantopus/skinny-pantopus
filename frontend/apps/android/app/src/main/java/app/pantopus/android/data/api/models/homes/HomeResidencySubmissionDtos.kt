package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** The complete address explicitly selected by the applicant, including the apartment. */
@JsonClass(generateAdapter = true)
data class HomeResidencyAddressSnapshot(
    val line1: String,
    val line2: String,
    val city: String,
    val state: String,
    @Json(name = "postal_code") val postalCode: String,
    val country: String,
) {
    @Suppress("MagicNumber")
    fun isValid(): Boolean =
        listOf(line1 to 255, line2 to 255, city to 100, state to 50, postalCode to 20, country to 100)
            .all { (value, limit) -> value.length <= limit } &&
            listOf(line1, city, state, postalCode, country).all(String::isNotBlank)
}

@JsonClass(generateAdapter = true)
data class HomeResidencySubmissionRequest(
    @Json(name = "request_id") val requestId: String,
    @Json(name = "claimed_role") val claimedRole: String,
    val address: HomeResidencyAddressSnapshot,
)
