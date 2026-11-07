//
//  CreateBusinessWizardViewModel.swift
//  Pantopus
//
//  Drives the A12.10 Create Business wizard. Step 1 uses the designed
//  category picker; steps 2–4 collect basic info / location+hours /
//  confirm and POST create-full.
//
//  Step 1 settles one category name: a listed category found by search, a
//  tile on its own, or, under "Something else", what the owner types. A
//  custom name needs no endpoint of its own: create-full's `categories` is
//  free text (`backend/routes/businesses.js:650`), as on the web wizard.
//

// swiftlint:disable file_length

import Foundation
import Logging
import Observation

/// Field caps enforced by `createBusinessFullSchema`
/// (`backend/routes/businesses.js:527`). Mirrored client-side so an
/// over-length value is trimmed as it is typed instead of surfacing as a
/// 400 after the last wizard step.
enum CreateBusinessFieldLimits {
    static let maxName = 100
    static let maxUsername = 40
    static let maxDescription = 2000
    /// Each `categories[]` entry is `Joi.string().max(50)`.
    static let maxCategory = 50
}

/// View model backing `CreateBusinessWizardView`.
@Observable
@MainActor
// swiftlint:disable:next type_body_length
final class CreateBusinessWizardViewModel: WizardModel {
    // MARK: - Published state

    private(set) var currentStep: CreateBusinessStep = .pickCategory
    private(set) var selectedCategoryId: BusinessCategory? = .home
    /// The listed category picked in search, filed under `selectedCategoryId`.
    private(set) var selectedListing: CategorySearchHit?
    /// What the owner does, in their words, when "Something else" is picked.
    private(set) var customCategory: String = ""
    var searchText: String = ""
    private(set) var isCreating: Bool = false
    private(set) var submitError: String?

    // Basic info (step 2)
    var businessName: String = ""
    var username: String = ""
    var email: String = ""
    var descriptionText: String = ""
    private(set) var usernameStatus: UsernameCheckStatus = .idle

    // Location + hours (step 3)
    var address: String = ""
    var city: String = ""
    var state: String = ""
    var zip: String = ""
    /// Suggestions under the Address field (`fillAddress` takes a pick).
    let addressSuggestions: AddressSuggestions
    private(set) var locationSkipped: Bool = false
    private(set) var hoursSkipped: Bool = false
    private(set) var hours: [BusinessHoursDay] = BusinessHoursDay.defaultWeek()

    // Logo (step 3, uploaded after create — the route needs a business id).
    private(set) var logoPick: CreateBusinessLogoPick?
    private(set) var logoSkipped: Bool = false
    /// Acknowledged before leaving the wizard when creation only partly succeeds.
    private(set) var logoUploadWarning: String?
    private(set) var publishWarning: String?

    var creationWarning: String? {
        let warnings = [logoUploadWarning, publishWarning].compactMap { $0 }
        return warnings.isEmpty ? nil : warnings.joined(separator: "\n\n")
    }

    var pendingEvent: CreateBusinessOutboundEvent?

    // MARK: - Init

    private let api: APIClient
    private let uploader: MultipartUploader
    private let logger = Logger(label: "app.pantopus.ios.CreateBusinessWizard")
    private var usernameCheckTask: Task<Void, Never>?

    init(api: APIClient = .shared, uploader: MultipartUploader = .shared) {
        self.api = api
        self.uploader = uploader
        addressSuggestions = AddressSuggestions(api: api)
    }

    // MARK: - WizardModel

    var chrome: WizardChrome {
        let label = WizardProgressLabel.stepOf(
            current: currentStep.stepNumber,
            total: CreateBusinessStep.totalSteps
        )
        let fraction = Double(currentStep.stepNumber) / Double(CreateBusinessStep.totalSteps)
        return WizardChrome(
            title: "Create business",
            progressLabel: label,
            progressFraction: fraction,
            leading: currentStep == .pickCategory ? .close : .back,
            primaryCTALabel: primaryLabel,
            primaryCTAEnabled: primaryEnabled,
            secondaryCTA: currentStep == .confirm
                ? WizardSecondaryCTA(
                    label: "Save as draft",
                    identifier: "createBusiness_saveDraft"
                )
                : nil,
            isSubmitting: isCreating,
            dirty: isDirty,
            showsProgressBar: true
        )
    }

    func leadingTapped() {
        switch currentStep {
        case .pickCategory:
            pendingEvent = .dismiss
        case .legalInfo:
            transition(to: .pickCategory)
        case .profile:
            transition(to: .legalInfo)
        case .confirm:
            transition(to: .profile)
        }
    }

    /// Every step change clears the banner — a create-full failure message
    /// must not leak onto the step the user just navigated to. Mirrors
    /// Android's `transitionTo`.
    private func transition(to step: CreateBusinessStep) {
        currentStep = step
        submitError = nil
    }

    func discardConfirmed() {
        pendingEvent = .dismiss
    }

    func primaryTapped() {
        switch currentStep {
        case .pickCategory:
            guard !isSearchActive, categoryName != nil else { return }
            transition(to: .legalInfo)
        case .legalInfo:
            guard validateBasicInfo() else { return }
            transition(to: .profile)
        case .profile:
            guard validateLocation() else { return }
            transition(to: .confirm)
        case .confirm:
            Task { await createBusiness(publish: true) }
        }
    }

    /// Confirm step's ghost CTA — creates the business but leaves it
    /// unpublished, matching RN's "Save as Draft"
    /// (`src/app/businesses/new.tsx:273-320`).
    func secondaryTapped() {
        guard currentStep == .confirm else { return }
        Task { await createBusiness(publish: false) }
    }

    // MARK: - Selection

    /// A tile on its own. Under "Something else" the owner then types what
    /// they do; any earlier typing is kept.
    func selectCategory(_ id: BusinessCategory) {
        selectedCategoryId = id
        selectedListing = nil
        submitError = nil
    }

    func selectSearchHit(_ hit: CategorySearchHit) {
        selectedCategoryId = hit.category
        selectedListing = hit.isTile ? nil : hit
        searchText = ""
        submitError = nil
    }

    /// "Add "…" as a custom category": the search text becomes the owner's
    /// own category under "Something else", where they can still edit it.
    func useSearchTextAsCustomCategory() {
        let typed = searchText.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        guard !typed.isEmpty else { return }
        Analytics.track(.ctaCreateBusinessCustomCategorySubmit(label: typed))
        selectedCategoryId = .other
        selectedListing = nil
        setCustomCategory(Self.customCategoryName(from: typed))
        searchText = ""
    }

    func setCustomCategory(_ value: String) {
        customCategory = String(value.prefix(CreateBusinessFieldLimits.maxCategory))
        submitError = nil
    }

    func acknowledgePendingEvent() {
        pendingEvent = nil
    }

    // MARK: - Field setters

    func setBusinessName(_ value: String) {
        businessName = String(value.prefix(CreateBusinessFieldLimits.maxName))
        submitError = nil
    }

    func setUsername(_ value: String) {
        let sanitized = value.lowercased().replacingOccurrences(
            of: "[^a-z0-9_]",
            with: "",
            options: .regularExpression
        )
        let cleaned = String(sanitized.prefix(CreateBusinessFieldLimits.maxUsername))
        username = cleaned
        submitError = nil
        scheduleUsernameCheck(cleaned)
    }

    func setEmail(_ value: String) {
        email = value
        submitError = nil
    }

    func setDescription(_ value: String) {
        descriptionText = String(value.prefix(CreateBusinessFieldLimits.maxDescription))
    }

    func setAddress(_ value: String) {
        address = value
        submitError = nil
        addressSuggestions.textChanged(value)
    }

    /// A picked address suggestion fills the address, city, state and ZIP.
    func chooseAddressSuggestion(_ suggestion: GeoSuggestion) async {
        guard let picked = await addressSuggestions.choose(suggestion) else { return }
        if let street = picked.address, !street.isEmpty { setAddress(street) }
        if let city = picked.city, !city.isEmpty { setCity(city) }
        if let state = picked.state, !state.isEmpty { setState(state) }
        if let zip = picked.zipcode, !zip.isEmpty { setZip(zip) }
    }

    func setCity(_ value: String) {
        city = value
        submitError = nil
    }

    func setState(_ value: String) {
        state = value
    }

    func setZip(_ value: String) {
        zip = value
    }

    func skipLocation() {
        locationSkipped = true
        hoursSkipped = true
        submitError = nil
    }

    func unskipLocation() {
        locationSkipped = false
        hoursSkipped = false
    }

    func skipHours() {
        hoursSkipped = true
    }

    func unskipHours() {
        hoursSkipped = false
    }

    // MARK: - Logo

    /// Stash a picked logo. It can only be uploaded once the business
    /// exists (the route is keyed by business id), so it rides along until
    /// create-full returns — same ordering as RN
    /// (`src/app/businesses/new.tsx:223-230`).
    func setLogoPick(_ pick: CreateBusinessLogoPick) {
        logoPick = pick
        logoSkipped = false
        logoUploadWarning = nil
    }

    func clearLogoPick() {
        logoPick = nil
    }

    func skipLogo() {
        logoSkipped = true
        logoPick = nil
    }

    func unskipLogo() {
        logoSkipped = false
    }

    func toggleDayClosed(_ dayOfWeek: Int) {
        guard let index = hours.firstIndex(where: { $0.dayOfWeek == dayOfWeek }) else { return }
        var day = hours[index]
        day.isClosed.toggle()
        if !day.isClosed {
            if day.openTime.isEmpty { day.openTime = "09:00" }
            if day.closeTime.isEmpty { day.closeTime = "17:00" }
        }
        hours[index] = day
    }

    // MARK: - Derived state

    var isSearchActive: Bool {
        !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var searchHits: [CategorySearchHit] {
        CreateBusinessCategoryCatalog.search(searchText)
    }

    /// The search's "Add "…" as a custom category" row, offered unless a
    /// result already has exactly that name.
    var offersCustomCategory: Bool {
        let query = CreateBusinessCategoryCatalog.normalize(searchText)
        guard !query.isEmpty else { return false }
        return !searchHits.contains { CreateBusinessCategoryCatalog.normalize($0.name) == query }
    }

    /// The one category create-full will save, or nil while "Something
    /// else" is picked and nothing has been typed yet.
    var categoryName: String? {
        guard let selected = selectedCategoryId else { return nil }
        if let listing = selectedListing { return listing.name }
        if let name = selected.savedCategoryName { return name }
        let typed = customCategory.trimmingCharacters(in: .whitespacesAndNewlines)
        return typed.isEmpty ? nil : typed
    }

    /// "Something else" on its own asks the owner to type what they do.
    var asksForCustomCategory: Bool {
        selectedCategoryId == .other && selectedListing == nil
    }

    /// Under the picked tile, the more specific choice in place of its
    /// usual subline ("Plumbing", or what was typed under "Something else").
    func pickedDetail(for category: BusinessCategory) -> String? {
        guard category == selectedCategoryId else { return nil }
        if let listing = selectedListing { return listing.name }
        guard category == .other else { return nil }
        let typed = customCategory.trimmingCharacters(in: .whitespacesAndNewlines)
        return typed.isEmpty ? nil : typed
    }

    func isPicked(_ hit: CategorySearchHit) -> Bool {
        if hit.isTile {
            return selectedListing == nil && selectedCategoryId == hit.category
        }
        return selectedListing?.id == hit.id
    }

    var whatYouGetItems: [WhatYouGetItem] {
        guard let selected = selectedCategoryId, selected == .home else { return [] }
        return CreateBusinessSampleData.homeServicesWhatYouGet
    }

    var hasLocation: Bool {
        !locationSkipped
            && !address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !city.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var isBasicInfoValid: Bool {
        let nameOk = !businessName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let emailOk = AuthValidation.email(email) == nil
        let usernameOk = cleanedUsername.count >= 3 && usernameStatus != .checking
        let availableOk: Bool = {
            if case .unavailable = usernameStatus { return false }
            return true
        }()
        return nameOk && emailOk && usernameOk && availableOk
    }

    var cleanedUsername: String {
        username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    // MARK: - Private

    private var primaryLabel: String {
        switch currentStep {
        case .pickCategory: "Continue"
        case .legalInfo: "Next"
        case .profile:
            locationSkipped ? "Skip" : "Next"
        // RN's review step publishes ("Publish"), with Save as Draft as the
        // ghost — native previously created an unpublished business and
        // called it "Confirm", so nothing ever went live.
        case .confirm: "Publish"
        }
    }

    private var primaryEnabled: Bool {
        switch currentStep {
        // While searching, a result or the custom row is picked first, so
        // Continue never carries on with a tile the owner has moved past.
        case .pickCategory:
            !isSearchActive && categoryName != nil
        case .legalInfo:
            isBasicInfoValid && !isCreating
        case .profile:
            !isCreating
        case .confirm:
            isBasicInfoValid && !isCreating
        }
    }

    private var isDirty: Bool {
        if currentStep == .pickCategory, selectedCategoryId == .home, selectedListing == nil,
           customCategory.isEmpty, !isSearchActive,
           businessName.isEmpty, username.isEmpty, email.isEmpty {
            return false
        }
        return true
    }

    private func scheduleUsernameCheck(_ username: String) {
        usernameCheckTask?.cancel()
        guard username.count >= 3 else {
            usernameStatus = .idle
            return
        }
        usernameStatus = .checking
        usernameCheckTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            await self?.performUsernameCheck(username)
        }
    }

    private func performUsernameCheck(_ username: String) async {
        do {
            let result: UsernameAvailabilityDTO = try await api.request(
                BusinessesEndpoints.checkUsername(username: username)
            )
            guard cleanedUsername == username else { return }
            if result.available {
                usernameStatus = .available
            } else {
                usernameStatus = .unavailable(reason: result.reason)
            }
        } catch {
            guard cleanedUsername == username else { return }
            usernameStatus = .idle
        }
    }

    @discardableResult
    private func validateBasicInfo() -> Bool {
        if businessName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            submitError = "Name, username, and email are required."
            return false
        }
        if cleanedUsername.count < 3 {
            submitError = "Username must be at least 3 characters."
            return false
        }
        if case let .unavailable(reason) = usernameStatus {
            submitError = usernameUnavailableMessage(reason)
            return false
        }
        if AuthValidation.email(email) != nil {
            submitError = "Name, username, and email are required."
            return false
        }
        submitError = nil
        return true
    }

    @discardableResult
    private func validateLocation() -> Bool {
        if locationSkipped {
            submitError = nil
            return true
        }
        let trimmedAddress = address.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCity = city.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasLocationInput = [address, city, state, zip].contains {
            !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        if hasLocationInput && trimmedAddress.isEmpty {
            submitError = "Address is required when adding a location. Complete the address and city, or skip location."
            return false
        }
        if !trimmedAddress.isEmpty && trimmedCity.isEmpty {
            submitError = "City is required when adding an address."
            return false
        }
        submitError = nil
        return true
    }

    private func createBusiness(publish: Bool) async {
        guard !isCreating else { return }
        guard validateBasicInfo() else { return }
        guard let category = selectedCategoryId, let categoryName else {
            submitError = "Pick a category before creating your business."
            return
        }

        isCreating = true
        submitError = nil
        logoUploadWarning = nil
        publishWarning = nil

        let locationPayload: CreateBusinessLocationPayload? = hasLocation
            ? CreateBusinessLocationPayload(
                address: address.trimmingCharacters(in: .whitespacesAndNewlines),
                city: city.trimmingCharacters(in: .whitespacesAndNewlines),
                state: state.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                zipcode: zip.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                country: "US"
            )
            : nil

        let hoursPayload: [CreateBusinessHoursPayload]? = {
            guard hasLocation, !hoursSkipped else { return nil }
            return hours.map { day in
                CreateBusinessHoursPayload(
                    dayOfWeek: day.dayOfWeek,
                    openTime: day.isClosed ? nil : day.openTime.nilIfEmpty,
                    closeTime: day.isClosed ? nil : day.closeTime.nilIfEmpty,
                    isClosed: day.isClosed
                )
            }
        }()

        let body = CreateBusinessFullRequest(
            name: businessName.trimmingCharacters(in: .whitespacesAndNewlines),
            username: cleanedUsername,
            email: email.trimmingCharacters(in: .whitespacesAndNewlines),
            businessType: category.entityType,
            categories: [categoryName],
            description: descriptionText.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            location: locationPayload,
            hours: hoursPayload
        )

        do {
            let response: CreateBusinessFullResponse = try await api.request(
                BusinessesEndpoints.createBusinessFull(body)
            )
            let businessId = response.business.id
            await uploadLogoIfNeeded(businessId: businessId)
            if publish {
                await publishCreatedBusiness(businessId: businessId)
            }
            pendingEvent = .openBusinessDashboard(businessId: businessId)
        } catch {
            submitError = Self.createErrorMessage(from: error)
            logger.error("create-full failed", metadata: [
                "error": .string(String(describing: error))
            ])
        }
        isCreating = false
    }

    /// Push the picked logo once the business id exists. RN treats a failed
    /// logo upload as non-critical (the business is already created), so we
    /// keep the navigation and surface a warning instead of an error.
    private func uploadLogoIfNeeded(businessId: String) async {
        guard !logoSkipped, let pick = logoPick else { return }
        do {
            _ = try await uploader.uploadBusinessMedia(
                businessId: businessId,
                kind: .logo,
                file: MultipartFile(
                    fieldName: "file",
                    filename: pick.fileName,
                    mimeType: pick.mimeType,
                    data: pick.data
                )
            )
            logoPick = nil
        } catch {
            logoUploadWarning = "Your business was created, but the logo didn't upload. Add it from the dashboard."
            logger.error("business logo upload failed", metadata: [
                "error": .string(String(describing: error))
            ])
        }
    }

    /// Creation has already succeeded, so a publish failure must not prompt
    /// another create. A timeout may happen after publication committed.
    private func publishCreatedBusiness(businessId: String) async {
        do {
            _ = try await api.request(
                BusinessesEndpoints.publishBusiness(businessId: businessId),
                as: BusinessMutationMessageResponse.self
            )
        } catch {
            publishWarning = "Your business was created, but publishing couldn't be confirmed. "
                + "Check its status from the dashboard and try publishing again if it's still a draft."
            logger.error("publish after create failed", metadata: [
                "error": .string(String(describing: error))
            ])
        }
    }

    /// Search is typed in lowercase, so "web design" is saved as "Web design";
    /// anything with its own capitals ("iPhone repair", "DJ") stays as typed.
    static func customCategoryName(from text: String) -> String {
        guard text == text.lowercased(), let first = text.first else { return text }
        return first.uppercased() + text.dropFirst()
    }

    private func usernameUnavailableMessage(_ reason: String?) -> String {
        switch reason {
        case "reserved":
            "This username is reserved. Please choose a different one."
        case "taken":
            "This username is already taken."
        default:
            "Please choose a valid username."
        }
    }

    private static func createErrorMessage(from error: Error) -> String {
        guard let apiError = error as? APIError else {
            return "Failed to create business"
        }
        if case let .clientError(_, message) = apiError,
           let code = extractCode(from: message) {
            switch code {
            case "EMAIL_IS_PERSONAL":
                return "This email is already used by your personal account. Try using a business-specific email."
            case "USERNAME_RESERVED":
                return "This username is reserved. Please choose a different one."
            case "USERNAME_TAKEN":
                return "This username is already taken. Please go back and choose a different one."
            case "RATE_LIMITED":
                return "You've created too many businesses recently. Please try again tomorrow."
            default:
                break
            }
        }
        return apiError.errorDescription ?? "Failed to create business"
    }

    private static func extractCode(from raw: String?) -> String? {
        guard let raw, let data = raw.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return json["code"] as? String
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
