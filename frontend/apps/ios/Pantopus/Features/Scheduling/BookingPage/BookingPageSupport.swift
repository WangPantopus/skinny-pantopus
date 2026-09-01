//
//  BookingPageSupport.swift
//  Pantopus
//
//  Shared building blocks for Stream I4 (Booking page & sharing), matched to
//  the Calendarly design mockups (event-editor-shell.jsx / booking-link /
//  preview / oneoff / share frames): the public booking-link URL builder, the
//  system share/messages/email actions, the avatar, and token-styled design
//  primitives (cards, overlines, section labels, pillar chip, status chip,
//  link rows, segmented control, chips) reused by C1/C2/C4/H16.
//
//  Tokens only — no hardcoded colors/spacing. Owner context, DTOs, endpoints
//  and the Foundation SharedUI come from Foundation and are consumed read-only.
//

import SwiftUI
import UIKit

extension View {
    /// Applies a Pantopus shadow only when one is provided (avoids a
    /// non-existent `.none` shadow token for conditional styling).
    @ViewBuilder
    func bookingShadow(_ shadow: PantopusShadow?) -> some View {
        if let shadow { pantopusShadow(shadow) } else { self }
    }
}

// MARK: - Public booking-link URL builder

/// Builds the human-facing booking link shown in management, share and
/// one-off surfaces. The backend serves the public page JSON at
/// `/api/public/book/:slug`; the *shareable* page lives at `<web>/book/:slug`
/// and one-off `path`s arrive as `/book/o/:token`. There is no web-origin in
/// `AppEnvironment` yet, so the origin is centralised here (matches the
/// design's `pantopus.com`). A shared `publicBookingBaseURL` in Foundation/
/// config would be the better long-term home — flagged in the I4 PR.
enum BookingLinkURL {
    static let displayOrigin = "pantopus.com"
    static let scheme = "https"

    static func display(slug: String) -> String {
        "\(displayOrigin)/book/\(slug)"
    }

    static func shareable(slug: String) -> String {
        "\(scheme)://\(display(slug: slug))"
    }

    static func display(path: String) -> String {
        "\(displayOrigin)\(normalized(path))"
    }

    static func shareable(path: String) -> String {
        "\(scheme)://\(display(path: path))"
    }

    private static func normalized(_ path: String) -> String {
        path.hasPrefix("/") ? path : "/\(path)"
    }
}

// MARK: - Share / messages / email actions

@MainActor
enum BookingLinkActions {
    static func copy(_ string: String) {
        UIPasteboard.general.string = string
    }

    static func openMessages(with link: String, openURL: OpenURLAction) {
        let body = link.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? link
        guard let url = URL(string: "sms:&body=\(body)") else { return }
        openURL(url)
    }

    static func openEmail(with link: String, openURL: OpenURLAction) {
        let subject = "Book a time with me".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let body = link.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? link
        guard let url = URL(string: "mailto:?subject=\(subject)&body=\(body)") else { return }
        openURL(url)
    }

    /// Presents the system `UIActivityViewController` via UIKit topmost-VC so it
    /// works from inside another SwiftUI sheet.
    static func presentShare(_ items: [Any]) {
        guard let scene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
            let root = scene.keyWindow?.rootViewController
        else { return }
        var top = root
        while let presented = top.presentedViewController {
            top = presented
        }
        let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)
        activity.popoverPresentationController?.sourceView = top.view
        top.present(activity, animated: true)
    }
}

// MARK: - Avatar (solid pillar-gradient disc + white initials)

/// Round avatar matching the design's solid gradient disc with white initials
/// and a soft shadow (remote image when available). Reused by C1's header and
/// C2's public preview.
struct BookingPageAvatar: View {
    let name: String
    var imageURLString: String?
    var size: CGFloat = 48
    var accent: Color = Theme.Color.primary600

    var body: some View {
        Group {
            if let imageURLString, let url = URL(string: imageURLString) {
                AsyncImage(url: url) { phase in
                    if case let .success(image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        disc
                    }
                }
            } else {
                disc
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .pantopusShadow(.md)
    }

    private var disc: some View {
        ZStack {
            LinearGradient(
                colors: [accent.opacity(0.78), accent],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Text(initials)
                .font(.system(size: size * 0.36, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
    }

    private var initials: String {
        let parts = name.split(separator: " ").prefix(2).compactMap(\.first)
        return parts.isEmpty ? "?" : String(parts).uppercased()
    }
}

// MARK: - Card chrome

/// White rounded card: 1px `appBorder`, 16px radius, `sm` shadow — the booking
/// surface card used across I4.
struct BookingCard<Content: View>: View {
    var padding: CGFloat = Spacing.s3
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(padding)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .pantopusShadow(.sm)
    }
}

/// Pillar-accent overline inside a card (uppercase 9.5/700) — per the shell
/// contract, card overlines carry the pillar accent.
struct CardOverline: View {
    let text: String
    var accent: Color = Theme.Color.appTextSecondary

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 9.5, weight: .bold))
            .tracking(0.8)
            .foregroundStyle(accent)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Neutral uppercase section header rendered ABOVE a card (C4 sheet groups).
struct SectionLabel: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 9.5, weight: .bold))
            .tracking(0.8)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Pillar identity chip (the only place besides overlines carrying pillar)

struct PillarHeaderChip: View {
    let theme: SchedulingIdentityTheme

    var body: some View {
        HStack(spacing: 5) {
            Icon(icon, size: 11, strokeWidth: 2.4, color: theme.accent)
            Text(theme.title.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(theme.accent)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(theme.accentBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .accessibilityIdentifier("scheduling.pillarChip")
    }

    private var icon: PantopusIcon {
        switch theme.identity {
        case .business: .briefcase
        case .home: .home
        default: .user
        }
    }
}

// MARK: - Status chip (Live / Paused / Draft with a colored dot)

enum BookingStatusTone { case live, paused, draft }

struct BookingStatusChip: View {
    let tone: BookingStatusTone

    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(dot).frame(width: 6, height: 6)
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .textCase(.uppercase)
                .foregroundStyle(fg)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }

    private var label: String {
        switch tone {
        case .live: "Live"
        case .paused: "Paused"
        case .draft: "Draft"
        }
    }

    private var bg: Color {
        switch tone {
        case .live: Theme.Color.successLight
        case .paused: Theme.Color.appSurfaceSunken
        case .draft: Theme.Color.warningBg
        }
    }

    private var fg: Color {
        switch tone {
        case .live: Theme.Color.success
        case .paused: Theme.Color.appTextStrong
        case .draft: Theme.Color.warning
        }
    }

    private var dot: Color {
        switch tone {
        case .live: Theme.Color.success
        case .paused: Theme.Color.appTextMuted
        case .draft: Theme.Color.warning
        }
    }
}

// MARK: - Link row (icon tile + label + value + chevron)

struct BookingLinkRow: View {
    let icon: PantopusIcon
    let title: String
    var value: String?
    var showsDivider: Bool = false
    let action: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Button(action: action) {
                HStack(spacing: Spacing.s3) {
                    Icon(icon, size: 15, color: Theme.Color.appTextStrong)
                        .frame(width: 30, height: 30)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(title)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                    }
                    Spacer(minLength: Spacing.s2)
                    if let value {
                        Text(value)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(.vertical, Spacing.s2)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if showsDivider {
                Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            }
        }
    }
}

// MARK: - Segmented control (design: white selected pill + primary700 text)

struct BookingSegmented<Value: Hashable>: View {
    let options: [(String, Value)]
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: 3) {
            ForEach(options.indices, id: \.self) { index in
                let option = options[index]
                let isSelected = selection == option.1
                Button { selection = option.1 } label: {
                    Text(option.0)
                        .font(.system(size: 11.5, weight: isSelected ? .bold : .semibold))
                        .foregroundStyle(isSelected ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.s2)
                        .background(isSelected ? Theme.Color.appSurface : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                        .bookingShadow(isSelected ? .sm : nil)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("scheduling.segment.\(option.0)")
            }
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

// MARK: - Inline note (warning / info / error, tone-tinted with a 1px border)

struct InlineNote: View {
    enum Tone { case warning, info, error }
    let tone: Tone
    let text: String
    var icon: PantopusIcon = .info

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(icon, size: 14, color: foreground)
            Text(text)
                .font(.system(size: 11.5))
                .foregroundStyle(foreground)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(border, lineWidth: 1)
        )
    }

    private var foreground: Color {
        switch tone {
        case .warning: Theme.Color.warning
        case .info: Theme.Color.info
        case .error: Theme.Color.error
        }
    }

    private var background: Color {
        switch tone {
        case .warning: Theme.Color.warningBg
        case .info: Theme.Color.infoBg
        case .error: Theme.Color.errorBg
        }
    }

    private var border: Color {
        switch tone {
        case .warning: Theme.Color.warningLight
        case .info: Theme.Color.primary100
        case .error: Theme.Color.errorLight
        }
    }
}

// MARK: - Pill chip (expiry / suggestions): sky-filled selected, bordered default

struct BookingPillChip: View {
    let title: String
    var isSelected: Bool = false
    var mono: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: isSelected ? .bold : .semibold, design: mono ? .monospaced : .default))
                .foregroundStyle(isSelected ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .background(isSelected ? Theme.Color.primary600 : Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                        .stroke(isSelected ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                .bookingShadow(isSelected ? .primary : nil)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Location-mode display

enum BookingLocationMode {
    static func label(_ mode: String?) -> String {
        switch (mode ?? "").lowercased() {
        case "video": "Video call"
        case "phone": "Phone call"
        case "in_person": "In person"
        case "custom": "Custom"
        case "ask": "They choose"
        default: "Video call"
        }
    }

    /// Short modality word for sublines, e.g. "video".
    static func shortLabel(_ mode: String?) -> String {
        switch (mode ?? "").lowercased() {
        case "video": "video"
        case "phone": "phone"
        case "in_person": "in person"
        case "custom": "custom"
        case "ask": "they choose"
        default: "video"
        }
    }

    static func icon(_ mode: String?) -> PantopusIcon {
        switch (mode ?? "").lowercased() {
        case "video": .video
        case "phone": .phone
        case "in_person": .mapPin
        case "ask": .messageCircle
        default: .video
        }
    }
}

// MARK: - Duration formatting

enum BookingDuration {
    static func label(_ minutes: Int) -> String {
        if minutes < 60 { return "\(minutes) min" }
        let hours = minutes / 60
        let rem = minutes % 60
        if rem == 0 { return hours == 1 ? "1 hr" : "\(hours) hr" }
        return "\(hours) hr \(rem) min"
    }
}
