@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.issues

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch

/**
 * "Report Issue" create form for the per-home issue tracker. Mirrors
 * RN's inline create form (`src/app/homes/[id]/maintenance.tsx:127-137`):
 * required title + optional description, POSTed to
 * `/api/homes/:id/issues` (`backend/routes/home.js:4420`).
 *
 * [submit] returns true once the row exists server-side, at which point
 * the sheet closes.
 */
@Composable
fun ReportIssueSheet(
    submit: suspend (String, String?) -> Boolean,
    onClose: () -> Unit,
) {
    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val isValid = title.isNotBlank() && !isSubmitting

    FormShell(
        title = "Report an issue",
        isValid = isValid,
        isDirty = title.isNotEmpty() || description.isNotEmpty(),
        onClose = onClose,
        onCommit = {
            if (!isValid) return@FormShell
            scope.launch {
                isSubmitting = true
                errorMessage = null
                val created = submit(title.trim(), description.trim().ifEmpty { null })
                isSubmitting = false
                if (created) onClose() else errorMessage = "Failed to create issue"
            }
        },
        rightActionLabel = null,
        bottomActionLabel = if (isSubmitting) "Reporting…" else "Report Issue",
        isSaving = isSubmitting,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s4).testTag("reportIssueForm"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            errorMessage?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("reportIssueError"),
                )
            }
            FormFieldGroup(title = "Issue") {
                PantopusTextField(
                    label = "Issue title",
                    value = title,
                    onValueChange = { title = it },
                    placeholder = "Issue title",
                    isRequired = true,
                    fieldTestTag = "reportIssue_title",
                )
            }
            FormFieldGroup(title = "Details") {
                PantopusTextField(
                    label = "Description (optional)",
                    value = description,
                    onValueChange = { description = it },
                    placeholder = "Description (optional)",
                    modifier = Modifier.heightIn(min = 96.dp),
                    fieldTestTag = "reportIssue_description",
                )
            }
            Text(
                text = "Everyone with access to this home can see reported issues and their status.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}
