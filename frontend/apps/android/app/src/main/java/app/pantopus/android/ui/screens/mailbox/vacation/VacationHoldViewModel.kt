@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.vacation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.StartVacationRequest
import app.pantopus.android.data.api.models.mailbox.v2.VacationHoldDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject

/**
 * A14.8 — Vacation Hold view-model. Drives both the `scheduling`
 * (compose a hold) and `active` (in-flight hold) variants from a single
 * sealed mode.
 *
 * BLOCK 3E wires this to the live backend
 * (`GET /api/mailbox/v2/p3/vacation/status`, `POST …/vacation/start`,
 * `POST …/vacation/cancel`). iOS `VacationHoldViewModel` now mirrors the same
 * calls, mode machine and error handling.
 *
 * - `load()` fetches the current hold: an `active` hold renders the Active
 *   variant; otherwise the scheduling composer, seeded from
 *   [VacationScheduleDraft.liveDefault] — today → +7 days with empty
 *   forwarding / emergency rows, since those fields have no backend source
 *   and a fixture would read as the user's own saved data.
 * - Save (`tapTrailingAction` in scheduling) resolves the user's primary home,
 *   maps the draft to `startVacationSchema`, and POSTs `/vacation/start`.
 * - Edit (`tapTrailingAction` in active) returns to the scheduling form.
 * - End hold early (`endHoldEarly`) POSTs `/vacation/cancel`.
 *
 * The production seam is the [Inject] constructor (Hilt supplies real
 * repositories). The `internal constructor(seed)` is the test / preview seam:
 * it injects no repositories, so [load] / [tapTrailingAction] keep the
 * deterministic local behavior the existing unit + snapshot tests assert
 * (mirrors iOS `VacationHoldViewModel(seed:)`).
 */
@HiltViewModel
class VacationHoldViewModel
    @Inject
    constructor(
        private val repository: MailboxRepository?,
        private val homesRepository: HomesRepository?,
    ) : ViewModel() {
        internal constructor(seed: VacationHoldSeed) : this(null, null) {
            _mode.value = makeMode(seed)
        }

        private val _mode = MutableStateFlow(makeMode(VacationHoldSeed.Scheduling))

        /** Observed mode. */
        val mode: StateFlow<VacationHoldMode> = _mode.asStateFlow()

        private val _isLoading = MutableStateFlow(repository != null)
        val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
        private val _loadError = MutableStateFlow<String?>(null)
        val loadError: StateFlow<String?> = _loadError.asStateFlow()
        private val _toast = MutableStateFlow<String?>(null)

        /** Transient banner; the screen clears it after display. Mirrors iOS `toast`. */
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _mutationInFlight = MutableStateFlow(false)

        /** Save / End-hold mutation in-flight; the chrome disables while it runs. */
        val mutationInFlight: StateFlow<Boolean> = _mutationInFlight.asStateFlow()

        fun consumeToast() {
            _toast.value = null
        }

        /** Id of the active hold (from `/vacation/status` or `/vacation/start`) — needed to cancel. */
        private var activeHoldId: String? = null

        /** Wire row backing the active hold, so Edit can seed the composer from it. */
        private var activeHoldDto: VacationHoldDto? = null

        /** Existing record to update atomically when saving an edit. */
        private var editingHoldId: String? = null

        private var onBack: () -> Unit = {}
        private var onEditForwarding: () -> Unit = {}
        private var onEditEmergency: () -> Unit = {}
        private var onPickFromDate: () -> Unit = {}
        private var onPickToDate: () -> Unit = {}

        /** Wire nav callbacks before first paint. */
        fun configureNavigation(
            onBack: () -> Unit = {},
            onEditForwarding: () -> Unit = {},
            onEditEmergency: () -> Unit = {},
            onPickFromDate: () -> Unit = {},
            onPickToDate: () -> Unit = {},
        ) {
            this.onBack = onBack
            this.onEditForwarding = onEditForwarding
            this.onEditEmergency = onEditEmergency
            this.onPickFromDate = onPickFromDate
            this.onPickToDate = onPickToDate
        }

        /** Re-seed the screen from a deep link / push (preview + test helper). */
        fun configureSeed(seed: VacationHoldSeed) {
            _mode.value = makeMode(seed)
        }

        /**
         * Fetch the current hold. With a repository (production) this hits
         * `/vacation/status`; without one (preview / test) it projects [seed]
         * locally so the deterministic frames render.
         */
        fun load(seed: VacationHoldSeed = VacationHoldSeed.Scheduling) {
            val repo = repository
            if (repo == null) {
                _mode.value = makeMode(seed)
                return
            }
            _isLoading.value = true
            _loadError.value = null
            viewModelScope.launch {
                when (val result = repo.vacationStatus()) {
                    is NetworkResult.Success -> {
                        val active = result.data.active ?: result.data.upcoming
                        if (active != null) {
                            activeHoldId = active.id
                            activeHoldDto = active
                            editingHoldId = null
                            _mode.value = VacationHoldMode.Active(active.toActiveHold())
                        } else {
                            activeHoldId = null
                            activeHoldDto = null
                            editingHoldId = null
                            _mode.value = VacationHoldMode.Scheduling(VacationScheduleDraft.liveDefault())
                        }
                    }
                    is NetworkResult.Failure -> {
                        _loadError.value = result.error.displayMessage("Couldn't load your travel dates.")
                    }
                }
                _isLoading.value = false
            }
        }

        // MARK: - Trailing-action chrome

        /** "Save" in scheduling, "Edit" in active (ending moved to the bottom row). */
        val trailingActionLabel: String
            get() =
                when (_mode.value) {
                    is VacationHoldMode.Scheduling -> "Save"
                    is VacationHoldMode.Active -> "Edit"
                }

        /** Save disables when the draft is invalid or a write is in flight; Edit is always enabled. */
        val trailingActionEnabled: Boolean
            get() =
                !_mutationInFlight.value && !_isLoading.value && _loadError.value == null &&
                    when (val current = _mode.value) {
                        is VacationHoldMode.Scheduling -> current.draft.isValid
                        is VacationHoldMode.Active -> true
                    }

        // MARK: - View intents

        fun tapBack() = onBack()

        fun tapTrailingAction() {
            if (!trailingActionEnabled) return
            val repo = repository
            val homesRepo = homesRepository
            if (repo == null || homesRepo == null) {
                // Preview / test seam — flip locally so the QA + snapshot path
                // validates the "Save flips chrome" / "Edit returns to form" handoff.
                _mode.value =
                    when (_mode.value) {
                        is VacationHoldMode.Scheduling ->
                            VacationHoldMode.Active(VacationHoldSampleData.activeHold)
                        is VacationHoldMode.Active ->
                            VacationHoldMode.Scheduling(VacationHoldSampleData.schedulingDraft)
                    }
                return
            }
            when (val current = _mode.value) {
                is VacationHoldMode.Scheduling -> startHold(current.draft, repo, homesRepo)
                is VacationHoldMode.Active -> {
                    // Edit returns to the scheduling form (the only edit state
                    // the screen has today), seeded from the *live* hold —
                    // dropping back to the sample draft would silently rewrite
                    // the user's real dates. Ending the hold is `endHoldEarly`.
                    editingHoldId = activeHoldId
                    _mode.value = VacationHoldMode.Scheduling(draftForEdit(activeHoldDto))
                }
            }
        }

        /**
         * Seed the composer from the live hold. The rich scope / forwarding /
         * emergency fields have no backend source, so they keep the live
         * defaults; the dates and the forwarding switch come from the wire row.
         */
        private fun draftForEdit(hold: VacationHoldDto?): VacationScheduleDraft {
            val base = VacationScheduleDraft.liveDefault()
            if (hold == null) return base
            val from = parseDate(hold.startDate) ?: base.fromDate
            val to = parseDate(hold.endDate) ?: base.toDate
            return base.copy(
                fromDate = from,
                toDate = if (to.isBefore(from)) from else to,
                forwardingEnabled = hold.holdAction == FORWARD_TO_HOUSEHOLD,
            )
        }

        /**
         * A14.8 — destructive "End hold early" row at the bottom of the
         * active body. Cancels the live hold (or flips locally in preview).
         */
        fun endHoldEarly() {
            if (_mode.value !is VacationHoldMode.Active) return
            val repo = repository
            if (repo == null) {
                _mode.value = VacationHoldMode.Scheduling(VacationHoldSampleData.schedulingDraft)
                return
            }
            cancelHold(repo)
        }

        fun tapFromDate() = onPickFromDate()

        fun tapToDate() = onPickToDate()

        fun tapForwarding() = onEditForwarding()

        fun tapEmergency() = onEditEmergency()

        /**
         * Toggle a scope row. Locked rows are ignored — civic notices stay
         * always-on, never on the hold.
         */
        fun toggleScope(
            kind: VacationHoldScope.Kind,
            isOn: Boolean,
        ) {
            val current = _mode.value as? VacationHoldMode.Scheduling ?: return
            val draft = current.draft
            val updated =
                draft.scopes.map { scope ->
                    if (scope.kind == kind && !scope.isLocked) {
                        scope.copy(isOn = isOn)
                    } else {
                        scope
                    }
                }
            _mode.value = VacationHoldMode.Scheduling(draft.copy(scopes = updated))
        }

        /** Toggle forwarding on/off (controls the address-row visibility). */
        fun toggleForwarding(isOn: Boolean) {
            val current = _mode.value as? VacationHoldMode.Scheduling ?: return
            _mode.value =
                VacationHoldMode.Scheduling(current.draft.copy(forwardingEnabled = isOn))
        }

        /** Replace `fromDate`. Clamps `toDate` forward when the start moves past it. */
        fun setFromDate(value: LocalDate) {
            val current = _mode.value as? VacationHoldMode.Scheduling ?: return
            val draft = current.draft
            val newTo = if (draft.toDate.isBefore(value)) value else draft.toDate
            _mode.value =
                VacationHoldMode.Scheduling(draft.copy(fromDate = value, toDate = newTo))
        }

        /** Replace `toDate`. Clamps to `fromDate` if the picker returns an earlier date. */
        fun setToDate(value: LocalDate) {
            val current = _mode.value as? VacationHoldMode.Scheduling ?: return
            val draft = current.draft
            val clamped = if (value.isBefore(draft.fromDate)) draft.fromDate else value
            _mode.value = VacationHoldMode.Scheduling(draft.copy(toDate = clamped))
        }

        // MARK: - Network mutations

        private fun startHold(
            draft: VacationScheduleDraft,
            repo: MailboxRepository,
            homesRepo: HomesRepository,
        ) {
            if (_mutationInFlight.value) return
            _mutationInFlight.value = true
            viewModelScope.launch {
                try {
                    val homeId = if (editingHoldId != null) activeHoldDto?.homeId else resolveHomeId(homesRepo)
                    if (homeId == null) {
                        if (editingHoldId != null) _toast.value = "Reload your travel dates before editing."
                        return@launch
                    }
                    val request =
                        StartVacationRequest(
                            homeId = homeId,
                            startDate = draft.fromDate.toString(),
                            endDate = draft.toDate.toString(),
                            holdAction = activeHoldDto?.holdAction ?: "hold_in_vault",
                            packageAction = activeHoldDto?.packageAction ?: "hold_at_carrier",
                            autoNeighborRequest = activeHoldDto?.autoNeighborRequest ?: false,
                            holdId = editingHoldId,
                        )
                    when (val result = repo.startVacation(request)) {
                        is NetworkResult.Success -> {
                            activeHoldId = result.data.hold.id
                            activeHoldDto = result.data.hold
                            _mode.value = VacationHoldMode.Active(result.data.hold.toActiveHold())
                            editingHoldId = null
                            _toast.value = "Travel dates saved"
                        }
                        // Keep the composer; the CTA can be retried.
                        is NetworkResult.Failure -> {
                            val message = result.error.displayMessage("Couldn't save your travel dates.")
                            if (result.error.code == 409) _loadError.value = message else _toast.value = message
                        }
                    }
                } finally {
                    _mutationInFlight.value = false
                }
            }
        }

        private fun cancelHold(repo: MailboxRepository) {
            val holdId = activeHoldId ?: return
            if (_mutationInFlight.value) return
            _mutationInFlight.value = true
            viewModelScope.launch {
                when (val result = repo.cancelVacation(holdId)) {
                    is NetworkResult.Success -> {
                        activeHoldId = null
                        activeHoldDto = null
                        editingHoldId = null
                        _mode.value = VacationHoldMode.Scheduling(VacationScheduleDraft.liveDefault())
                        _toast.value = "Travel dates cancelled"
                        load()
                    }
                    // Keep the active hold visible.
                    is NetworkResult.Failure ->
                        _toast.value = result.error.displayMessage("Couldn't end your hold.")
                }
                _mutationInFlight.value = false
            }
        }

        private suspend fun resolveHomeId(homesRepo: HomesRepository): String? =
            when (val result = homesRepo.myHomes()) {
                is NetworkResult.Success -> result.data.homes.firstOrNull()?.id.also {
                    if (it == null) _toast.value = "Add a home before saving travel dates."
                }
                is NetworkResult.Failure -> {
                    _toast.value = result.error.displayMessage("Couldn't load your home. Try saving again.")
                    null
                }
            }
    }

/** Backend `hold_action` value for "forward urgent mail to the household". */
private const val FORWARD_TO_HOUSEHOLD = "forward_to_household"

private fun makeMode(seed: VacationHoldSeed): VacationHoldMode =
    when (seed) {
        VacationHoldSeed.Scheduling ->
            VacationHoldMode.Scheduling(VacationHoldSampleData.schedulingDraft)
        VacationHoldSeed.Active ->
            VacationHoldMode.Active(VacationHoldSampleData.activeHold)
    }

private val untilFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)

/**
 * Project a wire `VacationHold` into the Active-variant content. The backend
 * row is sparse (a single held-item count, no per-type ledger / emergency
 * contact), so those slots stay minimal — real holds render simpler than the
 * sample fixture, which is expected.
 */
private fun VacationHoldDto.toActiveHold(today: LocalDate = LocalDate.now(ZoneOffset.UTC)): VacationActiveHold {
    val end = parseDate(endDate)
    val start = parseDate(startDate)
    val daysLeft = end?.let { ChronoUnit.DAYS.between(today, it).toInt().coerceAtLeast(0) } ?: 0
    val untilLabel = end?.format(untilFormat) ?: (endDate ?: "")
    val statusLabel = when (status) {
        "scheduled" -> "Scheduled"
        "completed" -> "Completed"
        else -> "Current"
    }
    val fromLabel = start?.format(untilFormat) ?: startDate.orEmpty()
    return VacationActiveHold(
        daysLeft = daysLeft,
        untilLabel = untilLabel,
        resumeBlurb = "Saving dates does not arrange mail holds, package handling or forwarding. Contact your carriers directly.",
        stats = emptyList(),
        heldItems = emptyList(),
        forwarding = null,
        emergency = null,
        activeSinceLabel = "$fromLabel – $untilLabel · Status changes at midnight UTC.",
        statusLabel = statusLabel,
    )
}

private fun parseDate(value: String?): LocalDate? {
    if (value.isNullOrBlank()) return null
    return runCatching { LocalDate.parse(value.substringBefore('T')) }.getOrNull()
}
