//
//  AddHomeWizardViewModel.swift
//  Pantopus
//
//  Wizard view model. Drives the 4-step + success state machine, keeps
//  step 1 search-first with deterministic address fixtures, and exposes
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
    case openHomeDashboard(homeId: String)
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
    /// Canonical address returned by check-address, used for the
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

    /// Wi-Fi / gate / alarm secrets the user adds while creating the
    /// home. POSTed to `POST /api/homes/:id/access` once the home row
    /// exists (RN `useHomeForm.ts:321-336`). Held off `form` so the
    /// secrets never reach `@SceneStorage`.
    private(set) var accessItems: [AddHomeAccessItem] = [AddHomeAccessItem()]
    /// Non-nil while the Wi-Fi QR scanner sheet is up; carries the row
    /// the scan will fill.
    var scannerTargetItemID: UUID?
    /// Set when at least one access secret failed to save after the home
    /// was created. RN swallows these silently; we surface them because
    /// the home already exists and the user should know to re-add.
    private(set) var accessSecretWarning: String?

    /// One-shot navigation events the host view consumes.
    var pendingEvent: AddHomeOutboundEvent?

    // MARK: - Private dependencies

    private let api: APIClient
    private let isOnlineProvider: @MainActor () -> Bool

    // MARK: - Init

    init(
        api: APIClient = .shared,
        initialState: AddHomeFormState = .empty,
        // Defaults to the live NetworkMonitor in production. Tests inject
        // a closure returning a fixed value so the simulator's
        // NWPathMonitor (which can transiently report `.unsatisfied` on
        // CI runners with limited network) doesn't gate `submit()`.
        isOnlineProvider: @escaping @MainActor () -> Bool = { NetworkMonitor.shared.isOnline }
    ) {
        self.api = api
        self.isOnlineProvider = isOnlineProvider
        form = initialState
        selectedHomeID = AddHomeSampleData.candidate(for: initialState.address)?.id
        homeSearchQuery = AddHomeSampleData
            .candidate(for: initialState.address)?
            .line1 ?? ""
    }

    /// Replace the in-memory form state from scene storage on first
    /// appear. No-op once the wizard has progressed past the restore.
    func restore(from snapshot: AddHomeFormState) {
        guard form == .empty else { return }
        form = snapshot
        let candidate = AddHomeSampleData.candidate(for: snapshot.address)
        selectedHomeID = candidate?.id
        homeSearchQuery = candidate?.line1 ?? ""
    }

    // MARK: - WizardModel

    var chrome: WizardChrome {
        let step = currentStep
        return WizardChrome(
            title: title(for: step),
            progressLabel: progressLabel(for: step),
            progressFraction: progressFraction(for: step),
            leading: leadingControl(for: step),
            primaryCTALabel: primaryCTALabel(for: step),
            primaryCTAEnabled: primaryEnabled(for: step)
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
        switch leadingControl(for: currentStep) {
        case .back: goBack()
        case .close: pendingEvent = .dismiss
        }
    }

    func discardConfirmed() {
        pendingEvent = .dismiss
    }

    func primaryTapped() {
        Task { await advance() }
    }

    #if DEBUG
    func advanceForTesting() async {
        await advance()
    }
    #endif

    func secondaryTapped() {
        // Success step's "Back to Hub" — no other step uses the secondary.
        if currentStep == .success { pendingEvent = .dismiss }
    }

    // MARK: - Search updates (step 1)

    var nearbyHomes: [AddHomeAddressCandidate] {
        AddHomeSampleData.nearbyHomes
    }

    var autocompleteResults: [AddHomeAddressCandidate] {
        guard selectedHomeID == nil else { return [] }
        return AddHomeSampleData.autocompleteResults(matching: homeSearchQuery)
    }

    var showsAutocomplete: Bool {
        selectedHomeID == nil
            && !homeSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func updateSearchQuery(_ query: String) {
        homeSearchQuery = query
        selectedHomeID = nil
        form.address = .init()
        addressCheck = nil
        geocodedAddress = nil
    }

    func clearSearchQuery() {
        homeSearchQuery = ""
        selectedHomeID = nil
        form.address = .init()
        addressCheck = nil
        geocodedAddress = nil
    }

    func useCurrentLocation() {
        homeSearchQuery = ""
        selectedHomeID = nil
        form.address = .init()
        addressCheck = nil
        geocodedAddress = nil
    }

    func selectAddressCandidate(_ candidate: AddHomeAddressCandidate) {
        guard !candidate.isClaimed else { return }
        selectedHomeID = candidate.id
        homeSearchQuery = candidate.line1
        form.address = candidate.addressFields
        addressCheck = nil
        geocodedAddress = nil
    }

    func addManuallyTapped() {
        selectedHomeID = nil
        form.address = .init()
        addressCheck = nil
        geocodedAddress = nil
    }

    // MARK: - Legacy field updates (step 1)

    func update(_ field: AddressField, to value: String) {
        switch field {
        case .street: form.address.street = value
        case .unit: form.address.unit = value
        case .city: form.address.city = value
        case .state: form.address.state = value
        case .zip: form.address.zipCode = value
        }
        selectedHomeID = AddHomeSampleData.candidate(for: form.address)?.id
        homeSearchQuery = selectedHomeID == nil
            ? form.address.street
            : AddHomeSampleData.candidate(for: form.address)?.line1 ?? form.address.street
        addressCheck = nil
        geocodedAddress = nil
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

    /// A row is invalid when exactly one of label / value is filled.
    /// Mirrors RN's `validateAccessItems` (`useHomeForm.ts:184-200`).
    @discardableResult
    func validateAccessItems() -> Bool {
        var isValid = true
        for index in accessItems.indices {
            let hasLabel = !accessItems[index].label.trimmingCharacters(in: .whitespaces).isEmpty
            let hasSecret = !accessItems[index].secretValue
                .trimmingCharacters(in: .whitespaces).isEmpty
            accessItems[index].labelError = nil
            accessItems[index].valueError = nil
            guard hasLabel != hasSecret else { continue }
            isValid = false
            if !hasLabel {
                accessItems[index].labelError = "Label is required when a value is entered."
            }
            if !hasSecret {
                accessItems[index].valueError = "Password/code is required when label is entered."
            }
        }
        if !isValid {
            errorMessage = "Please fix the highlighted fields."
        }
        return isValid
    }

    /// Networks & codes are hidden when joining an existing home — RN
    /// gates the whole block on `!isClaimingExistingHome`
    /// (`SetupStep.tsx:66`).
    var showsAccessSetup: Bool {
        !isClaimingExistingHome
    }

    func acknowledgeAccessSecretWarning() {
        accessSecretWarning = nil
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
        switch currentStep {
        case .address:
            // Move to confirm and kick off check-address.
            transition(to: .confirm)
            await runCheckAddress()
        case .confirm:
            guard !isCheckingAddress, zipMismatch == nil, !showsClaimedModal else { return }
            transition(to: .role)
        case .role:
            transition(to: .review)
        case .review:
            await submit()
        case .success:
            // "View home" — route to dashboard.
            if let homeId = createdHomeId {
                pendingEvent = .openHomeDashboard(homeId: homeId)
            }
        }
    }

    private func goBack() {
        guard let previous = AddHomeStep(rawValue: form.step - 1) else { return }
        transition(to: previous)
    }

    private func transition(to step: AddHomeStep) {
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
        isCheckingAddress = true
        defer { isCheckingAddress = false }
        addressCheck = nil
        geocodedAddress = nil
        showsClaimedModal = false
        showsConfirmAddressSheet = false
        isClaimingExistingHome = false
        existingHomeId = nil
        let request = CheckAddressRequest(
            address: form.address.street,
            unitNumber: form.address.unit.isEmpty ? nil : form.address.unit,
            city: form.address.city,
            state: form.address.state,
            zipCode: form.address.zipCode
        )
        do {
            let response: CheckAddressResponse = try await api.request(
                HomesEndpoints.checkAddress(request)
            )
            addressCheck = response
            geocodedAddress = makeAddHomeGeocodedAddress(from: response, fallback: form.address)
            existingHomeId = response.homeId
            if response.isAlreadyClaimed {
                // RN `useHomeForm.ts:611` — never advance; the modal
                // owns the next action.
                showsClaimedModal = true
            } else if response.isFoundUnclaimed {
                // A home row exists with no active occupants — RN
                // (`useHomeForm.ts:616`) claims it instead of creating
                // a duplicate.
                isClaimingExistingHome = response.homeId != nil
            }
            // RN runs the property lookup right after check-address and
            // only for the create-a-new-home path (`useHomeForm.ts:625`);
            // the claim paths skip straight to role selection.
            if !showsClaimedModal, !isClaimingExistingHome {
                await loadPropertySuggestions()
            }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
                ?? "Couldn't verify that address. Try again."
        }
    }

    /// `POST /api/homes/property-suggestions` — route
    /// `backend/routes/home.js:540`. Fills the Details block from public
    /// records (ATTOM → heuristics → optional LLM). A failure is never
    /// fatal: the fields stay editable and the card says the lookup was
    /// unavailable, exactly as RN does (`useHomeForm.ts:657-662`).
    func loadPropertySuggestions() async {
        isLoadingPropertySuggestions = true
        defer { isLoadingPropertySuggestions = false }
        let source = geocodedAddress
        let request = PropertySuggestionsRequest(
            address: source?.street ?? form.address.street,
            unitNumber: (source?.unit ?? form.address.unit).isEmpty
                ? nil
                : (source?.unit ?? form.address.unit),
            city: source?.city ?? form.address.city,
            state: (source?.state ?? form.address.state).uppercased(),
            zipCode: source?.zipCode ?? form.address.zipCode,
            addressId: nil,
            classification: nil
        )
        do {
            let response: PropertySuggestionsResponse = try await api.request(
                HomesEndpoints.propertySuggestions(request)
            )
            propertySuggestions = response
            propertyLookupComplete = true
            propertyLookupMessage = Self.lookupMessage(for: response)
            apply(suggestions: response.suggestions)
        } catch {
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
        showsConfirmAddressSheet = true
    }

    /// "Confirm address" — commit to joining the existing home. RN skips
    /// the details step and lands on role selection
    /// (`useHomeForm.ts:700-705`).
    func confirmClaimedAddress() {
        showsClaimedModal = false
        showsConfirmAddressSheet = false
        isClaimingExistingHome = true
        transition(to: .role)
    }

    private func submitExistingHomeClaim(role: AddHomeRole) async {
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
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            _ = try await api.request(
                HomeDiscoveryEndpoints.submitResidencyClaim(
                    homeId: homeId,
                    request: SubmitResidencyClaimRequest(claimedRole: role.claimedRole)
                )
            ) as SubmitResidencyClaimResponse
            pendingEvent = .openWaitingRoom(homeId: homeId)
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
                ?? "Failed to submit claim"
        }
    }

    private func submit() async {
        guard let role = form.role else { return }
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
            // (`backend/routes/home.js:120-124`); check-address already
            // resolved them.
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
            attomPropertyDetail: propertySuggestions?.attomPropertyDetail.map { JSONEncodable($0) }
        )
        do {
            let response: CreateHomeResponse = try await api.request(
                HomesEndpoints.create(request)
            )
            createdHomeId = response.home.id
            await persistAccessSecrets(homeId: response.home.id)
            transition(to: .success)
        } catch {
            // UX-06: a 422 from address verification carries a `code` saying
            // exactly what is wrong. Without this the user completed every step
            // and got a generic networking string, with no idea what to change.
            if let addressError = AddressVerificationError.from(error) {
                addressVerificationError = addressError
                if addressError.isFixableInAddressStep {
                    // Send them back to the step that can actually fix it,
                    // rather than stranding them on the final screen.
                    //
                    // transition(to:) clears errorMessage on every step change,
                    // so the message has to be set AFTER the move — setting it
                    // first sent the user back to the address step with nothing
                    // on screen, which is the same silent failure this replaces.
                    transition(to: .address)
                }
                errorMessage = "\(addressError.message) \(addressError.recoverySuggestion)"
            } else {
                addressVerificationError = nil
                errorMessage = (error as? APIError)?.errorDescription
                    ?? "Couldn't add your home. Please try again."
            }
        }
    }

    /// `POST /api/homes/:id/access` for every filled Setup row — route
    /// `backend/routes/home.js:5735`. Mirrors RN's `finalizeCreatedHome`
    /// (`useHomeForm.ts:321-336`): a failure here is non-fatal because
    /// the home already exists, but we tell the user which rows to re-add
    /// rather than dropping them silently.
    private func persistAccessSecrets(homeId: String) async {
        var failedLabels: [String] = []
        for item in accessItems where item.isComplete {
            let label = item.label.trimmingCharacters(in: .whitespacesAndNewlines)
            let secret = item.secretValue.trimmingCharacters(in: .whitespacesAndNewlines)
            do {
                _ = try await api.request(
                    HomesEndpoints.createAccessSecret(
                        homeId: homeId,
                        request: CreateAccessSecretRequest(
                            accessType: item.accessType.rawValue,
                            label: label,
                            secretValue: secret
                        )
                    )
                ) as HomeAccessSecretResponse
            } catch {
                failedLabels.append(label)
            }
        }
        guard !failedLabels.isEmpty else { return }
        accessSecretWarning = "Your home was created, but we couldn't save "
            + failedLabels.joined(separator: ", ")
            + ". Add them again from Access codes."
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
        case .success: "View home"
        }
    }

    private func secondaryCTA(for step: AddHomeStep) -> WizardSecondaryCTA? {
        guard step == .success else { return nil }
        return WizardSecondaryCTA(label: "Back to Hub", identifier: "addHomeBackToHub")
    }

    private func primaryEnabled(for step: AddHomeStep) -> Bool {
        switch step {
        case .address: selectedHomeID != nil
        case .confirm:
            !isCheckingAddress && errorMessage == nil && zipMismatch == nil && !showsClaimedModal
        case .role: form.role != nil
        case .review: form.role != nil
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
                    || !form.address.street.isEmpty
            )
    }
}

private func makeAddHomeGeocodedAddress(
    from response: CheckAddressResponse,
    fallback: AddHomeAddressFields
) -> AddHomeGeocodedAddress? {
    guard let normalized = response.normalizedAddress else { return nil }
    return AddHomeGeocodedAddress(
        street: cleanAddHomeGeocodeValue(normalized.street) ?? fallback.street,
        unit: cleanAddHomeGeocodeValue(normalized.unit) ?? fallback.unit,
        city: cleanAddHomeGeocodeValue(normalized.city) ?? fallback.city,
        state: cleanAddHomeGeocodeValue(normalized.state) ?? fallback.state,
        zipCode: cleanAddHomeGeocodeValue(normalized.zipCode) ?? fallback.zipCode,
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        isMultiUnit: normalized.isMultiUnit ?? !fallback.unit.isEmpty
    )
}

private func cleanAddHomeGeocodeValue(_ value: String?) -> String? {
    guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
          !trimmed.isEmpty
    else { return nil }
    return trimmed
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
