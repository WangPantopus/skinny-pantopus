package app.pantopus.android.ui.screens.wallet

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
 * Concrete List-of-Rows screen backed by [ReceivedInvoicesViewModel]: the invoices businesses sent you, opened from
 * the Wallet's Invoices row. Wired to `GET /api/businesses/invoices/received` — `backend/routes/businesses.js:4747`.
 *
 * @param onOpenInvoice Invoked with the invoice id when a row is tapped.
 * @param onBack Back to the Wallet.
 */
@Composable
fun ReceivedInvoicesScreen(
    onOpenInvoice: (String) -> Unit,
    onBack: () -> Unit,
    viewModel: ReceivedInvoicesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val refreshNotice by viewModel.refreshNotice.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onOpenInvoice = onOpenInvoice)
        viewModel.load()
    }

    Box(modifier = Modifier.fillMaxSize().testTag("receivedInvoices")) {
        ListOfRowsScreen(
            title = "Invoices",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { },
            onBack = onBack,
            banner = banner,
            refreshing = refreshing,
            refreshNotice = refreshNotice,
        )
    }
}
