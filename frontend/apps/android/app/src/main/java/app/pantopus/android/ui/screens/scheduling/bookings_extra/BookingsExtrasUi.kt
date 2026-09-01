@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)
@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

// ─── Spec-exact type styles ────────────────────────────────────────────────
//
// The Calendarly Extras frames specify point sizes (16.5 / 13 / 12.5 / 12 / 11)
// that fall between the coarse [PantopusTextStyle] ramp steps. These mirror the
// designer-supplied JSX values 1:1 (the per-frame inlining the iOS port uses).

internal object ExtrasType {
    /** Sheet/dialog header — JSX 16.5/700 -0.2 letterSpacing. */
    val header = TextStyle(fontWeight = FontWeight.Bold, fontSize = 16.5.sp, lineHeight = 22.sp)

    /** Body copy / dialog message — JSX 13/lineHeight 19, fg2. */
    val body13 = TextStyle(fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 19.sp)

    /** Composer / placeholder / toggle label — JSX 12.5. */
    val body125 = TextStyle(fontWeight = FontWeight.Normal, fontSize = 12.5.sp, lineHeight = 18.sp)

    /** Chip label — JSX 12/700. */
    val chip = TextStyle(fontWeight = FontWeight.Bold, fontSize = 12.sp, lineHeight = 16.sp)

    /** Char counter — JSX 10/700. */
    val counter = TextStyle(fontWeight = FontWeight.Bold, fontSize = 10.sp, lineHeight = 12.sp)

    /** Capacity-card headline — JSX 14/700. */
    val body14Bold = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp, lineHeight = 20.sp)

    /** Capacity stat value — JSX 17/800 tabular. */
    val statValue = TextStyle(fontWeight = FontWeight.Black, fontSize = 17.sp, lineHeight = 20.sp)

    /** Roster row name — JSX 13/700. */
    val rowName = TextStyle(fontWeight = FontWeight.Bold, fontSize = 13.sp, lineHeight = 17.sp)

    /** Footer / empty-state CTA label — JSX 14.5/700. */
    val cta = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.5.sp, lineHeight = 18.sp)

    /** Sub/detail copy — JSX 11/fg3. */
    val detail11 = TextStyle(fontWeight = FontWeight.Normal, fontSize = 11.sp, lineHeight = 15.sp)

    /** Member-availability / no-recipients note — JSX 11.5/600. */
    val note115 = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 11.5.sp, lineHeight = 16.sp)
}

// ─── Section overline ──────────────────────────────────────────────────────

@Composable
internal fun ExtrasOverline(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text.uppercase(),
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextSecondary,
        modifier = modifier,
    )
}

// ─── Icon disc (confirmation/dialog halo) ──────────────────────────────────

private val DISC_SIZE = 40.dp
private val DISC_ICON = 20.dp

@Composable
internal fun ExtrasIconDisc(
    icon: PantopusIcon,
    tint: Color,
    background: Color,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.size(DISC_SIZE).clip(CircleShape).background(background),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = DISC_ICON, tint = tint)
    }
}

// ─── Inline error line ─────────────────────────────────────────────────────

@Composable
internal fun ExtrasInlineError(
    message: String,
    modifier: Modifier = Modifier,
    centered: Boolean = false,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = if (centered) Arrangement.Center else Arrangement.Start,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.error,
            modifier = Modifier.padding(end = Spacing.s1),
        )
        Text(text = message, style = PantopusTextStyle.caption, color = PantopusColors.error)
    }
}

// ─── Pill chip (single/multi select) ───────────────────────────────────────

@Composable
internal fun ExtrasPillChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
    showDot: Boolean = false,
    enabled: Boolean = true,
) {
    // Spec selected chip is borderless on a light identity-bg fill (JSX
    // `background:ID.{pillar}.bg`, `border:none`); unselected keeps the hairline.
    val bg = if (selected) accent.copy(alpha = SELECTED_CHIP_ALPHA) else PantopusColors.appSurface
    val textColor =
        when {
            !enabled -> PantopusColors.appTextMuted
            selected -> accent
            else -> PantopusColors.appTextStrong
        }
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .then(
                    if (selected) {
                        Modifier
                    } else {
                        Modifier.border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.pill))
                    },
                )
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (showDot && selected) {
            Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(accent))
        }
        Text(text = label, style = ExtrasType.chip, color = textColor)
    }
}

// ─── Removable active-filter chip ──────────────────────────────────────────

@Composable
internal fun ExtrasRemovableChip(
    label: String,
    accent: Color,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(accent.copy(alpha = SELECTED_CHIP_ALPHA))
                .clickable(onClickLabel = "Remove $label", onClick = onRemove)
                .padding(start = Spacing.s3, end = Spacing.s2, top = Spacing.s1, bottom = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(text = label, style = PantopusTextStyle.small, fontWeight = FontWeight.SemiBold, color = accent)
        PantopusIconImage(icon = PantopusIcon.X, contentDescription = null, size = 13.dp, tint = accent)
    }
}

// ─── Outlined chip button ("Use a template", "Send rebook link") ───────────

@Composable
internal fun ExtrasChipButton(
    label: String,
    icon: PantopusIcon,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
    enabled: Boolean = true,
) {
    val tint = if (enabled) accent else PantopusColors.appTextMuted
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(
                    BorderStroke(1.dp, if (enabled) accent.copy(alpha = CHIP_BORDER_ALPHA) else PantopusColors.appBorder),
                    RoundedCornerShape(Radii.pill),
                )
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, tint = tint)
        Text(text = label, style = ExtrasType.chip, color = tint)
    }
}

// ─── Channel toggle row (Push / Email) ─────────────────────────────────────

@Composable
internal fun ExtrasChannelRow(
    icon: PantopusIcon,
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
    subtitle: String? = null,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 17.dp, tint = PantopusColors.appTextStrong)
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, style = ExtrasType.body125, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            if (subtitle != null) {
                Text(text = subtitle, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = PantopusColors.appTextInverse,
                    checkedTrackColor = accent,
                    uncheckedTrackColor = PantopusColors.appSurfaceSunken,
                    uncheckedBorderColor = PantopusColors.appBorderStrong,
                ),
        )
    }
}

// ─── Message box with optional character counter ───────────────────────────

@Composable
internal fun ExtrasMessageBox(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
    minHeight: androidx.compose.ui.unit.Dp = 96.dp,
    limit: Int? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    val over = limit != null && value.length > limit
    // Over-limit box border is the lighter error tone (JSX ERR_LIGHT); only the
    // counter text turns full error red.
    val border = if (over) PantopusColors.errorLight else PantopusColors.appBorder
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(BorderStroke(1.dp, border), RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
    ) {
        Box(modifier = Modifier.fillMaxWidth().heightIn(min = minHeight)) {
            if (value.isEmpty()) {
                Text(text = placeholder, style = ExtrasType.body125, color = PantopusColors.appTextMuted)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                modifier = Modifier.fillMaxWidth(),
                textStyle = ExtrasType.body125.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(accent),
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            )
        }
        if (limit != null) {
            Text(
                text = "${value.length}/$limit",
                style = ExtrasType.counter,
                color = if (over) PantopusColors.error else PantopusColors.appTextMuted,
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1),
                textAlign = TextAlign.End,
            )
        }
    }
}

// ─── Single-line labelled input field ──────────────────────────────────────

@Composable
internal fun ExtrasInputField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    leadingIcon: PantopusIcon,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = leadingIcon, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
        Box(modifier = Modifier.weight(1f)) {
            if (value.isEmpty()) {
                Text(text = placeholder, style = ExtrasType.body125, color = PantopusColors.appTextMuted)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                textStyle = ExtrasType.body125.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(accent),
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            )
        }
    }
}

// ─── Initials avatar (optional verified badge) ─────────────────────────────

/**
 * Roster/waitlist avatar. The design fills every roster avatar with the owner
 * identity accent (JSX `AV.business` gradient → flat accent here, matching iOS
 * `RosterRow`) and stamps a lucide `badge-check` tinted in that same accent for
 * verified members — not a per-name hashed palette / green check.
 */
@Composable
internal fun InitialsAvatar(
    name: String?,
    modifier: Modifier = Modifier,
    diameter: androidx.compose.ui.unit.Dp = 40.dp,
    verified: Boolean = false,
    accent: Color = PantopusColors.business,
) {
    Box(modifier = modifier.size(diameter), contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier.size(diameter).clip(CircleShape).background(accent),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = BookingsExtrasFormatting.initials(name),
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        if (verified) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .size(15.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurface),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.BadgeCheck, contentDescription = null, size = 14.dp, tint = accent)
            }
        }
    }
}

// ─── Status chip (Confirmed / Pending / …) ─────────────────────────────────

/**
 * Booking status chip — delegates to the shared [SchedulingStatusPill] primitive.
 * Kept as a thin wrapper so call sites in this package keep the same signature.
 * Normalises the two legacy wire aliases ("going" → confirmed, "waiting" →
 * waitlisted) the primitive does not yet alias, then hands off to the
 * tolerant string overload. A null/blank status falls through to the
 * primitive's neutral "Status" fallback.
 */
@Composable
internal fun StatusChip(
    status: String?,
    modifier: Modifier = Modifier,
) {
    val wire =
        when (status) {
            "going" -> "confirmed"
            "waiting" -> "waitlisted"
            else -> status.orEmpty()
        }
    SchedulingStatusPill(status = wire, modifier = modifier)
}

// ─── Solid CTA with a leading icon (Send to 12 / Share link / Join waitlist) ─

private val CTA_HEIGHT = 48.dp

/**
 * The design's sticky-footer / empty-state CTA: a 48dp filled button with a
 * leading lucide glyph and a 14.5/700 label, on the brand primary (or a
 * caller-supplied accent). Disabled state drops to the sunken fill + muted
 * text. [PantopusButton] can't carry a leading icon, so the Extras frames
 * render this inline.
 */
@Composable
internal fun ExtrasIconLabelButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    val bg = if (enabled) accent else PantopusColors.appSurfaceSunken
    val fg = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted
    Row(
        modifier =
            modifier
                .heightIn(min = CTA_HEIGHT)
                .clip(RoundedCornerShape(Radii.lg))
                .background(bg)
                .clickable(enabled = enabled && !loading, onClickLabel = label, onClick = onClick)
                .padding(horizontal = Spacing.s4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 17.dp,
            tint = fg,
            modifier = Modifier.padding(end = Spacing.s2),
        )
        Text(text = label, style = ExtrasType.cta, color = fg)
    }
}

// ─── A wrapping row of chips ────────────────────────────────────────────────

@Composable
internal fun ExtrasChipFlow(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        content()
    }
}

private const val SELECTED_CHIP_ALPHA = 0.12f
private const val CHIP_BORDER_ALPHA = 0.5f
