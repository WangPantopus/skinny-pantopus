@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invoices

import androidx.lifecycle.SavedStateHandle
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * A single event in the invoice lifecycle timeline (invoicedetail-frames.jsx Timeline).
 * Derived from the DTO's `created_at` / `status` / `paid_at` / `due_date`.
 */
data class InvoiceTimelineEvent(
    val label: String,
    val timeLabel: String,
    val isDone: Boolean = true,
)

/** G13 Invoice Detail UI state. */
sealed interface InvoiceDetailUiState {
    data object Loading : InvoiceDetailUiState

    data object ComingSoon : InvoiceDetailUiState

    data class Error(val message: String) : InvoiceDetailUiState

    data class Loaded(
        val reference: String,
        val issuedLabel: String,
        val totalLabel: String,
        val currencyCode: String,
        val recipientLabel: String,
        val shareText: String,
        val lineItems: List<InvoiceLineItem>,
        val unitLabels: Map<Int, String>,
        val lineTotalLabels: Map<Int, String>,
        val pillar: SchedulingPillar,
        /**
         * Invoice lifecycle status (draft/sent/viewed/paid/void/overdue) for the
         * top-bar trailing pill. Null when the row predates the status column.
         */
        val invoiceStatus: String?,
        /**
         * Lifecycle timeline events shown in the "Timeline" section.
         * Always has at least the "Created" event (derived from `created_at`);
         * Sent / Paid / Voided / Due derive from `status`, `paid_at`, `due_date`.
         */
        val timelineEvents: List<InvoiceTimelineEvent>,
        /** Formatted subtotal — breakdown row above Total (null when absent). */
        val subtotalLabel: String?,
        /** Formatted platform fee (deducted from the payout, not added to the total). */
        val feeLabel: String?,
        /** Formatted due date for the payment-terms section (null when none). */
        val dueLabel: String?,
    ) : InvoiceDetailUiState
}

/**
 * G13 Invoice Detail (owner) — Stream A15. Renders `GET /invoices/:id` and the
 * owner "send" action (`POST /invoices/:id/send`). Behind [SchedulingFeatureFlags].
 * Mirrors iOS `InvoiceDetailViewModel` / `invoicedetail-frames.jsx` (memo /
 * payer display name remain DTO gaps and their design sections stay omitted).
 */
@HiltViewModel
class InvoiceDetailViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repo: SchedulingRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
        private val flags: SchedulingFeatureFlags,
    ) : ViewModel() {
        private val invoiceId: String =
            savedStateHandle.get<String>(
                SchedulingRoutes.ARG_INVOICE_ID,
            ).orEmpty()

        private val _state = MutableStateFlow<InvoiceDetailUiState>(InvoiceDetailUiState.Loading)
        val state: StateFlow<InvoiceDetailUiState> = _state.asStateFlow()

        private val _sending = MutableStateFlow(false)
        val sending: StateFlow<Boolean> = _sending.asStateFlow()

        private val _sentToast = MutableStateFlow(false)
        val sentToast: StateFlow<Boolean> = _sentToast.asStateFlow()

        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var shareText: String = ""
        private var started = false

        fun start() {
            if (started) return
            started = true
            owner = resolveOwner()
            load()
        }

        fun load() {
            viewModelScope.launch {
                if (!flags.paidSchedulingEnabled) {
                    _state.value = InvoiceDetailUiState.ComingSoon
                    return@launch
                }
                _state.value = InvoiceDetailUiState.Loading
                when (val result = repo.getInvoice(owner, invoiceId)) {
                    is NetworkResult.Success -> _state.value = build(result.data.invoice)
                    is NetworkResult.Failure ->
                        _state.value =
                            InvoiceDetailUiState.Error(
                                errors.decode(result.error).message(),
                            )
                }
            }
        }

        /** Send the invoice to its recipient (in-app notification; no state mutation). */
        fun send() {
            if (_sending.value) return
            _sending.value = true
            viewModelScope.launch {
                when (repo.sendInvoice(owner, invoiceId)) {
                    is NetworkResult.Success -> {
                        _sending.value = false
                        _sentToast.value = true
                        delay(SENT_TOAST_MS)
                        _sentToast.value = false
                    }
                    is NetworkResult.Failure -> {
                        _sending.value = false
                        _state.value = InvoiceDetailUiState.Error("Couldn't send the invoice.")
                    }
                }
            }
        }

        fun shareText(): String = shareText

        private fun build(invoice: InvoiceDto): InvoiceDetailUiState.Loaded {
            val currency = (invoice.currency ?: "USD").uppercase()
            val total = PackagesMoney.format(invoice.totalCents, invoice.currency)
            val reference = "INV-" + invoiceId.take(REF_PREFIX_LEN).uppercase()
            val lineItems = InvoiceParsing.lineItems(invoice.lineItems)
            val issuedLabel = PackagesFormat.dayString(invoice.createdAt) ?: "—"
            shareText = "$reference · $total"
            return InvoiceDetailUiState.Loaded(
                reference = reference,
                issuedLabel = issuedLabel,
                totalLabel = total,
                currencyCode = currency,
                recipientLabel =
                    invoice.recipientUserId?.let {
                        "Customer · " + it.take(REF_PREFIX_LEN).uppercase()
                    } ?: "Customer",
                shareText = shareText,
                lineItems = lineItems,
                unitLabels =
                    lineItems.indices.associateWith { i ->
                        unitLabel(
                            lineItems[i],
                            invoice.currency,
                        )
                    },
                lineTotalLabels =
                    lineItems.indices.associateWith { i ->
                        lineTotalLabel(
                            lineItems[i],
                            invoice.currency,
                        )
                    },
                pillar = owner.pillar(),
                invoiceStatus = invoice.status,
                timelineEvents = timeline(invoice, issuedLabel),
                subtotalLabel = invoice.subtotalCents?.let { PackagesMoney.format(it, invoice.currency) },
                feeLabel = invoice.feeCents?.takeIf { it > 0 }?.let { PackagesMoney.format(it, invoice.currency) },
                dueLabel = PackagesFormat.dayString(invoice.dueDate),
            )
        }

        /**
         * Lifecycle timeline from the DTO's `created_at` / `status` / `paid_at` /
         * `due_date`. "Created" is always present; "Sent" appears once the invoice
         * left draft (the row carries no sent_at, so its time column is em-dash);
         * then exactly one of Paid (with `paid_at`), Voided, or a pending "Due".
         */
        private fun timeline(
            invoice: InvoiceDto,
            issuedLabel: String,
        ): List<InvoiceTimelineEvent> {
            val status = invoice.status?.lowercase()
            val events = mutableListOf(InvoiceTimelineEvent(label = "Created", timeLabel = issuedLabel, isDone = true))
            if (status != null && status in SENT_STATUSES) {
                events += InvoiceTimelineEvent(label = "Sent", timeLabel = "—", isDone = true)
            }
            val dueLabel = PackagesFormat.dayString(invoice.dueDate)
            when {
                status == STATUS_PAID || invoice.paidAt != null ->
                    events +=
                        InvoiceTimelineEvent(
                            label = "Paid",
                            timeLabel = PackagesFormat.dayString(invoice.paidAt) ?: "—",
                            isDone = true,
                        )
                status == STATUS_VOID ->
                    events += InvoiceTimelineEvent(label = "Voided", timeLabel = "—", isDone = true)
                dueLabel != null ->
                    events += InvoiceTimelineEvent(label = "Due", timeLabel = dueLabel, isDone = false)
            }
            return events
        }

        private fun unitLabel(
            item: InvoiceLineItem,
            currency: String?,
        ): String = item.unitCents?.let { PackagesMoney.format(it, currency) } ?: "—"

        private fun lineTotalLabel(
            item: InvoiceLineItem,
            currency: String?,
        ): String = item.totalCents?.let { PackagesMoney.format(it, currency) } ?: "—"

        private fun resolveOwner(): SchedulingOwner =
            (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id
                ?.let { SchedulingOwner.Business(it) }
                ?: SchedulingOwner.Personal

        private fun SchedulingError.message(): String =
            when (this) {
                is SchedulingError.Secret -> "Only the business owner can view this invoice."
                is SchedulingError.Generic -> message
                else -> "Couldn't load that invoice."
            }

        private companion object {
            const val SENT_TOAST_MS = 1800L
            const val REF_PREFIX_LEN = 6
            const val STATUS_PAID = "paid"
            const val STATUS_VOID = "void"

            /** Statuses that imply the invoice has been sent to its recipient. */
            val SENT_STATUSES = setOf("sent", "viewed", "paid", "overdue")
        }
    }
