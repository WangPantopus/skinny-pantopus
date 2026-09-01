@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

// ─────────────────────────────────────────────────────────────────────────────
// Screen chrome
// ─────────────────────────────────────────────────────────────────────────────

// Design: SchedTopBar height 46px, title 15sp — matches SchedulingTopBarSize.Compact.
private val TOP_BAR_HEIGHT = 46.dp
private val ICON_BUTTON_SIZE = 40.dp

/**
 * The A3 top bar: a 40dp back chevron, a centered title, and an optional
 * trailing slot (a "+" add button, a "Save"/"Done" text action, …). Mirrors the
 * design's `TopBar`/`SchedTopBar` primitive.
 */
@Composable
fun AvailabilityTopBar(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    trailing: (@Composable () -> Unit)? = null,
) {
    // Design: SchedTopBar height=46dp, title 15sp/600, 1px bottom border.
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(TOP_BAR_HEIGHT)
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(ICON_BUTTON_SIZE)
                        .clip(CircleShape)
                        .clickable(onClick = onBack),
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
                modifier = Modifier.weight(1f),
                color = PantopusColors.appText,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Box(
                modifier = Modifier.size(ICON_BUTTON_SIZE),
                contentAlignment = Alignment.Center,
            ) {
                trailing?.invoke()
            }
        }
        HorizontalDivider(color = PantopusColors.appBorder, thickness = 1.dp)
    }
}

/** A "Save"/"Done" style text action for the top bar trailing slot. */
@Composable
fun TopBarTextAction(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Text(
        text = label,
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        color = if (enabled) PantopusColors.primary600 else PantopusColors.appTextMuted,
        fontSize = 15.sp,
        fontWeight = FontWeight.Bold,
    )
}

/** A "+" icon action for the top bar trailing slot (add schedule). */
@Composable
fun TopBarAddAction(
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(ICON_BUTTON_SIZE)
                .clip(CircleShape)
                .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Plus,
            contentDescription = contentDescription,
            size = 22.dp,
            tint = PantopusColors.primary600,
        )
    }
}

/** The Personal identity pill (sky), shown beneath the top bar on editor screens. */
@Composable
fun PersonalHeaderPill(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s2)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.personalBg)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.User,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.personal,
        )
        Text(
            text = "PERSONAL",
            color = PantopusColors.personal,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/** A short uppercase overline label in the personal accent. */
@Composable
fun SectionOverline(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = PantopusColors.personal,
) {
    Text(
        text = text.uppercase(),
        modifier = modifier,
        color = color,
        fontSize = 9.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.6.sp,
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cards & rows
// ─────────────────────────────────────────────────────────────────────────────

/** A white card with 1px border, lg-radius, soft shadow, optional pillar overline. */
@Composable
fun A3Card(
    modifier: Modifier = Modifier,
    overline: String? = null,
    trailing: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        if (overline != null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SectionOverline(overline)
                trailing?.invoke()
            }
        }
        content()
    }
}

/** A field label (12sp medium) sitting above an input. */
@Composable
fun FieldLabel(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        modifier = modifier,
        color = PantopusColors.appTextStrong,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
    )
}

private val TOGGLE_WIDTH = 36.dp
private val TOGGLE_HEIGHT = 20.dp
private val TOGGLE_KNOB = 16.dp

/** The design's pill switch — sky when on, neutral when off. */
@Composable
fun A3Toggle(
    on: Boolean,
    onToggle: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val track =
        when {
            !enabled -> PantopusColors.appSurfaceSunken
            on -> PantopusColors.primary600
            else -> PantopusColors.appBorderStrong
        }
    Box(
        modifier =
            modifier
                .size(width = TOGGLE_WIDTH, height = TOGGLE_HEIGHT)
                .clip(RoundedCornerShape(Radii.pill))
                .background(track)
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

/** A leading-icon + label/sub + trailing toggle row (the A14.8 idiom). */
@Composable
fun A3ToggleRow(
    label: String,
    on: Boolean,
    onToggle: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    sub: String? = null,
    enabled: Boolean = true,
    showDivider: Boolean = false,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            if (icon != null) {
                Box(
                    modifier =
                        Modifier
                            .size(30.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(if (on) PantopusColors.primary50 else PantopusColors.appSurfaceSunken),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = icon,
                        contentDescription = null,
                        size = 15.dp,
                        tint = if (on) PantopusColors.primary600 else PantopusColors.appTextSecondary,
                    )
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(label, color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                if (sub != null) {
                    Text(sub, color = PantopusColors.appTextSecondary, fontSize = 11.sp)
                }
            }
            A3Toggle(on = on, onToggle = onToggle, enabled = enabled)
        }
        if (showDivider) RowDivider()
    }
}

/** A link-out row: leading sunken icon tile + label/value + chevron. */
@Composable
fun A3LinkRow(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    value: String? = null,
    showDivider: Boolean = false,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.sm))
                    .clickable(onClick = onClick)
                    .padding(vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(30.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextStrong)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(label, color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                if (value != null) {
                    Text(value, color = PantopusColors.appTextSecondary, fontSize = 11.sp)
                }
            }
            PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
        }
        if (showDivider) RowDivider()
    }
}

/** 1px hairline divider matching the design's inter-row borders. */
@Composable
fun RowDivider(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(PantopusColors.appBorder),
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Controls
// ─────────────────────────────────────────────────────────────────────────────

/** Full-width segmented control; the selected segment floats on white. */
@Composable
fun A3Segmented(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    small: Boolean = false,
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
        options.forEachIndexed { index, option ->
            val on = index == selectedIndex
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(if (small) 28.dp else 32.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(if (on) PantopusColors.appSurface else Color.Transparent)
                        .clickable(enabled = enabled) { onSelect(index) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = option,
                    color = if (on) PantopusColors.primary700 else PantopusColors.appTextSecondary,
                    fontSize = if (small) 11.sp else 11.5.sp,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/** A −/value/+ stepper with an optional unit suffix; outlines red on error. */
@Composable
fun A3Stepper(
    value: String,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
    modifier: Modifier = Modifier,
    unit: String? = null,
    enabled: Boolean = true,
    error: Boolean = false,
) {
    Row(
        modifier =
            modifier
                .height(36.dp)
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, if (error) PantopusColors.error else PantopusColors.appBorder, RoundedCornerShape(Radii.md)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StepperButton(icon = PantopusIcon.Minus, tint = PantopusColors.appTextStrong, enabled = enabled, onClick = onMinus)
        Box(
            modifier = Modifier.width(1.dp).height(36.dp).background(PantopusColors.appBorder),
        )
        Row(
            modifier = Modifier.padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(value, color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            if (unit != null) {
                Text(unit, color = PantopusColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Box(
            modifier = Modifier.width(1.dp).height(36.dp).background(PantopusColors.appBorder),
        )
        StepperButton(icon = PantopusIcon.Plus, tint = PantopusColors.primary600, enabled = enabled, onClick = onPlus)
    }
}

@Composable
private fun StepperButton(
    icon: PantopusIcon,
    tint: Color,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(width = 30.dp, height = 36.dp)
                .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = if (enabled) tint else PantopusColors.appTextMuted)
    }
}

/** A real labeled time-range button (clock · "9:00 AM – 5:00 PM" · chevron) + optional remove. */
@Composable
fun A3TimeRangeButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    removable: Boolean = false,
    onRemove: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier =
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (enabled) PantopusColors.appSurface else PantopusColors.appSurfaceRaised)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .clickable(enabled = enabled, onClick = onClick)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(icon = PantopusIcon.Clock, contentDescription = null, size = 14.dp, tint = PantopusColors.primary600)
            Text(text, modifier = Modifier.weight(1f), color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            PantopusIconImage(icon = PantopusIcon.ChevronDown, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextMuted)
        }
        if (removable && enabled && onRemove != null) {
            Box(
                modifier = Modifier.size(30.dp).clip(CircleShape).clickable(onClick = onRemove),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Remove time range",
                    size = 15.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

/** A field button: leading icon, value, trailing chevron (date / time / repeat pickers). */
@Composable
fun A3FieldButton(
    icon: PantopusIcon,
    value: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    // The generic field button tints its glyph sky (block-time-frames.jsx:106); the
    // timezone card is the exception and draws its globe in fg3 grey
    // (weekly-hours-frames.jsx:44).
    iconTint: Color = PantopusColors.primary600,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(if (enabled) PantopusColors.appSurface else PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = iconTint)
        Text(value, modifier = Modifier.weight(1f), color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        PantopusIconImage(icon = PantopusIcon.ChevronDown, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextMuted)
    }
}

/** An inline "+ Add a block"-style text affordance in the personal accent. */
@Composable
fun A3InlineAddButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.sm))
                .clickable(enabled = enabled, onClick = onClick)
                .padding(vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Plus,
            contentDescription = null,
            size = 13.dp,
            tint = if (enabled) PantopusColors.primary600 else PantopusColors.appTextMuted,
        )
        Text(
            label,
            color = if (enabled) PantopusColors.primary600 else PantopusColors.appTextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

private val CTA_HEIGHT = 44.dp

/** A full-width primary CTA button (sky), with an optional leading icon. */
@Composable
fun A3PrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    enabled: Boolean = true,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(CTA_HEIGHT)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (enabled) PantopusColors.primary600 else PantopusColors.appBorderStrong)
                .clickable(enabled = enabled, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 17.dp, tint = PantopusColors.appTextInverse)
            Spacer(Modifier.width(Spacing.s2))
        }
        Text(label, color = PantopusColors.appTextInverse, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

/** A secondary quick-default button (sky-tinted, e.g. "Use 9–5, Mon–Fri"). */
@Composable
fun A3SecondaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(42.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = PantopusColors.primary700)
            Spacer(Modifier.width(Spacing.s2))
        }
        Text(label, color = PantopusColors.primary700, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

/** Sticky bottom save bar: a full-width primary CTA, or a "Saving…" shimmer. */
@Composable
fun A3SaveBar(
    label: String,
    onSave: () -> Unit,
    modifier: Modifier = Modifier,
    saving: Boolean = false,
    enabled: Boolean = true,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s2, bottom = Spacing.s4),
    ) {
        RowDivider(modifier = Modifier.padding(bottom = Spacing.s2))
        if (saving) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(CTA_HEIGHT)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                Text("Saving…", color = PantopusColors.appTextMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        } else {
            A3PrimaryButton(label = label, onClick = onSave, enabled = enabled)
        }
    }
}

/** The filled sky "Default" pill on the schedule rows. */
@Composable
fun DefaultPill(modifier: Modifier = Modifier) {
    Text(
        text = "DEFAULT",
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary600)
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
        color = PantopusColors.appTextInverse,
        fontSize = 9.sp,
        fontWeight = FontWeight.Bold,
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic state cards
// ─────────────────────────────────────────────────────────────────────────────

/** An amber warning card (icon + title + body + optional action slot). */
@Composable
fun A3WarningCard(
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    action: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PantopusIconImage(icon = PantopusIcon.TriangleAlert, contentDescription = null, size = 17.dp, tint = PantopusColors.warning)
            Column(modifier = Modifier.weight(1f)) {
                // Design WarningCard (weekly-hours-frames.jsx:209-210): amber-800 title
                // over an amber-900 body — the amber-600 [warning] stays on the glyph.
                Text(title, color = PantopusColors.warningStrong, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Text(body, color = PantopusColors.warningDeep, fontSize = 11.5.sp)
            }
        }
        action?.invoke()
    }
}

/** A blue explainer card (icon tile + title + body) — the composition-gap card. */
@Composable
fun A3InfoCard(
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    icon: PantopusIcon = PantopusIcon.CalendarClock,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.primary100),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = PantopusColors.primary700)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Text(body, color = PantopusColors.appTextStrong, fontSize = 11.5.sp)
        }
    }
}

/** The chip-led booking-overlap warning (B9), with an optional "View booking" link. */
@Composable
fun A3ConflictCard(
    message: String,
    modifier: Modifier = Modifier,
    onViewBooking: (() -> Unit)? = null,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.warning)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.TriangleAlert,
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.appTextInverse,
            )
            // Canonical source string is sentence-case "Booking overlap" (design +
            // iOS); the overline style uppercases it for display.
            Text(
                "Booking overlap".uppercase(),
                color = PantopusColors.appTextInverse,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.4.sp,
            )
        }
        Text(message, color = PantopusColors.appTextStrong, fontSize = 12.sp)
        if (onViewBooking != null) {
            Row(
                modifier = Modifier.clip(RoundedCornerShape(Radii.sm)).clickable(onClick = onViewBooking),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(icon = PantopusIcon.ArrowUpRight, contentDescription = null, size = 13.dp, tint = PantopusColors.warning)
                Text("View booking", color = PantopusColors.warning, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/**
 * The block-off sheet's "Saving…" bar (`block-time-frames.jsx:82-85`): a 24dp
 * shimmering track with the centred label, shown in place of the lock footnote
 * while the write is in flight.
 */
@Composable
fun A3SavingFootnoteBar(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 24.dp, cornerRadius = Radii.md)
        Text("Saving…", color = PantopusColors.appTextMuted, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** A footnote line with a small leading lock icon (block-off privacy note). */
@Composable
fun A3LockFootnote(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 12.dp, tint = PantopusColors.appTextMuted)
        Text(text, color = PantopusColors.appTextSecondary, fontSize = 10.5.sp)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton (matches the schedule-row geometry)
// ─────────────────────────────────────────────────────────────────────────────

/** A shimmering schedule-row skeleton: icon block + two text lines. */
@Composable
fun ScheduleSkeletonRow(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        app.pantopus.android.ui.components.Shimmer(width = 36.dp, height = 36.dp, cornerRadius = Radii.md)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            app.pantopus.android.ui.components.Shimmer(width = 140.dp, height = 12.dp, cornerRadius = Radii.xs)
            app.pantopus.android.ui.components.Shimmer(width = 200.dp, height = 10.dp, cornerRadius = Radii.xs)
        }
    }
}
