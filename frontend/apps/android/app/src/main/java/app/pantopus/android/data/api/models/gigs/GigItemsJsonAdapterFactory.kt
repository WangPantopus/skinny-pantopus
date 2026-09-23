package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonDataException
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import java.io.IOException
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type
import java.lang.reflect.WildcardType

/**
 * `gig.items` is jsonb, and older writers stored it as a JSON string ("[]" or "[{…}]"). A list
 * adapter rejects that and fails the whole task. Read a string by parsing the list inside it, and
 * any other non-list value as no items, as iOS does with `try?`. Lists and null read as before.
 */
object GigItemsJsonAdapterFactory : JsonAdapter.Factory {
    override fun create(
        type: Type,
        annotations: Set<Annotation>,
        moshi: Moshi,
    ): JsonAdapter<*>? {
        if (annotations.isNotEmpty() || !isGigItemList(type)) return null
        val delegate = moshi.nextAdapter<List<GigItemDto>>(this, type, annotations)
        return object : JsonAdapter<List<GigItemDto>>() {
            override fun fromJson(reader: JsonReader): List<GigItemDto>? =
                when (reader.peek()) {
                    JsonReader.Token.NULL -> reader.nextNull()
                    JsonReader.Token.BEGIN_ARRAY -> delegate.fromJson(reader)
                    JsonReader.Token.STRING -> parseEncoded(reader.nextString())
                    else -> {
                        reader.skipValue()
                        emptyList()
                    }
                }

            private fun parseEncoded(encoded: String): List<GigItemDto> =
                try {
                    delegate.fromJson(encoded).orEmpty()
                } catch (_: IOException) {
                    emptyList()
                } catch (_: JsonDataException) {
                    emptyList()
                }

            override fun toJson(
                writer: JsonWriter,
                value: List<GigItemDto>?,
            ) = delegate.toJson(writer, value)
        }
    }

    private fun isGigItemList(type: Type): Boolean {
        if (type !is ParameterizedType || Types.getRawType(type) != List::class.java) return false
        val argument = type.actualTypeArguments.singleOrNull() ?: return false
        val element = if (argument is WildcardType) argument.upperBounds.singleOrNull() else argument
        return element == GigItemDto::class.java
    }
}
