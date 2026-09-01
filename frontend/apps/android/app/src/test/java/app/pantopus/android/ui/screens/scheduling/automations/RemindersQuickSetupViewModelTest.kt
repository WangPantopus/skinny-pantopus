@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class RemindersQuickSetupViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm(
        ownerKind: String? = null,
        ownerId: String? = null,
    ) = RemindersQuickSetupViewModel(
        repo,
        errors,
        SavedStateHandle(
            buildMap {
                ownerKind?.let { put(SchedulingRoutes.ARG_OWNER_KIND, it) }
                ownerId?.let { put(SchedulingRoutes.ARG_OWNER_ID, it) }
            },
        ),
    )

    private fun page(minutes: List<Int>) = BookingPageResponse(BookingPageDto(id = "p1", reminderMinutes = minutes))

    private fun loaded(vm: RemindersQuickSetupViewModel) = vm.state.value as RemindersUiState.Loaded

    @Test
    fun `smart default on first open`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page(emptyList()))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertTrue(loaded(vm).firstOpen)
            assertEquals(listOf(1440, 60), loaded(vm).reminderMinutes)
        }

    @Test
    fun `load existing sorted descending`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page(listOf(15, 1440, 30)))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertFalse(loaded(vm).firstOpen)
            assertEquals(listOf(1440, 30, 15), loaded(vm).reminderMinutes)
        }

    @Test
    fun `toggle adds and removes`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page(emptyList()))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertFalse(loaded(vm).isOn(0))
            vm.toggle(0)
            assertTrue(loaded(vm).isOn(0))
            vm.toggle(0)
            assertFalse(loaded(vm).isOn(0))
        }

    @Test
    fun `add custom time resolves minutes`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page(emptyList()))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.setCustomUnit(ReminderPreset.Unit.Hours)
            vm.stepCustom(1) // 2 -> 3
            assertEquals(180, loaded(vm).customResolvedMinutes)
            vm.addCustom()
            assertTrue(loaded(vm).reminderMinutes.contains(180))
        }

    @Test
    fun `save puts reminders`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page(emptyList()))
            coEvery { repo.updateBookingPage(any(), any()) } returns NetworkResult.Success(page(listOf(1440, 60)))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.save()
            advanceUntilIdle()
            assertNull(loaded(vm).saveError)
            assertEquals(listOf(1440, 60), loaded(vm).reminderMinutes)
        }

    @Test
    fun `route owner args scope reads and saves to the business booking page`() =
        runTest(dispatcher) {
            val business = SchedulingOwner.Business("biz-1")
            coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page(emptyList()))
            coEvery { repo.updateBookingPage(any(), any()) } returns NetworkResult.Success(page(listOf(1440, 60)))
            val vm = vm(ownerKind = "business", ownerId = "biz-1")
            vm.load()
            advanceUntilIdle()
            vm.save()
            advanceUntilIdle()
            coVerify { repo.getBookingPage(business) }
            coVerify { repo.updateBookingPage(business, any()) }
        }
}
