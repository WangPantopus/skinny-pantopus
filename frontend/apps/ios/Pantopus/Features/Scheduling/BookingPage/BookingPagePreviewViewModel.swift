//
//  BookingPagePreviewViewModel.swift
//  Pantopus
//
//  C2 Public Booking Page Preview · Stream I4. Fetches the PUBLIC view
//  (GET /api/public/book/:slug, authenticated:false) so the owner sees
//  exactly what an invitee sees — including an honest paused state. No owner
//  affordances leak through; the render is read-only.
//

import Foundation
import Observation

/// Render state for the owner-facing preview. Mirrors the design's four
/// frames: rendered / loading / page-off (paused etc.) / all-types-hidden.
public enum BookingPreviewState: Sendable, Equatable {
    case loading
    case rendered(page: PublicPageView, eventTypes: [PublicEventTypeView])
    case pageOff(page: PublicPageView, status: SchedulingStatus)
    case allHidden(page: PublicPageView)
    case error(message: String)
}

@Observable
@MainActor
public final class BookingPagePreviewViewModel {
    public private(set) var state: BookingPreviewState = .loading

    public let owner: SchedulingOwner
    public let slug: String
    private let api: APIClient
    private var loadedOnce = false

    init(
        owner: SchedulingOwner,
        slug: String,
        api: APIClient = .shared
    ) {
        self.owner = owner
        self.slug = slug
        self.api = api
    }

    public var theme: SchedulingIdentityTheme {
        SchedulingIdentityTheme(owner)
    }

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
            let view: PublicBookView = try await api.request(
                SchedulingPublicEndpoints.bookPage(slug: slug)
            )
            loadedOnce = true
            state = Self.project(view)
        } catch {
            state = .error(message: SchedulingError.from(error as? APIError ?? .invalidResponse).userMessage
                ?? "Couldn't load this page. Try again.")
        }
    }

    /// Maps the public view to a render state. Paused/expired/unavailable are
    /// honest page-off states (never error screens); active/secret render.
    static func project(_ view: PublicBookView) -> BookingPreviewState {
        switch view.status {
        case .paused, .expired, .unavailable:
            return .pageOff(page: view.page, status: view.status)
        case .active, .secret, .unknown:
            if view.eventTypes.isEmpty {
                return .allHidden(page: view.page)
            }
            return .rendered(page: view.page, eventTypes: view.eventTypes)
        }
    }

    #if DEBUG
    func setStateForPreview(_ state: BookingPreviewState) {
        self.state = state
        loadedOnce = true
    }
    #endif
}
