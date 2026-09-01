//
//  HubComponents.swift
//  Pantopus
//
//  A1 Scheduling Hub building blocks — booking-link card (with mini live
//  preview), pause/paused/read-only status rows, composed-availability note
//  (Home/Business), agenda date headers + booking rows, the Manage chevron
//  group, the empty/first-run state, and the pinned footer CTA. Matches
//  `scheduling-hub-frames.jsx` 1:1. Tokens only.
//

import SwiftUI

// swiftlint:disable file_length

// MARK: - Composed-availability note (Home / Business)

/// Soft pillar-tinted explainer + member avatar stack. Shown above the booking
/// link card for non-personal owners (FrameHome).
struct HubComposedNote: View {
    let owner: SchedulingOwner
    let members: [String]

    private var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var body: some View {
        HStack(spacing: 10) {
            Icon(.info, size: 15, color: theme.accent)
            Text("Times come from each member's personal availability.")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s2)
            avatarStack
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 9)
        .background(theme.accentBg)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s3)
    }

    private var avatarStack: some View {
        HStack(spacing: -6) {
            ForEach(Array(members.enumerated()), id: \.offset) { idx, m in
                let tone = SchedulingHubModel.avatarTone(for: m)
                Text(m)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(tone.fg)
                    .frame(width: 22, height: 22)
                    .background(tone.bg)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .zIndex(Double(members.count - idx))
            }
        }
    }
}

// MARK: - Booking-link card

/// Booking-link card with miniature live preview, monospace handle + QR button,
/// and Copy / Share ghost buttons. (FrameDefault / FramePaused / FrameHome /
/// FramePermission.)
struct HubLinkCard: View {
    let owner: SchedulingOwner
    let handle: String
    let name: String
    let role: String
    var paused: Bool = false
    var readOnly: Bool = false
    let onCopy: () -> Void
    let onShare: () -> Void

    private var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            header
            HubLinkPreview(owner: owner, name: name, role: role, paused: paused)
                .padding(.top, 10)
            handleRow.padding(.top, Spacing.s3)
            ghostButtons.padding(.top, 10)
        }
        .padding(14)
        .setupCard(radius: Radii.xl)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, 14)
    }

    private var header: some View {
        HStack(spacing: 6) {
            Icon(.link, size: 14, color: theme.accent)
            Text("Your booking link")
                .font(.system(size: 11.5, weight: .bold))
                .foregroundStyle(Theme.Color.appTextStrong)
            Spacer(minLength: Spacing.s2)
            Text("Anyone with the link can book you")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }

    private var handleRow: some View {
        HStack(spacing: Spacing.s2) {
            Text(handle)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onShare) {
                Icon(.qrCode, size: 15, color: Theme.Color.appTextStrong)
                    .frame(width: 30, height: 30)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            .accessibilityLabel("Show QR code")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 9)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.Color.appBorderSubtle, lineWidth: 1))
    }

    private var ghostButtons: some View {
        HStack(spacing: Spacing.s2) {
            ghost(title: "Copy link", icon: .copy, action: onCopy)
                .accessibilityIdentifier("schedulingHubCopyLink")
            if !readOnly {
                ghost(title: "Share", icon: .share, action: onShare)
                    .accessibilityIdentifier("schedulingHubShare")
            }
        }
    }

    private func ghost(title: String, icon: PantopusIcon, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Icon(icon, size: 14, color: Theme.Color.appText)
                Text(title).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.Color.appText)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 38)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        }
    }
}

/// Miniature live preview of the public /book page inside the link card.
private struct HubLinkPreview: View {
    let owner: SchedulingOwner
    let name: String
    let role: String
    let paused: Bool

    private var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
                .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorderSubtle, lineWidth: 1))
            miniPage
            livePreviewBadge
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(Spacing.s2)
            if paused { pausedOverlay }
        }
        .frame(height: 140)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var livePreviewBadge: some View {
        HStack(spacing: Spacing.s1) {
            Circle().fill(paused ? Theme.Color.appTextMuted : Theme.Color.success).frame(width: 5, height: 5)
            Text("LIVE PREVIEW").font(.system(size: 9, weight: .bold)).tracking(0.4).foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(Theme.Color.appSurface.opacity(0.92))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
    }

    private var miniPage: some View {
        VStack(spacing: Spacing.s0) {
            ZStack(alignment: .bottomLeading) {
                LinearGradient(colors: [theme.accent, theme.accent.opacity(0.8)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    .frame(height: 30)
                Text(setupInitials(name))
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(width: 26, height: 26)
                    .background(theme.accent)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: 12, y: 12)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(name).font(.system(size: 10, weight: .bold)).foregroundStyle(Theme.Color.appText).lineLimit(1)
                Text(role).font(.system(size: 8)).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
                HStack(spacing: Spacing.s1) {
                    ForEach(["9:00", "9:30", "10:00"], id: \.self) { t in
                        Text(t)
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(paused ? Theme.Color.appTextMuted : theme.accent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.s1)
                            .background(paused ? Theme.Color.appSurfaceSunken : theme.accentBg)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous).stroke(
                                paused ? Theme.Color.appBorder : Theme.Color.primary200,
                                lineWidth: 1
                            ))
                    }
                }
                .padding(.top, 6)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, 14)
            .padding(.bottom, 10)
        }
        .frame(width: 188)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .pantopusShadow(.md)
    }

    private var pausedOverlay: some View {
        ZStack {
            Theme.Color.appBg.opacity(0.55)
            HStack(spacing: 5) {
                Icon(.pause, size: 12, color: Theme.Color.warning)
                Text("Paused").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.Color.warning)
            }
            .padding(.horizontal, 11)
            .padding(.vertical, 5)
            .background(Theme.Color.appSurface)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Theme.Color.warningLight, lineWidth: 1))
        }
    }
}

// MARK: - Pause / paused / read-only status rows

/// "Accepting bookings" toggle row (default). Tapping the toggle pauses.
struct HubPauseRow: View {
    let owner: SchedulingOwner
    let isOn: Bool
    let onToggle: (Bool) -> Void

    private var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var body: some View {
        HStack(spacing: Spacing.s3) {
            setupIconTile(.calendarCheck, bg: theme.accentBg, fg: theme.accent)
            VStack(alignment: .leading, spacing: 1) {
                Text("Accepting bookings").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                Text("New bookings are open").font(.system(size: 11.5)).foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Button { onToggle(!isOn) } label: { SetupMiniToggle(isOn: isOn, accent: theme.accent) }
                .accessibilityIdentifier("schedulingHubPauseToggle")
                .accessibilityLabel("Accepting bookings")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .setupCard(radius: Radii.lg)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
    }
}

/// Amber "Bookings are paused" banner with a Resume button (paused state).
struct HubPausedBanner: View {
    let onResume: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            // Design: `P.warningBg` (amber-100) tile with a `P.warning`
            // (amber-700) glyph — warmAmberBg/warmAmber, not the lighter
            // semantic warning pair.
            setupIconTile(.pause, bg: Theme.Color.warmAmberBg, fg: Theme.Color.warmAmber)
            VStack(alignment: .leading, spacing: 1) {
                Text("Bookings are paused").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                Text("New bookings are turned off").font(.system(size: 11.5)).foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Button(action: onResume) {
                Text("Resume")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 14)
                    .padding(.vertical, Spacing.s2)
                    .background(Theme.Color.warmAmber)
                    .clipShape(Capsule())
            }
            .accessibilityIdentifier("schedulingHubResume")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.warningLight, lineWidth: 1))
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
    }
}

/// Permission-gated read-only status row ("Managed by the home owner").
struct HubReadOnlyStatus: View {
    let owner: SchedulingOwner

    private var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var body: some View {
        HStack(spacing: Spacing.s3) {
            setupIconTile(.calendarCheck, bg: theme.accentBg, fg: theme.accent)
            VStack(alignment: .leading, spacing: 1) {
                Text("Accepting bookings").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                Text("Managed by the home owner").font(.system(size: 11.5)).foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Icon(.lock, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .setupCard(radius: Radii.lg)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
    }
}

// MARK: - Agenda date header + booking row

struct HubAgendaDateHeader: View {
    let label: String
    let sub: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Text(label.uppercased()).font(.system(size: 12, weight: .bold)).tracking(0.2).foregroundStyle(Theme.Color.appText)
            if !sub.isEmpty {
                Text(sub).font(.system(size: 11, weight: .medium)).foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s2)
    }
}

/// One agenda booking row — type-icon tile + title/time + duration meta + booker
/// avatar + status pill.
struct HubBookingRowCard: View {
    let row: HubBookingRow

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous).fill(row.iconBg)
                Icon(row.icon, size: 20, color: row.iconFg)
            }
            .frame(width: 40, height: 40)

            VStack(alignment: .leading, spacing: Spacing.s0) {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                    Text(row.title)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(row.timeLabel)
                        .font(.system(size: 13, weight: .bold))
                        .tracking(-0.2)
                        .foregroundStyle(Theme.Color.appText)
                        .monospacedDigit()
                }
                .padding(.bottom, 3)

                HStack(spacing: 5) {
                    Icon(.clock, size: 11, color: Theme.Color.appTextMuted)
                    Text(row.metaLabel).font(.system(size: 11.5)).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
                    // Cross-owner host attribution on composed hubs — 11pt
                    // `user` glyph + host first name (FrameHome `crossOwner`).
                    if let host = row.hostName {
                        HStack(spacing: 3) {
                            Icon(.user, size: 11, color: Theme.Color.appTextSecondary)
                            Text(host).font(.system(size: 11.5)).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
                        }
                        .padding(.leading, 2)
                    }
                }
                .padding(.bottom, Spacing.s2)

                HStack(spacing: Spacing.s2) {
                    HStack(spacing: 6) {
                        Text(row.bookerInitials)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(row.bookerFg)
                            .frame(width: 20, height: 20)
                            .background(row.bookerBg)
                            .clipShape(Circle())
                        Text(row.bookerName)
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextStrong)
                            .lineLimit(1)
                    }
                    Spacer(minLength: Spacing.s2)
                    SchedulingStatusPill(status: row.status)
                }
            }
        }
        .padding(Spacing.s3)
        .setupCard(radius: Radii.lg)
        .padding(.horizontal, Spacing.s4)
    }
}

// MARK: - Manage chevron group

struct HubManageItem: Identifiable {
    let id: String
    let icon: PantopusIcon
    let label: String
    var value: String?
    var alert: Bool = false
    var action: () -> Void

    init(id: String, icon: PantopusIcon, label: String, value: String? = nil, alert: Bool = false, action: @escaping () -> Void) {
        self.id = id
        self.icon = icon
        self.label = label
        self.value = value
        self.alert = alert
        self.action = action
    }
}

/// The "Manage" grouped chevron-row card (QuickRows).
struct HubManageRows: View {
    let items: [HubManageItem]
    var readOnly: Bool = false

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                Button(action: item.action) {
                    HStack(spacing: Spacing.s3) {
                        Icon(item.icon, size: 18, color: Theme.Color.appTextStrong)
                        Text(item.label).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                        Spacer(minLength: Spacing.s2)
                        if let value = item.value {
                            Text(value)
                                .font(.system(size: 12, weight: item.alert ? .bold : .medium))
                                .foregroundStyle(item.alert ? Theme.Color.warmAmber : Theme.Color.appTextSecondary)
                                .lineLimit(1)
                        }
                        if !readOnly {
                            Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 13)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(readOnly)
                .accessibilityIdentifier("schedulingManage_\(item.id)")
                if idx < items.count - 1 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, 14)
                }
            }
        }
        .setupCard(radius: Radii.lg)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
    }
}

// MARK: - Empty / first-run state

/// Empty / first-run hub state — radial hero, headline, amber three-steps setup
/// banner with the single primary CTA, and dashed "Not set up" placeholder rows.
struct HubEmptyState: View {
    let owner: SchedulingOwner
    let onSetUp: () -> Void

    private var theme: SchedulingIdentityTheme {
        owner.theme
    }

    private var headline: String {
        switch owner {
        case .personal: "Set up your booking link"
        case .home: "Set up family scheduling"
        case .business: "Set up business booking"
        }
    }

    private var subhead: String {
        switch owner {
        case .personal: "Create a link anyone can use to book time with you. Pick your hours and the meeting types you offer."
        case .home: "Let people book any free member during their own hours. Pick who's scheduled and how times combine."
        case .business: "Create a link clients can use to book you. Add a service, seat your team, and choose how bookings confirm."
        }
    }

    private var ctaTitle: String {
        switch owner {
        case .personal: "Set up your booking link"
        case .home: "Set up family scheduling"
        case .business: "Set up business booking"
        }
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            hero
            banner.padding(.top, 18)
            placeholders.padding(.top, 22)
        }
        .padding(.bottom, Spacing.s10)
    }

    private var hero: some View {
        VStack(spacing: Spacing.s0) {
            ZStack {
                Circle().fill(
                    RadialGradient(
                        colors: [theme.accentBg, theme.accentBg.opacity(0.6)],
                        center: .init(x: 0.3, y: 0.3),
                        startRadius: 0,
                        endRadius: 88
                    )
                )
                Icon(.calendarPlus, size: 38, strokeWidth: 1.7, color: theme.accent)
            }
            .frame(width: 88, height: 88)
            .padding(.bottom, 18)
            Text(headline)
                .font(.system(size: 20, weight: .bold))
                .tracking(-0.3)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .padding(.bottom, Spacing.s2)
            Text(subhead)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .frame(maxWidth: 280)
        }
        .padding(.horizontal, Spacing.s6)
        .padding(.top, 34)
    }

    private var banner: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                setupIconTile(.wandSparkles, bg: Theme.Color.warmAmberBg, fg: Theme.Color.warmAmber, size: 38, glyph: 19)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Three quick steps").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.Color.appText)
                    Text(stepsLine)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .lineSpacing(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Spacing.s0)
            }
            SetupPrimaryCTA(title: ctaTitle, icon: .arrowRight, owner: owner, height: 46, action: onSetUp)
                .padding(.top, 14)
        }
        .padding(Spacing.s4)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.warningLight, lineWidth: 1))
        .padding(.horizontal, Spacing.s4)
    }

    private var stepsLine: String {
        switch owner {
        case .personal: "Set your hours, add a meeting type, then share your link."
        case .home: "Pick members, choose how times combine, then share your link."
        case .business: "Claim your link, add a service, then share it with clients."
        }
    }

    private var placeholders: some View {
        VStack(spacing: Spacing.s2) {
            ForEach(placeholderRows, id: \.0) { _, label, icon in
                HStack(spacing: Spacing.s3) {
                    Icon(icon, size: 18, color: Theme.Color.appTextMuted)
                    Text(label).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appTextSecondary)
                    Spacer(minLength: Spacing.s2)
                    Text("Not set up").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.Color.appTextMuted)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                        .foregroundStyle(Theme.Color.appBorderStrong)
                )
            }
        }
        .opacity(0.5)
        .padding(.horizontal, Spacing.s4)
    }

    // swiftlint:disable:next large_tuple
    private var placeholderRows: [(Int, String, PantopusIcon)] {
        [(0, "Event types", .layoutGrid), (1, "Availability", .clock), (2, "Connected calendars", .calendarSync)]
    }
}

// MARK: - Pinned footer CTA

/// Translucent pinned footer CTA. Shares the booking link, or (paused) resumes.
struct HubFooterCTA: View {
    let owner: SchedulingOwner
    let isPaused: Bool
    let action: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            SetupPrimaryCTA(
                title: isPaused ? "Resume bookings" : "Share booking link",
                icon: isPaused ? .play : .share,
                iconTrailing: false,
                owner: owner,
                height: 48,
                action: action
            )
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s6)
        }
        .background(Theme.Color.appSurface.opacity(0.94))
        .background(.ultraThinMaterial)
    }
}
