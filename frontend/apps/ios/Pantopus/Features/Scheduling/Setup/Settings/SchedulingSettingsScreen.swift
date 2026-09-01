//
//  SchedulingSettingsScreen.swift
//  Pantopus
//
//  A3 "Booking settings" grouped settings index. 52pt top bar; pillar-accent
//  overlines; grouped cards for Automation · Scheduling defaults · Payments
//  (gated on `SchedulingFeatureFlags.paidEnabled`) · Team (Business) · Danger
//  zone, plus the mono footer. Danger actions confirm before hitting the
//  backend. Matches `scheduling-settings-frames.jsx` + `settings-archetype.jsx`.
//

import SwiftUI

// swiftlint:disable file_length

struct SchedulingSettingsScreen: View {
    @State private var model: SchedulingSettingsModel
    @State private var confirmReset = false
    @State private var confirmDisable = false
    @Environment(\.dismiss) private var dismiss

    init(owner: SchedulingOwner, push: @escaping @MainActor (SchedulingRoute) -> Void) {
        _model = State(wrappedValue: SchedulingSettingsModel(owner: owner, push: push))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            SettingsTopBar52(title: "Booking settings") { dismiss() }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .overlay(alignment: .top) { savedToast }
        .task { await model.load() }
        .confirmationDialog("Reset booking link?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Reset link", role: .destructive) { Task { await model.resetSlug() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your current link will stop working and a new one will be generated.")
        }
        .confirmationDialog("Disable scheduling?", isPresented: $confirmDisable, titleVisibility: .visible) {
            Button("Disable scheduling", role: .destructive) { Task { await model.disableScheduling() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your booking page goes offline. Existing bookings stay on your calendar.")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            SettingsSkeleton()
        case .loaded:
            loadedBody
        case let .error(message):
            SettingsErrorView(message: message) { Task { await model.load() } }
        }
    }

    private var loadedBody: some View {
        ScrollView {
            VStack(spacing: Spacing.s0) {
                if model.isBusiness { teamGroup }
                automationGroup
                defaultsGroup
                if model.paidEnabled { paymentsGroup }
                dangerZone
                Color.clear.frame(height: Spacing.s8)
            }
        }
        .background(Theme.Color.appBg)
    }

    private var accent: Color {
        model.theme.accent
    }

    // MARK: Automation

    private var automationGroup: some View {
        SettingsGroup(title: "Automation", accent: accent, helper: "Reminders go out automatically before each booking.") {
            SettingsRow(
                label: "Default reminders",
                sub: model.isFresh ? nil : (model.remindersValue ?? "1 day · 1 hr"),
                trailing: model.isFresh ? .chipChevron(SettingsChip(text: "Off", tone: .warning)) : .chevron
            ) { model.openReminders() }
            SettingsDivider()
            SettingsRow(
                label: "Workflows & follow-ups",
                sub: model.isFresh ? "No workflows yet" : nil,
                trailing: model.isFresh
                    ? .chipChevron(SettingsChip(text: "Set up", icon: .plus, tone: .warning))
                    : .chipChevron(SettingsChip(text: "3 active", tone: .success))
            ) { model.openWorkflows() }
            SettingsDivider()
            SettingsRow(
                label: "Message templates",
                sub: model.isFresh ? "No templates yet" : "5 templates",
                trailing: model.isFresh ? .chipChevron(SettingsChip(text: "Set up", icon: .plus, tone: .warning)) : .chevron
            ) { model.openTemplates() }
            SettingsDivider()
            SettingsRow(
                label: "Booking notifications",
                sub: model.isFresh ? "Using defaults" : "Push · Email",
                trailing: .chevron
            ) { model.openNotifications() }
        }
    }

    // MARK: Scheduling defaults

    private var defaultsGroup: some View {
        SettingsGroup(title: "Scheduling defaults", accent: accent) {
            SettingsRow(
                label: "Default timezone",
                sub: model.savingRow == .defaultTimezone ? nil : model.timezoneValue,
                trailing: timezoneTrailing
            ) { model.openAvailability() }
            SettingsDivider()
            SettingsRow(
                label: "Default availability",
                sub: "Mon–Fri, 9–5",
                trailing: .chevron
            ) { model.openAvailability() }
            SettingsDivider()
            SettingsRow(
                label: "Cancellation policy",
                sub: model.savingRow == .cancellationPolicy ? nil : (model.isFresh ? nil : "24-hour notice"),
                trailing: cancellationTrailing
            ) { model.openCancellationPolicy() }
        }
    }

    private var timezoneTrailing: SettingsRowTrailing {
        if model.savingRow == .defaultTimezone { return .savingShimmer(width: 70) }
        return .tzLock(locked: !model.isFresh, accent: accent)
    }

    private var cancellationTrailing: SettingsRowTrailing {
        if model.savingRow == .cancellationPolicy { return .savingShimmer(width: 84) }
        if model.justSavedRow == .cancellationPolicy { return .savedChip }
        if model.isFresh { return .chipChevron(SettingsChip(text: "Set up", icon: .plus, tone: .warning)) }
        return .chevron
    }

    // MARK: Payments (gated)

    private var paymentsGroup: some View {
        SettingsGroup(title: "Payments", accent: accent, helper: "Required only for paid event types.") {
            SettingsRow(
                label: "Payments & payouts",
                sub: model.paymentsConnected ? "Stripe · connected" : "Take payment at booking",
                trailing: model.paymentsConnected
                    ? .chipChevron(SettingsChip(text: "Connected", icon: .check, tone: .success))
                    : .connectPill(accent: accent)
            ) { model.openPayments() }
        }
    }

    // MARK: Team (Business)

    private var teamGroup: some View {
        SettingsGroup(title: "Team", accent: accent) {
            SettingsRow(
                label: "Team & seats",
                // Member/seat count sub-copy per scheduling-settings-frames.jsx TeamGroup
                // (mirrored on Android SchedulingSettingsRootScreen).
                sub: "4 members · 2 booking seats",
                trailing: .chevron
            ) { model.openTeam() }
            SettingsDivider()
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text("New bookings")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Text("Choose how incoming bookings are handled.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.top, 2)
                SettingsSegmented(options: ["Auto-confirm", "Approve first"], selected: 1, accent: accent)
                    .padding(.top, 10)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 14)
        }
    }

    // MARK: Danger zone

    private var dangerZone: some View {
        VStack(spacing: Spacing.s0) {
            HStack {
                Text("DANGER ZONE").font(.system(size: 11, weight: .bold)).tracking(0.88).foregroundStyle(Theme.Color.error)
                Spacer()
            }
            .padding(.horizontal, Spacing.s4).padding(.top, 18).padding(.bottom, Spacing.s2)

            VStack(spacing: Spacing.s0) {
                dangerRow(icon: .rotateCcw, label: "Reset booking link", busy: model.isResetting) { confirmReset = true }
                Rectangle().fill(Theme.Color.errorLight).frame(height: 1)
                dangerRow(icon: .calendarX, label: "Disable scheduling", busy: model.isDisabling) { confirmDisable = true }
            }
            .background(Theme.Color.errorBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.errorLight, lineWidth: 1))
            .padding(.horizontal, Spacing.s3)

            Text(model.monoFooter)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextMuted)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.s4)
                .padding(.top, 18)
        }
    }

    private func dangerRow(icon: PantopusIcon, label: String, busy: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 17, color: Theme.Color.error)
                Text(label)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.error)
                Spacer(minLength: Spacing.s2)
                if busy { ProgressView().tint(Theme.Color.error) }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .accessibilityIdentifier("settingsDanger_\(label)")
    }

    private var savedToast: some View {
        Group {
            if let dangerError = model.dangerError {
                HStack(spacing: Spacing.s2) {
                    Icon(.alertCircle, size: 15, color: Theme.Color.error)
                    Text(dangerError)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .lineLimit(2)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .background(Theme.Color.appText)
                .clipShape(Capsule())
                .pantopusShadow(.lg)
                .padding(.top, Spacing.s3)
                .transition(.move(edge: .top).combined(with: .opacity))
            } else if model.showSavedToast {
                HStack(spacing: Spacing.s2) {
                    Icon(.check, size: 15, strokeWidth: 3, color: Theme.Color.success)
                    Text("Changes saved")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .background(Theme.Color.appText)
                .clipShape(Capsule())
                .pantopusShadow(.lg)
                .padding(.top, Spacing.s3)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: model.showSavedToast)
        .animation(.easeInOut(duration: 0.2), value: model.dangerError)
    }
}

// MARK: - 52pt top bar

struct SettingsTopBar52: View {
    let title: String
    let onBack: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .accessibilityIdentifier("settingsTopBarBack")
            .accessibilityLabel("Back")
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .tracking(-0.1)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .lineLimit(1)
                .accessibilityAddTraits(.isHeader)
            Color.clear.frame(width: 36, height: 36)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 52)
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
    }
}

// MARK: - Grouped list primitives

struct SettingsGroup<Content: View>: View {
    let title: String
    let accent: Color
    var helper: String?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.88)
                .foregroundStyle(accent)
                .padding(.horizontal, Spacing.s4)
                .padding(.top, 18)
                .padding(.bottom, Spacing.s2)
            VStack(spacing: Spacing.s0) { content }
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
                .padding(.horizontal, Spacing.s3)
            if let helper {
                Text(helper)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s2)
            }
        }
    }
}

struct SettingsDivider: View {
    var body: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, Spacing.s4)
    }
}

enum SettingsRowTrailing {
    case chevron
    case chipChevron(SettingsChip)
    case connectPill(accent: Color)
    case tzLock(locked: Bool, accent: Color)
    /// In-flight write: a Shimmer placeholder in the trailing slot (JSX 'saving').
    case savingShimmer(width: CGFloat)
    /// Write succeeded: a green "Saved" chip + chevron (JSX 'saved').
    case savedChip
}

struct SettingsRow: View {
    let label: String
    var sub: String?
    let trailing: SettingsRowTrailing
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.Color.appText)
                    if let sub {
                        Text(sub)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s2)
                trailingView
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 14)
            .frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("settingsRow_\(label)")
    }

    @ViewBuilder
    private var trailingView: some View {
        switch trailing {
        case .chevron:
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
        case let .chipChevron(chip):
            HStack(spacing: Spacing.s2) {
                chip
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
            }
        case let .connectPill(accent):
            Text("Connect")
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(accent)
                .clipShape(Capsule())
                .pantopusShadow(PantopusShadow(color: accent, opacity: 0.27, radius: 3, x: 0, y: 2))
        case let .savingShimmer(width):
            Shimmer(width: width, height: 14, cornerRadius: 7)
        case .savedChip:
            HStack(spacing: Spacing.s2) {
                SettingsSavedChip()
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
            }
        case let .tzLock(locked, accent):
            HStack(spacing: 6) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(locked ? Theme.Color.personalBg : Theme.Color.appSurfaceSunken)
                    Icon(locked ? .lock : .keyRound, size: 14, strokeWidth: 2.2, color: locked ? accent : Theme.Color.appTextMuted)
                }
                .frame(width: 30, height: 30)
                .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(
                    locked ? accent.opacity(0.2) : Theme.Color.appBorder,
                    lineWidth: 1
                ))
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
            }
        }
    }
}

struct SettingsChip: View {
    let text: String
    var icon: PantopusIcon?
    let tone: SetupChipTone

    var body: some View {
        HStack(spacing: Spacing.s1) {
            if let icon { Icon(icon, size: 10, strokeWidth: 3, color: tone.fg) }
            Text(text.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(tone.fg)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(tone.bg)
        .clipShape(Capsule())
    }
}

/// Green "Saved" confirmation chip shown in a row's trailing slot right after a
/// successful write (JSX SavedChip).
struct SettingsSavedChip: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.check, size: 12, strokeWidth: 3, color: Theme.Color.success)
            Text("Saved")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.successLight)
        .clipShape(Capsule())
    }
}

struct SettingsSegmented: View {
    let options: [String]
    let selected: Int
    let accent: Color

    var body: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(Array(options.enumerated()), id: \.offset) { idx, opt in
                let on = idx == selected
                Text(opt)
                    .font(.system(size: 12.5, weight: on ? .bold : .semibold))
                    .foregroundStyle(on ? accent : Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 32)
                    .background(on ? Theme.Color.appSurface : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .pantopusShadow(on ? .sm : .init(color: .clear, opacity: 0, radius: 0, x: 0, y: 0))
            }
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

// MARK: - Skeleton + error

private struct SettingsSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(width: 110, height: 11, cornerRadius: Radii.xs)
                        .padding(.horizontal, Spacing.s4).padding(.top, 18).padding(.bottom, Spacing.s2)
                    Shimmer(height: 140, cornerRadius: Radii.lg).padding(.horizontal, Spacing.s3)
                }
            }
        }
        .background(Theme.Color.appBg)
    }
}

private struct SettingsErrorView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 64, height: 64)
                Icon(.cloudOff, size: 28, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            }
            Text("Couldn't load settings")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button(action: onRetry) {
                HStack(spacing: 6) {
                    Icon(.refreshCw, size: 14, color: Theme.Color.appTextStrong)
                    Text("Try again")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
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
