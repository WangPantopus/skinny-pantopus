@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.vacation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.StartVacationRequest
import app.pantopus.android.data.api.models.mailbox.v2.VacationHoldDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.mailbox.components.mailMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
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
        private val network: NetworkMonitor? = null,
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

        private val _dateError = MutableStateFlow<String?>(null)

        /** Why these dates can't be held ("Choose a day from today on…"): shown under them until they change. */
        val dateError: StateFlow<String?> = _dateError.asStateFlow()

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
                            _mode.value = VacationHoldMode.Active(active.toActiveHold(heldCount = result.data.heldCount))
                        } else {
                            activeHoldId = null
                            activeHoldDto = null
                            editingHoldId = null
                            _mode.value = VacationHoldMode.Scheduling(VacationScheduleDraft.liveDefault())
                        }
                    }
                    is NetworkResult.Failure -> {
                        _loadError.value = result.error.mailMessage(online(), doing = "load your mail hold")
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
            _dateError.value = null
            val draft = current.draft
            val newTo = if (draft.toDate.isBefore(value)) value else draft.toDate
            _mode.value =
                VacationHoldMode.Scheduling(draft.copy(fromDate = value, toDate = newTo))
        }

        /** Replace `toDate`. Clamps to `fromDate` if the picker returns an earlier date. */
        fun setToDate(value: LocalDate) {
            val current = _mode.value as? VacationHoldMode.Scheduling ?: return
            _dateError.value = null
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
            // Days the person can see are wrong, said under the dates before anything is sent.
            dateProblem(draft)?.let { problem ->
                _dateError.value = problem
                return
            }
            _mutationInFlight.value = true
            viewModelScope.launch {
                try {
                    val homeId = if (editingHoldId != null) activeHoldDto?.homeId else resolveHomeId(homesRepo)
                    if (homeId == null) {
                        if (editingHoldId != null) _toast.value = "Reload your mail hold before changing its dates."
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
                            _mode.value = VacationHoldMode.Active(result.data.hold.toActiveHold(heldCount = result.data.heldCount))
                            editingHoldId = null
                            _dateError.value = null
                            _toast.value = "Your mail hold is saved."
                            MailboxRepository.announceMailChanged(result.data.hold.id)
                        }
                        // Keep the composer; Hold my mail can be pressed again.
                        is NetworkResult.Failure -> showSaveFailure(result.error)
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
                val wasActive = activeHoldDto?.status == "active"
                when (val result = repo.cancelVacation(holdId)) {
                    is NetworkResult.Success -> {
                        activeHoldId = null
                        activeHoldDto = null
                        editingHoldId = null
                        _mode.value = VacationHoldMode.Scheduling(VacationScheduleDraft.liveDefault())
                        _toast.value =
                            if (wasActive) {
                                "Your hold has ended. What it kept comes with the next morning's mail."
                            } else {
                                "Your hold is cancelled. Your mail keeps coming as usual."
                            }
                        MailboxRepository.announceMailChanged(holdId)
                        load()
                    }
                    // Keep the hold visible, and say it's as it was.
                    is NetworkResult.Failure -> {
                        val why = result.error.mailMessage(online(), doing = "end your hold")
                        _toast.value = "That didn't work: $why Your hold is as it was."
                    }
                }
                _mutationInFlight.value = false
            }
        }

        /** The Home the hold names: one the person lives at (a guest pass or a service visit isn't living there). */
        private suspend fun resolveHomeId(homesRepo: HomesRepository): String? =
            when (val result = homesRepo.myHomes()) {
                is NetworkResult.Success ->
                    result.data.homes.firstOrNull { it.roleBase !in NOT_LIVING_THERE }?.id.also {
                        if (it == null) _dateError.value = "Add your home before holding your mail."
                    }
                is NetworkResult.Failure -> {
                    _toast.value = "Couldn't hold your mail: ${result.error.mailMessage(online(), doing = "find your home")}"
                    null
                }
            }

        /**
         * The server's refusal of the dates (or the Home) shows under the dates and stays until they change; dates that
         * can't change any more need a reload; anything else says what went wrong in a toast.
         */
        private fun showSaveFailure(error: NetworkError) {
            val message = error.mailMessage(online(), doing = "hold your mail")
            when (error.code) {
                EDIT_CONFLICT_STATUS -> _loadError.value = message
                BAD_REQUEST_STATUS, FORBIDDEN_STATUS -> _dateError.value = message
                else -> _toast.value = "Couldn't hold your mail: $message"
            }
        }

        private fun online(): Boolean = network?.isOnline?.value ?: true

        /** Dates the person can see are wrong (the server checks again in their own time zone). */
        private fun dateProblem(draft: VacationScheduleDraft): String? =
            when {
                // An edited hold that already began keeps the day it began.
                editingHoldId == null && draft.fromDate.isBefore(LocalDate.now()) -> "Choose a day from today on for when you leave."
                draft.toDate.isBefore(draft.fromDate) -> "Your return date must be on or after the day you leave."
                else -> null
            }
    }

private const val EDIT_CONFLICT_STATUS = 409
private const val BAD_REQUEST_STATUS = 400
private const val FORBIDDEN_STATUS = 403

/** Roles that don't live at a Home, so a hold can't name it (the server's own rule, SRV-5). */
private val NOT_LIVING_THERE = setOf("guest", "service_provider")

/** Stored compatibility preference; it does not execute mail forwarding. */
private const val FORWARD_TO_HOUSEHOLD = "forward_to_household"

private fun makeMode(seed: VacationHoldSeed): VacationHoldMode =
    when (seed) {
        VacationHoldSeed.Scheduling ->
            VacationHoldMode.Scheduling(VacationHoldSampleData.schedulingDraft)
        VacationHoldSeed.Active ->
            VacationHoldMode.Active(VacationHoldSampleData.activeHold)
    }

private val untilFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)
private val dayFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)

/**
 * Project a wire `VacationHold` into the Active-variant content. The backend
 * row is sparse (a single held-item count, no per-type ledger / emergency
 * contact), so those slots stay minimal — real holds render simpler than the
 * sample fixture, which is expected.
 */
private fun VacationHoldDto.toActiveHold(
    heldCount: Int? = null,
    today: LocalDate = LocalDate.now(),
): VacationActiveHold {
    val end = parseDate(endDate)
    val start = parseDate(startDate)
    val daysLeft = end?.let { ChronoUnit.DAYS.between(today, it).toInt().coerceAtLeast(0) } ?: 0
    val untilLabel = end?.format(untilFormat) ?: (endDate ?: "")
    val statusLabel =
        when (status) {
            "scheduled" -> "Scheduled"
            "completed" -> "Completed"
            else -> "On hold"
        }
    val fromLabel = start?.format(untilFormat) ?: startDate.orEmpty()
    val back = end?.format(dayFormat) ?: untilLabel
    return VacationActiveHold(
        daysLeft = daysLeft,
        untilLabel = untilLabel,
        // What the hold does (Mail build contract, SRV-5), in the words of the web and iPhone apps.
        resumeBlurb = "Back home $back. What it keeps comes $back at 7 a.m., together as one bundle.",
        stats = emptyList(),
        heldItems = emptyList(),
        forwarding = null,
        emergency = null,
        activeSinceLabel = "$fromLabel – $untilLabel",
        statusLabel = statusLabel,
        // The server's live count; an older server's row count otherwise.
        heldCount = heldCount ?: itemsHeldCount ?: 0,
        isActive = status != "scheduled",
        startsLabel = start?.format(dayFormat),
    )
}

private fun parseDate(value: String?): LocalDate? {
    if (value.isNullOrBlank()) return null
    return runCatching { LocalDate.parse(value.substringBefore('T')) }.getOrNull()
}
