//
//  WalletView.swift
//  Pantopus
//
//  A10.10 — earnings wallet. Top-level destination distinct from
//  Settings → Payments: this is the earnings-side surface (BalanceHero
//  + recent activity + payout method + tax docs + Withdraw CTA). The
//  Settings → Payments row routes here in P3.2 (replacing the prior
//  `NotYetAvailableView` placeholder); the `pantopus://wallet` deep
//  link lands here too.
//
//  Two designed frames: populated (happy path) and payout-on-hold
//  (bank verification expired — amber banner, locked withdraw,
//  re-verify CTA in the payout method card).
//

// swiftlint:disable file_length type_body_length

import SwiftUI

public struct WalletView: View {
    @State private var viewModel: WalletViewModel
    @State private var showWithdrawSheet = false
    /// Raw decimal-pad text for the partial-withdrawal field. Empty means
    /// "the whole available balance", which is what the screen did before.
    @State private var withdrawAmount = ""
    @State private var toast: ToastMessage?
    private let onBack: () -> Void
    private let onOpenHistory: () -> Void
    private let onOpenTaxDocs: () -> Void
    private let onSeeAllActivity: () -> Void

    public init(
        viewModel: WalletViewModel = WalletViewModel(),
        onBack: @escaping () -> Void = {},
        onOpenHistory: @escaping () -> Void = {},
        onOpenTaxDocs: @escaping () -> Void = {},
        onSeeAllActivity: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onOpenHistory = onOpenHistory
        self.onOpenTaxDocs = onOpenTaxDocs
        self.onSeeAllActivity = onSeeAllActivity
    }

    public var body: some View {
        // Money surface — RN wraps this route in `SensitiveScreenGuard`
        // (`app/wallet.tsx:195`), so the device credential is checked before
        // any balance is composed. A 5-minute grace means walking Wallet →
        // Payments doesn't prompt twice.
        SensitiveScreenGuard(reason: "Verify to access your Wallet", onRejected: onBack) {
            guardedBody
        }
    }

    private var guardedBody: some View {
        VStack(spacing: Spacing.s0) {
            WalletTopBar(onBack: onBack, onOpenHistory: onOpenHistory)
            content
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("wallet")
        .sensitiveScreen()
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .sheet(isPresented: $showWithdrawSheet) { withdrawSheet }
        .overlay(alignment: .bottom) { toastOverlay }
        .onChange(of: viewModel.action) { _, newAction in handle(newAction) }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingShell
        case let .populated(walletContent):
            ZStack(alignment: .bottom) {
                scroll(walletContent)
                bottomBar(walletContent)
            }
        case let .hold(walletContent):
            ZStack(alignment: .bottom) {
                scroll(walletContent)
                bottomBar(walletContent)
            }
        case let .error(message):
            errorShell(message)
        }
    }

    private func scroll(_ content: WalletContent) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s0) {
                if let hold = content.holdState {
                    HoldBanner(headline: hold.bannerHeadline, bodyText: hold.bannerBody)
                        .padding(.bottom, Spacing.s3)
                }
                heroSection(content)
                if let breakdown = content.pendingBreakdown {
                    // RN splits the escrow total into "In review" /
                    // "Releasing soon" (`WalletTab.tsx:161-173`); the hero's
                    // single Pending figure can't say which is which.
                    section(overline: "Pending release") {
                        PendingReleaseCard(breakdown: breakdown)
                    }
                }
                if content.hasLifetimeTotals {
                    // `GET /api/wallet` returns lifetime_received /
                    // lifetime_withdrawals alongside the balance; RN shows both
                    // beside it (`WalletTab.tsx:150-159`).
                    section(overline: "Lifetime") {
                        LifetimeTotalsCard(
                            earned: content.lifetimeEarned,
                            withdrawn: content.lifetimeWithdrawn
                        )
                    }
                }
                section(overline: "Recent activity", action: "See all", onAction: onSeeAllActivity) {
                    ActivityList(items: content.activity)
                }
                if let payoutMethod = content.payoutMethod {
                    section(overline: "Payout method") {
                        PayoutMethodCard(
                            method: payoutMethod,
                            onManage: { Task { await viewModel.openDashboard() } },
                            onReverify: { Task { await viewModel.setupPayouts() } }
                        )
                    }
                } else if let payoutAccount = content.payoutAccount {
                    // Live path: Stripe gives us no bank detail for an Express
                    // account, so the connected *account* is what we render —
                    // and it carries the only reachable "Open Stripe Dashboard".
                    section(overline: "Payout account") {
                        PayoutAccountCard(account: payoutAccount) {
                            Task {
                                if payoutAccount.warn {
                                    await viewModel.setupPayouts()
                                } else {
                                    await viewModel.openDashboard()
                                }
                            }
                        }
                    }
                }
                if let taxDocs = content.taxDocs {
                    section(overline: "Taxes") {
                        TaxDocsRow(docs: taxDocs, onTap: onOpenTaxDocs)
                    }
                }
                Spacer().frame(height: bottomBarReservedHeight(for: content))
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s2)
        }
        // RN keeps a `RefreshControl` on the wallet route (`app/wallet.tsx:50`)
        // — without it the balance can only be re-read by leaving and
        // re-entering the screen.
        .refreshable { await viewModel.refresh() }
        .background(Theme.Color.appBg)
    }

    private func heroSection(_ content: WalletContent) -> some View {
        BalanceHero(
            overline: "Available to withdraw",
            amount: content.available,
            currencyCode: "USD",
            split: [
                .init(
                    icon: .clock,
                    overline: "Pending",
                    value: content.pending,
                    note: content.pendingMeta
                ),
                .init(
                    icon: .trendingUp,
                    overline: "This month",
                    value: content.monthValue,
                    note: content.monthMeta
                )
            ],
            tone: content.isOnHold ? .holdTone : .default,
            holdHeadline: content.holdState?.heroBannerHeadline,
            holdBody: content.holdState?.heroBannerBody
        )
    }

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
                    .accessibilityIdentifier("walletSeeAllActivity")
                }
            }
            .padding(.top, Spacing.s4)
            .padding(.bottom, Spacing.s1)
            content()
        }
    }

    private func bottomBar(_ content: WalletContent) -> some View {
        VStack(spacing: Spacing.s0) {
            // Gradient fade — `appBg` α0 → α0.92 → 1 — design-specced
            // explicitly NOT a solid frosted dock.
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
            VStack(spacing: 6) {
                if content.isOnHold {
                    WithdrawLockedCTA(amount: content.available)
                    if let footnote = content.holdState?.withdrawFootnote {
                        Text(footnote)
                            .font(.system(size: 10.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .accessibilityIdentifier("walletWithdrawFootnote")
                    }
                } else if !content.payoutsEnabled {
                    // Block 3C — withdraw is gated behind Stripe Connect payouts.
                    SetupPayoutsCTA { Task { await viewModel.setupPayouts() } }
                    Text("Set up payouts to withdraw your earnings.")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .accessibilityIdentifier("wallet.connectStatus")
                } else if content.frozen {
                    // `Wallet.frozen` — the server answers this withdraw with
                    // 403 "Wallet is frozen", so the CTA must not look live.
                    WithdrawLockedCTA(amount: content.available)
                    Text("Your wallet is frozen. Contact support to release your funds.")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .accessibilityIdentifier("wallet.frozenNote")
                } else if !content.hasBalance {
                    WithdrawLockedCTA(amount: content.available)
                    Text("No funds to withdraw yet.")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .accessibilityIdentifier("wallet.noFundsNote")
                } else {
                    WithdrawCTA(amount: content.available) { showWithdrawSheet = true }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s5)
            .padding(.top, Spacing.s2)
            .background(Theme.Color.appBg)
        }
    }

    /// Reserve scroll-padding so the last card isn't covered by the
    /// sticky bottom bar. Hold-state needs more headroom for the
    /// footnote.
    private func bottomBarReservedHeight(for content: WalletContent) -> CGFloat {
        content.canWithdraw ? 96 : 120
    }

    private var loadingShell: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Shimmer(height: 188, cornerRadius: Radii.xl + 2)
                Shimmer(height: 220, cornerRadius: Radii.xl)
                Shimmer(height: 66, cornerRadius: Radii.xl)
                Shimmer(height: 66, cornerRadius: Radii.xl)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s8)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("walletLoading")
    }

    private func errorShell(_ message: String) -> some View {
        EmptyState(
            icon: .alertCircle,
            headline: "Couldn't load wallet",
            subcopy: message,
            cta: EmptyState.CTA(title: "Try again") { await viewModel.refresh() }
        )
        .accessibilityIdentifier("walletError")
    }

    // MARK: - Withdraw confirm (Block 3C)

    /// Available balance string for whichever loaded frame is showing.
    private var currentAvailable: String {
        switch viewModel.state {
        case let .populated(content), let .hold(content): content.available
        default: "0.00"
        }
    }

    private var withdrawSheet: some View {
        VStack(spacing: Spacing.s4) {
            Icon(.arrowDownToLine, size: 32, color: Theme.Color.primary600)
            Text("Withdraw to your bank")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("Funds arrive in 2–3 business days. "
                + "Available to withdraw: $\(currentAvailable).")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            // RN gives the user a decimal-pad amount field and posts *that*
            // amount (`components/payments/WalletTab.tsx:193`) — leaving it
            // blank keeps the whole-balance shortcut.
            VStack(alignment: .leading, spacing: Spacing.s1) {
                HStack(spacing: Spacing.s2) {
                    Text("$")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    TextField("Amount", text: $withdrawAmount)
                        .keyboardType(.decimalPad)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .onChange(of: withdrawAmount) { _, _ in viewModel.clearWithdrawError() }
                        .accessibilityIdentifier("wallet.withdrawAmountField")
                    Button("Max") { withdrawAmount = currentAvailable }
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.primary600)
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("wallet.withdrawMaxBtn")
                }
                .padding(.horizontal, Spacing.s3)
                .frame(height: 48)
                .background(Theme.Color.appSurfaceSunken)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(
                            viewModel.withdrawError == nil
                                ? Theme.Color.appBorder
                                : Theme.Color.error,
                            lineWidth: 1
                        )
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                if let error = viewModel.withdrawError {
                    Text(error)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityIdentifier("wallet.withdrawAmountError")
                }
            }
            Button {
                Task { await confirmWithdraw() }
            } label: {
                Text(viewModel.action == .withdrawing ? "Processing…" : "Confirm withdrawal")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(viewModel.action == .withdrawing)
            .accessibilityIdentifier("wallet.withdrawBtn")
            Button("Cancel") { showWithdrawSheet = false }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .buttonStyle(.plain)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity)
        .presentationDetents([.height(400)])
        .accessibilityIdentifier("wallet.withdrawSheet")
    }

    /// RN re-verifies identity at the moment of withdrawal, on top of the
    /// screen guard (`components/payments/WalletTab.tsx:88`). The prompt has
    /// to be raised from the view layer — Android needs the host Activity,
    /// and this keeps both platforms symmetric.
    private func confirmWithdraw() async {
        let trimmed = withdrawAmount.trimmingCharacters(in: .whitespaces)
        switch await AppLockManager.shared.verifySensitiveAction(reason: "Approve wallet withdrawal") {
        case .verified:
            await viewModel.withdraw(amountText: trimmed.isEmpty ? nil : trimmed)
            if viewModel.withdrawError == nil { withdrawAmount = "" }
        case .cancelled:
            break
        case let .failed(message):
            toast = ToastMessage(text: message, kind: .error)
        }
    }

    // MARK: - Result toast

    @ViewBuilder private var toastOverlay: some View {
        if let toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s10)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .accessibilityIdentifier(toastIdentifier(for: toast.kind))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    self.toast = nil
                }
        }
    }

    private func toastIdentifier(for kind: ToastKind) -> String {
        switch kind {
        case .success: "wallet.withdrawSuccess"
        case .error: "wallet.actionError"
        case .neutral: "wallet.actionStatus"
        }
    }

    private func handle(_ action: WalletViewModel.Action) {
        switch action {
        case .idle, .withdrawing, .connecting:
            break
        case let .withdrawSucceeded(message):
            showWithdrawSheet = false
            toast = ToastMessage(text: message, kind: .success)
            viewModel.clearAction()
        case let .withdrawFailed(message), let .actionFailed(message):
            showWithdrawSheet = false
            toast = ToastMessage(text: message, kind: .error)
            viewModel.clearAction()
        }
    }
}

// MARK: - Set-up-payouts CTA (Block 3C — withdraw gate)

private struct SetupPayoutsCTA: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s2) {
                Icon(.shieldCheck, size: 17, strokeWidth: 2.2, color: .white)
                Text("Set up payouts")
                    .font(.system(size: 15, weight: .bold))
                    .tracking(-0.15)
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
        .accessibilityLabel("Set up payouts")
        .accessibilityIdentifier("wallet.setupPayoutsBtn")
    }
}

// MARK: - Top bar

private struct WalletTopBar: View {
    let onBack: () -> Void
    let onOpenHistory: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("walletBackButton")

            Spacer(minLength: Spacing.s0)

            Text("Wallet")
                .font(.system(size: 14, weight: .semibold))
                .tracking(-0.15)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)

            Spacer(minLength: Spacing.s0)

            Button(action: onOpenHistory) {
                Icon(.history, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("History")
            .accessibilityIdentifier("walletHistoryButton")
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }
}

// MARK: - Activity list

private struct ActivityList: View {
    let items: [WalletActivityItem]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                if index == 0 || items[index - 1].day != item.day {
                    Text(item.day)
                        .font(.system(size: 9.5, weight: .bold))
                        .tracking(0.7)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, 14)
                        .padding(.top, index == 0 ? Spacing.s2 : Spacing.s3)
                        .padding(.bottom, Spacing.s1)
                        .overlay(alignment: .top) {
                            if index != 0 {
                                Rectangle()
                                    .fill(Theme.Color.appBorderSubtle)
                                    .frame(height: 1)
                            }
                        }
                }
                WalletActivityRow(item: item, isLast: index == items.count - 1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .pantopusShadow(.sm)
    }
}

// MARK: - Withdraw CTA + locked variant

private struct WithdrawCTA: View {
    let amount: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s0) {
                HStack(spacing: Spacing.s2) {
                    Icon(.arrowDownToLine, size: 17, strokeWidth: 2.2, color: .white)
                    Text("Withdraw")
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
        .accessibilityLabel("Withdraw $\(amount)")
        .accessibilityIdentifier("walletWithdrawButton")
    }
}

private struct WithdrawLockedCTA: View {
    let amount: String

    var body: some View {
        HStack(spacing: Spacing.s0) {
            HStack(spacing: Spacing.s2) {
                Icon(.lock, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextMuted)
                Text("Withdraw")
                    .font(.system(size: 15, weight: .bold))
                    .tracking(-0.15)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s2)
            Text("$\(amount)")
                .font(.system(size: 15, weight: .bold))
                .tracking(-0.15)
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .accessibilityLabel("Withdraw locked. $\(amount).")
        .accessibilityIdentifier("walletWithdrawLockedButton")
    }
}

#Preview("Wallet · populated") {
    WalletView(viewModel: WalletViewModel(content: WalletSampleData.populated))
}

#Preview("Wallet · hold") {
    WalletView(viewModel: WalletViewModel(content: WalletSampleData.onHold))
}

#Preview("Wallet · loading") {
    WalletView(viewModel: WalletViewModel(state: .loading))
}

#Preview("Wallet · error") {
    WalletView(viewModel: WalletViewModel(state: .error(message: "Network unavailable.")))
}
