package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** `POST /api/upload/post-media/:postId` response envelope. */
@JsonClass(generateAdapter = true)
data class PostMediaUploadResponse(
    val message: String,
    @Json(name = "media_urls") val mediaUrls: List<String>,
    @Json(name = "media_types") val mediaTypes: List<String>,
    @Json(name = "media_thumbnails") val mediaThumbnails: List<String>,
    @Json(name = "media_live_urls") val mediaLiveUrls: List<String>,
)
