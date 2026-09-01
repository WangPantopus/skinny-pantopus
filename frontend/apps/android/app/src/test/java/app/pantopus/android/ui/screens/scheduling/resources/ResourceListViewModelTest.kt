@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.models.scheduling.GetResourcesResponse
import app.pantopus.android.data.api.models.scheduling.ResourceDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class ResourceListViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val homes: HomesRepository = mockk(relaxed = true)
    private val networkMonitor: NetworkMonitor = mockk()

    @Before fun setup() {
        Dispatchers.setMain(dispatcher)
        every { networkMonitor.isOnline } returns MutableStateFlow(true)
        val home = mockk<MyHome>(relaxed = true)
        every { home.id } returns "home-1"
        every { home.isPrimaryOwner } returns true
        coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(listOf(home), null))
        coEvery { repo.getBookings(any()) } returns NetworkResult.Success(GetBookingsResponse(emptyList()))
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(routeHomeId: String? = null) =
        ResourceListViewModel(
            repo,
            homes,
            networkMonitor,
            SavedStateHandle(
                buildMap {
                    routeHomeId?.let {
                        put(app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes.ARG_HOME_ID, it)
                    }
                },
            ),
        )

    @Test
    fun `no resources renders the empty state`() =
        runTest(dispatcher) {
            coEvery { repo.getResources(any()) } returns NetworkResult.Success(GetResourcesResponse(emptyList()))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertEquals(ResourceListUiState.Empty, model.state.value)
        }

    @Test
    fun `resources with no live booking read as free now`() =
        runTest(dispatcher) {
            coEvery { repo.getResources(any()) } returns
                NetworkResult.Success(GetResourcesResponse(listOf(ResourceDto(id = "r1", name = "EV charger", resourceType = "charger"))))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as ResourceListUiState.Loaded
            assertEquals(1, loaded.rows.size)
            assertTrue(loaded.rows[0].isFree)
            assertEquals("Free now", loaded.rows[0].statusLabel)
        }

    @Test
    fun `an active booking annotates the row as booked`() =
        runTest(dispatcher) {
            coEvery { repo.getResources(any()) } returns
                NetworkResult.Success(GetResourcesResponse(listOf(ResourceDto(id = "r1", name = "EV charger"))))
            coEvery { repo.getBookings(any()) } returns
                NetworkResult.Success(
                    GetBookingsResponse(
                        listOf(
                            BookingDto(
                                id = "b1",
                                resourceId = "r1",
                                status = "confirmed",
                                startAt = ResourceTime.utcIso(Instant.now().minusSeconds(1800)),
                                endAt = ResourceTime.utcIso(Instant.now().plusSeconds(1800)),
                            ),
                        ),
                    ),
                )
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as ResourceListUiState.Loaded
            assertTrue(!loaded.rows[0].isFree)
            assertTrue(loaded.rows[0].statusLabel.startsWith("Booked until"))
        }

    @Test
    fun `a failed read surfaces an error`() =
        runTest(dispatcher) {
            coEvery { repo.getResources(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is ResourceListUiState.Error)
        }

    @Test
    fun `route homeId pins the home and skips inference`() =
        runTest(dispatcher) {
            coEvery { repo.getResources(any()) } returns NetworkResult.Success(GetResourcesResponse(emptyList()))
            val model = vm(routeHomeId = "home-route")
            model.start()
            advanceUntilIdle()
            io.mockk.coVerify(exactly = 0) { homes.myHomes() }
            io.mockk.coVerify {
                repo.getResources(app.pantopus.android.data.scheduling.SchedulingOwner.Home("home-route"))
            }
        }
}
