@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.bookingpage

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BookingPageManageViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(
        ownerKind: String? = null,
        ownerId: String? = null,
    ) = BookingPageManageViewModel(
        repo,
        errors,
        SavedStateHandle(
            buildMap {
                ownerKind?.let { put(SchedulingRoutes.ARG_OWNER_KIND, it) }
                ownerId?.let { put(SchedulingRoutes.ARG_OWNER_ID, it) }
            },
        ),
    )

    private fun page(
        slug: String = "maria-k",
        isLive: Boolean = true,
        isPaused: Boolean = false,
    ) = BookingPageResponse(
        BookingPageDto(id = "p", slug = slug, isLive = isLive, isPaused = isPaused, title = "Maria", visibility = "listed"),
    )

    private fun service(visible: Boolean = true) =
        GetEventTypesResponse(
            listOf(
                EventTypeDto(
                    id = "e1",
                    name = "Intro call",
                    slug = "intro",
                    durations = listOf(30),
                    defaultDuration = 30,
                    locationMode = "video",
                    visibility = if (visible) "public" else "secret",
                ),
            ),
        )

    @Test
    fun `load yields Loaded with form`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page())
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(service())
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val loaded = vm.state.value as BookingPageManageUiState.Loaded
            assertEquals("maria-k", loaded.form.slug)
            assertEquals(PageStatus.Live, loaded.form.status)
            assertEquals(1, loaded.form.services.size)
        }

    @Test
    fun `day-one with no services and not live yields NeedsSetup`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page(slug = "", isLive = false))
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(emptyList()))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is BookingPageManageUiState.NeedsSetup)
        }

    @Test
    fun `event-types failure yields Error not NeedsSetup`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page(slug = "", isLive = false))
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is BookingPageManageUiState.Error)
        }

    @Test
    fun `booking page failure yields Error`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is BookingPageManageUiState.Error)
        }

    @Test
    fun `toggle status flips live to paused`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page())
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(service())
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.toggleStatus()
            assertEquals(PageStatus.Paused, (vm.state.value as BookingPageManageUiState.Loaded).form.status)
            assertTrue(vm.canSave())
        }

    @Test
    fun `slug check surfaces taken with suggestions`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page())
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(service())
            coEvery { repo.checkSlug(any(), any()) } returns
                NetworkResult.Success(
                    app.pantopus.android.data.api.models.scheduling.CheckSlugResponse(available = false, suggestions = listOf("maria-co")),
                )
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.setSlug("taken")
            advanceUntilIdle()
            assertTrue(vm.slugCheck.value.taken)
            assertEquals(listOf("maria-co"), vm.slugCheck.value.suggestions)
            assertFalse(vm.canSave())
        }

    @Test
    fun `save persists page and service changes`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page())
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(service(visible = true))
            coEvery { repo.updateBookingPage(any(), any()) } returns NetworkResult.Success(page())
            coEvery { repo.updateEventType(any(), any(), any()) } returns
                NetworkResult.Success(app.pantopus.android.data.api.models.scheduling.EventTypeResponse(service().eventTypes.first()))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.setTitle("Maria Kessler")
            vm.toggleService("e1")
            assertTrue(vm.canSave())
            vm.save()
            advanceUntilIdle()
            coVerify { repo.updateBookingPage(SchedulingOwner.Personal, any()) }
            coVerify { repo.updateEventType(SchedulingOwner.Personal, "e1", any()) }
        }

    @Test
    fun `save with slug conflict blocks page write and surfaces suggestions`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page())
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(service())
            coEvery { repo.checkSlug(any(), any()) } returns
                NetworkResult.Success(app.pantopus.android.data.api.models.scheduling.CheckSlugResponse(available = true))
            coEvery { repo.updateSlug(any(), any()) } returns
                NetworkResult.Failure(NetworkError.ClientError(409, "{\"error\":\"SLUG_TAKEN\",\"suggestions\":[\"maria-co\"]}"))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.setSlug("newhandle")
            advanceUntilIdle()
            assertTrue(vm.canSave())
            vm.save()
            advanceUntilIdle()
            assertTrue(vm.slugCheck.value.taken)
            coVerify(exactly = 0) { repo.updateBookingPage(any(), any()) }
        }

    @Test
    fun `regenerate link resets slug`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page())
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(service())
            coEvery { repo.resetSlug(any()) } returns NetworkResult.Success(page(slug = "maria-x1y2"))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.regenerateLink()
            advanceUntilIdle()
            coVerify { repo.resetSlug(SchedulingOwner.Personal) }
        }

    @Test
    fun `route owner args scope loads and saves to the business owner`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page())
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(service())
            coEvery { repo.updateBookingPage(any(), any()) } returns NetworkResult.Success(page())
            val business = SchedulingOwner.Business("biz-1")
            val vm = vm(ownerKind = "business", ownerId = "biz-1")
            vm.load()
            advanceUntilIdle()
            coVerify { repo.getBookingPage(business) }
            vm.setTitle("Studio")
            vm.save()
            advanceUntilIdle()
            coVerify { repo.updateBookingPage(business, any()) }
            // Onward hops keep the owner context.
            assertEquals("scheduling/booking-page/preview?ownerKind=business&ownerId=biz-1", vm.previewRoute())
        }
}
