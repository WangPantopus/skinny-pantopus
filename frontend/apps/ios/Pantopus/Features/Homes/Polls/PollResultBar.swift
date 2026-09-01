//
//  PollResultBar.swift
//  Pantopus
//
//  Compact per-option result row used on the Poll detail screen. Renders
//  a tap target (when active) + label + percentage + a thin proportional
//  bar that fills based on the option's share of total votes. Lifted
//  from the design at `polls-frames.jsx:206-233`.
//

import SwiftUI

/// A single option row inside the result-bar list.
///
/// When `onTap` is set the whole row is a button — used by active polls
/// where the viewer hasn't voted yet. On closed polls (or when the row
/// is the viewer's vote) `onTap` is `nil` and the row renders as a
/// display-only band.
struct PollResultBar: View {
    let label: String
    let votes: Int
    let totalVotes: Int
    let isMyVote: Bool
    let isWinner: Bool
    let isLoading: Bool
    let onTap: (() -> Void)?

    private var pct: Double {
        totalVotes > 0 ? Double(votes) / Double(totalVotes) : 0
    }

    private var pctLabel: String {
        let value = Int((pct * 100).rounded())
        return "\(value)%"
    }

    private var voteLabel: String {
        votes == 1 ? "1 vote" : "\(votes) votes"
    }

    var body: some View {
        let content = VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                if isMyVote {
                    Icon(.checkCircle, size: 14, color: Theme.Color.success)
                }
                Text(label)
                    .pantopusTextStyle(.body)
                    .fontWeight(isWinner ? .bold : .semibold)
                    .foregroundStyle(isWinner ? Theme.Color.success : Theme.Color.appText)
                    .lineLimit(2)
                Spacer(minLength: Spacing.s2)
                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Text(pctLabel)
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: Radii.pill)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(height: 6)
                GeometryReader { geo in
                    RoundedRectangle(cornerRadius: Radii.pill)
                        .fill(barColor)
                        .frame(width: max(0, geo.size.width * pct), height: 6)
                }
                .frame(height: 6)
            }
            HStack(spacing: Spacing.s1) {
                Text(voteLabel)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                if isMyVote {
                    Text("· your vote")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.success)
                }
                if isWinner {
                    Text("· winner")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.success)
                }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(rowBackground)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(borderColor, lineWidth: isMyVote ? 1.5 : 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))

        if let onTap {
            Button(action: onTap) { content }
                .buttonStyle(.plain)
                .disabled(isLoading)
                .accessibilityIdentifier("pollDetail_option_\(label)")
                .accessibilityLabel("\(label), \(voteLabel), \(pctLabel)")
                .accessibilityHint(isMyVote ? "Already selected" : "Tap to vote")
        } else {
            content
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(label), \(voteLabel), \(pctLabel)\(isMyVote ? ", your vote" : "")")
        }
    }

    private var barColor: Color {
        if isWinner { return Theme.Color.success }
        if isMyVote { return Theme.Color.success }
        return Theme.Color.primary600
    }

    private var rowBackground: Color {
        isMyVote ? Theme.Color.successBg : Theme.Color.appSurface
    }

    private var borderColor: Color {
        isMyVote ? Theme.Color.success : Theme.Color.appBorderSubtle
    }
}

#Preview {
    VStack(spacing: Spacing.s3) {
        PollResultBar(
            label: "Sage",
            votes: 2,
            totalVotes: 3,
            isMyVote: true,
            isWinner: false,
            isLoading: false
        ) {}
        PollResultBar(
            label: "White",
            votes: 1,
            totalVotes: 3,
            isMyVote: false,
            isWinner: false,
            isLoading: false
        ) {}
        PollResultBar(
            label: "Navy",
            votes: 0,
            totalVotes: 3,
            isMyVote: false,
            isWinner: false,
            isLoading: false
        ) {}
    }
    .padding()
    .background(Theme.Color.appBg)
}
