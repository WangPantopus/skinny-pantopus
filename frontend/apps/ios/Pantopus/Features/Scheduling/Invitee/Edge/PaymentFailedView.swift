//
//  PaymentFailedView.swift
//  Pantopus
//
//  D6 Payment Failed / Retry (Stream I7). The calm payment-recovery surface,
//  gated behind the paid flag. Declined / hold-expired / uncertain / succeeded
//  states, each leading with a tone-driven halo and reassuring copy ("nothing
//  was charged", "we never charge twice"). Tokens only.
//

import SwiftUI

struct PaymentFailedView: View {
    @State private var viewModel: PaymentFailedViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: PaymentFailedViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appBg)
            .navigationTitle("Payment")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load() }
            .onDisappear { viewModel.stop() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("scheduling.paymentFailed")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.stage {
        case .loading:
            loading
        case .declined:
            declined
        case .holdExpired:
            holdExpired
        case .uncertain:
            uncertain
        case .succeeded:
            succeeded
        case .notApplicable:
            notApplicable
        case let .error(message):
            EmptyState(
                icon: .creditCard,
                headline: "We couldn't check your payment",
                subcopy: message,
                cta: .init(title: "Try again") { await viewModel.retry() }
            )
        }
    }

    private var loading: some View {
        VStack(spacing: Spacing.s4) {
            EdgeIconHalo(icon: .creditCard, tone: .info, size: 84)
            Shimmer(width: 200, height: 16)
            Shimmer(width: 240, height: 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityLabel("Checking your payment")
    }

    // MARK: - Declined

    private var declined: some View {
        scaffold(
            halo: .creditCard,
            tone: .error,
            title: "Your payment didn't go through",
            body: "Your card was declined — not enough funds. Nothing was charged.",
            footnote: "Your time is still held. Try another card.",
            footnoteIcon: .shieldCheck
        ) {
            holdChip(released: false)
            cardDeclinedRow
        } dock: {
            PrimaryButton(title: "Try another card") { await viewModel.retry() }
            GhostButton(title: "Use a different time") { viewModel.pickAnotherTime() }
        }
    }

    // MARK: - Hold expired

    private var holdExpired: some View {
        scaffold(
            halo: .creditCard,
            tone: .error,
            title: "Your payment didn't go through",
            body: "Your time opened back up while we waited. You can grab a new one — still nothing charged.",
            footnote: "We never charge twice.",
            footnoteIcon: .shieldCheck
        ) {
            holdChip(released: true)
        } dock: {
            PrimaryButton(title: "Pick a time again") { viewModel.pickAnotherTime() }
            GhostButton(title: "Not now") { dismiss() }
        }
    }

    // MARK: - Uncertain

    private var uncertain: some View {
        scaffold(
            halo: .creditCard,
            tone: .info,
            title: "We're not sure that went through",
            body: "The connection dropped before we heard back. We won't double-charge you — check again to see where it landed.",
            footnote: "We never charge twice.",
            footnoteIcon: .shieldCheck
        ) {
            holdChip(released: false)
            calloutInfo
        } dock: {
            PrimaryButton(title: "Check again") { await viewModel.retry() }
            GhostButton(title: "Use a different time") { viewModel.pickAnotherTime() }
        }
    }

    // MARK: - Succeeded

    private var succeeded: some View {
        VStack(spacing: Spacing.s4) {
            Spacer(minLength: 0)
            EdgeIconHalo(icon: .checkCircle2, tone: .success, size: 84)
            VStack(spacing: Spacing.s2) {
                Text("Payment went through")
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Your second card worked. Taking you to your booking.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
            }
            if let amount = viewModel.amountLabel {
                HStack(spacing: Spacing.s2) {
                    Icon(.badgeCheck, size: 14, strokeWidth: 2.2, color: Theme.Color.success)
                    Text("Paid \(amount) · receipt on its way")
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(Theme.Color.success)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.successBg)
                .overlay(Capsule().stroke(Theme.Color.successLight, lineWidth: 1))
                .clipShape(Capsule())
            }
            // Design (payment-failed-frames.jsx:303-310): a 70%-wide track
            // with a 62%-fill success bar, then a pulsing dot + "Confirming" label.
            VStack(spacing: Spacing.s2) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Theme.Color.appSurfaceSunken)
                            .frame(width: geo.size.width * 0.70, height: 5)
                        Capsule()
                            .fill(Theme.Color.success)
                            .frame(width: geo.size.width * 0.70 * 0.62, height: 5)
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                }
                .frame(height: 5)
                HStack(spacing: Spacing.s1) {
                    Circle()
                        .fill(Theme.Color.success)
                        .frame(width: 6, height: 6)
                    Text("Confirming your booking")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: 0)
            HStack(spacing: Spacing.s1) {
                Icon(.lock, size: 12, color: Theme.Color.appTextMuted)
                Text("Payments secured by Stripe")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.bottom, Spacing.s4)
        }
        .padding(.horizontal, Spacing.s5)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Payment went through. Taking you to your booking.")
    }

    // MARK: - Not applicable (paid surfaces off)

    private var notApplicable: some View {
        VStack(spacing: Spacing.s4) {
            Spacer(minLength: 0)
            EdgeIconHalo(icon: .checkCircle, tone: .success, size: 84)
            VStack(spacing: Spacing.s2) {
                Text("You're all set")
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("This booking doesn't need a payment.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s5)
        .safeAreaInset(edge: .bottom) {
            EdgeDock { PrimaryButton(title: "Continue") { viewModel.continueToBooking() } }
        }
    }

    // MARK: - Shared scaffold

    // swiftlint:disable:next function_parameter_count
    private func scaffold(
        halo: PantopusIcon,
        tone: EdgeTone,
        title: String,
        body: String,
        footnote: String,
        footnoteIcon: PantopusIcon,
        @ViewBuilder content: () -> some View,
        @ViewBuilder dock: () -> some View
    ) -> some View {
        ScrollView {
            VStack(spacing: Spacing.s4) {
                EdgeIconHalo(icon: halo, tone: tone, size: 84)
                    .padding(.top, Spacing.s5)
                VStack(spacing: Spacing.s2) {
                    Text(title)
                        .font(.system(size: 19, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.center)
                    Text(body)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(2)
                        .frame(maxWidth: 270)
                }
                content()
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.bottom, Spacing.s4)
        }
        .safeAreaInset(edge: .bottom) {
            EdgeDock {
                dock()
                HStack(spacing: Spacing.s1) {
                    Icon(footnoteIcon, size: 13, color: Theme.Color.appTextMuted)
                    Text(footnote)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.top, Spacing.s1)
            }
        }
    }

    // MARK: - Pieces

    private func holdChip(released: Bool) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.timer, size: 13, strokeWidth: 2.2, color: released ? Theme.Color.error : Theme.Color.warning)
            Text(holdChipText(released: released))
                .font(.system(size: 11.5, weight: released ? .bold : .semibold))
                .foregroundStyle(released ? Theme.Color.error : Theme.Color.warning)
                .monospacedDigit()
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(released ? Theme.Color.errorBg : Theme.Color.warningBg)
        .overlay(
            Capsule().stroke(released ? Theme.Color.errorLight : Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(Capsule())
    }

    private func holdChipText(released: Bool) -> String {
        if released { return "Hold released" }
        if let slot = viewModel.slotTimeLabel {
            return "Holding your \(slot) time for \(viewModel.holdLabel)"
        }
        return "Holding your time for \(viewModel.holdLabel)"
    }

    private var cardDeclinedRow: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.creditCard, size: 18, color: Theme.Color.error)
                .frame(width: 38, height: 26)
                .background(Theme.Color.errorBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text("Your card")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Declined · not enough funds")
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.error)
            }
            Spacer(minLength: Spacing.s2)
            SchedulingStatusPill(status: "declined")
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.errorLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var calloutInfo: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.shieldCheck, size: 15, color: Theme.Color.info)
            Text("If the first try did go through, checking again won't charge you a second time.")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.info)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.infoBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.infoLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

#if DEBUG
#Preview("Declined") {
    NavigationStack { PaymentFailedView(viewModel: .preview(.declined)) }
}

#Preview("Uncertain") {
    NavigationStack { PaymentFailedView(viewModel: .preview(.uncertain)) }
}
#endif
