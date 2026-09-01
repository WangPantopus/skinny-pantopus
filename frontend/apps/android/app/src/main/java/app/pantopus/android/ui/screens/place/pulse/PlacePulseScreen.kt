package app.pantopus.android.ui.screens.place.pulse

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.PulsePayload
import app.pantopus.android.data.api.models.place.PulseSignal
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.place.detail.PlaceDetailCard
import app.pantopus.android.ui.screens.place.detail.PlaceDetailHeader
import app.pantopus.android.ui.screens.place.detail.PlaceDetailSectionLabel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

const val PLACE_PULSE_HOME_ID_KEY = "homeId"

@HiltViewModel
class PlacePulseViewModel
    @Inject
    constructor(
        private val repo: PlaceRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String = requireNotNull(savedStateHandle[PLACE_PULSE_HOME_ID_KEY])

        private val _state = MutableStateFlow<PlacePulseUiState>(PlacePulseUiState.Loading)
        val state: StateFlow<PlacePulseUiState> = _state.asStateFlow()

        fun load() {
            if (_state.value is PlacePulseUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = PlacePulseUiState.Loading
            viewModelScope.launch {
                _state.value =
                    when (val r = repo.pulse(homeId)) {
                        is NetworkResult.Success -> PlacePulseUiState.Loaded(r.data.pulse)
                        is NetworkResult.Failure -> PlacePulseUiState.Error(r.error.message)
                    }
            }
        }
    }

sealed interface PlacePulseUiState {
    data object Loading : PlacePulseUiState

    data class Loaded(val pulse: PulsePayload) : PlacePulseUiState

    data class Error(val message: String) : PlacePulseUiState
}

@Composable
fun PlacePulseScreen(
    onBack: () -> Unit,
    viewModel: PlacePulseViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        PlaceDetailHeader(
            title = "Today's Pulse",
            address = (state as? PlacePulseUiState.Loaded)?.pulse?.greeting.orEmpty(),
            onBack = onBack,
        )
        when (val current = state) {
            PlacePulseUiState.Loading ->
                Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Spacer(modifier = Modifier.height(26.dp))
                    repeat(3) { Shimmer(width = 360.dp, height = 84.dp, cornerRadius = 16.dp) }
                }
            is PlacePulseUiState.Error -> ErrorState(message = current.message, onRetry = viewModel::refresh)
            is PlacePulseUiState.Loaded ->
                Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
                    if (current.pulse.signals.isEmpty()) {
                        AllClear(current.pulse)
                    } else {
                        Tiers(current.pulse)
                    }
                    Spacer(modifier = Modifier.height(40.dp))
                }
        }
    }
}

@Composable
private fun AllClear(pulse: PulsePayload) {
    PlaceDetailSectionLabel("Today")
    PlaceDetailCard {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(48.dp).clip(CircleShape).background(PantopusColors.homeBg), contentAlignment = Alignment.Center) {
                PantopusIconImage(PantopusIcon.ShieldCheck, null, size = 24.dp, strokeWidth = 2f, tint = PantopusColors.home)
            }
            Column {
                Text("All clear today", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(pulse.summary, fontSize = 13.5.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

@Composable
private fun Tiers(pulse: PulsePayload) {
    val sorted = pulse.signals.sortedByDescending { it.priority }
    val buckets =
        listOf(
            "Urgent" to sorted.filter { it.priority >= 80 },
            "Worth a look" to sorted.filter { it.priority in 50..79 },
            "Around you" to sorted.filter { it.priority in 25..49 },
            "When you have a minute" to sorted.filter { it.priority < 25 },
        )
    buckets.forEach { (title, signals) ->
        if (signals.isNotEmpty()) {
            PlaceDetailSectionLabel(title)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { signals.forEach { SignalCard(it) } }
        }
    }
}

@Composable
private fun SignalCard(signal: PulseSignal) {
    val (bg, fg) = signalTone(signal.color)
    PlaceDetailCard(padding = 14.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            Box(modifier = Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(bg), contentAlignment = Alignment.Center) {
                PantopusIconImage(
                    PantopusIcon.valueOfRaw(signal.icon) ?: PantopusIcon.MapPin,
                    null,
                    size = 18.dp,
                    strokeWidth = 2f,
                    tint = fg,
                )
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(signal.title, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(signal.detail, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
                signal.actions?.firstOrNull()?.let {
                    Text(it.label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
                }
            }
        }
    }
}

private fun signalTone(color: String): Pair<Color, Color> =
    when (color.lowercase()) {
        "green", "home", "success" -> PantopusColors.homeBg to PantopusColors.home
        "amber", "warning", "yellow", "orange" -> PantopusColors.warningBg to PantopusColors.warning
        "red", "error" -> PantopusColors.errorBg to PantopusColors.error
        "sky", "blue", "primary" -> PantopusColors.primary100 to PantopusColors.primary600
        else -> PantopusColors.appSurfaceSunken to PantopusColors.appTextSecondary
    }
