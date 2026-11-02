//
//  NeighborhoodView.swift
//  Pantopus
//
//  The Nearby tab's Neighborhood segment (founder decision 2026-10-20): the
//  density window (`NearbyCellsMapCard`), the meter and "Invite your
//  neighbors", or "Set up a home" before there is one. The meter controls
//  the local marketplace and tasks preview and preserves privacy floors.
//  Pulse is the segment beside it and Connections is in the side menu, so
//  the October 13 door's title and Pulse / Connections rows are gone. Shown
//  while the Pulse redesign is off (launch cut #11); with it on, the Pulse
//  tab's quiet card (`PulseQuietCard`) carries the meter instead.
//

import SwiftUI

/// Internal like PlaceDashboardView — the view model's APIClient dependency
/// is internal, and the app is a single target.
struct NeighborhoodView: View {
    @State private var viewModel: NeighborhoodViewModel

    /// Present a neighborhood surface (unlocked state) — wired by
    /// `NeighborhoodTabRoot` to its sheet presentation.
    private let onOpenSurface: @MainActor (NeighborhoodDoorStore.Surface) -> Void
    /// Start adding a home in the Place tab (no_place state).
    private let onClaimPlace: @MainActor () -> Void
    /// The map fills the column beside this one (a wide screen): only its key and note show here.
    private let mapBeside: Bool

    init(
        viewModel: NeighborhoodViewModel = NeighborhoodViewModel(),
        mapBeside: Bool = false,
        onOpenSurface: @escaping @MainActor (NeighborhoodDoorStore.Surface) -> Void,
        onClaimPlace: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.mapBeside = mapBeside
        self.onOpenSurface = onOpenSurface
        self.onClaimPlace = onClaimPlace
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                switch viewModel.state {
                case .loading:
                    loadingBody
                case let .error(message):
                    errorBody(message)
                case let .loaded(meter):
                    switch meter.state {
                    case .noPlace:
                        EmptyState(
                            icon: .home,
                            headline: "Add a home for neighborhood context",
                            // Launch cut #1 (Beacon): no Beacons to follow.
                            subcopy: "Adding a home gives you neighborhood context and household tools. "
                                + (LaunchFeatures.beacon
                                    ? "You can browse Pulse and follow Beacons before setting it up."
                                    : "You can browse Pulse before setting it up."),
                            cta: .init(title: "Set up a home") {
                                await MainActor.run { onClaimPlace() }
                            }
                        )
                        .padding(.top, Spacing.s10)
                    case .unlocked:
                        unlockedBody(meter)
                    case .forming, .growing:
                        lockedBody(meter)
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s10)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("nearbyNeighborhood")
        // The offline strip is the tab's, above the segment header (`NeighborhoodTabRoot`), as on the Pulse segment.
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
        // A home added, claimed or verified (`homes`) can change the meter.
        .refreshesOnStoreChange(affects: { $0.names(topic: ScreenTopic.homes) }, perform: { await viewModel.load() })
    }

    // MARK: - Loading / error

    private var loadingBody: some View {
        VStack(spacing: Spacing.s3) {
            Shimmer(width: nil, height: 110, cornerRadius: Radii.lg)
            Shimmer(width: nil, height: 76, cornerRadius: Radii.lg)
            Shimmer(width: nil, height: 76, cornerRadius: Radii.lg)
        }
        .accessibilityHidden(true)
    }

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Button("Retry") {
                Task { await viewModel.refresh() }
            }
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Theme.Color.primaryInk)
            .accessibilityIdentifier("nearbyRetry")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s10)
    }

    // MARK: - Locked (forming / growing)

    private func lockedBody(_ meter: NeighborhoodMeterDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            // The window (Wedge v2 §4): alive whatever the meter says.
            if let cells = viewModel.cells { window(cells) }
            // Launch cuts #3/#4: the meter counts toward the local marketplace
            // and tasks; with both hidden it goes with them.
            if !Self.launchSurfaces.isEmpty { meterCard(meter) }
            inviteButton
            if !Self.launchSurfaces.isEmpty {
                Text("Local marketplace and tasks")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.top, Spacing.s2)
                VStack(spacing: Spacing.s3) {
                    ForEach(Self.launchSurfaces, id: \.title) { surface in
                        lockedRow(surface)
                    }
                }
            }
        }
    }

    private func meterCard(_ meter: NeighborhoodMeterDTO) -> some View {
        let isForming = meter.state == .forming
        let countLabel = isForming ? "< \(meter.kAnonMin)" : "\(meter.verifiedCount ?? 0)"
        let fraction: Double = isForming
            ? 0.08
            : max(0.08, min(1, Double(meter.verifiedCount ?? 0) / Double(max(meter.threshold, 1))))
        // Launch cut #1 (Beacon): no Beacons to mention for the first launch.
        let available = LaunchFeatures.beacon ? "Pulse and Beacons are available now." : "Pulse is available now."
        let copy = isForming
            ? "Your area is just forming — be one of the first \(meter.kAnonMin) verified households "
            + "here. Local marketplace and tasks open at \(meter.threshold). \(available)"
            : "\(meter.verifiedCount ?? 0) households have verified their address nearby. "
            + "Local marketplace and tasks open at \(meter.threshold). \(available)"

        return VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack {
                Text("VERIFIED NEIGHBORS \(areaSuffix(meter).uppercased())")
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.7)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                Text("\(countLabel) / \(meter.threshold)")
                    .font(.system(size: 13, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appText)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.Color.appBorder.opacity(0.6))
                    Capsule()
                        .fill(Theme.Color.primary600)
                        .frame(width: geo.size.width * fraction)
                }
            }
            .frame(height: 10)
            .accessibilityElement()
            .accessibilityLabel("Verified households toward local marketplace and tasks")
            .accessibilityValue("\(countLabel) of \(meter.threshold)")
            Text(copy)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg).stroke(Theme.Color.appBorder))
        .accessibilityIdentifier("nearbyMeter")
    }

    private var inviteButton: some View {
        // The invite is the person's own link (/join/<code>): the recipient sees
        // who invited them over the /start address lookup, so their own address
        // is answered first, not our app pitch. /start itself until it loads.
        ShareLink(
            item: PersonalInviteLink.shared.url,
            message: Text("See what's true about your address — records, risks, and who's verified nearby. Free, no account.")
        ) {
            HStack(spacing: Spacing.s2) {
                Icon(.share2, size: 17, color: .white)
                Text("Invite your neighbors")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Theme.Color.primarySolid)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        }
        .accessibilityIdentifier("nearbyInvite")
    }

    private func lockedRow(_ surface: SurfaceRow) -> some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md).fill(Theme.Color.appBorder.opacity(0.5))
                Icon(surface.icon, size: 20, color: Theme.Color.appTextSecondary)
            }
            .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(surface.title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(surface.subtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            Icon(.lock, size: 16, color: Theme.Color.appTextSecondary)
                .accessibilityLabel("Locked")
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg).stroke(Theme.Color.appBorder))
        .opacity(0.85)
    }

    // MARK: - Unlocked

    private func unlockedBody(_ meter: NeighborhoodMeterDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            if let cells = viewModel.cells { window(cells) }
            // Launch cuts #3/#4: the "open" banner goes with the surfaces it announces.
            if !Self.launchSurfaces.isEmpty {
                HStack(spacing: Spacing.s2) {
                    Icon(.sparkles, size: 16, color: Theme.Color.primaryInk)
                    Text("Local marketplace and tasks are open — "
                        + "\(meter.verifiedCount ?? meter.threshold) verified households \(areaSuffix(meter)).")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.primaryInk)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            VStack(spacing: Spacing.s3) {
                ForEach(Self.launchSurfaces, id: \.title) { surface in
                    Button {
                        onOpenSurface(surface.destination)
                    } label: {
                        HStack(spacing: Spacing.s3) {
                            ZStack {
                                RoundedRectangle(cornerRadius: Radii.md).fill(Theme.Color.primary600)
                                Icon(surface.icon, size: 20, color: .white)
                            }
                            .frame(width: 44, height: 44)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(surface.title)
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundStyle(Theme.Color.appText)
                                Text(surface.subtitle)
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer()
                            Icon(.chevronRight, size: 18, color: Theme.Color.appTextSecondary)
                        }
                        .padding(Spacing.s4)
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                        .overlay(RoundedRectangle(cornerRadius: Radii.lg).stroke(Theme.Color.appBorder))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("nearbySurface.\(surface.destination.rawValue)")
                }
            }
        }
    }

    // MARK: - Shared bits

    /// The map card, or only its key when the map fills the column beside.
    @ViewBuilder
    private func window(_ cells: NeighborhoodCellsDTO) -> some View {
        if mapBeside {
            NearbyCellsKey(cells: cells)
        } else {
            NearbyCellsMapCard(cells: cells)
        }
    }

    private struct SurfaceRow {
        let icon: PantopusIcon
        let title: String
        let subtitle: String
        let destination: NeighborhoodDoorStore.Surface
    }

    private static let surfaces: [SurfaceRow] = [
        .init(
            icon: .shoppingBag,
            title: "Marketplace",
            subtitle: "Buy, sell, and give — with people who are verifiably local",
            destination: .marketplace
        ),
        .init(
            icon: .briefcase,
            title: "Tasks",
            subtitle: "Post and pick up local work, backed by verified addresses",
            destination: .tasks
        )
    ]

    /// Launch cuts #3 (Marketplace) / #4 (Open gigs): the surfaces still
    /// shown for the first launch.
    private static var launchSurfaces: [SurfaceRow] {
        surfaces.filter(\.destination.isAvailableAtLaunch)
    }

    private func areaSuffix(_ meter: NeighborhoodMeterDTO) -> String {
        if let city = meter.area?.city, !city.isEmpty { return "near \(city)" }
        return "near you"
    }
}
