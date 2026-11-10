@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.PorterDuffXfermode
import android.graphics.RadialGradient
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import app.pantopus.android.ui.theme.PantopusColors
import kotlin.math.min

/** The sizes of a shared picture. */
internal enum class ShareFormat(
    val key: String,
    val label: String,
    val width: Int,
    val height: Int,
) {
    Story("story", "Story", 1080, 1920),
    Post("post", "Post", 1080, 1350),
    Link("link", "Link preview", 1200, 630),
}

/**
 * The pictures people share, drawn on the phone (nothing private leaves it): laid out as the design's `share.html`, whose
 * numbers are in a space 540 wide. A paper slip with the name and the way here goes in every one. The note and the first
 * name show only when [showNote] asks; an address never does, and a sealed card shows only its sealed envelope.
 */
internal class CardSharePictures(
    private val card: CardOnTable,
    private val art: CardTableArt,
    private val faceArt: CardFaceArt,
    private val picture: CardPicture?,
) {
    private val painter = CardFacePainter(faceArt, dp = 1f)
    private val words = card.words(cardPaperColor(card.paper))
    private val bitmaps = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    private val shadow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val paints = EnvelopePaints()

    /** A Story or Post picture; Link preview is kept on the website instead. */
    fun draw(
        format: ShareFormat,
        showNote: Boolean,
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(format.width, format.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.scale(2f, 2f)
        val width = format.width / 2f
        val height = format.height / 2f
        drawTable(canvas, width, height)
        when {
            format == ShareFormat.Story && card.sealed -> storySealed(canvas)
            format == ShareFormat.Story && showNote -> storyNote(canvas)
            format == ShareFormat.Story -> storyCard(canvas)
            card.sealed -> postSealed(canvas)
            showNote -> postNote(canvas)
            else -> postCard(canvas)
        }
        drawRoom(canvas, width, height)
        return bitmap
    }

    /*
     * The same layout as the web and iPhone (the design's share.html, in a space 540 wide; `share-layout` in the build's
     * notes). A Story keeps everything but the slip inside Instagram's safe area: nothing in the top 250 px or the bottom
     * 340 px of 1920 (125 and 170 here). The card is 800 px wide of 1080 on a Story, 760 on a Post.
     */
    private fun storyCard(canvas: Canvas) {
        openEnvelope(canvas, 400f * 1.012f, 68f, 298f, 2.4f)
        cardFront(canvas, 400f, 70f, 302f, -2.6f)
        slip(canvas, 122f, 806f, -1.6f, 296f, 54f, 13.5f, 13.5f)
    }

    private fun storyNote(canvas: Canvas) {
        openEnvelope(canvas, 372f, 84f, 300f, 4f)
        cardFront(canvas, 360f, 16f, 138f, -4f)
        cardBack(canvas, 360f, 164f, 346f, 3.2f)
        slip(canvas, 26f, 806f, -2.2f, 250f, 50f, 12f, 12.5f)
    }

    private fun storySealed(canvas: Canvas) {
        val w = 460f
        shutEnvelope(canvas, w, (540f - w) / 2f, 190f, -2.4f, 136f)
        mark(canvas, 21f, 96f, 506f)
        slip(canvas, 122f, 776f, -1.6f, 296f, 54f, 13.5f, 13.5f)
    }

    private fun postCard(canvas: Canvas) {
        openEnvelope(canvas, 380f * 1.012f, 78f, 112f, 3f)
        cardFront(canvas, 380f, 80f, 110f, -2.6f)
        slip(canvas, 139f, 612f, -1.2f, 262f, 46f, 12f, 12f)
    }

    private fun postNote(canvas: Canvas) {
        openEnvelope(canvas, 300f, 120f, 150f, 2.5f)
        cardFront(canvas, 272f, 6f, 104f, -3.2f)
        cardBack(canvas, 272f, 262f, 116f, 2.8f)
        slip(canvas, 139f, 612f, -1.2f, 262f, 46f, 12f, 12f)
    }

    private fun postSealed(canvas: Canvas) {
        val w = 410f
        shutEnvelope(canvas, w, (540f - w) / 2f, 62f, -2.2f, 122f)
        mark(canvas, 18f, 118f, 352f)
        slip(canvas, 139f, 606f, -1.2f, 262f, 46f, 12f, 12f)
    }

    private fun drawTable(
        canvas: Canvas,
        width: Float,
        height: Float,
    ) {
        val cloth = art.cloth
        val target = RectF(-10f, -10f, width + 10f, height + 10f)
        val shape = target.width() / target.height()
        val cutWidth = min(cloth.width.toFloat(), cloth.height * shape)
        val cutHeight = cutWidth / shape
        val left = (cloth.width - cutWidth) / 2f
        val top = (cloth.height - cutHeight) / 2f
        val paint =
            Paint(Paint.FILTER_BITMAP_FLAG).apply {
                colorFilter = PorterDuffColorFilter(clothTint(card.table).toArgb(), PorterDuff.Mode.MULTIPLY)
            }
        canvas.drawBitmap(cloth, Rect(left.toInt(), top.toInt(), (left + cutWidth).toInt(), (top + cutHeight).toInt()), target, paint)
    }

    /** The same room as the table: the window's light, a vignette, and fine grain. */
    private fun drawRoom(
        canvas: Canvas,
        width: Float,
        height: Float,
    ) {
        val light = Paint(Paint.FILTER_BITMAP_FLAG).also { softLight(it, strength = 0.95f) }
        canvas.drawBitmap(art.light, null, RectF(-60f, -60f, width + 60f, height + 60f), light)
        val vignette = Paint()
        vignette.shader =
            RadialGradient(
                0f,
                0f,
                1f,
                intArrayOf(
                    PantopusColors.tableVignette.copy(alpha = 0f).toArgb(),
                    PantopusColors.tableVignette.copy(alpha = 0.48f).toArgb(),
                ),
                floatArrayOf(0.44f, 1f),
                Shader.TileMode.CLAMP,
            ).apply {
                setLocalMatrix(
                    Matrix().apply {
                        setScale(width * 1.2f, height * 0.9f)
                        postTranslate(width * 0.46f, height * 0.4f)
                    },
                )
            }
        canvas.drawRect(0f, 0f, width, height, vignette)
        val grain = Paint(Paint.FILTER_BITMAP_FLAG)
        grain.shader =
            BitmapShader(art.grain, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT).apply {
                val scale = 128f / art.grain.width
                setLocalMatrix(Matrix().apply { setScale(scale, scale) })
            }
        grain.xfermode = PorterDuffXfermode(PorterDuff.Mode.OVERLAY)
        grain.alpha = (0.34f * 255f).toInt()
        canvas.drawRect(0f, 0f, width, height, grain)
    }

    /** The open envelope lying behind: its lining, the flap up, and the pocket. */
    private fun openEnvelope(
        canvas: Canvas,
        w: Float,
        x: Float,
        top: Float,
        turn: Float,
    ) {
        val h = w * 1392f / 1200f
        val depth = w * 512f / 1200f

        fun lay(target: Canvas) {
            target.drawBitmap(art.flapIn, null, RectF(0f, -depth, w, 0f), bitmaps)
            target.drawBitmap(art.inside, null, RectF(0f, 0f, w, h), bitmaps)
            target.drawBitmap(art.pocketShadow, null, RectF(0f, 0f, w, h), bitmaps)
            target.drawBitmap(art.pocket, null, RectF(0f, 0f, w, h), bitmaps)
        }
        val restore = canvas.save()
        canvas.rotate(turn, x + w / 2f, top + h / 2f)
        canvas.translate(x, top)
        dropShadow(canvas, w, h + depth, depth, 2f, 5f, 7f, 0.5f, ::lay)
        lay(canvas)
        canvas.restoreToCount(restore)
    }

    /** The shut envelope: the pocket, the flap's outside, and a large seal. */
    private fun shutEnvelope(
        canvas: Canvas,
        w: Float,
        x: Float,
        top: Float,
        turn: Float,
        sealWidth: Float,
    ) {
        val h = w * 1392f / 1200f
        val depth = w * 512f / 1200f

        fun lay(target: Canvas) {
            target.drawBitmap(art.pocket, null, RectF(0f, 0f, w, h), bitmaps)
            target.drawBitmap(art.flapShadow, null, RectF(0f, 0f, w, h), bitmaps)
            target.drawBitmap(art.flapOut, null, RectF(0f, 0f, w, depth), bitmaps)
            val sealHeight = sealWidth * art.wax.height / art.wax.width
            val left = (w - sealWidth) / 2f
            val sealTop = depth * 0.96f - sealWidth * 0.5f
            target.drawBitmap(art.wax, null, RectF(left, sealTop, left + sealWidth, sealTop + sealHeight), bitmaps)
        }
        val restore = canvas.save()
        canvas.rotate(turn, x + w / 2f, top + h / 2f)
        canvas.translate(x, top)
        dropShadow(canvas, w, h, 0f, 3f, 8f, 11f, 0.55f, ::lay)
        lay(canvas)
        canvas.restoreToCount(restore)
    }

    /** A shadow in the shape of what [lay] draws: drawn once to a plain copy, blurred, and laid underneath. */
    private fun dropShadow(
        canvas: Canvas,
        width: Float,
        height: Float,
        above: Float,
        dx: Float,
        dy: Float,
        blur: Float,
        alpha: Float,
        lay: (Canvas) -> Unit,
    ) {
        val scale = 2f
        val copy = Bitmap.createBitmap((width * scale).toInt(), (height * scale).toInt(), Bitmap.Config.ARGB_8888)
        val target = Canvas(copy)
        target.scale(scale, scale)
        target.translate(0f, above)
        lay(target)
        val offset = IntArray(2)
        val blurRadius = ((blur - 0.5f) / 0.57735f).coerceAtLeast(0.1f)
        val blurPaint = Paint().apply { maskFilter = BlurMaskFilter(blurRadius, BlurMaskFilter.Blur.NORMAL) }
        val silhouette = copy.extractAlpha(blurPaint, offset)
        copy.recycle()
        val restore = canvas.save()
        canvas.translate(dx, dy - above)
        canvas.scale(1f / scale, 1f / scale)
        shadow.reset()
        shadow.isAntiAlias = true
        shadow.isFilterBitmap = true
        shadow.color = Color.Black.copy(alpha = alpha).toArgb()
        canvas.drawBitmap(silhouette, offset[0].toFloat(), offset[1].toFloat(), shadow)
        canvas.restoreToCount(restore)
        silhouette.recycle()
    }

    private fun cardFront(
        canvas: Canvas,
        w: Float,
        x: Float,
        y: Float,
        turn: Float,
    ) = cardBox(canvas, w, x, y, turn) { painter.drawFront(it, w, words, picture, faceArt.paperShare) }

    private fun cardBack(
        canvas: Canvas,
        w: Float,
        x: Float,
        y: Float,
        turn: Float,
    ) = cardBox(canvas, w, x, y, turn) { painter.drawBack(it, w, words, faceArt.paperShare) }

    /** A card lying on the table, with two soft shadows under it. */
    private fun cardBox(
        canvas: Canvas,
        w: Float,
        x: Float,
        y: Float,
        turn: Float,
        face: (Canvas) -> Unit,
    ) {
        val u = w / 100f
        val h = u * 120f
        val restore = canvas.save()
        canvas.rotate(turn, x + w / 2f, y + h / 2f)
        canvas.translate(x, y)
        softRect(canvas, 0f, 0f, w, h, u * 0.7f, u * 0.6f, u * 1.1f, u * 2f, 0.42f)
        softRect(canvas, 0f, 0f, w, h, u * 0.7f, u * 1.6f, u * 3.2f, u * 9f, 0.45f)
        face(canvas)
        canvas.restoreToCount(restore)
    }

    private fun softRect(
        canvas: Canvas,
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
        corner: Float,
        dx: Float,
        dy: Float,
        blur: Float,
        alpha: Float,
    ) {
        shadow.reset()
        shadow.isAntiAlias = true
        shadow.color = Color.Black.copy(alpha = alpha).toArgb()
        shadow.maskFilter = BlurMaskFilter(((blur / 2f - 0.5f) / 0.57735f).coerceAtLeast(0.1f), BlurMaskFilter.Blur.NORMAL)
        canvas.drawRoundRect(left + dx, top + dy, right + dx, bottom + dy, corner, corner, shadow)
        shadow.maskFilter = null
    }

    /** "DO NOT OPEN / UNTIL CHRISTMAS" with its top left at ([left], [top]) before it's turned. */
    private fun mark(
        canvas: Canvas,
        size: Float,
        left: Float,
        top: Float,
    ) {
        val width = sealedMarkWidth(size, border = 3f, padX = size * 0.9f, paints)
        val height = size * 1.2f * 2f + (size * 0.55f + 3f) * 2f
        drawSealedMark(canvas, left + width / 2f, top + height / 2f, size, 3f, size * 0.55f, size * 0.9f, 6f, paints, lineHeight = 1.2f)
    }

    /** The small paper slip: PANTOPUS POST and where to send one. It's how people find us. */
    private fun slip(
        canvas: Canvas,
        x: Float,
        y: Float,
        turn: Float,
        w: Float,
        h: Float,
        nameSize: Float,
        lineSize: Float,
    ) {
        val restore = canvas.save()
        canvas.rotate(turn, x + w / 2f, y + h / 2f)
        softRect(canvas, x, y, x + w, y + h, 1.5f, 1f, 2f, 5f, 0.45f)
        val paper = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PantopusColors.tableSlip.toArgb() }
        canvas.drawRoundRect(x, y, x + w, y + h, 1.5f, 1.5f, paper)
        val grain = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        grain.shader =
            BitmapShader(faceArt.paper, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT).apply {
                val scale = 220f / faceArt.paper.width
                setLocalMatrix(Matrix().apply { setScale(scale, scale) })
            }
        grain.xfermode = PorterDuffXfermode(PorterDuff.Mode.MULTIPLY)
        canvas.drawRoundRect(x, y, x + w, y + h, 1.5f, 1.5f, grain)
        val text = paints.text
        val nameLine = nameSize * 1.1f
        val secondLine = lineSize * 1.25f
        val start = y + (h - nameLine - secondLine) / 2f
        val left = x + h * 0.36f
        text.reset()
        text.textAlign = Paint.Align.LEFT
        text.isAntiAlias = true
        text.typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
        text.textSize = nameSize
        text.letterSpacing = 0.24f
        text.color = PantopusColors.tableSlipName.toArgb()
        canvas.drawText("PANTOPUS POST", left - nameSize * 0.12f, boxBaseline(text, start, nameLine), text)
        text.typeface = Typeface.SERIF
        text.textSize = lineSize
        text.letterSpacing = 0.03f
        text.color = PantopusColors.tableSlipLine.toArgb()
        canvas.drawText("Send one at pantopus.com/cards", left - lineSize * 0.015f, boxBaseline(text, start + nameLine, secondLine), text)
        canvas.restoreToCount(restore)
    }

    private fun boxBaseline(
        paint: Paint,
        top: Float,
        line: Float,
    ): Float {
        val metrics = paint.fontMetrics
        return top + (line - (metrics.descent - metrics.ascent)) / 2f - metrics.ascent
    }
}
