@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions", "LargeClass", "LongParameterList")

package app.pantopus.android.ui.screens.support_trains.manage

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.support_trains.AddSupportTrainOrganizerBody
import app.pantopus.android.data.api.models.support_trains.AddSupportTrainSlotBody
import app.pantopus.android.data.api.models.support_trains.CancelReservationBody
import app.pantopus.android.data.api.models.support_trains.SupportTrainFundDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainUpdateBody
import app.pantopus.android.data.api.models.support_trains.UpdateSupportTrainSlotBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import app.pantopus.android.ui.screens.support_trains.detail.SupportTrainViewerRole
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * A13.13 — Manage train. Aggregate UI state for the organizer-side
 * surface. Mirrors the iOS `ManageTrainState` shape so the two
 * platforms project identical content.
 */
sealed interface ManageTrainState {
    /** Initial fetch in flight (shimmer skeleton). */
    object Loading : ManageTrainState

    /** Train loaded successfully. */
    data class Loaded(val content: ManageTrainContent) : ManageTrainState

    /** Fetch failed; the screen surfaces the message with a `Try again` CTA. */
    data class Error(val message: String) : ManageTrainState
}

/** One audience chip in the Send-an-update form. */
data class AudienceChipContent(
    val id: String,
    val label: String,
    val count: String,
)

/** Visual tone for an Organize-section row's leading icon tile. */
enum class OrganizeRowTone { AMBER, SKY, GREEN, RED }

/** One row in the Organize section card (or the Close-train destructive row). */
data class OrganizeRowContent(
    val id: String,
    val icon: PantopusIcon,
    val tone: OrganizeRowTone,
    val label: String,
    val meta: String?,
    val sub: String?,
    val isDestructive: Boolean,
)

/** The CloseTrainSheet's static copy. The editable thank-you note lives on the VM. */
data class CloseTrainSheetContent(
    val daysEarlyLabel: String,
    val mealsDelivered: String,
    val neighborsHelped: String,
    val coverageDays: String,
    val recipientQuote: String,
)

/** Static, design-driven content for one Manage Train screen instance. */
data class ManageTrainContent(
    val trainId: String,
    val title: String,
    val dateRangeLabel: String,
    val isActive: Boolean,
    val slotFillValue: String,
    val helpersValue: String,
    val daysLeftValue: String,
    val dropoutValue: String,
    val slotsFilled: Int,
    val slotsOpen: Int,
    val slotsDropout: Int,
    val slotsTotal: Int,
    val slotFillCaption: String,
    val draftMessage: String,
    val audienceChips: List<AudienceChipContent>,
    val selectedAudienceId: String,
    val pushToPhones: Boolean,
    val organizeRows: List<OrganizeRowContent>,
    val closeRow: OrganizeRowContent,
    val close: CloseTrainSheetContent,
    /**
     * Lifecycle status straight off the payload — `draft` / `published` /
     * `active` / `paused` / `completed` / `archived`. Drives which
     * lifecycle rows are legal (the backend 409s on the rest).
     */
    val status: String = "active",
    /**
     * Organizer tier. `PRIMARY_ORGANIZER` unlocks unpublish / archive /
     * delete / co-organizer edits / fund disable
     * (`backend/middleware/supportTrainPermissions.js:51`).
     */
    val viewerRole: SupportTrainViewerRole = SupportTrainViewerRole.PRIMARY_ORGANIZER,
)

/** Drives the Close-train confirmation sheet presentation. */
enum class ManageTrainSheetMode { HIDDEN, CLOSING, CLOSED }

/**
 * Wire-format UI state: the content frame + the editable draft + the
 * sheet + the transient toast. Mirrors the iOS `ManageTrainViewModel`
 * surface so parity tests can compare projections directly.
 */
data class ManageTrainUiState(
    val state: ManageTrainState = ManageTrainState.Loading,
    val draftMessage: String = "",
    val selectedAudienceId: String = "",
    val pushToPhones: Boolean = true,
    val thankYouNote: String = "",
    val sheetMode: ManageTrainSheetMode = ManageTrainSheetMode.HIDDEN,
    val toast: String? = null,
    // ── S1 organizer surfaces ──
    /** Helper roster from `GET /:id/reservations`. */
    val helperRows: List<ManageHelperRow> = emptyList(),
    /** Slot roster from the detail payload. */
    val slotRows: List<ManageSlotRow> = emptyList(),
    /** Co-organizer roster from `GET /:id/organizers`. */
    val organizerRows: List<ManageOrganizerRow> = emptyList(),
    /** Gift-fund summary from `GET /:id/fund`. */
    val fund: SupportTrainFundDto? = null,
    /** True while any organizer mutation is in flight. */
    val isSubmitting: Boolean = false,
    /** AI-drafted open-slots nudge, editable before sending. */
    val nudgeDraft: String? = null,
    /** Text field backing the "add co-organizer" row (a user id). */
    val newOrganizerUserId: String = "",
    /** Gift-fund goal input, in whole dollars (the API takes cents). */
    val fundGoalDollars: String = "",
    /** Inline failure copy for the last organizer action. */
    val actionError: String? = null,
    /** Presented slot editor (add or edit), or null. */
    val slotEditor: ManageSlotEditorState? = null,
    /** Pending destructive confirm, or null. */
    val pendingConfirm: ManageDestructiveConfirm? = null,
    /** Set once the train is deleted so the host can pop the screen. */
    val didDeleteTrain: Boolean = false,
) {
    val characterCount: Int get() = draftMessage.length
    val characterCounterLabel: String get() = "$characterCount / $MAX_MESSAGE_CHARS"

    /**
     * True when the draft message has at least one non-whitespace
     * character and is under the cap. Mirrors the design's
     * `Send update` enable rule.
     */
    val canSendUpdate: Boolean
        get() =
            draftMessage.trim().isNotEmpty() &&
                draftMessage.length <= MAX_MESSAGE_CHARS

    companion object {
        const val MAX_MESSAGE_CHARS: Int = 500
    }
}

/**
 * P4.3 — A13.13 — Manage train ViewModel.
 *
 * `load()` fetches `GET /api/support-trains/:id` and derives the organizer
 * dashboard ([ManageTrainProjection]); pass a `seed` to render offline
 * (previews / tests). `sendUpdate` posts to `POST /:id/updates`;
 * `confirmClose` marks the train completed via `POST /:id/complete`
 * (sending the optional thank-you note as a final broadcast first). Both
 * mutate local state optimistically so the toast / chip flip stay instant.
 *
 * PROJECTION GAPS (no backend field): audience segmentation + push-to-phones
 * stay client-only (the endpoint broadcasts to everyone); dropout shows 0;
 * there is no single "close with thanks" route.
 */
@HiltViewModel
class ManageTrainViewModel
    @Inject
    constructor(
        private val repo: SupportTrainsRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val trainId: String =
            savedStateHandle.get<String>(TRAIN_ID_KEY).orEmpty()

        private val _state = MutableStateFlow(ManageTrainUiState())
        val state: StateFlow<ManageTrainUiState> = _state.asStateFlow()

        /**
         * Load the dashboard. With a `seed` (previews / tests) it renders
         * directly; otherwise it fetches `GET /:id` and projects it.
         */
        fun load(seed: ManageTrainContent? = null) {
            if (seed != null) {
                applyContent(seed)
                return
            }
            // Keep an already-loaded dashboard on screen while refreshing
            // (an organizer action re-runs `load()`); mirrors iOS.
            _state.update {
                if (it.state is ManageTrainState.Loaded) it else it.copy(state = ManageTrainState.Loading)
            }
            viewModelScope.launch {
                when (val result = repo.detail(trainId)) {
                    is NetworkResult.Success -> {
                        applyContent(ManageTrainProjection.project(result.data))
                        val slots = ManageOrganizerProjection.slotRows(result.data.slots ?: emptyList())
                        _state.update { it.copy(slotRows = slots) }
                        loadOrganizerSurfaces(slots)
                    }
                    is NetworkResult.Failure ->
                        _state.update { it.copy(state = ManageTrainState.Error(result.error.message)) }
                }
            }
        }

        /**
         * Fan-out for the organizer-only feeds. Failures degrade to empty
         * sections instead of blowing up the whole screen.
         */
        private suspend fun loadOrganizerSurfaces(slots: List<ManageSlotRow>) {
            val reservations =
                when (val result = repo.reservations(trainId)) {
                    is NetworkResult.Success -> result.data.reservations
                    is NetworkResult.Failure -> emptyList()
                }
            val organizers =
                when (val result = repo.organizers(trainId)) {
                    is NetworkResult.Success -> result.data.organizers
                    is NetworkResult.Failure -> emptyList()
                }
            val fund =
                when (val result = repo.fund(trainId)) {
                    is NetworkResult.Success -> result.data
                    is NetworkResult.Failure -> null
                }
            _state.update {
                it.copy(
                    helperRows = ManageOrganizerProjection.helperRows(reservations, slots),
                    organizerRows = ManageOrganizerProjection.organizerRows(organizers),
                    fund = fund,
                )
            }
        }

        private fun applyContent(content: ManageTrainContent) {
            _state.update { current ->
                ManageTrainUiState(
                    state = ManageTrainState.Loaded(content),
                    draftMessage = content.draftMessage,
                    selectedAudienceId = content.selectedAudienceId,
                    pushToPhones = content.pushToPhones,
                    thankYouNote = "",
                    sheetMode = ManageTrainSheetMode.HIDDEN,
                    // Organizer actions flash a toast and then re-`load()`;
                    // carry it across the refresh so it isn't swallowed.
                    toast = current.toast,
                    helperRows = current.helperRows,
                    slotRows = current.slotRows,
                    organizerRows = current.organizerRows,
                    fund = current.fund,
                    fundGoalDollars = current.fundGoalDollars,
                )
            }
        }

        // MARK: - Send-update form

        fun updateDraftMessage(value: String) {
            // Hard-clip to the cap so the counter never displays over-limit.
            val clamped =
                if (value.length > ManageTrainUiState.MAX_MESSAGE_CHARS) {
                    value.substring(0, ManageTrainUiState.MAX_MESSAGE_CHARS)
                } else {
                    value
                }
            _state.update { it.copy(draftMessage = clamped) }
        }

        fun selectAudience(id: String) {
            val current = _state.value
            val content = (current.state as? ManageTrainState.Loaded)?.content ?: return
            if (content.audienceChips.none { it.id == id }) return
            _state.update { it.copy(selectedAudienceId = id) }
        }

        fun togglePush(value: Boolean) {
            _state.update { it.copy(pushToPhones = value) }
        }

        /**
         * Send the typed update via `POST /api/support-trains/:id/updates`.
         * Optimistically clears the draft + flashes the toast; the audience
         * filter + push-to-phones toggle have no backend field (the endpoint
         * broadcasts to everyone) so they stay client-only.
         */
        fun sendUpdate() {
            val current = _state.value
            if (!current.canSendUpdate) return
            val content = (current.state as? ManageTrainState.Loaded)?.content ?: return
            val body = current.draftMessage
            val helperCount =
                content.audienceChips.firstOrNull { it.id == current.selectedAudienceId }?.count
                    ?: content.helpersValue
            _state.update {
                it.copy(
                    draftMessage = "",
                    toast = "Update sent · $helperCount helpers",
                )
            }
            viewModelScope.launch {
                repo.postUpdate(trainId, SupportTrainUpdateBody(body = body))
            }
        }

        fun acknowledgeToast() {
            _state.update { it.copy(toast = null) }
        }

        // MARK: - Close-train sheet

        fun showCloseSheet() {
            _state.update { it.copy(sheetMode = ManageTrainSheetMode.CLOSING) }
        }

        fun hideCloseSheet() {
            _state.update { it.copy(sheetMode = ManageTrainSheetMode.HIDDEN) }
        }

        fun updateThankYouNote(value: String) {
            _state.update { it.copy(thankYouNote = value) }
        }

        /**
         * Close & thank. Optimistically flips the train to `closed`, then
         * sends the thank-you note as a final broadcast (`POST /:id/updates`)
         * when one was typed and marks the train completed
         * (`POST /:id/complete`). The backend has no single "close with
         * thanks" route, so this composes the two calls.
         */
        fun confirmClose() {
            val current = _state.value
            val content = (current.state as? ManageTrainState.Loaded)?.content ?: return
            val note = current.thankYouNote.trim()
            val next = content.copy(isActive = false)
            _state.update {
                it.copy(
                    state = ManageTrainState.Loaded(next),
                    sheetMode = ManageTrainSheetMode.CLOSED,
                    toast = "Train closed · thanks sent to ${content.helpersValue} helpers",
                )
            }
            viewModelScope.launch {
                if (note.isNotEmpty()) {
                    repo.postUpdate(trainId, SupportTrainUpdateBody(body = note))
                }
                repo.complete(trainId)
            }
        }

        // ─── S1 · organizer actions ────────────────────────────────────

        /** `POST /:id/pause` — primary or co-organizer. */
        fun pauseTrain() = runAction("Train paused", "Couldn't pause this train.") { repo.pause(trainId) }

        /** `POST /:id/resume` — primary or co-organizer. */
        fun resumeTrain() = runAction("Train resumed", "Couldn't resume this train.") { repo.resume(trainId) }

        /** `POST /:id/unpublish` — primary only. */
        fun unpublishTrain() = runAction("Back to draft", "Couldn't unpublish this train.") { repo.unpublish(trainId) }

        /** `POST /:id/archive` — primary only, `completed` → `archived`. */
        fun archiveTrain() = runAction("Train archived", "Couldn't archive this train.") { repo.archive(trainId) }

        /**
         * `DELETE /:id`. Primary only; the backend 409s once helpers have
         * committed or contributions exist, and that message surfaces
         * verbatim.
         */
        fun deleteTrain() {
            if (_state.value.isSubmitting) return
            _state.update { it.copy(isSubmitting = true, pendingConfirm = null) }
            viewModelScope.launch {
                when (val result = repo.deleteTrain(trainId)) {
                    is NetworkResult.Success ->
                        _state.update {
                            it.copy(
                                isSubmitting = false,
                                didDeleteTrain = true,
                                toast = "Support train deleted",
                            )
                        }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(
                                isSubmitting = false,
                                actionError = result.error.displayMessage("Couldn't delete this train."),
                            )
                        }
                }
            }
        }

        fun updateNewOrganizerUserId(value: String) {
            _state.update { it.copy(newOrganizerUserId = value) }
        }

        /** `POST /:id/organizers` — primary only. */
        fun addOrganizer() {
            val userId = _state.value.newOrganizerUserId.trim()
            if (userId.isEmpty()) return
            _state.update { it.copy(newOrganizerUserId = "") }
            runAction("Co-organizer added", "Couldn't add that co-organizer.") {
                repo.addOrganizer(trainId, AddSupportTrainOrganizerBody(userId = userId))
            }
        }

        /** `DELETE /:id/organizers/:userId` — primary only. */
        fun removeOrganizer(userId: String) =
            runAction("Co-organizer removed", "Couldn't remove that co-organizer.") {
                repo.removeOrganizer(trainId, userId)
            }

        fun startAddSlot() {
            _state.update {
                it.copy(
                    slotEditor =
                        ManageSlotEditorState(
                            slotId = null,
                            slotDate = ManageOrganizerProjection.isoDate(java.util.Date(System.currentTimeMillis() + DAY_MILLIS)),
                            slotLabel = "Dinner",
                            supportMode = "meal",
                            startTime = "17:00",
                            endTime = "19:00",
                        ),
                )
            }
        }

        fun startEditSlot(row: ManageSlotRow) {
            _state.update {
                it.copy(
                    slotEditor =
                        ManageSlotEditorState(
                            slotId = row.id,
                            slotDate = row.slotDate,
                            slotLabel = row.slotLabel,
                            supportMode = row.supportMode,
                            startTime = row.startTime?.take(5) ?: "17:00",
                            endTime = row.endTime?.take(5) ?: "19:00",
                        ),
                )
            }
        }

        fun updateSlotEditor(editor: ManageSlotEditorState) {
            _state.update { it.copy(slotEditor = editor) }
        }

        fun dismissSlotEditor() {
            _state.update { it.copy(slotEditor = null) }
        }

        /**
         * `POST /:id/slots` when adding, `PATCH /:id/slots/:slotId` when
         * editing. Times are sent as `HH:mm` per both Joi schemas.
         */
        fun saveSlot(editor: ManageSlotEditorState) {
            _state.update { it.copy(slotEditor = null) }
            val slotId = editor.slotId
            if (slotId == null) {
                runAction("Date added", "Couldn't add that date.") {
                    repo.addSlot(
                        trainId,
                        AddSupportTrainSlotBody(
                            slotDate = editor.slotDate,
                            slotLabel = editor.slotLabel,
                            supportMode = editor.supportMode,
                            startTime = editor.startTime,
                            endTime = editor.endTime,
                        ),
                    )
                }
            } else {
                runAction("Date updated", "Couldn't update that date.") {
                    repo.updateSlot(
                        trainId,
                        slotId,
                        UpdateSupportTrainSlotBody(
                            slotLabel = editor.slotLabel,
                            supportMode = editor.supportMode,
                            slotDate = editor.slotDate,
                            startTime = editor.startTime,
                            endTime = editor.endTime,
                        ),
                    )
                }
            }
        }

        /**
         * Removing a date is `PATCH … { status: "canceled" }` — the same
         * call RN makes (`support-trains/[id]/manage.tsx:302`).
         */
        fun cancelSlot(slotId: String) =
            runAction("Date removed", "Couldn't remove that date.") {
                repo.updateSlot(trainId, slotId, UpdateSupportTrainSlotBody(status = "canceled"))
            }

        /** Organizer-side cancel — sends `organizer_reason`. */
        fun removeHelper(
            reservationId: String,
            reason: String? = null,
        ) = runAction("Slot reopened", "Couldn't remove that helper.") {
            repo.cancelReservation(
                trainId,
                reservationId,
                CancelReservationBody(organizerReason = reason?.takeIf { it.isNotBlank() }),
            )
        }

        /**
         * Share the exact address with one helper (or email a guest
         * signup). The address never comes back in this response — the
         * reload re-runs the server-side privacy gate.
         */
        fun shareExactAddress(reservationId: String) =
            runAction("Exact location shared", "Couldn't share the exact location.") {
                repo.revealAddress(trainId, reservationId)
            }

        /** `POST /:id/reservations/:rid/confirm`. */
        fun confirmDelivery(reservationId: String) =
            runAction("Delivery confirmed", "Couldn't confirm that delivery.") {
                repo.confirmDelivery(trainId, reservationId)
            }

        /** `POST /:id/nudges/draft`. */
        fun draftNudge() {
            if (_state.value.isSubmitting) return
            _state.update { it.copy(isSubmitting = true) }
            viewModelScope.launch {
                when (val result = repo.draftNudge(trainId)) {
                    is NetworkResult.Success ->
                        _state.update { it.copy(isSubmitting = false, nudgeDraft = result.data) }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(
                                isSubmitting = false,
                                actionError = result.error.displayMessage("Couldn't draft a reminder."),
                            )
                        }
                }
            }
        }

        fun updateNudgeDraft(value: String) {
            _state.update { it.copy(nudgeDraft = value) }
        }

        fun discardNudge() {
            _state.update { it.copy(nudgeDraft = null) }
        }

        /** `POST /:id/nudges/send`. */
        fun sendNudge() {
            val message = _state.value.nudgeDraft?.trim().orEmpty()
            if (message.isEmpty() || _state.value.isSubmitting) return
            _state.update { it.copy(isSubmitting = true) }
            viewModelScope.launch {
                when (val result = repo.sendNudge(trainId, message)) {
                    is NetworkResult.Success ->
                        _state.update {
                            it.copy(
                                isSubmitting = false,
                                nudgeDraft = null,
                                toast = "Reminder posted to the campaign chat",
                            )
                        }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(
                                isSubmitting = false,
                                actionError = result.error.displayMessage("Couldn't send that reminder."),
                            )
                        }
                }
            }
        }

        fun updateFundGoal(value: String) {
            _state.update { it.copy(fundGoalDollars = value.filter { char -> char.isDigit() }) }
        }

        /** `POST /:id/fund/enable` — `goal_amount` is in cents. */
        fun enableFund() {
            val goalCents = _state.value.fundGoalDollars.toIntOrNull()?.times(CENTS_PER_DOLLAR)
            runAction("Gift fund enabled", "Couldn't enable the gift fund.") {
                repo.enableFund(trainId, goalCents)
            }
        }

        /** `POST /:id/fund/disable` — primary only. */
        fun disableFund() = runAction("Gift fund disabled", "Couldn't disable the gift fund.") { repo.disableFund(trainId) }

        fun requestConfirm(confirm: ManageDestructiveConfirm) {
            _state.update { it.copy(pendingConfirm = confirm) }
        }

        fun dismissConfirm() {
            _state.update { it.copy(pendingConfirm = null) }
        }

        /** Run one confirmed destructive action. */
        fun performConfirm(kind: ManageConfirmKind) {
            _state.update { it.copy(pendingConfirm = null) }
            when (kind) {
                ManageConfirmKind.UnpublishTrain -> unpublishTrain()
                ManageConfirmKind.ArchiveTrain -> archiveTrain()
                ManageConfirmKind.DeleteTrain -> deleteTrain()
                ManageConfirmKind.DisableFund -> disableFund()
                is ManageConfirmKind.CancelSlot -> cancelSlot(kind.slotId)
                is ManageConfirmKind.RemoveOrganizer -> removeOrganizer(kind.userId)
                is ManageConfirmKind.RemoveHelper -> removeHelper(kind.reservationId)
            }
        }

        fun acknowledgeActionError() {
            _state.update { it.copy(actionError = null) }
        }

        private fun runAction(
            success: String,
            failure: String,
            block: suspend () -> NetworkResult<Unit>,
        ) {
            if (_state.value.isSubmitting) return
            _state.update { it.copy(isSubmitting = true, pendingConfirm = null) }
            viewModelScope.launch {
                when (val result = block()) {
                    is NetworkResult.Success -> {
                        _state.update { it.copy(isSubmitting = false, toast = success) }
                        load()
                    }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(isSubmitting = false, actionError = result.error.displayMessage(failure))
                        }
                }
            }
        }

        companion object {
            /** Nav-arg key for the train id. Keep in sync with [TRAIN_ID_KEY] in `ChildRoutes`. */
            const val TRAIN_ID_KEY: String = "supportTrainId"
            private const val CENTS_PER_DOLLAR = 100
            private const val DAY_MILLIS = 24L * 60 * 60 * 1000
        }
    }
