//
//  WizardCloseConfirm.swift
//  Pantopus
//
//  Reusable "discard your progress?" confirm dialog used by `WizardShell`
//  when the user taps the close X on a dirty step.
//

import SwiftUI

public extension View {
    /// Attach the wizard's discard-confirm action sheet. The shell shows
    /// this when the user taps X on a dirty step. P6c — wizards that can
    /// park their progress locally (`WizardDraftSaving`) pass
    /// `onSaveDraft` to add a "Save draft" action above Discard.
    func wizardCloseConfirm(
        isPresented: Binding<Bool>,
        onDiscard: @escaping () -> Void,
        onSaveDraft: (() -> Void)? = nil
    ) -> some View {
        confirmationDialog(
            "Discard your progress?",
            isPresented: isPresented,
            titleVisibility: .visible
        ) {
            if let onSaveDraft {
                Button("Save draft", action: onSaveDraft)
            }
            Button("Discard", role: .destructive, action: onDiscard)
            Button("Keep going", role: .cancel) {}
        } message: {
            Text(
                onSaveDraft == nil
                    ? "You'll lose what you've entered so far."
                    : "Save it as a draft to post later, or discard what you've entered."
            )
        }
    }
}
