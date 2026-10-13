@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.plans.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.ui.screens.plans.colors
import app.pantopus.android.ui.screens.plans.icon
import app.pantopus.android.ui.screens.plans.planGlassStrong
import app.pantopus.android.ui.screens.plans.planPinInk
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/** Font scale at which chip groups turn into full-width rows (board P2: "at large text"). */
internal const val LARGE_TEXT_SCALE = 1.3f

/** Width under which chip groups turn into rows (board P2: "under about 360 pt of width"). */
internal val CHIP_ROWS_WIDTH: Dp = 360.dp

/** The type's colored square with its glyph (board P2 "sw"): 22 dp by default, used in tags and map chips. */
@Composable
fun PlanSwatch(
    kind: PlanKind,
    modifier: Modifier = Modifier,
    size: Dp = 22.dp,
    glyph: Dp = 13.dp,
    corner: Dp = 7.dp,
) {
    Box(
        modifier =
            modifier
                .size(size)
                .clip(RoundedCornerShape(corner))
                .background(kind.colors.accent),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = kind.icon, contentDescription = null, size = glyph, tint = planPinInk)
    }
}

/** The tinted 44 dp tile with the type's glyph (board P2 plan row). */
@Composable
fun PlanTile(
    kind: PlanKind,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    glyph: Dp = 22.dp,
    corner: Dp = 13.dp,
) {
    val colors = kind.colors
    Box(
        modifier =
            modifier
                .size(size)
                .clip(RoundedCornerShape(corner))
                .background(colors.tint),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = kind.icon, contentDescription = null, size = glyph, tint = colors.accent)
    }
}

/** A neutral or sky tile with any glyph (the "More nearby" rows, banners). */
@Composable
fun PlanIconTile(
    icon: PantopusIcon,
    background: Color,
    tint: Color,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    glyph: Dp = 22.dp,
    corner: Dp = 13.dp,
) {
    Box(
        modifier =
            modifier
                .size(size)
                .clip(RoundedCornerShape(corner))
                .background(background),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = glyph, tint = tint)
    }
}

/** The type tag (board P2 "ttag"): the swatch and the type's name on its tint. */
@Composable
fun PlanTypeTag(
    kind: PlanKind,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 30.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(kind.colors.tint)
                .padding(start = Spacing.s1, end = Spacing.s3)
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        PlanSwatch(kind)
        Text(
            text = kind.label,
            style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
    }
}

/**
 * A status chip (board P2): neutral fill and strong text, the hue only on the glyph. Never tappable on its own.
 * Plans uses this rather than the app's tinted `StatusChip` (component contract: "the semantic hue appears only on
 * a leading glyph").
 */
@Composable
fun PlanStatusChip(
    text: String,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    iconTint: Color = PantopusColors.appTextStrong,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 24.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 10.dp, vertical = 2.dp)
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (icon != null) PantopusIconImage(icon = icon, contentDescription = null, size = Spacing.s3, tint = iconTint)
        Text(
            text = text,
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Medium),
            color = PantopusColors.appTextStrong,
            maxLines = 1,
        )
    }
}

/** One choice of a [PlanChoiceGroup]. [enabled] false shows it at half strength ("Me + 3" when only 2 spots are left). */
data class PlanChoice(
    val id: String,
    val label: String,
    val enabled: Boolean = true,
)

/**
 * A choice chip (board P2): 34 dp pill, outline when off, sky fill with a check when on. Selection shows as check
 * plus fill, never by color alone.
 */
@Composable
fun PlanChoiceChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    role: Role = Role.RadioButton,
) {
    val border = if (selected) PantopusColors.primary700 else PantopusColors.appTextSecondary
    val fg = if (selected) PantopusColors.primary700 else PantopusColors.appText
    Row(
        modifier =
            modifier
                .heightIn(min = 34.dp)
                .alpha(if (enabled) 1f else 0.5f)
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (selected) PantopusColors.primary50 else Color.Transparent)
                .border(1.dp, border, RoundedCornerShape(Radii.pill))
                .clickable(enabled = enabled, role = role, onClick = onClick)
                .padding(horizontal = 13.dp)
                .semantics { this.selected = selected },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (selected) PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 14.dp, tint = fg)
        Text(
            text = label,
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold, lineHeight = 18.sp),
            color = fg,
            maxLines = 1,
        )
    }
}

/**
 * A group of choice chips. At large text or under 360 dp of width it becomes full-width rows with a trailing check
 * (board P2), so nothing truncates and every row is a 52 dp target.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PlanChoiceGroup(
    choices: List<PlanChoice>,
    isSelected: (PlanChoice) -> Boolean,
    onSelect: (PlanChoice) -> Unit,
    modifier: Modifier = Modifier,
    multiSelect: Boolean = false,
) {
    val fontScale = LocalDensity.current.fontScale
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val rows = fontScale >= LARGE_TEXT_SCALE || maxWidth < CHIP_ROWS_WIDTH
        val role = if (multiSelect) Role.Checkbox else Role.RadioButton
        if (rows) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
            ) {
                choices.forEachIndexed { index, choice ->
                    if (index > 0) HorizontalDivider(color = PantopusColors.appBorder)
                    PlanChoiceRow(choice, isSelected(choice), role) { onSelect(choice) }
                }
            }
        } else {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                choices.forEach { choice ->
                    PlanChoiceChip(
                        label = choice.label,
                        selected = isSelected(choice),
                        enabled = choice.enabled,
                        role = role,
                        onClick = { onSelect(choice) },
                    )
                }
            }
        }
    }
}

@Composable
private fun PlanChoiceRow(
    choice: PlanChoice,
    selected: Boolean,
    role: Role,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 52.dp)
                .alpha(if (choice.enabled) 1f else 0.5f)
                .clickable(enabled = choice.enabled, role = role, onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 10.dp)
                .semantics { this.selected = selected },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = choice.label,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        if (selected) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.primary600,
            )
        }
    }
}

/** The privacy chip over a map (board P2 ScopeChip): lock glyph and a short promise on strong glass. */
@Composable
fun PlanScopeChip(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 28.dp)
                .pantopusShadow(PantopusElevations.md, RoundedCornerShape(Radii.pill))
                .clip(RoundedCornerShape(Radii.pill))
                .background(planGlassStrong)
                .padding(horizontal = 10.dp, vertical = Spacing.s1)
                .clearAndSetSemantics { contentDescription = text },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextStrong)
        Text(
            text = text,
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appTextStrong,
        )
    }
}

/**
 * A privacy promise as a sentence, next to the thing it protects (board P2 "scope"): a lock (or another glyph)
 * and secondary text.
 */
@Composable
fun PlanScopeLine(
    text: String,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = PantopusIcon.Lock,
    centered: Boolean = false,
) {
    Row(
        modifier = modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
        horizontalArrangement =
            if (centered) Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally) else Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = Spacing.s4,
                tint = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Text(
            text = text,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            textAlign = if (centered) TextAlign.Center else TextAlign.Start,
        )
    }
}

/** A small lock line ("From Sam, only for people who are in"): 13 sp secondary. */
@Composable
fun PlanLockLine(
    text: String,
    modifier: Modifier = Modifier,
    icon: PantopusIcon = PantopusIcon.Lock,
) {
    Row(
        modifier = modifier.semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextSecondary)
        Text(
            text = text,
            style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp),
            color = PantopusColors.appTextSecondary,
        )
    }
}

/** An uppercase section label (board "over"). */
@Composable
fun PlanOverline(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = PantopusColors.appTextSecondary,
) {
    Text(
        text = text.uppercase(),
        style = PantopusTextStyle.overline.copy(fontSize = 12.sp),
        color = color,
        modifier = modifier.semantics { heading() },
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
    )
}

/** Gap used between a field label and its control (board "field": 8). */
internal val FIELD_GAP: Dp = Spacing.s2

/** Minimum touch target around small controls. */
internal val TOUCH_TARGET: Dp = 44.dp

/** A 1 dp hairline divider in the board's border color. */
@Composable
fun PlanDivider(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(PantopusColors.appBorder),
    )
}

/** Keeps a control at least [TOUCH_TARGET] wide. */
fun Modifier.planTouchTarget(): Modifier = this.heightIn(min = TOUCH_TARGET).widthIn(min = TOUCH_TARGET)
