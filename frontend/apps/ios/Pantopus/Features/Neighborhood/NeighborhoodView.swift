//
//  NeighborhoodView.swift
//  Pantopus
//
//  Social discovery is available in every meter state. The meter controls
//  the local marketplace and tasks preview and preserves privacy floors.
//

import SwiftUI

// Internal like PlaceDashboardView — the view model's APIClient dependency
// is internal, and the app is a single target.
struct NeighborhoodView: View {
    @State private var viewModel: NeighborhoodViewModel

    /// Present a neighborhood surface (unlocked state) — wired by
    /// `NeighborhoodTabRoot` to its sheet presentation.
    private let onOpenSurface: @MainActor (NeighborhoodDoorStore.Surface) -> Void
    /// Route to the Place tab's claim flow (no_place state).
    private let onClaimPlace: @MainActor () -> Void
    private let onOpenBeacons: @MainActor () -> Void
    private let onOpenConnections: @MainActor () -> Void

    init(
        viewModel: NeighborhoodViewModel = NeighborhoodViewModel(),
        onOpenSurface: @escaping @MainActor (NeighborhoodDoorStore.Surface) -> Void,
        onClaimPlace: @escaping @MainActor () -> Void,
        onOpenBeacons: @escaping @MainActor () -> Void,
        onOpenConnections: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onOpenSurface = onOpenSurface
        self.onClaimPlace = onClaimPlace
        self.onOpenBeacons = onOpenBeacons
        self.onOpenConnections = onOpenConnections
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                header
                socialDestinations

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
                            subcopy: "Adding a home gives you neighborhood context and household tools. "
                                + "You can browse Pulse and follow Beacons before setting it up.",
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
            .padding(.bottom, Spacing.s10)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("nearbyDoor")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Nearby")
                .font(.system(size: 28, weight: .heavy))
                .foregroundStyle(Theme.Color.appText)
            Text(
                "Join conversations, find Beacons, and stay connected. Choose an area inside Pulse to browse local posts. "
                    + "Following Beacons needs no home address."
            )
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, Spacing.s3)
    }

    // MARK: - Loading / error

    private var socialDestinations: some View {
        VStack(spacing: Spacing.s3) {
            socialRow("Pulse", detail: "Browse a chosen area or catch up with your connections", icon: .rss) { onOpenSurface(.pulse) }
            socialRow("Beacons", detail: "Find public profiles and return to the people you follow", icon: .radio, action: onOpenBeacons)
            socialRow("Connections", detail: "Keep up with people you know", icon: .users, action: onOpenConnections)
        }
    }

    private func socialRow(_ title: String, detail: String, icon: PantopusIcon, action: @escaping @MainActor () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 20, color: .white)
                    .frame(width: 44, height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.Color.appText)
                    Text(detail).pantopusTextStyle(.small).foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: 0)
                Icon(.chevronRight, size: 18, color: Theme.Color.appTextSecondary)
            }
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg).stroke(Theme.Color.appBorder))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("nearbySocial.\(title.lowercased())")
    }

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
            .foregroundStyle(Theme.Color.primary600)
            .accessibilityIdentifier("nearbyRetry")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s10)
    }

    // MARK: - Locked (forming / growing)

    private func lockedBody(_ meter: NeighborhoodMeterDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            // The window (Wedge v2 §4): alive whatever the meter says.
            if let cells = viewModel.cells { NearbyCellsMapCard(cells: cells) }
            meterCard(meter)
            inviteButton
            Text("Local marketplace and tasks")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.top, Spacing.s2)
            VStack(spacing: Spacing.s3) {
                ForEach(Self.surfaces, id: \.title) { surface in
                    lockedRow(surface)
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
        let copy = isForming
            ? "Your area is just forming — be one of the first \(meter.kAnonMin) verified households "
                + "here. Local marketplace and tasks open at \(meter.threshold). Pulse and Beacons are available now."
            : "\(meter.verifiedCount ?? 0) households have verified their address nearby. "
                + "Local marketplace and tasks open at \(meter.threshold). Pulse and Beacons are available now."

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
        // The invite payload is the /start funnel — the recipient sees their
        // own address answered, not our app pitch.
        ShareLink(
            item: URL(string: "https://pantopus.com/start")!,
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
            .background(Theme.Color.primary600)
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
            if let cells = viewModel.cells { NearbyCellsMapCard(cells: cells) }
            HStack(spacing: Spacing.s2) {
                Icon(.sparkles, size: 16, color: Theme.Color.primary600)
                Text("Local marketplace and tasks are open — "
                    + "\(meter.verifiedCount ?? meter.threshold) verified households \(areaSuffix(meter)).")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                    .fixedSize(horizontal: false, vertical: true)
            }
            VStack(spacing: Spacing.s3) {
                ForEach(Self.surfaces, id: \.title) { surface in
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
        ),
    ]

    private func areaSuffix(_ meter: NeighborhoodMeterDTO) -> String {
        if let city = meter.area?.city, !city.isEmpty { return "near \(city)" }
        return "near you"
    }
}
