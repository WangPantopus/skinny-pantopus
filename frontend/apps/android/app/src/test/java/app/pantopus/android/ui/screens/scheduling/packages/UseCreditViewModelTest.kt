@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.packages

import app.pantopus.android.data.api.models.scheduling.ApplyCreditResponse
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.CreditPackageMeta
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.models.scheduling.PackageCreditDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class UseCreditViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before
    fun setup() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = UseCreditViewModel(repo, errors)

    private fun credit() =
        PackageCreditDto(id = "c1", packageId = "p1", remaining = 3, bookingPackage = CreditPackageMeta(eventTypeId = null))

    private fun booking(
        id: String,
        status: String = "confirmed",
        credited: Boolean = false,
        start: String = "2099-01-01T10:00:00Z",
    ) = BookingDto(
        id = id,
        status = status,
        startAt = start,
        packageCreditId = if (credited) "x" else null,
        paymentId = null,
    )

    @Test
    fun `filters to eligible upcoming bookings`() =
        runTest(dispatcher) {
            coEvery { repo.getMyBookings() } returns
                NetworkResult.Success(
                    GetBookingsResponse(
                        listOf(
                            booking("b1"),
                            booking("b2", status = "cancelled"),
                            booking("b3", credited = true),
                            booking("b4", start = "2000-01-01T10:00:00Z"),
                        ),
                    ),
                )
            val model = vm()
            model.load(credit())
            advanceUntilIdle()
            val loaded = model.state.value as UseCreditUiState.Loaded
            assertEquals(1, loaded.bookings.size)
            assertEquals("b1", loaded.bookings.first().id)
        }

    @Test
    fun `empty when no eligible bookings`() =
        runTest(dispatcher) {
            coEvery { repo.getMyBookings() } returns NetworkResult.Success(GetBookingsResponse(emptyList()))
            val model = vm()
            model.load(credit())
            advanceUntilIdle()
            assertTrue(model.state.value is UseCreditUiState.Empty)
        }

    @Test
    fun `apply success invokes the callback`() =
        runTest(dispatcher) {
            coEvery { repo.getMyBookings() } returns NetworkResult.Success(GetBookingsResponse(listOf(booking("b1"))))
            coEvery { repo.applyCredit(any(), "b1", "c1") } returns NetworkResult.Success(ApplyCreditResponse(ok = true, remaining = 2))
            val model = vm()
            model.load(credit())
            advanceUntilIdle()
            var applied = false
            model.apply(booking("b1")) { applied = true }
            advanceUntilIdle()
            coVerify { repo.applyCredit(any(), "b1", "c1") }
            assertTrue(applied)
        }

    @Test
    fun `409 ALREADY_APPLIED surfaces a conflict message`() =
        runTest(dispatcher) {
            coEvery { repo.getMyBookings() } returns NetworkResult.Success(GetBookingsResponse(listOf(booking("b1"))))
            coEvery { repo.applyCredit(any(), "b1", "c1") } returns
                NetworkResult.Failure(NetworkError.ClientError(409, """{"error":"ALREADY_APPLIED","message":"already"}"""))
            val model = vm()
            model.load(credit())
            advanceUntilIdle()
            model.apply(booking("b1")) { }
            advanceUntilIdle()
            assertNotNull(model.conflict.value)
            assertTrue(model.conflict.value!!.contains("already applied", ignoreCase = true))
        }
}
