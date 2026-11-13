@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.moments.map

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.moments.MomentHeightBand
import app.pantopus.android.data.moments.MomentShownHeight
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/*
 * Moment heights on the map (board H2). A single pin whose newest Moment carries a height shows it beside the ring:
 * a dot in the height band's color and "4,390 ft", or a small plane for a Moment posted in flight. The ring keeps its
 * own meaning (sky to green while new, gray once watched), so the band's color is on the tag, always with the number.
 * Crowded spots and rings fanned out round one spot carry none yet.
 *
 * Under the map's top row, at the left: the "Elevation" chip turns the tags on and off (kept on the phone, per account;
 * they start on), and beside it the key's five colors open the key ("Elevation above sea level") and close it again. The
 * board's key is a card at the bottom of the map; the real map's bottom holds Play all, +, the row of faces and the
 * cards, so the key opens here instead and goes when the map is moved. All of it shows only while the map's answer
 * says heights are on for you (`heights_on`, contract v3.9).
 */

/** What the chip and the key do. */
internal class MomentsHeightsActions(
    val onToggle: () -> Unit,
    val onKey: () -> Unit,
    val onCloseKey: () -> Unit,
)

/**
 * What the map's pins need to know about height tags: whether "Elevation" is on, and the west and east edges of the
 * map when it last settled (null before it has). Tags are laid out like a map's own labels: each takes the place after
 * its ring if nothing is there, else before it, else over it (board F1 draws them on either side), and where none of
 * the three has room (another pin, another tag, the edge of the map) it isn't drawn until the map is zoomed in. So
 * tags never sit on a pin or on each other. TalkBack reads the height either way.
 */
@Immutable
data class MomentHeightTagPlan(
    val shown: Boolean = false,
    val edges: Pair<Double, Double>? = null,
    /**
     * The map's zoom when it last settled. The overlay groups rings at a zoom rounded to half steps; the tags are
     * measured at this one, so a tag is only given a place it really has on screen.
     */
    val zoom: Float? = null,
)

/** Where round its ring a pin's height tag sits. */
internal enum class MomentTagSide { AFTER, BEFORE, ABOVE }

/** Between a pin's ring and a height tag beside it, and between the ring and a tag over it; and a tag's height. */
internal val MOMENT_HEIGHT_TAG_GAP: Dp = 3.dp
internal val MOMENT_HEIGHT_TAG_GAP_ABOVE: Dp = 2.dp
internal val MOMENT_HEIGHT_TAG_HEIGHT: Dp = 24.dp

/** A band's color, on the tag and in the key; always beside the number or a name. */
internal val MomentHeightBand.color: Color
    get() =
        when (this) {
            MomentHeightBand.LOW -> PantopusColors.momentHeightLow
            MomentHeightBand.HILLS -> PantopusColors.momentHeightHills
            MomentHeightBand.MOUNTAIN -> PantopusColors.momentHeightMountain
            MomentHeightBand.PEAK -> PantopusColors.momentHeightPeak
            MomentHeightBand.FLYING -> PantopusColors.momentHeightFlying
        }

/** A tag's width without its words, in dp: the padding at both ends, the dot or the plane, and the gap. */
internal fun momentHeightTagChromeDp(height: MomentShownHeight): Double = 2 * 8.0 + (if (height.flying) 12.0 else 8.0) + 5.0

/** The words' size and weight, shared with the overlay's measuring. */
internal val MOMENT_HEIGHT_TAG_TEXT = TextStyle(fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)

/** The pill beside a pin: a band-colored dot (a plane in flight) and the number. */
@Composable
internal fun MomentHeightTag(
    height: MomentShownHeight,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .pantopusShadow(PantopusElevations.sm, CircleShape)
                .clip(CircleShape)
                .background(Color.White)
                .height(MOMENT_HEIGHT_TAG_HEIGHT)
                .padding(horizontal = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (height.flying) {
            PantopusIconImage(icon = PantopusIcon.Plane, contentDescription = null, size = 12.dp, tint = PantopusColors.momentHeightFlying)
        } else {
            Box(modifier = Modifier.size(8.dp).background(height.band.color, CircleShape))
        }
        Text(text = height.text, style = MOMENT_HEIGHT_TAG_TEXT, color = PantopusColors.appText, maxLines = 1)
    }
}

/** The chip, the key's colors beside it, and the key under them. Nothing while heights are off for you. */
@Composable
internal fun MomentsHeightsBar(
    state: MomentsMapUiState,
    onToggle: () -> Unit,
    onKey: () -> Unit,
    onCloseKey: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!state.heightsOn) return
    val on = state.showsHeightTags
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
            HeightsChip(on = on, onToggle = onToggle)
            AnimatedVisibility(visible = on, enter = fadeIn(), exit = fadeOut()) {
                HeightKeyButton(open = state.heightKeyOpen, onClick = onKey)
            }
        }
        AnimatedVisibility(visible = on && state.heightKeyOpen, enter = fadeIn(), exit = fadeOut()) {
            HeightKey(onClose = onCloseKey)
        }
    }
}

@Composable
private fun HeightsChip(
    on: Boolean,
    onToggle: () -> Unit,
) {
    val ink = if (on) Color.White else PantopusColors.appText
    Row(
        modifier =
            Modifier
                .then(if (on) Modifier.filled(CircleShape) else Modifier.glassChip(CircleShape))
                .toggleable(value = on, role = Role.Switch, onValueChange = { onToggle() })
                .height(CHIP_HEIGHT)
                .padding(horizontal = 14.dp)
                .testTag("moments.heights.chip")
                .clearAndSetSemantics {
                    contentDescription = "Elevation"
                    stateDescription = if (on) "On" else "Off"
                    role = Role.Switch
                    onClick(label = if (on) "Hide elevation" else "Show elevation") {
                        onToggle()
                        true
                    }
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Mountain, contentDescription = null, size = 17.dp, tint = ink)
        Text(text = "Elevation", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = ink, maxLines = 1)
        if (on) PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 14.dp, strokeWidth = 2.75f, tint = ink)
    }
}

/** The key, folded: its five colors. A tap opens it. */
@Composable
private fun HeightKeyButton(
    open: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .glassChip(CircleShape)
                .clickable(role = Role.Button, onClick = onClick)
                .height(CHIP_HEIGHT)
                .padding(horizontal = Spacing.s3)
                .testTag("moments.heights.keyButton")
                .clearAndSetSemantics {
                    contentDescription = "Elevation colors"
                    stateDescription = if (open) "Open" else "Closed"
                    role = Role.Button
                    onClick(label = if (open) "Close" else "Show what each color means") {
                        onClick()
                        true
                    }
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        MomentHeightBand.entries.forEach { band ->
            Box(modifier = Modifier.size(8.dp).background(band.color, CircleShape))
        }
        PantopusIconImage(
            icon = if (open) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2.25f,
            tint = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(start = 2.dp),
        )
    }
}

/** Board H2's key: "Elevation above sea level", a bar per band with where it starts, and flying. */
@Composable
private fun HeightKey(onClose: () -> Unit) {
    val spoken = "Elevation above sea level: " + MomentHeightBand.entries.joinToString("; ") { it.spoken }
    Column(
        modifier =
            Modifier
                .width(292.dp)
                // Stronger than the chips' glass: the key's words stay readable over the pins behind it.
                .glassChip(RoundedCornerShape(18.dp), PantopusColors.mapGlassStrong)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    role = Role.Button,
                    onClick = onClose,
                )
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .testTag("moments.heights.key")
                .clearAndSetSemantics {
                    contentDescription = spoken
                    onClick(label = "Close") {
                        onClose()
                        true
                    }
                },
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(text = "Elevation above sea level", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            MomentHeightBand.entries.forEach { band ->
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    HeightKeyBar(band)
                    Text(
                        text = band.keyLabel,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appTextSecondary,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

/** A band's bar; flying is a broken one, with its plane, so it never reads as a fifth step up. */
@Composable
private fun HeightKeyBar(band: MomentHeightBand) {
    if (band != MomentHeightBand.FLYING) {
        Box(modifier = Modifier.fillMaxWidth().height(7.dp).background(band.color, CircleShape))
        return
    }
    Row(
        modifier = Modifier.fillMaxWidth().height(7.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(4) { Box(modifier = Modifier.weight(1f).height(7.dp).background(band.color, CircleShape)) }
        PantopusIconImage(icon = PantopusIcon.Plane, contentDescription = null, size = 11.dp, tint = band.color)
    }
}

/** The chip while it is on: the board's filled pill. */
private fun Modifier.filled(shape: Shape): Modifier =
    this
        .pantopusShadow(PantopusElevations.primary, shape)
        .clip(shape)
        .background(PantopusColors.primary600)

/** Glass over the map, as the top row's pills wear it: white at 82%, a hairline border and the soft shadow. */
private fun Modifier.glassChip(
    shape: Shape,
    fill: Color = PantopusColors.mapGlass,
): Modifier =
    this
        .pantopusShadow(PantopusElevations.md, shape)
        .clip(shape)
        .background(fill)
        .border(0.5.dp, PantopusColors.appBorder.copy(alpha = 0.5f), shape)

private val CHIP_HEIGHT: Dp = 36.dp
