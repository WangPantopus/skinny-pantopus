//
//  TriggerPickerSheet.swift
//  Pantopus
//
//  Stream I16 — H4 Trigger Picker (local sheet, no route). Chooses what fires a
//  workflow: a lifecycle radio list (Created / Cancelled / Rescheduled / Started
//  / Ended) and, for the two offset triggers, a before/after timing builder. Maps
//  exactly to the backend triggers — `Started` → `before_start` (X before it
//  starts), `Ended` → `after_end` (X after it ends); the instant triggers carry
//  no offset. Returns the chosen `WorkflowTrigger` + offset minutes to H3. Pure
//  local state — no networking.
//

import SwiftUI

struct TriggerPickerSheet: View {
    let accent: Color
    let onApply: (WorkflowTrigger, Int) -> Void
    let onClose: () -> Void

    @State private var selected: WorkflowTrigger
    @State private var amount: Int
    @State private var unit: ReminderPreset.Unit

    init(
        trigger: WorkflowTrigger,
        offsetMinutes: Int,
        accent: Color,
        onApply: @escaping (WorkflowTrigger, Int) -> Void,
        onClose: @escaping () -> Void
    ) {
        self.accent = accent
        self.onApply = onApply
        self.onClose = onClose
        _selected = State(initialValue: trigger)
        let (value, unit) = Self.decompose(offsetMinutes)
        _amount = State(initialValue: value)
        _unit = State(initialValue: unit)
    }

    private var usesOffset: Bool {
        selected.usesOffset
    }

    private var resolvedMinutes: Int {
        amount * unit.multiplier
    }

    private var isInvalid: Bool {
        usesOffset && amount <= 0
    }

    /// Backend `workflowSchema` caps `offset_minutes` at 525600 (365 days —
    /// backend/routes/scheduling.js:1081); the per-unit stepper ceiling keeps
    /// `resolvedMinutes` within it.
    private var maxAmount: Int {
        switch unit {
        case .minutes: 999
        case .hours: 8760
        case .days: 365
        }
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            AutoSheetHeader(title: "When should this run?", onClose: onClose)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    lifecycleCard
                    if usesOffset {
                        AutoOverline(text: "Timing").padding(.top, Spacing.s2).padding(.horizontal, 2)
                        timingCard
                    }
                    summaryPill.padding(.top, Spacing.s2)
                    Color.clear.frame(height: Spacing.s2)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s2)
            }
            AutoSheetFooter {
                AutoPrimaryButton(title: "Done", isDisabled: isInvalid) {
                    onApply(selected, usesOffset ? resolvedMinutes : 0)
                }
            }
        }
        .background(Theme.Color.appBg)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("scheduling.workflows.triggerPicker")
    }

    private var lifecycleCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            AutoOverline(text: "Lifecycle").padding(.horizontal, 2)
            AutoCard(padding: EdgeInsets(top: Spacing.s0, leading: 14, bottom: Spacing.s0, trailing: 14)) {
                VStack(spacing: Spacing.s0) {
                    let triggers = WorkflowTrigger.allCases
                    ForEach(Array(triggers.enumerated()), id: \.element.id) { idx, trigger in
                        AutoRadioRow(
                            label: trigger.lifecycleLabel,
                            sub: trigger.lifecycleDescription,
                            selected: selected == trigger,
                            accent: accent,
                            icon: trigger.icon
                        ) { selected = trigger }
                        if idx < triggers.count - 1 { AutoRowDivider() }
                    }
                }
            }
        }
    }

    private var timingCard: some View {
        AutoCard(padding: EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)) {
            HStack(spacing: Spacing.s2) {
                AutoStepper(
                    value: amount,
                    accent: accent,
                    isInvalid: isInvalid,
                    canDecrement: amount > 0,
                    canIncrement: amount < maxAmount,
                    onDecrement: { amount = max(0, amount - 1) },
                    onIncrement: { amount = min(maxAmount, amount + 1) }
                )
                AutoSegmented(
                    options: ReminderPreset.Unit.allCases.map { unitShort($0) },
                    selectedIndex: ReminderPreset.Unit.allCases.firstIndex(of: unit) ?? 1,
                    accent: accent
                ) {
                    unit = ReminderPreset.Unit.allCases[$0]
                    amount = min(amount, maxAmount)
                }
            }
        }
    }

    private var summaryPill: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.clock, size: 14, color: isInvalid ? Theme.Color.error : accent)
            Text(summaryText)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(isInvalid ? Theme.Color.error : Theme.Color.appTextStrong)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(isInvalid ? Theme.Color.errorBg : Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(summaryText)
    }

    private var summaryText: String {
        if isInvalid { return "Pick a number greater than zero" }
        return selected.summary(offsetMinutes: usesOffset ? resolvedMinutes : 0)
    }

    private func unitShort(_ unit: ReminderPreset.Unit) -> String {
        switch unit {
        case .minutes: "min"
        case .hours: "hour"
        case .days: "day"
        }
    }

    /// Largest whole unit that represents `minutes` (60 → 1 hour, 1440 → 1 day).
    private static func decompose(_ minutes: Int) -> (Int, ReminderPreset.Unit) {
        let m = max(0, minutes)
        if m == 0 { return (1, .hours) }
        if m % 1440 == 0 { return (m / 1440, .days) }
        if m % 60 == 0 { return (m / 60, .hours) }
        return (m, .minutes)
    }
}
