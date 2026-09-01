@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.vault

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.SecureScreenEffect
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.screens.shared.list_of_rows.SearchBarConfig
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.5e (P19.5) — Mailbox Vault list-of-rows surface. Personal pillar
 * (sky blue), not scoped to a home. Plugs the [VaultListViewModel]
 * into the shared [ListOfRowsScreen] shell.
 */
@Composable
fun VaultListScreen(
    onOpenItem: (String) -> Unit,
    onAddTapped: () -> Unit,
    onOpenMailbox: () -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: VaultListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val subtitle by viewModel.subtitle.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val selectedDrawer by viewModel.selectedDrawer.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.configureNavigation(
            onOpenItem = onOpenItem,
            onAddTapped = onAddTapped,
            onOpenMailbox = onOpenMailbox,
        )
        viewModel.load()
    }
    SecureScreenEffect()
    ListOfRowsScreen(
        title = "Vault",
        subtitle = subtitle,
        state = state,
        onRefresh = { viewModel.refresh() },
        onEndReached = {},
        onBack = onBack,
        tabs = VaultListViewModel.DRAWER_TABS,
        selectedTab = selectedDrawer,
        onSelectTab = { viewModel.onSelectDrawer(it) },
        searchBar =
            SearchBarConfig(
                placeholder = "Search sender, amount, date…",
                text = query,
                onChange = { viewModel.onQueryChange(it) },
            ),
        fab =
            FabAction(
                icon = PantopusIcon.Plus,
                contentDescription = "Save mail to vault",
                variant = FabVariant.SecondaryCreate,
                onClick = { viewModel.onFabTapped() },
            ),
    )
}
