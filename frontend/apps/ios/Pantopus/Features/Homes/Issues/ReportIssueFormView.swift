//
//  ReportIssueFormView.swift
//  Pantopus
//
//  "Report Issue" create form for the per-home issue tracker. Presented
//  as a sheet from `HomeIssuesListView`'s FAB / empty-state CTA.
//  Mirrors RN's inline create form (`maintenance.tsx:127-137`).
//

import SwiftUI

public struct ReportIssueFormView: View {
    @State private var viewModel: ReportIssueFormViewModel
    private let onClose: @MainActor () -> Void

    init(
        viewModel: ReportIssueFormViewModel,
        onClose: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
    }

    public var body: some View {
        FormShell(
            title: "Report an issue",
            rightActionLabel: nil,
            bottomActionLabel: viewModel.isSubmitting ? "Reporting…" : "Report Issue",
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSubmitting,
            onClose: onClose,
            onCommit: { viewModel.commit() },
            content: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                            .accessibilityIdentifier("reportIssueError")
                    }
                    titleGroup
                    descriptionGroup
                    Text("Everyone with access to this home can see reported issues and their status.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Spacing.s4)
            }
        )
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("reportIssueForm")
        .onChange(of: viewModel.shouldDismiss) { _, shouldDismiss in
            guard shouldDismiss else { return }
            viewModel.acknowledgeDismiss()
            onClose()
        }
    }

    private var titleGroup: some View {
        FormFieldGroup("Issue") {
            PantopusTextField(
                "Issue title",
                text: Binding(
                    get: { viewModel.title },
                    set: { viewModel.title = $0 }
                ),
                placeholder: "Issue title",
                isRequired: true,
                identifier: "reportIssue_title"
            )
        }
    }

    private var descriptionGroup: some View {
        FormFieldGroup("Details") {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Description (optional)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextEditor(
                    text: Binding(
                        get: { viewModel.issueDescription },
                        set: { viewModel.issueDescription = $0 }
                    )
                )
                .frame(minHeight: 96)
                .padding(Spacing.s2)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .accessibilityIdentifier("reportIssue_description")
            }
        }
    }
}

#Preview {
    ReportIssueFormView(
        viewModel: ReportIssueFormViewModel { _, _ in true }
    ) {}
}
