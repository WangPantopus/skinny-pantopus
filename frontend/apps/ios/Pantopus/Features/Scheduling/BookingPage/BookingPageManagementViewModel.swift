//
//  BookingPageManagementViewModel.swift
//  Pantopus
//
//  C1 Booking Link / Public Page Management · Stream I4. Loads the owner's
//  booking page (auto-created server-side) plus its event types, edits the
//  header/intro/visibility fields, flips live/paused and per-service
//  visibility optimistically, runs a debounced slug-availability check, and
//  saves via PUT /booking-page (+ PUT /booking-page/slug on slug change,
//  handling 409 SLUG_TAKEN). Also vends the data C3 (ShareLinkSheet) needs.
//
//  Owner context flows through SchedulingOwner → endpoint builders; never
//  hand-rolled. Tokens-only UI. No default-arg @MainActor VM init.
//
// swiftlint:disable file_length type_body_length

import Foundation
import Observation

// MARK: - Supporting types

/// Page-visibility segmented control value (booking page `visibility`).
public enum BookingPageVisibility: String, Sendable, Equatable, CaseIterable {
    case listed
    case unlisted
}

/// Inline slug-availability check state for the handle field.
public enum SlugCheckState: Sendable, Equatable {
    case unchanged
    case checking
    case available
    case taken(suggestions: [String])
    case invalid(message: String)
}

/// One row in the service-visibility card.
public struct BookingServiceRow: Identifiable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let durationLabel: String
    public let locationIcon: PantopusIcon
    public let isVisible: Bool
}

/// Render state for the management screen. There is no `.empty` case: the
/// page is auto-created server-side, so the form always loads (the page
/// zero-state is the separate H16 screen).
public enum BookingPageManagementState: Sendable, Equatable {
    case loading
    case loaded
    case error(message: String)
}

// MARK: - View model

@Observable
@MainActor
public final class BookingPageManagementViewModel {
    // MARK: Public render state

    public private(set) var state: BookingPageManagementState = .loading

    // MARK: Editable fields (bound by the view)

    public var titleText = ""
    public var taglineText = ""
    public var introText = ""
    public var confirmationText = ""
    public var slugText = ""
    public var visibility: BookingPageVisibility = .listed

    // MARK: Live/immediate state

    /// Accepting-bookings switch = `is_live && !is_paused`.
    public private(set) var isAcceptingBookings = true
    public private(set) var isLive = true
    public private(set) var isPaused = false
    public private(set) var slugState: SlugCheckState = .unchanged
    public private(set) var serviceRows: [BookingServiceRow] = []
    public private(set) var isSaving = false
    public private(set) var saveError: String?
    public private(set) var showSavedToast = false

    // MARK: C3 ShareLinkSheet state

    public var showOnProfile = false
    public var addToSignature = false

    // MARK: Dependencies

    public let owner: SchedulingOwner
    public let push: @MainActor (SchedulingRoute) -> Void
    private let api: APIClient

    // MARK: Raw + originals

    private var page: BookingPageDTO?
    private var eventTypes: [EventTypeDTO] = []
    private var original = OriginalSnapshot()
    private var loadedOnce = false
    private var slugCheckTask: Task<Void, Never>?

    private struct OriginalSnapshot: Equatable {
        var title = ""
        var tagline = ""
        var intro = ""
        var confirmation = ""
        var slug = ""
        var visibility: BookingPageVisibility = .listed
    }

    init(
        owner: SchedulingOwner,
        api: APIClient = .shared,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.api = api
        self.push = push
    }

    // MARK: - Derived

    public var theme: SchedulingIdentityTheme {
        SchedulingIdentityTheme(owner)
    }

    /// `pantopus.com/book/<slug>` for display.
    public var displaySlugURL: String {
        BookingLinkURL.display(slug: slugText)
    }

    /// The persisted slug (editing the field doesn't change the live link
    /// until saved). Used for the share sheet and preview.
    public var savedSlug: String {
        original.slug.isEmpty ? slugText : original.slug
    }

    /// `https://pantopus.com/book/<slug>` for share/QR/open.
    public var shareURL: String {
        BookingLinkURL.shareable(slug: savedSlug)
    }

    /// `pantopus.com/book/<slug>` of the persisted slug, for the share card.
    public var savedDisplayURL: String {
        BookingLinkURL.display(slug: savedSlug)
    }

    public var hasServices: Bool {
        !serviceRows.isEmpty
    }

    public var hasVisibleService: Bool {
        serviceRows.contains { $0.isVisible }
    }

    public var showPaymentsRow: Bool {
        owner.supportsPayments
    }

    /// A page that has never been published reads as a *draft* (design's third
    /// status tone). Draft = not live; the toggle reads OFF, the status copy
    /// reads "Not published yet…", the footer dims, and the save bar says
    /// "Save draft". `isLive` is the persisted publish flag.
    public var isDraft: Bool {
        !isLive
    }

    /// Maps the live/paused/draft tri-state onto the shared `BookingStatusChip`
    /// tone. Draft wins over paused (an unpublished page is a draft regardless
    /// of the paused flag).
    var statusTone: BookingStatusTone {
        if isDraft { return .draft }
        return isAcceptingBookings ? .live : .paused
    }

    /// One-line status helper copy under the chip — matches the design's copy
    /// map (live / paused / draft).
    public var statusCopy: String {
        switch statusTone {
        case .live: "Anyone with this link can book you."
        case .paused: "Page is paused. People see a short note and cannot book."
        case .draft: "Not published yet. Finish setup, then publish to go live."
        }
    }

    /// Bottom save-bar label: an unpublished page saves a *draft*; a published
    /// page saves *changes*.
    public var saveLabel: String {
        isDraft ? "Save draft" : "Save changes"
    }

    /// Value shown on the "Intake questions" link row. The list-level event-type
    /// DTOs don't carry their questions, so there's no authoritative count to
    /// show; return `nil` so the row omits the value rather than faking one.
    public var questionCount: String? {
        nil
    }

    public var isDirty: Bool {
        current() != original
    }

    public var isValid: Bool {
        switch slugState {
        case .checking, .taken, .invalid: false
        case .unchanged, .available: !slugText.trimmingCharacters(in: .whitespaces).isEmpty
        }
    }

    private func current() -> OriginalSnapshot {
        OriginalSnapshot(
            title: titleText,
            tagline: taglineText,
            intro: introText,
            confirmation: confirmationText,
            slug: slugText,
            visibility: visibility
        )
    }

    // MARK: - Load

    public func load() async {
        if loadedOnce { return }
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let pageResponse: BookingPageResponse = try await api.request(
                SchedulingEndpoints.getBookingPage(owner: owner)
            )
            page = pageResponse.page
            // Event types are best-effort — the page still renders without them.
            eventTypes = await (try? fetchEventTypes()) ?? []
            hydrate(from: pageResponse.page)
            rebuildServiceRows()
            loadedOnce = true
            state = .loaded
        } catch {
            state = .error(message: SchedulingError.from(error as? APIError ?? .invalidResponse).userMessage
                ?? "Couldn't load your booking page. Try again.")
        }
    }

    private func fetchEventTypes() async throws -> [EventTypeDTO] {
        let response: EventTypesResponse = try await api.request(
            SchedulingEndpoints.getEventTypes(owner: owner)
        )
        return response.eventTypes
    }

    private func hydrate(from page: BookingPageDTO) {
        titleText = page.title ?? ""
        taglineText = page.tagline ?? ""
        introText = page.intro ?? ""
        confirmationText = page.confirmationMessage ?? ""
        slugText = page.slug
        visibility = BookingPageVisibility(rawValue: page.visibility ?? "listed") ?? .listed
        showOnProfile = visibility == .listed
        isLive = page.isLive
        isPaused = page.isPaused
        isAcceptingBookings = page.isLive && !page.isPaused
        slugState = .unchanged
        original = current()
    }

    private func rebuildServiceRows() {
        serviceRows = eventTypes
            .filter { $0.isActive ?? true }
            .map { event in
                BookingServiceRow(
                    id: event.id,
                    name: event.name,
                    durationLabel: BookingDuration.label(event.defaultDuration ?? event.durations.first ?? 30),
                    locationIcon: BookingLocationMode.icon(event.locationMode),
                    isVisible: (event.visibility ?? "public").lowercased() != "secret"
                )
            }
    }

    // MARK: - Slug availability (debounced)

    /// Call on every slug edit. Validates format locally, then debounces a
    /// `check-slug` round-trip. No check when the slug is unchanged.
    public func slugTextChanged() {
        slugCheckTask?.cancel()
        let candidate = slugText.lowercased()
        if candidate != slugText { slugText = candidate } // force lowercase

        guard candidate != original.slug else {
            slugState = .unchanged
            return
        }
        if let formatError = Self.slugFormatError(candidate) {
            slugState = .invalid(message: formatError)
            return
        }
        slugState = .checking
        slugCheckTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }
            await self?.runSlugCheck(candidate)
        }
    }

    /// Internal (not private) so targeted tests can drive a deterministic
    /// availability check without waiting on the debounce timer.
    func runSlugCheck(_ slug: String) async {
        guard slug == slugText.lowercased(), slug != original.slug else { return }
        do {
            let result: CheckSlugResponse = try await api.request(
                SchedulingEndpoints.checkSlug(owner: owner, slug: slug)
            )
            guard slug == slugText.lowercased() else { return }
            if result.error == "INVALID_SLUG" {
                slugState = .invalid(message: result.message ?? "That handle isn't allowed. Try another.")
            } else if result.available {
                slugState = .available
            } else {
                slugState = .taken(suggestions: result.suggestions ?? [])
            }
        } catch {
            // A failed check shouldn't block saving — fall back to letting the
            // server validate on commit.
            slugState = .unchanged
        }
    }

    static func slugFormatError(_ slug: String) -> String? {
        if slug.count < 3 || slug.count > 50 { return "Use 3 to 50 characters." }
        let pattern = "^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$"
        if slug.range(of: pattern, options: .regularExpression) == nil {
            return "Use lowercase letters, numbers and hyphens."
        }
        return nil
    }

    public func applySuggestion(_ suggestion: String) {
        slugText = suggestion
        slugTextChanged()
    }

    // MARK: - Status toggle (optimistic)

    public func setAcceptingBookings(_ accepting: Bool) async {
        let previousAccepting = isAcceptingBookings
        let previousPaused = isPaused
        let previousLive = isLive
        isAcceptingBookings = accepting
        isPaused = !accepting
        if accepting { isLive = true }
        do {
            let response: BookingPageResponse = try await api.request(
                SchedulingEndpoints.updateBookingPage(
                    owner: owner,
                    BookingPageUpdateRequest(isLive: accepting ? true : nil, isPaused: !accepting)
                )
            )
            page = response.page
            isLive = response.page.isLive
            isPaused = response.page.isPaused
            isAcceptingBookings = response.page.isLive && !response.page.isPaused
        } catch {
            isAcceptingBookings = previousAccepting
            isPaused = previousPaused
            isLive = previousLive
            saveError = SchedulingError.from(error as? APIError ?? .invalidResponse).userMessage
                ?? "Couldn't update your status."
        }
    }

    // MARK: - Service visibility toggle (optimistic)

    public func setServiceVisible(eventTypeId: String, visible: Bool) async {
        let previous = serviceRows
        serviceRows = serviceRows.map { row in
            row.id == eventTypeId
                ? BookingServiceRow(
                    id: row.id,
                    name: row.name,
                    durationLabel: row.durationLabel,
                    locationIcon: row.locationIcon,
                    isVisible: visible
                )
                : row
        }
        do {
            let _: EventTypeResponse = try await api.request(
                SchedulingEndpoints.updateEventType(
                    owner: owner,
                    id: eventTypeId,
                    UpdateEventTypeRequest(visibility: visible ? "public" : "secret")
                )
            )
            // `serviceRows` is the optimistic source of truth; a later refresh
            // re-fetches event types and rebuilds it authoritatively.
        } catch {
            serviceRows = previous
            saveError = SchedulingError.from(error as? APIError ?? .invalidResponse).userMessage
                ?? "Couldn't update that service."
        }
    }

    // MARK: - Save

    public func save() async {
        guard isValid, !isSaving else { return }
        isSaving = true
        saveError = nil
        defer { isSaving = false }

        // 1) Slug first (its own endpoint + 409 handling) when changed.
        if slugText != original.slug {
            do {
                let response: BookingPageResponse = try await api.request(
                    SchedulingEndpoints.updateBookingPageSlug(owner: owner, BookingPageSlugRequest(slug: slugText))
                )
                page = response.page
            } catch {
                let scheduling = SchedulingError.from(error as? APIError ?? .invalidResponse)
                if scheduling.code == "SLUG_TAKEN" {
                    // Surface inline on the slug field only (avoid a duplicate
                    // bottom error). saveError was cleared at the top of save().
                    slugState = .taken(suggestions: [])
                } else {
                    saveError = scheduling.userMessage ?? "Couldn't save your handle."
                }
                return
            }
        }

        // 2) The rest of the page fields.
        do {
            let response: BookingPageResponse = try await api.request(
                SchedulingEndpoints.updateBookingPage(
                    owner: owner,
                    BookingPageUpdateRequest(
                        title: titleText.trimmedOrNil,
                        tagline: taglineText.trimmedOrNil,
                        intro: introText.trimmedOrNil,
                        confirmationMessage: confirmationText.trimmedOrNil,
                        visibility: visibility.rawValue
                    )
                )
            )
            page = response.page
            hydrate(from: response.page)
            flashSavedToast()
        } catch {
            saveError = SchedulingError.from(error as? APIError ?? .invalidResponse).userMessage
                ?? "Couldn't save your changes."
        }
    }

    /// Fire-and-forget: awaiting the toast's 2s sleep inside `save()` kept the
    /// `defer { isSaving = false }` from running, pinning the commit button in
    /// its spinner state for 2 extra seconds after every successful save.
    private func flashSavedToast() {
        showSavedToast = true
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            showSavedToast = false
        }
    }
}

// MARK: - Actions, navigation & preview seam

public extension BookingPageManagementViewModel {
    // MARK: - C3 ShareLinkSheet callbacks

    /// Regenerate the public slug (danger — invalidates the old link).
    /// Updates only slug-related state so unsaved header/intro edits survive.
    func regenerateLink() async {
        do {
            let response: BookingPageResponse = try await api.request(
                SchedulingEndpoints.resetSlug(owner: owner)
            )
            page = response.page
            slugText = response.page.slug
            original.slug = response.page.slug
            slugState = .unchanged
        } catch {
            saveError = SchedulingError.from(error as? APIError ?? .invalidResponse).userMessage
                ?? "Couldn't regenerate your link."
        }
    }

    /// Turn the page live from the share sheet's draft banner.
    func turnOnPage() async {
        await setAcceptingBookings(true)
    }

    /// C3 share-sheet "Show on profile" toggle. The share sheet's profile
    /// switch maps to page `visibility` (`listed` ⇆ `unlisted`). Optimistically
    /// flips the local segmented value and persists it through the same
    /// `updateBookingPage` path the save bar uses, so it sticks without a full
    /// form save. Mirrors `showOnProfile` for the sheet's read-back.
    func setListed(_ listed: Bool) async {
        let previousVisibility = visibility
        let previousShow = showOnProfile
        visibility = listed ? .listed : .unlisted
        showOnProfile = listed
        do {
            let response: BookingPageResponse = try await api.request(
                SchedulingEndpoints.updateBookingPage(
                    owner: owner,
                    BookingPageUpdateRequest(visibility: visibility.rawValue)
                )
            )
            page = response.page
            visibility = BookingPageVisibility(rawValue: response.page.visibility ?? "listed") ?? .listed
            original.visibility = visibility
            showOnProfile = visibility == .listed
        } catch {
            visibility = previousVisibility
            showOnProfile = previousShow
            saveError = SchedulingError.from(error as? APIError ?? .invalidResponse).userMessage
                ?? "Couldn't update visibility."
        }
    }

    // MARK: - Navigation

    func openIntakeQuestions() {
        push(.eventTypeList(owner: owner))
    }

    func openPayments() {
        push(.paymentsSetup(owner: owner))
    }

    func editService(_ id: String) {
        push(.eventTypeEditor(owner: owner, eventTypeId: id))
    }

    func createService() {
        push(.eventTypeEditor(owner: owner, eventTypeId: nil))
    }

    // MARK: - Preview/test seam

    #if DEBUG
    func hydrateForPreview(page: BookingPageDTO, eventTypes: [EventTypeDTO]) {
        self.page = page
        self.eventTypes = eventTypes
        hydrate(from: page)
        rebuildServiceRows()
        loadedOnce = true
        state = .loaded
    }
    #endif
}

// MARK: - Helpers

private extension String {
    var trimmedOrNil: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
