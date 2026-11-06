package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonDataException
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.Moshi
import java.lang.reflect.Type

/**
 * A malformed [RecordProvenanceDto] reads as none: a label never fails the answer it came with (the fields
 * still fill in, the value card still shows). Parity with the iOS DTOs' `try?`.
 */
object RecordProvenanceAdapterFactory : JsonAdapter.Factory {
    override fun create(
        type: Type,
        annotations: Set<Annotation>,
        moshi: Moshi,
    ): JsonAdapter<*>? {
        if (annotations.isNotEmpty() || type != RecordProvenanceDto::class.java) return null
        val delegate = moshi.nextAdapter<RecordProvenanceDto>(this, type, annotations)
        return object : JsonAdapter<RecordProvenanceDto>() {
            override fun fromJson(reader: JsonReader): RecordProvenanceDto? {
                val value = reader.readJsonValue()
                return try {
                    delegate.fromJsonValue(value)?.takeIf { it.label.isNotBlank() }
                } catch (_: JsonDataException) {
                    null
                }
            }

            override fun toJson(
                writer: JsonWriter,
                value: RecordProvenanceDto?,
            ) = delegate.toJson(writer, value)
        }
    }
}
