@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.businesses.page_editor.components

import android.app.TimePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
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
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * P4.2 — A13.10 Edit Business Page. 7-row hours card. Each row carries
 * a day label, a state (open/closed/notSet), and an optional dirty
 * marker (orange dot + amber row tint). Setup variant exposes
 * quick-apply chips beneath the card.
 */
@Composable
fun EditBusinessHoursEditor(
    state: EditBusinessPageHoursState,
    onDayChange: (String, EditBusinessPageHoursRow.State) -> Unit = { _, _ -> },
    onApplyWeekdays: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var editingDay by remember { mutableStateOf<EditBusinessPageHoursRow?>(null) }
    val rows: List<EditBusinessPageHoursRow> =
        when (state) {
            is EditBusinessPageHoursState.Rows -> state.rows
            is EditBusinessPageHoursState.QuickApply -> state.rows
        }
    Column(
        modifier = modifier.testTag("editBusinessPage.hours"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        HoursCard(rows = rows, onEditDay = { editingDay = it })
        when (state) {
            is EditBusinessPageHoursState.Rows -> state.footerHint?.let { hint -> HintRow(hint = hint) }
            is EditBusinessPageHoursState.QuickApply -> QuickApplyRow(onApplyWeekdays)
        }
    }
    editingDay?.let { day ->
        BusinessHoursDayDialog(
            day = day,
            onDismiss = { editingDay = null },
            onApply = { value ->
                onDayChange(day.id, value)
                editingDay = null
            },
        )
    }
}

@Composable
private fun HoursCard(
    rows: List<EditBusinessPageHoursRow>,
    onEditDay: (EditBusinessPageHoursRow) -> Unit,
) {
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
            HoursRowView(row = row, onClick = { onEditDay(row) })
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
private fun HoursRowView(
    row: EditBusinessPageHoursRow,
    onClick: () -> Unit,
) {
    val bg = if (row.isDirty) PantopusColors.warningBg else PantopusColors.appSurface
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(bg)
                .clickable(role = Role.Button, onClick = onClick)
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
private fun QuickApplyRow(onApply: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        QuickApplyButton(
            label = "Apply 9–5 weekdays",
            icon = PantopusIcon.CalendarClock,
            violet = true,
            modifier = Modifier.weight(1f).clickable(onClick = onApply),
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

/** Edit one day without writing until the enclosing page is saved. */
@Composable
internal fun BusinessHoursDayDialog(
    day: EditBusinessPageHoursRow,
    onDismiss: () -> Unit,
    onApply: (EditBusinessPageHoursRow.State) -> Unit,
) {
    val context = LocalContext.current
    val formatter = remember { DateTimeFormatter.ofPattern("h:mm a", Locale.US) }
    val initial = day.state as? EditBusinessPageHoursRow.State.Open
    var open by remember(day) {
        mutableStateOf(initial?.openLabel?.let { runCatching { LocalTime.parse(it, formatter) }.getOrNull() } ?: LocalTime.of(9, 0))
    }
    var close by remember(day) {
        mutableStateOf(initial?.closeLabel?.let { runCatching { LocalTime.parse(it, formatter) }.getOrNull() } ?: LocalTime.of(17, 0))
    }
    var closed by remember(day) { mutableStateOf(day.state == EditBusinessPageHoursRow.State.Closed) }
    val valid = closed || close.isAfter(open)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("${day.dayLabel} hours") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = closed,
                        onCheckedChange = { closed = it },
                        modifier = Modifier.semantics { contentDescription = "Closed all day" },
                    )
                    Text("Closed all day")
                }
                if (!closed) {
                    TextButton(onClick = {
                        TimePickerDialog(
                            context,
                            { _, hour, minute -> open = LocalTime.of(hour, minute) },
                            open.hour,
                            open.minute,
                            false,
                        ).show()
                    }) { Text("Opens ${open.format(formatter)}") }
                    TextButton(onClick = {
                        TimePickerDialog(
                            context,
                            { _, hour, minute -> close = LocalTime.of(hour, minute) },
                            close.hour,
                            close.minute,
                            false,
                        ).show()
                    }) { Text("Closes ${close.format(formatter)}") }
                    if (!valid) Text("Closing time must be after opening time.", color = PantopusColors.error)
                }
            }
        },
        confirmButton = {
            TextButton(enabled = valid, onClick = {
                onApply(
                    if (closed) {
                        EditBusinessPageHoursRow.State.Closed
                    } else {
                        EditBusinessPageHoursRow.State.Open(
                            open.format(formatter),
                            close.format(formatter),
                        )
                    },
                )
            }) { Text("Apply") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
