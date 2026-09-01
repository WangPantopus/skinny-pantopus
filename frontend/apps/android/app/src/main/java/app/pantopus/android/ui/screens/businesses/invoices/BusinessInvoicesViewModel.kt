@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.invoices

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessInvoiceDto
import app.pantopus.android.data.api.models.businesses.CreateBusinessInvoiceLineItem
import app.pantopus.android.data.api.models.businesses.CreateBusinessInvoiceRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessFinanceRepository
import app.pantopus.android.data.network.NetworkMonitor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import kotlin.math.roundToInt

/** Nav arg key for the business id consumed via [SavedStateHandle]. */
const val BUSINESS_INVOICES_ID_KEY = "businessId"

/** Status filter chips, mirroring RN's `FILTER_OPTIONS`. */
enum class BusinessInvoiceFilter(
    val label: String,
    /** Value sent as `?status=`; null for "All". */
    val queryValue: String?,
) {
    All("All", null),
    Sent("Sent", "sent"),
    Viewed("Viewed", "viewed"),
    Paid("Paid", "paid"),
    Overdue("Overdue", "overdue"),
    Void("Void", "void"),
}

/** One projected invoice row. */
data class BusinessInvoiceRow(
    val id: String,
    val recipientName: String,
    val createdLabel: String,
    val dueLabel: String?,
    val totalLabel: String,
    val feeLabel: String,
    /** Raw backend status, lower-cased (`sent`, `paid`, `void`, …). */
    val status: String,
    val memo: String?,
    val lineItems: List<LineItem>,
    /** RN only offers Void on `sent / viewed / overdue`. */
    val canVoid: Boolean,
) {
    data class LineItem(
        val id: Int,
        val title: String,
        val amountLabel: String,
    )

    val statusLabel: String get() = status.uppercase(Locale.US)
}

/** Render state for the Invoices screen. */
sealed interface BusinessInvoicesUiState {
    data object Loading : BusinessInvoicesUiState

    data class Loaded(val rows: List<BusinessInvoiceRow>) : BusinessInvoicesUiState

    data object Empty : BusinessInvoicesUiState

    data class Error(val message: String) : BusinessInvoicesUiState
}

/** Post-action banner. */
sealed interface BusinessInvoicesAction {
    data object Idle : BusinessInvoicesAction

    data object Working : BusinessInvoicesAction

    data class Succeeded(val message: String) : BusinessInvoicesAction

    data class Failed(val message: String) : BusinessInvoicesAction
}

/**
 * One editable line item in the create sheet — strings, because the fields
 * are free text until submit.
 */
data class InvoiceLineItemDraft(
    val key: Long,
    val description: String = "",
    /** Dollars as typed, e.g. "125.50". */
    val amount: String = "",
    val quantity: String = "1",
)

/**
 * A10.7 owner surface — "Invoices". Paged list of what this business has
 * billed, plus create and void. The server owns every money field; the
 * client submits unit price × quantity and formats what comes back.
 * Mirrors RN `InvoicesTab.tsx` and iOS `BusinessInvoicesViewModel`.
 */
@HiltViewModel
class BusinessInvoicesViewModel
    @Inject
    constructor(
        private val repository: BusinessFinanceRepository,
        networkMonitor: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val businessId: String = savedStateHandle.get<String>(BUSINESS_INVOICES_ID_KEY).orEmpty()

        private val _state = MutableStateFlow<BusinessInvoicesUiState>(BusinessInvoicesUiState.Loading)
        val state: StateFlow<BusinessInvoicesUiState> = _state.asStateFlow()

        private val _action = MutableStateFlow<BusinessInvoicesAction>(BusinessInvoicesAction.Idle)
        val action: StateFlow<BusinessInvoicesAction> = _action.asStateFlow()

        private val _filter = MutableStateFlow(BusinessInvoiceFilter.All)
        val filter: StateFlow<BusinessInvoiceFilter> = _filter.asStateFlow()

        private val _hasMore = MutableStateFlow(false)
        val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()

        // ─── Create-invoice draft (owned here so the sheet stays dumb) ──
        private val _recipientUserId = MutableStateFlow("")
        val recipientUserId: StateFlow<String> = _recipientUserId.asStateFlow()

        private val _dueDate = MutableStateFlow("")
        val dueDate: StateFlow<String> = _dueDate.asStateFlow()

        private val _memo = MutableStateFlow("")
        val memo: StateFlow<String> = _memo.asStateFlow()

        private val _lineItems = MutableStateFlow(listOf(InvoiceLineItemDraft(key = 0)))
        val lineItems: StateFlow<List<InvoiceLineItemDraft>> = _lineItems.asStateFlow()

        private val _isCreating = MutableStateFlow(false)
        val isCreating: StateFlow<Boolean> = _isCreating.asStateFlow()

        private val _createError = MutableStateFlow<String?>(null)
        val createError: StateFlow<String?> = _createError.asStateFlow()

        val isOnline: StateFlow<Boolean> = networkMonitor.isOnline

        private var page = 1
        private var rows = mutableListOf<BusinessInvoiceRow>()
        private var isLoadingPage = false
        private var nextLineItemKey = 1L

        fun load() {
            viewModelScope.launch {
                page = 1
                rows = mutableListOf()
                _hasMore.value = false
                _state.value = BusinessInvoicesUiState.Loading
                fetchPage()
            }
        }

        fun refresh() {
            viewModelScope.launch {
                page = 1
                rows = mutableListOf()
                _hasMore.value = false
                fetchPage()
            }
        }

        fun setFilter(next: BusinessInvoiceFilter) {
            if (_filter.value == next) return
            _filter.value = next
            load()
        }

        /** Called from the list's last row. */
        fun loadMoreIfNeeded() {
            if (!_hasMore.value || isLoadingPage) return
            viewModelScope.launch {
                page += 1
                fetchPage()
            }
        }

        private suspend fun fetchPage() {
            isLoadingPage = true
            val result =
                repository.invoices(
                    businessId = businessId,
                    page = page,
                    pageSize = PAGE_SIZE,
                    status = _filter.value.queryValue,
                )
            isLoadingPage = false
            when (result) {
                is NetworkResult.Success -> {
                    val mapped = result.data.invoices.map(::rowFrom)
                    rows.addAll(mapped)
                    val total = result.data.pagination?.total ?: rows.size
                    _hasMore.value = rows.size < total && mapped.isNotEmpty()
                    _state.value =
                        if (rows.isEmpty()) {
                            BusinessInvoicesUiState.Empty
                        } else {
                            BusinessInvoicesUiState.Loaded(rows.toList())
                        }
                }
                is NetworkResult.Failure -> {
                    // A failed *subsequent* page must not wipe what's on screen.
                    if (rows.isEmpty()) {
                        _state.value = BusinessInvoicesUiState.Error(result.error.message)
                    } else {
                        page = maxOf(1, page - 1)
                        _action.value = BusinessInvoicesAction.Failed("Couldn't load more invoices.")
                    }
                }
            }
        }

        // ─── Void ─────────────────────────────────────────────────────

        /**
         * `PATCH …/invoices/{id} { status: void }`. The confirm dialog lives
         * in the screen (RN: "Void Invoice · Are you sure? This cannot be
         * undone.").
         */
        fun voidInvoice(invoiceId: String) {
            viewModelScope.launch {
                _action.value = BusinessInvoicesAction.Working
                when (val result = repository.voidInvoice(businessId, invoiceId)) {
                    is NetworkResult.Success -> {
                        _action.value = BusinessInvoicesAction.Succeeded("Invoice voided.")
                        refresh()
                    }
                    is NetworkResult.Failure ->
                        _action.value = BusinessInvoicesAction.Failed(result.error.message)
                }
            }
        }

        // ─── Create ───────────────────────────────────────────────────

        fun setRecipientUserId(value: String) {
            _recipientUserId.value = value
        }

        fun setDueDate(value: String) {
            _dueDate.value = value
        }

        fun setMemo(value: String) {
            _memo.value = value
        }

        fun updateLineItem(
            key: Long,
            description: String? = null,
            amount: String? = null,
            quantity: String? = null,
        ) {
            _lineItems.value =
                _lineItems.value.map { item ->
                    if (item.key != key) {
                        item
                    } else {
                        item.copy(
                            description = description ?: item.description,
                            amount = amount ?: item.amount,
                            quantity = quantity ?: item.quantity,
                        )
                    }
                }
        }

        fun addLineItem() {
            _lineItems.value = _lineItems.value + InvoiceLineItemDraft(key = nextLineItemKey++)
        }

        fun removeLineItem(key: Long) {
            if (_lineItems.value.size <= 1) return
            _lineItems.value = _lineItems.value.filterNot { it.key == key }
        }

        fun resetDraft() {
            _recipientUserId.value = ""
            _dueDate.value = ""
            _memo.value = ""
            _lineItems.value = listOf(InvoiceLineItemDraft(key = nextLineItemKey++))
            _createError.value = null
        }

        /**
         * Validate + `POST …/invoices`. [onSent] fires only when the invoice
         * actually went out, so the sheet dismisses on success alone. Copy
         * mirrors RN's alerts.
         */
        fun createInvoice(onSent: () -> Unit) {
            viewModelScope.launch {
                _createError.value = null
                val recipient = _recipientUserId.value.trim()
                if (recipient.isEmpty()) {
                    _createError.value = "Recipient user ID is required"
                    return@launch
                }
                val parsed = mutableListOf<CreateBusinessInvoiceLineItem>()
                for (item in _lineItems.value) {
                    val description = item.description.trim()
                    val amount = item.amount.trim()
                    if (description.isEmpty() || amount.isEmpty()) continue
                    val cents = centsFromDollars(amount)
                    if (cents == null || cents <= 0) {
                        _createError.value = "Invalid amount: ${item.amount}"
                        return@launch
                    }
                    parsed +=
                        CreateBusinessInvoiceLineItem(
                            description = description,
                            amountCents = cents,
                            quantity = maxOf(1, item.quantity.trim().toIntOrNull() ?: 1),
                        )
                }
                if (parsed.isEmpty()) {
                    _createError.value = "At least one line item is required"
                    return@launch
                }

                _isCreating.value = true
                val due = _dueDate.value.trim()
                val note = _memo.value.trim()
                val result =
                    repository.createInvoice(
                        businessId,
                        CreateBusinessInvoiceRequest(
                            recipientUserId = recipient,
                            lineItems = parsed,
                            dueDate = due.ifEmpty { null },
                            memo = note.ifEmpty { null },
                        ),
                    )
                _isCreating.value = false
                when (result) {
                    is NetworkResult.Success -> {
                        resetDraft()
                        _action.value = BusinessInvoicesAction.Succeeded("Invoice sent.")
                        onSent()
                        refresh()
                    }
                    is NetworkResult.Failure -> _createError.value = result.error.message
                }
            }
        }

        fun clearAction() {
            _action.value = BusinessInvoicesAction.Idle
        }

        companion object {
            private const val PAGE_SIZE = 20
            private const val CENTS_PER_UNIT = 100.0
            private const val ISO_DATE_LENGTH = 10

            private val VOIDABLE_STATUSES = setOf("sent", "viewed", "overdue")

            /** "125.50" → 12550. Null for anything that isn't a positive decimal. */
            fun centsFromDollars(text: String): Int? {
                val cleaned = text.replace("$", "").replace(",", "").trim()
                val value = cleaned.toDoubleOrNull() ?: return null
                if (!value.isFinite() || value <= 0) return null
                return (value * CENTS_PER_UNIT).roundToInt()
            }

            /** `1250` → `"$12.50"`. Matches RN's `formatCents`. */
            fun money(cents: Int): String = String.format(Locale.US, "$%.2f", cents / CENTS_PER_UNIT)

            /** Pure projection — the unit-test surface. */
            fun rowFrom(dto: BusinessInvoiceDto): BusinessInvoiceRow {
                val status = dto.status.lowercase(Locale.US)
                val items =
                    dto.lineItems.mapIndexed { index, item ->
                        val quantity = maxOf(1, item.quantity)
                        BusinessInvoiceRow.LineItem(
                            id = index,
                            title = if (quantity > 1) "${item.description} ×$quantity" else item.description,
                            amountLabel = money(item.amountCents * quantity),
                        )
                    }
                return BusinessInvoiceRow(
                    id = dto.id,
                    recipientName = dto.recipient?.displayName("Unknown") ?: "Unknown",
                    createdLabel = shortDate(dto.createdAt) ?: "—",
                    dueLabel = shortDate(dto.dueDate)?.let { "Due $it" },
                    totalLabel = money(dto.totalCents),
                    feeLabel = money(dto.feeCents),
                    status = status,
                    memo = dto.memo?.trim()?.takeIf { it.isNotEmpty() },
                    lineItems = items,
                    canVoid = status in VOIDABLE_STATUSES,
                )
            }

            private val DISPLAY_FORMATTER: DateTimeFormatter =
                DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)

            /**
             * ISO-8601 instant or a bare `YYYY-MM-DD` → a short display date.
             */
            fun shortDate(raw: String?): String? {
                if (raw.isNullOrBlank()) return null
                val fromInstant =
                    runCatching {
                        Instant.parse(raw).atZone(ZoneId.systemDefault()).toLocalDate()
                    }.getOrNull()
                val date =
                    fromInstant
                        ?: runCatching { LocalDate.parse(raw.take(ISO_DATE_LENGTH)) }.getOrNull()
                return date?.format(DISPLAY_FORMATTER)
            }
        }
    }
