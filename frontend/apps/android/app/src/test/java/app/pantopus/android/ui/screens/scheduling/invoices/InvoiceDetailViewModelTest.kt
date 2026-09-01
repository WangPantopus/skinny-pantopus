@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invoices

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.InvoiceDto
import app.pantopus.android.data.api.models.scheduling.InvoiceResponse
import app.pantopus.android.data.api.models.scheduling.SchedulingOkResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class InvoiceDetailViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val auth: AuthRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val flags = SchedulingFeatureFlags().apply { environment = "local" }

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedIn(user()))
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun user() = UserDto(id = "biz-1", email = "a@b.com", displayName = "A", avatarUrl = null)

    private fun handle(id: String) = SavedStateHandle(mapOf(SchedulingRoutes.ARG_INVOICE_ID to id))

    private fun vm(id: String = "abc123def") = InvoiceDetailViewModel(handle(id), repo, auth, errors, flags)

    private fun invoice() =
        InvoiceDto(
            id = "abc123def",
            recipientUserId = "cust-9",
            totalCents = 22000,
            currency = "USD",
            lineItems = listOf(mapOf("description" to "Haircut", "quantity" to 1.0, "total_cents" to 4800.0)),
            createdAt = "2026-06-04T12:00:00Z",
        )

    @Test
    fun `paid flag off shows coming soon`() =
        runTest(dispatcher) {
            flags.environment = "production"
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is InvoiceDetailUiState.ComingSoon)
        }

    @Test
    fun `loaded builds reference, total and line items`() =
        runTest(dispatcher) {
            coEvery { repo.getInvoice(any(), "abc123def") } returns NetworkResult.Success(InvoiceResponse(invoice()))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as InvoiceDetailUiState.Loaded
            assertEquals("INV-ABC123", loaded.reference)
            assertEquals("$220.00", loaded.totalLabel)
            assertEquals("USD", loaded.currencyCode)
            assertEquals(1, loaded.lineItems.size)
            assertEquals("Haircut", loaded.lineItems.first().label)
        }

    @Test
    fun `loaded derives status, timeline and breakdown from the row`() =
        runTest(dispatcher) {
            coEvery { repo.getInvoice(any(), "abc123def") } returns
                NetworkResult.Success(
                    InvoiceResponse(
                        invoice().copy(
                            status = "paid",
                            subtotalCents = 20000,
                            feeCents = 2000,
                            paidAt = "2026-06-06T09:00:00Z",
                            dueDate = "2026-06-18T00:00:00Z",
                        ),
                    ),
                )
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as InvoiceDetailUiState.Loaded
            assertEquals("paid", loaded.invoiceStatus)
            assertEquals("$200.00", loaded.subtotalLabel)
            assertEquals("$20.00", loaded.feeLabel)
            assertEquals(listOf("Created", "Sent", "Paid"), loaded.timelineEvents.map { it.label })
            assertTrue(loaded.timelineEvents.all { it.isDone })
        }

    @Test
    fun `unpaid invoice with a due date gets a pending Due event`() =
        runTest(dispatcher) {
            coEvery { repo.getInvoice(any(), "abc123def") } returns
                NetworkResult.Success(
                    InvoiceResponse(invoice().copy(status = "sent", dueDate = "2026-06-18T00:00:00Z")),
                )
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as InvoiceDetailUiState.Loaded
            assertEquals(listOf("Created", "Sent", "Due"), loaded.timelineEvents.map { it.label })
            assertTrue(loaded.timelineEvents.last().isDone.not())
        }

    @Test
    fun `send posts the invoice and flashes the sent toast`() =
        runTest(dispatcher) {
            coEvery { repo.getInvoice(any(), any()) } returns NetworkResult.Success(InvoiceResponse(invoice()))
            coEvery { repo.sendInvoice(any(), "abc123def") } returns NetworkResult.Success(SchedulingOkResponse())
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.send()
            advanceUntilIdle()
            coVerify { repo.sendInvoice(any(), "abc123def") }
        }
}
