@file:Suppress("PackageNaming", "TooManyFunctions", "LongParameterList", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreateEventTypeRequest
import app.pantopus.android.data.api.models.scheduling.UpdateEventTypeRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.MoneyAndFlag
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * B2 Event Type / Service editor view-model. Reads `eventTypeId` from
 * [SavedStateHandle]: `"new"` → create (Personal pillar); otherwise load via
 * `GET /event-types/:id` and derive the pillar from the DTO's `owner_type`.
 * Saves through `POST`/`PUT /event-types` (partial). `409 SLUG_TAKEN` and
 * `Validation` map to inline field errors; pricing is gated by
 * [SchedulingFeatureFlags].
 */
@HiltViewModel
class EventTypeEditorViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        private val flags: SchedulingFeatureFlags,
        private val ownerRelay: SchedulingEditorOwnerRelay,
    ) : ViewModel() {
        private val eventTypeId: String = savedStateHandle.get<String>(SchedulingRoutes.ARG_EVENT_TYPE_ID).orEmpty()
        private val isCreate: Boolean = eventTypeId.isEmpty() || eventTypeId == EventTypeListViewModel.NEW_EVENT_TYPE_ID

        private val _state = MutableStateFlow<EventTypeEditorUiState>(EventTypeEditorUiState.Loading)
        val state: StateFlow<EventTypeEditorUiState> = _state.asStateFlow()

        /** One-shot: true after a successful save → the screen pops back. */
        private val _saved = MutableStateFlow(false)
        val saved: StateFlow<Boolean> = _saved.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var pillar: SchedulingPillar = SchedulingPillar.Personal
        private var form = EditorForm()
        private var original = EditorForm()
        private var advancedOpen = false
        private var saving = false
        private var serverNameError: String? = null
        private var questionCount: Int? = null
        private var stripeConnected = false
        private var started = false

        fun start() {
            if (started) return
            started = true
            // The arg-less A0 route carries no owner; the list hands it over via the relay.
            owner = ownerRelay.consume() ?: SchedulingOwner.Personal
            pillar = ownerPillarOf(owner)
            if (isCreate) {
                form = EditorForm()
                original = form
                maybeLoadStripe()
                render()
            } else {
                load()
            }
        }

        fun load() {
            viewModelScope.launch {
                _state.value = EventTypeEditorUiState.Loading
                when (val r = repo.getEventType(owner, eventTypeId)) {
                    is NetworkResult.Success -> {
                        val dto = r.data.eventType
                        pillar = ownerPillar(dto.ownerType)
                        // The loaded DTO's owner is authoritative — overrides the relay hint.
                        owner =
                            when {
                                pillar == SchedulingPillar.Business && dto.ownerId != null -> SchedulingOwner.Business(dto.ownerId)
                                pillar == SchedulingPillar.Home && dto.ownerId != null -> SchedulingOwner.Home(dto.ownerId)
                                else -> SchedulingOwner.Personal
                            }
                        form = dto.toForm()
                        original = form
                        questionCount = r.data.questions.size
                        maybeLoadStripe()
                        render()
                    }
                    is NetworkResult.Failure ->
                        _state.value = EventTypeEditorUiState.Error(errors.decode(r.error).editorMessage())
                }
            }
        }

        private fun maybeLoadStripe() {
            if (pillar != SchedulingPillar.Business || !flags.paidSchedulingEnabled) return
            viewModelScope.launch {
                stripeConnected =
                    (repo.getPaymentsStatus(owner) as? NetworkResult.Success)?.data?.chargesEnabled == true
                render()
            }
        }

        // ─── Field edits ────────────────────────────────────────────────────────

        private fun update(block: (EditorForm) -> EditorForm) {
            form = block(form)
            serverNameError = null
            render()
        }

        fun onName(value: String) = update { it.copy(name = value) }

        fun onDescription(value: String) = update { it.copy(description = value) }

        fun onColor(hex: String) = update { it.copy(color = hex) }

        fun onModeChange(multiple: Boolean) =
            update {
                if (multiple) {
                    it.copy(multiple = true)
                } else {
                    it.copy(multiple = false, durations = listOf(it.defaultDuration))
                }
            }

        fun onDurationStep(delta: Int) =
            update {
                val next = (it.defaultDuration + delta).coerceIn(DURATION_MIN, DURATION_MAX)
                it.copy(defaultDuration = next, durations = if (it.multiple) it.durations else listOf(next))
            }

        fun onDurationPreset(minutes: Int) =
            update { f ->
                if (f.multiple) {
                    val set = if (minutes in f.durations) f.durations - minutes else f.durations + minutes
                    val sorted = set.distinct().sorted().ifEmpty { listOf(f.defaultDuration) }
                    f.copy(durations = sorted, defaultDuration = sorted.min())
                } else {
                    f.copy(defaultDuration = minutes, durations = listOf(minutes))
                }
            }

        fun onLocationMode(mode: String) = update { it.copy(locationMode = mode) }

        fun onLocationDetail(value: String) = update { it.copy(locationDetail = value) }

        fun onRequiresApproval(value: Boolean) = update { it.copy(requiresApproval = value) }

        fun onVisibilitySecret(value: Boolean) = update { it.copy(visibilitySecret = value) }

        fun onActive(value: Boolean) = update { it.copy(isActive = value) }

        fun onBufferBeforeStep(delta: Int) = update { it.copy(bufferBeforeMin = (it.bufferBeforeMin + delta).coerceIn(0, 720)) }

        fun onBufferAfterStep(delta: Int) = update { it.copy(bufferAfterMin = (it.bufferAfterMin + delta).coerceIn(0, 720)) }

        fun onNoticeStep(deltaHours: Int) = update { it.copy(minNoticeMin = (it.minNoticeMin + deltaHours * 60).coerceAtLeast(0)) }

        fun onHorizonStep(deltaDays: Int) = update { it.copy(maxHorizonDays = (it.maxHorizonDays + deltaDays).coerceIn(1, 730)) }

        fun onDailyCapStep(delta: Int) =
            update {
                val next = (it.dailyCap ?: 0) + delta
                it.copy(dailyCap = if (next <= 0) null else next)
            }

        fun onAssignmentMode(mode: String) = update { it.copy(assignmentMode = mode) }

        fun onChargeEnabled(value: Boolean) = update { it.copy(chargeEnabled = value) }

        fun onPrice(dollars: String) =
            update {
                val sanitized = dollars.filter { c -> c.isDigit() || c == '.' || c == ',' }
                val cents = MoneyAndFlag.parseCents(sanitized) ?: 0
                // Keep the deposit at half the new price while Deposit mode is on.
                it.copy(
                    priceText = sanitized,
                    priceCents = cents,
                    depositCents = if (it.collectDeposit) cents / 2 else it.depositCents,
                )
            }

        fun onCurrency(code: String) = update { it.copy(currency = code) }

        // Collect = Full amount (deposit cleared) vs Deposit (default half the price).
        fun onCollectMode(deposit: Boolean) =
            update {
                if (deposit) it.copy(depositCents = (it.priceCents / 2).coerceAtLeast(1)) else it.copy(depositCents = null)
            }

        fun toggleAdvanced() {
            advancedOpen = !advancedOpen
            render()
        }

        // ─── Save ────────────────────────────────────────────────────────────────

        fun save() {
            val f = form
            if (!f.isValid || saving) return
            saving = true
            serverNameError = null
            render()
            viewModelScope.launch {
                val result =
                    if (isCreate) {
                        repo.createEventType(owner, f.toCreateRequest())
                    } else {
                        repo.updateEventType(owner, eventTypeId, f.toUpdateRequest())
                    }
                when (result) {
                    is NetworkResult.Success -> {
                        original = form
                        _saved.value = true
                    }
                    is NetworkResult.Failure -> {
                        saving = false
                        applyError(errors.decode(result.error))
                        render()
                    }
                }
            }
        }

        private fun applyError(error: SchedulingError) {
            when (error) {
                is SchedulingError.SlugTaken ->
                    serverNameError =
                        if (error.suggestions.isNotEmpty()) {
                            "That booking link is taken. Try: ${error.suggestions.take(3).joinToString(", ")}"
                        } else {
                            "That booking link is already taken. Try a different name."
                        }
                is SchedulingError.Validation -> {
                    val field = error.details.firstOrNull()
                    when {
                        field?.field?.contains("slug", ignoreCase = true) == true ||
                            field?.field?.contains("name", ignoreCase = true) == true ->
                            serverNameError = field.message
                        else -> _toast.value = field?.message ?: "Please check your entries."
                    }
                }
                is SchedulingError.Generic -> _toast.value = error.message
                else -> _toast.value = "Couldn't save. Try again."
            }
        }

        fun savedConsumed() {
            _saved.value = false
        }

        fun toastConsumed() {
            _toast.value = null
        }

        // ─── Navigation routes ──────────────────────────────────────────────────

        fun intakeRoute(): String {
            ownerRelay.pending = owner // hand the resolved owner to the intake editor
            return if (isCreate) {
                SchedulingRoutes.intakeQuestionsEditor(EventTypeListViewModel.NEW_EVENT_TYPE_ID)
            } else {
                SchedulingRoutes.intakeQuestionsEditor(eventTypeId)
            }
        }

        fun availabilityRoute(): String = SchedulingRoutes.AVAILABILITY_LIST

        fun bookingLimitsRoute(): String = SchedulingRoutes.BOOKING_LIMITS

        fun remindersRoute(): String = SchedulingRoutes.remindersQuickSetup(owner.routeKind, owner.ownerRouteId)

        fun paymentsRoute(): String = SchedulingRoutes.PAYMENTS_SETUP

        // ─── Render ──────────────────────────────────────────────────────────────

        private fun render() {
            _state.value =
                EventTypeEditorUiState.Content(
                    pillar = pillar,
                    isCreate = isCreate,
                    form = form,
                    original = original,
                    nameError = nameError(),
                    durationError = if (!form.durationValid) "Enter a length between $DURATION_MIN and $DURATION_MAX minutes" else null,
                    advancedOpen = advancedOpen,
                    paidEnabled = flags.paidSchedulingEnabled,
                    stripeConnected = stripeConnected,
                    questionCount = questionCount,
                    isSaving = saving,
                )
        }

        private fun nameError(): String? =
            serverNameError ?: if (form.name.isNotBlank() && !form.nameValid) "Use letters, numbers, and hyphens." else null

        private fun ownerPillarOf(owner: SchedulingOwner): SchedulingPillar =
            when (owner) {
                is SchedulingOwner.Business -> SchedulingPillar.Business
                is SchedulingOwner.Home -> SchedulingPillar.Home
                is SchedulingOwner.Personal -> SchedulingPillar.Personal
            }

        private fun ownerPillar(ownerType: String?): SchedulingPillar =
            when (ownerType) {
                "business" -> SchedulingPillar.Business
                "home" -> SchedulingPillar.Home
                else -> SchedulingPillar.Personal
            }

        private fun EditorForm.toCreateRequest(): CreateEventTypeRequest =
            CreateEventTypeRequest(
                name = name.trim(),
                slug = slugify(name),
                durations = durations,
                description = description.takeIf { it.isNotBlank() },
                color = color,
                defaultDuration = defaultDuration,
                locationMode = locationMode,
                locationDetail = locationDetail.takeIf { it.isNotBlank() },
                assignmentMode = if (pillar == SchedulingPillar.Business) assignmentMode else null,
                requiresApproval = requiresApproval,
                visibility = if (visibilitySecret) "secret" else "public",
                bufferBeforeMin = bufferBeforeMin,
                bufferAfterMin = bufferAfterMin,
                minNoticeMin = minNoticeMin,
                maxHorizonDays = maxHorizonDays,
                dailyCap = dailyCap,
                priceCents = if (chargeEnabled && flags.paidSchedulingEnabled) priceCents else null,
                currency = if (chargeEnabled && flags.paidSchedulingEnabled) currency else null,
                depositCents = if (chargeEnabled && flags.paidSchedulingEnabled) depositCents else null,
                ownerType = owner.ownerType,
                ownerId = owner.ownerId,
            )

        // `slug` is intentionally omitted from the PUT — it is immutable after create so
        // existing public booking links keep working; the editor exposes no slug field.
        private fun EditorForm.toUpdateRequest(): UpdateEventTypeRequest =
            UpdateEventTypeRequest(
                name = name.trim(),
                durations = durations,
                description = description,
                color = color,
                defaultDuration = defaultDuration,
                locationMode = locationMode,
                locationDetail = locationDetail,
                assignmentMode = if (pillar == SchedulingPillar.Business) assignmentMode else null,
                requiresApproval = requiresApproval,
                visibility = if (visibilitySecret) "secret" else "public",
                bufferBeforeMin = bufferBeforeMin,
                bufferAfterMin = bufferAfterMin,
                minNoticeMin = minNoticeMin,
                maxHorizonDays = maxHorizonDays,
                dailyCap = dailyCap,
                priceCents = if (flags.paidSchedulingEnabled) (if (chargeEnabled) priceCents else 0) else null,
                depositCents = if (flags.paidSchedulingEnabled) (if (chargeEnabled) depositCents ?: 0 else 0) else null,
                isActive = isActive,
            )

        private fun SchedulingError.editorMessage(): String =
            when (this) {
                is SchedulingError.Secret -> "You don't have access to edit this event type."
                is SchedulingError.Generic -> message
                else -> "Couldn't load this event type."
            }
    }
