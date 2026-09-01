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

    public var body: some View {
        WizardShell(model: viewModel, identity: .business) {
            stepContent
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
        .accessibilityIdentifier("createBusinessWizard")
    }

    @ViewBuilder
    private var stepContent: some View {
        switch viewModel.currentStep {
        case .pickCategory:
            if viewModel.isSearchActive {
                PickCategorySearchStep(viewModel: viewModel)
            } else {
                PickCategoryStep(viewModel: viewModel)
            }
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
            onOpenBusiness(businessId)
        }
        viewModel.acknowledgePendingEvent()
    }
}

#Preview {
    CreateBusinessWizardView(
        onClose: {},
        onOpenBusiness: { _ in }
    )
}
