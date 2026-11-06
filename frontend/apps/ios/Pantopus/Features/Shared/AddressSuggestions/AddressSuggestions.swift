//
//  AddressSuggestions.swift
//  Pantopus
//
//  Address suggestions under a street field. Typing asks
//  `GET /api/geo/autocomplete` (debounced); picking one resolves it with
//  `POST /api/geo/resolve` so the form can fill its street, city, state
//  and ZIP. The field itself stays the screen's own, so every form keeps
//  its look; this adds the list under it. A failed lookup just shows no
//  list: the field still takes a typed address.
//  Parity: Android `AddressSuggestions` (ui/components/AddressSuggestions.kt).
//

import SwiftUI

@Observable
@MainActor
final class AddressSuggestions {
    private(set) var suggestions: [GeoSuggestion] = []
    private(set) var isResolving = false
    /// Favor suggestions near this point, e.g. the person's own home when
    /// they type a neighbor's address.
    var near: (latitude: Double, longitude: Double)?

    private let streetOnly: Bool
    private let api: APIClient
    private var searchTask: Task<Void, Never>?
    /// The address a pick wrote into the field: an answer, not a new question.
    private var pickedText: String?

    init(streetOnly: Bool = true, api: APIClient = .shared) {
        self.streetOnly = streetOnly
        self.api = api
    }

    /// Call on every change of the street field's text.
    func textChanged(_ text: String) {
        searchTask?.cancel()
        let query = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard query.count >= 4, text != pickedText else {
            suggestions = []
            return
        }
        pickedText = nil
        searchTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled, let self else { return }
            await fetch(query)
        }
    }

    private func fetch(_ query: String) async {
        let response: GeoAutocompleteResponse? = try? await api.request(
            GeoEndpoints.autocomplete(query: query, near: near, streetOnly: streetOnly)
        )
        guard !Task.isCancelled else { return }
        suggestions = response?.suggestions ?? []
    }

    /// Resolves a picked suggestion into its parts; nil when it can't be
    /// resolved, and the typed text stays as it was.
    func choose(_ suggestion: GeoSuggestion) async -> NormalizedAddress? {
        guard suggestions.contains(suggestion), !isResolving else { return nil }
        searchTask?.cancel()
        isResolving = true
        defer { isResolving = false }
        guard let result: GeoResolveResponse = try? await api.request(
            GeoEndpoints.resolve(suggestionId: suggestion.suggestionId)
        ) else { return nil }
        suggestions = []
        pickedText = result.normalized.address
        return result.normalized
    }

    func dismiss() {
        searchTask?.cancel()
        suggestions = []
    }

    /// One of your homes' map point, for `near`; nil when it isn't known.
    static func homePoint(homeId: String) async -> (latitude: Double, longitude: Double)? {
        guard let homes = try? await HomesStoreReads.myHomes().value.homes,
              let point = homes.first(where: { $0.home.id == homeId })?.location else { return nil }
        return (point.latitude, point.longitude)
    }
}

/// The suggestions under a street field; tapping one hands it to `onChoose`.
struct AddressSuggestionList: View {
    let suggestions: AddressSuggestions
    /// Prefix for each row's accessibility identifier (`<prefix>.<index>`).
    let identifier: String
    let onChoose: (GeoSuggestion) -> Void

    var body: some View {
        if !suggestions.suggestions.isEmpty {
            VStack(spacing: Spacing.s0) {
                ForEach(Array(suggestions.suggestions.enumerated()), id: \.element.id) { index, suggestion in
                    if index > 0 {
                        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                    }
                    Button { onChoose(suggestion) } label: { row(suggestion) }
                        .buttonStyle(.plain)
                        .disabled(suggestions.isResolving)
                        .accessibilityLabel(
                            [suggestion.primaryText, suggestion.secondaryText].compactMap { $0 }.joined(separator: ", ")
                        )
                        .accessibilityIdentifier("\(identifier).\(index)")
                }
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
    }

    private func row(_ suggestion: GeoSuggestion) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(.mapPin, size: 15, color: Theme.Color.appTextSecondary)
                .frame(width: 32, height: 32)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(suggestion.primaryText)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
                if let secondary = suggestion.secondaryText, !secondary.isEmpty {
                    Text(secondary)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(minHeight: 48)
        .contentShape(Rectangle())
    }
}
