@file:Suppress("PackageNaming", "LongParameterList", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private val PRIMARY_HEIGHT = 44.dp
private val CHIP_ICON = 11.dp

/** Uppercase section overline ("BOOK A TIME", "MORNING"). */
@Composable
fun SectionOverline(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text.uppercase(),
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextSecondary,
        modifier = modifier.padding(horizontal = Spacing.s1),
    )
}

/** A small sky-tinted chip — the location-mode tag on event-type rows. */
@Composable
fun ModeChip(
    icon: PantopusIcon,
    label: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary50)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = CHIP_ICON, tint = PantopusColors.primary700)
        Text(text = label, style = PantopusTextStyle.overline, color = PantopusColors.primary700, fontWeight = FontWeight.Bold)
    }
}

/** The "Times shown in {label}" timezone chip on the picker — opens the C7 sheet. */
@Composable
fun TimezoneChip(
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
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics { contentDescription = "Times shown in $label. Change time zone" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Globe, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextSecondary)
        Text(
            text = "Times shown in $label",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextStrong,
            fontWeight = FontWeight.SemiBold,
        )
        PantopusIconImage(icon = PantopusIcon.ChevronDown, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextMuted)
    }
}

/** Filled CTA tinted with the host's pillar accent (the only pillar-colored chrome). */
@Composable
fun AccentFilledButton(
    label: String,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    enabled: Boolean = true,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = PRIMARY_HEIGHT)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (enabled) accent else PantopusColors.appSurfaceSunken)
                .clickable(enabled = enabled, onClick = onClick)
                .padding(vertical = Spacing.s3)
                .semantics {
                    contentDescription = label
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            if (icon != null) {
                PantopusIconImage(
                    icon = icon,
                    contentDescription = null,
                    size = 16.dp,
                    tint = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                )
            }
            Text(
                text = label,
                style = PantopusTextStyle.body,
                color = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
            )
        }
    }
}

/** Skeleton slot rows shown while the day's times resolve (mirrors the loaded row height). */
@Composable
fun DiscoverySkeletonSlots(
    modifier: Modifier = Modifier,
    count: Int = 6,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        repeat(count) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 14.dp, height = 14.dp, cornerRadius = Radii.xs)
                Shimmer(width = 66.dp, height = 13.dp, cornerRadius = Radii.xs)
            }
        }
    }
}
