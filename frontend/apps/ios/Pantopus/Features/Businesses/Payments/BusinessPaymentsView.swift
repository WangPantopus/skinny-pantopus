//
//  BusinessPaymentsView.swift
//  Pantopus
//
//  A10.7 owner surface — "Payments". Pushed from the Business owner
//  dashboard's Payments section row. One card that reads the business's
//  Stripe Connect account and offers exactly the action the current stage
//  allows: Connect · Continue setup · (waiting) · Open Stripe Dashboard.
//
//  Mirrors RN `src/components/business/tabs/PaymentsTab.tsx` and Android
//  `BusinessPaymentsScreen.kt`.
//

import SwiftUI

/// Owner-only Stripe Connect surface for a single business.
public struct BusinessPaymentsView: View {
    @State private var viewModel: BusinessPaymentsViewModel

    public init(businessId: String) {
        _viewModel = State(initialValue: BusinessPaymentsViewModel(businessId: businessId))
    }

    /// Preview / test seam.
    init(viewModel: BusinessPaymentsViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Theme.Color.appBg)
            .navigationTitle("Payments")
            .navigationBarTitleDisplayMode(.inline)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("businessPayments.screen")
            .task { await viewModel.load() }
            .refreshable { await viewModel.refresh() }
            .overlay(alignment: .bottom) { actionToast }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingSkeleton
        case let .loaded(payload):
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    payoutCard(payload)
                    footnote
                }
                .padding(Spacing.s4)
            }
            .accessibilityIdentifier("businessPayments.loaded")
        case let .error(message):
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load payments",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") { await viewModel.refresh() },
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
            .accessibilityIdentifier("businessPayments.error")
        }
    }

    // MARK: - Loading

    private var loadingSkeleton: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(height: 190, cornerRadius: Radii.lg)
            Shimmer(height: 68, cornerRadius: Radii.lg)
        }
        .padding(Spacing.s4)
        .accessibilityIdentifier("businessPayments.loading")
    }

    // MARK: - Payout card

    private func payoutCard(_ payload: BusinessPaymentsContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Business payout account")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Set up Stripe to receive payments for business gigs and services.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }

            statusBanner(payload)

            if payload.stage == .onboarded {
                HStack(spacing: Spacing.s2) {
                    statBox(label: "Card payments", value: payload.chargesEnabled ? "Enabled" : "Disabled")
                    statBox(label: "Payouts", value: payload.payoutsEnabled ? "Enabled" : "Disabled")
                }
            }

            primaryAction(payload)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessPayments.payoutCard")
    }

    private func statusBanner(_ payload: BusinessPaymentsContent) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(bannerIcon(payload.stage), size: 18, strokeWidth: 2, color: bannerAccent(payload.stage))
            VStack(alignment: .leading, spacing: 2) {
                Text(payload.headline)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(payload.subcopy)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(bannerBackground(payload.stage))
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("businessPayments.statusBanner")
    }

    private func bannerIcon(_ stage: BusinessPayoutStage) -> PantopusIcon {
        switch stage {
        case .onboarded: .checkCircle
        case .verifying: .clock
        case .setupIncomplete: .alertCircle
        case .notConnected: .creditCard
        }
    }

    private func bannerAccent(_ stage: BusinessPayoutStage) -> Color {
        switch stage {
        case .onboarded: Theme.Color.success
        case .verifying: Theme.Color.info
        case .setupIncomplete: Theme.Color.warning
        case .notConnected: Theme.Color.business
        }
    }

    private func bannerBackground(_ stage: BusinessPayoutStage) -> Color {
        switch stage {
        case .onboarded: Theme.Color.successBg
        case .verifying: Theme.Color.infoBg
        case .setupIncomplete: Theme.Color.warningBg
        case .notConnected: Theme.Color.businessBg
        }
    }

    private func statBox(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 10.5, weight: .semibold))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    /// True while a Stripe-hosted page is being opened.
    private var isBusy: Bool {
        viewModel.action == .connecting
    }

    @ViewBuilder private func primaryAction(_ payload: BusinessPaymentsContent) -> some View {
        switch payload.stage {
        case .notConnected:
            PrimaryButton(title: "Connect with Stripe", isLoading: isBusy) {
                await viewModel.connect()
            }
            .accessibilityIdentifier("businessPayments.connect")
        case .setupIncomplete:
            PrimaryButton(title: "Continue setup", isLoading: isBusy) {
                await viewModel.continueSetup()
            }
            .accessibilityIdentifier("businessPayments.continueSetup")
        case .verifying:
            Text("Verification pending…")
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, Spacing.s3)
                .accessibilityIdentifier("businessPayments.verifying")
        case .onboarded:
            GhostButton(title: "Open Stripe Dashboard") {
                await viewModel.openDashboard()
            }
            .accessibilityIdentifier("businessPayments.openDashboard")
        }
    }

    private var footnote: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.shield, size: 14, color: Theme.Color.business)
            Text(
                "This payout account is linked to your business entity. "
                    + "Payments from gigs and services are deposited to it."
            )
            .font(.system(size: 12))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    // MARK: - Action toast

    @ViewBuilder private var actionToast: some View {
        if case let .failed(message) = viewModel.action {
            Text(message)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Color.error)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .padding(Spacing.s4)
                .accessibilityIdentifier("businessPayments.actionToast")
                .onTapGesture { viewModel.clearAction() }
                .task {
                    try? await Task.sleep(nanoseconds: 4_000_000_000)
                    viewModel.clearAction()
                }
        }
    }
}

#Preview("Not connected") {
    NavigationStack {
        BusinessPaymentsView(
            viewModel: BusinessPaymentsViewModel(
                businessId: "biz",
                content: BusinessPaymentsContent(
                    stage: .notConnected,
                    chargesEnabled: false,
                    payoutsEnabled: false
                )
            )
        )
    }
}

#Preview("Onboarded") {
    NavigationStack {
        BusinessPaymentsView(
            viewModel: BusinessPaymentsViewModel(
                businessId: "biz",
                content: BusinessPaymentsContent(
                    stage: .onboarded,
                    chargesEnabled: true,
                    payoutsEnabled: true
                )
            )
        )
    }
}
