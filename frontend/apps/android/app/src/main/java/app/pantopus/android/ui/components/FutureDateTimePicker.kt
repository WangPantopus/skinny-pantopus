@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * P0.3 — Material3 date + time picker pair for "schedule it" fields.
 * Stage 1 is a [DatePickerDialog] restricted to today onward via
 * [SelectableDates]; confirming flows into stage 2, a [TimePicker] in the
 * same dialog chrome (mirrors `AddEventFormScreen`'s picker pair).
 * Cancelling either stage calls [onDismiss] without a result.
 *
 * The date alone can't reject a past *time* today — callers keep their
 * existing "must be in the future" validation for the composed value.
 */
@Composable
fun FutureDateTimePickerDialogs(
    initial: LocalDateTime?,
    onPicked: (LocalDateTime) -> Unit,
    onDismiss: () -> Unit,
) {
    var pickedDate by remember { mutableStateOf<LocalDate?>(null) }
    val date = pickedDate
    if (date == null) {
        FutureDatePickerDialog(
            initial = initial?.toLocalDate(),
            onSelect = { pickedDate = it },
            onDismiss = onDismiss,
        )
    } else {
        TimePickerDialog(
            initial = initial?.toLocalTime() ?: DEFAULT_TIME,
            onSelect = { time -> onPicked(LocalDateTime.of(date, time)) },
            onDismiss = onDismiss,
        )
    }
}

@Composable
private fun FutureDatePickerDialog(
    initial: LocalDate?,
    onSelect: (LocalDate) -> Unit,
    onDismiss: () -> Unit,
) {
    val initialMillis =
        (initial ?: LocalDate.now())
            .atStartOfDay(ZoneOffset.UTC)
            .toInstant()
            .toEpochMilli()
    val state =
        rememberDatePickerState(
            initialSelectedDateMillis = initialMillis,
            selectableDates = TodayOnwardSelectableDates,
        )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                val picked = state.selectedDateMillis
                if (picked != null) {
                    onSelect(
                        Instant
                            .ofEpochMilli(picked)
                            .atZone(ZoneOffset.UTC)
                            .toLocalDate(),
                    )
                } else {
                    onDismiss()
                }
            }) { Text("Next") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    ) {
        DatePicker(state = state)
    }
}

@Composable
private fun TimePickerDialog(
    initial: LocalTime,
    onSelect: (LocalTime) -> Unit,
    onDismiss: () -> Unit,
) {
    val state =
        rememberTimePickerState(
            initialHour = initial.hour,
            initialMinute = initial.minute,
            is24Hour = false,
        )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = { onSelect(LocalTime.of(state.hour, state.minute)) }) { Text("Done") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    ) {
        Box(modifier = Modifier.padding(Spacing.s4)) { TimePicker(state = state) }
    }
}

/** Selectable window: today (device zone) onward. */
private val TodayOnwardSelectableDates =
    object : SelectableDates {
        override fun isSelectableDate(utcTimeMillis: Long): Boolean {
            val date =
                Instant
                    .ofEpochMilli(utcTimeMillis)
                    .atZone(ZoneOffset.UTC)
                    .toLocalDate()
            return !date.isBefore(LocalDate.now(ZoneId.systemDefault()))
        }

        override fun isSelectableYear(year: Int): Boolean = year >= LocalDate.now(ZoneId.systemDefault()).year
    }

private val DEFAULT_TIME: LocalTime = LocalTime.of(9, 0)
