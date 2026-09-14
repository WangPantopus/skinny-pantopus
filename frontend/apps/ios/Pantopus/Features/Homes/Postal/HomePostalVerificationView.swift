import SwiftUI
import UIKit

@MainActor
struct HomePostalVerificationView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var viewModel: HomePostalViewModel
    @State private var visible = false
    @State private var confirmsMail = false
    @State private var confirmsCancellation = false
    private let onClose: () -> Void
    private let onNavigate: (HomePostalNavigation) -> Void

    init(viewModel: HomePostalViewModel, onClose: @escaping () -> Void, onNavigate: @escaping (HomePostalNavigation) -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
        self.onNavigate = onNavigate
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s5) {
                Text("Verify your address by mail").pantopusTextStyle(.h2)
                Text("A saved mailing request or code result is separate from your current household access.")
                    .pantopusTextStyle(.body).foregroundStyle(Theme.Color.appTextSecondary)
                if let error = viewModel.error {
                    Text(error).pantopusTextStyle(.body).accessibilityIdentifier("homePostalError")
                }
                if let draft = viewModel.pending {
                    recovery(draft)
                } else if viewModel.isWorking {
                    ProgressView("Checking mail verification…").accessibilityIdentifier("homePostalLoading")
                } else if let status = viewModel.status {
                    currentStatus(status)
                } else {
                    Button("Retry mail status") { Task { await viewModel.open() } }
                        .frame(minHeight: 44)
                        .accessibilityIdentifier("homePostalRetry")
                }
            }
            .padding(Spacing.s5)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollDismissesKeyboard(.interactively)
        .submitLabel(.done)
        .onSubmit(dismissKeyboard)
        .background(Theme.Color.appBg)
        .navigationTitle("Mail verification")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden()
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Back", action: onClose).accessibilityIdentifier("homePostalBack")
            }
        }
        .accessibilityIdentifier("homePostalVerification")
        .task { visible = true
            await viewModel.open()
        }
        .onDisappear { visible = false
            retire()
        }
        .onChange(of: scenePhase) { _, phase in
            guard visible else { return }
            if phase == .active { Task { await viewModel.open() } } else { retire() }
        }
        .onChange(of: viewModel.isCurrent) { _, current in
            if !current { retire()
                Task { await viewModel.open() }
            }
        }
        .confirmationDialog("Request a postcard to this address?", isPresented: $confirmsMail, titleVisibility: .visible) {
            Button("Request postcard") { Task { await viewModel.requestMail() } }
                .accessibilityIdentifier("homePostalConfirmMail")
        } message: {
            Text(addressLabel(viewModel.address.body))
        }
        .confirmationDialog("Cancel the original request?", isPresented: $confirmsCancellation, titleVisibility: .visible) {
            Button("Confirm cancellation", role: .destructive) { Task { await viewModel.recover(.cancel) } }
                .accessibilityIdentifier("homePostalConfirmCancel")
        } message: {
            Text("We will check the original result. Cancellation cannot undo a recorded verification or an already admitted mailing.")
        }
    }

    private func retire() {
        confirmsMail = false
        confirmsCancellation = false
        dismissKeyboard()
        viewModel.suspend()
    }

    @ViewBuilder
    private func recovery(_ draft: PendingHomePostalCommand) -> some View {
        let result = viewModel.outcome
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(HomePostalMessages.headline(kind: draft.kind, outcome: result)).pantopusTextStyle(.h3)
                .accessibilityIdentifier("homePostalRecoveryHeading")
            if draft.kind == .mail, let address = draft.body.dictValue?["address"] {
                Text(addressLabel(address)).pantopusTextStyle(.body).accessibilityIdentifier("homePostalSavedAddress")
            } else {
                Text("Your original code attempt is saved securely. Its code is hidden here.").pantopusTextStyle(.body)
            }
            Text(HomePostalMessages.explanation(kind: draft.kind, outcome: result)).pantopusTextStyle(.body)
            if viewModel.isWorking { ProgressView("Checking the original request…") }
            if viewModel.canAcknowledge {
                Button(result?.state == "completed" ? "Check current status" : "Edit after recorded result") {
                    Task { await viewModel.acknowledge() }
                }
                .frame(minHeight: 44).accessibilityIdentifier("homePostalAcknowledge")
            } else if result?.isTerminal == true {
                Button("Retry saving the result") { Task { await viewModel.recover(.check) } }
                    .frame(minHeight: 44).disabled(viewModel.isWorking).accessibilityIdentifier("homePostalSaveProof")
            } else {
                Button("Check original result") { Task { await viewModel.recover(.check) } }
                    .frame(minHeight: 44).disabled(viewModel.isWorking).accessibilityIdentifier("homePostalCheckOriginal")
                Button("Retry the same request") { Task { await viewModel.recover(.submit) } }
                    .frame(minHeight: 44).disabled(viewModel.isWorking).accessibilityIdentifier("homePostalRetryOriginal")
                Button("Cancel request") { confirmsCancellation = true }
                    .frame(minHeight: 44).disabled(viewModel.isWorking).accessibilityIdentifier("homePostalCancel")
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }

    @ViewBuilder
    private func currentStatus(_ status: HomePostalStatus) -> some View {
        if let postcard = status.postcard {
            Text(HomePostalMessages.delivery(postcard["delivery"]?.stringValue)).pantopusTextStyle(.h3)
                .accessibilityIdentifier("homePostalDelivery")
            Text("Postcard status: \(postcard["status"]?.stringValue ?? "unavailable")").pantopusTextStyle(.body)
            if postcard["status"]?.stringValue == "pending", let count = postcard["attempts_remaining"]?.numberValue {
                Text("\(Int(count)) code attempts remaining").pantopusTextStyle(.caption)
                    .accessibilityIdentifier("homePostalAttemptsRemaining")
            }
        } else {
            Text("No postcard request is recorded.").pantopusTextStyle(.body)
        }
        if let restriction = status.restriction {
            Text(HomePostalMessages.restriction(restriction)).pantopusTextStyle(.body)
                .accessibilityIdentifier("homePostalRestriction")
        }
        if status.canResume, let original = status.originalRequest, let address = original["address"] {
            Text("Continue the original mailing request").pantopusTextStyle(.h3)
            Text(addressLabel(address)).pantopusTextStyle(.body).accessibilityIdentifier("homePostalResumeAddress")
            Button("Continue this original request") { Task { await viewModel.resumeMail() } }
                .frame(minHeight: 44).disabled(!viewModel.canResumeMail).accessibilityIdentifier("homePostalResume")
        }
        if status.canRequest { mailingForm }
        if status.canVerify { codeForm }
        if let progress = viewModel.progress {
            Text(progress.title).pantopusTextStyle(.h3).accessibilityIdentifier("homePostalResidencyHeading")
            Text(progress.explanation).pantopusTextStyle(.body).foregroundStyle(Theme.Color.appTextSecondary)
            if viewModel.permits(.home) { navigation("Open Home", .home) }
            if viewModel.permits(.ownership) { navigation("Continue ownership verification", .ownership) }
            if viewModel.permits(.addHome) { navigation("Review address in Add Home", .addHome) }
            if viewModel.permits(.residency) { navigation("Check residency status", .residency) }
        }
        Button("Refresh mail status") { Task { await viewModel.refresh() } }
            .frame(minHeight: 44)
            .accessibilityIdentifier("homePostalRefresh")
    }

    private var mailingForm: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Confirm your mailing address").pantopusTextStyle(.h3)
            PantopusTextField(
                "Street address",
                text: $viewModel.address.line1,
                isRequired: true,
                contentType: .streetAddressLine1,
                identifier: "homePostalLine1"
            )
            PantopusTextField(
                "Apartment or unit (optional)",
                text: $viewModel.address.line2,
                contentType: .streetAddressLine2,
                identifier: "homePostalLine2"
            )
            PantopusTextField(
                "City",
                text: $viewModel.address.city,
                isRequired: true,
                contentType: .addressCity,
                identifier: "homePostalCity"
            )
            PantopusTextField(
                "State",
                text: $viewModel.address.state,
                isRequired: true,
                contentType: .addressState,
                identifier: "homePostalState"
            )
            PantopusTextField(
                "ZIP or postal code",
                text: $viewModel.address.postalCode,
                isRequired: true,
                contentType: .postalCode,
                identifier: "homePostalZip"
            )
            PantopusTextField(
                "Country",
                text: $viewModel.address.country,
                isRequired: true,
                contentType: .countryName,
                identifier: "homePostalCountry"
            )
            Text("Include your apartment or unit. The complete address is checked before mailing.").pantopusTextStyle(.caption)
            PrimaryButton(title: "Request postcard", isEnabled: viewModel.canRequestMail) { confirmsMail = true }
                .accessibilityIdentifier("homePostalRequestMail")
        }
        .autocorrectionDisabled()
    }

    private var codeForm: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Enter the code from this postcard").pantopusTextStyle(.h3)
            PantopusTextField(
                "Postcard code",
                text: $viewModel.codeInput,
                isRequired: true,
                keyboardType: .asciiCapable,
                identifier: "homePostalCode"
            )
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled()
            PrimaryButton(title: "Verify this code", isEnabled: viewModel.canVerifyCode) { await viewModel.verifyCode() }
                .accessibilityIdentifier("homePostalVerifyCode")
        }
    }

    private func dismissKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    private func navigation(_ title: String, _ destination: HomePostalNavigation) -> some View {
        Button(title) { if viewModel.permits(destination) { onNavigate(destination) } }
            .frame(minHeight: 44)
            .accessibilityIdentifier("homePostalCurrentAction")
    }

    private func addressLabel(_ value: JSONValue) -> String {
        guard let address = HomePostalValidation.address(value) else { return "The original address could not be checked." }
        return [address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
            .filter { !$0.isEmpty }.joined(separator: ", ")
    }
}
