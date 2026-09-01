@file:Suppress("PackageNaming")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.my_bids

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.offers.BidDto
import app.pantopus.android.data.api.models.offers.WithdrawBidReason
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivityFilterSheet
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the My bids root container. */
const val MY_BIDS_TAG = "my-bids"

private const val TOAST_DISMISS_DELAY_MS = 2_500L

/**
 * T5.3.1 — My bids. Thin wrapper around [ListOfRowsScreen]. Four tabs
 * (Active / Accepted / Rejected / Done), 48dp extended-pill FAB
 * labelled "Browse tasks", filter icon in the top-bar trailing slot,
 * and a primary-tinted banner above the Active tab. The screen-bespoke
 * pieces attached at the bottom are the WithdrawBidSheet plus the
 * P3.4 Edit Bid + Leave Review sheets.
 */
@Composable
@Suppress("LongParameterList")
fun MyBidsScreen(
    onBack: () -> Unit,
    onOpenBid: (BidDto) -> Unit,
    onBrowseTasks: () -> Unit = {},
    onMessageClient: (BidDto) -> Unit = {},
    viewModel: MyBidsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val topBarAction by viewModel.topBarAction.collectAsStateWithLifecycle()
    val fab by viewModel.fab.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val withdrawTarget by viewModel.withdrawTarget.collectAsStateWithLifecycle()
    val editBidTarget by viewModel.editBidTarget.collectAsStateWithLifecycle()
    val leaveReviewTarget by viewModel.leaveReviewTarget.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val showFilterSheet by viewModel.showFilterSheet.collectAsStateWithLifecycle()
    val activityFilter by viewModel.activityFilter.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.bindCallbacks(
            onOpenBid = onOpenBid,
            onBrowseTasks = onBrowseTasks,
            onMessageClient = onMessageClient,
        )
        viewModel.load()
    }

    LaunchedEffect(toast) {
        if (toast != null) {
            kotlinx.coroutines.delay(TOAST_DISMISS_DELAY_MS)
            viewModel.dismissToast()
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag(MY_BIDS_TAG)) {
        ListOfRowsScreen(
            title = "My bids",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { viewModel.loadMoreIfNeeded() },
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = { viewModel.selectTab(it) },
            topBarAction = topBarAction,
            fab = fab,
            banner = banner,
            onBack = onBack,
        )

        toast?.let { payload -> MyBidsToastOverlay(payload) }
    }

    WithdrawBidSheet(
        target = withdrawTarget,
        onCancel = { viewModel.cancelWithdraw() },
        onConfirm = { reason -> viewModel.confirmWithdraw(reason) },
    )

    EditBidSheet(
        target = editBidTarget,
        onCancel = { viewModel.cancelEditBid() },
        onSubmit = { draft -> viewModel.submitEditBid(draft) },
    )

    LeaveReviewSheet(
        target = leaveReviewTarget,
        onCancel = { viewModel.cancelLeaveReview() },
        onSubmit = { draft -> viewModel.submitLeaveReview(draft) },
    )

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
}

@Composable
private fun MyBidsToastOverlay(payload: MyBidsToast) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Box(
            modifier =
                Modifier
                    .padding(bottom = Spacing.s10, start = Spacing.s4, end = Spacing.s4)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(
                        if (payload.isError) PantopusColors.error else PantopusColors.success,
                    )
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                    .testTag("my-bids-toast"),
        ) {
            Text(
                text = payload.text,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun WithdrawBidSheet(
    target: WithdrawSheetTarget?,
    onCancel: () -> Unit,
    onConfirm: (WithdrawBidReason?) -> Unit,
) {
    if (target == null) return

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onCancel,
        sheetState = sheetState,
    ) {
        WithdrawBidSheetContent(
            target = target,
            onCancel = onCancel,
            onConfirm = onConfirm,
        )
    }
}

@Composable
private fun EditBidSheet(
    target: EditBidSheetTarget?,
    onCancel: () -> Unit,
    onSubmit: suspend (EditBidDraft) -> Boolean,
) {
    if (target == null) return

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onCancel,
        sheetState = sheetState,
    ) {
        EditBidSheetContent(
            target = target,
            onSubmit = onSubmit,
            onCancel = onCancel,
        )
    }
}

@Composable
private fun LeaveReviewSheet(
    target: LeaveReviewSheetTarget?,
    onCancel: () -> Unit,
    onSubmit: suspend (LeaveReviewDraft) -> Boolean,
) {
    if (target == null) return

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onCancel,
        sheetState = sheetState,
    ) {
        LeaveReviewSheetContent(
            target = target,
            onSubmit = onSubmit,
            onCancel = onCancel,
        )
    }
}

@Composable
private fun WithdrawBidSheetContent(
    target: WithdrawSheetTarget,
    onCancel: () -> Unit,
    onConfirm: (WithdrawBidReason?) -> Unit,
) {
    var selected by remember { mutableStateOf<WithdrawBidReason?>(null) }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = "Withdraw bid",
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Why are you withdrawing your bid on ${target.gigTitle}?",
                fontSize = 14.sp,
                color = PantopusColors.appTextSecondary,
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            for (reason in WithdrawBidReason.entries) {
                ReasonRow(
                    reason = reason,
                    isSelected = selected == reason,
                    onClick = { selected = reason },
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SecondaryButton(
                text = "Cancel",
                modifier = Modifier.weight(1f).testTag("withdraw-cancel"),
                onClick = onCancel,
            )
            DestructiveButton(
                text = "Withdraw bid",
                modifier = Modifier.weight(1f).testTag("withdraw-confirm"),
                onClick = { onConfirm(selected) },
            )
        }
    }
}

@Composable
private fun ReasonRow(
    reason: WithdrawBidReason,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("withdraw-reason-${reason.wireValue}")
                .clip(RoundedCornerShape(Radii.md))
                .background(if (isSelected) PantopusColors.primary50 else PantopusColors.appSurfaceSunken)
                .border(
                    width = 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.md),
                )
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        androidx.compose.material3.Surface(
            modifier = Modifier.weight(1f),
            color = Color.Transparent,
            onClick = onClick,
        ) {
            Text(
                text = reason.label,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
        }
        if (isSelected) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = "Selected",
                size = 18.dp,
                tint = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun SecondaryButton(
    text: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .height(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md)),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.material3.TextButton(onClick = onClick) {
            Text(
                text = text,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun DestructiveButton(
    text: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .height(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.error),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.material3.TextButton(onClick = onClick) {
            Text(
                text = text,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
            )
        }
    }
}
