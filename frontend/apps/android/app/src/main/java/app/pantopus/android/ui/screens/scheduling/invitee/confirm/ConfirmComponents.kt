@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Resolve the pillar for a booking-page owner type string. */
fun pillarForOwner(ownerType: String?): SchedulingPillar =
    when (ownerType) {
        "home" -> SchedulingPillar.Home
        "business" -> SchedulingPillar.Business
        else -> SchedulingPillar.Personal
    }

/** Two-tone avatar gradient per pillar (tokens only). */
private fun SchedulingPillar.avatarBrush(): Brush =
    when (this) {
        SchedulingPillar.Personal -> Brush.linearGradient(listOf(PantopusColors.primary400, PantopusColors.primary700))
        SchedulingPillar.Home -> Brush.linearGradient(listOf(PantopusColors.home, PantopusColors.homeDark))
        SchedulingPillar.Business -> Brush.linearGradient(listOf(PantopusColors.business, PantopusColors.businessDark))
    }

/** Section overline (uppercased per the design-system contract). */
@Composable
fun ConfirmOverline(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text.uppercase(),
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextSecondary,
        modifier = modifier.padding(bottom = Spacing.s2),
    )
}

/** The shared white summary card chrome (1px border, 16dp radius, soft shadow). */
@Composable
fun ConfirmCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
    ) { content() }
}

@Composable
fun HostAvatar(
    pillar: SchedulingPillar,
    initials: String,
    modifier: Modifier = Modifier,
    diameter: Dp = 36.dp,
) {
    Box(
        modifier = modifier.size(diameter).clip(CircleShape).background(pillar.avatarBrush()),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = initials, color = PantopusColors.appTextInverse, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

/** An icon-prefixed detail row inside a summary card, with an optional divider. */
@Composable
fun SummaryDetailRow(
    icon: PantopusIcon,
    divider: Boolean = true,
    content: @Composable () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(end = Spacing.s2),
        )
        Column(modifier = Modifier.weight(1f)) { content() }
    }
    if (divider) HorizontalDivider(color = PantopusColors.appBorder)
}

/** The "Pacific time (PDT)" chip; tap "Change" to open the timezone picker. */
@Composable
fun TimezoneChip(
    label: String,
    accent: Color,
    modifier: Modifier = Modifier,
    onChange: (() -> Unit)? = null,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary100)
                .then(if (onChange != null) Modifier.clickable(onClick = onChange) else Modifier)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.Globe, contentDescription = null, size = 12.dp, tint = PantopusColors.primary700)
        Text(text = label, style = PantopusTextStyle.caption, color = PantopusColors.primary700, fontWeight = FontWeight.SemiBold)
        if (onChange != null) {
            Text(text = "Change", style = PantopusTextStyle.caption, color = accent, fontWeight = FontWeight.Bold)
        }
    }
}

/** A small pillar identity tag: "● Personal". */
@Composable
fun PillarTag(
    pillar: SchedulingPillar,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(pillar.accent))
        Text(text = pillar.name, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = pillar.accent)
    }
}

// ─── Hero / halo (D3 + token-expired) ────────────────────────────────────────

enum class HaloKind { Success, Info, Warning }

@Composable
fun ConfirmHalo(
    kind: HaloKind,
    icon: PantopusIcon,
    modifier: Modifier = Modifier,
) {
    val (bg, ring, tint) =
        when (kind) {
            HaloKind.Success -> Triple(PantopusColors.successBg, PantopusColors.successLight, PantopusColors.success)
            HaloKind.Info -> Triple(PantopusColors.infoBg, PantopusColors.infoLight, PantopusColors.info)
            HaloKind.Warning -> Triple(PantopusColors.warningBg, PantopusColors.warningLight, PantopusColors.warning)
        }
    // Spec Halo (booking-confirmed-frames.jsx): 104dp outer soft pulse ring +
    // a 84dp inset fill + the 80dp bordered disc holding a 38dp glyph.
    Box(modifier = modifier.size(104.dp), contentAlignment = Alignment.Center) {
        Box(modifier = Modifier.size(104.dp).clip(CircleShape).background(bg.copy(alpha = 0.55f)))
        Box(modifier = Modifier.size(84.dp).clip(CircleShape).background(bg))
        Box(
            modifier = Modifier.size(80.dp).clip(CircleShape).background(bg).border(2.dp, ring, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 38.dp, tint = tint)
        }
    }
}

@Composable
fun ConfirmHero(
    kind: HaloKind,
    icon: PantopusIcon,
    title: String,
    body: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        ConfirmHalo(kind = kind, icon = icon)
        // Spec hero headline: 21sp / 700 (booking-confirmed-frames.jsx Hero line 138), not h2 (24sp SemiBold).
        Text(
            text = title,
            style = PantopusTextStyle.h3,
            fontSize = 21.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            text = body,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextStrong,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
    }
}

// ─── Inline banners ──────────────────────────────────────────────────────────

enum class BannerTone { Info, Warning, Error, Success }

@Composable
fun ConfirmBanner(
    tone: BannerTone,
    icon: PantopusIcon,
    title: String,
    modifier: Modifier = Modifier,
    body: String? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val (bg, border, fg) =
        when (tone) {
            BannerTone.Info -> Triple(PantopusColors.infoBg, PantopusColors.infoLight, PantopusColors.info)
            BannerTone.Warning -> Triple(PantopusColors.warningBg, PantopusColors.warningLight, PantopusColors.warning)
            BannerTone.Error -> Triple(PantopusColors.errorBg, PantopusColors.errorLight, PantopusColors.error)
            BannerTone.Success -> Triple(PantopusColors.successBg, PantopusColors.successLight, PantopusColors.success)
        }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(bg)
                .border(1.dp, border, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = fg, modifier = Modifier.padding(end = Spacing.s2))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(text = title, style = PantopusTextStyle.caption, color = fg, fontWeight = FontWeight.Bold)
            if (body != null) Text(text = body, style = PantopusTextStyle.caption, color = fg)
            if (actionLabel != null && onAction != null) {
                Text(
                    text = actionLabel,
                    style = PantopusTextStyle.caption,
                    color = fg,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickable(onClick = onAction).padding(top = Spacing.s1),
                )
            }
        }
    }
}

// ─── Add-to-calendar cluster (RsvpCluster) ───────────────────────────────────

@Composable
fun CalendarCluster(
    accent: Color,
    onAddTo: (CalendarTarget) -> Unit,
    onDownloadIcs: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        ConfirmOverline("Add to your calendar")
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
            CalendarTarget.entries.forEach { target ->
                Row(
                    modifier =
                        Modifier
                            .weight(1f)
                            .height(38.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appSurface)
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                            .clickable { onAddTo(target) },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Calendar,
                        contentDescription = null,
                        size = 13.dp,
                        tint = accent,
                        modifier = Modifier.padding(end = Spacing.s1),
                    )
                    Text(
                        text = target.label,
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appText,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
        Row(
            modifier = Modifier.clickable(onClick = onDownloadIcs).padding(top = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = PantopusIcon.Download, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextSecondary)
            Text(
                text = "Download .ics",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

enum class CalendarTarget(val label: String) { Google("Google"), Apple("Apple"), Outlook("Outlook") }
