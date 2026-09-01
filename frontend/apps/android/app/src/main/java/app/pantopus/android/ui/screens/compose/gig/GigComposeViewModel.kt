@file:Suppress("PackageNaming", "TooManyFunctions", "LargeClass")

package app.pantopus.android.ui.screens.compose.gig

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.ai.AiTranscriptionRepository
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.gigs.CareDetailsDto
import app.pantopus.android.data.api.models.gigs.EventDetailsDto
import app.pantopus.android.data.api.models.gigs.LogisticsDetailsDto
import app.pantopus.android.data.api.models.gigs.MagicDraftDto
import app.pantopus.android.data.api.models.gigs.MagicDraftRequest
import app.pantopus.android.data.api.models.gigs.MagicDraftResponse
import app.pantopus.android.data.api.models.gigs.MagicPostBody
import app.pantopus.android.data.api.models.gigs.MagicPostLocation
import app.pantopus.android.data.api.models.gigs.MagicTaskItemDto
import app.pantopus.android.data.api.models.gigs.PriceBenchmarkDto
import app.pantopus.android.data.api.models.gigs.RemoteDetailsDto
import app.pantopus.android.data.api.models.gigs.UrgentDetailsDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.gigs.GigDraftQueue
import app.pantopus.android.data.gigs.GigQueuedDraft
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.network.NetworkMonitor
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
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeParseException
import java.util.UUID
import javax.inject.Inject

/**
 * Aggregate UI state for the Post-a-Task wizard. Combined into a single
 * [StateFlow] so the screen can derive [WizardChrome] off of it without
 * reading several separate flows.
 */
data class GigComposeUiState(
    val form: GigComposeFormState = GigComposeFormState.EMPTY,
    val isSubmitting: Boolean = false,
    val createdGigId: String? = null,
    val errorMessage: String? = null,
    /**
     * E.1 — the composer picker sheet currently presented over the wizard,
     * or null. Transient UI state — never persisted to [SavedStateHandle]
     * (a half-open sheet shouldn't survive process death).
     */
    val activeSheet: GigPickerSheet? = null,
    /** P0.1 — true while the magic-draft parse call is in flight. */
    val isParsingDraft: Boolean = false,
    /** P0.1 — backend follow-up question shown under the describe field. */
    val clarifyingQuestion: String? = null,
    /** P0.2 — in-flight / failed photo uploads (uploaded URLs live in [form.photoIds]). */
    val photoUploads: List<GigComposePhotoUpload> = emptyList(),
    /** P1.G — price-benchmark hint for the budget step; null hides it. */
    val priceBenchmark: GigComposePriceBenchmark? = null,
    /** A12.8 — smart-template chips for the empty describe state. */
    val templates: List<GigComposeTemplate> = emptyList(),
    /** A12.8 — magic-post result driving the success step (undo + counts). */
    val postResult: GigComposePostResult? = null,
    /** A12.8 — true while a voice note is being transcribed. */
    val isTranscribing: Boolean = false,
    /** A12.8 — true right after a successful undo ("Task undone" toast). */
    val showUndoneToast: Boolean = false,
    /**
     * P6c — businesses the user can post on behalf of. Empty (no
     * businesses or fetch failed) keeps the identity chip static.
     */
    val identityOptions: List<GigComposeIdentityOption> = emptyList(),
)

/**
 * A12.8 — drives the describe-first 4-step + success Post-a-Task wizard.
 * Both paths submit through `POST /api/gigs/magic-post` via
 * [GigsRepository.magicPost] and expose [WizardChrome] for the shared
 * [app.pantopus.android.ui.screens.shared.wizard.WizardShell].
 *
 * Scalar form state is mirrored into [SavedStateHandle] (new
 * `composeGig2.*` keys, so stale 6-step snapshots are ignored). Module
 * objects + items are kept in-memory only — they don't survive process
 * death (config changes keep the VM alive, so rotation is safe).
 */
@HiltViewModel
open class GigComposeViewModel
    @Inject
    constructor(
        private val repository: GigsRepository,
        private val savedStateHandle: SavedStateHandle,
        private val networkMonitor: NetworkMonitor,
        private val filesRepository: FilesRepository,
        private val transcriptionRepository: AiTranscriptionRepository,
        private val draftQueue: GigDraftQueue,
        private val businessesRepository: BusinessesRepository,
    ) : ViewModel(),
        WizardModel {
        private val _state =
            MutableStateFlow(GigComposeUiState(form = restoreFormState()))

        /** Combined UI state consumed by [GigComposeWizardScreen]. */
        val state: StateFlow<GigComposeUiState> = _state.asStateFlow()

        /** One-shot navigation events the screen reacts to. */
        val pendingEvent = MutableStateFlow<GigComposeOutboundEvent?>(null)

        /**
         * P0.1 — in-flight debounce + magic-draft call for the Magic Task
         * parse. Cancelled (which also aborts the HTTP call) whenever new
         * describe input arrives.
         */
        private var detectionJob: Job? = null

        /**
         * P0.1 — field keys the user has manually edited. The magic-draft
         * prefill skips these so a backend parse never stomps explicit
         * input. Persisted alongside the form so restore keeps the rule.
         */
        private val touchedFields: MutableSet<String> =
            (savedStateHandle.get<ArrayList<String>>(KEY_TOUCHED) ?: arrayListOf()).toMutableSet()

        /** P0.2 — picked-photo bytes held for upload + tap-to-retry. */
        private val pendingPhotoBytes = mutableMapOf<String, GigComposePickedPhoto>()

        /** P0.2 — per-tile upload jobs so remove can cancel in flight. */
        private val uploadJobs = mutableMapOf<String, Job>()

        /** A12.8 — last backend draft, echoed as `ai_draft_json` + module fallbacks. */
        private var lastDraft: MagicDraftDto? = null

        /** A12.8 — confidence of [lastDraft], forwarded as `ai_confidence`. */
        private var lastConfidence: Double? = null

        /** A12.8 — templates fetched once per VM (silent failure). */
        private var templatesLoaded = false

        /** P6c — my-businesses fetched once per VM (silent failure). */
        private var identitiesLoaded = false

        /**
         * P6c — id of the draft this session already parked in the
         * offline queue, so repeated failed submits replace instead of
         * stacking duplicates.
         */
        private var queuedDraftId: String? = null

        // MARK: - WizardModel

        override val chrome: WizardChrome
            get() = computeChrome(_state.value)

        override fun onLeading() {
            val current = _state.value.form.currentStep
            when (leadingControl(current)) {
                WizardLeadingControl.Back -> goBack()
                WizardLeadingControl.Close -> pendingEvent.value = GigComposeOutboundEvent.Dismiss
            }
        }

        override fun onDiscard() {
            pendingEvent.value = GigComposeOutboundEvent.Dismiss
        }

        /**
         * P6c — "Save draft" on the close confirm: park the scalar form
         * snapshot in the offline queue, then dismiss. The Gigs feed
         * surfaces the pending draft with Post now / Discard.
         */
        override fun onSaveDraft() {
            enqueueDraft()
            pendingEvent.value = GigComposeOutboundEvent.Dismiss
        }

        override fun onPrimary() {
            viewModelScope.launch { advance() }
        }

        override fun onSecondary() {
            val form = _state.value.form
            when {
                form.currentStep == GigComposeStep.Success ->
                    pendingEvent.value = GigComposeOutboundEvent.Dismiss
                form.currentStep == GigComposeStep.Describe && form.composeMode == ComposeMode.Magic ->
                    setComposeMode(ComposeMode.Manual)
            }
        }

        fun acknowledgeEvent() {
            pendingEvent.value = null
        }

        /**
         * Seed the form's category once on entry (e.g. when the user
         * arrives from the Gigs feed with `handyman` selected). No-op
         * if a category is already set or the form was restored from
         * SavedStateHandle.
         */
        fun preselectCategoryIfNeeded(category: GigComposeCategory?) {
            if (category == null) return
            val current = _state.value.form
            if (current.category != null || current.hasAnyData) return
            // A preselected category means the user already chose one, so
            // land on the manual picker (tile pre-selected) rather than Magic.
            _state.update { it.copy(form = it.form.copy(composeMode = ComposeMode.Manual, category = category)) }
            persist()
        }

        // MARK: - A12.8 Magic Task

        /** Switch the step-1 entry mode (Magic describe ⇄ manual picker). */
        fun setComposeMode(mode: ComposeMode) {
            _state.update { it.copy(form = it.form.copy(composeMode = mode)) }
            persist()
        }

        /**
         * Update the plain-English describe text and (re)schedule a
         * debounced parse. P0.1 — the parse is the real backend
         * `POST /api/gigs/magic-draft` call; the [detectArchetype] keyword
         * matcher remains the offline / short-input fallback. Cancelling
         * [detectionJob] also cancels any magic-draft call still in flight.
         */
        fun setDescribeText(text: String) {
            val clamped = text.take(GigComposeLimits.DESCRIBE_MAX)
            _state.update { it.copy(form = it.form.copy(describeText = clamped)) }
            persist()
            detectionJob?.cancel()
            detectionJob =
                viewModelScope.launch {
                    delay(DETECTION_DEBOUNCE_MS)
                    parseDescribe(clamped)
                }
        }

        /**
         * A12.8 — fetch the smart-template chip row once. Failures are
         * silent — the describe step renders fine without templates.
         */
        fun loadTemplatesIfNeeded() {
            if (templatesLoaded) return
            templatesLoaded = true
            viewModelScope.launch {
                when (val result = repository.templatesLibrary()) {
                    is NetworkResult.Success ->
                        _state.update { state ->
                            state.copy(
                                templates =
                                    result.data.templates.map { dto ->
                                        GigComposeTemplate(
                                            id = dto.id,
                                            label = dto.label,
                                            icon = dto.icon.orEmpty(),
                                            seedText = dto.template?.title ?: dto.label,
                                        )
                                    },
                            )
                        }
                    is NetworkResult.Failure -> Unit
                }
            }
        }

        /** A12.8 — a template chip seeds the describe text + parse. */
        fun applyTemplate(template: GigComposeTemplate) {
            setDescribeText(template.seedText)
        }

        /**
         * A12.8 — transcribe a recorded voice note (m4a/AAC) via
         * `POST /api/ai/transcribe` and append the text to the describe
         * field. Failures are silent — the recording UI simply resets.
         */
        fun transcribeAudio(
            filename: String,
            mimeType: String,
            bytes: ByteArray,
        ) {
            _state.update { it.copy(isTranscribing = true) }
            viewModelScope.launch {
                val result = transcriptionRepository.transcribe(filename, mimeType, bytes)
                _state.update { it.copy(isTranscribing = false) }
                if (result is NetworkResult.Success) {
                    val transcript = result.data.text.trim()
                    if (transcript.isNotEmpty()) {
                        val current = _state.value.form.describeText
                        val joined = if (current.isBlank()) transcript else "$current $transcript"
                        setDescribeText(joined)
                    }
                }
            }
        }

        /**
         * P0.1 — parse the describe text. Input of ≥ [MIN_DRAFT_WORDS]
         * words goes to the backend magic-draft endpoint; shorter input —
         * and any network failure — falls back to the deterministic
         * keyword matcher so the step still works offline.
         */
        suspend fun parseDescribe(text: String) {
            if (_state.value.form.describeText != text) return
            if (wordCount(text) < MIN_DRAFT_WORDS) {
                // Too short for the backend — drop any stale follow-up
                // question and fall back to the keyword matcher.
                _state.update { it.copy(clarifyingQuestion = null) }
                applyDetection(text)
                return
            }
            _state.update { it.copy(isParsingDraft = true) }
            val request =
                MagicDraftRequest(
                    text = text.trim(),
                    attachmentUrls = _state.value.form.photoIds.ifEmpty { null },
                )
            val result = repository.magicDraft(request)
            if (_state.value.form.describeText != text) {
                // Stale — newer input arrived while the call was in flight.
                _state.update { it.copy(isParsingDraft = false) }
                return
            }
            when (result) {
                is NetworkResult.Success -> applyMagicDraft(result.data)
                is NetworkResult.Failure -> {
                    _state.update { it.copy(isParsingDraft = false, clarifyingQuestion = null) }
                    applyDetection(text)
                }
            }
        }

        /**
         * Apply the keyword-matched archetype if the text hasn't changed
         * since the debounce fired. Mirrors the detected category into
         * [form.category]. Kept as the magic-draft fallback (offline etc.).
         */
        fun applyDetection(text: String) {
            if (_state.value.form.describeText != text) return
            val detected = detectArchetype(text)
            _state.update {
                it.copy(
                    form =
                        it.form.copy(
                            detectedArchetype = detected,
                            category = detected ?: it.form.category,
                            taskArchetype = it.form.taskArchetype ?: detected?.let(::archetypeForCategory),
                        ),
                )
            }
            persist()
        }

        /**
         * P0.1 — map a magic-draft response onto the form. The draft is
         * applied the moment it arrives, but only into fields the user
         * hasn't manually edited ([touchedFields]).
         */
        private fun applyMagicDraft(response: MagicDraftResponse) {
            val draft = response.draft
            lastDraft = draft
            lastConfidence = response.confidence
            _state.update { state ->
                state.copy(
                    isParsingDraft = false,
                    clarifyingQuestion = response.clarifyingQuestion?.takeIf { it.isNotBlank() },
                    form = prefillFormFromDraft(state.form, draft),
                )
            }
            persist()
        }

        @Suppress("CyclomaticComplexMethod")
        private fun prefillFormFromDraft(
            form: GigComposeFormState,
            draft: MagicDraftDto,
        ): GigComposeFormState {
            val category =
                GigComposeCategory.fromRawKey(draft.category)
                    ?: GigComposeCategory.fromRawKey(draft.taskArchetype)
                    ?: detectArchetype(form.describeText)
            val budgetType =
                draft.payType?.let { pay -> GigComposeBudgetType.entries.firstOrNull { it.wireValue == pay } }
            val (draftMin, draftMax) = draftBudgetBounds(draft)
            val draftTags =
                draft.tags
                    .orEmpty()
                    .mapNotNull { normalizeTag(it) }
                    .distinct()
                    .take(GigComposeLimits.MAX_TAGS)
                    .ifEmpty { null }
            val draftItems =
                draft.items
                    ?.take(GigComposeLimits.MAX_ITEMS)
                    ?.ifEmpty { null }
            return form.copy(
                detectedArchetype = category ?: form.detectedArchetype,
                taskArchetype = draft.taskArchetype ?: form.taskArchetype ?: category?.let(::archetypeForCategory),
                category = prefill(FIELD_CATEGORY, category, form.category),
                title = prefill(FIELD_TITLE, draft.title?.take(GigComposeLimits.TITLE_MAX), form.title),
                description =
                    prefill(
                        FIELD_DESCRIPTION,
                        draft.description?.take(GigComposeLimits.DESCRIPTION_MAX),
                        form.description,
                    ),
                budgetType = prefill(FIELD_BUDGET, budgetType, form.budgetType),
                budgetMin = prefill(FIELD_BUDGET, draftMin, form.budgetMin),
                budgetMax = prefill(FIELD_BUDGET, draftMax, form.budgetMax),
                estimatedHours =
                    prefill(
                        FIELD_EFFORT,
                        formatBudgetValue(draft.estimatedHours),
                        form.estimatedHours,
                    ),
                scheduleType = prefill(FIELD_SCHEDULE, scheduleTypeFromDraft(draft.scheduleType), form.scheduleType),
                scheduledStartISO = prefill(FIELD_SCHEDULE, draft.timeWindowStart, form.scheduledStartISO),
                tags = prefill(FIELD_TAGS, draftTags, form.tags),
                isUrgent = prefill(FIELD_URGENT, draft.isUrgent, form.isUrgent),
                // Module objects — prefill wholesale when the user hasn't
                // edited that module's fields yet.
                careDetails = prefill(FIELD_MODULES, draft.careDetails, form.careDetails),
                logisticsDetails = prefill(FIELD_MODULES, draft.logisticsDetails, form.logisticsDetails),
                remoteDetails = prefill(FIELD_MODULES, draft.remoteDetails, form.remoteDetails),
                eventDetails = prefill(FIELD_MODULES, draft.eventDetails, form.eventDetails),
                items = prefill(FIELD_MODULES, draftItems, form.items),
                // Flat delivery / pro-service suggestions (RN
                // `gig-v2/new.tsx:231-251`).
                deliveryDetails = prefill(FIELD_MODULES, deliveryFromDraft(draft), form.deliveryDetails),
                proServiceDetails = prefill(FIELD_MODULES, proServiceFromDraft(draft), form.proServiceDetails),
            )
        }

        /** Delivery editor seed, or null when the parse carried none. */
        private fun deliveryFromDraft(draft: MagicDraftDto): GigDeliveryDetails? {
            val hasAny =
                draft.pickupAddress != null || draft.pickupNotes != null ||
                    draft.dropoffAddress != null || draft.dropoffNotes != null ||
                    draft.deliveryProofRequired != null
            if (!hasAny) return null
            return GigDeliveryDetails(
                pickupAddress = draft.pickupAddress.orEmpty(),
                pickupNotes = draft.pickupNotes.orEmpty(),
                dropoffAddress = draft.dropoffAddress.orEmpty(),
                dropoffNotes = draft.dropoffNotes.orEmpty(),
                proofRequired = draft.deliveryProofRequired == true,
            )
        }

        /** Pro-service editor seed, or null when the parse carried none. */
        private fun proServiceFromDraft(draft: MagicDraftDto): GigProServiceDetails? {
            val hasAny =
                draft.requiresLicense != null || draft.licenseType != null ||
                    draft.requiresInsurance != null || draft.scopeDescription != null ||
                    draft.depositRequired != null || draft.depositAmount != null
            if (!hasAny) return null
            return GigProServiceDetails(
                requiresLicense = draft.requiresLicense == true,
                licenseType = draft.licenseType.orEmpty(),
                requiresInsurance = draft.requiresInsurance == true,
                scopeDescription = draft.scopeDescription.orEmpty(),
                depositRequired = draft.depositRequired == true,
                depositAmount = formatBudgetValue(draft.depositAmount).orEmpty(),
            )
        }

        /** Draft value wins only when present and the field is untouched. */
        private fun <T> prefill(
            field: String,
            draftValue: T?,
            current: T,
        ): T = if (draftValue != null && field !in touchedFields) draftValue else current

        private fun markTouched(field: String) {
            touchedFields.add(field)
            savedStateHandle[KEY_TOUCHED] = ArrayList(touchedFields)
        }

        // MARK: - Field updates

        fun selectCategory(category: GigComposeCategory) {
            markTouched(FIELD_CATEGORY)
            _state.update {
                it.copy(
                    form =
                        it.form.copy(
                            category = category,
                            taskArchetype = archetypeForCategory(category),
                        ),
                )
            }
            persist()
        }

        /**
         * A12.8 — describe-step engagement tile. Prefills the schedule:
         * One-time keeps/expects a date, Recurring repeats, Open-ended
         * maps to the flexible schedule.
         */
        fun selectEngagementMode(mode: GigComposeEngagementMode) {
            markTouched(FIELD_SCHEDULE)
            val scheduleType =
                when (mode) {
                    GigComposeEngagementMode.OneTime -> GigComposeScheduleType.OneTime
                    GigComposeEngagementMode.Recurring -> GigComposeScheduleType.Recurring
                    GigComposeEngagementMode.OpenEnded -> GigComposeScheduleType.Flexible
                }
            applyScheduleType(scheduleType)
        }

        /** A12.8 — Budget & mode step override of the wire `engagement_mode`. */
        fun selectEngagementOverride(mode: GigEngagementMode) {
            _state.update { it.copy(form = it.form.copy(engagementOverride = mode)) }
            persist()
        }

        fun setTitle(title: String) {
            markTouched(FIELD_TITLE)
            val clamped = title.take(GigComposeLimits.TITLE_MAX)
            _state.update { it.copy(form = it.form.copy(title = clamped)) }
            persist()
        }

        fun setDescription(description: String) {
            markTouched(FIELD_DESCRIPTION)
            val clamped = description.take(GigComposeLimits.DESCRIPTION_MAX)
            _state.update { it.copy(form = it.form.copy(description = clamped)) }
            persist()
        }

        /** A12.8 — optional effort estimate in hours (decimal string). */
        fun setEstimatedHours(value: String) {
            markTouched(FIELD_EFFORT)
            _state.update { it.copy(form = it.form.copy(estimatedHours = sanitizeBudget(value))) }
            persist()
        }

        // MARK: - A12.8 Module field updates (in-memory only)

        fun updateCareDetails(details: CareDetailsDto?) {
            markTouched(FIELD_MODULES)
            _state.update { it.copy(form = it.form.copy(careDetails = details)) }
        }

        fun updateLogisticsDetails(details: LogisticsDetailsDto?) {
            markTouched(FIELD_MODULES)
            _state.update { it.copy(form = it.form.copy(logisticsDetails = details)) }
        }

        fun updateRemoteDetails(details: RemoteDetailsDto?) {
            markTouched(FIELD_MODULES)
            _state.update { it.copy(form = it.form.copy(remoteDetails = details)) }
        }

        fun updateEventDetails(details: EventDetailsDto?) {
            markTouched(FIELD_MODULES)
            _state.update { it.copy(form = it.form.copy(eventDetails = details)) }
        }

        /** delivery_errand — pickup / drop-off route + proof toggle. */
        fun updateDeliveryDetails(details: GigDeliveryDetails) {
            markTouched(FIELD_MODULES)
            _state.update { it.copy(form = it.form.copy(deliveryDetails = details)) }
        }

        /** pro_service_quote — licence / insurance / scope / deposit. */
        fun updateProServiceDetails(details: GigProServiceDetails) {
            markTouched(FIELD_MODULES)
            _state.update { it.copy(form = it.form.copy(proServiceDetails = details)) }
        }

        /** delivery_errand — add an empty item row (≤[GigComposeLimits.MAX_ITEMS]). */
        fun addItem() {
            markTouched(FIELD_MODULES)
            val items = _state.value.form.items
            if (items.size >= GigComposeLimits.MAX_ITEMS) return
            _state.update { it.copy(form = it.form.copy(items = items + MagicTaskItemDto(name = ""))) }
        }

        fun updateItemName(
            index: Int,
            name: String,
        ) {
            markTouched(FIELD_MODULES)
            val items = _state.value.form.items.toMutableList()
            if (index !in items.indices) return
            items[index] = items[index].copy(name = name)
            _state.update { it.copy(form = it.form.copy(items = items)) }
        }

        fun removeItem(index: Int) {
            markTouched(FIELD_MODULES)
            val items = _state.value.form.items.toMutableList()
            if (index !in items.indices) return
            items.removeAt(index)
            _state.update { it.copy(form = it.form.copy(items = items)) }
        }

        // MARK: - P0.2 Photo upload pipeline

        /**
         * P0.2 — accept a picked attachment and upload it immediately via
         * `POST /api/files/upload`. The tile is tracked as uploading /
         * failed (tap-to-retry) until the URL lands in [form.photoIds].
         */
        fun addPickedPhoto(photo: GigComposePickedPhoto) {
            val current = _state.value
            if (current.form.photoIds.size + current.photoUploads.size >= GigComposeLimits.MAX_PHOTOS) return
            val id = UUID.randomUUID().toString()
            pendingPhotoBytes[id] = photo
            _state.update { it.copy(photoUploads = it.photoUploads + GigComposePhotoUpload(id = id)) }
            startUpload(id)
        }

        /** P0.2 — retry a failed upload tile (bytes are still held). */
        fun retryPhotoUpload(id: String) {
            if (pendingPhotoBytes[id] == null) return
            _state.update {
                it.copy(photoUploads = it.photoUploads.map { tile -> if (tile.id == id) tile.copy(failed = false) else tile })
            }
            startUpload(id)
        }

        /** P0.2 — drop an uploading / failed tile, cancelling its call. */
        fun removePhotoUpload(id: String) {
            uploadJobs.remove(id)?.cancel()
            pendingPhotoBytes.remove(id)
            _state.update { it.copy(photoUploads = it.photoUploads.filterNot { tile -> tile.id == id }) }
        }

        private fun startUpload(id: String) {
            val photo = pendingPhotoBytes[id] ?: return
            uploadJobs[id] =
                viewModelScope.launch {
                    val result =
                        filesRepository.uploadFile(
                            filename = photo.filename,
                            mimeType = photo.mimeType,
                            bytes = photo.bytes,
                            fileType = GIG_PHOTO_FILE_TYPE,
                            visibility = "public",
                        )
                    when (result) {
                        is NetworkResult.Success -> {
                            pendingPhotoBytes.remove(id)
                            uploadJobs.remove(id)
                            _state.update {
                                it.copy(
                                    form = it.form.copy(photoIds = it.form.photoIds + result.data.file.url),
                                    photoUploads = it.photoUploads.filterNot { tile -> tile.id == id },
                                )
                            }
                            persist()
                        }
                        is NetworkResult.Failure ->
                            _state.update {
                                it.copy(
                                    photoUploads =
                                        it.photoUploads.map { tile ->
                                            if (tile.id == id) tile.copy(failed = true) else tile
                                        },
                                )
                            }
                    }
                }
        }

        /** Remove an already-uploaded photo URL by its slot index. */
        fun removePhoto(index: Int) {
            val current = _state.value.form.photoIds
            if (index !in current.indices) return
            _state.update {
                it.copy(
                    form = it.form.copy(photoIds = current.toMutableList().also { list -> list.removeAt(index) }),
                )
            }
            persist()
        }

        fun selectBudgetType(type: GigComposeBudgetType) {
            markTouched(FIELD_BUDGET)
            _state.update { it.copy(form = it.form.copy(budgetType = type)) }
            persist()
        }

        fun setBudgetMin(value: String) {
            markTouched(FIELD_BUDGET)
            _state.update { it.copy(form = it.form.copy(budgetMin = sanitizeBudget(value))) }
            persist()
        }

        fun setBudgetMax(value: String) {
            markTouched(FIELD_BUDGET)
            _state.update { it.copy(form = it.form.copy(budgetMax = sanitizeBudget(value))) }
            persist()
        }

        fun selectScheduleType(type: GigComposeScheduleType) {
            markTouched(FIELD_SCHEDULE)
            applyScheduleType(type)
        }

        private fun applyScheduleType(type: GigComposeScheduleType) {
            _state.update {
                it.copy(
                    form =
                        it.form.copy(
                            scheduleType = type,
                            // Drop the date when leaving "one-time" so it can't bleed past.
                            scheduledStartISO = if (type == GigComposeScheduleType.OneTime) it.form.scheduledStartISO else null,
                        ),
                )
            }
            persist()
        }

        fun setScheduledStart(iso: String?) {
            markTouched(FIELD_SCHEDULE)
            _state.update { it.copy(form = it.form.copy(scheduledStartISO = iso)) }
            persist()
        }

        fun selectLocationMode(mode: GigComposeLocationMode) {
            _state.update { it.copy(form = it.form.copy(locationMode = mode)) }
            persist()
        }

        fun updatePlaceAddress(
            line1: String? = null,
            city: String? = null,
            state: String? = null,
            zip: String? = null,
        ) {
            _state.update {
                val current = it.form.placeAddress
                it.copy(
                    form =
                        it.form.copy(
                            placeAddress =
                                current.copy(
                                    line1 = line1 ?: current.line1,
                                    city = city ?: current.city,
                                    state = state ?: current.state,
                                    zip = zip ?: current.zip,
                                ),
                        ),
                )
            }
            persist()
        }

        // MARK: - E.1 Composer picker sheets

        /** Present one of the composer's bottom-sheet pickers. */
        fun presentPicker(sheet: GigPickerSheet) {
            _state.update { it.copy(activeSheet = sheet) }
        }

        /** Dismiss whichever picker sheet is open. */
        fun dismissPicker() {
            _state.update { it.copy(activeSheet = null) }
        }

        // MARK: - P6c Persona switching (identity chip)

        /**
         * P6c — fetch the caller's businesses once so the identity chip
         * can become a picker. `GET /api/businesses/my-businesses`
         * (`backend/routes/businesses.js:680`) returns membership rows
         * whose `business_user_id` is the business's postable User id —
         * rows without one are hidden. Failures are silent: the chip
         * stays the static "Personal · You".
         */
        fun loadIdentitiesIfNeeded() {
            if (identitiesLoaded) return
            identitiesLoaded = true
            viewModelScope.launch {
                when (val result = businessesRepository.myBusinesses()) {
                    is NetworkResult.Success ->
                        _state.update { state ->
                            state.copy(
                                identityOptions =
                                    result.data.businesses
                                        .mapNotNull { membership ->
                                            val postableId = membership.businessUserId.takeIf { it.isNotBlank() }
                                            postableId?.let {
                                                GigComposeIdentityOption(
                                                    id = it,
                                                    name =
                                                        membership.business.name
                                                            ?: membership.business.username
                                                            ?: "Business",
                                                )
                                            }
                                        }.distinctBy { it.id },
                            )
                        }
                    is NetworkResult.Failure -> Unit
                }
            }
        }

        /**
         * P6c — pick the posting identity. `null` returns to Personal;
         * a business id rides the submission as `beneficiary_user_id`.
         * Persisted with the rest of the scalar form state.
         */
        fun selectIdentity(option: GigComposeIdentityOption?) {
            _state.update {
                it.copy(
                    form = it.form.copy(beneficiaryUserId = option?.id, beneficiaryLabel = option?.name),
                    activeSheet = null,
                )
            }
            persist()
        }

        /** E.1 — set (or clear) the optional deadline. null ⇒ flexible. */
        fun setDeadline(iso: String?) {
            _state.update { it.copy(form = it.form.copy(deadlineISO = iso)) }
            persist()
        }

        /** E.1 — choose the cancellation-policy tier. */
        fun setCancellationPolicy(policy: GigCancellationPolicy) {
            _state.update { it.copy(form = it.form.copy(cancellationPolicy = policy)) }
            persist()
        }

        /** E.1 — toggle the urgent boost flag. */
        fun setUrgent(isUrgent: Boolean) {
            markTouched(FIELD_URGENT)
            _state.update { it.copy(form = it.form.copy(isUrgent = isUrgent)) }
            persist()
        }

        /** E.1 — add a tag if there's room ([GigComposeLimits.MAX_TAGS]). */
        fun addTag(raw: String) {
            val tag = normalizeTag(raw) ?: return
            markTouched(FIELD_TAGS)
            val current = _state.value.form.tags
            if (current.size >= GigComposeLimits.MAX_TAGS || current.contains(tag)) return
            _state.update { it.copy(form = it.form.copy(tags = current + tag)) }
            persist()
        }

        /** E.1 — remove a tag by its normalised value. */
        fun removeTag(tag: String) {
            markTouched(FIELD_TAGS)
            _state.update {
                it.copy(form = it.form.copy(tags = it.form.tags.filterNot { existing -> existing == tag }))
            }
            persist()
        }

        /** E.1 — add a suggested tag if absent, remove it if already chosen. */
        fun toggleTag(raw: String) {
            val tag = normalizeTag(raw) ?: return
            if (_state.value.form.tags.contains(tag)) removeTag(tag) else addTag(tag)
        }

        // MARK: - State machine

        private suspend fun advance() {
            when (_state.value.form.currentStep) {
                GigComposeStep.Describe,
                GigComposeStep.FillGaps,
                GigComposeStep.BudgetMode,
                -> {
                    val next = GigComposeStep.fromOrdinal(_state.value.form.step + 1)
                    transitionTo(next)
                }
                GigComposeStep.Review -> submit()
                GigComposeStep.Success -> {
                    val gigId = _state.value.createdGigId ?: return
                    pendingEvent.value = GigComposeOutboundEvent.OpenGigDetail(gigId)
                }
            }
        }

        private fun goBack() {
            val previous = GigComposeStep.fromOrdinal(_state.value.form.step - 1)
            transitionTo(previous)
        }

        /**
         * A12.8 — module-prompt rows jump straight to the step that owns
         * the missing detail (When/Where/Photos → Fill gaps; Effort/Budget
         * → Budget & mode).
         */
        fun jumpToStep(step: GigComposeStep) {
            if (step == GigComposeStep.Success) return
            transitionTo(step)
        }

        private fun transitionTo(step: GigComposeStep) {
            _state.update {
                it.copy(form = it.form.copy(step = step.ordinal0), errorMessage = null)
            }
            persist()
            // P1.G — entering the budget step with a category fetches the
            // nearby price benchmark for the hint under the fields.
            if (step == GigComposeStep.BudgetMode) fetchPriceBenchmark()
            step.stepNumber?.let { number ->
                Analytics.track(
                    AnalyticsEvent.ScreenComposeGigWizardStepViewed(
                        stepNumber = number,
                        stepName = step.name,
                    ),
                )
            }
        }

        // MARK: - P1.G Price benchmark

        /** P1.G — category key of the last benchmark fetch (dedupe guard). */
        private var benchmarkCategoryKey: String? = null

        /**
         * P1.G — fetch the completed-task price percentiles for the form's
         * category. Failures are silent and `comparable_count == 0` hides
         * the hint — the budget step renders fine without it.
         */
        fun fetchPriceBenchmark() {
            val category = _state.value.form.category ?: return
            if (benchmarkCategoryKey == category.key) return
            benchmarkCategoryKey = category.key
            viewModelScope.launch {
                val benchmark =
                    when (val result = repository.priceBenchmark(category.key)) {
                        is NetworkResult.Success -> projectBenchmark(category.label, result.data.benchmark)
                        is NetworkResult.Failure -> null
                    }
                _state.update { it.copy(priceBenchmark = benchmark) }
            }
        }

        // MARK: - A12.8 Submit via magic-post

        private suspend fun submit() {
            Analytics.track(AnalyticsEvent.CtaComposeGigSubmit)
            if (!networkMonitor.isOnline.value) {
                // P6c — connectivity-class failure: park the form in the
                // offline queue instead of just bouncing the user.
                enqueueDraft()
                _state.update { it.copy(errorMessage = DRAFT_SAVED_OFFLINE_MESSAGE) }
                return
            }
            val body =
                buildMagicPostBody() ?: run {
                    _state.update { it.copy(errorMessage = "Please complete each step before posting.") }
                    return
                }
            _state.update { it.copy(isSubmitting = true, errorMessage = null) }
            when (val result = repository.magicPost(body)) {
                is NetworkResult.Success -> {
                    val gig = result.data.gig
                    // A queued copy of this form is now redundant.
                    queuedDraftId?.let { draftQueue.remove(it) }
                    queuedDraftId = null
                    _state.update {
                        it.copy(
                            createdGigId = gig.id,
                            postResult =
                                GigComposePostResult(
                                    gigId = gig.id,
                                    undoDeadlineEpochMs =
                                        System.currentTimeMillis() + (gig.undoWindowMs ?: DEFAULT_UNDO_WINDOW_MS),
                                    nearbyHelpers = result.data.nearbyHelpers ?: 0,
                                    notifiedCount = result.data.notifiedCount ?: 0,
                                ),
                            isSubmitting = false,
                            showUndoneToast = false,
                            form = it.form.copy(step = GigComposeStep.Success.ordinal0),
                        )
                    }
                    persist()
                }
                is NetworkResult.Failure -> {
                    // P6c — an IO-layer failure (offline mid-flight,
                    // timeout, DNS) also parks the draft for later.
                    val isConnectivity = result.error is NetworkError.Transport
                    if (isConnectivity) enqueueDraft()
                    _state.update {
                        it.copy(
                            isSubmitting = false,
                            errorMessage =
                                if (isConnectivity) {
                                    DRAFT_SAVED_OFFLINE_MESSAGE
                                } else {
                                    result.error.message ?: "Couldn't post your task. Please try again."
                                },
                        )
                    }
                }
            }
        }

        /**
         * P6c — snapshot the scalar form into the offline queue (same
         * `composeGig2.*` encoding as [SavedStateHandle]). Re-enqueueing
         * within one session replaces the earlier copy.
         */
        private fun enqueueDraft() {
            val draft = queuedDraftOf(_state.value.form, id = queuedDraftId)
            queuedDraftId = draft.id
            draftQueue.enqueue(draft)
        }

        /**
         * A12.8 — undo a just-posted gig within its window
         * (`POST /api/gigs/:gigId/undo`). Success returns to the Review
         * step with the form intact + a "Task undone" toast.
         */
        fun undoPost() {
            val result = _state.value.postResult ?: return
            if (System.currentTimeMillis() > result.undoDeadlineEpochMs) return
            viewModelScope.launch {
                when (repository.undoMagicPost(result.gigId)) {
                    is NetworkResult.Success -> {
                        _state.update {
                            it.copy(
                                createdGigId = null,
                                postResult = null,
                                showUndoneToast = true,
                                form = it.form.copy(step = GigComposeStep.Review.ordinal0),
                            )
                        }
                        persist()
                    }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(errorMessage = "Couldn't undo — the task may already be live.")
                        }
                }
            }
        }

        /** Clear the post-undo toast once the screen has shown it. */
        fun acknowledgeUndoneToast() {
            _state.update { it.copy(showUndoneToast = false) }
        }

        /**
         * Assemble the [MagicPostBody] from the form. Returns null if any
         * required field is missing — [primaryEnabled] should have caught
         * it but we double-check before sending. Delegates to the pure
         * companion [bodyFromForm] so the Gigs feed can rebuild the same
         * body when re-submitting a queued offline draft.
         */
        fun buildMagicPostBody(): MagicPostBody? = bodyFromForm(_state.value.form, aiConfidence = lastConfidence, aiDraft = lastDraft)

        /** Wire `engagement_mode` — user override, else the inferred default. */
        fun resolvedEngagementMode(form: GigComposeFormState = _state.value.form): String = resolveEngagementMode(form)

        // MARK: - Chrome derivation

        private fun computeChrome(state: GigComposeUiState): WizardChrome {
            val step = state.form.currentStep
            return WizardChrome(
                title = "Post a task",
                progressLabel = progressLabel(step),
                progressFraction = progressFraction(step),
                leading = leadingControl(step),
                primaryCtaLabel = primaryCtaLabel(state.form),
                primaryCtaEnabled = primaryEnabled(state) && !state.isSubmitting,
                secondaryCta = secondaryCta(state),
                isSubmitting = state.isSubmitting,
                dirty = step != GigComposeStep.Success && state.form.hasAnyData,
                showsProgressBar = step != GigComposeStep.Success,
                primaryCtaTestTag = primaryCtaTestTag(state.form),
                // P6c — dirty close also offers "Save draft" → offline queue.
                saveDraftLabel = "Save draft".takeIf { step != GigComposeStep.Success && state.form.hasAnyData },
            )
        }

        private fun leadingControl(step: GigComposeStep): WizardLeadingControl =
            when (step) {
                GigComposeStep.Describe, GigComposeStep.Success -> WizardLeadingControl.Close
                GigComposeStep.FillGaps,
                GigComposeStep.BudgetMode,
                GigComposeStep.Review,
                -> WizardLeadingControl.Back
            }

        private fun primaryCtaLabel(form: GigComposeFormState): String =
            when (form.currentStep) {
                GigComposeStep.Describe ->
                    if (form.composeMode == ComposeMode.Magic) "Review & post →" else "Pick a category to continue"
                GigComposeStep.FillGaps, GigComposeStep.BudgetMode -> "Continue"
                GigComposeStep.Review -> "Post task"
                GigComposeStep.Success -> "View task"
            }

        /** A12.8 — canonical cross-platform tag for the describe primary. */
        private fun primaryCtaTestTag(form: GigComposeFormState): String? =
            if (form.currentStep == GigComposeStep.Describe && form.composeMode == ComposeMode.Magic) {
                "gigCompose.cta.reviewPost"
            } else {
                null
            }

        private fun secondaryCta(state: GigComposeUiState): WizardSecondaryCta? {
            val form = state.form
            return when {
                form.currentStep == GigComposeStep.Success ->
                    WizardSecondaryCta(label = "Done", testTag = "composeGigDone")
                form.currentStep == GigComposeStep.Describe && form.composeMode == ComposeMode.Magic ->
                    // Ghost link beside the primary CTA → manual picker.
                    WizardSecondaryCta(label = "Pick category", testTag = "gigCompose.cta.pickCategory")
                else -> null
            }
        }

        private fun progressLabel(step: GigComposeStep): WizardProgressLabel {
            val number = step.stepNumber ?: return WizardProgressLabel.Hidden
            return WizardProgressLabel.StepOf(current = number, total = GigComposeStep.PROGRESS_TOTAL)
        }

        private fun progressFraction(step: GigComposeStep): Float? {
            val number = step.stepNumber ?: return null
            return number.toFloat() / GigComposeStep.PROGRESS_TOTAL
        }

        private fun primaryEnabled(state: GigComposeUiState): Boolean {
            val form = state.form
            return when (form.currentStep) {
                GigComposeStep.Describe ->
                    // Magic: enabled once an archetype is detected. Manual:
                    // enabled once a category tile is selected.
                    if (form.composeMode == ComposeMode.Magic) form.detectedArchetype != null else form.category != null
                // P0.2 — photo uploads in flight gate Continue / Post so a
                // submit never races a half-done upload.
                GigComposeStep.FillGaps ->
                    hasValidBasics(state) && hasValidSchedule(form) && hasValidLocation(form) && hasValidModules(form)
                GigComposeStep.BudgetMode -> hasValidBudget(form)
                GigComposeStep.Review -> buildMagicPostBody() != null && !hasUploadsInFlight(state)
                GigComposeStep.Success -> state.createdGigId != null
            }
        }

        private fun hasUploadsInFlight(state: GigComposeUiState): Boolean = state.photoUploads.any { !it.failed }

        private fun hasValidBasics(state: GigComposeUiState): Boolean =
            hasValidTitleAndDescription(state.form.title.trim(), state.form.description.trim()) &&
                state.form.photoIds.size + state.photoUploads.size <= GigComposeLimits.MAX_PHOTOS &&
                !hasUploadsInFlight(state)

        private fun hasValidBudget(form: GigComposeFormState): Boolean =
            form.budgetType?.let { type ->
                hasValidPrice(type, priceFromBudget(type, form.budgetMin))
            } ?: false

        private fun hasValidSchedule(form: GigComposeFormState): Boolean =
            when (form.scheduleType) {
                null -> false
                GigComposeScheduleType.OneTime -> isFutureInstant(form.scheduledStartISO)
                GigComposeScheduleType.Recurring, GigComposeScheduleType.Flexible -> true
            }

        /**
         * Module-level gate. Only the pro-service deposit is conditional
         * today: toggling "Require deposit" on demands a positive amount
         * (mirrors RN's deposit validation).
         */
        private fun hasValidModules(form: GigComposeFormState): Boolean {
            val archetype = form.taskArchetype ?: form.category?.let(::archetypeForCategory)
            if (archetype != ARCHETYPE_PRO_SERVICE) return true
            return form.proServiceDetails?.isDepositAmountMissing != true
        }

        private fun hasValidLocation(form: GigComposeFormState): Boolean =
            when (form.locationMode) {
                null -> false
                GigComposeLocationMode.YourAddress, GigComposeLocationMode.Virtual -> true
                GigComposeLocationMode.APlace -> form.placeAddress.isComplete
            }

        // MARK: - Persistence

        /** Mirror the scalar form into [SavedStateHandle] (`composeGig2.*`). */
        private fun persist() {
            formSnapshot(_state.value.form).forEach { (key, value) -> savedStateHandle[key] = value }
        }

        private fun restoreFormState(): GigComposeFormState = formFromSnapshot { key -> savedStateHandle.get<Any>(key) }

        companion object {
            // A12.8 — `composeGig2.*` prefix so stale 6-step snapshots
            // (the old `composeGig.*` keys) are ignored on restore.
            private const val KEY_STEP = "composeGig2.step"
            private const val KEY_COMPOSE_MODE = "composeGig2.composeMode"
            private const val KEY_DESCRIBE = "composeGig2.describeText"
            private const val KEY_DETECTED = "composeGig2.detectedArchetype"
            private const val KEY_ARCHETYPE = "composeGig2.taskArchetype"
            private const val KEY_CATEGORY = "composeGig2.category"
            private const val KEY_TITLE = "composeGig2.title"
            private const val KEY_DESCRIPTION = "composeGig2.description"
            private const val KEY_PHOTOS = "composeGig2.photos"
            private const val KEY_BUDGET_TYPE = "composeGig2.budgetType"
            private const val KEY_BUDGET_MIN = "composeGig2.budgetMin"
            private const val KEY_BUDGET_MAX = "composeGig2.budgetMax"
            private const val KEY_ESTIMATED_HOURS = "composeGig2.estimatedHours"
            private const val KEY_SCHEDULE_TYPE = "composeGig2.scheduleType"
            private const val KEY_SCHEDULED_START = "composeGig2.scheduledStart"
            private const val KEY_LOCATION_MODE = "composeGig2.locationMode"
            private const val KEY_PLACE_LINE1 = "composeGig2.placeLine1"
            private const val KEY_PLACE_CITY = "composeGig2.placeCity"
            private const val KEY_PLACE_STATE = "composeGig2.placeState"
            private const val KEY_PLACE_ZIP = "composeGig2.placeZip"
            private const val KEY_DEADLINE = "composeGig2.deadline"
            private const val KEY_CANCELLATION = "composeGig2.cancellationPolicy"
            private const val KEY_IS_URGENT = "composeGig2.isUrgent"
            private const val KEY_TAGS = "composeGig2.tags"
            private const val KEY_ENGAGEMENT = "composeGig2.engagementMode"
            private const val KEY_TOUCHED = "composeGig2.touchedFields"

            // P6c — persona switching (beneficiary business identity).
            private const val KEY_BENEFICIARY_ID = "composeGig2.beneficiaryUserId"
            private const val KEY_BENEFICIARY_LABEL = "composeGig2.beneficiaryLabel"

            /** P0.1 — debounce ahead of the backend magic-draft call. */
            private const val DETECTION_DEBOUNCE_MS = 700L

            /** P0.1 — minimum word count before the backend parse fires. */
            private const val MIN_DRAFT_WORDS = 3
            private const val MIN_DETECT_TEXT_LENGTH = 3
            private const val MAX_TAG_LENGTH = 50

            /** A12.8 — backend `UNDO_WINDOW_MS` fallback. */
            private const val DEFAULT_UNDO_WINDOW_MS = 10_000L

            /** P0.2 — `file_type` form field on `POST /api/files/upload`. */
            private const val GIG_PHOTO_FILE_TYPE = "gig_photo"

            // P0.1 — touched-field keys for the magic-draft prefill guard.
            private const val FIELD_CATEGORY = "category"
            private const val FIELD_TITLE = "title"
            private const val FIELD_DESCRIPTION = "description"
            private const val FIELD_BUDGET = "budget"
            private const val FIELD_SCHEDULE = "schedule"
            private const val FIELD_TAGS = "tags"
            private const val FIELD_URGENT = "urgent"
            private const val FIELD_EFFORT = "effort"
            private const val FIELD_MODULES = "modules"

            private fun wordCount(text: String): Int = text.trim().split(Regex("\\s+")).count { it.isNotEmpty() }

            /** "60.0" reads as "60" in the budget fields; keep cents when present. */
            internal fun formatBudgetValue(value: Double?): String? =
                value?.let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() }

            /**
             * A12.8 — pure `engagement_mode` default, mirroring
             * `inferEngagementMode` in `backend/services/offerScoringService.js`:
             * pro quotes for pro_service_quote, instant accept for
             * asap/urgent non-pro work, curated offers otherwise.
             */
            fun inferEngagementMode(
                archetype: String?,
                scheduleType: String?,
                isUrgent: Boolean,
            ): String =
                when {
                    archetype == "pro_service_quote" -> GigEngagementMode.Quotes.wireValue
                    scheduleType == "asap" || isUrgent -> GigEngagementMode.InstantAccept.wireValue
                    else -> GigEngagementMode.CuratedOffers.wireValue
                }

            /** Backend `task_archetype` that owns the delivery module. */
            internal const val ARCHETYPE_DELIVERY = "delivery_errand"

            /** Backend `task_archetype` that owns the pro-service module. */
            internal const val ARCHETYPE_PRO_SERVICE = "pro_service_quote"

            /**
             * A12.8 — manual-path default `task_archetype` for a category
             * (the magic draft supplies the real one when available).
             */
            fun archetypeForCategory(category: GigComposeCategory): String =
                when (category) {
                    GigComposeCategory.Handyman, GigComposeCategory.Cleaning -> "home_service"
                    GigComposeCategory.Moving -> "quick_help"
                    GigComposeCategory.PetCare, GigComposeCategory.ChildCare -> "care_task"
                    GigComposeCategory.Tutoring -> "quick_help"
                    GigComposeCategory.Delivery -> "delivery_errand"
                    GigComposeCategory.Tech -> "quick_help"
                    GigComposeCategory.Other -> "general"
                }

            /** A12.8 — wire `schedule_type` for the magic-post draft. */
            internal fun scheduleWireValue(form: GigComposeFormState): String =
                when {
                    form.isUrgent -> "asap"
                    form.scheduleType == GigComposeScheduleType.OneTime && form.scheduledStartISO != null -> "scheduled"
                    else -> "flexible"
                }

            /** Draft `location_mode` (home/current/address/map_pin only). */
            internal fun draftLocationMode(mode: GigComposeLocationMode): String =
                when (mode) {
                    GigComposeLocationMode.YourAddress -> "home"
                    GigComposeLocationMode.APlace -> "address"
                    // "Virtual" has no draft location_mode — home is the
                    // backend default; the outer location.mode is `custom`
                    // and task_format `remote` carries the meaning.
                    GigComposeLocationMode.Virtual -> "home"
                }

            /** Magic-post `text` — backend requires ≥3 chars even on the classic path. */
            internal fun magicPostText(
                form: GigComposeFormState,
                title: String,
                description: String,
            ): String =
                form.describeText
                    .trim()
                    .takeIf { it.length >= MAGIC_POST_TEXT_MIN }
                    ?.take(MAGIC_POST_TEXT_MAX)
                    ?: "$title. $description".take(MAGIC_POST_TEXT_MAX)

            private const val MAGIC_POST_TEXT_MIN = 3
            private const val MAGIC_POST_TEXT_MAX = 2000

            /**
             * P1.G — DTO → budget-step hint. Null (hidden) when the
             * benchmark is missing, has no comparables, or lacks any of
             * the three percentiles.
             */
            internal fun projectBenchmark(
                categoryLabel: String,
                dto: PriceBenchmarkDto?,
            ): GigComposePriceBenchmark? {
                if (dto == null || (dto.comparableCount ?: 0) <= 0) return null
                val low = dto.low ?: return null
                val high = dto.high ?: return null
                val median = dto.median ?: return null
                return GigComposePriceBenchmark(
                    hintText =
                        "Similar ${categoryLabel.lowercase()} tasks nearby: " +
                            "${moneyLabel(low)}–${moneyLabel(high)} · median ${moneyLabel(median)}",
                    basis = dto.basis?.replace('_', ' ')?.takeIf { it.isNotBlank() },
                )
            }

            private fun moneyLabel(value: Double): String = if (value % 1.0 == 0.0) "$${value.toInt()}" else String.format("$%.2f", value)

            /** P0.1 — draft budget → (min, max) field strings. */
            internal fun draftBudgetBounds(draft: MagicDraftDto): Pair<String?, String?> {
                val range = draft.budgetRange
                return when {
                    range?.min != null || range?.max != null ->
                        formatBudgetValue(range?.min) to formatBudgetValue(range?.max)
                    draft.budgetFixed != null -> formatBudgetValue(draft.budgetFixed) to null
                    draft.hourlyRate != null -> formatBudgetValue(draft.hourlyRate) to null
                    else -> null to null
                }
            }

            /** P0.1 — tolerant backend `schedule_type` → composer enum. */
            internal fun scheduleTypeFromDraft(raw: String?): GigComposeScheduleType? =
                when ((raw ?: "").lowercase().replace("_", "").replace("-", "")) {
                    "scheduled", "onetime", "once" -> GigComposeScheduleType.OneTime
                    "recurring", "repeat", "repeating" -> GigComposeScheduleType.Recurring
                    "flexible", "flex", "anytime", "asap", "today" -> GigComposeScheduleType.Flexible
                    else -> null
                }

            /** B.3 — deterministic keyword → archetype map (stand-in for backend NLP). */
            fun detectArchetype(text: String): GigComposeCategory? {
                val lower = text.lowercase()
                if (lower.length < MIN_DETECT_TEXT_LENGTH) return null

                fun has(words: List<String>) = words.any { lower.contains(it) }

                return when {
                    has(listOf("move", "moving", "haul", "u-haul", "load boxes")) -> GigComposeCategory.Moving
                    has(listOf("clean", "tidy", "scrub", "vacuum", "mop")) -> GigComposeCategory.Cleaning
                    has(
                        listOf(
                            "assemble", "ikea", "furniture", "shelf", "shelves", "mount", "drill",
                            "fix", "repair", "install", "handy", "patch", "drywall",
                        ),
                    ) -> GigComposeCategory.Handyman
                    has(listOf("dog", "cat", " pet", "puppy", "litter", "groom", "walk")) -> GigComposeCategory.PetCare
                    has(listOf("babysit", "nanny", "kids", "child", "daycare")) -> GigComposeCategory.ChildCare
                    has(listOf("tutor", "lesson", "math", "homework", "test prep", "teach")) -> GigComposeCategory.Tutoring
                    has(listOf("deliver", "pickup", "pick up", "drop off", "errand", "courier")) -> GigComposeCategory.Delivery
                    has(
                        listOf("wifi", "wi-fi", "computer", "laptop", "printer", "router", "troubleshoot", "setup"),
                    ) -> GigComposeCategory.Tech
                    else -> null
                }
            }

            /**
             * E.1 — normalise a freeform tag for storage: trimmed,
             * lowercased, without a leading `#`, whitespace collapsed to
             * single hyphens, capped at 50 chars. Returns null for empty
             * input.
             */
            internal fun normalizeTag(raw: String): String? {
                val withoutHash = raw.trim().lowercase().removePrefix("#")
                val hyphenated =
                    withoutHash
                        .split(Regex("\\s+"))
                        .filter { it.isNotEmpty() }
                        .joinToString("-")
                return hyphenated.take(MAX_TAG_LENGTH).ifEmpty { null }
            }

            /** Strip everything except digits + a single decimal point. */
            internal fun sanitizeBudget(raw: String): String {
                var seenDot = false
                val out = StringBuilder()
                for (c in raw) {
                    if (c.isDigit()) {
                        out.append(c)
                    } else if (c == '.' && !seenDot) {
                        out.append(c)
                        seenDot = true
                    }
                }
                return out.toString()
            }

            internal fun priceFromBudget(
                type: GigComposeBudgetType,
                budgetMin: String,
            ): Double =
                when (type) {
                    GigComposeBudgetType.Offers -> 0.0
                    GigComposeBudgetType.Fixed, GigComposeBudgetType.Hourly -> budgetMin.toDoubleOrNull() ?: 0.0
                }

            // MARK: - P6c shared form snapshot + body assembly

            /**
             * Scalar form → `composeGig2.*` map. Single encoding shared by
             * [SavedStateHandle] persistence and the offline
             * [GigDraftQueue] (module objects stay in-memory in both).
             */
            internal fun formSnapshot(form: GigComposeFormState): Map<String, Any?> =
                mapOf(
                    KEY_STEP to form.step,
                    KEY_COMPOSE_MODE to form.composeMode.name,
                    KEY_DESCRIBE to form.describeText,
                    KEY_DETECTED to form.detectedArchetype?.name,
                    KEY_ARCHETYPE to form.taskArchetype,
                    KEY_CATEGORY to form.category?.name,
                    KEY_TITLE to form.title,
                    KEY_DESCRIPTION to form.description,
                    KEY_PHOTOS to ArrayList(form.photoIds),
                    KEY_BUDGET_TYPE to form.budgetType?.name,
                    KEY_BUDGET_MIN to form.budgetMin,
                    KEY_BUDGET_MAX to form.budgetMax,
                    KEY_ESTIMATED_HOURS to form.estimatedHours,
                    KEY_SCHEDULE_TYPE to form.scheduleType?.name,
                    KEY_SCHEDULED_START to form.scheduledStartISO,
                    KEY_LOCATION_MODE to form.locationMode?.name,
                    KEY_PLACE_LINE1 to form.placeAddress.line1,
                    KEY_PLACE_CITY to form.placeAddress.city,
                    KEY_PLACE_STATE to form.placeAddress.state,
                    KEY_PLACE_ZIP to form.placeAddress.zip,
                    KEY_DEADLINE to form.deadlineISO,
                    KEY_CANCELLATION to form.cancellationPolicy?.name,
                    KEY_IS_URGENT to form.isUrgent,
                    KEY_TAGS to ArrayList(form.tags),
                    KEY_ENGAGEMENT to form.engagementOverride?.name,
                    KEY_BENEFICIARY_ID to form.beneficiaryUserId,
                    KEY_BENEFICIARY_LABEL to form.beneficiaryLabel,
                )

            /** Inverse of [formSnapshot] over any key-value source. */
            @Suppress("CyclomaticComplexMethod")
            internal fun formFromSnapshot(read: (String) -> Any?): GigComposeFormState {
                fun string(key: String): String? = read(key) as? String

                fun stringList(key: String): List<String> = (read(key) as? List<*>)?.filterIsInstance<String>() ?: emptyList()
                return GigComposeFormState(
                    step = read(KEY_STEP) as? Int ?: GigComposeStep.Describe.ordinal0,
                    composeMode =
                        string(KEY_COMPOSE_MODE)?.let { name -> ComposeMode.entries.firstOrNull { it.name == name } }
                            ?: ComposeMode.Magic,
                    describeText = string(KEY_DESCRIBE) ?: "",
                    detectedArchetype =
                        string(KEY_DETECTED)?.let { name -> GigComposeCategory.entries.firstOrNull { it.name == name } },
                    taskArchetype = string(KEY_ARCHETYPE),
                    category = string(KEY_CATEGORY)?.let { name -> GigComposeCategory.entries.firstOrNull { it.name == name } },
                    title = string(KEY_TITLE) ?: "",
                    description = string(KEY_DESCRIPTION) ?: "",
                    photoIds = stringList(KEY_PHOTOS),
                    budgetType =
                        string(KEY_BUDGET_TYPE)?.let { name -> GigComposeBudgetType.entries.firstOrNull { it.name == name } },
                    budgetMin = string(KEY_BUDGET_MIN) ?: "",
                    budgetMax = string(KEY_BUDGET_MAX) ?: "",
                    estimatedHours = string(KEY_ESTIMATED_HOURS) ?: "",
                    scheduleType =
                        string(KEY_SCHEDULE_TYPE)?.let { name -> GigComposeScheduleType.entries.firstOrNull { it.name == name } },
                    scheduledStartISO = string(KEY_SCHEDULED_START),
                    locationMode =
                        string(KEY_LOCATION_MODE)?.let { name -> GigComposeLocationMode.entries.firstOrNull { it.name == name } },
                    placeAddress =
                        GigComposePlaceAddress(
                            line1 = string(KEY_PLACE_LINE1) ?: "",
                            city = string(KEY_PLACE_CITY) ?: "",
                            state = string(KEY_PLACE_STATE) ?: "",
                            zip = string(KEY_PLACE_ZIP) ?: "",
                        ),
                    deadlineISO = string(KEY_DEADLINE),
                    cancellationPolicy =
                        string(KEY_CANCELLATION)?.let { name -> GigCancellationPolicy.entries.firstOrNull { it.name == name } },
                    isUrgent = read(KEY_IS_URGENT) as? Boolean ?: false,
                    tags = stringList(KEY_TAGS),
                    engagementOverride =
                        string(KEY_ENGAGEMENT)?.let { name -> GigEngagementMode.entries.firstOrNull { it.name == name } },
                    beneficiaryUserId = string(KEY_BENEFICIARY_ID),
                    beneficiaryLabel = string(KEY_BENEFICIARY_LABEL),
                )
            }

            /** P6c — wrap the form snapshot as an offline-queue entry. */
            internal fun queuedDraftOf(
                form: GigComposeFormState,
                id: String? = null,
            ): GigQueuedDraft =
                GigQueuedDraft(
                    id = id ?: UUID.randomUUID().toString(),
                    createdAtEpochMs = System.currentTimeMillis(),
                    title =
                        form.title.trim().ifEmpty { form.describeText.trim() }.ifEmpty { "Untitled task" }
                            .take(DRAFT_TITLE_MAX),
                    form = formSnapshot(form),
                )

            /** P6c — queued draft → magic-post body (feed retry path). */
            fun bodyFromQueuedDraft(draft: GigQueuedDraft): MagicPostBody? = bodyFromForm(formFromSnapshot { draft.form[it] })

            private const val DRAFT_TITLE_MAX = 80

            /** P6c — offline / transport-failure submit message. */
            internal const val DRAFT_SAVED_OFFLINE_MESSAGE =
                "You're offline — draft saved. Post it from the Gigs feed when you're back online."

            /** Wire `engagement_mode` — user override, else the inferred default. */
            internal fun resolveEngagementMode(form: GigComposeFormState): String =
                form.engagementOverride?.wireValue
                    ?: inferEngagementMode(
                        archetype = form.taskArchetype ?: form.category?.let(::archetypeForCategory),
                        scheduleType = scheduleWireValue(form),
                        isUrgent = form.isUrgent,
                    )

            /**
             * Pure [MagicPostBody] assembly. Returns null when a required
             * field is missing or invalid (e.g. a queued draft whose
             * scheduled start slipped into the past).
             */
            @Suppress("ReturnCount", "LongMethod")
            internal fun bodyFromForm(
                form: GigComposeFormState,
                aiConfidence: Double? = null,
                aiDraft: MagicDraftDto? = null,
            ): MagicPostBody? {
                val title = form.title.trim()
                val description = form.description.trim()
                val budgetType = form.budgetType ?: return null
                val scheduleType = form.scheduleType ?: return null
                val locationMode = form.locationMode ?: return null
                if (!hasValidTitleAndDescription(title, description)) return null
                if (!hasValidPrice(budgetType, priceFromBudget(budgetType, form.budgetMin))) return null
                if (!hasValidScheduledStart(scheduleType, form.scheduledStartISO)) return null
                val location = composedLocation(locationMode, form.placeAddress) ?: return null
                val amount = form.budgetMin.toDoubleOrNull()
                val scheduleWire = scheduleWireValue(form)
                val urgentDetails = resolvedUrgentDetails(form, aiDraft)
                // Flat module columns only ride when their module is the
                // active one — mirrors RN's `showDelivery` /
                // `showProServices` gates (`gig-v2/new.tsx:325-343`).
                val archetype = form.taskArchetype ?: form.category?.let(::archetypeForCategory)
                val delivery = form.deliveryDetails.takeIf { archetype == ARCHETYPE_DELIVERY }
                val pro = form.proServiceDetails.takeIf { archetype == ARCHETYPE_PRO_SERVICE }
                if (pro?.isDepositAmountMissing == true) return null
                val draft =
                    MagicDraftDto(
                        title = title,
                        description = description,
                        category = form.category?.key,
                        taskArchetype = archetype,
                        payType = budgetType.wireValue,
                        budgetFixed = if (budgetType == GigComposeBudgetType.Fixed) amount else null,
                        hourlyRate = if (budgetType == GigComposeBudgetType.Hourly) amount else null,
                        estimatedHours = form.estimatedHours.toDoubleOrNull(),
                        scheduleType = scheduleWire,
                        timeWindowStart = if (scheduleWire == "scheduled") form.scheduledStartISO else null,
                        // E.1 deadline sheet → the draft's time-window end (the
                        // magic-post schema has no standalone `deadline`).
                        timeWindowEnd = form.deadlineISO,
                        locationMode = draftLocationMode(locationMode),
                        isUrgent = form.isUrgent.takeIf { it },
                        tags = form.tags.ifEmpty { null },
                        attachments = form.photoIds.ifEmpty { null },
                        items = form.items.filter { it.name.isNotBlank() }.ifEmpty { null },
                        cancellationPolicy = form.cancellationPolicy?.wireValue,
                        startsAsap = urgentDetails?.startsAsap,
                        responseWindowMinutes = urgentDetails?.responseWindowMinutes,
                        careDetails = form.careDetails,
                        logisticsDetails = form.logisticsDetails,
                        remoteDetails = form.remoteDetails,
                        urgentDetails = urgentDetails,
                        eventDetails = form.eventDetails,
                        pickupAddress = delivery?.pickupAddress?.trim()?.ifEmpty { null },
                        pickupNotes = delivery?.pickupNotes?.trim()?.ifEmpty { null },
                        dropoffAddress = delivery?.dropoffAddress?.trim()?.ifEmpty { null },
                        dropoffNotes = delivery?.dropoffNotes?.trim()?.ifEmpty { null },
                        deliveryProofRequired = delivery?.proofRequired,
                        requiresLicense = pro?.requiresLicense,
                        licenseType = pro?.licenseType?.trim()?.ifEmpty { null },
                        requiresInsurance = pro?.requiresInsurance,
                        scopeDescription = pro?.scopeDescription?.trim()?.ifEmpty { null },
                        depositRequired = pro?.depositRequired,
                        depositAmount = pro?.takeIf { it.depositRequired }?.depositAmount?.toDoubleOrNull(),
                    )
                return MagicPostBody(
                    text = magicPostText(form, title, description),
                    draft = draft,
                    location =
                        MagicPostLocation(
                            mode = location.mode,
                            latitude = location.latitude,
                            longitude = location.longitude,
                            address = location.address,
                            city = location.city,
                            state = location.state,
                            zip = location.zip,
                        ),
                    // P6c — persona switching: null posts as Personal, a
                    // business's postable user id posts on its behalf.
                    beneficiaryUserId = form.beneficiaryUserId,
                    sourceFlow = if (form.composeMode == ComposeMode.Magic) "magic" else "classic",
                    engagementMode = resolveEngagementMode(form),
                    taskFormat = taskFormatFor(locationMode),
                    aiConfidence = aiConfidence,
                    aiDraftJson = aiDraft,
                )
            }

            internal fun hasValidTitleAndDescription(
                title: String,
                description: String,
            ): Boolean =
                title.length in GigComposeLimits.TITLE_MIN..GigComposeLimits.TITLE_MAX &&
                    description.length in GigComposeLimits.DESCRIPTION_MIN..GigComposeLimits.DESCRIPTION_MAX

            internal fun hasValidPrice(
                type: GigComposeBudgetType,
                price: Double,
            ): Boolean = type == GigComposeBudgetType.Offers || price > 0.0

            internal fun hasValidScheduledStart(
                type: GigComposeScheduleType,
                scheduledStart: String?,
            ): Boolean = type != GigComposeScheduleType.OneTime || isFutureInstant(scheduledStart)

            internal fun isFutureInstant(iso: String?): Boolean =
                iso?.let { value ->
                    try {
                        Instant.parse(value).isAfter(Instant.now())
                    } catch (_: DateTimeParseException) {
                        false
                    }
                } ?: false

            private fun taskFormatFor(mode: GigComposeLocationMode): String? =
                if (mode == GigComposeLocationMode.Virtual) {
                    "remote"
                } else {
                    null
                }

            /** Urgent module rides along whenever the boost is on. */
            private fun resolvedUrgentDetails(
                form: GigComposeFormState,
                aiDraft: MagicDraftDto?,
            ): UrgentDetailsDto? =
                when {
                    !form.isUrgent -> null
                    else -> aiDraft?.urgentDetails ?: UrgentDetailsDto(startsAsap = true)
                }

            private data class ComposedLocation(
                val mode: String,
                val latitude: Double,
                val longitude: Double,
                val address: String,
                val city: String? = null,
                val state: String? = null,
                val zip: String? = null,
            )

            private fun composedLocation(
                mode: GigComposeLocationMode,
                place: GigComposePlaceAddress,
            ): ComposedLocation? =
                when (mode) {
                    GigComposeLocationMode.YourAddress ->
                        ComposedLocation(
                            mode = mode.wireMode,
                            latitude = 0.0,
                            longitude = 0.0,
                            address = "Your saved address",
                        )
                    GigComposeLocationMode.APlace -> {
                        if (!place.isComplete) {
                            null
                        } else {
                            ComposedLocation(
                                mode = mode.wireMode,
                                latitude = 0.0,
                                longitude = 0.0,
                                address = place.line1.trim(),
                                city = place.city.trim(),
                                state = place.state.trim(),
                                zip = place.zip.trim(),
                            )
                        }
                    }
                    GigComposeLocationMode.Virtual ->
                        ComposedLocation(
                            mode = mode.wireMode,
                            latitude = 0.0,
                            longitude = 0.0,
                            address = "Remote / Online",
                        )
                }
        }
    }
