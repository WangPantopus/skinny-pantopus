@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invoices

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.InvoiceDto
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
import app.pantopus.android.ui.screens.scheduling.packages.PackagesFormat
import app.pantopus.android.ui.screens.scheduling.packages.PackagesMoney
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.YearMonth
import java.time.ZoneId
import javax.inject.Inject

/**
 * Status filter chips (`invoiceslist-frames.jsx` `FilterChips`). Each chip
 * filters the list on the DTO's `status` (BusinessInvoice lifecycle:
 * draft/sent/viewed/paid/void/overdue); `Sent` also covers `viewed`.
 */
enum class InvoiceFilter(val label: String) {
    All("All"),
    Paid("Paid"),
    Sent("Sent"),
    Overdue("Overdue"),
    Refunded("Refunded"),
    ;

    /** True when an invoice with [status] belongs under this chip. */
    fun matches(status: String?): Boolean {
        val normalized = status?.lowercase()
        return when (this) {
            All -> true
            Paid -> normalized == "paid"
            Sent -> normalized == "sent" || normalized == "viewed"
            Overdue -> normalized == "overdue"
            Refunded -> normalized == "refunded"
        }
    }
}

/** G12 Invoices List UI state. */
sealed interface InvoicesListUiState {
    data object Loading : InvoicesListUiState

    data object ComingSoon : InvoicesListUiState

    /** Stripe not connected → "Connect payments to invoice" gate. */
    data object Gate : InvoicesListUiState

    data object Empty : InvoicesListUiState

    data class Error(val message: String) : InvoicesListUiState

    data class Loaded(
        /** Day-grouped invoices, narrowed to the active [InvoiceFilter] chip. */
        val sections: List<InvoiceDaySection>,
        /** Formatted outstanding (not paid / not void) amount — "Outstanding" KPI left column. */
        val outstandingLabel: String,
        /** Formatted collected-this-calendar-month amount — "Collected · month" KPI right column. */
        val collectedMonthLabel: String,
        /**
         * True when at least one invoice's `status` is overdue — drives the amber
         * tint on the "Outstanding" label + value.
         */
        val hasOverdue: Boolean,
        val pillar: SchedulingPillar,
    ) : InvoicesListUiState
}

/**
 * G12 Invoices List (owner, business-only) — Stream A15. Lists `GET /invoices`
 * grouped by created day, with the Stripe-not-connected gate from
 * `GET /payments/status`. Behind [SchedulingFeatureFlags]. Matches
 * `invoiceslist-frames.jsx`: status pills, working status filter chips, and a
 * real Outstanding / Collected · month KPI split from `status` / `paid_at`.
 */
@HiltViewModel
class InvoicesListViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
        private val flags: SchedulingFeatureFlags,
    ) : ViewModel() {
        private val _state = MutableStateFlow<InvoicesListUiState>(InvoicesListUiState.Loading)
        val state: StateFlow<InvoicesListUiState> = _state.asStateFlow()

        private val _filter = MutableStateFlow(InvoiceFilter.All)
        val filter: StateFlow<InvoiceFilter> = _filter.asStateFlow()

        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var started = false

        /** Last successful fetch — the unfiltered list the KPIs are computed over. */
        private var invoices: List<InvoiceDto> = emptyList()

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
            viewModelScope.launch {
                if (!flags.paidSchedulingEnabled) {
                    _state.value = InvoicesListUiState.ComingSoon
                    return@launch
                }
                _state.value = InvoicesListUiState.Loading
                val status = (repo.getPaymentsStatus(owner) as? NetworkResult.Success)?.data
                val connected = status?.connected ?: false
                val applicable = status?.applicable ?: true
                when (val result = repo.getInvoices(owner)) {
                    is NetworkResult.Success -> {
                        invoices = result.data.invoices
                        _state.value =
                            when {
                                invoices.isNotEmpty() -> loadedState()
                                applicable && !connected -> InvoicesListUiState.Gate
                                else -> InvoicesListUiState.Empty
                            }
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            InvoicesListUiState.Error(
                                errors.decode(result.error).message(),
                            )
                }
            }
        }

        fun refresh() = load()

        fun selectFilter(target: InvoiceFilter) {
            _filter.value = target
            if (_state.value is InvoicesListUiState.Loaded) {
                _state.value = loadedState()
            }
        }

        /**
         * Loaded state from the cached fetch: sections narrowed to the active
         * filter chip, KPIs always computed over the full list. Outstanding =
         * everything not yet settled (`status` not paid/void); Collected · month =
         * invoices whose `paid_at` falls in the current calendar month (device
         * zone); overdue drives the amber summary tint.
         */
        private fun loadedState(): InvoicesListUiState.Loaded {
            val currency = invoices.firstOrNull()?.currency
            val active = _filter.value
            return InvoicesListUiState.Loaded(
                sections = InvoiceGrouping.byDay(invoices.filter { active.matches(it.status) }),
                outstandingLabel =
                    PackagesMoney.format(
                        invoices.filterNot { isSettled(it.status) }.sumOf { it.totalCents ?: 0 },
                        currency,
                    ),
                collectedMonthLabel =
                    PackagesMoney.format(
                        invoices.filter { paidThisMonth(it) }.sumOf { it.totalCents ?: 0 },
                        currency,
                    ),
                hasOverdue = invoices.any { it.status?.lowercase() == STATUS_OVERDUE },
                pillar = owner.pillar(),
            )
        }

        /** True when the invoice's `paid_at` falls inside the current calendar month. */
        private fun paidThisMonth(invoice: InvoiceDto): Boolean {
            val paidAt = PackagesFormat.instant(invoice.paidAt) ?: return false
            val zone = ZoneId.systemDefault()
            return YearMonth.from(paidAt.atZone(zone)) == YearMonth.now(zone)
        }

        /** Settled (paid or void) invoices drop out of the Outstanding KPI. */
        private fun isSettled(status: String?): Boolean {
            val normalized = status?.lowercase() ?: return false
            return normalized in SETTLED_STATUSES
        }

        fun invoiceRoute(invoiceId: String): String = SchedulingRoutes.invoiceDetail(invoiceId)

        fun connectRoute(): String = SchedulingRoutes.PAYMENTS_SETUP

        // ─── Row formatting ─────────────────────────────────────────────────────

        fun amount(invoice: InvoiceDto): String = PackagesMoney.format(invoice.totalCents, invoice.currency)

        /** Short monospace reference from the invoice id (no invoice_number in DTO). */
        fun reference(invoice: InvoiceDto): String = "INV-" + invoice.id.take(REF_PREFIX_LEN).uppercase()

        /** Service sub-label — first parsed line item, else "Service". */
        fun service(invoice: InvoiceDto): String = InvoiceParsing.lineItems(invoice.lineItems).firstOrNull()?.label ?: "Service"

        /** Two-letter payer initials (no payer display name in the DTO). */
        fun payerInitials(invoice: InvoiceDto): String {
            val token = (invoice.recipientUserId ?: invoice.id).filter { it.isLetter() }.take(INITIALS_LEN).uppercase()
            return token.ifEmpty { "IN" }
        }

        private fun resolveOwner(): SchedulingOwner =
            (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id
                ?.let { SchedulingOwner.Business(it) }
                ?: SchedulingOwner.Personal

        private fun SchedulingError.message(): String =
            when (this) {
                is SchedulingError.Secret -> "Only the business owner can view invoices."
                is SchedulingError.Generic -> message
                else -> "Couldn't load invoices."
            }

        private companion object {
            const val REF_PREFIX_LEN = 6
            const val INITIALS_LEN = 2
            const val STATUS_OVERDUE = "overdue"

            /** Statuses excluded from the Outstanding KPI (settled or written off). */
            val SETTLED_STATUSES = setOf("paid", "void")
        }
    }
