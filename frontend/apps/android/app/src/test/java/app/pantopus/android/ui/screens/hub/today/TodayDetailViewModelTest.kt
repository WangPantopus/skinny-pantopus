@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.hub.today

import app.pantopus.android.data.api.models.hub.HubTodayPayload
import app.pantopus.android.data.api.models.hub.TodayAlertDto
import app.pantopus.android.data.api.models.hub.TodayAqiDto
import app.pantopus.android.data.api.models.hub.TodayLocationDto
import app.pantopus.android.data.api.models.hub.TodaySignalDto
import app.pantopus.android.data.api.models.hub.TodayWeatherDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.hub.HubRepository
import app.pantopus.android.ui.theme.PantopusIcon
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A10.3 / P1-F — the Today detail state machine: the [setFixture] seam
 * (populated vs. alert projection) and the live `GET /api/hub/today` load
 * (payload → content, `today == null` → Error, transport failure → Error).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TodayDetailViewModelTest {
    private val repository: HubRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    // Fixture seam

    @Test
    fun initialStateIsLoading() {
        val viewModel = TodayDetailViewModel(repository)
        assertTrue(viewModel.state.value is TodayDetailUiState.Loading)
    }

    @Test
    fun loadResolvesToPopulated() {
        val viewModel = TodayDetailViewModel(repository)
        viewModel.setFixture(TodaySampleData.populated)
        viewModel.load()
        val state = viewModel.state.value
        assertTrue(state is TodayDetailUiState.Populated)
        assertEquals("67°", (state as TodayDetailUiState.Populated).content.temperature)
    }

    @Test
    fun loadResolvesToAlertWhenRibbonPresent() {
        val viewModel = TodayDetailViewModel(repository)
        viewModel.setFixture(TodaySampleData.alert)
        viewModel.load()
        val state = viewModel.state.value
        assertTrue(state is TodayDetailUiState.Alert)
        assertEquals(PantopusIcon.Snowflake, (state as TodayDetailUiState.Alert).content.glyph)
    }

    // Live load()

    @Test
    fun liveLoadPopulatesFromPayload() =
        runTest {
            coEvery { repository.todayDetail() } returns
                NetworkResult.Success(
                    HubTodayPayload(
                        location = TodayLocationDto(label = "Elm Park", timezone = "America/New_York"),
                        summary = "Mild.",
                        displayMode = "standard",
                        weather =
                            TodayWeatherDto(
                                currentTempF = 67.0,
                                conditionLabel = "Mostly sunny",
                                highF = 74.0,
                                lowF = 58.0,
                            ),
                        aqi = TodayAqiDto(index = 42, category = "Good", isNoteworthy = false),
                        alerts = emptyList(),
                        signals = listOf(TodaySignalDto(kind = "rain", label = "Shower", urgency = "low")),
                    ),
                )

            val viewModel = TodayDetailViewModel(repository)
            viewModel.load()

            val state = viewModel.state.value
            assertTrue("expected Populated, got $state", state is TodayDetailUiState.Populated)
            val content = (state as TodayDetailUiState.Populated).content
            assertEquals("67°", content.temperature)
            assertEquals(1, content.signals.size)
        }

    @Test
    fun liveLoadAlertWhenAlertPresent() =
        runTest {
            coEvery { repository.todayDetail() } returns
                NetworkResult.Success(
                    HubTodayPayload(
                        location = TodayLocationDto(label = "Elm Park"),
                        displayMode = "standard",
                        weather = TodayWeatherDto(currentTempF = 19.0, conditionLabel = "Hard freeze"),
                        alerts = listOf(TodayAlertDto(id = "a1", severity = "severe", title = "Freeze")),
                    ),
                )

            val viewModel = TodayDetailViewModel(repository)
            viewModel.load()

            assertTrue(viewModel.state.value is TodayDetailUiState.Alert)
        }

    @Test
    fun liveLoadContextUnavailableSurfacesError() =
        runTest {
            coEvery { repository.todayDetail() } returns
                NetworkResult.Success(HubTodayPayload(error = "CONTEXT_UNAVAILABLE"))

            val viewModel = TodayDetailViewModel(repository)
            viewModel.load()

            assertTrue(viewModel.state.value is TodayDetailUiState.Error)
        }

    @Test
    fun liveLoadHiddenDisplayModeSurfacesError() =
        runTest {
            // No usable location → the orchestrator returns display_mode=hidden.
            coEvery { repository.todayDetail() } returns
                NetworkResult.Success(
                    HubTodayPayload(displayMode = "hidden", summary = "Location not available."),
                )

            val viewModel = TodayDetailViewModel(repository)
            viewModel.load()

            assertTrue(viewModel.state.value is TodayDetailUiState.Error)
        }

    @Test
    fun liveLoadFailureSurfacesError() =
        runTest {
            coEvery { repository.todayDetail() } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))

            val viewModel = TodayDetailViewModel(repository)
            viewModel.load()

            assertTrue(viewModel.state.value is TodayDetailUiState.Error)
        }

    // Sample fixtures

    @Test
    fun populatedFixtureShape() {
        val content = TodaySampleData.populated
        assertNull(content.ribbon)
        assertEquals(listOf("AQI", "UV", "Wind"), content.chips.map { it.label })
        assertEquals(4, content.signals.size)
        assertEquals("Signals · 4 today", content.signalsTitle)
        assertEquals(TodayTone.Personal, content.signalsAccent)
    }

    @Test
    fun alertFixtureShape() {
        val content = TodaySampleData.alert
        assertEquals("NWS hard-freeze warning · until 8am Fri", content.ribbon?.title)
        assertEquals(5, content.signals.size)
        assertEquals(TodayTone.Error, content.signalsAccent)
        assertTrue(content.around.isEmpty())
    }

    @Test
    fun chipDotTonesMatchScale() {
        val chips = TodaySampleData.populated.chips
        assertEquals(TodayTone.Success, chips[0].dotTone)
        assertEquals(TodayTone.Warning, chips[1].dotTone)
        assertNull(chips[2].dotTone)
    }
}
