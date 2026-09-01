@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.owners

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the Owners list root container. */
const val OWNERS_LIST_TAG = "ownersList"

/**
 * P15 / T6.3g Owners list. Thin wrapper around [ListOfRowsScreen]; the
 * VM supplies the rows + chrome and emits an [OwnersListEvent] when a
 * row action needs the screen to present a confirm dialog or route to
 * the invite flow.
 *
 * The invite affordance navigates to the existing InviteOwner route
 * (mounted in `RootTabScreen`) via [onOpenInvite]; on return the user
 * can pull-to-refresh to see the new pending row (matches the Bills /
 * Add Bill wizard pattern).
 *
 * @param onOpenInvite Invoked with the home id when the FAB or empty
 *     CTA fires; the host routes to the existing InviteOwner form.
 * @param onOpenClaimReview H6 — invoked with the home id when the
 *     top-bar gavel fires; the host routes to the per-home
 *     claim-review surface.
 * @param onBack Pop the back stack.
 */
@Composable
fun OwnersListScreen(
    onOpenInvite: (String) -> Unit,
    onOpenTransfer: (String) -> Unit,
    onOpenClaimReview: (String) -> Unit,
    onBack: () -> Unit,
    viewModel: OwnersListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    var removeTarget by remember { mutableStateOf<Pair<String, String>?>(null) }

    LaunchedEffect(Unit) {
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenOwnersListViewed)
    }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            null -> Unit
            OwnersListEvent.OpenInvite -> {
                onOpenInvite(viewModel.homeId)
                viewModel.acknowledgeEvent()
            }
            is OwnersListEvent.ConfirmRemove -> {
                removeTarget = event.ownerId to event.displayName
                viewModel.acknowledgeEvent()
            }
            OwnersListEvent.OpenClaimReview -> {
                onOpenClaimReview(viewModel.homeId)
                viewModel.acknowledgeEvent()
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().testTag(OWNERS_LIST_TAG)) {
        Box(modifier = Modifier.weight(1f)) {
            ListOfRowsScreen(
                title = "Owners",
                state = state,
                onRefresh = { viewModel.refresh() },
                onEndReached = { viewModel.loadMoreIfNeeded() },
                topBarAction = viewModel.topBarAction,
                fab = viewModel.fab,
                onBack = onBack,
            )
        }
        TransferOwnershipBar(onTap = { onOpenTransfer(viewModel.homeId) })
    }

    removeTarget?.let { (ownerId, displayName) ->
        AlertDialog(
            onDismissRequest = { removeTarget = null },
            title = { Text("Remove owner?") },
            text = {
                Text(
                    "$displayName will lose owner privileges. If other owners " +
                        "exist, removal may need quorum approval.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.removeOwner(ownerId)
                        removeTarget = null
                    },
                    modifier = Modifier.testTag("ownersList_removeConfirm"),
                ) { Text("Remove") }
            },
            dismissButton = {
                TextButton(onClick = { removeTarget = null }) { Text("Cancel") }
            },
        )
    }
}

/**
 * Sticky bottom action — mirrors RN's warning-tinted "Transfer
 * Ownership" button under the roster
 * (`src/app/homes/[id]/owners/index.tsx:114-124`).
 */
@Composable
private fun TransferOwnershipBar(onTap: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorderSubtle)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.warningBg)
                    .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.md))
                    .clickable(onClick = onTap)
                    .testTag("ownersList_transferCTA"),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowRightLeft,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.warning,
            )
            Text(
                text = "Transfer Ownership",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.warning,
                modifier = Modifier.padding(start = Spacing.s2),
            )
        }
    }
}
