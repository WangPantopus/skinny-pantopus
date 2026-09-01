@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.EventTypeResponse
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.scheduling.SchedulingOkResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class EventTypeListViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val homes: HomesRepository = mockk()
    private val auth: AuthRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val flags = SchedulingFeatureFlags().apply { environment = "local" }
    private val relay = SchedulingEditorOwnerRelay()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedIn(user()))
        coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(homes = listOf(home("home-7")), message = null))
        coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page())
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

    private fun page() = BookingPageResponse(BookingPageDto(id = "p1", slug = "maria-k", isPaused = false, timezone = "America/New_York"))

    private fun et(
        id: String,
        name: String = "Intro call",
        active: Boolean = true,
        priceCents: Int? = null,
    ) = EventTypeDto(
        id = id, name = name, slug = name.lowercase().replace(" ", "-"), durations = listOf(30),
        defaultDuration = 30, locationMode = "video", isActive = active, priceCents = priceCents, currency = "USD",
    )

    private fun stub(types: List<EventTypeDto>) {
        coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(types))
    }

    private fun newVm(
        ownerKind: String? = null,
        ownerId: String? = null,
    ) = EventTypeListViewModel(
        repo,
        homes,
        auth,
        errors,
        flags,
        relay,
        SavedStateHandle(
            buildMap {
                ownerKind?.let { put(SchedulingRoutes.ARG_OWNER_KIND, it) }
                ownerId?.let { put(SchedulingRoutes.ARG_OWNER_ID, it) }
            },
        ),
    )

    @Test
    fun `route owner args seed the owner and pillar`() =
        runTest(dispatcher) {
            stub(emptyList())
            val vm = newVm(ownerKind = "home", ownerId = "home-7")
            vm.start()
            advanceUntilIdle()
            assertEquals(SchedulingPillar.Home, vm.pillar.value)
            coVerify { repo.getEventTypes(SchedulingOwner.Home("home-7")) }
        }

    @Test
    fun `no event types yields zero-count content`() =
        runTest(dispatcher) {
            stub(emptyList())
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            val content = vm.state.value as EventTypeListUiState.Content
            assertTrue(content.rows.isEmpty())
            assertEquals(0, content.activeCount)
            assertEquals(0, content.hiddenCount)
        }

    @Test
    fun `active and hidden split by is_active and tab filters`() =
        runTest(dispatcher) {
            stub(listOf(et("e1"), et("e2"), et("e3", active = false)))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            val active = vm.state.value as EventTypeListUiState.Content
            assertEquals(2, active.rows.size)
            assertEquals(2, active.activeCount)
            assertEquals(1, active.hiddenCount)

            vm.selectTab(EventTypeTab.Hidden)
            val hidden = vm.state.value as EventTypeListUiState.Content
            assertEquals(1, hidden.rows.size)
            assertEquals(EventTypeTab.Hidden, hidden.tab)
        }

    @Test
    fun `toggleActive optimistically flips and calls update`() =
        runTest(dispatcher) {
            stub(listOf(et("e1")))
            coEvery { repo.updateEventType(any(), any(), any()) } returns NetworkResult.Success(EventTypeResponse(et("e1", active = false)))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            vm.toggleActive("e1", active = false)
            // Optimistic: e1 leaves the Active tab immediately.
            assertTrue((vm.state.value as EventTypeListUiState.Content).rows.isEmpty())
            advanceUntilIdle()
            coVerify { repo.updateEventType(SchedulingOwner.Personal, "e1", any()) }
        }

    @Test
    fun `delete with upcoming bookings opens the deactivate prompt`() =
        runTest(dispatcher) {
            stub(listOf(et("e1")))
            coEvery { repo.deleteEventType(any(), "e1") } returns
                NetworkResult.Failure(NetworkError.ClientError(409, """{"error":"HAS_BOOKINGS","message":"x"}"""))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            vm.requestDelete("e1")
            vm.confirmDelete()
            advanceUntilIdle()
            assertNotNull(vm.deactivatePrompt.value)
            assertEquals("e1", vm.deactivatePrompt.value?.id)
        }

    @Test
    fun `successful delete removes the row`() =
        runTest(dispatcher) {
            stub(listOf(et("e1"), et("e2")))
            coEvery { repo.deleteEventType(any(), "e1") } returns NetworkResult.Success(SchedulingOkResponse())
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            vm.requestDelete("e1")
            vm.confirmDelete()
            advanceUntilIdle()
            val content = vm.state.value as EventTypeListUiState.Content
            assertEquals(1, content.rows.size)
            assertNull(content.rows.firstOrNull { it.id == "e1" })
        }

    @Test
    fun `business pillar surfaces a price label behind the paid flag`() =
        runTest(dispatcher) {
            stub(listOf(et("e1", priceCents = 12000)))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            vm.selectPillar(SchedulingPillar.Business)
            advanceUntilIdle()
            val content = vm.state.value as EventTypeListUiState.Content
            assertEquals(SchedulingPillar.Business, content.pillar)
            assertEquals("$120.00", content.rows.first().priceLabel)
            coVerify { repo.getEventTypes(SchedulingOwner.Business("user-1")) }
        }

    @Test
    fun `editor navigation hands the resolved owner to the relay`() =
        runTest(dispatcher) {
            stub(listOf(et("e1")))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            vm.selectPillar(SchedulingPillar.Business)
            advanceUntilIdle()
            vm.createRoute()
            assertEquals(SchedulingOwner.Business("user-1"), relay.pending)
        }

    @Test
    fun `personal pillar hides price labels`() =
        runTest(dispatcher) {
            stub(listOf(et("e1", priceCents = 12000)))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            assertNull((vm.state.value as EventTypeListUiState.Content).rows.first().priceLabel)
        }

    @Test
    fun `copy link with no page slug surfaces a toast`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns
                NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p1", slug = null, isPaused = false)))
            stub(listOf(et("e1")))
            val vm = newVm()
            vm.start()
            advanceUntilIdle()
            vm.copyLink("e1")
            assertFalse(vm.toast.value.isNullOrEmpty())
            assertNull(vm.copyRequest.value)
        }
}
