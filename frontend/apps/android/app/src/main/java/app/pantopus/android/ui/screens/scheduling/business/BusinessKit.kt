@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.business

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Business pillar accent (violet) + soft tint, exposed for terseness. */
val bizAccent: Color = PantopusColors.business
val bizAccentBg: Color = PantopusColors.businessBg

private val TOP_BAR_HEIGHT = 46.dp
private val BACK_HIT = 34.dp
private val ICON_SM = 16.dp
private val ICON_MD = 18.dp
private val ICON_BACK = 22.dp
private val CARD_RADIUS = Radii.xl
private val TOGGLE_W = 46.dp
private val TOGGLE_H = 28.dp
private val TOGGLE_KNOB = 24.dp
private val STEP_BTN = 26.dp
private val CHECK_BOX = 22.dp
private val PRIMARY_BTN_HEIGHT = 46.dp

/**
 * Section/full-screen top bar matching `biz-kit.jsx` TopBar: chevron back ·
 * centered title · optional trailing, on a surface with a hairline bottom rule.
 */
@Composable
fun BizTopBar(
    title: String,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
    trailing: @Composable (() -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier = Modifier.fillMaxWidth().height(TOP_BAR_HEIGHT).padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.size(BACK_HIT), contentAlignment = Alignment.Center) {
                if (onBack != null) {
                    Box(
                        modifier =
                            Modifier.size(BACK_HIT).clip(RoundedCornerShape(Radii.md)).clickable(
                                onClickLabel = "Back",
                                onClick = onBack,
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.ChevronLeft,
                            contentDescription = "Back",
                            size = ICON_BACK,
                            tint = PantopusColors.appText,
                        )
                    }
                }
            }
            Text(
                text = title,
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Box(modifier = Modifier.size(BACK_HIT), contentAlignment = Alignment.Center) {
                trailing?.invoke()
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

/** White surface card with a hairline border + rounded corners. */
@Composable
fun BizCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(CARD_RADIUS))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(CARD_RADIUS))
                .padding(horizontal = Spacing.s3),
    ) {
        content()
    }
}

/** Uppercase section overline, business-violet by default. */
@Composable
fun BizOverline(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = bizAccent,
) {
    Text(
        text = text.uppercase(),
        style = PantopusTextStyle.overline,
        fontWeight = FontWeight.Bold,
        color = color,
        modifier = modifier.padding(horizontal = Spacing.s1),
    )
}

enum class BizNoteTone { Info, InfoBlue, Warning, Error, Success }

/** Semantic-tinted inline note (SLA / warning / info row) from `biz-kit.jsx`. */
@Composable
fun BizNote(
    text: String,
    tone: BizNoteTone,
    icon: PantopusIcon,
    modifier: Modifier = Modifier,
) {
    val bg: Color
    val fg: Color
    val iconTint: Color
    val border: Color?
    when (tone) {
        BizNoteTone.Info -> {
            bg = bizAccentBg
            fg = PantopusColors.appTextStrong
            iconTint = bizAccent
            border = null
        }
        BizNoteTone.InfoBlue -> {
            bg = PantopusColors.infoBg
            fg = PantopusColors.appTextStrong
            iconTint = PantopusColors.info
            border = PantopusColors.infoLight
        }
        BizNoteTone.Warning -> {
            bg = PantopusColors.warningBg
            fg = PantopusColors.warning
            iconTint = PantopusColors.warning
            border = PantopusColors.warningLight
        }
        BizNoteTone.Error -> {
            bg = PantopusColors.errorBg
            fg = PantopusColors.error
            iconTint = PantopusColors.error
            border = PantopusColors.errorLight
        }
        BizNoteTone.Success -> {
            bg = PantopusColors.successBg
            fg = PantopusColors.success
            iconTint = PantopusColors.success
            border = PantopusColors.successLight
        }
    }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(bg)
                .then(if (border != null) Modifier.border(1.dp, border, RoundedCornerShape(Radii.lg)) else Modifier)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = ICON_SM, tint = iconTint)
        Text(text = text, style = PantopusTextStyle.caption, fontWeight = FontWeight.Medium, color = fg)
    }
}

/** iOS-style switch. Business accent when on; inert track otherwise. */
@Composable
fun BizToggle(
    on: Boolean,
    onToggle: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    accent: Color = bizAccent,
) {
    val trackColor =
        when {
            !enabled -> PantopusColors.appSurfaceSunken
            on -> accent
            else -> PantopusColors.appBorder
        }
    Box(
        modifier =
            modifier
                .size(width = TOGGLE_W, height = TOGGLE_H)
                .clip(RoundedCornerShape(Radii.pill))
                .background(trackColor)
                .clickable(enabled = enabled) { onToggle(!on) },
        contentAlignment = if (on) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(
            modifier =
                Modifier
                    .padding(horizontal = 2.dp)
                    .size(TOGGLE_KNOB)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface),
        )
    }
}

/** Rounded-square checkbox; filled with [accent] when on. */
@Composable
fun BizCheckbox(
    on: Boolean,
    modifier: Modifier = Modifier,
    accent: Color = bizAccent,
) {
    Box(
        modifier =
            modifier
                .size(CHECK_BOX)
                .clip(RoundedCornerShape(Radii.sm))
                .background(if (on) accent else Color.Transparent)
                .then(if (on) Modifier else Modifier.border(1.5.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.sm))),
        contentAlignment = Alignment.Center,
    ) {
        if (on) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextInverse,
                strokeWidth = 3.2f,
            )
        }
    }
}

/** Pill stepper: − value + with circular buttons. */
@Composable
fun BizStepper(
    value: String,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = bizAccent,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        StepButton(icon = PantopusIcon.Minus, tint = PantopusColors.appTextStrong, onClick = onMinus)
        Text(
            text = value,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.width(34.dp),
        )
        StepButton(icon = PantopusIcon.Plus, tint = accent, onClick = onPlus)
    }
}

@Composable
private fun StepButton(
    icon: PantopusIcon,
    tint: Color,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(STEP_BTN)
                .clip(CircleShape)
                .border(1.dp, PantopusColors.appBorder, CircleShape)
                .background(PantopusColors.appSurface)
                .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, tint = tint)
    }
}

enum class BizChipTone { Biz, Neutral, Success, Warning }

/** Small uppercase pill chip with an optional leading glyph. */
@Composable
fun BizChip(
    text: String,
    tone: BizChipTone,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
) {
    val bg: Color
    val fg: Color
    when (tone) {
        BizChipTone.Biz -> {
            bg = bizAccentBg
            fg = bizAccent
        }
        BizChipTone.Neutral -> {
            bg = PantopusColors.appSurfaceSunken
            fg = PantopusColors.appTextStrong
        }
        BizChipTone.Success -> {
            bg = PantopusColors.successBg
            fg = PantopusColors.success
        }
        BizChipTone.Warning -> {
            bg = PantopusColors.warningBg
            fg = PantopusColors.warning
        }
    }
    Row(
        modifier = modifier.clip(RoundedCornerShape(Radii.pill)).background(bg).padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (icon != null) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 10.dp, tint = fg, strokeWidth = 2.8f)
        }
        Text(text = text.uppercase(), style = PantopusTextStyle.overline, fontWeight = FontWeight.Bold, color = fg)
    }
}

/** Full-width sky primary CTA (functional chrome stays primary, not the pillar). */
@Composable
fun BizPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    saving: Boolean = false,
) {
    val clickable = enabled && !saving
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(PRIMARY_BTN_HEIGHT)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (clickable) PantopusColors.primary600 else PantopusColors.primary600.copy(alpha = 0.45f))
                .clickable(enabled = clickable, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = if (saving) "Saving" else text,
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

/** Two-option segmented control; the active segment lifts to white + accent text. */
@Composable
fun BizSegmented(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    accent: Color = bizAccent,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        options.forEachIndexed { index, label ->
            val active = index == selectedIndex
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(32.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(if (active) PantopusColors.appSurface else Color.Transparent)
                        .clickable(enabled = enabled) { onSelect(index) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    style = PantopusTextStyle.caption,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (active) accent else PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/** Gradient initials avatar disc (the mocks' per-member swatch), tokens-only. */
@Composable
fun MemberAvatar(
    name: String,
    seed: String,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 34.dp,
    dim: Boolean = false,
) {
    val (start, end) = avatarGradient(seed)
    Box(
        modifier =
            modifier
                .size(size)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(start, end))),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initialsFor(name),
            color = PantopusColors.appTextInverse.copy(alpha = if (dim) 0.5f else 1f),
            fontWeight = FontWeight.Bold,
            fontSize = (size.value * 0.36f).sp,
        )
    }
}

/** A read-only "lock" footnote (permission-gated states). */
@Composable
fun BizLockNote(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(horizontal = Spacing.s1, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextMuted)
        Text(text = text, style = PantopusTextStyle.caption, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
    }
}

/** A hairline row divider used inside cards. */
@Composable
fun BizRowDivider(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
}

/** Convenience for trailing chevrons on settings rows. */
@Composable
fun BizChevron(modifier: Modifier = Modifier) {
    PantopusIconImage(
        icon = PantopusIcon.ChevronRight,
        contentDescription = null,
        size = ICON_SM,
        tint = PantopusColors.appTextMuted,
        modifier = modifier,
    )
}
