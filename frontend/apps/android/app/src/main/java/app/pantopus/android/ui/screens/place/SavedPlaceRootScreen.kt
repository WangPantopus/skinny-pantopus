package app.pantopus.android.ui.screens.place

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.PlacePreviewStatus
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.screens.place.launch.PlacePreviewFindings
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.flow.Flow

/** Test tag on the saved-address root. Mirrors iOS. */
const val SAVED_PLACE_ROOT_TAG = "place.savedRoot"

/** Rows in the public preview's loading shimmer, as iOS draws it. */
private const val SKELETON_ROWS = 3

/**
 * The Place tab's root for someone with no Home who saved an address privately: they aren't asked for it again.
 * Your Place's header with the saved address, the next step (set it up as a Home, or look up another address), then
 * what's public about the saved point. Parity twin of iOS `SavedPlaceRootView`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
@Suppress("LongParameterList")
fun SavedPlaceRootScreen(
    place: SavedPlaceDto,
    unreadCount: Int,
    onOpenNotifications: () -> Unit,
    onOpenMenu: () -> Unit,
    onSetUpHome: () -> Unit,
    onLookUpAddress: () -> Unit,
    modifier: Modifier = Modifier,
    /** The Place tab tapped again on this root: back to the top. */
    scrollToTop: Flow<Unit>? = null,
    viewModel: SavedPlaceRootViewModel = hiltViewModel(key = "saved-place-${place.id}"),
) {
    LaunchedEffect(place.id) { viewModel.load(place.id) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    LaunchedEffect(scrollToTop) { scrollToTop?.collect { listState.animateScrollToItem(0) } }

    var pulled by remember { mutableStateOf(false) }
    LaunchedEffect(refreshing) { if (!refreshing) pulled = false }
    PullToRefreshBox(
        isRefreshing = pulled && refreshing,
        onRefresh = {
            pulled = true
            viewModel.refresh()
        },
        modifier = modifier.fillMaxSize().background(PantopusColors.appBg).testTag(SAVED_PLACE_ROOT_TAG),
    ) {
        LazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
            item {
                PlaceDashboardHeader(
                    label = place.label,
                    onOpenMenu = onOpenMenu,
                    onOpenNotifications = onOpenNotifications,
                    unreadCount = unreadCount,
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp),
                )
            }
            item {
                SavedPlaceNextStep(
                    onSetUpHome = onSetUpHome,
                    onLookUpAddress = onLookUpAddress,
                    modifier = Modifier.padding(horizontal = 16.dp).padding(top = 12.dp),
                )
            }
            item {
                SavedPlacePublicPreview(
                    state = state,
                    retrying = refreshing,
                    onSetUpHome = onSetUpHome,
                    onRetry = viewModel::refresh,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
            item { Spacer(modifier = Modifier.height(40.dp)) }
        }
    }
}

/** Is this their home? Set it up, or look up another address. */
@Composable
private fun SavedPlaceNextStep(
    onSetUpHome: () -> Unit,
    onLookUpAddress: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().placeCard().padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(PantopusColors.homeBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(PantopusIcon.Home, null, size = 20.dp, strokeWidth = 2f, tint = PantopusColors.home)
            }
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    "Is this your home?",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    "Set it up for pickup and radon reminders and your household's tasks.",
                    fontSize = 13.5.sp,
                    lineHeight = 19.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        PrimaryButton(
            title = "Set up this Home",
            onClick = onSetUpHome,
            modifier = Modifier.fillMaxWidth().testTag("place.savedRoot.setUp"),
        )
        TextButton(onClick = onLookUpAddress, modifier = Modifier.fillMaxWidth().testTag("place.savedRoot.lookUp")) {
            Text(
                "Look up a different address",
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
        }
        Row(
            modifier = Modifier.semantics(mergeDescendants = true) {},
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(PantopusIcon.ShieldCheck, null, size = 14.dp, strokeWidth = 2.25f, tint = PantopusColors.home)
            Text("Saved privately. Only you can see it.", fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

/** The public preview of the saved point, as the launch preview renders it, without its account wall. */
@Composable
private fun SavedPlacePublicPreview(
    state: SavedPlaceRootUiState,
    retrying: Boolean,
    onSetUpHome: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    when (state) {
        SavedPlaceRootUiState.Loading ->
            Column(modifier = modifier.padding(top = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(SKELETON_ROWS) { FullWidthShimmer(height = 76.dp) }
            }
        SavedPlaceRootUiState.Error ->
            Column(modifier = modifier.fillMaxWidth().padding(top = Spacing.s4)) {
                Text(
                    "Couldn't load what's public about this address.",
                    fontSize = 14.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag("place.savedRoot.error"),
                )
                TextButton(onClick = onRetry, modifier = Modifier.testTag("place.savedRoot.retry")) { Text("Try again") }
            }
        is SavedPlaceRootUiState.Loaded -> {
            val preview = state.preview
            when (preview.status) {
                // The server says why there is nothing to show for this point.
                PlacePreviewStatus.COULD_NOT_PLACE, PlacePreviewStatus.UNSUPPORTED_REGION ->
                    Text(
                        preview.message ?: "We couldn't place this address.",
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = modifier.padding(top = Spacing.s4).testTag("place.savedRoot.message"),
                    )
                else ->
                    PlacePreviewFindings(
                        preview = preview,
                        onFollowUp = onSetUpHome,
                        onRetry = onRetry,
                        retrying = retrying,
                        modifier = modifier,
                    )
            }
        }
    }
}
