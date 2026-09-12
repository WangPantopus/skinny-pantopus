import SwiftUI

struct AddHomeCreationRecoveryView: View {
    @Bindable var viewModel: AddHomeWizardViewModel
    @State private var confirmsCancellation = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HeadlineBlock(headline)
            SubcopyBlock(explanation)
            if let draft = viewModel.pendingCreation {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text(draft.form.details.nickname.isEmpty ? "Your Home request" : draft.form.details.nickname)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Text([
                        draft.form.address.street,
                        draft.form.address.unit,
                        draft.form.address.city,
                        draft.form.address.state,
                        draft.form.address.zipCode
                    ].filter { !$0.isEmpty }.joined(separator: ", "))
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    if let role = draft.form.role { Text(role.label).pantopusTextStyle(.caption) }
                    let count = draft.body.dictValue?["access_secrets"]?.arrayValue?.count ?? 0
                    if count > 0 {
                        Text("\(count) access \(count == 1 ? "detail" : "details") included")
                            .pantopusTextStyle(.caption)
                    }
                }
                .padding(Spacing.s4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            }
            if viewModel.creationOutcome?.isTerminal != true, viewModel.pendingCreation != nil {
                Button("Check status", action: viewModel.checkCreationStatus)
                    .frame(minHeight: 44)
                    .disabled(viewModel.isSubmitting)
                    .accessibilityIdentifier("addHomeRecoveryCheck")
                Button("Cancel request", role: .destructive) { confirmsCancellation = true }
                    .frame(minHeight: 44)
                    .disabled(viewModel.isSubmitting)
                    .accessibilityIdentifier("addHomeRecoveryCancel")
            }
            Text("The original details are saved securely on this device. You can close this screen and return to Add Home.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("addHomeCreationRecovery")
        .confirmationDialog("Cancel this Home request?", isPresented: $confirmsCancellation, titleVisibility: .visible) {
            Button("Cancel request", role: .destructive, action: viewModel.cancelCreation)
                .accessibilityIdentifier("addHomeRecoveryCancelConfirm")
            Button("Keep request", role: .cancel) {}
        } message: {
            Text(
                "We’ll check whether it has finished. If the Home was saved, you’ll see that result. Cancelling won’t delete the Home."
            )
        }
    }

    private var headline: String {
        if viewModel.creationStorageUnavailable { return "Recover your saved request" }
        switch viewModel.creationOutcome?.state {
        case .completed: return "Home saved"
        case .cancelled: return "Request cancelled"
        case .rejected: return "Review your Home details"
        case .pending, nil: return "Finish adding your Home"
        }
    }

    private var explanation: String {
        if viewModel.creationStorageUnavailable {
            return "Recovery storage is unavailable. Retry recovery before making another Home request."
        }
        switch viewModel.creationOutcome?.state {
        case .completed:
            return "Open My Homes to see your current setup and verification options. Saving a Home does not verify residency or ownership."
        case .cancelled:
            return "This request can no longer create a Home. You can edit its details and start again."
        case .rejected:
            return viewModel.creationOutcome?.error ?? "The server rejected this request. Review its details before trying again."
        case .pending, nil:
            return "The save has not been confirmed. Check its status, try saving the same details again, "
                + "or cancel the request before editing."
        }
    }
}
