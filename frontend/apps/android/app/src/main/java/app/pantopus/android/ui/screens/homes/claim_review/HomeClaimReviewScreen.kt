@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "MagicNumber",
)

package app.pantopus.android.ui.screens.homes.claim_review

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/** Test tag on the claim-review root. Mirrors iOS `homeClaimReview`. */
const val HOME_CLAIM_REVIEW_TAG = "homeClaimReview"

private const val TOAST_DURATION_MS = 2_000L

private data class VerdictConfirm(
    val claimId: String,
    val verdict: HomeClaimReviewVerdict,
)

private data class RelationshipConfirm(
    val claimId: String,
    val action: HomeClaimRelationshipAction,
    val isOwnerClaim: Boolean,
)

private data class ResidencyConfirm(
    val claimId: String,
    val displayName: String,
    val approve: Boolean,
)

/**
 * H6 — Per-home **owner** claim review (RN
 * `src/app/homes/[id]/owners/review-claim.tsx`). Reached from the Owners
 * list top-bar action.
 *
 * Deliberately separate from `ui/screens/review_claims/…`, which is the
 * platform-admin queue on `/api/admin/claims*`. Nothing here talks to
 * `AdminApi`.
 *
 * Layout follows A08 "Review claims" (tabbed card list) with the A13.3
 * "Review Claim" verdict palette on each card's action row.
 */
@Composable
fun HomeClaimReviewScreen(
    onBack: () -> Unit,
    viewModel: HomeClaimReviewViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val actionLoading by viewModel.actionLoading.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

    var verdictConfirm by remember { mutableStateOf<VerdictConfirm?>(null) }
    var relationshipConfirm by remember { mutableStateOf<RelationshipConfirm?>(null) }
    var residencyConfirm by remember { mutableStateOf<ResidencyConfirm?>(null) }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(TOAST_DURATION_MS)
            viewModel.clearToast()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(HOME_CLAIM_REVIEW_TAG),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            HomeClaimReviewTopBar(onBack = onBack)
            val loaded = state as? HomeClaimReviewUiState.Loaded
            if (loaded != null) {
                HomeClaimReviewTabStrip(
                    tabs = tabItems(loaded.data),
                    selected = selectedTab,
                    onSelect = viewModel::selectTab,
                )
            }
            when (val current = state) {
                is HomeClaimReviewUiState.Loading ->
                    Column(
                        modifier =
                            Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(Spacing.s4),
                    ) {
                        HomeClaimReviewSkeleton()
                    }
                is HomeClaimReviewUiState.Empty ->
                    EmptyState(
                        icon = PantopusIcon.CheckCheck,
                        headline = "No claims to review",
                        subcopy =
                            "You're all caught up. New ownership and residency claims on " +
                                "this home will appear here for you to approve, reject, or flag.",
                        modifier = Modifier.testTag("homeClaimReview_empty"),
                        tint = PantopusColors.successBg,
                        accent = PantopusColors.success,
                    )
                is HomeClaimReviewUiState.Error ->
                    ErrorState(
                        headline = "Couldn't load claims",
                        message = current.message,
                        modifier = Modifier.testTag("homeClaimReview_error"),
                        onRetry = viewModel::refresh,
                    )
                is HomeClaimReviewUiState.Loaded ->
                    when (selectedTab) {
                        HomeClaimReviewTab.Ownership ->
                            OwnershipTab(
                                items = current.data.ownership,
                                actionLoading = actionLoading,
                                onVerdict = { claimId, verdict ->
                                    verdictConfirm = VerdictConfirm(claimId, verdict)
                                },
                                onRelationship = { claimId, action, isOwnerClaim ->
                                    relationshipConfirm =
                                        RelationshipConfirm(claimId, action, isOwnerClaim)
                                },
                            )
                        HomeClaimReviewTab.Residency ->
                            ResidencyTab(
                                items = current.data.residency,
                                actionLoading = actionLoading,
                                onConfirm = { claimId, name, approve ->
                                    residencyConfirm = ResidencyConfirm(claimId, name, approve)
                                },
                            )
                        HomeClaimReviewTab.Compare ->
                            CompareTab(comparison = current.data.comparison)
                    }
            }
        }

        toast?.let { message ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10)
                        .testTag("homeClaimReview_toast"),
            ) {
                Toast(
                    message =
                        ToastMessage(
                            text = message.text,
                            kind = if (message.isError) ToastKind.Error else ToastKind.Success,
                        ),
                )
            }
        }
    }

    verdictConfirm?.let { target ->
        AlertDialog(
            onDismissRequest = { verdictConfirm = null },
            title = { Text(target.verdict.title) },
            text = { Text(target.verdict.confirmBody) },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.review(target.claimId, target.verdict)
                        verdictConfirm = null
                    },
                    modifier = Modifier.testTag("homeClaimReview_verdictConfirm"),
                ) { Text(target.verdict.title) }
            },
            dismissButton = {
                TextButton(onClick = { verdictConfirm = null }) { Text("Cancel") }
            },
        )
    }

    relationshipConfirm?.let { target ->
        AlertDialog(
            onDismissRequest = { relationshipConfirm = null },
            title = { Text(target.action.title(target.isOwnerClaim)) },
            text = { Text(target.action.body(target.isOwnerClaim)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.resolveRelationship(target.claimId, target.action)
                        relationshipConfirm = null
                    },
                    modifier = Modifier.testTag("homeClaimReview_relationshipConfirm"),
                ) { Text(target.action.title(target.isOwnerClaim)) }
            },
            dismissButton = {
                TextButton(onClick = { relationshipConfirm = null }) { Text("Cancel") }
            },
        )
    }

    residencyConfirm?.let { target ->
        val title = if (target.approve) "Approve" else "Reject"
        AlertDialog(
            onDismissRequest = { residencyConfirm = null },
            title = { Text(title) },
            text = {
                Text(
                    "Are you sure you want to ${title.lowercase()} " +
                        "${target.displayName}'s residency claim?",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.reviewResidency(target.claimId, target.approve)
                        residencyConfirm = null
                    },
                    modifier = Modifier.testTag("homeClaimReview_residencyConfirm"),
                ) { Text(title) }
            },
            dismissButton = {
                TextButton(onClick = { residencyConfirm = null }) { Text("Cancel") }
            },
        )
    }
}

private fun tabItems(data: HomeClaimReviewData): List<HomeClaimReviewTabItem> {
    val items =
        mutableListOf(
            HomeClaimReviewTabItem(
                tab = HomeClaimReviewTab.Ownership,
                title =
                    if (data.ownership.isNotEmpty()) {
                        "Ownership (${data.ownership.size})"
                    } else {
                        "Ownership"
                    },
            ),
            HomeClaimReviewTabItem(
                tab = HomeClaimReviewTab.Residency,
                title =
                    if (data.residency.isNotEmpty()) {
                        "Residency (${data.residency.size})"
                    } else {
                        "Residency"
                    },
            ),
        )
    if (data.comparison != null) {
        items += HomeClaimReviewTabItem(tab = HomeClaimReviewTab.Compare, title = "Compare")
    }
    return items
}

@Composable
private fun OwnershipTab(
    items: List<HomeClaimReviewOwnershipItem>,
    actionLoading: String?,
    onVerdict: (String, HomeClaimReviewVerdict) -> Unit,
    onRelationship: (String, HomeClaimRelationshipAction, Boolean) -> Unit,
) {
    if (items.isEmpty()) {
        EmptyState(
            icon = PantopusIcon.CheckCheck,
            headline = "No pending ownership claims",
            subcopy =
                "Nobody is currently claiming legal title to this home. " +
                    "New claims land here for your approval.",
            modifier = Modifier.testTag("homeClaimReview_ownershipEmpty"),
            tint = PantopusColors.successBg,
            accent = PantopusColors.success,
        )
        return
    }
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        items.forEach { item ->
            HomeClaimOwnershipCard(
                item = item,
                isBusy = actionLoading?.startsWith("${item.id}:") == true,
                onVerdict = { verdict -> onVerdict(item.id, verdict) },
                onRelationship = { action ->
                    onRelationship(item.id, action, item.claimType == "owner")
                },
            )
        }
    }
}

@Composable
private fun ResidencyTab(
    items: List<HomeClaimReviewResidencyItem>,
    actionLoading: String?,
    onConfirm: (String, String, Boolean) -> Unit,
) {
    if (items.isEmpty()) {
        EmptyState(
            icon = PantopusIcon.CheckCheck,
            headline = "No pending residency claims",
            subcopy =
                "Neighbors asking to join this household will show up here " +
                    "with the role they requested.",
            modifier = Modifier.testTag("homeClaimReview_residencyEmpty"),
            tint = PantopusColors.successBg,
            accent = PantopusColors.success,
        )
        return
    }
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        items.forEach { item ->
            HomeClaimResidencyCard(
                item = item,
                isBusy = actionLoading == item.id,
                onApprove = { onConfirm(item.id, item.displayName, true) },
                onReject = { onConfirm(item.id, item.displayName, false) },
            )
        }
    }
}

@Composable
private fun CompareTab(comparison: HomeClaimReviewComparison?) {
    if (comparison == null) {
        EmptyState(
            icon = PantopusIcon.ArrowRightLeft,
            headline = "Comparison unavailable",
            subcopy =
                "The side-by-side comparison isn't enabled for this home yet. " +
                    "Use the Ownership tab to act on individual claims.",
            modifier = Modifier.testTag("homeClaimReview_compareEmpty"),
        )
        return
    }
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4),
    ) {
        HomeClaimComparePanel(comparison = comparison)
    }
}
