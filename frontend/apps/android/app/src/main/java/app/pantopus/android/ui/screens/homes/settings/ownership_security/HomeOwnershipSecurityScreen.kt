@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.ownership_security

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.perf.ReportContentShown
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.screens.homes.HomeCopyLifecycle
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState

/**
 * A14.2 (policy variant) — "Ownership & Security". Thin wrapper around
 * [GroupedListScreen]; the view-model owns the three radio groups, the
 * status banner, and the quorum "requires owner approval" state.
 */
@Composable
fun HomeOwnershipSecurityScreen(
    onBack: () -> Unit = {},
    viewModel: HomeOwnershipSecurityViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ReportContentShown("home_security", state is GroupedListUiState.Loaded)
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val footerCaption by viewModel.footerCaption.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()
    val refreshNotice by viewModel.refreshNotice.collectAsStateWithLifecycle()
    HomeCopyLifecycle(viewModel::load, viewModel::suspendContent)
    OfflineBannerHost(isOffline = !online) {
        GroupedListScreen(
            title = viewModel.title,
            state = state,
            footerCaption = footerCaption,
            banner = banner,
            refreshNotice = refreshNotice,
            callbacks =
                GroupedListCallbacks(
                    onBack = onBack,
                    onSelectRadio = viewModel::onSelectRadio,
                    onTapBanner = viewModel::onDismissBanner,
                    onRetry = viewModel::refresh,
                ),
        )
    }
}
