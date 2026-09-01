@file:Suppress("PackageNaming", "UnusedParameter")

package app.pantopus.android.data.api.models.businesses

import com.squareup.moshi.FromJson
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.ToJson

/**
 * Custom Moshi serializer for [BusinessCatalogItemRequest].
 *
 * The catalog editor owns every key it sends, so a cleared price / max
 * price / price unit / duration / category has to reach the backend as an
 * explicit JSON `null` — `createCatalogItemSchema` and
 * `updateCatalogItemSchema` both `.allow(null)` on those keys
 * (`backend/routes/businesses.js:233-260`). Moshi omits nulls by default,
 * which would silently make "clear the price" a no-op, so this adapter
 * flips `serializeNulls` for the duration of the object.
 *
 * Registered in `NetworkModule.provideMoshi` ahead of the generic Kotlin
 * factory so it wins the lookup — same pattern as
 * `UploadEvidenceRequestJsonAdapter`.
 */
class BusinessCatalogItemRequestJsonAdapter {
    @ToJson
    fun toJson(
        writer: JsonWriter,
        value: BusinessCatalogItemRequest,
    ) {
        val previous = writer.serializeNulls
        writer.serializeNulls = true
        try {
            writer.beginObject()
            writer.name("name").value(value.name)
            writer.name("description").value(value.description)
            writer.name("kind").value(value.kind)
            writer.name("status").value(value.status)
            writer.name("price_cents").value(value.priceCents)
            writer.name("price_max_cents").value(value.priceMaxCents)
            writer.name("price_unit").value(value.priceUnit)
            writer.name("duration_minutes").value(value.durationMinutes)
            writer.name("is_featured").value(value.isFeatured)
            writer.name("category_id").value(value.categoryId)
            writer.endObject()
        } finally {
            writer.serializeNulls = previous
        }
    }

    /**
     * Deserialization isn't supported — this DTO is request-only. A future
     * caller that tries to round-trip it fails loudly rather than getting a
     * half-default instance.
     */
    @FromJson
    fun fromJson(reader: JsonReader): BusinessCatalogItemRequest =
        error("BusinessCatalogItemRequest is request-only; deserialization is not supported.")
}
