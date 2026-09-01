//
//  CommunityFeedCard.swift
//  Pantopus
//
//  A17.4 — one card in the Community mail feed: type badge + verified
//  mark + title, sender / time, body excerpt, the reach stats strip, the
//  four-reaction bar, and (events only) the RSVP button. The overflow
//  "Flag for review" affordance lives in the header.
//
//  Mirrors `ui/screens/mailbox/community/components/CommunityFeedCard.kt`.
//

import SwiftUI

struct CommunityFeedCard: View {
    let item: CommunityFeedItem
    let onReact: (CommunityReactionType) -> Void
    let onRsvp: () -> Void
    let onFlag: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            senderRow
            if let body = item.body {
                Text(body)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(3)
                    .accessibilityIdentifier("communityMail_card_body_\(item.id)")
            }
            statsRow
            reactionBar
            if item.offersRsvp {
                rsvpButton
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("communityMail_card_\(item.id)")
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(item.type.icon, size: 18, color: item.type.accent)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                HStack(spacing: Spacing.s1) {
                    Text(item.type.label)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(item.type.accent)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(item.type.accentBg)
                        .clipShape(Capsule())
                    if item.verifiedSender {
                        Icon(
                            .badgeCheck,
                            size: 14,
                            color: Theme.Color.success,
                            accessibilityLabel: "Verified sender"
                        )
                    }
                }
                Text(item.title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s2)
            Button(action: onFlag) {
                Icon(.flag, size: 18, color: Theme.Color.appTextMuted)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Flag for review")
            .accessibilityIdentifier("communityMail_flag_\(item.id)")
        }
    }

    // MARK: - Sender / time

    private var senderRow: some View {
        HStack(spacing: Spacing.s2) {
            Text(item.senderDisplay)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s2)
            if let timeAgo = item.timeAgo {
                Text(timeAgo)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }

    // MARK: - Stats

    private var statsRow: some View {
        HStack(spacing: Spacing.s3) {
            stat(icon: .eye, text: "\(item.views)")
            stat(icon: .users, text: "\(item.neighborsReceived) reached")
            if item.rsvpCount > 0 {
                stat(icon: .calendarCheck, text: "\(item.rsvpCount) RSVP")
            }
            Spacer(minLength: Spacing.s0)
        }
        .accessibilityIdentifier("communityMail_stats_\(item.id)")
    }

    private func stat(icon: PantopusIcon, text: String) -> some View {
        HStack(spacing: 3) {
            Icon(icon, size: 13, color: Theme.Color.appTextMuted)
            Text(text)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    // MARK: - Reactions

    private var reactionBar: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(CommunityReactionType.allCases) { reaction in
                let active = item.isReacted(reaction)
                let count = item.count(for: reaction)
                Button(action: { onReact(reaction) }, label: {
                    HStack(spacing: 3) {
                        Icon(
                            reaction.icon,
                            size: 13,
                            color: active ? Theme.Color.primary600 : Theme.Color.appTextMuted
                        )
                        Text(count > 0 ? "\(count)" : reaction.label)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(
                                active ? Theme.Color.primary600 : Theme.Color.appTextMuted
                            )
                    }
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 5)
                    .background(active ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
                    .clipShape(Capsule())
                })
                .buttonStyle(.plain)
                .accessibilityLabel("\(reaction.label), \(count)")
                .accessibilityIdentifier("communityMail_react_\(reaction.rawValue)_\(item.id)")
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    // MARK: - RSVP

    private var rsvpButton: some View {
        Button(action: onRsvp) {
            Text("RSVP")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(Theme.Color.business)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("communityMail_rsvp_\(item.id)")
    }
}

#if DEBUG
#Preview("Event card") {
    CommunityFeedCard(
        item: CommunityFeedItem(
            id: "ci-1",
            type: .neighborhoodEvent,
            title: "Elm Street block cleanup — Saturday 9am",
            body: "Bring gloves. Coffee and pastries at the corner of Elm and 3rd.",
            senderDisplay: "Elm Street Neighbors",
            timeAgo: "4h ago",
            verifiedSender: true,
            views: 82,
            neighborsReceived: 41,
            rsvpCount: 12,
            hasEventDate: true,
            reactionCounts: ["thumbs_up": 9, "will_attend": 12],
            userReactions: ["thumbs_up"]
        ),
        onReact: { _ in },
        onRsvp: {},
        onFlag: {}
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
#endif
