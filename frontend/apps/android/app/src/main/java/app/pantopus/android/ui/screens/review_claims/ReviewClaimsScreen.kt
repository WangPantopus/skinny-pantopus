@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.review_claims

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen

/**
 * Test tag on the Review Claims screen root container. Mirrors iOS
 * `accessibilityIdentifier("reviewClaims")`.
 */
const val REVIEW_CLAIMS_TAG = "reviewClaims"

/**
 * P1.1 — Admin Review-claims queue. Thin wrapper around
 * [ListOfRowsScreen]. Three-tab strip on top of avatar-first rows with
 * triage / evidence chips and a "Review claim" footer button.
 */
@Composable
fun ReviewClaimsScreen(
    onBack: () -> Unit,
    onOpenClaim: (String) -> Unit,
    viewModel: ReviewClaimsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onOpenClaim = onOpenClaim
        viewModel.load()
    }

    Box(modifier = Modifier.fillMaxSize().testTag(REVIEW_CLAIMS_TAG)) {
        ListOfRowsScreen(
            title = "Review claims",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = {},
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = viewModel::selectTab,
            banner = banner,
            onBack = onBack,
        )
    }
}
