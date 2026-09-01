//
//  HomeDashboardComponents.swift
//  Pantopus
//
//  Supporting views for the Home Dashboard content surface.
//

// swiftlint:disable file_length

import SwiftUI

/// Home security-state banner — `claim_window` / `review_required` /
/// `disputed` / `frozen`. Rendered at the very top of the dashboard,
/// above the claim / attention banners, mirroring RN's
/// `HomeStatusBanner` (`src/components/HomeStatusBanner.tsx`) which sits
/// directly under the header at `src/app/homes/[id]/index.tsx:211`.
struct HomeSecurityStatusBanner: View {
    let content: HomeSecurityBannerContent
    let onCTA: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Icon(content.icon, size: 20, color: tint)
                Text(content.title)
                    .pantopusTextStyle(.body)
                    .fontWeight(.bold)
                    .foregroundStyle(tint)
            }
            Text(content.body)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let ctaLabel = content.ctaLabel {
                Button(action: onCTA) {
                    Text(ctaLabel)
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(tint)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, Spacing.s2)
                        .background(tint.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                }
                .buttonStyle(.plain)
                .frame(minHeight: 44)
                .accessibilityIdentifier("homeDashboard_securityBannerCTA")
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(tint.opacity(0.4), lineWidth: 1)
        )
        .accessibilityIdentifier("homeDashboard_securityBanner")
    }

    /// Severity tint per state — the same ramp RN encodes in
    /// `STATUS_BANNER` (`src/constants/ownershipCopy.ts`), expressed in
    /// tokens rather than hex.
    private var tint: Color {
        switch content.state {
        case .claimWindow: Theme.Color.warning
        case .reviewRequired: Theme.Color.primary600
        case .disputed: Theme.Color.warning
        case .frozen: Theme.Color.error
        case .normal, .frozenSilent: Theme.Color.appTextSecondary
        }
    }
}

/// Inline banner shown above the grid-tabs body when the signed-in user
/// is not yet a verified owner of this home.
struct ClaimOwnershipBanner: View {
    let onClaim: () -> Void
    let onViewClaims: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Icon(.shieldCheck, size: 20, color: Theme.Color.primary600)
                Text("Are you the owner?")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
            }
            Text("Claim this home to unlock private features for owners.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: Spacing.s3) {
                Button(action: onClaim) {
                    Text("Claim ownership")
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.vertical, Spacing.s2)
                        .background(Theme.Color.primary600)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                }
                .buttonStyle(.plain)
                .frame(minHeight: 44)
                .accessibilityIdentifier("homeDashboard_claimCTA")

                Button(action: onViewClaims) {
                    Text("View claims")
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.primary600)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.vertical, Spacing.s2)
                }
                .buttonStyle(.plain)
                .frame(minHeight: 44)
                .accessibilityIdentifier("homeDashboard_viewClaimsCTA")
            }
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.primary600.opacity(0.4), lineWidth: 1)
        )
    }
}

struct NeedsAttentionBanner: View {
    let summary: HomeDashboardAttentionSummary
    let onJump: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.warningBg)
                    Icon(.alertTriangle, size: 18, color: Theme.Color.warning)
                }
                .frame(width: 36, height: 36)

                Text(summary.message)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(summary.chips) { chip in
                        Button { onJump(chip.actionId) } label: {
                            HStack(spacing: Spacing.s1) {
                                Icon(chip.icon, size: 14, color: Theme.Color.warning)
                                Text(chip.label)
                                    .pantopusTextStyle(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(Theme.Color.warning)
                            }
                            .padding(.horizontal, Spacing.s3)
                            .frame(minHeight: 44)
                            .background(Theme.Color.warningBg)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(Theme.Color.warningLight, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("homeDashboard_attentionChip_\(chip.id)")
                    }
                }
            }
        }
        .padding(Spacing.s4)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("homeDashboard_attentionBanner")
    }
}

struct BrandNewHomeSection: View {
    let brandNew: HomeDashboardBrandNewContent
    let onStep: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            DashboardCard(title: "Welcome home", accent: Theme.Color.home) {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    HStack(alignment: .top, spacing: Spacing.s3) {
                        ZStack {
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .fill(Theme.Color.homeBg)
                            Icon(.partyPopper, size: 22, color: Theme.Color.home)
                        }
                        .frame(width: 44, height: 44)
                        VStack(alignment: .leading, spacing: Spacing.s1) {
                            Text("Welcome home")
                                .pantopusTextStyle(.h3)
                                .foregroundStyle(Theme.Color.appText)
                            Text("Set up the essentials for this verified address.")
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }

                    VStack(spacing: Spacing.s0) {
                        ForEach(brandNew.onboardingSteps) { step in
                            OnboardingStepRow(step: step) { onStep(step.actionId) }
                            if step.id != brandNew.onboardingSteps.last?.id {
                                Rectangle()
                                    .fill(Theme.Color.appBorderSubtle)
                                    .frame(height: 1)
                            }
                        }
                    }
                }
            }

            EmergencyInfoRow(info: brandNew.content.overview.emergency) {
                onStep("view_emergency")
            }
        }
    }
}

private struct OnboardingStepRow: View {
    let step: HomeDashboardOnboardingStep
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(step.tone.backgroundColor)
                Icon(step.icon, size: 18, color: step.tone.color)
            }
            .frame(width: 36, height: 36)

            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(step.title)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text(step.body)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button(action: onTap) {
                Text(step.cta)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.primary600)
                    .padding(.horizontal, Spacing.s3)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .background(Theme.Color.primary50)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.primary100, lineWidth: 1)
            )
            .accessibilityIdentifier("homeDashboard_onboarding_\(step.id)")
        }
        .padding(.vertical, Spacing.s3)
    }
}

struct HomeOverviewSection: View {
    let content: HomeDashboardContent
    let onOpenEmergency: () -> Void
    let onOpenPropertyDetails: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            DashboardCard(title: "Upcoming", action: "See all", accent: Theme.Color.warning) {
                if content.overview.upcoming.isEmpty {
                    OverviewEmptyRow(text: "Nothing due today. You're all clear.")
                } else {
                    VStack(spacing: Spacing.s0) {
                        ForEach(content.overview.upcoming) { item in
                            TimelineRow(item: item)
                            if item.id != content.overview.upcoming.last?.id {
                                Rectangle()
                                    .fill(Theme.Color.appBorderSubtle)
                                    .frame(height: 1)
                            }
                        }
                    }
                }
            }

            DashboardCard(title: "Recent activity", action: "See all") {
                if content.overview.activity.isEmpty {
                    OverviewEmptyRow(text: "No household activity yet.")
                } else {
                    VStack(spacing: Spacing.s0) {
                        ForEach(content.overview.activity) { item in
                            ActivityRow(item: item)
                            if item.id != content.overview.activity.last?.id {
                                Rectangle()
                                    .fill(Theme.Color.appBorderSubtle)
                                    .frame(height: 1)
                            }
                        }
                    }
                }
            }

            EmergencyInfoRow(info: content.overview.emergency, onOpen: onOpenEmergency)

            Button(action: onOpenPropertyDetails) {
                HStack(spacing: Spacing.s2) {
                    Icon(.home, size: 16, color: Theme.Color.home)
                    Text("Property details")
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.home)
                }
                .frame(minHeight: 44)
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("homeDashboard_propertyDetailsRow")
        }
    }
}

/// Shared card chrome for the Overview + Home Intelligence sections.
struct DashboardCard<Content: View>: View {
    let title: String
    var action: String?
    var accent: Color?
    private let content: Content

    init(
        title: String,
        action: String? = nil,
        accent: Color? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.action = action
        self.accent = accent
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack {
                HStack(spacing: Spacing.s2) {
                    if let accent {
                        Circle()
                            .fill(accent)
                            .frame(width: 6, height: 6)
                    }
                    Text(title.uppercased())
                        .pantopusTextStyle(.overline)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                if let action {
                    Text(action)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.primary600)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)

            content
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s3)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

private struct OverviewEmptyRow: View {
    let text: String

    var body: some View {
        Text(text)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, Spacing.s3)
    }
}

private struct TimelineRow: View {
    let item: HomeDashboardTimelineItem

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(item.tone.backgroundColor)
                Icon(item.icon, size: 16, color: item.tone.color)
            }
            .frame(width: 34, height: 34)

            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(item.title)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(item.subtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }

            Spacer(minLength: Spacing.s2)

            if let trailing = item.trailing {
                Text(trailing)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(.vertical, Spacing.s3)
        .accessibilityElement(children: .combine)
    }
}

private struct ActivityRow: View {
    let item: HomeDashboardActivityItem

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Text(item.initials)
                .pantopusTextStyle(.caption)
                .fontWeight(.bold)
                .foregroundStyle(item.tone.color)
                .frame(width: 30, height: 30)
                .background(item.tone.backgroundColor)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(item.title)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text("\(item.detail) - \(item.time)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s2)
        }
        .padding(.vertical, Spacing.s3)
        .accessibilityElement(children: .combine)
    }
}

private struct EmergencyInfoRow: View {
    let info: HomeDashboardEmergencyInfo
    let onOpen: () -> Void

    var body: some View {
        DashboardCard(title: info.title, accent: info.isConfigured ? Theme.Color.error : Theme.Color.appTextMuted) {
            Button(action: onOpen) {
                HStack(spacing: Spacing.s3) {
                    ZStack {
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .fill(info.isConfigured ? Theme.Color.errorBg : Theme.Color.appSurfaceSunken)
                        Icon(.siren, size: 16, color: info.isConfigured ? Theme.Color.error : Theme.Color.appTextMuted)
                    }
                    .frame(width: 34, height: 34)

                    Text(info.body)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(info.isConfigured ? Theme.Color.appTextStrong : Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("homeDashboard_emergencyInfoRow")
        }
    }
}

struct HomeDashboardLoadingView: View {
    let onBack: (() -> Void)?

    var body: some View {
        ContentDetailShell(
            title: "Home",
            onBack: onBack,
            header: {
                Shimmer(height: 180, cornerRadius: Radii.xl2)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(spacing: Spacing.s3) {
                    Shimmer(height: 80, cornerRadius: Radii.md)
                    Shimmer(height: 40, cornerRadius: Radii.sm)
                    Shimmer(height: 120, cornerRadius: Radii.lg)
                }
                .padding(.horizontal, Spacing.s4)
            },
            cta: { NoCTA() }
        )
    }
}

struct HomeDashboardErrorView: View {
    let message: String
    let onBack: (() -> Void)?
    let onRetry: () -> Void

    var body: some View {
        ContentDetailShell(
            title: "Home",
            onBack: onBack,
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load this home",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") { await MainActor.run { onRetry() } }
                )
                .frame(height: 400)
            },
            cta: { NoCTA() }
        )
    }
}
