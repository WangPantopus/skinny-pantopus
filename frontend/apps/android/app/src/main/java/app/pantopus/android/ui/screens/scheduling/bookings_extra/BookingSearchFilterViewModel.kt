@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneOffset
import javax.inject.Inject

enum class BookingStatusFilter(val label: String, val queryValue: String) {
    Upcoming("Upcoming", "upcoming"),
    Pending("Pending", "pending"),
    Past("Past", "past"),
    Cancelled("Cancelled", "cancelled"),
    NoShow("No-show", "past"),
}

enum class BookingScopeFilter(val label: String) {
    All("All"),
    Personal("Personal"),
    Home("Home"),
    Business("Business"),
}

enum class BookingDateRange(val label: String) {
    Anytime("Anytime"),
    Today("Today"),
    ThisWeek("This week"),
    ThisMonth("This month"),
    Custom("Custom"),
}

data class BookingFilters(
    val status: BookingStatusFilter? = null,
    val scope: BookingScopeFilter = BookingScopeFilter.All,
    val eventTypeId: String? = null,
    val dateRange: BookingDateRange = BookingDateRange.Anytime,
    val customFrom: String? = null,
    val customTo: String? = null,
) {
    val isActive: Boolean
        get() = status != null || scope != BookingScopeFilter.All || eventTypeId != null || dateRange != BookingDateRange.Anytime
}

data class EventTypeOption(val id: String, val name: String)

data class BookingRowUi(
    val id: String,
    val name: String,
    val meta: String,
    val status: String?,
)

sealed interface BookingSearchUiState {
    data object Loading : BookingSearchUiState

    data class Loaded(val rows: List<BookingRowUi>) : BookingSearchUiState

    data object Empty : BookingSearchUiState

    data class Error(val message: String) : BookingSearchUiState
}

/**
 * E9 Booking Search & Filter. A search surface distinct from A8's inbox: a
 * debounced invitee/text search over `GET /bookings?q=…` plus a filter sheet
 * (status / owner context / event type / date range) whose CTA shows a live
 * result count. "No-show" is a client-side filter over the `past` bucket.
 */
@HiltViewModel
class BookingSearchFilterViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val homes: HomesRepository,
        private val auth: AuthRepository,
    ) : ViewModel() {
        private val _results = MutableStateFlow<BookingSearchUiState>(BookingSearchUiState.Loading)
        val results: StateFlow<BookingSearchUiState> = _results.asStateFlow()

        private val _search = MutableStateFlow("")
        val search: StateFlow<String> = _search.asStateFlow()

        private val _applied = MutableStateFlow(BookingFilters())
        val applied: StateFlow<BookingFilters> = _applied.asStateFlow()

        private val _draft = MutableStateFlow(BookingFilters())
        val draft: StateFlow<BookingFilters> = _draft.asStateFlow()

        private val _sheetOpen = MutableStateFlow(false)
        val sheetOpen: StateFlow<Boolean> = _sheetOpen.asStateFlow()

        private val _draftCount = MutableStateFlow<Int?>(null)
        val draftCount: StateFlow<Int?> = _draftCount.asStateFlow()

        private val _eventTypes = MutableStateFlow<List<EventTypeOption>>(emptyList())
        val eventTypes: StateFlow<List<EventTypeOption>> = _eventTypes.asStateFlow()

        private var searchJob: Job? = null
        private var countJob: Job? = null
        private var started = false

        fun start() {
            if (started) return
            started = true
            viewModelScope.launch {
                _eventTypes.value =
                    repo.getEventTypes(SchedulingOwner.Personal).dataOrNull()?.eventTypes
                        ?.map { EventTypeOption(it.id, it.name) }
                        .orEmpty()
            }
            reload()
        }

        fun setSearch(text: String) {
            _search.value = text
            searchJob?.cancel()
            searchJob =
                viewModelScope.launch {
                    delay(DEBOUNCE_MS)
                    reload()
                }
        }

        private fun reload() {
            viewModelScope.launch {
                _results.value = BookingSearchUiState.Loading
                val rows = query(_applied.value, _search.value)
                _results.value =
                    if (rows == null) {
                        BookingSearchUiState.Error("Couldn't load bookings.")
                    } else if (rows.isEmpty()) {
                        BookingSearchUiState.Empty
                    } else {
                        BookingSearchUiState.Loaded(rows.map { it.toRowUi() })
                    }
            }
        }

        // ─── Filter sheet ────────────────────────────────────────────────────

        fun openFilter() {
            _draft.value = _applied.value
            _sheetOpen.value = true
            recount()
        }

        fun dismissFilter() {
            _sheetOpen.value = false
        }

        fun setStatus(status: BookingStatusFilter?) {
            _draft.update { it.copy(status = if (it.status == status) null else status) }
            recount()
        }

        fun setScope(scope: BookingScopeFilter) {
            _draft.update { it.copy(scope = scope) }
            recount()
        }

        fun setEventType(id: String?) {
            _draft.update { it.copy(eventTypeId = if (it.eventTypeId == id) null else id) }
            recount()
        }

        fun setDateRange(range: BookingDateRange) {
            _draft.update { it.copy(dateRange = if (it.dateRange == range) BookingDateRange.Anytime else range) }
            recount()
        }

        fun setCustomFrom(value: String) {
            _draft.update { it.copy(customFrom = value, dateRange = BookingDateRange.Custom) }
            recount()
        }

        fun setCustomTo(value: String) {
            _draft.update { it.copy(customTo = value, dateRange = BookingDateRange.Custom) }
            recount()
        }

        fun clearAll() {
            _draft.value = BookingFilters()
            recount()
        }

        fun removeStatus() = setStatus(null)

        fun removeScope() = setScope(BookingScopeFilter.All)

        fun removeEventType() = setEventType(null)

        fun removeDateRange() = setDateRange(BookingDateRange.Anytime)

        fun applyFilters() {
            _applied.value = _draft.value
            _sheetOpen.value = false
            reload()
        }

        private fun recount() {
            countJob?.cancel()
            countJob =
                viewModelScope.launch {
                    _draftCount.value = null
                    delay(DEBOUNCE_MS)
                    _draftCount.value = query(_draft.value, _search.value)?.size
                }
        }

        // ─── Query ───────────────────────────────────────────────────────────

        private suspend fun query(
            filters: BookingFilters,
            search: String,
        ): List<BookingDto>? {
            val owners = resolveOwners(filters.scope)
            if (owners.isEmpty()) return emptyList()
            val (from, to) = dateBounds(filters)
            val results =
                coroutineScope {
                    owners.map { owner ->
                        async {
                            repo.getBookings(
                                owner = owner,
                                status = filters.status?.queryValue,
                                eventTypeId = filters.eventTypeId,
                                from = from,
                                to = to,
                                query = search.ifBlank { null },
                            )
                        }
                    }.map { it.await() }
                }
            // Any-success = data: a multi-owner fan-out shouldn't blank the whole
            // search because one pillar's fetch failed. All-failed → error.
            val successes = results.mapNotNull { (it as? NetworkResult.Success)?.data?.bookings }
            if (successes.isEmpty()) return null
            val bookings = successes.flatten()
            return if (filters.status == BookingStatusFilter.NoShow) {
                bookings.filter { it.status == "no_show" }
            } else {
                bookings
            }
        }

        /**
         * The owner contexts a scope spans. `All` fans out across every pillar the
         * user actually has (Personal always; Home/Business only when resolvable) so
         * the default search covers home + business bookings, not just personal.
         */
        private suspend fun resolveOwners(scope: BookingScopeFilter): List<SchedulingOwner> =
            when (scope) {
                BookingScopeFilter.All ->
                    listOfNotNull(
                        SchedulingOwner.Personal,
                        BookingsExtrasOwner.resolve(SchedulingPillar.Home, homes, auth),
                        BookingsExtrasOwner.resolve(SchedulingPillar.Business, homes, auth),
                    )
                BookingScopeFilter.Personal -> listOf(SchedulingOwner.Personal)
                BookingScopeFilter.Home -> listOfNotNull(BookingsExtrasOwner.resolve(SchedulingPillar.Home, homes, auth))
                BookingScopeFilter.Business -> listOfNotNull(BookingsExtrasOwner.resolve(SchedulingPillar.Business, homes, auth))
            }

        private fun dateBounds(filters: BookingFilters): Pair<String?, String?> {
            val today = LocalDate.now(ZoneOffset.UTC)
            return when (filters.dateRange) {
                BookingDateRange.Anytime -> null to null
                BookingDateRange.Today -> isoStart(today) to isoStart(today.plusDays(1))
                BookingDateRange.ThisWeek -> isoStart(today) to isoStart(today.plusDays(WEEK_DAYS))
                BookingDateRange.ThisMonth -> isoStart(today) to isoStart(today.plusDays(MONTH_DAYS))
                BookingDateRange.Custom -> parseDate(filters.customFrom) to parseDate(filters.customTo)
            }
        }

        private fun isoStart(date: LocalDate): String = date.atStartOfDay(ZoneOffset.UTC).toInstant().toString()

        private fun parseDate(value: String?): String? = value?.let { runCatching { isoStart(LocalDate.parse(it)) }.getOrNull() }

        private fun BookingDto.toRowUi(): BookingRowUi =
            BookingRowUi(
                id = id,
                name = inviteeName ?: inviteeEmail ?: "Guest",
                meta = BookingsExtrasFormatting.dayAndTime(startAt),
                status = status,
            )

        private fun <T> NetworkResult<T>.dataOrNull(): T? = (this as? NetworkResult.Success)?.data

        private companion object {
            const val DEBOUNCE_MS = 250L
            const val WEEK_DAYS = 7L
            const val MONTH_DAYS = 30L
        }
    }
