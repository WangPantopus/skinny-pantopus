@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.token_accept

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.token_accept.BusinessSeatAcceptResponse
import app.pantopus.android.data.api.models.token_accept.BusinessSeatBusinessDto
import app.pantopus.android.data.api.models.token_accept.BusinessSeatInviteResponse
import app.pantopus.android.data.api.models.token_accept.GuestPassDto
import app.pantopus.android.data.api.models.token_accept.GuestPassResponse
import app.pantopus.android.data.api.models.token_accept.HomeInviteHomeDto
import app.pantopus.android.data.api.models.token_accept.LeaseInviteAcceptanceResponse
import app.pantopus.android.data.api.models.token_accept.LeaseInviteDetailsDto
import app.pantopus.android.data.api.models.token_accept.LeaseInviteOccupancy
import app.pantopus.android.data.api.models.token_accept.LeaseInvitePreviewResponse
import app.pantopus.android.data.api.models.token_accept.LeaseInviteReceipt
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeInvitationPreview
import app.pantopus.android.data.token_accept.TokenAcceptRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TokenAcceptViewModelTest {
    private val repository: TokenAcceptRepository = mockk()
    private val auth: AuthRepository = mockk()
    private val invitations: HomeInvitationDecisionFactory = mockk()
    private val session: HomeClaimSessionScope = mockk()
    private val models = mutableListOf<TokenAcceptViewModel>()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        val signed =
            AuthRepository.State.SignedIn(
                user = UserDto(id = "u1", email = "alice@example.com", displayName = "Alice", avatarUrl = null),
            )
        every { auth.state } returns MutableStateFlow<AuthRepository.State>(signed)
        every { invitations.session(any()) } returns session
        every { session.isCurrent } returns true
        every { session.invalidated } returns MutableStateFlow(false)
        coEvery { session.requireCurrent() } returns Unit
        coEvery { invitations.hasOriginal(any()) } returns false
        coEvery { invitations.preview(any()) } returns HomeInvitationPreview.Missing
    }

    @After fun tearDown() {
        models.forEach { it.pause() }
        Dispatchers.resetMain()
    }

    private fun savedState(token: String = "demo"): SavedStateHandle = SavedStateHandle(mapOf(TokenAcceptViewModel.TOKEN_KEY to token))

    private fun model(state: SavedStateHandle = savedState()): TokenAcceptViewModel =
        TokenAcceptViewModel(repository, auth, state, invitations).also { models += it }

    @Test fun home_invite_opens_protected_decision_recovery() =
        runTest {
            coEvery { invitations.preview(any()) } returns HomeInvitationPreview.Found
            coEvery { repository.businessSeatInvite(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = model()
            vm.load()
            assertEquals(TokenAcceptUiState.HomeInvitation, vm.state.value)
            vm.accept()
            vm.decline()
            coVerify(exactly = 0) { repository.acceptHomeInvite(any()) }
            coVerify(exactly = 0) { repository.declineHomeInvite(any()) }
        }

    @Test fun saved_original_precedes_any_new_link_preview() =
        runTest {
            coEvery { invitations.hasOriginal(any()) } returns true
            val vm = model()
            vm.load()
            assertEquals(TokenAcceptUiState.HomeInvitation, vm.state.value)
            coVerify(exactly = 0) { invitations.preview(any()) }
        }

    @Test fun unavailable_preview_is_retryable_and_never_expired() =
        runTest {
            coEvery { invitations.preview(any()) } returns HomeInvitationPreview.Unavailable
            coEvery { repository.businessSeatInvite(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = model()
            vm.load()
            assertTrue(vm.state.value is TokenAcceptUiState.Error)
            coEvery { invitations.preview(any()) } returns HomeInvitationPreview.Found
            vm.load()
            assertEquals(TokenAcceptUiState.HomeInvitation, vm.state.value)
        }

    // MARK: - Business seat

    @Test fun business_seat_resolves() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.businessSeatInvite(any()) } returns
                NetworkResult.Success(
                    BusinessSeatInviteResponse(
                        seatId = "ddc24300-0000-4000-8000-000000000004",
                        business = BusinessSeatBusinessDto(id = "b1", name = "Bridge Builders LLC"),
                        displayName = "Alice — Manager",
                        roleBase = "manager",
                        inviteEmail = "alice@example.com",
                    ),
                )
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            val vm = model()
            vm.load()
            val ready = vm.state.value as TokenAcceptUiState.Ready
            assertEquals(InviteType.BusinessSeat, ready.offer.inviteType)
            assertEquals("ddc24300-0000-4000-8000-000000000004", ready.offer.invitationId)
            assertEquals("Manager", ready.offer.roleOffered)
            assertTrue(ready.offer.venue.contains("Bridge"))
        }

    @Test fun business_seat_accept_succeeds() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.businessSeatInvite(any()) } returns
                NetworkResult.Success(
                    BusinessSeatInviteResponse(
                        seatId = "ddc24300-0000-4000-8000-000000000004",
                        business = BusinessSeatBusinessDto(name = "Bridge Builders LLC"),
                        roleBase = "manager",
                    ),
                )
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.acceptBusinessSeat(any(), any()) } returns
                NetworkResult.Success(
                    BusinessSeatAcceptResponse(
                        seatId = "ddc24300-0000-4000-8000-000000000004",
                        businessUserId = "b1",
                        roleBase = "manager",
                    ),
                )
            val vm = model()
            vm.load()
            vm.accept()
            val accepted = vm.state.value as TokenAcceptUiState.Accepted
            assertEquals(InviteType.BusinessSeat, accepted.offer.inviteType)
        }

    // MARK: - Guest pass

    @Test fun guest_pass_resolves() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.businessSeatInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.guestPass(any()) } returns
                NetworkResult.Success(
                    GuestPassResponse(
                        pass =
                            GuestPassDto(
                                label = "Marie's place",
                                kind = "weekend_stay",
                                expiresAt = "2026-05-22T18:00:00Z",
                                homeName = "Marie's place",
                                welcomeMessage = "Wifi is on the fridge — make yourself at home.",
                            ),
                    ),
                )
            val vm = model()
            vm.load()
            val ready = vm.state.value as TokenAcceptUiState.Ready
            assertEquals(InviteType.GuestPass, ready.offer.inviteType)
            assertNull(ready.offer.invitationId)
            assertTrue(ready.offer.venue.contains("Marie"))
            assertEquals("View guest pass", ready.offer.primaryCtaLabel)
            assertTrue(ready.offer.benefits.any { it.contains("Wifi") })
        }

    @Test fun guest_pass_accept_is_local_no_post() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.businessSeatInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.guestPass(any()) } returns
                NetworkResult.Success(
                    GuestPassResponse(
                        pass =
                            GuestPassDto(
                                label = "Marie's place",
                                homeName = "Marie's place",
                                expiresAt = "2026-05-22T18:00:00Z",
                            ),
                    ),
                )
            val vm = model()
            vm.load()
            vm.accept()
            // No POST should fire — we never told the repo to expect
            // acceptHomeInvite / acceptBusinessSeat, so a call would
            // throw inside mockk.
            assertTrue(vm.state.value is TokenAcceptUiState.Accepted)
        }

    // MARK: - Edge cases

    @Test fun all_404_falls_to_expired() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.businessSeatInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            val vm = model()
            vm.load()
            assertTrue(vm.state.value is TokenAcceptUiState.Expired)
        }

    @Test fun blank_token_short_circuits_to_expired() =
        runTest {
            val vm = model(savedState(token = ""))
            vm.load()
            assertTrue(vm.state.value is TokenAcceptUiState.Expired)
        }

    @Test fun failed_business_decline_keeps_a_retryable_error() =
        runTest {
            coEvery { repository.businessSeatInvite(any()) } returns
                NetworkResult.Success(
                    BusinessSeatInviteResponse(seatId = "ddc24300-0000-4000-8000-000000000004", roleBase = "member"),
                )
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
            coEvery { repository.declineBusinessSeat(any()) } returns NetworkResult.Failure(NetworkError.Server(503, null))
            val vm = model()
            vm.load()
            vm.decline()
            assertTrue(vm.state.value is TokenAcceptUiState.Error)
            assertEquals(0, vm.dismissEvents.value)
        }

    private val leaseToken = "a".repeat(64)
    private val leaseHome = "ddc24300-0000-4000-8000-000000000003"

    private fun leasePreview() =
        LeaseInvitePreviewResponse(
            HomeInviteHomeDto(leaseHome, "Existing rental", "Test"),
            LeaseInviteDetailsDto("pending", "2026-09-15T00:00:00+00:00", "2027-09-15T00:00:00+00:00", "2099-01-01T00:00:00+00:00"),
            "alice@example.com",
        )

    private fun leaseReceipt() =
        LeaseInviteAcceptanceResponse(
            LeaseInviteReceipt("ddc24300-0000-4000-8000-000000000006", leaseHome, "u1", "active"),
            LeaseInviteOccupancy("ddc24300-0000-4000-8000-000000000005", leaseHome, "u1", true, "verified"),
        )

    private fun leaseModel(): TokenAcceptViewModel {
        every { session.actorId } returns "u1"
        coEvery { repository.leaseInvite(leaseToken) } returns NetworkResult.Success(leasePreview())
        return model(SavedStateHandle(mapOf(TokenAcceptViewModel.TOKEN_KEY to leaseToken, "leaseInvitation" to true)))
    }

    @Test fun lease_link_previews_only_the_recipient_route_and_never_accepts_automatically() =
        runTest {
            val vm = leaseModel()
            vm.load()
            val ready = vm.state.value as TokenAcceptUiState.Ready
            assertEquals(InviteType.LeaseInvite, ready.offer.inviteType)
            assertEquals("alice@example.com", ready.offer.identityChip.label)
            assertEquals(listOf("Starts: 2026-09-15", "Ends: 2027-09-15"), ready.offer.benefits)
            coVerify(exactly = 0) { repository.acceptLeaseInvite(any()) }
            coVerify(exactly = 0) { repository.businessSeatInvite(any()) }
            coVerify(exactly = 0) { repository.guestPass(any()) }
            coVerify(exactly = 0) { invitations.preview(any()) }
        }

    @Test fun lease_acceptance_validates_current_membership() =
        runTest {
            val vm = leaseModel()
            coEvery { repository.acceptLeaseInvite(leaseToken) } returns NetworkResult.Success(leaseReceipt())
            vm.load()
            vm.accept()
            assertEquals("Your lease acceptance is saved.", (vm.state.value as TokenAcceptUiState.Accepted).message)
        }

    @Test fun lease_not_now_closes_without_sending_a_decision() =
        runTest {
            val vm = leaseModel()
            vm.load()
            vm.decline()
            assertEquals(1, vm.dismissEvents.value)
            coVerify(exactly = 0) { repository.acceptLeaseInvite(any()) }
            coVerify(exactly = 0) { repository.declineBusinessSeat(any()) }
        }

    @Test fun lost_lease_acceptance_reply_rechecks_then_retries_the_same_proof() =
        runTest {
            val vm = leaseModel()
            coEvery { repository.acceptLeaseInvite(leaseToken) } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Server(503, null)), NetworkResult.Success(leaseReceipt()),
                )
            vm.load()
            vm.accept()
            assertTrue(vm.state.value is TokenAcceptUiState.Error)
            coEvery { repository.leaseInvite(leaseToken) } returns
                NetworkResult.Success(
                    leasePreview().copy(invitation = leasePreview().invitation.copy(status = "accepted")),
                )
            vm.load()
            assertEquals("Check saved acceptance", (vm.state.value as TokenAcceptUiState.Ready).offer.primaryCtaLabel)
            coVerify(exactly = 1) { repository.acceptLeaseInvite(leaseToken) }
            vm.accept()
            assertTrue(vm.state.value is TokenAcceptUiState.Accepted)
            coVerify(exactly = 2) { repository.acceptLeaseInvite(leaseToken) }
        }

    @Test fun lease_denial_and_provider_failure_hide_the_offer() =
        runTest {
            for (status in listOf(403, 404, 410, 503)) {
                val vm = leaseModel()
                coEvery { repository.leaseInvite(leaseToken) } returns NetworkResult.Failure(NetworkError.Server(status, null))
                vm.load()
                if (status == 410) {
                    assertTrue(vm.state.value is TokenAcceptUiState.Expired)
                } else {
                    assertTrue(vm.state.value is TokenAcceptUiState.Error)
                }
                vm.accept()
            }
            coVerify(exactly = 0) { repository.acceptLeaseInvite(any()) }
        }

    @Test fun invalid_lease_preview_scope_account_dates_or_state_never_offers_acceptance() =
        runTest {
            for (preview in listOf(
                leasePreview().copy(accountEmail = "other@example.com"),
                leasePreview().copy(home = leasePreview().home.copy(id = "invalid")),
                leasePreview().copy(invitation = leasePreview().invitation.copy(proposedEnd = "2025-09-15T00:00:00Z")),
                leasePreview().copy(invitation = leasePreview().invitation.copy(status = "revoked")),
            )) {
                val vm = leaseModel()
                coEvery { repository.leaseInvite(leaseToken) } returns NetworkResult.Success(preview)
                vm.load()
                assertTrue(vm.state.value is TokenAcceptUiState.Error)
            }
        }

    @Test fun mismatched_or_inactive_lease_receipt_never_reports_success() =
        runTest {
            for (receipt in listOf(
                leaseReceipt().copy(lease = leaseReceipt().lease.copy(homeId = "other")),
                leaseReceipt().copy(lease = leaseReceipt().lease.copy(primaryResidentUserId = "other")),
                leaseReceipt().copy(occupancy = leaseReceipt().occupancy.copy(isActive = false)),
                leaseReceipt().copy(occupancy = leaseReceipt().occupancy.copy(verificationStatus = "provisional")),
            )) {
                val vm = leaseModel()
                coEvery { repository.acceptLeaseInvite(leaseToken) } returns NetworkResult.Success(receipt)
                vm.load()
                vm.accept()
                assertTrue(vm.state.value is TokenAcceptUiState.Error)
            }
        }

    @Test fun late_lease_preview_after_close_cannot_restore_offer_or_send_acceptance() =
        runTest {
            val vm = leaseModel()
            val delayed = CompletableDeferred<NetworkResult<LeaseInvitePreviewResponse>>()
            coEvery { repository.leaseInvite(leaseToken) } coAnswers { delayed.await() }
            vm.load()
            vm.dismiss()
            delayed.complete(NetworkResult.Success(leasePreview()))
            runCurrent()
            assertEquals(TokenAcceptUiState.Loading, vm.state.value)
            vm.accept()
            coVerify(exactly = 0) { repository.acceptLeaseInvite(any()) }
        }

    @Test fun late_lease_acceptance_after_close_cannot_publish_success() =
        runTest {
            val vm = leaseModel()
            val delayed = CompletableDeferred<NetworkResult<LeaseInviteAcceptanceResponse>>()
            coEvery { repository.acceptLeaseInvite(leaseToken) } coAnswers { delayed.await() }
            vm.load()
            vm.accept()
            vm.dismiss()
            delayed.complete(NetworkResult.Success(leaseReceipt()))
            runCurrent()
            assertEquals(TokenAcceptUiState.Loading, vm.state.value)
        }

    @Test fun changed_account_during_lease_acceptance_cannot_publish_success() =
        runTest {
            val vm = leaseModel()
            val delayed = CompletableDeferred<NetworkResult<LeaseInviteAcceptanceResponse>>()
            coEvery { repository.acceptLeaseInvite(leaseToken) } coAnswers { delayed.await() }
            vm.load()
            vm.accept()
            every { session.isCurrent } returns false
            delayed.complete(NetworkResult.Success(leaseReceipt()))
            runCurrent()
            assertTrue(vm.state.value !is TokenAcceptUiState.Accepted)
        }

    @Test fun human_role_converts_snake_to_title_case() {
        assertEquals("Co owner", TokenAcceptViewModel.humanRole("co_owner"))
        assertEquals("Renter", TokenAcceptViewModel.humanRole("renter"))
        assertEquals("Admin", TokenAcceptViewModel.humanRole("admin"))
    }

    @Test fun home_benefits_branch_on_role() {
        val ownerBenefits = TokenAcceptViewModel.homeBenefits("co_owner")
        val renterBenefits = TokenAcceptViewModel.homeBenefits("renter")
        assertTrue(ownerBenefits.any { it.contains("Co-manage") })
        assertTrue(!renterBenefits.any { it.contains("Co-manage") })
    }

    @Test fun seat_benefits_for_admin_include_invite_copy() {
        val adminBenefits = TokenAcceptViewModel.seatBenefits("admin")
        assertTrue(adminBenefits.any { it.contains("Invite teammates") })
        val memberBenefits = TokenAcceptViewModel.seatBenefits("member")
        assertTrue(!memberBenefits.any { it.contains("Invite teammates") })
    }
}
