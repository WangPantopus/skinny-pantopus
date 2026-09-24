@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.ballot

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.BallotDeadline
import app.pantopus.android.ui.theme.PantopusColors
import kotlin.math.abs

/**
 * Pure layout for the deadline timeline, shared in shape with iOS
 * `BallotTimelineLayout` and the web `timelineLayout`, so all three
 * clients place markers identically. Units are dp (the canvas's px).
 */
data class BallotTimelineLayout(
    val markers: List<Marker>,
    /** End of the darker "waiting for ballots" segment, when ahead. */
    val waitUntilX: Float?,
    val x0: Float,
    val x1: Float,
) {
    enum class Side { ABOVE, BELOW }

    enum class Anchor { START, MIDDLE, END }

    enum class Kind { TODAY, DEADLINE, FINAL }

    data class Marker(
        val key: String,
        val x: Float,
        val side: Side,
        val kind: Kind,
        val firstLine: String,
        val secondLine: String,
        val needsAction: Boolean,
        val anchor: Anchor,
    )

    companion object {
        const val HEIGHT = 74f
        const val TRACK_Y = 38f
        private const val INSET = 8f

        /** A label nearer than this to a same-side neighbour moves across. */
        private const val CLASH = 70f

        /** A middle label this near an edge anchors to that edge. */
        private const val EDGE = 40f
        private val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

        fun make(
            deadlines: List<BallotDeadline>,
            today: String,
            width: Float,
        ): BallotTimelineLayout? {
            val ahead = ahead(deadlines)
            val last = ahead.lastOrNull()?.takeIf { it.daysUntil > 0 } ?: return null
            val span = last.daysUntil.toFloat()
            val x0 = INSET
            val x1 = width - INSET

            fun xFor(days: Int): Float = x0 + (x1 - x0) * days / span

            val markers =
                mutableListOf(
                    Marker("today", x0, Side.BELOW, Kind.TODAY, "Today", monthDay(today), needsAction = false, anchor = Anchor.START),
                )
            ahead.forEachIndexed { i, d ->
                val final = i == ahead.lastIndex
                markers +=
                    Marker(
                        key = d.key,
                        x = xFor(d.daysUntil),
                        side = if (final || i % 2 == 0) Side.ABOVE else Side.BELOW,
                        kind = if (final) Kind.FINAL else Kind.DEADLINE,
                        firstLine = d.monthDay,
                        secondLine = d.label,
                        needsAction = d.needsAction && !final,
                        anchor = if (final) Anchor.END else Anchor.MIDDLE,
                    )
            }
            // Today and the final marker never move.
            for (i in 1 until markers.lastIndex) {
                val m = markers[i]
                val clash = markers.withIndex().any { (j, o) -> j != i && o.side == m.side && abs(o.x - m.x) < CLASH }
                var placed = if (clash) m.copy(side = if (m.side == Side.ABOVE) Side.BELOW else Side.ABOVE) else m
                if (m.x < EDGE) {
                    placed = placed.copy(anchor = Anchor.START)
                } else if (m.x > width - EDGE) {
                    placed = placed.copy(anchor = Anchor.END)
                }
                markers[i] = placed
            }
            val mailed = ahead.firstOrNull { it.key == "ballots_mailed" }
            return BallotTimelineLayout(markers, mailed?.let { xFor(it.daysUntil) }, x0, x1)
        }

        /** "2026-09-24" → "Sep 24" (a calendar date; no timezone shift). */
        fun monthDay(iso: String): String {
            val parts = iso.split("-").mapNotNull { it.toIntOrNull() }
            if (parts.size != 3 || parts[1] !in 1..12) return iso
            return "${MONTHS[parts[1] - 1]} ${parts[2]}"
        }

        /** The chart's text alternative: every date it draws. */
        fun description(
            deadlines: List<BallotDeadline>,
            today: String,
        ): String {
            val parts = listOf("today, ${monthDay(today)}") + ahead(deadlines).map { "${it.label} ${it.monthDay}" }
            return "Timeline: " + parts.joinToString("; ")
        }

        private fun ahead(deadlines: List<BallotDeadline>): List<BallotDeadline> =
            deadlines.filter { it.timeline && it.daysUntil >= 0 }.sortedBy { it.daysUntil }
    }
}

/**
 * Deadline timeline (Chart catalog: "Deadlines for the home address";
 * Board: Place: Your ballot card). Real calendar spacing from today to
 * Election Day at the canvas's geometry: a 3dp track at y = 38 from
 * x = 8 to width − 8, r5 markers, the Election Day marker r6 with a 2dp
 * ring, 11sp labels alternating above (baselines 14/26) and below
 * (60/72), and the one deadline that needs action in the warning ink.
 * Parity twin of iOS `BallotTimelineView`.
 *
 * The canvas draws a 326-wide chart in the card's 324 content box, so the
 * drawing overflows its slot by [overflow] on the trailing side, as there.
 */
@Composable
fun BallotTimeline(
    deadlines: List<BallotDeadline>,
    today: String,
    modifier: Modifier = Modifier,
    overflow: Dp = 2.dp,
) {
    val measurer = rememberTextMeasurer()
    val description = remember(deadlines, today) { BallotTimelineLayout.description(deadlines, today) }
    Canvas(
        modifier =
            modifier
                .overflowEnd(overflow)
                .fillMaxWidth()
                .height(BallotTimelineLayout.HEIGHT.dp)
                .semantics { contentDescription = description },
    ) {
        val layout = BallotTimelineLayout.make(deadlines, today, size.width / density) ?: return@Canvas
        drawTimeline(layout, measurer)
    }
}

/** Measures the child [extra] wider than its slot and lets it overflow the trailing edge. */
private fun Modifier.overflowEnd(extra: Dp): Modifier =
    layout { measurable, constraints ->
        if (!constraints.hasBoundedWidth) {
            val placeable = measurable.measure(constraints)
            return@layout layout(placeable.width, placeable.height) { placeable.place(0, 0) }
        }
        val width = constraints.maxWidth
        val wide = width + extra.roundToPx()
        val placeable = measurable.measure(constraints.copy(minWidth = wide, maxWidth = wide))
        layout(width, placeable.height) { placeable.place(0, 0) }
    }

private fun DrawScope.drawTimeline(
    layout: BallotTimelineLayout,
    measurer: TextMeasurer,
) {
    val y = BallotTimelineLayout.TRACK_Y.dp.toPx()
    val track = 3.dp.toPx()
    drawLine(
        PantopusColors.appBorder,
        Offset(layout.x0.dp.toPx(), y),
        Offset(layout.x1.dp.toPx(), y),
        strokeWidth = track,
        cap = StrokeCap.Round,
    )
    layout.waitUntilX?.let { wait ->
        drawLine(
            PantopusColors.ballotWait,
            Offset(layout.x0.dp.toPx(), y),
            Offset(wait.dp.toPx(), y),
            strokeWidth = track,
            cap = StrokeCap.Round,
        )
    }
    layout.markers.forEach { m ->
        drawDot(m, y)
        val (first, second) = if (m.side == BallotTimelineLayout.Side.ABOVE) 14f to 26f else 60f to 72f
        val tx =
            when (m.anchor) {
                BallotTimelineLayout.Anchor.START -> m.x - 4f
                BallotTimelineLayout.Anchor.END -> m.x + 4f
                BallotTimelineLayout.Anchor.MIDDLE -> m.x
            }
        val firstColor =
            when {
                m.kind == BallotTimelineLayout.Kind.TODAY -> PantopusColors.home
                m.needsAction -> PantopusColors.warning
                else -> PantopusColors.appText
            }
        drawLabel(measurer, m.firstLine, FontWeight.SemiBold, firstColor, tx, first, m.anchor)
        drawLabel(measurer, m.secondLine, FontWeight.Normal, PantopusColors.appTextSecondary, tx, second, m.anchor)
    }
}

private fun DrawScope.drawDot(
    m: BallotTimelineLayout.Marker,
    y: Float,
) {
    val center = Offset(m.x.dp.toPx(), y)
    when (m.kind) {
        BallotTimelineLayout.Kind.FINAL -> {
            drawCircle(PantopusColors.appText, radius = 6.dp.toPx(), center = center)
            drawCircle(PantopusColors.appSurface, radius = 6.dp.toPx(), center = center, style = Stroke(width = 2.dp.toPx()))
        }
        BallotTimelineLayout.Kind.TODAY -> drawCircle(PantopusColors.home, radius = 5.dp.toPx(), center = center)
        BallotTimelineLayout.Kind.DEADLINE -> {
            val ink = if (m.needsAction) PantopusColors.warning else PantopusColors.appTextStrong
            drawCircle(ink, radius = 5.dp.toPx(), center = center)
        }
    }
}

/** Draws [text] with its first baseline at [baseline], like SVG `<text y>`. */
private fun DrawScope.drawLabel(
    measurer: TextMeasurer,
    text: String,
    weight: FontWeight,
    color: Color,
    x: Float,
    baseline: Float,
    anchor: BallotTimelineLayout.Anchor,
) {
    val result = measurer.measure(text, style = TextStyle(fontSize = 11.sp, fontWeight = weight, color = color))
    val left =
        when (anchor) {
            BallotTimelineLayout.Anchor.START -> x.dp.toPx()
            BallotTimelineLayout.Anchor.MIDDLE -> x.dp.toPx() - result.size.width / 2f
            BallotTimelineLayout.Anchor.END -> x.dp.toPx() - result.size.width
        }
    drawText(result, topLeft = Offset(left, baseline.dp.toPx() - result.firstBaseline))
}
