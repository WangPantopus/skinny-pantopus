//
//  NeighborhoodView.swift
//  Pantopus
//
//  Wedge Phase 1 — the density-gated Neighborhood door.
//
//  One honest meter decides what this screen is:
//    no_place → claim prompt (the door needs to know where home is)
//    forming  → "be one of the first N" + invite (count withheld below
//               the k-anon floor, mirroring the backend contract)
//    growing  → progress toward the unlock threshold + invite
//    unlocked → the neighborhood surfaces (Pulse, Marketplace, Tasks)
//
//  Cold-start rule: locked surfaces render as a preview of a reward with
//  a meter — never as empty rooms.
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

    init(
        viewModel: NeighborhoodViewModel = NeighborhoodViewModel(),
        onOpenSurface: @escaping @MainActor (NeighborhoodDoorStore.Surface) -> Void,
        onClaimPlace: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onOpenSurface = onOpenSurface
        self.onClaimPlace = onClaimPlace
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                header

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
                            headline: "First, tell us where home is",
                            subcopy: "Your neighborhood is measured around your place. "
                                + "Claim your address and this page becomes your block's progress meter.",
                            cta: .init(title: "Claim your address") {
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
                "Feed, marketplace, and local tasks open when enough households nearby have "
                    + "verified their address — so day one here is real neighbors, not empty rooms."
            )
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, Spacing.s3)
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
            .foregroundStyle(Theme.Color.primary600)
            .accessibilityIdentifier("nearbyRetry")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s10)
    }

    // MARK: - Locked (forming / growing)

    private func lockedBody(_ meter: NeighborhoodMeterDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            meterCard(meter)
            inviteButton
            Text("What opens at \(meter.threshold)")
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
                + "here. The neighborhood opens at \(meter.threshold)."
            : "\(meter.verifiedCount ?? 0) households have verified their address nearby. "
                + "At \(meter.threshold), the neighborhood opens for everyone."

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
            .accessibilityLabel("Verified neighbors toward unlocking the neighborhood")
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
            HStack(spacing: Spacing.s2) {
                Icon(.sparkles, size: 16, color: Theme.Color.primary600)
                Text("Your neighborhood is open — \(meter.verifiedCount ?? meter.threshold) verified households \(areaSuffix(meter)).")
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
            icon: .rss,
            title: "Pulse",
            subtitle: "What your neighbors are posting, asking, and sharing",
            destination: .pulse
        ),
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
