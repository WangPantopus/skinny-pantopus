@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.customer

import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.GetBookingsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.ManageTokenStore
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.time.temporal.ChronoUnit

@OptIn(ExperimentalCoroutinesApi::class)
class MyBookingsViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val manageTokens: ManageTokenStore = mockk()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every { manageTokens.manageToken(any()) } returns flowOf(null)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = MyBookingsViewModel(repo, manageTokens)

    private fun booking(
        id: String,
        status: String,
        daysFromNow: Long,
        ownerType: String? = null,
    ) = BookingDto(
        id = id,
        ownerType = ownerType,
        status = status,
        startAt = Instant.now().plus(daysFromNow, ChronoUnit.DAYS).toString(),
        endAt = Instant.now().plus(daysFromNow, ChronoUnit.DAYS).plus(30, ChronoUnit.MINUTES).toString(),
    )

    @Test
    fun empty_when_no_bookings() =
        runTest(dispatcher) {
            coEvery { repo.getMyBookings() } returns NetworkResult.Success(GetBookingsResponse(emptyList()))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertEquals(MyBookingsUiState.Empty, vm.state.value)
        }

    @Test
    fun pending_upcoming_lands_in_needs_attention() =
        runTest(dispatcher) {
            coEvery { repo.getMyBookings() } returns
                NetworkResult.Success(
                    GetBookingsResponse(
                        listOf(
                            booking("b1", "pending", daysFromNow = 2, ownerType = "business"),
                            booking("b2", "confirmed", daysFromNow = 3),
                        ),
                    ),
                )
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            val loaded = vm.state.value as MyBookingsUiState.Loaded
            assertEquals(MyBookingsTab.Upcoming, loaded.tab)
            assertEquals("Needs attention", loaded.groups.first().overline)
            assertTrue(loaded.groups.first().attention)
            assertEquals("b1", loaded.groups.first().rows.first().id)
        }

    @Test
    fun past_tab_lists_past_bookings() =
        runTest(dispatcher) {
            coEvery { repo.getMyBookings() } returns
                NetworkResult.Success(GetBookingsResponse(listOf(booking("p1", "completed", daysFromNow = -3))))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            // upcoming is empty → Empty; switch to Past shows the past booking
            vm.selectTab(MyBookingsTab.Past)
            advanceUntilIdle()
            val loaded = vm.state.value as MyBookingsUiState.Loaded
            assertEquals(MyBookingsTab.Past, loaded.tab)
            assertEquals("p1", loaded.groups.flatMap { it.rows }.first().id)
        }

    @Test
    fun error_when_fetch_fails() =
        runTest(dispatcher) {
            coEvery { repo.getMyBookings() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm()
            vm.start()
            advanceUntilIdle()
            assertTrue(vm.state.value is MyBookingsUiState.Error)
        }

    @Test
    fun row_tap_with_stored_token_opens_manage() =
        runTest(dispatcher) {
            coEvery { repo.getMyBookings() } returns NetworkResult.Success(GetBookingsResponse(emptyList()))
            every { manageTokens.manageToken("b1") } returns flowOf("tok-1")
            val vm = vm()
            vm.onRowTap("b1")
            advanceUntilIdle()
            assertEquals("tok-1", vm.openManage.value)
            assertNull(vm.toast.value)
        }

    @Test
    fun row_tap_without_token_shows_toast() =
        runTest(dispatcher) {
            every { manageTokens.manageToken("b9") } returns flowOf(null)
            val vm = vm()
            vm.onRowTap("b9")
            advanceUntilIdle()
            assertNull(vm.openManage.value)
            assertNotNull(vm.toast.value)
        }
}
