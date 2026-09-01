//
//  BidderProfileCard.swift
//  Pantopus
//
//  Bidder profile card for the Gig mail body — avatar (initials on an
//  identity-tinted gradient) + name + handle + blurb + a 3-up stats strip
//  (rating · jobs · response time) + skill badge chips + a "See full
//  profile" affordance.
//
// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

@MainActor
public struct BidderProfileCard: View {
    private let bidder: GigDetailDTO.Bidder
    private let onViewProfile: @MainActor () -> Void

    public init(bidder: GigDetailDTO.Bidder, onViewProfile: @escaping @MainActor () -> Void = {}) {
        self.bidder = bidder
        self.onViewProfile = onViewProfile
    }

    public var body: some View {
        GigCard {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                GigSectionLabel(text: "BIDDER")
                header
                statsStrip
                if !bidder.badges.isEmpty {
                    badges
                }
                seeProfileButton
            }
        }
        .accessibilityIdentifier("gigBidderProfileCard")
    }

    private var header: some View {
        HStack(spacing: Spacing.s3) {
            avatar
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    Text(bidder.name)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    identityChip
                }
                Text(handleAndBlurb)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(2)
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    private var handleAndBlurb: String {
        [bidder.handle, bidder.blurb].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private var avatar: some View {
        ZStack(alignment: .bottomTrailing) {
            RoundedRectangle(cornerRadius: Radii.lg)
                .fill(
                    LinearGradient(
                        colors: [Theme.Color.handyman, Theme.Color.handyman.opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 48, height: 48)
                .overlay(
                    Text(bidder.initials)
                        .font(.system(size: 15, weight: .heavy))
                        .foregroundStyle(Theme.Color.appTextInverse)
                )
            if bidder.isVerified {
                Circle()
                    .fill(Theme.Color.success)
                    .frame(width: 16, height: 16)
                    .overlay(Icon(.check, size: 9, color: Theme.Color.appTextInverse))
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: 3, y: 3)
            }
        }
        .accessibilityHidden(true)
    }

    private var identityChip: some View {
        Text(bidder.identityLabel)
            .pantopusTextStyle(.overline)
            .foregroundStyle(Theme.Color.personal)
            .padding(.horizontal, Spacing.s1)
            .padding(.vertical, 2)
            .background(Theme.Color.personalBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            .accessibilityLabel("\(bidder.identityLabel) identity")
    }

    private var statsStrip: some View {
        HStack(spacing: Spacing.s0) {
            statCell(label: "Rating") {
                HStack(spacing: 3) {
                    Icon(.star, size: 13, color: Theme.Color.warning)
                    Text(String(format: "%.1f", bidder.rating))
                        .font(.system(size: 16, weight: .heavy))
                        .foregroundStyle(Theme.Color.appText)
                }
            }
            divider
            statCell(label: "Jobs done") {
                Text("\(bidder.jobs)")
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(Theme.Color.appText)
            }
            divider
            statCell(label: "Responds") {
                Text(bidder.responseTime)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(Theme.Color.appText)
            }
        }
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(String(format: "%.1f", bidder.rating)) star rating, \(bidder.jobs) jobs done, responds in \(bidder.responseTime)"
        )
    }

    private func statCell(label: String, @ViewBuilder value: () -> some View) -> some View {
        VStack(spacing: 2) {
            value()
            Text(label)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle()
            .fill(Theme.Color.appBorder)
            .frame(width: 1, height: 28)
            .accessibilityHidden(true)
    }

    private var badges: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s1) {
                ForEach(Array(bidder.badges.enumerated()), id: \.offset) { _, badge in
                    Text(badge)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.horizontal, Spacing.s2)
                        .padding(.vertical, Spacing.s1)
                        .background(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.pill)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                }
            }
        }
        .accessibilityLabel("Skills: " + bidder.badges.joined(separator: ", "))
    }

    private var seeProfileButton: some View {
        Button(action: { onViewProfile() }) {
            HStack(spacing: Spacing.s1) {
                Text("See full profile")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Icon(.arrowRight, size: 13, color: Theme.Color.appText)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("gigBidderSeeProfile")
        .accessibilityLabel("See \(bidder.name)'s full profile")
    }
}
