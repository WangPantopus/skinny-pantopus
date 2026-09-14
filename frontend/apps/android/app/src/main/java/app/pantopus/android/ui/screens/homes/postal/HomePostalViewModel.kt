package app.pantopus.android.ui.screens.homes.postal

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeResidencyAddressSnapshot
import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyProgress
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomePostalKind
import app.pantopus.android.data.homes.HomePostalOutcome
import app.pantopus.android.data.homes.HomePostalStatus
import app.pantopus.android.data.homes.HomeResidencyProgressRepository
import app.pantopus.android.data.homes.PendingHomePostalCommand
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class HomePostalNavigation { Home, Residency, Ownership, AddHome }

enum class HomePostalAddressField { Line1, Line2, City, State, Zip, Country }

data class HomePostalAddressForm(
    val line1: String = "",
    val line2: String = "",
    val city: String = "",
    val state: String = "",
    val zip: String = "",
    val country: String = "US",
) {
    val snapshot: HomeResidencyAddressSnapshot get() = HomeResidencyAddressSnapshot(line1, line2, city, state, zip, country)

    fun changing(
        field: HomePostalAddressField,
        value: String,
    ): HomePostalAddressForm =
        when (field) {
            HomePostalAddressField.Line1 -> copy(line1 = value)
            HomePostalAddressField.Line2 -> copy(line2 = value)
            HomePostalAddressField.City -> copy(city = value)
            HomePostalAddressField.State -> copy(state = value)
            HomePostalAddressField.Zip -> copy(zip = value)
            HomePostalAddressField.Country -> copy(country = value)
        }
}

data class HomePostalUiState(
    val working: Boolean = false,
    val opened: Boolean = false,
    val status: HomePostalStatus? = null,
    val progress: PersonalHomeResidencyProgress? = null,
    val pending: PendingHomePostalCommand? = null,
    val outcome: HomePostalOutcome? = null,
    val storageFailed: Boolean = false,
    val error: String? = null,
    val address: HomePostalAddressForm = HomePostalAddressForm(),
    val codeInput: String = "",
    val confirmsMail: Boolean = false,
    val confirmsCancellation: Boolean = false,
)

@HiltViewModel
class HomePostalViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val factory: HomePostalFactory,
        private val residency: HomeResidencyProgressRepository,
        sessions: HomeClaimSessionScopeFactory,
    ) : ViewModel() {
        val homeId = savedStateHandle.get<String>("homeId").orEmpty().lowercase()
        private val session = sessions.create(viewModelScope)
        private val coordinator = factory.create(session, homeId)
        private var generation = 0L
        private var visible = false
        private var job: Job? = null
        private val _state = MutableStateFlow(HomePostalUiState())
        val state = _state.asStateFlow()
        val originalMailAddress: HomeResidencyAddressSnapshot? get() =
            _state.value.pending?.takeIf { it.kind == HomePostalKind.Mail }?.let { factory.codec.mailing(it).address }

        init {
            viewModelScope.launch {
                session.invalidated.collect { if (it) suspendContent() }
            }
        }

        val canAcknowledge: Boolean get() =
            current(generation) && !_state.value.working &&
                _state.value.pending?.outcome?.isTerminal == true && !_state.value.storageFailed
        val canRequestMail: Boolean get() = ready && _state.value.status?.canRequest == true && _state.value.address.snapshot.isValid()
        val canResumeMail: Boolean get() = ready && _state.value.status?.canResume == true
        val canVerifyCode: Boolean get() =
            ready && _state.value.status?.canVerify == true &&
                _state.value.codeInput.matches(Regex("^[a-zA-Z0-9]{6,8}$"))
        private val ready: Boolean get() =
            current(generation) && _state.value.opened && !_state.value.working &&
                _state.value.pending == null && !_state.value.storageFailed && _state.value.status != null && _state.value.progress != null

        fun suspendContent() {
            generation++
            visible = false
            job?.cancel()
            job = null
            coordinator.hide()
            _state.value = HomePostalUiState()
        }

        fun open() {
            if (_state.value.working) return
            visible = true
            _state.update { it.copy(status = null, progress = null) }
            perform { revision ->
                coordinator.restore()
                publishOriginal(revision)
                _state.update { it.copy(opened = true) }
                if (coordinator.pending != null) coordinator.resolve(HomePostalAction.Check) else loadCurrent(revision)
            }
        }

        fun updateAddress(
            field: HomePostalAddressField,
            value: String,
        ) {
            if (ready && _state.value.status?.canRequest == true) _state.update { it.copy(address = it.address.changing(field, value)) }
        }

        fun updateCode(value: String) {
            if (ready && _state.value.status?.canVerify == true) _state.update { it.copy(codeInput = value) }
        }

        fun reviewMail() {
            if (canRequestMail) _state.update { it.copy(confirmsMail = true) }
        }

        fun dismissConfirmation() {
            _state.update { it.copy(confirmsMail = false, confirmsCancellation = false) }
        }

        fun requestMail() {
            if (!canRequestMail || !_state.value.confirmsMail) return
            val selected = _state.value.address.snapshot
            dismissConfirmation()
            perform { revision ->
                clearCurrent()
                coordinator.prepareMail(selected)
                publishOriginal(revision)
                coordinator.resolve(HomePostalAction.Submit)
            }
        }

        fun resumeMail() {
            if (!canResumeMail) return
            val original = _state.value.status?.request ?: return
            val selected = original.address ?: return
            perform { revision ->
                clearCurrent()
                coordinator.prepareMail(selected, original.command.requestId)
                publishOriginal(revision)
                coordinator.resolve(HomePostalAction.Submit)
            }
        }

        fun verifyCode() {
            if (!canVerifyCode) return
            val postcard = _state.value.status?.postcard ?: return
            val code = _state.value.codeInput
            _state.update { it.copy(codeInput = "") }
            perform { revision ->
                clearCurrent()
                coordinator.prepareCode(code, postcard.id)
                publishOriginal(revision)
                coordinator.resolve(HomePostalAction.Submit)
            }
        }

        fun reviewCancellation() {
            if (current(generation) && !_state.value.working && _state.value.pending != null) {
                _state.update { it.copy(confirmsCancellation = true) }
            }
        }

        fun confirmCancellation() {
            if (!_state.value.confirmsCancellation) return
            dismissConfirmation()
            recover(HomePostalAction.Cancel)
        }

        fun recover(action: HomePostalAction) {
            if (_state.value.pending == null) {
                open()
                return
            }
            perform { coordinator.resolve(action) }
        }

        fun acknowledge() {
            if (!canAcknowledge) return
            perform { revision ->
                val original = coordinator.acknowledge()
                if (original.kind == HomePostalKind.Mail) {
                    val address = factory.codec.mailing(original).address
                    _state.update {
                        it.copy(
                            address =
                                HomePostalAddressForm(
                                    address.line1,
                                    address.line2,
                                    address.city,
                                    address.state,
                                    address.postalCode,
                                    address.country,
                                ),
                        )
                    }
                }
                publishOriginal(revision)
                loadCurrent(revision)
            }
        }

        fun permits(destination: HomePostalNavigation): Boolean {
            if (!ready) return false
            val progress = _state.value.progress ?: return false
            return when (destination) {
                HomePostalNavigation.Home -> progress.nextStep == "home" && progress.currentAccess == "shared"
                HomePostalNavigation.Residency -> true
                HomePostalNavigation.Ownership -> progress.nextStep == "ownership_verification"
                HomePostalNavigation.AddHome -> progress.nextStep == "resubmit"
            }
        }

        private fun current(revision: Long): Boolean = visible && generation == revision && session.isCurrent

        private fun clearCurrent() {
            _state.update { it.copy(status = null, progress = null) }
        }

        private suspend fun loadCurrent(revision: Long) {
            clearCurrent()
            val postal = factory.current(coordinator.scope)
            session.requireCurrent()
            check(current(revision))
            val progress = residency.progress(homeId)
            session.requireCurrent()
            check(current(revision) && progress is NetworkResult.Success)
            _state.update { it.copy(status = postal, progress = progress.data) }
        }

        private fun publishOriginal(revision: Long) {
            if (!current(revision)) return
            _state.update {
                it.copy(
                    pending = coordinator.pending,
                    outcome = coordinator.outcome,
                    storageFailed = coordinator.storageFailed,
                )
            }
        }

        private fun perform(action: suspend (Long) -> Unit) {
            if (!visible || _state.value.working) return
            val revision = generation
            _state.update { it.copy(working = true, error = null) }
            job =
                viewModelScope.launch {
                    try {
                        session.requireCurrent()
                        check(coordinator.scope.isValid())
                        action(revision)
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (_: Exception) {
                        if (visible && revision == generation) {
                            _state.update {
                                it.copy(
                                    error =
                                        HomePostalMessages.recovery(
                                            session.isCurrent, coordinator.storageFailed, coordinator.pending != null,
                                        ),
                                )
                            }
                        }
                    } finally {
                        if (visible && revision == generation) {
                            publishOriginal(revision)
                            _state.update { it.copy(working = false) }
                        }
                    }
                }
        }
    }
