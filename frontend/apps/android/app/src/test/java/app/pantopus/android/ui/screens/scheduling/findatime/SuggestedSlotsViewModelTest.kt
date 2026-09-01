@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.findatime

import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.models.homes.HomeEventResponse
import app.pantopus.android.data.api.models.scheduling.FindATimeResponse
import app.pantopus.android.data.api.models.scheduling.PollCreatedResponse
import app.pantopus.android.data.api.models.scheduling.PollDto
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SuggestedSlotsViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val homes: HomesRepository = mockk(relaxed = true)
    private val members: HomeMembersRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val session = FindATimeSession()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        session.criteria =
            FindATimeCriteria(
                homeId = "home-1",
                title = "Family call",
                members =
                    listOf(
                        FindMember("u-mom", "Mom"),
                        FindMember("u-dad", "Dad"),
                        FindMember("u-ava", "Ava"),
                    ),
                mode = FindMode.Collective,
                durationMin = 30,
                fromIso = "2026-06-15",
                toIso = "2026-06-21",
                windowLabel = "this week",
                timezone = "America/Los_Angeles",
            )
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = SuggestedSlotsViewModel(repo, homes, members, errors, session)

    private fun slot(
        hour: Int,
        eligible: List<String>? = listOf("u-mom", "u-dad", "u-ava"),
    ) = SlotDto(
        start = "2026-06-22T%02d:00:00Z".format(hour),
        end = "2026-06-22T%02d:00:00Z".format(hour + 1),
        startLocal = "2026-06-22T%02d:00:00".format(hour),
        eligibleHosts = eligible,
    )

    @Test
    fun results_marks_first_slot_best() =
        runTest(dispatcher) {
            coEvery { repo.findATime(any(), any(), any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(FindATimeResponse(slots = listOf(slot(14), slot(18))))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val loaded = vm.state.value as SuggestedSlotsUiState.Loaded
            assertEquals(2, loaded.slots.size)
            assertTrue(loaded.slots.first().isBest)
            assertEquals("All 3 free", loaded.slots.first().freeLabel)
            assertEquals(loaded.slots.first().start, loaded.expandedStart)
        }

    @Test
    fun empty_slots_show_no_overlap() =
        runTest(dispatcher) {
            coEvery { repo.findATime(any(), any(), any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(FindATimeResponse(slots = emptyList()))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is SuggestedSlotsUiState.Empty)
            // The verdict is recorded for F4's no-overlap banner + quick fixes.
            assertEquals("Try making Mom optional, or widen the date window.", session.noOverlapMessage)
        }

    @Test
    fun failure_surfaces_error() =
        runTest(dispatcher) {
            coEvery { repo.findATime(any(), any(), any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is SuggestedSlotsUiState.Error)
        }

    @Test
    fun round_robin_labels_assignee() =
        runTest(dispatcher) {
            session.criteria = session.criteria!!.copy(mode = FindMode.RoundRobin)
            coEvery { repo.findATime(any(), any(), any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(FindATimeResponse(slots = listOf(slot(14, eligible = listOf("u-dad")))))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val loaded = vm.state.value as SuggestedSlotsUiState.Loaded
            assertEquals("Dad", loaded.slots.first().assigneeName)
            assertEquals("1 of 3 free", loaded.slots.first().freeLabel)
        }

    @Test
    fun book_slot_creates_home_event() =
        runTest(dispatcher) {
            coEvery { repo.findATime(any(), any(), any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(FindATimeResponse(slots = listOf(slot(14))))
            coEvery { homes.createHomeEvent(any(), any()) } returns NetworkResult.Success(HomeEventResponse(event()))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val start = (vm.state.value as SuggestedSlotsUiState.Loaded).slots.first().start
            vm.bookSlot(start)
            advanceUntilIdle()
            assertTrue(vm.state.value is SuggestedSlotsUiState.Booked)
            coVerify { homes.createHomeEvent(eq("home-1"), any()) }
        }

    @Test
    fun send_proposal_creates_poll() =
        runTest(dispatcher) {
            coEvery { repo.findATime(any(), any(), any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(FindATimeResponse(slots = listOf(slot(14), slot(18))))
            coEvery { repo.createPoll(any(), any()) } returns
                NetworkResult.Success(PollCreatedResponse(poll = PollDto(id = "poll-9"), options = emptyList()))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.sendProposal()
            advanceUntilIdle()
            val sent = vm.state.value as SuggestedSlotsUiState.Sent
            assertEquals("poll-9", sent.pollId)
            assertEquals(3, sent.peopleCount)
        }

    private fun event() =
        CalendarEventDto(
            id = "evt-1",
            homeId = "home-1",
            eventType = "family",
            title = "Family call",
            startAt = "2026-06-22T14:00:00Z",
        )
}
