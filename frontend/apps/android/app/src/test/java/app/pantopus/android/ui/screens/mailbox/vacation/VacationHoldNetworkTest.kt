@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.vacation

import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.mailbox.v2.CancelVacationResponse
import app.pantopus.android.data.api.models.mailbox.v2.StartVacationRequest
import app.pantopus.android.data.api.models.mailbox.v2.StartVacationResponse
import app.pantopus.android.data.api.models.mailbox.v2.VacationHoldDto
import app.pantopus.android.data.api.models.mailbox.v2.VacationStatusResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A14.8 — coverage for the live Vacation Hold wiring (BLOCK 3E). `load()`
 * reads `GET /vacation/status`; Save resolves the primary home and POSTs
 * `/vacation/start`; End hold early POSTs `/vacation/cancel`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class VacationHoldNetworkTest {
    private val repository: MailboxRepository = mockk()
    private val homesRepository: HomesRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun holdDto(
        status: String,
        id: String = "hold_1",
    ) = VacationHoldDto(
        id = id,
        status = status,
        startDate = "2026-12-02",
        endDate = "2026-12-12",
        holdAction = "hold_in_vault",
        packageAction = "hold_at_carrier",
        itemsHeldCount = 3,
    )

    @Test
    fun load_withActiveHold_rendersActive() =
        runTest {
            coEvery { repository.vacationStatus() } returns
                NetworkResult.Success(VacationStatusResponse(active = holdDto("active"), upcoming = null))
            val vm = VacationHoldViewModel(repository, homesRepository)

            vm.load()

            val mode = vm.mode.value
            assertTrue(mode is VacationHoldMode.Active)
            assertEquals("Dec 12", (mode as VacationHoldMode.Active).hold.untilLabel)
        }

    @Test
    fun load_withoutActiveHold_rendersScheduling() =
        runTest {
            coEvery { repository.vacationStatus() } returns
                NetworkResult.Success(VacationStatusResponse(active = null, upcoming = null))
            val vm = VacationHoldViewModel(repository, homesRepository)

            vm.load()

            assertTrue(vm.mode.value is VacationHoldMode.Scheduling)
        }

    @Test
    fun save_resolvesHome_callsStart_andRendersActive() =
        runTest {
            val home = mockk<MyHome>()
            every { home.id } returns "home_1"
            val homesResponse = mockk<MyHomesResponse>()
            every { homesResponse.homes } returns listOf(home)
            coEvery { homesRepository.myHomes() } returns NetworkResult.Success(homesResponse)
            coEvery { repository.startVacation(any()) } returns
                NetworkResult.Success(StartVacationResponse(hold = holdDto("active")))
            val vm = VacationHoldViewModel(repository, homesRepository)

            // Initial mode is the scheduling composer; Save persists it.
            vm.tapTrailingAction()

            coVerify { repository.startVacation(match<StartVacationRequest> { it.homeId == "home_1" }) }
            assertTrue(vm.mode.value is VacationHoldMode.Active)
        }

    @Test
    fun endHoldEarly_callsCancel_andReturnsToScheduling() =
        runTest {
            coEvery { repository.vacationStatus() } returns
                NetworkResult.Success(VacationStatusResponse(active = holdDto("active", "hold_42"), upcoming = null))
            coEvery { repository.cancelVacation("hold_42") } returns
                NetworkResult.Success(CancelVacationResponse(message = "Vacation hold cancelled"))
            val vm = VacationHoldViewModel(repository, homesRepository)
            vm.load() // surfaces the active hold + records its id

            vm.endHoldEarly()

            coVerify { repository.cancelVacation("hold_42") }
            assertTrue(vm.mode.value is VacationHoldMode.Scheduling)
        }

    @Test
    fun edit_returnsToSchedulingWithoutCancelling() =
        runTest {
            coEvery { repository.vacationStatus() } returns
                NetworkResult.Success(VacationStatusResponse(active = holdDto("active", "hold_42"), upcoming = null))
            val vm = VacationHoldViewModel(repository, homesRepository)
            vm.load()

            vm.tapTrailingAction()

            coVerify(exactly = 0) { repository.cancelVacation(any()) }
            assertTrue(vm.mode.value is VacationHoldMode.Scheduling)
        }

    @Test
    fun edit_seedsComposerFromTheLiveHold() =
        runTest {
            coEvery { repository.vacationStatus() } returns
                NetworkResult.Success(VacationStatusResponse(active = holdDto("active", "hold_42"), upcoming = null))
            val vm = VacationHoldViewModel(repository, homesRepository)
            vm.load()

            vm.tapTrailingAction()

            val draft = (vm.mode.value as VacationHoldMode.Scheduling).draft
            assertEquals(java.time.LocalDate.parse("2026-12-02"), draft.fromDate)
            assertEquals(java.time.LocalDate.parse("2026-12-12"), draft.toDate)
        }

    @Test
    fun saveAfterEdit_cancelsTheOldHoldBeforeStartingTheNewOne() =
        runTest {
            val home = mockk<MyHome>()
            every { home.id } returns "home_1"
            val homesResponse = mockk<MyHomesResponse>()
            every { homesResponse.homes } returns listOf(home)
            coEvery { homesRepository.myHomes() } returns NetworkResult.Success(homesResponse)
            coEvery { repository.vacationStatus() } returns
                NetworkResult.Success(VacationStatusResponse(active = holdDto("active", "hold_42"), upcoming = null))
            coEvery { repository.cancelVacation("hold_42") } returns
                NetworkResult.Success(CancelVacationResponse(message = "Vacation hold cancelled"))
            coEvery { repository.startVacation(any()) } returns
                NetworkResult.Success(StartVacationResponse(hold = holdDto("active", "hold_43")))
            val vm = VacationHoldViewModel(repository, homesRepository)
            vm.load()

            vm.tapTrailingAction() // Edit → composer seeded from the live hold
            vm.tapTrailingAction() // Save → retire the old hold, then start

            coVerify(exactly = 1) { repository.cancelVacation("hold_42") }
            coVerify(exactly = 1) { repository.startVacation(any()) }
            assertTrue(vm.mode.value is VacationHoldMode.Active)
        }

    @Test
    fun saveAfterEdit_whenCancelFails_doesNotStartASecondHold() =
        runTest {
            val home = mockk<MyHome>()
            every { home.id } returns "home_1"
            val homesResponse = mockk<MyHomesResponse>()
            every { homesResponse.homes } returns listOf(home)
            coEvery { homesRepository.myHomes() } returns NetworkResult.Success(homesResponse)
            coEvery { repository.vacationStatus() } returns
                NetworkResult.Success(VacationStatusResponse(active = holdDto("active", "hold_42"), upcoming = null))
            coEvery { repository.cancelVacation("hold_42") } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = VacationHoldViewModel(repository, homesRepository)
            vm.load()

            vm.tapTrailingAction() // Edit
            vm.tapTrailingAction() // Save

            coVerify(exactly = 0) { repository.startVacation(any()) }
        }

    @Test
    fun load_failure_fallsBackToScheduling() =
        runTest {
            coEvery { repository.vacationStatus() } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = VacationHoldViewModel(repository, homesRepository)

            vm.load()

            assertTrue(vm.mode.value is VacationHoldMode.Scheduling)
        }
}
