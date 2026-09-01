@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.businesses.team

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessAccessDto
import app.pantopus.android.data.api.models.businesses.BusinessRolePresetDto
import app.pantopus.android.data.api.models.businesses.BusinessSeatDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamMemberDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
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

/** Nav arg key for the business id consumed via [SavedStateHandle]. */
const val BUSINESS_TEAM_ID_KEY = "businessId"

// ─── Projected view models (parity with iOS) ──────────────────────────

/** One member row in a role section. */
data class BusinessTeamMemberRow(
    val id: String,
    val userId: String,
    val name: String,
    val email: String?,
    val role: BusinessRole,
    val avatarGradient: GradientPair,
    val joinedText: String?,
    val canManage: Boolean,
)

/** One role group section (owner → viewer order). */
data class BusinessTeamSection(
    val id: String,
    val role: BusinessRole,
    val rows: List<BusinessTeamMemberRow>,
) {
    val headerTitle: String get() = role.pluralLabel
}

/** One pending seat-invite row. */
data class BusinessTeamPendingRow(
    val id: String,
    val seatId: String,
    val name: String,
    val email: String?,
    val role: BusinessRole,
    val invitedText: String?,
    val canManage: Boolean,
)

/** Loaded payload for the Team screen. */
data class BusinessTeamContent(
    val sections: List<BusinessTeamSection>,
    val pending: List<BusinessTeamPendingRow>,
    val canManage: Boolean,
    val canInvite: Boolean,
)

/** Render state for the Team screen. */
sealed interface BusinessTeamUiState {
    data object Loading : BusinessTeamUiState

    data class Loaded(val content: BusinessTeamContent) : BusinessTeamUiState

    data class Empty(val canInvite: Boolean) : BusinessTeamUiState

    data class Error(val message: String) : BusinessTeamUiState
}

/**
 * Owner-side business team & roles roster. Mirrors iOS
 * `BusinessTeamViewModel` — reads the businessIam members list (grouped by
 * `role_base`) plus the businessSeats pending invites, and gates actions on
 * `GET /:id/me`.
 */
@HiltViewModel
class BusinessTeamViewModel
    @Inject
    constructor(
        private val repo: BusinessTeamRepository,
        networkMonitor: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val businessId: String = savedStateHandle[BUSINESS_TEAM_ID_KEY] ?: ""

        /** Connectivity for the offline banner. */
        val isOnline: StateFlow<Boolean> = networkMonitor.isOnline

        private val _state = MutableStateFlow<BusinessTeamUiState>(BusinessTeamUiState.Loading)
        val state: StateFlow<BusinessTeamUiState> = _state.asStateFlow()

        private val _rolePresets = MutableStateFlow<List<BusinessRolePresetDto>>(emptyList())
        val rolePresets: StateFlow<List<BusinessRolePresetDto>> = _rolePresets.asStateFlow()

        private var access: BusinessAccessDto? = null
        private var members: List<BusinessTeamMemberDto> = emptyList()
        private var pendingSeats: List<BusinessSeatDto> = emptyList()
        private var loadedOnce = false

        /** Idempotent — re-running won't refetch once content is loaded. */
        fun load() {
            if (loadedOnce) return
            reload()
        }

        /** Pull-to-refresh / retry. */
        fun refresh() = reload()

        private fun reload() {
            _state.value = BusinessTeamUiState.Loading
            viewModelScope.launch {
                when (val accessResult = repo.access(businessId)) {
                    is NetworkResult.Failure -> {
                        _state.value = BusinessTeamUiState.Error(accessResult.error.message)
                        return@launch
                    }
                    is NetworkResult.Success -> {
                        access = accessResult.data
                        if (!accessResult.data.hasAccess) {
                            _state.value = BusinessTeamUiState.Error("You don't have access to this team.")
                            return@launch
                        }
                    }
                }

                when (val memberResult = repo.members(businessId)) {
                    is NetworkResult.Failure -> {
                        _state.value = BusinessTeamUiState.Error(memberResult.error.message)
                        return@launch
                    }
                    is NetworkResult.Success -> {
                        members = memberResult.data.members
                    }
                }

                // Pending seats + presets are best-effort.
                (repo.seats(businessId) as? NetworkResult.Success)?.let { result ->
                    pendingSeats = result.data.seats.filter { (it.inviteStatus ?: "").lowercase() == "pending" }
                }
                if (_rolePresets.value.isEmpty()) {
                    (repo.rolePresets(businessId) as? NetworkResult.Success)?.let { result ->
                        _rolePresets.value = result.data.presets.sortedBy { it.sortOrder }
                    }
                }

                loadedOnce = true
                applyState()
            }
        }

        // ─── Gating ───────────────────────────────────────────────

        private fun canManage(): Boolean {
            val a = access ?: return false
            return a.isOwner || a.permissions.contains("team.manage")
        }

        private fun canInvite(): Boolean {
            val a = access ?: return false
            return a.isOwner || a.permissions.contains("team.invite")
        }

        // ─── Mutations ────────────────────────────────────────────

        /** Fold a freshly-created seat invite into the pending bucket. */
        fun handleInvited(seat: BusinessSeatDto) {
            pendingSeats = listOf(seat) + pendingSeats
            applyState()
        }

        /** Optimistic role change with rollback. */
        fun changeRole(
            userId: String,
            preset: BusinessRolePresetDto,
        ) {
            val previous = members
            members =
                members.map { member ->
                    if (member.user?.id == userId) member.copy(roleBase = preset.roleBase) else member
                }
            applyState()
            viewModelScope.launch {
                when (repo.changeRole(businessId, userId, preset.key)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        members = previous
                        applyState()
                    }
                }
            }
        }

        /** Optimistic member removal with rollback. */
        fun remove(userId: String) {
            val previous = members
            members = previous.filterNot { it.user?.id == userId }
            applyState()
            viewModelScope.launch {
                when (repo.removeMember(businessId, userId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        members = previous
                        applyState()
                    }
                }
            }
        }

        /** Optimistic cancel of a pending seat invite with rollback. */
        fun cancelInvite(seatId: String) {
            val previous = pendingSeats
            pendingSeats = previous.filterNot { it.id == seatId }
            applyState()
            viewModelScope.launch {
                when (repo.cancelSeat(businessId, seatId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        pendingSeats = previous
                        applyState()
                    }
                }
            }
        }

        /** Fetch the effective permission set for one member. */
        suspend fun memberPermissions(userId: String): Result<List<String>> =
            when (val result = repo.memberPermissions(businessId, userId)) {
                is NetworkResult.Success -> Result.success(result.data.permissions)
                is NetworkResult.Failure -> Result.failure(result.error)
            }

        /** Toggle one scoped permission for a member. Returns true on success. */
        suspend fun togglePermission(
            userId: String,
            permission: String,
            allowed: Boolean,
        ): Boolean = repo.togglePermission(businessId, userId, permission, allowed) is NetworkResult.Success

        // ─── State projection ─────────────────────────────────────

        private fun applyState() {
            val manage = canManage()
            val invite = canInvite()
            val now = Instant.now()
            val zone = ZoneId.systemDefault()

            val sections =
                members
                    .filter { it.user != null }
                    .groupBy { BusinessRole.parse(it.roleBase) }
                    .toList()
                    .sortedByDescending { it.first.rank }
                    .mapNotNull { (role, bucket) ->
                        if (bucket.isEmpty()) {
                            null
                        } else {
                            BusinessTeamSection(
                                id = role.wire,
                                role = role,
                                rows = bucket.map { rowForMember(it, role, manage, now, zone) },
                            )
                        }
                    }

            val pending =
                pendingSeats.map { seat ->
                    val role = BusinessRole.parse(seat.roleBase)
                    BusinessTeamPendingRow(
                        id = seat.id,
                        seatId = seat.id,
                        name = seat.displayName?.ifBlank { null } ?: seat.inviteEmail?.ifBlank { null } ?: "Invited seat",
                        email = seat.inviteEmail,
                        role = role,
                        invitedText = relativeText(seat.createdAt, now, zone)?.let { "Invited $it" },
                        canManage = manage,
                    )
                }

            _state.value =
                if (sections.isEmpty() && pending.isEmpty()) {
                    BusinessTeamUiState.Empty(canInvite = invite)
                } else {
                    BusinessTeamUiState.Loaded(
                        BusinessTeamContent(sections = sections, pending = pending, canManage = manage, canInvite = invite),
                    )
                }
        }

        private fun rowForMember(
            member: BusinessTeamMemberDto,
            role: BusinessRole,
            canManage: Boolean,
            now: Instant,
            zone: ZoneId,
        ): BusinessTeamMemberRow {
            val userId = member.user?.id ?: member.id
            val name = displayName(member)
            return BusinessTeamMemberRow(
                id = userId,
                userId = userId,
                name = name,
                email = member.user?.email,
                role = role,
                avatarGradient = BusinessTeamAvatarTone.toneFor(userId).gradient,
                joinedText = relativeText(member.joinedAt ?: member.invitedAt, now, zone)?.let { "Joined $it" },
                canManage = canManage && role != BusinessRole.Owner,
            )
        }

        companion object {
            private const val SECONDS_PER_MINUTE = 60L
            private const val SECONDS_PER_HOUR = 3_600L
            private const val SECONDS_PER_DAY = 86_400L
            private const val ONE_DAY = 1L
            private const val DAYS_IN_WEEK = 7L
            private const val DAYS_IN_MONTH = 30L

            fun displayName(member: BusinessTeamMemberDto): String {
                member.user?.name?.takeIf { it.isNotBlank() }?.let { return it }
                member.user?.username?.takeIf { it.isNotBlank() }?.let { return "@$it" }
                member.user?.email?.takeIf { it.isNotBlank() }?.let { return it }
                return "Team member"
            }

            private val iso8601: DateTimeFormatter = DateTimeFormatter.ISO_DATE_TIME

            private fun parseInstant(raw: String?): Instant? {
                if (raw.isNullOrEmpty()) return null
                return runCatching { Instant.parse(raw) }
                    .getOrElse { runCatching { iso8601.parse(raw, Instant::from) }.getOrNull() }
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
                val formatter = DateTimeFormatter.ofPattern("MMM d", Locale.US).withZone(zone)
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
