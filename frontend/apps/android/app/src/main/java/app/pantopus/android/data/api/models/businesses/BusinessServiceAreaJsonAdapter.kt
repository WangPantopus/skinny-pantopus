@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.businesses

import com.squareup.moshi.FromJson
import com.squareup.moshi.JsonReader

/**
 * Decodes `service_area` as either a legacy display string or a structured
 * jsonb object. Registered in [app.pantopus.android.di.NetworkModule]
 * ahead of `KotlinJsonAdapterFactory`.
 */
class BusinessServiceAreaJsonAdapter {
    @FromJson
    fun fromJson(reader: JsonReader): BusinessServiceAreaDto? =
        when (reader.peek()) {
            JsonReader.Token.NULL -> {
                reader.nextNull<Any>()
                null
            }
            JsonReader.Token.STRING -> {
                val text = reader.nextString()
                BusinessServiceAreaDto(legacyDisplayText = text.takeIf { it.isNotEmpty() })
            }
            JsonReader.Token.BEGIN_OBJECT -> {
                var city: String? = null
                var state: String? = null
                var radiusMiles: Double? = null
                var radiusKm: Double? = null
                var centerLat: Double? = null
                var centerLng: Double? = null
                reader.beginObject()
                while (reader.hasNext()) {
                    when (reader.nextName()) {
                        "city" -> city = reader.nextStringOrNull()
                        "state" -> state = reader.nextStringOrNull()
                        "radius_miles" -> radiusMiles = reader.nextDoubleOrNull()
                        "radius_km" -> radiusKm = reader.nextDoubleOrNull()
                        "center_lat" -> centerLat = reader.nextDoubleOrNull()
                        "center_lng" -> centerLng = reader.nextDoubleOrNull()
                        else -> reader.skipValue()
                    }
                }
                reader.endObject()
                BusinessServiceAreaDto(
                    city = city,
                    state = state,
                    radiusMiles = radiusMiles,
                    radiusKm = radiusKm,
                    centerLat = centerLat,
                    centerLng = centerLng,
                )
            }
            else -> {
                reader.skipValue()
                null
            }
        }

    private fun JsonReader.nextStringOrNull(): String? =
        if (peek() == JsonReader.Token.NULL) {
            nextNull<Any>()
            null
        } else {
            nextString().takeIf { it.isNotEmpty() }
        }

    private fun JsonReader.nextDoubleOrNull(): Double? =
        when (peek()) {
            JsonReader.Token.NULL -> {
                nextNull<Any>()
                null
            }
            JsonReader.Token.NUMBER -> nextDouble()
            else -> {
                skipValue()
                null
            }
        }
}
