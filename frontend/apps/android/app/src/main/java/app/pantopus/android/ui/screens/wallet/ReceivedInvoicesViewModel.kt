package app.pantopus.android.ui.screens.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessInvoiceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.businesses.BusinessInvoicesRepository
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.contentdetail.InvoiceDetailViewModel
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import javax.inject.Inject

/**
 * Invoices businesses sent the signed-in person, from `GET api/businesses/invoices/received`
 * (`backend/routes/businesses.js:4747`, which leaves out void invoices). The "Invoice Received" notification was the
 * only way to an invoice; this list, opened from the Wallet, is the way back once that is gone. Unpaid invoices come
 * first under a banner with what is owed, and each row opens the invoice detail to pay. Rows use the Bills list's
 * amount + status chip. Mirrors iOS `ReceivedInvoicesViewModel.swift` and web `/app/invoices`.
 */
@HiltViewModel
class ReceivedInvoicesViewModel
    @Inject
    constructor(
        private val repository: BusinessInvoicesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        /** A re-read failed while the rows stay on screen: "Couldn't refresh. Showing 3:42 PM." with Retry. */
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        private var invoices: List<BusinessInvoiceDto>? = null
        private var loadedAt = 0L
        private var onOpenInvoice: (String) -> Unit = {}
        private var job: Job? = null

        fun configureNavigation(onOpenInvoice: (String) -> Unit) {
            this.onOpenInvoice = onOpenInvoice
        }

        /**
         * The first visit shows the skeleton. Coming back from an invoice composes the screen again, which calls this
         * and re-reads in place, so a payment made there shows here.
         */
        fun load() {
            if (invoices == null) _state.value = ListOfRowsUiState.Loading
            fetch(pulled = false)
        }

        fun refresh() {
            fetch(pulled = true)
        }

        private fun fetch(pulled: Boolean) {
            job?.cancel()
            if (pulled && invoices != null) _refreshing.value = true
            job =
                viewModelScope.launch {
                    when (val result = fetchAll()) {
                        is NetworkResult.Success -> {
                            invoices = result.data
                            loadedAt = System.currentTimeMillis()
                            _refreshNotice.value = null
                            render(result.data)
                        }
                        is NetworkResult.Failure -> {
                            if (invoices == null) {
                                _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load your invoices."))
                            } else {
                                _refreshNotice.value = RefreshNotice(shownAt = loadedAt, onRetry = { refresh() })
                            }
                        }
                    }
                    _refreshing.value = false
                }
        }

        /** The server answers at most 50 a page. A household has a handful, so every page is read before the split. */
        private suspend fun fetchAll(): NetworkResult<List<BusinessInvoiceDto>> {
            val all = LinkedHashMap<String, BusinessInvoiceDto>()
            for (page in 1..MAX_PAGES) {
                when (val result = repository.receivedInvoices(page = page, pageSize = PAGE_SIZE)) {
                    is NetworkResult.Failure -> return result
                    is NetworkResult.Success -> {
                        result.data.invoices.forEach { all.putIfAbsent(it.id, it) }
                        val total = result.data.pagination?.total ?: 0
                        if (result.data.invoices.size < PAGE_SIZE || all.size >= total) break
                    }
                }
            }
            return NetworkResult.Success(all.values.toList())
        }

        private fun render(loaded: List<BusinessInvoiceDto>) {
            if (loaded.isEmpty()) {
                _banner.value = null
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.ReceiptText,
                        headline = "No invoices yet",
                        subcopy = "When a business you hire on Pantopus sends you an invoice, it shows up here so you can pay it.",
                    )
                return
            }
            val today = LocalDate.now()
            val unpaid = loaded.filter { isUnpaid(it) }
            // Overdue first, then the newest (the server's order); paid ones stay newest first.
            val toPay = unpaid.filter { isOverdue(it, today) } + unpaid.filterNot { isOverdue(it, today) }
            val paid = loaded.filterNot { isUnpaid(it) }
            val sections =
                buildList {
                    if (toPay.isNotEmpty()) {
                        add(RowSection(id = "toPay", header = "To pay", rows = toPay.map { rowFor(it, today) }, count = toPay.size))
                    }
                    if (paid.isNotEmpty()) {
                        add(RowSection(id = "paid", header = "Paid", rows = paid.map { rowFor(it, today) }, count = paid.size))
                    }
                }
            _state.value = ListOfRowsUiState.Loaded(sections = sections, hasMore = false)
            _banner.value = bannerFor(unpaid, today)
        }

        private fun bannerFor(
            unpaid: List<BusinessInvoiceDto>,
            today: LocalDate,
        ): BannerConfig? {
            if (unpaid.isEmpty()) return null
            val owed = unpaid.sumOf { it.totalCents }
            val overdue = unpaid.count { isOverdue(it, today) }
            val count = if (unpaid.size == 1) "1 invoice" else "${unpaid.size} invoices"
            val overdueNote = if (overdue > 0) " · $overdue overdue" else ""
            return BannerConfig(
                icon = PantopusIcon.ReceiptText,
                title = "${InvoiceDetailViewModel.Projection.money(owed)} to pay",
                subtitle = "$count$overdueNote · tap one to pay by card",
                tint = if (overdue > 0) BannerCtaTint.Warning else BannerCtaTint.Primary,
            )
        }

        private fun rowFor(
            invoice: BusinessInvoiceDto,
            today: LocalDate,
        ): RowModel {
            val projection = project(invoice, today)
            return RowModel(
                id = invoice.id,
                title = invoice.business?.displayName ?: "Business",
                subtitle = projection.subtitle,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.TypeIcon(
                        icon = PantopusIcon.ReceiptText,
                        background = PantopusColors.businessBg,
                        foreground = PantopusColors.business,
                    ),
                trailing =
                    RowTrailing.AmountWithChip(
                        amount = InvoiceDetailViewModel.Projection.money(invoice.totalCents),
                        chipText = projection.chipText,
                        chipVariant = projection.chipVariant,
                        chipIcon = projection.chipIcon,
                    ),
                onTap = { onOpenInvoice(invoice.id) },
                // Not opened yet: the server turns `sent` into `viewed` when the invoice is read.
                highlight = if (invoice.status == "sent") RowHighlight.Unread else null,
            )
        }

        /** What one row says: when it is due or was paid, and its chip. */
        data class RowProjection(
            val subtitle: String,
            val chipText: String,
            val chipVariant: StatusChipVariant,
            val chipIcon: PantopusIcon,
        )

        companion object {
            private const val PAGE_SIZE = 50
            private const val MAX_PAGES = 10

            fun project(
                invoice: BusinessInvoiceDto,
                today: LocalDate,
            ): RowProjection {
                val due = InvoiceDetailViewModel.Projection.shortDate(invoice.dueDate, preservingDay = true)
                if (!isUnpaid(invoice)) {
                    val paid = InvoiceDetailViewModel.Projection.shortDate(invoice.paidAt)
                    return RowProjection(paid?.let { "Paid $it" } ?: "Paid", "Paid", StatusChipVariant.Success, PantopusIcon.Check)
                }
                if (isOverdue(invoice, today)) {
                    return RowProjection(
                        subtitle = due?.let { "Overdue · was due $it" } ?: "Overdue",
                        chipText = "Overdue",
                        chipVariant = StatusChipVariant.ErrorVariant,
                        chipIcon = PantopusIcon.AlertCircle,
                    )
                }
                val subtitle =
                    due?.let { "Due $it" }
                        ?: InvoiceDetailViewModel.Projection.shortDate(invoice.createdAt)?.let { "Sent $it" }
                        ?: "Payment requested"
                return RowProjection(subtitle, "Unpaid", StatusChipVariant.Warning, PantopusIcon.Clock)
            }

            fun isUnpaid(invoice: BusinessInvoiceDto): Boolean = invoice.status in setOf("sent", "viewed", "overdue")

            /**
             * Past due once the due day has ended where the person is. A due date is a calendar day stored as
             * midnight UTC, so its day is read in UTC.
             */
            fun isOverdue(
                invoice: BusinessInvoiceDto,
                today: LocalDate,
            ): Boolean {
                if (!isUnpaid(invoice)) return false
                if (invoice.status == "overdue") return true
                val dueDay = invoice.dueDate?.let(::calendarDay) ?: return false
                return dueDay.isBefore(today)
            }

            private fun calendarDay(raw: String): LocalDate? =
                runCatching { LocalDate.parse(raw) }.getOrNull()
                    ?: runCatching { OffsetDateTime.parse(raw).withOffsetSameInstant(ZoneOffset.UTC).toLocalDate() }.getOrNull()
        }
    }
