//
//  VerifyEmailLandingView.swift
//  Pantopus
//
//  §1B-2 — Verify email DEEP-LINK LANDING (verify-email-frames.jsx). The
//  A18 collapsed-status variant the app opens when the user taps the link
//  in their verification email. Sibling to A18.1 "Verify Email Sent" — this
//  is the POST-tap result, not the pre-tap "we sent you a link" surface.
//
//  Three frames, one per outcome of the token check:
//    · verifying — mail halo + "Checking your link…" pill, no CTA
//    · success   — green check halo + "Verified · just now" + Continue
//    · expired   — amber halo + "Link expired" + Resend / Use a different email
//
//  Reuses the shared A18 primitives (`HaloCircle`, `StatusPillView`) and the
//  design tokens so it's a true sibling of `StatusWaitingView`. The view is
//  presentational; the view-model owns the verify / resend calls and the
//  host wires Continue (→ signed-in entry, or sign-in when there's no
//  session) and the change-email handoff.
//

import SwiftUI

struct VerifyEmailLandingView: View {
    @Environment(AuthManager.self) private var auth
    @State private var viewModel: VerifyEmailLandingViewModel
    /// Tapped from the success CTA. Host routes to the signed-in entry
    /// when a session exists, else back to sign-in.
    let onContinue: () -> Void
    /// Tapped from the expired "Use a different email" ghost. Host restarts
    /// sign-up so a different address can be verified.
    let onUseDifferentEmail: () -> Void

    init(
        email: String? = nil,
        token: String? = nil,
        onContinue: @escaping () -> Void = {},
        onUseDifferentEmail: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: VerifyEmailLandingViewModel(email: email, token: token))
        self.onContinue = onContinue
        self.onUseDifferentEmail = onUseDifferentEmail
    }

    /// Preview / test seam — inject a pre-parked view-model.
    init(
        viewModel: VerifyEmailLandingViewModel,
        onContinue: @escaping () -> Void = {},
        onUseDifferentEmail: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onContinue = onContinue
        self.onUseDifferentEmail = onUseDifferentEmail
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: Spacing.s0) {
                ScrollView { phaseBody }
                TrustFooter()
            }
            if let toast = viewModel.toast {
                ResendToastView(toast: toast)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.bottom, Spacing.s12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task(id: toast) {
                        try? await Task.sleep(nanoseconds: 2_500_000_000)
                        viewModel.clearToast()
                    }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.toast)
        .background(Theme.Color.appBg)
        .navigationBarHidden(true)
        .accessibilityIdentifier("verifyEmailScreen")
        .task { await viewModel.verifyOnAppearIfNeeded(using: auth) }
    }

    // MARK: - Phase bodies

    @ViewBuilder
    private var phaseBody: some View {
        switch viewModel.phase {
        case .verifying: verifyingBody
        case .success: successBody
        case .expired: expiredBody
        }
    }

    private var verifyingBody: some View {
        scaffold(
            stateID: "verifyEmail.verifyingView",
            chrome: PhaseChrome(
                halo: HaloCircle(tone: .info, icon: .mail, isPulsing: true),
                headline: "Verifying your email…",
                body: emphasized("Hold on while we confirm the link for \(viewModel.recipient).", viewModel.email),
                pill: StatusWaitingPill(text: "Checking your link…", icon: .refreshCw, tone: .neutral, isSpinning: true)
            )
        ) {
            Text("This only takes a moment.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextMuted)
                .accessibilityIdentifier("verifyEmail.verifyingHint")
        }
    }

    private var successBody: some View {
        scaffold(
            stateID: "verifyEmail.successView",
            chrome: PhaseChrome(
                halo: HaloCircle(tone: .success, icon: .check),
                headline: "Email verified",
                body: emphasized("\(viewModel.recipient) is confirmed. Your account is ready to go.", viewModel.email),
                pill: StatusWaitingPill(text: "Verified · just now", icon: .checkCircle, tone: .success)
            )
        ) {
            LandingPrimaryButton(
                label: "Continue",
                icon: .arrowRight,
                identifier: "verifyEmail.continueBtn",
                action: onContinue
            )
        }
    }

    private var expiredBody: some View {
        scaffold(
            stateID: "verifyEmail.expiredView",
            chrome: PhaseChrome(
                halo: HaloCircle(tone: .warning, icon: .alertTriangle),
                headline: "This link has expired",
                body: emphasized(
                    "Verification links last 24 hours. We can send a fresh one to \(viewModel.recipient).",
                    viewModel.email
                ),
                pill: StatusWaitingPill(text: "Link expired", icon: .clock, tone: .warning)
            )
        ) {
            VStack(spacing: Spacing.s2) {
                LandingPrimaryButton(
                    label: "Resend verification",
                    icon: .refreshCw,
                    identifier: "verifyEmail.resendBtn",
                    isLoading: viewModel.isResending,
                    isEnabled: viewModel.canResend,
                    action: resend
                )
                LandingGhostButton(
                    label: "Use a different email",
                    icon: .pencil,
                    identifier: "verifyEmail.differentEmailBtn",
                    action: onUseDifferentEmail
                )
            }
        }
    }

    // MARK: - Shared scaffold

    /// Halo + copy + pill bundle for one phase. Bundled into a value so the
    /// `scaffold` builder stays within the parameter-count budget.
    private struct PhaseChrome {
        let halo: HaloCircle
        let headline: String
        let body: Text
        let pill: StatusWaitingPill
    }

    /// Centred A18 collapsed-status block: halo → headline → body → pill →
    /// state-specific actions. `stateID` is the per-phase contract tag.
    private func scaffold(
        stateID: String,
        chrome: PhaseChrome,
        @ViewBuilder actions: () -> some View
    ) -> some View {
        VStack(spacing: Spacing.s5) {
            Spacer(minLength: Spacing.s10)
            chrome.halo
            VStack(spacing: Spacing.s2) {
                Text(chrome.headline)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                chrome.body
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)
            }
            StatusPillView(pill: chrome.pill)
            actions()
                .frame(maxWidth: .infinity)
                .padding(.top, Spacing.s2)
            Spacer(minLength: Spacing.s10)
        }
        .padding(.horizontal, Spacing.s6)
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier(stateID)
    }

    private func resend() {
        Task { await viewModel.resend(using: auth) }
    }

    /// Body copy with the email fragment rendered bold (mirrors
    /// `StatusWaitingView.styledSubcopy`).
    private func emphasized(_ full: String, _ emphasis: String?) -> Text {
        guard let emphasis, !emphasis.isEmpty, let range = full.range(of: emphasis) else {
            return Text(full)
        }
        let before = String(full[full.startIndex..<range.lowerBound])
        let after = String(full[range.upperBound...])
        return Text(before)
            + Text(emphasis).fontWeight(.bold).foregroundColor(Theme.Color.appText)
            + Text(after)
    }
}

// MARK: - Buttons

/// 48pt filled sky primary CTA with an optional trailing glyph and an
/// in-place spinner for the in-flight resend. Named `Landing*` so it
/// doesn't collide with the shared `PrimaryButton` (Core/Design/Components).
private struct LandingPrimaryButton: View {
    let label: String
    let icon: PantopusIcon?
    let identifier: String
    var isLoading: Bool = false
    var isEnabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if isLoading {
                    ProgressView().tint(Theme.Color.appTextInverse)
                } else {
                    HStack(spacing: 8) {
                        Text(label)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                        if let icon {
                            Icon(icon, size: 17, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(isEnabled ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .shadow(color: Theme.Color.primary600.opacity(isEnabled ? 0.3 : 0), radius: 9, x: 0, y: 8)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isLoading)
        .accessibilityIdentifier(identifier)
    }
}

/// 46pt outlined ghost CTA with a leading glyph. Named `Landing*` so it
/// doesn't collide with the shared `GhostButton` (Core/Design/Components).
private struct LandingGhostButton: View {
    let label: String
    let icon: PantopusIcon?
    let identifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if let icon {
                    Icon(icon, size: 16, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                }
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}

// MARK: - Footer + toast

/// Shield-check trust footer, pinned to the bottom of every phase.
private struct TrustFooter: View {
    var body: some View {
        HStack(spacing: 7) {
            Icon(.shieldCheck, size: 14, strokeWidth: 2, color: Theme.Color.success)
            Text("Verified by address · encrypted")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s5)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Verified by address, encrypted")
        .accessibilityIdentifier("verifyEmail.trustFooter")
    }
}

/// Bottom confirmation toast surfaced after a Resend tap.
private struct ResendToastView: View {
    let toast: VerifyEmailLandingViewModel.ResendToast

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(toast.isError ? .alertCircle : .checkCircle, size: 16, color: Theme.Color.appTextInverse)
            Text(toast.message)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(toast.isError ? Theme.Color.error : Theme.Color.appText)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("verifyEmail.resendToast")
    }
}

// MARK: - Previews

#Preview("Verifying") {
    VerifyEmailLandingView(viewModel: .preview(.verifying))
        .environment(AuthManager.previewSignedOut)
}

#Preview("Verified") {
    VerifyEmailLandingView(viewModel: .preview(.success))
        .environment(AuthManager.previewSignedOut)
}

#Preview("Expired") {
    VerifyEmailLandingView(viewModel: .preview(.expired))
        .environment(AuthManager.previewSignedOut)
}
