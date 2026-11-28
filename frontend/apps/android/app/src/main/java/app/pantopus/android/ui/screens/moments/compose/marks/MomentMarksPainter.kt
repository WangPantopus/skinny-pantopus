@file:Suppress("TooManyFunctions")

package app.pantopus.android.ui.screens.moments.compose.marks

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import app.pantopus.android.ui.screens.mailbox.cards.table.CardSignatureInk
import app.pantopus.android.ui.theme.PantopusColors
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Draws a picture's marks onto an `android.graphics.Canvas` [width] × [height] px that holds the whole picture. The one
 * routine for both: the editor's canvas while marks are made, and the photo they are drawn into before it posts. So
 * what the author sees is what uploads. Lines are smoothed and capped as the card signature's ink is; labels are laid
 * out by [layout], the same in both.
 */
object MomentMarksPainter {
    /**
     * Labels are laid out on a picture this many units wide and then scaled, so their lines break the same at every
     * size: on the editor's screen, in the text field and in the 2048-px photo (iPhone lays out at 1000 units too).
     */
    private const val LAYOUT_WIDTH = 1000f

    /**
     * Plain letters' edge, in letter sizes: a stroke centred on the outline, so half of it shows outside the letter
     * (iPhone's 16%). An edge scales with the picture; a shadow's blur doesn't.
     */
    const val EDGE = 0.16f

    /** A plain label's box around its words (it has no plate), in letter sizes. */
    private const val PLAIN_ACROSS = 0.12f
    private const val PLAIN_DOWN = 0.06f

    /** How many times [keptIn] shrinks a label's letters to fit. */
    private const val FIT_PASSES = 4

    /** Half a pixel's rounding allowed when [fitsTurned] compares boxes. */
    private const val FIT_SLACK = 0.5f

    /**
     * [skip]: a label the editor draws itself while its words are typed. [shape]: the picture's width over its height
     * as the editor showed it, where [width] × [height] only comes close (a video's export size is rounded to whole
     * pixels), so the labels' lines break where they did in the editor.
     */
    fun draw(
        canvas: Canvas,
        marks: MomentMarks,
        width: Float,
        height: Float,
        skip: Int? = null,
        shape: Float = width / height,
    ) {
        val ink = CardSignatureInk.paint(multiply = false)
        // "Pulse, reinvented"'s Studio: words behind the photo's subject first, with the subject's shape taken out of them.
        val subject = marks.subject?.takeIf { marks.labels.any { it.behind } }
        subject?.behind(canvas, width, height) {
            draw(canvas, MomentMarks(labels = marks.labels.filter { it.behind }), width, height, skip, shape)
        }
        if (marks.strokes.any { it.pen != MomentPen.Marker }) {
            // "Pulse, reinvented"'s Studio: lines with a highlighter, an arrow or the eraser among them.
            MomentPensPainter.draw(canvas, marks.strokes, width, height)
        } else {
            for (stroke in marks.strokes) {
                val pixels = ArrayList<Float>(stroke.points.size)
                stroke.points.forEachIndexed { at, value -> pixels += value * if (at % 2 == 0) width else height }
                ink.color = stroke.tint ?: stroke.ink.color.toArgb()
                // Never thinner than a pixel, even on a small picture.
                ink.strokeWidth = (stroke.width * width).coerceAtLeast(1f)
                canvas.drawPath(CardSignatureInk.path(listOf(pixels)), ink)
            }
        }
        // "Pulse, reinvented"'s Studio: cutouts over the lines, under the words in front.
        marks.cutouts.drawAll(canvas, width, height)
        val box = Paint(Paint.ANTI_ALIAS_FLAG)
        // Labels behind the subject were drawn first.
        for (label in marks.labels.filterNot { subject != null && it.behind }) {
            if (label.id == skip || label.text.isBlank()) continue
            val laid = layout(label, width, height, shape)
            val restore = canvas.save()
            // Laid out upright, then turned about its middle.
            if (label.turn != 0f) canvas.rotate(label.turn, laid.box.centerX(), laid.box.centerY())
            boxColor(label)?.let { fill ->
                box.color = fill.toArgb()
                canvas.drawRoundRect(laid.box, laid.corner, laid.corner, box)
            }
            canvas.translate(laid.box.left + laid.padAcross, laid.box.top + laid.padDown)
            canvas.scale(laid.scale, laid.scale)
            edgeColor(label)?.let { edge ->
                // Plain letters: the edge first, then the letters over it.
                laid.text.paint.apply {
                    style = Paint.Style.STROKE
                    strokeWidth = EDGE * laid.text.paint.textSize
                    strokeJoin = Paint.Join.ROUND
                    color = edge.toArgb()
                }
                laid.text.draw(canvas)
                laid.text.paint.apply {
                    style = Paint.Style.FILL
                    color = letterColor(label).toArgb()
                }
            }
            laid.text.draw(canvas)
            canvas.restoreToCount(restore)
        }
    }

    /**
     * A label laid out on a picture [width] px wide: its words (laid out at [LAYOUT_WIDTH] units and drawn at [scale]),
     * and its box around them in px, centred on its middle; [letters] and [wrap] are the letter size and line width
     * in px.
     */
    class LabelLayout(
        val text: StaticLayout,
        val box: RectF,
        val corner: Float,
        val padAcross: Float,
        val padDown: Float,
        val scale: Float,
    ) {
        val letters: Float get() = text.paint.textSize * scale
        val wrap: Float get() = text.width * scale
    }

    fun layout(
        label: MomentLabel,
        width: Float,
        height: Float,
        shape: Float = width / height,
    ): LabelLayout {
        val scale = width / LAYOUT_WIDTH
        val letters = label.size * LAYOUT_WIDTH
        val paint = labelPaint(label, letters)
        val words = label.text.ifEmpty { " " }
        val metrics = paint.fontMetrics
        val (across, down) = padding(label, letters)
        val wrap = lineWidth(label, letters, shape)
        val text =
            StaticLayout.Builder
                .obtain(words, 0, words.length, paint, wrap)
                .setAlignment(Layout.Alignment.ALIGN_CENTER)
                .setLineSpacing(MomentMarkRules.LINE_HEIGHT * letters - (metrics.descent - metrics.ascent), 1f)
                .setIncludePad(false)
                .build()
        // The box hugs the widest line; the lines are centred in the layout's own width, so the drawing shifts by half
        // of what's left over.
        val widest = (0 until text.lineCount).maxOf { text.getLineWidth(it) }
        val boxWidth = (widest + across * 2) * scale
        val boxHeight = (text.height + down * 2) * scale
        val centreX = label.x * width
        val centreY = label.y * height
        val box = RectF(centreX - boxWidth / 2, centreY - boxHeight / 2, centreX + boxWidth / 2, centreY + boxHeight / 2)
        return LabelLayout(
            text = text,
            box = box,
            corner = MomentMarkRules.CORNER * letters * scale,
            padAcross = (across - (text.width - widest) / 2) * scale,
            padDown = down * scale,
            scale = scale,
        )
    }

    /** The label's letters, unhinted so they measure in proportion at every size, at [letters] layout units. */
    private fun labelPaint(
        label: MomentLabel,
        letters: Float,
    ): TextPaint =
        TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = letters
            typeface = label.font.typeface
            color = letterColor(label).toArgb()
            isLinearText = true
            isSubpixelText = true
        }

    /**
     * Where a label's lines break, in layout units: at 13.1 letter sizes, or at the width a label may take (less its
     * padding) where that's narrower (a landscape picture shows only its middle third); [shape] is the picture's width
     * over its height.
     */
    private fun lineWidth(
        label: MomentLabel,
        letters: Float,
        shape: Float,
    ): Int {
        val (across, _) = padding(label, letters)
        val room = MomentMarkRules.labelBox(shape).width * LAYOUT_WIDTH - across * 2
        return minOf(MomentMarkRules.WRAP_LETTERS * letters, room).roundToInt().coerceAtLeast(letters.roundToInt().coerceAtLeast(1))
    }

    /**
     * How far the label's longest word overruns its line (above 1, it breaks in the middle), for the fit only. Null when
     * that word is wider than a whole 13.1-letter line: no size makes it fit (a web address, a long handle), so it keeps
     * its size and breaks.
     */
    private fun wordOverflow(
        label: MomentLabel,
        width: Float,
        height: Float,
    ): Float? {
        val letters = label.size * LAYOUT_WIDTH
        val paint = labelPaint(label, letters)
        val longest = label.text.split(' ', '\n').maxOfOrNull { paint.measureText(it) } ?: return null
        if (longest > MomentMarkRules.WRAP_LETTERS * letters) return null
        return longest / lineWidth(label, letters, width / height)
    }

    /** The upright box around [box] turned [turn] degrees about its middle. */
    fun turnedBounds(
        box: RectF,
        turn: Float,
    ): RectF {
        if (turn == 0f) return box
        val radians = Math.toRadians(turn.toDouble())
        val cos = abs(cos(radians)).toFloat()
        val sin = abs(sin(radians)).toFloat()
        val halfWidth = (box.width() * cos + box.height() * sin) / 2
        val halfHeight = (box.width() * sin + box.height() * cos) / 2
        return RectF(box.centerX() - halfWidth, box.centerY() - halfHeight, box.centerX() + halfWidth, box.centerY() + halfHeight)
    }

    /** A label's padding around its words, across and down, for letters [letters] px tall (a plain label has no plate). */
    fun padding(
        label: MomentLabel,
        letters: Float,
    ): Pair<Float, Float> =
        if (label.style == MomentLabelStyle.Plain) {
            PLAIN_ACROSS * letters to PLAIN_DOWN * letters
        } else {
            MomentMarkRules.PAD_ACROSS * letters to MomentMarkRules.PAD_DOWN * letters
        }

    /** Plain letters' edge: black 45%, or white 70% under black ink (iPhone's look); none on a plate. */
    fun edgeColor(label: MomentLabel): Color? =
        when {
            label.style != MomentLabelStyle.Plain -> null
            // The Studio's colour from the photo: a light edge only under dark letters.
            label.tint != null -> onTint(label.tint, PantopusColors.momentMarksEdgeDark, PantopusColors.momentMarksEdgeLight)
            label.ink == MomentInk.Black -> PantopusColors.momentMarksEdgeLight
            else -> PantopusColors.momentMarksEdgeDark
        }

    /** The label's letters: the ink, or on a sign dark letters (white ones on a black or red sign, which read better). */
    fun letterColor(label: MomentLabel): Color =
        when {
            // The Studio's colour from the photo: the letters in it, or on a sign of it dark or light letters.
            label.tint != null && label.style != MomentLabelStyle.Sign -> Color(label.tint)
            label.tint != null -> onTint(label.tint, PantopusColors.momentInkBlack, PantopusColors.momentInkWhite)
            label.style != MomentLabelStyle.Sign -> label.ink.color
            label.ink == MomentInk.Black || label.ink == MomentInk.Red -> PantopusColors.momentInkWhite
            else -> PantopusColors.momentInkBlack
        }

    /** On a colour from the photo: [onLight] over a light one, [onDark] over a dark one. */
    private fun onTint(
        tint: Int,
        onLight: Color,
        onDark: Color,
    ): Color = if (MomentPhotoColors.isLight(tint)) onLight else onDark

    /** The plate behind the letters: none for plain words; dark for a label (light under black ink); the ink for a sign. */
    fun boxColor(label: MomentLabel): Color? =
        when (label.style) {
            MomentLabelStyle.Plain -> null
            MomentLabelStyle.Label ->
                if (label.ink == MomentInk.Black) PantopusColors.momentMarksLabelPlate else PantopusColors.momentMarksLabelBox
            MomentLabelStyle.Sign -> label.tint?.let { Color(it) } ?: label.ink.color
        }

    /**
     * [label] kept where a label may go on a picture [width] × [height] px ([MomentMarkRules.labelBox]): its letters no
     * larger than lets its box (the upright box around it when it's turned) fit there, between the smallest the picture
     * check reads and the largest, and that whole box inside it (its middle on that part's middle if even the smallest
     * letters don't fit).
     */
    fun keptIn(
        label: MomentLabel,
        width: Int,
        height: Int,
    ): MomentLabel {
        val allowed = MomentMarkRules.labelBox(width, height)
        val smallest = MomentMarkRules.smallestLetters(width, height)
        var sized = label.copy(size = label.size.coerceIn(smallest, MomentMarkRules.LARGEST_LETTERS))
        var laid = layout(sized, width.toFloat(), height.toFloat())
        // Smaller letters wrap differently, so a few passes settle it; a word is never broken in the middle to fit.
        var passes = 0
        while (passes++ < FIT_PASSES) {
            val box = turnedBounds(laid.box, sized.turn)
            // A word that could fit a whole line is never broken in the middle to fit; a longer one keeps its size.
            val word = wordOverflow(sized, width.toFloat(), height.toFloat())?.let { 1f / it } ?: Float.MAX_VALUE
            val fits = minOf(allowed.width * width / box.width(), allowed.height * height / box.height(), word)
            if (fits >= 1f || sized.size <= smallest) break
            sized = sized.copy(size = (sized.size * fits).coerceAtLeast(smallest))
            laid = layout(sized, width.toFloat(), height.toFloat())
        }
        val box = turnedBounds(laid.box, sized.turn)
        return sized.copy(
            x = kept(sized.x, box.width() / width / 2, allowed.left, allowed.right),
            y = kept(sized.y, box.height() / height / 2, allowed.top, allowed.bottom),
        )
    }

    /**
     * "Pulse, reinvented"'s Studio on its canvas (PHASE-6 I): [label] anywhere on a picture [width] × [height] px, never
     * pushed back toward the middle, with at least [keepX] × [keepY] px of its box (the upright box around it when it's
     * turned) still on the picture, and its letters between the smallest the picture check reads and the largest. Today's
     * editor keeps [keptIn].
     */
    fun keptAnywhere(
        label: MomentLabel,
        width: Int,
        height: Int,
        keepX: Float,
        keepY: Float,
    ): MomentLabel {
        val sized = label.copy(size = label.size.coerceIn(MomentMarkRules.smallestLetters(width, height), MomentMarkRules.LARGEST_LETTERS))
        val box = turnedBounds(layout(sized, width.toFloat(), height.toFloat()).box, sized.turn)
        val halfX = box.width() / width / 2
        val halfY = box.height() / height / 2
        val onX = minOf(keepX / width, 2 * halfX)
        val onY = minOf(keepY / height, 2 * halfY)
        return sized.copy(x = sized.x.coerceIn(onX - halfX, 1f - onX + halfX), y = sized.y.coerceIn(onY - halfY, 1f - onY + halfY))
    }

    /**
     * [label] turned can be held where a label may go on a picture [width] × [height] px: once kept ([keptIn]), the upright
     * box around it fits there. A twist that can't fit isn't applied (step R3).
     */
    fun fitsTurned(
        label: MomentLabel,
        width: Int,
        height: Int,
    ): Boolean {
        val allowed = MomentMarkRules.labelBox(width, height)
        val kept = keptIn(label, width, height)
        val box = turnedBounds(layout(kept, width.toFloat(), height.toFloat()).box, kept.turn)
        return box.width() <= allowed.width * width + FIT_SLACK && box.height() <= allowed.height * height + FIT_SLACK
    }

    /** A middle at [at] with [half] of the box each side, inside [from] to [to] (all shares of 1). */
    private fun kept(
        at: Float,
        half: Float,
        from: Float,
        to: Float,
    ): Float {
        val low = from + half
        val high = to - half
        return if (low > high) (from + to) / 2 else at.coerceIn(low, high)
    }
}
