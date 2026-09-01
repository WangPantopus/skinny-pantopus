@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/** Every quarter hour as `(hhmm, "9:00 AM")`, 00:00 → 23:45. */
fun quarterHourOptions(): List<Pair<String, String>> =
    buildList {
        for (hour in 0..23) {
            for (minute in listOf(0, 15, 30, 45)) {
                add(hhmm(hour, minute) to formatTime12(hour, minute))
            }
        }
    }

private val TIME_LIST_HEIGHT = 240.dp

/** Mon–Fri (backend weekday indices) — the copy sheet pre-checks these minus the source day. */
private val COPY_DEFAULT_WEEKDAYS = setOf(1, 2, 3, 4, 5)

/**
 * Edit a single open window: two scrollable time columns (Start | End) with a
 * confirm action. Used by the weekly-hours editor and date-override custom hours.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimeRangeEditorSheet(
    initialStart: String,
    initialEnd: String,
    onConfirm: (String, String) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    title: String = "Set hours",
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val options = remember { quarterHourOptions() }
    var start by remember { mutableStateOf(normalizeHHmm(initialStart)) }
    var end by remember { mutableStateOf(normalizeHHmm(initialEnd)) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, modifier = modifier) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2)) {
            Text(title, color = PantopusColors.appText, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                TimeColumn(
                    header = "Starts",
                    options = options,
                    selected = start,
                    onSelect = { start = it },
                    modifier = Modifier.weight(1f),
                )
                TimeColumn(
                    header = "Ends",
                    options = options,
                    selected = end,
                    onSelect = { end = it },
                    modifier = Modifier.weight(1f),
                )
            }
            // Inverted windows (start >= end) can't be confirmed — the backend
            // would silently drop the rule and zero the day's availability.
            A3PrimaryButton(
                label = "Set ${formatTime12(start)} – ${formatTime12(end)}",
                onClick = { onConfirm(start, end) },
                enabled = minutesOfDay(start) < minutesOfDay(end),
                modifier = Modifier.padding(vertical = Spacing.s3),
            )
        }
    }
}

/** Pick a single time (block-off start / end). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimePickerSheet(
    title: String,
    initial: String,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val options = remember { quarterHourOptions() }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, modifier = modifier) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2)) {
            Text(title, color = PantopusColors.appText, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            TimeColumn(
                header = null,
                options = options,
                selected = normalizeHHmm(initial),
                onSelect = onPick,
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3, bottom = Spacing.s4),
            )
        }
    }
}

@Composable
private fun TimeColumn(
    header: String?,
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val listState = rememberLazyListState()
    Column(modifier = modifier) {
        if (header != null) {
            FieldLabel(header, modifier = Modifier.padding(bottom = Spacing.s1))
        }
        LazyColumn(
            state = listState,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(TIME_LIST_HEIGHT)
                    .clip(RoundedCornerShape(Radii.md))
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md)),
        ) {
            items(options, key = { it.first }) { (value, label) ->
                val on = value == selected
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(value) }
                            .background(if (on) PantopusColors.primary50 else PantopusColors.appSurface)
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        label,
                        color = if (on) PantopusColors.primary700 else PantopusColors.appText,
                        fontSize = 13.sp,
                        fontWeight = if (on) FontWeight.Bold else FontWeight.Normal,
                    )
                    if (on) {
                        PantopusIconImage(
                            icon = PantopusIcon.Check,
                            contentDescription = null,
                            size = 14.dp,
                            tint = PantopusColors.primary600,
                        )
                    }
                }
            }
        }
    }
}

/** Copy a day's hours to selected other days. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CopyToDaysSheet(
    sourceWeekday: Int,
    onConfirm: (Set<Int>) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val targets = remember { WEEKDAY_DISPLAY_ORDER.filter { it != sourceWeekday } }
    // Pre-check Mon–Fri minus the source day (mirrors design + iOS), so the
    // default "Copy to N days" is non-zero.
    var checked by remember { mutableStateOf(COPY_DEFAULT_WEEKDAYS - sourceWeekday) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, modifier = modifier) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2)) {
            Text("Copy to other days", color = PantopusColors.appText, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text(
                "${weekdayFull(sourceWeekday)}'s hours",
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
                modifier = Modifier.padding(bottom = Spacing.s2),
            )
            targets.forEach { weekday ->
                val on = weekday in checked
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.sm))
                            .clickable { checked = if (on) checked - weekday else checked + weekday }
                            .padding(vertical = Spacing.s2),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(18.dp)
                                .clip(RoundedCornerShape(Radii.xs))
                                .background(if (on) PantopusColors.primary600 else PantopusColors.appSurface)
                                .border(
                                    1.dp,
                                    if (on) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                                    RoundedCornerShape(Radii.xs),
                                ),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (on) {
                            PantopusIconImage(
                                icon = PantopusIcon.Check,
                                contentDescription = null,
                                size = 12.dp,
                                tint = PantopusColors.appTextInverse,
                            )
                        }
                    }
                    Text(weekdayFull(weekday), color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                }
            }
            A3PrimaryButton(
                // Always "Copy to N days" (design label); disabled at 0.
                label = "Copy to ${checked.size} days",
                onClick = { onConfirm(checked) },
                enabled = checked.isNotEmpty(),
                modifier = Modifier.padding(vertical = Spacing.s3),
            )
        }
    }
}

/** A Material date picker dialog returning the chosen [LocalDate]. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun A3DatePickerDialog(
    initial: LocalDate,
    onPick: (LocalDate) -> Unit,
    onDismiss: () -> Unit,
) {
    val pickerState =
        rememberDatePickerState(
            initialSelectedDateMillis = initial.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
        )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                val millis = pickerState.selectedDateMillis
                if (millis != null) {
                    onPick(Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate())
                }
                onDismiss()
            }) { Text("OK") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) {
        DatePicker(state = pickerState)
    }
}
