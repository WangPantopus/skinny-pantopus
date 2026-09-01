@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.gigs.quickpost

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.gigs.CreateGigBody
import app.pantopus.android.data.api.models.gigs.CreateGigLocation
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigItemDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.ui.screens.gigs.GigsCategory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.UUID
import javax.inject.Inject

enum class PostGigV1PriceType(
    val label: String,
    val unitLabel: String?,
) {
    Flat("Flat", "flat"),
    Hourly("Hourly", "/ hr"),
    Free("Free", null),
}

enum class PostGigV1PhotoTone { Sofa, Stairs, Street, Neutral }

/** P0.2 — per-tile upload lifecycle for the photo grid. */
enum class PostGigV1PhotoStatus { Uploading, Failed, Uploaded }

data class PostGigV1Photo(
    val id: String,
    val tone: PostGigV1PhotoTone,
    /** P0.2 — upload state; sample/preview tiles default to uploaded. */
    val status: PostGigV1PhotoStatus = PostGigV1PhotoStatus.Uploaded,
    /** P0.2 — backend URL once the upload lands; rides `attachments`. */
    val url: String? = null,
)

/**
 * `cancellation_policy` — the three values `createGigSchema` /
 * `updateGigSchema` accept (`backend/routes/gigs.js:438` / `:649`).
 * Labels + blurbs mirror the backend's `CANCELLATION_POLICIES` table
 * (`gigs.js:541`) so the picker states the real rule.
 */
enum class PostGigV1CancellationPolicy(
    val wire: String,
    val label: String,
    val blurb: String,
) {
    Flexible("flexible", "Flexible", "Free cancellation anytime before work starts."),
    Standard("standard", "Standard", "Free within 1 hour of acceptance. After that, 5% fee."),
    Strict("strict", "Strict", "10% fee after acceptance. 50% after work starts."),
    ;

    companion object {
        fun fromWire(value: String?): PostGigV1CancellationPolicy = entries.firstOrNull { it.wire == value } ?: Standard
    }
}

/**
 * One errand / shopping line item (`Gig.items` jsonb). Mirrors RN's
 * `TaskItem` (`gig/_components/useGigForm.ts:68`).
 */
data class PostGigV1Item(
    val id: String = UUID.randomUUID().toString(),
    val name: String = "",
    val notes: String = "",
    val budgetCap: String = "",
    val preferredStore: String = "",
) {
    val isEmpty: Boolean
        get() = name.isBlank() && notes.isBlank() && budgetCap.isBlank() && preferredStore.isBlank()
}

data class PostGigV1Form(
    val category: GigsCategory = GigsCategory.All,
    val title: String = "",
    val description: String = "",
    val price: String = "",
    val priceType: PostGigV1PriceType = PostGigV1PriceType.Flat,
    val scheduledAt: LocalDateTime = LocalDateTime.now().plusDays(1),
    val location: String = "",
    val photos: List<PostGigV1Photo> = emptyList(),
    // A13.8 P5 — the fields RN's editor has always carried.
    val cancellationPolicy: PostGigV1CancellationPolicy = PostGigV1CancellationPolicy.Standard,
    val isUrgent: Boolean = false,
    /** Comma-separated, exactly like RN's single text input. */
    val tags: String = "",
    /** Optional "must be done by" date (`deadline`). Null ⇒ omitted. */
    val deadline: LocalDateTime? = null,
    /** Hours, free-text so an empty field means "omit". */
    val estimatedDuration: String = "",
    val items: List<PostGigV1Item> = emptyList(),
) {
    /** Trimmed, non-empty, capped at the schema's five. */
    val parsedTags: List<String>
        get() =
            tags
                .split(",")
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .take(PostGigV1SampleData.MAX_TAGS)

    /** RN keeps only items with a name (`useGigForm.ts:346`). */
    val validItems: List<PostGigV1Item>
        get() = items.filter { it.name.isNotBlank() }

    val hasAnyInput: Boolean
        get() =
            category != GigsCategory.All ||
                title.isNotBlank() ||
                description.isNotBlank() ||
                price.isNotBlank() ||
                priceType != PostGigV1PriceType.Flat ||
                location.isNotBlank() ||
                photos.isNotEmpty() ||
                cancellationPolicy != PostGigV1CancellationPolicy.Standard ||
                isUrgent ||
                tags.isNotBlank() ||
                deadline != null ||
                estimatedDuration.isNotBlank() ||
                items.any { !it.isEmpty }
}

enum class PostGigV1Field { Category, Title, Description, Price, DateTime, Location, EstimatedDuration }

data class PostGigV1ValidationError(
    val field: PostGigV1Field,
    val message: String,
)

sealed interface PostGigV1UiState {
    data object Loading : PostGigV1UiState

    data object Empty : PostGigV1UiState

    data class Content(
        val form: PostGigV1Form = PostGigV1Form(),
        val validationErrors: List<PostGigV1ValidationError> = emptyList(),
        val isSubmitting: Boolean = false,
        val postedGigId: String? = null,
    ) : PostGigV1UiState {
        /** P0.2 — true while any photo upload is still in flight. */
        val hasUploadsInFlight: Boolean = form.photos.any { it.status == PostGigV1PhotoStatus.Uploading }
        val canAttemptSubmit: Boolean = !isSubmitting && !hasUploadsInFlight
        val isPostEnabled: Boolean = canAttemptSubmit && (form.hasAnyInput || validationErrors.isNotEmpty())
    }

    data class FatalError(
        val message: String,
    ) : PostGigV1UiState
}

sealed interface PostGigV1Event {
    data class Posted(
        val gigId: String,
    ) : PostGigV1Event
}

@HiltViewModel
class PostGigV1ViewModel
    @Inject
    constructor(
        private val repo: GigsRepository,
        private val filesRepo: FilesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        /**
         * A13.8 P4 — edit mode. Set via the `gigs/quick-post?editGigId=…`
         * route variant; the form prefills from `GET /api/gigs/{id}` and
         * submit PATCHes instead of POSTing.
         */
        private val editGigId: String? = savedStateHandle.get<String>(EDIT_GIG_ID_KEY)

        /** Drives the "Edit gig" title + "Save" CTA on the shell. */
        val isEditMode: Boolean = editGigId != null

        private val _state =
            MutableStateFlow<PostGigV1UiState>(
                if (editGigId == null) PostGigV1UiState.Content() else PostGigV1UiState.Loading,
            )
        val state: StateFlow<PostGigV1UiState> = _state.asStateFlow()

        private val _pendingEvent = MutableStateFlow<PostGigV1Event?>(null)
        val pendingEvent: StateFlow<PostGigV1Event?> = _pendingEvent.asStateFlow()

        // Stashed so a post failure can flip to FatalError yet restore the
        // filled form on retry (mirrors iOS, where the form survives .error).
        private var lastForm: PostGigV1Form? = null

        // P0.2 — picked-photo bytes (for retry) + per-tile upload jobs.
        private val pendingPhotoBytes = mutableMapOf<String, PostGigV1PickedPhoto>()
        private val uploadJobs = mutableMapOf<String, Job>()

        init {
            editGigId?.let(::loadForEdit)
        }

        fun acknowledgeEvent() {
            _pendingEvent.value = null
        }

        fun retry() {
            val stashed = lastForm
            // P4 — a failed edit-mode *load* has no stashed form: re-fetch
            // instead of dropping the user into a blank create form.
            if (stashed == null && editGigId != null) {
                _state.value = PostGigV1UiState.Loading
                loadForEdit(editGigId)
                return
            }
            _state.value = PostGigV1UiState.Content(form = stashed ?: PostGigV1Form())
            lastForm = null
        }

        fun startFromEmpty() {
            _state.value = PostGigV1UiState.Content()
        }

        fun preselectCategoryIfNeeded(category: GigsCategory) {
            updateContent { content ->
                if (content.form.category != GigsCategory.All || category == GigsCategory.All) {
                    content
                } else {
                    content.copy(form = content.form.copy(category = category))
                }
            }
        }

        fun updateCategory(category: GigsCategory) {
            updateForm { it.copy(category = category) }
        }

        fun updateTitle(title: String) {
            updateForm { it.copy(title = title) }
        }

        fun updateDescription(description: String) {
            updateForm {
                it.copy(description = description.take(PostGigV1SampleData.DESCRIPTION_MAX_LENGTH))
            }
        }

        fun updatePrice(price: String) {
            updateForm {
                // P4 — the field is disabled for Free; guard against stray edits.
                if (it.priceType == PostGigV1PriceType.Free) {
                    it
                } else {
                    it.copy(price = price.filter { char -> char.isDigit() || char == '.' })
                }
            }
        }

        fun updatePriceType(type: PostGigV1PriceType) {
            updateForm {
                it.copy(priceType = type, price = if (type == PostGigV1PriceType.Free) "" else it.price)
            }
        }

        fun updateScheduledAt(date: LocalDateTime) {
            updateForm { it.copy(scheduledAt = date) }
        }

        fun updateLocation(location: String) {
            updateForm { it.copy(location = location) }
        }

        // MARK: - A13.8 P5 — the rest of RN's editable field set

        fun updateCancellationPolicy(policy: PostGigV1CancellationPolicy) {
            updateForm { it.copy(cancellationPolicy = policy) }
        }

        fun updateIsUrgent(isUrgent: Boolean) {
            updateForm { it.copy(isUrgent = isUrgent) }
        }

        fun updateTags(tags: String) {
            updateForm { it.copy(tags = tags) }
        }

        fun updateDeadline(deadline: LocalDateTime?) {
            updateForm { it.copy(deadline = deadline) }
        }

        fun updateEstimatedDuration(hours: String) {
            updateForm { it.copy(estimatedDuration = hours.filter { c -> c.isDigit() || c == '.' }) }
        }

        fun addItem() {
            updateForm { form ->
                if (form.items.size >= PostGigV1SampleData.MAX_ITEMS) form else form.copy(items = form.items + PostGigV1Item())
            }
        }

        fun updateItem(
            id: String,
            transform: (PostGigV1Item) -> PostGigV1Item,
        ) {
            updateForm { form ->
                form.copy(items = form.items.map { if (it.id == id) transform(it) else it })
            }
        }

        fun removeItem(id: String) {
            updateForm { form -> form.copy(items = form.items.filterNot { it.id == id }) }
        }

        /**
         * P0.2 — accept a picked photo and upload it immediately via
         * `POST /api/files/upload` (`FilesRepository`). The tile tracks
         * uploading / failed (tap-to-retry) / uploaded-URL states.
         */
        fun addPickedPhoto(picked: PostGigV1PickedPhoto) {
            val content = _state.value as? PostGigV1UiState.Content ?: return
            if (content.form.photos.size >= PostGigV1SampleData.MAX_PHOTOS) return
            val id = "photo-${UUID.randomUUID()}"
            pendingPhotoBytes[id] = picked
            updateForm { form ->
                form.copy(
                    photos =
                        form.photos +
                            PostGigV1Photo(
                                id = id,
                                tone = PostGigV1PhotoTone.Neutral,
                                status = PostGigV1PhotoStatus.Uploading,
                            ),
                )
            }
            startUpload(id)
        }

        /** P0.2 — retry a failed upload tile (bytes are still held). */
        fun retryPhotoUpload(id: String) {
            if (pendingPhotoBytes[id] == null) return
            updatePhoto(id) { it.copy(status = PostGigV1PhotoStatus.Uploading) }
            startUpload(id)
        }

        fun removePhoto(id: String) {
            uploadJobs.remove(id)?.cancel()
            pendingPhotoBytes.remove(id)
            updateForm { it.copy(photos = it.photos.filterNot { photo -> photo.id == id }) }
        }

        private fun startUpload(id: String) {
            val picked = pendingPhotoBytes[id] ?: return
            uploadJobs[id] =
                viewModelScope.launch {
                    val result =
                        filesRepo.uploadFile(
                            filename = picked.filename,
                            mimeType = picked.mimeType,
                            bytes = picked.bytes,
                            fileType = GIG_PHOTO_FILE_TYPE,
                            visibility = "public",
                        )
                    when (result) {
                        is NetworkResult.Success -> {
                            pendingPhotoBytes.remove(id)
                            uploadJobs.remove(id)
                            updatePhoto(id) {
                                it.copy(status = PostGigV1PhotoStatus.Uploaded, url = result.data.file.url)
                            }
                        }
                        is NetworkResult.Failure ->
                            updatePhoto(id) { it.copy(status = PostGigV1PhotoStatus.Failed) }
                    }
                }
        }

        private fun updatePhoto(
            id: String,
            transform: (PostGigV1Photo) -> PostGigV1Photo,
        ) {
            updateForm { form ->
                form.copy(photos = form.photos.map { if (it.id == id) transform(it) else it })
            }
        }

        /**
         * P4 — edit mode. Prefill the form from `GET /api/gigs/{id}`
         * (`GigsRepository.detail`); attachments become already-uploaded
         * photo tiles. A load failure flips to FatalError and retry
         * re-fetches.
         */
        private fun loadForEdit(gigId: String) {
            viewModelScope.launch {
                when (val result = repo.detail(gigId)) {
                    is NetworkResult.Success ->
                        _state.value = PostGigV1UiState.Content(form = formFrom(result.data.gig))
                    is NetworkResult.Failure ->
                        _state.value = PostGigV1UiState.FatalError(result.error.message)
                }
            }
        }

        /** P4 — map a loaded gig back onto the V1 form for editing. */
        private fun formFrom(gig: GigDto): PostGigV1Form {
            val priceType =
                when (gig.payType) {
                    "hourly" -> PostGigV1PriceType.Hourly
                    "offers" -> PostGigV1PriceType.Free
                    else -> PostGigV1PriceType.Flat
                }
            return PostGigV1Form(
                category = GigsCategory.fromBackendKey(gig.category),
                title = gig.title,
                description = gig.description.orEmpty(),
                price = if (priceType == PostGigV1PriceType.Free) "" else formatPrice(gig.price),
                priceType = priceType,
                scheduledAt = parseScheduledStart(gig.scheduledStart) ?: PostGigV1Form().scheduledAt,
                location = gig.exactAddress ?: gig.pickupAddress ?: "",
                photos =
                    gig.attachments.orEmpty().mapIndexed { index, url ->
                        PostGigV1Photo(
                            id = "existing-$index",
                            tone = PostGigV1PhotoTone.Neutral,
                            status = PostGigV1PhotoStatus.Uploaded,
                            url = url,
                        )
                    },
                // A13.8 P5 — the rest of RN's prefill (`useGigForm.ts:90-116`).
                cancellationPolicy = PostGigV1CancellationPolicy.fromWire(gig.cancellationPolicy),
                isUrgent = gig.isUrgent == true,
                tags = gig.tags.orEmpty().joinToString(", "),
                deadline = parseScheduledStart(gig.deadline),
                estimatedDuration = formatDuration(gig.estimatedDuration),
                items =
                    gig.items
                        .orEmpty()
                        .map {
                            PostGigV1Item(
                                name = it.name.orEmpty(),
                                notes = it.notes.orEmpty(),
                                budgetCap = it.budgetCapText.orEmpty(),
                                preferredStore = it.preferredStore.orEmpty(),
                            )
                        }.filterNot { it.isEmpty },
            )
        }

        private fun formatDuration(hours: Double?): String =
            when {
                hours == null || hours <= 0.0 -> ""
                hours % 1.0 == 0.0 -> hours.toLong().toString()
                else -> hours.toString()
            }

        private fun formatPrice(price: Double?): String =
            when {
                price == null || price <= 0.0 -> ""
                price % 1.0 == 0.0 -> price.toLong().toString()
                else -> price.toString()
            }

        /** Backend timestamps ride ISO offsets; Supabase can also emit naive stamps. */
        private fun parseScheduledStart(iso: String?): LocalDateTime? {
            if (iso.isNullOrBlank()) return null
            return runCatching {
                OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime()
            }.recoverCatching { LocalDateTime.parse(iso) }.getOrNull()
        }

        /**
         * Validate, then create the gig via `POST /api/gigs`
         * (`GigsRepository.create`) — the same create path the V2 composer
         * and gigs feed use — or, in edit mode, `PATCH /api/gigs/{id}`
         * (`GigsRepository.update`, same body fields). On success the
         * backend-issued id drives the Posted event; on failure we flip to
         * FatalError (the form is stashed so retry restores it).
         */
        fun submit(now: LocalDateTime = LocalDateTime.now()) {
            val current = _state.value as? PostGigV1UiState.Content ?: return
            // P0.2 — never race a half-done upload; the Post CTA is also
            // disabled while uploads are in flight.
            if (!current.canAttemptSubmit) return
            val errors = validate(current.form, now)
            if (errors.isNotEmpty()) {
                _state.value = current.copy(validationErrors = errors)
                return
            }
            _state.value = current.copy(validationErrors = emptyList(), isSubmitting = true)
            viewModelScope.launch {
                val body = buildCreateBody(current.form, forEdit = editGigId != null)
                val result =
                    if (editGigId == null) repo.create(body) else repo.update(editGigId, body)
                when (result) {
                    is NetworkResult.Success -> {
                        val gigId = result.data.gig.id
                        _state.value = current.copy(isSubmitting = false, postedGigId = gigId)
                        _pendingEvent.value = PostGigV1Event.Posted(gigId)
                    }
                    is NetworkResult.Failure -> {
                        lastForm = current.form
                        _state.value = PostGigV1UiState.FatalError(result.error.message)
                    }
                }
            }
        }

        /**
         * Map the V1 form onto the `POST /api/gigs` body (also reused as the
         * `PATCH /api/gigs/{id}` body — the route strips fields the update
         * schema doesn't take). The legacy composer collects a free-text
         * location only, so it rides as the `custom` location `address` with
         * a `(0, 0)` placeholder coordinate. Pay-type maps Flat→`fixed`,
         * Hourly→`hourly`, Free→`offers` with a true `price: 0` — the
         * backend schema accepts zero (`Joi.number().min(0)`,
         * `backend/routes/gigs.js:428` / `:644`).
         */
        private fun buildCreateBody(
            form: PostGigV1Form,
            forEdit: Boolean = false,
        ): CreateGigBody {
            val trimmedPrice = form.price.trim().toDoubleOrNull() ?: 0.0
            val payType: String
            val price: Double
            when (form.priceType) {
                PostGigV1PriceType.Flat -> {
                    payType = "fixed"
                    price = if (trimmedPrice > 0.0) trimmedPrice else 1.0
                }
                PostGigV1PriceType.Hourly -> {
                    payType = "hourly"
                    price = if (trimmedPrice > 0.0) trimmedPrice else 1.0
                }
                PostGigV1PriceType.Free -> {
                    payType = "offers"
                    price = 0.0
                }
            }
            val tags = form.parsedTags
            val items = form.validItems.map { it.toDto() }
            return CreateGigBody(
                title = form.title.trim(),
                description = form.description.trim(),
                category = if (form.category == GigsCategory.All) null else form.category.key,
                price = price,
                payType = payType,
                scheduleType = "scheduled",
                scheduledStart = form.scheduledAt.atZone(ZoneId.systemDefault()).toInstant().toString(),
                taskFormat = null,
                // P0.2 — uploaded photo URLs ride as attachments. P4 — edit
                // sends `[]` (not omission) so removing every photo persists.
                attachments =
                    form.photos.mapNotNull { it.url }.let { urls ->
                        if (forEdit) urls else urls.ifEmpty { null }
                    },
                // `deadline` / `estimated_duration` can only be *set*: the
                // update schema takes neither `null` (`gigs.js:646`), so an
                // empty field is omitted rather than cleared. The list-shaped
                // fields and the two flags always ride on an edit, otherwise
                // the editor could add but never remove.
                deadline = form.deadline?.atZone(ZoneId.systemDefault())?.toInstant()?.toString(),
                cancellationPolicy = form.cancellationPolicy.wire,
                isUrgent = if (forEdit) form.isUrgent else form.isUrgent.takeIf { it },
                tags = if (forEdit) tags else tags.ifEmpty { null },
                estimatedDuration = form.estimatedDuration.trim().toDoubleOrNull()?.takeIf { it > 0.0 },
                items = if (forEdit) items else items.ifEmpty { null },
                location =
                    CreateGigLocation(
                        mode = "custom",
                        latitude = 0.0,
                        longitude = 0.0,
                        address = form.location.trim(),
                    ),
            )
        }

        private fun PostGigV1Item.toDto(): GigItemDto =
            GigItemDto(
                name = name.trim().takeIf { it.isNotEmpty() },
                notes = notes.trim().takeIf { it.isNotEmpty() },
                budgetCap = budgetCap.trim().takeIf { it.isNotEmpty() },
                preferredStore = preferredStore.trim().takeIf { it.isNotEmpty() },
            )

        private fun updateForm(transform: (PostGigV1Form) -> PostGigV1Form) {
            updateContent { content -> content.copy(form = transform(content.form)) }
        }

        private fun updateContent(transform: (PostGigV1UiState.Content) -> PostGigV1UiState.Content) {
            val current = _state.value as? PostGigV1UiState.Content ?: return
            _state.value = transform(current)
        }

        private fun validate(
            form: PostGigV1Form,
            now: LocalDateTime,
        ): List<PostGigV1ValidationError> {
            val errors = mutableListOf<PostGigV1ValidationError>()
            if (form.category == GigsCategory.All) {
                errors += PostGigV1ValidationError(PostGigV1Field.Category, "Choose a category.")
            }
            if (form.title.isBlank()) {
                errors += PostGigV1ValidationError(PostGigV1Field.Title, "Title is required.")
            }
            if (form.description.trim().length < PostGigV1SampleData.DESCRIPTION_MIN_LENGTH) {
                errors +=
                    PostGigV1ValidationError(
                        PostGigV1Field.Description,
                        "Description must be at least ${PostGigV1SampleData.DESCRIPTION_MIN_LENGTH} characters.",
                    )
            }
            if (form.priceType != PostGigV1PriceType.Free) {
                val price = form.price.trim()
                if (price.isEmpty()) {
                    errors += PostGigV1ValidationError(PostGigV1Field.Price, "Enter a price, or pick Free.")
                } else if ((price.toDoubleOrNull() ?: 0.0) <= 0.0) {
                    errors += PostGigV1ValidationError(PostGigV1Field.Price, "Price must be greater than zero.")
                }
            }
            if (!form.scheduledAt.isAfter(now)) {
                errors += PostGigV1ValidationError(PostGigV1Field.DateTime, "Date is in the past. Pick a future time.")
            }
            if (form.location.isBlank()) {
                errors += PostGigV1ValidationError(PostGigV1Field.Location, "Add a pickup or meetup location.")
            }
            // RN's exact rule (`useGigForm.ts:290`).
            val duration = form.estimatedDuration.trim()
            if (duration.isNotEmpty() && (duration.toDoubleOrNull() ?: 0.0) <= 0.0) {
                errors +=
                    PostGigV1ValidationError(
                        PostGigV1Field.EstimatedDuration,
                        "Estimated duration must be a positive number.",
                    )
            }
            return errors
        }

        companion object {
            /** P0.2 — `file_type` form field on `POST /api/files/upload`. */
            private const val GIG_PHOTO_FILE_TYPE = "gig_photo"

            /** P4 — nav arg carrying the gig id when opened as an editor. */
            const val EDIT_GIG_ID_KEY = "editGigId"
        }
    }

/**
 * P0.2 — raw bytes of a picked photo, held by the view-model for upload +
 * retry. Not a data class — [bytes] is an array, so structural equality
 * would be misleading.
 */
class PostGigV1PickedPhoto(
    val filename: String,
    val mimeType: String,
    val bytes: ByteArray,
)
