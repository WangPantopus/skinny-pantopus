//
//  BookingPageZeroStateViewModel.swift
//  Pantopus
//
//  H16 Booking-Link / Page Empty & Zero-State · Stream I4. The first-run
//  state for the booking page: confirms whether any services exist, then
//  guides the owner into the first-run wizard (A2) or the event-type editor
//  (B2). Owner context via SchedulingOwner.
//

import Foundation
import Observation

public enum BookingPageZeroState: Sendable, Equatable {
    case loading
    case ready(hasEventTypes: Bool)
    case error(message: String)
}

@Observable
@MainActor
public final class BookingPageZeroStateViewModel {
    public private(set) var state: BookingPageZeroState = .loading

    public let owner: SchedulingOwner
    public let push: @MainActor (SchedulingRoute) -> Void
    private let api: APIClient
    private var loadedOnce = false

    init(
        owner: SchedulingOwner,
        api: APIClient = .shared,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.api = api
        self.push = push
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
            let response: EventTypesResponse = try await api.request(
                SchedulingEndpoints.getEventTypes(owner: owner)
            )
            loadedOnce = true
            state = .ready(hasEventTypes: !response.eventTypes.isEmpty)
        } catch {
            state = .error(message: SchedulingError.from(error as? APIError ?? .invalidResponse).userMessage
                ?? "Couldn't load your scheduling setup. Try again.")
        }
    }

    // MARK: - Navigation (A2 / B2)

    public func setUpBookingLink() {
        push(.firstRunWizard(owner: owner))
    }

    public func addEventType() {
        push(.eventTypeEditor(owner: owner, eventTypeId: nil))
    }

    #if DEBUG
    func setStateForPreview(_ state: BookingPageZeroState) {
        self.state = state
        loadedOnce = true
    }
    #endif
}
