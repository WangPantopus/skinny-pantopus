//
//  NotificationChannelPromptView.swift
//  Pantopus
//
//  H15 · Stream I18. The reusable channel-connect prompt content (the A18
//  status-screen layout: a centered tinted hero, headline, muted explainer, and
//  CTAs, plus the 6-box code / phone inputs for the verify frames). Present it
//  locally via `.sheet` from a reminder/workflow channel toggle (I16) or render
//  it full-screen from the routed host (this stream). Tokens only.
//

import SwiftUI

/// One frame of the channel-connect prompt, driven by the shared view model.
struct NotificationChannelPromptView: View {
    @Bindable var viewModel: NotificationPermissionViewModel
    /// Sheet presentations show a close X; the routed screen relies on nav back.
    var showsCloseButton = true

    private var content: PromptContent {
        PromptContent(frame: viewModel.frame)
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            if showsCloseButton { closeRow }
            ScrollView {
                VStack(spacing: Spacing.s5) {
                    Spacer(minLength: Spacing.s6)
                    HaloCircle(tone: content.tone, icon: content.icon)
                    headlineBlock
                    middleControls
                    Spacer(minLength: Spacing.s4)
                }
                .padding(.horizontal, Spacing.s5)
                .frame(maxWidth: .infinity)
            }
            ctaDock
        }
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("scheduling.notificationPrompt.\(content.id)")
    }

    // MARK: - Header

    private var closeRow: some View {
        HStack {
            Capsule()
                .fill(Theme.Color.appBorderStrong)
                .frame(width: 36, height: 5)
                .frame(maxWidth: .infinity)
                .overlay(alignment: .trailing) {
                    Button { viewModel.dismiss() } label: {
                        Icon(.x, size: 18, color: Theme.Color.appTextSecondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close")
                }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s2)
    }

    private var headlineBlock: some View {
        VStack(spacing: Spacing.s2) {
            Text(content.headline)
                .pantopusTextStyle(.h2)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appText)
            Text(content.explainer(email: viewModel.accountEmail, phone: viewModel.phone))
                .pantopusTextStyle(.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: 260)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Middle (verify inputs)

    @ViewBuilder
    private var middleControls: some View {
        switch viewModel.frame {
        case .emailVerify:
            codeEntry
        case .smsVerify:
            VStack(spacing: Spacing.s3) {
                PhoneEntryField(phone: $viewModel.phone)
                codeEntry
                Text("Carrier rates may apply.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        default:
            EmptyView()
        }
    }

    private var codeEntry: some View {
        VStack(spacing: Spacing.s3) {
            CodeBoxField(code: $viewModel.code, accent: viewModel.accent)
            Button("Resend code") { viewModel.resendCode() }
                .font(Theme.Font.small)
                .fontWeight(.semibold)
                .foregroundStyle(viewModel.accent)
                .accessibilityIdentifier("scheduling.notificationPrompt.resend")
        }
    }

    // MARK: - CTA dock

    private var ctaDock: some View {
        VStack(spacing: Spacing.s3) {
            if let toast = viewModel.toast {
                toastRow(toast)
            }
            PrimaryButton(
                title: content.primaryTitle,
                isLoading: viewModel.isWorking,
                isEnabled: primaryEnabled
            ) {
                await runPrimary()
            }
            .accessibilityIdentifier("scheduling.notificationPrompt.primary")
            if let secondary = content.secondaryTitle {
                GhostButton(title: secondary) { runSecondary() }
                    .accessibilityIdentifier("scheduling.notificationPrompt.secondary")
            }
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s6)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) { Divider().background(Theme.Color.appBorderSubtle) }
    }

    private func toastRow(_ message: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.info, size: 14, color: Theme.Color.info)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextStrong)
            Spacer(minLength: 0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
        .accessibilityIdentifier("scheduling.notificationPrompt.toast")
    }

    // MARK: - Actions

    private var primaryEnabled: Bool {
        switch viewModel.frame {
        case .emailVerify: viewModel.isCodeComplete
        case .smsVerify: viewModel.isSmsReady
        default: true
        }
    }

    private func runPrimary() async {
        switch viewModel.frame {
        case .push: await viewModel.allowPush()
        case .emailVerify: await viewModel.verifyEmail()
        case .smsVerify: viewModel.verifySms()
        case .connected: viewModel.done()
        case .denied: viewModel.openSettings()
        }
    }

    private func runSecondary() {
        switch viewModel.frame {
        case .push, .denied: viewModel.useEmailInstead()
        default: break
        }
    }
}

// MARK: - Frame copy

/// Per-frame copy + chrome, computed from the active frame. Sentence case,
/// plainspoken, no exclamation points.
private struct PromptContent {
    let frame: NotificationPromptFrame

    var id: String {
        switch frame {
        case .push: "push"
        case .emailVerify: "emailVerify"
        case .smsVerify: "smsVerify"
        case .connected: "connected"
        case .denied: "denied"
        }
    }

    var tone: HaloCircleTone {
        switch frame {
        case .connected: .success
        case .denied: .warning
        default: .info
        }
    }

    var icon: PantopusIcon {
        switch frame {
        case .push: NotificationChannel.push.glyph
        case .emailVerify: NotificationChannel.email.glyph
        case .smsVerify: NotificationChannel.sms.glyph
        case .connected: .checkCheck
        case .denied: .bellOff
        }
    }

    var headline: String {
        switch frame {
        case .push: "Turn on push reminders"
        case .emailVerify: "Confirm your email"
        case .smsVerify: "Confirm your phone"
        case let .connected(channel): channel.connectedTitle
        case .denied: "Push is turned off"
        }
    }

    func explainer(email: String, phone: String) -> String {
        switch frame {
        case .push:
            "Pantopus needs permission to send reminders to this device. You can change this anytime in Settings."
        case .emailVerify:
            "We sent a 6-digit code to \(email)."
        case .smsVerify:
            "Enter your phone number, then the 6-digit code we text you."
        case let .connected(channel):
            channel.connectedBody(target: channel == .sms ? phone : email)
        case .denied:
            "Reminders can't reach this device until you enable notifications in iOS Settings. Email still works."
        }
    }

    var primaryTitle: String {
        switch frame {
        case .push: "Allow notifications"
        case .emailVerify, .smsVerify: "Verify"
        case .connected: "Done"
        case .denied: "Open Settings"
        }
    }

    var secondaryTitle: String? {
        switch frame {
        case .push: "Use email instead"
        case .denied: "Keep email only"
        default: nil
        }
    }
}

#if DEBUG
@MainActor
private func previewModel(_ frame: NotificationPromptFrame) -> NotificationPermissionViewModel {
    NotificationPermissionViewModel(
        owner: .personal,
        initialFrame: frame,
        accountEmail: "maria@pantopus.co",
        service: .shared
    ) { _ in }
}

#Preview("Push") { NotificationChannelPromptView(viewModel: previewModel(.push)) }
#Preview("Email verify") { NotificationChannelPromptView(viewModel: previewModel(.emailVerify(email: "maria@pantopus.co"))) }
#Preview("SMS verify") { NotificationChannelPromptView(viewModel: previewModel(.smsVerify)) }
#Preview("Connected") { NotificationChannelPromptView(viewModel: previewModel(.connected(.email))) }
#Preview("Denied") { NotificationChannelPromptView(viewModel: previewModel(.denied)) }
#endif
