@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.packages

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.PackageDto
import app.pantopus.android.data.api.models.scheduling.UpdatePackageRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Active / Archived filter for the owner packages list (G8). */
enum class PackageFilter { Active, Archived }

/** G8 Packages List UI state. */
sealed interface PackagesListUiState {
    data object Loading : PackagesListUiState

    /** Paid scheduling flag is off → calm "coming soon" gate. */
    data object ComingSoon : PackagesListUiState

    data class Error(val message: String) : PackagesListUiState

    data class Loaded(
        val pillar: SchedulingPillar,
        val active: List<PackageDto>,
        val archived: List<PackageDto>,
        val paymentsConnected: Boolean,
        val paymentsApplicable: Boolean,
    ) : PackagesListUiState {
        /** Owner has no live packages AND hasn't connected payouts yet (frame 3). */
        val showsPayoutsGate: Boolean get() = active.isEmpty() && paymentsApplicable && !paymentsConnected
    }
}

/**
 * G8 Packages List (owner) — Stream A15. Lists the owner's session packages
 * (`GET /packages`), split Active / Archived (soft-delete = `is_active=false`),
 * with the Stripe-not-connected payouts gate driven by `GET /payments/status`.
 * Behind [SchedulingFeatureFlags] (paid flag + Stripe TEST mode). Mirrors iOS
 * `PackagesListViewModel` and `packageslist-frames.jsx` (active / empty /
 * payouts-gate / archived / loading).
 */
@HiltViewModel
class PackagesListViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
        private val flags: SchedulingFeatureFlags,
        private val ownerRelay: PackagesOwnerRelay,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PackagesListUiState>(PackagesListUiState.Loading)
        val state: StateFlow<PackagesListUiState> = _state.asStateFlow()

        private val _filter = MutableStateFlow(PackageFilter.Active)
        val filter: StateFlow<PackageFilter> = _filter.asStateFlow()

        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var started = false
        private var fetchJob: Job? = null

        fun start() {
            if (started) {
                refresh()
            } else {
                started = true
                owner = resolveOwner()
                load()
            }
        }

        fun load() {
            fetchJob?.cancel()
            fetchJob =
                viewModelScope.launch {
                    _state.value = PackagesListUiState.Loading
                    fetch()
                }
        }

        fun refresh() {
            fetchJob?.cancel()
            fetchJob = viewModelScope.launch { fetch() }
        }

        fun selectFilter(target: PackageFilter) {
            _filter.value = target
        }

        private suspend fun fetch() {
            if (!flags.paidSchedulingEnabled) {
                _state.value = PackagesListUiState.ComingSoon
                return
            }
            when (val result = repo.getPackages(owner)) {
                is NetworkResult.Success -> {
                    val all = result.data.packages
                    // Payments status is best-effort — a failure shouldn't blank the list.
                    val status = (repo.getPaymentsStatus(owner) as? NetworkResult.Success)?.data
                    _state.value =
                        PackagesListUiState.Loaded(
                            pillar = owner.pillar(),
                            active = all.filter { it.isActive != false },
                            archived = all.filter { it.isActive == false },
                            paymentsConnected = status?.connected ?: false,
                            paymentsApplicable = status?.applicable ?: true,
                        )
                }
                is NetworkResult.Failure ->
                    _state.value =
                        PackagesListUiState.Error(
                            errors.decode(result.error).listMessage(),
                        )
            }
        }

        // ─── Mutations ──────────────────────────────────────────────────────────

        /** Soft-delete (archive) a live package — `DELETE /packages/:id`. */
        fun archive(packageId: String) {
            viewModelScope.launch {
                when (repo.deletePackage(owner, packageId)) {
                    is NetworkResult.Success -> fetch()
                    is NetworkResult.Failure ->
                        _state.value =
                            PackagesListUiState.Error(
                                "Couldn't archive that package.",
                            )
                }
            }
        }

        /** Restore an archived package — `PUT /packages/:id { is_active:true }`. */
        fun restore(packageId: String) {
            viewModelScope.launch {
                when (repo.updatePackage(owner, packageId, UpdatePackageRequest(isActive = true))) {
                    is NetworkResult.Success -> fetch()
                    is NetworkResult.Failure ->
                        _state.value =
                            PackagesListUiState.Error(
                                "Couldn't restore that package.",
                            )
                }
            }
        }

        // ─── Navigation routes ──────────────────────────────────────────────────

        fun createRoute(): String {
            ownerRelay.pending = owner
            return SchedulingRoutes.packageEditor(NEW_PACKAGE_ID)
        }

        fun editorRoute(packageId: String): String {
            ownerRelay.pending = owner
            return SchedulingRoutes.packageEditor(packageId)
        }

        fun connectRoute(): String = SchedulingRoutes.PAYMENTS_SETUP

        private fun resolveOwner(): SchedulingOwner =
            (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id
                ?.let { SchedulingOwner.Business(it) }
                ?: SchedulingOwner.Personal

        private fun SchedulingError.listMessage(): String =
            when (this) {
                is SchedulingError.Secret -> "Only the owner can manage packages."
                is SchedulingError.Generic -> message
                else -> "Couldn't load your packages."
            }

        companion object {
            const val NEW_PACKAGE_ID = "new"
        }
    }
