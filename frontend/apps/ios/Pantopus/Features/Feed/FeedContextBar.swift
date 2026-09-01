//
//  FeedContextBar.swift
//  Pantopus
//
//  The Nearby feed's viewing-location switcher. RN renders this as
//  `ContextBar` above the topic row (`FeedScreen.tsx:151-155`) and opens
//  `ContextSheet` on tap, which lists the viewer's homes, saved places
//  and recent locations plus a radius picker.
//
//  Backend: `GET /api/location` (`backend/routes/location.js:89`),
//  `PUT /api/location` (`backend/routes/location.js:149`),
//  `PUT /api/location/radius` (`backend/routes/location.js:268`),
//  `GET /api/saved-places` (`backend/routes/savedPlaces.js:8`).
//

import Foundation
import Observation
import SwiftUI

// MARK: - Row model

/// One selectable place in the switcher sheet.
public struct FeedLocationOption: Identifiable, Sendable, Hashable {
    /// Which list the row came from — drives the icon and the `type`
    /// sent on `PUT /api/location`.
    public enum Kind: String, Sendable, Hashable {
        case home, savedPlace, recent

        /// `type` value accepted by `setLocationSchema`.
        var backendType: String {
            switch self {
            case .home: "home"
            case .savedPlace: "searched"
            case .recent: "recent"
            }
        }

        var icon: PantopusIcon {
            switch self {
            case .home: .home
            case .savedPlace: .bookmark
            case .recent: .history
            }
        }

        var sectionTitle: String {
            switch self {
            case .home: "Your homes"
            case .savedPlace: "Saved places"
            case .recent: "Recent"
            }
        }
    }

    public let id: String
    public let kind: Kind
    public let label: String
    public let subtitle: String?
    public let latitude: Double
    public let longitude: Double
    /// Backend row id echoed back as `sourceId`.
    public let sourceId: String?
    public let city: String?
    public let state: String?
}

// MARK: - View model

/// Loads the viewing location + its switcher sources, and writes the
/// user's pick back to `/api/location`.
@Observable
@MainActor
public final class FeedContextBarViewModel {
    public enum SheetState: Sendable {
        case loading
        case loaded([FeedLocationOption])
        case empty
        case error(message: String)
    }

    /// Label rendered on the collapsed bar. `nil` shows "Set an area".
    public private(set) var locationLabel: String?
    /// Active radius in miles. Defaults to the RN default of 100.
    public private(set) var radiusMiles: Double = 100
    public private(set) var sheetState: SheetState = .loading
    /// True while the sheet is presented.
    public var isSheetPresented = false
    /// Transient error surfaced by a failed write.
    public var toastMessage: String?

    private let api: APIClient
    /// Raised after a successful switch so the feed refetches.
    private let onChange: @MainActor () -> Void

    init(api: APIClient = .shared, onChange: @escaping @MainActor () -> Void = {}) {
        self.api = api
        self.onChange = onChange
    }

    /// Read the active viewing location for the collapsed bar.
    public func load() async {
        let payload: ViewingLocationPayload? = try? await api.request(
            ViewingLocationEndpoints.current()
        )
        applyCurrent(payload?.viewingLocation)
    }

    /// Open the switcher and (re)load its three source lists.
    public func openSwitcher() async {
        isSheetPresented = true
        sheetState = .loading
        do {
            let payload: ViewingLocationPayload = try await api.request(
                ViewingLocationEndpoints.current()
            )
            applyCurrent(payload.viewingLocation)
            // Saved places live on their own route; a failure there just
            // drops that section rather than blanking the sheet.
            let saved: SavedPlacesListResponse? = try? await api.request(
                SavedPlacesEndpoints.list()
            )
            let options = Self.options(payload: payload, savedPlaces: saved?.savedPlaces ?? [])
            sheetState = options.isEmpty ? .empty : .loaded(options)
        } catch {
            sheetState = .error(
                message: (error as? APIError)?.errorDescription ?? "Couldn't load your places."
            )
        }
    }

    /// Write the pick to `PUT /api/location` and refresh the feed.
    public func select(_ option: FeedLocationOption) async {
        let request = SetViewingLocationRequest(
            type: option.kind.backendType,
            label: option.label,
            latitude: option.latitude,
            longitude: option.longitude,
            radiusMiles: radiusMiles,
            isPinned: false,
            sourceId: option.sourceId,
            city: option.city,
            state: option.state
        )
        do {
            let response: SetViewingLocationResponse = try await api.request(
                ViewingLocationEndpoints.set(request)
            )
            applyCurrent(response.viewingLocation)
            if response.viewingLocation == nil { locationLabel = option.label }
            isSheetPresented = false
            onChange()
        } catch {
            toastMessage = (error as? APIError)?.errorDescription
                ?? "Couldn't switch your area."
        }
    }

    /// Apply a radius the suggestion banner proposed.
    /// `PUT /api/location/radius` 404s when nothing is set yet — treated
    /// as a soft failure so the banner just goes away.
    @discardableResult
    public func applyRadius(_ miles: Double) async -> Bool {
        let previous = radiusMiles
        radiusMiles = miles
        do {
            let response: SetViewingRadiusResponse = try await api.request(
                ViewingLocationEndpoints.setRadius(miles: miles)
            )
            radiusMiles = response.radiusMiles ?? miles
            onChange()
            return true
        } catch {
            radiusMiles = previous
            toastMessage = (error as? APIError)?.errorDescription
                ?? "Couldn't change your radius."
            return false
        }
    }

    private func applyCurrent(_ dto: ViewingLocationDTO?) {
        guard let dto else { return }
        locationLabel = dto.label
        if let miles = dto.radiusMiles { radiusMiles = miles }
    }

    /// Flatten the three sources into one ordered option list —
    /// homes, then saved places, then recents (RN `ContextSheet` order).
    static func options(
        payload: ViewingLocationPayload,
        savedPlaces: [SavedPlaceDTO]
    ) -> [FeedLocationOption] {
        var options: [FeedLocationOption] = []
        for home in payload.homes {
            guard let lat = home.latitude, let lon = home.longitude else { continue }
            options.append(FeedLocationOption(
                id: "home-\(home.id)",
                kind: .home,
                label: home.name ?? "Home",
                subtitle: locality(city: home.city, state: home.state),
                latitude: lat,
                longitude: lon,
                sourceId: home.id,
                city: home.city,
                state: home.state
            ))
        }
        for place in savedPlaces {
            options.append(FeedLocationOption(
                id: "saved-\(place.id)",
                kind: .savedPlace,
                label: place.label,
                subtitle: locality(city: place.city, state: place.state),
                latitude: place.latitude,
                longitude: place.longitude,
                sourceId: place.id,
                city: place.city,
                state: place.state
            ))
        }
        for recent in payload.recentLocations {
            options.append(FeedLocationOption(
                id: "recent-\(recent.id)",
                kind: .recent,
                label: recent.label,
                subtitle: locality(city: recent.city, state: recent.state),
                latitude: recent.latitude,
                longitude: recent.longitude,
                sourceId: recent.sourceId,
                city: recent.city,
                state: recent.state
            ))
        }
        return options
    }

    private static func locality(city: String?, state: String?) -> String? {
        let parts = [city, state].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }
}

// MARK: - Collapsed bar

/// Tappable pill above the Nearby feed showing the active area.
struct FeedContextBar: View {
    @Bindable var viewModel: FeedContextBarViewModel

    var body: some View {
        Button {
            Task { await viewModel.openSwitcher() }
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.mapPin, size: 16, strokeWidth: 2.2, color: Theme.Color.primary600)
                Text(viewModel.locationLabel ?? "Set an area")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Spacer(minLength: Spacing.s2)
                Text(FeedRadiusSuggestion.formatRadius(viewModel.radiusMiles))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 2)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(Capsule())
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s2)
        .accessibilityIdentifier("pulseContextBar")
        .accessibilityLabel("Viewing \(viewModel.locationLabel ?? "no area yet"). Change area")
        .sheet(isPresented: $viewModel.isSheetPresented) {
            FeedLocationSwitcherSheet(viewModel: viewModel)
        }
    }
}

// MARK: - Switcher sheet

/// Home / saved-place / recent picker. Four render states per the
/// project's state rule.
struct FeedLocationSwitcherSheet: View {
    @Bindable var viewModel: FeedContextBarViewModel

    var body: some View {
        NavigationStack {
            Group {
                switch viewModel.sheetState {
                case .loading:
                    VStack(alignment: .leading, spacing: Spacing.s3) {
                        ForEach(0..<4, id: \.self) { _ in
                            Shimmer(height: 56, cornerRadius: Radii.md)
                        }
                        Spacer()
                    }
                    .padding(Spacing.s4)
                    .accessibilityIdentifier("pulseLocationSwitcherSkeleton")
                case let .loaded(options):
                    List {
                        ForEach(FeedLocationOption.Kind.allSections, id: \.rawValue) { kind in
                            let rows = options.filter { $0.kind == kind }
                            if !rows.isEmpty {
                                Section(kind.sectionTitle) {
                                    ForEach(rows) { option in row(option) }
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .accessibilityIdentifier("pulseLocationSwitcherList")
                case .empty:
                    EmptyState(
                        icon: .mapPinOff,
                        headline: "No places to switch to",
                        subcopy: "Add a home or save a place and it will show up here.",
                        cta: nil
                    )
                    .accessibilityIdentifier("pulseLocationSwitcherEmpty")
                case let .error(message):
                    EmptyState(
                        icon: .alertCircle,
                        headline: "Couldn't load your places",
                        subcopy: message,
                        cta: EmptyState.CTA(title: "Try again") {
                            await viewModel.openSwitcher()
                        }
                    )
                    .accessibilityIdentifier("pulseLocationSwitcherError")
                }
            }
            .background(Theme.Color.appBg)
            .navigationTitle("Viewing area")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { viewModel.isSheetPresented = false }
                        .accessibilityIdentifier("pulseLocationSwitcherDone")
                }
            }
        }
    }

    private func row(_ option: FeedLocationOption) -> some View {
        Button {
            Task { await viewModel.select(option) }
        } label: {
            HStack(spacing: Spacing.s3) {
                Icon(option.kind.icon, size: 18, color: Theme.Color.primary600)
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.label)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    if let subtitle = option.subtitle {
                        Text(subtitle)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s2)
                if viewModel.locationLabel == option.label {
                    Icon(.check, size: 16, color: Theme.Color.success)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("pulseLocationOption_\(option.id)")
    }
}

extension FeedLocationOption.Kind {
    /// Section order rendered by the switcher.
    static var allSections: [FeedLocationOption.Kind] {
        [.home, .savedPlace, .recent]
    }
}
