@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.packages

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.PackageCreditDto
import app.pantopus.android.data.api.models.scheduling.PackageDto
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
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Payment progress for the G10 Pay CTA. */
sealed interface PayState {
    data object Idle : PayState

    data object Paying : PayState

    data object Paid : PayState

    data class Declined(val message: String) : PayState
}

/** G10 Buy Package UI state. */
sealed interface BuyPackageUiState {
    data object Loading : BuyPackageUiState

    data object ComingSoon : BuyPackageUiState

    data class Error(val message: String) : BuyPackageUiState

    data class Ready(
        val pkg: PackageDto?,
        val existingCredit: PackageCreditDto?,
        val isGuest: Boolean,
        val pillar: SchedulingPillar,
        val payState: PayState,
    ) : BuyPackageUiState {
        val totalLabel: String get() = PackagesMoney.format(pkg?.priceCents, pkg?.currency)
        val perSessionLabel: String get() =
            PackagesMoney.perSession(
                pkg?.priceCents,
                pkg?.sessionsCount,
                pkg?.currency,
            )
        val isPriced: Boolean get() = (pkg?.priceCents ?: 0) > 0

        val payButtonLabel: String
            get() =
                when {
                    payState is PayState.Declined -> "Try payment again"
                    isPriced -> "Pay $totalLabel"
                    else -> "Get package"
                }
    }
}

/**
 * G10 Buy Package (customer) — Stream A15. Checkout for a session package:
 * `POST /packages/:id/buy` creates the credit and returns a Stripe
 * `clientSecret` when priced (>0). We present the shared Stripe PaymentSheet
 * (card + SCA + declined) and never mark paid client-side. Behind
 * [SchedulingFeatureFlags] + Stripe TEST mode. Mirrors iOS `BuyPackageViewModel`
 * / `buypackage-frames.jsx` (logged-in / declined / already-owns-credits upsell).
 *
 * Data note: there is no public "get package by id" endpoint (`GET /packages`
 * is owner-gated), so the summary is best-effort via the owner-scoped list — it
 * resolves for an owner-context viewer; a true third-party buyer reaches this
 * screen from the public booking page (A5) carrying richer context.
 */
@HiltViewModel
class BuyPackageViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repo: SchedulingRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
        private val flags: SchedulingFeatureFlags,
        private val ownerRelay: PackagesOwnerRelay,
    ) : ViewModel() {
        private val packageId: String =
            savedStateHandle.get<String>(
                SchedulingRoutes.ARG_PACKAGE_ID,
            ).orEmpty()

        private val _state = MutableStateFlow<BuyPackageUiState>(BuyPackageUiState.Loading)
        val state: StateFlow<BuyPackageUiState> = _state.asStateFlow()

        /** One-shot: a Stripe client secret the screen should present, then clear. */
        private val _presentSecret = MutableStateFlow<String?>(null)
        val presentSecret: StateFlow<String?> = _presentSecret.asStateFlow()

        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var pkg: PackageDto? = null
        private var existingCredit: PackageCreditDto? = null
        private var isGuest = false
        private var payState: PayState = PayState.Idle
        private var started = false

        fun start() {
            if (started) return
            started = true
            owner = ownerRelay.consume() ?: resolveOwner()
            load()
        }

        fun load() {
            viewModelScope.launch {
                if (!flags.paidSchedulingEnabled) {
                    _state.value = BuyPackageUiState.ComingSoon
                    return@launch
                }
                _state.value = BuyPackageUiState.Loading
                isGuest = auth.state.value !is AuthRepository.State.SignedIn
                // Best-effort package summary (owner-scoped list).
                pkg =
                    (
                        repo.getPackages(
                            owner,
                        ) as? NetworkResult.Success
                    )?.data?.packages?.firstOrNull {
                        it.id == packageId
                    }
                // Detect an existing credit on this package for the upsell.
                existingCredit =
                    (repo.getMyPackages() as? NetworkResult.Success)?.data?.credits
                        ?.firstOrNull { it.packageId == packageId && (it.remaining ?: 0) > 0 }
                payState = PayState.Idle
                pushReady()
            }
        }

        // ─── Purchase ────────────────────────────────────────────────────────────

        fun pay() {
            payState = PayState.Paying
            pushReady()
            viewModelScope.launch {
                when (val result = repo.buyPackage(owner, packageId)) {
                    is NetworkResult.Success -> {
                        val secret = result.data.clientSecret
                        if (secret.isNullOrEmpty()) {
                            // Free package — credit granted, no charge.
                            payState = PayState.Paid
                            pushReady()
                        } else {
                            // Priced — stay in Paying and ask the screen to present Stripe.
                            _presentSecret.value = secret
                        }
                    }
                    is NetworkResult.Failure -> {
                        payState = PayState.Declined(errors.decode(result.error).declineMessage())
                        pushReady()
                    }
                }
            }
        }

        /** Result reported back from the Stripe PaymentSheet (mapped in the screen). */
        fun onPaymentResult(outcome: CheckoutOutcome) {
            payState =
                when (outcome) {
                    is CheckoutOutcome.Paid -> PayState.Paid
                    is CheckoutOutcome.Canceled -> PayState.Idle
                    is CheckoutOutcome.Declined ->
                        PayState.Declined(
                            outcome.message ?: "That payment didn't go through. Try another card.",
                        )
                }
            pushReady()
        }

        fun secretConsumed() {
            _presentSecret.value = null
        }

        /** Upsell action — go manage existing credits instead of buying more. */
        fun myPackagesRoute(): String = SchedulingRoutes.MY_PACKAGES

        // ─── Helpers ───────────────────────────────────────────────────────────────

        private fun pushReady() {
            _state.value =
                BuyPackageUiState.Ready(
                    pkg = pkg,
                    existingCredit = existingCredit,
                    isGuest = isGuest,
                    pillar = owner.pillar(),
                    payState = payState,
                )
        }

        private fun resolveOwner(): SchedulingOwner =
            (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id
                ?.let { SchedulingOwner.Business(it) }
                ?: SchedulingOwner.Personal

        private fun SchedulingError.declineMessage(): String =
            when (this) {
                is SchedulingError.Generic -> message
                else -> "That payment didn't go through. Try another card."
            }
    }
