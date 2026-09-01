@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import app.pantopus.android.data.api.models.scheduling.ConnectedCalendarDto
import app.pantopus.android.data.api.models.scheduling.GetConnectedCalendarsResponse
import app.pantopus.android.data.api.models.scheduling.SchedulingOkResponse
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
class ConnectedCalendarsViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = ConnectedCalendarsViewModel(repo, errors)

    @Test
    fun `empty list yields the loaded coming-soon surface`() =
        runTest(dispatcher) {
            coEvery { repo.getConnectedCalendars() } returns NetworkResult.Success(GetConnectedCalendarsResponse(emptyList()))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as ConnectedCalendarsUiState.Loaded
            assertTrue(loaded.calendars.isEmpty())
        }

    @Test
    fun `a read failure surfaces the error state`() =
        runTest(dispatcher) {
            // A real network failure surfaces the retryable Error state (the VM
            // no longer masks it as Loaded(emptyList()) — see the VM comment).
            coEvery { repo.getConnectedCalendars() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val model = vm()
            model.start()
            advanceUntilIdle()
            assertTrue(model.state.value is ConnectedCalendarsUiState.Error)
        }

    @Test
    fun `connect returning 501 surfaces the coming-soon toast`() =
        runTest(dispatcher) {
            coEvery { repo.getConnectedCalendars() } returns NetworkResult.Success(GetConnectedCalendarsResponse(emptyList()))
            val body = """{"error":"NOT_AVAILABLE","message":"External calendar sync is coming soon."}"""
            coEvery { repo.connectCalendar() } returns NetworkResult.Failure(NetworkError.Server(501, body))
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.connect()
            advanceUntilIdle()
            assertEquals("Calendar sync is coming soon.", model.toast.value)
        }

    @Test
    fun `non-empty list renders connected rows`() =
        runTest(dispatcher) {
            val cal = ConnectedCalendarDto(id = "c1", provider = "google", externalAccount = "a@b.com")
            coEvery { repo.getConnectedCalendars() } returns NetworkResult.Success(GetConnectedCalendarsResponse(listOf(cal)))
            val model = vm()
            model.start()
            advanceUntilIdle()
            val loaded = model.state.value as ConnectedCalendarsUiState.Loaded
            assertEquals(1, loaded.calendars.size)
        }

    @Test
    fun `connect success surfaces a connected toast`() =
        runTest(dispatcher) {
            coEvery { repo.getConnectedCalendars() } returns NetworkResult.Success(GetConnectedCalendarsResponse(emptyList()))
            coEvery { repo.connectCalendar() } returns NetworkResult.Success(SchedulingOkResponse())
            val model = vm()
            model.start()
            advanceUntilIdle()
            model.connect()
            advanceUntilIdle()
            assertEquals("Connected", model.toast.value)
        }
}
