@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.ResourceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** A resource rule summary chip. */
data class ResourceRuleChip(
    val icon: PantopusIcon,
    val text: String,
)

/** One confirmed booking row. */
data class ResourceBookingRow(
    val id: String,
    val timeRange: String,
    val who: String,
    val member: HomeMember?,
    val isPending: Boolean,
)

/** A day-grouped section of booking rows. */
data class ResourceDaySection(
    val id: String,
    val title: String,
    val rows: List<ResourceBookingRow>,
)

/** A pending booking awaiting approval. */
data class ResourceApproval(
    val id: String,
    val who: String,
    val whenText: String,
    val member: HomeMember?,
)

/** F11 detail lifecycle. */
sealed interface ResourceDetailUiState {
    data object Loading : ResourceDetailUiState

    data class Error(
        val message: String,
    ) : ResourceDetailUiState

    data class Loaded(
        val resourceName: String,
        val kind: ResourceKind,
        val ruleChips: List<ResourceRuleChip>,
        val approvals: List<ResourceApproval>,
        val sections: List<ResourceDaySection>,
        /** Count of pending approval requests — drives the header badge (F11 approval frame). */
        val pendingApprovalCount: Int = 0,
        /**
         * View-only fully-booked variant (F11 frame 3): when non-null, the detail
         * shows an amber "Fully booked through …" banner and the sticky CTA flips
         * to "Book next opening · <nextOpeningLabel>". The detail bookings list does
         * not expose forward availability, so both labels are populated only when a
         * backend supplies them (deferred — see VM note).
         */
        val fullyBookedThroughLabel: String? = null,
        val nextOpeningLabel: String? = null,
    ) : ResourceDetailUiState {
        val isFullyBooked: Boolean get() = nextOpeningLabel != null

        /** "Upcoming bookings" normally; "Confirmed" when an approval queue is shown. */
        val bookingsLabel: String get() = if (approvals.isEmpty()) "Upcoming bookings" else "Confirmed"
    }
}

/**
 * Stream A12 — F11 Resource Detail / Booking Calendar. Header rules + the
 * resource's upcoming bookings (day-grouped) read from the host bookings list
 * (the calendar union omits `resource_id`), plus an Approve / Decline queue for
 * approval-gated resources.
 */
@HiltViewModel
class ResourceDetailViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repo: SchedulingRepository,
        private val homes: HomesRepository,
        private val members: HomeMembersRepository,
    ) : ViewModel() {
        val resourceId: String =
            savedStateHandle
                .get<String>(
                    SchedulingRoutes.ARG_RESOURCE_ID,
                ).orEmpty()

        private val _state = MutableStateFlow<ResourceDetailUiState>(ResourceDetailUiState.Loading)
        val state: StateFlow<ResourceDetailUiState> = _state.asStateFlow()

        private val _actionError = MutableStateFlow<String?>(null)
        val actionError: StateFlow<String?> = _actionError.asStateFlow()

        private val _isMutating = MutableStateFlow(false)
        val isMutating: StateFlow<Boolean> = _isMutating.asStateFlow()

        // Route homeId pins the navigated home; absent → inference on first fetch.
        private var homeId: String? =
            savedStateHandle.get<String>(SchedulingRoutes.ARG_HOME_ID)?.takeIf { it.isNotBlank() }
        private var requiresApproval = false
        private var started = false

        /** Sibling-route builders — keep the resolved home across A12 hops. */
        fun editorRoute(): String = SchedulingRoutes.resourceEditor(resourceId, homeId)

        fun bookRoute(): String = SchedulingRoutes.bookResource(resourceId, homeId)

        fun start() {
            if (started) {
                refresh()
            } else {
                started = true
                load()
            }
        }

        fun load() = fetch(showLoading = true)

        fun refresh() = fetch(showLoading = false)

        private fun fetch(showLoading: Boolean) {
            if (showLoading) _state.value = ResourceDetailUiState.Loading
            viewModelScope.launch {
                val hid = homeId ?: resolvePrimaryHomeId(homes)
                if (hid == null) {
                    _state.value =
                        ResourceDetailUiState.Error("Join or create a home to view resources.")
                    return@launch
                }
                homeId = hid
                val owner = SchedulingOwner.Home(hid)
                val resourcesTask = async { repo.getResources(owner) }
                val bookingsTask = async { repo.getBookings(owner) }
                val rosterTask = async { members.listOccupants(hid) }
                val resourcesResult = resourcesTask.await()
                val bookings = (bookingsTask.await() as? NetworkResult.Success)?.data?.bookings.orEmpty()
                val roster =
                    (rosterTask.await() as? NetworkResult.Success)
                        ?.data
                        ?.occupants
                        ?.let { HomeMember.from(it) }
                        .orEmpty()
                        .associateBy { it.id }

                when (resourcesResult) {
                    is NetworkResult.Success -> {
                        val resource =
                            resourcesResult.data.resources.firstOrNull {
                                it.id ==
                                    resourceId
                            }
                        if (resource == null) {
                            _state.value =
                                ResourceDetailUiState.Error("This resource is no longer available.")
                        } else {
                            _state.value = build(resource, bookings, roster)
                        }
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            ResourceDetailUiState.Error(
                                resourcesResult.error.message ?: "Couldn't load this resource.",
                            )
                }
            }
        }

        private fun build(
            resource: ResourceDto,
            bookings: List<BookingDto>,
            roster: Map<String, HomeMember>,
        ): ResourceDetailUiState.Loaded {
            requiresApproval = resource.requiresApproval ?: false
            val now = Instant.now()
            val mine =
                bookings
                    .filter { it.resourceId == resourceId && it.isLive() }
                    .filter {
                        (
                            ResourceTime.parseUtc(it.endAt) ?: ResourceTime.parseUtc(it.startAt)
                                ?: now
                        ) >=
                            now
                    }.sortedBy { it.startAt.orEmpty() }

            val memberOf: (BookingDto) -> HomeMember? = { booking -> roster[booking.hostUserId] }
            val whoOf: (BookingDto) -> String = { booking ->
                booking.inviteeName
                    ?: memberOf(booking)?.name
                    ?: "Member"
            }

            val approvals =
                if (requiresApproval) {
                    mine.filter { it.isPending() }.map {
                        ResourceApproval(
                            id = it.id,
                            who = whoOf(it),
                            whenText = ResourceTime.longRangeLabel(it.startAt, it.endAt),
                            member = memberOf(it),
                        )
                    }
                } else {
                    emptyList()
                }

            val confirmed = if (requiresApproval) mine.filter { !it.isPending() } else mine
            return ResourceDetailUiState.Loaded(
                resourceName = resource.name,
                kind = ResourceKind.fromWire(resource.resourceType),
                ruleChips = buildRuleChips(resource),
                approvals = approvals,
                sections = groupByDay(confirmed, whoOf, memberOf),
                pendingApprovalCount = approvals.size,
                // Forward availability (fully-booked / next-opening) is not exposed
                // by the bookings list; left null until a backend provides it.
                fullyBookedThroughLabel = null,
                nextOpeningLabel = null,
            )
        }

        private fun buildRuleChips(resource: ResourceDto): List<ResourceRuleChip> {
            val chips = mutableListOf<ResourceRuleChip>()
            val minutes = resource.maxDurationMin ?: 0
            if (minutes > 0) {
                val hours = minutes / MINUTES_PER_HOUR
                chips +=
                    ResourceRuleChip(
                        PantopusIcon.Timer,
                        if (hours >=
                            1
                        ) {
                            "$hours hr max"
                        } else {
                            "$minutes min max"
                        },
                    )
            }
            val approval = resource.requiresApproval ?: false
            chips +=
                ResourceRuleChip(
                    if (approval) PantopusIcon.Clock else PantopusIcon.Check,
                    if (approval) "Needs approval" else "No approval",
                )
            chips +=
                ResourceRuleChip(
                    PantopusIcon.Users,
                    WhoCanBook.fromWire(resource.whoCanBook).bookLabel,
                )
            return chips
        }

        private fun groupByDay(
            bookings: List<BookingDto>,
            whoOf: (BookingDto) -> String,
            memberOf: (BookingDto) -> HomeMember?,
        ): List<ResourceDaySection> {
            val order = mutableListOf<java.time.LocalDate>()
            val grouped = linkedMapOf<java.time.LocalDate, MutableList<ResourceBookingRow>>()
            val labelIso = mutableMapOf<java.time.LocalDate, String>()
            for (booking in bookings) {
                val day = ResourceTime.dayKey(booking.startAt) ?: continue
                if (grouped[day] == null) {
                    order += day
                    labelIso[day] = booking.startAt.orEmpty()
                }
                grouped.getOrPut(day) { mutableListOf() } +=
                    ResourceBookingRow(
                        id = booking.id,
                        timeRange = ResourceTime.rangeLabel(booking.startAt, booking.endAt),
                        who = whoOf(booking),
                        member = memberOf(booking),
                        isPending = booking.isPending(),
                    )
            }
            return order.map { day ->
                ResourceDaySection(
                    id = day.toString(),
                    title = ResourceTime.daySectionLabel(labelIso[day]),
                    rows = grouped[day].orEmpty(),
                )
            }
        }

        // ── Navigation hooks (handled by the screen via the route id) ─────────

        /**
         * Named hook for the pending-approval badge tap. Currently a scroll-anchor
         * intent (scroll to the approval queue card); body is intentionally empty
         * until the scroll coordinator is wired — mirrors iOS ResourceDetailViewModel.openApprovalQueue().
         */
        fun openApprovalQueue() {
            // TODO: coordinate scroll to ApprovalQueueCard
        }

        fun clearActionError() {
            _actionError.value = null
        }

        fun approve(bookingId: String) = mutate { owner -> repo.approveBooking(owner, bookingId) }

        fun decline(bookingId: String) = mutate { owner -> repo.declineBooking(owner, bookingId) }

        private fun mutate(action: suspend (SchedulingOwner.Home) -> NetworkResult<*>) {
            val hid = homeId ?: return
            if (_isMutating.value) return
            _isMutating.value = true
            viewModelScope.launch {
                try {
                    when (val result = action(SchedulingOwner.Home(hid))) {
                        is NetworkResult.Success -> fetch(showLoading = false)
                        is NetworkResult.Failure ->
                            _actionError.value =
                                result.error.message ?: "Something went wrong. Please try again."
                    }
                } finally {
                    _isMutating.value = false
                }
            }
        }

        private companion object {
            const val MINUTES_PER_HOUR = 60
        }
    }
