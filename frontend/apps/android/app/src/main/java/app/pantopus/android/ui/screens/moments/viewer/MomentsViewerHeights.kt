@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.moments.viewer

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentAuthorDto
import app.pantopus.android.data.moments.MomentHeightBand
import app.pantopus.android.data.moments.MomentShownHeight
import app.pantopus.android.ui.screens.moments.components.MomentFace
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import java.text.NumberFormat
import kotlin.math.max
import kotlin.math.sqrt

/*
 * How high the Moment being watched was made (board H4): a tag on the Moment, a mountain and "3,480 ft" (a plane for
 * one posted in flight), beside a rail down the right edge from 0 ft to a round number above the highest thing on it.
 * On the rail: this Moment's face at its height, the faces of other people's rings that carry one (the rings the
 * viewer was opened with), and "You" where the phone last read your own height.
 *
 * The rail is drawn on a square-root scale, so a Moment by the river and one on a summit both have room. None of it
 * takes a touch: the viewer's taps, hold, swipes and reply box work as they always have. It shows only while the
 * Moment carries a height (heights are on for you and its author showed it), and gives way to a reply being written,
 * as the caption does.
 */

/** One face on the rail. */
@Immutable
data class MomentRailFace(
    val id: String,
    val author: MomentAuthorDto,
    val height: MomentShownHeight,
)

/** What the rail draws, worked out from the viewer's state. */
@Immutable
data class MomentHeightRail(
    val showing: MomentRailFace,
    val others: List<MomentRailFace>,
    /** Your own height now, in feet; null when the phone has no reading. */
    val you: Int?,
) {
    /** The round number at the top: room above the highest face, so it never sits on the top label. */
    val top: Int =
        (listOf(showing.height.feet) + others.map { it.height.feet } + listOfNotNull(you)).max().let { highest ->
            TOPS.firstOrNull { it >= highest * 1.12 } ?: TOPS.last()
        }

    /** How far up the rail a height sits, 0 at the bottom to 1 at the top: the square root, so low heights spread out. */
    fun place(feet: Int): Float = sqrt(max(feet, 0).toDouble() / top).coerceIn(0.0, 1.0).toFloat()

    /** What TalkBack reads for the rail. */
    val spoken: String
        get() {
            val number = NumberFormat.getIntegerInstance()
            val names = others.map { "${it.author.firstName ?: it.author.name ?: "Someone"} at ${number.format(it.height.feet)} feet" }
            return (
                listOf("Height scale, 0 to ${number.format(top)} feet", "this Moment at ${number.format(showing.height.feet)} feet") +
                    names +
                    listOfNotNull(you?.let { "you at ${number.format(it)} feet" })
            ).joinToString(", ")
        }

    companion object {
        /** The rail holds this many other faces at most: the nearest in the queue. */
        const val MOST_OTHERS = 10
        private val TOPS = listOf(100, 250, 500, 1_000, 2_500, 5_000, 10_000, 20_000, 40_000, 60_000)
    }
}

/** A band's color, on the tag's mark and round this Moment's face. */
private val MomentHeightBand.color: Color
    get() =
        when (this) {
            MomentHeightBand.LOW -> PantopusColors.momentHeightLow
            MomentHeightBand.HILLS -> PantopusColors.momentHeightHills
            MomentHeightBand.MOUNTAIN -> PantopusColors.momentHeightMountain
            MomentHeightBand.PEAK -> PantopusColors.momentHeightPeak
            MomentHeightBand.FLYING -> PantopusColors.momentHeightFlying
        }

/** The tag: a mountain (a plane in flight) in the band's color and the number, on white as board H4 draws it. */
@Composable
internal fun MomentViewerHeightTag(
    height: MomentShownHeight,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .pantopusShadow(PantopusElevations.md, CircleShape)
                .clip(CircleShape)
                .background(Color.White)
                .height(32.dp)
                .padding(horizontal = Spacing.s3)
                .testTag("moments.viewer.height")
                .clearAndSetSemantics { contentDescription = "Height: ${height.spoken}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = if (height.flying) PantopusIcon.Plane else PantopusIcon.Mountain,
            contentDescription = null,
            size = 17.dp,
            tint = height.band.color,
        )
        Text(text = height.text, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText, maxLines = 1)
    }
}

/**
 * The rail and the tag, down the right edge between the header and the caption. [modifier] is the stage (under the
 * status bar, above the reply box). No pointer input anywhere here: touches reach the Moment under it.
 */
@Composable
internal fun MomentsViewerHeights(
    rail: MomentHeightRail,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(modifier = modifier.padding(top = RAIL_TOP, bottom = RAIL_BELOW, end = RAIL_INSET)) {
        val length = maxHeight

        fun spot(feet: Int): Dp = length * (1f - rail.place(feet))
        // A column with no width at the right edge: the rail's line. Everything is placed against it.
        Box(modifier = Modifier.align(Alignment.TopEnd).width(0.dp).fillMaxHeight()) {
            Box(
                modifier =
                    Modifier
                        .onLine(length / 2)
                        .size(width = 2.dp, height = length)
                        .background(LINE, CircleShape)
                        .testTag("moments.viewer.heightRail")
                        .clearAndSetSemantics { contentDescription = rail.spoken },
            )
            for (step in 1..3) {
                Box(modifier = Modifier.onLine(length * step / 4).size(width = 10.dp, height = 2.dp).background(LINE, CircleShape))
            }
            val top = NumberFormat.getIntegerInstance().format(rail.top)
            RailEnd(words = "$top ft", modifier = Modifier.onLine((-16).dp, reach = END_REACH))
            RailEnd(words = "0 ft", modifier = Modifier.onLine(length + 16.dp, reach = END_REACH))
            rail.others.forEach { face ->
                MomentFace(
                    author = face.author,
                    size = 20.dp,
                    modifier =
                        Modifier
                            .onLine(spot(face.height.feet))
                            .background(Color.White, CircleShape)
                            .padding(2.dp)
                            .clearAndSetSemantics {},
                )
            }
            rail.you?.let { you ->
                Box(
                    modifier = Modifier.onLine(spot(you)).size(26.dp).background(Color.White, CircleShape).clearAndSetSemantics {},
                    contentAlignment = Alignment.Center,
                ) {
                    Text(text = "You", fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.primary600, maxLines = 1)
                }
            }
            // This Moment's face, bigger, in its band's color, with the tag before it.
            val height = rail.showing.height
            Row(
                modifier = Modifier.onLine(spot(height.feet), trailingHalf = SHOWING_FACE / 2),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                MomentViewerHeightTag(height = height)
                MomentFace(
                    author = rail.showing.author,
                    size = SHOWING_FACE - 9.dp,
                    modifier =
                        Modifier
                            .background(Color.White, CircleShape)
                            .padding(1.5.dp)
                            .background(height.band.color, CircleShape)
                            .padding(3.dp)
                            .clearAndSetSemantics {},
                )
            }
        }
    }
}

/** A label at one end of the line, on the dark pill the caption wears. */
@Composable
private fun RailEnd(
    words: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = words,
        color = Color.White,
        fontSize = 11.5.sp,
        fontWeight = FontWeight.SemiBold,
        maxLines = 1,
        modifier =
            modifier
                .background(PantopusColors.momentCaptionPill, CircleShape)
                .padding(horizontal = Spacing.s2, vertical = 2.dp)
                .clearAndSetSemantics {},
    )
}

/**
 * Places the content on the rail's line, [y] down it. By default its middle sits on the line. With [reach], content
 * too wide for that ("40,000 ft") is kept on the screen with its right end [reach] past the line. With [trailingHalf],
 * the content's last part (this Moment's face, half that wide) is what sits on the line.
 */
private fun Modifier.onLine(
    y: Dp,
    reach: Dp? = null,
    trailingHalf: Dp? = null,
): Modifier =
    layout { measurable, _ ->
        val placeable = measurable.measure(Constraints())
        val before =
            when {
                trailingHalf != null -> placeable.width - trailingHalf.roundToPx()
                reach != null -> max(placeable.width / 2, placeable.width - reach.roundToPx())
                else -> placeable.width / 2
            }
        layout(0, 0) { placeable.place(-before, y.roundToPx() - placeable.height / 2) }
    }

private val LINE = Color.White.copy(alpha = 0.7f)
private val RAIL_TOP: Dp = 126.dp
private val RAIL_BELOW: Dp = 180.dp
private val RAIL_INSET: Dp = 30.dp
private val END_REACH: Dp = 22.dp
private val SHOWING_FACE: Dp = 35.dp
