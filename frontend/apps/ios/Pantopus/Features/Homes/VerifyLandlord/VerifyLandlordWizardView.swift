//
//  VerifyLandlordWizardView.swift
//  Pantopus
//
//  Wraps `WizardShell` with the two verify-landlord steps (Start +
//  Details). On submit success the VM fires
//  `.openPostcardVerification` which the host nav stack converts into
//  a push of the standalone A12.7 sibling screen — see HubTabRoot.
//

import SwiftUI
import UniformTypeIdentifiers

/// Concrete verify-landlord wizard. Mirrors the
/// `ClaimOwnershipWizardView` shape so the two A12 wizards stay
/// interchangeable to host-stack callers.
@MainActor
public struct VerifyLandlordWizardView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var visible = false
    @State private var viewModel: VerifyLandlordWizardViewModel
    private let onClose: @MainActor () -> Void
    private let onOpenPostcardVerification: @MainActor (String) -> Void

    init(
        homeId: String,
        startContent: VerifyLandlordStartContent? = nil,
        onClose: @escaping @MainActor () -> Void,
        onOpenPostcardVerification: @escaping @MainActor (String) -> Void
    ) {
        _viewModel = State(initialValue: VerifyLandlordWizardViewModel(
            homeId: homeId,
            startContent: startContent
        ))
        self.onClose = onClose
        self.onOpenPostcardVerification = onOpenPostcardVerification
    }

    public var body: some View {
        WizardShell(model: viewModel) {
            stepContent
            if viewModel.currentStep == .details,
               let errors = viewModel.errors,
               !errors.isEmpty {
                StickyAttentionHint(count: errors.count)
            }
        }
        .onChange(of: viewModel.pendingEvent) { _, event in
            handle(event)
        }
        .onAppear {
            visible = true
            if scenePhase == .active { viewModel.resume() }
        }
        .onChange(of: scenePhase) { _, phase in
            guard visible else { return }
            if phase == .active {
                viewModel.resume()
            } else if phase == .background || !viewModel.attachment.showsPicker {
                viewModel.retirePendingWork()
            }
        }
        .onChange(of: viewModel.isCurrentSession) { _, current in if !current { viewModel.sessionChanged() } }
        .onDisappear { visible = false
            viewModel.retirePendingWork()
        }
        .accessibilityIdentifier("verifyLandlordWizard")
        .fileImporter(
            isPresented: Binding(
                get: { viewModel.attachment.showsPicker },
                set: { viewModel.attachment.showsPicker = $0 }
            ),
            allowedContentTypes: [.pdf, .plainText, .jpeg, .png, .webP, .heic, .heif],
            allowsMultipleSelection: false
        ) {
            viewModel.attachment.received($0)
        }
    }

    @ViewBuilder
    private var stepContent: some View {
        switch viewModel.currentStep {
        case .start:
            if let message = submitErrorMessage {
                VerifyErrorSummaryBanner(errors: .init(), serverMessage: message)
            }
            VerifyStartStep(content: viewModel.startContent)
        case .details:
            VerifyDetailsStep(viewModel: viewModel)
        case .sent:
            if let result = viewModel.approvalResult {
                VerifySentStep(result: result, errorMessage: submitErrorMessage)
            }
        }
    }

    /// Surfaces a failed mailed-code fallback under the sent panel
    /// rather than dropping it.
    private var submitErrorMessage: String? {
        if case let .error(message) = viewModel.submitState { return message }
        return nil
    }

    private func handle(_ event: VerifyLandlordOutboundEvent?) {
        guard let event else { return }
        switch event {
        case .dismiss:
            onClose()
        case let .openPostcardVerification(homeId):
            onOpenPostcardVerification(homeId)
        }
        viewModel.acknowledgePendingEvent()
    }
}

/// "2 fields need attention" sticky hint rendered above the disabled
/// CTA on the Details errors frame.
private struct StickyAttentionHint: View {
    let count: Int

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.alertCircle, size: 12, color: Theme.Color.error)
            Text("\(count) field\(count == 1 ? "" : "s") need attention")
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.error)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, Spacing.s2)
        .accessibilityIdentifier("verifyLandlordAttentionHint")
    }
}

#Preview {
    VerifyLandlordWizardView(
        homeId: "home-preview",
        onClose: {},
        onOpenPostcardVerification: { _ in }
    )
}
