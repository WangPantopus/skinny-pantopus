@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.ownership_security

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen

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
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val footerCaption by viewModel.footerCaption.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    OfflineBannerHost(isOffline = !online) {
        GroupedListScreen(
            title = viewModel.title,
            state = state,
            footerCaption = footerCaption,
            banner = banner,
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
