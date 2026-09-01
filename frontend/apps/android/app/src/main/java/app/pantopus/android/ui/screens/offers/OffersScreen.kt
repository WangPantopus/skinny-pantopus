@file:Suppress("LongMethod", "MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.offers

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.offers.BidDto
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.settings.payments.StripePaymentSheets
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivityFilterSheet
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import com.stripe.android.paymentsheet.rememberPaymentSheet

/** Test tag on the offers root container. */
const val OFFERS_TAG = "offers"

/**
 * T5.2.4 — Cross-listing Offers. Thin wrapper around [ListOfRowsScreen].
 * Two tabs (Received / Sent), no FAB, filter icon in the top-bar
 * trailing slot. Row taps surface a [BidDto] so the host nav graph can
 * push the gig (offer) detail.
 *
 * RN parity: pending Received rows carry Accept (with Stripe
 * PaymentSheet authorization) + Reject; pending / countered Sent rows
 * carry Withdraw. Each is confirmed before it fires and toasts either
 * way (`pantopus/frontend/apps/mobile/src/app/offers.tsx`).
 */
@Composable
fun OffersScreen(
    onBack: () -> Unit,
    onOpenOfferDetail: (BidDto) -> Unit,
    onBrowseListings: () -> Unit = {},
    onPostTask: () -> Unit = {},
    viewModel: OffersViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val topBarAction by viewModel.topBarAction.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val showFilterSheet by viewModel.showFilterSheet.collectAsStateWithLifecycle()
    val activityFilter by viewModel.activityFilter.collectAsStateWithLifecycle()
    val acceptCandidate by viewModel.acceptCandidate.collectAsStateWithLifecycle()
    val rejectCandidate by viewModel.rejectCandidate.collectAsStateWithLifecycle()
    val withdrawCandidate by viewModel.withdrawCandidate.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val paymentSheet =
        rememberPaymentSheet { result ->
            viewModel.onCheckoutOutcome(StripePaymentSheets.checkoutOutcome(result))
        }

    LaunchedEffect(Unit) {
        viewModel.bindCallbacks(
            onOpenOfferDetail = onOpenOfferDetail,
            onBrowseListings = onBrowseListings,
            onPostTask = onPostTask,
        )
        viewModel.load()
    }
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is OffersEvent.PresentCheckout ->
                    paymentSheet.presentWithPaymentIntent(
                        paymentIntentClientSecret = event.params.clientSecret.orEmpty(),
                        configuration =
                            StripePaymentSheets.paymentConfiguration(
                                context = context,
                                customerId = event.params.customer,
                                ephemeralKey = event.params.ephemeralKey,
                                publishableKey = event.params.publishableKey,
                            ),
                    )
            }
        }
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            kotlinx.coroutines.delay(2_500)
            viewModel.consumeToast()
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag(OFFERS_TAG)) {
        ListOfRowsScreen(
            title = "Offers",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { viewModel.loadMoreIfNeeded() },
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = { viewModel.selectTab(it) },
            topBarAction = topBarAction,
            onBack = onBack,
        )
        toast?.let { message ->
            Toast(
                message =
                    ToastMessage(
                        text = message.text,
                        kind = if (message.isError) ToastKind.Error else ToastKind.Success,
                    ),
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10)
                        .testTag("offers-toast"),
            )
        }
    }

    if (showFilterSheet) {
        ActivityFilterSheet(
            statusTitle = viewModel.statusFilterTitle,
            statusOptions = viewModel.statusFilterOptions,
            sortOptions = viewModel.sortFilterOptions,
            filter = activityFilter,
            onApply = { viewModel.applyFilter(it) },
            onDismiss = { viewModel.dismissFilterSheet() },
        )
    }

    acceptCandidate?.let { dto ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissAcceptConfirm() },
            title = { Text(OffersViewModel.acceptConfirmTitle(dto)) },
            text = { Text(OffersViewModel.acceptConfirmMessage(dto)) },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.confirmAccept() },
                    modifier = Modifier.testTag("offers.acceptConfirm"),
                ) {
                    Text(OffersViewModel.acceptConfirmCta(dto))
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissAcceptConfirm() }) {
                    Text(OffersViewModel.acceptConfirmCancel(dto))
                }
            },
        )
    }

    rejectCandidate?.let { dto ->
        val title = dto.gig?.title ?: "this task"
        AlertDialog(
            onDismissRequest = { viewModel.dismissRejectConfirm() },
            title = { Text("Reject offer") },
            text = { Text("The bidder on “$title” is notified and can't be selected afterwards.") },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.confirmReject() },
                    modifier = Modifier.testTag("offers.rejectConfirm"),
                ) {
                    Text("Reject", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissRejectConfirm() }) { Text("Keep offer") }
            },
        )
    }

    withdrawCandidate?.let { dto ->
        val title = dto.gig?.title ?: "this task"
        AlertDialog(
            onDismissRequest = { viewModel.dismissWithdrawConfirm() },
            title = { Text("Withdraw offer") },
            text = { Text("Your offer on “$title” will be removed. You can bid again while it stays open.") },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.confirmWithdraw() },
                    modifier = Modifier.testTag("offers.withdrawConfirm"),
                ) {
                    Text("Withdraw", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissWithdrawConfirm() }) { Text("Keep offer") }
            },
        )
    }
}
