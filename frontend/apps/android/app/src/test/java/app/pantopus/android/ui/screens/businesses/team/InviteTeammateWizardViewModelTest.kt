@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.team

import app.pantopus.android.data.api.models.businesses.BusinessSeatDto
import app.pantopus.android.data.api.models.businesses.BusinessSeatInviteResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessTeamRepository
import io.mockk.coEvery
import io.mockk.mockk
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
 * B2C — Invite Teammate wizard. Mirrors iOS
 * `InviteTeammateWizardViewModelTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class InviteTeammateWizardViewModelTest {
    private val repo: BusinessTeamRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(scope: CoroutineScope? = null): InviteTeammateWizardViewModel =
        InviteTeammateWizardViewModel(businessId = "biz_1", repo = repo, viewModelScopeOverride = scope)

    @Test
    fun email_validation() {
        assertTrue(InviteTeammateWizardViewModel.isValidEmail("user@example.com"))
        assertFalse(InviteTeammateWizardViewModel.isValidEmail("nope"))
        assertFalse(InviteTeammateWizardViewModel.isValidEmail(""))
    }

    @Test
    fun primary_gated_on_identify_until_name_and_email() {
        val vm = makeVm()
        assertTrue(vm.chrome.primaryCtaEnabled) // role step
        vm.onPrimary()
        assertEquals(InviteTeammateStep.Identify, vm.state.value.currentStep)
        assertFalse(vm.chrome.primaryCtaEnabled)
        vm.setDisplayName("Front Desk")
        assertFalse(vm.chrome.primaryCtaEnabled) // still needs email
        vm.setEmail("fd@example.com")
        assertTrue(vm.chrome.primaryCtaEnabled)
    }

    @Test
    fun review_step_carries_send_invite_label() {
        val vm = makeVm()
        vm.setDisplayName("Front Desk")
        vm.setEmail("fd@example.com")
        vm.onPrimary() // role → identify
        vm.onPrimary() // identify → review
        assertEquals(InviteTeammateStep.Review, vm.state.value.currentStep)
        assertEquals("Send invite", vm.chrome.primaryCtaLabel)
    }

    @Test
    fun leading_from_role_emits_dismiss_and_interior_steps_back() {
        val vm = makeVm()
        vm.onLeading()
        assertEquals(InviteTeammateEvent.Dismiss, vm.pendingEvent.value)

        val vm2 = makeVm()
        vm2.onPrimary() // → identify
        vm2.onLeading()
        assertEquals(InviteTeammateStep.Role, vm2.state.value.currentStep)
        assertNull(vm2.pendingEvent.value)
    }

    @Test
    fun submit_success_emits_seat_event() =
        runTest {
            coEvery { repo.inviteSeat(any(), any()) } returns
                NetworkResult.Success(
                    BusinessSeatInviteResponse(
                        seat =
                            BusinessSeatDto(
                                id = "seat_new",
                                displayName = "Front Desk",
                                roleBase = "viewer",
                                inviteStatus = "pending",
                                inviteEmail = "fd@example.com",
                            ),
                        inviteToken = "tok_123",
                    ),
                )
            val vm = makeVm(this)
            vm.setRole(BusinessRole.Viewer)
            vm.setDisplayName("Front Desk")
            vm.setEmail("fd@example.com")
            vm.onPrimary()
            vm.onPrimary()
            vm.onPrimary() // submit
            advanceUntilIdle()
            val event = vm.pendingEvent.value
            assertTrue(event is InviteTeammateEvent.Submitted)
            assertEquals("seat_new", (event as InviteTeammateEvent.Submitted).seat.id)
            assertNull(vm.state.value.errorMessage)
        }

    @Test
    fun submit_failure_surfaces_error_and_stays_on_review() =
        runTest {
            coEvery { repo.inviteSeat(any(), any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm(this)
            vm.setDisplayName("Front Desk")
            vm.setEmail("fd@example.com")
            vm.onPrimary()
            vm.onPrimary()
            vm.onPrimary() // submit
            advanceUntilIdle()
            assertNull(vm.pendingEvent.value)
            assertNotNull(vm.state.value.errorMessage)
            assertEquals(InviteTeammateStep.Review, vm.state.value.currentStep)
        }
}
