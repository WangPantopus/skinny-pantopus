@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.guests

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/** Test tag on the Guest passes list root container. */
const val GUEST_PASSES_LIST_TAG = "guestPassesList"

/**
 * A13.6 — Guest-pass management. Thin wrapper around [ListOfRowsScreen]
 * that adds the revoke confirm dialog and the revoke toast.
 *
 * RN parity target: `src/app/homes/[id]/share.tsx:84-90,152-190`.
 * Mirrors iOS `GuestPassesListView.swift`.
 */
@Composable
fun GuestPassesListScreen(
    onBack: () -> Unit,
    onAddGuest: () -> Unit,
    viewModel: GuestPassesListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

    var revokeTarget by remember { mutableStateOf<Pair<String, String>?>(null) }

    LaunchedEffect(Unit) {
        viewModel.load()
        // Re-entry after the Add Guest form popped: `load()` is a no-op
        // once content is cached, so ask for a refetch explicitly.
        viewModel.refreshIfLoaded()
    }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(TOAST_MS)
            viewModel.dismissToast()
        }
    }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            null -> Unit
            GuestPassesEvent.OpenAddGuest -> {
                onAddGuest()
                viewModel.acknowledgeEvent()
            }
            is GuestPassesEvent.ConfirmRevoke -> {
                revokeTarget = event.passId to event.label
                viewModel.acknowledgeEvent()
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag(GUEST_PASSES_LIST_TAG)) {
        ListOfRowsScreen(
            title = "Guest passes",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { viewModel.loadMoreIfNeeded() },
            fab = viewModel.fab,
            onBack = onBack,
        )

        toast?.let {
            Toast(
                message =
                    ToastMessage(
                        text = it.text,
                        kind = if (it.isError) ToastKind.Error else ToastKind.Success,
                    ),
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s12)
                        .testTag("guestPassesToast"),
            )
        }
    }

    revokeTarget?.let { (passId, label) ->
        AlertDialog(
            onDismissRequest = { revokeTarget = null },
            title = { Text("Revoke access?") },
            text = { Text("$label will immediately lose access to this home.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.revoke(passId)
                        revokeTarget = null
                    },
                    modifier = Modifier.testTag("guestPassesList_revokeConfirm"),
                ) { Text("Revoke $label") }
            },
            dismissButton = {
                TextButton(onClick = { revokeTarget = null }) { Text("Cancel") }
            },
        )
    }
}

private const val TOAST_MS = 2_000L
