//
//  ContinueAsView.swift
//  Pantopus
//
//  "Continue as Ying" — the one-gesture resume card shown when the stored
//  session survived a reinstall or went dormant (`AuthManager.State
//  .resumable`). Design §3 state B / §7.3: avatar, name, masked email,
//  primary *Continue* (Face ID / Touch ID / passcode via `LAContext`
//  `.deviceOwnerAuthentication` inside `AuthManager.resume()`), secondary
//  *Use a different account*, tertiary *Not you? Remove*. A card, not a
//  form — no password is ever asked here.
//
//  Accessibility identifiers are the parity contract with Android's
//  `ContinueAsTags`: `auth.continueAs.{root,avatar,title,email,continue,
//  differentAccount,remove,removeConfirm,removeCancel,error,securityBanner,
//  securityBannerDismiss}`.
//

import SwiftUI

struct ContinueAsView: View {
    @Environment(AuthManager.self) private var auth
    @State private var viewModel: ContinueAsViewModel
    /// "Not you? Remove" wipes this device's stored session — confirm
    /// first, same as Android's `removeConfirm` dialog.
    @State private var isRemoveConfirmPresented = false

    init(hint: AccountHint, sessionEndReason: SessionEndReason? = nil) {
        _viewModel = State(initialValue: ContinueAsViewModel(hint: hint, sessionEndReason: sessionEndReason))
    }

    var body: some View {
        if viewModel.wantsDifferentAccount {
            // The signed-out front door (Place funnel + Sign-in cover). The
            // stored tokens stay in place until the new login supersedes
            // them; `DeepLinkRouter.requestLoginPresentation()` makes the
            // host open the Sign-in cover straight away.
            PlaceLaunchHost()
                .accessibilityIdentifier("auth.continueAs.differentAccountHost")
        } else {
            card
        }
    }

    private var card: some View {
        ZStack {
            Theme.Color.appBg.ignoresSafeArea()
            ScrollView {
                VStack(spacing: Spacing.s0) {
                    Spacer(minLength: Spacing.s16)
                    brand
                        .padding(.bottom, Spacing.s10)

                    if let security = viewModel.securityMessage {
                        securityBanner(security)
                            .padding(.horizontal, Spacing.s5)
                            .padding(.bottom, Spacing.s4)
                    }

                    accountCard
                        .padding(.horizontal, Spacing.s5)

                    if let error = viewModel.errorMessage {
                        errorLine(error)
                            .padding(.horizontal, Spacing.s5)
                            .padding(.top, Spacing.s3)
                    }

                    secondaryActions
                        .padding(.horizontal, Spacing.s5)
                        .padding(.top, Spacing.s5)

                    Spacer(minLength: Spacing.s10)
                    AuthTrustFooter()
                        .padding(.bottom, Spacing.s4)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .confirmationDialog(
            "Remove this account from this device?",
            isPresented: $isRemoveConfirmPresented,
            titleVisibility: .visible
        ) {
            Button("Remove account", role: .destructive) {
                Task { await viewModel.removeAccount(using: auth) }
            }
            .accessibilityIdentifier("auth.continueAs.removeConfirm")
            Button("Cancel", role: .cancel) {}
                .accessibilityIdentifier("auth.continueAs.removeCancel")
        } message: {
            Text("You'll be signed out on this device and will need to sign in again. Your account itself is not deleted.")
        }
        .accessibilityIdentifier("auth.continueAs.root")
    }

    // MARK: - Pieces

    private var brand: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.home, size: 40, color: Theme.Color.primary600)
                .accessibilityHidden(true)
            Text("WELCOME BACK")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.primary600)
                .tracking(1.2)
        }
    }

    private var accountCard: some View {
        VStack(spacing: Spacing.s4) {
            avatar
            VStack(spacing: Spacing.s1) {
                Text(viewModel.headline)
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("auth.continueAs.title")
                if let subtitle = viewModel.subtitle {
                    Text(subtitle)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .accessibilityIdentifier("auth.continueAs.email")
                }
            }
            Text("Confirm it's you with \(AppLockManager.shared.biometricLabel) or your passcode to pick up where you left off.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            PrimaryButton(
                title: "Continue",
                isLoading: viewModel.phase == .resuming,
                isEnabled: !viewModel.isBusy
            ) {
                await viewModel.continueSignedIn(using: auth)
            }
            .accessibilityIdentifier("auth.continueAs.continue")
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .pantopusShadow(.sm)
    }

    private var avatar: some View {
        ZStack {
            Circle()
                .fill(Theme.Color.personalBg)
            if let url = viewModel.hint.avatarUrl {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image.resizable().scaledToFill()
                    default:
                        initialsLabel
                    }
                }
            } else {
                initialsLabel
            }
        }
        .frame(width: 72, height: 72)
        .clipShape(Circle())
        .overlay(Circle().stroke(Theme.Color.personal, lineWidth: 2))
        .accessibilityHidden(true)
        .accessibilityIdentifier("auth.continueAs.avatar")
    }

    private var initialsLabel: some View {
        Text(viewModel.initials)
            .pantopusTextStyle(.h3)
            .foregroundStyle(Theme.Color.personal)
    }

    private var secondaryActions: some View {
        VStack(spacing: Spacing.s3) {
            Button {
                viewModel.useDifferentAccount()
            } label: {
                Text("Use a different account")
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.primary600)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isBusy)
            .accessibilityIdentifier("auth.continueAs.differentAccount")

            Button {
                isRemoveConfirmPresented = true
            } label: {
                HStack(spacing: Spacing.s1) {
                    if viewModel.phase == .removing {
                        ProgressView()
                            .controlSize(.small)
                    }
                    Text("Not you? Remove this account from this device")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isBusy)
            .accessibilityIdentifier("auth.continueAs.remove")
        }
    }

    private func securityBanner(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.shieldAlert, size: 18, color: Theme.Color.warning)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
            Button(action: viewModel.dismissSecurityMessage) {
                Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
            }
            .accessibilityLabel("Dismiss")
            .accessibilityIdentifier("auth.continueAs.securityBannerDismiss")
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("auth.continueAs.securityBanner")
    }

    private func errorLine(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.alertCircle, size: 16, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.error)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
            Button(action: viewModel.clearError) {
                Icon(.x, size: 14, color: Theme.Color.error)
            }
            .accessibilityLabel("Dismiss error")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("auth.continueAs.error")
    }
}

#Preview("Continue as") {
    ContinueAsView(
        hint: AccountHint(
            userId: "u_1",
            displayName: "Ying Wang",
            avatarUrl: nil,
            maskedEmail: "y•••@gmail.com",
            lastMethod: .password,
            lastSeenAt: Date()
        )
    )
    .environment(AuthManager.previewSignedOut)
}

#Preview("After a security sign-out") {
    ContinueAsView(
        hint: AccountHint(
            userId: "u_1",
            displayName: "Ying Wang",
            avatarUrl: nil,
            maskedEmail: "y•••@gmail.com",
            lastMethod: .password,
            lastSeenAt: Date()
        ),
        sessionEndReason: .tokenReuse
    )
    .environment(AuthManager.previewSignedOut)
}
