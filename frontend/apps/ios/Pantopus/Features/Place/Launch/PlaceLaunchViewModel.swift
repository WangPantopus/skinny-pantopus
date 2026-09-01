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
        suggestions = []
        PlacePendingStore.stash(suggestion)
        loadPreview(address: suggestion.label)
    }

    func loadPreview(address: String) {
        lookupTask?.cancel()
        isLoadingPreview = true
        lookupTask = Task { [weak self] in
            guard let self else { return }
            defer { self.isLoadingPreview = false }
            do {
                let preview: PlacePreview = try await api.request(PlaceEndpoints.publicPreview(address: address))
                guard !Task.isCancelled else { return }
                if preview.status == .unsupportedRegion {
                    step = .region(message: preview.message ?? "Home features are coming to your region.")
                } else {
                    step = .preview(preview)
                }
            } catch {
                // Stay on the hero; the field keeps the typed address.
            }
        }
    }

    func backToHero() {
        step = .hero
    }
}

// MARK: - Pending place stash (the funnel → post-signup bridge)

/// The signed-out preview is non-persistent (the §4 anti-leak rule), so
/// when a stranger hits the wall we stash the resolved address locally
/// and save it once they land back in the authed app. UserDefaults keyed,
/// consumed once. Mirrors the web sessionStorage `pendingPlace`.
enum PlacePendingStore {
    private static let key = "pantopus_pending_place"

    struct Pending: Codable {
        let street: String
        let city: String
        let state: String
        let zip: String
        let latitude: Double?
        let longitude: Double?
    }

    /// Build the structured pending place from a geo suggestion. The
    /// `secondary_text` is "City, ST, ZIP" (Mapbox); `primary_text` is
    /// the street line.
    static func stash(_ suggestion: GeoSuggestion) {
        let parts = (suggestion.secondaryText ?? "")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
        let pending = Pending(
            street: suggestion.primaryText,
            city: parts.first ?? "",
            state: parts.count > 1 ? parts[1] : "",
            zip: parts.count > 2 ? parts[2] : "",
            latitude: suggestion.latitude,
            longitude: suggestion.longitude
        )
        if let data = try? JSONEncoder().encode(pending) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    /// Read and CONSUME the pending place (one-shot).
    static func take() -> Pending? {
        guard let data = UserDefaults.standard.data(forKey: key),
              let pending = try? JSONDecoder().decode(Pending.self, from: data) else { return nil }
        UserDefaults.standard.removeObject(forKey: key)
        return pending
    }
}
