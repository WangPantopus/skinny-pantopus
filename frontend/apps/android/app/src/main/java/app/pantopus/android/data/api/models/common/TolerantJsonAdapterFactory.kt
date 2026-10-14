package app.pantopus.android.data.api.models.common

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonDataException
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import timber.log.Timber
import java.lang.reflect.Type

/**
 * Tolerant decoding for the replies a newer backend changes first: posts in a feed, one post, its comments and the
 * notification list (Pulse build slice S2). The backend may add post types, enum values and fields, and may return
 * `null` for a field, as soon as older apps tolerate it.
 *
 * Two rules, applied only to the DTOs passed in [tolerantTypes]:
 *  - a field the server sends as `null` reads as missing, so its default applies (`like_count: null` is 0,
 *    `media_urls: null` is empty) instead of failing the whole reply;
 *  - in a list of those DTOs, an element that still can't be read (no `id`, text where a number belongs) is skipped,
 *    so one odd item never blanks the page. A null list is empty.
 *
 * Unknown keys are ignored by Moshi already, and the values that grow (`post_type`, notification `type`, `state`) are
 * strings the screens map with a generic fallback. Register this ahead of the generated adapters in
 * `NetworkModule.provideMoshi`; it then also covers the pages the screens' store saves and reads back.
 */
class TolerantJsonAdapterFactory(
    private val tolerantTypes: Set<Type>,
) : JsonAdapter.Factory {
    override fun create(
        type: Type,
        annotations: Set<Annotation>,
        moshi: Moshi,
    ): JsonAdapter<*>? =
        when {
            annotations.isNotEmpty() -> null
            type in tolerantTypes -> NullAsMissingAdapter(moshi.nextAdapter<Any>(this, type, annotations))
            else -> tolerantElementOf(type)?.let { TolerantListAdapter(moshi.adapter<Any>(it)) }
        }

    /** The element type when [type] is a `List` of one of [tolerantTypes], else null. */
    private fun tolerantElementOf(type: Type): Type? =
        if (Types.getRawType(type) == List::class.java) {
            Types.collectionElementType(type, Collection::class.java).takeIf { it in tolerantTypes }
        } else {
            null
        }
}

/** Reads an object with its `null` fields removed, so a field that is null reads as missing. */
private class NullAsMissingAdapter<T>(
    private val delegate: JsonAdapter<T>,
) : JsonAdapter<T>() {
    override fun fromJson(reader: JsonReader): T? {
        if (reader.peek() != JsonReader.Token.BEGIN_OBJECT) return delegate.fromJson(reader)
        return delegate.fromJsonValue(withoutNulls(reader.readJsonValue()))
    }

    override fun toJson(
        writer: JsonWriter,
        value: T?,
    ) = delegate.toJson(writer, value)

    private fun withoutNulls(value: Any?): Any? =
        when (value) {
            is Map<*, *> -> value.entries.filter { it.value != null }.associate { it.key to withoutNulls(it.value) }
            is List<*> -> value.map(::withoutNulls)
            else -> value
        }
}

/** Reads a list one element at a time; an element that can't be decoded is skipped (a null list is empty). */
private class TolerantListAdapter<E>(
    private val element: JsonAdapter<E>,
) : JsonAdapter<List<E>>() {
    override fun fromJson(reader: JsonReader): List<E> {
        if (reader.peek() == JsonReader.Token.NULL) {
            reader.nextNull<Any>()
            return emptyList()
        }
        val items = ArrayList<E>()
        var index = 0
        reader.beginArray()
        while (reader.hasNext()) {
            // A tree first: a failure inside one element leaves the reader at the next one.
            val raw = reader.readJsonValue()
            try {
                element.fromJsonValue(raw)?.let(items::add)
            } catch (error: JsonDataException) {
                // Not the message: Moshi's can quote the value that didn't fit.
                Timber.tag("HTTP").w("skipped element $index of a list that couldn't be read (${error.javaClass.simpleName})")
            }
            index++
        }
        reader.endArray()
        return items
    }

    override fun toJson(
        writer: JsonWriter,
        value: List<E>?,
    ) {
        if (value == null) {
            writer.nullValue()
            return
        }
        writer.beginArray()
        value.forEach { element.toJson(writer, it) }
        writer.endArray()
    }
}
