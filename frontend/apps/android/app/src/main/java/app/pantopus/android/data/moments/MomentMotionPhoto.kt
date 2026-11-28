package app.pantopus.android.data.moments

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import kotlin.math.max

/** A motion photo's clip, taken out of its photo: the MP4, how long it runs, and one or two frames for the picture check. */
data class MomentMotionClip(
    val file: File,
    val durationMs: Long,
    val frames: List<File>,
) {
    /** The clip and its frames leave the phone. */
    fun delete() {
        runCatching { file.delete() }
        frames.forEach { runCatching { it.delete() } }
    }
}

/**
 * "Pulse, reinvented" (PHASE-5 C, CONTRACT 10b): Android's motion photo, a JPEG whose clip is an MP4 stored after the
 * picture. Its XMP says so: Google's Motion Photo format (`GCamera:MotionPhoto="1"` with a `Container:Directory` whose
 * `MotionPhoto` item gives the clip's length) or the older micro video (`GCamera:MicroVideo="1"`, with
 * `GCamera:MicroVideoOffset`, the clip's length from the end of the file). Read on the phone; nothing is sent anywhere.
 */
object MomentMotionPhoto {
    /** CONTRACT 10b's limits: at most 4 s and 15 MB (a little over 4 s is read as the camera's rounding). */
    private const val LONGEST_MS = 4_000L
    private const val ROUNDING_MS = 150L
    private const val LARGEST_BYTES = 15L * 1024 * 1024

    /** The XMP block is near the start of the file. */
    private const val HEAD_BYTES = 256 * 1024

    private const val FRAME_LONG_EDGE = 720
    private const val FRAME_QUALITY = 80
    private const val US_PER_MS = 1_000L

    private val MOTION_ITEM = Regex("""<Container:Item[^>]*Item:Semantic="MotionPhoto"[^>]*>""")
    private val ITEM_LENGTH = Regex("""Item:Length="(\d+)"""")
    private val MICRO_OFFSET = Regex("""GCamera:MicroVideoOffset="(\d+)"""")

    /**
     * The clip in [photo], copied out with its frames, or null: not a motion photo, a clip past the limits, or one that
     * can't be read.
     */
    fun clipOf(
        context: Context,
        photo: File,
    ): MomentMotionClip? =
        runCatching {
            val length = clipLength(photo) ?: return null
            val size = photo.length()
            if (length <= 0 || length >= size || length > LARGEST_BYTES) return null
            val clip = MomentMedia.newFile(context, "mp4")
            RandomAccessFile(photo, "r").use { input ->
                input.seek(size - length)
                FileOutputStream(clip).use { out ->
                    val buffer = ByteArray(DEFAULT_BUFFER)
                    var left = length
                    while (left > 0) {
                        val read = input.read(buffer, 0, minOf(buffer.size.toLong(), left).toInt())
                        if (read <= 0) break
                        out.write(buffer, 0, read)
                        left -= read
                    }
                }
            }
            readClip(context, clip) ?: run {
                clip.delete()
                null
            }
        }.getOrNull()

    /** The clip's length in bytes, from the photo's XMP; null when it isn't a motion photo. */
    private fun clipLength(photo: File): Long? {
        val head = ByteArray(minOf(HEAD_BYTES.toLong(), photo.length()).toInt())
        RandomAccessFile(photo, "r").use { it.readFully(head) }
        if (head.size < 2 || head[0] != JPEG_0 || head[1] != JPEG_1) return null
        val text = String(head, Charsets.ISO_8859_1)
        return when {
            text.contains("""GCamera:MotionPhoto="1"""") ->
                MOTION_ITEM.find(text)?.value?.let { ITEM_LENGTH.find(it)?.groupValues?.get(1)?.toLongOrNull() }
            text.contains("""GCamera:MicroVideo="1"""") -> MICRO_OFFSET.find(text)?.groupValues?.get(1)?.toLongOrNull()
            else -> null
        }
    }

    /** The clip read back: a video within the limits, and its frames (its start and its middle). */
    private fun readClip(
        context: Context,
        clip: File,
    ): MomentMotionClip? {
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(clip.path)
            val video = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO) == "yes"
            val duration =
                retriever
                    .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    ?.toLongOrNull()
                    ?.takeIf { video && it > 0 && it <= LONGEST_MS + ROUNDING_MS }
                    ?: return null
            val frames =
                listOf(0L, duration / 2).mapNotNull { at ->
                    retriever.getFrameAtTime(at * US_PER_MS, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)?.let { frame ->
                        frameFile(context, frame)
                    }
                }
            return frames.takeIf { it.isNotEmpty() }?.let { MomentMotionClip(clip, duration, it) }
        } finally {
            retriever.release()
        }
    }

    private fun frameFile(
        context: Context,
        frame: Bitmap,
    ): File {
        val long = max(frame.width, frame.height)
        val scaled =
            if (long <= FRAME_LONG_EDGE) {
                frame
            } else {
                val k = FRAME_LONG_EDGE.toFloat() / long
                Bitmap.createScaledBitmap(frame, (frame.width * k).toInt(), (frame.height * k).toInt(), true)
            }
        val out = MomentMedia.newFile(context, "jpg")
        FileOutputStream(out).use { scaled.compress(Bitmap.CompressFormat.JPEG, FRAME_QUALITY, it) }
        if (scaled !== frame) scaled.recycle()
        frame.recycle()
        return out
    }

    private const val DEFAULT_BUFFER = 64 * 1024
    private const val JPEG_0 = 0xFF.toByte()
    private const val JPEG_1 = 0xD8.toByte()
}
