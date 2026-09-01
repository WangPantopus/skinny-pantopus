@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.hub

import app.pantopus.android.data.api.models.businesses.BusinessTeamMembersResponse
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.BookingSummaryResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetAvailabilityResponse
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.models.scheduling.GetConnectedCalendarsResponse
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

@OptIn(ExperimentalCoroutinesApi::class)
class SchedulingHubViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: app.pantopus.android.data.scheduling.SchedulingRepository = mockk(relaxed = true)
    private val homes: HomesRepository = mockk()
    private val homeMembers: HomeMembersRepository = mockk()
    private val businessTeam: BusinessTeamRepository = mockk()
    private val auth: AuthRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedIn(user()))
        coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(homes = listOf(home("home-7")), message = null))
        coEvery { homeMembers.listOccupants(any()) } returns NetworkResult.Success(OccupantsResponse())
        coEvery { businessTeam.members(any()) } returns NetworkResult.Success(BusinessTeamMembersResponse())
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun user() = UserDto(id = "user-1", email = "a@b.com", displayName = "A", avatarUrl = null)

    private fun home(id: String) =
        MyHome(
            id = id, name = "Birch Ln", address = null, city = null, state = null, zipcode = null,
            homeType = null, visibility = null, description = null, createdAt = null, updatedAt = null,
            occupancy = null, ownershipStatus = null, verificationTier = null, isPrimaryOwner = null,
            pendingClaimId = null,
        )

    private fun page(
        slug: String? = "maria-k",
        paused: Boolean = false,
    ) = BookingPageResponse(BookingPageDto(id = "p1", slug = slug, isPaused = paused, timezone = "America/New_York"))

    private fun stubFetch(eventTypes: List<EventTypeDto>) {
        coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page())
        coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(eventTypes))
        coEvery { repo.getBookingsSummary(any()) } returns
            NetworkResult.Success(BookingSummaryResponse(bookingsThisMonth = 18, deltaPct = 24, upcomingCount = 5, noShowCount = 1))
        coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } returns NetworkResult.Success(GetBookingsResponse())
        coEvery { repo.getAvailability() } returns NetworkResult.Success(GetAvailabilityResponse())
        coEvery { repo.getConnectedCalendars() } returns NetworkResult.Success(GetConnectedCalendarsResponse())
    }

    private fun newVm() = SchedulingHubViewModel(repo, homes, homeMembers, businessTeam, auth, errors)

    private fun et(id: String) =
        EventTypeDto(id = id, name = "Intro call", slug = "intro", durations = listOf(30), defaultDuration = 30, locationMode = "video")

    private fun booking(
        id: String,
        startAt: String,
        hostUserId: String? = null,
    ) = BookingDto(
        id = id,
        eventTypeId = "e1",
        status = "confirmed",
        startAt = startAt,
        inviteeName = "Sam Lee",
        hostUserId = hostUserId,
    )

    @Test
    fun `empty page with no event types yields Empty state`() =
        runTest(dispatcher) {
            stubFetch(emptyList())
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is SchedulingHubUiState.Empty)
        }

    @Test
    fun `loaded with event types maps summary metrics`() =
        runTest(dispatcher) {
            stubFetch(listOf(et("e1")))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            val loaded = vm.state.value as SchedulingHubUiState.Loaded
            assertEquals(18, loaded.summary?.bookings)
            assertEquals(5, loaded.summary?.upcoming)
            assertEquals("pantopus.com/book/maria-k", loaded.handle)
        }

    @Test
    fun `selecting Home pillar resolves first home id`() =
        runTest(dispatcher) {
            stubFetch(listOf(et("e1")))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            vm.selectPillar(SchedulingPillar.Home)
            advanceUntilIdle()
            assertEquals(SchedulingPillar.Home, vm.pillar.value)
            coVerify { repo.getBookingPage(SchedulingOwner.Home("home-7")) }
        }

    @Test
    fun `selecting Business pillar resolves signed-in user id`() =
        runTest(dispatcher) {
            stubFetch(listOf(et("e1")))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            vm.selectPillar(SchedulingPillar.Business)
            advanceUntilIdle()
            coVerify { repo.getBookingPage(SchedulingOwner.Business("user-1")) }
        }

    @Test
    fun `agenda days past tomorrow render one full-date header with no sub`() =
        runTest(dispatcher) {
            stubFetch(listOf(et("e1")))
            val start = Instant.now().plus(5, ChronoUnit.DAYS)
            coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GetBookingsResponse(listOf(booking("b1", start.toString()))))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            val section = (vm.state.value as SchedulingHubUiState.Loaded).agenda.single()
            val expected =
                DateTimeFormatter
                    .ofPattern("EEE MMM d", Locale.US)
                    .format(start.atZone(ZoneId.of("America/New_York")))
            assertEquals(expected, section.header)
            assertEquals("", section.sub)
        }

    @Test
    fun `home pillar attributes agenda rows to the host member's first name`() =
        runTest(dispatcher) {
            stubFetch(listOf(et("e1")))
            coEvery { homeMembers.listOccupants("home-7") } returns
                NetworkResult.Success(
                    OccupantsResponse(occupants = listOf(OccupantDto(id = "o1", userId = "u-9", displayName = "John Smith"))),
                )
            coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GetBookingsResponse(listOf(booking("b1", Instant.now().toString(), hostUserId = "u-9"))))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            // Personal hubs never attribute a host.
            assertEquals(null, (vm.state.value as SchedulingHubUiState.Loaded).agenda.first().rows.first().hostName)
            vm.selectPillar(SchedulingPillar.Home)
            advanceUntilIdle()
            val row = (vm.state.value as SchedulingHubUiState.Loaded).agenda.first().rows.first()
            assertEquals("John", row.hostName)
        }

    @Test
    fun `summary retry refetches only the summary and clears the failure`() =
        runTest(dispatcher) {
            stubFetch(listOf(et("e1")))
            coEvery { repo.getBookingsSummary(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null)) andThen
                NetworkResult.Success(BookingSummaryResponse(bookingsThisMonth = 7, deltaPct = 0, upcomingCount = 2, noShowCount = 0))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            assertTrue((vm.state.value as SchedulingHubUiState.Loaded).summaryFailed)
            vm.retrySummary()
            advanceUntilIdle()
            val recovered = vm.state.value as SchedulingHubUiState.Loaded
            assertEquals(7, recovered.summary?.bookings)
            assertFalse(recovered.summaryFailed)
            assertFalse(recovered.summaryRetrying)
            // Retry must not reload the whole hub.
            coVerify(exactly = 1) { repo.getBookingPage(any()) }
        }

    @Test
    fun `pause toggle optimistically flips and persists`() =
        runTest(dispatcher) {
            stubFetch(listOf(et("e1")))
            coEvery { repo.updateBookingPage(any(), any()) } returns NetworkResult.Success(page(paused = true))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            vm.setPaused(true)
            advanceUntilIdle()
            assertTrue((vm.state.value as SchedulingHubUiState.Loaded).isPaused)
            coVerify { repo.updateBookingPage(SchedulingOwner.Personal, any()) }
        }

    @Test
    fun `startSetupRoute carries the flow and owner for non-personal pillars`() =
        runTest(dispatcher) {
            stubFetch(listOf(et("e1")))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            assertEquals("scheduling/setup", vm.startSetupRoute())

            vm.selectPillar(SchedulingPillar.Business)
            advanceUntilIdle()
            assertEquals("scheduling/onboarding?flow=business&ownerKind=business&ownerId=user-1", vm.startSetupRoute())

            vm.selectPillar(SchedulingPillar.Home)
            advanceUntilIdle()
            assertEquals("scheduling/onboarding?flow=home&ownerKind=home&ownerId=home-7", vm.startSetupRoute())
        }
}
