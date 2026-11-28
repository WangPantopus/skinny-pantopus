package app.pantopus.android.data.api.models.reinvented

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonQualifier
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import java.lang.reflect.Type
import java.lang.reflect.WildcardType

/**
 * A list read item by item: an item that can't be read (a new kind, a field this app doesn't know the shape of) is
 * left out and the rest of the list stays. A missing or null list is empty. For the "Pulse, reinvented" answers, where
 * one odd Moment or post must never cost the screen ([LossyListAdapterFactory]).
 */
@Retention(AnnotationRetention.RUNTIME)
@JsonQualifier
annotation class Lossy

/** Reads every `@Lossy List<T>`: each item through T's own adapter, skipping the ones it can't read. */
object LossyListAdapterFactory : JsonAdapter.Factory {
    override fun create(
        type: Type,
        annotations: MutableSet<out Annotation>,
        moshi: Moshi,
    ): JsonAdapter<*>? {
        val rest = Types.nextAnnotations(annotations, Lossy::class.java) ?: return null
        if (rest.isNotEmpty() || Types.getRawType(type) != List::class.java) return null
        val element = Types.collectionElementType(type, List::class.java).let { if (it is WildcardType) it.upperBounds[0] else it }
        return LossyListAdapter(moshi.adapter<Any>(element), moshi)
    }
}

/**
 * An item that reads more from its own JSON beside what its adapter read (a post's phase 3 keys, read beside today's
 * post): [beside] gets the item's JSON value and returns the item to keep.
 */
interface ReadsBeside {
    fun beside(
        raw: Any?,
        moshi: Moshi,
    ): Any
}

private class LossyListAdapter(
    private val item: JsonAdapter<Any>,
    private val moshi: Moshi,
) : JsonAdapter<List<Any>>() {
    override fun fromJson(reader: JsonReader): List<Any> {
        if (reader.peek() != JsonReader.Token.BEGIN_ARRAY) {
            reader.skipValue()
            return emptyList()
        }
        val out = mutableListOf<Any>()
        reader.beginArray()
        while (reader.hasNext()) {
            val value = reader.readJsonValue()
            runCatching { item.fromJsonValue(value) }
                .getOrNull()
                ?.let { read -> (read as? ReadsBeside)?.let { runCatching { it.beside(value, moshi) }.getOrNull() } ?: read }
                ?.let(out::add)
        }
        reader.endArray()
        return out
    }

    override fun toJson(
        writer: JsonWriter,
        value: List<Any>?,
    ) {
        writer.beginArray()
        value?.forEach { item.toJson(writer, it) }
        writer.endArray()
    }
}
