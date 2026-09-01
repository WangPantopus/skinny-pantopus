//
//  EarnView.swift
//  Pantopus
//
//  A10.11 — Earn dashboard. The earnings-IN sibling of the A10.10 Wallet:
//  it reframes the same dark `BalanceHero` vocabulary around MAKING money
//  — "Available to cash out" + this-week / pending split, a weekly-goal
//  momentum ring, a `Ways to earn` launcher, the recent-earnings list,
//  payout settings, and the tax-docs row, with a sticky Cash out CTA.
//
//  Reached from the Mailbox Earn-drawer entry and the
//  `pantopus://mailbox/earn` deep link. Two designed frames: populated
//  (active earner) and empty (new earner — no hero, gated rows, add-payout
//  nudge). Real payout wiring is out of scope; Cash out / Manage / Add bank
//  deep-link to the existing Payments surface.
//

import SwiftUI

public struct EarnView: View {
    @State private var viewModel: EarnViewModel
    /// Backs the `Offers` tab — the paid-offer wall. Held here (not in
    /// `EarnOffersTab`) so a running dwell timer survives a tab switch.
    @State private var offersViewModel: EarnOffersViewModel
    @State private var selectedTab: EarnTab = .offers
    private let onBack: () -> Void
    private let onHelp: () -> Void
    private let onCashOut: () -> Void
    private let onBrowseTasks: () -> Void
    private let onReferNeighbor: () -> Void
    private let onOfferService: () -> Void
    private let onManagePayout: () -> Void
    private let onAddBank: () -> Void
    private let onSeeAllEarnings: () -> Void
    private let onOpenTaxDocs: () -> Void

    public init(
        viewModel: EarnViewModel = EarnViewModel(),
        offersViewModel: EarnOffersViewModel? = nil,
        onBack: @escaping () -> Void = {},
        onHelp: @escaping () -> Void = {},
        onCashOut: @escaping () -> Void = {},
        onBrowseTasks: @escaping () -> Void = {},
        onReferNeighbor: @escaping () -> Void = {},
        onOfferService: @escaping () -> Void = {},
        onManagePayout: @escaping () -> Void = {},
        onAddBank: @escaping () -> Void = {},
        onSeeAllEarnings: @escaping () -> Void = {},
        onOpenTaxDocs: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        _offersViewModel = State(initialValue: offersViewModel ?? EarnOffersViewModel())
        self.onBack = onBack
        self.onHelp = onHelp
        self.onCashOut = onCashOut
        self.onBrowseTasks = onBrowseTasks
        self.onReferNeighbor = onReferNeighbor
        self.onOfferService = onOfferService
        self.onManagePayout = onManagePayout
        self.onAddBank = onAddBank
        self.onSeeAllEarnings = onSeeAllEarnings
        self.onOpenTaxDocs = onOpenTaxDocs
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            EarnTopBar(onBack: onBack, onHelp: onHelp)
            EarnTabStrip(selected: $selectedTab)
            switch selectedTab {
            case .offers:
                EarnOffersTab(viewModel: offersViewModel)
            case .earnings:
                content
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("earn")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        // The earnings dashboard only pays for its fetch once the user
        // asks for it — the Offers tab is what opens by default.
        .task(id: selectedTab) {
            guard selectedTab == .earnings, case .loading = viewModel.state else { return }
            await viewModel.load()
        }
        .onDisappear { offersViewModel.cancelDwellTimers() }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingShell
        case let .populated(earnContent):
            ZStack(alignment: .bottom) {
                populatedScroll(earnContent)
                bottomBar { CashOutCTA(amount: earnContent.available, onTap: onCashOut) }
            }
        case let .empty(waysToEarn):
            ZStack(alignment: .bottom) {
                emptyScroll(waysToEarn)
                bottomBar { BrowseCTA(onTap: onBrowseTasks) }
            }
        case let .error(message):
            errorShell(message)
        }
    }

    // MARK: - Populated

    private func populatedScroll(_ content: EarnContent) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s0) {
                heroSection(content)
                // Weekly-goal target, payout method, auto-cash-out, and 1099
                // tax docs have no `/earnings/*` source (the last three are
                // Stripe Connect — Phase 3), so they render only when the
                // projection carries them (sample/preview) — never faked.
                if let weeklyGoal = content.weeklyGoal {
                    WeeklyGoalCard(goal: weeklyGoal)
                        .padding(.top, Spacing.s3)
                }
                section(overline: "Ways to earn", action: "Find work", onAction: onBrowseTasks) {
                    EarnWaysToEarnCard(items: content.waysToEarn, onSelect: dispatchWay)
                }
                section(overline: "Recent earnings", action: "See all", onAction: onSeeAllEarnings) {
                    EarnEarningsList(items: content.earnings)
                }
                if let payoutMethod = content.payoutMethod, let autoCashOut = content.autoCashOut {
                    section(overline: "Payout settings") {
                        EarnPayoutSettingsCard(
                            method: payoutMethod,
                            autoCashOut: autoCashOut,
                            onManage: onManagePayout
                        )
                    }
                }
                if let taxDocs = content.taxDocs {
                    section(overline: "Taxes") {
                        EarnTaxDocsRow(docs: taxDocs, onTap: onOpenTaxDocs)
                    }
                }
                Spacer().frame(height: 96)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s2)
        }
        .background(Theme.Color.appBg)
    }

    private func heroSection(_ content: EarnContent) -> some View {
        BalanceHero(
            overline: "Available to cash out",
            amount: content.available,
            currencyCode: "USD",
            split: [
                .init(
                    icon: .calendar,
                    overline: "This week",
                    value: content.thisWeek,
                    note: content.thisWeekMeta
                ),
                .init(
                    icon: .clock,
                    overline: "Pending",
                    value: content.pending,
                    note: content.pendingMeta
                )
            ]
        )
    }

    // MARK: - Empty (new earner)

    private func emptyScroll(_ waysToEarn: [EarnWayToEarn]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s0) {
                section(overline: "Ways to earn", action: "Find work", onAction: onBrowseTasks) {
                    EarnWaysToEarnCard(items: waysToEarn, onSelect: dispatchWay)
                }
                section(overline: "Recent earnings") {
                    EarnLockedRow(
                        title: "No earnings yet",
                        subcopy: "Your paid tasks land here — your first one unlocks cash out.",
                        identifier: "earnEarningsLockedRow"
                    )
                }
                section(overline: "Payout settings") {
                    EarnPayoutNudge(onAddBank: onAddBank)
                }
                section(overline: "Taxes") {
                    EarnLockedRow(
                        title: "Tax documents",
                        subcopy: "Your 1099 and YTD totals appear after your first paid task.",
                        identifier: "earnTaxDocsLockedRow"
                    )
                }
                Spacer().frame(height: 116)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s2)
        }
        .background(Theme.Color.appBg)
    }

    private func dispatchWay(_ kind: EarnWayKind) {
        switch kind {
        case .browse: onBrowseTasks()
        case .refer: onReferNeighbor()
        case .offer: onOfferService()
        }
    }

    // MARK: - Section header

    private func section(
        overline: String,
        action: String? = nil,
        onAction: @escaping () -> Void = {},
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .lastTextBaseline) {
                Text(overline)
                    .font(.system(size: 10.5, weight: .bold))
                    .tracking(0.8)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer(minLength: Spacing.s2)
                if let action {
                    Button(action: onAction) {
                        Text(action)
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.primary600)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("earnSectionAction-\(overline)")
                }
            }
            .padding(.top, Spacing.s4)
            .padding(.bottom, Spacing.s1)
            content()
        }
    }

    // MARK: - Sticky bottom bar

    private func bottomBar(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(spacing: Spacing.s0) {
            // Gradient fade — `appBg` α0 → α0.92 → 1 — matching the Wallet
            // dock; design-specced as a fade, NOT a solid frosted bar.
            LinearGradient(
                stops: [
                    .init(color: Theme.Color.appBg.opacity(0), location: 0),
                    .init(color: Theme.Color.appBg.opacity(0.92), location: 0.3),
                    .init(color: Theme.Color.appBg, location: 0.6)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 28)
            content()
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s5)
                .padding(.top, Spacing.s2)
                .background(Theme.Color.appBg)
        }
    }

    // MARK: - Loading / error chrome

    private var loadingShell: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Shimmer(height: 188, cornerRadius: Radii.xl + 2)
                Shimmer(height: 92, cornerRadius: Radii.xl)
                Shimmer(height: 150, cornerRadius: Radii.xl)
                Shimmer(height: 180, cornerRadius: Radii.xl)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s8)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("earnLoading")
    }

    private func errorShell(_ message: String) -> some View {
        ErrorState(headline: "Couldn't load Earn", message: message) {
            await viewModel.refresh()
        }
        .accessibilityIdentifier("earnError")
    }
}

// MARK: - Top bar

private struct EarnTopBar: View {
    let onBack: () -> Void
    let onHelp: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("earnBackButton")

            Spacer(minLength: Spacing.s0)

            Text("Earn")
                .font(.system(size: 14, weight: .semibold))
                .tracking(-0.15)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)

            Spacer(minLength: Spacing.s0)

            Button(action: onHelp) {
                Icon(.helpCircle, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Earn help")
            .accessibilityIdentifier("earnHelpButton")
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }
}

// MARK: - Sticky CTAs

private struct CashOutCTA: View {
    let amount: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s0) {
                HStack(spacing: Spacing.s2) {
                    Icon(.arrowDownToLine, size: 17, strokeWidth: 2.2, color: .white)
                    Text("Cash out")
                        .font(.system(size: 15, weight: .bold))
                        .tracking(-0.15)
                        .foregroundStyle(.white)
                }
                Spacer(minLength: Spacing.s2)
                Text("$\(amount)")
                    .font(.system(size: 15, weight: .bold))
                    .tracking(-0.15)
                    .monospacedDigit()
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
            .pantopusShadow(.primary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Cash out $\(amount)")
        .accessibilityIdentifier("earnCashOutButton")
    }
}

private struct BrowseCTA: View {
    let onTap: () -> Void

    var body: some View {
        VStack(spacing: 7) {
            Button(action: onTap) {
                HStack(spacing: Spacing.s2) {
                    Icon(.search, size: 17, strokeWidth: 2.2, color: .white)
                    Text("Browse open tasks")
                        .font(.system(size: 15, weight: .bold))
                        .tracking(-0.15)
                        .foregroundStyle(.white)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
                .pantopusShadow(.primary)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("earnBrowseTasksButton")

            Text("Cash out unlocks after your first paid task.")
                .font(.system(size: 10.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("earnCashOutGateNote")
        }
    }
}

#Preview("Earn · populated") {
    EarnView(
        viewModel: EarnViewModel(content: EarnSampleData.populated),
        offersViewModel: EarnOffersViewModel(state: .empty(balance: .zero))
    )
}

#Preview("Earn · empty") {
    EarnView(
        viewModel: EarnViewModel(content: nil),
        offersViewModel: EarnOffersViewModel(state: .empty(balance: .zero))
    )
}

#Preview("Earn · loading") {
    EarnView(
        viewModel: EarnViewModel(state: .loading),
        offersViewModel: EarnOffersViewModel(state: .loading)
    )
}

#Preview("Earn · error") {
    EarnView(
        viewModel: EarnViewModel(state: .error(message: "Network unavailable.")),
        offersViewModel: EarnOffersViewModel(state: .error(message: "Network unavailable."))
    )
}
