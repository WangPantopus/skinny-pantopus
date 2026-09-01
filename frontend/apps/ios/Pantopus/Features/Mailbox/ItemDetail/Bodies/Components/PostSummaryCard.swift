//
//  PostSummaryCard.swift
//  Pantopus
//
//  Summary of the gig being bid on (A17.6). The whole card is tappable and
//  opens the gig detail thread. Shows a thumbnail with a category chip,
//  the title + posted/expires meta, budget/schedule chips, the details
//  blurb, and a bid-count footer.
//
// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

@MainActor
public struct PostSummaryCard: View {
    private let post: GigDetailDTO.Post
    private let onOpenGig: @MainActor () -> Void

    public init(post: GigDetailDTO.Post, onOpenGig: @escaping @MainActor () -> Void = {}) {
        self.post = post
        self.onOpenGig = onOpenGig
    }

    public var body: some View {
        Button(action: { onOpenGig() }) {
            GigCard(padded: false) {
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    header
                    bodyRow
                    if !post.details.isEmpty {
                        Text(post.details)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, Spacing.s3)
                            .padding(.bottom, Spacing.s3)
                    }
                    footer
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("gigPostSummaryCard")
        .accessibilityLabel("Your gig: \(post.title). \(post.bidCount) bids received. Opens the gig thread.")
    }

    private var header: some View {
        HStack {
            GigSectionLabel(text: "YOUR GIG")
            Spacer()
            HStack(spacing: 3) {
                Icon(.externalLink, size: 11, color: Theme.Color.primary600)
                Text("Open gig")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.primary600)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s2)
    }

    private var bodyRow: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            thumbnail
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(post.title)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                Text(metaLine)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                HStack(spacing: Spacing.s1) {
                    if !post.budget.isEmpty { summaryChip(icon: .dollarSign, text: post.budget) }
                    if !post.schedule.isEmpty { summaryChip(icon: .calendarDays, text: post.schedule) }
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.bottom, Spacing.s2)
    }

    private var metaLine: String {
        [post.posted, post.expires].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private var thumbnail: some View {
        RoundedRectangle(cornerRadius: Radii.md)
            .fill(
                LinearGradient(
                    colors: [Theme.Color.handyman.opacity(0.25), Theme.Color.handyman.opacity(0.6)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .frame(width: 64, height: 64)
            .overlay(Icon(.package, size: 22, color: Theme.Color.appTextInverse))
            .overlay(alignment: .topLeading) {
                HStack(spacing: 3) {
                    Icon(.package, size: 9, color: Theme.Color.handyman)
                    Text(post.categoryLabel)
                        .font(.system(size: 8.5, weight: .heavy))
                        .foregroundStyle(Theme.Color.handyman)
                }
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                .padding(Spacing.s1)
            }
            .accessibilityHidden(true)
    }

    private func summaryChip(icon: PantopusIcon, text: String) -> some View {
        HStack(spacing: 5) {
            Icon(icon, size: 11, color: Theme.Color.appTextSecondary)
            Text(text)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }

    private var footer: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.users, size: 13, color: Theme.Color.appTextSecondary)
            Text("\(post.bidCount) bids received")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
    }
}
