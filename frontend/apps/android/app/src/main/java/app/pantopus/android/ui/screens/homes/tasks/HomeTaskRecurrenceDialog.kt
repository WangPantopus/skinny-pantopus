package app.pantopus.android.ui.screens.homes.tasks

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceConfiguration
import app.pantopus.android.data.api.models.homes.RECURRENCE_FREQUENCIES
import app.pantopus.android.data.api.models.homes.recurrenceDate
import app.pantopus.android.data.api.models.homes.recurrencePeriod
import app.pantopus.android.ui.screens.scheduling._shared.TimezonePickerSheet
import app.pantopus.android.ui.screens.scheduling._shared.defaultTimezoneOptions
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private const val RECURRENCE_DIALOG_FRACTION = 0.94f

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeTaskRecurrenceDialog(
    controller: HomeTaskRecurrenceController,
    onClosed: () -> Unit,
) {
    val state by controller.state.collectAsStateWithLifecycle()
    var showTimezone by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    val timezoneSheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    HomeTaskResumeEffect(controller::resume, controller::pause)
    DisposableEffect(controller) {
        onDispose {
            controller.close()
            onClosed()
        }
    }
    LaunchedEffect(state.active) { if (!state.active) showTimezone = false }
    Dialog(
        onDismissRequest = controller::close,
        properties = DialogProperties(usePlatformDefaultWidth = false, securePolicy = SecureFlagPolicy.SecureOn),
    ) {
        Surface(
            Modifier.fillMaxWidth().fillMaxHeight(RECURRENCE_DIALOG_FRACTION).testTag("homeTaskRecurrence"),
            color = PantopusColors.appSurface,
        ) {
            Column(
                Modifier.padding(Spacing.s4).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Repeat schedule", style = MaterialTheme.typography.titleLarge)
                    TextButton(onClick = controller::close, modifier = Modifier.testTag("homeTaskRecurrence.close")) { Text("Close") }
                }
                if (!state.active) {
                    Text(state.error ?: "Schedule content is hidden.")
                } else {
                    if (state.busy) CircularProgressIndicator()
                    state.error?.let { Text(it, color = PantopusColors.error, modifier = Modifier.testTag("homeTaskRecurrence.error")) }
                    RecurrenceContent(state, controller) {
                        query = ""
                        showTimezone = true
                    }
                    TextButton(
                        onClick = controller::reload,
                        enabled = !state.busy,
                        modifier = Modifier.testTag("homeTaskRecurrence.reload"),
                    ) {
                        Text("Reload repeat settings")
                    }
                }
            }
        }
        if (showTimezone && state.canChange) {
            TimezonePickerSheet(
                options = remember { defaultTimezoneOptions() },
                selectedId = state.timezone,
                query = query,
                onQueryChange = { query = it },
                onSelect = {
                    controller.fields(timezone = it.id)
                    showTimezone = false
                },
                onDismiss = { showTimezone = false },
                sheetState = timezoneSheet,
            )
        }
    }
}

@Composable
private fun RecurrenceContent(
    state: HomeTaskRecurrenceUiState,
    controller: HomeTaskRecurrenceController,
    chooseZone: () -> Unit,
) {
    val task = state.task ?: return
    val schedule = state.schedule ?: return
    Text(task.title, style = MaterialTheme.typography.titleMedium)
    Text(
        task.dueAt?.let { "The saved task is the first occurrence: ${recurrenceDateLabel(it, state.timezone)}." }
            ?: "Save a due date on this task before starting repeats.",
    )
    Text("Current schedule", style = MaterialTheme.typography.titleSmall)
    Text(recurrenceStatus(schedule.configuration), modifier = Modifier.testTag("homeTaskRecurrence.status"))
    schedule.configuration?.generatedCount?.takeIf { it > 0 }?.let { Text("Tasks created by this schedule: $it") }
    if (state.pending != null) RecurrenceRecovery(state, controller) else RecurrenceControls(state, controller, chooseZone)
    if (!schedule.canManage) Text("You can view this schedule, but you cannot change it.")
}

@Composable
private fun RecurrenceControls(
    state: HomeTaskRecurrenceUiState,
    controller: HomeTaskRecurrenceController,
    chooseZone: () -> Unit,
) {
    Text("Repeat every", style = MaterialTheme.typography.titleSmall)
    HomeTaskRecurrenceInterval(state.interval, { controller.fields(interval = it) }, state.canChange)
    Row {
        RECURRENCE_FREQUENCIES.forEach { frequency ->
            TextButton(onClick = { controller.fields(frequency = frequency) }, enabled = state.canChange) {
                Text("${if (frequency == state.frequency) "✓ " else ""}${recurrencePeriod(frequency).replaceFirstChar(Char::uppercase)}s")
            }
        }
    }
    TextButton(onClick = chooseZone, enabled = state.canChange, modifier = Modifier.testTag("homeTaskRecurrence.timezone")) {
        Text("Time zone: ${state.timezone}")
    }
    if (state.frequency == "MONTHLY") Text("Months without this calendar day are skipped.")
    TextButton(onClick = controller::start, enabled = state.canStart, modifier = Modifier.testTag("homeTaskRecurrence.start")) {
        Text(if (state.schedule?.configuration?.state == "active") "Save repeat changes" else "Start repeating")
    }
    if (state.schedule?.configuration?.let { it.state != "paused" } == true) {
        TextButton(onClick = controller::pauseRepeats, enabled = state.canPause, modifier = Modifier.testTag("homeTaskRecurrence.pause")) {
            Text("Pause repeats")
        }
    }
    Text(
        "Each scheduled date creates a new task. After missed dates, only the latest due task is created. " +
            "Completing the original task does not stop repeats. Pause stops future tasks and keeps existing tasks. " +
            "Attachments are not copied. Local clock changes may adjust an occurrence.",
        style = MaterialTheme.typography.bodySmall,
    )
}

@Composable
private fun RecurrenceRecovery(
    state: HomeTaskRecurrenceUiState,
    controller: HomeTaskRecurrenceController,
) {
    val pending = state.pending ?: return
    Text("Saved change", style = MaterialTheme.typography.titleSmall)
    pending.request.frequency?.let {
        Text(
            "Saved change: repeat every ${pending.request.interval} ${recurrencePeriod(it)}" +
                "${if (pending.request.interval == 1) "" else "s"} in ${pending.request.timezone}.",
        )
    }
    Text(
        if (pending.confirmed != null) {
            "Your saved schedule change is confirmed. The current schedule is shown above."
        } else {
            "Your previous ${pending.request.action} change has not been confirmed. Retry that saved change."
        },
    )
    if (pending.confirmed != null || state.canDismiss) {
        TextButton(
            onClick = controller::acknowledge,
            enabled = !state.busy,
            modifier = Modifier.testTag("homeTaskRecurrence.acknowledge"),
        ) {
            Text(if (pending.confirmed != null) "Done reviewing saved change" else "Dismiss rejected change")
        }
    } else {
        TextButton(
            onClick = controller::retry,
            enabled = !state.busy && state.schedule?.canManage == true,
            modifier = Modifier.testTag("homeTaskRecurrence.retry"),
        ) { Text("Retry saved change") }
    }
}

/** Keep the label separate, like other Home forms: Material's floating label
 * interpolates incompatible Em/Sp letter-spacing units in PantopusTypography. */
@Composable
internal fun HomeTaskRecurrenceInterval(
    value: String,
    onChange: (String) -> Unit,
    enabled: Boolean,
) {
    Text("Interval from 1 to 365", style = MaterialTheme.typography.bodySmall)
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        singleLine = true,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth().testTag("homeTaskRecurrence.interval"),
    )
}

internal fun recurrenceStatus(config: HomeTaskRecurrenceConfiguration?): String =
    when (config?.state) {
        null -> "Automatic repeats are off."
        "paused" -> "Repeats are paused."
        "needs_review" -> "Repeats need review because the task or access changed."
        else -> "Repeating · next occurrence ${recurrenceDateLabel(config.nextDueAt, config.timezone)}"
    }

private fun recurrenceDateLabel(
    value: String?,
    timezone: String,
): String =
    runCatching {
        DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
            .withZone(ZoneId.of(timezone)).format(checkNotNull(recurrenceDate(value)))
    }.getOrDefault("Date unavailable")
