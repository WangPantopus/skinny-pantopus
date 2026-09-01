//
//  PlaceDetailViewModel.swift
//  Pantopus
//
//  Container VM for a Place group-detail page (W2.3). Fetches the home's
//  PlaceIntelligence (the same payload the dashboard uses — a warm cache
//  hit on tap-through) and exposes the four render states; the view
//  extracts the page's group sections via `PlaceDetailGroup`.
//

import SwiftUI

@Observable
@MainActor
final class PlaceDetailViewModel {
    enum State {
        case loading
        case loaded(PlaceIntelligence)
        case error(message: String)
    }

    private(set) var state: State = .loading
    let homeId: String
    let group: PlaceDetailGroup

    private let api: APIClient

    init(homeId: String, group: PlaceDetailGroup, api: APIClient = .shared) {
        self.homeId = homeId
        self.group = group
        self.api = api
    }

    func load() async {
        if case .loaded = state { return }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let intelligence: PlaceIntelligence = try await api.request(
                PlaceEndpoints.intelligence(homeId: homeId)
            )
            state = .loaded(intelligence)
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load this section.")
        } catch {
            state = .error(message: "Couldn't load this section.")
        }
    }

    /// The sections that belong to this detail page, in contract order.
    func sections(in intel: PlaceIntelligence) -> [PlaceSectionEnvelope] {
        let groups = Set(group.groups)
        return intel.groups
            .filter { groups.contains($0.group) }
            .flatMap(\.sections)
    }

    /// Find a single section across the payload (for bespoke detail cards).
    func section(_ id: PlaceSectionID, in intel: PlaceIntelligence) -> PlaceSectionEnvelope? {
        for g in intel.groups {
            for s in g.sections where s.id == id {
                return s
            }
        }
        return nil
    }
}
