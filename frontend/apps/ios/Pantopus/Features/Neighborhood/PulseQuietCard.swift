//
//  PulseQuietCard.swift
//  Pantopus
//
//  Nearby's neighborhood meter and "Set up a home" prompt, moved to the top
//  of the Pulse page as one quiet-state card (Pulse S3; build spec §2). It
//  shows only while the person has no home, or while their area is still
//  forming or growing, and nothing while the meter loads, fails or once the
//  area is unlocked: the feed never waits on it. The window map (Wedge v2 §4)
//  folds open inside the card. Reads the same meter and window as the old
//  Nearby door (`NeighborhoodViewModel`).
//

import SwiftUI

struct PulseQuietCard: View {
    @State private var viewModel: NeighborhoodViewModel
    @State private var showsMap = false
    /// Starts adding a home, in the Place tab.
    private let onSetUpHome: @MainActor () -> Void

    init(viewModel: NeighborhoodViewModel = NeighborhoodViewModel(), onSetUpHome: @escaping @MainActor () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onSetUpHome = onSetUpHome
    }

    var body: some View {
        Group {
            if case let .loaded(meter) = viewModel.state {
                switch meter.state {
                case .noPlace:
                    setUpHomeCard
                case .forming, .growing:
                    meterCard(meter)
                case .unlocked:
                    EmptyView()
                }
            }
        }
        .task { await viewModel.load() }
        // A home added, claimed or verified (`homes`) can change the meter.
        .refreshesOnStoreChange(affects: { $0.names(topic: ScreenTopic.homes) }, perform: { await viewModel.load() })
    }

    // MARK: - No home

    private var setUpHomeCard: some View {
        card {
            Text("Add a home for neighborhood context")
                .pulseFont(.headline)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            // Launch cut #1 (Beacon): the copy drops Beacons for the first launch.
            Text("Adding a home gives you neighborhood context and household tools. "
                + (LaunchFeatures.beacon
                    ? "You can browse Pulse and follow Beacons before setting it up."
                    : "You can browse Pulse before setting it up."))
                .pulseFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Button(action: onSetUpHome) {
                buttonLabel("Set up a home", icon: .home)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("pulseQuietSetUpHome")
        }
        .accessibilityIdentifier("pulseQuietCard.setUpHome")
    }

    // MARK: - Forming or growing

    private func meterCard(_ meter: NeighborhoodMeterDTO) -> some View {
        card {
            Text("Verified neighbors \(areaSuffix(meter))".uppercased())
                .pulseFont(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            Text(meter.state == .forming
                ? "Your area is just forming — be one of the first \(meter.kAnonMin) verified households here."
                : "\(meter.verifiedCount ?? 0) households have verified their address nearby.")
                .pulseFont(.body)
                .foregroundStyle(Theme.Color.appText)
            // The invite payload is the /start funnel — the recipient sees their
            // own address answered, not our app pitch.
            ShareLink(
                item: URL(string: "https://pantopus.com/start")!,
                message: Text("See what's true about your address — records, risks, and who's verified nearby. Free, no account.")
            ) {
                buttonLabel("Invite your neighbors", icon: .share2)
            }
            .accessibilityIdentifier("pulseQuietInvite")
            if let cells = viewModel.cells {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { showsMap.toggle() }
                } label: {
                    HStack(spacing: Spacing.s1) {
                        Text(showsMap ? "Hide the map" : "Show the map")
                            .pulseFont(.button)
                        Icon(showsMap ? .chevronUp : .chevronDown, size: 14, color: Theme.Color.primaryInk)
                            .accessibilityHidden(true)
                    }
                    .foregroundStyle(Theme.Color.primaryInk)
                    .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pulseQuietMapToggle")
                if showsMap {
                    NearbyCellsMapCard(cells: cells)
                }
            }
        }
        .accessibilityIdentifier("pulseQuietCard.meter")
    }

    // MARK: - Shared bits

    private func card(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            content()
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
    }

    private func buttonLabel(_ title: String, icon: PantopusIcon) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(icon, size: 17, color: Theme.Color.appTextInverse)
                .accessibilityHidden(true)
            Text(title)
                .pulseFont(.button)
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: 48)
        .background(Theme.Color.primarySolid)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    private func areaSuffix(_ meter: NeighborhoodMeterDTO) -> String {
        if let city = meter.area?.city, !city.isEmpty { return "near \(city)" }
        return "near you"
    }
}
