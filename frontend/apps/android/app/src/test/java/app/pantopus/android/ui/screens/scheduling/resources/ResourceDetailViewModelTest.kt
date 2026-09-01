@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.models.scheduling.GetResourcesResponse
import app.pantopus.android.data.api.models.scheduling.ResourceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
import io.mockk.every
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
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class ResourceDetailViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
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

    private fun vm() = ResourceDetailViewModel(SavedStateHandle(mapOf("resourceId" to "r1")), repo, homes, members)

    private fun futureBooking(
        id: String,
        status: String,
    ) = BookingDto(
        id = id,
        resourceId = "r1",
        status = status,
        startAt = ResourceTime.utcIso(Instant.now().plusSeconds(3600)),
        endAt = ResourceTime.utcIso(Instant.now().plusSeconds(7200)),
        inviteeName = "Dad",
        hostUserId = "u1",
    )

    @Test
    fun `groups this resource's confirmed bookings by day`() =
        runTest(dispatcher) {
            coEvery { repo.getResources(any()) } returns
                NetworkResult.Success(GetResourcesResponse(listOf(ResourceDto(id = "r1", name = "EV charger", maxDurationMin = 240))))
            coEvery { repo.getBookings(any()) } returns
                NetworkResult.Success(GetBookingsResponse(listOf(futureBooking("b1", "confirmed"))))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as ResourceDetailUiState.Loaded
            assertEquals(1, loaded.sections.sumOf { it.rows.size })
            assertTrue(loaded.approvals.isEmpty())
        }

    @Test
    fun `pending bookings populate the approval queue when approval is required`() =
        runTest(dispatcher) {
            coEvery { repo.getResources(any()) } returns
                NetworkResult.Success(GetResourcesResponse(listOf(ResourceDto(id = "r1", name = "EV charger", requiresApproval = true))))
            coEvery { repo.getBookings(any()) } returns
                NetworkResult.Success(GetBookingsResponse(listOf(futureBooking("b1", "pending"))))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as ResourceDetailUiState.Loaded
            assertEquals(1, loaded.approvals.size)
            assertEquals("Dad", loaded.approvals[0].who)
        }

    @Test
    fun `missing resource surfaces an error`() =
        runTest(dispatcher) {
            coEvery { repo.getResources(any()) } returns NetworkResult.Success(GetResourcesResponse(emptyList()))
            coEvery { repo.getBookings(any()) } returns NetworkResult.Success(GetBookingsResponse(emptyList()))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is ResourceDetailUiState.Error)
        }
}
