//
//  DefaultRemindersView.swift
//  Pantopus
//
//  Stream I16 — H1 Default Reminders Quick-Setup. A bottom-sheet-style surface
//  (also reachable as a routed full screen) that mirrors `reminders-frames.jsx`:
//  one card of selectable lead-time rows (1 week / 1 day / 1 hour / 30 min /
//  15 min / At start), each with a check-circle and, when on, an inline Push /
//  Email channel mini-row; a dashed "Add custom time" chip that expands to a
//  stepper; and a sticky Save. Smart default pre-checks 1 day + 1 hour. Frames:
//  default · first-open copy · saved toast · push-off banner. Personal sky pillar
//  (renders Home green / Business violet when opened from those pillars).
//

import SwiftUI

struct DefaultRemindersView: View {
    @State private var model: DefaultRemindersViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    /// Explicit close used when presented as a sheet; falls back to nav dismiss.
    private let onClose: (() -> Void)?

    init(owner: SchedulingOwner, onClose: (() -> Void)? = nil, client: SchedulingClient = .shared) {
        _model = State(wrappedValue: DefaultRemindersViewModel(owner: owner, client: client))
        self.onClose = onClose
    }

    private func close() {
        onClose?() ?? dismiss()
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            AutoSheetHeader(
                title: "Default reminders",
                subhead: "Times come from each event you own. Per-event overrides stay.",
                onClose: close
            )
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .overlay(alignment: .bottom) { savedToast }
        .task { await model.load() }
        .accessibilityIdentifier("scheduling.reminders")
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            skeleton
        case .loaded:
            loadedBody
        case let .error(message):
            AutoErrorView(headline: "Couldn't load reminders", message: message) {
                Task { await model.load() }
            }
        }
    }

    // MARK: Loaded

    private var loadedBody: some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    // Frame 4 (push-off) drops the helper paragraph and leads with
                    // the amber banner; Frames 1–3 lead with the helper instead.
                    if model.pushOff {
                        pushOffBanner
                    } else {
                        Text(model.firstOpen
                            ? "We pre-picked two reminders most people keep. Change them anytime."
                            : "Pick the lead-times that attach to every event you own.")
                            .font(.system(size: 11.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .padding(.horizontal, 2)
                    }

                    reminderCard

                    if model.showCustom { customStepper } else { addCustomChip }

                    if model.atCap {
                        Text("Up to 5 reminders.")
                            .font(.system(size: 10.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .padding(.horizontal, 2)
                            .accessibilityIdentifier("reminderCapNote")
                    }

                    if let saveError = model.saveError {
                        AutoNote(tone: .error, icon: .alertTriangle, text: saveError)
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s5)
            }
            footer
        }
    }

    private var reminderCard: some View {
        AutoCard(padding: EdgeInsets(top: Spacing.s0, leading: 14, bottom: Spacing.s0, trailing: 14)) {
            VStack(spacing: Spacing.s0) {
                let rows = displayRows
                ForEach(Array(rows.enumerated()), id: \.element.id) { idx, row in
                    reminderRow(minutes: row.minutes, label: row.label)
                    if idx < rows.count - 1 { AutoRowDivider() }
                }
            }
        }
    }

    /// Preset rows followed by any saved custom lead-times.
    private var displayRows: [ReminderRowData] {
        ReminderPreset.all.map { ReminderRowData(minutes: $0.minutes, label: $0.label) }
            + model.customMinutes.map { ReminderRowData(minutes: $0, label: AutomationsFormat.reminderRowLabel($0)) }
    }

    private func reminderRow(minutes: Int, label: String) -> some View {
        let on = model.isOn(minutes)
        // Backend caps reminders at 5 — once there, unselected rows disable
        // (selected rows stay tappable so the user can free a slot).
        let capped = !on && model.atCap
        return Button { model.toggle(minutes) } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 11) {
                    Icon(
                        on ? .checkCircle2 : .circle,
                        size: 21,
                        strokeWidth: on ? 2.4 : 2,
                        color: on ? model.accent : Theme.Color.appBorderStrong
                    )
                    Text(label)
                        .font(.system(size: 14, weight: on ? .semibold : .medium))
                        .foregroundStyle(on ? Theme.Color.appText : Theme.Color.appTextSecondary)
                    Spacer(minLength: Spacing.s2)
                }
                if on { channelChips.padding(.leading, 31) }
            }
            .padding(.vertical, 11)
            .padding(.horizontal, 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(capped)
        .opacity(capped ? 0.45 : 1)
        .accessibilityIdentifier("reminderRow_\(minutes)")
        .accessibilityAddTraits(on ? [.isSelected, .isButton] : .isButton)
        .accessibilityLabel("\(label), \(on ? "on" : capped ? "unavailable, up to 5 reminders" : "off")")
    }

    private var channelChips: some View {
        HStack(spacing: 6) {
            AutoChannelChip(label: "Push", icon: .bell, isOn: true, accent: model.accent, accentBg: model.accentBg)
            AutoChannelChip(label: "Email", icon: .mail, isOn: false)
        }
        .accessibilityLabel("Sends via push and email")
    }

    private var addCustomChip: some View {
        Button { model.showCustom = true } label: {
            HStack(spacing: 6) {
                Icon(.plus, size: 13, strokeWidth: 2.4, color: model.accent)
                Text("Add custom time").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, 14)
            .frame(height: 34)
            .background(Theme.Color.appSurface)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])).foregroundStyle(Theme.Color.appBorderStrong))
        }
        .buttonStyle(.plain)
        .disabled(model.atCap)
        .opacity(model.atCap ? 0.45 : 1)
        .accessibilityIdentifier("reminderAddCustom")
    }

    private var customStepper: some View {
        AutoCard(padding: EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Custom reminder").font(.system(size: 12.5, weight: .bold)).foregroundStyle(Theme.Color.appTextStrong)
                HStack(spacing: Spacing.s2) {
                    AutoStepper(
                        value: model.customValue,
                        accent: model.accent,
                        canDecrement: model.customValue > 1,
                        onDecrement: { model.stepCustom(-1) },
                        onIncrement: { model.stepCustom(1) }
                    )
                    AutoSegmented(
                        options: ReminderPreset.Unit.allCases.map(\.label),
                        selectedIndex: ReminderPreset.Unit.allCases.firstIndex(of: model.customUnit) ?? 1,
                        accent: model.accent
                    ) { idx in model.setCustomUnit(ReminderPreset.Unit.allCases[idx]) }
                }
                Text("\(AutomationsFormat.duration(model.customResolvedMinutes)) before each event starts.")
                    .font(.system(size: 10.5)).foregroundStyle(Theme.Color.appTextSecondary)
                HStack(spacing: Spacing.s2) {
                    AutoGhostButton(title: "Cancel") { model.showCustom = false }
                    AutoPrimaryButton(title: "Add time", icon: .plus) { model.addCustom() }
                }
            }
        }
    }

    private var pushOffBanner: some View {
        AutoNote(
            tone: .warning,
            icon: .bellOff,
            text: "Push is off in iOS Settings. Email still works.",
            trailing: AnyView(
                Button {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                } label: {
                    Text("Enable").font(.system(size: 11.5, weight: .bold)).foregroundStyle(model.accent)
                }
                .accessibilityIdentifier("reminderEnablePush")
            )
        )
    }

    private var footer: some View {
        AutoSheetFooter {
            AutoPrimaryButton(
                title: model.isSaving ? "Saving" : "Save",
                isSaving: model.isSaving
            ) { Task { await model.save() } }
        }
    }

    // MARK: Saved toast

    @ViewBuilder
    private var savedToast: some View {
        if model.showSavedToast {
            AutoToast(text: "Reminders saved. They'll apply to new events.")
                .padding(.bottom, 92)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .accessibilityIdentifier("reminderSavedToast")
        }
    }

    // MARK: Skeleton

    private var skeleton: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Shimmer(width: 220, height: 11, cornerRadius: Radii.xs).padding(.top, Spacing.s2)
                Shimmer(height: 300, cornerRadius: Radii.xl)
                Shimmer(width: 150, height: 34, cornerRadius: Radii.pill)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
        }
    }
}

/// One reminder row's data (Identifiable so it drives `ForEach`).
private struct ReminderRowData: Identifiable {
    let minutes: Int
    let label: String
    var id: Int {
        minutes
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        DefaultRemindersView(owner: .personal)
    }
}
#endif
