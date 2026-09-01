@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

import app.pantopus.android.data.api.models.scheduling.OneOffBookingView
import app.pantopus.android.data.api.models.scheduling.PublicSlotsResponse
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusIcon
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.YearMonth
import java.time.ZoneId

@OptIn(ExperimentalCoroutinesApi::class)
class SlotPickerViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val ym = YearMonth.now(ZoneId.systemDefault())

    @Before
    fun setup() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun newVm() = SlotPickerViewModel(repo, errors)

    private fun slugArgs() =
        SlotPickerArgs(
            slug = "maria-k",
            oneOffToken = null,
            eventTypeSlug = "intro",
            eventTypeName = "Intro call",
            hostName = "Maria Kessler",
            durationMin = 30,
            locationIcon = PantopusIcon.Video,
            pageTimezone = "America/New_York",
            detectedTimezone = ZoneId.systemDefault().id,
            pillar = SchedulingPillar.Personal,
        )

    private fun oneOffArgs() = slugArgs().copy(slug = null, oneOffToken = "tok-123")

    private fun slot(
        day: Int,
        hour: Int,
    ): SlotDto {
        val local = "%sT%02d:00:00".format(ym.atDay(day), hour)
        return SlotDto(start = local + "Z", startLocal = local)
    }

    private fun content() = state() as SlotPickerUiState.Content

    private lateinit var vm: SlotPickerViewModel

    private fun state() = vm.state.value

    @Test
    fun `loads month and selects the earliest available day`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetSlots(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(PublicSlotsResponse(status = "active", slots = listOf(slot(2, 9), slot(2, 10), slot(5, 14))))
            vm = newVm()
            vm.start(slugArgs())
            advanceUntilIdle()
            val c = content()
            assertEquals(setOf(2, 5), c.availableDays)
            assertEquals(2, c.selectedDay)
            assertEquals(2, c.daySlots.size)
            assertFalse(c.slotsLoading)
            assertTrue(c.monthHasAvailability)
        }

    @Test
    fun `selecting a day swaps the rendered slots`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetSlots(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(PublicSlotsResponse(slots = listOf(slot(2, 9), slot(5, 14), slot(5, 15))))
            vm = newVm()
            vm.start(slugArgs())
            advanceUntilIdle()
            vm.selectDay(5)
            assertEquals(5, content().selectedDay)
            assertEquals(2, content().daySlots.size)
        }

    @Test
    fun `selecting a slot stores its UTC start and resolves the slot`() =
        runTest(dispatcher) {
            val chosen = slot(2, 9)
            coEvery { repo.publicGetSlots(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(PublicSlotsResponse(slots = listOf(chosen, slot(2, 10))))
            vm = newVm()
            vm.start(slugArgs())
            advanceUntilIdle()
            vm.selectSlot(chosen)
            assertEquals(chosen.start, content().selectedSlotStart)
            assertEquals(chosen.start, vm.selectedSlot()?.start)
        }

    @Test
    fun `changing the timezone re-fetches slots with the new tz`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetSlots(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(PublicSlotsResponse(slots = listOf(slot(2, 9))))
            vm = newVm()
            vm.start(slugArgs())
            advanceUntilIdle()
            vm.selectTimezone("Europe/London")
            advanceUntilIdle()
            assertEquals("Europe/London", content().tzId)
            coVerify { repo.publicGetSlots("maria-k", "intro", any(), any(), "Europe/London") }
        }

    @Test
    fun `paused page yields no availability without erroring`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetSlots(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(PublicSlotsResponse(status = "paused", slots = emptyList()))
            vm = newVm()
            vm.start(slugArgs())
            advanceUntilIdle()
            val c = content()
            assertFalse(c.monthHasAvailability)
            assertTrue(c.availableDays.isEmpty())
        }

    @Test
    fun `network failure surfaces a retryable error`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetSlots(any(), any(), any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Transport(RuntimeException("offline")))
            vm = newVm()
            vm.start(slugArgs())
            advanceUntilIdle()
            assertTrue(state() is SlotPickerUiState.Error)
        }

    @Test
    fun `one-off picker fetches slots via the one-off endpoint`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetOneOff("tok-123", any(), any(), any()) } returns
                NetworkResult.Success(OneOffBookingView(slots = listOf(slot(3, 11))))
            vm = newVm()
            vm.start(oneOffArgs())
            advanceUntilIdle()
            assertEquals(setOf(3), content().availableDays)
            coVerify { repo.publicGetOneOff("tok-123", any(), any(), any()) }
            assertNotNull(content().tzLabel)
        }
}
