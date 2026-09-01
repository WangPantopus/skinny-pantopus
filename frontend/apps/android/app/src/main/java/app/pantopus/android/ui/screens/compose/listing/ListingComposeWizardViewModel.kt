@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.compose.listing

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.ai.AIDraftRepository
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.ai.AIDraftListingVisionRequest
import app.pantopus.android.data.api.models.listings.CreateListingRequest
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.models.listings.UpdateListingRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.upload.UploadFile
import app.pantopus.android.data.upload.UploadRepository
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardSecondaryCta
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Base64
import javax.inject.Inject

private const val PHOTO_TOKEN_SUFFIX_LENGTH = 6

/** Aggregate UI state for the Snap & Sell wizard. */
data class ListingComposeUiState(
    val form: ListingComposeFormState = ListingComposeFormState.EMPTY,
    val isSubmitting: Boolean = false,
    val createdListingId: String? = null,
    val errorMessage: String? = null,
    /** True while the edit-mode prefill fetch is in flight. Drives a
     *  shimmer in the wizard body so the user can't tap through stale
     *  fields. Always false in create mode. */
    val isLoadingExisting: Boolean = false,
    /** True while the Snap & Sell vision draft is in flight. Drives
     *  the `listingComposeAnalyzing` shimmer on the snap-review step. */
    val isAnalyzing: Boolean = false,
)

/**
 * Drives the six-step + success Snap & Sell wizard. Submits to
 * `POST /api/listings` (`backend/routes/listings.js:426`) via
 * [ListingsRepository], and exposes the [WizardChrome] for the shared
 * [app.pantopus.android.ui.screens.shared.wizard.WizardShell].
 *
 * Form state is mirrored into [SavedStateHandle] so the wizard
 * survives config changes and process death.
 */
@HiltViewModel
@Suppress("TooManyFunctions")
open class ListingComposeWizardViewModel
    @Inject
    constructor(
        private val repository: ListingsRepository,
        private val savedStateHandle: SavedStateHandle,
        private val networkMonitor: NetworkMonitor,
        private val aiDraftRepository: AIDraftRepository,
        private val uploadRepository: UploadRepository,
    ) : ViewModel(),
        WizardModel {
        /** Whether the wizard is creating or editing. Derived once from
         *  the nav-arg listing id at construction so the rest of the VM
         *  can branch on it without re-reading SavedStateHandle. */
        private val mode: ListingComposeMode = resolveMode(savedStateHandle)

        /** True when editing an existing listing. */
        val isEditMode: Boolean get() = mode.isEdit

        /** The listing id being edited, or null in create mode. */
        val editingListingId: String? get() = mode.editingListingId

        val isCameraCaptureStep: Boolean
            get() {
                val form = _state.value.form
                return !isEditMode &&
                    form.currentStep == ListingComposeStep.Photos &&
                    form.entryMode == ListingComposeEntryMode.Snap
            }

        val isSnapReviewStep: Boolean
            get() {
                val form = _state.value.form
                return !isEditMode &&
                    form.currentStep == ListingComposeStep.TitleCategory &&
                    form.entryMode == ListingComposeEntryMode.Snap
            }

        val snapCaptureProgressText: String
            get() {
                val captured = _state.value.form.photos.size.coerceAtMost(ListingComposeFormState.TARGET_CAPTURE_ANGLES)
                val remaining = (ListingComposeFormState.TARGET_CAPTURE_ANGLES - captured).coerceAtLeast(0)
                return if (remaining == 0) {
                    "$captured of 4 angles · ready to review"
                } else {
                    "$captured of 4 angles · add $remaining more"
                }
            }

        val snapCoachingText: String
            get() =
                when (_state.value.form.photos.size) {
                    0 -> "Center the whole item · step back a bit"
                    1 -> "Get a wider shot for scale"
                    2 -> "Move closer for fabric and wear"
                    else -> "Looks great — capture now"
                }

        private val formPersistence = ListingComposeFormPersistence(savedStateHandle)

        private val _state =
            MutableStateFlow(formPersistence.restore().let { ListingComposeUiState(form = it) })

        /** Combined UI state consumed by [ListingComposeWizardScreen]. */
        val state: StateFlow<ListingComposeUiState> = _state.asStateFlow()

        /** One-shot navigation events the screen reacts to. */
        val pendingEvent = MutableStateFlow<ListingComposeOutboundEvent?>(null)

        // MARK: - WizardModel

        override val chrome: WizardChrome
            get() = computeChrome(_state.value)

        override fun onLeading() {
            val current = _state.value.form.currentStep
            when (leadingControl(current)) {
                WizardLeadingControl.Back -> goBack()
                WizardLeadingControl.Close -> pendingEvent.value = ListingComposeOutboundEvent.Dismiss
            }
        }

        override fun onDiscard() {
            pendingEvent.value = ListingComposeOutboundEvent.Dismiss
        }

        override fun onPrimary() {
            viewModelScope.launch { advance() }
        }

        override fun onSecondary() {
            if (isSnapReviewStep) {
                pendingEvent.value = ListingComposeOutboundEvent.Dismiss
                return
            }
            // Success step's "Back to Marketplace" (create) / "Done" (edit).
            if (_state.value.form.currentStep != ListingComposeStep.Success) return
            val listingId = _state.value.createdListingId
            pendingEvent.value =
                if (isEditMode && listingId != null) {
                    ListingComposeOutboundEvent.ListingUpdated(listingId)
                } else {
                    ListingComposeOutboundEvent.Dismiss
                }
        }

        fun acknowledgeEvent() {
            pendingEvent.value = null
        }

        /**
         * Fetch the existing listing and project it into the form.
         * No-op in create mode or once the form has been touched.
         * Idempotent — safe to call from `LaunchedEffect(Unit) { … }`.
         */
        suspend fun loadExistingIfNeeded() {
            val edit = mode as? ListingComposeMode.Edit ?: return
            if (_state.value.form != ListingComposeFormState.EMPTY) return
            _state.update { it.copy(isLoadingExisting = true) }
            when (val result = repository.detail(edit.listingId)) {
                is NetworkResult.Success -> {
                    val projected = project(result.data.listing, edit.jumpToStep)
                    _state.update {
                        it.copy(form = projected, errorMessage = null, isLoadingExisting = false)
                    }
                    persist()
                }
                is NetworkResult.Failure -> {
                    _state.update {
                        it.copy(
                            errorMessage =
                                result.error.message
                                    ?: "Couldn't load the listing. Pull to retry.",
                            isLoadingExisting = false,
                        )
                    }
                }
            }
        }

        // MARK: - Photo step

        /** Append a processed camera capture (1600px JPEG, EXIF stripped). */
        fun captureSnapPhoto(imageData: ByteArray) {
            val next = (_state.value.form.photos.size + 1).coerceAtMost(ListingComposeFormState.MAX_PHOTOS)
            addPhoto(token = "snap_angle_$next", localImageData = imageData)
        }

        /** Escape hatch from camera-first entry into the original photo-grid editor. */
        fun skipToManualPhotoEditor() {
            _state.update { it.copy(form = it.form.copy(entryMode = ListingComposeEntryMode.Manual)) }
            persist()
        }

        /** Append a batch of processed photo-library picks. */
        fun addLibraryPhotos(images: List<ByteArray>) {
            images.forEach { bytes ->
                val next = (_state.value.form.photos.size + 1).coerceAtMost(ListingComposeFormState.MAX_PHOTOS)
                addPhoto(token = "library_photo_$next", localImageData = bytes)
            }
        }

        /** Append a new photo to the grid. Captures up to [MAX_PHOTOS]. */
        fun addPhoto(
            token: String = "photo_${java.util.UUID.randomUUID().toString().take(PHOTO_TOKEN_SUFFIX_LENGTH)}",
            localImageData: ByteArray? = null,
        ) {
            _state.update { current ->
                if (current.form.photos.size >= ListingComposeFormState.MAX_PHOTOS) return@update current
                current.copy(
                    form =
                        current.form.copy(
                            photos = current.form.photos + ListingComposePhoto(token = token, localImageData = localImageData),
                        ),
                )
            }
            persist()
        }

        // MARK: - Vision draft (A12.9)

        /** One-shot guard — bouncing between capture and review doesn't re-bill. */
        private var hasRequestedAnalysis = false

        /**
         * `POST /api/ai/draft/listing-vision` with up to
         * [ListingComposeFormState.MAX_VISION_IMAGES] base64 data URLs.
         * Fills empty fields only; failure degrades to manual entry
         * with an inline notice.
         */
        suspend fun requestVisionAnalysisIfNeeded() {
            if (hasRequestedAnalysis) return
            val images =
                _state.value.form.photos
                    .mapNotNull { it.localImageData }
                    .take(ListingComposeFormState.MAX_VISION_IMAGES)
                    .map { "data:image/jpeg;base64,${Base64.getEncoder().encodeToString(it)}" }
            if (images.isEmpty()) return
            hasRequestedAnalysis = true
            _state.update { it.copy(isAnalyzing = true) }
            val result = aiDraftRepository.draftListingVision(AIDraftListingVisionRequest(images = images))
            when (result) {
                is NetworkResult.Success ->
                    _state.update {
                        it.copy(
                            form = ListingComposeVisionMapping.applyVision(it.form, result.data),
                            isAnalyzing = false,
                        )
                    }
                is NetworkResult.Failure ->
                    _state.update {
                        it.copy(
                            isAnalyzing = false,
                            errorMessage = "Couldn't generate suggestions from your photos. Fill in the details below.",
                        )
                    }
            }
            persist()
        }

        /** Remove the photo with the given id. */
        fun removePhoto(id: String) {
            _state.update { current ->
                current.copy(form = current.form.copy(photos = current.form.photos.filterNot { it.id == id }))
            }
            persist()
        }

        /** Move photo `from -> to`. First slot is the hero. */
        fun movePhoto(
            from: Int,
            to: Int,
        ) {
            _state.update { current ->
                val photos = current.form.photos.toMutableList()
                if (!canMovePhoto(from, to, photos)) return@update current
                val photo = photos.removeAt(from)
                val insertIndex = if (to > photos.size) photos.size else to
                photos.add(insertIndex, photo)
                current.copy(form = current.form.copy(photos = photos.toList()))
            }
            persist()
        }

        private fun canMovePhoto(
            from: Int,
            to: Int,
            photos: List<ListingComposePhoto>,
        ): Boolean {
            if (from == to) return false
            if (from !in photos.indices) return false
            if (to < 0) return false
            return to <= photos.size
        }

        /** Promote a photo to the hero slot (index 0). */
        fun makeHero(id: String) {
            _state.update { current ->
                val photos = current.form.photos.toMutableList()
                val index = photos.indexOfFirst { it.id == id }
                if (index <= 0) return@update current
                val photo = photos.removeAt(index)
                photos.add(0, photo)
                current.copy(form = current.form.copy(photos = photos.toList()))
            }
            persist()
        }

        // MARK: - Other step mutations

        fun setTitle(value: String) {
            _state.update { it.copy(form = it.form.copy(title = value)) }
            persist()
        }

        fun setCategory(category: ListingComposeCategory) {
            _state.update { current ->
                current.copy(form = ListingComposeVisionMapping.formWithCategory(current.form, category))
            }
            persist()
        }

        fun setCondition(condition: ListingComposeCondition) {
            _state.update { it.copy(form = it.form.copy(condition = condition)) }
            persist()
        }

        fun setBody(value: String) {
            _state.update { it.copy(form = it.form.copy(bodyText = value)) }
            persist()
        }

        fun setPriceKind(kind: ListingComposePriceKind) {
            _state.update { current ->
                val cleared = if (kind == ListingComposePriceKind.Free) "" else current.form.priceAmount
                current.copy(form = current.form.copy(priceKind = kind, priceAmount = cleared))
            }
            persist()
        }

        fun setPriceAmount(value: String) {
            val filtered = value.filter { it.isDigit() || it == '.' }
            val parts = filtered.split('.')
            // Reject input with more than one decimal separator.
            if (parts.size > 2) return
            _state.update { current ->
                var form = current.form.copy(priceAmount = filtered)
                // Typing an amount with no kind picked (vision-draft
                // failure path on the snap-review step) implies Fixed.
                if (form.priceKind == null && filtered.isNotEmpty()) {
                    form = form.copy(priceKind = ListingComposePriceKind.Fixed)
                }
                current.copy(form = form)
            }
            persist()
        }

        fun setFulfillment(value: ListingComposeFulfillment) {
            _state.update { it.copy(form = it.form.copy(fulfillment = value)) }
            persist()
        }

        fun setDeliveryEnabled(value: Boolean) {
            _state.update { it.copy(form = it.form.copy(deliveryEnabled = value)) }
            persist()
        }

        fun setLocationKind(kind: ListingComposeLocationKind) {
            _state.update { it.copy(form = it.form.copy(locationKind = kind)) }
            persist()
        }

        fun setLocationLabel(value: String) {
            _state.update { it.copy(form = it.form.copy(locationLabel = value)) }
            persist()
        }

        // MARK: - State machine

        private suspend fun advance() {
            val current = _state.value.form.currentStep
            when (current) {
                ListingComposeStep.Photos -> {
                    val snapEntry = isCameraCaptureStep
                    if (snapEntry) {
                        // The snap-review panel has no location picker —
                        // default to the saved address like the iOS flow.
                        _state.update { state ->
                            val kind = state.form.locationKind ?: ListingComposeLocationKind.SavedAddress
                            state.copy(form = state.form.copy(locationKind = kind))
                        }
                    }
                    transitionTo(ListingComposeStep.TitleCategory)
                    if (snapEntry) requestVisionAnalysisIfNeeded()
                }
                ListingComposeStep.TitleCategory ->
                    if (isSnapReviewStep) {
                        submit()
                    } else {
                        transitionTo(ListingComposeStep.ConditionDescription)
                    }
                ListingComposeStep.ConditionDescription -> transitionTo(ListingComposeStep.Price)
                ListingComposeStep.Price -> transitionTo(ListingComposeStep.Location)
                ListingComposeStep.Location -> transitionTo(ListingComposeStep.Review)
                ListingComposeStep.Review -> submit()
                ListingComposeStep.Success -> {
                    val listingId = _state.value.createdListingId ?: return
                    pendingEvent.value =
                        if (isEditMode) {
                            ListingComposeOutboundEvent.ListingUpdated(listingId)
                        } else {
                            ListingComposeOutboundEvent.OpenListingDetail(listingId)
                        }
                }
            }
        }

        private fun goBack() {
            val previous = ListingComposeStep.fromOrdinal(_state.value.form.step - 1)
            transitionTo(previous)
        }

        private fun transitionTo(step: ListingComposeStep) {
            _state.update {
                it.copy(form = it.form.copy(step = step.ordinal0), errorMessage = null)
            }
            persist()
            step.stepNumber?.let { number ->
                Analytics.track(
                    AnalyticsEvent.ScreenListingComposeWizardStepViewed(
                        stepNumber = number,
                        stepName = step.name,
                    ),
                )
            }
        }

        // MARK: - Submit

        private suspend fun submit() {
            val form = _state.value.form
            val category = form.category ?: return
            val priceKind = form.priceKind ?: return
            Analytics.track(AnalyticsEvent.CtaListingComposeSubmit)
            if (!networkMonitor.isOnline.value) {
                _state.update {
                    it.copy(
                        errorMessage = "You're offline. Try again when you're back online.",
                    )
                }
                return
            }
            _state.update { it.copy(isSubmitting = true, errorMessage = null) }

            val isFree = priceKind == ListingComposePriceKind.Free || category == ListingComposeCategory.Free
            val price: Double? = if (isFree) null else form.priceAmount.toDoubleOrNull()
            // Only hosted URLs belong in the create/update body — local
            // captures upload as multipart after the listing exists.
            val mediaUrls = form.photos.filter { it.isRemote }.map { it.token }
            val backendCategory = form.backendCategory ?: category.fallbackBackendCategory
            val locationName = form.locationLabel.takeIf { it.isNotEmpty() }
            val deliveryAvailable = form.deliveryEnabled || form.fulfillment == ListingComposeFulfillment.Delivery

            when (val m = mode) {
                is ListingComposeMode.Create -> {
                    val request =
                        CreateListingRequest(
                            title = form.title.trim(),
                            description = form.bodyText.trim(),
                            price = price,
                            isFree = isFree,
                            category = backendCategory,
                            condition = form.condition?.key,
                            mediaUrls = mediaUrls,
                            layer = category.layer,
                            listingType = category.listingType,
                            locationName = locationName,
                            meetupPreference = form.fulfillment.meetupPreference,
                            deliveryAvailable = deliveryAvailable,
                            isWanted = category.isWanted,
                        )
                    when (val result = repository.create(request)) {
                        is NetworkResult.Success -> finishSubmit(result.data.listing.id)
                        is NetworkResult.Failure ->
                            applyFailure(
                                result.error.message
                                    ?: "Couldn't list your item. Please try again.",
                            )
                    }
                }
                is ListingComposeMode.Edit -> {
                    val request =
                        UpdateListingRequest(
                            title = form.title.trim(),
                            description = form.bodyText.trim(),
                            price = price,
                            isFree = isFree,
                            category = backendCategory,
                            condition = form.condition?.key,
                            mediaUrls = mediaUrls,
                            layer = category.layer,
                            listingType = category.listingType,
                            locationName = locationName,
                            meetupPreference = form.fulfillment.meetupPreference,
                            deliveryAvailable = deliveryAvailable,
                            isWanted = category.isWanted,
                        )
                    when (val result = repository.update(m.listingId, request)) {
                        is NetworkResult.Success -> finishSubmit(result.data.listing.id)
                        is NetworkResult.Failure ->
                            applyFailure(
                                result.error.message
                                    ?: "Couldn't save your changes. Please try again.",
                            )
                    }
                }
            }
        }

        /** Shared create/PATCH success tail — upload local photos, then land on Success. */
        private suspend fun finishSubmit(listingId: String) {
            val photosUploaded = uploadLocalPhotos(listingId)
            applySuccess(listingId, photosUploaded)
        }

        /**
         * Multipart `POST /api/upload/listing-media/:listingId`, field
         * `files`. Returns false on failure — non-blocking, the listing
         * is already live.
         */
        private suspend fun uploadLocalPhotos(listingId: String): Boolean {
            val files =
                _state.value.form.photos.mapIndexedNotNull { index, photo ->
                    photo.localImageData?.let { bytes ->
                        UploadFile(
                            filename = "listing-${index + 1}.jpg",
                            mimeType = "image/jpeg",
                            bytes = bytes,
                        )
                    }
                }
            if (files.isEmpty()) return true
            return when (uploadRepository.uploadListingMedia(listingId, files)) {
                is NetworkResult.Success -> true
                is NetworkResult.Failure -> false
            }
        }

        private fun applySuccess(
            listingId: String,
            photosUploaded: Boolean = true,
        ) {
            _state.update {
                it.copy(
                    createdListingId = listingId,
                    isSubmitting = false,
                    form = it.form.copy(step = ListingComposeStep.Success.ordinal0),
                    errorMessage =
                        if (photosUploaded) {
                            null
                        } else {
                            "Your listing is live, but some photos didn't upload. Edit the listing to add them."
                        },
                )
            }
            persist()
        }

        private fun applyFailure(message: String) {
            _state.update {
                it.copy(isSubmitting = false, errorMessage = message)
            }
        }

        // MARK: - Validation helpers

        /** True when the title trims to between min and max length. */
        fun isTitleValid(form: ListingComposeFormState): Boolean {
            val length = form.title.trim().length
            return length in ListingComposeFormState.TITLE_MIN_LENGTH..ListingComposeFormState.TITLE_MAX_LENGTH
        }

        /** True when the description trims to between min and max length. */
        fun isDescriptionValid(form: ListingComposeFormState): Boolean {
            val length = form.bodyText.trim().length
            return length in ListingComposeFormState.DESCRIPTION_MIN_LENGTH..ListingComposeFormState.DESCRIPTION_MAX_LENGTH
        }

        /** Condition is mandatory unless the category is Wanted. */
        fun conditionSatisfied(form: ListingComposeFormState): Boolean {
            val category = form.category ?: return false
            return !category.requiresCondition || form.condition != null
        }

        /** Free is always valid; Fixed/Negotiable need a positive amount. */
        fun isPriceValid(form: ListingComposeFormState): Boolean {
            val kind = form.priceKind ?: return false
            return when (kind) {
                ListingComposePriceKind.Free -> true
                ListingComposePriceKind.Fixed, ListingComposePriceKind.Negotiable ->
                    (form.priceAmount.toDoubleOrNull() ?: 0.0) > 0.0
            }
        }

        // MARK: - Persistence

        private fun persist() = formPersistence.persist(_state.value.form)

        // MARK: - Chrome derivation

        private fun computeChrome(state: ListingComposeUiState): WizardChrome {
            val step = state.form.currentStep
            return WizardChrome(
                title = if (isEditMode) "Edit listing" else "List an item",
                progressLabel = progressLabel(step),
                progressFraction = progressFraction(step),
                leading = leadingControl(step),
                primaryCtaLabel = primaryCtaLabel(step),
                primaryCtaEnabled =
                    primaryEnabled(state) && !state.isSubmitting && !state.isLoadingExisting && !state.isAnalyzing,
                secondaryCta = secondaryCta(step),
                isSubmitting = state.isSubmitting,
                dirty = dirtyForCloseConfirm(state),
                showsProgressBar = step != ListingComposeStep.Success,
            )
        }

        private fun leadingControl(step: ListingComposeStep): WizardLeadingControl =
            when (step) {
                ListingComposeStep.Photos, ListingComposeStep.Success -> WizardLeadingControl.Close
                else -> WizardLeadingControl.Back
            }

        private fun primaryCtaLabel(step: ListingComposeStep): String =
            when (step) {
                ListingComposeStep.Photos -> if (isCameraCaptureStep) "Review suggestions" else "Continue"
                ListingComposeStep.TitleCategory -> if (isSnapReviewStep) "Post listing" else "Continue"
                ListingComposeStep.ConditionDescription,
                ListingComposeStep.Price,
                ListingComposeStep.Location,
                -> "Continue"
                ListingComposeStep.Review -> if (isEditMode) "Save changes" else "List it"
                ListingComposeStep.Success -> if (isEditMode) "Back to listing" else "View listing"
            }

        private fun secondaryCta(step: ListingComposeStep): WizardSecondaryCta? {
            if (isSnapReviewStep) {
                return WizardSecondaryCta(
                    label = "Save draft",
                    testTag = "listingComposeSaveDraft",
                )
            }
            if (step != ListingComposeStep.Success) return null
            return if (isEditMode) {
                WizardSecondaryCta(
                    label = "Done",
                    testTag = "listingComposeEditDone",
                )
            } else {
                WizardSecondaryCta(
                    label = "Back to Marketplace",
                    testTag = "listingComposeBackToMarketplace",
                )
            }
        }

        private fun isSnapProgressStep(step: ListingComposeStep): Boolean =
            !isEditMode &&
                _state.value.form.entryMode == ListingComposeEntryMode.Snap &&
                (step == ListingComposeStep.Photos || step == ListingComposeStep.TitleCategory)

        private fun progressLabel(step: ListingComposeStep): WizardProgressLabel {
            if (isSnapProgressStep(step)) {
                return WizardProgressLabel.StepOf(current = 1, total = SNAP_PROGRESS_TOTAL)
            }
            val number = step.stepNumber ?: return WizardProgressLabel.Hidden
            return WizardProgressLabel.StepOf(
                current = number,
                total = ListingComposeStep.PROGRESS_TOTAL,
            )
        }

        private fun progressFraction(step: ListingComposeStep): Float? {
            if (isSnapProgressStep(step)) {
                return 1f / SNAP_PROGRESS_TOTAL.toFloat()
            }
            val number = step.stepNumber ?: return null
            return number.toFloat() / ListingComposeStep.PROGRESS_TOTAL
        }

        private fun primaryEnabled(state: ListingComposeUiState): Boolean {
            val form = state.form
            return when (form.currentStep) {
                ListingComposeStep.Photos -> form.photos.isNotEmpty()
                ListingComposeStep.TitleCategory ->
                    if (isSnapReviewStep) {
                        form.photos.isNotEmpty() &&
                            isTitleValid(form) &&
                            form.category != null &&
                            conditionSatisfied(form) &&
                            isPriceValid(form) &&
                            form.locationKind != null
                    } else {
                        isTitleValid(form) && form.category != null
                    }
                ListingComposeStep.ConditionDescription -> isDescriptionValid(form) && conditionSatisfied(form)
                ListingComposeStep.Price -> isPriceValid(form)
                ListingComposeStep.Location -> form.locationKind != null
                ListingComposeStep.Review -> true
                ListingComposeStep.Success -> state.createdListingId != null
            }
        }

        private fun dirtyForCloseConfirm(state: ListingComposeUiState): Boolean {
            if (state.form.currentStep == ListingComposeStep.Success) return false
            // Edit mode is always dirty pre-success — user came in
            // intentionally so warn before discarding.
            if (isEditMode) return true
            return state.form.photos.isNotEmpty() ||
                state.form.title.isNotEmpty() ||
                state.form.bodyText.isNotEmpty()
        }

        companion object {
            private const val SNAP_PROGRESS_TOTAL = 3

            /** Nav-arg key for the listing being edited. Present when the
             *  wizard is reached via the EDIT_LISTING route. */
            const val EDIT_LISTING_ID_KEY = "editListingId"

            /** Nav-arg key for the optional jump-to-step. Empty string
             *  means "default landing (review)". */
            const val EDIT_JUMP_TO_STEP_KEY = "editJumpToStep"

            /** Resolve the mode from the nav-arg listing id. Null /
             *  empty id falls back to `Create`. */
            internal fun resolveMode(handle: SavedStateHandle): ListingComposeMode {
                val listingId: String? = handle[EDIT_LISTING_ID_KEY]
                if (listingId.isNullOrEmpty()) return ListingComposeMode.Create
                val jumpRaw: String? = handle[EDIT_JUMP_TO_STEP_KEY]
                val jumpStep =
                    jumpRaw
                        ?.takeIf { it.isNotEmpty() }
                        ?.let { name -> ListingComposeStep.entries.firstOrNull { it.name == name } }
                return ListingComposeMode.Edit(listingId = listingId, jumpToStep = jumpStep)
            }

            /**
             * Pure projection from a backend [ListingDto] to the
             * wizard's [ListingComposeFormState]. Public for unit tests
             * asserting prefill correctness.
             */
            fun project(
                listing: ListingDto,
                jumpToStep: ListingComposeStep? = null,
            ): ListingComposeFormState {
                val category = mapCategory(listing)
                val condition =
                    listing.condition?.let { raw ->
                        ListingComposeCondition.entries.firstOrNull { it.key == raw }
                    }
                val priceKind =
                    when {
                        listing.isFree == true || category == ListingComposeCategory.Free ->
                            ListingComposePriceKind.Free
                        listing.price != null -> ListingComposePriceKind.Fixed
                        else -> null
                    }
                val priceAmount =
                    when {
                        listing.isFree == true -> ""
                        listing.price == null -> ""
                        listing.price % 1.0 == 0.0 -> listing.price.toInt().toString()
                        else -> "%.2f".format(listing.price)
                    }
                val (locationKind, locationLabel) =
                    if (!listing.locationName.isNullOrEmpty()) {
                        ListingComposeLocationKind.MeetPoint to listing.locationName
                    } else {
                        ListingComposeLocationKind.SavedAddress to ""
                    }
                val photos =
                    (listing.mediaUrls ?: emptyList()).map { url ->
                        ListingComposePhoto(token = url)
                    }
                val landingStep = jumpToStep ?: ListingComposeStep.Review
                return ListingComposeFormState(
                    step = landingStep.ordinal0,
                    entryMode = ListingComposeEntryMode.Manual,
                    photos = photos,
                    title = listing.title.orEmpty(),
                    category = category,
                    condition = condition,
                    bodyText = listing.description.orEmpty(),
                    priceKind = priceKind,
                    priceAmount = priceAmount,
                    fulfillment = ListingComposeFulfillment.Pickup,
                    locationKind = locationKind,
                    locationLabel = locationLabel,
                    // Preserve the real backend category so a PATCH
                    // doesn't downgrade e.g. `furniture` to `other`.
                    backendCategory = listing.category,
                )
            }

            private fun mapCategory(listing: ListingDto): ListingComposeCategory? =
                // listing_type is most precise — differentiates Wanted,
                // Free, and rentals from a plain Goods listing.
                when (listing.listingType) {
                    "wanted_request" -> ListingComposeCategory.Wanted
                    "free_item" -> ListingComposeCategory.Free
                    "rent_sublet", "vehicle_rent" -> ListingComposeCategory.Rentals
                    "vehicle_sale" -> ListingComposeCategory.Vehicles
                    "sell_item" -> mapSellItemCategory(listing)
                    else -> mapLayerCategory(listing)
                }

            private fun mapSellItemCategory(listing: ListingDto): ListingComposeCategory =
                if (listing.layer == "vehicles") {
                    ListingComposeCategory.Vehicles
                } else {
                    ListingComposeCategory.Goods
                }

            private fun mapLayerCategory(listing: ListingDto): ListingComposeCategory? =
                when (listing.layer) {
                    "vehicles" -> ListingComposeCategory.Vehicles
                    "rentals" -> ListingComposeCategory.Rentals
                    "goods" ->
                        if (listing.isFree == true) {
                            ListingComposeCategory.Free
                        } else {
                            ListingComposeCategory.Goods
                        }
                    else -> null
                }
        }
    }
