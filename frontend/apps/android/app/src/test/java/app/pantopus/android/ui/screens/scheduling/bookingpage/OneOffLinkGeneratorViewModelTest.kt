@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.bookingpage

import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.scheduling.OneOffLinkResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class OneOffLinkGeneratorViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = OneOffLinkGeneratorViewModel(repo)

    private fun types() =
        GetEventTypesResponse(
            listOf(
                EventTypeDto(
                    id = "e1",
                    name = "Intro call",
                    slug = "intro",
                    durations = listOf(15, 30),
                    defaultDuration = 30,
                    locationMode = "video",
                ),
                EventTypeDto(
                    id = "e2",
                    name = "Strategy",
                    slug = "strategy",
                    durations = listOf(60),
                    defaultDuration = 60,
                    locationMode = "video",
                ),
            ),
        )

    @Test
    fun `load yields Config with first event type selected`() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(types())
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val cfg = (vm.state.value as OneOffUiState.Config).data
            assertEquals("e1", cfg.selectedId)
            assertEquals(30, cfg.selectedDuration)
            assertEquals(ExpiryOption.D7, cfg.expiry)
        }

    @Test
    fun `no event types yields NeedsEventType`() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(emptyList()))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is OneOffUiState.NeedsEventType)
        }

    @Test
    fun `load failure yields Error`() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is OneOffUiState.Error)
        }

    @Test
    fun `select event type updates duration`() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(types())
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.selectEventType("e2")
            val cfg = (vm.state.value as OneOffUiState.Config).data
            assertEquals("e2", cfg.selectedId)
            assertEquals(60, cfg.selectedDuration)
        }

    @Test
    fun `offer specific times adds and removes slots`() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(types())
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.toggleOfferTimes()
            vm.addProposedSlot()
            vm.addProposedSlot()
            assertEquals(2, (vm.state.value as OneOffUiState.Config).data.offeredSlots.size)
            vm.removeSlot(0)
            assertEquals(1, (vm.state.value as OneOffUiState.Config).data.offeredSlots.size)
        }

    @Test
    fun `generate posts request and yields Generated`() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(types())
            coEvery { repo.createOneOffLink(any(), any()) } returns
                NetworkResult.Success(
                    OneOffLinkResponse(token = "tok", path = "/book/o/tok", expiresAt = "2026-07-01T10:00:00Z", singleUse = true),
                )
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.setExpiry(ExpiryOption.H24)
            vm.generate()
            advanceUntilIdle()
            val result = (vm.state.value as OneOffUiState.Generated).result
            assertTrue(result.url.endsWith("/book/o/tok"))
            assertTrue(result.singleUse)
            assertTrue(result.expiryLabel.startsWith("Expires"))
            val body = slot<app.pantopus.android.data.api.models.scheduling.OneOffLinkRequest>()
            coVerify { repo.createOneOffLink(eq(SchedulingOwner.Personal), capture(body)) }
            assertEquals("e1", body.captured.eventTypeId)
            assertEquals(ExpiryOption.H24.minutes, body.captured.expiresInMin)
        }

    @Test
    fun `generate failure keeps Config with error`() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(types())
            coEvery { repo.createOneOffLink(any(), any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.generate()
            advanceUntilIdle()
            val cfg = (vm.state.value as OneOffUiState.Config).data
            assertNotNull(cfg.error)
        }
}
