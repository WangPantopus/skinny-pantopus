//
//  PlaceLaunchViewModel.swift
//  Pantopus
//
//  Drives the signed-out acquisition funnel (A1 → A2 → C0 → A6): the
//  address typeahead (GET /api/geo/autocomplete, keyless), the anonymous
//  T0 preview (GET /api/public/place), and the non-US "coming to your
//  region" branch. The selected place is stashed (PlacePendingStore) so
//  the funnel's "Create account" wall can save it after sign-up.
//

import SwiftUI

@Observable
@MainActor
final class PlaceLaunchViewModel {
    enum Step: Equatable {
        case hero
        case preview(PlacePreview)
        case region(message: String)
    }

    private(set) var step: Step = .hero
    private(set) var suggestions: [GeoSuggestion] = []
    private(set) var isLoadingPreview = false
    var query = "" {
        didSet { scheduleAutocomplete() }
    }

    private var selected: GeoSuggestion?
    var errorMessage: String?

    private let api: APIClient
    private var autocompleteTask: Task<Void, Never>?
    private var lookupTask: Task<Void, Never>?

    init(api: APIClient = .shared) {
        self.api = api
    }

    var isTyping: Bool {
        !query.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Autocomplete (debounced)

    private func scheduleAutocomplete() {
        autocompleteTask?.cancel()
        let q = query.trimmingCharacters(in: .whitespaces)
        guard q.count >= 3 else { suggestions = []
            return
        }
        autocompleteTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(220))
            guard !Task.isCancelled, let self else { return }
            await fetchSuggestions(q)
        }
    }

    private func fetchSuggestions(_ q: String) async {
        guard let response: GeoAutocompleteResponse = try? await api.request(
            GeoEndpoints.autocomplete(query: q)
        ) else { return }
        guard !Task.isCancelled else { return }
        suggestions = response.suggestions
    }

    // MARK: - Selection → preview

    func select(_ suggestion: GeoSuggestion) {
        query = suggestion.label
        autocompleteTask?.cancel()
        suggestions = []
        selected = suggestion
        loadPreview(address: suggestion.label)
    }

    func loadPreview(address: String) {
        lookupTask?.cancel()
        errorMessage = nil
        isLoadingPreview = true
        lookupTask = Task { [weak self] in
            guard let self else { return }
            defer { if !Task.isCancelled { self.isLoadingPreview = false } }
            do {
                let preview: PlacePreview = try await api.request(PlaceEndpoints.publicPreview(address: address))
                guard !Task.isCancelled else { return }
                if preview.status == .unsupportedRegion {
                    step = .region(message: preview.message ?? "Home features are coming to your region.")
                } else {
                    step = .preview(preview)
                }
            } catch {
                guard !Task.isCancelled else { return }
                errorMessage = "We couldn’t load this address. Please try again."
            }
        }
    }

    func prepareForAuth() -> Bool {
        guard let selected, selected.label == query,
              PlacePendingStore.stash(selected) else {
            step = .hero
            errorMessage = "Choose an address suggestion to keep this preview through sign-in."
            return false
        }
        return true
    }

    func backToHero() {
        lookupTask?.cancel()
        isLoadingPreview = false
        PlacePendingStore.clear()
        step = .hero
    }
}
