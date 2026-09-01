@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.packages

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreditPackageMeta
import app.pantopus.android.data.api.models.scheduling.PackageCreditDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** G11 My Packages / Credits UI state. */
sealed interface MyPackagesUiState {
    data object Loading : MyPackagesUiState

    data object ComingSoon : MyPackagesUiState

    data object Empty : MyPackagesUiState

    data class Error(val message: String) : MyPackagesUiState

    data class Loaded(val credits: List<PackageCreditDto>) : MyPackagesUiState
}

/**
 * G11 My Packages / Credits (customer) — Stream A15. The buyer-side counterpart
 * to the owner packages list: `GET /my-packages` credits, each showing
 * remaining sessions, with "book with a credit" (→ apply-credit sheet) and
 * "buy again". Behind [SchedulingFeatureFlags]. Mirrors iOS
 * `MyPackagesViewModel` / `mypackages-frames.jsx`.
 *
 * Data note: `my-packages` credits expose remaining + nested package meta
 * (name, sessions_count, owner) only — there's no expiry date, owner display
 * name, or redemption history in the contract, so the design's expiry banners +
 * history rows aren't rendered (flagged for a backend follow-up).
 */
@HiltViewModel
class MyPackagesViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        private val flags: SchedulingFeatureFlags,
        private val ownerRelay: PackagesOwnerRelay,
    ) : ViewModel() {
        private val _state = MutableStateFlow<MyPackagesUiState>(MyPackagesUiState.Loading)
        val state: StateFlow<MyPackagesUiState> = _state.asStateFlow()

        /** The credit currently driving the "use a credit" sheet (null = hidden). */
        private val _creditForUse = MutableStateFlow<PackageCreditDto?>(null)
        val creditForUse: StateFlow<PackageCreditDto?> = _creditForUse.asStateFlow()

        private var started = false

        fun start() {
            if (started) {
                refresh()
            } else {
                started = true
                load()
            }
        }

        fun load() {
            viewModelScope.launch {
                if (!flags.paidSchedulingEnabled) {
                    _state.value = MyPackagesUiState.ComingSoon
                    return@launch
                }
                _state.value = MyPackagesUiState.Loading
                when (val result = repo.getMyPackages()) {
                    is NetworkResult.Success -> {
                        val credits = result.data.credits
                        _state.value =
                            if (credits.isEmpty()) {
                                MyPackagesUiState.Empty
                            } else {
                                MyPackagesUiState.Loaded(
                                    credits,
                                )
                            }
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            MyPackagesUiState.Error(
                                errors.decode(result.error).message(),
                            )
                }
            }
        }

        fun refresh() = load()

        // ─── Actions ─────────────────────────────────────────────────────────────

        fun useCredit(credit: PackageCreditDto) {
            _creditForUse.value = credit
        }

        fun dismissUseCredit() {
            _creditForUse.value = null
        }

        /** Called when the apply-credit sheet succeeds — reload for the new count. */
        fun creditApplied() {
            _creditForUse.value = null
            load()
        }

        fun browseRoute(): String = SchedulingRoutes.MY_BOOKINGS

        fun buyAgainRoute(credit: PackageCreditDto): String? {
            val packageId = credit.packageId ?: return null
            ownerRelay.pending = ownerFor(credit.bookingPackage)
            return SchedulingRoutes.buyPackage(packageId)
        }

        private fun ownerFor(meta: CreditPackageMeta?): SchedulingOwner {
            val id = meta?.ownerId ?: return SchedulingOwner.Personal
            return when (meta.ownerType?.lowercase()) {
                "business" -> SchedulingOwner.Business(id)
                "home" -> SchedulingOwner.Home(id)
                else -> SchedulingOwner.Personal
            }
        }

        private fun SchedulingError.message(): String =
            when (this) {
                is SchedulingError.Generic -> message
                else -> "Couldn't load your packages."
            }
    }
