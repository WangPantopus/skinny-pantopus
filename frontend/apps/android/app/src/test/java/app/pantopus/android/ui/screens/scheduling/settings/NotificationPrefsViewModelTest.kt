@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.settings

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.NotificationPrefsResponse
import app.pantopus.android.data.api.models.scheduling.UpdateNotificationPrefsRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class NotificationPrefsViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = NotificationPrefsViewModel(repo, SavedStateHandle())

    private fun stub(
        prefs: Map<String, Any?>,
        reminderMinutes: List<Int> = listOf(1440, 60),
    ) {
        coEvery { repo.getNotificationPreferences() } returns NetworkResult.Success(NotificationPrefsResponse(prefs))
        coEvery { repo.getBookingPage(any()) } returns
            NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p", reminderMinutes = reminderMinutes)))
    }

    @Test
    fun `load builds rows and reads reminder minutes from page`() =
        runTest(dispatcher) {
            stub(prefs = emptyMap())
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val loaded = vm.state.value as NotificationPrefsUiState.Loaded
            assertEquals(6, loaded.data.notifyMe.size)
            assertEquals(4, loaded.data.notifyAttendees.size)
            assertEquals(listOf(1440, 60), loaded.data.reminderMinutes)
            // confirmation row is locked
            assertTrue(loaded.data.notifyAttendees.first { it.key == "confirmation" }.locked)
        }

    @Test
    fun `toggling a pref preserves unknown server keys on persist`() =
        runTest(dispatcher) {
            // Server returned an unknown key we must round-trip untouched.
            stub(prefs = mapOf("digest_optin" to true, "notify_me" to mapOf("new_booking" to true)))
            val captured = slot<UpdateNotificationPrefsRequest>()
            coEvery { repo.updateNotificationPreferences(capture(captured)) } returns
                NetworkResult.Success(NotificationPrefsResponse(emptyMap()))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.toggleNotifyMe("new_booking")
            advanceUntilIdle()
            val sentPrefs = captured.captured.prefs
            assertTrue("unknown key preserved", sentPrefs.containsKey("digest_optin"))
            assertEquals(true, sentPrefs["digest_optin"])
            assertTrue(sentPrefs.containsKey("notify_me"))
            assertTrue(sentPrefs.containsKey("notify_attendees"))
        }

    @Test
    fun `prefs load failure surfaces Error`() =
        runTest(dispatcher) {
            coEvery { repo.getNotificationPreferences() } returns NetworkResult.Failure(NetworkError.NotFound)
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is NotificationPrefsUiState.Error)
        }

    @Test
    fun `toggle reminder updates the list`() =
        runTest(dispatcher) {
            stub(prefs = emptyMap(), reminderMinutes = listOf(1440, 60))
            coEvery { repo.updateBookingPage(any(), any()) } returns
                NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p", reminderMinutes = listOf(1440, 60, 15))))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.toggleReminder(15)
            advanceUntilIdle()
            val loaded = vm.state.value as NotificationPrefsUiState.Loaded
            assertEquals(listOf(1440, 60, 15), loaded.data.reminderMinutes)
        }
}
