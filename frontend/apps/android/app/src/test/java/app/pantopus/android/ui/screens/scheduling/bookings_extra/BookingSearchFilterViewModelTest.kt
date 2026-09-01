@file:Suppress("PackageNaming", "ktlint:standard:max-line-length")
@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
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

class BookingSearchFilterViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo = mockk<SchedulingRepository>()
    private val homes = mockk<HomesRepository>(relaxed = true)
    private val auth = mockk<AuthRepository>(relaxed = true)

    private val bookings =
        listOf(
            BookingDto(id = "b1", status = "confirmed", inviteeName = "Ada", startAt = "2026-06-20T17:00:00Z"),
            BookingDto(id = "b2", status = "no_show", inviteeName = "Bo", startAt = "2026-06-19T17:00:00Z"),
        )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(emptyList()))
        coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } returns NetworkResult.Success(GetBookingsResponse(bookings))
        // The All scope fans out across resolvable pillars; no home/business by default.
        coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(homes = emptyList(), message = null))
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedOut)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun vm() = BookingSearchFilterViewModel(repo, homes, auth)

    @Test
    fun `start loads all bookings as rows`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val state = vm.results.value as BookingSearchUiState.Loaded
            assertEquals(2, state.rows.size)
        }

    @Test
    fun `the no-show status filter keeps only no_show rows`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.openFilter()
            vm.setStatus(BookingStatusFilter.NoShow)
            vm.applyFilters()
            advanceUntilIdle()
            val state = vm.results.value as BookingSearchUiState.Loaded
            assertEquals(1, state.rows.size)
            assertEquals("b2", state.rows.first().id)
        }

    @Test
    fun `empty bookings produce the empty state`() =
        runTest(dispatcher) {
            coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } returns NetworkResult.Success(GetBookingsResponse(emptyList()))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.results.value is BookingSearchUiState.Empty)
        }

    @Test
    fun `the All scope fans out to every resolvable owner and concatenates`() =
        runTest(dispatcher) {
            coEvery { homes.myHomes() } returns
                NetworkResult.Success(MyHomesResponse(homes = listOf(home("home-1")), message = null))
            coEvery { repo.getBookings(SchedulingOwner.Personal, any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GetBookingsResponse(bookings))
            coEvery { repo.getBookings(SchedulingOwner.Home("home-1"), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    GetBookingsResponse(
                        listOf(BookingDto(id = "b3", status = "confirmed", inviteeName = "Cy", startAt = "2026-06-21T17:00:00Z")),
                    ),
                )
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val state = vm.results.value as BookingSearchUiState.Loaded
            assertEquals(3, state.rows.size)
            assertTrue(state.rows.any { it.id == "b3" })
        }

    @Test
    fun `a partial fan-out failure still shows the successful scopes`() =
        runTest(dispatcher) {
            coEvery { homes.myHomes() } returns
                NetworkResult.Success(MyHomesResponse(homes = listOf(home("home-1")), message = null))
            coEvery { repo.getBookings(SchedulingOwner.Personal, any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GetBookingsResponse(bookings))
            coEvery { repo.getBookings(SchedulingOwner.Home("home-1"), any(), any(), any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val state = vm.results.value as BookingSearchUiState.Loaded
            assertEquals(2, state.rows.size)
        }

    private fun home(id: String) =
        MyHome(
            id = id, name = "Birch Ln", address = null, city = null, state = null, zipcode = null,
            homeType = null, visibility = null, description = null, createdAt = null, updatedAt = null,
            occupancy = null, ownershipStatus = null, verificationTier = null, isPrimaryOwner = null,
            pendingClaimId = null,
        )
}
