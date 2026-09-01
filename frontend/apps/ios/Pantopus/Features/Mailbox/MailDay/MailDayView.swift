//
//  MailDayView.swift
//  Pantopus
//
//  A13.16 — My Mail Day. The mid-afternoon triage editor on top of the
//  Form archetype shell. Top bar carries a back chevron + "My Mail Day"
//  title. The populated body stacks `DayHeader`, `ScanMoreCard`, the
//  Needs-a-call section, the Reviewed-today card, and an "Undo all from
//  today" text button. A sticky `FinishDay` bar pinned below the scroll
//  is disabled until the unreviewed list empties out.
//
//  The empty state renders `MailboxEmptyHero` (illustration + headline +
//  Scan CTA) with the yesterday recap card and two setup-nudge cards
//  beneath. No sticky bottom in the empty frame — the Scan CTA is the
//  primary affordance.
//
//  The view drives `MailDayViewModel.tickUndo()` from a `TimelineView`
//  loop so the 5-second undo chip on the latest reviewed row counts
//  down once a second.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

public struct MailDayView: View {
    @State private var viewModel: MailDayViewModel
    private let onClose: @MainActor () -> Void
    private let onSeeHistory: @MainActor () -> Void
    private let onOpenNudge: @MainActor (MailDaySetupNudge) -> Void

    public init(
        viewModel: MailDayViewModel,
        onClose: @escaping @MainActor () -> Void = {},
        onSeeHistory: @escaping @MainActor () -> Void = {},
        onOpenNudge: @escaping @MainActor (MailDaySetupNudge) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
        self.onSeeHistory = onSeeHistory
        self.onOpenNudge = onOpenNudge
    }

    public var body: some View {
        Group {
            if viewModel.isShowingSettings {
                settingsShell
            } else {
                body(for: viewModel.state)
            }
        }
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottom) { settingsToastOverlay }
        .task { await viewModel.load() }
        .task {
            // 5-second undo chip on the latest reviewed row counts down
            // once a second until it clears. `tickUndo` is a no-op when
            // there's no active countdown.
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                viewModel.tickUndo()
            }
        }
        .accessibilityIdentifier("mailDay")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
    }

    @ViewBuilder
    private func body(for state: MailDayState) -> some View {
        switch state {
        case .loading:
            shell(
                isPopulated: false,
                body: { loadingBody },
                stickyBottom: nil
            )
        case let .populated(content):
            shell(
                isPopulated: true,
                body: { populatedBody(content: content) },
                stickyBottom: {
                    AnyView(
                        FinishDayBar(
                            isEnabled: viewModel.canFinishDay,
                            total: viewModel.total,
                            routed: viewModel.routedCount,
                            junked: viewModel.junkedCount,
                            returned: viewModel.returnedCount,
                            remaining: viewModel.remaining
                        ) { Task { await viewModel.finishDay() } }
                    )
                }
            )
        case let .empty(content):
            shell(
                isPopulated: false,
                body: { emptyBody(content: content) },
                stickyBottom: nil
            )
        case let .error(message):
            shell(
                isPopulated: false,
                body: { errorBody(message: message) },
                stickyBottom: nil
            )
        }
    }

    // MARK: - Shell

    private func shell(
        isPopulated: Bool,
        @ViewBuilder body: () -> some View,
        stickyBottom: (() -> AnyView)?
    ) -> some View {
        // The populated frame reaches settings through the day-header gear;
        // the other frames have no header card, so the shell's top-right
        // action carries it (FormShell hides that action whenever a sticky
        // bottom bar is supplied, which only the populated frame has).
        FormShell(
            title: "My Mail Day",
            leading: .back,
            rightActionLabel: isPopulated ? nil : "Settings",
            isValid: true,
            isDirty: false,
            onClose: onClose,
            onCommit: { Task { await viewModel.openSettings() } },
            content: { body() },
            stickyBottom: stickyBottom
        )
    }

    // MARK: - Populated body

    private func populatedBody(content: MailDayContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            DayHeader(
                dateLabel: content.dateLabel,
                streakDays: content.streakDays,
                done: viewModel.done,
                total: viewModel.total
            ) { Task { await viewModel.openSettings() } }
            ScanMoreCard(lastScanLabel: content.lastScanLabel) {
                viewModel.requestScan()
            }
            if !content.unreviewed.isEmpty {
                needsACallSection(items: content.unreviewed)
            }
            if !content.reviewed.isEmpty {
                reviewedSection(items: content.reviewed)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, 120)
    }

    private func needsACallSection(items: [UnreviewedMailDayItem]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionOverline(title: "Needs a call", count: items.count)
            VStack(spacing: Spacing.s3) {
                ForEach(items) { item in
                    UnreviewedItem(
                        item: item,
                        onRoute: { Task { await viewModel.acceptSuggestion(for: item.id) } },
                        onSecondary: { /* Other-recipient sheet — out of scope */ }
                    )
                }
            }
        }
    }

    private func reviewedSection(items: [ReviewedMailDayItem]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionOverline(title: "Reviewed today", count: items.count)
            VStack(spacing: Spacing.s0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    ReviewedRow(
                        item: item,
                        isLast: index == items.count - 1
                    ) {
                        // Undo individual — out of scope
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 3, x: 0, y: 1)
            undoAllButton
        }
    }

    private var undoAllButton: some View {
        Button(
            action: { /* Undo all — out of scope */ },
            label: {
                HStack(spacing: Spacing.s1) {
                    Icon(.arrowsRepeat, size: 12, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                    Text("Undo all from today")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
            }
        )
        .buttonStyle(.plain)
        .accessibilityLabel("Undo all from today")
        .accessibilityIdentifier("mailDayUndoAll")
    }

    private func sectionOverline(title: String, count: Int) -> some View {
        HStack(spacing: Spacing.s1) {
            Text(title)
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.6)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text("· \(count)")
                .font(.system(size: 10.5, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    // MARK: - Empty body

    private func emptyBody(content: MailDayContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            MailboxEmptyHero(
                streakDays: content.streakDays,
                lastScanLabel: content.lastScanLabel
            ) {
                viewModel.requestScan()
            }
            if let recap = content.yesterdayRecap {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    sectionOverline(title: "Yesterday's recap", count: recap.segments.count)
                    YesterdayRecapCard(recap: recap, onSeeHistory: onSeeHistory)
                }
            }
            if !content.setupNudges.isEmpty {
                SetupNudgeStack(nudges: content.setupNudges, onTap: onOpenNudge)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s5)
    }

    // MARK: - Settings sub-view (gear from the day header)

    /// The settings frame reuses the Form shell with its own title and a
    /// back control that returns to the triage body — RN swaps the view
    /// the same way (`src/app/mailbox/mailday.tsx:77-189`).
    private var settingsShell: some View {
        FormShell(
            title: "Mail Day Settings",
            leading: .back,
            rightActionLabel: nil,
            isValid: true,
            isDirty: false,
            isSaving: viewModel.settingsSaving,
            onClose: { viewModel.closeSettings() },
            onCommit: {},
            content: { settingsBody }
        )
        .accessibilityIdentifier("mailDaySettings")
    }

    @ViewBuilder
    private var settingsBody: some View {
        switch viewModel.settings {
        case .loading:
            VStack(spacing: Spacing.s3) {
                Shimmer(width: nil, height: 120, cornerRadius: Radii.lg)
                Shimmer(width: nil, height: 210, cornerRadius: Radii.lg)
                Shimmer(width: nil, height: 150, cornerRadius: Radii.lg)
                Shimmer(width: nil, height: 120, cornerRadius: Radii.lg)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s4)
            .accessibilityIdentifier("mailDaySettingsLoading")
        case let .loaded(form):
            VStack(alignment: .leading, spacing: Spacing.s3) {
                deliveryTimeCard(form)
                switchCard(
                    title: "Include in Mail Day",
                    keys: MailDaySettingKey.includeGroup,
                    form: form
                )
                switchCard(
                    title: "Always interrupt (instant)",
                    keys: MailDaySettingKey.interruptGroup,
                    form: form
                )
                soundCard(form)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s10)
            .accessibilityIdentifier("mailDaySettingsLoaded")
        case let .error(message):
            ErrorState(headline: "Couldn't load your settings", message: message) {
                await viewModel.loadSettings()
            }
            .frame(maxWidth: .infinity, minHeight: 320)
            .accessibilityIdentifier("mailDaySettingsError")
        }
    }

    private func deliveryTimeCard(_ form: MailDaySettingsForm) -> some View {
        MailDaySettingsCard(title: "Delivery time") {
            HStack(spacing: Spacing.s2) {
                HStack(spacing: Spacing.s2) {
                    Icon(.clock, size: 16, strokeWidth: 2.2, color: Theme.Color.primary600)
                    Text(form.deliveryTime)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                }
                .padding(.horizontal, 13)
                .padding(.vertical, 10)
                .background(Theme.Color.appSurfaceSunken)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1.5)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                Spacer(minLength: Spacing.s0)
                Text(form.timezone)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.bottom, Spacing.s2)
            settingsSwitchRow(.enabled, form: form, showsDivider: false)
        }
    }

    private func switchCard(
        title: String,
        keys: [MailDaySettingKey],
        form: MailDaySettingsForm
    ) -> some View {
        MailDaySettingsCard(title: title) {
            ForEach(Array(keys.enumerated()), id: \.element.id) { index, key in
                settingsSwitchRow(key, form: form, showsDivider: index < keys.count - 1)
            }
        }
    }

    private func soundCard(_ form: MailDaySettingsForm) -> some View {
        MailDaySettingsCard(title: "Sound") {
            HStack(spacing: Spacing.s2) {
                ForEach(MailDaySoundType.allCases) { sound in
                    let active = form.soundType == sound
                    Button {
                        Task { await viewModel.setSoundType(sound) }
                    } label: {
                        Text(sound.label)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(
                                active ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary
                            )
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(active ? Theme.Color.appText : Theme.Color.appSurfaceSunken)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(active ? [.isSelected] : [])
                    .accessibilityIdentifier("mailDaySettingsSound_\(sound.rawValue)")
                }
            }
            .padding(.bottom, Spacing.s2)
            settingsSwitchRow(.hapticsEnabled, form: form, showsDivider: false)
        }
    }

    private func settingsSwitchRow(
        _ key: MailDaySettingKey,
        form: MailDaySettingsForm,
        showsDivider: Bool
    ) -> some View {
        VStack(spacing: Spacing.s0) {
            Toggle(isOn: Binding(
                get: { form.value(for: key) },
                set: { newValue in Task { await viewModel.setSetting(key, to: newValue) } }
            )) {
                Text(key.label)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
            }
            .tint(Theme.Color.primary600)
            .padding(.vertical, 7)
            .accessibilityIdentifier("mailDaySettingsToggle_\(key.rawValue)")
            if showsDivider {
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            }
        }
    }

    @ViewBuilder
    private var settingsToastOverlay: some View {
        if let toast = viewModel.settingsToast {
            Text(toast)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appText.opacity(0.9))
                .clipShape(Capsule())
                .padding(.bottom, Spacing.s10)
                .accessibilityIdentifier("mailDaySettingsToast")
                .task {
                    try? await Task.sleep(nanoseconds: 2_200_000_000)
                    viewModel.consumeSettingsToast()
                }
        }
    }

    // MARK: - Loading / error bodies

    private var loadingBody: some View {
        VStack(spacing: Spacing.s4) {
            Shimmer(width: nil, height: 80, cornerRadius: Radii.lg)
            Shimmer(width: nil, height: 64, cornerRadius: Radii.lg)
            Shimmer(width: nil, height: 160, cornerRadius: Radii.lg)
            Shimmer(width: nil, height: 240, cornerRadius: Radii.lg)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
        .accessibilityIdentifier("mailDayLoading")
    }

    private func errorBody(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.alertCircle, size: 40, strokeWidth: 2.2, color: Theme.Color.error)
            Text("Couldn't load your mail day")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mailDayRetry")
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s10)
        .accessibilityIdentifier("mailDayError")
    }
}

// MARK: - Settings card chrome

/// Uppercase overline + a bordered white card — the settings-frame unit
/// (RN's `styles.section` + `styles.sectionLabel`).
private struct MailDaySettingsCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.bottom, 10)
            content()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

// MARK: - Finish-day sticky bar

/// Sticky footer pinned beneath the populated scroll body. Compact
/// summary line above a full-width primary CTA that activates once the
/// unreviewed list is empty.
struct FinishDayBar: View {
    let isEnabled: Bool
    let total: Int
    let routed: Int
    let junked: Int
    let returned: Int
    let remaining: Int
    var onFinish: @MainActor () -> Void = {}

    var body: some View {
        VStack(spacing: Spacing.s2) {
            summaryLine
            primaryCTA
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, 10)
        .padding(.bottom, Spacing.s6)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("mailDayFinishDay")
    }

    private var summaryLine: some View {
        HStack(spacing: Spacing.s2) {
            summaryChip(icon: .arrowRight, count: routed, label: "routed", iconColor: Theme.Color.success)
            dot
            summaryChip(icon: .trash2, count: junked, label: "junked", iconColor: Theme.Color.error)
            if returned > 0 {
                dot
                summaryChip(
                    icon: .refreshCw,
                    count: returned,
                    label: "returned",
                    iconColor: Theme.Color.appTextSecondary
                )
            }
            Spacer(minLength: Spacing.s0)
            if remaining > 0 {
                Text("\(remaining) still pending")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.warmAmber)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func summaryChip(icon: PantopusIcon, count: Int, label: String, iconColor: Color) -> some View {
        HStack(spacing: 3) {
            Icon(icon, size: 11, strokeWidth: 2.4, color: iconColor)
            Text("\(count)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var dot: some View {
        Text("·").font(.system(size: 11)).foregroundStyle(Theme.Color.appBorderStrong)
    }

    private var primaryCTA: some View {
        Button(
            action: { onFinish() },
            label: {
                HStack(spacing: 6) {
                    Icon(
                        isEnabled ? .mailbox : .lock,
                        size: 16,
                        strokeWidth: 2.4,
                        color: isEnabled ? Theme.Color.appTextInverse : Theme.Color.appTextMuted
                    )
                    Text(ctaLabel)
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(isEnabled ? Theme.Color.appTextInverse : Theme.Color.appTextMuted)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(isEnabled ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .shadow(
                    color: isEnabled ? Theme.Color.primary600.opacity(0.28) : .clear,
                    radius: isEnabled ? 12 : 0,
                    x: 0,
                    y: isEnabled ? 6 : 0
                )
            }
        )
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .accessibilityLabel(ctaLabel)
        .accessibilityIdentifier("mailDayFinishDayCTA")
    }

    private var ctaLabel: String {
        if total == 0 {
            return "Finish day · nothing to close"
        }
        if isEnabled {
            return "Finish day · all done"
        }
        return "Finish day · \(remaining) remaining"
    }
}

#if DEBUG
#Preview("Populated") {
    NavigationStack {
        MailDayView(viewModel: MailDayViewModel(variant: .populated))
    }
}

#Preview("Empty") {
    NavigationStack {
        MailDayView(viewModel: MailDayViewModel(variant: .empty))
    }
}
#endif
