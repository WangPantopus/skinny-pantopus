@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber", "LongMethod", "ReturnCount")

package app.pantopus.android.ui.screens.scheduling.findatime

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import kotlin.math.abs

/** F4 date-window presets. */
enum class WindowPreset(val days: Long) {
    ThisWeek(6),
    TwoWeeks(13),
    ThisMonth(29),
    ;

    fun range(today: LocalDate): Pair<LocalDate, LocalDate> = today to today.plusDays(days)
}

/** F4 duration choices; Custom reveals the stepper. */
enum class DurationChoice { Half, Hour, Custom }

/** The mutable F4 form. */
data class SetupForm(
    val homeId: String,
    val homeName: String,
    val title: String,
    val titlePlaceholder: String,
    val members: List<FindMember>,
    val mode: FindMode,
    val durationChoice: DurationChoice,
    val customDurationMin: Int,
    val windowPreset: WindowPreset,
    val explainerExpanded: Boolean,
    val today: LocalDate,
    /**
     * Set by F5 when the API returns zero slots (no time overlaps). Drives the
     * no-overlap warning banner + quick-fix buttons in the setup form (F4 design
     * FrameNoOverlap: amber banner + "Make … optional" / "Widen to two weeks").
     */
    val noOverlapMessage: String? = null,
) {
    val durationMin: Int
        get() =
            when (durationChoice) {
                DurationChoice.Half -> 30
                DurationChoice.Hour -> 60
                DurationChoice.Custom -> customDurationMin
            }

    val range: Pair<LocalDate, LocalDate> get() = windowPreset.range(today)
    val hasRequired: Boolean get() = members.any { it.required }
    val rangeValid: Boolean get() = !range.first.isAfter(range.second)
    val canNext: Boolean get() = hasRequired && rangeValid && members.isNotEmpty()
}

/** F4 Find a Time — Setup. */
sealed interface FindATimeSetupUiState {
    data object Loading : FindATimeSetupUiState

    data class Loaded(val form: SetupForm) : FindATimeSetupUiState

    data class Error(val message: String) : FindATimeSetupUiState
}

/**
 * F4 Find a Time — Setup (home-only). Resolves the household + roster (the A0
 * route is arg-less), lets the family compose a coordination request, then —
 * since `FIND_A_TIME` → `FIND_A_TIME_SLOTS` carries no nav args — stashes the
 * criteria in [FindATimeSession] for F5 and signals navigation.
 */
@HiltViewModel
class FindATimeSetupViewModel
    @Inject
    constructor(
        private val homes: HomesRepository,
        private val members: HomeMembersRepository,
        private val session: FindATimeSession,
    ) : ViewModel() {
        private val _state = MutableStateFlow<FindATimeSetupUiState>(FindATimeSetupUiState.Loading)
        val state: StateFlow<FindATimeSetupUiState> = _state.asStateFlow()

        private var started = false

        fun start() {
            if (started) {
                // Re-entered with a live form (e.g. reopened as F5's edit sheet):
                // surface any no-overlap verdict F5 recorded since the last render.
                consumeNoOverlap()
                return
            }
            started = true
            load()
        }

        fun load() {
            _state.value = FindATimeSetupUiState.Loading
            viewModelScope.launch {
                val home =
                    when (val r = homes.myHomes()) {
                        is NetworkResult.Success -> r.data.homes.firstOrNull()
                        is NetworkResult.Failure -> null
                    }
                if (home == null) {
                    _state.value =
                        FindATimeSetupUiState.Error("No household yet. Create one to coordinate a family time.")
                    return@launch
                }
                val roster =
                    when (val r = members.listOccupants(home.id)) {
                        is NetworkResult.Success -> r.data.occupants.toFindMembers()
                        is NetworkResult.Failure -> emptyList()
                    }
                if (roster.isEmpty()) {
                    _state.value =
                        FindATimeSetupUiState.Error("No household members to coordinate with yet.")
                    return@launch
                }
                // F7 "Find a time here" seeds a window through the session (the
                // route is arg-less): anchor the form on the tapped day and snap
                // the preset to the seeded span.
                val seed = session.takeSeed()
                val seedFrom = seed?.first?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
                val seedTo = seed?.second?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
                _state.value =
                    FindATimeSetupUiState.Loaded(
                        SetupForm(
                            homeId = home.id,
                            homeName = home.name ?: "Home",
                            title = "",
                            titlePlaceholder = "Plan a family call",
                            members = roster,
                            mode = FindMode.Collective,
                            durationChoice = DurationChoice.Half,
                            customDurationMin = 45,
                            windowPreset = closestPreset(seedFrom, seedTo) ?: WindowPreset.ThisWeek,
                            explainerExpanded = false,
                            today = seedFrom ?: LocalDate.now(),
                            noOverlapMessage = session.takeNoOverlapMessage(),
                        ),
                    )
            }
        }

        /** Surface an F5-recorded no-overlap verdict on an already-loaded form. */
        private fun consumeNoOverlap() {
            val message = session.takeNoOverlapMessage() ?: return
            mutate { it.copy(noOverlapMessage = message) }
        }

        /** The preset whose span best matches a seeded window; null without a seed. */
        private fun closestPreset(
            from: LocalDate?,
            to: LocalDate?,
        ): WindowPreset? {
            if (from == null || to == null) return null
            val span = ChronoUnit.DAYS.between(from, to)
            return WindowPreset.entries.minByOrNull { abs(it.days - span) }
        }

        private fun mutate(block: (SetupForm) -> SetupForm) {
            _state.update { s -> if (s is FindATimeSetupUiState.Loaded) FindATimeSetupUiState.Loaded(block(s.form)) else s }
        }

        fun setTitle(value: String) = mutate { it.copy(title = value) }

        fun toggleRequired(
            userId: String,
            required: Boolean,
        ) = mutate { form ->
            form.copy(
                members = form.members.map { if (it.userId == userId) it.copy(required = required) else it },
                // Any criteria change invalidates the recorded no-overlap verdict
                // (mirrors iOS, which clears the banner on every mutation).
                noOverlapMessage = null,
            )
        }

        /** No-overlap quick action: drop the last required member to optional. */
        fun makeSomeoneOptional() =
            mutate { form ->
                val target = form.members.lastOrNull { it.required }
                if (target == null) {
                    form
                } else {
                    form.copy(
                        members = form.members.map { if (it.userId == target.userId) it.copy(required = false) else it },
                        noOverlapMessage = null,
                    )
                }
            }

        fun setMode(mode: FindMode) = mutate { it.copy(mode = mode, noOverlapMessage = null) }

        fun setDuration(choice: DurationChoice) = mutate { it.copy(durationChoice = choice, noOverlapMessage = null) }

        fun adjustCustomDuration(deltaMin: Int) =
            mutate { it.copy(customDurationMin = (it.customDurationMin + deltaMin).coerceIn(15, 240), noOverlapMessage = null) }

        fun setWindow(preset: WindowPreset) = mutate { it.copy(windowPreset = preset, noOverlapMessage = null) }

        fun widenWindow() = mutate { it.copy(windowPreset = WindowPreset.TwoWeeks, noOverlapMessage = null) }

        fun toggleExplainer() = mutate { it.copy(explainerExpanded = !it.explainerExpanded) }

        /**
         * Validate + stash criteria for F5. Returns true when the caller should
         * navigate to `FIND_A_TIME_SLOTS`.
         */
        fun submit(): Boolean {
            val form = (state.value as? FindATimeSetupUiState.Loaded)?.form ?: return false
            if (!form.canNext) return false
            val (from, to) = form.range
            session.criteria =
                FindATimeCriteria(
                    homeId = form.homeId,
                    title = form.title.ifBlank { form.titlePlaceholder },
                    members = form.members,
                    mode = form.mode,
                    durationMin = form.durationMin,
                    fromIso = FindATimeFormat.isoDate(from),
                    // Exclusive end — see [FindATimeCriteria.toIso]: date-only bounds
                    // parse server-side as UTC midnight, so the preset's last day
                    // must be covered by sending the day after.
                    toIso = FindATimeFormat.isoDate(to.plusDays(1)),
                    windowLabel = FindATimeFormat.windowPhrase(from, to),
                    timezone = FindATimeFormat.deviceZoneId(),
                )
            return true
        }
    }

/** Active, non-guest household occupants mapped to pickable members (required by default). */
internal fun List<OccupantDto>.toFindMembers(): List<FindMember> =
    filter { it.isActive && !it.role.equals("guest", ignoreCase = true) }
        .map { occ ->
            FindMember(
                userId = occ.userId,
                name = occ.displayName ?: occ.username ?: "Member",
                avatarUrl = occ.avatarUrl,
                required = true,
            )
        }
