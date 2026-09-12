@file:Suppress("CyclomaticComplexMethod", "LargeClass", "LongMethod", "LongParameterList", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.add_home

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.geo.GeoResolveRequest
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.data.api.models.geo.NormalizedAddress
import app.pantopus.android.data.api.models.homes.CheckAddressRequest
import app.pantopus.android.data.api.models.homes.CheckAddressResponse
import app.pantopus.android.data.api.models.homes.CreateAccessSecretRequest
import app.pantopus.android.data.api.models.homes.CreateHomeRequest
import app.pantopus.android.data.api.models.homes.HomeAddressValidationRequest
import app.pantopus.android.data.api.models.homes.PropertySuggestionsFields
import app.pantopus.android.data.api.models.homes.PropertySuggestionsRequest
import app.pantopus.android.data.api.models.homes.PropertySuggestionsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.homediscovery.HomeDiscoveryRepository
import app.pantopus.android.data.homes.HomeCreationLimits
import app.pantopus.android.data.homes.HomeCreationOutcome
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.homes.PendingHomeCreation
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardSecondaryCta
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
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
    val searchResults: List<GeoSuggestion> = emptyList(),
    val isFindingAddress: Boolean = false,
    val addressSearchError: String? = null,
    val canOpenLocationSettings: Boolean = false,
    val isManualEntry: Boolean = false,
    val validatedAddressId: String? = null,
    val isSessionCurrent: Boolean = true,
    val addressCheck: CheckAddressResponse? = null,
    val geocodedAddress: AddHomeGeocodedAddress? = null,
    val isCheckingAddress: Boolean = false,
    val isSubmitting: Boolean = false,
    val createdHomeId: String? = null,
    val pendingCreation: PendingHomeCreation? = null,
    val creationOutcome: HomeCreationOutcome? = null,
    val showsCreationRecovery: Boolean = false,
    val creationStorageUnavailable: Boolean = false,
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
    /** Optional access joins the protected atomic command and never reaches SavedStateHandle. */
    val accessItems: List<AddHomeAccessItem> = listOf(AddHomeAccessItem(id = "access-0")),
    /** Non-null while the Wi-Fi QR scanner is open; carries the target row. */
    val scannerTargetItemId: String? = null,
) {
    val creationPrimaryLabel: String get() =
        when {
            creationStorageUnavailable || pendingCreation == null -> "Retry recovery"
            creationOutcome?.state == "completed" -> "Open My Homes"
            creationOutcome?.isTerminal == true -> "Edit details"
            else -> "Try saving again"
        }

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
        private val geoApi: GeoApi,
        private val locationProvider: LocationProvider,
        sessions: HomeClaimSessionScopeFactory,
        creations: HomeCreationFactory,
    ) : ViewModel(),
        WizardModel {
        private val session = sessions.create(viewModelScope)
        private val creation = creations.create(session)
        private var creationRevision = 0L
        private var retainsDraft = true
        private var addressRevision = 0L
        private var addressJob: Job? = null
        private val _state =
            MutableStateFlow(
                restoreFormState().let { form ->
                    AddHomeUiState(
                        form = form,
                        homeSearchQuery = form.address.street,
                        isManualEntry = form.address != AddHomeAddressFields(),
                        isSessionCurrent = session.isCurrent,
                    )
                },
            )

        /** Combined UI state consumed by [AddHomeWizardScreen]. */
        val state: StateFlow<AddHomeUiState> = _state.asStateFlow()

        /** One-shot navigation events the screen reacts to. */
        val pendingEvent = MutableStateFlow<AddHomeOutboundEvent?>(null)

        init {
            viewModelScope.launch { session.invalidated.collect { if (it) retireSession() } }
        }

        // MARK: - WizardModel

        override val chrome: WizardChrome
            get() = computeChrome(_state.value)

        override fun onLeading() {
            if (_state.value.showsCreationRecovery) {
                suspendCreation()
                pendingEvent.value = AddHomeOutboundEvent.Dismiss
                return
            }
            val current = _state.value.form.currentStep
            when (leadingControl(current)) {
                WizardLeadingControl.Back -> goBack()
                WizardLeadingControl.Close -> pendingEvent.value = AddHomeOutboundEvent.Dismiss
            }
        }

        override fun onDiscard() {
            finishDraft()
            pendingEvent.value = AddHomeOutboundEvent.Dismiss
        }

        override fun onPrimary() {
            viewModelScope.launch {
                if (_state.value.showsCreationRecovery) creationPrimary() else advance()
            }
        }

        override fun onSecondary() {
            // Success step's "Back to Hub" — no other step uses the secondary.
            if (_state.value.form.currentStep == AddHomeStep.Success) {
                pendingEvent.value = AddHomeOutboundEvent.Dismiss
            }
        }

        // MARK: - Actual address entry

        val nearbyHomes: List<AddHomeAddressCandidate> get() = emptyList()
        val autocompleteResults: List<AddHomeAddressCandidate> get() = emptyList()
        val showsAutocomplete: Boolean get() = _state.value.searchResults.isNotEmpty() && !_state.value.isManualEntry

        fun suspendAddressEntry() {
            if (_state.value.isSubmitting || _state.value.form.currentStep == AddHomeStep.Success) return
            invalidateAddress()
            _state.update { it.copy(searchResults = emptyList(), form = it.form.copy(step = AddHomeStep.Address.ordinal0)) }
            persist()
        }

        private fun invalidateAddress() {
            addressRevision++
            addressJob?.cancel()
            addressJob = null
            _state.update {
                it.copy(
                    validatedAddressId = null, addressCheck = null, geocodedAddress = null,
                    existingHomeId = null, isClaimingExistingHome = false,
                    showsClaimedModal = false, showsConfirmAddressSheet = false,
                    isCheckingAddress = false, isFindingAddress = false, propertySuggestions = null,
                    propertyLookupComplete = false, isLoadingPropertySuggestions = false,
                    addressSearchError = null, canOpenLocationSettings = false, errorMessage = null,
                )
            }
        }

        private fun retireSession() {
            suspendCreation()
            invalidateAddress()
            _state.value = AddHomeUiState(isSessionCurrent = false, errorMessage = "Your session changed. Reopen Add Home to continue.")
            pendingEvent.value = null
            savedStateHandle.keys().filter { it.startsWith("addHome.") }.forEach { savedStateHandle.remove<Any>(it) }
        }

        private fun addressIsCurrent(revision: Long) = session.isCurrent && _state.value.isSessionCurrent && addressRevision == revision

        private fun <T> required(result: NetworkResult<T>): T =
            when (result) {
                is NetworkResult.Success -> result.data
                is NetworkResult.Failure -> throw result.error
            }

        private suspend fun findAddress(
            revision: Long,
            failure: String,
            action: suspend () -> Unit,
        ) {
            try {
                session.requireCurrent()
                action()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: NetworkError) {
                if (addressIsCurrent(revision)) _state.update { it.copy(addressSearchError = failure) }
            } catch (_: IllegalStateException) {
                if (addressIsCurrent(revision)) _state.update { it.copy(addressSearchError = failure) }
            } finally {
                if (addressRevision == revision) _state.update { it.copy(isFindingAddress = false) }
            }
        }

        fun updateSearchQuery(query: String) {
            invalidateAddress()
            _state.update {
                it.copy(
                    homeSearchQuery = query,
                    selectedHomeId = null,
                    form = it.form.copy(address = AddHomeAddressFields()),
                    searchResults = emptyList(),
                    isManualEntry = false,
                )
            }
            persist()
            if (query.trim().length < MIN_SEARCH_CHARACTERS || !session.isCurrent) return
            val revision = addressRevision
            _state.update { it.copy(isFindingAddress = true) }
            addressJob =
                viewModelScope.launch {
                    findAddress(revision, "Address search is unavailable. Try again or enter your address manually.") {
                        delay(SEARCH_DEBOUNCE_MILLIS)
                        val response = required(safeApiCall { geoApi.autocomplete(query.trim()) })
                        if (!addressIsCurrent(revision)) return@findAddress
                        check(
                            response.suggestions.all { it.suggestionId.isNotBlank() && it.label.isNotBlank() } &&
                                response.suggestions.distinctBy { it.suggestionId }.size == response.suggestions.size,
                        )
                        _state.update {
                            it.copy(
                                searchResults = response.suggestions,
                                addressSearchError =
                                    if (response.suggestions.isEmpty()) "No matching addresses. Enter your address manually." else null,
                            )
                        }
                    }
                }
        }

        fun retryAddressSearch() = updateSearchQuery(_state.value.homeSearchQuery)

        fun clearSearchQuery() = updateSearchQuery("")

        fun selectSearchResult(suggestion: GeoSuggestion) {
            if (!session.isCurrent || _state.value.searchResults.none { it.suggestionId == suggestion.suggestionId }) return
            invalidateAddress()
            val revision = addressRevision
            _state.update { it.copy(isFindingAddress = true) }
            addressJob =
                viewModelScope.launch {
                    findAddress(revision, "Could not load that address. Try again or enter it manually.") {
                        val response = required(safeApiCall { geoApi.resolve(GeoResolveRequest(suggestion.suggestionId)) })
                        if (addressIsCurrent(revision)) {
                            applyResolvedAddress(response.normalized)
                            _state.update { it.copy(selectedHomeId = suggestion.suggestionId) }
                        }
                    }
                }
        }

        fun useCurrentLocation() {
            if (!session.isCurrent) return
            invalidateAddress()
            val revision = addressRevision
            _state.update { it.copy(isFindingAddress = true) }
            addressJob =
                viewModelScope.launch {
                    findAddress(revision, "Could not find your address here. Try again or enter it manually.") {
                        val coordinate = required(safeApiCall { locationProvider.requestCurrent(timeoutMillis = 5000) })
                        if (!addressIsCurrent(revision)) return@findAddress
                        if (coordinate == null) {
                            locationPermissionDenied()
                            return@findAddress
                        }
                        val response = required(safeApiCall { geoApi.reverse(coordinate.latitude, coordinate.longitude) })
                        if (addressIsCurrent(revision)) applyResolvedAddress(response.normalized)
                    }
                }
        }

        fun locationPermissionDenied() {
            _state.update {
                it.copy(
                    addressSearchError = "Location is unavailable. Check location access in Settings or enter your address manually.",
                    canOpenLocationSettings = true,
                )
            }
        }

        private fun applyResolvedAddress(address: NormalizedAddress) {
            val fields =
                AddHomeAddressFields(
                    street = address.address.orEmpty(),
                    city = address.city.orEmpty(),
                    state = address.state.orEmpty(),
                    zipCode = address.zipcode.orEmpty(),
                )
            check(fields.isComplete)
            _state.update {
                it.copy(
                    form = it.form.copy(address = fields),
                    homeSearchQuery = fields.street,
                    searchResults = emptyList(),
                    isManualEntry = true,
                )
            }
            persist()
        }

        fun selectAddressCandidate(candidate: AddHomeAddressCandidate) {
            invalidateAddress()
            _state.update {
                it.copy(
                    homeSearchQuery = candidate.line1,
                    selectedHomeId = candidate.id,
                    form = it.form.copy(address = candidate.addressFields),
                    isManualEntry = true,
                )
            }
            persist()
        }

        fun addManuallyTapped() {
            invalidateAddress()
            _state.update { it.copy(selectedHomeId = null, searchResults = emptyList(), isManualEntry = true) }
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
            invalidateAddress()
            _state.update { current ->
                val next =
                    when (field) {
                        AddressField.Street -> current.form.address.copy(street = value)
                        AddressField.Unit -> current.form.address.copy(unit = value)
                        AddressField.City -> current.form.address.copy(city = value)
                        AddressField.State -> current.form.address.copy(state = value)
                        AddressField.Zip -> current.form.address.copy(zipCode = value)
                    }
                current.copy(
                    form = current.form.copy(address = next),
                    homeSearchQuery = next.street,
                    selectedHomeId = null,
                    isManualEntry = true,
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

        /** Wedge v2 D5 — "Just moved here" at claim. */
        fun setJustMoved(value: Boolean) = updateDetails { it.copy(justMoved = value) }

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
                if (current.accessItems.size >= HomeCreationLimits.MAX_ACCESS_RECORDS) return@update current
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

        /** Validate the atomic command's optional records before showing Review. */
        fun validateAccessItems(): Boolean {
            var isValid = _state.value.accessItems.size <= HomeCreationLimits.MAX_ACCESS_RECORDS
            val validated =
                _state.value.accessItems.map { item ->
                    val label = item.label.trim()
                    val secret = item.secretValue.trim()
                    val labelError =
                        when {
                            label.isEmpty() && secret.isNotEmpty() -> "Label is required when a value is entered."
                            label.length > HomeCreationLimits.MAX_LABEL_LENGTH -> "Use 200 characters or fewer for this label."
                            else -> null
                        }
                    val valueError =
                        when {
                            secret.isEmpty() && label.isNotEmpty() -> "Password/code is required when label is entered."
                            secret.length > HomeCreationLimits.MAX_VALUE_LENGTH -> "Use 2,048 characters or fewer for this value."
                            else -> null
                        }
                    if (labelError != null || valueError != null) isValid = false
                    item.copy(labelError = labelError, valueError = valueError)
                }
            _state.update {
                it.copy(
                    accessItems = validated,
                    errorMessage = if (isValid) it.errorMessage else "Please fix the highlighted fields.",
                )
            }
            return isValid
        }

        fun acknowledgeEvent() {
            if (pendingEvent.value != null) finishDraft()
            pendingEvent.value = null
        }

        // MARK: - State machine

        private suspend fun advance() {
            if (!session.isCurrent) return
            if (_state.value.isSubmitting || _state.value.isFindingAddress || !primaryEnabled(_state.value)) return
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
                        val address = _state.value.geocodedAddress ?: return
                        _state.update {
                            it.copy(
                                form =
                                    it.form.copy(
                                        address =
                                            AddHomeAddressFields(
                                                address.street,
                                                address.unit,
                                                address.city,
                                                address.state,
                                                address.zipCode,
                                            ),
                                    ),
                            )
                        }
                        transitionTo(AddHomeStep.Role)
                    }
                }
                AddHomeStep.Role -> if (_state.value.isClaimingExistingHome || validateAccessItems()) transitionTo(AddHomeStep.Review)
                AddHomeStep.Review -> submit()
                AddHomeStep.Success -> {
                    if (_state.value.createdHomeId != null) pendingEvent.value = AddHomeOutboundEvent.OpenHomes
                }
            }
        }

        private fun goBack() {
            val previous = AddHomeStep.fromOrdinal(_state.value.form.step - 1)
            transitionTo(previous)
        }

        private fun transitionTo(step: AddHomeStep) {
            if (step == AddHomeStep.Address) invalidateAddress()
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

        fun retryCheckAddress() {
            if (_state.value.form.currentStep == AddHomeStep.Confirm) viewModelScope.launch { runCheckAddress() }
        }

        private suspend fun runCheckAddress() {
            if (!session.isCurrent || !_state.value.form.address.isComplete || _state.value.isCheckingAddress) return
            invalidateAddress()
            val revision = addressRevision
            val fields = _state.value.form.address
            _state.update { it.copy(isCheckingAddress = true) }
            try {
                session.requireCurrent()
                val validation =
                    required(
                        repository.validateAddress(
                            HomeAddressValidationRequest(
                                line1 = fields.street,
                                line2 = fields.unit.takeIf { it.isNotEmpty() },
                                city = fields.city,
                                state = fields.state.uppercase(),
                                zip = fields.zipCode,
                            ),
                        ),
                    )
                if (!addressIsCurrent(revision)) return
                if (validation.verdict.status !in listOf("OK", "MIXED_USE", "CONFLICT")) {
                    _state.update { it.copy(errorMessage = addressValidationMessage(validation.verdict.status)) }
                    return
                }
                val addressId = validation.addressId
                val address = validation.verdict.normalized
                check(validId(addressId) && address != null && address.isValid)
                val response =
                    required(
                        repository.checkAddress(
                            CheckAddressRequest(
                                addressId = addressId,
                                address = address.line1,
                                unitNumber = address.line2,
                                city = address.city,
                                state = address.state,
                                zipCode = address.zip,
                            ),
                        ),
                    )
                if (!addressIsCurrent(revision)) return
                check(
                    response.status in
                        listOf(
                            CheckAddressResponse.STATUS_NOT_FOUND, CheckAddressResponse.STATUS_FOUND_CLAIMED,
                            CheckAddressResponse.STATUS_FOUND_UNCLAIMED,
                        ),
                )
                check(if (response.status == CheckAddressResponse.STATUS_NOT_FOUND) response.homeId == null else validId(response.homeId))
                check(validation.verdict.status != "CONFLICT" || response.homeId != null)
                _state.update {
                    it.copy(
                        addressCheck = response,
                        validatedAddressId = addressId,
                        geocodedAddress =
                            AddHomeGeocodedAddress(
                                street = address.line1,
                                unit = address.line2.orEmpty(),
                                city = address.city,
                                state = address.state,
                                zipCode = address.zip,
                                latitude = address.lat,
                                longitude = address.lng,
                                isMultiUnit = response.isMultiUnit,
                            ),
                        existingHomeId = response.homeId,
                        showsClaimedModal = response.isAlreadyClaimed,
                        isClaimingExistingHome = response.isFoundUnclaimed,
                    )
                }
                if (!response.isAlreadyClaimed && !response.isFoundUnclaimed) loadPropertySuggestions()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: NetworkError) {
                addressCheckFailed(revision)
            } catch (_: IllegalStateException) {
                addressCheckFailed(revision)
            } finally {
                if (addressRevision == revision) _state.update { it.copy(isCheckingAddress = false) }
            }
        }

        private fun addressCheckFailed(revision: Long) {
            if (addressIsCurrent(revision)) {
                _state.update {
                    it.copy(
                        validatedAddressId = null,
                        geocodedAddress = null,
                        errorMessage = "Could not check this address. Try again.",
                    )
                }
            }
        }

        private fun addressValidationMessage(status: String): String =
            when (status) {
                "MISSING_UNIT" -> "Enter your unit or apartment number, then check this address again."
                "MISSING_STREET_NUMBER", "UNVERIFIED_STREET_NUMBER" -> "Check the street number and try again."
                "PO_BOX" -> "Enter a street address. A PO Box cannot be used as a Home."
                "BUSINESS" -> "This appears to be a business address. Check your residential address."
                "MULTIPLE_MATCHES" -> "More than one address matched. Enter the complete street and unit."
                "UNDELIVERABLE", "LOW_CONFIDENCE" -> "We could not verify this address. Check the details and try again."
                else -> "Address verification is unavailable. Try again."
            }

        private fun validId(value: String?): Boolean =
            value != null &&
                Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}").matches(value)

        /**
         * `POST /api/homes/property-suggestions` — route
         * `backend/routes/home.js:540`. Fills the Details block from
         * public records (ATTOM → heuristics → optional LLM). A failure is
         * never fatal: the fields stay editable and the card says the
         * lookup was unavailable, exactly as RN does
         * (`useHomeForm.ts:657-662`).
         */
        suspend fun loadPropertySuggestions() {
            if (!session.isCurrent) return
            val addressId = _state.value.validatedAddressId ?: return
            val revision = addressRevision
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
                    addressId = addressId,
                )
            val result = repository.propertySuggestions(request)
            if (!addressIsCurrent(revision)) return
            when (result) {
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
            if (!session.isCurrent || _state.value.validatedAddressId == null || _state.value.existingHomeId == null) return
            _state.update { it.copy(showsConfirmAddressSheet = true) }
        }

        /**
         * "Confirm address" — commit to joining the existing home. RN
         * skips the details step and lands on role selection
         * (`useHomeForm.ts:700-705`).
         */
        fun confirmClaimedAddress() {
            if (!session.isCurrent || _state.value.validatedAddressId == null || _state.value.existingHomeId == null) return
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
            if (!session.confirmCurrent()) {
                retireSession()
                return
            }
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
            val result = discoveryRepository.submitResidencyClaim(homeId, role.claimedRole)
            if (!session.confirmCurrent()) {
                retireSession()
                return
            }
            when (result) {
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

        // Each asynchronous write must stop immediately after session retirement.
        @Suppress("ReturnCount")
        private suspend fun submit() {
            if (!session.isCurrent || _state.value.isSubmitting || _state.value.validatedAddressId == null) return
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
                    // (`backend/routes/home.js:120-124`); canonical validation supplied them.
                    addressId = _state.value.validatedAddressId,
                    latitude = _state.value.geocodedAddress?.latitude,
                    longitude = _state.value.geocodedAddress?.longitude,
                    homeType = details.homeType.wireValue,
                    // Movers first (Wedge v2 D5): today's date when the resident says they just moved.
                    moveInDate = if (details.justMoved) java.time.LocalDate.now().toString() else null,
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
            _state.update { it.copy(showsCreationRecovery = true) }
            try {
                session.requireCurrent()
                creation.prepare(
                    request.copy(
                        accessSecrets =
                            _state.value.accessItems.filter { it.isComplete }.map {
                                CreateAccessSecretRequest(
                                    it.accessType.wireValue,
                                    it.label.trim(),
                                    it.secretValue.trim(),
                                    visibility = "members",
                                )
                            },
                    ),
                    _state.value.form.creationSnapshot(),
                )
                _state.update { it.copy(pendingCreation = creation.pending, accessItems = emptyList()) }
                resolveCreation(HomeCreationAction.Submit)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: IllegalStateException) {
                if (session.isCurrent) {
                    _state.update { it.copy(creationStorageUnavailable = creation.storageFailed, errorMessage = error.message) }
                } else {
                    retireSession()
                }
            } finally {
                _state.update { it.copy(isSubmitting = false) }
            }
        }

        fun resumeCreation() {
            viewModelScope.launch { restoreCreation() }
        }

        fun cancelCreation() {
            viewModelScope.launch { resolveCreation(HomeCreationAction.Cancel) }
        }

        fun suspendCreation() {
            creationRevision++
            creation.hide()
            _state.update {
                it.copy(
                    pendingCreation = null,
                    creationOutcome = null,
                    accessItems = if (it.showsCreationRecovery) emptyList() else it.accessItems,
                )
            }
        }

        private suspend fun restoreCreation() {
            if (!session.isCurrent || creation.isBusy) return
            val revision = creationRevision
            try {
                creation.restore()
                if (revision != creationRevision || !session.isCurrent) return
                _state.update {
                    it.copy(
                        showsCreationRecovery = creation.pending != null,
                        pendingCreation = creation.pending,
                        creationOutcome = creation.outcome,
                        creationStorageUnavailable = false,
                        accessItems = if (creation.pending != null) emptyList() else it.accessItems,
                    )
                }
                if (creation.pending != null) resolveCreation(HomeCreationAction.Check)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: IllegalStateException) {
                if (revision == creationRevision && session.isCurrent) {
                    _state.update {
                        it.copy(
                            showsCreationRecovery = true,
                            creationStorageUnavailable = true,
                            errorMessage = error.message,
                        )
                    }
                }
            }
        }

        private suspend fun resolveCreation(action: HomeCreationAction) {
            if (!session.isCurrent || creation.isBusy) return
            val revision = creationRevision
            _state.update { it.copy(isSubmitting = true, errorMessage = null) }
            try {
                val result = creation.resolve(action)
                if (revision != creationRevision || !session.isCurrent) return
                _state.update {
                    it.copy(
                        pendingCreation = creation.pending,
                        creationOutcome = result,
                        showsCreationRecovery = true,
                        creationStorageUnavailable = false,
                        createdHomeId = result.home?.id,
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: IllegalStateException) {
                if (revision == creationRevision && session.isCurrent) {
                    _state.update {
                        it.copy(
                            pendingCreation = creation.pending,
                            creationOutcome = creation.outcome,
                            creationStorageUnavailable = creation.storageFailed,
                            errorMessage = error.message,
                        )
                    }
                }
            } finally {
                _state.update { it.copy(isSubmitting = false) }
            }
        }

        private suspend fun creationPrimary() {
            if (!session.isCurrent || _state.value.isSubmitting || creation.isBusy) return
            if (_state.value.creationStorageUnavailable || creation.pending == null) {
                restoreCreation()
                return
            }
            val outcome = creation.outcome
            if (outcome?.isTerminal != true) {
                resolveCreation(HomeCreationAction.Submit)
                return
            }
            try {
                val original = checkNotNull(creation.pending)
                val form = if (outcome.state == "completed") null else restoreHomeCreationForm(original.form)
                val access =
                    if (form == null) {
                        emptyList()
                    } else {
                        creation.request(original).accessSecrets.orEmpty().mapIndexed { index, item ->
                            AddHomeAccessItem(
                                "recovered-$index",
                                AddHomeAccessType.entries.first { it.wireValue == item.accessType },
                                item.label,
                                item.secretValue,
                            )
                        }
                    }
                creation.acknowledge()
                _state.update {
                    it.copy(
                        showsCreationRecovery = false,
                        pendingCreation = null,
                        creationOutcome = null,
                        creationStorageUnavailable = false,
                        errorMessage = null,
                    )
                }
                if (outcome.state == "completed") {
                    pendingEvent.value = AddHomeOutboundEvent.OpenHomes
                } else if (form != null) {
                    invalidateAddress()
                    _state.update {
                        it.copy(
                            form = form,
                            isManualEntry = true,
                            homeSearchQuery = form.address.street,
                            accessItems = access.ifEmpty { listOf(AddHomeAccessItem("access-0")) },
                        )
                    }
                    persist()
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: IllegalStateException) {
                if (session.isCurrent) {
                    _state.update {
                        it.copy(
                            errorMessage = error.message,
                            creationStorageUnavailable = creation.storageFailed,
                        )
                    }
                }
            } catch (_: IllegalArgumentException) {
                if (session.isCurrent) {
                    _state.update {
                        it.copy(errorMessage = "The original Home details could not be restored. Keep this request and contact support.")
                    }
                }
            }
        }

        // MARK: - Persistence

        private fun finishDraft() {
            suspendCreation()
            retainsDraft = false
            invalidateAddress()
            savedStateHandle.keys().filter { it.startsWith("addHome.") }.forEach { savedStateHandle.remove<Any>(it) }
            _state.update { it.copy(form = AddHomeFormState.EMPTY, accessItems = emptyList()) }
        }

        private fun persist() {
            if (!retainsDraft) return
            val identityHash = session.storageIdentityHash ?: return
            savedStateHandle[KEY_SCOPE] = identityHash
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
            if (session.storageIdentityHash == null || savedStateHandle.get<String>(KEY_SCOPE) != session.storageIdentityHash) {
                savedStateHandle.keys().filter { it.startsWith("addHome.") }.forEach { savedStateHandle.remove<Any>(it) }
                return AddHomeFormState.EMPTY
            }
            val step: Int = AddHomeStep.Address.ordinal0
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

        fun chromeFor(state: AddHomeUiState): WizardChrome = computeChrome(state)

        private fun computeChrome(state: AddHomeUiState): WizardChrome {
            if (state.showsCreationRecovery) {
                return WizardChrome(
                    title = "Add Home", progressLabel = WizardProgressLabel.Hidden,
                    progressFraction = null,
                    leading = WizardLeadingControl.Close, primaryCtaLabel = state.creationPrimaryLabel,
                    primaryCtaEnabled = state.isSessionCurrent && !state.isSubmitting && !creation.isBusy,
                    isSubmitting = state.isSubmitting || creation.isBusy, dirty = false, showsProgressBar = false,
                )
            }
            val step = state.form.currentStep
            val progress = progressLabel(step)
            return WizardChrome(
                title = title(step),
                progressLabel = progress,
                progressFraction = progressFraction(step),
                leading = leadingControl(step),
                primaryCtaLabel = primaryCtaLabel(step),
                primaryCtaEnabled =
                    state.isSessionCurrent && !state.isFindingAddress && primaryEnabled(state) &&
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
                                listOf(
                                    state.form.address.street, state.form.address.unit, state.form.address.city,
                                    state.form.address.state, state.form.address.zipCode,
                                ).any { it.isNotEmpty() }
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
                AddHomeStep.Address -> state.form.address.isComplete
                AddHomeStep.Confirm ->
                    !state.isCheckingAddress &&
                        state.errorMessage == null &&
                        state.isGeocodeResolved &&
                        state.validatedAddressId != null &&
                        !state.showsClaimedModal
                AddHomeStep.Role -> state.form.role != null && state.validatedAddressId != null
                AddHomeStep.Review -> state.form.role != null && state.validatedAddressId != null
                AddHomeStep.Success -> state.createdHomeId != null
            }

        companion object {
            private const val MIN_SEARCH_CHARACTERS = 3
            private const val SEARCH_DEBOUNCE_MILLIS = 300L
            private const val KEY_SCOPE = "addHome.sessionScope"
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
        }
    }

/** The five user-facing input fields in step 1. */
enum class AddressField { Street, Unit, City, State, Zip }
