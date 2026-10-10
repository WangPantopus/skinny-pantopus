@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.support_trains.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.support_trains.CancelReservationBody
import app.pantopus.android.data.api.models.support_trains.ReserveSlotBody
import app.pantopus.android.data.api.models.support_trains.SupportTrainDetailDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Reserve-sheet presentation payload. `slotId` is pre-filled when the
 * user tapped a specific open slot; null starts on the date-picker step.
 */
data class ReserveSheetSelection(
    val slotId: String? = null,
)

/**
 * S1 — the action layer that sits beside the render state: sign-up
 * sheet presentation, in-flight flag, toast + error. Mirrors the iOS
 * `SupportTrainDetailViewModel` published fields.
 */
data class SupportTrainDetailActionState(
    val isSubmitting: Boolean = false,
    val toast: String? = null,
    val error: String? = null,
    val reserveSheet: ReserveSheetSelection? = null,
    val pendingLeave: SlotRowContent? = null,
    /** "Mark delivered" on a slot whose day hasn't come yet, waiting for the helper to confirm. */
    val pendingEarlyDelivery: SlotRowContent? = null,
)

/**
 * A10.9 — VM for the participant-facing Support Train detail screen.
 * A bounded memory summary keeps the title and slots ready on return.
 * The mixed recipient/delivery response is always checked for the open visit.
 *
 * The state machine matches the iOS [SupportTrainDetailViewModel]:
 * `Loading / Loaded / Error`. Fully-covered is **not** empty — it's a
 * celebrated loaded variant.
 */
@HiltViewModel
@Suppress("TooManyFunctions") // The existing helper actions and the private response lifecycle share one visit.
class SupportTrainDetailViewModel
    @Inject
    constructor(
        private val repo: SupportTrainsRepository,
        savedStateHandle: SavedStateHandle,
        sessionScopes: HomeClaimSessionScopeFactory,
    ) : ViewModel() {
        companion object {
            const val SUPPORT_TRAIN_ID_KEY = "supportTrainDetailId"

            /** Shown when "Sign up for a slot" finds nothing open — a notice, not a failure. */
            const val NO_OPEN_DATES_NOTICE = "There are no open dates left on this train."
        }

        private val trainId: String =
            savedStateHandle.get<String>(SUPPORT_TRAIN_ID_KEY) ?: "sample-populated"

        private val _state =
            MutableStateFlow<SupportTrainDetailUiState>(summary())
        val state: StateFlow<SupportTrainDetailUiState> = _state.asStateFlow()
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        /**
         * Optional offline override (previews / QA / tests). When null — the
         * production default — `load()` fetches `GET /api/support-trains/:id`
         * and projects it via [SupportTrainDetailProjection]. Set it to
         * [::defaultResolve] to drive the sample fixtures without a backend.
         */
        var resolve: ((String) -> SupportTrainDetailContent?)? = null

        private val session = sessionScopes.create(viewModelScope)
        private var active = true
        private var readVersion = 0L
        private var readJob: Job? = null
        private val _action = MutableStateFlow(SupportTrainDetailActionState())
        val action: StateFlow<SupportTrainDetailActionState> = _action.asStateFlow()

        init {
            viewModelScope.launch {
                session.invalidated.collect { ended ->
                    if (ended) {
                        suspendContent()
                        _state.value = SupportTrainDetailUiState.Loading
                        _refreshNotice.value = null
                        _action.value = SupportTrainDetailActionState()
                    }
                }
            }
        }

        private fun summary(): SupportTrainDetailUiState =
            repo.detailCopy(trainId).data?.let {
                SupportTrainDetailUiState.Loaded(
                    SupportTrainDetailProjection.project(it).copy(
                        privateDetailsAvailable = false,
                        reserveOptions = emptyList(),
                        dock = SupportTrainDock.Closed("Refresh to sign up"),
                    ),
                )
            } ?: SupportTrainDetailUiState.Loading

        /** The recipient, delivery details and role leave with the visit; an unsent reserve draft stays. */
        fun suspendContent() {
            if (!active) return
            active = false
            readVersion++
            readJob?.cancel()
            _refreshing.value = false
            _state.value = if (session.isCurrent) summary() else SupportTrainDetailUiState.Loading
            _action.update { it.copy(pendingLeave = null, pendingEarlyDelivery = null) }
        }

        private suspend fun current(version: Long): Boolean {
            val allowed = session.confirmCurrent()
            return active && version == readVersion && allowed
        }

        fun load() {
            active = true
            readJob?.cancel()
            val version = ++readVersion
            val override = resolve
            if (override != null) {
                _state.value = override(trainId)?.let { SupportTrainDetailUiState.Loaded(it) }
                    ?: SupportTrainDetailUiState.Error("Couldn't load this support train.")
                return
            }
            if (session.isCurrent && _state.value !is SupportTrainDetailUiState.Loaded) {
                _state.value = summary()
            }
            readJob = viewModelScope.launch {
                try {
                    if (!current(version)) return@launch
                    val result = repo.detail(trainId)
                    if (!current(version)) return@launch
                    publish(result)
                } finally {
                    if (version == readVersion) _refreshing.value = false
                }
            }
        }

        private fun publish(result: NetworkResult<SupportTrainDetailDto>) {
            val saved = repo.detailCopy(trainId)
            _refreshNotice.value =
                RefreshNotice(saved.fetchedAt) { refresh() }.takeIf {
                    result is NetworkResult.Failure && saved.data != null &&
                        System.currentTimeMillis() - saved.fetchedAt > StoreKind.SUPPORT_TRAINS.maxShownAgeMs
                }
            _state.value = when (result) {
                is NetworkResult.Success -> SupportTrainDetailUiState.Loaded(SupportTrainDetailProjection.project(result.data))
                is NetworkResult.Failure -> {
                    val safe = summary()
                    if (!result.error.refusesStoredCopy && safe is SupportTrainDetailUiState.Loaded) {
                        safe
                    } else {
                        SupportTrainDetailUiState.Error(result.error.displayMessage("Couldn't load this train."))
                    }
                }
            }
        }

        fun refresh() {
            _refreshing.value = _state.value is SupportTrainDetailUiState.Loaded
            load()
        }

        fun refreshFromSignal() {
            if (!active || repo.detailIsCurrent(trainId)) return
            if (_action.value.reserveSheet == null) load() else pendingReserveRefresh = true
        }

        /**
         * Test-friendly seeding hook. Used by previews + chrome tests
         * to exercise loading / error deterministically. Hilt callers
         * never invoke this.
         */
        fun seed(state: SupportTrainDetailUiState) {
            _state.value = state
        }

        // ─── S1 · helper actions ───────────────────────────────────────

        /** A signup landed while the sheet was up — refresh on dismissal. */
        private var pendingReserveRefresh = false

        private val loadedContent: SupportTrainDetailContent?
            get() = (_state.value as? SupportTrainDetailUiState.Loaded)?.content

        /** Open the reserve sheet; pass a slot id to skip the picker step. */
        fun startReserve(slotId: String? = null) {
            if (!active || !session.isCurrent || loadedContent?.privateDetailsAvailable != true) return
            val content = loadedContent
            if (content == null || content.reserveOptions.isEmpty()) {
                _action.update { it.copy(error = NO_OPEN_DATES_NOTICE) }
                return
            }
            val resolved = content.reserveOptions.firstOrNull { it.id == slotId }?.id
            _action.update { it.copy(reserveSheet = ReserveSheetSelection(resolved)) }
        }

        /**
         * Closes the sheet and — when a signup landed — refreshes the
         * screen. The refresh is deferred to dismissal on purpose, so the
         * train doesn't change under the sheet while its success step shows.
         */
        fun dismissReserve() {
            _action.update { it.copy(reserveSheet = null) }
            if (pendingReserveRefresh && active) {
                pendingReserveRefresh = false
                load()
            }
        }

        fun requestLeave(row: SlotRowContent) {
            _action.update { it.copy(pendingLeave = row) }
        }

        fun dismissLeave() {
            _action.update { it.copy(pendingLeave = null) }
        }

        fun acknowledgeToast() {
            _action.update { it.copy(toast = null) }
        }

        fun acknowledgeError() {
            _action.update { it.copy(error = null) }
        }

        /**
         * `POST /:id/slots/:slotId/reserve`. Reports failures through
         * [onResult] so the sheet can render them inline (matching RN's
         * ReserveSheet error box); null means success.
         */
        fun reserve(
            slotId: String,
            body: ReserveSlotBody,
            onResult: (String?) -> Unit,
        ) {
            if (_action.value.isSubmitting || !active || !session.isCurrent || loadedContent?.privateDetailsAvailable != true) return
            _action.update { it.copy(isSubmitting = true) }
            viewModelScope.launch {
                if (!session.confirmCurrent()) return@launch
                when (val result = repo.reserve(trainId, slotId, body)) {
                    is NetworkResult.Success -> {
                        if (!session.confirmCurrent()) return@launch
                        pendingReserveRefresh = true
                        _action.update { it.copy(isSubmitting = false, toast = "You're signed up") }
                        onResult(null)
                    }
                    is NetworkResult.Failure -> {
                        if (!session.confirmCurrent()) return@launch
                        _action.update { it.copy(isSubmitting = false) }
                        onResult(reserveFailureMessage(result.error.displayMessage("Failed to reserve. Please try again.")))
                    }
                }
            }
        }

        /**
         * `POST /:id/reservations/:rid/cancel` with `helper_reason` — the
         * helper leaving their own slot (RN `handleLeaveSlot`).
         */
        fun leaveSlot(
            reservationId: String,
            reason: String? = null,
        ) = runAction(
            success = "Slot reopened",
            failure = "Failed to leave this slot.",
        ) {
            repo.cancelReservation(
                trainId,
                reservationId,
                CancelReservationBody(helperReason = reason?.takeIf { it.isNotBlank() }),
            )
        }

        /**
         * `POST /:id/reservations/:rid/deliver`. Before the slot's day it asks first
         * ([SupportTrainDetailActionState.pendingEarlyDelivery]): the organizer is told at once.
         */
        fun markDelivered(reservationId: String) {
            val row =
                (_state.value as? SupportTrainDetailUiState.Loaded)
                    ?.content
                    ?.sections
                    ?.flatMap { it.rows + it.moreRows }
                    ?.firstOrNull { it.reservationId == reservationId }
            if (row?.isBeforeSlotDay == true) {
                _action.update { it.copy(pendingEarlyDelivery = row) }
                return
            }
            deliver(reservationId)
        }

        fun confirmEarlyDelivery() {
            val reservationId = _action.value.pendingEarlyDelivery?.reservationId ?: return
            _action.update { it.copy(pendingEarlyDelivery = null) }
            deliver(reservationId)
        }

        fun dismissEarlyDelivery() {
            _action.update { it.copy(pendingEarlyDelivery = null) }
        }

        private fun deliver(reservationId: String) =
            runAction(
                success = "Marked delivered",
                failure = "Failed to mark this as delivered.",
            ) { repo.markDelivered(trainId, reservationId) }

        /** `POST /:id/reservations/:rid/confirm` (recipient / organizer). */
        fun confirmDelivery(reservationId: String) =
            runAction(
                success = "Delivery confirmed",
                failure = "Failed to confirm this delivery.",
            ) { repo.confirmDelivery(trainId, reservationId) }

        private fun runAction(
            success: String,
            failure: String,
            block: suspend () -> NetworkResult<Unit>,
        ) {
            if (_action.value.isSubmitting || !active || !session.isCurrent || loadedContent?.privateDetailsAvailable != true) return
            _action.update { it.copy(isSubmitting = true, pendingLeave = null) }
            viewModelScope.launch {
                if (!session.confirmCurrent()) return@launch
                when (val result = block()) {
                    is NetworkResult.Success -> {
                        if (!session.confirmCurrent()) return@launch
                        _action.update { it.copy(isSubmitting = false, toast = success) }
                        if (active) load()
                    }
                    is NetworkResult.Failure -> {
                        if (!session.confirmCurrent()) return@launch
                        _action.update {
                            it.copy(isSubmitting = false, error = result.error.displayMessage(failure))
                        }
                    }
                }
            }
        }

        /**
         * RN maps the reserve-specific 409 codes onto friendlier copy
         * (`components/support-trains/ReserveSheet.tsx:138`); mirror it.
         */
        private fun reserveFailureMessage(raw: String): String =
            when {
                raw.contains("SLOT_FULL") || raw.contains("SLOT_NOT_OPEN") || raw.contains("no longer open") ->
                    "This slot was just filled. Please refresh and try another."
                raw.contains("ALREADY_RESERVED") || raw.contains("already have a reservation") ->
                    "You already have a reservation on this slot."
                else -> raw
            }
    }

/**
 * Pure resolver used both as the default VM strategy and directly
 * from previews + tests. Returns the fully-covered fixture when the
 * trainId contains "covered" or "full", otherwise the populated one.
 */
fun defaultResolve(trainId: String): SupportTrainDetailContent {
    val lowered = trainId.lowercase()
    return if ("covered" in lowered || "full" in lowered) {
        SupportTrainDetailSampleData.fullyCovered
    } else {
        SupportTrainDetailSampleData.populated
    }
}
