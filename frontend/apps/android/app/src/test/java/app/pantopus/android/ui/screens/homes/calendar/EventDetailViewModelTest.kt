@file:Suppress(
    "MagicNumber",
    "PackageNaming",
    "LongMethod",
    "MaxLineLength",
)

package app.pantopus.android.ui.screens.homes.calendar

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.models.homes.HomeEventAttendeeDto
import app.pantopus.android.data.api.models.homes.HomeEventDetailResponse
import app.pantopus.android.data.api.models.homes.HomeEventRsvpResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Covers the F2 Event Detail + RSVP VM (A10): detail-endpoint hydration,
 * attendee name lookup, optimistic RSVP upsert + revert, and delete.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class EventDetailViewModelTest {
    private val repo: HomesRepository = mockk()
    private val membersRepo: HomeMembersRepository = mockk()
    private val authRepository: AuthRepository = mockk()
    private val networkMonitor: NetworkMonitor = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        val user = mockk<UserDto>()
        every { user.id } returns "u1"
        every { authRepository.state } returns MutableStateFlow<AuthRepository.State>(AuthRepository.State.SignedIn(user))
        every { networkMonitor.isOnline } returns MutableStateFlow(true)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): EventDetailViewModel =
        EventDetailViewModel(
            repo = repo,
            membersRepo = membersRepo,
            authRepository = authRepository,
            networkMonitor = networkMonitor,
            savedStateHandle =
                SavedStateHandle(
                    mapOf(
                        EVENT_DETAIL_HOME_ID_KEY to "home-1",
                        EVENT_DETAIL_EVENT_ID_KEY to "e1",
                    ),
                ),
        )

    private fun event(requestRsvp: Boolean = true): CalendarEventDto =
        CalendarEventDto(
            id = "e1",
            homeId = "home-1",
            eventType = "social",
            title = "Family dinner",
            description = "Bring water",
            startAt = "2025-10-12T18:30:00Z",
            assignedTo = listOf("u1", "u3"),
            requestRsvp = requestRsvp,
        )

    private fun stubDetail(
        attendees: List<HomeEventAttendeeDto> = emptyList(),
        requestRsvp: Boolean = true,
    ) {
        coEvery { repo.getHomeEvent("home-1", "e1") } returns
            NetworkResult.Success(HomeEventDetailResponse(event = event(requestRsvp), attendees = attendees))
        coEvery { membersRepo.listOccupants("home-1") } returns
            NetworkResult.Success(
                OccupantsResponse(
                    occupants =
                        listOf(
                            OccupantDto(id = "o1", userId = "u1", isActive = true, displayName = "Maria Patel"),
                            OccupantDto(id = "o3", userId = "u3", isActive = true, displayName = "Ava Patel"),
                        ),
                    pendingInvites = emptyList(),
                ),
            )
    }

    @Test fun initial_state_is_loading() {
        stubDetail()
        val vm = makeVm()
        assertTrue(vm.state.value is EventDetailUiState.Loading)
    }

    @Test fun load_hydrates_event_attendees_and_names() =
        runTest {
            stubDetail(attendees = listOf(HomeEventAttendeeDto(userId = "u3", rsvpStatus = "going")))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as EventDetailUiState.Loaded
            assertEquals("Family dinner", loaded.event.title)
            assertEquals("Maria Patel", loaded.attendeeNames["u1"])
            assertEquals(HomeRsvpChoice.Going, loaded.rsvpFor("u3"))
            assertEquals(HomeRsvpChoice.NoReply, loaded.rsvpFor("u1"))
            assertNull(loaded.myRsvp)
        }

    @Test fun load_failure_renders_error() =
        runTest {
            coEvery { repo.getHomeEvent(any(), any()) } returns NetworkResult.Failure(NetworkError.Server(500, "boom"))
            coEvery { membersRepo.listOccupants(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is EventDetailUiState.Error)
        }

    @Test fun set_rsvp_optimistically_records_choice() =
        runTest {
            stubDetail()
            coEvery { repo.rsvpHomeEvent("home-1", "e1", "going") } returns
                NetworkResult.Success(HomeEventRsvpResponse(HomeEventAttendeeDto(userId = "u1", rsvpStatus = "going")))
            val vm = makeVm()
            vm.load()
            vm.setRsvp(HomeRsvpChoice.Going)
            val loaded = vm.state.value as EventDetailUiState.Loaded
            assertEquals(HomeRsvpChoice.Going, loaded.myRsvp)
            assertTrue(!loaded.rsvpSaving)
        }

    @Test fun set_rsvp_reverts_on_failure() =
        runTest {
            stubDetail()
            coEvery { repo.rsvpHomeEvent("home-1", "e1", "going") } returns
                NetworkResult.Failure(NetworkError.Server(500, "nope"))
            val vm = makeVm()
            vm.load()
            vm.setRsvp(HomeRsvpChoice.Going)
            val loaded = vm.state.value as EventDetailUiState.Loaded
            assertNull(loaded.myRsvp)
            assertTrue(!loaded.rsvpSaving)
        }

    @Test fun delete_success_invokes_callback() =
        runTest {
            stubDetail()
            coEvery { repo.deleteHomeEvent("home-1", "e1") } returns NetworkResult.Success(Unit)
            var fired = false
            val vm = makeVm()
            vm.configure(onDeleted = { fired = true })
            vm.load()
            vm.delete()
            assertTrue(fired)
        }

    @Test fun delete_failure_records_error_and_preserves_state() =
        runTest {
            stubDetail()
            coEvery { repo.deleteHomeEvent("home-1", "e1") } returns NetworkResult.Failure(NetworkError.Server(500, "nope"))
            val vm = makeVm()
            vm.load()
            vm.delete()
            val loaded = vm.state.value as EventDetailUiState.Loaded
            assertNotNull(loaded.deleteError)
        }

    @Test fun replace_loaded_swaps_in_place() =
        runTest {
            stubDetail()
            val vm = makeVm()
            vm.load()
            vm.replaceLoaded(event().copy(title = "Renamed"))
            val loaded = vm.state.value as EventDetailUiState.Loaded
            assertEquals("Renamed", loaded.event.title)
        }
}
