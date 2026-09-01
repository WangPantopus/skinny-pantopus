package app.pantopus.android.ui.screens.notifications

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.theme.PantopusColors

/** Test tag on the notifications root container. */
const val NOTIFICATIONS_TAG = "notifications"

/**
 * T5.1 Notifications V2 + S5 RN parity. Thin wrapper around
 * [ListOfRowsScreen] — the three filter tabs (All / Unread / Read), the
 * date-bucketed sections, and the "Mark all read" top-bar action all
 * come from the VM.
 *
 * S5 adds the Personal / Audience firewall zone strip in the shell's
 * `customHeader` slot and the long-press delete confirmation.
 */
@Composable
fun NotificationsScreen(
    onBack: () -> Unit,
    viewModel: NotificationsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val topBarAction by viewModel.topBarAction.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val zone by viewModel.zone.collectAsStateWithLifecycle()
    val showsZoneStrip by viewModel.showsZoneStrip.collectAsStateWithLifecycle()
    val pendingDelete by viewModel.pendingDelete.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenNotificationsViewed)
    }

    Box(modifier = Modifier.fillMaxSize().testTag(NOTIFICATIONS_TAG)) {
        ListOfRowsScreen(
            title = "Notifications",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { viewModel.loadMoreIfNeeded() },
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = { viewModel.selectTab(it) },
            topBarAction = topBarAction,
            onBack = onBack,
            customHeader =
                if (showsZoneStrip) {
                    {
                        NotificationsZoneStrip(
                            zones = NotificationsZone.entries,
                            selected = zone,
                            onSelect = { viewModel.selectZone(it) },
                        )
                    }
                } else {
                    null
                },
        )
    }

    pendingDelete?.let { request ->
        AlertDialog(
            onDismissRequest = { viewModel.cancelDelete() },
            title = { Text("Delete notification?") },
            text = { Text("“${request.title}” will be removed from your notifications.") },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.confirmDelete() },
                    modifier = Modifier.testTag("notifications.deleteConfirm"),
                ) {
                    Text("Delete", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { viewModel.cancelDelete() },
                    modifier = Modifier.testTag("notifications.deleteCancel"),
                ) {
                    Text("Cancel")
                }
            },
        )
    }
}
