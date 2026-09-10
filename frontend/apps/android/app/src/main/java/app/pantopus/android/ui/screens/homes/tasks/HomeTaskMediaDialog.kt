package app.pantopus.android.ui.screens.homes.tasks

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.homes.HomeTaskMediaDto
import app.pantopus.android.data.homes.HOME_EVIDENCE_MIMES
import app.pantopus.android.ui.screens.homes.claim_evidence.PrivateHomeFilePreview
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.io.IOException

private const val MEDIA_DIALOG_FRACTION = 0.94f

@Composable
fun HomeTaskMediaDialog(controller: HomeTaskMediaController) {
    val state by controller.state.collectAsStateWithLifecycle()
    var removing by remember { mutableStateOf<HomeTaskMediaDto?>(null) }
    val choose = rememberTaskMediaPicker(controller)
    HomeTaskResumeEffect(controller::resume, controller::pause)
    DisposableEffect(controller) { onDispose { controller.close() } }
    Dialog(onDismissRequest = controller::close, properties = DialogProperties(
        usePlatformDefaultWidth = false, securePolicy = SecureFlagPolicy.SecureOn,
    )) {
        Surface(Modifier.fillMaxWidth().fillMaxHeight(MEDIA_DIALOG_FRACTION).testTag("homeTaskMedia"), color = PantopusColors.appSurface) {
            Column(
                Modifier.padding(Spacing.s4).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Private attachments")
                    TextButton(onClick = controller::close) { Text("Close") }
                }
                if (!state.active) {
                    Text(state.error ?: "Attachment content is hidden.")
                } else {
                    choose.error?.let { Text(it, color = PantopusColors.error) }
                    TaskMediaContent(state, controller, choose.launch) { removing = it }
                }
            }
        }
    }
    removing?.let { record ->
        AlertDialog(
            onDismissRequest = { removing = null },
            title = { Text("Remove attachment?") },
            text = { Text("The private file will be removed. Its history remains.") },
            confirmButton = { TextButton(onClick = { removing = null; controller.remove(record) }) { Text("Remove") } },
            dismissButton = { TextButton(onClick = { removing = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun TaskMediaContent(
    state: HomeTaskMediaState,
    controller: HomeTaskMediaController,
    choose: () -> Unit,
    remove: (HomeTaskMediaDto) -> Unit,
) {
    Text("PDF, text or supported images up to 25 MB. Current task access is required to read them.")
    if (state.busy) CircularProgressIndicator()
    state.error?.let { Text(it, color = PantopusColors.error) }
    state.notice?.let { Text(it) }
    if (state.mayChoose) TextButton(onClick = choose, modifier = Modifier.testTag("homeTaskMedia.choose")) { Text("Choose attachment") }
    TaskMediaPendingControls(state, controller::upload, controller::discardUnsent, controller::acknowledgeRemovedUpload)
    state.removing?.let { original ->
        Text("Removal is unconfirmed. Retry the same attachment.")
        TextButton(onClick = { controller.retryRemoval(original.id) }, enabled = state.mayRetryRemoval) { Text("Retry removal") }
    }
    state.media.forEach { record ->
        Text(record.fileName)
        Text(mediaStatus(record))
        if (record.available) TextButton(onClick = { controller.open(record) }, enabled = !state.busy) { Text("Open attachment") }
        if (state.mayRemove(record)) TextButton(onClick = { remove(record) }) {
            Text(if (record.cleanupPending == true) "Retry file cleanup" else "Remove attachment")
        }
    }
    state.preview?.let { preview ->
        Text(preview.record.fileName)
        PrivateHomeFilePreview(preview.content.bytes, preview.content.mimeType)
        TextButton(onClick = controller::reload) { Text("Close preview") }
    }
    TextButton(onClick = controller::reload, enabled = !state.busy) { Text("Reload attachments") }
}

@Composable
internal fun TaskMediaPendingControls(
    state: HomeTaskMediaState,
    upload: (String) -> Unit,
    discard: (String) -> Unit,
    acknowledge: (String) -> Unit,
) {
    state.pending?.let { pending ->
        Text("Selected: ${pending.localName}")
        if (state.mayAcknowledge) {
            Text("The server confirmed this upload was removed. Clear this local request before choosing another file.")
            TextButton(onClick = { acknowledge(pending.id) }, modifier = Modifier.testTag("homeTaskMedia.clearRemoved")) {
                Text("Clear removed upload")
            }
        } else {
            Text("Retry the same file until its upload is confirmed. Reopening attachments checks current server status.")
            TextButton(
                onClick = { upload(pending.id) }, enabled = state.mayRetryUpload, modifier = Modifier.testTag("homeTaskMedia.retry"),
            ) {
                Text("Save or retry this attachment")
            }
            if (state.mayDiscard) TextButton(onClick = { discard(pending.id) }) { Text("Discard unsubmitted file") }
        }
    }
}

private fun mediaStatus(record: HomeTaskMediaDto): String = when (record.state) {
    "legacy" -> "Older attachment unavailable. Verified reupload is required."
    "reserved" -> "Upload incomplete. Retry the original file or remove this reservation before choosing it again."
    "retired" -> if (record.cleanupPending == true) "Hidden; cleanup needs a retry" else "Removed; history retained"
    else -> "Private file · ${record.fileSize} bytes"
}

@Composable
private fun rememberTaskMediaPicker(controller: HomeTaskMediaController): TaskMediaPicker {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var revision by remember { mutableStateOf<Int?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        val ticket = revision
        revision = null
        if (uri != null && ticket != null) scope.launch {
            try {
                val file = readTaskMediaSelection(context, uri)
                try {
                    // The system picker pauses the activity. Wait for the same panel's current access check.
                    controller.state.first {
                        val ready = it.active && !it.busy
                        !it.visible || it.error != null || ready
                    }
                    controller.picked(file.name, file.mimeType, file.bytes, ticket)
                } finally {
                    file.bytes.fill(0)
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: IOException) {
                error = failure.message ?: "Could not read this file. Choose it again."
            } catch (failure: IllegalArgumentException) {
                error = failure.message ?: "Choose a supported file of 25 MB or less."
            } catch (failure: SecurityException) {
                error = failure.message ?: "The selected file is no longer available. Choose it again."
            } catch (failure: IllegalStateException) {
                error = failure.message ?: "Choose a supported file of 25 MB or less."
            }
        }
    }
    return TaskMediaPicker({
        controller.beginPick()?.let { ticket ->
            error = null
            revision = ticket
            picker.launch(HOME_EVIDENCE_MIMES.toTypedArray())
        }
    }, error)
}

private data class TaskMediaPicker(val launch: () -> Unit, val error: String?)
