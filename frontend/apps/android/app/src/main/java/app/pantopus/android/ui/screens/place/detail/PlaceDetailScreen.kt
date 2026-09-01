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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.place.PlaceDetailGroup
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.PlaceSectionReading
import app.pantopus.android.ui.screens.place.components.PlaceSectionCard
import app.pantopus.android.ui.screens.place.components.PlaceSectionCardState
import app.pantopus.android.ui.theme.PantopusColors

/**
 * The Place group-detail container (W2.3) — sticky header + a scroll of
 * the group's sections in the designed detail layouts. Parity twin of
 * iOS `PlaceDetailView`.
 */
@Composable
fun PlaceDetailScreen(
    onBack: () -> Unit,
    viewModel: PlaceDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        PlaceDetailHeader(
            title = viewModel.group.title,
            address = (state as? PlaceDetailUiState.Loaded)?.intelligence?.place?.let { placeDetailAddress(it) }.orEmpty(),
            onBack = onBack,
        )
        when (val current = state) {
            PlaceDetailUiState.Loading -> PlaceDetailSkeleton()
            is PlaceDetailUiState.Error -> ErrorState(message = current.message, onRetry = viewModel::refresh)
            is PlaceDetailUiState.Loaded ->
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp),
                ) {
                    GroupContent(group = viewModel.group, intel = current.intelligence, viewModel = viewModel)
                    Spacer(modifier = Modifier.height(40.dp))
                }
        }
    }
}

@Composable
private fun GroupContent(
    group: PlaceDetailGroup,
    intel: PlaceIntelligence,
    viewModel: PlaceDetailViewModel,
) {
    when (group) {
        PlaceDetailGroup.TODAY -> PlaceTodayDetailContent(intel)
        PlaceDetailGroup.YOUR_HOME -> PlaceHomeDetailContent(intel)
        PlaceDetailGroup.RISK -> PlaceRiskDetailContent(intel)
        PlaceDetailGroup.BLOCK -> PlaceBlockDetailContent(intel)
        PlaceDetailGroup.MONEY -> PlaceMoneyDetailContent(intel)
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

/** Fallback card for a section with no bespoke layout. */
@Composable
fun PlaceDetailFallbackCard(env: PlaceSectionEnvelope) {
    val cfg = PlacePresentation.config(env.sectionId)
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
    )
}

fun PlaceSectionEnvelope.isLive(): Boolean = status == PlaceSectionStatus.READY || status == PlaceSectionStatus.STALE
