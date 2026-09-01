@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.pets

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.homes.PetDto
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen

/** Test tag on the Pets list root container. */
const val PETS_LIST_TAG = "petsList"

/**
 * T5.2.1 Pets list. Thin wrapper around [ListOfRowsScreen]; the VM
 * supplies the rows + chrome and emits a [PetsListEvent] when a row
 * action needs the screen to present a sheet or confirm dialog.
 */
@Composable
fun PetsListScreen(
    onBack: () -> Unit,
    viewModel: PetsListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    var addingPet by remember { mutableStateOf(false) }
    var editingPet by remember { mutableStateOf<PetDto?>(null) }
    var deleteTarget by remember { mutableStateOf<Pair<String, String>?>(null) }

    LaunchedEffect(Unit) {
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenPetsListViewed)
    }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            null -> Unit
            PetsListEvent.OpenAdd -> {
                addingPet = true
                viewModel.acknowledgeEvent()
            }
            is PetsListEvent.OpenEdit -> {
                editingPet = event.pet
                viewModel.acknowledgeEvent()
            }
            is PetsListEvent.ConfirmDelete -> {
                deleteTarget = event.petId to event.name
                viewModel.acknowledgeEvent()
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag(PETS_LIST_TAG)) {
        ListOfRowsScreen(
            title = "Pets",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { viewModel.loadMoreIfNeeded() },
            fab = viewModel.fab,
            onBack = onBack,
        )
    }

    if (addingPet) {
        AddPetWizardSheet(
            homeId = viewModel.homeId,
            existing = null,
            onClose = { result ->
                addingPet = false
                result?.let(viewModel::handleCreated)
            },
        )
    }

    editingPet?.let { pet ->
        AddPetWizardSheet(
            homeId = viewModel.homeId,
            existing = pet,
            onClose = { result ->
                editingPet = null
                result?.let(viewModel::handleUpdated)
            },
        )
    }

    deleteTarget?.let { (petId, name) ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Remove pet?") },
            text = { Text("$name will be removed from this home.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deletePet(petId)
                        deleteTarget = null
                    },
                    modifier = Modifier.testTag("petsList_deleteConfirm"),
                ) { Text("Remove") }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("Cancel") }
            },
        )
    }
}
