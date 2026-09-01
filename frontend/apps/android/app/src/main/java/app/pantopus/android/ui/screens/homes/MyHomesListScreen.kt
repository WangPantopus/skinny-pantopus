@file:Suppress("LongMethod")

package app.pantopus.android.ui.screens.homes

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
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusIcon

/** Test tag on the My homes list root container. */
const val MY_HOMES_LIST_TAG = "myHomesList"

/**
 * `GET /api/homes/my-homes` wrapped in the List-of-Rows archetype
 * (T6.3f / P14 refresh — `.SecondaryCreate` 52dp FAB tinted
 * [FabTint.Home], plus the home-tinted intro banner).
 *
 * Rows whose `can_delete_home` flag is set expose a kebab that opens the
 * destructive "Delete home" confirm (`DELETE /api/homes/:id`).
 */
@Composable
fun MyHomesListScreen(
    onOpenHome: (String) -> Unit,
    onAddHome: () -> Unit,
    onBack: (() -> Unit)? = null,
    /**
     * A12.1 discovery entry point — mirrors RN's `/homes/find` route,
     * which is how a user joins a home someone else already created.
     */
    onFindHome: (() -> Unit)? = null,
    /** Row CTA for a home whose owner claim is still pending. */
    onUploadOwnershipEvidence: ((String) -> Unit)? = null,
    /** Row CTA for a home whose occupancy is not verified yet. */
    onVerifyResidency: ((String) -> Unit)? = null,
    viewModel: MyHomesListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()
    val actionError by viewModel.actionError.collectAsStateWithLifecycle()

    var deleteTarget by remember { mutableStateOf<Pair<String, String>?>(null) }

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(
            onOpenHome = onOpenHome,
            onAddHome = onAddHome,
            onUploadOwnershipEvidence = onUploadOwnershipEvidence,
            onVerifyResidency = onVerifyResidency,
        )
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenMyHomesViewed)
    }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            null -> Unit
            is MyHomesListEvent.ConfirmDelete -> {
                deleteTarget = event.homeId to event.name
                viewModel.acknowledgeEvent()
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag(MY_HOMES_LIST_TAG)) {
        ListOfRowsScreen(
            title = "My homes",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { /* not paginated */ },
            topBarAction =
                onFindHome?.let {
                    TopBarAction(
                        icon = PantopusIcon.Search,
                        contentDescription = "Find or add a home",
                        onClick = it,
                    )
                },
            fab =
                FabAction(
                    icon = PantopusIcon.PlusCircle,
                    contentDescription = "Claim a home",
                    variant = FabVariant.SecondaryCreate,
                    tint = FabTint.Home,
                    onClick = onAddHome,
                ),
            onBack = onBack,
            banner = banner,
        )
    }

    deleteTarget?.let { (homeId, name) ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete home") },
            text = {
                Text(
                    "Are you sure you want to permanently delete “$name”? " +
                        "This removes it for all members.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteHome(homeId)
                        deleteTarget = null
                    },
                    modifier = Modifier.testTag("myHomesList_deleteConfirm"),
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("Cancel") }
            },
        )
    }

    actionError?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.clearActionError() },
            title = { Text("Couldn’t delete home") },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = { viewModel.clearActionError() }) { Text("OK") }
            },
        )
    }
}
