@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.insights

import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.scheduling.NoShowRecent
import app.pantopus.android.data.api.models.scheduling.NoShowReportResponse
import app.pantopus.android.data.api.net.NetworkError
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
class NoShowReportViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val relay = InsightsNavRelay()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        coEvery { repo.getEventTypes(any()) } returns
            NetworkResult.Success(GetEventTypesResponse(listOf(EventTypeDto(id = "e1", slug = "e1", name = "Intro"))))
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = NoShowReportViewModel(repo, errors, relay)

    @Test
    fun `loaded flags repeats and builds the recent list`() =
        runTest(dispatcher) {
            coEvery { repo.getNoShowInsights(any(), any()) } returns
                NetworkResult.Success(
                    NoShowReportResponse(
                        windowDays = 90,
                        completed = 8,
                        noShow = 2,
                        cancelled = 1,
                        noShowRate = 20,
                        recentNoShows =
                            listOf(
                                NoShowRecent(
                                    id = "1",
                                    startAt = "2026-06-10T10:00:00Z",
                                    status = "no_show",
                                    inviteeName = "Sam Lee",
                                    eventTypeId = "e1",
                                ),
                                NoShowRecent(
                                    id = "2",
                                    startAt = "2026-06-09T10:00:00Z",
                                    status = "no_show",
                                    inviteeName = "Sam Lee",
                                    eventTypeId = "e1",
                                ),
                            ),
                    ),
                )
            val model = vm()
            model.start()
            advanceUntilIdle()

            val loaded = model.state.value as NoShowReportUiState.Loaded
            assertEquals("20%", loaded.data.noShowRateLabel)
            assertEquals("of 11 bookings in 90 days", loaded.data.subLabel)
            assertEquals(2, loaded.data.recentRows.size)
            assertTrue(loaded.data.recentRows.first().isRepeat)
            assertTrue(loaded.data.recentRows.first().detail.contains("Intro"))
        }

    @Test
    fun `zero no-shows is celebratory`() =
        runTest(dispatcher) {
            coEvery { repo.getNoShowInsights(any(), any()) } returns
                NetworkResult.Success(NoShowReportResponse(windowDays = 30, completed = 5, noShow = 0, cancelled = 0, noShowRate = 0))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val state = model.state.value as NoShowReportUiState.Celebratory
            assertEquals(30, state.windowDays)
        }

    @Test
    fun `failure surfaces error`() =
        runTest(dispatcher) {
            coEvery { repo.getNoShowInsights(any(), any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is NoShowReportUiState.Error)
        }
}
