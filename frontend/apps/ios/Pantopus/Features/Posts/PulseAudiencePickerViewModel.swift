import Foundation
import Observation

@Observable
@MainActor
final class PulseAudiencePickerViewModel {
    private(set) var state: PulseAreaPickerState = .loading
    private let api: APIClient
    private var generation = 0

    init(api: APIClient = .shared) {
        self.api = api
    }

    func load(postAreaId: String?) async {
        generation += 1
        let request = generation
        state = .loading
        do {
            let response: PulseMyAreasResponse = try await api.request(PulseEndpoints.myAreas())
            guard request == generation, !Task.isCancelled else { return }
            let ownAreas = [response.town, response.neighborhood, response.street].compactMap { $0 }
            guard response.homeVerified == true, let postAreaId,
                  ownAreas.contains(where: { $0.id == postAreaId }) else {
                state = .empty
                return
            }
            var seen = Set<String>()
            let choices = [response.neighborhood, response.street].compactMap { $0 }
                .filter { ["neighborhood", "street"].contains($0.kind ?? "") }
                .compactMap(PulseAreaPickerViewModel.choice)
                .filter { seen.insert($0.id).inserted }
            state = choices.isEmpty ? .empty : .loaded(choices)
        } catch {
            guard request == generation, !Task.isCancelled else { return }
            state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't load your areas. Please try again.")
        }
    }
}
