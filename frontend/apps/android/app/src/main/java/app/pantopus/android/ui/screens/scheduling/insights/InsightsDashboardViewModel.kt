@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.insights

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookingSummaryResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.NoShowReportResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * H9 Insights Dashboard (A17). The read-only analytics home: 2×2 headline tiles
 * + a bookings-over-time chart + a ranked top-event-types list + footer links
 * into the no-show report and team performance. Personal sky by default;
 * Business violet when the hub hands a business owner via [InsightsNavRelay].
 *
 * Honest backend mapping (the page-traffic / UTM / conversion cards in the
 * design have no backend source and are intentionally omitted, not fabricated):
 *  • Headline + trend + top types ← `GET /bookings/summary`.
 *  • Completion % + no-show % ← `GET /insights/no-shows?days` (period-scoped).
 *  • Event-type names ← `GET /event-types`.
 */
@HiltViewModel
class InsightsDashboardViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        private val relay: InsightsNavRelay,
    ) : ViewModel() {
        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var started = false

        private val _filter = MutableStateFlow(InsightsFilter.Default)
        val filter: StateFlow<InsightsFilter> = _filter.asStateFlow()

        private val _state = MutableStateFlow<InsightsDashboardUiState>(InsightsDashboardUiState.Loading)
        val state: StateFlow<InsightsDashboardUiState> = _state.asStateFlow()

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

        private fun load() {
            _state.value = InsightsDashboardUiState.Loading
            viewModelScope.launch {
                val days = _filter.value.days()
                when (val summaryResult = repo.getBookingsSummary(owner)) {
                    is NetworkResult.Success -> {
                        val (eventTypes, report) =
                            coroutineScope {
                                val typesDef = async { repo.getEventTypes(owner).dataOrNull()?.eventTypes.orEmpty() }
                                val reportDef = async { repo.getNoShowInsights(owner, days).dataOrNull() }
                                typesDef.await() to reportDef.await()
                            }
                        _state.value = project(summaryResult.data, eventTypes, report)
                    }
                    is NetworkResult.Failure -> {
                        _state.value = InsightsDashboardUiState.Error(errors.decode(summaryResult.error).display())
                    }
                }
            }
        }

        private fun project(
            summary: BookingSummaryResponse,
            eventTypes: List<EventTypeDto>,
            report: NoShowReportResponse?,
        ): InsightsDashboardUiState {
            val noSummary = summary.bookingsThisMonth == 0 && summary.upcomingCount == 0 && summary.byEventType.isEmpty()
            val noReport = report == null || (report.completed + report.noShow + report.cancelled) == 0
            if (noSummary && noReport) return InsightsDashboardUiState.Empty

            val names = eventTypes.associate { it.id to it.name }
            val completionRate = completionRate(report)
            val selectedTypes = _filter.value.eventTypeIds
            val byEventType =
                if (selectedTypes.isEmpty()) {
                    summary.byEventType
                } else {
                    summary.byEventType.filter { selectedTypes.contains(it.eventTypeId) }
                }

            val tiles =
                listOf(
                    MetricTile(id = "bookings", label = "This month", value = "${summary.bookingsThisMonth}", delta = summary.deltaPct),
                    MetricTile(id = "upcoming", label = "Upcoming", value = "${summary.upcomingCount}"),
                    MetricTile(id = "completion", label = "Completion", value = InsightsFormat.percent(completionRate)),
                    MetricTile(id = "noshow", label = "No-show", value = InsightsFormat.percent(report?.noShowRate)),
                )

            val sparkTotal = summary.sparkline.sumOf { it.count }
            val subtitle =
                report?.noShowRate?.let { "${InsightsFormat.percent(it)} no-show rate" } ?: "Track reliability"

            return InsightsDashboardUiState.Loaded(
                DashboardData(
                    tiles = tiles,
                    dayBars = InsightsMath.dailyBars(summary.sparkline, maxBars = 14),
                    hasTrend = sparkTotal >= 3,
                    topTypes = InsightsMath.topEventTypes(byEventType, names, limit = 5),
                    isBusiness = owner is SchedulingOwner.Business,
                    noShowLinkSubtitle = subtitle,
                    eventTypeOptions = eventTypes.map { InsightsFilterOption(it.id, it.name) },
                ),
            )
        }

        private fun completionRate(report: NoShowReportResponse?): Double? {
            if (report == null) return null
            val concluded = report.completed + report.noShow
            if (concluded <= 0) return null
            return report.completed.toDouble() / concluded.toDouble() * 100
        }

        // ─── Navigation (sets the relay so arg-less routes carry owner/type) ──

        fun openTypeRoute(eventTypeId: String): String {
            relay.pendingOwner = owner
            relay.pendingEventTypeId = eventTypeId
            return SchedulingRoutes.EVENT_TYPE_PERFORMANCE
        }

        fun openNoShowRoute(): String {
            relay.pendingOwner = owner
            return SchedulingRoutes.NO_SHOW_REPORT
        }

        fun openTeamRoute(): String {
            relay.pendingOwner = owner
            return SchedulingRoutes.TEAM_PERFORMANCE
        }

        fun bookingPageRoute(): String = SchedulingRoutes.bookingPageManage(owner.routeKind, owner.ownerRouteId)

        private fun SchedulingError.display(): String =
            when (this) {
                is SchedulingError.Secret -> "You don't have access to these insights."
                is SchedulingError.Generic -> message
                else -> "Couldn't load insights."
            }

        private fun <T> NetworkResult<T>.dataOrNull(): T? = (this as? NetworkResult.Success)?.data
    }

/** Everything the H9 dashboard renders once loaded. */
data class DashboardData(
    val tiles: List<MetricTile>,
    val dayBars: List<DayBar>,
    val hasTrend: Boolean,
    val topTypes: List<RankedRow>,
    val isBusiness: Boolean,
    val noShowLinkSubtitle: String,
    val eventTypeOptions: List<InsightsFilterOption>,
)

sealed interface InsightsDashboardUiState {
    data object Loading : InsightsDashboardUiState

    data object Empty : InsightsDashboardUiState

    data class Loaded(val data: DashboardData) : InsightsDashboardUiState

    data class Error(val message: String) : InsightsDashboardUiState
}
