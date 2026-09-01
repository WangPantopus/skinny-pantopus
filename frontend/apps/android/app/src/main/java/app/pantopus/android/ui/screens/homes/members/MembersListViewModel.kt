@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.members

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeAuditEntryDto
import app.pantopus.android.data.api.models.homes.HouseholdAccessRequestDto
import app.pantopus.android.data.api.models.homes.InvitationDto
import app.pantopus.android.data.api.models.homes.InviteMemberRequest
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.PendingInviteDto
import app.pantopus.android.data.api.models.homes.actionLabel
import app.pantopus.android.data.api.models.homes.actorDisplayName
import app.pantopus.android.data.api.models.homes.requestedIdentityLabel
import app.pantopus.android.data.api.models.homes.requesterDisplayName
import app.pantopus.android.data.api.models.homes.targetLabel
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBackground
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.VerticalAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject

/** Nav arg key for the home id consumed via [SavedStateHandle]. */
const val MEMBERS_LIST_HOME_ID_KEY = "homeId"

/** Stable tab ids — exposed for the screen + tests. */
object MembersTab {
    const val MEMBERS = "members"
    const val GUESTS = "guests"
    const val PENDING = "pending"

    /**
     * Household-access requests raised via the claim flow's "ask a
     * verified owner" path. Only rendered for viewers who can review
     * them (`GET /api/homes/:id/me` → `is_owner` or `members.manage`).
     */
    const val REQUESTS = "requests"

    /**
     * Who did what to the household — `GET /api/homes/:id/audit-log`
     * (`backend/routes/homeIam.js:602`). Same `members.manage` gate as
     * the Requests queue.
     */
    const val AUDIT = "audit"
}

/**
 * A member row the viewer may act on, plus the roles the backend will
 * actually let them assign to that member.
 */
data class MemberActionTarget(
    val userId: String,
    val name: String,
    val currentRole: String?,
    val assignableRoles: List<HomeAssignableRole>,
    val canRemove: Boolean,
)

/**
 * Surfaced to the screen so it can present sheets / confirms in
 * response to row interactions without the VM holding view state.
 */
sealed interface MembersListEvent {
    data object OpenInvite : MembersListEvent

    /** A13.1 — open the Add Guest form from the Guests tab. */
    data object OpenAddGuest : MembersListEvent

    /**
     * Row kebab — the screen presents a bottom sheet with "Change role"
     * and "Remove from home" depending on what the target allows.
     */
    data class OpenMemberActions(
        val target: MemberActionTarget,
    ) : MembersListEvent

    data class ConfirmRemove(
        val userId: String,
        val name: String,
    ) : MembersListEvent

    /** Requests tab — "Invite" mints a personal invitation server-side. */
    data class ConfirmApproveRequest(
        val requestId: String,
        val name: String,
    ) : MembersListEvent

    /** Requests tab — "Decline" rejects the access request. */
    data class ConfirmDeclineRequest(
        val requestId: String,
        val name: String,
        val identity: String,
    ) : MembersListEvent
}

/**
 * Drives the T6.3a / P9 Members per-home roster. Reads
 * `GET /api/homes/:id/occupants` (members + pending invites in one
 * payload), buckets client-side into Members / Guests / Pending tabs,
 * and projects rows via the shared `ListOfRows` archetype.
 *
 * Mirrors iOS `MembersListViewModel` exactly — same tab ids, same
 * row mapping, same optimistic remove + cancel-invite rollback.
 */
@HiltViewModel
class MembersListViewModel
    @Inject
    constructor(
        private val repo: HomeMembersRepository,
        private val adminRepo: HomeAdminRepository,
        private val auth: AuthRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String = savedStateHandle[MEMBERS_LIST_HOME_ID_KEY] ?: ""

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(MembersTab.MEMBERS)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private var occupants: List<OccupantDto> = emptyList()
        private var pendingInvites: List<PendingInviteDto> = emptyList()
        private var accessRequests: List<HouseholdAccessRequestDto> = emptyList()
        private var auditEntries: List<HomeAuditEntryDto> = emptyList()
        private var access: HomeAccessDto? = null
        private var loadedOnce = false
        private var busyRequestId: String? = null

        private val _tabs = MutableStateFlow(makeTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _pendingEvent = MutableStateFlow<MembersListEvent?>(null)
        val pendingEvent: StateFlow<MembersListEvent?> = _pendingEvent.asStateFlow()

        /** Non-null when the last mutation failed (403 rank, network, …). */
        private val _actionError = MutableStateFlow<String?>(null)
        val actionError: StateFlow<String?> = _actionError.asStateFlow()

        /**
         * Whether the viewer may manage the roster (role changes, remove,
         * and the Requests review queue). Mirrors the backend's
         * `canReviewHouseholdAccessRequests` (`backend/routes/home.js:219`).
         */
        val canManageMembers: Boolean
            get() = access?.canManageMembers == true

        /** Session user id — keeps the always-allowed self-leave available. */
        private val currentUserId: String?
            get() = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id

        /** 52dp home-green secondary-create FAB. Contextual on Guests:
         *  issue a guest pass; otherwise invite a household member. The
         *  Requests tab is a review queue — no create affordance. */
        val fab: FabAction?
            get() =
                when (_selectedTab.value) {
                    // Review / read-only queues carry no create affordance.
                    MembersTab.REQUESTS, MembersTab.AUDIT -> null
                    MembersTab.GUESTS ->
                        FabAction(
                            icon = PantopusIcon.UserPlus,
                            contentDescription = "Add guest",
                            variant = FabVariant.SecondaryCreate,
                            tint = FabTint.Home,
                            onClick = ::requestAddGuest,
                        )
                    else ->
                        FabAction(
                            icon = PantopusIcon.UserPlus,
                            contentDescription = "Invite member",
                            variant = FabVariant.SecondaryCreate,
                            tint = FabTint.Home,
                            onClick = ::requestInvite,
                        )
                }

        /** Idempotent — re-running won't refetch once content is loaded. */
        fun load() {
            if (loadedOnce) return
            reload()
        }

        /** Pull-to-refresh / retry. */
        fun refresh() = reload()

        /** Backend doesn't paginate /occupants. */
        fun loadMoreIfNeeded() = Unit

        /** Tab switch — re-segment over cached state. */
        fun selectTab(id: String) {
            if (_selectedTab.value == id) return
            _selectedTab.value = id
            applyState()
        }

        /** Screen calls this after dispatching a pending event. */
        fun acknowledgeEvent() {
            _pendingEvent.value = null
        }

        /** Screen calls this after showing [actionError]. */
        fun clearActionError() {
            _actionError.value = null
        }

        /** Fired by the FAB / empty-state CTA. */
        fun requestInvite() {
            _pendingEvent.value = MembersListEvent.OpenInvite
        }

        /** Fired by the Guests-tab FAB / empty-state CTA. */
        fun requestAddGuest() {
            _pendingEvent.value = MembersListEvent.OpenAddGuest
        }

        /**
         * Fold a freshly-created invite into the Pending bucket so the
         * user sees the new row without waiting for a refetch.
         */
        fun handleInvited(invitation: InvitationDto) {
            val invite =
                PendingInviteDto(
                    id = invitation.id,
                    userId = invitation.inviteeUserId,
                    role = invitation.proposedRole,
                    email = invitation.inviteeEmail,
                    name = invitation.inviteeEmail ?: "Invited user",
                    invitedBy = null,
                    createdAt = invitation.createdAt,
                )
            pendingInvites = listOf(invite) + pendingInvites
            applyState()
        }

        /**
         * Optimistic remove with rollback on failure. The confirm dialog
         * has already fired by the time this is invoked.
         */
        fun remove(userId: String) {
            val previous = occupants
            occupants = previous.filterNot { it.userId == userId }
            applyState()
            viewModelScope.launch {
                when (repo.remove(homeId, userId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        occupants = previous
                        applyState()
                    }
                }
            }
        }

        /**
         * Optimistic cancel-invite. The backend lacks a dedicated cancel
         * endpoint today, so for invites with a resolved `user_id` we
         * use the same DELETE …/members/:userId route; for open invites
         * (no user id) we just drop the row optimistically and let the
         * backend reconcile via expiry.
         */
        fun cancelInvite(inviteId: String) {
            val invite = pendingInvites.firstOrNull { it.id == inviteId } ?: return
            val previous = pendingInvites
            pendingInvites = previous.filterNot { it.id == inviteId }
            applyState()
            val userId = invite.userId ?: return
            viewModelScope.launch {
                when (repo.remove(homeId, userId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        pendingInvites = previous
                        applyState()
                    }
                }
            }
        }

        /**
         * Re-issues the invite via POST /:id/invite with the same email
         * + role. Optimistic — no state change locally.
         */
        fun resendInvite(inviteId: String) {
            val invite = pendingInvites.firstOrNull { it.id == inviteId } ?: return
            val request =
                InviteMemberRequest(
                    email = invite.email,
                    userId = invite.userId,
                    relationship = invite.role ?: MemberRole.Member.wire,
                    message = null,
                )
            viewModelScope.launch {
                // Fire-and-forget — we don't surface success/failure to UI
                // until the design adds a toast/snackbar slot for the
                // Members screen.
                repo.invite(homeId, request)
            }
        }

        /**
         * `POST /api/homes/:id/members/:userId/role` — route
         * `backend/routes/homeIam.js:212`. Awaited (not optimistic): the
         * backend enforces rank + owner-promotion rules, so we refetch on
         * success and surface the server's message on failure.
         */
        fun changeRole(
            userId: String,
            role: HomeAssignableRole,
        ) {
            _actionError.value = null
            viewModelScope.launch {
                when (val result = adminRepo.changeMemberRole(homeId, userId, role.wire)) {
                    is NetworkResult.Success -> fetch()
                    is NetworkResult.Failure ->
                        _actionError.value = result.error.displayMessage("Failed to update role")
                }
            }
        }

        /**
         * `POST …/household-access-requests/:requestId/approve` — route
         * `backend/routes/home.js:2714`. Mints a personal invitation for
         * the requester; the roster refetches so the row leaves the queue
         * and reappears under Pending.
         */
        fun approveAccessRequest(requestId: String) {
            if (busyRequestId != null) return
            busyRequestId = requestId
            _actionError.value = null
            viewModelScope.launch {
                when (val result = adminRepo.approveHouseholdAccessRequest(homeId, requestId)) {
                    is NetworkResult.Success -> fetch()
                    is NetworkResult.Failure ->
                        _actionError.value = result.error.displayMessage("Could not approve request")
                }
                busyRequestId = null
            }
        }

        /**
         * `POST …/household-access-requests/:requestId/reject` — route
         * `backend/routes/home.js:2831`.
         */
        fun rejectAccessRequest(requestId: String) {
            if (busyRequestId != null) return
            busyRequestId = requestId
            _actionError.value = null
            viewModelScope.launch {
                when (val result = adminRepo.rejectHouseholdAccessRequest(homeId, requestId)) {
                    is NetworkResult.Success -> fetch()
                    is NetworkResult.Failure ->
                        _actionError.value = result.error.displayMessage("Could not decline request")
                }
                busyRequestId = null
            }
        }

        private fun reload() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch { fetch() }
        }

        /**
         * One pass over the three GETs the screen needs: the roster
         * (`/occupants`), the viewer's own access record (`/me`), and —
         * only when they may review — the household-access queue.
         */
        private suspend fun fetch() {
            // Best-effort: a 403 on /me just means "no manage rights"; it
            // must not fail the roster.
            access =
                when (val me = adminRepo.myAccess(homeId)) {
                    is NetworkResult.Success -> me.data
                    is NetworkResult.Failure -> null
                }
            when (val result = repo.listOccupants(homeId)) {
                is NetworkResult.Success -> {
                    occupants = result.data.occupants.filter { it.isActive }
                    pendingInvites = result.data.pendingInvites
                    fetchAccessRequests()
                    fetchAuditLog()
                    loadedOnce = true
                    if (_selectedTab.value in setOf(MembersTab.REQUESTS, MembersTab.AUDIT) &&
                        !canManageMembers
                    ) {
                        _selectedTab.value = MembersTab.MEMBERS
                    }
                    applyState()
                }
                is NetworkResult.Failure -> {
                    _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                }
            }
        }

        /**
         * `GET /api/homes/:id/household-access-requests?status=pending` —
         * route `backend/routes/home.js:2671`. 403s for viewers who can't
         * review, so it is best-effort and never fails the whole screen.
         */
        private suspend fun fetchAccessRequests() {
            if (!canManageMembers) {
                accessRequests = emptyList()
                return
            }
            accessRequests =
                when (val result = adminRepo.householdAccessRequests(homeId)) {
                    is NetworkResult.Success -> result.data.requests
                    is NetworkResult.Failure -> emptyList()
                }
        }

        /**
         * `GET /api/homes/:id/audit-log` — route
         * `backend/routes/homeIam.js:602`. 403s for viewers without
         * `members.manage`, so it is best-effort and never fails the
         * whole screen.
         */
        private suspend fun fetchAuditLog() {
            if (!canManageMembers) {
                auditEntries = emptyList()
                return
            }
            auditEntries =
                when (val result = adminRepo.auditLog(homeId)) {
                    is NetworkResult.Success -> result.data.entries
                    is NetworkResult.Failure -> emptyList()
                }
        }

        // ─── Buckets ──────────────────────────────────────────────

        private fun membersBucket(): List<OccupantDto> = occupants.filter { MemberRole.parse(it.role) !in MemberRole.guestRoles }

        private fun guestsBucket(): List<OccupantDto> = occupants.filter { MemberRole.parse(it.role) in MemberRole.guestRoles }

        private fun makeTabs(): List<ListOfRowsTab> =
            buildList {
                add(ListOfRowsTab(id = MembersTab.MEMBERS, label = "Members", count = membersBucket().size))
                add(ListOfRowsTab(id = MembersTab.GUESTS, label = "Guests", count = guestsBucket().size))
                add(ListOfRowsTab(id = MembersTab.PENDING, label = "Pending", count = pendingInvites.size))
                if (canManageMembers) {
                    add(
                        ListOfRowsTab(
                            id = MembersTab.REQUESTS,
                            label = "Requests",
                            count = accessRequests.size,
                        ),
                    )
                    add(
                        ListOfRowsTab(
                            id = MembersTab.AUDIT,
                            label = "Audit Log",
                            count = auditEntries.size,
                        ),
                    )
                }
            }

        // ─── State projection ─────────────────────────────────────

        private fun applyState() {
            _tabs.value = makeTabs()
            val now = Instant.now()
            val zone = ZoneId.systemDefault()
            val rows: List<RowModel> =
                when (_selectedTab.value) {
                    MembersTab.GUESTS -> guestsBucket().map { rowForOccupant(it, now, zone) }
                    MembersTab.PENDING -> pendingInvites.map { rowForPending(it, now, zone) }
                    MembersTab.REQUESTS -> accessRequests.map { rowForRequest(it, now, zone) }
                    MembersTab.AUDIT -> auditEntries.map { rowForAudit(it, now, zone) }
                    else -> membersBucket().map { rowForOccupant(it, now, zone) }
                }
            if (rows.isEmpty()) {
                _state.value = emptyState(_selectedTab.value)
                return
            }
            val section = RowSection(id = _selectedTab.value, rows = rows)
            _state.value = ListOfRowsUiState.Loaded(sections = listOf(section), hasMore = false)
        }

        private fun emptyState(tab: String): ListOfRowsUiState.Empty =
            when (tab) {
                MembersTab.GUESTS ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Users,
                        headline = "No active guests",
                        subcopy = "Add someone short-term — a sitter, visitor, or contractor — to share access while they're around.",
                        ctaTitle = "Add a guest",
                        onCta = ::requestAddGuest,
                    )
                MembersTab.PENDING ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Mailbox,
                        headline = "No pending invites",
                        subcopy = "Invitations you send to housemates appear here until they accept.",
                        ctaTitle = "Send an invite",
                        onCta = ::requestInvite,
                    )
                // Review queue — no CTA, there is nothing to create here.
                // Copy mirrors RN's empty state.
                MembersTab.REQUESTS ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Mailbox,
                        headline = "No pending requests",
                        subcopy = "When someone asks to join from the claim flow, their request appears here.",
                    )
                // Read-only history — no CTA. Copy mirrors RN's empty
                // state (`src/app/homes/[id]/members/index.tsx:385`).
                MembersTab.AUDIT ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.FileText,
                        headline = "No audit log entries",
                        subcopy =
                            "Role changes, removals, guest passes, and ownership actions on this home show up here.",
                    )
                else ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Users,
                        headline = "No members yet",
                        subcopy = "Invite a housemate to share tasks, bills, calendar, and access codes for this home.",
                        ctaTitle = "Invite someone",
                        onCta = ::requestInvite,
                    )
            }

        // ─── Permission projection ────────────────────────────────

        /**
         * What the viewer may do to this member, derived from the same
         * rank rules the backend enforces so we never offer a doomed
         * action.
         *
         *  - role change: `members.manage` + `assertCanMutateTarget`
         *    (`backend/routes/homeIam.js:218`, `:224`)
         *  - remove: self-leave is always allowed
         *    (`backend/routes/homeIam.js:517`); otherwise
         *    `members.manage` + rank, and the owner can never be removed
         *    (`:559`).
         */
        internal fun actionTarget(
            occ: OccupantDto,
            name: String,
        ): MemberActionTarget {
            val me = currentUserId
            val isSelf = me != null && occ.userId == me
            val actorIsOwner = access?.isOwner == true
            val assignable =
                if (canManageMembers) {
                    HomeRoleAssignment.assignableRoles(
                        actorRole = access?.roleBase,
                        actorIsOwner = actorIsOwner,
                        targetRole = occ.role,
                        isSelf = isSelf,
                    )
                } else {
                    emptyList()
                }
            val targetIsOwner = occ.role?.lowercase() == "owner"
            val canRemove =
                if (isSelf) {
                    true
                } else {
                    canManageMembers &&
                        !targetIsOwner &&
                        HomeRoleAssignment.canMutate(
                            actorRole = if (actorIsOwner) "owner" else access?.roleBase,
                            targetRole = occ.role,
                        )
                }
            return MemberActionTarget(
                userId = occ.userId,
                name = name,
                currentRole = occ.role,
                assignableRoles = assignable,
                canRemove = canRemove,
            )
        }

        // ─── Row mapping ──────────────────────────────────────────

        internal fun rowForOccupant(
            occ: OccupantDto,
            now: Instant,
            zone: ZoneId,
        ): RowModel {
            val role = MemberRole.parse(occ.role)
            val palette = role.palette
            val name = displayName(occ)
            val target = actionTarget(occ, name)
            val hasActions = target.assignableRoles.isNotEmpty() || target.canRemove
            val joined =
                relativeText(
                    occ.joinedAt ?: occ.startAt ?: occ.createdAt,
                    now = now,
                    zone = zone,
                )?.let { "Joined $it" }
            return RowModel(
                id = occ.userId,
                title = name,
                subtitle = role.label,
                template = RowTemplate.AvatarKebab,
                leading =
                    RowLeading.AvatarWithBadge(
                        name = name,
                        imageUrl = occ.avatarUrl,
                        background = AvatarBackground.Gradient(MemberAvatarTone.toneFor(occ.userId).gradient),
                        size = AvatarBadgeSize.Medium,
                        verified = true,
                    ),
                trailing = if (hasActions) RowTrailing.Kebab else RowTrailing.None,
                onSecondary =
                    if (hasActions) {
                        { _pendingEvent.value = MembersListEvent.OpenMemberActions(target) }
                    } else {
                        null
                    },
                body = joined,
                subtitleIcon = role.icon,
                bodyIcon = joined?.let { PantopusIcon.Clock },
                inlineChip =
                    RowChip(
                        text = role.label,
                        icon = role.icon,
                        tint =
                            RowChip.Tint.Custom(
                                background = palette.background,
                                foreground = palette.foreground,
                            ),
                    ),
            )
        }

        internal fun rowForPending(
            invite: PendingInviteDto,
            now: Instant,
            zone: ZoneId,
        ): RowModel {
            val role = MemberRole.parse(invite.role)
            val palette = role.palette
            val name = invite.name
            val inviteId = invite.id
            val invitedText =
                "Invited " + (relativeText(invite.createdAt, now = now, zone = zone) ?: "recently")
            return RowModel(
                id = invite.id,
                title = name,
                subtitle = role.label,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.AvatarWithBadge(
                        name = name,
                        imageUrl = null,
                        background = AvatarBackground.Gradient(MemberAvatarTone.toneFor(invite.id).gradient),
                        size = AvatarBadgeSize.Medium,
                        verified = false,
                    ),
                trailing =
                    RowTrailing.VerticalActions(
                        primary =
                            VerticalAction(
                                label = "Resend",
                                variant = CompactButtonVariant.Primary,
                                onClick = { resendInvite(inviteId) },
                            ),
                        secondary =
                            VerticalAction(
                                label = "Cancel",
                                variant = CompactButtonVariant.Ghost,
                                onClick = { cancelInvite(inviteId) },
                            ),
                    ),
                body = invitedText,
                subtitleIcon = role.icon,
                bodyIcon = PantopusIcon.Mailbox,
                inlineChip =
                    RowChip(
                        text = role.label,
                        icon = role.icon,
                        tint =
                            RowChip.Tint.Custom(
                                background = palette.background,
                                foreground = palette.foreground,
                            ),
                    ),
            )
        }

        /**
         * Requests-tab row — Invite / Decline stacked at the trailing
         * edge, same vocabulary as the Pending tab's Resend / Cancel pair.
         */
        internal fun rowForRequest(
            request: HouseholdAccessRequestDto,
            now: Instant,
            zone: ZoneId,
        ): RowModel {
            val name = request.requesterDisplayName()
            val identity = request.requestedIdentityLabel()
            val requestId = request.id
            val requested =
                "Requested " + (relativeText(request.createdAt, now = now, zone = zone) ?: "recently")
            return RowModel(
                id = request.id,
                title = name,
                subtitle = "Wants to join as $identity",
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.AvatarWithBadge(
                        name = name,
                        imageUrl = request.requester?.profilePictureUrl,
                        background =
                            AvatarBackground.Gradient(
                                MemberAvatarTone.toneFor(request.requesterUserId).gradient,
                            ),
                        size = AvatarBadgeSize.Medium,
                        verified = false,
                    ),
                trailing =
                    RowTrailing.VerticalActions(
                        primary =
                            VerticalAction(
                                label = "Invite",
                                variant = CompactButtonVariant.Primary,
                                onClick = {
                                    _pendingEvent.value =
                                        MembersListEvent.ConfirmApproveRequest(requestId, name)
                                },
                            ),
                        secondary =
                            VerticalAction(
                                label = "Decline",
                                variant = CompactButtonVariant.Destructive,
                                onClick = {
                                    _pendingEvent.value =
                                        MembersListEvent.ConfirmDeclineRequest(requestId, name, identity)
                                },
                            ),
                    ),
                body = requested,
                subtitleIcon = PantopusIcon.UserPlus,
                bodyIcon = PantopusIcon.Clock,
                inlineChip =
                    RowChip(
                        text = identity,
                        icon = PantopusIcon.Home,
                        tint =
                            RowChip.Tint.Custom(
                                background = PantopusColors.homeBg,
                                foreground = PantopusColors.home,
                            ),
                    ),
            )
        }

        /**
         * Audit-log row — action verb as the title, `actor → target` as
         * the subtitle, and the timestamp as the trailing meta.
         * Read-only: no tap target, no trailing control. Mirrors RN's
         * audit card (`src/app/homes/[id]/members/index.tsx:387-399`).
         */
        internal fun rowForAudit(
            entry: HomeAuditEntryDto,
            now: Instant,
            zone: ZoneId,
        ): RowModel {
            val actor = entry.actorDisplayName()
            val target = entry.targetLabel()
            return RowModel(
                id = entry.id,
                title = entry.actionLabel(),
                subtitle = if (target != null) "$actor → $target" else actor,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.TypeIcon(
                        icon = PantopusIcon.FileText,
                        background = PantopusColors.homeBg,
                        foreground = PantopusColors.home,
                    ),
                trailing = RowTrailing.None,
                subtitleIcon = PantopusIcon.User,
                timeMeta = relativeText(entry.createdAt, now = now, zone = zone),
            )
        }

        // ─── Helpers ───────────────────────────────────────────────

        companion object {
            private const val SECONDS_PER_MINUTE = 60L
            private const val SECONDS_PER_HOUR = 3_600L
            private const val SECONDS_PER_DAY = 86_400L
            private const val ONE_DAY = 1L
            private const val DAYS_IN_WEEK = 7L
            private const val DAYS_IN_MONTH = 30L

            fun displayName(occ: OccupantDto): String {
                if (!occ.displayName.isNullOrEmpty()) return occ.displayName
                if (!occ.username.isNullOrEmpty()) return "@${occ.username}"
                return "Member"
            }

            private val iso8601: DateTimeFormatter = DateTimeFormatter.ISO_DATE_TIME

            private fun parseInstant(raw: String?): Instant? {
                if (raw.isNullOrEmpty()) return null
                return runCatching {
                    Instant.parse(raw)
                }.getOrElse {
                    runCatching {
                        iso8601.parse(raw, Instant::from)
                    }.getOrNull()
                }
            }

            internal fun relativeText(
                raw: String?,
                now: Instant,
                zone: ZoneId,
            ): String? {
                val instant = parseInstant(raw) ?: return null
                val interval = now.epochSecond - instant.epochSecond
                val startOfNow = now.atZone(zone).toLocalDate()
                val startOfDate = instant.atZone(zone).toLocalDate()
                val dayDelta = ChronoUnit.DAYS.between(startOfDate, startOfNow)
                val formatter =
                    DateTimeFormatter
                        .ofPattern("MMM d", Locale.US)
                        .withZone(zone)
                return when {
                    interval < SECONDS_PER_MINUTE -> "just now"
                    interval < SECONDS_PER_HOUR -> "${interval / SECONDS_PER_MINUTE}m ago"
                    interval < SECONDS_PER_DAY -> "${interval / SECONDS_PER_HOUR}h ago"
                    dayDelta == ONE_DAY -> "yesterday"
                    dayDelta < DAYS_IN_WEEK -> "${dayDelta}d ago"
                    dayDelta < DAYS_IN_MONTH -> "${dayDelta / DAYS_IN_WEEK}w ago"
                    else -> formatter.format(instant)
                }
            }
        }
    }
