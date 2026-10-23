package app.pantopus.android.data.api.models.links

import com.squareup.moshi.JsonClass

/**
 * `GET /api/link-preview` — a page's preview text. There is no image: one
 * the poster's link chose would show its host every viewer's IP address.
 * Route `backend/routes/linkPreview.js`.
 */
@JsonClass(generateAdapter = true)
data class LinkPreviewResponse(
    val title: String? = null,
    val description: String? = null,
    val siteName: String? = null,
    val url: String? = null,
)
