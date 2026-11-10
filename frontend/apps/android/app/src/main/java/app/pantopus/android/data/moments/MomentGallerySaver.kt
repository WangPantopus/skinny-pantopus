@file:Suppress("MagicNumber", "TooGenericExceptionCaught")

package app.pantopus.android.data.moments

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import app.pantopus.android.data.api.models.moments.MomentDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.cos
import kotlin.math.sin

/**
 * "Save to Photos" on your own Moment (board V5): the photo or video as posted, or a text card drawn as a picture,
 * added to the phone's gallery in a Pantopus album.
 */
object MomentGallerySaver {
    /** True when it saved. Android 9 and older need the storage permission first (the screen asks). */
    suspend fun save(
        context: Context,
        moment: MomentDto,
    ): Boolean =
        withContext(Dispatchers.IO) {
            runCatching {
                when (moment.kind) {
                    "video" -> {
                        val url = moment.mediaUrl ?: return@runCatching false
                        insert(context, video = true, name = "Moment-${moment.id.take(8)}.mp4", mime = "video/mp4") { out ->
                            download(url, out)
                        }
                    }
                    "photo" -> {
                        val url = moment.mediaUrl ?: return@runCatching false
                        insert(context, video = false, name = "Moment-${moment.id.take(8)}.jpg", mime = "image/jpeg") { out ->
                            download(url, out)
                        }
                    }
                    else -> {
                        val card = renderTextCard(moment.text.orEmpty(), moment.background)
                        insert(context, video = false, name = "Moment-${moment.id.take(8)}.png", mime = "image/png") { out ->
                            card.compress(Bitmap.CompressFormat.PNG, 100, out)
                        }.also { card.recycle() }
                    }
                }
            }.getOrDefault(false)
        }

    private fun insert(
        context: Context,
        video: Boolean,
        name: String,
        mime: String,
        write: (OutputStream) -> Unit,
    ): Boolean {
        val resolver = context.contentResolver
        val collection: Uri =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                if (video) {
                    MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                } else {
                    MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                }
            } else if (video) {
                MediaStore.Video.Media.EXTERNAL_CONTENT_URI
            } else {
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            }
        val values =
            ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                put(MediaStore.MediaColumns.MIME_TYPE, mime)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val folder = if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES
                    put(MediaStore.MediaColumns.RELATIVE_PATH, "$folder/Pantopus")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
            }
        val uri = resolver.insert(collection, values) ?: return false
        return try {
            resolver.openOutputStream(uri)?.use(write) ?: error("no output stream")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
            }
            true
        } catch (failure: Exception) {
            resolver.delete(uri, null, null)
            throw failure
        }
    }

    /** A signed storage link: fetched without the app's session (it carries its own short-lived grant). */
    private fun download(
        url: String,
        out: OutputStream,
    ) {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            if (connection.responseCode !in 200..299) error("download ${connection.responseCode}")
            connection.inputStream.use { it.copyTo(out) }
        } finally {
            connection.disconnect()
        }
    }

    /** A text card as a 1080 × 1920 picture: the card's 160° gradient with its words centered (board V3). */
    fun renderTextCard(
        text: String,
        background: String?,
    ): Bitmap {
        val width = 1080
        val height = 1920
        val (top, bottom) = MomentCardColors.argb(background)
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        // 160° in CSS: from the top a little left of center toward the bottom a little right.
        val radians = Math.toRadians(160.0 - 90.0)
        val dx = (cos(radians) * height / 2).toFloat()
        val dy = (sin(radians) * height / 2).toFloat()
        val paint =
            Paint().apply {
                shader =
                    LinearGradient(
                        width / 2f - dx,
                        height / 2f - dy,
                        width / 2f + dx,
                        height / 2f + dy,
                        top,
                        bottom,
                        Shader.TileMode.CLAMP,
                    )
            }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        val textPaint =
            TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                color = android.graphics.Color.WHITE
                textSize = 80f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            }
        val margin = 100
        val layout =
            StaticLayout.Builder
                .obtain(text, 0, text.length, textPaint, width - margin * 2)
                .setAlignment(Layout.Alignment.ALIGN_CENTER)
                .setLineSpacing(0f, 1.25f)
                .build()
        canvas.save()
        canvas.translate(margin.toFloat(), (height - layout.height) / 2f)
        layout.draw(canvas)
        canvas.restore()
        return bitmap
    }

    private const val TIMEOUT_MS = 30_000
}

/** The six text-card backgrounds as ARGB pairs (top, bottom), for drawing outside Compose. */
object MomentCardColors {
    fun argb(background: String?): Pair<Int, Int> =
        when (background) {
            "sky" -> 0xFF0369A1.toInt() to 0xFF075985.toInt()
            "green" -> 0xFF15803D.toInt() to 0xFF166534.toInt()
            "amber" -> 0xFFB45309.toInt() to 0xFF92400E.toInt()
            "rose" -> 0xFFBE123C.toInt() to 0xFF9F1239.toInt()
            "slate" -> 0xFF334155.toInt() to 0xFF1E293B.toInt()
            else -> 0xFF0F766E.toInt() to 0xFF115E59.toInt()
        }
}
