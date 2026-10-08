package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.PlaceBand
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionAccess
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.data.api.models.place.PlaceTier
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.place.PlaceDeniedState
import app.pantopus.android.ui.screens.place.PlaceDetailGroup
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.PlaceSectionReading
import app.pantopus.android.ui.screens.place.components.PlaceLockedCard
import app.pantopus.android.ui.screens.place.components.PlaceSectionCard
import app.pantopus.android.ui.screens.place.components.PlaceSectionCardState
import app.pantopus.android.ui.screens.place.leavesOut
import app.pantopus.android.ui.screens.place.verifiesFirst
import app.pantopus.android.ui.screens.place.verify.PlaceVerifyMethod
import app.pantopus.android.ui.screens.place.verify.PlaceVerifySheet
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * The Place group-detail container (W2.3) — sticky header + a scroll of
 * the group's sections in the designed detail layouts. Parity twin of
 * iOS `PlaceDetailView`.
 */
@Composable
fun PlaceDetailScreen(
    onBack: () -> Unit,
    onStartVerify: ((PlaceVerifyMethod) -> Unit)? = null,
    viewModel: PlaceDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    // A locked section's "Verify address" opens the same verify sheet as the dashboard.
    var showVerify by remember { mutableStateOf(false) }
    val verify: (() -> Unit)? = onStartVerify?.let { { showVerify = true } }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        PlaceDetailHeader(
            title = viewModel.group.title,
            address = (state as? PlaceDetailUiState.Loaded)?.intelligence?.place?.let { placeDetailAddress(it) }.orEmpty(),
            onBack = onBack,
        )
        when (val current = state) {
            PlaceDetailUiState.Loading -> PlaceDetailSkeleton()
            is PlaceDetailUiState.Error ->
                if (current.denied) {
                    PlaceDeniedState()
                } else {
                    ErrorState(message = current.message, onRetry = viewModel::refresh)
                }
            is PlaceDetailUiState.Loaded ->
                if (current.intelligence.leavesOut(viewModel.group)) {
                    // The server leaves out what doesn't apply to this viewer;
                    // a link to it gets a straight answer, not empty cards.
                    PlaceNotForViewerState(group = viewModel.group, role = current.intelligence.viewer?.role, onBack = onBack)
                } else {
                    Column(
                        modifier =
                            Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(horizontal = 16.dp),
                    ) {
                        // Guests and service providers can't verify this address: no verify action.
                        val detailVerify = verify.takeUnless { current.intelligence.nonResidentViewer }
                        CompositionLocalProvider(
                            LocalPlaceDetailRetry provides viewModel::refresh,
                            LocalPlaceDetailVerify provides detailVerify,
                            LocalPlaceDetailVerifiesFirst provides current.intelligence.verifiesFirst,
                        ) {
                            GroupContent(group = viewModel.group, intel = current.intelligence, viewModel = viewModel)
                        }
                        Spacer(modifier = Modifier.height(40.dp))
                    }
                }
        }
    }
    if (showVerify && onStartVerify != null) {
        PlaceVerifySheet(
            address = (state as? PlaceDetailUiState.Loaded)?.intelligence?.place?.label.orEmpty(),
            homeId = viewModel.calendarHomeId,
            onStart = { method ->
                showVerify = false
                onStartVerify(method)
            },
            onDismiss = { showVerify = false },
        )
    }
}

@Composable
private fun GroupContent(
    group: PlaceDetailGroup,
    intel: PlaceIntelligence,
    viewModel: PlaceDetailViewModel,
) {
    when (group) {
        PlaceDetailGroup.TODAY -> PlaceTodayDetailContent(intel, viewModel)
        PlaceDetailGroup.YOUR_HOME -> PlaceHomeDetailContent(intel)
        PlaceDetailGroup.RISK -> PlaceRiskDetailContent(intel, viewModel)
        PlaceDetailGroup.BLOCK -> PlaceBlockDetailContent(intel, viewModel)
        PlaceDetailGroup.MONEY -> PlaceMoneyDetailContent(intel, viewModel)
        PlaceDetailGroup.CIVIC -> PlaceCivicDetailContent(intel)
        PlaceDetailGroup.IDENTITY -> PlaceIdentityDetailContent(intel, viewModel)
    }
}

@Composable
private fun PlaceDetailSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Spacer(modifier = Modifier.height(26.dp))
        Shimmer(width = 96.dp, height = 11.dp)
        repeat(3) { Shimmer(width = 360.dp, height = 96.dp, cornerRadius = 16.dp) }
    }
}

/** The detail page's re-read, the default "Try again" for its fallback cards. */
val LocalPlaceDetailRetry = staticCompositionLocalOf<(() -> Unit)?> { null }

/** Opens the verify sheet: the tap for a locked section's "Verify address" (null where no flow is wired). */
val LocalPlaceDetailVerify = staticCompositionLocalOf<(() -> Unit)?> { null }

/** The viewer set this Home up and hasn't verified it (T1): every lock is the verify step. */
val LocalPlaceDetailVerifiesFirst = staticCompositionLocalOf { false }

/** What a viewer is told on a detail page that isn't part of their view of a Home. */
@Composable
private fun PlaceNotForViewerState(
    group: PlaceDetailGroup,
    role: String?,
    onBack: () -> Unit,
) {
    val guest = role == "nonresident"
    EmptyState(
        icon = PantopusIcon.MapPin,
        headline =
            when {
                !guest -> "Money signals are for the owner or renter"
                group == PlaceDetailGroup.MONEY -> "Money signals are for the household"
                else -> "Home records are for the household"
            },
        subcopy =
            if (guest) {
                "Guests and service providers see this address's public information: today, risk and " +
                    "readiness, the block and civic details."
            } else {
                "Bill comparisons, rent and property-tax checks belong to whoever owns or rents this home. " +
                    "Your Place still shows the home's details, its risks and today's conditions."
            },
        ctaTitle = "Back to your Place",
        onCta = onBack,
        modifier = Modifier.testTag("place.detail.notForViewer"),
    )
}

/** Guests and service providers can't verify this address (server `verify_available`). */
internal val PlaceIntelligence.nonResidentViewer: Boolean
    get() = tier == PlaceTier.T3 && verifyAvailable == false

/**
 * Fallback card for a section with no bespoke layout.
 *
 * [onRetry] is what makes the ERROR state's "Try again" a button rather
 * than a label: [PlaceSectionCard] always draws it, and a caller that
 * passes nothing ships a tap that does nothing. It defaults to the detail
 * page's re-read ([LocalPlaceDetailRetry]).
 */
@Composable
fun PlaceDetailFallbackCard(
    env: PlaceSectionEnvelope,
    onRetry: (() -> Unit)? = LocalPlaceDetailRetry.current,
) {
    val cfg = PlacePresentation.config(env.sectionId)
    if (env.access == PlaceSectionAccess.LOCKED) {
        // Before verification every lock is the verify-by-mail step; a lock
        // waiting on the ownership review (T3/T4) has nothing to tap.
        val verifiesFirst = LocalPlaceDetailVerifiesFirst.current
        PlaceLockedCard(
            title = cfg.title,
            reason = PlacePresentation.lockReason(env),
            cta = PlacePresentation.lockCta(env, verifiesFirst),
            icon = cfg.icon,
            onTap = LocalPlaceDetailVerify.current.takeIf { verifiesFirst || env.band == PlaceBand.D },
        )
        return
    }
    val cardState = PlacePresentation.cardState(env)
    val isLive = cardState == PlaceSectionCardState.LOADED || cardState == PlaceSectionCardState.STALE
    val reading = if (isLive) PlacePresentation.reading(env) else PlaceSectionReading()
    PlaceSectionCard(
        title = cfg.title,
        icon = cfg.icon,
        asOf = if (isLive) PlacePresentation.asOf(env) else null,
        state = cardState,
        value = reading.value,
        caption = if (cardState == PlaceSectionCardState.UNAVAILABLE) env.unavailableReason else reading.caption,
        chip = reading.chip,
        statusDot = reading.statusDot,
        inline = false,
        onRetry = onRetry,
    )
}

fun PlaceSectionEnvelope.isLive(): Boolean = status == PlaceSectionStatus.READY || status == PlaceSectionStatus.STALE
