@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.FromJson
import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonClass
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.Moshi
import com.squareup.moshi.ToJson
import java.lang.reflect.Type

/**
 * One row from `GET /api/homes/:id/polls` — `backend/routes/home.js:6984`.
 *
 * The backend enriches each row with:
 *  - `vote_count` — total votes across all members
 *  - `option_counts` — per-option breakdown keyed by [PollOptionDto.id]
 *  - `my_vote` — the current viewer's selected option keys (array), or
 *    null when they haven't voted
 *
 * `options` arrives as either a bare-string array (`["Sat", "Sun"]`) or
 * an array of objects (`[{ id, label }, …]`); [PollOptionAdapter] normalises
 * both shapes into [PollOptionDto].
 */
@JsonClass(generateAdapter = true)
data class PollDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    val title: String,
    val description: String? = null,
    @Json(name = "poll_type") val pollType: String = "single_choice",
    val options: List<PollOptionDto> = emptyList(),
    val status: String = "open",
    @Json(name = "closes_at") val closesAt: String? = null,
    val visibility: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
    @Json(name = "vote_count") val voteCount: Int = 0,
    @Json(name = "option_counts") val optionCounts: Map<String, Int> = emptyMap(),
    @Json(name = "my_vote") val myVote: List<String>? = null,
)

/**
 * One option on a [PollDto]. The backend serialises options as either a
 * bare string (`"Sat"`) or an object (`{ id, label }`). [PollOptionAdapter]
 * accepts both forms; [id] is what we send back on a vote, [label] is
 * what the user sees.
 */
data class PollOptionDto(
    val id: String,
    val label: String,
)

/** Envelope for `GET /api/homes/:id/polls`. */
@JsonClass(generateAdapter = true)
data class GetHomePollsResponse(
    val polls: List<PollDto> = emptyList(),
)

/** Envelope for `POST /api/homes/:id/polls` and `PUT …/:pollId`. */
@JsonClass(generateAdapter = true)
data class HomePollResponse(
    val poll: PollDto,
)

/**
 * Body for `POST /api/homes/:id/polls`. The backend's options array
 * accepts both strings and objects; we send `{ label }` objects so future
 * fields can ride alongside without a wire break.
 */
@JsonClass(generateAdapter = true)
data class CreatePollRequest(
    val title: String,
    val description: String? = null,
    @Json(name = "poll_type") val pollType: String = "single_choice",
    val options: List<CreatePollOption>,
    @Json(name = "closes_at") val closesAt: String? = null,
    val visibility: String? = null,
)

@JsonClass(generateAdapter = true)
data class CreatePollOption(
    val label: String,
)

/** Body for `PUT /api/homes/:id/polls/:pollId`. All fields optional. */
@JsonClass(generateAdapter = true)
data class UpdatePollRequest(
    val title: String? = null,
    val description: String? = null,
    val status: String? = null,
    @Json(name = "closes_at") val closesAt: String? = null,
    val visibility: String? = null,
)

/**
 * Body for `POST /api/homes/:id/polls/:pollId/vote`. Always sends an
 * array — the backend normalises scalars but mobile stays uniform.
 */
@JsonClass(generateAdapter = true)
data class CastVoteRequest(
    @Json(name = "selected_options") val selectedOptions: List<String>,
)

/** Envelope for `POST /api/homes/:id/polls/:pollId/vote`. */
@JsonClass(generateAdapter = true)
data class CastVoteResponse(
    val vote: PollVoteDto? = null,
)

@JsonClass(generateAdapter = true)
data class PollVoteDto(
    val id: String? = null,
    @Json(name = "poll_id") val pollId: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "selected_options") val selectedOptions: List<String>? = null,
)

/**
 * Decode a `PollOptionDto` from either a bare string (`"Sat"`) or an
 * object (`{ id, label }`). Register this adapter in `NetworkModule`.
 */
class PollOptionAdapter {
    @FromJson
    fun fromJson(reader: JsonReader): PollOptionDto =
        when (reader.peek()) {
            JsonReader.Token.STRING -> {
                val s = reader.nextString()
                PollOptionDto(id = s, label = s)
            }
            JsonReader.Token.BEGIN_OBJECT -> {
                var idValue: String? = null
                var keyValue: String? = null
                var labelValue: String? = null
                var textValue: String? = null
                reader.beginObject()
                while (reader.hasNext()) {
                    when (reader.nextName()) {
                        "id" -> idValue = reader.nextStringOrNull()
                        "key" -> keyValue = reader.nextStringOrNull()
                        "label" -> labelValue = reader.nextStringOrNull()
                        "text" -> textValue = reader.nextStringOrNull()
                        else -> reader.skipValue()
                    }
                }
                reader.endObject()
                val label = labelValue ?: textValue ?: idValue ?: keyValue ?: ""
                val id = idValue ?: keyValue ?: label
                PollOptionDto(id = id, label = label)
            }
            JsonReader.Token.NULL -> {
                reader.nextNull<Any>()
                PollOptionDto(id = "", label = "")
            }
            else -> {
                reader.skipValue()
                PollOptionDto(id = "", label = "")
            }
        }

    @ToJson
    fun toJson(
        writer: JsonWriter,
        value: PollOptionDto,
    ) {
        writer.beginObject()
        writer.name("id").value(value.id)
        writer.name("label").value(value.label)
        writer.endObject()
    }

    private fun JsonReader.nextStringOrNull(): String? =
        if (peek() == JsonReader.Token.NULL) {
            nextNull<Any>()
            null
        } else {
            nextString()
        }
}

/**
 * Decode `my_vote` which arrives as either a JSON array (the canonical
 * shape) or — when the backend's stored value is a scalar — a single
 * value. Normalise to `List<String>` so the rest of the client sees one
 * shape. Register this adapter in `NetworkModule` only for the
 * `my_vote` slot via a `@field:MyVoteList` annotation, OR write it as a
 * top-level adapter for `List<String>` typed `@MyVoteList`.
 *
 * For simplicity we instead handle this in the [PollDto] field default
 * (the field is nullable and Moshi tolerates the array form). When the
 * server returns the scalar shape the field will decode to null — which
 * is fine because the UI treats null as "no vote". This is documented
 * behaviour for the few legacy rows that may still have scalar
 * `selected_options`.
 */
class MyVoteListAdapter : JsonAdapter<List<String>>() {
    @Suppress("CyclomaticComplexMethod", "NestedBlockDepth")
    override fun fromJson(reader: JsonReader): List<String>? =
        when (reader.peek()) {
            JsonReader.Token.NULL -> {
                reader.nextNull<Any>()
                null
            }
            JsonReader.Token.STRING -> listOf(reader.nextString())
            JsonReader.Token.NUMBER -> listOf(reader.nextLong().toString())
            JsonReader.Token.BEGIN_ARRAY -> {
                val out = mutableListOf<String>()
                reader.beginArray()
                while (reader.hasNext()) {
                    when (reader.peek()) {
                        JsonReader.Token.STRING -> out += reader.nextString()
                        JsonReader.Token.NUMBER -> out += reader.nextLong().toString()
                        JsonReader.Token.BEGIN_OBJECT -> {
                            var idValue: String? = null
                            var labelValue: String? = null
                            reader.beginObject()
                            while (reader.hasNext()) {
                                when (reader.nextName()) {
                                    "id" ->
                                        idValue =
                                            if (reader.peek() == JsonReader.Token.NULL) {
                                                reader.nextNull<Any>()
                                                null
                                            } else {
                                                reader.nextString()
                                            }
                                    "label" ->
                                        labelValue =
                                            if (reader.peek() == JsonReader.Token.NULL) {
                                                reader.nextNull<Any>()
                                                null
                                            } else {
                                                reader.nextString()
                                            }
                                    else -> reader.skipValue()
                                }
                            }
                            reader.endObject()
                            (idValue ?: labelValue)?.let { out += it }
                        }
                        else -> reader.skipValue()
                    }
                }
                reader.endArray()
                out.toList()
            }
            else -> {
                reader.skipValue()
                null
            }
        }

    override fun toJson(
        writer: JsonWriter,
        value: List<String>?,
    ) {
        if (value == null) {
            writer.nullValue()
            return
        }
        writer.beginArray()
        for (v in value) writer.value(v)
        writer.endArray()
    }

    companion object {
        /** Factory for registration in NetworkModule when applied to the
         *  `my_vote` field via a marker annotation. Today the default
         *  Moshi adapter handles the array form; this factory is here for
         *  future tightening (object-form support). */
        @JvmStatic
        fun factory(): JsonAdapter.Factory =
            object : JsonAdapter.Factory {
                override fun create(
                    type: Type,
                    annotations: MutableSet<out Annotation>,
                    moshi: Moshi,
                ): JsonAdapter<*>? = null
            }
    }
}
