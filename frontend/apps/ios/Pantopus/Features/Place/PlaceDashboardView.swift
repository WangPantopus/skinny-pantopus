//
//  PlaceDashboardView.swift
//  Pantopus
//
//  C1 / C1a — the assembled Place dashboard, the Place tab's root for a
//  Home the person can open. Ported from the design kit
//  `place-dashboard.jsx` + `place-dashboard-claimed.jsx`. A chip beside
//  the title says where the person stands (Verified, Claimed or Private
//  setup); before verification a verify banner and a "Locked until you
//  verify" group lead to it. The address opens the person's homes.
//

import SwiftUI

// swiftlint:disable file_length type_body_length

struct PlaceDashboardView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: PlaceDashboardViewModel
    @State private var showSwitcher = false
    @State private var showVerify = false
    @State private var ballotGovernments: BallotGovernmentsSheet?

    private let isActive: Bool
    /// The Place tab's root has nothing to go back to: its loading and error
    /// states show the bell instead of Back.
    private let isRoot: Bool
    /// Changes when the Place tab is tapped again on this dashboard: back to the top.
    private let scrollToTop: UUID?
    private let onOpenMenu: () -> Void

    init(
        viewModel: PlaceDashboardViewModel,
        isActive: Bool = true,
        isRoot: Bool = false,
        scrollToTop: UUID? = nil,
        onOpenMenu: @escaping () -> Void = {}
    ) {
        self.isActive = isActive
        self.isRoot = isRoot
        self.scrollToTop = scrollToTop
        self.onOpenMenu = onOpenMenu
        _viewModel = State(initialValue: viewModel)
    }

    private var verifyAddress: String {
        if case let .loaded(intel) = viewModel.state { return intel.place.label }
        return ""
    }

    var body: some View {
        // Keep lifecycle observers attached when privacy clearing replaces the
        // loaded dashboard with its placeholder during a background transition.
        ZStack {
            switch viewModel.state {
            case .loading:
                PlaceDashboardSkeleton()
            case let .loaded(intel):
                loaded(intel)
            case let .error(message):
                if viewModel.accessDenied {
                    PlaceDeniedState()
                } else {
                    ErrorState(message: message) {
                        await viewModel.refresh()
                    }
                }
            }
        }
        .background(Theme.Color.appBg)
        // With the navigation bar hidden the scroll content slid under the
        // status bar; this zero-height inset paints the app background there.
        .safeAreaInset(edge: .top, spacing: 0) {
            if case .loaded = viewModel.state {
                Color.clear.frame(height: 0).background(Theme.Color.appBg.ignoresSafeArea(edges: .top))
            } else {
                HStack {
                    if isRoot {
                        Spacer()
                        PlaceBellButton(unreadCount: viewModel.unreadCount, action: viewModel.onOpenNotifications)
                    } else {
                        Button { dismiss() } label: { Label("Back", systemImage: "chevron.left") }
                            .frame(minHeight: 44).accessibilityIdentifier("place.back")
                        Spacer()
                    }
                    Button(action: onOpenMenu) { Label("Menu", systemImage: "line.3.horizontal") }
                        .frame(minHeight: 44).accessibilityIdentifier("place.menu")
                }
                .padding(.horizontal, Spacing.s4)
                .background(Theme.Color.appBg.ignoresSafeArea(edges: .top))
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task(id: isActive) {
            guard isActive else { viewModel.discardTemporaryCopy()
                return
            }
            await viewModel.load()
            // Also on coming back from the notifications list, so a read bell loses its dot.
            await viewModel.refreshUnread()
        }
        .refreshable { await viewModel.refresh() }
        .refreshesOnStoreChange(onBackground: viewModel.discardTemporaryCopy) { if isActive { await viewModel.load() } }
        .refreshFailureToast($viewModel.refreshFailureMessage)
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
                    onManageHomes: {
                        showSwitcher = false
                        viewModel.onManageHomes()
                    },
                    onClose: { showSwitcher = false }
                )
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.hidden)
        }
        .sheet(item: $ballotGovernments) { sheet in
            BallotGovernmentsView(
                governments: sheet.governments,
                address: verifyAddress.components(separatedBy: ",").first ?? verifyAddress
            ) { ballotGovernments = nil }
                .presentationDetents([.large])
                .presentationDragIndicator(.hidden)
        }
        .sheet(isPresented: $showVerify) {
            PlaceVerifySheet(
                address: verifyAddress,
                homeId: viewModel.homeId,
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
        // Verifying is the next step for a claimed resident and for a private
        // setup (by mail). Guests and service providers can't verify, so they
        // get no verify prompts; older servers don't say, and claimed decides.
        let showsVerify = !isVerified && (intel.verifyAvailable ?? (intel.tier == .t3))
        let pulse = PlacePresentation.derivePulse(intel)
        return ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 0) {
                    header(intel: intel)
                        .padding(.horizontal, 18)
                        .padding(.top, Spacing.s2)
                        .id(Self.topAnchor)

                    // One order on both apps: verify (the resident's next step), Home tools,
                    // movers, Today's Pulse, then the privacy line.
                    if showsVerify {
                        PlaceVerifyBanner { showVerify = true }
                            .padding(.horizontal, 16)
                            .padding(.top, Spacing.s3)
                    }

                    PlaceMessagesActionRow(
                        icon: .house,
                        title: "Home tools",
                        subtitle: "Tasks and tools for your household."
                    ) {
                        viewModel.reloadOnReturn()
                        viewModel.onOpenHubHome()
                    }
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s3)
                    .accessibilityIdentifier("place.homeTools")

                    // Movers first (Wedge v2 D5): the first-week card leads for a recent move-in.
                    JustMovedCard(
                        homeId: viewModel.homeId,
                        moveInDate: viewModel.moveInDate,
                        needsPickupDay: intel.groups.flatMap(\.sections).compactMap(\.addressCalendar).first?.needsPickupDay,
                        onOpenDetail: viewModel.onOpenDetail,
                        onOpenMailDay: viewModel.onOpenMailDay
                    )
                    // Its ticks and dismissal are per Home: another Home starts fresh.
                    .id(viewModel.homeId)
                    .padding(.horizontal, 16)
                    .padding(.top, 14)

                    PlaceHeroCard(
                        variant: pulse.variant,
                        chip: pulse.chip,
                        heroIcon: pulse.heroIcon,
                        headline: pulse.title,
                        nudgeIcon: pulse.nudgeIcon,
                        nudgeText: pulse.nudgeText ?? "",
                        // Both labelled: an unlabelled trailing closure fills only `onTap`, which left the nudge row's
                        // own button with no action (Android opens Pulse from either).
                        onNudgeTap: { viewModel.onOpenPulse() },
                        onTap: { viewModel.onOpenPulse() }
                    )
                    .padding(.horizontal, 16)
                    .padding(.top, showsVerify ? 12 : 14)

                    VStack(spacing: 24) {
                        // The privacy mirror (Wedge v2 §2): one tap to see yourself as a neighbor does.
                        privacyMirrorRow
                        if isVerified {
                            messagesEntry(address: intel.place.label)
                        }
                        // Ballot P0 (ballot_p0): the "Your ballot" card leads under
                        // "This season" and leaves the civic group.
                        if let ballot = Self.ballot(in: intel) {
                            seasonBlock(ballot.card, asOf: ballot.asOf)
                        }
                        ForEach(Self.groups(intel), id: \.group) { group in
                            groupBlock(
                                group,
                                canVerify: !(intel.tier == .t3 && intel.verifyAvailable == false),
                                verifiesFirst: intel.verifiesFirst
                            )
                        }
                        identityEntry
                        if showsVerify {
                            verifyLockedGroup
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                    .padding(.bottom, Spacing.s10)
                }
            }
            .onChange(of: scrollToTop) { _, _ in
                withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo(Self.topAnchor, anchor: .top) }
            }
        }
    }

    private static let topAnchor = "place.top"

    // MARK: - Header

    /// "Your Place", where the person stands at this Home, the bell and the
    /// menu; under them the address, which opens their homes.
    private func header(intel: PlaceIntelligence) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: 8) {
                Text("Your Place")
                    .font(.system(size: 28, weight: .bold))
                    .kerning(-0.56)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .layoutPriority(1)
                    .accessibilityAddTraits(.isHeader)
                if let status = Self.status(intel) {
                    PlaceChip(model: status)
                        .accessibilityIdentifier("place.status")
                }
                Spacer(minLength: 0)
                // Bell + menu sit together; the dot shows anything unread.
                HStack(spacing: 0) {
                    PlaceBellButton(unreadCount: viewModel.unreadCount, action: viewModel.onOpenNotifications)
                    Button(action: onOpenMenu) {
                        Icon(.menu, size: 20, color: Theme.Color.appText)
                            .frame(width: Spacing.s12, height: Spacing.s12)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Menu")
                    .accessibilityIdentifier("place.menu")
                }
            }
            addressButton(intel.place.label)
        }
    }

    /// Where the person stands at this Home. Guests and service providers
    /// aren't residents: no status.
    static func status(_ intel: PlaceIntelligence) -> PlaceChipModel? {
        guard intel.viewer?.role != "nonresident" else { return nil }
        return switch intel.tier {
        case .t4: PlaceChipModel(tone: .success, text: "Verified", icon: .shieldCheck)
        case .t3: PlaceChipModel(tone: .warning, text: "Claimed", icon: .home)
        default: PlaceChipModel(tone: .neutral, text: "Private setup", icon: .home)
        }
    }

    /// The address is the way to your homes: switch, add or manage them.
    private func addressButton(_ label: String) -> some View {
        Button { showSwitcher = true } label: {
            HStack(spacing: 5) {
                Icon(.mapPin, size: 14, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                Text(label)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Icon(.chevronDown, size: 14, strokeWidth: 2.25, color: Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(Theme.Color.appBorder, lineWidth: 1))
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Your homes, \(label)")
        .accessibilityHint("Switch home or add a home")
        .accessibilityIdentifier("place.addressSwitcher")
    }

    // MARK: - This season (Ballot P0)

    /// The civic_election envelope's Ballot P0 card, when the server sent one.
    static func ballot(in intel: PlaceIntelligence) -> (card: BallotSummary, asOf: String?)? {
        for section in intel.groups.flatMap(\.sections) where section.id == .civicElection {
            if section.status == .ready, let card = section.civicElection?.ballotCard {
                return (card, section.asOf)
            }
        }
        return nil
    }

    /// The server's groups, minus the election row the ballot card replaces.
    static func groups(_ intel: PlaceIntelligence) -> [PlaceGroupBlock] {
        guard ballot(in: intel) != nil else { return intel.groups }
        return intel.groups.compactMap { group in
            let sections = group.sections.filter { $0.id != .civicElection }
            return sections.isEmpty ? nil : PlaceGroupBlock(group: group.group, label: group.label, sections: sections)
        }
    }

    private func seasonBlock(_ card: BallotSummary, asOf: String?) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Text("This season")
                .textCase(.uppercase)
                .font(.system(size: 11, weight: .semibold))
                .kerning(0.88)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            BallotCardView(
                card: card,
                asOf: asOf,
                onOpenGovernments: card.governments.map { governments in
                    { ballotGovernments = BallotGovernmentsSheet(governments: governments) }
                }
            )
        }
    }

    // MARK: - Group block

    private func groupBlock(_ group: PlaceGroupBlock, canVerify: Bool, verifiesFirst: Bool) -> some View {
        let detail = PlaceDetailGroup.forGroup(group.group)
        return VStack(alignment: .leading, spacing: 9) {
            PlaceGroupLabel(text: group.label)
            VStack(spacing: 8) {
                ForEach(group.sections, id: \.id) { section in
                    PlaceSectionView(
                        env: section,
                        onOpen: detail.map { d in { viewModel.onOpenDetail(d) } },
                        onVerify: canVerify ? { showVerify = true } : nil,
                        onClaim: canVerify ? { showVerify = true } : nil,
                        onRetry: { Task { await viewModel.refresh() } },
                        retrying: viewModel.isRefreshing,
                        verifiesFirst: verifiesFirst
                    )
                }
            }
        }
    }

    /// Wedge v2 §2 — "Private by default. See what neighbors see of this address."
    private var privacyMirrorRow: some View {
        Button(action: viewModel.onOpenPrivacyMirror) {
            HStack(spacing: 8) {
                Icon(.shieldCheck, size: 15, strokeWidth: 2.25, color: Theme.Color.home)
                Text("Private by default. See what neighbors see of this address.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 15, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("place.privacyMirror")
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

    /// The Identity page (residency letters and passes) has no card group of
    /// its own on the dashboard, so it gets this entry.
    private var identityEntry: some View {
        VStack(alignment: .leading, spacing: 9) {
            PlaceGroupLabel(text: "Identity")
            PlaceMessagesActionRow(
                icon: .idCard,
                title: "Residency letters & passes",
                subtitle: "Prove where you live, on your terms."
            ) { viewModel.onOpenDetail(.identity) }
                .accessibilityIdentifier("place.identityEntry")
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
}

/// The governments view's payload, identified so `.sheet(item:)` keeps its
/// content on screen while the sheet slides away.
private struct BallotGovernmentsSheet: Identifiable {
    let governments: BallotGovernments
    var id: BallotGovernments {
        governments
    }
}

// MARK: - Verify banner (sky-tinted nudge, before verification)

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
                    Icon(.shieldCheck, size: 20, strokeWidth: 2, color: Theme.Color.primaryInk)
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
                        Icon(.arrowRight, size: 14, strokeWidth: 2.5, color: Theme.Color.primaryInk)
                    }
                    .foregroundStyle(Theme.Color.primaryInk)
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

/// A place this account can't read (403): say so, without a retry, which
/// could only repeat the refusal. The same visual as `ErrorState` minus its
/// button; the web says the same (#896).
struct PlaceDeniedState: View {
    var body: some View {
        EmptyState(
            icon: .alertCircle,
            headline: "This place isn't available",
            subcopy: "You don't have permission to view this place."
        )
    }
}
