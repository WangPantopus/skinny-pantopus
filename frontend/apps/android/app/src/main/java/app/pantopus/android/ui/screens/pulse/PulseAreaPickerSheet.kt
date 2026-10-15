package app.pantopus.android.ui.screens.pulse

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/** S5's home areas and "another place"; browsing never writes a home or uses device location. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PulseAreaPickerSheet(
    selectedId: String?,
    onSelect: (String?) -> Unit,
    onDismiss: () -> Unit,
    viewModel: PulseAreaPickerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val searching by viewModel.searching.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    LaunchedEffect(viewModel) { viewModel.open() }
    DisposableEffect(viewModel) { onDispose { viewModel.dismiss() } }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.background,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().fillMaxHeight(SHEET_HEIGHT).padding(Spacing.s4).testTag("pulseAreaPicker"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = if (searching) "Pick a town to look around" else "Viewing area",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.semantics { heading() },
            )
            if (searching) {
                PantopusTextField(
                    label = "Find a town",
                    value = query,
                    onValueChange = viewModel::search,
                    fieldTestTag = "pulseAreaSearch",
                )
            }
            TextButton(onClick = if (searching) viewModel::open else viewModel::browseTowns) {
                Text(if (searching) "Your areas" else "Another place")
            }
            Box(modifier = Modifier.weight(1f)) {
                PulseAreaResults(state, searching, selectedId, onSelect, viewModel::refresh)
            }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Cancel") }
        }
    }
}

@Composable
private fun PulseAreaResults(
    state: PulseAreaPickerState,
    searching: Boolean,
    selectedId: String?,
    onSelect: (String?) -> Unit,
    onRetry: () -> Unit,
) {
    when (state) {
        PulseAreaPickerState.Loading ->
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                repeat(SKELETON_ROWS) { Shimmer(modifier = Modifier.fillMaxWidth(), height = Spacing.s12) }
            }
        PulseAreaPickerState.Empty ->
            EmptyState(
                icon = PantopusIcon.MapPin,
                headline = if (searching) "No towns found" else "No open areas yet",
                subcopy = if (searching) "Try another town name." else "Choose Another place to look around an open town.",
            )
        is PulseAreaPickerState.Error ->
            EmptyState(
                icon = PantopusIcon.AlertCircle,
                headline = "Couldn't load areas",
                subcopy = state.message,
                ctaTitle = "Retry",
                onCta = onRetry,
            )
        is PulseAreaPickerState.Loaded ->
            LazyColumn(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                items(state.choices, key = { it.id ?: "home-town" }) { choice ->
                    PulseAreaRow(choice, choice.id == selectedId, onSelect)
                }
            }
    }
}

@Composable
private fun PulseAreaRow(
    choice: PulseAreaChoice,
    isSelected: Boolean,
    onSelect: (String?) -> Unit,
) {
    Row(
        modifier =
            Modifier.fillMaxWidth().heightIn(min = Spacing.s12)
                .clickable(role = Role.Button) { onSelect(choice.id) }
                .semantics { selected = isSelected }
                .padding(vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(choice.name, color = MaterialTheme.colorScheme.onSurface, fontSize = 16.sp, modifier = Modifier.weight(1f))
        if (isSelected) {
            PantopusIconImage(
                PantopusIcon.Check,
                contentDescription = "Selected",
                size = Spacing.s5,
                tint = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

private const val SHEET_HEIGHT = 0.85f
private const val SKELETON_ROWS = 4
