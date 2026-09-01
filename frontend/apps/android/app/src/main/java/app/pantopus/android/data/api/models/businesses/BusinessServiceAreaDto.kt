@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.businesses

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.util.Locale

/**
 * `BusinessProfile.service_area` — backend stores jsonb that may be a legacy
 * display string or a structured object (city/state, radius, center coords).
 * Decoded via [BusinessServiceAreaJsonAdapter].
 */
@JsonClass(generateAdapter = false)
data class BusinessServiceAreaDto(
    val city: String? = null,
    val state: String? = null,
    @Json(name = "radius_miles") val radiusMiles: Double? = null,
    @Json(name = "radius_km") val radiusKm: Double? = null,
    @Json(name = "center_lat") val centerLat: Double? = null,
    @Json(name = "center_lng") val centerLng: Double? = null,
    val legacyDisplayText: String? = null,
) {
    fun formattedLabel(): String? {
        legacyDisplayText?.takeIf { it.isNotEmpty() }?.let { return it }
        val segments = mutableListOf<String>()
        val locality =
            listOfNotNull(
                city?.takeIf { it.isNotEmpty() },
                state?.takeIf { it.isNotEmpty() },
            ).joinToString(", ")
        if (locality.isNotEmpty()) segments += locality
        when {
            radiusMiles != null -> {
                val formatted =
                    if (radiusMiles % 1.0 == 0.0) {
                        String.format(Locale.US, "%.0f mi", radiusMiles)
                    } else {
                        String.format(Locale.US, "%.1f mi", radiusMiles)
                    }
                segments += "within $formatted"
            }
            radiusKm != null -> {
                val formatted =
                    if (radiusKm % 1.0 == 0.0) {
                        String.format(Locale.US, "%.0f km", radiusKm)
                    } else {
                        String.format(Locale.US, "%.1f km", radiusKm)
                    }
                segments += "within $formatted"
            }
        }
        return segments.takeIf { it.isNotEmpty() }?.joinToString(" — ")
    }
}
