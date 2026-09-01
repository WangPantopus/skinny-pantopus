//
//  PrivacyHandshakeWizardView.swift
//  Pantopus
//
//  T3.4 Privacy Handshake — composes WizardShell + step bodies + the
//  persona preview card. The visitor reaches this surface by tapping
//  Follow on a Public Profile they don't yet follow.
//

// swiftlint:disable type_body_length

import SwiftUI

public struct PrivacyHandshakeWizardView: View {
    @State private var viewModel: PrivacyHandshakeViewModel
    @Environment(\.openURL) private var systemOpenURL

    public init(viewModel: PrivacyHandshakeViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        WizardShell(model: viewModel) {
            stepContent
        }
        .task { await viewModel.load() }
        .onChange(of: checkoutUrlIfActive) { _, url in
            if let url, let resolved = URL(string: url) {
                systemOpenURL(resolved)
            }
        }
        .accessibilityIdentifier("privacyHandshake")
    }

    /// `nil` everywhere except when the wizard has just transitioned
    /// to `.opensCheckout`. `onChange` then fires the system browser.
    private var checkoutUrlIfActive: String? {
        guard case let .ready(content) = viewModel.state,
              case let .opensCheckout(url) = content.step else { return nil }
        return url
    }

    @ViewBuilder
    private var stepContent: some View {
        switch viewModel.state {
        case .loading:
            loadingFrame
        case let .ready(content):
            VStack(alignment: .leading, spacing: Spacing.s5) {
                personaPreview(content.persona)
                switch content.step {
                case .handleEntry: handleStepBody(content)
                case .tierSelection, .submitting: tierStepBody(content)
                case .opensCheckout: opensCheckoutBody(content)
                case .completedFree: completedFreeBody(content)
                case .alreadyMember: alreadyMemberBody(content)
                }
            }
        case let .error(message):
            errorFrame(message: message)
        }
    }

    // MARK: - Persona preview

    private func personaPreview(_ persona: HandshakePersonaPreview) -> some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.primary50).frame(width: 52, height: 52)
                Text(persona.displayName.prefix(1).uppercased())
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Theme.Color.primary700)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(persona.displayName)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("@\(persona.handle)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text("\(persona.followerCount) \(persona.audienceLabel.lowercased())")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if let bio = persona.bio, !bio.isEmpty {
                    Text(bio)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.top, Spacing.s1)
                        .lineLimit(3)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(14)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityIdentifier("privacyHandshakePersona")
    }

    // MARK: - Step 1: handle entry

    private func handleStepBody(_ content: HandshakeReadyContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            sectionTitle("Choose your fan handle")
            Text("This is what \(content.persona.displayName) sees about you. They never see your local identity.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            handleField(content)
            if content.handle.matchesUsername {
                usernameAcknowledgementRow(content)
            }
            platformTrustNote
        }
    }

    private func handleField(_ content: HandshakeReadyContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack {
                Text("@")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextField("yourhandle", text: Binding(
                    get: { content.handle.value },
                    set: { viewModel.setHandle($0) }
                ))
                .font(Theme.Font.small)
                .foregroundStyle(Theme.Color.appText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
                .disabled(content.handle.locked)
                .accessibilityIdentifier("privacyHandshakeHandleField")
                if content.handle.locked {
                    Icon(.lock, size: 14, color: Theme.Color.appTextSecondary)
                }
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 44)
            .background(content.handle.locked ? Theme.Color.appSurfaceSunken : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(
                        content.handle.error != nil ? Theme.Color.error : Theme.Color.appBorder,
                        lineWidth: 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            if let error = content.handle.error {
                Text(error)
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
            } else {
                Text("3–40 letters, numbers, dots, dashes, or underscores.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }

    private func usernameAcknowledgementRow(_ content: HandshakeReadyContent) -> some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                    .stroke(
                        content.handle.acknowledgedUsingUsername
                            ? Theme.Color.primary600
                            : Theme.Color.appBorderStrong,
                        lineWidth: 2
                    )
                    .frame(width: 18, height: 18)
                if content.handle.acknowledgedUsingUsername {
                    RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                        .fill(Theme.Color.primary600)
                        .frame(width: 18, height: 18)
                    Icon(.check, size: 12, color: Theme.Color.appTextInverse)
                }
            }
            .padding(.top, 2)
            VStack(alignment: .leading, spacing: 2) {
                Text("Use my Pantopus username as my fan handle")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("This intentionally links your local and public profiles for this creator.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
        }
        .contentShape(Rectangle())
        .onTapGesture {
            viewModel.setAcknowledgedUsingUsername(!content.handle.acknowledgedUsingUsername)
        }
        .accessibilityIdentifier("privacyHandshakeUsernameAck")
    }

    private var platformTrustNote: some View {
        HStack(alignment: .top, spacing: 10) {
            Icon(.lock, size: 16, color: Theme.Color.primary600)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 2) {
                Text("Your private account stays private")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Pantopus never shares your email, phone, address, or local profile with this creator.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    // MARK: - Step 2: tier selection

    private func tierStepBody(_ content: HandshakeReadyContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            sectionTitle("Pick a tier")
            Text("You can change or cancel any time.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            VStack(spacing: 10) {
                ForEach(content.tierOptions) { tier in
                    tierRow(tier, isSelected: content.selectedTierRank == tier.rank)
                }
            }
            handleEchoCard(content)
        }
    }

    private func tierRow(_ tier: HandshakeTierOption, isSelected: Bool) -> some View {
        Button {
            viewModel.selectTier(rank: tier.rank)
        } label: {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .stroke(isSelected ? Theme.Color.primary600 : Theme.Color.appBorderStrong, lineWidth: 2)
                        .frame(width: 22, height: 22)
                    if isSelected {
                        Circle().fill(Theme.Color.primary600).frame(width: 12, height: 12)
                    }
                }
                .padding(.top, 2)
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(tier.name)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Spacer()
                        Text(tier.priceLabel)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(tier.isFree ? Theme.Color.success : Theme.Color.appText)
                    }
                    if let desc = tier.description, !desc.isEmpty {
                        Text(desc)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isSelected ? Theme.Color.primary50 : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("privacyHandshakeTier_\(tier.rank)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private func handleEchoCard(_ content: HandshakeReadyContent) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.userPlus, size: 16, color: Theme.Color.primary600)
            Text("Following as ")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text("@\(content.handle.value)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
        }
        .padding(10)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    // MARK: - Terminal states

    private func opensCheckoutBody(_: HandshakeReadyContent) -> some View {
        VStack(spacing: Spacing.s4) {
            ProgressView().tint(Theme.Color.primary600).scaleEffect(1.4)
            Text("Opening Stripe Checkout…")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text("Finish your subscription in the browser, then come back here.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s10)
        .accessibilityIdentifier("privacyHandshakeCheckout")
    }

    private func completedFreeBody(_ content: HandshakeReadyContent) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.check, size: 36, color: Theme.Color.success)
                .frame(width: 64, height: 64)
                .background(Theme.Color.successBg)
                .clipShape(Circle())
            Text("You're following \(content.persona.displayName)")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("Updates from this creator will show up in your feed. We'll never reveal your local profile.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s6)
        .accessibilityIdentifier("privacyHandshakeSuccess")
    }

    private func alreadyMemberBody(_ content: HandshakeReadyContent) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.star, size: 36, color: Theme.Color.primary600)
                .frame(width: 64, height: 64)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
            Text("You already follow \(content.persona.displayName)")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("Open your profile to manage notifications or change your handle for this creator.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s6)
        .accessibilityIdentifier("privacyHandshakeAlreadyMember")
    }

    // MARK: - Loading + error

    private var loadingFrame: some View {
        VStack(spacing: Spacing.s3) {
            Shimmer(height: 72, cornerRadius: 14)
            Shimmer(height: 44, cornerRadius: 10)
            Shimmer(height: 88, cornerRadius: Radii.lg)
        }
        .accessibilityIdentifier("privacyHandshakeLoading")
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: 10) {
            Icon(.alertCircle, size: 36, color: Theme.Color.error)
            Text("Couldn't open the handshake")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.load() }
            } label: {
                Text("Try again")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s4)
                    .frame(height: 36)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("privacyHandshakeRetry")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s6)
        .accessibilityIdentifier("privacyHandshakeError")
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(Theme.Color.appText)
    }
}

#Preview {
    PrivacyHandshakeWizardView(
        viewModel: PrivacyHandshakeViewModel(personaHandle: "mayabuilds")
    )
}
