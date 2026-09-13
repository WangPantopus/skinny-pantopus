package app.pantopus.android.ui.screens.homes.members

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeMemberRemovalContext
import app.pantopus.android.data.homes.HomeMemberRemovalCurrent
import app.pantopus.android.data.homes.HomeMemberRemovalFailure
import app.pantopus.android.data.homes.HomeMemberRemovalFailureKind
import app.pantopus.android.data.homes.HomeMemberRemovalIntent
import app.pantopus.android.data.homes.HomeMemberRemovalOutcome
import app.pantopus.android.data.homes.HomeMemberRemovalRecovery
import app.pantopus.android.data.homes.HomeMemberRemovalRefusal
import app.pantopus.android.data.homes.PendingHomeMemberRemoval
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

data class HomeMemberRemovalTarget(val homeId: String? = null, val targetUserId: String? = null, val self: Boolean = false)

data class HomeMemberRemovalUiState(
    val generation: Long = 0L,
    val accountLabel: String = "",
    val opened: Boolean = false,
    val working: Boolean = false,
    val context: HomeMemberRemovalContext? = null,
    val pending: PendingHomeMemberRemoval? = null,
    val outcome: HomeMemberRemovalOutcome? = null,
    val canPrepare: Boolean = false,
    val canSubmit: Boolean = false,
    val canAcknowledge: Boolean = false,
    val currentRoster: HomeMemberRemovalCurrent = HomeMemberRemovalCurrent.Unchecked,
    val error: String? = null,
)

@HiltViewModel
class HomeMemberRemovalViewModel
    @Inject
    constructor(
        private val factory: HomeMemberRemovalFactory,
        private val auth: AuthRepository,
    ) : ViewModel() {
        private var lifetime: Job? = null
        private var scope: CoroutineScope? = null
        private var session: HomeClaimSessionScope? = null
        private var coordinator: HomeMemberRemovalCoordinator? = null
        private var generation = 0L
        private var visible = false
        private val _state = MutableStateFlow(HomeMemberRemovalUiState())
        val state = _state.asStateFlow()

        fun pause() {
            generation++
            visible = false
            coordinator?.hide()
            lifetime?.cancel()
            lifetime = null
            scope = null
            _state.value = HomeMemberRemovalUiState(generation = generation)
        }

        fun resume(target: HomeMemberRemovalTarget) {
            pause()
            visible = true
            val job = SupervisorJob(viewModelScope.coroutineContext[Job])
            lifetime = job
            val scope = CoroutineScope(viewModelScope.coroutineContext + job)
            this.scope = scope
            val session = factory.session(scope)
            this.session = session
            val coordinator = factory.create(session)
            this.coordinator = coordinator
            val user = (auth.state.value as? AuthRepository.State.SignedIn)?.user
            _state.value =
                HomeMemberRemovalUiState(
                    generation = generation, accountLabel = user?.displayName?.takeIf(String::isNotBlank) ?: user?.email.orEmpty(),
                )
            val revision = generation
            scope.launch {
                session.invalidated.collect { invalidated ->
                    if (invalidated && visible && generation == revision) {
                        pause()
                        _state.update {
                            it.copy(
                                error = HomeMemberRemovalFailure(HomeMemberRemovalFailureKind.SessionChanged).message,
                            )
                        }
                    }
                }
            }
            perform {
                coordinator.open()
                val targetId = if (target.self) session.actorId else target.targetUserId
                if (coordinator.canPrepare && target.homeId != null && targetId != null) {
                    coordinator.prepare(HomeMemberRemovalIntent(target.homeId, targetId))
                }
            }
        }

        fun submit(
            review: String,
            lifetime: Long,
        ) {
            if (!current(lifetime) || !_state.value.canSubmit || _state.value.context?.decisionToken != review) return
            perform { checkNotNull(coordinator).submit(review) }
        }

        fun recover(
            action: HomeMemberRemovalRecovery,
            requestId: String,
            lifetime: Long,
        ) {
            if (!current(lifetime) || _state.value.pending?.request?.requestId != requestId) return
            perform { checkNotNull(coordinator).recover(action, requestId) }
        }

        fun checkCurrentRoster(
            requestId: String,
            lifetime: Long,
        ) {
            if (!current(lifetime) || _state.value.pending?.request?.requestId != requestId) return
            perform { checkNotNull(coordinator).checkCurrentRoster(requestId) }
        }

        fun acknowledge(
            requestId: String,
            lifetime: Long,
            done: () -> Unit,
        ) {
            if (!current(lifetime) || !_state.value.canAcknowledge || _state.value.pending?.request?.requestId != requestId) return
            perform {
                if (checkNotNull(coordinator).acknowledge(requestId) != null) {
                    checkNotNull(session).requireCurrent()
                    if (current(lifetime)) done()
                }
            }
        }

        private fun current(revision: Long): Boolean = visible && generation == revision && session?.isCurrent == true

        private fun perform(action: suspend () -> Unit) {
            if (!visible || _state.value.working) return
            val revision = generation
            val session = session ?: return
            val coordinator = coordinator ?: return
            _state.update { it.copy(working = true, error = null, currentRoster = HomeMemberRemovalCurrent.Unchecked) }
            scope?.launch {
                try {
                    session.requireCurrent()
                    action()
                    session.requireCurrent()
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: HomeMemberRemovalFailure) {
                    if (error.kind == HomeMemberRemovalFailureKind.SessionChanged && visible && generation == revision) {
                        pause()
                        _state.update { it.copy(error = error.message) }
                    } else {
                        reportFailure(revision, error.message)
                    }
                } catch (error: HomeMemberRemovalRefusal) {
                    reportFailure(revision, error.message)
                } catch (_: Exception) {
                    reportFailure(revision, HomeMemberRemovalFailure(HomeMemberRemovalFailureKind.Storage).message)
                } finally {
                    if (current(revision)) {
                        _state.update {
                            it.copy(
                                working = false,
                                context = coordinator.context,
                                pending = coordinator.pending,
                                outcome = coordinator.outcome,
                                canPrepare = coordinator.canPrepare,
                                canSubmit = coordinator.canSubmit,
                                canAcknowledge = coordinator.canAcknowledge,
                                opened = coordinator.opened,
                                currentRoster = coordinator.currentRoster,
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
