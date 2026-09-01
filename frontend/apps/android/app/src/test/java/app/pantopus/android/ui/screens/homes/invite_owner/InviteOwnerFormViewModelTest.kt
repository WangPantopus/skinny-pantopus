@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.invite_owner

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.InviteOwnerResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class InviteOwnerFormViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val homesRepo: HomesRepository = mockk(relaxed = true)

    @Before fun setUp() {
        Dispatchers.setMain(dispatcher)
        coEvery { homesRepo.inviteOwner(any(), any()) } returns
            NetworkResult.Success(InviteOwnerResponse(message = "ok", claimId = "c1"))
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(
        currentEmail: String = "me@example.com",
        homeId: String = "home-1",
    ): InviteOwnerFormViewModel =
        InviteOwnerFormViewModel(
            savedStateHandle =
                SavedStateHandle(
                    mapOf(
                        INVITE_OWNER_HOME_ID_KEY to homeId,
                        INVITE_OWNER_CURRENT_EMAIL_KEY to currentEmail,
                    ),
                ),
            homesRepo = homesRepo,
        ).also { it.load() }

    @Test fun initial_state_is_clean_and_invalid_until_contact_is_entered() {
        val vm = makeVm()
        val state = vm.state.value
        assertFalse(state.isDirty)
        assertFalse(state.isValid)
        assertEquals(25, state.grantPercent)
        assertEquals(75, state.owners.first().sharePercent)
    }

    @Test fun email_validation_rejects_garbage() {
        val vm = makeVm()
        vm.update(InviteOwnerField.Email, "not-an-email")
        val state = vm.state.value
        assertNotNull(state.fields[InviteOwnerField.Email]?.error)
        assertFalse(state.isValid)
    }

    @Test fun email_rejects_self_invite_case_insensitive() {
        val vm = makeVm(currentEmail = "Alex@example.com")
        vm.update(InviteOwnerField.Email, "alex@example.com")
        val state = vm.state.value
        assertEquals("You can't invite yourself.", state.fields[InviteOwnerField.Email]?.error)
    }

    @Test fun phone_optional_accepts_empty_formatted_us_and_e164() {
        val vm = makeVm()
        vm.update(InviteOwnerField.Email, "x@y.com")
        vm.update(InviteOwnerField.Phone, "")
        assertNull(vm.state.value.fields[InviteOwnerField.Phone]?.error)
        assertTrue(vm.state.value.isValid)

        vm.update(InviteOwnerField.Phone, "555-1212")
        assertNotNull(vm.state.value.fields[InviteOwnerField.Phone]?.error)
        assertFalse(vm.state.value.isValid)

        vm.update(InviteOwnerField.Phone, "(415) 555-0198")
        assertNull(vm.state.value.fields[InviteOwnerField.Phone]?.error)
        assertTrue(vm.state.value.isValid)

        vm.update(InviteOwnerField.Phone, "+15555550123")
        assertNull(vm.state.value.fields[InviteOwnerField.Phone]?.error)
        assertTrue(vm.state.value.isValid)
    }

    @Test fun role_note_is_capped_at_max_length() {
        val vm = makeVm()
        vm.update(InviteOwnerField.Role, "a".repeat(InviteOwnerSampleData.NOTE_MAX_LENGTH + 10))
        assertEquals(InviteOwnerSampleData.NOTE_MAX_LENGTH, vm.state.value.fields[InviteOwnerField.Role]?.value?.length)
    }

    @Test fun single_owner_grant_adjusts_you_keep_share() {
        val vm = makeVm()
        vm.updateGrantPercent(40)
        val state = vm.state.value
        assertEquals(60, state.owners.first().sharePercent)
        assertEquals(40, state.availablePool)
        assertFalse(state.hasShareConflict)
    }

    @Test fun conflict_frame_reports_overage_and_disables_send() {
        val vm = makeVm(homeId = "home-conflict")
        val state = vm.state.value
        assertEquals(20, state.availablePool)
        assertEquals(110, state.totalAfterGrant)
        assertEquals(10, state.conflictOverage)
        assertTrue(state.hasShareConflict)
        assertFalse(state.isValid)
        assertEquals(
            "Total would be 110%. Maria holds 50% and Marcus holds 30%. Pick 20% or less, or rebalance existing shares.",
            state.conflictMessage,
        )
    }

    @Test fun snap_to_available_clears_conflict() {
        val vm = makeVm(homeId = "home-conflict")
        vm.snapGrantToAvailablePool()
        val state = vm.state.value
        assertEquals(20, state.grantPercent)
        assertEquals(100, state.totalAfterGrant)
        assertFalse(state.hasShareConflict)
        assertTrue(state.isValid)
    }

    @Test fun rebalance_scales_existing_owners_to_fit_grant() {
        val vm = makeVm(homeId = "home-conflict")
        vm.rebalanceShares()
        val state = vm.state.value
        assertEquals(30, state.grantPercent)
        assertEquals(100, state.totalAfterGrant)
        assertEquals(listOf(44, 26), state.owners.map { it.sharePercent })
        assertFalse(state.hasShareConflict)
        assertTrue(state.isValid)
    }

    @Test fun submit_happy_path_dismisses_form() =
        runTest(dispatcher) {
            val vm = makeVm(homeId = "home-valid")
            vm.submit()
            advanceUntilIdle()
            assertEquals("Invite sent.", vm.state.value.toast?.text)
            assertTrue(vm.state.value.shouldDismiss)
        }

    @Test fun submit_with_invalid_email_does_not_dismiss() =
        runTest(dispatcher) {
            val vm = makeVm()
            vm.update(InviteOwnerField.Email, "garbage")
            vm.submit()
            assertFalse(vm.state.value.shouldDismiss)
            assertEquals(true, vm.state.value.toast?.isError)
        }

    @Test fun fast_track_defaults_on_and_rides_the_invite_body() =
        runTest(dispatcher) {
            val vm = makeVm(homeId = "home-valid")
            assertTrue(vm.state.value.fastTrack)
            vm.submit()
            advanceUntilIdle()
            coVerify { homesRepo.inviteOwner("home-valid", match { it.fastTrack }) }
        }

    @Test fun fast_track_can_be_switched_off() =
        runTest(dispatcher) {
            val vm = makeVm(homeId = "home-valid")
            vm.updateFastTrack(false)
            assertFalse(vm.state.value.fastTrack)
            vm.submit()
            advanceUntilIdle()
            coVerify { homesRepo.inviteOwner("home-valid", match { !it.fastTrack }) }
        }

    @Test fun submit_with_conflict_requires_resolution() =
        runTest(dispatcher) {
            val vm = makeVm(homeId = "home-conflict")
            vm.submit()
            assertFalse(vm.state.value.shouldDismiss)
            assertEquals("Resolve the ownership split first.", vm.state.value.toast?.text)
        }
}
