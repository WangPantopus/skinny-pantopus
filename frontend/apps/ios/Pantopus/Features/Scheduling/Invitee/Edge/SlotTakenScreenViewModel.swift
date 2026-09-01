//
//  SlotTakenScreenViewModel.swift
//  Pantopus
//
//  D5 Slot Taken / Conflict (Stream I7) — the full-screen conflict-recovery
//  surface. Re-reads the public slots (`GET /api/public/book/:slug/:eventTypeSlug
//  /slots`) over the next two weeks and renders the nearest open times through
//  the Foundation `SlotTakenSheet`. Never a dead end: selecting hands off to the
//  intake form, and "pick another time" returns to the picker. Tokens only.
//

import SwiftUI

@Observable
@MainActor
final class SlotTakenScreenViewModel {
    enum State: Equatable {
        case loading
        case alternatives([SchedulingSlotAlternative])
        case fullyBooked
        case error(message: String)
    }

    let slug: String
    let eventTypeSlug: String
    let tz: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .loading
    /// The horizon to scan for the nearest open times.
    private let horizonDays = 14
    /// Cap on the nearest times we surface.
    private let maxAlternatives = 5
    private var didLoad = false
    private var isFetching = false

    init(
        slug: String,
        eventTypeSlug: String,
        tz: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.slug = slug
        self.eventTypeSlug = eventTypeSlug
        self.tz = tz
        self.push = push
        self.client = client
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
        let calendar = Calendar(identifier: .gregorian)
        let from = SchedulingTime.isoDay(Date())
        let toDate = calendar.date(byAdding: .day, value: horizonDays, to: Date()) ?? Date()
        let to = SchedulingTime.isoDay(toDate)
        do {
            let response: PublicSlotsResponse = try await client.request(
                SchedulingPublicEndpoints.slots(slug: slug, eventTypeSlug: eventTypeSlug, from: from, to: to, tz: tz)
            )
            let alternatives = response.slots
                .sorted { $0.start < $1.start }
                .prefix(maxAlternatives)
                .map { SchedulingSlotAlternative(start: $0.start, end: $0.end, startLocal: $0.startLocal) }
            state = alternatives.isEmpty ? .fullyBooked : .alternatives(Array(alternatives))
        } catch let error as SchedulingError {
            // A 409 here still hands us nearest open times — surface them.
            if case let .slotConflict(_, _, alternatives) = error, !alternatives.isEmpty {
                state = .alternatives(alternatives)
            } else {
                state = .error(message: error.userMessage ?? "We couldn't load open times.")
            }
        } catch {
            state = .error(message: "We couldn't load open times.")
        }
    }

    // MARK: - Actions

    func select(_ alternative: SchedulingSlotAlternative) {
        push(.inviteeIntakeForm(slug: slug, eventTypeSlug: eventTypeSlug, start: alternative.start, tz: tz))
    }

    func pickAnotherTime() {
        push(.inviteeSlotPicker(slug: slug, eventTypeSlug: eventTypeSlug, tz: tz, oneOffToken: nil))
    }
}

#if DEBUG
extension SlotTakenScreenViewModel {
    static func preview(_ state: State) -> SlotTakenScreenViewModel {
        let viewModel = SlotTakenScreenViewModel(
            slug: "ada",
            eventTypeSlug: "intro",
            tz: "America/Los_Angeles",
            push: { _ in },
            client: .shared
        )
        viewModel.state = state
        viewModel.didLoad = true
        return viewModel
    }
}
#endif
