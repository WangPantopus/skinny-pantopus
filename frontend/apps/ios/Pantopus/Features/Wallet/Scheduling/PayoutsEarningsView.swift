//
//  PayoutsEarningsView.swift
//  Pantopus
//
//  G7 Payouts & Earnings (Stream I14) — the Calendarly extension of the A10.10
//  Wallet. Reuses the Wallet's `BalanceHero`, `PayoutMethodCard`, `TaxDocsRow`,
//  and `HoldBanner`, and adds a booking-source filter + violet booking-earnings
//  rows with honest Pending/Processing settlement. Four frames: populated /
//  on-hold (re-verify) / payouts-not-enabled / empty. Wallet chrome stays
//  neutral sky; only the booking source/category go business violet.
//

// swiftlint:disable file_length

import SwiftUI

struct PayoutsEarningsView: View {
    @State private var model: PayoutsEarningsViewModel
    @State private var showWithdrawConfirm = false
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: PayoutsEarningsViewModel(owner: owner, push: push, client: client))
    }

    var body: some View {
        PaidSurfaceGate(title: "Wallet", onBack: { dismiss() }, content: {
            gatedBody
        })
        .task { await model.load() }
    }

    private var gatedBody: some View {
        VStack(spacing: Spacing.s0) {
            BizTopBar(
                title: "Wallet",
                trailing: AnyView(
                    Icon(.history, size: 19, color: Theme.Color.appText)
                        .frame(width: 36, height: 36)
                        .accessibilityLabel("Transaction history")
                )
            ) { dismiss() }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .overlay(alignment: .bottom) { toastOverlay }
        .accessibilityIdentifier("scheduling.payoutsEarnings")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .confirmationDialog(
            "Withdraw $\(model.availableDisplay) to your bank?",
            isPresented: $showWithdrawConfirm,
            titleVisibility: .visible
        ) {
            Button("Withdraw $\(model.availableDisplay)") { Task { await model.withdraw() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Instant payout · funds arrive in 1–3 minutes.")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            loadingShell
        case .loaded:
            ZStack(alignment: .bottom) {
                scroll
                withdrawBar
            }
        case let .error(message):
            PaymentsErrorView(message: message) { Task { await model.load() } }
        }
    }
}

// MARK: - Section builders

extension PayoutsEarningsView {
    // MARK: Scroll

    private var scroll: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s0) {
                if model.payoutState == .onHold {
                    HoldBanner(
                        headline: "Your bank needs re-verifying",
                        bodyText: "A 2-minute check unlocks payouts. Earnings keep landing — they're safe."
                    )
                    .padding(.bottom, Spacing.s3)
                }

                hero
                    .padding(.bottom, Spacing.s3)

                filterRow
                    .padding(.bottom, Spacing.s2)

                sectionOverline(
                    model.source == .all ? "Recent activity" : model.source.label,
                    action: model.isEmpty ? nil : "See all"
                )
                if model.isEmpty { emptyEarnings } else { earningsList }

                sectionOverline("Payout method").padding(.top, Spacing.s4)
                payoutSection

                if model.payoutState == .enabled, !model.isEmpty {
                    sectionOverline("Taxes").padding(.top, Spacing.s4)
                    TaxDocsRow(
                        docs: WalletTaxDocs(ready: false, bodyText: "Documents are issued in mid-January.")
                    ) { Task { await model.openDashboard() } }
                }

                Color.clear.frame(height: 112)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
        }
        .refreshable { await model.refresh() }
    }

    private var hero: some View {
        BalanceHero(
            overline: "Available to withdraw",
            amount: model.availableDisplay,
            currencyCode: "USD",
            split: [
                .init(icon: .clock, overline: "Pending", value: model.pendingDisplay, note: model.pendingMeta),
                .init(icon: .trendingUp, overline: "This month", value: model.monthDisplay, note: model.monthMeta)
            ],
            tone: model.payoutState == .onHold ? .holdTone : .default,
            holdHeadline: model.payoutState == .onHold ? "Withdrawals paused" : nil,
            holdBody: model.payoutState == .onHold ? "Funds are safe while we re-verify your bank." : nil
        )
    }

    private func sectionOverline(_ title: String, action: String? = nil) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            if let action {
                Spacer(minLength: Spacing.s0)
                Text(action)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                    .accessibilityIdentifier("scheduling.payoutsEarnings.seeAll")
            }
        }
        .padding(.bottom, Spacing.s2)
    }

    // MARK: Filter chips

    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(EarningsSource.allCases) { option in
                    filterChip(option)
                }
            }
            .padding(.horizontal, 1)
        }
    }

    private func filterChip(_ option: EarningsSource) -> some View {
        let on = model.source == option
        let fill = option == .booking ? Theme.Color.business : Theme.Color.primary600
        return Button { model.source = option } label: {
            Text(option.label)
                .font(.system(size: 11.5, weight: .bold))
                .foregroundStyle(on ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                .padding(.horizontal, Spacing.s3)
                .frame(height: 30)
                .background(on ? fill : Theme.Color.appSurface)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(on ? Color.clear : Theme.Color.appBorder, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.payoutsEarnings.filter.\(option.rawValue)")
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: Earnings list

    private var earningsList: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            ForEach(Array(model.rows.enumerated()), id: \.element.id) { index, row in
                if index == 0 || model.rows[index - 1].day != row.day {
                    Text(row.day.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.7)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, 13)
                        .padding(.top, index == 0 ? Spacing.s2 : Spacing.s3)
                        .padding(.bottom, Spacing.s1)
                        .overlay(alignment: .top) {
                            if index != 0 {
                                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                            }
                        }
                }
                EarningRowView(row: row, isLast: index == model.rows.count - 1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(.sm)
    }

    private var emptyEarnings: some View {
        VStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.businessBg).frame(width: 54, height: 54)
                Icon(.calendarCheck, size: 24, strokeWidth: 1.8, color: Theme.Color.business)
            }
            Text("No \(model.source == .all ? "earnings" : model.source.label.lowercased()) yet")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("Your booking earnings will show up here next to your gigs.")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 220)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s8)
        .padding(.horizontal, Spacing.s5)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("scheduling.payoutsEarnings.empty")
    }

    // MARK: Payout method section

    @ViewBuilder
    private var payoutSection: some View {
        switch model.payoutState {
        case .notEnabled:
            Button { Task { await model.setupPayouts() } } label: {
                HStack(spacing: 11) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Theme.Color.stripeBrand.opacity(0.10))
                        if model.connecting {
                            ProgressView().tint(Theme.Color.stripeBrand)
                        } else {
                            Icon(.creditCard, size: 16, color: Theme.Color.stripeBrand)
                        }
                    }
                    .frame(width: 32, height: 32)
                    Text("Connect Stripe to get paid out")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Spacer(minLength: Spacing.s2)
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(Spacing.s3)
                .frame(maxWidth: .infinity)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .stroke(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("scheduling.payoutsEarnings.connectTile")
        case .onHold:
            PayoutMethodCard(
                method: WalletPayoutMethod(
                    bankLabel: "Bank account",
                    last4: "••••",
                    bodyText: "Verification expired",
                    warn: true
                ),
                onManage: { Task { await model.openDashboard() } },
                onReverify: { Task { await model.setupPayouts() } }
            )
        case .enabled:
            PayoutMethodCard(
                method: WalletPayoutMethod(
                    bankLabel: "Bank account",
                    last4: "••••",
                    bodyText: "Instant payout · 1–3 min",
                    warn: false
                ),
                onManage: { Task { await model.openDashboard() } },
                onReverify: { Task { await model.setupPayouts() } }
            )
        }
    }

    // MARK: Withdraw bar

    private var withdrawBar: some View {
        VStack(spacing: Spacing.s0) {
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
                if model.canWithdraw {
                    PayoutsWithdrawButton(amount: model.availableDisplay) { showWithdrawConfirm = true }
                } else {
                    PayoutsWithdrawLocked(amount: model.availableDisplay)
                    Text(lockedFootnote)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .accessibilityIdentifier("scheduling.payoutsEarnings.withdrawFootnote")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s5)
            .background(Theme.Color.appBg)
        }
    }

    private var lockedFootnote: String {
        switch model.payoutState {
        case .onHold: "Re-verify your bank above to unlock payouts."
        case .notEnabled: "Finish Stripe setup to withdraw"
        case .enabled: "Take a booking to start earning"
        }
    }

    // MARK: Loading

    private var loadingShell: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Shimmer(height: 188, cornerRadius: Radii.xl2)
                Shimmer(height: 30, cornerRadius: Radii.pill)
                Shimmer(height: 200, cornerRadius: Radii.xl)
                Shimmer(height: 66, cornerRadius: Radii.xl)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
        }
        .accessibilityIdentifier("scheduling.payoutsEarnings.loading")
    }

    // MARK: Toast

    @ViewBuilder
    private var toastOverlay: some View {
        if let toast = model.toast {
            HStack(spacing: Spacing.s2) {
                Icon(toastIcon(toast), size: 15, color: Theme.Color.appTextInverse)
                Text(toastText(toast))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 10)
            .background(Theme.Color.appText)
            .clipShape(Capsule())
            .pantopusShadow(.lg)
            .padding(.bottom, Spacing.s12)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .task {
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                model.clearToast()
            }
            .accessibilityIdentifier("scheduling.payoutsEarnings.toast")
        }
    }

    private func toastIcon(_ toast: PayoutsEarningsViewModel.Toast) -> PantopusIcon {
        switch toast {
        case .success: .check
        case .error: .alertCircle
        }
    }

    private func toastText(_ toast: PayoutsEarningsViewModel.Toast) -> String {
        switch toast {
        case let .success(message), let .error(message): message
        }
    }
}

// MARK: - Earning row

private struct EarningRowView: View {
    let row: EarningRow
    let isLast: Bool

    var body: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous).fill(tileBg)
                Icon(tileIcon, size: 15, color: tileFg)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: Spacing.s1) {
                    Text(row.description)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if row.isPending {
                        Text("Pending")
                            .font(.system(size: 8.5, weight: .bold))
                            .textCase(.uppercase)
                            .foregroundStyle(WalletPalette.amberDeep)
                            .padding(.horizontal, Spacing.s1)
                            .padding(.vertical, 1)
                            .background(Theme.Color.warningBg)
                            .clipShape(Capsule())
                    }
                }
                Text(row.time)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(row.direction == .out ? "−" : "+")$\(row.amount)")
                    .font(.system(size: 13, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(amountColor)
                Text(row.statusLabel)
                    .font(.system(size: 9.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 10)
        .overlay(alignment: .bottom) {
            if !isLast { Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, 56) }
        }
    }

    private var tileBg: Color {
        if row.isFee { return Theme.Color.appSurfaceSunken }
        if row.direction == .out { return Theme.Color.appSurfaceSunken }
        switch row.source {
        case .booking, .packages: return Theme.Color.businessBg
        case .gigs, .all: return Theme.Color.primary50
        }
    }

    private var tileFg: Color {
        if row.isFee { return Theme.Color.appTextSecondary }
        if row.direction == .out { return Theme.Color.appTextSecondary }
        switch row.source {
        case .booking, .packages: return Theme.Color.business
        case .gigs, .all: return Theme.Color.primary600
        }
    }

    private var tileIcon: PantopusIcon {
        if row.isFee { return .receipt }
        if row.direction == .out { return .building2 }
        switch row.source {
        case .booking: return .calendarCheck
        case .packages: return .layers
        case .gigs, .all: return .dollarSign
        }
    }

    private var amountColor: Color {
        if row.direction == .out { return Theme.Color.appTextStrong }
        return row.isPending ? WalletPalette.amberDeep : Theme.Color.success
    }
}

// MARK: - Withdraw buttons

private struct PayoutsWithdrawButton: View {
    let amount: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s0) {
                HStack(spacing: Spacing.s2) {
                    Icon(.arrowDownToLine, size: 17, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                    Text("Withdraw")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                Spacer(minLength: Spacing.s2)
                Text("$\(amount)")
                    .font(.system(size: 15, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .pantopusShadow(.primary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Withdraw $\(amount)")
        .accessibilityIdentifier("scheduling.payoutsEarnings.withdrawButton")
    }
}

private struct PayoutsWithdrawLocked: View {
    let amount: String

    var body: some View {
        HStack(spacing: Spacing.s0) {
            HStack(spacing: Spacing.s2) {
                Icon(.lock, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextMuted)
                Text("Withdraw")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s2)
            Text("$\(amount)")
                .font(.system(size: 15, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("scheduling.payoutsEarnings.withdrawLocked")
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        PayoutsEarningsView(owner: .business(id: "biz1")) { _ in }
    }
}
#endif
