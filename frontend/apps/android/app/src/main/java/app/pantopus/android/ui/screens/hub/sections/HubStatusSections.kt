@file:Suppress("MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.hub.sections

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.hub.NeighborDensityContent
import app.pantopus.android.ui.screens.hub.StatusStripItem
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * Two server-driven hub blocks that used to be dropped on native:
 *
 * * [HubStatusStrip] — the "NEEDS ATTENTION" rail built from
 *   `GET /api/hub`'s `statusItems[]`, with per-pill dismiss and the
 *   "All caught up" empty pill. RN `src/components/hub/HubActionStrip.tsx`.
 * * [HubNeighborDensitySection] — the verified-neighbor density pill plus
 *   the milestone celebration banner and its dismiss. RN
 *   `src/components/hub/NeighborDensity.tsx`.
 */

/** How long the milestone banner stays up before auto-dismissing (RN: 10s). */
private const val MILESTONE_AUTO_DISMISS_MS = 10_000L

@Composable
fun HubStatusStrip(
    items: List<StatusStripItem>,
    onTap: (StatusStripItem) -> Unit,
    onDismiss: (String) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("hubStatusStrip"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "NEEDS ATTENTION",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )

        if (items.isEmpty()) {
            AllCaughtUpPill()
        } else {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = Spacing.s4),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.Top,
            ) {
                items.forEach { item -> StatusPill(item = item, onTap = onTap, onDismiss = onDismiss) }
            }
        }
    }
}

@Composable
private fun AllCaughtUpPill() {
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("hubStatusStripEmpty"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CheckCircle,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.success,
        )
        Text(
            text = "All caught up",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.success,
        )
    }
}

@Composable
private fun StatusPill(
    item: StatusStripItem,
    onTap: (StatusStripItem) -> Unit,
    onDismiss: (String) -> Unit,
) {
    val tint = severityTint(item.severity)
    Box {
        Row(
            modifier =
                Modifier
                    .defaultMinSize(minWidth = 130.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(severityBackground(item.severity))
                    .border(1.dp, tint.copy(alpha = 0.2f), RoundedCornerShape(Radii.md))
                    .clickable { onTap(item) }
                    .padding(start = Spacing.s3, end = Spacing.s5, top = Spacing.s2, bottom = Spacing.s2)
                    .testTag("hubStatusItem_${item.id}"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.Top,
        ) {
            PantopusIconImage(
                icon = item.icon,
                contentDescription = null,
                size = 18.dp,
                tint = tint,
            )
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = item.title,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                )
                item.subtitle?.takeIf { it.isNotBlank() }?.let {
                    Text(text = it, fontSize = 11.sp, color = tint, maxLines = 1)
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .clickable { onDismiss(item.id) }
                    .padding(Spacing.s1)
                    .testTag("hubStatusItemDismiss_${item.id}"),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Dismiss ${item.title}",
                size = 13.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

private fun severityTint(severity: StatusStripItem.Severity): Color =
    when (severity) {
        StatusStripItem.Severity.Critical -> PantopusColors.error
        StatusStripItem.Severity.Warning -> PantopusColors.warning
        StatusStripItem.Severity.Info -> PantopusColors.info
    }

private fun severityBackground(severity: StatusStripItem.Severity): Color =
    when (severity) {
        StatusStripItem.Severity.Critical -> PantopusColors.errorBg
        StatusStripItem.Severity.Warning -> PantopusColors.warningBg
        StatusStripItem.Severity.Info -> PantopusColors.infoBg
    }

/**
 * Density pill + milestone celebration banner. The banner auto-hides
 * after 10s exactly like RN, and both the tap and the timeout raise
 * [onDismissMilestone] so the backend records the milestone as seen.
 */
@Composable
fun HubNeighborDensitySection(
    content: NeighborDensityContent,
    onDismissMilestone: () -> Unit,
) {
    var showsMilestone by remember(content.milestone) { mutableStateOf(content.milestone != null) }

    LaunchedEffect(content.milestone) {
        if (content.milestone == null) return@LaunchedEffect
        delay(MILESTONE_AUTO_DISMISS_MS)
        if (showsMilestone) {
            showsMilestone = false
            onDismissMilestone()
        }
    }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .testTag("hubNeighborDensity"),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        AnimatedVisibility(
            visible = showsMilestone && content.milestone != null,
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary50)
                        .clickable {
                            showsMilestone = false
                            onDismissMilestone()
                        }
                        .padding(horizontal = Spacing.s3, vertical = 10.dp)
                        .testTag("hubDensityMilestoneBanner"),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.PartyPopper,
                    contentDescription = null,
                    size = 17.dp,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = content.milestone.orEmpty(),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                    maxLines = 2,
                    modifier = Modifier.weight(1f),
                )
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Dismiss milestone",
                    size = 17.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }

        if (content.count > 0) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = 10.dp, vertical = Spacing.s1)
                        .testTag("hubNeighborDensityPill"),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Users,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = content.pillText,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}
