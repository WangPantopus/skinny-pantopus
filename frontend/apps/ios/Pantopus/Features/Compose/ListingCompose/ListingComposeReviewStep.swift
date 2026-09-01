//
//  ListingComposeReviewStep.swift
//  Pantopus
//
//  Review and success step components for the Snap & Sell listing wizard.
//

import SwiftUI

struct ListingComposeReviewStep: View {
    @Bindable var viewModel: ListingComposeWizardViewModel

    var body: some View {
        HeadlineBlock("Review & list")
        SubcopyBlock("Take one last look — you can edit after listing.")
        ReviewSummaryBlock(rows)
    }

    private var rows: [ReviewSummaryRow] {
        var summary: [ReviewSummaryRow] = [
            ReviewSummaryRow(label: "Photos", value: photoSummary),
            ReviewSummaryRow(label: "Title", value: viewModel.trimmedTitle),
            ReviewSummaryRow(label: "Category", value: viewModel.form.category?.label ?? "—")
        ]
        if let condition = viewModel.form.condition {
            summary.append(ReviewSummaryRow(label: "Condition", value: condition.label))
        }
        summary.append(
            ReviewSummaryRow(
                label: "Description",
                value: viewModel.trimmedDescription
            )
        )
        summary.append(ReviewSummaryRow(label: "Price", value: priceSummary))
        summary.append(ReviewSummaryRow(label: "Fulfillment", value: viewModel.form.fulfillment.label))
        summary.append(ReviewSummaryRow(label: "Location", value: locationSummary))
        return summary
    }

    private var photoSummary: String {
        let count = viewModel.form.photos.count
        if count == 0 { return "0 photos" }
        return "\(count) photo\(count == 1 ? "" : "s") (hero first)"
    }

    private var priceSummary: String {
        guard let kind = viewModel.form.priceKind else { return "—" }
        switch kind {
        case .free: return "Free"
        case .fixed:
            return viewModel.form.priceAmount.isEmpty ? "—" : "$\(viewModel.form.priceAmount)"
        case .negotiable:
            return viewModel.form.priceAmount.isEmpty
                ? "Open to offers"
                : "$\(viewModel.form.priceAmount) · open to offers"
        }
    }

    private var locationSummary: String {
        guard let kind = viewModel.form.locationKind else { return "—" }
        switch kind {
        case .savedAddress: return kind.label
        case .meetPoint:
            return viewModel.form.locationLabel.isEmpty
                ? kind.label
                : "\(kind.label) · \(viewModel.form.locationLabel)"
        }
    }
}

struct ListingComposeSuccessStep: View {
    var body: some View {
        SuccessHeroBlock(
            headline: "Your listing is live",
            subcopy: "Neighbors can find it in Marketplace now. We'll notify you when an offer comes in."
        )
    }
}
