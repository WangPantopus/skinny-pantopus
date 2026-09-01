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
    public var showsDiscardConfirm = false

    private let businessId: String
    private let api: APIClient
    private let localPreviewPersistenceEnabled: Bool

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
    private var hasLoadedOnce = false

    init(
        businessId: String,
        preview: EditBusinessPageContent? = nil,
        api: APIClient = .shared
    ) {
        self.businessId = businessId
        self.api = api
        localPreviewPersistenceEnabled = preview != nil
        if let preview {
            state = .loaded(preview)
            hasLoadedOnce = true
        } else {
            state = .loading
        }
    }

    // MARK: - Load

    public func load() async {
        if localPreviewPersistenceEnabled { return }
        if hasLoadedOnce, case .loaded = state { return }
        await fetch(showLoading: true)
    }

    public func refresh() async {
        if localPreviewPersistenceEnabled { return }
        await fetch(showLoading: true)
    }

    private func fetch(showLoading: Bool) async {
        if showLoading { state = .loading }
        do {
            let detail: BusinessDetailResponse = try await api.request(
                BusinessesEndpoints.business(businessId: businessId)
            )
            guard detail.access?.hasAccess == true else {
                state = .error(message: noAccessMessage)
                hasLoadedOnce = false
                return
            }
            let location = detail.profile?.primaryLocation
                ?? detail.locations.first { $0.isPrimary == true }
                ?? detail.locations.first
            primaryLocationId = location?.id
            loadedSocialLinks = EditBusinessPageMapper.stringMap(detail.profile?.socialLinks)
            loadedAttributes = detail.profile?.attributes ?? [:]
            loadedPhoneHadCountryCode = (detail.profile?.publicPhone ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .hasPrefix(countryCodePrefix)

            var hours: [BusinessHoursDTO] = []
            if let locationId = location?.id {
                if let hoursResponse: BusinessLocationHoursResponse = try? await api.request(
                    BusinessesEndpoints.locationHours(businessId: businessId, locationId: locationId)
                ) {
                    hours = hoursResponse.hours
                }
            }

            // Owner-scoped catalog first. `/public/:username` 404s until the
            // profile is published, so deriving Services from it alone left
            // the setup checklist permanently short one item and made publish
            // unreachable for every unpublished business.
            var catalog: [BusinessCatalogItemDTO]?
            if let itemsResponse: BusinessCatalogItemsResponse = try? await api.request(
                BusinessesEndpoints.catalogItems(businessId: businessId)
            ) {
                catalog = itemsResponse.items
            }

            if let username = detail.business.username, !username.isEmpty {
                if let publicPayload: BusinessPublicResponse = try? await api.request(
                    BusinessesEndpoints.publicBusiness(username: username)
                ) {
                    if catalog == nil { catalog = publicPayload.catalog }
                    if hours.isEmpty { hours = publicPayload.hours }
                }
            }

            state = .loaded(
                EditBusinessPageMapper.content(
                    from: detail,
                    hours: hours,
                    catalog: catalog ?? []
                )
            )
            hasLoadedOnce = true
        } catch {
            if isNotFound(error) {
                state = .empty
            } else {
                state = .error(
                    message: (error as? APIError)?.errorDescription ?? "Couldn't load editor."
                )
            }
            hasLoadedOnce = false
        }
    }

    // MARK: - Field setters

    public func update(_ key: EditBusinessPageFieldKey, to value: String) {
        guard case let .loaded(content) = state else { return }
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
        guard case let .loaded(content) = state else { return }
        if localPreviewPersistenceEnabled {
            toastMessage = "Published"
            return
        }
        if case let .setup(_, _, remaining, _) = content.mode, remaining > 0 {
            toastMessage = "Finish the remaining sections before publishing."
            return
        }
        let saved = await persist(successToast: nil)
        guard saved else { return }
        do {
            _ = try await api.request(BusinessesEndpoints.publishBusiness(businessId: businessId))
            toastMessage = "Published"
            await fetch(showLoading: false)
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
            try await pushProfile(content)
            try await pushLocation(content)
            try await pushHours(content)
            state = .loaded(EditBusinessPageMapper.withRecomputedMode(savedContent(content)))
            if let successToast { toastMessage = successToast }
            return true
        } catch let failure as SaveFailure {
            toastMessage = failure.message
            return false
        } catch {
            toastMessage = (error as? APIError)?.errorDescription ?? "Couldn't save changes."
            return false
        }
    }

    private func pushProfile(_ content: EditBusinessPageContent) async throws {
        let patch = buildPatch(from: content)
        guard patchHasValues(patch) else { return }
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
        if case let .filled(dirty, palette) = content.banner, dirty {
            cleaned = EditBusinessPageMapper.copy(
                cleaned,
                banner: .filled(dirty: true, palette: palette)
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
        if case let .filled(dirty, _) = content.banner, dirty { return true }
        return content.gallery.freshAddTile
    }

    private func mediaDirtyCount(_ content: EditBusinessPageContent) -> Int {
        var count = 0
        if case let .filled(dirty, _) = content.banner, dirty { count += 1 }
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
            hours: content.hours.reverted,
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
        case let .filled(_, palette): .filled(dirty: false, palette: palette)
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
    var cleaned: EditBusinessPageHoursState {
        switch self {
        case let .rows(rows, hint):
            .rows(rows: rows.map {
                EditBusinessPageHoursRow(id: $0.id, dayLabel: $0.dayLabel, state: $0.state, isDirty: false)
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
