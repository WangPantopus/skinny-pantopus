//
//  OwnerHeader.swift
//  Pantopus
//
//  A10.7 — the owner / edit frame's chrome above the scroll body:
//    · `OwnerTopBar`   — "Business" + violet "Owner view" eyebrow + chart /
//                        settings actions.
//    · `OwnerLiveBar`  — live-status dot + "Edited …" meta + a "View as
//                        neighbor" eye button that flips into preview mode.
//    · `OwnerHeaderBanner` — the `BizBannerHeader` look with edit fabs
//                        overlaid (camera on the banner, pencil on the logo,
//                        pencil beside the name), each opening Edit Business
//                        Page.
//
//  Business violet throughout. Design reference:
//  `docs/designs/A10/business-owner-frames.jsx` (OwnerTopBar / OwnerLiveBar /
//  OwnerHeader).
//

import SwiftUI

// MARK: - Top bar

@MainActor
struct OwnerTopBar: View {
    let onBack: @MainActor () -> Void
    let onOpenInsights: @MainActor () -> Void
    let onOpenSettings: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s0) {
            iconButton(.chevronLeft, label: "Back", action: onBack)
            VStack(spacing: 1) {
                Text("Business")
                    .font(.system(size: 14, weight: .semibold))
                    .tracking(-0.15)
                    .foregroundStyle(Theme.Color.appText)
                HStack(spacing: 3) {
                    Icon(.edit2, size: 9, strokeWidth: 2.5, color: Theme.Color.business)
                    Text("OWNER VIEW")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.4)
                        .foregroundStyle(Theme.Color.business)
                }
            }
            .frame(maxWidth: .infinity)
            iconButton(.barChart3, label: "Insights", action: onOpenInsights)
            iconButton(.slidersHorizontal, label: "Settings", action: onOpenSettings)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("businessOwner.topBar")
    }

    private func iconButton(
        _ icon: PantopusIcon,
        label: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button { action() } label: {
            Icon(icon, size: 19, color: Theme.Color.appText)
                .frame(width: 34, height: 34)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

// MARK: - Live status bar

@MainActor
struct OwnerLiveBar: View {
    let isLive: Bool
    let editedMeta: String
    let onPreview: @MainActor () -> Void

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(isLive ? Theme.Color.success : Theme.Color.appTextMuted)
                .frame(width: 8, height: 8)
            Text(isLive ? "Page is live" : "Draft")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Circle()
                .fill(Theme.Color.appTextMuted)
                .frame(width: 3, height: 3)
            Text(editedMeta)
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s2)
            Button { onPreview() } label: {
                HStack(spacing: Spacing.s1) {
                    Icon(.eye, size: 13, color: Theme.Color.appText)
                    Text("View as neighbor")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                }
                .padding(.horizontal, 11)
                .padding(.vertical, 6)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("View as neighbor")
            .accessibilityIdentifier("businessOwner.viewAsNeighbor")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("businessOwner.liveBar")
    }
}

// MARK: - Banner header (with edit fabs)

@MainActor
struct OwnerHeaderBanner: View {
    let name: String
    let handle: String
    let locality: String
    let logoIcon: PantopusIcon?
    let status: BizStatusBadge?
    /// Opens Edit Business Page (shared by the camera / logo / name fabs).
    let onEdit: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            banner
            content
        }
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("businessOwner.header")
    }

    private var banner: some View {
        LinearGradient(
            colors: [Theme.Color.businessDark, Theme.Color.business],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .frame(height: 116)
        .overlay(
            LinearGradient(
                colors: [Color.black.opacity(0), Color.black.opacity(0.18)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .overlay(alignment: .topTrailing) {
            EditFab(icon: .camera, diameter: 28, action: onEdit)
                .accessibilityLabel("Edit banner")
                .padding(Spacing.s3)
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            logo
                .padding(.top, -34)
                .padding(.bottom, 10)
            nameRow
            metaRow
                .padding(.top, Spacing.s1)
            chipRow
                .padding(.top, 11)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.bottom, Spacing.s4)
    }

    private var logo: some View {
        ZStack(alignment: .bottomTrailing) {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Theme.Color.business, Theme.Color.businessDark],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 68, height: 68)
                .overlay(logoMonogram)
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(Theme.Color.appSurface, lineWidth: 3)
                )
                .shadow(color: Color.black.opacity(0.18), radius: 6, y: 4)
            EditFab(icon: .pencil, diameter: 24, action: onEdit)
                .accessibilityLabel("Edit logo")
                .offset(x: 6, y: 6)
        }
    }

    @ViewBuilder private var logoMonogram: some View {
        if let logoIcon {
            Icon(logoIcon, size: 30, strokeWidth: 2, color: Theme.Color.appTextInverse)
        } else {
            Text(resolvedInitials)
                .font(.system(size: 26, weight: .black))
                .tracking(-0.5)
                .foregroundStyle(Theme.Color.appTextInverse)
        }
    }

    private var nameRow: some View {
        Button { onEdit() } label: {
            HStack(spacing: 7) {
                Text(name)
                    .font(.system(size: 20, weight: .heavy))
                    .tracking(-0.5)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.leading)
                Icon(.pencil, size: 14, color: Theme.Color.business)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Edit name, \(name)")
    }

    private var metaRow: some View {
        HStack(spacing: Spacing.s2) {
            Text(handle)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.primary700)
            Circle().fill(Theme.Color.appTextMuted).frame(width: 3, height: 3)
            HStack(spacing: 3) {
                Icon(.mapPin, size: 11, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                Text(locality)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private var chipRow: some View {
        HStack(spacing: 6) {
            chip(
                icon: .shieldCheck,
                dot: nil,
                text: "Business · Verified",
                background: Theme.Color.businessBg,
                foreground: Theme.Color.businessDark
            )
            if let status {
                chip(
                    icon: nil,
                    dot: status.foreground,
                    text: status.label,
                    background: status.background,
                    foreground: status.foreground
                )
            }
        }
    }

    private func chip(
        icon: PantopusIcon?,
        dot: Color?,
        text: String,
        background: Color,
        foreground: Color
    ) -> some View {
        HStack(spacing: Spacing.s1) {
            if let dot {
                Circle().fill(dot).frame(width: 6, height: 6)
            }
            if let icon {
                Icon(icon, size: 11, strokeWidth: 2.2, color: foreground)
            }
            Text(text)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, Spacing.s1)
        .background(background)
        .clipShape(Capsule())
    }

    private var resolvedInitials: String {
        let parts = name.split(separator: " ").prefix(2)
        let derived = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return derived.isEmpty ? "?" : derived
    }
}

// MARK: - Edit fab

/// A frosted dark circular edit affordance overlaid on the banner / logo.
@MainActor
private struct EditFab: View {
    let icon: PantopusIcon
    let diameter: CGFloat
    let action: @MainActor () -> Void

    var body: some View {
        Button { action() } label: {
            Icon(icon, size: diameter * 0.5, color: Theme.Color.appTextInverse)
                .frame(width: diameter, height: diameter)
                .background(Theme.Color.appText.opacity(0.55), in: Circle())
                .overlay(
                    Circle().stroke(Theme.Color.appTextInverse.opacity(0.9), lineWidth: 1.5)
                )
        }
        .buttonStyle(.plain)
    }
}

#Preview("Owner header chrome") {
    VStack(spacing: Spacing.s0) {
        OwnerTopBar(onBack: {}, onOpenInsights: {}, onOpenSettings: {})
        OwnerLiveBar(isLive: true, editedMeta: "Edited 3d ago") {}
        OwnerHeaderBanner(
            name: "Marlow & Co. Cleaning",
            handle: "@marlowco",
            locality: "Elm Park",
            logoIcon: .sparkles,
            status: .open("Open now")
        ) {}
        Spacer()
    }
    .background(Theme.Color.appBg)
}
