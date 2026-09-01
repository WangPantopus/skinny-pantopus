//
//  TransactionReviewSheetView.swift
//  Pantopus
//
//  BLOCK 2D — Marketplace transaction reviews. A multi-criteria review
//  sheet cloned from `MyBids/LeaveReviewSheetView.swift` and extended with
//  the three optional sub-ratings (communication / accuracy / punctuality).
//  POSTs to `/api/transaction-reviews`
//  (route `backend/routes/transactionReviews.js:43`). The overall rating is
//  required (1–5 stars); the comment + sub-ratings are optional. The host
//  owns the network round-trip and returns a typed result so the sheet can
//  render the submitted confirmation or the inline "already reviewed" notice.
//

import SwiftUI

/// Presentation target for the transaction-review sheet. Carries the ids the
/// backend needs per context (`offer_id` for a listing sale) plus the other
/// party + a title used in the header copy.
public struct TransactionReviewSheetTarget: Identifiable, Sendable, Hashable {
    public let id: String
    public let context: TransactionReviewContext
    public let reviewedId: String
    public let reviewedName: String?
    public let transactionTitle: String
    public let listingId: String?
    public let offerId: String?
    public let tradeId: String?
    public let gigId: String?

    public init(
        id: String,
        context: TransactionReviewContext,
        reviewedId: String,
        reviewedName: String? = nil,
        transactionTitle: String,
        listingId: String? = nil,
        offerId: String? = nil,
        tradeId: String? = nil,
        gigId: String? = nil
    ) {
        self.id = id
        self.context = context
        self.reviewedId = reviewedId
        self.reviewedName = reviewedName
        self.transactionTitle = transactionTitle
        self.listingId = listingId
        self.offerId = offerId
        self.tradeId = tradeId
        self.gigId = gigId
    }
}

/// Draft pushed back to the host. The overall `rating` is `1...5`; each
/// sub-rating is `nil` when the user left it untouched.
public struct TransactionReviewDraft: Sendable, Equatable {
    public let rating: Int
    public let comment: String?
    public let communicationRating: Int?
    public let accuracyRating: Int?
    public let punctualityRating: Int?

    public init(
        rating: Int,
        comment: String?,
        communicationRating: Int?,
        accuracyRating: Int?,
        punctualityRating: Int?
    ) {
        self.rating = rating
        self.comment = comment
        self.communicationRating = communicationRating
        self.accuracyRating = accuracyRating
        self.punctualityRating = punctualityRating
    }
}

/// Outcome of the host's POST. The duplicate case is surfaced inline; the
/// failure case carries a user-facing message.
public enum TransactionReviewSubmitResult: Sendable, Equatable {
    case submitted
    case duplicate
    case failed(String)
}

/// Sheet-presented multi-criteria review form. The host owns the POST
/// round-trip via `onSubmit`; `onClose` tears the sheet down.
@MainActor
public struct TransactionReviewSheetView: View {
    public typealias Submit = @MainActor (TransactionReviewDraft) async -> TransactionReviewSubmitResult

    private let target: TransactionReviewSheetTarget
    private let onSubmit: Submit
    private let onClose: @MainActor () -> Void

    @State private var rating = 0
    @State private var comment = ""
    @State private var communication = 0
    @State private var accuracy = 0
    @State private var punctuality = 0
    @State private var submitting = false
    @State private var submitted = false
    @State private var duplicate = false
    @State private var errorText: String?

    public init(
        target: TransactionReviewSheetTarget,
        onSubmit: @escaping Submit,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.target = target
        self.onSubmit = onSubmit
        self.onClose = onClose
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                if submitted {
                    TxnReviewSubmittedView(onClose: onClose)
                } else {
                    formBody
                }
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("txnReview.sheet")
    }

    // MARK: - Form

    private var formBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            header
            overallRating
            subRatings
            commentField
            if duplicate {
                duplicateNotice
            }
            if let errorText, !errorText.isEmpty {
                Text(errorText)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("txnReview.error")
            }
            actions
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Leave a review")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(headerCopy)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var headerCopy: String {
        if let name = target.reviewedName, !name.isEmpty {
            return "How did your \(target.context.shortLabel.lowercased()) with \(name) go on "
                + "\(target.transactionTitle)? Your review helps the neighborhood."
        }
        return "How did this go on \(target.transactionTitle)? Your review helps the neighborhood."
    }

    private var overallRating: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Overall rating")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            TxnReviewStarRow(rating: rating, idPrefix: "txnReview.overallStars") { rating = $0 }
                .accessibilityIdentifier("txnReview.overallStars")
            Text(ratingHint)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .accessibilityIdentifier("txnReview.ratingHint")
        }
    }

    private var ratingHint: String {
        switch rating {
        case 0: "Tap a star to rate"
        case 1: "Poor"
        case 2: "Below average"
        case 3: "Average"
        case 4: "Good"
        default: "Excellent"
        }
    }

    private var subRatings: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Rate the details (optional)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            subRatingRow(
                title: "Communication",
                rating: communication,
                tag: "txnReview.subRating.communication"
            ) { communication = $0 }
            subRatingRow(
                title: "Item accuracy",
                rating: accuracy,
                tag: "txnReview.subRating.accuracy"
            ) { accuracy = $0 }
            subRatingRow(
                title: "Punctuality",
                rating: punctuality,
                tag: "txnReview.subRating.punctuality"
            ) { punctuality = $0 }
        }
    }

    private func subRatingRow(
        title: String,
        rating value: Int,
        tag: String,
        onSelect: @escaping (Int) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(title)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appText)
            TxnReviewStarRow(rating: value, idPrefix: tag, starSize: 24, onSelect: onSelect)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(tag)
    }

    private var commentField: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Comment (optional)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            TextField("Anything the neighborhood should know?", text: $comment, axis: .vertical)
                .lineLimit(3...6)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .frame(minHeight: 44, alignment: .topLeading)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .accessibilityIdentifier("txnReview.comment")
        }
    }

    private var duplicateNotice: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 18, strokeWidth: 2, color: Theme.Color.appTextSecondary)
            Text("You already reviewed this transaction.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("txnReview.duplicateNotice")
    }

    private var actions: some View {
        HStack(spacing: Spacing.s2) {
            Button {
                onClose()
            } label: {
                Text("Cancel")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.vertical, Spacing.s3)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
            .disabled(submitting)
            .accessibilityIdentifier("txnReview.cancel")

            Button {
                Task { await submit() }
            } label: {
                Group {
                    if submitting {
                        ProgressView().tint(Theme.Color.appTextInverse)
                    } else {
                        Text("Submit review")
                            .pantopusTextStyle(.body)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                }
                .padding(.vertical, Spacing.s3)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(canSubmit ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                )
            }
            .buttonStyle(.plain)
            .disabled(!canSubmit || submitting)
            .accessibilityIdentifier("txnReview.submit")
        }
    }

    // MARK: - Helpers

    private var canSubmit: Bool {
        rating >= 1 && rating <= 5 && !duplicate
    }

    private func submit() async {
        guard canSubmit else { return }
        submitting = true
        defer { submitting = false }
        errorText = nil
        let trimmed = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        let draft = TransactionReviewDraft(
            rating: rating,
            comment: trimmed.isEmpty ? nil : trimmed,
            communicationRating: communication >= 1 ? communication : nil,
            accuracyRating: accuracy >= 1 ? accuracy : nil,
            punctualityRating: punctuality >= 1 ? punctuality : nil
        )
        switch await onSubmit(draft) {
        case .submitted:
            submitted = true
        case .duplicate:
            duplicate = true
        case let .failed(message):
            errorText = message
        }
    }
}

// MARK: - Extracted subviews

/// Tappable 1–5 star row. Pure (params only), so it lives outside the sheet
/// struct to keep the main type small.
private struct TxnReviewStarRow: View {
    let rating: Int
    let idPrefix: String
    var starSize: CGFloat = 32
    let onSelect: (Int) -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(1...5, id: \.self) { star in
                let isSelected = star <= rating
                Button {
                    onSelect(star)
                } label: {
                    Icon(
                        .star,
                        size: starSize,
                        strokeWidth: isSelected ? 3 : 2,
                        color: isSelected ? Theme.Color.warning : Theme.Color.appBorderStrong
                    )
                    .frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(star) star\(star == 1 ? "" : "s")")
                .accessibilityAddTraits(rating == star ? .isSelected : [])
                .accessibilityIdentifier("\(idPrefix).star.\(star)")
            }
        }
    }
}

/// Post-submit confirmation shown in place of the form.
private struct TxnReviewSubmittedView: View {
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.checkCheck, size: 44, strokeWidth: 2, color: Theme.Color.success)
            Text("Review submitted")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("Thanks — your review helps neighbors trade with confidence.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                onClose()
            } label: {
                Text("Done")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.vertical, Spacing.s3)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .fill(Theme.Color.primary600)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("txnReview.done")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s5)
        .accessibilityIdentifier("txnReview.submittedView")
    }
}

#Preview {
    TransactionReviewSheetView(
        target: TransactionReviewSheetTarget(
            id: "preview",
            context: .listingSale,
            reviewedId: "u_buyer",
            reviewedName: "Maria",
            transactionTitle: "Mid-century walnut credenza",
            listingId: "l_preview",
            offerId: "o_preview"
        ),
        onSubmit: { _ in .submitted },
        onClose: {}
    )
    .background(Theme.Color.appBg)
}
