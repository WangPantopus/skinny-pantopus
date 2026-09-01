@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.home_records.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The Home Records "Auto-detect assets" affordance. Idle it is a scan
 * button; after a scan turns up candidates it becomes a banner with a
 * Review action that opens the link suggestions.
 *
 * Mirrors iOS `AutoDetectBanner`.
 */
@Composable
fun AutoDetectBanner(
    detectionCount: Int,
    isScanning: Boolean,
    onScan: () -> Unit,
    onReview: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (detectionCount > 0) {
        ReviewBanner(detectionCount = detectionCount, onReview = onReview, modifier = modifier)
    } else {
        ScanButton(isScanning = isScanning, onScan = onScan, modifier = modifier)
    }
}

@Composable
private fun ReviewBanner(
    detectionCount: Int,
    onReview: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val plural = if (detectionCount == 1) "" else "s"
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .padding(Spacing.s3)
                .testTag("homeRecords_autoDetect_banner"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Sparkles,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.warning,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "$detectionCount potential asset$plural detected",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.warning,
            )
            Text(
                text = "We found appliance mentions in your recent mail.",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = "Review",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.warning)
                    .clickable(onClick = onReview)
                    .padding(horizontal = Spacing.s3, vertical = 7.dp)
                    .testTag("homeRecords_autoDetect_review"),
        )
    }
}

@Composable
private fun ScanButton(
    isScanning: Boolean,
    onScan: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.warningBg)
                .clickable(enabled = !isScanning, onClick = onScan)
                .testTag("homeRecords_autoDetect_scan"),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (isScanning) {
                CircularProgressIndicator(
                    modifier = Modifier.size(14.dp),
                    color = PantopusColors.warning,
                    strokeWidth = 2.dp,
                )
                Text(
                    text = "Scanning your recent mail…",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.warning,
                )
            } else {
                PantopusIconImage(
                    icon = PantopusIcon.FileSearch,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.warning,
                )
                Text(
                    text = "Scan mail for new assets",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.warning,
                )
            }
        }
    }
}
