//
//  PaymentsSetupView.swift
//  Pantopus
//
//  G6 Payments Setup · Stripe Connect & Tax (Stream I14). A status hero with
//  three readiness pills (charges / payouts / details) over grouped Account +
//  Tax cards whose final blue row carries the connect/resume/finish action.
//  Five frames: not-connected / incomplete / ready / restricted / returned.
//  Matches `paymentssetup-frames.jsx`. Tokens only; functional CTAs sky.
//

import SwiftUI

struct PaymentsSetupView: View {
    @State private var model: PaymentsSetupViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: PaymentsSetupViewModel(owner: owner, push: push, client: client))
    }

    var body: some View {
        PaidSurfaceGate(title: "Payments", onBack: { dismiss() }, content: {
            gatedBody
        })
        .task { await model.load() }
    }

    private var gatedBody: some View {
        VStack(spacing: Spacing.s0) {
            BizTopBar(title: "Payments") { dismiss() }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .overlay(alignment: .top) { actionToast }
        .accessibilityIdentifier("scheduling.paymentsSetup")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            PaymentsSkeleton()
        case .loaded:
            if model.isApplicable {
                loadedBody
            } else {
                PaymentsNotApplicableView { dismiss() }
            }
        case let .error(message):
            PaymentsErrorView(message: message) { Task { await model.load() } }
        }
    }
}

// MARK: - Section builders

extension PaymentsSetupView {
    private var loadedBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text(introText)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s1)
                    .padding(.top, Spacing.s1)

                if model.justReturned { returnedBanner }

                statusHero

                noteForSetup

                accountGroup
                taxGroup

                Color.clear.frame(height: Spacing.s8)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s2)
        }
    }

    private var introText: String {
        switch model.setup {
        case .notConnected, .ready: "Connect Stripe to take payments and get paid out."
        case .incomplete, .restricted: "Verification keeps your payouts flowing."
        }
    }

    // MARK: Returned banner (frame 5)

    private var returnedBanner: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.success)
                Icon(.check, size: 18, strokeWidth: 3, color: Theme.Color.appTextInverse)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text("You're set up to take payments.")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
                Text("Welcome back from Stripe.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.success)
                    .opacity(0.85)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("scheduling.paymentsSetup.returnedBanner")
    }

    // MARK: Status hero

    private var statusHero: some View {
        BizCard(padding: EdgeInsets(top: 13, leading: 13, bottom: 13, trailing: 13)) {
            VStack(alignment: .leading, spacing: 11) {
                HStack(alignment: .top, spacing: 11) {
                    stripeBadge
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 7) {
                            Text(heroHeadline)
                                .font(.system(size: 13.5, weight: .bold))
                                .foregroundStyle(Theme.Color.appText)
                            heroChip
                        }
                        Text(heroBody)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: Spacing.s0)
                }
                HStack(spacing: 7) {
                    ReadinessPill(label: "Charges", state: model.chargesPill)
                    ReadinessPill(label: "Payouts", state: model.payoutsPill)
                    ReadinessPill(label: "Details", state: model.detailsPill)
                }
            }
        }
        .accessibilityIdentifier("scheduling.paymentsSetup.hero")
    }

    private var stripeBadge: some View {
        Text(verbatim: "S")
            .font(.system(size: 17, weight: .heavy))
            .tracking(-0.5)
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(width: 34, height: 34)
            .background(Theme.Color.stripeBrand)
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            .accessibilityHidden(true)
    }

    private var heroHeadline: String {
        switch model.setup {
        case .notConnected: "Not connected"
        case .incomplete: "Setup unfinished"
        case .restricted: "Action needed"
        case .ready: "Stripe"
        }
    }

    private var heroBody: String {
        switch model.setup {
        case .notConnected: "Pantopus uses Stripe to charge for bookings and pay you out."
        case .incomplete: "A few details are still needed before you can charge."
        case .restricted: "Charges still work, but payouts are paused until you verify."
        case .ready: "Charges and payouts are on. You're ready to take bookings."
        }
    }

    @ViewBuilder
    private var heroChip: some View {
        switch model.setup {
        case .notConnected: StatusChip("Off", variant: .neutral)
        case .incomplete: StatusChip("In review", variant: .warning)
        case .restricted: StatusChip("Restricted", variant: .error)
        case .ready: StatusChip("Connected", variant: .success, icon: .check)
        }
    }

    @ViewBuilder
    private var noteForSetup: some View {
        switch model.setup {
        case .incomplete:
            BizNote(tone: .warning, icon: .alertTriangle, text: "Finish setup on Stripe to start charging.")
        case .restricted:
            BizNote(tone: .error, icon: .shieldAlert, text: "Stripe needs more info to keep payouts on.")
        case .notConnected, .ready:
            EmptyView()
        }
    }

    // MARK: Account group

    private var accountGroup: some View {
        BizGroup(title: "Account", accent: model.accent) {
            BizSettingsRow(
                icon: .dollarSign,
                label: "Default currency",
                sub: model.isConnected ? "USD" : nil,
                trailing: { rowTrailing },
                onTap: model.isConnected ? { Task { await model.openDashboard() } } : nil
            )
            BizRowDivider()
            BizSettingsRow(
                icon: .textCursorInput,
                label: "Statement descriptor",
                sub: model.isConnected ? "Managed on Stripe" : nil,
                trailing: { rowTrailing },
                onTap: model.isConnected ? { Task { await model.openDashboard() } } : nil
            )
            if model.isConnected {
                BizRowDivider()
                BizSettingsRow(
                    icon: .wallet,
                    label: "Payouts",
                    sub: "Managed on Stripe",
                    trailing: { Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted) },
                    onTap: { Task { await model.openDashboard() } }
                )
            }
            if model.setup != .ready {
                BizRowDivider()
                connectActionRow
            }
        }
    }

    /// The em-dashed gate (not connected) or a chevron (connected) trailing.
    @ViewBuilder
    private var rowTrailing: some View {
        if model.isConnected {
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        } else {
            Text(verbatim: "—")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    private var connectActionRow: some View {
        Button {
            Task { await model.beginConnect() }
        } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Theme.Color.primary50)
                    if model.connecting {
                        ProgressView().tint(Theme.Color.primary600)
                    } else {
                        Icon(connectIcon, size: 16, color: Theme.Color.primary600)
                    }
                }
                .frame(width: 32, height: 32)
                Text(connectLabel)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.primary600)
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.primary600)
                    .opacity(0.6)
            }
            .padding(.vertical, 11)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(model.connecting)
        .accessibilityIdentifier("scheduling.paymentsSetup.connectAction")
    }

    private var connectLabel: String {
        switch model.setup {
        case .notConnected: "Connect Stripe"
        case .incomplete: "Resume verification"
        case .restricted: "Finish verification"
        case .ready: ""
        }
    }

    private var connectIcon: PantopusIcon {
        model.setup == .notConnected ? .externalLink : .arrowRight
    }

    // MARK: Tax group

    private var taxGroup: some View {
        BizGroup(title: "Tax", accent: model.accent) {
            BizSettingsRow(
                icon: .percent,
                label: "Collect tax",
                sub: model.isConnected ? "Stripe Tax" : nil,
                trailing: { rowTrailing },
                onTap: model.isConnected ? { Task { await model.openDashboard() } } : nil
            )
            BizRowDivider()
            BizSettingsRow(
                icon: .fileText,
                label: "Tax rate · Stripe Tax",
                sub: model.isConnected ? "automatic" : nil,
                trailing: { rowTrailing },
                onTap: model.isConnected ? { Task { await model.openDashboard() } } : nil
            )
        }
    }

    // MARK: Action toast

    @ViewBuilder
    private var actionToast: some View {
        if let message = model.actionMessage {
            HStack(spacing: Spacing.s2) {
                Icon(.alertCircle, size: 15, color: Theme.Color.appTextInverse)
                Text(message)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 10)
            .background(Theme.Color.appText)
            .clipShape(Capsule())
            .pantopusShadow(.lg)
            .padding(.top, Spacing.s3)
            .transition(.move(edge: .top).combined(with: .opacity))
            .task {
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                model.clearActionMessage()
            }
            .accessibilityIdentifier("scheduling.paymentsSetup.actionToast")
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        PaymentsSetupView(owner: .business(id: "biz1")) { _ in }
    }
}
#endif
