@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.contentdetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessInvoiceDto
import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.businesses.BusinessInvoicesRepository
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/**
 * A09.4 Invoice — the recipient's view of a business invoice, wired to the
 * real backend:
 * - `GET api/businesses/invoices/{id}` → the invoice we render
 * - `POST api/businesses/invoices/{id}/pay` → PaymentIntent client secret
 * - `POST api/businesses/invoices/{id}/confirm` → flip it to `paid`
 *
 * Pay presents the same Stripe PaymentSheet the gig / listing checkouts use,
 * then re-reads the invoice from the server — we never mark it paid locally,
 * and every figure on screen is the server's own `…_cents` value, only
 * formatted here. Mirrors iOS `InvoiceDetailViewModel`.
 */
@HiltViewModel
class InvoiceDetailViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val invoicesRepository: BusinessInvoicesRepository,
    ) : ViewModel() {
        companion object {
            const val INVOICE_ID_KEY = "invoiceId"
        }

        private val invoiceId: String = savedStateHandle.get<String>(INVOICE_ID_KEY).orEmpty()

        private val _state = MutableStateFlow<ContentDetailUiState>(ContentDetailUiState.Loading)
        val state: StateFlow<ContentDetailUiState> = _state.asStateFlow()

        private val _paymentStatus = MutableStateFlow<InvoicePaymentStatus>(InvoicePaymentStatus.Idle)
        val paymentStatus: StateFlow<InvoicePaymentStatus> = _paymentStatus.asStateFlow()

        private val _events = MutableSharedFlow<InvoiceDetailEvent>(extraBufferCapacity = 4)
        val events: SharedFlow<InvoiceDetailEvent> = _events.asSharedFlow()

        /** The last invoice read from the server — the source of truth. */
        private var invoice: BusinessInvoiceDto? = null

        fun load() {
            fetch(showLoading = true)
        }

        fun refresh() {
            fetch(showLoading = true)
        }

        /**
         * Short summary handed to the paid dock's Share action. Mirrors the
         * iOS string exactly and quotes the server's own total, so the shared
         * text can never disagree with the screen.
         */
        fun shareSummary(): String {
            val reference = Projection.reference(invoiceId)
            val current = invoice ?: return "Invoice $reference via Pantopus"
            val total = Projection.money(current.totalCents)
            return if (current.status == "paid") {
                "Invoice $reference · Paid $total via Pantopus"
            } else {
                "Invoice $reference · $total due via Pantopus"
            }
        }

        /** Tapped "Pay" — create the PaymentIntent, then ask the screen to present the sheet. */
        fun pay() {
            val current = invoice
            if (current == null || !Projection.isPayable(current.status)) {
                _paymentStatus.value = InvoicePaymentStatus.Declined(unpayableMessage(current?.status))
                return
            }
            _paymentStatus.value = InvoicePaymentStatus.Paying
            viewModelScope.launch {
                when (val result = invoicesRepository.payInvoice(invoiceId)) {
                    is NetworkResult.Success ->
                        _events.emit(
                            InvoiceDetailEvent.PresentCheckout(
                                // The invoice pay route returns no customer /
                                // ephemeral key — PaymentSheet still collects a
                                // card against the client secret.
                                PaymentIntentSheetParamsDto(
                                    clientSecret = result.data.clientSecret,
                                    paymentIntentId = result.data.paymentIntentId,
                                ),
                            ),
                        )
                    is NetworkResult.Failure ->
                        _paymentStatus.value =
                            InvoicePaymentStatus.Declined(
                                result.error.displayMessage("Couldn't start this payment. Please try again."),
                            )
                }
            }
        }

        /** Result of presenting PaymentSheet, mapped from Stripe in the screen. */
        fun onCheckoutOutcome(outcome: CheckoutOutcome) {
            when (outcome) {
                CheckoutOutcome.Paid -> {
                    _paymentStatus.value = InvoicePaymentStatus.Paid
                    viewModelScope.launch {
                        // The charge succeeded — tell the server so the invoice
                        // flips to `paid`. A failure here is not a payment
                        // failure (the Stripe webhook also reconciles), so we
                        // still report success and let the re-read decide what
                        // the screen shows.
                        invoicesRepository.confirmInvoicePayment(invoiceId)
                        fetch(showLoading = false)
                    }
                }
                CheckoutOutcome.Canceled -> _paymentStatus.value = InvoicePaymentStatus.Canceled
                is CheckoutOutcome.Declined ->
                    _paymentStatus.value =
                        InvoicePaymentStatus.Declined(outcome.message ?: "Your card was declined.")
            }
        }

        /** Clear a result toast once the screen has shown it. */
        fun clearPaymentStatus() {
            _paymentStatus.value = InvoicePaymentStatus.Idle
        }

        private fun fetch(showLoading: Boolean) {
            if (showLoading) _state.value = ContentDetailUiState.Loading
            viewModelScope.launch {
                when (val result = invoicesRepository.invoice(invoiceId)) {
                    is NetworkResult.Success -> {
                        invoice = result.data.invoice
                        _state.value = ContentDetailUiState.Loaded(Projection.from(result.data.invoice))
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            ContentDetailUiState.Error(
                                result.error.displayMessage("Couldn't load this invoice."),
                            )
                }
            }
        }

        private fun unpayableMessage(status: String?): String =
            when (status) {
                "paid" -> "This invoice has already been paid."
                "void" -> "This invoice has been voided."
                null -> "Couldn't load this invoice."
                else -> "This invoice isn't payable yet."
            }

        /**
         * Pure projection of a server invoice onto the A09.4 frame. Every
         * amount comes straight from the invoice's `…_cents` columns.
         */
        object Projection {
            /** Payable statuses, mirroring `backend/routes/businesses.js:4661`. */
            fun isPayable(status: String): Boolean = status in setOf("sent", "viewed", "overdue")

            fun from(invoice: BusinessInvoiceDto): ContentDetailContent {
                val isPaid = invoice.status == "paid"
                val isVoid = invoice.status == "void"
                val total = money(invoice.totalCents)
                val businessName = invoice.business?.displayName ?: "Business"

                val modules = mutableListOf<ContentDetailModule>()
                modules +=
                    ContentDetailModule.FromTo(
                        id = "fromto",
                        from =
                            ContentDetailParty(
                                label = "From",
                                name = businessName,
                                sub = "Business",
                                accent = ContentDetailParty.Accent.Business,
                            ),
                        to =
                            ContentDetailParty(
                                label = "To",
                                name = "You",
                                sub = "Personal",
                                accent = ContentDetailParty.Accent.Personal,
                            ),
                    )
                if (isPaid) {
                    modules +=
                        ContentDetailModule.Callout(
                            id = "invoice-paid",
                            style = ContentDetailModule.Callout.Style.Banner,
                            tone = ContentDetailModule.Callout.Tone.Success,
                            icon = PantopusIcon.CheckCircle,
                            iconTone = ContentDetailModule.Callout.IconTone.SuccessOutline,
                            title = "Invoice paid",
                            subtitle = shortDate(invoice.paidAt)?.let { "Paid on $it" },
                        )
                } else if (isVoid) {
                    modules +=
                        ContentDetailModule.Callout(
                            id = "invoice-void",
                            style = ContentDetailModule.Callout.Style.Banner,
                            tone = ContentDetailModule.Callout.Tone.Neutral,
                            icon = PantopusIcon.XCircle,
                            iconTone = ContentDetailModule.Callout.IconTone.Primary,
                            title = "This invoice has been voided",
                        )
                }
                modules += lineItems(invoice, isPaid)
                invoice.memo?.trim()?.takeIf { it.isNotEmpty() }?.let { memo ->
                    modules +=
                        ContentDetailModule.Description(
                            id = "note",
                            title = "Note from sender",
                            icon = null,
                            body = memo,
                        )
                }

                return ContentDetailContent(
                    kind = ContentDetailKind.Invoice,
                    statusPill = statusPill(invoice),
                    hero =
                        ContentDetailHero(
                            title = heroTitle(invoice, businessName),
                            monoId = monoId(invoice),
                            priceLine = total,
                            priceCaption = if (isPaid) null else "total · ${currencyCode(invoice)}",
                            priceTone =
                                if (isPaid) {
                                    ContentDetailHero.PriceTone.Success
                                } else {
                                    ContentDetailHero.PriceTone.Auto
                                },
                            priceTrailingLabel = if (isPaid) "paid in full" else null,
                            priceCheckDisc = isPaid,
                        ),
                    modules = modules,
                    dock = dock(invoice, total, isPaid, isVoid),
                )
            }

            private fun heroTitle(
                invoice: BusinessInvoiceDto,
                businessName: String,
            ): String {
                val named = invoice.lineItems.map { it.description.trim() }.filter { it.isNotEmpty() }
                return if (named.size == 1) named.first() else "Invoice from $businessName"
            }

            private fun monoId(invoice: BusinessInvoiceDto): String {
                val parts = mutableListOf(reference(invoice.id))
                shortDate(invoice.createdAt)?.let { parts += "issued $it" }
                if (invoice.status == "paid") {
                    shortDate(invoice.paidAt)?.let { parts += "paid $it" }
                } else {
                    shortDate(invoice.dueDate)?.let { parts += "due $it" }
                }
                return parts.joinToString(" · ")
            }

            private fun statusPill(invoice: BusinessInvoiceDto): ContentDetailPill =
                when (invoice.status) {
                    "paid" ->
                        ContentDetailPill(
                            id = "status",
                            label = "Paid" + (shortDate(invoice.paidAt)?.let { " · $it" } ?: ""),
                            icon = PantopusIcon.CheckCircle,
                            tone = ContentDetailPill.Tone.Success,
                        )
                    "void" ->
                        ContentDetailPill(
                            id = "status",
                            label = "Voided",
                            icon = PantopusIcon.XCircle,
                            tone = ContentDetailPill.Tone.Error,
                        )
                    "overdue" ->
                        ContentDetailPill(
                            id = "status",
                            label = "Overdue" + (shortDate(invoice.dueDate)?.let { " · due $it" } ?: ""),
                            icon = PantopusIcon.AlertCircle,
                            tone = ContentDetailPill.Tone.Warning,
                        )
                    "viewed", "sent" ->
                        ContentDetailPill(
                            id = "status",
                            label = shortDate(invoice.dueDate)?.let { "Due $it" } ?: "Payment requested",
                            icon = PantopusIcon.Clock,
                            tone = ContentDetailPill.Tone.Info,
                        )
                    else ->
                        ContentDetailPill(
                            id = "status",
                            label = invoice.status.replaceFirstChar(Char::uppercase),
                            icon = PantopusIcon.Clock,
                            tone = ContentDetailPill.Tone.Neutral,
                        )
                }

            /**
             * Line-item table. The server stores a unit `amount_cents` +
             * `quantity` per row (no per-row total column), so the row total is
             * the same multiplication RN does — the invoice's own subtotal /
             * total are never recomputed here.
             */
            private fun lineItems(
                invoice: BusinessInvoiceDto,
                isPaid: Boolean,
            ): ContentDetailModule.LineItems {
                val rows =
                    invoice.lineItems.mapIndexed { index, item ->
                        ContentDetailLineItem(
                            id = "line-$index",
                            item = item.description,
                            qty = "${item.quantity}",
                            unit = money(item.amountCents),
                            total = money(item.amountCents * maxOf(item.quantity, 1)),
                        )
                    }
                // The platform fee is deducted from the business's payout, not
                // added to what the recipient owes (`businesses.js:4796`), so it
                // is never shown as a charge here. Subtotal only appears when it
                // differs from the total the server is billing.
                val fees =
                    if (invoice.subtotalCents != invoice.totalCents) {
                        listOf(ContentDetailSummaryRow("subtotal", "Subtotal", money(invoice.subtotalCents)))
                    } else {
                        emptyList()
                    }
                return ContentDetailModule.LineItems(
                    id = "items",
                    title = "Line items",
                    icon = PantopusIcon.File,
                    rows = rows,
                    fees = fees,
                    totalLabel = if (isPaid) "Paid" else "Total",
                    totalValue = money(invoice.totalCents),
                    totalTone =
                        if (isPaid) {
                            ContentDetailModule.LineItems.TotalTone.Success
                        } else {
                            ContentDetailModule.LineItems.TotalTone.Primary
                        },
                )
            }

            private fun dock(
                invoice: BusinessInvoiceDto,
                total: String,
                isPaid: Boolean,
                isVoid: Boolean,
            ): ContentDetailDock =
                when {
                    isPaid ->
                        ContentDetailDock(
                            secondary = ContentDetailDockButton(label = "Share", icon = PantopusIcon.Share),
                            primary =
                                ContentDetailDockButton(
                                    label = "Paid in full",
                                    icon = PantopusIcon.CheckCircle,
                                    enabled = false,
                                ),
                        )
                    isVoid ->
                        ContentDetailDock(
                            secondary = null,
                            primary =
                                ContentDetailDockButton(
                                    label = "Invoice voided",
                                    icon = PantopusIcon.XCircle,
                                    enabled = false,
                                ),
                        )
                    isPayable(invoice.status) ->
                        ContentDetailDock(
                            secondary = null,
                            primary = ContentDetailDockButton(label = "Pay $total", icon = PantopusIcon.CreditCard),
                        )
                    else ->
                        ContentDetailDock(
                            secondary = null,
                            primary =
                                ContentDetailDockButton(
                                    label = "Not payable yet",
                                    icon = PantopusIcon.Clock,
                                    enabled = false,
                                ),
                        )
                }

            /** Short, human reference for an invoice UUID — first block, upper-cased. */
            fun reference(invoiceId: String): String = invoiceId.substringBefore('-').take(8).uppercase(Locale.US)

            fun currencyCode(invoice: BusinessInvoiceDto): String =
                invoice.currency?.trim()?.takeIf { it.isNotEmpty() }?.uppercase(Locale.US) ?: "USD"

            private val centsFormat: NumberFormat =
                NumberFormat.getNumberInstance(Locale.US).apply {
                    minimumFractionDigits = 2
                    maximumFractionDigits = 2
                    isGroupingUsed = true
                }

            /**
             * Integer cents → `"$1,284.50"`. Formatting only — no rounding or
             * re-derivation of the server's amount.
             */
            fun money(cents: Int): String = "$" + centsFormat.format(cents / 100.0)

            private val shortDateFormat: DateTimeFormatter =
                DateTimeFormatter.ofPattern("MMM d", Locale.US)

            /**
             * ISO-8601 timestamp → `"Dec 14"`; null when absent or unparseable
             * (the caller then omits that clause entirely).
             */
            fun shortDate(raw: String?): String? {
                if (raw.isNullOrEmpty()) return null
                val instant =
                    runCatching { Instant.parse(raw) }.getOrNull()
                        ?: runCatching { OffsetDateTime.parse(raw).toInstant() }.getOrNull()
                        ?: return null
                return shortDateFormat.format(instant.atZone(ZoneId.systemDefault()))
            }
        }
    }
