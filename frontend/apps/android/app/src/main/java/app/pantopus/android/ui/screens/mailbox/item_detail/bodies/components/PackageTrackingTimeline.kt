@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.TimelineStep
import app.pantopus.android.ui.components.TimelineStepper
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A17.8 - Vertical package-tracking timeline (Shipped / In transit /
 * Out for delivery / Delivered, plus carrier-specific intermediate
 * scans). Wraps the canonical [TimelineStepper] in a card shell so the
 * Package body can drop it in alongside the status card and the proof
 * photo without re-implementing geometry.
 */
@Composable
fun PackageTrackingTimeline(
    steps: List<TimelineStep>,
    modifier: Modifier = Modifier,
    carrier: String? = null,
    onOpenCarrier: (() -> Unit)? = null,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape = RoundedCornerShape(Radii.xl))
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3)
                .testTag("packageTrackingTimeline"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Header(carrier = carrier, onOpenCarrier = onOpenCarrier)
        TimelineStepper(steps = steps)
    }
}

@Composable
private fun Header(
    carrier: String?,
    onOpenCarrier: (() -> Unit)?,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "TRACKING TIMELINE",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(Modifier.weight(1f))
        if (carrier != null && onOpenCarrier != null) {
            val label = "View on ${carrierShort(carrier)}"
            Row(
                modifier =
                    Modifier
                        .clickable(onClick = onOpenCarrier)
                        .testTag("packageTrackingTimeline.viewOnCarrier")
                        .semantics {
                            contentDescription = label
                            role = Role.Button
                        },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text(label, style = PantopusTextStyle.overline, color = PantopusColors.primary600)
                PantopusIconImage(
                    icon = PantopusIcon.ExternalLink,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }
    }
}

@Suppress("ReturnCount")
private fun carrierShort(carrier: String): String {
    val upper = carrier.uppercase()
    if (upper.contains("USPS")) return "USPS"
    if (upper.contains("UPS")) return "UPS"
    if (upper.contains("FEDEX")) return "FedEx"
    if (upper.contains("DHL")) return "DHL"
    return carrier.substringBefore(" ").ifEmpty { carrier }
}
