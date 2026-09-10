package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonDataException
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.Moshi
import java.lang.reflect.Type

/** Frozen terms distinguish an explicit null from an absent key on both sides of the wire. */
object GigStopJsonAdapterFactory : JsonAdapter.Factory {
    override fun create(
        type: Type,
        annotations: Set<Annotation>,
        moshi: Moshi,
    ): JsonAdapter<*>? {
        if (annotations.isNotEmpty()) return null
        val required =
            when (type) {
                GigStopTerms::class.java -> setOf("workerId", "paymentId", "acceptedAt", "acceptedBidId")
                GigStopReceipt::class.java -> setOf("paymentId", "workerId")
                else -> return null
            }
        val delegate = moshi.nextAdapter<Any>(this, type, annotations).serializeNulls()
        return object : JsonAdapter<Any>() {
            override fun fromJson(reader: JsonReader): Any? {
                val present = mutableSetOf<String>()
                reader.peekJson().use { preview ->
                    preview.beginObject()
                    while (preview.hasNext()) {
                        present.add(preview.nextName())
                        preview.skipValue()
                    }
                    preview.endObject()
                }
                if (!present.containsAll(required)) throw JsonDataException("Task action details are missing required fields.")
                return delegate.fromJson(reader)
            }

            override fun toJson(
                writer: JsonWriter,
                value: Any?,
            ) = delegate.toJson(writer, value)
        }.nullSafe()
    }
}
