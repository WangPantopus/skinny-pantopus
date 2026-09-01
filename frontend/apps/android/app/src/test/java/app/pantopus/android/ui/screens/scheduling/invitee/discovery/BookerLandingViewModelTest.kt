@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.OneOffBookingView
import app.pantopus.android.data.api.models.scheduling.PublicBookingPageResponse
import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.data.api.models.scheduling.PublicPageView
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTerminalState
import com.squareup.moshi.Moshi
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
class BookerLandingViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before
    fun setup() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vmForSlug(slug: String = "maria-k") =
        BookerLandingViewModel(repo, errors, SavedStateHandle(mapOf(SchedulingRoutes.ARG_SLUG to slug)))

    private fun vmForOneOff(token: String = "tok-123") =
        BookerLandingViewModel(repo, errors, SavedStateHandle(mapOf(SchedulingRoutes.ARG_ONEOFF_TOKEN to token)))

    private fun eventType(slug: String = "intro") =
        PublicEventTypeView(
            id = "e1",
            name = "Intro call",
            slug = slug,
            durations = listOf(30),
            defaultDuration = 30,
            locationMode = "video",
        )

    private fun page(
        status: String = "active",
        ownerType: String? = "personal",
        types: List<PublicEventTypeView> = listOf(eventType()),
    ) = PublicBookingPageResponse(
        page =
            PublicPageView(
                slug = "maria-k",
                title = "Maria Kessler",
                tagline = "Coaching",
                ownerType = ownerType,
                timezone = "America/New_York",
            ),
        status = status,
        eventTypes = types,
    )

    @Test
    fun `active page loads landing with event types and pillar`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPage("maria-k") } returns NetworkResult.Success(page())
            val vm = vmForSlug()
            vm.start()
            advanceUntilIdle()
            val loaded = vm.state.value as BookerLandingUiState.Landing
            assertEquals("Maria Kessler", loaded.hostName)
            assertEquals(SchedulingPillar.Personal, loaded.pillar)
            assertEquals(1, loaded.eventTypes.size)
            assertEquals("https://pantopus.com/book/maria-k", loaded.shareUrl)
            assertTrue(!loaded.isPaused)
        }

    @Test
    fun `business owner type maps to business pillar`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPage(any()) } returns NetworkResult.Success(page(ownerType = "business"))
            val vm = vmForSlug()
            vm.start()
            advanceUntilIdle()
            assertEquals(SchedulingPillar.Business, (vm.state.value as BookerLandingUiState.Landing).pillar)
        }

    @Test
    fun `paused status yields a paused landing (not an error)`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPage(any()) } returns NetworkResult.Success(page(status = "paused"))
            val vm = vmForSlug()
            vm.start()
            advanceUntilIdle()
            assertTrue((vm.state.value as BookerLandingUiState.Landing).isPaused)
        }

    @Test
    fun `empty event types still render the landing`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPage(any()) } returns NetworkResult.Success(page(types = emptyList()))
            val vm = vmForSlug()
            vm.start()
            advanceUntilIdle()
            assertTrue((vm.state.value as BookerLandingUiState.Landing).eventTypes.isEmpty())
        }

    @Test
    fun `404 on a page resolves to the unavailable terminal state`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPage(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = vmForSlug()
            vm.start()
            advanceUntilIdle()
            assertEquals(SchedulingTerminalState.Unavailable, (vm.state.value as BookerLandingUiState.Terminal).state)
        }

    @Test
    fun `403 on a page resolves to the secret terminal state`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPage(any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
            val vm = vmForSlug()
            vm.start()
            advanceUntilIdle()
            assertEquals(SchedulingTerminalState.Secret, (vm.state.value as BookerLandingUiState.Terminal).state)
        }

    @Test
    fun `transport failure yields a retryable error state`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPage(any()) } returns NetworkResult.Failure(NetworkError.Transport(RuntimeException("offline")))
            val vm = vmForSlug()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is BookerLandingUiState.Error)
        }

    @Test
    fun `one-off link goes straight to the picker`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetOneOff("tok-123", any(), any(), any()) } returns
                NetworkResult.Success(OneOffBookingView(eventType = eventType(), singleUse = true))
            val vm = vmForOneOff()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is BookerLandingUiState.DirectPicker)
        }

    @Test
    fun `expired one-off (404) resolves to the expired terminal state`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetOneOff(any(), any(), any(), any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = vmForOneOff()
            vm.start()
            advanceUntilIdle()
            assertEquals(SchedulingTerminalState.Expired, (vm.state.value as BookerLandingUiState.Terminal).state)
        }

    @Test
    fun `pickerArgs carry slug + event type + tz`() =
        runTest(dispatcher) {
            coEvery { repo.publicGetPage(any()) } returns NetworkResult.Success(page())
            val vm = vmForSlug()
            vm.start()
            advanceUntilIdle()
            val landing = vm.state.value as BookerLandingUiState.Landing
            val args = vm.pickerArgsFor(landing.eventTypes.first(), landing)
            assertEquals("maria-k", args.slug)
            assertEquals("intro", args.eventTypeSlug)
            assertEquals(vm.detectedTimezone, args.detectedTimezone)
        }
}
