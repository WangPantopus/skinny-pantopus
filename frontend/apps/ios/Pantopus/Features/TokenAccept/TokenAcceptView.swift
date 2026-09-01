//
//  TokenAcceptView.swift
//  Pantopus
//
//  T3.5 Token / Accept screen. Single-decision layout: persona/
//  sender header, role + benefits card, safety band, sticky CTAs.
//  Reached from the `pantopus://invite/:token` deep link.
//

// swiftlint:disable large_tuple type_body_length

import SwiftUI

public struct TokenAcceptView: View {
    @State private var viewModel: TokenAcceptViewModel

    public init(viewModel: TokenAcceptViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .accessibilityIdentifier("tokenAccept")
    }

    private var topBar: some View {
        HStack {
            Color.clear.frame(width: 36, height: 36)
            Spacer()
            Text("Invitation")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Color.clear.frame(width: 36, height: 36)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingFrame
        case let .ready(offer):
            offerBody(offer, submitting: false)
        case let .accepting(offer):
            offerBody(offer, submitting: true)
        case let .accepted(offer, message):
            acceptedFrame(offer: offer, message: message)
        case .declined:
            declinedFrame
        case let .expired(message):
            expiredFrame(message: message)
        case let .error(message):
            errorFrame(message: message)
        }
    }

    // MARK: - Offer body

    private func offerBody(_ offer: TokenAcceptOffer, submitting: Bool) -> some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    headerCard(offer)
                    roleCard(offer)
                    if !offer.benefits.isEmpty {
                        benefitsCard(offer)
                    }
                    safetyBand(offer.safetyBand)
                    if let expiry = offer.expiry {
                        expiryCard(text: expiry)
                    }
                    Spacer(minLength: Spacing.s8)
                }
                .padding(Spacing.s4)
            }
            stickyCTAs(offer: offer, submitting: submitting)
        }
        .accessibilityIdentifier("tokenAcceptOffer")
    }

    private func headerCard(_ offer: TokenAcceptOffer) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            inviteTypeChip(offer.inviteType)
            Text(offer.sender)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(offer.title)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            HStack(spacing: 6) {
                Icon(.home, size: 14, color: Theme.Color.appTextSecondary)
                Text(offer.venue)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            HStack(spacing: 6) {
                Icon(.user, size: 12, color: Theme.Color.primary600)
                Text(offer.identityChip.label)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary700)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s1)
            .background(Theme.Color.primary50)
            .clipShape(Capsule())
            .accessibilityIdentifier("tokenAcceptIdentityChip")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func inviteTypeChip(_ type: InviteType) -> some View {
        let badge = inviteTypeBadge(type)
        return Text(badge.label.uppercased())
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(badge.fg)
            .kerning(0.8)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(badge.bg)
            .clipShape(Capsule())
            .accessibilityIdentifier("tokenAcceptTypeChip")
    }

    private func roleCard(_ offer: TokenAcceptOffer) -> some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.primary50).frame(width: 40, height: 40)
                Icon(.userPlus, size: 20, color: Theme.Color.primary600)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Role offered")
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .kerning(0.6)
                Text(offer.roleOffered)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
            }
            Spacer()
        }
        .padding(14)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("tokenAcceptRoleCard")
    }

    private func benefitsCard(_ offer: TokenAcceptOffer) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("WHAT YOU GET")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            ForEach(offer.benefits, id: \.self) { benefit in
                HStack(alignment: .top, spacing: Spacing.s2) {
                    Icon(.check, size: 14, color: Theme.Color.success)
                        .padding(.top, 2)
                    Text(benefit)
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.Color.appText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("tokenAcceptBenefits")
    }

    private func safetyBand(_ band: SafetyBand) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Icon(band.icon, size: 16, color: Theme.Color.primary600)
                .padding(.top, 1)
            Text(band.text)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityIdentifier("tokenAcceptSafetyBand")
    }

    private func expiryCard(text: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 14, color: Theme.Color.warning)
            Text(text)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.warning)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Theme.Color.warningBg)
        .clipShape(Capsule())
        .accessibilityIdentifier("tokenAcceptExpiry")
    }

    private func stickyCTAs(offer: TokenAcceptOffer, submitting: Bool) -> some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            HStack(spacing: Spacing.s3) {
                Button {
                    Task { await viewModel.decline() }
                } label: {
                    Text(offer.secondaryCtaLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("tokenAcceptDecline")
                .disabled(submitting)
                Button {
                    Task { await viewModel.accept() }
                } label: {
                    HStack(spacing: 6) {
                        if submitting {
                            ProgressView().tint(Theme.Color.appTextInverse)
                        }
                        Text(submitting ? "Accepting…" : offer.primaryCtaLabel)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("tokenAcceptAccept")
                .disabled(submitting)
            }
            .padding(Spacing.s4)
            .background(Theme.Color.appSurface)
        }
    }

    // MARK: - States

    private var loadingFrame: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                Shimmer(height: 130, cornerRadius: 14)
                Shimmer(height: 80, cornerRadius: Radii.lg)
                Shimmer(height: 120, cornerRadius: Radii.lg)
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("tokenAcceptLoading")
    }

    private func acceptedFrame(offer _: TokenAcceptOffer, message: String) -> some View {
        VStack(spacing: 14) {
            Spacer()
            Icon(.check, size: 36, color: Theme.Color.success)
                .frame(width: 72, height: 72)
                .background(Theme.Color.successBg)
                .clipShape(Circle())
            Text("You're in")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.s8)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("tokenAcceptAccepted")
    }

    private var declinedFrame: some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.x, size: 32, color: Theme.Color.appTextSecondary)
            Text("Invitation declined")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("We told the sender you're not joining. You can always be invited again.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.s8)
            Spacer()
        }
        .accessibilityIdentifier("tokenAcceptDeclined")
    }

    private func expiredFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 36, color: Theme.Color.warning)
            Text("Link no longer valid")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.s8)
            Spacer()
        }
        .accessibilityIdentifier("tokenAcceptExpiredFrame")
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 36, color: Theme.Color.error)
            Text("Couldn't load this invite")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13))
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
            .accessibilityIdentifier("tokenAcceptRetry")
            Spacer()
        }
        .accessibilityIdentifier("tokenAcceptError")
    }

    // MARK: - Helpers

    private func inviteTypeBadge(_ type: InviteType) -> (label: String, bg: Color, fg: Color) {
        let bg: Color
        let fg: Color
        let label: String
        switch type {
        case .homeInvite:
            bg = Theme.Color.successBg
            fg = Theme.Color.success
            label = "Home invite"
        case .businessSeat:
            bg = Theme.Color.businessBg
            fg = Theme.Color.business
            label = "Business seat"
        case .guestPass:
            bg = Theme.Color.warningBg
            fg = Theme.Color.warning
            label = "Guest pass"
        }
        return (label, bg, fg)
    }
}

#Preview {
    TokenAcceptView(viewModel: TokenAcceptViewModel(token: "demo-token"))
}
