@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.businesses.page_editor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.businesses.page_editor.EditBusinessPageHoursRow
import app.pantopus.android.ui.screens.businesses.page_editor.EditBusinessPageHoursState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * P4.2 — A13.10 Edit Business Page. 7-row hours card. Each row carries
 * a day label, a state (open/closed/notSet), and an optional dirty
 * marker (orange dot + amber row tint). Setup variant exposes
 * quick-apply chips beneath the card.
 */
@Composable
fun EditBusinessHoursEditor(
    state: EditBusinessPageHoursState,
    modifier: Modifier = Modifier,
) {
    val rows: List<EditBusinessPageHoursRow> =
        when (state) {
            is EditBusinessPageHoursState.Rows -> state.rows
            is EditBusinessPageHoursState.QuickApply -> state.rows
        }
    Column(
        modifier = modifier.testTag("editBusinessPage.hours"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        HoursCard(rows = rows)
        when (state) {
            is EditBusinessPageHoursState.Rows -> state.footerHint?.let { hint -> HintRow(hint = hint) }
            is EditBusinessPageHoursState.QuickApply -> QuickApplyRow()
        }
    }
}

@Composable
private fun HoursCard(rows: List<EditBusinessPageHoursRow>) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                ),
    ) {
        rows.forEachIndexed { idx, row ->
            HoursRowView(row = row)
            if (idx != rows.size - 1) {
                HorizontalDivider(
                    color = PantopusColors.appBorderSubtle,
                    thickness = 1.dp,
                    modifier = Modifier.padding(horizontal = Spacing.s3),
                )
            }
        }
    }
}

@Composable
private fun HoursRowView(row: EditBusinessPageHoursRow) {
    val bg = if (row.isDirty) PantopusColors.warningBg else PantopusColors.appSurface
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(bg)
                .padding(horizontal = Spacing.s3, vertical = 11.dp)
                .heightIn(min = 44.dp)
                .semantics { contentDescription = a11yLabel(row) },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.width(50.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            val isNotSet = row.state is EditBusinessPageHoursRow.State.NotSet
            Text(
                text = row.dayLabel,
                style = TextStyle(fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold),
                color = if (isNotSet) PantopusColors.appTextSecondary else PantopusColors.appText,
            )
            if (row.isDirty) {
                Box(
                    modifier =
                        Modifier
                            .size(6.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.warning),
                )
            }
        }
        HoursStateView(state = row.state)
    }
}

@Composable
private fun HoursStateView(state: EditBusinessPageHoursRow.State) {
    when (state) {
        is EditBusinessPageHoursRow.State.Open ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                TimePill(value = state.openLabel)
                Text(
                    text = "—",
                    style = TextStyle(fontSize = 11.sp),
                    color = PantopusColors.appTextMuted,
                )
                TimePill(value = state.closeLabel)
                Spacer(modifier = Modifier.weight(1f))
                PantopusIconImage(
                    icon = PantopusIcon.MoreHorizontal,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        EditBusinessPageHoursRow.State.Closed ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Closed",
                    style = TextStyle(fontSize = 12.sp, fontStyle = FontStyle.Italic),
                    color = PantopusColors.appTextSecondary,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "Set hours",
                    style = TextStyle(fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.business,
                )
            }
        EditBusinessPageHoursRow.State.NotSet ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Not set",
                    style = TextStyle(fontSize = 12.sp),
                    color = PantopusColors.appTextMuted,
                )
                Spacer(modifier = Modifier.weight(1f))
                Box(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.businessBg)
                            .border(
                                width = 1.dp,
                                color = PantopusColors.business.copy(alpha = 0.25f),
                                shape = RoundedCornerShape(Radii.pill),
                            )
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                ) {
                    Text(
                        text = "Add",
                        style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.businessDark,
                    )
                }
            }
    }
}

@Composable
private fun TimePill(value: String) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.xs))
                .background(PantopusColors.appSurfaceSunken)
                .border(
                    width = 1.dp,
                    color = PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.xs),
                )
                .padding(horizontal = 9.dp, vertical = 4.dp),
    ) {
        Text(
            text = value,
            style =
                TextStyle(
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = FontFamily.Monospace,
                ),
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun HintRow(hint: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = hint,
            style = TextStyle(fontSize = 11.sp, fontStyle = FontStyle.Italic),
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun QuickApplyRow() {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        QuickApplyButton(
            label = "Apply 9–5 weekdays",
            icon = PantopusIcon.CalendarClock,
            violet = true,
            modifier = Modifier.weight(1f),
        )
        QuickApplyButton(
            label = "Copy from another biz",
            icon = PantopusIcon.Copy,
            violet = false,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun QuickApplyButton(
    label: String,
    icon: PantopusIcon,
    violet: Boolean,
    modifier: Modifier = Modifier,
) {
    val fg = if (violet) PantopusColors.businessDark else PantopusColors.appTextStrong
    val bg = if (violet) PantopusColors.businessBg else PantopusColors.appSurface
    val border =
        if (violet) PantopusColors.business.copy(alpha = 0.25f) else PantopusColors.appBorder
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(bg)
                .border(width = 1.dp, color = border, shape = RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s2)
                .height(34.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, tint = fg)
        Text(
            text = label,
            style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
            color = fg,
        )
    }
}

private fun a11yLabel(row: EditBusinessPageHoursRow): String {
    val state =
        when (val s = row.state) {
            is EditBusinessPageHoursRow.State.Open -> "${s.openLabel} to ${s.closeLabel}"
            EditBusinessPageHoursRow.State.Closed -> "Closed"
            EditBusinessPageHoursRow.State.NotSet -> "Not set"
        }
    val dirty = if (row.isDirty) ", unsaved" else ""
    return "${row.dayLabel}, $state$dirty"
}
