//
//  BallotTodayCard.swift
//  Pantopus
//
//  Today — the "Ballot week" card and the "Moved this year?" well (Board:
//  Today in ballot week, as corrected on the proposed P0 board: no Mail
//  Day line, no personal delivery date, no plan line before P2). The
//  button shows only when the caller can open the ballot card.
//

import SwiftUI

struct BallotTodayCard: View {
    let card: BallotSummary
    var onOpenBallot: (() -> Void)?
    @Environment(\.openURL) private var openURL

    static func applies(_ card: BallotSummary?) -> Bool {
        guard let card else { return false }
        return card.ballotWeek?.show == true || card.moverPrompt != nil
    }

    var body: some View {
        VStack(spacing: Spacing.s4) {
            if let week = card.ballotWeek, week.show {
                weekCard(week)
            }
            if let mover = card.moverPrompt {
                Button {
                    if let raw = mover.url, let url = URL(string: raw) { openURL(url) }
                } label: {
                    BallotNoticeWell(
                        lead: "",
                        detail: "\(mover.text) \(BallotFormat.daysLeft(mover.daysLeft))",
                        radius: Radii.xl,
                        verticalPadding: Spacing.s3,
                        horizontalPadding: 14
                    )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("today.ballot.mover")
            }
        }
    }

    private func weekCard(_ week: BallotWeek) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: 10) {
                BallotTile()
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    if let overline = week.overline {
                        Text(overline)
                            .textCase(.uppercase)
                            .font(.system(size: 11, weight: .semibold))
                            .kerning(0.77)
                            .foregroundStyle(Theme.Color.home)
                    }
                    if let title = week.title {
                        Text(title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let text = week.body {
                BallotBodyText(text: text)
            }
            if let onOpenBallot {
                BallotPrimaryButton(label: "Open your ballot", height: 44, fontSize: 14.5, action: onOpenBallot)
                    .accessibilityIdentifier("today.ballot.open")
            }
        }
        .ballotCardFrame()
        .accessibilityIdentifier("today.ballot.week")
    }
}
