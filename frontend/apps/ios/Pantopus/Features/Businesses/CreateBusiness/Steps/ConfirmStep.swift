//
//  ConfirmStep.swift
//  Pantopus
//
//  Create Business step 4 — review summary + Confirm CTA (wired in the
//  wizard chrome via create-full).
//

import SwiftUI

struct ConfirmStep: View {
    @Bindable var viewModel: CreateBusinessWizardViewModel

    var body: some View {
        BusinessIdentityChip()
        HeadlineBlock(
            "Confirm and create",
            subtitle: "Publish takes your business live. Save as draft keeps it hidden until you're ready."
        )
        ReviewSummaryBlock(summaryRows)
        if let warning = viewModel.logoUploadWarning {
            Text(warning)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.warning)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("createBusinessLogoWarning")
        }
        if let submitError = viewModel.submitError, viewModel.currentStep == .confirm {
            Text(submitError)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("createBusinessSubmitError")
        }
    }

    private var summaryRows: [ReviewSummaryRow] {
        var rows: [ReviewSummaryRow] = [
            ReviewSummaryRow(label: "Category", value: viewModel.selectedCategoryId?.label ?? "—"),
            ReviewSummaryRow(
                label: "Name",
                value: viewModel.businessName.trimmingCharacters(in: .whitespacesAndNewlines)
            ),
            ReviewSummaryRow(label: "Username", value: "@\(viewModel.cleanedUsername)"),
            ReviewSummaryRow(
                label: "Email",
                value: viewModel.email.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        ]
        let desc = viewModel.descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !desc.isEmpty {
            rows.append(ReviewSummaryRow(label: "Description", value: desc))
        }
        let locationValue: String = {
            guard viewModel.hasLocation else { return "Not set" }
            let street = viewModel.address.trimmingCharacters(in: .whitespacesAndNewlines)
            let city = viewModel.city.trimmingCharacters(in: .whitespacesAndNewlines)
            return "\(street), \(city)"
        }()
        rows.append(ReviewSummaryRow(label: "Location", value: locationValue))
        rows.append(
            ReviewSummaryRow(
                label: "Hours",
                value: viewModel.hasLocation && !viewModel.hoursSkipped ? "Weekday defaults" : "Not set"
            )
        )
        rows.append(
            ReviewSummaryRow(
                label: "Logo",
                value: viewModel.logoPick != nil && !viewModel.logoSkipped ? "Selected" : "Not set"
            )
        )
        return rows
    }
}
