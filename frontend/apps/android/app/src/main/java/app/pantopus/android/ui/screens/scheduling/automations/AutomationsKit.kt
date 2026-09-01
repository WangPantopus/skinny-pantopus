@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "TooManyFunctions",
    "LongParameterList",
    "LongMethod",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Stream A16 — the local Compose UI kit for H1–H8. Mirrors the iOS
 * `AutomationsKit.swift` atoms (top bar, card, overline, note, chips, underline
 * tabs, segmented control, radio row, stepper, sheet chrome, primary/ghost
 * buttons, FAB, inline empty, error, skeleton, text inputs, toast) on the
 * Personal sky pillar. Tokens only (`PantopusColors`/`Spacing`/`Radii`/`Icon`);
 * off-scale design dims stay raw `.dp`/`.sp` like the A1 hub / A2 kit. Functional
 * controls (FAB, CTAs) stay product sky; identity chrome takes the owner accent.
 */

// ─── Dimensions ─────────────────────────────────────────────────────────────

private val TOP_BAR_HEIGHT = 46.dp
private val ICON_BUTTON = 40.dp
internal val ICON_16 = 16.dp
private val TILE_DEFAULT = 34.dp
private val FAB_SIZE = 52.dp

private val DASH = floatArrayOf(12f, 9f)

/** Dashed capsule border (the "Add custom time" / "Insert variable" pills). */
private fun Modifier.dashedCapsule(
    color: Color,
    width: Dp = 1.5.dp,
) = drawBehind {
    drawRoundRect(
        color = color,
        cornerRadius = CornerRadius(size.height / 2f),
        style = Stroke(width = width.toPx(), pathEffect = PathEffect.dashPathEffect(DASH, 0f)),
    )
}

// ─── Top bar (46dp) ─────────────────────────────────────────────────────────

enum class AutoLeading { None, Back, Close }

@Composable
fun AutoTopBar(
    title: String,
    modifier: Modifier = Modifier,
    leading: AutoLeading = AutoLeading.Back,
    onLeading: () -> Unit = {},
    trailing: (@Composable () -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = TOP_BAR_HEIGHT)
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s2),
        ) {
            if (leading != AutoLeading.None) {
                val isBack = leading == AutoLeading.Back
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.CenterStart)
                            .size(ICON_BUTTON)
                            .clip(RoundedCornerShape(Radii.md))
                            .clickable(onClickLabel = if (isBack) "Back" else "Close", onClick = onLeading)
                            .semantics { contentDescription = if (isBack) "Back" else "Close" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = if (isBack) PantopusIcon.ChevronLeft else PantopusIcon.X,
                        contentDescription = null,
                        size = 21.dp,
                        tint = PantopusColors.appText,
                    )
                }
            }
            Text(
                text = title,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.align(Alignment.Center),
            )
            if (trailing != null) {
                Box(modifier = Modifier.align(Alignment.CenterEnd), contentAlignment = Alignment.Center) {
                    trailing()
                }
            }
        }
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
    }
}

/** A primary-tinted text button for the top-bar trailing slot ("Save", "Done"). */
@Composable
fun AutoTopBarTextButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    isEnabled: Boolean = true,
) {
    val color = if (isEnabled) PantopusColors.primary600 else PantopusColors.appTextMuted
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .clickable(enabled = isEnabled, onClick = onClick)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        if (icon != null) PantopusIconImage(icon = icon, contentDescription = null, size = ICON_16, tint = color)
        Text(text = title, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = color)
    }
}

// ─── Card + overline ────────────────────────────────────────────────────────

@Composable
fun AutoCard(
    modifier: Modifier = Modifier,
    horizontal: Dp = 13.dp,
    vertical: Dp = Spacing.s1,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = horizontal, vertical = vertical),
    ) {
        content()
    }
}

@Composable
fun AutoOverline(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text.uppercase(),
        fontSize = 10.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.84.sp,
        color = PantopusColors.appTextSecondary,
        modifier = modifier,
    )
}

@Composable
fun AutoRowDivider(modifier: Modifier = Modifier) {
    HorizontalDivider(modifier = modifier, thickness = 1.dp, color = PantopusColors.appBorder)
}

// ─── Tone + note ────────────────────────────────────────────────────────────

enum class AutoTone { Info, Warning, Error, Success, Neutral }

val AutoTone.bg: Color
    get() =
        when (this) {
            AutoTone.Info -> PantopusColors.primary50
            AutoTone.Warning -> PantopusColors.warningBg
            AutoTone.Error -> PantopusColors.errorBg
            AutoTone.Success -> PantopusColors.successBg
            AutoTone.Neutral -> PantopusColors.appSurfaceSunken
        }

val AutoTone.fg: Color
    get() =
        when (this) {
            AutoTone.Info -> PantopusColors.primary700
            AutoTone.Warning -> PantopusColors.warning
            AutoTone.Error -> PantopusColors.error
            AutoTone.Success -> PantopusColors.success
            AutoTone.Neutral -> PantopusColors.appTextStrong
        }

val AutoTone.border: Color
    get() =
        when (this) {
            AutoTone.Info -> PantopusColors.primary100
            AutoTone.Warning -> PantopusColors.warningLight
            AutoTone.Error -> PantopusColors.errorLight
            AutoTone.Success -> PantopusColors.successLight
            AutoTone.Neutral -> PantopusColors.appBorder
        }

/** Semantic-tinted inline callout (paused / push-off / validation hints). */
@Composable
fun AutoNote(
    tone: AutoTone,
    text: String,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(tone.bg)
                .border(1.dp, tone.border, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = 11.dp),
        verticalAlignment = if (trailing == null) Alignment.Top else Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        if (icon != null) {
            PantopusIconImage(icon = icon, contentDescription = null, size = ICON_16, tint = tone.fg)
        }
        Text(
            text = text,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = tone.fg,
            modifier = Modifier.weight(1f),
        )
        if (trailing != null) trailing()
    }
}

// ─── Chips ──────────────────────────────────────────────────────────────────

/** Small uppercase pill chip (channel / status badges). */
@Composable
fun AutoChip(
    text: String,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    tone: AutoTone = AutoTone.Neutral,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(tone.bg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (icon != null) PantopusIconImage(icon = icon, contentDescription = null, size = 10.dp, strokeWidth = 2.6f, tint = tone.fg)
        Text(text = text.uppercase(), fontSize = 9.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.4.sp, color = tone.fg)
    }
}

/** Push / Email selectable channel chip (reminder rows + action picker). */
@Composable
fun AutoChannelChip(
    label: String,
    icon: PantopusIcon,
    isOn: Boolean,
    modifier: Modifier = Modifier,
    isComingSoon: Boolean = false,
    accent: Color = PantopusColors.primary600,
    accentBg: Color = PantopusColors.primary50,
    onTap: (() -> Unit)? = null,
) {
    val foreground =
        when {
            isComingSoon -> PantopusColors.appTextMuted
            isOn -> accent
            else -> PantopusColors.appTextSecondary
        }
    val background = if (isOn) accentBg else PantopusColors.appSurface
    val borderColor = if (isOn) accentBg else PantopusColors.appBorder
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .border(1.dp, borderColor, RoundedCornerShape(Radii.pill))
                .then(if (onTap != null && !isComingSoon) Modifier.clickable(onClick = onTap) else Modifier)
                .heightIn(min = 24.dp)
                .padding(horizontal = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 11.dp, tint = foreground)
        Text(text = label, fontSize = 10.5.sp, fontWeight = if (isOn) FontWeight.Bold else FontWeight.SemiBold, color = foreground)
        if (isComingSoon) {
            Text(text = "Soon", fontSize = 8.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextMuted)
        }
    }
}

// ─── Underline tab strip ────────────────────────────────────────────────────

@Composable
fun AutoUnderlineTabs(
    tabs: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
) {
    Column(modifier = modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3)) {
            tabs.forEachIndexed { idx, tab ->
                val on = idx == selectedIndex
                Column(
                    modifier = Modifier.weight(1f).clickable { onSelect(idx) },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = tab,
                        fontSize = 12.5.sp,
                        fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                        color = if (on) PantopusColors.appText else PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(vertical = 11.dp),
                    )
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(2.dp)
                                .background(if (on) accent else Color.Transparent),
                    )
                }
            }
        }
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
    }
}

// ─── Segmented (pill) ───────────────────────────────────────────────────────

@Composable
fun AutoSegmented(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(9.dp))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        options.forEachIndexed { idx, opt ->
            val on = idx == selectedIndex
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 32.dp)
                        .clip(RoundedCornerShape(7.dp))
                        .background(if (on) PantopusColors.appSurface else Color.Transparent)
                        .clickable { onSelect(idx) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = opt,
                    fontSize = 11.5.sp,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (on) accent else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

// ─── Radio row (trigger lifecycle list) ─────────────────────────────────────

@Composable
fun AutoRadioRow(
    label: String,
    selected: Boolean,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
    sub: String? = null,
    icon: PantopusIcon? = null,
    accent: Color = PantopusColors.primary600,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(onClick = onTap)
                .heightIn(min = 48.dp)
                .padding(vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = ICON_16,
                tint = if (selected) accent else PantopusColors.appTextSecondary,
                modifier = Modifier.widthIn(min = 22.dp),
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, fontSize = 14.5.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appText)
            if (sub != null) {
                Text(text = sub, fontSize = 11.sp, color = PantopusColors.appTextSecondary, modifier = Modifier.padding(top = 1.dp))
            }
        }
        Box(modifier = Modifier.size(22.dp), contentAlignment = Alignment.Center) {
            if (selected) {
                Box(
                    modifier = Modifier.size(22.dp).clip(RoundedCornerShape(Radii.pill)).background(accent),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 12.dp,
                        strokeWidth = 3.2f,
                        tint = PantopusColors.appTextInverse,
                    )
                }
            } else {
                Box(
                    modifier =
                        Modifier
                            .size(22.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .border(1.5.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.pill)),
                )
            }
        }
    }
}

// ─── Stepper ────────────────────────────────────────────────────────────────

@Composable
fun AutoStepper(
    value: Int,
    onDecrement: () -> Unit,
    onIncrement: () -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
    isInvalid: Boolean = false,
    canDecrement: Boolean = true,
    canIncrement: Boolean = true,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        stepButton(
            PantopusIcon.Minus,
            enabled = canDecrement,
            color = PantopusColors.appTextStrong,
            label = "Decrease",
            onClick = onDecrement,
        )
        Text(
            text = "$value",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = if (isInvalid) PantopusColors.error else accent,
            modifier = Modifier.widthIn(min = 34.dp),
        )
        stepButton(PantopusIcon.Plus, enabled = canIncrement, color = accent, label = "Increase", onClick = onIncrement)
    }
}

@Composable
private fun stepButton(
    icon: PantopusIcon,
    enabled: Boolean,
    color: Color,
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .clickable(enabled = enabled, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 12.dp, tint = if (enabled) color else PantopusColors.appTextMuted)
    }
}

// ─── Sheet chrome ───────────────────────────────────────────────────────────

@Composable
fun AutoSheetHeader(
    title: String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    subhead: String? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(text = title, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            if (subhead != null) {
                Text(text = subhead, fontSize = 12.sp, color = PantopusColors.appTextSecondary, lineHeight = 16.sp)
            }
        }
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken)
                    .clickable(onClickLabel = "Close", onClick = onClose),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.X, contentDescription = null, size = ICON_16, tint = PantopusColors.appTextStrong)
        }
    }
}

/** Sticky footer container above the home indicator. */
@Composable
fun AutoSheetFooter(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(modifier = modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
        Box(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3, bottom = Spacing.s5)) {
            content()
        }
    }
}

// ─── Buttons ────────────────────────────────────────────────────────────────

@Composable
fun AutoPrimaryButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    isSaving: Boolean = false,
    isDisabled: Boolean = false,
) {
    val enabled = !isDisabled && !isSaving
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (isDisabled) PantopusColors.appBorderStrong else PantopusColors.primary600)
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            if (!isSaving && icon != null) {
                PantopusIconImage(icon = icon, contentDescription = null, size = ICON_16, tint = PantopusColors.appTextInverse)
            }
            Text(text = title, fontSize = 14.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
        }
    }
}

@Composable
fun AutoGhostButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 40.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (icon != null) PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextStrong)
        Text(text = title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextStrong)
    }
}

/** Outline dashed pill ("Add custom time" / "Insert variable"). */
@Composable
fun AutoDashedChip(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon = PantopusIcon.Plus,
    height: Dp = 34.dp,
    accent: Color = PantopusColors.primary600,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .dashedCapsule(PantopusColors.appBorderStrong)
                .clickable(onClick = onClick)
                .heightIn(min = height)
                .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, strokeWidth = 2.4f, tint = accent)
        Text(text = label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
    }
}

// ─── Icon tile ──────────────────────────────────────────────────────────────

@Composable
fun AutoIconTile(
    icon: PantopusIcon,
    bg: Color,
    fg: Color,
    modifier: Modifier = Modifier,
    size: Dp = TILE_DEFAULT,
    glyph: Dp = 17.dp,
) {
    Box(
        modifier = modifier.size(size).clip(RoundedCornerShape(9.dp)).background(bg),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = glyph, tint = fg)
    }
}

// ─── FAB ────────────────────────────────────────────────────────────────────

@Composable
fun AutoFAB(
    onClick: () -> Unit,
    accessibilityLabel: String,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
) {
    Box(
        modifier =
            modifier
                .size(FAB_SIZE)
                .clip(RoundedCornerShape(Radii.pill))
                .background(accent)
                .clickable(onClickLabel = accessibilityLabel, onClick = onClick)
                .semantics { contentDescription = accessibilityLabel },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Plus,
            contentDescription = null,
            size = 24.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.appTextInverse,
        )
    }
}

// ─── Inline empty + error + skeleton ────────────────────────────────────────

/** Compact centered empty prompt (kept below a pinned card, so not full-bleed). */
@Composable
fun AutoInlineEmpty(
    icon: PantopusIcon,
    headline: String,
    subcopy: String,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
    accentBg: Color = PantopusColors.primary50,
    ctaTitle: String? = null,
    onCta: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = Spacing.s5, vertical = Spacing.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier.size(56.dp).clip(RoundedCornerShape(Radii.pill)).background(accentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 25.dp, strokeWidth = 1.8f, tint = accent)
        }
        Text(text = headline, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text = subcopy,
            fontSize = 11.5.sp,
            color = PantopusColors.appTextSecondary,
            lineHeight = 16.sp,
            modifier = Modifier.widthIn(max = 230.dp),
        )
        if (ctaTitle != null && onCta != null) {
            AutoGhostButton(title = ctaTitle, onClick = onCta, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

/** Full-bleed centered retry surface (cloud-off + Try again). */
@Composable
fun AutoErrorView(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    headline: String = "Couldn't load",
    asCard: Boolean = false,
) {
    Box(
        modifier = modifier.fillMaxSize().background(PantopusColors.appBg).padding(horizontal = Spacing.s5),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier =
                if (asCard) {
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                        .padding(22.dp)
                } else {
                    Modifier.padding(Spacing.s4)
                },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(if (asCard) 48.dp else 56.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.CloudOff,
                    contentDescription = null,
                    size = 23.dp,
                    strokeWidth = 1.8f,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            Text(text = headline, fontSize = if (asCard) 13.5.sp else 15.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            if (!asCard) {
                Text(text = message, fontSize = 12.5.sp, color = PantopusColors.appTextSecondary, modifier = Modifier.widthIn(max = 240.dp))
            }
            if (asCard) {
                Box(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.primary600)
                            .clickable(onClick = onRetry)
                            .padding(horizontal = 18.dp, vertical = 9.dp)
                            .semantics { contentDescription = "Try again" },
                ) {
                    Text(text = "Try again", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
                }
            } else {
                Row(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                            .clickable(onClick = onRetry)
                            .padding(horizontal = Spacing.s4, vertical = 10.dp)
                            .semantics { contentDescription = "Try again" },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.RefreshCw,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.appTextStrong,
                    )
                    Text(text = "Try again", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextStrong)
                }
            }
        }
    }
}

/** Shimmer skeleton row (tile + two bars + optional trailing pill). */
@Composable
fun AutoSkeletonRow(
    modifier: Modifier = Modifier,
    showTrailingPill: Boolean = true,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Shimmer(width = 34.dp, height = 34.dp, cornerRadius = 9.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Shimmer(width = 150.dp, height = 11.dp, cornerRadius = Radii.sm)
            Shimmer(width = 96.dp, height = 9.dp, cornerRadius = Radii.sm)
        }
        if (showTrailingPill) Shimmer(width = 46.dp, height = 28.dp, cornerRadius = Radii.pill)
    }
}

// ─── Text inputs ────────────────────────────────────────────────────────────

/** Single-line form input (subject / name fields). */
@Composable
fun AutoTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 42.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    if (isError) 1.5.dp else 1.dp,
                    if (isError) PantopusColors.error else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.md),
                )
                .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (value.isEmpty()) {
            Text(text = placeholder, fontSize = 14.sp, color = PantopusColors.appTextMuted)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = TextStyle(fontSize = 14.sp, color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.primary600),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** Multi-line message body editor with a placeholder + optional error border. */
@Composable
fun AutoTextEditor(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    minHeight: Dp = 120.dp,
    isError: Boolean = false,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = minHeight)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    if (isError) 1.5.dp else 1.dp,
                    if (isError) PantopusColors.error else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.md),
                )
                .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        if (value.isEmpty()) {
            Text(text = placeholder, fontSize = 14.sp, color = PantopusColors.appTextMuted)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 14.sp, color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.primary600),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

// ─── Toast ──────────────────────────────────────────────────────────────────

/** Dark pill success toast. Drive via an `isShown` flag in the host. */
@Composable
fun AutoToast(
    text: String,
    modifier: Modifier = Modifier,
    icon: PantopusIcon = PantopusIcon.CheckCircle,
    tint: Color = PantopusColors.success,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, strokeWidth = 2.4f, tint = tint)
        Text(text = text, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextInverse)
    }
}
