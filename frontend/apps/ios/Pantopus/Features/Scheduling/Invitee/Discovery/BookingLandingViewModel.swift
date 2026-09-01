//
//  BookingLandingViewModel.swift
//  Pantopus
//
//  C5 Booking Landing / Booker Profile (Stream I5) — the public invitee landing.
//  Fetches `GET /api/public/book/:slug` (authenticated:false) → page + status +
//  the bookable event types. `status:'paused'` is a first-class calm state, not
//  an error; a 404 surfaces the "this link isn't available" state. Secret /
//  non-public event types are already excluded server-side. Tapping an event
//  type hands off to C6 (`.inviteeSlotPicker`); this stream stops at selection.
//

import SwiftUI

@Observable
@MainActor
final class BookingLandingViewModel {
    enum State: Equatable {
        case loading
        /// Active page with at least one bookable event type.
        case loaded(PublicBookView)
        /// `status:'paused'` — render calmly, never as an error.
        case paused(PublicBookView)
        /// Active page with no bookable event types configured.
        case empty(PublicBookView)
        /// 404 / unavailable / transport — "this link isn't available".
        case error(message: String)
    }

    let slug: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .loading
    private var isFetching = false
    private var didLoad = false

    /// Designated, test-injectable initializer. No default arguments (Xcode 16.4
    /// crashes on default-argument `@MainActor` view-model initializers).
    init(
        slug: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.slug = slug
        self.push = push
        self.client = client
    }

    /// The host's pillar accent, derived from `page.owner_type`.
    var accent: Color {
        switch state {
        case let .loaded(view), let .paused(view), let .empty(view):
            DiscoveryTheme.accent(forOwnerType: view.page.ownerType)
        default:
            DiscoveryTheme.accent(forOwnerType: nil)
        }
    }

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        guard !isFetching else { return }
        isFetching = true
        defer { isFetching = false }
        state = .loading
        do {
            let view: PublicBookView = try await client.request(
                SchedulingPublicEndpoints.bookPage(slug: slug)
            )
            apply(view)
        } catch let error as SchedulingError {
            state = .error(message: errorMessage(for: error))
        } catch {
            state = .error(message: "Something went wrong. Try again.")
        }
    }

    private func apply(_ view: PublicBookView) {
        switch view.status {
        case .paused:
            state = .paused(view)
        case .unavailable, .expired:
            state = .error(message: "This link isn't available")
        case .active, .secret, .unknown:
            state = view.eventTypes.isEmpty ? .empty(view) : .loaded(view)
        }
    }

    private func errorMessage(for error: SchedulingError) -> String {
        switch error {
        case .notFound:
            "This link isn't available"
        default:
            error.userMessage ?? "Something went wrong. Try again."
        }
    }

    /// Hand off to C6 carrying the page slug + chosen event-type slug + the
    /// device timezone (the picker re-fetches and lets the booker change it).
    func selectEventType(_ eventType: PublicEventTypeView) {
        guard let eventTypeSlug = eventType.slug, !eventTypeSlug.isEmpty else { return }
        push(.inviteeSlotPicker(
            slug: slug,
            eventTypeSlug: eventTypeSlug,
            tz: SchedulingTime.deviceTimeZoneIdentifier,
            oneOffToken: nil
        ))
    }
}

#if DEBUG
extension BookingLandingViewModel {
    /// Fixture-seeded loaded state for `#Preview` / local screenshot harness.
    static func previewLoaded() -> BookingLandingViewModel {
        let viewModel = BookingLandingViewModel(slug: "ada", push: { _ in }, client: .shared)
        let json = #"""
        {
          "page": {
            "slug": "ada", "title": "Ada Lovelace",
            "tagline": "Founder · Analytical Engine Co.",
            "intro": "Pick a time that works for you and we'll talk it through.",
            "owner_type": "user", "timezone": "America/Los_Angeles"
          },
          "status": "active",
          "eventTypes": [
            {"id": "et1", "name": "Intro call", "slug": "intro", "default_duration": 30, "location_mode": "video"},
            {"id": "et2", "name": "Deep dive", "slug": "deep", "default_duration": 60, "location_mode": "phone"},
            {"id": "et3", "name": "Coffee chat", "slug": "coffee", "default_duration": 45, "location_mode": "in_person"}
          ]
        }
        """#
        if let data = json.data(using: .utf8), let view = try? JSONDecoder().decode(PublicBookView.self, from: data) {
            viewModel.state = .loaded(view)
        }
        viewModel.didLoad = true
        return viewModel
    }

    /// Fixture-seeded paused state.
    static func previewPaused() -> BookingLandingViewModel {
        let viewModel = BookingLandingViewModel(slug: "ada", push: { _ in }, client: .shared)
        let json = #"""
        {
          "page": {"slug": "ada", "title": "Ada Lovelace", "owner_type": "user"},
          "status": "paused", "eventTypes": []
        }
        """#
        if let data = json.data(using: .utf8), let view = try? JSONDecoder().decode(PublicBookView.self, from: data) {
            viewModel.state = .paused(view)
        }
        viewModel.didLoad = true
        return viewModel
    }

    /// Fixture-seeded empty (active, no event types) state.
    static func previewEmpty() -> BookingLandingViewModel {
        let viewModel = BookingLandingViewModel(slug: "ada", push: { _ in }, client: .shared)
        let json = #"""
        {
          "page": {"slug": "ada", "title": "Ada Lovelace", "tagline": "Founder · Analytical Engine Co.", "owner_type": "user"},
          "status": "active", "eventTypes": []
        }
        """#
        if let data = json.data(using: .utf8), let view = try? JSONDecoder().decode(PublicBookView.self, from: data) {
            viewModel.state = .empty(view)
        }
        viewModel.didLoad = true
        return viewModel
    }

    /// Fixture-seeded error state.
    static func previewError() -> BookingLandingViewModel {
        let viewModel = BookingLandingViewModel(slug: "ada", push: { _ in }, client: .shared)
        viewModel.state = .error(message: "This link isn't available")
        viewModel.didLoad = true
        return viewModel
    }
}
#endif
