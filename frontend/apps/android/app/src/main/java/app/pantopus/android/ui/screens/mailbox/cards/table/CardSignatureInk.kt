package app.pantopus.android.ui.screens.mailbox.cards.table

import android.graphics.BlendMode
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.os.Build
import androidx.compose.ui.graphics.toArgb
import app.pantopus.android.data.api.models.mailbox.CardSignature
import app.pantopus.android.ui.theme.PantopusColors
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.roundToInt

/**
 * The sender's own signature beside FROM (plan 8.2, launch key `card_table`), drawn the same in every app: a 400 × 100
 * box 48% of the card wide, starting where the typed name would, its line (y = 72) on FROM's baseline, in round
 * 4-unit strokes of the pen's ink. Strokes are the sender's data: never logged, never in a file name.
 */
internal object CardSignatureInk {
    /** Where the strokes' line sits in the box: it goes on FROM's baseline. */
    const val LINE = 72f

    /** The box's width on the card, as a share of the card's width. */
    const val ON_CARD = 0.48f

    const val STROKE = 4f

    /** A dot is a line this long, so its round caps draw it. */
    private const val DOT = 0.01f

    /** How hard [fit] simplifies, gentlest first, until the signature fits the server's 2 KB. */
    private val epsilons = floatArrayOf(0.6f, 0.9f, 1.3f, 1.9f, 2.8f, 4f)

    /** The strokes as one path in box units: smooth curves through the points; a dot is a tiny round-capped line. */
    fun path(strokes: List<List<Float>>): Path {
        val path = Path()
        for (points in strokes.map(::points).filter { it.isNotEmpty() }) {
            val (x0, y0) = points.first()
            path.moveTo(x0, y0)
            if (points.size == 1) path.lineTo(x0 + DOT, y0)
            for (i in 1 until points.size - 1) {
                val (x, y) = points[i]
                val (nx, ny) = points[i + 1]
                path.quadTo(x, y, (x + nx) / 2f, (y + ny) / 2f)
            }
            if (points.size > 1) points.last().let { (x, y) -> path.lineTo(x, y) }
        }
        return path
    }

    fun path(signature: CardSignature): Path = path(signature.strokes.map { stroke -> stroke.map(Int::toFloat) })

    /** The ink: round caps and joins, multiplied on the paper where the phone can. */
    fun paint(): Paint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            strokeWidth = STROKE
            color = PantopusColors.tablePen.toArgb()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) blendMode = BlendMode.MULTIPLY
        }

    /** [path] (box units) on a card [u] wide per hundredth, its box's left edge at [left] and its line on [baseline]. */
    fun draw(
        canvas: Canvas,
        path: Path,
        paint: Paint,
        u: Float,
        left: Float,
        baseline: Float,
    ) {
        val scale = u * 100f * ON_CARD / CardSignature.WIDTH
        val restore = canvas.save()
        canvas.translate(left, baseline - LINE * scale)
        canvas.scale(scale, scale)
        canvas.drawPath(path, paint)
        canvas.restoreToCount(restore)
    }

    /** What fitting the pad's strokes gave: nothing drawn, too much to keep, or the signature as the server keeps it. */
    sealed interface Fit {
        data object Empty : Fit

        data object TooLong : Fit

        data class Signed(
            val signature: CardSignature,
        ) : Fit
    }

    /**
     * Strokes drawn on the pad (box units, any precision) as the server keeps them: simplified, whole numbers, inside the
     * box, at most 2 KB as compact JSON.
     */
    fun fit(strokes: List<List<Float>>): Fit {
        val drawn = strokes.filter { it.size >= 2 }
        if (drawn.isEmpty()) return Fit.Empty
        if (drawn.size > CardSignature.MAX_STROKES) return Fit.TooLong
        for (epsilon in epsilons) {
            val fitted =
                drawn.map { stroke ->
                    val flat = ArrayList<Int>()
                    for ((x, y) in simplify(points(stroke), epsilon)) {
                        val px = x.roundToInt().coerceIn(0, CardSignature.WIDTH)
                        val py = y.roundToInt().coerceIn(0, CardSignature.HEIGHT)
                        if (flat.size >= 2 && flat[flat.size - 2] == px && flat[flat.size - 1] == py) continue
                        flat += px
                        flat += py
                    }
                    flat
                }
            val signature = CardSignature(strokes = fitted)
            if (CardSignatureJson.bytes(signature) <= CardSignature.MAX_BYTES) return Fit.Signed(signature)
        }
        return Fit.TooLong
    }

    private fun points(stroke: List<Float>): List<Pair<Float, Float>> =
        (0 until stroke.size / 2).map { stroke[it * 2] to stroke[it * 2 + 1] }

    // Ramer–Douglas–Peucker: the fewest points that stay within [epsilon] of the line drawn.
    private fun simplify(
        points: List<Pair<Float, Float>>,
        epsilon: Float,
    ): List<Pair<Float, Float>> {
        // A line of two points is already as simple as it gets.
        if (points.size <= 2) return points
        val (ax, ay) = points.first()
        val (bx, by) = points.last()
        val dx = bx - ax
        val dy = by - ay
        val length = hypot(dx, dy).takeIf { it > 0f } ?: 1f
        var far = 0f
        var index = 0
        for (i in 1 until points.size - 1) {
            val (x, y) = points[i]
            val d = abs(dy * x - dx * y + bx * ay - by * ax) / length
            if (d > far) {
                far = d
                index = i
            }
        }
        if (far <= epsilon) return listOf(points.first(), points.last())
        return simplify(points.subList(0, index + 1), epsilon).dropLast(1) + simplify(points.subList(index, points.size), epsilon)
    }
}

/** A signature as compact JSON: the size the server counts, and the send screen's saved state (never a log). */
internal object CardSignatureJson {
    /** Its size as `{"w":400,"h":100,"strokes":[[...]]}` with no spaces, the way the server counts it. */
    fun bytes(signature: CardSignature): Int = toJson(signature).toByteArray(Charsets.UTF_8).size

    /** The compact JSON, for the screen's saved state (never a log). */
    fun toJson(signature: CardSignature): String =
        buildString {
            append("{\"w\":").append(signature.w).append(",\"h\":").append(signature.h).append(",\"strokes\":[")
            signature.strokes.forEachIndexed { i, stroke ->
                if (i > 0) append(',')
                append('[')
                stroke.forEachIndexed { j, v ->
                    if (j > 0) append(',')
                    append(v)
                }
                append(']')
            }
            append("]}")
        }

    fun fromJson(json: String): CardSignature? =
        runCatching {
            val saved = JSONObject(json)
            val strokes = saved.getJSONArray("strokes")
            CardSignature(
                w = saved.getInt("w"),
                h = saved.getInt("h"),
                strokes = (0 until strokes.length()).map { at -> strokes.getJSONArray(at).let(::ints) },
            ).takeIf { it.drawable }
        }.getOrNull()

    private fun ints(array: JSONArray): List<Int> = (0 until array.length()).map(array::getInt)
}
