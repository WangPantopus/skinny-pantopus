package app.pantopus.android.ui.screens.plans.change

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.UpdatePlanBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.plans.planMessage
import app.pantopus.android.ui.screens.plans.PlansRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneId
import javax.inject.Inject
import kotlin.math.abs

/** H11's state. */
data class PlanChangeUi(
    val plan: PlanDto? = null,
    val zone: ZoneId = ZoneId.systemDefault(),
    val originalStart: LocalDateTime? = null,
    val originalEnd: LocalDateTime? = null,
    val start: LocalDateTime? = null,
    val end: LocalDateTime? = null,
    val saving: Boolean = false,
    val error: String? = null,
    val saved: Boolean = false,
) {
    /** People in, not counting the host. */
    val peopleIn: Int get() = plan?.people.orEmpty().count { !it.isHost }

    /** Moving the start more than 30 minutes asks everyone in "Still coming?" (brief section 5). */
    val asksStillComing: Boolean
        get() {
            val a = originalStart ?: return false
            val b = start ?: return false
            return abs(Duration.between(a, b).toMinutes()) > STILL_COMING_MINUTES && peopleIn > 0
        }

    val changed: Boolean get() = start != originalStart || end != originalEnd

    private companion object {
        const val STILL_COMING_MINUTES = 30
    }
}

/** Change the time (board H11). The server sends "Still coming?" when the start moves more than 30 minutes. */
@HiltViewModel
class PlanChangeViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repository: PlansRepository,
    ) : ViewModel() {
        private val planId: String = savedStateHandle.get<String>(PlansRoutes.PLAN_ID_KEY).orEmpty()
        private val _ui = MutableStateFlow(PlanChangeUi())
        val ui: StateFlow<PlanChangeUi> = _ui.asStateFlow()

        fun load() {
            if (_ui.value.plan != null) return
            viewModelScope.launch {
                when (val result = repository.plan(planId)) {
                    is NetworkResult.Success -> {
                        val plan = result.data
                        val zone = PlanFormat.zone(plan.timezone)
                        val start = PlanFormat.instant(plan.startsAt)?.atZone(zone)?.toLocalDateTime()
                        val end = PlanFormat.instant(plan.endsAt)?.atZone(zone)?.toLocalDateTime()
                        _ui.update {
                            PlanChangeUi(
                                plan = plan,
                                zone = zone,
                                originalStart = start,
                                originalEnd = end,
                                start = start,
                                end = end,
                            )
                        }
                    }
                    is NetworkResult.Failure -> _ui.update { it.copy(error = result.error.planMessage) }
                }
            }
        }

        /** A new start keeps the plan's length. */
        fun setStart(value: LocalDateTime) {
            _ui.update { ui ->
                val length = if (ui.start != null && ui.end != null) Duration.between(ui.start, ui.end) else Duration.ofHours(2)
                ui.copy(start = value, end = value.plus(length), error = null)
            }
        }

        fun setEnd(value: LocalDateTime) {
            _ui.update { it.copy(end = value, error = null) }
        }

        fun save() {
            val ui = _ui.value
            val start = ui.start ?: return
            val end = ui.end ?: return
            val problem = validate(start, end)
            if (problem != null) {
                _ui.update { it.copy(error = problem) }
                return
            }
            _ui.update { it.copy(saving = true, error = null) }
            viewModelScope.launch {
                val body =
                    UpdatePlanBody(
                        startsAt = start.atZone(ui.zone).toInstant().toString(),
                        endsAt = end.atZone(ui.zone).toInstant().toString(),
                    )
                when (val result = repository.update(planId, body)) {
                    is NetworkResult.Success -> _ui.update { it.copy(saving = false, saved = true) }
                    is NetworkResult.Failure -> _ui.update { it.copy(saving = false, error = result.error.planMessage) }
                }
            }
        }

        private fun validate(
            start: LocalDateTime,
            end: LocalDateTime,
        ): String? {
            val now = LocalDateTime.now(_ui.value.zone)
            val minutes = Duration.between(start, end).toMinutes()
            return when {
                start.isBefore(now) -> "Pick a start that hasn't passed yet."
                start.isAfter(now.plusDays(MAX_DAYS_AHEAD)) -> "Plans can start up to 14 days from now."
                minutes < MIN_MINUTES -> "A plan lasts at least 15 minutes."
                minutes > MAX_MINUTES -> "A plan lasts at most 8 hours."
                else -> null
            }
        }

        private companion object {
            const val MAX_DAYS_AHEAD = 14L
            const val MIN_MINUTES = 15L
            const val MAX_MINUTES = 8 * 60L
        }
    }
