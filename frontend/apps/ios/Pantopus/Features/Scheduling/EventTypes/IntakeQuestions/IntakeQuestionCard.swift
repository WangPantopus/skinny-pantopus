//
//  IntakeQuestionCard.swift
//  Pantopus
//
//  Stream I2 — B3 custom-question primitives mirroring the design's
//  `intake-frames.jsx`:
//   • `IntakeQuestionRow` — a flat collapsed row inside the shared ListBlock
//     card (label, type/required caption, an always-visible trash-2, and a
//     grip-vertical drag handle), separated from the next row by a 1px divider.
//   • `IntakeQuestionEditGroup` — the inline blue `EditGroup` field group that
//     replaces a row while editing: label field, a 3-column segmented answer-
//     type selector, an options list, a bordered "Make this required" toggle
//     row, and a "Save question" button paired with a red trash-2 Delete.
//  Tokens only.
//

import SwiftUI

// MARK: - Collapsed row

/// Design `QuestionRow` — flat row, no per-row card. Tapping the row opens the
/// inline editor; the trash-2 deletes; the grip-vertical reorders (arrow
/// fallback via the up/down buttons exposed through `onMoveUp`/`onMoveDown`,
/// since SwiftUI lacks a one-handle drag without a List).
struct IntakeQuestionRow: View {
    let question: EditableQuestion
    let isLast: Bool
    let canMoveUp: Bool
    let canMoveDown: Bool
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onMoveUp: () -> Void
    let onMoveDown: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: Spacing.s2) {
                Button(action: onEdit) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(displayLabel)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(question.label.isEmpty ? Theme.Color.appTextMuted : Theme.Color.appText)
                            .lineLimit(1)
                        HStack(spacing: 7) {
                            Text(question.fieldType.label)
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                            if question.required { IntakeRequiredPill() }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Button(action: onDelete) {
                    Icon(.trash2, size: 15, color: Theme.Color.appTextMuted)
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Delete \(displayLabel)")

                // Grip handle — drives reorder. SwiftUI can't drag a single
                // handle outside a `List`, so the handle exposes up/down via a
                // long-press menu while staying visually faithful to the design.
                Menu {
                    Button("Move up", action: onMoveUp).disabled(!canMoveUp)
                    Button("Move down", action: onMoveDown).disabled(!canMoveDown)
                } label: {
                    Icon(.gripVertical, size: 16, color: Theme.Color.appTextMuted)
                        .frame(width: 30, height: 30)
                }
                .accessibilityLabel("Reorder \(displayLabel)")
            }
            .padding(.vertical, 11)
            if !isLast {
                Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            }
        }
    }

    private var displayLabel: String {
        let trimmed = question.label.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "New question" : trimmed
    }
}

/// Design `RequiredPill` — primary50 fill, primary700 uppercase label.
struct IntakeRequiredPill: View {
    var body: some View {
        Text("Required".uppercased())
            .font(.system(size: 9, weight: .bold))
            .tracking(0.4)
            .foregroundStyle(Theme.Color.primary700)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(Theme.Color.primary50)
            .clipShape(Capsule())
    }
}

// MARK: - Inline edit group (blue field group)

/// Design `EditGroup` — primary50 fill, 1.5px primary200 border. Replaces the
/// row it edits.
struct IntakeQuestionEditGroup: View {
    @Binding var question: EditableQuestion
    let onSave: () -> Void
    let onDelete: () -> Void
    let onTypeChange: () -> Void
    let onAddOption: () -> Void
    let onRemoveOption: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            field(label: "Question") {
                TextField("What should we cover?", text: $question.label)
                    .font(Theme.Font.body)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityIdentifier("scheduling.intake.labelField")
            }
            field(label: "Answer type") {
                IntakeTypeSelector(
                    selection: $question.fieldType,
                    onChange: onTypeChange
                )
            }
            if question.fieldType.needsOptions { optionsEditor }
            requiredRow
            footer
        }
        .padding(12)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1.5)
        )
    }

    private func field(label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            content()
        }
    }

    private var optionsEditor: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Options")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            ForEach(question.options.indices, id: \.self) { index in
                HStack(spacing: 9) {
                    Icon(.gripVertical, size: 14, color: Theme.Color.appTextMuted)
                    TextField("Option \(index + 1)", text: $question.options[index])
                        .font(Theme.Font.body)
                        .foregroundStyle(Theme.Color.appText)
                    Button { onRemoveOption(index) } label: {
                        Icon(.x, size: 14, color: Theme.Color.appTextMuted)
                            .frame(width: 28, height: 28)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove option \(index + 1)")
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1.5)
                )
            }
            Button(action: onAddOption) {
                HStack(spacing: 5) {
                    Icon(.plus, size: 13, color: Theme.Color.primary600)
                    Text("Add option")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                }
            }
            .buttonStyle(.plain)
        }
    }

    /// Bordered white surface row (design `EditGroup` required row).
    private var requiredRow: some View {
        HStack {
            Text("Make this required")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            IntakeRequiredToggle(on: $question.required)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 9)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private var footer: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onSave) {
                Text("Save question")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("scheduling.intake.saveQuestion")
            Button(action: onDelete) {
                HStack(spacing: 5) {
                    Icon(.trash2, size: 15, color: Theme.Color.error)
                    Text("Delete")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.error)
                }
                .frame(height: 40)
                .padding(.horizontal, 6)
            }
            .buttonStyle(.plain)
        }
    }
}

/// Product-blue 36×20 toggle reused inside the EditGroup required row.
struct IntakeRequiredToggle: View {
    @Binding var on: Bool

    var body: some View {
        Button { on.toggle() } label: {
            ZStack(alignment: on ? .trailing : .leading) {
                Capsule()
                    .fill(on ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                    .frame(width: 36, height: 20)
                Circle()
                    .fill(Theme.Color.appSurface)
                    .frame(width: 16, height: 16)
                    .padding(.horizontal, 2)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Make this required")
        .accessibilityValue(on ? "on" : "off")
    }
}

// MARK: - 3-column segmented answer-type selector

/// Design `TypeSelector` — a sunken track holding a 3-column grid of 30pt cells;
/// the selected cell is a white surface with a primary700 label and soft shadow.
struct IntakeTypeSelector: View {
    @Binding var selection: QuestionFieldType
    let onChange: () -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 3)

    var body: some View {
        LazyVGrid(columns: columns, spacing: 4) {
            ForEach(QuestionFieldType.allCases) { type in
                cell(type)
            }
        }
        .padding(4)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("scheduling.intake.typeSelector")
    }

    private func cell(_ type: QuestionFieldType) -> some View {
        let on = type == selection
        return Button {
            selection = type
            onChange()
        } label: {
            Text(type.label)
                .font(.system(size: 11, weight: on ? .bold : .semibold))
                .foregroundStyle(on ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .frame(maxWidth: .infinity)
                .frame(height: 30)
                .background(selectedBackground(on))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(type.label)
        .accessibilityAddTraits(on ? [.isSelected] : [])
    }

    @ViewBuilder
    private func selectedBackground(_ on: Bool) -> some View {
        if on {
            RoundedRectangle(cornerRadius: 7, style: .continuous)
                .fill(Theme.Color.appSurface)
                .pantopusShadow(.sm)
        } else {
            Color.clear
        }
    }
}
