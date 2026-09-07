package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.PlaceAddressCalendarData
import app.pantopus.android.data.api.models.place.SetPickupDayRequest
import app.pantopus.android.ui.theme.PantopusColors
import java.time.LocalDate
import java.time.format.DateTimeFormatter

private const val WEEKLY_PICKUP_WINDOW_DAYS = 7L
private const val BIWEEKLY_PICKUP_WINDOW_DAYS = 14L

private val WEEKDAYS =
    listOf(
        "MO" to "Monday",
        "TU" to "Tuesday",
        "WE" to "Wednesday",
        "TH" to "Thursday",
        "FR" to "Friday",
        "SA" to "Saturday",
        "SU" to "Sunday",
    )
private val FREQUENCIES = listOf("not_set" to "Not sure yet", "weekly" to "Every week", "biweekly" to "Every other week")

/** Dates come from the home's local today; the device timezone never chooses a pickup week. */
@Composable
internal fun PickupScheduleEditor(
    data: PlaceAddressCalendarData,
    actions: AddressCalendarActions,
    busy: Boolean,
) {
    var weekday by rememberSaveable(data.pickupSchedule) { mutableStateOf(data.pickupSchedule?.weekday.orEmpty()) }
    var frequency by rememberSaveable(data.pickupSchedule) { mutableStateOf(data.pickupSchedule?.recyclingFrequency ?: "not_set") }
    var nextDate by rememberSaveable(data.pickupSchedule) { mutableStateOf(data.pickupSchedule?.recyclingNextDate.orEmpty()) }
    val dates =
        remember(data.today, frequency) {
            val today = runCatching { LocalDate.parse(data.today) }.getOrNull()
            if (today == null) {
                emptyList()
            } else {
                (0L until if (frequency == "weekly") WEEKLY_PICKUP_WINDOW_DAYS else BIWEEKLY_PICKUP_WINDOW_DAYS).map { offset ->
                    val date = today.plusDays(offset)
                    date.toString() to date.format(DateTimeFormatter.ofPattern("EEEE, MMM d"))
                }
            }
        }
    Text("Which day is garbage collected each week?", color = PantopusColors.appText, fontSize = 13.sp)
    ScheduleChoice("Garbage collection", weekday, WEEKDAYS, busy) { weekday = it }
    ScheduleChoice("Recycling", frequency, FREQUENCIES, busy) {
        frequency = it
        nextDate = ""
    }
    if (frequency != "not_set") {
        ScheduleChoice("Next recycling pickup", nextDate, dates, busy) { nextDate = it }
    }
    Text(
        "Use your collection day, not the night you put bins out. Dates follow your home’s calendar. " +
            "If recycling is unknown, only garbage is saved. Check your provider for holiday changes.",
        fontSize = 12.sp,
        color = PantopusColors.appTextSecondary,
    )
    Button(
        enabled = !busy && weekday.isNotEmpty() && (frequency == "not_set" || dates.any { it.first == nextDate }),
        onClick = {
            actions.setPickupDay(SetPickupDayRequest(weekday, frequency, nextDate.takeIf { frequency != "not_set" }))
        },
    ) { Text(if (busy) "Saving…" else "Save schedule") }
    if (data.pickupSchedule != null) {
        TextButton(enabled = !busy, onClick = actions::clearPickupDay) { Text("Clear household schedule") }
    }
}

@Composable
private fun ScheduleChoice(
    label: String,
    value: String,
    choices: List<Pair<String, String>>,
    busy: Boolean,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Text(label, color = PantopusColors.appTextSecondary, fontSize = 13.sp)
        Box {
            val selected = choices.find { it.first == value }?.second ?: "Choose"
            OutlinedButton(
                onClick = { expanded = true },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().semantics { contentDescription = "$label: $selected" },
            ) {
                Text(selected, color = PantopusColors.appText)
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                choices.forEach { (code, text) ->
                    DropdownMenuItem(text = { Text(text) }, enabled = !busy, onClick = {
                        expanded = false
                        onSelect(code)
                    })
                }
            }
        }
    }
}
