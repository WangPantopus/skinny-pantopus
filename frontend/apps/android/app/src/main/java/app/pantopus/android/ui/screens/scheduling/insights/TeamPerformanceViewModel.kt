@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.insights

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessTeamMemberDto
import app.pantopus.android.data.api.models.scheduling.TeamPerformanceResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

private const val BUSINESS_ONLY_CODE = "BUSINESS_ONLY"

/**
 * H12 Team Performance (A17, Business violet, business-only). Compares
 * round-robin members on booking load + reliability. Loaded / single-member /
 * empty / business-only / permission-gated (403) / loading / error.
 *
 * Wiring: `GET /insights/team?days` (business-only; `400 BUSINESS_ONLY` for
 * non-business owners). Member names resolve via `GET /api/businesses/:id/
 * members`. The deployed endpoint does NOT return revenue/ratings/avg duration,
 * so those design fields are omitted rather than fabricated.
 */
@HiltViewModel
class TeamPerformanceViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val businessTeam: BusinessTeamRepository,
        private val errors: SchedulingErrorDecoder,
        private val relay: InsightsNavRelay,
    ) : ViewModel() {
        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var started = false
        private var report: TeamPerformanceResponse? = null
        private var memberNames: Map<String, String> = emptyMap()

        private val _filter = MutableStateFlow(InsightsFilter.Default)
        val filter: StateFlow<InsightsFilter> = _filter.asStateFlow()

        private val _sort = MutableStateFlow(HostSort.Bookings)
        val sort: StateFlow<HostSort> = _sort.asStateFlow()

        private val _memberOptions = MutableStateFlow<List<InsightsFilterOption>>(emptyList())
        val memberOptions: StateFlow<List<InsightsFilterOption>> = _memberOptions.asStateFlow()

        private val _state = MutableStateFlow<TeamUiState>(TeamUiState.Loading)
        val state: StateFlow<TeamUiState> = _state.asStateFlow()

        val pillar: SchedulingPillar get() = owner.pillar()

        fun start() {
            if (started) return
            started = true
            owner = relay.consumeOwner() ?: SchedulingOwner.Personal
            load()
        }

        fun refresh() = load()

        fun apply(newFilter: InsightsFilter) {
            _filter.value = newFilter
            load()
        }

        fun toggleSort() {
            _sort.value = if (_sort.value == HostSort.Bookings) HostSort.NoShow else HostSort.Bookings
            if (report != null) _state.value = projectLoadedOrEmpty()
        }

        private fun load() {
            _state.value = TeamUiState.Loading
            val businessId = (owner as? SchedulingOwner.Business)?.businessUserId
            if (businessId == null) {
                _state.value = TeamUiState.BusinessOnly
                return
            }
            viewModelScope.launch {
                val days = _filter.value.days()
                when (val reportResult = repo.getTeamInsights(owner, days)) {
                    is NetworkResult.Success -> {
                        report = reportResult.data
                        val members = businessTeam.members(businessId).dataOrNull()?.members.orEmpty()
                        applyMembers(members)
                        _state.value = projectLoadedOrEmpty()
                    }
                    is NetworkResult.Failure -> {
                        _state.value = mapError(errors.decode(reportResult.error))
                    }
                }
            }
        }

        private fun applyMembers(members: List<BusinessTeamMemberDto>) {
            val names = HashMap<String, String>()
            val options = ArrayList<InsightsFilterOption>()
            for (member in members) {
                val user = member.user ?: continue
                val name = user.name ?: user.username ?: "Team member"
                names[user.id] = name
                options.add(InsightsFilterOption(user.id, name))
            }
            memberNames = names
            _memberOptions.value = options
        }

        private fun projectLoadedOrEmpty(): TeamUiState {
            val base = InsightsMath.hostRows(report?.hosts, memberNames, _sort.value)
            val rows =
                if (_filter.value.memberIds.isEmpty()) {
                    base
                } else {
                    base.filter { _filter.value.memberIds.contains(it.id) }
                }
            if (rows.isEmpty()) return TeamUiState.Empty
            val windowDays = report?.windowDays?.takeIf { it > 0 } ?: _filter.value.days()
            return TeamUiState.Loaded(
                TeamData(
                    rows = rows,
                    balanceLabel = InsightsMath.balanceLabel(rows),
                    totalBookings = rows.sumOf { it.bookings },
                    isSingleMember = rows.size == 1,
                    windowDays = windowDays,
                ),
            )
        }

        private fun mapError(error: SchedulingError): TeamUiState =
            when (error) {
                is SchedulingError.Secret -> TeamUiState.PermissionGated
                is SchedulingError.Generic ->
                    if (error.code?.uppercase() == BUSINESS_ONLY_CODE || error.message.uppercase().contains(BUSINESS_ONLY_CODE)) {
                        TeamUiState.BusinessOnly
                    } else {
                        TeamUiState.Error(error.message)
                    }
                else -> TeamUiState.Error("Couldn't load team performance.")
            }

        private fun <T> NetworkResult<T>.dataOrNull(): T? = (this as? NetworkResult.Success)?.data
    }

/** Everything the H12 screen renders once loaded. */
data class TeamData(
    val rows: List<HostRow>,
    val balanceLabel: String,
    val totalBookings: Int,
    val isSingleMember: Boolean,
    val windowDays: Int,
)

sealed interface TeamUiState {
    data object Loading : TeamUiState

    data class Loaded(val data: TeamData) : TeamUiState

    data object Empty : TeamUiState

    data object BusinessOnly : TeamUiState

    data object PermissionGated : TeamUiState

    data class Error(val message: String) : TeamUiState
}
