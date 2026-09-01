@file:Suppress("PackageNaming", "UnusedParameter")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.FromJson
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.ToJson

/**
 * Custom Moshi serializer for [UploadEvidenceRequest]. The wire schema
 * treats `storage_ref` and `metadata` as optional — omitting them when
 * the user didn't supply a value, rather than emitting JSON `null`,
 * matches what the web client sends and avoids tripping any strict
 * Joi `null`-rejection on the backend.
 *
 * Registered in `NetworkModule.provideMoshi` ahead of
 * `KotlinJsonAdapterFactory` so this adapter wins for the type.
 */
class UploadEvidenceRequestJsonAdapter {
    @ToJson
    fun toJson(
        writer: JsonWriter,
        value: UploadEvidenceRequest,
    ) {
        writer.beginObject()
        writer.name("evidence_type").value(value.evidenceType)
        writer.name("provider").value(value.provider)
        value.storageRef?.let { writer.name("storage_ref").value(it) }
        val metadata = value.metadata
        if (!metadata.isNullOrEmpty()) {
            writer.name("metadata").beginObject()
            metadata.forEach { (key, raw) -> writer.name(key).value(raw) }
            writer.endObject()
        }
        writer.endObject()
    }

    /**
     * Deserialization isn't supported — this DTO is request-only. If a
     * future caller tries to round-trip it through Moshi the failure is
     * loud and immediate rather than silently producing a half-default
     * instance.
     */
    @FromJson
    fun fromJson(reader: JsonReader): UploadEvidenceRequest =
        error("UploadEvidenceRequest is request-only; deserialization is not supported.")
}
