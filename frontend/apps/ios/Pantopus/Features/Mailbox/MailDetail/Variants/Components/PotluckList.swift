//
//  PotluckList.swift
//  Pantopus
//
//  A17.9 — "If you'd like to bring something" rows. Each row carries
//  the emoji tile, the item, the claim attribution (or the user's own
//  "You're bringing this" line in the going state), and the trailing
//  affordance — rose-outline "I'll bring it" pill when unclaimed, a
//  rose check-circle for the user's own claim, and a muted check for
//  other friends' claims.
//

import SwiftUI

@MainActor
struct PotluckList: View {
    let party: PartyDetailDTO
    /// Called with the item index when the user taps "I'll bring it" /
    /// the rose check on their own claim.
    let onClaim: @MainActor (Int) -> Void
    let onRelease: @MainActor (Int) -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            ForEach(Array(party.bringList.enumerated()), id: \.element.id) { index, item in
                row(for: item, at: index)
                if index < party.bringList.count - 1 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("partyPotluckList")
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Text("IF YOU'D LIKE TO BRING SOMETHING")
                .font(.system(size: 11, weight: .heavy))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            let claimedCount = party.bringList.filter { $0.claimedBy != nil }.count
            Text("\(claimedCount) of \(party.bringList.count) claimed")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
    }

    // MARK: - Row

    @ViewBuilder
    private func row(for item: PartyBringItem, at index: Int) -> some View {
        let isYou = item.claimedBy == "You"
        let claimed = item.claimedBy != nil
        HStack(spacing: Spacing.s2) {
            EmojiTile(emoji: item.emoji, highlighted: isYou)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.item)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(claimed && !isYou ? Theme.Color.appTextSecondary : Theme.Color.appText)
                    .strikethrough(claimed && !isYou)
                if isYou {
                    Text("You're bringing this")
                        .font(.system(size: 10.5, weight: .heavy))
                        .foregroundStyle(Theme.Color.categoryParty)
                } else if let by = item.claimedBy {
                    Text("\(by) has it")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing(for: item, at: index, isYou: isYou, claimed: claimed)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(isYou ? Theme.Color.errorBg.opacity(0.5) : Color.clear)
        .accessibilityIdentifier("partyPotluckList_row_\(item.id)")
    }

    @ViewBuilder
    private func trailing(for _: PartyBringItem, at index: Int, isYou: Bool, claimed: Bool) -> some View {
        if !claimed {
            Button(action: { onClaim(index) }, label: {
                Text("I'll bring it")
                    .font(.system(size: 11.5, weight: .heavy))
                    .foregroundStyle(Theme.Color.categoryParty)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 6)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.pill)
                            .stroke(Theme.Color.categoryParty.opacity(0.45), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            })
            .buttonStyle(.plain)
            .accessibilityIdentifier("partyPotluckList_claim_\(index)")
        } else if isYou {
            Button(action: { onRelease(index) }, label: {
                Icon(.checkCircle, size: 18, color: Theme.Color.categoryParty)
            })
            .buttonStyle(.plain)
            .accessibilityLabel("You're bringing this. Tap to release.")
            .accessibilityIdentifier("partyPotluckList_release_\(index)")
        } else {
            Icon(.check, size: 16, color: Theme.Color.appTextMuted)
        }
    }
}

private struct EmojiTile: View {
    let emoji: String
    let highlighted: Bool

    var body: some View {
        Text(emoji)
            .font(.system(size: 16, weight: .medium))
            .frame(width: 32, height: 32)
            .background(highlighted ? Theme.Color.appSurface : Theme.Color.appSurfaceSunken)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(
                        highlighted ? Theme.Color.categoryParty : Theme.Color.appBorder,
                        lineWidth: highlighted ? 1.5 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
    }
}

#Preview("Open") {
    PotluckList(party: MailItemSampleData.partyInvite, onClaim: { _ in }, onRelease: { _ in })
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}

#Preview("Going") {
    PotluckList(party: MailItemSampleData.partyInviteGoing, onClaim: { _ in }, onRelease: { _ in })
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
