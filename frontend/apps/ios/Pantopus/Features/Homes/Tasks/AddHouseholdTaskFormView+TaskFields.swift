//
//  AddHouseholdTaskFormView+TaskFields.swift
//  Pantopus
//

import SwiftUI

extension AddHouseholdTaskFormView {
    // MARK: - Task and assignee sections

    var titleAndCategorySection: some View {
        FormFieldGroup("Task") {
            titleField
            categoryPicker
        }
    }

    var assigneeSection: some View {
        FormFieldGroup("Assigned to") {
            assigneePicker
        }
    }

    @ViewBuilder private var titleField: some View {
        let snapshot = viewModel.fields[.title]
            ?? FormFieldState(id: AddHouseholdTaskField.title.rawValue, originalValue: "")
        let count = snapshot.value.count
        VStack(alignment: .leading, spacing: Spacing.s1) {
            PantopusTextField(
                "Title",
                text: Binding(
                    get: { snapshot.value },
                    set: { viewModel.update(.title, to: $0) }
                ),
                placeholder: "e.g. Take out the trash",
                state: fieldState(for: snapshot, allowEmptyValid: false),
                identifier: "field_title"
            )
            Text("\(count) / 80")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .accessibilityHidden(true)
        }
    }

    private var categoryPicker: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Category")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            // Wrap chips into rows of up to three so a 360pt-wide
            // device doesn't overflow the white surface card.
            let rows = Self.chunked(AddHouseholdTaskFormCategory.allCases, size: 3)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(0..<rows.count, id: \.self) { idx in
                    HStack(spacing: Spacing.s2) {
                        ForEach(rows[idx], id: \.rawValue) { category in
                            categoryChip(category)
                        }
                        if rows[idx].count < 3 {
                            Spacer(minLength: Spacing.s0)
                        }
                    }
                }
            }
            .accessibilityIdentifier("field_category")
        }
    }

    private func categoryChip(_ category: AddHouseholdTaskFormCategory) -> some View {
        let selected = viewModel.selectedCategory == category
        return Button {
            viewModel.selectCategory(category)
        } label: {
            HStack(spacing: Spacing.s1) {
                Icon(
                    category.icon,
                    size: 14,
                    color: selected ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                )
                Text(category.label)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(selected ? Theme.Color.primary600 : Theme.Color.appText)
            }
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
        .accessibilityLabel("\(category.label) category")
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("field_category_\(category.rawValue)")
    }

    private var assigneePicker: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            // Note: backend stores `assigned_to` as a single user
            // uuid; the picker is single-select to match the wire.
            // See top-of-file comment on the form ViewModel.
            assigneeRow(
                id: nil,
                title: "Unassigned (any member)",
                subtitle: nil
            )
            ForEach(viewModel.assignableMembers) { member in
                assigneeRow(
                    id: member.id,
                    title: member.displayName,
                    subtitle: nil,
                    initials: member.initials
                )
            }
            if viewModel.assignableMembers.isEmpty {
                Text("No members found in this home.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityIdentifier("field_assignedTo")
    }

    @ViewBuilder
    private func assigneeRow(
        id: String?,
        title: String,
        subtitle: String?,
        initials: String? = nil
    ) -> some View {
        let selected = viewModel.selectedAssigneeId == id
        Button {
            viewModel.selectAssignee(id)
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
                ZStack {
                    Circle()
                        .fill(Theme.Color.homeBg)
                    Text(initials ?? "··")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.home)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    if let subtitle {
                        Text(subtitle)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer()
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 48)
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
        .accessibilityLabel(title)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("field_assignedTo_\(id ?? "none")")
    }

    private static func chunked<T>(_ items: [T], size: Int) -> [[T]] {
        guard size > 0 else { return [items] }
        var result: [[T]] = []
        var i = 0
        while i < items.count {
            let end = min(i + size, items.count)
            result.append(Array(items[i..<end]))
            i += size
        }
        return result
    }
}
