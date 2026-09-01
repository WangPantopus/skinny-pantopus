@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.payments

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDetailResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.UpdateBookingPageRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
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
class CancellationRefundPolicyViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val auth: AuthRepository = mockk()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedOut)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun flags(enabled: Boolean) = SchedulingFeatureFlags().apply { environment = if (enabled) "development" else "production" }

    private fun vm(
        enabled: Boolean = true,
        eventTypeId: String? = null,
    ) = CancellationRefundPolicyViewModel(
        repo,
        flags(enabled),
        auth,
        SavedStateHandle(if (eventTypeId != null) mapOf("eventTypeId" to eventTypeId) else emptyMap()),
    )

    private fun loaded(state: CancellationPolicyUiState) = state as CancellationPolicyUiState.Loaded

    @Test
    fun `flag off yields NotEnabled`() =
        runTest(dispatcher) {
            val vm = vm(enabled = false)
            vm.load()
            advanceUntilIdle()
            assertEquals(CancellationPolicyUiState.NotEnabled, vm.state.value)
        }

    @Test
    fun `page-level load maps preset string to selection`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns
                NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p", cancellationPolicy = "Moderate")))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertEquals(CancellationRefundPolicyViewModel.Preset.Moderate, loaded(vm.state.value).form.selectedPreset)
        }

    @Test
    fun `page-level load parses custom JSON`() =
        runTest(dispatcher) {
            val json =
                """{"preset":"custom","free_cancel_window_min":720,"refund_after_pct":25,""" +
                    """"deposit_non_refundable":false,"no_show":"no_charge"}"""
            coEvery { repo.getBookingPage(any()) } returns
                NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p", cancellationPolicy = json)))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            val form = loaded(vm.state.value).form
            assertEquals(CancellationRefundPolicyViewModel.Preset.Custom, form.selectedPreset)
            assertEquals(12, form.customCutoffHours)
            assertEquals(25, form.customRefundPct)
            assertEquals(false, form.depositNonRefundable)
            assertEquals(CancellationRefundPolicyViewModel.NoShowMode.NoCharge, form.noShowMode)
        }

    @Test
    fun `null policy defaults to Flexible`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns
                NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p", cancellationPolicy = null)))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            assertEquals(CancellationRefundPolicyViewModel.Preset.Flexible, loaded(vm.state.value).form.selectedPreset)
        }

    @Test
    fun `page-level save sends preset string and flags didSave`() =
        runTest(dispatcher) {
            coEvery { repo.getBookingPage(any()) } returns
                NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p", cancellationPolicy = "Strict")))
            coEvery { repo.updateBookingPage(any(), any()) } returns
                NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p", cancellationPolicy = "Strict")))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.save()
            advanceUntilIdle()
            assertTrue(vm.didSave.value)
            coVerify {
                repo.updateBookingPage(
                    any(),
                    match<UpdateBookingPageRequest> { it.cancellationPolicy == "Strict" },
                )
            }
        }

    @Test
    fun `custom page policy encodes a JSON object string`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.select(CancellationRefundPolicyViewModel.Preset.Custom)
            val raw = vm.pagePolicyValue()
            assertTrue(raw.contains("\"preset\":\"custom\""))
            assertTrue(raw.contains("\"free_cancel_window_min\":1440"))
            assertTrue(raw.contains("\"deposit_non_refundable\":true"))
        }

    @Test
    fun `refund policy enum maps from preset`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.select(CancellationRefundPolicyViewModel.Preset.Flexible)
            assertEquals("full", vm.refundPolicyValue())
            vm.select(CancellationRefundPolicyViewModel.Preset.Moderate)
            assertEquals("partial", vm.refundPolicyValue())
            vm.select(CancellationRefundPolicyViewModel.Preset.Strict)
            assertEquals("none", vm.refundPolicyValue())
        }

    @Test
    fun `per-service load derives Strict from refund_policy none`() =
        runTest(dispatcher) {
            coEvery { repo.getEventType(any(), any()) } returns
                NetworkResult.Success(
                    EventTypeDetailResponse(
                        EventTypeDto(id = "et1", name = "X", slug = "x", refundPolicy = "none", cancellationWindowMin = 0),
                    ),
                )
            val vm = vm(eventTypeId = "et1")
            vm.load()
            advanceUntilIdle()
            assertEquals(CancellationRefundPolicyViewModel.Preset.Strict, loaded(vm.state.value).form.selectedPreset)
        }

    @Test
    fun `per-service save sends window minutes and refund policy`() =
        runTest(dispatcher) {
            coEvery { repo.getEventType(any(), any()) } returns
                NetworkResult.Success(
                    EventTypeDetailResponse(
                        EventTypeDto(id = "et1", name = "X", slug = "x", refundPolicy = "full", cancellationWindowMin = 1440),
                    ),
                )
            coEvery { repo.updateEventType(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = vm(eventTypeId = "et1")
            vm.load()
            advanceUntilIdle()
            vm.save()
            advanceUntilIdle()
            coVerify {
                repo.updateEventType(
                    any(),
                    eq("et1"),
                    match { it.cancellationWindowMin == 1440 && it.refundPolicy == "full" },
                )
            }
            // The 500 surfaces as a save error and leaves didSave false.
            assertTrue(vm.saveError.value != null)
            assertEquals(false, vm.didSave.value)
        }
}
