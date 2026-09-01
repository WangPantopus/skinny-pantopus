@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.support_trains.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.support_trains.CancelReservationBody
import app.pantopus.android.data.api.models.support_trains.ReserveSlotBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
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
)

/**
 * A10.9 — VM for the participant-facing Support Train detail screen.
 * Distinct from the organizer-only `ReviewSignupsViewModel`. The
 * detail payload is not yet projected by the backend's
 * `GET /api/support-trains/:id`, so the VM resolves from a
 * deterministic stub ([SupportTrainDetailSampleData]) and chooses the
 * `populated` vs `fullyCovered` variant by inspecting the `trainId`.
 *
 * The state machine matches the iOS [SupportTrainDetailViewModel]:
 * `Loading / Loaded / Error`. Fully-covered is **not** empty — it's a
 * celebrated loaded variant.
 */
@HiltViewModel
class SupportTrainDetailViewModel
    @Inject
    constructor(
        private val repo: SupportTrainsRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        companion object {
            const val SUPPORT_TRAIN_ID_KEY = "supportTrainDetailId"
        }

        private val trainId: String =
            savedStateHandle.get<String>(SUPPORT_TRAIN_ID_KEY) ?: "sample-populated"

        private val _state =
            MutableStateFlow<SupportTrainDetailUiState>(SupportTrainDetailUiState.Loading)
        val state: StateFlow<SupportTrainDetailUiState> = _state.asStateFlow()

        /**
         * Optional offline override (previews / QA / tests). When null — the
         * production default — `load()` fetches `GET /api/support-trains/:id`
         * and projects it via [SupportTrainDetailProjection]. Set it to
         * [::defaultResolve] to drive the sample fixtures without a backend.
         */
        var resolve: ((String) -> SupportTrainDetailContent?)? = null

        fun load() {
            viewModelScope.launch {
                _state.value = SupportTrainDetailUiState.Loading
                val override = resolve
                if (override != null) {
                    val content = override(trainId)
                    _state.value =
                        if (content != null) {
                            SupportTrainDetailUiState.Loaded(content)
                        } else {
                            SupportTrainDetailUiState.Error("Couldn't load this support train.")
                        }
                    return@launch
                }
                _state.value =
                    when (val result = repo.detail(trainId)) {
                        is NetworkResult.Success ->
                            SupportTrainDetailUiState.Loaded(SupportTrainDetailProjection.project(result.data))
                        is NetworkResult.Failure ->
                            SupportTrainDetailUiState.Error(result.error.displayMessage("Couldn't load this train."))
                    }
            }
        }

        fun refresh() {
            load()
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

        private val _action = MutableStateFlow(SupportTrainDetailActionState())
        val action: StateFlow<SupportTrainDetailActionState> = _action.asStateFlow()

        /** A signup landed while the sheet was up — refresh on dismissal. */
        private var pendingReserveRefresh = false

        private val loadedContent: SupportTrainDetailContent?
            get() = (_state.value as? SupportTrainDetailUiState.Loaded)?.content

        /** Open the reserve sheet; pass a slot id to skip the picker step. */
        fun startReserve(slotId: String? = null) {
            val content = loadedContent
            if (content == null || content.reserveOptions.isEmpty()) {
                _action.update { it.copy(error = "There are no open dates left on this train.") }
                return
            }
            val resolved = content.reserveOptions.firstOrNull { it.id == slotId }?.id
            _action.update { it.copy(reserveSheet = ReserveSheetSelection(resolved)) }
        }

        /**
         * Closes the sheet and — when a signup landed — refreshes the
         * screen. The refresh is deferred to dismissal on purpose:
         * calling `load()` while the sheet is up flips the state back to
         * `Loading`, which unmounts the sheet and loses its success step.
         */
        fun dismissReserve() {
            _action.update { it.copy(reserveSheet = null) }
            if (pendingReserveRefresh) {
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
            if (_action.value.isSubmitting) return
            _action.update { it.copy(isSubmitting = true) }
            viewModelScope.launch {
                when (val result = repo.reserve(trainId, slotId, body)) {
                    is NetworkResult.Success -> {
                        pendingReserveRefresh = true
                        _action.update { it.copy(isSubmitting = false, toast = "You're signed up") }
                        onResult(null)
                    }
                    is NetworkResult.Failure -> {
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

        /** `POST /:id/reservations/:rid/deliver`. */
        fun markDelivered(reservationId: String) =
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
            if (_action.value.isSubmitting) return
            _action.update { it.copy(isSubmitting = true, pendingLeave = null) }
            viewModelScope.launch {
                when (val result = block()) {
                    is NetworkResult.Success -> {
                        _action.update { it.copy(isSubmitting = false, toast = success) }
                        load()
                    }
                    is NetworkResult.Failure ->
                        _action.update {
                            it.copy(isSubmitting = false, error = result.error.displayMessage(failure))
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
