@file:Suppress("LongMethod", "MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.home_records.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.home_records.HomeRecordAsset
import app.pantopus.android.ui.screens.mailbox.home_records.RecordWarrantyStatus
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * One row in the Home Records asset index: category glyph, name,
 * room · manufacturer, warranty pill, and the linked-mail count.
 *
 * Mirrors iOS `AssetLinkCard`.
 */
@Composable
fun AssetLinkCard(
    asset: HomeRecordAsset,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val mailCountLabel =
        "${asset.linkedMailCount} mail item" + if (asset.linkedMailCount == 1) "" else "s"
    val metaLine =
        listOfNotNull(asset.room, asset.manufacturer)
            .takeIf { it.isNotEmpty() }
            ?.joinToString(" · ")

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onTap)
                .padding(Spacing.s3)
                .testTag("homeRecords_asset_${asset.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = asset.category.icon,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.home,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                text = asset.name,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (metaLine != null) {
                Text(
                    text = metaLine,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = asset.warranty.label,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = warrantyTint(asset.warranty),
                    modifier =
                        Modifier
                            .clip(CircleShape)
                            .background(warrantyBackground(asset.warranty))
                            .padding(horizontal = 6.dp, vertical = 1.dp),
                )
                Text(text = mailCountLabel, fontSize = 10.sp, color = PantopusColors.appTextMuted)
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.appBorderStrong,
        )
    }
}

/** Warranty pill foreground. */
fun warrantyTint(status: RecordWarrantyStatus): Color =
    when (status) {
        RecordWarrantyStatus.ACTIVE -> PantopusColors.success
        RecordWarrantyStatus.EXPIRING_SOON -> PantopusColors.warning
        RecordWarrantyStatus.EXPIRED -> PantopusColors.error
        RecordWarrantyStatus.NONE -> PantopusColors.appTextMuted
    }

/** Warranty pill background. */
fun warrantyBackground(status: RecordWarrantyStatus): Color =
    when (status) {
        RecordWarrantyStatus.ACTIVE -> PantopusColors.successBg
        RecordWarrantyStatus.EXPIRING_SOON -> PantopusColors.warningBg
        RecordWarrantyStatus.EXPIRED -> PantopusColors.errorBg
        RecordWarrantyStatus.NONE -> PantopusColors.appSurfaceSunken
    }
