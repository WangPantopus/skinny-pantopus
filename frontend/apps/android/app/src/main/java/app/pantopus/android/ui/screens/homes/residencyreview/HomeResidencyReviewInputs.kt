package app.pantopus.android.ui.screens.homes.residencyreview

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.ImeAction
import app.pantopus.android.data.homes.HomeResidencyDecision
import app.pantopus.android.data.homes.HomeResidencyReviewRole

@Composable
internal fun HomeResidencyReviewInputs(
    state: HomeResidencyReviewUiState,
    viewModel: HomeResidencyReviewViewModel,
) {
    val focus = LocalFocusManager.current
    Text("Review your decision", style = MaterialTheme.typography.titleMedium)
    ReviewChoice(
        "Residency decision",
        state.action.title,
        "homeResidencyReview.action",
        state.canEdit,
        HomeResidencyDecision.entries.map { it.title to { viewModel.changeAction(it) } },
    )
    if (state.action == HomeResidencyDecision.Approve) {
        Text(
            "Confirm residency within the existing role, age and access limits. " +
                "Existing verified memberships keep their role and restrictions. " +
                "Ownership and expired or removed access need their own review.",
            style = MaterialTheme.typography.bodySmall,
        )
        ReviewChoice(
            "Role for an unverified membership",
            state.role.title,
            "homeResidencyReview.role",
            state.canEdit,
            HomeResidencyReviewRole.entries.map { it.title to { viewModel.changeRole(it) } },
        )
    } else {
        Text("Reject this pending residency claim. Existing membership access stays unchanged.", style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
            value = state.reason,
            onValueChange = viewModel::changeReason,
            enabled = state.canEdit,
            label = { Text("Reason for rejection (optional)") },
            minLines = 3,
            modifier = Modifier.fillMaxWidth().testTag("homeResidencyReview.reason"),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
        )
        Text("${state.reason.length}/2000", style = MaterialTheme.typography.bodySmall)
    }
    Row(
        Modifier.fillMaxWidth().testTag("homeResidencyReview.reviewed")
            .toggleable(value = state.reviewed, enabled = state.canEdit, role = Role.Checkbox, onValueChange = viewModel::confirm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = state.reviewed, onCheckedChange = null, enabled = state.canEdit)
        Text("I reviewed the current claim, membership limits and selected decision.", Modifier.weight(1f))
    }
    TextButton(onClick = {
        focus.clearFocus()
        viewModel.submit()
    }, enabled = state.canSubmit, modifier = Modifier.testTag("homeResidencyReview.submit")) {
        Text("Save residency decision")
    }
}

@Composable
private fun ReviewChoice(
    label: String,
    selected: String,
    tag: String,
    enabled: Boolean,
    choices: List<Pair<String, () -> Unit>>,
) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        TextButton(onClick = { expanded = true }, enabled = enabled, modifier = Modifier.testTag(tag)) { Text("$label: $selected") }
        DropdownMenu(expanded = expanded && enabled, onDismissRequest = { expanded = false }) {
            choices.forEach { (title, action) ->
                DropdownMenuItem(text = { Text(title) }, onClick = {
                    action()
                    expanded = false
                })
            }
        }
    }
}
