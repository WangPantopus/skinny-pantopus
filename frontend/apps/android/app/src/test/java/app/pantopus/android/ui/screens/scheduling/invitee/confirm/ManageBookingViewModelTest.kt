@file:Suppress("PackageNaming", "ktlint:standard:max-line-length")

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.AvailableSlotsResponse
import app.pantopus.android.data.api.models.scheduling.ManageActions
import app.pantopus.android.data.api.models.scheduling.ManageBookingDetail
import app.pantopus.android.data.api.models.scheduling.ManageBookingResponse
import app.pantopus.android.data.api.models.scheduling.PublicBookingMutationResponse
import app.pantopus.android.data.api.models.scheduling.PublicBookingRef
import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.data.api.models.scheduling.PublicPageView
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ManageBookingViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors: SchedulingErrorDecoder = mockk()

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(token: String = "tok") =
        ManageBookingViewModel(repo, errors, SavedStateHandle(mapOf(SchedulingRoutes.ARG_MANAGE_TOKEN to token)))

    private fun manageResponse(
        status: String,
        canReschedule: Boolean = true,
        canCancel: Boolean = true,
    ) = ManageBookingResponse(
        booking =
            ManageBookingDetail(
                id = "b1",
                status = status,
                startAt = "2999-01-01T17:30:00Z",
                endAt = "2999-01-01T18:00:00Z",
                inviteeName = "Maya Chen",
                inviteeTimezone = "America/Los_Angeles",
                locationMode = "video",
            ),
        actions =
            ManageActions(
                canCancel = canCancel,
                canReschedule = canReschedule,
                inviteeCancelAllowed = true,
                inviteeRescheduleAllowed = true,
            ),
        payment = null,
        eventType = PublicEventTypeView(id = "et1", name = "Intro call", locationMode = "video"),
        page =
            PublicPageView(
                slug = "maria",
                title = "Maria Kessler",
                ownerType = "user",
                cancellationPolicy = "Free cancellation up to 24h before.",
            ),
    )

    @Test
    fun `loads a confirmed booking with both actions live`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("tok") } returns NetworkResult.Success(manageResponse("confirmed"))
            val vm = vm()
            vm.start()
            advanceUntilIdle()

            val loaded = vm.state.value as ManageBookingUiState.Loaded
            assertEquals(ManageStatus.Confirmed, loaded.data.status)
            assertTrue(loaded.data.canReschedule)
            assertTrue(loaded.data.canCancel)
            assertEquals("Intro call", loaded.data.eventName)
        }

    @Test
    fun `window closed when active but neither action allowed`() =
        runTest(dispatcher) {
            coEvery {
                repo.publicGetManageBooking("tok")
            } returns NetworkResult.Success(manageResponse("confirmed", canReschedule = false, canCancel = false))
            val vm = vm()
            vm.start()
            advanceUntilIdle()

            val loaded = vm.state.value as ManageBookingUiState.Loaded
            assertTrue(loaded.data.windowClosed)
        }

    @Test
    fun `an invalid token surfaces the expired state`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            every { errors.decode(any(), any()) } returns SchedulingError.Expired
            val vm = vm()
            vm.start()
            advanceUntilIdle()

            assertEquals(ManageBookingUiState.Expired, vm.state.value)
        }

    @Test
    fun `reschedule conflict routes into the alternatives sheet`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("tok") } returns NetworkResult.Success(manageResponse("confirmed"))
            coEvery { repo.publicGetManageSlots(any(), any(), any(), any()) } returns
                NetworkResult.Success(AvailableSlotsResponse(slots = listOf(SlotDto(start = "2999-01-02T17:30:00Z", end = "2999-01-02T18:00:00Z"))))
            coEvery { repo.publicReschedule("tok", any()) } returns NetworkResult.Failure(NetworkError.ClientError(409, "{}"))
            every { errors.decode(any()) } returns
                SchedulingError.Conflict("SLOT_TAKEN", listOf(SlotDto(start = "2999-01-03T17:30:00Z", end = "2999-01-03T18:00:00Z")))

            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.openReschedule()
            advanceUntilIdle()
            vm.confirmReschedule("2999-01-02T17:30:00Z")
            advanceUntilIdle()

            assertNotNull(vm.reschedule.value?.conflict)
            assertEquals(1, vm.reschedule.value?.conflict?.alternatives?.size)
        }

    @Test
    fun `cancel succeeds and refetches the now-cancelled booking`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("tok") } returnsMany
                listOf(NetworkResult.Success(manageResponse("confirmed")), NetworkResult.Success(manageResponse("cancelled", canReschedule = false, canCancel = false)))
            coEvery { repo.publicCancel("tok", any()) } returns
                NetworkResult.Success(PublicBookingMutationResponse(PublicBookingRef(id = "b1", status = "cancelled")))

            val vm = vm()
            vm.start()
            advanceUntilIdle()
            vm.openCancel()
            vm.confirmCancel("Plans changed")
            advanceUntilIdle()

            assertNull(vm.cancel.value)
            val loaded = vm.state.value as ManageBookingUiState.Loaded
            assertEquals(ManageStatus.Cancelled, loaded.data.status)
        }
}
