@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.availability

import app.cash.turbine.test
import app.pantopus.android.data.api.models.scheduling.AvailabilityBlockDto
import app.pantopus.android.data.api.models.scheduling.BlockResponse
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.CreateBlockRequest
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
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
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class BlockOffTimeViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo = mockk<SchedulingRepository>(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = BlockOffTimeViewModel(repo, errors)

    private fun block() = AvailabilityBlockDto(id = "b1", startAt = "2026-06-18T14:00:00Z", endAt = "2026-06-18T15:00:00Z")

    @Test
    fun `save creates a one-off block from the form`() =
        runTest(dispatcher) {
            val captured = slot<CreateBlockRequest>()
            coEvery { repo.createBlock(capture(captured)) } returns NetworkResult.Success(BlockResponse(block()))
            val vm = vm()
            vm.setReason("Dentist")
            vm.events.test {
                vm.save()
                advanceUntilIdle()
                assertEquals(BlockOffEvent.Saved, awaitItem())
            }
            assertEquals("Dentist", captured.captured.title)
            assertNull(captured.captured.recurrenceRule)
            assertNotNull(captured.captured.startAt)
            assertNotNull(captured.captured.endAt)
        }

    @Test
    fun `save with weekly repeat attaches an RRULE`() =
        runTest(dispatcher) {
            val captured = slot<CreateBlockRequest>()
            coEvery { repo.createBlock(capture(captured)) } returns NetworkResult.Success(BlockResponse(block()))
            val vm = vm()
            vm.setRepeat(BlockRepeat.Weekly)
            vm.save()
            advanceUntilIdle()
            assertEquals("FREQ=WEEKLY", captured.captured.recurrenceRule)
        }

    @Test
    fun `blank reason saves a null title`() =
        runTest(dispatcher) {
            val captured = slot<CreateBlockRequest>()
            coEvery { repo.createBlock(capture(captured)) } returns NetworkResult.Success(BlockResponse(block()))
            val vm = vm()
            vm.save()
            advanceUntilIdle()
            assertNull(captured.captured.title)
        }

    @Test
    fun `an overlapping booking raises a conflict warning`() =
        runTest(dispatcher) {
            val today = LocalDate.now()
            val booking =
                BookingDto(
                    id = "bk1",
                    status = "confirmed",
                    startAt = toUtcIso(today, 14, 30),
                    endAt = toUtcIso(today, 15, 30),
                )
            coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GetBookingsResponse(listOf(booking)))
            val vm = vm()
            vm.setEnd("15:00")
            advanceUntilIdle()
            assertNotNull(vm.form.value.conflict)
            assertEquals("bk1", vm.form.value.conflict?.bookingId)
        }
}
