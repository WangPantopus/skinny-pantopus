//
//  ConnectedCalendarsView.swift
//  Pantopus
//
//  Stream I2 — B8 Connected Calendars (routed full screen). Mirrors
//  connected-calendars-frames.jsx: a personal-sky overline, a calm "coming
//  soon" hero (calendar-sync glyph), provider connect rows in 38px brand tiles,
//  an in-flight "Opening …" connecting row, and — when the backend returns
//  linked accounts — connected/synced rows (account header + status pill + two
//  toggle rows + Synced-ago + Disconnect) and the warning re-auth banner.
//  Loading skeleton / error+retry included.
//

// swiftlint:disable file_length
import SwiftUI
import UIKit

// ─── Local status chip for connected-calendar rows ───────────────────────────
// Design (connected-calendars-frames.jsx:110-123): two specific variants —
//   synced:    check icon + "Synced"       | bg=successLight (D1FAE5) | fg=success (059669)
//   attention: triangle-alert + "Action needed" | bg=warningBg  (FFFBEB) | fg=warning (D97706 / dark amber)
// These are distinct from booking statuses (SchedulingStatusPill) — they describe
// calendar sync health, not booking state — so we keep them local to this screen.
private enum CalendarSyncStatus { case synced, attention }

private struct ConnectedCalendarStatusChip: View {
    let kind: CalendarSyncStatus

    var body: some View {
        HStack(spacing: 3) {
            Icon(icon, size: 9, strokeWidth: 2.6, color: fg)
            Text(label)
                .font(.system(size: 9.5, weight: .bold))
                .foregroundStyle(fg)
                .lineLimit(1)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(bg)
        .overlay(Capsule().strokeBorder(border, lineWidth: 1))
        .clipShape(Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }

    private var label: String {
        switch kind {
        case .synced: "Synced"
        case .attention: "Action needed"
        }
    }

    private var icon: PantopusIcon {
        switch kind {
        case .synced: .check
        case .attention: .triangleAlert
        }
    }

    /// successLight = D1FAE5 (Tailwind success-100), success = 059669 (success-700)
    private var bg: Color {
        switch kind {
        case .synced: Theme.Color.successLight
        case .attention: Theme.Color.warningBg
        }
    }

    private var fg: Color {
        switch kind {
        case .synced: Theme.Color.success
        case .attention: Theme.Color.warning
        }
    }

    private var border: Color {
        switch kind {
        case .synced: Theme.Color.successLight
        case .attention: Theme.Color.warningLight
        }
    }
}

// swiftlint:disable:next type_body_length
struct ConnectedCalendarsView: View {
    @State private var viewModel: ConnectedCalendarsViewModel
    @Environment(\.openURL) private var openURL

    init(viewModel: ConnectedCalendarsViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationTitle("Connected calendars")
            .navigationBarTitleDisplayMode(.inline)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
            .accessibilityIdentifier("scheduling.connectedCalendars")
            .alert("Coming soon", isPresented: noticePresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.notice ?? "")
            }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .loading:
            loadingSkeleton
        case let .error(message):
            ErrorState(headline: "Couldn't load your calendars", message: message) {
                await viewModel.reload()
            }
        case .ready:
            loaded
        }
    }

    private var loaded: some View {
        ScrollView {
            VStack(spacing: Spacing.s5) {
                pillarOverline
                if viewModel.isComingSoon {
                    // Design `FramePlaceholder` carries the calm coming-soon card
                    // ALONE — the helper line and the per-provider connect rows
                    // belong to `FrameNone`. The two are distinct states and must
                    // not be stacked (mirrors Android's `ComingSoonState`).
                    comingSoonHero
                } else {
                    connectedAccounts
                    // Design FrameNone/FrameConnecting: the conflict-check helper sits
                    // above the provider connect rows (not in the coming-soon hero).
                    helper
                    providerRows
                }
            }
            .padding(.vertical, Spacing.s4)
        }
    }

    // MARK: Pillar overline (design sheet subtitle "Personal · Scheduling")

    private var pillarOverline: some View {
        // Design overline: 9.5px / 0.08em letter-spacing (~0.76pt at 9.5).
        Text("PERSONAL · SCHEDULING")
            .font(.system(size: 9.5, weight: .bold))
            .tracking(1.0)
            .foregroundStyle(Theme.Color.personal)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s4)
    }

    // MARK: Coming-soon hero

    private var comingSoonHero: some View {
        VStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .fill(Theme.Color.primary50)
                    .frame(width: 54, height: 54)
                Icon(.calendarSync, size: 26, strokeWidth: 1.9, color: Theme.Color.primary600)
            }
            Text("Calendar sync is coming soon")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("We'll let you know when you can connect Google, Apple, and Outlook to check for conflicts.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            HStack(spacing: Spacing.s4) {
                ForEach(viewModel.providers) { provider in
                    providerTile(provider, muted: true)
                        .opacity(0.5)
                }
            }
            .padding(.top, Spacing.s1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s5)
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("scheduling.connectedCalendars.comingSoon")
    }

    // MARK: Provider connect rows

    private var providerRows: some View {
        VStack(spacing: Spacing.s2) {
            ForEach(viewModel.providers) { provider in
                if viewModel.connectingId == provider.id {
                    connectingCard(provider)
                } else {
                    connectCard(provider)
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
    }

    private func connectCard(_ provider: CalendarProvider) -> some View {
        HStack(spacing: Spacing.s3) {
            providerTile(provider)
            VStack(alignment: .leading, spacing: 1) {
                Text(provider.name)
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text("Not connected")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            Button { Task { await viewModel.connect(provider) } } label: {
                Text("Connect")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s3)
                    .frame(height: 32)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("scheduling.connectedCalendars.connect.\(provider.id)")
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    // MARK: Connecting / OAuth-in-flight row

    private func connectingCard(_ provider: CalendarProvider) -> some View {
        HStack(spacing: Spacing.s3) {
            providerTile(provider)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(provider.name)
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                HStack(spacing: Spacing.s1) {
                    Icon(.externalLink, size: 11, color: Theme.Color.appTextSecondary)
                    Text("Opening \(provider.shortName)…")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer()
            Shimmer(width: 76, height: 12, cornerRadius: Radii.sm)
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    // MARK: Provider tile (38px white bordered tile holding the glyph)

    private func providerTile(_ provider: CalendarProvider, muted: Bool = false) -> some View {
        Icon(
            provider.icon,
            size: 19,
            strokeWidth: 2,
            color: muted ? Theme.Color.appTextMuted : provider.brandColor
        )
        .frame(width: 38, height: 38)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    // MARK: Linked accounts (connected / synced / re-auth)

    @ViewBuilder
    private var connectedAccounts: some View {
        if !viewModel.calendars.isEmpty {
            VStack(spacing: Spacing.s2) {
                ForEach(viewModel.calendars) { calendar in
                    if viewModel.isDenied(calendar) {
                        deniedCard(calendar)
                    } else if viewModel.needsReauth(calendar) {
                        reauthCard(calendar)
                    } else {
                        connectedCard(calendar)
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
    }

    private func accountHeader(_ calendar: ConnectedCalendarDTO, calendarStatus: CalendarSyncStatus) -> some View {
        HStack(spacing: Spacing.s3) {
            if let provider = viewModel.provider(for: calendar) {
                providerTile(provider)
            } else {
                Icon(.calendarDays, size: 19, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                    .frame(width: 38, height: 38)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(viewModel.provider(for: calendar)?.name ?? calendar.provider ?? "Calendar")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                if let account = calendar.externalAccount {
                    Text(account)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            ConnectedCalendarStatusChip(kind: calendarStatus)
        }
    }

    private func connectedCard(_ calendar: ConnectedCalendarDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            accountHeader(calendar, calendarStatus: .synced)
            Divider().background(Theme.Color.appBorder)
            accountToggleRow(
                icon: .search,
                title: "Check for conflicts",
                sub: "Block times when you're busy elsewhere",
                on: calendar.checkConflicts ?? true
            )
            Divider().background(Theme.Color.appBorder)
            accountToggleRow(
                icon: .calendarPlus,
                title: "Add bookings to this calendar",
                sub: "New bookings show up here",
                on: calendar.writeTarget ?? true
            )
            HStack {
                HStack(spacing: Spacing.s1) {
                    Icon(.refreshCw, size: 11, color: Theme.Color.appTextSecondary)
                    Text(syncedLine(calendar))
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                Button { viewModel.disconnect(calendar) } label: {
                    Text("Disconnect")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("scheduling.connectedCalendars.disconnect.\(calendar.id)")
            }
            .padding(.top, 2)
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    private func accountToggleRow(icon: PantopusIcon, title: String, sub: String, on: Bool) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(icon, size: 15, strokeWidth: 2, color: on ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                .frame(width: 30, height: 30)
                .background(on ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(sub)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            // Display-only: the v1 linked-account contract is read-only.
            Toggle("", isOn: .constant(on))
                .labelsHidden()
                .tint(Theme.Color.primary600)
                .disabled(true)
        }
    }

    /// Relative sync label from the row's real `last_synced_at` — "Synced just
    /// now", "Synced 12 min ago", "Synced 3 hr ago", or "Synced Jun 4" once
    /// it's a day+ old (design `ConnectedRow`: "Synced 2 min ago"). An absent
    /// or unparseable timestamp renders a bare "Synced" rather than raw ISO.
    /// Mirrors Android's `syncedAgo`.
    private func syncedLine(_ calendar: ConnectedCalendarDTO) -> String {
        guard let raw = calendar.lastSyncedAt,
              let synced = SchedulingTime.parseUTC(raw)
        else { return "Synced" }
        let minutes = Int(Date().timeIntervalSince(synced) / 60)
        switch minutes {
        case ..<1: return "Synced just now"
        case ..<60: return "Synced \(minutes) min ago"
        case ..<(24 * 60): return "Synced \(minutes / 60) hr ago"
        default:
            let formatter = DateFormatter()
            formatter.locale = .current
            formatter.dateFormat = "MMM d"
            return "Synced \(formatter.string(from: synced))"
        }
    }

    // MARK: Re-auth needed row (warning banner + Reconnect)

    private func reauthCard(_ calendar: ConnectedCalendarDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            accountHeader(calendar, calendarStatus: .attention)
            VStack(alignment: .leading, spacing: Spacing.s3) {
                HStack(alignment: .top, spacing: Spacing.s2) {
                    Icon(.triangleAlert, size: 16, strokeWidth: 2, color: Theme.Color.warning)
                        .padding(.top, 1)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Reconnect \(viewModel.provider(for: calendar)?.shortName ?? "this calendar") to keep checking for conflicts")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Theme.Color.warning)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Until you reconnect, we can't see new events and might double-book you.")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.warning)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Button {
                    if let provider = viewModel.provider(for: calendar) {
                        Task { await viewModel.connect(provider) }
                    }
                } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.refreshCw, size: 14, color: Theme.Color.appTextInverse)
                        Text("Reconnect")
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 38)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("scheduling.connectedCalendars.reconnect.\(calendar.id)")
            }
            .padding(Spacing.s3)
            .background(Theme.Color.warningBg)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.warningLight, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    // MARK: Permission-denied row (lock banner + Open Settings)

    private func deniedCard(_ calendar: ConnectedCalendarDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s3) {
                if let provider = viewModel.provider(for: calendar) {
                    providerTile(provider)
                } else {
                    Icon(.calendar, size: 19, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                        .frame(width: 38, height: 38)
                        .background(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(viewModel.provider(for: calendar)?.name ?? calendar.provider ?? "Calendar")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text("Not connected")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
            }
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.lock, size: 14, strokeWidth: 2, color: Theme.Color.appTextMuted)
                    .padding(.top, 1)
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text("Calendar access was declined. Allow it in Settings to connect.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                    Button {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            openURL(url)
                        }
                    } label: {
                        HStack(spacing: Spacing.s1) {
                            Icon(.settings, size: 13, color: Theme.Color.primary600)
                            Text("Open Settings")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Theme.Color.primary600)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("scheduling.connectedCalendars.openSettings.\(calendar.id)")
                }
                Spacer(minLength: Spacing.s0)
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurfaceRaised)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    // MARK: Helper

    private var helper: some View {
        Text("Connect a calendar to check for conflicts and add bookings automatically.")
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s5)
    }

    private var loadingSkeleton: some View {
        ScrollView {
            VStack(spacing: Spacing.s5) {
                Shimmer(height: 180, cornerRadius: Radii.xl).padding(.horizontal, Spacing.s4)
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(height: 62, cornerRadius: Radii.xl).padding(.horizontal, Spacing.s4)
                }
            }
            .padding(.vertical, Spacing.s4)
        }
    }

    private var noticePresented: Binding<Bool> {
        Binding(get: { viewModel.notice != nil }, set: { if !$0 { viewModel.notice = nil } })
    }
}
