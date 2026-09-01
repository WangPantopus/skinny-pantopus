@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.owners.transfer

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.TransferOwnerRequest
import app.pantopus.android.data.api.models.homes.TransferOwnerResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeOwnersRepository
import app.pantopus.android.data.homes.HomesRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A13.4 — Behavioural unit tests for the Transfer Ownership form
 * view-model. Mirrors iOS `TransferOwnershipViewModelTests` so both
 * platforms march through the same state machine.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TransferOwnershipViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val ownersRepo: HomeOwnersRepository = mockk(relaxed = true)
    private val homesRepo: HomesRepository = mockk(relaxed = true)
    private val authRepository: AuthRepository = mockk(relaxed = true)

    @Before fun setUp() {
        Dispatchers.setMain(dispatcher)
        every { authRepository.state } returns MutableStateFlow(AuthRepository.State.SignedOut)
        coEvery { ownersRepo.transfer(any(), any()) } returns
            NetworkResult.Success(TransferOwnerResponse(message = "Transfer initiated."))
        coEvery { homesRepo.detail(any()) } returns
            NetworkResult.Failure(NetworkError.Server(500, null))
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeViewModel(): TransferOwnershipViewModel =
        TransferOwnershipViewModel(
            SavedStateHandle(mapOf(TRANSFER_HOME_ID_KEY to "preview")),
            ownersRepo,
            homesRepo,
            authRepository,
        )

    private fun armedViewModel(): TransferOwnershipViewModel =
        makeViewModel().apply {
            updateRecipientEmail("buyer@example.com")
            updateConfirmation("TRANSFER")
        }

    @Test
    fun initial_state_not_ready_to_commit() {
        val state = makeViewModel().state.value
        assertFalse(state.isReadyToCommit)
        assertEquals(ConfirmSheetPhase.Hidden, state.sheetPhase)
        assertFalse(state.confirmationMatches)
        assertFalse(state.isDirty)
    }

    @Test
    fun confirmation_alone_does_not_arm_cta() {
        val vm = makeViewModel()
        vm.updateConfirmation("TRANSFER")
        assertTrue(vm.state.value.confirmationMatches)
        assertFalse(vm.state.value.isReadyToCommit)
    }

    @Test
    fun email_plus_confirmation_arms_cta() {
        val vm = armedViewModel()
        assertTrue(vm.state.value.isReadyToCommit)
    }

    @Test
    fun malformed_email_is_rejected() {
        val vm = makeViewModel()
        vm.updateConfirmation("TRANSFER")
        listOf("buyer", "buyer@", "@example.com", "buyer @example.com", "buyer@example").forEach { bad ->
            vm.updateRecipientEmail(bad)
            assertFalse("$bad should not validate", vm.state.value.recipientIsValid)
            assertFalse(vm.state.value.isReadyToCommit)
        }
    }

    @Test
    fun lowercase_phrase_does_not_match() {
        val vm = makeViewModel()
        vm.updateRecipientEmail("buyer@example.com")
        vm.updateConfirmation("transfer")
        assertFalse(vm.state.value.confirmationMatches)
        assertFalse(vm.state.value.isReadyToCommit)
    }

    @Test
    fun cta_label_uses_recipient_local_part() {
        val vm = makeViewModel()
        assertEquals("Initiate transfer", vm.state.value.ctaLabel)
        vm.updateRecipientEmail("maya.fortune@example.com")
        assertEquals("Transfer ownership to maya.fortune", vm.state.value.ctaLabel)
    }

    @Test
    fun confirm_sheet_parties_describe_a_full_transfer() {
        val parties = armedViewModel().state.value.confirmSheetParties
        assertEquals(2, parties.size)
        assertEquals(100, parties[0].fromPercent)
        assertEquals(0, parties[0].toPercent)
        assertEquals(0, parties[1].fromPercent)
        assertEquals(100, parties[1].toPercent)
        assertEquals("buyer@example.com", parties[1].name)
    }

    @Test
    fun present_confirm_sheet_only_when_ready() {
        val vm = makeViewModel()
        vm.presentConfirmSheet()
        assertEquals(ConfirmSheetPhase.Hidden, vm.state.value.sheetPhase)
        vm.updateRecipientEmail("buyer@example.com")
        vm.updateConfirmation("TRANSFER")
        vm.presentConfirmSheet()
        assertEquals(ConfirmSheetPhase.Visible, vm.state.value.sheetPhase)
    }

    @Test
    fun dismiss_confirm_sheet_resets() {
        val vm = armedViewModel()
        vm.presentConfirmSheet()
        vm.dismissConfirmSheet()
        assertEquals(ConfirmSheetPhase.Hidden, vm.state.value.sheetPhase)
    }

    @Test
    fun request_biometric_marks_authenticating() {
        val vm = armedViewModel()
        vm.presentConfirmSheet()
        vm.requestBiometric()
        assertEquals(ConfirmSheetPhase.Authenticating, vm.state.value.sheetPhase)
    }

    @Test
    fun biometric_failure_keeps_sheet_open_with_error() {
        val vm = armedViewModel()
        vm.presentConfirmSheet()
        vm.requestBiometric()
        vm.handleBiometricResult(success = false, errorMessage = "Try again")
        assertEquals(ConfirmSheetPhase.Visible, vm.state.value.sheetPhase)
        assertEquals("Try again", vm.state.value.biometricErrorMessage)
        assertFalse(vm.state.value.shouldDismiss)
    }

    @Test
    fun successful_biometric_posts_the_typed_email() =
        runTest(dispatcher) {
            val body = slot<TransferOwnerRequest>()
            coEvery { ownersRepo.transfer(any(), capture(body)) } returns
                NetworkResult.Success(TransferOwnerResponse(message = "Transfer initiated."))
            val vm = armedViewModel()
            vm.presentConfirmSheet()
            vm.requestBiometric()
            vm.handleBiometricResult(success = true)
            advanceUntilIdle()
            assertEquals("buyer@example.com", body.captured.buyerEmail)
            assertEquals(null, body.captured.buyerUserId)
            assertEquals(ConfirmSheetPhase.Dismissing, vm.state.value.sheetPhase)
            assertTrue(vm.state.value.shouldDismiss)
            assertNotNull(vm.state.value.toast)
            assertFalse(vm.state.value.toast!!.isError)
            assertEquals("Transfer initiated.", vm.state.value.toast!!.text)
        }

    @Test
    fun transfer_failure_surfaces_inline_error() =
        runTest(dispatcher) {
            coEvery { ownersRepo.transfer(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = armedViewModel()
            vm.presentConfirmSheet()
            vm.requestBiometric()
            vm.handleBiometricResult(success = true)
            advanceUntilIdle()
            assertEquals(ConfirmSheetPhase.Visible, vm.state.value.sheetPhase)
            assertNotNull(vm.state.value.biometricErrorMessage)
            assertFalse(vm.state.value.shouldDismiss)
        }

    @Test
    fun context_load_failure_surfaces_error_but_keeps_cta_live() =
        runTest(dispatcher) {
            val vm = armedViewModel()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value.contextState is TransferContextState.Error)
            assertTrue(vm.state.value.isReadyToCommit)
        }

    @Test
    fun dirty_picks_up_recipient_typing() {
        val vm = makeViewModel()
        assertFalse(vm.state.value.isDirty)
        vm.updateRecipientEmail("b")
        assertTrue(vm.state.value.isDirty)
    }
}
