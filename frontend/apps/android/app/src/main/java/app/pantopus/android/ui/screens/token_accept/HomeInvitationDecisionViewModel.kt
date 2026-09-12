@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.token_accept

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyProgress
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeInvitationDecisionContext
import app.pantopus.android.data.homes.HomeInvitationDecisionOutcome
import app.pantopus.android.data.homes.HomeInvitationFailure
import app.pantopus.android.data.homes.HomeInvitationFailureKind
import app.pantopus.android.data.homes.HomeInvitationRecoveryAction
import app.pantopus.android.data.homes.HomeInvitationRefusal
import app.pantopus.android.data.homes.PendingHomeInvitationDecision
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeInvitationDecisionUiState(
    val generation: Long = 0L,
    val accountLabel: String = "",
    val token: String = "",
    val working: Boolean = false,
    val context: HomeInvitationDecisionContext? = null,
    val pending: PendingHomeInvitationDecision? = null,
    val outcome: HomeInvitationDecisionOutcome? = null,
    val access: PersonalHomeResidencyProgress? = null,
    val canDecide: Boolean = false,
    val canAcknowledge: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class HomeInvitationDecisionViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val factory: HomeInvitationDecisionFactory,
        private val auth: AuthRepository,
    ) : ViewModel() {
        private val token = savedStateHandle.get<String>(TokenAcceptViewModel.TOKEN_KEY).orEmpty()
        private var lifetime: Job? = null
        private var scope: CoroutineScope? = null
        private var session: HomeClaimSessionScope? = null
        private var coordinator: HomeInvitationDecisionCoordinator? = null
        private var generation = 0L
        private var visible = false
        private val _state = MutableStateFlow(HomeInvitationDecisionUiState())
        val state = _state.asStateFlow()

        fun pause() {
            generation++
            visible = false
            coordinator?.hide()
            lifetime?.cancel()
            lifetime = null
            scope = null
            _state.value = HomeInvitationDecisionUiState(generation = generation)
        }

        fun resume() {
            pause()
            visible = true
            val job = SupervisorJob(viewModelScope.coroutineContext[Job])
            lifetime = job
            val scope = CoroutineScope(viewModelScope.coroutineContext + job)
            this.scope = scope
            val session = factory.session(scope)
            this.session = session
            val coordinator = factory.create(session, token)
            this.coordinator = coordinator
            val user = (auth.state.value as? AuthRepository.State.SignedIn)?.user
            _state.value =
                HomeInvitationDecisionUiState(
                    generation = generation, token = token,
                    accountLabel = user?.displayName?.takeIf(String::isNotBlank) ?: user?.email.orEmpty(),
                )
            val revision = generation
            scope.launch {
                session.invalidated.collect { invalidated ->
                    if (invalidated && visible && generation == revision) {
                        pause()
                        _state.update { it.copy(error = HomeInvitationFailure(HomeInvitationFailureKind.SessionChanged).message) }
                    }
                }
            }
            perform { coordinator.open() }
        }

        fun decide(
            action: String,
            review: String,
            lifetime: Long,
        ) {
            if (!current(lifetime) || !_state.value.canDecide || _state.value.context?.decisionToken != review) return
            perform { checkNotNull(coordinator).decide(action, review) }
        }

        fun recover(
            action: HomeInvitationRecoveryAction,
            requestId: String,
            lifetime: Long,
        ) {
            if (!current(lifetime) || _state.value.pending?.request?.requestId != requestId) return
            perform { checkNotNull(coordinator).recover(action, requestId) }
        }

        fun checkAccess() {
            perform { checkNotNull(coordinator).checkAccess() }
        }

        fun acknowledge(
            requestId: String,
            openHome: Boolean,
            done: (PendingHomeInvitationDecision) -> Unit,
        ) {
            if (!_state.value.canAcknowledge) return
            perform { checkNotNull(coordinator).acknowledge(requestId, openHome)?.let(done) }
        }

        fun switchAccount(lifetime: Long) {
            if (!current(lifetime) || _state.value.working) return
            _state.update { it.copy(working = true) }
            viewModelScope.launch {
                val switched =
                    try {
                        auth.signOutReturningToContent("/invite/$token")
                    } catch (
                        cancelled: CancellationException,
                    ) {
                        throw cancelled
                    } catch (_: Exception) {
                        false
                    }
                if (!switched && current(lifetime)) {
                    _state.update {
                        it.copy(
                            working = false,
                            error = "The invitation could not be saved securely for sign-in. Your account is still signed in. Try again.",
                        )
                    }
                }
            }
        }

        private fun current(revision: Long): Boolean = visible && generation == revision && session?.isCurrent == true

        private fun perform(action: suspend () -> Unit) {
            if (!visible || _state.value.working) return
            val revision = generation
            val session = session ?: return
            val coordinator = coordinator ?: return
            _state.update { it.copy(working = true, error = null) }
            scope?.launch {
                try {
                    session.requireCurrent()
                    action()
                    session.requireCurrent()
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: HomeInvitationFailure) {
                    reportFailure(revision, error.message)
                } catch (error: HomeInvitationRefusal) {
                    reportFailure(revision, error.message)
                } catch (_: Exception) {
                    reportFailure(revision, HomeInvitationFailure(HomeInvitationFailureKind.Storage).message)
                } finally {
                    if (current(revision)) {
                        _state.update {
                            it.copy(
                                working = false,
                                context = coordinator.context,
                                pending = coordinator.pending,
                                outcome = coordinator.outcome,
                                access = coordinator.access,
                                canDecide = coordinator.canDecide,
                                canAcknowledge = coordinator.canAcknowledge,
                            )
                        }
                    }
                }
            }
        }

        private fun reportFailure(
            revision: Long,
            message: String?,
        ) {
            if (current(revision)) _state.update { it.copy(error = message) }
        }
    }
