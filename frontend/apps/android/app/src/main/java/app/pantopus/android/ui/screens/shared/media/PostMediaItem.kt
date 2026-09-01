@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.shared.media

/** Kind of one media slot on a post. Mirrors backend `media_types` values. */
enum class PostMediaKind {
    Image,
    Video,
    LivePhoto,
    ;

    companion object {
        fun from(raw: String?): PostMediaKind =
            when (raw) {
                "video" -> Video
                "live_photo" -> LivePhoto
                else -> Image
            }
    }
}

/**
 * One renderable media slot built from the backend's parallel arrays
 * (`media_urls` / `media_types` / `media_thumbnails` / `media_live_urls`).
 * Mirrors iOS `PostMediaItem`.
 */
data class PostMediaItem(
    val id: String,
    val kind: PostMediaKind,
    val url: String,
    val thumbnailUrl: String? = null,
    val liveVideoUrl: String? = null,
)

/**
 * Build typed media items from the backend's slot-aligned parallel arrays.
 * Arrays are padded with empty strings server-side so index i of every
 * array describes the same slot; tolerate compacted arrays by consuming the
 * k-th surviving live URL for the k-th live_photo slot. A live photo
 * without a clip URL downgrades to a plain image.
 */
@Suppress("CyclomaticComplexMethod")
fun buildPostMediaItems(
    urls: List<String>,
    types: List<String>? = null,
    thumbnails: List<String>? = null,
    liveUrls: List<String>? = null,
): List<PostMediaItem> {
    val liveList = liveUrls.orEmpty()
    val thumbList = thumbnails.orEmpty()
    val typeList = types.orEmpty()
    val aligned = liveList.size == urls.size || liveList.isEmpty()
    val survivingLive = liveList.filter { it.isNotBlank() }
    var liveCursor = 0

    val items = mutableListOf<PostMediaItem>()
    urls.forEachIndexed { index, rawUrl ->
        if (rawUrl.isBlank()) return@forEachIndexed
        var kind = PostMediaKind.from(typeList.getOrNull(index))
        val thumbnail = thumbList.getOrNull(index)?.takeIf { it.isNotBlank() }
        var live: String? = null
        if (kind == PostMediaKind.LivePhoto) {
            live =
                if (aligned) {
                    liveList.getOrNull(index)?.takeIf { it.isNotBlank() }
                } else {
                    survivingLive.getOrNull(liveCursor).also { liveCursor += 1 }
                }
            if (live == null) kind = PostMediaKind.Image
        }
        items +=
            PostMediaItem(
                id = "$index-$rawUrl",
                kind = kind,
                url = rawUrl,
                thumbnailUrl = thumbnail,
                liveVideoUrl = live,
            )
    }
    return items
}
