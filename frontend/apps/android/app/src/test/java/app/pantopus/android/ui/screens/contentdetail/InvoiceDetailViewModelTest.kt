@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.contentdetail

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import app.pantopus.android.data.api.models.businesses.BusinessInvoiceDto
import app.pantopus.android.data.api.models.businesses.BusinessInvoiceLineItemDto
import app.pantopus.android.data.api.models.businesses.BusinessInvoicePartyDto
import app.pantopus.android.data.api.models.businesses.BusinessInvoiceResponse
import app.pantopus.android.data.api.models.businesses.PayInvoiceResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessInvoicesRepository
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Mirrors iOS `InvoiceCheckoutTests`. Covers the real invoice flow: read the
 * invoice from `GET api/businesses/invoices/{id}`, create the PaymentIntent
 * via `.../pay`, present PaymentSheet (exercised in the screen), then confirm
 * and re-read server state.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class InvoiceDetailViewModelTest {
    private lateinit var repository: BusinessInvoicesRepository

    private val invoiceId = "7f3c1a24-1111-4000-8000-000000000001"

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        repository = mockk(relaxed = true)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun invoiceDto(
        status: String = "sent",
        paidAt: String? = null,
    ) = BusinessInvoiceDto(
        id = invoiceId,
        lineItems = listOf(BusinessInvoiceLineItemDto(description = "Install labor", amountCents = 6500, quantity = 2)),
        subtotalCents = 13_000,
        feeCents = 390,
        totalCents = 13_000,
        currency = "usd",
        status = status,
        dueDate = "2025-12-18T17:00:00.000Z",
        createdAt = "2025-12-04T17:00:00.000Z",
        paidAt = paidAt,
        business = BusinessInvoicePartyDto(id = "b1", name = "Brightside Outdoor"),
    )

    private fun vm() =
        InvoiceDetailViewModel(
            savedStateHandle = SavedStateHandle(mapOf(InvoiceDetailViewModel.INVOICE_ID_KEY to invoiceId)),
            invoicesRepository = repository,
        )

    private val payResponse =
        PayInvoiceResponse(
            clientSecret = "pi_secret_1",
            paymentIntentId = "pi_1",
            paymentId = "pay_1",
            amountCents = 13_000,
            feeCents = 390,
        )

    /** The invoice is read from the backend — never from a fixture. */
    @Test
    fun load_renders_the_server_invoice() =
        runTest {
            coEvery { repository.invoice(invoiceId) } returns
                NetworkResult.Success(BusinessInvoiceResponse(invoiceDto()))
            val vm = vm()
            vm.load()
            val content = (vm.state.value as ContentDetailUiState.Loaded).content
            assertEquals(ContentDetailKind.Invoice, content.kind)
            assertEquals("$130.00", content.hero.priceLine)
            assertEquals("Pay $130.00", content.dock.primary.label)
        }

    @Test
    fun load_failure_surfaces_error_frame() =
        runTest {
            coEvery { repository.invoice(invoiceId) } returns
                NetworkResult.Failure(NetworkError.Server(404, "Invoice not found"))
            val vm = vm()
            vm.load()
            assertTrue(vm.state.value is ContentDetailUiState.Error)
        }

    // checkout.paymentSheet — pay() creates the intent and asks the screen to present.
    @Test
    fun pay_success_emits_present_checkout_event() =
        runTest {
            coEvery { repository.invoice(invoiceId) } returns
                NetworkResult.Success(BusinessInvoiceResponse(invoiceDto()))
            coEvery { repository.payInvoice(invoiceId) } returns NetworkResult.Success(payResponse)
            val vm = vm()
            vm.load()
            vm.events.test {
                vm.pay()
                val event = awaitItem()
                assertTrue(event is InvoiceDetailEvent.PresentCheckout)
                assertEquals("pi_secret_1", (event as InvoiceDetailEvent.PresentCheckout).params.clientSecret)
                cancelAndIgnoreRemainingEvents()
            }
            assertEquals(InvoicePaymentStatus.Paying, vm.paymentStatus.value)
        }

    // /pay fails → declined, no sheet.
    @Test
    fun pay_failure_marks_declined() =
        runTest {
            coEvery { repository.invoice(invoiceId) } returns
                NetworkResult.Success(BusinessInvoiceResponse(invoiceDto()))
            coEvery { repository.payInvoice(invoiceId) } returns
                NetworkResult.Failure(NetworkError.Server(400, "This invoice has already been paid"))
            val vm = vm()
            vm.load()
            vm.pay()
            assertTrue(vm.paymentStatus.value is InvoicePaymentStatus.Declined)
        }

    /** A paid invoice never re-runs checkout. */
    @Test
    fun paid_invoice_refuses_to_pay_again() =
        runTest {
            coEvery { repository.invoice(invoiceId) } returns
                NetworkResult.Success(BusinessInvoiceResponse(invoiceDto(status = "paid", paidAt = "2025-12-14T17:00:00.000Z")))
            val vm = vm()
            vm.load()
            vm.pay()
            assertEquals(
                InvoicePaymentStatus.Declined("This invoice has already been paid."),
                vm.paymentStatus.value,
            )
            coVerify(exactly = 0) { repository.payInvoice(any()) }
        }

    // checkout.paySuccess — a completed sheet confirms with the backend, then re-reads.
    @Test
    fun outcome_paid_confirms_and_refreshes() =
        runTest {
            coEvery { repository.invoice(invoiceId) } returns
                NetworkResult.Success(BusinessInvoiceResponse(invoiceDto(status = "paid", paidAt = "2025-12-14T17:00:00.000Z")))
            coEvery { repository.confirmInvoicePayment(invoiceId) } returns
                NetworkResult.Success(BusinessInvoiceResponse(invoiceDto(status = "paid", paidAt = "2025-12-14T17:00:00.000Z")))
            val vm = vm()
            vm.onCheckoutOutcome(CheckoutOutcome.Paid)
            assertEquals(InvoicePaymentStatus.Paid, vm.paymentStatus.value)
            coVerify(exactly = 1) { repository.confirmInvoicePayment(invoiceId) }
            val content = (vm.state.value as ContentDetailUiState.Loaded).content
            assertEquals("Paid in full", content.dock.primary.label)
            assertFalse(content.dock.primary.enabled)
        }

    // checkout.cancel
    @Test
    fun outcome_canceled_marks_canceled() =
        runTest {
            val vm = vm()
            vm.onCheckoutOutcome(CheckoutOutcome.Canceled)
            assertEquals(InvoicePaymentStatus.Canceled, vm.paymentStatus.value)
        }

    // checkout.payDeclined
    @Test
    fun outcome_declined_surfaces_message() =
        runTest {
            val vm = vm()
            vm.onCheckoutOutcome(CheckoutOutcome.Declined("Your card was declined."))
            assertEquals(
                InvoicePaymentStatus.Declined("Your card was declined."),
                vm.paymentStatus.value,
            )
        }
}
