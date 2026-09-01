@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.members

import app.cash.turbine.test
import app.pantopus.android.data.api.models.homes.InvitationDto
import app.pantopus.android.data.api.models.homes.InviteMemberRequest
import app.pantopus.android.data.api.models.homes.InviteMemberResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * T6.3a / P9 — Invite Member wizard. Mirrors iOS
 * `InviteMemberWizardViewModelTests` 1:1.
 *
 * Covers:
 *  - email validation (loose form)
 *  - step progression + primary CTA enable state
 *  - onLeading on first step emits Dismiss; on interior steps walks back
 *  - submit happy path emits Submitted with the invitation
 *  - submit failure surfaces errorMessage + stays on Review
 *  - role selection maps to the wire `relationship` field
 */
@OptIn(ExperimentalCoroutinesApi::class)
class InviteMemberWizardViewModelTest {
    private val repo: HomeMembersRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(scope: CoroutineScope? = null): InviteMemberWizardViewModel =
        InviteMemberWizardViewModel(
            homeId = "home_1",
            repo = repo,
            viewModelScopeOverride = scope,
        )

    // ─── Validation ───────────────────────────────────────────────

    @Test
    fun email_validation_accepts_canonical_address() {
        assertTrue(InviteMemberWizardViewModel.isValidEmail("user@example.com"))
        assertTrue(InviteMemberWizardViewModel.isValidEmail(" user@example.com "))
    }

    @Test
    fun email_validation_rejects_obviously_malformed() {
        assertFalse(InviteMemberWizardViewModel.isValidEmail(""))
        assertFalse(InviteMemberWizardViewModel.isValidEmail("nope"))
        assertFalse(InviteMemberWizardViewModel.isValidEmail("@example.com"))
        assertFalse(InviteMemberWizardViewModel.isValidEmail("user@nodot"))
    }

    // ─── Step progression ─────────────────────────────────────────

    @Test
    fun primary_enabled_on_role_step_without_form_data() {
        val vm = makeVm()
        assertEquals("Next", vm.chrome.primaryCtaLabel)
        assertTrue(vm.chrome.primaryCtaEnabled)
    }

    @Test
    fun primary_disabled_on_identify_until_valid_email() {
        val vm = makeVm()
        vm.onPrimary() // role → identify
        assertEquals(InviteMemberStep.Identify, vm.state.value.currentStep)
        assertFalse(vm.chrome.primaryCtaEnabled)
        vm.setEmail("user@example.com")
        assertTrue(vm.chrome.primaryCtaEnabled)
    }

    @Test
    fun review_step_carries_send_invite_label() {
        val vm = makeVm()
        vm.setEmail("user@example.com")
        vm.onPrimary() // role → identify
        vm.onPrimary() // identify → review
        assertEquals(InviteMemberStep.Review, vm.state.value.currentStep)
        assertEquals("Send invite", vm.chrome.primaryCtaLabel)
    }

    @Test
    fun leading_from_role_step_emits_dismiss() {
        val vm = makeVm()
        vm.onLeading()
        assertEquals(InviteMemberEvent.Dismiss, vm.pendingEvent.value)
    }

    @Test
    fun leading_from_interior_step_steps_back() {
        val vm = makeVm()
        vm.onPrimary() // → identify
        vm.onLeading()
        assertEquals(InviteMemberStep.Role, vm.state.value.currentStep)
        assertNull(vm.pendingEvent.value)
    }

    // ─── Submit ───────────────────────────────────────────────────

    @Test
    fun submit_success_emits_invitation_event() =
        runTest {
            val captured = slot<InviteMemberRequest>()
            coEvery { repo.invite("home_1", capture(captured)) } returns
                NetworkResult.Success(
                    InviteMemberResponse(
                        invitation =
                            InvitationDto(
                                id = "inv_new",
                                homeId = "home_1",
                                inviteeEmail = "a@b.com",
                                proposedRole = "member",
                                createdAt = "2026-05-15T12:00:00Z",
                            ),
                    ),
                )
            val vm = makeVm(scope = this)
            vm.setEmail("a@b.com")
            vm.onPrimary() // role → identify
            vm.onPrimary() // identify → review
            vm.pendingEvent.test {
                assertNull(awaitItem())
                vm.onPrimary() // submit
                val event = awaitItem() as InviteMemberEvent.Submitted
                assertEquals("inv_new", event.invitation.id)
                assertEquals("a@b.com", event.invitation.inviteeEmail)
                cancelAndConsumeRemainingEvents()
            }
            assertEquals("a@b.com", captured.captured.email)
            assertEquals("member", captured.captured.relationship)
        }

    @Test
    fun submit_failure_surfaces_error_message_and_stays_on_review() =
        runTest {
            coEvery { repo.invite("home_1", any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "oops"))
            val vm = makeVm(scope = this)
            vm.setEmail("a@b.com")
            vm.onPrimary() // → identify
            vm.onPrimary() // → review
            vm.onPrimary() // submit
            advanceUntilIdle()
            assertNull(vm.pendingEvent.value)
            assertNotNull(vm.state.value.errorMessage)
            assertEquals(InviteMemberStep.Review, vm.state.value.currentStep)
        }

    // ─── Role → relationship mapping ──────────────────────────────

    @Test
    fun role_guest_requests_guest_relationship() =
        runTest {
            val captured = slot<InviteMemberRequest>()
            coEvery { repo.invite("home_1", capture(captured)) } returns
                NetworkResult.Success(
                    InviteMemberResponse(
                        invitation =
                            InvitationDto(
                                id = "inv_g",
                                homeId = "home_1",
                                inviteeEmail = "g@e.com",
                                proposedRole = "guest",
                            ),
                    ),
                )
            val vm = makeVm(scope = this)
            vm.setRole(MemberRole.Guest)
            vm.setEmail("g@e.com")
            vm.onPrimary()
            vm.onPrimary()
            vm.onPrimary()
            advanceUntilIdle()
            assertEquals("guest", captured.captured.relationship)
            coVerify { repo.invite("home_1", any()) }
        }

    // ─── Chrome ───────────────────────────────────────────────────

    @Test
    fun chrome_reports_three_steps_and_progress() {
        val vm = makeVm()
        val progress = vm.chrome.progressLabel as app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel.StepOf
        assertEquals(3, progress.total)
        assertNotNull(vm.chrome.progressFraction)
    }

    @Test
    fun dirty_once_form_changes() {
        val vm = makeVm()
        assertFalse(vm.chrome.dirty)
        vm.setEmail("anything")
        assertTrue(vm.chrome.dirty)
    }
}
