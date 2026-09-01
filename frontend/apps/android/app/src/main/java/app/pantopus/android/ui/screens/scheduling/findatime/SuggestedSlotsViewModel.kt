@file:Suppress(
    "PackageNaming",
    "TooManyFunctions",
    "MagicNumber",
    "LongMethod",
    "CyclomaticComplexMethod",
    "ReturnCount",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.scheduling.findatime

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CreateHomeEventRequest
import app.pantopus.android.data.api.models.scheduling.CreatePollRequest
import app.pantopus.android.data.api.models.scheduling.PollOptionInput
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.slotTimeLabel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale
import javax.inject.Inject

/** F5 sub-head facts. */
data class SlotsHeader(
    val peopleLabel: String,
    val durationLabel: String,
    val windowLabel: String,
    val tzId: String,
    val tzLabel: String,
)

/** One suggested common-time row. */
data class SlotRowUi(
    val start: String,
    val endIso: String,
    val dayLabel: String,
    val timeLabel: String,
    val members: List<Pair<FindMember, Boolean>>,
    val freeLabel: String,
    val isBest: Boolean,
    val assigneeName: String?,
)

/** F5 Find a Time — Suggested Slots. */
sealed interface SuggestedSlotsUiState {
    /**
     * Computing state. [composingSubtitle] is populated once criteria are
     * resolved ("Composing Mom, Dad and Ava" — design frame 1 / nit fix).
     */
    data class Loading(val composingSubtitle: String? = null) : SuggestedSlotsUiState

    data class Loaded(
        val header: SlotsHeader,
        val slots: List<SlotRowUi>,
        val expandedStart: String?,
        val isSingle: Boolean,
        val busy: Boolean = false,
    ) : SuggestedSlotsUiState

    /** No-overlap empty state. */
    data class Empty(val header: SlotsHeader) : SuggestedSlotsUiState

    data class Error(val message: String) : SuggestedSlotsUiState

    /** "Send proposal to members" success → a poll members can vote on. */
    data class Sent(val pollId: String, val peopleCount: Int) : SuggestedSlotsUiState

    /** "Book it" success → the event landed on the family calendar. */
    data class Booked(val label: String) : SuggestedSlotsUiState
}

/**
 * F5 Find a Time — Suggested Slots (home-only). Reads the F4 criteria from
 * [FindATimeSession] (the route is arg-less); if opened cold it resolves a
 * sensible default home + roster. Renders common free slots from
 * `POST /find-a-time`, books a chosen slot as one new family event, or turns
 * the candidates into a member poll.
 */
@HiltViewModel
class SuggestedSlotsViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val homes: HomesRepository,
        private val members: HomeMembersRepository,
        private val errors: SchedulingErrorDecoder,
        private val session: FindATimeSession,
    ) : ViewModel() {
        private val _state = MutableStateFlow<SuggestedSlotsUiState>(SuggestedSlotsUiState.Loading())
        val state: StateFlow<SuggestedSlotsUiState> = _state.asStateFlow()

        private var criteria: FindATimeCriteria? = null
        private var lastSlots: List<SlotRowUi> = emptyList()
        private var started = false

        fun start() {
            if (started) return
            started = true
            load()
        }

        fun load() {
            _state.value = SuggestedSlotsUiState.Loading()
            viewModelScope.launch {
                val resolved = criteria ?: session.criteria ?: resolveDefault()
                if (resolved == null) {
                    _state.value = SuggestedSlotsUiState.Error("No household yet. Create one to coordinate a family time.")
                    return@launch
                }
                criteria = resolved
                // F5 nit fix: populate composing subtitle with member names per design frame 1.
                _state.value = SuggestedSlotsUiState.Loading(composingSubtitle = composingSubtitle(resolved))
                compute(resolved)
            }
        }

        /** "Composing Mom, Dad and Ava" — dynamic subtitle for the computing shimmer state. */
        private fun composingSubtitle(c: FindATimeCriteria): String {
            val names = c.requiredMembers.map { it.name.substringBefore(" ") }
            return when {
                names.isEmpty() -> "Overlaying everyone's availability"
                names.size == 1 -> "Composing ${names[0]}'s availability"
                else -> "Composing ${names.dropLast(1).joinToString(", ")} and ${names.last()}"
            }
        }

        private suspend fun resolveDefault(): FindATimeCriteria? {
            val home =
                when (val r = homes.myHomes()) {
                    is NetworkResult.Success -> r.data.homes.firstOrNull()
                    is NetworkResult.Failure -> null
                } ?: return null
            val roster =
                when (val r = members.listOccupants(home.id)) {
                    is NetworkResult.Success -> r.data.occupants.toFindMembers()
                    is NetworkResult.Failure -> emptyList()
                }
            if (roster.isEmpty()) return null
            val today = LocalDate.now()
            val seed = session.takeSeed()
            val from = seed?.first?.let(LocalDate::parse) ?: today
            val to = seed?.second?.let(LocalDate::parse) ?: today.plusDays(WindowPreset.ThisWeek.days)
            return FindATimeCriteria(
                homeId = home.id,
                title = "Family time",
                members = roster,
                mode = FindMode.Collective,
                durationMin = 30,
                fromIso = FindATimeFormat.isoDate(from),
                // Exclusive end — see [FindATimeCriteria.toIso]: covers the whole
                // last day, which a date-only inclusive bound would drop.
                toIso = FindATimeFormat.isoDate(to.plusDays(1)),
                windowLabel = FindATimeFormat.windowPhrase(from, to),
                timezone = FindATimeFormat.deviceZoneId(),
            )
        }

        private suspend fun compute(c: FindATimeCriteria) {
            val header = headerOf(c)
            val required = c.requiredMembers
            val result =
                repo.findATime(
                    home = SchedulingOwner.Home(c.homeId),
                    memberIds = required.map { it.userId },
                    from = c.fromIso,
                    to = c.toIso,
                    mode = c.mode.wire,
                    durationMin = c.durationMin,
                    timezone = c.timezone,
                )
            when (result) {
                is NetworkResult.Success -> {
                    val rows = result.data.slots.mapIndexed { i, slot -> rowOf(slot, c, required, isBest = i == 0) }
                    lastSlots = rows
                    _state.value =
                        if (rows.isEmpty()) {
                            // Record the verdict so F4's no-overlap frame (amber
                            // banner + quick fixes) renders when the setup editor
                            // opens; cleared again on any successful compute.
                            session.noOverlapMessage = noOverlapCopy(required)
                            SuggestedSlotsUiState.Empty(header)
                        } else {
                            session.noOverlapMessage = null
                            SuggestedSlotsUiState.Loaded(
                                header = header,
                                slots = rows,
                                expandedStart = rows.firstOrNull()?.start,
                                isSingle = rows.size == 1,
                            )
                        }
                }
                is NetworkResult.Failure ->
                    _state.value = SuggestedSlotsUiState.Error(errors.decode(result.error).let { friendly(it) })
            }
        }

        /**
         * Banner-body guidance for the F4 no-overlap frame (the banner title
         * already states "No time works for all N"). Mirrors iOS `noOverlapCopy`.
         */
        private fun noOverlapCopy(required: List<FindMember>): String {
            val name = required.firstOrNull()?.name
            return if (name != null) {
                "Try making $name optional, or widen the date window."
            } else {
                "Try making someone optional, or widen the date window."
            }
        }

        private fun rowOf(
            slot: SlotDto,
            c: FindATimeCriteria,
            required: List<FindMember>,
            isBest: Boolean,
        ): SlotRowUi {
            val eligible = slot.eligibleHosts
            val membersWithFree =
                required.map { m -> m to (eligible == null || m.userId in eligible) }
            val freeCount = membersWithFree.count { it.second }
            val assignee =
                if (c.mode == FindMode.RoundRobin) {
                    membersWithFree.firstOrNull { it.second }?.first?.name
                } else {
                    null
                }
            return SlotRowUi(
                start = slot.start,
                endIso = endIso(slot, c.durationMin),
                dayLabel = FindATimeFormat.dayLabel(slot),
                timeLabel = slotTimeLabel(slot),
                members = membersWithFree,
                freeLabel = FindATimeFormat.freeLabel(freeCount, required.size),
                isBest = isBest,
                assigneeName = assignee,
            )
        }

        fun toggleExpand(start: String) {
            _state.update { s ->
                if (s is SuggestedSlotsUiState.Loaded) s.copy(expandedStart = if (s.expandedStart == start) null else start) else s
            }
        }

        fun bookSlot(start: String) {
            val c = criteria ?: return
            val row = lastSlots.firstOrNull { it.start == start } ?: return
            setBusy(true)
            viewModelScope.launch {
                val result =
                    homes.createHomeEvent(
                        homeId = c.homeId,
                        request =
                            CreateHomeEventRequest(
                                eventType = "family",
                                title = c.title,
                                startAt = row.start,
                                endAt = row.endIso,
                            ),
                    )
                when (result) {
                    is NetworkResult.Success ->
                        _state.value = SuggestedSlotsUiState.Booked("${row.dayLabel} · ${row.timeLabel}")
                    is NetworkResult.Failure -> {
                        setBusy(false)
                        _state.value = SuggestedSlotsUiState.Error(friendly(errors.decode(result.error)))
                    }
                }
            }
        }

        fun sendProposal() {
            val c = criteria ?: return
            if (lastSlots.isEmpty()) return
            setBusy(true)
            viewModelScope.launch {
                val options = lastSlots.take(MAX_POLL_OPTIONS).map { PollOptionInput(start = it.start, end = it.endIso) }
                val result =
                    repo.createPoll(
                        owner = SchedulingOwner.Home(c.homeId),
                        body =
                            CreatePollRequest(
                                title = c.title,
                                options = options,
                                durationMin = c.durationMin,
                            ),
                    )
                when (result) {
                    is NetworkResult.Success ->
                        _state.value = SuggestedSlotsUiState.Sent(result.data.poll.id, c.requiredMembers.size)
                    is NetworkResult.Failure -> {
                        setBusy(false)
                        _state.value = SuggestedSlotsUiState.Error(friendly(errors.decode(result.error)))
                    }
                }
            }
        }

        fun selectTimezone(tzId: String) {
            val c = criteria ?: return
            criteria = c.copy(timezone = tzId)
            load()
        }

        private fun setBusy(busy: Boolean) {
            _state.update { s -> if (s is SuggestedSlotsUiState.Loaded) s.copy(busy = busy) else s }
        }

        private fun headerOf(c: FindATimeCriteria) =
            SlotsHeader(
                peopleLabel = FindATimeFormat.peopleLabel(c.requiredMembers.size),
                durationLabel = FindATimeFormat.durationLabel(c.durationMin),
                windowLabel = c.windowLabel,
                tzId = c.timezone,
                tzLabel = tzShort(c.timezone),
            )

        private fun endIso(
            slot: SlotDto,
            durationMin: Int,
        ): String {
            slot.end?.let { return it }
            val start = FindATimeFormat.instant(slot) ?: return slot.start
            return start.plusSeconds(durationMin.toLong() * SECONDS_PER_MIN).toString()
        }

        private fun tzShort(tzId: String): String =
            runCatching { ZoneId.of(tzId).getDisplayName(TextStyle.SHORT, Locale.US) }.getOrDefault(tzId)

        private fun friendly(error: SchedulingError): String =
            when (error) {
                is SchedulingError.Generic -> error.message
                else -> "We couldn't load suggested times. Try again."
            }

        private companion object {
            const val MAX_POLL_OPTIONS = 8
            const val SECONDS_PER_MIN = 60L
        }
    }
