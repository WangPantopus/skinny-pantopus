@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import app.pantopus.android.data.api.models.scheduling.ManageBookingDetail
import app.pantopus.android.data.api.models.scheduling.ManageBookingResponse
import app.pantopus.android.data.api.models.scheduling.OneOffBookingView
import app.pantopus.android.data.api.models.scheduling.PublicBookingPageResponse
import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.data.api.models.scheduling.PublicPageView
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
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
class OpenInAppViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)

    @Before
    fun setup() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = OpenInAppViewModel(repo)

    @Test
    fun resolves_page_link_into_booking_route() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPage("maria-k") } returns
                NetworkResult.Success(
                    PublicBookingPageResponse(
                        page = PublicPageView(title = "Maria"),
                        eventTypes = listOf(PublicEventTypeView(name = "Intro call", defaultDuration = 30)),
                    ),
                )
            val vm = vm()
            vm.resolve("pantopus://book/maria-k")
            advanceUntilIdle()
            val resolved = vm.state.value as OpenInAppViewModel.OpenInAppUiState.Resolved
            assertEquals("book/maria-k", resolved.targetRoute)
        }

    @Test
    fun resolves_one_off_link() =
        runTest(dispatcher) {
            coEvery { repo.publicGetOneOff("tok", null, null, null) } returns
                NetworkResult.Success(OneOffBookingView(eventType = PublicEventTypeView(name = "Quote visit", defaultDuration = 45)))
            val vm = vm()
            vm.resolve("pantopus://book/o/tok")
            advanceUntilIdle()
            val resolved = vm.state.value as OpenInAppViewModel.OpenInAppUiState.Resolved
            assertEquals("book/o/tok", resolved.targetRoute)
        }

    @Test
    fun resolves_manage_link_from_https() =
        runTest(dispatcher) {
            coEvery { repo.publicGetManageBooking("tok2") } returns
                NetworkResult.Success(
                    ManageBookingResponse(
                        booking = ManageBookingDetail(id = "bk", status = "confirmed"),
                        eventType = PublicEventTypeView(name = "Consult"),
                        page = PublicPageView(title = "Dr. Lee"),
                    ),
                )
            val vm = vm()
            vm.resolve("https://pantopus.app/booking/tok2")
            advanceUntilIdle()
            val resolved = vm.state.value as OpenInAppViewModel.OpenInAppUiState.Resolved
            assertEquals("booking/tok2", resolved.targetRoute)
        }

    @Test
    fun failed_when_no_link() =
        runTest(dispatcher) {
            val vm = vm()
            vm.resolve(null)
            advanceUntilIdle()
            assertTrue(vm.state.value is OpenInAppViewModel.OpenInAppUiState.Failed)
        }

    @Test
    fun failed_when_page_fetch_fails() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPage("bad") } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = vm()
            vm.resolve("pantopus://book/bad")
            advanceUntilIdle()
            assertTrue(vm.state.value is OpenInAppViewModel.OpenInAppUiState.Failed)
        }
}
