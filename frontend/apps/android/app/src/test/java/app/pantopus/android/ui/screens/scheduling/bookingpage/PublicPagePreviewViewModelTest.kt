@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.bookingpage

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.PublicBookingPageResponse
import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.data.api.models.scheduling.PublicPageView
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
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
class PublicPagePreviewViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(
        ownerKind: String? = null,
        ownerId: String? = null,
    ) = PublicPagePreviewViewModel(
        repo,
        errors,
        SavedStateHandle(
            buildMap {
                ownerKind?.let { put(SchedulingRoutes.ARG_OWNER_KIND, it) }
                ownerId?.let { put(SchedulingRoutes.ARG_OWNER_ID, it) }
            },
        ),
    )

    private fun hostPage(
        slug: String? = "maria-k",
        isLive: Boolean = true,
        isPaused: Boolean = false,
    ) = NetworkResult.Success(
        BookingPageResponse(BookingPageDto(id = "p", slug = slug, isLive = isLive, isPaused = isPaused, title = "Maria")),
    )

    @Test
    fun `unpublished page yields off notice`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns hostPage(isLive = false)
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertEquals("Your page is off", (vm.state.value as PreviewUiState.Notice).title)
        }

    @Test
    fun `live page with services renders`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns hostPage()
            coEvery { repo.publicGetPage("maria-k") } returns
                NetworkResult.Success(
                    PublicBookingPageResponse(
                        page = PublicPageView(title = "Maria", tagline = "Coaching"),
                        status = "active",
                        eventTypes = listOf(PublicEventTypeView(id = "e1", name = "Intro", defaultDuration = 30, locationMode = "video")),
                    ),
                )
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val rendered = vm.state.value as PreviewUiState.Rendered
            assertEquals("Maria", rendered.header.name)
            assertEquals(1, rendered.eventTypes.size)
        }

    @Test
    fun `paused public page yields paused notice`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns hostPage()
            coEvery { repo.publicGetPage("maria-k") } returns
                NetworkResult.Success(
                    PublicBookingPageResponse(page = PublicPageView(title = "Maria"), status = "paused", eventTypes = emptyList()),
                )
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertEquals("Your page is paused", (vm.state.value as PreviewUiState.Notice).title)
        }

    @Test
    fun `active page with no visible services yields all hidden`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns hostPage()
            coEvery { repo.publicGetPage("maria-k") } returns
                NetworkResult.Success(
                    PublicBookingPageResponse(page = PublicPageView(title = "Maria"), status = "active", eventTypes = emptyList()),
                )
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is PreviewUiState.AllHidden)
        }

    @Test
    fun `public not-found maps to paused notice`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns hostPage()
            coEvery { repo.publicGetPage("maria-k") } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is PreviewUiState.Notice)
        }

    @Test
    fun `host page failure yields error`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is PreviewUiState.Error)
        }

    @Test
    fun `route owner args scope the host page read to the business owner`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns hostPage(isLive = false)
            val vm = vm(ownerKind = "business", ownerId = "biz-1")
            vm.load()
            advanceUntilIdle()
            coVerify { repo.getBookingPage(SchedulingOwner.Business("biz-1")) }
        }
}
