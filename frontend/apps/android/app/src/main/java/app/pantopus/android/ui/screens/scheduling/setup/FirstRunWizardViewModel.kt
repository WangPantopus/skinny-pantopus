@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.setup

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreateEventTypeRequest
import app.pantopus.android.data.api.models.scheduling.RuleInput
import app.pantopus.android.data.api.models.scheduling.RulesRequest
import app.pantopus.android.data.api.models.scheduling.UpdateBookingPageRequest
import app.pantopus.android.data.api.models.scheduling.UpdateScheduleRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardSecondaryCta
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

private const val SLUG_DEBOUNCE_MS = 450L
private const val MAX_SLUG_ATTEMPTS = 4
private const val TOTAL_STEPS = 4
private const val STEP_LINK = 1
private const val STEP_TYPE = 2
private const val STEP_HOURS = 3
private const val STEP_SUCCESS = 4
private const val DEFAULT_DURATION = 30

@Immutable
data class FirstRunWizardUiState(
    val step: Int = STEP_LINK,
    val slug: String = "",
    val slugState: SlugFieldUiState = SlugFieldUiState.Idle,
    val locationMode: String = "video",
    val duration: Int = DEFAULT_DURATION,
    val hours: Map<Int, Boolean> = DEFAULT_HOURS,
    val timezoneId: String = ZoneId.systemDefault().id,
    val isSubmitting: Boolean = false,
    /** True when the user re-enters step 3 having already completed steps 1–2. */
    val isResume: Boolean = false,
) {
    val shareLink: String get() = if (slug.isBlank()) "pantopus.com/book/…" else "pantopus.com/book/$slug"
}

// Weekday keys follow ISO backend contract: 0 = Sunday, 1 = Monday … 6 = Saturday.
private val DEFAULT_HOURS = mapOf(0 to false, 1 to true, 2 to true, 3 to true, 4 to true, 5 to true, 6 to false)

/**
 * A2 First-Run Wizard ("Set up booking link"), Personal pillar. Plugs into
 * [WizardShell] as a [WizardModel]; the screen collects [state] (driving
 * recomposition) while the shell reads [chrome].
 */
@HiltViewModel
class FirstRunWizardViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel(),
        WizardModel {
        private val owner: SchedulingOwner = SchedulingOwner.Personal

        private val _state = MutableStateFlow(FirstRunWizardUiState())
        val state: StateFlow<FirstRunWizardUiState> = _state.asStateFlow()

        private val _pendingShareUrl = MutableStateFlow<String?>(null)
        val pendingShareUrl: StateFlow<String?> = _pendingShareUrl.asStateFlow()

        private val _finished = MutableStateFlow(false)
        val finished: StateFlow<Boolean> = _finished.asStateFlow()

        private var slugJob: Job? = null

        override val chrome: WizardChrome
            get() {
                val s = _state.value
                return when (s.step) {
                    STEP_LINK ->
                        baseChrome(
                            s,
                            primary = "Continue · pick a type",
                            enabled = s.slugState is SlugFieldUiState.Available,
                            primaryTag = "firstRunWizardPrimary",
                        )
                    STEP_TYPE -> baseChrome(s, primary = "Continue", primaryTag = "firstRunWizardPrimary")
                    STEP_HOURS ->
                        baseChrome(
                            s,
                            primary = "Continue",
                            primaryTag = "firstRunWizardPrimary",
                            secondary = WizardSecondaryCta("Use defaults", "firstRunWizardDefaults"),
                        )
                    else ->
                        baseChrome(
                            s,
                            primary = "Share link",
                            primaryTag = "firstRunWizardShare",
                            secondary = WizardSecondaryCta("Add type", "firstRunWizardAddType"),
                        )
                }
            }

        private fun baseChrome(
            s: FirstRunWizardUiState,
            primary: String,
            primaryTag: String,
            enabled: Boolean = true,
            secondary: WizardSecondaryCta? = null,
        ): WizardChrome =
            WizardChrome(
                title = "Set up booking",
                progressLabel = WizardProgressLabel.StepOf(s.step, TOTAL_STEPS),
                progressFraction = s.step.toFloat() / TOTAL_STEPS,
                leading = WizardLeadingControl.Back,
                primaryCtaLabel = primary,
                primaryCtaEnabled = enabled && !s.isSubmitting,
                secondaryCta = secondary,
                isSubmitting = s.isSubmitting,
                dirty = false,
                showsProgressBar = false,
                primaryCtaTestTag = primaryTag,
            )

        override fun onLeading() {
            val s = _state.value
            if (s.step == STEP_LINK) {
                _finished.value = true
            } else {
                // Navigating back from success to hours marks it as a resume re-entry.
                val resume = s.step == STEP_SUCCESS
                _state.value = s.copy(step = s.step - 1, isResume = resume)
            }
        }

        override fun onPrimary() {
            if (_state.value.isSubmitting) return
            when (_state.value.step) {
                STEP_LINK -> claimSlug()
                STEP_TYPE -> createStarterType()
                STEP_HOURS -> seedTimezoneAndAdvance()
                else -> shareFromSuccess()
            }
        }

        override fun onSecondary() {
            when (_state.value.step) {
                STEP_HOURS -> seedTimezoneAndAdvance()
                STEP_SUCCESS -> _finished.value = true
                else -> Unit
            }
        }

        override fun onDiscard() {
            _finished.value = true
        }

        // ─── Slug live check ──────────────────────────────────────────────

        fun onSlugChange(value: String) {
            _state.value = _state.value.copy(slug = value)
            slugJob?.cancel()
            if (value.isBlank()) {
                _state.value = _state.value.copy(slugState = SlugFieldUiState.Idle)
                return
            }
            _state.value = _state.value.copy(slugState = SlugFieldUiState.Checking)
            slugJob =
                viewModelScope.launch {
                    delay(SLUG_DEBOUNCE_MS)
                    runSlugCheck(value)
                }
        }

        fun onPickSuggestion(suggestion: String) {
            onSlugChange(suggestion)
        }

        private suspend fun runSlugCheck(candidate: String) {
            if (candidate != _state.value.slug) return
            when (val r = repo.checkSlug(owner, candidate)) {
                is NetworkResult.Success ->
                    _state.value =
                        _state.value.copy(
                            slugState =
                                if (r.data.available) {
                                    SlugFieldUiState.Available
                                } else {
                                    SlugFieldUiState.Taken(r.data.suggestions)
                                },
                        )
                is NetworkResult.Failure -> _state.value = _state.value.copy(slugState = SlugFieldUiState.Idle)
            }
        }

        // ─── Step transitions ─────────────────────────────────────────────

        fun onSelectLocation(mode: String) {
            _state.value = _state.value.copy(locationMode = mode)
        }

        fun onSelectDuration(minutes: Int) {
            _state.value = _state.value.copy(duration = minutes)
        }

        fun onToggleDay(weekday: Int) {
            val current = _state.value.hours
            _state.value = _state.value.copy(hours = current + (weekday to !(current[weekday] ?: false)))
        }

        private fun claimSlug() {
            val slug = _state.value.slug.trim()
            _state.value = _state.value.copy(isSubmitting = true)
            viewModelScope.launch {
                when (val r = repo.updateSlug(owner, slug)) {
                    is NetworkResult.Success -> _state.value = _state.value.copy(step = STEP_TYPE, isSubmitting = false)
                    is NetworkResult.Failure -> {
                        val taken =
                            when (val decoded = errors.decode(r.error)) {
                                is SchedulingError.SlugTaken -> decoded.suggestions
                                else -> emptyList()
                            }
                        _state.value = _state.value.copy(slugState = SlugFieldUiState.Taken(taken), isSubmitting = false)
                    }
                }
            }
        }

        private fun createStarterType() {
            val s = _state.value
            _state.value = s.copy(isSubmitting = true)
            viewModelScope.launch {
                val base =
                    CreateEventTypeRequest(
                        name = "${s.duration}-minute meeting",
                        slug = "${s.duration}min-meeting",
                        durations = listOf(s.duration),
                        defaultDuration = s.duration,
                        locationMode = s.locationMode,
                        assignmentMode = "one_on_one",
                    )
                // Mirror iOS: retry with a suffixed slug on collision, then advance regardless.
                repeat(MAX_SLUG_ATTEMPTS) { attempt ->
                    val body = if (attempt == 0) base else base.copy(slug = "${base.slug}-${attempt + 1}")
                    when (val r = repo.createEventType(owner, body)) {
                        is NetworkResult.Success -> return@launch advance()
                        is NetworkResult.Failure ->
                            if (errors.decode(r.error) !is SchedulingError.SlugTaken) return@launch advance()
                    }
                }
                advance()
            }
        }

        private fun advance() {
            _state.value = _state.value.copy(step = STEP_HOURS, isSubmitting = false)
        }

        private fun seedTimezoneAndAdvance() {
            val s = _state.value
            _state.value = s.copy(isSubmitting = true)
            viewModelScope.launch {
                // Also publishes: pages insert with is_live=false, and the success step this
                // advances to invites the user to share a link that 404s while unpublished.
                repo.updateBookingPage(
                    owner,
                    UpdateBookingPageRequest(timezone = s.timezoneId, isLive = true, isPaused = false),
                )
                // Persist the hours grid to the default schedule. Without this the step is
                // decorative: the server seeds Mon–Fri 09-17 in America/New_York, so any day
                // the user toggled — and their real timezone — never reached availability.
                val availability = repo.getAvailability()
                if (availability is NetworkResult.Success) {
                    val schedule =
                        availability.data.schedules.firstOrNull { it.isDefault }
                            ?: availability.data.schedules.firstOrNull()
                    if (schedule != null) {
                        repo.updateSchedule(schedule.id, UpdateScheduleRequest(timezone = s.timezoneId))
                        val rules =
                            s.hours.filterValues { it }.keys.sorted().map { weekday ->
                                RuleInput(weekday = weekday, startTime = "09:00", endTime = "17:00")
                            }
                        repo.setRules(schedule.id, RulesRequest(rules = rules))
                    }
                }
                _state.value = _state.value.copy(step = STEP_SUCCESS, isSubmitting = false)
            }
        }

        private fun shareFromSuccess() {
            val slug = _state.value.slug
            if (slug.isNotBlank()) _pendingShareUrl.value = "https://pantopus.com/book/$slug"
        }

        fun shareConsumed() {
            _pendingShareUrl.value = null
        }
    }
