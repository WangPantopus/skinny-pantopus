//
//  ReportIssueFormViewModel.swift
//  Pantopus
//
//  Backs `ReportIssueFormView` — the "Report Issue" create form of the
//  per-home issue tracker. Mirrors RN's inline create form
//  (`src/app/homes/[id]/maintenance.tsx:53`): a required title and an
//  optional description, POSTed to `/api/homes/:id/issues`
//  (`backend/routes/home.js:4420`).
//
//  The network call itself is injected by the list screen so the create
//  and the subsequent refetch stay owned by `HomeIssuesListViewModel`.
//

import Foundation
import Observation

@Observable
@MainActor
final class ReportIssueFormViewModel {
    var title: String = ""
    var issueDescription: String = ""
    private(set) var isSubmitting = false
    private(set) var errorMessage: String?
    private(set) var shouldDismiss = false

    private let submit: @MainActor (String, String?) async -> Bool

    init(submit: @escaping @MainActor (String, String?) async -> Bool) {
        self.submit = submit
    }

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSubmitting
    }

    var isDirty: Bool {
        !title.isEmpty || !issueDescription.isEmpty
    }

    func commit() {
        guard isValid else { return }
        Task { await performSubmit() }
    }

    private func performSubmit() async {
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        let trimmedDescription = issueDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let created = await submit(
            title.trimmingCharacters(in: .whitespacesAndNewlines),
            trimmedDescription.isEmpty ? nil : trimmedDescription
        )
        if created {
            shouldDismiss = true
        } else {
            errorMessage = "Failed to create issue"
        }
    }

    func acknowledgeDismiss() {
        shouldDismiss = false
    }
}
