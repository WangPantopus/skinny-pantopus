@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invoices

import app.pantopus.android.data.api.models.scheduling.GetInvoicesResponse
import app.pantopus.android.data.api.models.scheduling.InvoiceDto
import app.pantopus.android.data.api.models.scheduling.PaymentStatusResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import com.squareup.moshi.Moshi
import io.mockk.coEvery
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class InvoicesListViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val auth: AuthRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val flags = SchedulingFeatureFlags().apply { environment = "local" }

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedIn(user()))
        coEvery { repo.getPaymentsStatus(any()) } returns
            NetworkResult.Success(PaymentStatusResponse(applicable = true, connected = true))
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun user() = UserDto(id = "biz-1", email = "a@b.com", displayName = "A", avatarUrl = null)

    private fun vm() = InvoicesListViewModel(repo, auth, errors, flags)

    private fun invoice(
        id: String,
        cents: Int,
        status: String? = null,
        paidAt: String? = null,
    ) = InvoiceDto(
        id = id,
        recipientUserId = "cust-9",
        totalCents = cents,
        currency = "USD",
        status = status,
        paidAt = paidAt,
        createdAt = "2026-06-11T12:00:00Z",
    )

    @Test
    fun `paid flag off shows coming soon`() =
        runTest(dispatcher) {
            flags.environment = "production"
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is InvoicesListUiState.ComingSoon)
        }

    @Test
    fun `gate when no invoices and payments not connected`() =
        runTest(dispatcher) {
            coEvery { repo.getInvoices(any()) } returns NetworkResult.Success(GetInvoicesResponse(emptyList()))
            coEvery { repo.getPaymentsStatus(any()) } returns
                NetworkResult.Success(PaymentStatusResponse(applicable = true, connected = false))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is InvoicesListUiState.Gate)
        }

    @Test
    fun `empty when connected and no invoices`() =
        runTest(dispatcher) {
            coEvery { repo.getInvoices(any()) } returns NetworkResult.Success(GetInvoicesResponse(emptyList()))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is InvoicesListUiState.Empty)
        }

    @Test
    fun `loaded sums totals and groups by day`() =
        runTest(dispatcher) {
            coEvery { repo.getInvoices(any()) } returns
                NetworkResult.Success(GetInvoicesResponse(listOf(invoice("abc123x", 22000), invoice("def456y", 9600))))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as InvoicesListUiState.Loaded
            assertEquals(1, loaded.sections.size)
            assertEquals(2, loaded.sections.first().invoices.size)
            // Status-less legacy rows count as outstanding (not settled).
            assertEquals("$316.00", loaded.outstandingLabel)
            // Nothing carries a paid_at → collected this month is zero.
            assertEquals("$0.00", loaded.collectedMonthLabel)
            assertFalse(loaded.hasOverdue)
        }

    @Test
    fun `outstanding excludes settled and collected uses paid_at month`() =
        runTest(dispatcher) {
            val paidNow = java.time.Instant.now().toString()
            coEvery { repo.getInvoices(any()) } returns
                NetworkResult.Success(
                    GetInvoicesResponse(
                        listOf(
                            invoice("aaa111x", 22000, status = "paid", paidAt = paidNow),
                            invoice("bbb222y", 9600, status = "sent"),
                            invoice("ccc333z", 5000, status = "void"),
                            invoice("ddd444w", 1500, status = "overdue"),
                        ),
                    ),
                )
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as InvoicesListUiState.Loaded
            // paid + void drop out of Outstanding: 9600 + 1500.
            assertEquals("$111.00", loaded.outstandingLabel)
            // Only the invoice paid this calendar month counts as collected.
            assertEquals("$220.00", loaded.collectedMonthLabel)
            assertTrue(loaded.hasOverdue)
        }

    @Test
    fun `status filter narrows sections but keeps KPIs global`() =
        runTest(dispatcher) {
            coEvery { repo.getInvoices(any()) } returns
                NetworkResult.Success(
                    GetInvoicesResponse(
                        listOf(
                            invoice("aaa111x", 22000, status = "paid", paidAt = "2026-01-05T10:00:00Z"),
                            invoice("bbb222y", 9600, status = "sent"),
                            invoice("ccc333z", 4400, status = "viewed"),
                        ),
                    ),
                )
            val model = vm()
            model.start()
            advanceUntilIdle()

            model.selectFilter(InvoiceFilter.Sent)
            val sent = model.state.value as InvoicesListUiState.Loaded
            // Sent chip covers sent + viewed.
            assertEquals(2, sent.sections.sumOf { it.invoices.size })
            // KPIs stay computed over the full list.
            assertEquals("$140.00", sent.outstandingLabel)

            model.selectFilter(InvoiceFilter.Refunded)
            val refunded = model.state.value as InvoicesListUiState.Loaded
            assertTrue(refunded.sections.isEmpty())

            model.selectFilter(InvoiceFilter.All)
            val all = model.state.value as InvoicesListUiState.Loaded
            assertEquals(3, all.sections.sumOf { it.invoices.size })
        }

    @Test
    fun `reference is derived from the invoice id`() =
        runTest(dispatcher) {
            val model = vm()
            assertEquals("INV-ABC123", model.reference(invoice("abc123def", 100)))
        }
}
