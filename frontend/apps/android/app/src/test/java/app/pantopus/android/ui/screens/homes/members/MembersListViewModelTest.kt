@file:Suppress("LargeClass", "LongMethod", "PackageNaming")

package app.pantopus.android.ui.screens.homes.members

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import app.pantopus.android.data.api.models.homes.ChangeMemberRoleResponse
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeAuditActorDto
import app.pantopus.android.data.api.models.homes.HomeAuditEntryDto
import app.pantopus.android.data.api.models.homes.HomeAuditLogResponse
import app.pantopus.android.data.api.models.homes.HouseholdAccessRequestActionResponse
import app.pantopus.android.data.api.models.homes.HouseholdAccessRequestDto
import app.pantopus.android.data.api.models.homes.HouseholdAccessRequesterDto
import app.pantopus.android.data.api.models.homes.HouseholdAccessRequestsResponse
import app.pantopus.android.data.api.models.homes.InvitationDto
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.PendingInviteDto
import app.pantopus.android.data.api.models.homes.RemoveMemberResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
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
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * T6.3a / P9 — Members. Mirrors iOS `MembersListViewModelTests` 1:1.
 *
 * Covers:
 *  - load → loaded / empty / error transitions
 *  - 4-tab buckets count correctly (Members excludes guests; Guests
 *    excludes non-guests; Pending comes from `pendingInvites`; Requests
 *    comes from `/household-access-requests` and only exists for viewers
 *    who can manage the roster)
 *  - tab switching mutates the loaded section without a refetch
 *  - protected removal review never dispatches legacy DELETE or hides a member
 *  - explicit reviewed withdrawal without hiding rows or removing members
 *  - handleInvited(_:) folds a new pending invite at top
 *  - role-change + approve/decline call the right repository methods
 *  - FAB tint + variant match the design contract
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MembersListViewModelTest {
    private val repo: HomeMembersRepository = mockk()
    private val adminRepo: HomeAdminRepository = mockk()
    private val auth: AuthRepository = mockk(relaxed = true)
    private val sender: HomeInvitationSenderFactory = mockk()
    private val readSession: HomeClaimSessionScope = mockk()
    private var senderRows: List<PendingInviteDto> = emptyList()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { auth.state } returns MutableStateFlow(AuthRepository.State.SignedOut)
        every { sender.session(any()) } returns readSession
        coEvery { readSession.requireCurrent() } returns Unit
        stubOwnerAccess()
        stubRequests()
        stubAuditLog()
        coEvery { sender.list("home_1") } coAnswers { senderRows }
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    /** `GET /:id/me` for a verified owner — full manage rights. */
    private fun stubOwnerAccess() {
        coEvery { adminRepo.myAccess("home_1") } returns
            NetworkResult.Success(
                HomeAccessDto(
                    hasAccess = true,
                    isOwner = true,
                    roleBase = "owner",
                    permissions = listOf("members.manage", "access.manage"),
                    canManageHome = true,
                    canManageAccess = true,
                ),
            )
    }

    /** `GET /:id/me` for a plain member — no manage rights. */
    private fun stubMemberAccess() {
        coEvery { adminRepo.myAccess("home_1") } returns
            NetworkResult.Success(
                HomeAccessDto(hasAccess = true, isOwner = false, roleBase = "member"),
            )
    }

    private fun stubRequests(rows: List<HouseholdAccessRequestDto> = emptyList()) {
        coEvery { adminRepo.householdAccessRequests("home_1", any()) } returns
            NetworkResult.Success(HouseholdAccessRequestsResponse(requests = rows))
    }

    /** `GET /:id/audit-log` — empty unless a test stubs rows. */
    private fun stubAuditLog(rows: List<HomeAuditEntryDto> = emptyList()) {
        coEvery { adminRepo.auditLog("home_1", any(), any()) } returns
            NetworkResult.Success(HomeAuditLogResponse(entries = rows))
    }

    private fun accessRequest(
        id: String = "req_1",
        identity: String = "household_member",
    ): HouseholdAccessRequestDto =
        HouseholdAccessRequestDto(
            id = id,
            homeId = "home_1",
            requesterUserId = "u_asker",
            requestedIdentity = identity,
            status = "pending",
            createdAt = "2026-05-14T12:00:00Z",
            requester =
                HouseholdAccessRequesterDto(
                    id = "u_asker",
                    username = "asker",
                    name = "Ada Lovelace",
                ),
        )

    private fun makeVm(): MembersListViewModel =
        MembersListViewModel(
            repo = repo,
            adminRepo = adminRepo,
            auth = auth,
            sender = sender,
            savedStateHandle = SavedStateHandle(mapOf(MEMBERS_LIST_HOME_ID_KEY to "home_1")),
        )

    private fun occupant(
        id: String,
        userId: String = id,
        role: String = "member",
        name: String = "Maria",
        isActive: Boolean = true,
        joinedAt: String? = "2024-03-01T00:00:00Z",
    ): OccupantDto =
        OccupantDto(
            id = id,
            userId = userId,
            role = role,
            isActive = isActive,
            displayName = name,
            joinedAt = joinedAt,
        )

    private fun invite(
        id: String = "inv_1",
        userId: String? = null,
        email: String? = "newhouse@example.com",
        role: String? = "member",
    ): PendingInviteDto =
        PendingInviteDto(
            id = id,
            userId = userId,
            role = role,
            email = email,
            name = email ?: "Invited user",
            invitedBy = null,
            createdAt = "2026-05-14T12:00:00Z",
        )

    private fun populated(): OccupantsResponse =
        OccupantsResponse(
            occupants =
                listOf(
                    occupant(id = "occ_owner", userId = "u_owner", role = "owner", name = "Maria"),
                    occupant(id = "occ_admin", userId = "u_admin", role = "admin", name = "Jamie"),
                    occupant(id = "occ_guest", userId = "u_guest", role = "guest", name = "Daniel"),
                ),
            pendingInvites = listOf(invite()),
        ).also { senderRows = it.pendingInvites }

    // ─── Lifecycle ────────────────────────────────────────────────

    @Test
    fun load_empty_response_surfaces_empty_state_on_members_tab() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns
                NetworkResult.Success(OccupantsResponse())
            val vm = makeVm()
            vm.state.test {
                assertEquals(ListOfRowsUiState.Loading, awaitItem())
                vm.load()
                val empty = awaitItem() as ListOfRowsUiState.Empty
                assertEquals("No members yet", empty.headline)
                assertEquals("Invite someone", empty.ctaTitle)
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun load_populated_response_renders_members_tab_by_default() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.state.test {
                assertEquals(ListOfRowsUiState.Loading, awaitItem())
                vm.load()
                val loaded = awaitItem() as ListOfRowsUiState.Loaded
                // Members tab → excludes the one guest, so 2 rows.
                assertEquals(1, loaded.sections.size)
                assertEquals(2, loaded.sections.first().rows.size)
                val titles = loaded.sections.first().rows.map { it.title }.toSet()
                assertTrue("Maria" in titles)
                assertTrue("Jamie" in titles)
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun load_failure_surfaces_error_state() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns
                NetworkResult.Failure(NetworkError.NotFound)
            val vm = makeVm()
            vm.state.test {
                assertEquals(ListOfRowsUiState.Loading, awaitItem())
                vm.load()
                assertTrue(awaitItem() is ListOfRowsUiState.Error)
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun unknown_or_failed_roster_has_no_counts_but_confirmed_empty_has_zero() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Failure(NetworkError.Server(503, "unavailable"))
            val vm = makeVm()
            assertTrue(vm.tabs.value.all { it.count == null })
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
            vm.selectTab(MembersTab.GUESTS)
            vm.selectTab(MembersTab.MEMBERS)
            assertTrue(vm.tabs.value.all { it.count == null })
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(OccupantsResponse())
            vm.refresh()
            assertTrue(vm.state.value is ListOfRowsUiState.Empty)
            assertEquals(0, vm.tabs.value.single { it.id == MembersTab.MEMBERS }.count)
            assertEquals(0, vm.tabs.value.single { it.id == MembersTab.GUESTS }.count)
            assertEquals(0, vm.tabs.value.single { it.id == MembersTab.PENDING }.count)
        }

    @Test
    fun held_current_read_cannot_restore_cached_rows_counts_or_authority_through_tabs() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            assertTrue(vm.canManageMembers)
            val held = CompletableDeferred<NetworkResult<OccupantsResponse>>()
            coEvery { repo.listOccupants("home_1") } coAnswers { held.await() }
            vm.refresh()
            for (tab in listOf(MembersTab.PENDING, MembersTab.GUESTS, MembersTab.MEMBERS)) {
                vm.selectTab(tab)
                assertTrue(vm.state.value is ListOfRowsUiState.Loading)
                assertTrue(vm.tabs.value.all { it.count == null })
                assertEquals(false, vm.canManageMembers)
            }
            vm.requestRemoval("u_admin")
            assertNull(vm.pendingEvent.value)
            vm.requestInvite()
            assertEquals(MembersListEvent.OpenInvite, vm.pendingEvent.value)
            vm.acknowledgeEvent()
            held.complete(NetworkResult.Success(populated()))
            assertTrue(vm.state.value is ListOfRowsUiState.Loaded)
            assertTrue(vm.canManageMembers)
            assertEquals(2, vm.tabs.value.single { it.id == MembersTab.MEMBERS }.count)
            assertEquals(1, vm.tabs.value.single { it.id == MembersTab.GUESTS }.count)
        }

    @Test
    fun entering_removal_recovery_retires_loaded_roster_without_a_mutation() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            vm.retireForRemovalRecovery()
            vm.selectTab(MembersTab.PENDING)
            vm.selectTab(MembersTab.MEMBERS)
            assertTrue(vm.state.value is ListOfRowsUiState.Loading)
            assertTrue(vm.tabs.value.all { it.count == null })
            assertEquals(false, vm.canManageMembers)
            vm.requestRemoval("u_admin")
            assertNull(vm.pendingEvent.value)
            coVerify(exactly = 1) { repo.listOccupants("home_1") }
            coVerify(exactly = 0) { repo.remove(any(), any()) }
        }

    @Test
    fun pre_recovery_reply_is_retired_until_close_starts_a_fresh_roster_read() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            val held = CompletableDeferred<List<PendingInviteDto>>()
            coEvery { sender.list("home_1") } coAnswers { held.await() }
            vm.refresh()
            vm.retireForRemovalRecovery()
            held.complete(listOf(invite()))
            assertTrue(vm.state.value is ListOfRowsUiState.Loading)
            assertTrue(vm.tabs.value.all { it.count == null })
            assertEquals(false, vm.canManageMembers)
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(OccupantsResponse())
            coEvery { sender.list("home_1") } returns emptyList()
            vm.refresh()
            assertTrue(vm.state.value is ListOfRowsUiState.Empty)
            assertEquals(0, vm.tabs.value.single { it.id == MembersTab.MEMBERS }.count)
        }

    @Test
    fun load_is_idempotent_after_loaded() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            vm.load()
            coVerify(exactly = 1) { repo.listOccupants("home_1") }
        }

    // ─── Tab buckets ──────────────────────────────────────────────

    @Test
    fun tab_counts_exposed_on_tabs_flow() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            val counts = vm.tabs.value.associate { it.id to it.count }
            assertEquals(2, counts[MembersTab.MEMBERS])
            assertEquals(1, counts[MembersTab.GUESTS])
            assertEquals(1, counts[MembersTab.PENDING])
        }

    @Test
    fun switching_to_guests_tab_filters_to_guest_roles_only() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.GUESTS)
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections.first().rows.size)
            assertEquals("Daniel", loaded.sections.first().rows.first().title)
            assertEquals("Guest", loaded.sections.first().rows.first().subtitle)
        }

    @Test
    fun switching_to_pending_tab_surfaces_explicit_resend_withdraw_actions() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.PENDING)
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val row = loaded.sections.first().rows.first()
            assertEquals("newhouse@example.com", row.title)
            val actions = requireNotNull(row.footer).actions
            assertEquals("Resend", actions[0].title)
            assertEquals("Withdraw", actions[1].title)
            assertEquals(RowTrailing.None, row.trailing)
            assertEquals(Int.MAX_VALUE, row.titleMaxLines)
            assertNull(row.inlineChip)
        }

    @Test
    fun pending_footer_keeps_complete_distinct_recipients_bound_to_their_own_withdrawal() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val firstName = "A long shared household recipient name @distinct_recipient_01"
            val secondName = "A long shared household recipient name @distinct_recipient_02"
            senderRows = listOf(invite(id = "first").copy(name = firstName), invite(id = "second").copy(name = secondName))
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.PENDING)
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            assertEquals(listOf(firstName, secondName), rows.map { it.title })
            assertTrue(rows.all { it.titleMaxLines == Int.MAX_VALUE && it.trailing == RowTrailing.None && it.inlineChip == null })
            requireNotNull(rows[1].footer).actions.single { it.title == "Withdraw" }.onClick()
            assertEquals(MembersListEvent.ReviewInvitation("second", "withdraw"), vm.pendingEvent.value)
            coVerify(exactly = 0) { repo.remove(any(), any()) }
            coVerify(exactly = 0) { repo.invite(any(), any()) }
        }

    @Test
    fun empty_guests_tab_uses_fresh_roster_after_saved_removal() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            coEvery { repo.remove("home_1", "u_guest") } returns
                NetworkResult.Success(RemoveMemberResponse(message = "ok"))
            val vm = makeVm()
            vm.load()
            coEvery {
                repo.listOccupants("home_1")
            } returns NetworkResult.Success(populated().copy(occupants = populated().occupants.filterNot { it.userId == "u_guest" }))
            vm.refresh()
            vm.selectTab(MembersTab.GUESTS)
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No active guests", empty.headline)
        }

    @Test
    fun empty_pending_tab_shows_pending_empty_state() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(OccupantsResponse())
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.PENDING)
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No pending invites", empty.headline)
        }

    // ─── Requests tab ─────────────────────────────────────────────

    @Test
    fun requests_tab_hidden_for_viewers_who_cannot_manage() =
        runTest {
            stubMemberAccess()
            stubRequests(listOf(accessRequest()))
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            assertEquals(false, vm.canManageMembers)
            assertEquals(
                listOf(MembersTab.MEMBERS, MembersTab.GUESTS, MembersTab.PENDING),
                vm.tabs.value.map { it.id },
            )
        }

    @Test
    fun requests_tab_appears_for_owner_and_renders_invite_decline_pair() =
        runTest {
            stubRequests(listOf(accessRequest()))
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            assertTrue(vm.canManageMembers)
            assertEquals(
                listOf(
                    MembersTab.MEMBERS,
                    MembersTab.GUESTS,
                    MembersTab.PENDING,
                    MembersTab.REQUESTS,
                    MembersTab.AUDIT,
                ),
                vm.tabs.value.map { it.id },
            )
            vm.selectTab(MembersTab.REQUESTS)
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val row = loaded.sections.first().rows.first()
            assertEquals("req_1", row.id)
            assertEquals("Ada Lovelace", row.title)
            assertEquals("Wants to join as Household member", row.subtitle)
            val trailing = row.trailing as RowTrailing.VerticalActions
            assertEquals("Invite", trailing.primary.label)
            assertEquals("Decline", trailing.secondary.label)
        }

    @Test
    fun empty_requests_tab_shows_review_queue_empty_state() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.REQUESTS)
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No pending requests", empty.headline)
            assertNull(empty.ctaTitle)
        }

    @Test
    fun approve_access_request_hits_approve_route_and_refetches() =
        runTest {
            stubRequests(listOf(accessRequest()))
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            coEvery { adminRepo.approveHouseholdAccessRequest("home_1", "req_1") } returns
                NetworkResult.Success(HouseholdAccessRequestActionResponse(ok = true, message = "Invitation sent"))
            val vm = makeVm()
            vm.load()
            vm.approveAccessRequest("req_1")
            coVerify { adminRepo.approveHouseholdAccessRequest("home_1", "req_1") }
            assertNull(vm.actionError.value)
        }

    @Test
    fun decline_access_request_hits_reject_route() =
        runTest {
            stubRequests(listOf(accessRequest()))
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            coEvery { adminRepo.rejectHouseholdAccessRequest("home_1", "req_1") } returns
                NetworkResult.Success(HouseholdAccessRequestActionResponse(ok = true))
            val vm = makeVm()
            vm.load()
            vm.rejectAccessRequest("req_1")
            coVerify { adminRepo.rejectHouseholdAccessRequest("home_1", "req_1") }
            assertNull(vm.actionError.value)
        }

    // ─── Role change ──────────────────────────────────────────────

    @Test
    fun owner_can_assign_every_role_below_and_including_owner() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            val target =
                vm.actionTarget(
                    occ = occupant(id = "occ_admin", userId = "u_admin", role = "admin", name = "Jamie"),
                    name = "Jamie",
                )
            assertEquals(
                setOf(
                    HomeAssignableRole.Owner,
                    HomeAssignableRole.Manager,
                    HomeAssignableRole.Member,
                    HomeAssignableRole.RestrictedMember,
                    HomeAssignableRole.Guest,
                ),
                target.assignableRoles.toSet(),
            )
            assertTrue(target.canRemove)
        }

    @Test
    fun plain_member_gets_no_role_actions_on_other_rows() =
        runTest {
            stubMemberAccess()
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            val target =
                vm.actionTarget(
                    occ = occupant(id = "occ_admin", userId = "u_admin", role = "admin", name = "Jamie"),
                    name = "Jamie",
                )
            assertTrue(target.assignableRoles.isEmpty())
            assertEquals(false, target.canRemove)
        }

    @Test
    fun self_row_keeps_remove_but_never_offers_role_change() =
        runTest {
            every { auth.state } returns
                MutableStateFlow(
                    AuthRepository.State.SignedIn(
                        user = mockk(relaxed = true) { every { id } returns "u_admin" },
                    ),
                )
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            val target =
                vm.actionTarget(
                    occ = occupant(id = "occ_admin", userId = "u_admin", role = "admin", name = "Jamie"),
                    name = "Jamie",
                )
            assertTrue(target.assignableRoles.isEmpty())
            assertTrue(target.canRemove)
        }

    @Test
    fun change_role_posts_role_base_and_refetches() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            coEvery { adminRepo.changeMemberRole("home_1", "u_admin", "manager") } returns
                NetworkResult.Success(ChangeMemberRoleResponse(message = "Role updated", roleBase = "manager"))
            val vm = makeVm()
            vm.load()
            vm.changeRole("u_admin", HomeAssignableRole.Manager)
            coVerify { adminRepo.changeMemberRole("home_1", "u_admin", "manager") }
            assertNull(vm.actionError.value)
        }

    @Test
    fun change_role_failure_surfaces_action_error() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            coEvery { adminRepo.changeMemberRole("home_1", "u_admin", "manager") } returns
                NetworkResult.Failure(NetworkError.Server(403, "No permission to manage members"))
            val vm = makeVm()
            vm.load()
            vm.changeRole("u_admin", HomeAssignableRole.Manager)
            assertNotNull(vm.actionError.value)
        }

    // ─── Row mapping ──────────────────────────────────────────────

    @Test
    fun row_mapping_owner_carries_home_chip_and_verified_avatar() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val row = loaded.sections.first().rows.first { it.id == "u_owner" }
            assertEquals("Maria", row.title)
            assertEquals("Owner", row.subtitle)
            assertEquals("Owner", row.inlineChip?.text)
            assertEquals(2, row.titleMaxLines)
            val leading = row.leading as RowLeading.AvatarWithBadge
            assertTrue(leading.verified)
            assertEquals(RowTrailing.Kebab, row.trailing)
        }

    @Test
    fun row_mapping_pending_keeps_unverified_avatar_and_one_role_label() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.PENDING)
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val row = loaded.sections.first().rows.first()
            val leading = row.leading as RowLeading.AvatarWithBadge
            assertEquals(false, leading.verified)
            assertNull(row.inlineChip)
            assertNotNull(row.subtitle)
            assertNotNull(row.body)
            assertTrue(row.body!!.startsWith("Invited"))
        }

    // ─── Mutations ────────────────────────────────────────────────

    @Test
    fun removal_review_preserves_current_row_and_never_sends_legacy_delete() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            val before = vm.state.value
            vm.requestRemoval("u_admin")
            assertEquals(before, vm.state.value)
            assertEquals("u_admin", (vm.pendingEvent.value as MembersListEvent.ConfirmRemove).userId)
            coVerify(exactly = 0) { repo.remove(any(), any()) }
        }

    @Test
    fun unavailable_or_denied_roster_cannot_start_a_new_removal_review() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            stubMemberAccess()
            vm.refresh()
            vm.requestRemoval("u_admin")
            assertNull(vm.pendingEvent.value)
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Failure(NetworkError.Server(503, "unavailable"))
            vm.refresh()
            vm.requestRemoval("u_admin")
            assertNull(vm.pendingEvent.value)
            coVerify(exactly = 0) { repo.remove(any(), any()) }
        }

    @Test
    fun withdrawal_with_resolved_user_preserves_row_and_never_removes_membership() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns
                NetworkResult.Success(
                    OccupantsResponse(
                        occupants = emptyList(),
                        pendingInvites =
                            listOf(
                                invite(id = "inv_1", userId = "u_pending", email = "x@y.com"),
                            ),
                    ),
                )
            coEvery { repo.remove("home_1", "u_pending") } returns
                NetworkResult.Success(RemoveMemberResponse(message = "ok"))
            senderRows = listOf(invite(id = "inv_1", userId = "u_pending", email = "x@y.com"))
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.PENDING)
            vm.cancelInvite(inviteId = "inv_1")
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(1, state.sections.first().rows.size)
            assertEquals(MembersListEvent.ReviewInvitation("inv_1", "withdraw"), vm.pendingEvent.value)
            coVerify(exactly = 0) { repo.remove(any(), any()) }
        }

    @Test
    fun withdrawal_for_email_only_invitation_requires_the_same_review() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns
                NetworkResult.Success(
                    OccupantsResponse(
                        occupants = emptyList(),
                        pendingInvites =
                            listOf(
                                invite(id = "inv_1", userId = null, email = "x@y.com"),
                            ),
                    ),
                )
            coEvery { repo.remove("home_1", "u_pending") } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            senderRows = listOf(invite(id = "inv_1", userId = null, email = "x@y.com"))
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.PENDING)
            vm.cancelInvite(inviteId = "inv_1")
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections.first().rows.size)
            assertEquals(MembersListEvent.ReviewInvitation("inv_1", "withdraw"), vm.pendingEvent.value)
            coVerify(exactly = 0) { repo.remove(any(), any()) }
        }

    @Test
    fun handle_invited_inserts_at_top_of_pending_bucket() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(OccupantsResponse())
            val vm = makeVm()
            vm.load()
            val invitation =
                InvitationDto(
                    id = "new_inv",
                    homeId = "home_1",
                    inviteeEmail = "fresh@example.com",
                    proposedRole = "member",
                    createdAt = "2026-05-15T11:59:00Z",
                )
            vm.handleInvited(invitation)
            vm.selectTab(MembersTab.PENDING)
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val row = loaded.sections.first().rows.first()
            assertEquals("new_inv", row.id)
            assertEquals("fresh@example.com", row.title)
        }

    @Test
    fun resend_invite_opens_explicit_review_without_reusing_creation() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            vm.resendInvite(inviteId = "inv_1")
            assertEquals(MembersListEvent.ReviewInvitation("inv_1", "resend"), vm.pendingEvent.value)
            coVerify(exactly = 0) { repo.invite(any(), any()) }
        }

    @Test
    fun sender_row_actions_are_unavailable_when_management_access_is_missing() =
        runTest {
            coEvery { adminRepo.myAccess("home_1") } returns NetworkResult.Failure(NetworkError.Server(503, "unavailable"))
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.PENDING)
            vm.resendInvite("inv_1")
            vm.cancelInvite("inv_1")
            assertNull(vm.pendingEvent.value)
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
            coVerify(exactly = 0) { sender.list(any()) }
            coVerify(exactly = 0) { repo.remove(any(), any()) }
            coVerify(exactly = 0) { repo.invite(any(), any()) }
        }

    @Test
    fun unavailable_dedicated_invitation_read_is_retryable_not_empty_or_legacy_fallback() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            coEvery { sender.list("home_1") } throws IllegalStateException("Synthetic unavailable sender list")
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.PENDING)
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
            vm.resendInvite("inv_1")
            assertNull(vm.pendingEvent.value)
            coEvery { sender.list("home_1") } returns senderRows
            vm.refresh()
            assertTrue(vm.state.value is ListOfRowsUiState.Loaded)
        }

    @Test
    fun older_sender_success_cannot_restore_rows_after_newer_empty_snapshot() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val held = CompletableDeferred<List<PendingInviteDto>>()
            var calls = 0
            coEvery { sender.list("home_1") } coAnswers { if (++calls == 1) held.await() else emptyList() }
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.PENDING)
            vm.refresh()
            assertTrue(vm.state.value is ListOfRowsUiState.Empty)
            held.complete(listOf(invite()))
            vm.selectTab(MembersTab.MEMBERS)
            vm.selectTab(MembersTab.PENDING)
            assertTrue(vm.state.value is ListOfRowsUiState.Empty)
            assertEquals(0, vm.tabs.value.single { it.id == MembersTab.PENDING }.count)
            vm.cancelInvite("inv_1")
            assertNull(vm.pendingEvent.value)
        }

    @Test
    fun older_sender_success_cannot_restore_authority_or_rows_after_newer_denial_and_tab_changes() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val held = CompletableDeferred<List<PendingInviteDto>>()
            coEvery { sender.list("home_1") } coAnswers { held.await() }
            val vm = makeVm()
            vm.load()
            stubMemberAccess()
            vm.refresh()
            vm.selectTab(MembersTab.PENDING)
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
            held.complete(listOf(invite()))
            vm.selectTab(MembersTab.MEMBERS)
            vm.selectTab(MembersTab.PENDING)
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
            assertEquals(false, vm.canManageMembers)
            assertNull(vm.tabs.value.single { it.id == MembersTab.PENDING }.count)
            assertTrue(vm.tabs.value.none { it.id == MembersTab.REQUESTS || it.id == MembersTab.AUDIT })
            vm.cancelInvite("inv_1")
            assertNull(vm.pendingEvent.value)
        }

    @Test
    fun newer_sender_failure_retires_manager_access_across_tabs_and_older_success() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            senderRows = listOf(invite())
            val vm = makeVm()
            vm.load()
            val held = CompletableDeferred<List<PendingInviteDto>>()
            coEvery { sender.list("home_1") } coAnswers { held.await() }
            vm.refresh()
            coEvery { sender.list("home_1") } throws IllegalStateException("Current sender read denied")
            vm.refresh()
            held.complete(senderRows)
            vm.selectTab(MembersTab.MEMBERS)
            assertEquals(false, vm.canManageMembers)
            assertTrue(vm.tabs.value.none { it.id == MembersTab.REQUESTS || it.id == MembersTab.AUDIT })
            vm.selectTab(MembersTab.PENDING)
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
            assertNull(vm.tabs.value.single { it.id == MembersTab.PENDING }.count)
            vm.cancelInvite("inv_1")
            assertNull(vm.pendingEvent.value)
            vm.requestInvite()
            assertEquals(MembersListEvent.OpenInvite, vm.pendingEvent.value)
        }

    @Test
    fun older_access_success_and_roster_failure_cannot_replace_newer_snapshot() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val held = CompletableDeferred<NetworkResult<HomeAccessDto>>()
            coEvery { adminRepo.myAccess("home_1") } coAnswers { held.await() }
            val vm = makeVm()
            vm.load()
            stubMemberAccess()
            vm.refresh()
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Failure(NetworkError.Server(503, "Old read failed"))
            held.complete(NetworkResult.Success(HomeAccessDto(hasAccess = true, isOwner = true, permissions = listOf("members.manage"))))
            assertEquals(false, vm.canManageMembers)
            assertTrue(vm.state.value is ListOfRowsUiState.Loaded)
            assertTrue(vm.tabs.value.none { it.id == MembersTab.REQUESTS })
        }

    @Test
    fun sender_rows_do_not_publish_before_later_reads_or_return_after_newer_failure() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            senderRows = listOf(invite())
            val held = CompletableDeferred<NetworkResult<HomeAuditLogResponse>>()
            coEvery { adminRepo.auditLog("home_1", any(), any()) } coAnswers { held.await() }
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.PENDING)
            assertNull(vm.tabs.value.single { it.id == MembersTab.PENDING }.count)
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Failure(NetworkError.Server(503, "Current read failed"))
            vm.refresh()
            held.complete(NetworkResult.Success(HomeAuditLogResponse(entries = emptyList())))
            vm.selectTab(MembersTab.MEMBERS)
            vm.selectTab(MembersTab.PENDING)
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
            assertEquals(false, vm.canManageMembers)
            assertNull(vm.tabs.value.single { it.id == MembersTab.PENDING }.count)
        }

    @Test
    fun changed_session_before_final_publication_retires_snapshot_and_cached_tab_rows() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            senderRows = listOf(invite())
            val vm = makeVm()
            vm.load()
            val held = CompletableDeferred<NetworkResult<HomeAuditLogResponse>>()
            coEvery { adminRepo.auditLog("home_1", any(), any()) } coAnswers { held.await() }
            vm.refresh()
            coEvery { readSession.requireCurrent() } throws IllegalStateException("Session changed")
            held.complete(NetworkResult.Success(HomeAuditLogResponse(entries = emptyList())))
            vm.selectTab(MembersTab.PENDING)
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
            assertEquals(false, vm.canManageMembers)
            assertNull(vm.tabs.value.single { it.id == MembersTab.PENDING }.count)
            vm.requestInvite()
            assertEquals(MembersListEvent.OpenInvite, vm.pendingEvent.value)
        }

    @Test
    fun duplicate_initial_load_does_not_start_a_second_fetch() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val held = CompletableDeferred<List<PendingInviteDto>>()
            coEvery { sender.list("home_1") } coAnswers { held.await() }
            val vm = makeVm()
            vm.load()
            vm.load()
            coVerify(exactly = 1) { repo.listOccupants("home_1") }
            held.complete(emptyList())
            assertTrue(vm.state.value is ListOfRowsUiState.Loaded)
        }

    // ─── Chrome ───────────────────────────────────────────────────

    @Test
    fun fab_is_home_green_secondary_create() {
        val vm = makeVm()
        val fab = requireNotNull(vm.fab)
        assertEquals(FabVariant.SecondaryCreate, fab.variant)
        assertEquals(FabTint.Home, fab.tint)
        assertEquals("Invite member", fab.contentDescription)
    }

    @Test
    fun no_fab_on_requests_review_queue() =
        runTest {
            stubRequests(listOf(accessRequest()))
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.REQUESTS)
            assertNull(vm.fab)
        }

    // ─── Audit Log tab ────────────────────────────────────────────

    @Test
    fun audit_tab_hidden_for_viewers_who_cannot_manage() =
        runTest {
            stubMemberAccess()
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            assertEquals(false, vm.tabs.value.any { it.id == MembersTab.AUDIT })
        }

    @Test
    fun audit_tab_renders_action_actor_and_target() =
        runTest {
            stubAuditLog(
                listOf(
                    HomeAuditEntryDto(
                        id = "log_1",
                        homeId = "home_1",
                        actorUserId = "u_owner",
                        action = "MEMBER_ROLE_CHANGED",
                        targetType = "HomeOccupancy",
                        targetId = "occ_1",
                        createdAt = "2026-05-14T12:00:00Z",
                        actor = HomeAuditActorDto(id = "u_owner", username = "ada", name = "Ada Lovelace"),
                    ),
                ),
            )
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.AUDIT)
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val row = loaded.sections.first().rows.first()
            assertEquals("log_1", row.id)
            assertEquals("Member role changed", row.title)
            assertEquals("Ada Lovelace → Home occupancy", row.subtitle)
            assertEquals(RowTrailing.None, row.trailing)
        }

    @Test
    fun audit_tab_empty_state_when_log_is_empty() =
        runTest {
            coEvery { repo.listOccupants("home_1") } returns NetworkResult.Success(populated())
            val vm = makeVm()
            vm.load()
            vm.selectTab(MembersTab.AUDIT)
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No audit log entries", empty.headline)
            assertNull(vm.fab)
        }

    @Test
    fun three_tabs_before_access_is_known() {
        val vm = makeVm()
        val ids = vm.tabs.value.map { it.id }
        assertEquals(listOf(MembersTab.MEMBERS, MembersTab.GUESTS, MembersTab.PENDING), ids)
    }

    @Test
    fun default_selected_tab_is_members() {
        val vm = makeVm()
        assertEquals(MembersTab.MEMBERS, vm.selectedTab.value)
    }
}
