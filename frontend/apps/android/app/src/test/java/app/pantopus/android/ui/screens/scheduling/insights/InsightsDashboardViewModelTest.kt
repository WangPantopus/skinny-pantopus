@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.insights

import app.pantopus.android.data.api.models.scheduling.BookingSummaryResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.scheduling.NoShowReportResponse
import app.pantopus.android.data.api.models.scheduling.SummaryByEventType
import app.pantopus.android.data.api.models.scheduling.SummarySparkPoint
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class InsightsDashboardViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val relay = InsightsNavRelay()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        coEvery { repo.getEventTypes(any()) } returns
            NetworkResult.Success(GetEventTypesResponse(listOf(EventTypeDto(id = "e1", slug = "e1", name = "Intro"))))
        coEvery { repo.getNoShowInsights(any(), any()) } returns NetworkResult.Success(report())
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = InsightsDashboardViewModel(repo, errors, relay)

    private fun summary() =
        BookingSummaryResponse(
            bookingsThisMonth = 5,
            bookingsLastMonth = 4,
            deltaPct = 10,
            upcomingCount = 3,
            noShowCount = 2,
            sparkline = listOf(SummarySparkPoint("2026-06-15", 2), SummarySparkPoint("2026-06-16", 3)),
            byEventType = listOf(SummaryByEventType("e1", 4)),
        )

    private fun report() = NoShowReportResponse(windowDays = 30, completed = 8, noShow = 2, cancelled = 1, noShowRate = 20)

    @Test
    fun `loaded projects tiles, trend and top types`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingsSummary(any()) } returns NetworkResult.Success(summary())
            val model = vm()
            model.start()
            advanceUntilIdle()

            val loaded = model.state.value as InsightsDashboardUiState.Loaded
            assertEquals("5", loaded.data.tiles[0].value)
            assertEquals(10, loaded.data.tiles[0].delta)
            assertEquals("80%", loaded.data.tiles[2].value)
            assertEquals("20%", loaded.data.tiles[3].value)
            assertEquals("Intro", loaded.data.topTypes.first().title)
            assertEquals("20% no-show rate", loaded.data.noShowLinkSubtitle)
            assertFalse(loaded.data.isBusiness)
        }

    @Test
    fun `empty when no summary or report data`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingsSummary(any()) } returns NetworkResult.Success(BookingSummaryResponse())
            coEvery { repo.getNoShowInsights(any(), any()) } returns NetworkResult.Success(NoShowReportResponse())
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is InsightsDashboardUiState.Empty)
        }

    @Test
    fun `summary failure surfaces error`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingsSummary(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is InsightsDashboardUiState.Error)
        }

    @Test
    fun `open type route seeds the relay with owner and event type`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingsSummary(any()) } returns NetworkResult.Success(summary())
            val model = vm()
            model.start()
            advanceUntilIdle()

            val route = model.openTypeRoute("e1")
            assertEquals(SchedulingRoutes.EVENT_TYPE_PERFORMANCE, route)
            assertEquals("e1", relay.consumeEventTypeId())
            assertEquals(SchedulingOwner.Personal, relay.consumeOwner())
        }
}
