@file:Suppress("TooManyFunctions")

package app.pantopus.android.ui.screens.plans.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.plans.AskToJoinBody
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanRequestsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.blocks.BlocksRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanLocationResolver
import app.pantopus.android.data.plans.PlanOrigin
import app.pantopus.android.data.plans.PlanRead
import app.pantopus.android.data.plans.PlanRequestStatus
import app.pantopus.android.data.plans.PlanViewerStanding
import app.pantopus.android.data.plans.PlansEvents
import app.pantopus.android.data.plans.PlansFeature
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.plans.hasPrivatePart
import app.pantopus.android.data.plans.planCode
import app.pantopus.android.data.plans.planMessage
import app.pantopus.android.data.plans.standing
import app.pantopus.android.ui.screens.place.HubVerificationTarget
import app.pantopus.android.ui.screens.plans.PlansRoutes
import app.pantopus.android.ui.screens.plans.plansVerificationTarget
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** What the plan page shows. */
sealed interface PlanDetailUiState {
    data object Loading : PlanDetailUiState

    /** [fresh] is false while only the card from the map or a list is on screen. */
    data class Ready(
        val plan: PlanDto,
        val fresh: Boolean,
    ) : PlanDetailUiState

    /** A playdate shared with someone who can't see it yet (board J9). */
    data class PlaydateLocked(
        val city: String?,
    ) : PlanDetailUiState

    /** Removed, cancelled and hidden, or blocked: nothing to show. */
    data object Gone : PlanDetailUiState

    data class Failed(
        val message: String,
    ) : PlanDetailUiState
}

/** The "Ask to join" sheet (J3, J4). */
data class AskDraft(
    val partySize: Int = 1,
    val note: String = "",
    val kidsCount: Int = 1,
    val ageBands: Set<String> = emptySet(),
    val staysWithKids: Boolean = true,
    val sending: Boolean = false,
    val error: String? = null,
)

/** The whole page. */
data class PlanDetailUi(
    val state: PlanDetailUiState = PlanDetailUiState.Loading,
    val askOpen: Boolean = false,
    val ask: AskDraft = AskDraft(),
    val busy: Boolean = false,
    val notice: String? = null,
    val reveal: Boolean = false,
    val cancelOpen: Boolean = false,
    val cancelNote: String = "",
    val others: List<PlanDto> = emptyList(),
    /** The host's view of who asked (H9's requests card, the waitlist). */
    val requests: PlanRequestsResponse? = null,
    /** The person looking, to tell "you" apart in the people going. */
    val viewerId: String? = null,
)

/**
 * One plan, as the person looking at it stands (boards J1 to J9 and H9). The page shows the public card from the
 * map at once when it has one, then reads the plan fresh: its private part (exact place, note, people, chat) is
 * never stored, so a guest who was removed sees none of it after the next read.
 */
@HiltViewModel
class PlanDetailViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repository: PlansRepository,
        private val events: PlansEvents,
        private val blocks: BlocksRepository,
        private val homes: HomesRepository,
        private val locations: PlanLocationResolver,
        feature: PlansFeature,
    ) : ViewModel() {
        val planId: String = savedStateHandle.get<String>(PlansRoutes.PLAN_ID_KEY).orEmpty()
        private val askOnOpen: Boolean = savedStateHandle.get<Boolean>(PlansRoutes.ASK_KEY) ?: false
        private val revealOnOpen: Boolean = savedStateHandle.get<Boolean>(PlansRoutes.REVEAL_KEY) ?: false

        private val _ui = MutableStateFlow(PlanDetailUi(viewerId = feature.viewerId))
        val ui: StateFlow<PlanDetailUi> = _ui.asStateFlow()

        private var loadJob: Job? = null
        private var askedOnOpen = false

        init {
            repository.card(planId)?.let { card -> _ui.update { it.copy(state = PlanDetailUiState.Ready(card, fresh = false)) } }
        }

        /** Every appearance: read the plan fresh. */
        fun load() {
            if (loadJob?.isActive == true) return
            loadJob = viewModelScope.launch { read() }
        }

        private suspend fun read() {
            when (val read = repository.read(planId)) {
                is PlanRead.Found -> show(read.plan)
                is PlanRead.Locked -> _ui.update { it.copy(state = PlanDetailUiState.PlaydateLocked(read.city)) }
                PlanRead.Missing -> _ui.update { it.copy(state = PlanDetailUiState.Gone) }
                is PlanRead.Failed ->
                    _ui.update {
                        if (it.state is PlanDetailUiState.Ready) {
                            it.copy(notice = read.error.planMessage)
                        } else {
                            it.copy(state = PlanDetailUiState.Failed(read.error.planMessage))
                        }
                    }
            }
        }

        private fun show(plan: PlanDto) {
            val before = (_ui.value.state as? PlanDetailUiState.Ready)?.plan?.standing
            val nowIn = plan.standing == PlanViewerStanding.IN && plan.hasPrivatePart
            val wasWaiting = before == PlanViewerStanding.REQUESTED || before == PlanViewerStanding.WAITLISTED
            val reveal = nowIn && (revealOnOpen || wasWaiting || events.shouldReveal(plan.id))
            if (nowIn) events.revealed(plan.id)
            _ui.update {
                it.copy(
                    state = PlanDetailUiState.Ready(plan, fresh = true),
                    reveal = it.reveal || reveal,
                    others = repository.lastList.filter { it.id != plan.id && it.standing == PlanViewerStanding.NONE }.take(2),
                )
            }
            val canAskNow = plan.standing == PlanViewerStanding.NONE && plan.viewer?.canAsk == true
            if (askOnOpen && !askedOnOpen && canAskNow) {
                askedOnOpen = true
                openAsk()
            }
            if (plan.standing == PlanViewerStanding.HOSTING) loadRequests()
        }

        private fun loadRequests() {
            viewModelScope.launch {
                (repository.requests(planId) as? NetworkResult.Success)?.data?.let { reply -> _ui.update { it.copy(requests = reply) } }
            }
        }

        fun hasLocationPermission(): Boolean = locations.hasLocationPermission()

        /** "Share your location to join" (J1): ask again with a fresh fix as the person's location. */
        fun useMyLocation() {
            viewModelScope.launch {
                val fix = locations.gpsFix()
                if (fix == null) {
                    _ui.update { it.copy(notice = "Couldn't find your location. Check that location is on.") }
                    return@launch
                }
                repository.setOrigin(PlanOrigin(fix.latitude, fix.longitude, fix.at))
                read()
            }
        }

        /** "Report this plan": files a report on the post in the admin queue. */
        fun report(reason: String) {
            viewModelScope.launch {
                val result = repository.report(planId, reason)
                _ui.update {
                    it.copy(
                        notice =
                            when (result) {
                                is NetworkResult.Success -> "Thanks. We'll look into it."
                                is NetworkResult.Failure -> result.error.planMessage
                            },
                    )
                }
            }
        }

        /** "Verify your address" (J9, a plan for verified neighbors): the Home waiting on verification, or Add Home. */
        suspend fun verificationTarget(): HubVerificationTarget = plansVerificationTarget(homes)

        /** "Block {host}": hides their plans and requests both ways. */
        fun blockHost() {
            val hostId = (_ui.value.state as? PlanDetailUiState.Ready)?.plan?.host?.userId ?: return
            viewModelScope.launch {
                when (val result = blocks.block(hostId)) {
                    is NetworkResult.Success -> {
                        repository.changed()
                        _ui.update { it.copy(state = PlanDetailUiState.Gone, notice = "Blocked. You won't see their plans.") }
                    }
                    is NetworkResult.Failure -> _ui.update { it.copy(notice = result.error.planMessage) }
                }
            }
        }

        /** The page is on screen (resumed) or not: a plain push about this plan stays quiet meanwhile. */
        fun onScreen(visible: Boolean) {
            if (visible) {
                events.viewedPlanId = planId
            } else if (events.viewedPlanId == planId) {
                events.viewedPlanId = null
            }
        }

        fun revealShown() {
            _ui.update { it.copy(reveal = false) }
        }

        fun noticeShown() {
            _ui.update { it.copy(notice = null) }
        }

        // ---- Ask (J3, J4) ----

        fun openAsk() {
            val plan = (_ui.value.state as? PlanDetailUiState.Ready)?.plan ?: return
            val mine = plan.myRequest
            _ui.update {
                it.copy(
                    askOpen = true,
                    ask =
                        AskDraft(
                            partySize = mine?.partySize ?: 1,
                            note = mine?.note.orEmpty(),
                            kidsCount = mine?.kidsCount ?: 1,
                            ageBands = mine?.kidsAgeBands.orEmpty().toSet(),
                        ),
                )
            }
        }

        fun closeAsk() {
            _ui.update { it.copy(askOpen = false) }
        }

        fun editAsk(transform: (AskDraft) -> AskDraft) {
            _ui.update { it.copy(ask = transform(it.ask).copy(error = null)) }
        }

        fun sendAsk() {
            val plan = (_ui.value.state as? PlanDetailUiState.Ready)?.plan ?: return
            val draft = _ui.value.ask
            val playdate = plan.kind == PlanKind.PLAYDATE.wire
            if (playdate && (!draft.staysWithKids || draft.ageBands.isEmpty())) {
                _ui.update { it.copy(ask = draft.copy(error = "Add your kids' ages and confirm you'll stay with them.")) }
                return
            }
            _ui.update { it.copy(ask = draft.copy(sending = true, error = null)) }
            viewModelScope.launch {
                val body =
                    if (playdate) {
                        AskToJoinBody(
                            partySize = 1,
                            note = draft.note.trim().takeIf(String::isNotEmpty),
                            kidsCount = draft.kidsCount,
                            kidsAgeBands = draft.ageBands.toList(),
                            staysWithKids = true,
                        )
                    } else {
                        AskToJoinBody(partySize = draft.partySize, note = draft.note.trim().takeIf(String::isNotEmpty))
                    }
                when (val result = repository.ask(planId, body)) {
                    is NetworkResult.Success -> {
                        val status = PlanRequestStatus.from(result.data.request?.status)
                        _ui.update { it.copy(askOpen = false, ask = it.ask.copy(sending = false)) }
                        result.data.plan?.let { reply -> _ui.update { it.copy(state = PlanDetailUiState.Ready(reply, fresh = false)) } }
                        if (status == PlanRequestStatus.ACCEPTED) _ui.update { it.copy(reveal = true) }
                        read()
                    }
                    is NetworkResult.Failure ->
                        _ui.update { it.copy(ask = it.ask.copy(sending = false, error = askError(result.error))) }
                }
            }
        }

        private fun askError(error: NetworkError): String =
            when (error.planCode) {
                "needs_verified_address" -> "This plan is for neighbors with a verified address."
                "too_far" -> "This plan is too far from your home or where you are now."
                "needs_location" -> "Share your location or add your home to ask."
                "too_many_requests" -> "You have 10 open requests. Withdraw one to ask here."
                "full" -> "It just filled up. You can join the waitlist."
                else -> error.planMessage
            }

        // ---- Your request (J5, J6, J7) ----

        /** Withdraw a request, leave the waitlist, or leave the plan ("Can't make it"). */
        fun withdraw() = act { repository.withdraw(planId) }

        fun onMyWay() = act(done = "We told the group you're on the way.") { repository.onMyWay(planId) }

        fun stillComing(coming: Boolean) =
            act(done = if (coming) "Thanks. The host knows you're still coming." else "You've left the plan.") {
                repository.stillComing(planId, coming)
            }

        // ---- Host (H9, H12) ----

        fun openCancel() {
            _ui.update { it.copy(cancelOpen = true) }
        }

        fun closeCancel() {
            _ui.update { it.copy(cancelOpen = false, cancelNote = "") }
        }

        fun editCancelNote(text: String) {
            _ui.update { it.copy(cancelNote = text.take(CANCEL_NOTE_MAX)) }
        }

        fun cancelPlan() {
            val note = _ui.value.cancelNote
            _ui.update { it.copy(cancelOpen = false) }
            act(done = "Plan cancelled. Everyone has been told.") { repository.cancel(planId, note) }
        }

        fun removeGuest(requestId: String) = act(done = "Removed. They no longer see the plan.") { repository.remove(planId, requestId) }

        private fun act(
            done: String? = null,
            block: suspend () -> NetworkResult<Unit>,
        ) {
            if (_ui.value.busy) return
            _ui.update { it.copy(busy = true) }
            viewModelScope.launch {
                val result = block()
                _ui.update {
                    it.copy(
                        busy = false,
                        notice =
                            when (result) {
                                is NetworkResult.Success -> done
                                is NetworkResult.Failure -> result.error.planMessage
                            },
                    )
                }
                read()
            }
        }

        private companion object {
            const val CANCEL_NOTE_MAX = 280
        }
    }
