package app.pantopus.android.ui.screens.moments.components

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import coil.imageLoader
import coil.memory.MemoryCache
import coil.request.CachePolicy
import coil.request.ImageRequest

/**
 * A Moment's picture by its signed link. The file is private and its link lasts 15 minutes, so the picture is kept in
 * memory only, never in the image cache on disk, under a key made from the Moment's id: a fresh link to the same
 * picture reuses what's already loaded.
 */
object MomentImages {
    /** The photo itself. */
    fun mediaKey(momentId: String): String = "moment:$momentId"

    /** A video's poster frame. */
    fun posterKey(momentId: String): String = "moment-poster:$momentId"

    /** The small picture beside a chat reply. */
    fun thumbKey(momentId: String): String = "moment-thumb:$momentId"

    fun request(
        context: Context,
        url: String,
        key: String,
    ): ImageRequest =
        ImageRequest
            .Builder(context)
            .data(url)
            .memoryCacheKey(key)
            .diskCachePolicy(CachePolicy.DISABLED)
            .build()

    /** Loads [url] ahead of showing it, so the next Moment opens without a blank frame. */
    fun prefetch(
        context: Context,
        url: String,
        key: String,
    ) {
        context.imageLoader.enqueue(request(context, url, key))
    }

    /** A Moment ended: its pictures leave memory. */
    fun forget(
        context: Context,
        momentId: String,
    ) {
        val cache = context.imageLoader.memoryCache ?: return
        listOf(mediaKey(momentId), posterKey(momentId), thumbKey(momentId)).forEach { cache.remove(MemoryCache.Key(it)) }
    }
}

/** The request for a Moment's picture ([MomentImages]), or null while there is no link. */
@Composable
fun rememberMomentImage(
    url: String?,
    key: String,
): ImageRequest? {
    val context = LocalContext.current
    return remember(url, key) { url?.let { MomentImages.request(context, it, key) } }
}
