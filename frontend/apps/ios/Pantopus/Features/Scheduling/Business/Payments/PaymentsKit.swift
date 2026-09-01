//
//  PaymentsKit.swift
//  Pantopus
//
//  Stream I14 (Payments & payouts) — shared primitives for G6 Payments Setup,
//  G7 Payouts & Earnings, and G14 Cancellation policy. The whole stream is gated
//  behind `SchedulingFeatureFlags.paidEnabled` (Stripe TEST mode; payout
//  settlement deferred server-side), so every routed screen wraps its body in
//  `PaidSurfaceGate`, which renders a calm "coming soon" scaffold when the flag
//  is off. Reuses `BusinessKit` chrome (`BizTopBar`) + design tokens only.
//

import SwiftUI

// MARK: - Readiness pill (G6 status hero — charges / payouts / details)

/// One readiness pill in the Stripe status hero. Mirrors `paymentssetup-frames`
/// `ReadyPill` (on = success, warn = amber clock, off = sunken minus).
struct ReadinessPill: View {
    enum State: Equatable { case on, warn, off }

    let label: String
    let state: State

    private var bg: Color {
        switch state {
        case .on: Theme.Color.successBg
        case .warn: Theme.Color.warningBg
        case .off: Theme.Color.appSurfaceSunken
        }
    }

    private var fg: Color {
        switch state {
        case .on: Theme.Color.success
        case .warn: Theme.Color.warning
        case .off: Theme.Color.appTextMuted
        }
    }

    private var icon: PantopusIcon {
        switch state {
        case .on: .check
        case .warn: .clock
        case .off: .minus
        }
    }

    var body: some View {
        VStack(spacing: Spacing.s1) {
            Icon(icon, size: 14, strokeWidth: 2.6, color: fg)
            Text(label.uppercased())
                .font(.system(size: 9.5, weight: .bold))
                .tracking(0.3)
                .foregroundStyle(fg)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s2)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(accessibilityState)")
    }

    private var accessibilityState: String {
        switch state {
        case .on: "ready"
        case .warn: "needs attention"
        case .off: "off"
        }
    }
}

// MARK: - Paid-surface gate

/// Wraps a routed I14 screen. When `SchedulingFeatureFlags.paidEnabled` is off
/// (default), renders a "coming soon" scaffold (top bar + calm hero) instead of
/// the real content. When on, renders the content unchanged (the content owns
/// its own top bar). Keeps the paid surface honest while it ships behind the
/// flag in Stripe TEST mode.
struct PaidSurfaceGate<Content: View>: View {
    let title: String
    let onBack: () -> Void
    @ViewBuilder var content: Content

    var body: some View {
        if SchedulingFeatureFlags.paidEnabled {
            content
        } else {
            comingSoon
        }
    }

    private var comingSoon: some View {
        VStack(spacing: Spacing.s0) {
            BizTopBar(title: title, onBack: onBack)
            VStack(spacing: Spacing.s4) {
                Spacer(minLength: 0)
                ZStack {
                    Circle().fill(Theme.Color.businessBg).frame(width: 72, height: 72)
                    Icon(.creditCard, size: 30, strokeWidth: 1.8, color: Theme.Color.business)
                }
                Text("Payments are coming soon")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                Text("Charging for bookings and getting paid out is almost ready. We'll turn it on for your account shortly.")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.s8)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appBg)
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .accessibilityIdentifier("scheduling.payments.comingSoon")
    }
}

// MARK: - Not-applicable scaffold (G6 — homes)

/// Homes are `applicable:false` for `GET /payments/status` (payments are
/// per-user). Render a friendly, honest explainer rather than an error.
struct PaymentsNotApplicableView: View {
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            BizTopBar(title: "Payments", onBack: onBack)
            VStack(spacing: Spacing.s4) {
                Spacer(minLength: 0)
                ZStack {
                    Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 72, height: 72)
                    Icon(.creditCard, size: 30, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
                }
                Text("Payments are set up per person")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                Text("Homes don't take payments directly. Each member connects Stripe from their personal scheduling settings.")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.s8)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appBg)
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .accessibilityIdentifier("scheduling.payments.notApplicable")
    }
}

// MARK: - Loading + error scaffolds (shared by G6 / G14)

/// Shimmer skeleton for the settings-section screens (G6 / G14).
struct PaymentsSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 96, cornerRadius: Radii.xl)
                Shimmer(width: 90, height: 9, cornerRadius: Radii.xs)
                Shimmer(height: 150, cornerRadius: Radii.xl)
                Shimmer(width: 60, height: 9, cornerRadius: Radii.xs)
                Shimmer(height: 96, cornerRadius: Radii.xl)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s4)
        }
        .accessibilityIdentifier("scheduling.payments.loading")
    }
}

/// Inline retry error used by the settings-section screens (G6 / G14).
struct PaymentsErrorView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 64, height: 64)
                Icon(.cloudOff, size: 28, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            }
            Text("Something went wrong")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button(action: onRetry) {
                HStack(spacing: Spacing.s2) {
                    Icon(.refreshCw, size: 14, color: Theme.Color.appTextStrong)
                    Text("Try again")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("scheduling.payments.error")
    }
}
