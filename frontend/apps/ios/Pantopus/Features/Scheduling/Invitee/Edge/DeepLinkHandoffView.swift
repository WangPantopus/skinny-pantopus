//
//  DeepLinkHandoffView.swift
//  Pantopus
//
//  D9 Open-in-App / Deep-Link Hand-off (Stream I7). Resolves a booking link and
//  offers the invitee a native "continue in app" vs "stay on web" choice, with
//  the booking recap carried across. Resolving / resolved / failed states; the
//  add-to-calendar sheet (D8) is presented locally from the resolved state.
//  Tokens only.
//

import SwiftUI

struct DeepLinkHandoffView: View {
    @State private var viewModel: DeepLinkHandoffViewModel
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss

    init(viewModel: DeepLinkHandoffViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appBg)
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("scheduling.deepLinkHandoff")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .resolving:
            resolving
        case let .resolved(response):
            resolved(response)
        case let .failed(message):
            failed(message: message)
        }
    }

    // MARK: - Resolving

    private var resolving: some View {
        VStack(spacing: Spacing.s4) {
            Spacer(minLength: 0)
            PantopusMark(size: 52)
            HStack(spacing: Spacing.s3) {
                Shimmer(width: 38, height: 38, cornerRadius: Radii.md)
                VStack(alignment: .leading, spacing: 7) {
                    Shimmer(width: 130, height: 11)
                    Shimmer(width: 170, height: 9)
                }
                Spacer(minLength: 0)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            HStack(spacing: Spacing.s2) {
                Circle().fill(Theme.Color.primary600).frame(width: 7, height: 7)
                Text("Opening your booking")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s5)
        .accessibilityLabel("Opening your booking")
    }

    // MARK: - Resolved

    private func resolved(_ response: ManageBookingResponse) -> some View {
        let tz = viewModel.tz(response)
        return ScrollView {
            VStack(spacing: Spacing.s4) {
                EdgePillarAvatar(name: viewModel.hostName(response), ownerType: response.page?.ownerType, size: 64)
                    .padding(.top, Spacing.s5)
                VStack(spacing: Spacing.s2) {
                    Text("Pick up where you left off")
                        .font(.system(size: 19, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.center)
                    Text("Your timezone and details come with you.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                }
                eventPreview(response, tz: tz)
                identityLine(response, tz: tz)
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.bottom, Spacing.s5)
        }
        .safeAreaInset(edge: .bottom) {
            EdgeDock {
                PrimaryButton(title: "Continue in app") { viewModel.continueInApp() }
                GhostButton(title: "Stay on web") { openWeb() }
            }
        }
    }

    private func eventPreview(_ response: ManageBookingResponse, tz: String) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(.calendar, size: 18, color: Theme.Color.primary600)
                .frame(width: 38, height: 38)
                .background(Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(response.eventType?.name ?? "Your booking")
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(previewSubtitle(response, tz: tz))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private func previewSubtitle(_ response: ManageBookingResponse, tz: String) -> String {
        var parts: [String] = []
        if let duration = response.eventType?.defaultDuration {
            parts.append(EdgeFormat.duration(duration))
        }
        if SchedulingFeatureFlags.paidEnabled,
           let price = response.eventType?.priceCents, price > 0,
           let money = EdgeFormat.money(cents: price, currency: response.eventType?.currency) {
            parts.append(money)
        }
        if let host = viewModel.hostName(response) {
            parts.append("with \(host)")
        }
        return parts.isEmpty ? (EdgeFormat.dayTime(response.booking.startAt, tz: tz) ?? "") : parts.joined(separator: " · ")
    }

    private func identityLine(_ response: ManageBookingResponse, tz: String) -> some View {
        HStack(spacing: Spacing.s2) {
            EdgePillarAvatar(name: response.booking.inviteeName, ownerType: response.page?.ownerType, size: 20)
            Text(identityText(response, tz: tz))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(Capsule())
    }

    private func identityText(_ response: ManageBookingResponse, tz: String) -> String {
        let zone = TimeZone(identifier: tz)?.abbreviation() ?? tz
        if let name = response.booking.inviteeName, !name.isEmpty {
            return "Continuing as \(name) · times in \(zone)"
        }
        return "Times shown in \(zone)"
    }

    // MARK: - Failed

    private func failed(message: String) -> some View {
        VStack(spacing: Spacing.s4) {
            Spacer(minLength: 0)
            EdgeIconHalo(icon: .smartphone, tone: .warning, size: 84)
            VStack(spacing: Spacing.s2) {
                Text("We couldn't open this in the app")
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                Text("No problem — you can keep going on the web. Your booking is right where you left it.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 250)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s5)
        .safeAreaInset(edge: .bottom) {
            EdgeDock {
                PrimaryButton(title: "Continue on the web") { openWeb() }
                GhostButton(title: "Try the app again") { await viewModel.retry() }
            }
        }
        .accessibilityLabel(message)
    }

    private func openWeb() {
        if let url = viewModel.webURL { openURL(url) }
    }
}

/// The Pantopus brand mark — a rounded-square sky gradient tile carrying the
/// concentric-ring glyph. Leads the resolving interstitial (design `PantopusMark`).
private struct PantopusMark: View {
    var size: CGFloat = 52

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [Theme.Color.primary600, Theme.Color.primary700],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .frame(width: size, height: size)
            .overlay(glyph)
            .shadow(color: Theme.Color.primary600.opacity(0.28), radius: 4, x: 0, y: 3)
            .accessibilityHidden(true)
    }

    private var glyph: some View {
        let g = size * 0.62
        return ZStack {
            Circle()
                .stroke(Color.white.opacity(0.35), lineWidth: g * 0.05)
                .frame(width: g * 0.85, height: g * 0.85)
            Circle()
                .stroke(Color.white, lineWidth: g * 0.07)
                .frame(width: g * 0.5, height: g * 0.5)
            Circle()
                .fill(Color.white)
                .frame(width: g * 0.16, height: g * 0.16)
        }
    }
}

#if DEBUG
#Preview("Resolved") {
    NavigationStack { DeepLinkHandoffView(viewModel: .previewResolved()) }
}
#endif
