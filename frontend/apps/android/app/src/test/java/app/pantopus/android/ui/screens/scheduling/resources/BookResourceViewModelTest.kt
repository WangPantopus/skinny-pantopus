@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.scheduling.BookResourceResponse
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.models.scheduling.GetResourcesResponse
import app.pantopus.android.data.api.models.scheduling.ResourceBookingDto
import app.pantopus.android.data.api.models.scheduling.ResourceDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import com.squareup.moshi.Moshi
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BookResourceViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val homes: HomesRepository = mockk(relaxed = true)
    private val members: HomeMembersRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() {
        Dispatchers.setMain(dispatcher)
        val home = mockk<MyHome>(relaxed = true)
        every { home.id } returns "home-1"
        every { home.isPrimaryOwner } returns true
        coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(listOf(home), null))
        coEvery { members.listOccupants(any()) } returns
            NetworkResult.Success(OccupantsResponse(listOf(OccupantDto(id = "o1", userId = "u1", displayName = "Dad"))))
        coEvery { repo.getBookings(any()) } returns NetworkResult.Success(GetBookingsResponse(emptyList()))
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun stubResource(maxDurationMin: Int? = 240) {
        coEvery { repo.getResources(any()) } returns
            NetworkResult.Success(
                GetResourcesResponse(
                    listOf(ResourceDto(id = "r1", name = "EV charger", resourceType = "charger", maxDurationMin = maxDurationMin)),
                ),
            )
    }

    private fun vm() = BookResourceViewModel(SavedStateHandle(mapOf("resourceId" to "r1")), repo, homes, members, errors)

    @Test
    fun `loads into the form with a default member`() =
        runTest(dispatcher) {
            stubResource()
            val model = vm()
            model.start()
            advanceUntilIdle()
            val form = model.state.value as BookResourceUiState.Form
            assertEquals("EV charger", form.resourceName)
            assertEquals("Dad", form.forWhom?.name)
        }

    @Test
    fun `tapping a free hour makes the slot submittable`() =
        runTest(dispatcher) {
            stubResource()
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.tap(9)
            val form = model.state.value as BookResourceUiState.Form
            assertEquals(BookCellState.Selected, form.cells[9])
            assertEquals(BookStatusTone.Ok, form.statusLine?.tone)
            assertTrue(form.canSubmit)
        }

    @Test
    fun `exceeding the max duration warns and blocks submit`() =
        runTest(dispatcher) {
            stubResource(maxDurationMin = 60)
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.tap(9)
            model.tap(10) // 2 hours > 1 hr max
            val form = model.state.value as BookResourceUiState.Form
            assertEquals(BookStatusTone.Warning, form.statusLine?.tone)
            assertFalse(form.canSubmit)
        }

    @Test
    fun `409 slot conflict surfaces the alternatives sheet`() =
        runTest(dispatcher) {
            stubResource()
            coEvery { repo.bookResource(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.ClientError(409, "{\"error\":\"SLOT_CONFLICT\"}"))
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.tap(9)
            model.submit()
            advanceUntilIdle()
            assertNotNull(model.slotConflict.value)
        }

    @Test
    fun `resource unavailable also routes to the conflict sheet`() =
        runTest(dispatcher) {
            stubResource()
            coEvery { repo.bookResource(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.ClientError(409, "{\"error\":\"RESOURCE_UNAVAILABLE\"}"))
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.tap(9)
            model.submit()
            advanceUntilIdle()
            assertNotNull(model.slotConflict.value)
        }

    @Test
    fun `successful booking resolves to the confirmed success state`() =
        runTest(dispatcher) {
            stubResource()
            coEvery { repo.bookResource(any(), any(), any()) } returns
                NetworkResult.Success(BookResourceResponse(ResourceBookingDto(id = "b1", status = "confirmed")))
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.tap(9)
            model.submit()
            advanceUntilIdle()
            val success = model.state.value as BookResourceUiState.Success
            assertFalse(success.approval)
        }
}
