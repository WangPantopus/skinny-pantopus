@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.homes.polls

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.analytics.AnalyticsResult
import app.pantopus.android.data.api.models.homes.CastVoteRequest
import app.pantopus.android.data.api.models.homes.PollDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** Nav-arg keys for the Poll Detail route. */
const val POLL_DETAIL_HOME_ID_KEY = "homeId"
const val POLL_DETAIL_POLL_ID_KEY = "pollId"

/** UI state for the Poll Detail screen. */
sealed interface PollDetailUiState {
    data object Loading : PollDetailUiState

    data class Loaded(
        val poll: PollDto,
        val votingOptionId: String? = null,
        val voteError: String? = null,
    ) : PollDetailUiState

    data class Error(val message: String) : PollDetailUiState
}

/** ViewModel backing [PollDetailScreen] (T6.3e / P13). */
@HiltViewModel
class PollDetailViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle[POLL_DETAIL_HOME_ID_KEY]) {
                "PollDetailViewModel requires a $POLL_DETAIL_HOME_ID_KEY nav argument"
            }
        private val pollId: String =
            checkNotNull(savedStateHandle[POLL_DETAIL_POLL_ID_KEY]) {
                "PollDetailViewModel requires a $POLL_DETAIL_POLL_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<PollDetailUiState>(PollDetailUiState.Loading)
        val state: StateFlow<PollDetailUiState> = _state.asStateFlow()

        private var onChanged: () -> Unit = {}

        fun configureNavigation(onChanged: () -> Unit = {}) {
            this.onChanged = onChanged
        }

        fun load() {
            _state.value = PollDetailUiState.Loading
            viewModelScope.launch {
                // Backend has no GET-by-id for polls today; fetch the list
                // and pick the matching row. Lists are small.
                when (val result = repo.getHomePolls(homeId)) {
                    is NetworkResult.Failure ->
                        _state.value = PollDetailUiState.Error(result.error.displayMessage("Couldn't load this poll."))
                    is NetworkResult.Success -> {
                        val poll = result.data.polls.firstOrNull { it.id == pollId }
                        _state.value =
                            if (poll == null) {
                                PollDetailUiState.Error("This poll is no longer available.")
                            } else {
                                PollDetailUiState.Loaded(poll)
                            }
                    }
                }
            }
        }

        fun castVote(optionId: String) {
            val current = _state.value as? PollDetailUiState.Loaded ?: return
            if (current.votingOptionId != null) return
            // Block voting on closed polls; the row UI already disables tap.
            if (PollsListViewModel.chipStatus(current.poll, Instant.now()) == PollChipStatus.Closed) {
                return
            }
            val snapshot = current.poll
            val optimistic = applyOptimisticVote(snapshot, optionId)
            _state.value =
                current.copy(
                    poll = optimistic,
                    votingOptionId = optionId,
                    voteError = null,
                )
            viewModelScope.launch {
                val result =
                    repo.castHomePollVote(
                        homeId = homeId,
                        pollId = pollId,
                        request = CastVoteRequest(selectedOptions = listOf(optionId)),
                    )
                when (result) {
                    is NetworkResult.Success -> {
                        Analytics.track(AnalyticsEvent.CtaPollVoteSubmit(AnalyticsResult.SUCCESS))
                        onChanged()
                        // Re-fetch authoritative counts (other members may
                        // have voted in the meantime). On failure of the
                        // refresh we keep the optimistic state.
                        when (val refresh = repo.getHomePolls(homeId)) {
                            is NetworkResult.Success -> {
                                val updated = refresh.data.polls.firstOrNull { it.id == pollId }
                                _state.value =
                                    (
                                        _state.value as? PollDetailUiState.Loaded
                                            ?: current
                                    ).copy(
                                        poll = updated ?: optimistic,
                                        votingOptionId = null,
                                        voteError = null,
                                    )
                            }
                            is NetworkResult.Failure ->
                                _state.value =
                                    (
                                        _state.value as? PollDetailUiState.Loaded
                                            ?: current
                                    ).copy(votingOptionId = null, voteError = null)
                        }
                    }
                    is NetworkResult.Failure -> {
                        Analytics.track(AnalyticsEvent.CtaPollVoteSubmit(AnalyticsResult.ERROR))
                        // Roll back to the snapshot.
                        _state.value =
                            current.copy(
                                poll = snapshot,
                                votingOptionId = null,
                                voteError = result.error.message,
                            )
                    }
                }
            }
        }

        companion object {
            /**
             * Pure projection: returns a new [PollDto] with the viewer's
             * vote applied. Adjusts `optionCounts` + `voteCount` so the
             * optimistic render matches what the server will return on
             * success.
             */
            @JvmStatic
            fun applyOptimisticVote(
                poll: PollDto,
                optionId: String,
            ): PollDto {
                val previousVote = poll.myVote?.firstOrNull()
                val counts = poll.optionCounts.toMutableMap()
                var voteCount = poll.voteCount
                if (!previousVote.isNullOrEmpty()) {
                    val before = (counts[previousVote] ?: 1) - 1
                    if (before <= 0) {
                        counts.remove(previousVote)
                    } else {
                        counts[previousVote] = before
                    }
                } else {
                    voteCount += 1
                }
                counts[optionId] = (counts[optionId] ?: 0) + 1
                return poll.copy(
                    voteCount = voteCount,
                    optionCounts = counts.toMap(),
                    myVote = listOf(optionId),
                )
            }
        }
    }
