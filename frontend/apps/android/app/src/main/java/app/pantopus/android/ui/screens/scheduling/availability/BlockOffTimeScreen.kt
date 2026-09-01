@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing

@Composable
fun BlockOffTimeScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: BlockOffTimeViewModel = hiltViewModel(),
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    var showDatePicker by remember { mutableStateOf(false) }
    var showStartPicker by remember { mutableStateOf(false) }
    var showEndPicker by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                BlockOffEvent.Saved -> onBack()
                is BlockOffEvent.Toast -> Unit
                is BlockOffEvent.OpenBooking -> onNavigate("scheduling/bookings/${event.bookingId}")
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        AvailabilityTopBar(
            title = "Block off time",
            onBack = onBack,
            trailing = {
                if (form.saving) {
                    Text("Saving", color = PantopusColors.appTextMuted, fontSize = 15.sp)
                } else {
                    TopBarTextAction(label = "Save", enabled = form.isValid, onClick = viewModel::save)
                }
            },
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            SectionOverline("Personal · Availability", modifier = Modifier.padding(start = Spacing.s1, top = Spacing.s1))
            DetailsCard(
                form = form,
                onReason = viewModel::setReason,
                onDate = { showDatePicker = true },
                onToggleAllDay = viewModel::toggleAllDay,
                onStart = { showStartPicker = true },
                onEnd = { showEndPicker = true },
            )
            form.conflict?.let { conflict ->
                A3ConflictCard(message = conflict.message, onViewBooking = viewModel::viewConflictBooking)
            }
            RepeatCard(form = form, onSelect = viewModel::setRepeat)
            // Design block-time-frames.jsx FrameSaving: the footer swaps the lock
            // footnote for a shimmering "Saving…" bar while the write is in flight.
            if (form.saving) {
                A3SavingFootnoteBar()
            } else {
                A3LockFootnote("This time won't be offered for booking. It's private to you.")
            }
        }
    }

    if (showDatePicker) {
        A3DatePickerDialog(
            initial = form.date,
            onPick = viewModel::setDate,
            onDismiss = { showDatePicker = false },
        )
    }
    if (showStartPicker) {
        TimePickerSheet(
            title = "Starts",
            initial = form.start,
            onPick = {
                viewModel.setStart(it)
                showStartPicker = false
            },
            onDismiss = { showStartPicker = false },
        )
    }
    if (showEndPicker) {
        TimePickerSheet(
            title = "Ends",
            initial = form.end,
            onPick = {
                viewModel.setEnd(it)
                showEndPicker = false
            },
            onDismiss = { showEndPicker = false },
        )
    }
}

@Composable
private fun DetailsCard(
    form: BlockOffForm,
    onReason: (String) -> Unit,
    onDate: () -> Unit,
    onToggleAllDay: (Boolean) -> Unit,
    onStart: () -> Unit,
    onEnd: () -> Unit,
) {
    val enabled = !form.saving
    A3Card {
        FieldLabel("Reason")
        OutlinedTextField(
            value = form.reason,
            onValueChange = onReason,
            enabled = enabled,
            singleLine = true,
            placeholder = { Text("Dentist") },
            supportingText = { Text("Optional · only you can see this.") },
            modifier = Modifier.fillMaxWidth(),
        )
        FieldLabel("Date")
        A3FieldButton(icon = PantopusIcon.Calendar, value = formatFullDate(form.date), enabled = enabled, onClick = onDate)
        A3ToggleRow(
            icon = PantopusIcon.Sun,
            label = "All day",
            sub = "Block the whole day",
            on = form.allDay,
            enabled = enabled,
            onToggle = onToggleAllDay,
        )
        if (!form.allDay) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Column(modifier = Modifier.weight(1f)) {
                    FieldLabel("Starts")
                    A3FieldButton(icon = PantopusIcon.Clock, value = formatTime12(form.start), enabled = enabled, onClick = onStart)
                }
                Column(modifier = Modifier.weight(1f)) {
                    FieldLabel("Ends")
                    A3FieldButton(icon = PantopusIcon.Clock, value = formatTime12(form.end), enabled = enabled, onClick = onEnd)
                }
            }
            if (!form.isValid) {
                Text(
                    "End must be after start.",
                    color = PantopusColors.error,
                    fontSize = 12.sp,
                )
            }
        }
    }
}

@Composable
private fun RepeatCard(
    form: BlockOffForm,
    onSelect: (BlockRepeat) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    A3Card {
        FieldLabel("Repeats")
        Box {
            A3FieldButton(icon = PantopusIcon.ArrowsRepeat, value = form.repeat.label, enabled = !form.saving, onClick = { open = true })
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                BlockRepeat.entries.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option.label) },
                        onClick = {
                            open = false
                            onSelect(option)
                        },
                    )
                }
            }
        }
        form.repeatCaption?.let { caption ->
            Text(caption, color = PantopusColors.appTextSecondary, fontSize = 11.sp)
        }
    }
}
