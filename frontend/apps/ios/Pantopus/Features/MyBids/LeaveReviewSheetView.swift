//
//  LeaveReviewSheetView.swift
//  Pantopus
//
//  P3.4 — Review form, presented as a sheet from My Bids. POSTs to
//  `/api/reviews` (route `backend/routes/reviews.js:35`). Rating is
//  required (1–5 stars); the comment is optional.
//

import SwiftUI

/// Presentation target for the review sheet. Carries the IDs the
/// backend needs (`gig_id` + `reviewee_id`) plus the gig title used in
/// the header copy.
public struct LeaveReviewSheetTarget: Identifiable, Sendable, Hashable {
    public let id: String
    public let gigId: String
    public let revieweeId: String
    public let gigTitle: String
    public let revieweeName: String?

    public init(
        id: String,
        gigId: String,
        revieweeId: String,
        gigTitle: String,
        revieweeName: String? = nil
    ) {
        self.id = id
        self.gigId = gigId
        self.revieweeId = revieweeId
        self.gigTitle = gigTitle
        self.revieweeName = revieweeName
    }
}

/// Draft pushed back to the host. Rating is `1...5`.
public struct LeaveReviewDraft: Sendable, Equatable {
    public let rating: Int
    public let comment: String?

    public init(rating: Int, comment: String?) {
        self.rating = rating
        self.comment = comment
    }
}

/// Sheet-presented review form. The host owns the POST roundtrip.
@MainActor
public struct LeaveReviewSheetView: View {
    public typealias Submit = @MainActor (LeaveReviewDraft) async -> Bool

    private let target: LeaveReviewSheetTarget
    private let onSubmit: Submit
    private let onCancel: @MainActor () -> Void

    @State private var rating: Int = 0
    @State private var comment: String = ""
    @State private var submitting: Bool = false
    @State private var errorText: String?

    public init(
        target: LeaveReviewSheetTarget,
        onSubmit: @escaping Submit,
        onCancel: @escaping @MainActor () -> Void
    ) {
        self.target = target
        self.onSubmit = onSubmit
        self.onCancel = onCancel
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                header
                ratingPicker
                commentField
                if let errorText, !errorText.isEmpty {
                    Text(errorText)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityIdentifier("leave-review-error")
                }
                actions
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("leave-review-sheet")
    }

    // MARK: - Sections

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
        if let name = target.revieweeName, !name.isEmpty {
            return "How did \(name) do on \(target.gigTitle)? Your review helps the neighborhood."
        }
        return "How did this go on \(target.gigTitle)? Your review helps the neighborhood."
    }

    private var ratingPicker: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Rating")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                ForEach(1...5, id: \.self) { value in
                    let isSelected = value <= rating
                    Button {
                        rating = value
                    } label: {
                        Icon(
                            .star,
                            size: 32,
                            strokeWidth: isSelected ? 3 : 2,
                            color: isSelected ? Theme.Color.warning : Theme.Color.appBorderStrong
                        )
                        .frame(minWidth: 44, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(value) star\(value == 1 ? "" : "s")")
                    .accessibilityAddTraits(rating == value ? .isSelected : [])
                    .accessibilityIdentifier("leave-review-star-\(value)")
                }
            }
            // Canonical Android-parity anchor for the star row (the sheet
            // is shared between My Bids and the gig-detail review CTA).
            .accessibilityIdentifier("gigDetail.review.stars")
            Text(ratingHint)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .accessibilityIdentifier("leave-review-rating-hint")
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
                .accessibilityIdentifier("leave-review-comment")
        }
    }

    private var actions: some View {
        HStack(spacing: Spacing.s2) {
            Button {
                onCancel()
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
            .accessibilityIdentifier("leave-review-cancel")

            Button {
                Task { await submit() }
            } label: {
                Group {
                    if submitting {
                        ProgressView()
                            .tint(Theme.Color.appTextInverse)
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
            .accessibilityIdentifier("leave-review-submit")
        }
    }

    // MARK: - Helpers

    private var canSubmit: Bool {
        rating >= 1 && rating <= 5
    }

    private func submit() async {
        guard canSubmit else { return }
        submitting = true
        defer { submitting = false }
        errorText = nil
        let trimmed = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        let draft = LeaveReviewDraft(
            rating: rating,
            comment: trimmed.isEmpty ? nil : trimmed
        )
        let ok = await onSubmit(draft)
        if !ok {
            errorText = "Couldn't post your review. Try again in a moment."
        }
    }
}

#Preview {
    LeaveReviewSheetView(
        target: LeaveReviewSheetTarget(
            id: "preview",
            gigId: "g_preview",
            revieweeId: "u_owner",
            gigTitle: "Mount a TV",
            revieweeName: "Maria"
        ),
        onSubmit: { _ in true },
        onCancel: {}
    )
    .background(Theme.Color.appBg)
}
