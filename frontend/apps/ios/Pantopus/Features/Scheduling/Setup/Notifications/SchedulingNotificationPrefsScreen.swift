//
//  SchedulingNotificationPrefsScreen.swift
//  Pantopus
//
//  A4 Notification Preferences — the channel-triad matrix mirrored 1:1. Two
//  sub-cards ("Notify me" / "Notify attendees"), each row a P/E/S chip triad.
//  Backend stores a single boolean per event, so P + E move together for
//  "Notify me" rows; attendee rows are email-only (P/S disabled, confirmation
//  locked); S is always "coming soon". Reminder lead-time chips persist on the
//  booking page. States: loaded / paused / push-off. Matches
//  `scheduling-notif-frames.jsx`.
//

import SwiftUI
import UIKit

// swiftlint:disable file_length

struct SchedulingNotificationPrefsScreen: View {
    @State private var model: SchedulingNotificationPrefsModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase

    init(owner: SchedulingOwner, push: @escaping @MainActor (SchedulingRoute) -> Void) {
        _model = State(wrappedValue: SchedulingNotificationPrefsModel(owner: owner, push: push))
    }

    private var accent: Color {
        model.theme.accent
    }

    private var accentBg: Color {
        model.theme.accentBg
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            SetupTopBar(title: "Notifications", leading: .back) { dismiss() }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .task { await model.load() }
        // Push permission is an OS setting the user can flip in Settings while this screen
        // is backgrounded, so re-read it on the way back rather than trusting load()'s value.
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active else { return }
            Task { await model.refreshPushAuthorization() }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            NotifSkeleton()
        case .loaded:
            loadedBody
        case let .error(message):
            NotifErrorView(message: message) { Task { await model.load() } }
        }
    }

    private var loadedBody: some View {
        ScrollView {
            VStack(spacing: Spacing.s0) {
                if model.paused { pauseBanner }
                if model.pushOff { pushOffNotice }

                sectionOverline("Scheduling & bookings")

                NotifCategoryCard(
                    label: "Notify me",
                    accent: accent,
                    accentBg: accentBg,
                    opacity: model.paused ? 0.55 : 1,
                    disabled: model.paused,
                    helper: "Only you see these. Pick the channel for each event.",
                    smsHint: model.showSmsHint,
                    onSmsTap: { model.showSmsHint.toggle() },
                    content: {
                        ForEach(Array(model.notifyMe.enumerated()), id: \.element.id) { idx, row in
                            NotifMatrixRow(
                                row: row,
                                kind: .notifyMe,
                                accent: accent,
                                disabled: model.paused,
                                pushOff: model.pushOff
                            ) { model.toggleNotifyMe(row.key) }
                            if idx < model.notifyMe.count - 1 { notifDivider }
                        }
                        reminderLeadTime
                    }
                )

                Color.clear.frame(height: 14)

                NotifCategoryCard(
                    label: "Notify attendees",
                    accent: accent,
                    accentBg: accentBg,
                    opacity: model.paused ? 0.55 : 1,
                    disabled: model.paused,
                    helper: "Attendees always get a confirmation — you choose the rest."
                ) {
                    ForEach(Array(model.notifyAttendees.enumerated()), id: \.element.id) { idx, row in
                        NotifMatrixRow(
                            row: row,
                            kind: .notifyAttendees,
                            accent: accent,
                            disabled: model.paused,
                            pushOff: model.pushOff
                        ) { model.toggleNotifyAttendees(row.key) }
                        if idx < model.notifyAttendees.count - 1 { notifDivider }
                    }
                }

                legend
                Color.clear.frame(height: Spacing.s6)
            }
        }
        .background(Theme.Color.appBg)
    }

    private func sectionOverline(_ text: String) -> some View {
        HStack {
            Text(text.uppercased()).font(.system(size: 11, weight: .bold)).tracking(0.88).foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
        }
        .padding(.horizontal, Spacing.s4).padding(.top, 18).padding(.bottom, Spacing.s2)
    }

    private var notifDivider: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, Spacing.s4)
    }

    // MARK: Reminder lead-time

    private var reminderLeadTime: some View {
        VStack(alignment: .leading, spacing: 9) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            Text("Send reminders")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
                .padding(.top, Spacing.s1)
            HStack(spacing: Spacing.s2) {
                ForEach(SchedulingNotificationPrefsModel.leadTimePresets, id: \.0) { preset in
                    leadChip(minutes: preset.0, label: preset.1)
                }
                addChip
                Spacer(minLength: Spacing.s0)
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s3)
    }

    private func leadChip(minutes: Int, label: String) -> some View {
        let active = model.isReminderActive(minutes)
        let disabled = model.paused
        return Button { if !disabled { model.toggleReminder(minutes) } } label: {
            HStack(spacing: 5) {
                if active && !disabled { Icon(.check, size: 12, strokeWidth: 3, color: Theme.Color.appTextInverse) }
                Text(label).font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(disabled ? Theme.Color
                        .appTextMuted : (active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong))
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 7)
            .background(disabled ? Theme.Color.appSurfaceSunken : (active ? accent : Theme.Color.appSurface))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(active ? accent : Theme.Color.appBorderStrong, lineWidth: 1))
        }
        .disabled(disabled)
        .accessibilityIdentifier("reminderChip_\(minutes)")
    }

    private var addChip: some View {
        Button {} label: {
            HStack(spacing: 5) {
                Icon(.plus, size: 12, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                Text("Add").font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 7)
            .background(Theme.Color.appSurface)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 3])).foregroundStyle(Theme.Color.appBorderStrong))
        }
        .disabled(true)
        .accessibilityIdentifier("reminderChipAdd")
    }

    // MARK: Banners

    private var pauseBanner: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.warningLight)
                Icon(.bellOff, size: 16, color: Theme.Color.warning)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 1) {
                // Design copy is "Paused for 2 hours" / "Resumes 11:42 AM · …" —
                // the model degrades to the untimed pair while the wire only
                // carries `is_paused` (see `pausedUntil` DTO-gap note).
                Text(model.pauseBannerTitle).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.Color.warning)
                Text(model.pauseBannerSubtitle).font(.system(size: 11.5)).foregroundStyle(Theme.Color.warning)
            }
            Spacer(minLength: Spacing.s2)
            Button { model.resume() } label: {
                Text("Resume")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.warning)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 5)
                    .background(Theme.Color.appSurface)
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Theme.Color.warningLight, lineWidth: 1))
            }
            .accessibilityIdentifier("pauseBannerResume")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.warningLight, lineWidth: 1))
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s3)
    }

    private var pushOffNotice: some View {
        HStack(spacing: 10) {
            Icon(.bellOff, size: 15, color: Theme.Color.error)
            Text("Push is off for Pantopus. Turn it on in Settings to get booking alerts.")
                .pantopusTextStyle(.caption).foregroundStyle(Theme.Color.appTextStrong).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s2)
            Button {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            } label: {
                Text("Settings")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.error)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 5)
                    .background(Theme.Color.appSurface)
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Theme.Color.errorLight, lineWidth: 1))
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.Color.errorLight, lineWidth: 1))
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s3)
    }

    private var legend: some View {
        HStack(spacing: 14) {
            Text("P · Push").font(.system(size: 11, design: .monospaced)).foregroundStyle(Theme.Color.appTextMuted)
            Text("E · Email").font(.system(size: 11, design: .monospaced)).foregroundStyle(Theme.Color.appTextMuted)
            HStack(spacing: 3) {
                Text("S · SMS").font(.system(size: 11, design: .monospaced)).foregroundStyle(Theme.Color.appTextMuted)
                Icon(.lock, size: 9, strokeWidth: 2.6, color: Theme.Color.appTextMuted)
                Text("soon").font(.system(size: 11, design: .monospaced)).foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, 18)
    }
}

// MARK: - Channel chip

enum NotifRowKind { case notifyMe, notifyAttendees }

/// state: on / off / disabled / locked.
enum NotifChipState { case on, off, disabled, locked }

struct NotifChannelChip: View {
    let letter: String
    let state: NotifChipState
    let accent: Color

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Text(letter)
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(fg)
                .frame(width: 22, height: 22)
                .background(bg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous).stroke(border, lineWidth: 1))
            if state == .locked {
                Icon(.lock, size: 6.5, strokeWidth: 3, color: accent)
                    .frame(width: 11, height: 11)
                    .background(Theme.Color.appSurface)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(accent, lineWidth: 1))
                    .offset(x: 3, y: 3)
            }
        }
    }

    private var bg: Color {
        switch state {
        case .disabled: Theme.Color.appSurfaceSunken
        case .on, .locked: accent
        case .off: Theme.Color.appSurface
        }
    }

    private var fg: Color {
        switch state {
        case .disabled: Theme.Color.appBorderStrong
        case .on, .locked: Theme.Color.appTextInverse
        case .off: Theme.Color.appTextMuted
        }
    }

    private var border: Color {
        switch state {
        case .disabled: Theme.Color.appBorder
        case .on, .locked: accent
        case .off: Theme.Color.appBorderStrong
        }
    }
}

// MARK: - Matrix row

struct NotifMatrixRow: View {
    let row: SchedulingNotificationPrefsModel.Row
    let kind: NotifRowKind
    let accent: Color
    let disabled: Bool
    let pushOff: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.label).font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.Color.appText)
                    if let sub = row.sub {
                        Text(sub).pantopusTextStyle(.caption).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s2)
                HStack(spacing: Spacing.s1) {
                    NotifChannelChip(letter: "P", state: pState, accent: accent)
                    NotifChannelChip(letter: "E", state: eState, accent: accent)
                    NotifChannelChip(letter: "S", state: .disabled, accent: accent)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(disabled || row.locked)
        .accessibilityIdentifier("notifRow_\(kind == .notifyMe ? "me" : "att")_\(row.key)")
    }

    /// "Notify me": P + E track the single boolean. Attendees: E only; P disabled.
    private var pState: NotifChipState {
        if disabled { return .disabled }
        switch kind {
        case .notifyMe:
            if pushOff { return .disabled }
            return row.locked ? .locked : (row.enabled ? .on : .off)
        case .notifyAttendees:
            return .disabled
        }
    }

    private var eState: NotifChipState {
        if disabled { return .disabled }
        if row.locked { return .locked }
        return row.enabled ? .on : .off
    }
}

// MARK: - Category card

struct NotifCategoryCard<Content: View>: View {
    let label: String
    let accent: Color
    let accentBg: Color
    var opacity: Double = 1
    var disabled: Bool = false
    var helper: String?
    /// When true, a small "SMS coming soon" tooltip floats above the S column.
    var smsHint: Bool = false
    var onSmsTap: (() -> Void)?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            VStack(spacing: Spacing.s0) {
                header
                content
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            .opacity(opacity)
            .overlay(alignment: .topTrailing) {
                if smsHint {
                    smsTooltip
                        .padding(.trailing, 10)
                        .offset(y: -18)
                }
            }
            if let helper {
                Text(helper)
                    .font(.system(size: 11.5))
                    .foregroundStyle(disabled ? Theme.Color.appTextMuted : Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s1)
                    .padding(.top, Spacing.s2)
            }
        }
        .padding(.horizontal, Spacing.s3)
    }

    private var header: some View {
        HStack(spacing: Spacing.s0) {
            Text(label.uppercased()).font(.system(size: 10.5, weight: .bold)).tracking(0.3).foregroundStyle(accent)
            Spacer(minLength: Spacing.s2)
            HStack(spacing: Spacing.s1) {
                ForEach(["P", "E"], id: \.self) { l in
                    Text(l)
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .tracking(0.3)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .frame(width: 22)
                }
                HStack(spacing: 1) {
                    Text("S").font(.system(size: 10, weight: .bold, design: .monospaced)).foregroundStyle(Theme.Color.appBorderStrong)
                    Icon(.lock, size: 8, strokeWidth: 2.6, color: Theme.Color.appBorderStrong)
                }
                .frame(width: 22)
                .contentShape(Rectangle())
                .onTapGesture { onSmsTap?() }
                .accessibilityIdentifier("notifSmsHeader")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, 9)
        .padding(.bottom, Spacing.s2)
        .background(accentBg)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1) }
    }

    private var smsTooltip: some View {
        Text("SMS coming soon")
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(Theme.Color.appText)
            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            .overlay(alignment: .bottomTrailing) {
                Rectangle()
                    .fill(Theme.Color.appText)
                    .frame(width: 8, height: 8)
                    .rotationEffect(.degrees(45))
                    .offset(x: -14, y: 4)
            }
            .pantopusShadow(.lg)
            .accessibilityIdentifier("notifSmsTooltip")
            .accessibilityHidden(true)
    }
}

// MARK: - Skeleton + error

private struct NotifSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Shimmer(width: 150, height: 11, cornerRadius: Radii.xs).padding(.horizontal, Spacing.s4).padding(.top, 18).padding(
                    .bottom,
                    Spacing.s2
                )
                ForEach(0..<2, id: \.self) { _ in
                    Shimmer(height: 220, cornerRadius: Radii.lg).padding(.horizontal, Spacing.s3).padding(.bottom, 14)
                }
            }
        }
        .background(Theme.Color.appBg)
    }
}

private struct NotifErrorView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 64, height: 64)
                Icon(.cloudOff, size: 28, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            }
            Text("Couldn't load notifications").font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button(action: onRetry) {
                HStack(spacing: 6) {
                    Icon(.refreshCw, size: 14, color: Theme.Color.appTextStrong)
                    Text("Try again").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
        .background(Theme.Color.appBg)
    }
}
