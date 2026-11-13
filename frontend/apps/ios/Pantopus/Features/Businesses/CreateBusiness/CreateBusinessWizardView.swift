//
//  CreateBusinessWizardView.swift
//  Pantopus
//
//  A12.10 — wraps `WizardShell` with the four create-business steps and
//  threads `WizardIdentity.business` through so the progress rail and
//  the primary CTA render in violet.
//

import SwiftUI

@MainActor
public struct CreateBusinessWizardView: View {
    @State private var viewModel: CreateBusinessWizardViewModel
    @State private var createdBusinessId: String?
    @State private var showsCreationWarning = false
    private let onClose: @MainActor () -> Void
    private let onOpenBusiness: @MainActor (String) -> Void

    init(
        api: APIClient = .shared,
        onClose: @escaping @MainActor () -> Void,
        onOpenBusiness: @escaping @MainActor (String) -> Void
    ) {
        _viewModel = State(initialValue: CreateBusinessWizardViewModel(api: api))
        self.onClose = onClose
        self.onOpenBusiness = onOpenBusiness
    }

    /// The scroll target each step puts on its error sentence.
    static let submitErrorID = "createBusinessSubmitError"

    public var body: some View {
        ScrollViewReader { proxy in
            WizardShell(model: viewModel, identity: .business, scrollResetID: viewModel.currentStep) {
                stepContent
            }
            // The error sits under the step's last section, often behind the bottom buttons. Bring it
            // into view and read it out, so a refused Publish doesn't look like nothing happened.
            .onChange(of: viewModel.submitError) { _, error in
                guard let error else { return }
                Task { @MainActor in
                    withAnimation { proxy.scrollTo(Self.submitErrorID, anchor: .bottom) }
                    AccessibilityNotification.Announcement(error).post()
                }
            }
            .onChange(of: viewModel.pendingEvent) { _, event in
                handle(event)
            }
            .onChange(of: viewModel.currentStep) { _, step in
                Analytics.track(.screenCreateBusinessStepViewed(
                    stepNumber: step.stepNumber,
                    stepName: step.rawValue
                ))
            }
            .onAppear {
                Analytics.track(.screenCreateBusinessStepViewed(
                    stepNumber: viewModel.currentStep.stepNumber,
                    stepName: viewModel.currentStep.rawValue
                ))
            }
            .alert("Business created", isPresented: $showsCreationWarning) {
                Button("Open business") {
                    guard let businessId = createdBusinessId else { return }
                    createdBusinessId = nil
                    onOpenBusiness(businessId)
                }
            } message: {
                Text(viewModel.creationWarning ?? "")
            }
            .accessibilityIdentifier("createBusinessWizard")
        }
    }

    @ViewBuilder
    private var stepContent: some View {
        switch viewModel.currentStep {
        case .pickCategory:
            PickCategoryStep(viewModel: viewModel)
        case .legalInfo:
            LegalInfoStep(viewModel: viewModel)
        case .profile:
            ProfileStep(viewModel: viewModel)
        case .confirm:
            ConfirmStep(viewModel: viewModel)
        }
    }

    private func handle(_ event: CreateBusinessOutboundEvent?) {
        guard let event else { return }
        switch event {
        case .dismiss:
            onClose()
        case let .openBusinessDashboard(businessId):
            if viewModel.creationWarning != nil {
                createdBusinessId = businessId
                showsCreationWarning = true
            } else {
                onOpenBusiness(businessId)
            }
        }
        viewModel.acknowledgePendingEvent()
    }
}

/// The sentence a step shows when a check or the server refuses it. It carries `submitErrorID`, so the wizard can
/// scroll to it on any step.
struct CreateBusinessSubmitError: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 13))
            .foregroundStyle(Theme.Color.error)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier("createBusinessSubmitError")
            .id(CreateBusinessWizardView.submitErrorID)
    }
}

#Preview {
    CreateBusinessWizardView(
        onClose: {},
        onOpenBusiness: { _ in }
    )
}
