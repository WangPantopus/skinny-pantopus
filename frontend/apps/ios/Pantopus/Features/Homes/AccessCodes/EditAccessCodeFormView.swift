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
    public static let deleteButton = "editAccessCode_delete"
}

/// Single-page form for adding or editing a home access code.
@MainActor
public struct EditAccessCodeFormView: View {
    @State private var viewModel: EditAccessCodeFormViewModel
    @State private var confirmingDelete = false
    @State private var isVisible = false
    @State private var needsForegroundRead = false
    @Environment(\.scenePhase) private var scenePhase
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
        // A new code shows nothing yet; only an existing one asks.
        if viewModel.isEditing {
            SensitiveScreenGuard(reason: AccessCodesCopy.guardReason, onRejected: onClose) {
                form
            }
        } else {
            form
        }
    }

    private var form: some View {
        FormShell(
            title: viewModel.isEditing && canShowContent && !viewModel.canManage ? "Access code" : viewModel.title,
            // Save appears only once the current read allows changes, as on Android.
            rightActionLabel: viewModel.canManage ? viewModel.commitLabel : nil,
            isValid: viewModel.isValid && canSaveScope && canShowContent,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving || viewModel.isRechecking,
            onClose: onClose,
            onCommit: { commit() },
            content: { formContent }
        )
        .accessibilityIdentifier(EditAccessCodeA11y.screen)
        .sensitiveScreen()
        .formShakeOnChange(of: viewModel.shakeTrigger)
        .overlay(alignment: .bottom) { toastOverlay }
        .disabled(viewModel.isSaving || viewModel.isRechecking)
        .interactiveDismissDisabled(viewModel.isSaving || viewModel.isDirty)
        .task { await refresh() }
        .onAppear {
            isVisible = true
            needsForegroundRead = false
        }
        .onDisappear {
            isVisible = false
            confirmingDelete = false
            viewModel.suspend()
        }
        .onChange(of: scenePhase) { _, phase in
            guard isVisible else { return }
            if phase == .background {
                needsForegroundRead = true
                confirmingDelete = false
                viewModel.suspend()
            } else if phase == .active, needsForegroundRead {
                needsForegroundRead = false
                Task { await refresh() }
            }
        }
        .onChange(of: viewModel.shouldDismiss) { _, dismiss in
            if dismiss {
                viewModel.acknowledgeDismiss()
                onClose()
            }
        }
    }

    // MARK: - Sections

    private var canShowContent: Bool {
        guard viewModel.hasCurrentAccess, !viewModel.isLoading, !viewModel.isConfirmingAccess else { return false }
        if case .editing = viewModel.state { return true }
        return false
    }

    private var canSaveScope: Bool {
        viewModel.canManage && viewModel.availableVisibilities.contains(viewModel.visibility)
    }

    private var canEditFields: Bool {
        viewModel.canManage && !viewModel.awaitingCreateConfirmation
    }

    @ViewBuilder private var formContent: some View {
        if viewModel.isLoading || viewModel.isConfirmingAccess {
            EditAccessCodeFormSkeleton()
        } else if canShowContent {
            if !viewModel.canManage {
                Text(viewModel.isDirty
                    ? "Your unsaved changes are kept. Editing is unavailable with your current access."
                    : "You can view and copy this code. Editing is unavailable with your current access.")
                    .pantopusTextStyle(.small)
            }
            if viewModel.awaitingCreateConfirmation {
                Text("The code may already be saved. Your details are kept. Tap Save to check.")
                    .pantopusTextStyle(.small)
            }
            categorySection.disabled(!canEditFields)
            detailsSection
            notesSection.disabled(!canEditFields)
            sharedWithSection.disabled(!canEditFields)
            if viewModel.canManage, !canSaveScope {
                Text("Choose a sharing option allowed by your current access.")
                    .pantopusTextStyle(.caption)
            }
            if viewModel.isEditing, viewModel.canManage { deleteButton }
        } else {
            if let message = viewModel.accessError {
                Text(message)
            } else if case let .error(message) = viewModel.state {
                Text(message)
            }
            Button("Try again") { Task { await refresh() } }
        }
    }

    private func refresh() async {
        await viewModel.load()
    }

    private func commit(deleting: Bool = false) {
        Task {
            guard !viewModel.isSaving, !viewModel.isRechecking else { return }
            guard await viewModel.confirmAccess(), !viewModel.isSaving, canShowContent, isVisible, scenePhase == .active else { return }
            guard deleting || canSaveScope else { return }
            if deleting { await viewModel.delete() } else { await viewModel.submit() }
        }
    }

    /// Removing a code takes it away from everyone it's shared with, so it asks first.
    private var deleteButton: some View {
        Button("Delete code", role: .destructive) { confirmingDelete = true }
            .frame(maxWidth: .infinity, minHeight: 44)
            .disabled(viewModel.isSaving)
            .accessibilityIdentifier(EditAccessCodeA11y.deleteButton)
            .confirmationDialog("Delete this code?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("Delete code", role: .destructive) { commit(deleting: true) }
            } message: {
                Text("Everyone it's shared with loses it, including guests with a pass.")
            }
    }

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
                // Not a username: with the code field, iOS otherwise reads the form as a login it can save.
                contentType: .oneTimeCode,
                identifier: EditAccessCodeA11y.labelField
            )
            .disabled(!canEditFields)
            ValueField(
                value: valueBinding,
                isRevealed: viewModel.isRevealed,
                canEdit: canEditFields,
                state: fieldState(for: viewModel.fields[.value]),
                onToggleReveal: { if canShowContent { viewModel.toggleReveal() } },
                onCopy: { if canShowContent { viewModel.copyValue() } }
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
                        isSelected: viewModel.visibility == scope
                    ) {
                        viewModel.selectVisibility(scope)
                    }
                    .disabled(!viewModel.availableVisibilities.contains(scope))
                }
                Text("These choices do not grant new Home permissions. Access follows each person’s current permissions.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
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
                .dismissToast(after: toast, minimum: 1.8) {
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

// MARK: - Value field (masked + reveal + copy)

@MainActor
private struct ValueField: View {
    @Binding var value: String
    let isRevealed: Bool
    let canEdit: Bool
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
                    .disabled(!canEdit)
                Button(action: onToggleReveal) {
                    Icon(
                        isRevealed ? .eyeOff : .eye,
                        size: 18,
                        color: Theme.Color.appTextSecondary
                    )
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isRevealed ? "Hide code" : "Show code")
                .accessibilityIdentifier(EditAccessCodeA11y.revealToggle)
                Button(action: onCopy) {
                    Icon(.copy, size: 18, color: Theme.Color.appTextSecondary)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Copy code")
                .accessibilityIdentifier(EditAccessCodeA11y.copyButton)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .typesInFieldOnTap($isFocused)
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
                // A household code, not this person's login: keeps iOS from offering to save it as a password.
                .textContentType(.oneTimeCode)
                .font(.system(.body, design: .monospaced))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
        } else {
            SecureField("••••••••", text: $value)
                .focused($isFocused)
                // A household code, not this person's login: keeps iOS from offering to save it as a password.
                .textContentType(.oneTimeCode)
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
                .typesInFieldOnTap()
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
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                radio
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(scope.headline)
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
