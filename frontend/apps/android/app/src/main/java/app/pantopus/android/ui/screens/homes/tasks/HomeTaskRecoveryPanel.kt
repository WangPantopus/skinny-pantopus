@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import app.pantopus.android.ui.screens.shared.form.FormShell

/** Retry is an explicit button; a clean recovery record is not a dirty editable form. */
@Composable
internal fun HomeTaskRecoveryPanel(
    title: String,
    message: String,
    busy: Boolean,
    onRetry: () -> Unit,
    onClose: () -> Unit,
    onClear: (() -> Unit)? = null,
) {
    FormShell(
        title = title,
        isValid = false,
        isDirty = false,
        isSaving = busy,
        rightActionLabel = null,
        onClose = onClose,
        onCommit = {},
    ) {
        Text(message)
        TextButton(onClick = onRetry, enabled = !busy) { Text("Retry original request") }
        if (onClear != null) {
            Text(
                "The server rejected this request or its task is no longer available. " +
                    "Clearing closes this form without creating or deleting a task.",
            )
            TextButton(onClick = onClear, enabled = !busy) { Text("Clear saved request") }
        }
    }
}
