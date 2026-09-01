@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.create_business

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.businesses.CreateBusinessFullRequest
import app.pantopus.android.data.api.models.businesses.CreateBusinessHoursPayload
import app.pantopus.android.data.api.models.businesses.CreateBusinessLocationPayload
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.upload.UploadFile
import app.pantopus.android.data.upload.UploadRepository
import app.pantopus.android.ui.screens.auth.AuthValidation
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
import org.json.JSONObject
import javax.inject.Inject

/**
 * Shortest username `POST /api/businesses/create-full` accepts — the wizard
 * gates the username field and the availability check on it.
 */
internal const val MIN_BUSINESS_USERNAME_LENGTH = 3

/**
 * Field caps enforced by `createBusinessFullSchema`
 * (`backend/routes/businesses.js:527`). Mirrored client-side so an
 * over-length value is trimmed as it is typed instead of surfacing as a 400
 * after the last wizard step.
 */
internal const val MAX_BUSINESS_NAME_LENGTH = 100
internal const val MAX_BUSINESS_USERNAME_LENGTH = 40
internal const val MAX_BUSINESS_DESCRIPTION_LENGTH = 2000

/**
 * Aggregate UI state for the A12.10 Create Business wizard.
 */
data class CreateBusinessUiState(
    val currentStep: CreateBusinessStep = CreateBusinessStep.PickCategory,
    val selectedCategory: BusinessCategory? = BusinessCategory.Home,
    val searchText: String = "",
    val isSubmittingCustom: Boolean = false,
    val isCreating: Boolean = false,
    val submitError: String? = null,
    // Basic info
    val businessName: String = "",
    val username: String = "",
    val email: String = "",
    val description: String = "",
    val usernameStatus: UsernameCheckStatus = UsernameCheckStatus.Idle,
    // Location + hours
    val address: String = "",
    val city: String = "",
    val state: String = "",
    val zip: String = "",
    val locationSkipped: Boolean = false,
    val hoursSkipped: Boolean = false,
    val hours: List<BusinessHoursDay> = BusinessHoursDay.defaultWeek(),
    // Logo — uploaded after create-full, which is the first point a
    // business id exists (the upload route is keyed by it).
    val logoPick: CreateBusinessLogoPick? = null,
    val logoSkipped: Boolean = false,
    /**
     * Set when create succeeded but the logo upload didn't. RN swallows the
     * same failure ("Non-critical — user can upload from dashboard"); we
     * surface it as a banner instead of silently dropping the image.
     */
    val logoUploadWarning: String? = null,
) {
    val isSearchActive: Boolean
        get() = searchText.trim().isNotEmpty()

    val searchHits: List<CategorySearchHit>
        get() = CreateBusinessSampleData.searchHits(searchText)

    val whatYouGetItems: List<WhatYouGetItem>
        get() =
            if (selectedCategory == BusinessCategory.Home) {
                CreateBusinessSampleData.homeServicesWhatYouGet
            } else {
                emptyList()
            }

    val cleanedUsername: String
        get() = username.trim().lowercase()

    val hasLocation: Boolean
        get() =
            !locationSkipped &&
                address.trim().isNotEmpty() &&
                city.trim().isNotEmpty()

    val isBasicInfoValid: Boolean
        get() {
            val nameOk = businessName.trim().isNotEmpty()
            val emailOk = AuthValidation.email(email) == null
            val usernameOk =
                cleanedUsername.length >= MIN_BUSINESS_USERNAME_LENGTH &&
                    usernameStatus !is UsernameCheckStatus.Checking &&
                    usernameStatus !is UsernameCheckStatus.Unavailable
            return nameOk && emailOk && usernameOk
        }
}

/**
 * Drives the A12.10 Create Business wizard. Step 1 uses the designed
 * category picker; steps 2–4 collect basic info / location+hours /
 * confirm and POST create-full.
 *
 * Custom-category submit stays blocked until a real custom-category
 * endpoint exists — do not invent POST /custom-categories.
 */
@HiltViewModel
open class CreateBusinessWizardViewModel
    @Inject
    constructor(
        private val businessesRepository: BusinessesRepository,
        private val uploadRepository: UploadRepository,
    ) : ViewModel(),
        WizardModel {
        private val _state = MutableStateFlow(CreateBusinessUiState())
        val state: StateFlow<CreateBusinessUiState> = _state.asStateFlow()

        /** One-shot navigation events the screen reacts to. */
        val pendingEvent = MutableStateFlow<CreateBusinessOutboundEvent?>(null)

        private var usernameCheckJob: Job? = null

        // MARK: - WizardModel

        override val chrome: WizardChrome
            get() = computeChrome(_state.value)

        override fun onLeading() {
            when (_state.value.currentStep) {
                CreateBusinessStep.PickCategory ->
                    pendingEvent.value = CreateBusinessOutboundEvent.Dismiss
                CreateBusinessStep.LegalInfo -> transitionTo(CreateBusinessStep.PickCategory)
                CreateBusinessStep.Profile -> transitionTo(CreateBusinessStep.LegalInfo)
                CreateBusinessStep.Confirm -> transitionTo(CreateBusinessStep.Profile)
            }
        }

        override fun onDiscard() {
            pendingEvent.value = CreateBusinessOutboundEvent.Dismiss
        }

        override fun onPrimary() {
            val current = _state.value
            when (current.currentStep) {
                CreateBusinessStep.PickCategory -> {
                    if (current.selectedCategory == null) return
                    transitionTo(CreateBusinessStep.LegalInfo)
                }
                CreateBusinessStep.LegalInfo -> {
                    if (!validateBasicInfo()) return
                    transitionTo(CreateBusinessStep.Profile)
                }
                CreateBusinessStep.Profile -> {
                    if (!validateLocation()) return
                    transitionTo(CreateBusinessStep.Confirm)
                }
                CreateBusinessStep.Confirm -> createBusiness(publish = true)
            }
        }

        /**
         * Confirm step's ghost CTA — creates the business but leaves it
         * unpublished, matching RN's "Save as Draft"
         * (`src/app/businesses/new.tsx:273-320`).
         */
        override fun onSecondary() {
            if (_state.value.currentStep != CreateBusinessStep.Confirm) return
            createBusiness(publish = false)
        }

        // MARK: - Selection

        fun selectCategory(category: BusinessCategory) {
            _state.update { it.copy(selectedCategory = category, submitError = null) }
        }

        fun selectSearchHit(hit: CategorySearchHit) {
            _state.update {
                it.copy(selectedCategory = hit.category, searchText = "")
            }
        }

        fun setSearchText(value: String) {
            _state.update { it.copy(searchText = value) }
        }

        /** Custom categories stay blocked — no inventing POST /custom-categories. */
        fun submitCustomCategory() {
            val current = _state.value
            val trimmed = current.searchText.trim()
            if (trimmed.isEmpty() || current.isSubmittingCustom) return
            _state.update {
                it.copy(
                    isSubmittingCustom = false,
                    submitError =
                        "Custom categories aren't available yet. Pick a listed category instead.",
                )
            }
            Analytics.track(AnalyticsEvent.CtaCreateBusinessCustomCategorySubmit(label = trimmed))
        }

        fun acknowledgeEvent() {
            pendingEvent.value = null
        }

        // MARK: - Field setters

        fun setBusinessName(value: String) {
            _state.update {
                it.copy(businessName = value.take(MAX_BUSINESS_NAME_LENGTH), submitError = null)
            }
        }

        fun setUsername(value: String) {
            val cleaned =
                value
                    .lowercase()
                    .replace(Regex("[^a-z0-9_]"), "")
                    .take(MAX_BUSINESS_USERNAME_LENGTH)
            _state.update { it.copy(username = cleaned, submitError = null) }
            scheduleUsernameCheck(cleaned)
        }

        fun setEmail(value: String) {
            _state.update { it.copy(email = value, submitError = null) }
        }

        fun setDescription(value: String) {
            _state.update { it.copy(description = value.take(MAX_BUSINESS_DESCRIPTION_LENGTH)) }
        }

        fun setAddress(value: String) {
            _state.update { it.copy(address = value, submitError = null) }
        }

        fun setCity(value: String) {
            _state.update { it.copy(city = value, submitError = null) }
        }

        fun setState(value: String) {
            _state.update { it.copy(state = value) }
        }

        fun setZip(value: String) {
            _state.update { it.copy(zip = value) }
        }

        fun skipLocation() {
            _state.update {
                it.copy(locationSkipped = true, hoursSkipped = true, submitError = null)
            }
        }

        fun unskipLocation() {
            _state.update {
                it.copy(locationSkipped = false, hoursSkipped = false)
            }
        }

        fun skipHours() {
            _state.update { it.copy(hoursSkipped = true) }
        }

        fun unskipHours() {
            _state.update { it.copy(hoursSkipped = false) }
        }

        // MARK: - Logo

        /**
         * Stash a picked logo. It can only be uploaded once the business
         * exists (the route is keyed by business id), so it rides along until
         * create-full returns — same ordering as RN
         * (`src/app/businesses/new.tsx:223-230`).
         */
        fun setLogoPick(pick: CreateBusinessLogoPick) {
            _state.update {
                it.copy(logoPick = pick, logoSkipped = false, logoUploadWarning = null)
            }
        }

        fun clearLogoPick() {
            _state.update { it.copy(logoPick = null) }
        }

        fun skipLogo() {
            _state.update { it.copy(logoSkipped = true, logoPick = null) }
        }

        fun unskipLogo() {
            _state.update { it.copy(logoSkipped = false) }
        }

        fun toggleDayClosed(dayOfWeek: Int) {
            _state.update { state ->
                state.copy(
                    hours =
                        state.hours.map { day ->
                            if (day.dayOfWeek != dayOfWeek) {
                                day
                            } else {
                                val closed = !day.isClosed
                                day.copy(
                                    isClosed = closed,
                                    openTime =
                                        if (!closed && day.openTime.isBlank()) {
                                            "09:00"
                                        } else {
                                            day.openTime
                                        },
                                    closeTime =
                                        if (!closed && day.closeTime.isBlank()) {
                                            "17:00"
                                        } else {
                                            day.closeTime
                                        },
                                )
                            }
                        },
                )
            }
        }

        // MARK: - Step transitions

        private fun transitionTo(step: CreateBusinessStep) {
            _state.update { it.copy(currentStep = step, submitError = null) }
            Analytics.track(
                AnalyticsEvent.ScreenCreateBusinessStepViewed(
                    stepNumber = step.stepNumber,
                    stepName = step.name.lowercase(),
                ),
            )
        }

        // MARK: - Validation / create

        private fun validateBasicInfo(): Boolean {
            val error = basicInfoError(_state.value)
            _state.update { it.copy(submitError = error) }
            return error == null
        }

        /** First blocking problem with step 2's fields, or `null` when it is valid. */
        private fun basicInfoError(state: CreateBusinessUiState): String? {
            val unavailable = state.usernameStatus as? UsernameCheckStatus.Unavailable
            return when {
                state.businessName.trim().isEmpty() -> REQUIRED_FIELDS_MESSAGE
                state.cleanedUsername.length < MIN_BUSINESS_USERNAME_LENGTH ->
                    "Username must be at least $MIN_BUSINESS_USERNAME_LENGTH characters."
                unavailable != null -> usernameUnavailableMessage(unavailable.reason)
                AuthValidation.email(state.email) != null -> REQUIRED_FIELDS_MESSAGE
                else -> null
            }
        }

        private fun validateLocation(): Boolean {
            val state = _state.value
            if (state.locationSkipped) {
                _state.update { it.copy(submitError = null) }
                return true
            }
            if (state.address.trim().isNotEmpty() && state.city.trim().isEmpty()) {
                _state.update {
                    it.copy(submitError = "City is required when adding an address.")
                }
                return false
            }
            _state.update { it.copy(submitError = null) }
            return true
        }

        private fun createBusiness(publish: Boolean) {
            if (_state.value.isCreating) return
            if (!validateBasicInfo()) return
            val category = _state.value.selectedCategory
            if (category == null) {
                _state.update {
                    it.copy(submitError = "Pick a category before creating your business.")
                }
                return
            }

            viewModelScope.launch {
                _state.update { it.copy(isCreating = true, submitError = null, logoUploadWarning = null) }
                val state = _state.value
                val location =
                    if (state.hasLocation) {
                        CreateBusinessLocationPayload(
                            address = state.address.trim(),
                            city = state.city.trim(),
                            state = state.state.trim().ifEmpty { null },
                            zipcode = state.zip.trim().ifEmpty { null },
                            country = "US",
                        )
                    } else {
                        null
                    }
                val hours =
                    if (state.hasLocation && !state.hoursSkipped) {
                        state.hours.map { day ->
                            CreateBusinessHoursPayload(
                                dayOfWeek = day.dayOfWeek,
                                openTime = if (day.isClosed) null else day.openTime.ifEmpty { null },
                                closeTime = if (day.isClosed) null else day.closeTime.ifEmpty { null },
                                isClosed = day.isClosed,
                            )
                        }
                    } else {
                        null
                    }
                val body =
                    CreateBusinessFullRequest(
                        name = state.businessName.trim(),
                        username = state.cleanedUsername,
                        email = state.email.trim(),
                        businessType = category.entityType,
                        categories = listOf(category.backendSlug),
                        description = state.description.trim().ifEmpty { null },
                        location = location,
                        hours = hours,
                    )
                when (val result = businessesRepository.createBusinessFull(body)) {
                    is NetworkResult.Success -> {
                        val businessId = result.data.business.id
                        uploadLogoIfNeeded(businessId)
                        if (publish) businessesRepository.publishBusiness(businessId)
                        pendingEvent.value =
                            CreateBusinessOutboundEvent.OpenBusinessDashboard(
                                businessId = businessId,
                            )
                    }
                    is NetworkResult.Failure -> {
                        _state.update {
                            it.copy(submitError = createErrorMessage(result.error))
                        }
                    }
                }
                _state.update { it.copy(isCreating = false) }
            }
        }

        /**
         * Push the picked logo once the business id exists. RN treats a
         * failed logo upload as non-critical (the business is already
         * created), so navigation continues and a warning is surfaced.
         */
        private suspend fun uploadLogoIfNeeded(businessId: String) {
            val current = _state.value
            val pick = current.logoPick?.takeIf { !current.logoSkipped } ?: return
            val result =
                uploadRepository.uploadBusinessMedia(
                    businessId = businessId,
                    type = "logo",
                    file = UploadFile(pick.fileName, pick.mimeType, pick.bytes),
                )
            when (result) {
                is NetworkResult.Success -> _state.update { it.copy(logoPick = null) }
                is NetworkResult.Failure ->
                    _state.update {
                        it.copy(
                            logoUploadWarning =
                                "Your business was created, but the logo didn't upload. " +
                                    "Add it from the dashboard.",
                        )
                    }
            }
        }

        private fun scheduleUsernameCheck(username: String) {
            usernameCheckJob?.cancel()
            if (username.length < MIN_BUSINESS_USERNAME_LENGTH) {
                _state.update { it.copy(usernameStatus = UsernameCheckStatus.Idle) }
                return
            }
            _state.update { it.copy(usernameStatus = UsernameCheckStatus.Checking) }
            usernameCheckJob =
                viewModelScope.launch {
                    delay(USERNAME_CHECK_DEBOUNCE_MS)
                    when (val result = businessesRepository.checkUsername(username)) {
                        is NetworkResult.Success -> {
                            if (_state.value.cleanedUsername != username) return@launch
                            _state.update {
                                it.copy(
                                    usernameStatus =
                                        if (result.data.available) {
                                            UsernameCheckStatus.Available
                                        } else {
                                            UsernameCheckStatus.Unavailable(result.data.reason)
                                        },
                                )
                            }
                        }
                        is NetworkResult.Failure -> {
                            if (_state.value.cleanedUsername != username) return@launch
                            _state.update { it.copy(usernameStatus = UsernameCheckStatus.Idle) }
                        }
                    }
                }
        }

        // MARK: - Chrome derivation

        private fun computeChrome(state: CreateBusinessUiState): WizardChrome {
            val label =
                WizardProgressLabel.StepOf(
                    current = state.currentStep.stepNumber,
                    total = CreateBusinessStep.TOTAL_STEPS,
                )
            val fraction =
                state.currentStep.stepNumber.toFloat() / CreateBusinessStep.TOTAL_STEPS.toFloat()
            return WizardChrome(
                title = "Create business",
                progressLabel = label,
                progressFraction = fraction,
                leading =
                    if (state.currentStep == CreateBusinessStep.PickCategory) {
                        WizardLeadingControl.Close
                    } else {
                        WizardLeadingControl.Back
                    },
                primaryCtaLabel = primaryLabel(state),
                primaryCtaEnabled = primaryEnabled(state),
                secondaryCta =
                    if (state.currentStep == CreateBusinessStep.Confirm) {
                        WizardSecondaryCta(
                            label = "Save as draft",
                            testTag = "createBusiness_saveDraft",
                        )
                    } else {
                        null
                    },
                isSubmitting = state.isSubmittingCustom || state.isCreating,
                dirty = isDirty(state),
                showsProgressBar = true,
            )
        }

        private fun primaryLabel(state: CreateBusinessUiState): String =
            when (state.currentStep) {
                CreateBusinessStep.PickCategory -> "Continue"
                CreateBusinessStep.LegalInfo -> "Next"
                CreateBusinessStep.Profile -> if (state.locationSkipped) "Skip" else "Next"
                // RN's review step publishes ("Publish"), with Save as Draft as
                // the ghost — native previously created an unpublished business
                // and called it "Confirm", so nothing ever went live.
                CreateBusinessStep.Confirm -> "Publish"
            }

        private fun primaryEnabled(state: CreateBusinessUiState): Boolean =
            when (state.currentStep) {
                CreateBusinessStep.PickCategory ->
                    state.selectedCategory != null && !state.isSubmittingCustom
                CreateBusinessStep.LegalInfo -> state.isBasicInfoValid && !state.isCreating
                CreateBusinessStep.Profile -> !state.isCreating
                CreateBusinessStep.Confirm -> state.isBasicInfoValid && !state.isCreating
            }

        /**
         * The wizard is pristine only while it still shows step 1 with the
         * default category, no active search, and no identity typed in — that
         * is the one state where closing needs no discard confirmation.
         */
        private fun isDirty(state: CreateBusinessUiState): Boolean {
            val untouchedCategoryStep =
                state.currentStep == CreateBusinessStep.PickCategory &&
                    state.selectedCategory == BusinessCategory.Home &&
                    !state.isSearchActive
            return !(untouchedCategoryStep && isIdentityEmpty(state))
        }

        private fun isIdentityEmpty(state: CreateBusinessUiState): Boolean =
            state.businessName.isEmpty() &&
                state.username.isEmpty() &&
                state.email.isEmpty()

        private fun usernameUnavailableMessage(reason: String?): String =
            when (reason) {
                "reserved" -> "This username is reserved. Please choose a different one."
                "taken" -> "This username is already taken."
                else -> "Please choose a valid username."
            }

        private fun createErrorMessage(error: NetworkError): String {
            val code =
                (error as? NetworkError.ClientError)?.body?.let { body ->
                    runCatching { JSONObject(body).optString("code").takeIf { it.isNotBlank() } }
                        .getOrNull()
                }
            return when (code) {
                "EMAIL_IS_PERSONAL" ->
                    "This email is already used by your personal account. " +
                        "Try using a business-specific email."
                "USERNAME_RESERVED" ->
                    "This username is reserved. Please choose a different one."
                "USERNAME_TAKEN" ->
                    "This username is already taken. Please go back and choose a different one."
                "RATE_LIMITED" ->
                    "You've created too many businesses recently. Please try again tomorrow."
                else -> error.message
            }
        }

        companion object {
            private const val USERNAME_CHECK_DEBOUNCE_MS = 300L
            private const val REQUIRED_FIELDS_MESSAGE = "Name, username, and email are required."
        }
    }
