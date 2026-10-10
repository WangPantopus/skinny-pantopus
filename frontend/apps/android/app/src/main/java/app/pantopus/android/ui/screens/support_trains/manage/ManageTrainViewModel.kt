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
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.support_trains.detail.SupportTrainViewerRole
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.Job
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
    /** Organizer controls and private replies belong only to the current checked visit. */
    val privateDetailsAvailable: Boolean = true,
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
    /** True when that read failed: the Helpers section says so instead of "No signups yet". */
    val helpersFailed: Boolean = false,
    /** Null while the existing reservation read cannot establish delivery counts. */
    val deliveredMeals: Int? = null,
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
    val refreshing: Boolean = false,
    val refreshNotice: RefreshNotice? = null,
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
            !isSubmitting && draftMessage.trim().isNotEmpty() &&
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
        sessionScopes: HomeClaimSessionScopeFactory,
    ) : ViewModel() {
        private val trainId: String =
            savedStateHandle.get<String>(TRAIN_ID_KEY).orEmpty()

        private val _state = MutableStateFlow(ManageTrainUiState(state = summary()))
        val state: StateFlow<ManageTrainUiState> = _state.asStateFlow()
        private var updateRequestId = java.util.UUID.randomUUID().toString()
        private val closeRequestId = java.util.UUID.randomUUID().toString()
        private val session = sessionScopes.create(viewModelScope)
        private var active = true
        private var readVersion = 0L
        private var readJob: Job? = null
        private var formInitialized = false

        init {
            viewModelScope.launch {
                session.invalidated.collect { ended ->
                    if (ended) {
                        suspendContent()
                        _state.value = ManageTrainUiState()
                    }
                }
            }
        }

        private fun summary(): ManageTrainState =
            repo.detailCopy(trainId).data?.let {
                ManageTrainState.Loaded(ManageTrainProjection.project(it).copy(privateDetailsAvailable = false))
            } ?: ManageTrainState.Loading

        /** Keep the unsent forms, but discard the recipient, helper, organizer and fund responses. */
        fun suspendContent() {
            if (!active) return
            active = false
            readVersion++
            readJob?.cancel()
            _state.update {
                it.copy(
                    state = if (session.isCurrent) summary() else ManageTrainState.Loading,
                    helperRows = emptyList(), organizerRows = emptyList(), fund = null, deliveredMeals = null,
                    slotRows = emptyList(), helpersFailed = false, pendingConfirm = null,
                    toast = null, actionError = null, refreshing = false, refreshNotice = null,
                )
            }
        }

        private suspend fun current(version: Long): Boolean {
            val allowed = session.confirmCurrent()
            return active && version == readVersion && allowed
        }

        fun refresh() {
            _state.update { it.copy(refreshing = it.state is ManageTrainState.Loaded) }
            load()
        }

        fun refreshFromSignal() {
            if (active && !repo.detailIsCurrent(trainId)) load()
        }

        private val canAct: Boolean
            get() = active && session.isCurrent &&
                (_state.value.state as? ManageTrainState.Loaded)?.content?.privateDetailsAvailable == true

        /** A completed write can settle an unsent form while paused, but cannot cross sign-out. */
        private suspend fun <T> checkedAction(block: suspend () -> NetworkResult<T>): NetworkResult<T>? {
            if (!session.confirmCurrent()) return null
            val result = block()
            return result.takeIf { session.confirmCurrent() }
        }

        /**
         * Load the dashboard. With a `seed` (previews / tests) it renders
         * directly; otherwise it fetches `GET /:id` and projects it.
         */
        fun load(seed: ManageTrainContent? = null) {
            active = true
            readJob?.cancel()
            val version = ++readVersion
            if (seed != null) {
                applyContent(seed)
                return
            }
            // Keep an already-loaded dashboard on screen while refreshing
            // (an organizer action re-runs `load()`); mirrors iOS.
            _state.update {
                if (it.state is ManageTrainState.Loaded) {
                    it.copy(deliveredMeals = null)
                } else {
                    it.copy(state = ManageTrainState.Loading, deliveredMeals = null)
                }
            }
            readJob = viewModelScope.launch {
                try {
                    if (!current(version)) return@launch
                    val result = repo.detail(trainId)
                    if (!current(version)) return@launch
                    when (result) {
                    is NetworkResult.Success -> {
                        applyContent(ManageTrainProjection.project(result.data))
                        val slots = ManageOrganizerProjection.slotRows(result.data.slots ?: emptyList())
                        _state.update { it.copy(slotRows = slots) }
                        if (result.data.viewerIsOrganizer) loadOrganizerSurfaces(slots, version)
                    }
                    is NetworkResult.Failure -> showReadFailure(result)
                    }
                } finally {
                    if (version == readVersion) _state.update { it.copy(refreshing = false) }
                }
            }
        }

        private fun showReadFailure(result: NetworkResult.Failure) {
            val copy = repo.detailCopy(trainId)
            val safe = summary()
            _state.update {
                it.copy(
                    state = if (!result.error.refusesStoredCopy && safe is ManageTrainState.Loaded) {
                        safe
                    } else {
                        ManageTrainState.Error(result.error.displayMessage("Couldn't load this train."))
                    },
                    helperRows = emptyList(), organizerRows = emptyList(), fund = null, deliveredMeals = null,
                    refreshNotice = RefreshNotice(copy.fetchedAt) { refresh() }.takeIf {
                        copy.data != null && System.currentTimeMillis() - copy.fetchedAt > StoreKind.SUPPORT_TRAINS.maxShownAgeMs
                    },
                )
            }
        }

        /**
         * Fan-out for the organizer-only feeds. Failures degrade to empty
         * sections instead of blowing up the whole screen.
         */
        @Suppress("CyclomaticComplexMethod")
        private suspend fun loadOrganizerSurfaces(slots: List<ManageSlotRow>, version: Long) {
            val reservationsResult = repo.reservations(trainId)
            if (!current(version)) return
            val reservations =
                when (reservationsResult) {
                    is NetworkResult.Success -> reservationsResult.data.reservations
                    is NetworkResult.Failure -> emptyList()
                }
            val organizersResult = repo.organizers(trainId)
            if (!current(version)) return
            val organizers =
                when (val result = organizersResult) {
                    is NetworkResult.Success -> result.data.organizers
                    is NetworkResult.Failure -> emptyList()
                }
            val fundResult = repo.fund(trainId)
            if (!current(version)) return
            val fund =
                when (val result = fundResult) {
                    is NetworkResult.Success -> result.data
                    is NetworkResult.Failure -> null
                }
            val helperIds =
                reservations.filter { it.status != "canceled" }.map { row ->
                    if (row.status !in listOf("reserved", "delivered", "confirmed")) {
                        null
                    } else {
                        (row.helperUser?.id ?: row.userId)?.takeIf { it.isNotBlank() }?.let { "user:$it" }
                            ?: row.guestEmail?.trim()?.takeIf { it.isNotEmpty() }?.lowercase()?.let { "guest:$it" }
                    }
                }
            val helperCount =
                if (reservationsResult is NetworkResult.Success && helperIds.none { it == null }) {
                    helperIds.filterNotNull().distinct().size.toString()
                } else {
                    "—"
                }
            _state.update {
                val loaded = (it.state as? ManageTrainState.Loaded)?.content
                it.copy(
                    state =
                        loaded?.let { content ->
                            ManageTrainState.Loaded(
                                content.copy(
                                    helpersValue = helperCount,
                                    audienceChips =
                                        content.audienceChips.map { chip ->
                                            if (chip.id == "all") chip.copy(count = helperCount) else chip
                                        },
                                    close = content.close.copy(neighborsHelped = helperCount),
                                ),
                            )
                        } ?: it.state,
                    helperRows = ManageOrganizerProjection.helperRows(reservations, slots),
                    helpersFailed = reservationsResult is NetworkResult.Failure,
                    deliveredMeals =
                        if (reservationsResult is NetworkResult.Success) {
                            reservations.count {
                                it.status in listOf("delivered", "confirmed") && it.contributionMode in listOf("cook", "takeout")
                            }
                        } else {
                            null
                        },
                    organizerRows = ManageOrganizerProjection.organizerRows(organizers),
                    fund = fund,
                )
            }
        }

        private fun applyContent(content: ManageTrainContent) {
            _state.update { current ->
                current.copy(
                    state = ManageTrainState.Loaded(content),
                    draftMessage = if (formInitialized) current.draftMessage else content.draftMessage,
                    selectedAudienceId = if (formInitialized) current.selectedAudienceId else content.selectedAudienceId,
                    pushToPhones = if (formInitialized) current.pushToPhones else content.pushToPhones,
                    refreshNotice = null,
                )
            }
            formInitialized = true
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
         * Keeps the draft until its receipt confirms the text and delivery choice.
         */
        fun sendUpdate() {
            val current = _state.value
            if (!current.canSendUpdate || !canAct) return
            val content = (current.state as? ManageTrainState.Loaded)?.content ?: return
            val body = current.draftMessage
            val helperCount =
                content.audienceChips.firstOrNull { it.id == current.selectedAudienceId }?.count
                    ?: content.helpersValue
            _state.update { it.copy(isSubmitting = true, actionError = null, toast = null) }
            viewModelScope.launch {
                when (
                    val result =
                        checkedAction {
                            repo.postUpdate(
                                trainId,
                                SupportTrainUpdateBody(body = body, clientRequestId = updateRequestId, pushToPhones = current.pushToPhones),
                            )
                        } ?: return@launch
                ) {
                    is NetworkResult.Success -> {
                        updateRequestId = java.util.UUID.randomUUID().toString()
                        _state.update {
                            it.copy(
                                isSubmitting = false,
                                draftMessage = if (it.draftMessage == body) "" else it.draftMessage,
                                toast = "Update sent · $helperCount helpers",
                            )
                        }
                    }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(isSubmitting = false, actionError = result.error.displayMessage("Couldn't send that update."))
                        }
                }
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
            if (_state.value.isSubmitting) return
            _state.update { it.copy(sheetMode = ManageTrainSheetMode.HIDDEN) }
        }

        fun updateThankYouNote(value: String) {
            if (_state.value.isSubmitting) return
            _state.update { it.copy(thankYouNote = value) }
        }

        /** Keep the confirmation open until both the optional thanks and close are confirmed. */
        fun confirmClose() {
            val current = _state.value
            val content = (current.state as? ManageTrainState.Loaded)?.content?.takeIf { !current.isSubmitting && canAct } ?: return
            val note = current.thankYouNote.trim()
            _state.update { it.copy(isSubmitting = true, actionError = null, toast = null) }
            viewModelScope.launch {
                if (note.isNotEmpty()) {
                    when (val result = checkedAction {
                        repo.postUpdate(trainId, SupportTrainUpdateBody(body = note, clientRequestId = closeRequestId))
                    } ?: return@launch) {
                        is NetworkResult.Success -> Unit
                        is NetworkResult.Failure -> {
                            _state.update {
                                it.copy(
                                    isSubmitting = false,
                                    actionError = result.error.displayMessage("Couldn't send the thank-you note."),
                                )
                            }
                            return@launch
                        }
                    }
                }
                when (val result = checkedAction { repo.complete(trainId) } ?: return@launch) {
                    is NetworkResult.Success ->
                        _state.update {
                            it.copy(
                                isSubmitting = false,
                                state = if (canAct) {
                                    ManageTrainState.Loaded(content.copy(isActive = false, status = "completed"))
                                } else {
                                    it.state
                                },
                                sheetMode = ManageTrainSheetMode.CLOSED,
                                toast =
                                    if (note.isEmpty()) {
                                        "Train closed"
                                    } else {
                                        "Train closed · thanks sent to ${content.helpersValue} helpers"
                                    },
                            )
                        }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(
                                isSubmitting = false,
                                actionError = result.error.displayMessage("Couldn't close this train."),
                            )
                        }
                }
            }
        }

        // ─── S1 · organizer actions ────────────────────────────────────

        /**
         * `POST /:id/publish` — a draft (back from Unpublish) goes live again;
         * primary or co-organizer. The server's 422s surface verbatim.
         */
        fun publishTrain() = runAction("Train published", "Couldn't publish this train.") { repo.publish(trainId) }

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
            if (_state.value.isSubmitting || !canAct) return
            _state.update { it.copy(isSubmitting = true, pendingConfirm = null) }
            viewModelScope.launch {
                when (val result = checkedAction { repo.deleteTrain(trainId) } ?: return@launch) {
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

        /** `POST /:id/organizers` — primary only; [userId] comes from the people picker. */
        fun addOrganizer(userId: String) {
            if (userId.isBlank()) return
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
            if (_state.value.isSubmitting) return
            _state.update { it.copy(slotEditor = null) }
        }

        /**
         * `POST /:id/slots` when adding, `PATCH /:id/slots/:slotId` when
         * editing. Times are sent as `HH:mm` per both Joi schemas.
         */
        fun saveSlot(editor: ManageSlotEditorState) {
            if (_state.value.isSubmitting) return
            _state.update { it.copy(slotEditor = editor) }
            val dismissOnSuccess = { _state.update { it.copy(slotEditor = null) } }
            val slotId = editor.slotId
            if (slotId == null) {
                runAction("Date added", "Couldn't add that date.", onSuccess = dismissOnSuccess) {
                    repo.addSlot(
                        trainId,
                        AddSupportTrainSlotBody(
                            slotDate = editor.slotDate,
                            slotLabel = editor.slotLabel,
                            supportMode = editor.supportMode,
                            startTime = editor.startTime,
                            endTime = editor.endTime,
                            clientRequestId = editor.clientRequestId,
                        ),
                    )
                }
            } else {
                runAction("Date updated", "Couldn't update that date.", onSuccess = dismissOnSuccess) {
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
            if (_state.value.isSubmitting || !canAct) return
            _state.update { it.copy(isSubmitting = true) }
            viewModelScope.launch {
                when (val result = checkedAction { repo.draftNudge(trainId) } ?: return@launch) {
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
            if (message.isEmpty() || _state.value.isSubmitting || !canAct) return
            _state.update { it.copy(isSubmitting = true) }
            viewModelScope.launch {
                when (val result = checkedAction { repo.sendNudge(trainId, message) } ?: return@launch) {
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
            onSuccess: () -> Unit = {},
            block: suspend () -> NetworkResult<Unit>,
        ) {
            if (_state.value.isSubmitting || !canAct) return
            _state.update { it.copy(isSubmitting = true, pendingConfirm = null, actionError = null) }
            viewModelScope.launch {
                when (val result = checkedAction { block() } ?: return@launch) {
                    is NetworkResult.Success -> {
                        onSuccess()
                        _state.update { it.copy(isSubmitting = false, toast = success) }
                        if (active) load()
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
