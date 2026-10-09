package app.pantopus.android.ui.screens.place.today

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
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
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.perf.ReportContentShown
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.StatusChip
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.screens.place.detail.PlaceTodayDetailContent
import app.pantopus.android.ui.screens.place.detail.rememberMinuteClock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import java.time.format.DateTimeFormatter
import java.util.Locale

private const val PLACEHOLDER_ROWS = 3

/**
 * The Today tab root (Wedge v2 D2). Four states: loading placeholders,
 * a claim prompt when there is no place yet, the Today group with the
 * address calendar, and an error with retry. [onOpenPlace] opens this
 * home's Place dashboard (the Ballot P0 card's "Open your ballot").
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayTabScreen(
    onClaim: () -> Unit,
    onOpenPlace: ((homeId: String) -> Unit)? = null,
    viewModel: TodayTabViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ReportContentShown("today", state is TodayTabUiState.Loaded || state == TodayTabUiState.NoPlace)
    val showMorningCard by viewModel.showMorningCard.collectAsStateWithLifecycle()
    val preferenceBusy by viewModel.preferenceBusy.collectAsStateWithLifecycle()
    val preferenceError by viewModel.preferenceError.collectAsStateWithLifecycle()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.load() }
    // Pull to refresh, like iOS's Today tab (`.refreshable`): the tab stays mounted, so without it
    // weather, air and alerts keep their first load. The spinner shows only for a pull, not the first load.
    var pulled by remember { mutableStateOf(false) }
    var visibleFrame by remember { mutableStateOf(Rect.Zero) }
    LaunchedEffect(state) { if (state !is TodayTabUiState.Loading) pulled = false }
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("todayTab")) {
        Column(modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp)) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Today", fontSize = 22.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp, color = PantopusColors.appText)
                // The date beside the title (the f1-today-tab design); it turns over at midnight.
                Text(
                    rememberMinuteClock().format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.getDefault())),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(bottom = 3.dp),
                )
            }
            (state as? TodayTabUiState.Loaded)?.intelligence?.place?.label?.let {
                Text(it, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted, maxLines = 1)
            }
        }
        PullToRefreshBox(
            isRefreshing = pulled && state is TodayTabUiState.Loading,
            onRefresh = {
                pulled = true
                viewModel.refresh()
            },
            modifier = Modifier.fillMaxSize().onGloballyPositioned { visibleFrame = it.boundsInWindow() },
        ) {
            when (val current = state) {
                TodayTabUiState.Loading -> TodayPlaceholders()
                TodayTabUiState.NoPlace -> NoPlaceCard(onClaim)
                is TodayTabUiState.Error -> ErrorState(message = current.message, onRetry = viewModel::refresh)
                is TodayTabUiState.Loaded ->
                    Column(
                        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                    ) {
                        if (current.savedAnchorMatches) {
                            StatusChip("Saved place · Only you", modifier = Modifier.padding(bottom = 12.dp))
                        }
                        PlaceTodayDetailContent(
                            current.intelligence,
                            viewModel.takeIf { current.calendarHomeId != null },
                            radonFactory = viewModel.radonFactory.takeIf { current.calendarHomeId != null },
                            pilotEvents = viewModel.pilotEvents,
                            radonContext = viewModel.radonContext,
                            onOpenBallot = onOpenPlace?.let { open -> { viewModel.homeId?.let(open) } },
                        )
                        if (current.savedPlace != null) {
                            SavedPlaceReminders(onClaim)
                        }
                        if (showMorningCard && current.savedAnchorMatches) {
                            MorningOptInCard(preferenceBusy, preferenceError, viewModel, visibleFrame)
                        }
                        Spacer(modifier = Modifier.height(96.dp))
                    }
            }
        }
    }
}

@Composable
private fun SavedPlaceReminders(onAddHome: () -> Unit) {
    Column(
        modifier = Modifier.padding(top = 12.dp).fillMaxWidth().placeCard().padding(16.dp).testTag("todaySavedPlaceReminders"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("Get reminders for this address", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        Text(
            "Pickup and radon reminders need your home on Pantopus.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextSecondary,
        )
        GhostButton("Add your home", onClick = onAddHome, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun MorningOptInCard(
    busy: Boolean,
    error: String?,
    viewModel: TodayTabViewModel,
    visibleFrame: Rect,
) {
    var cardFrame by remember { mutableStateOf(Rect.Zero) }
    val visible = !cardFrame.isEmpty && cardFrame.overlaps(visibleFrame)
    LaunchedEffect(visible) { if (visible) viewModel.markPromptDisplayed() }
    Column(
        modifier =
            Modifier.padding(top = 12.dp).fillMaxWidth().placeCard().padding(16.dp).testTag("todayMorningOptIn")
                .onGloballyPositioned { cardFrame = it.boundsInWindow() },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("A morning heads-up?", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        Text(
            "Weather, air and alerts for this address, only when something's worth knowing.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextSecondary,
        )
        if (error != null) {
            Text(error, fontSize = 13.sp, color = PantopusColors.error)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GhostButton("Turn on", onClick = viewModel::turnOnMorning, modifier = Modifier.weight(1f), isLoading = busy)
            GhostButton("Not now", onClick = viewModel::hideMorningCard, modifier = Modifier.weight(1f), isEnabled = !busy)
        }
    }
}

@Composable
private fun TodayPlaceholders() {
    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        repeat(PLACEHOLDER_ROWS) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(if (it == 0) 120.dp else 76.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(PantopusColors.appSurfaceSunken),
            )
        }
    }
}

@Composable
private fun NoPlaceCard(onClaim: () -> Unit) {
    Column(
        modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth().placeCard().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)).background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.CloudSun, null, size = 28.dp, strokeWidth = 2f, tint = PantopusColors.home)
        }
        Text("Today starts at your address", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            "Weather, air, alerts, and the dates that matter at your address — pickup day, tax deadlines, council meetings. " +
                "Claim your address to start.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            textAlign = TextAlign.Center,
            color = PantopusColors.appTextSecondary,
        )
        PrimaryButton(title = "Claim your address", onClick = onClaim, modifier = Modifier.fillMaxWidth())
    }
}
