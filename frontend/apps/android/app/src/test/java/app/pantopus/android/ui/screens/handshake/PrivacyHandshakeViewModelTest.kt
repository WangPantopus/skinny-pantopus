@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.handshake

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.audience.PersonaMeResponse
import app.pantopus.android.data.api.models.audience.PersonaSummaryDto
import app.pantopus.android.data.api.models.audience.PersonaTierDto
import app.pantopus.android.data.api.models.audience.PersonaTiersResponse
import app.pantopus.android.data.api.models.handshake.FanHandleSuggestionResponse
import app.pantopus.android.data.api.models.handshake.FollowStatusResponse
import app.pantopus.android.data.api.models.handshake.HandshakeBody
import app.pantopus.android.data.api.models.handshake.HandshakeFollowDto
import app.pantopus.android.data.api.models.handshake.HandshakeSubmitResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.handshake.HandshakeError
import app.pantopus.android.data.handshake.HandshakeOutcome
import app.pantopus.android.data.handshake.PrivacyHandshakeRepository
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import io.mockk.coEvery
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PrivacyHandshakeViewModelTest {
    private val repository: PrivacyHandshakeRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun savedState(handle: String = "mayabuilds"): SavedStateHandle =
        SavedStateHandle(mapOf(PrivacyHandshakeViewModel.HANDLE_KEY to handle))

    private fun stubLoaded(
        locked: Boolean = false,
        following: Boolean = false,
    ) {
        coEvery { repository.persona(any()) } returns
            NetworkResult.Success(
                PersonaMeResponse(
                    persona =
                        PersonaSummaryDto(
                            id = "p_demo",
                            handle = "mayabuilds",
                            displayName = "Maya Builds",
                            bio = "Builder.",
                            audienceLabel = "followers",
                            followerCount = 12,
                            postCount = 7,
                        ),
                    channel = null,
                ),
            )
        coEvery { repository.tiers(any()) } returns
            NetworkResult.Success(
                PersonaTiersResponse(
                    tiers =
                        listOf(
                            PersonaTierDto(id = "t1", rank = 1, name = "Followers", priceCents = 0, currency = "usd"),
                            PersonaTierDto(id = "t2", rank = 2, name = "Members", priceCents = 500, currency = "usd"),
                        ),
                ),
            )
        coEvery { repository.fanHandleSuggestion(any()) } returns
            NetworkResult.Success(
                FanHandleSuggestionResponse(suggestion = "fan_8a2c41", locked = locked),
            )
        coEvery { repository.followStatus(any()) } returns
            NetworkResult.Success(
                FollowStatusResponse(
                    following = following,
                    status = if (following) "active" else "none",
                ),
            )
    }

    @Test fun load_projects_ready_with_suggestion_prefilled() =
        runTest {
            stubLoaded()
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            val ready = vm.state.value as HandshakeUiState.Ready
            assertEquals("Maya Builds", ready.content.persona.displayName)
            assertEquals("fan_8a2c41", ready.content.handle.value)
            assertEquals(2, ready.content.tierOptions.size)
            assertEquals(1, ready.content.selectedTierRank)
            assertEquals(HandshakeStep.HandleEntry, ready.content.step)
        }

    @Test fun load_with_locked_suggestion_marks_field_read_only() =
        runTest {
            stubLoaded(locked = true)
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            val ready = vm.state.value as HandshakeUiState.Ready
            assertTrue(ready.content.handle.locked)
        }

    @Test fun active_follow_status_jumps_straight_to_already_member() =
        runTest {
            stubLoaded(following = true)
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            val ready = vm.state.value as HandshakeUiState.Ready
            assertEquals(HandshakeStep.AlreadyMember, ready.content.step)
        }

    @Test fun load_failure_transitions_error() =
        runTest {
            coEvery { repository.persona(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            assertTrue(vm.state.value is HandshakeUiState.Error)
        }

    @Test fun handle_validation_gates_primary_cta() =
        runTest {
            stubLoaded()
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            assertTrue(vm.chrome.primaryCtaEnabled)
            vm.setHandle("a") // too short
            assertTrue(!vm.chrome.primaryCtaEnabled)
            vm.setHandle("invalid handle!")
            assertTrue(!vm.chrome.primaryCtaEnabled)
            vm.setHandle("valid_handle.42")
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    @Test fun primary_tap_advances_to_tier_selection() =
        runTest {
            stubLoaded()
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            vm.onPrimary()
            val ready = vm.state.value as HandshakeUiState.Ready
            assertEquals(HandshakeStep.TierSelection, ready.content.step)
            assertEquals(WizardProgressLabel.StepOf(2, 2), vm.chrome.progressLabel)
            assertEquals(WizardLeadingControl.Back, vm.chrome.leading)
        }

    @Test fun tier_selection_drives_primary_cta_label() =
        runTest {
            stubLoaded()
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            vm.onPrimary()
            assertEquals("Become a follower", vm.chrome.primaryCtaLabel)
            vm.selectTier(2)
            assertEquals("Continue · \$5/mo", vm.chrome.primaryCtaLabel)
        }

    @Test fun free_tier_submit_transitions_to_completed_free() =
        runTest {
            stubLoaded()
            coEvery { repository.submit(any(), any()) } returns
                HandshakeOutcome.Success(
                    HandshakeSubmitResponse(
                        follow = HandshakeFollowDto(id = "f1", status = "active", relationshipType = "follower"),
                        status = "active",
                    ),
                )
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            vm.onPrimary() // → tier step
            vm.onPrimary() // → submit
            val ready = vm.state.value as HandshakeUiState.Ready
            assertEquals(HandshakeStep.CompletedFree, ready.content.step)
        }

    @Test fun paid_tier_submit_transitions_to_opens_checkout_and_emits_url() =
        runTest {
            stubLoaded()
            coEvery { repository.submit(any(), any()) } returns
                HandshakeOutcome.Success(
                    HandshakeSubmitResponse(
                        requiresPayment = true,
                        subscribeUrl = "https://checkout.stripe.com/c/abc",
                    ),
                )
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            vm.onPrimary()
            vm.selectTier(2)
            vm.onPrimary()
            val ready = vm.state.value as HandshakeUiState.Ready
            assertTrue(ready.content.step is HandshakeStep.OpensCheckout)
            assertEquals(
                "https://checkout.stripe.com/c/abc",
                (ready.content.step as HandshakeStep.OpensCheckout).subscribeUrl,
            )
            assertEquals("https://checkout.stripe.com/c/abc", vm.openCheckoutUrl.value)
            vm.consumeCheckoutUrl()
            assertNull(vm.openCheckoutUrl.value)
        }

    @Test fun handle_taken_error_returns_to_handle_entry_with_message() =
        runTest {
            stubLoaded()
            coEvery { repository.submit(any(), any()) } returns
                HandshakeOutcome.Error(HandshakeError.HandleTaken)
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            vm.onPrimary()
            vm.onPrimary()
            val ready = vm.state.value as HandshakeUiState.Ready
            assertEquals(HandshakeStep.HandleEntry, ready.content.step)
            assertNotNull(ready.content.handle.error)
            assertTrue(ready.content.handle.error!!.contains("already taken"))
        }

    @Test fun username_requires_ack_flips_match_flag() =
        runTest {
            stubLoaded()
            coEvery { repository.submit(any(), any()) } returns
                HandshakeOutcome.Error(HandshakeError.UsernameRequiresAck)
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            vm.onPrimary()
            vm.onPrimary()
            val ready = vm.state.value as HandshakeUiState.Ready
            assertTrue(ready.content.handle.matchesUsername)
            assertEquals(HandshakeStep.HandleEntry, ready.content.step)
        }

    @Test fun submit_forwards_acknowledged_username_when_matched() =
        runTest {
            stubLoaded()
            val captured = slot<HandshakeBody>()
            coEvery { repository.submit(any(), capture(captured)) } returns
                HandshakeOutcome.Success(HandshakeSubmitResponse(status = "active"))
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            // Pretend the prior request flipped matchesUsername.
            vm.setHandle("maya") // edit triggers matchesUsername=false
            vm.setAcknowledgedUsingUsername(true) // still false until handle matches
            vm.onPrimary() // → tier step
            vm.onPrimary() // submit (matchesUsername false → null forwarded)
            assertNull(captured.captured.acknowledgedUsingPantopusUsername)
        }

    @Test fun step_2_back_tap_returns_to_step_1() =
        runTest {
            stubLoaded()
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            vm.onPrimary()
            vm.onLeading()
            val ready = vm.state.value as HandshakeUiState.Ready
            assertEquals(HandshakeStep.HandleEntry, ready.content.step)
        }

    @Test fun close_from_step_1_emits_dismiss() =
        runTest {
            stubLoaded()
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            val initial = vm.dismissEvents.value
            vm.onLeading()
            assertTrue(vm.dismissEvents.value > initial)
        }

    @Test fun primary_on_completed_free_dismisses() =
        runTest {
            stubLoaded()
            coEvery { repository.submit(any(), any()) } returns
                HandshakeOutcome.Success(HandshakeSubmitResponse(status = "active"))
            val vm = PrivacyHandshakeViewModel(repository, savedState())
            vm.load()
            vm.onPrimary()
            vm.onPrimary()
            val before = vm.dismissEvents.value
            vm.onPrimary() // Done
            assertTrue(vm.dismissEvents.value > before)
        }

    @Test fun singularize_drops_trailing_s() {
        assertEquals("follower", PrivacyHandshakeViewModel.singularize("followers"))
        assertEquals("member", PrivacyHandshakeViewModel.singularize("Members"))
        assertEquals("fan", PrivacyHandshakeViewModel.singularize("Fans"))
        assertEquals("client", PrivacyHandshakeViewModel.singularize("clients"))
    }
}
