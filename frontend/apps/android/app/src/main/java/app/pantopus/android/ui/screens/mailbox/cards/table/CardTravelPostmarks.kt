@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.DiscretePathEffect
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.util.LruCache
import androidx.compose.ui.graphics.toArgb
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardTimes
import app.pantopus.android.ui.theme.PantopusColors
import java.util.Locale
import kotlin.math.PI
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * A travelling card's postmarks on the envelope's address side (travelling card plan Part 3; `sample/page.html`'s
 * `SLOTS` and `postmark()`). Each town the card left strikes one ring 27% of the envelope wide: two circles, the town
 * and state in capitals round the top, PANTOPUS POST round the bottom, the day and the year in the middle. The first
 * cancels the stamp with today's five wavy lines. Every third, starting with the second, is in blue-black ink. More
 * than nine: the newest nine, and "+ 4 more towns" in the gold of CHRISTMAS CARD at the bottom right.
 *
 * Each ring is drawn once into a small picture of its own at the envelope's size, with the sample's ink grain, and kept;
 * the envelope then lays the pictures down turned and inked, so moving the envelope draws nothing new.
 */
internal object CardTravelPostmarks {
    /** At most this many postmarks show. */
    const val MOST = 9

    /**
     * Where each ring's centre goes, in shares of the envelope's width and height, and its turn in degrees: the plan's
     * (66, 15, −8°), (23, 30, 11°), (80, 37, −14°), (27, 70, 6°), (79, 69, −5°), (61, 88, 13°), (13, 52, −18°),
     * (89, 58, 9°), (46, 28, −3°).
     */
    private val SLOTS =
        arrayOf(
            floatArrayOf(0.66f, 0.15f, -8f),
            floatArrayOf(0.23f, 0.30f, 11f),
            floatArrayOf(0.80f, 0.37f, -14f),
            floatArrayOf(0.27f, 0.70f, 6f),
            floatArrayOf(0.79f, 0.69f, -5f),
            floatArrayOf(0.61f, 0.88f, 13f),
            floatArrayOf(0.13f, 0.52f, -18f),
            floatArrayOf(0.89f, 0.58f, 9f),
            floatArrayOf(0.46f, 0.28f, -3f),
        )

    /** The ring's drawing is 120 units tall, 27% of the envelope's width. */
    private const val RING = 120f
    private const val RING_SHARE = 0.27f

    /** With the wavy lines, the drawing is 232 units wide. */
    private const val WITH_WAVES = 232f

    /** The town's size round the top: 11.6 units, 10.4 for a town of more than eight letters; never under two thirds. */
    private const val TOWN_SIZE = 11.6f
    private const val LONG_TOWN_SIZE = 10.4f
    private const val SMALLEST_TOWN = TOWN_SIZE * 2f / 3f

    /** The top arc (radius 41.5) is 130 units long; the town keeps to 90% of it, clear of PANTOPUS POST's ends. */
    private const val TOP_RADIUS = 41.5f
    private val TOP_ROOM = (PI * TOP_RADIUS).toFloat() * 0.9f

    private val cache =
        object : LruCache<String, Bitmap>(12 * 1024 * 1024) {
            override fun sizeOf(
                key: String,
                value: Bitmap,
            ): Int = value.byteCount
        }

    private val serifBold: Typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
    private val shape = Paint(Paint.ANTI_ALIAS_FLAG)
    private val grainPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val grainMatrix = Matrix()

    /** Today's postmark ink; every third ring, starting with the second, blue-black. */
    private val inkBlack = inkPaint(PantopusColors.tablePostmarkDay.toArgb())
    private val inkBlue = inkPaint(PantopusColors.tablePostmarkBlue.toArgb())
    private val place = RectF()
    private val arc = Path()
    private val wave = Path()

    /** The ink's grain: the sample's turbulence, as one tile of soft noise kept for every ring (1 texel = 1 unit). */
    private val grain: Bitmap by lazy { makeGrain() }

    /**
     * The postmarks of [stops] (oldest first) on an address side [width] × [height]. The newest is struck as [strike]
     * goes from 0 to 1: unseen, then landing from a little larger with today's thump.
     */
    fun draw(
        canvas: Canvas,
        stops: List<CardTravelStop>,
        width: Float,
        height: Float,
        paints: EnvelopePaints,
        strike: Float = 1f,
    ) {
        if (stops.isEmpty() || width <= 0f) return
        val shown = stops.takeLast(MOST)
        val unit = width * RING_SHARE / RING
        shown.forEachIndexed { i, stop ->
            val newest = i == shown.lastIndex
            val struck = if (newest) strike.coerceIn(0f, 1f) else 1f
            if (struck <= 0f) return@forEachIndexed
            val (sx, sy, turn) = SLOTS[i].let { Triple(it[0], it[1], it[2]) }
            val picture = picture(stop, waves = i == 0, unit = unit, seed = i)
            val paint = if (i % 3 == 1) inkBlue else inkBlack
            paint.alpha = (255 * struck).roundToInt()
            val cx = width * sx
            val cy = height * sy
            val saved = canvas.save()
            canvas.translate(cx, cy)
            canvas.rotate(turn)
            if (struck < 1f) {
                val grow = 1f + 0.18f * (1f - struck)
                canvas.scale(grow, grow)
            }
            val half = RING / 2f * unit
            place.set(-half, -half, -half + picture.width, -half + picture.height)
            canvas.drawBitmap(picture, null, place, paint)
            canvas.restoreToCount(saved)
            paint.alpha = 255
        }
        val more = stops.size - shown.size
        if (more > 0) drawMore(canvas, more, width, height, paints)
    }

    /** "+ 4 more towns", bottom right in CHRISTMAS CARD's gold and letters, on its line. */
    private fun drawMore(
        canvas: Canvas,
        more: Int,
        width: Float,
        height: Float,
        paints: EnvelopePaints,
    ) {
        val size = width * 0.0235f
        val paint = paints.text
        paint.reset()
        paint.isAntiAlias = true
        paint.typeface = serifBold
        paint.textSize = size
        paint.letterSpacing = 0.2f
        paint.textAlign = Paint.Align.RIGHT
        paint.color = PantopusColors.tableGold.toArgb()
        val baseline = height * (1f - 0.054f) - size * 0.2f
        canvas.drawText(moreTowns(more), width * (1f - 0.068f) + size * 0.1f, baseline, paint)
        paint.textAlign = Paint.Align.LEFT
    }

    private fun inkPaint(ink: Int): Paint =
        Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG).apply { colorFilter = PorterDuffColorFilter(ink, PorterDuff.Mode.SRC_IN) }

    /** "+ 4 more towns", "+ 1 more town". */
    fun moreTowns(more: Int): String = "+ $more more ${if (more == 1) "town" else "towns"}"

    /** One ring drawn in solid ink with the grain, its centre at (60, 60) units; kept for the next draw. */
    private fun picture(
        stop: CardTravelStop,
        waves: Boolean,
        unit: Float,
        seed: Int,
    ): Bitmap {
        val key = "${stop.town}|${stop.state}|${stop.on}|$waves|${(unit * 100f).roundToInt()}|$seed"
        cache.get(key)?.let { return it }
        val wide = if (waves) WITH_WAVES else RING
        val bitmap =
            Bitmap.createBitmap(
                max(1, ceil(wide * unit).toInt()),
                max(1, ceil(RING * unit).toInt()),
                Bitmap.Config.ARGB_8888,
            )
        val canvas = Canvas(bitmap)
        drawRing(canvas, stop, waves, unit)
        // The ink's grain: the drawing keeps the noise's alpha, a little different on every ring.
        grainPaint.shader = BitmapShader(grain, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
        grainMatrix.reset()
        grainMatrix.setScale(unit, unit)
        grainMatrix.preTranslate((seed * 37 % GRAIN).toFloat(), (seed * 59 % GRAIN).toFloat())
        grainPaint.shader.setLocalMatrix(grainMatrix)
        grainPaint.xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
        canvas.drawRect(0f, 0f, bitmap.width.toFloat(), bitmap.height.toFloat(), grainPaint)
        grainPaint.shader = null
        cache.put(key, bitmap)
        return bitmap
    }

    private fun drawRing(
        canvas: Canvas,
        stop: CardTravelStop,
        waves: Boolean,
        u: Float,
    ) {
        val c = 60f * u
        // Two circles, a little rough at their edges as stamped ink is.
        shape.reset()
        shape.isAntiAlias = true
        shape.color = INK
        shape.style = Paint.Style.STROKE
        shape.pathEffect = DiscretePathEffect(2.4f * u, 0.32f * u)
        shape.strokeWidth = 3.2f * u
        canvas.drawCircle(c, c, 55.5f * u, shape)
        shape.strokeWidth = 1.9f * u
        canvas.drawCircle(c, c, 34f * u, shape)
        if (waves) {
            shape.strokeWidth = 3.4f * u
            shape.strokeCap = Paint.Cap.ROUND
            for (y in floatArrayOf(36f, 48f, 60f, 72f, 84f)) {
                // M124,y q13,-9 26,0 t26,0 t26,0 t26,0
                wave.reset()
                wave.moveTo(124f * u, y * u)
                var x = 124f
                var up = true
                repeat(4) {
                    wave.quadTo((x + 13f) * u, (y + if (up) -9f else 9f) * u, (x + 26f) * u, y * u)
                    x += 26f
                    up = !up
                }
                canvas.drawPath(wave, shape)
            }
        }
        shape.pathEffect = null
        shape.style = Paint.Style.FILL
        shape.typeface = serifBold
        shape.textAlign = Paint.Align.LEFT

        // The town and state round the top, set smaller to fit, the state left off if it still doesn't.
        val (words, size) = townWords(stop)
        shape.textSize = size * u
        shape.letterSpacing = 1.3f / size
        val topRadius = TOP_RADIUS * u
        arc.reset()
        arc.addArc(RectF(c - topRadius, c - topRadius, c + topRadius, c + topRadius), 180f, 180f)
        val topLength = (PI * topRadius).toFloat()
        val wordsWidth = shape.measureText(words)
        val squeeze = min(1f, TOP_ROOM * u / max(1f, wordsWidth))
        shape.textScaleX = squeeze
        canvas.drawTextOnPath(words, arc, (topLength - wordsWidth * squeeze) / 2f, 0f, shape)
        shape.textScaleX = 1f

        // PANTOPUS POST round the bottom.
        shape.textSize = 8.2f * u
        shape.letterSpacing = 1.6f / 8.2f
        val bottomRadius = 50f * u
        arc.reset()
        arc.addArc(RectF(c - bottomRadius, c - bottomRadius, c + bottomRadius, c + bottomRadius), 180f, -180f)
        val bottomLength = (PI * bottomRadius).toFloat()
        canvas.drawTextOnPath(POST, arc, (bottomLength - shape.measureText(POST)) / 2f, 0f, shape)

        // The day ("NOV 23") and the year in the middle.
        shape.letterSpacing = 0f
        shape.textAlign = Paint.Align.CENTER
        shape.textSize = 15.5f * u
        canvas.drawText(HolidayCardTimes.postmarkDay(stop.on, HolidayCardTimes.zone(null)), c, 59f * u, shape)
        shape.textSize = 11.5f * u
        canvas.drawText(stop.on?.take(4)?.takeIf { it.all(Char::isDigit) } ?: "", c, 74f * u, shape)
        shape.textAlign = Paint.Align.LEFT
    }

    /** What goes round the top and its size in units: "BOISE · ID" at its size, smaller to fit, or the town alone. */
    private fun townWords(stop: CardTravelStop): Pair<String, Float> {
        val town = stop.town.trim().uppercase(Locale.US)
        val state = stop.state?.trim()?.uppercase(Locale.US)?.takeIf { it.isNotEmpty() }
        val start = if (stop.town.trim().length > 8) LONG_TOWN_SIZE else TOWN_SIZE
        val measure = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = serifBold }

        fun fitted(words: String): Float {
            measure.textSize = start
            measure.letterSpacing = 1.3f / start
            val wide = measure.measureText(words)
            return if (wide <= TOP_ROOM) start else start * TOP_ROOM / wide
        }
        if (state != null) {
            val both = "$town · $state"
            val size = fitted(both)
            if (size >= SMALLEST_TOWN) return both to size
        }
        return town to max(SMALLEST_TOWN, fitted(town))
    }

    private const val POST = "PANTOPUS POST"

    /** The drawing's own ink before it's inked: solid, so the grain alone sets how much shows. */
    private const val INK = -0x1000000
}

/** The grain's tile, in units. */
private const val GRAIN = 128

/**
 * Soft noise like the sample's `feTurbulence` (base frequency 0.3, three octaves), wrapping at the tile's edges,
 * turned into ink: solid where the noise is low, thinning and then gone where it's high (alpha = 2.75 − 3.2 n).
 */
private fun makeGrain(): Bitmap {
    val pixels = IntArray(GRAIN * GRAIN)
    val cells = intArrayOf(32, 64, 128)
    val weights = floatArrayOf(1f, 0.5f, 0.25f)
    val total = weights.sum()
    for (y in 0 until GRAIN) {
        for (x in 0 until GRAIN) {
            var n = 0f
            for (o in cells.indices) {
                n += weights[o] * valueNoise(x, y, cells[o], o)
            }
            val level = (2.75f - 3.2f * (0.5f + (n / total - 0.5f) * GRAIN_SPREAD)).coerceIn(0f, 1f)
            pixels[y * GRAIN + x] = ((level * 255f).roundToInt() shl 24) or 0xFFFFFF
        }
    }
    return Bitmap.createBitmap(pixels, GRAIN, GRAIN, Bitmap.Config.ARGB_8888)
}

/** How widely the noise strays from its middle: close to the sample's, so every day and year still reads. */
private const val GRAIN_SPREAD = 0.95f

private fun valueNoise(
    x: Int,
    y: Int,
    cells: Int,
    octave: Int,
): Float {
    val span = GRAIN.toFloat() / cells
    val fx = x / span
    val fy = y / span
    val x0 = fx.toInt()
    val y0 = fy.toInt()
    val tx = smooth(fx - x0)
    val ty = smooth(fy - y0)
    val a = lattice(x0 % cells, y0 % cells, octave)
    val b = lattice((x0 + 1) % cells, y0 % cells, octave)
    val c = lattice(x0 % cells, (y0 + 1) % cells, octave)
    val d = lattice((x0 + 1) % cells, (y0 + 1) % cells, octave)
    val top = a + (b - a) * tx
    val bottom = c + (d - c) * tx
    return top + (bottom - top) * ty
}

private fun smooth(t: Float): Float = t * t * (3f - 2f * t)

private fun lattice(
    i: Int,
    j: Int,
    octave: Int,
): Float {
    var h = i * 374_761_393 + j * 668_265_263 + octave * 1_274_126_177
    h = (h xor (h ushr 13)) * 1_274_126_177
    h = h xor (h ushr 16)
    return (h and 0xFFFF) / 65_535f
}
