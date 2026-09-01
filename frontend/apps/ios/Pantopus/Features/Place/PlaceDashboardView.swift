//
//  PlaceDashboardView.swift
//  Pantopus
//
//  C1 / C1a — the assembled Place dashboard. Ported from the design kit
//  `place-dashboard.jsx` + `place-dashboard-claimed.jsx`. The app keeps
//  its existing 5-tab bar, so the designed in-screen PlaceTabBar is
//  intentionally omitted; this surface lives inside the Home tab.
//  Verified (T4) shows the green avatar; claimed (T3) shows the slate
//  "Claimed" avatar + a verify-nudge banner + a "Locked until you
//  verify" group.
//

import SwiftUI

struct PlaceDashboardView: View {
    @State private var viewModel: PlaceDashboardViewModel
    @State private var showSwitcher = false
    @State private var showVerify = false

    init(viewModel: PlaceDashboardViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    private var verifyAddress: String {
        if case let .loaded(intel) = viewModel.state { return intel.place.label }
        return ""
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                PlaceDashboardSkeleton()
            case let .loaded(intel):
                loaded(intel)
            case let .error(message):
                ErrorState(message: message) {
                    await viewModel.refresh()
                }
            }
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
        .sheet(isPresented: $showSwitcher) {
            PlaceSwitcherSheet(
                viewModel: PlaceSwitcherViewModel(
                    activeHomeId: viewModel.homeId,
                    onSelect: { homeId in
                        showSwitcher = false
                        if homeId != viewModel.homeId { viewModel.onSelectHome(homeId) }
                    },
                    onAddPlace: {
                        showSwitcher = false
                        viewModel.onAddPlace()
                    },
                    onClose: { showSwitcher = false }
                )
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.hidden)
        }
        .sheet(isPresented: $showVerify) {
            PlaceVerifySheet(
                address: verifyAddress,
                onStart: { method in
                    showVerify = false
                    viewModel.onStartVerify(method, verifyAddress)
                },
                onClose: { showVerify = false }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
        }
    }

    // MARK: - Loaded

    private func loaded(_ intel: PlaceIntelligence) -> some View {
        let isVerified = intel.tier == .t4
        let isClaimed = intel.tier == .t3
        let pulse = PlacePresentation.derivePulse(intel)
        return ScrollView {
            VStack(spacing: 0) {
                header(intel: intel, isVerified: isVerified)
                    .padding(.horizontal, 18)
                    .padding(.top, Spacing.s2)

                if isClaimed {
                    PlaceVerifyBanner { showVerify = true }
                        .padding(.horizontal, 16)
                        .padding(.top, Spacing.s4)
                }

                PlaceHeroCard(
                    variant: pulse.variant,
                    chip: pulse.chip,
                    heroIcon: pulse.heroIcon,
                    headline: pulse.title,
                    nudgeIcon: pulse.nudgeIcon,
                    nudgeText: pulse.nudgeText ?? ""
                ) { viewModel.onOpenPulse() }
                    .padding(.horizontal, 16)
                    .padding(.top, isClaimed ? 12 : 14)

                VStack(spacing: 24) {
                    if isVerified {
                        messagesEntry(address: intel.place.label)
                    }
                    ForEach(intel.groups, id: \.group) { group in
                        groupBlock(group)
                    }
                    if isClaimed {
                        verifyLockedGroup
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 20)
                .padding(.bottom, Spacing.s10)
            }
        }
    }

    // MARK: - Header

    private func header(intel: PlaceIntelligence, isVerified: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Your Place")
                    .font(.system(size: 28, weight: .bold))
                    .kerning(-0.56)
                    .foregroundStyle(Theme.Color.appText)
                HStack(spacing: 5) {
                    Icon(.mapPin, size: 14, strokeWidth: 2, color: Theme.Color.appTextMuted)
                    Text(intel.place.label)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button { showSwitcher = true } label: {
                if isVerified {
                    PlaceVerifiedAvatar(initials: initials(intel.place.label), size: 40)
                } else {
                    PlaceClaimedAvatar(initials: initials(intel.place.label), size: 40)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Switch place")
        }
    }

    // MARK: - Group block

    private func groupBlock(_ group: PlaceGroupBlock) -> some View {
        let detail = PlaceDetailGroup.forGroup(group.group)
        return VStack(alignment: .leading, spacing: 9) {
            PlaceGroupLabel(text: group.label)
            VStack(spacing: 8) {
                ForEach(group.sections, id: \.id) { section in
                    PlaceSectionView(
                        env: section,
                        onOpen: detail.map { d in { viewModel.onOpenDetail(d) } },
                        onVerify: { showVerify = true },
                        onClaim: { showVerify = true }
                    )
                }
            }
        }
    }

    /// W7 — verified-neighbor messaging entry (verified residents only).
    private func messagesEntry(address: String) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            PlaceGroupLabel(text: "Verified neighbors")
            VStack(spacing: 8) {
                PlaceMessagesActionRow(
                    icon: .messageSquarePlus,
                    title: "Message a neighbor",
                    subtitle: "Send a verified heads-up to a home on your block."
                ) { viewModel.onComposeMessage(address) }
                PlaceMessagesActionRow(
                    icon: .inbox,
                    title: "Your inbox",
                    subtitle: "Heads-ups from verified neighbors nearby."
                ) { viewModel.onOpenInbox() }
            }
        }
    }

    private var verifyLockedGroup: some View {
        VStack(alignment: .leading, spacing: 9) {
            PlaceGroupLabel(text: "Locked until you verify")
            VStack(spacing: 8) {
                ForEach(PlacePresentation.verifyLockedItems) { item in
                    PlaceLockedCard(
                        icon: item.icon,
                        title: item.title,
                        reason: item.reason,
                        cta: "Verify address"
                    ) { showVerify = true }
                }
            }
        }
    }

    private func initials(_ label: String) -> String {
        // Derive a 2-char monogram from the address's street name words.
        let words = label.split { $0 == " " || $0 == "," }
            .filter { $0.first?.isLetter ?? false }
        let letters = words.prefix(2).compactMap(\.first).map(String.init)
        return letters.isEmpty ? "PL" : letters.joined().uppercased()
    }
}

// MARK: - Claimed avatar (slate disc + amber "Claimed" pill)

struct PlaceClaimedAvatar: View {
    var initials: String = "RC"
    var size: CGFloat = 40

    var body: some View {
        VStack(spacing: 6) {
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Theme.Color.slate, Theme.Color.appTextSecondary],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: size, height: size)
                    .overlay(
                        Text(initials)
                            .font(.system(size: size * 0.34, weight: .bold))
                            .kerning(0.2)
                            .foregroundStyle(Theme.Color.appTextInverse)
                    )
                Circle()
                    .fill(Theme.Color.warning)
                    .frame(width: size * 0.42, height: size * 0.42)
                    .overlay(
                        Icon(.home, size: size * 0.22, strokeWidth: 2.75, color: Theme.Color.appTextInverse)
                    )
                    .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: 2, y: 2)
            }
            Text("CLAIMED")
                .font(.system(size: 10, weight: .bold))
                .kerning(0.4)
                .foregroundStyle(Theme.Color.warning)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(Theme.Color.warningBg)
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(Theme.Color.warningLight, lineWidth: 1))
        }
        .accessibilityLabel("Claimed place")
    }
}

// MARK: - Verify banner (sky-tinted nudge, claimed only)

struct PlaceVerifyBanner: View {
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(Theme.Color.primary100)
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .strokeBorder(Theme.Color.primary200, lineWidth: 1)
                    Icon(.shieldCheck, size: 20, strokeWidth: 2, color: Theme.Color.primary600)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Verify your address to message neighbors and get your badge.")
                        .font(.system(size: 14.5, weight: .semibold))
                        .kerning(-0.14)
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.primary900)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: 4) {
                        Text("Verify address")
                            .font(.system(size: 13.5, weight: .semibold))
                        Icon(.arrowRight, size: 14, strokeWidth: 2.5, color: Theme.Color.primary600)
                    }
                    .foregroundStyle(Theme.Color.primary600)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 18, strokeWidth: 2.25, color: Theme.Color.primary300)
            }
            .padding(.vertical, 13)
            .padding(.horizontal, 14)
            .background(Theme.Color.infoBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .strokeBorder(Theme.Color.primary200, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("place.verifyBanner")
    }
}

// MARK: - Loading skeleton

struct PlaceDashboardSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 8) {
                    PlaceSkeleton(width: 150, height: 26)
                    PlaceSkeleton(width: 190, height: 14)
                }
                .padding(.horizontal, 18)
                .padding(.top, Spacing.s2)

                PlaceSkeleton(widthFraction: 1, height: 132, radius: 16)
                    .padding(.horizontal, 16)
                    .padding(.top, 16)

                VStack(spacing: 24) {
                    ForEach(0..<3, id: \.self) { _ in
                        VStack(alignment: .leading, spacing: 9) {
                            PlaceSkeleton(width: 90, height: 11)
                            VStack(spacing: 8) {
                                ForEach(0..<2, id: \.self) { _ in
                                    PlaceSkeleton(widthFraction: 1, height: 76, radius: 16)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 20)
            }
        }
        .accessibilityLabel("Loading your place")
    }
}

#Preview("Place dashboard — loading") {
    PlaceDashboardSkeleton()
        .background(Theme.Color.appBg)
}
