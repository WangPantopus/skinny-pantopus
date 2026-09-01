@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.business_profile.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.business_profile.BusinessHoursRow
import app.pantopus.android.ui.screens.business_profile.BusinessOpenState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A10.6 — the Hours card: an open/closed status header (success- or
 * warning-tinted clock tile + "Open now" / "Closes 6:00 PM") over the
 * week's day rows, with today's row emphasized.
 *
 * Mirror of iOS `Features/BusinessProfile/Components/HoursTable.swift`.
 */
@Composable
fun HoursTable(
    status: BusinessOpenState,
    rows: List<BusinessHoursRow>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .testTag("businessProfile.hours"),
    ) {
        StatusHeader(status)
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        Column(modifier = Modifier.padding(horizontal = 14.dp).padding(top = 4.dp, bottom = 6.dp)) {
            rows.forEachIndexed { index, row ->
                DayRow(row)
                if (index != rows.lastIndex) {
                    HorizontalDivider(color = PantopusColors.appBorderSubtle)
                }
            }
        }
    }
}

@Composable
private fun StatusHeader(status: BusinessOpenState) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .semantics { contentDescription = "${status.statusLabel}, ${status.statusDetail}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(if (status.isOpen) PantopusColors.successBg else PantopusColors.warningBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Clock,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2f,
                tint = if (status.isOpen) PantopusColors.success else PantopusColors.warning,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = status.statusLabel,
                color = if (status.isOpen) PantopusColors.success else PantopusColors.warning,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.1).sp,
            )
            Text(
                text = status.statusDetail,
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronDown,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun DayRow(row: BusinessHoursRow) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = if (row.isToday) "${row.dayLabel}  ·  Today" else row.dayLabel,
            color = if (row.isToday) PantopusColors.appText else PantopusColors.appTextStrong,
            fontSize = 12.5.sp,
            fontWeight = if (row.isToday) FontWeight.Bold else FontWeight.Medium,
        )
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = row.timeLabel,
            color = timeColor(row),
            fontSize = 12.5.sp,
            fontWeight = if (row.isToday) FontWeight.Bold else FontWeight.Medium,
        )
    }
}

private fun timeColor(row: BusinessHoursRow): Color =
    when {
        row.isClosed -> PantopusColors.appTextMuted
        row.isToday -> PantopusColors.appText
        else -> PantopusColors.appTextStrong
    }
