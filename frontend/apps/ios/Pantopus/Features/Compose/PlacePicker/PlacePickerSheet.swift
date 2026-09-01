//
//  PlacePickerSheet.swift
//  Pantopus
//
//  Instagram-style "Add location" picker, shared by the Pulse composer
//  and the Beacon broadcast composer. A searchable bottom sheet: nearby
//  named POIs + the enclosing locality around the active anchor (media
//  capture location when geotagged media is attached — switchable via
//  the "Photo location" / "Near me" chips — the device fix otherwise),
//  with a debounced place search on top. Chrome mirrors
//  `TimezoneSelectorSheet` (header w/ Done, sunken search field,
//  overline section headers, bordered list card).
//

import SwiftUI

/// Searchable nearby-place picker. The parent owns the selected tag and
/// applies it in `onSelect`; `onRemove` clears an existing tag.
public struct PlacePickerSheet: View {
    @State private var viewModel: PlacePickerViewModel

    private let currentTag: PostPlaceTag?
    private let onSelect: (PostPlaceTag) -> Void
    private let onRemove: () -> Void
    private let onDismiss: () -> Void

    /// - Parameter mediaLocation: capture location of the composer's
    ///   first geotagged attachment. Non-nil renders the "Photo
    ///   location" / "Near me" anchor chips with the photo anchor
    ///   selected by default; nil keeps today's device-fix flow with
    ///   zero visual delta.
    public init(
        currentTag: PostPlaceTag?,
        mediaLocation: MediaCaptureLocation? = nil,
        onSelect: @escaping (PostPlaceTag) -> Void,
        onRemove: @escaping () -> Void,
        onDismiss: @escaping () -> Void
    ) {
        _viewModel = State(initialValue: PlacePickerViewModel(mediaLocation: mediaLocation))
        self.currentTag = currentTag
        self.onSelect = onSelect
        self.onRemove = onRemove
        self.onDismiss = onDismiss
    }

    /// Test / preview seam — accept a pre-built view-model.
    init(
        viewModel: PlacePickerViewModel,
        currentTag: PostPlaceTag? = nil,
        onSelect: @escaping (PostPlaceTag) -> Void = { _ in },
        onRemove: @escaping () -> Void = {},
        onDismiss: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.currentTag = currentTag
        self.onSelect = onSelect
        self.onRemove = onRemove
        self.onDismiss = onDismiss
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            searchField
            if viewModel.hasMediaAnchor {
                anchorChips
            }
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Spacing.s2) {
                    listArea
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s6)
            }
        }
        .background(Theme.Color.appSurface)
        .task { await viewModel.load() }
        .accessibilityIdentifier("placePickerSheet")
    }

    // MARK: - Chrome

    private var header: some View {
        ZStack {
            Text("Add location")
                .pantopusTextStyle(.body)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.appText)
            HStack {
                Spacer()
                Button("Done", action: onDismiss)
                    .font(Theme.Font.small)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.primary600)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s3)
    }

    private var searchField: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 16, color: Theme.Color.appTextSecondary)
            TextField("Search restaurants, cafés, landmarks…", text: $viewModel.searchText)
                .font(Theme.Font.body)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityIdentifier("placePickerSearchField")
            if !viewModel.searchText.isEmpty {
                Button { viewModel.searchText = "" } label: {
                    Icon(.x, size: 16, color: Theme.Color.appTextMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s2)
    }

    /// Anchor chips — rendered only when geotagged media supplied a
    /// capture location. "Photo location" anchors the nearby list +
    /// search proximity on the media's capture point; "Near me" on the
    /// device fix (falling back to the search-only hint when no fix
    /// resolves, while this chip row stays live).
    private var anchorChips: some View {
        HStack(spacing: Spacing.s2) {
            anchorChip(.media, label: "Photo location", identifier: "placePickerAnchorPhoto")
            anchorChip(.current, label: "Near me", identifier: "placePickerAnchorCurrent")
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s2)
    }

    /// Selectable pill mirroring the composer's `chipPill` styling.
    private func anchorChip(
        _ anchor: PlacePickerAnchor,
        label: String,
        identifier: String
    ) -> some View {
        let isActive = viewModel.activeAnchor == anchor
        return Button {
            Task { await viewModel.selectAnchor(anchor) }
        } label: {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 30)
                .background(isActive ? Theme.Color.primary600 : Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                        .stroke(isActive ? .clear : Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier(identifier)
    }

    // MARK: - List area

    @ViewBuilder
    private var listArea: some View {
        if currentTag != nil {
            removeRow
        }
        switch viewModel.state {
        case .loading:
            skeletonRows
        case let .loaded(nearby, locality):
            nearbySection(nearby: nearby, locality: locality)
        case let .searchResults(places):
            sectionHeader("Results")
            listCard(places)
        case .empty:
            EmptyState(
                icon: .searchX,
                headline: "No places found",
                subcopy: "Try a different name, or search a nearby street or landmark."
            )
            .frame(maxWidth: .infinity)
            .padding(.top, Spacing.s4)
        case let .error(message):
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load places",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") {
                    await viewModel.refresh()
                }
            )
            .frame(maxWidth: .infinity)
            .padding(.top, Spacing.s4)
        }
    }

    @ViewBuilder
    private func nearbySection(nearby: [GeoPlace], locality: GeoPlace?) -> some View {
        if viewModel.isSearchOnly {
            searchOnlyHint
        } else if nearby.isEmpty, locality == nil {
            EmptyState(
                icon: .mapPin,
                headline: "No places nearby",
                subcopy: "Search for a restaurant, café, or landmark instead."
            )
            .frame(maxWidth: .infinity)
            .padding(.top, Spacing.s4)
        } else {
            sectionHeader("Nearby")
            listCard(nearby, locality: locality)
        }
    }

    /// No device fix — nudge toward the search field instead of showing
    /// an empty NEARBY section.
    private var searchOnlyHint: some View {
        Text("Turn on location access to see nearby places, or search above.")
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, Spacing.s2)
            .padding(.horizontal, Spacing.s1)
    }

    /// Shimmer rows mirroring the loaded row geometry.
    private var skeletonRows: some View {
        VStack(spacing: Spacing.s2) {
            Shimmer(width: 72, height: 12, cornerRadius: Radii.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
            ForEach(0..<5, id: \.self) { _ in
                Shimmer(height: 52, cornerRadius: Radii.md)
            }
        }
        .padding(.top, Spacing.s2)
        .accessibilityIdentifier("placePickerSkeleton")
    }

    private var removeRow: some View {
        Button(action: onRemove) {
            HStack(spacing: Spacing.s2) {
                Icon(.mapPinOff, size: 16, strokeWidth: 2, color: Theme.Color.error)
                Text("Remove location")
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.error)
                Spacer(minLength: Spacing.s2)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("placePickerRemoveRow")
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .pantopusTextStyle(.overline)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.top, Spacing.s2)
            .padding(.horizontal, Spacing.s1)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Bordered list card: POI rows, then the locality row when present.
    private func listCard(_ places: [GeoPlace], locality: GeoPlace? = nil) -> some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(places.enumerated()), id: \.element.id) { index, place in
                row(for: place, identifier: "placePickerRow_\(index)")
                if index < places.count - 1 || locality != nil {
                    divider
                }
            }
            if let locality {
                row(for: locality, identifier: "placePickerLocalityRow")
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    private var divider: some View {
        Divider()
            .overlay(Theme.Color.appBorder)
            .padding(.leading, Spacing.s4)
    }

    // MARK: - Row

    private func row(for place: GeoPlace, identifier: String) -> some View {
        Button {
            onSelect(PostPlaceTag(place: place))
        } label: {
            HStack(spacing: Spacing.s3) {
                Icon(.mapPin, size: 16, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(place.name)
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                    if let secondary = secondaryLine(for: place) {
                        Text(secondary)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s2)
                if let distance = place.distanceM {
                    Text(Self.distanceLabel(meters: distance))
                        .pantopusTextStyle(.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .frame(minHeight: 44)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(place.name)
        .accessibilityIdentifier(identifier)
    }

    /// Address first, category fallback ("coffee shop, cafe"), locality
    /// full line last.
    private func secondaryLine(for place: GeoPlace) -> String? {
        if let address = place.address, !address.isEmpty { return address }
        if let category = place.category, !category.isEmpty { return category }
        if let full = place.fullAddress, !full.isEmpty, full != place.name { return full }
        return nil
    }

    /// "450 ft" under a tenth of a mile, "0.3 mi" beyond.
    static func distanceLabel(meters: Double) -> String {
        let miles = meters / 1609.34
        if miles < 0.1 {
            return "\(Int((meters * 3.28084).rounded())) ft"
        }
        return String(format: "%.1f mi", miles)
    }
}

#if DEBUG
#Preview {
    PlacePickerSheet(
        currentTag: PostPlaceTag(
            name: "Joe's Coffee",
            address: "123 Elm St",
            latitude: 45.52,
            longitude: -122.68,
            placeId: "poi.123",
            kind: "poi"
        ),
        onSelect: { _ in },
        onRemove: {},
        onDismiss: {}
    )
}
#endif
