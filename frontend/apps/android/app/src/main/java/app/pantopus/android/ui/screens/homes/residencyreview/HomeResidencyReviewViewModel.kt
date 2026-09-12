package app.pantopus.android.ui.screens.homes.residencyreview

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.homes.HomeResidencyCurrentReview
import app.pantopus.android.data.homes.HomeResidencyDecision
import app.pantopus.android.data.homes.HomeResidencyReviewCodec
import app.pantopus.android.data.homes.HomeResidencyReviewFailure
import app.pantopus.android.data.homes.HomeResidencyReviewFailureKind
import app.pantopus.android.data.homes.HomeResidencyReviewRole
import app.pantopus.android.data.homes.PendingHomeResidencyReview
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeResidencyReviewUiState(
    val presented: Boolean = false,
    val working: Boolean = false,
    val opened: Boolean = false,
    val review: HomeResidencyCurrentReview? = null,
    val pending: PendingHomeResidencyReview? = null,
    val receiptJson: String? = null,
    val storageFailed: Boolean = false,
    val canDiscard: Boolean = false,
    val claimant: String? = null,
    val action: HomeResidencyDecision = HomeResidencyDecision.Approve,
    val role: HomeResidencyReviewRole = HomeResidencyReviewRole.Member,
    val reason: String = "",
    val reviewed: Boolean = false,
    val error: String? = null,
) {
    val canEdit: Boolean get() = !working && !storageFailed && pending == null && review?.canDecide(review.actorId) == true
    val canSubmit: Boolean get() =
        canEdit && reviewed && (action == HomeResidencyDecision.Approve || reason.length <= HomeResidencyReviewCodec.MAX_REASON)
    val canRetry: Boolean get() = !working && review != null && pending != null && pending.receiptJson == null
    val canAcknowledge: Boolean get() =
        !working && !storageFailed && review != null && pending != null && (pending.receiptJson != null || canDiscard)
}

@HiltViewModel
class HomeResidencyReviewViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val factory: HomeResidencyReviewFactory,
        sessions: HomeClaimSessionScopeFactory,
        networkMonitor: NetworkMonitor,
    ) : ViewModel() {
        private val homeId = savedStateHandle.get<String>("homeId").orEmpty().lowercase()
        private val session = sessions.create(viewModelScope)
        private val coordinator = factory.create(session, homeId)
        private var requestedClaim: String? = null
        private var initialAction = HomeResidencyDecision.Approve
        private var generation = 0L
        private var visible = false
        private var job: Job? = null
        private val _state = MutableStateFlow(HomeResidencyReviewUiState())
        val state = _state.asStateFlow()
        val isOnline = networkMonitor.isOnline
        val codec: HomeResidencyReviewCodec get() = factory.codec
        val recoveringAnotherClaim: Boolean get() =
            requestedClaim != null && _state.value.pending?.claimId?.let { it != requestedClaim } == true

        init {
            viewModelScope.launch {
                session.invalidated.collect { invalidated ->
                    if (invalidated) {
                        pause()
                        _state.update {
                            it.copy(
                                opened = true,
                                error = HomeResidencyReviewFailure(HomeResidencyReviewFailureKind.SessionChanged).message,
                            )
                        }
                    }
                }
            }
        }

        fun show(
            claim: String? = null,
            action: HomeResidencyDecision = HomeResidencyDecision.Approve,
        ) {
            if (_state.value.presented) return
            requestedClaim = claim
            initialAction = action
            _state.value = HomeResidencyReviewUiState(presented = true, action = action)
            resume()
        }

        fun dismiss() {
            pause()
            _state.update { it.copy(presented = false) }
        }

        fun pause() {
            generation++
            visible = false
            job?.cancel()
            job = null
            coordinator.hide()
            _state.value = HomeResidencyReviewUiState(presented = _state.value.presented, action = initialAction)
        }

        fun resume() {
            if (!_state.value.presented || _state.value.working) return
            visible = true
            _state.value = HomeResidencyReviewUiState(presented = true, action = initialAction)
            perform { coordinator.open(requestedClaim) }
        }

        fun changeAction(value: HomeResidencyDecision) {
            if (_state.value.canEdit) _state.update { it.copy(action = value, reviewed = false) }
        }

        fun changeRole(value: HomeResidencyReviewRole) {
            if (_state.value.canEdit) _state.update { it.copy(role = value, reviewed = false) }
        }

        fun changeReason(value: String) {
            if (_state.value.canEdit) _state.update { it.copy(reason = value, reviewed = false) }
        }

        fun confirm(value: Boolean) {
            if (_state.value.canEdit) _state.update { it.copy(reviewed = value) }
        }

        fun submit() {
            val selected = _state.value
            if (!selected.canSubmit) return
            _state.update { it.copy(reason = "", reviewed = false) }
            perform {
                coordinator.prepare(selected.action, selected.role, selected.reason)
                coordinator.resolve()
            }
        }

        fun retry() {
            if (_state.value.canRetry) perform { coordinator.resolve() }
        }

        fun acknowledge() {
            if (!_state.value.canAcknowledge) return
            _state.update { it.copy(action = initialAction, role = HomeResidencyReviewRole.Member, reason = "", reviewed = false) }
            perform { coordinator.acknowledge(requestedClaim) }
        }

        private fun current(revision: Long): Boolean = visible && session.isCurrent && generation == revision

        private fun perform(action: suspend () -> Unit) {
            if (!visible || _state.value.working) return
            val revision = generation
            _state.update { it.copy(working = true, error = null, claimant = null, review = null, pending = null, receiptJson = null) }
            job =
                viewModelScope.launch {
                    var claimant: String? = null
                    try {
                        session.requireCurrent()
                        action()
                        coordinator.review?.applicantId?.let { applicant ->
                            claimant =
                                try {
                                    factory.publicName(applicant)
                                } catch (cancelled: CancellationException) {
                                    throw cancelled
                                } catch (_: Exception) {
                                    null
                                }
                        }
                        session.requireCurrent()
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (error: IllegalStateException) {
                        if (visible && revision == generation) {
                            val fallback =
                                if (session.isCurrent) {
                                    HomeResidencyReviewFailureKind.Unavailable
                                } else {
                                    HomeResidencyReviewFailureKind.SessionChanged
                                }
                            val failure = error as? HomeResidencyReviewFailure ?: HomeResidencyReviewFailure(fallback)
                            _state.update { it.copy(error = failure.message, reviewed = false) }
                        }
                    } finally {
                        if (visible && revision == generation) {
                            val review = coordinator.review.takeIf { current(revision) }
                            _state.update {
                                it.copy(
                                    working = false, opened = true, review = review,
                                    pending = coordinator.pending.takeIf { review != null },
                                    receiptJson = coordinator.receipt.takeIf { review != null },
                                    storageFailed = coordinator.storageFailed, canDiscard = coordinator.canDiscard,
                                    claimant = claimant.takeIf { review != null },
                                )
                            }
                        }
                    }
                }
        }
    }
