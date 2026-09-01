@file:Suppress("MagicNumber", "PackageNaming", "LongParameterList", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PantopusCheckbox
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the certified-mail delivery-signing sheet. */
const val CERTIFIED_CONFIRM_GATE_TAG = "certifiedConfirmGate"

/**
 * Modal delivery-signing gate for unread certified mail. The user must
 * explicitly confirm recipient intent before the Sign for delivery action
 * can record a receipt.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CertifiedConfirmGate(
    senderName: String,
    referenceNumber: String,
    deadlineLabel: String?,
    onReviewFirst: () -> Unit,
    onSign: () -> Unit,
    modifier: Modifier = Modifier,
    isSigning: Boolean = false,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onReviewFirst,
        sheetState = sheetState,
        containerColor = PantopusColors.appBg,
        modifier = modifier.testTag(CERTIFIED_CONFIRM_GATE_TAG),
    ) {
        CertifiedConfirmGateBody(
            senderName = senderName,
            referenceNumber = referenceNumber,
            deadlineLabel = deadlineLabel,
            isSigning = isSigning,
            onReviewFirst = onReviewFirst,
            onSign = onSign,
        )
    }
}

/**
 * Render-only body for previews and Paparazzi. Runtime hosts this inside
 * [ModalBottomSheet].
 */
@Composable
fun CertifiedConfirmGateBody(
    senderName: String,
    referenceNumber: String,
    deadlineLabel: String?,
    onReviewFirst: () -> Unit,
    onSign: () -> Unit,
    modifier: Modifier = Modifier,
    isSigning: Boolean = false,
) {
    var didConfirm by remember { mutableStateOf(false) }

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag(CERTIFIED_CONFIRM_GATE_TAG),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        ConfirmGateHeader()
        ConfirmGateSummary(
            senderName = senderName,
            referenceNumber = referenceNumber,
            deadlineLabel = deadlineLabel,
        )
        ConfirmGateConfirmation(
            didConfirm = didConfirm,
            onConfirmChange = { didConfirm = it },
        )
        ConfirmGateActions(
            didConfirm = didConfirm,
            isSigning = isSigning,
            onSign = onSign,
            onReviewFirst = onReviewFirst,
        )

        Text(
            text = "Signing does not waive your right to appeal, dispute, or pay through the issuing agency.",
            modifier = Modifier.fillMaxWidth(),
            fontSize = 11.sp,
            color = PantopusColors.appTextMuted,
        )
        Spacer(Modifier.height(Spacing.s2))
    }
}

@Composable
private fun ConfirmGateHeader() {
    Row(
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.warningBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.BadgeCheck,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.warning,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "Sign for delivery",
                modifier = Modifier.semantics { heading() },
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
            )
            Text(
                text =
                    "This certified item is unread. Signing records a delivery receipt " +
                        "in the chain of custody.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun ConfirmGateSummary(
    senderName: String,
    referenceNumber: String,
    deadlineLabel: String?,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        SummaryRow(label = "From", value = senderName, icon = PantopusIcon.Landmark)
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        SummaryRow(
            label = "Tracking",
            value = referenceNumber,
            icon = PantopusIcon.Hash,
            isCode = true,
        )
        if (deadlineLabel != null) {
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            SummaryRow(label = "Respond by", value = deadlineLabel, icon = PantopusIcon.CalendarClock)
        }
    }
}

@Composable
private fun ConfirmGateConfirmation(
    didConfirm: Boolean,
    onConfirmChange: (Boolean) -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
    ) {
        PantopusCheckbox(
            isChecked = didConfirm,
            onCheckedChange = onConfirmChange,
            label = "I am the recipient and understand this confirms delivery only.",
            modifier = Modifier.testTag("certifiedConfirmGate_confirmation"),
        )
    }
}

@Composable
private fun ConfirmGateActions(
    didConfirm: Boolean,
    isSigning: Boolean,
    onSign: () -> Unit,
    onReviewFirst: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PrimaryButton(
            title = "Sign for delivery",
            onClick = onSign,
            isLoading = isSigning,
            isEnabled = didConfirm && !isSigning,
            modifier = Modifier.fillMaxWidth(),
        )
        GhostButton(
            title = "Review first",
            onClick = onReviewFirst,
            isEnabled = !isSigning,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun SummaryRow(
    label: String,
    value: String,
    icon: PantopusIcon,
    isCode: Boolean = false,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics { contentDescription = "$label $value" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextStrong,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
            Text(
                text = label.uppercase(),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = value,
                fontSize = if (isCode) 12.sp else 13.sp,
                fontWeight = if (isCode) FontWeight.Normal else FontWeight.SemiBold,
                fontFamily = if (isCode) FontFamily.Monospace else FontFamily.Default,
                color = PantopusColors.appText,
            )
        }
    }
}
