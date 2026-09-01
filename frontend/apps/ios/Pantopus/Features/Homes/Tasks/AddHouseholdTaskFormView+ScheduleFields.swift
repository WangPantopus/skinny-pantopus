//
//  AddHouseholdTaskFormView+ScheduleFields.swift
//  Pantopus
//

import SwiftUI

extension AddHouseholdTaskFormView {
    // MARK: - Schedule and notes sections

    var scheduleSection: some View {
        FormFieldGroup("Schedule") {
            recurrencePicker
            if viewModel.showsCustomRecurrenceSubForm {
                customRecurrenceSubForm
            }
            dueDateField
        }
    }

    var notesSection: some View {
        FormFieldGroup("Notes") {
            notesField
        }
    }

    private var recurrencePicker: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Repeats")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(AddHouseholdTaskRecurrence.allCases, id: \.rawValue) { option in
                    recurrenceRow(option)
                }
            }
            .accessibilityIdentifier("field_recurrence")
        }
    }

    private func recurrenceRow(_ option: AddHouseholdTaskRecurrence) -> some View {
        let selected = viewModel.selectedRecurrence == option
        return Button {
            viewModel.selectRecurrence(option)
        } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .stroke(
                            selected ? Theme.Color.primary600 : Theme.Color.appBorderStrong,
                            lineWidth: selected ? 6 : 2
                        )
                        .frame(width: 20, height: 20)
                }
                .frame(width: 20, height: 20)
                Text(option.label)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                if option.isRecurring {
                    Icon(.arrowsRepeat, size: 14, color: Theme.Color.appTextMuted)
                }
                Spacer()
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(selected ? Theme.Color.primary50 : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(
                        selected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: selected ? 1.5 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option.label)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("field_recurrence_\(option.rawValue)")
    }

    private var customRecurrenceSubForm: some View {
        let intervalSnapshot = viewModel.fields[.customInterval]
            ?? FormFieldState(id: AddHouseholdTaskField.customInterval.rawValue, originalValue: "1")
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Every...")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(alignment: .top, spacing: Spacing.s2) {
                PantopusTextField(
                    "",
                    text: Binding(
                        get: { intervalSnapshot.value },
                        set: { viewModel.update(.customInterval, to: $0) }
                    ),
                    placeholder: "3",
                    state: fieldState(for: intervalSnapshot, allowEmptyValid: false),
                    keyboardType: .numberPad,
                    identifier: "field_customInterval"
                )
                .frame(width: 96)
                HStack(spacing: Spacing.s1) {
                    ForEach(AddHouseholdTaskCustomUnit.allCases, id: \.rawValue) { unit in
                        unitChip(unit)
                    }
                }
                .accessibilityIdentifier("field_customUnit")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("customRecurrenceSubForm")
    }

    private func unitChip(_ unit: AddHouseholdTaskCustomUnit) -> some View {
        let selected = viewModel.selectedCustomUnit == unit
        return Button {
            viewModel.selectCustomUnit(unit)
        } label: {
            Text(unit.label)
                .pantopusTextStyle(.small)
                .foregroundStyle(selected ? Theme.Color.primary600 : Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 44)
                .background(selected ? Theme.Color.primary50 : Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                        .stroke(
                            selected ? Theme.Color.primary600 : Theme.Color.appBorder,
                            lineWidth: selected ? 1.5 : 1
                        )
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(unit.label)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("field_customUnit_\(unit.rawValue)")
    }

    private var dueDateField: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack {
                Text(viewModel.selectedRecurrence == .oneTime ? "Due date" : "First occurrence")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                if viewModel.dueDate != nil {
                    Button("Clear") {
                        viewModel.setDueDate(nil)
                    }
                    .font(Theme.Font.role(.caption))
                    .foregroundStyle(Theme.Color.primary600)
                    .accessibilityIdentifier("field_dueAt_clear")
                }
            }
            DatePicker(
                "Due date",
                selection: Binding<Date>(
                    get: { viewModel.dueDate ?? Date() },
                    set: { viewModel.setDueDate($0) }
                ),
                displayedComponents: .date
            )
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("field_dueAt")
        }
    }

    @ViewBuilder private var notesField: some View {
        let snapshot = viewModel.fields[.notes]
            ?? FormFieldState(id: AddHouseholdTaskField.notes.rawValue, originalValue: "")
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Notes (optional)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            TextEditor(text: Binding(
                get: { snapshot.value },
                set: { viewModel.update(.notes, to: $0) }
            ))
            .frame(minHeight: 96)
            .padding(Spacing.s2)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("field_notes")
        }
    }

    func fieldState(
        for snapshot: FormFieldState,
        allowEmptyValid: Bool
    ) -> PantopusFieldState {
        if let error = snapshot.error, snapshot.touched {
            return .error(error)
        }
        if snapshot.touched, snapshot.isDirty,
           allowEmptyValid || !snapshot.value.trimmingCharacters(in: .whitespaces).isEmpty {
            return .valid
        }
        return .default
    }
}
