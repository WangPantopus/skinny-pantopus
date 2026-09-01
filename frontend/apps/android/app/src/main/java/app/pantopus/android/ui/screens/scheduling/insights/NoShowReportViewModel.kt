@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.insights

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

/**
 * H11 No-Show & Cancellation Report (A17). Read-only reliability report over a
 * date window: headline no-show rate, a stacked Honored / Late-cancel / No-show
 * breakdown, a recent-no-shows list (with repeat-offender flags), and a "set a
 * policy" callout. Loaded / celebratory-empty (zero no-shows) / loading / error.
 *
 * Wiring: `GET /insights/no-shows?days` + `GET /event-types` (for the recent
 * rows' event-type names).
 */
@HiltViewModel
class NoShowReportViewModel
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

        private val _state = MutableStateFlow<NoShowReportUiState>(NoShowReportUiState.Loading)
        val state: StateFlow<NoShowReportUiState> = _state.asStateFlow()

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
            _state.value = NoShowReportUiState.Loading
            viewModelScope.launch {
                val days = _filter.value.days()
                when (val reportResult = repo.getNoShowInsights(owner, days)) {
                    is NetworkResult.Success -> {
                        val eventTypes = repo.getEventTypes(owner).dataOrNull()?.eventTypes.orEmpty()
                        _state.value = project(reportResult.data, eventTypes)
                    }
                    is NetworkResult.Failure -> {
                        _state.value = NoShowReportUiState.Error(errors.decode(reportResult.error).display())
                    }
                }
            }
        }

        private fun project(
            report: NoShowReportResponse,
            eventTypes: List<EventTypeDto>,
        ): NoShowReportUiState {
            val windowDays = report.windowDays.takeIf { it > 0 } ?: _filter.value.days()
            if (report.noShow == 0) return NoShowReportUiState.Celebratory(windowDays)

            val names = eventTypes.associate { it.id to it.name }
            val total = report.completed + report.noShow + report.cancelled
            val plural = if (total == 1) "" else "s"
            val repeats = InsightsMath.repeatOffenders(report.recentNoShows)
            val zone = ZoneId.systemDefault()

            val recent =
                report.recentNoShows.map { row ->
                    val name = row.inviteeName?.takeIf { it.isNotBlank() } ?: "Guest"
                    val typeName = row.eventTypeId?.let { names[it] }
                    val day = InsightsFormat.dayLabel(row.startAt, zone)
                    val detail = listOfNotNull(typeName, day.takeIf { it.isNotBlank() }).joinToString(" · ")
                    RecentNoShowRow(
                        id = row.id ?: "$name-${row.startAt}",
                        name = name,
                        detail = detail.ifBlank { "No-show" },
                        isRepeat = repeats.contains(name),
                    )
                }

            return NoShowReportUiState.Loaded(
                NoShowData(
                    noShowRateLabel = InsightsFormat.percent(report.noShowRate),
                    subLabel = "of $total booking$plural in $windowDays days",
                    windowDays = windowDays,
                    segments = InsightsMath.breakdown(report.completed, report.cancelled, report.noShow),
                    recentRows = recent,
                ),
            )
        }

        /** The cancellation-policy editor (A14) — no relay (its own owner resolution). */
        fun policyRoute(): String = SchedulingRoutes.CANCELLATION_REFUND_POLICY

        private fun SchedulingError.display(): String =
            when (this) {
                is SchedulingError.Secret -> "You don't have access to this report."
                is SchedulingError.Generic -> message
                else -> "Couldn't load the report."
            }

        private fun <T> NetworkResult<T>.dataOrNull(): T? = (this as? NetworkResult.Success)?.data
    }

/** A recent no-show row projected with the event-type name + a repeat flag. */
data class RecentNoShowRow(
    val id: String,
    val name: String,
    val detail: String,
    val isRepeat: Boolean,
)

/** Everything the H11 report renders once loaded. */
data class NoShowData(
    val noShowRateLabel: String,
    val subLabel: String,
    val windowDays: Int,
    val segments: List<BreakdownSegment>,
    val recentRows: List<RecentNoShowRow>,
)

sealed interface NoShowReportUiState {
    data object Loading : NoShowReportUiState

    data class Celebratory(val windowDays: Int) : NoShowReportUiState

    data class Loaded(val data: NoShowData) : NoShowReportUiState

    data class Error(val message: String) : NoShowReportUiState
}
