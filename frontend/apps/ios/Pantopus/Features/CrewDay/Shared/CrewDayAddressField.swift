//
//  CrewDayAddressField.swift
//  Pantopus
//
//  Address autocomplete for Crew Day (a household's home on Your price, a
//  crew's area center on New Crew Day): the existing `/api/geo/autocomplete`
//  suggestions as you type, resolved with `/api/geo/resolve` when picked.
//

import SwiftUI

@Observable
@MainActor
final class CrewDayAddressSearch {
    private(set) var suggestions: [GeoSuggestion] = []
    private(set) var isResolving = false
    private(set) var error: String?
    private var searchTask: Task<Void, Never>?

    func search(_ query: String) {
        searchTask?.cancel()
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 3 else {
            suggestions = []
            return
        }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            let response: GeoAutocompleteResponse? = try? await APIClient.shared.request(GeoEndpoints.autocomplete(query: trimmed))
            guard !Task.isCancelled else { return }
            suggestions = response?.suggestions ?? []
        }
    }

    func resolve(_ suggestion: GeoSuggestion) async -> NormalizedAddress? {
        isResolving = true
        defer { isResolving = false }
        do {
            let response: GeoResolveResponse = try await APIClient.shared.request(
                GeoEndpoints.resolve(suggestionId: suggestion.suggestionId)
            )
            suggestions = []
            error = nil
            return response.normalized
        } catch {
            self.error = "We couldn't find that address. Pick it from the list again."
            return nil
        }
    }

    func clear() {
        searchTask?.cancel()
        suggestions = []
    }
}

struct CrewDayAddressField: View {
    @Binding var query: String
    /// The address picked from a suggestion, if any.
    let picked: NormalizedAddress?
    var placeholder = "Street address"
    let identifier: String
    let onPick: (NormalizedAddress) -> Void
    /// The text changed after an address was picked.
    let onEdit: () -> Void
    @State private var search = CrewDayAddressSearch()
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Icon(.mapPin, size: 18, color: Theme.Color.appTextSecondary)
                TextField(placeholder, text: $query)
                    .planFont(.body)
                    .textContentType(.fullStreetAddress)
                    .autocorrectionDisabled()
                    .focused($focused)
                    .accessibilityIdentifier(identifier)
                if search.isResolving { ProgressView() }
                if picked != nil {
                    Icon(.checkCircle, size: 18, color: Theme.Color.success)
                        .accessibilityLabel("Address found")
                }
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 48)
            .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(focused ? Theme.Color.primary600 : Theme.Color.appBorderStrong, lineWidth: 1)
            )
            .onChange(of: query) { _, value in
                if let picked, value == picked.address { return }
                if picked != nil { onEdit() }
                search.search(value)
            }
            if !search.suggestions.isEmpty, picked == nil {
                VStack(spacing: 0) {
                    ForEach(search.suggestions) { suggestion in
                        Button {
                            Task {
                                if let address = await search.resolve(suggestion) {
                                    focused = false
                                    onPick(address)
                                }
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(suggestion.primaryText).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                                if let secondary = suggestion.secondaryText {
                                    Text(secondary).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                                }
                            }
                            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                            .padding(.horizontal, Spacing.s3)
                            .padding(.vertical, Spacing.s2)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("\(identifier)Suggestion")
                        Divider().overlay(Theme.Color.appBorderSubtle)
                    }
                }
                .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
            }
            if let error = search.error {
                Text(error).planFont(.footnote).foregroundStyle(Theme.Color.error)
            }
        }
    }
}
