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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.perf.ReportContentShown
import app.pantopus.android.data.ai.AIScreenContext
import app.pantopus.android.data.api.models.homes.OwnershipClaimDto
import app.pantopus.android.data.api.models.place.PlaceAddressRef
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.NavigationMenuButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.RefreshFailedLine
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.components.RefreshOnStoreChange
import app.pantopus.android.ui.components.StatusChip
import app.pantopus.android.ui.screens.homes.HomeCopyLifecycle
import app.pantopus.android.ui.screens.homes.waitingLabel
import app.pantopus.android.ui.screens.place.PlaceVerifyBanner
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.screens.place.detail.AgendaActions
import app.pantopus.android.ui.screens.place.detail.LocalPlaceDetailRetry
import app.pantopus.android.ui.screens.place.detail.PlaceTodayDetailContent
import app.pantopus.android.ui.screens.place.detail.TodayAlertsCheck
import app.pantopus.android.ui.screens.place.detail.TodayTabParts
import app.pantopus.android.ui.screens.place.detail.placeDetailAddress
import app.pantopus.android.ui.screens.place.detail.rememberMinuteClock
import app.pantopus.android.ui.screens.plans.today.PlansTodayActions
import app.pantopus.android.ui.screens.plans.today.PlansTodayCards
import app.pantopus.android.ui.screens.plans.today.PlansTodayViewModel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import kotlinx.coroutines.flow.Flow
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private const val PLACEHOLDER_ROWS = 3

/** Today has something to show: its content, or the card for no place or a claim in review. */
private val TodayTabUiState.showsContent: Boolean
    get() = this is TodayTabUiState.Loaded || this == TodayTabUiState.NoPlace || this is TodayTabUiState.ClaimInReview

/**
 * The Today tab root (Wedge v2 D2). Four states: loading placeholders,
 * a claim prompt when there is no place yet, the Today group with the
 * address calendar (a claim in review's public view under its status),
 * and an error with retry. [onOpenPlace] opens this home's Place
 * dashboard (the Ballot P0 card's "Open your ballot").
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
@Suppress("LongParameterList", "LongMethod", "CyclomaticComplexMethod")
fun TodayTabScreen(
    onClaim: () -> Unit,
    onOpenPlace: ((homeId: String) -> Unit)? = null,
    /** "Check claim status" on a claim in review: the claim's Waiting Room, by its Home's id. */
    onCheckClaim: (homeId: String) -> Unit = {},
    plans: PlansTodayActions? = null,
    onAsk: ((AIScreenContext) -> Unit)? = null,
    /** The side menu, on every tab (founder decision 2026-10-20); null hides the button. */
    onOpenMenu: (() -> Unit)? = null,
    /** An agenda task's existing detail page, by its Home. */
    onOpenTask: (homeId: String, taskId: String) -> Unit = { _, _ -> },
    /** The Today tab tapped again while Today is its root: back to the top. */
    scrollToTop: Flow<Unit>? = null,
    viewModel: TodayTabViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val agendaTasks by viewModel.agendaTasks.collectAsStateWithLifecycle()
    // One Plans read serves the agenda's plan rows and today's plan cards.
    val plansViewModel: PlansTodayViewModel? = plans?.let { hiltViewModel() }
    val plansUi = plansViewModel?.ui?.collectAsStateWithLifecycle()?.value
    val scroll = rememberScrollState()
    LaunchedEffect(scrollToTop) { scrollToTop?.collect { scroll.animateScrollTo(0) } }
    ReportContentShown("today", state.showsContent)
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val pullFailed by viewModel.pullFailed.collectAsStateWithLifecycle()
    // Coming back keeps what's on screen; the view model reads again only once it is out of date.
    HomeCopyLifecycle(viewModel::load, viewModel::suspendContent)
    RefreshOnStoreChange(viewModel::load)
    // Pull to refresh, like iOS's Today tab (`.refreshable`): it always reads now, with the pull indicator
    // over the content instead of placeholders. The indicator shows only for a pull, not the first load.
    var pulled by remember { mutableStateOf(false) }
    LaunchedEffect(refreshing) { if (!refreshing) pulled = false }
    val placeNow = rememberMinuteClock(todayPlaceZone(state))
    val nowMs = placeNow.toInstant().toEpochMilli()
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("todayTab")) {
        // The title, date and address, with the side menu at the end of the title line.
        Row(modifier = Modifier.padding(start = 18.dp, end = 6.dp, top = 10.dp, bottom = 10.dp)) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Today", fontSize = 22.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp, color = PantopusColors.appText)
                    // The date beside the title (the f1-today-tab design); it turns over at midnight.
                    Text(
                        placeNow.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.getDefault())),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextMuted,
                        modifier = Modifier.padding(bottom = 3.dp),
                    )
                }
                (state as? TodayTabUiState.Loaded)?.intelligence?.place?.let { TodayAddressLine(it) }
            }
            onOpenMenu?.let { NavigationMenuButton(onClick = it, testTag = "today.menu", modifier = Modifier.offset(y = (-10).dp)) }
        }
        PullToRefreshBox(
            isRefreshing = pulled && refreshing,
            onRefresh = {
                pulled = true
                viewModel.pull()
            },
            modifier = Modifier.fillMaxSize(),
        ) {
            when (val current = state) {
                TodayTabUiState.Loading -> TodayPlaceholders()
                TodayTabUiState.NoPlace -> NoPlaceCard(onClaim)
                is TodayTabUiState.ClaimInReview -> ClaimInReviewCard(current.claim) { onCheckClaim(current.claim.homeId) }
                is TodayTabUiState.Error -> ErrorState(message = current.message, onRetry = viewModel::pull)
                is TodayTabUiState.Loaded ->
                    Column(
                        modifier = Modifier.fillMaxSize().verticalScroll(scroll).padding(horizontal = 16.dp),
                    ) {
                        val age = nowMs - current.fetchedAt
                        if (current.showsRefreshFailure(pullFailed, age)) {
                            RefreshFailedLine(RefreshNotice(current.fetchedAt, viewModel::pull), Modifier.padding(bottom = 10.dp))
                        }
                        if (current.savedAnchorMatches) {
                            StatusChip("Saved place · Only you", modifier = Modifier.padding(bottom = 12.dp))
                        }
                        TodayClaimBanner(current.claim, onCheckClaim)
                        val homeId = current.calendarHomeId
                        val tab =
                            TodayTabParts(
                                tasks = agendaTasks.takeIf { homeId != null }.orEmpty(),
                                plans = plansUi?.takeIf { it.on }?.upcoming.orEmpty(),
                                actions =
                                    AgendaActions(
                                        onOpenTask = homeId?.let { home -> { task -> onOpenTask(home, task) } },
                                        onOpenPlan = plans?.onOpenPlan,
                                    ),
                                // Nearby Plans (A1, A2, A5): today's plan and the day-after cards, in "Coming up at home".
                                plansBlock =
                                    plans?.let { actions ->
                                        plansViewModel?.let { vm ->
                                            {
                                                PlansTodayCards(
                                                    actions = actions,
                                                    title = "Your plans today",
                                                    modifier = Modifier.padding(top = 12.dp),
                                                    viewModel = vm,
                                                )
                                            }
                                        }
                                    },
                                onAddHome = onClaim.takeIf { current.savedPlace != null },
                                onAsk = onAsk?.let { ask -> { ask(AIScreenContext.today(viewModel.shownHomeId)) } },
                            )
                        CompositionLocalProvider(LocalPlaceDetailRetry provides viewModel::pull) {
                            PlaceTodayDetailContent(
                                current.intelligence,
                                viewModel.takeIf { current.calendarHomeId != null },
                                radonFactory = viewModel.radonFactory.takeIf { current.calendarHomeId != null },
                                pilotEvents = viewModel.pilotEvents,
                                radonContext = viewModel.radonContext,
                                onOpenBallot = onOpenPlace?.let { open -> { viewModel.shownHomeId?.let(open) } },
                                alertsCheck = alertsCheck(age, refreshing, current.refreshFailed),
                                radonMemory = viewModel.radonMemory,
                                tab = tab,
                            )
                        }
                        Spacer(modifier = Modifier.height(96.dp))
                    }
            }
        }
    }
}

/** "1421 SE Oak St · Portland", as iOS's Today and the Place pages show it. */
@Composable
private fun TodayAddressLine(place: PlaceAddressRef) {
    Text(
        placeDetailAddress(place),
        fontSize = 13.sp,
        fontWeight = FontWeight.Medium,
        color = PantopusColors.appTextMuted,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

private fun todayPlaceZone(state: TodayTabUiState): ZoneId =
    (state as? TodayTabUiState.Loaded)?.intelligence?.homeZone ?: ZoneId.systemDefault()

/**
 * Contract §3: a failed read shows "Couldn't refresh" once the copy is past its max shown age, and at once when the
 * read was a pull or Retry ([pullFailed]).
 */
private fun TodayTabUiState.Loaded.showsRefreshFailure(
    pullFailed: Boolean,
    ageMs: Long,
): Boolean = refreshFailed && (pullFailed || ageMs > TODAY_MAX_SHOWN_AGE_MS)

/** Contract §4: an alert check past 30 minutes is never shown as "no alerts". */
private fun alertsCheck(
    ageMs: Long,
    refreshing: Boolean,
    refreshFailed: Boolean,
): TodayAlertsCheck =
    when {
        !refreshFailed && ageMs <= TODAY_ALERTS_MAX_SHOWN_AGE_MS -> TodayAlertsCheck.CURRENT
        refreshing -> TodayAlertsCheck.CHECKING
        else -> TodayAlertsCheck.UNAVAILABLE
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

/**
 * A claim in review whose Home's public view can't be read (an older server, or a closed Home): the address claimed
 * and when Today fills in, with the claim's status. Words match iOS and web's Place pages.
 */
@Composable
private fun ClaimInReviewCard(
    claim: OwnershipClaimDto,
    onCheckClaim: () -> Unit,
) {
    Column(
        modifier =
            Modifier.padding(horizontal = 16.dp).fillMaxWidth().placeCard().padding(24.dp).testTag("addressTodayClaimInReview"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)).background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.Clock, null, size = 28.dp, strokeWidth = 2f, tint = PantopusColors.home)
        }
        Text("Your claim is in review", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            claimInReviewMessage(claim),
            fontSize = 14.sp,
            lineHeight = 20.sp,
            textAlign = TextAlign.Center,
            color = PantopusColors.appTextSecondary,
        )
        PrimaryButton(title = "Check status", onClick = onCheckClaim, modifier = Modifier.fillMaxWidth())
    }
}

/**
 * A claim in review (none: nothing): My homes' words for what it waits on; [onCheckClaim] opens its Waiting Room,
 * with the steps.
 */
@Composable
private fun TodayClaimBanner(
    claim: OwnershipClaimDto?,
    onCheckClaim: (homeId: String) -> Unit,
) {
    if (claim == null) return
    PlaceVerifyBanner(
        onTap = { onCheckClaim(claim.homeId) },
        modifier = Modifier.padding(bottom = 12.dp).testTag("today.claimBanner"),
        icon = PantopusIcon.Clock,
        message = "Your claim is in review. ${claim.waitingLabel}.",
        action = "Check claim status",
    )
}

/** "You claimed 901 C Street, Vancouver, WA. Today fills in here once a Pantopus reviewer approves your claim." */
internal fun claimInReviewMessage(claim: OwnershipClaimDto): String {
    val home = claim.home
    val street = home?.street
    val claimed = if (home != null && street != null) "You claimed ${listOfNotNull(street, home.locality).joinToString(", ")}. " else ""
    return claimed + "Today fills in here once a Pantopus reviewer approves your claim."
}
