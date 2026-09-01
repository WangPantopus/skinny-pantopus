@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.hub.today

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.hub.BriefingDeliveryDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.hub.HubRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * A10.3 / P1-F — backs the full-screen Hub "Today" briefing.
 *
 * The production path decodes `GET /api/hub/today` via [HubRepository] and
 * projects the orchestrated payload onto [TodayDetailContent]. Today always
 * has weather data, so the state machine is loading / populated / alert /
 * error (no empty); a `CONTEXT_UNAVAILABLE` payload (`today == null`) maps to
 * Error. Previews / snapshots / tests seed deterministic [TodaySampleData]
 * through [setFixture], which bypasses the network.
 */
@HiltViewModel
class TodayDetailViewModel
    @Inject
    constructor(
        private val repository: HubRepository,
        savedStateHandle: SavedStateHandle = SavedStateHandle(),
    ) : ViewModel() {
        private var fixture: TodayDetailContent? = null

        /** `DailyBriefingDelivery.id` carried by the push notification. */
        private val briefingDeliveryId: String? =
            savedStateHandle.get<String>(BRIEFING_DELIVERY_ID_KEY)?.takeIf { it.isNotEmpty() }

        /** `morning` | `evening` from the notification type / metadata. */
        private val requestedKind: String? =
            savedStateHandle.get<String>(BRIEFING_KIND_KEY)?.takeIf { it.isNotEmpty() }

        private val _state = MutableStateFlow<TodayDetailUiState>(TodayDetailUiState.Loading)
        val state: StateFlow<TodayDetailUiState> = _state.asStateFlow()

        /**
         * Header title — "Morning Briefing" / "Evening Briefing" once a stored
         * delivery (or the deep link's kind) resolves; "Today" otherwise.
         * Mirrors RN `hub-today.tsx`'s `headerTitle`.
         */
        private val _headerTitle = MutableStateFlow(titleForKind(requestedKind))
        val headerTitle: StateFlow<String> = _headerTitle.asStateFlow()

        fun load() {
            val seed = fixture
            if (seed != null) {
                _state.value =
                    if (seed.isAlert) TodayDetailUiState.Alert(seed) else TodayDetailUiState.Populated(seed)
                return
            }
            _state.value = TodayDetailUiState.Loading
            viewModelScope.launch {
                // Resolve the stored briefing first when the push carried one,
                // so a briefing that outlives the live Today window still opens.
                val briefing = fetchBriefing()
                (briefing?.briefingKind ?: requestedKind)?.let { _headerTitle.value = titleForKind(it) }
                when (val result = repository.todayDetail()) {
                    is NetworkResult.Success -> {
                        val payload = result.data
                        val hasStoredSummary = !briefing?.summaryText.isNullOrEmpty()
                        _state.value =
                            if (!payload.isRenderable && !hasStoredSummary) {
                                TodayDetailUiState.Error("Today's briefing isn't available right now.")
                            } else {
                                val content = TodayDetailMapper.fromPayload(payload, briefing)
                                if (content.isAlert) {
                                    TodayDetailUiState.Alert(content)
                                } else {
                                    TodayDetailUiState.Populated(content)
                                }
                            }
                    }
                    is NetworkResult.Failure -> {
                        // A stored briefing is enough to render on its own — RN
                        // falls back the same way.
                        _state.value =
                            if (!briefing?.summaryText.isNullOrEmpty()) {
                                TodayDetailUiState.Populated(TodayDetailMapper.fromPayload(null, briefing))
                            } else {
                                TodayDetailUiState.Error(result.error.displayMessage("Couldn't load Today."))
                            }
                    }
                }
            }
        }

        /**
         * `GET /api/hub/briefings/:id`. A missing / expired delivery degrades to
         * the live Today payload rather than failing the screen.
         */
        private suspend fun fetchBriefing(): BriefingDeliveryDto? {
            val id = briefingDeliveryId ?: return null
            return (repository.briefingDelivery(id) as? NetworkResult.Success)?.data?.briefing
        }

        fun refresh() = load()

        /** Test/preview seam — swap the stub fixture before calling [load]. */
        fun setFixture(content: TodayDetailContent) {
            this.fixture = content
        }

        companion object {
            const val BRIEFING_DELIVERY_ID_KEY = "briefingDeliveryId"
            const val BRIEFING_KIND_KEY = "briefingKind"

            fun titleForKind(kind: String?): String =
                when (kind?.lowercase()) {
                    "evening" -> "Evening Briefing"
                    "morning" -> "Morning Briefing"
                    else -> "Today"
                }
        }
    }
