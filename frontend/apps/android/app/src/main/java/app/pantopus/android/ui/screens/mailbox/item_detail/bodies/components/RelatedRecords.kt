@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.RelatedRecord
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.10 — RelatedRecords. The "Other statements · this account" strip
 * rendered only in the filed state: each row carries a slate-tinted
 * document thumbnail, the period title, a lock-icon filed date, and the
 * ending balance in mono on the right. Compose mirror of iOS
 * `Variants/Components/RelatedRecords.swift`.
 */
@Composable
fun RelatedRecords(
    records: List<RelatedRecord>,
    modifier: Modifier = Modifier,
    total: Int = records.size,
) {
    if (records.isEmpty()) return
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("mailDetail_records_relatedRecords"),
    ) {
        Header(total = total)
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        records.forEachIndexed { index, record ->
            RecordRow(record = record)
            if (index < records.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

@Composable
private fun Header(total: Int) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "OTHER STATEMENTS · THIS ACCOUNT",
            modifier = Modifier.semantics { heading() },
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(Modifier.weight(1f))
        Row(
            modifier = Modifier.testTag("mailDetail_records_relatedRecords_seeAll"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                text = "See all $total",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary600,
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun RecordRow(record: RelatedRecord) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        DocumentThumbnail(period = record.period)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = "${record.period} Statement",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Lock,
                    contentDescription = null,
                    size = 9.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = record.filedWhen,
                    fontSize = 10.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        Text(
            text = record.amount,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = PantopusColors.categoryRecordsDeep,
        )
    }
}

@Composable
private fun DocumentThumbnail(period: String) {
    val quarter = period.split(" ").firstOrNull() ?: period
    Column(
        modifier =
            Modifier
                .size(width = 30.dp, height = 36.dp)
                .clip(RoundedCornerShape(Radii.xs))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.categoryRecordsBorder, RoundedCornerShape(Radii.xs)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.FileText,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.categoryRecordsDeep,
        )
        Spacer(Modifier.height(1.dp))
        Text(
            text = quarter,
            fontSize = 7.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.4.sp,
            color = PantopusColors.categoryRecordsDeep,
        )
    }
}
