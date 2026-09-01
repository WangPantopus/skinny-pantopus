@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.visits

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.models.homes.GetHomeEventsResponse
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.scheduling.resources.ResourceTime
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class VisitDetailViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val homes: HomesRepository = mockk(relaxed = true)
    private val members: HomeMembersRepository = mockk(relaxed = true)

    @Before fun setup() {
        Dispatchers.setMain(dispatcher)
        val home = mockk<MyHome>(relaxed = true)
        every { home.id } returns "home-1"
        every { home.isPrimaryOwner } returns true
        coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(listOf(home), null))
        coEvery { members.listOccupants(any()) } returns
            NetworkResult.Success(OccupantsResponse(listOf(OccupantDto(id = "o1", userId = "u1", displayName = "Dad"))))
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = VisitDetailViewModel(SavedStateHandle(mapOf("visitId" to "v1")), homes, members)

    @Test
    fun `an upcoming visit reads as confirmed with its host summary`() =
        runTest(dispatcher) {
            coEvery { homes.getHomeEvents(any()) } returns
                NetworkResult.Success(
                    GetHomeEventsResponse(
                        listOf(
                            CalendarEventDto(
                                id = "v1",
                                homeId = "home-1",
                                eventType = "vendor",
                                title = "Plumber visit",
                                startAt = ResourceTime.utcIso(Instant.now().plusSeconds(3600)),
                                endAt = ResourceTime.utcIso(Instant.now().plusSeconds(7200)),
                                locationNotes = "Front door code 4827",
                                assignedTo = listOf("u1"),
                            ),
                        ),
                    ),
                )
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as VisitDetailUiState.Loaded
            assertEquals(VisitLifecycle.Confirmed, loaded.lifecycle)
            assertEquals("Plumber visit", loaded.title)
            assertEquals("Dad must be home", loaded.hostSummary)
            assertEquals("Front door code 4827", loaded.entryNote)
        }

    @Test
    fun `a missing event resolves to the removed state`() =
        runTest(dispatcher) {
            coEvery { homes.getHomeEvents(any()) } returns NetworkResult.Success(GetHomeEventsResponse(emptyList()))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertEquals(VisitDetailUiState.Removed, model.state.value)
        }

    @Test
    fun `cancel deletes the home event`() =
        runTest(dispatcher) {
            coEvery { homes.getHomeEvents(any()) } returns
                NetworkResult.Success(
                    GetHomeEventsResponse(
                        listOf(
                            CalendarEventDto(
                                id = "v1",
                                homeId = "home-1",
                                eventType = "vendor",
                                title = "Plumber visit",
                                startAt = ResourceTime.utcIso(Instant.now().plusSeconds(3600)),
                                endAt = ResourceTime.utcIso(Instant.now().plusSeconds(7200)),
                            ),
                        ),
                    ),
                )
            coEvery { homes.deleteHomeEvent(any(), any()) } returns NetworkResult.Success(Unit)
            val model = vm()
            model.start()
            advanceUntilIdle()

            model.cancelVisit()
            advanceUntilIdle()

            // Runs in viewModelScope; the one-shot cancelled event is buffered
            // for the screen to dismiss on.
            assertEquals(Unit, model.cancelled.first())
            coVerify { homes.deleteHomeEvent("home-1", "v1") }
        }
}
