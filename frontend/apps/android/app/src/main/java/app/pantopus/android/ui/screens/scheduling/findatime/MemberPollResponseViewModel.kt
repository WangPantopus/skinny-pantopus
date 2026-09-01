@file:Suppress(
    "PackageNaming",
    "TooManyFunctions",
    "MagicNumber",
    "LongMethod",
    "CyclomaticComplexMethod",
    "ReturnCount",
    "NestedBlockDepth",
)

package app.pantopus.android.ui.screens.scheduling.findatime

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.PollDetailResponse
import app.pantopus.android.data.api.models.scheduling.PollVoteInput
import app.pantopus.android.data.api.models.scheduling.PublicPollVoteRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The 3-way poll response: Works / If needed / Can't → `yes`/`maybe`/`no`. */
enum class VoteValue(val wire: String, val label: String) {
    Works("yes", "Works"),
    Maybe("maybe", "If needed"),
    Cant("no", "Can't"),
    ;

    companion object {
        fun fromWire(value: String?): VoteValue? = entries.firstOrNull { it.wire == value }
    }
}

/** Poll header facts (public GET /poll/:id has no organizer name). */
data class PollHeader(
    val title: String,
    val subtitle: String,
)

/** One proposed time with the current voter's selection. */
data class PollOptionUi(
    val id: String,
    val dayLabel: String,
    val timeLabel: String,
    val vote: VoteValue?,
    /**
     * Spec's conflicts-detected frame: this slot collides with the signed-in
     * member's personal calendar (renders a red "Conflicts" pill + a
     * personal-calendar caption). The public poll read carries no per-voter
     * conflict signal, so this stays false until that data is wired.
     */
    val conflict: Boolean = false,
)

/** F6 Find a Time — Member Poll Response (public). */
sealed interface PollResponseUiState {
    data object Loading : PollResponseUiState

    data class Loaded(
        val header: PollHeader,
        val options: List<PollOptionUi>,
        val voterName: String,
        val voterEmail: String,
        val needsEmail: Boolean,
        val submitting: Boolean = false,
        val submitted: Boolean = false,
        val error: String? = null,
    ) : PollResponseUiState {
        /**
         * Spec gates the footer on having voted (the member is signed-in, so the
         * vote is bound to their account) — not on capturing an email.
         */
        val canSubmit: Boolean
            get() = !submitting && options.any { it.vote != null }

        /** True once the member has cast at least one vote (spec's "answered" frame). */
        val hasAnswered: Boolean
            get() = options.any { it.vote != null }
    }

    /** Poll closed/finalized — read-only. */
    data class Closed(
        val header: PollHeader,
        val options: List<PollOptionUi>,
        val finalizedLabel: String?,
    ) : PollResponseUiState

    data class Error(val message: String) : PollResponseUiState
}

/**
 * F6 Find a Time — Member Poll Response (home v2). Reads the poll over the
 * **public** mount (`GET /poll/:id`) and casts a vote (`POST /poll/:id/vote`).
 * The public client carries no auth header, so the voter is bound by the
 * signed-in user's email/name (or a captured email). Closed polls
 * (`POLL_CLOSED` / `status != open`) are a first-class read-only state.
 */
@HiltViewModel
class MemberPollResponseViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        auth: AuthRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val pollId: String = savedStateHandle[SchedulingRoutes.ARG_POLL_ID] ?: ""
        private val signedIn = auth.state.value as? AuthRepository.State.SignedIn
        private val zone = FindATimeFormat.deviceZoneId()

        private val _state = MutableStateFlow<PollResponseUiState>(PollResponseUiState.Loading)
        val state: StateFlow<PollResponseUiState> = _state.asStateFlow()

        private var started = false

        fun start() {
            if (started) return
            started = true
            load()
        }

        fun load() {
            _state.value = PollResponseUiState.Loading
            viewModelScope.launch {
                when (val r = repo.publicGetPoll(pollId)) {
                    is NetworkResult.Success -> render(r.data)
                    is NetworkResult.Failure -> {
                        val decoded = errors.decode(r.error, notFoundAs = SchedulingError.Unavailable)
                        _state.value =
                            PollResponseUiState.Error(
                                if (decoded is SchedulingError.Unavailable) {
                                    "This poll isn't available anymore."
                                } else {
                                    "We couldn't load this poll."
                                },
                            )
                    }
                }
            }
        }

        private fun render(data: PollDetailResponse) {
            val header =
                PollHeader(
                    title = data.poll.title?.takeIf { it.isNotBlank() } ?: "Find a time",
                    subtitle =
                        buildString {
                            data.poll.durationMin?.let { append(FindATimeFormat.durationLabel(it)) }
                            data.poll.description?.takeIf { it.isNotBlank() }?.let {
                                if (isNotEmpty()) append(" · ")
                                append(it)
                            }
                            if (isEmpty()) append("Pick the times that work")
                        },
                )
            // "Your votes" pre-selection is intentionally OFF: the public poll
            // read carries no viewer-scoped vote key, and matching rows by
            // display name / email string is wrong (name collisions surface a
            // stranger's votes as yours, and the server is dropping voter_name
            // from the public read). Re-enable once the API returns votes keyed
            // to the requesting viewer.
            val options =
                data.options.map { o ->
                    PollOptionUi(
                        id = o.id,
                        dayLabel = FindATimeFormat.zonedDay(o.startAt ?: "", zone),
                        timeLabel = FindATimeFormat.zonedTime(o.startAt ?: "", zone),
                        vote = null,
                    )
                }
            val open = data.poll.status.equals("open", ignoreCase = true)
            _state.value =
                if (open) {
                    PollResponseUiState.Loaded(
                        header = header,
                        options = options,
                        voterName = signedIn?.user?.displayName.orEmpty(),
                        voterEmail = signedIn?.user?.email.orEmpty(),
                        needsEmail = signedIn?.user?.email.isNullOrBlank(),
                    )
                } else {
                    PollResponseUiState.Closed(
                        header = header,
                        options = options,
                        finalizedLabel =
                            data.poll.finalizedStartAt?.let {
                                "${FindATimeFormat.zonedDay(it, zone)} · ${FindATimeFormat.zonedTime(it, zone)}"
                            },
                    )
                }
        }

        fun setVote(
            optionId: String,
            value: VoteValue,
        ) = _state.update { s ->
            if (s is PollResponseUiState.Loaded) {
                s.copy(
                    options = s.options.map { if (it.id == optionId) it.copy(vote = if (it.vote == value) null else value) else it },
                    error = null,
                )
            } else {
                s
            }
        }

        fun setVoterName(value: String) = _state.update { s -> if (s is PollResponseUiState.Loaded) s.copy(voterName = value) else s }

        fun setVoterEmail(value: String) =
            _state.update { s ->
                if (s is PollResponseUiState.Loaded) {
                    s.copy(
                        voterEmail = value,
                        error = null,
                    )
                } else {
                    s
                }
            }

        fun submit() {
            val loaded = state.value as? PollResponseUiState.Loaded ?: return
            if (!loaded.canSubmit) return
            _state.value = loaded.copy(submitting = true, error = null)
            viewModelScope.launch {
                val votes = loaded.options.mapNotNull { o -> o.vote?.let { PollVoteInput(optionId = o.id, value = it.wire) } }
                val result =
                    repo.publicVotePoll(
                        pollId = pollId,
                        body =
                            PublicPollVoteRequest(
                                votes = votes,
                                name = loaded.voterName.ifBlank { null },
                                email = loaded.voterEmail.ifBlank { null },
                            ),
                    )
                when (result) {
                    is NetworkResult.Success ->
                        _state.update { s -> if (s is PollResponseUiState.Loaded) s.copy(submitting = false, submitted = true) else s }
                    is NetworkResult.Failure -> {
                        val decoded = errors.decode(result.error)
                        if (decoded is SchedulingError.Generic && decoded.code == POLL_CLOSED) {
                            _state.value =
                                PollResponseUiState.Closed(
                                    header = loaded.header,
                                    options = loaded.options,
                                    finalizedLabel = null,
                                )
                        } else {
                            _state.update { s ->
                                if (s is PollResponseUiState.Loaded) {
                                    s.copy(submitting = false, error = "We couldn't submit your response. Try again.")
                                } else {
                                    s
                                }
                            }
                        }
                    }
                }
            }
        }

        private companion object {
            const val POLL_CLOSED = "POLL_CLOSED"
        }
    }
