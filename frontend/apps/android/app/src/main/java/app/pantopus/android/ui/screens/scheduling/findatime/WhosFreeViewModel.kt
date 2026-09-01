@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber", "LongMethod", "CyclomaticComplexMethod", "ReturnCount")

package app.pantopus.android.ui.screens.scheduling.findatime

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.FreeByMemberResponse
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/**
 * One heat cell's availability tier. The design's five tiers:
 * free (overlap dot) · busy · tentative (amber) · off-hours (muted+hatch) ·
 * unknown (member hasn't shared — hatched "?").
 */
enum class CellState { Free, Busy, Tentative, OffHours, Unknown }

/** Day-of-week (time-of-day buckets) vs Week (per-day) grid. */
enum class GridView { Day, Week }

data class GridColumn(val label: String)

data class MemberRow(val member: FindMember, val cells: List<CellState>)

data class HeatGrid(val columns: List<GridColumn>, val rows: List<MemberRow>)

data class FilterChip(val id: String, val label: String)

/** F7 Who's Free — Household availability. */
sealed interface WhosFreeUiState {
    data object Loading : WhosFreeUiState

    data class Loaded(
        val grid: HeatGrid,
        val filters: List<FilterChip>,
        val selectedFilter: String,
        val view: GridView,
        val hasFree: Boolean,
        val emptyAllBusy: Boolean,
        val optedOutNames: List<String>,
        val windowLabel: String,
    ) : WhosFreeUiState {
        val visibleRows: List<MemberRow>
            get() = if (selectedFilter == FILTER_ALL) grid.rows else grid.rows.filter { it.member.userId == selectedFilter }
    }

    data class Error(val message: String) : WhosFreeUiState
}

const val FILTER_ALL = "all"

/**
 * F7 Who's Free — Household Availability (home v2). Composes each member's
 * personal free/busy into a glanceable heat grid from `GET /whos-free`,
 * cross-referenced with the home roster so members who haven't shared
 * availability surface as opted-out. Tapping a free block seeds F4
 * ("Find a time here") via [FindATimeSession].
 */
@HiltViewModel
class WhosFreeViewModel
    @Inject
    constructor(
        private val homes: HomesRepository,
        private val members: HomeMembersRepository,
        private val repo: SchedulingRepository,
        private val session: FindATimeSession,
        private val networkMonitor: NetworkMonitor,
    ) : ViewModel() {
        private val _state = MutableStateFlow<WhosFreeUiState>(WhosFreeUiState.Loading)
        val state: StateFlow<WhosFreeUiState> = _state.asStateFlow()

        /**
         * F7 major fix: expose online/offline so the screen can mute Add (design
         * FrameOffline: right={{ text:'Add', muted:true }}) and show the wifi-off
         * banner above FilterChips.
         */
        val isOnline: StateFlow<Boolean> get() = networkMonitor.isOnline

        private val zone = FindATimeFormat.deviceZoneId()
        private var homeId: String? = null
        private var roster: List<FindMember> = emptyList()
        private var anchor: LocalDate = LocalDate.now()
        private var view: GridView = GridView.Day
        private var selectedFilter: String = FILTER_ALL
        private var started = false

        fun start() {
            if (started) return
            started = true
            load()
        }

        fun load() {
            _state.value = WhosFreeUiState.Loading
            viewModelScope.launch {
                val home =
                    when (val r = homes.myHomes()) {
                        is NetworkResult.Success -> r.data.homes.firstOrNull()
                        is NetworkResult.Failure -> null
                    }
                if (home == null) {
                    _state.value = WhosFreeUiState.Error("No household yet. Create one to see who's free.")
                    return@launch
                }
                homeId = home.id
                if (roster.isEmpty()) {
                    roster =
                        when (val r = members.listOccupants(home.id)) {
                            is NetworkResult.Success -> r.data.occupants.toFindMembers()
                            is NetworkResult.Failure -> emptyList()
                        }
                }
                fetchGrid(home.id)
            }
        }

        private suspend fun fetchGrid(id: String) {
            val (from, to) = windowRange()
            // Send full instants anchored on the viewer's LOCAL day boundaries: the
            // backend parses date-only bounds as UTC midnight, which shifts the
            // window by the zone offset and drops morning/evening blocks.
            val zoneId = zoneId()
            val result =
                repo.whosFree(
                    home = SchedulingOwner.Home(id),
                    from = from.atStartOfDay(zoneId).toInstant().toString(),
                    to = to.atStartOfDay(zoneId).toInstant().toString(),
                    tz = zone,
                )
            when (result) {
                is NetworkResult.Success -> _state.value = project(result.data)
                is NetworkResult.Failure -> _state.value = WhosFreeUiState.Error("We couldn't load household availability. Try again.")
            }
        }

        /** Window as local dates; the second element is the EXCLUSIVE end day. */
        private fun windowRange(): Pair<LocalDate, LocalDate> =
            when (view) {
                GridView.Day -> anchor to anchor.plusDays(1)
                GridView.Week -> anchor to anchor.plusDays(WEEK_SPAN)
            }

        private fun zoneId(): ZoneId = runCatching { ZoneId.of(zone) }.getOrDefault(ZoneId.systemDefault())

        private fun project(data: FreeByMemberResponse): WhosFreeUiState.Loaded {
            // `members` lists EVERY active occupant (whether or not they share
            // availability), so membership can't distinguish opted-out. An empty
            // free-list across the whole window is the "hasn't shared" signal.
            val columns = if (view == GridView.Day) dayColumns() else weekColumns()
            val rows =
                roster.map { member ->
                    val slots = data.freeByMember[member.userId].orEmpty()
                    val cells =
                        when {
                            slots.isEmpty() -> List(columns.size) { CellState.Unknown }
                            view == GridView.Day -> dayCells(slots)
                            else -> weekCells(slots)
                        }
                    MemberRow(member = member, cells = cells)
                }
            val hasFree = rows.any { row -> row.cells.any { it == CellState.Free } }
            val optedOut = roster.filter { data.freeByMember[it.userId].isNullOrEmpty() }.map { it.name }
            val anyShared = rows.any { row -> row.cells.any { it != CellState.Unknown } }
            return WhosFreeUiState.Loaded(
                grid = HeatGrid(columns = columns, rows = rows),
                filters = buildFilters(),
                selectedFilter = selectedFilter,
                view = view,
                hasFree = hasFree,
                emptyAllBusy = !hasFree && anyShared,
                optedOutNames = optedOut,
                windowLabel = windowLabel(),
            )
        }

        private fun dayCells(slots: List<SlotDto>): List<CellState> {
            val freeBuckets = mutableSetOf<Int>()
            slots.forEach { slot ->
                val startHour = FindATimeFormat.localDateTime(slot)?.hour ?: return@forEach
                val endHour = (startHour + durationHours(slot)).coerceAtMost(LAST_HOUR)
                for (hour in startHour until endHour.coerceAtLeast(startHour + 1)) {
                    val idx = FindATimeFormat.bucketIndexForHour(hour, BUCKET_STARTS, BUCKET_SPAN)
                    if (idx >= 0) freeBuckets += idx
                }
            }
            return BUCKET_STARTS.indices.map { if (it in freeBuckets) CellState.Free else CellState.Busy }
        }

        /** Slot length in whole hours from the UTC instants (tz-safe), min 1. */
        private fun durationHours(slot: SlotDto): Int {
            val start = FindATimeFormat.instant(slot) ?: return 1
            val end = slot.end?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return 1
            return Duration.between(start, end).toHours().toInt().coerceAtLeast(1)
        }

        private fun weekCells(slots: List<SlotDto>): List<CellState> {
            val freeDays = slots.mapNotNull { FindATimeFormat.localDateTime(it)?.toLocalDate() }.toSet()
            return (0 until WEEK_SPAN.toInt()).map { offset ->
                if (anchor.plusDays(offset.toLong()) in freeDays) CellState.Free else CellState.Busy
            }
        }

        private fun dayColumns(): List<GridColumn> = BUCKET_LABELS.map { GridColumn(it) }

        private fun weekColumns(): List<GridColumn> =
            (0 until WEEK_SPAN.toInt()).map {
                GridColumn(anchor.plusDays(it.toLong()).dayOfWeek.getDisplayName(java.time.format.TextStyle.NARROW, Locale.US))
            }

        private fun buildFilters(): List<FilterChip> =
            buildList {
                add(FilterChip(FILTER_ALL, "All"))
                roster.forEach { add(FilterChip(it.userId, it.name.substringBefore(" "))) }
            }

        private fun windowLabel(): String =
            when (view) {
                GridView.Day -> anchor.format(DAY_LABEL_FMT)
                GridView.Week -> "${anchor.format(SHORT_FMT)} – ${anchor.plusDays(WEEK_SPAN - 1).format(SHORT_FMT)}"
            }

        fun selectFilter(id: String) {
            selectedFilter = id
            _state.value = (state.value as? WhosFreeUiState.Loaded)?.copy(selectedFilter = id) ?: state.value
        }

        fun setView(target: GridView) {
            if (view == target) return
            view = target
            load()
        }

        fun tryNextWindow() {
            anchor = anchor.plusDays(if (view == GridView.Day) DAY_STEP else WEEK_SPAN)
            load()
        }

        /** Seed F4 with the tapped block's day so "Find a time here" opens scoped. */
        fun seedFindATime() {
            session.seedFromIso = FindATimeFormat.isoDate(anchor)
            session.seedToIso = FindATimeFormat.isoDate(anchor.plusDays(WindowPreset.ThisWeek.days))
        }

        /** Route to the household calendar's add-event form (A10 home calendar). */
        fun addEventRoute(): String? = homeId?.let { "homes/$it/events/new" }

        private companion object {
            val BUCKET_STARTS = listOf(8, 10, 12, 14, 16, 18)
            val BUCKET_LABELS = listOf("8a", "10a", "12p", "2p", "4p", "6p")
            const val BUCKET_SPAN = 2
            const val LAST_HOUR = 24
            const val WEEK_SPAN = 7L

            /** "Try next" advances the Day view one day (the Week view steps a week). */
            const val DAY_STEP = 1L
            val DAY_LABEL_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE MMM d", Locale.US)
            val SHORT_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)
        }
    }
