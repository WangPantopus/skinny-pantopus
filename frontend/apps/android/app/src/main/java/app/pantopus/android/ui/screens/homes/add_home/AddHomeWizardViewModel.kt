@file:Suppress("CyclomaticComplexMethod", "LargeClass", "LongMethod", "LongParameterList", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.add_home

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.homes.CheckAddressRequest
import app.pantopus.android.data.api.models.homes.CheckAddressResponse
import app.pantopus.android.data.api.models.homes.CreateAccessSecretRequest
import app.pantopus.android.data.api.models.homes.CreateHomeRequest
import app.pantopus.android.data.api.models.homes.NormalizedAddressDto
import app.pantopus.android.data.api.models.homes.PropertySuggestionsFields
import app.pantopus.android.data.api.models.homes.PropertySuggestionsRequest
import app.pantopus.android.data.api.models.homes.PropertySuggestionsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homediscovery.HomeDiscoveryRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
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
import javax.inject.Inject

/**
 * Aggregate UI state for the AddHome wizard. Combined into a single flow
 * so the screen can derive the [WizardChrome] off of it without reading
 * five separate StateFlows.
 */
data class AddHomeUiState(
    val form: AddHomeFormState = AddHomeFormState.EMPTY,
    val homeSearchQuery: String = "",
    val selectedHomeId: String? = null,
    val addressCheck: CheckAddressResponse? = null,
    val geocodedAddress: AddHomeGeocodedAddress? = null,
    val isCheckingAddress: Boolean = false,
    val isSubmitting: Boolean = false,
    val createdHomeId: String? = null,
    val errorMessage: String? = null,
    /**
     * The address refusal behind [errorMessage], when that is what it is.
     * Lets the UI offer the right next step instead of a bare retry.
     */
    val addressVerificationError: AddressVerificationError? = null,
    /**
     * `check-address` returned `HOME_FOUND_CLAIMED` — show the two-page
     * confirm modal instead of advancing (RN `useHomeForm.ts:611`).
     */
    val showsClaimedModal: Boolean = false,
    /** Second page of that modal ("Confirm this is your address"). */
    val showsConfirmAddressSheet: Boolean = false,
    /** Submit resolves against the existing home, not `POST /api/homes`. */
    val isClaimingExistingHome: Boolean = false,
    /** `home_id` returned by `check-address` for the matched home. */
    val existingHomeId: String? = null,
    /**
     * Result of `POST /api/homes/property-suggestions`, fetched right
     * after `check-address` clears — the order RN uses
     * (`useHomeForm.ts:625-662`). Drives the Details block's public
     * records card and pre-fills the editable fields.
     */
    val propertySuggestions: PropertySuggestionsResponse? = null,
    /** True once the lookup has finished, success or not. */
    val propertyLookupComplete: Boolean = false,
    /** Copy under the public-records card (RN `useHomeForm.ts:641-647`). */
    val propertyLookupMessage: String = "",
    /** True while the suggestions call is in flight. */
    val isLoadingPropertySuggestions: Boolean = false,
    /**
     * Wi-Fi / gate / alarm secrets added while creating the home. POSTed
     * to `POST /api/homes/:id/access` once the home row exists (RN
     * `useHomeForm.ts:321-336`). Held off [form] so the secrets never
     * reach `SavedStateHandle`.
     */
    val accessItems: List<AddHomeAccessItem> = listOf(AddHomeAccessItem(id = "access-0")),
    /** Non-null while the Wi-Fi QR scanner is open; carries the target row. */
    val scannerTargetItemId: String? = null,
    /**
     * Set when at least one access secret failed to save after the home
     * was created. RN swallows these; we surface them because the home
     * already exists and the user should know to re-add.
     */
    val accessSecretWarning: String? = null,
) {
    /**
     * Networks & codes are hidden when joining an existing home — RN
     * gates the whole block on `!isClaimingExistingHome`
     * (`SetupStep.tsx:66`).
     */
    val showsAccessSetup: Boolean
        get() = !isClaimingExistingHome

    /**
     * Address label rendered in the confirm sheet — the server's
     * `formatted_address` when present, else the typed fields.
     */
    val claimedAddressLabel: String
        get() =
            addressCheck
                ?.formattedAddress
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
                ?: listOf(
                    form.address.street,
                    form.address.unit,
                    form.address.city,
                    form.address.state,
                    form.address.zipCode,
                ).map { it.trim() }.filter { it.isNotEmpty() }.joinToString(", ")

    val zipMismatch: AddHomeZipMismatch?
        get() {
            val geocoded = geocodedAddress ?: return null
            val entered = form.address.zipCode.trim().uppercase()
            val corrected = geocoded.zipCode.trim().uppercase()
            if (entered.isEmpty() || corrected.isEmpty() || entered == corrected) return null
            return AddHomeZipMismatch(
                enteredZip = form.address.zipCode,
                correctedZip = geocoded.zipCode,
                street = geocoded.street,
                city = geocoded.city,
                state = geocoded.state,
            )
        }

    val isGeocodeResolved: Boolean
        get() = geocodedAddress != null && zipMismatch == null
}

data class AddHomeGeocodedAddress(
    val street: String,
    val unit: String,
    val city: String,
    val state: String,
    val zipCode: String,
    val latitude: Double?,
    val longitude: Double?,
    val isMultiUnit: Boolean,
)

data class AddHomeZipMismatch(
    val enteredZip: String,
    val correctedZip: String,
    val street: String,
    val city: String,
    val state: String,
)

/**
 * Drives the four-step + success Add-Home wizard. Step 1 uses
 * deterministic address fixtures, then the remaining steps keep using
 * the existing structured address shape and [WizardChrome] for the shared
 * [app.pantopus.android.ui.screens.shared.wizard.WizardShell].
 *
 * Form state is mirrored into [SavedStateHandle] so the wizard survives
 * config changes and process death (acceptance criterion #5).
 */
@HiltViewModel
@Suppress("TooManyFunctions")
open class AddHomeWizardViewModel
    @Inject
    constructor(
        private val repository: HomesRepository,
        private val discoveryRepository: HomeDiscoveryRepository,
        private val savedStateHandle: SavedStateHandle,
        private val networkMonitor: NetworkMonitor,
    ) : ViewModel(),
        WizardModel {
        private val _state =
            MutableStateFlow(
                restoreFormState().let { form ->
                    val candidate = AddHomeSampleData.candidateFor(form.address)
                    AddHomeUiState(
                        form = form,
                        homeSearchQuery = candidate?.line1.orEmpty(),
                        selectedHomeId = candidate?.id,
                    )
                },
            )

        /** Combined UI state consumed by [AddHomeWizardScreen]. */
        val state: StateFlow<AddHomeUiState> = _state.asStateFlow()

        /** One-shot navigation events the screen reacts to. */
        val pendingEvent = MutableStateFlow<AddHomeOutboundEvent?>(null)

        // MARK: - WizardModel

        override val chrome: WizardChrome
            get() = computeChrome(_state.value)

        override fun onLeading() {
            val current = _state.value.form.currentStep
            when (leadingControl(current)) {
                WizardLeadingControl.Back -> goBack()
                WizardLeadingControl.Close -> pendingEvent.value = AddHomeOutboundEvent.Dismiss
            }
        }

        override fun onDiscard() {
            pendingEvent.value = AddHomeOutboundEvent.Dismiss
        }

        override fun onPrimary() {
            viewModelScope.launch { advance() }
        }

        override fun onSecondary() {
            // Success step's "Back to Hub" — no other step uses the secondary.
            if (_state.value.form.currentStep == AddHomeStep.Success) {
                pendingEvent.value = AddHomeOutboundEvent.Dismiss
            }
        }

        // MARK: - Search updates

        val nearbyHomes: List<AddHomeAddressCandidate>
            get() = AddHomeSampleData.nearbyHomes

        val autocompleteResults: List<AddHomeAddressCandidate>
            get() =
                if (_state.value.selectedHomeId == null) {
                    AddHomeSampleData.autocompleteResults(_state.value.homeSearchQuery)
                } else {
                    emptyList()
                }

        val showsAutocomplete: Boolean
            get() = _state.value.selectedHomeId == null && _state.value.homeSearchQuery.trim().isNotEmpty()

        fun updateSearchQuery(query: String) {
            _state.update {
                it.copy(
                    homeSearchQuery = query,
                    selectedHomeId = null,
                    form = it.form.copy(address = AddHomeAddressFields()),
                    addressCheck = null,
                    geocodedAddress = null,
                )
            }
            persist()
        }

        fun clearSearchQuery() {
            _state.update {
                it.copy(
                    homeSearchQuery = "",
                    selectedHomeId = null,
                    form = it.form.copy(address = AddHomeAddressFields()),
                    addressCheck = null,
                    geocodedAddress = null,
                )
            }
            persist()
        }

        fun useCurrentLocation() {
            _state.update {
                it.copy(
                    homeSearchQuery = "",
                    selectedHomeId = null,
                    form = it.form.copy(address = AddHomeAddressFields()),
                    addressCheck = null,
                    geocodedAddress = null,
                )
            }
            persist()
        }

        fun selectAddressCandidate(candidate: AddHomeAddressCandidate) {
            if (candidate.isClaimed) return
            _state.update {
                it.copy(
                    homeSearchQuery = candidate.line1,
                    selectedHomeId = candidate.id,
                    form = it.form.copy(address = candidate.addressFields),
                    addressCheck = null,
                    geocodedAddress = null,
                )
            }
            persist()
        }

        fun addManuallyTapped() {
            _state.update {
                it.copy(
                    selectedHomeId = null,
                    form = it.form.copy(address = AddHomeAddressFields()),
                    addressCheck = null,
                    geocodedAddress = null,
                )
            }
            persist()
        }

        fun applyGeocodedZip() {
            val correctedZip = _state.value.zipMismatch?.correctedZip ?: return
            _state.update { current ->
                current.copy(
                    form =
                        current.form.copy(
                            address = current.form.address.copy(zipCode = correctedZip),
                        ),
                )
            }
            persist()
        }

        // MARK: - Legacy field updates

        fun updateField(
            field: AddressField,
            value: String,
        ) {
            _state.update { current ->
                val next =
                    when (field) {
                        AddressField.Street -> current.form.address.copy(street = value)
                        AddressField.Unit -> current.form.address.copy(unit = value)
                        AddressField.City -> current.form.address.copy(city = value)
                        AddressField.State -> current.form.address.copy(state = value)
                        AddressField.Zip -> current.form.address.copy(zipCode = value)
                    }
                val candidate = AddHomeSampleData.candidateFor(next)
                current.copy(
                    form = current.form.copy(address = next),
                    homeSearchQuery = candidate?.line1 ?: next.street,
                    selectedHomeId = candidate?.id,
                    addressCheck = null,
                    geocodedAddress = null,
                )
            }
            persist()
        }

        fun setPrimaryHome(isPrimary: Boolean) {
            _state.update { it.copy(form = it.form.copy(isPrimary = isPrimary)) }
            persist()
        }

        fun selectRole(role: AddHomeRole) {
            _state.update { it.copy(form = it.form.copy(role = role)) }
            persist()
        }

        // MARK: - Details step (RN `DetailsStep.tsx`)

        private fun updateDetails(transform: (AddHomeDetailsFields) -> AddHomeDetailsFields) {
            _state.update { it.copy(form = it.form.copy(details = transform(it.form.details))) }
            persist()
        }

        fun updateNickname(value: String) = updateDetails { it.copy(nickname = value) }

        fun selectHomeType(value: AddHomeHomeType) = updateDetails { it.copy(homeType = value) }

        fun updateBedrooms(value: String) = updateDetails { it.copy(bedrooms = digitsOnly(value)) }

        fun updateBathrooms(value: String) = updateDetails { it.copy(bathrooms = decimalOnly(value)) }

        fun updateSqFt(value: String) = updateDetails { it.copy(sqFt = digitsOnly(value)) }

        fun updateLotSqFt(value: String) = updateDetails { it.copy(lotSqFt = digitsOnly(value)) }

        fun updateYearBuilt(value: String) = updateDetails { it.copy(yearBuilt = digitsOnly(value)) }

        fun updateDescription(value: String) = updateDetails { it.copy(description = value) }

        private fun digitsOnly(value: String): String = value.filter { it.isDigit() }

        /**
         * Keeps digits plus a single decimal separator — bathrooms accept
         * halves (`backend/routes/home.js:95`).
         */
        private fun decimalOnly(value: String): String {
            val out = StringBuilder()
            var seenSeparator = false
            for (character in value) {
                when {
                    character.isDigit() -> out.append(character)
                    character == '.' && !seenSeparator -> {
                        seenSeparator = true
                        out.append(character)
                    }
                }
            }
            return out.toString()
        }

        // MARK: - Setup step (RN `SetupStep.tsx`)

        fun addAccessItem() {
            _state.update { current ->
                current.copy(
                    accessItems =
                        current.accessItems +
                            AddHomeAccessItem(id = "access-${System.nanoTime()}"),
                )
            }
        }

        fun removeAccessItem(id: String) {
            _state.update { current ->
                // RN only offers the trash affordance while more than one
                // row exists (`SetupStep.tsx:106`).
                if (current.accessItems.size <= 1) {
                    current
                } else {
                    current.copy(accessItems = current.accessItems.filterNot { it.id == id })
                }
            }
        }

        fun updateAccessType(
            id: String,
            type: AddHomeAccessType,
        ) = mutateAccessItem(id) { item ->
            // Picking a type fills an empty label with that type's default —
            // RN `SetupStep.tsx:82-90`.
            item.copy(
                accessType = type,
                label = item.label.ifBlank { type.defaultLabel },
                labelError = null,
            )
        }

        fun updateAccessLabel(
            id: String,
            value: String,
        ) = mutateAccessItem(id) { it.copy(label = value, labelError = null) }

        fun updateAccessSecret(
            id: String,
            value: String,
        ) = mutateAccessItem(id) { it.copy(secretValue = value, valueError = null) }

        fun toggleAccessSecretRevealed(id: String) = mutateAccessItem(id) { it.copy(isRevealed = !it.isRevealed) }

        private fun mutateAccessItem(
            id: String,
            transform: (AddHomeAccessItem) -> AddHomeAccessItem,
        ) {
            _state.update { current ->
                current.copy(
                    accessItems =
                        current.accessItems.map { if (it.id == id) transform(it) else it },
                )
            }
        }

        /** Open the camera QR scanner for [id] (Wi-Fi rows only). */
        fun openWifiQrScanner(id: String) {
            _state.update { it.copy(scannerTargetItemId = id) }
        }

        fun closeWifiQrScanner() {
            _state.update { it.copy(scannerTargetItemId = null) }
        }

        /**
         * Apply a scanned `WIFI:` payload to the targeted row. Returns
         * false when the payload isn't a Wi-Fi QR so the scanner can show
         * RN's "Invalid QR code" copy (`useHomeForm.ts:221`).
         */
        fun applyScannedWifi(raw: String): Boolean {
            val target = _state.value.scannerTargetItemId ?: return false
            val parsed = parseWifiQrPayload(raw) ?: return false
            val (ssid, password) = parsed
            _state.update { current ->
                current.copy(
                    accessItems =
                        current.accessItems.map { item ->
                            if (item.id != target) {
                                item
                            } else {
                                item.copy(
                                    accessType = AddHomeAccessType.Wifi,
                                    label = item.label.ifBlank { ssid },
                                    secretValue =
                                        if (password.isNotEmpty()) password else item.secretValue,
                                    labelError = null,
                                    valueError = null,
                                )
                            }
                        },
                    scannerTargetItemId = null,
                )
            }
            return true
        }

        /**
         * A row is invalid when exactly one of label / value is filled.
         * Mirrors RN's `validateAccessItems` (`useHomeForm.ts:184-200`).
         */
        fun validateAccessItems(): Boolean {
            var isValid = true
            val validated =
                _state.value.accessItems.map { item ->
                    val hasLabel = item.label.isNotBlank()
                    val hasSecret = item.secretValue.isNotBlank()
                    if (hasLabel == hasSecret) {
                        item.copy(labelError = null, valueError = null)
                    } else {
                        isValid = false
                        item.copy(
                            labelError =
                                if (hasLabel) null else "Label is required when a value is entered.",
                            valueError =
                                if (hasSecret) {
                                    null
                                } else {
                                    "Password/code is required when label is entered."
                                },
                        )
                    }
                }
            _state.update {
                it.copy(
                    accessItems = validated,
                    errorMessage = if (isValid) it.errorMessage else "Please fix the highlighted fields.",
                )
            }
            return isValid
        }

        fun acknowledgeAccessSecretWarning() {
            _state.update { it.copy(accessSecretWarning = null) }
        }

        fun acknowledgeEvent() {
            pendingEvent.value = null
        }

        // MARK: - State machine

        private suspend fun advance() {
            val current = _state.value.form.currentStep
            when (current) {
                AddHomeStep.Address -> {
                    transitionTo(AddHomeStep.Confirm)
                    runCheckAddress()
                }
                AddHomeStep.Confirm -> {
                    if (!_state.value.isCheckingAddress &&
                        _state.value.zipMismatch == null &&
                        !_state.value.showsClaimedModal
                    ) {
                        transitionTo(AddHomeStep.Role)
                    }
                }
                AddHomeStep.Role -> transitionTo(AddHomeStep.Review)
                AddHomeStep.Review -> submit()
                AddHomeStep.Success -> {
                    val homeId = _state.value.createdHomeId ?: return
                    pendingEvent.value = AddHomeOutboundEvent.OpenHomeDashboard(homeId)
                }
            }
        }

        private fun goBack() {
            val previous = AddHomeStep.fromOrdinal(_state.value.form.step - 1)
            transitionTo(previous)
        }

        private fun transitionTo(step: AddHomeStep) {
            _state.update {
                it.copy(form = it.form.copy(step = step.ordinal0), errorMessage = null)
            }
            persist()
            step.stepNumber?.let { number ->
                Analytics.track(
                    AnalyticsEvent.ScreenAddHomeWizardStepViewed(
                        stepNumber = number,
                        stepName = step.name,
                    ),
                )
            }
        }

        // MARK: - API calls

        private suspend fun runCheckAddress() {
            val fields = _state.value.form.address
            _state.update {
                it.copy(
                    isCheckingAddress = true,
                    addressCheck = null,
                    geocodedAddress = null,
                    errorMessage = null,
                    showsClaimedModal = false,
                    showsConfirmAddressSheet = false,
                    isClaimingExistingHome = false,
                    existingHomeId = null,
                )
            }
            val request =
                CheckAddressRequest(
                    address = fields.street,
                    unitNumber = fields.unit.takeIf { it.isNotEmpty() },
                    city = fields.city,
                    state = fields.state,
                    zipCode = fields.zipCode,
                )
            when (val result = repository.checkAddress(request)) {
                is NetworkResult.Success ->
                    _state.update {
                        it.copy(
                            addressCheck = result.data,
                            geocodedAddress = geocodedAddress(result.data, fields),
                            isCheckingAddress = false,
                            existingHomeId = result.data.homeId,
                            // RN `useHomeForm.ts:611` — never advance;
                            // the modal owns the next action.
                            showsClaimedModal = result.data.isAlreadyClaimed,
                            // A home row exists with no active occupants —
                            // RN claims it instead of creating a duplicate
                            // (`useHomeForm.ts:616`).
                            isClaimingExistingHome =
                                result.data.isFoundUnclaimed && result.data.homeId != null,
                        )
                    }
                is NetworkResult.Failure ->
                    _state.update {
                        it.copy(
                            isCheckingAddress = false,
                            errorMessage =
                                result.error.message
                                    ?: "Couldn't verify that address. Try again.",
                        )
                    }
            }
            // RN runs the property lookup right after check-address and
            // only for the create-a-new-home path (`useHomeForm.ts:625`);
            // the claim paths skip straight to role selection.
            val current = _state.value
            if (!current.showsClaimedModal && !current.isClaimingExistingHome && current.errorMessage == null) {
                loadPropertySuggestions()
            }
        }

        /**
         * `POST /api/homes/property-suggestions` — route
         * `backend/routes/home.js:540`. Fills the Details block from
         * public records (ATTOM → heuristics → optional LLM). A failure is
         * never fatal: the fields stay editable and the card says the
         * lookup was unavailable, exactly as RN does
         * (`useHomeForm.ts:657-662`).
         */
        suspend fun loadPropertySuggestions() {
            _state.update { it.copy(isLoadingPropertySuggestions = true) }
            val current = _state.value
            val source = current.geocodedAddress
            val fields = current.form.address
            val unit = source?.unit ?: fields.unit
            val request =
                PropertySuggestionsRequest(
                    address = source?.street ?: fields.street,
                    unitNumber = unit.takeIf { it.isNotEmpty() },
                    city = source?.city ?: fields.city,
                    state = (source?.state ?: fields.state).uppercase(),
                    zipCode = source?.zipCode ?: fields.zipCode,
                )
            when (val result = repository.propertySuggestions(request)) {
                is NetworkResult.Success ->
                    _state.update {
                        it.copy(
                            isLoadingPropertySuggestions = false,
                            propertySuggestions = result.data,
                            propertyLookupComplete = true,
                            propertyLookupMessage = lookupMessage(result.data),
                            form =
                                it.form.copy(
                                    details = applySuggestions(it.form.details, result.data.suggestions),
                                ),
                        )
                    }
                is NetworkResult.Failure ->
                    _state.update {
                        it.copy(
                            isLoadingPropertySuggestions = false,
                            propertySuggestions = null,
                            propertyLookupComplete = true,
                            propertyLookupMessage =
                                "Public property records are unavailable right now. " +
                                    "Confirm the details below.",
                        )
                    }
            }
            persist()
        }

        // MARK: - Address-already-claimed modal

        /**
         * "Change address" / "Edit" — close the modal and return to the
         * address step so the user can correct their input.
         */
        fun dismissClaimedModal() {
            _state.update {
                it.copy(
                    showsClaimedModal = false,
                    showsConfirmAddressSheet = false,
                    isClaimingExistingHome = false,
                    existingHomeId = null,
                )
            }
            transitionTo(AddHomeStep.Address)
        }

        /** "This address is correct" → show the confirm page. */
        fun showConfirmAddressStep() {
            _state.update { it.copy(showsConfirmAddressSheet = true) }
        }

        /**
         * "Confirm address" — commit to joining the existing home. RN
         * skips the details step and lands on role selection
         * (`useHomeForm.ts:700-705`).
         */
        fun confirmClaimedAddress() {
            _state.update {
                it.copy(
                    showsClaimedModal = false,
                    showsConfirmAddressSheet = false,
                    isClaimingExistingHome = true,
                )
            }
            transitionTo(AddHomeStep.Role)
        }

        private suspend fun submitExistingHomeClaim(role: AddHomeRole) {
            val homeId = _state.value.existingHomeId
            if (homeId == null) {
                _state.update {
                    it.copy(
                        errorMessage =
                            "We could not find the existing home record. " +
                                "Please try that address again.",
                    )
                }
                transitionTo(AddHomeStep.Address)
                return
            }
            if (role == AddHomeRole.Owner) {
                // Owner path: verification, not a residency claim.
                pendingEvent.value = AddHomeOutboundEvent.OpenClaimOwnership(homeId)
                return
            }
            _state.update { it.copy(isSubmitting = true, errorMessage = null) }
            when (val result = discoveryRepository.submitResidencyClaim(homeId, role.claimedRole)) {
                is NetworkResult.Success -> {
                    _state.update { it.copy(isSubmitting = false) }
                    pendingEvent.value = AddHomeOutboundEvent.OpenWaitingRoom(homeId)
                }
                is NetworkResult.Failure ->
                    _state.update {
                        it.copy(
                            isSubmitting = false,
                            errorMessage = result.error.message ?: "Failed to submit claim",
                        )
                    }
            }
        }

        private suspend fun submit() {
            val role = _state.value.form.role ?: return
            val fields = _state.value.form.address
            Analytics.track(AnalyticsEvent.CtaAddHomeSubmit)
            if (!networkMonitor.isOnline.value) {
                // P15: surface offline state inline; never silent-queue.
                _state.update {
                    it.copy(
                        errorMessage = "You're offline. Try again when you're back online.",
                    )
                }
                return
            }
            // Existing-home flow: claim it rather than creating a
            // duplicate Home row (RN `useHomeForm.ts:456-473`).
            if (_state.value.isClaimingExistingHome) {
                submitExistingHomeClaim(role)
                return
            }
            // Networks & codes only exist on the create path; validate
            // them before we make a Home row we can't attach them to
            // (RN `useHomeForm.ts:450`).
            if (!validateAccessItems()) return
            _state.update { it.copy(isSubmitting = true, errorMessage = null) }
            val details = _state.value.form.details
            val nickname = details.nickname.trim()
            val description = details.description.trim()
            val request =
                CreateHomeRequest(
                    address = fields.street,
                    unitNumber = fields.unit.takeIf { it.isNotEmpty() },
                    city = fields.city,
                    state = fields.state,
                    zipCode = fields.zipCode,
                    // `createHomeSchema` requires coordinates
                    // (`backend/routes/home.js:120-124`); check-address
                    // already resolved them.
                    latitude = _state.value.geocodedAddress?.latitude,
                    longitude = _state.value.geocodedAddress?.longitude,
                    homeType = details.homeType.wireValue,
                    // RN falls back to the street when no nickname is
                    // typed (`useHomeForm.ts:302`).
                    name = nickname.ifEmpty { fields.street },
                    description = description.ifEmpty { null },
                    bedrooms = details.bedrooms.toIntOrNull(),
                    bathrooms = details.bathrooms.toDoubleOrNull(),
                    sqFt = details.sqFt.toIntOrNull(),
                    lotSqFt = details.lotSqFt.toIntOrNull(),
                    yearBuilt = details.yearBuilt.toIntOrNull(),
                    isOwner = role == AddHomeRole.Owner,
                    role = role.claimedRole,
                    attomPropertyDetail = _state.value.propertySuggestions?.attomPropertyDetail,
                )
            when (val result = repository.create(request)) {
                is NetworkResult.Success -> {
                    val homeId = result.data.home.id
                    _state.update {
                        it.copy(
                            createdHomeId = homeId,
                            isSubmitting = false,
                            form = it.form.copy(step = AddHomeStep.Success.ordinal0),
                        )
                    }
                    persistAccessSecrets(homeId)
                    persist()
                }
                is NetworkResult.Failure -> {
                    // UX-06: a 422 from address verification carries a `code`
                    // saying exactly what is wrong. Without this the user
                    // completed every step and got a generic networking string,
                    // with no idea what to change.
                    val addressError = AddressVerificationError.from(result.error)
                    _state.update {
                        it.copy(
                            isSubmitting = false,
                            addressVerificationError = addressError,
                            errorMessage =
                                addressError?.displayMessage
                                    ?: result.error.message
                                    ?: "Couldn't add your home. Please try again.",
                            form =
                                if (addressError?.isFixableInAddressStep == true) {
                                    // Send them back to the step that can fix it
                                    // rather than stranding them on the last screen.
                                    it.form.copy(step = AddHomeStep.Address.ordinal0)
                                } else {
                                    it.form
                                },
                        )
                    }
                }
            }
        }

        /**
         * `POST /api/homes/:id/access` for every filled Setup row — route
         * `backend/routes/home.js:5735`. Mirrors RN's
         * `finalizeCreatedHome` (`useHomeForm.ts:321-336`): a failure here
         * is non-fatal because the home already exists, but we tell the
         * user which rows to re-add rather than dropping them silently.
         */
        private suspend fun persistAccessSecrets(homeId: String) {
            val failedLabels = mutableListOf<String>()
            for (item in _state.value.accessItems) {
                if (!item.isComplete) continue
                val label = item.label.trim()
                val result =
                    repository.createHomeAccessSecret(
                        homeId = homeId,
                        request =
                            CreateAccessSecretRequest(
                                accessType = item.accessType.wireValue,
                                label = label,
                                secretValue = item.secretValue.trim(),
                            ),
                    )
                if (result is NetworkResult.Failure) failedLabels.add(label)
            }
            if (failedLabels.isEmpty()) return
            _state.update {
                it.copy(
                    accessSecretWarning =
                        "Your home was created, but we couldn't save " +
                            failedLabels.joinToString(", ") +
                            ". Add them again from Access codes.",
                )
            }
        }

        // MARK: - Persistence

        private fun persist() {
            val form = _state.value.form
            savedStateHandle[KEY_STEP] = form.step
            savedStateHandle[KEY_STREET] = form.address.street
            savedStateHandle[KEY_UNIT] = form.address.unit
            savedStateHandle[KEY_CITY] = form.address.city
            savedStateHandle[KEY_STATE] = form.address.state
            savedStateHandle[KEY_ZIP] = form.address.zipCode
            savedStateHandle[KEY_PRIMARY] = form.isPrimary
            savedStateHandle[KEY_ROLE] = form.role?.name
            // Details fields survive process death. Access secrets do NOT
            // — they are passwords and stay in memory only.
            savedStateHandle[KEY_NICKNAME] = form.details.nickname
            savedStateHandle[KEY_HOME_TYPE] = form.details.homeType.name
            savedStateHandle[KEY_BEDROOMS] = form.details.bedrooms
            savedStateHandle[KEY_BATHROOMS] = form.details.bathrooms
            savedStateHandle[KEY_SQ_FT] = form.details.sqFt
            savedStateHandle[KEY_LOT_SQ_FT] = form.details.lotSqFt
            savedStateHandle[KEY_YEAR_BUILT] = form.details.yearBuilt
            savedStateHandle[KEY_DESCRIPTION] = form.details.description
        }

        private fun restoreFormState(): AddHomeFormState {
            val step: Int = savedStateHandle[KEY_STEP] ?: AddHomeStep.Address.ordinal0
            val street: String = savedStateHandle[KEY_STREET] ?: ""
            val unit: String = savedStateHandle[KEY_UNIT] ?: ""
            val city: String = savedStateHandle[KEY_CITY] ?: ""
            val state: String = savedStateHandle[KEY_STATE] ?: ""
            val zip: String = savedStateHandle[KEY_ZIP] ?: ""
            val isPrimary: Boolean = savedStateHandle[KEY_PRIMARY] ?: true
            val roleName: String? = savedStateHandle[KEY_ROLE]
            val role =
                roleName?.let { name ->
                    AddHomeRole.entries.firstOrNull { it.name == name }
                }
            val homeTypeName: String? = savedStateHandle[KEY_HOME_TYPE]
            return AddHomeFormState(
                step = step,
                address = AddHomeAddressFields(street, unit, city, state, zip),
                isPrimary = isPrimary,
                role = role,
                details =
                    AddHomeDetailsFields(
                        nickname = savedStateHandle[KEY_NICKNAME] ?: "",
                        homeType =
                            AddHomeHomeType.entries.firstOrNull { it.name == homeTypeName }
                                ?: AddHomeHomeType.House,
                        bedrooms = savedStateHandle[KEY_BEDROOMS] ?: "",
                        bathrooms = savedStateHandle[KEY_BATHROOMS] ?: "",
                        sqFt = savedStateHandle[KEY_SQ_FT] ?: "",
                        lotSqFt = savedStateHandle[KEY_LOT_SQ_FT] ?: "",
                        yearBuilt = savedStateHandle[KEY_YEAR_BUILT] ?: "",
                        description = savedStateHandle[KEY_DESCRIPTION] ?: "",
                    ),
            )
        }

        // MARK: - Chrome derivation

        private fun computeChrome(state: AddHomeUiState): WizardChrome {
            val step = state.form.currentStep
            val progress = progressLabel(step)
            return WizardChrome(
                title = title(step),
                progressLabel = progress,
                progressFraction = progressFraction(step),
                leading = leadingControl(step),
                primaryCtaLabel = primaryCtaLabel(step),
                primaryCtaEnabled =
                    primaryEnabled(state) &&
                        !state.isSubmitting &&
                        !state.isCheckingAddress &&
                        !state.isLoadingPropertySuggestions,
                secondaryCta = secondaryCta(step),
                isSubmitting =
                    state.isSubmitting ||
                        state.isCheckingAddress ||
                        state.isLoadingPropertySuggestions,
                dirty =
                    step != AddHomeStep.Success &&
                        (
                            state.selectedHomeId != null ||
                                state.homeSearchQuery.isNotEmpty() ||
                                state.form.address.street.isNotEmpty()
                        ),
                showsProgressBar = step != AddHomeStep.Success,
            )
        }

        private fun title(step: AddHomeStep): String =
            when (step) {
                AddHomeStep.Address -> "Find your home"
                else -> "Add home"
            }

        private fun leadingControl(step: AddHomeStep): WizardLeadingControl =
            when (step) {
                AddHomeStep.Address, AddHomeStep.Success -> WizardLeadingControl.Close
                AddHomeStep.Confirm, AddHomeStep.Role, AddHomeStep.Review -> WizardLeadingControl.Back
            }

        private fun primaryCtaLabel(step: AddHomeStep): String =
            when (step) {
                AddHomeStep.Address, AddHomeStep.Confirm, AddHomeStep.Role -> "Continue"
                AddHomeStep.Review -> if (_state.value.isClaimingExistingHome) "Submit claim" else "Submit"
                AddHomeStep.Success -> "View home"
            }

        private fun secondaryCta(step: AddHomeStep): WizardSecondaryCta? =
            if (step == AddHomeStep.Success) {
                WizardSecondaryCta(label = "Back to Hub", testTag = "addHomeBackToHub")
            } else {
                null
            }

        private fun progressLabel(step: AddHomeStep): WizardProgressLabel {
            val number = step.stepNumber ?: return WizardProgressLabel.Hidden
            return WizardProgressLabel.StepOf(current = number, total = AddHomeStep.PROGRESS_TOTAL)
        }

        private fun progressFraction(step: AddHomeStep): Float? {
            val number = step.stepNumber ?: return null
            return number.toFloat() / AddHomeStep.PROGRESS_TOTAL
        }

        private fun primaryEnabled(state: AddHomeUiState): Boolean =
            when (state.form.currentStep) {
                AddHomeStep.Address -> state.selectedHomeId != null
                AddHomeStep.Confirm ->
                    !state.isCheckingAddress &&
                        state.errorMessage == null &&
                        state.zipMismatch == null &&
                        !state.showsClaimedModal
                AddHomeStep.Role -> state.form.role != null
                AddHomeStep.Review -> state.form.role != null
                AddHomeStep.Success -> state.createdHomeId != null
            }

        companion object {
            private const val KEY_STEP = "addHome.step"
            private const val KEY_STREET = "addHome.street"
            private const val KEY_UNIT = "addHome.unit"
            private const val KEY_CITY = "addHome.city"
            private const val KEY_STATE = "addHome.state"
            private const val KEY_ZIP = "addHome.zip"
            private const val KEY_PRIMARY = "addHome.primary"
            private const val KEY_ROLE = "addHome.role"
            private const val KEY_NICKNAME = "addHome.nickname"
            private const val KEY_HOME_TYPE = "addHome.homeType"
            private const val KEY_BEDROOMS = "addHome.bedrooms"
            private const val KEY_BATHROOMS = "addHome.bathrooms"
            private const val KEY_SQ_FT = "addHome.sqFt"
            private const val KEY_LOT_SQ_FT = "addHome.lotSqFt"
            private const val KEY_YEAR_BUILT = "addHome.yearBuilt"
            private const val KEY_DESCRIPTION = "addHome.description"

            /** RN's three-way message (`useHomeForm.ts:641-647`). */
            private fun lookupMessage(response: PropertySuggestionsResponse): String =
                when {
                    response.hasAttomRecord ->
                        "Public property records found. Review them before continuing."
                    !response.tiersUsed.isNullOrEmpty() ->
                        "No ATTOM property record was returned, so we prefilled what we " +
                            "could from address hints."
                    else ->
                        "No ATTOM property record was available for this address. " +
                            "Confirm the details below."
                }

            /** Prefill only — never overwrite something the user already typed. */
            private fun applySuggestions(
                current: AddHomeDetailsFields,
                suggestions: PropertySuggestionsFields?,
            ): AddHomeDetailsFields {
                if (suggestions == null) return current
                return current.copy(
                    homeType =
                        AddHomeHomeType.fromCanonical(suggestions.homeType) ?: current.homeType,
                    bedrooms =
                        current.bedrooms.ifEmpty { suggestions.bedrooms?.toString().orEmpty() },
                    bathrooms =
                        current.bathrooms.ifEmpty {
                            suggestions.bathrooms?.let(::trimTrailingZero).orEmpty()
                        },
                    sqFt = current.sqFt.ifEmpty { suggestions.sqFt?.toString().orEmpty() },
                    lotSqFt = current.lotSqFt.ifEmpty { suggestions.lotSqFt?.toString().orEmpty() },
                    yearBuilt =
                        current.yearBuilt.ifEmpty { suggestions.yearBuilt?.toString().orEmpty() },
                    description =
                        current.description.ifEmpty { suggestions.description.orEmpty() },
                )
            }

            /** "2.0" → "2", "2.5" → "2.5". */
            private fun trimTrailingZero(value: Double): String =
                if (value == Math.floor(value)) value.toInt().toString() else value.toString()

            private fun geocodedAddress(
                response: CheckAddressResponse,
                fallback: AddHomeAddressFields,
            ): AddHomeGeocodedAddress? {
                val normalized = response.normalizedAddress ?: return null
                return AddHomeGeocodedAddress(
                    street = normalized.streetValue() ?: fallback.street,
                    unit = normalized.unitValue() ?: fallback.unit,
                    city = normalized.city.takeUnlessBlank() ?: fallback.city,
                    state = normalized.state.takeUnlessBlank() ?: fallback.state,
                    zipCode = normalized.zipValue() ?: fallback.zipCode,
                    latitude = normalized.latitude ?: normalized.lat,
                    longitude = normalized.longitude ?: normalized.lng,
                    isMultiUnit = normalized.isMultiUnit ?: fallback.unit.isNotEmpty(),
                )
            }

            private fun NormalizedAddressDto.streetValue(): String? =
                street.takeUnlessBlank() ?: address.takeUnlessBlank() ?: addressLine1.takeUnlessBlank()

            private fun NormalizedAddressDto.unitValue(): String? = unit.takeUnlessBlank() ?: unitNumber.takeUnlessBlank()

            private fun NormalizedAddressDto.zipValue(): String? =
                zipCode.takeUnlessBlank()
                    ?: zipCodeSnake.takeUnlessBlank()
                    ?: zipcode.takeUnlessBlank()
                    ?: postalCode.takeUnlessBlank()
                    ?: postalCodeSnake.takeUnlessBlank()

            private fun String?.takeUnlessBlank(): String? = this?.trim()?.takeIf { it.isNotEmpty() }
        }
    }

/** The five user-facing input fields in step 1. */
enum class AddressField { Street, Unit, City, State, Zip }
