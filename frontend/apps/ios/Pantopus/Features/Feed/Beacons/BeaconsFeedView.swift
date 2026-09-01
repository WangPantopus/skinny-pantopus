//
//  BeaconsFeedView.swift
//  Pantopus
//
//  A03.2 — Beacon Updates. Broadcasts from verified beacons (businesses,
//  civic accounts, neighbors-as-creators) the user follows. The design
//  (docs/designs/A03/beacons-frames.jsx) renders the Pulse archetype
//  parametrized to `surface=personas` — same chrome, chip row, card recipe,
//  FAB, and tab bar — so this view reuses `FeedView` with a `.beacons`
//  `PulseFeedViewModel`. Only the title, verified floor, and empty state
//  diverge, all driven by `FeedSurface.beacons`.
//
//  Reached from the AudienceProfile "Beacon Updates" entry and the
//  `pantopus://beacons` deep link.
//

import SwiftUI

/// Beacon Updates feed entry point. A thin wrapper over the shared
/// `FeedView`; the surface-parametrized `PulseFeedViewModel` supplies the
/// `surface=personas` query, the all-verified author floor, and the
/// rss-glyph empty state.
public struct BeaconsFeedView: View {
    @State private var viewModel: PulseFeedViewModel
    private let onOpenPost: @MainActor (String) -> Void
    private let onCompose: @MainActor (PulseIntent) -> Void
    private let onDiscover: @MainActor () -> Void
    private let onBack: (@MainActor () -> Void)?

    init(
        viewModel: PulseFeedViewModel? = nil,
        onOpenPost: @escaping @MainActor (String) -> Void = { _ in },
        onCompose: @escaping @MainActor (PulseIntent) -> Void = { _ in },
        onDiscover: @escaping @MainActor () -> Void = {},
        onBack: (@MainActor () -> Void)? = nil
    ) {
        // Avoid default-arg `PulseFeedViewModel(surface: .beacons)` — crashes Swift 5.10 SIL gen.
        _viewModel = State(initialValue: viewModel ?? PulseFeedViewModel(surface: .beacons))
        self.onOpenPost = onOpenPost
        self.onCompose = onCompose
        self.onDiscover = onDiscover
        self.onBack = onBack
    }

    public var body: some View {
        FeedView(
            viewModel: viewModel,
            onOpenPost: onOpenPost,
            onCompose: onCompose,
            onEmptyCTA: onDiscover,
            onBack: onBack
        )
        .accessibilityIdentifier("beaconsFeed")
    }
}

#Preview {
    BeaconsFeedView()
}
