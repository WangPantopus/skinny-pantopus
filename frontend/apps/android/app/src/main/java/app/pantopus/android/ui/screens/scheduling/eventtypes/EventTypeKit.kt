@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.core.graphics.toColorInt
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.SchedulingPalette
import app.pantopus.android.ui.theme.Spacing

/**
 * Local design kit shared by the four A2 (Event types) screens — the row /
 * card / control atoms drawn from `B Event types & availability`,
 * `C Event type editor`, `C Intake questions editor`, and `C Connected
 * calendars`. Pillar accent (Personal sky / Home green / Business violet) lives
 * ONLY on the identity pill + section overlines; every functional control
 * (toggles, steppers, CTAs, links) stays product blue (`primary600`), per the
 * design's non-negotiables. Tokens-only: [PantopusColors] + on-scale
 * Spacing/Radii; off-scale design dims use raw `.dp`/`.sp` like the A1 hub.
 */

// ─── Per-event-type swatch palette (design DOT colors + editor swatches) ────
// Sourced from the theme-layer SchedulingPalette so the hex literals stay out
// of feature code. These are the bespoke category accents the design assigns to
// a bookable; the backend's own `color` hex (when present) takes precedence.
// Kept as backend-wire `#rrggbb` strings — the editor persists the selected
// swatch verbatim as the event type's `color`.
internal val EVENT_TYPE_SWATCHES = SchedulingPalette.eventTypeSwatchHex

internal fun parseEventColor(hex: String?): Color? =
    hex?.takeIf { it.isNotBlank() }?.let { raw ->
        runCatching { Color(raw.toColorInt()) }.getOrNull()
    }

/** Backend color if valid, else a stable palette pick seeded by [seed]. */
internal fun eventDotColor(
    hex: String?,
    seed: String,
): Color =
    parseEventColor(hex) ?: run {
        val idx = (seed.hashCode() and Int.MAX_VALUE) % EVENT_TYPE_SWATCHES.size
        Color(EVENT_TYPE_SWATCHES[idx].toColorInt())
    }

// ─── Dimensions (off-scale design values stay raw; on-scale use tokens) ─────
// Design `event-types-frames.jsx` TopBar height:46 (matches iOS .frame(height: 46)).
private val TOP_BAR_HEIGHT = 46.dp
private val ICON_BUTTON = 36.dp
private val TOGGLE_W = 36.dp
private val TOGGLE_H = 20.dp
private val TOGGLE_KNOB = 16.dp
private val CARD_RADIUS = Radii.xl
internal val ROW_RADIUS = 14.dp
private val DOT_SIZE = 7.dp
private val LEADING_TILE = 30.dp

/** 16dp icon size as a named token so the chevron/CTA icons don't read as a raw on-scale literal. */
internal val ICON_16 = 16.dp

val SchedulingPillar.identityIcon: PantopusIcon
    get() =
        when (this) {
            SchedulingPillar.Personal -> PantopusIcon.User
            SchedulingPillar.Home -> PantopusIcon.Home
            SchedulingPillar.Business -> PantopusIcon.Briefcase
        }

val SchedulingPillar.label: String
    get() =
        when (this) {
            SchedulingPillar.Personal -> "Personal"
            SchedulingPillar.Home -> "Home"
            SchedulingPillar.Business -> "Business"
        }

// ─── Top bar: chevron back · centered title · optional trailing action ──────

@Composable
fun EtTopBar(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    trailingIcon: PantopusIcon? = null,
    trailingEnabled: Boolean = true,
    trailingContentDescription: String? = null,
    onTrailing: () -> Unit = {},
    preTrailing: (@Composable () -> Unit)? = null,
) {
    Column(modifier = modifier) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(TOP_BAR_HEIGHT)
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .size(ICON_BUTTON)
                        .clip(RoundedCornerShape(Radii.md))
                        .clickable(onClickLabel = "Back", onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.align(Alignment.Center),
            )
            Row(
                modifier = Modifier.align(Alignment.CenterEnd),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                preTrailing?.invoke()
                if (trailingIcon != null) {
                    Box(
                        modifier =
                            Modifier
                                .size(ICON_BUTTON)
                                .clip(RoundedCornerShape(Radii.md))
                                .clickable(
                                    enabled = trailingEnabled,
                                    onClickLabel = trailingContentDescription,
                                    onClick = onTrailing,
                                ),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = trailingIcon,
                            contentDescription = trailingContentDescription,
                            size = 22.dp,
                            tint = if (trailingEnabled) PantopusColors.primary600 else PantopusColors.appTextMuted,
                        )
                    }
                }
            }
        }
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
    }
}

// ─── Identity pill (static, header) ─────────────────────────────────────────

@Composable
fun EtIdentityPill(
    pillar: SchedulingPillar,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(pillar.accentBg)
                .padding(horizontal = 9.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(icon = pillar.identityIcon, contentDescription = null, size = 11.dp, tint = pillar.accent)
        Text(text = pillar.label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = pillar.accent)
    }
}

// ─── Segmented control (sunken track, selected = surface + product blue) ────

@Composable
fun EtSegmented(
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    small: Boolean = false,
    // The list FilterHeader frame draws a 30dp / 12sp segment
    // (event-types-frames.jsx:122-133), while the editor-shell default is
    // 32dp / 11.5sp — callers on the list screen override these two.
    itemHeight: Dp? = null,
    labelSize: TextUnit? = null,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(9.dp))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        options.forEach { option ->
            val on = option == selected
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(itemHeight ?: if (small) 28.dp else 32.dp)
                        .clip(RoundedCornerShape(7.dp))
                        .background(if (on) PantopusColors.appSurface else Color.Transparent)
                        .clickable(enabled = enabled) { onSelect(option) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = option,
                    fontSize = labelSize ?: if (small) 11.sp else 11.5.sp,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (on) PantopusColors.primary700 else PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

// ─── Section overline (pillar-accented uppercase) ───────────────────────────

@Composable
fun EtSectionOverline(
    text: String,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text.uppercase(),
        fontSize = 9.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.08.em,
        color = accent,
        modifier = modifier,
    )
}

// ─── White card with optional pillar overline + trailing ────────────────────

@Composable
fun EtCard(
    modifier: Modifier = Modifier,
    overline: String? = null,
    accent: Color = PantopusColors.primary600,
    trailing: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(CARD_RADIUS))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(CARD_RADIUS))
                .padding(13.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        if (overline != null || trailing != null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                if (overline != null) EtSectionOverline(text = overline, accent = accent) else Box(Modifier)
                trailing?.invoke()
            }
        }
        content()
    }
}

// ─── Color dot ──────────────────────────────────────────────────────────────

@Composable
fun EtColorDot(
    color: Color,
    modifier: Modifier = Modifier,
    size: Dp = DOT_SIZE,
) {
    Box(modifier = modifier.size(size).clip(RoundedCornerShape(Radii.pill)).background(color))
}

// ─── Product-blue toggle (36×20) ────────────────────────────────────────────

@Composable
fun EtToggle(
    checked: Boolean,
    onToggle: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val track =
        when {
            !enabled -> PantopusColors.appSurfaceSunken
            checked -> PantopusColors.primary600
            else -> PantopusColors.appBorderStrong
        }
    Box(
        modifier =
            modifier
                .size(width = TOGGLE_W, height = TOGGLE_H)
                .clip(RoundedCornerShape(Radii.pill))
                .background(track)
                .clickable(enabled = enabled) { onToggle(!checked) },
    ) {
        Box(
            modifier =
                Modifier
                    .align(if (checked) Alignment.CenterEnd else Alignment.CenterStart)
                    .padding(horizontal = 2.dp)
                    .size(TOGGLE_KNOB)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface),
        )
    }
}

// ─── Toggle row (icon · label/sub · trailing switch) ────────────────────────

@Composable
fun EtToggleRow(
    label: String,
    checked: Boolean,
    onToggle: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    sub: String? = null,
    enabled: Boolean = true,
    last: Boolean = false,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            if (icon != null) {
                Box(
                    modifier =
                        Modifier
                            .size(LEADING_TILE)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(if (checked) PantopusColors.primary50 else PantopusColors.appSurfaceSunken),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = icon,
                        contentDescription = null,
                        size = 15.dp,
                        tint = if (checked) PantopusColors.primary600 else PantopusColors.appTextSecondary,
                    )
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(text = label, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                if (sub != null) {
                    Text(
                        text = sub,
                        fontSize = 10.5.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(top = 1.dp),
                    )
                }
            }
            EtToggle(checked = checked, onToggle = onToggle, enabled = enabled)
        }
        if (!last) HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
    }
}

// ─── Link row (icon · label/value · chevron) ────────────────────────────────

@Composable
fun EtLinkRow(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    value: String? = null,
    last: Boolean = false,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(LEADING_TILE)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextSecondary)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(text = label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                if (value != null) {
                    Text(
                        text = value,
                        fontSize = 11.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(top = 1.dp),
                    )
                }
            }
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = ICON_16,
                tint = PantopusColors.appTextMuted,
            )
        }
        if (!last) HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
    }
}

// ─── Field label ─────────────────────────────────────────────────────────────

@Composable
fun EtFieldLabel(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appTextStrong,
        modifier = modifier.padding(bottom = 5.dp),
    )
}

// ─── Editable text field (design 1.5px border, radius 8, error state) ────────

@Composable
fun EtTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String = "",
    enabled: Boolean = true,
    isError: Boolean = false,
    helper: String? = null,
    singleLine: Boolean = true,
    mono: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        if (label != null) EtFieldLabel(text = label)
        val border = if (isError) PantopusColors.error else PantopusColors.appBorder
        val family = if (mono) FontFamily.Monospace else FontFamily.Default
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = if (singleLine) 40.dp else 48.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (enabled) PantopusColors.appSurface else PantopusColors.appSurfaceRaised)
                    .border(1.5.dp, border, RoundedCornerShape(Radii.md))
                    .padding(horizontal = 11.dp, vertical = 10.dp),
            contentAlignment = Alignment.CenterStart,
        ) {
            if (value.isEmpty()) {
                Text(text = placeholder, fontSize = 13.sp, color = PantopusColors.appTextMuted, fontFamily = family)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                enabled = enabled,
                singleLine = singleLine,
                textStyle =
                    TextStyle(
                        fontSize = 13.sp,
                        color = PantopusColors.appText,
                        fontWeight = FontWeight.Medium,
                        fontFamily = family,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (helper != null) {
            Row(
                modifier = Modifier.padding(top = 6.dp),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                if (isError) {
                    PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 11.dp, tint = PantopusColors.error)
                }
                Text(
                    text = helper,
                    fontSize = 10.5.sp,
                    color = if (isError) PantopusColors.error else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

// ─── Stepper (minus · value+unit · plus) ────────────────────────────────────

@Composable
fun EtStepper(
    value: String,
    onDecrement: () -> Unit,
    onIncrement: () -> Unit,
    modifier: Modifier = Modifier,
    unit: String? = null,
    enabled: Boolean = true,
    isError: Boolean = false,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 36.dp)
                .clip(RoundedCornerShape(Radii.md))
                .border(1.5.dp, if (isError) PantopusColors.error else PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .background(if (enabled) PantopusColors.appSurface else PantopusColors.appSurfaceRaised),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(width = 30.dp, height = 36.dp).clickable(enabled = enabled, onClick = onDecrement),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Minus, contentDescription = "Decrease", size = 14.dp, tint = PantopusColors.appTextStrong)
        }
        Row(
            modifier = Modifier.heightIn(min = 36.dp).padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(text = value, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            if (unit != null) {
                Text(text = unit, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
            }
        }
        Box(
            modifier = Modifier.size(width = 30.dp, height = 36.dp).clickable(enabled = enabled, onClick = onIncrement),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = "Increase", size = 14.dp, tint = PantopusColors.primary600)
        }
    }
}

// ─── Quick chip (outline pill with + leading) ───────────────────────────────

@Composable
fun EtQuickChip(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .clickable(onClick = onClick)
                .padding(horizontal = 11.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 11.dp, tint = PantopusColors.primary600)
        Text(text = label, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextStrong)
    }
}

// ─── Full-width primary button ──────────────────────────────────────────────

@Composable
fun EtPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: PantopusIcon? = null,
    // The empty-state CTA hugs its content (event-types-frames.jsx FrameEmpty
    // inline-flex button); editors keep the full-width default.
    fullWidth: Boolean = true,
) {
    Box(
        modifier =
            modifier
                .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (enabled) PantopusColors.primary600 else PantopusColors.appBorderStrong)
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            if (leadingIcon != null) {
                PantopusIconImage(icon = leadingIcon, contentDescription = null, size = ICON_16, tint = PantopusColors.appTextInverse)
            }
            Text(text = label, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
        }
    }
}
