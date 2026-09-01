//
//  ReceivedReviewsView.swift
//  Pantopus
//
//  BLOCK 2D — Marketplace transaction reviews. An embeddable "received
//  reviews" section for a profile: overall average (via the shared
//  `RatingDistribution`), the per-criterion breakdown, and the list of
//  received reviews. Self-loads via its own `ReceivedReviewsViewModel`, so a
//  host only passes a `userId`. Renders inline (no own scroll) — it lives
//  inside the profile's scroll container.
//

import SwiftUI

@MainActor
public struct ReceivedReviewsSection: View {
    @State private var viewModel: ReceivedReviewsViewModel

    public init(userId: String) {
        _viewModel = State(initialValue: ReceivedReviewsViewModel(userId: userId))
    }

    /// Test/preview seam: inject a pre-built view-model.
    init(viewModel: ReceivedReviewsViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Marketplace reviews")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .task { await viewModel.load() }
        .accessibilityIdentifier("txnReview.receivedSection")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingView
        case .empty:
            emptyView
        case let .loaded(summary):
            loadedView(summary)
        case let .error(message):
            errorView(message)
        }
    }

    // MARK: - States

    private var loadingView: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(height: 84, cornerRadius: Radii.lg)
            ForEach(0..<2, id: \.self) { _ in
                Shimmer(height: 64, cornerRadius: Radii.lg)
            }
        }
        .accessibilityIdentifier("txnReview.loading")
    }

    private var emptyView: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.star, size: 22, strokeWidth: 2, color: Theme.Color.appTextMuted)
            Text("No marketplace reviews yet.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("txnReview.empty")
    }

    private func errorView(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Couldn't load reviews")
                .pantopusTextStyle(.body)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Retry")
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.primary600)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("txnReview.retry")
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("txnReview.error")
    }

    private func loadedView(_ summary: ReceivedReviewsSummary) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            RatingDistribution(
                average: summary.average,
                count: summary.total,
                distribution: summary.distribution
            )
            criterionBreakdown(summary)
            VStack(spacing: Spacing.s2) {
                ForEach(summary.rows) { row in
                    ReceivedReviewRowView(row: row)
                        .accessibilityIdentifier("txnReview.row.\(row.id)")
                }
            }
            .accessibilityIdentifier("txnReview.receivedList")
        }
    }

    @ViewBuilder
    private func criterionBreakdown(_ summary: ReceivedReviewsSummary) -> some View {
        if summary.communication != nil || summary.accuracy != nil || summary.punctuality != nil {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                if let value = summary.communication {
                    CriterionRow(title: "Communication", value: value)
                }
                if let value = summary.accuracy {
                    CriterionRow(title: "Item accuracy", value: value)
                }
                if let value = summary.punctuality {
                    CriterionRow(title: "Punctuality", value: value)
                }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("txnReview.criteria")
        }
    }
}

// MARK: - Criterion row

private struct CriterionRow: View {
    let title: String
    let value: CriterionAverage

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Text(title)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s2)
            StaticStarRow(rating: Int(value.average.rounded()))
            Text(String(format: "%.1f", value.average))
                .pantopusTextStyle(.small)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
                .monospacedDigit()
        }
    }
}

// MARK: - Review row

private struct ReceivedReviewRowView: View {
    let row: ReceivedReviewRow

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            avatar
            VStack(alignment: .leading, spacing: Spacing.s1) {
                HStack(spacing: Spacing.s2) {
                    Text(row.reviewerName)
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s1)
                    if !row.timestamp.isEmpty {
                        Text(row.timestamp)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
                StaticStarRow(rating: row.rating)
                if let comment = row.comment {
                    Text(comment)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                metaChips
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private var avatar: some View {
        ZStack {
            Circle().fill(Theme.Color.appSurfaceSunken)
            if let url = row.avatarURL {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    initialsText
                }
                .clipShape(Circle())
            } else {
                initialsText
            }
        }
        .frame(width: 36, height: 36)
        .clipShape(Circle())
    }

    private var initialsText: some View {
        Text(row.initials)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextSecondary)
    }

    private var metaChips: some View {
        HStack(spacing: Spacing.s2) {
            chip(row.contextLabel)
            if let role = row.roleLabel {
                chip(role)
            }
        }
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s1)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(Capsule())
    }
}

// MARK: - Static star row

private struct StaticStarRow: View {
    let rating: Int

    var body: some View {
        HStack(spacing: 1) {
            ForEach(0..<5, id: \.self) { index in
                Icon(
                    .star,
                    size: 12,
                    strokeWidth: 2,
                    color: index < rating ? Theme.Color.star : Theme.Color.appBorder
                )
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(rating) out of 5 stars")
    }
}

#Preview {
    ScrollView {
        ReceivedReviewsSection(userId: "preview")
            .padding(Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
