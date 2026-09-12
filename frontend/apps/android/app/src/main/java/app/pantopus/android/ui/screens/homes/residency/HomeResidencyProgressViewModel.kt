package app.pantopus.android.ui.screens.homes.residency

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyProgress
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeResidencyProgressRepository
import app.pantopus.android.data.homes.homeTaskUUID
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

const val HOME_RESIDENCY_HOME_ID_KEY = "residencyHomeId"

enum class HomeResidencyNavigation { Home, Mail, Ownership, AddHome }

data class HomeResidencyProgressUiState(
    val loading: Boolean = true,
    val progress: PersonalHomeResidencyProgress? = null,
    val error: String? = null,
)

@HiltViewModel
class HomeResidencyProgressViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repository: HomeResidencyProgressRepository,
        sessions: HomeClaimSessionScopeFactory,
    ) : ViewModel() {
        val homeId = savedStateHandle.get<String>(HOME_RESIDENCY_HOME_ID_KEY).orEmpty().lowercase()
        private val session = sessions.create(viewModelScope)
        private var generation = 0L
        private var visible = false
        private var job: Job? = null
        private val _state = MutableStateFlow(HomeResidencyProgressUiState())
        val state = _state.asStateFlow()

        init {
            viewModelScope.launch {
                session.invalidated.collect { if (it) retireSession() }
            }
        }

        fun suspendContent() {
            generation++
            visible = false
            job?.cancel()
            job = null
            _state.value = HomeResidencyProgressUiState()
        }

        private fun retireSession() {
            suspendContent()
            _state.value =
                HomeResidencyProgressUiState(
                    loading = false, error = "Your session changed. Reopen residency status to continue.",
                )
        }

        fun refresh() {
            suspendContent()
            visible = true
            val revision = generation
            job =
                viewModelScope.launch {
                    try {
                        session.requireCurrent()
                        check(homeTaskUUID(homeId))
                        val result = repository.progress(homeId)
                        session.requireCurrent()
                        if (!current(revision)) return@launch
                        _state.value =
                            when (result) {
                                is NetworkResult.Success -> HomeResidencyProgressUiState(loading = false, progress = result.data)
                                is NetworkResult.Failure ->
                                    HomeResidencyProgressUiState(
                                        loading = false, error = "Your residency status could not be checked. Please retry.",
                                    )
                            }
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (_: IllegalStateException) {
                        if (visible && revision == generation) {
                            _state.value =
                                HomeResidencyProgressUiState(
                                    loading = false,
                                    error =
                                        if (session.isCurrent) {
                                            "Your residency status could not be checked. Please retry."
                                        } else {
                                            "Your session changed. Reopen residency status to continue."
                                        },
                                )
                        }
                    }
                }
        }

        private fun current(revision: Long): Boolean = visible && revision == generation && session.isCurrent

        fun permits(destination: HomeResidencyNavigation): Boolean {
            if (!current(generation) || _state.value.loading) return false
            val progress = _state.value.progress ?: return false
            return when (destination) {
                HomeResidencyNavigation.Home -> progress.nextStep == "home" && progress.currentAccess == "shared"
                HomeResidencyNavigation.Mail -> progress.nextStep == "address_verification"
                HomeResidencyNavigation.Ownership -> progress.nextStep == "ownership_verification"
                HomeResidencyNavigation.AddHome -> progress.nextStep == "resubmit"
            }
        }
    }
