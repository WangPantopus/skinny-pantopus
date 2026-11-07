@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "NestedBlockDepth", "ComplexCondition")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.BlendMode
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.res.ResourcesCompat
import app.pantopus.android.R
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardArt
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardTimes
import app.pantopus.android.ui.theme.PantopusColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.Bidi
import java.text.BreakIterator
import kotlin.math.max
import kotlin.math.min

/** Everything printed or written on a card. [number] is the picture's own, which seeds how the pen falls. */
internal data class CardFaceWords(
    val number: Int,
    val caption: String,
    val paper: Int,
    val year: Int,
    /** "NOV 6": the postmark's day; empty for a card that hasn't been mailed. */
    val postmarkDay: String,
    val note: String,
    /** Who it's from, the first name only. */
    val from: String,
)

/** The picture on a card, and how much of its edges to leave out (an older copy has its own border baked in). */
internal class CardPicture(
    val bitmap: Bitmap,
    val inset: Float = 0f,
)

/**
 * What every face needs: the pen, the caption's hand and the paper's grain. Read once, away from the main thread. The
 * grain is multiplied into the face; [paperHalf] and [paperShare] are that grain already eased toward white (the front
 * at 50%, a shared picture at 70%), because a plain multiply takes no opacity on every Android this app runs on.
 */
internal class CardFaceArt private constructor(
    val pen: Typeface,
    val hand: Typeface,
    val paper: Bitmap,
    val paperHalf: Bitmap,
    val paperShare: Bitmap,
) {
    companion object {
        @Volatile
        private var loaded: CardFaceArt? = null

        fun load(context: Context): CardFaceArt =
            loaded ?: synchronized(this) {
                loaded ?: read(context.applicationContext).also { loaded = it }
            }

        private fun read(context: Context): CardFaceArt {
            val paper = BitmapFactory.decodeResource(context.resources, R.drawable.card_table_paper)
            return CardFaceArt(
                pen = ResourcesCompat.getFont(context, R.font.la_belle_aurore) ?: Typeface.SERIF,
                hand = ResourcesCompat.getFont(context, R.font.nothing_you_could_do) ?: Typeface.SERIF,
                paper = paper,
                paperHalf = eased(paper, 0.5f),
                paperShare = eased(paper, 0.7f),
            )
        }

        /** The grain at [strength], as a plain tile. */
        private fun eased(
            paper: Bitmap,
            strength: Float,
        ): Bitmap {
            val out = Bitmap.createBitmap(paper.width, paper.height, Bitmap.Config.ARGB_8888)
            Canvas(out).apply {
                drawColor(android.graphics.Color.WHITE)
                drawBitmap(paper, 0f, 0f, Paint(Paint.FILTER_BITMAP_FLAG).apply { alpha = (strength * 255f).toInt() })
            }
            return out
        }
    }
}

/** The face art once it's read; null until then, and the card shows its plain paper. */
@Composable
internal fun rememberCardFaceArt(): CardFaceArt? {
    val context = LocalContext.current
    val art by produceState(initialValue = null as CardFaceArt?, context) {
        value = withContext(Dispatchers.IO) { CardFaceArt.load(context) }
    }
    return art
}

/**
 * Draws the two faces of a card on any canvas: the table, the writing step, Look it over, and the pictures people share,
 * so all of them are the same card. Sizes are shares of the card's width (`u`, 1% of it), as the sample has them. [dp]
 * is one density-independent pixel on this canvas, for the few hairlines that don't scale with the card. Not for use
 * from two threads at once: a shared picture has its own painter.
 */
internal class CardFacePainter(
    private val art: CardFaceArt,
    private val dp: Float,
) {
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG)
    private val picturePaint =
        Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
            colorFilter = ColorMatrixColorFilter(pictureColors())
        }
    private val clip = Path()
    private val wave = Path()
    private val box = RectF()
    private val source = Rect()
    private var edgeReach = -1f
    private var edgeWidth = -1f
    private var edgeHeight = -1f
    private var edgeShaders: List<LinearGradient> = emptyList()
    private var noteCache: PenNote? = null

    /** The picture side: the picture, its caption by hand, CHRISTMAS, 2026 and the postmark. */
    fun drawFront(
        canvas: Canvas,
        width: Float,
        face: CardFaceWords,
        picture: CardPicture?,
        grain: Bitmap = art.paperHalf,
    ) {
        val u = width / 100f
        val restore = canvas.save()
        clipCard(canvas, width, u)
        canvas.drawColor(face.paper)
        drawPicture(canvas, u, picture)
        drawPrinting(canvas, u, face)
        drawGrain(canvas, width, u, grain)
        drawEdges(canvas, width, u)
        canvas.restoreToCount(restore)
    }

    /** The back: its rules, the note in the pen, who it's from, and the small print at the foot. */
    fun drawBack(
        canvas: Canvas,
        width: Float,
        face: CardFaceWords,
        grain: Bitmap = art.paper,
    ) {
        val u = width / 100f
        val restore = canvas.save()
        clipCard(canvas, width, u)
        canvas.drawColor(face.paper)
        drawRules(canvas, u)
        drawNote(canvas, u, face)
        drawFrom(canvas, u, face.from)
        drawFoot(canvas, u, face.year)
        drawGrain(canvas, width, u, grain)
        drawEdges(canvas, width, u)
        canvas.restoreToCount(restore)
    }

    private fun clipCard(
        canvas: Canvas,
        width: Float,
        u: Float,
    ) {
        clip.reset()
        box.set(0f, 0f, width, u * 120f)
        clip.addRoundRect(box, u * 0.7f, u * 0.7f, Path.Direction.CW)
        canvas.clipPath(clip)
    }

    private fun drawPicture(
        canvas: Canvas,
        u: Float,
        picture: CardPicture?,
    ) {
        box.set(u * 1.7f, u * 1.7f, u * 98.3f, u * 104.7f)
        if (picture != null) {
            coverSource(picture, box.width() / box.height())
            canvas.drawBitmap(picture.bitmap, source, box, picturePaint)
        }
        line.color = PantopusColors.tablePictureLine.toArgb()
        line.strokeWidth = dp * 0.5f
        canvas.drawRect(box.left - dp * 0.25f, box.top - dp * 0.25f, box.right + dp * 0.25f, box.bottom + dp * 0.25f, line)
    }

    /** The middle of [picture] at the shape it's drawn: the picture is never stretched. */
    private fun coverSource(
        picture: CardPicture,
        shape: Float,
    ) {
        val width = picture.bitmap.width
        val height = picture.bitmap.height
        val insetX = width * picture.inset
        val insetY = height * picture.inset
        val usableWidth = width - insetX * 2
        val usableHeight = height - insetY * 2
        val cropWidth = min(usableWidth, usableHeight * shape)
        val cropHeight = cropWidth / shape
        val left = (width - cropWidth) / 2f
        val top = (height - cropHeight) / 2f
        source.set(left.toInt(), top.toInt(), (left + cropWidth).toInt(), (top + cropHeight).toInt())
    }

    private fun drawPrinting(
        canvas: Canvas,
        u: Float,
        face: CardFaceWords,
    ) {
        val captionSize = min(4.8f, 70f / max(1f, face.caption.length * 0.53f)) * u
        textStyle(art.hand, captionSize, PantopusColors.cardCaptionInk)
        canvas.drawText(face.caption, u * 4.2f, boxBaseline(u * 107.4f, captionSize), text)
        val yearSize = u * 2.2f
        textStyle(Typeface.SERIF, yearSize, PantopusColors.cardYearInk, spacing = 0.42f)
        canvas.drawText("CHRISTMAS, ${face.year}", u * 4.2f - yearSize * 0.21f, boxBaseline(u * 114.2f, yearSize), text)
        drawPostmark(canvas, u, face.postmarkDay, face.year)
    }

    /** The red postmark, the sample's 100 × 60 drawing, with the day it was mailed. */
    private fun drawPostmark(
        canvas: Canvas,
        u: Float,
        day: String,
        year: Int,
    ) {
        val restore = canvas.save()
        canvas.rotate(-3f, u * 87.5f, u * 112.2f)
        canvas.translate(u * 77.5f, u * 106.2f)
        val unit = u * 0.2f
        canvas.scale(unit, unit)
        line.color = PantopusColors.tablePostmarkInk.toArgb()
        line.strokeWidth = 1.6f
        canvas.drawCircle(36f, 30f, 22f, line)
        line.strokeWidth = 0.8f
        canvas.drawCircle(36f, 30f, 18.5f, line)
        line.strokeWidth = 1.6f
        wave.reset()
        listOf(21f, 30f, 39f).forEach { y ->
            wave.moveTo(58f, y)
            wave.quadTo(64f, y - 8f, 70f, y)
            wave.quadTo(76f, y + 8f, 82f, y)
            wave.quadTo(88f, y - 8f, 94f, y)
        }
        canvas.drawPath(wave, line)
        val bold = Typeface.create(Typeface.SERIF, Typeface.BOLD)
        text.reset()
        text.isAntiAlias = true
        text.typeface = bold
        text.textAlign = Paint.Align.CENTER
        text.color = PantopusColors.cardPostmark.toArgb()
        if (day.isNotEmpty()) {
            text.textSize = 7.6f
            canvas.drawText(day, 36f, 28f, text)
            text.textSize = 8.5f
            canvas.drawText(year.toString(), 36f, 40f, text)
        } else {
            text.textSize = 10f
            canvas.drawText("DEC", 36f, 33f, text)
            text.textSize = 8.5f
            canvas.drawText(year.toString(), 36f, 45f, text)
        }
        canvas.restoreToCount(restore)
    }

    private fun drawRules(
        canvas: Canvas,
        u: Float,
    ) {
        fill.reset()
        fill.color = PantopusColors.tableRule.toArgb()
        for (rule in 1..RULES) {
            val bottom = u * 9f + u * PITCH * rule
            canvas.drawRect(u * 8f, bottom - dp, u * 92f, bottom, fill)
        }
    }

    private fun drawNote(
        canvas: Canvas,
        u: Float,
        face: CardFaceWords,
    ) {
        if (face.note.isBlank()) return
        val note = penNote(face, u)
        textStyle(art.pen, note.size, PantopusColors.tablePen)
        multiplyInk()
        val metrics = text.fontMetrics
        val baseline = (note.pitch - (metrics.descent - metrics.ascent)) / 2f - metrics.ascent
        val left = u * 8f
        val top = u * 9f
        note.words.forEach { word ->
            val lineTop = top + note.pitch * word.line
            val restore = canvas.save()
            canvas.translate(0f, word.shift * note.size)
            canvas.rotate(word.turn, left + word.x + word.width / 2f, lineTop + note.pitch / 2f)
            text.alpha = (word.opacity * 255f).toInt()
            canvas.drawText(word.text, left + word.x, lineTop + baseline, text)
            canvas.restoreToCount(restore)
        }
    }

    private fun penNote(
        face: CardFaceWords,
        u: Float,
    ): PenNote {
        val kept = noteCache
        if (kept != null && kept.note == face.note && kept.number == face.number && kept.u == u) return kept
        text.reset()
        text.textAlign = Paint.Align.LEFT
        text.typeface = art.pen
        return PenNote.lay(face.note, face.number, u, text).also { noteCache = it }
    }

    private fun drawFrom(
        canvas: Canvas,
        u: Float,
        from: String,
    ) {
        if (from.isBlank()) return
        val labelSize = u * 2.3f
        textStyle(Typeface.SERIF, labelSize, PantopusColors.tableFromInk, spacing = 0.24f)
        val labelWidth = text.measureText("FROM")
        val labelTop = lineBoxAscent(labelSize)
        // A very long first name gets smaller rather than running off the card.
        textStyle(art.pen, u * 6.4f, PantopusColors.tablePen)
        val room = u * 84f - labelWidth - u * 2f
        val nameSize = u * 6.4f * min(1f, room / max(1f, text.measureText(from)))
        val baseline = u * 97f + max(labelTop, lineBoxAscent(u * 6.4f))
        textStyle(Typeface.SERIF, labelSize, PantopusColors.tableFromInk, spacing = 0.24f)
        canvas.drawText("FROM", u * 8f - labelSize * 0.12f, baseline, text)
        textStyle(art.pen, nameSize, PantopusColors.tablePen)
        multiplyInk()
        canvas.drawText(from, u * 8f + labelWidth + u * 2f, baseline, text)
    }

    private fun drawFoot(
        canvas: Canvas,
        u: Float,
        year: Int,
    ) {
        val size = u * 1.9f
        textStyle(Typeface.SERIF, size, PantopusColors.tableFootInk, spacing = 0.3f)
        text.textAlign = Paint.Align.CENTER
        canvas.drawText("PANTOPUS POST · CHRISTMAS $year", u * 50f, boxBaseline(u * 114.9f, size), text)
    }

    /** The paper's grain multiplied over the whole face; its tile is 60% of the card wide. */
    private fun drawGrain(
        canvas: Canvas,
        width: Float,
        u: Float,
        tile: Bitmap,
    ) {
        val shader = BitmapShader(tile, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
        shader.setLocalMatrix(Matrix().apply { setScale(u * 60f / tile.width, u * 60f / tile.height) })
        fill.reset()
        fill.shader = shader
        fill.xfermode = PorterDuffXfermode(PorterDuff.Mode.MULTIPLY)
        canvas.drawRect(0f, 0f, width, u * 120f, fill)
        fill.reset()
    }

    /** The soft darker edge all around: a blurred inset shadow's fall-off, half the shade at the edge. */
    private fun drawEdges(
        canvas: Canvas,
        width: Float,
        u: Float,
    ) {
        val reach = u * 2.6f
        val height = u * 120f
        if (reach != edgeReach || width != edgeWidth || height != edgeHeight) {
            edgeReach = reach
            edgeWidth = width
            edgeHeight = height
            edgeShaders =
                listOf(
                    edgeShader(0f, 0f, reach, 0f),
                    edgeShader(width, 0f, width - reach, 0f),
                    edgeShader(0f, 0f, 0f, reach),
                    edgeShader(0f, height, 0f, height - reach),
                )
        }
        fill.reset()
        edgeShaders.forEach { shader ->
            fill.shader = shader
            canvas.drawRect(0f, 0f, width, height, fill)
        }
        fill.reset()
    }

    private fun edgeShader(
        x0: Float,
        y0: Float,
        x1: Float,
        y1: Float,
    ): LinearGradient {
        val shade = PantopusColors.tableEdgeShade
        val colors =
            intArrayOf(
                shade.copy(alpha = shade.alpha * 0.5f).toArgb(),
                shade.copy(alpha = shade.alpha * 0.16f).toArgb(),
                shade.copy(alpha = 0f).toArgb(),
            )
        return LinearGradient(x0, y0, x1, y1, colors, floatArrayOf(0f, 0.5f, 1f), Shader.TileMode.CLAMP)
    }

    private fun textStyle(
        typeface: Typeface,
        size: Float,
        color: Color,
        spacing: Float = 0f,
    ) {
        text.reset()
        text.textAlign = Paint.Align.LEFT
        text.isAntiAlias = true
        text.isSubpixelText = true
        text.typeface = typeface
        text.textSize = size
        text.color = color.toArgb()
        text.letterSpacing = spacing
    }

    /** Ink sinks into the paper where this Android can multiply text; elsewhere it sits on it, nearly the same. */
    private fun multiplyInk() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) text.blendMode = BlendMode.MULTIPLY
    }

    /** The baseline of one line of text at [size] whose line box, as tall as the size, starts at [top]. */
    private fun boxBaseline(
        top: Float,
        size: Float,
    ): Float = top + lineBoxAscent(size)

    /** From the top of a line box as tall as [size] to its baseline, with the current typeface's own metrics. */
    private fun lineBoxAscent(size: Float): Float {
        val before = text.textSize
        text.textSize = size
        val metrics = text.fontMetrics
        text.textSize = before
        return (size - (metrics.descent - metrics.ascent)) / 2f - metrics.ascent
    }

    private companion object {
        const val RULES = 11
        const val PITCH = 7.6f

        /** The picture's small lift: contrast 1.03, then saturation 1.04. */
        fun pictureColors(): ColorMatrix {
            val contrast = 1.03f
            val offset = (0.5f - 0.5f * contrast) * 255f
            val first =
                ColorMatrix(
                    floatArrayOf(
                        contrast, 0f, 0f, 0f, offset,
                        0f, contrast, 0f, 0f, offset,
                        0f, 0f, contrast, 0f, offset,
                        0f, 0f, 0f, 1f, 0f,
                    ),
                )
            val s = 1.04f
            val second =
                ColorMatrix(
                    floatArrayOf(
                        0.2126f + 0.7874f * s, 0.7152f - 0.7152f * s, 0.0722f - 0.0722f * s, 0f, 0f,
                        0.2126f - 0.2126f * s, 0.7152f + 0.2848f * s, 0.0722f - 0.0722f * s, 0f, 0f,
                        0.2126f - 0.2126f * s, 0.7152f - 0.7152f * s, 0.0722f + 0.9278f * s, 0f, 0f,
                        0f, 0f, 0f, 1f, 0f,
                    ),
                )
            return ColorMatrix().apply { setConcat(second, first) }
        }
    }
}

/** The card's own small random: the same card always falls the same way, on every app. */
internal class CardSeed(
    seed: Int,
) {
    private var state = seed.toLong() and MASK

    fun next(): Float {
        state = (state * 1664525L + 1013904223L) and MASK
        return (state.toDouble() / 4294967296.0).toFloat()
    }

    private companion object {
        const val MASK = 0xFFFFFFFFL
    }
}

/**
 * The note laid out in the pen: 6u on a 7.6u line in a block 85u wide, every word with its own small shift, turn and
 * pressure. A word too long for a line breaks between letters. A line in a right-to-left script runs from the right.
 * Notes too long for the 11 rules get smaller, so they never run into FROM.
 */
internal class PenNote private constructor(
    val note: String,
    val number: Int,
    val u: Float,
    val size: Float,
    val pitch: Float,
    val words: List<PenWord>,
) {
    class PenWord(
        val text: String,
        val x: Float,
        val line: Int,
        val width: Float,
        val shift: Float,
        val turn: Float,
        val opacity: Float,
    )

    companion object {
        private const val RULES = 11
        private const val RULED = 83.6f

        fun lay(
            note: String,
            number: Int,
            u: Float,
            paint: Paint,
        ): PenNote {
            var size = u * 6f
            var pitch = u * 7.6f
            var words = place(note, number, size, u * 85f, paint)
            var lines = (words.maxOfOrNull { it.line } ?: 0) + 1
            var tries = 0
            while (lines > RULES && tries < 6) {
                pitch = u * RULED / lines
                size = pitch * 6f / 7.6f
                words = place(note, number, size, u * 85f, paint)
                lines = (words.maxOfOrNull { it.line } ?: 0) + 1
                tries += 1
            }
            return PenNote(note, number, u, size, pitch, words)
        }

        private fun place(
            note: String,
            number: Int,
            size: Float,
            width: Float,
            paint: Paint,
        ): List<PenWord> {
            paint.textSize = size
            val space = paint.measureText(" ")
            val seed = CardSeed(number * 7 + 3)
            val out = ArrayList<PenWord>()
            var line = 0
            note.split('\n').forEach { row ->
                val backwards = row.isNotEmpty() && !Bidi(row, Bidi.DIRECTION_DEFAULT_LEFT_TO_RIGHT).baseIsLeftToRight()
                var x = 0f
                var gap = false
                splitWords(row).forEach { token ->
                    if (token == " ") {
                        gap = true
                        return@forEach
                    }
                    val shift = (seed.next() - 0.5f) * 0.34f
                    val turn = (seed.next() - 0.5f) * 1.5f
                    val opacity = 0.86f + seed.next() * 0.14f
                    fits(token, width, paint).forEach { piece ->
                        val pieceWidth = paint.measureText(piece)
                        if (gap && x > 0f) x += space
                        if (x > 0f && x + pieceWidth > width) {
                            line += 1
                            x = 0f
                        }
                        val placedAt = if (backwards) width - x - pieceWidth else x
                        out += PenWord(piece, placedAt, line, pieceWidth, shift, turn, opacity)
                        x += pieceWidth
                        gap = false
                    }
                }
                line += 1
            }
            return out
        }

        /** A line's words and the spaces between them, in order (a run of spaces counts each, as the web's split does). */
        private fun splitWords(row: String): List<String> {
            val out = ArrayList<String>()
            var from = 0
            while (true) {
                val at = row.indexOf(' ', from)
                if (at < 0) {
                    out += row.substring(from)
                    return out
                }
                out += row.substring(from, at)
                out += " "
                from = at + 1
            }
        }

        /** [word] as it fits on a line: whole, or broken between letters (never inside one letter or emoji). */
        private fun fits(
            word: String,
            width: Float,
            paint: Paint,
        ): List<String> {
            if (word.isEmpty()) return emptyList()
            if (paint.measureText(word) <= width) return listOf(word)
            val breaks = BreakIterator.getCharacterInstance().apply { setText(word) }
            val out = ArrayList<String>()
            var start = 0
            while (start < word.length) {
                val most = paint.breakText(word, start, word.length, true, width, null)
                var end = breaks.preceding((start + most + 1).coerceAtMost(word.length))
                if (start + most >= word.length) end = word.length
                if (end <= start) end = breaks.following(start)
                out += word.substring(start, end)
                start = end
            }
            return out
        }
    }
}

/**
 * A card's number for its seed and stamp: the server's, else the picture's own ("christmas-2026-08" is 8), else 1.
 * Kept beside the painter so a shared picture and the table agree.
 */
internal fun cardNumber(
    number: Int?,
    design: String,
): Int = number ?: design.substringAfterLast('-').toIntOrNull() ?: 1

/** The postmark's "NOV 6" from a mailed day, by the phone's own calendar. */
internal fun cardPostmarkDay(mailedOn: String?): String = HolidayCardTimes.postmarkDay(mailedOn, HolidayCardTimes.zone(null))

/** The card's paper as a canvas colour. */
internal fun cardPaperColor(paper: String?): Int = HolidayCardArt.paper(paper).toArgb()
