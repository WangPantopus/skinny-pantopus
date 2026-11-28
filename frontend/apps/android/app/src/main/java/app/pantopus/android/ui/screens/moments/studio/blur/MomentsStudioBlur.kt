@file:Suppress("MagicNumber", "TooGenericExceptionCaught")

package app.pantopus.android.ui.screens.moments.studio.blur

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PointF
import android.graphics.RectF
import android.media.FaceDetector
import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.screens.moments.compose.marks.MomentStandIn
import com.google.android.gms.common.api.OptionalModuleApi
import com.google.android.gms.common.moduleinstall.InstallStatusListener
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/*
 * "Pulse, reinvented" phase 2, blur before posting (PHASE-2 piece 3), as the iPhone's `MomentsStudioBlur.swift`: the
 * Studio looks at its photo on the phone itself for faces of people who didn't ask to be in it (Android's own
 * `FaceDetector`), licence plates, house numbers and mail labels (lines read by Google Play services' ML Kit text
 * recognition: no service of ours and no key; its model is Play services' own, fetched the first time a person opens
 * Blur, never at install or app start and never with the switch off), and offers each one with a tap to blur it or
 * leave it. The person can also drag a box by hand over anything it missed. What they choose is drawn into the photo
 * with its other marks (`MomentMarks.blur`), from the photo as it came, so nobody can take it off once posted; the
 * picture check on the server stays as it is.
 */

/** A box on the photo as it came: each side a share of it (0 to 1) from the top left. */
@Immutable
data class MomentBlurBox(
    val left: Float,
    val top: Float,
    val width: Float,
    val height: Float,
) {
    val right: Float get() = left + width
    val bottom: Float get() = top + height
}

/** What a spot is, in the iPhone's words ("A face"), and its plural for the line over the bar ("faces"). */
enum class MomentBlurKind(
    val words: String,
    val many: String,
) {
    Face("A face", "faces"),
    Plate("A licence plate", "licence plates"),
    Number("A house number", "house numbers"),
    Label("A mail label", "mail labels"),
    Hand("Your box", "boxes"),
    ;

    /** "a face". */
    val one: String get() = words.replaceFirstChar { it.lowercase() }
}

/** Something found (or drawn) to blur, and whether the person wants it blurred. */
@Immutable
data class MomentBlurSpot(
    val id: String,
    val kind: MomentBlurKind,
    val box: MomentBlurBox,
    val blur: Boolean,
)

/** Finding what to blur, on the phone, off the main thread. */
internal object MomentBlurFinder {
    /** At most this many spots on one photo (the iPhone's). */
    const val MOST = 12

    /** Faces and lines are looked for on a copy this size at most on its long side. */
    private const val LONGEST = 1280

    /** Waiting for Play services to fetch the text model the first time. */
    private const val FETCH_WAIT_MS = 90_000L
    private const val STAND_IN_WAIT_MS = 5_000L

    /** Faces in [picture]: Android's own detector, nothing fetched. */
    suspend fun faces(picture: Bitmap): List<MomentBlurSpot> =
        withContext(Dispatchers.Default) {
            val small = scaled(picture)
            // The detector wants an even width and 16-bit pixels.
            val width = small.width - small.width % 2
            val height = small.height
            if (width < 2 || height < 2) return@withContext emptyList()
            val copy = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)
            try {
                Canvas(copy).drawBitmap(small, 0f, 0f, null)
                val found = arrayOfNulls<FaceDetector.Face>(MOST)
                val count = FaceDetector(width, height, MOST).findFaces(copy, found)
                val middle = PointF()
                found.take(count).filterNotNull().map { face ->
                    face.getMidPoint(middle)
                    val eyes = face.eyesDistance()
                    // A face around its eyes: about two and a half eye-widths across, three tall, the eyes in its top half.
                    val w = eyes * 2.5f
                    val h = eyes * 3.1f
                    val box = MomentBlurBox((middle.x - w / 2) / width, (middle.y - h * 0.42f) / height, w / width, h / height)
                    spot(MomentBlurKind.Face, padded(box, 0.1f))
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                timber.log.Timber.tag("Moments").w(failure, "couldn't look for faces")
                emptyList()
            } finally {
                copy.recycle()
                if (small !== picture) small.recycle()
            }
        }

    /**
     * Lines in [picture] that read as a licence plate, a house number or a mail label. The text model is Play services':
     * when it isn't on the phone yet it is fetched only when [fetch] is true (the person opened Blur); else null, to be
     * asked again then. A debug build on an emulator that can't fetch it gets a stand-in plate ([MomentStandIn]).
     */
    suspend fun lines(
        context: Context,
        picture: Bitmap,
        fetch: Boolean,
    ): List<MomentBlurSpot>? =
        withContext(Dispatchers.Default) {
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            val small = scaled(picture)
            try {
                when (ready(context.applicationContext, recognizer, fetch)) {
                    null -> return@withContext null
                    false -> return@withContext standIn()
                    true -> Unit
                }
                val read = recognizer.process(InputImage.fromBitmap(small, 0)).await()
                val width = small.width.toFloat()
                val height = small.height.toFloat()
                read.textBlocks.flatMap { it.lines }.mapNotNull { line ->
                    val kind = kind(line.text) ?: return@mapNotNull null
                    val rect = line.boundingBox ?: return@mapNotNull null
                    val box = MomentBlurBox(rect.left / width, rect.top / height, rect.width() / width, rect.height() / height)
                    spot(kind, padded(box, 0.12f))
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                timber.log.Timber.tag("Moments").w(failure, "couldn't read the photo's lines")
                emptyList()
            } finally {
                recognizer.close()
                if (small !== picture) small.recycle()
            }
        }

    /** What a line of text is, if it's something to blur (the iPhone's rules). */
    internal fun kind(words: String): MomentBlurKind? {
        val trimmed = words.trim()
        val compact = trimmed.replace(SPACES, "")
        val digits = compact.count { it.isDigit() }
        val letters = compact.count { it.isLetter() }
        return when {
            // A house number: one to six digits, maybe a letter after.
            HOUSE_NUMBER.matches(compact) -> MomentBlurKind.Number
            // A plate: five to eight letters and digits, both kinds in it, nothing else.
            compact.length in 5..8 && digits > 0 && letters > 0 && compact.all { it.isLetterOrDigit() } -> MomentBlurKind.Plate
            // A mail label: a street line, or a town line with a ZIP code.
            STREET.containsMatchIn(trimmed) || TOWN.containsMatchIn(trimmed) -> MomentBlurKind.Label
            else -> null
        }
    }

    private val SPACES = Regex("[\\s-]")
    private val HOUSE_NUMBER = Regex("^[0-9]{1,6}[A-Za-z]?$")
    private val STREET =
        Regex(
            "\\b[0-9]{1,6}\\s+\\w+.*\\b(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Way|Blvd|Ct|Court|Pl|Place)\\b",
            RegexOption.IGNORE_CASE,
        )
    private val TOWN = Regex("\\b[A-Z]{2}\\s+[0-9]{5}(-[0-9]{4})?\\b")

    /**
     * The text model is on the phone: true; fetched from Play services now when [fetch] (the one time); null when it isn't
     * and [fetch] is false; false when it can't be had here.
     */
    private suspend fun ready(
        context: Context,
        api: OptionalModuleApi,
        fetch: Boolean,
    ): Boolean? {
        val installer = ModuleInstall.getClient(context)
        if (installer.areModulesAvailable(api).await().areModulesAvailable()) return true
        if (!fetch) return null
        val done = CompletableDeferred<Boolean>()
        val listener =
            InstallStatusListener { update ->
                when (update.installState) {
                    ModuleInstallStatusUpdate.InstallState.STATE_COMPLETED -> done.complete(true)
                    ModuleInstallStatusUpdate.InstallState.STATE_FAILED,
                    ModuleInstallStatusUpdate.InstallState.STATE_CANCELED,
                    -> done.complete(false)
                    else -> Unit
                }
            }
        return try {
            val request = ModuleInstallRequest.newBuilder().addApi(api).setListener(listener).build()
            if (installer.installModules(request).await().areModulesAlreadyInstalled()) {
                true
            } else {
                // A debug emulator build doesn't wait long: its stand-in takes over.
                withTimeoutOrNull(if (MomentStandIn.active) STAND_IN_WAIT_MS else FETCH_WAIT_MS) { done.await() } ?: false
            }
        } finally {
            installer.unregisterListener(listener)
        }
    }

    /** Debug builds on an emulator only (as the subject lift's stand-in): a plate low in the middle. Never on a phone. */
    private fun standIn(): List<MomentBlurSpot> =
        if (MomentStandIn.active) listOf(spot(MomentBlurKind.Plate, MomentBlurBox(0.36f, 0.7f, 0.28f, 0.08f))) else emptyList()

    fun spot(
        kind: MomentBlurKind,
        box: MomentBlurBox,
        blur: Boolean = true,
    ): MomentBlurSpot = MomentBlurSpot(UUID.randomUUID().toString(), kind, box, blur)

    /** [box] grown by [share] of its size on each side, kept on the photo. */
    private fun padded(
        box: MomentBlurBox,
        share: Float,
    ): MomentBlurBox {
        val left = max(0f, box.left - box.width * share)
        val top = max(0f, box.top - box.height * share)
        val right = min(1f, box.right + box.width * share)
        val bottom = min(1f, box.bottom + box.height * share)
        return MomentBlurBox(left, top, max(0f, right - left), max(0f, bottom - top))
    }

    private fun scaled(picture: Bitmap): Bitmap {
        val scale = min(1f, LONGEST.toFloat() / max(picture.width, picture.height).coerceAtLeast(1))
        if (scale >= 1f) return picture
        return Bitmap.createScaledBitmap(
            picture,
            (picture.width * scale).roundToInt().coerceAtLeast(1),
            (picture.height * scale).roundToInt().coerceAtLeast(1),
            true,
        )
    }
}

/** Blurring the chosen boxes into a picture, hard enough that nothing under them can be read or brought back. */
internal object MomentBlurPainter {
    /** The blur's softest copy is this small on its long side (the iPhone's radius: a fortieth of the long side). */
    private const val SOFT_LONGEST = 40

    /** [picture] with each of [boxes] blurred (a new bitmap), or [picture] itself when there are none. */
    fun applied(
        picture: Bitmap,
        boxes: List<MomentBlurBox>,
    ): Bitmap {
        if (boxes.isEmpty()) return picture
        val out = picture.copy(Bitmap.Config.ARGB_8888, true) ?: error("Couldn't copy the photo.")
        val soft = softened(picture)
        try {
            val canvas = Canvas(out)
            val width = out.width.toFloat()
            val height = out.height.toFloat()
            val whole = RectF(0f, 0f, width, height)
            val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
            boxes.forEach { box ->
                val rect = RectF(box.left * width, box.top * height, box.right * width, box.bottom * height)
                val corner = min(rect.width(), rect.height()) * 0.2f
                canvas.save()
                canvas.clipPath(Path().apply { addRoundRect(rect, corner, corner, Path.Direction.CW) })
                canvas.drawBitmap(soft, null, whole, paint)
                canvas.restore()
            }
        } finally {
            soft.recycle()
        }
        return out
    }

    /** The whole picture made tiny by halving (each step averages four pixels), drawn back up smoothly by [applied]. */
    private fun softened(picture: Bitmap): Bitmap {
        var small = picture
        while (max(small.width, small.height) > SOFT_LONGEST * 2) {
            val next = Bitmap.createScaledBitmap(small, max(1, small.width / 2), max(1, small.height / 2), true)
            if (small !== picture) small.recycle()
            small = next
        }
        val scale = min(1f, SOFT_LONGEST.toFloat() / max(small.width, small.height))
        val last =
            Bitmap.createScaledBitmap(
                small,
                max(1, (small.width * scale).roundToInt()),
                max(1, (small.height * scale).roundToInt()),
                true,
            )
        if (small !== picture && small !== last) small.recycle()
        return if (last === picture) picture.copy(Bitmap.Config.ARGB_8888, false) else last
    }
}
