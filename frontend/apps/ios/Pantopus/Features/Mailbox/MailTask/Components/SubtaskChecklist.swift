//
//  SubtaskChecklist.swift
//  Pantopus
//
//  A17.12 — the tappable subtask checklist. A "STEPS" header with an
//  "Add step" affordance over a divider-separated list of rows. Each row
//  has a 20pt checkbox (success-green when checked), a label struck
//  through when complete, and a hint shown only while incomplete. Taps
//  persist to local state via `onToggle`.
//

import SwiftUI

struct SubtaskChecklist: View {
    let subtasks: [MailTaskSubtask]
    /// When the whole task is done every row reads checked + locked.
    let allDone: Bool
    let onToggle: (String) -> Void
    let onAddStep: () -> Void

    var body: some View {
        MailTaskAccentCard {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                header
                ForEach(Array(subtasks.enumerated()), id: \.element.id) { index, subtask in
                    if index > 0 {
                        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                    }
                    row(subtask)
                }
            }
        }
        .accessibilityIdentifier("mailTask_checklist")
    }

    private var header: some View {
        HStack {
            Text("STEPS")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
            Button(action: onAddStep) {
                HStack(spacing: 3) {
                    Icon(.plus, size: 12, color: Theme.Color.categoryTask)
                    Text("Add step")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.Color.categoryTask)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mailTask_checklist_addStep")
        }
        .padding(.bottom, Spacing.s3)
    }

    private func row(_ subtask: MailTaskSubtask) -> some View {
        let checked = allDone || subtask.isDone
        return Button {
            onToggle(subtask.id)
        } label: {
            HStack(alignment: .top, spacing: Spacing.s3 - 1) {
                checkbox(checked: checked)
                VStack(alignment: .leading, spacing: 2) {
                    Text(subtask.label)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(checked ? Theme.Color.appTextSecondary : Theme.Color.appText)
                        .strikethrough(checked, color: Theme.Color.appTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                    if !checked {
                        Text(subtask.hint)
                            .font(.system(size: 11.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: Spacing.s0)
            }
            .padding(.vertical, Spacing.s3 - 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(allDone)
        .accessibilityIdentifier("mailTask_step_\(subtask.id)")
        .accessibilityLabel(subtask.label)
        .accessibilityValue(checked ? "Completed" : "Not completed")
        .accessibilityAddTraits(.isButton)
    }

    private func checkbox(checked: Bool) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(checked ? Theme.Color.success : Theme.Color.appSurface)
            if checked {
                Icon(.check, size: 12, color: Theme.Color.appTextInverse)
            } else {
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .stroke(Theme.Color.appBorderStrong, lineWidth: 2)
            }
        }
        .frame(width: 20, height: 20)
        .padding(.top, 1)
        .accessibilityHidden(true)
    }
}

#if DEBUG
#Preview("Open") {
    SubtaskChecklist(
        subtasks: MailTaskSampleData.task().subtasks,
        allDone: false,
        onToggle: { _ in },
        onAddStep: {}
    )
    .padding()
    .background(Theme.Color.appBg)
}

#Preview("All done") {
    SubtaskChecklist(
        subtasks: MailTaskSampleData.task().subtasks,
        allDone: true,
        onToggle: { _ in },
        onAddStep: {}
    )
    .padding()
    .background(Theme.Color.appBg)
}
#endif
