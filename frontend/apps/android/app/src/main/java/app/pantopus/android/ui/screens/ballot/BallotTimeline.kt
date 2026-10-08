@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.ballot

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
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
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Pure layout for the deadline timeline, shared in shape with iOS
 * `BallotTimelineLayout` and the web `timelineLayout`, so all three
 * clients place markers identically. Units are dp (the canvas's px).
 *
 * The canvas's own arrangement runs first, unchanged. A repair pass then
 * moves only the labels that still collide with a neighbour or leave the
 * card (the shared timeline spec), so a layout where nothing collides comes
 * out exactly as the canvas arranges it.
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
        /** How far the repair pass slid the label along its row; the text draws at the anchor's x plus this. */
        val dx: Float = 0f,
    )

    /** The chart's vertical geometry in dp: the baselines of both label rows, the track and the canvas height. */
    data class Rows(
        val aboveFirst: Float,
        val aboveSecond: Float,
        val track: Float,
        val belowFirst: Float,
        val belowSecond: Float,
        val height: Float,
    )

    companion object {
        /** The chart is drawn through this font scale; at a larger one its labels cannot sit side by side. */
        const val MAX_CHART_FONT_SCALE = 1.15f

        private const val INSET = 8f

        /** A label nearer than this to a same-side neighbour moves across. */
        private const val CLASH = 70f

        /** A middle label this near an edge anchors to that edge. */
        private const val EDGE = 40f

        /** The canvas's own chart width; the list at large text ignores geometry and uses it only to read the markers. */
        private const val CANVAS_WIDTH = 326f

        // The canvas's vertical geometry (first baseline, line gap, track and label drops, bottom margin).
        private const val FIRST_BASELINE = 14f
        private const val LINE_GAP = 12f
        private const val TRACK_DROP = 12f
        private const val BELOW_DROP = 22f
        private const val BOTTOM_MARGIN = 2f
        private val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

        /**
         * The markers for [deadlines] on a chart [width] wide (dp). [fontScale] is
         * the system text scale: the repair pass sizes each label from it.
         */
        fun make(
            deadlines: List<BallotDeadline>,
            today: String,
            width: Float,
            fontScale: Float = 1f,
        ): BallotTimelineLayout? {
            val placed = place(deadlines, today, width) ?: return null
            return placed.copy(markers = BallotTimelineRepair.repair(placed.markers, width, fontScale))
        }

        /** The canvas's arrangement, as the board draws it (no repair). */
        private fun place(
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

        /** True while the chart fits its card at [fontScale]; beyond it the deadlines are listed instead. */
        fun drawsChart(fontScale: Float): Boolean = fontScale <= MAX_CHART_FONT_SCALE

        /**
         * The chart's vertical geometry at [fontScale]. The gap between a label's
         * two lines grows with the font so they never overprint; at a scale of 1
         * or less it is the canvas's own 14 / 26 / 38 / 60 / 72 and a 74 canvas.
         */
        fun rows(fontScale: Float): Rows {
            val lineGap = LINE_GAP * max(1f, fontScale)
            val track = FIRST_BASELINE + lineGap + TRACK_DROP
            val below = track + BELOW_DROP
            return Rows(
                aboveFirst = FIRST_BASELINE,
                aboveSecond = FIRST_BASELINE + lineGap,
                track = track,
                belowFirst = below,
                belowSecond = below + lineGap,
                height = below + lineGap + BOTTOM_MARGIN,
            )
        }

        /** The list's rows: the chart's markers, today first, each with its date and label on two lines. */
        fun listed(
            deadlines: List<BallotDeadline>,
            today: String,
        ): List<Marker> = place(deadlines, today, CANVAS_WIDTH)?.markers.orEmpty()

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
            val parts = listOf("today, ${monthDay(today)}") + ahead(deadlines).map { spoken(it) }
            return "Timeline: " + parts.joinToString("; ")
        }

        /** One deadline as it is read aloud: "ballots mailed Oct 16", and "return by 8 p.m. Nov 3" for the return deadline. */
        private fun spoken(d: BallotDeadline): String {
            val label = d.label.replaceFirstChar { it.lowercaseChar() }
            return if (d.key == "return_by") "return $label ${d.monthDay}" else "$label ${d.monthDay}"
        }

        private fun ahead(deadlines: List<BallotDeadline>): List<BallotDeadline> =
            deadlines.filter { it.timeline && it.daysUntil >= 0 }.sortedBy { it.daysUntil }
    }
}

/**
 * The repair pass behind [BallotTimelineLayout.make]. A label that overlaps a
 * same-side neighbour, or runs off the card, tries the other anchors, then the
 * other row, then a slide along its row; the least troubled placement wins and
 * the earlier one wins a tie. Today and the final marker never move, and the
 * deadline that needs action moves after the others. Label widths are
 * estimated at [CHAR_W] per character at 11sp, scaled by the font.
 * Arithmetic is in Double, as in the shared reference.
 */
private object BallotTimelineRepair {
    private const val CHAR_W = 5.5
    private const val GAP = 4.0

    /** A slid label keeps this much clear space from the label it moved past, so two short lines never read as one phrase. */
    private const val SLIDE_GAP = 12.0
    private const val BOUND = 12.0
    private const val NUDGE = 4.0
    private const val MAX_PUSH = 48.0
    private const val MAX_PASSES = 6

    /** An overlap this small is rounding, not a collision. */
    private const val EPS = 1e-6
    private const val FIXED = 3
    private const val NEEDS_ACTION = 2
    private const val MOVABLE = 1
    private val ANCHORS =
        listOf(BallotTimelineLayout.Anchor.MIDDLE, BallotTimelineLayout.Anchor.START, BallotTimelineLayout.Anchor.END)
    private val SLIDING = listOf(BallotTimelineLayout.Anchor.START, BallotTimelineLayout.Anchor.END)

    /** A label as the repair sees it: its marker's x, how wide it is, and where it sits now. */
    private data class Slot(
        val x: Double,
        val width: Double,
        val priority: Int,
        val side: BallotTimelineLayout.Side,
        val anchor: BallotTimelineLayout.Anchor,
        val dx: Double,
    ) {
        val left: Double
            get() =
                when (anchor) {
                    BallotTimelineLayout.Anchor.START -> x - NUDGE + dx
                    BallotTimelineLayout.Anchor.END -> x + NUDGE + dx - width
                    BallotTimelineLayout.Anchor.MIDDLE -> x + dx - width / 2
                }
        val right: Double
            get() =
                when (anchor) {
                    BallotTimelineLayout.Anchor.START -> x - NUDGE + dx + width
                    BallotTimelineLayout.Anchor.END -> x + NUDGE + dx
                    BallotTimelineLayout.Anchor.MIDDLE -> x + dx + width / 2
                }
    }

    fun repair(
        markers: List<BallotTimelineLayout.Marker>,
        width: Float,
        fontScale: Float,
    ): List<BallotTimelineLayout.Marker> {
        val edge = width.toDouble()
        val slots = markers.map { slotFor(it, fontScale) }.toMutableList()
        var passes = 0
        var moved = true
        while (moved && passes < MAX_PASSES) {
            val next = nextTroubled(slots, edge)
            moved = next != null && relocate(slots, next, edge)
            passes++
        }
        return markers.mapIndexed { i, m -> m.copy(side = slots[i].side, anchor = slots[i].anchor, dx = slots[i].dx.toFloat()) }
    }

    private fun slotFor(
        marker: BallotTimelineLayout.Marker,
        fontScale: Float,
    ): Slot {
        val longest = max(marker.firstLine.length, marker.secondLine.length)
        val priority =
            when {
                marker.kind != BallotTimelineLayout.Kind.DEADLINE -> FIXED
                marker.needsAction -> NEEDS_ACTION
                else -> MOVABLE
            }
        return Slot(
            x = marker.x.toDouble(),
            width = longest * CHAR_W * fontScale.toDouble(),
            priority = priority,
            side = marker.side,
            anchor = marker.anchor,
            dx = marker.dx.toDouble(),
        )
    }

    /** The slot to repair next: of those in trouble the lowest priority, then the right-hand one, then the earlier. */
    private fun nextTroubled(
        slots: List<Slot>,
        edge: Double,
    ): Int? =
        slots.indices
            .filter { slots[it].priority < FIXED && trouble(slots[it], it, slots, edge) > 0.0 }
            .minWithOrNull(compareBy<Int> { slots[it].priority }.thenByDescending { slots[it].x }.thenBy { it })

    /** Moves slot [i] to its least troubled placement; false when that is where it already was. */
    private fun relocate(
        slots: MutableList<Slot>,
        i: Int,
        edge: Double,
    ): Boolean {
        val before = slots[i]
        var best = before
        var least = Double.MAX_VALUE
        for (candidate in candidates(slots, i)) {
            val t = trouble(candidate, i, slots, edge)
            // Strictly less, beyond rounding: the earlier candidate wins a tie.
            if (t < least - EPS) {
                best = candidate
                least = t
            }
        }
        slots[i] = best
        return best.side != before.side || best.anchor != before.anchor || best.dx != before.dx
    }

    /** Every anchor on this row, then on the other, then a slide along each row for a start or end anchor. */
    private fun candidates(
        slots: List<Slot>,
        i: Int,
    ): List<Slot> {
        val slot = slots[i]
        val other = if (slot.side == BallotTimelineLayout.Side.ABOVE) BallotTimelineLayout.Side.BELOW else BallotTimelineLayout.Side.ABOVE
        val sides = listOf(slot.side, other)
        val plain = sides.flatMap { side -> ANCHORS.map { anchor -> slot.copy(side = side, anchor = anchor, dx = 0.0) } }
        val slid =
            sides.flatMap { side ->
                SLIDING.mapNotNull { anchor -> slide(slots, i, slot.copy(side = side, anchor = anchor, dx = 0.0)) }
            }
        return plain + slid
    }

    /** [probe] pushed along its row just far enough to clear the labels it overlaps; null when none or too far. */
    private fun slide(
        slots: List<Slot>,
        i: Int,
        probe: Slot,
    ): Slot? {
        var need = 0.0
        slots.forEachIndexed { j, other ->
            if (j != i && other.side == probe.side && overlap(probe, other) > EPS) {
                need =
                    if (probe.anchor == BallotTimelineLayout.Anchor.START) {
                        max(need, other.right + SLIDE_GAP - probe.left)
                    } else {
                        min(need, other.left - SLIDE_GAP - probe.right)
                    }
            }
        }
        return probe.copy(dx = need).takeIf { need != 0.0 && abs(need) <= MAX_PUSH }
    }

    /** How badly [label] (slot [i]'s candidate placement) collides with the card edge and its same-side neighbours; 0 is clear. */
    private fun trouble(
        label: Slot,
        i: Int,
        slots: List<Slot>,
        edge: Double,
    ): Double {
        var t = 0.0
        if (label.left < -BOUND || label.right > edge + BOUND) {
            t += max(max(-BOUND - label.left, label.right - edge - BOUND), 0.0) + 1
        }
        slots.forEachIndexed { j, other ->
            if (j != i && other.side == label.side) {
                val ov = overlap(label, other)
                if (ov > EPS) t += ov
            }
        }
        return t
    }

    /** Positive when two labels on one row are closer than [GAP], or overlap. */
    private fun overlap(
        a: Slot,
        b: Slot,
    ): Double = min(a.right, b.right) - max(a.left, b.left) + GAP
}

/** Test tag of the timeline, as a chart or as a list; each list row adds its marker's key. */
private const val TIMELINE_TAG = "place.ballot.timeline"

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
 *
 * Labels are sized in sp at dp positions, so past a text scale of
 * [BallotTimelineLayout.MAX_CHART_FONT_SCALE] they no longer fit side by
 * side: the deadlines are then listed one per row, with the same
 * accessibility text.
 */
@Composable
fun BallotTimeline(
    deadlines: List<BallotDeadline>,
    today: String,
    modifier: Modifier = Modifier,
    overflow: Dp = 2.dp,
) {
    val fontScale = LocalDensity.current.fontScale
    val description = remember(deadlines, today) { BallotTimelineLayout.description(deadlines, today) }
    if (BallotTimelineLayout.drawsChart(fontScale)) {
        BallotTimelineChart(deadlines, today, fontScale, description, overflow, modifier)
    } else {
        BallotTimelineList(BallotTimelineLayout.listed(deadlines, today), description, modifier)
    }
}

@Composable
private fun BallotTimelineChart(
    deadlines: List<BallotDeadline>,
    today: String,
    fontScale: Float,
    description: String,
    overflow: Dp,
    modifier: Modifier = Modifier,
) {
    val measurer = rememberTextMeasurer()
    val rows = BallotTimelineLayout.rows(fontScale)
    Canvas(
        modifier =
            modifier
                .overflowEnd(overflow)
                .fillMaxWidth()
                .height(rows.height.dp)
                .testTag(TIMELINE_TAG)
                .semantics { contentDescription = description },
    ) {
        val layout = BallotTimelineLayout.make(deadlines, today, size.width / density, fontScale) ?: return@Canvas
        drawTimeline(layout, measurer, rows)
    }
}

/** The deadlines as one row each, today first: a dot in the chart's ink, the date over its label. */
@Composable
private fun BallotTimelineList(
    markers: List<BallotTimelineLayout.Marker>,
    description: String,
    modifier: Modifier = Modifier,
) {
    if (markers.isEmpty()) return
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .testTag(TIMELINE_TAG)
                .clearAndSetSemantics { contentDescription = description },
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        markers.forEach { BallotTimelineRow(it) }
    }
}

@Composable
private fun BallotTimelineRow(marker: BallotTimelineLayout.Marker) {
    Row(
        modifier = Modifier.fillMaxWidth().testTag("$TIMELINE_TAG.${marker.key}"),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(marker.dotInk()))
        Column(modifier = Modifier.weight(1f)) {
            Text(marker.firstLine, style = BallotText.style(14.sp, FontWeight.SemiBold), color = marker.firstLineInk())
            Text(marker.secondLine, style = BallotText.style(12.sp), color = PantopusColors.appTextSecondary)
        }
    }
}

/** The date line's ink: home green for today, warning for the deadline that needs action, else the text ink. */
private fun BallotTimelineLayout.Marker.firstLineInk(): Color =
    when {
        kind == BallotTimelineLayout.Kind.TODAY -> PantopusColors.home
        needsAction -> PantopusColors.warning
        else -> PantopusColors.appText
    }

/** The marker dot's ink, as the chart draws it. */
private fun BallotTimelineLayout.Marker.dotInk(): Color =
    when {
        kind == BallotTimelineLayout.Kind.FINAL -> PantopusColors.appText
        kind == BallotTimelineLayout.Kind.TODAY -> PantopusColors.home
        needsAction -> PantopusColors.warning
        else -> PantopusColors.appTextStrong
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
    rows: BallotTimelineLayout.Rows,
) {
    val y = rows.track.dp.toPx()
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
        val above = m.side == BallotTimelineLayout.Side.ABOVE
        val first = if (above) rows.aboveFirst else rows.belowFirst
        val second = if (above) rows.aboveSecond else rows.belowSecond
        val anchorX =
            when (m.anchor) {
                BallotTimelineLayout.Anchor.START -> m.x - 4f
                BallotTimelineLayout.Anchor.END -> m.x + 4f
                BallotTimelineLayout.Anchor.MIDDLE -> m.x
            }
        // The repair pass may have slid the label along its row.
        val tx = anchorX + m.dx
        drawLabel(measurer, m.firstLine, FontWeight.SemiBold, m.firstLineInk(), tx, first, m.anchor)
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
