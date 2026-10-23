package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.FromJson
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.ToJson

/**
 * `PATCH /api/posts/:id` request body. Mirrors `updatePostSchema` at
 * `backend/routes/posts.js:298-328` — a strict subset of the create
 * schema (no `postAs`, `audience`, `businessName`, `purpose`; the
 * identity + audience tag are fixed at create time). Joi's `.min(1)`
 * requires at least one key.
 *
 * An omitted key keeps the saved value; [clearEventEndDate] sends
 * `eventEndDate: null`, which removes an event's end.
 */
data class PostUpdateRequest(
    val content: String? = null,
    val title: String? = null,
    val visibility: String? = null,
    @Json(name = "eventDate") val eventDate: String? = null,
    @Json(name = "eventEndDate") val eventEndDate: String? = null,
    @Json(name = "eventVenue") val eventVenue: String? = null,
    @Json(name = "lostFoundType") val lostFoundType: String? = null,
    @Json(name = "serviceCategory") val serviceCategory: String? = null,
    @Json(name = "dealBusinessName") val dealBusinessName: String? = null,
    val clearEventEndDate: Boolean = false,
)

/** Leave omitted fields out while sending a cleared event end as JSON null. */
class PostUpdateRequestJsonAdapter {
    @ToJson
    fun toJson(
        writer: JsonWriter,
        value: PostUpdateRequest,
    ) {
        val previous = writer.serializeNulls
        writer.serializeNulls = true
        try {
            writer.beginObject()
            value.content?.let { writer.name("content").value(it) }
            value.title?.let { writer.name("title").value(it) }
            value.visibility?.let { writer.name("visibility").value(it) }
            value.eventDate?.let { writer.name("eventDate").value(it) }
            if (value.eventEndDate != null || value.clearEventEndDate) {
                writer.name("eventEndDate").value(value.eventEndDate)
            }
            value.eventVenue?.let { writer.name("eventVenue").value(it) }
            value.lostFoundType?.let { writer.name("lostFoundType").value(it) }
            value.serviceCategory?.let { writer.name("serviceCategory").value(it) }
            value.dealBusinessName?.let { writer.name("dealBusinessName").value(it) }
            writer.endObject()
        } finally {
            writer.serializeNulls = previous
        }
    }

    @Suppress("UnusedParameter")
    @FromJson
    fun fromJson(reader: JsonReader): PostUpdateRequest =
        error("PostUpdateRequest is request-only; deserialization is not supported.")
}

/**
 * `PATCH /api/posts/:id` response envelope — the backend echoes a thin
 * ack plus the updated row. We only surface the id so the caller can
 * navigate back to it.
 */
@JsonClass(generateAdapter = true)
data class PostUpdateResponse(
    val message: String? = null,
    val post: PostUpdateResponsePost? = null,
) {
    /** Nested post payload — we only need the id. */
    val postId: String?
        get() = post?.id
}

/** Just enough of the wire `post` to surface the id for navigation. */
@JsonClass(generateAdapter = true)
data class PostUpdateResponsePost(
    val id: String,
)
