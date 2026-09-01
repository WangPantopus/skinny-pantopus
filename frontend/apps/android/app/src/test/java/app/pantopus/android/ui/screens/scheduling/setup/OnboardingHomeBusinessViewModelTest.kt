@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.setup

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.CreateEventTypeRequest
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.EventTypeResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingHomeBusinessViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val homes: HomesRepository = mockk()
    private val auth: AuthRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val flags = SchedulingFeatureFlags().apply { environment = "development" }

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(
        flow: String? = null,
        ownerKind: String? = null,
        ownerId: String? = null,
    ) = OnboardingHomeBusinessViewModel(
        repo,
        homes,
        auth,
        errors,
        flags,
        SavedStateHandle(
            buildMap {
                flow?.let { put(SchedulingRoutes.ARG_FLOW, it) }
                ownerKind?.let { put(SchedulingRoutes.ARG_OWNER_KIND, it) }
                ownerId?.let { put(SchedulingRoutes.ARG_OWNER_ID, it) }
            },
        ),
    )

    private fun myHome(id: String) =
        MyHome(
            id = id, name = null, address = null, city = null, state = null, zipcode = null,
            homeType = null, visibility = null, description = null, createdAt = null, updatedAt = null,
            occupancy = null, ownershipStatus = null, verificationTier = null, isPrimaryOwner = null,
            pendingClaimId = null,
        )

    @Test
    fun `default flow is Home with three steps`() {
        val vm = vm()
        assertEquals(OnboardingFlow.Home, vm.state.value.flow)
        assertEquals(3, vm.state.value.railSteps)
    }

    @Test
    fun `selecting Business flow resets to four steps at step one`() {
        val vm = vm()
        vm.selectFlow(OnboardingFlow.Business)
        assertEquals(OnboardingFlow.Business, vm.state.value.flow)
        assertEquals(4, vm.state.value.railSteps)
        assertEquals(1, vm.state.value.stepIndex)
    }

    @Test
    fun `business flow arg renders the Business wizard`() {
        val vm = vm(flow = SchedulingRoutes.FLOW_BUSINESS, ownerKind = "business", ownerId = "biz-1")
        assertEquals(OnboardingFlow.Business, vm.state.value.flow)
        assertEquals(4, vm.state.value.railSteps)
    }

    @Test
    fun `business route owner alone implies the Business flow`() {
        val vm = vm(ownerKind = "business", ownerId = "biz-1")
        assertEquals(OnboardingFlow.Business, vm.state.value.flow)
    }

    @Test
    fun `home flow advances Members to Combine`() {
        val vm = vm()
        vm.onPrimary()
        assertEquals(2, vm.state.value.stepIndex)
    }

    @Test
    fun `home finish resolves first home id and creates collective event type`() =
        runTest(dispatcher) {
            coEvery { homes.myHomes() } returns
                NetworkResult.Success(MyHomesResponse(homes = listOf(myHome("home-9")), message = null))
            coEvery { repo.createEventType(any(), any()) } returns
                NetworkResult.Success(EventTypeResponse(EventTypeDto(id = "e", name = "n", slug = "s", durations = listOf(30))))
            coEvery { repo.updateBookingPage(any(), any()) } returns NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p")))
            val body = slot<CreateEventTypeRequest>()
            coEvery { repo.createEventType(SchedulingOwner.Home("home-9"), capture(body)) } returns
                NetworkResult.Success(EventTypeResponse(EventTypeDto(id = "e", name = "n", slug = "s", durations = listOf(30))))

            val vm = vm()
            vm.onPrimary() // Members -> Combine
            vm.onPrimary() // Combine -> finishSetup (step 3 == totalSteps)
            advanceUntilIdle()
            coVerify { repo.createEventType(SchedulingOwner.Home("home-9"), any()) }
            assertEquals("collective", body.captured.assignmentMode)
            assertTrue(vm.state.value.isSuccess)
        }

    @Test
    fun `home finish prefers the route owner over inference`() =
        runTest(dispatcher) {
            coEvery { repo.createEventType(any(), any()) } returns
                NetworkResult.Success(EventTypeResponse(EventTypeDto(id = "e", name = "n", slug = "s", durations = listOf(30))))
            coEvery { repo.updateBookingPage(any(), any()) } returns NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p")))

            val vm = vm(flow = SchedulingRoutes.FLOW_HOME, ownerKind = "home", ownerId = "home-route")
            vm.onPrimary()
            vm.onPrimary()
            advanceUntilIdle()
            // myHomes() is never consulted when the route pins the home.
            coVerify(exactly = 0) { homes.myHomes() }
            coVerify { repo.createEventType(SchedulingOwner.Home("home-route"), any()) }
        }

    @Test
    fun `paid flag off nulls priceCents and hides the price field state`() =
        runTest(dispatcher) {
            flags.environment = "production"
            coEvery { repo.createEventType(any(), any()) } returns
                NetworkResult.Success(EventTypeResponse(EventTypeDto(id = "e", name = "n", slug = "s", durations = listOf(30))))
            coEvery { repo.updateBookingPage(any(), any()) } returns NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p")))
            val body = slot<CreateEventTypeRequest>()
            coEvery { repo.createEventType(SchedulingOwner.Business("biz-1"), capture(body)) } returns
                NetworkResult.Success(EventTypeResponse(EventTypeDto(id = "e", name = "n", slug = "s", durations = listOf(30))))

            val vm = vm(flow = SchedulingRoutes.FLOW_BUSINESS, ownerKind = "business", ownerId = "biz-1")
            assertFalse(vm.state.value.paidEnabled)
            // Jump past the slug step straight to finish: steps 2..4 then finish.
            vm.onSecondary() // 1 -> 2 (Use defaults path skips the slug claim)
            vm.onPrimary() // 2 -> 3
            vm.onPrimary() // 3 -> 4
            vm.onPrimary() // 4 -> finishSetup
            advanceUntilIdle()
            assertNull(body.captured.priceCents)
            flags.environment = "development"
        }

    @Test
    fun `paid flag on keeps the default price`() =
        runTest(dispatcher) {
            coEvery { repo.createEventType(any(), any()) } returns
                NetworkResult.Success(EventTypeResponse(EventTypeDto(id = "e", name = "n", slug = "s", durations = listOf(30))))
            coEvery { repo.updateBookingPage(any(), any()) } returns NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p")))
            val body = slot<CreateEventTypeRequest>()
            coEvery { repo.createEventType(SchedulingOwner.Business("biz-1"), capture(body)) } returns
                NetworkResult.Success(EventTypeResponse(EventTypeDto(id = "e", name = "n", slug = "s", durations = listOf(30))))

            val vm = vm(flow = SchedulingRoutes.FLOW_BUSINESS, ownerKind = "business", ownerId = "biz-1")
            assertTrue(vm.state.value.paidEnabled)
            vm.onSecondary()
            vm.onPrimary()
            vm.onPrimary()
            vm.onPrimary()
            advanceUntilIdle()
            assertEquals(12_000, body.captured.priceCents)
        }
}
