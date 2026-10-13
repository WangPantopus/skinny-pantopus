package app.pantopus.android.ui.screens.plans.today

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.data.plans.PlanViewerStanding
import app.pantopus.android.data.plans.PlansFeature
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.plans.hasPrivatePart
import app.pantopus.android.data.plans.planMessage
import app.pantopus.android.data.plans.planState
import app.pantopus.android.data.plans.standing
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import javax.inject.Inject

/** Plans on Today (boards A1, A2, A5). */
data class PlansTodayUi(
    val on: Boolean = false,
    val going: List<PlanDto> = emptyList(),
    val hosting: List<PlanDto> = emptyList(),
    val howWasIt: List<PlanDto> = emptyList(),
    val hostAgain: List<PlanDto> = emptyList(),
    val working: Set<String> = emptySet(),
    val answered: Map<String, String> = emptyMap(),
    val notice: String? = null,
    /**
     * Today's plans read fresh, with their private parts (place, chat) for Directions and Message guests. Kept in
     * memory only: `mine` never carries them.
     */
    val details: Map<String, PlanDto> = emptyMap(),
)

/**
 * Today's Plans cards: the plan you're going to today (A1), the plan you host today (A2), and the day after,
 * "How was it" for guests and "Host again" for hosts (A5). Reads `GET /api/plans/mine` through the store; shows
 * nothing while the `plans` flag is off.
 */
@HiltViewModel
class PlansTodayViewModel
    @Inject
    constructor(
        private val repository: PlansRepository,
        private val feature: PlansFeature,
        @ApplicationContext context: Context,
    ) : ViewModel() {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        private val _ui = MutableStateFlow(PlansTodayUi())
        val ui: StateFlow<PlansTodayUi> = _ui.asStateFlow()
        private var detailsJob: Job? = null

        init {
            viewModelScope.launch {
                feature.flags.collect { flags ->
                    _ui.update { it.copy(on = flags.plans) }
                    if (flags.plans) load()
                }
            }
        }

        fun load() {
            if (!feature.isOn) return
            repository.mineCopy()?.let(::show)
            viewModelScope.launch { repository.mine().data?.let(::show) }
        }

        private fun show(mine: app.pantopus.android.data.api.models.plans.MyPlansResponse) {
            val now = Instant.now()

            fun isToday(plan: PlanDto): Boolean {
                val zone = PlanFormat.zone(plan.timezone)
                val start = PlanFormat.instant(plan.startsAt)?.atZone(zone)?.toLocalDate() ?: return false
                return start == LocalDate.now(zone) && plan.planState != PlanState.ENDED && plan.planState != PlanState.CANCELLED
            }
            val dismissed = prefs.getStringSet(KEY_DISMISSED, emptySet()).orEmpty()
            _ui.update {
                it.copy(
                    // The two soonest of each: Today stays short; the rest are in Nearby's "Your plans".
                    going = mine.going.filter(::isToday).sortedBy { p -> PlanFormat.instant(p.startsAt) ?: now }.take(TODAY_CARDS),
                    hosting = mine.hosting.filter(::isToday).sortedBy { p -> PlanFormat.instant(p.startsAt) ?: now }.take(TODAY_CARDS),
                    howWasIt =
                        mine.recent.filter { p ->
                            p.standing != PlanViewerStanding.HOSTING && p.viewer?.feedbackGiven != true && p.id !in dismissed
                        },
                    hostAgain = mine.recent.filter { p -> p.standing == PlanViewerStanding.HOSTING && p.id !in dismissed },
                )
            }
            loadDetails((_ui.value.going + _ui.value.hosting).map { it.id })
        }

        private fun loadDetails(ids: List<String>) {
            if (ids.toSet() == _ui.value.details.keys) return
            detailsJob?.cancel()
            detailsJob =
                viewModelScope.launch {
                    val reads = ids.map { id -> async { id to (repository.plan(id) as? NetworkResult.Success)?.data } }
                    val found = reads.mapNotNull { it.await().let { (id, plan) -> plan?.takeIf { it.hasPrivatePart }?.let { id to it } } }
                    _ui.update { it.copy(details = found.toMap()) }
                }
        }

        /** "On my way" (A1): a line in the plan's chat, no push. */
        fun onMyWay(plan: PlanDto) = act(plan.id, done = "We told the group you're on the way.") { repository.onMyWay(plan.id) }

        /** "How was it" (A5): `great`, `ok` or `not_right` (which files a report in the admin queue). */
        fun feedback(
            plan: PlanDto,
            answer: String,
        ) {
            act(
                plan.id,
                done =
                    if (answer == "not_right") {
                        "Thanks for telling us. Someone from Pantopus will look at it."
                    } else {
                        "Thanks. Glad you went."
                    },
            ) {
                repository.feedback(plan.id, answer, null).also { result ->
                    if (result is NetworkResult.Success) _ui.update { it.copy(answered = it.answered + (plan.id to answer)) }
                }
            }
        }

        /** "Not now" on Host again, or after answering: hide the card for this plan. */
        fun dismiss(plan: PlanDto) {
            val dismissed = prefs.getStringSet(KEY_DISMISSED, emptySet()).orEmpty()
            prefs.edit().putStringSet(KEY_DISMISSED, (dismissed + plan.id).toList().takeLast(MAX_DISMISSED).toSet()).apply()
            _ui.update { ui ->
                ui.copy(
                    howWasIt = ui.howWasIt.filterNot { it.id == plan.id },
                    hostAgain = ui.hostAgain.filterNot { it.id == plan.id },
                )
            }
        }

        fun noticeShown() {
            _ui.update { it.copy(notice = null) }
        }

        private fun act(
            id: String,
            done: String,
            block: suspend () -> NetworkResult<Unit>,
        ) {
            if (id in _ui.value.working) return
            _ui.update { it.copy(working = it.working + id) }
            viewModelScope.launch {
                val result = block()
                _ui.update {
                    it.copy(
                        working = it.working - id,
                        notice =
                            when (result) {
                                is NetworkResult.Success -> done
                                is NetworkResult.Failure -> result.error.planMessage
                            },
                    )
                }
                repository.mine(force = true).data?.let(::show)
            }
        }

        private companion object {
            const val TODAY_CARDS = 2
            const val PREFS = "pantopus.plans.today"
            const val KEY_DISMISSED = "dismissed"
            const val MAX_DISMISSED = 100
        }
    }
