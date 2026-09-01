//
//  PaymentsView.swift
//  Pantopus
//
//  P5.2 / A14.6 — Settings → Payments. The payments-OUT surface
//  (cards on file · Stripe Connect setup · payout routing) — distinct
//  from A10.10 Wallet (earnings-in). Three grouped cards under an
//  optional balance hero, with an "Add payment method" blue row as
//  the final item in the Payment methods card (iOS convention) and a
//  destructive Close-account card on the populated frame only.
//
//  Saved cards use Stripe PaymentSheet. Payout rows can route into the
//  Wallet surface, where Stripe Connect onboarding/dashboard live.
//

// swiftlint:disable file_length

import SwiftUI

public struct PaymentsView: View {
    @State private var viewModel: PaymentsViewModel
    @State private var actionMethod: PaymentMethod?
    private let onBack: @MainActor () -> Void
    private let onOpenWallet: @MainActor () -> Void

    public init(
        viewModel: PaymentsViewModel = PaymentsViewModel(),
        onBack: @escaping @MainActor () -> Void,
        onOpenWallet: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onOpenWallet = onOpenWallet
    }

    public var body: some View {
        // Money surface — RN wraps this route in `SensitiveScreenGuard`
        // (`app/settings/payments.tsx:31`), so the device credential is
        // checked before any card / payout detail is composed.
        SensitiveScreenGuard(
            reason: "Verify to access Payments & Payouts",
            onRejected: onBack
        ) {
            guardedBody
        }
    }

    private var guardedBody: some View {
        VStack(spacing: Spacing.s0) {
            SettingsTopBar(title: "Payments", onBack: onBack)
                .accessibilityIdentifier("paymentsTopBar")
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .accessibilityIdentifier("payments.screen")
        .sensitiveScreen()
        .confirmationDialog(
            actionMethod?.label ?? "Payment method",
            isPresented: Binding(
                get: { actionMethod != nil },
                set: { if !$0 { actionMethod = nil } }
            ),
            titleVisibility: .visible
        ) {
            methodActions
        }
        // Second, destructive step before `DELETE /api/payments/methods/{id}`
        // — mirrors Android's `RemoveMethodDialog` (`PaymentsScreen.kt:244`),
        // an `AlertDialog` naming the card. Same shape as the Members screen's
        // action-sheet → remove-confirm chain (`MembersListView.swift:176`).
        .alert(
            "Remove card",
            isPresented: Binding(
                get: { viewModel.pendingRemoval != nil },
                set: { if !$0 { viewModel.cancelRemoval() } }
            ),
            presenting: viewModel.pendingRemoval
        ) { method in
            Button("Remove", role: .destructive) {
                Task { await viewModel.removeMethod(method.id) }
            }
            .accessibilityIdentifier("paymentsRemoveConfirm")
            Button("Cancel", role: .cancel) { viewModel.cancelRemoval() }
                .accessibilityIdentifier("paymentsRemoveCancel")
        } message: { method in
            Text("Are you sure you want to remove \(Self.removalSubject(method))?")
        }
        .alert(
            "Something went wrong",
            isPresented: Binding(
                get: { viewModel.actionError != nil },
                set: { if !$0 { viewModel.clearActionError() } }
            )
        ) {
            Button("OK", role: .cancel) { viewModel.clearActionError() }
        } message: {
            Text(viewModel.actionError ?? "")
        }
    }

    @ViewBuilder private var methodActions: some View {
        if let method = actionMethod {
            if method.chip?.tone != .primary {
                Button("Set as Default") {
                    Task { await viewModel.setDefault(method.id) }
                }
                .accessibilityIdentifier("paymentsRow_\(method.id)_setDefault")
            }
            Button("Remove Card", role: .destructive) {
                // Dismiss the action menu and hand off to the destructive
                // confirmation — the DELETE only fires once the user confirms.
                actionMethod = nil
                viewModel.requestRemoval(method)
            }
            .accessibilityIdentifier("paymentsRow_\(method.id)_remove")
            Button("Cancel", role: .cancel) {}
        }
    }

    /// Names the method the way the confirmation body reads — "the card
    /// ending in 4421" when the server sent the digits, otherwise the row's
    /// own "<Brand> •• <last4>" label.
    private static func removalSubject(_ method: PaymentMethod) -> String {
        if let last4 = method.last4, !last4.isEmpty {
            return "the card ending in \(last4)"
        }
        return method.label
    }
}

private extension PaymentsView {
    @ViewBuilder var content: some View {
        switch viewModel.state {
        case .loading: loadingFrame
        case let .loaded(loaded): loadedFrame(loaded)
        case let .error(message): errorFrame(message: message)
        }
    }

    // MARK: - Loaded

    private func loadedFrame(_ loaded: PaymentsLoaded) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                if let balance = loaded.balance {
                    balanceHero(balance)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.top, 14)
                }
                methodsSection(loaded.methods)
                payoutsSection(loaded.payouts)
                if let earnings = loaded.earnings {
                    earningsSection(earnings)
                }
                activitySection(loaded.activity)
                if loaded.canCloseAccount {
                    destructiveCard
                }
                Text(loaded.footerCaption)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, 18)
                    .padding(.bottom, Spacing.s5)
                    .frame(maxWidth: .infinity)
                    .accessibilityIdentifier("paymentsFooter")
            }
            .padding(.bottom, Spacing.s5)
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("paymentsContent")
    }

    private func balanceHero(_ balance: PaymentsBalance) -> some View {
        BalanceHero(
            overline: balance.overline,
            amount: balance.amount,
            currencyCode: "USD",
            payoutFooter: BalanceHero.PayoutFooter(
                nextPayoutLabel: balance.nextPayoutLabel,
                frequencyPill: balance.frequencyPill
            )
        )
        .accessibilityIdentifier("paymentsBalanceHero")
    }

    // MARK: - Sections

    private func methodsSection(_ methods: [PaymentMethod]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            sectionOverline("Payment methods", id: "methods")
            card(id: "methods") {
                if methods.isEmpty {
                    inlineEmpty(
                        icon: .creditCard,
                        title: "No payment methods yet",
                        body: "Add a card or bank account to hire neighbors and pay for marketplace listings."
                    )
                    divider
                } else {
                    ForEach(Array(methods.enumerated()), id: \.element.id) { index, method in
                        Button(action: {
                            actionMethod = method
                        }, label: {
                            PaymentMethodRow(
                                brand: method.brand,
                                label: method.label,
                                subtext: method.subtext,
                                chip: method.chip,
                                trailing: .chevron,
                                rowIdentifier: method.id,
                                rowAccessibilityIdentifier: "payments.method.\(method.id)",
                                chipIdentifier: method.chip != nil
                                    ? "paymentsRow_\(method.id)_defaultBadge"
                                    : nil
                            )
                        })
                        .buttonStyle(.plain)
                        if index < methods.count - 1 {
                            divider
                        }
                    }
                    divider
                }
                addMethodRow
            }
        }
    }

    private func payoutsSection(_ payouts: PaymentsPayouts) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            sectionOverline("Payouts", id: "payouts")
            card(id: "payouts") {
                payoutRow(payouts.stripe)
                divider
                payoutRow(payouts.payoutMethod)
                if let schedule = payouts.payoutSchedule {
                    divider
                    payoutRow(schedule)
                }
                divider
                payoutRow(payouts.taxInfo)
            }
            if let helper = payouts.helper {
                Text(helper)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("paymentsHelper_payouts")
            }
        }
    }

    /// "Earnings & Spending" — the two lifetime totals from
    /// `GET /api/payments/earnings` + `/spending`, mirroring RN
    /// `components/payments/PayoutsTab.tsx:251`.
    private func earningsSection(_ earnings: PaymentsEarnings) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            sectionOverline("Earnings & spending", id: "earnings")
            card(id: "earnings") {
                HStack(spacing: Spacing.s3) {
                    earningsTile(
                        label: "Total earned",
                        value: earnings.totalEarned,
                        tint: Theme.Color.success,
                        identifier: "paymentsTotalEarned"
                    )
                    earningsTile(
                        label: "Total spent",
                        value: earnings.totalSpent,
                        tint: Theme.Color.primary600,
                        identifier: "paymentsTotalSpent"
                    )
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
                Text(earnings.caption)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s3)
                    .padding(.bottom, Spacing.s4)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("paymentsEarningsCaption")
            }
        }
    }

    private func earningsTile(
        label: String,
        value: String,
        tint: Color,
        identifier: String
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .kerning(0.8)
                .foregroundStyle(tint)
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(tint.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(tint.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier(identifier)
    }

    private func activitySection(_ activity: PaymentsActivity) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            sectionOverline("Activity", id: "activity")
            card(id: "activity") {
                switch activity {
                case let .stats(stats):
                    ForEach(Array(stats.enumerated()), id: \.element.id) { index, stat in
                        activityStatRow(stat)
                        if index < stats.count - 1 {
                            divider
                        }
                    }
                case let .transactions(transactions):
                    ForEach(Array(transactions.enumerated()), id: \.element.id) { index, transaction in
                        transactionRow(transaction)
                        if index < transactions.count - 1 {
                            divider
                        }
                    }
                case let .empty(title, body):
                    activityEmptyRow(title: title, body: body)
                }
            }
        }
    }

    private var destructiveCard: some View {
        VStack(spacing: Spacing.s0) {
            Button(action: {
                Task { await viewModel.tapCloseAccount() }
            }, label: {
                HStack {
                    Text("Close payment account")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.Color.error)
                    Spacer(minLength: Spacing.s0)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 14)
                .frame(minHeight: 48)
                .contentShape(Rectangle())
            })
            .buttonStyle(.plain)
            .accessibilityIdentifier("paymentsRow_closeAccount")
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s3)
        .padding(.top, 18)
    }

    // MARK: - Row primitives

    private func payoutRow(_ row: PaymentsPayoutRow) -> some View {
        Button(action: {
            if row.id.starts(with: "payouts.") {
                onOpenWallet()
            } else {
                Task { await viewModel.tapRow(row.id) }
            }
        }, label: {
            PaymentMethodRow(
                brand: row.leadingBrand,
                label: row.label,
                subtext: row.subtext,
                chip: nil,
                trailing: row.trailing,
                rowIdentifier: row.id
            )
        })
        .buttonStyle(.plain)
        .disabled(row.trailing == .gatedDash)
    }

    private func activityStatRow(_ stat: PaymentsActivityStat) -> some View {
        HStack(spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text(stat.label)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                if let subtext = stat.subtext {
                    Text(subtext)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s0)
            Icon(.chevronRight, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 14)
        .frame(minHeight: 48)
        .accessibilityIdentifier("paymentsActivityStat_\(stat.id)")
    }

    /// One row of the real transaction-history feed
    /// (`GET /api/payments/history`). Icon + tint mirror RN's `HistoryTab`:
    /// tips get the star, payouts the indigo arrow disc, money-out red,
    /// money-in green.
    private func transactionRow(_ transaction: PaymentsTransaction) -> some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                Circle()
                    .fill(transactionTint(transaction.kind).opacity(0.12))
                    .frame(width: 32, height: 32)
                Icon(
                    transactionIcon(transaction.kind),
                    size: 16,
                    strokeWidth: 2.2,
                    color: transactionTint(transaction.kind)
                )
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                if !transaction.meta.isEmpty {
                    Text(transaction.meta)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: Spacing.s2)
            Text(transaction.amount)
                .font(.system(size: 15, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(transaction.isOutgoing ? Theme.Color.error : Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 14)
        .frame(minHeight: 48)
        .accessibilityIdentifier("paymentsTransaction_\(transaction.id)")
    }

    private func transactionIcon(_ kind: PaymentsTransaction.Kind) -> PantopusIcon {
        switch kind {
        case .tip: .star
        case .payout: .arrowUp
        case .sent: .arrowUp
        case .received: .arrowDown
        }
    }

    private func transactionTint(_ kind: PaymentsTransaction.Kind) -> Color {
        switch kind {
        case .tip: Theme.Color.warning
        case .payout: Theme.Color.primary600
        case .sent: Theme.Color.error
        case .received: Theme.Color.success
        }
    }

    private func activityEmptyRow(title: String, body: String) -> some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 32, height: 32)
                Icon(.receipt, size: 16, strokeWidth: 1.75, color: Theme.Color.appTextMuted)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(body)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 18)
        .accessibilityIdentifier("paymentsActivityEmpty")
    }

    private var addMethodRow: some View {
        Button(action: {
            Task { await viewModel.tapAddMethod() }
        }, label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                        .fill(Theme.Color.primary50)
                        .frame(width: 38, height: 26)
                    Icon(.plus, size: 16, strokeWidth: 2.5, color: Theme.Color.primary600)
                }
                Text("Add payment method")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 13)
            .frame(minHeight: 48)
            .contentShape(Rectangle())
        })
        .buttonStyle(.plain)
        .accessibilityIdentifier("payments.addMethodBtn")
    }

    private func inlineEmpty(icon: PantopusIcon, title: String, body: String) -> some View {
        VStack(spacing: Spacing.s2) {
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 48, height: 48)
                Icon(icon, size: 22, strokeWidth: 1.75, color: Theme.Color.appTextMuted)
            }
            .padding(.bottom, 2)
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(body)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 240)
                .lineSpacing(2)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 28)
        .padding(.bottom, 22)
        .accessibilityIdentifier("payments.empty")
    }

    // MARK: - Card chrome

    private func card(id: String, @ViewBuilder _ rows: () -> some View) -> some View {
        VStack(spacing: Spacing.s0) {
            rows()
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s3)
        .accessibilityIdentifier("paymentsCard_\(id)")
    }

    private var divider: some View {
        Rectangle()
            .fill(Theme.Color.appBorder.opacity(0.6))
            .frame(height: 1)
            .padding(.leading, Spacing.s4)
    }

    private func sectionOverline(_ text: String, id: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .kerning(0.9)
            .padding(.horizontal, Spacing.s4)
            .padding(.top, 18)
            .padding(.bottom, Spacing.s2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier("paymentsOverline_\(id)")
    }

    // MARK: - Loading / Error

    private var loadingFrame: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                Shimmer(height: 96, cornerRadius: 18)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.top, 14)
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(height: 110, cornerRadius: Radii.lg)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.top, Spacing.s3)
                }
            }
        }
        .accessibilityIdentifier("paymentsLoading")
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load Payments")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("paymentsRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("paymentsError")
    }
}

#Preview("Populated") {
    PaymentsView(viewModel: PaymentsViewModel(seed: .populated)) {}
}

#Preview("Empty") {
    PaymentsView(viewModel: PaymentsViewModel(seed: .empty)) {}
}
