@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.bookingpage

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillStatus
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale

/** Public booking-page URL helpers — the display + shareable forms the design uses. */
object BookingLinkUrls {
    const val PUBLIC_HOST = "pantopus.com"
    const val DISPLAY_PREFIX = "$PUBLIC_HOST/book/"

    fun display(slug: String): String = "$DISPLAY_PREFIX$slug"

    fun shareable(slug: String): String = "https://$DISPLAY_PREFIX$slug"

    /** [path] is the backend `/book/o/{token}` form from the one-off response. */
    fun shareableFromPath(path: String): String = "https://$PUBLIC_HOST${if (path.startsWith("/")) path else "/$path"}"
}

private val MONO = FontFamily.Monospace

// ─── Top bar (back · centered title) ────────────────────────────────────────
// Design: booking-link-frames.jsx renders <TopBar title="Booking link"/> with
// no trailing action slot in all 7 frames. Save lives solely in BLSaveBar.

@Composable
internal fun BLTopBar(
    title: String,
    onBack: () -> Unit,
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().height(46.dp).background(PantopusColors.appSurface).padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .clickable(onClickLabel = "Back", onClick = onBack)
                        .testTag("blTopBarBack"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.ChevronLeft, contentDescription = "Back", size = 20.dp, tint = PantopusColors.appText)
            }
            Text(
                title,
                color = PantopusColors.appText,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                modifier = Modifier.weight(1f),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            // Symmetry spacer to keep title visually centred (same width as back button).
            Box(modifier = Modifier.size(32.dp))
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

// ─── Header pill (pillar identity chip) ─────────────────────────────────────

@Composable
internal fun BLHeaderPill(pillar: SchedulingPillar) {
    val (label, icon) =
        when (pillar) {
            SchedulingPillar.Business -> "Business" to PantopusIcon.Briefcase
            SchedulingPillar.Home -> "Home" to PantopusIcon.Home
            SchedulingPillar.Personal -> "Personal" to PantopusIcon.User
        }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(pillar.accentBg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 11.dp, tint = pillar.accent)
        Text(label.uppercase(Locale.US), color = pillar.accent, fontWeight = FontWeight.Bold, fontSize = 10.sp)
    }
}

// ─── White card with a pillar-colored overline ──────────────────────────────

@Composable
internal fun BLCard(
    pillar: SchedulingPillar,
    modifier: Modifier = Modifier,
    overline: String? = null,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(13.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        if (overline != null) {
            Text(
                overline.uppercase(Locale.US),
                color = pillar.accent,
                fontWeight = FontWeight.Bold,
                fontSize = 9.5.sp,
                letterSpacing = 0.08.sp,
            )
        }
        content()
    }
}

// ─── Toggle switch + toggle row ─────────────────────────────────────────────

@Composable
internal fun BLToggle(
    on: Boolean,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onToggle: (() -> Unit)? = null,
) {
    val track =
        if (!enabled) {
            PantopusColors.appSurfaceSunken
        } else if (on) {
            PantopusColors.primary600
        } else {
            PantopusColors.appBorderStrong
        }
    Box(
        modifier =
            modifier
                .size(width = 36.dp, height = 20.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(track)
                .then(if (onToggle != null && enabled) Modifier.clickable(onClick = onToggle) else Modifier),
        contentAlignment = if (on) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(
            modifier =
                Modifier
                    .padding(horizontal = 2.dp)
                    .size(16.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface),
        )
    }
}

@Composable
internal fun BLToggleRow(
    label: String,
    on: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    sub: String? = null,
    enabled: Boolean = true,
    last: Boolean = false,
) {
    Row(
        modifier = modifier.fillMaxWidth().heightIn(min = 44.dp).padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
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
        Column(Modifier.weight(1f)) {
            Text(label, color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
            sub?.let { Text(it, color = PantopusColors.appTextSecondary, fontSize = 10.5.sp, modifier = Modifier.padding(top = 1.dp)) }
        }
        BLToggle(on = on, enabled = enabled, onToggle = onToggle, modifier = Modifier.testTag("blToggle_$label"))
    }
    if (!last) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
    }
}

// ─── Bordered editable text field ───────────────────────────────────────────

@Composable
internal fun BLTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    enabled: Boolean = true,
    multiline: Boolean = false,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            label,
            color = PantopusColors.appTextStrong,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp,
            modifier = Modifier.padding(bottom = Spacing.s1),
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (enabled) PantopusColors.appSurface else PantopusColors.appSurfaceRaised)
                    .border(1.5.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .heightIn(min = if (multiline) 48.dp else 0.dp)
                    .padding(horizontal = 11.dp, vertical = 10.dp),
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                enabled = enabled,
                singleLine = !multiline,
                textStyle =
                    androidx.compose.ui.text.TextStyle(
                        color = PantopusColors.appText,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier = Modifier.fillMaxWidth().testTag("blField_$label"),
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(placeholder, color = PantopusColors.appTextMuted, fontSize = 13.sp)
                    }
                    inner()
                },
            )
        }
    }
}

// ─── Segmented control (Listed / Link-only) ─────────────────────────────────

@Composable
internal fun BLSegmented(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth().clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken).padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        options.forEachIndexed { index, option ->
            val active = index == selectedIndex
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(32.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(if (active) PantopusColors.appSurface else Color.Transparent)
                        .clickable { onSelect(index) }
                        .testTag("blSeg_$option"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    option,
                    color = if (active) accent else PantopusColors.appTextSecondary,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                    fontSize = 11.5.sp,
                )
            }
        }
    }
}

// ─── Booking-page status → shared status pill ────────────────────────────────

/**
 * Maps the local [PageStatus] (Draft / Live / Paused) onto the canonical
 * [SchedulingPillStatus] so booking-page status renders through the shared
 * [SchedulingStatusPill] primitive. The design (and iOS `BookingPageSupport`)
 * label the live page **"Live"**, so it maps to [SchedulingPillStatus.Live].
 */
internal fun PageStatus.toPillStatus(): SchedulingPillStatus =
    when (this) {
        PageStatus.Live -> SchedulingPillStatus.Live
        PageStatus.Paused -> SchedulingPillStatus.Paused
        PageStatus.Draft -> SchedulingPillStatus.Draft
    }

// ─── Amber inline warning note ──────────────────────────────────────────────

@Composable
internal fun WarningNote(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.md))
                .padding(horizontal = 11.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.TriangleAlert, contentDescription = null, size = 14.dp, tint = PantopusColors.warning)
        Text(text, color = PantopusColors.warning, fontSize = 11.5.sp, fontWeight = FontWeight.Medium, lineHeight = 16.sp)
    }
}

// ─── Link-out row (icon · label · value · chevron) ──────────────────────────

@Composable
internal fun LinkRowItem(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    value: String? = null,
    last: Boolean = false,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .heightIn(min = 44.dp)
                .padding(vertical = 11.dp)
                .testTag("blLink_$label"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextStrong)
        }
        Column(Modifier.weight(1f)) {
            Text(label, color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            value?.let { Text(it, color = PantopusColors.appTextSecondary, fontSize = 11.sp, modifier = Modifier.padding(top = 1.dp)) }
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
    if (!last) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
    }
}

// ─── Footer action buttons (Copy · Share · View QR) ─────────────────────────

@Composable
internal fun RowScopeFooterAction(
    icon: PantopusIcon,
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .height(40.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier)
                .padding(horizontal = Spacing.s2)
                .testTag("blFooter_$label"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 13.dp,
            tint = if (enabled) PantopusColors.primary600 else PantopusColors.appTextMuted,
        )
        Text(
            label,
            color = if (enabled) PantopusColors.appTextStrong else PantopusColors.appTextMuted,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.5.sp,
        )
    }
}

// ─── Sticky bottom save bar ─────────────────────────────────────────────────

@Composable
internal fun BLSaveBar(
    saving: Boolean,
    enabled: Boolean,
    label: String,
    onSave: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val dim = saving || !enabled
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s2, bottom = Spacing.s5),
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = Spacing.s2)
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (dim) PantopusColors.appSurfaceSunken else PantopusColors.primary600)
                    .then(if (!dim) Modifier.clickable(onClick = onSave) else Modifier)
                    .testTag("blSaveBar"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            if (saving) {
                androidx.compose.material3.CircularProgressIndicator(
                    color = PantopusColors.appTextSecondary,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(16.dp).padding(end = 0.dp),
                )
                Text("  Saving", color = PantopusColors.appTextSecondary, fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
            } else {
                Text(
                    if (enabled) label else "Fix your link to save",
                    color = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.5.sp,
                )
            }
        }
    }
}

// ─── Dark "Saved" toast ─────────────────────────────────────────────────────

@Composable
internal fun BLSavedToast(
    message: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 15.dp, tint = PantopusColors.success)
        Text(message, color = PantopusColors.appTextInverse, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
    }
}

// ─── Green "Link copied" success toast ──────────────────────────────────────

@Composable
internal fun CopiedToast(
    message: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.CheckCircle, contentDescription = null, size = 15.dp, tint = PantopusColors.success)
        Text(message, color = PantopusColors.success, fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
    }
}

// ─── Circular avatar with initials ──────────────────────────────────────────

@Composable
internal fun BLAvatar(
    initials: String,
    pillar: SchedulingPillar,
    modifier: Modifier = Modifier,
    diameter: androidx.compose.ui.unit.Dp = 48.dp,
    fontSize: androidx.compose.ui.unit.TextUnit = 16.sp,
) {
    Box(
        modifier = modifier.size(diameter).clip(CircleShape).background(pillar.accent),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials, color = PantopusColors.appTextInverse, fontWeight = FontWeight.Bold, fontSize = fontSize)
    }
}

// ─── Mono URL row used by share/result cards ────────────────────────────────

@Composable
internal fun MonoUrlText(
    url: String,
    modifier: Modifier = Modifier,
) {
    Text(
        url,
        color = PantopusColors.appText,
        fontFamily = MONO,
        fontWeight = FontWeight.SemiBold,
        fontSize = 13.sp,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier,
    )
}
