//
//  LegalInfoStep.swift
//  Pantopus
//
//  Create Business step 2 — Basic info Form (name, username, email,
//  optional description). Composed with Wizard + Form tokens.
//

import SwiftUI

struct LegalInfoStep: View {
    @Bindable var viewModel: CreateBusinessWizardViewModel

    var body: some View {
        BusinessIdentityChip()
        HeadlineBlock(
            "Basic info",
            subtitle: "Tell us about your business. Username must be unique."
        )
        FormFieldsBlock {
            PantopusTextField(
                "Business name",
                text: Binding(
                    get: { viewModel.businessName },
                    set: { viewModel.setBusinessName($0) }
                ),
                placeholder: "My Business",
                isRequired: true,
                contentType: .organizationName,
                identifier: "createBusiness_name"
            )
            VStack(alignment: .leading, spacing: Spacing.s1) {
                PantopusTextField(
                    "Username",
                    text: Binding(
                        get: { viewModel.username },
                        set: { viewModel.setUsername($0) }
                    ),
                    placeholder: "mybusiness",
                    state: usernameFieldState,
                    isRequired: true,
                    contentType: .username,
                    identifier: "createBusiness_username"
                )
                usernameStatusRow
            }
            PantopusTextField(
                "Email",
                text: Binding(
                    get: { viewModel.email },
                    set: { viewModel.setEmail($0) }
                ),
                placeholder: "business@email.com",
                isRequired: true,
                keyboardType: .emailAddress,
                contentType: .emailAddress,
                identifier: "createBusiness_email"
            )
            PantopusTextField(
                "Description",
                text: Binding(
                    get: { viewModel.descriptionText },
                    set: { viewModel.setDescription($0) }
                ),
                placeholder: "What does your business do?",
                identifier: "createBusiness_description"
            )
        }
        if let submitError = viewModel.submitError, viewModel.currentStep == .legalInfo {
            Text(submitError)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("createBusinessSubmitError")
        }
    }

    private var usernameFieldState: PantopusFieldState {
        switch viewModel.usernameStatus {
        case .available:
            .valid
        case let .unavailable(reason):
            .error(usernameReasonLabel(reason))
        case .idle, .checking:
            .default
        }
    }

    @ViewBuilder
    private var usernameStatusRow: some View {
        if viewModel.username.count >= 3 {
            switch viewModel.usernameStatus {
            case .checking:
                Text("Checking…")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            case .available:
                HStack(spacing: Spacing.s1) {
                    Icon(.checkCircle, size: 14, color: Theme.Color.success)
                    Text("Available")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.success)
                }
            case let .unavailable(reason):
                HStack(spacing: Spacing.s1) {
                    Icon(.xCircle, size: 14, color: Theme.Color.error)
                    Text(usernameReasonLabel(reason))
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                }
            case .idle:
                EmptyView()
            }
        }
    }

    private func usernameReasonLabel(_ reason: String?) -> String {
        switch reason {
        case "reserved": "Reserved username"
        case "taken": "Already taken"
        default: "Invalid username"
        }
    }
}
