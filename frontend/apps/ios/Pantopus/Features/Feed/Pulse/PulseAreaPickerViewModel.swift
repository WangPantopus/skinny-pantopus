import Foundation
import Observation

struct PulseAreaChoice: Identifiable, Equatable {
    let id: String
    let title: String
    let detail: String
}

enum PulseAreaPickerState: Equatable {
    case loading
    case loaded([PulseAreaChoice])
    case empty
    case error(message: String)
}

@Observable
@MainActor
final class PulseAreaPickerViewModel {
    private(set) var state: PulseAreaPickerState = .loading
    var searchText = ""
    var isSearching = false
    private let api: APIClient
    private var generation = 0

    init(api: APIClient = .shared) {
        self.api = api
    }

    func load(debounce: Bool = false) async {
        generation += 1
        let request = generation
        state = .loading
        do {
            if debounce { try await Task.sleep(for: .milliseconds(300)) }
            let areas: [PulseAreaDTO]
            if isSearching {
                let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
                guard query.utf16.count <= 80 else {
                    state = .error(message: "Search for a town using up to 80 characters.")
                    return
                }
                let response: PulseAreaSearchResponse = try await api.request(PulseEndpoints.searchAreas(query: query))
                areas = response.areas.filter { $0.kind == "town" }
            } else {
                let response: PulseMyAreasResponse = try await api.request(PulseEndpoints.myAreas())
                areas = [
                    response.town,
                    response.homeVerified == true ? response.neighborhood : nil,
                    response.homeVerified == true ? response.street : nil
                ].compactMap { $0 }
            }
            guard request == generation, !Task.isCancelled else { return }
            var seen = Set<String>()
            let choices = areas.compactMap(Self.choice).filter { seen.insert($0.id).inserted }
            state = choices.isEmpty ? .empty : .loaded(choices)
        } catch is CancellationError {
            return
        } catch {
            guard request == generation, !Task.isCancelled else { return }
            state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't load areas. Please try again.")
        }
    }

    private static func choice(_ area: PulseAreaDTO) -> PulseAreaChoice? {
        guard let id = area.id, UUID(uuidString: id) != nil,
              let kind = area.kind, ["town", "neighborhood", "street"].contains(kind),
              let title = [area.title, area.name].compactMap({ $0?.trimmingCharacters(in: .whitespacesAndNewlines) })
              .first(where: { !$0.isEmpty }) else { return nil }
        let detail = kind == "town" ? (area.state ?? "Town") : kind.capitalized
        return PulseAreaChoice(id: id, title: title, detail: detail)
    }
}
