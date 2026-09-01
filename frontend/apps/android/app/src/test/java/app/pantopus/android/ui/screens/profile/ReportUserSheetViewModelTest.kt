@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.profile

import app.pantopus.android.data.api.models.profile.UserReportRequest
import app.pantopus.android.data.api.models.profile.UserReportResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.profile.UserReportsRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
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
class ReportUserSheetViewModelTest {
    private val repo: UserReportsRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): ReportUserSheetViewModel = ReportUserSheetViewModel(repo)

    // MARK: - canSubmit gating

    @Test
    fun canSubmit_isFalse_withoutReason() {
        val vm = makeVm()
        assertFalse(vm.canSubmit())
    }

    @Test
    fun canSubmit_isTrue_forNonOtherReason_withoutDetails() {
        val vm = makeVm()
        vm.selectReason(ReportReason.Spam)
        assertTrue(vm.canSubmit())
    }

    @Test
    fun canSubmit_isFalse_forOther_withBlankDetails() {
        val vm = makeVm()
        vm.selectReason(ReportReason.Other)
        assertFalse(vm.canSubmit())
        vm.updateDetails("   \n  ")
        assertFalse(vm.canSubmit())
    }

    @Test
    fun canSubmit_isTrue_forOther_withDetails() {
        val vm = makeVm()
        vm.selectReason(ReportReason.Other)
        vm.updateDetails("Selling counterfeit goods.")
        assertTrue(vm.canSubmit())
    }

    // MARK: - Submit happy paths

    @Test
    fun submit_postsValidBody_andMarksSucceeded() =
        runTest {
            val captured = slot<UserReportRequest>()
            coEvery { repo.report("u9", capture(captured)) } returns
                NetworkResult.Success(UserReportResponse(message = "ok", alreadyReported = false))
            val vm = makeVm()
            vm.selectReason(ReportReason.Spam)
            vm.submit("u9")

            assertEquals(ReportSheetUiState.Succeeded, vm.state.value)
            assertEquals("spam", captured.captured.reason)
            assertNull(captured.captured.details)
        }

    @Test
    fun submit_collapsesImpersonation_toOther_withPrefix() =
        runTest {
            val captured = slot<UserReportRequest>()
            coEvery { repo.report("u9", capture(captured)) } returns
                NetworkResult.Success(UserReportResponse(message = "ok", alreadyReported = false))
            val vm = makeVm()
            vm.selectReason(ReportReason.Impersonation)
            vm.updateDetails("Pretends to be my landlord.")
            vm.submit("u9")

            assertEquals(ReportSheetUiState.Succeeded, vm.state.value)
            assertEquals("other", captured.captured.reason)
            assertEquals(
                "[Impersonation] Pretends to be my landlord.",
                captured.captured.details,
            )
        }

    @Test
    fun submit_mapsHateSpeech_toHarassment_withPrefix() =
        runTest {
            val captured = slot<UserReportRequest>()
            coEvery { repo.report("u9", capture(captured)) } returns
                NetworkResult.Success(UserReportResponse(message = "ok", alreadyReported = false))
            val vm = makeVm()
            vm.selectReason(ReportReason.HateSpeech)
            vm.submit("u9")

            assertEquals(ReportSheetUiState.Succeeded, vm.state.value)
            assertEquals("harassment", captured.captured.reason)
            assertEquals("[Hate speech]", captured.captured.details)
        }

    // MARK: - Failure paths

    @Test
    fun submit_setsFailedState_onClientError() =
        runTest {
            coEvery { repo.report(any(), any()) } returns
                NetworkResult.Failure(NetworkError.ClientError(400, "You cannot report yourself"))
            val vm = makeVm()
            vm.selectReason(ReportReason.Harassment)
            vm.submit("u9")

            val state = vm.state.value
            assertTrue(state is ReportSheetUiState.Failed)
            assertEquals("Couldn't submit your report.", (state as ReportSheetUiState.Failed).message)
        }

    @Test
    fun submit_setsFailedState_onNotFound() =
        runTest {
            coEvery { repo.report(any(), any()) } returns
                NetworkResult.Failure(NetworkError.NotFound)
            val vm = makeVm()
            vm.selectReason(ReportReason.Spam)
            vm.submit("missing")

            val state = vm.state.value
            assertTrue(state is ReportSheetUiState.Failed)
            assertTrue((state as ReportSheetUiState.Failed).message.contains("user"))
        }

    @Test
    fun submit_setsFailedState_onTransportError() =
        runTest {
            coEvery { repo.report(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Transport(RuntimeException("offline")))
            val vm = makeVm()
            vm.selectReason(ReportReason.Harassment)
            vm.submit("u9")

            val state = vm.state.value
            assertTrue(state is ReportSheetUiState.Failed)
            assertTrue((state as ReportSheetUiState.Failed).message.contains("connection"))
        }

    @Test
    fun submit_isNoOp_whenCannotSubmit() =
        runTest {
            val vm = makeVm()
            vm.selectReason(ReportReason.Other)
            vm.updateDetails("")
            vm.submit("u9")

            assertEquals(ReportSheetUiState.Idle, vm.state.value)
            coVerify(exactly = 0) { repo.report(any(), any()) }
        }

    @Test
    fun submit_isNoOp_whileSubmitting() =
        runTest {
            coEvery { repo.report(any(), any()) } returns
                NetworkResult.Success(UserReportResponse(message = "ok", alreadyReported = false))
            val vm = makeVm()
            vm.selectReason(ReportReason.Spam)
            vm.submit("u9")
            vm.submit("u9") // second submit after success — should no-op

            coVerify(exactly = 1) { repo.report(any(), any()) }
        }
}
