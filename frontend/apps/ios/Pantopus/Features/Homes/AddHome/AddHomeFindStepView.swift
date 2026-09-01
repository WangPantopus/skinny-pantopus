//
//  AddHomeFindStepView.swift
//  Pantopus
//
//  A12.1 search-first entry step for the Add Home wizard.
//

import SwiftUI

// MARK: - Step 1: Find

struct AddressStep: View {
    @Bindable var viewModel: AddHomeWizardViewModel

    var body: some View {
        HeadlineBlock("Where do you live?")
        SubcopyBlock("Pick your address to start. You'll verify it next.")
        VStack(alignment: .leading, spacing: Spacing.s3) {
            AddHomeSearchField(
                query: searchBinding,
                onClear: viewModel.clearSearchQuery
            )
            if viewModel.showsAutocomplete {
                AddHomeAutocompleteDropdown(
                    query: viewModel.homeSearchQuery,
                    results: viewModel.autocompleteResults,
                    onSelect: viewModel.selectAddressCandidate,
                    onAddManually: viewModel.addManuallyTapped
                )
            } else {
                UseCurrentLocationPill(action: viewModel.useCurrentLocation)
                NearbyHomesSection(
                    homes: viewModel.nearbyHomes,
                    selectedHomeID: viewModel.selectedHomeID,
                    onSelect: viewModel.selectAddressCandidate
                )
                ManualAddressButton(action: viewModel.addManuallyTapped)
            }
        }
    }

    private var searchBinding: Binding<String> {
        Binding(
            get: { viewModel.homeSearchQuery },
            set: { viewModel.updateSearchQuery($0) }
        )
    }
}

private struct AddHomeSearchField: View {
    @Binding var query: String
    let onClear: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 18, color: query.isEmpty ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
            TextField(
                "",
                text: $query,
                prompt: Text("Search by address or nearby…")
                    .foregroundColor(Theme.Color.primary600)
            )
            .font(Theme.Font.body)
            .foregroundStyle(Theme.Color.appText)
            .textInputAutocapitalization(TextInputAutocapitalization.words)
            .autocorrectionDisabled()
            .accessibilityLabel("Search by address or nearby")
            .accessibilityIdentifier("addHomeSearchInput")

            if !query.isEmpty {
                Button(action: onClear) {
                    Icon(.x, size: 14, color: Theme.Color.appTextSecondary)
                        .frame(width: 24, height: 24)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
                .accessibilityIdentifier("addHome_clearSearch")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .frame(minHeight: 48)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(query.isEmpty ? Theme.Color.appBorder : Theme.Color.primary600, lineWidth: query.isEmpty ? 1 : 2)
        )
        .accessibilityIdentifier("addHomeSearchField")
    }
}

private struct UseCurrentLocationPill: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(.mapPin, size: 16, color: Theme.Color.primary700)
                Text("Use current location")
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.primary700)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.primary50)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .stroke(Theme.Color.primary100, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Use current location")
        .accessibilityIdentifier("addHome_useCurrentLocation")
    }
}

private struct NearbyHomesSection: View {
    let homes: [AddHomeAddressCandidate]
    let selectedHomeID: String?
    let onSelect: (AddHomeAddressCandidate) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s1) {
                Icon(.mapPin, size: 12, color: Theme.Color.appTextSecondary)
                Text("Nearby · Brooklyn, NY")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            VStack(spacing: Spacing.s2) {
                ForEach(homes) { home in
                    NearbyHomeRow(
                        home: home,
                        isSelected: selectedHomeID == home.id
                    ) {
                        onSelect(home)
                    }
                }
            }
        }
    }
}

private struct NearbyHomeRow: View {
    let home: AddHomeAddressCandidate
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .fill(isSelected ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
                    Icon(.home, size: 18, color: isSelected ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                }
                .frame(width: 40, height: 40)
                .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(home.line1)
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    HStack(spacing: Spacing.s1) {
                        Text(home.line2)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        if let distance = home.distance {
                            Text("·")
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .accessibilityHidden(true)
                            Text(distance)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                StatusPill(status: home.status)
                if isSelected {
                    Icon(.check, size: 16, color: Theme.Color.primary600)
                        .frame(width: 24, height: 24)
                        .accessibilityHidden(true)
                }
            }
            .padding(Spacing.s3)
            .frame(minHeight: 64)
            .background(isSelected ? Theme.Color.primary50 : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(isSelected ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(home.isClaimed)
        .accessibilityLabel("\(home.line1), \(home.secondaryLine), \(home.status.label)")
        .accessibilityHint(home.isClaimed ? "Already claimed" : "Select this home")
        .accessibilityIdentifier("addHome_nearby_\(home.id)")
    }
}

private struct StatusPill: View {
    let status: AddHomeAddressStatus

    var body: some View {
        Text(status.label)
            .pantopusTextStyle(.caption)
            .fontWeight(.semibold)
            .foregroundStyle(status == .available ? Theme.Color.success : Theme.Color.appTextSecondary)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s1)
            .background(status == .available ? Theme.Color.successBg : Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }
}

private struct AddHomeAutocompleteDropdown: View {
    let query: String
    let results: [AddHomeAddressCandidate]
    let onSelect: (AddHomeAddressCandidate) -> Void
    let onAddManually: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(spacing: Spacing.s1) {
                Icon(.search, size: 10, color: Theme.Color.appTextMuted)
                Text("\(results.count) matches")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurfaceMuted)

            ForEach(Array(results.enumerated()), id: \.element.id) { index, result in
                AutocompleteRow(
                    candidate: result,
                    query: query,
                    onSelect: { onSelect(result) },
                    identifier: "addHome_autocomplete_\(index)"
                )
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            }

            ManualFallbackRow(action: onAddManually)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

private struct AutocompleteRow: View {
    let candidate: AddHomeAddressCandidate
    let query: String
    let onSelect: () -> Void
    let identifier: String

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: Spacing.s3) {
                Icon(.mapPin, size: 15, color: Theme.Color.appTextSecondary)
                    .frame(width: 32, height: 32)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    highlighted(candidate.line1, query: query)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .lineLimit(1)
                    Text(candidate.secondaryLine)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .frame(minHeight: 56)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(candidate.line1), \(candidate.secondaryLine)")
        .accessibilityIdentifier(identifier)
    }

    private func highlighted(_ value: String, query: String) -> Text {
        let ranges = highlightRanges(in: value, query: query)
        guard !ranges.isEmpty else { return Text(value) }

        var currentIndex = value.startIndex
        var pieces: [Text] = []
        for range in ranges {
            if currentIndex < range.lowerBound {
                pieces.append(Text(String(value[currentIndex..<range.lowerBound])))
            }
            pieces.append(Text(String(value[range])).fontWeight(.bold))
            currentIndex = range.upperBound
        }
        if currentIndex < value.endIndex {
            pieces.append(Text(String(value[currentIndex..<value.endIndex])))
        }
        return pieces.reduce(Text("")) { partial, piece in
            partial + piece
        }
    }

    private func highlightRanges(in value: String, query: String) -> [Range<String.Index>] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return [] }

        if let range = value.range(of: needle, options: [.caseInsensitive, .diacriticInsensitive]) {
            return [range]
        }

        let tokens = needle.split(separator: " ").map(String.init)
        var ranges: [Range<String.Index>] = []
        for token in tokens where !token.isEmpty {
            var searchStart = value.startIndex
            while searchStart < value.endIndex,
                  let range = value.range(
                      of: token,
                      options: [.caseInsensitive, .diacriticInsensitive],
                      range: searchStart..<value.endIndex
                  ) {
                if !ranges.contains(where: { overlaps($0, range) }) {
                    ranges.append(range)
                }
                searchStart = range.upperBound
            }
        }
        return ranges.sorted { $0.lowerBound < $1.lowerBound }
    }

    private func overlaps(_ lhs: Range<String.Index>, _ rhs: Range<String.Index>) -> Bool {
        lhs.lowerBound < rhs.upperBound && rhs.lowerBound < lhs.upperBound
    }
}

private struct ManualFallbackRow: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(.plus, size: 16, color: Theme.Color.primary600)
                    .frame(width: 32, height: 32)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Add manually")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.primary700)
                    Text("We'll geocode it and mail a verification code.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 16, color: Theme.Color.primary600)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .frame(minHeight: 56)
            .background(Theme.Color.primary50)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add address manually")
        .accessibilityIdentifier("addHome_manualFallback")
    }
}

private struct ManualAddressButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(.plus, size: 14, color: Theme.Color.primary600)
                Text("Add address manually")
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.primary600)
            }
            .padding(.vertical, Spacing.s1)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("addHome_addAddressManually")
    }
}
