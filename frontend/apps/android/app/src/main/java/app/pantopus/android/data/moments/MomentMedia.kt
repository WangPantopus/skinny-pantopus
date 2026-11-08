@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.data.moments

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import androidx.annotation.OptIn
import androidx.exifinterface.media.ExifInterface
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import app.pantopus.android.ui.screens.compose.placepicker.MediaCaptureLocation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** A photo or video for a Moment, kept in the app's own folder until it has posted. */
sealed interface MomentMediaFile {
    val file: File

    data class Photo(
        override val file: File,
    ) : MomentMediaFile

    /** [recordedHere]: the in-app camera made it at about 720p H.264, so it uploads as it is. */
    data class Video(
        override val file: File,
        val durationMs: Long,
        val recordedHere: Boolean,
    ) : MomentMediaFile
}

/** Where and when a library photo or video was taken, read from the file itself (as Pulse photo posts do). */
data class MomentCapture(
    val takenAt: Instant?,
    val latitude: Double?,
    val longitude: Double?,
    /** Android hid the location from the app: it reads once `ACCESS_MEDIA_LOCATION` is allowed. */
    val hidden: Boolean = false,
)

/** A video ready to upload: about 720p H.264, its poster and two more frames for the picture check. */
data class PreparedVideo(
    val video: File,
    val poster: File,
    val frames: List<File>,
)

/**
 * Prepares what a Moment uploads, on the phone: photos re-encoded as JPEG (2048 px at most on the long side, which
 * also drops the camera's location and other details), videos exported to about 720p H.264 with AAC sound, and a
 * video's poster frame plus two more frames.
 */
object MomentMedia {
    /** Videos run up to 30 seconds (the server answers `MEDIA_TOO_LONG` past that). */
    const val MAX_VIDEO_MS = 30_000L

    /** A library item counts when it was taken in the last 24 hours. */
    const val LIBRARY_WINDOW_MS = 24 * 60 * 60 * 1000L

    private const val PHOTO_LONG_EDGE = 2048
    private const val PHOTO_QUALITY = 85
    private const val FRAME_LONG_EDGE = 720
    private const val FRAME_QUALITY = 80
    private const val VIDEO_SHORT_SIDE = 720
    private const val VIDEO_BITRATE = 4_000_000

    /** The folder the camera and the library write into; cleared of anything older than a day on each new Moment. */
    fun folder(context: Context): File =
        File(context.filesDir, "moments").apply {
            mkdirs()
            listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > LIBRARY_WINDOW_MS }?.forEach { it.delete() }
        }

    fun newFile(
        context: Context,
        extension: String,
    ): File = File(folder(context), "${UUID.randomUUID()}.$extension")

    /** Copies a picked item into the app's folder (a picker's grant can lapse before the upload ends). */
    suspend fun copyIn(
        context: Context,
        uri: Uri,
        extension: String,
    ): File? =
        withContext(Dispatchers.IO) {
            runCatching {
                val out = newFile(context, extension)
                context.contentResolver.openInputStream(uri)?.use { input -> FileOutputStream(out).use { input.copyTo(it) } }
                    ?: return@runCatching null
                out
            }.getOrNull()
        }

    fun isVideo(
        context: Context,
        uri: Uri,
    ): Boolean = context.contentResolver.getType(uri)?.startsWith("video/") == true

    fun videoDurationMs(file: File): Long =
        runCatching {
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(file.path)
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            } finally {
                retriever.release()
            }
        }.getOrDefault(0L)

    /**
     * When and where a picked item was taken: [located] is the place read from the picked file the way the Pulse
     * composer reads it (`readPickedPlace`), and the time is the file's own (EXIF for photos, the creation date for
     * videos), else the picker's "date taken". A location Android hides from the app reads as none, with [hidden].
     */
    suspend fun capture(
        context: Context,
        uri: Uri,
        copy: File,
        video: Boolean,
        located: MediaCaptureLocation?,
        hidden: Boolean,
    ): MomentCapture =
        withContext(Dispatchers.IO) {
            val time = located?.capturedAt ?: if (video) videoTime(copy) else photoTime(copy)
            MomentCapture(
                takenAt = time ?: pickerDateTaken(context, uri),
                latitude = located?.latitude,
                longitude = located?.longitude,
                hidden = hidden,
            )
        }

    /** A photo as it uploads: upright, at most 2048 px on its long side, JPEG, with no EXIF block. */
    suspend fun preparePhoto(
        context: Context,
        source: File,
    ): File =
        withContext(Dispatchers.IO) {
            val bitmap = decodeUpright(source, PHOTO_LONG_EDGE) ?: error("Couldn't read that photo.")
            val out = newFile(context, "jpg")
            FileOutputStream(out).use { bitmap.compress(Bitmap.CompressFormat.JPEG, PHOTO_QUALITY, it) }
            bitmap.recycle()
            out
        }

    /**
     * A video as it uploads, with [onProgress] from 0 to 1 while it exports: about 720p (720 px on its short side, never
     * scaled up) H.264 with AAC sound, unless the in-app camera already recorded it that way. Then its poster frame
     * (near the start) and two more frames (a third and two thirds in).
     */
    @OptIn(UnstableApi::class)
    suspend fun prepareVideo(
        context: Context,
        source: MomentMediaFile.Video,
        onProgress: (Float) -> Unit,
    ): PreparedVideo {
        val video = if (source.recordedHere) source.file else export(context, source.file, onProgress)
        onProgress(1f)
        val duration = videoDurationMs(video).takeIf { it > 0 } ?: source.durationMs
        val frames =
            withContext(Dispatchers.IO) {
                val retriever = MediaMetadataRetriever()
                try {
                    retriever.setDataSource(video.path)
                    val times = listOf(min(500L, duration / 4), duration / 3, duration * 2 / 3)
                    times.mapNotNull { ms ->
                        retriever.getFrameAtTime(ms * 1000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)?.let { frame ->
                            val scaled = scaleDown(frame, FRAME_LONG_EDGE)
                            val out = newFile(context, "jpg")
                            FileOutputStream(out).use { scaled.compress(Bitmap.CompressFormat.JPEG, FRAME_QUALITY, it) }
                            if (scaled !== frame) scaled.recycle()
                            frame.recycle()
                            out
                        }
                    }
                } finally {
                    retriever.release()
                }
            }
        val poster = frames.firstOrNull() ?: error("Couldn't read that video.")
        return PreparedVideo(video = video, poster = poster, frames = frames.drop(1))
    }

    @OptIn(UnstableApi::class)
    private suspend fun export(
        context: Context,
        source: File,
        onProgress: (Float) -> Unit,
    ): File {
        val (width, height) = displaySize(source)
        val shortSide = min(width, height)
        val out = newFile(context, "mp4")
        val presentation =
            if (shortSide > VIDEO_SHORT_SIDE && width > 0 && height > 0) {
                // Presentation sizes by height: a portrait video keeps 720 px across.
                val targetHeight = if (height > width) (VIDEO_SHORT_SIDE.toFloat() * height / width).roundToEven() else VIDEO_SHORT_SIDE
                listOf(Presentation.createForHeight(targetHeight))
            } else {
                emptyList()
            }
        return withContext(Dispatchers.Main) {
            suspendCancellableCoroutine { continuation ->
                val transformer =
                    Transformer
                        .Builder(context)
                        .setVideoMimeType(MimeTypes.VIDEO_H264)
                        .setAudioMimeType(MimeTypes.AUDIO_AAC)
                        .setEncoderFactory(
                            DefaultEncoderFactory
                                .Builder(context)
                                .setRequestedVideoEncoderSettings(VideoEncoderSettings.Builder().setBitrate(VIDEO_BITRATE).build())
                                .build(),
                        ).addListener(
                            object : Transformer.Listener {
                                override fun onCompleted(
                                    composition: Composition,
                                    exportResult: ExportResult,
                                ) {
                                    if (continuation.isActive) continuation.resume(out)
                                }

                                override fun onError(
                                    composition: Composition,
                                    exportResult: ExportResult,
                                    exportException: ExportException,
                                ) {
                                    out.delete()
                                    if (continuation.isActive) continuation.resumeWithException(exportException)
                                }
                            },
                        ).build()
                val item =
                    EditedMediaItem
                        .Builder(MediaItem.fromUri(Uri.fromFile(source)))
                        .setEffects(Effects(emptyList(), presentation))
                        .build()
                transformer.start(item, out.path)
                val holder = ProgressHolder()
                val poll =
                    kotlinx.coroutines.CoroutineScope(Dispatchers.Main).launch {
                        while (continuation.isActive) {
                            if (transformer.getProgress(holder) == Transformer.PROGRESS_STATE_AVAILABLE) onProgress(holder.progress / 100f)
                            delay(PROGRESS_POLL_MS)
                        }
                    }
                continuation.invokeOnCancellation {
                    poll.cancel()
                    transformer.cancel()
                    out.delete()
                }
            }
        }
    }

    private const val PROGRESS_POLL_MS = 250L

    private fun Float.roundToEven(): Int = (this / 2f).roundToInt() * 2

    /** A video's width and height as it plays (its rotation applied). */
    private fun displaySize(file: File): Pair<Int, Int> =
        runCatching {
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(file.path)
                val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
                val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
                val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
                if (rotation == 90 || rotation == 270) height to width else width to height
            } finally {
                retriever.release()
            }
        }.getOrDefault(0 to 0)

    /** Decodes [file] turned upright, about [longEdge] px on its long side at most. */
    fun decodeUpright(
        file: File,
        longEdge: Int,
    ): Bitmap? =
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                // ImageDecoder applies the EXIF orientation itself and reads HEIC.
                ImageDecoder.decodeBitmap(ImageDecoder.createSource(file)) { decoder, info, _ ->
                    decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                    val size = info.size
                    val scale = min(1f, longEdge.toFloat() / max(size.width, size.height))
                    if (scale < 1f) decoder.setTargetSize((size.width * scale).roundToInt(), (size.height * scale).roundToInt())
                }
            } else {
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(file.path, bounds)
                var sample = 1
                while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= longEdge) sample *= 2
                val decoded = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
                val scaled = scaleDown(decoded, longEdge)
                val degrees =
                    when (ExifInterface(file.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                        else -> 0f
                    }
                if (degrees == 0f) {
                    scaled
                } else {
                    Bitmap.createBitmap(scaled, 0, 0, scaled.width, scaled.height, Matrix().apply { postRotate(degrees) }, true)
                }
            }
        }.getOrNull()

    private fun scaleDown(
        bitmap: Bitmap,
        longEdge: Int,
    ): Bitmap {
        val scale = longEdge.toFloat() / max(bitmap.width, bitmap.height)
        if (scale >= 1f) return bitmap
        return Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).roundToInt(), (bitmap.height * scale).roundToInt(), true)
    }

    /** The camera's capture time, in its recorded offset when there is one, else the phone's zone. */
    private fun photoTime(file: File): Instant? =
        runCatching {
            val exif = ExifInterface(file.path)
            val raw = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL) ?: exif.getAttribute(ExifInterface.TAG_DATETIME)
            val local = LocalDateTime.parse(raw, EXIF_TIME)
            val offset = exif.getAttribute(ExifInterface.TAG_OFFSET_TIME_ORIGINAL)?.let { runCatching { ZoneOffset.of(it) }.getOrNull() }
            if (offset != null) local.toInstant(offset) else local.atZone(ZoneId.systemDefault()).toInstant()
        }.getOrNull()

    /** A video's creation date ("20261102T180431.000Z"). */
    private fun videoTime(file: File): Instant? =
        runCatching {
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(file.path)
                val raw = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE)?.trim() ?: return@runCatching null
                VIDEO_TIMES
                    .firstNotNullOfOrNull { format ->
                        runCatching { LocalDateTime.parse(raw, format).toInstant(ZoneOffset.UTC) }.getOrNull()
                    }
                    // "19040101T000000.000Z" is what a writer leaves when it has no date.
                    ?.takeIf { it.isAfter(Instant.parse("2000-01-01T00:00:00Z")) }
            } finally {
                retriever.release()
            }
        }.getOrNull()

    /** The photo picker's "date taken" for its item (milliseconds since 1970). */
    private fun pickerDateTaken(
        context: Context,
        uri: Uri,
    ): Instant? {
        if (uri.scheme != ContentResolver.SCHEME_CONTENT) return null
        return runCatching {
            context.contentResolver.query(uri, arrayOf(DATE_TAKEN_COLUMN), null, null, null)?.use { cursor ->
                if (!cursor.moveToFirst()) return@use null
                val millis = cursor.getLong(0)
                if (millis > 0) Instant.ofEpochMilli(millis) else null
            }
        }.getOrNull()
    }

    /** `MediaStore.MediaColumns.DATE_TAKEN` ("datetaken"), which the photo picker also answers. */
    private const val DATE_TAKEN_COLUMN = "datetaken"

    private val EXIF_TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy:MM:dd HH:mm:ss")
    private val VIDEO_TIMES: List<DateTimeFormatter> =
        listOf(
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSS'Z'"),
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"),
        )
}
