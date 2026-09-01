@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.documents

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.homes.HomeDocumentDto
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen

/**
 * T6.4b / P17 — Concrete Documents list screen wired to
 * `GET /api/homes/:id/documents` (route `backend/routes/home.js:4944`).
 *
 * @param onOpenDocument Invoked when a document row is tapped.
 * @param onUpload Invoked when the FAB or empty-state CTA fires.
 * @param onSearch Invoked when the top-bar search action fires.
 * @param onExport Invoked when the banner's "Export" CTA fires.
 * @param onDocumentAction Invoked from the kebab menu (View / Share /
 *     Download / Delete). Today's tap routes through `View`; a follow-up
 *     PR adds the menu sheet.
 * @param onBack Optional back handler.
 */
@Composable
fun DocumentsScreen(
    onOpenDocument: (HomeDocumentDto) -> Unit,
    onUpload: () -> Unit,
    onSearch: () -> Unit,
    onExport: () -> Unit,
    onDocumentAction: (HomeDocumentDto, DocumentAction) -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: DocumentsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedFilter by viewModel.selectedFilter.collectAsStateWithLifecycle()
    val chipStrip by viewModel.chipStrip.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(
            onOpenDocument = onOpenDocument,
            onUpload = onUpload,
            onSearch = onSearch,
            onExport = onExport,
            onDocumentAction = onDocumentAction,
        )
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenDocumentsViewed)
    }

    Box(modifier = Modifier.fillMaxSize().testTag("documentsList")) {
        ListOfRowsScreen(
            title = "Documents",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { },
            chipStrip = chipStrip.copy(selectedId = selectedFilter),
            topBarAction = viewModel.topBarAction,
            fab = viewModel.fab(),
            onBack = onBack,
            banner = banner,
        )
    }
}
