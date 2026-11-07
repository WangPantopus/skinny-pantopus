//
//  EditBusinessPageViewModel.swift
//  Pantopus
//
//  P4.2 / WS2.3 — A13.10 Edit Business Page. Profile-form editor wired to
//  business APIs (not the RN block CMS). Loads `GET /:businessId`, saves
//  via `PATCH /:businessId` (+ hours / location when dirty), publishes via
//  `POST /:businessId/publish`.
//

// swiftlint:disable file_length type_body_length

import Foundation

/// Editable field keys for the A13.10 profile form. The address is split
/// into its backend columns — `address` is the street line only.
public enum EditBusinessPageFieldKey: String, Sendable {
    case name, tagline, category, price, description
    case phone, email, website, bookingLink
    case address, city, state, zip
}

/// Shown when the only pending edits are media the editor can't upload yet.
private let mediaOnlyMessage = "Photo upload isn't available yet."
/// Address edits need a `BusinessLocation` row to PATCH. The editor can't
/// create one (creation runs the address decision engine), so the edit is
/// refused loudly instead of being dropped behind a "Saved" toast.
private let noLocationMessage =
    "This business has no location yet — add one before editing the address."
/// `GET /api/businesses/:businessId` answers for any signed-in viewer, so a
/// deep link (`pantopus://businesses/:id/page-editor`) would otherwise open a
/// fully functional editor for someone with no write access.
private let noAccessMessage = "You don't have access to edit this business."
private let countryCodePrefix = "+1"

/// Save aborted with a message the user should see verbatim.
private struct SaveFailure: Error {
    let message: String
}

/// A close the server refused or couldn't run. The sheet stays open with it.
public struct CloseBusinessFailure: Equatable, Sendable {
    public let message: String
    /// A 503 or a lost connection: the same request can work on a retry.
    public let canRetry: Bool
}

/// Why a save can't be attempted. `.address` also paints the field inline.
private enum SaveBlock {
    case toast(String)
    case address(String)

    var message: String {
        switch self {
        case let .toast(message), let .address(message): message
        }
    }
}

@Observable
@MainActor
public final class EditBusinessPageViewModel {
    public private(set) var state: EditBusinessPageState
    public var toastMessage: String?
    public var mediaUploadError: String?
    public var showsDiscardConfirm = false
    public var showsCatalog = false
    public private(set) var canManageCatalog = false
    public private(set) var canEditProfile = false
    public private(set) var canEditLocation = false
    public private(set) var canEditHours = false
    public private(set) var accessError: String?
    public private(set) var isCheckingAccess = false
    public private(set) var isLoadingHours = false
    public private(set) var isLoadingServices = false
    public private(set) var hoursError: String?
    public private(set) var servicesError: String?
    public private(set) var hasLoadedHours = false
    public private(set) var hasLoadedServices = false
    private var hoursGeneration = 0
    private var servicesGeneration = 0
    private var originalHours: EditBusinessPageHoursState?
    private var isCheckingCatalog = false
    private var accessGeneration = 0
    private var loadGeneration = 0
    /// The banner or logo upload in flight, if any.
    public private(set) var uploadingMedia: BusinessMediaKind?
    /// Only an owner can close the business; `DELETE /:businessId` refuses
    /// everyone else.
    public private(set) var canClose = false
    public private(set) var showsCloseConfirm = false
    public private(set) var isClosing = false
    public private(set) var closeFailure: CloseBusinessFailure?
    /// Set once the server closed the business; the host leaves the editor.
    public private(set) var didClose = false

    private let businessId: String
    private let api: APIClient
    private let uploader: MultipartUploader
    private let localPreviewPersistenceEnabled: Bool
    private let sessionScope: HomeClaimSessionScope

    /// Primary location id for hours / address PATCH.
    private var primaryLocationId: String?
    /// Full jsonb objects as the server last returned them — the PATCH
    /// route replaces `social_links` / `attributes` wholesale, so an edit
    /// has to be merged into these before it goes back up.
    private var loadedSocialLinks: [String: String] = [:]
    private var loadedAttributes: [String: JSONValue] = [:]
    /// Whether the stored phone carried a `+1` the loader stripped.
    private var loadedPhoneHadCountryCode = false
    private var isSaving = false
    private var isPublishing = false
    private var hasLoadedOnce = false

    public var hasUnsavedChanges: Bool {
        guard case let .loaded(content) = state else { return false }
        return EditBusinessPageMapper.unsavedCount(in: content) > 0
    }

    /// Without a location there is nothing to read until one is added.
    public var canRetryHours: Bool {
        primaryLocationId != nil
    }

    public var hasInFlightOperation: Bool {
        isSaving || isPublishing || uploadingMedia != nil || isClosing
    }

    init(
        businessId: String,
        preview: EditBusinessPageContent? = nil,
        api: APIClient = .shared,
        uploader: MultipartUploader = .shared
    ) {
        self.businessId = businessId
        self.api = api
        self.uploader = uploader
        sessionScope = HomeClaimSessionScope(api: api)
        localPreviewPersistenceEnabled = preview != nil
        if let preview {
            state = .loaded(preview)
            hasLoadedOnce = true
            canEditProfile = true
            canEditLocation = true
            canEditHours = true
            hasLoadedHours = true
            hasLoadedServices = true
            originalHours = preview.hours.cleaned
        } else {
            state = .loading
        }
    }

    // MARK: - Load

    public func load() async {
        if localPreviewPersistenceEnabled { return }
        if hasLoadedOnce, case .loaded = state {
            await refreshAccess()
            return
        }
        await fetch(showLoading: true)
    }

    public func refresh() async {
        if localPreviewPersistenceEnabled { return }
        await fetch(showLoading: true)
    }

    private func fetch(showLoading: Bool) async {
        if await fetchProfile(showLoading: showLoading) { await loadSections() }
    }

    /// Detail and current authority only. Returns whether the profile loaded.
    private func fetchProfile(showLoading: Bool) async -> Bool {
        loadGeneration &+= 1
        let generation = loadGeneration
        if showLoading { state = .loading }
        do {
            async let access = confirmAccess()
            let detail: BusinessDetailResponse = try await api.request(
                BusinessesEndpoints.business(businessId: businessId)
            )
            _ = try await access
            guard isCurrentLoad(generation) else { return false }
            let location = detail.profile?.primaryLocation
                ?? detail.locations.first { $0.isPrimary == true }
                ?? detail.locations.first
            primaryLocationId = location?.id
            loadedSocialLinks = EditBusinessPageMapper.stringMap(detail.profile?.socialLinks)
            loadedAttributes = detail.profile?.attributes ?? [:]
            loadedPhoneHadCountryCode = (detail.profile?.publicPhone ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .hasPrefix(countryCodePrefix)

            // Profile fields can be used as soon as detail and authority are
            // ready. Optional sections load independently and merge only their
            // own values, so a slow catalog cannot hold up typing a name.
            hasLoadedHours = false
            hasLoadedServices = false
            originalHours = nil
            state = .loaded(
                EditBusinessPageMapper.content(
                    from: detail,
                    hours: [],
                    catalog: []
                )
            )
            hasLoadedOnce = true
            return true
        } catch {
            guard isCurrentLoad(generation) else { return false }
            if isNotFound(error) {
                state = .empty
            } else {
                state = .error(
                    message: (error as? SaveFailure)?.message
                        ?? (error as? APIError)?.errorDescription ?? "Couldn't load editor."
                )
            }
            hasLoadedOnce = false
            return false
        }
    }

    private func isCurrentLoad(_ generation: Int) -> Bool {
        generation == loadGeneration && sessionScope.isCurrent && !Task.isCancelled
    }

    private func loadSections() async {
        async let hours: Void = refreshUneditedHours()
        async let services: Void = refreshServices()
        _ = await (hours, services)
    }

    private func refreshUneditedHours() async {
        guard case let .loaded(content) = state,
              EditBusinessPageMapper.hoursPayload(from: content.hours) == nil else { return }
        await refreshHours()
    }

    // MARK: - Current edit authority

    public func suspend() {
        guard !localPreviewPersistenceEnabled else { return }
        loadGeneration &+= 1
        accessGeneration &+= 1
        hoursGeneration &+= 1
        servicesGeneration &+= 1
        clearAccess()
        isCheckingAccess = false
        isLoadingHours = false
        isLoadingServices = false
    }

    public func refreshAccess() async {
        guard !localPreviewPersistenceEnabled else { return }
        _ = try? await confirmAccess()
        // A read interrupted while access was unavailable still has to finish.
        if canEditProfile { await loadSections() }
    }

    private func clearAccess() {
        canEditProfile = false
        canEditLocation = false
        canEditHours = false
        canManageCatalog = false
        canClose = false
    }

    @discardableResult
    private func confirmAccess() async throws -> BusinessTeamAccessDTO {
        accessGeneration &+= 1
        let generation = accessGeneration
        clearAccess()
        // A toast queued behind the notice is out of date once the notice goes.
        if accessError != nil { toastMessage = nil }
        accessError = nil
        isCheckingAccess = true
        defer { if generation == accessGeneration { isCheckingAccess = false } }
        do {
            try requireSession()
            let access: BusinessTeamAccessDTO = try await api.request(
                BusinessTeamEndpoints.access(businessId: businessId)
            )
            guard generation == accessGeneration, !Task.isCancelled else { throw CancellationError() }
            try requireSession()
            let permissions = access.hasAccess ? Set(access.permissions) : []
            canEditProfile = permissions.contains("profile.edit")
            canEditLocation = permissions.contains("locations.edit")
            canEditHours = permissions.contains("hours.edit")
            canManageCatalog = permissions.contains("catalog.edit")
            canClose = access.hasAccess && access.isOwner == true
            guard canEditProfile else { throw SaveFailure(message: noAccessMessage) }
            return access
        } catch {
            if generation == accessGeneration {
                accessError = (error as? SaveFailure)?.message
                    ?? "Couldn't check edit access. Your changes are kept. Retry to continue."
            }
            throw error
        }
    }

    private func requireSession() throws {
        guard sessionScope.isCurrent else {
            throw SaveFailure(message: "Your session changed. Reopen the business to continue.")
        }
    }

    // MARK: - Services

    /// Reuse the catalog manager without navigating away from unsaved profile fields.
    public func openCatalog() async {
        guard !isCheckingCatalog, !hasInFlightOperation else { return }
        isCheckingCatalog = true
        defer { isCheckingCatalog = false }
        do {
            try await confirmAccess()
            guard canManageCatalog else {
                toastMessage = "You don't have permission to manage this catalog."
                return
            }
            showsCatalog = true
        } catch {
            toastMessage = "Couldn't check catalog access. Please try again."
        }
    }

    public func refreshServices() async {
        guard canEditProfile else { return }
        servicesGeneration &+= 1
        let generation = servicesGeneration
        let load = loadGeneration
        isLoadingServices = true
        servicesError = nil
        defer { if generation == servicesGeneration { isLoadingServices = false } }
        do {
            let response: BusinessCatalogItemsResponse = try await api.request(
                BusinessesEndpoints.catalogItems(businessId: businessId, status: "active")
            )
            guard generation == servicesGeneration, isCurrentLoad(load),
                  case let .loaded(content) = state else { return }
            hasLoadedServices = true
            state = .loaded(EditBusinessPageMapper.withRecomputedMode(
                EditBusinessPageMapper.copy(content, services: EditBusinessPageMapper.mapServices(response.items))
            ))
        } catch {
            guard generation == servicesGeneration, isCurrentLoad(load) else { return }
            servicesError = "Couldn't load services. Your other edits are kept."
        }
    }

    // MARK: - Hours

    public func refreshHours() async {
        guard canEditProfile else { return }
        guard let locationId = primaryLocationId else {
            hoursError = "Add a business location before setting hours."
            return
        }
        hoursGeneration &+= 1
        let generation = hoursGeneration
        let load = loadGeneration
        isLoadingHours = true
        hoursError = nil
        defer { if generation == hoursGeneration { isLoadingHours = false } }
        do {
            let response: BusinessLocationHoursResponse = try await api.request(
                BusinessesEndpoints.locationHours(businessId: businessId, locationId: locationId)
            )
            guard generation == hoursGeneration, isCurrentLoad(load),
                  case let .loaded(content) = state,
                  EditBusinessPageMapper.hoursPayload(from: content.hours) == nil else { return }
            let hours = EditBusinessPageMapper.mapHours(response.hours)
            originalHours = hours
            hasLoadedHours = true
            state = .loaded(EditBusinessPageMapper.withRecomputedMode(
                EditBusinessPageMapper.copy(content, hours: hours)
            ))
        } catch {
            guard generation == hoursGeneration, isCurrentLoad(load) else { return }
            hoursError = "Couldn't load hours. Retry before editing the week."
        }
    }

    public func updateHours(dayId: String, to value: EditBusinessPageHoursRow.State) {
        guard canEditProfile, canEditHours, hasLoadedHours, !hasInFlightOperation,
              case let .loaded(content) = state,
              let selected = content.hours.rows.first(where: { $0.id == dayId }) else { return }
        let replacesDay = value == .closed || value == .allDay
        let removesIntervals = replacesDay && content.hours.rows.filter { $0.dayLabel == selected.dayLabel }.count > 1
        let hasRemovedIntervals = content.hours.rows.filter { $0.dayLabel == selected.dayLabel }.count
            != originalHours?.rows.filter { $0.dayLabel == selected.dayLabel }.count
        let rows = content.hours.rows.compactMap { row -> EditBusinessPageHoursRow? in
            if removesIntervals, row.dayLabel == selected.dayLabel, row.id != dayId { return nil }
            guard row.id == dayId else { return row }
            let original = originalHours?.rows.first { $0.id == dayId }
            let isDirty = value != original?.state || removesIntervals || hasRemovedIntervals
            return EditBusinessPageHoursRow(
                id: row.id,
                dayLabel: row.dayLabel,
                state: value,
                isDirty: isDirty,
                notes: row.notes,
                source: isDirty ? nil : original?.source
            )
        }
        state = .loaded(EditBusinessPageMapper.withRecomputedMode(
            EditBusinessPageMapper.copy(content, hours: .rows(rows: rows, footerHint: nil))
        ))
    }

    public func applyWeekdayHours() {
        guard case let .loaded(content) = state else { return }
        for row in content.hours.rows {
            updateHours(
                dayId: row.id,
                to: ["Sun", "Sat"].contains(row.dayLabel)
                    ? .closed : .open(openLabel: "9:00 AM", closeLabel: "5:00 PM")
            )
        }
    }

    // MARK: - Banner and logo

    /// Uploads a picked banner or logo with
    /// `POST /api/upload/business-media/:businessId?type=banner|logo`. The
    /// route stores it at once, so the editor shows the returned image and
    /// doesn't count it as an unsaved edit.
    public func uploadMedia(_ kind: BusinessMediaKind, data: Data, mimeType: String) async {
        guard uploadingMedia == nil, case .loaded = state else { return }
        mediaUploadError = nil
        uploadingMedia = kind
        defer { uploadingMedia = nil }
        let ext = mimeType == "image/png" ? "png" : "jpg"
        do {
            try await confirmAccess()
            let response = try await uploader.uploadBusinessMedia(
                businessId: businessId,
                kind: kind,
                file: MultipartFile(
                    fieldName: "file",
                    // Randomised name, as in the create wizard: the picker's
                    // `IMG_xxxx` never reaches storage or access logs.
                    filename: "business-\(kind.rawValue)-\(UUID().uuidString.prefix(8)).\(ext)",
                    mimeType: mimeType,
                    data: data
                )
            )
            guard sessionScope.isCurrent, case let .loaded(content) = state else { return }
            let updated = switch kind {
            case .banner:
                EditBusinessPageMapper.copy(
                    content,
                    banner: .filled(dirty: false, palette: .cafeGoldenHour, imageURL: response.url)
                )
            case .logo:
                EditBusinessPageMapper.copy(
                    content,
                    logo: .filled(
                        initial: String(content.name.original.prefix(1)).uppercased(),
                        palette: .sunrise,
                        imageURL: response.url
                    )
                )
            }
            state = .loaded(EditBusinessPageMapper.withRecomputedMode(updated))
            toastMessage = kind == .banner ? "Banner updated." : "Logo updated."
        } catch {
            let reason = (error as? APIError)?.errorDescription ?? "Please try again."
            mediaUploadError = "Couldn't upload the \(kind.rawValue). \(reason)"
        }
    }

    // MARK: - Field setters

    public func update(_ key: EditBusinessPageFieldKey, to value: String) {
        guard case let .loaded(content) = state, canEdit(key) else { return }
        var next = content
        switch key {
        case .name:
            next = EditBusinessPageMapper.copy(content, name: content.name.updating(current: value))
        case .tagline:
            next = EditBusinessPageMapper.copy(content, tagline: content.tagline.updating(current: value))
        case .category:
            next = EditBusinessPageMapper.copy(content, category: content.category.updating(current: value))
        case .price:
            next = EditBusinessPageMapper.copy(content, price: content.price.updating(current: value))
        case .description:
            if case let .field(field, limit) = content.description {
                next = EditBusinessPageMapper.copy(
                    content,
                    description: .field(
                        field.updating(current: String(value.prefix(limit))),
                        charLimit: limit
                    )
                )
            }
        case .phone:
            next = EditBusinessPageMapper.copy(content, phone: content.phone.updating(current: value))
        case .email:
            next = EditBusinessPageMapper.copy(content, email: content.email.updating(current: value))
        case .website:
            next = EditBusinessPageMapper.copy(content, website: content.website.updating(current: value))
        case .bookingLink:
            let field = content.bookingLink ?? EditBusinessPageField(original: "", current: "")
            next = EditBusinessPageMapper.copy(
                content,
                bookingLink: field.updating(current: value),
                replaceBookingLink: true
            )
        case .address, .city, .state, .zip:
            next = EditBusinessPageMapper.copy(
                content,
                location: updatedLocation(content.location, key: key, value: value)
            )
        }
        state = .loaded(EditBusinessPageMapper.withRecomputedMode(next))
    }

    private func canEdit(_ key: EditBusinessPageFieldKey) -> Bool {
        canEditProfile && (![.address, .city, .state, .zip].contains(key) || canEditLocation)
    }

    /// Applies an address-component edit while leaving the other
    /// components untouched — the street line never absorbs the locality.
    private func updatedLocation(
        _ location: EditBusinessPageLocation,
        key: EditBusinessPageFieldKey,
        value: String
    ) -> EditBusinessPageLocation {
        EditBusinessPageLocation(
            address: key == .address ? location.address.updating(current: value) : location.address,
            city: key == .city ? location.city.updating(current: value) : location.city,
            state: key == .state ? location.state.updating(current: value) : location.state,
            zip: key == .zip ? location.zip.updating(current: value) : location.zip,
            error: nil,
            mapVerified: location.mapVerified,
            pinDirty: location.pinDirty,
            hideExactAddress: location.hideExactAddress
        )
    }

    /// Setup-mode description prompt CTA — opens an empty About field.
    public func beginDescriptionEditing() {
        guard canEditProfile else { return }
        guard case let .loaded(content) = state else { return }
        guard case .prompt = content.description else { return }
        let next = EditBusinessPageMapper.copy(
            content,
            description: .field(
                EditBusinessPageField(original: "", current: ""),
                charLimit: 600
            )
        )
        state = .loaded(EditBusinessPageMapper.withRecomputedMode(next))
    }

    // MARK: - Save / publish

    public func save() async {
        await persist(successToast: "Saved")
    }

    public func saveDraft() async {
        await persist(successToast: "Draft saved")
    }

    public func publish() async {
        guard !isPublishing, case let .loaded(content) = state else { return }
        isPublishing = true
        defer { isPublishing = false }
        if localPreviewPersistenceEnabled {
            toastMessage = "Published"
            return
        }
        if content.publishRequirementsRemaining > 0 {
            toastMessage = "Add a business name and category before publishing."
            return
        }
        let saved = await persist(successToast: nil)
        guard saved else { return }
        do {
            try await confirmAccess()
            _ = try await api.request(BusinessesEndpoints.publishBusiness(businessId: businessId))
            try requireSession()
            toastMessage = "Published"
            let refreshed = await fetchProfile(showLoading: false)
            isPublishing = false
            if refreshed { await loadSections() }
        } catch {
            toastMessage = (error as? APIError)?.errorDescription ?? "Couldn't publish."
        }
    }

    public func discardRequested() {
        showsDiscardConfirm = true
    }

    public func discardConfirmed() async {
        guard case let .loaded(content) = state else { return }
        let reverted = revertToOriginal(content)
        state = .loaded(EditBusinessPageMapper.withRecomputedMode(reverted))
        showsDiscardConfirm = false
        toastMessage = "Edits discarded"
    }

    // MARK: - Close business

    public func closeRequested() {
        guard canClose, case .loaded = state else { return }
        closeFailure = nil
        showsCloseConfirm = true
    }

    public func closeCancelled() {
        guard !isClosing else { return }
        showsCloseConfirm = false
        closeFailure = nil
    }

    /// `DELETE /api/businesses/:businessId`. A failure keeps the sheet and
    /// the typed word, with the server's sentence.
    public func closeBusiness() async {
        // `canClose` clears during a recheck; the sheet's Retry has to survive a failed one.
        guard showsCloseConfirm, !isClosing, case .loaded = state else { return }
        if isSaving || uploadingMedia != nil {
            closeFailure = CloseBusinessFailure(
                message: "Wait for the current save or upload to finish, then try again.",
                canRetry: false
            )
            return
        }
        isClosing = true
        closeFailure = nil
        defer { isClosing = false }
        do {
            let access = try await confirmAccess()
            guard access.isOwner == true else { throw SaveFailure(message: "Only an owner can close this business.") }
            _ = try await api.request(BusinessesEndpoints.closeBusiness(businessId: businessId))
            try requireSession()
        } catch {
            if await wasAlreadyClosed(after: error) {
                finishClosing()
            } else {
                closeFailure = Self.closeFailure(for: error)
            }
            return
        }
        finishClosing()
    }

    /// The client retries a DELETE, so when an earlier attempt closed the
    /// business and its reply was lost, the retry is refused. A business the
    /// server no longer finds is closed.
    private func wasAlreadyClosed(after error: any Error) async -> Bool {
        guard case .forbidden = error as? APIError else { return false }
        do {
            try await api.request(BusinessesEndpoints.business(businessId: businessId))
            return false
        } catch {
            return isNotFound(error)
        }
    }

    private func finishClosing() {
        // My businesses and the You screen's business card are kept on the
        // phone; neither may keep showing the closed business.
        let store = ScreenStore.store(for: api)
        store.remove(BusinessesEndpoints.myBusinesses())
        store.markStale(topics: [ScreenTopic.profileMe])
        NotificationCenter.default.post(name: .businessClosed, object: businessId)
        showsCloseConfirm = false
        didClose = true
    }

    private static func closeFailure(for error: any Error) -> CloseBusinessFailure {
        let fallback = "Couldn't close the business. Please try again."
        if let failure = error as? SaveFailure {
            return CloseBusinessFailure(message: failure.message, canRetry: false)
        }
        guard let apiError = error as? APIError else {
            return CloseBusinessFailure(message: fallback, canRetry: true)
        }
        switch apiError {
        case let .server(_, body):
            // The 503 says what happened; shown under the same readable-sentence
            // rule as a 403 body, so an HTML error page never reaches the sheet.
            let message = APIError.readableForbiddenMessage(Data(body.utf8)) ?? fallback
            return CloseBusinessFailure(message: message, canRetry: true)
        case .transport, .retriesExhausted:
            return CloseBusinessFailure(message: apiError.errorDescription ?? fallback, canRetry: true)
        default:
            return CloseBusinessFailure(message: apiError.errorDescription ?? fallback, canRetry: false)
        }
    }

    // MARK: - Persist

    @discardableResult
    private func persist(successToast: String?) async -> Bool {
        guard case let .loaded(content) = state else { return false }
        if localPreviewPersistenceEnabled {
            return persistLocally(content, successToast: successToast)
        }
        if let block = saveBlock(for: content) {
            apply(block, to: content)
            return false
        }
        // Single-flight: a second tap while a save is in flight is a no-op.
        guard !isSaving else { return false }
        return await runSave(content, successToast: successToast)
    }

    private func persistLocally(
        _ content: EditBusinessPageContent,
        successToast: String?
    ) -> Bool {
        originalHours = content.hours.cleaned
        state = .loaded(promoteCurrentToOriginal(content))
        if let successToast { toastMessage = successToast }
        return true
    }

    /// Reason the save can't be attempted, or nil when it can.
    private func saveBlock(for content: EditBusinessPageContent) -> SaveBlock? {
        let mediaOnly = hasUnresolvedMediaDirty(content)
            && EditBusinessPageMapper.unsavedCount(in: content) == mediaDirtyCount(content)
        if mediaOnly { return .toast(mediaOnlyMessage) }
        if let message = EditBusinessPageMapper.locationValidationError(content.location) {
            return .address(message)
        }
        if content.location.hasAddressEdits, primaryLocationId == nil {
            return .address(noLocationMessage)
        }
        if !NetworkMonitor.shared.isOnline {
            return .toast("You're offline. Try again when you're back online.")
        }
        return nil
    }

    private func apply(_ block: SaveBlock, to content: EditBusinessPageContent) {
        if case let .address(message) = block {
            state = .loaded(
                EditBusinessPageMapper.copy(content, location: content.location.withError(message))
            )
        }
        toastMessage = block.message
    }

    private func runSave(
        _ content: EditBusinessPageContent,
        successToast: String?
    ) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            try await confirmAccess()
            if content.location.hasAddressEdits, !canEditLocation {
                throw SaveFailure(message: "You don't have permission to edit this business's location. Your changes are kept.")
            }
            if EditBusinessPageMapper.hoursPayload(from: content.hours) != nil, !canEditHours {
                throw SaveFailure(message: "You don't have permission to edit business hours. Your changes are kept.")
            }
            try await pushProfile(content)
            try await pushLocation(content)
            try await pushHours(content)
            try requireSession()
            var saved = savedContent(content)
            if case let .loaded(current) = state {
                saved = EditBusinessPageMapper.copy(
                    saved,
                    hours: EditBusinessPageMapper.hoursPayload(from: content.hours) == nil ? current.hours : saved.hours,
                    services: current.services
                )
            }
            if hasLoadedHours { originalHours = saved.hours.cleaned }
            state = .loaded(EditBusinessPageMapper.withRecomputedMode(saved))
            if let successToast { toastMessage = successToast }
            return true
        } catch let failure as SaveFailure {
            accessError = failure.message
            toastMessage = nil
            return false
        } catch {
            toastMessage = (error as? APIError)?.errorDescription ?? "Couldn't save changes."
            return false
        }
    }

    private func pushProfile(_ content: EditBusinessPageContent) async throws {
        let patch = buildPatch(from: content)
        guard patchHasValues(patch) else { return }
        try requireSession()
        _ = try await api.request(
            BusinessesEndpoints.updateBusiness(businessId: businessId, body: patch)
        )
        rememberSavedPatch(patch)
    }

    private func pushLocation(_ content: EditBusinessPageContent) async throws {
        guard content.location.hasAddressEdits else { return }
        guard let locationId = primaryLocationId else {
            throw SaveFailure(message: noLocationMessage)
        }
        try requireSession()
        _ = try await api.request(
            BusinessesEndpoints.updateLocation(
                businessId: businessId,
                locationId: locationId,
                body: EditBusinessPageMapper.locationPayload(from: content.location)
            )
        )
    }

    private func pushHours(_ content: EditBusinessPageContent) async throws {
        // `hoursPayload` is nil unless a row is dirty — same gate as Android.
        guard let hoursBody = EditBusinessPageMapper.hoursPayload(from: content.hours),
              let locationId = primaryLocationId else {
            return
        }
        try requireSession()
        _ = try await api.request(
            BusinessesEndpoints.setLocationHours(
                businessId: businessId,
                locationId: locationId,
                body: SetBusinessHoursRequest(hours: hoursBody)
            )
        )
    }

    /// Re-bases the merge sources on what the server now stores, so a second
    /// save in the same session doesn't re-send a stale jsonb object and
    /// resurrect keys the first save removed.
    private func rememberSavedPatch(_ patch: UpdateBusinessRequest) {
        if let socialLinks = patch.socialLinks { loadedSocialLinks = socialLinks }
        if let attributes = patch.attributes { loadedAttributes = attributes }
        if let phone = patch.publicPhone {
            loadedPhoneHadCountryCode = phone
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .hasPrefix(countryCodePrefix)
        }
    }

    /// Saved state, keeping the media dirt the save couldn't clear.
    private func savedContent(_ content: EditBusinessPageContent) -> EditBusinessPageContent {
        var cleaned = promoteCurrentToOriginal(content)
        if case let .filled(dirty, palette, imageURL) = content.banner, dirty {
            cleaned = EditBusinessPageMapper.copy(
                cleaned,
                banner: .filled(dirty: true, palette: palette, imageURL: imageURL)
            )
        }
        if content.gallery.freshAddTile {
            cleaned = EditBusinessPageMapper.copy(
                cleaned,
                gallery: EditBusinessPageGalleryState(
                    tiles: content.gallery.tiles,
                    totalSlots: content.gallery.totalSlots,
                    freshAddTile: true,
                    hintLabel: content.gallery.hintLabel
                )
            )
        }
        return cleaned
    }

    private func buildPatch(from content: EditBusinessPageContent) -> UpdateBusinessRequest {
        var request = UpdateBusinessRequest()
        if content.name.isDirty {
            request.name = content.name.current.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if content.tagline.isDirty { request.tagline = content.tagline.current }
        if content.category.isDirty {
            request.categories = content.category.current
                .split(separator: "·")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        }
        if case let .field(field, _) = content.description, field.isDirty {
            request.description = field.current
        }
        if content.phone.isDirty {
            request.publicPhone = EditBusinessPageMapper.restorePhonePrefix(
                content.phone.current,
                hadCountryCode: loadedPhoneHadCountryCode
            )
        }
        if content.email.isDirty { request.publicEmail = content.email.current }
        if content.website.isDirty {
            request.website = EditBusinessPageMapper.normalizeWebsite(content.website.current)
        }
        if let booking = content.bookingLink, booking.isDirty {
            let normalized = EditBusinessPageMapper.normalizeWebsite(booking.current) ?? ""
            request.socialLinks = EditBusinessPageMapper.mergedSocialLinks(
                existing: loadedSocialLinks,
                booking: normalized
            )
        }
        if content.price.isDirty {
            request.attributes = EditBusinessPageMapper.mergedAttributes(
                existing: loadedAttributes,
                priceLevel: content.price.current
            )
        }
        return request
    }

    private func patchHasValues(_ patch: UpdateBusinessRequest) -> Bool {
        patch.name != nil
            || patch.tagline != nil
            || patch.description != nil
            || patch.categories != nil
            || patch.publicEmail != nil
            || patch.publicPhone != nil
            || patch.website != nil
            || patch.socialLinks != nil
            || patch.attributes != nil
            || patch.isPublished != nil
    }

    private func hasUnresolvedMediaDirty(_ content: EditBusinessPageContent) -> Bool {
        if case let .filled(dirty, _, _) = content.banner, dirty { return true }
        return content.gallery.freshAddTile
    }

    private func mediaDirtyCount(_ content: EditBusinessPageContent) -> Int {
        var count = 0
        if case let .filled(dirty, _, _) = content.banner, dirty { count += 1 }
        if content.gallery.freshAddTile { count += 1 }
        return count
    }

    /// `APIClient` maps HTTP 404 onto `.notFound` before the generic 4xx
    /// case, so that has to match too or a missing business renders the
    /// error screen on iOS while Android renders the empty state.
    private func isNotFound(_ error: Error) -> Bool {
        guard let apiError = error as? APIError else { return false }
        switch apiError {
        case .notFound:
            return true
        case let .server(status, _), let .clientError(status, _):
            return status == 404
        default:
            return false
        }
    }

    // MARK: - Helpers

    private func promoteCurrentToOriginal(_ content: EditBusinessPageContent) -> EditBusinessPageContent {
        EditBusinessPageContent(
            businessId: content.businessId,
            mode: zeroUnsaved(content.mode),
            banner: content.banner.cleaned,
            logo: content.logo,
            name: content.name.cleaned,
            tagline: content.tagline.cleaned,
            category: content.category.cleaned,
            categoryRequired: content.categoryRequired,
            price: content.price.cleaned,
            description: content.description.cleaned,
            hours: content.hours.cleaned,
            services: content.services.cleaned,
            gallery: content.gallery.cleaned,
            phone: content.phone.cleaned,
            email: content.email.cleaned,
            website: content.website.cleaned,
            bookingLink: content.bookingLink?.cleaned,
            location: content.location.cleaned
        )
    }

    private func revertToOriginal(_ content: EditBusinessPageContent) -> EditBusinessPageContent {
        EditBusinessPageContent(
            businessId: content.businessId,
            mode: zeroUnsaved(content.mode),
            banner: content.banner.reverted,
            logo: content.logo,
            name: content.name.reverted,
            tagline: content.tagline.reverted,
            category: content.category.reverted,
            categoryRequired: content.categoryRequired,
            price: content.price.reverted,
            description: content.description.reverted,
            hours: originalHours ?? content.hours.reverted,
            services: content.services.reverted,
            gallery: content.gallery.reverted,
            phone: content.phone.reverted,
            email: content.email.reverted,
            website: content.website.reverted,
            bookingLink: content.bookingLink?.reverted,
            location: content.location.reverted
        )
    }

    private func zeroUnsaved(_ mode: EditBusinessPageMode) -> EditBusinessPageMode {
        switch mode {
        case let .published(_, label): .published(unsavedCount: 0, lastPublishedLabel: label)
        case .setup: mode
        }
    }
}

// MARK: - Local cleanup helpers

private extension EditBusinessPageField {
    var cleaned: EditBusinessPageField {
        EditBusinessPageField(original: current, current: current, placeholder: placeholder)
    }

    var reverted: EditBusinessPageField {
        EditBusinessPageField(original: original, current: original, placeholder: placeholder)
    }

    func updating(current: String) -> EditBusinessPageField {
        EditBusinessPageField(original: original, current: current, placeholder: placeholder)
    }
}

private extension EditBusinessPageBannerState {
    var cleaned: EditBusinessPageBannerState {
        switch self {
        case .empty: self
        case let .filled(_, palette, imageURL): .filled(dirty: false, palette: palette, imageURL: imageURL)
        }
    }

    var reverted: EditBusinessPageBannerState {
        cleaned
    }
}

private extension EditBusinessPageDescriptionState {
    var cleaned: EditBusinessPageDescriptionState {
        switch self {
        case let .field(field, limit): .field(field.cleaned, charLimit: limit)
        case .prompt: self
        }
    }

    var reverted: EditBusinessPageDescriptionState {
        switch self {
        case let .field(field, limit): .field(field.reverted, charLimit: limit)
        case .prompt: self
        }
    }
}

private extension EditBusinessPageHoursState {
    var rows: [EditBusinessPageHoursRow] {
        switch self {
        case let .rows(rows, _), let .quickApply(rows): rows
        }
    }

    var cleaned: EditBusinessPageHoursState {
        switch self {
        case let .rows(rows, hint):
            .rows(rows: rows.map {
                EditBusinessPageHoursRow(
                    id: $0.id,
                    dayLabel: $0.dayLabel,
                    state: $0.state,
                    notes: $0.notes,
                    source: $0.isDirty ? nil : $0.source
                )
            }, footerHint: hint)
        case .quickApply: self
        }
    }

    var reverted: EditBusinessPageHoursState {
        cleaned
    }
}

private extension EditBusinessPageServicesState {
    var cleaned: EditBusinessPageServicesState {
        switch self {
        case let .chips(chips):
            .chips(chips: chips.map {
                EditBusinessPageServiceChip(id: $0.id, label: $0.label, iconKey: $0.iconKey, isFresh: false)
            })
        case .prompt: self
        }
    }

    var reverted: EditBusinessPageServicesState {
        cleaned
    }
}

private extension EditBusinessPageGalleryState {
    var cleaned: EditBusinessPageGalleryState {
        EditBusinessPageGalleryState(
            tiles: tiles,
            totalSlots: totalSlots,
            freshAddTile: false,
            hintLabel: hintLabel
        )
    }

    var reverted: EditBusinessPageGalleryState {
        cleaned
    }
}

private extension EditBusinessPageLocation {
    var cleaned: EditBusinessPageLocation {
        EditBusinessPageLocation(
            address: address.cleaned,
            city: city.cleaned,
            state: state.cleaned,
            zip: zip.cleaned,
            error: nil,
            mapVerified: mapVerified,
            pinDirty: false,
            hideExactAddress: hideExactAddress
        )
    }

    var reverted: EditBusinessPageLocation {
        EditBusinessPageLocation(
            address: address.reverted,
            city: city.reverted,
            state: state.reverted,
            zip: zip.reverted,
            error: nil,
            mapVerified: mapVerified,
            pinDirty: false,
            hideExactAddress: hideExactAddress
        )
    }

    func withError(_ message: String?) -> EditBusinessPageLocation {
        EditBusinessPageLocation(
            address: address,
            city: city,
            state: state,
            zip: zip,
            error: message,
            mapVerified: mapVerified,
            pinDirty: pinDirty,
            hideExactAddress: hideExactAddress
        )
    }
}
