@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.token_accept

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.token_accept.BusinessSeatAcceptResponse
import app.pantopus.android.data.api.models.token_accept.BusinessSeatBusinessDto
import app.pantopus.android.data.api.models.token_accept.BusinessSeatInviteResponse
import app.pantopus.android.data.api.models.token_accept.GenericAcknowledgement
import app.pantopus.android.data.api.models.token_accept.GuestPassDto
import app.pantopus.android.data.api.models.token_accept.GuestPassResponse
import app.pantopus.android.data.api.models.token_accept.HomeAcceptResponse
import app.pantopus.android.data.api.models.token_accept.HomeInviteDetailsDto
import app.pantopus.android.data.api.models.token_accept.HomeInviteHomeDto
import app.pantopus.android.data.api.models.token_accept.HomeInviteInviterDto
import app.pantopus.android.data.api.models.token_accept.HomeInviteResponse
import app.pantopus.android.data.api.models.token_accept.HomeOccupancyEcho
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.token_accept.TokenAcceptRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
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

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        val signed =
            AuthRepository.State.SignedIn(
                user = UserDto(id = "u1", email = "alice@example.com", displayName = "Alice", avatarUrl = null),
            )
        every { auth.state } returns MutableStateFlow<AuthRepository.State>(signed)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun savedState(token: String = "demo"): SavedStateHandle = SavedStateHandle(mapOf(TokenAcceptViewModel.TOKEN_KEY to token))

    // MARK: - Home invite

    @Test fun home_invite_resolves() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns
                NetworkResult.Success(
                    HomeInviteResponse(
                        invitation =
                            HomeInviteDetailsDto(
                                id = "inv1",
                                status = "pending",
                                proposedRole = "co_owner",
                                inviteeEmail = "alice@example.com",
                                expiresAt = "2026-06-01T00:00:00Z",
                            ),
                        home = HomeInviteHomeDto(id = "h1", name = "412 Elm St", city = "Portland, OR"),
                        inviter = HomeInviteInviterDto(name = "Maya K.", username = "mayak"),
                    ),
                )
            coEvery { repository.businessSeatInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            val vm = TokenAcceptViewModel(repository, auth, savedState())
            vm.load()
            val ready = vm.state.value as TokenAcceptUiState.Ready
            assertEquals(InviteType.HomeInvite, ready.offer.inviteType)
            assertEquals("inv1", ready.offer.invitationId)
            assertEquals("Co owner", ready.offer.roleOffered)
            assertTrue(ready.offer.sender.contains("Maya"))
            assertTrue(ready.offer.benefits.isNotEmpty())
            assertTrue(ready.offer.primaryCtaLabel.contains("412 Elm St"))
        }

    @Test fun home_invite_accept_succeeds() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns
                NetworkResult.Success(
                    HomeInviteResponse(
                        invitation =
                            HomeInviteDetailsDto(
                                id = "inv1",
                                status = "pending",
                                proposedRole = "co_owner",
                            ),
                        home = HomeInviteHomeDto(id = "h1", name = "412 Elm St"),
                        inviter = HomeInviteInviterDto(name = "Maya K."),
                    ),
                )
            coEvery { repository.businessSeatInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.acceptHomeInvite(any()) } returns
                NetworkResult.Success(
                    HomeAcceptResponse(
                        homeId = "h1",
                        occupancy = HomeOccupancyEcho(id = "occ1", role = "co_owner"),
                        acceptedRoleBase = "co_owner",
                    ),
                )
            val vm = TokenAcceptViewModel(repository, auth, savedState())
            vm.load()
            vm.accept()
            val accepted = vm.state.value as TokenAcceptUiState.Accepted
            assertEquals(InviteType.HomeInvite, accepted.offer.inviteType)
        }

    @Test fun home_invite_expired() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns
                NetworkResult.Success(
                    HomeInviteResponse(
                        invitation = HomeInviteDetailsDto(id = "inv1", status = "expired"),
                        expired = true,
                    ),
                )
            coEvery { repository.businessSeatInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            val vm = TokenAcceptViewModel(repository, auth, savedState())
            vm.load()
            assertTrue(vm.state.value is TokenAcceptUiState.Expired)
        }

    @Test fun home_invite_already_used() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns
                NetworkResult.Success(
                    HomeInviteResponse(
                        invitation = HomeInviteDetailsDto(id = "inv1", status = "accepted"),
                        alreadyUsed = true,
                    ),
                )
            coEvery { repository.businessSeatInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            val vm = TokenAcceptViewModel(repository, auth, savedState())
            vm.load()
            assertTrue(vm.state.value is TokenAcceptUiState.Expired)
        }

    // MARK: - Business seat

    @Test fun business_seat_resolves() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.businessSeatInvite(any()) } returns
                NetworkResult.Success(
                    BusinessSeatInviteResponse(
                        seatId = "s1",
                        business = BusinessSeatBusinessDto(id = "b1", name = "Bridge Builders LLC"),
                        displayName = "Alice — Manager",
                        roleBase = "manager",
                        inviteEmail = "alice@example.com",
                    ),
                )
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            val vm = TokenAcceptViewModel(repository, auth, savedState())
            vm.load()
            val ready = vm.state.value as TokenAcceptUiState.Ready
            assertEquals(InviteType.BusinessSeat, ready.offer.inviteType)
            assertEquals("s1", ready.offer.invitationId)
            assertEquals("Manager", ready.offer.roleOffered)
            assertTrue(ready.offer.venue.contains("Bridge"))
        }

    @Test fun business_seat_accept_succeeds() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.businessSeatInvite(any()) } returns
                NetworkResult.Success(
                    BusinessSeatInviteResponse(
                        seatId = "s1",
                        business = BusinessSeatBusinessDto(name = "Bridge Builders LLC"),
                        roleBase = "manager",
                    ),
                )
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.acceptBusinessSeat(any(), any()) } returns
                NetworkResult.Success(
                    BusinessSeatAcceptResponse(
                        seatId = "s1",
                        businessUserId = "b1",
                        roleBase = "manager",
                    ),
                )
            val vm = TokenAcceptViewModel(repository, auth, savedState())
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
            val vm = TokenAcceptViewModel(repository, auth, savedState())
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
            val vm = TokenAcceptViewModel(repository, auth, savedState())
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
            val vm = TokenAcceptViewModel(repository, auth, savedState())
            vm.load()
            assertTrue(vm.state.value is TokenAcceptUiState.Expired)
        }

    @Test fun blank_token_short_circuits_to_expired() =
        runTest {
            val vm = TokenAcceptViewModel(repository, auth, savedState(token = ""))
            vm.load()
            assertTrue(vm.state.value is TokenAcceptUiState.Expired)
        }

    @Test fun decline_transitions_to_declined_for_home_invite() =
        runTest {
            coEvery { repository.homeInvite(any()) } returns
                NetworkResult.Success(
                    HomeInviteResponse(
                        invitation = HomeInviteDetailsDto(id = "inv1", status = "pending", proposedRole = "co_owner"),
                        home = HomeInviteHomeDto(id = "h1", name = "412 Elm St"),
                        inviter = HomeInviteInviterDto(name = "Maya K."),
                    ),
                )
            coEvery { repository.businessSeatInvite(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.guestPass(any()) } returns NetworkResult.Failure(NetworkError.Server(404, null))
            coEvery { repository.declineHomeInvite(any()) } returns NetworkResult.Success(GenericAcknowledgement(ok = true))
            val vm = TokenAcceptViewModel(repository, auth, savedState())
            vm.load()
            vm.decline()
            assertTrue(vm.state.value is TokenAcceptUiState.Declined)
        }

    // MARK: - Projection helpers

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
