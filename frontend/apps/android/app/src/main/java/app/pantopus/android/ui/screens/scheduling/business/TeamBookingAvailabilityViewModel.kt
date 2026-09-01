@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.business

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/**
 * G3 Team Booking Availability (Stream A13) — business-only. Which members are
 * bookable + the week's coverage that feeds round-robin. Roster names/avatars
 * come from `GET /api/businesses/:id/members`; per-member bookability + coverage
 * are derived from `GET /team-availability` (members + free grids). Admin gating
 * from `GET /api/businesses/:id/me`. Mirrors iOS `TeamBookingAvailabilityViewModel`
 * and `teamavail-frames.jsx` (default / loading / not-bookable / gaps / gated).
 *
 * Honest backend mapping: `team-availability` returns only member ids + free
 * slots — there is no per-member "bookable" write and no configured-hours
 * summary, and `/availability` is self-scoped. So bookability is DERIVED from
 * whether a member has openings this week; tapping a row opens G4 (editable for
 * yourself, read-only for teammates).
 */
@HiltViewModel
class TeamBookingAvailabilityViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val businessTeam: BusinessTeamRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        data class MemberRowUi(
            val id: String,
            val name: String,
            val role: String?,
            val summary: String,
            val bookable: Boolean,
            val usesPersonalHours: Boolean,
            val isSelf: Boolean,
        )

        data class CoverageUi(
            val text: String,
            val warning: Boolean,
        )

        data class EventTypePick(
            val id: String,
            val name: String,
            val collective: Boolean,
        )

        sealed interface UiState {
            data object Loading : UiState

            data class Content(
                val rows: List<MemberRowUi>,
                val coverage: CoverageUi?,
                val gated: Boolean,
                val assignable: List<EventTypePick>,
            ) : UiState

            /** Zero members after a successful load — dedicated empty state (mirrors iOS .empty phase). */
            data object Empty : UiState

            data object BusinessOnly : UiState

            data class Error(val message: String) : UiState
        }

        private val _state = MutableStateFlow<UiState>(UiState.Loading)
        val state: StateFlow<UiState> = _state.asStateFlow()

        val tz: String = ZoneId.systemDefault().id

        fun load() {
            _state.value = UiState.Loading
            val owner = businessOwner()
            if (owner == null) {
                _state.value = UiState.BusinessOnly
                return
            }
            val currentUserId = signedInUserId()
            viewModelScope.launch {
                when (val membersResult = businessTeam.members(owner.businessUserId)) {
                    is NetworkResult.Failure -> {
                        val decoded = errors.decode(membersResult.error)
                        _state.value =
                            if (decoded is SchedulingError.Generic && decoded.code == CODE_BUSINESS_ONLY) {
                                UiState.BusinessOnly
                            } else {
                                UiState.Error(decoded.displayMessage("Couldn't load your team."))
                            }
                    }
                    is NetworkResult.Success -> {
                        val window = weekWindow()
                        val freeDeferred =
                            async { repo.teamAvailability(owner, window.fromIso, window.toIso, tz).dataOrNull()?.freeByMember.orEmpty() }
                        val accessDeferred = async { businessTeam.access(owner.businessUserId).dataOrNull() }
                        val typesDeferred = async { repo.getEventTypes(owner).dataOrNull()?.eventTypes.orEmpty() }

                        val freeByMember = freeDeferred.await()
                        val access = accessDeferred.await()
                        val eventTypes = typesDeferred.await()

                        val gated = access != null && access.isOwner != true && !access.permissions.contains(PERM_TEAM_MANAGE)
                        val rows =
                            membersResult.data.members.mapNotNull { member ->
                                val user = member.user ?: return@mapNotNull null
                                val slots = freeByMember[user.id].orEmpty()
                                val days = distinctDayCount(slots)
                                val summary =
                                    if (days > 0) "Open $days day${if (days == 1) "" else "s"} this week" else "Not taking bookings"
                                MemberRowUi(
                                    id = user.id,
                                    name = user.name ?: user.username ?: "Member",
                                    role = member.title ?: member.roleBase?.replaceFirstChar { it.uppercase() },
                                    summary = summary,
                                    bookable = days > 0,
                                    usesPersonalHours = true,
                                    isSelf = currentUserId != null && user.id == currentUserId,
                                )
                            }
                        _state.value =
                            if (rows.isEmpty()) {
                                UiState.Empty
                            } else {
                                UiState.Content(
                                    rows = rows,
                                    coverage = coverage(window, freeByMember),
                                    gated = gated,
                                    assignable = eventTypes.map { EventTypePick(it.id, it.name, it.assignmentMode == MODE_COLLECTIVE) },
                                )
                            }
                    }
                }
            }
        }

        fun refresh() = load()

        private fun businessOwner(): SchedulingOwner.Business? = signedInUserId()?.let { SchedulingOwner.Business(it) }

        private fun signedInUserId(): String? = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id

        // ─── Derivations ────────────────────────────────────────────────────────

        private data class Window(val fromIso: String, val toIso: String, val days: List<String>)

        private fun weekWindow(): Window {
            val today = LocalDate.now(ZoneOffset.UTC)
            val days = (0 until 7).map { today.plusDays(it.toLong()).toString() }
            val from = today.atStartOfDay(ZoneOffset.UTC).toInstant()
            val to = today.plusDays(7).atStartOfDay(ZoneOffset.UTC).toInstant()
            return Window(fromIso = ISO.format(from), toIso = ISO.format(to), days = days)
        }

        private fun distinctDayCount(slots: List<SlotDto>): Int =
            slots.mapNotNull { (it.startLocal ?: it.start).take(10).ifBlank { null } }.toSet().size

        private fun coverage(
            window: Window,
            freeByMember: Map<String, List<SlotDto>>,
        ): CoverageUi? {
            if (freeByMember.isEmpty()) return null
            val coveredDays =
                freeByMember.values.flatten().mapNotNull { (it.startLocal ?: it.start).take(10).ifBlank { null } }.toSet()
            val uncovered = window.days.filter { it !in coveredDays }
            if (uncovered.isEmpty()) return CoverageUi("Your team has open hours every day this week.", warning = false)
            val weekdays = uncovered.mapNotNull { runCatching { LocalDate.parse(it) }.getOrNull() }
            val isoWeekdays = weekdays.map { it.dayOfWeek.value % 7 } // Mon=1..Sun=0
            val labels = isoWeekdays.map { weekdayPlural(it) }.distinct().sorted()
            val label = labels.take(2).joinToString(" & ")
            val hasWeekdayGap = isoWeekdays.any { it in 1..5 }
            return if (hasWeekdayGap) {
                CoverageUi("$label have no coverage — add hours for at least one member.", warning = true)
            } else {
                CoverageUi("No one is available $label.", warning = false)
            }
        }

        private fun <T> NetworkResult<T>.dataOrNull(): T? = (this as? NetworkResult.Success)?.data

        private fun SchedulingError.displayMessage(fallback: String): String =
            when (this) {
                is SchedulingError.Generic -> message
                else -> fallback
            }

        private companion object {
            const val PERM_TEAM_MANAGE = "team.manage"
            const val CODE_BUSINESS_ONLY = "BUSINESS_ONLY"
            const val MODE_COLLECTIVE = "collective"
            val ISO: DateTimeFormatter = DateTimeFormatter.ISO_INSTANT
        }
    }
