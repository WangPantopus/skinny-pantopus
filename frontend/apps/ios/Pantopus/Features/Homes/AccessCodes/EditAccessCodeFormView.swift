//
//  EditAccessCodeFormView.swift
//  Pantopus
//
//  P3.1 — Add / Edit Access Code form. Single-page editor that drives
//  POST and PUT against `/api/homes/:id/access`. Reaches this surface
//  from the AccessCodesView FAB (`secretId == nil`) and the per-row
//  edit tap (`secretId != nil`). The form pose is identical either way
//  — the title and submit verb track `isEditing`.
//
//  Mirrors the Android `EditAccessCodeFormScreen` Composable.
//
import SwiftUI

/// Stable a11y identifiers (mirror naming with Android testTags).
public enum EditAccessCodeA11y {
    public static let screen = "editAccessCode_screen"
    public static let categoryGrid = "editAccessCode_categoryGrid"
    public static let categoryOption = "editAccessCode_categoryOption"
    public static let labelField = "editAccessCode_labelField"
    public static let valueField = "editAccessCode_valueField"
    public static let revealToggle = "editAccessCode_revealToggle"
    public static let copyButton = "editAccessCode_copyButton"
    public static let notesField = "editAccessCode_notesField"
    public static let sharedWithOption = "editAccessCode_sharedWithOption"
    public static let toast = "editAccessCode_toast"
}

/// Single-page form for adding or editing a home access code.
@MainActor
public struct EditAccessCodeFormView: View {
    @State private var viewModel: EditAccessCodeFormViewModel
    private let onClose: @MainActor () -> Void

    init(
        homeId: String,
        secretId: String? = nil,
        initialCategory: AccessCategory? = nil,
        api: APIClient = .shared,
        onClose: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: EditAccessCodeFormViewModel(
            homeId: homeId,
            secretId: secretId,
            initialCategory: initialCategory,
            api: api
        ))
        self.onClose = onClose
    }

    public var body: some View {
        FormShell(
            title: viewModel.title,
            rightActionLabel: viewModel.commitLabel,
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: onClose,
            onCommit: { Task { await viewModel.submit() } },
            content: {
                categorySection
                detailsSection
                notesSection
                sharedWithSection
            }
        )
        .accessibilityIdentifier(EditAccessCodeA11y.screen)
        .sensitiveScreen()
        .formShakeOnChange(of: viewModel.shakeTrigger)
        .overlay(alignment: .bottom) { toastOverlay }
        .task { await viewModel.load() }
        .onChange(of: viewModel.shouldDismiss) { _, dismiss in
            if dismiss {
                viewModel.acknowledgeDismiss()
                onClose()
            }
        }
    }

    // MARK: - Sections

    private var categorySection: some View {
        FormFieldGroup("Category") {
            AccessCodeCategoryGrid(selected: viewModel.category) {
                viewModel.selectCategory($0)
            }
        }
    }

    private var detailsSection: some View {
        FormFieldGroup("Details") {
            PantopusTextField(
                "Label",
                text: labelBinding,
                placeholder: "Main network",
                state: fieldState(for: viewModel.fields[.label]),
                identifier: EditAccessCodeA11y.labelField
            )
            ValueField(
                value: valueBinding,
                isRevealed: viewModel.isRevealed,
                state: fieldState(for: viewModel.fields[.value]),
                onToggleReveal: { viewModel.toggleReveal() },
                onCopy: { viewModel.copyValue() }
            )
        }
    }

    private var notesSection: some View {
        FormFieldGroup("Notes (optional)") {
            NotesField(
                text: notesBinding,
                error: viewModel.fields[.notes]?.error
            )
        }
    }

    private var sharedWithSection: some View {
        FormFieldGroup("Shared with") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(AccessVisibility.displayOrder, id: \.self) { scope in
                    VisibilityRow(
                        scope: scope,
                        isSelected: viewModel.visibility == scope,
                        rosterSummary: viewModel.rosterSummary(for: scope)
                    ) {
                        viewModel.selectVisibility(scope)
                    }
                }
                if !viewModel.sharedWithNames().isEmpty {
                    MemberPreviewStrip(names: viewModel.sharedWithNames())
                }
            }
        }
    }

    // MARK: - Toast

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s10)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .accessibilityIdentifier(EditAccessCodeA11y.toast)
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 1_800_000_000)
                    viewModel.toast = nil
                }
        }
    }

    // MARK: - Bindings

    private var labelBinding: Binding<String> {
        binding(for: .label)
    }

    private var valueBinding: Binding<String> {
        binding(for: .value)
    }

    private var notesBinding: Binding<String> {
        binding(for: .notes)
    }

    private func binding(for field: EditAccessCodeField) -> Binding<String> {
        Binding(
            get: { viewModel.fields[field]?.value ?? "" },
            set: { viewModel.update(field, to: $0) }
        )
    }

    private func fieldState(for snapshot: FormFieldState?) -> PantopusFieldState {
        guard let snapshot, snapshot.touched else { return .default }
        if let error = snapshot.error { return .error(error) }
        if snapshot.value.trimmingCharacters(in: .whitespaces).isEmpty { return .default }
        return .valid
    }
}

// MARK: - Category grid

/// 3-column grid of category tiles. Selected tile carries the
/// category's tinted background + a 2pt primary600 border so the
/// selection is unambiguous against the white card.
@MainActor
private struct AccessCodeCategoryGrid: View {
    let selected: AccessCategory
    let onSelect: (AccessCategory) -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: 3)

    var body: some View {
        LazyVGrid(columns: columns, spacing: Spacing.s2) {
            ForEach(AccessCategory.displayOrder, id: \.self) { category in
                CategoryTile(
                    category: category,
                    isSelected: category == selected
                ) {
                    onSelect(category)
                }
            }
        }
        .accessibilityIdentifier(EditAccessCodeA11y.categoryGrid)
    }
}

@MainActor
private struct CategoryTile: View {
    let category: AccessCategory
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            VStack(spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(category.background)
                        .frame(width: 40, height: 40)
                    Icon(category.icon, size: 20, color: category.foreground)
                }
                Text(category.label)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, minHeight: 80)
            .padding(.vertical, Spacing.s2)
            .background(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(isSelected ? category.background.opacity(0.4) : Theme.Color.appSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("\(EditAccessCodeA11y.categoryOption)_\(category.rawValue)")
        .accessibilityLabel(category.label)
        .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
    }
}

// MARK: - Value field (masked + reveal + copy)

@MainActor
private struct ValueField: View {
    @Binding var value: String
    let isRevealed: Bool
    let state: PantopusFieldState
    let onToggleReveal: () -> Void
    let onCopy: () -> Void

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Code")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                input
                Button(action: onToggleReveal) {
                    Icon(
                        isRevealed ? .eyeOff : .eye,
                        size: 18,
                        color: Theme.Color.appTextSecondary
                    )
                    .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isRevealed ? "Hide code" : "Show code")
                .accessibilityIdentifier(EditAccessCodeA11y.revealToggle)
                Button(action: onCopy) {
                    Icon(.copy, size: 18, color: Theme.Color.appTextSecondary)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Copy code")
                .accessibilityIdentifier(EditAccessCodeA11y.copyButton)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(borderColor, lineWidth: isFocused ? 2 : 1)
            )
            if case let .error(message) = state {
                Text(message)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
            }
        }
        .accessibilityIdentifier(EditAccessCodeA11y.valueField)
    }

    @ViewBuilder private var input: some View {
        if isRevealed {
            TextField("••••••••", text: $value)
                .focused($isFocused)
                .font(.system(.body, design: .monospaced))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
        } else {
            SecureField("••••••••", text: $value)
                .focused($isFocused)
                .font(.system(.body, design: .monospaced))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
        }
    }

    private var borderColor: Color {
        switch state {
        case .error: Theme.Color.error
        case .valid: Theme.Color.success
        case .default: isFocused ? Theme.Color.primary600 : Theme.Color.appBorder
        }
    }
}

// MARK: - Notes field (multi-line)

@MainActor
private struct NotesField: View {
    @Binding var text: String
    let error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            TextEditor(text: $text)
                .frame(minHeight: 88)
                .padding(Spacing.s2)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(
                            error == nil ? Theme.Color.appBorder : Theme.Color.error,
                            lineWidth: 1
                        )
                )
                .accessibilityIdentifier(EditAccessCodeA11y.notesField)
            if let error {
                Text(error)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
            }
        }
    }
}

// MARK: - Visibility scope row

@MainActor
private struct VisibilityRow: View {
    let scope: AccessVisibility
    let isSelected: Bool
    let rosterSummary: String
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                radio
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(rosterSummary)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Text(scope.subcopy)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: Spacing.s0)
            }
            .padding(Spacing.s3)
            .background(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(isSelected ? Theme.Color.primary600.opacity(0.08) : Theme.Color.appSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("\(EditAccessCodeA11y.sharedWithOption)_\(scope.rawValue)")
        .accessibilityLabel("\(scope.headline). \(scope.subcopy)")
        .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
    }

    private var radio: some View {
        ZStack {
            Circle()
                .stroke(
                    isSelected ? Theme.Color.primary600 : Theme.Color.appBorderStrong,
                    lineWidth: 1.5
                )
                .frame(width: 22, height: 22)
            if isSelected {
                Circle()
                    .fill(Theme.Color.primary600)
                    .frame(width: 12, height: 12)
            }
        }
    }
}

// MARK: - Member preview strip

@MainActor
private struct MemberPreviewStrip: View {
    let names: [String]

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.users, size: 12, color: Theme.Color.appTextSecondary)
            Text(displayText)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(2)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.top, Spacing.s1)
    }

    private var displayText: String {
        if names.count <= 3 {
            return names.joined(separator: ", ")
        }
        let head = names.prefix(3).joined(separator: ", ")
        let extra = names.count - 3
        return "\(head) +\(extra) more"
    }
}

#Preview("Add code") {
    EditAccessCodeFormView(
        homeId: "home_preview",
        secretId: nil,
        initialCategory: .wifi
    ) {}
}

#Preview("Edit code") {
    EditAccessCodeFormView(
        homeId: "home_preview",
        secretId: "secret_1"
    ) {}
}
