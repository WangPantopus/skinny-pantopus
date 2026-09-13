package app.pantopus.android.ui.screens.homes.members

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeInvitationSenderContext
import app.pantopus.android.data.homes.HomeInvitationSenderFailure
import app.pantopus.android.data.homes.HomeInvitationSenderFailureKind
import app.pantopus.android.data.homes.HomeInvitationSenderIntent
import app.pantopus.android.data.homes.HomeInvitationSenderOutcome
import app.pantopus.android.data.homes.HomeInvitationSenderRecovery
import app.pantopus.android.data.homes.HomeInvitationSenderRefusal
import app.pantopus.android.data.homes.PendingHomeInvitationSender
import app.pantopus.android.data.homes.homeInvitationSenderLink
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

data class HomeInvitationSenderTarget(val homeId: String, val action: String = "create", val invitationId: String? = null)

data class HomeInvitationSenderForm(
    val recipient: String = "",
    val message: String = "",
    val username: Boolean = false,
    val role: String = "member",
)

data class HomeInvitationSenderUiState(
    val generation: Long = 0L,
    val accountLabel: String = "",
    val form: HomeInvitationSenderForm = HomeInvitationSenderForm(),
    val working: Boolean = false,
    val context: HomeInvitationSenderContext? = null,
    val pending: PendingHomeInvitationSender? = null,
    val outcome: HomeInvitationSenderOutcome? = null,
    val canPrepare: Boolean = false,
    val canSubmit: Boolean = false,
    val canAcknowledge: Boolean = false,
    val sharingUntilMillis: Long? = null,
    val error: String? = null,
)

@HiltViewModel
class HomeInvitationSenderViewModel
    @Inject
    constructor(
        private val factory: HomeInvitationSenderFactory,
        private val auth: AuthRepository,
    ) : ViewModel() {
        private var lifetime: Job? = null
        private var scope: CoroutineScope? = null
        private var session: HomeClaimSessionScope? = null
        private var coordinator: HomeInvitationSenderCoordinator? = null
        private var generation = 0L
        private var visible = false
        private val _state = MutableStateFlow(HomeInvitationSenderUiState())
        val state = _state.asStateFlow()

        fun pause() {
            generation++
            visible = false
            coordinator?.hide()
            lifetime?.cancel()
            lifetime = null
            scope = null
            _state.value = HomeInvitationSenderUiState(generation = generation)
        }

        fun resume(target: HomeInvitationSenderTarget) {
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
                HomeInvitationSenderUiState(
                    generation = generation, accountLabel = user?.displayName?.takeIf(String::isNotBlank) ?: user?.email.orEmpty(),
                )
            val revision = generation
            scope.launch {
                session.invalidated.collect { invalidated ->
                    if (invalidated && visible && generation == revision) {
                        pause()
                        _state.update {
                            it.copy(
                                error = HomeInvitationSenderFailure(HomeInvitationSenderFailureKind.SessionChanged).message,
                            )
                        }
                    }
                }
            }
            perform {
                coordinator.open()
                if (coordinator.canPrepare && target.action != "create") {
                    coordinator.prepare(HomeInvitationSenderIntent(target.homeId, target.action, invitationId = target.invitationId))
                }
            }
        }

        fun setForm(form: HomeInvitationSenderForm) {
            if (_state.value.canPrepare && !_state.value.working && _state.value.context == null) _state.update { it.copy(form = form) }
        }

        fun edit() {
            if (_state.value.canPrepare) perform { checkNotNull(coordinator).edit() }
        }

        fun prepare(
            intent: HomeInvitationSenderIntent,
            lifetime: Long,
        ) {
            if (!current(lifetime) || !_state.value.canPrepare) return
            perform { checkNotNull(coordinator).prepare(intent) }
        }

        fun submit(
            review: String,
            lifetime: Long,
        ) {
            if (!current(lifetime) || !_state.value.canSubmit || _state.value.context?.decisionToken != review) return
            perform { checkNotNull(coordinator).submit(review) }
        }

        fun recover(
            action: HomeInvitationSenderRecovery,
            requestId: String,
            lifetime: Long,
        ) {
            if (!current(lifetime) || _state.value.pending?.request?.requestId != requestId) return
            perform { checkNotNull(coordinator).recover(action, requestId) }
        }

        fun checkSharing(
            requestId: String,
            lifetime: Long,
        ) {
            if (!current(lifetime) || _state.value.pending?.request?.requestId != requestId) return
            perform { checkNotNull(coordinator).checkSharing(requestId) }
        }

        fun share(
            requestId: String,
            lifetime: Long,
            onShare: (String) -> Unit,
        ) {
            if (!current(lifetime) || _state.value.pending?.request?.requestId != requestId) return
            perform {
                val original = checkNotNull(checkNotNull(coordinator).checkSharing(requestId))
                checkNotNull(session).requireCurrent()
                check(current(lifetime))
                val link = checkNotNull(homeInvitationSenderLink(original, BuildConfig.PANTOPUS_WEB_BASE_URL, completed = true))
                onShare(link)
            }
        }

        fun acknowledge(
            requestId: String,
            done: () -> Unit,
        ) {
            if (!_state.value.canAcknowledge) return
            perform {
                if (checkNotNull(coordinator).acknowledge(requestId) != null) done()
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
                } catch (error: HomeInvitationSenderFailure) {
                    reportFailure(revision, error.message)
                } catch (error: HomeInvitationSenderRefusal) {
                    reportFailure(revision, error.message)
                } catch (_: Exception) {
                    reportFailure(revision, HomeInvitationSenderFailure(HomeInvitationSenderFailureKind.Storage).message)
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
                                sharingUntilMillis = coordinator.sharingUntilMillis,
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
