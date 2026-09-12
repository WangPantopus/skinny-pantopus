//
//  AddHomeWizardViewModel.swift
//  Pantopus
//
//  Wizard view model. Drives the 4-step + success state machine, keeps
//  address entry bound to live search and canonical validation, and exposes
//  the small `WizardChrome` shape the shared `WizardShell` consumes.
//
//  Step 2 (Confirm) also owns the A12.2 Details block — the
//  `property-suggestions` lookup plus the eight editable property fields
//  — and step 3 (Role) owns the Setup block's access secrets, mirroring
//  RN's three-step `useHomeForm` (Location → Details → Setup).
//
// swiftlint:disable type_body_length file_length

import Foundation
import Observation

/// Tap intents the view raises on the wizard. Kept narrow so the model's
/// API surface is easy to reason about and unit-test.
public enum AddHomeIntent: Sendable {
    case primaryCTA
    case leading
    case selectRole(AddHomeRole)
    case togglePrimaryHome(Bool)
    case viewHome
    case backToHub
}

/// Outbound navigation events the view should react to.
public enum AddHomeOutboundEvent: Sendable, Equatable {
    /// Pop the wizard with no further navigation.
    case dismiss
    /// Pop the wizard and navigate to the newly-created home dashboard.
    case openHomes
    /// `check-address` matched an already-claimed home and the user
    /// picked the owner role — hand off to the ownership-claim wizard
    /// for that existing home instead of creating a duplicate row.
    /// Mirrors RN `useHomeForm.ts:461`.
    case openClaimOwnership(homeId: String)
    /// Residency claim submitted against an existing home — RN routes
    /// to the waiting room (`useHomeForm.ts:466`).
    case openWaitingRoom(homeId: String)
}

struct AddHomeGeocodedAddress: Equatable {
    let street: String
    let unit: String
    let city: String
    let state: String
    let zipCode: String
    let latitude: Double?
    let longitude: Double?
    let isMultiUnit: Bool
}

struct AddHomeZipMismatch: Equatable {
    let enteredZip: String
    let correctedZip: String
    let street: String
    let city: String
    let state: String
}

@Observable
@MainActor
final class AddHomeWizardViewModel: WizardModel {
    // MARK: - Public state

    /// Live form snapshot — mirrored into `@SceneStorage` so the wizard
    /// can be restored after process death.
    private(set) var form: AddHomeFormState

    /// Single search query used by the A12.1 step-1 typeahead.
    private(set) var homeSearchQuery: String = ""
    /// Candidate id selected from nearby results or autocomplete.
    private(set) var selectedHomeID: String?
    private(set) var searchResults: [GeoSuggestion] = []
    private(set) var isFindingAddress = false
    private(set) var addressSearchError: String?
    private(set) var canOpenLocationSettings = false
    private(set) var isManualEntry = false
    private(set) var validatedAddressId: String?
    private var addressRevision = 0
    private var addressTask: Task<Void, Never>?
    private var retired = false

    /// Result of `POST /api/homes/property-suggestions`, fetched right
    /// after `check-address` clears — the same order RN uses
    /// (`useHomeForm.ts:625-662`). Drives the Details block's public
    /// records card and pre-fills the editable fields.
    private(set) var propertySuggestions: PropertySuggestionsResponse?
    /// True once the suggestions lookup has finished (success or not), so
    /// the Details block can switch its headline from "Tell us about your
    /// home" to "Confirm property details" (RN `DetailsStep.tsx:57-70`).
    private(set) var propertyLookupComplete: Bool = false
    /// Copy under the public-records card. Mirrors RN's
    /// `propertyLookupMessage` (`useHomeForm.ts:641-647`).
    private(set) var propertyLookupMessage: String = ""
    /// True while the suggestions call is in flight.
    private(set) var isLoadingPropertySuggestions: Bool = false

    /// Result of `POST /api/homes/check-address`, populated when entering
    /// step 2.
    private(set) var addressCheck: CheckAddressResponse?
    /// Canonical address returned by address validation, used for the
    /// confirmation map and one-tap ZIP correction.
    private(set) var geocodedAddress: AddHomeGeocodedAddress?
    /// True while the check-address call is in flight.
    private(set) var isCheckingAddress: Bool = false

    /// True while the final `POST /api/homes` is in flight.
    private(set) var isSubmitting: Bool = false

    /// User-facing error message attached to the active step. Cleared on
    /// any successful step transition.
    private(set) var errorMessage: String?

    /// The address refusal behind `errorMessage`, when that is what it is.
    /// Lets the view offer the right next step instead of a bare retry.
    private(set) var addressVerificationError: AddressVerificationError?

    /// Set once the user reaches the success step, holds the new home's
    /// id so the "View home" CTA can route to the dashboard.
    private(set) var createdHomeId: String?

    // MARK: - Existing-home (address already claimed) branch

    /// `check-address` returned `HOME_FOUND_CLAIMED` — show the
    /// two-step confirm modal instead of advancing. Mirrors RN
    /// `useHomeForm.ts:611`.
    private(set) var showsClaimedModal: Bool = false
    /// Second page of that modal ("Confirm this is your address").
    var showsConfirmAddressSheet: Bool = false
    /// Once the user confirms, submit resolves against the existing
    /// home instead of `POST /api/homes`.
    private(set) var isClaimingExistingHome: Bool = false
    /// `home_id` returned by `check-address` for the matched home.
    private(set) var existingHomeId: String?

    /// Address label rendered in the confirm sheet — the server's
    /// `formatted_address` when present, else the typed fields.
    var claimedAddressLabel: String {
        if let address = addressCheck?.residencyAddress {
            return [address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
                .filter { !$0.isEmpty }.joined(separator: ", ")
        }
        if let formatted = addressCheck?.formattedAddress?
            .trimmingCharacters(in: .whitespacesAndNewlines),
            !formatted.isEmpty {
            return formatted
        }
        return [
            form.address.street,
            form.address.unit,
            form.address.city,
            form.address.state,
            form.address.zipCode
        ]
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: ", ")
    }

    // MARK: - Setup step: networks & codes

    /// Access details join the immutable creation command in protected storage.
    /// Held off `form` so the secrets never reach `@SceneStorage`.
    private(set) var accessItems: [AddHomeAccessItem] = [AddHomeAccessItem()]
    /// Non-nil while the Wi-Fi QR scanner sheet is up; carries the row
    /// the scan will fill.
    var scannerTargetItemID: UUID?
    /// One-shot navigation events the host view consumes.
    var pendingEvent: AddHomeOutboundEvent?

    // MARK: - Private dependencies

    private let api: APIClient
    private let scope: HomeClaimSessionScope
    private let creation: HomeCreationCoordinator
    private var creationRevision = 0
    private var showsSavedCreation = false
    private var creationReadFailed = false
    private let locationProvider: any LocationProviding
    private let isOnlineProvider: @MainActor () -> Bool

    // MARK: - Init

    init(
        api: APIClient = .shared,
        initialState: AddHomeFormState = .empty,
        identity: (() -> String?)? = nil,
        creationActorId: String? = nil,
        creationStore: (any PendingHomeCreationStoring)? = nil,
        creationRequestId: @escaping () -> String = { UUID().uuidString.lowercased() },
        locationProvider: any LocationProviding = DeviceLocationProvider.shared,
        // Defaults to the live NetworkMonitor in production. Tests inject
        // a closure returning a fixed value so the simulator's
        // NWPathMonitor (which can transiently report `.unsatisfied` on
        // CI runners with limited network) doesn't gate `submit()`.
        isOnlineProvider: @escaping @MainActor () -> Bool = { NetworkMonitor.shared.isOnline }
    ) {
        self.api = api
        let sessionScope = HomeClaimSessionScope(api: api, identity: identity)
        scope = sessionScope
        let actor: String = if let creationActorId {
            creationActorId
        } else if case let .signedIn(user) = (api.authProvider ?? AuthManager.shared).state {
            user.id
        } else {
            ""
        }
        creation = HomeCreationCoordinator(
            scope: HomeCreationScope(origin: api.apiBaseURL.absoluteString, actorId: actor),
            store: creationStore ?? PendingHomeCreationStore(),
            transport: APIHomeCreationTransport(api: api),
            requireCurrent: { try sessionScope.requireCurrent() },
            requestId: creationRequestId
        )
        self.locationProvider = locationProvider
        self.isOnlineProvider = isOnlineProvider
        form = initialState
        isManualEntry = initialState.address != AddHomeAddressFields()
        homeSearchQuery = initialState.address.street
    }

    /// Replace the in-memory form state from scene storage on first
    /// appear. No-op once the wizard has progressed past the restore.
    func restore(from snapshot: AddHomeFormState) {
        guard form == .empty else { return }
        form = snapshot
        // A restored form has no validated canonical receipt. Recheck its address.
        form.step = AddHomeStep.address.rawValue
        isManualEntry = snapshot.address != AddHomeAddressFields()
        homeSearchQuery = snapshot.address.street
    }

    // MARK: - WizardModel

    var chrome: WizardChrome {
        if showsCreationRecovery {
            return WizardChrome(
                title: "Add Home",
                progressLabel: .hidden,
                progressFraction: nil,
                leading: .close,
                primaryCTALabel: creationPrimaryLabel,
                primaryCTAEnabled: isCurrent && !isSubmitting && !creation.isBusy,
                isSubmitting: isSubmitting || creation.isBusy,
                dirty: false,
                showsProgressBar: false
            )
        }
        let step = currentStep
        return WizardChrome(
            title: title(for: step),
            progressLabel: progressLabel(for: step),
            progressFraction: progressFraction(for: step),
            leading: leadingControl(for: step),
            primaryCTALabel: primaryCTALabel(for: step),
            primaryCTAEnabled: isCurrent && !isFindingAddress && primaryEnabled(for: step)
                && !isSubmitting
                && !isCheckingAddress
                && !isLoadingPropertySuggestions,
            secondaryCTA: secondaryCTA(for: step),
            isSubmitting: isSubmitting || isCheckingAddress || isLoadingPropertySuggestions,
            dirty: dirtyForCloseConfirm,
            showsProgressBar: step != .success
        )
    }

    func leadingTapped() {
        if showsCreationRecovery { suspendCreation()
            pendingEvent = .dismiss
            return
        }
        switch leadingControl(for: currentStep) {
        case .back: goBack()
        case .close: pendingEvent = .dismiss
        }
    }

    func discardConfirmed() {
        finishDraft()
        pendingEvent = .dismiss
    }

    func primaryTapped() {
        if showsCreationRecovery { Task { await creationPrimaryTapped() }
            return
        }
        Task { await advance() }
    }

    #if DEBUG
    func advanceForTesting() async {
        if showsCreationRecovery { await creationPrimaryTapped() } else { await advance() }
    }
    #endif

    func secondaryTapped() {
        // Success step's "Back to Hub" — no other step uses the secondary.
        if currentStep == .success { pendingEvent = .dismiss }
    }

    // MARK: - Actual address entry

    var isCurrent: Bool {
        !retired && scope.isCurrent
    }

    private var retainsDraft = true
    var draftIdentityHash: String? {
        isCurrent && retainsDraft ? scope.storageIdentityHash : nil
    }

    func finishDraft() {
        suspendCreation()
        retainsDraft = false
        invalidateAddress()
        form = .empty
        accessItems = []
    }

    var nearbyHomes: [AddHomeAddressCandidate] {
        []
    }

    var autocompleteResults: [AddHomeAddressCandidate] {
        []
    }

    var showsAutocomplete: Bool {
        !searchResults.isEmpty && !isManualEntry
    }

    func retireSession() {
        suspendCreation()
        retired = true
        invalidateAddress()
        form = .empty
        homeSearchQuery = ""
        searchResults = []
        accessItems = []
        pendingEvent = nil
        createdHomeId = nil
        errorMessage = "Your session changed. Reopen Add Home to continue."
    }

    func suspendAddressEntry() {
        guard !isSubmitting, currentStep != .success else { return }
        invalidateAddress()
        searchResults = []
        form.step = AddHomeStep.address.rawValue
    }

    private func invalidateAddress() {
        addressRevision += 1
        addressTask?.cancel()
        addressTask = nil
        validatedAddressId = nil
        addressCheck = nil
        geocodedAddress = nil
        existingHomeId = nil
        isClaimingExistingHome = false
        showsClaimedModal = false
        showsConfirmAddressSheet = false
        isCheckingAddress = false
        isFindingAddress = false
        propertySuggestions = nil
        propertyLookupComplete = false
        isLoadingPropertySuggestions = false
        addressSearchError = nil
        canOpenLocationSettings = false
        errorMessage = nil
    }

    private func addressIsCurrent(_ revision: Int) -> Bool {
        isCurrent && addressRevision == revision && !Task.isCancelled
    }

    func updateSearchQuery(_ query: String) {
        invalidateAddress()
        homeSearchQuery = query
        selectedHomeID = nil
        form.address = .init()
        searchResults = []
        isManualEntry = false
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.count >= 3, isCurrent else { return }
        let revision = addressRevision
        isFindingAddress = true
        addressTask = Task {
            defer { if addressRevision == revision { isFindingAddress = false } }
            do {
                try await Task.sleep(for: .milliseconds(300))
                try scope.requireCurrent()
                let response: GeoAutocompleteResponse = try await api.request(GeoEndpoints.autocomplete(query: text))
                guard addressIsCurrent(revision) else { return }
                guard response.suggestions.allSatisfy({ !$0.suggestionId.isEmpty && !$0.label.isEmpty }),
                      Set(response.suggestions.map(\.suggestionId)).count == response.suggestions.count else {
                    throw APIError.invalidResponse
                }
                searchResults = response.suggestions
                if searchResults.isEmpty { addressSearchError = "No matching addresses. Enter your address manually." }
            } catch is CancellationError {
                return
            } catch {
                guard addressIsCurrent(revision) else { return }
                addressSearchError = "Address search is unavailable. Try again or enter your address manually."
            }
        }
    }

    func retryAddressSearch() {
        updateSearchQuery(homeSearchQuery)
    }

    func clearSearchQuery() {
        updateSearchQuery("")
    }

    func selectSearchResult(_ suggestion: GeoSuggestion) {
        guard searchResults.contains(where: { $0.suggestionId == suggestion.suggestionId }), isCurrent else { return }
        invalidateAddress()
        let revision = addressRevision
        isFindingAddress = true
        addressTask = Task {
            defer { if addressRevision == revision { isFindingAddress = false } }
            do {
                try scope.requireCurrent()
                let response: GeoResolveResponse = try await api.request(GeoEndpoints.resolve(suggestionId: suggestion.suggestionId))
                guard addressIsCurrent(revision) else { return }
                try applyResolvedAddress(response.normalized)
                selectedHomeID = suggestion.suggestionId
            } catch {
                guard addressIsCurrent(revision) else { return }
                addressSearchError = "Could not load that address. Try again or enter it manually."
            }
        }
    }

    func useCurrentLocation() {
        guard isCurrent else { return }
        invalidateAddress()
        let revision = addressRevision
        isFindingAddress = true
        addressTask = Task {
            defer { if addressRevision == revision { isFindingAddress = false } }
            do {
                try scope.requireCurrent()
                guard let coordinate = await locationProvider.requestCurrent(timeoutSeconds: 5),
                      addressIsCurrent(revision) else {
                    if addressIsCurrent(revision) {
                        addressSearchError = "Location is unavailable. Check location access in Settings or enter your address manually."
                        canOpenLocationSettings = true
                    }
                    return
                }
                let response: GeoReverseResponse = try await api.request(
                    GeoEndpoints.reverse(latitude: coordinate.latitude, longitude: coordinate.longitude)
                )
                guard addressIsCurrent(revision) else { return }
                try applyResolvedAddress(response.normalized)
            } catch {
                guard addressIsCurrent(revision) else { return }
                addressSearchError = "Could not find your address here. Try again or enter it manually."
            }
        }
    }

    private func applyResolvedAddress(_ address: NormalizedAddress) throws {
        let fields = AddHomeAddressFields(
            street: address.address ?? "",
            city: address.city ?? "",
            state: address.state ?? "",
            zipCode: address.zipcode ?? ""
        )
        guard fields.isComplete else { throw APIError.invalidResponse }
        form.address = fields
        homeSearchQuery = fields.street
        searchResults = []
        isManualEntry = true
    }

    func selectAddressCandidate(_ candidate: AddHomeAddressCandidate) {
        invalidateAddress()
        selectedHomeID = candidate.id
        homeSearchQuery = candidate.line1
        form.address = candidate.addressFields
        isManualEntry = true
    }

    func addManuallyTapped() {
        invalidateAddress()
        selectedHomeID = nil
        searchResults = []
        isManualEntry = true
    }

    func update(_ field: AddressField, to value: String) {
        invalidateAddress()
        switch field {
        case .street: form.address.street = value
        case .unit: form.address.unit = value
        case .city: form.address.city = value
        case .state: form.address.state = value
        case .zip: form.address.zipCode = value
        }
        selectedHomeID = nil
        homeSearchQuery = form.address.street
        isManualEntry = true
    }

    var zipMismatch: AddHomeZipMismatch? {
        guard let geocodedAddress else { return nil }
        let entered = normalizedAddHomeZip(form.address.zipCode)
        let corrected = normalizedAddHomeZip(geocodedAddress.zipCode)
        guard !entered.isEmpty, !corrected.isEmpty, entered != corrected else { return nil }
        return AddHomeZipMismatch(
            enteredZip: form.address.zipCode,
            correctedZip: geocodedAddress.zipCode,
            street: geocodedAddress.street,
            city: geocodedAddress.city,
            state: geocodedAddress.state
        )
    }

    var isGeocodeResolved: Bool {
        geocodedAddress != nil && zipMismatch == nil
    }

    func applyGeocodedZip() {
        guard let correctedZip = zipMismatch?.correctedZip else { return }
        form.address.zipCode = correctedZip
    }

    // MARK: - Field updates (step 2/3)

    func setPrimaryHome(_ isPrimary: Bool) {
        form.isPrimary = isPrimary
    }

    func selectRole(_ role: AddHomeRole) {
        form.role = role
    }

    // MARK: - Details step (RN `DetailsStep.tsx`)

    func updateNickname(_ value: String) {
        form.details.nickname = value
    }

    func selectHomeType(_ value: AddHomeHomeType) {
        form.details.homeType = value
    }

    func updateBedrooms(_ value: String) {
        form.details.bedrooms = digitsOnly(value)
    }

    func updateBathrooms(_ value: String) {
        form.details.bathrooms = decimalOnly(value)
    }

    func updateSqFt(_ value: String) {
        form.details.sqFt = digitsOnly(value)
    }

    func updateLotSqFt(_ value: String) {
        form.details.lotSqFt = digitsOnly(value)
    }

    func updateYearBuilt(_ value: String) {
        form.details.yearBuilt = digitsOnly(value)
    }

    func updateDescription(_ value: String) {
        form.details.description = value
    }

    func updateJustMoved(_ value: Bool) {
        form.details.justMoved = value
    }

    /// Today as the server's YYYY-MM-DD, in the device's own day.
    private static func isoToday(_ now: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: now)
    }

    private func digitsOnly(_ value: String) -> String {
        value.filter(\.isNumber)
    }

    /// Keeps digits plus a single decimal separator — bathrooms accept
    /// halves (`backend/routes/home.js:95`).
    private func decimalOnly(_ value: String) -> String {
        var seenSeparator = false
        var out = ""
        for character in value {
            if character.isNumber {
                out.append(character)
            } else if character == ".", !seenSeparator {
                seenSeparator = true
                out.append(character)
            }
        }
        return out
    }

    // MARK: - Setup step (RN `SetupStep.tsx`)

    func addAccessItem() {
        guard accessItems.count < 20 else {
            errorMessage = "You can include up to 20 access details. Remove an entry before adding another."
            return
        }
        accessItems.append(AddHomeAccessItem())
    }

    func removeAccessItem(_ id: UUID) {
        // RN only offers the trash affordance while more than one row
        // exists (`SetupStep.tsx:106`); keep the invariant here too.
        guard accessItems.count > 1 else { return }
        accessItems.removeAll { $0.id == id }
    }

    func updateAccessType(_ id: UUID, to type: AddHomeAccessType) {
        guard let index = accessItems.firstIndex(where: { $0.id == id }) else { return }
        accessItems[index].accessType = type
        // Picking a type fills an empty label with that type's default —
        // RN `SetupStep.tsx:82-90`.
        if accessItems[index].label.trimmingCharacters(in: .whitespaces).isEmpty {
            accessItems[index].label = type.defaultLabel
            accessItems[index].labelError = nil
        }
    }

    func updateAccessLabel(_ id: UUID, to value: String) {
        guard let index = accessItems.firstIndex(where: { $0.id == id }) else { return }
        accessItems[index].label = value
        accessItems[index].labelError = nil
    }

    func updateAccessSecret(_ id: UUID, to value: String) {
        guard let index = accessItems.firstIndex(where: { $0.id == id }) else { return }
        accessItems[index].secretValue = value
        accessItems[index].valueError = nil
    }

    func toggleAccessSecretRevealed(_ id: UUID) {
        guard let index = accessItems.firstIndex(where: { $0.id == id }) else { return }
        accessItems[index].isRevealed.toggle()
    }

    /// Open the camera QR scanner for `id` (Wi-Fi rows only).
    func openWifiQRScanner(for id: UUID) {
        scannerTargetItemID = id
    }

    func closeWifiQRScanner() {
        scannerTargetItemID = nil
    }

    /// Apply a scanned `WIFI:` payload to the targeted row. Returns false
    /// when the payload isn't a Wi-Fi QR so the sheet can show RN's
    /// "Invalid QR code" copy (`useHomeForm.ts:221`).
    @discardableResult
    func applyScannedWifi(_ raw: String) -> Bool {
        guard let targetID = scannerTargetItemID,
              let parsed = parseWifiQRPayload(raw),
              let index = accessItems.firstIndex(where: { $0.id == targetID })
        else { return false }
        accessItems[index].accessType = .wifi
        if accessItems[index].label.trimmingCharacters(in: .whitespaces).isEmpty {
            accessItems[index].label = parsed.ssid
        }
        if !parsed.password.isEmpty {
            accessItems[index].secretValue = parsed.password
        }
        accessItems[index].labelError = nil
        accessItems[index].valueError = nil
        scannerTargetItemID = nil
        return true
    }

    /// Validate optional setup before review or reserving an immutable command.
    @discardableResult
    func validateAccessItems() -> Bool {
        var isValid = true
        for index in accessItems.indices {
            let label = accessItems[index].label.trimmingCharacters(in: .whitespacesAndNewlines)
            let secret = accessItems[index].secretValue.trimmingCharacters(in: .whitespacesAndNewlines)
            accessItems[index].labelError = nil
            accessItems[index].valueError = nil
            if label.isEmpty && !secret.isEmpty {
                accessItems[index].labelError = "Label is required when a value is entered."
            } else if label.utf16.count > 200 {
                accessItems[index].labelError = "Use a label of 200 characters or fewer."
            }
            if secret.isEmpty && !label.isEmpty {
                accessItems[index].valueError = "Password/code is required when label is entered."
            } else if secret.utf16.count > 2048 {
                accessItems[index].valueError = "Use a password or code of 2,048 characters or fewer."
            }
            if accessItems[index].labelError != nil || accessItems[index].valueError != nil { isValid = false }
        }
        if !isValid { errorMessage = "Please fix the highlighted access details." }
        return isValid
    }

    /// Networks & codes are hidden when joining an existing home — RN
    /// gates the whole block on `!isClaimingExistingHome`
    /// (`SetupStep.tsx:66`).
    var showsAccessSetup: Bool {
        !isClaimingExistingHome
    }

    /// User-tapped on the "Try again" CTA after a check-address error.
    func retryCheckAddress() {
        Task { await runCheckAddress() }
    }

    // MARK: - State transitions

    var currentStep: AddHomeStep {
        AddHomeStep(rawValue: form.step) ?? .address
    }

    private func advance() async {
        guard isCurrent, !isSubmitting, !isFindingAddress, primaryEnabled(for: currentStep) else { return }
        switch currentStep {
        case .address:
            // Move to confirm and kick off check-address.
            transition(to: .confirm)
            await runCheckAddress()
        case .confirm:
            guard !isCheckingAddress, zipMismatch == nil, !showsClaimedModal else { return }
            guard let address = geocodedAddress, validatedAddressId != nil else { return }
            form.address = .init(
                street: address.street,
                unit: address.unit,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode
            )
            transition(to: .role)
        case .role:
            guard isClaimingExistingHome || validateAccessItems() else { return }
            transition(to: .review)
        case .review:
            await submit()
        case .success:
            if createdHomeId != nil { pendingEvent = .openHomes }
        }
    }

    private func goBack() {
        guard let previous = AddHomeStep(rawValue: form.step - 1) else { return }
        transition(to: previous)
    }

    private func transition(to step: AddHomeStep) {
        if step == .address { invalidateAddress() }
        form.step = step.rawValue
        errorMessage = nil
        if let stepNumber = step.stepNumber {
            Analytics.track(
                .screenAddHomeWizardStepViewed(
                    stepNumber: stepNumber,
                    stepName: String(describing: step)
                )
            )
        }
    }

    // MARK: - API calls

    private func runCheckAddress() async {
        guard isCurrent, form.address.isComplete, !isCheckingAddress else { return }
        invalidateAddress()
        let revision = addressRevision
        let fields = form.address
        isCheckingAddress = true
        defer { if addressRevision == revision { isCheckingAddress = false } }
        do {
            try scope.requireCurrent()
            let validation: HomeAddressValidationResponse = try await api.request(HomesEndpoints.validateAddress(
                HomeAddressValidationRequest(
                    line1: fields.street,
                    line2: fields.unit.isEmpty ? nil : fields.unit,
                    city: fields.city,
                    state: fields.state.uppercased(),
                    zip: fields.zipCode
                )
            ))
            guard addressIsCurrent(revision) else { return }
            guard ["OK", "MIXED_USE", "CONFLICT"].contains(validation.verdict.status) else {
                errorMessage = Self.addressValidationMessage(validation.verdict.status)
                return
            }
            guard let addressId = validation.addressId, UUID(uuidString: addressId) != nil,
                  let address = validation.verdict.normalized, address.isValid else { throw APIError.invalidResponse }
            let response: CheckAddressResponse = try await api.request(HomesEndpoints.checkAddress(
                CheckAddressRequest(
                    addressId: addressId,
                    address: address.line1,
                    unitNumber: address.line2,
                    city: address.city,
                    state: address.state,
                    zipCode: address.zip
                )
            ))
            guard addressIsCurrent(revision) else { return }
            try Self.validateLookup(response, verdictStatus: validation.verdict.status)
            addressCheck = response
            validatedAddressId = addressId
            geocodedAddress = AddHomeGeocodedAddress(
                street: response.residencyAddress?.line1 ?? address.line1,
                unit: response.residencyAddress?.line2 ?? address.line2 ?? "",
                city: response.residencyAddress?.city ?? address.city,
                state: response.residencyAddress?.state ?? address.state,
                zipCode: response.residencyAddress?.postalCode ?? address.zip,
                latitude: address.lat,
                longitude: address.lng,
                isMultiUnit: response.isMultiUnit
            )
            existingHomeId = response.homeId
            if response.isAlreadyClaimed {
                showsClaimedModal = true
            } else if response.isFoundUnclaimed {
                isClaimingExistingHome = true
            }
            if !showsClaimedModal, !isClaimingExistingHome { await loadPropertySuggestions() }
        } catch {
            guard addressIsCurrent(revision) else { return }
            validatedAddressId = nil
            geocodedAddress = nil
            errorMessage = "Could not check this address. Try again."
        }
    }

    private static func validateLookup(_ response: CheckAddressResponse, verdictStatus: String) throws {
        guard let status = response.status,
              [
                  CheckAddressResponse.statusNotFound,
                  CheckAddressResponse.statusFoundClaimed,
                  CheckAddressResponse.statusFoundUnclaimed
              ].contains(status),
              status == CheckAddressResponse.statusNotFound ? response.homeId == nil : UUID(uuidString: response.homeId ?? "") != nil
        else { throw APIError.invalidResponse }
        // A validation conflict must never turn into a create-a-new-Home offer.
        guard verdictStatus != "CONFLICT" || response.homeId != nil else { throw APIError.invalidResponse }
        guard response.homeId == nil || response.residencyAddress?.isValid == true else { throw APIError.invalidResponse }
    }

    private static func addressValidationMessage(_ status: String) -> String {
        switch status {
        case "MISSING_UNIT": "Enter your unit or apartment number, then check this address again."
        case "MISSING_STREET_NUMBER", "UNVERIFIED_STREET_NUMBER": "Check the street number and try again."
        case "PO_BOX": "Enter a street address. A PO Box cannot be used as a Home."
        case "BUSINESS": "This appears to be a business address. Check your residential address."
        case "MULTIPLE_MATCHES": "More than one address matched. Enter the complete street and unit."
        case "UNDELIVERABLE", "LOW_CONFIDENCE": "We could not verify this address. Check the details and try again."
        default: "Address verification is unavailable. Try again."
        }
    }

    /// `POST /api/homes/property-suggestions` — route
    /// `backend/routes/home.js:540`. Fills the Details block from public
    /// records (ATTOM → heuristics → optional LLM). A failure is never
    /// fatal: the fields stay editable and the card says the lookup was
    /// unavailable, exactly as RN does (`useHomeForm.ts:657-662`).
    func loadPropertySuggestions() async {
        guard isCurrent, let validatedAddressId else { return }
        let revision = addressRevision
        isLoadingPropertySuggestions = true
        defer { if addressRevision == revision { isLoadingPropertySuggestions = false } }
        let source = geocodedAddress
        let request = PropertySuggestionsRequest(
            address: source?.street ?? form.address.street,
            unitNumber: (source?.unit ?? form.address.unit).isEmpty
                ? nil
                : (source?.unit ?? form.address.unit),
            city: source?.city ?? form.address.city,
            state: (source?.state ?? form.address.state).uppercased(),
            zipCode: source?.zipCode ?? form.address.zipCode,
            addressId: validatedAddressId,
            classification: nil
        )
        do {
            let response: PropertySuggestionsResponse = try await api.request(
                HomesEndpoints.propertySuggestions(request)
            )
            guard addressIsCurrent(revision) else { return }
            propertySuggestions = response
            propertyLookupComplete = true
            propertyLookupMessage = Self.lookupMessage(for: response)
            apply(suggestions: response.suggestions)
        } catch {
            guard addressIsCurrent(revision) else { return }
            propertySuggestions = nil
            propertyLookupComplete = true
            propertyLookupMessage =
                "Public property records are unavailable right now. Confirm the details below."
        }
    }

    /// RN's three-way message (`useHomeForm.ts:641-647`).
    private static func lookupMessage(for response: PropertySuggestionsResponse) -> String {
        if response.hasAttomRecord {
            return "Public property records found. Review them before continuing."
        }
        if !(response.tiersUsed ?? []).isEmpty {
            return "No ATTOM property record was returned, so we prefilled what we could "
                + "from address hints."
        }
        return "No ATTOM property record was available for this address. Confirm the details below."
    }

    /// Prefill only — never overwrite something the user already typed.
    private func apply(suggestions: PropertySuggestionsFields?) {
        guard let suggestions else { return }
        if let homeType = AddHomeHomeType.from(canonical: suggestions.homeType) {
            form.details.homeType = homeType
        }
        if let bedrooms = suggestions.bedrooms, form.details.bedrooms.isEmpty {
            form.details.bedrooms = String(bedrooms)
        }
        if let bathrooms = suggestions.bathrooms, form.details.bathrooms.isEmpty {
            form.details.bathrooms = Self.trimTrailingZero(bathrooms)
        }
        if let sqFt = suggestions.sqFt, form.details.sqFt.isEmpty {
            form.details.sqFt = String(sqFt)
        }
        if let lotSqFt = suggestions.lotSqFt, form.details.lotSqFt.isEmpty {
            form.details.lotSqFt = String(lotSqFt)
        }
        if let yearBuilt = suggestions.yearBuilt, form.details.yearBuilt.isEmpty {
            form.details.yearBuilt = String(yearBuilt)
        }
        if let description = suggestions.description,
           !description.isEmpty,
           form.details.description.isEmpty {
            form.details.description = description
        }
    }

    /// "2.0" → "2", "2.5" → "2.5".
    private static func trimTrailingZero(_ value: Double) -> String {
        value == value.rounded()
            ? String(Int(value))
            : String(value)
    }

    // MARK: - Address-already-claimed modal

    /// "Change address" / "Edit" — close the modal and return to the
    /// address step so the user can correct their input.
    func dismissClaimedModal() {
        showsClaimedModal = false
        showsConfirmAddressSheet = false
        isClaimingExistingHome = false
        existingHomeId = nil
        transition(to: .address)
    }

    /// "This address is correct" → show the confirm page of the modal.
    func showConfirmAddressStep() {
        guard isCurrent, validatedAddressId != nil, existingHomeId != nil else { return }
        showsConfirmAddressSheet = true
    }

    /// "Confirm address" — commit to joining the existing home. RN skips
    /// the details step and lands on role selection
    /// (`useHomeForm.ts:700-705`).
    func confirmClaimedAddress() {
        guard isCurrent, validatedAddressId != nil, existingHomeId != nil,
              let address = addressCheck?.residencyAddress, address.isValid else { return }
        form.address = .init(
            street: address.line1,
            unit: address.line2,
            city: address.city,
            state: address.state,
            zipCode: address.postalCode
        )
        showsClaimedModal = false
        showsConfirmAddressSheet = false
        isClaimingExistingHome = true
        transition(to: .role)
    }

    private func submitExistingHomeClaim(role: AddHomeRole) async {
        guard isCurrent else { retireSession()
            return
        }
        guard let homeId = existingHomeId else {
            errorMessage = "We could not find the existing home record. Please try that address again."
            transition(to: .address)
            return
        }
        if role == .owner {
            // Owner path: verification, not a residency claim.
            pendingEvent = .openClaimOwnership(homeId: homeId)
            return
        }
        guard let address = addressCheck?.residencyAddress, address.isValid else {
            errorMessage = "Check the exact street and apartment again before submitting."
            transition(to: .address)
            return
        }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try scope.requireCurrent()
            try creation.prepareResidency(homeId: homeId, address: address, form: form)
            showsSavedCreation = true
            await resolveCreation(.submit)
        } catch {
            guard isCurrent else { retireSession()
                return
            }
            creationReadFailed = true
            errorMessage = error.localizedDescription
        }
    }

    private func submit() async {
        guard isCurrent, !isSubmitting, let role = form.role, validatedAddressId != nil else { return }
        Analytics.track(.ctaAddHomeSubmit)
        if !isOnlineProvider() {
            // P15: surface offline state inline; never silent-queue.
            errorMessage = "You're offline. Try again when you're back online."
            return
        }
        // Existing-home flow: claim it rather than creating a duplicate
        // Home row (RN `useHomeForm.ts:456-473`).
        if isClaimingExistingHome {
            await submitExistingHomeClaim(role: role)
            return
        }
        // Networks & codes only exist on the create path; validate them
        // before we make a Home row we can't attach them to
        // (RN `useHomeForm.ts:450`).
        guard validateAccessItems() else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        let details = form.details
        let trimmedNickname = details.nickname.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDescription = details.description.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = CreateHomeRequest(
            address: form.address.street,
            unitNumber: form.address.unit.isEmpty ? nil : form.address.unit,
            city: form.address.city,
            state: form.address.state,
            zipCode: form.address.zipCode,
            // `createHomeSchema` requires coordinates
            // (`backend/routes/home.js:120-124`); canonical validation
            // supplied them.
            latitude: geocodedAddress?.latitude,
            longitude: geocodedAddress?.longitude,
            homeType: details.homeType.rawValue,
            // RN falls back to the street when no nickname is typed
            // (`useHomeForm.ts:302`).
            name: trimmedNickname.isEmpty ? form.address.street : trimmedNickname,
            description: trimmedDescription.isEmpty ? nil : trimmedDescription,
            bedrooms: Int(details.bedrooms),
            bathrooms: Double(details.bathrooms),
            sqFt: Int(details.sqFt),
            lotSqFt: Int(details.lotSqFt),
            yearBuilt: Int(details.yearBuilt),
            isOwner: role == .owner,
            role: role.claimedRole,
            moveInDate: details.justMoved ? Self.isoToday() : nil,
            attomPropertyDetail: propertySuggestions?.attomPropertyDetail.map { JSONEncodable($0) },
            addressId: validatedAddressId
        )
        do {
            try scope.requireCurrent()
            showsSavedCreation = true
            try creation.prepare(request: request, form: form, accessItems: accessItems)
            accessItems = []
            await resolveCreation(.submit)
        } catch {
            creationReadFailed = true
            errorMessage = error.localizedDescription
        }
    }

    var showsCreationRecovery: Bool {
        isCurrent && (showsSavedCreation || creationReadFailed || creation.storageFailed)
    }

    var pendingCreation: PendingHomeCreation? {
        isCurrent ? creation.pending : nil
    }

    var creationOutcome: HomeCreationOutcome? {
        isCurrent ? creation.outcome : nil
    }

    var creationStorageUnavailable: Bool {
        creationReadFailed || creation.storageFailed
    }

    private var creationPrimaryLabel: String {
        if creationStorageUnavailable || creation.pending == nil { return "Retry recovery" }
        switch creation.outcome?.state {
        case .completed: return "Open My Homes"
        case .rejected, .cancelled: return "Edit details"
        case .pending, nil: return "Try saving again"
        }
    }

    func resumeCreation() async {
        guard isCurrent, !creation.isBusy else { return }
        do {
            try creation.restore()
            creationReadFailed = false
            showsSavedCreation = creation.pending != nil
            guard showsSavedCreation else { return }
            accessItems = []
            await resolveCreation(.check)
        } catch {
            guard isCurrent else { retireSession()
                return
            }
            creationReadFailed = true
            errorMessage = error.localizedDescription
        }
    }

    func suspendCreation() {
        creationRevision += 1
        creation.hide()
        if showsSavedCreation { accessItems = [] }
    }

    func checkCreationStatus() {
        Task { await resumeCreation() }
    }

    func cancelCreation() {
        Task { await resolveCreation(.cancel) }
    }

    private func resolveCreation(_ action: HomeCreationAction) async {
        guard isCurrent, !creation.isBusy else { return }
        let revision = creationRevision
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let result = try await creation.resolve(action)
            guard isCurrent, revision == creationRevision else { return }
            creationReadFailed = false
            errorMessage = nil
            showsSavedCreation = true
            if result.state == .completed { createdHomeId = result.residencyHomeId ?? result.home?.id }
        } catch {
            guard isCurrent, revision == creationRevision else { return }
            errorMessage = error.localizedDescription
        }
    }

    private func creationPrimaryTapped() async {
        guard isCurrent, !isSubmitting, !creation.isBusy else { return }
        if creationStorageUnavailable || creation.pending == nil { await resumeCreation()
            return
        }
        guard let outcome = creation.outcome, outcome.isTerminal else {
            await resolveCreation(.submit)
            return
        }
        do {
            let original = creation.pending
            try creation.acknowledge()
            showsSavedCreation = false
            creationReadFailed = false
            errorMessage = nil
            if outcome.state == .completed {
                pendingEvent = .openHomes
            } else if let original {
                form = original.form
                form.step = AddHomeStep.address.rawValue
                invalidateAddress()
                isManualEntry = true
                homeSearchQuery = form.address.street
                accessItems = (original.body.dictValue?["access_secrets"]?.arrayValue ?? []).compactMap {
                    guard let item = $0.dictValue, let raw = item["access_type"]?.stringValue,
                          let type = AddHomeAccessType(rawValue: raw), let label = item["label"]?.stringValue,
                          let secret = item["secret_value"]?.stringValue else { return nil }
                    return AddHomeAccessItem(accessType: type, label: label, secretValue: secret)
                }
                if accessItems.isEmpty { accessItems = [AddHomeAccessItem()] }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Chrome derivation

    private func progressLabel(for step: AddHomeStep) -> WizardProgressLabel {
        if let stepNumber = step.stepNumber {
            return .stepOf(current: stepNumber, total: AddHomeStep.progressTotal)
        }
        return .hidden
    }

    private func progressFraction(for step: AddHomeStep) -> Double? {
        guard let stepNumber = step.stepNumber else { return nil }
        return Double(stepNumber) / Double(AddHomeStep.progressTotal)
    }

    private func leadingControl(for step: AddHomeStep) -> WizardLeadingControl {
        switch step {
        case .address, .success: .close
        case .confirm, .role, .review: .back
        }
    }

    private func title(for step: AddHomeStep) -> String {
        switch step {
        case .address: "Find your home"
        default: "Add home"
        }
    }

    private func primaryCTALabel(for step: AddHomeStep) -> String {
        switch step {
        case .address, .confirm, .role: "Continue"
        case .review: isClaimingExistingHome ? "Submit claim" : "Submit"
        case .success: "Open My Homes"
        }
    }

    private func secondaryCTA(for step: AddHomeStep) -> WizardSecondaryCTA? {
        guard step == .success else { return nil }
        return WizardSecondaryCTA(label: "Back to Hub", identifier: "addHomeBackToHub")
    }

    private func primaryEnabled(for step: AddHomeStep) -> Bool {
        switch step {
        case .address: form.address.isComplete
        case .confirm:
            !isCheckingAddress && errorMessage == nil && isGeocodeResolved && validatedAddressId != nil && !showsClaimedModal
        case .role: form.role != nil && validatedAddressId != nil
        case .review: form.role != nil && validatedAddressId != nil
        case .success: createdHomeId != nil
        }
    }

    /// Whether the wizard is "dirty" enough to warrant a discard confirm
    /// when the user taps X on step 1 / success step.
    private var dirtyForCloseConfirm: Bool {
        currentStep != .success
            && (
                selectedHomeID != nil
                    || !homeSearchQuery.isEmpty
                    || [form.address.street, form.address.unit, form.address.city, form.address.state, form.address.zipCode]
                    .contains { !$0.isEmpty }
            )
    }
}

private func normalizedAddHomeZip(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
}

/// The five user-facing input fields in step 1.
public enum AddressField: String, Sendable, CaseIterable {
    case street
    case unit
    case city
    case state
    case zip
}
