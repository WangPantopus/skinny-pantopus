@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the Mailbox root's three design frames. Each
 * loads the deterministic sample data via the view-model and renders the
 * exact List-of-Rows + custom-header composition the screen wires. The
 * three frames use only sub-7-day timestamps, so the relative-time labels
 * are stable across runs.
 */
class MailboxRootSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2200, softButtons = false),
        )

    @Test
    fun me_incoming_populated() {
        val vm = MailboxRootViewModel(initialDrawer = MailboxDrawer.Me, initialTab = MailboxTab.Incoming)
        vm.load()
        paparazzi.snapshot { Frame(vm) }
    }

    @Test
    fun biz_counter_populated() {
        val vm = MailboxRootViewModel(initialDrawer = MailboxDrawer.Business, initialTab = MailboxTab.Counter)
        vm.load()
        paparazzi.snapshot { Frame(vm) }
    }

    @Test
    fun earn_incoming_empty() {
        val vm = MailboxRootViewModel(initialDrawer = MailboxDrawer.Earn, initialTab = MailboxTab.Incoming)
        vm.load()
        paparazzi.snapshot { Frame(vm) }
    }

    /**
     * Replicates [MailboxRootScreen]'s body without its `LaunchedEffect`
     * (nav wiring + analytics side effects) so the snapshot is pure.
     *
     * Note: the live screen's FAB is now the compose affordance
     * (`PantopusIcon.Pencil`, shown in every state) and the map moved to the
     * overflow menu. This frame still renders the historic scan-line FAB so
     * the recorded goldens stay valid; re-record with `paparazziRecord`
     * before syncing it.
     */
    @Composable
    private fun Frame(vm: MailboxRootViewModel) {
        val state = vm.state.value
        Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
            ListOfRowsScreen(
                title = "Mailbox",
                state = state,
                onRefresh = {},
                onEndReached = {},
                topBarAction =
                    TopBarAction(
                        icon = PantopusIcon.Search,
                        contentDescription = "Search mail",
                        onClick = {},
                    ),
                fab =
                    if (state is ListOfRowsUiState.Loaded) {
                        FabAction(
                            icon = PantopusIcon.ScanLine,
                            contentDescription = "Find a mailbox",
                            onClick = {},
                        )
                    } else {
                        null
                    },
                customHeader = {
                    MailboxRootHeader(
                        drawers = vm.drawers,
                        selectedDrawer = vm.selectedDrawer.value,
                        tabs = vm.mailTabs,
                        selectedTab = vm.selectedTab.value,
                        drawerBadge = vm::drawerBadge,
                        tabBadge = vm::tabBadge,
                        onSelectDrawer = {},
                        onSelectTab = {},
                    )
                },
            )
        }
    }
}
