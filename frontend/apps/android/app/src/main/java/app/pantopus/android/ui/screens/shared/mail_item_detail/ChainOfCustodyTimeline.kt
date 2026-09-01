@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.shared.mail_item_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * T6.5c (P21) — Reusable vertical chain-of-custody timeline. Mirrors
 * iOS `ChainOfCustodyTimeline`. Lives in the shared mail-item-detail
 * folder because the same timeline shape works for any delivery-
 * confirmation surface.
 */

/** One step in the timeline. */
@Immutable
data class ChainOfCustodyEvent(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val meta: String? = null,
    val timestamp: String? = null,
    val isPantopusEvent: Boolean = false,
    val isComplete: Boolean = true,
)

/** Status pill rendered in the card header. */
sealed interface ChainOfCustodyStatus {
    val label: String
    val background: Color
    val foreground: Color

    data object Unbroken : ChainOfCustodyStatus {
        override val label = "Unbroken"
        override val background = PantopusColors.successBg
        override val foreground = PantopusColors.success
    }

    data object Broken : ChainOfCustodyStatus {
        override val label = "Broken"
        override val background = PantopusColors.errorBg
        override val foreground = PantopusColors.error
    }

    data class Custom(
        override val label: String,
        override val background: Color,
        override val foreground: Color,
    ) : ChainOfCustodyStatus
}

const val CHAIN_OF_CUSTODY_TIMELINE_TAG = "chainOfCustodyTimeline"

@Composable
fun ChainOfCustodyTimeline(
    events: List<ChainOfCustodyEvent>,
    modifier: Modifier = Modifier,
    title: String = "Chain of custody",
    subtitle: String? = null,
    status: ChainOfCustodyStatus = ChainOfCustodyStatus.Unbroken,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .testTag(CHAIN_OF_CUSTODY_TIMELINE_TAG),
    ) {
        Header(title = title, subtitle = subtitle, status = status)
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        TimelineBody(events = events)
    }
}

@Composable
private fun Header(
    title: String,
    subtitle: String?,
    status: ChainOfCustodyStatus,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = title.uppercase(),
                modifier = Modifier.semantics { heading() },
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        Text(
            text = status.label,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(status.background)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp)
                    .testTag("chainOfCustodyTimeline_status"),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = status.foreground,
        )
    }
}

@Composable
private fun TimelineBody(events: List<ChainOfCustodyEvent>) {
    Box(modifier = Modifier.fillMaxWidth().padding(Spacing.s3)) {
        // Vertical track behind the 24dp status circles. Inset matches
        // the circle's midline: 11dp from the row's leading edge.
        Box(
            modifier =
                Modifier
                    .padding(start = 11.dp, top = Spacing.s2, bottom = Spacing.s2)
                    .width(2.dp)
                    .fillMaxHeight()
                    .background(PantopusColors.appBorder),
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            events.forEach { event -> EventRow(event = event) }
        }
    }
}

@Composable
private fun EventRow(event: ChainOfCustodyEvent) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics {
                    contentDescription =
                        listOfNotNull(event.label, event.meta, event.timestamp).joinToString(" · ")
                }
                .testTag("chainOfCustodyTimeline_event_${event.id}"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        StatusCircle(event = event)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = event.label,
                    fontSize = 12.5.sp,
                    fontWeight = if (event.isComplete) FontWeight.Bold else FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                if (event.isPantopusEvent) {
                    Text(
                        text = "PANTOPUS",
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.primary100)
                                .padding(horizontal = Spacing.s1, vertical = 1.dp),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.4.sp,
                        color = PantopusColors.primary700,
                    )
                }
            }
            event.meta?.let {
                Text(text = it, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
            }
            event.timestamp?.let {
                Text(
                    text = it,
                    fontSize = 10.5.sp,
                    fontFamily = FontFamily.Monospace,
                    color = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun StatusCircle(event: ChainOfCustodyEvent) {
    val (background, border, glyphColor) =
        when {
            event.isComplete && event.isPantopusEvent ->
                Triple(PantopusColors.primary600, PantopusColors.primary700, PantopusColors.appTextInverse)
            event.isComplete ->
                Triple(PantopusColors.success, PantopusColors.success, PantopusColors.appTextInverse)
            else ->
                Triple(PantopusColors.appSurface, PantopusColors.appBorderStrong, PantopusColors.appTextSecondary)
        }
    Box(
        modifier =
            Modifier
                .size(24.dp)
                .clip(CircleShape)
                .background(background)
                .border(width = if (event.isComplete) 2.dp else 1.5.dp, color = border, shape = CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = event.icon,
            contentDescription = null,
            size = Radii.lg,
            tint = glyphColor,
        )
    }
}
