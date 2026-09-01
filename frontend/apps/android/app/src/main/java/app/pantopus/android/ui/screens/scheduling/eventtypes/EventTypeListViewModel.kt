@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreateEventTypeRequest
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.UpdateEventTypeRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.MoneyAndFlag
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * B1 Event Type / Service list. One owner-polymorphic catalog: the user arrives
 * scoped to one owner — the route's ownerKind/ownerId query args carry the
 * hub's resolved owner (Personal when absent), and the identity pill just
 * renders it. [selectPillar] re-scopes via [HomesRepository]/[AuthRepository]
 * when invoked. The Active/Hidden segment filters by `is_active`, the per-row
 * toggle and the overflow menu (copy link / duplicate / share / hide / delete)
 * act through the repository. `DELETE` that returns `409 HAS_BOOKINGS` routes
 * into the deactivate-instead prompt (`PUT is_active=false`). Priced/business
 * price labels sit behind [SchedulingFeatureFlags].
 */
@HiltViewModel
class EventTypeListViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val homes: HomesRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
        private val flags: SchedulingFeatureFlags,
        private val ownerRelay: SchedulingEditorOwnerRelay,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private var owner: SchedulingOwner =
            SchedulingOwner.fromRoute(
                savedStateHandle[SchedulingRoutes.ARG_OWNER_KIND],
                savedStateHandle[SchedulingRoutes.ARG_OWNER_ID],
            )

        private val _pillar = MutableStateFlow(owner.pillar())
        val pillar: StateFlow<SchedulingPillar> = _pillar.asStateFlow()

        private val _tab = MutableStateFlow(EventTypeTab.Active)
        val tab: StateFlow<EventTypeTab> = _tab.asStateFlow()

        /** B1 FRAME 6 — reorder mode. Entered from the top-bar "Reorder" entry. */
        private val _reordering = MutableStateFlow(false)
        val reordering: StateFlow<Boolean> = _reordering.asStateFlow()

        private val _state = MutableStateFlow<EventTypeListUiState>(EventTypeListUiState.Loading)
        val state: StateFlow<EventTypeListUiState> = _state.asStateFlow()

        /** One-shot: a URL to hand to the system share sheet, then cleared. */
        private val _shareRequest = MutableStateFlow<String?>(null)
        val shareRequest: StateFlow<String?> = _shareRequest.asStateFlow()

        /** One-shot: a URL to copy to the clipboard, then cleared. */
        private val _copyRequest = MutableStateFlow<String?>(null)
        val copyRequest: StateFlow<String?> = _copyRequest.asStateFlow()

        /** When non-null, the row pending a destructive delete-confirm dialog (mirrors iOS `.alert`). */
        private val _deletePrompt = MutableStateFlow<EventTypeRowUi?>(null)
        val deletePrompt: StateFlow<EventTypeRowUi?> = _deletePrompt.asStateFlow()

        /** When non-null, the row whose delete hit `HAS_UPCOMING_BOOKINGS` → offer deactivate. */
        private val _deactivatePrompt = MutableStateFlow<EventTypeRowUi?>(null)
        val deactivatePrompt: StateFlow<EventTypeRowUi?> = _deactivatePrompt.asStateFlow()

        /** One-shot transient message (duplicate / errors). */
        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        /** One-shot: a route to navigate to (template quick-create → its editor). */
        private val _navRequest = MutableStateFlow<String?>(null)
        val navRequest: StateFlow<String?> = _navRequest.asStateFlow()

        private var started = false
        private var fetchJob: Job? = null

        private var allTypes: List<EventTypeDto> = emptyList()
        private var pageSlug: String? = null
        private var canEdit: Boolean = true

        fun start() {
            if (started) {
                refresh()
            } else {
                started = true
                load()
            }
        }

        fun load() {
            fetchJob?.cancel()
            fetchJob =
                viewModelScope.launch {
                    _state.value = EventTypeListUiState.Loading
                    fetch()
                }
        }

        fun refresh() {
            fetchJob?.cancel()
            fetchJob = viewModelScope.launch { fetch() }
        }

        fun selectPillar(target: SchedulingPillar) {
            if (target == _pillar.value) return
            _pillar.value = target
            fetchJob?.cancel()
            fetchJob =
                viewModelScope.launch {
                    _state.value = EventTypeListUiState.Loading
                    val resolved = resolveOwner(target)
                    if (resolved == null) {
                        _state.value = EventTypeListUiState.Error(noOwnerMessage(target))
                        return@launch
                    }
                    owner = resolved
                    fetch()
                }
        }

        fun selectTab(target: EventTypeTab) {
            if (target == _tab.value) return
            _tab.value = target
            rebuild()
        }

        // ─── Reorder mode (design event-types-frames.jsx FRAME 6; web
        //     event-types/page.tsx is the behavioral reference) ────────────────

        fun startReorder() {
            if (!canEdit) return
            _reordering.value = true
        }

        /** Hint-bar "Done" — persist any outstanding order change and exit. */
        fun doneReordering() {
            _reordering.value = false
            persistOrder()
        }

        /**
         * Live-preview move while dragging: splice the dragged row to the
         * hovered row's position in the FULL catalog (the visible list is a
         * filtered projection whose relative order matches), mirroring the
         * web's `moveDragged`.
         */
        fun moveRow(
            draggedId: String,
            overId: String,
        ) {
            if (draggedId == overId) return
            val from = allTypes.indexOfFirst { it.id == draggedId }
            val to = allTypes.indexOfFirst { it.id == overId }
            if (from < 0 || to < 0 || from == to) return
            allTypes =
                allTypes.toMutableList().apply {
                    add(to, removeAt(from))
                }
            rebuild()
        }

        /**
         * Persist every row whose position no longer matches its stored
         * `sort_order` via `PUT /event-types/:id {sort_order}` — optimistic
         * local stamp, refetch on any failure (web `persistOrder`).
         */
        fun persistOrder() {
            val changed =
                allTypes.mapIndexedNotNull { index, dto ->
                    if (dto.sortOrder != index) dto.id to index else null
                }
            if (changed.isEmpty()) return
            allTypes = allTypes.mapIndexed { index, dto -> dto.copy(sortOrder = index) }
            viewModelScope.launch {
                val results =
                    changed.map { (id, index) ->
                        async { repo.updateEventType(owner, id, UpdateEventTypeRequest(sortOrder = index)) }
                    }.map { it.await() }
                if (results.any { it is NetworkResult.Failure }) {
                    _toast.value = "Couldn't save the new order."
                    refresh()
                }
            }
        }

        private suspend fun resolveOwner(target: SchedulingPillar): SchedulingOwner? =
            when (target) {
                SchedulingPillar.Personal -> SchedulingOwner.Personal
                SchedulingPillar.Home ->
                    when (val r = homes.myHomes()) {
                        is NetworkResult.Success -> r.data.homes.firstOrNull()?.id?.let { SchedulingOwner.Home(it) }
                        is NetworkResult.Failure -> null
                    }
                SchedulingPillar.Business ->
                    (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id?.let { SchedulingOwner.Business(it) }
            }

        private suspend fun fetch() {
            canEdit = true
            // Booking-page slug (for per-event-type share links); failures are non-fatal.
            pageSlug = repo.getBookingPage(owner).dataOrNull()?.page?.slug

            when (val result = repo.getEventTypes(owner)) {
                is NetworkResult.Success -> {
                    allTypes = result.data.eventTypes.sortedBy { it.sortOrder ?: Int.MAX_VALUE }
                    rebuild()
                }
                is NetworkResult.Failure -> {
                    val decoded = errors.decode(result.error)
                    if (decoded is SchedulingError.Secret) {
                        // Gated owner (403): render the read-only catalog with a lock banner
                        // instead of a full-screen Error (design FrameGated). The list endpoint
                        // returns no rows on 403, so the banner sits above whatever loaded.
                        canEdit = false
                        allTypes = emptyList()
                        rebuild()
                    } else {
                        canEdit = true
                        _state.value = EventTypeListUiState.Error(decoded.listMessage())
                    }
                }
            }
        }

        private fun rebuild() {
            val pillar = _pillar.value
            val active = allTypes.filter { it.isActive != false }
            val hidden = allTypes.filter { it.isActive == false }
            val visible = if (_tab.value == EventTypeTab.Active) active else hidden
            _state.value =
                EventTypeListUiState.Content(
                    pillar = pillar,
                    tab = _tab.value,
                    rows = visible.map { it.toRowUi(pillar) },
                    activeCount = active.size,
                    hiddenCount = hidden.size,
                    canEdit = canEdit,
                )
        }

        // ─── Row actions ──────────────────────────────────────────────────────

        fun toggleActive(
            id: String,
            active: Boolean,
        ) {
            if (!canEdit) return
            val target = allTypes.firstOrNull { it.id == id } ?: return
            allTypes = allTypes.map { if (it.id == id) it.copy(isActive = active) else it }
            rebuild()
            viewModelScope.launch {
                when (val r = repo.updateEventType(owner, id, UpdateEventTypeRequest(isActive = active))) {
                    is NetworkResult.Success ->
                        allTypes = allTypes.map { if (it.id == id) r.data.eventType else it }
                    is NetworkResult.Failure -> {
                        allTypes = allTypes.map { if (it.id == id) target else it }
                        rebuild()
                        _toast.value = "Couldn't update ${target.name}."
                    }
                }
            }
        }

        fun duplicate(id: String) {
            val src = allTypes.firstOrNull { it.id == id } ?: return
            viewModelScope.launch {
                // Carry the FULL scheduling config — buffers, notice, horizon,
                // caps, interval, pricing, policies, schedule binding — not just
                // the display fields, so a duplicate behaves like its source.
                val body =
                    CreateEventTypeRequest(
                        name = "${src.name} copy",
                        slug = uniqueSlug("${src.slug}-copy"),
                        durations = src.durations.ifEmpty { listOf(src.defaultDuration ?: DEFAULT_DURATION) },
                        description = src.description,
                        color = src.color,
                        defaultDuration = src.defaultDuration,
                        locationMode = src.locationMode,
                        locationDetail = src.locationDetail,
                        assignmentMode = src.assignmentMode,
                        visibility = src.visibility,
                        requiresApproval = src.requiresApproval,
                        bufferBeforeMin = src.bufferBeforeMin,
                        bufferAfterMin = src.bufferAfterMin,
                        minNoticeMin = src.minNoticeMin,
                        maxHorizonDays = src.maxHorizonDays,
                        slotIntervalMin = src.slotIntervalMin,
                        dailyCap = src.dailyCap,
                        perBookerCap = src.perBookerCap,
                        seatCap = src.seatCap,
                        priceCents = src.priceCents,
                        currency = src.currency,
                        depositCents = src.depositCents,
                        depositRefundable = src.depositRefundable,
                        cancellationWindowMin = src.cancellationWindowMin,
                        rescheduleCutoffMin = src.rescheduleCutoffMin,
                        noShowFeeCents = src.noShowFeeCents,
                        refundPolicy = src.refundPolicy,
                        allowInviteeCancel = src.allowInviteeCancel,
                        allowInviteeReschedule = src.allowInviteeReschedule,
                        scheduleId = src.scheduleId,
                    )
                when (val r = repo.createEventType(owner, body)) {
                    is NetworkResult.Success -> {
                        _toast.value = "Duplicated"
                        refresh()
                    }
                    is NetworkResult.Failure -> _toast.value = "Couldn't duplicate ${src.name}."
                }
            }
        }

        /** Row tap on "Delete" → open the destructive-confirm dialog first (mirrors iOS). */
        fun requestDelete(id: String) {
            if (!canEdit) return
            val target = allTypes.firstOrNull { it.id == id } ?: return
            _deletePrompt.value = target.toRowUi(_pillar.value)
        }

        fun dismissDelete() {
            _deletePrompt.value = null
        }

        /** Confirm path from the delete-confirm dialog — run the actual delete. */
        fun confirmDelete() {
            val id = _deletePrompt.value?.id ?: return
            _deletePrompt.value = null
            delete(id)
        }

        private fun delete(id: String) {
            if (!canEdit) return
            val target = allTypes.firstOrNull { it.id == id } ?: return
            viewModelScope.launch {
                when (val r = repo.deleteEventType(owner, id)) {
                    is NetworkResult.Success -> {
                        allTypes = allTypes.filterNot { it.id == id }
                        rebuild()
                    }
                    is NetworkResult.Failure -> {
                        val decoded = errors.decode(r.error)
                        if (decoded is SchedulingError.Generic && decoded.code == CODE_HAS_UPCOMING) {
                            _deactivatePrompt.value = target.toRowUi(_pillar.value)
                        } else {
                            _toast.value = "Couldn't delete ${target.name}."
                        }
                    }
                }
            }
        }

        /** Confirm path from the `HAS_UPCOMING_BOOKINGS` prompt — deactivate instead. */
        fun confirmDeactivate() {
            val row = _deactivatePrompt.value ?: return
            _deactivatePrompt.value = null
            toggleActive(row.id, active = false)
        }

        /** Empty-state template chip → quick-create with [minutes], then open its editor. */
        fun createFromTemplate(minutes: Int) {
            viewModelScope.launch {
                val body =
                    CreateEventTypeRequest(
                        name = "$minutes minute meeting",
                        slug = uniqueSlug("$minutes-min-meeting"),
                        durations = listOf(minutes),
                        defaultDuration = minutes,
                        locationMode = "video",
                    )
                when (val r = repo.createEventType(owner, body)) {
                    is NetworkResult.Success -> _navRequest.value = editorRoute(r.data.eventType.id)
                    is NetworkResult.Failure -> _toast.value = "Couldn't create event type."
                }
            }
        }

        fun navRequestConsumed() {
            _navRequest.value = null
        }

        fun dismissDeactivate() {
            _deactivatePrompt.value = null
        }

        fun copyLink(id: String) {
            shareUrlFor(id)?.let { _copyRequest.value = it } ?: run { _toast.value = "Set up your booking link first." }
        }

        fun share(id: String) {
            shareUrlFor(id)?.let { _shareRequest.value = it } ?: run { _toast.value = "Set up your booking link first." }
        }

        fun shareRequestConsumed() {
            _shareRequest.value = null
        }

        fun copyRequestConsumed() {
            _copyRequest.value = null
        }

        fun toastConsumed() {
            _toast.value = null
        }

        // ─── Navigation routes ──────────────────────────────────────────────────

        fun createRoute(): String {
            ownerRelay.pending = owner
            return SchedulingRoutes.eventTypeEditor(NEW_EVENT_TYPE_ID)
        }

        fun editorRoute(id: String): String {
            ownerRelay.pending = owner
            return SchedulingRoutes.eventTypeEditor(id)
        }

        // ─── Helpers ────────────────────────────────────────────────────────────

        private fun shareUrlFor(id: String): String? {
            val slug = pageSlug ?: return null
            val type = allTypes.firstOrNull { it.id == id } ?: return null
            return "https://pantopus.com/book/$slug/${type.slug}"
        }

        private fun uniqueSlug(base: String): String {
            val taken = allTypes.map { it.slug }.toSet()
            if (base !in taken) return base
            var n = 2
            while ("$base-$n" in taken) n++
            return "$base-$n"
        }

        private fun EventTypeDto.toRowUi(pillar: SchedulingPillar): EventTypeRowUi {
            val mins = defaultDuration ?: durations.firstOrNull()
            val meta = listOfNotNull(mins?.let { "$it min" }, locationShort(locationMode)).joinToString(" · ")
            val showPrice = pillar == SchedulingPillar.Business && flags.paidSchedulingEnabled
            return EventTypeRowUi(
                id = id,
                name = name,
                meta = meta,
                colorHex = color,
                isActive = isActive != false,
                isSecret = visibility == VISIBILITY_SECRET,
                priceLabel = if (showPrice) MoneyAndFlag.formatPrice(priceCents, currency) else null,
                slug = slug,
                hostsBadge = hostsBadge(),
            )
        }

        /** "N hosts" for team rows (mirrors web `isTeam` + iOS `hostsBadge(for:)`). */
        private fun EventTypeDto.hostsBadge(): String? {
            if (assignmentMode !in TEAM_MODES) return null
            val count = assigneeCount ?: return null
            if (count <= 0) return null
            return if (count == 1) "1 host" else "$count hosts"
        }

        private fun noOwnerMessage(target: SchedulingPillar): String =
            when (target) {
                SchedulingPillar.Home -> "No household yet. Create one to add bookable event types."
                SchedulingPillar.Business -> "Couldn't load your business services."
                SchedulingPillar.Personal -> "Couldn't load your event types."
            }

        private fun SchedulingError.listMessage(): String =
            when (this) {
                is SchedulingError.Secret -> "Only owners can edit this catalog."
                is SchedulingError.Generic -> message
                else -> "Couldn't load your event types."
            }

        private fun <T> NetworkResult<T>.dataOrNull(): T? = (this as? NetworkResult.Success)?.data

        companion object {
            const val NEW_EVENT_TYPE_ID = "new"

            // Wire truth: backend DELETE /event-types/:id emits HAS_BOOKINGS. The previous
            // value (HAS_UPCOMING_BOOKINGS) matched nothing, so the "hide instead" prompt
            // never appeared and deletes surfaced as generic failures.
            private const val CODE_HAS_UPCOMING = "HAS_BOOKINGS"
            private const val VISIBILITY_SECRET = "secret"
            private const val DEFAULT_DURATION = 30

            /** Assignment modes that carry a host roster (mirrors web `isTeam`). */
            private val TEAM_MODES = setOf("round_robin", "collective", "group")
        }
    }

private fun locationShort(mode: String?): String =
    when (mode) {
        "video" -> "Video"
        "phone" -> "Phone"
        "in_person" -> "In person"
        "custom" -> "Custom"
        "ask" -> "Ask invitee"
        else -> ""
    }
