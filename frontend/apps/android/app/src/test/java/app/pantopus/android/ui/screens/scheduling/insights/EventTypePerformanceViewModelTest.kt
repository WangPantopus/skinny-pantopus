@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.insights

import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
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
class EventTypePerformanceViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val relay = InsightsNavRelay()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        coEvery { repo.getEventTypes(any()) } returns
            NetworkResult.Success(
                GetEventTypesResponse(
                    listOf(
                        EventTypeDto(id = "e1", slug = "e1", name = "Intro", defaultDuration = 30, priceCents = 0),
                        EventTypeDto(id = "e2", slug = "e2", name = "Deep dive", defaultDuration = 60, priceCents = 5000, currency = "USD"),
                    ),
                ),
            )
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = EventTypePerformanceViewModel(repo, errors, relay)

    @Test
    fun `defaults to first type and builds the funnel`() =
        runTest(dispatcher) {
            coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    GetBookingsResponse(
                        listOf(
                            booking("1", "completed"),
                            booking("2", "completed"),
                            booking("3", "no_show"),
                        ),
                    ),
                )
            val model = vm()
            model.start()
            advanceUntilIdle()

            assertEquals("e1", model.selectedId.value)
            val loaded = model.state.value as PerfUiState.Loaded
            assertEquals("Intro", loaded.data.header.name)
            assertEquals(3, loaded.data.funnel.first().count) // Booked
            assertEquals("3", loaded.data.tiles[0].value)
        }

    @Test
    fun `relay pre-selects the tapped type`() =
        runTest(dispatcher) {
            relay.pendingEventTypeId = "e2"
            coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GetBookingsResponse(listOf(booking("1", "completed"))))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertEquals("e2", model.selectedId.value)
        }

    @Test
    fun `never-booked type is empty with a header`() =
        runTest(dispatcher) {
            coEvery { repo.getBookings(any(), any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(GetBookingsResponse(emptyList()))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val empty = model.state.value as PerfUiState.EmptyType
            assertEquals("Intro", empty.header.name)
        }

    @Test
    fun `no event types yields the no-types state`() =
        runTest(dispatcher) {
            coEvery { repo.getEventTypes(any()) } returns NetworkResult.Success(GetEventTypesResponse(emptyList()))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is PerfUiState.NoTypes)
        }

    private fun booking(
        id: String,
        status: String,
    ) = BookingDto(id = id, status = status, startAt = "2026-06-10T10:00:00Z", eventTypeId = "e1")
}
