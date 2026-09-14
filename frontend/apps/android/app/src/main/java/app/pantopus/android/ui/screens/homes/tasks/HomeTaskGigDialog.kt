package app.pantopus.android.ui.screens.homes.tasks

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.compose.gig.GigComposeCategory
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import java.text.NumberFormat
import java.util.Locale

private const val GIG_DIALOG_HEIGHT = 0.94f

@Composable
fun HomeTaskGigDialog(
    controller: HomeTaskGigController,
    onClosed: () -> Unit,
    onOpenGig: (String) -> Unit,
) {
    val state by controller.state.collectAsStateWithLifecycle()
    HomeTaskResumeEffect(controller::resume, controller::pause)
    DisposableEffect(controller) {
        onDispose {
            controller.close()
            onClosed()
        }
    }
    Dialog(
        onDismissRequest = controller::close,
        properties = DialogProperties(usePlatformDefaultWidth = false, securePolicy = SecureFlagPolicy.SecureOn),
    ) {
        Surface(Modifier.fillMaxWidth().fillMaxHeight(GIG_DIALOG_HEIGHT).testTag("homeTaskGig"), color = PantopusColors.appSurface) {
            Column(Modifier.padding(Spacing.s4).imePadding(), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Find help for this task", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                    TextButton(onClick = controller::close) { Text("Close") }
                }
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    if (!state.active) {
                        Text(state.error ?: "Publication content is hidden.")
                    } else {
                        if (state.busy) CircularProgressIndicator()
                        state.error?.let { Text(it, color = PantopusColors.error, modifier = Modifier.testTag("homeTaskGig.error")) }
                        HomeTaskGigContent(state, controller, onOpenGig)
                        TextButton(onClick = controller::reload, enabled = !state.busy) { Text("Reload publication") }
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeTaskGigContent(
    state: HomeTaskGigUiState,
    controller: HomeTaskGigController,
    onOpenGig: (String) -> Unit,
) {
    val task = state.task ?: return
    val publication = state.publication ?: return
    Text("Private household task", style = MaterialTheme.typography.titleSmall)
    Text(task.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.testTag("homeTaskGig.source"))
    Text("Review what helpers will see. Private mail, files and household access details stay private.")
    when {
        state.pending != null -> HomeTaskGigRecovery(state, controller, onOpenGig)
        publication.gigId != null -> {
            Text("This household task already has a published Gig.")
            TextButton(onClick = { controller.openGig(onOpenGig) }, enabled = !state.busy) { Text("Open Gig") }
        }
        !publication.canPublish -> Text("Use an open, unassigned household task and pause automatic repeats before publishing.")
        else -> HomeTaskGigControls(state, controller)
    }
}

@Composable
private fun HomeTaskGigControls(
    state: HomeTaskGigUiState,
    controller: HomeTaskGigController,
) {
    val input = state.input
    Text("Public details", style = MaterialTheme.typography.titleSmall)
    HomeTaskGigField("Public title", input.title, { controller.edit(input.copy(title = it)) }, state.canEdit, "title")
    TextButton(onClick = { controller.edit(input.copy(title = state.task?.title.orEmpty())) }, enabled = state.canEdit) {
        Text("Use household task title")
    }
    HomeTaskGigField(
        "Public description",
        input.description,
        { controller.edit(input.copy(description = it)) },
        state.canEdit,
        "description",
    )
    HomeTaskGigField(
        "Budget (USD)",
        input.budget,
        { controller.edit(input.copy(budget = it)) },
        state.canEdit,
        "budget",
        KeyboardType.Decimal,
    )
    HomeTaskGigChoice("Category", input.category, listOf("General") + GigComposeCategory.entries.map { it.label }, state.canEdit) {
        controller.edit(input.copy(category = it))
    }
    HomeTaskGigLocationControls(state, controller)
    HomeTaskGigChoice("Cancellation policy", input.policy, listOf("flexible", "standard", "strict"), state.canEdit) {
        controller.edit(input.copy(policy = it))
    }
    Text(
        when (input.policy) {
            "flexible" -> "Free cancellation before work starts."
            "standard" -> "A grace window applies after acceptance; cancellation fees may apply afterward."
            else -> "Cancellation fees may apply after acceptance."
        },
        style = MaterialTheme.typography.bodySmall,
    )
    Row(Modifier.fillMaxWidth()) {
        Checkbox(
            checked = state.reviewed,
            onCheckedChange = controller::review,
            enabled = state.canEdit,
            modifier =
                Modifier.testTag("homeTaskGig.reviewed").semantics {
                    contentDescription = "I reviewed the public details, location, budget and cancellation policy."
                },
        )
        Text("I reviewed the public details, location, budget and cancellation policy.", Modifier.weight(1f))
    }
    TextButton(onClick = controller::publish, enabled = state.canPublish, modifier = Modifier.testTag("homeTaskGig.publish")) {
        Text("Publish Gig")
    }
    Text("Publishing does not charge a card, assign a helper or complete your household task.", style = MaterialTheme.typography.bodySmall)
}

@Composable
private fun HomeTaskGigLocationControls(
    state: HomeTaskGigUiState,
    controller: HomeTaskGigController,
) {
    Text("Work location", style = MaterialTheme.typography.titleSmall)
    HomeTaskGigField(
        "Search an address",
        state.input.address,
        { controller.edit(state.input.copy(address = it)) },
        state.canEdit,
        "address",
    )
    TextButton(
        onClick = controller::searchAddress,
        enabled = state.canEdit && state.input.address.trim().length >= MIN_GIG_ADDRESS_QUERY,
    ) { Text("Find location") }
    state.suggestions.forEach { suggestion ->
        TextButton(onClick = { controller.chooseAddress(suggestion) }, enabled = state.canEdit) { Text(suggestion.label) }
    }
    state.location?.let { Text("Selected: ${it.address}", modifier = Modifier.testTag("homeTaskGig.selectedLocation")) }
    Text("City visibility. Exact address is shared after assignment.", style = MaterialTheme.typography.bodySmall)
}

@Composable
private fun HomeTaskGigRecovery(
    state: HomeTaskGigUiState,
    controller: HomeTaskGigController,
    onOpenGig: (String) -> Unit,
) {
    val pending = state.pending ?: return
    val confirmed = pending.confirmed != null
    Text(
        if (confirmed) "Original publication confirmed" else "Publication needs confirmation",
        style = MaterialTheme.typography.titleMedium,
    )
    Text(pending.request.title)
    Text(pending.request.description)
    Text("Original budget: ${NumberFormat.getCurrencyInstance(Locale.US).format(pending.request.price)}")
    Text(
        if (confirmed) {
            "This receipt records the original publication. Open the Gig to see its current status. Your household task is still separate."
        } else {
            "The original request is saved on this device. Retry it to confirm the outcome; retrying will not create a second Gig."
        },
    )
    if (confirmed) {
        TextButton(onClick = { controller.openGig(onOpenGig) }, enabled = !state.busy) { Text("Open Gig") }
    } else {
        TextButton(onClick = controller::retry, enabled = !state.busy) { Text("Retry original publication") }
    }
    if (confirmed || state.canDismiss) {
        TextButton(onClick = controller::acknowledge, enabled = !state.busy) {
            Text(if (confirmed) "I reviewed this confirmation" else "Review current task again")
        }
    }
}

/** Separate labels avoid the theme's floating-label Em/Sp interpolation crash. */
@Composable
private fun HomeTaskGigField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    enabled: Boolean,
    tag: String,
    keyboard: KeyboardType = KeyboardType.Text,
) {
    val focus = LocalFocusManager.current
    Text(label, style = MaterialTheme.typography.labelLarge)
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth().testTag("homeTaskGig.$tag").semantics { contentDescription = label },
        keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
    )
}

@Composable
private fun HomeTaskGigChoice(
    label: String,
    value: String,
    options: List<String>,
    enabled: Boolean,
    onChange: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        TextButton(onClick = { expanded = true }, enabled = enabled) { Text("$label: $value") }
        DropdownMenu(expanded = expanded && enabled, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(text = { Text(option) }, onClick = {
                    expanded = false
                    onChange(option)
                })
            }
        }
    }
}
